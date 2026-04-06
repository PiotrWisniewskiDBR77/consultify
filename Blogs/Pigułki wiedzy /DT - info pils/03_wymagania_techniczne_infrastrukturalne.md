## Wymagania techniczne i infrastrukturalne

### Wymagania systemowe po stronie użytkownika

- **System operacyjny**:
  - Windows 10/11,
  - macOS (najnowsze 2 wersje),
  - Linux (dystrybucje korporacyjne – na żądanie).
- **Sprzęt użytkownika**:
  - procesor min. 4 rdzenie,
  - pamięć RAM min. 8 GB (rekomendowane 16 GB przy intensywnym korzystaniu),
  - rozdzielczość ekranu min. Full HD (1920×1080),
  - karta graficzna obsługująca akcelerację 2D/3D w przeglądarce (opcjonalnie).

### Wspierane przeglądarki i konfiguracja

- **Przeglądarki wspierane**:
  - Chrome, Edge, Firefox, Safari – bieżąca wersja i dwie poprzednie.
- **Wymagania**:
  - włączona obsługa JavaScript i WebAssembly,
  - włączona obsługa cookies (sesyjne) i local storage (konfiguracje UI),
  - dostęp do internetu przez port 443 (HTTPS).
- **Zalecenia IT**:
  - dodanie domeny platformy do listy zaufanych,
  - dopuszczenie połączeń WebSocket (jeżeli wykorzystywane).

### Wymagania po stronie serwera (platforma SaaS)

- **Środowisko chmurowe**:
  - AWS lub Azure (szczegóły w dokumencie dot. hostingu),
  - skalowalna infrastruktura obliczeniowa (autoscaling CPU/RAM/GPU – jeśli wymagane).
- **Bezpieczeństwo i dostępność**:
  - redundancja komponentów (load balancer, wielostrefowość),
  - monitoring i alerting (24/7),
  - regularne aktualizacje zabezpieczeń.

---

### Format danych wejściowych

#### Layout (CAD / grafika)

- **CAD**:
  - DWG, DXF – preferowane formaty,
  - zalecane warstwy zawierające obrysy ścian, słupów, maszyn.
- **Grafika**:
  - PNG, JPEG, PDF – jako podkład referencyjny (skala określana ręcznie).
- **Parametry dodatkowe**:
  - opis warstw, legenda,
  - informacja o skali i jednostkach.

#### Dane procesowe i produkcyjne

- **Pliki płaskie**:
  - CSV (separator „;” lub „,”),
  - Excel (XLSX).
- **Zakres danych**:
  - lista produktów / wariantów,
  - BOM (struktura materiałowa),
  - technologiczne marszruty (routing),
  - czasy operacji (planowane i/lub rzeczywiste),
  - dane o przestojach, scrapie, awaryjności,
  - harmonogram zmian (kalendarze pracy).
- **API**:
  - REST/JSON – integracja z ERP/MES/WMS,
  - autoryzacja (OAuth2/Token/Key) – uzgadniana z działem IT klienta.

#### Dane IoT / SCADA

- **Strumienie danych (IoT feed)**:
  - MQTT, OPC UA, HTTP/REST (push/pull),
  - parametry: stany maszyn, liczniki sztuk, alarmy, prędkości, statusy.
- **Częstotliwość**:
  - dane w interwałach od sekund do minut (w zależności od potrzeb),
  - agregacje historyczne w systemach źródłowych.

---

### Integracja z systemami produkcyjnymi

- **ERP**:
  - zakres: BOM, routing, zlecenia produkcyjne, koszty, parametry finansowe,
  - scenariusz: okresowy import (np. dzienny) lub integracja on‑line przez API.
- **MES**:
  - zakres: rzeczywiste czasy operacji, przestoje, jakość (scrap, rework),
  - scenariusz: okresowe zrzuty danych historycznych (CSV/API).
- **WMS/TMS**:
  - zakres: dane o przepływach magazynowych i logistycznych, lead time’ach, poziomie zapasów.
- **SCADA/IoT**:
  - zakres: sygnały czasu rzeczywistego, wykorzystane głównie do kalibracji i walidacji modelu.

---

### Wymagania dot. mocy obliczeniowej

- **Po stronie usługodawcy (DBR77)**:
  - klastrowa infrastruktura obliczeniowa dla symulacji (horizontal scaling),
  - możliwość wykonywania wielu replikacji i scenariuszy równolegle,
  - optymalizacja czasu wykonywania symulacji (równoleglenie, kolejkowanie zadań).
- **Po stronie klienta**:
  - brak konieczności inwestycji w dedykowany hardware do symulacji,
  - jedynie standardowy sprzęt biurowy i stabilne łącze internetowe.

### Wymagania dot. łącza internetowego

- **Minimalne parametry**:
  - przepustowość: min. 10 Mbps down / 5 Mbps up na użytkownika,
  - opóźnienia: <100 ms do endpointów chmurowych.
- **Rekomendowane parametry**:
  - łącze symetryczne 50/50 Mbps dla zespołów projektowych,
  - brak agresywnego filtrowania lub proxy ingerującego w ruch HTTPS/WebSocket.
- **Dostępność**:
  - stabilne połączenie podczas pracy z platformą (szczególnie przy imporcie dużych plików CAD/CSV),
  - możliwość korzystania z VPN klienta, jeżeli jest to wymóg organizacyjny (po uzgodnieniu).

---

### Dodatkowe systemy i integracje (wg dt-website)

- **Sprzęt przemysłowy**: PLC, Roboty, Sensory, SCADA/HMI, Edge gateways.
- **Systemy przedsiębiorstwa**: ERP, MES, WMS, CMMS, QMS, CRM.
- **Źródła danych**: Manual inputs, Excel imports, APIs, IoT streams, Time-series.
- **Architektura edge-friendly**: możliwość uruchamiania części obciążeń blisko zdarzeń (edge computing).
- **Progresywna ścieżka danych**: manual → historical → live (bez podejścia „big-bang”).

