"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

/**
 * General-inquiry contact form.
 *
 * HIPAA note: this form is intentionally limited to general (non-clinical)
 * questions. The UI warns users not to include health information, and the
 * server route (src/app/api/contact/route.ts) neither stores nor forwards
 * submissions until a BAA-covered delivery channel is configured.
 */
export default function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(json.error ?? "Something went wrong. Please call us instead.");
        return;
      }
      form.reset();
      setStatus("sent");
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again or call us.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5" noValidate>
      <div
        className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        role="note"
      >
        <strong>Please protect your privacy:</strong> do not include health
        conditions, medication names, prescription numbers, date of birth, or
        insurance details in this form. For anything involving your health
        information, please call us at the pharmacy — this form is for general
        questions only.
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="mb-1.5 block text-sm font-medium text-slate-700">
            First name
          </label>
          <input id="firstName" name="firstName" type="text" required maxLength={100} autoComplete="given-name" className="input-field" />
        </div>
        <div>
          <label htmlFor="lastName" className="mb-1.5 block text-sm font-medium text-slate-700">
            Last name
          </label>
          <input id="lastName" name="lastName" type="text" required maxLength={100} autoComplete="family-name" className="input-field" />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" className="input-field" />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-slate-700">
            Phone <span className="text-slate-400">(optional)</span>
          </label>
          <input id="phone" name="phone" type="tel" maxLength={20} autoComplete="tel" className="input-field" />
        </div>
      </div>

      <div>
        <label htmlFor="subject" className="mb-1.5 block text-sm font-medium text-slate-700">
          Subject
        </label>
        <select id="subject" name="subject" required className="input-field" defaultValue="">
          <option value="" disabled>
            Select a topic…
          </option>
          <option value="hours">Store hours & directions</option>
          <option value="products">Product availability (over-the-counter)</option>
          <option value="services">Services offered</option>
          <option value="billing">General billing question</option>
          <option value="other">Other (no health information)</option>
        </select>
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-slate-700">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          maxLength={2000}
          className="input-field"
          placeholder="How can we help? (Please do not include any health information.)"
        />
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" className="btn-primary" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send Message"}
        </button>
        {status === "sent" && (
          <p className="text-sm font-medium text-green-700" role="status">
            Thank you — we received your message.
          </p>
        )}
        {status === "error" && (
          <p className="text-sm font-medium text-liberty-red" role="alert">
            {errorMsg}
          </p>
        )}
      </div>
    </form>
  );
}
