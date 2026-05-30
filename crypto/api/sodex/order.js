import { json, readJson, endpointBase, tradingEnv, signSodexAction } from '../_utils.js';

function cleanOrder(input) {
  const order = {
    clOrdID: input.clOrdID || `vp-${Date.now()}`,
    modifier: Number(input.modifier || 1),
    side: Number(input.side || 1),
    type: Number(input.type || (input.price ? 1 : 2)),
    timeInForce: Number(input.timeInForce || (input.price ? 1 : 3))
  };

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

export default async function handler(req) {
  try {
    if (req.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405);
    }

    const { missing, accountID } = tradingEnv();
    if (missing.length) {
      return json({
        ok: false,
        error: 'Trading route is protected until backend signing keys are complete.',
        missing,
        required: ['SODEX_API_KEY_NAME', 'SODEX_API_PRIVATE_KEY'],
        optional: ['SODEX_ACCOUNT_ID']
      }, 400);
    }

    const body = await readJson(req);
    const market = body.market === 'spot' ? 'spot' : 'perps';
    const symbolID = Number(body.symbolID || 1);
    const quantity = String(body.quantity || '').trim();

    if (!symbolID || !quantity) {
      return json({ ok: false, error: 'symbolID and quantity are required' }, 400);
    }

    const params = {
      symbolID,
      orders: [cleanOrder(body)]
    };
    if (accountID) params.accountID = Number(accountID);

    const signed = await signSodexAction({ type: 'newOrder', params, market });
    const path = market === 'spot' ? '/trade/orders/batch' : '/trade/orders';
    const upstream = await fetch(`${endpointBase(market)}${path}`, {
      method: 'POST',
      headers: signed.headers,
      body: JSON.stringify(params)
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return json({ ok: upstream.ok, status: upstream.status, market, data }, upstream.ok ? 200 : upstream.status);
  } catch (error) {
    return json({ ok: false, error: error.message }, error.status || 500);
  }
}
