import type { TradeSide } from './engine';

export type MemeProfile = 'DEGEN' | 'MONK' | 'NORMIE';

export function profileFromPrompt(prompt: string): MemeProfile {
  const p = prompt.toLowerCase();
  if (p.includes('degen') || p.includes('all in') || p.includes('올인')) return 'DEGEN';
  if (p.includes('monk') || p.includes('no trade') || p.includes('금욕')) return 'MONK';
  return 'NORMIE';
}

function hash32(s: string): number {
  // tiny deterministic hash (FNV-1a)
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(list: string[], seed: string): string {
  const h = hash32(seed);
  return list[h % list.length];
}

export function memeLine(opts: {
  prompt: string;
  side: TradeSide;
  seed: string;
}): string {
  const prof = profileFromPrompt(opts.prompt);
  const side = opts.side;

  const common = {
    BUY: [
      'The moss whispers… BUY.',
      'Vibes are immaculate. Entry confirmed.',
      'I smell liquidity. Going in.',
      'If it dips, we buy the dip. If it rips, we buy the rip.',
    ],
    SELL: [
      'Taking profit. No regrets.',
      'Liquidity for ramen. Respectfully.',
      'Selling into strength. Like a grown-up.',
      'I can’t hear the FOMO over this realized PnL.',
    ],
    HOLD: [
      'HODL mode engaged.',
      'Doing nothing is a strategy.',
      'Hands: diamond. Brain: offline.',
      'Awaiting the next signal…',
    ],
  } as const;

  const degen = {
    BUY: [
      'All gas no brakes.',
      'If this fails, it’s character development.',
      'I am the exit liquidity. On purpose.',
      'Leverage? In spirit. (paper trading only)',
      'Send it. SEND IT.',
    ],
    SELL: [
      'Coward sell detected. Recalibrating ego.',
      'Selling? Only to buy higher.',
      'Paper hands moment (temporary).',
    ],
    HOLD: [
      'Diamond hands locked.',
      'I refuse to sell. This is art.',
      'My risk manager is asleep.',
    ],
  } as const;

  const monk = {
    BUY: [
      'I buy only when the universe insists.',
      'Calm entry. Quiet conviction.',
    ],
    SELL: [
      'Releasing attachment. Exiting calmly.',
      'Profit is impermanent. So is loss.',
    ],
    HOLD: [
      'Stillness is alpha.',
      'No trade. Just breathe.',
      'Zen mode: ON.',
    ],
  } as const;

  const base = common[side];
  const extra = prof === 'DEGEN' ? degen[side] : prof === 'MONK' ? monk[side] : [];
  const list = extra.length ? [...extra, ...base] : [...base];

  return pick(list, `${opts.seed}:${prof}:${side}`);
}
