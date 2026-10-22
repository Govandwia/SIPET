
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <math.h>

// Kompatibilitas ESP32 Core v3.x (esp_eap_client) dan Core v2.x (esp_wpa2)
#if __has_include("esp_eap_client.h")
  #include "esp_eap_client.h"
  #define USE_NEW_EAP 1
#else
  #include "esp_wpa2.h"
  #define USE_NEW_EAP 0
#endif

#define DHTPIN 5
#define DHTTYPE DHT22

DHT dht(DHTPIN, DHTTYPE);

// WIFI KAMPUS UGM - EAP-TTLS / PAP
const char* ssid = "UGM-Secure";
const char* EAP_IDENTITY = "septinatrirahayu";
const char* EAP_USERNAME = "septinatrirahayu";
const char* EAP_PASSWORD = "Septicantik123";

// SERVER VERCEL + FIREBASE CLOUD
const char* serverURL = "https://sipet-five.vercel.app/api/sensor";

WiFiServer server(80);

// PENGIRIMAN DATABASE SETIAP 5 MENIT
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 300000UL;

// RECONNECT WIFI
unsigned long lastReconnectAttempt = 0;
const unsigned long reconnectInterval = 10000UL;

// KOREKSI SUHU DHT22
const float koreksiSuhu = -1.3;

// STATUS SERVER
bool serverStarted = false;

// MEMBACA SUHU DENGAN KOREKSI
float bacaSuhu() {
  float suhu = dht.readTemperature();

  if (isnan(suhu)) {
    return NAN;
  }

  return suhu + koreksiSuhu;
}

// KONEKSI WIFI ENTERPRISE TTLS/PAP
void connectUGMSecure() {
  Serial.println("Menghubungkan ke UGM-Secure...");

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);

#if USE_NEW_EAP
  // Untuk ESP32 Core 3.x
  WiFi.begin(
    ssid,
    WPA2_AUTH_TTLS,
    EAP_IDENTITY,
    EAP_USERNAME,
    EAP_PASSWORD,
    nullptr,
    nullptr,
    nullptr,
    ESP_EAP_TTLS_PHASE2_PAP
  );
#else
  // Untuk ESP32 Core 2.x
  WiFi.disconnect(true);
  esp_wifi_sta_wpa2_ent_set_identity((uint8_t *)EAP_IDENTITY, strlen(EAP_IDENTITY));
  esp_wifi_sta_wpa2_ent_set_username((uint8_t *)EAP_USERNAME, strlen(EAP_USERNAME));
  esp_wifi_sta_wpa2_ent_set_password((uint8_t *)EAP_PASSWORD, strlen(EAP_PASSWORD));
  esp_wifi_sta_wpa2_ent_enable();
  WiFi.begin(ssid);
#endif
}

// MEMULAI SERVER SETELAH WIFI TERHUBUNG
void startLocalServer() {
  if (!serverStarted && WiFi.status() == WL_CONNECTED) {
    server.begin();
    serverStarted = true;

    Serial.println("Web server aktif!");
    Serial.println("Pembacaan live tersedia di /data");
    Serial.println("Database diperbarui setiap 5 menit.");
  }
}

// MENGIRIM DATA KE DATABASE CLOUD (VERCEL + FIREBASE)
void sendDataToServer() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi tidak terhubung.");
    return;
  }

  float temperature = bacaSuhu();
  float humidity = dht.readHumidity();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Gagal membaca DHT22.");
    return;
  }

  // Menggunakan WiFiClientSecure untuk koneksi HTTPS ke Vercel
  WiFiClientSecure client;
  client.setInsecure(); // Mengabaikan validasi root CA agar ESP32 lancar terkoneksi HTTPS

  HTTPClient http;
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);

  String url = String(serverURL) +
               "?temperature=" + String(temperature, 2) +
               "&humidity=" + String(humidity, 2);

  Serial.println();
  Serial.println("Mengirim data ke database Vercel + Firebase...");
  Serial.println(url);

  if (http.begin(client, url)) {
    int responseCode = http.GET();

    if (responseCode > 0) {
      Serial.print("HTTP Response Code: ");
      Serial.println(responseCode);

      Serial.print("Respons server: ");
      Serial.println(http.getString());
    } else {
      Serial.print("Gagal mengirim data: ");
      Serial.println(HTTPClient::errorToString(responseCode));
    }

    http.end();
  } else {
    Serial.println("Gagal menginisialisasi koneksi HTTPS ke Vercel.");
  }
}

// SETUP
void setup() {
  Serial.begin(115200);
  delay(1000);

  dht.begin();

  Serial.println();
  Serial.println("==========================================");
  Serial.println("SIPET - INCUBATOR MONITORING (ESP32)");
  Serial.println("Server Target: https://sipet-five.vercel.app");
  Serial.println("ESP32 + DHT22");
  Serial.println("Wi-Fi: UGM-Secure / EAP-TTLS-PAP");
  Serial.println("==========================================");

  connectUGMSecure();

  unsigned long startAttempt = millis();

  while (WiFi.status() != WL_CONNECTED &&
         millis() - startAttempt < 30000UL) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Wi-Fi berhasil terhubung!");
    Serial.print("IP ESP32: ");
    Serial.println(WiFi.localIP());

    startLocalServer();

    // Kirim data langsung saat pertama kali menyala dan terhubung
    Serial.println("Mengirim data pertama kali ke cloud...");
    sendDataToServer();
  } else {
    Serial.println("Wi-Fi belum terhubung.");
    Serial.println("Akan mencoba kembali.");
  }

  lastSendTime = millis();
}

// LOOP
void loop() {
  // COBA SAMBUNG ULANG WIFI
  if (WiFi.status() != WL_CONNECTED &&
      millis() - lastReconnectAttempt >= reconnectInterval) {

    lastReconnectAttempt = millis();

    Serial.println("Mencoba menyambungkan ulang Wi-Fi...");
    connectUGMSecure();
  }

  if (WiFi.status() == WL_CONNECTED) {
    startLocalServer();
  }

  // KIRIM DATA KE DATABASE SETIAP 5 MENIT
  if (WiFi.status() == WL_CONNECTED &&
      millis() - lastSendTime >= sendInterval) {

    lastSendTime = millis();
    sendDataToServer();
  }

  // SERVER LOKAL AKTIF HANYA JIKA WIFI TERHUBUNG
  if (WiFi.status() != WL_CONNECTED || !serverStarted) {
    delay(10);
    return;
  }

  // MENANGANI PERMINTAAN WEB
  WiFiClient client = server.available();

  if (!client) {
    return;
  }

  client.setTimeout(1000);

  String request = client.readStringUntil('\r');
  client.readStringUntil('\n');

  // ENDPOINT DATA SENSOR
  if (request.indexOf("GET /data") >= 0) {
    float temperature = bacaSuhu();
    float humidity = dht.readHumidity();

    client.println("HTTP/1.1 200 OK");
    client.println("Content-Type: application/json");
    client.println("Access-Control-Allow-Origin: *");
    client.println("Cache-Control: no-store");
    client.println("Connection: close");
    client.println();

    if (isnan(temperature) || isnan(humidity)) {
      client.println("{\"error\":true}");
    } else {
      client.print("{\"temperature\":");
      client.print(temperature, 2);
      client.print(",\"humidity\":");
      client.print(humidity, 2);
      client.print("}");
    }

    client.stop();
    return;
  }

  // DASHBOARD LANGSUNG ESP32
  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: text/html; charset=UTF-8");
  client.println("Connection: close");
  client.println("Cache-Control: no-store");
  client.println();

  client.println("<!DOCTYPE html>");
  client.println("<html lang='id'>");
  client.println("<head>");
  client.println("<meta charset='UTF-8'>");
  client.println("<meta name='viewport' content='width=device-width, initial-scale=1'>");
  client.println("<title>SIPET Incubator Monitoring</title>");

  client.println("<style>");
  client.println("*{box-sizing:border-box}");
  client.println("body{margin:0;font-family:Arial,sans-serif;background:#eef2f7;color:#172033}");
  client.println(".header{background:#172033;color:white;padding:28px 20px}");
  client.println(".inner{max-width:1000px;margin:auto}");
  client.println(".title{font-size:28px;font-weight:bold}");
  client.println(".subtitle{font-size:14px;opacity:.75;margin-top:6px}");
  client.println(".dashboard{max-width:1000px;margin:30px auto;padding:0 20px}");
  client.println(".cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}");
  client.println(".card,.status{background:white;border-radius:16px;padding:28px;box-shadow:0 4px 15px #0000000f}");
  client.println(".label{font-size:14px;color:#6b7280;text-transform:uppercase;letter-spacing:1px}");
  client.println(".value{font-size:46px;font-weight:bold;margin:15px 0}");
  client.println(".unit{font-size:20px;color:#6b7280;font-weight:normal}");
  client.println(".live{display:inline-block;padding:6px 12px;border-radius:20px;background:#e8f7ee;color:#15803d;font-size:12px;font-weight:bold}");
  client.println(".status{margin-top:20px}");
  client.println(".row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #edf0f3;gap:15px}");
  client.println(".row:last-child{border-bottom:none}");
  client.println(".muted{color:#6b7280}");
  client.println(".footer{text-align:center;font-size:12px;color:#9ca3af;padding:25px}");
  client.println("@media(max-width:650px){.cards{grid-template-columns:1fr}.value{font-size:40px}}");
  client.println("</style>");
  client.println("</head><body>");

  client.println("<div class='header'><div class='inner'>");
  client.println("<div class='title'>INCUBATOR MONITORING</div>");
  client.println("<div class='subtitle'>Real-Time Environmental Monitoring System</div>");
  client.println("</div></div>");

  client.println("<div class='dashboard'><div class='cards'>");

  client.println("<div class='card'>");
  client.println("<div class='label'>Temperature</div>");
  client.println("<div class='value'><span id='temperature'>--</span> <span class='unit'>&deg;C</span></div>");
  client.println("<span class='live'>LIVE</span></div>");

  client.println("<div class='card'>");
  client.println("<div class='label'>Relative Humidity</div>");
  client.println("<div class='value'><span id='humidity'>--</span> <span class='unit'>%RH</span></div>");
  client.println("<span class='live'>LIVE</span></div>");

  client.println("</div><div class='status'>");

  client.println("<div class='row'><span class='muted'>System Status</span><b id='status'>CONNECTING</b></div>");
  client.println("<div class='row'><span class='muted'>Last Update</span><b id='lastUpdate'>--</b></div>");
  client.println("<div class='row'><span class='muted'>Sensor</span><b>DHT22</b></div>");
  client.println("<div class='row'><span class='muted'>Connection</span><b>Wi-Fi</b></div>");

  client.println("</div></div>");
  client.println("<div class='footer'>ESP32 + DHT22 Incubator Monitoring</div>");

  client.println("<script>");
  client.println("async function updateData(){");
  client.println("try{");
  client.println("const r=await fetch('/data',{cache:'no-store'});");
  client.println("const d=await r.json();");
  client.println("if(d.error)throw new Error('Sensor error');");
  client.println("document.getElementById('temperature').textContent=Number(d.temperature).toFixed(1);");
  client.println("document.getElementById('humidity').textContent=Number(d.humidity).toFixed(1);");
  client.println("document.getElementById('status').textContent='ONLINE';");
  client.println("document.getElementById('lastUpdate').textContent=new Date().toLocaleTimeString();");
  client.println("}catch(e){document.getElementById('status').textContent='OFFLINE';}");
  client.println("}");
  client.println("updateData();setInterval(updateData,1000);");
  client.println("</script>");

  client.println("</body></html>");

  client.stop();
}
