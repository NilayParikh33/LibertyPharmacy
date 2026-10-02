import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import LogoutButton from "@/components/LogoutButton";
import { getSiteSettings } from "@/lib/site";
import { getSessionAccountId, getPatientProfile } from "@/lib/auth";
import { listPatientRequests, type RxStatus } from "@/lib/rx-requests";
import { drxConfig, isDrxEnabled } from "@/lib/drx";
import { getDrxPatientId, takeDrxReadyNotice } from "@/lib/drx-link";
import DrxLinkForm from "@/components/portal/DrxLinkForm";

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
 * Signed in  → account dashboard: refill and transfer requests (filed here,
 * worked by staff in the admin panel — see src/lib/rx-requests.ts) and the
 * patient's recent requests with their status. Medication history and
 * messaging remain "coming soon". The local patient record already matches
 * DRX fields (see src/lib/db.ts).
 */

const statusLabel: Record<RxStatus, { text: string; cls: string }> = {
  new: { text: "Received", cls: "bg-navy-50 text-navy-800" },
  in_progress: { text: "In progress", cls: "bg-amber-50 text-amber-800" },
  completed: { text: "Completed", cls: "bg-green-50 text-green-800" },
  cancelled: { text: "Cancelled", cls: "bg-slate-100 text-slate-600" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * DRX sends pharmacy-local wall-clock times with no zone. Parsing and printing
 * in the same (server) zone leaves that wall-clock time unchanged.
 */
function formatPickup(local: string) {
  return new Date(local).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const { registered } = await searchParams;
  const accountId = await getSessionAccountId();
  const profile = accountId ? await getPatientProfile(accountId) : null;
  const site = await getSiteSettings();

  if (profile) {
    const requests = await listPatientRequests(profile.patientId);
    // DRX connection state, only meaningful once DRX is switched on.
    const drxOn = isDrxEnabled();
    const linked = drxOn ? (await getDrxPatientId(profile.patientId)) !== null : false;
    const justConnected = drxOn && linked ? await takeDrxReadyNotice(profile.patientId) : false;
    const hasTransfer = requests.some((r) => r.kind === "transfer");
    // The pharmacy's DRX refill site, when configured: an ordinary outbound
    // link, so nothing from this site is sent to DRX.
    const drxStore = drxConfig.storeUrl?.startsWith("https://") ? drxConfig.storeUrl : null;
    const actions: { title: string; body: string; href?: string; cta?: string; altHref?: string | null }[] = [
      {
        title: "Refill a Prescription",
        body: "Request refills online in a few clicks and pick them up or have them delivered.",
        href: "/portal/refill",
        cta: "Request a refill",
        altHref: drxStore,
      },
      {
        title: "Transfer a Prescription",
        body: "Tell us where your prescriptions are and we handle the rest.",
        href: "/portal/transfer",
        cta: "Transfer a prescription",
      },
      {
        title: "Medication History",
        body: "View your active prescriptions and past fills in one place, and refill them in a tap.",
        // Live once DRX is switched on (after the BAA); "coming soon" until then.
        ...(isDrxEnabled() ? { href: "/portal/medications", cta: "View my medications" } : {}),
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
            {justConnected && (
              <div
                role="status"
                className="mb-8 rounded-xl border border-green-200 bg-green-50 p-5 text-sm leading-6 text-green-800"
              >
                <strong>Your account is now connected to your pharmacy record.</strong> You can see your medications and
                request refills online.{" "}
                <Link href="/portal/medications" className="font-semibold underline">
                  View my medications
                </Link>
              </div>
            )}
            {/* After a transfer, the patient connects themselves with the Rx
                number on their first Liberty label: no staff step in this site. */}
            {drxOn && !linked && hasTransfer && (
              <div className="mb-8">
                <DrxLinkForm
                  phone={site.phone}
                  phoneHref={site.phoneHref}
                  title="Got your first Liberty Pharmacy label?"
                  intro="Once we've filled your transferred prescription, enter the Rx number printed on its label. That connects your account to your pharmacy record, so you can see your medications and refill online. You only need to do this once."
                />
              </div>
            )}
            {drxOn && !linked && !hasTransfer && (
              <div className="mb-8 rounded-xl border border-navy-100 bg-navy-50 p-5 text-sm leading-6 text-navy-900">
                <strong>New to Liberty Pharmacy?</strong> Start by{" "}
                <Link href="/portal/transfer" className="font-semibold underline">
                  transferring your prescriptions
                </Link>{" "}
                to us. Once they&apos;re filled, you can refill online. Already fill with us?{" "}
                <Link href="/portal/medications" className="font-semibold underline">
                  Connect your record
                </Link>{" "}
                with the Rx number from any of our labels.
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
              {actions.map((a) => (
                <div key={a.title} className="card flex flex-col">
                  <h3 className="text-base font-semibold text-navy-900">{a.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{a.body}</p>
                  {a.href ? (
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <Link href={a.href} className="btn-primary self-start">
                        {a.cta}
                      </Link>
                      {a.altHref && (
                        <a
                          href={a.altHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-navy-700 underline"
                        >
                          Or use our DRX refill site
                        </a>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="mt-4 inline-flex cursor-not-allowed items-center gap-2 self-start rounded-lg bg-slate-200 px-5 py-3 text-sm font-semibold text-slate-500"
                      title="Coming soon"
                    >
                      Coming soon
                    </button>
                  )}
                </div>
              ))}
            </div>

            {requests.length > 0 && (
              <div className="mt-12">
                <h2 className="text-lg font-semibold text-navy-900">Your recent requests</h2>
                <ul className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
                  {requests.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                      <div>
                        <p className="font-medium text-navy-900">
                          {r.kind === "refill" ? "Refill" : "Transfer"} request #{r.id}
                        </p>
                        <p className="text-slate-600">{r.summary}</p>
                        <p className="text-xs text-slate-500">Sent {formatDate(r.createdAt)}</p>
                        {r.estimatedPickup && (
                          // DRX requires this be presented as an estimate only.
                          <p className="text-xs text-slate-500">
                            Estimated ready: {formatPickup(r.estimatedPickup)} (an estimate only; we&apos;ll let you know
                            when it&apos;s ready)
                          </p>
                        )}
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusLabel[r.status].cls}`}>
                        {statusLabel[r.status].text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
