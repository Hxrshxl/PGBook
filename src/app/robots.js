export default function robots() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/admin', '/api'] },
    sitemap: `${site}/sitemap.xml`,
  }
}
