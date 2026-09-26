import type { Metadata } from "next";
import { stagger } from "@/lib/motion";
import Reveal from "@/components/Reveal";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { getSiteSettings } from "@/lib/site";

export const metadata: Metadata = {
  title: "For Providers",
  description:
    "Liberty Pharmacy partners with physicians and clinics — compounding, allergy programs, and collaborative patient care in Austin, TX.",
};

const programs = [
  {
    title: "Women's Care",
    body: "Personalized solutions for menopause, pelvic pain, and hormonal health — including custom-compounded medications and non-hormonal supplement options.",
  },
  {
    title: "Men's Care",
    body: "Compounded therapies for low testosterone, andropause, erectile dysfunction, and chronic prostatitis, tailored to each patient's needs.",
  },
  {
    title: "Weight Management",
    body: "A range of physician-directed options including vitamin injectables, appetite suppressants, and satiety support.",
  },
  {
    title: "Nutrition Therapy",
    body: "Injectable and custom-tailored to individual patient requirements and preferences.",
  },
  {
    title: "Pain Management",
    body: "Compounded topical and oral options for bone and joint conditions, muscle pain, neuropathies, and complex pain syndromes.",
  },
];

export default async function ProvidersPage() {
  const site = await getSiteSettings();
  return (
    <>
      <PageHero
        eyebrow="Providers"
        title="For Providers"
        subtitle="Partner with a compounding pharmacy that works hand-in-hand with your practice."
      />

      <section className="py-16">
        <div className="container-site">
          <div className="max-w-3xl">
            <h2 className="section-title">Get to know Liberty Pharmacy</h2>
            <p className="mt-4 leading-7 text-slate-600">
              Liberty Pharmacy provides compounding services to physicians,
              clinics, and their patients. Many of the medications we compound
              are used to treat complex conditions and unique disease states.
              Our compounding pharmacists work directly with your practice to
              customize medications to each patient&apos;s needs — and we&apos;re always
              available to answer questions and provide formulation
              recommendations.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((p, i) => (
              <Reveal as="div" key={p.title} delay={stagger(i)} className="card lp-lift">
                <h3 className="text-base font-semibold text-navy-950">{p.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{p.body}</p>
              </Reveal>
            ))}
          </div>

          <div className="mt-16 rounded-3xl bg-navy-950 p-8 text-center text-white sm:p-12">
            <h2 className="text-xl font-bold sm:text-2xl">
              Ready to collaborate on patient care?
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-navy-100">
              Call our pharmacist line at {site.phone} or send us a message —
              we&apos;ll get back to your office promptly.
            </p>
            <Link href="/contact" className="btn-accent mt-6">
              Contact Our Team
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
