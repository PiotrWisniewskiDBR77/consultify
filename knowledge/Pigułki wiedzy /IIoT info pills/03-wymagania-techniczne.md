# DBR77 IIoT — Wymagania Techniczne i Infrastrukturalne

## 1. Wymagania systemowe (Panel IIoT — użytkownik końcowy)

| Element | Wymaganie |
|---------|-----------|
| **Przeglądarka** | Chrome 90+, Firefox 90+, Edge 90+, Safari 14+ |
| **Rozdzielczość** | Min. 1280×720; zalecane 1920×1080 |
| **JavaScript** | Włączony |
| **Cookies** | Wymagane dla sesji |
| **Sieć** | Stałe lub stabilne połączenie internetowe; min. 2 Mbps dla panelu |

## 2. Aplikacje Mobile & Tablet

| Element | Wymaganie |
|---------|-----------|
| **Android** | 8.0+ (API 26+) |
| **iOS** | 14.0+ |
| **Łączność** | Wi‑Fi lub LTE dla synchronizacji w czasie rzeczywistym |
| **Offline** | Planowane: buforowanie danych i synchronizacja po powrocie online |

## 3. Hardware — wymagania środowiskowe

| Urządzenie | Temperatura | Wilgotność | Zasilanie |
|------------|-------------|------------|-----------|
| Status Deck | -10°C do +50°C | 5–95% RH | Zgodnie z kartą produktu |
| Data Hub | -20°C do +60°C | 5–95% RH | 24 V DC (szyna DIN) |
| Vision Edge | Zgodnie z kartą | Zgodnie z kartą | 24 V DC |

## 4. Formaty danych wejściowych

| Źródło | Protokoły / formaty |
|--------|----------------------|
| PLC | Modbus RTU/TCP, OPC-UA (planowane), Profinet (planowane), Ethernet/IP (planowane) |
| Czujniki | 4–20 mA, Modbus, MQTT, LoRaWAN |
| Deklaracje | Status Deck (dedykowany protokół) |
| API | REST (planowane); JSON |
| Import danych | Excel, CSV (planowane do raportów) |

## 5. Łączność i sieć

| Aspekt | Wymaganie |
|--------|-----------|
| **Zakład → Chmura** | Min. 5 Mbps upload dla typowego pilotażu (1–3 stanowisk) |
| **Edge → Panel** | Wi‑Fi, LoRaWAN, SIM/LTE, Ethernet |
| **Bezpieczeństwo** | TLS 1.2+ dla transmisji |
| **Firewall** | Wymagane porty do komunikacji z chmurą (szczegóły w dokumentacji) |

## 6. Infrastruktura IT (po stronie klienta)

| Element | Opis |
|---------|------|
| **Sieć OT** | Dostęp do PLC/czujników przez Modbus/ethernet (jeśli wymagane) |
| **DMZ / Segmentacja** | Zalecana segmentacja sieci OT i IT |
| **DNS** | Rozwiązywanie hostów DBR77/IRIS |
| **Proxy** | Wsparcie HTTP/HTTPS proxy (w zależności od konfiguracji) |
