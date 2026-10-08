# AWS production deployment — how it actually runs

Recorded 2026-10-05 from the live account (AWS account `429186228745`,
region `us-east-1`). Some older documents describe an ECS/Fargate
deployment; that is **not** what is running. This file is the source of truth
for the live setup, what was fixed on 2026-10-05, and what is still pending.

---

## 1. What is running

| Piece | Live value |
|---|---|
| Domain | `rxlibertypharmacy.com` (registered at Namecheap; DNS hosted in **Route 53**) |
| Server | EC2 instance `liberty-pharmacy-web` (`i-04fe7a19b7d9e6dd8`), t4g.micro, `us-east-1a` |
| Public IP | Elastic IP **34.204.134.17** (fixed; use it for any IP allow-list, e.g. the DRX key) |
| App | Docker container `liberty-app` (image `liberty-app:latest`), Next.js on port 3000 |
| TLS / reverse proxy | Docker container `caddy` (`caddy:2-alpine`) on ports 80/443 |
| Database | RDS PostgreSQL `liberty-pharmacy-db` (db.t4g.micro), TLS verified with the RDS CA bundle |
| Instance IAM role | `liberty-pharmacy-ec2-role` (ECR read-only, SSM core, `liberty-pharmacy-secrets-read`, `liberty-pharmacy-ses-send`) |
| Secrets Manager | `liberty-pharmacy/database-url` |
| Email | Amazon SES, `us-east-1` (see §3) |
| BAA | AWS Business Associate Addendum **Active**, accepted 2026-08-27 |
| Shell access | AWS Systems Manager → **Session Manager** → `liberty-pharmacy-web` (no SSH key needed) |

There are no ECS clusters in the account. The rate limiters and the DRX To-Do
sync assume **one** app instance (SECURITY-RISK-ANALYSIS.md T-03), which holds
on this setup.

### Environment variables in the container (names only)

```
ADMIN_PASSWORD  ADMIN_SESSION_SECRET  ADMIN_TOTP_SECRET  ADMIN_USERNAME
APP_BASE_URL    AWS_REGION            CONTACT_FORWARD_EMAIL
DATABASE_URL    MAIL_REPLY_TO         NODE_ENV           PHI_ENCRYPTION_KEY
PORT            RDS_CA_BUNDLE_PATH    SES_FROM_EMAIL
```

Non-secret values as of 2026-10-05: `SES_FROM_EMAIL=noreply@rxlibertypharmacy.com`,
`AWS_REGION=us-east-1`, `APP_BASE_URL=https://rxlibertypharmacy.com`,
`NODE_ENV=production`. No `DEMO_*` or `GMAIL_*` variables are set (correct
for production). `MAIL_REPLY_TO` is left over from an older build; current
code does not read it.

To list them again (prints names only, never values):

```bash
sudo docker exec liberty-app env | cut -d= -f1 | sort
```

Where the values come from: `/usr/local/bin/liberty-deploy.sh` reads two
Secrets Manager entries, **`liberty-pharmacy/app-secrets`** (JSON: admin,
PHI key, SES and mail settings, `APP_BASE_URL`, …) and
**`liberty-pharmacy/database-url`**, adds `AWS_REGION` and
`RDS_CA_BUNDLE_PATH`, writes them to a root-only temp file that is deleted on
exit, and starts the container with `--env-file`. New settings (e.g.
`DRX_API_BASE_URL`, `DRX_API_KEY`, `DRX_ENABLED`) go into **app-secrets**,
then re-run the script.

### How to deploy (as done 2026-10-08)

The image is built **on the server** from the GitHub source of the commit
(910 MB RAM + 2 GB swap is enough; the build takes ~3 minutes). Everything
below runs in Session Manager. Replace `<SHA>` with the full commit hash of
`aws-production` and `<short>` with its first 7 characters.

```bash
cd /opt/liberty
sudo curl -fsSL -o src-<short>.tar.gz https://github.com/NilayParikh33/LibertyPharmacy/archive/<SHA>.tar.gz
sudo mkdir app.<short> && sudo tar -xzf src-<short>.tar.gz -C app.<short> --strip-components=1

# Build first; the running site is untouched if this fails.
sudo docker build -t liberty-app:<short> /opt/liberty/app.<short>

# Switch: keep the current image as :prev, point :latest at the new one.
sudo docker tag liberty-app:latest liberty-app:prev
sudo docker tag liberty-app:<short> liberty-app:latest
sudo /usr/local/bin/liberty-deploy.sh
sudo docker ps    # liberty-app and caddy both "Up"
```

Before a deploy whose code changes the database on startup, check that the
app role (`liberty_app`) can create tables and owns the tables being altered
(`audit_log` is deliberately owned by `lp_admin`).

**Rollback** (one command set, seconds of downtime):

```bash
sudo docker tag liberty-app:prev liberty-app:latest && sudo /usr/local/bin/liberty-deploy.sh
```

Every deployed image is also kept under its commit tag (e.g.
`liberty-app:25cb2fd`, `liberty-app:6427209`).

### Deploy history
| Date | Commit | Notes |
|---|---|---|
| 2026-09-26 | `25cb2fd` | Production HIPAA guard |
| 2026-10-08 | `6427209` | DRX integration (off), IAM-era email fixes, verify-screen wording, real domain; startup added `rx_requests` and DRX columns. Previous image kept as `:prev` / `:25cb2fd` |

---

## 2. IAM policy the app needs to send email

The app sends mail through nodemailer, which hands SES a raw MIME message, and
it sends through the SES configuration set `liberty-transactional`. SES
therefore checks **`ses:SendRawEmail`**, against the sending identity, the
**configuration set**, and (while in the sandbox) the **recipient** identity.

Inline policy `liberty-pharmacy-ses-send` on `liberty-pharmacy-ec2-role`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SendPharmacyMail",
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": [
        "arn:aws:ses:us-east-1:429186228745:identity/*",
        "arn:aws:ses:us-east-1:429186228745:configuration-set/*"
      ]
    }
  ]
}
```

Missing any of these makes every email fail. Before 2026-10-05 the policy
lacked `ses:SendRawEmail` and the configuration-set resource, so **no portal
email had ever been sent** (registration codes, sign-in codes, resets).

---

## 3. Amazon SES status

| Item | Status |
|---|---|
| Domain identity `rxlibertypharmacy.com` | Verified |
| DKIM | Easy DKIM, 2048-bit, successful |
| SPF | Custom MAIL FROM `mail.rxlibertypharmacy.com` (MX + `v=spf1 include:amazonses.com ~all`), successful (2026-10-05) |
| DMARC | `_dmarc.rxlibertypharmacy.com` → `v=DMARC1; p=none; rua=mailto:libertypharmacy@gmail.com` (2026-10-05) |
| Configuration set | `liberty-transactional`, sending enabled |
| Suppression list | Account level, bounces + complaints |
| Feedback notifications | Bounce + Complaint → SNS `liberty-ses-notifications` → `libertypharmacy@gmail.com` (confirmed) |
| Verified recipient addresses | `libertypharmacy@gmail.com`, `kushuvc38@gmail.com` |
| **Account status** | **Sandbox**: 200 emails/day, and only to verified addresses |

**Sandbox means real patients cannot receive any email**, so they cannot
finish registering. Production access was requested on 2026-08-27 (support
case 178784687300903) and refused on 2026-09-01 with a generic reply; see §5.

The domain has no MX record of its own, so mail to `@rxlibertypharmacy.com`
(e.g. replies to `noreply@`) is undeliverable. That is why patient emails say
"do not reply"; see `src/lib/mail.ts`.

---

## 4. Troubleshooting email

Email is sent after the HTTP response, and a failed send is **not shown to the
user** (the page still says "check your email"). The reason is recorded in
`audit_log`. To read the latest entries on the server (Session Manager):

```bash
sudo docker exec liberty-app sh -c 'cat > /tmp/q.js << "EOF"
const fs = require("fs");
const {Pool} = require("pg");
const ca = fs.readFileSync(process.env.RDS_CA_BUNDLE_PATH, "utf8");
const p = new Pool({connectionString: process.env.DATABASE_URL, ssl:{ca, rejectUnauthorized:true}});
p.query("select at, action, outcome, detail from audit_log order by at desc limit 12")
 .then(r => { console.log(JSON.stringify(r.rows, null, 1)); return p.end(); })
 .catch(e => console.log("DB FAIL:", e.message));
EOF
NODE_PATH=/app/node_modules node /tmp/q.js; rm -f /tmp/q.js'
```

What to look for:

| Audit row | Meaning |
|---|---|
| `auth.mfa.email_verify.sent` / `auth.mfa.login_mfa.sent`, `failure`, `mail_send_failed: ...` | Code email failed; `detail` gives SES's reason (e.g. a missing IAM permission) |
| same, `success` | SES accepted it. If it doesn't arrive, check the right inbox and Gmail **spam** (`in:anywhere from:rxlibertypharmacy.com`) |
| `auth.register`, `failure`, `duplicate_email` | Email already had an account; the owner was sent the "account exists" notice instead of a code |
| `auth.register.account_exists_notice` | Whether that notice was sent (added 2026-10-05; before that it was not logged) |

Common causes, in the order we hit them on 2026-10-05:
1. IAM policy missing `ses:SendRawEmail` or the configuration-set resource (§2).
2. Sandbox: recipient address not verified in SES.
3. Wrong inbox: the code goes to the email on the account you signed into.
4. Gmail spam: the domain is new and has no sending reputation yet.

`/tmp` is writable inside the container but `/app` is not, and the AWS SDK is
bundled into the Next.js build (it can't be `require`d from a script); `pg` can.

---

## 5. Status and pending work (as of 2026-10-05)

### Done
- SES domain authentication complete (DKIM, SPF via custom MAIL FROM, DMARC).
- SES bounce/complaint notifications wired to SNS; suppression list on.
- IAM policy fixed (§2); portal email confirmed sending
  (`auth.mfa.email_verify.sent` → `success`, 2026-10-05 17:47 UTC).
- AWS BAA confirmed Active (2026-08-27) and recorded in SECURITY-RISK-ANALYSIS.md.
- Code on `aws-production` (not yet deployed, see below): DRX integration
  (off until `DRX_ENABLED=true`), production HIPAA guard restored, real
  domain in `metadataBase`, clearer verify screen for already-registered
  emails, audit of the "account exists" notice.

### Pending — email
- [ ] **SES production access.** Warm up for a few days (send to verified
      addresses, mark "Not spam"), then reopen case 178784687300903 citing the
      new SPF/DMARC and the real sending history.
- [ ] **Gmail reputation.** Add the domain to Google Postmaster Tools
      (postmaster.google.com) to see how Gmail rates it. After a couple of
      clean weeks, consider tightening DMARC to `p=quarantine`.
- [ ] **Sender name.** AWS advises against `noreply@`. Changing to
      `portal@rxlibertypharmacy.com` only makes sense once replies can reach
      someone (an MX record / forwarding to the pharmacy's inbox); then also
      update the "do not reply" note in `src/lib/mail.ts`.

### Pending — deployment
- [x] Redeployed `6427209` on 2026-10-08 (DRX off; table ownership checked
      first; database changes applied; site and headers verified). Build and
      rollback steps are in §1.
- [ ] **Node 20 → 22.** The AWS SDK warns that releases after January 2027
      require Node ≥ 22. Update the `Dockerfile` base image (`node:20-alpine`).
- [ ] **npm audit** (security suite SEC-012): `nodemailer` needs a major
      upgrade; the other findings are dev-only.
- [ ] **Test accounts in production.** Accounts created while debugging on
      2026-10-05 (`kushuvc38@gmail.com`, `kushuvc@gmail.com`) should be
      removed once testing is done.
- [ ] **Seed data.** `src/lib/db.ts` seeds the contact email as
      `info@libertypharmacyatx.com` (wrong domain). It only affects a brand-new
      database; the live value is set in Admin → Site Settings.

### DRX support answers (2026-10-06/07, Phil Krupenya, support@drxpharmacytech.com)
- **BAA:** "We don't have a BAA" for API access; the pharmacy grants access by
  creating the key and can revoke or IP-restrict it. This does not settle
  HIPAA: DRX already holds all of Liberty's patient data as its pharmacy
  software vendor, so a BAA should exist in **Liberty's DRX subscription
  contract**. The pharmacy owner must confirm that with their DRX account
  manager (not tech support), and the pharmacy's compliance person signs off.
- **Staging:** the key embedded in the DRX API docs works against
  `https://staging.drxapp.com/external_api/v1` and never expires (shared demo
  data, may be wiped). Find test patients with `GET /prescriptions`.
- **To-Dos:** one queue for all staff; linked patient shown; no note length
  limit; a `patient_id` DRX can't find is rejected (handled, see below).
- **Rx numbers:** the label shows the same Rx# as the DRX prescription id;
  `rx_number` only matters for central-site conversions.
- **Key expiry:** the pharmacy may set a 1-year expiry with **no warning**.
  Create the production key without expiry if possible; otherwise record the
  date here and rotate (`POST /rotate-key`) before it.
- **Patient notifications** on refills are a pharmacy setting in DRX. The
  website never emails patients about refills, so there is no duplication.
- **Transfers in:** no API. Handled as DRX To-Dos.
- **`/prescription/0`, `/todo/0` return lists:** "fine"; guarded in `src/lib/drx.ts`.

### DRX staging test (2026-10-07, all passed)
Full flow run locally against DRX staging (fake data, patient "Linda Bravo"):
register → refused link with another patient's Rx → link with own Rx (name
typed in odd capitals) → medication list → refill forwarded (DRX rejected it:
"Most recent fill still in progress") → To-Do created with that reason →
transfer To-Do linked to the patient → contact-message To-Do → admin banner
"DRX: connected". Found and fixed during the test:
- a refill whose outcome arrived mid-sync waited for the next unrelated
  trigger before getting its To-Do (now: one more pass runs straight after);
- a To-Do whose `patient_id` DRX rejects is now resent unlinked, with a note
  saying so, instead of retrying until it gives up;
- contact To-Dos show the topic as the visitor saw it, not the form's value.
The test left To-Dos #94–#101 (marked as staging tests) in DRX's shared
staging queue.

### Pending — DRX
- [x] Pharmacy owner decided to proceed without a DRX BAA (none found; DRX
      does not sign one for API access), 2026-10-08. Recorded in
      SECURITY-RISK-ANALYSIS.md (A-03).
- [ ] Developer ↔ pharmacy BAA, if the developer can see patient data.
- [x] Connection proven on the live server with a test key (2026-10-08):
      `DRX_API_BASE_URL` / `DRX_API_KEY` in `app-secrets`, heartbeat HTTP 200
      from the container, `DRX_ENABLED` unset.
- [ ] Final production key with exactly `heartbeat`, `prescription`,
      `patientprofile`, `refillrequest`, `todo`, **no expiry**. Not
      IP-restricted (decision 2026-10-08; restricting to 34.204.134.17 is
      still recommended). Replace `DRX_API_KEY` in `app-secrets` and re-run
      the deploy script.
- [ ] Delete the test DRX keys that were shared in chat.
- [ ] Only then `DRX_ENABLED=true`, and a smoke test with one consenting patient.
