/**
 * Security regression suite — one check per finding in SECURITY-AUDIT.md.
 *
 * Each check replays the original (non-destructive) attack against a running
 * server and prints VULNERABLE or SECURE; the process exits non-zero if any
 * check is VULNERABLE. Run it against LOCAL development only — it creates
 * clearly-labelled test accounts and contact messages. See README.md here.
 *
 *   npm run test:security            # all checks
 *   npm run test:security -- SEC-003 # one check
 */
import { createRequire } from "module";
import { readFileSync } from "fs";
import { execSync } from "child_process";

const require = createRequire(import.meta.url);
const { generateSync } = require("otplib");
const BASE = process.env.BASE ?? "http://localhost:3000";
// The same values the server was started with (they seed the first admin).
const ADMIN_USER = process.env.ADMIN_USERNAME;
const ADMIN_PASS = process.env.ADMIN_PASSWORD;
const SECRET = process.env.ADMIN_TOTP_SECRET;
// Server stdout, captured with DEMO_LOG_OTP_CODES=true (SEC-005 reads links from it).
const LOG = process.env.SERVER_LOG;
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error(`Refusing to run against ${BASE}: this suite creates test data. Local servers only.`);
  process.exit(2);
}
const ONLY = process.argv[2];
const results = [];

// --- tiny cookie-aware client ---------------------------------------------
function jar() {
  const c = new Map();
  return {
    header: () => [...c].map(([k, v]) => `${k}=${v}`).join("; "),
    take(res) {
      for (const sc of res.headers.getSetCookie?.() ?? []) {
        const [kv] = sc.split(";");
        const i = kv.indexOf("=");
        const k = kv.slice(0, i), v = kv.slice(i + 1);
        if (v === "" || /max-age=0|expires=Thu, 01 Jan 1970/i.test(sc)) c.delete(k); else c.set(k, v);
      }
    },
  };
}
async function req(path, { method = "GET", body, headers = {}, j, raw } = {}) {
  const h = { ...headers };
  if (j && j.header()) h.cookie = j.header();
  let payload = body;
  if (body !== undefined && !raw) { payload = JSON.stringify(body); h["content-type"] ??= "application/json"; }
  const t0 = performance.now();
  const res = await fetch(BASE + path, { method, body: payload, headers: h, redirect: "manual" });
  const ms = performance.now() - t0;
  j?.take(res);
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch {}
  return { status: res.status, headers: res.headers, text, json, ms };
}
function record(id, title, vulnerable, evidence) {
  results.push({ id, title, vulnerable, evidence });
  console.log(`${vulnerable ? "VULNERABLE" : "SECURE    "}  ${id}  ${title}\n            ${evidence}`);
}
const run = (id) => !ONLY || ONLY === id;
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
// Each run uses a distinct fake client IP so per-IP limiters from earlier
// runs don't mask a result. getClientIp trusts the rightmost XFF hop.
const RUN = Date.now().toString(36);
let ipSeq = 1;
const freshIp = () => `10.${(parseInt(RUN, 36) >> 8) & 255}.${parseInt(RUN, 36) & 255}.${ipSeq++}`;

let adminJar;
async function adminLogin(ip = freshIp()) {
  if (adminJar) return adminJar;
  const j = jar();
  // TOTP codes are single-use; wait for a fresh step if needed.
  const r = await req("/api/admin/login", { method: "POST", j, headers: { "x-forwarded-for": ip },
    body: { username: ADMIN_USER, password: ADMIN_PASS, token: generateSync({ secret: SECRET }) } });
  if (r.status !== 200) throw new Error("admin login failed: " + r.status + " " + r.text);
  adminJar = j;
  return j;
}

// ---------------------------------------------------------------------------
if (run("SEC-001")) {
  // Layout-only auth: replay soft-navigation RSC requests with NO cookies, for
  // every page under the (protected) admin layout.
  const pages = [["", "dashboard", /New Messages|Total Messages/], ["posts", "posts list", /New Post|DeletePost/], ["settings", "settings", /phoneHref|mapsUrl|Site Settings/], ["messages", "messages", /decrypt|status/]];
  const leaks = [];
  for (const [seg, label, marker] of pages) {
    const leaf = seg ? [seg, { children: ["__PAGE__", {}, null, null] }, null, "refetch"] : ["__PAGE__", {}, null, "refetch"];
    const tree = encodeURIComponent(JSON.stringify(["", { children: ["admin", { children: ["(protected)", { children: leaf }, null, null] }, null, null] }, null, null]));
    const r = await req("/admin" + (seg ? "/" + seg : ""), { headers: { RSC: "1", "Next-Router-State-Tree": tree } });
    const redirected = /NEXT_REDIRECT|\/admin\/login/.test(r.text);
    if (!redirected && marker.test(r.text)) leaks.push(label);
  }
  record("SEC-001", "Admin pages render for an unauthenticated RSC soft-navigation request", leaks.length > 0,
    leaks.length ? `rendered without auth: ${leaks.join(", ")}` : "all 4 admin pages redirect to /admin/login");
}

if (run("SEC-002")) {
  // Account enumeration via registration response.
  const email = `audit+enum-${RUN}@example.test`;
  const form = { email, password: "Audit-Enum-Pass-123", firstName: "Audit", lastName: "Test", dateOfBirth: "1990-01-01", gender: "U",
    address1: "1 Test St", city: "Austin", state: "TX", zip: "78701", cellPhone: "512-555-0100", preferredLanguage: "English",
    deliveryMethod: "pickup", smsOptIn: false, hipaaAcknowledged: true };
  const ip = freshIp();
  const first = await req("/api/auth/register", { method: "POST", body: form, headers: { "x-forwarded-for": ip } });
  const second = await req("/api/auth/register", { method: "POST", body: form, headers: { "x-forwarded-for": ip } });
  const distinguishable = first.status !== second.status || JSON.stringify(first.json) !== JSON.stringify(second.json);
  record("SEC-002", "Registration reveals whether an email already has an account", distinguishable,
    `new-email → ${first.status} ${JSON.stringify(first.json)} | same-email → ${second.status} ${JSON.stringify(second.json)}`);

  // Enumeration via the lockout oracle on login: only real accounts ever lock.
  const probe = async (addr) => { let last; const ip = freshIp(); for (let i = 0; i < 6; i++) last = await req("/api/auth/login", { method: "POST", headers: { "x-forwarded-for": ip }, body: { email: addr, password: "definitely-wrong-1" } }); return last; };
  const real = await probe(email);
  const fake = await probe(`nobody-${RUN}@example.test`);
  record("SEC-002b", "Login lockout response reveals which emails are registered", real.status !== fake.status || real.text !== fake.text,
    `6th bad login: registered → ${real.status} "${real.json?.error}" | unregistered → ${fake.status} "${fake.json?.error}"`);

  // Timing oracle: known email runs scrypt, unknown returns immediately.
  const t = async (addr) => { const a = []; for (let i = 0; i < 7; i++) a.push((await req("/api/auth/forgot", { method: "POST", headers: { "x-forwarded-for": freshIp() }, body: { email: addr } })).ms); return median(a); };
  const tl = async (addr) => { const a = []; for (let i = 0; i < 7; i++) a.push((await req("/api/auth/login", { method: "POST", headers: { "x-forwarded-for": freshIp() }, body: { email: addr, password: "x" } })).ms); return median(a); };
  const known2 = `audit+timing-${RUN}@example.test`;
  await req("/api/auth/register", { method: "POST", headers: { "x-forwarded-for": freshIp() }, body: { ...form, email: known2 } });
  const lk = await tl(known2), lu = await tl(`nobody2-${RUN}@example.test`);
  record("SEC-002c", "Login response time reveals which emails are registered", lk > lu * 2 && lk - lu > 15,
    `median login time: registered ${lk.toFixed(1)}ms vs unregistered ${lu.toFixed(1)}ms`);
}

if (run("SEC-003")) {
  // Unauthenticated contact form: no rate limit → inbox/DB flooding.
  const ip = freshIp();
  const codes = [];
  for (let i = 0; i < 12; i++) {
    const r = await req("/api/contact", { method: "POST", headers: { "x-forwarded-for": ip },
      body: { firstName: "Audit", lastName: `Flood${i}`, email: "audit@example.test", subject: "other", message: `[security audit rate-limit probe ${RUN}]` } });
    codes.push(r.status);
  }
  record("SEC-003", "Contact form accepts unlimited submissions from one client", !codes.includes(429),
    `12 rapid submissions from one IP → ${codes.join(",")}`);
}

if (run("SEC-004")) {
  // Patient login: no per-IP throttle → credential stuffing across many accounts.
  const ip = freshIp(); const codes = [];
  for (let i = 0; i < 25; i++) codes.push((await req("/api/auth/login", { method: "POST", headers: { "x-forwarded-for": ip }, body: { email: `spray${i}-${RUN}@example.test`, password: "Winter2026!" } })).status);
  record("SEC-004", "Patient login has no per-client rate limit (password spraying)", !codes.includes(429),
    codes.includes(429) ? `25 logins against 25 different emails from one IP → 429 from attempt #${codes.indexOf(429) + 1}` : `25 logins against 25 different emails from one IP → ${[...new Set(codes)].join(",")}, never 429`);
}

if (run("SEC-005")) {
  // Password-reset poisoning: link origin taken from the request when APP_BASE_URL is unset.
  const email = `audit+enum-${RUN}@example.test`;
  if (!LOG) { console.log("SKIPPED     SEC-005  (set SERVER_LOG to the server's captured stdout)"); }
  else {
  const before = readFileSync(LOG, "utf8").length;
  await req("/api/auth/forgot", { method: "POST", headers: { "x-forwarded-for": freshIp(), host: "attacker.example", "x-forwarded-host": "attacker.example" }, body: { email } });
  await new Promise((r) => setTimeout(r, 500));
  const tail = readFileSync(LOG, "utf8").slice(before);
  const link = (tail.match(/https?:\/\/[^\s]+\/portal\/reset\?token=[^\s]+/) || [])[0] ?? "(no link logged — account may not exist on this run)";
  const poisoned = /attacker\.example/.test(link);
  record("SEC-005", "Password-reset link origin can be set by the requester (Host header)", poisoned,
    `emailed link origin: ${link.replace(/token=[^\s]+/, "token=<redacted>")}`);
  }
}

if (run("SEC-006")) {
  // Admin-controlled hrefs accept dangerous URL schemes.
  const j = await adminLogin();
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const row = (await pool.query("SELECT * FROM site_settings WHERE id = 1")).rows[0];
  await pool.end();
  const good = { name: row.name, tagline: row.tagline, phone: row.phone, phoneHref: row.phone_href, fax: row.fax, email: row.email,
    address: { line1: row.address_line1, city: row.address_city, state: row.address_state, zip: row.address_zip, county: row.address_county },
    hours: JSON.parse(row.hours_json), mapsUrl: row.maps_url };
  const evil = { ...good, mapsUrl: "javascript:alert(document.domain)", phoneHref: "https://attacker.example/phish" };
  const put = await req("/api/admin/settings", { method: "PUT", j, body: evil });
  let rendered = "";
  if (put.status === 200) {
    const home = await req("/contact");
    rendered = (home.text.match(/href="(javascript:[^"]*|https:\/\/attacker\.example[^"]*)"/g) || []).join(" ");
    // Restore the original settings immediately.
    const restore = await req("/api/admin/settings", { method: "PUT", j, body: good });
    if (restore.status !== 200) console.log("!! RESTORE FAILED", restore.status, restore.text);
  }
  record("SEC-006", "Site settings accept javascript:/off-site URLs for mapsUrl and phoneHref", put.status === 200,
    `PUT with mapsUrl=javascript:… phoneHref=https://attacker.example → ${put.status}; rendered hrefs: ${rendered || "(none)"} (restored)`);
}

if (run("SEC-007")) {
  // CSRF defence-in-depth: state-changing API accepts cross-origin, non-JSON requests.
  const j = await adminLogin();
  const r = await req("/api/admin/messages/999999", { method: "PATCH", j, raw: true, body: '{"status":"read"}',
    headers: { "content-type": "text/plain", origin: "https://attacker.example", "sec-fetch-site": "cross-site" } });
  record("SEC-007", "Authenticated API accepts cross-site Origin + text/plain body (no Origin/CSRF check)", r.status === 200,
    `PATCH with Origin: https://attacker.example, Content-Type: text/plain → ${r.status}`);
}

if (run("SEC-008")) {
  // Unvalidated route ids → unhandled DB errors (500).
  const j = await adminLogin();
  const a = await req("/api/admin/messages/not-a-number", { method: "PATCH", j, body: { status: "read" } });
  const b = await req("/api/admin/posts/not-a-number", { method: "DELETE", j });
  record("SEC-008", "Non-numeric ids reach the database and crash the handler", a.status >= 500 || b.status >= 500,
    `PATCH messages/not-a-number → ${a.status}; DELETE posts/not-a-number → ${b.status}`);
}

if (run("SEC-009")) {
  // Authenticated JSON with PHI must not be cacheable.
  const r = await req("/api/auth/me");
  const cc = r.headers.get("cache-control") ?? "(none)";
  record("SEC-009", "API responses carry no Cache-Control (PHI JSON cacheable by intermediaries)", !/no-store/.test(cc),
    `/api/auth/me cache-control: ${cc}`);
}

if (run("SEC-010")) {
  // Image optimizer (critical AVIF RCE advisory) reachable though unused.
  const r = await req("/_next/image?url=%2Fhero%2Fpharmacist.svg&w=64&q=75");
  const live = r.status !== 404 && !/not found/i.test(r.text.slice(0, 200));
  record("SEC-010", "Unused Next.js image-optimizer endpoint is exposed", live, `/_next/image → ${r.status} ${r.text.slice(0, 80).replace(/\s+/g, " ")}`);
}

if (run("SEC-011")) {
  // Admin username enumeration via timing (scrypt runs only for real users).
  const t = async (u) => { const a = []; for (let i = 0; i < 5; i++) a.push((await req("/api/admin/login", { method: "POST", headers: { "x-forwarded-for": freshIp() }, body: { username: u, password: "wrong-password-x", token: "000000" } })).ms); return median(a); };
  const real = await t(ADMIN_USER), fake = await t(`ghost-${RUN}`);
  record("SEC-011", "Admin login response time reveals valid usernames", real > fake * 2 && real - fake > 15,
    `median: real user ${real.toFixed(1)}ms vs unknown ${fake.toFixed(1)}ms`);
}

if (run("SEC-012")) {
  // Dependency advisories.
  const out = execSync("npm audit --json 2>/dev/null || true", { cwd: new URL("../..", import.meta.url).pathname }).toString();
  const m = JSON.parse(out).metadata.vulnerabilities;
  record("SEC-012", "Known-vulnerable dependencies (npm audit)", m.critical + m.high > 0, `critical=${m.critical} high=${m.high} moderate=${m.moderate}`);
}

if (run("SEC-014")) {
  // CSP must not allow arbitrary inline script; needs a per-response nonce.
  const pages = ["/", "/products/vitamin-d", "/portal/login", "/admin/login"];
  const bad = [];
  const nonces = new Set();
  for (const p of pages) {
    const r = await req(p);
    const csp = r.headers.get("content-security-policy") ?? "";
    const scriptSrc = (csp.match(/script-src([^;]*)/) || [, ""])[1];
    const nonce = (scriptSrc.match(/'nonce-([^']+)'/) || [])[1];
    if (!csp || /'unsafe-inline'/.test(scriptSrc) || !nonce) bad.push(`${p}: script-src${scriptSrc || " (no CSP)"}`);
    else nonces.add(nonce);
    // Every inline/external script tag Next emitted must carry that nonce.
    const scripts = [...r.text.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
    const unnonced = scripts.filter((t) => !t.includes(`nonce="${nonce}"`));
    if (nonce && unnonced.length) bad.push(`${p}: ${unnonced.length}/${scripts.length} <script> tags without the nonce`);
  }
  if (nonces.size && nonces.size !== pages.length - bad.length) bad.push("nonce reused across responses");
  record("SEC-014", "CSP permits inline script (script-src 'unsafe-inline', no nonce)", bad.length > 0,
    bad.length ? bad.join(" | ") : `${pages.length} pages: nonce-based script-src, every <script> nonced, fresh nonce per response`);
}

const vuln = results.filter((r) => r.vulnerable).length;
console.log(`\n${vuln} vulnerable / ${results.length} checks`);
process.exit(vuln ? 1 : 0);
