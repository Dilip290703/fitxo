import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fitzo/supabase", "@fitzo/ui"],
};

export default nextConfig;
