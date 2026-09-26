import { delayStyle } from "@/lib/motion";

/**
 * Standard inner-page hero.
 *
 * Same visual language as the home hero — navy depth, faint dot grid, slow
 * background light — at a quieter scale, so every page reads as one brand.
 * Uses `.lp-enter` (load-time, CSS-only) rather than scroll-reveal: this is
 * always above the fold, so waiting for an intersection would just delay it.
 */
export default function PageHero({
  title,
  subtitle,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  /** Small label above the title, e.g. the section name. */
  eyebrow?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-navy-950 text-white">
      <div className="absolute inset-0 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800" />
      <div className="bg-dot-grid absolute inset-0" />
      <div
        aria-hidden="true"
        className="lp-orb absolute -right-24 -top-24 h-80 w-80 rounded-full bg-navy-500/25 blur-3xl"
      />
      <div className="container-site relative py-16 sm:py-20">
        {eyebrow && (
          <p
            className="lp-enter text-xs font-semibold uppercase tracking-[0.16em] text-liberty-gold"
            style={delayStyle(40)}
          >
            {eyebrow}
          </p>
        )}
        <h1
          className={`lp-enter text-4xl font-bold tracking-tight sm:text-5xl ${eyebrow ? "mt-3" : ""}`}
          style={delayStyle(eyebrow ? 100 : 40)}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="lp-enter mt-4 max-w-2xl text-lg leading-8 text-navy-100" style={delayStyle(180)}>
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
