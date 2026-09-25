import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { updateSiteSettings } from "@/lib/site";
import { audit } from "@/lib/db";
import { getClientIp } from "@/lib/request";

// These two are rendered as href on every page. z.string().url() alone
// accepts javascript:, data: and any off-site URL, so an admin typo — or a
// compromised admin session — could turn every "Call us" / "Directions" link
// on the site into a phishing link (SEC-006). Constrain both to what they are.
const MAPS_HOSTS = new Set([
  "google.com", "www.google.com", "maps.google.com", "goo.gl", "maps.app.goo.gl",
  "maps.apple.com", "bing.com", "www.bing.com",
]);
const mapsUrl = z
  .string()
  .trim()
  .url("Enter a valid maps URL")
  .refine((v) => {
    const u = new URL(v);
    return u.protocol === "https:" && MAPS_HOSTS.has(u.hostname) && !u.username && !u.password;
  }, "Maps link must be an https:// Google, Apple, or Bing Maps URL");
const phoneHref = z
  .string()
  .trim()
  .regex(/^tel:\+?[0-9]{7,15}$/, "Phone link must look like tel:+15125550100");

const settingsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  tagline: z.string().trim().min(1, "Tagline is required").max(300),
  phone: z.string().trim().min(1, "Phone is required").max(30),
  phoneHref,
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
  mapsUrl,
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
