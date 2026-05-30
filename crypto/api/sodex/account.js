import { json, env, endpointBase } from '../_utils.js';

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const market = url.searchParams.get('market') === 'spot' ? 'spot' : 'perps';
    const userAddress = env('SODEX_USER_ADDRESS') || env('SODEX_WALLET_ADDRESS');
    const accountID = env('SODEX_ACCOUNT_ID');

    if (!userAddress) {
      return json({
        ok: false,
        error: 'Missing SODEX_USER_ADDRESS',
        hint: 'Add your master wallet/user EVM address as SODEX_USER_ADDRESS to query account state.'
      }, 400);
    }

    const target = new URL(`${endpointBase(market)}/accounts/${userAddress}/state`);
    if (accountID) target.searchParams.set('accountID', accountID);

    const upstream = await fetch(target, { headers: { accept: 'application/json' } });
    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return json({ ok: upstream.ok, status: upstream.status, market, data }, upstream.ok ? 200 : upstream.status);
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
}
