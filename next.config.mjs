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
 * Content-Security-Policy:
 *  - default-src 'self'      : only load resources from our own origin
 *  - script-src              : Next.js requires 'unsafe-inline' for its runtime
 *                              bootstrap; tighten with nonces before handling PHI.
 *  - frame-ancestors 'none'  : never allow the site to be iframed (clickjacking)
 *  - form-action 'self'      : forms may only post to our own origin
 *  - connect-src 'self'      : fetch/XHR restricted to our own origin.
 *                              When DRX integration lands, add the DRX API origin
 *                              here (e.g. https://liberty.drxrefill.com).
 */
// Next.js DEV MODE only: react-refresh (hot reload) uses eval(), and blocking
// it prevents React from hydrating at all (no client-side interactivity).
// 'unsafe-eval' is never sent in production builds.
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  // Force HTTPS for 2 years, including subdomains. Submit to preload list once stable.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: csp },
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
  // Traces only the node_modules each route actually needs into .next/standalone,
  // instead of the whole node_modules tree — keeps the ECS/Docker image small.
  output: "standalone",
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
