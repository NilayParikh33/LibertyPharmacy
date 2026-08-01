import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import { site } from "@/lib/site";

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
    title: "Allergy Testing & Treatment",
    body: "Allergist-quality testing and treatment programs, including sublingual immunotherapy drops and traditional injections.",
  },
  {
    title: "Weight Management",
    body: "A range of physician-directed options including vitamin injectables, appetite suppressants, and satiety support.",
  },
  {
    title: "Nutrition Therapy",
    body: "Injectable and oral nutritional preparations, custom-tailored to individual patient requirements and preferences.",
  },
  {
    title: "Pain Management",
    body: "Compounded topical and oral options for bone and joint conditions, muscle pain, neuropathies, and complex pain syndromes.",
  },
];

export default function ProvidersPage() {
  return (
    <>
      <PageHero
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
              customize medications to each patient's needs — and we're always
              available to answer questions and provide formulation
              recommendations.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {programs.map((p) => (
              <div key={p.title} className="card">
                <h3 className="text-base font-semibold uppercase tracking-wide text-navy-900">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{p.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 rounded-2xl bg-navy-900 p-8 text-center text-white sm:p-12">
            <h2 className="text-xl font-bold sm:text-2xl">
              Ready to collaborate on patient care?
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-navy-100">
              Call our pharmacist line at {site.phone} or send us a message —
              we'll get back to your office promptly.
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
