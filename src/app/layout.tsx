import type { ReactNode } from 'react';
import './globals.css';
import LocaleToggle from '../components/LocaleToggle';
import { getLocale, t } from '../lib/i18n';

export const metadata = {
  title: 'mossland-promptfolio',
  description: 'Prompt-driven MOC paper trading league',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const locale = getLocale();

  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Permanent+Marker&family=Black+Ops+One&family=Courier+Prime:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="pf-wrap">
          <div className="pf-top">
            <div>
              <div className="pf-brand">{t(locale, 'appName')}</div>
              <div className="pf-tag">{t(locale, 'tagline')}</div>
            </div>
            <div className="pf-nav">
              <a href="/">{t(locale, 'home')}</a>
              <LocaleToggle locale={locale} />
            </div>
          </div>
          <hr />
          {children}
        </div>
      </body>
    </html>
  );
}
