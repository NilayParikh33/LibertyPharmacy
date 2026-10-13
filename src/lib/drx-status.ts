import { getDb, audit } from "./db";
import { decryptPHI, encryptPHI } from "./crypto";
import { DrxError, drxPatientProfile, isDrxEnabled, type DrxMedication } from "./drx";
import { getDrxPatientId } from "./drx-link";
import { readDrxResult } from "./drx-refills";
import type { RefillDetails } from "./rx-requests";

/**
 * DRX → website: what the pharmacy has done with each refill.
 *
 * DRX has no webhooks, so when a patient opens the portal their open refill
 * requests are checked against their prescriptions in DRX (GET /profile, the
 * same call as Medication History). For each Rx the newest fill made on or
 * after the request date is the one that request produced; its status is
 * DRX's own wording ("Waiting Bin", "Sold", "Hold", a cancelled or deleted
 * fill, …) and is stored and shown as is, with a plain-English label beside
 * it. An Rx that has disappeared from DRX, or was inactivated, is shown too.
 *
 * The request itself becomes "completed" when every Rx is picked up / sent,
 * and "cancelled" when every Rx was cancelled or deleted in DRX.
 *
 * Throttled per patient, so a patient refreshing the page doesn't call DRX
 * each time. Only money-free fields are read (status and date); copay and the
 * other financial fields DRX returns are ignored.
 */

const PHARMACY_TZ = process.env.PHARMACY_TIMEZONE || "America/Chicago";
const MIN_INTERVAL_MS = (Number(process.env.DRX_STATUS_INTERVAL_SECONDS) || 120) * 1000;
const lastChecked = new Map<number, number>();

export interface DrxFillState {
  rx: string;
  /** DRX's status word for the fill, or our note when there is no fill. */
  status: string;
  fillDate: string | null;
  /**
   * Set when a newer request asked for the same Rx. DRX reuses one fill per
   * Rx, so only the newest request follows it; this one keeps the last status
   * it really had (`status`, frozen) and points to the newer request.
   */
  replacedBy?: number;
}

/** The pharmacy-local calendar date of an instant, YYYY-MM-DD. */
function pharmacyDate(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: PHARMACY_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso)
  );
}

export const NOT_ON_FILE = "Not on file at the pharmacy";
export const RX_INACTIVE = "Prescription no longer active";

const has = (status: string, ...words: string[]) => words.some((w) => status.toLowerCase().includes(w));
export const isDone = (s: string) => has(s, "sold", "picked up", "delivered", "shipped", "complete");
export const isCancelled = (s: string) =>
  has(s, "cancel", "delete", "void", "return to stock", "returned to stock") || s === NOT_ON_FILE || s === RX_INACTIVE;

function stateFor(rx: string, med: DrxMedication | undefined, since: string): DrxFillState | null {
  if (!med) return { rx, status: NOT_ON_FILE, fillDate: null };
  const fill = med.fills.find((f) => f.fillDate && f.fillDate.slice(0, 10) >= since);
  if (fill?.status) return { rx, status: fill.status, fillDate: fill.fillDate };
  if (med.inactive) return { rx, status: RX_INACTIVE, fillDate: null };
  return null; // accepted, nothing filled yet
}

export function readFillStates(stored: string | null): DrxFillState[] {
  if (!stored) return [];
  try {
    return JSON.parse(decryptPHI(stored)) as DrxFillState[];
  } catch {
    return [];
  }
}

/** Refreshes this patient's open refill requests from DRX. Never throws. */
export async function refreshRequestStatuses(patientId: number): Promise<void> {
  if (!isDrxEnabled()) return;
  const now = Date.now();
  if ((lastChecked.get(patientId) ?? 0) > now - MIN_INTERVAL_MS) return;
  lastChecked.set(patientId, now);
  if (lastChecked.size > 5000) lastChecked.clear();

  try {
    const drxPatientId = await getDrxPatientId(patientId);
    if (drxPatientId === null) return;
    const db = await getDb();
    // Recent refills in any state: a closed newer request still replaces an
    // older open one for the same Rx.
    const rows = await db
      .prepare(
        `SELECT id, status, details, created_at, drx_fill, drx_result FROM rx_requests
         WHERE patient_id = ? AND kind = 'refill' AND drx_status IS NOT NULL
         ORDER BY id DESC LIMIT 50`
      )
      .all<{ id: number; status: string; details: string; created_at: string; drx_fill: string | null; drx_result: string | null }>(
        patientId
      );
    const open = rows.filter((r) => r.status === "new" || r.status === "in_progress");
    if (!open.length) return;

    // Only Rx numbers DRX accepted are tracked; rejected ones keep DRX's
    // reason and are with staff as a To-Do (so the request stays open).
    const acceptedOf = (r: (typeof rows)[number]) =>
      new Set(readDrxResult(r.drx_result).filter((o) => o.ok).map((o) => String(o.rxNumber)));
    // The newest request that DRX accepted each Rx for (rows are newest first).
    const newestFor = new Map<string, number>();
    for (const r of rows) for (const rx of acceptedOf(r)) if (!newestFor.has(rx)) newestFor.set(rx, r.id);

    const { medications } = await drxPatientProfile(drxPatientId);
    const byRx = new Map(medications.map((m) => [m.rxNumber, m]));

    for (const r of open) {
      let details: RefillDetails;
      try {
        details = JSON.parse(decryptPHI(r.details)) as RefillDetails;
      } catch {
        continue;
      }
      const since = pharmacyDate(r.created_at);
      const accepted = acceptedOf(r);
      const previous = readFillStates(r.drx_fill);
      const states = details.items
        .map((i) => String(Number(i.rxNumber) || i.rxNumber))
        .filter((rx) => accepted.has(rx))
        .map((rx): DrxFillState | null => {
          const newer = newestFor.get(rx);
          if (newer !== undefined && newer !== r.id) {
            const last = previous.find((p) => p.rx === rx);
            return { rx, status: last?.status ?? "Accepted", fillDate: last?.fillDate ?? null, replacedBy: newer };
          }
          return stateFor(rx, byRx.get(rx), since);
        })
        .filter((s): s is DrxFillState => s !== null);
      const json = JSON.stringify(states);
      if (json === JSON.stringify(previous)) continue;

      // Closed once every Rx is settled: picked up, cancelled/deleted, or
      // handed over to a newer request.
      const all = states.length === details.items.length && states.length > 0;
      const settled = (x: DrxFillState) => x.replacedBy !== undefined || isDone(x.status) || isCancelled(x.status);
      const status = !all || !states.every(settled)
        ? null
        : states.some((x) => x.replacedBy === undefined && isDone(x.status))
          ? "completed"
          : "cancelled";
      const at = new Date().toISOString();
      await db
        .prepare("UPDATE rx_requests SET drx_fill = ?, drx_fill_at = ? WHERE id = ?")
        .run(encryptPHI(json), at, r.id);
      if (status) {
        await db
          .prepare("UPDATE rx_requests SET status = ?, handled_by = 'DRX', updated_at = ? WHERE id = ? AND status IN ('new','in_progress')")
          .run(status, at, r.id);
      }
      await audit({
        actor: "system:drx",
        action: "drx.refill.status",
        subject: `rx_request:${r.id}`,
        outcome: "success",
        detail:
          states.map((x) => (x.replacedBy ? `replaced by #${x.replacedBy}` : x.status)).join(" | ").slice(0, 200) +
          (status ? ` → ${status}` : ""),
      });
    }
  } catch (err) {
    console.error(`drx: status refresh for patient:${patientId}: ${err instanceof DrxError ? err.message : "unexpected error"}`);
  }
}

/** Plain-English label for a DRX status, shown next to DRX's own word. */
export function friendlyFillStatus(status: string, delivery: "pickup" | "delivery" | "mail"): string {
  if (status === NOT_ON_FILE || status === RX_INACTIVE) return status;
  if (has(status, "waiting bin", "ready")) return delivery === "pickup" ? "Ready for pickup" : "Ready";
  if (isDone(status)) return delivery === "pickup" ? "Picked up" : delivery === "mail" ? "Sent" : "Delivered";
  if (isCancelled(status)) return "Cancelled by the pharmacy";
  if (has(status, "hold")) return "On hold at the pharmacy";
  return "Being prepared";
}

export const isReady = (s: string) => has(s, "waiting bin", "ready");
