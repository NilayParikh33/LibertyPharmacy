/**
 * Product & service catalog — public marketing content.
 *
 * SCOPE / COMPLIANCE NOTES:
 *  - This catalog is static, public, non-PHI content. It is deliberately NOT
 *    in the database and NOT patient-specific, so the products pages need no
 *    session, log nothing, and fall outside the PHI surface entirely.
 *  - There is no cart or checkout. Peptide therapies are prescription-only
 *    and dispensed only against a valid prescription, so every call to action
 *    routes to a pharmacist (phone/contact), never to a purchase flow. Keep it
 *    that way unless a licensed e-commerce path with its own review is built.
 *  - PEPTIDES — PHARMACIST-IN-CHARGE MUST CONFIRM EACH ENTRY BEFORE LAUNCH.
 *    Which peptides a 503A pharmacy may compound changes with FDA bulk-
 *    substance decisions and Texas State Board of Pharmacy rules. The copy is
 *    deliberately claim-free: it describes what is dispensed and how, never
 *    what it treats or does. Do not add efficacy, anti-aging, weight-loss or
 *    performance claims, and remove any entry the pharmacy cannot lawfully
 *    compound today.
 *  - The "saved list" (src/lib/saved-list.tsx) is the shopping-list stand-in:
 *    it lives only in the visitor's own browser and is never sent to us, so
 *    it adds no PHI surface. It ends in "call to reserve", not a checkout.
 *  - `details` bullets are informational, not medical advice. Copy changes
 *    should be reviewed by the pharmacist-in-charge.
 */

import type { IconName } from "./icons";

export type ProductCategory = {
  id: string;
  label: string;
  /** Short line shown when the category is the active filter. */
  blurb: string;
  /** Icon for the category's section heading and home page tile. */
  icon: IconName;
  /** Image for the home page category tile. Served from public/. */
  image: string;
  /** One-line note shown under the section heading, e.g. an Rx notice. */
  note?: string;
};

export type Product = {
  id: string;
  name: string;
  categoryId: string;
  icon: IconName;
  /** One-line summary shown on the card. */
  summary: string;
  /** Full description shown in the detail panel on click. */
  description: string;
  /** Bullet highlights shown in the detail panel. */
  details: string[];
  /** Optional corner badge, e.g. "Most requested". */
  badge?: string;
  /** Availability line shown in the detail panel. */
  availability: string;
  /**
   * Product image. Optional: without one, cards fall back to a tinted tile
   * showing `icon`. Files live under `public/products/` — the CSP allows
   * img-src 'self' only, so images must be served from this app, not a CDN.
   * Current images are studio renders; swapping in a photograph is just a
   * change to this path.
   */
  image?: string;
  /** Alt text for `image`. Required whenever `image` is set. */
  imageAlt?: string;
};

export const productCategories: ProductCategory[] = [
  {
    id: "wellness",
    label: "Vitamins & Wellness",
    blurb: "Daily supplements and wellness essentials, pharmacist-vetted for quality.",
    icon: "leaf",
    image: "/products/category-wellness.webp",
  },
  {
    id: "peptides",
    label: "Peptides",
    blurb: "Prescription peptide therapies, compounded to your prescriber's exact order.",
    icon: "dna",
    image: "/products/category-peptides.webp",
    note:
      "Prescription required. Peptide therapies are compounded to order and dispensed only against a valid prescription, in line with current FDA and Texas State Board of Pharmacy rules. Availability varies — ask our pharmacists.",
  },
];

export const products: Product[] = [
  // --- Vitamins & Wellness --------------------------------------------------
  {
    id: "daily-multivitamin",
    name: "Daily Multivitamins",
    categoryId: "wellness",
    icon: "tablets",
    summary: "Age- and gender-specific formulas from brands we trust.",
    description:
      "A well-chosen multivitamin fills the small gaps an ordinary diet leaves behind. We stock formulas tailored by age and life stage — including prenatal, 50-plus, and men's and women's blends — and we stick to brands that publish third-party purity testing.",
    details: [
      "Prenatal, 50+, men's, women's, and children's formulas",
      "Third-party tested brands only",
      "Pharmacist review for interactions with your prescriptions",
      "Gluten-free and vegetarian options available",
    ],
    availability: "In stock — ask at the counter",
    badge: "Most requested",
    image: "/products/daily-multivitamin.webp",
    imageAlt: "Liberty Pharmacy daily multivitamin bottle with tablets",
  },
  {
    id: "vitamin-d",
    name: "Vitamin D & Calcium",
    categoryId: "wellness",
    icon: "sun",
    summary: "Bone-health support in tablets, softgels, and chewables.",
    description:
      "Vitamin D helps your body absorb calcium, and many adults run low on it — especially if you spend most of your day indoors. We carry a range of strengths so your pharmacist can match the dose your provider recommended rather than whatever the shelf happens to have.",
    details: [
      "Multiple strengths (1,000–5,000 IU) so you can match your provider's advice",
      "D3 softgels, chewables, and liquid drops",
      "Calcium citrate and carbonate options",
      "We can check your dose against your current medications",
    ],
    availability: "In stock — ask at the counter",
    image: "/products/vitamin-d.webp",
    imageAlt: "Liberty Pharmacy vitamin D3 and calcium bottle with softgels",
  },
  {
    id: "probiotics",
    name: "Probiotics & Digestive Health",
    categoryId: "wellness",
    icon: "microscope",
    summary: "Refrigerated, live-culture probiotics stored properly.",
    description:
      "Probiotics only work if the cultures are still alive when you take them. We keep our refrigerated lines in a monitored cooler and rotate stock by expiry, so what you take home is what the label promises.",
    details: [
      "Refrigerated and shelf-stable options",
      "Single-strain and multi-strain formulas",
      "Commonly paired with antibiotic courses — ask us about timing",
      "Stock rotated by expiry date",
    ],
    availability: "In stock — refrigerated section",
    image: "/products/probiotics.webp",
    imageAlt: "Liberty Pharmacy probiotic jar with capsules",
  },

  // --- Peptides -------------------------------------------------------------
  // Claim-free by design — see the PEPTIDES note at the top of this file.
  {
    id: "sermorelin",
    name: "Sermorelin",
    categoryId: "peptides",
    icon: "syringe",
    summary: "Compounded to your physician's prescription, with supplies and guidance.",
    description:
      "Sermorelin is a peptide your physician may prescribe as part of a supervised treatment plan. We compound it to the strength and schedule on your prescription, dispense it with the supplies you need, and walk you through storage and administration before you leave.",
    details: [
      "Prescription required — prepared to your prescriber's exact order",
      "Dispensed with supplies and step-by-step administration guidance",
      "Refrigerated storage, handled cold from compounding to pickup",
      "We coordinate refills and dose changes directly with your prescriber",
    ],
    availability: "Made to order — prescription required",
    badge: "Prescription",
    image: "/products/sermorelin.webp",
    imageAlt: "Liberty Pharmacy sermorelin vial with a pharmacy label",
  },
  {
    id: "glutathione",
    name: "Glutathione",
    categoryId: "peptides",
    icon: "droplets",
    summary: "Compounded in the form and strength your prescriber specifies.",
    description:
      "Glutathione is a naturally occurring tripeptide. When your prescriber orders a compounded preparation, we prepare it in the form and strength they specify and dispense it with clear instructions for storage and use.",
    details: [
      "Prescription required — prepared to your prescriber's exact order",
      "Form and strength set by your prescriber",
      "Handled and stored to protect stability",
      "Pharmacist review against your other medications",
    ],
    availability: "Made to order — prescription required",
    badge: "Prescription",
    image: "/products/glutathione.webp",
    imageAlt: "Liberty Pharmacy glutathione vial with a pharmacy label",
  },
  {
    id: "oxytocin",
    name: "Oxytocin",
    categoryId: "peptides",
    icon: "flask",
    summary: "Compounded nasal spray or troche, prepared to your prescription.",
    description:
      "Oxytocin is a peptide hormone your prescriber may order in a compounded form, such as a nasal spray or dissolving troche. We prepare it to the exact strength and dosage form on your prescription and explain how to store and use it.",
    details: [
      "Prescription required — prepared to your prescriber's exact order",
      "Nasal spray and troche forms, as prescribed",
      "Clear labelling with storage and use instructions",
      "We work directly with your prescriber on any changes",
    ],
    availability: "Made to order — prescription required",
    badge: "Prescription",
    image: "/products/oxytocin.webp",
    imageAlt: "Liberty Pharmacy oxytocin nasal spray bottle with a pharmacy label",
  },
  {
    id: "peptide-consult",
    name: "Peptide Prescriptions",
    categoryId: "peptides",
    icon: "dna",
    summary: "Have a peptide prescription? Ask us what we can compound for you.",
    description:
      "If your prescriber has written a peptide prescription that isn't listed here, call us. Our pharmacists will tell you whether we can lawfully compound it, what form it would take, and how long it will take to prepare — and we'll coordinate directly with your prescriber.",
    details: [
      "Prescriber-to-pharmacy coordination handled for you",
      "Straight answers on what can and can't be compounded",
      "Typical preparation times confirmed up front",
      "Pharmacist review against your other medications",
    ],
    availability: "Made to order — prescription required",
    image: "/products/peptide-consult.webp",
    imageAlt: "Liberty Pharmacy prescription vials on a pharmacy counter",
  },
];

/** Products in one category, in catalog order. */
export function productsByCategory(categoryId: string): Product[] {
  return products.filter((p) => p.categoryId === categoryId);
}

/** Human-readable category label for a product, used in the detail panel. */
export function categoryLabel(categoryId: string): string {
  return productCategories.find((c) => c.id === categoryId)?.label ?? "Products";
}

/** A single product by id, or undefined for an unknown/retired id. */
export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

/** Other products in the same category, for "you may also need". */
export function relatedProducts(product: Product, limit = 3): Product[] {
  return products.filter((p) => p.categoryId === product.categoryId && p.id !== product.id).slice(0, limit);
}

/**
 * Case-insensitive search across the text a customer would recognise: name,
 * summary, description, detail bullets and category. Every word in the query
 * must match somewhere, so "vitamin d" narrows rather than widens.
 */
export function searchProducts(list: Product[], query: string): Product[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return list;
  return list.filter((p) => {
    const haystack = [p.name, p.summary, p.description, categoryLabel(p.categoryId), ...p.details]
      .join(" ")
      .toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}
