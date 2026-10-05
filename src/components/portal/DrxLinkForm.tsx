"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * One-time link between the portal account and the pharmacy record: the
 * patient types one Rx number; the server checks it against their name and
 * date of birth (src/app/api/portal/drx-link). Nothing is kept in the browser.
 */
export default function DrxLinkForm({
  phone,
  phoneHref,
  title = "Connect your pharmacy record",
  intro = "To show your medications, we need to match this account to your record at the pharmacy. Enter the Rx number from any Liberty Pharmacy prescription label. We'll check it against the date of birth on your account. You only need to do this once.",
}: {
  phone: string;
  phoneHref: string;
  title?: string;
  intro?: string;
}) {
  const router = useRouter();
  const [rx, setRx] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const rxNumber = rx.trim();
    if (!/^\d{1,10}$/.test(rxNumber)) {
      setError("Enter the Rx number exactly as printed on your label (digits only).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/portal/drx-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rxNumber }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 401) {
        setError("Your session has ended. Please sign in again.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "We couldn't link your account. Please try again or call us.");
        return;
      }
      // Straight to the result, wherever the form was shown.
      router.push("/portal/medications");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again or call us.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card max-w-xl space-y-5" noValidate>
      <div>
        <h2 className="text-base font-semibold text-navy-900">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{intro}</p>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="link-rx" className="mb-1.5 block text-sm font-medium text-slate-700">
          Rx number
        </label>
        <input
          id="link-rx"
          value={rx}
          onChange={(e) => setRx(e.target.value)}
          inputMode="numeric"
          maxLength={10}
          autoComplete="off"
          className="input-field"
        />
      </div>
      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? "Checking…" : "Connect my record"}
      </button>
      <p className="text-xs leading-5 text-slate-500">
        New to Liberty Pharmacy, or don&apos;t have a label handy? You can still{" "}
        <Link href="/portal/refill" className="underline">
          request a refill
        </Link>{" "}
        or{" "}
        <Link href="/portal/transfer" className="underline">
          transfer a prescription
        </Link>
        , or call us at{" "}
        <a href={phoneHref} className="underline">
          {phone}
        </a>{" "}
        and we&apos;ll connect it for you.
      </p>
    </form>
  );
}
