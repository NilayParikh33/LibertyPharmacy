"use client";

import Link from "next/link";
import { useState } from "react";
import PageHero from "@/components/PageHero";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const email = (new FormData(e.currentTarget).get("email") as string | null)?.trim() ?? "";
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHero
        title="Reset your password"
        subtitle="We'll email you a link to choose a new one."
      />
      <section className="py-16">
        <div className="container-site max-w-md">
          {sent ? (
            <div className="card space-y-4">
              <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm leading-6 text-green-800">
                <strong>Check your email.</strong> If an account exists for that address,
                we&apos;ve sent a link to reset your password.
              </p>
              <p className="text-sm leading-6 text-slate-600">
                The link expires in 30 minutes and can only be used once. Don&apos;t see it?
                Check your spam folder.
              </p>
              <Link href="/portal/login" className="btn-primary w-full">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="card space-y-5" noValidate>
              <p className="text-sm leading-6 text-slate-600">
                Enter the email address on your account and we&apos;ll send you a reset link.
              </p>
              {error && (
                <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <input id="email" name="email" type="email" autoComplete="email" required className="input-field" />
              </div>
              <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
                {busy ? "Sending…" : "Send reset link"}
              </button>
              <p className="text-center text-sm text-slate-600">
                Remembered it?{" "}
                <Link href="/portal/login" className="font-medium text-navy-700 underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
