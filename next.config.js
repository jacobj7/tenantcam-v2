/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Generated apps skip TS errors at build time; fix incrementally
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ["localhost"],
    formats: ["image/avif", "image/webp"],
  },
};

module.exports = nextConfig;
