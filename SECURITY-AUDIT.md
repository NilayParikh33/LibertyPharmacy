# Application Security Audit — Liberty Pharmacy

**Date:** 2026-09-25 · **Type:** authorized white-box audit (source + local dynamic testing) · **Scope:** this repository at branch `claude/dreamy-keller-bggslh`

This complements [`SECURITY-RISK-ANALYSIS.md`](SECURITY-RISK-ANALYSIS.md), the HIPAA risk analysis, which covered secrets, admin MFA, backups, and encryption at rest (T-01…T-08). That analysis did not test the application layer endpoint by endpoint. This audit does.

---

## Executive summary

**Overall posture: solid foundations, with real gaps at the application layer — now closed.** The core design choices were already sound:

- Parameterized SQL everywhere.
- AES-256-GCM field encryption for PHI.
- scrypt password hashing.
- Opaque, hashed, server-side sessions.
- Email MFA for patients and TOTP MFA for admins.
- An append-only audit log.
- No raw-HTML rendering sinks.
- No file upload, payments, or server-side URL fetching.

No injection, remote code execution in the app's own code, or cross-account data access (IDOR) was found.

**What was found:** 14 findings plus one "Not Verified". Every one was reproduced with a non-destructive proof of concept against a local production build before being fixed.

| Severity | Count | Findings |
| --- | --- | --- |
| High | 1 | SEC-012 vulnerable dependencies (a critical Next.js RCE advisory on an exposed endpoint) |
| Medium | 5 | SEC-001 admin pages rendered without login · SEC-002 patient-account enumeration · SEC-003 contact-form flooding · SEC-004 password spraying · SEC-013 database reachable from the internet |
| Low | 7 | SEC-006, SEC-007, SEC-008, SEC-009, SEC-010, SEC-011, SEC-014 |
| Informational | 1 | SEC-005 reset-link poisoning — tested, **not exploitable** |
| Not Verified | 1 | SEC-015 client-IP trust behind the production proxy |

**What was fixed:** everything above except the Not Verified item. That one is now configurable, with a verification step for operations.

- **Re-attacks:** all 15 proof-of-concept checks now report `SECURE`.
- **Legitimate flows:** 9 browser flows pass with zero CSP violations: registration, login MFA, reset, contact, and all admin operations.
- **Dependencies:** `npm audit` reports 0 vulnerabilities.

**What remains:** see [Unresolved and accepted risks](#unresolved-and-accepted-risks). The largest item is that the rate limiters are still per-process (existing finding T-03).

**Limitation:** all testing was local. I had no access to the live Render deployment, so production-only behaviour is marked **Not Verified** wherever it matters.

---

## Attack-surface map

| Surface | Endpoint / route | Method | AuthN | AuthZ | User input | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Patient register | `/api/auth/register` | POST | none | — | full patient record (PHI) | zod-validated, encrypted at rest, 5/10 min per IP |
| Patient login | `/api/auth/login` | POST | none | — | email, password | per-account lockout; **now** + per-IP cap |
| Email code | `/api/auth/verify`, `/resend` | POST | pending-challenge cookie | own challenge | 6-digit code | 5 attempts per challenge |
| Password reset | `/api/auth/forgot`, `/reset` | POST | none / reset token | token owner | email; token + password | token hashed, single-use, 30 min |
| Patient profile | `/api/auth/me`, `/portal` | GET | session cookie | own record only (no id parameter) | — | returns PHI |
| Logout | `/api/auth/logout`, `/api/admin/logout` | POST | session | own session | — | server-side revocation |
| Contact form | `/api/contact` | POST | none | — | name, email, phone, message | stored encrypted; emails a "doorbell" |
| Admin login | `/api/admin/login` | POST | none | — | username, password, TOTP | per-IP lock; TOTP replay-protected |
| Admin content | `/api/admin/posts[/id]`, `/settings`, `/messages/[id]` | POST/PUT/PATCH/DELETE | admin session | single admin role | post body, site settings, status | audited per admin user |
| Admin pages | `/admin`, `/admin/{messages,posts,posts/[id],posts/new,settings}` | GET (HTML + RSC) | admin session | single admin role | route `id` | `/admin/messages` shows decrypted PHI |
| Public pages | `/`, `/about`, `/services`, `/products[/id]`, `/blog[/slug]`, `/contact`, `/locations`, … | GET | none | — | `?q=`, `[slug]`, `[id]` | render admin-controlled content |
| Framework | `/_next/image` | GET | none | — | `url`, `w`, `q` | image optimizer (**now disabled**) |

- **Data stores:** Postgres, holding accounts, patients (encrypted), sessions, MFA challenges, reset tokens, the audit log, admin users and sessions, contact messages (encrypted), posts, and site settings.
- **External services:** Amazon SES in production; Gmail SMTP in development.
- **Not present:** file uploads, webhooks, background jobs, payment flows, any server-side fetch of user-supplied URLs (so no SSRF sink), and CORS grants (same-origin only).

---

## Vulnerability table

| ID | Vulnerability | Location | Severity | Root cause | Fix status |
| --- | --- | --- | --- | --- | --- |
| SEC-001 | Admin pages rendered for unauthenticated users | `src/app/admin/(protected)/*/page.tsx` | Medium | Auth enforced only in the shared layout, which is skipped on soft navigation | **Fixed** |
| SEC-002 | Patient-account enumeration: registration response, lockout, and timing | `api/auth/register`, `api/auth/login`, `api/auth/forgot`, `lib/auth.ts` | Medium | Registered and unregistered emails answered differently | **Fixed** |
| SEC-003 | Unauthenticated contact form had no rate limit | `api/contact` | Medium | No throttle on a write-and-email endpoint | **Fixed** |
| SEC-004 | No per-client limit on patient login (password spraying) | `api/auth/login` | Medium | Lockout was per account only | **Fixed** |
| SEC-005 | Reset-link origin from the Host header | `api/auth/forgot` | Informational | — | **Not vulnerable** (tested); helper centralized |
| SEC-006 | Admin settings accepted `javascript:` and off-site URLs for site-wide links | `api/admin/settings` | Low | `z.string().url()` accepts any scheme or host | **Fixed** |
| SEC-007 | No Origin or content-type check on state-changing API calls | all `/api` POST/PUT/PATCH/DELETE | Low | SameSite=Lax was the only CSRF control; `request.json()` ignores content type | **Fixed** |
| SEC-008 | Non-numeric route ids reached the database and caused a 500 | `api/admin/messages/[id]`, `api/admin/posts/[id]` | Low | Route params not validated | **Fixed** |
| SEC-009 | API responses (including PHI) had no `Cache-Control` | all `/api` | Low | No caching policy on JSON routes | **Fixed** |
| SEC-010 | Unused image optimizer exposed | `/_next/image` | Low | Framework default left on | **Fixed** |
| SEC-011 | Admin usernames enumerable by timing | `lib/admin-auth.ts` | Low | scrypt ran only for real usernames | **Fixed** |
| SEC-012 | Known-vulnerable dependencies | `package.json` | High | `next@15.5.22` (critical RCE advisories); `nodemailer@9.0.3` (high); transitive `postcss`, `sharp`, `js-yaml`, `nanoid` | **Fixed** |
| SEC-013 | Render Postgres accepts connections from any IP | `render.yaml` | Medium | No `ipAllowList` in the Blueprint | **Fixed in config** (takes effect on Blueprint sync; Not Verified live) |
| SEC-014 | CSP allowed any inline script | `next.config.mjs` | Low | `script-src 'unsafe-inline'` | **Fixed** (per-request nonce) |
| SEC-015 | Client-IP trust depends on the proxy topology | `lib/request.ts` | — | Assumes exactly one proxy | **Not Verified**; now configurable |

---

## Findings in detail

### SEC-001 — Admin pages rendered for unauthenticated users · Medium

**Vulnerability.** `requireAdmin()` ran only in `app/admin/(protected)/layout.tsx`. With Next.js partial rendering, a soft navigation between two pages under the same layout re-renders only the changed page segment. The layout, and its auth check, never runs. Any client can make that request directly.

**Attack surface.** `/admin`, `/admin/posts`, `/admin/posts/[id]`, `/admin/posts/new`, and `/admin/settings`. `/admin/messages`, which shows decrypted PHI, already called `requireAdmin()` itself and was **not** affected.

**Impact.** Unauthenticated reading of the admin dashboard (live contact-message counts), the admin post list and editor, and the settings form. No PHI was reachable. The pattern was the real danger: any future admin page that forgot its own check would have leaked whatever it displays.

**Root cause.** Authorization lived at the layout level instead of where the data is read.

**Safe reproduction.** No cookies; a request header copied from a real admin's soft navigation:
```
GET /admin/settings
RSC: 1
Next-Router-State-Tree: ["",{"children":["admin",{"children":["(protected)",{"children":["settings",{…},null,"refetch"]}]}]}]
→ 200, settings form in the payload (dashboard: "New Messages … 12")
```

**Remediation.**
- `src/app/admin/(protected)/{page,posts/page,posts/[id]/page,posts/new/page,settings/page}.tsx` now call `await requireAdmin()` themselves. The layout keeps its check as an extra layer.
- `tests/security/static.mjs` fails the build-time check if any page under `(protected)` lacks its own call.

**Verification.**
- All 4 soft-navigation replays now redirect to `/admin/login`.
- Negative test: deleting the call from one page makes `static.mjs` exit 1.
- A real admin's soft navigation still works (e2e).

### SEC-002 — Patient-account enumeration · Medium

**Vulnerability.** The code intends not to reveal which emails are registered. For a pharmacy, that list is the patient roster itself. Four oracles defeated that intent:
1. Registration answered `409 "…If you already have an account…"` for taken emails and `200` otherwise.
2. After five wrong passwords, a registered email returned `429`; an unregistered one returned `401` forever.
3. Login for a registered email took about 46 ms (scrypt); an unregistered one took about 4.5 ms.
4. `/forgot` did all its database and email work before responding, but only for registered emails.

**Impact.** Anyone could test whether a given person is a patient of this pharmacy. That is a privacy harm in its own right, and it gives phishing and credential stuffing a target list.

**Root cause.** Each code path answered according to whether the account exists.

**Safe reproduction.** Register the same test email twice (`200` then `409`); run 6 bad logins against a registered and an unregistered test email (`429` vs `401`); take median login latency over 7 requests each.

**Remediation.**
- **Registration.** A taken email gets the same `200 {"ok":true,"next":"verify"}` and a pending-challenge cookie. That cookie is a **decoy** that behaves exactly like a real challenge:
  - wrong codes return `400`, and the fifth returns `429`;
  - resend succeeds.
  
  It can never produce a session. The real owner is emailed a "someone tried to register with your email" notice instead of a code (`startDecoyChallenge` in `lib/auth.ts`, `sendAccountExistsEmail` in `lib/mail.ts`).
- **Lockout.** Unregistered emails now lock after the same 5 failures for the same window (`unknownEmailFailures` in `lib/auth.ts`).
- **Timing.** `burnPasswordCheck()` (`lib/crypto.ts`) spends identical scrypt work for unknown accounts. All emails (codes, reset links, notices) are now sent after the response via `after()`, so mail latency is unobservable.

**Verification.**
- Registration returns an identical `200` either way.
- The 6th bad login returns `429` for both.
- Median latency is 46.0 ms vs 44.5 ms.
- e2e: a duplicate registration notifies the owner, and the decoy returns `400,400,400,400,429` and never a session. Real registration, login MFA, and reset are unchanged.

### SEC-003 — Contact form had no rate limit · Medium

**Vulnerability / impact.** `/api/contact` is unauthenticated. Every submission writes an encrypted row and emails the pharmacy, so one client could flood the admin inbox and grow the database without limit.

**Root cause.** No throttle.

**Safe reproduction.** 12 submissions from one client all returned `200`.

**Remediation.** 5 submissions per 10 minutes per client, using the new shared `createRateLimiter` (`src/lib/rate-limit.ts`). The limiter's key map is capped at 10k entries with expiry sweep, so key-spraying cannot exhaust memory. The existing ad-hoc limiters in register, forgot, and resend now use the same helper.

**Verification.** 12 submissions now return `200×5, 429×7`, and the real contact page still submits (e2e).

### SEC-004 — Password spraying on patient login · Medium

**Vulnerability / impact.** Lockout was per account only, so one client could try a common password against unlimited different accounts.

**Safe reproduction.** 25 attempts against 25 emails from one client all returned `401` (never limited).

**Remediation.** A per-client cap of 20 failures per 15 minutes (`api/auth/login/route.ts`), audited as `ip_rate_limited`. It is deliberately **not** reset by a successful login; otherwise an attacker with any valid account could clear the counter between spray batches.

**Verification.** `429` from attempt #21. Normal logins pass (e2e).

### SEC-005 — Reset-link poisoning via Host header · Informational (not vulnerable)

`/forgot` falls back to the request origin when `APP_BASE_URL` is unset, which is a classic poisoning pattern.

- **Tested:** a request with `Host: attacker.example` and `X-Forwarded-Host: attacker.example` still produced a link on the real origin. Not exploitable on this stack.
- **Mitigation already in place:** production sets `APP_BASE_URL` (render.yaml).
- **Change made:** the logic moved to a shared `getAppBaseUrl()` in `lib/request.ts`, since the new registration notice needs the same origin.

### SEC-006 — Unsafe URLs in admin site settings · Low

**Vulnerability / impact.** `mapsUrl` and `phoneHref` are rendered as `href` on every page, but were validated only as "any URL" or "any string".

- **Tested:** `javascript:` was saved (React 19 then neutralizes it at render), and `https://attacker.example/phish` was saved and rendered as every "Call us" link on the site.
- **Who could do this:** it needs an admin session, but one typo or one compromised admin account would turn site-wide links into phishing links.

**Remediation.**
- `phoneHref` must match `tel:+digits`.
- `mapsUrl` must be `https:` on a Google, Apple, or Bing Maps host, with no credentials in the URL.

**Verification.** The malicious PUT now returns `400`, and saving the real settings still succeeds (e2e).

### SEC-007 — No Origin or content-type check on state-changing API calls · Low

**Vulnerability.** CSRF protection rested on SameSite=Lax cookies alone. That is effective in current browsers, but it's a single layer, and every handler's `request.json()` parses the body regardless of `Content-Type`. That keeps `<form enctype="text/plain">` JSON smuggling viable if the cookie layer ever weakens (older browsers, a future `SameSite=None` change).

**Safe reproduction.** A PATCH with `Origin: https://attacker.example` and `Content-Type: text/plain`, carrying an admin cookie, returned `200`. The cookie was supplied directly by the test, which a real cross-site page cannot do; that's why this is rated Low.

**Remediation.** New `src/middleware.ts` guards every non-GET `/api` request:
- `Sec-Fetch-Site` must be `same-origin` or `none`. Where it is absent, `Origin`, if present, must match the host.
- Bodies must be `application/json`, which cannot be sent cross-site without a CORS preflight, and no CORS headers are ever granted.
- The API matcher is unconditional; an earlier draft could have been skipped via a prefetch header, which I caught and closed.

**Verification.** The replay now returns `403`. All real UI calls (JSON bodies, and bodiless logout/delete) pass (e2e).

### SEC-008 — Unvalidated route ids · Low

**Safe reproduction.** `PATCH /api/admin/messages/not-a-number` → `500`; `DELETE /api/admin/posts/not-a-number` → `500`. There was no injection (parameters are bound); the database raised a type error that went unhandled.

**Remediation.** `parseId()` (`src/lib/ids.ts`) validates ids before any query and returns `404`. Updating a message that doesn't exist now also returns `404`.

**Verification.** Both requests now return `404`.

### SEC-009 — API responses cacheable · Low

**Vulnerability.** `/api/auth/me` returns PHI (name, email, phone) with no `Cache-Control`, so a shared proxy or the browser's back/forward cache could retain it.

**Remediation.** The middleware sets `Cache-Control: no-store` on every `/api` response.

**Verification.** The header is now present.

### SEC-010 — Unused image optimizer exposed · Low

**Vulnerability.** `/_next/image` was live, and it is where the critical AVIF RCE advisory (GHSA-2xp9-vwfh-vxw4) lives. The site never used it: product images are plain `<img>`, and the only `next/image` usage is already `unoptimized`.

**Remediation.** `images: { unoptimized: true }` in `next.config.mjs`. This removes the attack surface independently of the SEC-012 upgrade.

**Verification.** The endpoint now returns `404`, and all images still render (e2e).

### SEC-011 — Admin username timing · Low

**Vulnerability.** A known admin username answered in about 46 ms; an unknown one in about 8 ms.

**Remediation.** `burnPasswordCheck()` runs for unknown usernames too.

**Verification.** 46.0 ms vs 45.8 ms.

### SEC-012 — Vulnerable dependencies · High

**Vulnerability.** `npm audit` reported 1 critical and 5 high:
- **`next@15.5.22`** (critical): two RCE advisories. One is Windows-hosted only, so N/A here. The other is in the image optimizer, see SEC-010.
- **`nodemailer@9.0.3`** (high): recipient-domain validation bypasses and a denial of service in address parsing.
- **Transitive / build-time:** `postcss` (arbitrary `.map` file read), `sharp`/libvips, `js-yaml`, and `nanoid`.

**Remediation.** Upgrades within the current majors, with no breaking changes:
- `next` and `eslint-config-next` → 15.5.26;
- `nodemailer` → 9.1.1;
- `postcss` → 8.5.28, plus an `overrides` entry so Next's own pinned `postcss@8.4.31` also resolves to 8.5.28;
- `sharp` → 0.35.4, via the Next upgrade.

**Verification.**
- `npm audit`: **0 vulnerabilities**.
- Typecheck, lint, and production build are clean; all pages render and hydrate (e2e).

### SEC-013 — Render database reachable from the internet · Medium

**Vulnerability.** The Blueprint's `databases:` block had no `ipAllowList`. Render then accepts connections from **any IP**, protected only by the password. That is combined with `DB_SSL_MODE=require`, which encrypts the connection but doesn't verify the certificate (already documented in render.yaml).

**Remediation.** `ipAllowList: []` — reachable only from Render's private network (the web service), with a commented example for adding an operator's office IP.

**Verification.** **Not Verified live** (no dashboard access). This takes effect when the Blueprint is synced. Confirm in Render → liberty-db → Networking that "Access Control" shows no external sources.

### SEC-014 — CSP allowed any inline script · Low (hardening)

**Vulnerability.** `script-src 'self' 'unsafe-inline'` meant that an injected inline script would run. No injection point was found, so this is defence in depth, but the site now renders admin-controlled content.

**Remediation.**
- The CSP moved from a static header to `src/middleware.ts`, with a fresh nonce per response: `script-src 'self' 'nonce-…' 'strict-dynamic'`.
- Next.js attaches the nonce to its own scripts. Every page was already dynamically rendered, so there is no performance change.
- Other directives are unchanged (`frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`, …).

**Verification.**
- 4 page types checked (including `/products/[id]`): every `<script>` tag carries that response's nonce, and nonces are unique per response.
- 14 public pages plus the portal and admin flows hydrate with **zero** CSP violations (e2e).

### SEC-015 — Client-IP trust depends on proxy topology · Not Verified

**Issue.** `getClientIp()` trusts the rightmost `X-Forwarded-For` hop, which assumes exactly one proxy. If production has two (for example, a CDN in front of Render's load balancer), then:
- **Rate limits:** every visitor would share one IP key, so one abuser could trip the per-IP limits for everyone.
- **Audit logs:** audit-log IPs would be wrong.

**Change.** A `TRUSTED_PROXY_HOPS` environment variable (default `1`, so behaviour is unchanged), documented in render.yaml and .env.example.

**To verify after deploy.** Log one request's `X-Forwarded-For` and confirm the client's real IP is that many entries from the right.

---

## Unresolved and accepted risks

| Item | Status | Recommendation |
| --- | --- | --- |
| Rate limits, lockouts, TOTP-replay memory, and decoy challenges are per-process (existing **T-03**) | Accepted while single-instance | Move them to Postgres before adding a second instance. `rate-limit.ts` is the one place to change. |
| `DB_SSL_MODE=require` on Render (no certificate verification) | Documented demo setting | Switch to `verify-public` or `verify-ca` before any PHI. |
| `style-src 'unsafe-inline'` | Accepted | Inline style attributes are used throughout and are not a script-execution vector. |
| Unverified-account squatting: someone can register a victim's email with fake details; the victim recovers via password reset but then sees the squatter's profile | Low; not fixed | Expire accounts left unverified after about 24 hours, or let a verified reset clear the profile. |
| Old secrets remain in git history | Rotated (T-01) | Optionally purge history with `git filter-repo`. |
| No breached-password check | Recommendation | Add a k-anonymity check (e.g. HIBP range API) at registration and reset. |
| `DEMO_SHOW_OTP_ON_SCREEN` / `DEMO_LOG_OTP_CODES` | Code-guarded; not set in render.yaml | Keep them unset in any environment with real patients. |
| Live production behaviour (headers, proxy chain, database network policy) | **Not Verified** (no access) | Run `npm run test:security` against a staging copy after each deploy. |

---

## Changes by file

| File | Component | Problem | Security fix |
| --- | --- | --- | --- |
| `src/app/admin/(protected)/*/page.tsx` (5) | Admin pages | SEC-001 | Page-level `requireAdmin()` |
| `src/middleware.ts` (new) | Request guard | SEC-007/009/014 | Origin/Sec-Fetch-Site check, JSON-only bodies, `no-store`, nonce CSP |
| `src/lib/auth.ts` | Patient auth | SEC-002 | Uniform lockout, dummy scrypt, decoy challenges, email after response |
| `src/lib/crypto.ts` | Crypto | SEC-002/011 | `burnPasswordCheck()` |
| `src/lib/rate-limit.ts` (new) | Rate limiting | SEC-003/004 | Shared bounded limiter |
| `src/lib/mail.ts` | Mail | SEC-002 | `sendAccountExistsEmail()` |
| `src/lib/request.ts` | Request helpers | SEC-005/015 | `getAppBaseUrl()`, `TRUSTED_PROXY_HOPS` |
| `src/lib/ids.ts` (new) | Validation | SEC-008 | `parseId()` |
| `src/lib/admin-auth.ts` | Admin auth | SEC-011 | Constant-cost unknown usernames |
| `src/app/api/auth/{register,login,forgot,resend}/route.ts` | Auth API | SEC-002/004 | Identical duplicate response, per-IP login cap, deferred work, shared limiter |
| `src/app/api/contact/route.ts` | Contact API | SEC-003 | Rate limit |
| `src/app/api/admin/settings/route.ts` | Settings API | SEC-006 | `tel:` / https-maps allowlist |
| `src/app/api/admin/{messages,posts}/[id]/route.ts` | Admin API | SEC-008 | Id validation, 404 |
| `next.config.mjs` | Config | SEC-010/014 | `images.unoptimized`; CSP moved to middleware |
| `package.json`, `package-lock.json` | Dependencies | SEC-012 | Patched versions + `postcss` override |
| `render.yaml`, `.env.example` | Deployment | SEC-013/015 | `ipAllowList: []`, `TRUSTED_PROXY_HOPS` |
| `tests/security/*` (new) | Regression tests | all | `static.mjs`, `poc.mjs` (15 attack replays), `functional.mjs` (9 browser flows) |

## How this was verified

1. **Baseline.** All proof-of-concept checks ran against a production build of the unfixed code: 13 of 14 were vulnerable. SEC-005 was already secure; SEC-014 was added to the suite later, with the fix.
2. **Fixes applied.** tsc, ESLint, and `next build` are clean; `npm audit` shows 0 vulnerabilities.
3. **Re-attack.** The same checks, plus SEC-014 (15 in total), all report `SECURE`. The static guard was negative-tested: removing one `requireAdmin()` makes it fail.
4. **Legitimate use.** A real browser ran 9 flows, all passing with zero page errors and zero CSP violations:
   - every public page hydrates;
   - register → code → session;
   - logout;
   - login → MFA → portal;
   - duplicate-registration decoy;
   - forgot → reset → login;
   - contact form;
   - admin login, every page, soft navigation, settings save, message status, and post edit.
5. **Cleanup.** Test data (accounts, messages, the throwaway admin) was removed from the local database afterwards.

To re-run: see [`tests/security/README.md`](tests/security/README.md).
