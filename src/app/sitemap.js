export default function sitemap() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return ['', '/signup', '/login'].map(path => ({ url: `${site}${path}`, changeFrequency: 'monthly' }))
}
