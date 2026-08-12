import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Default 1MB is too small for a scanned ORS supporting document going through the
  // create-obligation Server Action's FormData (app/personnel/raao/actions.ts).
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;