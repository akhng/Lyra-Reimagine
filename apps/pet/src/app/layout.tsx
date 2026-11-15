import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const baloo = Baloo_2({ subsets: ["latin"], variable: "--font-baloo", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Lyra Pet", template: "%s · Lyra Pet" },
  description: "Pet care and grooming, together: bookings, pet profiles, rewards and an on-demand grooming marketplace.",
  applicationName: "Lyra Pet",
};

export const viewport: Viewport = { themeColor: "#fff8f0", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading headers opts pages into dynamic rendering so Next.js can attach the CSP nonce to its scripts.
  await headers();
  return (
    <html lang="en-AU" className={`${nunito.variable} ${baloo.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
