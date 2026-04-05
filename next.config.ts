import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/admin",
        destination: "/desk",
        permanent: false,
      },
      {
        source: "/admin/:path*",
        destination: "/desk/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
