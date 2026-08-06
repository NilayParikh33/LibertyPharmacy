import Link from "next/link";
import PageHero from "@/components/PageHero";
import { isResetTokenValid } from "@/lib/auth";
import ResetPasswordForm from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

/**
 * Landing page for the emailed reset link.
 *
 * The token is validated server-side before the form renders, so an expired or
 * already-used link shows a clear explanation instead of failing only after
 * the user has typed a new password twice.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = token ? await isResetTokenValid(token) : false;

  return (
    <>
      <PageHero
        title="Choose a new password"
        subtitle={valid ? "Almost done — pick a strong password." : undefined}
      />
      <section className="py-16">
        <div className="container-site max-w-md">
          {valid && token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="card space-y-4">
              <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                <strong>This reset link is no longer valid.</strong> Links expire after 30
                minutes and can only be used once.
              </p>
              <Link href="/portal/forgot" className="btn-primary w-full">
                Request a new link
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
