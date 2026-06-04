# Live market data fix

This build removes the old hard-coded/local market fallback from the server API path.

`/api/sosovalue?resource=market&debug=1` now returns:

- `source: "sosovalue"` when your SoSoValue key and endpoint work.
- `source: "coingecko-live"` when SoSoValue is unavailable but CoinGecko public market data works.
- `source: "binance-live"` when CoinGecko is unavailable but Binance live 24h ticker works.
- HTTP 502 with an error if all live sources fail.

The response always includes both `data` and `assets` arrays so the React UI can render rows correctly.

Vercel settings:

- Production Branch: `master` or push `main:master`
- Root Directory: `crypto`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install --registry=https://registry.npmjs.org/`

Optional environment variables:

```env
SOSOVALUE_API_KEY=your_real_key
SOSOVALUE_BASE_URL=https://openapi.sosovalue.com/openapi/v1
```
