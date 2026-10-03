import { accreditations, PLACEHOLDER_SLOTS } from "@/lib/accreditations";

/**
 * Footer accreditation badges.
 *
 * Driven entirely by `src/lib/accreditations.ts`. Behaviour by environment:
 *
 *  - Badges configured → renders them, each linking to the accrediting body's
 *    verification record (which LegitScript and NABP both require the seal to
 *    do).
 *  - None configured, production → renders NOTHING. A deploy made before the
 *    official assets arrive cannot publish an accreditation claim the
 *    pharmacy cannot evidence.
 *  - None configured, development → renders neutral, clearly-labelled empty
 *    slots so the layout can be designed against. These are deliberately not
 *    badge-shaped lookalikes and carry no accrediting body's name.
 *
 * Swapping the placeholders for the real thing is a data-only change: drop the
 * official files into public/accreditations/ and fill in the array.
 */
export default function AccreditationStrip() {
  const isDev = process.env.NODE_ENV === "development";
  const hasBadges = accreditations.length > 0;

  if (!hasBadges && !isDev) return null;

  return (
    <div className="border-t border-navy-800">
      <div className="container-site py-10">
        <h2 className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
          Accreditations &amp; Certifications
        </h2>

        <ul className="mt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {hasBadges
            ? accreditations.map((a) => (
                <li key={a.id}>
                  <BadgeFrame verifyUrl={a.verifyUrl} name={a.name}>
                    {/* Plain <img>: no image optimizer in the standalone
                        runtime, and the CSP allows img-src 'self' only. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.badge}
                      alt={a.alt}
                      loading="lazy"
                      className="h-20 w-auto object-contain sm:h-24"
                    />
                  </BadgeFrame>
                </li>
              ))
            : Array.from({ length: PLACEHOLDER_SLOTS }, (_, i) => (
                <li key={i}>
                  <div
                    className="flex h-20 w-36 flex-col items-center justify-center rounded-lg border border-dashed border-navy-700 px-3 text-center sm:h-24 sm:w-44"
                    title="Layout placeholder — shown in development only"
                  >
                    <span className="text-[11px] font-medium leading-tight text-slate-500">
                      Badge slot
                    </span>
                    <span className="mt-1 text-[10px] leading-tight text-slate-600">
                      add official asset
                    </span>
                  </div>
                </li>
              ))}
        </ul>

        {!hasBadges && (
          // Dev-only note, so nobody mistakes the slots for finished work.
          <p className="mt-4 text-center text-[11px] leading-5 text-slate-600">
            Development placeholder — configure src/lib/accreditations.ts with the
            official badge assets and verification links. Nothing renders here in
            production until then.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Wraps a badge in its verification link when one is set.
 *
 * A seal with no verification link is a weaker claim and, for LegitScript and
 * NABP, generally a breach of their display terms — so an unlinked badge stays
 * visible but is called out in development.
 */
function BadgeFrame({
  verifyUrl,
  name,
  children,
}: {
  verifyUrl?: string;
  name: string;
  children: React.ReactNode;
}) {
  if (!verifyUrl) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `[accreditations] "${name}" has no verifyUrl. Both NABP and LegitScript ` +
          `require their seal to link to the live verification record.`
      );
    }
    return <>{children}</>;
  }

  return (
    <a
      href={verifyUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="lp-lift block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-liberty-gold"
      aria-label={`${name} — verify this accreditation (opens in a new tab)`}
    >
      {children}
    </a>
  );
}
