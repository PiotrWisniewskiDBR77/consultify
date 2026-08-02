---
doc_id: FIN-006
truth_type: operations
status: BLOCKED
owner: codex
product_owner: piotr
priority: P0
depends_on: FIN-005
last_reviewed: 2026-08-01
---

# FIN-006 — waluta między modułami i bramka value engine

Produkt: Consultify. Target odbioru: Railway project `consultify`, environment
`demo`, `https://demo.consultify.ai`, PostgreSQL `demo`. Localhost nie jest
evidence odbiorowym.

Ten pakiet zbiera **dwa blokery, których przyczyna leży poza granicą własności
FIN-005**, a które ujawniły się dopiero po ustandaryzowaniu Finance na EUR:

- **A. Sprzeczność PLN/EUR między modułami** — Finance mówi EUR, Initiatives i
  Execution mówią PLN o tym samym programie.
- **B. Bramka demo blokuje silnik wartości** — `demoWriteProtection` klasyfikuje
  czyste obliczenie jako zapis.

Oba są tu razem, bo oba są spadkiem po FIN-005 i oba wymagają decyzji spoza
Finance. Naprawy są niezależne i **nie wolno ich scalać w jeden commit** —
sekcje A i B mają rozłączne pliki i rozłączne bramki odbioru.

Wszystkie odwołania `plik:linia` poniżej zostały odczytane z kodu na gałęzi
`fix/fin-005-atelier-coherence`, nie przepisane z wcześniejszych notatek.

---

## A. Sprzeczność PLN/EUR między modułami

### A.1 Problem

Atelier Toys to producent z Lyonu raportujący w euro. Po FIN-005 warstwa Finance
konsekwentnie pokazuje EUR. Initiatives i Execution renderują **zaszyte w kodzie
`PLN`** dla tych samych inicjatyw tego samego programu. Klient prowadzony przez
run-sheet zobaczy ten sam budżet raz w euro, raz w złotych — bez żadnego
przewalutowania, bo to jest wyłącznie etykieta.

To nie jest kosmetyka. Karta inicjatywy `Atelier Line 3 Digital Twin` pokazuje
`540,000 PLN`, a model ROI zbudowany na tej samej inicjatywie liczy w EUR.
Klient nie ma jak ustalić, którą liczbę czyta.

### A.2 Dowód — strona danych

| Fakt | Evidence |
| --- | --- |
| Atelier to firma euro | `server/src/services/demo/demoSeedService.ts:1870-1871` — `profile.annualRevenue = '~€280M (demo anchor year)'`, `profile.currency = 'EUR'`; `:1866` → `profile.location = 'Lyon, France'` |
| KPI są w euro | `server/src/services/demo/atelierToysDemoTemplate.ts:2920-2926` — KPI `Digital ARR`, `unit: '€M'`, baseline 6.2 → target 8 |
| Narracja jest w euro | `server/src/services/demo/atelierToysDemoTemplate.ts:2733`, `:2861` — „Digital ARR is ~€6.2M against an €8M target” |
| Finance jest w euro (FIN-005) | `server/src/services/demo/atelierFinanceSeed.ts:77` — `export const ATELIER_FINANCE_CURRENCY = 'EUR'`; uzasadnienie w `demoSeedService.ts:3403-3406` |
| Seed inicjatyw zapisuje kwotę **bez** waluty | `server/src/services/demo/demoSeedService.ts:2262-2265` — do `INSERT INTO initiatives` trafia tylko `estimated_budget` (= `budgetCapex + budgetOpex`). Kolumna `budget_currency` nie jest w `cols` ani razu w całym seedzie (`grep -c budget_currency server/src/services/demo/*.ts` → 0) |
| …więc baza nadaje jej PLN | `server/migrations/564_execution_delay_budget_t041_t042.sql:139` — `ALTER TABLE initiatives ADD COLUMN budget_currency TEXT DEFAULT 'PLN'`; potwierdzone w baseline `server/migrations/20260719_baseline_gap.sql:12436` |
| Kwoty są w skali euro | `server/src/services/demo/atelierToysDemoTemplate.ts:512-513` — `budgetCapex: 420000`, `budgetOpex: 120000` dla `Line 3 Digital Twin` |

**Uściślenie względem wcześniejszej notatki (§7.1 handoffu FIN-005):** inicjatywy
nie mają „braku `budget_currency`”. Mają **utrwalone `PLN`** nadane defaultem
kolumny. To zmienia naprawę: samo ustawienie waluty w seedzie nie wystarczy dla
rekordów już zasianych na demo — potrzebny jest `UPDATE` istniejących wierszy
albo ponowne zasianie.

### A.3 Dowód — strona UI

| Powierzchnia | Evidence | Czy żywa na demo |
| --- | --- | --- |
| Karta inicjatywy, kafel „Budżet” | `src/components/Initiatives/InitiativeCompactPanel.tsx:901` — `` `${init.estimatedBudget.toLocaleString()} PLN` `` | **TAK** — siatka bez żadnego warunku (`:876-903`) |
| Ten sam panel, kafle „Budżet”/„Wydano” | `src/components/Initiatives/InitiativeCompactPanel.tsx:1335`, `:1341` | **NIE** — gałąź `!hasGovernedBudgetPanel`, a `hasGovernedBudgetPanel = Boolean(init?.id)` (`:1325`) jest prawdą dla każdej realnej inicjatywy. Kod martwy dla danych z seeda; zostawiam w rejestrze, bo ożyje przy inicjatywie bez `id` |
| Execution → Summary One-Look | `src/components/Execution/ExecutionHub.tsx:5496` — `currency="PLN"` przekazane jako literał | **TAK** |
| …i jego domyślna wartość | `src/components/Execution/ExecutionSummaryOneLook.tsx:211` — `currency = 'PLN'` | **TAK** (drugi, niezależny domyślny PLN) |
| Zasoby/budżet inicjatywy | `src/components/Initiatives/sections/ResourcesSection.tsx:300-301`, `:1821`, `:1831`, `:2765`, `:2805`, `:2813` — normalizacja nieznanej waluty **do PLN**, domyślne `PLN` w formularzach, `fmtCurrency(totalCost, 'PLN', …)` zaszyte na twardo | **TAK** dla domyślnych; kwoty wpisane ręcznie noszą własną walutę |
| Prompt AI dla zasobów | `src/components/Initiatives/sections/ResourcesSection.tsx:519` — „prefer the existing table currency if present; **otherwise PLN**” | **TAK** — model dostaje instrukcję zgadywania PLN |

Backend Execution czyta walutę poprawnie, ale ma ten sam fallback:
`server/src/services/executionBudgetService.ts:217` (`planned[0]?.currency || initRow[0]?.budget_currency || 'PLN'`),
`:351` (`initRows[0]?.budget_currency || 'PLN'`), `:115` (`data.currency || 'PLN'`
przy zapisie pozycji budżetowej). Przy `budget_currency = 'PLN'` w bazie serwis
**zwraca PLN zgodnie z danymi** — wina jest po stronie danych, nie tego serwisu.
Fallbacki są jednak trzecią linią, w której `PLN` jest wpisane jako prawda o
produkcie, a nie o organizacji.

### A.4 Zasięg rażenia w przejściu run-sheet

Kolejność odbioru z `MVP_GOLDEN_FLOW_MASTER_MAP.md` to
`Materials → Finance → Results/KPI → Execution → Initiatives → …`. Sprzeczność
uderza dokładnie na styku kroków 2–5, czyli w środku pokazu:

1. **Finance → Models** (`GF-FIN-01`) — `Atelier Toys — Transformation 2015 ROI`,
   NPV/ROI w **EUR**. Punkt odniesienia klienta.
2. **Results/KPI** (`GF-RES-01`) — `Digital ARR`, jednostka **€M**. Zgodne z
   Finance.
3. **Execution → Summary One-Look** (`GF-EXE-01`) — wartość portfela w **PLN**
   (`ExecutionHub.tsx:5496`). Pierwsza sprzeczność, jedno kliknięcie po Finance.
4. **Execution / Roadmap → panel boczny inicjatywy** — `InitiativeCompactPanel`
   montowany z `ExecutionHub.tsx:5860` i `RoadmapKanban.tsx:316`; kafel „Budżet”
   pokazuje **`540 000 PLN`** dla inicjatywy, której model ROI właśnie liczył w
   euro.
5. **Initiatives → karta / Zasoby** (`GF-INI-01`) — pozycje budżetowe i sumy
   domyślnie **PLN**, a asystent AI dopisze kolejne pozycje w PLN
   (`ResourcesSection.tsx:519`).

Efekt: „golden thread” `Initiative → Execution → Results/KPI → Finance` — którego
integralność `MVP_GOLDEN_FLOW_MASTER_MAP.md` czyni warunkiem `GO` — pokazuje ten
sam program w dwóch walutach. Dla klienta to nie jest literówka, tylko sygnał, że
liczby nie pochodzą z jednego rejestru.

### A.5 Opcje

| # | Opcja | Co robi | Za | Przeciw |
| --- | --- | --- | --- | --- |
| **O1** | Seed ustawia `budget_currency = 'EUR'` dla Atelier + `UPDATE` istniejących wierszy na demo | jedno źródło prawdy w danych; `executionBudgetService` zaczyna zwracać EUR bez zmiany kodu | najmniejsza zmiana kodu; naprawia backend „za darmo”; addytywne, idempotentne | **nie naprawia żadnego zaszytego `PLN` w UI** — kafel `InitiativeCompactPanel.tsx:901` i `ExecutionHub.tsx:5496` nie czytają waluty w ogóle; wymaga migracji danych na demo |
| **O2** | UI czyta walutę z rekordu (`initiative.budgetCurrency`), fallback z ustawień organizacji | usuwa literały z warstwy prezentacji | poprawne docelowo; działa dla każdego tenanta, nie tylko Atelier | dotyka ≥6 plików w Initiatives/Execution — moduły jawnie poza granicą FIN-005; bez O1 czyta `PLN` z bazy i nic nie zmienia |
| **O3** | Globalna domyślna waluta organizacji (`organization_settings.finance`) jako jedyne źródło fallbacku | zamyka też dług §7.2 handoffu FIN-005 (`valuationService.ts:207`) | jedno miejsce zamiast trzynastu fallbacków `\|\| 'PLN'` | największy zasięg; dotyka orkiestracji demo i wszystkich tenantów; nie do zrobienia przed pokazem |
| **O4** | Cofnąć Finance do PLN | usuwa sprzeczność w drugą stronę | jedna stała (`ATELIER_FINANCE_CURRENCY`) | sprzeczność wraca gdzie indziej: KPI `€M`, narracja `€6.2M`, profil `EUR`, `~€280M` przychodu. Francuski producent raportujący w złotych to dokładnie ta niespójność, którą FIN-005 miał usunąć. **Odrzucone** |
| **O5** | Nic nie robić przed pokazem | — | zero ryzyka regresji | klient widzi dwie waluty na jednym programie. **Odrzucone** |

### A.6 Rekomendacja

**O1 + O2, w tej kolejności, jako jeden pakiet FIN-006/A. O3 osobno, po pokazie.**

1. **O1 — dane (właściciel: agent demo/seed).**
   - `demoSeedService.ts` dopisuje `budget_currency` do `cols`/`vals` inicjatyw,
     z wartością wziętą z `ATELIER_FINANCE_CURRENCY`, żeby Finance i Initiatives
     miały **jedną** stałą, a nie dwie.
   - Migracja/skrypt danych ustawia `budget_currency = 'EUR'` dla inicjatyw
     tenanta demo. Bez tego rekordy zasiane wcześniej zostają na PLN z defaultu
     kolumny — patrz A.2, to jest różnica względem pierwotnej diagnozy.
   - Read-back: `SELECT id, name, estimated_budget, budget_currency FROM initiatives WHERE organization_id = '<DEMO_ORG_ID>'`
     — zero wierszy z `budget_currency <> 'EUR'`.

2. **O2 — UI (właściciel: agent Initiatives/Execution).**
   - `InitiativeCompactPanel.tsx:901` czyta `init.budgetCurrency`; fallback do
     stałej domyślnej, nigdy do literału w szablonie.
   - `ExecutionHub.tsx:5496` przestaje przekazywać `currency="PLN"` i podaje
     walutę z podsumowania budżetu (`executionBudgetService` już ją zwraca w polu
     `currency` — `executionBudgetService.ts:260`, `:351`).
   - `ResourcesSection.tsx:300-301` przestaje normalizować nieznaną walutę **do
     PLN**; nieznana waluta to błąd danych, nie złotówka.
   - Prompt `ResourcesSection.tsx:519` przestaje sugerować modelowi PLN.
   - `InitiativeCompactPanel.tsx:1335/1341` — kod martwy; naprawić razem albo
     usunąć, ale nie zostawiać jako trzecie miejsce z `PLN`.

3. **Bramka odbioru A:** przejście run-sheet krok po kroku (Finance → Results →
   Execution → Initiatives) na `demo.consultify.ai`, zrzuty każdego z pięciu
   ekranów z A.4, zero `PLN` na programie Atelier. Zgodnie z regułą UI #7
   zrzuty robi agent, nie Piotr.

### A.7 Czego ten pakiet świadomie NIE obejmuje

- Przewalutowania kwot. `420 000` zostaje `420 000` — zmienia się wyłącznie
  etykieta. Jeśli budżety miały być złotówkami, jest to decyzja produktowa dla
  Piotra i wymaga osobnego przeliczenia całej narracji.
- Innych tenantów. `seed-elkomtech-*.ts` jawnie zapisuje `budget_currency: 'PLN'`
  (`server/scripts/seed-elkomtech-upgrade-100.ts:272`) i tak ma zostać — to
  polski klient.
- Domyślnej waluty organizacji (`valuationService.ts:207`) — to O3.

---

## B. Bramka demo blokuje silnik wartości (propozycja allowlisty)

### B.1 Problem

`ValueOfficePanel` renderuje „Value engine temporarily unavailable”, ilekroć
demo jest włączone. Silnik jest zdrowy; odrzuca go bramka read-only.

- Panel woła `POST /api/v8/finance/value/value-bridge`
  (`src/components/Economics/panels/ValueOfficePanel.tsx:98`) i
  `POST /api/v8/finance/value/portfolio/prioritize` (`:112`).
- `demoWriteProtection` klasyfikuje żądanie jako zapis **wyłącznie po metodzie
  HTTP** (`server/src/middleware/demoGuard.middleware.ts:242` — `const isWrite = !['GET','HEAD','OPTIONS'].includes(method)`).
- Gateway montuje ją z allowlistą `['/api/demo/', '/api/auth/']`
  (`server/src/Gateway.ts:423-429`).
- Obie trasy są czystym obliczeniem. Sześć serwisów, które obsługują ten router
  (`valueBridgeService`, `portfolioPrioritizationService`,
  `capitalRationingService`, `investmentAppraisalService`,
  `budgetVarianceService`, `valueAssuranceService`), ma **zero instrukcji
  `import`** — nie mają czym dotknąć bazy. Weryfikacja jednym poleceniem:
  `for f in valueBridgeService portfolioPrioritizationService capitalRationingService investmentAppraisalService budgetVarianceService valueAssuranceService; do grep -c '^import' server/src/services/$f.ts; done` → sześć zer.

### B.2 Propozycja

Moduł `server/src/routes/v8/financeValueDemoAllowlist.ts` (nowy, **nieużywany
przez Gateway**) deklaruje audyt wszystkich sześciu tras routera i wyprowadza z
niego minimalną allowlistę. Nic w kodzie produkcyjnym go jeszcze nie importuje —
to propozycja do przeglądu bezpieczeństwa, nie zmiana zachowania.

| Trasa | Serwis | Dotyka bazy | Caller produkcyjny | Proponowane zwolnienie |
| --- | --- | --- | --- | --- |
| `POST /api/v8/finance/value/value-bridge` | `valueBridgeService.buildValueBridge` | nie | `ValueOfficePanel.tsx:98` | **tak** |
| `POST /api/v8/finance/value/portfolio/prioritize` | `portfolioPrioritizationService.prioritize` | nie | `ValueOfficePanel.tsx:112` | **tak** |
| `POST /api/v8/finance/value/appraise` | `investmentAppraisalService.appraise` | nie | `InvestmentAppraisalPanel.tsx:51` | **tak** |
| `POST /api/v8/finance/value/variance-bridge` | `budgetVarianceService.varianceBridge` | nie | `VarianceBridgePanel.tsx:45` | **tak** |
| `POST /api/v8/finance/value/capital/ration` | `capitalRationingService.knapsack` | nie | brak | nie |
| `POST /api/v8/finance/value/value-assurance` | `valueAssuranceService.assuranceSummary` | nie | brak | nie |

Dwa świadome zawężenia:

- **Tylko kanoniczny mount.** `financeValueRoutes` jest montowany dwa razy:
  `/finance/value` (`server/src/routes/v8/index.ts:80`) i alias `/finance-value`
  (`:85`). Allowlista obejmuje wyłącznie pierwszy — alias nie ma ani jednego
  callera w `src/`.
- **Tylko trasy z callerem.** `capital/ration` i `value-assurance` są równie
  wolne od bazy, ale nikt ich nie woła. Zwolnienie ma być uzasadnione ścieżką,
  którą klient faktycznie przechodzi.

### B.3 Dokładny diff dla `Gateway.ts`

Wariant rekomendowany — **dopasowanie dokładne**, bez dotykania
`demoGuard.middleware.ts`. `demoWriteProtection` porównuje allowlistę przez
`startsWith` (`demoGuard.middleware.ts:249`), więc podanie jej ścieżek wprost
działa, ale zwalniałoby też przyszłe rodzeństwo w rodzaju
`/api/v8/finance/value/appraise-and-save`. Poniższa opakowanie zamyka tę klasę
wypadków na stałe i mieści się w jednym hunku:

```diff
--- a/server/src/Gateway.ts
+++ b/server/src/Gateway.ts
@@
 import { demoContextMiddleware, demoWriteProtection } from './middleware/demoGuard.middleware.js';
+import { isStatelessComputeDemoRoute } from './routes/v8/financeValueDemoAllowlist.js';
@@
       // Demo Mode middleware - switches context and protects against writes.
       // Mount immediately after logging so all gateway routes share the same boundary.
       app.use(demoContextMiddleware);
-      app.use(
-        demoWriteProtection({
-          // Demo onboarding/status endpoints must remain writable/readable enough
-          // to enter and leave demo mode; auth routes handle login/logout.
-          allowedRoutes: ['/api/demo/', '/api/auth/'],
-        })
-      );
+      const demoWriteGuard = demoWriteProtection({
+        // Demo onboarding/status endpoints must remain writable/readable enough
+        // to enter and leave demo mode; auth routes handle login/logout.
+        allowedRoutes: ['/api/demo/', '/api/auth/'],
+      });
+      // FIN-006/B: the V8 Finance value layer is stateless compute exposed over
+      // POST because its input is a JSON body, not because it persists anything.
+      // Exempting it by EXACT path + method keeps the guard's prefix semantics
+      // from ever covering a future sibling route. Audit and rationale:
+      // routes/v8/financeValueDemoAllowlist.ts.
+      app.use((req, res, next) => {
+        const pathname = String(req.originalUrl || req.url || '')
+          .split('?')[0]
+          .split('#')[0];
+        if (isStatelessComputeDemoRoute(req.method, pathname)) return next();
+        return demoWriteGuard(req, res, next);
+      });
```

Wariant minimalny (jedna linia, semantyka prefiksowa — akceptowalny, ale słabszy):

```diff
-          allowedRoutes: ['/api/demo/', '/api/auth/'],
+          allowedRoutes: ['/api/demo/', '/api/auth/', ...STATELESS_COMPUTE_DEMO_ALLOWLIST],
```

### B.4 Dowód wykonywalny

`server/src/routes/v8/__tests__/financeValueRoutes.demoGuard.test.ts` — **22
testy, wszystkie PASS**. Montuje **prawdziwy** `demoWriteProtection`, prawdziwy
router wartości oraz prawdziwe routery zapisujące (`financeRoutes`,
`financeStatementsRoutes`) w kolejności z Gateway, i dowodzi obu połówek:

- cztery proponowane trasy zwracają **200 z realnym wynikiem** w trybie demo
  (m.in. `appraise` → `npv > 0`, `verdict = 'go'`; `variance-bridge` → krok
  startowy waterfalla = 8 200 000);
- `POST /api/v8/finance/models`, `POST /api/v8/finance/analyses`,
  `POST /api/v8/finance/models/:id/compute` i `POST /api/finance-statements/upload`
  pod **tą samą** allowlistą nadal dostają `403 DEMO_READ_ONLY`;
- `capital/ration`, `value-assurance` i alias `/api/v8/finance-value/*` nadal 403;
- predykat odrzuca ścieżki dzielące tylko prefiks oraz każdą metodę poza POST.

Sprawdzone osobno, że te cztery ścieżki zapisujące to realne trasy, a nie
literówki: przy celowo zbyt szerokiej allowliście `['/api/']` zwracają 500/401
(handler + brak bazy w środowisku testowym), nigdy 404.

### B.5 Bramka odbioru B

`ACCEPT` wymaga: przeglądu bezpieczeństwa allowlisty, zastosowania diffu z B.3,
deployu na `demo` i wzrokowego potwierdzenia, że Value Office liczy, a próba
zapisu w Finance nadal zwraca „Demo mode is read-only”.

---

## Rejestr decyzji do podjęcia

| # | Decyzja | Kto |
| --- | --- | --- |
| D-1 | Budżety inicjatyw Atelier to euro (etykieta się zmienia, kwoty nie) | Piotr |
| D-2 | Czy O1+O2 wchodzi przed pokazem, czy pokaz idzie z jedną walutą mniej | Piotr |
| D-3 | Zwolnienie czterech tras compute z bramki demo — przegląd bezpieczeństwa | Codex |
| D-4 | Czy `capital/ration` i `value-assurance` mają dostać callerów, czy zostają zablokowane | Codex |
