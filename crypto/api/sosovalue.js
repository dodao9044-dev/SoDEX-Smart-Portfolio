const COINS = [
  ['BTC','bitcoin','BTCUSDT','Bitcoin','Layer1'],
  ['ETH','ethereum','ETHUSDT','Ethereum','Layer1'],
  ['BNB','binancecoin','BNBUSDT','BNB','DeFi'],
  ['SOL','solana','SOLUSDT','Solana','StableCoin'],
  ['XRP','ripple','XRPUSDT','XRP','Meme'],
  ['DOGE','dogecoin','DOGEUSDT','Dogecoin','NFT'],
  ['ADA','cardano','ADAUSDT','Cardano','NFT'],
  ['AVAX','avalanche-2','AVAXUSDT','Avalanche','CeFi'],
  ['LINK','chainlink','LINKUSDT','Chainlink','Meme'],
  ['TRX','tron','TRXUSDT','TRON','Meme'],
  ['NEAR','near','NEARUSDT','NEAR Protocol','GameFi'],
  ['UNI','uniswap','UNIUSDT','Uniswap','DeFi'],
  ['ONDO','ondo-finance','ONDOUSDT','Ondo','RWA'],
  ['RENDER','render-token','RENDERUSDT','Render','AI'],
  ['AAVE','aave','AAVEUSDT','Aave','DeFi'],
  ['SUI','sui','SUIUSDT','Sui','Layer1'],
  ['USDT','tether','USDTUSDT','Tether','StableCoin'],
  ['USDC','usd-coin','USDCUSDT','USD Coin','Others']
];

const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=40');
  res.end(JSON.stringify(body));
};

async function fetchJson(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      headers: { 'accept': 'application/json', 'user-agent': 'ValuePilot/2.0' }
    });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

const n = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;

function fmtChart(seed, change) {
  const out = [];
  const base = 50 + (seed % 17);
  for (let i = 0; i < 7; i++) out.push(Math.round((base + Math.sin(i + seed) * 9 + change * i / 4) * 100) / 100);
  return out;
}

async function binanceMarket() {
  const tickers = await fetchJson('https://api.binance.com/api/v3/ticker/24hr');
  const map = new Map(tickers.map(x => [x.symbol, x]));
  return COINS.map(([symbol, id, pair, name, sector], i) => {
    if (symbol === 'USDT') return { symbol, id, name, sector, price: 1, change24h: 0, volume24h: 0, marketCap: 0, chart: fmtChart(i, 0), aiScore: 70 };
    const t = map.get(pair);
    if (!t) return null;
    const price = n(t.lastPrice);
    const quoteVolume = n(t.quoteVolume);
    const change24h = n(t.priceChangePercent);
    return { symbol, id, name, sector, price, change24h, volume24h: quoteVolume, marketCap: 0, chart: fmtChart(i, change24h), aiScore: Math.max(45, Math.min(95, Math.round(72 + change24h * 1.4 + (quoteVolume > 1e9 ? 5 : 0)))) };
  }).filter(Boolean);
}

async function geckoMarket() {
  const ids = COINS.map(c => c[1]).join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=24h`;
  const data = await fetchJson(url, 10000);
  return data.map((x, i) => {
    const meta = COINS.find(c => c[1] === x.id) || [];
    return {
      symbol: String(x.symbol || meta[0] || '').toUpperCase(),
      id: x.id,
      name: x.name || meta[3] || String(x.symbol || '').toUpperCase(),
      sector: meta[4] || 'Market',
      price: n(x.current_price),
      change24h: n(x.price_change_percentage_24h),
      volume24h: n(x.total_volume),
      marketCap: n(x.market_cap),
      chart: Array.isArray(x.sparkline_in_7d?.price) ? x.sparkline_in_7d.price.slice(-24).filter(v => Number.isFinite(Number(v))) : fmtChart(i, n(x.price_change_percentage_24h)),
      aiScore: Math.max(45, Math.min(95, Math.round(70 + n(x.price_change_percentage_24h) + (n(x.total_volume) > 1e9 ? 4 : 0))))
    };
  });
}

function merge(binance, gecko) {
  const bySymbol = new Map(gecko.map(x => [x.symbol, x]));
  const merged = binance.map((b) => {
    const g = bySymbol.get(b.symbol);
    return {
      ...b,
      marketCap: g?.marketCap || b.marketCap || 0,
      volume24h: b.volume24h || g?.volume24h || 0,
      chart: (g?.chart?.length ? g.chart : b.chart),
      name: g?.name || b.name
    };
  });
  for (const g of gecko) if (!merged.some(x => x.symbol === g.symbol)) merged.push(g);
  return merged.filter(x => x.price > 0).sort((a,b) => (b.marketCap || b.volume24h) - (a.marketCap || a.volume24h)).slice(0, 18);
}

function globalStats(assets) {
  const totalMarketCap = assets.reduce((s,x) => s + n(x.marketCap), 0);
  const totalVolume24h = assets.reduce((s,x) => s + n(x.volume24h), 0);
  const btc = assets.find(x => x.symbol === 'BTC');
  const eth = assets.find(x => x.symbol === 'ETH');
  return { totalMarketCap, totalVolume24h, btcPrice: btc?.price || 0, btcChange: btc?.change24h || 0, ethPrice: eth?.price || 0, ethChange: eth?.change24h || 0 };
}

export default async function handler(req, res) {
  const debug = req.query?.debug === '1';
  try {
    const [bRes, gRes] = await Promise.allSettled([binanceMarket(), geckoMarket()]);
    const binance = bRes.status === 'fulfilled' ? bRes.value : [];
    const gecko = gRes.status === 'fulfilled' ? gRes.value : [];
    const assets = merge(binance, gecko);
    if (!assets.length) throw new Error('No live market rows returned');
    const body = { ok: true, assets, data: { assets }, global: globalStats(assets), updatedAt: new Date().toISOString() };
    if (debug) body.source = `live-merged:${binance.length ? 'exchange' : ''}${gecko.length ? '+market' : ''}`;
    return json(res, 200, body);
  } catch (e) {
    return json(res, 502, { ok: false, error: 'Live market data unavailable. Please redeploy or retry.', message: e.message, assets: [], data: { assets: [] }, global: globalStats([]) });
  }
}
