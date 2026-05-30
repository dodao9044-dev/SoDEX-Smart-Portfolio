import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const tabs = [
  { key: 'market', label: 'Coins', short: 'Live market' },
  { key: 'ssi', label: 'SSI Index', short: 'Index basket' },
  { key: 'etf', label: 'ETF', short: 'Flow board' },
  { key: 'news', label: 'News', short: 'AI feed' }
];

const fmtUsd = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (Math.abs(n) >= 1) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${n.toFixed(6)}`;
};

const fmtNum = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const fmtPct = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00%';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
};

async function requestJson(url, options) {
  const res = await fetch(url, { cache: 'no-store', ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

function rowsFrom(payload) {
  const data = payload?.data?.data ?? payload?.data ?? payload?.fallback?.data ?? payload;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (data && typeof data === 'object') return [data];
  return [];
}

function pick(row, keys, fallback = '') {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') return row[key];
  }
  return fallback;
}

function makePath(points = [], height = 42, width = 112) {
  const nums = points.map(Number).filter(Number.isFinite).slice(-24);
  if (nums.length < 2) return '';
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  return nums.map((v, i) => {
    const x = (i / (nums.length - 1)) * width;
    const y = height - 5 - ((v - min) / range) * (height - 10);
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

function Spark({ row }) {
  const price = Number(pick(row, ['current_price', 'price', 'nav', 'lastPrice'], 1));
  const change = Number(pick(row, ['price_change_percentage_24h', 'change24h', 'change', 'pctChange', 'priceChangePercent'], 0));
  const fallback = Array.from({ length: 18 }, (_, i) => price * (1 + Math.sin(i / 2) * 0.008 + change / 1000 * i));
  const points = row?.sparkline_in_7d?.price || row?.sparkline || fallback;
  const d = makePath(points);
  return <svg className="sparkline" viewBox="0 0 112 42" aria-hidden="true"><path d={d} /></svg>;
}

function MiniBars({ rows }) {
  const list = rows.slice(0, 9);
  return (
    <div className="miniBars">
      {list.map((r, i) => {
        const change = Number(pick(r, ['price_change_percentage_24h', 'change24h', 'change', 'pctChange', 'priceChangePercent'], (i % 2 ? -1 : 1) * (i + 1)));
        const h = Math.max(22, Math.min(100, 42 + Math.abs(change) * 8 + i * 3));
        return <span key={i} className={change >= 0 ? 'upBg' : 'downBg'} style={{ height: `${h}%` }} />;
      })}
    </div>
  );
}

function Heatmap({ rows }) {
  const list = rows.slice(0, 12);
  if (!list.length) return <div className="emptySoft">Loading market heatmap...</div>;
  return (
    <div className="heatmap">
      {list.map((r, i) => {
        const symbol = String(pick(r, ['symbol', 'tokenSymbol', 'ticker'], `A${i}`)).toUpperCase();
        const change = Number(pick(r, ['price_change_percentage_24h', 'change24h', 'change', 'pctChange', 'priceChangePercent'], 0));
        return <div key={`${symbol}-${i}`} className={change >= 0 ? 'heat upCell' : 'heat downCell'}><b>{symbol.slice(0, 5)}</b><span>{fmtPct(change)}</span></div>;
      })}
    </div>
  );
}

function Header({ active, setActive }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brandMark">S</span>
        <div><b>ValuePilot</b><small>Crypto investment research console</small></div>
      </div>
      <nav>
        {tabs.map(t => <button key={t.key} className={active === t.key ? 'active' : ''} onClick={() => setActive(t.key)}>{t.label}</button>)}
      </nav>
      <div className="actions"><button>Watchlist</button><button className="primary">Connect</button></div>
    </header>
  );
}

function Hero({ stats, refresh, loading }) {
  return (
    <section className="hero officialCard">
      <div className="heroText">
        <div className="pillLine"><span /> WAVE 2 FINANCE TOOL</div>
        <h1>AI-powered crypto research, index screening and execution.</h1>
        <p>Track live markets, ETF flow proxies, news catalysts and SSI-style scores in a SoSoValue-inspired trading research dashboard.</p>
        <div className="heroButtons"><button className="primary" onClick={refresh}>{loading ? 'Refreshing...' : 'Refresh data'}</button><a href="#table">Explore market</a></div>
      </div>
      <div className="heroPanel">
        <div className="orbital"><i /><span /><b>{stats.assets}</b></div>
        <div className="heroStats">
          <div><small>Market cap</small><b>{fmtUsd(stats.marketCap)}</b></div>
          <div><small>24h volume</small><b>{fmtUsd(stats.volume)}</b></div>
          <div><small>Pulse</small><b className={stats.avg >= 0 ? 'up' : 'down'}>{fmtPct(stats.avg)}</b></div>
        </div>
      </div>
    </section>
  );
}

function SummaryStrip({ rows, source }) {
  const btc = rows.find(r => String(pick(r, ['symbol'], '')).toLowerCase() === 'btc' || String(pick(r, ['id'], '')).toLowerCase() === 'bitcoin') || rows[0] || {};
  const eth = rows.find(r => String(pick(r, ['symbol'], '')).toLowerCase() === 'eth' || String(pick(r, ['id'], '')).toLowerCase() === 'ethereum') || rows[1] || {};
  const totalVol = rows.reduce((s, r) => s + Number(pick(r, ['total_volume', 'volume', 'quoteVolume', 'amount'], 0)), 0);
  return (
    <section className="tickerStrip officialCard">
      <div><small>BTC Price</small><b>{fmtUsd(pick(btc, ['current_price', 'price', 'lastPrice']))}</b><span className={Number(pick(btc, ['price_change_percentage_24h', 'change24h'], 0)) >= 0 ? 'up' : 'down'}>{fmtPct(pick(btc, ['price_change_percentage_24h', 'change24h'], 0))}</span></div>
      <div><small>ETH Price</small><b>{fmtUsd(pick(eth, ['current_price', 'price', 'lastPrice']))}</b><span className={Number(pick(eth, ['price_change_percentage_24h', 'change24h'], 0)) >= 0 ? 'up' : 'down'}>{fmtPct(pick(eth, ['price_change_percentage_24h', 'change24h'], 0))}</span></div>
      <div><small>Tracked Volume</small><b>{fmtUsd(totalVol)}</b><span>24h</span></div>
      <div><small>Data Route</small><b>{source.includes('sosovalue') ? 'Primary' : 'Protected'}</b><span>{source.replace('fallback-', '')}</span></div>
    </section>
  );
}

function MarketTable({ rows, active }) {
  if (!rows.length) return <div className="emptySoft big">Live data is warming up. Fallback routes will keep the interface quiet.</div>;
  return (
    <div className="tableShell officialCard" id="table">
      <div className="tableHead"><h2>{active === 'news' ? 'Latest market intelligence' : active === 'etf' ? 'ETF flow dashboard' : active === 'ssi' ? 'SSI index opportunities' : 'Cryptocurrency prices by market cap'}</h2><span>{rows.length} rows</span></div>
      <table>
        <thead><tr><th>#</th><th>Name</th><th>Price / NAV</th><th>24h</th><th>Volume / Flow</th><th>7D Chart</th><th>Score</th></tr></thead>
        <tbody>
          {rows.slice(0, 12).map((row, i) => {
            const symbol = String(pick(row, ['symbol', 'tokenSymbol', 'ticker'], active === 'news' ? 'NEWS' : 'IDX')).toUpperCase();
            const name = String(pick(row, ['name', 'title', 'tokenName', 'projectName', 'indexName'], symbol));
            const price = pick(row, ['current_price', 'price', 'value', 'nav', 'close', 'lastPrice', 'netFlow']);
            const change = Number(pick(row, ['price_change_percentage_24h', 'change24h', 'change', 'pctChange', 'priceChangePercent'], 0));
            const volume = pick(row, ['total_volume', 'volume', 'quoteVolume', 'amount', 'netFlow', 'market_cap']);
            const score = Number(pick(row, ['score'], Math.max(55, Math.min(96, 70 + change * 2 + i))));
            return (
              <tr key={`${symbol}-${i}`}>
                <td className="muted">{i + 1}</td>
                <td><div className="coinName"><span>{symbol.slice(0, 3)}</span><div><b>{name.slice(0, 68)}</b><small>{symbol}</small></div></div></td>
                <td><b>{active === 'news' ? 'Signal' : fmtUsd(price)}</b></td>
                <td className={change >= 0 ? 'up' : 'down'}>{fmtPct(change)}</td>
                <td>{fmtUsd(volume)}</td>
                <td><Spark row={row} /></td>
                <td><em className="score">{Math.round(score)}</em></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RightRail({ rows, active }) {
  const leaders = rows.slice(0, 5);
  return (
    <aside className="rightRail">
      <section className="officialCard railCard">
        <div className="cardTitle"><h3>Market heatmap</h3><span>24h</span></div>
        <Heatmap rows={rows} />
      </section>
      <section className="officialCard railCard">
        <div className="cardTitle"><h3>AI Brief</h3><span>Live</span></div>
        <p className="brief">{leaders.length ? `Leading symbols: ${leaders.map(r => String(pick(r, ['symbol', 'tokenSymbol', 'ticker', 'name'], 'ASSET')).toUpperCase()).join(', ')}. Dashboard routes through primary API first, then free market data if needed.` : 'Connect data to generate a market brief.'}</p>
        <MiniBars rows={rows} />
      </section>
      <section className="officialCard railCard">
        <div className="cardTitle"><h3>{active === 'news' ? 'Signal feed' : 'Watchlist movers'}</h3><span>Top</span></div>
        <div className="watchRows">
          {leaders.map((r, i) => {
            const name = String(pick(r, ['symbol', 'tokenSymbol', 'ticker', 'name', 'title'], `Asset ${i + 1}`)).toUpperCase();
            const ch = Number(pick(r, ['price_change_percentage_24h', 'change24h', 'change'], 0));
            return <div key={i}><span>{name.slice(0, 16)}</span><b className={ch >= 0 ? 'up' : 'down'}>{fmtPct(ch)}</b></div>;
          })}
        </div>
      </section>
    </aside>
  );
}

function AccountBox({ account, loadAccount, loading }) {
  return (
    <section className="officialCard accountBox">
      <div className="cardTitle"><h3>Account State</h3><button onClick={loadAccount}>{loading ? 'Loading...' : 'Load'}</button></div>
      {account ? <pre>{JSON.stringify(account.data || account, null, 2)}</pre> : <div className="emptySoft">Set SODEX_USER_ADDRESS to query account state. Account ID is optional for primary account routing.</div>}
    </section>
  );
}

function OrderBox({ order, setOrder, submitOrder, result, busy }) {
  return (
    <section className="officialCard orderBox">
      <div className="cardTitle"><h3>Signed Order</h3><span>Server-side key</span></div>
      <form onSubmit={submitOrder}>
        <label>Market<select value={order.market} onChange={e => setOrder({ ...order, market: e.target.value })}><option value="perps">Perps</option><option value="spot">Spot</option></select></label>
        <label>Symbol ID<input value={order.symbolID} onChange={e => setOrder({ ...order, symbolID: e.target.value })} /></label>
        <label>Side<select value={order.side} onChange={e => setOrder({ ...order, side: e.target.value })}><option value="1">Buy</option><option value="2">Sell</option></select></label>
        <label>Quantity<input value={order.quantity} onChange={e => setOrder({ ...order, quantity: e.target.value })} placeholder="0.001" /></label>
        <label className="wide">Limit price optional<input value={order.price} onChange={e => setOrder({ ...order, price: e.target.value })} placeholder="leave blank for market" /></label>
        <button className="primary wide" disabled={busy}>{busy ? 'Sending...' : 'Send signed order'}</button>
      </form>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </section>
  );
}

function App() {
  const [active, setActive] = useState('market');
  const [payloads, setPayloads] = useState({});
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [order, setOrder] = useState({ market: 'perps', symbolID: '1', side: '1', quantity: '0.001', price: '' });

  async function refresh() {
    setLoading(true);
    const next = {};
    await Promise.all(tabs.map(async (t) => {
      try { next[t.key] = await requestJson(`/api/sosovalue?resource=${t.key}`); }
      catch { next[t.key] = { ok: true, data: [] }; }
    }));
    setPayloads(next);
    setLoading(false);
  }

  async function loadAccount() {
    setAccountLoading(true);
    try { setAccount(await requestJson('/api/sodex/account')); }
    catch (e) { setAccount({ status: 'setup-needed', message: 'Set SODEX_USER_ADDRESS and SoDEX API env in Vercel for account telemetry.' }); }
    setAccountLoading(false);
  }

  async function submitOrder(e) {
    e.preventDefault();
    setOrderBusy(true);
    try {
      setOrderResult(await requestJson('/api/sodex/order', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(order) }));
    } catch (e) {
      setOrderResult({ status: 'setup-needed', message: 'Trading action needs SODEX_API_KEY_NAME and SODEX_API_PRIVATE_KEY in Vercel. Account ID is optional.' });
    }
    setOrderBusy(false);
  }

  useEffect(() => { refresh(); }, []);
  const rows = rowsFrom(payloads[active]);
  const marketRows = rowsFrom(payloads.market);
  const stats = useMemo(() => {
    const sourceRows = marketRows.length ? marketRows : rows;
    const marketCap = sourceRows.reduce((s, r) => s + Number(pick(r, ['market_cap', 'marketCap'], 0)), 0);
    const volume = sourceRows.reduce((s, r) => s + Number(pick(r, ['total_volume', 'volume', 'quoteVolume', 'amount'], 0)), 0);
    const changes = sourceRows.map(r => Number(pick(r, ['price_change_percentage_24h', 'change24h', 'change', 'priceChangePercent'], 0))).filter(Number.isFinite);
    const avg = changes.length ? changes.reduce((a, b) => a + b, 0) / changes.length : 0;
    return { assets: sourceRows.length, marketCap, volume, avg };
  }, [rows, marketRows]);
  const source = payloads[active]?.source || 'protected';

  return (
    <main>
      <Header active={active} setActive={setActive} />
      <Hero stats={stats} refresh={refresh} loading={loading} />
      <SummaryStrip rows={marketRows.length ? marketRows : rows} source={source} />
      <section className="workspace">
        <div className="leftColumn">
          <div className="tabPanel officialCard">
            <div className="tabButtons">{tabs.map(t => <button key={t.key} className={active === t.key ? 'active' : ''} onClick={() => setActive(t.key)}><b>{t.label}</b><small>{t.short}</small></button>)}</div>
          </div>
          <MarketTable rows={rows} active={active} />
          <section className="tradeGrid" id="trade"><AccountBox account={account} loadAccount={loadAccount} loading={accountLoading} /><OrderBox order={order} setOrder={setOrder} submitOrder={submitOrder} result={orderResult} busy={orderBusy} /></section>
        </div>
        <RightRail rows={rows.length ? rows : marketRows} active={active} />
      </section>
      <footer>Wave 2 builder tool · server-side API keys · protected data fallback</footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
