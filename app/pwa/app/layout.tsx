import type { Metadata } from "next";
import { DM_Mono, Figtree, Funnel_Display } from "next/font/google";
import { AppProviders } from "@/components/layout";
import { APP_NAME } from "@/constants";
import "./globals.css";

const funnelDisplay = Funnel_Display({ subsets: ["latin"], variable: "--font-funnel-display" });
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono" });

export const metadata: Metadata = {
  title: {
    template: `%s · ${APP_NAME}`,
    default: `${APP_NAME} — Little joys, delivered on repeat`,
  },
  description: "Subscription boxes for romance, self-care, beauty, snacks and home — arriving as often as you’d like.",
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
