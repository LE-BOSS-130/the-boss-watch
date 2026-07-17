import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pact — Shared responsibility assistant",
  description:
    "Coordinate people, reminders, and obligations with one shared group AI. Commitments, escalation, and cross-device sync.",
  applicationName: "Pact",
  appleWebApp: {
    capable: true,
    title: "Pact",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-zinc-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
