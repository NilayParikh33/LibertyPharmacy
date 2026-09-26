import type { Metadata } from "next";
import { Phone, Printer } from "lucide-react";
import Reveal from "@/components/Reveal";
import { stagger } from "@/lib/motion";
import PageHero from "@/components/PageHero";
import { getSiteSettings } from "@/lib/site";

export const metadata: Metadata = {
  title: "Locations",
  description: "Find Liberty Pharmacy at 8650 Spicewood Springs Rd #106, Austin, TX 78759.",
};

export default async function LocationsPage() {
  const site = await getSiteSettings();
  return (
    <>
      <PageHero
        eyebrow="Visit"
        title="Our Location"
        subtitle="Conveniently located on Spicewood Springs Road in Northwest Austin."
      />

      <section className="py-16">
        <div className="container-site grid gap-8 lg:grid-cols-2">
          <Reveal as="div" className="card">
            <h2 className="text-xl font-bold text-navy-900">{site.name}</h2>
            <address className="mt-4 not-italic leading-7 text-slate-600">
              {site.address.line1}
              <br />
              {site.address.city}, {site.address.state} {site.address.zip}
              <br />
              {site.address.county} County
            </address>
            <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
              <li className="flex items-center gap-2.5">
                <Phone aria-hidden="true" className="h-4 w-4 text-navy-600" />
                <a href={site.phoneHref} className="font-medium text-navy-700 hover:underline">
                  {site.phone}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Printer aria-hidden="true" className="h-4 w-4 text-slate-400" />
                Fax: {site.fax}
              </li>
            </ul>
            <a
              href={site.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary mt-6"
            >
              Open in Google Maps
            </a>
          </Reveal>

          <Reveal as="div" delay={stagger(1)} className="card">
            <h2 className="text-xl font-bold text-navy-900">Store Hours</h2>
            <ul className="mt-4 divide-y divide-slate-100">
              {site.hours.map((h) => (
                <li key={h.days} className="flex justify-between py-3 text-sm">
                  <span className="font-medium text-slate-700">{h.days}</span>
                  <span className="text-slate-600">{h.hours}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl bg-navy-50 p-4 text-sm text-slate-600">
              Free local prescription delivery is available throughout the
              Austin area — call us to arrange a drop-off.
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
