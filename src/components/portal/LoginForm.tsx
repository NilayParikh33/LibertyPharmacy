"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PageHero from "@/components/PageHero";
import { stashDemoOtp } from "@/lib/demo-otp";
import { passkeysSupported, signInWithPasskey } from "./device-client";

/**
 * Patient sign-in. In "device" mode (PATIENT_AUTH_MODE, src/lib/device-auth.ts)
 * it also offers a passkey, and the step after the password is a passkey,
 * authenticator app or recovery code instead of an emailed code.
 */
export default function LoginForm({ mode }: { mode: "email" | "device" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const device = mode === "device";

  async function onPasskey() {
    setError(null);
    if (!passkeysSupported()) {
      setError("This browser doesn't support passkeys. Sign in with your email and password instead.");
      return;
    }
    setPasskeyBusy(true);
    const r = await signInWithPasskey();
    setPasskeyBusy(false);
    if (!r.ok) {
      setError(r.data.error ?? "Couldn't sign in with a passkey.");
      return;
    }
    router.push("/portal");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to sign in. Please try again.");
        return;
      }
      if (data.next === "setup") {
        router.push("/portal/setup-security");
        return;
      }
      if (data.next === "device") {
        const q = new URLSearchParams();
        if (data.methods?.totp) q.set("totp", "1");
        if (data.methods?.passkey) q.set("passkey", "1");
        router.push(`/portal/verify-device?${q}`);
        return;
      }
      stashDemoOtp(data.demoCode);
      router.push("/portal/verify");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHero title="Sign In" subtitle="Access your Liberty Pharmacy account." />
      <section className="py-16">
        <div className="container-site max-w-md">
          <form onSubmit={onSubmit} className="card space-y-5" noValidate>
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}
            {device && (
              <>
                <button
                  type="button"
                  onClick={onPasskey}
                  disabled={passkeyBusy}
                  className="btn-primary w-full disabled:opacity-60"
                >
                  {passkeyBusy ? "Waiting for your device…" : "Sign in with a passkey"}
                </button>
                <p className="text-center text-xs text-slate-500">
                  Face ID, Touch ID, Windows Hello or your phone — if you&apos;ve set one up.
                </p>
                <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
                  <span className="h-px flex-1 bg-slate-200" />
                  or use your email
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
              </>
            )}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input id="email" name="email" type="email" autoComplete="email" required className="input-field" />
            </div>
            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <Link href="/portal/forgot" className="text-sm font-medium text-navy-700 underline">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="input-field"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className={`${device ? "btn-outline" : "btn-primary"} w-full disabled:opacity-60`}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-center text-sm text-slate-600">
              New to Liberty Pharmacy?{" "}
              <Link href="/portal/register" className="font-medium text-navy-700 underline">
                Create your account
              </Link>
            </p>
          </form>
        </div>
      </section>
    </>
  );
}
