# Security regression tests

One check per finding in [`SECURITY-AUDIT.md`](../../SECURITY-AUDIT.md). Each
replays the original non-destructive attack and must report `SECURE`.

| Script | Needs a server? | What it proves |
| --- | --- | --- |
| `npm run test:security:static` | No | Every `admin/(protected)` page authorizes itself (SEC-001). Fast; run on every commit. |
| `npm run test:security` | Yes | The static check, then all attack replays (SEC-001 … SEC-014). |
| `npm run test:security:e2e` | Yes + Playwright | Legitimate flows still work in a real browser, with zero CSP violations. |

**Local development servers only.** The suites register test accounts
(`audit+…@example.test`) and submit contact messages; `poc.mjs` refuses any
`BASE` other than localhost.

## Running

```bash
npm run db                                   # local Postgres
npm run build

# A throwaway admin for this local database (seeded only if none exists).
export ADMIN_USERNAME=local-admin ADMIN_PASSWORD='Local-Only-Pass-1'
export ADMIN_TOTP_SECRET=$(node -e 'console.log(require("otplib").generateSecret())')
set -a; . ./.env.local; set +a               # DATABASE_URL, PHI_ENCRYPTION_KEY

# Codes and reset links go to the log instead of email; the suites read them.
export SERVER_LOG=/tmp/liberty-server.log
DEMO_LOG_OTP_CODES=true npm start > "$SERVER_LOG" 2>&1 &

npm run test:security
npm i --no-save playwright && npx playwright install chromium
npm run test:security:e2e
```

Exit code is non-zero if any check fails. Each run uses fresh fake client
IPs (`X-Forwarded-For`), so the rate limiters from earlier runs don't mask
results — restart the server between runs if you change limits.
