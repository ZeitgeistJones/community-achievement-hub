import type { Metadata } from "next";
import { Bungee, Inter } from "next/font/google";
import Link from "next/link";
import { HeaderConnect } from "@/components/HeaderConnect";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const bungee = Bungee({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bungee",
});

export const metadata: Metadata = {
  title: "Community Achievement Hub",
  description: "On-chain achievements across the Clawd ecosystem",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${bungee.variable}`}>
      <body>
        <Providers>
          <header className="border-b border-white/10 bg-surface/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
              <Link href="/" className="font-display text-lg text-text hover:text-legendary-light">
                Achievement Hub
              </Link>
              <nav className="flex items-center gap-4 text-sm">
                <Link href="/" className="text-text/70 hover:text-text">
                  Directory
                </Link>
                <Link href="/admin" className="text-text/70 hover:text-text">
                  Admin
                </Link>
                <HeaderConnect />
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
