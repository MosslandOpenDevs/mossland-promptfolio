import type { ReactNode } from 'react';
import { Black_Ops_One, Courier_Prime, Space_Grotesk } from 'next/font/google';
import './globals.css';
import LocaleToggle from '../components/LocaleToggle';
import { getLocale, t } from '../lib/i18n';

export const metadata = {
  title: 'mossland-promptfolio',
  description: 'Prompt-driven MOC paper trading league',
};

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-space-grotesk',
});

const courierPrime = Courier_Prime({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-courier-prime',
});

const blackOpsOne = Black_Ops_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-black-ops-one',
});

export default function RootLayout({ children }: { children: ReactNode }) {
  const locale = getLocale();

  return (
    <html lang={locale}>
      <body className={`${spaceGrotesk.variable} ${courierPrime.variable} ${blackOpsOne.variable}`}>
        <a href="#main-content" className="pf-skip" aria-label="Skip to main content">
          Skip to content
        </a>
        <div className="pf-wrap">
          <div className="pf-top">
            <div>
              <div className="pf-brand">{t(locale, 'appName')}</div>
              <div className="pf-tag">{t(locale, 'tagline')}</div>
            </div>
            <nav className="pf-nav" aria-label="Primary">
              <a href="/" aria-label="Go to homepage">{t(locale, 'home')}</a>
              <a href="/agents" aria-label="View agents">{t(locale, 'agents')}</a>
              <a href="/season" aria-label="Open season status">{t(locale, 'season')}</a>
              <a href="/leaderboard" aria-label="View leaderboard">{t(locale, 'leaderboard')}</a>
              <a href="/replay" aria-label="Open replay board">{t(locale, 'replay')}</a>
              <LocaleToggle locale={locale} />
            </nav>
          </div>
          <hr />
          <main id="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
