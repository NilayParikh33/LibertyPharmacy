# Liberty Pharmacy

Liberty Pharmacy is a HIPAA-conscious retail pharmacy in Austin, TX. This
repository contains the marketing/landing website, built to be HIPAA-aware
from day one with a clean seam for future DRX platform integration.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 3** for styling
- **zod** for server-side form validation
- Zero third-party scripts, trackers, cookies, or external assets

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## Pages

| Route | Purpose |
|---|---|
| `/` | Home — hero, highlights, services preview, visit CTA |
| `/about` | Story, values |
| `/services` | Full services grid |
| `/providers` | Compounding programs for physicians/clinics |
| `/blog`, `/blog/[slug]` | Static blog (swap `src/lib/posts.ts` for a CMS later) |
| `/locations` | Address, hours, map link |
| `/contact` | Contact info + no-PHI general inquiry form |
| `/portal` | Patient portal placeholder — auto-activates when DRX is configured |
| `/privacy-policy` | Website privacy policy |
| `/hipaa-notice` | HIPAA Notice of Privacy Practices (template — legal review required) |

## HIPAA posture

The current site **collects no PHI by design**. Security headers, a
PHI-screening contact endpoint, and a no-tracking policy are built in.
Read **[HIPAA-COMPLIANCE.md](HIPAA-COMPLIANCE.md)** before changing forms,
adding scripts, or starting the DRX integration — it contains the full
operational checklist (BAAs, hosting, NPP review, CSP tightening).

## DRX integration (future)

The integration seam lives in:

- `src/lib/drx.ts` — stubbed API layer (server-side only)
- `.env.example` — environment variables to configure
- `src/app/portal/page.tsx` — portal UI that links out to the DRX storefront
  automatically once `NEXT_PUBLIC_DRX_STORE_URL` is set
- `next.config.mjs` — add the DRX origin to CSP `connect-src` when wiring up

## Site content

All business details (name, address, phone, hours, nav) live in
`src/lib/site.ts` — edit once, reflected everywhere.
