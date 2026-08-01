/**
 * Blog content — static for now. Swap this module for a CMS or MDX
 * pipeline later without touching the page components.
 */
export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readMinutes: number;
  sections: Array<{ heading: string; body: string }>;
};

export const posts: Post[] = [
  {
    slug: "embracing-wellness",
    title: "Embracing Wellness: Your Guide to a Healthier Lifestyle",
    excerpt:
      "Your health and well-being are our top priorities. Explore key insights and everyday habits to unlock a healthier you.",
    author: "Liberty Pharmacy Team",
    date: "2026-07-15",
    readMinutes: 3,
    sections: [
      {
        heading: "The Liberty Commitment",
        body: "At Liberty Pharmacy, we go beyond being just a pharmacy — we are your partners in wellness. Our commitment extends to personalized care and support from our experienced team of pharmacists, guiding you on your unique path to better health.",
      },
      {
        heading: "Convenience Without Compromise",
        body: "Managing your health should be effortless. Refills ready in minutes, free local delivery, and medication synchronization mean fewer trips and fewer missed doses — with our online patient portal on the way to make it even easier.",
      },
      {
        heading: "Wellness Essentials In Store",
        body: "From vitamins and supplements to first aid and everyday self-care products, our shelves are curated to support your whole-health journey — and our pharmacists can help you choose what actually works.",
      },
      {
        heading: "Your Questions, Answered",
        body: "Have a question about a medication or an interaction? Our team offers private one-on-one consultations. No hold music, no rushed answers — just real guidance from pharmacists who know you.",
      },
    ],
  },
  {
    slug: "vaccination-season-checklist",
    title: "Your Vaccination Season Checklist",
    excerpt:
      "Flu season is around the corner. Here's a simple checklist to make sure you and your family are protected this year.",
    author: "Liberty Pharmacy Team",
    date: "2026-06-20",
    readMinutes: 2,
    sections: [
      {
        heading: "Why Timing Matters",
        body: "Immunity takes about two weeks to build after a vaccine. Getting protected before peak season means you're covered when it counts most.",
      },
      {
        heading: "What We Offer",
        body: "Liberty Pharmacy administers flu, COVID-19, shingles, pneumonia, and other routine immunizations. Walk-ins are welcome, and most insurance plans cover vaccines at no cost to you.",
      },
      {
        heading: "Bring the Whole Family",
        body: "Ask our pharmacists which vaccines are right for each member of your household — we'll help you build a simple schedule so nobody misses a dose.",
      },
    ],
  },
];

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}
