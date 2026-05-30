# SoDEX Smart Portfolio — Wave 2 Clean Build

This repository is rebuilt as a minimal Wave 2 on-chain finance tool.

Deploy from the `crypto` folder.

## Vercel settings

- Root Directory: `crypto`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install --registry=https://registry.npmjs.org/`

## Netlify settings

- Base directory: `crypto`
- Build command: `npm run build`
- Publish directory: `crypto/dist` or `dist` if base directory is already `crypto`
- Functions directory: `crypto/netlify/functions` or `netlify/functions` if base directory is already `crypto`

## Required environment variables

```env
SOSOVALUE_API_KEY=your_sosovalue_api_key
SOSOVALUE_BASE_URL=https://openapi.sosovalue.com/openapi/v1
SOSOVALUE_MARKET_PATH=/token/market/list
SOSOVALUE_NEWS_PATH=/news/list
SOSOVALUE_ETF_PATH=/etf/bitcoin/spot/flow
SOSOVALUE_SSI_PATH=/ssi/index/list

SODEX_NETWORK=mainnet
SODEX_REST_BASE=https://mainnet-gw.sodex.dev/api/v1/perps
SODEX_SPOT_REST_BASE=https://mainnet-gw.sodex.dev/api/v1/spot
SODEX_API_KEY_NAME=your_sodex_api_key_name
SODEX_API_PRIVATE_KEY=your_sodex_private_key
SODEX_CHAIN_ID=286623
SODEX_ACCOUNT_ID=
```

`SODEX_ACCOUNT_ID` is optional in this build.

## Contributors

- [**td28101-arch**](https://github.com/td28101-arch)
