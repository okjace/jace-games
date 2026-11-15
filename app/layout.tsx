import type { Metadata, Viewport } from "next";
import { StreakCheck } from "@/components/site/StreakCheck";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { Notices } from "@/components/site/Notices";
import { EasterEggs } from "@/components/site/EasterEggs";
import { MoreEggs } from "@/components/site/MoreEggs";
import { EggMenu } from "@/components/site/EggMenu";
import { ConfirmHost } from "@/components/site/ConfirmBox";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { HEAD_SCRIPT, SeasonProvider } from "@/components/site/ThemeContext";
import { ThemeLayer, ThemedGarland } from "@/components/site/ThemeLayer";
import { ScoresProvider } from "@/components/ScoresProvider";
import { getThemeChoice } from "@/lib/db/siteSettings";
import { activeSeason } from "@/lib/seasons";
import { getSession } from "@/lib/session";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Bricolage_Grotesque({ variable: "--font-display-face", subsets: ["latin"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: { default: "Jace Live 🎉 play together LIVE!!", template: "%s · Jace Live" },
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
      <head>
        <script dangerouslySetInnerHTML={{ __html: HEAD_SCRIPT }} />
      </head>
      <body className="relative isolate flex min-h-full flex-col">
        <SeasonProvider season={season}>
        <ScoresProvider initialUser={session?.user ?? null}>
          <SiteHeader />
          <ThemedGarland />
          <Notices />
          <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 pt-6 sm:px-6 sm:pt-8">{children}</main>
          <SiteFooter />
          <ThemeLayer />
          <EasterEggs />
          <MoreEggs />
          <EggMenu />
          <ConfirmHost />
          <StreakCheck />
        </ScoresProvider>
        </SeasonProvider>
      </body>
    </html>
  );
}
