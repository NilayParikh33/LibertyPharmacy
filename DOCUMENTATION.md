# Liberty Pharmacy — Project Documentation

A plain-English, end-to-end walkthrough of what this project is, how it is
organized, and how every piece of code works together. Read this if you are
new to the project (or new to Next.js) and want the full picture without
digging through every file yourself.

> For the HIPAA/security checklist, see [HIPAA-COMPLIANCE.md](HIPAA-COMPLIANCE.md).
> For a quick command reference, see [README.md](README.md).

---

## 1. What is this project?

Liberty Pharmacy's website. It has two halves:

1. **A marketing website** — home page, about, services, providers, blog,
   locations, contact. Plain informational pages, no login required.
2. **A patient portal** — `/portal`, where a patient can create an account,
   sign in, and (soon) request refills, transfer prescriptions, and message
   the pharmacy. This half stores real personal/health data, so it is built
   with encryption, audit logging, and login protection from day one.

Nothing fancy is required to picture the two halves: the marketing pages are
like a brochure; the portal is like a bank's online-banking login — it has to
be trustworthy with your data.

---

## 2. The technology, explained simply

| Piece | What it actually is | Why it's here |
|---|---|---|
| **Next.js** | A framework built on top of React that handles pages, routing, and server code in one project | Lets one project serve both the web pages *and* the backend API — no separate server needed |
| **React** | A library for building UI out of reusable components (`<Header />`, `<ContactForm />`, etc.) | Every page and component in `src/` is written in React |
| **TypeScript** | JavaScript with type-checking added | Catches bugs (wrong data shapes, typos) before the code ever runs |
| **Tailwind CSS** | A CSS toolkit where you style elements with utility classes like `text-sm font-bold` directly in the markup | No separate `.css` file per component — styling lives next to the JSX |
| **zod** | A library that validates data shapes (e.g. "is this really an email?") | Used on every API route to check what the browser sends before touching the database |
| **better-sqlite3** | A simple, file-based SQL database | Stores accounts, patient records, sessions, and audit logs in one file (`data/liberty.db`) |

You do **not** need a separate database server. SQLite is just a file on
disk. That is intentional for a small pharmacy site — the docs explain how
to swap it for a bigger, BAA-covered database later (see
`HIPAA-COMPLIANCE.md`).

---

## 3. Folder structure map

```
LibertyPharmacy/
├── src/
│   ├── app/                     ← every folder here = a URL route (Next.js "App Router")
│   │   ├── layout.tsx           ← wraps every page: <Header/>, <Footer/>, global <html>
│   │   ├── globals.css          ← Tailwind setup + a few reusable classes (.btn-primary, .card…)
│   │   ├── page.tsx             ← "/"  (home page)
│   │   ├── about/page.tsx       ← "/about"
│   │   ├── services/page.tsx    ← "/services"
│   │   ├── providers/page.tsx   ← "/providers"
│   │   ├── locations/page.tsx   ← "/locations"
│   │   ├── contact/page.tsx     ← "/contact"
│   │   ├── privacy-policy/page.tsx
│   │   ├── hipaa-notice/page.tsx
│   │   ├── blog/
│   │   │   ├── page.tsx         ← "/blog"          (list of posts)
│   │   │   └── [slug]/page.tsx  ← "/blog/anything"  (one post — [slug] is a dynamic segment)
│   │   ├── portal/
│   │   │   ├── page.tsx         ← "/portal"          (dashboard if signed in, else sign-in prompt)
│   │   │   ├── login/page.tsx   ← "/portal/login"
│   │   │   ├── register/page.tsx← "/portal/register"
│   │   │   └── verify/page.tsx  ← "/portal/verify"   (enter the 6-digit emailed code)
│   │   └── api/                 ← backend endpoints (no HTML, just JSON)
│   │       ├── auth/login/route.ts
│   │       ├── auth/register/route.ts
│   │       ├── auth/verify/route.ts   ← confirms the emailed code
│   │       ├── auth/resend/route.ts   ← re-sends the emailed code
│   │       ├── auth/logout/route.ts
│   │       ├── auth/me/route.ts
│   │       └── contact/route.ts
│   ├── components/              ← reusable UI pieces, used across multiple pages
│   │   ├── Header.tsx, Footer.tsx, Logo.tsx, PageHero.tsx
│   │   ├── ContactForm.tsx
│   │   └── LogoutButton.tsx
│   └── lib/                     ← plain TypeScript logic (no UI) — the "backend" of the app
│       ├── site.ts              ← business info (address, phone, hours, nav links)
│       ├── posts.ts             ← blog content (hard-coded for now)
│       ├── db.ts                ← opens the SQLite database, defines the tables
│       ├── crypto.ts            ← encryption, password hashing, one-time-code helpers
│       ├── auth.ts              ← registration / login / MFA / session logic
│       ├── mail.ts              ← sends the one-time-code emails (Gmail SMTP for now)
│       ├── request.ts           ← safely reads the caller's IP address
│       └── drx.ts                ← placeholder for the future pharmacy-platform integration
├── data/                        ← the SQLite database file lives here (gitignored)
├── .env.example                 ← template for secret configuration (copy to .env.local)
├── next.config.mjs              ← security headers + Content-Security-Policy
├── tailwind.config.ts           ← brand colors (navy, Liberty red/gold)
├── HIPAA-COMPLIANCE.md          ← what's built + what's still required operationally
└── README.md                    ← quick-start commands and route table
```

**Rule of thumb:** if it renders something on screen, it's in `app/` or
`components/`. If it's logic/data with no UI, it's in `lib/`.

---

## 4. How a page actually loads (Next.js basics)

Next.js uses **file-based routing**: the folder path under `src/app/`
*is* the URL.

- `src/app/about/page.tsx` → visiting `/about` renders that file.
- `src/app/blog/[slug]/page.tsx` → the square brackets mean "anything goes
  here." Visiting `/blog/embracing-wellness` renders that file with
  `slug = "embracing-wellness"`.

Every page is wrapped by `src/app/layout.tsx`, which is why the `<Header />`
and `<Footer />` show up on every single page without each page having to
add them.

Most pages here are plain functions that return JSX (HTML-like markup) —
look at `src/app/about/page.tsx` for the simplest example. A few pages need
to *do* something before rendering (check if a patient is logged in, fetch
their profile) — those are `async function` pages, like
`src/app/portal/page.tsx`.

---

## 5. The marketing site (the easy half)

All business facts — name, address, phone, fax, hours, nav menu — live in
**one file**: `src/lib/site.ts`. Every page imports from it instead of
hard-coding the phone number in ten places. **If the phone number or hours
change, this is the only file to edit.**

The blog works the same way: `src/lib/posts.ts` is a plain array of blog
posts. `blog/page.tsx` lists them; `blog/[slug]/page.tsx` finds the one
matching the URL and renders it. There's no database or CMS yet — adding a
post means adding an object to that array.

`ContactForm.tsx` is a small React component with local state (sending /
sent / error) that `POST`s to `/api/contact`. That API route validates the
input, screens the message for anything that looks like health information
(SSNs, prescription numbers, diagnoses...), and — importantly — **stores and
logs nothing**. It exists so the marketing site can offer a contact form
without becoming an accidental place where someone types in their medical
history.

---

## 6. The Patient Portal (the important half)

This is where real personal data is involved, so it's worth understanding
properly. Four ideas make up the whole system:

```
 accounts table       mfa_pending table        patients table         sessions table
 ─────────────        ───────────────          ──────────────          ──────────────
 email + password  ◄─ "prove you own      ◄─   demographic + health    "you are logged
 (who can log in)     this email" —              info (PHI,             in" proof
                       6-digit emailed code       encrypted)             (a cookie)
                       (hashed, expires)
```

They are **separate tables on purpose** (see `src/lib/db.ts`): credentials,
one-time codes, health data, and login sessions are all kept apart, so a
leak of one doesn't automatically expose the others.

**The account can't be used until its email is proven.** Every new account
starts with `email_verified = 0`. Passwords alone never grant access to the
portal — every sign-in (first-time activation *or* a later login) ends with
a 6-digit code emailed to the patient, which they must enter before a real
session is created. That's the `mfa_pending` table's job: it tracks "a code
was issued, here's its hash, here's when it expires."

### 6.1 Registering a new patient

File: `src/app/portal/register/page.tsx` (the form) →
`src/app/api/auth/register/route.ts` (the backend) →
`src/lib/auth.ts` → `registerPatient()`.

Step by step:

1. The patient fills out the form (identity, address, insurance, health
   info) and clicks **Create account**.
2. The browser sends the data as JSON to `POST /api/auth/register`.
3. The API route checks a simple rate limit (max 5 attempts per 10 minutes
   per IP address) to slow down abuse.
4. `zod` validates every field — is the email really an email, is the
   password at least 12 characters with upper/lower/number, is the ZIP code
   real-looking, etc. If anything fails, a friendly error comes back and
   **nothing is saved**.
5. `registerPatient()` in `src/lib/auth.ts` runs:
   - Checks the email isn't already registered (returns a generic error
     either way, so nobody can use this to discover which emails already
     have accounts).
   - Hashes the password (see §6.5 — the real password is never stored).
   - **Encrypts** every sensitive field (name, DOB, address, allergies,
     insurance...) before writing it to the database (see §6.6).
   - Writes one row to `accounts` (starting **unverified**) and one row to
     `patients`, linked by an ID.
   - Writes an entry to `audit_log` recording *that* a registration happened
     — never the actual data.
6. Instead of signing the patient in immediately, the server starts an
   **email-verification challenge** (see §6.3) and the browser is sent to
   `/portal/verify?new=1` to enter the code that was just emailed.

### 6.2 Signing in

File: `src/app/portal/login/page.tsx` →
`src/app/api/auth/login/route.ts` → `loginPatient()` in `src/lib/auth.ts`.

1. Patient enters email + password.
2. The server looks up the account by email.
3. If the account is currently **locked** (see below), it returns "too many
   attempts, try again later" — without even checking the password.
4. It verifies the password against the stored hash.
5. **Wrong password:** the failed-attempt counter goes up. On the 5th
   failure in a row, the account locks for 15 minutes. Either way, the
   response is the same generic message — "Invalid email or password" — so
   an attacker can't tell whether the email exists or the password was
   close.
6. **Correct password:** the failure counter resets to zero, but the
   patient is **not signed in yet**. The server starts a code challenge —
   `email_verify` if this account never finished activating, otherwise
   `login_mfa` — and the browser goes to `/portal/verify` to enter it. This
   makes the login a true two-factor check: password (something you know)
   *and* a code sent to an email you control (something you have).

### 6.3 Email verification & login codes (MFA)

Files: `src/app/portal/verify/page.tsx` (the form) →
`src/app/api/auth/verify/route.ts` + `src/app/api/auth/resend/route.ts` →
`src/lib/auth.ts` (`startMfaChallenge` / `completeMfaChallenge` /
`resendMfaCode`) → `src/lib/mail.ts` (actually sends the email).

How a challenge works:

1. `startMfaChallenge()` generates a random 6-digit code
   (`generateOtpCode()` in `crypto.ts`) and a separate random token (like a
   mini session token, but just for "there is a pending code check").
2. Only the **hash** of the code is stored in `mfa_pending`, alongside which
   account it's for and *why* (`email_verify` vs `login_mfa`).
3. The token goes into its own short-lived cookie, `lp_mfa` — deliberately
   separate from the real `lp_session` cookie, so a half-finished login
   never counts as "signed in."
4. `sendOtpEmail()` in `src/lib/mail.ts` emails the plain 6-digit code to
   the patient (never anything else — no health info goes in this email).
5. The patient enters the code on `/portal/verify`. `completeMfaChallenge()`
   hashes what they typed and compares it to the stored hash.
   - **Wrong code:** an attempt counter goes up; after 5 wrong tries the
     whole challenge is destroyed and they must sign in again to get a new
     code.
   - **Right code:** the pending row is deleted, the `lp_mfa` cookie is
     cleared, and — only now — `createSession()` runs and the patient is
     actually signed in. If the purpose was `email_verify`, the account is
     also flipped to `email_verified = 1` so future logins skip straight to
     `login_mfa`.
6. **Resend code:** the "Resend code" button hits `/api/auth/resend`, which
   is itself rate-limited (one resend per IP per 30 seconds) and simply
   restarts the same challenge with a fresh code — the old code stops
   working the moment a new one is issued.

Every step of this (code sent, code verified, code rejected, too many
attempts) is written to `audit_log`, same as regular logins.

### 6.4 Staying signed in (sessions & cookies)

A "session" is just: *a random secret is created, the browser stores it in a
cookie, and the server remembers that this specific secret belongs to this
account.*

- `generateSessionToken()` makes a long random string.
- Only the **hash** of that string is stored in the `sessions` table — if
  someone ever stole the database, they still couldn't reuse it as a valid
  login token (same idea as password hashing, applied to session tokens).
- The real token goes into a cookie named `lp_session`, marked:
  - `httpOnly` — JavaScript on the page can never read it (blocks a whole
    class of attacks where malicious script tries to steal your login).
  - `secure` (in production) — only ever sent over HTTPS.
  - `sameSite: lax` — not sent on cross-site requests, which blocks most
    cross-site forgery attempts.
- The cookie **expires after 30 minutes**. After that, `getSessionAccountId()`
  sees the session is expired, deletes it, and treats the visitor as signed
  out — they have to log in again.

Every page/API route that needs to know "who is this?" calls
`getSessionAccountId()`, which reads the cookie, hashes it, and looks it up.
No password is ever re-sent after the initial login.

### 6.5 Passwords — hashing, not encryption

Passwords are **never stored**, encrypted or otherwise. Instead
`hashPassword()` in `src/lib/crypto.ts`:

1. Generates a random "salt" (so two people with the same password get
   completely different stored values).
2. Runs the password through `scrypt`, a deliberately slow, memory-hard
   function — designed so that even if someone steals the database, guessing
   passwords against the hashes is extremely expensive.
3. Stores `scrypt:<salt>:<hash>`.

Logging in re-runs the same slow function on the entered password and
compares the result using a **timing-safe** comparison
(`timingSafeEqual`) — a normal `===` comparison can leak information about
*how much* of the guess was correct via how long the comparison takes;
timing-safe comparison always takes the same time regardless.

### 6.6 Health data — encryption, not hashing

Hashing is one-way (you can never get the password back — you only compare
new hashes to it). Health data is different: the pharmacy legitimately needs
to *read it back* to show it to the patient. So it uses **encryption**
instead, via `encryptPHI()` / `decryptPHI()` in `src/lib/crypto.ts`:

- Algorithm: **AES-256-GCM** — a standard, authenticated encryption cipher.
  "Authenticated" means it also detects if the ciphertext was tampered with,
  not just hides it.
- Every value gets its own random IV (a kind of nonce) so encrypting the
  same value twice never produces the same ciphertext.
- The encryption key comes from the `PHI_ENCRYPTION_KEY` environment
  variable — it is never hard-coded, and it isn't part of the database file
  itself, so stealing the `.db` file alone isn't enough to read anything.
- The stored format is `v1:<iv>:<authTag>:<ciphertext>` — the `v1:` prefix
  exists so a future key-rotation scheme (`v2:`) could exist side-by-side
  during a migration.

In `src/lib/db.ts`, every column that holds personal/health data is
commented `[enc]` so it's obvious at a glance which columns are ciphertext
and which are plain operational data (IDs, timestamps, status flags).

### 6.6 Audit log

Every time a patient record is created, read, or a login is
attempted, `audit()` in `src/lib/db.ts` writes a row to `audit_log`:
*who* (`account:123` or `anonymous`), *what* (`auth.login`, `patient.read`,
...), *the outcome* (success/failure), *when*, and the caller's IP. It
**never** stores the actual data involved — just the fact that an action
happened. This is what HIPAA calls "audit controls," and it's what lets the
pharmacy answer "who looked at this patient's record, and when?" after the
fact.

### 6.7 Logging out

`LogoutButton.tsx` calls `POST /api/auth/logout`, which deletes the session
row from the database (so the token can never be reused, even if someone
kept a copy of the cookie) and clears the cookie in the browser.

---

## 7. API routes — quick reference

| Route | Method | Purpose | Auth required? |
|---|---|---|---|
| `/api/auth/register` | POST | Create account + patient record, start email verification | No |
| `/api/auth/login` | POST | Verify credentials, start a login-code (MFA) challenge | No |
| `/api/auth/verify` | POST | Confirm the emailed 6-digit code; grants the real session | No (needs the `lp_mfa` pending cookie) |
| `/api/auth/resend` | POST | Re-send the pending challenge's code | No (needs the `lp_mfa` pending cookie) |
| `/api/auth/logout` | POST | End the session | No (no-op if already signed out) |
| `/api/auth/me` | GET | Return the signed-in patient's basic profile | Yes (401 if not signed in) |
| `/api/contact` | POST | Validate + PHI-screen a general inquiry (stores nothing) | No |

All routes validate their input with `zod` and return
`{ error: "..." }` with a non-200 status on failure, or `{ ok: true, ... }`
on success — the frontend forms all follow the same pattern: `fetch()`,
check `res.ok`, show `data.error` if not.

---

## 8. Security headers & CSP (`next.config.mjs`)

Every response from the site includes a set of HTTP headers that tell the
browser to lock things down. In plain terms:

| Header | What it stops |
|---|---|
| `Content-Security-Policy` | Only allows scripts/styles/images/fetches from our own site — blocks injected third-party scripts even if one somehow got into the page |
| `Strict-Transport-Security` | Forces the browser to always use HTTPS for this site, even if a link says `http://` |
| `X-Frame-Options` / `frame-ancestors` | Stops the site from being embedded in an `<iframe>` on another site (clickjacking) |
| `X-Content-Type-Options: nosniff` | Stops the browser from guessing a file's type in a way that could enable an attack |
| `Referrer-Policy` | Limits what URL info leaks to other sites when a user clicks an outbound link |
| `Permissions-Policy` | Explicitly turns off camera/mic/geolocation/payment APIs — the site never needs them |

These are applied to **every route** via the `headers()` function, so no
individual page has to remember to set them.

---

## 9. Environment variables (`.env.local`)

Normally `.env.local` should never be committed to git — that's the whole
point of the `.env.example` template pattern. **Right now this repo is an
exception**: see §15 below before assuming that rule holds.

| Variable | Required for | What it does |
|---|---|---|
| `PHI_ENCRYPTION_KEY` | Portal register/login | 32-byte hex key used to encrypt/decrypt PHI. Generate with `openssl rand -hex 32`. Without it, `crypto.ts` throws immediately rather than silently storing plaintext. |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Sending verification/login-code emails | Gmail SMTP credentials used by `src/lib/mail.ts` to send the 6-digit codes. Demo-phase only — see §15. Without these, dev mode just prints the code to the terminal instead of emailing it; production refuses to send. |
| `NEXT_PUBLIC_DRX_STORE_URL` | Future DRX integration | Public link to the pharmacy platform storefront |
| `DRX_API_BASE_URL` / `DRX_API_KEY` | Future DRX integration | Server-only credentials — never exposed to the browser |

---

## 10. Styling system

- `tailwind.config.ts` defines the brand palette: a `navy` scale (primary)
  and `liberty.red` / `liberty.gold` (accents). Use these class names
  (`bg-navy-700`, `text-liberty-red`) instead of raw hex codes anywhere in
  the app, so a rebrand only means editing this one file.
- `globals.css` defines a handful of reusable component classes so common
  patterns aren't retyped everywhere: `.btn-primary`, `.btn-accent`,
  `.btn-outline`, `.card`, `.container-site`, `.section-title`,
  `.input-field`. Every form and card in the app uses these.

---

## 11. Common tasks — where to make changes

| I want to... | Edit this |
|---|---|
| Change the phone number, address, or hours | `src/lib/site.ts` |
| Add a nav menu item | `src/lib/site.ts` (`nav` array) |
| Add or edit a blog post | `src/lib/posts.ts` |
| Add a brand-new marketing page | New folder under `src/app/`, e.g. `src/app/careers/page.tsx` |
| Change brand colors | `tailwind.config.ts` |
| Add a field to patient registration | `registrationSchema` in `src/app/api/auth/register/route.ts`, the `RegistrationInput` type + SQL in `src/lib/auth.ts`/`src/lib/db.ts`, and the form in `src/app/portal/register/page.tsx` — **encrypt it if it's PHI** |
| Change session length / lockout rules | Constants at the top of `src/lib/auth.ts` (`SESSION_TTL_MS`, `MAX_FAILED_LOGINS`, `LOCKOUT_MS`) |
| Wire up the contact form to actually send email | `src/app/api/contact/route.ts` — see the `TODO(delivery)` comment; requires a HIPAA-eligible provider under BAA first |

---

## 12. Running the project

```bash
npm install        # install dependencies
npm run dev         # start locally at http://localhost:3000
npm run build        # production build (also type-checks and lints)
npm run start        # run the production build
npm run lint          # ESLint only
```

The SQLite database file is created automatically on first run at
`data/liberty.db` (the folder is gitignored — it will contain encrypted PHI
once anyone registers, so it must never be committed).

---

## 13. Glossary

- **PHI** — Protected Health Information. Anything that identifies a person
  *and* relates to their health (name + allergy list, DOB + medical
  condition, etc.).
- **HIPAA** — the US law governing how PHI must be protected.
- **BAA** — Business Associate Agreement. A contract required before any
  third-party service (hosting, email, an integration partner) is allowed to
  touch PHI on the pharmacy's behalf.
- **Hashing** — a one-way transformation (used for passwords). You can check
  a guess against a hash, but you can never reverse a hash back into the
  original value.
- **Encryption** — a two-way transformation (used for PHI). Anyone holding
  the correct key can decrypt it back to the original value; without the
  key, it's unreadable.
- **Session / cookie** — a small piece of data the browser stores and sends
  back on every request, used to prove "this is the same visitor who logged
  in a moment ago" without re-sending a password each time.
- **CSP (Content-Security-Policy)** — a browser-enforced allow-list of where
  a page's scripts, styles, and network requests are allowed to come from.
- **Rate limiting** — capping how many times an action (e.g. registration
  attempts) can happen in a time window, to slow down automated abuse.
- **MFA (Multi-Factor Authentication)** — requiring two different kinds of
  proof to log in (here: a password *and* a one-time code emailed to you),
  so a stolen password alone isn't enough to get in.
- **OTP (One-Time Password/code)** — a short code, valid once and only for a
  few minutes, used to prove someone can access an email inbox or phone.

---

## 14. What's next (roadmap)

Email verification and login MFA (§6.3) — previously listed here as
upcoming — are now built. What's still ahead per `HIPAA-COMPLIANCE.md` and
§15 below: moving OTP email delivery off consumer Gmail onto a BAA-covered
provider (AWS SES), moving `PHI_ENCRYPTION_KEY` into a managed secret store,
optional additional MFA methods (e.g. SMS/authenticator app) if DRX
supports them, and the real DRX platform integration (refills, transfers,
medication history) once a signed BAA is in place with DRX. `src/lib/drx.ts`
is the seam where that integration will plug in — the portal already stores
patient data in the exact shape DRX expects (see the field-mapping table in
`HIPAA-COMPLIANCE.md`), so that migration should be a straightforward 1:1
copy rather than a redesign.

---

## 15. Known issue right now: demo credentials committed to git

While documenting this project, one thing turned up that's worth being
explicit about rather than glossing over: **`.env.local` — containing a
real `PHI_ENCRYPTION_KEY` and a real Gmail app password — is currently
committed to this repository's git history**, on purpose, as a demo-phase
convenience (see the commit that added `src/lib/mail.ts` and the big
warning comment inside `.env.local` itself).

In plain terms, right now:

- Anyone with read access to this git repository (not just the running app)
  can decrypt every patient record ever created with the committed key.
- Anyone with read access can send email as the configured Gmail account.
- Deleting the file today does **not** remove it from git history — old
  commits still contain it until the history itself is rewritten.

This is a reasonable shortcut for a fake-data demo in a private repo, but
it directly contradicts the "PHI is protected by a secret store, not a
file" posture the rest of this document describes, and `HIPAA-COMPLIANCE.md`
is explicit that it **must** be resolved before any real patient enrolls.
Before that point, at minimum:

1. Rotate both credentials (new Gmail app password; new
   `PHI_ENCRYPTION_KEY`, which also means re-encrypting any existing
   patient rows with the new key).
2. Remove `.env.local` from git tracking going forward (`.gitignore` needs
   to cover it again) and scrub it from git history.
3. Move both secrets to a managed secret store rather than a file at all.

This documentation update did not perform any of the above — rotating
credentials and rewriting git history are decisions for whoever owns this
repository to make deliberately, not something to do silently as a side
effect of a documentation pass.
