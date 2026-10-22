import { NextResponse } from "next/server";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { generateRealisticIncubationData } from "@/lib/mockData";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const todayDefault = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
    let tanggalTerpilih = searchParams.get("tanggal");

    // Dukungan backward compatibility jika ada pemanggilan lama dengan param ?hari=
    if (!tanggalTerpilih) {
      if (searchParams.has("hari")) {
        const tanggalMulaiParam = searchParams.get("tanggal_mulai") || "2026-10-14";
        const hariKe = parseInt(searchParams.get("hari") || "1", 10);
        const parts = tanggalMulaiParam.split("-");
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10) + (hariKe - 1));
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        tanggalTerpilih = `${y}-${m}-${day}`;
      } else {
        tanggalTerpilih = todayDefault;
      }
    }

    const parts = tanggalTerpilih.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const nextDate = new Date(d);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextYear = nextDate.getFullYear();
    const nextMonth = String(nextDate.getMonth() + 1).padStart(2, "0");
    const nextDay = String(nextDate.getDate()).padStart(2, "0");

    const awalHari = `${tanggalTerpilih} 00:00:00`;
    const akhirHari = `${nextYear}-${nextMonth}-${nextDay} 00:00:00`;

    const filename = `rekap_rata2_5menit_${tanggalTerpilih}.csv`;

    let rawItems = [];

    if (isFirebaseConfigured && db) {
      const q = query(
        collection(db, "sensor_data"),
        where("timestamp", ">=", awalHari),
        where("timestamp", "<", akhirHari),
        orderBy("timestamp", "asc")
      );

      const snapshot = await getDocs(q);
      snapshot.forEach((doc) => {
        const d = doc.data();
        const isSeeder = Boolean(d.is_seeder) || (d.timestamp && d.timestamp >= "2026-10-14" && d.timestamp <= "2026-10-20 23:59:59");
        rawItems.push({
          id: doc.id,
          timestamp: d.timestamp || "",
          temperature: Number(d.temperature) || 0,
          humidity: Number(d.humidity) || 0,
          isSeeder,
        });
      });
    }

    // Jika belum ada data dari Firestore, gunakan data simulasi realistis
    if (rawItems.length === 0) {
      const mockFull = generateRealisticIncubationData();
      const mockHari = mockFull.filter((r) => r.timestamp.startsWith(tanggalTerpilih));

      mockHari.forEach((r) => {
        rawItems.push({
          id: r.id,
          timestamp: r.timestamp,
          temperature: Number(r.temperature) || 0,
          humidity: Number(r.humidity) || 0,
          isSeeder: true,
        });
      });

      if (rawItems.length === 0) {
        rawItems.push({
          id: "info-1",
          timestamp: `${tanggalTerpilih} 08:00:00`,
          temperature: 37.5,
          humidity: 62.0,
          isSeeder: true,
        });
      }
    }

    // Agregasi Data menjadi Rata-rata per 5 Menit
    const fiveMinBuckets = {};
    rawItems.forEach((r) => {
      const timePart = r.timestamp.split(" ")[1] || "00:00:00";
      const parts = timePart.split(":");
      const hh = parseInt(parts[0], 10) || 0;
      const mm = parseInt(parts[1], 10) || 0;
      const bIdx = Math.min(11, Math.floor(mm / 5));
      const startM = bIdx * 5;
      const endM = (bIdx + 1) * 5;
      const startStr = `${String(hh).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
      const endStr = endM === 60 ? `${String((hh + 1) % 24).padStart(2, "0")}:00` : `${String(hh).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
      const key = `${r.timestamp.split(" ")[0]} ${startStr}`;

      if (!fiveMinBuckets[key]) {
        fiveMinBuckets[key] = {
          tanggal: r.timestamp.split(" ")[0],
          rentang: `${startStr} - ${endStr}`,
          tempSum: 0,
          humSum: 0,
          count: 0,
          isSeeder: false,
        };
      }
      fiveMinBuckets[key].tempSum += r.temperature;
      fiveMinBuckets[key].humSum += r.humidity;
      fiveMinBuckets[key].count++;
      if (r.isSeeder) fiveMinBuckets[key].isSeeder = true;
    });

    const rows = Object.values(fiveMinBuckets).map((b, idx) => {
      const avgT = (b.tempSum / b.count).toFixed(2);
      const avgH = (b.humSum / b.count).toFixed(2);
      const note = b.isSeeder ? "Data Seeder Contoh" : "Data Sensor Riil";
      return [
        idx + 1,
        b.tanggal,
        b.rentang,
        avgT,
        avgH,
        b.count,
        note,
      ];
    });

    // Susun isi CSV dengan UTF-8 BOM (\uFEFF) untuk Excel
    let csvContent = "\uFEFF";
    csvContent += "No,Tanggal,Rentang 5 Menit,Rata-rata Suhu (C),Rata-rata Kelembapan (%RH),Jumlah Sampel,Keterangan\r\n";

    rows.forEach((row) => {
      const escaped = row.map((val) => `"${String(val).replace(/"/g, '""')}"`);
      csvContent += escaped.join(",") + "\r\n";
    });

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating CSV:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal membuat CSV: " + error.message },
      { status: 500 }
    );
  }
}
