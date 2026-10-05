import { getDb, audit } from "./db";
import { decryptPHI } from "./crypto";
import { DrxError, drxPatientProfile, drxPrescriptionOwner, isDrxEnabled } from "./drx";
import { sendRecordConnectedEmail } from "./mail";

/**
 * Linking a portal patient to their DRX patient record (patients.drx_patient_id).
 *
 * There is no shared id between this site and DRX, and DRX has no patient
 * login, so the link is made from what the patient knows and DRX holds:
 *  - an Rx number from one of their labels says WHICH record
 *    (GET /prescription/{rx} tells us the patient on it);
 *  - the date of birth on their verified portal account must equal DRX's
 *    exactly: this is the real check;
 *  - the name is only a light check: at least one word in common, in any
 *    order or case, so "Kush Chaudhary" matches "CHAUDHARY, VIJAY KUSH".
 * The name check stays because Rx numbers are sequential: with date of birth
 * alone, someone could register with a common birth date and try numbers.
 * Needing one name word as well makes blind guessing hopeless without getting
 * in a real patient's way.
 *
 * Callers rate-limit attempts (src/app/api/portal/drx-link) and must not tell
 * the patient which part failed: "no such Rx" vs "wrong date of birth" would
 * be an oracle for guessing.
 */

export type LinkResult = "linked" | "already_linked" | "no_match" | "error" | "disabled";

/** Lower-case name words, ignoring punctuation and accents: "O'Brien-Smith" -> obrien, smith. */
function nameWords(...parts: string[]): Set<string> {
  return new Set(
    parts
      .join(" ")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/'/g, "")
      .split(/[^\p{L}]+/u)
      .filter((w) => w.length >= 2)
  );
}

/** At least one name word in common, in any order: the light name check. */
export function namesOverlap(oursFirst: string, oursLast: string, theirsFirst: string, theirsLast: string): boolean {
  const ours = nameWords(oursFirst, oursLast);
  for (const w of nameWords(theirsFirst, theirsLast)) if (ours.has(w)) return true;
  return false;
}

/** DRX sends MM/DD/YYYY or YYYY-MM-DD depending on the endpoint; ours is YYYY-MM-DD. */
export function sameDate(ours: string, theirs: string | null | undefined): boolean {
  if (!theirs) return false;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(theirs.trim());
  const normalized = m ? `${m[3]}-${m[1]}-${m[2]}` : theirs.trim().slice(0, 10);
  return normalized === ours;
}

function safeDecrypt(stored: string | null): string | null {
  if (!stored) return null;
  try {
    return decryptPHI(stored);
  } catch {
    return null;
  }
}

export async function getDrxPatientId(patientId: number): Promise<number | null> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT drx_patient_id FROM patients WHERE patient_id = ?")
    .get<{ drx_patient_id: number | null }>(patientId);
  return row?.drx_patient_id ?? null;
}

/**
 * Tries to link `patientId` using one of their Rx numbers. Never throws.
 * `actor` is who asked (for the audit trail): the patient, or system:drx.
 */
export async function linkDrxPatient(patientId: number, rxNumber: string, actor: string): Promise<LinkResult> {
  if (!isDrxEnabled()) return "disabled";
  const db = await getDb();
  const row = await db
    .prepare("SELECT first_name, last_name, date_of_birth, drx_patient_id FROM patients WHERE patient_id = ?")
    .get<{ first_name: string; last_name: string; date_of_birth: string; drx_patient_id: number | null }>(patientId);
  if (!row) return "error";
  if (row.drx_patient_id !== null) return "already_linked";

  const firstName = safeDecrypt(row.first_name);
  const lastName = safeDecrypt(row.last_name);
  const dateOfBirth = safeDecrypt(row.date_of_birth);
  if (!firstName || !lastName || !dateOfBirth || !/^\d{1,10}$/.test(rxNumber.trim()) || Number(rxNumber) <= 0) {
    await auditLink(actor, patientId, "no_match");
    return "no_match";
  }

  try {
    const owner = await drxPrescriptionOwner(Number(rxNumber.trim()));
    if (
      !owner ||
      !sameDate(dateOfBirth, owner.dateOfBirth) ||
      !namesOverlap(firstName, lastName, owner.firstName, owner.lastName)
    ) {
      await auditLink(actor, patientId, "no_match");
      return "no_match";
    }
    const match = { drxPatientId: owner.drxPatientId };
    const { changes } = await db
      .prepare("UPDATE patients SET drx_patient_id = ? WHERE patient_id = ? AND drx_patient_id IS NULL")
      .run(match.drxPatientId, patientId);
    if (changes > 0) await onLinked(patientId, !actor.startsWith("account:"));
    await auditLink(actor, patientId, "linked");
    return "linked";
  } catch (err) {
    console.error(`drx: link failed for patient:${patientId}: ${err instanceof DrxError ? err.message : "unexpected error"}`);
    await auditLink(actor, patientId, "error");
    return "error";
  }
}

/**
 * Bookkeeping once a patient is linked. When someone other than the patient
 * made the link (staff, or the system during a refill) the patient is told:
 * a one-time portal banner plus a content-free email. A patient who linked
 * themselves is looking at the result already, so gets neither.
 */
async function onLinked(patientId: number, notifyPatient: boolean): Promise<void> {
  const db = await getDb();
  await db
    .prepare("UPDATE patients SET drx_linked_at = ?, drx_ready_notice = ? WHERE patient_id = ?")
    .run(new Date().toISOString(), notifyPatient ? 1 : 0, patientId);
  if (!notifyPatient) return;
  const account = await db
    .prepare("SELECT a.email FROM accounts a JOIN patients p ON p.account_id = a.id WHERE p.patient_id = ?")
    .get<{ email: string }>(patientId);
  if (!account) return;
  const portalUrl = `${process.env.APP_BASE_URL ?? "https://rxlibertypharmacy.com"}/portal/medications`;
  // Best effort: the portal banner is the reliable path; mail must not undo a link.
  await sendRecordConnectedEmail(account.email, portalUrl).catch((err) =>
    console.error("drx: record-connected email failed", err instanceof Error ? err.message : err)
  );
}

/**
 * The one-time "you can refill online now" notice for the portal, cleared as
 * it is read so it shows once.
 */
export async function takeDrxReadyNotice(patientId: number): Promise<boolean> {
  const db = await getDb();
  const { changes } = await db
    .prepare("UPDATE patients SET drx_ready_notice = 0 WHERE patient_id = ? AND drx_ready_notice = 1")
    .run(patientId);
  return changes > 0;
}

async function auditLink(actor: string, patientId: number, result: LinkResult) {
  await audit({
    actor,
    action: "drx.patient.link",
    subject: `patient:${patientId}`,
    outcome: result === "linked" ? "success" : "failure",
    detail: `result=${result}`,
  });
}

/**
 * Staff link (or unlink, with null) a patient by DRX patient id, after
 * checking who the patient is by phone. The id is only accepted if DRX's date
 * of birth for it equals ours, so a typo cannot show this patient someone
 * else's medications.
 */
export async function setDrxPatientIdByStaff(
  patientId: number,
  drxPatientId: number | null,
  adminUsername: string,
  ip?: string
): Promise<"ok" | "not_found" | "dob_mismatch" | "unverifiable" | "error" | "disabled"> {
  const db = await getDb();
  const row = await db
    .prepare("SELECT date_of_birth FROM patients WHERE patient_id = ?")
    .get<{ date_of_birth: string }>(patientId);
  if (!row) return "not_found";

  let outcome: "ok" | "dob_mismatch" | "unverifiable" | "error" | "disabled" = "ok";
  if (drxPatientId !== null) {
    if (!isDrxEnabled()) {
      outcome = "disabled";
    } else {
      const dateOfBirth = safeDecrypt(row.date_of_birth);
      try {
        const profile = await drxPatientProfile(drxPatientId);
        if (!profile.dateOfBirth) outcome = "unverifiable";
        else if (!dateOfBirth || !sameDate(dateOfBirth, profile.dateOfBirth)) outcome = "dob_mismatch";
      } catch (err) {
        console.error(`drx: staff link check failed: ${err instanceof DrxError ? err.message : "unexpected error"}`);
        outcome = "error";
      }
    }
  }
  if (outcome === "ok") {
    const before = await db
      .prepare("SELECT drx_patient_id FROM patients WHERE patient_id = ?")
      .get<{ drx_patient_id: number | null }>(patientId);
    await db.prepare("UPDATE patients SET drx_patient_id = ? WHERE patient_id = ?").run(drxPatientId, patientId);
    if (drxPatientId === null) {
      await db.prepare("UPDATE patients SET drx_linked_at = NULL, drx_ready_notice = 0 WHERE patient_id = ?").run(patientId);
    } else if (before?.drx_patient_id !== drxPatientId) {
      await onLinked(patientId, true);
    }
  }
  await audit({
    actor: `admin:${adminUsername}`,
    action: drxPatientId === null ? "admin.drx.unlink" : "admin.drx.link",
    subject: `patient:${patientId}`,
    outcome: outcome === "ok" ? "success" : "failure",
    detail: `result=${outcome}`,
    ip,
  });
  return outcome;
}
