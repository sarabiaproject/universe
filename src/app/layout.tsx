import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

import "@xyflow/react/dist/base.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Production URL: absolute URLs for Open Graph and Twitter. Without an env var, so the
// default Vercel build works as is; previews also point their cards here.
const SITE_URL = "https://universe-gamma-eosin.vercel.app";
const DESCRIPTION =
  "Mapea cualquier sistema como un mapa explorable: nodos conectados, cada uno con su explicación. Sin backend, sin IA, código abierto.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "universe: mapas universales de sistemas", template: "%s · universe" },
  description: DESCRIPTION,
  applicationName: "universe",
  authors: [{ name: "Santiago Sarabia" }],
  keywords: ["mapa", "diagrama", "sistemas", "flujo", "canvas", "nodos", "código abierto"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "/",
    siteName: "universe",
    title: "universe: mapas universales de sistemas",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "universe: mapas universales de sistemas",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full overflow-hidden">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
