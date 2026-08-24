import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminSessionValid } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";

const statusSchema = z.object({ status: z.enum(["new", "read", "replied"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminSessionValid())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const db = await getDb();
  await db.prepare("UPDATE contact_messages SET status = ? WHERE id = ?").run(parsed.data.status, id);
  return NextResponse.json({ ok: true });
}
