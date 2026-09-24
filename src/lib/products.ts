/**
 * Product & service catalog — public marketing content.
 *
 * SCOPE / COMPLIANCE NOTES:
 *  - This catalog is static, public, non-PHI content. It is deliberately NOT
 *    in the database and NOT patient-specific, so the products pages need no
 *    session, log nothing, and fall outside the PHI surface entirely.
 *  - Nothing here is a prescription-only medication, and there is no cart or
 *    checkout. Rx items are dispensed only against a valid prescription, so
 *    every call to action routes to a pharmacist (phone/contact), never to a
 *    purchase flow. Keep it that way unless a licensed e-commerce path with
 *    its own review is built.
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
  /** Icon shown on the home page category rail. "all" needs none. */
  icon?: IconName;
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
   * Product photograph. Optional: until the client supplies real photography,
   * cards fall back to a tinted tile showing `icon`. Put files under `public/`
   * and reference them as "/products/<file>.jpg" — the CSP allows img-src
   * 'self' only, so images must be served from this app, not a CDN.
   */
  image?: string;
  /** Alt text for `image`. Required whenever `image` is set. */
  imageAlt?: string;
};

export const productCategories: ProductCategory[] = [
  {
    id: "all",
    label: "All Products",
    blurb: "Everything we stock and compound, in one place.",
  },
  {
    id: "wellness",
    label: "Vitamins & Wellness",
    blurb: "Daily supplements and wellness essentials, pharmacist-vetted for quality.",
    icon: "leaf",
  },
  {
    id: "compounding",
    label: "Compounding",
    blurb: "Custom-made medications when an off-the-shelf product doesn't fit.",
    icon: "flask",
  },
  {
    id: "home-health",
    label: "Home Health",
    blurb: "Mobility aids, monitors, and recovery supplies for care at home.",
    icon: "house-plus",
  },
  {
    id: "diabetes",
    label: "Diabetes Care",
    blurb: "Testing supplies, footcare, and everyday support for living with diabetes.",
    icon: "droplet",
  },
  {
    id: "otc",
    label: "Over-the-Counter",
    blurb: "Trusted OTC remedies with a pharmacist on hand to help you choose.",
    icon: "pill",
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
  },

  // --- Compounding ----------------------------------------------------------
  {
    id: "compounded-topicals",
    name: "Compounded Topical Creams",
    categoryId: "compounding",
    icon: "flask",
    summary: "Custom-strength creams and gels made to your prescription.",
    description:
      "When a medication works better applied to the site than swallowed, we can compound it into a cream, gel, or ointment at the exact strength your prescriber specifies. This is a prescription service — bring us the script and we'll handle the rest.",
    details: [
      "Prepared to your prescriber's exact strength and base",
      "Useful when oral dosing causes side effects",
      "Typical turnaround: 1–2 business days",
      "Requires a valid prescription",
    ],
    availability: "Made to order — prescription required",
    badge: "Prescription",
  },
  {
    id: "compounded-pediatric",
    name: "Pediatric Flavoring & Dosing",
    categoryId: "compounding",
    icon: "baby",
    summary: "Liquid suspensions and kid-friendly flavors.",
    description:
      "Children rarely take medicine that tastes unpleasant, and many medications simply aren't made in a child's dose. We convert tablets into accurately dosed liquid suspensions and flavor them to something your child will actually finish.",
    details: [
      "Tablets converted to accurate liquid suspensions",
      "Range of flavors — bubblegum, grape, cherry, and more",
      "Dye-free and preservative-free options",
      "Requires a valid prescription",
    ],
    availability: "Made to order — prescription required",
    badge: "Prescription",
  },
  {
    id: "compounded-allergen-free",
    name: "Allergen-Free Formulations",
    categoryId: "compounding",
    icon: "wheat-off",
    summary: "Medications remade without the filler that affects you.",
    description:
      "Commercial medications often contain lactose, gluten, dyes, or preservatives that some patients react to. We can prepare the same active ingredient without the excipient causing the problem, so you don't have to choose between your treatment and your tolerance.",
    details: [
      "Lactose-free, gluten-free, and dye-free preparations",
      "Preservative-free options for sensitive patients",
      "We coordinate directly with your prescriber",
      "Requires a valid prescription",
    ],
    availability: "Made to order — prescription required",
    badge: "Prescription",
  },

  // --- Home Health ----------------------------------------------------------
  {
    id: "bp-monitors",
    name: "Blood Pressure Monitors",
    categoryId: "home-health",
    icon: "heart-pulse",
    summary: "Validated home monitors, fitted and demonstrated in store.",
    description:
      "A home monitor is only useful if the cuff fits and you know how to use it. We stock validated upper-arm monitors, measure your arm for the right cuff size, and walk you through taking a reading before you leave.",
    details: [
      "Clinically validated upper-arm models",
      "Free cuff sizing and in-store demonstration",
      "Large-display models for easier reading",
      "Many plans cover these — we can check for you",
    ],
    availability: "In stock — demo available",
    badge: "Fitted in store",
  },
  {
    id: "mobility-aids",
    name: "Mobility & Daily Living Aids",
    categoryId: "home-health",
    icon: "accessibility",
    summary: "Canes, walkers, grab bars, and reachers.",
    description:
      "Staying independent at home often comes down to a few well-chosen pieces of equipment. We carry canes, rollators, walkers, bath safety rails, and daily-living aids, and we'll adjust the height properly rather than sending you home to guess.",
    details: [
      "Canes, walkers, rollators, and crutches",
      "Bath safety: grab bars, shower seats, non-slip mats",
      "Reachers, sock aids, and dressing tools",
      "Height adjustment and fitting at no charge",
    ],
    availability: "In stock — larger items may be ordered in",
  },
  {
    id: "wound-care",
    name: "Wound & Recovery Supplies",
    categoryId: "home-health",
    icon: "bandage",
    summary: "Dressings, braces, and post-surgical supplies.",
    description:
      "From a scraped knee to post-surgical recovery, we stock the dressings, compression, and support products that keep healing on track — and our pharmacists can advise on what suits the wound you're actually dealing with.",
    details: [
      "Advanced dressings, gauze, and medical tapes",
      "Compression stockings in multiple grades",
      "Braces and supports for knee, wrist, ankle, and back",
      "Post-surgical and ostomy supplies available to order",
    ],
    availability: "In stock — specialty items ordered on request",
  },

  // --- Diabetes Care --------------------------------------------------------
  {
    id: "glucose-monitoring",
    name: "Glucose Meters & Test Strips",
    categoryId: "diabetes",
    icon: "droplet",
    summary: "Meters, strips, and lancets — with insurance checked for you.",
    description:
      "Test strips are one of the most common places patients overpay. We stock the major meter systems, and before you buy we'll check which brand your plan actually covers so you're not paying cash for the wrong one.",
    details: [
      "Major meter brands and matching test strips",
      "Lancets, lancing devices, and control solution",
      "We check your plan's preferred brand before you buy",
      "Continuous glucose monitor supplies available to order",
    ],
    availability: "In stock — insurance check available",
    badge: "We check coverage",
  },
  {
    id: "diabetic-footcare",
    name: "Diabetic Footcare",
    categoryId: "diabetes",
    icon: "footprints",
    summary: "Non-binding socks, creams, and inspection mirrors.",
    description:
      "Foot complications are among the most preventable problems in diabetes care, and small daily habits do most of the work. We stock non-binding socks that don't restrict circulation, urea-based moisturizers, and the mirrors that make a daily foot check practical.",
    details: [
      "Non-binding, seamless diabetic socks",
      "Urea and lanolin-based foot creams",
      "Long-handled inspection mirrors",
      "Ask us about a daily foot-check routine",
    ],
    availability: "In stock — ask at the counter",
  },

  // --- Over-the-Counter -----------------------------------------------------
  {
    id: "cold-flu",
    name: "Cold, Flu & Allergy",
    categoryId: "otc",
    icon: "thermometer",
    summary: "Relief that won't clash with your prescriptions.",
    description:
      "Many cold and allergy remedies interact with blood pressure medications, antidepressants, and blood thinners. Ask before you pick — our pharmacists will point you to something effective that's safe alongside what you already take.",
    details: [
      "Decongestants, antihistamines, and cough preparations",
      "Non-drowsy and night-time formulations",
      "Children's dosing guidance available",
      "Free interaction check against your medication list",
    ],
    availability: "In stock — ask a pharmacist first",
    badge: "Ask us first",
  },
  {
    id: "pain-relief",
    name: "Pain & Fever Relief",
    categoryId: "otc",
    icon: "pill",
    summary: "Acetaminophen, ibuprofen, and topical options.",
    description:
      "The right choice depends on what else you take and what you're treating. Acetaminophen and anti-inflammatories are not interchangeable — particularly if you're on a blood thinner or have kidney concerns — so it's worth a thirty-second conversation.",
    details: [
      "Acetaminophen, ibuprofen, naproxen, and aspirin",
      "Topical gels and patches for localized pain",
      "Children's liquid formulations with dosing charts",
      "Pharmacist guidance on what's safe for you",
    ],
    availability: "In stock — ask at the counter",
  },
  {
    id: "first-aid",
    name: "First Aid Essentials",
    categoryId: "otc",
    icon: "briefcase-medical",
    summary: "Everything for a properly stocked home kit.",
    description:
      "Most home first aid kits are missing something important until the moment it's needed. We can help you put together a complete kit for home, car, or travel — or restock the one you already have.",
    details: [
      "Bandages, antiseptics, and antibiotic ointments",
      "Thermometers, tweezers, and instant cold packs",
      "Pre-assembled home, car, and travel kits",
      "Restocking guidance for expired contents",
    ],
    availability: "In stock — ask at the counter",
  },
];

/** Products for a category id; "all" returns the full catalog. */
export function productsByCategory(categoryId: string): Product[] {
  return categoryId === "all" ? products : products.filter((p) => p.categoryId === categoryId);
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
