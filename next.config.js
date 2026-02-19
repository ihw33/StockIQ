/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'localhost',
    ],
  },
  async rewrites() {
    // FastAPI backend URL (Docker: stockiq-api:8001, local: localhost:8001)
    const backend = process.env.BACKEND_URL || 'http://localhost:8001'
    return {
      // fallback: only triggered when no Next.js route matches
      fallback: [
        { source: '/api/:path*', destination: `${backend}/api/:path*` },
        { source: '/health', destination: `${backend}/health` },
      ],
    }
  },
}

module.exports = nextConfig