/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'localhost',
      // Add your image domains here
    ],
  },
  experimental: {
    // serverActions: true, // Already enabled by default in Next.js 14
  },
}

module.exports = nextConfig