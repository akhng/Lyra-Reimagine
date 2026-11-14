import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Lyra Pet", template: "%s · Lyra Pet" },
  description: "Pet grooming business management. Spend less time managing your business and more time caring for pets.",
  applicationName: "Lyra Pet",
};

export const viewport: Viewport = { themeColor: "#0f2a44", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading headers opts pages into dynamic rendering so Next.js can attach the CSP nonce to its scripts.
  await headers();
  return (
    <html lang="en-AU" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
