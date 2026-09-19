/**
 * Standard inner-page hero.
 *
 * Uses `.lp-enter` (load-time animation) rather than scroll-reveal — this is
 * always above the fold, so waiting for an intersection would just delay it.
 * Both are disabled under prefers-reduced-motion. See globals.css.
 */
export default function PageHero({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <section className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 py-16 text-white">
      <div className="container-site">
        <h1 className="lp-enter text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && (
          <p
            className="lp-enter mt-3 max-w-2xl text-navy-100"
            style={{ "--lp-delay": "120ms" } as React.CSSProperties}
          >
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
