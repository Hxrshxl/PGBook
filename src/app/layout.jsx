import './globals.css'
import Providers from '@/components/Providers'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const DESCRIPTION = 'Manage tenants, collect rent, split utility bills, print receipts and send WhatsApp reminders — all from one dashboard built for PG owners in India.'

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'PGBook — PG Management Made Simple',
    template: '%s · PGBook',
  },
  description: DESCRIPTION,
  icons: { icon: '/favicon.svg' },
  openGraph: {
    type: 'website',
    siteName: 'PGBook',
    title: 'PGBook — PG Management Made Simple',
    description: DESCRIPTION,
    locale: 'en_IN',
  },
}

export const viewport = {
  themeColor: '#4f46e5',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
