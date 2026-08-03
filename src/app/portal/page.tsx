import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LogoutButton from "@/components/LogoutButton";
import { site } from "@/lib/site";
import { getSessionAccountId, getPatientProfile } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Patient Portal",
  description:
    "Liberty Pharmacy patient portal — sign in or register to manage refills, transfers, and your account.",
};

export const dynamic = "force-dynamic";

/**
 * Patient Portal.
 *
 * Signed out → sign-in / registration entry points.
 * Signed in  → account dashboard. Refills/transfers remain "coming soon"
 * until the DRX integration phase; the local patient record already matches
 * DRX fields so accounts created now carry over 1:1 (see src/lib/db.ts).
 */
export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const { registered } = await searchParams;
  const accountId = await getSessionAccountId();
  const profile = accountId ? await getPatientProfile(accountId) : null;

  if (profile) {
    const comingSoon = [
      {
        title: "Refill a Prescription",
        body: "Request refills online in a few clicks and pick them up or have them delivered.",
      },
      {
        title: "Transfer a Prescription",
        body: "Tell us where your prescriptions are and we handle the rest.",
      },
      {
        title: "Medication History",
        body: "View your active prescriptions and past fills in one place.",
      },
      {
        title: "Messages",
        body: "Securely message our pharmacists with non-urgent questions.",
      },
    ];

    return (
      <>
        <PageHero
          title={`Welcome back, ${profile.firstName}`}
          subtitle="Manage your prescriptions and account."
        />
        <section className="py-16">
          <div className="container-site">
            {registered === "1" && (
              <div
                role="status"
                className="mb-8 rounded-xl border border-green-200 bg-green-50 p-5 text-sm leading-6 text-green-800"
              >
                <strong>Registration successful — welcome to Liberty Pharmacy!</strong>{" "}
                Your account has been created and you&apos;re now signed in.
              </div>
            )}
            <div className="mb-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-6">
              <div className="text-sm leading-6 text-slate-700">
                <p className="font-semibold text-navy-900">
                  {profile.firstName} {profile.lastName}
                </p>
                <p>{profile.email}</p>
                <p>
                  {profile.cellPhone} · Prefers{" "}
                  {profile.deliveryMethod === "pickup"
                    ? "in-store pickup"
                    : profile.deliveryMethod === "delivery"
                      ? "local delivery"
                      : "mail"}
                </p>
              </div>
              <LogoutButton />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {comingSoon.map((f) => (
                <div key={f.title} className="card flex flex-col">
                  <h3 className="text-base font-semibold text-navy-900">{f.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{f.body}</p>
                  <button
                    type="button"
                    disabled
                    className="mt-4 inline-flex cursor-not-allowed items-center gap-2 self-start rounded-lg bg-slate-200 px-5 py-3 text-sm font-semibold text-slate-500"
                    title="Launching with our online pharmacy platform"
                  >
                    Coming soon
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
              Need something now? Call us at{" "}
              <a href={site.phoneHref} className="font-semibold text-navy-700 underline">
                {site.phone}
              </a>{" "}
              — we&apos;re happy to handle refills and transfers by phone.
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHero
        title="Patient Portal"
        subtitle="Online refills, transfers, and secure account access."
      />
      <section className="py-16">
        <div className="container-site">
          <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
            <div className="card flex flex-col">
              <h3 className="text-base font-semibold text-navy-900">Sign In</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
                Access your account to view and manage your prescriptions securely.
              </p>
              <Link href="/portal/login" className="btn-primary mt-4 self-start">
                Sign in
              </Link>
            </div>
            <div className="card flex flex-col">
              <h3 className="text-base font-semibold text-navy-900">New Patient Registration</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">
                Create your account and let us take care of moving your prescriptions to
                Liberty Pharmacy.
              </p>
              <Link href="/portal/register" className="btn-accent mt-4 self-start">
                Register
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-12 max-w-3xl rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
            <strong className="text-slate-800">Your privacy matters:</strong> your
            information is encrypted and handled under our{" "}
            <Link href="/hipaa-notice" className="font-medium text-navy-700 underline">
              Notice of Privacy Practices
            </Link>
            . Prefer the phone? Call{" "}
            <a href={site.phoneHref} className="font-semibold text-navy-700 underline">
              {site.phone}
            </a>{" "}
            and we&apos;ll take care of everything.
          </div>
        </div>
      </section>
    </>
  );
}
