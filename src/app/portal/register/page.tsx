"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PageHero from "@/components/PageHero";
import { stashDemoOtp } from "@/lib/demo-otp";

/**
 * New patient registration.
 *
 * Field set mirrors the DRX patient record (see src/lib/db.ts) so the later
 * DRX integration maps 1:1. Submitted over our own API; PHI is encrypted
 * at rest server-side. This page never stores anything locally.
 */

const inputCls = "input-field";
const labelCls = "mb-1.5 block text-sm font-medium text-slate-700";
const sectionCls = "border-t border-slate-200 pt-6";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const f = new FormData(e.currentTarget);
    const v = (k: string) => (f.get(k) as string | null)?.trim() ?? "";

    if (v("password") !== v("confirmPassword")) {
      setError("Passwords do not match.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: v("email"),
          password: v("password"),
          firstName: v("firstName"),
          middleInitial: v("middleInitial"),
          lastName: v("lastName"),
          dateOfBirth: v("dateOfBirth"),
          gender: v("gender"),
          address1: v("address1"),
          address2: v("address2"),
          city: v("city"),
          state: v("state").toUpperCase(),
          zip: v("zip"),
          phone: v("phone"),
          cellPhone: v("cellPhone"),
          preferredLanguage: v("preferredLanguage"),
          allergies: v("allergies"),
          medicalConditions: v("medicalConditions"),
          insBin: v("insBin"),
          insPcn: v("insPcn"),
          insGroup: v("insGroup"),
          insCardholderId: v("insCardholderId"),
          insPersonCode: v("insPersonCode"),
          insRelationship: v("insRelationship"),
          deliveryMethod: v("deliveryMethod"),
          smsOptIn: f.get("smsOptIn") === "on",
          hipaaAcknowledged: f.get("hipaaAcknowledged") === "on",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unable to create your account. Please review the form.");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      stashDemoOtp(data.demoCode);
      router.push("/portal/verify?new=1");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHero
        title="New Patient Registration"
        subtitle="Create your account so we can care for you — online and in store."
      />
      <section className="py-16">
        <div className="container-site max-w-3xl">
          <div className="mb-8 rounded-xl border border-navy-200 bg-navy-50 p-5 text-sm leading-6 text-slate-700">
            <strong className="text-navy-900">Your privacy is protected.</strong>{" "}
            This form is submitted securely and your health information is
            encrypted. Review our{" "}
            <Link href="/hipaa-notice" className="font-medium text-navy-700 underline">
              Notice of Privacy Practices
            </Link>{" "}
            for details on how we use and protect your information.
          </div>

          <form onSubmit={onSubmit} className="card space-y-6" noValidate>
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            {/* ------------------------------ Account ----------------------------- */}
            <div>
              <h2 className="text-base font-semibold text-navy-900">Account</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="email" className={labelCls}>Email *</label>
                  <input id="email" name="email" type="email" autoComplete="email" required className={inputCls} />
                </div>
                <div>
                  <label htmlFor="password" className={labelCls}>Password *</label>
                  <input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} className={inputCls} />
                  <p className="mt-1 text-xs text-slate-500">At least 12 characters with upper, lower, and a number.</p>
                </div>
                <div>
                  <label htmlFor="confirmPassword" className={labelCls}>Confirm password *</label>
                  <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required className={inputCls} />
                </div>
              </div>
            </div>

            {/* ----------------------------- Identity ----------------------------- */}
            <div className={sectionCls}>
              <h2 className="text-base font-semibold text-navy-900">About you</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className={labelCls}>First name *</label>
                  <input id="firstName" name="firstName" autoComplete="given-name" required className={inputCls} />
                </div>
                <div className="grid grid-cols-[4.5rem,1fr] gap-4">
                  <div>
                    <label htmlFor="middleInitial" className={labelCls}>M.I.</label>
                    <input id="middleInitial" name="middleInitial" maxLength={1} className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="lastName" className={labelCls}>Last name *</label>
                    <input id="lastName" name="lastName" autoComplete="family-name" required className={inputCls} />
                  </div>
                </div>
                <div>
                  <label htmlFor="dateOfBirth" className={labelCls}>Date of birth *</label>
                  <input id="dateOfBirth" name="dateOfBirth" type="date" autoComplete="bday" required className={inputCls} />
                </div>
                <div>
                  <label htmlFor="gender" className={labelCls}>Gender *</label>
                  <select id="gender" name="gender" required className={inputCls} defaultValue="">
                    <option value="" disabled>Select…</option>
                    <option value="F">Female</option>
                    <option value="M">Male</option>
                    <option value="O">Other</option>
                    <option value="U">Prefer not to say</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ----------------------------- Address ------------------------------ */}
            <div className={sectionCls}>
              <h2 className="text-base font-semibold text-navy-900">Address</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="address1" className={labelCls}>Street address *</label>
                  <input id="address1" name="address1" autoComplete="address-line1" required className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="address2" className={labelCls}>Apt / suite</label>
                  <input id="address2" name="address2" autoComplete="address-line2" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="city" className={labelCls}>City *</label>
                  <input id="city" name="city" autoComplete="address-level2" required className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="state" className={labelCls}>State *</label>
                    <input id="state" name="state" autoComplete="address-level1" maxLength={2} placeholder="TX" required className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="zip" className={labelCls}>ZIP *</label>
                    <input id="zip" name="zip" autoComplete="postal-code" inputMode="numeric" required className={inputCls} />
                  </div>
                </div>
              </div>
            </div>

            {/* ----------------------------- Contact ------------------------------ */}
            <div className={sectionCls}>
              <h2 className="text-base font-semibold text-navy-900">Contact</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="cellPhone" className={labelCls}>Mobile phone *</label>
                  <input id="cellPhone" name="cellPhone" type="tel" autoComplete="tel" required className={inputCls} />
                </div>
                <div>
                  <label htmlFor="phone" className={labelCls}>Home phone</label>
                  <input id="phone" name="phone" type="tel" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="preferredLanguage" className={labelCls}>Preferred language *</label>
                  <select id="preferredLanguage" name="preferredLanguage" required className={inputCls} defaultValue="English">
                    <option>English</option>
                    <option>Spanish</option>
                    <option>Vietnamese</option>
                    <option>Mandarin</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2.5 text-sm text-slate-700">
                    <input type="checkbox" name="smsOptIn" className="h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-navy-500" />
                    Text me when my prescriptions are ready
                  </label>
                </div>
              </div>
            </div>

            {/* ----------------------------- Clinical ----------------------------- */}
            <div className={sectionCls}>
              <h2 className="text-base font-semibold text-navy-900">Health information</h2>
              <p className="mt-1 text-sm text-slate-500">
                Helps our pharmacists check for interactions. Optional — you can also share this in store.
              </p>
              <div className="mt-4 grid gap-4">
                <div>
                  <label htmlFor="allergies" className={labelCls}>Drug allergies</label>
                  <input id="allergies" name="allergies" placeholder='e.g. Penicillin — or "None known"' className={inputCls} />
                </div>
                <div>
                  <label htmlFor="medicalConditions" className={labelCls}>Medical conditions</label>
                  <input id="medicalConditions" name="medicalConditions" placeholder="e.g. Diabetes, high blood pressure" className={inputCls} />
                </div>
              </div>
            </div>

            {/* ---------------------------- Insurance ----------------------------- */}
            <div className={sectionCls}>
              <h2 className="text-base font-semibold text-navy-900">Insurance</h2>
              <p className="mt-1 text-sm text-slate-500">
                From your prescription insurance card. Optional — bring your card to your first visit instead.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="insBin" className={labelCls}>BIN</label>
                  <input id="insBin" name="insBin" inputMode="numeric" maxLength={6} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="insPcn" className={labelCls}>PCN</label>
                  <input id="insPcn" name="insPcn" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="insGroup" className={labelCls}>Group #</label>
                  <input id="insGroup" name="insGroup" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="insCardholderId" className={labelCls}>Member / Cardholder ID</label>
                  <input id="insCardholderId" name="insCardholderId" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="insPersonCode" className={labelCls}>Person code</label>
                  <input id="insPersonCode" name="insPersonCode" maxLength={3} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="insRelationship" className={labelCls}>Relationship to cardholder</label>
                  <select id="insRelationship" name="insRelationship" className={inputCls} defaultValue="">
                    <option value="">Select…</option>
                    <option value="1">Self</option>
                    <option value="2">Spouse</option>
                    <option value="3">Child</option>
                    <option value="4">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* --------------------------- Preferences ---------------------------- */}
            <div className={sectionCls}>
              <h2 className="text-base font-semibold text-navy-900">Prescription pickup</h2>
              <div className="mt-4">
                <label htmlFor="deliveryMethod" className={labelCls}>How would you like to receive prescriptions? *</label>
                <select id="deliveryMethod" name="deliveryMethod" required className={inputCls} defaultValue="pickup">
                  <option value="pickup">Pick up in store</option>
                  <option value="delivery">Free local delivery</option>
                  <option value="mail">Mail</option>
                </select>
              </div>
            </div>

            {/* ------------------------------ Consent ----------------------------- */}
            <div className={sectionCls}>
              <label className="flex items-start gap-2.5 text-sm leading-6 text-slate-700">
                <input
                  type="checkbox"
                  name="hipaaAcknowledged"
                  required
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-navy-500"
                />
                <span>
                  I acknowledge that I have been offered Liberty Pharmacy&apos;s{" "}
                  <Link href="/hipaa-notice" target="_blank" className="font-medium text-navy-700 underline">
                    Notice of Privacy Practices
                  </Link>{" "}
                  and consent to Liberty Pharmacy storing the information above to provide
                  pharmacy services. *
                </span>
              </label>
            </div>

            <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60">
              {busy ? "Creating your account…" : "Create account"}
            </button>
            <p className="text-center text-sm text-slate-600">
              Already have an account?{" "}
              <Link href="/portal/login" className="font-medium text-navy-700 underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </section>
    </>
  );
}
