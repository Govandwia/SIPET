import { NextResponse } from "next/server";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { generateRealisticIncubationData } from "@/lib/mockData";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tanggalMulaiParam = searchParams.get("tanggal_mulai") || "2026-10-21";
    const jumlahHari = 21;

    let hariKe = parseInt(searchParams.get("hari") || "1", 10);
    hariKe = Math.max(1, Math.min(jumlahHari, isNaN(hariKe) ? 1 : hariKe));

    // Hitung tanggal yang dipilih berdasarkan tanggal mulai
    const parts = tanggalMulaiParam.split("-");
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10) + (hariKe - 1));
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const tanggalTerpilih = `${year}-${month}-${day}`;

    const awalHari = `${tanggalTerpilih} 00:00:00`;
    const nextDate = new Date(d);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextYear = nextDate.getFullYear();
    const nextMonth = String(nextDate.getMonth() + 1).padStart(2, "0");
    const nextDay = String(nextDate.getDate()).padStart(2, "0");
    const akhirHari = `${nextYear}-${nextMonth}-${nextDay} 00:00:00`;

    const filename = `data_sensor_hari_${hariKe}_${tanggalTerpilih}.csv`;

    let rows = [];

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
        const note = isSeeder ? "Data Seeder Contoh" : "Data Sensor Riil";
        rows.push([
          doc.id,
          d.timestamp || "",
          d.temperature || "",
          d.humidity || "",
          note,
        ]);
      });
    }

    // Jika belum ada data dari Firestore, gunakan data simulasi realistis
    if (rows.length === 0) {
      const mockFull = generateRealisticIncubationData();
      const mockHari = mockFull.filter((r) => r.timestamp.startsWith(tanggalTerpilih));

      mockHari.forEach((r) => {
        rows.push([r.id, r.timestamp, r.temperature, r.humidity, "Data Seeder Contoh"]);
      });

      if (rows.length === 0) {
        // Jika hari di luar rentang simulasi, buat baris informasi
        rows.push(["info-1", `${tanggalTerpilih} 08:00:00`, "37.50", "62.00", "Data Seeder Contoh"]);
      }
    }

    // Susun isi CSV dengan UTF-8 BOM (\uFEFF) untuk Excel
    let csvContent = "\uFEFF";
    csvContent += "ID,Timestamp,Temperature (C),Humidity (%RH),Keterangan\r\n";

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
