import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { getSiteSettings } from "@/lib/site";

export const metadata: Metadata = {
  title: "Website Privacy Policy",
  description: "How the Liberty Pharmacy website handles your information.",
};

export default async function PrivacyPolicyPage() {
  const site = await getSiteSettings();
  return (
    <>
      <PageHero
        title="Website Privacy Policy"
        subtitle="Effective date: August 1, 2026 — applies to this website only."
      />

      <section className="py-16">
        <div className="container-site max-w-3xl space-y-10">
          <div>
            <h2 className="text-xl font-bold text-navy-900">Our approach: collect as little as possible</h2>
            <p className="mt-3 leading-7 text-slate-600">
              This website is an informational site for {site.name}. It is
              deliberately designed <strong>not</strong> to collect, store, or
              transmit protected health information (PHI). Pharmacy services
              that involve your health information — refills, transfers, and
              the patient portal — will be provided through a separate, secured
              patient portal system, governed by our{" "}
              <a href="/hipaa-notice" className="font-medium text-navy-700 underline">
                HIPAA Notice of Privacy Practices
              </a>.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy-900">What this website collects</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 leading-7 text-slate-600">
              <li>
                <strong>Contact form:</strong> if you send a general inquiry we
                receive the name, contact details, and message you provide. We
                ask you not to include any health information, and our systems
                screen for and reject messages that appear to contain it.
              </li>
              <li>
                <strong>Standard server logs:</strong> like nearly all
                websites, our hosting infrastructure may record IP addresses
                and request metadata for security and reliability purposes.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy-900">What this website does NOT do</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 leading-7 text-slate-600">
              <li>No advertising or analytics trackers (no Google Analytics, no Meta Pixel, no ad networks).</li>
              <li>No third-party cookies. The site sets no tracking cookies at all.</li>
              <li>No sale or sharing of visitor information with third parties.</li>
              <li>No collection of health, prescription, or insurance information.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy-900">Security</h2>
            <p className="mt-3 leading-7 text-slate-600">
              All traffic to this website is encrypted in transit using HTTPS
              (TLS). We apply strict browser security policies including
              Content-Security-Policy, HTTP Strict Transport Security, and
              frame-embedding protections.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy-900">Children&apos;s privacy</h2>
            <p className="mt-3 leading-7 text-slate-600">
              This website is not directed at children under 13 and we do not
              knowingly collect information from them.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy-900">Changes & contact</h2>
            <p className="mt-3 leading-7 text-slate-600">
              We may update this policy as the website evolves — the effective
              date above will change when we do. Questions? Call us at{" "}
              <a href={site.phoneHref} className="font-medium text-navy-700 underline">
                {site.phone}
              </a>{" "}
              or visit us at {site.address.line1}, {site.address.city},{" "}
              {site.address.state} {site.address.zip}.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
