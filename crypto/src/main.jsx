import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const resources = [
  { key: 'market', label: 'Market' },
  { key: 'news', label: 'News' },
  { key: 'etf', label: 'ETF Flow' },
  { key: 'ssi', label: 'SSI' }
];

async function apiGet(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function readRows(payload) {
  const data = payload?.data?.data ?? payload?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.data)) return data.data;
  if (data && typeof data === 'object') return [data];
  return [];
}

function pick(row, names) {
  for (const name of names) {
    if (row?.[name] !== undefined && row?.[name] !== null && row?.[name] !== '') return row[name];
  }
  return '-';
}

function MiniTable({ data }) {
  const rows = readRows(data).slice(0, 8);
  if (!rows.length) return <div className="empty">No rows returned.</div>;

  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Symbol</th>
            <th>Price / Value</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>{String(pick(row, ['name', 'title', 'tokenName', 'projectName', 'indexName'])).slice(0, 60)}</td>
              <td>{String(pick(row, ['symbol', 'tokenSymbol', 'ticker'])).slice(0, 18)}</td>
              <td>{String(pick(row, ['price', 'value', 'nav', 'close', 'amount', 'netFlow'])).slice(0, 22)}</td>
              <td>{String(pick(row, ['change24h', 'change', 'pctChange', 'priceChangePercent'])).slice(0, 22)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JsonBlock({ value }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

function Status({ loading, error }) {
  if (loading) return <span className="pill">Loading</span>;
  if (error) return <span className="pill danger">{error}</span>;
  return <span className="pill ok">Live</span>;
}

function App() {
  const [active, setActive] = useState('market');
  const [marketData, setMarketData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [account, setAccount] = useState(null);
  const [accountError, setAccountError] = useState('');
  const [orderResult, setOrderResult] = useState(null);
  const [orderError, setOrderError] = useState('');
  const [order, setOrder] = useState({ market: 'perps', symbolID: '1', side: '1', quantity: '', price: '' });

  const activeData = marketData[active];

  async function loadResource(key = active) {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet(`/api/sosovalue?resource=${key}`);
      setMarketData((prev) => ({ ...prev, [key]: data }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAccount() {
    setAccountError('');
    setAccount(null);
    try {
      const data = await apiGet('/api/sodex/account?market=spot');
      setAccount(data);
    } catch (e) {
      setAccountError(e.message);
    }
  }

  async function submitOrder(event) {
    event.preventDefault();
    setOrderResult(null);
    setOrderError('');
    try {
      const data = await apiPost('/api/sodex/order', order);
      setOrderResult(data);
    } catch (e) {
      setOrderError(e.message);
    }
  }

  useEffect(() => { loadResource(active); }, [active]);

  const insight = useMemo(() => {
    const rows = readRows(activeData);
    if (!rows.length) return 'Connect API data to generate live portfolio context.';
    return `Live ${active} feed returned ${rows.length} record(s). Use this as the input layer for portfolio screening, news monitoring and execution checks.`;
  }, [activeData, active]);

  return (
    <main>
      <section className="hero">
        <div>
          <div className="eyebrow">Wave 2 finance tool</div>
          <h1>Smart Portfolio Console</h1>
          <p>Clean live-data dashboard for market intelligence, SSI screening, ETF flow checks and signed trading actions.</p>
        </div>
        <button onClick={() => loadResource(active)}>Refresh</button>
      </section>

      <section className="grid top">
        <article className="card wide">
          <div className="cardHead">
            <h2>Live Data</h2>
            <Status loading={loading} error={error} />
          </div>
          <div className="tabs">
            {resources.map((item) => <button className={active === item.key ? 'active' : ''} onClick={() => setActive(item.key)} key={item.key}>{item.label}</button>)}
          </div>
          <MiniTable data={activeData} />
        </article>

        <article className="card">
          <h2>AI Portfolio Brief</h2>
          <p className="brief">{insight}</p>
          <ul>
            <li>Screen assets by live market data.</li>
            <li>Use news and ETF flow as risk signals.</li>
            <li>Send orders only after backend env is complete.</li>
          </ul>
        </article>
      </section>

      <section className="grid">
        <article className="card">
          <div className="cardHead">
            <h2>Account State</h2>
            <button onClick={loadAccount}>Load</button>
          </div>
          {accountError && <div className="notice danger">{accountError}</div>}
          {account ? <JsonBlock value={account} /> : <div className="empty">Set SODEX_USER_ADDRESS to query account state. SODEX_ACCOUNT_ID is optional for primary account queries.</div>}
        </article>

        <article className="card">
          <h2>Signed Order</h2>
          <form onSubmit={submitOrder}>
            <label>Market<select value={order.market} onChange={(e) => setOrder({ ...order, market: e.target.value })}><option value="perps">Perps</option><option value="spot">Spot</option></select></label>
            <label>Symbol ID<input value={order.symbolID} onChange={(e) => setOrder({ ...order, symbolID: e.target.value })} /></label>
            <label>Side<select value={order.side} onChange={(e) => setOrder({ ...order, side: e.target.value })}><option value="1">Buy</option><option value="2">Sell</option></select></label>
            <label>Quantity<input value={order.quantity} onChange={(e) => setOrder({ ...order, quantity: e.target.value })} placeholder="0.001" /></label>
            <label>Price optional<input value={order.price} onChange={(e) => setOrder({ ...order, price: e.target.value })} placeholder="leave empty for market" /></label>
            <button type="submit">Send signed order</button>
          </form>
          {orderError && <div className="notice danger">{orderError}</div>}
          {orderResult && <JsonBlock value={orderResult} />}
        </article>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
