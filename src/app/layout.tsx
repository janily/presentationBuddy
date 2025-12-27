import type { Metadata } from "next";
import { Fraunces, Commissioner } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const commissioner = Commissioner({
  variable: "--font-commissioner",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Interior Design Studio",
  description: "AI-powered interior design transformation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${commissioner.variable} antialiased`}
        style={{
          fontFamily: "var(--font-commissioner), system-ui, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
