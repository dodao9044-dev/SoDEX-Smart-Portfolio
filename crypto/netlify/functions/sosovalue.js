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
const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) });
const trimSlash = (v = '') => String(v).replace(/\/+$/, '');
const normalizePath = (v = '') => !v ? '' : v.startsWith('/') ? v : `/${v}`;

export async function handler(event) {
  try {
    const params = new URLSearchParams(event.rawQuery || '');
    const resource = params.get('resource') || 'market';
    const apiKey = process.env.SOSOVALUE_API_KEY;
    const base = trimSlash(process.env.SOSOVALUE_BASE_URL || 'https://openapi.sosovalue.com/openapi/v1');
    if (!apiKey) return json(400, { ok: false, error: 'Missing SOSOVALUE_API_KEY' });
    const path = normalizePath(process.env[ENV_KEYS[resource]] || DEFAULT_PATHS[resource]);
    if (!path) return json(400, { ok: false, error: `Unknown resource: ${resource}` });
    const target = new URL(`${base}${path}`);
    for (const [key, value] of params.entries()) if (key !== 'resource') target.searchParams.set(key, value);
    const upstream = await fetch(target, { headers: { accept: 'application/json', 'x-soso-api-key': apiKey, 'X-SOSO-API-KEY': apiKey } });
    const text = await upstream.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return json(upstream.ok ? 200 : upstream.status, { ok: upstream.ok, status: upstream.status, resource, path, data });
  } catch (error) {
    return json(500, { ok: false, error: error.message });
  }
}
