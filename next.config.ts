import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // tensemovement CDN의 로고/이미지 호스트 허용
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.tensemovement.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
