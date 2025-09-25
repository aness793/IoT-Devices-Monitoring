import { useEffect, useState } from "react";
import "./App.css";
function Dashboard() {
  const [data, setData] = useState([]);
  const [devices, setDevices] = useState([]);
  const [limit, setLimit] = useState(10);
  const [metricKeys, setMetricKeys] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState("");

  const API_BASE = "http://127.0.0.1:8000";

  const toClassSegment = (key) =>
    String(key)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const formatMetricValue = (value) => {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue.toFixed(2) : String(value);
  };

  const getUnitForMetric = (metricKey) => {
    const key = String(metricKey).toLowerCase();
    if (key.includes("temp")) return "°C";
    if (key.includes("humid")) return "%";
    if (key.includes("press")) return "Pa";
    return "";
  };

  const formatWithUnit = (metricKey, value) => {
    const unit = getUnitForMetric(metricKey);
    const formatted = formatMetricValue(value);
    return unit ? `${formatted} ${unit}` : formatted;
  };

  const isAboveNormal = (metricKey, value) => {
    const key = String(metricKey).toLowerCase();
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return false;
    if (key.includes("temp")) return numericValue > 30;
    // if (key.includes("humid")) return numericValue > 60;
    if (key.includes("press")) return numericValue > 101325 ;
    return false;
  };

  const fetchData = () => {
    const url = new URL(`${API_BASE}/data`);
    url.searchParams.set("limit", String(limit));
    if (selectedMetric) {
      url.searchParams.set("metric", selectedMetric);
    }
    fetch(url.toString())
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error(err));
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
  }, [limit, selectedMetric]);

  const renderRow = (row) => {
    // If a metric is selected, backend returns {device, metric, value, timestamp}
    if (selectedMetric) {
      const alert = isAboveNormal(selectedMetric, row.value);
      return (
        <div key={`${row.device}-${row.timestamp}`} className={`display_all ${alert ? 'alert_display' : ''}`}>
          <div className="cell"><span className="title">Device:</span> <span className="value">{row.device}</span></div>
          <div className={`cell ${alert ? 'alert' : ''}`}><span className="title">{selectedMetric}:</span> <span className="value">{formatWithUnit(selectedMetric, row.value)}</span></div>
          <div className="cell"><span className="title">Time:</span> <span className="time">{row.timestamp}</span></div>
        </div>
      );
    }
    // Otherwise backend returns {device, data: {..}, timestamp}
    const entries = row.data ? Object.entries(row.data) : [];
    const anyAlert = entries.some(([k, v]) => isAboveNormal(k, v));
    return (
      <div key={`${row.device}-${row.timestamp}`} className={`display ${anyAlert ? 'alert_display' : ''}`}>
        <div className="cell"><span className="title">Device:</span> <span className="value">{row.device}</span></div>
        {entries.map(([k, v], idx) => {
          const alert = isAboveNormal(k, v);
          return (
            <div className={`cell ${alert ? 'alert' : ''}`} key={`${row.device}-${row.timestamp}-${k}-${idx}`}>
              <span className="title">{k}:</span> <span className="value">{formatWithUnit(k, v)}</span>
            </div>
          );
        })}
        <div className="cell"><span className="title">time:</span> <span className="time">{row.timestamp}</span></div>
      </div>
    );
  };

  return (
    <div>
      <div className="bar">
        <p>online devices: {devices.length}</p>
      <label>
        Limit: 
        <input
          type="number"
          value= {limit}
          onChange={handleLimitChange}
          min="1"
        />
      </label>

      <label style={{ marginLeft: 12 }}>
        Metric:
        <select value={selectedMetric} onChange={handleMetricChange}>
          <option value="">All</option>
          {metricKeys.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </label>
      </div>
      <div className="content">
          <div className="data_title"><h2>IoT Device Data</h2></div>
        <div className="oneData">
          {limit > 0 && data.length > 0 && data.map((row) => renderRow(row))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
