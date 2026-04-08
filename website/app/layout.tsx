import './globals.css';
import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: {
    default: 'New World Disorder — Liga Gravity',
    template: '%s — New World Disorder',
  },
  description:
    'Liga gravity dla riderów. Oficjalne ośrodki, weryfikowane zjazdy, sezonowe rankingi.',
  metadataBase: new URL('https://nwdisorder.com'),
  applicationName: 'New World Disorder',
  authors: [{ name: 'New World Disorder' }],
  keywords: ['MTB', 'gravity', 'downhill', 'liga', 'Słotwiny Arena', 'NWD'],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'New World Disorder',
    description:
      'Liga gravity dla riderów. Oficjalne ośrodki, weryfikowane zjazdy, sezonowe rankingi.',
    url: 'https://nwdisorder.com',
    siteName: 'New World Disorder',
    locale: 'pl_PL',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'New World Disorder',
    description:
      'Liga gravity dla riderów. Oficjalne ośrodki, weryfikowane zjazdy, sezonowe rankingi.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#050505',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>
        <div className="shell">
          <nav className="nav">
            <Link href="/" className="nav-brand">NWD</Link>
            <div className="nav-links">
              <Link href="/privacy">Prywatność</Link>
              <Link href="/terms">Regulamin</Link>
              <Link href="/support">Wsparcie</Link>
            </div>
          </nav>

          {children}

          <footer className="footer">
            <div>© {new Date().getFullYear()} New World Disorder</div>
            <div className="footer-links">
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/support">Support</Link>
              <Link href="/delete-account">Delete Account</Link>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
