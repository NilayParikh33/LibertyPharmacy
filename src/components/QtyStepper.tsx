"use client";

import { Minus, Plus } from "lucide-react";
import { MAX_QTY } from "@/lib/saved-list";

/** Compact −/+ quantity control. The number is announced via aria-live. */
export default function QtyStepper({
  value,
  onChange,
  label,
  size = "md",
}: {
  value: number;
  onChange: (next: number) => void;
  /** Accessible name, e.g. "Quantity of Vitamin D & Calcium". */
  label: string;
  size?: "sm" | "md";
}) {
  const btn =
    size === "sm"
      ? "h-8 w-8"
      : "h-11 w-11";
  const btnClass = `inline-flex ${btn} items-center justify-center rounded-full text-navy-700 transition-[background-color,transform] duration-150 ease-premium hover:bg-navy-50 active:scale-90 motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-700`;

  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center rounded-full border border-slate-200 bg-white p-0.5 shadow-card"
    >
      <button
        type="button"
        className={btnClass}
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label="Decrease quantity"
      >
        <Minus aria-hidden="true" className="h-4 w-4" />
      </button>
      <span
        aria-live="polite"
        className={`min-w-[2.25rem] text-center font-semibold tabular-nums text-navy-950 ${size === "sm" ? "text-sm" : "text-base"}`}
      >
        {value}
      </span>
      <button
        type="button"
        className={btnClass}
        onClick={() => onChange(value + 1)}
        disabled={value >= MAX_QTY}
        aria-label="Increase quantity"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
