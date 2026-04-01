# Plik 03: Wymagania Techniczne i Infrastrukturalne Consultify

**Producent:** DBR77 Robotics Sp. z o.o.  
**Produkt:** Consultify (consultify.ai)  
**Wersja dokumentu:** 1.0 | Marzec 2026  
**Adresat:** Dział IT, Architekt Systemów, CISO

---

## 1. Model Wdrożenia

Consultify jest dostarczane wyłącznie w modelu **SaaS (Software as a Service)** — chmura zarządzana przez DBR77. Nie wymaga żadnej instalacji oprogramowania po stronie klienta. Nie ma wersji on-premise w standardowej ofercie (Enterprise tier: możliwość negocjacji).

Dostęp do platformy odbywa się wyłącznie przez przeglądarkę internetową lub API REST.

---

## 2. Wymagania po Stronie Użytkownika Końcowego

### 2.1 Wspierane Przeglądarki

| Przeglądarka | Minimalna wersja | Rekomendowana wersja | Uwagi |
|---|---|---|---|
| **Google Chrome** | 110+ | Najnowsza (126+) | Pełne wsparcie, rekomendowana |
| **Microsoft Edge** | 110+ | Najnowsza (126+) | Pełne wsparcie (Chromium-based) |
| **Mozilla Firefox** | 115+ | Najnowsza (127+) | Pełne wsparcie |
| **Apple Safari** | 16.4+ | Najnowsza | Pełne wsparcie (macOS/iOS) |
| **Opera** | 96+ | Najnowsza | Wsparcie przez Chromium |
| **Internet Explorer** | — | Nieobsługiwany | Brak wsparcia |
| **Legacy Edge (EdgeHTML)** | — | Nieobsługiwany | Brak wsparcia |

**Wymagania przeglądarki:**
- JavaScript ES2020+ włączony
- WebSocket API
- IndexedDB (dla trybu offline cache)
- WebAuthn API (dla passwordless login)
- FileReader API (dla importu plików)

### 2.2 Wymagania Sprzętowe — Stacja Robocza

| Parametr | Minimum | Rekomendowane |
|---|---|---|
| RAM | 4 GB | 8 GB+ |
| CPU | Dual-core 2.0 GHz | Quad-core 2.5 GHz+ |
| Rozdzielczość ekranu | 1280 × 768 | 1920 × 1080+ |
| Połączenie sieciowe | 5 Mbps download | 20 Mbps+ |
| System operacyjny | Windows 10, macOS 12, Ubuntu 22.04 | Dowolny z powyższych (aktualna wersja) |

### 2.3 Wymagania Sprzętowe — Urządzenia Mobilne

| Platforma | Minimalna wersja OS | Uwagi |
|---|---|---|
| iOS (Safari) | iOS 16+ | Pełne wsparcie |
| Android (Chrome) | Android 11+ | Pełne wsparcie |
| Tablet (iPad, Android) | jw. | Widok responsywny zoptymalizowany |

> **Uwaga:** Wersja mobilna jest widokiem responsywnym. Dedykowana aplikacja natywna iOS/Android jest na roadmapie (Q3 2026).

---

## 3. Wymagania Sieciowe

### 3.1 Przepustowość

| Przypadek użycia | Minimalne łącze | Rekomendowane |
|---|---|---|
| Standardowa praca (dashboardy, formularze) | 2 Mbps download | 10 Mbps |
| Import plików (Excel, PDF) | 5 Mbps upload | 20 Mbps |
| Kolaboracja real-time (WebSocket) | 5 Mbps symetrycznie | 20 Mbps symetrycznie |
| Generowanie AI (duże raporty) | 5 Mbps download | 20 Mbps |
| Wideokonferencja zintegrowana (roadmap) | 10 Mbps symetrycznie | 50 Mbps |

### 3.2 Porty i Protokoły

| Protokół | Port | Kierunek | Cel |
|---|---|---|---|
| HTTPS | 443 | Wychodzący | Ruch aplikacyjny (TLS 1.3) |
| WSS (WebSocket Secure) | 443 | Wychodzący | Real-time collaboration, AI streaming |
| DNS | 53 | Wychodzący | Rozwiązywanie nazw |

### 3.3 Adresy do Whitelistowania

Klienci z restrykcyjnymi firewall'ami powinni zezwolić na ruch do:

```
*.consultify.ai          — aplikacja główna
*.cloudfront.net         — CDN (pliki statyczne, assety)
*.amazonaws.com          — AWS S3 (storage plików)
api.openai.com           — AI (opcjonalnie, ruch przez backend)
sentry.io                — monitoring błędów
```

> **Uwaga:** Cały ruch API (w tym do OpenAI) przechodzi przez backend Consultify — klient nie komunikuje się bezpośrednio z zewnętrznymi providerami AI. Whitelisting `api.openai.com` po stronie klienta **nie jest wymagany**.

### 3.4 Praca Offline

Platforma wymaga aktywnego połączenia z Internetem do pracy. Ograniczone funkcje cache (ostatnio otwarte dashboardy) są dostępne przez krótki czas po utracie połączenia, ale tworzenie i modyfikacja danych wymagają łączności.

---

## 4. Wymagania Tożsamości i Dostępu

### 4.1 Metody Autoryzacji

| Metoda | Dostępność | Uwagi |
|---|---|---|
| Email + hasło | Wszystkie plany | Hashed bcrypt; wymogi: min. 12 znaków, duże/małe litery, cyfry, znaki specjalne |
| Google OAuth 2.0 | Wszystkie plany | Google Workspace i konta osobiste |
| Microsoft OAuth 2.0 | Wszystkie plany | Azure AD / Microsoft 365 |
| GitHub OAuth 2.0 | Wszystkie plany | Dla zespołów technicznych |
| WebAuthn (Passkeys) | Wszystkie plany | FIDO2 — odcisk palca, Face ID, klucz sprzętowy |
| SAML 2.0 / OIDC SSO | Enterprise tier | Integracja z firmowym IdP (Okta, Entra ID, Ping Identity) |
| MFA (TOTP) | Wszystkie plany | Google Authenticator, Authy, 1Password |

### 4.2 Role w Systemie

| Rola | Uprawnienia |
|---|---|
| **Owner** | Pełny dostęp, zarządzanie subskrypcją i rozliczeniami, tworzenie organizacji |
| **Admin** | Zarządzanie użytkownikami i rolami, konfiguracja organizacji |
| **User** | Praca z modułami zgodnie z zakresem projektu |
| **Consultant** | Dostęp zaproszony do konkretnej organizacji klienta; nie zajmuje miejsca w subskrypcji właściciela |
| **Viewer** | Tylko odczyt dashboardów i raportów |

---

## 5. Formaty Danych Wejściowych

### 5.1 Import Danych Strukturyzowanych

| Format | Moduł | Możliwości |
|---|---|---|
| **Excel (.xlsx, .xls)** | Financial Statement Import, Assessment, Initiatives | Auto-parsing kolumn, mapowanie pól, walidacja typów |
| **CSV (.csv)** | Financial Import, KPI Upload, Bulk Initiative Import | Separator auto-detect, kodowanie UTF-8/CP1250 |
| **JSON (REST API)** | Programowe tworzenie/aktualizacja wszystkich obiektów | Pełna dokumentacja OpenAPI |
| **XML** | Roadmap (eksport/import) | Format Microsoft Project XML |

### 5.2 Import Danych Niestrukturyzowanych (AI OCR)

| Format | Moduł | Opis |
|---|---|---|
| **PDF** | Financial Statement Import, Knowledge Base | AI OCR + ekstrakcja tabel i liczb |
| **DOCX** | Knowledge Base, Report Import | Parsowanie struktury dokumentu Word |
| **PPTX** | Knowledge Base | Ekstrakcja tekstu i danych z prezentacji |
| **PNG, JPG, WEBP** | Assessment (dowody), Media Library | OCR, rozpoznawanie tabel i schematów |
| **Format SIRI** | Assessment Import | Natywny format wyników SIRI — pełna kompatybilność |

### 5.3 Limity Plików

| Parametr | Wartość |
|---|---|
| Maksymalny rozmiar pojedynczego pliku | 100 MB |
| Maksymalna liczba plików w jednym imporcie | 50 |
| Łączna pojemność storage (plan Standard) | 50 GB na organizację |
| Łączna pojemność storage (plan Enterprise) | Bez limitu (S3) |

---

## 6. API i Integracje Programowe

### 6.1 API REST

- Pełne REST API do zarządzania wszystkimi obiektami platformy (organizacje, inicjatywy, KPI, raporty).
- Autentykacja: JWT Bearer Token lub API Key (zarządzanie w panelu Admin).
- Wersjonowanie: `/api/v1/` — stabilne API z gwarancją backward compatibility.
- Rate limiting: 1000 requestów/minutę (Standard), 10 000/minutę (Enterprise).
- Dokumentacja: OpenAPI 3.0 (Swagger UI dostępny pod `/api/docs`).

### 6.2 Webhooks

- Eventy: `initiative.created`, `initiative.status_changed`, `kpi.deviation_detected`, `report.generated`, `assessment.completed`.
- Format: JSON POST na podany endpoint.
- Retry logic: 3 próby z exponential backoff przy błędzie HTTP 5xx.
- HMAC-SHA256 signature dla weryfikacji autentyczności.

### 6.3 MCP (Model Context Protocol)

- Pełna integracja MCP dla klientów Enterprise z własnym AI stack.
- Umożliwia osadzenie AI Consultify w zewnętrznych systemach i chatbotach.

---

## 7. Wymagania po Stronie Działu IT Klienta

### 7.1 Wdrożenie Standardowe (SaaS)

Consultify **nie wymaga żadnych działań po stronie IT klienta** poza:
- Konfiguracją whitelist w firewall (patrz sekcja 3.3) — jeśli dotyczy.
- Opcjonalną konfiguracją SSO/SAML (Enterprise) — 2–4 godziny pracy administratora IdP.
- Opcjonalną konfiguracją SCIM do synchronizacji katalogu użytkowników (Enterprise).

### 7.2 Brak Wymagań Instalacji

- Brak agentów do instalacji na stacjach roboczych.
- Brak wymagań dotyczących serwerów klienta.
- Brak modyfikacji lokalnej infrastruktury sieciowej (z wyjątkiem firewall — opcjonalnie).

---

## 8. Wymagania Dostępności i Zgodności

| Standard | Status | Uwagi |
|---|---|---|
| WCAG 2.1 AA | Zgodność częściowa (Q3 2026 pełna) | Podstawowe wymagania dostępności spełnione |
| GDPR | Pełna zgodność | Data Processing Agreement dostępna |
| ISO 27001 | W trakcie certyfikacji | Polityki i kontrole wdrożone |
| SOC 2 Type II | W trakcie certyfikacji | |
| PCI-DSS | Nie dotyczy | Płatności obsługuje Stripe (PCI-DSS Level 1) |

---

## 9. Wymagania Dotyczące Danych w Kontekście Produkcyjnym

### 9.1 Środowiska

| Środowisko | Opis | Dane |
|---|---|---|
| **Produkcja** | Główna instancja SaaS | Dane produkcyjne klienta |
| **Sandbox/Demo** | Izolowana organizacja demonstracyjna | Dane przykładowe (Atelier ToolToys) |
| **Trial** | 14-dniowe środowisko testowe | Dane klienta — pełna izolacja |

### 9.2 Migracja Danych

- Import historycznych assessmentów (SIRI, Excel, CSV) — dostępny w interfejsie.
- Migracja z Excel/Jira/MS Project: wsparcie przez Import Wizard i API.
- Pełny eksport danych organizacji (JSON/CSV) dostępny na żądanie — gwarancja przenośności.

---

## 10. Podsumowanie Checklist dla IT

```
[ ] Przeglądarka: Chrome/Edge/Firefox/Safari (aktualna wersja)
[ ] Łącze: min. 5 Mbps download, 2 Mbps upload na stanowisko
[ ] Firewall: zezwolić na ruch HTTPS/WSS do *.consultify.ai
[ ] Brak instalacji lokalnych: NIE wymagane
[ ] SSO (opcja): skonfigurować SAML 2.0 z firmowym IdP (Enterprise)
[ ] MFA: zachęcić użytkowników do włączenia TOTP
[ ] API Key: wygenerować w panelu Admin jeśli integracja z innymi systemami
[ ] GDPR DPA: podpisać Data Processing Agreement przed produkcyjnym użyciem
```
