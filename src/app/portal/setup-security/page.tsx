"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import PageHero from "@/components/PageHero";
import RecoveryCodes from "@/components/portal/RecoveryCodes";
import { createPasskey, passkeysSupported, postJson } from "@/components/portal/device-client";

/**
 * "Secure your account" (PATIENT_AUTH_MODE=device, src/lib/device-auth.ts).
 *
 * Reached after registering, after signing in to an account with no passkey
 * or authenticator yet (or one staff just reset), and from the Security page
 * to add another. Choosing a new password comes first after a staff reset.
 */

type Status = {
  active: boolean;
  signedIn: boolean;
  mustChangePassword: boolean;
  factors: { passkeys: number; totp: boolean; recoveryCodesLeft: number } | null;
};

function SetupSecurity() {
  const router = useRouter();
  const params = useSearchParams();
  const isNew = params.get("new") === "1";

  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canPasskey, setCanPasskey] = useState(true);
  const [totp, setTotp] = useState<{ secret: string; qr: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/device/status");
      setStatus(res.ok ? await res.json() : { active: false, signedIn: false, mustChangePassword: false, factors: null });
    } catch {
      setError("Something went wrong. Please refresh the page.");
    }
  }, []);

  useEffect(() => {
    setCanPasskey(passkeysSupported());
    load();
  }, [load]);

  const destination = status?.signedIn ? "/portal/security" : isNew ? "/portal?registered=1" : "/portal";

  function finish() {
    router.push(destination);
    router.refresh();
  }

  function afterFactor(r: { ok: boolean; data: Record<string, unknown> & { error?: string } }) {
    if (!r.ok) {
      setError(r.data.error ?? "That didn't work. Please try again.");
      return;
    }
    const issued = r.data.recoveryCodes;
    if (Array.isArray(issued) && issued.length) setCodes(issued as string[]);
    else finish();
  }

  async function onPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password") ?? "");
    if (password !== String(f.get("confirm") ?? "")) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    const r = await postJson("/api/auth/device/password", { password });
    setBusy(false);
    if (!r.ok) {
      setError(r.data.error ?? "Couldn't save your password.");
      return;
    }
    await load();
  }

  async function onPasskey() {
    setError(null);
    setBusy(true);
    afterFactor(await createPasskey());
    setBusy(false);
  }

  async function onStartTotp() {
    setError(null);
    setBusy(true);
    const r = await postJson("/api/auth/device/totp/setup");
    setBusy(false);
    if (!r.ok) {
      setError(r.data.error ?? "Couldn't start the authenticator setup.");
      return;
    }
    setTotp({ secret: String(r.data.secret), qr: String(r.data.qr) });
  }

  async function onConfirmTotp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    afterFactor(await postJson("/api/auth/device/totp/confirm", { code }));
    setBusy(false);
  }

  let body: React.ReactNode;
  if (!status) {
    body = <p className="text-sm text-slate-600">Loading…</p>;
  } else if (!status.active) {
    body = (
      <p className="text-sm leading-6 text-slate-600">
        This page has expired. Please{" "}
        <Link href="/portal/login" className="font-medium text-navy-700 underline">
          sign in
        </Link>{" "}
        again to continue.
      </p>
    );
  } else if (codes) {
    body = <RecoveryCodes codes={codes} onDone={finish} />;
  } else if (status.mustChangePassword) {
    body = (
      <form onSubmit={onPassword} className="space-y-4" noValidate>
        <div>
          <h2 className="text-lg font-semibold text-navy-900">Choose a new password</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            You signed in with a temporary password from the pharmacy. Replace it with one only you know.
          </p>
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required className="input-field" />
          <p className="mt-1 text-xs text-slate-500">At least 12 characters, with upper- and lowercase letters and a number.</p>
        </div>
        <div>
          <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-slate-700">Confirm new password</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="input-field" />
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
    );
  } else if (totp) {
    body = (
      <form onSubmit={onConfirmTotp} className="space-y-4" noValidate>
        <div>
          <h2 className="text-lg font-semibold text-navy-900">Set up your authenticator app</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-600">
            <li>Open Google Authenticator, Microsoft Authenticator, 1Password or a similar app.</li>
            <li>Add an account and scan this QR code.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
        </div>
        {/* data: URL from the server — allowed by the CSP's img-src. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={totp.qr} alt="QR code for your authenticator app" width={220} height={220} className="mx-auto rounded-lg border border-slate-200" />
        <details className="text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-navy-700">Can&apos;t scan? Enter this key instead</summary>
          <p className="mt-2 break-all rounded-lg bg-slate-50 p-3 font-mono text-sm tracking-wider text-slate-800">
            {totp.secret.match(/.{1,4}/g)?.join(" ")}
          </p>
          <p className="mt-1 text-xs text-slate-500">Letters and the numbers 2–7 only — any &ldquo;O&rdquo; is the letter, never a zero.</p>
        </details>
        <div>
          <label htmlFor="code" className="mb-1.5 block text-sm font-medium text-slate-700">Code from the app</label>
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
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Checking…" : "Confirm"}
        </button>
        <button type="button" onClick={() => setTotp(null)} className="w-full text-center text-sm font-medium text-navy-700 underline">
          Back
        </button>
      </form>
    );
  } else {
    body = (
      <div className="space-y-5">
        <p className="text-sm leading-6 text-slate-600">
          {status.signedIn
            ? "Add another way to sign in."
            : "Choose how you'll confirm it's you each time you sign in. You'll only need to do this once on each device."}
        </p>
        {canPasskey && (
          <div className="rounded-xl border border-navy-200 bg-navy-50/50 p-4">
            <p className="font-semibold text-navy-900">
              Passkey <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Recommended</span>
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Sign in with Face ID, Touch ID, Windows Hello or your phone&apos;s screen lock. No codes to type, and you
              won&apos;t need your password.
            </p>
            <button type="button" onClick={onPasskey} disabled={busy} className="btn-primary mt-3 w-full">
              {busy ? "Waiting for your device…" : "Create a passkey"}
            </button>
          </div>
        )}
        {!status.factors?.totp && (
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="font-semibold text-navy-900">Authenticator app</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Enter your password, then a 6-digit code from an app like Google Authenticator.
            </p>
            <button type="button" onClick={onStartTotp} disabled={busy} className="btn-outline mt-3 w-full">
              Use an authenticator app
            </button>
          </div>
        )}
        {status.signedIn && (
          <Link href="/portal/security" className="block text-center text-sm font-medium text-navy-700 underline">
            Cancel
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHero
        title="Secure your account"
        subtitle={isNew ? "Your account is created — one last step." : "Protect your health information."}
      />
      <section className="py-16">
        <div className="container-site max-w-md">
          <div className="card space-y-5">
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}
            {body}
          </div>
        </div>
      </section>
    </>
  );
}

export default function SetupSecurityPage() {
  return (
    <Suspense>
      <SetupSecurity />
    </Suspense>
  );
}
