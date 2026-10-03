import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ProductMedia from "./ProductMedia";
import SaveToggle from "./SaveToggle";
import { categoryLabel, type Product } from "@/lib/products";

/** Stock line colour: in stock reads green, made-to-order reads amber. */
export function availabilityTone(availability: string): "stock" | "order" {
  return availability.toLowerCase().startsWith("in stock") ? "stock" : "order";
}

/**
 * Catalog card. The whole card is one link to the product's page; the heart
 * sits above it as its own control (a button can't live inside a link).
 *
 * Hover: the card rises and its shadow deepens, the image zooms slightly, and
 * the "View details" arrow nudges forward. Text never moves, so nothing shifts
 * under the pointer. Server-renderable; only the heart is interactive.
 */
export default function ProductCard({ product }: { product: Product }) {
  const tone = availabilityTone(product.availability);

  return (
    <article className="card lp-lift group relative flex h-full w-full flex-col overflow-hidden p-0 has-[>a:focus-visible]:outline has-[>a:focus-visible]:outline-2 has-[>a:focus-visible]:outline-offset-2 has-[>a:focus-visible]:outline-navy-700">
      <Link href={`/products/${product.id}`} className="flex flex-1 flex-col focus:outline-none">
        <ProductMedia product={product} />
        <div className="flex flex-1 flex-col p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-navy-600">
            {categoryLabel(product.categoryId)}
          </p>
          <h3 className="mt-1.5 text-base font-semibold text-navy-950">{product.name}</h3>
          <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{product.summary}</p>
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                tone === "stock" ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${tone === "stock" ? "bg-emerald-500" : "bg-amber-500"}`}
              />
              {tone === "stock" ? "In stock" : "Made to order"}
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-navy-700 transition-colors group-hover:text-navy-950">
              Details
              <ArrowRight aria-hidden="true" className="lp-arrow h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>

      {product.badge && (
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-navy-800 shadow-card ring-1 ring-slate-200/70 backdrop-blur">
          {product.badge}
        </span>
      )}
      <SaveToggle productId={product.id} productName={product.name} className="absolute right-3 top-3" />
    </article>
  );
}
