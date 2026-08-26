import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TEFAS'a giden API isteklerine CORS başlığı ekle
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
        ],
      },
    ];
  },
  // TEFAS domain'ine giden istekler için yönlendirme
  async rewrites() {
    return [];
  },
};

export default nextConfig;
