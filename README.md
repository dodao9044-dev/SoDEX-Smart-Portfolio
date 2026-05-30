# SoDEX Smart Portfolio — Wave 2 3D Pro Build

Premium 3D on-chain finance console for WaveHack 2nd Wave.

## What changed

- 3D holographic UI with portfolio cards, signal radar, ValueChain readiness layer and trading cockpit.
- Live primary API support through server-side SoSoValue proxy.
- Resilient fallback routing: if the primary data API is missing, rate-limited, or unavailable, the backend silently fills the UI from free public market sources.
- No raw API error text shown in the public interface.
- Minimal dependencies for fast Vercel deploy.
- API keys stay server-side only.

## Vercel settings

- Root Directory: `crypto`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install --registry=https://registry.npmjs.org/`

## Environment variables

```env
SOSOVALUE_API_KEY=YOUR_SOSOVALUE_KEY
SOSOVALUE_BASE_URL=https://openapi.sosovalue.com/openapi/v1
SOSOVALUE_MARKET_PATH=/token/market/list
SOSOVALUE_NEWS_PATH=/news/list
SOSOVALUE_ETF_PATH=/etf/bitcoin/spot/flow
SOSOVALUE_SSI_PATH=/ssi/index/list

SODEX_USER_ADDRESS=YOUR_WALLET_ADDRESS
SODEX_NETWORK=mainnet
SODEX_REST_BASE=https://mainnet-gw.sodex.dev/api/v1/perps
SODEX_SPOT_REST_BASE=https://mainnet-gw.sodex.dev/api/v1/spot
SODEX_API_KEY_NAME=YOUR_SODEX_API_KEY_NAME
SODEX_API_PRIVATE_KEY=YOUR_SODEX_API_PRIVATE_KEY
SODEX_CHAIN_ID=286623
SODEX_ACCOUNT_ID=
```

`SODEX_ACCOUNT_ID` is optional in this build. Leave it blank if you cannot find it.
