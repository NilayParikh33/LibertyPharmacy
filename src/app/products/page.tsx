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
    "Pharmacist-vetted vitamins and prescription peptide therapies compounded to order at Liberty Pharmacy in Austin, TX.",
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
  // ?category=peptides — older links; the catalog scrolls to that section.
  // ?q=vitamin — a shared or bookmarked search.
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const site = await getSiteSettings();
  const { category, q } = await searchParams;
  // Ignore an unknown id rather than scrolling nowhere.
  const initialCategory =
    category && productCategories.some((c) => c.id === category) ? category : undefined;
  const initialQuery = typeof q === "string" ? q.slice(0, 80) : "";

  return (
    <>
      <PageHero
        eyebrow="Shop"
        title="Products & Supplies"
        subtitle="Pharmacist-vetted vitamins, and prescription peptides compounded to order — with a pharmacist to guide you through both."
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
                  We order specialty items in regularly and compound to prescription.
                  Tell us what you&apos;re looking for and we&apos;ll tell you what we can do.
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
