"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import PageHero from "@/components/PageHero";

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const fromSignup = params.get("new") === "1";

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const code = (new FormData(e.currentTarget).get("code") as string | null)?.trim() ?? "";
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Verification failed. Please try again.");
        return;
      }
      router.push(data.purpose === "email_verify" ? "/portal?registered=1" : "/portal");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    setError(null);
    setNotice(null);
    const res = await fetch("/api/auth/resend", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not resend the code.");
    } else {
      setNotice("A new code is on its way to your email.");
    }
  }

  return (
    <>
      <PageHero
        title="Check your email"
        subtitle={
          fromSignup
            ? "One last step — confirm your email to activate your account."
            : "Enter the sign-in code we just sent you."
        }
      />
      <section className="py-16">
        <div className="container-site max-w-md">
          <form onSubmit={onSubmit} className="card space-y-5" noValidate>
            <p className="text-sm leading-6 text-slate-600">
              We sent a 6-digit code to your email address. It expires in 10 minutes.
            </p>
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
                {notice}
              </p>
            )}
            <div>
              <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-slate-700">
                Verification code
              </label>
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
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
              {busy ? "Verifying…" : fromSignup ? "Activate my account" : "Verify and sign in"}
            </button>
            <button
              type="button"
              onClick={onResend}
              className="w-full text-center text-sm font-medium text-navy-700 underline"
            >
              Resend code
            </button>
          </form>
        </div>
      </section>
    </>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
