/** @type {import('next').NextConfig} */
const nextConfig = {
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
  async rewrites() {
    return [];
  },
};

export default nextConfig;
