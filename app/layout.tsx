import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Notices } from "@/components/site/Notices";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ScoresProvider } from "@/components/ScoresProvider";
import { getSession } from "@/lib/session";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Jace Games", template: "%s · Jace Games" },
  description: "Quick browser games from Jace. Sign in with your Jace account to keep your scores everywhere.",
};

export const viewport: Viewport = {
  themeColor: "#111317",
  width: "device-width",
  initialScale: 1,
};

// Applies the saved light/dark choice before first paint, so there's no flash.
const themeScript = `try{if(localStorage.getItem("jace-games:theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();

  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ScoresProvider initialUser={session?.user ?? null}>
          <SiteHeader />
          <Notices />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 sm:px-6 sm:pt-8">{children}</main>
          <SiteFooter />
        </ScoresProvider>
      </body>
    </html>
  );
}
