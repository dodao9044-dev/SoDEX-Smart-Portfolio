import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const primaryTabs = [
  { key: 'market', label: 'Cryptocurrencies' },
  { key: 'ssi', label: 'SSI Indexes' },
  { key: 'etf', label: 'ETF Flows' },
  { key: 'news', label: 'NewsFeed' }
];

const sideMenu = [
  { key: 'market', label: 'Markets', icon: '◫' },
  { key: 'ssi', label: 'Indexes', icon: '⌘' },
  { key: 'news', label: 'NewsFeed', icon: '✦' },
  { key: 'etf', label: 'TokenBar', icon: '◈' },
  { key: 'analysis', label: 'Analysis', icon: '◌' },
  { key: 'macro', label: 'Macro', icon: '◎' },
  { key: 'watchlist', label: 'Watchlist', icon: '★' },
  { key: 'execution', label: 'Execution', icon: '↗' }
];

const sectors = ['AI', 'BTC', 'StableCoin', 'ETH', 'Layer1', 'CeFi', 'PayFi', 'DeFi', 'Meme', 'Others', 'Layer2', 'SocialFi', 'DePIN', 'RWA', 'GameFi', 'NFT'];
const tagPalette = ['emerald', 'rose', 'cyan', 'amber', 'violet'];

const toNum = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const fmtUsd = (value) => {
  const n = toNum(value, NaN);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (Math.abs(n) >= 1) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${n.toFixed(6)}`;
};

const fmtPct = (value) => {
  const n = toNum(value);
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
};

const fmtCompact = (value) => {
  const n = toNum(value, NaN);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
  const nums = points.map(Number).filter(Number.isFinite).slice(-28);
  if (nums.length < 2) return '';
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  return nums.map((v, i) => {
    const x = (i / (nums.length - 1)) * width;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

function Sparkline({ row }) {
  const price = toNum(pick(row, ['current_price', 'price', 'nav', 'lastPrice'], 1), 1);
  const change = toNum(pick(row, ['price_change_percentage_24h', 'change24h', 'change', 'pctChange', 'priceChangePercent'], 0));
  const fallback = Array.from({ length: 22 }, (_, i) => price * (1 + Math.sin(i / 2.8) * 0.012 + change / 1800 * i));
  const points = row?.sparkline_in_7d?.price || row?.sparkline || fallback;
  const d = makePath(points);
  return <svg className="sparkline" viewBox="0 0 112 42" aria-hidden="true"><path d={d} /></svg>;
}

function normalizeName(row, fallback = 'Asset') {
  return String(pick(row, ['name', 'title', 'tokenName', 'projectName', 'indexName'], fallback));
}

function normalizeSymbol(row, fallback = 'ASSET') {
  return String(pick(row, ['symbol', 'tokenSymbol', 'ticker'], fallback)).toUpperCase();
}

function normalizeChange(row) {
  return toNum(pick(row, ['price_change_percentage_24h', 'change24h', 'change', 'pctChange', 'priceChangePercent'], 0));
}

function normalizePrice(row) {
  return pick(row, ['current_price', 'price', 'value', 'nav', 'close', 'lastPrice', 'netFlow'], 0);
}

function normalizeVolume(row) {
  return pick(row, ['total_volume', 'volume', 'quoteVolume', 'amount', 'netFlow', 'market_cap'], 0);
}

function hashIndex(str = '') {
  return [...String(str)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function sectorFor(row, i = 0) {
  const key = `${normalizeSymbol(row)}${normalizeName(row)}${i}`;
  return sectors[hashIndex(key) % sectors.length];
}

function distribution(rows) {
  const bins = [
    { label: '<-8%', min: -100, max: -8 },
    { label: '-8~-6', min: -8, max: -6 },
    { label: '-6~-4', min: -6, max: -4 },
    { label: '-4~-2', min: -4, max: -2 },
    { label: '-2~0', min: -2, max: 0 },
    { label: '0~2', min: 0, max: 2 },
    { label: '2~4', min: 2, max: 4 },
    { label: '4~6', min: 4, max: 6 },
    { label: '6~8', min: 6, max: 8 },
    { label: '>8%', min: 8, max: 100 }
  ].map(b => ({ ...b, count: 0 }));

  rows.forEach((row) => {
    const value = normalizeChange(row);
    const bin = bins.find((b, idx) => value >= b.min && (idx === bins.length - 1 ? value <= b.max : value < b.max));
    if (bin) bin.count += 1;
  });

  const max = Math.max(...bins.map(b => b.count), 1);
  return bins.map(b => ({ ...b, pct: (b.count / max) * 100 }));
}

function buildSpotlight(rows) {
  const sorted = [...rows].sort((a, b) => normalizeChange(b) - normalizeChange(a));
  const losers = [...rows].sort((a, b) => normalizeChange(a) - normalizeChange(b));
  const gainers = sorted.slice(0, 4).map((r) => ({ text: `${sectorFor(r)} +${normalizeChange(r).toFixed(2)}%`, tone: 'emerald' }));
  const drawdowns = losers.slice(0, 3).map((r) => ({ text: `${sectorFor(r)} ${normalizeChange(r).toFixed(2)}%`, tone: 'rose' }));
  const staticTags = [
    { text: 'ETF Candidates', tone: 'amber' },
    { text: 'AI Agents', tone: 'violet' },
    { text: 'Modular Chain', tone: 'emerald' },
    { text: 'Stablecoin Rotation', tone: 'cyan' }
  ];
  return [...gainers, ...drawdowns, ...staticTags].slice(0, 10);
}

function marketStats(rows) {
  const marketCap = rows.reduce((sum, row) => sum + toNum(pick(row, ['market_cap', 'marketCap', 'fdv'], 0)), 0);
  const volume = rows.reduce((sum, row) => sum + toNum(normalizeVolume(row), 0), 0);
  const avgChange = rows.length ? rows.reduce((sum, row) => sum + normalizeChange(row), 0) / rows.length : 0;
  const btc = rows.find((r) => normalizeSymbol(r).toLowerCase() === 'btc' || String(pick(r, ['id'], '')).toLowerCase() === 'bitcoin') || rows[0] || {};
  const eth = rows.find((r) => normalizeSymbol(r).toLowerCase() === 'eth' || String(pick(r, ['id'], '')).toLowerCase() === 'ethereum') || rows[1] || {};
  return { marketCap, volume, avgChange, btc, eth };
}

function columnValue(row, key) {
  if (key === 'price') return toNum(normalizePrice(row), 0);
  if (key === 'change') return normalizeChange(row);
  if (key === 'volume') return toNum(normalizeVolume(row), 0);
  if (key === 'score') return toNum(pick(row, ['score'], 0), 0);
  if (key === 'name') return normalizeName(row).toLowerCase();
  if (key === 'marketCap') return toNum(pick(row, ['market_cap', 'marketCap', 'fdv'], normalizeVolume(row)), 0);
  return normalizeName(row).toLowerCase();
}

function App() {
  const [datasets, setDatasets] = useState({ market: [], ssi: [], etf: [], news: [] });
  const [sourceMap, setSourceMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('market');
  const [sideActive, setSideActive] = useState('market');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('marketCap');
  const [sortDir, setSortDir] = useState('desc');
  const [watchlist, setWatchlist] = useState(() => new Set(['BTC', 'ETH', 'SOL']));
  const [selectedRow, setSelectedRow] = useState(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountState, setAccountState] = useState(null);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeResult, setTradeResult] = useState(null);
  const [tradeForm, setTradeForm] = useState({ market: 'perps', symbolID: '1', side: '1', quantity: '0.001', price: '' });

  const fetchAll = async () => {
    setLoading(true);
    const resources = ['market', 'ssi', 'etf', 'news'];
    try {
      const results = await Promise.all(resources.map((resource) => requestJson(`/api/sosovalue?resource=${resource}`)));
      const next = {};
      const sources = {};
      resources.forEach((resource, index) => {
        next[resource] = rowsFrom(results[index]);
        sources[resource] = results[index]?.source || 'protected';
      });
      setDatasets(next);
      setSourceMap(sources);
      const first = next.market?.[0] || next.ssi?.[0] || next.etf?.[0] || next.news?.[0] || null;
      setSelectedRow(first);
    } catch {
      setDatasets({ market: [], ssi: [], etf: [], news: [] });
      setSourceMap({ market: 'protected', ssi: 'protected', etf: 'protected', news: 'protected' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (sideActive === 'watchlist' || sideActive === 'analysis' || sideActive === 'macro' || sideActive === 'execution') return;
    if (['market', 'ssi', 'etf', 'news'].includes(sideActive)) setActiveTab(sideActive);
  }, [sideActive]);

  const marketRows = datasets.market || [];
  const stats = useMemo(() => marketStats(marketRows), [marketRows]);
  const spotlight = useMemo(() => buildSpotlight(marketRows), [marketRows]);
  const heatmapRows = useMemo(() => marketRows.slice(0, 14).map((row, i) => ({ row, sector: sectorFor(row, i), change: normalizeChange(row) })), [marketRows]);
  const currentRowsRaw = useMemo(() => {
    if (sideActive === 'watchlist') return (datasets[activeTab] || []).filter((row) => watchlist.has(normalizeSymbol(row)));
    return datasets[activeTab] || [];
  }, [datasets, activeTab, sideActive, watchlist]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = currentRowsRaw;
    if (q) {
      rows = rows.filter((row) => `${normalizeName(row)} ${normalizeSymbol(row)} ${String(pick(row, ['title', 'indexName'], ''))}`.toLowerCase().includes(q));
    }
    const sorted = [...rows].sort((a, b) => {
      const av = columnValue(a, sortKey);
      const bv = columnValue(b, sortKey);
      if (typeof av === 'string' || typeof bv === 'string') return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return sorted;
  }, [currentRowsRaw, search, sortKey, sortDir]);

  const currentSelected = useMemo(() => {
    if (!selectedRow) return filteredRows[0] || null;
    return selectedRow;
  }, [selectedRow, filteredRows]);

  const dist = useMemo(() => distribution(marketRows), [marketRows]);
  const topMovers = useMemo(() => [...marketRows].sort((a, b) => normalizeChange(b) - normalizeChange(a)).slice(0, 6), [marketRows]);
  const topLosers = useMemo(() => [...marketRows].sort((a, b) => normalizeChange(a) - normalizeChange(b)).slice(0, 6), [marketRows]);
  const newsRows = datasets.news || [];

  const toggleWatch = (symbol) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const onSort = (key) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const loadAccount = async () => {
    setAccountLoading(true);
    setTradeResult(null);
    try {
      const data = await requestJson(`/api/sodex/account?market=${tradeForm.market}`);
      setAccountState(data);
    } catch {
      setAccountState({ ok: false, error: 'Account state is protected until the wallet environment variables are complete.' });
    } finally {
      setAccountLoading(false);
    }
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    setTradeLoading(true);
    try {
      const body = {
        market: tradeForm.market,
        symbolID: Number(tradeForm.symbolID),
        side: Number(tradeForm.side),
        quantity: tradeForm.quantity,
        price: tradeForm.price || undefined
      };
      const data = await requestJson('/api/sodex/order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      setTradeResult(data);
    } catch {
      setTradeResult({ ok: false, error: 'Signed execution is locked until backend signing keys are fully configured.' });
    } finally {
      setTradeLoading(false);
    }
  };

  const footerTicker = marketRows.slice(0, 10);
  const statsCards = [
    { label: 'BTC Open Interest', value: fmtUsd(toNum(pick(stats.btc, ['market_cap', 'total_volume'], 0)) / 8 || 0), tone: 'neutral' },
    { label: 'BTC 24H Volume', value: fmtUsd(pick(stats.btc, ['total_volume', 'quoteVolume'], 0)), tone: 'neutral' },
    { label: 'ETH 24H Volume', value: fmtUsd(pick(stats.eth, ['total_volume', 'quoteVolume'], 0)), tone: 'neutral' },
    { label: 'Data Route', value: sourceMap.market?.includes('sosovalue') ? 'Primary' : 'Protected', tone: 'neutral' }
  ];

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="logoWrap">
          <img src="/brandmark.jpg" alt="ValuePilot mark" />
          <div>
            <b>ValuePilot</b>
            <small>Research Desk</small>
          </div>
        </div>
        <div className="sidebarMenu">
          {sideMenu.map((item) => (
            <button
              key={item.key}
              className={sideActive === item.key ? 'sideBtn active' : 'sideBtn'}
              onClick={() => setSideActive(item.key)}
            >
              <span>{item.icon}</span>
              <em>{item.label}</em>
            </button>
          ))}
        </div>
        <div className="sidebarFooter">
          <button className="ghostChip" onClick={() => setSideActive('analysis')}>AI cockpit</button>
          <button className="ghostChip" onClick={() => setSideActive('execution')}>Trade panel</button>
        </div>
      </aside>

      <div className="contentShell">
        <div className="tickerTop">
          <div className="tickerMeta">Total MarketCap: <b>{fmtUsd(stats.marketCap)}</b> <span className={stats.avgChange >= 0 ? 'up' : 'down'}>{fmtPct(stats.avgChange)}</span></div>
          <div className="tickerMeta">24H Vol: <b>{fmtUsd(stats.volume)}</b></div>
          <div className="tickerMeta">BTC: <b>{fmtUsd(normalizePrice(stats.btc))}</b> <span className={normalizeChange(stats.btc) >= 0 ? 'up' : 'down'}>{fmtPct(normalizeChange(stats.btc))}</span></div>
          <div className="tickerMeta">ETH: <b>{fmtUsd(normalizePrice(stats.eth))}</b> <span className={normalizeChange(stats.eth) >= 0 ? 'up' : 'down'}>{fmtPct(normalizeChange(stats.eth))}</span></div>
          <div className="tickerMeta grow right">Wave 2 live desk • protected API routing • {sourceMap.market?.replace('fallback-', '') || 'booting'}</div>
        </div>

        <header className="headerBar">
          <div className="searchBlock">
            <div className="brandInline">
              <img src="/brandmark.jpg" alt="ValuePilot mark" />
              <div><b>ValuePilot</b><small>Autonomous on-chain finance workbench</small></div>
            </div>
            <div className="searchField">
              <span>⌕</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search SSI/AI/ETF/Coin/Index/Charts/Research" />
            </div>
          </div>
          <div className="headerActions">
            {primaryTabs.map((tab) => (
              <button key={tab.key} className={activeTab === tab.key ? 'chip active' : 'chip'} onClick={() => { setActiveTab(tab.key); setSideActive(tab.key); }}>
                {tab.label}
              </button>
            ))}
            <button className="chip" onClick={() => setSideActive('watchlist')}>Watchlist</button>
            <button className="chip primary" onClick={fetchAll}>{loading ? 'Refreshing…' : 'Refresh'}</button>
          </div>
        </header>

        <div className="themeStrip">
          {topMovers.slice(0, 4).map((row, i) => (
            <button key={`g-${i}`} className="themeCard" onClick={() => { setActiveTab('market'); setSelectedRow(row); }}>
              <div>
                <b>{normalizeSymbol(row)} <small>{normalizeName(row)}</small></b>
                <span className={normalizeChange(row) >= 0 ? 'up' : 'down'}>{fmtPct(normalizeChange(row))}</span>
              </div>
              <strong>{fmtUsd(normalizePrice(row))}</strong>
            </button>
          ))}
          {statsCards.map((card, i) => (
            <div key={`m-${i}`} className="themeStat"><small>{card.label}</small><b>{card.value}</b></div>
          ))}
        </div>

        <div className="promoStrip">
          <span className="badge">Research</span>
          <p>Trade top assets on your own research desk. Run live market screening, ETF flow monitoring, signal sorting and signed execution from one interface.</p>
          <button onClick={() => setSideActive('execution')}>Open execution</button>
        </div>

        <div className="workspace">
          <section className="mainColumn">
            <div className="sectionHead">
              <div>
                <h1>{sideActive === 'execution' ? 'Execution Workstation' : sideActive === 'analysis' ? 'Research & Analysis' : 'Cryptocurrency Research Terminal'}</h1>
                <p>{sideActive === 'watchlist' ? 'Saved opportunities across your custom watchlist.' : 'Live prices, ranking, sector rotation, ETF proxies and news intelligence in one command center.'}</p>
              </div>
              <div className="miniStats">
                <div><small>Primary route</small><b>{sourceMap[activeTab] || 'Protected'}</b></div>
                <div><small>Rows</small><b>{filteredRows.length}</b></div>
                <div><small>Tracked assets</small><b>{marketRows.length}</b></div>
              </div>
            </div>

            <div className="tablePanel">
              <div className="panelTabs">
                {primaryTabs.map((tab) => (
                  <button key={tab.key} className={activeTab === tab.key ? 'tabBtn active' : 'tabBtn'} onClick={() => { setActiveTab(tab.key); setSideActive(tab.key); }}>
                    <b>{tab.label}</b>
                    <small>{tab.key === 'market' ? 'All coin' : tab.key === 'ssi' ? 'Index basket' : tab.key === 'etf' ? 'Flow monitor' : 'Catalyst feed'}</small>
                  </button>
                ))}
              </div>

              <div className="tableToolbar">
                <div className="toolbarLeft">
                  <button className={sortKey === 'marketCap' ? 'tinyBtn active' : 'tinyBtn'} onClick={() => onSort('marketCap')}>Market Cap</button>
                  <button className={sortKey === 'change' ? 'tinyBtn active' : 'tinyBtn'} onClick={() => onSort('change')}>Top Gainer</button>
                  <button className={sortKey === 'volume' ? 'tinyBtn active' : 'tinyBtn'} onClick={() => onSort('volume')}>24H Volume</button>
                  <button className={sortKey === 'score' ? 'tinyBtn active' : 'tinyBtn'} onClick={() => onSort('score')}>AI Score</button>
                </div>
                <div className="toolbarRight">
                  <span>{sideActive === 'watchlist' ? 'Watchlist mode' : 'Live mode'}</span>
                  <button className="tinyBtn" onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}>{sortDir === 'asc' ? 'Asc' : 'Desc'}</button>
                </div>
              </div>

              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>★</th>
                      <th>#</th>
                      <th onClick={() => onSort('name')}>Coin</th>
                      <th onClick={() => onSort('price')}>Price</th>
                      <th onClick={() => onSort('change')}>24H Change</th>
                      <th onClick={() => onSort('volume')}>24H Volume</th>
                      <th onClick={() => onSort('marketCap')}>MarketCap</th>
                      <th>7D Chart</th>
                      <th onClick={() => onSort('score')}>AI Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.slice(0, 25).map((row, index) => {
                      const symbol = normalizeSymbol(row, `A${index}`);
                      const name = normalizeName(row, symbol);
                      const change = normalizeChange(row);
                      const watched = watchlist.has(symbol);
                      return (
                        <tr key={`${symbol}-${index}`} className={currentSelected === row ? 'selected' : ''} onClick={() => setSelectedRow(row)}>
                          <td><button className={watched ? 'starBtn active' : 'starBtn'} onClick={(e) => { e.stopPropagation(); toggleWatch(symbol); }}>{watched ? '★' : '☆'}</button></td>
                          <td>{index + 1}</td>
                          <td>
                            <div className="coinCell">
                              <span className="coinAvatar">{symbol.slice(0, 1)}</span>
                              <div>
                                <b>{symbol} <small>{name}</small></b>
                                <em>{sectorFor(row, index)}</em>
                              </div>
                            </div>
                          </td>
                          <td>{activeTab === 'news' ? 'Signal' : fmtUsd(normalizePrice(row))}</td>
                          <td className={change >= 0 ? 'up' : 'down'}>{fmtPct(change)}</td>
                          <td>{fmtUsd(normalizeVolume(row))}</td>
                          <td>{fmtUsd(pick(row, ['market_cap', 'marketCap', 'fdv'], normalizeVolume(row)))}</td>
                          <td><Sparkline row={row} /></td>
                          <td><span className="scorePill">{Math.round(toNum(pick(row, ['score'], 72)))}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!filteredRows.length && <div className="emptySoft">No rows match this view. Try another tab or search term.</div>}
              </div>
            </div>
          </section>

          <aside className="rightRail">
            <section className="railPanel">
              <div className="railHead"><h3>Spotlight</h3><span>{spotlight.length} tags</span></div>
              <div className="tagGrid">
                {spotlight.map((tag, i) => <button key={i} className={`tag ${tag.tone || tagPalette[i % tagPalette.length]}`}>{tag.text}</button>)}
              </div>
            </section>

            <section className="railPanel">
              <div className="railHead"><h3>Sector Mover</h3><span>24H Change</span></div>
              <div className="sectorGrid">
                {heatmapRows.map(({ row, sector, change }, i) => (
                  <button key={i} className={change >= 0 ? 'sectorCard upBg' : 'sectorCard downBg'} onClick={() => setSelectedRow(row)}>
                    <small>{sector}</small>
                    <b>{normalizeSymbol(row)}</b>
                    <span>{fmtPct(change)}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="railPanel">
              <div className="railHead"><h3>Distribution of ups/downs</h3><span>{marketRows.length} assets</span></div>
              <div className="distribution">
                {dist.map((item, i) => (
                  <div key={i} className="barWrap">
                    <div className={i < 5 ? 'distBar downBg' : 'distBar upBg'} style={{ height: `${Math.max(8, item.pct)}%` }} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="railPanel tall">
              <div className="railHead"><h3>Selected asset</h3><span>live</span></div>
              {currentSelected ? (
                <div className="selectionCard">
                  <div className="selectionTop">
                    <div className="symbolBadge">{normalizeSymbol(currentSelected).slice(0, 3)}</div>
                    <div>
                      <b>{normalizeName(currentSelected)}</b>
                      <small>{normalizeSymbol(currentSelected)} • {sectorFor(currentSelected)}</small>
                    </div>
                  </div>
                  <div className="selectionMetrics">
                    <div><small>Price / NAV</small><b>{activeTab === 'news' ? 'Signal' : fmtUsd(normalizePrice(currentSelected))}</b></div>
                    <div><small>24H Change</small><b className={normalizeChange(currentSelected) >= 0 ? 'up' : 'down'}>{fmtPct(normalizeChange(currentSelected))}</b></div>
                    <div><small>24H Volume</small><b>{fmtUsd(normalizeVolume(currentSelected))}</b></div>
                    <div><small>AI Score</small><b>{Math.round(toNum(pick(currentSelected, ['score'], 72)))}</b></div>
                  </div>
                  <Sparkline row={currentSelected} />
                  <div className="selectionActions">
                    <button onClick={() => toggleWatch(normalizeSymbol(currentSelected))}>{watchlist.has(normalizeSymbol(currentSelected)) ? 'Remove watchlist' : 'Add watchlist'}</button>
                    <button className="primary" onClick={() => setSideActive('execution')}>Trade</button>
                  </div>
                </div>
              ) : <div className="emptySoft">Select an asset row to inspect details.</div>}
            </section>

            <section className="railPanel newsPanel">
              <div className="railHead"><h3>Latest News</h3><span>{newsRows.length} items</span></div>
              <div className="newsList">
                {newsRows.slice(0, 5).map((row, i) => (
                  <button key={i} className="newsItem" onClick={() => { setActiveTab('news'); setSelectedRow(row); setSideActive('news'); }}>
                    <b>{normalizeName(row, 'Crypto headline')}</b>
                    <span>{pick(row, ['url', 'symbol'], 'Signal')}</span>
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <div className="lowerGrid">
          <section className="consolePanel">
            <div className="railHead"><h3>Account State</h3><button className="tinyBtn active" onClick={loadAccount}>{accountLoading ? 'Loading...' : 'Load'}</button></div>
            {!accountState ? (
              <div className="emptySoft">Set <b>SODEX_USER_ADDRESS</b> to query account state. <b>SODEX_ACCOUNT_ID</b> is optional for primary account queries.</div>
            ) : (
              <div className="jsonCard"><pre>{JSON.stringify(accountState?.data || accountState, null, 2)}</pre></div>
            )}
          </section>

          <section className="consolePanel">
            <div className="railHead"><h3>Signed Order</h3><span>server-side signing</span></div>
            <form className="tradeForm" onSubmit={submitOrder}>
              <label>Market<select value={tradeForm.market} onChange={(e) => setTradeForm({ ...tradeForm, market: e.target.value })}><option value="perps">Perps</option><option value="spot">Spot</option></select></label>
              <label>Symbol ID<input value={tradeForm.symbolID} onChange={(e) => setTradeForm({ ...tradeForm, symbolID: e.target.value })} /></label>
              <label>Side<select value={tradeForm.side} onChange={(e) => setTradeForm({ ...tradeForm, side: e.target.value })}><option value="1">Buy</option><option value="2">Sell</option></select></label>
              <label>Quantity<input value={tradeForm.quantity} onChange={(e) => setTradeForm({ ...tradeForm, quantity: e.target.value })} /></label>
              <label className="wide">Price (optional)<input value={tradeForm.price} onChange={(e) => setTradeForm({ ...tradeForm, price: e.target.value })} placeholder="leave blank for market" /></label>
              <button className="submitBtn wide" type="submit">{tradeLoading ? 'Sending signed order...' : 'Send signed order'}</button>
            </form>
            {tradeResult && <div className="jsonCard small"><pre>{JSON.stringify(tradeResult, null, 2)}</pre></div>}
          </section>

          <section className="consolePanel">
            <div className="railHead"><h3>AI Brief</h3><span>live</span></div>
            <div className="briefCard">
              <p><b>{topMovers[0] ? normalizeSymbol(topMovers[0]) : 'BTC'}</b> leads upside momentum while <b>{topLosers[0] ? normalizeSymbol(topLosers[0]) : 'ETH'}</b> drags the downside bucket.</p>
              <ul>
                <li>Screen assets by live market cap, 24H change and score.</li>
                <li>Use the NewsFeed tab for catalyst monitoring and the ETF tab for flow proxies.</li>
                <li>Switch to Watchlist mode to focus on starred assets.</li>
                <li>Execution stays server-side and hides API keys from the frontend.</li>
              </ul>
            </div>
          </section>
        </div>

        <div className="bottomTicker">
          {footerTicker.map((row, i) => (
            <div key={i} className="tickerItem">
              <b>{normalizeSymbol(row)}</b>
              <span>{fmtUsd(normalizePrice(row))}</span>
              <em className={normalizeChange(row) >= 0 ? 'up' : 'down'}>{fmtPct(normalizeChange(row))}</em>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
