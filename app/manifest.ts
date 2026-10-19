import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jace Games",
    short_name: "Jace Games",
    description: "Quick browser games from Jace.",
    start_url: "/",
    display: "standalone",
    background_color: "#111317",
    theme_color: "#111317",
    icons: [
      { src: "/brand/jace-games-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/jace-games-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/jace-games-icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
