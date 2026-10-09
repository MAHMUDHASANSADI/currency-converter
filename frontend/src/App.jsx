import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { convert, getCurrencies, getHistory } from './api';
import './styles.css';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const displayNames = new Intl.DisplayNames(['en'], { type: 'currency' });

function currencyLabel(code) {
  try { return `${code} — ${displayNames.of(code)}`; } catch { return code; }
}

function fmt(n, decimals = 2) {
  if (n == null || isNaN(Number(n))) return '—';
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtRate(n) {
  if (n == null || isNaN(Number(n))) return '—';
  // Show enough precision for very small / very large rates
  const abs = Math.abs(Number(n));
  const dec = abs >= 100 ? 4 : abs >= 1 ? 6 : 8;
  return Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: dec,
  });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)  return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

/* ─── Sparkline ───────────────────────────────────────────────────────────── */
function Sparkline({ points, from, to }) {
  if (!points || points.length < 2) {
    return (
      <div className="empty-history" role="status" aria-label="No history yet">
        <span>📈</span>
        <p>History builds up as the server collects daily snapshots.</p>
      </div>
    );
  }

  const vals  = points.map((p) => p.rate);
  const min   = Math.min(...vals);
  const max   = Math.max(...vals);
  const span  = max - min || 1;
  const W = 500, H = 80, pad = 4;

  // Build polyline points + filled area path
  const pts = points.map((p, i) => ({
    x: pad + (i / (points.length - 1)) * (W - pad * 2),
    y: H - pad - ((p.rate - min) / span) * (H - pad * 2),
  }));

  const lineStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const areaStr = `M${pts[0].x},${H} ` +
                  pts.map((p) => `L${p.x},${p.y}`).join(' ') +
                  ` L${pts[pts.length - 1].x},${H} Z`;

  const first  = vals[0];
  const last   = vals[vals.length - 1];
  const change = ((last - first) / first) * 100;
  const changeClass = change > 0.01 ? 'up' : change < -0.01 ? 'down' : 'flat';
  const changeSign  = change > 0 ? '+' : '';

  return (
    <>
      <div className="spark-wrap" role="img" aria-label={`${from} to ${to} rate history`}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#6366f1" stopOpacity=".25" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0"   />
            </linearGradient>
          </defs>
          <path d={areaStr} fill="url(#sparkGrad)" />
          <polyline points={lineStr} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {/* End dot */}
          <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3.5" fill="#6366f1" />
        </svg>
      </div>

      <div className="spark-stats">
        <span className="spark-stat">
          Low <strong>{fmtRate(min)}</strong>
        </span>
        <span className={`spark-change ${changeClass}`}>
          {changeSign}{fmt(change, 2)}%
        </span>
        <span className="spark-stat">
          High <strong>{fmtRate(max)}</strong>
        </span>
      </div>
    </>
  );
}

/* ─── Main App ────────────────────────────────────────────────────────────── */
export default function App() {
  const [currencies, setCurrencies]     = useState([]);
  const [from, setFrom]                 = useState('MYR');
  const [to, setTo]                     = useState('BDT');
  const [amount, setAmount]             = useState('1000');
  const [result, setResult]             = useState(null);
  const [history, setHistory]           = useState([]);
  const [days, setDays]                 = useState(30);

  // Loading states
  const [loadingCurrencies, setLoadingCurrencies] = useState(true);
  const [loadingConvert, setLoadingConvert]       = useState(false);
  const [loadingHistory, setLoadingHistory]       = useState(false);

  // Error states
  const [currencyError, setCurrencyError]   = useState('');
  const [convertError, setConvertError]     = useState('');
  const [isOffline, setIsOffline]           = useState(!navigator.onLine);

  const convertTimer = useRef(null);

  /* Online/offline detection */
  useEffect(() => {
    const goOnline  = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
  }, []);

  /* Load currency list */
  const loadCurrencies = useCallback(() => {
    setLoadingCurrencies(true);
    setCurrencyError('');
    getCurrencies()
      .then((r) => { setCurrencies(r.currencies || []); setCurrencyError(''); })
      .catch((e) => setCurrencyError(e.message || 'Failed to load currencies.'))
      .finally(() => setLoadingCurrencies(false));
  }, []);

  useEffect(() => { loadCurrencies(); }, [loadCurrencies]);

  /* Debounced conversion */
  const runConvert = useCallback(() => {
    const num = parseFloat(amount);
    if (!currencies.length || isNaN(num) || num < 0) return;
    setLoadingConvert(true);
    setConvertError('');
    convert(from, to, num)
      .then((r) => { setResult(r); setConvertError(''); })
      .catch((e) => { setConvertError(e.message || 'Conversion failed. Please try again.'); })
      .finally(() => setLoadingConvert(false));
  }, [from, to, amount, currencies]);

  useEffect(() => {
    clearTimeout(convertTimer.current);
    convertTimer.current = setTimeout(runConvert, 300);
    return () => clearTimeout(convertTimer.current);
  }, [runConvert]);

  /* Load history */
  useEffect(() => {
    if (!currencies.length) return;
    setLoadingHistory(true);
    setHistory([]);
    getHistory(from, to, days)
      .then((r) => setHistory(r.points || []))
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [from, to, days, currencies]);

  /* Swap currencies */
  const swap = () => {
    setFrom(to);
    setTo(from);
    setResult(null);
  };

  /* Currency options */
  const options = useMemo(
    () => currencies.map((c) => <option key={c} value={c}>{currencyLabel(c)}</option>),
    [currencies],
  );

  const amountNum = parseFloat(amount);
  const amountValid = !isNaN(amountNum) && amountNum >= 0;

  return (
    <>
      {/* Page header */}
      <header className="page-header">
        <div className="logo" aria-hidden="true">💱</div>
        <div>
          <h1>FX Converter</h1>
          <p>Live mid-market exchange rates</p>
        </div>
      </header>

      {/* Offline warning */}
      {isOffline && (
        <div className="offline-banner" role="alert">
          ⚠️ You appear to be offline. Showing last known rates.
        </div>
      )}

      <main className="card" role="main">

        {/* ── Input section ── */}
        <div className="card-body">

          {/* Amount */}
          <div className="field">
            <label htmlFor="amount">Amount</label>
            <input
              id="amount"
              type="number"
              min="0"
              step="any"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-describedby={convertError ? 'convert-error' : undefined}
              aria-invalid={!amountValid || undefined}
            />
          </div>

          {/* From / Swap / To */}
          <div className="currency-row">
            <div className="field">
              <label htmlFor="from-currency">From</label>
              <div className="select-wrap">
                {loadingCurrencies ? (
                  <div className="skeleton" style={{ height: 46 }} aria-label="Loading currencies" />
                ) : (
                  <select
                    id="from-currency"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    disabled={!currencies.length}
                    aria-label="Source currency"
                  >
                    {options}
                  </select>
                )}
              </div>
            </div>

            <button
              className="swap-btn"
              onClick={swap}
              aria-label="Swap currencies"
              title="Swap currencies"
              disabled={loadingCurrencies}
            >
              ⇄
            </button>

            <div className="field">
              <label htmlFor="to-currency">To</label>
              <div className="select-wrap">
                {loadingCurrencies ? (
                  <div className="skeleton" style={{ height: 46 }} aria-label="Loading currencies" />
                ) : (
                  <select
                    id="to-currency"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    disabled={!currencies.length}
                    aria-label="Target currency"
                  >
                    {options}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Currency load error */}
          {currencyError && (
            <div className="error-banner" role="alert">
              <span className="error-icon" aria-hidden="true">⚠️</span>
              <div>
                {currencyError}
                <button className="error-retry" onClick={loadCurrencies}>Retry</button>
              </div>
            </div>
          )}

          {/* Convert button */}
          <button
            className={`convert-btn${loadingConvert ? ' loading' : ''}`}
            onClick={runConvert}
            disabled={loadingConvert || loadingCurrencies || !amountValid || !currencies.length}
            aria-label={loadingConvert ? 'Converting…' : 'Convert currency'}
          >
            {loadingConvert
              ? <><span className="spinner" aria-hidden="true" />Converting…</>
              : 'Convert'
            }
          </button>

          {/* Convert error */}
          {convertError && !loadingConvert && (
            <div className="error-banner" id="convert-error" role="alert">
              <span className="error-icon" aria-hidden="true">⚠️</span>
              <div>
                {convertError}
                <button className="error-retry" onClick={runConvert}>Retry</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Result section ── */}
        {result && !convertError && (
          <section className="result-section" aria-label="Conversion result" aria-live="polite">
            <div className="result-label">Result</div>
            <div className="result-amount" aria-label={`${fmt(result.result)} ${result.to}`}>
              {fmt(result.result)}
              <span>{result.to}</span>
            </div>
            <div className="result-from">
              {fmt(result.amount)} {result.from} at today's rate
            </div>
            <div className="result-rates" role="list" aria-label="Exchange rates">
              <div className="rate-chip" role="listitem">
                1 {result.from} = {fmtRate(result.rate)} {result.to}
              </div>
              <div className="rate-chip" role="listitem">
                1 {result.to} = {fmtRate(result.inverse_rate)} {result.from}
              </div>
            </div>
            {result.updated_at && (
              <div className="result-meta" aria-label="Rate freshness">
                <span className="live-dot" aria-hidden="true" />
                Mid-market rate · Updated {timeAgo(result.updated_at)}
              </div>
            )}
          </section>
        )}

        {/* ── History section ── */}
        <section className="card-section" aria-label={`${from} to ${to} rate history`}>
          <div className="history-header">
            <h2 className="history-title">
              Rate History
              <span className="history-pair">{from} → {to}</span>
            </h2>
            <div className="select-wrap">
              <select
                className="days-select"
                value={days}
                onChange={(e) => setDays(+e.target.value)}
                aria-label="History period"
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
          </div>

          {loadingHistory
            ? <div className="skeleton" style={{ height: 90, borderRadius: 8 }} aria-label="Loading history" />
            : <Sparkline points={history} from={from} to={to} />
          }
        </section>
      </main>

      {/* Footer */}
      <footer>
        Mid-market rates · Not suitable for financial transactions ·{' '}
        Rates by{' '}
        <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer">
          ExchangeRate-API
        </a>
      </footer>
    </>
  );
}
