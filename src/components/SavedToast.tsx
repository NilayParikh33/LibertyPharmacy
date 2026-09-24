"use client";

import { Check, X } from "lucide-react";

/**
 * Confirmation toast for saved-list changes.
 *
 * The live region is always mounted (only its contents change) so screen
 * readers reliably announce each message. Bottom-centre on phones, where the
 * thumb is; bottom-right on larger screens, out of the reading path.
 */
export default function SavedToast({
  toast,
  onView,
  onDismiss,
}: {
  toast: { id: number; message: string } | null;
  onView: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4 sm:bottom-6 sm:justify-end sm:px-6"
    >
      {toast && (
        <div
          key={toast.id}
          className="lp-toast pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-navy-950 px-4 py-3 text-sm text-white shadow-lift"
        >
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
            <Check aria-hidden="true" className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <p className="flex-1 leading-5">{toast.message}</p>
          <button
            type="button"
            onClick={onView}
            className="rounded-full px-2.5 py-1 text-sm font-semibold text-liberty-gold transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-liberty-gold"
          >
            View list
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
