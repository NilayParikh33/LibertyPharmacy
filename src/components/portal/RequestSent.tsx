import Link from "next/link";

/**
 * Confirmation shown after a refill or transfer request is stored. Server-safe
 * (no hooks) so both client forms can render it. It says what happens next in
 * plain terms and points to the phone for anything urgent: the queue is worked
 * during business hours, so a patient who is out of medication today should
 * not be left waiting on a web form.
 */
export default function RequestSent({
  title,
  id,
  phone,
  phoneHref,
  next,
}: {
  title: string;
  id: number;
  phone: string;
  phoneHref: string;
  /** Optional extra "what happens next" line. */
  next?: string;
}) {
  return (
    <div role="status" className="card space-y-4">
      <h2 className="text-xl font-semibold text-navy-900">{title}</h2>
      <p className="text-sm leading-6 text-slate-700">
        Your request number is <strong className="text-navy-900">#{id}</strong>. Our pharmacists will start on it during
        business hours, and you can follow its status on your portal page.
      </p>
      {next && <p className="text-sm leading-6 text-slate-700">{next}</p>}
      <p className="text-sm leading-6 text-slate-600">
        Need it sooner? Call us at{" "}
        <a href={phoneHref} className="font-semibold text-navy-700 underline">
          {phone}
        </a>
        .
      </p>
      <Link href="/portal" className="btn-primary">
        Back to my portal
      </Link>
    </div>
  );
}
