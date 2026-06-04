import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const fmtMoney = (v) => {
  const n = Number(v || 0);
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(2)}K`;
  if (n >= 1) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${n.toFixed(6)}`;
};
const pct = (v) => `${Number(v || 0) >= 0 ? '+' : ''}${Number(v || 0).toFixed(2)}%`;

function Spark({ data = [] }) {
  const points = data.slice(-24).map(Number).filter(Number.isFinite);
  if (points.length < 2) return <span className="muted">—</span>;
  const min = Math.min(...points), max = Math.max(...points);
  const d = points.map((p, i) => {
    const x = (i / (points.length - 1)) * 110;
    const y = 36 - ((p - min) / Math.max(0.000001, max - min)) * 32;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return <svg className="spark" viewBox="0 0 110 42"><polyline points={d} /></svg>;
}

function App() {
  const [assets, setAssets] = useState([]);
  const [global, setGlobal] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('marketCap');
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const r = await fetch(`/api/sosovalue?resource=market&t=${Date.now()}`, { cache: 'no-store' });
      const p = await r.json();
      const rows = p?.assets || p?.data?.assets || [];
      if (!r.ok || !Array.isArray(rows) || rows.length === 0) throw new Error(p?.message || p?.error || 'No live rows returned');
      setAssets(rows);
      setGlobal(p.global || {});
      setSelected(rows[0]);
    } catch (e) {
      setAssets([]); setSelected(null); setErr(e.message || 'Cannot load live data');
      setGlobal({});
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = assets.filter(x => !term || x.symbol.toLowerCase().includes(term) || x.name.toLowerCase().includes(term));
    return [...base].sort((a,b) => Number(b[sort] || 0) - Number(a[sort] || 0));
  }, [assets, q, sort]);

  const gainers = [...assets].sort((a,b) => b.change24h - a.change24h).slice(0,4);
  const sector = [...assets].slice(0,10);

  return <div className="app">
    <aside><div className="logo">S</div><b>ValuePilot</b><small>Desk</small>{['Markets','Indexes','NewsFeed','TokenBar','Analysis','Macro','Watchlist','Execution'].map((x,i)=><button key={x} className={i===0?'active':''}>{x}</button>)}<div className="bottom"><button>AI cockpit</button><button>Trade panel</button></div></aside>
    <main>
      <header className="top"><div><b>Total MarketCap:</b> <strong>{fmtMoney(global.totalMarketCap)}</strong> <span className="green">live</span></div><div><b>24H Vol:</b> <strong>{fmtMoney(global.totalVolume24h)}</strong></div><div><b>BTC:</b> <strong>{fmtMoney(global.btcPrice)}</strong> <span className={global.btcChange>=0?'green':'red'}>{pct(global.btcChange)}</span></div><div><b>ETH:</b> <strong>{fmtMoney(global.ethPrice)}</strong> <span className={global.ethChange>=0?'green':'red'}>{pct(global.ethChange)}</span></div><span className="tagline">Wave 2 live desk · secure execution layer</span></header>
      <section className="nav"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search SSI/AI/ETF/Coin/Index/Charts/Research"/><button className="white">Cryptocurrencies</button><button>SSI Indexes</button><button>ETF Flows</button><button>NewsFeed</button><button>Watchlist</button><button onClick={load} className="blue">Refresh</button></section>
      <section className="ticker">{gainers.map(x=><div key={x.symbol}><b>{x.symbol}</b> <small>{x.name}</small><em className={x.change24h>=0?'green':'red'}>{pct(x.change24h)}</em><strong>{fmtMoney(x.price)}</strong></div>)}<div><b>BTC 24H Volume</b><strong>{fmtMoney(assets.find(x=>x.symbol==='BTC')?.volume24h)}</strong></div><div><b>ETH 24H Volume</b><strong>{fmtMoney(assets.find(x=>x.symbol==='ETH')?.volume24h)}</strong></div><div><b>Execution Mode</b><strong>Protected</strong></div></section>
      <section className="banner"><b>Research</b><span>Trade top assets on your own research desk. Live market screening, flow monitoring and execution from one interface.</span><button>Open execution</button></section>
      <section className="title"><div><h1>Cryptocurrency Research Terminal</h1><p>Live market intelligence with protected execution layer.</p></div><div className="stat"><small>Market mode</small><b>{loading?'Loading':'Live'}</b></div><div className="stat"><small>Rows</small><b>{rows.length}</b></div><div className="stat"><small>Tracked assets</small><b>{assets.length}</b></div></section>
      <section className="tabs"><div className="tab active"><b>Cryptocurrencies</b><span>All coin</span></div><div className="tab"><b>SSI Indexes</b><span>Index basket</span></div><div className="tab"><b>ETF Flows</b><span>Flow monitor</span></div><div className="tab"><b>NewsFeed</b><span>Catalyst feed</span></div></section>
      <section className="tablebox"><div className="controls"><button onClick={()=>setSort('marketCap')}>Market Cap</button><button onClick={()=>setSort('change24h')}>Top Gainer</button><button onClick={()=>setSort('volume24h')}>24H Volume</button><button onClick={()=>setSort('aiScore')}>AI Score</button><span>Live mode</span></div>
        <table><thead><tr><th>★</th><th>#</th><th>Coin</th><th>Price</th><th>24H Change</th><th>24H Volume</th><th>MarketCap</th><th>7D Chart</th><th>AI Score</th></tr></thead><tbody>{rows.map((x,i)=><tr onClick={()=>setSelected(x)} key={x.symbol}><td>{i<3?'★':'☆'}</td><td>{i+1}</td><td><span className="coin">{x.symbol[0]}</span><b>{x.symbol}</b> <small>{x.name}</small></td><td>{fmtMoney(x.price)}</td><td className={x.change24h>=0?'green':'red'}>{pct(x.change24h)}</td><td>{fmtMoney(x.volume24h)}</td><td>{fmtMoney(x.marketCap)}</td><td><Spark data={x.chart}/></td><td><span className="score">{x.aiScore || 70}</span></td></tr>)}</tbody></table>{loading && <div className="empty">Loading live exchange data...</div>}{err && !loading && <div className="empty error">{err}<br/>Open /api/sosovalue?resource=market&debug=1 to inspect server response.</div>}{!loading && !err && rows.length===0 && <div className="empty">No rows match this view. Try another search term.</div>}
      </section>
    </main>
    <aside className="right"><Card title="Spotlight"><div className="chips">{['ETF Candidates','AI Agents','Modular Chain','Stablecoin Rotation'].map(x=><span key={x}>{x}</span>)}</div></Card><Card title="Sector Mover"><div className="grid">{sector.map(x=><div className={x.change24h>=0?'tile up':'tile down'} key={x.symbol}><small>{x.sector}</small><b>{x.symbol}</b><span>{pct(x.change24h)}</span></div>)}</div></Card><Card title="Selected asset"><div className="selected">{selected ? <><b>{selected.name}</b><span>{selected.symbol}</span><div className="split"><em>{fmtMoney(selected.price)}</em><em className={selected.change24h>=0?'green':'red'}>{pct(selected.change24h)}</em></div></> : <p>Select an asset row to inspect details.</p>}</div></Card></aside>
  </div>;
}
function Card({title,children}) { return <section className="card"><h2>{title}</h2>{children}</section> }
createRoot(document.getElementById('root')).render(<App/>);
