"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Info, Search, X } from "lucide-react";
import Reveal from "./Reveal";
import ProductCard from "./ProductCard";
import { Icon } from "@/lib/icons";
import { productCategories, productsByCategory, searchProducts } from "@/lib/products";
import { stagger } from "@/lib/motion";

/**
 * Product catalog: one section per category, with a search that filters
 * across all of them.
 *
 * All content is static public marketing copy (src/lib/products.ts) — no PHI,
 * no session, no network. Search is instant and client-side, and is mirrored
 * into the URL (?q=…) with history.replaceState so a search can be shared
 * without adding a history entry per keystroke.
 *
 * Sections (rather than filter chips) because there are only a few
 * categories: everything is visible at once, and the pills at the top are
 * plain in-page links (#peptides etc.) that the home page links into too.
 */
export default function ProductCatalog({
  initialQuery = "",
  initialCategory,
}: {
  initialQuery?: string;
  /** Scroll to this section on load — supports old ?category= links. */
  initialCategory?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  const sections = useMemo(
    () =>
      productCategories.map((cat) => ({
        cat,
        items: searchProducts(productsByCategory(cat.id), query),
      })),
    [query]
  );
  const total = sections.reduce((n, s) => n + s.items.length, 0);

  // Mirror the search into the address bar.
  useEffect(() => {
    const q = query.trim();
    const url = q ? `?q=${encodeURIComponent(q)}${window.location.hash}` : `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }, [query]);

  // Old /products?category=peptides links land on the right section.
  useEffect(() => {
    if (initialCategory) document.getElementById(initialCategory)?.scrollIntoView();
  }, [initialCategory]);

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
            placeholder="Search vitamins and peptides…"
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

      {/* --- Jump links ---------------------------------------------------- */}
      <nav aria-label="Product sections" className="mt-6 flex flex-wrap justify-center gap-2">
        {sections.map(({ cat, items }) => (
          <a
            key={cat.id}
            href={`#${cat.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy-800 shadow-card transition-[border-color,box-shadow,color] duration-200 ease-standard hover:border-navy-300 hover:text-navy-950 hover:shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-700"
          >
            <Icon name={cat.icon} className="h-4 w-4 text-navy-600" strokeWidth={2} />
            {cat.label}
            <span className="rounded-full bg-navy-50 px-1.5 text-xs tabular-nums text-navy-700">{items.length}</span>
          </a>
        ))}
      </nav>

      <p aria-live="polite" className="mt-4 text-center text-xs font-medium text-slate-500">
        {query.trim() ? (
          <>
            {total === 1 ? "1 product" : `${total} products`} matching &ldquo;{query.trim()}&rdquo;
          </>
        ) : (
          <span className="sr-only">{total} products</span>
        )}
      </p>

      {/* --- Sections ------------------------------------------------------ */}
      {total === 0 ? (
        <div className="lp-enter mx-auto mt-10 max-w-md rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <span className="icon-tile mx-auto">
            <Search aria-hidden="true" className="h-5 w-5" />
          </span>
          <p className="mt-4 font-semibold text-navy-950">No products match that search</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Try a different word. If we don&apos;t stock it, we can usually order
            it in — just ask.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="btn-outline btn-sm mt-6"
          >
            Show all products
          </button>
        </div>
      ) : (
        sections.map(
          ({ cat, items }) =>
            items.length > 0 && (
              <section key={cat.id} id={cat.id} aria-labelledby={`${cat.id}-title`} className="scroll-mt-28 pt-16">
                <Reveal as="div" className="flex flex-wrap items-end justify-between gap-6 border-b border-slate-200 pb-6">
                  <div className="flex items-start gap-4">
                    <span className="icon-tile">
                      <Icon name={cat.icon} />
                    </span>
                    <div>
                      <h2 id={`${cat.id}-title`} className="text-2xl font-bold tracking-tight text-navy-950 sm:text-3xl">
                        {cat.label}
                      </h2>
                      <p className="mt-1.5 max-w-xl text-sm leading-6 text-slate-600">{cat.blurb}</p>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-500">
                    {items.length === 1 ? "1 product" : `${items.length} products`}
                  </p>
                </Reveal>

                {cat.note && (
                  <Reveal
                    as="p"
                    className="mt-6 flex gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 text-sm leading-6 text-amber-900"
                  >
                    <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <span>{cat.note}</span>
                  </Reveal>
                )}

                {/* Four columns when the count divides by four, so a section
                    never ends with a single orphaned card. */}
                <div
                  className={`mt-8 grid gap-6 sm:grid-cols-2 ${
                    items.length % 4 === 0 ? "lg:grid-cols-4" : "lg:grid-cols-3"
                  }`}
                >
                  {items.map((product, i) => (
                    <Reveal as="div" key={product.id} delay={stagger(i)} variant="scale" className="flex">
                      <ProductCard product={product} />
                    </Reveal>
                  ))}
                </div>
              </section>
            )
        )
      )}
    </>
  );
}
