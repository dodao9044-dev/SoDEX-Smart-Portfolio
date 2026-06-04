# API live-data fix

This version removes the hard-coded/local fake market fallback from the UI and API.

## What changed
- `/api/sosovalue?resource=market` now tries SoSoValue first when `SOSOVALUE_API_KEY` is set.
- If SoSoValue fails, it uses live public market data from CoinGecko, then Binance.
- If all live APIs fail, it returns an error instead of fake hard-coded prices.
- Add `?strict=1` to test SoSoValue only.
- Add `?debug=1` to see why SoSoValue failed while still allowing live fallback.

## Vercel env needed
Set these in Vercel → Project → Settings → Environment Variables:

```env
SOSOVALUE_API_KEY=your_real_key
SOSOVALUE_BASE_URL=https://openapi.sosovalue.com/openapi/v1
SOSOVALUE_MARKET_PATH=/token/market/list
SOSOVALUE_NEWS_PATH=/news/list
SOSOVALUE_ETF_PATH=/etf/bitcoin/spot/flow
SOSOVALUE_SSI_PATH=/ssi/index/list
```

Then redeploy.

## Test URLs
- Live market fallback allowed: `/api/sosovalue?resource=market&debug=1`
- SoSoValue only: `/api/sosovalue?resource=market&strict=1`

Expected live responses show one of:
- `source: "sosovalue"` with `fallback: false`
- `source: "coingecko-live"` with `fallback: true`
- `source: "binance-live"` with `fallback: true`

If you see `source: "none"`, no live API was reachable.
