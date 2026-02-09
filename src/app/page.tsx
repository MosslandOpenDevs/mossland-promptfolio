import Link from 'next/link';
import { getLocale, t } from '../lib/i18n';

export default function Page() {
  const locale = getLocale();

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <h1 style={{ margin: 0 }}>{t(locale, 'arenaTitle')}</h1>
      <p style={{ margin: 0, opacity: 0.8 }}>{t(locale, 'arenaSubtitle')}</p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/agents" style={btn}>{t(locale, 'agents')}</Link>
        <Link href="/season" style={btn}>{t(locale, 'season')}</Link>
        <Link href="/leaderboard" style={btn}>{t(locale, 'leaderboard')}</Link>
      </div>

      <div style={{ opacity: 0.7, fontSize: 12 }}>{t(locale, 'disclaimer')}</div>
    </main>
  );
}

const btn: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 12px',
  border: '1px solid #253042',
  borderRadius: 10,
  textDecoration: 'none',
  color: '#e6edf3',
  background: '#0f1720',
};
