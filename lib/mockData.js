// Helper untuk membuat data sampel realistis siklus 21 hari inkubator
export function getTanggalString(hariKe = 1) {
  // Mulai 14 Oktober 2026 (Bulan Oktober = index 9)
  const d = new Date(2026, 9, 14 + (hariKe - 1));
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function generateRealisticIncubationData() {
  const data = [];
  const daysToGenerate = 7; // Hari 1 sampai Hari 7

  for (let day = 0; day < daysToGenerate; day++) {
    const d = new Date(2026, 9, 14 + day);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const dayStr = String(d.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${dayStr}`;

    // Setiap hari terdapat 24 jam, setiap jam 4 sampel (tiap 15 menit)
    for (let hour = 0; hour < 24; hour++) {
      // Fluktuasi suhu realistis penetasan: 37.4°C - 37.8°C
      const baseTemp = 37.58 + Math.sin((hour - 8) * (Math.PI / 12)) * 0.18;
      const baseHum = 61.2 - Math.sin((hour - 8) * (Math.PI / 12)) * 2.2;

      for (let min of [0, 15, 30, 45]) {
        // Variasi halus deterministik (tanpa Math.random agar SSR dan Client 100% konsisten / bebas hydration error)
        const step = (day * 24 + hour) * 4 + min / 15;
        const noiseT = Math.sin(step * 0.77) * 0.05;
        const noiseH = Math.cos(step * 0.63) * 0.6;

        const temp = Number((baseTemp + noiseT).toFixed(2));
        const hum = Number((baseHum + noiseH).toFixed(2));

        const timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
        const timestamp = `${dateStr} ${timeStr}`;

        data.push({
          id: `sample-${dateStr}-${timeStr}`,
          timestamp,
          temperature: temp,
          humidity: hum,
        });
      }
    }
  }

  return data;
}
