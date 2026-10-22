"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Dashboard() {
  const [sensorRows, setSensorRows] = useState([]);
  const [latestData, setLatestData] = useState({
    temperature: "--",
    humidity: "--",
    timestamp: "--",
  });
  const [status, setStatus] = useState("CONNECTING");
  const [dbStatus, setDbStatus] = useState(() => (isFirebaseConfigured ? "CONNECTED" : "DISCONNECTED"));
  const [deviceStatus, setDeviceStatus] = useState("CHECKING"); // "ONLINE" | "OFFLINE"
  const [lastSeenMinutes, setLastSeenMinutes] = useState(null);
  const [timeRange, setTimeRange] = useState("5m"); // "1m" | "5m" | "1h"

  // Evaluasi apakah alat IoT (ESP32) aktif / tersambung berdasarkan waktu data terakhir
  useEffect(() => {
    if (!latestData.timestamp || latestData.timestamp === "--") {
      setDeviceStatus("OFFLINE");
      setLastSeenMinutes(null);
      return;
    }

    function evaluateDevice() {
      try {
        const parts = latestData.timestamp.split(" ");
        if (parts.length >= 2) {
          const [y, m, d] = parts[0].split("-").map(Number);
          const [hh, mm, ss] = parts[1].split(":").map(Number);
          const recordTime = new Date(y, m - 1, d, hh, mm, ss).getTime();
          const diffMinutes = Math.floor((Date.now() - recordTime) / (1000 * 60));
          setLastSeenMinutes(diffMinutes);
          // Bila data diterima dalam 15 menit terakhir, alat dianggap aktif ONLINE
          if (diffMinutes >= 0 && diffMinutes <= 15) {
            setDeviceStatus("ONLINE");
          } else {
            setDeviceStatus("OFFLINE");
          }
          return;
        }
      } catch (e) {
        // Abaikan parsing error
      }
      setDeviceStatus("OFFLINE");
    }

    evaluateDevice();
    const interval = setInterval(evaluateDevice, 15000);
    return () => clearInterval(interval);
  }, [latestData.timestamp]);

  useEffect(() => {
    let unsubscribe = null;

    if (isFirebaseConfigured && db) {
      try {
        const q = query(
          collection(db, "sensor_data"),
          orderBy("timestamp", "desc"),
          limit(1000)
        );

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            setDbStatus("CONNECTED");
            if (snapshot.empty) {
              setDeviceStatus("OFFLINE");
              fetchFallback();
              return;
            }

            const docs = [];
            snapshot.forEach((doc) => {
              const d = doc.data();
              docs.push({
                id: doc.id,
                timestamp: d.timestamp || "--",
                temperature: Number(d.temperature) || 0,
                humidity: Number(d.humidity) || 0,
              });
            });

            const chronological = [...docs].reverse();
            setSensorRows(chronological);

            const newest = docs[0];
            setLatestData({
              temperature: Number(newest.temperature).toFixed(1),
              humidity: Number(newest.humidity).toFixed(1),
              timestamp: newest.timestamp,
            });
            setStatus("ONLINE (Firebase Realtime)");
          },
          (error) => {
            console.error("Firestore listener error:", error);
            setDbStatus("DISCONNECTED");
            fetchFallback();
          }
        );
      } catch (e) {
        console.error("Firebase setup error:", e);
        setDbStatus("DISCONNECTED");
        fetchFallback();
      }
    } else {
      setDbStatus("DISCONNECTED");
      fetchFallback();
      const interval = setInterval(fetchFallback, 5000);
      return () => clearInterval(interval);
    }

    async function fetchFallback() {
      try {
        const res = await fetch("/api/data");
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setSensorRows(data);
          const latest = data[data.length - 1];
          setLatestData({
            temperature: Number(latest.temperature).toFixed(1),
            humidity: Number(latest.humidity).toFixed(1),
            timestamp: latest.timestamp,
          });
          setStatus(isFirebaseConfigured ? "ONLINE" : "ONLINE (Demo Mode)");
        } else {
          setStatus("NO DATA");
        }
      } catch (err) {
        console.error(err);
        setStatus("OFFLINE");
      }
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Filter baris data berdasarkan rentang waktu yang dipilih (1 Menit, 5 Menit, atau 1 Jam)
  const filteredRows = useMemo(() => {
    if (!sensorRows || sensorRows.length === 0) return [];

    const newest = sensorRows[sensorRows.length - 1];
    if (!newest?.timestamp || !newest.timestamp.includes(" ")) {
      if (timeRange === "1m") return sensorRows.slice(-60);
      if (timeRange === "5m") return sensorRows.slice(-300);
      return sensorRows;
    }

    try {
      const [y, m, d] = newest.timestamp.split(" ")[0].split("-").map(Number);
      const [hh, mm, ss] = newest.timestamp.split(" ")[1].split(":").map(Number);
      const latestTimeMs = new Date(y, m - 1, d, hh, mm, ss).getTime();

      let rangeMs = 5 * 60 * 1000;
      if (timeRange === "1m") rangeMs = 1 * 60 * 1000;
      if (timeRange === "1h") rangeMs = 60 * 60 * 1000;

      const minTimeMs = latestTimeMs - rangeMs;

      const matched = sensorRows.filter((r) => {
        if (!r.timestamp || !r.timestamp.includes(" ")) return false;
        const [ry, rm, rd] = r.timestamp.split(" ")[0].split("-").map(Number);
        const [rhh, rmm, rss] = r.timestamp.split(" ")[1].split(":").map(Number);
        const tMs = new Date(ry, rm - 1, rd, rhh, rmm, rss).getTime();
        return tMs >= minTimeMs;
      });

      if (timeRange === "1m" && matched.length < 5) return sensorRows.slice(-60);
      if (timeRange === "5m" && matched.length < 5) return sensorRows.slice(-300);
      if (timeRange === "1h" && matched.length < 5) return sensorRows;

      return matched;
    } catch (e) {
      if (timeRange === "1m") return sensorRows.slice(-60);
      if (timeRange === "5m") return sensorRows.slice(-300);
      return sensorRows;
    }
  }, [sensorRows, timeRange]);

  // Downsample data jika terlalu padat (maks 120 titik) agar render grafik super halus
  const chartRows = useMemo(() => {
    if (filteredRows.length <= 120) return filteredRows;
    const step = Math.ceil(filteredRows.length / 120);
    const sampled = [];
    for (let i = 0; i < filteredRows.length; i += step) {
      sampled.push(filteredRows[i]);
    }
    if (sampled[sampled.length - 1] !== filteredRows[filteredRows.length - 1]) {
      sampled.push(filteredRows[filteredRows.length - 1]);
    }
    return sampled;
  }, [filteredRows]);

  const timeRangeLabel =
    timeRange === "1m" ? "1 Menit Terakhir" : timeRange === "5m" ? "5 Menit Terakhir" : "1 Jam Terakhir";

  const chartLabels = chartRows.map((r) => {
    const parts = r.timestamp.split(" ");
    return parts[1] || r.timestamp;
  });
  const chartTemps = chartRows.map((r) => Number(r.temperature));
  const chartHums = chartRows.map((r) => Number(r.humidity));

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: "Suhu (°C)",
        data: chartTemps,
        yAxisID: "y",
        borderColor: "#2563eb",
        backgroundColor: "rgba(37, 99, 235, 0.08)",
        borderWidth: 2.5,
        pointRadius: 2.5,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.35,
      },
      {
        label: "Kelembapan (%RH)",
        data: chartHums,
        yAxisID: "y1",
        borderColor: "#0d9488",
        backgroundColor: "rgba(13, 148, 136, 0.08)",
        borderWidth: 2.5,
        pointRadius: 2.5,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.35,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "bottom",
        labels: { font: { size: 12, weight: 600 }, padding: 18 },
      },
    },
    scales: {
      x: {
        grid: { color: "#f1f5f9" },
        ticks: { maxTicksLimit: 8, maxRotation: 0, font: { size: 11 } },
      },
      y: {
        type: "linear",
        position: "left",
        title: { display: true, text: "Suhu (°C)", font: { weight: "bold" } },
        grid: { color: "#f1f5f9" },
        ticks: { font: { size: 11 } },
      },
      y1: {
        type: "linear",
        position: "right",
        title: { display: true, text: "Kelembapan (%RH)", font: { weight: "bold" } },
        grid: { drawOnChartArea: false },
        ticks: { font: { size: 11 } },
      },
    },
  };

  const recentTableRows = [...sensorRows].reverse().slice(0, 20);

  return (
    <main className="container">
      {/* 1. NOTIFIKASI DATABASE TIDAK TERSAMBUNG */}
      {dbStatus === "DISCONNECTED" && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderLeft: "4px solid #ef4444",
            color: "#991b1b",
            padding: "14px 18px",
            borderRadius: "10px",
            marginBottom: "20px",
            fontSize: "13.5px",
            lineHeight: "1.5",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            boxShadow: "0 2px 5px rgba(239, 68, 68, 0.08)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <div>
            <strong>Peringatan: Database Tidak Tersambung!</strong> Aplikasi belum terhubung ke database Cloud Firebase Firestore. Pastikan kredensial di file <code>.env.local</code> sudah benar dan koneksi internet stabil.
          </div>
        </div>
      )}

      {/* 2. NOTIFIKASI ALAT IOT BELUM TERSAMBUNG */}
      {dbStatus === "CONNECTED" && deviceStatus === "OFFLINE" && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderLeft: "4px solid #f59e0b",
            color: "#92400e",
            padding: "14px 18px",
            borderRadius: "10px",
            marginBottom: "20px",
            fontSize: "13.5px",
            lineHeight: "1.5",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            boxShadow: "0 2px 5px rgba(245, 158, 11, 0.08)",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <strong>Peringatan: Alat IoT / Sensor Belum Tersambung!</strong>
            {lastSeenMinutes !== null && lastSeenMinutes >= 0 ? (
              <span> Sinyal data terakhir diterima <strong>{lastSeenMinutes} menit yang lalu</strong> (alat sedang tidak aktif/mati).</span>
            ) : (
              <span> Belum ada data masuk dari alat ESP32 (DHT22).</span>
            )}
            {" "}Pastikan modul ESP32 sudah menyala, tersambung ke Wi-Fi, dan rutin mengirim data ke endpoint <code>/api/sensor</code>.
          </div>
        </div>
      )}

      {/* SENSOR LIVE CARDS */}
      <div className="metric-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        {/* SUHU */}
        <div className="metric-card temp">
          <div className="metric-header">
            <span className="metric-title">Temperature (Suhu Live)</span>
            <div className="metric-icon-wrap temp">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
              </svg>
            </div>
          </div>
          <div className="metric-value">
            {latestData.temperature}
            <span className="metric-unit"> °C</span>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span className={`metric-status-badge ${deviceStatus === "ONLINE" ? "badge-optimal" : "badge-warning"}`}>
              {deviceStatus === "ONLINE" ? "● LIVE DHT22" : "○ DHT22 OFFLINE"}
            </span>
            {latestData.temperature !== "--" && (
              <span className="metric-status-badge badge-info">
                Target: 37.5°C - 38.0°C
              </span>
            )}
          </div>
        </div>

        {/* KELEMBAPAN */}
        <div className="metric-card humidity">
          <div className="metric-header">
            <span className="metric-title">Relative Humidity (Kelembapan Live)</span>
            <div className="metric-icon-wrap humidity">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            </div>
          </div>
          <div className="metric-value">
            {latestData.humidity}
            <span className="metric-unit"> %RH</span>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span className={`metric-status-badge ${deviceStatus === "ONLINE" ? "badge-optimal" : "badge-warning"}`}>
              {deviceStatus === "ONLINE" ? "● LIVE DHT22" : "○ DHT22 OFFLINE"}
            </span>
            {latestData.humidity !== "--" && (
              <span className="metric-status-badge badge-info">
                Target: 55% - 65%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* STATUS CARD */}
      <div className="panel" style={{ padding: "20px 26px" }}>
        <div className="status-row">
          <span className="status-label">Koneksi Database</span>
          <span
            className="status-value"
            style={{
              color: dbStatus === "CONNECTED" ? "#15803d" : "#dc2626",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: "600",
            }}
          >
            {dbStatus === "CONNECTED" ? "● Terhubung (Firebase Firestore)" : "● Terputus"}
          </span>
        </div>
        <div className="status-row">
          <span className="status-label">Koneksi Alat IoT (ESP32)</span>
          <span
            className="status-value"
            style={{
              color: deviceStatus === "ONLINE" ? "#15803d" : "#d97706",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: "600",
            }}
          >
            {deviceStatus === "ONLINE"
              ? "● Tersambung & Aktif (Online)"
              : "● Belum Tersambung / Tidak Aktif"}
          </span>
        </div>
        <div className="status-row">
          <span className="status-label">Last Sensor Update</span>
          <span className="status-value">{latestData.timestamp}</span>
        </div>
        <div className="status-row">
          <span className="status-label">Sensor Type</span>
          <span className="status-value">DHT22 (Temperature &amp; Humidity)</span>
        </div>
        <div className="status-row">
          <span className="status-label">Platform Architecture</span>
          <span className="status-value">ESP32 + Next.js + Firebase Cloud</span>
        </div>
      </div>

      {/* GRAPH DATA SENSOR (LIVE RECORDING) */}
      <div className="graph-card">
        <div
          className="graph-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div>
            <div className="graph-title">Grafik Suhu &amp; Kelembapan Real-Time (Live Recording)</div>
            <div className="graph-desc">
              Visualisasi rekaman sensor per detik — Rentang aktif: <strong>{timeRangeLabel}</strong> ({filteredRows.length} titik sampel).
            </div>
          </div>

          {/* RENTANG WAKTU SELECTOR: 1 Menit, 5 Menit, 1 Jam */}
          <div
            style={{
              display: "inline-flex",
              background: "#f1f5f9",
              padding: "4px",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              gap: "4px",
            }}
          >
            <button
              type="button"
              id="btn-range-1m"
              onClick={() => setTimeRange("1m")}
              style={{
                border: "none",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: timeRange === "1m" ? "700" : "500",
                background: timeRange === "1m" ? "#2563eb" : "transparent",
                color: timeRange === "1m" ? "white" : "#475569",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: timeRange === "1m" ? "0 2px 6px rgba(37,99,235,0.25)" : "none",
              }}
            >
              ⏱ 1 Menit
            </button>
            <button
              type="button"
              id="btn-range-5m"
              onClick={() => setTimeRange("5m")}
              style={{
                border: "none",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: timeRange === "5m" ? "700" : "500",
                background: timeRange === "5m" ? "#2563eb" : "transparent",
                color: timeRange === "5m" ? "white" : "#475569",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: timeRange === "5m" ? "0 2px 6px rgba(37,99,235,0.25)" : "none",
              }}
            >
              ⏱ 5 Menit
            </button>
            <button
              type="button"
              id="btn-range-1h"
              onClick={() => setTimeRange("1h")}
              style={{
                border: "none",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: timeRange === "1h" ? "700" : "500",
                background: timeRange === "1h" ? "#2563eb" : "transparent",
                color: timeRange === "1h" ? "white" : "#475569",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: timeRange === "1h" ? "0 2px 6px rgba(37,99,235,0.25)" : "none",
              }}
            >
              ⏱ 1 Jam
            </button>
          </div>
        </div>
        <div className="graph-box">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* RECENT DATA TABLE */}
      <div className="table-card">
        <div className="panel-header" style={{ marginBottom: "16px" }}>
          <div>
            <div className="panel-title">Recent Sensor Data</div>
            <div className="graph-desc" style={{ marginTop: "4px" }}>
              20 data pembacaan sensor terakhir yang diterima server.
            </div>
          </div>
          <Link href="/rekap" className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Buka Rekapitulasi 21 Hari
          </Link>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Waktu Pencatatan</th>
                <th>Suhu (°C)</th>
                <th>Kelembapan (%RH)</th>
              </tr>
            </thead>
            <tbody>
              {recentTableRows.length > 0 ? (
                recentTableRows.map((row, index) => (
                  <tr key={row.id || index}>
                    <td>{index + 1}</td>
                    <td>{row.timestamp}</td>
                    <td>
                      <strong style={{ color: "#2563eb" }}>
                        {Number(row.temperature).toFixed(2)}
                      </strong>
                    </td>
                    <td>
                      <strong style={{ color: "#0d9488" }}>
                        {Number(row.humidity).toFixed(2)}
                      </strong>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ color: "#94a3b8", padding: "24px" }}>
                    Menunggu aliran data dari sensor ESP32...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
