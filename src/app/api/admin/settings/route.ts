import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { updateSiteSettings } from "@/lib/site";
import { audit } from "@/lib/db";
import { getClientIp } from "@/lib/request";

const settingsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  tagline: z.string().trim().min(1, "Tagline is required").max(300),
  phone: z.string().trim().min(1, "Phone is required").max(30),
  phoneHref: z.string().trim().min(1, "Phone link is required").max(40),
  fax: z.string().trim().min(1, "Fax is required").max(30),
  email: z.string().trim().email("A valid email is required").max(254),
  address: z.object({
    line1: z.string().trim().min(1, "Address is required").max(200),
    city: z.string().trim().min(1, "City is required").max(100),
    state: z.string().trim().min(1, "State is required").max(20),
    zip: z.string().trim().min(1, "ZIP is required").max(20),
    county: z.string().trim().min(1, "County is required").max(100),
  }),
  hours: z
    .array(
      z.object({
        days: z.string().trim().min(1).max(50),
        hours: z.string().trim().min(1).max(50),
      })
    )
    .min(1),
  mapsUrl: z.string().trim().url("Enter a valid maps URL"),
});

export async function PUT(request: Request) {
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

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings." }, { status: 400 });
  }

  await updateSiteSettings(parsed.data);
  await audit({
    actor: `admin:${admin.username}`,
    action: "admin.settings.update",
    outcome: "success",
    ip: getClientIp(request),
  });
  return NextResponse.json({ ok: true });
}
