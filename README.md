# SoDEX Smart Portfolio — Wave 2 SoSoValue-inspired Build

A clean Wave 2 on-chain finance tool rebuilt with a SoSoValue-style research dashboard UI.

## What changed

- SoSoValue-inspired dashboard layout: sticky top nav, market table, heatmap, ticker strip, watchlist rail, ETF/SSI/news tabs.
- More professional crypto-research interface instead of a simple 3D landing page.
- API failures are hidden from the user interface. The backend tries SoSoValue first, then protected free fallback data routes.
- SoDEX trading keys remain server-side.
- `SODEX_ACCOUNT_ID` can stay empty.

## Vercel settings

Deploy from the `crypto` folder:

- Root Directory: `crypto`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install --registry=https://registry.npmjs.org/`
- Development Command: `vite`

## Required environment variables

```env
SOSOVALUE_API_KEY=YOUR_SOSOVALUE_API_KEY
SOSOVALUE_BASE_URL=https://openapi.sosovalue.com/openapi/v1
SOSOVALUE_MARKET_PATH=/token/market/list
SOSOVALUE_NEWS_PATH=/news/list
SOSOVALUE_ETF_PATH=/etf/bitcoin/spot/flow
SOSOVALUE_SSI_PATH=/ssi/index/list

SODEX_USER_ADDRESS=YOUR_WALLET_ADDRESS
SODEX_NETWORK=mainnet
SODEX_REST_BASE=https://mainnet-gw.sodex.dev/api/v1/perps
SODEX_SPOT_REST_BASE=https://mainnet-gw.sodex.dev/api/v1/spot
SODEX_API_KEY_NAME=mandala1321
SODEX_API_PRIVATE_KEY=YOUR_SODEX_API_PRIVATE_KEY
SODEX_CHAIN_ID=286623
SODEX_ACCOUNT_ID=
```

If a SoSoValue endpoint path changes, copy the path after `/openapi/v1` from the official API docs and replace the matching `SOSOVALUE_*_PATH` value.

## Local run

```bash
cd crypto
npm install --registry=https://registry.npmjs.org/
npm run dev
```
