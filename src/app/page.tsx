import Link from "next/link";
import { Fragment } from "react";
import { ArrowRight, MapPin, Phone } from "lucide-react";
import Reveal from "@/components/Reveal";
import AnimatedCounter from "@/components/AnimatedCounter";
import HeroVisual from "@/components/HeroVisual";
import DeliveryArt from "@/components/DeliveryArt";
import { getSiteSettings } from "@/lib/site";
import { productCategories } from "@/lib/products";
import { getSessionAccountId } from "@/lib/auth";
import { Icon, type IconName } from "@/lib/icons";
import { delayStyle, stagger } from "@/lib/motion";

// `value`/`suffix` drive the count-up; the rendered result is value + suffix
// (e.g. 50 + "K+" → "50K+").
const stats = [
  { value: 20, suffix: "+", label: "Years serving Austin" },
  { value: 50, suffix: "K+", label: "Prescriptions filled" },
  { value: 10, suffix: "K+", label: "Patients served" },
];

const highlights: { title: string; body: string; icon: IconName }[] = [
  {
    title: "Filled in about 15 minutes",
    body: "Most prescriptions are ready in about 15 minutes — wait comfortably or come back at your convenience.",
    icon: "timer",
  },
  {
    title: "Free local delivery",
    body: "Free prescription delivery across the Austin area, right to your door.",
    icon: "truck",
  },
  {
    title: "Save on Medicare Rx",
    body: "We work with many Medicare plans to help you get the best price on your medications.",
    icon: "badge-percent",
  },
];

// Read straight from the catalog, so these tiles and the /products sections
// can never drift apart.
const shopCategories = productCategories;

const services: { title: string; body: string; icon: IconName }[] = [
  { title: "Prescription Refills", body: "Fast, accurate refills with friendly reminders when you're due.", icon: "pill" },
  { title: "Compounding", body: "Custom-compounded medications tailored to your exact needs.", icon: "flask" },
  { title: "Medical Supplies", body: "Equipment, first aid, vitamins, and everyday health essentials.", icon: "bandage" },
  { title: "Medication Sync", body: "Every refill aligned to one monthly pickup — one trip, everything ready.", icon: "calendar-check" },
];

/** Headline split into words that rise in sequence. Spaces stay real text. */
function Words({ text, start, step = 45 }: { text: string; start: number; step?: number }) {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <Fragment key={i}>
          {i > 0 && " "}
          <span className="lp-word" style={delayStyle(start + i * step)}>
            {word}
          </span>
        </Fragment>
      ))}
    </>
  );
}

export default async function HomePage() {
  const site = await getSiteSettings();
  const signedIn = (await getSessionAccountId()) !== null;
  const lineOne = "Care you can trust,";
  const lineTwo = "right in your neighborhood";
  const lineTwoStart = 140 + lineOne.split(" ").length * 45;

  return (
    <>
      {/* ------------------------------------------------------------------
          Hero — the load sequence. Everything here is CSS-timed, so it plays
          without JavaScript and is still under reduced motion.
         ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-navy-950 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800" />
        <div className="bg-dot-grid absolute inset-0" />

        <div className="container-site relative grid items-center gap-8 py-16 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:py-24">
          <div>
            <p
              className="lp-enter inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-navy-100 backdrop-blur"
              style={delayStyle(60)}
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-liberty-gold" />
              Pharmacy · Peptides · Vitamins · Wellness
            </p>

            <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              <Words text={lineOne} start={140} />{" "}
              {/* Own line from sm up, so "Care you can trust," reads as one thought. */}
              <span className="text-liberty-gold sm:block">
                <Words text={lineTwo} start={lineTwoStart} />
              </span>
            </h1>

            <p className="lp-enter mt-6 max-w-xl text-lg leading-8 text-navy-100" style={delayStyle(480)}>
              An independent Austin pharmacy with the personal attention you
              remember — fast fills, free delivery, custom compounding, and
              pharmacists who know you by name.
            </p>

            <div className="lp-enter mt-8 flex flex-wrap gap-3" style={delayStyle(560)}>
              <Link href={signedIn ? "/portal" : "/portal/register"} className="btn-accent group">
                {signedIn ? "My Portal" : "Become a patient"}
                <ArrowRight aria-hidden="true" className="lp-arrow h-4 w-4" />
              </Link>
              <Link href="/portal" className="btn-ghost-light">
                Transfer a prescription
              </Link>
            </div>

            <dl
              className="lp-enter mt-12 grid max-w-md grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-6"
              style={delayStyle(660)}
            >
              {stats.map((s) => (
                <div key={s.label} className="px-4 first:pl-0">
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <AnimatedCounter
                      value={s.value}
                      suffix={s.suffix}
                      className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
                    />
                    <p aria-hidden="true" className="mt-1 text-xs leading-4 text-navy-200">
                      {s.label}
                    </p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <HeroVisual />
        </div>
      </section>

      {/* Why Liberty */}
      <section className="py-20 sm:py-24">
        <div className="container-site">
          <Reveal as="div" className="mx-auto max-w-2xl text-center">
            <p className="eyebrow justify-center">Why Liberty</p>
            <h2 className="section-title mt-3">A pharmacy that works around you</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {highlights.map((h, i) => (
              <Reveal as="div" key={h.title} delay={stagger(i)} className="flex">
                <div className="card lp-lift w-full">
                  <span className="icon-tile">
                    <Icon name={h.icon} />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-navy-950">{h.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{h.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Delivery */}
      <section className="pb-20 sm:pb-24">
        <div className="container-site grid items-center gap-12 lg:grid-cols-2">
          <Reveal as="div">
            <p className="eyebrow">Delivery</p>
            <h2 className="section-title mt-3">Prescriptions delivered to your door</h2>
            <p className="section-lead">
              Most prescriptions are ready in about 15 minutes, and we deliver
              free across the Austin area — so your medication reaches you
              without another trip.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/contact" className="btn-primary">
                Ask about delivery
              </Link>
              <Link href="/services" className="btn-outline">
                Our services
              </Link>
            </div>
          </Reveal>
          <Reveal as="div" variant="scale" delay={stagger(1)}>
            <DeliveryArt className="w-full rounded-3xl shadow-lift" />
          </Reveal>
        </div>
      </section>

      {/* Shop by category — one large image tile per catalog section, each
          linking straight to that section of /products. */}
      <section className="bg-slate-50 py-20 sm:py-24">
        <div className="container-site">
          <Reveal as="div" className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Shop</p>
              <h2 className="section-title mt-3">Shop by category</h2>
              <p className="section-lead">
                Vitamins on the shelf, peptides compounded to your prescription —
                and a pharmacist to help with both.
              </p>
            </div>
            <Link href="/products" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700">
              <span className="lp-underline">See all products</span>
              <ArrowRight aria-hidden="true" className="lp-arrow h-4 w-4" />
            </Link>
          </Reveal>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {shopCategories.map((cat, i) => (
              <Reveal as="div" key={cat.id} delay={stagger(i)} variant="scale" className="flex">
                <Link
                  href={`/products#${cat.id}`}
                  className="card lp-lift group relative flex w-full flex-col overflow-hidden p-0"
                >
                  <div className="lp-media aspect-[16/10] bg-slate-100">
                    {/* Plain <img>: no image optimizer in the standalone runtime,
                        and the CSP allows img-src 'self' only. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cat.image} alt="" loading="lazy" className="lp-media-img h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center gap-3">
                      <span className="icon-tile h-10 w-10">
                        <Icon name={cat.icon} className="h-5 w-5" />
                      </span>
                      <h3 className="text-xl font-semibold tracking-tight text-navy-950">{cat.label}</h3>
                    </div>
                    <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{cat.blurb}</p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700">
                      Shop {cat.label.toLowerCase()}
                      <ArrowRight aria-hidden="true" className="lp-arrow h-4 w-4" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Services preview */}
      <section className="py-20 sm:py-24">
        <div className="container-site">
          <Reveal as="div" className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Services</p>
              <h2 className="section-title mt-3">Services tailored to you</h2>
            </div>
            <Link href="/services" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-navy-700">
              <span className="lp-underline">View all services</span>
              <ArrowRight aria-hidden="true" className="lp-arrow h-4 w-4" />
            </Link>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s, i) => (
              <Reveal as="div" key={s.title} delay={stagger(i)} className="flex">
                <div className="card lp-lift w-full">
                  <span className="icon-tile">
                    <Icon name={s.icon} />
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-navy-950">{s.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Visit CTA */}
      <section className="pb-20 sm:pb-24">
        <div className="container-site">
          <Reveal as="div" variant="scale">
            <div className="relative overflow-hidden rounded-3xl bg-navy-950 px-8 py-14 text-center text-white sm:px-16">
              <div className="bg-dot-grid absolute inset-0" />
              <div className="lp-orb absolute -right-16 -top-20 h-72 w-72 rounded-full bg-navy-500/30 blur-3xl" />
              <div className="relative">
                <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-liberty-gold ring-1 ring-inset ring-white/15">
                  <MapPin aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Visit us today</h2>
                <p className="mx-auto mt-3 max-w-xl text-navy-100">
                  {site.address.line1}, {site.address.city}, {site.address.state} {site.address.zip}
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <a href={site.phoneHref} className="btn-accent">
                    <Phone aria-hidden="true" className="h-4 w-4" />
                    Call {site.phone}
                  </a>
                  <a href={site.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost-light">
                    Get directions
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
