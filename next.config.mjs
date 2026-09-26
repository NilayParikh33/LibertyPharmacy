/**
 * Liberty Pharmacy — Next.js configuration
 *
 * HIPAA-conscious defaults:
 *  - Strict security headers applied to every route (see securityHeaders below).
 *  - No third-party analytics/tracking scripts are loaded anywhere in the app.
 *  - poweredByHeader disabled to avoid advertising the server stack.
 *
 * NOTE: HIPAA compliance is a property of the whole system (hosting, BAAs,
 * PHI handling, policies), not just code. See HIPAA-COMPLIANCE.md for the
 * full checklist that must be satisfied before collecting any PHI.
 */

/**
 * Content-Security-Policy is NOT set here. It is set per request in
 * src/middleware.ts, because it carries a fresh script nonce for every page
 * response (a static header cannot). See SECURITY-AUDIT.md, SEC-014.
 */

const securityHeaders = [
  // Force HTTPS for 2 years, including subdomains. Submit to preload list once stable.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Never let browsers MIME-sniff responses.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Redundant with frame-ancestors but kept for older browsers.
  { key: "X-Frame-Options", value: "DENY" },
  // Do not leak full URLs (which could contain sensitive paths) to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Opt out of browser features this site never needs.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  // Cross-origin isolation hardening.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Hide the floating dev-tools indicator (the circular badge that reports a
  // route as Static/Dynamic). It only ever renders in `next dev` — never in a
  // production build — but it sits over the bottom-left corner of the UI.
  devIndicators: false,
  // Traces only the node_modules each route actually needs into .next/standalone,
  // instead of the whole node_modules tree — keeps the ECS/Docker image small.
  output: "standalone",
  // The site never uses Next's image optimizer (product images are plain
  // <img>, the one next/image is already `unoptimized`), but its endpoint,
  // /_next/image, is live by default — and it is where the critical
  // AVIF remote-code-execution advisory lives (GHSA-2xp9-vwfh-vxw4).
  // Turning it off removes that attack surface outright (SEC-010).
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
