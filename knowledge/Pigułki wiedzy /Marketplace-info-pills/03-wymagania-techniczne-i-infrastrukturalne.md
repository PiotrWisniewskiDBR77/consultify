# 03: Wymagania Techniczne i Infrastrukturalne — DBR77 Marketplace

Specyfikacja dla działu IT. Wymagania systemowe, wspierane przeglądarki, formaty danych wejściowych oraz zapotrzebowanie na łącze internetowe.

---

## Wymagania systemowe

### Klient (przeglądarka)

| Parametr | Wymaganie |
|----------|-----------|
| **Typ aplikacji** | Progressive Web App (PWA) — dostęp przez przeglądarkę |
| **Minimum** | Nowoczesna przeglądarka z obsługą JavaScript, ES6+ |
| **Zalecane** | Najnowsza wersja przeglądarki, włączony JavaScript |
| **Responsywność** | Desktop, tablet, urządzenia mobilne |

### Serwer / Infrastruktura (dla wdrożeń własnych)

| Komponent | Technologia |
|-----------|-------------|
| **Framework backend** | Laravel 12 (PHP 8.2+) |
| **Frontend** | Vue 3, Inertia.js, Vite |
| **Baza danych** | PostgreSQL |
| **Cache / Queue** | Database (domyślnie) lub Redis (opcjonalnie) |
| **Vector DB** | Qdrant (dla AI matching) |
| **Web server** | Nginx lub Apache + PHP-FPM |

---

## Wspierane przeglądarki

| Przeglądarka | Minimalna wersja | Uwagi |
|--------------|------------------|-------|
| **Chrome** | Ostatnie 2 wersje | Zalecana |
| **Firefox** | Ostatnie 2 wersje | W pełni wspierana |
| **Safari** | Ostatnie 2 wersje | macOS, iOS |
| **Edge** | Ostatnie 2 wersje | Chromium-based |
| **Opera** | Ostatnie 2 wersje | Zgodna z Chromium |

**Uwagi**:
- Wymagany włączony JavaScript
- Zalecane włączenie cookies (sesja, autentykacja)
- Adblockery / rozszerzenia prywatności mogą blokować OAuth i powiadomienia

---

## Format danych wejściowych

### 1. Challenge (wyzwanie technologiczne)

- **Źródło**: Formularz w kreatorze 5-krokowym
- **Pola**: tytuł, kategoria, typ aplikacji, opis, budżet, timeline, kraje dostawy, wymagania techniczne
- **Wsparcie AI**: generowanie treści przez OpenAI (pole tekstowe → ustrukturyzowany opis)
- **Pliki**: możliwość załączania (np. rysunki, specyfikacje) — formaty do weryfikacji w interfejsie

### 2. Solution (propozycja rozwiązania)

- **Źródło**: Formularz Solution w platformie
- **Zawartość**: opis techniczny, stos technologiczny, analiza operacyjna, ROI
- **Pliki**: PDF, obrazy, ewentualnie 2D/3D (3D Studio)
- **Format**: JSONB w bazie (multilingual content)

### 3. Offer (oferta handlowa)

- **Dwa tryby**:
  - **Software Offer Wizard**: formularz z milestones, ceną, harmonogramem — dane strukturalne
  - **PDF Upload**: upload dokumentu oferty w formacie PDF
- **Ceny**: pole `price` szyfrowane (Laravel encrypted cast)

### 4. Dokumenty NDA i Contract

- **Źródło**: DocuSign — generowane i podpisywane poza platformą, status śledzony przez webhook
- **Format**: PDF (envelope DocuSign)

### 5. Dane zewnętrzne (integracje)

| System | Format / protokół |
|--------|-------------------|
| **OAuth** | Google, LinkedIn — OAuth 2.0 |
| **DocuSign** | REST API, webhooks |
| **Zoom** | REST API |
| **OpenAI** | REST API (embeddings, content generation) |
| **DeepL** | REST API (tłumaczenia) |
| **Qdrant** | HTTP API, gRPC (vector search) |
| **HubSpot** | REST API (CRM sync) |
| **Firebase** | Cloud Messaging (push notifications) |

### 6. Import / eksport (obecnie ograniczony)

- Brak masowego importu Challenge / Solution z zewnętrznych plików
- Dane eksportowalne przez panel admina (w zależności od konfiguracji)
- Dla enterprise — możliwe API (w planach)

### 7. Pliki załączane (typowe formaty)

| Typ | Przykładowe formaty |
|-----|---------------------|
| Dokumenty | PDF |
| Obrazy | JPG, PNG, WebP (dla wizualizacji) |
| Dane | Excel, CSV — do weryfikacji w konkretnym kontekście |

---

## Zapotrzebowanie na łącze internetowe

| Scenariusz | Minimalna przepustowość | Uwagi |
|------------|-------------------------|-------|
| **Standardowe użytkowanie** | 2–5 Mbps | Przeglądanie, formularze, messaging |
| **Upload dużych plików** | 10+ Mbps zalecane | PDF ofert, rysunki, wizualizacje |
| **Spotkania Zoom** | Zgodne z Zoom (ok. 2 Mbps HD) | Spotkania planowane w platformie |
| **Stabilność** | Niski pakiet loss | Ważne dla OAuth, sesji, real-time |

**Uwagi**:
- Aplikacja działa w chmurze — wymagany stały dostęp do internetu
- Tryb offline (PWA) — podstawowa cache’owana funkcjonalność; pełna obsługa wymaga połączenia

---

## Bezpieczeństwo dla IT

| Aspekt | Implementacja |
|--------|---------------|
| **Autentykacja** | OAuth (Google, LinkedIn); brak hasła przechowywanego lokalnie |
| **Sesja** | Laravel session; CSRF protection; timeout i invalidacja przy logout |
| **Admin** | IP whitelisting, rola `admin` |
| **Szyfrowanie** | TLS (HTTPS) w transporcie; encryption at rest dla pól wrażliwych |
| **Rate limiting** | API: 60 req/min; challenge creation: 5/h; offer submission: 10/min |
| **Audit** | Pełna historia dostępu i zmian (~7 lat retention) |

---

## Brak wymagań po stronie klienta

- Brak instalacji desktopowej
- Brak konfiguracji VPN
- Brak integracji SSO (standardowo) — dostępne w planach enterprise
- Brak dostępu do sieci korporacyjnej poza standardowym HTTPS

---

## Podsumowanie dla IT

DBR77 Marketplace to **SaaS PWA** — dostęp przez przeglądarkę. Dział IT nie musi wdrażać serwerów, baz danych ani integracji. Wystarczy:

1. Dostęp do internetu i do domeny platformy
2. Zezwolenie na OAuth (Google/LinkedIn) i cookies
3. Whitelist domeny/platformy w firewallu (jeśli wymagane)

Dla organizacji z wymaganiami enterprise (SSO, API, data residency) — kontakt z DBR77 w celu ustalenia opcji dedykowanych.
