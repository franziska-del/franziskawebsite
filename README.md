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

- Homepage and Dangerously Alive copy live in `content/`; `scripts/apply-copy.mjs` applies them after each mirror build. Run `npm run update:copy` to update the existing snapshot without downloading the source site again.
- The copy source is [Franziska Iseli website](https://docs.google.com/document/d/1koNNnm4srgYjW2ekbih9OARNCHm_rTIXETYgL7Tr5hw/edit), read on 30 September 2026. Adventure photos are stored locally in `public/assets/adventure/` from the supplied Drive folder.
- The final offer in the source supersedes the earlier draft: 111 signed copies at A$39 including shipping, official release 11 January 2027, pre-Christmas cut-off 10 December 2026. The obvious “Unook” typo is corrected to “Unhook”.
- Stripe checkout and Brevo signup are pending. The book page links to contact while ordering is unavailable; newsletter fields are disabled with an explicit coming-soon message. No payment or subscription is submitted. Reader resources, Amazon purchase links, reader stories, endorsements and bulk ordering can be added when supplied; the resource link in the doc is a reference to another author's site.

- Re-run `npm run build` whenever the source site changes; `dist/mirror-report.json` records the snapshot result.
- Two unusually slow source assets are checked into `public/` as build fallbacks. The oversized EO header is web-optimized there so every Cloudflare asset remains below the platform’s per-file limit.
- Public same-origin pages and assets are served locally from Cloudflare. External social, video, retail, and Basic Bananas links remain external.
- WordPress administration is intentionally not included. The contact form no longer requires WordPress, but it does require the three Cloudflare/Resend environment variables above.
- The client should connect the final custom domain in Cloudflare Pages after reviewing the preview deployment.
