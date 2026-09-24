"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Heart, Phone, RefreshCw } from "lucide-react";
import QtyStepper from "./QtyStepper";
import { useSavedList } from "@/lib/saved-list";
import type { Product } from "@/lib/products";

/**
 * Quantity + "Save to list" on the product page — the add-to-cart moment.
 *
 * Feedback sequence on save, all in the same frame as the click:
 *  1. the button presses (scale) and turns green with a check that pops;
 *  2. the toast confirms "Saved … to your list" (and screen readers hear it);
 *  3. the header heart and its badge pop;
 *  4. the button settles into a "Saved · View list" state that persists.
 * No page load at any point.
 */
export default function ProductSavePanel({
  product,
  phone,
  phoneHref,
}: {
  product: Product;
  phone: string;
  phoneHref: string;
}) {
  const { ready, has, qtyOf, save, openDrawer } = useSavedList();
  const saved = ready && has(product.id);
  const savedQty = qtyOf(product.id);
  const [qty, setQty] = useState(1);
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const synced = useRef(false);

  // Once the saved list has loaded, start the stepper at the saved quantity.
  useEffect(() => {
    if (!ready || synced.current) return;
    synced.current = true;
    if (savedQty) setQty(savedQty);
  }, [ready, savedQty]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    []
  );

  const dirty = saved && qty !== savedQty;

  const doSave = () => {
    save(product.id, qty);
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 1800);
  };

  let button: { label: string; icon: typeof Heart; onClick: () => void; className: string };
  if (flash) {
    button = {
      label: "Saved to your list",
      icon: Check,
      onClick: () => openDrawer(null),
      className: "btn bg-emerald-600 text-white shadow-card hover:bg-emerald-700 focus-visible:outline-emerald-600",
    };
  } else if (!saved) {
    button = { label: "Save to list", icon: Heart, onClick: doSave, className: "btn-primary" };
  } else if (dirty) {
    button = { label: "Update quantity", icon: RefreshCw, onClick: doSave, className: "btn-primary" };
  } else {
    button = {
      label: "Saved · View list",
      icon: Check,
      onClick: () => openDrawer(null),
      className: "btn-outline border-emerald-200 text-emerald-800 hover:border-emerald-500 hover:bg-emerald-50",
    };
  }
  const ButtonIcon = button.icon;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <QtyStepper value={qty} onChange={setQty} label={`Quantity of ${product.name}`} />
        <button type="button" onClick={button.onClick} className={`${button.className} min-w-[12rem] flex-1`}>
          {/* key replays the pop whenever the state (and so the icon) changes. */}
          <span key={button.label} className={flash ? "lp-pop" : ""}>
            <ButtonIcon aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
          </span>
          {button.label}
        </button>
      </div>
      <a href={phoneHref} className="btn-outline w-full">
        <Phone aria-hidden="true" className="h-4 w-4" />
        Call {phone} to reserve
      </a>
    </div>
  );
}
