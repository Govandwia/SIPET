"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { generateRealisticIncubationData, getTanggalString } from "@/lib/mockData";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function RekapPage() {
  const jumlahHari = 21;

  const [hariKe, setHariKe] = useState(1);
  // Default state langsung terisi data simulasi realistis agar tidak pernah kosong / "-"
  const [allData, setAllData] = useState(() => generateRealisticIncubationData());
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState(() => (isFirebaseConfigured ? "CONNECTED" : "DISCONNECTED"));
  const [deviceStatus, setDeviceStatus] = useState("CHECKING");
  const [lastSeenMinutes, setLastSeenMinutes] = useState(null);

  useEffect(() => {
    async function fetchFromFirebase() {
      if (!isFirebaseConfigured || !db) {
        setDbStatus("DISCONNECTED");
        return;
      }

      try {
        setLoading(true);
        const q = query(
          collection(db, "sensor_data"),
          orderBy("timestamp", "asc")
        );
        const snap = await getDocs(q);
        setDbStatus("CONNECTED");

        if (!snap.empty) {
          const list = [];
          snap.forEach((doc) => {
            const d = doc.data();
            list.push({
              id: doc.id,
              timestamp: d.timestamp || "",
              temperature: Number(d.temperature) || 0,
              humidity: Number(d.humidity) || 0,
              is_seeder: Boolean(d.is_seeder),
              note: d.note || "",
            });
          });
          setAllData(list);

          // Cek waktu sampel terakhir untuk menentukan koneksi alat IoT
          const lastItem = list[list.length - 1];
          if (lastItem?.timestamp && lastItem.timestamp.includes(" ")) {
            const parts = lastItem.timestamp.split(" ");
            const [y, m, d] = parts[0].split("-").map(Number);
            const [hh, mm, ss] = parts[1].split(":").map(Number);
            const recordTime = new Date(y, m - 1, d, hh, mm, ss).getTime();
            const diffMinutes = Math.floor((Date.now() - recordTime) / (1000 * 60));
            setLastSeenMinutes(diffMinutes);
            if (diffMinutes >= 0 && diffMinutes <= 15) {
              setDeviceStatus("ONLINE");
            } else {
              setDeviceStatus("OFFLINE");
            }
          } else {
            setDeviceStatus("OFFLINE");
          }
        } else {
          setDeviceStatus("OFFLINE");
        }
      } catch (e) {
        console.error("Gagal mengambil data dari Firebase:", e);
        setDbStatus("DISCONNECTED");
        setDeviceStatus("OFFLINE");
      } finally {
        setLoading(false);
      }
    }

    fetchFromFirebase();
  }, []);

  // Tanggal Mulai Siklus (Default 14/10/2026 atau otomatis disesuaikan dengan data pertama di Firebase)
  const [tanggalMulai, setTanggalMulai] = useState("2026-10-21");

  useEffect(() => {
    if (allData.length > 0 && isFirebaseConfigured) {
      const firstRow = allData[0];
      if (firstRow?.timestamp) {
        const datePart = firstRow.timestamp.split(" ")[0];
        if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          setTanggalMulai(datePart);
        }
      }
    }
  }, [allData]);

  const getTanggalHari = (dayIndex) => {
    const parts = tanggalMulai.split("-");
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10) + (dayIndex - 1));
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Tanggal yang dipilih (format: YYYY-MM-DD)
  const tanggalTerpilih = useMemo(() => {
    return getTanggalHari(hariKe);
  }, [tanggalMulai, hariKe]);

  // Format tanggal display (contoh: 14 Oktober 2026)
  const tanggalTerpilihFormat = useMemo(() => {
    const parts = tanggalTerpilih.split("-");
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [tanggalTerpilih]);

  // Data mentah untuk hari yang dipilih
  const dataHariTerpilih = useMemo(() => {
    return allData.filter((row) => row.timestamp && row.timestamp.startsWith(tanggalTerpilih));
  }, [allData, tanggalTerpilih]);

  // Cek apakah hari yang dipilih adalah data seeder contoh (14 s.d. 20 Oktober 2026)
  const isSeededDay = useMemo(() => {
    const hasFlag = dataHariTerpilih.some((r) => r.is_seeder === true);
    const inSeederRange = tanggalTerpilih >= "2026-10-14" && tanggalTerpilih <= "2026-10-20";
    return hasFlag || inSeederRange;
  }, [dataHariTerpilih, tanggalTerpilih]);

  // Agregasi Per Jam (24 Jam) dan Rata-rata Interval 5 Menit
  const { perJam, labelJam, suhuJam, kelembapanJam, jumlahPerJam, rataSuhu, rataKelembapan, totalSampel } =
    useMemo(() => {
      const hours = Array.from({ length: 24 }, (_, h) => {
        // Buat 12 slot 5-menit (00..55) untuk setiap jam
        const buckets = Array.from({ length: 12 }, (_, bIdx) => {
          const startM = bIdx * 5;
          const endM = (bIdx + 1) * 5;
          const startStr = `${String(h).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
          const endStr = endM === 60 ? `${String((h + 1) % 24).padStart(2, "0")}:00` : `${String(h).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
          return {
            bucketIndex: bIdx,
            rentang: `${startStr} – ${endStr}`,
            startStr,
            suhuSum: 0,
            kelembapanSum: 0,
            jumlah: 0,
            rows: [],
          };
        });

        return {
          jam: h,
          suhu: 0,
          kelembapan: 0,
          jumlah: 0,
          rows: [],
          buckets,
          averages5Min: [],
        };
      });

      let totalS = 0;
      let totalK = 0;

      dataHariTerpilih.forEach((row) => {
        const timePart = row.timestamp.split(" ")[1] || "00:00:00";
        const h = parseInt(timePart.split(":")[0], 10);
        const m = parseInt(timePart.split(":")[1], 10);

        if (!isNaN(h) && h >= 0 && h < 24) {
          hours[h].suhu += row.temperature;
          hours[h].kelembapan += row.humidity;
          hours[h].jumlah++;
          hours[h].rows.push(row);
          totalS += row.temperature;
          totalK += row.humidity;

          if (!isNaN(m) && m >= 0 && m < 60) {
            const bIdx = Math.min(11, Math.floor(m / 5));
            hours[h].buckets[bIdx].suhuSum += row.temperature;
            hours[h].buckets[bIdx].kelembapanSum += row.humidity;
            hours[h].buckets[bIdx].jumlah++;
            hours[h].buckets[bIdx].rows.push(row);
          }
        }
      });

      // Hitung nilai rata-rata 5 menit untuk setiap jam
      hours.forEach((hInfo) => {
        hInfo.averages5Min = hInfo.buckets
          .filter((b) => b.jumlah > 0)
          .map((b, idx) => ({
            no: idx + 1,
            rentang: b.rentang,
            waktuLengkap: `${tanggalTerpilih} ${b.startStr}:00`,
            avgTemperature: Number((b.suhuSum / b.jumlah).toFixed(2)),
            avgHumidity: Number((b.kelembapanSum / b.jumlah).toFixed(2)),
            sampleCount: b.jumlah,
            isSeeder: b.rows.some((r) => r.is_seeder),
          }));
      });

      const totalSampel = dataHariTerpilih.length;
      const rataSuhu = totalSampel > 0 ? totalS / totalSampel : null;
      const rataKelembapan = totalSampel > 0 ? totalK / totalSampel : null;

      const labelJam = hours.map((_, i) => `${String(i).padStart(2, "0")}:00`);
      const suhuJam = hours.map((item) =>
        item.jumlah > 0 ? Number((item.suhu / item.jumlah).toFixed(2)) : null
      );
      const kelembapanJam = hours.map((item) =>
        item.jumlah > 0 ? Number((item.kelembapan / item.jumlah).toFixed(2)) : null
      );
      const jumlahPerJam = hours.map((item) => item.jumlah);

      return {
        perJam: hours,
        labelJam,
        suhuJam,
        kelembapanJam,
        jumlahPerJam,
        rataSuhu,
        rataKelembapan,
        totalSampel,
      };
    }, [dataHariTerpilih, tanggalTerpilih]);

  // Agregasi Tren 21 Hari
  const { labelHari, suhuHari, kelembapanHari, jumlahHariData } = useMemo(() => {
    const lHari = [];
    const sHari = [];
    const kHari = [];
    const jHari = [];

    for (let i = 1; i <= jumlahHari; i++) {
      const dateStr = getTanggalHari(i);
      lHari.push(`Hari ${i}`);

      const rowsOfDay = allData.filter((r) => r.timestamp && r.timestamp.startsWith(dateStr));
      const count = rowsOfDay.length;
      jHari.push(count);

      if (count > 0) {
        const sumS = rowsOfDay.reduce((acc, c) => acc + c.temperature, 0);
        const sumK = rowsOfDay.reduce((acc, c) => acc + c.humidity, 0);
        sHari.push(Number((sumS / count).toFixed(2)));
        kHari.push(Number((sumK / count).toFixed(2)));
      } else {
        sHari.push(null);
        kHari.push(null);
      }
    }

    return { labelHari: lHari, suhuHari: sHari, kelembapanHari: kHari, jumlahHariData: jHari };
  }, [allData, tanggalMulai]);

  // Grafik Suhu & Kelembapan per Jam
  const grafikJamData = {
    labels: labelJam,
    datasets: [
      {
        label: "Suhu Rata-rata (°C)",
        data: suhuJam,
        yAxisID: "y",
        borderColor: "#2563eb",
        backgroundColor: "rgba(37, 99, 235, 0.08)",
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.35,
        spanGaps: false,
      },
      {
        label: "Kelembapan Rata-rata (%RH)",
        data: kelembapanJam,
        yAxisID: "y1",
        borderColor: "#0d9488",
        backgroundColor: "rgba(13, 148, 136, 0.08)",
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.35,
        spanGaps: false,
      },
    ],
  };

  // Grafik Tren 21 Hari
  const grafik21HariData = {
    labels: labelHari,
    datasets: [
      {
        label: "Suhu Harian (°C)",
        data: suhuHari,
        yAxisID: "y",
        borderColor: "#2563eb",
        backgroundColor: "#2563eb",
        borderWidth: 2.5,
        pointRadius: 4,
        pointHoverRadius: 7,
        tension: 0.3,
        spanGaps: false,
      },
      {
        label: "Kelembapan Harian (%RH)",
        data: kelembapanHari,
        yAxisID: "y1",
        borderColor: "#0d9488",
        backgroundColor: "#0d9488",
        borderWidth: 2.5,
        pointRadius: 4,
        pointHoverRadius: 7,
        tension: 0.3,
        spanGaps: false,
      },
    ],
  };

  const chartOptionsDual = {
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
        ticks: { font: { size: 11 } },
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

  return (
    <main className="container" style={{ maxWidth: "1150px", margin: "28px auto", padding: "0 20px" }}>
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
            marginBottom: "24px",
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
            <strong>Peringatan: Database Tidak Tersambung!</strong> Aplikasi rekap belum terhubung ke database Cloud Firebase Firestore. Periksa file <code>.env.local</code> atau pastikan koneksi internet aktif.
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
            marginBottom: "24px",
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
              <span> Belum ada data masuk dari modul ESP32 (DHT22).</span>
            )}
            {" "}Pastikan modul ESP32 dinyalakan, terhubung ke Wi-Fi, dan rutin mengirim data ke server.
          </div>
        </div>
      )}

      {/* PANEL PILIH HARI */}
      <section
        className="panel"
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "24px 28px",
          marginBottom: "24px",
          boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.06)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "18px",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ fontSize: "20px", fontWeight: "700", color: "#0f172a" }}>
            Pilih Hari Pengamatan
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#f1f5f9",
                color: "#475569",
                fontSize: "13px",
                fontWeight: "600",
                padding: "6px 14px",
                borderRadius: "20px",
                border: "1px solid #e2e8f0",
              }}
            >
              📅 Tanggal: {tanggalTerpilihFormat}
            </div>
            {isSeededDay ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontSize: "12.5px",
                  fontWeight: "700",
                  padding: "5px 12px",
                  borderRadius: "20px",
                  border: "1px solid #bfdbfe",
                }}
              >
                📋 Data Seeder (Contoh)
              </div>
            ) : (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#dcfce7",
                  color: "#15803d",
                  fontSize: "12.5px",
                  fontWeight: "700",
                  padding: "5px 12px",
                  borderRadius: "20px",
                  border: "1px solid #bbf7d0",
                }}
              >
                ● Data Sensor Riil
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <label htmlFor="hariSelect" style={{ fontSize: "14px", fontWeight: "600", color: "#334155" }}>
              Hari:
            </label>
            <select
              id="hariSelect"
              value={hariKe}
              onChange={(e) => setHariKe(parseInt(e.target.value, 10))}
              style={{
                border: "1.5px solid #cbd5e1",
                borderRadius: "10px",
                padding: "10px 16px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#0f172a",
                backgroundColor: "#f8fafc",
                cursor: "pointer",
                minWidth: "250px",
                outline: "none",
              }}
            >
              {Array.from({ length: jumlahHari }, (_, i) => {
                const dayNum = i + 1;
                const dateParts = getTanggalHari(dayNum).split("-");
                const tgl = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
                const isSeededOption = dayNum <= 7;
                return (
                  <option key={dayNum} value={dayNum}>
                    Hari {dayNum} — {tgl} {isSeededOption ? "(Contoh Seeder)" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 18px",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: "600",
                textDecoration: "none",
                background: "white",
                color: "#334155",
                border: "1.5px solid #cbd5e1",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              Dashboard Utama
            </Link>

            <a
              href={`/api/download?hari=${hariKe}&tanggal_mulai=${tanggalMulai}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: "600",
                textDecoration: "none",
                background: "#0f172a",
                color: "white",
                border: "none",
                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.2)",
              }}
            >
              Download CSV
            </a>
          </div>
        </div>
      </section>

      {/* CATATAN DATA SEEDER CONTOH */}
      {isSeededDay && (
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderLeft: "4px solid #2563eb",
            color: "#1e40af",
            padding: "16px 20px",
            borderRadius: "14px",
            marginBottom: "24px",
            fontSize: "13.5px",
            lineHeight: "1.6",
            display: "flex",
            alignItems: "flex-start",
            gap: "14px",
            boxShadow: "0 2px 8px rgba(37, 99, 235, 0.08)",
          }}
        >
          <div style={{ fontSize: "22px", lineHeight: "1", flexShrink: 0 }}>📋</div>
          <div>
            <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px", color: "#1e3a8a" }}>
              Catatan Pengamatan: Data Seeder Contoh (14 – 20 Oktober 2026)
            </div>
            <div style={{ color: "#1e40af" }}>
              Data pengamatan pada <strong>Hari {hariKe} ({tanggalTerpilihFormat})</strong> ini merupakan <strong>Data Seeder</strong> yang
              dibuat khusus sebagai data contoh/simulasi penetasan telur untuk keperluan referensi dan pengujian (rata-rata suhu ~37.58°C dan kelembapan ~61.20% RH).
              Data ini tersimpan di database Firebase Firestore dan dapat digunakan untuk pengujian grafik, analisis per jam, serta ekspor CSV.
            </div>
          </div>
        </div>
      )}

      {/* METRIC SUMMARY CARDS */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px",
          marginBottom: "24px",
        }}
      >
        {/* KARTU SUHU */}
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.06)",
            border: "1px solid #e2e8f0",
            borderTop: "4px solid #2563eb",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#64748b", textTransform: "uppercase" }}>
              Rata-rata Suhu Harian
            </span>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "#eff6ff",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              🌡️
            </div>
          </div>
          <div style={{ fontSize: "38px", fontWeight: "800", color: "#0f172a", lineHeight: 1.1, marginBottom: "10px" }}>
            {rataSuhu !== null ? rataSuhu.toFixed(2) : "--"}
            <span style={{ fontSize: "18px", fontWeight: "500", color: "#64748b" }}> °C</span>
          </div>
          <div>
            {rataSuhu !== null && (
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: "600",
                  background: rataSuhu >= 37.4 && rataSuhu <= 38.0 ? "#dcfce7" : "#fef9c3",
                  color: rataSuhu >= 37.4 && rataSuhu <= 38.0 ? "#15803d" : "#a16207",
                }}
              >
                {rataSuhu >= 37.4 && rataSuhu <= 38.0 ? "✓ Suhu Ideal Penetasan" : "⚠ Perlu Pengawasan Suhu"}
              </span>
            )}
          </div>
        </div>

        {/* KARTU KELEMBAPAN */}
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.06)",
            border: "1px solid #e2e8f0",
            borderTop: "4px solid #0d9488",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#64748b", textTransform: "uppercase" }}>
              Rata-rata Kelembapan Harian
            </span>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "#f0fdfa",
                color: "#0d9488",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              💧
            </div>
          </div>
          <div style={{ fontSize: "38px", fontWeight: "800", color: "#0f172a", lineHeight: 1.1, marginBottom: "10px" }}>
            {rataKelembapan !== null ? rataKelembapan.toFixed(2) : "--"}
            <span style={{ fontSize: "18px", fontWeight: "500", color: "#64748b" }}> %RH</span>
          </div>
          <div>
            {rataKelembapan !== null && (
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: "600",
                  background: rataKelembapan >= 55 && rataKelembapan <= 65 ? "#dcfce7" : "#fef9c3",
                  color: rataKelembapan >= 55 && rataKelembapan <= 65 ? "#15803d" : "#a16207",
                }}
              >
                {rataKelembapan >= 55 && rataKelembapan <= 65 ? "✓ Kelembapan Normal" : "⚠ Kelembapan di Luar Target"}
              </span>
            )}
          </div>
        </div>

        {/* KARTU TOTAL SAMPEL */}
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.06)",
            border: "1px solid #e2e8f0",
            borderTop: "4px solid #6366f1",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#64748b", textTransform: "uppercase" }}>
              Total Sampel Hari Ini
            </span>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "#f5f3ff",
                color: "#6366f1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              📊
            </div>
          </div>
          <div style={{ fontSize: "38px", fontWeight: "800", color: "#0f172a", lineHeight: 1.1, marginBottom: "10px" }}>
            {totalSampel}
          </div>
          <div>
            <span
              style={{
                display: "inline-block",
                padding: "4px 10px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: "600",
                background: totalSampel > 0 ? "#dcfce7" : "#f1f5f9",
                color: totalSampel > 0 ? "#15803d" : "#64748b",
              }}
            >
              {totalSampel > 0 ? "● Sensor Aktif Merekam" : "Tidak Ada Sampel"}
            </span>
          </div>
        </div>
      </section>

      {/* GRAFIK SUHU & KELEMBAPAN PER JAM */}
      <section
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "26px",
          marginBottom: "24px",
          boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.06)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>
            Grafik Suhu dan Kelembapan per Jam
          </div>
          <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
            Rata-rata pembacaan sensor setiap jam pada <strong>Hari {hariKe}</strong> ({tanggalTerpilihFormat}).
          </div>
        </div>
        <div style={{ position: "relative", width: "100%", height: "360px" }}>
          <Line data={grafikJamData} options={chartOptionsDual} />
        </div>
      </section>

      {/* GRAFIK JUMLAH SAMPEL PER JAM */}
      <section
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "26px",
          marginBottom: "24px",
          boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.06)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>
            Jumlah Sampel per Jam
          </div>
          <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
            Jika sensor DHT22 mengirim data berkala, jumlah pencatatan berkisar antara 4–12 sampel per jam.
          </div>
        </div>
        <div style={{ position: "relative", width: "100%", height: "300px" }}>
          <Bar
            data={{
              labels: labelJam,
              datasets: [
                {
                  label: "Jumlah Sampel per Jam",
                  data: jumlahPerJam,
                  backgroundColor: "#6366f1",
                  borderRadius: 6,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: "bottom" } },
              scales: {
                y: { beginAtZero: true, grid: { color: "#f1f5f9" } },
                x: { grid: { display: false } },
              },
            }}
          />
        </div>
      </section>

      {/* GRAFIK TREN 21 HARI */}
      <section
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "26px",
          marginBottom: "24px",
          boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.06)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>
            Grafik Tren Suhu &amp; Kelembapan Selama 21 Hari
          </div>
          <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
            Perbandingan rata-rata harian dari Hari ke-1 hingga Hari ke-21 masa inkubasi.
          </div>
        </div>
        <div style={{ position: "relative", width: "100%", height: "360px" }}>
          <Line data={grafik21HariData} options={chartOptionsDual} />
        </div>
      </section>

      {/* RINCIAN DATA MENTAH PER JAM ACCORDION */}
      <section
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "26px",
          marginBottom: "24px",
          boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.06)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "18px", fontWeight: "700", color: "#0f172a" }}>
            Data Rekapitulasi Rata-rata per 5 Menit — Hari {hariKe}
          </div>
          <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
            Data sampel live diakumulasi dan dihitung nilai rata-rata (average) setiap rentang 5 menit pada <strong>Hari {hariKe}</strong> ({tanggalTerpilihFormat}).
          </div>
        </div>

        {perJam.map((info, jam) => (
          <details
            key={jam}
            style={{
              margin: "10px 0",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <summary
              style={{
                padding: "14px 18px",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "14px",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                listStyle: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span>
                  {String(jam).padStart(2, "0")}:00 – {String(jam).padStart(2, "0")}:59
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    padding: "3px 9px",
                    borderRadius: "12px",
                    background: info.jumlah > 0 ? "#e0f2fe" : "#f1f5f9",
                    color: info.jumlah > 0 ? "#0369a1" : "#64748b",
                  }}
                >
                  {info.averages5Min.length} slot 5-menit ({info.jumlah} sampel)
                </span>
              </div>
              <div style={{ fontSize: "13px", color: "#475569" }}>
                {info.jumlah > 0 ? (
                  <span>
                    Rata-rata: Suhu <strong>{(info.suhu / info.jumlah).toFixed(2)} °C</strong> | Kelembapan:{" "}
                    <strong>{(info.kelembapan / info.jumlah).toFixed(2)} %RH</strong>
                  </span>
                ) : (
                  <span style={{ color: "#94a3b8" }}>Tidak ada data</span>
                )}
              </div>
            </summary>

            <div style={{ padding: "16px 20px" }}>
              {info.averages5Min && info.averages5Min.length > 0 ? (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        <th style={{ padding: "10px", fontSize: "12px", color: "#475569", textAlign: "center" }}>No</th>
                        <th style={{ padding: "10px", fontSize: "12px", color: "#475569", textAlign: "center" }}>Rentang Waktu (Rata-rata 5 Menit)</th>
                        <th style={{ padding: "10px", fontSize: "12px", color: "#475569", textAlign: "center" }}>Rata-rata Suhu (°C)</th>
                        <th style={{ padding: "10px", fontSize: "12px", color: "#475569", textAlign: "center" }}>Rata-rata Kelembapan (%RH)</th>
                        <th style={{ padding: "10px", fontSize: "12px", color: "#475569", textAlign: "center" }}>Sampel Terhitung</th>
                        <th style={{ padding: "10px", fontSize: "12px", color: "#475569", textAlign: "center" }}>Status Suhu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {info.averages5Min.map((b, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px", textAlign: "center", fontSize: "13px" }}>{idx + 1}</td>
                          <td style={{ padding: "10px", textAlign: "center", fontSize: "13px", fontWeight: "600", color: "#334155" }}>
                            ⏱ {b.rentang}
                          </td>
                          <td style={{ padding: "10px", textAlign: "center", fontSize: "13px", fontWeight: "700", color: "#2563eb" }}>
                            {b.avgTemperature.toFixed(2)} °C
                          </td>
                          <td style={{ padding: "10px", textAlign: "center", fontSize: "13px", fontWeight: "700", color: "#0d9488" }}>
                            {b.avgHumidity.toFixed(2)} %RH
                          </td>
                          <td style={{ padding: "10px", textAlign: "center", fontSize: "12px", color: "#64748b" }}>
                            {b.sampleCount} data
                          </td>
                          <td style={{ padding: "10px", textAlign: "center", fontSize: "12px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: "600",
                                background: b.avgTemperature >= 37.4 && b.avgTemperature <= 38.0 ? "#dcfce7" : "#fef9c3",
                                color: b.avgTemperature >= 37.4 && b.avgTemperature <= 38.0 ? "#15803d" : "#a16207",
                              }}
                            >
                              {b.avgTemperature >= 37.4 && b.avgTemperature <= 38.0 ? "✓ Normal" : "⚠ Pantau"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: "#94a3b8", textAlign: "center", margin: "10px 0" }}>
                  Sensor tidak mencatat data pada jam ini.
                </p>
              )}
            </div>
          </details>
        ))}
      </section>
    </main>
  );
}
