import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyCopy } from "./apply-copy.mjs";

const SOURCE = new URL("https://franziskaiseli.com/");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "dist");
const PUBLIC = path.join(ROOT, "public");
const CONCURRENCY = 12;

const pageUrls = new Set();
const assetUrls = new Set();
const completed = new Set();
const failures = [];

const blockedPath = /\/(?:wp-admin|wp-login|xmlrpc\.php)(?:\/|$)/i;
const ignoredSchemes = /^(?:data|mailto|tel|javascript|blob):/i;

function cleanUrl(raw, base = SOURCE) {
  if (!raw || ignoredSchemes.test(raw) || raw.startsWith("#")) return null;
  try {
    const url = new URL(raw.replaceAll("&amp;", "&"), base);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function isLocal(url) {
  return url.hostname === SOURCE.hostname || url.hostname === `www.${SOURCE.hostname}`;
}

function shouldFetch(url) {
  if (!isLocal(url) || blockedPath.test(url.pathname)) return false;
  if (url.searchParams.has("s") || url.searchParams.has("replytocom")) return false;
  if (/\/(?:feed|comments\/feed)\/?$/i.test(url.pathname)) return false;
  return true;
}

function withoutQuery(url) {
  const copy = new URL(url);
  copy.search = "";
  copy.hash = "";
  if (copy.hostname.startsWith("www.")) copy.hostname = SOURCE.hostname;
  return copy;
}

function outputPath(url, contentType = "") {
  const normalized = withoutQuery(url);
  let pathname = decodeURIComponent(normalized.pathname);
  const looksHtml = contentType.includes("text/html") || (!path.extname(pathname) && !pathname.startsWith("/wp-json"));
  if (pathname.endsWith("/")) pathname += "index.html";
  else if (looksHtml) pathname += "/index.html";
  const relative = pathname.replace(/^\/+/, "") || "index.html";
  return path.join(OUTPUT, relative);
}

function addDiscovered(raw, base, hint = "asset") {
  const url = cleanUrl(raw, base);
  if (!url || !shouldFetch(url)) return;
  const normalized = withoutQuery(url).href;
  if (hint === "page" || /\/$/.test(url.pathname) || (!path.extname(url.pathname) && !url.search)) {
    pageUrls.add(normalized);
  } else {
    assetUrls.add(normalized);
  }
}

function rewriteLocalReferences(text) {
  return text
    .replaceAll("https://www.franziskaiseli.com", "")
    .replaceAll("http://www.franziskaiseli.com", "")
    .replaceAll("https://franziskaiseli.com", "")
    .replaceAll("http://franziskaiseli.com", "")
    .replaceAll("//www.franziskaiseli.com", "")
    .replaceAll("//franziskaiseli.com", "");
}

function discoverHtml(html, base) {
  const attrPattern = /\b(?:href|src|poster|data-src|data-lazy-src|data-bg|action)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(attrPattern)) {
    const raw = match[1];
    const pageLike = /(?:href|action)/i.test(match[0]) && !/\.(?:css|js|mjs|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|mp4|webm|pdf)(?:[?#]|$)/i.test(raw);
    addDiscovered(raw, base, pageLike ? "page" : "asset");
  }
  for (const match of html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
    for (const candidate of match[1].split(",")) addDiscovered(candidate.trim().split(/\s+/)[0], base);
  }
  for (const match of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) addDiscovered(match[1], base);
}

function discoverCss(css, base) {
  for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) addDiscovered(match[1], base);
  for (const match of css.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/gi)) addDiscovered(match[1], base);
}

function discoverXml(xml, base) {
  for (const match of xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+)/gi)) {
    const url = cleanUrl(match[1].trim(), base);
    if (!url || !shouldFetch(url)) continue;
    if (url.pathname.endsWith(".xml")) assetUrls.add(withoutQuery(url).href);
    else addDiscovered(url.href, base, /\.[a-z0-9]{2,5}$/i.test(url.pathname) ? "asset" : "page");
  }
}

async function saveResponse(urlString) {
  if (completed.has(urlString)) return;
  completed.add(urlString);
  const url = new URL(urlString);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "FranziskaIseliClientMirror/1.0" },
      signal: AbortSignal.timeout(45_000)
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const contentType = response.headers.get("content-type") || "";
    const isText = /(?:text\/|javascript|json|xml|svg)/i.test(contentType);
    const target = outputPath(url, contentType);
    await mkdir(path.dirname(target), { recursive: true });

    if (isText) {
      let body = await response.text();
      if (contentType.includes("text/html")) discoverHtml(body, url);
      else if (contentType.includes("css")) discoverCss(body, url);
      else if (contentType.includes("xml")) discoverXml(body, url);
      body = rewriteLocalReferences(body);
      await writeFile(target, body);
    } else {
      await writeFile(target, Buffer.from(await response.arrayBuffer()));
    }
  } catch (error) {
    failures.push({ url: urlString, error: error.message });
  }
}

async function drainQueue() {
  while (true) {
    const queued = [...pageUrls, ...assetUrls].filter((url) => !completed.has(url));
    if (!queued.length) break;
    for (let index = 0; index < queued.length; index += CONCURRENCY) {
      const batch = queued.slice(index, index + CONCURRENCY);
      await Promise.all(batch.map(saveResponse));
      process.stdout.write(`\rMirrored ${completed.size} URLs`);
    }
  }
  process.stdout.write("\n");
}

async function copyPublicFiles() {
  await cp(PUBLIC, OUTPUT, { recursive: true, force: true });
}

async function injectCloudflareEnhancements() {
  const contactPage = path.join(OUTPUT, "contact", "index.html");
  let html = await readFile(contactPage, "utf8");
  const scriptTag = '<script src="/assets/contact-form.js" defer></script>';
  if (!html.includes(scriptTag)) {
    html = html.replace("</body>", `${scriptTag}\n</body>`);
    await writeFile(contactPage, html);
  }
}

await rm(OUTPUT, { recursive: true, force: true });
await mkdir(OUTPUT, { recursive: true });

assetUrls.add(new URL("sitemap.xml", SOURCE).href);
pageUrls.add(SOURCE.href);
await drainQueue();
await copyPublicFiles();
await injectCloudflareEnhancements();
await applyCopy();

const report = {
  source: SOURCE.href,
  generatedAt: new Date().toISOString(),
  pagesDiscovered: pageUrls.size,
  assetsDiscovered: assetUrls.size,
  urlsFetched: completed.size,
  failures
};
await writeFile(path.join(OUTPUT, "mirror-report.json"), JSON.stringify(report, null, 2));

console.log(`Snapshot complete: ${completed.size - failures.length}/${completed.size} URLs saved.`);
if (failures.length) {
  console.warn(`${failures.length} URL(s) could not be mirrored. See dist/mirror-report.json.`);
}
