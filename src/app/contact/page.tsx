import type { Metadata } from "next";
import { Clock, MapPin, Phone } from "lucide-react";
import Reveal from "@/components/Reveal";
import { stagger } from "@/lib/motion";
import PageHero from "@/components/PageHero";
import ContactForm from "@/components/ContactForm";
import { getSiteSettings } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Reach Liberty Pharmacy in Austin, TX — call, visit, or send us a general inquiry.",
};

export default async function ContactPage() {
  const site = await getSiteSettings();
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Contact Us"
        subtitle="Questions about hours, products, or services? We'd love to hear from you."
      />

      <section className="py-16">
        <div className="container-site grid gap-10 lg:grid-cols-[1fr,1.4fr]">
          <div className="space-y-6">
            <Reveal as="div" className="card">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                <MapPin aria-hidden="true" className="h-4 w-4 text-navy-600" /> Address
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
            </Reveal>
            <Reveal as="div" delay={stagger(1)} className="card">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                <Phone aria-hidden="true" className="h-4 w-4 text-navy-600" /> Phone & Fax
              </h2>
              <p className="mt-2 text-slate-700">
                Phone:{" "}
                <a href={site.phoneHref} className="font-medium text-navy-700 hover:underline">
                  {site.phone}
                </a>
                <br />
                Fax: {site.fax}
              </p>
            </Reveal>
            <Reveal as="div" delay={stagger(2)} className="card">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                <Clock aria-hidden="true" className="h-4 w-4 text-navy-600" /> Store Hours
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {site.hours.map((h) => (
                  <li key={h.days} className="flex justify-between gap-6">
                    <span>{h.days}</span>
                    <span>{h.hours}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <div className="rounded-2xl border border-navy-100 bg-navy-50 p-5 text-sm leading-6 text-navy-900">
              <strong>Need to discuss a prescription or your health?</strong>
              <br />
              Please call us directly — phone conversations with our
              pharmacists are the safest way to discuss your health
              information. This website&apos;s form is for general questions only.
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
