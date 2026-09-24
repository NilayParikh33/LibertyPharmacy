"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import Reveal from "./Reveal";
import ProductCard from "./ProductCard";
import { productCategories, productsByCategory, searchProducts } from "@/lib/products";
import { stagger } from "@/lib/motion";

/**
 * Browsable product catalog: search + category filter over a card grid.
 *
 * All content is static public marketing copy (src/lib/products.ts) — no PHI,
 * no session, no network. Filtering is instant and client-side.
 *
 * The current filter is mirrored into the URL (?category=…&q=…) with
 * history.replaceState, so a filtered view can be shared or bookmarked
 * without adding a history entry per keystroke.
 *
 * Accessibility:
 *  - Category filters are toggle buttons with aria-pressed (not tabs — there
 *    is one filtered grid, not a panel per category).
 *  - The result count is a polite live region, so filtering is announced.
 */
export default function ProductCatalog({
  initialCategory = "all",
  initialQuery = "",
}: {
  /** Preselected filter, e.g. from /products?category=wellness. */
  initialCategory?: string;
  initialQuery?: string;
}) {
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(
    () => searchProducts(productsByCategory(activeCategory), query),
    [activeCategory, query]
  );
  const activeBlurb = productCategories.find((c) => c.id === activeCategory)?.blurb;

  // Mirror the filter into the address bar.
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeCategory !== "all") params.set("category", activeCategory);
    if (query.trim()) params.set("q", query.trim());
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [activeCategory, query]);

  const resetAll = () => {
    setQuery("");
    setActiveCategory("all");
    inputRef.current?.focus();
  };

  return (
    <>
      {/* --- Search ------------------------------------------------------- */}
      <div className="mx-auto max-w-xl">
        <label htmlFor="product-search" className="sr-only">
          Search products
        </label>
        <div className="group relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-navy-600"
          />
          <input
            ref={inputRef}
            id="product-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vitamins, supplies, compounding…"
            autoComplete="off"
            className="input-field rounded-full py-3.5 pl-12 pr-12 text-base [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-navy-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-700"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* --- Category filter ---------------------------------------------- */}
      <div role="group" aria-label="Filter products by category" className="mt-6 flex flex-wrap justify-center gap-2">
        {productCategories.map((cat) => {
          const active = cat.id === activeCategory;
          return (
            <button
              key={cat.id}
              type="button"
              aria-pressed={active}
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-[background-color,color,border-color,box-shadow] duration-200 ease-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700 ${
                active
                  ? "bg-navy-900 text-white shadow-glow-navy"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-navy-300 hover:text-navy-900"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col items-center gap-1 text-center">
        {activeBlurb && !query && (
          // key replays the fade each time the category changes.
          <p key={`blurb-${activeCategory}`} className="lp-enter text-sm text-slate-600">
            {activeBlurb}
          </p>
        )}
        <p aria-live="polite" className="text-xs font-medium text-slate-500">
          {visible.length === 1 ? "1 product" : `${visible.length} products`}
          {query.trim() && <> matching &ldquo;{query.trim()}&rdquo;</>}
        </p>
      </div>

      {/* --- Grid --------------------------------------------------------- */}
      {visible.length > 0 ? (
        // Keyed on category (not the query) so the stagger replays when the
        // category changes, but typing doesn't re-animate the whole grid.
        <div key={`grid-${activeCategory}`} className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((product, i) => (
            <Reveal as="div" key={product.id} delay={stagger(i)} variant="scale" className="flex">
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>
      ) : (
        <div className="lp-enter mx-auto mt-10 max-w-md rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <span className="icon-tile mx-auto">
            <Search aria-hidden="true" className="h-5 w-5" />
          </span>
          <p className="mt-4 font-semibold text-navy-950">No products match that search</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Try a different word, or browse everything. If we don&apos;t stock it,
            we can usually order it in — just ask.
          </p>
          <button type="button" onClick={resetAll} className="btn-outline btn-sm mt-6">
            Show all products
          </button>
        </div>
      )}
    </>
  );
}
