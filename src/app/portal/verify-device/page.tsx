"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import PageHero from "@/components/PageHero";
import { postJson, signInWithPasskey } from "@/components/portal/device-client";

/**
 * The step after the password when PATIENT_AUTH_MODE=device: a code from the
 * authenticator app, one of the account's passkeys, or a recovery code.
 * The query string only says which of these the account has set up.
 */
function VerifyDeviceForm() {
  const router = useRouter();
  const params = useSearchParams();
  const hasTotp = params.get("totp") === "1";
  const hasPasskey = params.get("passkey") === "1";

  const [useRecovery, setUseRecovery] = useState(!hasTotp && !hasPasskey);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function done(r: { ok: boolean; status: number; data: { error?: string } }) {
    if (!r.ok) {
      setError(r.data.error ?? "That didn't work. Please try again.");
      // 401 "expired" / 429 "too many": the step is gone — back to the start.
      if (r.status === 429 || /expired|sign in again/i.test(r.data.error ?? "")) {
        setTimeout(() => router.push("/portal/login"), 2500);
      }
      return;
    }
    router.push("/portal");
    router.refresh();
  }

  async function onCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const code = (new FormData(e.currentTarget).get("code") as string | null)?.trim() ?? "";
    done(await postJson("/api/auth/device/verify", { method: useRecovery ? "recovery" : "totp", code }));
    setBusy(false);
  }

  async function onPasskey() {
    setError(null);
    setBusy(true);
    done(await signInWithPasskey());
    setBusy(false);
  }

  return (
    <>
      <PageHero title="Confirm it's you" subtitle="One more step to sign in." />
      <section className="py-16">
        <div className="container-site max-w-md">
          <div className="card space-y-5">
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            {hasPasskey && !useRecovery && (
              <>
                <button type="button" onClick={onPasskey} disabled={busy} className="btn-primary w-full">
                  {busy ? "Waiting for your device…" : "Use my passkey"}
                </button>
                {hasTotp && (
                  <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
                    <span className="h-px flex-1 bg-slate-200" />
                    or
                    <span className="h-px flex-1 bg-slate-200" />
                  </div>
                )}
              </>
            )}

            {(hasTotp || useRecovery) && (
              <form onSubmit={onCode} className="space-y-4" noValidate key={useRecovery ? "recovery" : "totp"}>
                <div>
                  <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-slate-700">
                    {useRecovery ? "Recovery code" : "Code from your authenticator app"}
                  </label>
                  {useRecovery ? (
                    <input
                      id="code"
                      name="code"
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      maxLength={20}
                      required
                      placeholder="XXXXX-XXXXX"
                      className="input-field text-center font-mono text-lg tracking-widest"
                    />
                  ) : (
                    <input
                      id="code"
                      name="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="\d{6}"
                      maxLength={6}
                      required
                      placeholder="123456"
                      className="input-field text-center text-2xl tracking-[0.5em]"
                    />
                  )}
                </div>
                <button type="submit" disabled={busy} className={`${hasPasskey && !useRecovery ? "btn-outline" : "btn-primary"} w-full`}>
                  {busy ? "Checking…" : "Sign in"}
                </button>
              </form>
            )}

            <div className="space-y-2 border-t border-slate-200 pt-4 text-center text-sm text-slate-600">
              {useRecovery ? (
                (hasTotp || hasPasskey) && (
                  <button type="button" onClick={() => setUseRecovery(false)} className="font-medium text-navy-700 underline">
                    Back to my passkey or app
                  </button>
                )
              ) : (
                <button type="button" onClick={() => setUseRecovery(true)} className="font-medium text-navy-700 underline">
                  Lost your phone? Use a recovery code
                </button>
              )}
              <p>
                No codes either?{" "}
                <Link href="/portal/forgot" className="font-medium text-navy-700 underline">
                  Get help signing in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default function VerifyDevicePage() {
  return (
    <Suspense>
      <VerifyDeviceForm />
    </Suspense>
  );
}
