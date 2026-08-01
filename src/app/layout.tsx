import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    default: `${site.name} — Independent Pharmacy in Austin, TX`,
    template: `%s | ${site.name}`,
  },
  description:
    "Liberty Pharmacy is your local independent pharmacy in Austin, Texas. Prescriptions, compounding, vaccinations, medical supplies, and personalized care.",
  metadataBase: new URL("https://libertypharmacyatx.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
