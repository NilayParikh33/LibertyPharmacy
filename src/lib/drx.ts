/**
 * DRX integration seam — placeholder module.
 *
 * Current state: patients file refill and transfer requests on our own site
 * (src/lib/rx-requests.ts) and staff work them in the admin panel; nothing is
 * sent to DRX. The only live DRX touchpoint is the public storefront link
 * (NEXT_PUBLIC_DRX_STORE_URL) shown on the portal.
 *
 * Which DRX API: the DRX Connect key is clinic scheduling only (doctors,
 * slots, appointments) and cannot carry prescriptions. The pharmacy-side
 * DRX External API (docs: getdrx.readme.io, password-protected) can:
 *  - Base URL https://liberty.drxapp.com/external_api/v1/, key sent in the
 *    X-DRX-Key header; GET /heartbeat checks a key without touching PHI.
 *  - Refills:  POST /refill-request  { rx_numbers, patient_id and/or
 *    date_of_birth, delivery_method, comments }. Returns per-Rx errors and an
 *    estimated pickup time, which must be shown to patients as an estimate.
 *  - Linking a portal account to a DRX patient: POST /patient-match
 *    (rx_number + first_name + last_name; returns a patient only on a single
 *    exact match). There is no patient-login endpoint, so our own auth stays.
 *  - Transfers IN: no endpoint (only /transfer/out), so transfer requests stay
 *    in the staff queue permanently.
 *  - v2 (/external_api/v2) is beta and lacks refill-request, patient-match and
 *    webhooks; build on v1.
 * Keys are immutable: the pharmacy issues one with only the permissions we use
 * (heartbeat, refillrequest, patientmatch, patientprofile) and locks it to the
 * server IP. Never grant `settings`, `partnerverify`, `claim` or `pointofsale`.
 *
 * INTEGRATION PLAN (when ready):
 *  1. Set DRX_API_BASE_URL / DRX_API_KEY in the server environment (see
 *     .env.example). Develop against a DRX staging store first.
 *  2. Replace the stubs below with real calls. All DRX calls MUST go through
 *     server-side code (API routes / server components) so API keys and any
 *     PHI never reach the browser except over our own authenticated session.
 *  3. No CSP change is needed: the browser never calls DRX, so connect-src
 *     stays as is. Keep to ~1 request/second (DRX's guidance).
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
