"use client";

import { useState } from "react";
import RequestSent from "./RequestSent";

const inputCls = "input-field";
const labelCls = "mb-1.5 block text-sm font-medium text-slate-700";

/**
 * Prescription transfer request. The patient says which pharmacy currently
 * holds their prescriptions and which ones to move; we contact that pharmacy.
 * Because that means sharing their information with another pharmacy, the
 * form requires an explicit authorization. Who they are comes from the
 * signed-in session on the server.
 */
export default function TransferForm({ phone, phoneHref }: { phone: string; phoneHref: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentId, setSentId] = useState<number | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const f = new FormData(e.currentTarget);
    const v = (k: string) => (f.get(k) as string | null)?.trim() ?? "";

    setBusy(true);
    try {
      const res = await fetch("/api/portal/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "transfer",
          fromPharmacyName: v("fromPharmacyName"),
          fromPharmacyPhone: v("fromPharmacyPhone"),
          fromPharmacyCity: v("fromPharmacyCity"),
          medications: v("medications"),
          note: v("note"),
          authorize: f.get("authorize") === "on",
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setError("Your session has ended. Please sign in again.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "We couldn't send your request. Please try again or call us.");
        return;
      }
      setSentId(data.id);
    } catch {
      setError("Something went wrong. Please try again or call us.");
    } finally {
      setBusy(false);
    }
  }

  if (sentId !== null) {
    return (
      <RequestSent
        title="Transfer request received"
        id={sentId}
        phone={phone}
        phoneHref={phoneHref}
        next="When you pick up or receive your prescription, keep the label: entering its Rx number on your portal page connects your account so you can refill online from then on."
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-6" noValidate>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div>
        <h2 className="text-base font-semibold text-navy-900">Where are your prescriptions now?</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="fromPharmacyName" className={labelCls}>
              Current pharmacy name *
            </label>
            <input id="fromPharmacyName" name="fromPharmacyName" maxLength={150} autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label htmlFor="fromPharmacyPhone" className={labelCls}>
              Their phone number *
            </label>
            <input id="fromPharmacyPhone" name="fromPharmacyPhone" type="tel" maxLength={20} autoComplete="off" className={inputCls} />
          </div>
          <div>
            <label htmlFor="fromPharmacyCity" className={labelCls}>
              City or store location
            </label>
            <input id="fromPharmacyCity" name="fromPharmacyCity" maxLength={100} autoComplete="off" className={inputCls} />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <label htmlFor="medications" className={labelCls}>
          Which medications should we transfer? *
        </label>
        <textarea
          id="medications"
          name="medications"
          rows={4}
          maxLength={1000}
          placeholder="One per line, for example: Lisinopril 10 mg"
          className={inputCls}
        />
        <p className="mt-1 text-xs text-slate-500">
          Some controlled medications have limits on transferring, and we&apos;ll tell you if any of yours can&apos;t be moved.
        </p>
      </div>

      <div>
        <label htmlFor="note" className={labelCls}>
          Anything else we should know? (optional)
        </label>
        <textarea id="note" name="note" rows={3} maxLength={500} className={inputCls} />
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        <input type="checkbox" name="authorize" className="mt-1 h-4 w-4 shrink-0" />
        <span>
          I ask Liberty Pharmacy to contact the pharmacy above and transfer these prescriptions to us, and I allow them to
          share the information needed to do so. *
        </span>
      </label>

      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? "Sending…" : "Send transfer request"}
      </button>
      <p className="text-xs text-slate-500">
        Prefer to talk it through? Call{" "}
        <a href={phoneHref} className="font-semibold text-navy-700 underline">
          {phone}
        </a>
        .
      </p>
    </form>
  );
}
