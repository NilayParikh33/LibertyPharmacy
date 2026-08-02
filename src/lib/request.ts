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
 * This assumes exactly one trusted reverse proxy sits in front of the app
 * (true for the documented AWS Lightsail deployment). If a different
 * topology is introduced (e.g. multiple chained proxies), this must be
 * revisited to trust the Nth-from-right hop instead.
 */
export function getClientIp(request: Request): string {
  const header = request.headers.get("x-forwarded-for");
  if (!header) return "local";
  const hops = header.split(",").map((h) => h.trim()).filter(Boolean);
  return hops.length ? hops[hops.length - 1] : "local";
}
