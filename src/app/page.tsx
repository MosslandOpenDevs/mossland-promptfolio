import Link from 'next/link';
import { getLocale, t } from '../lib/i18n';

export default function Page() {
  const locale = getLocale();

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <h1 className="pf-h1">{t(locale, 'arenaTitle')}</h1>
      <p className="pf-sub">{t(locale, 'arenaSubtitle')}</p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/agents" className="pf-btn">{t(locale, 'agents')}</Link>
        <Link href="/season" className="pf-btn">{t(locale, 'season')}</Link>
        <Link href="/leaderboard" className="pf-btn">{t(locale, 'leaderboard')}</Link>
      </div>

      <div className="pf-dim" style={{ fontSize: 12 }}>{t(locale, 'disclaimer')}</div>
    </main>
  );
}
