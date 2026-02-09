import type { ReactNode } from 'react';

export const metadata = {
  title: 'mossland-promptfolio',
  description: 'Prompt-driven MOC paper trading league',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'ui-sans-serif, system-ui', margin: 0, background: '#0b0f14', color: '#e6edf3' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>mossland-promptfolio</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>paper trading league for MOC — prompts, memes, replays</div>
            </div>
            <a href="/" style={{ color: '#7ee787', textDecoration: 'none' }}>home</a>
          </div>
          <hr style={{ borderColor: '#1f2a37', margin: '16px 0' }} />
          {children}
        </div>
      </body>
    </html>
  );
}
