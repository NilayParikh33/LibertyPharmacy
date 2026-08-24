import { NextResponse } from "next/server";
import { isAdminSessionValid } from "@/lib/admin-auth";
import { updatePost, deletePost } from "@/lib/posts";
import { postSchema } from "../route";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid post data." }, { status: 400 });
  }

  try {
    await updatePost(Number(id), parsed.data);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "A post with that slug already exists." }, { status: 409 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminSessionValid())) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await params;
  await deletePost(Number(id));
  return NextResponse.json({ ok: true });
}
