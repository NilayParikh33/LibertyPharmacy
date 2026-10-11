"use client";

import { useState } from "react";
import { changePasswordWithPasskey, postJson } from "./device-client";

/**
 * Sign-in & security → Change password. Confirmed with a passkey or an
 * authenticator code instead of the old password (which may be forgotten).
 */
export default function ChangePassword({ hasPasskey, hasTotp }: { hasPasskey: boolean; hasTotp: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function readPassword(form: HTMLFormElement): string | null {
    const f = new FormData(form);
    const password = String(f.get("newPassword") ?? "");
    if (password !== String(f.get("confirmPassword") ?? "")) {
      setError("Passwords do not match.");
      return null;
    }
    return password;
  }

  async function finish(r: { ok: boolean; data: { error?: string } }, form: HTMLFormElement) {
    setBusy(false);
    if (!r.ok) {
      setError(r.data.error ?? "Couldn't change your password. Please try again.");
      return;
    }
    form.reset();
    setDone(true);
    setOpen(false);
  }

  async function onCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!hasTotp) return onPasskey(e.currentTarget); // Enter key on a passkey-only account
    setError(null);
    const form = e.currentTarget;
    const password = readPassword(form);
    if (password === null) return;
    const totpCode = String(new FormData(form).get("code") ?? "").trim();
    setBusy(true);
    await finish(await postJson("/api/auth/device/password/change", { password, totpCode }), form);
  }

  async function onPasskey(form: HTMLFormElement | null) {
    if (!form) return;
    setError(null);
    if (!form.reportValidity()) return;
    const password = readPassword(form);
    if (password === null) return;
    setBusy(true);
    await finish(await changePasswordWithPasskey(password), form);
  }

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-navy-900">Password</h2>
        {!open && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setDone(false);
              setError(null);
            }}
            className="btn-outline btn-sm"
          >
            Change password
          </button>
        )}
      </div>
      {done && (
        <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          Password changed. Any other devices signed in to your account have been signed out.
        </p>
      )}
      {open && (
        <form onSubmit={onCode} className="space-y-4" noValidate={false}>
          <p className="text-sm leading-6 text-slate-600">
            You don&apos;t need your current password — confirm it&apos;s you with your{" "}
            {hasPasskey && hasTotp ? "passkey or authenticator app" : hasPasskey ? "passkey" : "authenticator app"}.
          </p>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="newPassword" className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
            <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={12} className="input-field" />
            <p className="mt-1 text-xs text-slate-500">At least 12 characters, with upper- and lowercase letters and a number.</p>
          </div>
          <div>
            <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-slate-700">Confirm new password</label>
            <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required className="input-field" />
          </div>
          {hasPasskey && (
            <button
              type="button"
              disabled={busy}
              onClick={(e) => onPasskey(e.currentTarget.form)}
              className="btn-primary w-full"
            >
              {busy ? "Waiting for your device…" : "Confirm with passkey and save"}
            </button>
          )}
          {hasTotp && (
            <div className="space-y-3 rounded-lg border border-slate-200 p-3">
              <label htmlFor="code" className="block text-sm font-medium text-slate-700">
                {hasPasskey ? "Or enter the code from your authenticator app" : "Code from your authenticator app"}
              </label>
              <input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="123456"
                className="input-field text-center text-xl tracking-[0.4em]"
              />
              <button type="submit" disabled={busy} className={`${hasPasskey ? "btn-outline" : "btn-primary"} w-full`}>
                {busy ? "Saving…" : "Save new password"}
              </button>
            </div>
          )}
          <button type="button" onClick={() => setOpen(false)} className="w-full text-center text-sm font-medium text-navy-700 underline">
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
