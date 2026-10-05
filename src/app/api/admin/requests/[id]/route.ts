import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { audit } from "@/lib/db";
import { getClientIp } from "@/lib/request";
import { parseId } from "@/lib/ids";
import { RX_STATUSES, updateRxRequest } from "@/lib/rx-requests";

const patchSchema = z
  .object({
    status: z.enum(RX_STATUSES).optional(),
    staffNote: z.string().max(1000).optional(),
  })
  .refine((d) => d.status !== undefined || d.staffNote !== undefined, "Nothing to update.");

/** Staff update a refill/transfer request: move it along, or leave a note. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }

  const found = await updateRxRequest(id, parsed.data, admin.username);
  if (!found) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // The audit entry says what kind of change was made, never what the note
  // said: notes are health information like the request itself.
  await audit({
    actor: `admin:${admin.username}`,
    action: "admin.rx_request.update",
    subject: `rx_request:${id}`,
    outcome: "success",
    detail: [parsed.data.status ? `status=${parsed.data.status}` : null, parsed.data.staffNote !== undefined ? "note=updated" : null]
      .filter(Boolean)
      .join(" "),
    ip: getClientIp(request),
  });
  return NextResponse.json({ ok: true });
}
