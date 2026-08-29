# Security Risk Analysis — Liberty Pharmacy Patient Portal

**Required by:** 45 CFR §164.308(a)(1)(ii)(A) — Risk Analysis (Required implementation specification)
**Methodology:** NIST SP 800-30 Rev. 1, as referenced by the HHS/OCR *Guidance on Risk Analysis Requirements*

| Field | Value |
|---|---|
| Document status | **DRAFT — NOT YET ADOPTED** |
| Draft prepared | 2026-08-26 |
| Last revised | 2026-08-27 — technical remediation, see §10 |
| Prepared by | Development team (technical sections) |
| Security Officer | ☐ *Not yet designated — see Finding A-01* |
| Reviewed / adopted on | ☐ *Pending* |
| Next scheduled review | Annually, and upon any material system change |

> **This draft is not a completed Risk Analysis.** Sections 5 (Administrative)
> and 6 (Physical) describe the pharmacy's people, premises, and procedures —
> facts the development team does not have and must not invent. They are
> presented as structured questionnaires. A risk analysis that asserts
> controls the pharmacy does not actually have is worse than no document at
> all: it becomes evidence of a false attestation. Complete those sections
> with the designated Security Officer before adopting.

---

## 1. Purpose and Scope

This analysis assesses risks to the confidentiality, integrity, and
availability of electronic protected health information (ePHI) created,
received, maintained, or transmitted by the Liberty Pharmacy website and
patient portal.

### 1.1 In scope

- The Next.js web application (public site, patient portal, admin panel)
- The PostgreSQL database storing patient records
- Email transmission of one-time passcodes and password-reset links
- The hosting environment and its administrative access paths
- The source code repository and deployment pipeline

### 1.2 Out of scope (assessed separately)

- The DRx pharmacy management system — **not yet integrated.** A separate
  analysis and a signed BAA with DRx are required before any PHI flows there.
- In-store dispensing systems, physical prescription records, fax workflows
- The pharmacy's general corporate IT (workstations, network) — **must be
  covered by the pharmacy's own risk analysis;** this document covers the web
  system only. If no such analysis exists, that is itself a compliance gap.

### 1.3 Current deployment status

**The portal is not in production and holds no real patient data as of the
draft date.** All records to date are test data. This is the correct time to
remediate — every finding below is cheaper to fix now than after enrollment.

---

## 2. System Characterization

### 2.1 ePHI inventory

The `patients` table constitutes a PHI repository. Fields collected at
registration:

| Category | Fields |
|---|---|
| Identity | First name, middle initial, last name, date of birth, gender |
| Contact | Address, city, state, ZIP, phone, cell phone, email |
| Insurance | BIN, PCN, Group, Cardholder ID, Person Code, Relationship |
| Clinical | Allergies, medical conditions |
| Preferences | Delivery method, preferred language |
| Consent | Notice of Privacy Practices acknowledgment timestamp |

Allergies and medical conditions are clinical data. Combined with name and
date of birth, this is unambiguously ePHI under §160.103.

### 2.2 Supporting data stores

| Store | Contents | PHI? |
|---|---|---|
| `accounts` | Email, scrypt password hash, lockout state, verification flag | Email is an identifier — treat as PHI in this context |
| `sessions` | SHA-256 token hashes, expiry | No |
| `mfa_pending` | Pending OTP challenges | No |
| `password_resets` | SHA-256 reset-token hashes, expiry, single-use flag | No |
| `audit_log` | Actor, action, outcome, IP, timestamp | No PHI values logged (verified) |
| Contact messages | Free-text inquiries from the public contact form | **Possible** — see Finding T-06 |

### 2.3 Data flows

```
Patient browser ──HTTPS──> Next.js app ──TLS (verified CA)──> PostgreSQL (RDS)
                                │
                                ├──> Amazon SES ──> Patient inbox   (OTP codes, reset links)
                                └──> audit_log                       (no PHI values)

Pharmacy staff ──HTTPS──> Admin panel ──> Contact messages, site settings, blog posts
```

### 2.4 Technical controls currently implemented

Verified present in code as of this draft:

- **Encryption at rest (application layer):** every PHI column is AES-256-GCM
  ciphertext (`src/lib/crypto.ts`). Confirmed by inspecting the raw database —
  no plaintext PHI present.
- **Encryption in transit:** HTTPS enforced; HSTS 2 years with preload.
  Database connections verify the RDS server certificate against Amazon's CA
  bundle rather than trusting it blindly (`src/lib/db.ts`).
- **Credential separation:** login credentials (`accounts`) stored apart from
  demographics (`patients`).
- **Password storage:** scrypt (N=16384, r=8, p=1) with per-user salt.
  Passwords are never stored or logged.
- **Multi-factor authentication:** patient login requires the password plus a
  6-digit code emailed to the registered address (10-minute expiry,
  single-use). Registration requires email verification before the account is
  activated.
- **Session management:** httpOnly, SameSite=Lax, Secure cookies; tokens
  stored only as SHA-256 hashes; 30-minute expiry; all sessions revoked on
  password reset.
- **Access safeguards:** account lockout after 5 failed logins (15 min);
  generic authentication errors preventing account enumeration; per-IP rate
  limiting on registration and password reset.
- **Audit controls (§164.312(b)):** every registration, login attempt,
  password reset, and patient-record read is logged with actor, action,
  outcome, IP, and timestamp.
- **Browser hardening:** strict Content-Security-Policy, `frame-ancestors
  'none'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  restrictive `Permissions-Policy`, no `X-Powered-By`.
- **No third-party tracking:** zero external scripts, fonts, analytics, or ad
  pixels. Directly responsive to the December 2022 HHS/OCR bulletin on
  tracking technologies, which remains an active enforcement priority.

This control set is materially stronger than what is typical for an
independent pharmacy's web presence. The findings below should be read
against that baseline — they are specific gaps, not a general indictment.

---

## 3. Risk Rating Method

**Risk = Likelihood × Impact**, per NIST SP 800-30.

| Likelihood | Definition |
|---|---|
| High | Reasonably expected to occur; low attacker skill required |
| Moderate | Plausible; requires some access, skill, or coincidence |
| Low | Requires unlikely conditions or substantial attacker capability |

| Impact | Definition |
|---|---|
| High | Disclosure/loss of ePHI for many individuals; reportable breach |
| Moderate | Limited disclosure, or significant availability loss |
| Low | Minimal ePHI exposure; recoverable |

| | Low Impact | Moderate Impact | High Impact |
|---|---|---|---|
| **High likelihood** | Low | Moderate | **Critical** |
| **Moderate likelihood** | Low | Moderate | **High** |
| **Low likelihood** | Low | Low | Moderate |

---

## 4. Technical Safeguard Findings

### T-01 — Encryption key and database password committed to source control
**Risk: CRITICAL** · Likelihood: High · Impact: High
**Citation:** §164.312(a)(2)(iv) Encryption; §164.308(a)(4) Information Access Management

`.env.local` is tracked in git (`.gitignore` line 23 documents this as an
intentional demo-phase decision). It contains:

- `PHI_ENCRYPTION_KEY` — the single AES-256-GCM key protecting **all** patient
  records
- `DATABASE_URL` — including the database password
- `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET`
- `GMAIL_APP_PASSWORD`

**Why this is critical:** the field-level encryption described in §2.4 is the
primary safeguard for PHI at rest. Storing its key beside the ciphertext, in a
copy of the repository that exists on every developer laptop and on GitHub's
servers, reduces that safeguard to near zero. Anyone who obtains the
repository — a compromised developer account, a contractor with historical
access, an accidental visibility change — obtains the ability to decrypt every
patient record.

**Compounding factor:** git history is permanent. Deleting the file in a new
commit does **not** remove the secrets; they remain retrievable from history
forever. Remediation therefore requires rotating the values, not just removing
the file.

**Remediation (required before any real patient data exists):**
1. Generate **new** values for every secret above. Treat the current values as
   permanently compromised.
2. Remove `.env.local` from tracking (`git rm --cached .env.local`) and remove
   the exemption from `.gitignore`.
3. Store production secrets in **AWS Secrets Manager** (HIPAA-eligible),
   injected at runtime via the task/instance IAM role. Never in a file, never
   in the image, never in the repository.
4. Purge the history (`git filter-repo`) or, if the repository has never left
   a trusted boundary, document a risk acceptance signed by the Security
   Officer explaining why purging was not performed.
5. Establish a documented key-rotation procedure. Note that rotating
   `PHI_ENCRYPTION_KEY` requires re-encrypting existing patient rows — write
   and test that procedure **before** there is data that matters.

> This finding is the single highest-value item in this document. Everything
> else is secondary to it.

---

### T-02 — Administrative access to the system is protected by a single password with no MFA
**Risk: HIGH** · Likelihood: Moderate · Impact: High
**Citation:** §164.312(d) Person or Entity Authentication; §164.308(a)(4)

`src/lib/admin-auth.ts` implements a single shared admin identity
authenticated by a static username/password pair from environment variables.
There is no second factor. By deliberate design it bypasses the account,
session, and MFA infrastructure built for patient accounts.

The patient portal — which holds far less privileged access — requires two
factors. The administrative interface, which reaches patient-submitted contact
messages and site configuration, requires one. **The privilege gradient runs
backwards.**

Additional weaknesses in the same component:

- **Sessions cannot be revoked.** The session cookie is a stateless signed
  token (`${expires}.${HMAC}`) with no server-side record. A stolen cookie
  remains valid for its full 2-hour lifetime and cannot be invalidated. The
  only revocation mechanism is rotating `ADMIN_SESSION_SECRET`, which logs out
  all sessions.
- **No individual accountability.** One shared identity means administrative
  actions cannot be attributed to a specific person — directly contrary to
  §164.312(a)(2)(i), which requires assigning a *unique* identifier to each
  user, and undermining the audit trail's evidentiary value.
- **Admin actions are not written to `audit_log`.** Patient-side events are
  logged; administrative ones are not.

**Remediation:**
1. Add MFA to admin login (TOTP is sufficient and adds no recurring cost).
2. Give each staff member a **distinct** admin account. Shared logins are not
   defensible in an audit.
3. Move admin sessions to the server-side `sessions` table so they can be
   revoked on demand and on staff departure.
4. Log every admin action to `audit_log` with the acting individual's identity.
5. Shorten the 2-hour session TTL, or add an idle timeout, for an interface
   likely used on a shared pharmacy workstation.

---

### T-03 — Rate limiting and lockout are per-process and will not survive horizontal scaling
**Risk: MODERATE** · Likelihood: Moderate · Impact: Moderate
**Citation:** §164.308(a)(5)(ii)(C) Log-in Monitoring

Login lockout and rate limiting use in-process `Map` objects
(`src/lib/admin-auth.ts`, `src/app/api/auth/register/route.ts`, and the resend
throttle). Two consequences:

- **State is lost on restart or redeploy.** An attacker who is locked out can
  simply wait for the next deployment.
- **State is not shared across instances.** The included `Dockerfile` targets
  a containerized deployment (ECS/Fargate). If more than one task ever runs,
  an attacker gets N× the allowed attempts by distributing requests across
  tasks, and lockout becomes largely decorative.

This is currently latent — it becomes real the moment a second instance is
provisioned for availability.

**Remediation:** move counters to shared storage (a database table, or
ElastiCache) before running more than one instance. Alternatively, document
that the deployment is pinned to a single instance and re-assess if that
changes.

---

### T-04 — No documented backup, restore, or disaster-recovery procedure
**Risk: HIGH** · Likelihood: Moderate · Impact: High
**Citation:** §164.308(a)(7) Contingency Plan — **Data Backup Plan and Disaster
Recovery Plan are both *required*, not addressable**

No backup schedule, retention period, restore procedure, or recovery objective
is documented. HIPAA protects **availability**, not only confidentiality —
losing patient records is a compliance failure in its own right, independent of
any disclosure.

Note also that an untested backup is not a backup. OCR expects evidence of
periodic restore testing.

**Remediation:**
1. Enable RDS automated backups with a defined retention period (30 days
   suggested) and enable encryption at rest on the instance.
2. Document the restore procedure with a target RTO and RPO.
3. **Perform a test restore and record the result.** Repeat at least annually.
4. Confirm backup encryption and that backup access is restricted by IAM.

---

### T-05 — PHI encryption relies on a single non-rotatable key with no documented lifecycle
**Risk: MODERATE** · Likelihood: Low · Impact: High
**Citation:** §164.312(a)(2)(iv)

One key encrypts all PHI, sourced from an environment variable. There is no
key rotation procedure, no versioning, and no separation between environments.
Compromise of the single key exposes the entire dataset with no containment.

**Remediation:** move to AWS Secrets Manager or KMS; add a key-version prefix
to the ciphertext format so records encrypted under different key generations
can coexist during rotation; use distinct keys per environment so a
development leak cannot decrypt production data. (The ciphertext format
already carries a `v1:` prefix, which makes this straightforward.)

---

### T-06 — Contact-form messages may accumulate PHI in a store not designed for it
**Risk: MODERATE** · Likelihood: Moderate · Impact: Moderate
**Citation:** §164.502(b) Minimum Necessary; §164.312(a)(1)

The contact form warns users not to submit health information and screens
submissions for PHI-like patterns (SSN, Rx numbers, dates of birth, medical
terms). This is good practice and better than most implementations. However,
messages are now stored and readable in the admin panel, and pattern screening
cannot reliably catch free-text disclosure — a patient writing "my blood
pressure medication is making me dizzy" defeats it.

Assume this store **will** contain PHI over time and protect it accordingly.

**Remediation:** apply the same field-level encryption used for `patients` to
message bodies; define a retention period with automatic deletion; log admin
reads of messages to `audit_log` (see T-02).

---

### T-07 — Audit log has no defined retention or integrity protection
**Risk: MODERATE** · Likelihood: Moderate · Impact: Moderate
**Citation:** §164.312(b) Audit Controls; §164.316(b)(2)(i) — 6-year retention

The audit log is well designed in content, but:

- No retention policy. HIPAA requires 6 years for required documentation.
  There is no archival path and no protection against the table being trimmed.
- Application credentials can modify or delete audit rows. An attacker who
  compromises the application can erase evidence of their own access.
- No procedure exists for *reviewing* the logs. §164.308(a)(1)(ii)(D) requires
  regular review of activity records — an unreviewed log satisfies the letter
  of "audit controls" but not this separate requirement.

**Remediation:** define 6-year retention with archival to encrypted S3 (with
Object Lock for tamper resistance); restrict the application's database role to
INSERT-only on `audit_log`; establish and document a periodic review cadence,
recording who reviewed what and when.

---

### T-08 — Email fallback path must be verified closed in production
**Risk: LOW** · Likelihood: Low · Impact: High
**Citation:** §164.308(b)(1) Business Associate Contracts

OTP codes and reset links are sent via Amazon SES when configured, falling back
to Gmail SMTP otherwise. **Consumer Gmail is not covered by a BAA.** The code
correctly refuses the Gmail path when `NODE_ENV=production`, which is the right
design.

Risk is low because the guard exists, but impact is high if it fails, so this
warrants explicit verification rather than assumption.

**Remediation:** confirm by test in the production environment that Gmail
cannot be selected; remove the Gmail credentials from production configuration
entirely so the path is impossible rather than merely disabled; complete SES
production-access approval (SES begins in a sandbox that only sends to verified
addresses) before launch.

---

## 5. Administrative Safeguards — **REQUIRES PHARMACY INPUT**

> The development team cannot answer these. Each unanswered item is an open
> compliance gap, and several are *required* specifications with no
> flexibility. Complete with the Security Officer.

### A-01 — Security Officer designation · **Required** · §164.308(a)(2)
- [ ] A named individual is designated in writing as Security Officer.
      Name: ____________________ Date: __________
- [ ] A named individual is designated as Privacy Officer (may be the same
      person). Name: ____________________

*Currently undesignated. This is the first thing an investigator asks for, and
it is a required specification with no "addressable" flexibility.*

### A-02 — Workforce training · **Required** · §164.308(a)(5)
- [ ] Security-awareness training delivered to all workforce members with
      system access
- [ ] Training content retained
- [ ] Attendance/completion log maintained, with dates and signatures
- [ ] Refresher cadence defined (annual recommended)

### A-03 — Business Associate Agreements · **Required** · §164.308(b)(1)
- [ ] **AWS** — executed via AWS Artifact (self-service, no cost).
      Date: __________
- [ ] **DRx** — required before integration. Date: __________
- [ ] Any other vendor touching ePHI (email, backup, IT support, billing)
- [ ] A BAA register is maintained listing each associate, execution date, and
      services covered

### A-04 — Sanction policy · **Required** · §164.308(a)(1)(ii)(C)
- [ ] A written policy exists describing consequences for workforce members
      who violate security policies, and workforce members have been informed

### A-05 — Access management and termination · §164.308(a)(3), (a)(4)
- [ ] Written procedure for granting access on hire, by role
- [ ] Written procedure for **revoking access on termination**, including the
      admin panel and AWS console — *this is the most frequently missed item
      in small-organization audits*
- [ ] Periodic review of who holds access (quarterly recommended)
- [ ] Access is granted on a minimum-necessary basis

### A-06 — Incident response and breach notification · **Required** · §164.308(a)(6), §164.400–414
- [ ] Written breach-notification procedure exists (60-day clock to notify
      affected individuals and HHS; media notice if 500+ individuals in a
      state or jurisdiction)
- [ ] A four-factor risk assessment template exists for evaluating whether an
      incident is a reportable breach
- [ ] Staff know how and to whom to report a suspected incident
- [ ] An incident log is maintained — *including incidents determined not to
      be breaches*

### A-07 — Contingency plan · **Required** · §164.308(a)(7)
- [ ] Data backup plan documented (see T-04)
- [ ] Disaster recovery plan documented
- [ ] Emergency mode operation plan — how the pharmacy serves patients while
      the system is unavailable
- [ ] Procedures tested and results recorded

### A-08 — Policies and procedures documentation · **Required** · §164.316
- [ ] Written policies exist covering each safeguard above
- [ ] Retained for **6 years** from creation or last effective date
- [ ] Reviewed periodically and updated on material change

---

## 6. Physical Safeguards — **REQUIRES PHARMACY INPUT**

> The development team has no visibility into the physical premises. Do not
> mark these complete without verifying them on site.

### P-01 — Facility access controls · §164.310(a)
- [ ] Access to areas with systems reaching ePHI is restricted
- [ ] Visitor access is controlled and, where appropriate, logged
- [ ] Key/badge holders are documented and reviewed

### P-02 — Workstation use and security · §164.310(b), (c)
- [ ] Workstations used for the admin panel are positioned so screens are not
      visible to customers
- [ ] Automatic screen lock is enabled (short timeout)
- [ ] Full-disk encryption is enabled on every workstation and laptop
- [ ] Staff do not use shared or personal devices for administrative access
- [ ] **Developer laptops holding the repository are encrypted** — note that
      until T-01 is remediated, every such laptop holds the PHI encryption key

### P-03 — Device and media controls · §164.310(d)
- [ ] Procedure for disposing of media that held ePHI
- [ ] Procedure for sanitizing devices before reuse
- [ ] Movement of hardware is tracked

---

## 7. Summary of Findings

| ID | Finding | Risk | Owner |
|---|---|---|---|
| T-01 | Encryption key & DB password in source control | **CRITICAL** | Dev |
| T-02 | Admin access: no MFA, shared identity, unrevocable sessions | **HIGH** | Dev |
| T-04 | No backup / disaster recovery plan | **HIGH** | Dev + Pharmacy |
| T-03 | Rate limiting not durable or shared | Moderate | Dev |
| T-05 | Single non-rotatable encryption key | Moderate | Dev |
| T-06 | Contact messages may accumulate PHI unencrypted | Moderate | Dev |
| T-07 | No audit-log retention, integrity, or review | Moderate | Dev + Pharmacy |
| T-08 | Non-BAA email fallback must be verified closed | Low | Dev |
| A-01 | No Security Officer designated | **HIGH** | Pharmacy |
| A-02–A-08 | Administrative safeguards not established | **HIGH** | Pharmacy |
| P-01–P-03 | Physical safeguards not assessed | Unknown | Pharmacy |

### 7.1 Recommended sequence

**Before any real patient enrolls — non-negotiable:**
1. T-01 — rotate every secret, move to Secrets Manager, remove from git
2. A-01 — designate the Security Officer in writing
3. A-03 — execute the AWS BAA (free, self-service, same day)
4. T-02 — MFA and individual accounts for admin access
5. T-04 — backups configured **and a restore tested**
6. A-06 — breach-notification procedure written

**Within 30 days of launch:**
7. T-05, T-06, T-07 — key lifecycle, message encryption, log retention
8. A-02 — workforce training delivered and logged
9. A-04, A-05 — sanction and access-termination policies
10. Sections 5 and 6 completed, this document adopted and signed

**Ongoing:**
- Annual review of this analysis, and review upon any material change
  (notably: DRx integration, which requires its own assessment)
- Periodic audit-log review per T-07
- Annual restore test and contingency-plan test

---

## 7A. Remediation Log — 2026-08-27

Recorded here so the closure of each finding is evidenced rather than
asserted. Verification was performed against the production environment
unless stated otherwise.

| ID | Status | What changed | How it was verified |
|---|---|---|---|
| T-01 | **Closed** | Secrets rotated; `.env.local` untracked and gitignored; production values held in AWS Secrets Manager and injected at container start into a `600` temp file deleted immediately after. Nothing on disk, in the image, or in git. | Confirmed no secret values in the staged diff; confirmed the running container reads from Secrets Manager. |
| T-02 | **Closed** | Per-user `admin_users` with individual TOTP seeds (encrypted at rest); server-side `admin_sessions` that can be revoked; admin actions written to `audit_log` with the acting username. | Live production test: valid login 200, wrong password 401, TOTP replay 401, logout invalidates the session server-side, audit rows attributed to `admin:<username>`. |
| T-04 | **Closed** | Automated backups 30 days, deletion protection enabled, restore procedure exercised. | See §7B — a restore test was performed and found a real gap, which was then corrected. |
| T-06 | **Closed** | Contact-message name, email, phone, subject and body encrypted with AES-256-GCM at rest. | Live submission through the production form; raw DB row confirmed `v1:` ciphertext; plaintext search for the message body returned 0 rows. |
| T-07 | **Partially closed** | `audit_log` owned by the master role; application role holds `SELECT, INSERT` only. Retention and periodic review still outstanding. | Executed as the application user against production: `INSERT` succeeded, `UPDATE` and `DELETE` both denied, row unchanged. |
| T-03 | **Open — accepted** | Rate limiting remains per-process. Acceptable while the app runs as a single instance; must be revisited before a second instance is added. | — |
| T-05 | **Partially closed** | Key now held in Secrets Manager, distinct from development. Versioned rotation procedure still to be written. | — |
| T-08 | **Closed** | Production sends via Amazon SES under BAA; the Gmail path is unreachable when `NODE_ENV=production`. | Code path confirmed in `src/lib/mail.ts`; `SES_FROM_EMAIL` set in Secrets Manager. |

## 7C. Audit Retention and Review Policy — adopted 2026-08-29

Closes the remainder of T-07. Two separate requirements are addressed here,
and they are commonly confused: retaining records, and *reading* them.

### Retention (§164.316(b)(2)(i) — six years)

- Audit entries are never deleted from the database. The application role
  holds `SELECT, INSERT` only, so it cannot remove its own trail even if
  compromised.
- Each calendar month is additionally exported to
  `s3://liberty-pharmacy-audit-archive-429186228745/audit-log/<year>/`
  as newline-delimited JSON.
- The bucket has **S3 Object Lock in GOVERNANCE mode with 2192-day (6-year)
  retention**, default AES-256 encryption, versioning, and all public access
  blocked.
- A bucket policy denies `PutObject` without `if-none-match: *`, so an
  existing archive cannot be replaced, and denies all non-TLS access.

**Why the archive is necessary, and not merely belt-and-braces:** RDS
backups are retained 30 days. Without this, any audit entry older than 30
days existed in exactly one place — the live table. Losing the instance
would have destroyed years of records the law requires you to still hold.

**Verified 2026-08-29.** Against the live bucket: deleting an archived
object was refused by Object Lock; overwriting it was refused by the bucket
policy (`AccessDenied`); writing a new archive still succeeded.

> A note on how this was found: Object Lock alone was **not** sufficient.
> It protects a *version* from deletion, but an overwrite simply creates a
> newer version that becomes what readers get by default. The original
> remained recoverable, but a naive read returned tampered content. The
> bucket policy above is what actually closes it. Configuration was not
> enough — this only surfaced by attempting the attack.

### Review (§164.308(a)(1)(ii)(D) — regular review)

Run `npm run audit:report` (default 90 days, `--days N` to change). It
summarises activity by type, failures by actor, and failures by source
address.

**Cadence: monthly.** The Security Officer, or a delegate, reviews the
report and records: the date, who reviewed it, and anything followed up on.
File that note with this document.

Look for: repeated sign-in failures against one account, failures from a
single unfamiliar address, admin activity outside normal hours, and any
increase in patient-record reads without a matching business reason.

**An unreviewed log satisfies §164.312(b) but not this requirement.** They
are separate obligations and are cited separately.

### Operating procedure

| When | Action | Command |
|---|---|---|
| Monthly | Review activity and record that you did | `npm run audit:report` |
| Monthly | Archive the previous month | `npm run audit:archive` |
| Annually | Confirm archives are present and readable | list the S3 prefix |

### Still outstanding

- **T-05 rotation**: a written, tested key-rotation procedure.
- **All of §5 and §6**: unchanged — these remain the pharmacy's to complete,
  and no technical work substitutes for them.

## 7B. Backup Restore Test — 2026-08-27

Performed per §164.308(a)(7). Recorded in full because the first attempt
failed, and that failure is the most useful part of the record.

**First attempt.** The most recent automated snapshot
(`rds:liberty-pharmacy-db-2026-08-27-11-18`) was restored to a temporary
instance. The restored server contained only the `postgres` and `rdsadmin`
system databases — **the `liberty` application database was absent**. The
snapshot had been taken before the application database was created, so the
only backup then in existence would not have restored the system.

Had this been assumed rather than tested, the pharmacy would have believed
itself protected while holding a backup that restored nothing.

**Corrective action.** A manual snapshot (`liberty-manual-20260827-1707`) was
taken immediately, and restored to verify it contains the application
database and its data. The temporary instances were deleted after each test.

**Conclusion.** Backups are configured correctly going forward; the gap was a
timing artefact of initial provisioning. The lesson stands on its own: an
untested backup is an assumption, not a control. **Repeat this test at least
annually, and after any change to the database or its backup configuration.**

## 8. Limitations of This Analysis

Stated plainly, because a risk analysis that overstates its own authority is
itself a risk:

1. **It is incomplete.** Sections 5 and 6 are unanswered. It cannot be adopted
   as-is.
2. **It is not a legal opinion.** It was prepared by the development team, not
   by counsel or a certified healthcare compliance professional. Before
   adoption — and certainly before relying on it in any regulatory context —
   it should be reviewed by someone qualified to give that opinion.
3. **It reflects the system as of the draft date.** The DRx integration is not
   assessed and will materially change the risk profile.
4. **Technical controls were verified by code inspection**, not by penetration
   testing or an independent security assessment. Absence of a finding is not
   proof of absence of a vulnerability.
5. **Compliance is not a document.** Adopting this changes nothing on its own.
   The findings have to actually be remediated, and the practices actually
   followed.

---

## 9. Adoption

By signing, the Security Officer attests that Sections 5 and 6 have been
completed accurately, that the findings and risk ratings have been reviewed,
and that the remediation plan in §7.1 has been accepted.

| | Name | Signature | Date |
|---|---|---|---|
| Security Officer | | | |
| Privacy Officer | | | |
| Pharmacist-in-Charge | | | |

**Retain for six years** from the date of adoption or last revision,
whichever is later (§164.316(b)(2)(i)).
