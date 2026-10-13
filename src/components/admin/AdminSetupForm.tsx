"use client";

import Link from "next/link";
import { useState } from "react";

/** Staff setup link: choose a password, add the authenticator, confirm a code. */
export default function AdminSetupForm({ token, username, qr, secret }: { token: string; username: string; qr: string; secret: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password") ?? "");
    if (password !== String(f.get("confirm") ?? "")) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, code: f.get("code") }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "That didn't work. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card mt-6 space-y-4 text-sm leading-6 text-slate-700">
        <p className="rounded-lg bg-green-50 px-4 py-3 text-green-800">
          <strong>You&apos;re set up.</strong> Sign in with username <strong>{username}</strong>, your new password and the
          code from your authenticator app.
        </p>
        <Link href="/admin/login" className="btn-primary w-full">
          Go to admin sign-in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card mt-6 space-y-5" noValidate>
      <p className="text-sm text-slate-600">
        Username: <strong className="text-slate-800">{username}</strong>
      </p>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">Choose a password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required className="input-field" />
        <p className="mt-1 text-xs text-slate-500">At least 12 characters, with upper- and lowercase letters and a number.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-slate-700">Confirm password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="input-field" />
      </div>
      <div className="space-y-2 border-t border-slate-200 pt-4">
        <p className="text-sm font-medium text-slate-700">Add to your authenticator app</p>
        <p className="text-xs leading-5 text-slate-500">
          Open Google Authenticator, Microsoft Authenticator or 1Password, add an account and scan this code. If you have
          an old &ldquo;Liberty Pharmacy Admin&rdquo; entry, delete it first.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR code for your authenticator app" width={220} height={220} className="mx-auto rounded-lg border border-slate-200" />
        <details className="text-xs text-slate-600">
          <summary className="cursor-pointer font-medium text-navy-700">Can&apos;t scan? Enter this key instead</summary>
          <p className="mt-2 break-all rounded-lg bg-slate-50 p-3 font-mono text-sm tracking-wider text-slate-800">
            {secret.match(/.{1,4}/g)?.join(" ")}
          </p>
          <p className="mt-1">Letters and the numbers 2–7 only; any &ldquo;O&rdquo; is the letter.</p>
        </details>
      </div>
      <div>
        <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-slate-700">Code from the app</label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          required
          placeholder="123456"
          className="input-field text-center text-2xl tracking-[0.5em]"
        />
      </div>
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? "Saving…" : "Finish setup"}
      </button>
    </form>
  );
}
