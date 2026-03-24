# IRIS — Wymagania Techniczne i Infrastrukturalne (dla IT)

Data: 2026-03-03  
Wersja: 1.0  
Zakres: wymagania systemowe, przeglądarki, formaty danych wejściowych/wyjściowych, integracje i wymagania sieciowe.

---

## 1) Model wdrożenia (warianty)

IRIS może zostać udostępniony w jednym z modeli (wybór zależy od wymogów klienta):

1. **SaaS (zalecany)**: IRIS hostowany w chmurze (docelowo AWS), dostęp przez przeglądarkę.  
2. **Private Cloud / Single-Tenant**: dedykowana instancja w chmurze klienta lub w wybranym regionie.  
3. **On-Prem (opcjonalnie)**: wdrożenie w infrastrukturze klienta (wymaga uzgodnienia architektury, CI/CD, observability i backupów).

W każdym modelu IRIS pozostaje **aplikacją webową** (frontend + backend API), z mechanizmami **multi-tenancy**, **RBAC** i **audit trail**.

---

## 2) Wymagania po stronie użytkownika (stacje robocze)

### 2.1. Przeglądarki (wspierane)

Wspierane są aktualne wersje przeglądarek “evergreen” (zalecane: ostatnie 2 wersje):

- **Google Chrome**
- **Microsoft Edge (Chromium)**
- **Mozilla Firefox**
- **Safari** (macOS)

**Wymagania**:

- włączony JavaScript,
- cookies / storage dla sesji,
- wsparcie TLS 1.2+,
- brak konieczności instalowania wtyczek.

### 2.2. Sprzęt i OS (zalecenia)

- CPU: 2 rdzenie+  
- RAM: 8 GB+  
- Rozdzielczość: 1440×900+ (zalecane Full HD)  
- OS: Windows 10/11, macOS, Linux (dowolna dystrybucja z aktualną przeglądarką)

---

## 3) Wymagania sieciowe i łącze internetowe

### 3.1. Dostęp do IRIS (SaaS/Private Cloud)

- **Protokół**: HTTPS (TLS 1.2+; docelowo TLS 1.3)
- **Porty**: 443 (outbound z sieci klienta)
- **Dostęp**: przez FQDN (np. `https://<tenant>.iris.example`)

### 3.2. Parametry łącza (praktyczne zalecenia)

Zależnie od intensywności pracy i liczby użytkowników:

- **Pojedynczy użytkownik (typowa praca)**: 1–3 Mbps down / 0.5–1 Mbps up  
- **Zespół (10–50 użytkowników)**: 20–100 Mbps łącze symetryczne (zalecane)  
- **Opóźnienia**: komfortowo < 100 ms RTT do regionu chmury; tolerowane < 200 ms

### 3.3. Upload danych i dokumentów

Jeżeli onboarding przewiduje import plików (PDF/XLSX/CSV), zaleca się:

- **łącze uplink** ≥ 10 Mbps dla szybkiego importu,  
- możliwość uploadu plików do kilku–kilkunastu MB (limit konfigurowalny per tenant).

---

## 4) Dane wejściowe — importy i integracje

IRIS wspiera wejścia danych w modelu “stopniowego wzbogacania” — od plików po integracje API/stream.

### 4.1. Pliki (import)

Typowe formaty:

- **CSV** (UTF-8, separator `,` lub `;`, nagłówki w 1 wierszu)
- **XLSX / Excel**
- **PDF** (dokumenty procesowe, raporty audytowe, instrukcje, specyfikacje)

**Przykładowe obszary importu**:

- master data (produkty, kody materiałów, gniazda, magazyny, lokacje),
- historyczne raporty jakości/awarii,
- listy kontrolne i procedury.

### 4.2. Format assessmentu (SIRI/ADMA / gotowość)

IRIS może przyjmować dane assessmentu w formie:

- **Excel/CSV**: arkusz pytań, odpowiedzi, wagi, komentarze, evidence links,
- **JSON** (zalecany dla automatyzacji): struktura sekcji → pytań → odpowiedzi.

Minimalny model logiczny:

- `assessmentId`, `framework` (np. `SIRI`, `ADMA`, `CUSTOM`),
- `sections[]` → `questions[]`,
- `answers` (skala/liczba/opis) + `evidence[]` (link/plik/ID).

### 4.3. API (integracje systemowe)

IRIS udostępnia **REST API** (JSON) w konwencji:

- `/api/v5/<module>/...` (np. `/api/v5/mes/orders`)

Zalecenia integracyjne:

- **OpenAPI/contract-first**: stabilne kontrakty + przykładowe payloady,
- **Idempotency**: dla operacji importowych/masowych (np. `Idempotency-Key`),
- **Correlation ID**: dla diagnostyki (header `X-Correlation-Id` lub pole w odpowiedzi).

Uwierzytelnianie:

- **JWT Bearer** (token w nagłówku `Authorization: Bearer <token>`),
- (opcjonalnie) integracyjne tokeny serwisowe per tenant (polityka i rotacja kluczy).

### 4.4. Integracje zdarzeniowe / IoT

Warianty (dobierane do dojrzałości IT/OT):

- **Webhooki / event delivery** (push zdarzeń do IRIS lub z IRIS),
- **Broker wiadomości** (docelowo: Redis Streams/SQS/SNS/Kafka — zależnie od architektury klienta),
- **IoT ingest**: mapowanie alertów/metryk do zasobów (CMMS) i zadań (GEMBA).

---

## 5) Dane wyjściowe — raporty i eksport

- **PDF**: raporty zarządcze, raporty jakości/awarii, podsumowania inicjatyw
- **CSV/XLSX**: eksport tabel i list (orders, stock, inspections, work orders)
- **API**: pobór danych do BI / DWH / data lake

---

## 6) Wymagania po stronie infrastruktury (dla modeli Private Cloud / On-Prem)

Poniższe punkty dotyczą sytuacji, gdy IRIS ma być utrzymywany przez klienta.

### 6.1. Warstwa aplikacyjna

- Runtime: kontenery (Docker) lub środowisko aplikacyjne uzgodnione w projekcie
- Reverse proxy / ingress: TLS termination, routing do aplikacji
- CI/CD: pipeline build/test/deploy oraz kontrola wersji

### 6.2. Baza danych i cache

Docelowo (production):

- **PostgreSQL** (transakcyjne dane tenantów, indeksy, migracje)
- **Redis** (cache, rate limiting, kolejki/streams — zależnie od etapu)

Development/local:

- uproszczone środowisko developerskie (np. SQLite) — nie jest rekomendowane jako produkcja.

### 6.3. Observability i bezpieczeństwo operacyjne

- logi aplikacyjne (JSON), traceId/correlationId
- metryki (p95/p99) kluczowych endpointów
- alerting (błędy, opóźnienia, degradacje)
- backupy i testy odtwarzania (DR)

---

## 7) Wymagania dla zespołów IT klienta (praktyczne)

Minimalne zaangażowanie IT po stronie klienta w modelu SaaS zwykle obejmuje:

- allowlist domeny / ruchu 443 (jeśli są restrykcje),
- uzgodnienie SSO (jeśli wymagane),
- uzgodnienie integracji (API / eksporty / IoT) oraz bezpieczeństwa (IP allowlist, klucze).

W modelach Private Cloud/On-Prem zakres obejmuje dodatkowo:

- utrzymanie środowiska (aktualizacje, backupy, monitoring),
- twarde standardy security i regularne przeglądy.

