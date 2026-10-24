import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server be opened on 127.0.0.1 as well as localhost, so two
  // accounts can be signed in at once when trying multiplayer locally.
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    // Jace avatars can be hosted anywhere (Vercel Blob, GitHub, …), so they're
    // rendered with a plain <img> rather than next/image.
    unoptimized: true,
  },
};

export default nextConfig;
