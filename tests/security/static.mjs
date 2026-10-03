/**
 * Static security checks — no server needed, fast enough for every commit.
 *
 * SEC-001: every page under app/admin/(protected) must authorize itself.
 * A layout-level check alone is skipped on soft navigation (partial
 * rendering re-renders only the changed page segment), which let an
 * unauthenticated request render admin pages.
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const root = new URL("../../src/app/admin/(protected)", import.meta.url).pathname;
const pages = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name === "page.tsx") pages.push(p);
  }
})(root);

const missing = pages.filter((p) => !/await\s+requireAdmin\(\)/.test(readFileSync(p, "utf8")));
for (const p of missing) console.log(`FAIL  ${p.slice(root.length - "(protected)".length)} does not call await requireAdmin()`);
console.log(missing.length ? `\n${missing.length} protected admin page(s) missing their own auth check` : `PASS  all ${pages.length} protected admin pages call await requireAdmin()`);
process.exit(missing.length ? 1 : 0);
