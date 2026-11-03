import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = "http://127.0.0.1:8000";

// Display ranges for the bars on each device card. `limit` is the same
// threshold used by isAboveNormal below (drawn as a tick when it fits the scale).
const METRIC_SCALE = {
  temp: { min: 0, max: 60, limit: 30 },
  humid: { min: 0, max: 100 },
  press: { min: 800, max: 1250, limit: 101325 },
};

const metricType = (metricKey) => {
  const key = String(metricKey).toLowerCase();
  if (key.includes("temp")) return "temp";
  if (key.includes("humid")) return "humid";
  if (key.includes("press")) return "press";
  return "other";
};

const formatMetricValue = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : String(value);
};

const getUnitForMetric = (metricKey) => {
  const type = metricType(metricKey);
  if (type === "temp") return "°C";
  if (type === "humid") return "%";
  if (type === "press") return "Pa";
  return "";
};

const isAboveNormal = (metricKey, value) => {
  const type = metricType(metricKey);
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return false;
  if (type === "temp") return numericValue > 30;
  if (type === "press") return numericValue > 101325;
  return false;
};

const toPercent = (metricKey, value) => {
  const scale = METRIC_SCALE[metricType(metricKey)];
  const numericValue = Number(value);
  if (!scale || !Number.isFinite(numericValue)) return null;
  const pct = ((numericValue - scale.min) / (scale.max - scale.min)) * 100;
  return Math.max(0, Math.min(100, pct));
};

const toLimitPercent = (metricKey) => {
  const scale = METRIC_SCALE[metricType(metricKey)];
  if (!scale || scale.limit == null) return null;
  if (scale.limit < scale.min || scale.limit > scale.max) return null;
  return ((scale.limit - scale.min) / (scale.max - scale.min)) * 100;
};

// Both response shapes ({data: {...}} and {metric, value}) become [[key, value], ...]
const rowEntries = (row, selectedMetric) =>
  selectedMetric ? [[selectedMetric, row.value]] : row.data ? Object.entries(row.data) : [];

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" className="logo-bg" />
      <path d="M9 21a9 9 0 0 1 14 0" className="logo-arc" />
      <path d="M12.5 17.5a4.5 4.5 0 0 1 7 0" className="logo-arc" />
      <circle cx="16" cy="23" r="1.9" className="logo-dot" />
    </svg>
  );
}

function Dashboard() {
  const [data, setData] = useState([]);
  const [devices, setDevices] = useState([]);
  const [limit, setLimit] = useState(10);
  const [metricKeys, setMetricKeys] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState("");
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = () => {
    const url = new URL(`${API_BASE}/data`);
    url.searchParams.set("limit", String(limit));
    if (selectedMetric) {
      url.searchParams.set("metric", selectedMetric);
    }
    fetch(url.toString())
      .then((res) => res.json())
      .then((json) => {
        setData(Array.isArray(json) ? json : []);
        setError(false);
        setLastUpdated(new Date());
      })
      .catch((err) => {
        console.error(err);
        setError(true);
      });
  };

  const fetchDevices = () => {
    fetch(`${API_BASE}/devices`)
      .then((res) => res.json())
      .then((json) => setDevices(json))
      .catch((err) => console.error(err));
  };

  const fetchMetricKeys = () => {
    fetch(`${API_BASE}/metrics`)
      .then((res) => res.json())
      .then((json) => setMetricKeys(Array.isArray(json) ? json : []))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    const savedLimit = localStorage.getItem("limit");
    const savedMetric = localStorage.getItem("selectedMetric");
    if (savedLimit) setLimit(Number(savedLimit));
    if (savedMetric) setSelectedMetric(savedMetric);
  }, []);

  const handleLimitChange = (e) => {
    const newLimit = Number(e.target.value);
    setLimit(newLimit);
    localStorage.setItem("limit", String(newLimit));
  };

  const handleMetricChange = (e) => {
    const value = e.target.value;
    setSelectedMetric(value);
    localStorage.setItem("selectedMetric", value);
  };

  useEffect(() => {
    fetchData();
    fetchDevices();
    fetchMetricKeys();

    const interval = setInterval(() => {
      fetchData();
      fetchDevices();
      fetchMetricKeys();
    }, 5000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, selectedMetric]);

  const rows = limit > 0 ? data : [];

  // Newest reading per device (the API returns newest first).
  const latestByDevice = useMemo(() => {
    const seen = new Map();
    rows.forEach((row) => {
      if (!seen.has(row.device)) seen.set(row.device, row);
    });
    return [...seen.values()].sort((a, b) =>
      String(a.device).localeCompare(String(b.device), undefined, { numeric: true })
    );
  }, [rows]);

  const alertCount = rows.filter((row) =>
    rowEntries(row, selectedMetric).some(([k, v]) => isAboveNormal(k, v))
  ).length;

  const newestTime = rows.length ? rows[0].timestamp : "–";

  const renderValue = (k, v) => {
    const unit = getUnitForMetric(k);
    return (
      <>
        <span className="num">{formatMetricValue(v)}</span>
        {unit && <span className="unit">{unit}</span>}
      </>
    );
  };

  const renderDeviceCard = (row) => {
    const entries = rowEntries(row, selectedMetric);
    const hot = entries.some(([k, v]) => isAboveNormal(k, v));
    return (
      <article className={`device ${hot ? "is-alert" : "is-ok"}`} key={`card-${row.device}`}>
        <header className="device-head">
          <h3>Device {row.device}</h3>
          <span className={`chip ${hot ? "chip-alert" : "chip-ok"}`}>
            {hot ? "Over limit" : "Normal"}
          </span>
        </header>
        <dl className="gauges">
          {entries.map(([k, v]) => {
            const alert = isAboveNormal(k, v);
            const pct = toPercent(k, v);
            const tick = toLimitPercent(k);
            return (
              <div className={`gauge ${alert ? "is-alert" : ""}`} key={k}>
                <dt>{k}</dt>
                <dd className="gauge-value">{renderValue(k, v)}</dd>
                {pct !== null && (
                  <div className="track" aria-hidden="true">
                    <div className="fill" style={{ width: `${pct}%` }} />
                    {tick !== null && <div className="tick" style={{ left: `${tick}%` }} />}
                  </div>
                )}
              </div>
            );
          })}
        </dl>
        <footer className="device-foot">{row.timestamp}</footer>
      </article>
    );
  };

  const renderRow = (row) => {
    const entries = rowEntries(row, selectedMetric);
    const anyAlert = entries.some(([k, v]) => isAboveNormal(k, v));
    return (
      <li
        key={`${row.device}-${row.timestamp}`}
        className={`log-row ${anyAlert ? "is-alert" : ""}`}
        style={{ "--cols": entries.length }}
      >
        <div className="cell cell-device">
          <span className="title">Device</span>
          <span className="value">{row.device}</span>
        </div>
        {entries.map(([k, v], idx) => {
          const alert = isAboveNormal(k, v);
          return (
            <div className={`cell ${alert ? "alert" : ""}`} key={`${k}-${idx}`}>
              <span className="title">{k}</span>
              <span className="value">{renderValue(k, v)}</span>
            </div>
          );
        })}
        <div className="cell cell-time">
          <span className="title">Time</span>
          <span className="value time">{row.timestamp}</span>
        </div>
      </li>
    );
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <Logo />
            <div className="brand-text">
              <h1>IoT Device Monitor</h1>
              <p className={`live ${error ? "live-down" : ""}`}>
                <span className="pulse" aria-hidden="true" />
                {error
                  ? "Disconnected"
                  : lastUpdated
                  ? `Live, updated ${lastUpdated.toLocaleTimeString()}`
                  : "Connecting…"}
              </p>
            </div>
          </div>

          <div className="controls">
            <label className="field">
              <span>Readings</span>
              <input type="number" value={limit} onChange={handleLimitChange} min="1" />
            </label>
            <label className="field">
              <span>Metric</span>
              <select value={selectedMetric} onChange={handleMetricChange}>
                <option value="">All</option>
                {metricKeys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </header>

      <main className="page">
        {error && (
          <div className="banner" role="alert">
            <strong>Can't reach the API.</strong> Check that the backend is running at {API_BASE}.
            The dashboard keeps retrying every 5 seconds.
          </div>
        )}

        <section className="summary" aria-label="Fleet summary">
          <div className="stat">
            <span className="stat-num">{devices.length}</span>
            <span className="stat-label">Online devices</span>
          </div>
          <div className="stat">
            <span className="stat-num">{rows.length}</span>
            <span className="stat-label">Readings shown</span>
          </div>
          <div className={`stat ${alertCount ? "stat-alert" : "stat-good"}`}>
            <span className="stat-num">{alertCount}</span>
            <span className="stat-label">Readings over limit</span>
          </div>
          <div className="stat stat-time">
            <span className="stat-num stat-num-sm">{newestTime}</span>
            <span className="stat-label">Newest reading</span>
          </div>
        </section>

        {rows.length === 0 && !error ? (
          <div className="empty">
            <h2>No readings yet</h2>
            <p>Start the device simulator and readings will show up here within a few seconds.</p>
          </div>
        ) : (
          <>
            {latestByDevice.length > 0 && (
              <section className="block">
                <div className="block-head">
                  <h2>Devices</h2>
                  <p>Latest reading from each device. The tick marks the alert threshold.</p>
                </div>
                <div className="devices">{latestByDevice.map(renderDeviceCard)}</div>
              </section>
            )}

            {rows.length > 0 && (
              <section className="block">
                <div className="block-head">
                  <h2>Reading log</h2>
                  <p>Newest first. Highlighted rows have a value over its limit.</p>
                </div>
                <ul className="log">{rows.map(renderRow)}</ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
