# SoDEX Smart Portfolio — Wave 2 Research Desk

This build upgrades the UI into a full SoSoValue-inspired research terminal while keeping your own branding.

## Highlights

- Custom **ValuePilot** branding with the uploaded logo
- Left navigation rail with real menu interactions
- Search bar, top ticker strip, category tabs, watchlist mode, sorting controls
- Main market table with stars, row selection, sparkline charts, and AI score chips
- Right rail with spotlight tags, sector mover grid, ups/downs distribution, selected asset panel, and news list
- Lower console with account state, signed order panel, and AI brief
- Uses `/api/sosovalue` with fallback routes already hidden from the UI
- Uses `/api/sodex/account` and `/api/sodex/order` for account/trading functions

## Vercel settings

- Root Directory: `crypto`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install --registry=https://registry.npmjs.org/`

## Required environment variables

### For market/research data

- `SOSOVALUE_API_KEY`
- `SOSOVALUE_BASE_URL`
- `SOSOVALUE_MARKET_PATH`
- `SOSOVALUE_NEWS_PATH`
- `SOSOVALUE_ETF_PATH`
- `SOSOVALUE_SSI_PATH`

### For account / signed trading

- `SODEX_USER_ADDRESS`
- `SODEX_API_KEY_NAME`
- `SODEX_API_PRIVATE_KEY`
- `SODEX_NETWORK`
- `SODEX_CHAIN_ID`
- `SODEX_REST_BASE`
- `SODEX_SPOT_REST_BASE`
- Optional: `SODEX_ACCOUNT_ID`
