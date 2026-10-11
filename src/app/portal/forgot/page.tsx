import Link from "next/link";
import PageHero from "@/components/PageHero";
import ForgotPasswordForm from "@/components/portal/ForgotPasswordForm";
import { isDeviceMode } from "@/lib/device-auth";
import { getSiteSettings } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Email mode: the emailed reset link. Device mode (PATIENT_AUTH_MODE=device,
 * no working email yet): recovery codes, or a call to the pharmacy — staff
 * confirm who it is and use Admin → Patients → Reset sign-in.
 */
export default async function ForgotPage() {
  if (!isDeviceMode()) return <ForgotPasswordForm />;
  const site = await getSiteSettings();
  return (
    <>
      <PageHero title="Trouble signing in?" subtitle="We'll get you back into your account." />
      <section className="py-16">
        <div className="container-site max-w-md">
          <div className="card space-y-5 text-sm leading-6 text-slate-600">
            <div>
              <h2 className="text-base font-semibold text-navy-900">Lost your phone or passkey?</h2>
              <p className="mt-1">
                Sign in with your email and password, then choose <strong>Use a recovery code</strong> and enter one of
                the codes you saved when you set up your account.
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold text-navy-900">Forgot your password, or no codes?</h2>
              <p className="mt-1">
                Call us at{" "}
                <a href={site.phoneHref} className="font-semibold text-navy-700 underline">
                  {site.phone}
                </a>
                . After confirming who you are, we&apos;ll give you a temporary password so you can set up your account
                again.
              </p>
            </div>
            <Link href="/portal/login" className="btn-primary w-full">
              Back to sign in
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
