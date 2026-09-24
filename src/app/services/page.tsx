import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import { Icon, type IconName } from "@/lib/icons";
import { stagger } from "@/lib/motion";

export const metadata: Metadata = {
  title: "Our Services",
  description:
    "Prescription refills, compounding, medication synchronization, and more at Liberty Pharmacy in Austin, TX.",
};

const services: { title: string; body: string; icon: IconName }[] = [
  {
    title: "Prescription Refills",
    body: "Quick, accurate refills — most ready in about 15 minutes. Online refill requests are coming soon through our patient portal.",
    icon: "pill",
  },
  {
    title: "Sterile Compounding",
    body: "Custom-compounded medications when commercial products don't fit — specialized strengths, dosage forms, and allergen-free formulations.",
    icon: "flask",
  },
  {
    title: "Medication Synchronization",
    body: "We align all of your refills to a single monthly pickup date — one trip, everything ready, nothing missed.",
    icon: "calendar-check",
  },
  {
    title: "Long-Term Care Support",
    body: "Specialized packaging, delivery, and medication management for assisted living and long-term care facilities.",
    icon: "building",
  },
  {
    title: "Medical Supplies & OTC",
    body: "Medical equipment, first aid, vitamins and supplements, and everyday health essentials in store.",
    icon: "bandage",
  },
  {
    title: "Free Local Delivery",
    body: "Free prescription delivery throughout the Austin area — because getting your medication shouldn't be a chore.",
    icon: "truck",
  },
  {
    title: "Specialty & Discount Programs",
    body: "Specialty medication support and discount programs to help keep your out-of-pocket costs down.",
    icon: "tag",
  },
];

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="Our Services"
        subtitle="Everything you'd expect from a modern pharmacy, delivered with the personal touch of a local one."
      />

      <section className="py-16">
        <div className="container-site">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => (
              <Reveal as="div" key={s.title} delay={stagger(i)} variant="scale" className="flex">
                <div className="card lp-lift w-full">
                  <span className="icon-tile">
                    <Icon name={s.icon} />
                  </span>
                  <h2 className="mt-5 text-base font-semibold text-navy-950">{s.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal as="div" className="mt-16 rounded-3xl bg-navy-50 p-10 text-center ring-1 ring-inset ring-navy-100">
            <h2 className="text-2xl font-bold tracking-tight text-navy-950">
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
