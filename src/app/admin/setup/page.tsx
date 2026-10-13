import type { Metadata } from "next";
import Link from "next/link";
import { getInviteForSetup } from "@/lib/admin-staff";
import AdminSetupForm from "@/components/admin/AdminSetupForm";

export const metadata: Metadata = { title: "Admin account setup", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Opened from a one-time staff setup link (src/lib/admin-staff.ts). */
export default async function AdminSetupPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const invite = token.length >= 20 && token.length <= 200 ? await getInviteForSetup(token) : null;
  return (
    <section className="py-16">
      <div className="container-site max-w-md">
        <h1 className="text-2xl font-bold text-navy-900">Set up your admin login</h1>
        {invite ? (
          <AdminSetupForm token={token} username={invite.username} qr={invite.qr} secret={invite.secret} />
        ) : (
          <p className="mt-4 text-sm leading-6 text-slate-600">
            This setup link has expired or was already used. Ask an admin for a new one, or{" "}
            <Link href="/admin/login" className="font-medium text-navy-700 underline">
              sign in
            </Link>{" "}
            if you&apos;ve already set up your login.
          </p>
        )}
      </div>
    </section>
  );
}
