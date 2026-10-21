import { NextResponse } from "next/server";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { generateRealisticIncubationData } from "@/lib/mockData";

export async function GET() {
  try {
    if (!isFirebaseConfigured || !db) {
      // Ambil 50 data terakhir dari generator simulasi realistis
      const fullMock = generateRealisticIncubationData();
      return NextResponse.json(fullMock.slice(-50));
    }

    // Ambil 50 data sensor terbaru dari Firestore
    const q = query(
      collection(db, "sensor_data"),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Jika Firestore masih kosong, gunakan data simulasi agar tampilan tidak kosong
      const fullMock = generateRealisticIncubationData();
      return NextResponse.json(fullMock.slice(-50));
    }

    const data = [];
    snapshot.forEach((doc) => {
      const d = doc.data();
      data.push({
        id: doc.id,
        timestamp: d.timestamp || "",
        temperature: Number(d.temperature) || 0,
        humidity: Number(d.humidity) || 0,
      });
    });

    data.reverse();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching sensor data:", error);
    const fullMock = generateRealisticIncubationData();
    return NextResponse.json(fullMock.slice(-50));
  }
}
