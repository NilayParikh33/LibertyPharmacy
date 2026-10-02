import { getDb, audit } from "./db";
import { decryptPHI, decryptMaybePlaintext } from "./crypto";
import { DrxError, drxCreateTodo, drxTodoDone, isDrxEnabled, type DrxRefillOutcome } from "./drx";
import { forwardRefillToDrx, readDrxResult } from "./drx-refills";
import type { RefillDetails, TransferDetails } from "./rx-requests";

/**
 * Hands website work to pharmacy staff inside DRX, as DRX To-Dos, because
 * staff work only in DRX. Anything that needs a person becomes a To-Do:
 *  - every transfer request (DRX has no transfer-in endpoint);
 *  - every refill DRX did not fully accept (rejected, partly accepted, no
 *    matching DRX patient, or DRX unreachable);
 *  - every contact-form message.
 * When staff tick the To-Do done in DRX, the request shows "Completed" to the
 * patient here.
 *
 * Runs in the background (`syncDrxTodosSoon`), after the patient already has
 * their answer, and retries: a request is stored first, so DRX being down only
 * delays the To-Do. The admin panel remains as a developer's backup view.
 *
 * To-Do notes carry PHI (names, dates of birth, medications): DRX is under
 * the BAA. Nothing from them goes to logs or the audit trail, which carry ids
 * and outcomes only.
 */

const TAGS = ["Website"];
/** Give up creating a To-Do after this many failures (then: admin backup only). */
const MAX_ATTEMPTS = 20;
/** Refills whose DRX forward never ran (e.g. a restart mid-request) are retried after this... */
const STALE_FORWARD_MS = 2 * 60 * 1000;
/** ...but only recent ones: switching DRX on must not send weeks-old refills. */
const FORWARD_WINDOW_MS = 24 * 60 * 60 * 1000;
const BATCH = 25;

/** DRX wants pharmacy-local wall-clock times. */
const PHARMACY_TZ = process.env.PHARMACY_TIMEZONE || "America/Chicago";

function pharmacyNow(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: PHARMACY_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: PHARMACY_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function dec(stored: string | null): string {
  if (!stored) return "";
  try {
    return decryptPHI(stored);
  } catch {
    return "[unreadable]";
  }
}

const DELIVERY: Record<string, string> = { pickup: "Pick up", delivery: "Local delivery", mail: "Mail" };

// ---------------------------------------------------------------------------
// Building the To-Do text
// ---------------------------------------------------------------------------

interface RxRow {
  id: number;
  kind: "refill" | "transfer";
  details: string;
  drx_status: string | null;
  drx_result: string | null;
  created_at: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  cell_phone: string;
  email: string;
  drx_patient_id: number | null;
}

function rxTodo(r: RxRow): { action: string; note: string; drxPatientId?: number } {
  const lines: string[] = [];
  const who = `${dec(r.first_name)} ${dec(r.last_name)}`.trim();
  lines.push(`Sent from the website ${formatWhen(r.created_at)} (request #${r.id}).`);
  lines.push(`Patient: ${who} · DOB ${dec(r.date_of_birth)} · Cell ${dec(r.cell_phone)} · ${dec(r.email)}`);
  lines.push(
    r.drx_patient_id !== null
      ? `DRX patient #${r.drx_patient_id} (linked).`
      : "Not linked to a DRX patient yet: may be a new patient, check by name and DOB."
  );

  let details: RefillDetails | TransferDetails | null = null;
  try {
    details = JSON.parse(decryptPHI(r.details));
  } catch {
    lines.push("The request details could not be read. Please call the patient.");
  }

  let action: string;
  if (r.kind === "transfer") {
    action = `Website: transfer in for ${who} (#${r.id})`;
    const t = details as TransferDetails | null;
    if (t) {
      lines.push(
        `Transfer in from: ${t.fromPharmacyName}${t.fromPharmacyCity ? `, ${t.fromPharmacyCity}` : ""} · ${t.fromPharmacyPhone}`
      );
      lines.push(`Medications: ${t.medications}`);
      if (t.note) lines.push(`Patient note: ${t.note}`);
      lines.push("The patient authorized us to contact this pharmacy.");
    }
  } else {
    const f = details as RefillDetails | null;
    const reason: Record<string, string> = {
      partial: "DRX accepted only some of these",
      rejected: "DRX did not accept these",
      no_match: "no matching DRX patient",
      error: "DRX could not be reached",
    };
    action = `Website: refill needs review for ${who} (#${r.id})`;
    lines.push(`Why this needs a person: ${reason[r.drx_status ?? ""] ?? "needs review"}.`);
    if (f) {
      lines.push(`Delivery: ${DELIVERY[f.deliveryMethod] ?? f.deliveryMethod}`);
      const outcome = new Map<string, DrxRefillOutcome>(readDrxResult(r.drx_result).map((o) => [o.rxNumber, o]));
      lines.push("Prescriptions:");
      for (const i of f.items) {
        const o = outcome.get(String(Number(i.rxNumber))) ?? outcome.get(i.rxNumber);
        const name = o?.itemName || i.drugName;
        lines.push(
          `  - Rx ${i.rxNumber}${name ? ` (${name})` : ""}: ${o ? (o.ok ? `accepted by DRX: ${o.message}` : o.message) : "not processed by DRX"}`
        );
      }
      if (f.note) lines.push(`Patient note: ${f.note}`);
    }
  }
  return { action, note: lines.join("\n"), ...(r.drx_patient_id !== null ? { drxPatientId: r.drx_patient_id } : {}) };
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

async function retryForwards(): Promise<void> {
  const db = await getDb();
  const staleBefore = new Date(Date.now() - STALE_FORWARD_MS).toISOString();
  const notBefore = new Date(Date.now() - FORWARD_WINDOW_MS).toISOString();
  const rows = await db
    .prepare(
      `SELECT id FROM rx_requests
       WHERE kind = 'refill' AND drx_todo_id IS NULL AND status IN ('new','in_progress')
         AND (drx_status = 'error' OR (drx_status IS NULL AND created_at < ?))
         AND created_at > ? AND drx_todo_attempts < ?
       ORDER BY id LIMIT ?`
    )
    .all<{ id: number }>(staleBefore, notBefore, MAX_ATTEMPTS, BATCH);
  for (const { id } of rows) await forwardRefillToDrx(id);
}

async function createRxTodos(): Promise<void> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT r.id, r.kind, r.details, r.drx_status, r.drx_result, r.created_at,
              p.first_name, p.last_name, p.date_of_birth, p.cell_phone, p.email, p.drx_patient_id
       FROM rx_requests r JOIN patients p ON p.patient_id = r.patient_id
       WHERE r.drx_todo_id IS NULL AND r.status IN ('new','in_progress') AND r.drx_todo_attempts < ?
         AND (r.kind = 'transfer' OR r.drx_status IN ('partial','rejected','no_match','error'))
       ORDER BY r.id LIMIT ?`
    )
    .all<RxRow>(MAX_ATTEMPTS, BATCH);

  for (const r of rows) {
    try {
      const todo = rxTodo(r);
      const todoId = await drxCreateTodo({ ...todo, dueAt: pharmacyNow(), tags: TAGS });
      await db.prepare("UPDATE rx_requests SET drx_todo_id = ? WHERE id = ? AND drx_todo_id IS NULL").run(todoId, r.id);
      await audit({ actor: "system:drx", action: "drx.todo.create", subject: `rx_request:${r.id}`, outcome: "success", detail: `kind=${r.kind}` });
    } catch (err) {
      await db.prepare("UPDATE rx_requests SET drx_todo_attempts = drx_todo_attempts + 1 WHERE id = ?").run(r.id);
      const reason = err instanceof DrxError ? err.message : "unexpected error";
      console.error(`drx: to-do for rx_request:${r.id} failed: ${reason}`);
      await audit({ actor: "system:drx", action: "drx.todo.create", subject: `rx_request:${r.id}`, outcome: "failure", detail: reason.slice(0, 120) });
    }
  }
}

async function createContactTodos(): Promise<void> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT id, first_name, last_name, email, phone, subject, message, created_at FROM contact_messages
       WHERE drx_todo_id IS NULL AND status = 'new' AND drx_todo_attempts < ? ORDER BY id LIMIT ?`
    )
    .all<{
      id: number;
      first_name: string;
      last_name: string;
      email: string;
      phone: string | null;
      subject: string;
      message: string;
      created_at: string;
    }>(MAX_ATTEMPTS, BATCH);

  for (const m of rows) {
    try {
      const name = `${decryptMaybePlaintext(m.first_name)} ${decryptMaybePlaintext(m.last_name)}`.trim();
      const subject = decryptMaybePlaintext(m.subject);
      const phone = m.phone ? decryptMaybePlaintext(m.phone) : "";
      const note = [
        `Contact form message from the website, ${formatWhen(m.created_at)} (message #${m.id}).`,
        `From: ${name} · ${decryptMaybePlaintext(m.email)}${phone ? ` · ${phone}` : ""}`,
        `Subject: ${subject}`,
        "",
        decryptMaybePlaintext(m.message),
        "",
        "Reply by phone or from the pharmacy's email; the website address is no-reply.",
      ].join("\n");
      const todoId = await drxCreateTodo({
        action: `Website message from ${name}: ${subject}`,
        note,
        dueAt: pharmacyNow(),
        tags: TAGS,
      });
      await db.prepare("UPDATE contact_messages SET drx_todo_id = ? WHERE id = ? AND drx_todo_id IS NULL").run(todoId, m.id);
      await audit({ actor: "system:drx", action: "drx.todo.create", subject: `contact_message:${m.id}`, outcome: "success" });
    } catch (err) {
      await db.prepare("UPDATE contact_messages SET drx_todo_attempts = drx_todo_attempts + 1 WHERE id = ?").run(m.id);
      const reason = err instanceof DrxError ? err.message : "unexpected error";
      console.error(`drx: to-do for contact_message:${m.id} failed: ${reason}`);
      await audit({ actor: "system:drx", action: "drx.todo.create", subject: `contact_message:${m.id}`, outcome: "failure", detail: reason.slice(0, 120) });
    }
  }
}

/** Requests whose To-Do staff ticked done in DRX become "completed" here. */
async function pullCompletions(): Promise<void> {
  const db = await getDb();
  const rows = await db
    .prepare(
      `SELECT id, drx_todo_id FROM rx_requests
       WHERE drx_todo_id IS NOT NULL AND status IN ('new','in_progress') ORDER BY id LIMIT 50`
    )
    .all<{ id: number; drx_todo_id: number }>();
  for (const r of rows) {
    try {
      const todo = await drxTodoDone(r.drx_todo_id);
      if (todo?.done) {
        await db
          .prepare(
            "UPDATE rx_requests SET status = 'completed', handled_by = 'DRX', updated_at = ? WHERE id = ? AND status IN ('new','in_progress')"
          )
          .run(new Date().toISOString(), r.id);
        await audit({ actor: "system:drx", action: "drx.todo.completed", subject: `rx_request:${r.id}`, outcome: "success" });
      }
    } catch (err) {
      console.error(`drx: to-do status for rx_request:${r.id}: ${err instanceof DrxError ? err.message : "unexpected error"}`);
      return; // DRX unreachable: try the rest next time
    }
  }
}

let running: Promise<void> | null = null;
let lastRunAt = 0;

/**
 * Runs one sync pass in the background unless one is already running or the
 * last pass was under `minIntervalMs` ago. Never throws. One pass at a time
 * per process, so two triggers can't create the same To-Do twice (the app
 * runs as a single instance; see SECURITY-RISK-ANALYSIS.md T-03).
 */
export function syncDrxTodosSoon(minIntervalMs = 0): Promise<void> {
  if (!isDrxEnabled()) return Promise.resolve();
  if (running) return running;
  if (Date.now() - lastRunAt < minIntervalMs) return Promise.resolve();
  lastRunAt = Date.now();
  running = (async () => {
    try {
      await retryForwards();
      await createRxTodos();
      await createContactTodos();
      await pullCompletions();
    } catch (err) {
      console.error("drx: to-do sync failed", err instanceof Error ? err.message : err);
    } finally {
      running = null;
    }
  })();
  return running;
}
