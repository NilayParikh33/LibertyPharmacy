import type { Metadata } from "next";
import { stagger } from "@/lib/motion";
import Reveal from "@/components/Reveal";
import Link from "next/link";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about Liberty Pharmacy — an independently owned Austin pharmacy focused on personalized care.",
};

const values = [
  {
    title: "Patients First",
    body: "Every decision starts with what's best for the person standing at our counter. No phone trees, no rushed answers.",
  },
  {
    title: "Independent & Local",
    body: "We're owned and operated right here in Austin. When you shop with us, you're supporting your own community.",
  },
  {
    title: "Privacy by Design",
    body: "Your health information is yours. We build our services — including this website — to collect only what's necessary and protect everything we hold.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="About Liberty Pharmacy"
        subtitle="An independent pharmacy built around people, not prescriptions-per-hour."
      />

      <section className="py-16">
        <div className="container-site grid gap-12 lg:grid-cols-2">
          <div>
            <h2 className="section-title">Our Story</h2>
            <p className="mt-4 leading-7 text-slate-600">
              Liberty Pharmacy was founded on a simple belief: your pharmacy
              should know you. In an era of ten-minute hold times and impersonal
              chain stores, we set out to build a neighborhood pharmacy in
              Northwest Austin where care is personal, questions get real
              answers, and every patient is treated like family.
            </p>
            <p className="mt-4 leading-7 text-slate-600">
              From everyday prescriptions to custom compounding and
              immunizations, our pharmacists take the time to understand your
              health goals and work alongside your providers to help you meet
              them.
            </p>
          </div>
          <div>
            <h2 className="section-title">Why Independent Matters</h2>
            <p className="mt-4 leading-7 text-slate-600">
              As an independent pharmacy, we answer to our patients — not to a
              corporate office. That means flexible service, honest pricing
              guidance, medication synchronization, and free local delivery
              because it genuinely helps the people we serve.
            </p>
            <p className="mt-4 leading-7 text-slate-600">
              We&apos;re proud to serve the Spicewood Springs community and all of
              greater Austin.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="container-site">
          <Reveal as="h2" className="section-title text-center">What We Stand For</Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {values.map((v, i) => (
              <Reveal as="div" key={v.title} delay={stagger(i)} className="card lp-lift">
                <h3 className="text-base font-semibold text-navy-950">{v.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{v.body}</p>
              </Reveal>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link href="/contact" className="btn-primary">
              Get in Touch
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
