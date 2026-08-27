import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { updatePost, deletePost } from "@/lib/posts";
import { postSchema } from "../route";
import { audit } from "@/lib/db";
import { getClientIp } from "@/lib/request";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid post data." }, { status: 400 });
  }

  try {
    await updatePost(Number(id), parsed.data);
    await audit({
      actor: `admin:${admin.username}`,
      action: "admin.post.update",
      subject: `post:${id}`,
      outcome: "success",
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "A post with that slug already exists." }, { status: 409 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await params;
  await deletePost(Number(id));
  await audit({
    actor: `admin:${admin.username}`,
    action: "admin.post.delete",
    subject: `post:${id}`,
    outcome: "success",
    ip: getClientIp(_request),
  });
  return NextResponse.json({ ok: true });
}
