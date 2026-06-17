# TESTY — A1 Ecosystem/Affiliate Dashboard (aneks)

> **Moduł:** A1 Ecosystem/Affiliate Dashboard (aneks) · route `/affiliate` — wg `Harvard/podzial/_MODULE_MAP_V2.md`
> **Zakres tej paczki:** pełna dokumentacja aktualnego stanu STUB (klient atrapy + serwer 503 + redirect) oraz propozycje scenariuszy testowych dla hipotetycznej Ścieżki B (budować od zera).
> **Cel:** agent testujący ma potwierdzić, że STUB zachowuje się uczciwie (redirect → /chat, 503 z komunikatem `not_configured`, zero crashy, brak fake KPI) — oraz posiadać gotowe scenariusze gdy/jeśli właściciel zdecyduje o budowie.
> **Legenda:** **[MANUAL]** = wymaga ręcznej weryfikacji (incognito / zmiana DB); **[FLAG]** = zależne od flagi/capability/roli/środowiska; **[DB]** = dowód obejmuje wiersz/kolumnę w bazie; **[KNOWN FAIL BY DESIGN]** = scenariusz, który z założenia kończy się 503/redirect w obecnym STUB — rejestrujemy go jako PASS jeśli zachowanie jest uczciwe.
> **Data:** 2026-06-16
> **Inwentarz:** `Harvard/podzial/inventory/INV_G_admin_ustawienia_partner_superadmin.md` (sekcja ECOSYSTEM/AFFILIATE)
> **Teczka wdrożenia:** `Harvard/wdrozenie-100/A1-affiliate.md` · **Karta audytu:** `Harvard/modules/A1-affiliate/KARTA_AUDYTU.md`

---

## 0. Kontekst architektoniczny (przeczytaj przed testami)

### Stan aktualny — STUB E2E (decyzja DP-4 = WYCIĄĆ)

A1 jest **świadomym stubem end-to-end**. Decyzja DP-4 (Piotr, 2026-06-13) rozstrzygnęła: **Ścieżka A = wyciąć**. Egzekucja wycięcia jeszcze niewykonana (kod nadal istnieje). Niniejsza specyfikacja:

1. Dokumentuje obecny stan STUB — co testować żeby potwierdzić uczciwe zachowanie.
2. Rejestruje scenariusze Ścieżki B (hipotetyczne) jako gotowy backlog na wypadek zmiany decyzji.

### Mapa kluczowych plików

| Warstwa | Plik | Stan |
|---|---|---|
| FE — route | `src/routes/AppRoutes.tsx:2368` | `<Route path="/affiliate" element={<Navigate to="/chat" replace />}` — **REDIRECT, nie renderuje View** |
| FE — komponent | `src/views/AffiliateDashboardView.tsx` | UI-complete, ale **nieużywany** (nikt nie trafia na route, redirect zablokował) |
| FE — API klient | `src/services/api.ts:12929-12935` | Hardkodowane atrapy: `getUserReferrals` → `{success:true, referrals:[]}`, `getEcosystemStats` → `{success:true, stats:{...zera}}`, `generateReferralCode` → `{success:true, code:'', link:''}` |
| FE — menu | `src/components/navigation/Sidebar/menuConfig.ts:174-177` | Pozycja "Ecosystem Impact" **wycięta z menu** (komentarz: decision #1 Harvard) — `_journeyState` parametr funkcji `getMenuStructure` jest ignorowany (`_` prefix) |
| FE — routeConfig | `src/routes/routeConfig.ts:219` | `ROUTES.AFFILIATE = '/affiliate'`; `AppView.AFFILIATE_DASHBOARD` zmapowany, ale route zawsze redirectuje |
| BE — serwer | `server/src/routes/referrals.routes.ts:12-20` | Catch-all: `router.use((req,res) => res.status(503).json({statusCode:503, status:false, type:'not_configured', message:'Service temporarily unavailable...'})` |
| BE — mount | `server/src/Gateway.ts:720` | `mountStub('/api/referrals', referralRoutes, ...)` — zamontowany tylko gdy `enableStubRoutes = !isProduction \|\| ENABLE_STUB_ROUTES === 'true'` |
| BE — journeyState | `server/src/middleware/userStateGuard.middleware.ts:98` | Kolumna `users.user_journey_state` (DB) → `req.userState` — `ECOSYSTEM_NODE` to jeden ze stanów fazy D |
| BE — userStateMachine | `server/src/services/userStateMachine.ts:16,36,90` | `ECOSYSTEM_NODE` = faza D, uprawnienia identyczne z `TEAM_COLLAB` plus `canWorkOnDRD` |
| BE — featureGate | `server/src/middleware/featureGate.middleware.ts:49,128` | `ECOSYSTEM_NODE` pojawia się w bramkach, ale referrals routes i tak 503 catch-all — featureGate nie ma szans zadziałać |

### Zasada weryfikacji E2E

**STUB = większość scenariuszy to KNOWN FAIL BY DESIGN.** PASS dla testu STUB oznacza:
- `/affiliate` redirectuje do `/chat` (nie renderuje pustego UI, nie crasha)
- Wywołania `/api/referrals/*` zwracają 503 z `type:'not_configured'` (nie 500, nie cichy fail)
- API klient nigdy nie wywołuje prawdziwego HTTP — metody `getUserReferrals/getEcosystemStats/generateReferralCode` zwracają hardkodowane wartości synchronicznie bez fetch
- Zero błędów konsoli JavaScript przy próbie wejścia na /affiliate
- Zero wpisów "Ecosystem Impact" w sidebarze dla żadnego usera

**Środowiska:**
- **Dev/staging** (`NODE_ENV !== production`): `mountStub` aktywny → `/api/referrals/*` zwraca 503 (router zamontowany)
- **Prod** (`NODE_ENV === production`, brak `ENABLE_STUB_ROUTES=true`): `mountStub` pomija mount → `/api/referrals/*` zwraca **404** (Express: no route matched). To też jest poprawne zachowanie — ale różne od dev. Zaznacz środowisko w raporcie.

---

## Setup środowiska testowego

1. Uruchom dev server: FE `:3000` (lub `:5173`) + BE `:3001`.
2. Zaloguj się jako owner DBR77 (pełne uprawnienia, żeby mieć pewność że maksymalny user nie widzi wejścia).
3. Otwórz DevTools → zakładka **Network** (filtr `referral`) oraz **Console** (standard: zero błędów to wymóg).
4. Przygotuj drugie konto testowe o niskich uprawnieniach (lub nowy trial).
5. [DB] Dostęp do bazy (Railway staging): kolumna `users.user_journey_state` — potrzebna do testu §1.4.

---

## 1. Gating — journeyState i widoczność w menu

> Kontekst: `getMenuStructure(t, _journeyState)` w `menuConfig.ts:46` — parametr `_journeyState` jest ignorowany (`_` prefix), więc pozycja affiliate **nigdy** nie pojawia się w menu niezależnie od wartości journeyState.

### 1.1 Menu — brak wpisu dla dowolnego usera

**Cel:** potwierdzić, że żaden user nie widzi pozycji „Ecosystem Impact" w sidebarze.

**Kroki:**
1. Zaloguj się jako owner DBR77 (najwyższe uprawnienia w UI).
2. Przejrzyj cały sidebar — widok domyślny + rozwinięte sekcje.
3. **Asercja:** brak pozycji „Ecosystem Impact" lub jakiejkolwiek „Affiliate" w sidebarze.
4. [FLAG] Zaloguj się jako user z inną rolą (member, admin) — asercja identyczna.

**Oczekiwany wynik:** PASS — brak wpisu w menu.
**Uwaga:** jest to KNOWN EXPECTED STATE — zgodny z decyzją DP-4 i komentarzem w `menuConfig.ts:174-177`.

### 1.2 Menu — journeyState nie wpływa na widoczność [DB]

**Cel:** potwierdzić, że nawet jeśli user ma `user_journey_state = 'ECOSYSTEM_NODE'` w DB, nie dostaje wpisu affiliate w menu.

**Kroki:**
1. [DB] Ustaw `UPDATE users SET user_journey_state = 'ECOSYSTEM_NODE' WHERE id = <test-user-id>` na stagingu.
2. Zaloguj się tym userem (lub odśwież sesję).
3. Sprawdź sidebar — czy pojawia się wpis affiliate.
4. **Asercja:** brak wpisu — `getMenuStructure` ignoruje parametr `_journeyState`.

**Oczekiwany wynik:** PASS — brak wpisu mimo ECOSYSTEM_NODE w DB.
**Oznaczenie:** [DB][MANUAL]

### 1.3 Direct URL /affiliate — zachowanie po redirect

**Cel:** potwierdzić, że `/affiliate` (wpisany ręcznie) nie renderuje `AffiliateDashboardView` — tylko redirectuje.

**Kroki:**
1. Będąc zalogowanym, wpisz w pasek adresu `http://localhost:3000/affiliate` i naciśnij Enter.
2. Obserwuj: adres URL zmienia się na `/chat`.
3. **Asercja 1:** URL końcowy = `/chat` (lub `/chat/...`), nie `/affiliate`.
4. **Asercja 2:** renderuje się panel czatu (Teresa), nie `AffiliateDashboardView`.
5. **Asercja 3:** brak błędów w konsoli przy przekierowaniu.
6. **Asercja 4:** Network — brak żadnych wywołań `/api/referrals/*` (redirect jest po stronie FE zanim cokolwiek zmontuje).

**Oczekiwany wynik:** PASS — redirect bez side-effects.

### 1.4 Direct URL /affiliate — niezalogowany user [MANUAL]

**Kroki:**
1. Wyloguj się lub otwórz incognito.
2. Wpisz `http://localhost:3000/affiliate`.
3. **Asercja:** redirect → strona logowania (requireAuth obsługuje niezalogowanych) lub → `/chat` przez `<Navigate replace />` (route jest wewnątrz `requireAuth` wrappera lub poza nim — sprawdź `AppRoutes.tsx:2368` kontekst).

**Uwaga diagnostyczna:** `<Route path={ROUTES.AFFILIATE} element={<Navigate to={ROUTES.AI_CHAT} replace />}` jest na poziomie głównego routera bez explicite `requireAuth` wrappera (weryfikacja: sprawdź czy jest wewnątrz `<AuthenticatedRoutes>` czy na zewnątrz). Zachowanie może się różnić.

**Oczekiwany wynik:** redirect albo do /login albo do /chat — NIE 500, NIE crash.
**Oznaczenie:** [MANUAL]

---

## 2. Klient atrapy — zachowanie FE przy próbie użycia API

> Kontekst: `AffiliateDashboardView` **nie jest renderowany** (route redirectuje). Testy poniżej są hipotetyczne — sprawdzają co by się stało gdyby View był zamontowany. Można je pominąć jeśli redirect jest potwierdzony w §1.3.

### 2.1 Atrapy api.ts — weryfikacja kodu (STATIC ANALYSIS)

**Cel:** potwierdzić, że metody API są synchronicznymi atrapami, nie wywołują HTTP.

**Weryfikacja inline (nie wymaga uruchomienia):**
- `api.ts:12929`: `getUserReferrals: async () => ({ success: true, referrals: [] as any[] })` — zwraca puste array bez fetch.
- `api.ts:12930-12934`: `getEcosystemStats: async () => ({ success: true, stats: { totalReferrals: 0, activeUsers: 0, earnings: 0 } })` — hardkodowane zera.
- `api.ts:12935`: `generateReferralCode: async () => ({ success: true, code: '', link: '' })` — puste stringi.

**Asercja:** żadna z tych metod nie zawiera `fetch(...)`, `axios(...)`, `apiClient.get(...)` ani innego wywołania HTTP. Brak próby trafienia na `/api/referrals/*`.

**Oczekiwany wynik:** PASS (weryfikacja statyczna). Zaznacz jako [KNOWN FAIL BY DESIGN] — byłoby problemem gdyby wywołania HTTP istniały.

### 2.2 AffiliateDashboardView — zachowanie przy atrapach (DEV TOOL FORCED RENDER)

> Ten test wymaga tymczasowego usunięcia redirect z AppRoutes lub bezpośredniego renderowania komponentu w izolacji (np. via Storybook lub `?devForce=affiliate` jeśli istnieje).

**Cel:** potwierdzić, że View renderuje się bez crasha mimo pustych danych z atrap.

**Kroki (jeśli View dostępny):**
1. Zamontuj `AffiliateDashboardView` (np. tymczasowo usuń redirect w dev).
2. Otwórz `/affiliate` — View renderuje się.
3. **Asercja 1:** spinner (loading state) pojawia się i znika (bo `getUserReferrals` i `getEcosystemStats` są synchroniczne — loading powinien spaść szybko).
4. **Asercja 2:** brak kodów polecających → wyświetla empty state: „Brak wygenerowanych kodów" + ilustracja + tekst „Zacznij zapraszać liderów strategicznych...".
5. **Asercja 3:** KPI grid pokazuje cztery kafelki z wartością `0` (Aktywne Kody, Użycia, Konwersje, Wskaźnik Wpływu).
6. **Asercja 4:** sekcja „Global Network Context" pokazuje hardkodowane fakty: „4.2k", „128 Node'ów" — **UWAGA: to hardkodowane dane w JSX `AffiliateDashboardView.tsx:363-372`, nie z backendu. To jest fake KPI widoczne w UI.** [KNOWN FAIL BY DESIGN]
7. **Asercja 5:** przycisk „Generuj Kod Polecający" — klik wywołuje `Api.generateReferralCode()`, która zwraca atrapa `{success:true, code:'', link:''}`, wyświetla toast „Nowy kod polecający został wygenerowany" i odświeża dane (nadal puste).
8. **Asercja 6:** brak błędów konsoli.

**Oznaczenie:** [MANUAL] — wymaga tymczasowej modyfikacji dev

**Oczekiwany wynik:** View renderuje się bez crasha; KPI = 0; empty state; hardkodowany fake „Global Network Context" widoczny (udokumentuj jako dług — **jeśli view kiedykolwiek wróci do produkcji, hardkodowane wartości muszą być usunięte**).

### 2.3 Przycisk „Zasoby dla Polecających" — dead CTA

**Cel:** potwierdzić, że przycisk nie crashuje.

**Kroki (jeśli View dostępny):**
1. Klik w „Zasoby dla Polecających" (`AffiliateDashboardView.tsx:343`).
2. **Asercja:** brak akcji — przycisk nie ma `onClick` (jest to `<button>` bez handlera). Zero błędów konsoli.
3. **Asercja 2:** brak nawigacji, brak 404, brak modalu.

**Oczekiwany wynik:** [KNOWN FAIL BY DESIGN] — dead CTA, brak akcji. Dokumentujemy fakt.

---

## 3. Serwer 503 — dokumentacja kontraktu `/api/referrals/*`

> **Środowisko:** dev/staging (`NODE_ENV !== production`). Na produkcji: 404 zamiast 503 gdy `ENABLE_STUB_ROUTES` nie ustawiony.

### 3.1 Weryfikacja 503 catch-all na wszystkich metodach HTTP

**Cel:** potwierdzić, że `/api/referrals/*` zwraca 503 z poprawnym payloadem na każdą metodę.

**Narzędzie:** DevTools Network lub `curl`/HTTPie na localhostcie.

**Kroki — dla każdego poniższego żądania:**

| # | Metoda | Endpoint | Opis hipotetyczny |
|---|--------|----------|-------------------|
| 3.1.1 | GET | `/api/referrals` | lista poleceń |
| 3.1.2 | GET | `/api/referrals/stats` | statystyki użytkownika |
| 3.1.3 | POST | `/api/referrals/generate` | generowanie kodu |
| 3.1.4 | GET | `/api/referrals/ecosystem` | KPI ekosystemu |
| 3.1.5 | GET | `/api/referrals/anything` | dowolna ścieżka |
| 3.1.6 | DELETE | `/api/referrals/some-id` | usunięcie kodu |
| 3.1.7 | PUT | `/api/referrals/some-id` | aktualizacja |

**Dla każdego żądania — asercja (z uwierzytelnionym requestem, Bearer token):**
```
HTTP 503
Content-Type: application/json
{
  "statusCode": 503,
  "status": false,
  "type": "not_configured",
  "message": "Service temporarily unavailable due to missing configuration"
}
```

**Asercja dodatkowa:** brak logów `console.error` w FE przy obsłudze 503 — tylko `console.error('Failed to fetch affiliate data')` w catch bloku `AffiliateDashboardView.tsx:66` jest dozwolony (i tak nie trafia do produkcji przez redirect).

**Oczekiwany wynik:** PASS dla każdego wiersza — 503 z `type:'not_configured'`. **[KNOWN FAIL BY DESIGN]**

### 3.2 Zachowanie na produkcji — 404 zamiast 503 [FLAG]

**Cel:** potwierdzić różnicę środowiskową.

**Kroki:**
1. [FLAG] Na produkcji (centerbeam) lub z `NODE_ENV=production` bez `ENABLE_STUB_ROUTES=true`.
2. Wyślij `GET /api/referrals` z validnym auth tokenem.
3. **Asercja:** HTTP 404 (Express: no route matched, bo `mountStub` nie zamontował routera).
4. Alternatywnie: jeśli `ENABLE_STUB_ROUTES=true` na prod → 503 jak w §3.1.

**Oczekiwany wynik:** [KNOWN FAIL BY DESIGN] — 404 lub 503, nigdy 200 na produkcji.
**Oznaczenie:** [FLAG][MANUAL]

### 3.3 Brak błędów konsoli na 503 (UI path) [KNOWN FAIL BY DESIGN]

> Relevantne tylko jeśli View jest kiedykolwiek renderowany (§2.2).

**Asercja:** `console.error('Failed to fetch affiliate data:', error)` w `AffiliateDashboardView.tsx:66` — jedyny spodziewany log. Brak innych błędów konsoli (no unhandled rejections, no React errors).

---

## 4. Ścieżka A — egzekucja wycięcia (testy po wykonaniu DP-4)

> Te testy **stają się obowiązującymi** po wykonaniu decyzji DP-4 (wycięcie modułu).

### 4.1 Usunięcie route `/affiliate`

**Kroki:**
1. Po egzekucji wycięcia: wpisz `http://localhost:3000/affiliate`.
2. **Asercja:** HTTP 404 od Reacta (route nie istnieje) lub redirect do `/chat` przez catch-all — w zależności od implementacji usunięcia.

### 4.2 Brak pozycji w sidebarze (już teraz: §1.1)

Już spełnione — test §1.1 to pre-weryfikacja.

### 4.3 Grep na 0 referencji do AffiliateDashboardView

**Kroki:**
1. Po usunięciu pliku: `grep -r "AffiliateDashboardView\|AFFILIATE_DASHBOARD\|/affiliate" src/ server/` — oczekiwany wynik: **0 wyników** (poza plikami testowymi i `_INDEX.md`).
2. `grep -r "referralRoutes\|referrals.routes" server/src/Gateway.ts` — oczekiwany wynik: **0 wyników**.
3. `grep -r "getUserReferrals\|getEcosystemStats\|generateReferralCode" src/` — oczekiwany wynik: **0 wyników** (atrapy usunięte z api.ts).

### 4.4 Sidebar journeyState cleanup [DB]

**Asercja:** po wycięciu `_journeyState` parametr w `getMenuStructure` nie musi być usunięty (ignorowany `_`), ale kod nie powinien zawierać żadnego warunku `journeyState === 'ECOSYSTEM_NODE'` związanego z affiliatem.

### 4.5 DB — tabele migrations (dormant foundations)

**Uwaga:** decyzja DP-4 = wyciąć **view, route, atrapy, warunek sidebar**. Teczka `A1` wspomina, że „DB migrations + referrals backend kept as dormant foundations". Sprawdź z właścicielem czy migracje DB mają być usunięte czy pozostawione — różny zakres wycięcia.

---

## 5. Ścieżka B — propozycje scenariuszy testowych (gdyby właściciel zdecydował: budować)

> **Status:** HIPOTETYCZNE. Ścieżka B nie jest aktualnym planem (DP-4 = wyciąć). Zachowane jako gotowy backlog.

### 5.1 Program affiliacyjny — epik B1

#### 5.1.1 Rejestracja w programie

| # | Krok | Asercja E2E |
|---|------|-------------|
| a | User z `ECOSYSTEM_NODE` state wchodzi na `/affiliate` | Widok ładuje się z realnymi danymi (endpointy 200) |
| b | Klik „Generuj Kod Polecający" | POST `/api/referrals/generate` → 200, nowy rekord w tabeli `referral_codes` [DB] |
| c | Kod pojawia się na liście | GET `/api/referrals` zwraca rekord z `code`, `use_count=0`, `conversions=0` |
| d | User bez `ECOSYSTEM_NODE` state próbuje wejść na `/affiliate` | Redirect/403, brak dostępu |
| e | Cross-org: user org A widzi tylko własne kody, nie org B | `WHERE org_id = req.user.orgId` w SQL [DB] |

#### 5.1.2 Link polecający i tracking konwersji

| # | Krok | Asercja E2E |
|---|------|-------------|
| a | Skopiuj link polecający | Clipboard zawiera URL z kodem referralowym |
| b | Nowy user rejestruje się przez link | `use_count` +1 w tabeli `referral_codes` [DB] |
| c | Nowy user przechodzi do płatnego konta | `conversions` +1 [DB] |
| d | Wskaźnik Wpływu oblicza się realnie (nie hardkodowany) | `conversions/referrals.length` z prawdziwych danych |

### 5.2 Dashboard KPI — epik B2

#### 5.2.1 Metryki realne zamiast atrap

| # | Krok | Asercja E2E |
|---|------|-------------|
| a | GET `/api/referrals/stats` | 200, `{ totalReferrals, totalConversions }` z bazy [DB] |
| b | GET `/api/referrals/ecosystem` | 200, aggreagty ekosystemu (tylko dla admin/ECOSYSTEM_NODE) |
| c | Kafelki KPI odzwierciedlają dane live | UI odświeża się po akcjach bez reload |
| d | Zero hardkodowanych wartości w JSX | `grep -r "4.2k\|128 Node" src/` → **0 wyników** |

### 5.3 Zarządzanie kodami

| # | Krok | Asercja E2E |
|---|------|-------------|
| a | Kod z datą wygaśnięcia — badge „Wygasł" | `expires_at < NOW()` → badge czerwony w UI |
| b | Usunięcie kodu (jeśli zaimplementowane) | DELETE `/api/referrals/:id` → 200, znikniecie z listy [DB] |
| c | Share kodu (przycisk `Share2`) | Otwiera native share lub kopiuje link do clipboard |

### 5.4 Bezpieczeństwo i org-scope (krytyczne przy Ścieżce B)

> Na podstawie rekomendacji `A1-affiliate.md` §B–E: „org-scope + auth + role OD POCZĄTKU"

| # | Scenariusz | Asercja |
|---|-----------|---------|
| a | User org A wykonuje GET `/api/referrals` | Widzi tylko swoje kody (filtr `org_id`) |
| b | User org A wykonuje GET `/api/referrals/:id-org-B` | 403 lub 404 — brak dostępu |
| c | User bez `ECOSYSTEM_NODE` state wywołuje POST `/api/referrals/generate` | 403 |
| d | JWT bez `org_id` w tokenie | 401 lub 403 |
| e | SQL injection w parametrach | Parametrized queries — brak skutku |
| f | Rate limiting na generowanie kodów | Max X requestów/minutę per user |

---

## 6. Mapa epików — pokrycie

| Epik | Opis | Pokrycie w tym pliku |
|------|------|---------------------|
| Aktualny STUB (karta §1b) | Cały moduł stub E2E | §1 (gating), §2 (klient atrapy), §3 (503 serwer) |
| Ścieżka A — wyciąć (karta §7) | Usunięcie view/route/api/sidebar | §4 |
| Ścieżka B — EPIK B1 referrals CRUD | Realne endpointy + auth | §5.1, §5.4 |
| Ścieżka B — EPIK B2 klient realny | api.ts zamiast atrap | §5.2 |
| Ścieżka B — EPIK B3 protokół V1 | Pełne testy cross-org/role | §5.4 |
| journeyState gate | Widoczność sidebar | §1.1, §1.2 |
| graceful 503 | Brak crashy przy stub | §2.1, §3.1 |

**Zero niepokrytych epików** (Ścieżki A i B mają scenariusze; stan STUB w pełni udokumentowany).

---

## 7. Testy przekrojowe

### 7.1 i18n — PL/EN

**Kroki:**
1. Ustaw język PL → wejdź na `/affiliate` → redirect do `/chat` — sprawdź że /chat renderuje się po polsku.
2. Ustaw język EN → analogicznie.
3. **Asercja:** brak hardkodowanych stringów „Ecosystem Impact" widocznych po polsku lub angielsku w sidebarze.
4. [MANUAL] Gdyby View był renderowany: wszystkie texty w `AffiliateDashboardView.tsx` są **hardkodowane po polsku** (brak `t()` — np. „Generuj Kod Polecający", „Brak wygenerowanych kodów"). Dokumentuj jako dług i18n dla Ścieżki B.

### 7.2 Dark mode

**Kroki:**
1. Przełącz na dark mode.
2. Wejdź na `/affiliate` (redirect do /chat) — upewnij się że `/chat` renderuje się poprawnie w dark mode.
3. [MANUAL] Gdyby View był dostępny: `AffiliateDashboardView` używa klas `dark:bg-navy-950`, `dark:bg-navy-900`, `dark:border-navy-700` — sprawdź wizualnie że nie ma białych/jasnych artefaktów.

### 7.3 A11y (dostępność)

**Kroki:**
1. Redirect `/affiliate` → `/chat`: użyj czytnika ekranu (lub axe DevTools) — asercja: focus ląduje poprawnie na `/chat`.
2. [MANUAL] Gdyby View był renderowany: przyciski „Generuj Kod Polecający" i „Kopiuj kod" mają `title` atrybuty — sprawdź ich obecność w DOM.

### 7.4 Zero błędów konsoli JavaScript

**Asercja obowiązkowa dla każdego testu:**
- Network (Console) = zero `TypeError`, `ReferenceError`, `Unhandled Rejection`.
- Jedyny dozwolony log przy redirect: brak (redirect jest czysty).
- Jedyny dozwolony log gdyby View był renderowany: `console.error('Failed to fetch affiliate data:', error)` w catch bloku (i to tylko jeśli prawdziwy HTTP zostałby wywołany — atrapy go nie generują).

### 7.5 Responsywność

**Kroki:**
1. Otwórz DevTools → Responsive Mode, 375px (mobile).
2. Wejdź na `/affiliate` → redirect do `/chat`.
3. **Asercja:** `/chat` renderuje się poprawnie na mobile — redirect nie powoduje layout shift.

---

## 8. Testy regresji — istniejące testy

**Wynik grep `affiliate|referral` w `src/__tests__/`, `src/views/__tests__/`, `src/routes/__tests__/`:**

**Brak testów jednostkowych/integracyjnych dla `AffiliateDashboardView` lub `api.ts:12929-12935` w katalogu `src/`.**

Istniejące testy powiązane (ale dotyczą M26 Portal Partnerski, nie A1):
- `tests/components/partner/ReferralToolsSection.v8-campaign-create.test.tsx` — testuje `ReferralToolsSection` z M26, nie A1
- `tests/integration/partners/partners.no-demo-organization-referral-dashboard.test.ts` — integracja partnerów (M26), nie affiliateów

**Polecenie do uruchomienia:**
```bash
cd /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify
npx vitest run --reporter verbose 2>&1 | grep -i "affiliate\|referral"
```
**Oczekiwany wynik:** brak testów dotyczących modułu A1 (żadne nie przechodzą, żadne nie failują — moduł bez pokrycia testowego).

---

## 9. Format raportu + Definition of Done

### Format raportu dla każdego testu

```
[§X.Y] [PASS|FAIL|SKIP|KNOWN FAIL BY DESIGN]
Krok: <opis>
Dowód: <screenshot | curl output | log konsoli | DevTools Network>
Uwagi: <np. "zachowanie zgodne z DP-4", "hardkodowane fake KPI w JSX">
```

### Definition of Done — STUB (Ścieżka A — jeszcze nie wycięte)

| # | Kryterium | Weryfikacja |
|---|-----------|-------------|
| 1 | `/affiliate` redirectuje do `/chat` bez crasha | §1.3 PASS |
| 2 | Brak wpisu „Ecosystem Impact" w sidebarze dla każdego usera | §1.1 PASS |
| 3 | `journeyState === 'ECOSYSTEM_NODE'` w DB nie ujawnia affiliate w menu | §1.2 PASS |
| 4 | `/api/referrals/*` → 503 `not_configured` (dev/staging) | §3.1 PASS dla każdego endpointu |
| 5 | Zero błędów konsoli JS przy całej ścieżce | §7.4 PASS |
| 6 | Atrapy api.ts nie wywołują HTTP | §2.1 PASS (static analysis) |

**Uwaga:** DoD STUB = potwierdź uczciwe zachowanie wycofanego modułu. **Większość §2 i §3 to KNOWN FAIL BY DESIGN** — registrujemy jako PASS gdy zachowanie jest uczciwe (503 zamiast 200, redirect zamiast pustego UI, atrapy zamiast false-positive call).

### Definition of Done — po egzekucji DP-4 (Ścieżka A)

| # | Kryterium | Weryfikacja |
|---|-----------|-------------|
| 1 | 0 referencji do `AffiliateDashboardView` w kodzie | §4.3 grep PASS |
| 2 | Route `/affiliate` → 404 (nie redirect do /chat) | §4.1 PASS |
| 3 | 0 atrap `getUserReferrals/getEcosystemStats/generateReferralCode` w api.ts | §4.3 grep PASS |
| 4 | `referralRoutes` nie mountowany w Gateway.ts | §4.3 grep PASS |
| 5 | Sidebar nie zawiera komentarza ani kodu związanego z affiliatem | §4.4 PASS |

### Definition of Done — Ścieżka B (gdyby budować)

| # | Kryterium | Weryfikacja |
|---|-----------|-------------|
| 1 | Endpointy `/api/referrals/*` zwracają 200 z realnymi danymi | §5.1–5.3 PASS |
| 2 | Org-scope: user widzi tylko własne kody | §5.4a PASS |
| 3 | Brak cross-org data leak | §5.4b PASS (403 lub 404) |
| 4 | Brak hardkodowanych KPI w JSX | §5.2d PASS |
| 5 | i18n: wszystkie texty przez `t()` | §7.1 PASS |
| 6 | Pełny protokół V1 (Faza 4 żywa) | po implementacji |

---

*TESTY_A1_AFFILIATE.md — napisane 2026-06-16 na podstawie: karta audytu A1 (2026-06-11), teczka A1 (2026-06-13), weryfikacja kodu `AffiliateDashboardView.tsx`, `referrals.routes.ts`, `api.ts`, `AppRoutes.tsx`, `menuConfig.ts`, `Gateway.ts`, `userStateMachine.ts`. Decyzja DP-4 (wyciąć) z 2026-06-13 — egzekucja pending.*
