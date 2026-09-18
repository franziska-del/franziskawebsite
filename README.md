# Franziska Iseli — Cloudflare Pages clone

This repository produces a static, Cloudflare-ready snapshot of the current public site at [franziskaiseli.com](https://franziskaiseli.com/). It preserves the source WordPress/Divi HTML, CSS, JavaScript, public pages, and media while removing the WordPress server requirement for ordinary page delivery.

## Build

```bash
npm install
npm run build
```

The deployable output is written to `dist/`.

## Preview locally

```bash
npm run preview
```

## Deploy to Cloudflare Pages

Use these project settings in Cloudflare:

- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: 20 or newer

Or deploy from an authenticated terminal:

```bash
npm run deploy
```

### Contact form configuration

The visual Ninja Forms markup is preserved, while submissions are handled by a Cloudflare Pages Function and sent through Resend. Configure these variables in the Cloudflare Pages project:

- `RESEND_API_KEY` — encrypted secret.
- `RESEND_FROM_EMAIL` — a verified sender, for example `Website <hello@yourdomain.com>`.
- `CONTACT_TO_EMAIL` — the client inbox that receives enquiries.

For a Wrangler deployment, secrets can be added with `npx wrangler pages secret put RESEND_API_KEY`; add the two email values in the Pages project settings.

## Notes

- Re-run `npm run build` whenever the source site changes; `dist/mirror-report.json` records the snapshot result.
- Two unusually slow source assets are checked into `public/` as build fallbacks. The oversized EO header is web-optimized there so every Cloudflare asset remains below the platform’s per-file limit.
- Public same-origin pages and assets are served locally from Cloudflare. External social, video, retail, and Basic Bananas links remain external.
- WordPress administration is intentionally not included. The contact form no longer requires WordPress, but it does require the three Cloudflare/Resend environment variables above.
- The client should connect the final custom domain in Cloudflare Pages after reviewing the preview deployment.
