import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* ------------------------------------------------------------------ */
/*  Metadata                                                          */
/* ------------------------------------------------------------------ */

const siteTitle = "GigBridge — Student Micro-Freelance Hub";
const siteDescription =
  "Connect with student creators for quick, quality micro-tasks. " +
  "Post work, discover talent, and build trust — all in one place.";

export const metadata: Metadata = {
  title: { default: siteTitle, template: `%s · GigBridge` },
  description: siteDescription,
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),

  /* Open Graph */
  openGraph: {
    type: "website",
    siteName: "GigBridge",
    title: siteTitle,
    description: siteDescription,
  },

  /* Twitter */
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },

  /* Crawlers */
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

/* ------------------------------------------------------------------ */
/*  Root layout                                                       */
/* ------------------------------------------------------------------ */

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface text-text-primary">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
