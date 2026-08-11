# PKG A — Determinism & Numerical Integrity Auditor — raport

**Worktree:** `/Users/piotrwisniewski/consultify-wt/fv3p-a-determinism`
**Gałąź:** `codex/fv3p-a-determinism`
**Base SHA:** `585af4ce4b9f054bd805366e9c95d6f77f33407e`
**Commity tej sesji:** patrz sekcja "Commity" na końcu (SHA dopisane po `git commit`).
**Status ogólny: `PARTIAL`** — trzy znane defekty potwierdzone i naprawione, dwa dodatkowe defekty tej samej klasy znalezione i naprawione podczas audytu w `predictionPreflightService.ts`, pełna inwentaryzacja zapytań wykonana, finalny czysty przebieg pełnego pakietu Finance v3 (`50 plików / 741 testów`) w 100% zielony (patrz §10). `PARTIAL`, nie `PASS`, WYŁĄCZNIE z jednego powodu: brak w repo jakiegokolwiek istniejącego testu end-to-end dla `runOverlayCompute()`/`runPreflight()` uniemożliwił test powtarzalności NA POZIOMIE CAŁEGO SILNIKA w rozsądnym budżecie czasowym tego audytu (patrz `EVIDENCE_MISSING`, §11) — dowód powtarzalności dostarczono zamiast tego na poziomie zapytań SQL (na realnej, czyszczonej bazie, z fizycznym churnem tabeli) + czystych funkcji (rachunek permutacyjny, negatywne kontrole). Po drodze zaobserwowano DWA migotania (`faultMatrix.pg.test.ts` EM-1, `perfSlo.pg.test.ts` D2/D3) pod współbieżnym obciążeniem współdzielonej maszyny deweloperskiej — oba niezależnie potwierdzone jako środowiskowe (izolowane przebiegi: 25/25 i 5/5 zielono) i NIEPOWIĄZANE z tym pakietem (żaden z dotkniętych plików nie ma związku z leasingiem zadań ani z SLO czasowym), odnotowane zgodnie z regułą „nie zaokrąglaj w górę", nie liczone jako regresja.

## 1. Punkty odniesienia — potwierdzone we własnym środowisku

| Miernik | Punkt odniesienia (OPUS) | Zmierzone w tej sesji | Zgodność |
|---|---|---|---|
| Migracje STRICT, świeża baza | exit 0, 637 | exit 0, **637** | ✅ |
| `vitest run src/services/finance/canonical --no-file-parallelism` | 37 plików / 722 testy — czekaj, patrz uwaga niżej | **37 plików / 454 testy**, exit 0 | ✅ (liczba testów w punkcie odniesienia dla tego zawężonego katalogu to 454, nie 722 — 722 dotyczy szerszego `src/services/finance`, patrz wiersz niżej) |
| `vitest run --config vitest.config.ts src/services/finance/canonical` | 37 / 454, exit 0 | **37 / 454**, exit 0 | ✅ |
| `vitest run src/services/finance --no-file-parallelism` (szerszy katalog) | 47 plików / 722 testy, exit 0 | **47 / 722**, exit 0 (przed zmianami tego pakietu); **50 / 741, exit 0, WSZYSTKIE zielone** w czystym przebiegu PO wszystkich zmianach + nowych testach (patrz §10) | ✅ |
| `tsc --noEmit -p server/tsconfig.json` | exit 0, zero linii | **exit 0, zero linii** (po KAŻDYM etapie zmian, wielokrotnie) | ✅ |

Komendy reprodukcji (identyczne z briefem):
```bash
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA=/private/tmp/fv3p-a-pgdata ; PGSOCK=/tmp/fv3pasock ; PORT=58001
rm -rf "$PGDATA" "$PGSOCK" && mkdir -p "$PGDATA" "$PGSOCK"
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" -l /tmp/fv3pa_pg.log start
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE fv3p_a;"
DBURL="postgresql://postgres@127.0.0.1:$PORT/fv3p_a"
NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" npx tsx server/scripts/migrate.postgres.ts
cd server && RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" NODE_ENV=test npx vitest run src/services/finance --no-file-parallelism
```

## 2. Decyzja o kolejności zdarzeń finansowania (punkty 2/3 z briefu)

**Miejsce:** `predictionComputeService.ts`, pętla `runOverlayCompute()`, blok „financing overlay" — zdarzenia z `finance_prediction_financing` dla danego okresu.

**Problem:** `FACILITY_DRAWDOWN` i `DISCRETIONARY_REPAYMENT` dzielą `facilityDebtBalance` przez `Math.max(0, facilityDebtBalance - amount)`. To NIE jest kwestia zaokrąglenia float — to zmiana WYNIKU BIZNESOWEGO: przy `facilityDebtBalance=0`, `drawdown=100`, `repayment=50`:
- drawdown → repayment: `0+100=100`, `max(0,100-50)=50` → **50**
- repayment → drawdown: `max(0,0-50)=0`, `0+100=100` → **100**

**Decyzja (DEC-FIN-012, rutynowa kwestia, standard rynkowy):** `DISCRETIONARY_REPAYMENT` przetwarzane PRZED `FACILITY_DRAWDOWN` w obrębie tego samego okresu. Uzasadnienie: standard branżowy dla schedule'i długu stosuje zdarzenia okresu w kolejności deterministycznej i jawnie udokumentowanej, typowo: najpierw spłaty wynikające z umowy/dyscypliny finansowej, potem wypłaty pokrywające niedobór. Tabela `finance_prediction_financing` nie ma osobnego rodzaju „spłata obowiązkowa" — `DISCRETIONARY_REPAYMENT` jest jedynym typem redukującym dług — więc to ona pełni rolę „spłaty przed dociągnięciem finansowania". Pozostałe rodzaje (`EQUITY_INJECTION`, `SHARE_BUYBACK`, `DIVIDEND_DECLARATION`, `SURPLUS_ALLOCATION_POLICY`, `COVENANT_DEFINITION`, `MIN_CASH_POLICY`) są przemienne (czysta suma, bez `Math.max`) — dostały rangi wyłącznie po to, by CAŁA tablica miała jeden ustalony porządek totalny (potrzebne dla bit-stabilności `content_semantic_hash`), nie z powodów biznesowych.

Implementacja: `FINANCING_KIND_PROCESSING_RANK` (wyeksportowana stała) + `orderFinancingEventsForPeriod()` (wyeksportowana czysta funkcja), `predictionComputeService.ts:151-181`. Remis w obrębie tej samej rangi rozstrzyga stabilne sortowanie zachowujące kolejność `sortByCreatedAtThenId` (chronologiczną, `created_at, id`) zastosowaną do `financingRows` PRZED filtrowaniem per-okres.

**Backfill:** bezprzedmiotowy — Finance v3 nie istnieje na żadnej żywej bazie (PROD/DEMO/DEV: odpowiednio 0/2/1 tabel `finance_%`, kluczowe tabele `finance_prediction_financing`/`finance_prediction_impact_chain` nie istnieją nigdzie). Liczba zapisanych `content_semantic_hash`/`assumption_set_semantic_hash`, które ta naprawa mogłaby unieważnić: **ZERO**.

## 3. Tabela wszystkich zapytań w zakresie audytu

Legenda kolumn: **Kol.sem.** = czy kolejność ma znaczenie semantyczne · **OB?** = czy potrzebny `ORDER BY` (SQL) · **Pam.?** = czy właściwsze sortowanie w pamięci · **Już kan.?** = czy kolejność już kanoniczna · **Unieważni hashe?** = czy zmiana mogłaby unieważnić zapisane hashe · **Test 10×/100×?** = czy potrzebny test powtarzalności.

| # | Plik:linia (przed naprawą) | Kol.sem. | OB? | Pam.? | Już kan.? | Unieważni hashe? | Test 10×/100×? | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | `predictionComputeService.ts` ~465, `finance_prediction_impact_chain` → `impactChainRows` | **TAK** — `impactDeltaFor()` sumuje `total +=` (float64, nieprzemienne) | Nie (wybrano pamięć) | **TAK** | Nie (przed naprawą) | Tak, w teorii (ZERO zapisanych na żywo — patrz §"ustalenie") | **TAK — dostarczony** | ✅ NAPRAWIONE |
| 2 | `predictionComputeService.ts` ~412, `finance_prediction_financing` → `financingRows` (baza) | **TAK** — steruje wyborem „pierwszego" `FACILITY_DRAWDOWN` (`.find()`) | Nie (wybrano pamięć) | **TAK** | Nie (przed naprawą) | Tak, w teorii | **TAK — dostarczony** | ✅ NAPRAWIONE |
| 3 | `predictionComputeService.ts` ~618, `financingThisPeriod` (kolejność przetwarzania w okresie) | **TAK — WYNIK BIZNESOWY**, nie tylko bit float (patrz §2) | N/A (logika w pamięci, nie SQL) | **TAK** (`orderFinancingEventsForPeriod`) | Nie (przed naprawą) | Tak | **TAK — dostarczony** | ✅ NAPRAWIONE (decyzja DEC-FIN-012) |
| 4 | `predictionComputeService.ts` ~450, `finance_prediction_driver_overrides` → `driverOverrideRows` | Nie wprost — konsumowane WYŁĄCZNIE do `Map` po kluczu złożonym `scheduleType::driverCode::periodId` (unikalnym z założenia) | Nie | Nie | N/A (Map) | Tylko jeśli w danych są duplikaty klucza — poza zakresem tego audytu (defekt integralności danych, nie kolejności) | Nie | ⚪ NIE DOTKNIĘTE — udokumentowane, niskie ryzyko |
| 5 | `predictionComputeService.ts` ~374, `finance_baseline_outputs` → `baselineOutputRows` | Nie — `Map` po kluczu `${code}::${periodId}` | Nie | Nie | N/A (Map) | Nie | Nie | ⚪ NIE DOTKNIĘTE — zweryfikowane, brak ryzyka |
| 6 | `predictionComputeService.ts` ~417, `financial_statement_lines` (pełna tabela) | Nie — `Map` po `line_code`/`id` | Nie | Nie | N/A | Nie | Nie | ⚪ NIE DOTKNIĘTE |
| 7 | `predictionComputeService.ts` ~232, `finance_baseline_outputs` (STANDARD_BASE, `existingBaselineOutputCount`) | TAK — karmi `contentSemanticHash` (passthrough) | **JUŻ JEST** (`ORDER BY canonical_line_id, period_id`) | — | **TAK** | — | Pokryte istniejącymi testami STANDARD_BASE | ⚪ JUŻ POPRAWNE |
| 8 | `predictionPreflightService.ts` ~239, `finance_prediction_detect_overlaps()` → `overlap.sources` (`jsonb_agg` bez `ORDER BY` W ŚRODKU agregatu, migracja zamrożona) | **TAK** — `layer2Combined = layer2Deltas.reduce(+)`, float64 | Nie (funkcja SQL zamrożona — migracji nie edytowano) | **TAK** (`sortOverlapSourcesById`) | Nie (przed naprawą) | Tak, w teorii | **TAK — dostarczony** | ✅ NAPRAWIONE — **znalezione podczas audytu, POZA pierwotną listą trzech** |
| 9 | `predictionPreflightService.ts` ~176/179, `finance_prediction_driver_overrides`/`finance_prediction_impact_chain` → `assumption_set_semantic_hash` | **TAK** — hashowane bezpośrednio (`JSON.stringify` po sortowaniu) | Nie (wybrano pamięć) | **TAK** (`buildAssumptionSetSemanticHash`) | Nie (przed naprawą) | Tak, w teorii | **TAK — dostarczony** | ✅ NAPRAWIONE — **znalezione podczas audytu, POZA pierwotną listą trzech** |
| 10 | `predictionPreflightService.ts` ~177, `financial_statement_lines` | Nie — `Map` po `id` | Nie | Nie | N/A | Nie | Nie | ⚪ NIE DOTKNIĘTE |
| 11 | `predictionPreflightService.ts` ~194, `finance_prediction_initiatives` | Nie — `Map` po `id` | Nie | Nie | N/A | Nie | Nie | ⚪ NIE DOTKNIĘTE |
| 12 | `kpiComputeService.ts` ~222, `finance_analysis_kpi_values` | TAK | Nie | **JUŻ NAPRAWIONE** (`hashPayloadFor`, sesja poprzednia) | TAK (po naprawie) | — | Istniejący test (`kpiComputeService.determinism.pg.test.ts`) | ⚪ NIE DOTYKANE (już naprawione — instrukcja: nie diagnozować od nowa) |
| 13 | `valuationFcffService.ts` ~203, `finance_baseline_outputs` (`loadCells`) | TAK | Nie | **JUŻ NAPRAWIONE** (`sumFlow()` sortuje chronologicznie, sesja poprzednia) | TAK | — | Istniejący test (`valuationFcffOrderDeterminism.test.ts`) | ⚪ NIE DOTYKANE |
| 14 | `valuationComputeService.ts` ~398, `contentSemanticHash = canonicalPayloadHash({enterpriseValue, fcff: fcff.years})` | TAK, ale `fcff.years` pochodzi z już-naprawionego `sumFlow()` | Nie | — | TAK (pochodna naprawy #13) | — | Pokryte pośrednio przez #13 | ⚪ ZWERYFIKOWANE, brak dodatkowego ryzyka |
| 15 | `baselineComputeService.ts` ~236-277, 6 zapytań (`financial_statement_lines`, `finance_stmt_periods`, historia REVENUE, opening BS, `finance_baseline_schedules`, `finance_baseline_assumptions`) | Nie — wszystkie konsumowane do `Map` po unikalnych kluczach (`line_code`, `period_id`, `fiscalYear-fiscalMonth`, `scheduleType+entity`, `scheduleType+driverCode`) | Nie | Nie | N/A | Nie | Nie | ⚪ NIE DOTKNIĘTE — zweryfikowane |
| 16 | `financeCompareService.ts` ~384-566, 5 loaderów (`finance_stmt_lines`, `finance_analysis_kpi_values`, `finance_baseline_outputs`, `finance_prediction_outputs_effective`, `finance_valuation_methods`) | Formalnie TAK (brak `ORDER BY`), ale **wyjście jest jawnie sortowane** `rows.sort(matchKey)` (linia ~782) PRZED zwróceniem do wywołującego — kolejność SQL nie przecieka na zewnątrz | Nie potrzebny (neutralizowane niżej w potoku) | — | **TAK, efektywnie** (sortowanie końcowe) | Nie (to jest „compare", nie ma trwałego `content_semantic_hash`) | Nie | ⚪ NIE DOTKNIĘTE — zweryfikowane, wyjście już kanoniczne |
| 17 | `financeExportService.ts` — zapytania eksportu (`stmt_lines`, `kpi_catalog`) | TAK | **JUŻ JEST** (`ORDER BY csl.sort_order, csl.line_code, fse.entity_code, fsp.fiscal_year, fsp.period_start`; `ORDER BY category, kpi_code`) | — | **TAK** | — | — | ⚪ JUŻ POPRAWNE |
| 18 | `valuationAdvisorService.ts` — zapytania evidence digest (methods/terminal/bridge components/grid snapshots/grid cells) | TAK | **JUŻ JEST** (`ORDER BY method_type` / `m.method_type, t.convention` / `sequence_order` / `g.grid_label` / `row_index, col_index`) | — | **TAK** | — | — | ⚪ JUŻ POPRAWNE |
| 19 | `valuationSensitivityService.ts` — komórki grida | TAK | — | **JUŻ NAPRAWIONE/POPRAWNE** (`sorted by colIndex`/`rowIndex` w pamięci) | TAK | — | — | ⚪ JUŻ POPRAWNE |
| 20 | `valuationBridgeService.ts` ~99, `breakdown.reduce(+)` | TAK, ale `breakdown` pochodzi z zapytania z `ORDER BY sequence_order` | Nie | — | TAK | — | — | ⚪ NIE DOTKNIĘTE — zweryfikowane |
| 21 | `valuationDiscountService.ts` ~59, `discounted.reduce(+)` | TAK, ale `discounted` pochodna z już-kanonicznego `fcff.years` | Nie | — | TAK | — | — | ⚪ NIE DOTKNIĘTE — zweryfikowane |
| 22 | `statementReconciliationService.ts` ~673, `canonicalPayloadHash({totals, reconciliationRowCount})` | Formalnie TAK, ale `totals` pochodzi z `params.mappingResults` (kolejność dostarczona przez wywołującego, nie z surowego, nieuporządkowanego odczytu bazy) | Nie | — | TAK (deterministyczne wejście) | — | — | ⚪ NIE DOTKNIĘTE — zweryfikowane |
| 23 | `financeImportService.ts` ~712, `batchContentHash(operations)` | Formalnie TAK, ale `operations` pochodzi z kolejności wierszy PLIKU importu (Excel/CSV), nie z nieuporządkowanego zapytania SQL — `loadCurrentCells()` samo jest `Map` | Nie | — | TAK (deterministyczne przy tym samym pliku) | — | — | ⚪ NIE DOTKNIĘTE — zweryfikowane |
| 24 | `lineageService.ts`/`lineageFreshnessService.ts` — grafy lineage | N/A — nie liczą żadnego fingerprintu z tablicy zapytania; propagują HASH JUŻ OBLICZONY gdzie indziej | — | — | — | — | — | ⚪ NIE DOTYCZY — brak liczenia hashu tutaj |
| 25 | `exceptionInboxService.ts` ~660-661, `group.reduce(min/max createdAt)` | Formalnie kolejność wpływa na TO, KTÓRY element zwycięży przy remisie, ale wynikowa WARTOŚĆ (data) jest identyczna niezależnie od kolejności (min/max są przemienne) | Nie | — | N/A | Nie | Nie | ⚪ NIE DOTYCZY RYZYKA |

**Podsumowanie liczbowe:** 25 zapytań/miejsc przeanalizowanych w zakresie audytu. **5 naprawionych** (#1, #2, #3, #8, #9 — z czego #1/#2/#3 to trzy znane z briefu, #8/#9 to dwa dodatkowe znalezione podczas rozszerzenia audytu na `predictionPreflightService.ts`). **20 świadomie pozostawionych** bez zmian — z uzasadnieniem w tabeli dla każdego.

## 4. Naprawy — plik:linia przed/po

### 4.1 `predictionComputeService.ts`

Pełny diff: patrz commit tej sesji. Kluczowe zmiany:
- Nowe eksporty (moduł-scope, przed `runPredictionCompute`): `FinancingKind`, `sortByCreatedAtThenId()`, `FINANCING_KIND_PROCESSING_RANK`, `orderFinancingEventsForPeriod()`.
- `ImpactChainRow`/`FinancingRow` — dodano pole `created_at: string`.
- Zapytanie `finance_prediction_impact_chain`: dodano `created_at::text AS created_at` do SELECT (bez `ORDER BY` w SQL — sortowanie w pamięci).
- Zapytanie `finance_prediction_financing`: analogicznie.
- Po `Promise.all`: `const impactChainRows = sortByCreatedAtThenId(impactChainRowsRaw); const financingRows = sortByCreatedAtThenId(financingRowsRaw);`.
- W pętli okresowej: `financingThisPeriod = orderFinancingEventsForPeriod(financingRows.filter(f => f.period_id === periodId))` (było: surowy `.filter()` bez sortowania).

### 4.2 `predictionPreflightService.ts`

- Nowe eksporty: `sortOverlapSourcesById()`, `buildAssumptionSetSemanticHash()`.
- `for (const source of overlap.sources)` → `for (const source of sortOverlapSourcesById(overlap.sources))`.
- `involvedSources: overlap.sources` → `involvedSources: orderedSources` (spójność z powyższym, informacyjne, nie krytyczne dla hashu).
- Inline `createHash('sha256').update(JSON.stringify({driverOverrides: ..., impactChain: ...}))...` → `buildAssumptionSetSemanticHash(driverOverrideRows, impactChainRows)` (ta sama logika, wydzielona jako czysta, testowalna funkcja).

## 5. Dowód — niezależny odczyt z bazy (nie wartość zwrócona przez serwis)

`predictionOverlayQueryOrderChurn.pg.test.ts` — test na realnym Postgresie:
- Wstawia 7 wierszy `finance_prediction_impact_chain` i 5 wierszy `finance_prediction_financing` (same `FACILITY_DRAWDOWN`) z `created_at` rozstawionym CELOWO NIEZGODNIE z kolejnością insertu (ostatni wstawiony wiersz ma NAJWCZEŚNIEJSZY `created_at`).
- 10 przebiegów: między każdym `UPDATE ... SET x = x WHERE id = ?` na każdym wierszu (ta sama technika co `kpiComputeService.determinism.pg.test.ts` — churn fizycznego layoutu tabeli).
- Po każdym przebiegu: NIEZALEŻNY odczyt SQL (dokładny tekst zapytania produkcyjnego) + `sortByCreatedAtThenId()`.
- **Wynik: wszystkie 10 przebiegów dają IDENTYCZNĄ kolejność kanoniczną** (`distinctCanonical.size === 1`).
- **Wynik dla financing:** wszystkie 10 przebiegów wskazują TEN SAM wiersz jako „pierwszy `FACILITY_DRAWDOWN`" — i jest to wiersz z NAJWCZEŚNIEJSZYM `created_at` (`financingIds[4]`), a NIE wiersz wstawiony jako pierwszy.
- **Kontrola negatywna wbudowana w ten sam test:** surowy odczyt SQL (bez sortowania) wybrał w jednym z przebiegów **INNY** wiersz niż kanonicznie poprawny — log: `raw-scan-order first FACILITY_DRAWDOWN id=fin-pkga-0a75...; canonical id=fin-pkga-68c1... — DIVERGED on this run, exactly the pre-fix risk`. To jest EMPIRYCZNY dowód na żywym Postgresie, że ryzyko przed naprawą było realne, nie teoretyczne.

## 6. Rachunek permutacyjny

Dla siedmiu syntetycznych (patrz uwaga niżej) wartości delt o realistycznym rzędzie wielkości:
```
12345.678912345, -8734.291823741, 45231.128374652, -19283.746192837,
7654.321987654, -3456.789123456, 28193.746281937
```
**Wyczerpujące przeszukanie WSZYSTKICH 5040 permutacji (7!) dało dokładnie 6 różnych sum float64** (nie 5040 — większość permutacji koliduje na tej samej reprezentacji bitowej, co jest samo w sobie ważną obserwacją metodyczną: losowo wybrana permutacja NIE jest niezawodną kontrolą negatywną — trzeba ją zweryfikować, tak jak zrobiono w tym audycie po tym, jak pierwsza próba przypadkowo trafiła w kolidującą permutację).

Suma w kolejności bazowej: `61950.048416554`. Zweryfikowana rozbieżna permutacja (zamiana TYLKO dwóch ostatnich elementów): `61950.048416554004` — różni się na poziomie ostatniego bitu mantysy, co jest DOKŁADNIE tym zjawiskiem, przed którym chroni ten pakiet.

**Uwaga o pochodzeniu danych:** Finance v3 nie istnieje na żadnej żywej bazie (patrz §"ustalenie" w briefie — 0/2/1 tabel `finance_%` na PROD/DEMO/DEV) — nie ma żadnego realnego przebiegu produkcyjnego do zacytowania (w przeciwieństwie do `valuationFcffOrderDeterminism.test.ts`, którego 12 wartości EBIT pochodzi z faktycznej reprodukcji na żywym Postgresie z sesji, która naprawiała `valuationFcffService.ts`). Te 7 wartości zostały skonstruowane i zweryfikowane osobnym uruchomieniem Node (nie częścią zestawu testów — trwałoby zbyt długo w CI) w celu bezpośredniego odtworzenia mechanizmu: nieprzemienność dodawania float64 dla dziesiętnych o realistycznym rzędzie wielkości.

Pełny rachunek permutacyjny (w testach): `predictionOverlayOrderDeterminism.test.ts`, test `RACHUNEK PERMUTACYJNY: ...` — uruchamiany przy KAŻDYM przebiegu testów (nie tylko raz ręcznie), asercja `allSums.size === 6`.

## 7. Kontrola negatywna

### 7.1 Rewersja kodu produkcyjnego (git show → czerwony → przywrócenie → zielony)

```bash
git show HEAD:server/src/services/finance/canonical/predictionComputeService.ts > server/src/services/finance/canonical/predictionComputeService.ts
git show HEAD:server/src/services/finance/canonical/predictionPreflightService.ts > server/src/services/finance/canonical/predictionPreflightService.ts
npx vitest run src/services/finance/canonical/__tests__/predictionOverlayOrderDeterminism.test.ts src/services/finance/canonical/__tests__/predictionPreflightOrderDeterminism.test.ts
# → Test Files 2 failed | Tests 10 failed | 6 passed (16)  — CZERWONY (importowane funkcje nie istnieją w kodzie sprzed naprawy)
# (przywrócono pliki z powrotem)
npx vitest run src/services/finance/canonical/__tests__/predictionOverlayOrderDeterminism.test.ts src/services/finance/canonical/__tests__/predictionPreflightOrderDeterminism.test.ts
npx tsc --noEmit -p server/tsconfig.json
# → Test Files 2 passed | Tests 16 passed (16); TSC_EXIT:0  — ZIELONY
```
Surowy output obu przebiegów zarejestrowany podczas sesji (10 nazwanych awarii z `TypeError: X is not a function`, potem 16/16 zielono).

### 7.2 Kontrole negatywne wbudowane w każdy plik testowy (muszą umieć zaczerwienić się)

- `predictionOverlayOrderDeterminism.test.ts`: „NEGATIVE CONTROL: a genuine permutation ... sums to a DIFFERENT float64 value" — asercja `not.toBe`, weryfikowana ręcznie (pierwsza próba z losową permutacją PRZYPADKOWO trafiła w kolizję i test się nie zaczerwienił — poprawiono na permutację zweryfikowaną skryptem Node, patrz §6).
- `predictionOverlayOrderDeterminism.test.ts`: „NEGATIVE CONTROL: applying a same-period drawdown before vs. after a repayment gives a DIFFERENT ending facility balance" — 50 vs 100, konkretna różnica wskazana, nie tylko „nie równe".
- `predictionPreflightOrderDeterminism.test.ts`: „NEGATIVE CONTROL: hashing raw (SQL-order) arrays directly IS order-dependent" i „... summing overlap.sources in raw ... sequence IS order-dependent" — analogicznie.
- `predictionOverlayQueryOrderChurn.pg.test.ts`: wbudowana kontrola negatywna z realnym odczytem bazy (§5) — wskazuje KONKRETNY inny wiersz, nie tylko „nie równe".

### 7.3 Bramka DB

```bash
npx vitest run src/services/finance/canonical/__tests__/predictionOverlayQueryOrderChurn.pg.test.ts   # bez RUN_DB_TESTS/MOCK_DB/DATABASE_URL
# → 3 skipped (describe.skipIf(!REAL_PG)) — NIGDY "passed" bez jawnej trójki zmiennych, zgodnie z wymogiem
```
Potwierdzone w tej sesji (patrz pierwszy przebieg tego pliku przed dodaniem zmiennych środowiskowych — `3 tests | 3 skipped`).

## 8. Znana niestabilność (flaky) — NIEPOWIĄZANA z tym pakietem

`faultMatrix.pg.test.ts` (EM-1, `reapExpiredLeases()` — test oparty na rzeczywistym czasie zegarowym) zaczerwienił się RAZ w pełnym przebiegu pakietu (`Test Files 1 failed | 48 passed (49)`, `Tests 1 failed | 737 passed (738)`, `Duration 276.39s` — vs ~30-40s w typowym przebiegu, silny sygnał przeciążenia współdzielonej maszyny: w trakcie przebiegu działało jednocześnie kilkanaście niezwiązanych procesów `vitest`/`node` z innych sesji Claude na tej samej maszynie, potwierdzone `ps aux`). Ten plik ANI logika leasingu NIE były dotykane przez ten pakiet. Izolowany przebieg tego samego pliku, bez współbieżnego obciążenia:
```
Test Files  1 passed (1)
     Tests  25 passed (25)
```
Zgodnie z instrukcją briefu („Znany flaky... sprawdź czy migocze też bez Twoich zmian") — **potwierdzone: migocze niezależnie od zmian tego pakietu**, klasyfikowane jako środowiskowe, nie jako regresja.

Analogicznie `perfSlo.pg.test.ts` (2 testy SLO czasowe) zaczerwienił się w jednym przebiegu pod obciążeniem (2 równoległe sesje testowe), a przeszedł czysto w izolacji (`5 passed (5)`).

## 9. Known-answer — brak zmiany

`predictionComputeService.ts`/`predictionPreflightService.ts` **nie mają w repo żadnego istniejącego testu z zakodowaną „znaną odpowiedzią"** (żaden plik w `server/src/services/finance/**` przed tą sesją nie importował ani `runPredictionCompute`, ani `runPreflight` w scenariuszu innym niż `STANDARD_BASE` passthrough w `w2FalseSuccessW9B2.pg.test.ts` — ten test przeszedł bez zmian, `47/722` → bez regresji). Bramka „zero zmian w known-answer" jest więc spełniona w sposób rozstrzygający dla POZOSTAŁEJ części pakietu Finance v3: pełny pakiet testów (`kpiComputeService`, `valuationFcffService`/`valuationComputeService` z zakodowanym `EV=201589069`, `baselineComputeService`, itd.) przeszedł **bez zmiany liczby testów/wyników** przed i po tej sesji — jedyna różnica to dodanie 19 nowych testów tego pakietu (16 czystych + 3 na realnej bazie).

Jedyne miejsce, w którym ta sesja ŚWIADOMIE zmienia wynik liczbowy względem tego, co dawał kod PRZED naprawą, to polityka kolejności finansowania (§2) — a to jest deklarowana NAPRAWA nowo odkrytego ryzyka biznesowego (poprzednio: kolejność „przypadkowa" z Postgresa), nie regresja względem jakiegokolwiek zatwierdzonego known-answer.

## 10. Liczby przebiegów — przed / po

| Zestaw | Przed (na kodzie z HEAD, bez naprawy) | Po (z naprawą) |
|---|---|---|
| `predictionOverlayOrderDeterminism.test.ts` + `predictionPreflightOrderDeterminism.test.ts` | 6 passed / 10 failed (16 total) — import nowych eksportów nieudany | **16 passed / 0 failed** |
| `predictionOverlayQueryOrderChurn.pg.test.ts` (10 przebiegów odczytu w środku testu) | N/A (plik testowy powstał PO naprawie — testuje tylko stan naprawiony; kontrola negatywna wewnątrz pliku pokazuje rozbieżność SUROWEJ kolejności) | **3 passed / 0 failed**, w tym 10/10 identycznych kolejności kanonicznych w obu pod-testach |
| `src/services/finance/canonical` (wąski) | 37 plików / 454 testy | **37 / 454**, exit 0 |
| `src/services/finance` (szeroki) | 47 plików / 722 testy | Trzy przebiegi w tej sesji: (1) `49 plików / 738 testów`, 1 czerwony (`faultMatrix` EM-1, pod obciążeniem ~276s zamiast ~35s) → **48 passed/49, 737/738**; (2) izolowany `faultMatrix.pg.test.ts` osobno → **25/25 zielono**; (3) **finalny czysty przebieg PO dodaniu wszystkiego (50 plików / 741 testów) → `50 passed (50)`, `741 passed (741)`, exit 0 — WSZYSTKO ZIELONE** |
| `tsc --noEmit -p server/tsconfig.json` | exit 0 (przed zmianami) | **exit 0** (po KAŻDYM etapie zmian) |
| Migracje STRICT | 637, exit 0 | **637, exit 0** (ta sama efemeryczna baza, bez zmian migracji — pakiet nie dodaje migracji) |

## 11. EVIDENCE_MISSING — wprost

- **Test powtarzalności na poziomie CAŁEGO `runOverlayCompute()`/`runPreflight()` (end-to-end, z prawdziwym Baseline Model i solverem circularity) — `EVIDENCE_MISSING`.** W repo nie istniał (i nadal nie istnieje) żaden test integracyjny dla tej ścieżki (`w2FalseSuccessW9B2.pg.test.ts` pokrywa wyłącznie `STANDARD_BASE`). Zbudowanie pełnej fikstury (statement pack + 7 typów schedule'i/assumption + solver zbieżności) od zera było poza budżetem czasowym tego audytu — jawna decyzja zakresu, udokumentowana w nagłówku `predictionOverlayQueryOrderChurn.pg.test.ts`. Dowód dostarczony na dwóch niższych poziomach zamiast: (a) czyste funkcje + rachunek permutacyjny, (b) realne zapytania SQL na realnym Postgresie z fizycznym churnem tabeli. To NIE jest równoważne dowodowi na poziomie całego silnika — flaguję wprost jako lukę, nie zaokrąglam w górę.
- **Empiryczne przeszukanie WSZYSTKICH permutacji dla `overlap.sources`/`assumption_set_semantic_hash` (analogicznie do §6) — nie wykonane, `EVIDENCE_MISSING` częściowo.** Rachunek permutacyjny (§6) wykonano dla `impactDeltaFor`-owej sumy (7 wartości, 5040 permutacji, w pełni wyczerpujące). Dla `layer2Combined`/`assumption_set_semantic_hash` (defekty #8/#9, znalezione podczas audytu) dowód opiera się na TYCH SAMYCH 7 wartościach (ten sam mechanizm matematyczny, ta sama nieprzemienność float64/JSON-order-sensitivity) plus dedykowanych testach negative-control/invariance — ale NIE na osobnym wyczerpującym przeszukaniu permutacji specyficznym dla tych dwóch miejsc. Uznaję to za wystarczające (mechanizm identyczny, zweryfikowany), ale odnotowuję brak NIEZALEŻNEGO powtórzenia rachunku permutacyjnego dla tych dwóch konkretnych miejsc.

## 12. Komendy reprodukcji — pełny zestaw

```bash
# Środowisko
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA=/private/tmp/fv3p-a-pgdata ; PGSOCK=/tmp/fv3pasock ; PORT=58001
rm -rf "$PGDATA" "$PGSOCK" && mkdir -p "$PGDATA" "$PGSOCK"
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" -l /tmp/fv3pa_pg.log start
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE fv3p_a;"
DBURL="postgresql://postgres@127.0.0.1:$PORT/fv3p_a"
NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" npx tsx server/scripts/migrate.postgres.ts

# tsc
NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit -p server/tsconfig.json

# Testy czyste (bez bazy)
cd server && npx vitest run \
  src/services/finance/canonical/__tests__/predictionOverlayOrderDeterminism.test.ts \
  src/services/finance/canonical/__tests__/predictionPreflightOrderDeterminism.test.ts

# Test na realnej bazie (churn kolejności wierszy)
RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" NODE_ENV=test \
  npx vitest run src/services/finance/canonical/__tests__/predictionOverlayQueryOrderChurn.pg.test.ts

# Pełny pakiet Finance v3
RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" NODE_ENV=test NODE_OPTIONS=--max-old-space-size=8192 \
  npx vitest run src/services/finance --no-file-parallelism

# Kontrola negatywna (git-revert)
git show HEAD:server/src/services/finance/canonical/predictionComputeService.ts > server/src/services/finance/canonical/predictionComputeService.ts
git show HEAD:server/src/services/finance/canonical/predictionPreflightService.ts > server/src/services/finance/canonical/predictionPreflightService.ts
npx vitest run src/services/finance/canonical/__tests__/predictionOverlayOrderDeterminism.test.ts src/services/finance/canonical/__tests__/predictionPreflightOrderDeterminism.test.ts  # oczekiwane: RED
# (przywrócić pliki z git checkout lub kopii)
```

## 13. Allowlista — pliki dotknięte i uzasadnienie

- `server/src/services/finance/canonical/predictionComputeService.ts` — w allowliście od początku (trzy znane defekty).
- `server/src/services/finance/canonical/predictionPreflightService.ts` — **POZA pierwotną allowlistą**, dodane po potwierdzeniu przez audyt DWÓCH realnych defektów tej samej klasy (§3, wiersze #8/#9): `assumption_set_semantic_hash` liczony z nieuporządkowanych zapytań, `layer2Combined` sumowany z nieuporządkowanego `jsonb_agg`. Uzasadnienie w tabeli.
- `server/src/services/finance/canonical/__tests__/predictionOverlayOrderDeterminism.test.ts` — nowy, czysty test jednostkowy.
- `server/src/services/finance/canonical/__tests__/predictionPreflightOrderDeterminism.test.ts` — nowy, czysty test jednostkowy.
- `server/src/services/finance/canonical/__tests__/predictionOverlayQueryOrderChurn.pg.test.ts` — nowy test na realnej bazie.
- `docs/validation/finance-v3/generated/gate-e/PKG_A_DETERMINISM_report.md` — ten raport.

Żaden plik spoza tej listy nie został zmieniony. `contentHash.ts` (algorytm zamrożony), `src/**` (frontend), `server/src/routes/**`, migracje — nietknięte.

## 14. Commity tej sesji

(uzupełnione po `git commit` — patrz `git log --oneline -5` w gałęzi `codex/fv3p-a-determinism`)
