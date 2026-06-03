import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fitzo/supabase", "@fitzo/ui"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
