import { NextResponse, type NextRequest } from "next/server";

/**
 * Request guard.
 *
 * Pages: a Content-Security-Policy with a fresh nonce per response (SEC-014).
 * Scripts run only if they carry the nonce, so an injected inline <script>
 * no longer executes. Next.js reads the nonce from the request's CSP header
 * and attaches it to its own scripts; every page here is already dynamically
 * rendered, which nonces require. 'strict-dynamic' lets those trusted scripts
 * load the app's chunks. Styles keep 'unsafe-inline' (inline style attributes
 * are used throughout and are not a script-execution vector).
 *
 * APIs: the checks below, before every /api route handler.
 *
 * 1. Cross-site request forgery (SEC-007). Session cookies are SameSite=Lax,
 *    which already stops browsers from attaching them to cross-site POSTs.
 *    This is the second, independent layer: a state-changing request must
 *    come from this site's own pages.
 *      - Sec-Fetch-Site (sent by every current browser, not settable by page
 *        script) must be "same-origin" or "none" (typed / bookmarked).
 *      - Where it is absent, the Origin header, if present, must match this
 *        host. Requests with neither are non-browser clients (curl, server
 *        to server), which cannot carry a victim's cookies anyway.
 *
 * 2. JSON bodies only. Every endpoint reads request.json(), which parses a
 *    body regardless of its declared type — so a cross-site
 *    <form enctype="text/plain"> could deliver a valid JSON payload without
 *    triggering a CORS preflight. Requiring application/json closes that:
 *    it is not a "simple" content type, so browsers must preflight it, and
 *    no CORS headers are ever granted.
 *
 * 3. No caching of API responses (SEC-009). Several return PHI (/api/auth/me);
 *    without Cache-Control, a shared proxy or the browser's back/forward
 *    cache could retain it.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Next.js DEV MODE only: react-refresh uses eval(); never sent in production.
const isDev = process.env.NODE_ENV === "development";

function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // When DRX integration lands, add the DRX API origin here.
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function pageResponse(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const headers = new Headers(request.headers);
  headers.set("content-security-policy", csp);
  headers.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

function json(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

function allowedHosts(request: NextRequest): Set<string> {
  const hosts = new Set<string>();
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) hosts.add(host.toLowerCase());
  const configured = process.env.APP_BASE_URL;
  if (configured) {
    try {
      hosts.add(new URL(configured).host.toLowerCase());
    } catch {
      // Malformed APP_BASE_URL — ignore rather than widen the allowlist.
    }
  }
  return hosts;
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return pageResponse(request);
  }

  if (!SAFE_METHODS.has(request.method)) {
    const site = request.headers.get("sec-fetch-site");
    if (site !== null) {
      if (site !== "same-origin" && site !== "none") {
        return json(403, "Cross-site request refused.");
      }
    } else {
      const origin = request.headers.get("origin");
      if (origin !== null) {
        let originHost: string | null = null;
        try {
          originHost = new URL(origin).host.toLowerCase();
        } catch {
          // "null" (sandboxed/opaque origins) and garbage are refused below.
        }
        if (!originHost || !allowedHosts(request).has(originHost)) {
          return json(403, "Cross-site request refused.");
        }
      }
    }

    const hasBody =
      request.headers.has("transfer-encoding") || Number(request.headers.get("content-length") ?? "0") > 0;
    if (hasBody) {
      const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (type !== "application/json") {
        return json(415, "Request body must be JSON.");
      }
    }
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  matcher: [
    // Every API request, unconditionally — the guard must not be skippable.
    "/api/:path*",
    // Pages: everything except build assets and static files (matched by
    // extension, so /products/<id> pages are included while the images under
    // /products/ are not). Prefetches skip it: they fetch RSC payloads, not
    // HTML documents, so they carry no CSP of their own.
    {
      source: "/((?!api/|_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|woff2?|txt|xml)$).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
