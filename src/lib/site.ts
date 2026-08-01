/**
 * Single source of truth for Liberty Pharmacy site content/config.
 * Update details here — every page reads from this file.
 */
export const site = {
  name: "Liberty Pharmacy",
  tagline: "Your local independent pharmacy in Austin, Texas",
  address: {
    line1: "8650 Spicewood Springs Rd #106",
    city: "Austin",
    state: "TX",
    zip: "78759",
    county: "Travis",
  },
  phone: "(512) 249-7500",
  phoneHref: "tel:+15122497500",
  fax: "(512) 249-7501",
  // Public contact inbox only — NEVER publish or use an inbox that receives PHI
  // unless it is hosted under a HIPAA Business Associate Agreement.
  email: "info@libertypharmacyatx.com",
  hours: [
    { days: "Mon – Fri", hours: "9:00 AM – 7:00 PM" },
    { days: "Saturday", hours: "10:00 AM – 3:00 PM" },
    { days: "Sunday", hours: "Closed" },
  ],
  mapsUrl:
    "https://www.google.com/maps?q=8650+Spicewood+Springs+Rd+%23106+Austin+TX+78759",
} as const;

export const nav = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Providers", href: "/providers" },
  { label: "Blog", href: "/blog" },
  { label: "Locations", href: "/locations" },
  { label: "Contact", href: "/contact" },
] as const;
