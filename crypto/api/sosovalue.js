import { json, env, trimSlash, normalizePath } from './_utils.js';

const DEFAULT_PATHS = {
  market: '/token/market/list',
  news: '/news/list',
  etf: '/etf/bitcoin/spot/flow',
  ssi: '/ssi/index/list'
};

const ENV_KEYS = {
  market: 'SOSOVALUE_MARKET_PATH',
  news: 'SOSOVALUE_NEWS_PATH',
  etf: 'SOSOVALUE_ETF_PATH',
  ssi: 'SOSOVALUE_SSI_PATH'
};

const COINS = 'bitcoin,ethereum,solana,binancecoin,ripple,chainlink,avalanche-2,near,render-token,arbitrum,optimism,ondo-finance';
const BINANCE_SYMBOLS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','LINKUSDT','AVAXUSDT','NEARUSDT'];

async function fetchJson(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { accept: 'application/json', ...(options.headers || {}) } });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`upstream_${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function normalizeCgMarket(items = []) {
  return items.map((coin) => ({
    id: coin.id,
    name: coin.name,
    symbol: coin.symbol,
    current_price: coin.current_price,
    price_change_percentage_24h: coin.price_change_percentage_24h,
    market_cap: coin.market_cap,
    total_volume: coin.total_volume,
    sparkline_in_7d: coin.sparkline_in_7d,
    score: Math.round(70 + Math.max(-10, Math.min(10, Number(coin.price_change_percentage_24h || 0))))
  }));
}

async function coinGeckoMarkets() {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINS}&order=market_cap_desc&per_page=12&page=1&sparkline=true&price_change_percentage=24h,7d`;
  return normalizeCgMarket(await fetchJson(url));
}

async function binanceMarkets() {
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(BINANCE_SYMBOLS))}`;
  const rows = await fetchJson(url);
  return rows.map((r) => ({
    name: r.symbol.replace('USDT', ''),
    symbol: r.symbol.replace('USDT', ''),
    current_price: Number(r.lastPrice),
    price_change_percentage_24h: Number(r.priceChangePercent),
    total_volume: Number(r.quoteVolume),
    high_24h: Number(r.highPrice),
    low_24h: Number(r.lowPrice),
    score: Math.round(65 + Math.max(-12, Math.min(12, Number(r.priceChangePercent || 0))))
  }));
}

function buildSsi(rows) {
  return rows.map((r, i) => {
    const change = Number(r.price_change_percentage_24h || 0);
    const volume = Number(r.total_volume || 0);
    const score = Math.max(35, Math.min(98, 68 + change * 2 + Math.log10(volume || 1) * 1.2 - i));
    return { ...r, indexName: `${String(r.symbol || 'ASSET').toUpperCase()} Smart Index`, nav: r.current_price, change24h: change, score: Math.round(score), weight: `${Math.max(4, 22 - i * 2)}%` };
  });
}

function buildEtf(rows) {
  return rows.slice(0, 8).map((r, i) => {
    const volume = Number(r.total_volume || 0);
    const change = Number(r.price_change_percentage_24h || 0);
    return { title: `${String(r.symbol || 'ETF').toUpperCase()} flow proxy`, symbol: r.symbol, netFlow: Math.round(volume * (change >= 0 ? .024 : -.018)), amount: volume, price_change_percentage_24h: change, score: Math.round(Math.max(40, Math.min(96, 62 + change * 2 + i))) };
  });
}

async function cryptoNewsSignals() {
  try {
    const data = await fetchJson('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
    const list = Array.isArray(data?.Data) ? data.Data : [];
    return list.slice(0, 10).map((n) => ({ title: n.title, name: n.source_info?.name || n.source, symbol: 'NEWS', url: n.url, price_change_percentage_24h: 0, score: 70 }));
  } catch {
    const trending = await fetchJson('https://api.coingecko.com/api/v3/search/trending');
    return (trending?.coins || []).slice(0, 10).map(({ item }, i) => ({ title: `${item.name} is trending across crypto search`, name: item.name, symbol: item.symbol, price_change_percentage_24h: 3 - i * .4, score: 78 - i }));
  }
}

async function fallback(resource) {
  let marketRows = [];
  try { marketRows = await coinGeckoMarkets(); } catch { marketRows = await binanceMarkets(); }
  if (resource === 'market') return { source: 'fallback-market', data: marketRows };
  if (resource === 'ssi') return { source: 'fallback-ssi', data: buildSsi(marketRows) };
  if (resource === 'etf') return { source: 'fallback-etf', data: buildEtf(marketRows) };
  if (resource === 'news') return { source: 'fallback-news', data: await cryptoNewsSignals() };
  return { source: 'fallback-market', data: marketRows };
}

export default async function handler(req) {
  const url = new URL(req.url);
  const resource = url.searchParams.get('resource') || 'market';

  try {
    const apiKey = env('SOSOVALUE_API_KEY');
    const base = trimSlash(env('SOSOVALUE_BASE_URL', 'https://openapi.sosovalue.com/openapi/v1'));
    const path = normalizePath(env(ENV_KEYS[resource], DEFAULT_PATHS[resource]));

    if (apiKey && path) {
      const target = new URL(`${base}${path}`);
      for (const [key, value] of url.searchParams.entries()) if (key !== 'resource') target.searchParams.set(key, value);
      try {
        const data = await fetchJson(target, { headers: { 'x-soso-api-key': apiKey, 'X-SOSO-API-KEY': apiKey } });
        return json({ ok: true, source: 'sosovalue', resource, path, data });
      } catch {
        const fb = await fallback(resource);
        return json({ ok: true, source: fb.source, resource, data: fb.data, protected: true });
      }
    }

    const fb = await fallback(resource);
    return json({ ok: true, source: fb.source, resource, data: fb.data, protected: true });
  } catch {
    return json({ ok: true, source: 'local-resilience', resource, data: [], protected: true });
  }
}
