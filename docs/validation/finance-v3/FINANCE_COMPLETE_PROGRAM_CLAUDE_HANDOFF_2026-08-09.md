# Finance Complete Program — Claude Execution Handoff

Data: 2026-08-09  
Właściciel produktu: Piotr Wiśniewski  
Baseline audytu: `9c23e3d80e`  
Status początkowy: `NO-GO / EVIDENCE_MISSING`  
Cel: kompletny profesjonalny system analityki finansowej, doprowadzony do końcowego odbioru na realnych danych, realnej bazie i dokładnym candidate SHA.

## Dokumenty kanoniczne pakietu

Claude ma przeczytać w całości, w podanej kolejności:

1. `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` — nadrzędny kontrakt celu, wykonania i odbioru;
2. `docs/validation/finance-v3/OWNER_REVIEW_REGISTER_2026-08-09.md` — rejestr uwag i decyzji właściciela;
3. `docs/validation/finance-v3/FINANCE_COMPLETION_RECOMMENDATIONS_2026-08-09.md` — scalone rekomendacje domenowe, techniczne i UX;
4. `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md` — krytyka adwersaryjna i wiążące rozstrzygnięcia;
5. `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md` — szczegółowe pakiety implementacyjne, zależności i bramki.

W przypadku rozbieżności obowiązuje kolejność: decyzje właścicielskie zapisane w niniejszym programie → krytyczny addendum → master plan → rekomendacje → rejestr surowych uwag. Dokumentacja historyczna i obecny kod są dowodem stanu wyjściowego, a nie automatycznie kanonem docelowym.

## 0. Instrukcja dla Claude’a

To nie jest prośba o prototyp, dokumentację koncepcyjną ani wizualny redesign. Twoim zadaniem jest doprowadzenie istniejącego modułu Finance do docelowego, profesjonalnego stanu opisanego poniżej, pakietami i bramkami, z zachowaniem kompatybilności oraz dowodów.

Nie deklaruj zakończenia na podstawie:

- napisania kodu,
- zielonych mocków/unit tests,
- typechecku lub buildu,
- wyglądu pojedynczego ekranu,
- statusów Ready/Approved widocznych w UI,
- samej migracji lub deploymentu,
- self-attestation wykonawcy.

Zakończenie oznacza przejście `FINAL CHECK` opisanego w sekcji 18.

### Obowiązkowy sposób pracy

1. Najpierw ustal aktualny SHA, branch, worktree, aktywną bazę, procesy runtime i dirty state.
2. Nie używaj `reset --hard`, broad clean, stash ani `git add -A`.
3. Przed każdym pakietem ustal ownera i allowlistę plików. Zabezpiecz checksumy plików współdzielonych.
4. Nie uruchamiaj zapisu do produkcyjnej bazy. Lokalny runtime ma fail-closed guard i least-privileged DB role.
5. Każdy pakiet kończ wewnętrznym dowodem, nie opisem. Ewentualne `READY_FOR_CODEX_REVIEW` jest wyłącznie checkpointem w evidence ledger; nie jest częściowym handoffem ani akceptacją. Na zewnątrz oddajesz dopiero kompletny `READY_FOR_CODEX_FINAL_REVIEW`.
6. Zachowuj dosłownie statusy `UNKNOWN`, `PARTIAL`, `BLOCKED`, `EVIDENCE_MISSING`.
7. Każdą zmianę schematu realizuj addytywnie i sprawdzaj na disposable real Postgres przed staging.
8. Nie łam legacy API. Nowy canonical contract jest wdrażany przez adaptery, shadow parity i per-module cutover.
9. Jeżeli standard rynkowy jest jednoznaczny, stosuj najwyższy profesjonalny standard i dokumentuj decyzję. Eskaluj właścicielowi tylko decyzje strategiczne, prawne, reputacyjne, kosztowe, dotyczące apetytu na ryzyko lub istotnego rozszerzenia zakresu.

## 1. Docelowy rezultat biznesowy

Finance ma umożliwiać pełny cykl:

1. import, normalizację i zatwierdzenie historycznych sprawozdań;
2. profesjonalną analizę historyczną i benchmarking;
3. budowę neutralnego modelu bazowego bez decyzji zarządczych;
4. budowę scenariuszy wskaźnikowych i fundamentalnych;
5. wycenę przedsiębiorstwa wieloma metodami i wariantami;
6. analizę sensitivity, porównanie wariantów oraz wsparcie Valuation Advisora;
7. review, maker–checker, approval, wersjonowanie, eksport i rozmowę z TRS-em;
8. pełne wyjaśnienie, skąd pochodzi każda liczba i co powstało na jej podstawie.

Docelowy lineage jest kontrolowanym DAG:

`Statement Pack Version → Historical Analysis Version → Baseline Model Version → Scenario Version (optional) → Valuation Version`

Valuation może powstać bezpośrednio z Baseline Model lub ze Scenario. Raporty i eksporty mogą agregować wiele jawnie wskazanych wersji.

## 2. Nieprzekraczalne decyzje właścicielskie

1. Budujemy pełny system ekspercki; etapowanie nie redukuje finalnego zakresu.
2. Governance zależy od ryzyka i materialności. Material/high-risk wymaga maker–checker; autor nie zatwierdza własnej wersji.
3. Baseline Model nie stosuje cash/debt plug, nie uruchamia finansowania ani nie alokuje nadwyżek. Cash jest wynikiem. Ujemny cash = czerwony alarm/funding gap. Finansowanie i alokacja należą do Prediction.
4. KPI catalog jest trójwarstwowy: uniwersalny, branżowy i organizacyjny.
5. Prediction Compute jest dwuetapowe: assumption preflight i resolution, następnie właściwy compute.
6. Valuation methods dzielą się na weighted recommendation basket oraz unweighted cross-checks.
7. Valuation Advisor działa przed approval na świeżej computed candidate; nie zmienia danych i nie zatwierdza.
8. Jedna Valuation Case ma wiele nazwanych i opisanych wariantów/wersji; Advisor porównuje również warianty i zasila kontekst TRS trwałymi refs.
9. Approved nie ma zwykłego hard-delete. Dozwolone: Superseded, Archived, Invalidated z przyczyną; prawne usunięcie wyłącznie przez retention/GDPR/legal hold.
10. Produkcyjny zakres jest desktop-first. Mobile pozostaje wyłączony; nie jest bieżącą bramką.
11. System prowadzi do ideału, ale nie blokuje pracy z powodu błędów danych. Info/Warning/Material/CriticalData prowadzą exception workflow; CriticalData daje Provisional. Blokują tylko security/tenant breach i matematycznie nieokreślona operacja.
12. Working Revisions są oddzielone od Business Versions. Autosave/Undo/Compute nie tworzą setek wersji biznesowych.
13. Lineage jest version-level DAG, nie relacją opartą na nazwach.

## 3. Problemy obecnego systemu, których nie wolno zamaskować UI

1. Niespójność Statement→Analysis: te same dane CD Projekt 2025 pokazywały radykalnie różne marże; występował też NOPAT większy od revenue.
2. Silent-zero: brakujące/nieprawidłowe dane są w wielu usługach zamieniane na zero lub wybierane przez `firstNonZero`.
3. Readiness bypass: confirmed/mapped może być uznane za ready bez pełnego kontraktu.
4. Brak trwałego period lineage oraz nieobecny na baseline fix monetary units; ryzyko 1000×.
5. Analysis może powstać jako pusty Draft bez KPI i bez pełnego lifecycle.
6. Models zawiera eventy, mimo że docelowo ma być neutralnym baseline.
7. Prediction opiera część wariantów na prostych mnożnikach/nazwach pól, bez causal engine.
8. Compute modelu kończy się timeoutem; UI może pozostawić dane wyglądające na aktualne.
9. Valuation loader stosuje uproszczony FCFF i fallbacki zero; approval nie jest atomowy, snapshot version nie ma pełnej ochrony przed duplikatem.
10. Enterprise Valuation może wywalić cały moduł przez błędny kształt sensitivity.
11. Legacy `/api/economics` i v8 tworzą split-brain.
12. Lokalny runtime był podłączony do produkcyjnej bazy; lokalne zabezpieczenia są jeszcze zmianą niezintegrowaną.

Nie wolno uznać modułu za poprawny, dopóki te problemy nie zostaną usunięte oraz zabezpieczone regression tests.

## 4. Wspólny kontrakt danych i governance

### 4.1 Identyfikatory

Każdy artefakt ma:

- `artifact_id`,
- immutable `business_version_id`,
- Draft `working_revision_id`,
- immutable `compute_snapshot_id`,
- `compute_run_id`,
- `engine_manifest_id`,
- `organization_id`,
- `semantic_hash`.

Legacy IDs pozostają rozwiązywalne przez alias table.

### 4.2 Lifecycle i freshness

Lifecycle:

`DRAFT → READY_FOR_REVIEW → IN_REVIEW → APPROVED → SUPERSEDED / ARCHIVED / INVALIDATED`

`NEEDS_CHANGES` wraca do Draft. Reopen tworzy vN+1. Approval i snapshot są jedną transakcją.

Freshness jest osobne:

- Never computed,
- Current,
- Stale because source changed,
- Stale because assumptions changed,
- Compute failed.

Approved historycznie pozostaje Approved, lecz UI pokazuje, że rodzina źródłowa ma nowszą wersję.

### 4.3 Jakość i wyjątki

Outcome:

- Clean,
- Conditional,
- Provisional.

Poziomy exception:

- Info — automatyczny zapis;
- Warning — akceptacja analityka z uzasadnieniem;
- Material — impact assessment i maker–checker;
- CriticalData — compute/export dozwolone, wymuszone Provisional;
- Security/UndefinedMath — blokada.

Każdy wyjątek ma source/cell reference, expected/observed/delta/unit, owner, reason, accepted_by, expiry, evidence i historię.

### 4.4 Reproducibility

Engine manifest przypina:

- code SHA,
- engine/formula/taxonomy version,
- fiscal calendar,
- FX i market-data snapshots,
- locale/timezone/as-of,
- rounding convention.

Financial correctness jest sprawdzana przez known-answer i tolerancje decimal/source rounding; raw JSON hash nie jest substytutem poprawności.

## 5. Statements — pełna przebudowa

### Funkcjonalność finansowa

Statement Pack Business Version zawiera P&L, BS i CF oraz:

- legal entity i consolidation perimeter,
- ownership/NCI, acquisitions/disposals i eliminations,
- fiscal calendar: standard, 4-4-5, 53-week, stub,
- FY/Q/month, flow/stock, quarter-only/YTD/LTM,
- original/restated/management-adjusted, audited/unaudited,
- transaction/functional/presentation currency,
- average/closing/historical FX oraz CTA,
- IFRS/local GAAP/US GAAP, IFRS 16, discontinued i exceptional items,
- source evidence per row/cell.

Reconciliation ledger:

`source total → mapped → excluded → unmapped → duplicate/reclass/elimination → canonical total → residual`

Kontrole:

- independent subtotals,
- Assets = Liabilities + Equity w source-rounding tolerance,
- opening + movements = closing,
- CF closing cash = BS cash,
- retained earnings/NI,
- elimination debits = credits,
- period collisions i duplicate detection,
- missing nigdy nie staje się zero.

### Workflow

Upload/resume → malware/file validation → parse → map → reconcile → exception resolution → review → approve. Restatement tworzy nową wersję i oznacza descendants stale.

### Grafika i UX

- jeden Finance Workspace Bar;
- P&L/BS/CF jako główne widoki;
- w tym samym pasku tabeli opisane disclosure buttons: Quality, Mapping, Periods, Sources;
- sticky line/item i period headers, jawne currency/scale;
- source files jako resizable drawer;
- `Report section` rozdzielone na Generate draft, Open, Publish/Add to report;
- `Related` pokazuje Analysis/Models/Prediction/Valuation i `+ New` z preselected source version;
- każdy row otwiera source/provenance.

## 6. Analysis — pełna przebudowa

### Kreator

Quick Create lub Customize:

1. exact Statement Pack Version, periods, entity, currency/scale;
2. purpose, industry i analysis type;
3. KPI catalog: universal, industry, org-custom;
4. preflight required lines, denominators, units, periods, benchmarks;
5. create + compute.

Quick Create z presetem ma trwać ≤45 s. Custom wizard zachowuje wybory i pozwala clone existing definition.

### Funkcjonalność finansowa

- formula AST/version, sandboxed custom formulas i unit checking;
- temporal conventions: average balance, LTM, interim annualization, days in period, negative denominators;
- liquidity, profitability, leverage, coverage, efficiency/WC, cash flow, growth i returns;
- reported→adjusted EBITDA/EBIT/NI;
- actual vs prior/budget/latest forecast;
- horizontal/common-size/CAGR;
- segment/geography/product oraz price-volume-mix;
- benchmark peer set, normalization, as-of, outliers, percentiles i license;
- variance owner/comment/action/due date.

Analysis nie zmienia Statement values i nie jest forecastem DCF.

### Grafika i UX

- główne płótno: wspólny Finance Data Grid;
- Columns manager, saved personal/team views i presety;
- dynamic periods, Δ value/%, benchmark, interpretation, data quality i downstream uses;
- kebab i karta KPI: trend, formula, inputs, benchmark, lineage, comments i history;
- bulk include/exclude report/model/prediction/budget z exact target version;
- pusty Draft ma CTA `Configure KPIs`, nie Approve;
- review startuje w changed-only compare z komentarzami.

## 7. Baseline Models — pełna przebudowa

### Definicja

Neutralny `no-decision baseline`: exact Approved Statement Pack + compatible Approved Historical Analysis. Model kontynuuje historyczne relacje i kontraktowe zobowiązania, ale nie zawiera inicjatyw, nowego finansowania, spłat uznaniowych, dywidend ani alokacji nadwyżek.

Cash jest wynikiem. Może być ujemny i wywołuje Funding gap alert. Brak plug.

### Schedules

- revenue price/volume/mix;
- headcount/payroll;
- COGS i OPEX;
- DSO/DIO/DPO;
- CAPEX vintages i depreciation;
- leases;
- contractual debt maturities/interest;
- tax, NOL i deferred tax;
- equity/retained earnings;
- P&L→CF→BS.

Monthly engine i purpose-driven horizon do steady state/debt maturity/business cycle. Annual i quarterly roll-up: flows sum, stocks closing.

Circularity ma deterministic solver, convergence limit i fail-closed undefined-math state. Backtesting używa holdout actual, bias/MAPE per material line; seasonality bez 24–36 miesięcy jest degraded/estimate.

### Dwa widoki

1. `Assumptions`: grid driverów, history, base period, rule, unit, source, forecast value, range, quality, effect preview, undo/reset.
2. `Calculations`: future P&L/BS/CF w tej samej strukturze co Statements; actual/forecast bands, tie-outs i cell-level lineage.

Compute bierze frozen revision. Po edit wynik jest stale. Usuń Events Timeline i Valuate Model z głównego toku.

## 8. Prediction — pełna przebudowa

Prediction bazuje na exact Approved Baseline Version i zawiera:

1. standard Base/Upside/Downside;
2. manual KPI/driver overrides;
3. fundamental initiatives/decisions;
4. financing, repayment, dividends i surplus allocation.

Impact chain:

`initiative/decision version → assumption → driver/KPI → schedule/statement line → forecast`

Każdy impact ma amount/%/unit/sign, start, ramp, duration, decay, implementation cost, confidence/probability, owner/source, capacity i cannibalization dependencies.

### Dwuetapowy Compute

1. Preflight analizuje cały assumption set, wykrywa overlap, double counting, conflict, missing i inconsistency, pokazuje numeric impact oraz rekomendowane resolutions.
2. Użytkownik akceptuje lub zmienia resolution; materialne decyzje podlegają review.
3. Dopiero potem actual compute.

System nie blokuje budowania założeń i nie sumuje konfliktów po cichu.

### Funkcjonalność ekspercka

- causal price/volume/capacity/inflation/FX/rates/tax dependencies;
- facility limits, rates, tenors, covenants i min cash per scenario;
- reverse stress i break-even;
- liquidity/funding/covenant headroom;
- initiative realization versus actual feedback;
- scenario compare absolute/Δ/%.

### Dwa widoki

1. `Build assumptions`: scenario selector, driver grid, initiative cards/timeline i conflict/impact panel.
2. `Models/Results`: scenario P&L/BS/CF, variance vs baseline, compare 2–4 scenarios, waterfall/tornado jako dodatek.

## 9. Enterprise Valuation — pełna przebudowa

### Valuation Case i warianty

Jedna Case ma wiele nazwanych i opisanych variants/business versions. Każda przypina source Baseline/Scenario version, assumptions, market snapshots, compute run i result history. Variant compare jest funkcją podstawową.

### Metody

- DCF/FCFF;
- trading comparables;
- precedent transactions, gdy dane i kontekst są właściwe;
- inne metody tylko z applicability policy.

Recommendation basket zawiera complete weighted methods sumujące się do 100%. Cross-check methods pozostają nieważone. System pokazuje correlation, contribution i disagreement.

### Obliczenia

`FCFF = EBIT(1-cash tax) + D&A - ΔWC - CAPEX`

WACC:

- currency/nominal-real/pre-post-tax consistency,
- risk-free/ERP/beta peer set/unlever/relever,
- target/current capital structure,
- cost of debt/spread/tax shield.

Terminal:

- `g < WACC`,
- `g = reinvestment rate × ROIC`,
- steady-state margins/CAPEX/WC,
- Gordon i exit multiple jako jawne warianty/cross-checki.

EV→Equity:

- debt, leases, pensions/provisions,
- minorities/NCI,
- associates/investments,
- restricted/excess cash i non-operating assets,
- options/dilution i debt-like items,
- aligned as-of.

Sensitivity: 5×5 i operational sensitivity; tornado z poprawnym formatowaniem; terminal share i implied multiple/margin/growth checks.

### Valuation Advisor

Po fresh compute, przed approval:

- facts,
- hypotheses,
- risks,
- questions,
- recommended actions/pomysły,
- evidence, impact i confidence,
- compare variants.

Nie zmienia danych i nie zatwierdza. Po approval zostaje zamrożony. Wynik, sources i variants trafiają do kontekstu TRS przez immutable refs. Wymagana polityka AI: provider/model/prompt version, residency/no-training, cost/rate limit, evidence digest i hallucination evaluation.

### Flow UX

`Source → Assumptions → Methods & weights → Results → Sensitivity → Valuation Advisor → Export`

Named step states zamiast czerwonych kropek. N/A nigdy jako PLN 0. Brak comps = Not configured + CTA. Export wybiera variant/version/methods/views/Advisor i generuje provenance manifest.

## 10. Stanowisko analityka

### Finance Data Grid

Wspólny virtualized grid dla Statements/KPI/Assumptions/Outputs/Methods:

- multi-range selection,
- rectangular paste,
- fill down/right,
- paste special,
- bulk set/reset/clear,
- find/replace,
- freeze/pin/hide/group,
- formula bar i validation panel,
- stable canonical keys.

Target: 10k×120 logical cells, ≥45 FPS, input p95<100 ms, 1000-cell paste jako jedna transakcja.

### Excel/CSV round-trip

Template, values export, formulas export, import/update, manifest, mapping, preview diff i transactional apply. Approved nigdy nie jest mutowany. Zero silent coercion. 5k×60 export/import bez UI timeout.

### Keyboard

Pełny core workflow bez myszy, command palette, standardowe skróty, focus restore i task benchmark ≤90 s.

### Undo/drafts/conflicts

Autosave i operation stack, ≥50 Undo/Redo, atomowy undo bulk paste, crash recovery ≤5 s accepted edits oraz mine/theirs/base conflict resolution. Compute wskazuje frozen revision hash.

### Compare

Period, actual/forecast, version, entity, scenario i method; absolute/Δ/%, materiality, changed-only, synchronized scroll i export diff.

### Review/comments

Cell/range comments, mentions, assign, blocking, resolve/reopen, checklist i changed-only reviewer entry. Approval respektuje SoD i exception policy.

### Saved views i exception inbox

Personal/team filters/views oraz deduplicated exception queue z severity, owner, SLA i deep links. Toast nie jest trwałym workflow.

### Why this number?

Dla każdej wartości: source cells, formula, transformations, FX/unit, overrides, compute run, author/time i upstream freshness. Cel: ≤3 kliknięcia dla losowych 50 wartości.

## 11. Wspólny interfejs graficzny

Zachować zaakceptowany ciemny wygląd list. Przebudować workspace’y, nie tworzyć nowej stylistyki całego produktu.

### Finance Workspace Bar

Sticky, jedna hierarchia:

- lewa: Back, editable name, compact version/status;
- Context popover: type, period, entity, currency/scale, source i last compute;
- środek: tylko główne views;
- prawa: combined freshness/primary action, max 1 secondary, lifecycle, More i fullscreen;
- maksymalnie 5 bezpośrednich controls po prawej.

Valuation stepper jest osobnym kompaktowym row, nie przeładowuje paska.

### Focus mode

Pozostawia Menu 1, Workspace Bar, view navigation i workspace. Ukrywa global topbar i Finance chrome. `Esc` wychodzi. Nie refetchuje i zachowuje selection, filters, scroll, focus i draft.

### Viewport policy

- pełna praca: desktop/laptop ≥1024, odbiór przede wszystkim 1280/1440/1920;
- tablet: read-only detail/comments/exception triage;
- mobile: edycja/mutacje/compute/review wyłączone fail-closed; jasny DesktopRequired.

Mobile nie jest bramką obecnego wydania.

### A11y

WCAG AA, 44 px controls, keyboard, screen-reader labels, status niezależny od koloru, progress announcements, focus restore, 200% zoom i chart data alternative.

## 12. Architektura backendu i migracja

### Canonical store

PostgreSQL, addytywne `finance_*` structures. Nowe API: `/api/v8/finance-v2/*`. Legacy endpoints są frozen i korzystają z adapterów.

Canonical services:

- artifactVersionService,
- lifecycleService,
- lineageService,
- computeJobService,
- exceptionLedgerService,
- reproducibility/export service.

### Gate A

1. A01 schema/data inventory i deterministic manifest.
2. A02 API/consumer freeze i fixtures.
3. A03 legacy classification: Auto/MigrateWarning/Quarantine/Exclude.
4. A04 security incident closure.

### Gate B

1. artifact/version/revision schema;
2. lifecycle/concurrency/SoD;
3. lineage/staleness;
4. jobs/runs/outputs;
5. exception/reconciliation;
6. reproducibility/restatement/retention/export;
7. observability/runbooks.

### Gate C

1. additive expand migrations;
2. compatibility services/API adapters;
3. deterministic chunked backfill with dry-run/resume/checksums;
4. canary shadow writes/reads and normalized parity;
5. per-module cutover rehearsal;
6. rollback/forward-fix rehearsal.

Contract/drop legacy następuje dopiero po osobnym późniejszym gate i dowodach produkcyjnych.

## 13. Gold vertical slice

Zbuduj `GoldCo Manufacturing Group` wraz z niezależnym workbookiem-oracle:

- PLN parent + EUR subsidiary,
- FY2023–2025 i monthly detail,
- 2024 restatement,
- consolidated pack, elimination i NCI,
- universal + manufacturing analysis, normalized EBITDA i PVM,
- baseline 2026–2028 z pełnymi schedules, bez plug, negative cash funding gap,
- Prediction Base + efficiency initiative + downside,
- konflikt direct cost override vs initiative rozwiązany przez stage-1 preflight,
- financing tylko w scenario,
- Valuation baseline/downside, FCFF DCF + trading comps, exit multiple cross-check, 5×5, Advisor, maker–checker i Export.

Po GoldCo: CD Projekt, Apator, Tesco i Tesla jako real-data proof. Apator musi zachować poprawną skalę około PLN 466 mln, nie 466 tys.

## 14. Program fal

1. Fala 0 — Gate A.
2. Fala 1 — Gate B.
3. Fala 2 — Gate C.
4. Fala 3 — GoldCo Statements + productivity contracts/grid/drafts.
5. Fala 4 — Analysis + keyboard/review/saved views.
6. Fala 5 — Baseline Models + compare/Excel.
7. Fala 6 — Prediction + preflight/conflict/financing.
8. Fala 7 — Valuation + market data/Advisor/Export.
9. Fala 8 — wspólny Workspace Bar, module adapters, lineage navigator i exception inbox.
10. Fala 9 — full GoldCo E2E, real companies, load/fault/concurrency/tenant matrix.
11. Fala 10 — independent CFO pilot i progressive tenant rollout.

Po zamrożeniu Gate B można równoleglić grid/review UX, golden workbook i market-data adapters. Nie tworzyć konkurencyjnych formula/value/version engines.

### Tryb realizacji „jednym dużym strzałem”

Fale i gate’y są wewnętrznymi punktami kontroli wykonawcy, a nie miejscami przekazywania niedokończonego programu właścicielowi. Claude ma:

1. przeprowadzić wszystkie fale od 0 do 10 w ramach jednego ciągłego zadania;
2. zachować raport i dowody z każdego gate’u, ale kontynuować autonomicznie po jego wewnętrznym przejściu;
3. samodzielnie naprawiać znalezione regresje oraz ponawiać testy;
4. nie redukować zakresu, nie zastępować funkcjonalności stubem i nie uznawać istniejącego zachowania za poprawne bez dowodu;
5. wrócić do właściciela wyłącznie po decyzję strategiczną, prawną, reputacyjną, kosztową, dotyczącą apetytu na ryzyko albo nieodwracalnej operacji;
6. nie oddawać częściowego pakietu do odbioru Codexowi. Końcowe przekazanie następuje dopiero po pełnym self-checku FC-01–FC-12 na jednym candidate SHA.

Jeżeli wystąpi prawdziwy blocker zewnętrzny, Claude ma dostarczyć `BLOCKED` wraz z dowodami, trzema wyczerpanymi drogami rozwiązania, wpływem i najmniejszą potrzebną decyzją. Brak czasu, wielkość zadania, czerwone testy lub złożoność nie są blockerem.

## 14A. Epiki wykonawcze i Definition of Done

Każdy epik jest zamknięty dopiero po spełnieniu funkcjonalnego, finansowego, technicznego, wizualnego i dowodowego DoD. Zielony kod bez runtime i realDB nie zamyka epika.

### EPIC-01 — Bezpieczne środowisko i kontrola legacy

Zakres: Gate A, bezpieczeństwo lokalnej bazy, inventory, API freeze, klasyfikacja legacy, incident closure.

DoD:

- lokalny runtime nie może zapisać danych biznesowych do produkcyjnej bazy nawet po ominięciu guardu aplikacyjnego;
- 100% obecnych artefaktów, tabel, endpointów i consumers jest zinwentaryzowane;
- każdy legacy artifact ma klasyfikację i checksum;
- frozen API fixtures i deep links mają test kompatybilności;
- aktualny SHA, branch, dirty-state i owner/allowlist są utrwalone w evidence manifest.

### EPIC-02 — Canonical Finance Core

Zakres: artifact/version/revision, lifecycle, permissions, lineage DAG, freshness, exceptions, comments, compute jobs, engine manifests, audit.

DoD:

- Working Revision, Business Version, Compute Snapshot, Run i Output mają trwałe, rozłączne ID;
- Approved jest niemutowalne, approval jest atomowy, reopen tworzy vN+1;
- maker–checker, ETag/409, idempotency i cross-org isolation działają na real Postgres;
- descendants otrzymują poprawny stale state bez mutacji historii;
- job przeżywa restart, duplicate enqueue, commit-before-ack i retry bez podwójnego wyniku.

### EPIC-03 — Statements Truth Engine

Zakres: ingest, mapping, evidence, period/entity/currency/unit, reconciliation, consolidation, restatement i Statement workspace.

DoD:

- source→canonical→presentation ma dokładny ledger na poziomie wartości;
- fiscal calendar, YTD/quarter/stub, currency translation, eliminations i NCI przechodzą known answers;
- missing, N/A, zero i wartości ujemne pozostają rozróżnione;
- Ready nie może ominąć pełnej readiness validation;
- UI ma wspólny Workspace Bar, nazwane disclosures, sticky grid, `PLN · tys.` i Related lineage;
- import→review→approve→cold reopen działa bez utraty źródeł i wersji.

### EPIC-04 — Analysis Workbench

Zakres: Quick Create, pełny kreator, trójwarstwowy KPI catalog, benchmarks, normalized earnings, variance/PVM, grid, review i downstream selection.

DoD:

- standardowa analiza powstaje i liczy się w ≤45 s, a pusty Draft nie jest ślepą uliczką;
- formuły mają period conventions, unit checking, denominator policy i component lineage;
- każdy KPI ma wartości dynamicznych okresów, delta, benchmark provenance, interpretację i quality state;
- column manager, row kebab/details, include in report/model/prediction oraz saved views działają;
- maker–checker, comments, compare, approve, reopen i Export zachowują dokładną wersję.

### EPIC-05 — Neutral Baseline Model

Zakres: assumptions, pełne schedules, monthly engine, outputs, backtest i dwa widoki `Założenia / Wyliczenia`.

DoD:

- model nie zawiera events, initiatives, nowego finansowania, discretionary debt repayment, dividend ani plug;
- cash jest wynikiem, ujemny cash pozostaje widoczny z czerwonym funding-gap alertem;
- P&L, BS i CF wynikają z pełnych schedules i przechodzą tie-out bez unexplained plug;
- assumption grid obsługuje batch/paste/precise input, reset, undo i source trace;
- Compute jest asynchroniczny, idempotentny, timeout-safe i oznacza wcześniejsze wyniki stale po edycji;
- output ma tę samą czytelną strukturę co Statements oraz actual/forecast banding.

### EPIC-06 — Prediction and Scenario Engine

Zakres: Base/Upside/Downside, driver overrides, initiatives, causal mapping, financing, conflict resolution, stress i compare.

DoD:

- istnieją dokładnie dwa główne widoki: `Budowa założeń / Modele i wyniki`;
- stage 1 pokazuje konflikty, double counting, brakujące rozstrzygnięcia i proponowane skutki liczbowe;
- stage 2 liczy wyłącznie frozen, zaakceptowany assumption snapshot;
- Base jest semantycznie równy Baseline, a finansowanie występuje tylko jako jawna decyzja scenario;
- initiative ma timing, ramp, cost, benefit, confidence, owner, dependencies i statement impact;
- scenario statements, funding/covenant headroom, reverse stress oraz compare absolute/delta/percent działają i są wersjonowane.

### EPIC-07 — Enterprise Valuation

Zakres: multi-variant Valuation Case, DCF, comps, precedent transactions, methods/weights, results, sensitivity, Advisor, Export i TRS.

DoD:

- wariant można nazwać, opisać, wersjonować, porównać i otworzyć historycznie;
- source wskazuje dokładną Approved Baseline lub Scenario Version;
- FCFF, WACC, terminal economics i EV→Equity bridge przechodzą niezależny workbook;
- Methods & weights rozróżnia recommendation basket i cross-check; N/A nigdy nie jest zerem;
- 5×5 ma 25 poprawnych, monotonicznych komórek, base cell i dostępny opis;
- Advisor działa przed approval na fresh candidate, cytuje evidence, rozdziela facts/hypotheses i zapisuje trwałe refs do kontekstu TRS;
- approval/snapshot/version jest atomowy; 15/15 wycen przechodzi compute→review→approve→cold reopen.

### EPIC-08 — Analyst Productivity Platform

Zakres: Finance Data Grid, keyboard, draft/autosave, Undo/Redo, Excel, Compare, comments/review, filters/views, exception inbox i Why this number.

DoD:

- 100×10 wartości można wkleić w <60 s i cofnąć jedną operacją;
- 1000-cell paste jest atomowy, walidowany i nie zapisuje częściowych danych;
- podstawowy workflow działa bez myszy w ≤90 s;
- Excel 5k×60 przechodzi export→edit→import→diff→apply→cold reopen bez silent coercion;
- compare wersji/okresów/entities/scenarios/metod ma absolute/delta/percent i materiality;
- komentarz prowadzi do dokładnej komórki, blocking comment blokuje approval, a review zaczyna się od changed-only diff;
- dla losowych wartości `Why this number?` prowadzi do źródła, formuły i runu w ≤3 kliknięciach.

### EPIC-09 — Wspólny CX i design system Finance

Zakres: jeden Workspace Bar, focus mode, wspólny layout, stany, lokalizacja, dostępność oraz modułowe adaptery.

DoD:

- pięć narzędzi ma jeden wspólny wzorzec identity/navigation/actions i nie powiela tytułów;
- nazwa jest edytowalna zgodnie z lifecycle; po prawej pozostaje max jedna akcja główna, jedna kontekstowa, lifecycle, More i fullscreen;
- focus mode pozostawia Menu 1 oraz workspace, zachowuje draft/selection/scroll/focus i wychodzi przez `Esc`;
- każdy stan loading/empty/error/stale/unsaved/conflict/running/success ma jawny, spójny wariant;
- local error boundary nie wywala całego Finance shell;
- UI jest w jednym locale, liczby i jednostki są konsekwentne, kontrast/focus/keyboard spełniają WCAG AA;
- 1280, 1440 i 1920 przechodzą visual regression; mobile/tablet nie pokazują niedozwolonych mutacji.

### EPIC-10 — Migration, Operations and Release Evidence

Zakres: additive migrations, adapters, deterministic backfill, shadow parity, cutover, rollback, telemetry, SLO, runbooks i final pilot.

DoD:

- fresh i upgrade migration przechodzą na disposable real Postgres;
- backfill jest resumable, rerunnable i zachowuje count/checksum equation;
- shadow parity nie ma niewyjaśnionej krytycznej różnicy;
- cutover i rollback nie tracą acknowledged writes;
- dashboards rozróżniają validation errors od infrastructure failures i prowadzą correlation ID;
- exact-SHA deployment/runtime, GoldCo, real-company matrix i niezależny CFO pilot przechodzą FC-01–FC-12.

## 15. Własność pakietów

- Security/Platform: A04, DB roles, secrets, tenant isolation.
- Data/DB Migration: A01, A03, C01, C03.
- API Architecture: A02, C02.
- Core Architecture: B01–B04.
- Finance Controls/Model Risk: B05–B06, governance i known answers.
- SRE/Release: B07, C04–C06.
- CFO/Financial Data: Statements.
- Financial Analysis: Analysis/KPI/benchmarks.
- FP&A/Modeling: Baseline schedules/backtesting.
- Strategy/Scenario: Prediction/causal engine.
- Corporate Finance: Valuation/market data/Advisor.
- Frontend Platform: Data Grid, drafts, keyboard i compare.
- Workflow UX: comments/review/exceptions.
- Design System: Workspace Bar/focus/a11y.
- Artifact Platform: Excel/export manifests.

Każdy owner dostarcza candidate do niezależnego Code/Finance/UX review.

## 16. Testy obowiązkowe

### Finance correctness

- annual, interim, YTD, quarter-only, stub, 53-week;
- restated i management-adjusted;
- multi-currency, consolidated, eliminations i NCI;
- negative earnings, missing CF, high leverage, seasonal;
- average-balance, LTM, negative denominator;
- full schedule-to-statement reconciliation;
- no-plug negative cash baseline;
- scenario conflict, delay/failure i financing constraints;
- independent DCF/WACC/terminal/EV-equity/comps.

### Technical

- real Postgres fresh+upgrade;
- deterministic backfill, resume i rollback;
- legacy fixture parity;
- job kill before/after compute, commit-before-ack, duplicate enqueue i cancel race;
- concurrent edits/compute/approve/reopen/archive;
- cross-org IDOR/edge/job/cache/export;
- retention/legal-hold negative tests;
- export signed URL i immutable reopen.

### Analyst/UX

- keyboard bulk edit;
- 1000-cell paste + atomic undo + cold reopen;
- Excel export/change/import/diff/apply/rollback;
- conflict and crash recovery;
- compare/comment/resolve/approve/vN+1;
- saved view/filter/share/reopen;
- focus mode five modules, 1280/1440/1920, 200% zoom;
- mobile/tablet mutations disabled;
- lineage/stale/exception deep links;
- 10k×120 performance fixture.

## 16A. Protokół testowania końcowego

Claude nie może wykonać jednego zbiorczego smoke testu. Odbiór ma pięć niezależnych warstw, wykonywanych na tym samym candidate SHA i tej samej udokumentowanej konfiguracji.

### Warstwa 1 — Statyczna i kontraktowa

- format/lint/typecheck/build wszystkich dotkniętych aplikacji;
- schema/API contract fixtures i migration replay;
- test zakazu silent-zero, unit/period/source loss oraz cross-org references;
- skan lokalnych bypassów wspólnych components/services;
- lista wszystkich requirements z mapowaniem `requirement → implementation → automated test → runtime evidence`.

### Warstwa 2 — Finansowa i known-answer

- GoldCo workbook jest niezależnym oracle i obejmuje wartości pośrednie, nie tylko wynik końcowy;
- każdy statement subtotal, KPI, schedule, scenario impact i valuation bridge jest porównany numerycznie z tolerancją wynikającą z source rounding;
- tie-out nie wystarcza sam: kontrola obejmuje inputs, formulas, conventions, intermediate schedules, plugs i residuals;
- każdy wyjątek ma oczekiwany severity/outcome/label;
- real-company proof potwierdza currency, scale, negative/sparse cases oraz Apator 1000× regression.

### Warstwa 3 — RealDB/API/jobs

- testy działają na disposable real Postgres, nie wyłącznie mock DB;
- każdy przepływ ma HTTP request/response, SQL readback i cold reopen;
- fault injection: restart procesu, timeout, duplicate enqueue, retry, cancel, concurrent edit/approve i rollback;
- tenant isolation oraz permission matrix są sprawdzane dla każdej rodziny endpointów;
- import/export/job po ponownym uruchomieniu zachowuje exact version i manifest.

### Warstwa 4 — Browser E2E i analyst workflow

Playwright ma przejść co najmniej:

1. Statement import→map→reconcile→review→approve→reopen;
2. Analysis Quick Create i Customize→KPI edit→compute→review→approve→compare→export;
3. Baseline assumptions batch edit→compute→negative cash alarm→outputs→approve→reopen;
4. Prediction scenario→preflight→resolution→compute→compare→approve;
5. Valuation multi-variant→methods→compute→sensitivity→Advisor→review→approve→export;
6. lineage parent/child/sibling navigation i stale propagation;
7. 1000-cell paste, Undo, autosave recovery, conflict i Excel round-trip;
8. keyboard-only benchmark;
9. timeout/crash zachowujący kontekst i draft;
10. mobile/tablet capability fail-closed bez mutating network calls.

### Warstwa 5 — Manualny odbiór ekspercki

- niezależny Corporate Finance/CFO reviewer potwierdza poprawność merytoryczną;
- niezależny QA/UX reviewer potwierdza workflow, hierarchy, copy i exception handling;
- design-system reviewer potwierdza zgodność graficzną i brak lokalnych odstępstw;
- reviewerzy nie mogą być autorami sprawdzanych zmian;
- wszystkie uwagi Critical/Material muszą zostać zamknięte lub mieć zaakceptowany waiver zgodny z polityką.

## 16B. Protokół zgodności graficznej i Customer Experience

Zgodność graficzna nie oznacza wyłącznie podobnego koloru. Odbiór obejmuje zgodność z istniejącym produktem, wspólnym design systemem i wzorcami zatwierdzonymi w tym programie.

### Źródła prawdy UI

Claude ma podczas Gate A zinwentaryzować i wskazać dokładne ścieżki do:

1. globalnych design tokens: kolory, typography, spacing, radius, shadows, z-index, motion;
2. współdzielonych button/input/dialog/table/tooltip/status/navigation components;
3. aktualnego Menu 1, global shell, Finance list i zatwierdzonego list/detail side-panel pattern;
4. dokumentacji UI/UX, accessibility i localization znajdującej się w repozytorium;
5. istniejących screenshotów referencyjnych oraz zaakceptowanych ekranów z rejestru właściciela.

Nie wolno tworzyć drugiego lokalnego systemu komponentów Finance, kopiować kolorów ręcznie ani budować jednorazowych tabel poza wspólnym Finance Data Grid. Jeżeli repo nie zawiera jednoznacznego tokenu/wzorca, Claude ma rozszerzyć wspólny design system i udokumentować decyzję.

### Macierz screenshotów i stanów

Dla każdego z pięciu modułów trzeba wykonać current-SHA screenshots w 1280, 1440 i 1920 dla:

- list;
- detail/default;
- focus mode;
- create/configure;
- loading i compute running;
- empty/never computed;
- validation warning/provisional;
- stale;
- error lokalny;
- review/approved;
- długiej nazwy, braków, zera, wartości ujemnej i dużej liczby.

Dodatkowo trzeba uchwycić wszystkie główne widoki: P&L/BS/CF, KPI table, Model assumptions/outputs, Prediction builder/results oraz wszystkie kroki Valuation.

### Kryteria wizualne

- jedna logiczna hierarchia: Menu 1 → Workspace Bar → view navigation → workspace;
- brak powtórzonych tytułów i martwej przestrzeni >25% na typowym ekranie roboczym;
- brak obciętych akcji, podwójnego pionowego scrolla i przypadkowych layout shifts;
- tabular numerals, right alignment, jawna waluta/skala/okres/entity/scenario;
- sticky headers i frozen identity columns w dużych tabelach;
- status nigdy nie jest przekazywany wyłącznie kolorem;
- body ≥14 px, meta ≥12 px, focus visible i kontrolki min. 44×44 tam, gdzie są interaktywne;
- dialog ma role/label/focus trap/Escape/restore; grid i charts mają dostępne nazwy oraz alternatywę danych;
- język jednego ekranu jest spójny; standardowe skróty finansowe mają tooltip/glossary;
- zero, missing, N/A, stale i provisional mają różne, konsekwentne reprezentacje.

### Visual regression i przegląd

- bazowe screenshoty powstają dopiero po zaakceptowaniu wzorca Workspace Bar oraz GoldCo vertical slice;
- automated visual regression ma kontrolowane fonty, dane, locale, viewport i animation-disabled mode;
- różnica pikselowa nie może być automatycznie zaakceptowana przez masowy update snapshotów;
- każdy zmieniony snapshot ma wpis: requirement, przyczyna zmiany, reviewer i status;
- manual overlay review obejmuje alignment, density, typography, truncation, focus, hover, selected, disabled i error states;
- końcowy raport UX zawiera tabelę `screen/state/viewport/reference/result/evidence`.

### Customer Experience acceptance

System ma przejść zadania czasowe wykonywane przez użytkownika, a nie tylko nawigację automatu:

- znalezienie źródła błędnej liczby;
- poprawienie 100 założeń;
- porównanie Draft z Approved;
- rozwiązanie komentarza review;
- rozstrzygnięcie konfliktu Prediction;
- porównanie dwóch wariantów wyceny;
- znalezienie wszystkich descendants danego Statement;
- odzyskanie pracy po timeout/crash;
- eksport i ponowne otwarcie identycznego materiału.

Każdy task ma zmierzony czas, liczbę błędów, liczbę obejść i komentarz reviewera. Nieudokumentowany workaround oznacza `FAIL`.

## 17. Dowody i artefakty odbiorowe

Każdy gate musi dostarczyć:

- exact candidate SHA i diff allowlist;
- migration/query/test commands;
- machine-readable manifest/ledger;
- HTTP i SQL readback;
- known-answer workbook comparison;
- screenshots/video tylko jako dowód pomocniczy;
- Playwright/JUnit reports;
- exception ledger z literalnymi stanami;
- rollback/recovery log;
- reviewer sign-off niezależny od autora.

Końcowy evidence pack musi dodatkowo zawierać:

- `REQUIREMENTS_TRACEABILITY_MATRIX` ze 100% wymagań i żadnym stanem UNKNOWN;
- `EPIC_DOD_REGISTER` z PASS/FAIL/EVIDENCE_MISSING dla EPIC-01–EPIC-10;
- `FUNCTIONAL_TEST_REPORT`, `FINANCE_KNOWN_ANSWER_REPORT` i `REALDB_E2E_REPORT`;
- `VISUAL_CX_ACCEPTANCE_REPORT` z macierzą ekranów, viewportów i stanów;
- `ACCESSIBILITY_REPORT` oraz wyniki keyboard-only;
- `MIGRATION_PARITY_AND_ROLLBACK_REPORT`;
- `PERFORMANCE_AND_FAULT_REPORT`;
- `OPEN_EXCEPTIONS_AND_WAIVERS`;
- `FINAL_HANDOFF_MANIFEST` zawierający SHA, branch, deploy/runtime identity, DB fingerprint zredagowany, migracje, flags, commands, test counts, artifact links i reviewerów.

## 18. FINAL CHECK — definicja końca

Program jest zakończony wyłącznie wtedy, gdy wszystkie poniższe punkty mają `PASS` na tym samym candidate SHA:

### FC-01 Environment and security

- local nie łączy się z produkcyjnym writerem;
- dedicated DB roles i tenant isolation;
- security incident closed;
- brak niewyjaśnionych mutacji.

### FC-02 Migration and compatibility

- 100% legacy classified;
- deterministic backfill, quarantine ledger i aliases;
- legacy API fixtures bez breaking diff;
- cutover oraz rollback rehearsed bez utraty acknowledged writes.

### FC-03 Statement truth

- golden matrix i real companies;
- source reconciliation, period/unit/currency/entity evidence;
- balance, CF i roll-forward w source tolerance;
- zero silent-zero i unexplained critical residual.

### FC-04 Analysis

- pełny trójwarstwowy KPI catalog;
- known-answer formulas/conventions;
- normalized earnings, variance i benchmarks;
- create/compute/review/approve/reopen/compare/export.

### FC-05 Baseline Models

- pełne schedules i monthly engine;
- no decisions/events/new financing/plug;
- negative cash alarm zachowany;
- backtest, tie-outs, idempotent compute i cold reopen.

### FC-06 Prediction

- A/B/C scenarios, causal impacts i financing;
- stage-1 preflight/resolutions;
- reverse stress/headroom;
- Base semantically equals baseline;
- no silent double counting.

### FC-07 Valuation

- multi-variant Case, full DCF/comps/bridge;
- basket/cross-check policy;
- 25 correct monotonic sensitivity cells;
- Advisor evidence/TRS context;
- 15/15 compute→review→approve→reopen;
- Apator unit proof.

### FC-08 Governance

- Working vs Business versions;
- Approved immutable;
- maker–checker high-risk;
- comments/checklists/exceptions/waivers;
- archive/invalidated/restatement lineage.

### FC-09 Analyst productivity

- 100×10 paste <60 s i atomic Undo;
- standard Analysis ≤45 s;
- keyboard task ≤90 s;
- Excel 5k×60 round-trip;
- compare, saved views, comments i Why this number ≤3 clicks.

### FC-10 UX/runtime

- jeden Workspace Bar na pięciu narzędziach;
- focus mode zachowuje state;
- local error boundaries;
- no global crash i no stale-as-current after timeout;
- 1280/1440/1920 i WCAG AA;
- desktop-first capability enforced.

### FC-11 Performance and operations

- declared SLO p50/p95/p99;
- load, fault, retry, concurrency i queue tests;
- dashboards, alerts i runbooks;
- export/import/compute nie blokują UI.

### FC-12 Independent pilot

Niezależny CFO/reviewer wykonuje cały przepływ:

`close/import → analysis → baseline → scenarios → valuation → Advisor → review → approval → export → cold reopen`

bez nieudokumentowanych workaroundów, z pełnym evidence i zaakceptowaną produktywnością.

Jeżeli choć jeden wymagany punkt nie ma dowodu, status pozostaje `NO-GO / EVIDENCE_MISSING`.

## 19. Gotowy prompt wykonawczy dla Claude’a

Poniższy prompt należy przekazać Claude’owi wraz z dostępem do repozytorium. Jest kontraktem realizacji całego programu, nie prośbą o plan ani analizę.

> # Zadanie: Finance Complete Program — realizacja end-to-end
>
> Przejmujesz pełną przebudowę modułu Finance w repozytorium Consultify. Masz doprowadzić istniejący system do profesjonalnego, produkcyjnego stanu funkcjonalnego, finansowego, technicznego i graficznego opisanego w dokumentacji. To jest jedno kompletne zadanie wykonawcze. Nie oddawaj mi planu, prototypu, fragmentu, pojedynczego epika ani częściowego handoffu.
>
> ## Dokumentacja obowiązkowa
>
> Przed działaniem przeczytaj w całości i w tej kolejności:
>
> 1. `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`
> 2. `docs/validation/finance-v3/OWNER_REVIEW_REGISTER_2026-08-09.md`
> 3. `docs/validation/finance-v3/FINANCE_COMPLETION_RECOMMENDATIONS_2026-08-09.md`
> 4. `docs/validation/finance-v3/FINANCE_CRITICAL_REVIEW_ADDENDUM_2026-08-09.md`
> 5. `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`
> 6. wszystkie wskazane przez nie kanoniczne dokumenty produktu, Statement Ready, Analysis, Modeling, Prediction, Valuation, design system, accessibility, localization, API i migration docs.
>
> Nadrzędny jest `FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`. Decyzje właścicielskie i rozstrzygnięcia w critical addendum mają pierwszeństwo przed historycznym kodem i starszą dokumentacją. Obecny kod jest stanem wyjściowym, nie definicją poprawności.
>
> ## Oczekiwany sposób realizacji
>
> 1. Wykonaj pełne Gate A, B i C, EPIC-01–EPIC-10 oraz Fale 0–10.
> 2. Gate’y traktuj jako wewnętrzne bramki jakości. Zachowuj ich raporty, ale nie zatrzymuj całego zadania po każdym z nich i nie oddawaj częściowego wyniku.
> 3. Najpierw ustal dokładny baseline: `pwd`, SHA, branch, dirty worktree, ownerów zmian, aktywne procesy, środowisko i fingerprint bazy z sekretami zredagowanymi. Nie nadpisuj ani nie włączaj do zakresu cudzych zmian.
> 4. Nie używaj `reset --hard`, broad clean, stash, `git add -A` ani destrukcyjnego usuwania. Stosuj allowlisty i checksumy plików współdzielonych.
> 5. Nie zapisuj do produkcyjnej bazy. Zabezpieczenie ma działać na poziomie DB role i aplikacji. Migracje, backfill i destructive probes wykonuj wyłącznie na disposable real Postgres, potem staging według procedury.
> 6. Zachowaj kompatybilność legacy przez additive schema, adaptery, aliases, deterministic backfill, shadow parity, per-module cutover i rehearsed rollback. Nie wykonuj big-bang rewrite.
> 7. Zbuduj jeden canonical finance core dla wartości, okresów, jednostek, wersji, revisions, lifecycle, lineage, freshness, exceptions, compute jobs, comments, review, permissions i audit. Nie twórz konkurencyjnych silników ani lokalnych bypassów.
> 8. Zrealizuj pełny zakres pięciu narzędzi: Statements, Analysis, neutralne Baseline Models, Prediction oraz Enterprise Valuation wraz z multi-variant cases, Advisorem, TRS context, eksportem i cold reopen.
> 9. Zrealizuj cały Analyst Productivity Contract: wspólny Finance Data Grid, batch/paste, keyboard, Undo/Redo, autosave/conflict, Excel round-trip, Compare, comments/review, saved views, exception inbox i `Why this number?`.
> 10. Zrealizuj wspólny standard graficzny: jeden Workspace Bar, focus mode, wspólne komponenty/tokens, wszystkie stany, WCAG AA, spójny locale i pełną macierz screenshotów w 1280/1440/1920. Mobile/tablet mają egzekwować uzgodnioną capability policy i nie wysyłać niedozwolonych mutacji.
> 11. Nie maskuj błędów UX-em. Usuń silent-zero, readiness bypass, period/unit/source loss, timeout/stale ambiguity, non-atomic approval, crash całego Finance shell i split-brain API. Dodaj regression tests.
> 12. Stosuj najwyższe jednoznaczne standardy rynku bez pytania właściciela. Pytaj wyłącznie o decyzje strategiczne, prawne, reputacyjne, kosztowe, apetyt na ryzyko lub nieodwracalną operację. Jeżeli nie ma takiej decyzji, kontynuuj autonomicznie.
>
> ## Definicja ukończenia
>
> Nie wolno uznać zadania za ukończone na podstawie kodu, builda, unit tests, mock DB, screenshotów albo deklaracji autora. Ukończenie wymaga jednocześnie:
>
> - PASS wszystkich EPIC DoD;
> - PASS FC-01–FC-12 na jednym exact candidate SHA;
> - complete Requirements Traceability Matrix;
> - niezależnych known-answer calculations i GoldCo vertical slice;
> - realDB/API/job fault/concurrency/tenant evidence;
> - pełnego Playwright E2E dla pięciu modułów;
> - visual/CX acceptance dla wszystkich wymaganych ekranów, stanów i viewportów;
> - accessibility, keyboard, Excel, Compare, comments i performance acceptance;
> - cutover/rollback rehearsal;
> - niezależnego CFO, UX oraz design-system review;
> - braku otwartych Critical/Material findings bez formalnego, dozwolonego waivera.
>
> Każdą znalezioną regresję napraw, uruchom ponownie adekwatny test i cały wymagany regression pack. Nie oznaczaj brakującego dowodu jako PASS. Używaj literalnie `UNKNOWN`, `PARTIAL`, `BLOCKED`, `EVIDENCE_MISSING`.
>
> ## Dopuszczalny blocker
>
> Możesz przerwać wyłącznie przy rzeczywistym zewnętrznym blockerze lub brakującej decyzji właścicielskiej z kategorii powyżej. Raport `BLOCKED` musi zawierać dowód, trzy wyczerpane drogi rozwiązania, wpływ i jedno minimalne pytanie. Wielkość zadania, brak czasu, złożoność, czerwone testy lub konieczność przebudowy nie są blockerem.
>
> ## Jedyny oczekiwany handoff końcowy
>
> Oddaj całość do niezależnego sprawdzenia Codexowi dopiero po pełnym self-checku. Handoff ma zawierać:
>
> 1. exact SHA, branch, allowlisted diff i status worktree;
> 2. mapę EPIC-01–EPIC-10 z DoD i dowodami;
> 3. Requirements Traceability Matrix;
> 4. migracje, backfill/parity/cutover/rollback evidence;
> 5. Finance Known-Answer Report i GoldCo workbook comparison;
> 6. realDB HTTP/SQL readback, jobs/fault/concurrency/tenant reports;
> 7. kompletne wyniki unit/integration/contract/Playwright/performance/a11y;
> 8. Visual & CX Acceptance Report z current-SHA screenshot matrix;
> 9. eksporty i cold-reopen evidence;
> 10. listę wszystkich wyjątków/waiverów oraz niezależnych reviewer sign-offs;
> 11. deployment/runtime identity i instrukcję niezależnego odtworzenia każdego gate’u;
> 12. literalne `READY_FOR_CODEX_FINAL_REVIEW` — wyłącznie jeżeli każdy obowiązkowy gate ma dowód PASS.
>
> Nie deklaruj `DONE`, `GO`, `PRODUCTION READY` ani pełnego ukończenia. Ostateczną decyzję podejmie Codex po niezależnym odtworzeniu dowodów. Twoim zadaniem jest dostarczyć jeden kompletny, działający i zweryfikowany candidate do tego odbioru.

## 20. Wewnętrzny checkpoint startowy Claude’a

Przed pierwszą mutacją Claude ma zapisać w evidence pack, bez oddawania częściowego zadania:

1. `pwd`, exact SHA, branch i `git status --short`;
2. aktywne procesy 3000/3001 i fingerprint środowiska z sekretami zredagowanymi;
3. allowlistę Gate A oraz ownerów istniejących zmian;
4. listę tabel, migracji, routes, consumers i dokumentów design system objętych inventory;
5. plan komend read-only i plan ochrony produkcyjnej bazy;
6. ryzyka kolizji z istniejącymi zmianami;
7. literalne `EVIDENCE_NEEDED`, jeżeli nie można potwierdzić aktywnej bazy, środowiska lub właściciela zmian.

Po zapisaniu checkpointu Claude kontynuuje Gate A i cały program. Checkpoint nie jest końcowym handoffem ani powodem do zatrzymania zadania.
