import { BadgePercent, CalendarCheck, Check, FlaskConical, ShieldCheck, Truck } from "lucide-react";
import Logo from "./Logo";
import { delayStyle } from "@/lib/motion";

/**
 * Home hero visual: a service card with two floating detail chips, over slow
 * background light.
 *
 * Every line on it is something the pharmacy actually offers today (fast
 * fills, pharmacist review, insurance/Medicare checks, free local delivery,
 * med sync, compounding) — no invented numbers, no mock patient data, and
 * nothing that implies online refills, which aren't live yet.
 *
 * Motion, in order: card scales in → fill bar runs once → checklist rows
 * settle one by one → chips arrive. Afterwards only the two chips move, 6px
 * over 8–9.5s. Everything is still under prefers-reduced-motion. Pure markup
 * and CSS: renders on the server, no JavaScript.
 */

const rows = [
  { icon: ShieldCheck, label: "Checked by a pharmacist" },
  { icon: BadgePercent, label: "Insurance & Medicare checked" },
  { icon: Truck, label: "Free delivery across Austin" },
];

export default function HeroVisual() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md px-4 py-14 sm:px-10">
      {/* Background light. */}
      <div className="lp-orb absolute -right-10 top-0 h-64 w-64 rounded-full bg-navy-400/30 blur-3xl" />
      <div className="lp-orb-b absolute -left-6 bottom-4 h-56 w-56 rounded-full bg-liberty-gold/20 blur-3xl" />
      <div className="absolute inset-6 rounded-full border border-white/10" />

      {/* Main card. */}
      <div
        className="lp-enter-scale relative rounded-3xl bg-white p-6 text-left shadow-lift ring-1 ring-white/50"
        style={delayStyle(200)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <div>
              <p className="text-sm font-semibold leading-tight text-navy-950">Liberty Pharmacy</p>
              <p className="text-xs text-slate-500">Austin, Texas</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
            20+ years
          </span>
        </div>

        <p className="mt-5 text-lg font-bold tracking-tight text-navy-950">Your prescription, handled</p>

        <div className="mt-4">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium text-slate-500">Typical fill time</span>
            <span className="font-semibold text-navy-900">about 15 min</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="lp-fill h-full rounded-full bg-gradient-to-r from-navy-700 to-navy-400"
              style={delayStyle(700)}
            />
          </div>
        </div>

        <ul className="mt-5 space-y-2.5">
          {rows.map(({ icon: RowIcon, label }, i) => (
            <li
              key={label}
              className="lp-enter flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5"
              style={delayStyle(850 + i * 110)}
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-navy-700 shadow-card">
                <RowIcon className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="flex-1 text-sm font-medium text-slate-700">{label}</span>
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Floating chips. Outer element enters; inner element drifts — kept on
          separate elements so the two transforms never overwrite each other. */}
      <div className="lp-enter-scale absolute left-0 top-0 sm:-left-2" style={delayStyle(520)}>
        <div className="lp-hover flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-lift ring-1 ring-slate-100 backdrop-blur">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <CalendarCheck className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="pr-1">
            <p className="text-sm font-semibold leading-tight text-navy-950">Med Sync</p>
            <p className="text-xs text-slate-500">One monthly pickup</p>
          </div>
        </div>
      </div>

      <div className="lp-enter-scale absolute bottom-0 right-0 sm:-right-2" style={delayStyle(640)}>
        <div className="lp-hover-b flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-lift ring-1 ring-slate-100 backdrop-blur">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-liberty-red">
            <FlaskConical className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="pr-1">
            <p className="text-sm font-semibold leading-tight text-navy-950">Compounding</p>
            <p className="text-xs text-slate-500">Made to your prescription</p>
          </div>
        </div>
      </div>
    </div>
  );
}
