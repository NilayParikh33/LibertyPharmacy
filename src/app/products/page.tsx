import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import ProductCatalog from "@/components/ProductCatalog";
import { getSiteSettings } from "@/lib/site";
import { productCategories } from "@/lib/products";

export const metadata: Metadata = {
  title: "Products",
  description:
    "Browse vitamins, home health equipment, diabetes care, over-the-counter remedies, and custom compounding services at Liberty Pharmacy in Austin, TX.",
};

/**
 * Products catalog page.
 *
 * Content is static and public (src/lib/products.ts) — no patient data is read
 * or written here. The only dynamic dependency is admin-managed contact info.
 */
export default async function ProductsPage({
  searchParams,
}: {
  // ?category=wellness — how the home page's category rail deep-links in.
  // ?q=vitamin — a shared or bookmarked search.
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const site = await getSiteSettings();
  const { category, q } = await searchParams;
  // Ignore an unknown id rather than rendering an empty grid.
  const initialCategory =
    category && productCategories.some((c) => c.id === category) ? category : "all";
  const initialQuery = typeof q === "string" ? q.slice(0, 80) : "";

  return (
    <>
      <PageHero
        eyebrow="Shop"
        title="Products & Supplies"
        subtitle="Browse what we stock — then talk to a pharmacist who can tell you whether it's right for you."
      />

      <section className="py-16 sm:py-20">
        <div className="container-site">
          <ProductCatalog initialCategory={initialCategory} initialQuery={initialQuery} />

          <Reveal as="div" className="mt-20">
            <div className="relative overflow-hidden rounded-3xl bg-navy-950 px-8 py-14 text-center text-white sm:px-16">
              <div className="bg-dot-grid absolute inset-0" />
              <div className="relative">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Can&apos;t find what you need?</h2>
                <p className="mx-auto mt-3 max-w-xl text-navy-100">
                  We order specialty items in regularly and compound what isn&apos;t made
                  commercially. Tell us what you&apos;re looking for and we&apos;ll track it down.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <a href={site.phoneHref} className="btn-accent">
                    <Phone aria-hidden="true" className="h-4 w-4" />
                    Call {site.phone}
                  </a>
                  <Link href="/contact" className="btn-ghost-light">
                    Send an inquiry
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
