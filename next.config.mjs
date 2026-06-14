/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mongoose'],
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
