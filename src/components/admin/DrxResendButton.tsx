"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Sends one refill request to DRX again (src/app/api/admin/requests/[id]/drx). */
export default function DrxResendButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/requests/${id}/drx`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "Couldn't send. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setMessage("Couldn't send. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={resend}
        disabled={busy}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send to DRX again"}
      </button>
      {message && (
        <span role="status" className="text-xs text-red-700">
          {message}
        </span>
      )}
    </span>
  );
}
