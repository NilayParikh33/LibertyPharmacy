import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import PageHero from "@/components/PageHero";
import TransferForm from "@/components/portal/TransferForm";
import { getSiteSettings } from "@/lib/site";
import { getSessionAccountId } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Transfer a Prescription",
  description: "Move your prescriptions to Liberty Pharmacy.",
};

export const dynamic = "force-dynamic";

/**
 * Transfer request. Signed-in patients only, for the same reason as the refill
 * page: the request is filed against the session's account.
 */
export default async function TransferPage() {
  const accountId = await getSessionAccountId();
  if (!accountId) redirect("/portal/login");
  const site = await getSiteSettings();

  return (
    <>
      <PageHero title="Transfer a Prescription" subtitle="Tell us where your prescriptions are and we'll handle the rest." />
      <section className="py-16">
        <div className="container-site max-w-3xl">
          <TransferForm phone={site.phone} phoneHref={site.phoneHref} />
          <p className="mt-6 text-sm text-slate-600">
            <Link href="/portal" className="font-medium text-navy-700 underline">
              Back to my portal
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
