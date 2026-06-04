const json = (statusCode, body) => ({ statusCode, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) });
function endpointBase(market = 'perps') {
  const network = process.env.SODEX_NETWORK || 'mainnet';
  if (market === 'spot') return process.env.SODEX_SPOT_REST_BASE || (network === 'testnet' ? 'https://testnet-gw.sodex.dev/api/v1/spot' : 'https://mainnet-gw.sodex.dev/api/v1/spot');
  return process.env.SODEX_REST_BASE || (network === 'testnet' ? 'https://testnet-gw.sodex.dev/api/v1/perps' : 'https://mainnet-gw.sodex.dev/api/v1/perps');
}

export async function handler(event) {
  try {
    const params = new URLSearchParams(event.rawQuery || '');
    const market = params.get('market') === 'spot' ? 'spot' : 'perps';
    const userAddress = process.env.SODEX_USER_ADDRESS || process.env.SODEX_WALLET_ADDRESS;
    const accountID = process.env.SODEX_ACCOUNT_ID;
    if (!userAddress) return json(400, { ok: false, error: 'Missing SODEX_USER_ADDRESS', hint: 'Add your master wallet/user EVM address as SODEX_USER_ADDRESS to query account state.' });
    const target = new URL(`${endpointBase(market)}/accounts/${userAddress}/state`);
    if (accountID) target.searchParams.set('accountID', accountID);
    const upstream = await fetch(target, { headers: { accept: 'application/json' } });
    const text = await upstream.text();
    let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return json(upstream.ok ? 200 : upstream.status, { ok: upstream.ok, status: upstream.status, market, data });
  } catch (error) {
    return json(500, { ok: false, error: error.message });
  }
}
