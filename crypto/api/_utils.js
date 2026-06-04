export function json(res, status = 200) {
  return new Response(JSON.stringify(res), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*'
    }
  });
}

export async function readJson(req) {
  try { return await req.json(); } catch { return {}; }
}

export function env(name, fallback = '') { return process.env[name] || fallback; }
export function trimSlash(value = '') { return String(value).replace(/\/+$/, ''); }
export function normalizePath(value = '') { return !value ? '' : value.startsWith('/') ? value : `/${value}`; }

export function endpointBase(market = 'perps') {
  const network = env('SODEX_NETWORK', 'mainnet');
  if (market === 'spot') return env('SODEX_SPOT_REST_BASE', network === 'testnet' ? 'https://testnet-gw.sodex.dev/api/v1/spot' : 'https://mainnet-gw.sodex.dev/api/v1/spot');
  return env('SODEX_REST_BASE', network === 'testnet' ? 'https://testnet-gw.sodex.dev/api/v1/perps' : 'https://mainnet-gw.sodex.dev/api/v1/perps');
}

export function chainId() {
  const network = env('SODEX_NETWORK', 'mainnet');
  return Number(env('SODEX_CHAIN_ID', network === 'testnet' ? '138565' : '286623'));
}

export function compact(value) { return JSON.stringify(value); }

export function tradingEnv() {
  const apiKeyName = env('SODEX_API_KEY_NAME');
  const privateKey = env('SODEX_API_PRIVATE_KEY');
  const accountID = env('SODEX_ACCOUNT_ID');
  const missing = [];
  if (!apiKeyName) missing.push('SODEX_API_KEY_NAME');
  if (!privateKey) missing.push('SODEX_API_PRIVATE_KEY');
  return { apiKeyName, privateKey, accountID, missing };
}

export async function signSodexAction({ type, params, market }) {
  const { ethers } = await import('ethers');
  const { apiKeyName, privateKey, missing } = tradingEnv();
  if (missing.length) {
    const error = new Error(`Missing ${missing.join(', ')}`);
    error.status = 400;
    throw error;
  }
  const payload = { type, params };
  const payloadHash = ethers.keccak256(ethers.toUtf8Bytes(compact(payload)));
  const nonce = Date.now();
  const wallet = new ethers.Wallet(privateKey);
  const signature = await wallet.signTypedData(
    { name: market === 'spot' ? 'spot' : 'futures', version: '1', chainId: chainId(), verifyingContract: '0x0000000000000000000000000000000000000000' },
    { ExchangeAction: [{ name: 'payloadHash', type: 'bytes32' }, { name: 'nonce', type: 'uint64' }] },
    { payloadHash, nonce }
  );
  return { headers: { 'content-type': 'application/json', accept: 'application/json', 'X-API-Key': apiKeyName, 'X-API-Sign': `0x01${signature.slice(2)}`, 'X-API-Nonce': String(nonce) } };
}
