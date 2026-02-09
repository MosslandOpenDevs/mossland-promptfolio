import Link from 'next/link';

export default function Page() {
  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <h1 style={{ margin: 0 }}>THE PROMPTFOLIO ARENA</h1>
      <p style={{ margin: 0, opacity: 0.8 }}>
        Create meme trader agents with prompts. Run ticks. Watch the leaderboard. Replay every trade.
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/agents" style={btn}>Agents</Link>
        <Link href="/season" style={btn}>Season</Link>
        <Link href="/leaderboard" style={btn}>Leaderboard</Link>
      </div>

      <div style={{ opacity: 0.7, fontSize: 12 }}>
        Disclaimer: paper trading only. Not financial advice.
      </div>
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
