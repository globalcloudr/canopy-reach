import type { Metadata } from "next";
import { Maven_Pro } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";

const mavenPro = Maven_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-maven",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Canopy Reach",
  description: "Social media scheduling and publishing for the Canopy platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mavenPro.variable}>
      <body className="product-reach"><Suspense>{children}</Suspense></body>
    </html>
  );
}
