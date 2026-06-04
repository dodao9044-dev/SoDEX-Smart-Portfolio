const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) });
const env = (name, fallback = '') => process.env[name] || fallback;
const trimSlash = (value = '') => String(value).replace(/\/+$/, '');
const normalizePath = (value = '') => !value ? '' : value.startsWith('/') ? value : `/${value}`;
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

const COINGECKO_IDS = [
  'bitcoin','ethereum','tether','binancecoin','solana','ripple','usd-coin','dogecoin','cardano','tron','chainlink','avalanche-2','sui','stellar','wrapped-bitcoin','hyperliquid','litecoin','bitcoin-cash','polkadot','near','uniswap','aptos','internet-computer','ethereum-classic','ondo-finance','render-token','arbitrum','optimism'
].join(',');

const BINANCE_SYMBOLS = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','TRXUSDT','LINKUSDT','AVAXUSDT','SUIUSDT','XLMUSDT','LTCUSDT','BCHUSDT','DOTUSDT','NEARUSDT','UNIUSDT','APTUSDT','ICPUSDT','ETCUSDT'];

const LOCAL_MARKET = [];

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function fetchJson(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'ValuePilot-Wave2/1.0',
        ...(options.headers || {})
      }
    });
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
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeCgMarket(items = []) {
  return items.map((coin, index) => ({
    id: coin.id,
    name: coin.name,
    symbol: String(coin.symbol || '').toUpperCase(),
    current_price: coin.current_price,
    price_change_percentage_24h: coin.price_change_percentage_24h,
    market_cap: coin.market_cap,
    total_volume: coin.total_volume,
    sparkline_in_7d: coin.sparkline_in_7d,
    score: Math.round(Math.max(42, Math.min(98, 70 + Number(coin.price_change_percentage_24h || 0) * 1.8 + Math.log10(Number(coin.total_volume || 1)) / 2 - index / 5)))
  }));
}

async function coinGeckoMarkets() {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINGECKO_IDS}&order=market_cap_desc&per_page=40&page=1&sparkline=true&price_change_percentage=24h`;
  const rows = normalizeCgMarket(await fetchJson(url));
  if (!rows.length) throw new Error('empty_coingecko');
  return rows;
}

async function coinGeckoTrendingNews() {
  const data = await fetchJson('https://api.coingecko.com/api/v3/search/trending');
  const list = Array.isArray(data?.coins) ? data.coins : [];
  return list.slice(0, 12).map(({ item }, i) => ({
    title: `${item.name} is trending across crypto search`,
    name: item.name,
    symbol: String(item.symbol || 'NEWS').toUpperCase(),
    current_price: 0,
    total_volume: 0,
    market_cap: 0,
    price_change_percentage_24h: 4.2 - i * 0.42,
    score: 84 - i
  }));
}

async function binanceMarkets() {
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(BINANCE_SYMBOLS))}`;
  const rows = await fetchJson(url);
  const data = rows.map((r, index) => ({
    name: r.symbol.replace('USDT', ''),
    symbol: r.symbol.replace('USDT', ''),
    current_price: Number(r.lastPrice),
    price_change_percentage_24h: Number(r.priceChangePercent),
    total_volume: Number(r.quoteVolume),
    market_cap: Number(r.quoteVolume) * (22 - index),
    high_24h: Number(r.highPrice),
    low_24h: Number(r.lowPrice),
    sparkline_in_7d: { price: Array.from({ length: 30 }, (_, i) => Number(r.lastPrice) * (1 + Math.sin((i + index) / 3) * 0.012 + Number(r.priceChangePercent || 0) / 2600 * i)) },
    score: Math.round(Math.max(45, Math.min(96, 68 + Number(r.priceChangePercent || 0) * 1.7 - index / 5)))
  }));
  if (!data.length) throw new Error('empty_binance');
  return data;
}

function withLocalSpark(rows = LOCAL_MARKET) {
  return rows.map((row, index) => {
    const price = Number(row.current_price || row.price || 1);
    const change = Number(row.price_change_percentage_24h || 0);
    return {
      ...row,
      sparkline_in_7d: row.sparkline_in_7d || { price: Array.from({ length: 30 }, (_, i) => price * (1 + Math.sin((i + index) / 3) * 0.015 + change / 2500 * i)) },
      score: row.score || Math.round(Math.max(44, Math.min(96, 70 + change * 2 - index / 3)))
    };
  });
}

function buildSsi(rows) {
  return rows.map((r, i) => {
    const change = Number(r.price_change_percentage_24h || 0);
    const volume = Number(r.total_volume || 0);
    const score = Math.max(38, Math.min(98, 68 + change * 2.2 + Math.log10(volume || 1) * 1.1 - i / 2));
    return {
      ...r,
      indexName: `${String(r.symbol || 'ASSET').toUpperCase()} Smart Index`,
      nav: r.current_price,
      change24h: change,
      score: Math.round(score),
      weight: `${Math.max(4, 26 - i * 2)}%`
    };
  });
}

function buildEtf(rows) {
  return rows.slice(0, 12).map((r, i) => {
    const volume = Number(r.total_volume || 0);
    const change = Number(r.price_change_percentage_24h || 0);
    return {
      title: `${String(r.symbol || 'ETF').toUpperCase()} flow proxy`,
      name: `${String(r.symbol || 'ETF').toUpperCase()} Spot Flow`,
      symbol: String(r.symbol || 'ETF').toUpperCase(),
      current_price: Math.abs(Math.round(volume * (change >= 0 ? 0.024 : -0.018))),
      netFlow: Math.round(volume * (change >= 0 ? 0.024 : -0.018)),
      amount: volume,
      total_volume: volume,
      market_cap: Number(r.market_cap || volume * 10),
      price_change_percentage_24h: change,
      sparkline_in_7d: r.sparkline_in_7d,
      score: Math.round(Math.max(40, Math.min(96, 62 + change * 2 + i)))
    };
  });
}

async function cryptoNewsSignals(baseRows) {
  try {
    const data = await fetchJson('https://min-api.cryptocompare.com/data/v2/news/?lang=EN', {}, 7000);
    const list = Array.isArray(data?.Data) ? data.Data : [];
    if (list.length) {
      return list.slice(0, 12).map((n, i) => ({
        title: n.title,
        name: n.source_info?.name || n.source || 'Crypto news',
        symbol: 'NEWS',
        url: n.url,
        current_price: 0,
        total_volume: 0,
        market_cap: 0,
        price_change_percentage_24h: i % 2 ? -0.2 : 0.4,
        score: 80 - i
      }));
    }
  } catch {}

  try {
    const trending = await coinGeckoTrendingNews();
    if (trending.length) return trending;
  } catch {}

  return (baseRows || LOCAL_MARKET).slice(0, 10).map((row, i) => ({
    title: `${row.name || row.symbol} market signal: volume and momentum require monitoring`,
    name: 'AI market brief',
    symbol: String(row.symbol || 'NEWS').toUpperCase(),
    current_price: row.current_price,
    total_volume: row.total_volume,
    market_cap: row.market_cap,
    price_change_percentage_24h: row.price_change_percentage_24h,
    sparkline_in_7d: row.sparkline_in_7d,
    score: Math.max(60, 84 - i)
  }));
}

async function resilientMarket() {
  const errors = [];
  try { return { source: 'coingecko-live', data: await coinGeckoMarkets() }; } catch (e) { errors.push(`coingecko:${e.message}`); }
  await sleep(150);
  try { return { source: 'binance-live', data: await binanceMarkets() }; } catch (e) { errors.push(`binance:${e.message}`); }
  const err = new Error(`all_live_sources_failed ${errors.join(' | ')}`);
  err.status = 502;
  throw err;
}

async function fallback(resource) {
  const market = await resilientMarket();
  const marketRows = market.data;
  if (resource === 'market') return market;
  if (resource === 'ssi') return { source: `${market.source}-ssi`, data: buildSsi(marketRows) };
  if (resource === 'etf') return { source: `${market.source}-etf`, data: buildEtf(marketRows) };
  if (resource === 'news') return { source: `${market.source}-news`, data: await cryptoNewsSignals(marketRows) };
  return market;
}

async function trySosoValue(resource, reqUrl) {
  const apiKey = env('SOSOVALUE_API_KEY');
  if (!apiKey) throw new Error('no_sosovalue_key');
  const base = trimSlash(env('SOSOVALUE_BASE_URL', 'https://openapi.sosovalue.com/openapi/v1'));
  const path = normalizePath(env(ENV_KEYS[resource], DEFAULT_PATHS[resource]));
  if (!path) throw new Error('no_sosovalue_path');
  const target = new URL(`${base}${path}`);
  for (const [key, value] of reqUrl.searchParams.entries()) {
    if (key !== 'resource') target.searchParams.set(key, value);
  }
  const data = await fetchJson(target, {
    headers: {
      'x-soso-api-key': apiKey,
      'X-SOSO-API-KEY': apiKey,
      Authorization: `Bearer ${apiKey}`
    }
  }, 8500);
  return { ok: true, source: 'sosovalue', resource, path, data };
}

export async function handler(event) {
  const url = new URL(`https://netlify.local/.netlify/functions/sosovalue${event.rawQuery ? `?${event.rawQuery}` : ""}`);
  const resource = url.searchParams.get('resource') || 'market';
  const debug = url.searchParams.get('debug') === '1';
  const strict = url.searchParams.get('strict') === '1';

  try {
    const soso = await trySosoValue(resource, url);
    const rows = Array.isArray(soso?.data?.data) ? soso.data.data : Array.isArray(soso?.data) ? soso.data : null;
    if (rows && rows.length === 0) throw new Error('empty_sosovalue');
    return json(200, { ...soso, live: true, fallback: false });
  } catch (sosoError) {
    if (strict) {
      return json(sosoError.status || 502, { ok: false, source: 'sosovalue', resource, error: sosoError.message, hint: 'Check SOSOVALUE_API_KEY / SOSOVALUE_*_PATH in Netlify Environment Variables.' });
    }
    try {
      const fb = await fallback(resource);
      return json(200, { ok: true, source: fb.source, resource, data: fb.data, live: true, fallback: true, upstreamError: debug ? sosoError.message : undefined });
    } catch (liveError) {
      return json(liveError.status || 502, { ok: false, source: 'none', resource, data: [], live: false, fallback: false, error: liveError.message, upstreamError: debug ? sosoError.message : undefined });
    }
  }
}
