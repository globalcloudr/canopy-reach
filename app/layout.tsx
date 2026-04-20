import type { Metadata } from "next";
import { canopyFontVariables } from "@globalcloudr/canopy-ui";
import { Suspense } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Canopy Reach",
  description: "Social media scheduling and publishing for the Canopy platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={canopyFontVariables}>
      <body className="product-reach"><Suspense>{children}</Suspense></body>
    </html>
  );
}
