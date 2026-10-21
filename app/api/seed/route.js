import { NextResponse } from "next/server";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, writeBatch, doc, serverTimestamp } from "firebase/firestore";

export async function GET() {
  if (!isFirebaseConfigured || !db) {
    return NextResponse.json(
      { status: "error", message: "Firebase belum terkonfigurasi di file .env.local" },
      { status: 500 }
    );
  }

  try {
    // Tanggal 14 Oktober 2026 sampai 20 Oktober 2026 (7 hari)
    const dates = [
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
    ];

    const records = [];

    dates.forEach((dateStr, dayIndex) => {
      for (let hour = 0; hour < 24; hour++) {
        // Fluktuasi suhu realistis penetasan: 37.4°C - 37.8°C
        const baseTemp = 37.58 + Math.sin((hour - 8) * (Math.PI / 12)) * 0.18;
        const baseHum = 61.2 - Math.sin((hour - 8) * (Math.PI / 12)) * 2.2;

        for (let min of [0, 15, 30, 45]) {
          const step = (dayIndex * 24 + hour) * 4 + min / 15;
          const noiseT = Math.sin(step * 0.77) * 0.05;
          const noiseH = Math.cos(step * 0.63) * 0.6;

          const temp = Number((baseTemp + noiseT).toFixed(2));
          const hum = Number((baseHum + noiseH).toFixed(2));

          const timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
          const timestamp = `${dateStr} ${timeStr}`;

          records.push({
            temperature: temp,
            humidity: hum,
            timestamp,
            is_seeder: true,
            note: "Data Seeder Contoh (14-20 Oktober 2026)",
          });
        }
      }
    });

    // Firestore batch writes max 500 operations per batch
    const batchSize = 350;
    let totalWritten = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const chunk = records.slice(i, i + batchSize);
      const batch = writeBatch(db);

      chunk.forEach((item) => {
        // Gunakan deterministic ID agar tidak duplikat jika dijalankan berulang
        const customId = `seed_${item.timestamp.replace(/[: ]/g, "_")}`;
        const ref = doc(db, "sensor_data", customId);
        batch.set(ref, {
          ...item,
          createdAt: serverTimestamp(),
        });
      });

      await batch.commit();
      totalWritten += chunk.length;
    }

    return NextResponse.json({
      status: "success",
      message: `Berhasil men-seed ${totalWritten} data contoh dari 14 Oktober s.d. 20 Oktober 2026 ke Firestore!`,
      totalRecords: totalWritten,
      range: "2026-10-14 s.d. 2026-10-20",
    });
  } catch (error) {
    console.error("Error running seeder:", error);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
