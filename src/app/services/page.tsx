import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Our Services",
  description:
    "Prescription refills, compounding, medication synchronization, and more at Liberty Pharmacy in Austin, TX.",
};

const services = [
  {
    title: "Prescription Refills",
    body: "Quick, accurate refills — most ready in about 15 minutes. Online refill requests are coming soon through our patient portal.",
    icon: "💊",
  },
  {
    title: "Sterile Compounding",
    body: "Custom-compounded medications when commercial products don't fit — specialized strengths, dosage forms, and allergen-free formulations.",
    icon: "⚗️",
  },
  {
    title: "Medication Synchronization",
    body: "We align all of your refills to a single monthly pickup date — one trip, everything ready, nothing missed.",
    icon: "📅",
  },
  {
    title: "Long-Term Care Support",
    body: "Specialized packaging, delivery, and medication management for assisted living and long-term care facilities.",
    icon: "🏥",
  },
  {
    title: "Medical Supplies & OTC",
    body: "Medical equipment, first aid, vitamins and supplements, and everyday health essentials in store.",
    icon: "🩹",
  },
  {
    title: "Free Local Delivery",
    body: "Free prescription delivery throughout the Austin area — because getting your medication shouldn't be a chore.",
    icon: "🚚",
  },
  {
    title: "Specialty & Discount Programs",
    body: "Specialty medication support and discount programs to help keep your out-of-pocket costs down.",
    icon: "🏷",
  },
];

export default function ServicesPage() {
  return (
    <>
      <PageHero
        title="Our Services"
        subtitle="Everything you'd expect from a modern pharmacy, delivered with the personal touch of a local one."
      />

      <section className="py-16">
        <div className="container-site">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => (
              <Reveal as="div" key={s.title} delay={i * 80} variant="scale" className="flex">
                <div className="card lp-lift group w-full">
                  <div
                    aria-hidden="true"
                    className="text-3xl transition-transform duration-300 group-hover:scale-110"
                  >
                    {s.icon}
                  </div>
                  <h2 className="mt-3 text-base font-semibold text-navy-900">{s.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal as="div" className="mt-14 rounded-2xl bg-navy-50 p-8 text-center">
            <h2 className="text-xl font-bold text-navy-900">
              Have a question about a service?
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
              Call us or send a general inquiry — our pharmacists are happy to
              help you figure out what&apos;s right for you.
            </p>
            <Link href="/contact" className="btn-primary mt-6">
              Contact Us
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
