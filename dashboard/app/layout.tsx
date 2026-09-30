import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DASHBOARD_GROUPS, dashboardGroup } from "@/lib/campaigns";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const groupTitle = DASHBOARD_GROUPS[dashboardGroup()].title;

export const metadata: Metadata = {
  title: `Content Performance | ${groupTitle}`,
  description: `Content performance dashboard for ${groupTitle} campaigns.`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
