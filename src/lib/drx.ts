/**
 * DRX External API client. Server-side only: never import this from a client
 * component, the key would end up in the browser bundle.
 *
 * Current state: patients file refill and transfer requests on our own site
 * (src/lib/rx-requests.ts) and staff work them in the admin panel. When
 * DRX_ENABLED=true (and the API URL and key are set), patient data flows to
 * and from DRX:
 *  - refill requests are forwarded (src/lib/drx-refills.ts); transfers never are
 *  - portal accounts are linked to DRX patients (src/lib/drx-link.ts)
 *  - linked patients see their medication list, read live (/portal/medications)
 * The public storefront link (NEXT_PUBLIC_DRX_STORE_URL) is separate and needs
 * no key.
 *
 * Which DRX API: the DRX Connect key is clinic scheduling only (doctors,
 * slots, appointments) and cannot carry prescriptions. The pharmacy-side
 * DRX External API (docs: getdrx.readme.io, password-protected) can:
 *  - Base URL https://liberty.drxapp.com/external_api/v1/, key sent in the
 *    X-DRX-Key header; GET /heartbeat checks a key without touching PHI.
 *  - Refills:  POST /refill-request  { rx_numbers, patient_id and/or
 *    date_of_birth, delivery_method, comments }. Returns per-Rx errors and an
 *    estimated pickup time, which must be shown to patients as an estimate.
 *  - Linking a portal account to a DRX patient: GET /prescription/{rx} gives
 *    the patient on that Rx; we require the same date of birth and one name
 *    word in common (src/lib/drx-link.ts). /patient-match is not used: it
 *    needs an exact name. There is no patient-login endpoint, so our own auth
 *    stays.
 *  - Transfers IN: no endpoint (only /transfer/out), so transfer requests stay
 *    in the staff queue permanently.
 *  - v2 (/external_api/v2) is beta and lacks refill-request, patient-match and
 *    webhooks; build on v1.
 * Keys are immutable: the pharmacy issues one with only the permissions we use
 * (heartbeat, refillrequest, prescription, patientprofile, todo) and locks it to the
 * server IP. Never grant `settings`, `partnerverify`, `claim` or `pointofsale`.
 *
 * TURNING IT ON:
 *  1. Set DRX_API_BASE_URL / DRX_API_KEY in the server environment (see
 *     .env.example). Develop against a DRX staging store first.
 *  2. Check the key from the admin panel (/admin/requests shows the result of
 *     GET /heartbeat, which carries no PHI).
 *  3. Only after a Business Associate Agreement (BAA) with DRX is confirmed,
 *     set DRX_ENABLED=true. Until then no PHI is sent or read. See
 *     HIPAA-COMPLIANCE.md.
 * No CSP change is needed: the browser never calls DRX. Volume is a handful of
 * calls per refill request, well under DRX's ~1 request/second guidance.
 *
 * Nothing here logs request or response bodies: both carry PHI. Errors are
 * reduced to a status code or a short reason before they leave this module.
 */

export const drxConfig = {
  /** Public storefront URL, e.g. https://liberty.drxrefill.com */
  storeUrl: process.env.NEXT_PUBLIC_DRX_STORE_URL ?? null,
  /** Server-side API base URL — never expose to the client. */
  apiBaseUrl: process.env.DRX_API_BASE_URL ?? null,
  /** Server-side API key — never expose to the client. */
  apiKey: process.env.DRX_API_KEY ?? null,
  /** PHI may only flow once this is exactly "true" (set it after the BAA). */
  patientDataEnabled: process.env.DRX_ENABLED === "true",
};

/**
 * DRX treats an id of 0 as "no id" and answers with a LIST (GET /prescription/0
 * returns other patients' prescriptions, GET /todo/0 the store's To-Dos), so
 * every id put into a URL must be a positive integer.
 */
function isDrxId(n: number): boolean {
  return Number.isSafeInteger(n) && n > 0;
}

/** True once the DRX storefront URL is configured. */
export function isDrxConfigured(): boolean {
  return Boolean(drxConfig.storeUrl);
}

/** URL and key are present, so a heartbeat can be tried. Says nothing about PHI. */
export function isDrxApiConfigured(): boolean {
  return Boolean(drxConfig.apiBaseUrl && drxConfig.apiKey);
}

/** Patient data may flow to and from DRX (refills, linking, medication list). */
export function isDrxEnabled(): boolean {
  return drxConfig.patientDataEnabled && isDrxApiConfigured();
}

/** A failed DRX call, with nothing from the request or response body in it. */
export class DrxError extends Error {
  constructor(
    /** HTTP status, or 0 when DRX could not be reached. */
    readonly status: number,
    reason: string
  ) {
    super(`DRX ${status || "unreachable"}: ${reason}`);
    this.name = "DrxError";
  }
}

const TIMEOUT_MS = 15_000;

function baseUrl(): string {
  const base = drxConfig.apiBaseUrl;
  if (!base || !drxConfig.apiKey) throw new DrxError(0, "DRX_API_BASE_URL / DRX_API_KEY not set");
  // The key travels in a header; refuse to send it anywhere but HTTPS.
  if (!base.startsWith("https://")) throw new DrxError(0, "DRX_API_BASE_URL must be https://");
  return base.replace(/\/+$/, "");
}

async function drxFetch<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; timeoutMs?: number }
): Promise<T> {
  const url = baseUrl() + path;
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method,
      headers: {
        "X-DRX-Key": drxConfig.apiKey!,
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(init.timeoutMs ?? TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new DrxError(0, timedOut ? "timed out" : "network error");
  }
  if (res.status === 401) throw new DrxError(401, "key rejected (wrong key, missing permission, or IP restriction)");
  if (!res.ok) throw new DrxError(res.status, "request failed");
  try {
    return (await res.json()) as T;
  } catch {
    throw new DrxError(res.status, "response was not JSON");
  }
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/** GET /heartbeat — proves the URL and key work. No PHI either way. */
export async function drxHeartbeat(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    // Short timeout: this runs while an admin page renders.
    const res = await drxFetch<{ pulse?: unknown }>("/heartbeat", { method: "GET", timeoutMs: 5_000 });
    return res && "pulse" in res ? { ok: true } : { ok: false, reason: "unexpected response" };
  } catch (err) {
    return { ok: false, reason: err instanceof DrxError ? err.message : "unknown error" };
  }
}

/**
 * GET /prescription/{rx} — who DRX has as the patient on one prescription.
 * Used only to link a portal account (src/lib/drx-link.ts); the rest of the
 * response (prescriber, drug, fills) is dropped here and never leaves this
 * function. Returns null when DRX has no such prescription.
 */
export async function drxPrescriptionOwner(rxNumber: number): Promise<{
  drxPatientId: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
} | null> {
  if (!isDrxId(rxNumber)) return null;
  let res: { prescription?: { id?: number; patient?: { id?: number; first_name?: string; last_name?: string; date_of_birth?: string | null } } };
  try {
    res = await drxFetch(`/prescription/${encodeURIComponent(String(rxNumber))}`, { method: "GET" });
  } catch (err) {
    if (err instanceof DrxError && (err.status === 404 || err.status === 400)) return null;
    throw err;
  }
  const p = res?.prescription?.patient;
  if (!p || typeof p.id !== "number") return null;
  return {
    drxPatientId: p.id,
    firstName: p.first_name ?? "",
    lastName: p.last_name ?? "",
    dateOfBirth: p.date_of_birth ?? null,
  };
}

export type DrxDeliveryMethod = "Pickup" | "Delivery" | "Ship";

export interface DrxRefillOutcome {
  rxNumber: string;
  ok: boolean;
  /** DRX's message, e.g. "Rx is expired" or "Sent to queue for adjudication". */
  message: string;
  itemName?: string;
  /** Store-set estimate. Must be shown to patients as an estimate only. */
  estimatedPickupTime?: string;
}

/**
 * POST /refill-request — one patient at a time. DRX checks every Rx against
 * the patient id and date of birth we send, so a wrong or someone else's Rx
 * number comes back as an error for that Rx rather than being filled.
 */
export async function drxRequestRefill(input: {
  rxNumbers: number[];
  dateOfBirth: string;
  drxPatientId?: number;
  deliveryMethod: DrxDeliveryMethod;
  comments?: string;
}): Promise<DrxRefillOutcome[]> {
  type Entry = { success?: boolean; message?: string; item_name?: string; rx_id?: number; estimated_pickup_time?: string };
  const res = await drxFetch<{ success?: boolean; processed?: Entry[]; errors?: Entry[] }>("/refill-request", {
    method: "POST",
    body: {
      rx_numbers: input.rxNumbers,
      date_of_birth: input.dateOfBirth,
      delivery_method: input.deliveryMethod,
      ...(input.drxPatientId !== undefined ? { patient_id: input.drxPatientId } : {}),
      ...(input.comments ? { comments: input.comments } : {}),
    },
  });
  const toOutcome = (e: Entry, ok: boolean): DrxRefillOutcome => ({
    rxNumber: e.rx_id !== undefined ? String(e.rx_id) : "?",
    ok,
    message: typeof e.message === "string" ? e.message.slice(0, 200) : ok ? "Sent" : "Not accepted",
    ...(e.item_name ? { itemName: String(e.item_name).slice(0, 120) } : {}),
    ...(ok && e.estimated_pickup_time ? { estimatedPickupTime: String(e.estimated_pickup_time) } : {}),
  });
  return [...(res?.processed ?? []).map((e) => toOutcome(e, true)), ...(res?.errors ?? []).map((e) => toOutcome(e, false))];
}

/**
 * One prescription as the portal shows it. Deliberately narrow (minimum
 * necessary): no copay, insurance, NDC or pharmacy-internal fields, even
 * though DRX sends them.
 */
export interface DrxMedication {
  /** DRX prescription id: the Rx number on the label, and what refills use. */
  rxNumber: string;
  drugName: string | null;
  directions: string | null;
  prescriber: string | null;
  writtenDate: string | null;
  expiresDate: string | null;
  /** Total quantity left on the Rx (DRX has no "refills remaining"). */
  quantityRemaining: number | null;
  lastFillDate: string | null;
  lastFillStatus: string | null;
  daysSupply: number | null;
  inactive: boolean;
}

interface DrxProfileFill {
  fill_date?: string | null;
  fill_number?: number;
  status?: string | null;
  days_supply?: number | null;
  prescription_fill_dis_items?: { item_name?: string | null }[];
}
interface DrxProfilePrescription {
  id: number;
  patient?: { id?: number; dob?: string | null };
  sig?: string | null;
  sig_translated?: string | null;
  doctor_name?: string | null;
  date_written?: string | null;
  date_expires?: string | null;
  total_qty_remaining?: number | null;
  inactivated?: boolean;
  prescription_fills?: DrxProfileFill[];
}

const PROFILE_PAGE = 100;
const PROFILE_MAX = 500;

/**
 * GET /profile/{patient_id} — the patient's prescriptions, newest first.
 * Every prescription is checked to belong to `drxPatientId`; anything else is
 * dropped, so a DRX-side surprise can never show one patient another's Rx.
 * Also returns the date of birth DRX holds, for link verification.
 */
export async function drxPatientProfile(
  drxPatientId: number
): Promise<{ dateOfBirth: string | null; medications: DrxMedication[] }> {
  if (!isDrxId(drxPatientId)) return { dateOfBirth: null, medications: [] };
  const all: DrxProfilePrescription[] = [];
  for (let offset = 0; offset < PROFILE_MAX; offset += PROFILE_PAGE) {
    const res = await drxFetch<{ prescriptions?: DrxProfilePrescription[]; total?: number }>(
      `/profile/${encodeURIComponent(String(drxPatientId))}?limit=${PROFILE_PAGE}&offset=${offset}`,
      { method: "GET" }
    );
    const page = res?.prescriptions ?? [];
    all.push(...page);
    if (page.length < PROFILE_PAGE || (typeof res?.total === "number" && all.length >= res.total)) break;
  }

  const own = all.filter((p) => typeof p.id === "number" && p.patient?.id === drxPatientId);
  const dateOfBirth = own.find((p) => p.patient?.dob)?.patient?.dob ?? null;
  const medications = own.map((p): DrxMedication => {
    const fills = [...(p.prescription_fills ?? [])].sort((a, b) =>
      (b.fill_date ?? "").localeCompare(a.fill_date ?? "")
    );
    const last = fills[0];
    const drugName = fills.flatMap((f) => f.prescription_fill_dis_items ?? []).find((i) => i.item_name)?.item_name ?? null;
    return {
      rxNumber: String(p.id),
      drugName,
      directions: p.sig_translated || p.sig || null,
      prescriber: p.doctor_name ?? null,
      writtenDate: p.date_written ?? null,
      expiresDate: p.date_expires ?? null,
      quantityRemaining: typeof p.total_qty_remaining === "number" ? p.total_qty_remaining : null,
      lastFillDate: last?.fill_date ?? null,
      lastFillStatus: last?.status ?? null,
      daysSupply: last?.days_supply ?? null,
      inactive: Boolean(p.inactivated),
    };
  });
  return { dateOfBirth, medications };
}

/**
 * POST /todo — a to-do in DRX's own task list, which is where pharmacy staff
 * work. Used for everything from the website that needs a person
 * (src/lib/drx-todos.ts). `note` may carry PHI: DRX is under the BAA.
 */
export async function drxCreateTodo(input: {
  action: string;
  note: string;
  /** Pharmacy-local wall-clock time, "YYYY-MM-DDTHH:MM:SS". */
  dueAt: string;
  drxPatientId?: number;
  tags?: string[];
}): Promise<number> {
  const res = await drxFetch<{ success?: boolean; todo_id?: number }>("/todo", {
    method: "POST",
    body: {
      todo: {
        action: input.action.slice(0, 200),
        due_at: input.dueAt,
        note: input.note,
        ...(input.drxPatientId !== undefined ? { patient_id: input.drxPatientId } : {}),
        ...(input.tags?.length ? { tags: input.tags } : {}),
      },
    },
  });
  if (typeof res?.todo_id !== "number") throw new DrxError(200, "todo not created");
  return res.todo_id;
}

/** GET /todo/{id} — whether staff have ticked it done in DRX. null if it was deleted. */
export async function drxTodoDone(todoId: number): Promise<{ done: boolean } | null> {
  if (!isDrxId(todoId)) return null;
  try {
    const res = await drxFetch<{ todo?: { completed_on?: string | null } }>(
      `/todo/${encodeURIComponent(String(todoId))}`,
      { method: "GET" }
    );
    if (!res?.todo) return null;
    return { done: Boolean(res.todo.completed_on) };
  } catch (err) {
    if (err instanceof DrxError && err.status === 404) return null;
    throw err;
  }
}
