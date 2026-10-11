"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Admin → Patients: resets one patient's sign-in and shows the temporary password once. */
export default function ResetSignInButton({ accountId, email }: { accountId: number; email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    if (
      !window.confirm(
        `Reset sign-in for ${email}?\n\nOnly do this after confirming who the caller is (name, date of birth, phone on file). ` +
          "Their passkeys, authenticator app and recovery codes will be removed and they'll be signed out."
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/accounts/${accountId}/reset-signin`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; temporaryPassword?: string };
      if (!res.ok || !data.temporaryPassword) {
        setError(data.error ?? "Couldn't reset. Please try again.");
        return;
      }
      setTemp(data.temporaryPassword);
      router.refresh();
    } catch {
      setError("Couldn't reset. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (temp) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <p className="font-semibold">Temporary password (shown once):</p>
        <p className="mt-1 font-mono text-lg tracking-wider">{temp}</p>
        <p className="mt-1 text-xs leading-5">
          Read it to the patient. They sign in with their email and this password, then choose a new password and set
          up a passkey or authenticator app. Don&apos;t write it down or email it.
        </p>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={reset}
        disabled={busy}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? "Resetting…" : "Reset sign-in"}
      </button>
      {error && (
        <span role="status" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
