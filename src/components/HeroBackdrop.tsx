import type { CSSProperties } from "react";
import {
  Atom,
  Cross,
  Dna,
  FlaskConical,
  HeartPulse,
  Leaf,
  Pill,
  PillBottle,
  Stethoscope,
  Tablets,
  type LucideIcon,
} from "lucide-react";

/**
 * Animated pharmacy backdrop for the home hero.
 *
 * Purely decorative (aria-hidden, no pointer events) and pure CSS — it plays
 * without JavaScript, and under prefers-reduced-motion everything stays put
 * as a still illustration (see globals.css).
 *
 * Legibility comes first: icons are faint line art, the busiest pieces sit
 * away from the copy, and a scrim darkens the text side so the headline
 * never competes with what is moving behind it.
 */

type Floater = {
  Icon: LucideIcon;
  /** Position as % of the hero. */
  x: number;
  y: number;
  size: number;
  /** "far" icons are smaller and fainter, so the layer reads as depth. */
  depth: "far" | "mid";
  /** Tilt at the top of the float, in degrees. */
  tilt: number;
  /** Float cycle length, seconds. */
  dur: number;
  /** Position below lg, where the layout is one column and the copy spans
   * the width: icons sit only in the top band and behind the frosted stat
   * cards. Omit to hide the icon below lg. */
  mx?: number;
  my?: number;
  /** Only from xl up: sits in the side gutter, which narrower screens lack. */
  gutter?: boolean;
};

const floaters: Floater[] = [
  { Icon: Pill, x: 57, y: 10, size: 44, depth: "mid", tilt: 16, dur: 11, mx: 6, my: 2 },
  { Icon: Tablets, x: 87, y: 13, size: 38, depth: "mid", tilt: -10, dur: 13, mx: 82, my: 2.5 },
  { Icon: Dna, x: 93, y: 55, size: 48, depth: "mid", tilt: 12, dur: 15, mx: 84, my: 62 },
  { Icon: Stethoscope, x: 75, y: 84, size: 40, depth: "mid", tilt: -8, dur: 12, mx: 6, my: 76 },
  { Icon: PillBottle, x: 3, y: 16, size: 32, depth: "far", tilt: 10, dur: 14, gutter: true },
  { Icon: FlaskConical, x: 5, y: 74, size: 30, depth: "far", tilt: -12, dur: 12, gutter: true },
  { Icon: Cross, x: 46, y: 6, size: 24, depth: "far", tilt: 45, dur: 16 },
  { Icon: HeartPulse, x: 61, y: 78, size: 32, depth: "far", tilt: -6, dur: 10, mx: 10, my: 89 },
  { Icon: Atom, x: 70, y: 32, size: 28, depth: "far", tilt: 30, dur: 17 },
  { Icon: Leaf, x: 36, y: 90, size: 26, depth: "far", tilt: 14, dur: 13 },
  { Icon: Pill, x: 82, y: 70, size: 26, depth: "far", tilt: -20, dur: 11, mx: 78, my: 88 },
  { Icon: Cross, x: 97, y: 34, size: 20, depth: "far", tilt: 45, dur: 14 },
  { Icon: Tablets, x: 21, y: 5, size: 24, depth: "far", tilt: 8, dur: 15 },
];

/**
 * Tiny dots and crosses that rise from the bottom and fade, like bubbles.
 * `x` is the desktop position — kept to the right half so nothing drifts
 * through the copy; `mx` spreads them out on narrower screens.
 */
const particles = [
  { x: 54, mx: 12, delay: 0, dur: 9, kind: "dot" },
  { x: 60, mx: 28, delay: 3.5, dur: 11, kind: "plus" },
  { x: 66, mx: 44, delay: 6, dur: 10, kind: "dot" },
  { x: 73, mx: 58, delay: 1.5, dur: 12, kind: "dot" },
  { x: 80, mx: 67, delay: 5, dur: 9.5, kind: "plus" },
  { x: 87, mx: 79, delay: 2.5, dur: 11, kind: "dot" },
  { x: 94, mx: 90, delay: 7, dur: 10, kind: "plus" },
] as const;

const vars = (v: Record<string, string>) => v as CSSProperties;

/** Two-tone capsule with a soft highlight — the out-of-focus foreground. */
function Capsule({ id, gold = true }: { id: string; gold?: boolean }) {
  return (
    <svg viewBox="0 0 120 48" className="h-full w-full">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={gold ? "#e8c677" : "#8fb2e6"} />
          <stop offset="1" stopColor={gold ? "#b98a2c" : "#3d6bb3"} />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c9d4e6" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <rect width="120" height="48" rx="24" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect width="60" height="48" fill={`url(#${id}-a)`} />
        <rect x="60" width="60" height="48" fill={`url(#${id}-b)`} />
        <rect x="10" y="8" width="96" height="9" rx="4.5" fill="#ffffff" opacity="0.45" />
      </g>
    </svg>
  );
}

/** Heartbeat trace: flat line with two beats. Stretches to the hero width. */
const ECG =
  "M0 60 H330 l14 -6 l10 6 h14 l10 -42 l14 80 l12 -50 l8 12 h22 H780 l14 -6 l10 6 h14 l10 -42 l14 80 l12 -50 l8 12 h22 H1200";

export default function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="lp-art-bg pointer-events-none absolute inset-0 overflow-hidden">
      {/* Texture and light */}
      <div className="bg-dot-grid absolute inset-0" />
      <div className="lp-orb absolute -right-40 -top-48 h-[34rem] w-[34rem] rounded-full bg-sky-400/10 blur-3xl" />
      <div className="lp-orb-b absolute -bottom-56 -left-32 h-[30rem] w-[30rem] rounded-full bg-liberty-gold/10 blur-3xl" />

      {/* Heartbeat line, with a gold pulse travelling along it */}
      <svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-[3%] h-20 w-full sm:bottom-[2%]"
      >
        <path d={ECG} fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <path
          d={ECG}
          pathLength={1200}
          fill="none"
          stroke="#d4a848"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className="lp-ecg"
        />
      </svg>

      {/* Floating pharmacy icons */}
      {floaters.map(({ Icon, x, y, size, depth, tilt, dur, mx, my, gutter }, i) => (
        <div
          key={i}
          className={`lp-float absolute left-[var(--lp-mx)] top-[var(--lp-my)] lg:left-[var(--lp-x)] lg:top-[var(--lp-y)] ${
            gutter ? "hidden xl:block" : mx === undefined ? "hidden lg:block" : ""
          }`}
          style={vars({
            "--lp-x": `${x}%`,
            "--lp-y": `${y}%`,
            "--lp-mx": `${mx ?? x}%`,
            "--lp-my": `${my ?? y}%`,
            "--lp-delay": `${250 + i * 70}ms`,
            "--lp-tilt": `${tilt}deg`,
            "--lp-dur": `${dur}s`,
            // Start each float mid-cycle so they never move in step.
            "--lp-offset": `${-((i * 1.7) % dur)}s`,
          })}
        >
          <Icon
            width={size}
            height={size}
            strokeWidth={depth === "far" ? 1.25 : 1.5}
            className={depth === "far" ? "text-white/[0.12]" : "text-white/20"}
          />
        </div>
      ))}

      {/* Out-of-focus foreground capsules */}
      <div
        className="lp-float absolute -right-6 top-[30%] hidden h-12 w-36 blur-[2px] lg:block"
        style={vars({ "--lp-delay": "500ms", "--lp-tilt": "-6deg", "--lp-dur": "14s", "--lp-offset": "-3s", rotate: "-32deg" })}
      >
        <div className="h-full w-full opacity-30">
          <Capsule id="hero-cap-a" />
        </div>
      </div>
      <div
        className="lp-float absolute left-[42%] top-[88%] hidden h-10 w-28 blur-[3px] lg:block"
        style={vars({ "--lp-delay": "700ms", "--lp-tilt": "8deg", "--lp-dur": "16s", "--lp-offset": "-7s", rotate: "22deg" })}
      >
        <div className="h-full w-full opacity-25">
          <Capsule id="hero-cap-b" gold={false} />
        </div>
      </div>

      {/* Rising particles. Each rises the full height of its lane; below lg
          the lanes are only as tall as the stat-card band, so particles
          never pass through the copy. */}
      <div className="absolute inset-x-0 bottom-0 h-[34%] lg:h-full">
        {particles.map((p, i) => (
          <span
            key={i}
            className="lp-rise absolute bottom-0 flex h-full items-end left-[var(--lp-mx)] lg:left-[var(--lp-x)]"
            style={vars({ "--lp-x": `${p.x}%`, "--lp-mx": `${p.mx}%`, "--lp-dur": `${p.dur}s`, "--lp-offset": `${-p.delay}s` })}
          >
            {p.kind === "dot" ? (
              <span className="block h-1.5 w-1.5 rounded-full bg-white/40" />
            ) : (
              <Cross width={12} height={12} strokeWidth={2.5} className="text-liberty-gold/60" />
            )}
          </span>
        ))}
      </div>

      {/* Scrim: keeps the copy side calm and high-contrast. */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy-950/40 via-transparent to-transparent lg:bg-gradient-to-r lg:from-navy-950/70 lg:via-navy-950/25" />
    </div>
  );
}
