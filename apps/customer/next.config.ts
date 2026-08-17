import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fitxo/supabase", "@fitxo/ui", "@fitxo/pincode"],
  // Distinct auth-cookie name so panels don't share one session on localhost.
  env: { NEXT_PUBLIC_SUPABASE_COOKIE_NAME: "sb-fitxo-customer" },
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
