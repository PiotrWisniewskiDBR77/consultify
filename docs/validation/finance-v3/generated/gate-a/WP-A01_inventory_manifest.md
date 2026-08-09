# WP-A01 — Canonical Inventory Manifest (Gate A)

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` (sekcja 12 „Gate A”, sekcja 14A EPIC-01)
**Work package:** WP-A01 z `docs/validation/finance-v3/FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md`
**Data wygenerowania:** 2026-08-09T15:49:01Z
**Worktree:** `/private/tmp/finance-v3-gate-a-20260809`
**Branch:** `codex/finance-v3-gate-a-20260809`
**SHA:** `9d17cac11484a82f729a51044e30453e39fbcb02` (`9d17cac114`)
**Baza:** świeży `origin/demo` — `git rev-list --left-right --count origin/demo...HEAD` = `0 0` (zero rozjazdu w chwili startu).
**Metoda:** WYŁĄCZNIE statyczna — grep + odczyt `server/migrations/**`, `server/src/services/finance*`, `server/src/routes/*financ*`, `server/src/routes/v8/finance*`. Zero połączeń z bazą, zero uruchamiania migracji, zero startu serwera (zgodnie z twardym zakazem z briefu — incydent bezpieczeństwa, WP-A04 domyka to osobno).

Towarzyszący plik strukturalny: `WP-A01_inventory_manifest.json` (60 tabel, 9 „nigdy niewidzianych” plików, ocena 22 uwag OWN-FIN + 12 problemów z sekcji 3 handoffu, klasyfikacja per tabela).

---

## 0. Ważna uwaga wstępna: dokumenty wejściowe nie istnieją na `origin/demo`

`FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md`, `OWNER_REVIEW_REGISTER_2026-08-09.md` i `FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md` **nie istnieją w tym worktree** (świeżym z `origin/demo`) — istnieją wyłącznie jako pliki `??` (untracked, niescommitowane) w głównym repo iCloud. Przeczytałem je stamtąd jako materiał wejściowy (tylko do odczytu), a całą inwentaryzację kodu wykonałem w worktree na `origin/demo`. To jest dokładnie sytuacja opisana w brief — audyt Finance powstał na martwej gałęzi, więc traktuję go jako hipotezę do zweryfikowania kodem, nie jako fakt.

---

## 1. Wynik liczbowy

- **60 tabel/artefaktów** zinwentaryzowanych: **35 AUTO_MIGRATE**, **17 MIGRATE_WITH_WARNING**, **8 QUARANTINE**, **0 EXCLUDE wśród żywych** + **osobno 25 tabel EXCLUDE_WITH_REASON** z `server/migrations/never-ran/` (nigdy nieuruchomionych — katalog jest jawnie wykluczony z discovery migratora, `fs.readdirSync` bez rekurencji w `migrate.postgres.ts` i `migrationRunner.ts`).
- **9 plików „nigdy niewidzianych”** przez wcześniejszy audyt — wszystkie przeczytane i streszczone.
- **22 uwagi OWN-FIN-001…022**: **11 STILL_OPEN** (potwierdzone kodem), **5 PARTIAL** (częściowo zaadresowane lub zależne od WP-A04), **6 EVIDENCE_MISSING** (wymagają runtime/DB/przeglądarki — poza zakresem tego przebiegu statycznego).
- **12 problemów z sekcji 3 handoffu**: **6 STILL_OPEN** (twarde dowody kodowe), **3 PARTIAL/STILL_LIKELY**, **3 EVIDENCE_MISSING**. **Zero PASS** — żaden problem nie został ogłoszony naprawionym bez dowodu, zgodnie z żelazną regułą „nigdy nie zgaduj PASS”.

## 2. Największe zaskoczenie

**Dwa z dziewięciu „nigdy niewidzianych” plików kłamią we własnych komentarzach nagłówkowych.**

- `server/src/routes/v8/finance-value.routes.ts` (klaster M16 „Value Tracking”, 802 linie) ma w nagłówku: *„NOTE: intentionally NOT mounted in Gateway/v8/index.ts here”*. To nieprawda na `origin/demo` — `server/src/routes/v8/index.ts:106` montuje go: `v8Router.use('/finance/value-tracking', financeValueTrackingRoutes);`.
- `server/src/routes/v8/financeValueDemoAllowlist.ts` (170 linii) trzykrotnie powtarza w nagłówku, że jest to „PROPOSAL... deliberately not imported by Gateway.ts”. To też nieprawda — `server/src/Gateway.ts:320` importuje `isStatelessComputeDemoRoute` z tego pliku, a linie 431–447 realnie wpinają go w `demoWriteProtection` (bramka zapisu w trybie demo).

To dokładnie pułapka „audyty starzeją się w ~3 dni”, ale tym razem **wewnątrz komentarzy samego kodu źródłowego**, nie w zewnętrznym dokumencie audytowym. Ktokolwiek czyta tylko te komentarze, dojdzie do błędnego wniosku, że decyzja bezpieczeństwa (wyjątek dla stateless-compute routes w trybie demo) nigdy nie zapadła — a zapadła i działa.

Drugie istotne zaskoczenie: **reopen zatwierdzonego modelu finansowego nadpisuje wiersz Approved w miejscu**, zamiast tworzyć nową wersję — `financialModelingService.ts` ma trzy miejsca (`UPDATE financial_models SET status = 'draft' ... WHERE status = 'approved'`), które mutują ten sam rekord z powrotem na `draft`. To silniejsze naruszenie zasady „Approved jest immutable” niż sugeruje tekst rejestru właścicielskiego.

## 3. Stan 22 uwag OWN-FIN — skrót

| Status | Liczba | ID |
|---|---|---|
| STILL_OPEN (potwierdzone kodem) | 11 | 003, 004, 007, 008, 011, 012, 013, 014, 015, 016, 019, 020, 022 *(patrz JSON — kilka ma status złożony PARTIAL/STILL_OPEN)* |
| PARTIAL | 5 | 002, 009, 010, 017, 021 |
| EVIDENCE_MISSING (poza zasięgiem statyki) | 6 | 001, 005, 006, 010, 018, 021 |

Pełna lista z uzasadnieniem per pozycja: patrz `own_fin_register_assessment` w pliku JSON. Trzy najmocniej potwierdzone kodem:

- **OWN-FIN-015** (Models = neutralny baseline bez decyzji): `financial_model_events.event_type` CHECK zawiera `debt_drawdown`, `debt_repayment`, `equity_injection`, `dividend`, `capex_purchase` — żywy dowód schematu, że problem nadal istnieje.
- **OWN-FIN-019** (Prediction = causal engine): `financeScenarioLevers.ts` sam siebie opisuje jako „a THIN advisory wrapper... It does NOT recompute financials” nad prostym mnożnikiem `growthMult/costMult` — przyznanie się w kodzie.
- **OWN-FIN-022** (Finance Lineage Navigator): brak jakiejkolwiek tabeli krawędzi wersji/lineage w całym inwentarzu; jedyne powiązania to pojedyncze FK (`financial_analyses.source_statement_pack_id`, `valuations.source_id`) i jednokierunkowy `finance_candidate_handoffs` (promocja DO Initiatives, nie DAG wewnątrz Finance).

## 4. Stan 12 problemów z sekcji 3 handoffu — skrót

| # | Problem | Status |
|---|---|---|
| 1 | Statement↔Analysis niespójność | PARTIAL/STILL_LIKELY — 3 niezależne tabele NPV/IRR/ROI bez rekoncyliacji |
| 2 | Silent-zero / `firstNonZero` | **STILL_OPEN** — potwierdzone, ~15+ wywołań w `financialModelingService.ts` |
| 3 | Readiness bypass | EVIDENCE_MISSING |
| 4 | Brak period lineage / jednostek | **STILL_OPEN** — naprawiony tylko symptom wyświetlania (`financePeriodFormat.ts`), nie struktura |
| 5 | Analysis pusty Draft bez KPI | **STILL_OPEN** |
| 6 | Models zawiera eventy | **STILL_OPEN** — schemat `financial_model_events` to dowód |
| 7 | Prediction bez causal engine | **STILL_OPEN** — przyznanie w komentarzu `financeScenarioLevers.ts` |
| 8 | Compute timeout | EVIDENCE_MISSING |
| 9 | Valuation FCFF uproszczony / duplikaty wersji | PARTIAL/STILL_LIKELY — brak `UNIQUE(valuation_id, version)` na `valuation_snapshots`, potwierdzone |
| 10 | Valuation crash na sensitivity | PARTIAL — rejestr twierdzi że naprawione, nie zweryfikowano niezależnie |
| 11 | `/api/economics` + v8 split-brain | **STILL_OPEN** — oba pliki żywe, 3257 + 3588 linii |
| 12 | Local runtime → produkcyjna baza | PARTIAL — poza zakresem tego zadania (WP-A04) |

## 5. Streszczenie 9 „nigdy niewidzianych” plików

| Plik | Linie | Co robi | Czy realizuje concepty wersjonowania/lifecycle/lineage z programu? |
|---|---|---|---|
| `financeCandidateHandoffCore.ts` | 476 | Wspólny preview/confirm/idempotency rdzeń „promocji” zatwierdzonego artefaktu Finance do `initiative_candidates` | NIE — jednorazowa promocja DO INNEGO modułu (Initiatives), nie wewnętrzny DAG Finance. Dobry wzorzec locka/idempotencji do ponownego użycia w WP-B02/B04. |
| `financeInvestmentCaseCandidateHandoff.ts` | 315 | Adapter #1: `financial_models.status='approved'` jako brama | Potwierdza brak kolumny NPV/IRR/payback w `financial_models`. |
| `financeStatementPackCandidateHandoff.ts` | 288 | Adapter #2: `pack_readiness_status='ready'` jako brama | Bez nowych informacji ponad schemat. |
| `financeValuationRecommendationCandidateHandoff.ts` | 424 | Adapter #3: rekomendacja Advisora istnieje tylko jako obiekt w `valuations.advisory` JSONB, adresowana ad-hoc id `rec-<hex>` | Bezpośredni dowód luki z OWN-FIN-021/022 — brak niezależnej tożsamości/statusu/lineage rekomendacji. |
| `financeDemoCoherencePolicy.ts` | 1362 | Czysta polityka bezpieczeństwa dla skryptu czyszczenia danych demo (FIN-005) — fingerprint bazy, kanoniczne wiersze, integralność manifestu | Węższe niż WP-A04 — chroni JEDEN skrypt, nie cały serwer aplikacji. |
| `financeDemoManifestSignature.ts` | 190 | HMAC-SHA256 zamiast niekluczowanego SHA-256 dla manifestu rollbacku FIN-005 | Hardening bezpieczeństwa skryptu, nie mechanizm wersjonowania Finance. |
| `financePeriodFormat.ts` | 203 | Naprawia realny, potwierdzony bug: `Date.toString()` wyciekał do UI w kolumnie PERIOD (obserwowane na staging 2026-08-01) | Naprawia tylko SYMPTOM wyświetlania problemu #4, nie strukturalny brak period lineage. |
| `finance-value.routes.ts` | 802 | Montuje 7 wcześniej osieroconych serwisów „Value Tracking” (M16) pod `/api/v8/finance/value-tracking` | Osobny podsystem (realizacja wartości/ROI portfela), nie wspomniany nigdzie w rejestrze OWN-FIN ani w 12 problemach — **żywy mimo komentarza mówiącego inaczej**. |
| `financeValueDemoAllowlist.ts` | 170 | Wyjątek od blokady zapisu w trybie demo dla 6 stateless-compute endpointów | **Żywy i wpięty w `Gateway.ts`, mimo że komentarz nazywa się „PROPOSAL, not applied”.** |

## 6. Klasyfikacja tabel — zasady i najważniejsze przypadki

Kryteria z `FINANCE_IMPLEMENTATION_MASTER_PLAN_2026-08-09.md` WP-A01 (AUTO_MIGRATE / MIGRATE_WITH_WARNING / QUARANTINE / EXCLUDE_WITH_REASON) zastosowane na poziomie **tabeli/schematu**, nie wiersza (klasyfikacja wierszy = WP-A03, wymaga żywej bazy, poza zakresem tego zadania).

**Najlepszy wzorzec w całym inwentarzu:** `finance_post_investment_reviews` (FIN-007) — niemutowalny wskaźnik baseline (`baseline_model_id` + `baseline_version` zamrożone w momencie utworzenia, nie „aktualny approved”), jawny status rekoncyliacji, `idempotency_key` + `request_hash`, zamrożona `realized_value` liczona raz. Warto użyć jako referencję przy projektowaniu WP-B01/B03, nie tylko migrować 1:1.

**Najważniejszy QUARANTINE:** `financial_model_events` — schemat wprost sprzeczny z docelowym konceptem neutralnego baseline (problem #6/OWN-FIN-015); wymaga decyzji projektowej w Gate B (rozdzielić na harmonogram baseline vs przenieść eventy decyzyjne do Prediction), nie prostej migracji.

**Trzy niezreconcylowane tabele „analiza inicjatywy”:** `initiative_financials` (067, `organization_id INTEGER` — dryf schematu względem konwencji TEXT), `analysis_financials` (068, też INTEGER), `financial_analyses` (20260317+, TEXT). Wymagana jawna decyzja merge/deprecate/keep przed Gate B.

**Kolizja nazw z martwą migracją:** `never-ran/653_v4_finance_enterprise.sql` deklaruje WŁASNĄ, niekompatybilną wersję tabeli `financial_model_versions` (inne kolumny niż żywa wersja z `20260228_financial_model_versions.sql`). Nigdy nie uruchomiona, ale projektanci Gate B nie mogą wskrzesić tego kształtu pod tą samą nazwą.

**Brakujący constraint z realnym ryzykiem:** `valuation_snapshots` nie ma `UNIQUE(valuation_id, version)` — w przeciwieństwie do analogicznych tabel wersjonujących (`financial_statement_versions`, `financial_statement_value_versions`), które mają `UNIQUE(statement_id, version_no)`. To jedyne miejsce w inwentarzu, gdzie ryzyko „duplicate valuation version” z WP-A01 jest strukturalnie obecne, nie tylko hipotetyczne.

Pełna tabela wszystkich 60 pozycji z kolumnami/constraints/FK/org-scoping/uzasadnieniem: plik JSON, klucz `tables`.

## 7. Rekomendowane następne kroki

1. WP-A02: prześledzić realnych konsumentów `v8_finance_document_ingestions` vs `__w18`, oraz czterech tabel P05B (`v8_finance_lane_runs`, `v8_finance_mutation_audit`, `v8_finance_version_snapshots`, `v8_promotion_gates` i siostrzane) — mogą być artefaktami harnessu testowego, nie danymi produkcyjnymi.
2. WP-A03 (wymaga kontrolowanego połączenia read-only do bazy — osobne zadanie): policzyć wiersze per org/status dla wszystkich tabel MIGRATE_WITH_WARNING/QUARANTINE, sprawdzić NULL period/unit, osierocone FK, duplikaty `valuation_snapshots.version`.
3. Gate B: `financial_statement_versions` i `finance_post_investment_reviews` jako wzorce referencyjne dla WP-B01, nie projektować od zera.
4. Decyzja właścicielska: czy klaster „Value Tracking” (M16, `finance-value.routes.ts`) wchodzi w zakres tego programu przebudowy Finance, czy to osobny tor — jest żywy i zamontowany, ale nie pojawia się nigdzie w rejestrze OWN-FIN ani w 12 problemach z handoffu.

---

*Ten manifest jest deterministyczny w sensie źródła (te same pliki migracji + ten sam SHA dają ten sam wynik), ale NIE zawiera hasha/liczby wierszy z żywej bazy — to jest jawnie poza zakresem tego zadania (zakaz połączenia z bazą). DoD z master planu („dwa uruchomienia dają ten sam hash”) będzie w pełni spełnialne dopiero po dodaniu warstwy WP-A03 z read-only dostępem do bazy.*
