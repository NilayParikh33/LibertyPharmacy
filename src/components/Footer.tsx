import Link from "next/link";
import Logo from "./Logo";
import { site } from "@/lib/site";

const gettingStarted = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" },
  { label: "Contact Us", href: "/contact" },
  { label: "Locations", href: "/locations" },
];

const explore = [
  { label: "Services", href: "/services" },
  { label: "For Providers", href: "/providers" },
  { label: "Blog", href: "/blog" },
  { label: "Patient Portal", href: "/portal" },
];

const legal = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "HIPAA Notice of Privacy Practices", href: "/hipaa-notice" },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-navy-950 text-slate-300">
      <div className="container-site grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <span className="text-base font-bold text-white">
              Liberty <span className="text-liberty-gold">Pharmacy</span>
            </span>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-400">{site.tagline}</p>
          <address className="mt-4 text-sm not-italic leading-6 text-slate-400">
            {site.address.line1}
            <br />
            {site.address.city}, {site.address.state} {site.address.zip}
          </address>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Getting Started</h3>
          <ul className="mt-4 space-y-2.5">
            {gettingStarted.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Explore</h3>
          <ul className="mt-4 space-y-2.5">
            {explore.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <h3 className="mt-6 text-sm font-semibold text-white">Legal</h3>
          <ul className="mt-4 space-y-2.5">
            {legal.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Contact & Hours</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <a href={site.phoneHref} className="hover:text-white">
                📞 {site.phone}
              </a>
            </li>
            <li>🖨 Fax: {site.fax}</li>
          </ul>
          <ul className="mt-4 space-y-1.5 text-sm text-slate-400">
            {site.hours.map((h) => (
              <li key={h.days} className="flex justify-between gap-4">
                <span>{h.days}</span>
                <span>{h.hours}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-navy-800">
        <div className="container-site flex flex-col items-center justify-between gap-2 py-5 text-xs text-slate-500 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <p>This website does not collect or store protected health information.</p>
        </div>
      </div>
    </footer>
  );
}
