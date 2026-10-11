"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ChangePassword from "./ChangePassword";
import RecoveryCodes from "./RecoveryCodes";
import { postJson } from "./device-client";

type Factors = {
  passkeys: number;
  totp: boolean;
  recoveryCodesLeft: number;
  passkeyList: { id: number; createdAt: string; lastUsedAt: string | null; synced: boolean }[];
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

/** Signed-in patient's passkeys, authenticator app and recovery codes. */
export default function SecuritySettings() {
  const [f, setF] = useState<Factors | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/auth/device/factors").catch(() => null);
    if (res?.ok) setF(await res.json());
    else setError("Couldn't load your sign-in settings. Please refresh.");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(url: string, body?: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    const r = await postJson(url, body);
    if (!r.ok) {
      setError(r.data.error ?? "That didn't work. Please try again.");
      return;
    }
    if (Array.isArray(r.data.recoveryCodes)) setCodes(r.data.recoveryCodes as string[]);
    await load();
  }

  if (codes) {
    return (
      <div className="card">
        <RecoveryCodes codes={codes} onDone={() => setCodes(null)} doneLabel="Done" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {!f ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : (
        <>
          <div className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-navy-900">Passkeys</h2>
              <Link href="/portal/setup-security" className="btn-outline btn-sm">
                Add a passkey or app
              </Link>
            </div>
            {f.passkeyList.length === 0 ? (
              <p className="text-sm text-slate-600">No passkeys yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {f.passkeyList.map((p, i) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <span className="text-slate-700">
                      <span className="font-medium">Passkey {i + 1}</span>
                      {p.synced && <span className="ml-2 text-xs text-slate-500">synced</span>}
                      <span className="block text-xs text-slate-500">
                        Added {fmt(p.createdAt)}
                        {p.lastUsedAt ? ` · last used ${fmt(p.lastUsedAt)}` : ""}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => act("/api/auth/device/passkey/remove", { id: p.id }, "Remove this passkey?")}
                      className="text-sm font-medium text-red-700 underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card space-y-3">
            <h2 className="text-lg font-semibold text-navy-900">Authenticator app</h2>
            {f.totp ? (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="text-slate-700">On</span>
                <button
                  type="button"
                  onClick={() => act("/api/auth/device/totp/remove", undefined, "Turn off the authenticator app?")}
                  className="text-sm font-medium text-red-700 underline"
                >
                  Turn off
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                Not set up.{" "}
                <Link href="/portal/setup-security" className="font-medium text-navy-700 underline">
                  Set it up
                </Link>
              </p>
            )}
          </div>

          <ChangePassword hasPasskey={f.passkeys > 0} hasTotp={f.totp} />

          <div className="card space-y-3">
            <h2 className="text-lg font-semibold text-navy-900">Recovery codes</h2>
            <p className="text-sm leading-6 text-slate-600">
              {f.recoveryCodesLeft} of 10 unused. Each one signs you in once if you lose your phone or passkey.
            </p>
            <button
              type="button"
              onClick={() =>
                act("/api/auth/device/recovery/regenerate", undefined, "Make new recovery codes? Your old codes will stop working.")
              }
              className="btn-outline btn-sm"
            >
              Make new codes
            </button>
          </div>
        </>
      )}
    </div>
  );
}
