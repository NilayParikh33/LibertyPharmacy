import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { createPost } from "@/lib/posts";
import { audit } from "@/lib/db";
import { getClientIp } from "@/lib/request";
import { postSchema } from "@/lib/post-schema";

export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

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
    const id = await createPost(parsed.data);
    await audit({
      actor: `admin:${admin.username}`,
      action: "admin.post.create",
      subject: `post:${id}`,
      outcome: "success",
      ip: getClientIp(request),
    });
    return NextResponse.json({ ok: true, id });
  } catch {
    return NextResponse.json({ error: "A post with that slug already exists." }, { status: 409 });
  }
}
