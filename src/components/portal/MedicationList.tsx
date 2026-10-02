"use client";

import { useState } from "react";
import type { DrxMedication } from "@/lib/drx";
import RequestSent from "./RequestSent";

const MAX_ITEMS = 10;

function fmt(date: string | null) {
  if (!date) return null;
  const d = new Date(`${date.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** Why a prescription can't be refilled online, or null if it can. */
export function refillBlocker(m: DrxMedication, today: string): string | null {
  if (m.inactive) return "No longer active";
  if (m.expiresDate && m.expiresDate.slice(0, 10) < today) return "Expired: we can ask your prescriber for a new one";
  if (m.quantityRemaining !== null && m.quantityRemaining <= 0) return "No refills left: we can ask your prescriber";
  return null;
}

/**
 * The patient's prescriptions from the pharmacy, with tick-boxes to request
 * refills. Submits to the same endpoint as the manual refill form, so the
 * request is stored, queued for staff and forwarded to DRX the same way.
 */
export default function MedicationList({
  medications,
  today,
  defaultDelivery,
  phone,
  phoneHref,
}: {
  medications: DrxMedication[];
  today: string;
  defaultDelivery: string;
  phone: string;
  phoneHref: string;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentId, setSentId] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const active = medications.filter((m) => !m.inactive);
  const inactive = medications.filter((m) => m.inactive);

  function toggle(rx: string) {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(rx)) next.delete(rx);
      else if (next.size < MAX_ITEMS) next.add(rx);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (picked.size === 0) {
      setError("Tick the prescriptions you want refilled.");
      return;
    }
    const f = new FormData(e.currentTarget);
    const items = medications
      .filter((m) => picked.has(m.rxNumber))
      .map((m) => ({ rxNumber: m.rxNumber, drugName: (m.drugName ?? "").slice(0, 100) }));
    setBusy(true);
    try {
      const res = await fetch("/api/portal/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "refill",
          items,
          deliveryMethod: f.get("deliveryMethod"),
          note: (f.get("note") as string | null)?.trim() ?? "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: number; error?: string };
      if (res.status === 401) {
        setError("Your session has ended. Please sign in again.");
        return;
      }
      if (!res.ok || typeof data.id !== "number") {
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
    return <RequestSent title="Refill request received" id={sentId} phone={phone} phoneHref={phoneHref} />;
  }

  const row = (m: DrxMedication) => {
    const blocker = refillBlocker(m, today);
    const id = `med-${m.rxNumber}`;
    return (
      <li key={m.rxNumber} className="flex gap-4 p-4">
        <div className="pt-1">
          {blocker ? (
            <span className="block h-4 w-4" aria-hidden="true" />
          ) : (
            <input
              id={id}
              type="checkbox"
              checked={picked.has(m.rxNumber)}
              onChange={() => toggle(m.rxNumber)}
              className="h-4 w-4 rounded border-slate-300"
            />
          )}
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <label htmlFor={blocker ? undefined : id} className="font-semibold text-navy-900">
            {m.drugName ?? "Prescription"}
          </label>
          {m.directions && <p className="mt-0.5 text-slate-700">{m.directions}</p>}
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Rx {m.rxNumber}
            {m.prescriber ? ` · ${m.prescriber}` : ""}
            {m.lastFillDate ? ` · Last filled ${fmt(m.lastFillDate)}` : ""}
            {m.lastFillStatus && m.lastFillStatus !== "Sold" ? ` (${m.lastFillStatus})` : ""}
            {m.quantityRemaining !== null ? ` · ${m.quantityRemaining} left on this Rx` : ""}
            {m.expiresDate ? ` · Expires ${fmt(m.expiresDate)}` : ""}
          </p>
          {blocker && <p className="mt-1 text-xs font-medium text-amber-800">{blocker}</p>}
        </div>
      </li>
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {active.length === 0 ? (
        <p className="card text-sm text-slate-600">
          We don&apos;t see any active prescriptions on your record. If that looks wrong, please call us.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">{active.map(row)}</ul>
      )}

      {inactive.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className="text-sm font-medium text-navy-700 underline"
            aria-expanded={showInactive}
          >
            {showInactive ? "Hide" : "Show"} past prescriptions ({inactive.length})
          </button>
          {showInactive && (
            <ul className="mt-3 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white opacity-80">
              {inactive.map(row)}
            </ul>
          )}
        </div>
      )}

      {active.length > 0 && (
        <div className="card space-y-5">
          <h2 className="text-base font-semibold text-navy-900">
            Refill {picked.size > 0 ? `${picked.size} selected` : "selected prescriptions"}
          </h2>
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="deliveryMethod" className="mb-1.5 block text-sm font-medium text-slate-700">
              How would you like to get them?
            </label>
            <select id="deliveryMethod" name="deliveryMethod" defaultValue={defaultDelivery} className="input-field">
              <option value="pickup">Pick up at the pharmacy</option>
              <option value="delivery">Local delivery</option>
              <option value="mail">Mail</option>
            </select>
          </div>
          <div>
            <label htmlFor="note" className="mb-1.5 block text-sm font-medium text-slate-700">
              Anything we should know? (optional)
            </label>
            <textarea id="note" name="note" rows={2} maxLength={500} className="input-field" />
          </div>
          <button type="submit" disabled={busy || picked.size === 0} className="btn-primary">
            {busy ? "Sending…" : "Request refill"}
          </button>
        </div>
      )}
    </form>
  );
}
