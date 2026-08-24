import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getSiteSettings } from "@/lib/site";

// Site content (nav footer, contact info, etc.) is admin-editable and read
// from the database on every request — the whole app must render
// dynamically so those edits show up immediately instead of only after a
// rebuild. This app already requires a persistent Node server for its
// SQLite file, so there's no static/edge deployment benefit being traded away.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  return {
    title: {
      default: `${site.name} — Independent Pharmacy in Austin, TX`,
      template: `%s | ${site.name}`,
    },
    description:
      "Liberty Pharmacy is your local independent pharmacy in Austin, Texas. Prescriptions, compounding, medical supplies, and personalized care.",
    metadataBase: new URL("https://libertypharmacyatx.com"),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteSettings();
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Header siteName={site.name} />
        <main className="flex-1">{children}</main>
        <Footer settings={site} />
      </body>
    </html>
  );
}
