import { NextResponse } from "next/server";
import { enrollStatus } from "@/lib/device-auth";
import { notInDeviceMode } from "@/lib/device-route";

/** For the setup page: is there an account being set up, and what does it have? */
export async function GET() {
  const off = notInDeviceMode();
  if (off) return off;
  return NextResponse.json(await enrollStatus());
}
