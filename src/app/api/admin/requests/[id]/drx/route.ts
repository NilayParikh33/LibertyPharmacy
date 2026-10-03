import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/db";
import { getClientIp } from "@/lib/request";
import { parseId } from "@/lib/ids";
import { isDrxEnabled } from "@/lib/drx";
import { forwardRefillToDrx } from "@/lib/drx-refills";

/**
 * Staff resend a refill request to DRX, e.g. after DRX was down or the
 * patient's DRX record was fixed. A request DRX already fully accepted is
 * not sent again (forwardRefillToDrx skips it).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!isDrxEnabled()) {
    return NextResponse.json({ error: "Sending to DRX is switched off." }, { status: 409 });
  }

  const result = await forwardRefillToDrx(id);
  await audit({
    actor: `admin:${admin.username}`,
    action: "admin.rx_request.drx_resend",
    subject: `rx_request:${id}`,
    outcome: result === "sent" ? "success" : "failure",
    detail: `result=${result}`,
    ip: getClientIp(request),
  });
  if (result === "skipped") {
    return NextResponse.json({ error: "Nothing to send: not a refill, or DRX already accepted it." }, { status: 409 });
  }
  return NextResponse.json({ ok: true, result });
}
