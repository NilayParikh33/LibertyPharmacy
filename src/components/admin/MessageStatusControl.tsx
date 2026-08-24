"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Status = "new" | "read" | "replied";

export default function MessageStatusControl({ id, status }: { id: number; status: Status }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function updateStatus(next: Status) {
    setBusy(true);
    try {
      await fetch(`/api/admin/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      value={status}
      disabled={busy}
      onChange={(e) => updateStatus(e.target.value as Status)}
      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 disabled:opacity-60"
      aria-label="Message status"
    >
      <option value="new">New</option>
      <option value="read">Read</option>
      <option value="replied">Replied</option>
    </select>
  );
}
