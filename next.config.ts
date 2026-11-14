import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server be opened on 127.0.0.1 as well as localhost, so two
  // accounts can be signed in at once when trying multiplayer locally.
  allowedDevOrigins: ["127.0.0.1"],
  // Jace Live is only Live now: the old solo games and their leaderboards are
  // hidden (the code is kept), and the Live home is the site's home page.
  async redirects() {
    return [
      { source: "/live", destination: "/", permanent: false },
      { source: "/play/:game*", destination: "/", permanent: false },
    ];
  },
  images: {
    // Jace avatars can be hosted anywhere (Vercel Blob, GitHub, …), so they're
    // rendered with a plain <img> rather than next/image.
    unoptimized: true,
  },
};

export default nextConfig;
