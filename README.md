# SoDEX Smart Portfolio — Wave 2 Research Desk

This build is a branded crypto research terminal with SoSoValue-style information density and your own ValuePilot branding.

## What changed in this fallback-safe version

- `crypto/api/sosovalue.js` now uses a resilient data route:
  1. SoSoValue API if key/path works
  2. CoinGecko free public API if SoSoValue fails
  3. Binance public ticker if CoinGecko fails
  4. Local resilience dataset so the UI never becomes blank
- Same fallback logic added to `crypto/netlify/functions/sosovalue.js`.
- Raw API errors are not displayed in the interface.
- Market, SSI, ETF and News tabs always receive rows.
- `api/_utils.js` now imports `ethers` only when signing an order, so market data routes are lighter.

## Vercel settings

- Root Directory: `crypto`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install --registry=https://registry.npmjs.org/`

## Environment variables

### Optional but recommended for SoSoValue

```env
SOSOVALUE_API_KEY=YOUR_SOSOVALUE_KEY
SOSOVALUE_BASE_URL=https://openapi.sosovalue.com/openapi/v1
SOSOVALUE_MARKET_PATH=/token/market/list
SOSOVALUE_NEWS_PATH=/news/list
SOSOVALUE_ETF_PATH=/etf/bitcoin/spot/flow
SOSOVALUE_SSI_PATH=/ssi/index/list
```

If these are wrong or rate limited, the app automatically uses free fallback data.

### Required only for SoDEX account/order actions

```env
SODEX_USER_ADDRESS=YOUR_WALLET_ADDRESS
SODEX_NETWORK=mainnet
SODEX_REST_BASE=https://mainnet-gw.sodex.dev/api/v1/perps
SODEX_SPOT_REST_BASE=https://mainnet-gw.sodex.dev/api/v1/spot
SODEX_API_KEY_NAME=YOUR_SODEX_API_KEY_NAME
SODEX_API_PRIVATE_KEY=YOUR_SODEX_API_PRIVATE_KEY
SODEX_CHAIN_ID=286623
SODEX_ACCOUNT_ID=
```

`SODEX_ACCOUNT_ID` can stay blank if you do not have it. Signed trading will remain protected until required signing keys are configured.
