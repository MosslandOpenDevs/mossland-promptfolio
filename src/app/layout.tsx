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
