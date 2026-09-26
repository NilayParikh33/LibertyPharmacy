"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Heart } from "lucide-react";
import Logo from "./Logo";
import { nav } from "@/lib/nav";
import { SAVED_LIST_TRIGGER_ID, useSavedList } from "@/lib/saved-list";

/** "/products/vitamin-d" counts as being in the Products section. */
function isCurrent(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export default function Header({ siteName }: { siteName: string }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // Condense the bar once the page scrolls, so the content gets more room and
  // the header reads as floating above it. Passive listener — this must never
  // block scrolling. Runs once on mount too, because a reload can restore a
  // scroll position part-way down the page.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on navigation (including back/forward) and on Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`lp-enter-down lp-condense sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300 ease-standard ${
        scrolled || open
          ? "border-slate-200/70 bg-white/80 shadow-card backdrop-blur-xl backdrop-saturate-150"
          : "border-transparent bg-white"
      }`}
    >
      <div
        className={`lp-condense container-site flex items-center justify-between gap-4 transition-[height] duration-300 ease-premium ${
          scrolled ? "h-14" : "h-[4.5rem]"
        }`}
      >
        <Link href="/" className="group flex items-center gap-3" aria-label={`${siteName} home`}>
          <Logo
            className={`lp-condense transition-[width,height] duration-300 ease-premium ${
              scrolled ? "h-9 w-9" : "h-11 w-11"
            }`}
          />
          <span className="text-xl font-bold tracking-tight text-navy-950">
            Liberty <span className="text-liberty-red">Pharmacy</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <SavedListButton />
          <Link href="/portal" className="btn-accent btn-sm hidden lg:inline-flex">
            Patient Portal
          </Link>

          {/* Hamburger that morphs into a close icon. */}
          <button
            type="button"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-navy-900 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-700 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-hidden="true" className="relative block h-3.5 w-5">
              {["top-0", "top-1/2 -translate-y-1/2", "bottom-0"].map((pos, i) => (
                <span
                  key={pos}
                  className={`lp-collapse absolute left-0 h-0.5 w-5 rounded-full bg-current transition-[transform,opacity,top,bottom] duration-300 ease-premium ${pos} ${
                    open
                      ? i === 0
                        ? "!top-1/2 -translate-y-1/2 rotate-45"
                        : i === 1
                          ? "opacity-0"
                          : "!bottom-1/2 translate-y-1/2 -rotate-45"
                      : ""
                  }`}
                />
              ))}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile menu. Always rendered so it can animate closed; `inert` keeps
          it out of the tab order and away from screen readers while shut.
          The 0fr→1fr grid row animates to the menu's natural height. */}
      <div
        id="mobile-nav"
        inert={!open}
        className={`lp-collapse grid transition-[grid-template-rows,opacity] duration-300 ease-premium lg:hidden ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <nav aria-label="Mobile navigation" className="border-t border-slate-100">
            {/* key={open} replays the stagger each time the menu opens. */}
            <ul key={String(open)} className="container-site flex flex-col gap-1 py-4">
              {nav.map((item, i) => (
                <li
                  key={item.href}
                  className={open ? "lp-menu-item" : ""}
                  style={{ "--lp-delay": `${40 + i * 40}ms` } as React.CSSProperties}
                >
                  <Link
                    href={item.href}
                    aria-current={isCurrent(pathname, item.href) ? "page" : undefined}
                    className="flex items-center justify-between rounded-xl px-3 py-3 text-base font-medium text-navy-900 transition-colors hover:bg-navy-50 aria-[current=page]:bg-navy-50 aria-[current=page]:text-navy-700"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                    <span aria-hidden="true" className="text-slate-300">
                      →
                    </span>
                  </Link>
                </li>
              ))}
              <li
                className={open ? "lp-menu-item" : ""}
                style={{ "--lp-delay": `${40 + nav.length * 40}ms` } as React.CSSProperties}
              >
                <Link href="/portal" className="btn-accent mt-3 w-full" onClick={() => setOpen(false)}>
                  Patient Portal
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}

/** Heart button with a count badge that pops each time something is saved. */
function SavedListButton() {
  const { count, ready, bump, openDrawer } = useSavedList();
  const label = count === 0 ? "Saved list, empty" : `Saved list, ${count} ${count === 1 ? "item" : "items"}`;

  return (
    <button
      type="button"
      id={SAVED_LIST_TRIGGER_ID}
      onClick={(e) => openDrawer(e.currentTarget)}
      aria-label={label}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-navy-900 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-700"
    >
      {/* key={bump} remounts the icon so its pop replays on every save. */}
      <span key={bump} className={bump > 0 ? "lp-pop" : ""}>
        <Heart
          aria-hidden="true"
          className={`h-5 w-5 transition-colors ${count > 0 ? "fill-liberty-red text-liberty-red" : ""}`}
        />
      </span>
      {ready && count > 0 && (
        <span
          key={`badge-${bump}`}
          aria-hidden="true"
          className={`absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-navy-900 px-1 text-[11px] font-bold tabular-nums text-white ring-2 ring-white ${
            bump > 0 ? "lp-pop" : ""
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
