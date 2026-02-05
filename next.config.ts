import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: '/api/:path*', // 프론트엔드(3000)로 오는 요청을
        destination: 'http://127.0.0.1:8080/api/:path*', // 백엔드(8080)로 전달
      },
    ];
  },
};

export default nextConfig;