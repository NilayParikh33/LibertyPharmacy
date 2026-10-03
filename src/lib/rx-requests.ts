import { getDb, audit } from "./db";
import { encryptPHI, decryptPHI } from "./crypto";
import { readDrxResult, type DrxRefillStatus } from "./drx-refills";
import type { DrxRefillOutcome } from "./drx";

/**
 * Refill and prescription-transfer requests.
 *
 * Patients submit these from the portal (src/app/api/portal/requests); the
 * pharmacy works them from the admin panel (src/app/admin/(protected)/requests).
 * Staff process each request in their dispensing system and mark it done
 * here. When DRX is switched on, the portal route also forwards refills to
 * DRX once they are stored (src/lib/drx-refills.ts) and the outcome is kept
 * on the request; anything DRX did not accept stays with staff. Transfers have
 * no DRX endpoint and always stay in the staff queue.
 *
 * PHI handling (see HIPAA-COMPLIANCE.md):
 *  - Everything the patient typed is one encrypted JSON blob; see the
 *    rx_requests table in src/lib/db.ts.
 *  - audit_log entries carry ids, the kind and the status only, never what the
 *    request contained.
 *  - The identity of the requester always comes from the signed-in session,
 *    never from the request body, so one patient cannot file or read another's.
 */

export type RxKind = "refill" | "transfer";
export const RX_STATUSES = ["new", "in_progress", "completed", "cancelled"] as const;
export type RxStatus = (typeof RX_STATUSES)[number];

export interface RefillDetails {
  items: { rxNumber: string; drugName?: string }[];
  deliveryMethod: "pickup" | "delivery" | "mail";
  note?: string;
}

export interface TransferDetails {
  fromPharmacyName: string;
  fromPharmacyPhone: string;
  fromPharmacyCity?: string;
  medications: string;
  note?: string;
}

export type RxRequestInput =
  | { kind: "refill"; details: RefillDetails }
  | { kind: "transfer"; details: TransferDetails };

/**
 * Requests a patient can have waiting at once. Stops one account (or a script
 * holding a stolen session) from burying the pharmacy's queue; real use is a
 * handful at a time. Staff closing requests frees the room again.
 */
const MAX_OPEN_PER_PATIENT = 20;

/** The patient record behind a signed-in account, if it has one. */
export async function getPatientIdForAccount(accountId: number): Promise<number | null> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT patient_id FROM patients WHERE account_id = ?")
    .get<{ patient_id: number }>(accountId);
  return row?.patient_id ?? null;
}

export async function createRxRequest(
  accountId: number,
  patientId: number,
  input: RxRequestInput,
  ip?: string
): Promise<{ ok: true; id: number } | { ok: false; reason: "too_many_open" }> {
  const db = await getDb();

  const open = await db
    .prepare("SELECT COUNT(*) AS n FROM rx_requests WHERE patient_id = ? AND status IN ('new','in_progress')")
    .get<{ n: number }>(patientId);
  if ((open?.n ?? 0) >= MAX_OPEN_PER_PATIENT) {
    await audit({
      actor: `account:${accountId}`,
      action: "patient.rx_request.create",
      subject: `patient:${patientId}`,
      outcome: "failure",
      detail: "too_many_open",
      ip,
    });
    return { ok: false, reason: "too_many_open" };
  }

  const { lastInsertRowid } = await db
    .prepare("INSERT INTO rx_requests (patient_id, kind, details) VALUES (?, ?, ?) RETURNING id")
    .run(patientId, input.kind, encryptPHI(JSON.stringify(input.details)));

  await audit({
    actor: `account:${accountId}`,
    action: "patient.rx_request.create",
    subject: `rx_request:${lastInsertRowid}`,
    outcome: "success",
    detail: `kind=${input.kind}`,
    ip,
  });
  return { ok: true, id: lastInsertRowid };
}

function parseDetails(kind: RxKind, stored: string): RefillDetails | TransferDetails | null {
  try {
    const parsed = JSON.parse(decryptPHI(stored)) as RefillDetails | TransferDetails;
    return kind === "refill" || kind === "transfer" ? parsed : null;
  } catch {
    // Wrong key or damaged value: show a placeholder rather than failing the
    // whole page and hiding every other request beside it.
    return null;
  }
}

function summarize(kind: RxKind, details: RefillDetails | TransferDetails | null): string {
  if (!details) return kind === "refill" ? "Refill request" : "Transfer request";
  if (kind === "refill") {
    const items = (details as RefillDetails).items ?? [];
    return items.map((i) => i.drugName || `Rx #${i.rxNumber}`).join(", ") || "Refill request";
  }
  return `From ${(details as TransferDetails).fromPharmacyName}`;
}

export interface PatientRequestView {
  id: number;
  kind: RxKind;
  status: RxStatus;
  createdAt: string;
  summary: string;
  /** Earliest pickup estimate DRX gave, if any. Show it as an estimate only. */
  estimatedPickup: string | null;
}

/** A patient's own recent requests, newest first. */
export async function listPatientRequests(patientId: number, limit = 10): Promise<PatientRequestView[]> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT id, kind, status, details, drx_result, created_at FROM rx_requests
       WHERE patient_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`
    )
    .all<{ id: number; kind: RxKind; status: RxStatus; details: string; drx_result: string | null; created_at: string }>(
      patientId,
      limit
    );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    createdAt: r.created_at,
    summary: summarize(r.kind, parseDetails(r.kind, r.details)),
    // Only while the request is still moving: once staff close it the
    // estimate is stale.
    estimatedPickup:
      r.status === "new" || r.status === "in_progress"
        ? readDrxResult(r.drx_result)
            .map((o) => o.estimatedPickupTime)
            .filter((t): t is string => Boolean(t))
            .sort()[0] ?? null
        : null,
  }));
}

// ---------------------------------------------------------------------------
// Admin queue
// ---------------------------------------------------------------------------

export type RxQueueFilter = "open" | "completed" | "all";

export interface AdminRxRequest {
  id: number;
  kind: RxKind;
  status: RxStatus;
  createdAt: string;
  updatedAt: string;
  handledBy: string | null;
  staffNote: string;
  /** null when the stored value could not be decrypted. */
  details: RefillDetails | TransferDetails | null;
  /** Outcome of forwarding to DRX; status null when it was never tried. */
  drx: { status: DrxRefillStatus | null; at: string | null; outcomes: DrxRefillOutcome[]; todoId: number | null };
  patient: {
    id: number;
    name: string;
    dateOfBirth: string;
    cellPhone: string;
    email: string;
    deliveryMethod: string;
    /** Linked DRX patient id, or null when not linked yet. */
    drxPatientId: number | null;
  };
}

const QUEUE_WHERE: Record<RxQueueFilter, string> = {
  open: "WHERE r.status IN ('new','in_progress')",
  completed: "WHERE r.status IN ('completed','cancelled')",
  all: "",
};

/**
 * Requests for the admin queue, joined to just enough of the patient record
 * for staff to find them in their dispensing system: name, date of birth and
 * contact details. Insurance and clinical fields are not read here.
 * Open requests come oldest-first so nothing waits at the bottom of the page.
 */
export async function listRxRequestsForAdmin(filter: RxQueueFilter): Promise<AdminRxRequest[]> {
  const db = await getDb();
  const order = filter === "open" ? "ASC" : "DESC";
  const rows = await db
    .prepare(
      `SELECT r.id, r.kind, r.status, r.details, r.staff_note, r.handled_by, r.created_at, r.updated_at,
              r.drx_status, r.drx_result, r.drx_at, r.drx_todo_id,
              p.patient_id, p.first_name, p.last_name, p.date_of_birth, p.cell_phone, p.email, p.delivery_method,
              p.drx_patient_id
       FROM rx_requests r JOIN patients p ON p.patient_id = r.patient_id
       ${QUEUE_WHERE[filter]}
       ORDER BY r.created_at ${order}, r.id ${order} LIMIT 200`
    )
    .all<{
      id: number;
      kind: RxKind;
      status: RxStatus;
      details: string;
      drx_status: DrxRefillStatus | null;
      drx_result: string | null;
      drx_at: string | null;
      drx_todo_id: number | null;
      staff_note: string | null;
      handled_by: string | null;
      created_at: string;
      updated_at: string;
      patient_id: number;
      first_name: string;
      last_name: string;
      date_of_birth: string;
      cell_phone: string;
      email: string;
      delivery_method: string;
      drx_patient_id: number | null;
    }>();

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    handledBy: r.handled_by,
    staffNote: r.staff_note ? safeDecrypt(r.staff_note) : "",
    details: parseDetails(r.kind, r.details),
    drx: { status: r.drx_status, at: r.drx_at, outcomes: readDrxResult(r.drx_result), todoId: r.drx_todo_id },
    patient: {
      id: r.patient_id,
      name: `${safeDecrypt(r.first_name)} ${safeDecrypt(r.last_name)}`,
      dateOfBirth: safeDecrypt(r.date_of_birth),
      cellPhone: safeDecrypt(r.cell_phone),
      email: safeDecrypt(r.email),
      deliveryMethod: r.delivery_method,
      drxPatientId: r.drx_patient_id,
    },
  }));
}

function safeDecrypt(stored: string): string {
  try {
    return decryptPHI(stored);
  } catch {
    return "[unable to decrypt]";
  }
}

/** Requests still waiting on staff — the dashboard badge. */
export async function countOpenRxRequests(): Promise<number> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM rx_requests WHERE status IN ('new','in_progress')")
    .get<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * Updates a request's status and/or internal note. Returns false when no
 * request has that id. An empty note clears it.
 */
export async function updateRxRequest(
  id: number,
  patch: { status?: RxStatus; staffNote?: string },
  adminUsername: string
): Promise<boolean> {
  const sets: string[] = ["handled_by = ?", "updated_at = ?"];
  const params: unknown[] = [adminUsername, new Date().toISOString()];
  if (patch.status !== undefined) {
    sets.push("status = ?");
    params.push(patch.status);
  }
  if (patch.staffNote !== undefined) {
    sets.push("staff_note = ?");
    params.push(patch.staffNote.trim() ? encryptPHI(patch.staffNote.trim()) : null);
  }
  const db = await getDb();
  const { changes } = await db.prepare(`UPDATE rx_requests SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
  return changes > 0;
}
