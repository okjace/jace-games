import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { Notices } from "@/components/site/Notices";
import { Garland, SeasonalSky } from "@/components/site/Seasonal";
import { SeasonBackdrop } from "@/components/site/SeasonFx";
import { EasterEggs } from "@/components/site/EasterEggs";
import { MoreEggs } from "@/components/site/MoreEggs";
import { Music } from "@/components/site/Music";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { ScoresProvider } from "@/components/ScoresProvider";
import { getThemeChoice } from "@/lib/db/siteSettings";
import { activeSeason } from "@/lib/seasons";
import { getSession } from "@/lib/session";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Bricolage_Grotesque({ variable: "--font-display-face", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "Jace Live", template: "%s · Jace Live" },
  description: "Live quiz and party games for the whole room: host on the big screen, everyone plays from their phone.",
};

export const viewport: Viewport = {
  themeColor: "#f4f5f7",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [session, choice] = await Promise.all([getSession(), getThemeChoice()]);
  // The site theme: the owner's pick, or the one for today's date.
  const season = activeSeason(choice);

  return (
    <html
      lang="en"
      data-theme="light"
      data-season={season}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="relative isolate flex min-h-full flex-col">
        <ScoresProvider initialUser={session?.user ?? null}>
          <SiteHeader season={season} />
          <Garland season={season} />
          <Notices />
          <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 pt-6 sm:px-6 sm:pt-8">{children}</main>
          <SiteFooter />
          <SeasonalSky season={season} />
          <SeasonBackdrop season={season} />
          <EasterEggs />
          <MoreEggs />
          <Music season={season} />
        </ScoresProvider>
      </body>
    </html>
  );
}
