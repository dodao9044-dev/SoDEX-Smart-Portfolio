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

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const resource = url.searchParams.get('resource') || 'market';
    const apiKey = env('SOSOVALUE_API_KEY');
    const base = trimSlash(env('SOSOVALUE_BASE_URL', 'https://openapi.sosovalue.com/openapi/v1'));

    if (!apiKey) {
      return json({ ok: false, error: 'Missing SOSOVALUE_API_KEY' }, 400);
    }

    const path = normalizePath(env(ENV_KEYS[resource], DEFAULT_PATHS[resource]));
    if (!path) {
      return json({ ok: false, error: `Unknown resource: ${resource}` }, 400);
    }

    const target = new URL(`${base}${path}`);
    for (const [key, value] of url.searchParams.entries()) {
      if (key !== 'resource') target.searchParams.set(key, value);
    }

    const upstream = await fetch(target, {
      headers: {
        accept: 'application/json',
        'x-soso-api-key': apiKey,
        'X-SOSO-API-KEY': apiKey
      }
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return json({ ok: upstream.ok, status: upstream.status, resource, path, data }, upstream.ok ? 200 : upstream.status);
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
}
