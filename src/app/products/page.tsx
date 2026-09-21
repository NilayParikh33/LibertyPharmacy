import type { Metadata } from "next";
import Link from "next/link";
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
  searchParams: Promise<{ category?: string }>;
}) {
  const site = await getSiteSettings();
  const { category } = await searchParams;
  // Ignore an unknown id rather than rendering an empty grid.
  const initialCategory =
    category && productCategories.some((c) => c.id === category) ? category : "all";

  return (
    <>
      <PageHero
        title="Products & Supplies"
        subtitle="Browse what we stock — then talk to a pharmacist who can tell you whether it's right for you."
      />

      <section className="py-16">
        <div className="container-site">
          <Reveal as="div" className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="section-title">Shop with a pharmacist in your corner</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Pick a category to filter, then select any item to see the full description.
              Prices and stock vary — call us and we&apos;ll confirm availability, check
              your insurance coverage, and set anything aside for pickup.
            </p>
          </Reveal>

          <ProductCatalog
            phone={site.phone}
            phoneHref={site.phoneHref}
            initialCategory={initialCategory}
          />

          <Reveal as="div" className="mt-16">
            <div className="rounded-2xl bg-navy-900 px-8 py-12 text-center text-white sm:px-16">
              <h2 className="text-2xl font-bold sm:text-3xl">Can&apos;t find what you need?</h2>
              <p className="mx-auto mt-3 max-w-xl text-navy-100">
                We order specialty items in regularly and compound what isn&apos;t made
                commercially. Tell us what you&apos;re looking for and we&apos;ll track it down.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                <a href={site.phoneHref} className="btn-accent">
                  Call {site.phone}
                </a>
                <Link
                  href="/contact"
                  className="btn-outline !border-white !text-white hover:!bg-white/10"
                >
                  Send an Inquiry
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
