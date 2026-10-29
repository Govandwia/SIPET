import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Incubator Monitoring System",
  description: "Real-Time Environmental Monitoring System for Egg Incubator powered by ESP32, Next.js, and Firebase",
  icons: {
    icon: "/logo-ugm.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <header className="header">
          <div className="header-content" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div className="title">INCUBATOR MONITORING</div>
              <div className="subtitle">
                Real-Time Environmental Monitoring System (Next.js + Firebase)
              </div>
              <nav className="nav-links">
                <Link href="/" className="nav-button">
                  Dashboard Utama
                </Link>
                <Link href="/rekap" className="nav-button">
                  Rekap Data
                </Link>
              </nav>
            </div>

            {/* LOGO UGM & TEKVET DI POJOK KANAN ATAS */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                background: "rgba(255, 255, 255, 0.08)",
                padding: "8px 16px",
                borderRadius: "14px",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                boxShadow: "0 4px 15px rgba(0, 0, 0, 0.2)",
              }}
            >
              <img
                src="/logo-ugm.png"
                alt="Logo Universitas Gadjah Mada"
                style={{
                  height: "48px",
                  width: "auto",
                  objectFit: "contain",
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                }}
              />
              <div style={{ width: "1px", height: "36px", background: "rgba(255, 255, 255, 0.2)" }} />
              <img
                src="/tekvet.png"
                alt="Logo TEKVET"
                style={{
                  height: "46px",
                  width: "auto",
                  objectFit: "contain",
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))",
                }}
              />
            </div>
          </div>
        </header>

        {children}

        <footer className="footer" style={{ textAlign: "center", lineHeight: "1.6" }}>
          <div>
            <strong>Incubator Monitoring System</strong> • Tugas Akhir (TA) Septina Tri Rahayu ({'23/519797/SV/23180'})
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
            Teknologi Veteriner • Departemen Teknologi Hayati dan Veteriner • Sekolah Vokasi Universitas Gadjah Mada
          </div>
        </footer>
      </body>
    </html>
  );
}
