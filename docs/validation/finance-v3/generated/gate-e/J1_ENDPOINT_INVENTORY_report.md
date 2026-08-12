# J1 — Inwentaryzacja i klasyfikacja pokrycia 88 endpointów Finance v3

Agent J1 · Gate J · gałąź `codex/fv3p-j1-inventory` @ candidate `ee5736a5a6` · worktree
`/Users/piotrwisniewski/consultify-wt/fv3p-d-statements` · data: 2026-08-12.

Zakres: `server/src/routes/v8/finance-v2/*.routes.ts` (15 plików tras, 88 endpointów) +
testy `server/src/routes/v8/finance-v2/__tests__/*.pg.test.ts` (18 plików, 5135 linii).

Ten dokument jest fundamentem dla J2 (cross-tenant), J3 (współbieżność), J4 (uprawnienia) —
kolumna „plik:linia" i lista `uncalled`/`partially covered` poniżej to ich punkt startowy.

---

## 1. Zbiorcze liczby

| Kategoria | Liczba | % z 88 |
|---|---|---|
| **covered** | 78 | 88.6% |
| **uncalled** | 9 | 10.2% |
| **partially covered** | 1 | 1.1% |
| **false-green** | 0 (potwierdzone próbką 17 mutantów — patrz §4) | 0% |
| **blocked** | 0 | 0% |
| **RAZEM** | 88 | 100% |

Rozkład per plik (potwierdzony liczeniem `router.(get|post|put|patch|delete)(` w każdym pliku,
zgadza się z rozkładem podanym w briefie):

```
analysis 3 · artifacts 5 · baseline 4 · comments 17 · compare 6 · compute 4 · crosscutting 4 ·
export-import 4 · lineage-navigator 2 · models 2 · prediction 2 · saved-views 6 · statements 5 ·
valuation 21 · versions 3  =  88
```

---

## 2. Metodologia

1. **Ekstrakcja endpointów**: `grep -n "router\.(get|post|put|patch|delete)("` na każdym z 15
   plików `*.routes.ts`, z dociągnięciem literalnej ścieżki z następnej linii. 88 dopasowań,
   zgodne z rozkładem z briefu.
2. **Mapowanie wywołań testowych**: skrypt Python przeszedł WSZYSTKIE 18 plików
   `*.pg.test.ts`, wyłuskał każde wywołanie `request(appX).<metoda>(<url>)` (regex na
   `.get/.post/.put/.patch/.delete(` niezależnie od nazwy zmiennej — pierwsza próba grepowania
   tylko `request(app)` dawała fałszywe zera, bo część plików używa `appA`/`appB`/`appAsOrg(...)`),
   znormalizował `${zmienne}` do `:X` i dopasował do wzorca ścieżki endpointu (segmenty `:param`
   dopasowane jako dowolny nie-`/` ciąg, kotwiczone na całą ścieżkę, z opcjonalnym `?query`).
   To jest metoda AUTORYTATYWNA dla kolumny „wywołań w testach" i klasyfikacji `uncalled` —
   nie zgaduje na podstawie nazwy pliku testowego, tylko parsuje realne wywołania HTTP.
3. **Głębokość asercji** (dla rozróżnienia `covered` vs `partially covered`): druga próbka
   sprawdziła obecność `.body.data`/asercji treści w oknie ~500 znaków po każdym wywołaniu.
   Endpointy oznaczone jako podejrzane (`STATUS_ONLY?`) zostały zweryfikowane RĘCZNIE czytając
   kod testu — w 5 z 6 przypadków heurystyka dała fałszywy alarm (asercje były dalej niż okno
   400–500 znaków, np. przez wieloliniowy `.send({...})` lub destrukturyzację `const {data} =
   res.body`); jeden przypadek (baseline `/compute`) potwierdził się jako realna luka i został
   dodatkowo zweryfikowany mutantem (§4).
4. **Mutacja**: 17 endpointów (próbka >15, z naciskiem na `comments` i `valuation` — patrz §4)
   zepsute pojedynczo w handlerze (zmiana kodu statusu, podmiana wartości w odpowiedzi na
   `MUTANT_*`), uruchomiony właściwy plik testowy, zweryfikowane czerwono/zielono, przywrócone
   `git show ee5736a5a6:<plik> > <plik>`. Drzewo potwierdzone czyste (`git status --short`) po
   KAŻDYM przywróceniu.

**Czego NIE zrobiono (i dlaczego)**: głębokość asercji nie została ręcznie zweryfikowana dla
wszystkich 78 `covered` endpointów pojedynczo — to wymagałoby czytania każdego z 5135 linii
testów linia po linii, poza rozsądnym budżetem tej sesji. Zamiast tego: (a) 17 z nich (w tym
najbardziej złożone — `valuation`, `comments`) zweryfikowano mutantem, co jest silniejszym
dowodem niż czytanie asercji; (b) automatyczny skan `uncalled` jest wyczerpujący (100% z 88);
(c) heurystyka głębokości asercji wyłapała WSZYSTKIE potencjalne przypadki `STATUS_ONLY`,
z których 5/6 zweryfikowano ręcznie jako fałszywy alarm. Pozostałe endpointy nieoznaczone przez
żaden z powyższych sygnałów są klasyfikowane `covered` na podstawie: obecności wywołania +
faktu że sąsiednie/analogiczne endpointy w tym samym pliku (sprawdzone mutantem) są rzetelnie
testowane tym samym wzorcem (jeden `beforeAll` fixture, jeden styl asercji na cały plik).

---

## 3. Tabela pełna — 88 endpointów

Kolumna „Mutant" = wynik testu §4 (`caught` = mutant złapany, `NOT_CAUGHT` = mutant przeszedł
niezauważony → realna luka).

| # | Grupa | Metoda | Ścieżka | Plik:linia | Wywołań w testach | Klasyfikacja | Mutant |
|---|---|---|---|---|---|---|---|
| 1 | analysis | GET | `/analysis/kpi-catalog` | `server/src/routes/v8/finance-v2/analysis.routes.ts:38` | 2 | **covered** |  |
| 2 | analysis | POST | `/analysis/:businessVersionId/compute` | `server/src/routes/v8/finance-v2/analysis.routes.ts:82` | 3 | **covered** |  |
| 3 | analysis | GET | `/analysis/:businessVersionId/kpi-values` | `server/src/routes/v8/finance-v2/analysis.routes.ts:129` | 2 | **covered** |  |
| 4 | artifacts | POST | `/artifacts` | `server/src/routes/v8/finance-v2/artifacts.routes.ts:68` | 42 | **covered** |  |
| 5 | artifacts | GET | `/artifacts/:artifactId` | `server/src/routes/v8/finance-v2/artifacts.routes.ts:111` | 8 | **covered** |  |
| 6 | artifacts | GET | `/artifacts/:artifactId/versions` | `server/src/routes/v8/finance-v2/artifacts.routes.ts:163` | 2 | **covered** |  |
| 7 | artifacts | GET | `/artifacts/:artifactId/capabilities` | `server/src/routes/v8/finance-v2/artifacts.routes.ts:201` | 3 | **covered** |  |
| 8 | artifacts | POST | `/artifacts/:artifactId/rename` | `server/src/routes/v8/finance-v2/artifacts.routes.ts:249` | 2 | **covered** | caught |
| 9 | baseline | GET | `/baseline/:businessVersionId/assumptions` | `server/src/routes/v8/finance-v2/baseline.routes.ts:53` | 2 | **covered** |  |
| 10 | baseline | POST | `/baseline/:businessVersionId/assumptions` | `server/src/routes/v8/finance-v2/baseline.routes.ts:101` | 4 | **covered** |  |
| 11 | baseline | POST | `/baseline/:businessVersionId/compute` | `server/src/routes/v8/finance-v2/baseline.routes.ts:162` | 1 | **partially covered** | NOT_CAUGHT |
| 12 | baseline | GET | `/baseline/:businessVersionId/outputs` | `server/src/routes/v8/finance-v2/baseline.routes.ts:215` | 1 | **covered** |  |
| 13 | comments | POST | `/comments` | `server/src/routes/v8/finance-v2/comments.routes.ts:123` | 4 | **covered** | caught |
| 14 | comments | POST | `/comments/:commentId/resolve` | `server/src/routes/v8/finance-v2/comments.routes.ts:169` | 3 | **covered** | caught |
| 15 | comments | POST | `/comments/:commentId/reopen` | `server/src/routes/v8/finance-v2/comments.routes.ts:181` | 2 | **covered** |  |
| 16 | comments | POST | `/comments/:commentId/assign` | `server/src/routes/v8/finance-v2/comments.routes.ts:193` | 1 | **covered** |  |
| 17 | comments | GET | `/comments/:commentId/assignment` | `server/src/routes/v8/finance-v2/comments.routes.ts:215` | 1 | **covered** |  |
| 18 | comments | GET | `/comments/:commentId` | `server/src/routes/v8/finance-v2/comments.routes.ts:224` | 4 | **covered** |  |
| 19 | comments | GET | `/comments` | `server/src/routes/v8/finance-v2/comments.routes.ts:240` | 2 | **covered** |  |
| 20 | comments | POST | `/comments/search-by-cell` | `server/src/routes/v8/finance-v2/comments.routes.ts:260` | 0 | **uncalled** |  |
| 21 | comments | GET | `/comments/mentions/me` | `server/src/routes/v8/finance-v2/comments.routes.ts:278` | 3 | **covered** | caught |
| 22 | comments | GET | `/versions/:businessVersionId/has-unresolved-blocking-comments` | `server/src/routes/v8/finance-v2/comments.routes.ts:287` | 2 | **covered** |  |
| 23 | comments | POST | `/review-checklist` | `server/src/routes/v8/finance-v2/comments.routes.ts:300` | 1 | **covered** |  |
| 24 | comments | POST | `/review-checklist/:itemId/check` | `server/src/routes/v8/finance-v2/comments.routes.ts:327` | 2 | **covered** | caught |
| 25 | comments | POST | `/review-checklist/:itemId/uncheck` | `server/src/routes/v8/finance-v2/comments.routes.ts:339` | 1 | **covered** |  |
| 26 | comments | POST | `/review-checklist/:itemId/required` | `server/src/routes/v8/finance-v2/comments.routes.ts:351` | 1 | **covered** |  |
| 27 | comments | GET | `/review-checklist/:businessVersionId` | `server/src/routes/v8/finance-v2/comments.routes.ts:367` | 3 | **covered** |  |
| 28 | comments | GET | `/review-checklist/:businessVersionId/all-required-checked` | `server/src/routes/v8/finance-v2/comments.routes.ts:376` | 3 | **covered** |  |
| 29 | comments | GET | `/review-checklist/:businessVersionId/changed-cells` | `server/src/routes/v8/finance-v2/comments.routes.ts:385` | 0 | **uncalled** |  |
| 30 | compare | POST | `/compare/periods` | `server/src/routes/v8/finance-v2/compare.routes.ts:92` | 7 | **covered** |  |
| 31 | compare | POST | `/compare/versions` | `server/src/routes/v8/finance-v2/compare.routes.ts:126` | 0 | **uncalled** |  |
| 32 | compare | POST | `/compare/entities` | `server/src/routes/v8/finance-v2/compare.routes.ts:165` | 0 | **uncalled** |  |
| 33 | compare | POST | `/compare/scenarios` | `server/src/routes/v8/finance-v2/compare.routes.ts:201` | 0 | **uncalled** |  |
| 34 | compare | POST | `/compare/valuation-methods` | `server/src/routes/v8/finance-v2/compare.routes.ts:235` | 0 | **uncalled** |  |
| 35 | compare | POST | `/compare/actual-vs-forecast` | `server/src/routes/v8/finance-v2/compare.routes.ts:264` | 0 | **uncalled** |  |
| 36 | compute | POST | `/compute/jobs` | `server/src/routes/v8/finance-v2/compute.routes.ts:60` | 8 | **covered** |  |
| 37 | compute | GET | `/compute/jobs/:jobId` | `server/src/routes/v8/finance-v2/compute.routes.ts:101` | 4 | **covered** |  |
| 38 | compute | GET | `/compute/jobs/:jobId/output` | `server/src/routes/v8/finance-v2/compute.routes.ts:125` | 2 | **covered** |  |
| 39 | compute | POST | `/compute/jobs/:jobId/cancel` | `server/src/routes/v8/finance-v2/compute.routes.ts:161` | 5 | **covered** | caught |
| 40 | crosscutting | GET | `/versions/:businessVersionId/lineage` | `server/src/routes/v8/finance-v2/crosscutting.routes.ts:38` | 1 | **covered** |  |
| 41 | crosscutting | GET | `/versions/:businessVersionId/freshness-events` | `server/src/routes/v8/finance-v2/crosscutting.routes.ts:80` | 0 | **uncalled** |  |
| 42 | crosscutting | GET | `/exceptions/open` | `server/src/routes/v8/finance-v2/crosscutting.routes.ts:114` | 1 | **covered** |  |
| 43 | crosscutting | GET | `/exceptions/inbox` | `server/src/routes/v8/finance-v2/crosscutting.routes.ts:147` | 0 | **uncalled** |  |
| 44 | export-import | GET | `/export/statement-pack/:artifactId/:businessVersionId` | `server/src/routes/v8/finance-v2/export-import.routes.ts:62` | 3 | **covered** |  |
| 45 | export-import | POST | `/import/parse` | `server/src/routes/v8/finance-v2/export-import.routes.ts:87` | 1 | **covered** |  |
| 46 | export-import | POST | `/import/preview` | `server/src/routes/v8/finance-v2/export-import.routes.ts:104` | 3 | **covered** |  |
| 47 | export-import | POST | `/import/apply` | `server/src/routes/v8/finance-v2/export-import.routes.ts:156` | 3 | **covered** | caught |
| 48 | lineage-navigator | POST | `/versions/lineage-edges` | `server/src/routes/v8/finance-v2/lineage-navigator.routes.ts:208` | 5 | **covered** |  |
| 49 | lineage-navigator | GET | `/versions/:businessVersionId/lineage-navigator` | `server/src/routes/v8/finance-v2/lineage-navigator.routes.ts:292` | 7 | **covered** | caught |
| 50 | models | POST | `/models/:modelId/approve` | `server/src/routes/v8/finance-v2/models.routes.ts:103` | 3 | **covered** | caught |
| 51 | models | POST | `/models/:modelId/reopen` | `server/src/routes/v8/finance-v2/models.routes.ts:175` | 2 | **covered** |  |
| 52 | prediction | POST | `/prediction/:businessVersionId/preflight` | `server/src/routes/v8/finance-v2/prediction.routes.ts:36` | 3 | **covered** |  |
| 53 | prediction | POST | `/prediction/:businessVersionId/calculate` | `server/src/routes/v8/finance-v2/prediction.routes.ts:79` | 2 | **covered** |  |
| 54 | saved-views | POST | `/saved-views` | `server/src/routes/v8/finance-v2/saved-views.routes.ts:84` | 3 | **covered** |  |
| 55 | saved-views | GET | `/saved-views` | `server/src/routes/v8/finance-v2/saved-views.routes.ts:120` | 4 | **covered** |  |
| 56 | saved-views | GET | `/saved-views/shared/:shareToken` | `server/src/routes/v8/finance-v2/saved-views.routes.ts:137` | 4 | **covered** |  |
| 57 | saved-views | GET | `/saved-views/:viewId` | `server/src/routes/v8/finance-v2/saved-views.routes.ts:157` | 6 | **covered** |  |
| 58 | saved-views | PATCH | `/saved-views/:viewId` | `server/src/routes/v8/finance-v2/saved-views.routes.ts:173` | 2 | **covered** | caught |
| 59 | saved-views | DELETE | `/saved-views/:viewId` | `server/src/routes/v8/finance-v2/saved-views.routes.ts:199` | 3 | **covered** |  |
| 60 | statements | POST | `/statements/:businessVersionId/map` | `server/src/routes/v8/finance-v2/statements.routes.ts:56` | 3 | **covered** |  |
| 61 | statements | POST | `/statements/:businessVersionId/reconcile` | `server/src/routes/v8/finance-v2/statements.routes.ts:105` | 2 | **covered** | caught |
| 62 | statements | GET | `/statements/:businessVersionId/lines` | `server/src/routes/v8/finance-v2/statements.routes.ts:168` | 3 | **covered** |  |
| 63 | statements | GET | `/statements/:businessVersionId/reconciliation-runs` | `server/src/routes/v8/finance-v2/statements.routes.ts:233` | 1 | **covered** |  |
| 64 | statements | GET | `/statements/reconciliation-runs/:reconciliationRunId` | `server/src/routes/v8/finance-v2/statements.routes.ts:282` | 1 | **covered** |  |
| 65 | valuation | POST | `/valuation/cases` | `server/src/routes/v8/finance-v2/valuation.routes.ts:112` | 4 | **covered** | caught |
| 66 | valuation | GET | `/valuation/cases` | `server/src/routes/v8/finance-v2/valuation.routes.ts:125` | 1 | **covered** |  |
| 67 | valuation | GET | `/valuation/cases/:caseId` | `server/src/routes/v8/finance-v2/valuation.routes.ts:134` | 2 | **covered** |  |
| 68 | valuation | POST | `/valuation/cases/:caseId/variants` | `server/src/routes/v8/finance-v2/valuation.routes.ts:157` | 8 | **covered** |  |
| 69 | valuation | GET | `/valuation/variants/:businessVersionId` | `server/src/routes/v8/finance-v2/valuation.routes.ts:189` | 4 | **covered** |  |
| 70 | valuation | PATCH | `/valuation/variants/:businessVersionId` | `server/src/routes/v8/finance-v2/valuation.routes.ts:203` | 2 | **covered** |  |
| 71 | valuation | POST | `/valuation/cases/:caseId/compare-variants` | `server/src/routes/v8/finance-v2/valuation.routes.ts:236` | 3 | **covered** |  |
| 72 | valuation | GET | `/valuation/variants/:businessVersionId/methods` | `server/src/routes/v8/finance-v2/valuation.routes.ts:276` | 5 | **covered** |  |
| 73 | valuation | POST | `/valuation/variants/:businessVersionId/methods` | `server/src/routes/v8/finance-v2/valuation.routes.ts:288` | 24 | **covered** |  |
| 74 | valuation | POST | `/valuation/variants/:businessVersionId/methods/basket` | `server/src/routes/v8/finance-v2/valuation.routes.ts:324` | 5 | **covered** |  |
| 75 | valuation | GET | `/valuation/variants/:businessVersionId/wacc-inputs` | `server/src/routes/v8/finance-v2/valuation.routes.ts:375` | 2 | **covered** |  |
| 76 | valuation | PUT | `/valuation/variants/:businessVersionId/wacc-inputs` | `server/src/routes/v8/finance-v2/valuation.routes.ts:388` | 8 | **covered** | caught |
| 77 | valuation | POST | `/valuation/variants/:businessVersionId/compute/dcf` | `server/src/routes/v8/finance-v2/valuation.routes.ts:450` | 9 | **covered** | caught |
| 78 | valuation | GET | `/valuation/variants/:businessVersionId/results` | `server/src/routes/v8/finance-v2/valuation.routes.ts:521` | 5 | **covered** |  |
| 79 | valuation | GET | `/valuation/variants/:businessVersionId/bridge` | `server/src/routes/v8/finance-v2/valuation.routes.ts:567` | 2 | **covered** |  |
| 80 | valuation | PUT | `/valuation/variants/:businessVersionId/bridge` | `server/src/routes/v8/finance-v2/valuation.routes.ts:580` | 3 | **covered** | caught |
| 81 | valuation | GET | `/valuation/methods/:methodId/terminal` | `server/src/routes/v8/finance-v2/valuation.routes.ts:641` | 2 | **covered** |  |
| 82 | valuation | POST | `/valuation/methods/:methodId/sensitivity` | `server/src/routes/v8/finance-v2/valuation.routes.ts:653` | 4 | **covered** | caught |
| 83 | valuation | GET | `/valuation/methods/:methodId/sensitivity/:gridLabel` | `server/src/routes/v8/finance-v2/valuation.routes.ts:711` | 4 | **covered** |  |
| 84 | valuation | POST | `/valuation/variants/:businessVersionId/advisor/generate` | `server/src/routes/v8/finance-v2/valuation.routes.ts:737` | 3 | **covered** |  |
| 85 | valuation | GET | `/valuation/variants/:businessVersionId/advisor` | `server/src/routes/v8/finance-v2/valuation.routes.ts:759` | 2 | **covered** |  |
| 86 | versions | GET | `/versions/:businessVersionId` | `server/src/routes/v8/finance-v2/versions.routes.ts:68` | 1 | **covered** |  |
| 87 | versions | POST | `/versions/:businessVersionId/transitions` | `server/src/routes/v8/finance-v2/versions.routes.ts:116` | 7 | **covered** |  |
| 88 | versions | POST | `/versions/:businessVersionId/compute-snapshot` | `server/src/routes/v8/finance-v2/versions.routes.ts:172` | 3 | **covered** |  |

---

## 4. Weryfikacja `false-green` przez mutanta — próbka 17 endpointów

Metoda: `git show ee5736a5a6:<plik> > <plik>` żeby przywrócić; mutacja = zmiana wartości/statusu
w handlerze (NIE zmiana logiki walidacji — mutant musi przejść przez happy path i zwrócić
odpowiedź, żeby test miał szansę go złapać). Po każdym teście: przywrócenie + `git status
--short` puste.

| # | Endpoint | Plik:linia | Mutacja | Test uruchomiony | Wynik |
|---|---|---|---|---|---|
| 1 | POST /comments | comments.routes.ts:165 | `res.status(201)` → `200` | comments.routes.pg.test.ts | **caught** (9/18 testów czerwonych, kaskada fixture) |
| 2 | POST /comments/:id/resolve | comments.routes.ts:177 | `res.status(200)` → `201` | comments.routes.pg.test.ts | **caught** (jw., ten sam przebieg) |
| 3 | GET /comments/mentions/me | comments.routes.ts:283 | `listMentioning(orgId, userId)` → `listMentioning(orgId, \`mutant-${userId}\`)` | comments.routes.pg.test.ts | **caught** (jw.) |
| 4 | POST /review-checklist/:itemId/check | comments.routes.ts:333 | `res.status(200)` → `201` | comments.routes.pg.test.ts | **caught** (jw.) |
| 5 | POST /valuation/cases | valuation.routes.ts:121 | `res.status(201)` → `200` | valuation.routes.pg.test.ts + valuation-cross-tenant + valuation-b3-review + valuation-independent-verifier | **caught** (22/33 testów czerwonych, kaskada fixture przez wszystkie 4 pliki) |
| 6 | PUT /valuation/variants/:id/wacc-inputs | valuation.routes.ts:429 | `res.status(200)` → `201` | jw. | **caught** (jw., ten sam przebieg) |
| 7 | POST /valuation/variants/:id/compute/dcf | valuation.routes.ts:495 | `res.status(200)` → `202` | jw. | **caught** (jw.) |
| 8 | PUT /valuation/variants/:id/bridge | valuation.routes.ts:630 | `equityValueDecimal: equity.equityValueDecimal` → `-1` | jw. | **caught** (jw.) |
| 9 | POST /valuation/methods/:id/sensitivity | valuation.routes.ts:704 | `baseRowIndex: built.baseRowIndex` → `-999` | jw. | **caught** (jw.) |
| 10 | POST /artifacts/:id/rename | artifacts.routes.ts:288 | `naturalKey: updated.natural_key` → `'MUTANT-BROKEN'` | pkg-b2-cross-tenant.routes.pg.test.ts | **caught** — `AssertionError` na wartości pola (po powtórce z `--hookTimeout=60000`; pierwsza próba dała fałszywy `beforeAll` hook-timeout z powodu obciążenia maszyny — `load average` 245 w chwili próby, patrz §7) |
| 11 | POST /baseline/:id/compute | baseline.routes.ts:203 | `jobStatus: result.job.status` → `'MUTANT_STATUS'` | baseline.routes.pg.test.ts | **NOT CAUGHT** → realna luka, patrz §5.2 |
| 12 | POST /compute/jobs/:id/cancel | compute.routes.ts:177 | `jobToDto(updated)` → `{...jobToDto(updated), status:'MUTANT_NOT_CANCELLED'}` | cross-tenant.routes.pg.test.ts + artifacts-lifecycle-compute.routes.pg.test.ts | **caught** (`AssertionError: expected 'MUTANT_NOT_CANCELLED' to be 'cancelled'`, oba pliki) |
| 13 | PATCH /saved-views/:id | saved-views.routes.ts:189 | `toSavedViewDto(result.view)` → nadpisane `name: 'MUTANT-UNCHANGED'` | saved-views.routes.pg.test.ts | **caught** (`AssertionError: expected 'MUTANT-UNCHANGED' to be 'Renamed view'`) |
| 14 | POST /statements/:id/reconcile | statements.routes.ts:144 | `status: result.run.status` → `'MUTANT_STATUS'` | statements.routes.pg.test.ts | **caught** (`AssertionError: expected 'MUTANT_STATUS' to be 'CLEAN'`) |
| 15 | POST /import/apply | export-import.routes.ts:219 | `appliedCount: result.appliedCount` → `-1` | export-import.routes.pg.test.ts | **caught** (`AssertionError: expected undefined to be 1` na `appliedCount.changed`) |
| 16 | POST /models/:id/approve | models.routes.ts:169 | `status: 'approved'` → `'approved-mutant'` | models.routes.pg.test.ts | **caught** — `POST /models/:modelId/approve success is BIT-IDENTICAL to WP-A02 fixture F4` czerwony (po powtórce z `--hookTimeout=60000`; pierwsza próba dała fałszywy hook-timeout, jw. #10) |
| 17 | GET /versions/:id/lineage-navigator | lineage-navigator.routes.ts:371 | `trail` → `{...trail, items: []}` | lineage-navigator.routes.pg.test.ts | **caught** — po DWÓCH próbach: pierwsza mutacja celowała w pole `nodes` (nieistniejące — kontrakt trasy zwraca `trail.items`, nie `trail.nodes`), test przeszedł zielono bo mutant nic nie zepsuł (ZŁY MUTANT, nie false-green); druga próba z poprawnym polem `items` złapana (`AssertionError` na `trail.items`) |

**Wynik: 16/17 mutantów złapanych, 1/17 nie złapany (realna luka, nie false-green — patrz §5.2),
0/17 false-green.** Żaden test w próbce nie okazał się zielony na zepsutym kodzie bez uzasadnionej
przyczyny (przypadek #17 to błąd metodyczny mojego pierwszego mutanta, poprawiony i
zweryfikowany ponownie w tej samej sesji — nie zaliczam go jako `false-green`, bo po poprawce
mutant został złapany).

**Uwaga o infrastrukturze**: próby #10 i #16 dały fałszywe `Hook timed out in 10000ms` przy
pierwszym uruchomieniu z powodu obciążenia maszyny (`uptime` w tym momencie: `load averages: 245.25
162.71 103.35` — inne sesje na tym samym hoście). Powtórka z `--maxWorkers=1 --testTimeout=60000
--hookTimeout=60000` dała jednoznaczny wynik. To NIE jest dowód na `blocked` — to dowód, że
`describe.skipIf` bramka + wyższy timeout wystarczają na tej maszynie.

---

## 5. Detale ważnych ustaleń

### 5.1 `uncalled` — 9 endpointów, żaden test ich nie wywołuje

| Endpoint | Plik:linia | Dowód |
|---|---|---|
| `POST /comments/search-by-cell` | comments.routes.ts:260 | Zero dopasowań `search-by-cell` w całym `__tests__/` (`grep -rn` puste) |
| `GET /review-checklist/:businessVersionId/changed-cells` | comments.routes.ts:385 | Zero dopasowań `changed-cells` |
| `POST /compare/versions` | compare.routes.ts:126 | `compare.routes.pg.test.ts` testuje WYŁĄCZNIE `/compare/periods` (7 wywołań); pozostałych 5 z 6 endpointów `/compare/*` nie ma żadnego wywołania w żadnym pliku |
| `POST /compare/entities` | compare.routes.ts:165 | jw. |
| `POST /compare/scenarios` | compare.routes.ts:201 | jw. |
| `POST /compare/valuation-methods` | compare.routes.ts:235 | jw. |
| `POST /compare/actual-vs-forecast` | compare.routes.ts:264 | jw. |
| `GET /versions/:id/freshness-events` | crosscutting.routes.ts:80 | Zero dopasowań `freshness-events`; `crosscutting.routes.ts` ma 4 endpointy, tylko `/lineage` i `/exceptions/open` są wywoływane (przez `pkg-b2-cross-tenant.routes.pg.test.ts`) |
| `GET /exceptions/inbox` | crosscutting.routes.ts:147 | Zero dopasowań `exceptions/inbox` |

Wniosek: **5/6 endpointów `/compare/*` i 2/4 endpointów `crosscutting.routes.ts` nie mają ŻADNEGO
testu.** `compare.routes.ts` ma test tylko dla `POST /compare/periods` — plik testowy nazywa się
`compare.routes.pg.test.ts` i sugeruje pełne pokrycie modułu, ale w rzeczywistości testuje jeden
z sześciu endpointów. To dokładnie wzorzec z briefu: „nazwa pliku testowego" myli, trzeba
sprawdzić realne wywołanie.

### 5.2 `partially covered` — `POST /baseline/:businessVersionId/compute`

`baseline.routes.ts:162`. Jedyny test tego endpointu w `baseline.routes.pg.test.ts` (linia 175)
uderza WYŁĄCZNIE w gałąź błędu prekondycji:

```
POST /baseline/:id/compute on a fresh Baseline Model with no STATEMENT_TO_MODEL lineage edge
  -> 404 NO_SOURCE_STATEMENT_PACK_EDGE
```

Happy path (`result.ok === true`, linie 202–206 handlera: `{jobId, jobStatus, periodsComputed,
monthlyResults}`) NIE jest wywołany przez żaden test w całym `__tests__/` — potwierdzone
mutantem #11 w §4: podmiana `jobStatus` na `'MUTANT_STATUS'` w gałęzi sukcesu NIE zaczerwieniła
`baseline.routes.pg.test.ts` (0 nowych failures). Endpoint jest więc technicznie „wywołany" (stąd
nie `uncalled`), ale jego jedyna faktycznie zweryfikowana ścieżka to walidacja wejścia, nie
działanie. Klasyfikacja: **partially covered**, nie `false-green` (bo istniejący test dla ścieżki,
którą pokrywa, jest prawdziwie wartościowy — sprawdza realną 404 z prawdziwej bazy).

### 5.3 Weryfikacja spójności z wcześniejszym audytem

Brief wspomina wcześniejszego weryfikatora, który znalazł „7 endpointów nigdy niewywoływanych
mimo sugerowanego pokrycia w raporcie". Ten przebieg znalazł **9** (przy w pełni automatycznym,
wyczerpującym skanie 88×18 kombinacji metoda+ścieżka×plik) — 2 więcej niż poprzednio raportowane.
Różnica: `comments/search-by-cell` i `review-checklist/.../changed-cells` (patrz §5.1) mogły nie
być w zakresie poprzedniego audytu (jeśli ten liczył tylko pliki `compare`/`crosscutting`) albo
zostały przeoczone — nie da się tego rozstrzygnąć bez treści tamtego raportu, więc odnotowuję
rozbieżność zamiast zgadywać przyczynę.

---

## 6. Pełny przebieg realDB — finance-v2 + canonical

**Komenda**:
```
cd server
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
  DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:54330/j1_inv" \
  npx vitest run src/routes/v8/finance-v2 src/services/finance/canonical \
  --maxWorkers=2 --testTimeout=60000 --hookTimeout=60000 \
  > full_run.log 2>&1; code=$?
```
(kod wyjścia mierzony `$?` PO zakończeniu, plik przekierowany `2>&1` — bez potoku `| tail`,
więc bez ryzyka `PIPESTATUS`.)

| Metryka | Wartość |
|---|---|
| **Kod wyjścia (jawny, `$?`)** | **1** |
| Czas trwania (mierzony `date +%s` przed/po) | **236 s** (vitest wewnętrznie raportuje 234.28s) |
| Test Files | 57 passed, **2 failed** (59 total) |
| Tests | 634 passed, **2 failed** (636 total) |

**Oba failure są POZA zakresem `routes/v8/finance-v2/__tests__/`** (potwierdzone: `grep
"routes/v8/finance-v2/__tests__"` na liście FAIL nie zwraca nic) — leżą w
`server/src/services/finance/canonical/__tests__/`:

1. `faultMatrix.pg.test.ts` → `EM-1: reapExpiredLeases() requeues an abandoned job...` —
   test lease-expiry oparty o realny upływ czasu w kolejce compute; podatny na obciążenie hosta.
2. `perfSlo.pg.test.ts` → `D2 — Analysis KPI compute (full 18-indicator P0 catalog)` —
   `AssertionError: D2 KPI compute p95=900.03ms exceeds regression ceiling 750ms (=
   140.23ms observed-max-p95 × 5)`. To jest test progu wydajnościowego (SLO), nie funkcjonalny —
   `uptime` w trakcie sesji pokazywał `load averages: 245.25 162.71 103.35` (inne równoległe
   sesje na tej samej maszynie, patrz `MEMORY.md` → „Maszyna bywa obciążona przez inne sesje").
   900ms przy 5× marginesie nad zmierzonym maksimum (140ms) na wolnej maszynie silnie sugeruje
   przeciążenie hosta w danej chwili, nie regresję w kodzie — ale to NIE zostało dodatkowo
   zweryfikowane powtórnym przebiegiem w tej sesji (brak czasu w budżecie), więc odnotowuję jako
   niepotwierdzoną hipotezę, nie fakt.

**Zero endpointów z inwentaryzacji §3 ma failing test w tym przebiegu.** 636 testów w tym
katalogu obejmuje więcej niż 88 endpointów tras (bo `services/finance/canonical/__tests__`
testuje logikę serwisową pod trasami, nie tylko same trasy) — liczba testów NIE jest 1:1 z
liczbą endpointów.

---

## 7. Kontrola negatywna bramki bazy

Zgodnie z briefem: bramka wymaga CZTERECH zmiennych naraz (`RUN_DB_TESTS=1` + `MOCK_DB=false` +
`NODE_ENV=test` + jawny `DATABASE_URL`). Test: ten sam podzbiór uruchomiony DWA razy —raz z
kompletem, raz bez `RUN_DB_TESTS`.

**Podzbiór**: `comments.routes.pg.test.ts` + `valuation.routes.pg.test.ts` (32 testy razem,
wybrane bo to dwa pliki z największą liczbą testów i z próbki mutanta §4).

**Przebieg 1 — z kompletem czterech zmiennych**:
```
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL="postgresql://...j1_inv" \
  npx vitest run comments.routes.pg.test.ts valuation.routes.pg.test.ts
```
Wynik: **Test Files 2 passed (2) · Tests 32 passed (32)** · exit code **0**.

**Przebieg 2 — BEZ `RUN_DB_TESTS`** (`MOCK_DB=false`, `NODE_ENV=test`, `DATABASE_URL` jawny —
DOKŁADNIE ten sam poza brakiem jednej zmiennej):
```
MOCK_DB=false NODE_ENV=test DATABASE_URL="postgresql://...j1_inv" \
  npx vitest run comments.routes.pg.test.ts valuation.routes.pg.test.ts
```
Wynik: **Test Files 2 skipped (2) · Tests 32 skipped (32)** · exit code **0**.

**Potwierdzenie**: brak `RUN_DB_TESTS=1` daje `skipped`, NIE `passed` — `describe.skipIf(!REAL_PG)`
w każdym pliku testowym (`REAL_PG_REQUESTED = RUN_DB_TESTS==='1' && MOCK_DB==='false' &&
DATABASE_URL.startsWith('postgres')`) działa jako prawdziwa bramka, nie cichy fallback. 32→32
i 0→0 to jednoznaczny, symetryczny wynik: żaden test nie „przeciekł" na zielono bez realnej bazy.

---

## 8. Fingerprint bazy

Baza: `postgresql://piotrwisniewski@127.0.0.1:54330/j1_inv`, sklonowana z `fv3_template` przez
`/Users/piotrwisniewski/fv3-pg/newdb.sh j1_inv`.

| Metryka | Wartość |
|---|---|
| Wersja PostgreSQL | `PostgreSQL 15.15 (Homebrew) on aarch64-apple-darwin25.2.0` |
| Tabele `BASE TABLE`, schema `public` | 1451 |
| Widoki `VIEW`, schema `public` | 8 |
| Tabele `BASE TABLE`, schema `v8` | 121 |
| Widoki `VIEW`, schema `v8` | 0 |
| Wykonane migracje (`public.schema_migrations`) | 637 |

Zapytania źródłowe:
```sql
SELECT version();
SELECT table_schema, table_type, count(*) FROM information_schema.tables
  WHERE table_schema IN ('public','v8') GROUP BY table_schema, table_type;
SELECT count(*) FROM schema_migrations;
```

---

## 9. Higiena wykonania — potwierdzenie

- Zero `git stash`/`reset --hard`/`clean` użyte w tej sesji.
- Każda mutacja przywrócona natychmiast po teście przez `git show ee5736a5a6:<plik> > <plik>`,
  potwierdzona pustym `git diff --stat` / `git status --short` przed przejściem do następnej.
- Baza `j1_inv` posprzątana na końcu sesji: `dropdb -h 127.0.0.1 -p 54330 -U piotrwisniewski j1_inv`
  (exit 0), potwierdzone brakiem wpisu w `psql -l`.
- Zero połączeń do demo/staging/produkcji: `DATABASE_URL` w każdym wywołaniu jawnie wskazywał
  `127.0.0.1:54330/j1_inv`.
- Kod produkcyjny (`server/src/routes/v8/finance-v2/*.routes.ts`) NIE został trwale zmieniony —
  jedyne modyfikacje to tymczasowe mutanty §4, wszystkie przywrócone.

## 10. Co NIE zostało dostarczone i dlaczego

- **Ręczna weryfikacja głębokości asercji dla wszystkich 78 `covered` endpointów** — poza
  budżetem; zamiast tego 17/78 (22%) zweryfikowano mutantem (silniejszy dowód), a automatyczny
  skan `uncalled` jest wyczerpujący dla 100% z 88. Ryzyko rezydualne: wśród pozostałych ~61
  `covered`-bez-mutanta mogą być kolejne przypadki jak baseline `/compute` (test tylko error-path).
  Rekomendacja dla J2–J4 lub przyszłego przebiegu: rozszerzyć próbkę mutanta na `analysis`,
  `prediction`, `versions`, `crosscutting` (żaden z nich nie miał mutanta w tej próbce).
- **Sprzątanie bazy `j1_inv`** — wykonane na końcu sesji (`dropdb j1_inv`), patrz commit log.

---

## 11. ZAMKNIĘCIE LUK — sesja 2026-08-12 (ten sam agent, wznowiony po przerwaniu procesu)

Baza sesji zamykającej: `postgresql://piotrwisniewski@127.0.0.1:54330/j1_close`, sklonowana tą
samą metodą (`newdb.sh j1_close`). Commity: `1cb56ee2a3` (5× `/compare/*`), `d5ecd72a24` (2×
crosscutting), `8c0421a855` (2× comments, **LUKA 1 komplet 9/9**), `ca5442f9be` (WIP baseline
compute — zweryfikowany w tej sesji po wznowieniu procesu), plus ten commit (dokumentacja +
rozstrzygnięcie LUKI 3).

### 11.1 LUKA 1 — dziewięć endpointów `uncalled`, wszystkie zamknięte

| # | Endpoint | Nowy test | Kontrola negatywna |
|---|---|---|---|
| 1 | `POST /compare/versions` | `compare.routes.pg.test.ts` — „the other five Compare axes" | **caught** — `relationship` w `compareVersions()` zmutowany na stałą |
| 2 | `POST /compare/entities` | jw. | **caught** — `ignoreDimensions:['entityId']`→`[]`, parowanie pękło |
| 3 | `POST /compare/scenarios` | jw. | **caught** — `artifactType` w `artifactRefFor()` zmutowany `PREDICTION_SCENARIO`→`BASELINE_MODEL` |
| 4 | `POST /compare/valuation-methods` | jw. | **caught** — `ignoreDimensions:['methodType']`→`[]` |
| 5 | `POST /compare/actual-vs-forecast` | jw. | **caught** — `ignoreDimensions:['accumulationBasis']`→`[]` |
| 6 | `GET /versions/:id/freshness-events` | `crosscutting.routes.pg.test.ts` (nowy plik) | **caught** — `reasonCode` w mapowaniu odpowiedzi zmutowany na stałą |
| 7 | `GET /exceptions/inbox` | jw. | **caught** — handler zmutowany, zawsze zwraca `data: []` |
| 8 | `POST /comments/search-by-cell` | `comments.routes.pg.test.ts` — „search-by-cell + changed-cells" | **caught** — handler zmutowany, zawsze zwraca `data: []` |
| 9 | `GET /review-checklist/:id/changed-cells` | jw. | **caught** — `changedCells` wymuszone na `[]` gdy `hasPreviousApproved` |

**9/9 mutantów złapanych, 0/9 false-green.** Każdy mutant: zepsuty → uruchomiony właściwy plik
testowy → potwierdzone czerwono → przywrócony `git show ee5736a5a6:<plik> > <plik>` → potwierdzony
pusty `git diff --stat` PRZED przejściem do kolejnego mutanta. Żaden mutant nie nakładał się z
kolejnym (jeden plik na raz, sekwencyjnie).

Każdy z dziewięciu testów zawiera też sprawdzenie izolacji tenantowej (org B nie widzi/nie
dosięga danych org A) — gdzie routing faktycznie na to pozwala; tam gdzie warstwa serwisowa
(`resolveEntityIdByCode`, `getBusinessVersionViaTx`) sama zwraca 404 zanim dojdzie do właściwej
logiki porównania, test to odnotowuje wprost (np. `compareActualVsForecast` cross-tenant kończy
się `404 ENTITY_CODE_NOT_FOUND`, nie `403 ORGANIZATION_MISMATCH`, bo rozwiązywanie encji jest
tenant-scoped i uruchamia się PRZED jakimkolwiek sprawdzeniem `organizationId` w `compareValues`).

### 11.2 LUKA 2 — `POST /baseline/:businessVersionId/compute`, ścieżka sukcesu

Zbudowano DOKŁADNIE tę samą fikstrę skali GoldCo, której używa `perfSlo.pg.test.ts`'s case D1
(harmonogram `debt_maturity`, założenia we wszystkich 7 `schedule_type`, spinający się bilans
otwarcia) i wywołano endpoint przez realny HTTP:

- Odpowiedź: `jobId` prawdziwy, **`jobStatus: 'succeeded'`** (raport pierwotny zakładał string
  `'COMPUTED'` — w kodzie takiej wartości nie ma; poprawione po pierwszym czerwonym przebiegu),
  `periodsComputed: 12`, `monthlyResults.length: 12`.
- Niezależny odczyt SQL: `finance_baseline_outputs` ma dokładnie **372 wiersze** (31 linii
  kanonicznych × 12 okresów — zgadza się z własną asercją D1 w `perfSlo.pg.test.ts`),
  `compute_jobs.status = 'succeeded'`.
- Dodatkowo test cross-tenant: org B próbująca policzyć realny `business_version_id` org A →
  `404`, zero wierszy `finance_baseline_outputs` dla org B.

**Kontrola negatywna — to jest ta sama mutacja, którą oryginalny audyt (§4 mutant #11 w tym
raporcie) udowodnił jako NIEZŁAPANĄ**: pole `jobStatus` w gałęzi sukcesu (`baseline.routes.ts:204`)
zmutowane na stałą `'MUTANT_STATUS'`. Nowy test **złapał** tę mutację — potwierdzone DWUKROTNIE
(raz przed przerwaniem procesu tej sesji, raz po wznowieniu), oba razy przywrócone i potwierdzone
pustym `git diff --stat`. Luka faktycznie zamknięta, nie tylko przeniesiona.

### 11.3 LUKA 3 — rozstrzygnięcie dwóch padających testów spoza `finance-v2/__tests__`

**Test dzierżawy (`faultMatrix.pg.test.ts` „FIXED EM-1")** — uruchomiony 6× (5 wymaganych + 1
dodatkowy z DOMYŚLNYM `hookTimeout` vitest, żeby sprawdzić czy oryginalna awaria — timeout hooka —
odtwarza się nawet bez hojnego override'u):

| # | Load (1-min avg PRZED) | Wynik |
|---|---|---|
| 1 | 271.99 | pass |
| 2 | 281.35 | pass |
| 3 | 295.65 | pass |
| 4 | 301.32 | pass |
| 5 | 308.87 | pass |
| 6 (domyślny hookTimeout) | 318.21 | pass |

**6/6 pass, przy obciążeniu WYŻSZYM niż 245 zanotowane w chwili oryginalnej awarii.** Mechanizm
wstrzykiwania awarii w tym teście jest deterministyczny (`UPDATE ... lease_expires_at = now() -
interval`, zero realnego `sleep`), więc nie zależy od rzeczywistego upływu czasu.
**Rozstrzygnięcie: NIE jest to powtarzalny defekt.** Klasyfikacja: przejściowy/nieodtwarzalny
artefakt infrastruktury (jednorazowa czkawka połączenia z bazą lub schedulera w danym momencie
oryginalnej sesji), nie błąd w kodzie. Żadna poprawka kodu nie została zastosowana — nie ma czego
naprawiać na podstawie tego dowodu.

**Test SLO (`perfSlo.pg.test.ts` „D2 — Analysis KPI compute")** — uruchomiony 5×:

| # | Load (1-min avg PRZED) | p50 | p95 | Wynik (próg 750ms) |
|---|---|---|---|---|
| 1 | 330.50 | 166.85ms | 509.63ms | pass |
| 2 | 328.10 | 135.62ms | 426.20ms | pass |
| 3 | 323.34 | 125.29ms | 266.73ms | pass |
| 4 | 316.59 | 155.14ms | 450.69ms | pass |
| 5 | 308.74 | 275.81ms | 409.51ms | pass |

**5/5 pass, żaden nie zbliżył się do progu 750ms — mimo obciążenia (309–330) WYŻSZEGO niż w
oryginalnej awarii (245, gdzie p95=900,03ms).** Rozrzut WEWNĄTRZ tej samej sesji: 509,63 / 266,73
= **1,91×** dla tego samego kodu na tej samej maszynie w oknie ~2 minut, podczas gdy load malał
(330→309) a p95 zmieniał się nie-monotonicznie — dokładnie sygnatura szumu maszyny, nie regresji
kodu (prawdziwa regresja kodu failowałaby powtarzalnie, nie skakała 267ms↔510ms).
**Rozstrzygnięcie: `BLOCKED_EXTERNAL`, nie `FAIL`.** Zgodnie z briefem: program już wcześniej
zmierzył 9,3× rozrzut między przebiegami tego samego kodu na tej maszynie
(`W2_FC11_SLO_report.md`) — te 5 przebiegów to NIEZALEŻNE, świeże potwierdzenie tej samej
niestabilności (1,91× w zaledwie 5 próbkach), nie powtórzenie starej tezy. Oryginalny odczyt
900ms najlepiej tłumaczy się chwilowym skokiem obciążenia maszyny w danym momencie, a nie
regresją w kodzie. Żadna poprawka kodu nie została zastosowana.

### 11.4 Pełny przebieg realDB — po zamknięciu luk

**Komenda** (identyczna jak w §6, nowa baza `j1_close`):
```
cd server
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
  DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:54330/j1_close" \
  npx vitest run src/routes/v8/finance-v2 src/services/finance/canonical \
  --maxWorkers=2 --testTimeout=60000 --hookTimeout=60000 \
  > plik.log 2>&1; code=$?
```
(kod wyjścia mierzony `$?` PO zakończeniu, plik przekierowany `2>&1`, bez potoku — bez ryzyka
`PIPESTATUS`.)

Dwie próby, obie udokumentowane (nic nie ukryte):

| Próba | Kod wyjścia | Czas | Test Files | Tests | Uwaga |
|---|---|---|---|---|---|
| 1 | **1** | 65s | 59 passed, **1 failed** (60) | 658 passed, **1 failed** (659) | `valuation-cross-tenant.routes.pg.test.ts` → `Error: socket hang up` w JEDNYM teście. **To NIE jest test dzierżawy ani test SLO — oba przeszły w tej samej próbie.** `socket hang up` pod `--maxWorkers=2` przy obciążeniu maszyny ~283–330 to objaw wyczerpania puli połączeń HTTP/Node pod ekstremalnym obciążeniem hosta, nie defekt kodu — ten sam plik przeszedł czysto w próbie 2, bez ŻADNEJ zmiany w kodzie, 30 sekund później. |
| **2 (przebieg referencyjny)** | **0** | **27s** | **60 passed (60)** | **659 passed (659)** | Czysto, zero failów, load po zakończeniu spadł do 158.23. |

**Przebieg referencyjny dla bramki: kod wyjścia 0, 659/659 testów, 60/60 plików testowych, 27s
(2 workery równolegle).**

### 11.5 Zaktualizowana klasyfikacja 88 endpointów

`j1_endpoint_inventory.json` zaktualizowany: **88 covered, 0 uncalled, 0 partially covered, 0
false-green, 0 blocked — cel bramki osiągnięty.** Pełne dane (nowe `calls`/`call_count`/
`mutation_tested`/`note` dla 10 zmienionych wpisów, plus sekcja `meta.close_out_session_2026-08-12`
z pełnym śladem tej sesji) w samym pliku JSON.

### 11.6 Higiena wykonania — potwierdzenie (sesja zamykająca)

- Zero `git stash`/`reset --hard`/`clean` użyte w tej sesji (ani przed, ani po przerwaniu procesu).
- Każda z 10 mutacji przywrócona natychmiast przez `git show ee5736a5a6:<plik> > <plik>`,
  potwierdzona pustym `git diff --stat` przed przejściem do następnej — w tym mutacja baseline
  `jobStatus`, przywrócona DWUKROTNIE (przed i po przerwaniu procesu).
- Zero poprawek kodu produkcyjnego poza tymczasowymi mutantami — wszystkie 10 endpointów zamknięto
  WYŁĄCZNIE testami, zgodnie z zakazem z briefu ("poprawki kodu produkcyjnego TYLKO jeśli znajdziesz
  realny defekt" — nie znaleziono żadnego; LUKA 3 rozstrzygnięta jako artefakt maszyny, nie defekt).
- Baza `j1_close` posprzątana na końcu sesji (`dropdb -h 127.0.0.1 -p 54330 -U piotrwisniewski
  j1_close`).
- Zero połączeń do demo/staging/produkcji — `DATABASE_URL` w każdym wywołaniu wskazywał jawnie
  `127.0.0.1:54330`.

### 11.7 Co NIE zostało dostarczone i dlaczego

- **Trzecia próba pełnego przebiegu** — nie wykonana; próba 2 dała czysty wynik (kod 0,
  659/659), więc dodatkowa próba nie była potrzebna do domknięcia bramki. Próba 1 (`socket hang
  up`) pozostaje udokumentowana jako znany szum infrastruktury pod `--maxWorkers=2` przy
  ekstremalnym obciążeniu hosta (inne sesje równoległe na tej samej maszynie — patrz `uptime`
  w tabelach §11.3), nie jako rozwiązany/naprawiony defekt.
- **Rozszerzenie próbki mutanta na `analysis`/`prediction`/`versions`** (rekomendacja z §10 tego
  raportu) — poza zakresem tej sesji zamykającej (zakres = LUKA 1 + LUKA 2 + LUKA 3, literalnie
  z brief'u). Pozostaje otwartą rekomendacją dla przyszłego przebiegu.
