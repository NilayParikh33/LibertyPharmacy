import Link from "next/link";
import { site } from "@/lib/site";
import { getSessionAccountId } from "@/lib/auth";

const stats = [
  { value: "20+", label: "Years Serving Austin" },
  { value: "50K+", label: "Prescriptions Filled" },
  { value: "10K+", label: "Patients Served" },
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

const services = [
  { title: "Prescription Refills", body: "Fast, accurate refills with friendly reminders when you're due." },
  { title: "Compounding", body: "Custom-compounded medications tailored to your exact needs." },
  { title: "Vaccinations", body: "Flu, COVID-19, shingles, and routine immunizations — walk-ins welcome." },
  { title: "1:1 Consultations", body: "Private medication reviews and health consultations with our pharmacists." },
  { title: "Medical Supplies", body: "Medical equipment, first aid, vitamins, and everyday health essentials." },
  { title: "Medication Sync", body: "Align all your refills to a single monthly pickup — one trip, everything ready." },
];

export default async function HomePage() {
  const signedIn = (await getSessionAccountId()) !== null;
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-navy-950 via-navy-900 to-navy-700 text-white">
        <div className="container-site grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <p className="mb-4 inline-block rounded-full bg-navy-800/80 px-4 py-1.5 text-sm font-medium text-navy-100">
              Independently owned pharmacy in Austin, Texas
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Care you can trust, <span className="text-liberty-gold">right in your neighborhood</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-navy-100">
              Liberty Pharmacy combines the personal attention of a local pharmacy
              with modern convenience — fast fills, free delivery, and pharmacists
              who know you by name.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
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

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-white/10 p-6 text-center backdrop-blur">
                <p className="text-3xl font-bold text-liberty-gold">{s.value}</p>
                <p className="mt-1 text-sm text-navy-100">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="py-16 sm:py-20">
        <div className="container-site">
          <h2 className="section-title text-center">Shop Liberty Pharmacy your way</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {highlights.map((h) => (
              <div key={h.title} className="card text-center">
                <div className="text-4xl">{h.icon}</div>
                <h3 className="mt-4 text-lg font-semibold text-navy-900">{h.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{h.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services preview */}
      <section className="bg-slate-50 py-16 sm:py-20">
        <div className="container-site">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="section-title">Services tailored to you</h2>
            <Link href="/services" className="text-sm font-semibold text-navy-700 hover:underline">
              View all services →
            </Link>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <div key={s.title} className="card">
                <h3 className="text-base font-semibold text-navy-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Visit CTA */}
      <section className="py-16 sm:py-20">
        <div className="container-site">
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
        </div>
      </section>
    </>
  );
}
