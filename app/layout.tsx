import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { DM_Sans } from "next/font/google";
import "./globals.css";

import { Footer } from "@/components/layout/Footer";
import { GlobalStatsBanner } from "@/components/layout/GlobalStatsBanner";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Navbar } from "@/components/layout/Navbar";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TipLytic",
  description: "Smart Betting Tips & Community Predictions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "#3B82F6",
              colorBackground: "#080C14",
              colorText: "#E2E8F0",
              colorTextSecondary: "#94A3B8",
              borderRadius: "12px",
            },
          }}
        >
          <div className="flex min-h-full flex-col">
            <Navbar />
            <GlobalStatsBanner />
            <main className="flex-1 pb-20 md:pb-0">{children}</main>
            <Footer />
            <MobileTabBar />
          </div>
        </ClerkProvider>
      </body>
    </html>
  );
}
