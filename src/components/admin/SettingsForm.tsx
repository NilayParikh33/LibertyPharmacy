"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SiteSettings } from "@/lib/site";

export default function SettingsForm({ settings }: { settings: SiteSettings }) {
  const router = useRouter();
  const [name, setName] = useState(settings.name);
  const [tagline, setTagline] = useState(settings.tagline);
  const [phone, setPhone] = useState(settings.phone);
  const [phoneHref, setPhoneHref] = useState(settings.phoneHref);
  const [fax, setFax] = useState(settings.fax);
  const [email, setEmail] = useState(settings.email);
  const [line1, setLine1] = useState(settings.address.line1);
  const [city, setCity] = useState(settings.address.city);
  const [state, setState] = useState(settings.address.state);
  const [zip, setZip] = useState(settings.address.zip);
  const [county, setCounty] = useState(settings.address.county);
  const [mapsUrl, setMapsUrl] = useState(settings.mapsUrl);
  const [hours, setHours] = useState(settings.hours);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  function updateHours(i: number, field: "days" | "hours", value: string) {
    setHours((prev) => prev.map((h, idx) => (idx === i ? { ...h, [field]: value } : h)));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setBusy(true);
    try {
      const payload: SiteSettings = {
        name,
        tagline,
        phone,
        phoneHref,
        fax,
        email,
        address: { line1, city, state, zip, county },
        hours,
        mapsUrl,
      };
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5" noValidate>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          Settings saved.
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-slate-700">
            Site name
          </label>
          <input id="name" required className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="tagline" className="mb-1.5 block text-sm font-medium text-slate-700">
            Tagline
          </label>
          <input
            id="tagline"
            required
            className="input-field"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-slate-700">
            Phone (display)
          </label>
          <input id="phone" required className="input-field" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label htmlFor="phoneHref" className="mb-1.5 block text-sm font-medium text-slate-700">
            Phone (tel: link)
          </label>
          <input
            id="phoneHref"
            required
            placeholder="tel:+15125551234"
            className="input-field"
            value={phoneHref}
            onChange={(e) => setPhoneHref(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="fax" className="mb-1.5 block text-sm font-medium text-slate-700">
            Fax
          </label>
          <input id="fax" required className="input-field" value={fax} onChange={(e) => setFax(e.target.value)} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
            Public contact email
          </label>
          <input
            id="email"
            type="email"
            required
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-700">Address</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="line1" className="mb-1.5 block text-sm font-medium text-slate-700">
              Street address
            </label>
            <input id="line1" required className="input-field" value={line1} onChange={(e) => setLine1(e.target.value)} />
          </div>
          <div>
            <label htmlFor="city" className="mb-1.5 block text-sm font-medium text-slate-700">
              City
            </label>
            <input id="city" required className="input-field" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label htmlFor="state" className="mb-1.5 block text-sm font-medium text-slate-700">
              State
            </label>
            <input id="state" required className="input-field" value={state} onChange={(e) => setState(e.target.value)} />
          </div>
          <div>
            <label htmlFor="zip" className="mb-1.5 block text-sm font-medium text-slate-700">
              ZIP
            </label>
            <input id="zip" required className="input-field" value={zip} onChange={(e) => setZip(e.target.value)} />
          </div>
          <div>
            <label htmlFor="county" className="mb-1.5 block text-sm font-medium text-slate-700">
              County
            </label>
            <input id="county" required className="input-field" value={county} onChange={(e) => setCounty(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="mapsUrl" className="mb-1.5 block text-sm font-medium text-slate-700">
              Maps URL
            </label>
            <input
              id="mapsUrl"
              type="url"
              required
              className="input-field"
              value={mapsUrl}
              onChange={(e) => setMapsUrl(e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-700">Store hours</legend>
        <div className="space-y-3">
          {hours.map((h, i) => (
            <div key={i} className="grid grid-cols-2 gap-3">
              <input
                aria-label={`Days ${i + 1}`}
                required
                className="input-field"
                value={h.days}
                onChange={(e) => updateHours(i, "days", e.target.value)}
              />
              <input
                aria-label={`Hours ${i + 1}`}
                required
                className="input-field"
                value={h.hours}
                onChange={(e) => updateHours(i, "hours", e.target.value)}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
        {busy ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
