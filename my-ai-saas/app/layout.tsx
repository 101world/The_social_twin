import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Geist_Mono } from "next/font/google";

import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { CreditProvider } from "@/lib/credits-context";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "101.AI — Create Movies, Reels, and Music with AI",
  description:
    "A cinematic, fast, and interactive landing experience. Make films, reels, and music with AI — privacy-first and creator-focused.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${inter.variable} ${geistMono.variable} antialiased`}>
          <CreditProvider>
            {/* Desktop: Sidebar, Mobile: Navbar */}
            <div className="hidden md:block">
              <Sidebar />
            </div>
            <div className="md:hidden">
              <Navbar />
            </div>
            <main className="md:ml-16">
              {children}
            </main>
          </CreditProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
