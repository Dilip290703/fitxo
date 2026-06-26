import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fitzo/supabase", "@fitzo/ui"],
  // Distinct auth-cookie name so panels don't share one session on localhost.
  env: { NEXT_PUBLIC_SUPABASE_COOKIE_NAME: "sb-fitzo-store" },
};

export default nextConfig;
