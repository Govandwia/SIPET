import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "SIPET - Incubator Monitoring (Next.js & Firebase)",
  description: "Real-Time Environmental Monitoring System for Egg Incubator powered by ESP32, Next.js, and Firebase",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <header className="header">
          <div className="header-content">
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
        </header>

        {children}

        <footer className="footer">
          ESP32 + DHT22 + Next.js + Firebase Monitoring System
        </footer>
      </body>
    </html>
  );
}
