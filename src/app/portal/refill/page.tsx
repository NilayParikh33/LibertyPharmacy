import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import PageHero from "@/components/PageHero";
import RefillForm from "@/components/portal/RefillForm";
import { getSiteSettings } from "@/lib/site";
import { getSessionAccountId, getPatientProfile } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Request a Refill",
  description: "Request a prescription refill from Liberty Pharmacy.",
};

export const dynamic = "force-dynamic";

/**
 * Refill request. Signed-in patients only: the request is filed against the
 * account in the session, so there is nothing to look up or type about who
 * the patient is.
 */
export default async function RefillPage() {
  const accountId = await getSessionAccountId();
  if (!accountId) redirect("/portal/login");
  const profile = await getPatientProfile(accountId);
  if (!profile) redirect("/portal");
  const site = await getSiteSettings();

  return (
    <>
      <PageHero title="Request a Refill" subtitle="Tell us which prescriptions you need and how you'd like to get them." />
      <section className="py-16">
        <div className="container-site max-w-3xl">
          <RefillForm defaultDelivery={profile.deliveryMethod} phone={site.phone} phoneHref={site.phoneHref} />
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
