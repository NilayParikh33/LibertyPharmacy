import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getClientIp } from "@/lib/request";
import { parseId } from "@/lib/ids";
import { setDrxPatientIdByStaff } from "@/lib/drx-link";

/**
 * Staff link a portal patient to a DRX patient id by hand (after checking who
 * they are by phone), or unlink with null. Linking is refused unless DRX's
 * date of birth for that id equals the patient's (src/lib/drx-link.ts).
 */
const schema = z.object({ drxPatientId: z.number().int().positive().max(2_147_483_647).nullable() });

const MESSAGES = {
  not_found: [404, "Patient not found."],
  dob_mismatch: [422, "That DRX patient's date of birth doesn't match this patient. Check the DRX patient ID."],
  unverifiable: [422, "DRX has no prescriptions for that patient ID, so it can't be checked. Check the ID."],
  error: [502, "Couldn't reach DRX to check that ID. Try again shortly."],
  disabled: [409, "DRX is switched off (DRX_ENABLED), so the ID can't be checked."],
} as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const patientId = parseId((await params).id);
  if (patientId === null) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the DRX patient ID (a number)." }, { status: 400 });
  }

  const result = await setDrxPatientIdByStaff(patientId, parsed.data.drxPatientId, admin.username, getClientIp(request));
  if (result === "ok") return NextResponse.json({ ok: true });
  const [status, error] = MESSAGES[result];
  return NextResponse.json({ error }, { status });
}
