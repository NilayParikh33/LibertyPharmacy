"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Status = "new" | "in_progress" | "completed" | "cancelled";

/**
 * Status and internal note for one refill/transfer request. The note is for
 * staff only; patients see just the status.
 */
export default function RxRequestControl({
  id,
  status: initialStatus,
  staffNote: initialNote,
}: {
  id: number;
  status: Status;
  staffNote: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialStatus);
  const [note, setNote] = useState(initialNote);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const dirty = status !== initialStatus || note !== initialNote;

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, staffNote: note }),
      });
      if (!res.ok) {
        setMessage("Couldn't save. Please try again.");
        return;
      }
      setMessage("Saved.");
      router.refresh();
    } catch {
      setMessage("Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={`status-${id}`} className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Status
        </label>
        <select
          id={`status-${id}`}
          value={status}
          disabled={busy}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
        >
          <option value="new">New</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <div>
        <label htmlFor={`note-${id}`} className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Internal note (staff only)
        </label>
        <textarea
          id={`note-${id}`}
          value={note}
          disabled={busy}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={1000}
          className="input-field mt-1"
        />
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy || !dirty} className="btn-primary btn-sm">
          {busy ? "Saving…" : "Save"}
        </button>
        {message && (
          <span role="status" className="text-xs text-slate-600">
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
