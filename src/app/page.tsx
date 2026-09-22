import Link from "next/link";
import Reveal from "@/components/Reveal";
import AnimatedCounter from "@/components/AnimatedCounter";
import PharmacyHeroArt from "@/components/PharmacyHeroArt";
import DeliveryArt from "@/components/DeliveryArt";
import { getSiteSettings } from "@/lib/site";
import { productCategories } from "@/lib/products";
import { getSessionAccountId } from "@/lib/auth";

// `value`/`suffix` drive the count-up; the rendered result is value + suffix
// (e.g. 50 + "K+" → "50K+").
const stats = [
  { value: 20, suffix: "+", label: "Years Serving Austin" },
  { value: 50, suffix: "K+", label: "Prescriptions Filled" },
  { value: 10, suffix: "K+", label: "Patients Served" },
];

const highlights = [
  {
    title: "Filled in 15 Minutes",
    body: "Most prescriptions are ready in about 15 minutes — wait comfortably or come back at your convenience.",
    icon: "⏱",
  },
  {
    title: "Free Local Delivery",
    body: "Free prescription delivery across the Austin area, right to your door.",
    icon: "🚚",
  },
  {
    title: "Save on Medicare Rx",
    body: "We work with many Medicare plans to help you get the best price on your medications.",
    icon: "💳",
  },
];

// Real catalog categories, so the rail and the /products filter can never
// drift apart. "all" is the filter's reset, not a category to shop, and it has
// no icon — the icon check excludes it.
const shopCategories = productCategories.filter((c) => c.icon);

const services = [
  { title: "Prescription Refills", body: "Fast, accurate refills with friendly reminders when you're due." },
  { title: "Compounding", body: "Custom-compounded medications tailored to your exact needs." },
  { title: "Medical Supplies", body: "Medical equipment, first aid, vitamins, and everyday health essentials." },
  { title: "Medication Sync", body: "Align all your refills to a single monthly pickup — one trip, everything ready." },
];

export default async function HomePage() {
  const site = await getSiteSettings();
  const signedIn = (await getSessionAccountId()) !== null;
  return (
    <>
      {/* Hero — above the fold, so these animate on load rather than on scroll. */}
      <section className="bg-gradient-to-br from-navy-950 via-navy-900 to-navy-700 text-white">
        <div className="container-site grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <p className="lp-enter mb-4 inline-block rounded-full bg-navy-800/80 px-4 py-1.5 text-sm font-medium text-navy-100">
              Independently owned pharmacy in Austin, Texas
            </p>
            <h1
              className="lp-enter text-4xl font-bold leading-tight tracking-tight sm:text-5xl"
              style={{ "--lp-delay": "100ms" } as React.CSSProperties}
            >
              Care you can trust, <span className="text-liberty-gold">right in your neighborhood</span>
            </h1>
            <p
              className="lp-enter mt-5 max-w-xl text-lg text-navy-100"
              style={{ "--lp-delay": "200ms" } as React.CSSProperties}
            >
              Liberty Pharmacy combines the personal attention of a local pharmacy
              with modern convenience — fast fills, free delivery, and pharmacists
              who know you by name.
            </p>
            <div
              className="lp-enter mt-8 flex flex-wrap gap-4"
              style={{ "--lp-delay": "300ms" } as React.CSSProperties}
            >
              {signedIn ? (
                <Link href="/portal" className="btn-accent">
                  My Portal
                </Link>
              ) : (
                <Link href="/portal/register" className="btn-accent">
                  New Patient
                </Link>
              )}
              <Link href="/portal" className="btn-outline !border-white !text-white hover:!bg-white/10">
                Transfer a Prescription
              </Link>
            </div>
          </div>

          <div className="space-y-6">
            <PharmacyHeroArt
              className="lp-enter mx-auto w-full max-w-xs sm:max-w-sm"
            />
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {stats.map((s, i) => (
                <div
                  key={s.label}
                  className="lp-enter rounded-xl bg-white/10 p-4 text-center backdrop-blur transition-transform duration-300 hover:-translate-y-1 sm:p-5"
                  style={{ "--lp-delay": `${400 + i * 120}ms` } as React.CSSProperties}
                >
                  <AnimatedCounter
                    value={s.value}
                    suffix={s.suffix}
                    className="text-2xl font-bold text-liberty-gold sm:text-3xl"
                  />
                  <p className="mt-1 text-xs text-navy-100 sm:text-sm">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="py-16 sm:py-20">
        <div className="container-site">
          <Reveal as="h2" className="section-title text-center">
            Shop Liberty Pharmacy your way
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {highlights.map((h, i) => (
              <Reveal as="div" key={h.title} delay={i * 100} className="flex">
                <div className="card lp-lift group w-full text-center">
                  <div
                    aria-hidden="true"
                    className="text-4xl transition-transform duration-300 group-hover:scale-110"
                  >
                    {h.icon}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-navy-900">{h.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{h.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Delivery — animated scene, reusing the delivery highlight's promise. */}
      <section className="pb-16 sm:pb-20">
        <div className="container-site grid items-center gap-10 lg:grid-cols-2">
          <Reveal as="div">
            <h2 className="section-title">Prescriptions delivered to your door</h2>
            <p className="mt-4 max-w-lg text-slate-600">
              Most prescriptions are ready in about 15 minutes, and we deliver
              free across the Austin area — so your medication reaches you
              without another trip.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link href="/contact" className="btn-primary">
                Ask about delivery
              </Link>
              <Link href="/services" className="btn-outline">
                Our services
              </Link>
            </div>
          </Reveal>
          <Reveal as="div" variant="scale" delay={100}>
            <DeliveryArt className="w-full rounded-2xl shadow-sm" />
          </Reveal>
        </div>
      </section>

      {/* Shop by category — a swipeable rail that deep-links into the catalog
          filter. Ready for the client's own product ranges: add a category to
          src/lib/products.ts with an `icon` and it appears here. */}
      <section className="bg-slate-50 py-16 sm:py-20">
        <div className="container-site">
          <Reveal as="div" className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="section-title">Shop by category</h2>
              <p className="mt-2 max-w-lg text-sm text-slate-600">
                Browse what we keep on the shelf — then ask a pharmacist what suits you.
              </p>
            </div>
            <Link href="/products" className="lp-underline text-sm font-semibold text-navy-700">
              See everything →
            </Link>
          </Reveal>
        </div>

        {/* Full-bleed so tiles run to the screen edge while scrolling, with the
            container's gutter recreated as padding. */}
        <div className="lp-rail lp-rail-pad mt-8 flex gap-5 overflow-x-auto pb-4">
          {shopCategories.map((cat, i) => (
            <Reveal
              as="div"
              key={cat.id}
              delay={i * 80}
              variant="scale"
              className="w-[70vw] shrink-0 sm:w-64"
            >
              <Link
                href={`/products?category=${cat.id}`}
                className="lp-lift lp-sheen group relative block h-full overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <span
                  aria-hidden="true"
                  className="lp-media-img inline-flex h-14 w-14 items-center justify-center rounded-xl bg-navy-50 text-3xl"
                >
                  {cat.icon}
                </span>
                <h3 className="mt-4 text-base font-semibold text-navy-900">{cat.label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{cat.blurb}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700">
                  Browse
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Services preview */}
      <section className="bg-slate-50 py-16 sm:py-20">
        <div className="container-site">
          <Reveal as="div" className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="section-title">Services tailored to you</h2>
            <div className="flex flex-wrap gap-5">
              <Link
                href="/products"
                className="lp-underline text-sm font-semibold text-navy-700"
              >
                Browse products →
              </Link>
              <Link
                href="/services"
                className="lp-underline text-sm font-semibold text-navy-700"
              >
                View all services →
              </Link>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => (
              <Reveal as="div" key={s.title} delay={i * 90} variant="scale" className="flex">
                <div className="card lp-lift w-full">
                  <h3 className="text-base font-semibold text-navy-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Visit CTA */}
      <section className="py-16 sm:py-20">
        <div className="container-site">
          <Reveal as="div" variant="scale">
            <div className="rounded-2xl bg-navy-900 px-8 py-12 text-center text-white sm:px-16">
              <h2 className="text-2xl font-bold sm:text-3xl">Visit us today</h2>
              <p className="mx-auto mt-3 max-w-xl text-navy-100">
                {site.address.line1}, {site.address.city}, {site.address.state} {site.address.zip}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                <a href={site.phoneHref} className="btn-accent">
                  Call {site.phone}
                </a>
                <a
                  href={site.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline !border-white !text-white hover:!bg-white/10"
                >
                  Get Directions
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
