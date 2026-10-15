import type { Metadata } from "next";
import { DM_Mono, Figtree, Funnel_Display } from "next/font/google";
import { AppProviders } from "@/components/layout";
import { APP_NAME, SITE_DESCRIPTION, SITE_URL, TAGLINE } from "@/constants";
import "./globals.css";

const funnelDisplay = Funnel_Display({ subsets: ["latin"], variable: "--font-funnel-display" });
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: `%s · ${APP_NAME}`,
    default: `${APP_NAME} — ${TAGLINE}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: APP_NAME,
  alternates: { canonical: "/" },
  // The preview image itself comes from app/opengraph-image.tsx (and each box's own).
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    locale: "en_GB",
    url: "/",
    title: `${APP_NAME} — ${TAGLINE}`,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: `${APP_NAME} — ${TAGLINE}`, description: SITE_DESCRIPTION },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${funnelDisplay.variable} ${figtree.variable} ${dmMono.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
