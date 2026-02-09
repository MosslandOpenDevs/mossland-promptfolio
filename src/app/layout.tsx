import type { ReactNode } from 'react';
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
      <body style={{ fontFamily: 'ui-sans-serif, system-ui', margin: 0, background: '#0b0f14', color: '#e6edf3' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>{t(locale, 'appName')}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>{t(locale, 'tagline')}</div>
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <a href="/" style={{ color: '#7ee787', textDecoration: 'none' }}>{t(locale, 'home')}</a>
              <LocaleToggle locale={locale} />
            </div>
          </div>
          <hr style={{ borderColor: '#1f2a37', margin: '16px 0' }} />
          {children}
        </div>
      </body>
    </html>
  );
}
