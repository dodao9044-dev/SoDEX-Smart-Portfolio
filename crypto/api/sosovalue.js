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

const COINGECKO_IDS = [
  'bitcoin','ethereum','tether','binancecoin','solana','ripple','usd-coin','dogecoin','cardano','tron','chainlink','avalanche-2','sui','stellar','wrapped-bitcoin','hyperliquid','litecoin','bitcoin-cash','polkadot','near','uniswap','aptos','internet-computer','ethereum-classic','ondo-finance','render-token','arbitrum','optimism'
].join(',');

const BINANCE_SYMBOLS = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','TRXUSDT','LINKUSDT','AVAXUSDT','SUIUSDT','XLMUSDT','LTCUSDT','BCHUSDT','DOTUSDT','NEARUSDT','UNIUSDT','APTUSDT','ICPUSDT','ETCUSDT','RENDERUSDT','OPUSDT','ARBUSDT'];

const NAME_MAP = {
  BTC: 'Bitcoin', ETH: 'Ethereum', BNB: 'BNB', SOL: 'Solana', XRP: 'XRP', DOGE: 'Dogecoin', ADA: 'Cardano', TRX: 'TRON',
  LINK: 'Chainlink', AVAX: 'Avalanche', SUI: 'Sui', XLM: 'Stellar', LTC: 'Litecoin', BCH: 'Bitcoin Cash', DOT: 'Polkadot',
  NEAR: 'NEAR Protocol', UNI: 'Uniswap', APT: 'Aptos', ICP: 'Internet Computer', ETC: 'Ethereum Classic', RENDER: 'Render', OP: 'Optimism', ARB: 'Arbitrum'
};

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
        'user-agent': 'ValuePilot-Wave2/2.0',
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

function scoreFor(row, index = 0) {
  const change = Number(row.price_change_percentage_24h || 0);
  const volume = Number(row.total_volume || 0);
  return Math.round(Math.max(42, Math.min(98, 70 + change * 1.8 + Math.log10(volume || 1) / 2 - index / 5)));
}

function sparkline(price = 1, change = 0, index = 0) {
  const p = Number(price || 1);
  const c = Number(change || 0);
  return { price: Array.from({ length: 30 }, (_, i) => p * (1 + Math.sin((i + index) / 3) * 0.012 + c / 2600 * i)) };
}

function normalizeCgMarket(items = []) {
  return items.map((coin, index) => ({
    id: coin.id,
    name: coin.name,
    symbol: String(coin.symbol || '').toUpperCase(),
    current_price: Number(coin.current_price || 0),
    price_change_percentage_24h: Number(coin.price_change_percentage_24h || 0),
    market_cap: Number(coin.market_cap || 0),
    total_volume: Number(coin.total_volume || 0),
    high_24h: Number(coin.high_24h || 0),
    low_24h: Number(coin.low_24h || 0),
    sparkline_in_7d: coin.sparkline_in_7d || sparkline(coin.current_price, coin.price_change_percentage_24h, index),
    score: scoreFor(coin, index)
  })).filter((row) => row.symbol && row.current_price > 0);
}

async function coinGeckoMarkets() {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COINGECKO_IDS}&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=24h`;
  const rows = normalizeCgMarket(await fetchJson(url, {}, 8500));
  if (!rows.length) throw new Error('empty_coingecko');
  return rows;
}

async function coinGeckoGlobal() {
  try {
    const data = await fetchJson('https://api.coingecko.com/api/v3/global', {}, 6000);
    return {
      totalMarketCap: Number(data?.data?.total_market_cap?.usd || 0),
      totalVolume24h: Number(data?.data?.total_volume?.usd || 0),
      btcDominance: Number(data?.data?.market_cap_percentage?.btc || 0),
      ethDominance: Number(data?.data?.market_cap_percentage?.eth || 0)
    };
  } catch { return null; }
}

async function binanceMarkets() {
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(BINANCE_SYMBOLS))}`;
  const rows = await fetchJson(url, {}, 8500);
  const data = rows.map((r, index) => {
    const symbol = String(r.symbol || '').replace('USDT', '');
    const price = Number(r.lastPrice || 0);
    const change = Number(r.priceChangePercent || 0);
    const volume = Number(r.quoteVolume || 0);
    return {
      id: symbol.toLowerCase(),
      name: NAME_MAP[symbol] || symbol,
      symbol,
      current_price: price,
      price_change_percentage_24h: change,
      total_volume: volume,
      // Binance does not provide market cap. Keep this as a volume-derived liquidity proxy, not a hard-coded fake price.
      market_cap: Math.round(volume * Math.max(3, 28 - index)),
      high_24h: Number(r.highPrice || 0),
      low_24h: Number(r.lowPrice || 0),
      sparkline_in_7d: sparkline(price, change, index),
      score: scoreFor({ price_change_percentage_24h: change, total_volume: volume }, index)
    };
  }).filter((row) => row.symbol && row.current_price > 0);
  if (!data.length) throw new Error('empty_binance');
  return data;
}

function buildSsi(rows) {
  return rows.map((r, i) => ({
    ...r,
    indexName: `${String(r.symbol || 'ASSET').toUpperCase()} Smart Index`,
    nav: r.current_price,
    change24h: Number(r.price_change_percentage_24h || 0),
    weight: `${Math.max(4, 26 - i * 2)}%`,
    score: scoreFor(r, i)
  }));
}

function buildEtf(rows) {
  return rows.slice(0, 12).map((r, i) => {
    const volume = Number(r.total_volume || 0);
    const change = Number(r.price_change_percentage_24h || 0);
    const netFlow = Math.round(volume * (change >= 0 ? 0.024 : -0.018));
    return {
      title: `${String(r.symbol || 'ETF').toUpperCase()} flow proxy`,
      name: `${String(r.symbol || 'ETF').toUpperCase()} Spot Flow`,
      symbol: String(r.symbol || 'ETF').toUpperCase(),
      current_price: Math.abs(netFlow),
      netFlow,
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

  return (baseRows || []).slice(0, 10).map((row, i) => ({
    title: `${row.name || row.symbol} live market signal: volume and momentum require monitoring`,
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

async function liveMarket() {
  const errors = [];
  try {
    const rows = await coinGeckoMarkets();
    return { source: 'coingecko-live', data: rows, global: await coinGeckoGlobal() };
  } catch (err) {
    errors.push(`coingecko:${err.message}`);
  }

  await sleep(150);
  try {
    const rows = await binanceMarkets();
    return { source: 'binance-live', data: rows, global: null };
  } catch (err) {
    errors.push(`binance:${err.message}`);
  }

  const error = new Error(errors.join(' | ') || 'all_live_sources_failed');
  error.status = 502;
  throw error;
}

async function derivedResource(resource) {
  const market = await liveMarket();
  if (resource === 'market') return market;
  if (resource === 'ssi') return { source: `${market.source}-ssi`, data: buildSsi(market.data), global: market.global };
  if (resource === 'etf') return { source: `${market.source}-etf`, data: buildEtf(market.data), global: market.global };
  if (resource === 'news') return { source: `${market.source}-news`, data: await cryptoNewsSignals(market.data), global: market.global };
  return market;
}

function extractRowsFromSoso(payload) {
  const candidates = [payload?.data?.data, payload?.data?.list, payload?.data?.items, payload?.data?.records, payload?.data, payload?.list, payload?.items, payload?.records, payload];
  for (const item of candidates) {
    if (Array.isArray(item) && item.length) return item;
  }
  return [];
}

async function trySosoValue(resource, reqUrl) {
  const apiKey = env('SOSOVALUE_API_KEY');
  if (!apiKey) throw new Error('no_sosovalue_key');
  const base = trimSlash(env('SOSOVALUE_BASE_URL', 'https://openapi.sosovalue.com/openapi/v1'));
  const path = normalizePath(env(ENV_KEYS[resource], DEFAULT_PATHS[resource]));
  if (!path) throw new Error('no_sosovalue_path');
  const target = new URL(`${base}${path}`);
  for (const [key, value] of reqUrl.searchParams.entries()) {
    if (!['resource', 'debug', 'strict'].includes(key)) target.searchParams.set(key, value);
  }
  const raw = await fetchJson(target, {
    headers: {
      'x-soso-api-key': apiKey,
      'X-SOSO-API-KEY': apiKey,
      Authorization: `Bearer ${apiKey}`
    }
  }, 8500);
  const rows = extractRowsFromSoso(raw);
  if (!rows.length) throw new Error('empty_sosovalue');
  return { source: 'sosovalue', data: rows, raw };
}

export default async function handler(req) {
  const url = new URL(req.url);
  const resource = url.searchParams.get('resource') || 'market';
  const debug = url.searchParams.get('debug') === '1';
  const strict = url.searchParams.get('strict') === '1';

  try {
    let result;
    try {
      result = await trySosoValue(resource, url);
    } catch (sosoError) {
      if (strict) throw sosoError;
      result = await derivedResource(resource);
      result.sosoError = sosoError.message;
    }

    return json({
      ok: true,
      resource,
      source: result.source,
      data: result.data,
      assets: result.data,
      global: result.global || null,
      updatedAt: new Date().toISOString(),
      live: true,
      fallback: result.source !== 'sosovalue',
      ...(debug ? { debug: { rows: result.data.length, sosoError: result.sosoError || null } } : {})
    });
  } catch (err) {
    return json({
      ok: false,
      resource,
      source: 'none',
      error: err.message || 'live_market_failed',
      data: [],
      assets: [],
      updatedAt: new Date().toISOString()
    }, err.status || 502);
  }
}
