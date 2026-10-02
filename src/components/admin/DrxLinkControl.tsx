"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Shows which DRX patient a portal patient is linked to, and lets staff set or
 * clear it by hand (src/app/api/admin/patients/[id]/drx). Only for after the
 * patient's identity was checked by phone; the server also refuses an id
 * whose DRX date of birth doesn't match.
 */
export default function DrxLinkControl({ patientId, drxPatientId }: { patientId: number; drxPatientId: number | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(next: number | null) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/patients/${patientId}/drx`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drxPatientId: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Couldn't save. Please try again.");
        return;
      }
      setEditing(false);
      setValue("");
      router.refresh();
    } catch {
      setMessage("Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
      <span>
        DRX patient: {drxPatientId !== null ? <strong className="text-navy-900">#{drxPatientId}</strong> : "not linked"}
      </span>
      {!editing ? (
        <>
          <button type="button" onClick={() => setEditing(true)} className="font-medium text-navy-700 underline">
            {drxPatientId !== null ? "Change" : "Link by hand"}
          </button>
          {drxPatientId !== null && (
            <button
              type="button"
              disabled={busy}
              onClick={() => save(null)}
              className="font-medium text-red-700 underline disabled:opacity-50"
            >
              Unlink
            </button>
          )}
        </>
      ) : (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^\d{1,10}$/.test(value.trim())) {
              setMessage("Enter the DRX patient ID (digits only).");
              return;
            }
            save(Number(value.trim()));
          }}
        >
          <label htmlFor={`drx-id-${patientId}`} className="sr-only">
            DRX patient ID
          </label>
          <input
            id={`drx-id-${patientId}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="numeric"
            placeholder="DRX patient ID"
            className="w-36 rounded-lg border border-slate-300 px-2 py-1 text-xs"
          />
          <button type="submit" disabled={busy} className="rounded-lg bg-navy-700 px-3 py-1 font-semibold text-white disabled:opacity-50">
            {busy ? "Checking…" : "Save"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="underline">
            Cancel
          </button>
        </form>
      )}
      {message && (
        <span role="status" className="text-red-700">
          {message}
        </span>
      )}
    </div>
  );
}
