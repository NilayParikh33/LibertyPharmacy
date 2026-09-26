/**
 * Legitimate-use regression test (real browser). Proves the security fixes
 * did not break normal flows, and that no page trips the nonce CSP.
 * Local development servers only — it registers test accounts.
 */
import { createRequire } from "module";
import { readFileSync } from "fs";

// Playwright is not a project dependency; install it to run this suite:
//   npm i --no-save playwright && npx playwright install chromium
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright").catch(() => {
  console.error("Playwright not found — see tests/security/README.md.");
  process.exit(2);
});
const require = createRequire(import.meta.url);
const { generateSync } = require("otplib");
const BASE = "http://localhost:3000";
const ADMIN_USER = process.env.ADMIN_USERNAME;
const ADMIN_PASS = process.env.ADMIN_PASSWORD;
const SECRET = process.env.ADMIN_TOTP_SECRET;
const LOG = process.env.SERVER_LOG;
if (!LOG || !ADMIN_USER || !ADMIN_PASS || !SECRET) {
  console.error("Set SERVER_LOG, ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_TOTP_SECRET — see tests/security/README.md.");
  process.exit(2);
}
const RUN = Date.now().toString(36);
const results = [];
const problems = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

// Codes are written to the server log (DEMO_LOG_OTP_CODES, local only).
function latestFromLog(re, sinceLen) {
  const tail = readFileSync(LOG, "utf8").slice(sinceLen);
  const all = [...tail.matchAll(re)];
  return all.length ? all[all.length - 1][1] : null;
}
async function waitForLog(re, sinceLen, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = latestFromLog(re, sinceLen);
    if (v) return v;
    await new Promise((r) => setTimeout(r, 150));
  }
  return null;
}
const logLen = () => readFileSync(LOG, "utf8").length;
const CODE_RE = /\[DEMO_LOG_OTP_CODES\] (?:verification code|login code|code|[a-z -]*code[a-z ]*): (\d{6})/gi;

const browser = await chromium.launch({ args: ["--no-sandbox"] });
async function newPage(tag, ip) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": ip } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push(`[${tag}] pageerror ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") problems.push(`[${tag}] console ${m.text()}`); });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(`CSP violation: ${e.violatedDirective} blocked ${e.blockedURI || "inline"}`);
    });
  });
  return page;
}

// ---- 1. Every public page hydrates under the nonce CSP -------------------
{
  const page = await newPage("public", "10.200.0.1");
  for (const path of ["/", "/about", "/services", "/products", "/products/vitamin-d", "/blog", "/contact", "/locations", "/providers", "/privacy-policy", "/hipaa-notice", "/portal/login", "/portal/register", "/admin/login"]) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    // Hydration check: React attaches handlers; the header menu button works client-side.
    const hydrated = await page.evaluate(() => !!document.querySelector("header") && typeof window.__next_f !== "undefined");
    if (!hydrated) problems.push(`[public] ${path} did not hydrate`);
  }
  // Interactivity check on a client component: catalog search filters.
  await page.goto(BASE + "/products", { waitUntil: "networkidle" });
  await page.fill("#product-search", "vitamin");
  await page.waitForTimeout(400);
  const n = await page.locator("article").count();
  check("public pages render + hydrate, client search works under nonce CSP", n > 0 && n < 7, `${n} results for "vitamin"`);
}

// ---- 2. Registration → emailed code → portal --------------------------------
const email = `audit+func-${RUN}@example.test`;
const password = "Functional-Test-Pass-9";
{
  const page = await newPage("register", "10.200.0.2");
  await page.goto(BASE + "/portal/register", { waitUntil: "networkidle" });
  const since = logLen();
  const r = await page.evaluate(async ({ email, password }) => {
    const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      email, password, firstName: "Func", lastName: "Test", dateOfBirth: "1985-05-05", gender: "U", address1: "1 Test St", city: "Austin",
      state: "TX", zip: "78701", cellPhone: "512-555-0101", preferredLanguage: "English", deliveryMethod: "pickup", smsOptIn: false, hipaaAcknowledged: true }) });
    return { status: res.status, body: await res.json() };
  }, { email, password });
  const code = await waitForLog(CODE_RE, since);
  await page.goto(BASE + "/portal/verify?new=1", { waitUntil: "networkidle" });
  await page.fill('input[inputmode="numeric"], input[name="code"]', code ?? "000000");
  await Promise.all([page.waitForURL(/\/portal(\?|$)/, { timeout: 8000 }).catch(() => {}), page.click('button[type="submit"]')]);
  const me = await page.evaluate(async () => (await fetch("/api/auth/me")).status);
  check("register → emailed code → verified session", r.status === 200 && !!code && me === 200, `register ${r.status}, code ${code ? "received" : "MISSING"}, /api/auth/me ${me}`);

  // Logout works through the new API guard (POST, no body).
  const out = await page.evaluate(async () => (await fetch("/api/auth/logout", { method: "POST" })).status);
  const meAfter = await page.evaluate(async () => (await fetch("/api/auth/me")).status);
  check("logout (bodiless POST) passes the API guard and ends the session", out === 200 && meAfter === 401, `logout ${out}, /me after ${meAfter}`);
}

// ---- 3. Login + MFA via the real UI form -------------------------------------
{
  const page = await newPage("login", "10.200.0.3");
  await page.goto(BASE + "/portal/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  const since = logLen();
  await Promise.all([page.waitForURL(/\/portal\/verify/, { timeout: 8000 }), page.click('button[type="submit"]')]);
  const code = await waitForLog(CODE_RE, since);
  await page.fill('input[inputmode="numeric"], input[name="code"]', code ?? "000000");
  await Promise.all([page.waitForURL(/\/portal(\?|$)/, { timeout: 8000 }).catch(() => {}), page.click('button[type="submit"]')]);
  const text = await page.textContent("main");
  check("login form → MFA code → portal shows the patient", /Func/.test(text ?? ""), `portal greets: ${/Func/.test(text ?? "") ? "yes" : "no"}`);
}

// ---- 4. Duplicate registration: owner is notified; no session possible ------
{
  const page = await newPage("dup", "10.200.0.4");
  await page.goto(BASE + "/portal/register", { waitUntil: "networkidle" });
  const since = logLen();
  const r = await page.evaluate(async ({ email }) => {
    const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      email, password: "Someone-Else-Pass-1", firstName: "Evil", lastName: "Twin", dateOfBirth: "1970-01-01", gender: "U", address1: "2 Other St",
      city: "Austin", state: "TX", zip: "78701", cellPhone: "512-555-0199", preferredLanguage: "English", deliveryMethod: "pickup", smsOptIn: false, hipaaAcknowledged: true }) });
    return { status: res.status, body: await res.json() };
  }, { email });
  const notice = await waitForLog(/\[DEMO_LOG_OTP_CODES\] account-exists notice: (\S+)/g, since);
  const tries = [];
  for (let i = 0; i < 5; i++) tries.push(await page.evaluate(async (c) => (await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: c }) })).status, String(100000 + i)));
  const me = await page.evaluate(async () => (await fetch("/api/auth/me")).status);
  check("duplicate registration: same 200 response, owner notified, decoy never yields a session",
    r.status === 200 && r.body.next === "verify" && !!notice && me === 401 && tries.slice(0, 4).every((s) => s === 400) && tries[4] === 429,
    `register ${r.status}, notice ${notice ? "sent" : "MISSING"}, wrong codes → ${tries.join(",")}, /me ${me}`);
}

// ---- 5. Forgot → reset link → new password works ------------------------------
{
  const page = await newPage("reset", "10.200.0.5");
  await page.goto(BASE + "/portal/forgot", { waitUntil: "networkidle" });
  const since = logLen();
  await page.fill('input[type="email"]', email);
  await page.click('button[type="submit"]');
  const link = await waitForLog(/\[DEMO_LOG_OTP_CODES\] reset link: (\S+)/g, since);
  let ok = false, detail = "no reset link logged";
  if (link) {
    await page.goto(link, { waitUntil: "networkidle" });
    const pw = page.locator('input[type="password"]');
    await pw.nth(0).fill("Brand-New-Pass-2026");
    if ((await pw.count()) > 1) await pw.nth(1).fill("Brand-New-Pass-2026");
    await Promise.all([page.waitForURL(/\/portal\/login/, { timeout: 8000 }).catch(() => {}), page.click('button[type="submit"]')]);
    const login = await page.evaluate(async ({ email }) => (await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Brand-New-Pass-2026" }) })).status, { email });
    ok = login === 200; detail = `reset link received, login with new password → ${login}`;
  }
  check("forgot password → emailed link → reset → login with new password", ok, detail);
}

// ---- 6. Contact form via UI ---------------------------------------------------
{
  const page = await newPage("contact", "10.200.0.6");
  await page.goto(BASE + "/contact", { waitUntil: "networkidle" });
  const f = page.locator("form");
  await f.locator('input[name="firstName"]').fill("Func");
  await f.locator('input[name="lastName"]').fill("Tester");
  await f.locator('input[name="email"]').fill("func@example.test");
  await f.locator('select[name="subject"]').selectOption("hours");
  await f.locator('textarea[name="message"]').fill(`What are your weekend hours? [functional test ${RUN}]`);
  await f.locator('button[type="submit"]').click();
  await page.waitForTimeout(1200);
  const txt = (await page.textContent("main")) ?? "";
  check("contact form submits from the real page", /thank|sent|received/i.test(txt), /thank|sent|received/i.test(txt) ? "success message shown" : "no success message");
}

// ---- 7. Admin: login, every page, settings save, message status, post edit ----
{
  const page = await newPage("admin", "10.200.0.7");
  await page.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
  await page.fill('#username, input[name="username"]', ADMIN_USER);
  await page.fill('input[type="password"]', ADMIN_PASS);
  // Wait into a fresh TOTP step: the harness may have just used this one.
  const wait = 30_000 - (Date.now() % 30_000) + 500;
  await page.waitForTimeout(wait);
  await page.fill('input[inputmode="numeric"], #token, input[name="token"]', generateSync({ secret: SECRET }));
  await Promise.all([page.waitForURL(/\/admin$/, { timeout: 8000 }), page.click('button[type="submit"]')]);
  const pages = {};
  for (const p of ["/admin", "/admin/messages", "/admin/posts", "/admin/settings", "/admin/posts/new"]) {
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    pages[p] = page.url().endsWith(p);
  }
  // Soft navigation between admin pages (the path SEC-001 abused) still works for a real admin.
  await page.goto(BASE + "/admin/posts", { waitUntil: "networkidle" });
  await page.click('nav[aria-label="Admin navigation"] a[href="/admin/settings"]');
  await page.waitForURL(/\/admin\/settings$/);
  const softNav = await page.locator("form").count();
  // Save settings unchanged (valid tel: and Google Maps URL must pass the new rules).
  await page.click('form button[type="submit"]');
  await page.waitForTimeout(1200);
  const saved = /saved|updated/i.test((await page.textContent("main")) ?? "");
  // Message status change through the UI control.
  await page.goto(BASE + "/admin/messages", { waitUntil: "networkidle" });
  const statusRes = page.waitForResponse((r) => /\/api\/admin\/messages\/\d+$/.test(r.url()), { timeout: 5000 }).catch(() => null);
  const control = page.locator("select").first();
  if (await control.count()) await control.selectOption("read"); else await page.locator('button:has-text("Mark")').first().click().catch(() => {});
  const sr = await statusRes;
  // Edit the seeded post and save it unchanged.
  await page.goto(BASE + "/admin/posts", { waitUntil: "networkidle" });
  await page.locator('a[href^="/admin/posts/"]:not([href$="/new"])').first().click();
  await page.waitForURL(/\/admin\/posts\/\d+$/);
  const putRes = page.waitForResponse((r) => /\/api\/admin\/posts\/\d+$/.test(r.url()) && r.request().method() === "PUT", { timeout: 5000 }).catch(() => null);
  await page.click('form button[type="submit"]');
  const pr = await putRes;
  check("admin: login + all pages + soft nav + settings save + message status + post edit",
    Object.values(pages).every(Boolean) && softNav > 0 && saved && sr?.status() === 200 && pr?.status() === 200,
    `pages ${JSON.stringify(pages)}, soft-nav form ${softNav}, settings saved ${saved}, status PATCH ${sr?.status()}, post PUT ${pr?.status()}`);
}

await browser.close();
// Chrome logs every non-2xx fetch as "Failed to load resource"; those are the
// deliberate 400/401/429 responses the flows above assert on, not faults.
const real = problems.filter((p) => !/Failed to load resource: the server responded with a status of (400|401|429)/.test(p));
const csp = real.filter((p) => /CSP|Content Security Policy|Refused to/i.test(p));
check("zero page errors, CSP violations, or unexpected console errors", real.length === 0,
  real.length ? real.join(" || ") : `none (${problems.length - real.length} expected 4xx network logs ignored)`);
console.log(`\n${results.filter(Boolean).length}/${results.length} passed${csp.length ? ` — ${csp.length} CSP violations` : ""}`);
process.exit(results.every(Boolean) ? 0 : 1);
