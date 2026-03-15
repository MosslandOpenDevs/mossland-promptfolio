import type { ReactNode } from "react";
import { Black_Ops_One, Courier_Prime, Space_Grotesk } from 'next/font/google';
import './globals.css';
import LocaleToggle from '../components/LocaleToggle';
import { getLocale, t } from '../lib/i18n';
import TopNav from '../components/TopNav';

const blackOpsOne = Black_Ops_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-black-ops',
});

const courierPrime = Courier_Prime({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-courier',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: '500',
  variable: '--font-space-grotesk',
});

export const metadata = {
  title: 'mossland-promptfolio',
  description: 'Prompt-driven MOC paper trading league',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const locale = getLocale();
  const navItems = [
    { href: '/', label: t(locale, 'home') },
    { href: '/agents', label: t(locale, 'agents') },
    { href: '/season', label: t(locale, 'season') },
    { href: '/leaderboard', label: t(locale, 'leaderboard') },
    { href: '/replay', label: t(locale, 'replay') },
  ];

  const appVersion = process.env.npm_package_version || "0.0.1";

  return (
    <html lang={locale}>
      <body className={`${blackOpsOne.variable} ${courierPrime.variable} ${spaceGrotesk.variable}`}>
        <a href="#main-content" className="pf-skip-link">{t(locale, 'skipToContent')}</a>
        <div className="pf-wrap">
          <header>
            <div className="pf-branding">
              <div className="pf-brand">{t(locale, 'appName')}</div>
              <div className="pf-tag">{t(locale, 'tagline')}</div>
            </div>
            <TopNav navItems={navItems} />
            <LocaleToggle locale={locale} />
          </header>
          <hr />
          <main id="main-content" tabIndex={-1}>{children}</main>
          <footer className="pf-footer" aria-label="Global footer">
            <span>© {new Date().getFullYear()} mossland-promptfolio</span>
            <span>
              Live prompt arena · UI mode: web · v{appVersion} · locale: {locale}
            </span>
          </footer>
        </div>
      </body>
    </html>
  );
}
