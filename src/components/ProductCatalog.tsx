"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Reveal from "./Reveal";
import {
  categoryLabel,
  productCategories,
  productsByCategory,
  type Product,
} from "@/lib/products";

/**
 * Browsable product catalog.
 *
 * Category filter + click-to-open detail dialog. All content is static public
 * marketing copy (see src/lib/products.ts) — no PHI, no session, no network.
 *
 * Accessibility:
 *  - Filters are toggle buttons with aria-pressed (not tabs — there is no
 *    separate tabpanel per category, just one filtered grid).
 *  - Cards are real <button>s, so keyboard and Enter/Space work for free.
 *  - The detail panel is a modal dialog: focus moves in on open and returns to
 *    the originating card on close, Escape closes it, Tab is trapped inside,
 *    and background scroll is locked while it is open.
 */
export default function ProductCatalog({
  phone,
  phoneHref,
  initialCategory = "all",
}: {
  phone: string;
  phoneHref: string;
  /** Preselected filter, e.g. from /products?category=wellness. */
  initialCategory?: string;
}) {
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [selected, setSelected] = useState<Product | null>(null);

  const visible = useMemo(() => productsByCategory(activeCategory), [activeCategory]);
  const activeBlurb = productCategories.find((c) => c.id === activeCategory)?.blurb;

  // The card that opened the dialog, so focus can return there on close.
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setSelected(null);
    // Return focus to the card the user came from.
    triggerRef.current?.focus();
    triggerRef.current = null;
  }, []);

  return (
    <>
      {/* --- Category filter ------------------------------------------------ */}
      <div
        role="group"
        aria-label="Filter products by category"
        className="flex flex-wrap justify-center gap-2"
      >
        {productCategories.map((cat) => {
          const active = cat.id === activeCategory;
          return (
            <button
              key={cat.id}
              type="button"
              aria-pressed={active}
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700 ${
                active
                  ? "bg-navy-700 text-white shadow-md"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-navy-300 hover:text-navy-700"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {activeBlurb && (
        // key forces a re-mount so the blurb re-animates on every filter change.
        // Prefixed because the grid below is a sibling keyed on the same value.
        <p key={`blurb-${activeCategory}`} className="lp-enter mt-6 text-center text-sm text-slate-600">
          {activeBlurb}
        </p>
      )}

      {/* --- Product grid ---------------------------------------------------
       * key={activeCategory} remounts the grid on filter change so the stagger
       * animation replays for the new set.
       */}
      <div
        key={`grid-${activeCategory}`}
        className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        aria-live="polite"
      >
        {visible.map((product, i) => (
          <Reveal as="div" key={product.id} delay={i * 70} variant="scale" className="flex">
            <button
              type="button"
              onClick={(e) => {
                triggerRef.current = e.currentTarget;
                setSelected(product);
              }}
              aria-haspopup="dialog"
              className="card lp-lift group flex w-full flex-col items-start text-left"
            >
              <ProductMedia product={product} />
              <h3 className="mt-4 text-base font-semibold text-navy-900">{product.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{product.summary}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700">
                View details
                <span
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </span>
            </button>
          </Reveal>
        ))}
      </div>

      {selected && (
        <ProductDialog product={selected} onClose={close} phone={phone} phoneHref={phoneHref} />
      )}
    </>
  );
}

/**
 * Card media tile — the product photograph, zooming gently while the card is
 * hovered or keyboard-focused.
 *
 * Until the client supplies photography, `image` is unset and this renders a
 * tinted tile with the product's emoji instead, so the grid keeps a consistent
 * shape either way. Adding a photo later is a one-line data change.
 */
function ProductMedia({ product }: { product: Product }) {
  return (
    <div className="lp-media relative aspect-[4/3] w-full rounded-lg bg-gradient-to-br from-navy-50 via-white to-slate-100">
      {product.image ? (
        // Plain <img>, not next/image: the site ships no image optimizer in its
        // Docker runtime and the CSP allows img-src 'self' only, so these are
        // served straight from public/.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.image}
          alt={product.imageAlt ?? ""}
          loading="lazy"
          className="lp-media-img h-full w-full rounded-lg object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="lp-media-img flex h-full w-full items-center justify-center text-5xl"
        >
          {product.icon}
        </span>
      )}
      {product.badge && (
        <span className="absolute right-2.5 top-2.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-navy-700 shadow-sm">
          {product.badge}
        </span>
      )}
    </div>
  );
}

/** Modal detail panel for a single product. */
function ProductDialog({
  product,
  onClose,
  phone,
  phoneHref,
}: {
  product: Product;
  onClose: () => void;
  phone: string;
  phoneHref: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    // Move focus into the dialog so the next Tab stays inside it.
    panelRef.current?.focus();

    // Lock background scroll while the dialog is open.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      // Minimal focus trap — keep Tab cycling within the panel.
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
  }, [onClose]);

  return (
    <div
      className="lp-backdrop fixed inset-0 z-[60] flex items-end justify-center bg-navy-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        // Clicks inside the panel must not reach the backdrop's close handler.
        onClick={(e) => e.stopPropagation()}
        className="lp-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl focus:outline-none sm:rounded-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="lp-panel-item">
            <span className="text-xs font-semibold uppercase tracking-wide text-navy-600">
              {categoryLabel(product.categoryId)}
            </span>
            <h2 id={titleId} className="mt-1 text-xl font-bold text-navy-900">
              <span aria-hidden="true" className="mr-2">
                {product.icon}
              </span>
              {product.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product details"
            className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {product.image && (
          <div className="lp-panel-item mt-5 overflow-hidden rounded-xl" style={{ animationDelay: "40ms" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image}
              alt={product.imageAlt ?? ""}
              className="aspect-[16/9] w-full object-cover"
            />
          </div>
        )}

        <p
          className="lp-panel-item mt-5 text-sm leading-7 text-slate-700"
          style={{ animationDelay: "60ms" }}
        >
          {product.description}
        </p>

        <ul className="lp-panel-item mt-6 space-y-2.5" style={{ animationDelay: "120ms" }}>
          {product.details.map((d) => (
            <li key={d} className="flex gap-3 text-sm leading-6 text-slate-600">
              <span aria-hidden="true" className="mt-0.5 font-bold text-liberty-red">
                ✓
              </span>
              <span>{d}</span>
            </li>
          ))}
        </ul>

        <div
          className="lp-panel-item mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600"
          style={{ animationDelay: "180ms" }}
        >
          <span className="font-semibold text-navy-900">Availability:</span> {product.availability}
        </div>

        <div className="lp-panel-item mt-6 flex flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
          <a href={phoneHref} className="btn-accent">
            Call {phone}
          </a>
          <button type="button" onClick={onClose} className="btn-outline">
            Keep browsing
          </button>
        </div>

        <p
          className="lp-panel-item mt-5 text-xs leading-5 text-slate-500"
          style={{ animationDelay: "300ms" }}
        >
          Product information is general and not medical advice. Prescription items require a
          valid prescription. Speak with our pharmacists about what&apos;s right for you.
        </p>
      </div>
    </div>
  );
}
