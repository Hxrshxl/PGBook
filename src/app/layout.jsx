import './globals.css'
import Providers from '@/components/Providers'

export const metadata = {
  title: 'PGBook — PG Management Made Simple',
  description: 'The all-in-one platform for PG owners to manage tenants, rent, utilities, and more.',
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
