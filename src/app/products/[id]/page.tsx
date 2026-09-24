import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgePercent, Check, ChevronRight, ShieldCheck, Truck } from "lucide-react";
import Reveal from "@/components/Reveal";
import ProductCard, { availabilityTone } from "@/components/ProductCard";
import ProductMedia from "@/components/ProductMedia";
import ProductSavePanel from "@/components/ProductSavePanel";
import { getSiteSettings } from "@/lib/site";
import { categoryLabel, getProduct, relatedProducts } from "@/lib/products";
import { delayStyle, stagger } from "@/lib/motion";

/**
 * Product detail page.
 *
 * One URL per product, so the back button, sharing, bookmarks and search
 * indexing all work (the earlier modal could do none of these). Static public
 * content from src/lib/products.ts — no patient data read or written.
 */

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const product = getProduct(id);
  if (!product) return { title: "Product not found" };
  return {
    title: product.name,
    description: `${product.summary} ${categoryLabel(product.categoryId)} at Liberty Pharmacy in Austin, TX.`,
  };
}

const assurances = [
  { icon: ShieldCheck, text: "Pharmacist-reviewed — ask us about interactions with your medications" },
  { icon: Truck, text: "Free local delivery across the Austin area" },
  { icon: BadgePercent, text: "We check your insurance coverage before you buy" },
];

export default async function ProductPage({ params }: { params: Params }) {
  const { id } = await params;
  const product = getProduct(id);
  if (!product) notFound();

  const site = await getSiteSettings();
  const related = relatedProducts(product);
  const category = categoryLabel(product.categoryId);
  const tone = availabilityTone(product.availability);

  return (
    <>
      {/* Breadcrumb */}
      <div className="border-b border-slate-100 bg-slate-50/60">
        <nav aria-label="Breadcrumb" className="container-site py-3.5">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
            <li>
              <Link href="/products" className="transition-colors hover:text-navy-900">
                Products
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li>
              <Link href={`/products?category=${product.categoryId}`} className="transition-colors hover:text-navy-900">
                {category}
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li aria-current="page" className="font-medium text-navy-900">
              {product.name}
            </li>
          </ol>
        </nav>
      </div>

      <section className="py-12 sm:py-16">
        <div className="container-site grid items-start gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Media — `group` so the image zooms gently on hover. */}
          <div className="lp-enter-scale group relative lg:sticky lg:top-24" style={delayStyle(80)}>
            <ProductMedia product={product} size="hero" className="shadow-card ring-1 ring-slate-200/70" />
            {product.badge && (
              <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-navy-800 shadow-card ring-1 ring-slate-200/70">
                {product.badge}
              </span>
            )}
          </div>

          {/* Summary + actions */}
          <div>
            <Link
              href={`/products?category=${product.categoryId}`}
              className="lp-enter eyebrow transition-colors hover:text-navy-900"
              style={delayStyle(120)}
            >
              {category}
            </Link>
            <h1
              className="lp-enter mt-3 text-4xl font-bold tracking-tight text-navy-950 sm:text-5xl"
              style={delayStyle(180)}
            >
              {product.name}
            </h1>
            <p className="lp-enter mt-4 text-lg leading-8 text-slate-600" style={delayStyle(240)}>
              {product.summary}
            </p>

            <p
              className={`lp-enter mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${
                tone === "stock"
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
                  : "bg-amber-50 text-amber-800 ring-amber-100"
              }`}
              style={delayStyle(300)}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${tone === "stock" ? "bg-emerald-500" : "bg-amber-500"}`}
              />
              {product.availability}
            </p>

            <div className="lp-enter mt-8 border-y border-slate-100 py-8" style={delayStyle(360)}>
              <ProductSavePanel product={product} phone={site.phone} phoneHref={site.phoneHref} />
            </div>

            <ul className="mt-8 space-y-3">
              {assurances.map(({ icon: AIcon, text }, i) => (
                <li key={text} className="lp-enter flex items-start gap-3" style={delayStyle(420 + i * 60)}>
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
                    <AIcon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="pt-1 text-sm leading-6 text-slate-600">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Details */}
      <section className="border-t border-slate-100 bg-slate-50/60 py-16 sm:py-20">
        <div className="container-site grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
          <Reveal as="div">
            <p className="eyebrow">About this product</p>
            <p className="mt-5 text-base leading-8 text-slate-700">{product.description}</p>
            <p className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-xs leading-5 text-slate-500">
              Product information is general and not medical advice. Prescription items
              require a valid prescription. Speak with our pharmacists about what&apos;s
              right for you.
            </p>
          </Reveal>
          <Reveal as="div" delay={stagger(1)}>
            <div className="card">
              <h2 className="text-base font-semibold text-navy-950">At a glance</h2>
              <ul className="mt-5 space-y-3.5">
                {product.details.map((d) => (
                  <li key={d} className="flex gap-3 text-sm leading-6 text-slate-600">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <Check aria-hidden="true" className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="py-16 sm:py-20">
          <div className="container-site">
            <Reveal as="div" className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">{category}</p>
                <h2 className="section-title mt-3">You may also need</h2>
              </div>
              <Link
                href={`/products?category=${product.categoryId}`}
                className="lp-underline text-sm font-semibold text-navy-700"
              >
                See all {category.toLowerCase()}
              </Link>
            </Reveal>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p, i) => (
                <Reveal as="div" key={p.id} delay={stagger(i)} variant="scale" className="flex">
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
