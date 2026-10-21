import { NextResponse } from "next/server";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function handleRequest(request) {
  try {
    const { searchParams } = new URL(request.url);
    let temperature = searchParams.get("temperature");
    let humidity = searchParams.get("humidity");

    // Jika dikirim lewat body POST JSON/Form
    if (!temperature || !humidity) {
      try {
        const body = await request.json();
        temperature = temperature || body.temperature;
        humidity = humidity || body.humidity;
      } catch (e) {
        // Abaikan jika bukan JSON
      }
    }

    if (temperature === null || humidity === null || temperature === undefined || humidity === undefined) {
      return NextResponse.json(
        {
          status: "error",
          message: "Temperature dan humidity belum dikirim",
        },
        { status: 400 }
      );
    }

    const tempNum = parseFloat(temperature);
    const humNum = parseFloat(humidity);

    if (isNaN(tempNum) || isNaN(humNum)) {
      return NextResponse.json(
        {
          status: "error",
          message: "Nilai temperature dan humidity harus berupa angka yang valid",
        },
        { status: 400 }
      );
    }

    // Jika Firebase sudah terkonfigurasi, simpan ke Firestore
    if (isFirebaseConfigured && db) {
      const now = new Date();
      // Format timestamp YYYY-MM-DD HH:mm:ss sesuai zona waktu lokal
      const timestampString = now.toLocaleString("sv-SE", {
        timeZone: "Asia/Jakarta",
      });

      await addDoc(collection(db, "sensor_data"), {
        temperature: tempNum,
        humidity: humNum,
        timestamp: timestampString,
        createdAt: serverTimestamp(),
      });
    }

    return NextResponse.json({
      status: "success",
      message: "Data berhasil disimpan",
      temperature: tempNum,
      humidity: humNum,
      savedToFirebase: isFirebaseConfigured,
    });
  } catch (error) {
    console.error("Error saving sensor data:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Data gagal disimpan: " + error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  return handleRequest(request);
}

export async function POST(request) {
  return handleRequest(request);
}
