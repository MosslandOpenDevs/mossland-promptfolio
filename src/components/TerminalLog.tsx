import type { ReactNode } from 'react';

export type TerminalRow = {
  ts: string;
  kind: 'BUY' | 'SELL' | 'HOLD' | 'SYS' | 'WARN';
  title: string;
  lines: string[];
  highlight?: 'primary' | 'alert' | 'tape';
};

export default function TerminalLog({ title, rows }: { title: string; rows: TerminalRow[] }) {
  return (
    <div className="pf-terminal">
      <div className="pf-terminal__bar">
        <span>/// {title}</span>
        <span style={{ opacity: 0.8 }}>code</span>
      </div>
      <div className="pf-terminal__log">
        {rows.length === 0 ? (
          <div style={{ opacity: 0.6 }}>No logs yet.</div>
        ) : (
          rows.map((r, i) => (
            <div key={i} className="pf-terminal__row" style={rowStyle(r.highlight)}>
              <div style={{ fontSize: 10, opacity: 0.75 }}>[{r.ts}]</div>
              <div style={{ fontWeight: 900 }}>{r.kind} — {r.title}</div>
              {r.lines.map((ln, idx) => (
                <div key={idx} style={{ paddingLeft: 10, opacity: 0.9 }}>{ln}</div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function rowStyle(h?: TerminalRow['highlight']): React.CSSProperties {
  if (h === 'alert') return { background: 'rgba(211,47,47,.08)', padding: 8, margin: '-2px -2px 8px', border: '1px solid rgba(211,47,47,.15)' };
  if (h === 'tape') return { background: 'rgba(232,223,197,.55)', padding: 8, margin: '-2px -2px 8px', border: '1px solid rgba(0,0,0,.08)' };
  if (h === 'primary') return { background: 'rgba(142,255,42,.12)', padding: 8, margin: '-2px -2px 8px', border: '1px solid rgba(77,166,13,.18)' };
  return {};
}
