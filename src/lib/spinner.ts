function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const SPINNER_VERBS = [
  'Summoning agents',
  'Calibrating moss',
  'Brewing alpha',
  'Cooking a tick',
  'Rolling the zine press',
  'Consulting the oracle',
  'Asking the tape spirits',
  'Sharpening pencils',
  'Soldering thoughts',
  'Tuning the terminal',
  'Printing receipts',
  'Herding degen cats',
  'Aligning vibes',
  'Warming up the CRT',
  'Spinning up memes',
  'Negotiating with latency',
  'Bribing the price feed',
  'Dusting off the archive',
  'Folding paper corners',
  'Sticking masking tape',
] as const;

export function pickSpinnerVerb(seed: string): string {
  const h = hash32(seed);
  return SPINNER_VERBS[h % SPINNER_VERBS.length];
}
