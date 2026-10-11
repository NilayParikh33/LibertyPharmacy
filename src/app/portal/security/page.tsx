import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import PageHero from "@/components/PageHero";
import SecuritySettings from "@/components/portal/SecuritySettings";
import { getSessionAccountId } from "@/lib/auth";
import { isDeviceMode } from "@/lib/device-auth";

export const metadata: Metadata = { title: "Sign-in & Security" };
export const dynamic = "force-dynamic";

/** Passkeys, authenticator app and recovery codes (PATIENT_AUTH_MODE=device). */
export default async function SecurityPage() {
  if (!isDeviceMode()) redirect("/portal");
  if (!(await getSessionAccountId())) redirect("/portal/login");
  return (
    <>
      <PageHero title="Sign-in & Security" subtitle="How you confirm it's you." />
      <section className="py-16">
        <div className="container-site max-w-2xl space-y-6">
          <Link href="/portal" className="text-sm font-medium text-navy-700 underline">
            ← Back to your account
          </Link>
          <SecuritySettings />
        </div>
      </section>
    </>
  );
}
