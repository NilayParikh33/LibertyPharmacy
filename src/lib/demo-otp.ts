/**
 * DEMO ESCAPE HATCH (client side) - carries an OTP from the register/login
 * response to the verify screen so it can be displayed instead of emailed.
 *
 * Only ever holds a value when the server is running with
 * DEMO_SHOW_OTP_ON_SCREEN=true; with the flag off, the API omits `demoCode`
 * entirely and every function here is a no-op. See startMfaChallenge in
 * src/lib/auth.ts for why that flag must never be on for real patients.
 *
 * sessionStorage rather than a query parameter: keeps the code out of the
 * URL, browser history, and any proxy or server access log. It is cleared as
 * soon as the verify screen has read it.
 */

const KEY = "libertyDemoOtp";

/** Safe on a server render and in browsers that block storage. */
function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Stash a `demoCode` from an auth response. Ignores undefined (flag off). */
export function stashDemoOtp(code: unknown): void {
  if (typeof code !== "string" || !code) return;
  try {
    storage()?.setItem(KEY, code);
  } catch {
    // A demo convenience is never worth breaking the signup flow over.
  }
}

/** Read and clear the stashed code, if any. */
export function takeDemoOtp(): string | null {
  const s = storage();
  if (!s) return null;
  try {
    const code = s.getItem(KEY);
    if (code) s.removeItem(KEY);
    return code;
  } catch {
    return null;
  }
}
