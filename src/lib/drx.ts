/**
 * DRX integration seam — placeholder module.
 *
 * Liberty Pharmacy plans to integrate with the DRX white-label pharmacy
 * platform (drxrefill.com / drxapp.com) for the patient portal, online
 * refills, and the store. Until that integration is built, every function
 * here is a stub and the UI renders "coming soon" states.
 *
 * INTEGRATION PLAN (when ready):
 *  1. Set DRX_* variables in .env.local (see .env.example).
 *  2. Replace the stubs below with real calls. All DRX calls MUST go through
 *     server-side code (API routes / server components) so API keys and any
 *     PHI never reach the browser except over our own authenticated session.
 *  3. Add the DRX origin to connect-src in the CSP (next.config.mjs).
 *  4. Confirm a Business Associate Agreement (BAA) is in place with DRX
 *     before any PHI flows through this module. See HIPAA-COMPLIANCE.md.
 */

export const drxConfig = {
  /** Public storefront URL, e.g. https://liberty.drxrefill.com */
  storeUrl: process.env.NEXT_PUBLIC_DRX_STORE_URL ?? null,
  /** Server-side API base URL — never expose to the client. */
  apiBaseUrl: process.env.DRX_API_BASE_URL ?? null,
  /** Server-side API key — never expose to the client. */
  apiKey: process.env.DRX_API_KEY ?? null,
};

/** True once the DRX storefront URL is configured. */
export function isDrxConfigured(): boolean {
  return Boolean(drxConfig.storeUrl);
}

// ---------------------------------------------------------------------------
// Stubs — replace with real DRX API calls during integration.
// ---------------------------------------------------------------------------

export async function drxPatientLogin(_email: string, _password: string): Promise<never> {
  throw new Error("DRX integration not yet implemented");
}

export async function drxPatientRegister(_payload: unknown): Promise<never> {
  throw new Error("DRX integration not yet implemented");
}

export async function drxRequestRefill(_payload: unknown): Promise<never> {
  throw new Error("DRX integration not yet implemented");
}

export async function drxTransferRx(_payload: unknown): Promise<never> {
  throw new Error("DRX integration not yet implemented");
}
