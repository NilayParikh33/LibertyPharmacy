"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useSavedList } from "@/lib/saved-list";

/**
 * Heart toggle on product cards: saves to / removes from the saved list.
 *
 * Feedback is immediate and local (the heart fills and pops), then confirmed
 * globally by the toast and the header badge. The pop only plays in response
 * to a click — never on load for items that were already saved.
 */
export default function SaveToggle({
  productId,
  productName,
  className = "",
}: {
  productId: string;
  productName: string;
  className?: string;
}) {
  const { has, toggle, ready } = useSavedList();
  const [pops, setPops] = useState(0);
  const saved = ready && has(productId);

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${productName} from your saved list` : `Save ${productName} to your list`}
      onClick={() => {
        toggle(productId);
        setPops((n) => n + 1);
      }}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-card ring-1 ring-slate-200/70 backdrop-blur transition-[background-color,box-shadow,transform] duration-200 ease-premium hover:scale-105 hover:shadow-lift active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700 ${className}`}
    >
      <span key={pops} className={pops > 0 ? "lp-pop" : ""}>
        <Heart
          aria-hidden="true"
          className={`h-[1.15rem] w-[1.15rem] transition-colors duration-200 ${
            saved ? "fill-liberty-red text-liberty-red" : "text-slate-500"
          }`}
          strokeWidth={2}
        />
      </span>
    </button>
  );
}
