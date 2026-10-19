import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Jace avatars can be hosted anywhere (Vercel Blob, GitHub, …), so they're
    // rendered with a plain <img> rather than next/image.
    unoptimized: true,
  },
};

export default nextConfig;
