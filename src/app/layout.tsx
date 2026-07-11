import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const fraunces = localFont({
  src: [
    {
      path: "./fonts/fraunces-latin-300-normal.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/fraunces-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/fraunces-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/fraunces-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/fraunces-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-fraunces",
  display: "swap",
});

const commissioner = localFont({
  src: [
    {
      path: "./fonts/commissioner-latin-300-normal.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/commissioner-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/commissioner-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/commissioner-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-commissioner",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Presentation Buddy",
  description: "AI-assisted outline review and HTML presentation generation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Browser extensions can add attributes to the document root before React
    // hydrates it. Limit the escape hatch to these two static shell elements so
    // hydration mismatches inside the application are still reported.
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
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
