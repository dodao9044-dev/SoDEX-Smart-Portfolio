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
const byNum = (k) => (a, b) => Number(b[k] || 0) - Number(a[k] || 0);

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
  const [view, setView] = useState('markets');
  const [watchlist, setWatchlist] = useState(['BTC','ETH','SOL','BNB']);

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const r = await fetch(`/api/sosovalue?resource=market&t=${Date.now()}`, { cache: 'no-store' });
      const p = await r.json();
      const rows = p?.assets || p?.data?.assets || [];
      if (!r.ok || !Array.isArray(rows) || rows.length === 0) throw new Error(p?.message || p?.error || 'No live rows returned');
      setAssets(rows);
      setGlobal(p.global || {});
      setSelected((old) => rows.find(x => x.symbol === old?.symbol) || rows[0]);
    } catch (e) {
      setAssets([]); setSelected(null); setErr(e.message || 'Cannot load live data');
      setGlobal({});
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const filteredAssets = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = assets.filter(x => !term || x.symbol.toLowerCase().includes(term) || x.name.toLowerCase().includes(term) || String(x.sector || '').toLowerCase().includes(term));
    return [...base].sort(byNum(sort));
  }, [assets, q, sort]);

  const indexes = useMemo(() => {
    const groups = {};
    assets.forEach(a => {
      const key = a.sector || 'Others';
      groups[key] ||= [];
      groups[key].push(a);
    });
    return Object.entries(groups).map(([name, list]) => ({
      symbol: name.replace(/\s+/g, '').slice(0, 8).toUpperCase(),
      name: `${name} Index`,
      count: list.length,
      price: list.reduce((s, x) => s + Number(x.price || 0), 0) / Math.max(1, list.length),
      change24h: list.reduce((s, x) => s + Number(x.change24h || 0), 0) / Math.max(1, list.length),
      volume24h: list.reduce((s, x) => s + Number(x.volume24h || 0), 0),
      marketCap: list.reduce((s, x) => s + Number(x.marketCap || 0), 0),
      chart: list[0]?.chart || [],
      aiScore: Math.round(list.reduce((s, x) => s + Number(x.aiScore || 70), 0) / Math.max(1, list.length))
    })).sort(byNum('marketCap'));
  }, [assets]);

  const etfFlows = useMemo(() => {
    const picks = ['BTC','ETH','SOL','BNB','XRP','DOGE','ADA','AVAX'];
    return picks.map(sym => assets.find(a => a.symbol === sym)).filter(Boolean).map(a => ({
      ...a,
      inflow: Number(a.volume24h || 0) * (Number(a.change24h || 0) >= 0 ? 0.018 : -0.012),
      nav: Number(a.marketCap || 0) / Math.max(1, Number(a.price || 1)),
      product: `${a.symbol} Spot Proxy`
    }));
  }, [assets]);

  const news = useMemo(() => {
    const movers = [...assets].sort((a,b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 10);
    return movers.map((a, i) => ({
      id: `${a.symbol}-${i}`,
      time: `${i + 1}m ago`,
      title: `${a.symbol} ${a.change24h >= 0 ? 'strengthens' : 'pulls back'} as 24H move reaches ${pct(a.change24h)}`,
      detail: `${a.name} trades at ${fmtMoney(a.price)} with 24H volume ${fmtMoney(a.volume24h)} and market cap ${fmtMoney(a.marketCap)}.`,
      asset: a
    }));
  }, [assets]);

  const gainers = [...assets].sort((a,b) => b.change24h - a.change24h).slice(0,4);
  const sector = [...assets].slice(0,10);
  const watchRows = filteredAssets.filter(a => watchlist.includes(a.symbol));

  const navItems = [
    ['markets', 'Markets'], ['indexes', 'Indexes'], ['news', 'NewsFeed'], ['tokenbar', 'TokenBar'],
    ['analysis', 'Analysis'], ['macro', 'Macro'], ['watchlist', 'Watchlist'], ['execution', 'Execution']
  ];

  return <div className="app">
    <aside><div className="logo">S</div><b>SoDEX</b><small>Smart Portfolio</small>{navItems.map(([id,label])=><button key={id} onClick={()=>setView(id)} className={view===id?'active':''}>{label}</button>)}<div className="bottom"><button onClick={()=>setView('analysis')}>AI cockpit</button><button onClick={()=>setView('execution')}>Trade panel</button></div></aside>
    <main>
      <header className="top"><div><b>Total MarketCap:</b> <strong>{fmtMoney(global.totalMarketCap)}</strong> <span className="green">live</span></div><div><b>24H Vol:</b> <strong>{fmtMoney(global.totalVolume24h)}</strong></div><div><b>BTC:</b> <strong>{fmtMoney(global.btcPrice)}</strong> <span className={global.btcChange>=0?'green':'red'}>{pct(global.btcChange)}</span></div><div><b>ETH:</b> <strong>{fmtMoney(global.ethPrice)}</strong> <span className={global.ethChange>=0?'green':'red'}>{pct(global.ethChange)}</span></div><span className="tagline">Wave 2 live desk · secure execution layer</span></header>
      <section className="nav"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search SSI/AI/ETF/Coin/Index/Charts/Research"/><button onClick={()=>setView('markets')} className={view==='markets'?'white':''}>Cryptocurrencies</button><button onClick={()=>setView('indexes')} className={view==='indexes'?'white':''}>SSI Indexes</button><button onClick={()=>setView('etf')} className={view==='etf'?'white':''}>ETF Flows</button><button onClick={()=>setView('news')} className={view==='news'?'white':''}>NewsFeed</button><button onClick={()=>setView('watchlist')} className={view==='watchlist'?'white':''}>Watchlist</button><button onClick={load} className="blue">Refresh</button></section>
      <section className="ticker">{gainers.map(x=><div key={x.symbol}><b>{x.symbol}</b> <small>{x.name}</small><em className={x.change24h>=0?'green':'red'}>{pct(x.change24h)}</em><strong>{fmtMoney(x.price)}</strong></div>)}<div><b>BTC 24H Volume</b><strong>{fmtMoney(assets.find(x=>x.symbol==='BTC')?.volume24h)}</strong></div><div><b>ETH 24H Volume</b><strong>{fmtMoney(assets.find(x=>x.symbol==='ETH')?.volume24h)}</strong></div><div><b>Execution Mode</b><strong>Protected</strong></div></section>
      <section className="banner"><b>Research</b><span>Trade top assets on your own research desk. Live market screening, flow monitoring and execution from one interface.</span><button onClick={()=>setView('execution')}>Open execution</button></section>
      <section className="title"><div><h1>{titleFor(view)}</h1><p>{subtitleFor(view)}</p></div><div className="stat"><small>Market mode</small><b>{loading?'Loading':'Live'}</b></div><div className="stat"><small>Rows</small><b>{activeCount(view, filteredAssets, indexes, etfFlows, news, watchRows)}</b></div><div className="stat"><small>Tracked assets</small><b>{assets.length}</b></div></section>
      <section className="tabs"><div onClick={()=>setView('markets')} className={view==='markets'?'tab active':'tab'}><b>Cryptocurrencies</b><span>All coin</span></div><div onClick={()=>setView('indexes')} className={view==='indexes'?'tab active':'tab'}><b>SSI Indexes</b><span>Index basket</span></div><div onClick={()=>setView('etf')} className={view==='etf'?'tab active':'tab'}><b>ETF Flows</b><span>Flow monitor</span></div><div onClick={()=>setView('news')} className={view==='news'?'tab active':'tab'}><b>NewsFeed</b><span>Catalyst feed</span></div></section>
      {renderView({ view, rows: filteredAssets, indexes, etfFlows, news, watchRows, loading, err, sort, setSort, selected, setSelected, watchlist, setWatchlist })}
    </main>
    <aside className="right"><Card title="Spotlight"><div className="chips">{['ETF Candidates','AI Agents','Modular Chain','Stablecoin Rotation'].map(x=><span key={x}>{x}</span>)}</div></Card><Card title="Sector Mover"><div className="grid">{sector.map(x=><div className={x.change24h>=0?'tile up':'tile down'} key={x.symbol}><small>{x.sector}</small><b>{x.symbol}</b><span>{pct(x.change24h)}</span></div>)}</div></Card><Card title="Selected asset"><div className="selected">{selected ? <><b>{selected.name}</b><span>{selected.symbol}</span><div className="split"><em>{fmtMoney(selected.price)}</em><em className={selected.change24h>=0?'green':'red'}>{pct(selected.change24h)}</em></div></> : <p>Select an asset row to inspect details.</p>}</div></Card></aside>
  </div>;
}

function titleFor(view) {
  return ({ markets:'Cryptocurrency Research Terminal', indexes:'SSI Index Basket', etf:'ETF Flow Monitor', news:'Market NewsFeed', watchlist:'Watchlist', tokenbar:'TokenBar Live Tape', analysis:'AI Market Analysis', macro:'Macro Dashboard', execution:'Protected Execution Panel' })[view] || 'Cryptocurrency Research Terminal';
}
function subtitleFor(view) {
  return ({ markets:'Live market intelligence with protected execution layer.', indexes:'Sector baskets calculated from live asset prices, volume and market cap.', etf:'Spot proxy flow board using live exchange volume and price movement.', news:'Live market catalysts generated from real-time movers and volume changes.', watchlist:'Your selected assets, updated from live market data.', tokenbar:'Fast tape view for live coin prices and 24H moves.', analysis:'Ranking, momentum, risk and signal summary from live rows.', macro:'Global crypto market cap, volume and major-asset dominance view.', execution:'Trade-prep panel with protected mode, selected asset and live quote context.' })[view] || 'Live market intelligence.';
}
function activeCount(view, rows, indexes, etfFlows, news, watchRows) {
  if (view === 'indexes') return indexes.length;
  if (view === 'etf') return etfFlows.length;
  if (view === 'news') return news.length;
  if (view === 'watchlist') return watchRows.length;
  return rows.length;
}

function renderView(props) {
  const { view, rows, indexes, etfFlows, news, watchRows } = props;
  if (view === 'indexes') return <IndexTable {...props} data={indexes}/>;
  if (view === 'etf') return <ETFTable {...props} data={etfFlows}/>;
  if (view === 'news') return <NewsPanel {...props} data={news}/>;
  if (view === 'watchlist') return <MarketTable {...props} rows={watchRows} watchMode/>;
  if (view === 'tokenbar') return <TokenBar {...props} rows={rows}/>;
  if (view === 'analysis') return <AnalysisPanel {...props} rows={rows}/>;
  if (view === 'macro') return <MacroPanel {...props} rows={rows}/>;
  if (view === 'execution') return <ExecutionPanel {...props} rows={rows}/>;
  return <MarketTable {...props} rows={rows}/>;
}

function MarketTable({ rows, loading, err, sort, setSort, setSelected, watchlist, setWatchlist, watchMode=false }) {
  const toggle = (sym) => setWatchlist(w => w.includes(sym) ? w.filter(x => x !== sym) : [...w, sym]);
  return <section className="tablebox"><div className="controls"><button onClick={()=>setSort('marketCap')}>Market Cap</button><button onClick={()=>setSort('change24h')}>Top Gainer</button><button onClick={()=>setSort('volume24h')}>24H Volume</button><button onClick={()=>setSort('aiScore')}>AI Score</button><span>Live mode</span></div>
    <table><thead><tr><th>★</th><th>#</th><th>Coin</th><th>Price</th><th>24H Change</th><th>24H Volume</th><th>MarketCap</th><th>7D Chart</th><th>AI Score</th></tr></thead><tbody>{rows.map((x,i)=><tr onClick={()=>setSelected(x)} key={x.symbol}><td><button className="star" onClick={(e)=>{e.stopPropagation(); toggle(x.symbol)}}>{watchlist.includes(x.symbol)?'★':'☆'}</button></td><td>{i+1}</td><td><span className="coin">{x.symbol[0]}</span><b>{x.symbol}</b> <small>{x.name}</small></td><td>{fmtMoney(x.price)}</td><td className={x.change24h>=0?'green':'red'}>{pct(x.change24h)}</td><td>{fmtMoney(x.volume24h)}</td><td>{fmtMoney(x.marketCap)}</td><td><Spark data={x.chart}/></td><td><span className="score">{x.aiScore || 70}</span></td></tr>)}</tbody></table><State loading={loading} err={err} empty={!rows.length} msg={watchMode?'No watchlist assets match this search. Star coins in Markets to add them.':'No rows match this view. Try another search term.'}/>
  </section>;
}

function IndexTable({ data, loading, err }) {
  return <section className="tablebox"><div className="controls"><span>Live sector basket</span></div><table><thead><tr><th>#</th><th>Index</th><th>Assets</th><th>Basket Price</th><th>24H Change</th><th>24H Volume</th><th>MarketCap</th><th>Chart</th><th>Score</th></tr></thead><tbody>{data.map((x,i)=><tr key={x.symbol}><td>{i+1}</td><td><span className="coin">{x.symbol[0]}</span><b>{x.name}</b> <small>{x.symbol}</small></td><td>{x.count}</td><td>{fmtMoney(x.price)}</td><td className={x.change24h>=0?'green':'red'}>{pct(x.change24h)}</td><td>{fmtMoney(x.volume24h)}</td><td>{fmtMoney(x.marketCap)}</td><td><Spark data={x.chart}/></td><td><span className="score">{x.aiScore}</span></td></tr>)}</tbody></table><State loading={loading} err={err} empty={!data.length}/></section>;
}

function ETFTable({ data, loading, err, setSelected }) {
  return <section className="tablebox"><div className="controls"><span>Spot proxy flow monitor</span></div><table><thead><tr><th>#</th><th>Product</th><th>Live Price</th><th>24H Change</th><th>Est. Flow</th><th>24H Volume</th><th>NAV Proxy</th><th>Chart</th></tr></thead><tbody>{data.map((x,i)=><tr onClick={()=>setSelected(x)} key={x.symbol}><td>{i+1}</td><td><span className="coin">{x.symbol[0]}</span><b>{x.product}</b> <small>{x.name}</small></td><td>{fmtMoney(x.price)}</td><td className={x.change24h>=0?'green':'red'}>{pct(x.change24h)}</td><td className={x.inflow>=0?'green':'red'}>{fmtMoney(x.inflow)}</td><td>{fmtMoney(x.volume24h)}</td><td>{fmtMoney(x.nav)}</td><td><Spark data={x.chart}/></td></tr>)}</tbody></table><State loading={loading} err={err} empty={!data.length}/></section>;
}

function NewsPanel({ data, loading, err, setSelected }) {
  return <section className="tablebox newsbox"><div className="controls"><span>Live catalyst feed</span></div>{data.map(n => <article className="newsitem" key={n.id} onClick={()=>setSelected(n.asset)}><small>{n.time} · {n.asset.symbol}</small><b>{n.title}</b><p>{n.detail}</p></article>)}<State loading={loading} err={err} empty={!data.length}/></section>;
}

function TokenBar({ rows, loading, err, setSelected }) {
  return <section className="tablebox"><div className="tokenbar">{rows.map(x=><button key={x.symbol} onClick={()=>setSelected(x)}><b>{x.symbol}</b><span>{fmtMoney(x.price)}</span><em className={x.change24h>=0?'green':'red'}>{pct(x.change24h)}</em></button>)}</div><State loading={loading} err={err} empty={!rows.length}/></section>;
}

function AnalysisPanel({ rows, loading, err }) {
  const strong = rows.filter(x => x.change24h > 0).length;
  const weak = rows.filter(x => x.change24h < 0).length;
  const top = [...rows].sort(byNum('aiScore')).slice(0,5);
  return <section className="tablebox"><div className="analysisgrid"><div><h3>Market breadth</h3><b className="green">{strong} up</b><b className="red">{weak} down</b><p>Momentum is calculated from live 24H change and volume.</p></div><div><h3>Top AI score</h3>{top.map(x=><p key={x.symbol}><b>{x.symbol}</b> <span>{x.aiScore}</span> <em className={x.change24h>=0?'green':'red'}>{pct(x.change24h)}</em></p>)}</div></div><State loading={loading} err={err} empty={!rows.length}/></section>;
}

function MacroPanel({ rows, loading, err }) {
  const cap = rows.reduce((s,x)=>s+Number(x.marketCap||0),0);
  const vol = rows.reduce((s,x)=>s+Number(x.volume24h||0),0);
  const btc = rows.find(x=>x.symbol==='BTC');
  const eth = rows.find(x=>x.symbol==='ETH');
  return <section className="tablebox"><div className="macrogrid"><div><small>Total tracked cap</small><b>{fmtMoney(cap)}</b></div><div><small>Total tracked volume</small><b>{fmtMoney(vol)}</b></div><div><small>BTC dominance proxy</small><b>{cap ? ((Number(btc?.marketCap||0)/cap)*100).toFixed(2)+'%' : '—'}</b></div><div><small>ETH dominance proxy</small><b>{cap ? ((Number(eth?.marketCap||0)/cap)*100).toFixed(2)+'%' : '—'}</b></div></div><State loading={loading} err={err} empty={!rows.length}/></section>;
}

function ExecutionPanel({ selected, rows, loading, err }) {
  const x = selected || rows[0];
  return <section className="tablebox executionbox"><h2>Protected execution mode</h2>{x ? <div className="ticket"><div><small>Asset</small><b>{x.name} ({x.symbol})</b></div><div><small>Live quote</small><b>{fmtMoney(x.price)}</b></div><div><small>24H change</small><b className={x.change24h>=0?'green':'red'}>{pct(x.change24h)}</b></div><div><small>24H volume</small><b>{fmtMoney(x.volume24h)}</b></div><button>Prepare order</button></div> : null}<State loading={loading} err={err} empty={!x}/></section>;
}

function State({ loading, err, empty, msg='No data available.' }) {
  if (loading) return <div className="empty">Loading live exchange data...</div>;
  if (err) return <div className="empty error">{err}<br/>Open /api/sosovalue?resource=market&debug=1 to inspect server response.</div>;
  if (empty) return <div className="empty">{msg}</div>;
  return null;
}

function Card({title,children}) { return <section className="card"><h2>{title}</h2>{children}</section> }
createRoot(document.getElementById('root')).render(<App/>);
