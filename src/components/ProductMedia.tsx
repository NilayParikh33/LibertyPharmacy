import { Icon } from "@/lib/icons";
import type { Product } from "@/lib/products";

/**
 * Product image frame, shared by cards and the detail page.
 *
 * Until the client supplies photography, `image` is unset and this renders a
 * tinted panel with the product's icon instead, so layouts keep a consistent
 * shape either way. Adding a photo later is a one-line data change.
 *
 * Zooms gently while an ancestor `.group` is hovered or keyboard-focused
 * (`.lp-media-img` in globals.css).
 */
export default function ProductMedia({
  product,
  size = "card",
  className = "",
}: {
  product: Product;
  size?: "card" | "hero";
  className?: string;
}) {
  const hero = size === "hero";
  return (
    <div
      className={`lp-media relative w-full bg-gradient-to-br from-navy-50 via-white to-slate-100 ${
        hero ? "aspect-square rounded-3xl" : "aspect-[4/3]"
      } ${className}`}
    >
      {product.image ? (
        // Plain <img>, not next/image: the site ships no image optimizer in its
        // Docker runtime and the CSP allows img-src 'self' only, so these are
        // served straight from public/.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.image}
          alt={product.imageAlt ?? ""}
          loading={hero ? "eager" : "lazy"}
          className="lp-media-img h-full w-full object-cover"
        />
      ) : (
        <div className="lp-media-img flex h-full w-full items-center justify-center">
          {/* Concentric rings give the icon panel some depth without imagery.
              Sized by height + aspect-square so they stay circles in any frame. */}
          <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
            <div className={`aspect-square rounded-full border border-navy-100/80 ${hero ? "h-3/4" : "h-[78%]"}`} />
          </div>
          <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
            <div className={`aspect-square rounded-full border border-navy-100 ${hero ? "h-1/2" : "h-[52%]"}`} />
          </div>
          <span
            className={`relative inline-flex items-center justify-center rounded-2xl bg-white text-navy-700 shadow-lift ring-1 ring-navy-100 ${
              hero ? "h-28 w-28" : "h-16 w-16"
            }`}
          >
            <Icon name={product.icon} className={hero ? "h-12 w-12" : "h-7 w-7"} strokeWidth={1.5} />
          </span>
        </div>
      )}
    </div>
  );
}
