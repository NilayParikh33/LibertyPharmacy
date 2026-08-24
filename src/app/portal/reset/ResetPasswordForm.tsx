"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const password = (f.get("password") as string | null) ?? "";
    const confirm = (f.get("confirmPassword") as string | null) ?? "";

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to reset your password. Please try again.");
        return;
      }
      setDone(true);
      // Sessions were revoked server-side; send them to sign in fresh.
      setTimeout(() => {
        router.push("/portal/login");
        router.refresh();
      }, 2500);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card space-y-4">
        <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm leading-6 text-green-800">
          <strong>Your password has been updated.</strong> For your security we signed you
          out everywhere — please sign in with your new password.
        </p>
        <Link href="/portal/login" className="btn-primary w-full">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5" noValidate>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          className="input-field"
        />
        <p className="mt-1 text-xs text-slate-500">
          At least 12 characters with upper, lower, and a number.
        </p>
      </div>
      <div>
        <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className="input-field"
        />
      </div>
      <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
        {busy ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
