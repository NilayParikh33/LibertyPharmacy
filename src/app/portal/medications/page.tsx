import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import PageHero from "@/components/PageHero";
import DrxLinkForm from "@/components/portal/DrxLinkForm";
import MedicationList from "@/components/portal/MedicationList";
import { getSiteSettings } from "@/lib/site";
import { getSessionAccountId, getPatientProfile } from "@/lib/auth";
import { audit } from "@/lib/db";
import { DrxError, drxPatientProfile, isDrxEnabled, type DrxMedication } from "@/lib/drx";
import { getDrxPatientId } from "@/lib/drx-link";

export const metadata: Metadata = {
  title: "My Medications",
  description: "Your prescriptions at Liberty Pharmacy.",
};

export const dynamic = "force-dynamic";

/**
 * The signed-in patient's prescriptions, read live from DRX on every visit
 * and never stored here. Shown only once the account is linked to a DRX
 * patient (src/lib/drx-link.ts); until then the page offers the link step.
 */
export default async function MedicationsPage() {
  const accountId = await getSessionAccountId();
  if (!accountId) redirect("/portal/login");
  const profile = await getPatientProfile(accountId);
  if (!profile) redirect("/portal");
  const site = await getSiteSettings();

  let body: React.ReactNode;
  if (!isDrxEnabled()) {
    body = (
      <p className="card text-sm leading-6 text-slate-600">
        Online medication history is coming soon. In the meantime you can{" "}
        <Link href="/portal/refill" className="font-medium text-navy-700 underline">
          request a refill
        </Link>{" "}
        or call us at{" "}
        <a href={site.phoneHref} className="font-medium text-navy-700 underline">
          {site.phone}
        </a>
        .
      </p>
    );
  } else {
    const drxPatientId = await getDrxPatientId(profile.patientId);
    if (drxPatientId === null) {
      body = <DrxLinkForm phone={site.phone} phoneHref={site.phoneHref} />;
    } else {
      let medications: DrxMedication[] | null = null;
      try {
        medications = (await drxPatientProfile(drxPatientId)).medications;
      } catch (err) {
        console.error(`drx: medication list failed: ${err instanceof DrxError ? err.message : "unexpected error"}`);
      }
      // A disclosure of the patient's own record: audited by id and count.
      await audit({
        actor: `account:${accountId}`,
        action: "patient.medications.view",
        subject: `patient:${profile.patientId}`,
        outcome: medications ? "success" : "failure",
        detail: medications ? `count=${medications.length}` : "drx_unavailable",
      });
      body = medications ? (
        <MedicationList
          medications={medications}
          today={new Date().toISOString().slice(0, 10)}
          defaultDelivery={profile.deliveryMethod}
          phone={site.phone}
          phoneHref={site.phoneHref}
        />
      ) : (
        <p role="alert" className="card text-sm leading-6 text-slate-600">
          We couldn&apos;t load your medications from the pharmacy system just now. Please try again in a few minutes,
          or call us at{" "}
          <a href={site.phoneHref} className="font-medium text-navy-700 underline">
            {site.phone}
          </a>
          .
        </p>
      );
    }
  }

  return (
    <>
      <PageHero title="My Medications" subtitle="Your prescriptions at Liberty Pharmacy, and refills in a tap." />
      <section className="py-16">
        <div className="container-site max-w-3xl">
          {body}
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
