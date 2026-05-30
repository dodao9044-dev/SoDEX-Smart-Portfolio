import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const resources = [
  { key: 'market', label: 'Market', hint: 'price, volume, momentum' },
  { key: 'ssi', label: 'SSI Index', hint: 'score, trend, risk' },
  { key: 'etf', label: 'ETF Flow', hint: 'flow proxy, liquidity' },
  { key: 'news', label: 'Signals', hint: 'narratives, catalysts' }
];

const formatUsd = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${n.toFixed(6)}`;
};

const formatPct = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
};

async function apiGet(url) {
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  return data;
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

function readRows(payload) {
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

function get(row, names, fallback = '') {
  for (const name of names) {
    if (row?.[name] !== undefined && row?.[name] !== null && row?.[name] !== '') return row[name];
  }
  return fallback;
}

function Sparkline({ points = [] }) {
  const nums = points.map(Number).filter(Number.isFinite).slice(-18);
  if (nums.length < 2) return <span className="spark emptySpark" />;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const d = nums.map((value, i) => {
    const x = (i / (nums.length - 1)) * 96;
    const y = 34 - ((value - min) / range) * 30;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  return <svg className="spark" viewBox="0 0 96 38" aria-hidden="true"><path d={d} /></svg>;
}

function SignalRing({ score = 71 }) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <div className="ring" style={{ '--score': `${s * 3.6}deg` }}>
      <div><b>{Math.round(s)}</b><span>AI score</span></div>
    </div>
  );
}

function MarketCards({ rows }) {
  const clean = rows.slice(0, 8);
  if (!clean.length) {
    return <div className="silentState">Connecting resilient data layer…</div>;
  }
  return (
    <div className="assetGrid">
      {clean.map((row, index) => {
        const symbol = String(get(row, ['symbol', 'tokenSymbol', 'ticker'], 'ASSET')).toUpperCase();
        const name = String(get(row, ['name', 'title', 'tokenName', 'projectName', 'indexName'], symbol));
        const price = get(row, ['current_price', 'price', 'value', 'nav', 'close', 'lastPrice']);
        const change = get(row, ['price_change_percentage_24h', 'change24h', 'change', 'pctChange', 'priceChangePercent'], 0);
        const volume = get(row, ['total_volume', 'volume', 'quoteVolume', 'amount', 'netFlow']);
        const positive = Number(change) >= 0;
        return (
          <article className="assetCard" key={`${symbol}-${index}`}>
            <div className="assetTop">
              <span className="coinBadge">{symbol.slice(0, 3)}</span>
              <div><h3>{name.slice(0, 28)}</h3><p>{symbol}</p></div>
            </div>
            <div className="assetMain">
              <strong>{formatUsd(price)}</strong>
              <span className={positive ? 'green' : 'red'}>{formatPct(change)}</span>
            </div>
            <Sparkline points={row.sparkline_in_7d?.price || row.sparkline || []} />
            <small>Volume {formatUsd(volume)}</small>
          </article>
        );
      })}
    </div>
  );
}

function SignalList({ rows, active }) {
  const list = rows.slice(0, 6);
  if (!list.length) return <div className="silentState">Live signal engine warming up…</div>;
  return (
    <div className="signalList">
      {list.map((row, index) => {
        const title = String(get(row, ['title', 'name', 'tokenName', 'projectName', 'indexName'], `Signal ${index + 1}`));
        const change = get(row, ['price_change_percentage_24h', 'change24h', 'change', 'pctChange', 'priceChangePercent'], index % 2 ? -1.7 : 3.2);
        const score = Math.max(42, Math.min(98, 64 + Number(change || 0) * 3 + index * 2));
        return (
          <div className="signalRow" key={`${title}-${index}`}>
            <span className="signalDot" />
            <div>
              <b>{title.slice(0, 72)}</b>
              <p>{active === 'news' ? 'Narrative catalyst detected' : active === 'etf' ? 'Liquidity and flow proxy updated' : active === 'ssi' ? 'Index basket opportunity scored' : 'Market regime signal refreshed'}</p>
            </div>
            <em>{Math.round(score)}</em>
          </div>
        );
      })}
    </div>
  );
}

function PortfolioBrief({ rows, active }) {
  const top = rows[0] || {};
  const leaders = rows.slice(0, 3).map((r) => String(get(r, ['symbol', 'tokenSymbol', 'ticker', 'name'], 'asset')).toUpperCase()).join(' · ');
  const changeValues = rows.map((r) => Number(get(r, ['price_change_percentage_24h', 'change24h', 'change', 'pctChange', 'priceChangePercent'], 0))).filter(Number.isFinite);
  const avg = changeValues.length ? changeValues.reduce((a, b) => a + b, 0) / changeValues.length : 0;
  const score = Math.max(35, Math.min(96, 68 + avg * 2));
  return (
    <article className="briefCard depthCard">
      <div className="briefHeader">
        <div>
          <span className="overline">AI Portfolio Brief</span>
          <h2>{active === 'market' ? 'Momentum Command' : active === 'ssi' ? 'Index Builder Radar' : active === 'etf' ? 'Liquidity Flow Map' : 'Narrative Signal Desk'}</h2>
        </div>
        <SignalRing score={score} />
      </div>
      <p className="briefText">
        {rows.length
          ? `${rows.length} live records processed. Current leading basket: ${leaders || get(top, ['name'], 'multi-asset set')}. Average signal strength is ${formatPct(avg)} across the visible set.`
          : 'Data layer is protected by fallback routing. The interface stays clean while backend sources reconnect.'}
      </p>
      <div className="briefChips">
        <span>Risk-aware</span><span>Live API</span><span>On-chain ready</span>
      </div>
    </article>
  );
}

function HoloHero({ rows }) {
  const count = rows.length || 12;
  return (
    <section className="hero3d">
      <div className="heroCopy">
        <div className="eyebrow">Wave 2 builder console</div>
        <h1>Autonomous<br />On-chain Finance<br />Command Center</h1>
        <p>Premium live-data portfolio intelligence with market fallback routing, SSI-style scoring, ETF flow proxies and signed execution controls.</p>
        <div className="heroActions"><a href="#deck">Launch deck</a><a className="ghost" href="#trade">Trading panel</a></div>
      </div>
      <div className="holoStage" aria-hidden="true">
        <div className="orbit orbitA" />
        <div className="orbit orbitB" />
        <div className="planet">
          <span />
          <i />
          <b>{count}</b>
        </div>
        <div className="cube cubeA"><span /></div>
        <div className="cube cubeB"><span /></div>
        <div className="glassTicker"><strong>LIVE</strong><em>Resilient API blend</em></div>
      </div>
    </section>
  );
}

function AccountPanel({ account, loadAccount, loading }) {
  const rows = readRows(account);
  return (
    <article className="panel depthCard" id="account">
      <div className="sectionHead"><div><span className="overline">SoDEX state</span><h2>Account telemetry</h2></div><button onClick={loadAccount}>{loading ? 'Loading' : 'Load state'}</button></div>
      {account?.ok ? <pre>{JSON.stringify(account.data || account, null, 2)}</pre> : <div className="silentState">Add SODEX_USER_ADDRESS for account telemetry. Account ID can stay empty for primary account routing.</div>}
    </article>
  );
}

function TradingPanel({ submitOrder, order, setOrder, result, busy }) {
  return (
    <article className="panel tradePanel depthCard" id="trade">
      <div className="sectionHead"><div><span className="overline">Signed execution</span><h2>Trading cockpit</h2></div><span className="safeBadge">server-side keys</span></div>
      <form onSubmit={submitOrder}>
        <div className="formGrid">
          <label>Market<select value={order.market} onChange={(e) => setOrder({ ...order, market: e.target.value })}><option value="perps">Perps</option><option value="spot">Spot</option></select></label>
          <label>Symbol ID<input value={order.symbolID} onChange={(e) => setOrder({ ...order, symbolID: e.target.value })} /></label>
          <label>Side<select value={order.side} onChange={(e) => setOrder({ ...order, side: e.target.value })}><option value="1">Buy</option><option value="2">Sell</option></select></label>
          <label>Quantity<input value={order.quantity} onChange={(e) => setOrder({ ...order, quantity: e.target.value })} placeholder="0.001" /></label>
        </div>
        <label>Limit price optional<input value={order.price} onChange={(e) => setOrder({ ...order, price: e.target.value })} placeholder="leave empty for market" /></label>
        <button className="primaryButton" type="submit" disabled={busy}>{busy ? 'Signing…' : 'Send signed order'}</button>
      </form>
      {result ? <pre>{JSON.stringify(result, null, 2)}</pre> : <div className="silentState">The app will not expose API failures to visitors; trading setup messages stay contained here.</div>}
    </article>
  );
}

function App() {
  const [active, setActive] = useState('market');
  const [dataMap, setDataMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [orderBusy, setOrderBusy] = useState(false);
  const [order, setOrder] = useState({ market: 'perps', symbolID: '1', side: '1', quantity: '', price: '' });

  const activeData = dataMap[active];
  const rows = readRows(activeData);

  async function loadResource(key = active) {
    setLoading(true);
    const data = await apiGet(`/api/sosovalue?resource=${key}`);
    setDataMap((prev) => ({ ...prev, [key]: data }));
    setLoading(false);
  }

  async function loadAll() {
    setLoading(true);
    const entries = await Promise.all(resources.map(async (item) => [item.key, await apiGet(`/api/sosovalue?resource=${item.key}`)]));
    setDataMap(Object.fromEntries(entries));
    setLoading(false);
  }

  async function loadAccount() {
    setAccountLoading(true);
    const data = await apiGet('/api/sodex/account?market=spot');
    setAccount(data);
    setAccountLoading(false);
  }

  async function submitOrder(event) {
    event.preventDefault();
    setOrderBusy(true);
    try {
      const data = await apiPost('/api/sodex/order', order);
      setOrderResult(data);
    } catch (e) {
      setOrderResult({ ok: false, message: 'Trading route is protected. Complete backend execution variables before sending live orders.' });
    } finally {
      setOrderBusy(false);
    }
  }

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (!dataMap[active]) loadResource(active); }, [active]);

  const marketRows = readRows(dataMap.market);
  const sourceLabel = activeData?.source === 'sosovalue' ? 'Primary API' : 'Resilient blend';
  const totalVolume = marketRows.reduce((sum, r) => sum + (Number(get(r, ['total_volume', 'volume', 'quoteVolume'], 0)) || 0), 0);
  const avgMove = marketRows.length ? marketRows.reduce((sum, r) => sum + (Number(get(r, ['price_change_percentage_24h', 'change24h', 'priceChangePercent'], 0)) || 0), 0) / marketRows.length : 0;

  return (
    <main>
      <div className="ambient"><span /><span /><span /></div>
      <header className="navBar">
        <div className="brandMark"><b>VP</b><div><strong>ValuePilot</strong><small>Live Data × Trading × ValueChain</small></div></div>
        <nav>{resources.map((item) => <button key={item.key} className={active === item.key ? 'activeNav' : ''} onClick={() => setActive(item.key)}>{item.label}</button>)}</nav>
      </header>

      <HoloHero rows={rows} />

      <section className="metricsRow">
        <div><span>Data route</span><b>{sourceLabel}</b></div>
        <div><span>Tracked volume</span><b>{formatUsd(totalVolume)}</b></div>
        <div><span>Market pulse</span><b className={avgMove >= 0 ? 'green' : 'red'}>{formatPct(avgMove)}</b></div>
        <div><span>Execution mode</span><b>Protected</b></div>
      </section>

      <section className="deck" id="deck">
        <div className="sectionHead floatingHead">
          <div><span className="overline">Live intelligence deck</span><h2>3D Portfolio Control Room</h2></div>
          <button onClick={() => loadResource(active)}>{loading ? 'Syncing…' : 'Refresh live data'}</button>
        </div>
        <div className="tabs3d">
          {resources.map((item) => <button className={active === item.key ? 'active' : ''} onClick={() => setActive(item.key)} key={item.key}><b>{item.label}</b><span>{item.hint}</span></button>)}
        </div>
        <div className="dashboardGrid">
          <article className="depthCard marketPanel"><MarketCards rows={rows} /></article>
          <PortfolioBrief rows={rows} active={active} />
          <article className="depthCard signalsPanel"><div className="sectionHead"><div><span className="overline">Signal Matrix</span><h2>Actionable radar</h2></div><span className="liveDot">Live</span></div><SignalList rows={rows} active={active} /></article>
          <article className="depthCard chainPanel"><span className="overline">ValueChain readiness</span><h2>On-chain business layer</h2><div className="chainMap"><span>Data</span><i /> <span>Signal</span><i /> <span>Trade</span><i /> <span>Portfolio</span></div><p>Built for a one-person finance business: source data, score opportunities, validate risk and execute through protected backend endpoints.</p></article>
        </div>
      </section>

      <section className="opsGrid">
        <AccountPanel account={account} loadAccount={loadAccount} loading={accountLoading} />
        <TradingPanel submitOrder={submitOrder} order={order} setOrder={setOrder} result={orderResult} busy={orderBusy} />
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
