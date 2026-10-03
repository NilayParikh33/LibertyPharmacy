"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { Heart, Phone, Trash2, X } from "lucide-react";
import { useSavedList } from "@/lib/saved-list";
import { categoryLabel, getProduct } from "@/lib/products";
import { Icon } from "@/lib/icons";
import QtyStepper from "./QtyStepper";

/**
 * Side drawer listing the visitor's saved products.
 *
 * A modal dialog: focus moves in on open and back to the trigger on close
 * (handled by the provider), Escape and the backdrop close it, Tab is trapped,
 * and the page behind cannot scroll. It ends in a phone call — the only way to
 * "check out" at a pharmacy that doesn't sell online.
 */
export default function SavedListDrawer({ phone, phoneHref }: { phone: string; phoneHref: string }) {
  const { items, setQty, remove, clear, closeDrawer } = useSavedList();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    panelRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeDrawer();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || current === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [closeDrawer]);

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="lp-backdrop absolute inset-0 bg-navy-950/50 backdrop-blur-sm" onClick={closeDrawer} />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="lp-drawer absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-lift focus:outline-none"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-navy-950">
              Your saved list
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {items.length === 0
                ? "Nothing saved yet"
                : `${items.length} ${items.length === 1 ? "item" : "items"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close saved list"
            className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-navy-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-700"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="icon-tile h-14 w-14 rounded-2xl">
              <Heart aria-hidden="true" className="h-6 w-6" />
            </span>
            <p className="mt-4 font-semibold text-navy-950">Keep a list as you browse</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Tap the heart on any product to save it here, then call us and
              we&apos;ll check stock and set everything aside.
            </p>
            <Link href="/products" onClick={closeDrawer} className="btn-primary mt-6">
              Browse products
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto px-6">
              {items.map((item, i) => {
                const product = getProduct(item.id);
                if (!product) return null;
                return (
                  <li
                    key={item.id}
                    className="lp-menu-item flex gap-4 py-5"
                    style={{ "--lp-delay": `${Math.min(i, 5) * 50}ms` } as React.CSSProperties}
                  >
                    <span className="icon-tile">
                      <Icon name={product.icon} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/products/${product.id}`}
                        onClick={closeDrawer}
                        className="block truncate font-semibold text-navy-950 hover:text-navy-700"
                      >
                        {product.name}
                      </Link>
                      <p className="text-xs text-slate-500">{categoryLabel(product.categoryId)}</p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <QtyStepper
                          size="sm"
                          value={item.qty}
                          onChange={(q) => setQty(item.id, q)}
                          label={`Quantity of ${product.name}`}
                        />
                        <button
                          type="button"
                          onClick={() => remove(item.id)}
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-liberty-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-liberty-red"
                        >
                          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-5">
              <p className="text-sm leading-6 text-slate-600">
                Call and read us your list — we&apos;ll confirm stock, check your
                insurance, and set it aside for pickup or delivery.
              </p>
              <a href={phoneHref} className="btn-accent mt-4 w-full">
                <Phone aria-hidden="true" className="h-4 w-4" />
                Call {phone} to reserve
              </a>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>Saved on this device only — nothing is sent to us.</span>
                <button
                  type="button"
                  onClick={clear}
                  className="font-medium underline-offset-2 hover:text-navy-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-700"
                >
                  Clear list
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
