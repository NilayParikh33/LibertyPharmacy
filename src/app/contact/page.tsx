import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import ContactForm from "@/components/ContactForm";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Reach Liberty Pharmacy in Austin, TX — call, visit, or send us a general inquiry.",
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        title="Contact Us"
        subtitle="Questions about hours, products, or services? We'd love to hear from you."
      />

      <section className="py-16">
        <div className="container-site grid gap-10 lg:grid-cols-[1fr,1.4fr]">
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                🗺 Address
              </h2>
              <p className="mt-2 text-slate-700">
                {site.address.line1}
                <br />
                {site.address.city}, {site.address.state} {site.address.zip}
              </p>
              <a
                href={site.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-semibold text-navy-700 hover:underline"
              >
                Get directions →
              </a>
            </div>
            <div className="card">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                📞 Phone & Fax
              </h2>
              <p className="mt-2 text-slate-700">
                Phone:{" "}
                <a href={site.phoneHref} className="font-medium text-navy-700 hover:underline">
                  {site.phone}
                </a>
                <br />
                Fax: {site.fax}
              </p>
            </div>
            <div className="card">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                🕐 Store Hours
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {site.hours.map((h) => (
                  <li key={h.days} className="flex justify-between gap-6">
                    <span>{h.days}</span>
                    <span>{h.hours}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-navy-100 bg-navy-50 p-5 text-sm leading-6 text-navy-900">
              <strong>Need to discuss a prescription or your health?</strong>
              <br />
              Please call us directly — phone conversations with our
              pharmacists are the safest way to discuss your health
              information. This website's form is for general questions only.
            </div>
          </div>

          <div>
            <h2 className="section-title">Send a general inquiry</h2>
            <div className="mt-6">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
