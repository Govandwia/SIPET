
#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <math.h>

#define DHTPIN 5
#define DHTTYPE DHT22

DHT dht(DHTPIN, DHTTYPE);

// WIFI
const char* ssid = "SIPETT";
const char* password = "123456787";

// SERVER XAMPP
const char* serverURL =
  "http://192.168.228.51/incubator/api.php";

WiFiServer server(80);

// PENGIRIMAN DATABASE SETIAP 5 MENIT
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 300000UL;

// KOREKSI SUHU DHT22
const float koreksiSuhu = -1.6;

// MEMBACA SUHU DENGAN KOREKSI
float bacaSuhu() {
  float suhu = dht.readTemperature();

  if (isnan(suhu)) {
    return NAN;
  }

  return suhu + koreksiSuhu;
}

// MENGIRIM DATA KE DATABASE
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

  HTTPClient http;

  String url = String(serverURL) +
               "?temperature=" + String(temperature, 2) +
               "&humidity=" + String(humidity, 2);

  Serial.println();
  Serial.println("Mengirim data ke database...");
  Serial.println(url);

  http.begin(url);
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
}

// SETUP
void setup() {
  Serial.begin(115200);
  delay(1000);

  dht.begin();

  Serial.println();
  Serial.println("SIPET - INCUBATOR MONITORING");
  Serial.println("Menghubungkan ke Wi-Fi...");

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("Wi-Fi berhasil terhubung!");

  Serial.print("IP ESP32: ");
  Serial.println(WiFi.localIP());

  server.begin();
  Serial.println("Web server aktif!");
  Serial.println("Pembacaan live tersedia di /data");
  Serial.println("Database diperbarui setiap 5 menit.");
}

// LOOP
void loop() {
  // KIRIM DATA KE DATABASE SETIAP 5 MENIT
  if (millis() - lastSendTime >= sendInterval) {
    lastSendTime = millis();
    sendDataToServer();
  }

  // MENANGANI PERMINTAAN WEB
  WiFiClient client = server.available();

  if (!client) {
    return;
  }

  client.setTimeout(1000);

  String request = client.readStringUntil('\r');
  client.readStringUntil('\n');

  // ENDPOINT DATA SENSOR UNTUK DASHBOARD XAMPP
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
