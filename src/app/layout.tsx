import type { ReactNode } from "react";
import { Black_Ops_One, Courier_Prime, Space_Grotesk } from 'next/font/google';
import './globals.css';
import LocaleToggle from '../components/LocaleToggle';
import { getLocale, t } from '../lib/i18n';
import TopNav from '../components/TopNav';
import HealthBadge from '../components/HealthBadge';

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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const navItems = [
    { href: '/', label: t(locale, 'home') },
    { href: '/agents', label: t(locale, 'agents') },
    { href: '/season', label: t(locale, 'season') },
    { href: '/leaderboard', label: t(locale, 'leaderboard') },
    { href: '/replay', label: t(locale, 'replay') },
  ];

  const appVersion = process.env.npm_package_version || "0.0.1";
  const now = new Date();

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
            <LocaleToggle
              locale={locale}
              label={t(locale, 'languageSwitcherLabel')}
              currentLanguageLabel={t(locale, 'currentLanguage')}
              switchLanguageLabel={t(locale, 'switchLanguageTo')}
              savingLabel={t(locale, 'localeSaving')}
              errorLabel={t(locale, 'localeSwitchFailed')}
              englishLabel={t(locale, 'english')}
              koreanLabel={t(locale, 'korean')}
            />
          </header>
          <hr />
          <main id="main-content" tabIndex={-1}>{children}</main>
          <footer className="pf-footer" aria-label="Global footer">
            <span>© {now.getFullYear()} mossland-promptfolio</span>
            <span>
              Live prompt arena ·
              <time dateTime={now.toISOString()} className="sr-only">Updated</time>
              <span aria-hidden="true"> UI mode: web · v</span><span>{appVersion}</span>
              <span aria-label={`Locale: ${locale}`}> · locale: {locale}</span>
              <HealthBadge />
            </span>
          </footer>
        </div>
      </body>
    </html>
  );
}
