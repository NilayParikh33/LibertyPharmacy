"use client";

import { useRef, useState } from "react";
import RequestSent from "./RequestSent";

const inputCls = "input-field";
const labelCls = "mb-1.5 block text-sm font-medium text-slate-700";
const MAX_ITEMS = 10;

interface Row {
  key: number;
  rxNumber: string;
  drugName: string;
}

/**
 * Refill request. The patient lists the prescription numbers printed on their
 * bottle labels; who they are comes from their signed-in session on the server,
 * so nothing identifying is sent from here. Nothing is kept in the browser.
 */
export default function RefillForm({
  defaultDelivery,
  phone,
  phoneHref,
}: {
  defaultDelivery: string;
  phone: string;
  phoneHref: string;
}) {
  const nextKey = useRef(2);
  const [rows, setRows] = useState<Row[]>([{ key: 1, rxNumber: "", drugName: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentId, setSentId] = useState<number | null>(null);

  function update(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const f = new FormData(e.currentTarget);
    const items = rows
      .map((r) => ({ rxNumber: r.rxNumber.trim(), drugName: r.drugName.trim() }))
      .filter((r) => r.rxNumber || r.drugName);
    if (items.some((i) => !i.rxNumber)) {
      setError("Each medication needs its prescription number, printed on the bottle label.");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one prescription number.");
      return;
    }

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
    return <RequestSent title="Refill request received" id={sentId} phone={phone} phoneHref={phoneHref} />;
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-6" noValidate>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div>
        <h2 className="text-base font-semibold text-navy-900">Which prescriptions?</h2>
        <p className="mt-1 text-sm text-slate-600">
          Enter the prescription (Rx) number printed on each bottle label. The medication name is optional but helps us
          double-check.
        </p>
        <div className="mt-4 space-y-3">
          {rows.map((r, i) => (
            <div key={r.key} className="grid gap-3 sm:grid-cols-[1fr,1.4fr,auto] sm:items-end">
              <div>
                <label htmlFor={`rx-${r.key}`} className={labelCls}>
                  Rx number {i === 0 ? "*" : ""}
                </label>
                <input
                  id={`rx-${r.key}`}
                  value={r.rxNumber}
                  onChange={(e) => update(r.key, { rxNumber: e.target.value })}
                  maxLength={20}
                  inputMode="text"
                  autoComplete="off"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor={`drug-${r.key}`} className={labelCls}>
                  Medication name
                </label>
                <input
                  id={`drug-${r.key}`}
                  value={r.drugName}
                  onChange={(e) => update(r.key, { drugName: e.target.value })}
                  maxLength={100}
                  autoComplete="off"
                  className={inputCls}
                />
              </div>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  className="btn-outline btn-sm"
                  aria-label={`Remove prescription ${i + 1}`}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={rows.length >= MAX_ITEMS}
          onClick={() => setRows((rs) => [...rs, { key: nextKey.current++, rxNumber: "", drugName: "" }])}
          className="btn-outline btn-sm mt-4"
        >
          Add another prescription
        </button>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <label htmlFor="deliveryMethod" className={labelCls}>
          How would you like to get them? *
        </label>
        <select id="deliveryMethod" name="deliveryMethod" defaultValue={defaultDelivery} className={inputCls}>
          <option value="pickup">Pick up at the pharmacy</option>
          <option value="delivery">Local delivery</option>
          <option value="mail">Mail</option>
        </select>
      </div>

      <div>
        <label htmlFor="note" className={labelCls}>
          Anything we should know? (optional)
        </label>
        <textarea id="note" name="note" rows={3} maxLength={500} className={inputCls} />
        <p className="mt-1 text-xs text-slate-500">
          This goes to our pharmacists only. For an emergency, call 911 or your doctor.
        </p>
      </div>

      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? "Sending…" : "Send refill request"}
      </button>
    </form>
  );
}
