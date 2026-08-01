import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { site } from "@/lib/site";
import { drxConfig, isDrxConfigured } from "@/lib/drx";

export const metadata: Metadata = {
  title: "Patient Portal",
  description:
    "Liberty Pharmacy patient portal — online refills, transfers, and account management (coming soon).",
};

/**
 * Patient Portal — DRX integration seam.
 *
 * Until the DRX platform integration is live this page shows a "coming soon"
 * state and directs patients to the phone. Once NEXT_PUBLIC_DRX_STORE_URL is
 * set in the environment, the buttons below automatically link out to the
 * secured DRX storefront (no code change needed).
 *
 * Deliberately NOT implemented here: local login/signup forms. Collecting
 * credentials or registration details (DOB, medications, etc.) on this site
 * before the BAA-covered portal exists would create PHI obligations the
 * current phase is designed to avoid. See HIPAA-COMPLIANCE.md.
 */
export default function PortalPage() {
  const drxReady = isDrxConfigured();
  const storeUrl = drxConfig.storeUrl ?? undefined;

  const features = [
    {
      title: "Sign In",
      body: "Access your account to view and manage your prescriptions securely.",
      cta: "Sign in",
    },
    {
      title: "New Patient Registration",
      body: "Create your account and let us take care of moving your prescriptions to Liberty Pharmacy.",
      cta: "Register",
    },
    {
      title: "Refill a Prescription",
      body: "Request refills online in a few clicks and pick them up or have them delivered.",
      cta: "Request refill",
    },
    {
      title: "Transfer a Prescription",
      body: "Switching pharmacies is easy — tell us where your prescriptions are and we handle the rest.",
      cta: "Start transfer",
    },
  ];

  return (
    <>
      <PageHero
        title="Patient Portal"
        subtitle="Online refills, transfers, and secure account access."
      />

      <section className="py-16">
        <div className="container-site">
          {!drxReady && (
            <div className="mx-auto mb-12 max-w-2xl rounded-xl border border-navy-200 bg-navy-50 p-6 text-center">
              <p className="text-2xl">🚧</p>
              <h2 className="mt-2 text-lg font-bold text-navy-900">
                Our secure online portal is coming soon
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                We're building a secure patient portal for online refills,
                transfers, and account management. Until it launches, our team
                is happy to handle everything by phone — call{" "}
                <a href={site.phoneHref} className="font-semibold text-navy-700 underline">
                  {site.phone}
                </a>{" "}
                and we'll take care of you right away.
              </p>
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="card flex flex-col">
                <h3 className="text-base font-semibold text-navy-900">{f.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{f.body}</p>
                {drxReady && storeUrl ? (
                  <a
                    href={storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary mt-4 self-start"
                  >
                    {f.cta}
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-4 inline-flex cursor-not-allowed items-center gap-2 self-start rounded-lg bg-slate-200 px-5 py-3 text-sm font-semibold text-slate-500"
                    title="Available when our online portal launches"
                  >
                    {f.cta} — coming soon
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
            <strong className="text-slate-800">Your privacy matters:</strong>{" "}
            when our portal launches it will run on a secured, HIPAA-covered
            platform. We will never ask you to submit health information
            through this website. Read our{" "}
            <Link href="/hipaa-notice" className="font-medium text-navy-700 underline">
              Notice of Privacy Practices
            </Link>{" "}
            to learn how we protect your information.
          </div>
        </div>
      </section>
    </>
  );
}
