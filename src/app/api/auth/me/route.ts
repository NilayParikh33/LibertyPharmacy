import { NextResponse } from "next/server";
import { getSessionAccountId, getPatientProfile } from "@/lib/auth";

/** Returns the signed-in patient's minimal profile, or 401. */
export async function GET(request: Request) {
  const accountId = await getSessionAccountId();
  if (!accountId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const profile = getPatientProfile(accountId, ip);
  if (!profile) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  return NextResponse.json({ profile });
}
