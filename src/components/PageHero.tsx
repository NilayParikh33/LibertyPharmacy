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
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-navy-100">{subtitle}</p>}
      </div>
    </section>
  );
}
