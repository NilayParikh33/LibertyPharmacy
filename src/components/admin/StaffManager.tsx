"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PendingInvite, StaffRow } from "@/lib/admin-staff";

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Never";

/** Admin → Staff: add people with a one-time setup link, disable, re-send. */
export default function StaffManager({ staff, invites, currentId }: { staff: StaffRow[]; invites: PendingInvite[]; currentId: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ username: string; url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function call(url: string, method: string, body?: unknown, username?: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; link?: string; expiresAt?: string };
      if (!res.ok) {
        setError(data.error ?? "That didn't work. Please try again.");
        return;
      }
      if (data.link && username) {
        setLink({ username, url: data.link, expiresAt: data.expiresAt ?? "" });
        setCopied(false);
      }
      router.refresh();
    } catch {
      setError("That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const username = String(new FormData(form).get("username") ?? "").trim().toLowerCase();
    await call("/api/admin/staff", "POST", { username }, username);
    form.reset();
  }

  return (
    <div className="space-y-8">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {link && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Setup link for {link.username} — shown once</p>
          <p className="mt-2 break-all rounded-lg bg-white p-3 font-mono text-xs text-slate-800">{link.url}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link.url);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
              className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <span className="text-xs">Works once, until {fmt(link.expiresAt)}.</span>
          </div>
          <p className="mt-2 text-xs leading-5">
            Send it only to {link.username}, by text or in person. Anyone with the link can set up this login. If it goes
            to the wrong person, cancel it below.
          </p>
        </div>
      )}

      <form onSubmit={onAdd} className="flex max-w-lg flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
            Add a staff member
          </label>
          <input id="username" name="username" required placeholder="e.g. jpatel" autoComplete="off" className="input-field" />
        </div>
        <button type="submit" disabled={busy} className="btn-primary btn-sm">
          Create setup link
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Last sign-in</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium text-slate-800">
                  {s.username}
                  {s.id === currentId && <span className="ml-2 text-xs text-slate-500">(you)</span>}
                </td>
                <td className="px-4 py-3 text-slate-600">{fmt(s.lastLoginAt)}</td>
                <td className="px-4 py-3">
                  {s.disabled ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Disabled</span>
                  ) : (
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-800">Active</span>
                  )}
                </td>
                <td className="space-x-3 px-4 py-3 text-right text-xs">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`New setup link for ${s.username}? When they complete it, their old password and authenticator stop working.`))
                        call(`/api/admin/staff/${s.id}/invite`, "POST", undefined, s.username);
                    }}
                    className="font-semibold text-navy-700 underline"
                  >
                    New setup link
                  </button>
                  {s.id !== currentId &&
                    (s.disabled ? (
                      <button type="button" disabled={busy} onClick={() => call(`/api/admin/staff/${s.id}`, "PATCH", { disabled: false })} className="font-semibold text-navy-700 underline">
                        Enable
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Disable ${s.username}? They're signed out immediately and can't sign in until enabled again.`))
                            call(`/api/admin/staff/${s.id}`, "PATCH", { disabled: true });
                        }}
                        className="font-semibold text-red-700 underline"
                      >
                        Disable
                      </button>
                    ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invites.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-navy-900">Setup links not used yet</h2>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="text-slate-700">
                  <span className="font-medium">{i.username}</span> — created by {i.createdBy}, expires {fmt(i.expiresAt)}
                </span>
                <button type="button" disabled={busy} onClick={() => call(`/api/admin/staff/invites/${i.id}`, "DELETE")} className="text-xs font-semibold text-red-700 underline">
                  Cancel link
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
