/**
 * Client IP extraction for rate limiting and audit logging.
 *
 * `X-Forwarded-For` is a comma-separated hop chain that a reverse proxy
 * *appends* to as a request passes through — the leftmost entry is whatever
 * the client sent and is fully attacker-controlled, while the rightmost
 * entry is the address the nearest trusted proxy (AWS Lightsail/ALB, nginx,
 * etc.) actually saw. Trusting the leftmost value lets a client fake any IP,
 * defeating both the registration rate limiter and audit-log forensics.
 *
 * TRUSTED_PROXY_HOPS is the number of proxies in front of the app that each
 * append a hop (default 1, the documented single-proxy deployments). The
 * client is the entry that many places from the right. Getting this wrong
 * matters: too low, and every visitor shares the proxy's address — so one
 * abusive client trips the rate limits for everyone; too high, and clients
 * can spoof their IP again. Verify it against a real request's
 * X-Forwarded-For after any change of hosting (SECURITY-AUDIT.md, SEC-015).
 */
const TRUSTED_PROXY_HOPS = Math.max(1, Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "1", 10) || 1);

export function getClientIp(request: Request): string {
  const header = request.headers.get("x-forwarded-for");
  if (!header) return "local";
  const hops = header.split(",").map((h) => h.trim()).filter(Boolean);
  if (!hops.length) return "local";
  // Fewer hops than configured proxies: the header didn't pass through all
  // of them, so fall back to the leftmost entry rather than index past it.
  return hops[Math.max(0, hops.length - TRUSTED_PROXY_HOPS)];
}

/**
 * Public origin for links sent by email (reset links, sign-in links).
 *
 * APP_BASE_URL is required in production (render.yaml sets it): behind a
 * proxy the request's own origin is an internal address, and a link origin
 * derived from the request is only as trustworthy as the Host header. Falls
 * back to the request origin for local development only.
 */
export function getAppBaseUrl(request: Request): string {
  const configured = process.env.APP_BASE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  return new URL(request.url).origin;
}
