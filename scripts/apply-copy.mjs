import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');

function addStyles(html) {
  const tag = '<link rel="stylesheet" href="/assets/new-copy.css">';
  return html.includes(tag) ? html : html.replace('</head>', `${tag}\n</head>`);
}

function replaceMain(html, content) {
  const start = html.search(/<(?:div|main) id="main-content"/);
  const end = html.indexOf('<footer class="et-l et-l--footer"', start);
  if (start < 0 || end < 0) throw new Error('Cannot find the source page content and footer.');
  return html.slice(0, start) + content + '\n' + html.slice(end);
}

function metadata(html, title, description, route) {
  const url = `https://franziskaiseli.com${route}`;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = html.replace(/<meta\b[^>]*(?:name="description"|property="og:[^"]+"|name="twitter:[^"]+")[^>]*>\r?\n?/g, '');
  html = html.replace(/<link\b[^>]*rel="canonical"[^>]*>\r?\n?/g, '');
  html = html.replace(/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>\r?\n?/g, '');
  const schema = {'@context':'https://schema.org', '@type':'WebPage', name:title, description, url};
  return html.replace('</head>', `<meta name="description" content="${description}">\n<link rel="canonical" href="${url}">\n<meta property="og:title" content="${title}">\n<meta property="og:description" content="${description}">\n<meta property="og:url" content="${url}">\n<meta property="og:type" content="website">\n<script type="application/ld+json">${JSON.stringify(schema)}</script>\n</head>`)
    .replace(/<head>[\s\S]*?<\/head>/, head => head.replace(/^[\t ]+$/gm, '').replace(/\n{3,}/g, '\n\n'));
}

function contactCopy(html) {
  return html
    .replace('BOOKINGS', 'Have something in mind?')
    .replace(/let(?:’|&#8217;)s connect/, '<span style="display:block;font-family:Arial,sans-serif;font-size:20px;line-height:1.4">A conference, a conversation, a collaboration?</span>')
    .replace('To book Franziska for your next event, please contact our offices:', 'I’d love to hear about it. <a href="/contact/">Get in touch</a>');
}

export async function applyCopy() {
  const template = await readFile(path.join(output, 'index.html'), 'utf8');
  await cp(path.join(root, 'public', 'assets'), path.join(output, 'assets'), {recursive:true});
  for (const [file, route, title, description] of [
    ['home', '/', 'Franziska Iseli — Dangerously Alive', 'Your life is happening. Are you in it? Discover Dangerously Alive, keynotes and projects with Franziska Iseli.'],
    ['dangerously-alive', '/dangerously-alive/', 'Dangerously Alive — Franziska Iseli', 'Be one of the first 111. Discover Dangerously Alive by Franziska Iseli. Signed copies at A$39 including shipping. Official release 11 January 2027.']
  ]) {
    const content = await readFile(path.join(root, 'content', `${file}.html`), 'utf8');
    let html = contactCopy(metadata(addStyles(replaceMain(template, content)), title, description, route));
    if (file !== 'home') html = html.replace('class="home wp-singular', 'class="wp-singular');
    const directory = path.join(output, route);
    await mkdir(directory, {recursive:true});
    await writeFile(path.join(directory, 'index.html'), html);
  }

  // Preserve the existing book catalogue and make the new book discoverable there.
  const booksFile = path.join(output, 'books', 'index.html');
  let books = await readFile(booksFile, 'utf8');
  books = books.replace(/<!-- new-book:start -->[\s\S]*?<!-- new-book:end -->\n?/g, '');
  const feature = '<!-- new-book:start --><section class="fi-copy fi-books-feature"><p class="fi-eyebrow">New book · 11 January 2027</p><h2>Dangerously Alive</h2><p>Your life is happening. Are you in it?</p><p>111 personally signed copies. A$39 including shipping.</p><a class="fi-button" href="/dangerously-alive/">Get my signed copy</a></section><!-- new-book:end -->';
  books = books.replace(/<div id="main-content">/, `<div id="main-content">\n${feature}`);
  await writeFile(booksFile, addStyles(books));
  console.log('Updated homepage, Dangerously Alive page and book catalogue.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await applyCopy();
