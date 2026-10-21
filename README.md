# 🥚 SIPET - Sistem Monitoring Inkubator Penetasan Telur

**SIPET (Sistem Inkubator Penetasan Telur)** adalah sistem pemantauan lingkungan inkubator berbasis IoT real-time yang dibangun menggunakan **Next.js (App Router)**, **Google Firebase Cloud Firestore**, **Chart.js**, dan mikrokontroler **ESP32** dengan sensor suhu & kelembapan **DHT22**.

---

## 🌟 Fitur Utama

- ⚡ **Live Real-Time Monitoring:** Pembaruan suhu dan kelembapan secara instan tanpa perlu me-refresh halaman menggunakan listener Firestore `onSnapshot`.
- 📊 **Grafik Interaktif Dual-Axis:** Visualisasi tren suhu (°C) dan kelembapan (%RH) dalam satu grafik dengan sumbu ganda menggunakan Chart.js.
- 📅 **Rekap Siklus 21 Hari Penetasan:** Analisis data harian selama 21 hari masa inkubasi telur unggas lengkap dengan rincian data mentah per jam (*accordion collapsible*).
- 🚨 **Notifikasi Cerdas (Dual Connection Alert):**
  - **Peringatan Database Tidak Tersambung:** Mendeteksi jika koneksi internet terputus atau konfigurasi Firebase belum valid.
  - **Peringatan Alat IoT Belum Tersambung:** Mendeteksi jika modul ESP32 tidak aktif atau tidak mengirim data dalam 15 menit terakhir.
- 📥 **Ekspor Data CSV:** Download rekapitulasi data sensor harian berformat CSV dengan dukungan UTF-8 BOM agar rapi dan kompatibel langsung saat dibuka di Microsoft Excel / Google Sheets.
- 📋 **Data Seeder Benchmark:** Dilengkapi data seeder realistis 14–20 Oktober 2026 (672 data poin) untuk keperluan simulasi, referensi, dan pengujian.
- 🔄 **Kompatibilitas Firmware Lama:** Mendukung endpoint legacy `/api.php`, `/data.php`, dan `/download.php` sehingga mikrokontroler ESP32 tidak memerlukan perombakan format URL.

---

## 🛠️ Teknologi & Arsitektur

| Komponen | Teknologi | Deskripsi |
| :--- | :--- | :--- |
| **Framework Web** | Next.js 16 (App Router) | Server-Side Rendering & Client-Side Hydration |
| **UI & Styling** | React 19 + Modern CSS | Desain responsif, dark header, dan cards |
| **Database Cloud** | Firebase Cloud Firestore | Penyimpanan data sensor real-time NoSQL |
| **Visualisasi Data**| Chart.js + react-chartjs-2 | Grafik tren garis dan diagram batang |
| **Mikrokontroler** | ESP32 (NodeMCU-32S) | Pemroses data dan klien HTTP Wi-Fi |
| **Sensor** | DHT22 (AM2302) | Sensor presisi suhu & kelembapan udara |

---

## 📁 Struktur Direktori

```text
incubator-nextjs/
├── app/
│   ├── api/
│   │   ├── data/route.js        # Endpoint pembacaan data sensor (JSON)
│   │   ├── download/route.js    # Endpoint download laporan CSV
│   │   ├── seed/route.js        # Endpoint seeder data contoh (14-20 Okt)
│   │   └── sensor/route.js      # Endpoint penerima data dari ESP32 (GET/POST)
│   ├── api.php/route.js         # Endpoint alias legacy untuk ESP32
│   ├── data.php/route.js        # Endpoint alias legacy pembacaan data
│   ├── download.php/route.js    # Endpoint alias legacy download CSV
│   ├── rekap/
│   │   └── page.js              # Halaman rekapitulasi siklus 21 hari
│   ├── globals.css              # Sistem desain dan styling global
│   ├── layout.js                # Layout utama dan header navbar
│   └── page.js                  # Dashboard utama monitoring real-time
├── arduino/
│   ├── sketch_aug26a.ino        # Kode firmware Arduino ESP32 + DHT22
│   └── ARDUINO_copy_...ino      # Backup firmware
├── lib/
│   ├── firebase.js              # Inisialisasi Firebase App & Firestore
│   └── mockData.js              # Generator data simulasi realistis
├── .env.example                 # Template variabel lingkungan Firebase
├── package.json
└── README.md
```

---

## 🚀 Panduan Memulai (Instalasi Lokal)

### 1. Clone Repository
```bash
git clone https://github.com/Govandwia/SIPET.git
cd SIPET
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Konfigurasi Firebase
Salin file `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```

Buka `.env.local` dan masukkan kredensial dari **Firebase Console -> Project Settings -> General -> Your Apps (Web)**:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=project-id.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=1:...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-...
```

Pastikan **Firestore Security Rules** diatur agar mengizinkan penulisan data:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sensor_data/{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 4. Jalankan Server Development
```bash
npm run dev
```
Buka browser pada alamat [http://localhost:3000](http://localhost:3000).

---

## 🔌 Konfigurasi Hardware (ESP32)

Buka file firmware di folder `arduino/sketch_aug26a.ino`:

1. Sesuaikan nama Wi-Fi dan password:
   ```cpp
   const char* ssid = "NAMA_WIFI_ANDA";
   const char* password = "PASSWORD_WIFI_ANDA";
   ```
2. Arahkan URL pengiriman sensor ke server Next.js:
   ```cpp
   // Contoh lokal:
   String serverURL = "http://192.168.1.10:3000/api/sensor";
   
   // Atau domain Vercel:
   // String serverURL = "https://sipet.vercel.app/api/sensor";
   ```
3. Upload kode ke ESP32 melalui Arduino IDE.

---

## ☁️ Panduan Deploy ke Vercel (Gratis 24/7)

1. Buat akun di [https://vercel.com](https://vercel.com) dan hubungkan akun GitHub Anda.
2. Klik **"Add New Project"** dan pilih repository **`Govandwia/SIPET`**.
3. Pada bagian **Environment Variables**, masukkan seluruh variabel dari file `.env.local`.
4. Klik **Deploy**. Web monitoring Anda akan langsung online dengan domain publik HTTPS gratis!

---

## 📄 Lisensi

Proyek ini dikembangkan untuk keperluan penelitian dan pemantauan sistem otomatisasi inkubator penetasan telur berbasis Internet of Things (IoT).
