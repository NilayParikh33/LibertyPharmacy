# Deploying Liberty Pharmacy to Render

A step-by-step walkthrough for standing the site up on [Render](https://render.com)
from this repository. Everything Render needs is declared in
[`render.yaml`](render.yaml) — this document explains how to apply it and where
each value comes from.

> **Read this first.** Render signs a Business Associate Agreement (BAA) only on
> their **Enterprise** plan. The configuration here is appropriate for a demo,
> staging, or the current public site, which collects no PHI by design. Before
> any real patient record is stored or transmitted, either move to an Enterprise
> plan with a signed BAA or use the AWS deployment path in
> [HIPAA-COMPLIANCE.md](HIPAA-COMPLIANCE.md). See [HIPAA posture](#hipaa-posture)
> at the end.

---

## 1. Prerequisites

| Item | Why it's needed |
|---|---|
| A Render account | Hosts the service |
| Access to the GitHub repository | Render pulls the code from it |
| An Amazon RDS PostgreSQL instance | The app's database (or use Render Postgres — see [step 6](#6-optional-use-render-postgres-instead-of-rds)) |
| Amazon SES in production mode | Sends OTP codes and password-reset mail |
| A terminal with Node 20+ and `openssl` | Generates the two secrets in [step 4](#4-fill-in-the-environment-variables) |

## 2. Give Render access to the private repository

Because this repository is private, Render cannot see it until the **Render
GitHub App** is explicitly granted access to it. Connecting the GitHub account
alone is not enough.

1. In the [Render dashboard](https://dashboard.render.com), click
   **New +** → **Blueprint**.
2. Click **Connect GitHub** (or **Configure account** if GitHub is already
   linked).
3. On GitHub's consent screen, choose **Only select repositories** and select
   this repository. Grant access.
4. Back in Render, the repository now appears in the list. Select it.

**If the repository still doesn't appear:** the App was installed without it.
Go to GitHub → **Settings** → **Applications** → **Render** → **Configure**, add
the repository, save, then click **Reconfigure existing repositories** in Render.

## 3. Apply the Blueprint

Render reads [`render.yaml`](render.yaml) from the repository root and shows you
the service it is about to create: a Docker web service named
`liberty-pharmacy`, built from the repo's `Dockerfile`, deploying from the
**`dev`** branch.

> **Branch:** `render.yaml` points at `dev`, which is the active development
> branch. For a client-facing production deploy, change `branch: dev` to
> `branch: main` and promote the release to `main` first.

Render then presents a form listing every variable marked `sync: false`. These
are the secrets — they are deliberately not stored in the repository. Fill them
in as described next, then click **Apply**.

## 4. Fill in the environment variables

| Variable | Where the value comes from |
|---|---|
| `APP_BASE_URL` | The site's public URL. Use the `onrender.com` URL at first, then update to the custom domain after [step 7](#7-add-the-custom-domain). Required — behind Render's proxy the app cannot infer its own origin, and password-reset emails would carry unreachable links. |
| `DATABASE_URL` | The RDS connection string, e.g. `postgres://appuser:PASSWORD@<db-id>.<region>.rds.amazonaws.com:5432/liberty` |
| `PHI_ENCRYPTION_KEY` | Generate with `openssl rand -hex 32`. **Store it in a password manager.** Rotating it later requires re-encrypting every existing patient row. |
| `SES_FROM_EMAIL` | The SES-verified sending address, e.g. `noreply@libertypharmacyatx.com` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | An IAM user scoped to **`ses:SendEmail` only** — see the note below. |
| `CONTACT_FORWARD_EMAIL` | The monitored inbox that receives general contact-form enquiries. |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `ADMIN_TOTP_SECRET` | Bootstraps the first admin — see [step 5](#5-bootstrap-the-admin-account). |

Two variables are already set to literal values in `render.yaml` and need no
input: `AWS_REGION` (`us-east-1`) and `RDS_CA_BUNDLE_PATH`, which points at the
public Amazon RDS certificate bundle committed under `certs/`.

### Why static AWS keys here

On AWS compute the app inherits an IAM role and needs no keys. Render is not AWS
compute, so SES requires a dedicated IAM user's access key. Scope that user to
`ses:SendEmail` and nothing else — it is a long-lived credential sitting in a
third-party platform, so it should be able to do exactly one thing. Rotate it on
the same schedule as the rest of the project's credentials.

This is also why `DB_AUTH_MODE=iam` is **not** enabled in `render.yaml`: RDS IAM
authentication from outside AWS would mean granting that same static key
`rds-db:connect`, which trades the database password for an equally long-lived
AWS key. Password auth over a verified TLS connection is the simpler honest
choice for this deployment target.

### The Gmail fallback is not available

`.env.example` documents `GMAIL_USER` / `GMAIL_APP_PASSWORD` as a pre-production
mail fallback. The `Dockerfile` sets `NODE_ENV=production`, and the app refuses
Gmail transport in production because consumer Gmail carries no BAA. SES is
therefore required for any deployment made from this blueprint — the Gmail
variables are intentionally absent from `render.yaml`.

## 5. Bootstrap the admin account

Generate the TOTP seed and its enrolment QR code:

```bash
npm run admin:mfa
```

Scan the QR code with an authenticator app (Google Authenticator, 1Password,
Authy), and paste the printed base32 seed into `ADMIN_TOTP_SECRET` in Render,
alongside your chosen `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

How the bootstrap behaves, from `seedFirstAdmin` in
[`src/lib/admin-auth.ts`](src/lib/admin-auth.ts):

- The first admin is created from these three variables **only while the
  `admin_users` table is empty**. All three must be set, or no admin is seeded
  and nobody can sign in.
- Once any admin exists, the variables are ignored entirely and accounts are
  managed in the database. The seed cannot resurrect an account that was
  deliberately removed or disabled.
- The TOTP seed is stored encrypted under `PHI_ENCRYPTION_KEY`, so that key must
  be set before the first admin login.

> **Note:** `.env.example` is stale on this point — it documents an
> `ADMIN_SESSION_SECRET` that no code reads, and omits `ADMIN_TOTP_SECRET`,
> which the app does read. The three variables above are the correct set.

## 6. Optional: use Render Postgres instead of RDS

`render.yaml` ends with a commented-out `databases:` block. Uncommenting it, and
following the instructions in that comment, provisions a Render-managed
PostgreSQL instance and wires `DATABASE_URL` to it automatically — noticeably
simpler to stand up.

The trade-off is that it drops the RDS posture documented in
`HIPAA-COMPLIANCE.md`. Reasonable for demo and staging; revisit before real
patient records exist.

**There is no migration step either way.** The schema is created on demand: the
first request that touches the database runs `CREATE TABLE IF NOT EXISTS` for
every table (`init` in [`src/lib/db.ts`](src/lib/db.ts)). An empty database is a
valid starting point.

## 7. Add the custom domain

1. Render dashboard → the service → **Settings** → **Custom Domains** → add the
   domain.
2. Create the CNAME record Render displays at your DNS provider.
3. Wait for the certificate to be issued (Render provisions TLS automatically).
4. **Update `APP_BASE_URL`** to the custom domain and redeploy, so emailed links
   point at the right host.

## 8. Verify the deployment

After the first deploy finishes:

- [ ] The site loads over HTTPS and the health check on `/` is green.
- [ ] Security headers are present — check the response headers for
      `content-security-policy` and `strict-transport-security`.
- [ ] The contact form submits and the message arrives at `CONTACT_FORWARD_EMAIL`.
- [ ] Admin login works, including the TOTP prompt.
- [ ] Patient registration sends an OTP email through SES (SES must be out of
      sandbox mode, or it can only send to pre-verified addresses).

## 9. Ongoing deploys

`autoDeploy: true` means every push to the configured branch triggers a rebuild.
To switch to manual releases, set `autoDeploy: false` in `render.yaml`, or turn
off **Auto-Deploy** in the service's settings.

Changes to `render.yaml` itself are picked up on the next push, but new
`sync: false` variables still have to be filled in from the dashboard.

---

## HIPAA posture

To restate the warning at the top, because it is the one thing in this document
that cannot be fixed later by editing a config file:

- **Render's BAA is Enterprise-only.** The `starter` plan in `render.yaml` is
  not covered. Hosting PHI on an uncovered plan is a compliance failure
  regardless of how the application itself is written.
- The application's own protections — field-level AES-256-GCM encryption, the
  audit log, TLS verification against the RDS CA bundle, strict CSP and security
  headers — are in place and work on Render. They are necessary, not sufficient.
- The current public site collects no PHI by design, which is what makes this
  deployment target acceptable today.

Before this deployment handles patient data, work through the checklist in
[HIPAA-COMPLIANCE.md](HIPAA-COMPLIANCE.md) — in particular the BAA requirements
for every subprocessor in the path, which on Render means Render itself in
addition to AWS.
