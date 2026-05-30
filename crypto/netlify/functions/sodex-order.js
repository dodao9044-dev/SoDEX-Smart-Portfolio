import { ethers } from 'ethers';
const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) });
function endpointBase(market = 'perps') {
  const network = process.env.SODEX_NETWORK || 'mainnet';
  if (market === 'spot') return process.env.SODEX_SPOT_REST_BASE || (network === 'testnet' ? 'https://testnet-gw.sodex.dev/api/v1/spot' : 'https://mainnet-gw.sodex.dev/api/v1/spot');
  return process.env.SODEX_REST_BASE || (network === 'testnet' ? 'https://testnet-gw.sodex.dev/api/v1/perps' : 'https://mainnet-gw.sodex.dev/api/v1/perps');
}
function chainId() { return Number(process.env.SODEX_CHAIN_ID || ((process.env.SODEX_NETWORK || 'mainnet') === 'testnet' ? '138565' : '286623')); }
function requireTradingEnv() {
  const apiKeyName = process.env.SODEX_API_KEY_NAME;
  const privateKey = process.env.SODEX_API_PRIVATE_KEY;
  const accountID = process.env.SODEX_ACCOUNT_ID;
  const missing = [];
  if (!apiKeyName) missing.push('SODEX_API_KEY_NAME');
  if (!privateKey) missing.push('SODEX_API_PRIVATE_KEY');
  return { apiKeyName, privateKey, accountID, missing };
}
function cleanOrder(input) {
  const order = { clOrdID: input.clOrdID || `vp-${Date.now()}`, modifier: Number(input.modifier || 1), side: Number(input.side || 1), type: Number(input.type || (input.price ? 1 : 2)), timeInForce: Number(input.timeInForce || (input.price ? 1 : 3)) };
  if (input.price) order.price = String(input.price);
  if (input.quantity) order.quantity = String(input.quantity);
  if (input.funds) order.funds = String(input.funds);
  if (input.stopPrice) order.stopPrice = String(input.stopPrice);
  if (input.stopType) order.stopType = Number(input.stopType);
  if (input.triggerType) order.triggerType = Number(input.triggerType);
  order.reduceOnly = Boolean(input.reduceOnly || false);
  order.positionSide = Number(input.positionSide || 1);
  return order;
}
async function signAction({ type, params, market, apiKeyName, privateKey }) {
  const payloadHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({ type, params })));
  const nonce = Date.now();
  const wallet = new ethers.Wallet(privateKey);
  const signature = await wallet.signTypedData(
    { name: market === 'spot' ? 'spot' : 'futures', version: '1', chainId: chainId(), verifyingContract: '0x0000000000000000000000000000000000000000' },
    { ExchangeAction: [{ name: 'payloadHash', type: 'bytes32' }, { name: 'nonce', type: 'uint64' }] },
    { payloadHash, nonce }
  );
  return { 'content-type': 'application/json', accept: 'application/json', 'X-API-Key': apiKeyName, 'X-API-Sign': `0x01${signature.slice(2)}`, 'X-API-Nonce': String(nonce) };
}

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
    const { apiKeyName, privateKey, accountID, missing } = requireTradingEnv();
    if (missing.length) return json(400, { ok: false, error: 'Trading route is protected until backend signing keys are complete.', missing, required: ['SODEX_API_KEY_NAME', 'SODEX_API_PRIVATE_KEY'], optional: ['SODEX_ACCOUNT_ID'] });
    const body = event.body ? JSON.parse(event.body) : {};
    const market = body.market === 'spot' ? 'spot' : 'perps';
    const symbolID = Number(body.symbolID || 1);
    const quantity = String(body.quantity || '').trim();
    if (!symbolID || !quantity) return json(400, { ok: false, error: 'symbolID and quantity are required' });
    const params = { symbolID, orders: [cleanOrder(body)] };
    if (accountID) params.accountID = Number(accountID);
    const headers = await signAction({ type: 'newOrder', params, market, apiKeyName, privateKey });
    const path = market === 'spot' ? '/trade/orders/batch' : '/trade/orders';
    const upstream = await fetch(`${endpointBase(market)}${path}`, { method: 'POST', headers, body: JSON.stringify(params) });
    const text = await upstream.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return json(upstream.ok ? 200 : upstream.status, { ok: upstream.ok, status: upstream.status, market, data });
  } catch (error) {
    return json(500, { ok: false, error: error.message });
  }
}
