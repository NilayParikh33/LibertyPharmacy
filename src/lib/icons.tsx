import {
  Accessibility,
  BadgePercent,
  Baby,
  Bandage,
  BriefcaseMedical,
  Building2,
  CalendarCheck,
  Droplet,
  FlaskConical,
  Footprints,
  HeartPulse,
  HousePlus,
  Leaf,
  Microscope,
  Pill,
  Sun,
  Tablets,
  Tag,
  Thermometer,
  Timer,
  Truck,
  WheatOff,
  type LucideIcon,
} from "lucide-react";

/**
 * Named icon set for catalog and marketing content.
 *
 * Data files (src/lib/products.ts etc.) refer to icons by these names rather
 * than importing components, so the data stays plain and serialisable. Icons
 * are line glyphs bundled with the app — consistent on every OS, unlike emoji,
 * and served from our own origin so the CSP is unaffected.
 */
export const iconMap = {
  accessibility: Accessibility,
  "badge-percent": BadgePercent,
  baby: Baby,
  bandage: Bandage,
  "briefcase-medical": BriefcaseMedical,
  building: Building2,
  "calendar-check": CalendarCheck,
  droplet: Droplet,
  flask: FlaskConical,
  footprints: Footprints,
  "heart-pulse": HeartPulse,
  "house-plus": HousePlus,
  leaf: Leaf,
  microscope: Microscope,
  pill: Pill,
  sun: Sun,
  tablets: Tablets,
  tag: Tag,
  thermometer: Thermometer,
  timer: Timer,
  truck: Truck,
  "wheat-off": WheatOff,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof iconMap;

/** Renders a named icon. Decorative by default — give it a label if not. */
export function Icon({
  name,
  className = "h-6 w-6",
  strokeWidth = 1.75,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  const Component = iconMap[name];
  return <Component aria-hidden="true" className={className} strokeWidth={strokeWidth} />;
}
