# HIPAA Compliance — Liberty Pharmacy Website

This document explains what is already built into this codebase and what
**must** be done operationally before the site (and later, the DRX-integrated
patient portal) can be considered HIPAA compliant.

> Key principle: **HIPAA compliance is a property of the whole system** —
> code, hosting, contracts (BAAs), and policies. Code alone is never
> "HIPAA compliant"; it can only be HIPAA-*conscious*. This site is built so
> that, today, **no PHI is collected, stored, logged, or transmitted**.

---

## 1. What the code already does

### Patient portal auth + PHI storage (added this phase)

The portal now collects registration data (a PHI repository). Safeguards
implemented in code:

- **Field-level encryption at rest** — every PHI column in `patients` is
  AES-256-GCM ciphertext (`src/lib/crypto.ts`); the Postgres database contains no
  plaintext PHI. Key comes from `PHI_ENCRYPTION_KEY` (env; production must use
  a managed secret store, §164.312(a)(2)(iv)).
- **Credential separation** — login credentials (`accounts`) live apart from
  demographics (`patients`); passwords are scrypt-hashed, never stored.
- **Audit controls (§164.312(b))** — `audit_log` records every registration,
  login success/failure, and patient-record read with actor, action, outcome,
  IP, and timestamp. No PHI values are ever written to the log.
- **Session security** — 30-minute expiry, httpOnly + SameSite=Lax + Secure
  cookies, tokens stored only as SHA-256 hashes.
- **Access safeguards** — generic auth errors (no account enumeration),
  account lockout after 5 failed logins, per-IP registration rate limiting.
- **Consent** — registration requires acknowledging the Notice of Privacy
  Practices; the acknowledgment timestamp is stored (`hipaa_ack_at`).
- The local DB lives in `/data/` (gitignored). **Production requires an
  encrypted, access-controlled database under a BAA if hosted.**

### DRX field mapping (integration seam)

`patients` columns intentionally mirror DRX patient-record fields for a 1:1
migration later:

| DB column | DRX field | | DB column | DRX field |
|---|---|---|---|---|
| `patient_id` | PatientID | | `cell_phone` | CellPhone |
| `first_name` | FirstName | | `email` | Email |
| `middle_initial` | MI | | `preferred_language` | Language |
| `last_name` | LastName | | `allergies` | Allergies |
| `date_of_birth` | DOB | | `medical_conditions` | Diseases |
| `gender` | Sex | | `ins_bin` | InsBIN |
| `address1` | Address1 | | `ins_pcn` | InsPCN |
| `address2` | Address2 | | `ins_group` | InsGroup |
| `city` | City | | `ins_cardholder_id` | InsID |
| `state` | State | | `ins_person_code` | PersonCode |
| `zip` | Zip | | `ins_relationship` | Relationship |
| `phone` | Phone | | `delivery_method` | DeliveryMethod |

### No PHI outside the portal
- The rest of the site remains informational. No prescription, insurance, DOB,
  or health data is requested anywhere outside `/portal/register`.
- The contact form (`src/components/ContactForm.tsx`) is restricted to
  general inquiries, warns users not to submit health information, and the
  server route (`src/app/api/contact/route.ts`):
  - validates input with zod,
  - **screens messages for PHI-like patterns** (SSN, Rx numbers, DOB,
    medical terms) and rejects them with guidance to call instead,
  - **stores nothing, logs nothing, forwards nothing** until a BAA-covered
    delivery channel is configured.
- Footer states the site's no-PHI posture.

### Transport & browser security (`next.config.mjs`)
- `Strict-Transport-Security` (2 years, includeSubDomains, preload).
- `Content-Security-Policy`: self-origin only for scripts/styles/connections;
  `frame-ancestors 'none'`; `form-action 'self'`; `upgrade-insecure-requests`.
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy` denying camera/mic/geolocation/payment,
  `Cross-Origin-Opener-Policy` / `Cross-Origin-Resource-Policy: same-origin`.
- `poweredByHeader: false` (no stack fingerprinting).

### No tracking
- **Zero third-party scripts**: no analytics, no ad pixels, no CDNs, no
  external fonts. This matters because HHS/OCR guidance treats tracking
  technologies on health-related pages as a serious risk area.
- The only cookie is the portal's `lp_session` auth cookie (httpOnly,
  first-party, no tracking). Marketing pages set no cookies.

### Legal pages
- `/privacy-policy` — website privacy policy (no-PHI posture).
- `/hipaa-notice` — Notice of Privacy Practices template per 45 CFR 164.520.
  **Must be reviewed by the pharmacy's Privacy Officer/counsel before launch.**

---

## 2. Operational checklist (required before/at launch)

- [ ] **Hosting**: deploy behind HTTPS with a valid certificate. Any host is
      fine for the current no-PHI site; once PHI flows (portal phase), hosting
      must be under a **BAA** (e.g., AWS/GCP/Azure covered services, Vercel
      Enterprise with BAA, etc.).
- [ ] **Review the NPP** (`/hipaa-notice`) with your Privacy Officer; match it
      to the printed notice in the store; set the real effective date.
- [ ] **Review the privacy policy** with counsel.
- [ ] **Domain email**: update `src/lib/site.ts` with real contact email; do
      not publish an inbox that will receive PHI unless the email provider is
      under BAA (e.g., Google Workspace with BAA, Paubox).
- [ ] **Verify no trackers creep in**: any future analytics must be
      privacy-safe and self-hosted (or covered by BAA); never add ad pixels.
- [ ] Confirm real address/phone/fax/hours in `src/lib/site.ts`.

## 3. Checklist for the DRX integration phase (future)

- [ ] **Sign a BAA with DRX** before any patient data flows through this site
      or its APIs. DRX (drxapp.com / drxrefill.com) acts as a business
      associate (or subcontractor) when handling PHI on the pharmacy's behalf.
- [ ] Keep all DRX API calls **server-side** (`src/lib/drx.ts` + API routes);
      never expose API keys or PHI-bearing endpoints directly to the browser.
- [ ] Add the DRX origin to `connect-src` in the CSP (`next.config.mjs`).
- [ ] Tighten CSP: replace `'unsafe-inline'` in `script-src` with nonces
      before handling PHI in the browser.
- [ ] **Authentication**: portal sessions must use secure, httpOnly,
      SameSite cookies; enforce MFA if DRX supports it.
- [ ] **Audit logging**: log access events (who/when/what) *without* logging
      PHI payloads; retain per your policies (HIPAA requires 6-year retention
      of required documentation).
- [ ] **Minimum necessary**: request only the DRX data fields each feature
      needs.
- [ ] Risk analysis: perform and document a security risk assessment
      (45 CFR 164.308(a)(1)) covering the website + DRX data flows.
- [ ] Incident response: have a documented breach notification procedure
      (60-day HHS/individual notification clock).

## 4. Developer rules of thumb

1. **Never `console.log` form submissions or request bodies** — server logs
   are the most common accidental PHI store.
2. Never add a third-party `<script>`, font, pixel, or iframe without
   checking this document first.
3. Anything that touches PHI goes through a server route — never client-side
   direct to a third party.
4. New forms must default to the no-PHI pattern (warning + server-side
   screening) unless the PHI checklist above is fully satisfied.
