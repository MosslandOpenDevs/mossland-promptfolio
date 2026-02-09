type PriceResp = { [id: string]: { usd: number } };

export async function fetchMocUsd(): Promise<number> {
  const base = process.env.COINGECKO_BASE_URL || 'https://api.coingecko.com/api/v3';
  const coinId = process.env.COINGECKO_COIN_ID || 'mossland';
  const url = `${base}/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=usd`;

  const res = await fetch(url, {
    headers: {
      'accept': 'application/json',
      // be a good citizen
      'user-agent': 'mossland-promptfolio/0.0.1'
    },
    // avoid Next cache surprises for now
    cache: 'no-store',
  });

  if (!res.ok) throw new Error(`Price fetch failed: ${res.status}`);
  const json = (await res.json()) as PriceResp;
  const v = json[coinId]?.usd;
  if (typeof v !== 'number') throw new Error('Malformed price response');
  return v;
}
