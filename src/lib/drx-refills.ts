import { getDb, audit } from "./db";
import { encryptPHI, decryptPHI } from "./crypto";
import {
  DrxError,
  drxRequestRefill,
  isDrxEnabled,
  type DrxDeliveryMethod,
  type DrxRefillOutcome,
} from "./drx";
import { getDrxPatientId, linkDrxPatient } from "./drx-link";
import type { RefillDetails } from "./rx-requests";

/**
 * Forwards a stored refill request to DRX (POST /refill-request).
 *
 * Runs after the request is already saved and the patient has their answer,
 * so a DRX outage or rejection never loses a request: whatever DRX does not
 * accept stays in the staff queue exactly as before. Only when DRX accepts
 * every prescription does the request move to "in progress" on its own.
 *
 * Who the patient is comes from our own patient record, never from the form:
 *  - The account is linked to its DRX patient once (src/lib/drx-link.ts: an
 *    Rx number + their name, kept only if DRX's date of birth equals ours),
 *    here from the Rx numbers on the request if the patient hasn't linked
 *    from /portal/medications already.
 *  - Every refill also carries our stored date of birth, and DRX rejects any
 *    Rx that is not that patient's, so a patient cannot refill someone
 *    else's prescription by typing its number.
 *
 * Audit entries carry ids and counts only; the per-Rx outcome (drug names,
 * DRX messages) is stored encrypted on the request.
 */

export type DrxRefillStatus = "sent" | "partial" | "rejected" | "error" | "no_match";

const DELIVERY: Record<RefillDetails["deliveryMethod"], DrxDeliveryMethod> = {
  pickup: "Pickup",
  delivery: "Delivery",
  mail: "Ship",
};

/** DRX Rx numbers are integers; anything else on our form is left for staff. */
function asDrxRxNumber(rx: string): number | null {
  const n = /^\d{1,10}$/.test(rx) ? Number(rx) : 0;
  return n > 0 ? n : null;
}

function safeDecrypt(stored: string | null): string | null {
  if (!stored) return null;
  try {
    return decryptPHI(stored);
  } catch {
    return null;
  }
}

async function record(
  requestId: number,
  status: DrxRefillStatus,
  outcomes: DrxRefillOutcome[],
  moveToInProgress: boolean
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db
    .prepare("UPDATE rx_requests SET drx_status = ?, drx_result = ?, drx_at = ? WHERE id = ?")
    .run(status, encryptPHI(JSON.stringify(outcomes)), now, requestId);
  if (moveToInProgress) {
    // Only from "new": if staff already picked it up or closed it, theirs wins.
    await db
      .prepare(
        "UPDATE rx_requests SET status = 'in_progress', handled_by = 'DRX', updated_at = ? WHERE id = ? AND status = 'new'"
      )
      .run(now, requestId);
  }
  await audit({
    actor: "system:drx",
    action: "drx.refill.forward",
    subject: `rx_request:${requestId}`,
    outcome: status === "sent" ? "success" : "failure",
    detail: `drx_status=${status} accepted=${outcomes.filter((o) => o.ok).length} rejected=${
      outcomes.filter((o) => !o.ok).length
    }`,
  });
}

/**
 * Sends refill request `requestId` to DRX and records the outcome on it.
 * Never throws: any failure is recorded and the request stays with staff.
 * Does nothing unless DRX_ENABLED is on.
 */
export async function forwardRefillToDrx(requestId: number): Promise<DrxRefillStatus | "disabled" | "skipped"> {
  if (!isDrxEnabled()) return "disabled";
  const db = await getDb();

  const row = await db
    .prepare(
      `SELECT r.kind, r.details, r.drx_status, r.drx_result, p.patient_id, p.date_of_birth
       FROM rx_requests r JOIN patients p ON p.patient_id = r.patient_id WHERE r.id = ?`
    )
    .get<{
      kind: string;
      details: string;
      drx_status: string | null;
      drx_result: string | null;
      patient_id: number;
      date_of_birth: string;
    }>(requestId);
  // Transfers have no DRX endpoint; a request already forwarded is not sent twice.
  if (!row || row.kind !== "refill" || row.drx_status === "sent") return "skipped";

  let details: RefillDetails;
  const dateOfBirth = safeDecrypt(row.date_of_birth);
  try {
    details = JSON.parse(decryptPHI(row.details)) as RefillDetails;
  } catch {
    await record(requestId, "error", [], false);
    return "error";
  }
  if (!dateOfBirth) {
    await record(requestId, "error", [], false);
    return "error";
  }

  // On a resend, prescriptions DRX already accepted are kept as they are and
  // not sent again: a second /refill-request for them would queue a second fill.
  const acceptedBefore = readDrxResult(row.drx_result).filter((o) => o.ok);
  const alreadyAccepted = new Set(acceptedBefore.map((o) => o.rxNumber));
  const numeric = details.items
    .filter((i) => !alreadyAccepted.has(String(asDrxRxNumber(i.rxNumber) ?? i.rxNumber)))
    .map((i) => ({ rx: i.rxNumber, drx: asDrxRxNumber(i.rxNumber) }));
  const sendable = numeric.filter((n): n is { rx: string; drx: number } => n.drx !== null);
  const notSent: DrxRefillOutcome[] = numeric
    .filter((n) => n.drx === null)
    .map((n) => ({ rxNumber: n.rx, ok: false, message: "Not a DRX Rx number; left for staff" }));
  if (sendable.length === 0) {
    const status: DrxRefillStatus = acceptedBefore.length > 0 ? "partial" : "rejected";
    await record(requestId, status, [...acceptedBefore, ...notSent], false);
    return status;
  }

  try {
    // Link the account to its DRX patient once, verified by date of birth.
    let drxPatientId = await getDrxPatientId(row.patient_id);
    if (drxPatientId === null) {
      for (const { rx } of sendable) {
        const linked = await linkDrxPatient(row.patient_id, rx, "system:drx");
        if (linked === "error") throw new DrxError(0, "patient link failed");
        if (linked === "linked" || linked === "already_linked") break;
      }
      drxPatientId = await getDrxPatientId(row.patient_id);
      if (drxPatientId === null) {
        // DRX's date-of-birth check still protects the refill, but a name
        // mismatch is worth a human look rather than a blind send.
        await record(requestId, "no_match", [...acceptedBefore, ...notSent], false);
        return "no_match";
      }
    }

    const outcomes = await drxRequestRefill({
      rxNumbers: sendable.map((s) => s.drx),
      dateOfBirth,
      drxPatientId,
      deliveryMethod: DELIVERY[details.deliveryMethod] ?? "Pickup",
      comments: details.note ? `Website request #${requestId}: ${details.note}` : `Website request #${requestId}`,
    });
    const all = [...acceptedBefore, ...outcomes, ...notSent];
    const accepted = all.filter((o) => o.ok).length;
    const status: DrxRefillStatus = accepted === 0 ? "rejected" : accepted === all.length ? "sent" : "partial";
    await record(requestId, status, all, status === "sent");
    return status;
  } catch (err) {
    const reason = err instanceof DrxError ? err.message : "unexpected error";
    console.error(`drx: refill forward failed for rx_request:${requestId}: ${reason}`);
    await record(requestId, "error", [...acceptedBefore, ...notSent, { rxNumber: "-", ok: false, message: reason }], false);
    return "error";
  }
}

/** The stored DRX outcome for a request, decrypted; [] when absent or unreadable. */
export function readDrxResult(stored: string | null): DrxRefillOutcome[] {
  const plain = safeDecrypt(stored);
  if (!plain) return [];
  try {
    return JSON.parse(plain) as DrxRefillOutcome[];
  } catch {
    return [];
  }
}
