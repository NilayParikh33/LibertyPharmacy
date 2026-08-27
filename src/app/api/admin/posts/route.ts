import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { createPost } from "@/lib/posts";
import { audit } from "@/lib/db";
import { getClientIp } from "@/lib/request";

export const postSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(120)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and hyphens"),
  title: z.string().trim().min(1, "Title is required").max(200),
  excerpt: z.string().trim().min(1, "Excerpt is required").max(400),
  author: z.string().trim().min(1, "Author is required").max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  readMinutes: z.number().int().min(1).max(60),
  sections: z
    .array(
      z.object({
        heading: z.string().trim().min(1, "Section heading is required").max(200),
        body: z.string().trim().min(1, "Section body is required").max(5000),
      })
    )
    .min(1, "At least one section is required"),
});

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
