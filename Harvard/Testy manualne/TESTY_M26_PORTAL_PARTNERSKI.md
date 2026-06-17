# TESTY — M26 Portal Partnerski

> **Moduł:** M26 Portal Partnerski (`/partner/*`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`, inwentarz `Harvard/podzial/inventory/INV_G_admin_ustawienia_partner_superadmin.md` §M26
> **Zakres tej paczki:** pełny portal partnera — 24 sekcje w 8 grupach, gating `connected=true`, 26+ endpointów 503 (celowy kontrakt), auth payoutów (naprawiony), onboarding, certyfikacje, profil, zasoby, dual-router v8 + legacy.
> **Cel:** agent piszący i testujący moduł ma na tej podstawie dogłębnie przetestować każdy przepływ partnera z dowodem E2E (UI + Network payload + DB), ze szczególnym naciskiem na poprawne zachowanie przy endpointach 503 (graceful degradation) i zweryfikowaną naprawę auth payoutów.
> **Bazuje na:** `Harvard/wdrozenie-100/M26-portal-partnerski.md` (teczka) + `Harvard/modules/M26-portal-partnerski/KARTA_AUDYTU.md` + kod źródłowy 2026-06-13.
> **Legenda:** **[MANUAL]** = wymaga ręcznej weryfikacji; **[FLAG]** = zależne od flagi/capability/roli; **[DB]** = dowód obejmuje wiersz/kolumnę w bazie.
> **Data:** 2026-06-16

---

## 0. Kontekst architektoniczny (przeczytaj przed testami)

### 0.1 Mapa plików

| Obszar | Komponent / Plik |
|--------|-----------------|
| Główny widok | `src/views/partner/PartnerPortalView.tsx` (~3310 l.) — eksportuje `PartnerPortalViewNew` |
| Sidebar nawigacja | `src/components/Partner/PartnerSidebar.tsx` — 24 sekcje w 8 grupach |
| Layout dwukolumnowy | `src/components/Partner/PartnerLayout.tsx` |
| Home / Onboarding | `src/views/partner/ProviderHomeView.tsx` (lazy) |
| Referrals | `src/views/partner/sections/ReferralToolsSection.tsx` (lazy) |
| Earnings / Payouts | `src/views/partner/sections/EarningsSection.tsx` (lazy) |
| Client Access | `src/views/partner/ClientAccessView.tsx` (lazy) |
| Runtime summary strip | `src/components/Partner/PartnerRuntimeSummaryStrip.tsx` |
| API v8 | `src/services/api/v8/partner.ts` — `V8PartnerApi.*` |
| Backend legacy (43 endp.) | `server/src/routes/partners.routes.ts` |
| Backend v8 (25 endp.) | `server/src/routes/v8/partner.routes.ts` |
| Config trasy | `src/routes/routeConfig.ts` → `ROUTES.PARTNER.*` |
| Inwentarz AppRoutes | `src/routes/AppRoutes.tsx:2231–2239` (celowy `requireAuth` bez roli) |

### 0.2 Architektura gating (connected=true)

**Dwie niezależne warstwy gating:**

1. **Sidebar główny (Consultify):** `Sidebar.tsx:424-431` — przy mount wywołuje `GET /api/partners/connection`, odczytuje `data.connected`. Jeśli `connected=false` → `hasPartnerPortalAccess=false` → pozycja „Partner Portal" w stopce sidebar jest UKRYTA (`showPartnerPortal = canAttemptPartnerPortal && hasPartnerPortalAccess`). Brak `connected=true` = brak wejścia do modułu przez sidebar.
2. **Wewnątrz portalu (`PartnerPortalViewNew`):** drugi niezależny call `GET /api/partners/connection`. Jeśli `connected=false` → `isConnected=false` → aktywna sekcja zablokowana na `partner-home` (ekran Connect). Próba przełączenia sekcji przez sidebar → toast „Connect your partner profile first…". URL wymuszany na `?tab=partner-home`.

**Rola FE vs BE:**
- FE: otwieranie URL `/partner` NIE wymaga roli ani `connected=true` — tylko `requireAuth` (`AppRoutes.tsx:2268–2272`). Ekran Connect jest widoczny dla każdego zalogowanego.
- BE: każdy write-endpoint weryfikuje `getActivePartnerOrgIdForUser(userId)` → scoped `partner_org_id`. Brak profilu partnera → 403.

**Klucz `selfConnectEnabled`:** backend zwraca `selfConnectEnabled: true` wyłącznie gdy flaga `PARTNER_SELF_CONNECT_ENABLED=true` jest ustawiona. Domyślnie `false` — formularz samoobsługowy jest ukryty, zamiast niego banner „skontaktuj się z administratorem".

### 0.3 Dual-router i kanon v8

| Router | Endpointy | Kanon |
|--------|-----------|-------|
| v8 (`/api/v8/partner/...`) | 25 endp. — referrals, earnings, payouts, payout-settings, onboarding, org profile, program ledger | **jedyny kanon FE** (`V8PartnerApi.*`) |
| legacy (`/api/partners/...`) | 43 endp. — connection, certifications, resources, superadmin settlements, public routes | używany do connect/connection, cert, resources |

v8 router celowo omija `v8OrgGate` (`v8/index.ts:51–53` — udokumentowane).

### 0.4 Endpointy 503 — CELOWY KONTRAKT (nie bug)

Endpointy zwracające `503 FEATURE_NOT_AVAILABLE` (kod `code: 'FEATURE_NOT_AVAILABLE'`):

| Endpoint | Plik:linia |
|----------|------------|
| `POST /api/partners/clients` | `partners.routes.ts:1354` |
| `GET /api/partners/clients/:clientId` | `partners.routes.ts:1367` |
| `POST /api/partners/employees` | `partners.routes.ts:1420` |
| `GET /api/partners/stats` | `partners.routes.ts:1437` |
| `POST /api/partners/access-links` | `partners.routes.ts:1454` |
| `GET /api/partners/licenses` | `partners.routes.ts:1903` |
| `POST /api/partners/licenses/order` | `partners.routes.ts:1914` |
| `GET /api/partners/invoices` | `partners.routes.ts:1973` |
| `GET /api/partners/tiers` | `partners.routes.ts:2195` |
| `GET /api/superadmin/partners/attributions` | `partners.routes.ts:2511` |
| `DELETE /api/superadmin/partners/attributions/:id` | `partners.routes.ts:2526` |

**Wzorzec odpowiedzi 503 celowej:**
```json
{ "success": false, "code": "FEATURE_NOT_AVAILABLE", "message": "Partner client creation is not available yet." }
```

FE wykrywa `code === 'FEATURE_NOT_AVAILABLE'` i chowa akcje zamiast wyświetlać crash.

**Wzorzec odpowiedzi 503 schema-missing (`featureUnavailable`):**
```json
{ "statusCode": 503, "status": false, "type": "not_configured", "message": "..." }
```

### 0.5 Naprawa auth payoutów (P0 fix — commit `7cf315b4b9`)

**Problem przed naprawą:** `GET /api/partners/payouts` odczytywał `req.user?.partnerOrgId` — pole którego middleware auth nigdy nie ustawiał → 403 dla każdego zalogowanego partnera.

**Naprawa:** routing przez `requirePartnerOrgId` → `getActivePartnerOrgIdForUser(userId)` (DB lookup) — ten sam wzorzec co wszystkie inne endpointy partnerskie.

**Analogiczna naprawa earnings fallback (`partners.routes.ts:967`):** stary kod przy wyjątku DB zwracał hardkodowane `commissionRate: 15`. Po naprawie: `res.status(503).json({ success: false, error: 'Earnings temporarily unavailable', code: 'DB_ERROR' })`.

**Test regresji:** `tests/unit/backend/routes/partner-payouts-auth.test.ts` — weryfikuje oba scenariusze (poprawny user → 200; brak partner org → 403 clean).

### 0.6 Zasada weryfikacji E2E (obowiązkowa)

Każda akcja MUSI być potwierdzona w zakładce Network przeglądarki:
- właściwy endpoint wywołany
- payload wysłany
- status odpowiedzi
- kształt danych w odpowiedzi

Sama zmiana w UI bez żądania sieciowego = **FAIL** (możliwy optimistic update bez persystencji). Po akcji odśwież stronę i sprawdź, że stan przetrwał.

---

## Setup środowiska testowego

### Serwer

```
# Terminal 1 — frontend
npm run dev        # Vite :3000

# Terminal 2 — backend
cd server && npm run dev  # Express :3001
```

### Konta testowe

| Konto | Stan | Cel |
|-------|------|-----|
| OWNER / DBR77 admin | `connected=false` (brak profilu partnera) | testy gating locked-view |
| Konto testowe partnera | `connected=true` (profil partnera w DB) | testy pełnego dostępu |
| SuperAdmin | rola SUPERADMIN | testy settlements |

**Przygotowanie konta z `connected=true`:**
- Opcja A: w DB — INSERT do `partner_organizations` + `partner_users` z `user_id` konta testowego [DB]
- Opcja B: flaga `PARTNER_SELF_CONNECT_ENABLED=true` w .env → formularz samodzielny na ekranie Connect

### DevTools

1. Otwórz DevTools → zakładka **Network** (filtr: `/api/partners` lub `/api/v8/partner`)
2. Zakładka **Console** — wymaganie: ZERO błędów (wyjątek: oczekiwane 503 odnotować jako PASS)
3. Przygotuj narzędzie do podglądu DB (psql lub pgAdmin — połączenie staging)

---

## §1 Gating connected=true — ekran Connect

### 1.1 Sidebar Consultify — ukrywanie pozycji Partner Portal

Konto `connected=false`:
- Zaloguj się na konto bez profilu partnera.
- Sprawdź w stopce lewego sidebara głównego: **pozycja „Partner Portal" NIE powinna być widoczna**.
- Asercja: w Network, przy ładowaniu strony wywołanie `GET /api/partners/connection` zwraca `{ data: { connected: false } }`.
- Otwórz DevTools → Network, filtruj `connection` — potwierdź wywołanie i odpowiedź.
- **Asercja:** brak ikony `Users` / tekstu „Partner Portal" w stopce sidebara.

Konto `connected=true`:
- Zaloguj się na konto z profilem partnera.
- Sprawdź w stopce sidebara: **pozycja „Partner Portal" JEST widoczna**.
- Asercja: `GET /api/partners/connection` → `{ data: { connected: true } }`.

### 1.2 Wejście bezpośrednie na URL /partner bez connected=true

- Wejdź bezpośrednio na `http://localhost:3000/partner` z konta `connected=false`.
- **Oczekiwane:** strona ładuje się (brak redirectu), pokazuje ekran Connect — kafelka z tytułem „Connect your partner profile".
- **Nie crash, nie biała strona, nie spinner forever.**
- Asercja: URL pozostaje `/partner` (lub `/partner?tab=partner-home`) — brak automatycznego redirectu.
- Sidebar partnera (lewy panel) wyświetla sekcje, ale klikając dowolną sekcję inną niż Home → toast „Connect your partner profile first to access other sections."
- **Asercja toast:** komunikat wyraźny, toaster widoczny, po ~3 sek. znika. URL wraca do `?tab=partner-home`.

### 1.3 Formularz Connect — z flagą PARTNER_SELF_CONNECT_ENABLED=true [FLAG]

Wymaga `PARTNER_SELF_CONNECT_ENABLED=true` w .env backendu.

- Na koncie `connected=false` wejdź na `/partner`.
- **Asercja:** widoczny formularz z polem „Nazwa firmy" + przycisk „Utwórz i połącz profil".
- Zostaw pole puste → kliknij „Utwórz i połącz profil" → oczekiwane: pole jest opcjonalne (serwer przyjmie `name: undefined`).
- Wpisz nazwę firmy (np. „Test Partner Sp. z o.o.") → kliknij przycisk.
- **Asercja Network:** `POST /api/partners/connect` z body `{ name: "Test Partner Sp. z o.o." }` → odpowiedź `{ data: { connected: true } }`.
- **Asercja UI:** toast sukcesu „Partner profile connected. You can now complete your company profile." → automatyczne przekierowanie do `?tab=company-info`.
- **Asercja DB [DB]:** SELECT z `partner_organizations` i `partner_users` — nowy wiersz z `user_id` konta.
- Odśwież stronę → `GET /api/partners/connection` → `connected: true` → pełny dostęp do wszystkich sekcji.

### 1.4 Formularz Connect — bez flagi (domyślny stan) [FLAG]

- `PARTNER_SELF_CONNECT_ENABLED` = domyślnie `false`.
- Wejdź na `/partner` z konta `connected=false`.
- **Asercja:** formularz samoobsługowy jest UKRYTY. Widoczny tylko banner amber: „Aby dołączyć do programu partnerskiego, skontaktuj się z administratorem lub poproś o zaproszenie."
- Brak przycisku „Utwórz i połącz profil".
- `GET /api/partners/connection` → `selfConnectEnabled: false` (lub brak tego pola).

### 1.5 Próba nawigacji do sekcji bez connected — URL manipulation

- Konto `connected=false`.
- Wpisz ręcznie w pasek adresu: `http://localhost:3000/partner?tab=earnings`.
- **Asercja FE:** URL zostaje przepisany na `?tab=partner-home` (replace: true) — efekt `useEffect` w `PartnerPortalViewNew:3031-3038`.
- Widoczny ekran Connect, nie treść Earnings.
- **Asercja BE:** żaden endpoint `/api/v8/partner/earnings-summary` nie jest wywołany.

### 1.6 Zmiana connected=true w DB → reload → dostęp [DB] [MANUAL]

- Konto `connected=false`.
- W psql/pgAdmin: UPDATE `partner_users` SET `is_active = true` gdzie `user_id = <id>` LUB INSERT nowego partnera.
- Odśwież stronę aplikacji.
- **Asercja:** `GET /api/partners/connection` → `connected: true` → pełny dostęp (sekcje dostępne, sidebar główny pokazuje „Partner Portal").

### 1.7 E2E — mechanizm connected=true

Podsumowanie weryfikacji architektury (udokumentuj w raporcie):
- Sprawdzenie odbywa się przez **dwa niezależne HTTP GETy** do `GET /api/partners/connection`:
  1. `Sidebar.tsx:424` — przy mount sidebara (pokazuje/ukrywa pozycję w stopce)
  2. `PartnerPortalView.tsx:2933` — przy wejściu na /partner (pokazuje Connect vs portal)
- Backend: `partner_organizations JOIN partner_users WHERE user.id = ?` → zwraca `connected: boolean`
- Brak JWT claim — zawsze DB round-trip. Potwierdź to w Network — brak `connected` w nagłówku JWT.

---

## §2 Dashboard i Metryki

### 2.1 Dashboard — ładowanie KPI (connected=true)

- Zaloguj się na konto `connected=true`, wejdź na `/partner?tab=dashboard`.
- **Asercja Network:** `GET /api/partners/dashboard` → `{ success: true, data: { stats: { activeClients, activeProjects, certificationLevel, monthlyRevenue, revenueChange, ... }, recentActivity: [], certificationProgress: {...} } }`.
- **Asercja UI — 4 karty KPI:**
  - Active Clients (liczba)
  - Active Projects (liczba)
  - Certification Level (np. „Registered")
  - Monthly Revenue (€ format z separatorem)
- **Asercja — freshPartner empty state:** jeśli wszystkie wartości = 0 → UI pokazuje sekcję „Getting Started" / pusty stan (uczciwy, nie hardkodowane cyfry).
- **Asercja — error state:** jeśli endpoint zwróci błąd → UI pokazuje sekcję błędu z przyciskiem „Retry" (nie crash, nie spinner forever).

### 2.2 Dashboard — sekcja Recent Activity

- Sprawdź sekcję Recent Activity (dolna część dashboardu).
- Konto bez aktywności → lista pusta (uczciwy empty state).
- Konto z aktywnością → lista wpisów z typem, tekstem i czasem.
- **Asercja:** lista renderuje się z danych `recentActivity[]` z API — nie jest hardkodowana.

### 2.3 Dashboard — Runtime Summary Strip

- Przy ładowaniu dashboardu (lub w PartnerLayout) → pasek `PartnerRuntimeSummaryStrip`.
- **Asercja Network:** wywołanie `GET /api/v8/partner/program/status` (lub `earnings-summary`) — weryfikuj dokładny endpoint w kodzie `PartnerRuntimeSummaryStrip.tsx`.
- Pasek pokazuje: fazę życia (`earn`/`payout`) + saldo + co dalej (`whatNext`).
- Brak danych → pasek ukryty lub placeholder, bez crash.

### 2.4 Metryki (Metrics) — wydajność partnera

- Przejdź do `?tab=metrics`.
- **Asercja Network:** `GET /api/partners/metrics` → dane metryk (lub v8 analytics).
- **Asercja UI:** sekcja z danymi wydajnościowymi — konwersja poleconych, rankingi, trendy.
- **Asercja error:** błąd API → komunikat błędu + Retry (nie crash).
- **Asercja loading:** skeleton/spinner podczas ładowania (nie pusta strona).

### 2.5 Dashboard — breadcrumbs

- Na sekcji `dashboard` breadcrumb pokazuje: `Partner > Dashboard`.
- Na sekcji `metrics` breadcrumb pokazuje: `Partner > Home > Metrics`.
- Klik w breadcrumb → nawigacja do właściwej sekcji (przez `onSectionChange`).

---

## §3 Referrals — Linki, Kody, Analityka

### 3.1 My Links & Codes — wyświetlenie kodu i linku polecającego

- Przejdź do `?tab=referral-tools`.
- **Asercja Network:** `GET /api/v8/partner/referral-tools` → `{ partnerOrgId, referralCode, referralLink, slug, ... }`.
- **Asercja UI:** widoczny unikalny kod polecający + link do skopiowania.
- Przycisk kopiowania → clipboard = link polecający (sprawdź w clipboard lub input focus).
- **Asercja identity self-heal:** jeśli `partner_referral_tools` puste → endpoint tworzy wpis (self-heal pattern); kolejny call zwraca dane.

### 3.2 Campaign Links — tworzenie linku kampanii

- W sekcji My Links & Codes → formularz „Create Campaign Link".
- Wpisz nazwę kampanii (np. „Test Summer 2026") + opcjonalne UTM.
- Kliknij „Create".
- **Asercja Network:** `POST /api/v8/partner/campaign-links` z body `{ name: "Test Summer 2026", ... }` → `201` + nowy link.
- **Asercja DB [DB]:** SELECT z `partner_campaign_links WHERE partner_org_id = <id>` → nowy wiersz.
- Nowy link pojawia się w liście bez przeładowania (lub po odświeżeniu listy).

### 3.3 Campaign Links — usuwanie linku

- Lista linków kampanii → wybierz link → akcja Delete.
- **Asercja Network:** `DELETE /api/v8/partner/campaign-links/:linkId` → `200` lub `204`.
- **Asercja scoping:** BE weryfikuje `WHERE id = ? AND partner_org_id = ?` — brak możliwości usunięcia linku innego partnera.
- **Asercja DB [DB]:** link zniknął z `partner_campaign_links`.
- **Asercja UI:** toast potwierdzający, link znika z listy.

### 3.4 Click Analytics — wyświetlenie danych

- Przejdź do `?tab=referral-analytics`.
- **Asercja Network:** `GET /api/v8/partner/referral-analytics?days=30` → dane kliknięć.
- **Asercja UI:** wykres/tabela z kliknięciami (łącznie, wg źródła, wg kampanii).
- Pusty stan (zero kliknięć) → uczciwy empty state, nie crash.
- Zmiana zakresu dat (7/30/90 dni) → ponowne wywołanie z nowym `days=` query param.

### 3.5 Referred Customers (Attributions) — lista poleceń

- Przejdź do `?tab=referred-organizations`.
- **Asercja Network:** `GET /api/v8/partner/attributions` → lista poleceń.
- **Asercja UI:** tabela z kolumnami (klient, data, status, kwota prowizji).
- Pusty stan → komunikat „No referred customers yet."
- **Asercja §27 (częściowa):** tabela ma nagłówki kolumn, empty state, loading state — brak surowego `<table>` bez standardu (P2 do odnotowania).

---

## §4 Earnings — Prowizje i Payout (NAPRAWIONE)

### 4.1 Commission Earnings — wyświetlenie salda

- Przejdź do `?tab=earnings`.
- **Asercja Network (KLUCZOWE — test naprawy):** wywołanie `GET /api/v8/partner/earnings-summary` (v8, kanon) → `{ lifecyclePhase, balances: { earned, pending, paid }, ... }`.
  - Sprawdź w Network: endpoint = `/api/v8/partner/earnings-summary` (NIE stary `/api/partners/earnings`).
  - Status: `200` (nie 503).
- **Asercja UI:** widoczne saldo prowizji + faza cyklu życia (`earn`/`payout`).
- Brak hardkodowanej wartości `commissionRate: 15`.

### 4.2 Commissions — lista prowizji

- W sekcji Earnings → lista transakcji prowizyjnych.
- **Asercja Network:** `GET /api/v8/partner/earnings-summary` lub dedykowany endpoint `GET /api/partners/commissions`.
- **Asercja UI:** lista z kolumnami (data, klient, kwota, status).
- Pusty stan → uczciwy empty state.

### 4.3 Statements — zestawienia miesięczne

- Przejdź do `?tab=statements`.
- **Asercja Network:** call do odpowiedniego endpointu dla zestawień (sprawdź w EarningsSection.tsx).
- **Asercja UI:** lista miesięcznych zestawień lub komunikat o braku zestawień (nie crash).

### 4.4 Payout History — lista payoutów (P0 — NAPRAWA AUTH)

To jest **test regresji naprawy auth payoutów** (najważniejszy test w §4).

- Przejdź do `?tab=payouts`.
- **Asercja Network (KRYTYCZNE):**
  - Wywołanie `GET /api/partners/payouts` → **musi zwrócić `200`**, nie `403`.
  - Przed naprawą: 403 dla każdego zalogowanego partnera (bug `req.user?.partnerOrgId` = undefined).
  - Po naprawie: `getActivePartnerOrgIdForUser(userId)` → DB lookup → 200 z listą payoutów.
- **Asercja payload:** `{ success: true, data: [{ id, amount, status, ... }] }` lub pusta tablica `[]`.
- **Asercja UI:** lista wypłat z datą, kwotą, statusem. Pusty stan → uczciwy komunikat.
- **FAIL krytyczny:** status 403 w Network = naprawa nie działa / nie jest wdrożona.

### 4.5 Request Payout — żądanie wypłaty

- W sekcji Payouts → przycisk „Request Payout".
- Przed kliknięciem: upewnij się, że ustawienia payout są uzupełnione (patrz §4.6).

**Scenariusz happy path (konfiguracja payout complete, faza = `earn`):**
- Kliknij „Request Payout".
- **Asercja Network:** `POST /api/v8/partner/payouts/request` z opcjonalnym `{ notes: "...", payoutAccountId: "..." }`.
- **Asercja odpowiedź `201`:** `{ data: { payout: { id, netAmount, currency }, lifecyclePhase: "payout", balances: {...}, whatNext: [...] } }`.
- **Asercja DB [DB]:** wiersz w `partner_payouts` + wpis w `partner_program_ledger_entries` (typ `payout.requested`).
- **Asercja UI:** toast sukcesu + Runtime Summary Strip zaktualizowany (faza `earn` → `payout`).

**Scenariusz — niekompletne ustawienia payout (P29_PAYOUT_SETTINGS_INCOMPLETE):**
- Usuń ustawienia payout dla konta testowego → kliknij „Request Payout".
- **Asercja Network:** `409` z `{ code: 'P29_PAYOUT_SETTINGS_INCOMPLETE' }`.
- **Asercja UI:** komunikat informujący o konieczności uzupełnienia ustawień (nie crash, nie spinner).

**Scenariusz — nieprawidłowa faza (P29_LIFECYCLE_INVALID):**
- Jeśli faza ≠ `earn` (np. już w `payout`) → kliknij „Request Payout".
- **Asercja Network:** `409` z `{ code: 'P29_LIFECYCLE_INVALID' }`.
- **Asercja UI:** komunikat z wyjaśnieniem aktualnej fazy.

**Scenariusz — brak zatwierdzonych prowizji (PAYOUT_NOT_AVAILABLE):**
- Konto z zerowymi zatwierdzonymi prowizjami → kliknij „Request Payout".
- **Asercja Network:** `400` z `{ code: 'PAYOUT_NOT_AVAILABLE' }`.
- **Asercja UI:** komunikat „No approved commissions available".

### 4.6 Payout Settings — konfiguracja konta bankowego

- Przejdź do `?tab=payout-settings`.
- **Asercja Network GET:** `GET /api/v8/partner/payout-settings` → dane ustawień (numer konta / waluta / itp.).

**Edycja ustawień:**
- Zmień dane (np. numer IBAN, waluta).
- Kliknij „Save".
- **Asercja Network PUT:** `PUT /api/v8/partner/payout-settings` z body ustawień.
- **Asercja DB [DB]:** `SELECT * FROM partner_payout_settings WHERE partner_org_id = <id>` → zaktualizowane pole.
- **Asercja UI:** toast potwierdzający zapis.

**Walidacja:**
- Wpisz nieprawidłowy IBAN → sprawdź walidację po stronie FE lub BE.
- Puste wymagane pole → komunikat walidacji (nie crash).

---

## §5 Client Management (26 endpointów 503 — CELOWE)

> **Kontekst:** cała sekcja Client Management używa endpointów, które celowo zwracają 503. Decyzja produktowa D-01: stuby ukryte za flagą z labelem „wkrótce" (DP-5). Sprawdzamy GRACEFUL DEGRADATION, nie funkcjonalność.

### 5.1 Client Access Manager — wyświetlenie ekranu (graceful 503)

- Przejdź do `?tab=client-access`.
- **Asercja UI:** ekran renderuje się bez crash — widoczna sekcja z informacją o niedostępności tej funkcji (FEATURE_NOT_AVAILABLE), lub pusta lista, lub label „coming soon".
- **Asercja Network:** `GET /api/partners/clients` → `503` z `{ code: 'FEATURE_NOT_AVAILABLE' }`.
  - NIE: timeout / spinner forever / biała strona.
  - TAK: UI pokazuje proper empty state lub komunikat.
- **FAIL:** crash aplikacji, biała strona, nieskończony spinner.

### 5.2 Próba tworzenia klienta → graceful 503

[MANUAL] Jeśli formularz tworzenia klienta jest widoczny (nie ukryty):
- Wypełnij formularz → kliknij „Dodaj klienta".
- **Asercja Network:** `POST /api/partners/clients` → `503 { code: 'FEATURE_NOT_AVAILABLE', message: 'Partner client creation is not available yet.' }`.
- **Asercja UI:** komunikat błędu (nie crash). Formularz nie resetuje się bez komunikatu.
- **Asercja:** brak danych w żadnej tabeli DB (endpoint nic nie zapisuje).

Jeśli przycisk jest ukryty przez FE (DP-5 label „wkrótce"):
- **Asercja UI:** sekcja pokazuje label „Wkrótce" lub badge „Beta" lub podobny komunikat.
- Brak aktywnego przycisku tworzenia.

### 5.3 Organizations — wyświetlenie listy (503 odczyt)

- Przejdź do `?tab=organizations`.
- **Asercja Network:** jeśli endpoint `GET /api/partners/organizations` istnieje i zwraca 503 → UI pokazuje graceful empty state.
- **Asercja:** brak nieskończonego spinnera.

### 5.4 Active Projects — wyświetlenie listy

- Przejdź do `?tab=projects`.
- **Asercja Network:** `GET /api/v8/partner/projects` (v8) → `200` + lista projektów LUB 503 FEATURE_NOT_AVAILABLE → graceful.
- Pusty stan → uczciwy komunikat.

### 5.5 Team Members (pracownicy) — graceful 503

- Przejdź do `?tab=users`.
- Próba dodania pracownika: `POST /api/partners/employees` → `503 { code: 'FEATURE_NOT_AVAILABLE' }`.
- **Asercja UI:** brak crash. Opcjonalny komunikat o niedostępności funkcji.

### 5.6 Partner Stats — graceful 503

[MANUAL] Jeśli sekcja stats jest widoczna:
- **Asercja Network:** `GET /api/partners/stats` → `503 { code: 'FEATURE_NOT_AVAILABLE' }`.
- **Asercja UI:** graceful — brak crash, brak spinnera infinity.

---

## §6 Licencje i Faktury (503 — CELOWE)

### 6.1 Licencje — graceful 503

[MANUAL] Przejdź do sekcji Licenses (jeśli jest dostępna w nawigacji):
- **Asercja Network:** `GET /api/partners/licenses` → `503 { statusCode: 503, type: 'not_configured', message: 'Partner licenses unavailable (no real implementation)' }`.
- **Asercja UI:** graceful degradation — komunikat „licenses not available" lub sekcja ukryta.
- `POST /api/partners/licenses/order` → identyczny wzorzec 503.
- **FAIL:** crash aplikacji lub spinner bez końca.

### 6.2 Faktury — graceful 503

[MANUAL] Przejdź do sekcji Invoices (jeśli jest dostępna):
- **Asercja Network:** `GET /api/partners/invoices` → `503 { statusCode: 503, type: 'not_configured' }`.
- **Asercja UI:** graceful — lista pusta lub komunikat o niedostępności.
- **FAIL:** crash, biała strona.

### 6.3 Tiers (poziomy partnerstwa) — graceful 503

[MANUAL] Jeśli sekcja tiers jest widoczna:
- **Asercja Network:** `GET /api/partners/tiers` → `503`.
- **Asercja UI:** graceful — poziomy wyświetlone jako statyczne dane LUB komunikat niedostępności.

---

## §7 Academy — Certyfikacje

### 7.1 Learning Path — wyświetlenie ścieżki

- Przejdź do `?tab=learning-path`.
- **Asercja Network:** `GET /api/partners/certifications` → lista dostępnych certyfikacji z `partner_certifications`.
- **Asercja UI:** lista kursów/certyfikacji z postępem.
- Badge w sidebarsie (liczba oczekujących) odpowiada danym z API.
- Pusty stan → uczciwy komunikat „No certifications available."

### 7.2 Postęp w module certyfikacyjnym

- Wybierz certyfikację → wybierz moduł → zaznacz postęp.
- **Asercja Network:** `POST /api/partners/certifications/:certId/modules/:moduleId/progress` → `200`.
- **Asercja DB [DB]:** wiersz w `partner_learning_progress` z `user_id + cert_id + module_id`.
- **Asercja UI:** pasek postępu zaktualizowany.

### 7.3 Egzamin — start i submit

**Start:**
- Kliknij „Start Exam" dla certyfikacji gotowej do egzaminu.
- **Asercja Network:** `POST /api/partners/certifications/:certId/exam/start` → `201` z danymi egzaminu (pytania lub token).

**Submit:**
- Odpowiedz na pytania → kliknij „Submit".
- **Asercja Network:** `POST /api/partners/certifications/:certId/exam/submit` z odpowiedziami → wynik `{ passed: true/false, score, ... }`.
- **Asercja UI:** wynik egzaminu wyświetlony (PASS/FAIL + punktacja).
- Jeśli PASS → certyfikacja pojawia się w sekcji Certificates.

### 7.4 Certificates — lista certyfikatów i pobieranie PDF

- Przejdź do `?tab=certificates`.
- **Asercja UI:** lista zdobytych certyfikatów.
- Kliknij „Pobierz PDF" dla certyfikatu.
- **Asercja Network:** endpoint generowania PDF (sprawdź w kodzie `partnerCertificatePdf.ts`).
- **Asercja:** plik PDF pobiera się (nie 404, nie crash).

---

## §8 Resources — Zasoby Partnera

### 8.1 Wyświetlenie listy zasobów

- Przejdź do `?tab=documentation` (lub innej sekcji Resources).
- **Asercja Network:** `GET /api/partners/resources` → lista zasobów z `partner_resources`.
- **Asercja UI:** karty zasobów z tytułem, typem, rozmiarem.
- Tier-check działa: zasoby dostępne dla poziomu `REGISTERED` i wyższych są widoczne; zasoby wymagające wyższego tier są ukryte lub oznaczone jako wymagające upgrade.

### 8.2 Pobieranie zasobu (tier-check)

- Kliknij „Download" na dostępnym zasobie.
- **Asercja Network:** `GET /api/partners/resources/:resourceId/download` → `200` + plik (lub redirect do URL).
- **Asercja UI:** pobieranie startuje.
- Zasób powyżej tieru partnera → `403` lub komunikat „Upgrade your tier to access this resource."

**Asercja bezpieczeństwa (P2 — shared catalog):**
- [MANUAL] Spróbuj pobrać zasób z UUID innego partnera (jeśli znasz ID).
- **Oczekiwane:** `200` lub `403` — zasoby są shared catalog, tier-check ważniejszy niż org-scope.
- **Odnotuj** to jako P2 finding (brak audit log partner_org_id) — nie jest to bloker testu.

### 8.3 Marketing Materials, Case Studies, PMO Templates

- Przejdź do `?tab=marketing`, `?tab=case-studies`, `?tab=templates`.
- **Asercja dla każdej sekcji:** ładuje się bez crash, zasoby filtrowane wg `type`.
- Badge „New" przy `templates` jest widoczny w sidebarsie.

---

## §9 Directory Profile — Profil Publiczny

### 9.1 Company Info — wyświetlenie i edycja

- Przejdź do `?tab=company-info`.
- **Asercja Network GET:** `GET /api/v8/partner/organization` → dane firmy.
- Edytuj nazwę firmy → kliknij „Save".
- **Asercja Network PUT:** `PUT /api/v8/partner/organization` z `{ name: "...", description: "...", ... }` → `200`.
- **Asercja DB [DB]:** `SELECT * FROM partner_organizations WHERE id = <partner_org_id>` → zaktualizowane dane.

### 9.2 Specializations — zarządzanie specjalizacjami

- Przejdź do `?tab=specializations`.
- Dodaj specjalizację (np. „Digital Transformation").
- **Asercja Network PUT:** `PUT /api/v8/partner/organization/specializations` z `{ specializations: ["Digital Transformation"] }`.
- **Asercja DB [DB]:** tabela `partner_specializations` — nowy wiersz.
- Usuń specjalizację → PUT z pominiętą specjalizacją → DELETE w DB.

### 9.3 Regions — zarządzanie regionami

- Przejdź do `?tab=regions`.
- Dodaj region (np. „Poland").
- **Asercja Network PUT:** `PUT /api/v8/partner/organization/regions` → `200`.
- **Asercja DB [DB]:** tabela `partner_regions`.

### 9.4 Public Listing — toggle widoczności w katalogu

- Przejdź do `?tab=public-listing`.
- Toggle przełącznik „Public Listing Enabled".
- **Asercja Network:** `PUT /api/v8/partner/organization/listing` z `{ public_listing_enabled: true }` → `200`.
- **Asercja DB [DB]:** `partner_organizations.public_listing_enabled = true`.
- Wyłącz toggle → PUT z `{ public_listing_enabled: false }` → DB = `false`.
- **Asercja:** zmiana widoczności jest trwała po odświeżeniu strony.

---

## §10 Onboarding Partnera (Enterprise Wizard)

### 10.1 Status onboardingu przy pierwszym połączeniu

- Po wykonaniu `POST /api/partners/connect` (§1.3) → automatyczne przekierowanie na `?tab=company-info`.
- **Asercja Network:** `GET /api/v8/partner/onboarding-status` → `{ status: { termsAccepted: false, tierSelected: false, profileComplete: false } }`.
- **Asercja UI:** wizard onboardingowy (EnterpriseOnboardingWizard) widoczny z krokami do wykonania.

### 10.2 Accept Terms

- Kliknij „Accept Terms".
- **Asercja Network:** `POST /api/v8/partner/onboarding/accept-terms` → `200`.
- **Asercja:** `legalService.acceptDocuments()` wywołany po stronie BE.
- **Asercja UI:** krok „Terms" oznaczony jako ukończony.

### 10.3 Select Tier

- Wybierz tier (np. „Registered").
- **Asercja Network:** `POST /api/v8/partner/onboarding/select-tier` z `{ tier: "REGISTERED" }` → `200`.
- **Asercja UI:** wybrany tier zaznaczony.

### 10.4 Complete Onboarding

- Po ukończeniu wymaganych kroków → kliknij „Complete Onboarding".
- **Asercja Network:** `POST /api/v8/partner/onboarding/complete` → `200`.
- **Asercja DB [DB]:** `user_onboarding_status` — wpis z `completed=true`.
- **Asercja UI:** wizard ukryty / sekcja home pokazuje dashboard.

---

## §11 Program Ledger — Cykl Życia Płatności

### 11.1 Podgląd ledger

- [MANUAL] Wejdź na sekcję wyświetlającą ledger (może być w Payouts lub osobna sekcja).
- **Asercja Network:** `GET /api/v8/partner/program/ledger` → `{ entries: [{ entryType, amount, currency, actor, timestamp, note }] }`.
- **Asercja UI:** historia wpisów ledger z typami (`payout.requested`, `commission.earned`, itp.).

### 11.2 Program Status — faza i salda

- **Asercja Network:** `GET /api/v8/partner/program/status` lub endpoint `getProgramStatusDetail`.
- Odpowiedź zawiera: `{ lifecycle_phase: "earn"|"payout", balances: {...}, whatNext: ["..."] }`.
- **Asercja UI (Runtime Summary Strip):** faza wyświetlona poprawnie w pasku na górze.

### 11.3 Lifecycle transition — request payout phase

- Przy kliknięciu „Request Payout" (§4.5) → jeśli `lifecycle_phase === "earn"` → `POST /api/v8/partner/program/lifecycle/request-payout-phase`.
- **Asercja Network:** transition wywoływana przez `PartnerProgramLedgerService.transitionLifecycle()`.
- **Asercja DB [DB]:** `partner_program_ledger_entries` nowy wpis `payout.requested`.

---

## §12 Testy Ścieżek Cross-Module

### 12.1 M26 → M27 SuperAdmin (Partner Settlements)

[MANUAL] Wymaga konta SuperAdmin.

- Zaloguj się jako SuperAdmin → przejdź do `/superadmin/partner-settlements`.
- **Asercja:** sekcja Settlements widoczna z listą payoutów do zatwierdzenia.
- **Asercja Network:** `GET /api/superadmin/partners/settlements` → lista payoutów.
- Kliknij „Approve" → `POST /api/superadmin/partners/commissions/approve` z `{ confirmation: true, reason: "..." }`.
- Brak `confirmation` lub za krótki `reason` → `428` z `{ code: 'P29_DUAL_CONTROL_REQUIRED' }`.
- **Asercja:** dual-control wymuszony serwerowo.

**Attributions (503 — celowe):**
- `GET /api/superadmin/partners/attributions` → `503 { type: 'not_configured' }`.
- **Asercja UI (SuperAdmin):** graceful — sekcja attribution ukryta lub komunikat niedostępności.

### 12.2 M26 → M24 Admin (zarządzanie `connected=true`)

[MANUAL] Wymaga konta Admin/Owner.

- Zaloguj się jako Admin → przejdź do panelu admina organizacji.
- Sprawdź, czy admin może zarządzać połączeniem partnerskim użytkowników w swojej organizacji.
- **Asercja:** zmiana `connected` dla użytkownika przez admina odzwierciedla się w `GET /api/partners/connection` dla tego użytkownika.

### 12.3 Sidebar Consultify → M26 (Navigation)

- Konto `connected=true`.
- Kliknij pozycję „Partner Portal" w stopce sidebara głównego.
- **Asercja:** nawigacja do `/partner` (AppView.PARTNER_LANDING).
- **Asercja:** `GET /api/partners/connection` wywołany ponownie przy mount.

### 12.4 Public Route — validate-code

[MANUAL] Test bez logowania.

- Wyloguj się z aplikacji.
- Otwórz nową kartę → `GET /api/public/partner/validate-code?code=<referral_code>`.
- **Asercja:** `200` z `{ valid: true/false, ... }` (bez auth). Endpoint publiczny.
- `GET /api/public/partner/track-click` → śledzi kliknięcie bez auth.

---

## §13 Testy Przekrojowe

### 13.1 i18n — PL/EN

- Zmień język aplikacji na **PL** (Settings → Language).
- Sprawdź M26 → wszystkie etykiety, nagłówki, komunikaty: w języku polskim.
- Zmień język na **EN** → sprawdź te same sekcje: w języku angielskim.
- **Asercja:** 0 kluczy `partner.*` wyświetlanych jako klucz techniczny (np. `partner.sidebar.earnings`). Kompletność i18n zweryfikowana w kodzie: `grep -r "partner\." src/locales/ | wc -l` (oba pliki PL i EN mają identyczną liczbę kluczy).
- **Edge:** brak tłumaczenia dla nowych kluczy → wyświetlany fallback EN string (nie klucz techniczny).

### 13.2 Dark Mode

- Przełącz motyw na **ciemny** (Settings → Theme lub skrót).
- Wejdź na `/partner` → sprawdź wszystkie sekcje (sidebar, karty KPI, tabele, formularze).
- **Asercja:** sidebar `dark:bg-navy-950`, aktywna pozycja `dark:bg-crimson-600/15 dark:text-crimson-300`, tło kart `dark:bg-navy-800`, tekst `dark:text-white` / `dark:text-slate-300`.
- **Brak:** białe div na ciemnym tle, niewidoczny tekst, tło klasy `bg-white` bez `dark:` odpowiednika.
- Sprawdź ekran Connect (disconnected) w dark mode — kafelka `dark:border-primary-700/50 dark:bg-primary-900/20`.

### 13.3 Zero błędów w konsoli

- Dla każdej sekcji (partner-home, dashboard, earnings, referral-tools, certifications, company-info): **0 błędów w Console**.
- Dopuszczalne: ostrzeżenia React DevMode, logi `[partner]` diagnostyczne.
- **Niedopuszczalne:** `TypeError`, `Uncaught`, `undefined is not a function`, 404 na zasobach statycznych.
- Endpointy 503 (celowe) nie są błędami — logować ich obecność jako EXPECTED 503, nie FAIL.

### 13.4 Responsywność i A11y

- Sprawdź `/partner` na viewporcie **1440px** (desktop) i **768px** (tablet).
- Sidebar na tablet: zwijany lub przechodzi w hamburger.
- **Asercja A11y:** każdy przycisk ma `title` lub `aria-label`. Sidebar — przyciski nawigacji mają `aria-current="page"` dla aktywnej sekcji (sprawdź DOM).
- Formularz Connect — pole input ma `<label>` lub `aria-label`.
- Nawigacja klawiaturą: Tab przez elementy sidebara → Enter aktywuje sekcję.

### 13.5 Sidebar Partner — grupowanie i zwijanie

- Sidebar ma **8 grup** (HOME, REFERRALS, EARNINGS, CLIENT MANAGEMENT, ACADEMY, DIRECTORY PROFILE, RESOURCES).
- Kliknij nagłówek grupy → zwijanie/rozwijanie (CSS `max-h` + `opacity` transition).
- **Asercja:** auto-expand grupy zawierającej aktywną sekcję (`useEffect` na `activeSection`).
- Przycisk „Back to App" na dole sidebara → `window.history.back()` lub `onBack()` callback.
- Wyszukiwarka (Cmd+K lub ikona szkła) → filtruje pozycje sidebara wg `keywords`.

### 13.6 Lazy loading sekcji (React.lazy)

- `ReferralToolsSection`, `EarningsSection`, `ProviderHomeView`, `ClientAccessView` są ładowane lazy.
- Asercja: przy pierwszym wejściu na sekcję widoczny `<Suspense>` fallback (spinner) przez moment.
- Brak błędów granicy błędów (`ErrorBoundary`) — sprawdź czy `<Suspense>` fallback renderuje się poprawnie.
- Sieć wolna (DevTools → Network → throttle 3G) → spinner widoczny przez chwilę, potem content.

### 13.7 Persistencja stanu sekcji w URL

- Wejdź na `?tab=earnings` → odśwież stronę (`F5`).
- **Asercja:** po odświeżeniu aktywna sekcja = `earnings` (URL persist przez `params.get('tab')`).
- **Asercja:** `isConnected=false` → nawet jeśli URL = `?tab=earnings`, override do `partner-home`.
- Przekierowanie historii (legacy routes): `PartnerLegacyRoutes` mapuje stare URL-e na nowe `?tab=...`.

---

## §14 Mapa Epików — weryfikacja pokrycia

Każdy F-epik z `Harvard/wdrozenie-100/M26-portal-partnerski.md` jest pokryty:

| Epik | Story | Pokrycie w teście |
|------|-------|------------------|
| EPIK 1 — Honest degradacja (L-01) | 1.1 — earnings 503 DB_ERROR (nie hardkodowane) | §4.1 (test naprawy fallback earnings) |
| EPIK 2 — E2E happy-path S1 | 2.1 — connect→dashboard | §1.3 + §2.1 |
| EPIK 2 — E2E happy-path S3 | 2.2 — payout lifecycle | §4.4 + §4.5 + §11.3 |
| EPIK 3 — Schema na prod (L-08) | 3.1 — migracje zweryfikowane | §SETUP [DB] |
| EPIK 3 — PARTNER_SELF_CONNECT (L-09) | 3.2 — decyzja flagi | §1.3 [FLAG] + §1.4 [FLAG] |
| EPIK 4 — Stuby Client Management (L-10) | 4.1 — 503 graceful (DP-5) | §5.1–§5.6 |
| EPIK 5 — Dual API surface (L-07) | 5.1 — legacy deprecate | §4.1 (verify v8, nie legacy) |
| EPIK 5 — §27 tabele (L-05) | 5.3 — tabele listowe | §3.5 + §4.4 + §13.5 (odnotować P2) |

---

## §15 Regresja — istniejące testy automatyczne

Uruchomić przed lub po testach manualnych:

```bash
# Wszystkie testy partnera
npx vitest run tests/unit/backend/routes/partner-payouts-auth.test.ts
npx vitest run tests/components/partner/
npx vitest run server/src/routes/v8/__tests__/v8-partner-read.test.ts
npx vitest run tests/integration/partner-portal.test.ts
npx vitest run tests/unit/services/v8-partner-api.test.ts

# Pełny zestaw
npx vitest run --reporter=verbose 2>&1 | grep -E "partner|PASS|FAIL"
```

**Kluczowe testy do sprawdzenia:**

| Plik testu | Co weryfikuje | Wymagany wynik |
|------------|--------------|----------------|
| `partner-payouts-auth.test.ts` | Naprawa auth payoutów (req.user.partnerOrgId → DB lookup) | PASS (oba scenariusze: 200 i 403-clean) |
| `v8-partner-read.test.ts` | Routing + auth dla read endpointów v8 (15 testów) | PASS |
| `EarningsSection.v8-payout-request.test.tsx` | FE — flow żądania payout | PASS |
| `EarningsSection.v8-payout-settings.test.tsx` | FE — payout settings | PASS |
| `PartnerPortalView.test.tsx` | Render + sekcje | PASS |
| `partner-portal.test.ts` (integration) | PartnerService in-memory | PASS |

**Pułapka:** `v8-partner-read.test.ts` używa pełnych mocków serwisów — test przechodzi nawet jeśli SQL jest błędny. Nie zastępuje testów manualnych E2E.

---

## §16 Format Raportu Testów

Dla każdego testu zapisz:

```
[§X.Y] Nazwa testu
STATUS: PASS | FAIL | BLOCKED | SKIP
Dowód: [screenshot_url | Network tab | DB query result]
Endpoint: GET/POST /api/... → HTTP_STATUS { kluczowe_pola: wartości }
DB: SELECT ... → [wynik]
Uwagi: opcjonalne
```

**Przykład:**
```
[§4.4] Payout History — auth fix (P0)
STATUS: PASS
Dowód: Network → GET /api/partners/payouts → 200 { success: true, data: [] }
Endpoint: GET /api/partners/payouts → 200 { success: true, data: Array(0) }
Uwagi: brak payoutów = pusta tablica (OK, nie 403 jak przed naprawą)
```

---

## §17 Definition of Done

Test M26 jest **ZALICZONY** gdy:

- [ ] §1 — gating `connected=true` weryfikuje oba stany (false/true) + URL manipulation + toast prawidłowy
- [ ] §4.4 — `GET /api/partners/payouts` zwraca **200** (nie 403) dla konta z profilem — **test naprawy P0**
- [ ] §4.1 — `GET /api/v8/partner/earnings-summary` zwraca dane (nie hardkodowane `commissionRate: 15`)
- [ ] §5.1 — wszystkie sekcje Client Management renderują się bez crash przy odpowiedzi 503
- [ ] §5.1–§5.6 — żaden 503 celowy nie powoduje nieskończonego spinnera ani crash
- [ ] §13.3 — **0 błędów** JavaScript w konsoli (przy każdej sekcji)
- [ ] §15 — `partner-payouts-auth.test.ts` = PASS (oba testy: 200 i 403-clean)
- [ ] §13.1 — i18n PL + EN: brak kluczy technicznych w UI
- [ ] §13.2 — dark mode: brak białych div na ciemnym tle
- [ ] `Harvard/wdrozenie-100/M26-portal-partnerski.md` Epiki 1–5 pokryte dowodem

**Blokery wdrożenia (do odnotowania osobno):**
- [ ] L-08 — schema drift na prod: 5 migracji partner zweryfikowanych na staging → `\d partner_payout_settings` zwraca kolumny
- [ ] L-09 — decyzja `PARTNER_SELF_CONNECT_ENABLED` na prod (D-02 otwarta)
- [ ] L-05 — §27 dla 4 tabel listowych (P2, nie blokuje wdrożenia, wymaga follow-up)

---

*Plik: `Harvard/Testy manualne/TESTY_M26_PORTAL_PARTNERSKI.md` — Data: 2026-06-16*
