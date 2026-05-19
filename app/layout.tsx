import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Toaster } from "react-hot-toast";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import GoogleAnalyticsPageView from "./GoogleAnalyticsPageView";
import { QueryClientProvider } from "@/lib/query-client-provider";
import { CsrfInstaller } from "@/components/CsrfInstaller";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL
  ? (process.env.NEXT_PUBLIC_APP_URL.startsWith("http") ? process.env.NEXT_PUBLIC_APP_URL : `https://${process.env.NEXT_PUBLIC_APP_URL}`)
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://harvest21.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Harvest21",
  description: "Harvest21 is a platform for managing missionaries, agencies, churches, colleges, and donors.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Security: read CSP nonce set by middleware for nonce-based script execution
  const hdrs = await headers();
  const nonce = hdrs.get("x-csp-nonce") ?? undefined;

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryClientProvider>
          <CsrfInstaller />
          <GoogleAnalytics nonce={nonce} />
          <Suspense fallback={null}>
            <GoogleAnalyticsPageView />
          </Suspense>
          {children}
          <SpeedInsights />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: "#fff",
                color: "#18181b",
                border: "1px solid #e4e4e7",
                borderRadius: "8px",
                padding: "12px 16px",
              },
              success: {
                iconTheme: {
                  primary: "#22c55e",
                  secondary: "#fff",
                },
              },
              error: {
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "#fff",
                },
              },
            }}
          />
        </QueryClientProvider>
      </body>
    </html>
  );
}
