/** Site navigation structure — static, no server dependencies (safe for client components). */
export const nav = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Providers", href: "/providers" },
  { label: "Blog", href: "/blog" },
  { label: "Locations", href: "/locations" },
  { label: "Contact", href: "/contact" },
] as const;
