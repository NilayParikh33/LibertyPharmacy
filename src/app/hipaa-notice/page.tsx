import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "HIPAA Notice of Privacy Practices",
  description:
    "How Liberty Pharmacy may use and disclose your protected health information, and your rights regarding that information.",
};

/**
 * Notice of Privacy Practices (NPP) — template.
 *
 * IMPORTANT: This is a standard NPP template covering the elements required
 * by 45 CFR 164.520. Before going live it MUST be reviewed by the pharmacy's
 * Privacy Officer / legal counsel, dated, and kept consistent with the
 * printed notice posted in the store.
 */
export default function HipaaNoticePage() {
  return (
    <>
      <PageHero
        title="HIPAA Notice of Privacy Practices"
        subtitle="This notice describes how medical information about you may be used and disclosed, and how you can get access to this information. Please review it carefully."
      />

      <section className="py-16">
        <div className="container-site max-w-3xl space-y-10">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
            <strong>Effective date: August 1, 2026.</strong> This notice applies
            to pharmacy services provided by {site.name}. A printed copy is
            available at our counter — ask any staff member.
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy-900">Our commitment to your privacy</h2>
            <p className="mt-3 leading-7 text-slate-600">
              {site.name} is required by law to maintain the privacy of your
              protected health information (PHI), to provide you this notice of
              our legal duties and privacy practices, and to abide by the terms
              of the notice currently in effect. We will notify you promptly if
              a breach occurs that may have compromised the privacy or security
              of your information.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy-900">How we may use and disclose your PHI</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 leading-7 text-slate-600">
              <li>
                <strong>Treatment:</strong> to fill your prescriptions, check for
                drug interactions, and coordinate care with your physicians and
                other providers.
              </li>
              <li>
                <strong>Payment:</strong> to bill and collect payment from you,
                your insurance company, or other payers.
              </li>
              <li>
                <strong>Health care operations:</strong> for quality assurance,
                staff training, licensing, and business management activities.
              </li>
              <li>
                <strong>Refill reminders and health services:</strong> we may
                contact you about refills, medication therapy, or other
                health-related benefits and services.
              </li>
              <li>
                <strong>As required by law:</strong> including public health
                reporting, health oversight, law enforcement when legally
                compelled, and to prevent a serious threat to health or safety.
              </li>
            </ul>
            <p className="mt-3 leading-7 text-slate-600">
              Uses and disclosures not described in this notice — including most
              uses for marketing, any sale of PHI, and most sharing of
              psychotherapy notes — will be made only with your written
              authorization, which you may revoke at any time.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy-900">Your rights</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6 leading-7 text-slate-600">
              <li>Get a copy of your pharmacy records (paper or electronic).</li>
              <li>Ask us to correct records you believe are wrong or incomplete.</li>
              <li>Request confidential communications (e.g., contact you only at a specific number).</li>
              <li>Ask us to limit what we use or share.</li>
              <li>Get a list of those with whom we&apos;ve shared your information.</li>
              <li>Get a paper copy of this notice at any time.</li>
              <li>Choose someone to act for you (medical power of attorney or legal guardian).</li>
              <li>
                File a complaint if you believe your privacy rights have been
                violated — with us directly, or with the U.S. Department of
                Health and Human Services Office for Civil Rights. We will
                never retaliate against you for filing a complaint.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy-900">Contact our Privacy Officer</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Privacy Officer, {site.name}
              <br />
              {site.address.line1}, {site.address.city}, {site.address.state} {site.address.zip}
              <br />
              Phone:{" "}
              <a href={site.phoneHref} className="font-medium text-navy-700 underline">
                {site.phone}
              </a>
            </p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-navy-900">Changes to this notice</h2>
            <p className="mt-3 leading-7 text-slate-600">
              We reserve the right to change this notice and to make the revised
              notice effective for all PHI we maintain. The current notice will
              always be posted in our store and on this page with its effective
              date.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
