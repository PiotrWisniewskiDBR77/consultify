# TESTY — M15 Rezultaty · Fale W1–W6 (180 scenariuszy manualnych)

> **Moduł:** M15 Rezultaty (`/benefits`) — fale W1–W6 z `Harvard/wdrozenie-100/M15-STAN-PRACY-ODBIORY.md`
> **Zakres:** 6 nowych funkcjonalności (Benefit Profile, Driver Tree, Signals, Run Rate, BSC/OKR, AI/Finanse) — po 30 scenariuszy każda
> **Komponenty:** `StrategicLayerPanel`, `ValueDriverTree`, `AIInsightsPanel`, `PortfolioInsightsPanel`
> **Trasa:** `/benefits?tab=results_strategic` (flaga `ff_strategicLayer=1`) i `/benefits?tab=results_ai` (flagi `ff_aiInsights=1` / `ff_portfolioInsights=1`)
> **API:** `/api/results-strategic/`, `/api/results-driver-tree/`, `/api/results-extended/`
> **Cel:** agent testujący wykonuje każdy krok w Chrome — weryfikuje UI + Network w DevTools. Operacja bez żądania HTTP = FAIL.
> **Wzorzec formatu:** `TESTY_M14_WDROZENIE.md`
> **Data:** 2026-06-25

---

## §0 Kontekst architektoniczny

### 0.1 Mapa komponentów → pliki → API

| Obszar | Komponent | Plik | API prefix |
|---|---|---|---|
| Zakładka Strategic | `StrategicLayerPanel` | `src/components/Results/StrategicLayerPanel.tsx` | `/api/results-strategic/:id/strategic` + `/api/results-extended/:id/adoption` + `/api/results-extended/:id/sustainment` |
| Drzewo wartości | `ValueDriverTree` | `src/components/Results/ValueDriverTree.tsx` | `/api/results-driver-tree/:id/driver-tree` |
| Zakładka AI | `AIInsightsPanel` | `src/components/Results/AIInsightsPanel.tsx` | `/api/results-extended/:id/narrative` + `/api/results-extended/:id/counterfactual` |
| Zakładka Portfolio | `PortfolioInsightsPanel` | `src/components/Results/PortfolioInsightsPanel.tsx` | `/api/results-extended/:id/signals` + `/api/results-extended/:id/run-rate` + `/api/results-extended/:id/reallocation` + `/api/results-extended/:id/scenarios` + `/api/results-extended/:id/finance-link` |
| Flagi | `resultsFeatureFlags.ts` | `src/components/Results/resultsFeatureFlags.ts` | URL query > localStorage > VITE env |
| Backend W1/W5 | `resultsExtended.routes.ts` | `server/src/routes/resultsExtended.routes.ts` | `/api/results-extended/` (10 tras) |
| Backend W2 | `resultsDriverTree.routes.ts` | `server/src/routes/resultsDriverTree.routes.ts` | `/api/results-driver-tree/` |
| Backend W5 (BSC) | `resultsStrategic.routes.ts` | `server/src/routes/resultsStrategic.routes.ts` | `/api/results-strategic/` |

### 0.2 Mapa feature-flag → UI

| Flaga | Query param | Efekt |
|---|---|---|
| `strategicLayer` | `?ff_strategicLayer=1` | Zakładka **Strategic** widoczna w ResultsHub + StrategicLayerPanel (BSC/BDN/OKR/Adoption/Sustainment) |
| `valueDriverTree` | `?ff_valueTree=1` | Sekcja **Value Driver Tree** w zakładce Strategic |
| `aiInsights` | `?ff_aiInsights=1` | AIInsightsPanel w zakładce **AI+Portfolio** (Narrative + Counterfactual) |
| `portfolioInsights` | `?ff_portfolioInsights=1` | PortfolioInsightsPanel w zakładce **AI+Portfolio** (Signals + Run-rate + Reallocation + Scenarios + Finance) |
| `m14Handoff` | `?ff_m14Handoff=1` | M14HandoffInbox inbox |

### 0.3 Endpoints

| Endpoint | Dane | Użyty przez |
|---|---|---|
| `GET /api/results-extended/all/benefit-profiles` | `{profiles[], summary}` | W1 |
| `GET /api/results-driver-tree/all/driver-tree` | `{nodes[], edges[], stats}` | W2 |
| `GET /api/results-extended/all/signals` | `{signals[], summary}` | W3 |
| `GET /api/results-extended/all/reallocation` | `{moves[], summary}` | W3 |
| `GET /api/results-extended/all/run-rate` | `{bridge, timing, summary}` | W4 |
| `GET /api/results-strategic/all/strategic` | `{bsc, bdn, narrative}` | W5 BSC |
| `GET /api/results-extended/all/adoption` | `{flags[], total, atRiskCount}` | W5 Adoption |
| `GET /api/results-extended/all/sustainment` | `{statuses[], summary}` | W5 Sustainment |
| `GET /api/results-extended/all/narrative` | `{narrative, executiveSummary}` | W6 |
| `GET /api/results-extended/all/counterfactual` | `{totalRealized, counterfactualProjected, attributableDelta, confidenceLabel}` | W6 |
| `GET /api/results-extended/all/scenarios` | `{scenarios[], irr, paybackPeriod, initiativeCount}` | W6 |
| `GET /api/results-extended/all/finance-link` | `{mappingCount, aggregate}` | W6 |

### 0.4 Zasada weryfikacji E2E (obowiązkowa)

- Każdy test z żądaniem sieciowym = FAIL bez potwierdzenia w **DevTools → Network** (filtr: `results-extended`, `results-strategic`, `results-driver-tree`).
- Odpowiedź HTTP 200 + kształt JSON zgodny z tabelą w §0.3 = warunek zaliczenia.
- Sama zmiana DOM bez żądania = FAIL.

---

## Setup środowiska testowego

1. Uruchom dev server: `npm run dev` — frontend `:3000`, backend `:3001`.
2. Zaloguj się jako **OWNER DBR77** (`piotr.wisniewski@dbr77.com` lub równoważny admin z `org_id` posiadającym KPI i inicjatywy).
3. Upewnij się, że org DBR77 ma **≥5 KPI** powiązanych z inicjatywami i **≥3 inicjatywy** ze statusem `EXECUTING`. Jeśli nie — dodaj przez M13 (Inicjatywy) lub M15 (KPI → Tworzenie KPI).
4. Otwórz **DevTools → Network** z filtrem `api/results` (wyczyść historię przed każdą sekcją).
5. Otwórz **Console** — zero czerwonych błędów = wymóg każdego testu.
6. Przygotuj **drugi login** (`user2@test.com`, inna organizacja) do testów bezpieczeństwa (§1.27–§1.30 itp.).
7. Sprawdź, że `.env.local` NIE jest aktywny na dev (`DATABASE_URL` w shell nie wskazuje na `centerbeam` — to PROD). Testuj tylko na staging/dev.
8. **Włączanie flag:** dodaj query params do URL lub wpisz w konsoli: `localStorage.setItem('ff.results_strategic_layer','1')` i przeładuj.

---

## §1 — W1: Benefit Profile & Stage-Gate

*Epik W1.1–W1.4 · Komponent: `StrategicLayerPanel` (sekcja BSC) + endpoint `/api/results-extended/all/benefit-profiles`*

### 1.1 Wejście na zakładkę Strategic — stan startowy

- Przejdź na `/benefits?tab=results_strategic&ff_strategicLayer=1`.
- **Asercja UI:** zakładka „Strategic" jest aktywna (podkreślona). Panel ładuje spinner, następnie renderuje przynajmniej jedną sekcję.
- **Asercja — Network:** żądanie `GET /api/results-strategic/all/strategic` → status 200 + payload `{bsc, bdn, narrative}`.
- **Asercja — Console:** zero błędów (brak `TypeError`, `404`, `undefined`).

### 1.2 Zakładka Strategic bez flagi — brak zakładki

- Przejdź na `/benefits` (bez `?ff_strategicLayer=1` i bez localStorage `ff.results_strategic_layer`).
- **Asercja UI:** zakładka „Strategic" NIE jest widoczna w navigation bar (lista zakładek nie zawiera „Strategic").
- **Asercja — Network:** NIE powinno być żądania do `/api/results-strategic/`. Sprawdź — brak requesty = PASS.

### 1.3 Włączenie flagi przez localStorage — zakładka pojawia się bez przeładowania URL

- Na stronie `/benefits` (bez flag) wpisz w konsoli: `localStorage.setItem('ff.results_strategic_layer','1')` → `Enter` → `location.reload()`.
- **Asercja UI:** po przeładowaniu zakładka „Strategic" jest widoczna.
- **Asercja — Network:** `GET /api/results-strategic/all/strategic` → 200.

### 1.4 Benefit profiles — żądanie do backendu

- Będąc na `/benefits?tab=results_strategic&ff_strategicLayer=1`, wyczyść Network, odśwież stronę (F5).
- **Asercja — Network:** żądanie `GET /api/results-extended/all/benefit-profiles` → status 200.
- **Asercja — payload:** JSON zawiera pole `profiles` (array) i `summary` (obiekt).

### 1.5 BSC — widoczne 4 perspektywy

- W sekcji „Balanced Scorecard" w zakładce Strategic.
- **Asercja UI:** widoczne 4 wiersze/kafelki z etykietami odpowiadającymi: **Finanse**, **Klient**, **Procesy**, **Rozwój** (lub angielskie: Financial / Customer / Process / Learning).
- **Asercja — dane:** każdy wiersz pokazuje liczbę KPI (`totalKpis ≥ 0`) i pasek zdrowia (health %).

### 1.6 BSC — perspektywa bez KPI → komunikat „Brak KPI"

- Jeśli org ma KPI tylko w 2 z 4 perspektyw (np. tylko Financial + Customer).
- **Asercja UI:** perspektywy bez KPI renderują komunikat „Brak KPI — dodaj KPI i powiąż je z inicjatywami." (lub i18n odpowiednik).
- **Asercja — dane:** odpowiednia perspektywa w `bsc.perspectives` ma `totalKpis = 0`.

### 1.7 KPI financial → typ `financial` w profilu

- Otwórz DevTools → Network → znajdź odpowiedź `GET /api/results-extended/all/benefit-profiles`.
- **Asercja — payload:** przynajmniej jeden profil z `type: 'financial'`. Sprawdź nazwę — powinna być KPI z kategorii przychodowej (np. „Wzrost przychodów").
- **Asercja UI:** sekcja BSC → wiersz „Finanse" ma `totalKpis > 0`.

### 1.8 KPI zawierający „redukcja" → isDisBenefit = true

- Sprawdź payload `GET /api/results-extended/all/benefit-profiles`.
- **Asercja — payload:** znajdź profil gdzie `name` zawiera słowo „redukcja" lub „cost reduction". Wartość `isDisBenefit` musi być `true`.
- Jeśli żaden KPI nie ma takiej nazwy — stwórz testowy KPI o nazwie „Redukcja kosztów operacyjnych" w M15 → zakładka KPI → Utwórz KPI, a następnie wróć i odśwież.

### 1.9 Stage-Gate — inicjatywa L5 (fully realized) → banked = value, forecast = 0

- Sprawdź payload `GET /api/results-extended/all/benefit-profiles`.
- **Asercja — payload:** znajdź profil z `stage.stageKey = 5` lub `stage.label = 'Zrealizowane'`. Sprawdź `stage.isRealized = true`.
- Inicjatywa na L5 w DB musi mieć `realization_percent = 100` lub `stage` ustawione ręcznie.

### 1.10 Stage-Gate — inicjatywa L4 (in flight) → forecast * 0.85

- **Asercja — payload:** profil z `stage.stageKey = 4` ma `forecast` > 0, `banked` < `forecast`.
- Dokładna weryfikacja: `forecast ≈ targetValue × 0.85` (dopuszczalne ±5%).

### 1.11 Benefit profile — kategoria `revenue`

- Payload `benefit-profiles`: znajdź profil z `category: 'revenue'`.
- **Asercja UI:** BSC → wiersz „Finanse" zawiera ten KPI (perspektywa = `financial` dla kategorii `revenue`).

### 1.12 Benefit profile — kategoria `cost-saving`

- **Asercja — payload:** profil z `category: 'cost-saving'` istnieje lub może być tworzony. `type` powinien być `financial`.
- **Asercja UI:** KPI z kosztem w BSC pojawia się w perspektywie Finanse.

### 1.13 Benefit profile — typ `strategic`

- Sprawdź profil z `type: 'strategic'` (np. NPS, customer satisfaction score).
- **Asercja — payload:** `category` to `customer-satisfaction` lub `market-share`.
- **Asercja UI:** BSC → wiersz „Klient" (`customer`) zawiera ten KPI.

### 1.14 Benefit profile — typ `operational`

- Sprawdź profil z `type: 'operational'` (np. czas procesu, defekty).
- **Asercja UI:** BSC → wiersz „Procesy" (`process`) zawiera ten KPI.

### 1.15 Benefit profile — typ `learning`

- KPI dot. szkoleń, adopcji systemu, kompetencji → `type: 'learning'` lub `category: 'employee-satisfaction'`.
- **Asercja UI:** BSC → wiersz „Rozwój" (`learning`) zawiera ten KPI.

### 1.16 Stage-Gate — pewność WYSOKA → stage 4-5

- **Asercja — payload:** profil gdzie `stage.confidence ≥ 0.8` → `stage.stageKey ≥ 4`.

### 1.17 Stage-Gate — pewność NISKA → stage 1-2

- **Asercja — payload:** profil gdzie `stage.confidence ≤ 0.3` → `stage.stageKey ≤ 2`.

### 1.18 Portfolio aggregate — suma banked

- Payload `benefit-profiles` → `summary.totalBanked` = suma wszystkich `profile.banked` z tablicy.
- **Asercja — matematyka:** zsumuj ręcznie wartości `banked` z tablicy `profiles[]` → porównaj z `summary.totalBanked`. Różnica ≤ 1%.

### 1.19 Portfolio aggregate — suma atRisk

- **Asercja — payload:** `summary.atRisk` = suma profili z `stage.stageKey ≤ 2`.

### 1.20 BSC — overallHealth obliczony

- Payload `GET /api/results-strategic/all/strategic` → `bsc.overallHealth`.
- **Asercja — zakres:** wartość w [0, 1]. Nie równa stałej (nie jest zawsze 1.0 lub 0.0).

### 1.21 BDN stats — nodeCount i edgeCount

- Payload `GET /api/results-strategic/all/strategic` → `bdn.stats`.
- **Asercja — payload:** `bdn.stats.nodeCount ≥ 0`, `edgeCount ≥ 0`, `benefitCount ≥ 0`, `enablerCount ≥ 0`.
- **Asercja UI:** jeśli `nodeCount > 0` — sekcja BDN (Benefit Dependency Network) renderuje liczniki węzłów.

### 1.22 BSC — odświeżenie po dodaniu KPI

- Otwórz zakładkę KPI → Utwórz KPI o nazwie „Test Revenue KPI W1-22" z kategorią **Finanse → Przychód**.
- Wróć na zakładkę Strategic (odśwież stronę).
- **Asercja — Network:** nowe żądanie `GET /api/results-extended/all/benefit-profiles` → nowy KPI pojawia się w `profiles[]`.
- **Asercja UI:** BSC → wiersz „Finanse" — `totalKpis` wzrósł o 1.

### 1.23 Pusta org — brak KPI → graceful empty state

- Zaloguj się jako nowy user nowej org (bez KPI).
- Wejdź na `/benefits?tab=results_strategic&ff_strategicLayer=1`.
- **Asercja — Network:** `GET /api/results-extended/all/benefit-profiles` → 200 + `{profiles: [], summary: {totalBanked: 0}}`.
- **Asercja UI:** panel renderuje się (bez crash), BSC pokazuje 4 perspektywy z `totalKpis = 0` i komunikatem „Brak KPI".

### 1.24 BSC — perspektywa z `health = 1.0` → zielony pasek

- Znajdź perspektywę gdzie `onTarget = totalKpis` (wszystkie KPI on-target).
- **Asercja UI:** pasek/kolor tej perspektywy jest zielony (`emerald` CSS class lub odpowiedni kolor sukcesu).

### 1.25 BSC — perspektywa z `health < 0.5` → czerwony/amber pasek

- Znajdź perspektywę gdzie `onTarget < totalKpis / 2`.
- **Asercja UI:** pasek/kolor tej perspektywy jest czerwony lub amber.

### 1.26 Nawigacja powrotna — `results_strategic` → `results_kpi` → powrót

- Kliknij zakładkę „KPI" → kliknij zakładkę „Strategic".
- **Asercja UI:** panel Strategic ponownie wyświetla dane (nie czarny ekran, nie loading wieczny).
- **Asercja — Network:** nowe żądania do `results-strategic` i `results-extended` (panel re-fetches po remount).

### 1.27 Brak tokenu → 401

- W DevTools → Application → Local Storage → usuń `auth_token` / `accessToken`.
- Odśwież stronę.
- **Asercja — Network:** żądanie `GET /api/results-extended/all/benefit-profiles` → status **401** lub redirect do `/login`.
- **Asercja UI:** użytkownik widzi ekran logowania.

### 1.28 Izolacja org — KPI innej org nie widoczne [SEC]

- Zaloguj się jako `user2@test.com` (inna organizacja bez KPI).
- Wejdź na `/benefits?tab=results_strategic&ff_strategicLayer=1`.
- **Asercja — Network:** `GET /api/results-extended/all/benefit-profiles` → `{profiles: []}` (puste — brak KPI tej org).
- **Asercja — kluczowa:** w payloadzie NIE ma danych z organizacji innego użytkownika.

### 1.29 URL injection — projectId = 'all' → poprawny zakres

- `GET /api/results-extended/all/benefit-profiles` → serwer używa `org_id` z JWT, ignoruje `:projectId = 'all'` jako filtr cross-org.
- **Asercja — Network:** payload zawiera tylko KPI własnej org (porównaj liczność z widokiem listy KPI w zakładce „KPI").

### 1.30 Reload strony — dane trwałe (stan UI, nie DB)

- Będąc na `/benefits?tab=results_strategic&ff_strategicLayer=1`, zapamiętaj wartości widoczne w BSC (np. totalKpis = 5).
- Naciśnij F5 (hard refresh).
- **Asercja UI:** te same wartości powracają po przeładowaniu (re-fetch z DB = dane nienaruszone).
- **Asercja — flaga:** flag URL `ff_strategicLayer=1` nadal aktywna → zakładka Strategic widoczna.

---

## §2 — W2: Value Driver Tree & Value Funnel

*Epik W2.1–W2.4 · Komponent: `ValueDriverTree` (w zakładce Strategic) · API: `/api/results-driver-tree/all/driver-tree`*

### 2.1 Wejście na zakładkę Strategic z flagą `ff_valueTree=1`

- Przejdź na `/benefits?tab=results_strategic&ff_strategicLayer=1&ff_valueTree=1`.
- **Asercja UI:** zakładka „Strategic" renderuje sekcję **Value Driver Tree** (nagłówek z ikoną `GitBranch`).
- **Asercja — Network:** `GET /api/results-driver-tree/all/driver-tree` → 200.

### 2.2 Driver Tree bez flagi `ff_valueTree` — sekcja ukryta

- Przejdź na `/benefits?tab=results_strategic&ff_strategicLayer=1` (bez `ff_valueTree`).
- **Asercja UI:** sekcja „Value Driver Tree" NIE jest widoczna. Panel renderuje BSC/OKR bez drzewa.
- **Asercja — Network:** NIE ma żądania do `/api/results-driver-tree/`.

### 2.3 Driver Tree — payload shape

- Wejdź na `/benefits?tab=results_strategic&ff_strategicLayer=1&ff_valueTree=1`.
- **Asercja — Network payload** `GET /api/results-driver-tree/all/driver-tree`:
  - `nodes[]` — każdy node ma `{id, label, type, value?, target?, confidence?}`.
  - `edges[]` — każda krawędź ma `{from, to, weight?}`.
  - `stats` — `{totalNodes, objectiveCount, kpiCount, initiativeCount, coveredValue}`.

### 2.4 Driver Tree — węzły typu `objective` (fioletowe)

- **Asercja — payload:** `nodes[]` zawiera co najmniej 1 węzeł z `type: 'objective'`.
- **Asercja UI:** węzeł `objective` jest wyróżniony kolorem **indigo** (fioletowy, `bg-indigo-100` w light mode).

### 2.5 Driver Tree — węzły typu `driver` (niebieskie)

- **Asercja — payload:** `nodes[]` zawiera co najmniej 1 węzeł z `type: 'driver'`.
- **Asercja UI:** węzeł `driver` ma kolor **sky/blue** (`bg-sky-100` w light mode).

### 2.6 Driver Tree — węzły typu `kpi` (zielone)

- **Asercja — payload:** `nodes[]` zawiera węzły z `type: 'kpi'` — liczność = `stats.kpiCount`.
- **Asercja UI:** węzły KPI mają kolor **emerald/green**.

### 2.7 Driver Tree — węzły typu `initiative` (żółte/amber)

- **Asercja — payload:** `nodes[]` zawiera węzły z `type: 'initiative'` — liczność = `stats.initiativeCount`.
- **Asercja UI:** węzły inicjatyw mają kolor **amber/yellow**.

### 2.8 Driver Tree — rozwijanie węzła z dziećmi

- Znajdź węzeł z `children[]` niepustą (np. `objective` z 2 `driver`-ami).
- Kliknij na węzeł (expand/collapse — ikona `ChevronDown` / `ChevronRight`).
- **Asercja UI:** kliknięcie rozwinęło dzieci — węzły potomne są widoczne w drzewie.
- **Asercja UI:** ponowne kliknięcie zwija dzieci.

### 2.9 Driver Tree — wartości węzłów (value + rolledUpValue)

- **Asercja — payload:** węzeł z `rolledUpValue` > 0 — to wartość propagowana z liści przez krawędzie ważone.
- **Asercja UI:** w UI widoczna jest liczba wartości (np. „1,2M" dla wartości 1 200 000).

### 2.10 Driver Tree — wartości sformatowane

- **Asercja UI:** wartości ≥ 1 000 000 wyświetlane jako `X.XM` (np. 2.5M). Wartości 1 000–999 999 jako `XK` (np. 500K). Poniżej 1000 jako liczba całkowita.

### 2.11 Driver Tree — stats.coveredValue = suma wartości węzłów inicjatyw

- **Asercja — payload:** `stats.coveredValue` ≈ suma `value` wszystkich węzłów z `type: 'initiative'`. Różnica ≤ 1%.

### 2.12 Driver Tree — krawędzie z wagami (weight)

- **Asercja — payload:** sprawdź `edges[]` — przynajmniej część krawędzi ma `weight` w zakresie (0, 1].
- Krawędzie bez `weight` traktowane jako `weight = 1.0`.

### 2.13 Driver Tree — hierarchia objective → driver → kpi → initiative

- **Asercja — payload:** istnieje ścieżka w grafie: `objective` → `driver` (przez edge), `driver` → `kpi` (przez edge), `kpi` → `initiative` (przez edge).
- Sprawdź: `edges[]` zawiera pary `{from: objectiveId, to: driverId}`, `{from: driverId, to: kpiId}`, `{from: kpiId, to: initiativeId}`.

### 2.14 Driver Tree — empty state (org bez KPI/inicjatyw)

- Zaloguj się jako user bez powiązanych KPI/inicjatyw.
- **Asercja — Network payload:** `{nodes: [], edges: [], stats: {totalNodes: 0, ...}}`.
- **Asercja UI:** wyświetla komunikat „Brak węzłów — dodaj KPI i powiąż je z inicjatywami" lub pustą sekcję z instrukcją.

### 2.15 Driver Tree — węzeł KPI z `confidence = 0.9` → badge „Pewne"

- **Asercja UI:** węzeł KPI z confidence ≥ 0.8 pokazuje label lub styl wskazujący wysoką pewność.

### 2.16 Driver Tree — węzeł KPI z `confidence = 0.3` → badge „Niskie"

- **Asercja UI:** węzeł KPI z confidence ≤ 0.3 jest wyróżniony (np. ciemniejszy border, ikona ostrzeżenia lub badge).

### 2.17 Driver Tree — reload zachowuje stan rozwinięcia

- Rozwiń węzeł (kliknij), następnie kliknij inną zakładkę (np. „KPI") i wróć na „Strategic".
- **Asercja UI:** drzewo resetuje się do stanu domyślnego (wszystkie węzły zwinięte lub zgodnie z defaultExpanded). Brak crash.

### 2.18 Driver Tree — stats w headerze sekcji

- **Asercja UI:** sekcja „Value Driver Tree" wyświetla statystyki: łączna liczba węzłów, liczba KPI, liczba inicjatyw.
- Sprawdź zgodność z `stats.totalNodes`, `stats.kpiCount`, `stats.initiativeCount` z payloadu.

### 2.19 Value Funnel — endpoint `/api/results-driver-tree/all/funnel` (jeśli zaimplementowany)

> Uwaga: punkt 2.19–2.24 dotyczą Funnela. Jeśli `/api/results-driver-tree/all/funnel` zwraca 404, odnotuj jako **SKIP / P1-backlog** i przejdź do 2.25.

- **Asercja — Network:** `GET /api/results-driver-tree/all/funnel` → 200 + `{stages[]}`.

### 2.20 Value Funnel — 4 etapy zawsze obecne

- **Asercja — payload:** `stages[]` ma dokładnie 4 elementy (Identified → Validated → In-Flight → Realized).

### 2.21 Value Funnel — leakage = max(0, valueFrom - valueTo) między etapami

- **Asercja — payload:** `stages[n].leakage = Math.max(0, stages[n].value - stages[n+1].value)` dla n=0,1,2.

### 2.22 Value Funnel — wartości malejące lub równe przez etapy

- **Asercja — payload:** `stages[0].value ≥ stages[1].value ≥ stages[2].value ≥ stages[3].value` (brak „odwróconego lejka").

### 2.23 Value Funnel — conversionRate między etapami

- **Asercja — payload:** `conversionRate = stages[n+1].value / stages[n].value` (gdzie `stages[n].value > 0`). Wynik w [0, 1].

### 2.24 Value Funnel — empty state → 4 etapy z wartością 0

- Pusta org bez KPI.
- **Asercja — payload:** `stages[]` nadal ma 4 elementy, każdy z `value: 0`, `leakage: 0`.

### 2.25 Driver Tree — izolacja org [SEC]

- Zaloguj się jako user2 (inna org).
- **Asercja — Network payload:** `nodes[]` nie zawiera węzłów z `id`-ami należącymi do org user1.

### 2.26 Driver Tree — brak tokenu → 401 [SEC]

- Usuń token z localStorage. Wejdź na `/benefits?tab=results_strategic&ff_strategicLayer=1&ff_valueTree=1`.
- **Asercja — Network:** `/api/results-driver-tree/all/driver-tree` → **401**.
- **Asercja UI:** redirect do `/login`.

### 2.27 Driver Tree — perf: ładowanie < 3s (sieć lokalna)

- Wejdź na zakładkę Strategic z flagą valueTree.
- **Asercja — Network → Timing:** czas odpowiedzi `GET /api/results-driver-tree/all/driver-tree` < 3000ms.
- Jeśli > 3s — odnotuj jako **bug wydajności** (P2).

### 2.28 Driver Tree — wiele obiektów (≥ 20 węzłów) — brak przepełnienia UI

- Dodaj więcej KPI i inicjatyw (≥ 5 KPI × 4 inicjatywy = potencjalnie 20+ węzłów).
- **Asercja UI:** drzewo nie wychodzi poza ramkę kontenera (brak overflow-x nieoczekiwany, lub poprawny scroll).
- **Asercja — Console:** brak błędów `Maximum update depth exceeded` ani podobnych.

### 2.29 Driver Tree — drzewo po tworzeniu nowego KPI odświeża się

- Utwórz nowy KPI (M15 → zakładka KPI → Utwórz). Wróć na zakładkę Strategic (odśwież).
- **Asercja — Network:** nowe żądanie `GET /api/results-driver-tree/all/driver-tree`.
- **Asercja — payload:** nowy węzeł `kpi` pojawia się w `nodes[]`.

### 2.30 Driver Tree + BSC — spójność danych KPI

- Z payloadu `/api/results-driver-tree/all/driver-tree` → policz węzły `type: 'kpi'` (= `stats.kpiCount`).
- Z payloadu `/api/results-strategic/all/strategic` → policz sumę `bsc.perspectives[].totalKpis`.
- **Asercja — spójność:** obie liczby powinny odpowiadać tej samej liczbie KPI w org. Różnica > 20% = bug.

---

## §3 — W3: Manager Signals & Value Reallocation

*Epik W3.1–W3.3 · Komponent: `PortfolioInsightsPanel` (sekcje Signals + Reallocation) · API: `/api/results-extended/all/signals` + `/api/results-extended/all/reallocation`*

### 3.1 Wejście na zakładkę AI+Portfolio z flagą

- Przejdź na `/benefits?tab=results_ai&ff_portfolioInsights=1`.
- **Asercja UI:** zakładka „AI+Portfolio" (lub „AI") aktywna. Panel renderuje przynajmniej sekcję „Sygnały do M14 Wdrożenie".
- **Asercja — Network:** `GET /api/results-extended/all/signals` → 200.

### 3.2 Zakładka AI+Portfolio bez flag — komunikat o wyłączeniu

- Przejdź na `/benefits?tab=results_ai` (bez `ff_portfolioInsights=1` i `ff_aiInsights=1`).
- **Asercja UI:** widoczny komunikat „Panel AI/Portfolio wyłączony — włącz ff_aiInsights lub ff_portfolioInsights." (lub i18n odpowiednik).
- **Asercja — Network:** NIE ma żądania do `/api/results-extended/`.

### 3.3 Signals — payload shape

- **Asercja — Network payload** `/api/results-extended/all/signals`:
  - `signals[]` — każdy signal: `{id, initiativeName, type, severity, message, realizationPct}`.
  - `summary` — `{total, critical, warning, info}`.

### 3.4 Signals — realizacja < 60% → signal BENEFIT_AT_RISK (warning)

- **Asercja — payload:** znajdź signal gdzie `realizationPct < 0.60` i `severity = 'warning'`, `type` = `'BENEFIT_AT_RISK'` lub podobny.
- Sprawdź: inicjatywa w DB ma `realization_percent < 60`.

### 3.5 Signals — realizacja < 40% → severity = `critical`

- **Asercja — payload:** znajdź signal gdzie `realizationPct < 0.40` i `severity = 'critical'`.
- **Asercja UI:** sygnały krytyczne wyróżnione czerwonym kolorem lub ikoną AlertTriangle.

### 3.6 Signals — sekcja Sygnały widoczna gdy `summary.total > 0`

- **Asercja UI:** sekcja „Sygnały do M14 Wdrożenie" renderuje się TYLKO gdy `signals.summary.total > 0`.
- Dodaj inicjatywę z niską realizacją (< 60%) → odśwież → sekcja pojawia się.

### 3.7 Signals — sekcja ukryta gdy `summary.total = 0`

- Org bez KPI lub wszystkie inicjatywy z realizacją ≥ 60%.
- **Asercja UI:** sekcja „Sygnały" nie jest renderowana (brak `<section>` z tym tytułem). Panel wciąż działa (nie crash).

### 3.8 Signals — maksymalnie 6 sygnałów w UI + indicator „+N więcej"

- Org z > 6 sygnałami.
- **Asercja UI:** lista renderuje dokładnie 6 sygnałów + tekst „+X więcej sygnałów" (gdzie X = total - 6).

### 3.9 Signals — badge krytycznych sygnałów w headerze

- **Asercja UI:** header sekcji „Sygnały" zawiera badge „X krytycznych" gdy `summary.critical > 0` (kolor czerwony).

### 3.10 Signals — krytyczny signal zawiera nazwę inicjatywy

- **Asercja UI:** każdy signal card renderuje `signal.initiativeName` (nie pusty string, nie `undefined`).

### 3.11 Signals — severity `info` → niebieski kolor/ikona

- **Asercja UI:** sygnał z `severity = 'info'` (realizacja ≥ 60% ale ≤ 80%) ma kolor informacyjny (niebieski lub szary, nie czerwony).

### 3.12 Reallocation — payload shape

- **Asercja — Network payload** `/api/results-extended/all/reallocation`:
  - `moves[]` — każdy move: `{from: {id, name}, to: {id, name}, amount, reason}` lub podobna struktura.
  - `summary` — `{moveCount, totalAmount}`.

### 3.13 Reallocation — fromCandidates = inicjatywy z realizacją < 50% i confidence ≤ 0.5

- **Asercja — payload:** inicjatywy spełniające oba warunki: `realizationPct < 0.50` AND `confidence ≤ 0.5` pojawiają się jako `from` w `moves[]`.
- Inicjatywa z `realizationPct = 30%` i `confidence = 0.4` → powinna być `fromCandidate`.

### 3.14 Reallocation — toCandidates = inicjatywy z realizacją ≥ 70% i confidence ≥ 0.6

- **Asercja — payload:** inicjatywy spełniające oba warunki pojawiają się jako `to` w `moves[]`.

### 3.15 Reallocation — sekcja widoczna gdy `moves.length > 0`

- **Asercja UI:** sekcja „Rekomendowane przesunięcia zasobów" renderuje się tylko gdy `realloc.moves.length > 0`.

### 3.16 Reallocation — maksymalnie 4 ruchy w UI

- Org z > 4 rekomendowanymi ruchami.
- **Asercja UI:** lista renderuje dokładnie pierwsze 4 wpisy (`slice(0, 4)`).

### 3.17 Reallocation — opis ruchu (from → to)

- **Asercja UI:** każdy ruch wyświetla nazwę źródła i celu (np. „Inicjatywa A → Inicjatywa B" lub zbliżony format).

### 3.18 Signals — brak tokenu → 401 [SEC]

- Usuń token. Wejdź na `/benefits?tab=results_ai&ff_portfolioInsights=1`.
- **Asercja — Network:** `GET /api/results-extended/all/signals` → **401**.

### 3.19 Signals — izolacja org [SEC]

- Zaloguj jako user2 (inna org bez niskich realizacji).
- **Asercja — payload:** `signals[] = []` i `summary.total = 0`.
- **Asercja — kluczowa:** NIE widać sygnałów z org user1.

### 3.20 Signals + Reallocation — parallel fetch (oba ładowane jednocześnie)

- Wyczyść Network. Wejdź na zakładkę AI+Portfolio.
- **Asercja — Network:** żądania `/signals`, `/reallocation`, `/run-rate`, `/scenarios`, `/finance-link` powinny być wysłane **równolegle** (Initiator = `PortfolioInsightsPanel.useEffect`, czas inicjacji ≈ ten sam).
- **Asercja — timing:** różnica między żądaniami < 100ms (parallel fetch, nie waterfall).

### 3.21 Signals — reload strony zachowuje dane

- Będąc na zakładce AI+Portfolio z widocznymi sygnałami, naciśnij F5.
- **Asercja UI:** po przeładowaniu te same sygnały wracają (re-fetch z DB).
- **Asercja — flaga:** URL z `ff_portfolioInsights=1` nadal aktywna.

### 3.22 Signals — pełna lista (więcej niż 6) dostępna po kliknięciu „więcej" [opcjonalnie]

- Kliknij na tekst „+X więcej sygnałów" (jeśli jest klikalny).
- **Asercja UI:** jeśli jest to link — nawiguje do trybu queue w zakładce KPI. Jeśli statyczny tekst — odnotuj jako P2 feature.

### 3.23 Reallocation — empty state (wszystkie inicjatywy na dobrej ścieżce)

- Org gdzie wszystkie inicjatywy mają `realizationPct ≥ 70%`.
- **Asercja UI:** sekcja „Rekomendowane przesunięcia" nie renderuje się (lub renderuje pusty komunikat).
- **Asercja — Network payload:** `{moves: [], summary: {moveCount: 0}}`.

### 3.24 Signals — signal z `type: 'BENEFIT_AT_RISK'` zawiera `realizationPct`

- **Asercja — payload:** signal ma `realizationPct` jako liczbę (np. 0.45 = 45%).
- **Asercja UI:** % realizacji widoczny w karcie sygnału (np. „45% realizacji").

### 3.25 Reallocation — amount jest liczbą (nie null)

- **Asercja — payload:** `moves[].amount` to liczba > 0 (kwota do przesunięcia w PLN lub %.

### 3.26 Reallocation — reason jest stringiem

- **Asercja — payload:** `moves[].reason` to niepusty string (np. „Niska realizacja (30%) + niska pewność (0.4)").

### 3.27 Signals — signal inicjatywy bez nazwy fallback

- **Asercja UI:** jeśli `signal.initiativeName` jest pusty/null — UI pokazuje fallback „Nieznana inicjatywa" lub `signal.initiativeId`. Brak `undefined` w UI.

### 3.28 Signals — wiele sygnałów dla jednej inicjatywy

- **Asercja — payload:** jedna inicjatywa może wygenerować > 1 signal (np. BENEFIT_AT_RISK + STALE_DATA).
- **Asercja UI:** wszystkie sygnały tej inicjatywy widoczne oddzielnie w liście.

### 3.29 Reallocation — brak candidatów (mieszane portfolio)

- Org gdzie część inicjatyw jest dobra (≥ 70% realizacja), ale żadna nie spełnia warunku `fromCandidate` (< 50% + low confidence).
- **Asercja — payload:** `moves = []` lub lista tylko z `toCandidates` bez `fromCandidates`.

### 3.30 Cross-module: signal → link do M14 Wdrożenie

- **Asercja UI:** header sekcji lub badge „Sygnały" zawiera link do M14 (np. `/implementation` lub przycisk „Przejdź do Wdrożenia").
- Sprawdź istniejący kod PortfolioInsightsPanel — jeśli link jest w JSX, kliknij i zweryfikuj nawigację.

---

## §4 — W4: Run Rate vs. In-Year

*Epik W4.1–W4.3 · Komponent: `PortfolioInsightsPanel` (sekcja Run-rate) · API: `/api/results-extended/all/run-rate`*

### 4.1 Run Rate — endpoint hit i payload shape

- Przejdź na `/benefits?tab=results_ai&ff_portfolioInsights=1`.
- **Asercja — Network:** `GET /api/results-extended/all/run-rate` → 200.
- **Asercja — payload shape:** `{bridge: {runRate, projectedInYear, alreadyRealized, annualizedRunRate, projectedFullYear, remainingRunRateContribution}, timing: {aheadOfPlanCount, behindPlanCount}, summary}`.

### 4.2 Run Rate — sekcja widoczna gdy `bridge` istnieje

- **Asercja UI:** sekcja „Run-rate vs in-year" renderuje się gdy `runRate?.bridge` jest truthy.

### 4.3 Run Rate — sekcja ukryta gdy `bridge = null`

- Org bez KPI z pomiarami.
- **Asercja UI:** sekcja „Run-rate" nie renderuje się (brak crash, brak pustego kontenera).
- **Asercja — Network payload:** `{bridge: null}` lub `{bridge: undefined}`.

### 4.4 Run Rate — `annualizedRunRate = realizedToDate / periodMonths × 12`

- **Asercja — payload:** `bridge.annualizedRunRate ≈ bridge.alreadyRealized / periodMonths × 12`.
- Sprawdź: jeśli `alreadyRealized = 600 000` i `periodMonths = 6`, to `annualizedRunRate = 1 200 000`.
- **Asercja UI:** wartość `annualizedRunRate` wyświetlana w wierszu „Run-rate annualizowany".

### 4.5 Run Rate — `projectedFullYear = alreadyRealized + remainingRunRateContribution`

- **Asercja — matematyka payload:** `bridge.projectedFullYear ≈ bridge.alreadyRealized + bridge.remainingRunRateContribution`. Różnica ≤ 1%.
- **Asercja UI:** wiersz „Prognoza do końca roku" pokazuje wartość `projectedFullYear`.

### 4.6 Run Rate — `runRateBridge.runRate = realizedToDate / periodMonths × 12`

- **Asercja — payload:** `bridge.runRate` = annualized rate (może być ≡ `annualizedRunRate` — zależy od implementacji).

### 4.7 Run Rate — wartości sformatowane jako PLN

- **Asercja UI:** wartości w sekcji Run-rate sformatowane jako waluta PLN lub z separatorem tysięcy (np. „1 200 000 zł" lub „1,2M").

### 4.8 Timing — `aheadOfPlanCount` > 0 → widoczny w UI

- Org z inicjatywami wyprzedzającymi plan.
- **Asercja UI:** sekcja Run-rate pokazuje licznik „X inicjatyw przed planem".
- **Asercja — payload:** `timing.aheadOfPlanCount > 0`.

### 4.9 Timing — `behindPlanCount` > 0 → widoczny w UI

- **Asercja UI:** sekcja Run-rate pokazuje licznik „X za planem".
- **Asercja — payload:** `timing.behindPlanCount > 0`.

### 4.10 Timing — suma `ahead + behind ≤ totalInitiatives`

- **Asercja — payload:** `timing.aheadOfPlanCount + timing.behindPlanCount ≤ suma inicjatyw org`.

### 4.11 Run Rate — `periodMonths = 0` → brak dzielenia przez zero

- **Asercja — Network payload:** jeśli serwer dostaje `periodMonths = 0` → odpowiedź gracefully zwraca `annualizedRunRate = 0` (nie `Infinity` lub `NaN`).
- Wywołaj endpoint bezpośrednio: `fetch('/api/results-extended/all/run-rate')` w konsoli — sprawdź że `bridge.annualizedRunRate` to liczba skończona.

### 4.12 Run Rate — empty org → graceful

- Zaloguj się jako user bez żadnych KPI z pomiarami.
- **Asercja — Network:** status 200, `{bridge: null, timing: {aheadOfPlanCount: 0, behindPlanCount: 0}}`.
- **Asercja UI:** sekcja Run-rate nie renderuje się. Brak crash.

### 4.13 Run Rate — sekcja nie blokuje renderowania innych sekcji

- Nawet jeśli endpoint `/run-rate` zwraca powoli (symuluj wolną sieć w DevTools → Network → Throttling → Slow 3G).
- **Asercja UI:** sekcje Signals i Reallocation renderują się niezależnie (nie czekają na run-rate).

### 4.14 Run Rate — izolacja org [SEC]

- user2 (inna org).
- **Asercja — payload:** `bridge` zawiera tylko dane pomiarów z własnej org. Sprawdź `alreadyRealized` — wartość odpowiada KPI tej org, nie org user1.

### 4.15 Run Rate — wariant w roku: `inYearValue` = tylko pomiary z bieżącego roku

- **Asercja — payload:** `summary.inYearValue` lub analogiczne pole — suma tylko pomiarów z roku `currentYear` (nie lat poprzednich).
- Sprawdź przez dodanie pomiaru z roku 2024 i roku 2026 do KPI → `inYearValue` 2026 nie zmienia się po dodaniu pomiaru z 2024.

### 4.16 Run Rate — `projectedFullYear > alreadyRealized` (projekcja w przyszłość)

- **Asercja — payload:** `bridge.projectedFullYear ≥ bridge.alreadyRealized`. Nie może być `projectedFullYear < alreadyRealized` jeśli są jeszcze miesiące do końca roku.

### 4.17 Run Rate — `remainingRunRateContribution = annualizedRunRate × (remainingMonths / 12)`

- **Asercja — matematyka:** wartość `remainingRunRateContribution` odpowiada: `annualizedRunRate × (12 - periodMonths) / 12`. Różnica ≤ 1%.

### 4.18 Run Rate — reload zachowuje dane

- Zanotuj wartość `annualizedRunRate` w UI. Naciśnij F5.
- **Asercja UI:** ta sama wartość po przeładowaniu (re-fetch z DB).

### 4.19 Run Rate — konsystencja z zakładką KPI

- Z zakładki AI+Portfolio zapamiętaj `bridge.alreadyRealized`.
- Przejdź na zakładkę KPI → dodaj pomiar do jednego KPI → wróć.
- **Asercja UI:** `alreadyRealized` wzrosło o wartość dodanego pomiaru (dane świeże po re-fetch).

### 4.20 Run Rate — `valueTimingSplit`: ahead vs. behind procentowo

- **Asercja — payload:** jeśli `summary.aheadPct` lub podobne pole istnieje → wartość w [0, 1].
- Sprawdź: `aheadOfPlanCount / totalInitiatives ≈ summary.aheadPct`. Różnica ≤ 1%.

### 4.21 Run Rate — duże wartości (miliony) nie przepełniają UI

- Org z `alreadyRealized = 50 000 000 PLN`.
- **Asercja UI:** wartość skrócona do `50M` lub `50,0M` — nie przepełnia kontenera wiersza.

### 4.22 Run Rate — wartość ujemna `alreadyRealized` (dis-benefit scenario)

- KPI dis-benefit z negatywnymi pomiarami.
- **Asercja — payload:** `bridge.alreadyRealized` może być ujemne.
- **Asercja UI:** wartość ujemna wyświetlana z minusem (np. „-500K") — nie powoduje crash.

### 4.23 Run Rate — timing row widoczny razem z bridge

- **Asercja UI:** gdy `timing.aheadOfPlanCount + timing.behindPlanCount > 0`, wiersz timing renderuje się pod wierszami bridge.

### 4.24 Run Rate — timing row ukryty gdy oba = 0

- Org z inicjatywami bez dat milestones.
- **Asercja UI:** wiersz timing NIE renderuje się gdy `aheadOfPlanCount = 0` i `behindPlanCount = 0`.

### 4.25 Run Rate — parallel fetch (razem z signals)

- Jak w §3.20 — weryfikacja parallel fetch.
- **Asercja — Network:** `/run-rate` i `/signals` wysłane w tej samej milisekundzie (±100ms).

### 4.26 Run Rate — brak tokenu → 401 [SEC]

- Usuń token. Wejdź na zakładkę AI+Portfolio.
- **Asercja — Network:** `/api/results-extended/all/run-rate` → **401**.

### 4.27 Run Rate — 0 miesięcy (nowa org bez historii) → bridge = null lub runRate = 0

- **Asercja — payload:** gdy org ma KPI bez żadnych pomiarów, `bridge.periodMonths = 0` → `runRate = 0`, `annualizedRunRate = 0`.
- **Asercja UI:** brak NaN ani „Infinity" w UI.

### 4.28 Run Rate — title i etykiety wierszy widoczne

- **Asercja UI:** sekcja ma tytuł „Run-rate vs in-year". Trzy wiersze z etykietami: „Run-rate annualizowany", „Prognoza do końca roku", „Reszta run-rate" (lub i18n odpowiedniki).

### 4.29 Run Rate — porównanie z M16 Finance

- Jeśli org ma spięcie z M16 (Finance), wartość `projectedFullYear` powinna być bliska forecast z M16.
- **Opcjonalny:** otwórz M16 (`/finance`) → sprawdź projekcję przychodów → porównaj z `bridge.projectedFullYear`. Rozbieżność > 20% = signal.

### 4.30 Run Rate — nawigacja cross-tab nie resetuje wartości

- Wejdź na AI+Portfolio → zapamiętaj `projectedFullYear`. Kliknij na zakładkę ROI → wróć na AI+Portfolio.
- **Asercja UI:** `projectedFullYear` ta sama wartość (re-fetch z DB, dane niezmienione).

---

## §5 — W5: BSC + OKR + DICE + Adoption + Sustainment

*Epik W5.1–W5.8 · Komponent: `StrategicLayerPanel` · API: `/api/results-strategic/all/strategic` + `/api/results-extended/all/adoption` + `/api/results-extended/all/sustainment`*

### 5.1 BSC — 4 perspektywy zawsze obecne

- Przejdź na `/benefits?tab=results_strategic&ff_strategicLayer=1`.
- **Asercja — Network payload** `GET /api/results-strategic/all/strategic` → `bsc.perspectives[]` ma dokładnie 4 elementy (Financial, Customer, Process, Learning).
- **Asercja UI:** 4 wiersze perspektyw BSC widoczne w panelu.

### 5.2 BSC — `balanced = true` gdy wszystkie 4 perspektywy mają KPI

- Org z co najmniej 1 KPI w każdej z 4 perspektyw.
- **Asercja — payload:** `bsc.balanced = true` (lub inferowany: każda perspektywa ma `totalKpis > 0`).
- **Asercja UI:** komunikat „Zrównoważony scorecard" lub zielona ikona checkmark.

### 5.3 BSC — `balanced = false` gdy perspektywa bez KPI

- Org gdzie perspektywa „Rozwój" nie ma KPI.
- **Asercja — payload:** `bsc.perspectives.find(p => p.perspective === 'learning').totalKpis = 0`.
- **Asercja UI:** komunikat lub wskazówka, że scorecard jest niezrównoważony.

### 5.4 BSC — `perspectiveHealth` = `onTarget / measured` (skala 0..1)

- **Asercja — payload:** dla perspektywy z `totalKpis = 5`, `onTarget = 3`, `noData = 1` → `health = 3 / (5 - 1) = 0.75`.
- **Asercja UI:** pasek zdrowia tej perspektywy = 75%.

### 5.5 BSC — `onTarget + below + noData = totalKpis`

- **Asercja — payload:** dla każdej perspektywy: `onTarget + below + noData = totalKpis`. Weryfikacja spójności.

### 5.6 OKR — `scoreKeyResult = (current - baseline) / (target - baseline)` ∈ [0, 1]

- **Asercja — payload** `GET /api/results-strategic/all/strategic` lub endpoint OKR (jeśli istnieje oddzielny):
  - Dla Key Result z `baseline = 0`, `current = 7`, `target = 10` → `score = 0.7`.
- **Asercja UI:** jeśli sekcja OKR renderuje się w StrategicLayerPanel — score 70% widoczny.

### 5.7 OKR — Objective `on-track` gdy average score ≥ 0.7

- **Asercja — payload:** Objective z average Key Results score ≥ 0.7 → `status = 'on-track'`.
- **Asercja UI:** label „na ścieżce" lub zielony badge przy Objective.

### 5.8 OKR — Objective `at-risk` gdy average score < 0.7

- **Asercja — payload:** Objective z average Key Results score < 0.7 → `status = 'at-risk'` lub `'behind'`.
- **Asercja UI:** badge amber lub czerwony.

### 5.9 DICE — wynik ≤ 14 → strefa „win"

- **Asercja — payload (jeśli DICE endpoint istnieje):** inicjatywa z D=2, I=2, C1=2, C2=2, E=2 → `diceScore = 10` → `zone = 'win'`.
- **Asercja UI:** jeśli sekcja DICE renderuje się w zakładce — inicjatywa wyświetla badge „Win" (zielony).

### 5.10 DICE — wynik > 17 → strefa „woe"

- **Asercja — payload:** inicjatywa z D=4, I=4, C1=4, C2=4, E=4 → `diceScore ≈ 20` → `zone = 'woe'`.
- **Asercja UI:** badge „Woe" (czerwony) lub alert.

### 5.11 Adoption — endpoint `/api/results-extended/all/adoption` hit

- Będąc na zakładce Strategic, wyczyść Network → odśwież stronę.
- **Asercja — Network:** `GET /api/results-extended/all/adoption` → 200.
- **Asercja — payload shape:** `{flags[], total, atRiskCount}`.

### 5.12 Adoption — `adoptionScore < 0.3 + declining` → `atRisk = true`

- **Asercja — payload:** inicjatywa z niską adopcją ma `flags[].atRisk = true` i `reason` zawiera „low adoption" lub „declining".

### 5.13 Adoption — sekcja flagowanych inicjatyw widoczna w UI (jeśli atRiskCount > 0)

- **Asercja UI:** jeśli `atRiskCount > 0`, StrategicLayerPanel pokazuje przynajmniej badge lub licznik „X w ryzyku adopcji".
- Sprawdź kod `StrategicLayerPanel.tsx` — adoption flags renderują się gdy `adoption.atRiskCount > 0`.

### 5.14 Sustainment — endpoint `/api/results-extended/all/sustainment` hit

- **Asercja — Network:** `GET /api/results-extended/all/sustainment` → 200.
- **Asercja — payload shape:** `{statuses[], summary: {total, sustained, atRisk, unowned}}`.

### 5.15 Sustainment — `ownershipTransferred = false` → status `unowned`

- **Asercja — payload:** inicjatywa bez przypisanego właściciela po wdrożeniu → `statuses[].status = 'unowned'`.
- **Asercja UI:** wiersz „Sustainment" (jeśli istnieje w StrategicLayerPanel) wyświetla tę inicjatywę z etykietą „Bez właściciela" (kolor szary `text-slate-500`).

### 5.16 Sustainment — `status = 'sustained'`

- **Asercja — payload:** inicjatywa z właścicielem, przeprowadzonymi przeglądami w terminie → `status = 'sustained'`.
- **Asercja UI:** kolor zielony (`text-emerald-600`).

### 5.17 Sustainment — `status = 'at-risk'`

- **Asercja — payload:** inicjatywa z właścicielem ale nadchodzącym terminem przeglądu lub niską adopcją.
- **Asercja UI:** kolor amber (`text-amber-600`).

### 5.18 Sustainment — `status = 'overdue-review'`

- **Asercja — payload:** inicjatywa gdzie `lastReview + cadenceDays < today` → `status = 'overdue-review'`.
- **Asercja UI:** kolor czerwony (`text-red-600`).

### 5.19 Sustainment — `nextReviewDate` monthly = `lastReview + 30 dni`

- **Asercja — payload:** `cadence = 'monthly'` i `lastReview = 2026-05-25` → `nextReviewDate = 2026-06-24` (±1 dzień na timezone).

### 5.20 Sustainment — summary spójny z statuses[]

- **Asercja — payload:** `summary.sustained = statuses.filter(s => s.status === 'sustained').length`.
- **Asercja — payload:** `summary.atRisk = statuses.filter(s => s.status === 'at-risk').length`.
- **Asercja — payload:** `summary.unowned = statuses.filter(s => s.status === 'unowned').length`.

### 5.21 StrategicLayerPanel — 3 równoległe fetch: strategic + adoption + sustainment

- Wyczyść Network. Wejdź na zakładkę Strategic.
- **Asercja — Network:** trzy żądania `results-strategic/strategic`, `results-extended/adoption`, `results-extended/sustainment` uruchomione **równolegle** (Promise.all w useEffect).

### 5.22 StrategicLayerPanel — loading spinner → dane

- Wejdź na zakładkę Strategic pierwszy raz (brak cache).
- **Asercja UI:** przez krótką chwilę widoczny spinner (`loading = true`). Po załadowaniu — spinner znika, dane widoczne.

### 5.23 StrategicLayerPanel — błąd sieci → graceful (brak crash)

- Symuluj błąd sieci (DevTools → Network → Offline) → wejdź na zakładkę Strategic.
- **Asercja UI:** panel nie crashuje. Wyświetla stan błędu lub pusty panel z informacją o braku danych.

### 5.24 BSC — Executive Narrative widoczna gdy `executiveSummary` niepuste

- **Asercja — Network payload:** `narrative.executiveSummary` to niepusty string.
- **Asercja UI:** sekcja „Narracja zarządcza" renderuje się w StrategicLayerPanel (poniżej BSC i BDN).

### 5.25 BSC — Executive Narrative ukryta gdy pusta

- **Asercja — Network payload:** `narrative.executiveSummary = ''` lub `null`.
- **Asercja UI:** sekcja „Narracja zarządcza" NIE renderuje się (brak pustego boxa).

### 5.26 BDN — stats renderowane (nodeCount > 0)

- **Asercja UI:** jeśli `bdn.stats.nodeCount > 0` → StrategicLayerPanel renderuje sekcję „BDN" z licznikami węzłów/krawędzi/benefitów/enablerów.

### 5.27 BSC — overallHealth widoczny w nagłówku panelu

- **Asercja UI:** StrategicLayerPanel lub sekcja BSC wyświetla `bsc.overallHealth` jako procent (np. „75% zdrowie portfela") w nagłówku lub subheaderze.

### 5.28 Sustainment — empty org

- Org bez inicjatyw z wdrożeniem.
- **Asercja — Network payload:** `{statuses: [], summary: {total: 0, sustained: 0, atRisk: 0, unowned: 0}}`.
- **Asercja UI:** sekcja Sustainment nie renderuje się (lub pusty komunikat).

### 5.29 Izolacja org — adoption i sustainment [SEC]

- Zaloguj się jako user2.
- **Asercja — Network payload** `/adoption`: `{flags: [], total: 0, atRiskCount: 0}`.
- **Asercja — Network payload** `/sustainment`: `{statuses: [], summary: {total: 0}}`.

### 5.30 BSC — dark mode renderuje poprawne kolory

- Przełącz na dark mode (system lub toggle w UI).
- **Asercja UI:** wszystkie 4 wiersze perspektyw BSC są czytelne (jasny tekst na ciemnym tle). Pasy zdrowia widoczne.
- **Asercja UI:** statusy Sustainment (`sustained` = emerald, `at-risk` = amber, `overdue-review` = red) mają odpowiedniki dla dark (np. `dark:text-emerald-400`).

---

## §6 — W6: Narracja Wartości + Scenariusze + Finance Link + Kontrafaktual

*Epik W6.1–W6.8 · Komponenty: `AIInsightsPanel` + `PortfolioInsightsPanel` · API: `/api/results-extended/all/{narrative,counterfactual,scenarios,finance-link}`*

### 6.1 AIInsightsPanel — wejście z flagą `ff_aiInsights=1`

- Przejdź na `/benefits?tab=results_ai&ff_aiInsights=1`.
- **Asercja UI:** zakładka AI+Portfolio aktywna. AIInsightsPanel renderuje sekcje: „Narracja wartości" i „Atrybucja — co bez inicjatywy?".
- **Asercja — Network:** `GET /api/results-extended/all/narrative` → 200 + `GET /api/results-extended/all/counterfactual` → 200.

### 6.2 AIInsightsPanel — brak flagi `ff_aiInsights` → sekcje niewidoczne

- Przejdź na `/benefits?tab=results_ai` (tylko z `ff_portfolioInsights=1`, bez `ff_aiInsights`).
- **Asercja UI:** sekcje AIInsightsPanel (narrative + counterfactual) nie renderują się. Widoczne sekcje PortfolioInsightsPanel.

### 6.3 Narrative — payload shape

- **Asercja — Network payload** `GET /api/results-extended/all/narrative`:
  - `narrative.headline` — niepusty string.
  - `narrative.executiveSummary` — dłuższy tekst (≥ 50 znaków).
  - `narrative.bullets[]` — tablica stringów, ≥ 1 element.
  - `executiveSummary` — string (może być taki sam jak `narrative.executiveSummary`).

### 6.4 Narrative — headline zawiera procent realizacji

- **Asercja — payload:** `narrative.headline` zawiera liczbę procentową (np. „Zrealizowano 72% wartości portfela" lub podobny format).
- Sprawdź: `headline.includes('%')` lub regex `/\d+%/.test(headline)` → true.

### 6.5 Narrative — bullets widoczne w UI

- **Asercja UI:** sekcja „Narracja wartości" renderuje listę `bullets` (min. 1 element).
- Każdy bullet to niepusty tekst (string, nie `undefined`).

### 6.6 Narrative — executiveSummary renderowany w UI

- **Asercja UI:** paragraf z `executiveSummary` widoczny w sekcji „Narracja wartości".
- Kolor tekstu odpowiedni dla dark/light mode.

### 6.7 Narrative — formatValue 1.5M → „1,5 M"

- **Asercja — payload/UI:** wartość 1 500 000 wyświetlana jako „1,5 M" (nie „1500000" ani „1.5M" bez spacji).
- Sprawdź dowolną wartość w bullets lub executiveSummary — format polskiej notacji z spacją.

### 6.8 Narrative — empty state (brak banked value)

- Org bez żadnych zrealizowanych wartości.
- **Asercja — Network payload:** `{narrative: {headline: '...', bullets: [], executiveSummary: '...', pctOfTarget: 0}}`.
- **Asercja UI:** sekcja narrative renderuje się z tekstem „0% realizacji" lub podobnym — bez crash.

### 6.9 Counterfactual — payload shape

- **Asercja — Network payload** `GET /api/results-extended/all/counterfactual`:
  - `totalRealized` — liczba ≥ 0.
  - `counterfactualProjected` — liczba ≥ 0.
  - `attributableDelta = totalRealized - counterfactualProjected`.
  - `confidenceLabel` — jeden z: `'high'`, `'medium'`, `'low'`.

### 6.10 Counterfactual — `attributableDelta ≈ 0` przy płaskim trendzie i obserwacja = projekcja

- **Asercja — payload:** gdy `totalRealized ≈ counterfactualProjected` → `attributableDelta ≈ 0`.

### 6.11 Counterfactual — `confidenceLabel = 'high'` przy ≥ 5 czystych punktach danych

- Org z KPI posiadającymi ≥ 5 pomiarów bez anomalii.
- **Asercja — payload:** `confidenceLabel = 'high'`.
- **Asercja UI:** badge „pewność: high" lub „wysoka" widoczny w sekcji counterfactual.

### 6.12 Counterfactual — `confidenceLabel = 'low'` przy < 3 pomiarach

- KPI z < 3 pomiarami.
- **Asercja — payload:** `confidenceLabel = 'low'`.

### 6.13 Counterfactual — badge z kolorem pewności

- **Asercja UI:** sekcja „Atrybucja" pokazuje badge z `confidenceLabel` (np. „pewność: wysoka" w kolorze emerald, „niska" w amber/red).

### 6.14 Counterfactual — totalRealized i counterfactualProjected sformatowane

- **Asercja UI:** obie wartości wyświetlane jako PLN (z separatorem tysięcy lub skrótem M/k).

### 6.15 Counterfactual — sekcja z placeholder gdy < 2 punkty danych

- **Asercja — payload:** `confidenceLabel = null` lub `attributableDelta = null` gdy za mało danych.
- **Asercja UI:** sekcja wyświetla komunikat „Za mało pomiarów do obliczenia atrybucji" lub analogiczny.

### 6.16 Scenarios — endpoint hit i payload shape

- **Asercja — Network payload** `GET /api/results-extended/all/scenarios`:
  - `scenarios[]` — min. 3 elementy (optymistyczny, bazowy, pesymistyczny).
  - `irr` — liczba lub `null`.
  - `paybackPeriod` — liczba (lata) lub `null`.
  - `initiativeCount` — liczba całkowita ≥ 0.

### 6.17 Scenarios — 3 warianty: optymistyczny, bazowy, pesymistyczny

- **Asercja — payload:** `scenarios[].name` = „Optymistyczny" / „Bazowy" / „Pesymistyczny" (lub EN: Optimistic / Base / Pessimistic).
- **Asercja — payload:** wartości `scenarios[].npv` rosną od pesymistycznego do optymistycznego.

### 6.18 Scenarios — `npv(0, flows) = suma przepływów`

- Dla scenariusza bazowego z `discountRate = 0`: `npv = suma przepływów gotówkowych`.
- **Asercja — matematyka payload:** porównaj sumę `cashFlows[]` z `npv` dla scenariusza z `rate = 0`. Różnica ≤ 1%.

### 6.19 Scenarios — `irr = null` gdy brak zmiany znaku przepływów

- Org z wyłącznie pozytywnymi przepływami (bez inwestycji początkowej negatywnej).
- **Asercja — payload:** `irr = null`.

### 6.20 Scenarios — tabela scenariuszy w UI

- **Asercja UI:** sekcja „Scenariusze + IRR" renderuje tabelę z kolumnami: Scenariusz, NPV (i opcjonalnie IRR / Payback).
- Wiersze tabeli odpowiadają `scenarios[]` z payloadu.

### 6.21 Scenarios — IRR widoczne gdy `irr != null`

- Org z ujemnym przepływem w t=0 i pozytywnymi w późniejszych latach → IRR obliczone.
- **Asercja UI:** pod tabelą: „IRR bazowy: X%" oraz opcjonalnie „Payback: Y lat".

### 6.22 Scenarios — `initiativeCount` w headerze

- **Asercja UI:** header sekcji Scenarios zawiera `(N inicjatyw)` obok tytułu.
- Wartość odpowiada `scenarios.initiativeCount` z payloadu.

### 6.23 Finance Link — endpoint hit i payload shape

- **Asercja — Network payload** `GET /api/results-extended/all/finance-link`:
  - `mappingCount` — liczba całkowita ≥ 0.
  - `aggregate.totalPositiveImpact` — liczba ≥ 0.
  - `aggregate.totalNegativeImpact` — liczba ≥ 0.
  - `aggregate.netImpact = totalPositiveImpact - totalNegativeImpact`.

### 6.24 Finance Link — `mappingCount = 0` → komunikat „Brak mapowań KPI → Finanse"

- Org bez mapowań KPI do linii finansowych.
- **Asercja — payload:** `mappingCount = 0`.
- **Asercja UI:** sekcja „Spięcie z Finansami" wyświetla „Brak mapowań KPI → Finanse" lub analogiczny tekst.

### 6.25 Finance Link — `netImpact = totalPositiveImpact - totalNegativeImpact`

- **Asercja — matematyka payload:** `aggregate.netImpact ≈ aggregate.totalPositiveImpact - aggregate.totalNegativeImpact`. Różnica ≤ 1%.

### 6.26 Finance Link — pozytywny wpływ (emerald), negatywny (red), netto (primary/blue)

- **Asercja UI:** w sekcji „Spięcie z Finansami":
  - „Pozytywny wpływ" = kolor emerald (`text-emerald-600 dark:text-emerald-400`).
  - „Negatywny wpływ" = kolor red.
  - „Wpływ netto" = kolor primary (blue) pogrubiony.

### 6.27 Finance Link — izolacja org (brak danych innej org) [SEC]

- user2 bez mapowań KPI-Finanse.
- **Asercja — payload:** `{mappingCount: 0, aggregate: {totalPositiveImpact: 0, ...}}`.

### 6.28 Finance Link + M16 Finanse — spójność wpływu P&L

- Sprawdź `aggregate.netImpact` w Finance Link.
- Otwórz M16 (`/finance`) → zakładka Statements → P&L.
- **Asercja — spójność:** różnica między `netImpact` M15 a wartością z P&L M16 ≤ 20% (dopuszczalna rozbieżność metodologiczna) lub identyczna.

### 6.29 AIInsightsPanel — placeholder Forecast Note widoczny

- **Asercja UI:** w AIInsightsPanel widoczna sekcja z komunikatem: „Prognoza trajektorii KPI (6.1 — AI premium)" + tekst wyjaśniający wymagania (min. 6 pomiarów, AI premium).
- Ta sekcja ma border `border-dashed` (placeholder, nie produkcja).

### 6.30 Cross-panel: W6 + W3 + W4 razem w jednym widoku

- Przejdź na `/benefits?tab=results_ai&ff_aiInsights=1&ff_portfolioInsights=1`.
- **Asercja UI:** zakładka AI+Portfolio renderuje kompletny widok z sekcjami:
  1. Narracja wartości (AIInsightsPanel)
  2. Atrybucja (AIInsightsPanel)
  3. Sygnały do M14 (PortfolioInsightsPanel)
  4. Run-rate vs in-year (PortfolioInsightsPanel)
  5. Rekomendowane przesunięcia (PortfolioInsightsPanel)
  6. Scenariusze + IRR (PortfolioInsightsPanel)
  7. Spięcie z Finansami (PortfolioInsightsPanel)
  8. Placeholder prognoza AI (AIInsightsPanel)
- **Asercja — Console:** zero błędów po pełnym załadowaniu wszystkich sekcji.
- **Asercja — Network:** 7 żądań GET zakończonych statusem 200 (narrative, counterfactual, signals, run-rate, reallocation, scenarios, finance-link).

---

## Appendix — Quick Reference: flagi do aktywacji

| Funkcjonalność | URL params potrzebne |
|---|---|
| W1 — Benefit Profiles (BSC) | `/benefits?tab=results_strategic&ff_strategicLayer=1` |
| W2 — Driver Tree | `/benefits?tab=results_strategic&ff_strategicLayer=1&ff_valueTree=1` |
| W3 — Signals + Reallocation | `/benefits?tab=results_ai&ff_portfolioInsights=1` |
| W4 — Run Rate | `/benefits?tab=results_ai&ff_portfolioInsights=1` |
| W5 — BSC + OKR + Adoption + Sustainment | `/benefits?tab=results_strategic&ff_strategicLayer=1` |
| W6 — Narrative + Counterfactual | `/benefits?tab=results_ai&ff_aiInsights=1` |
| W6 — Scenarios + Finance | `/benefits?tab=results_ai&ff_portfolioInsights=1` |
| Wszystko naraz | `/benefits?tab=results_ai&ff_aiInsights=1&ff_portfolioInsights=1` |
| Strategic full | `/benefits?tab=results_strategic&ff_strategicLayer=1&ff_valueTree=1` |

### Alternatywna aktywacja przez localStorage (trwała między sesjami)

```javascript
// Wklej do konsoli DevTools:
localStorage.setItem('ff.results_strategic_layer', '1');
localStorage.setItem('ff.results_value_tree', '1');
localStorage.setItem('ff.results_ai_insights', '1');
localStorage.setItem('ff.results_portfolio_insights', '1');
location.reload();
```

---

## Appendix — Wymagania setup testowego

| Wymaganie | Minimalna wartość | Jak sprawdzić |
|---|---|---|
| KPI w org | ≥ 5 | M15 → zakładka KPI → Katalog |
| KPI z pomiarami | ≥ 3 (przynajmniej 1 z ≥ 3 pomiarami) | M15 → KPI → Time-series drawer |
| Inicjatywy EXECUTING | ≥ 3 | M13 → lista inicjatyw |
| KPI z niską realizacją (< 60%) | ≥ 1 | M15 → KPI Queue → „Needs attention" |
| KPI z wysoką realizacją (≥ 80%) | ≥ 1 | M15 → KPI → status |
| Inicjatywa z `realizationPct < 50%` i `confidence ≤ 0.5` | ≥ 1 | `/api/results-extended/all/reallocation` payload |
| KPI w każdej z 4 perspektyw BSC | ≥ 1 per perspektywa | M15 → Strategic → BSC |

---

*Dokument wygenerowany: 2026-06-25. Pokrywa epiki W1–W6 z `Harvard/wdrozenie-100/M15-STAN-PRACY-ODBIORY.md`. Jednostkowe testy automatyczne (370 ✅): `tests/unit/results/`. Plan testowania: `Harvard/wdrozenie-100/M15-PLAN-TESTOWANIA.md`.*
