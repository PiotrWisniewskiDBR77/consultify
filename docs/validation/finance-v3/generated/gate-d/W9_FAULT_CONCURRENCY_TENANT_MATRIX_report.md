# W9 — Macierz testów odpornościowych: współbieżność, fault injection, izolacja tenantów, pomiar wydajności

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` — Fala 9, bramki **FC-11** (Performance and operations) i **FC-01** (tenant isolation)
**Kontrakt kolejki:** `docs/validation/finance-v3/generated/gate-b/WP-B04_jobs_runs_outputs_ADR.md`
**Data:** 2026-08-10
**Worktree:** `/Users/piotrwisniewski/consultify-wt/w9-faultmatrix`
**Gałąź:** `codex/finance-v3-w9-faultmatrix`, odbita od `1271a0f721`
**Charakter pracy:** **POMIAR ISTNIEJĄCEGO SYSTEMU.** Zero zmian w kodzie produkcyjnym. Dodane wyłącznie cztery pliki testowe i ten raport.

> **Zamrożenie uszanowane.** `codex/finance-v3-closeout-fanin` @ `19b4b06934` nietknięta: żadnego merge'a, żadnego push'a, zero połączeń ze staging/demo/produkcją. Wszystko poniżej zmierzone na **własnym, efemerycznym klastrze**, usuniętym po pracy.

---

## 0. Werdykt w jednym akapicie

Warstwa **współbieżności (A) jest zdrowa** — 30 wyścigów na realnym Postgresie, za każdym razem dokładnie jeden zwycięzca i typowany błąd dla przegranego, nigdy surowy błąd bazy. Warstwa **kolejki zadań (B) jest zdrowa tam, gdzie istnieje, ale nie istnieje w połowie**: nie ma reapera, heartbeatu, kill switcha, limitu współbieżności per organizacja ani **żadnej pętli workera** — zadanie zostawione w kolejce nie zostanie podjęte przez nic i nigdy. Warstwa **izolacji tenantów (C) ma pięć realnych dziur**, w tym jedną **destrukcyjną międzytenantową** (organizacja A kasuje i podmienia 25 komórek siatki organizacji B) i jedną **P0** (`getJob`/`cancelJob` nie przyjmują `organizationId` w ogóle — A anuluje compute B). **Pomiar (D) wykonany**, ale **nie ma się do czego odnieść** — żaden liczbowy SLO nie jest w programie zadeklarowany.

**Rekomendacja bramek:** FC-01 `NO-GO` (5 potwierdzonych naruszeń izolacji). FC-11 `EVIDENCE_MISSING` (brak zadeklarowanego SLO, brak reapera/heartbeatu/workera, brak dashboardów i alertów — te ostatnie poza zakresem tego pakietu).

---

## 1. Środowisko i metoda

| Element | Wartość |
| --- | --- |
| Baza | PostgreSQL **15.15** (Homebrew, **nie** @16), własny efemeryczny klaster |
| `initdb` / `pg_ctl` | oba pod `LC_ALL=C`, `--locale=C`, `-E UTF8`, `listen_addresses=127.0.0.1` |
| Katalog danych | `/private/tmp/w9faultmatrix-pgdata` (poza repo), gniazdo `/tmp/w9pgsock` |
| Port | **57431** — sprawdzony `lsof`, w zakresie 55000–59999; nigdy 5432/28711/52824 |
| Migracje | `server/scripts/migrate.postgres.ts` **strict** (bez `--safe`), exit 0, świeża baza |
| Bramka testów | `RUN_DB_TESTS=1` **oraz** `MOCK_DB=false` **oraz** jawny `DATABASE_URL` |
| Runner | `npx vitest run --config vitest.config.ts ... --no-file-parallelism`, uruchamiany z `server/` |
| Sprzątanie | `pg_ctl -m fast stop` + `rm -rf` katalogu danych i gniazda — wykonane |

**Kontrola negatywna bramki** (żeby zieleń nie była atrapą): ten sam plik uruchomiony **bez** `RUN_DB_TESTS`/`MOCK_DB`/`DATABASE_URL` daje `Tests 24 skipped (24)`, nigdy `passed`. Sprawdzone dla `tenantMatrix` i `concurrencyMatrix`.

**Incydent środowiskowy warty odnotowania.** Pierwszy klaster stał w katalogu scratchpada sesji — katalog okazał się **współdzielony z inną, równoległą sesją agenta**, która skasowała mu `PGDATA` w trakcie pracy (`FATAL: could not open file "global/pg_filenode.map"`). Klaster odtworzono pod własną, unikalną ścieżką poza scratchpadem i przemigrowano od zera; wszystkie liczby w tym raporcie pochodzą z klastra po odtworzeniu. **Wniosek operacyjny dla następnych fal: nie stawiaj bazy w katalogu scratchpada.**

**Regresja:** cały katalog `src/services/finance/canonical` na tej bazie — **30 plików / 416 testów, wszystkie zielone**. Nowe pliki nic nie zepsuły.

### Dodane pliki

| Plik | Zawartość | Testów |
| --- | --- | --- |
| `server/src/services/finance/canonical/__tests__/concurrencyMatrix.pg.test.ts` | część A | 4 |
| `server/src/services/finance/canonical/__tests__/faultMatrix.pg.test.ts` | część B | 14 |
| `server/src/services/finance/canonical/__tests__/tenantMatrix.pg.test.ts` | część C | 24 |
| `server/src/services/finance/canonical/__tests__/perfSlo.pg.test.ts` | część D | 4 |
| | **razem** | **46** |

### Dyscyplina dowodu

Dla każdego scenariusza: (1) fizyczny stan **PRZED** (`rowCount === 1` / niezależny odczyt zwrotny), (2) wykonanie scenariusza, (3) **niezależny odczyt** wyniku prosto z tabeli — nigdy wartość zwrócona przez serwis. Program był już oszukany przez „UPDATE 0 wygląda jak PASS"; tutaj każdy PASS ma pod spodem wiersz z bazy.

---

## 2. Część A — Współbieżność: dokładnie jeden zwycięzca

Wszystkie cztery scenariusze **PASS**. Dodatkowo, dla twardego dowodu, każdy wyścig powtórzono **10×** osobnym probem (poza zestawem testów) — poniżej surowe wyniki, nie streszczenie.

| # | Scenariusz | Wynik | Dowód (10 powtórzeń) |
| --- | --- | --- | --- |
| A1 | Dwa równoległe `approveVersion()` tej samej wersji | **PASS** | 10/10 `OK \| VERSION_CONFLICT`. Zawsze 1 wiersz `APPROVED`, zawsze **dokładnie jedno** zdarzenie `APPROVE` w `artifact_lifecycle_events` |
| A2 | Równoległe `approveVersion()` + `transition(archive)` | **PASS** | 9/10 `approve=OK archive=VERSION_CONFLICT`, 1/10 `approve=OK archive=STATE_PRECONDITION_FAILED` (archive wystartował pierwszy, na `IN_REVIEW`). Stan końcowy 10/10 `APPROVED`, nigdy stan niemożliwy |
| A3 | Dwa równoległe `reopenVersion()` | **PASS** | 10/10 dokładnie jeden `OK`, drugi `DRAFT_ALREADY_EXISTS`; `children=1` za każdym razem; rodzic `APPROVED` i wersja nietknięta |
| A4 | Równoległa edycja working revision + compute | **PASS** | Job przypięty do dokładnie jednego z dwóch hashy (nigdy mieszanki, nigdy `null`); hash na wierszu `compute_jobs` zgadza się z realną rewizją; kolejny compute po edycji dostaje **nowy** hash i **osobny** job — stary wynik nie jest cicho podmieniany |

**Co to znaczy.** Obie kluczowe pułapki są zamknięte: `SELECT ... FOR UPDATE` + optymistyczne `expectedVersion` załatwiają A1/A2, a **częściowy unikalny indeks** `uq_finance_bv_one_open_child` załatwia A3 (aplikacja sprawdza `existingChild`, a indeks jest pasem bezpieczeństwa — `reopenVersion()` ma jawny `catch` na 23505, który zamienia go w typowany `DRAFT_ALREADY_EXISTS`). W żadnym z 30 wyścigów przegrany nie dostał surowego błędu Postgresa.

**Uwaga metodologiczna do A2.** Obie kolejności wyścigu wystąpiły naturalnie (9× approve pierwszy, 1× archive pierwszy), więc test nie mierzy jednej, uprzywilejowanej ścieżki.

---

## 3. Część B — Fault injection na kolejce zadań

### 3.1 Najpierw: co z kontraktu B04 w ogóle istnieje

Zgodnie z poleceniem — sprawdzone w kodzie **przed** pisaniem testów, `grep` po całym `server/src`, nie z dokumentacji.

| Element kontraktu B04 | Stan | Dowód |
| --- | --- | --- |
| `enqueue()` idempotentny na `(org, job_type, idempotency_key)` | **JEST** | `computeJobService.ts:74`, indeks `compute_jobs_idempotency_uq` |
| `claim()` z `FOR UPDATE SKIP LOCKED`, lease, `attempt_count++`, wiersz `compute_job_runs` | **JEST** | `computeJobService.ts:123` |
| `completeJobSuccess()` — append-only output, `UNIQUE(job_id)` | **JEST** | `computeJobService.ts:175`, `compute_job_outputs_job_uq` |
| `failJob()` — retry z backoffem liniowym, terminal `failed` | **JEST** | `computeJobService.ts:228` |
| `cancelJob()` | **JEST** (z defektem, patrz W9-B-1) | `computeJobService.ts:255` |
| DLQ jako predykat `status='failed' AND attempt_count >= max_attempts` (§10) | **JEST** | zmierzone, patrz 3.2 |
| **Reaper wygasłych lease (§5.3)** | **BRAK** | zero trafień na `lease_expires_at` w kodzie aplikacji; **nic** nigdy nie zapisuje `compute_job_runs.outcome = 'lease_expired'` |
| **Heartbeat (§5.2)** | **BRAK** | `compute_job_runs.last_heartbeat_at` nigdy nie jest aktualizowany po `DEFAULT`; `lease_expires_at` nigdy nie jest przedłużany |
| **Kill switch `is_org_compute_killed()` (§7.2)** | **BRAK** | brak funkcji w `pg_proc`, brak odpowiednika aplikacyjnego. Migracja C01 sama to przyznaje w nagłówku |
| **Limit współbieżności per org `org_concurrency_limit()` (§8)** | **BRAK** | jw.; zmierzone: 6 zadań jednej organizacji claimowanych naraz bez żadnego limitu |
| **Pętla workera / demon drenujący kolejkę** | **BRAK** | patrz niżej |
| Wpis w exception ledger przy dead-letter (§10, WP-B05 jako konsument) | **BRAK** | `failJob()` nie dotyka `finance_exceptions`; zmierzone: 0 wierszy po dead-letter |

**Doprecyzowanie tezy z briefu o `claim()`.** Teza „`claim()` nie ma produkcyjnego wywołującego" jest **częściowo nieścisła i wymaga korekty**: `claim()` **ma** czterech produkcyjnych wywołujących —
`baselineComputeService.ts:411`, `predictionComputeService.ts:261` i `:444`, `valuationComputeService.ts:340`.
Ale **każdy z nich to self-claim w tej samej funkcji, która przed chwilą sama zrobiła `enqueue()`** — synchroniczny, in-process, w cyklu request-response. To nie jest pula workerów. **Nie istnieje żaden proces, który podejmuje zadanie, którego sam nie zakolejkował.** Praktyczna konsekwencja jest dokładnie taka, jak w tezie briefu, tylko z innej przyczyny: zadanie, które trafi z powrotem do `queued` (przez `failJob`) albo zostanie porzucone, **nie zostanie podjęte przez nic i nigdy**.

### 3.2 Wyniki scenariuszy

| # | Scenariusz | Wynik | Co zmierzono |
| --- | --- | --- | --- |
| B1 | Zadanie porzucone, lease wygasa | **EVIDENCE_MISSING** | Po wygaśnięciu lease job **zostaje w `running` na zawsze**, z `lease_owner` wskazującym na nieistniejącego workera. `claim()` już go nie zobaczy (zapytanie patrzy tylko na `status='queued'`) — zadanie jest trwale nieosiągalne. `compute_job_runs.outcome` pozostaje `NULL`. Brak podwójnego wyniku — trywialnie, bo nie ma też pierwszego |
| B1b | Czy sama *procedura odzysku* jest poprawna | **PASS** | `UPDATE` reapera z §5.3 zastosowany ręcznie → job wraca do `queued`, `claim()` bierze go jako **próba 2**, `completeJobSuccess()` daje **dokładnie jeden** `compute_job_outputs` (`committed_by_attempt_number = 2`), dwa wiersze prób w audycie. **Brakuje tylko tego, kto ma ten UPDATE wykonać** |
| B2 | Zabicie między obliczeniem a commitem | **PASS** | Transakcja przerwana przed COMMIT → **zero** częściowego wyniku (sprawdzone też po sierocym `content_semantic_hash`). Po `failJob` + retry: **dokładnie jeden** wiersz wyniku, przypisany do próby 2, job `succeeded`, `finished_at` ustawione |
| B2b | At-least-once: „zmartwychwstały" worker też commituje | **PASS** | Drugi commit odrzucony **typowanym** `NOT_RUNNING`/`OUTPUT_ALREADY_COMMITTED`, nigdy surowym 23505. W bazie nadal jeden wynik |
| B3 | Duplikat zgłoszenia (ten sam klucz idempotencji) | **PASS** | Sekwencyjnie: 1 wiersz, drugi `wasExisting=true`, ten sam `job.id`. **Współbieżnie** (realny podwójny klik, `Promise.allSettled`): 1 wiersz, oba wywołania `fulfilled`, ten sam `job.id`, dokładnie jeden `wasExisting=false`. Ścieżka `ON CONFLICT DO NOTHING` + read-back **nie** wywala się pod READ COMMITTED |
| B4 | Anulowanie w trakcie | **PASS z defektem** | Status `cancelled`, `cancel_requested_at` ustawione, spóźniony `completeJobSuccess()` odrzucony `NOT_RUNNING`, **zero** zapisanych wyników. Anulowany job nie jest wskrzeszany przez kolejny `claim()`. Defekt księgowania: **W9-B-1** poniżej |
| B-extra | Wyczerpanie retry / DLQ (§10) | **PASS** | `max_attempts=2`: próba 1 → `queued` z backoffem, próba 2 → terminal `failed`, `finished_at` ustawione, `lease_owner` wyczyszczony, obie próby zamknięte jako `failed`, zero wyników. Predykat DLQ (`failed AND attempt_count >= max_attempts`) spełniony |

**Zmierzony backoff:** `failJob` ustawia `next_attempt_at = now() + 30 s × attempt_count` (liniowy). W testach zegar jest przewijany po stronie testu (`UPDATE ... SET next_attempt_at = now()`) — jawnie, z komentarzem, żeby nikt nie wziął tego za zachowanie produkcyjne.

---

## 4. Część C — Macierz izolacji tenantów

Dwie organizacje **A** i **B** z lustrzanym zestawem danych (te same kształty, różne wartości-znaczniki: A = 1000, B = 9999 — dzięki temu wyciek rozpoznaje się po **wartości**, nie tylko po identyfikatorze). Każda rodzina sprawdzona na dwóch poziomach: **(i) zapytania** (reprezentatywny SELECT/UPDATE z predykatem `organization_id = A` i identyfikatorem B) oraz **(ii) serwisu** (realny publiczny punkt wejścia wywołany z `organizationId: A` i identyfikatorem B).

### 4.1 Macierz — wynik per rodzina

| # | Rodzina tabel | Poziom zapytania | Poziom serwisu | Werdykt |
| --- | --- | --- | --- | --- |
| 1 | `finance_artifacts` / `finance_business_versions` | PASS (0 wierszy) | PASS — `getArtifact`/`getBusinessVersion`/`listBusinessVersions` → `null`/`[]`; `transition`/`approveVersion`/`reopenVersion` → typowane `NOT_FOUND`; wiersz B bajt w bajt bez zmian (status, wersja, `updated_at`) | **PASS** |
| 2 | `finance_stmt_*` (entities/periods/lines) | PASS (SELECT 0, UPDATE `changes=0`, wartość B nietknięta) | **FAIL** — `baselineComputeService.loadContext()` zwraca dane B (**W9-C-1**) | **FAIL (odczyt)** |
| 3 | `finance_analysis_*` | PASS (0 wierszy) | PASS z zastrzeżeniem — `computeAnalysisKpis` **zamyka się poprawnie** (guard na `getBusinessVersion(org, ...)`), ale rzuca **nietypowanym** `Error` zamiast `{ok:false}` (**W9-C-6**). Wartość KPI B nietknięta | **PASS (z długiem)** |
| 4 | `finance_baseline_*` | PASS (SELECT 0, UPDATE `changes=0`) | **FAIL na odczycie** (**W9-C-1**); **zapis zablokowany** przez złożony FK `fk_finance_baseline_outputs_bv_org` (surowy 23503, nie typowany błąd serwisu) | **FAIL (odczyt)** |
| 5 | `finance_prediction_*` | PASS (0 wierszy) | **FAIL na odczycie** — `runPreflight` czyta scenariusz B; zapis powstrzymany **wyłącznie** przez `fk_finance_prediction_preflight_runs_bv_org` (**W9-C-2**). Nic nie zostało utrwalone | **FAIL (odczyt)** |
| 6 | `finance_valuation_*` | PASS dla `methods`/`wacc_inputs`/`advisor_outputs` | **FAIL ×2** — `findOrCreateMethod` zwraca metodę B (**W9-C-3**); `writeSensitivityGrid` **kasuje i podmienia 25 komórek B** (**W9-C-4**, mutacja destrukcyjna) | **FAIL (odczyt + zapis)** |
| 7 | `finance_exceptions` | PASS (0 wierszy) | PASS — `getCurrent` → `null`, `listOpen(A)` nie zawiera grupy B, `accept`/`waive`/`resolve` → typowane `GROUP_NOT_FOUND`; wyjątek B nadal ma dokładnie jedno zdarzenie `RAISED` | **PASS** |
| 8 | `compute_jobs` / `_runs` / `_outputs` | PASS (0 wierszy) | **FAIL (P0)** — `getJob()` i `cancelJob()`/`failJob()` **nie mają parametru `organizationId`** (**W9-C-5**): A czyta job B i **anuluje** go. `compute_job_outputs` jest chroniony złożonym FK `fk_compute_job_outputs_artifact_org` | **FAIL (odczyt + mutacja)** |

**Przekrojowo:** w schemacie jest **zero polityk RLS** i **zero tabel z włączonym `relrowsecurity`** dla `finance*`/`compute*`. Izolacja jest wyłącznie aplikacyjna — nie ma dolnej warstwy, na którą można by ją zrzucić. Zweryfikowane zapytaniem, nie założone.

### 4.2 Strukturalna przyczyna (W9-C-7)

Tam, gdzie izolacja trzyma mimo braku predykatu w serwisie, trzyma ją **złożony klucz obcy** `(business_version_id, organization_id) → uq_finance_bv_id_org` (albo `(artifact_id, organization_id)`). Tabele Finance, które **mają kolumnę `organization_id`, ale nie mają takiego klucza**, to dokładnie te, gdzie wyciek się materializuje:

```
finance_valuation_cases
finance_valuation_comps
finance_valuation_ev_equity_bridge_components
finance_valuation_sensitivity_cells      <-- tu wylądował W9-C-4
finance_valuation_sensitivity_grids      <-- tu wylądował W9-C-4
finance_valuation_terminal
finance_baseline_backtest_line_results
finance_analysis_kpi_catalog             (globalny katalog — świadomie)
finance_stmt_calendars / finance_stmt_periods  (skalowane tylko org FK — poprawnie)
finance_artifacts / finance_candidate_handoffs / finance_legal_holds /
finance_post_investment_reviews / finance_retention_policies /
finance_comment_assignments / finance_lineage_freshness_events
```

Wzorzec: **tabela-dziecko skalowana identyfikatorem rodzica (`method_id`, `grid_id`, `job_id`) z zdenormalizowaną, niczym nieweryfikowaną kolumną `organization_id` podawaną przez wywołującego.** Ta lista jest zapięta asercją w teście (dla prefiksu `finance_valuation%`), więc dodanie brakującego FK — czyli naprawa — świadomie zapali test na czerwono i zmusi do powrotu do tej macierzy.

---

## 5. Część D — Pomiar wydajnościowy (FC-11)

### 5.1 Metoda

- Własny efemeryczny klaster, **świeżo zmigrowany**, nic innego na nim nie działa.
- Fixture w skali **GoldCo Manufacturing S.A. (PARENT, FY2025)** — te same liczby, których używa `GOLDCO_FULL_DAG_END_TO_END_REPORT.md`: przychód 182 mln PLN, COGS 118 mln, OPEX 34 mln, bilans otwarcia 158 mln aktywów (spina się: A = L + E).
- **Jedna iteracja rozgrzewkowa, odrzucana** (pierwsze wywołanie płaci rozgrzewkę puli połączeń i JIT).
- **N mierzonych iteracji, każda na ŚWIEŻEJ wersji biznesowej.** Powtórka na tej samej wersji nie jest drugą próbką: `enqueue` jest idempotentny, a tabele wyników mają unikalność per komórka — iteracja 2 mierzyłaby inną ścieżkę kodu.
- Mierzone `performance.now()` **wyłącznie wokół wywołania serwisu**; budowa fixture'u poza stoperem.
- p50/p95 metodą **nearest-rank** na posortowanej próbce; min/max/rozrzut podane, żeby czytelnik widział dyspersję.

### 5.2 Wyniki — przebieg n=20 (rekomendowany do cytowania)

| Ścieżka | n | **p50** | **p95** | min | max | rozrzut (max−min)/p50 |
| --- | --- | --- | --- | --- | --- | --- |
| **D1** Baseline compute — 12 okresów miesięcznych, 372 wiersze wyniku/przebieg, realny solver cyrkularności | 20 | **205,5 ms** | **336,8 ms** | 146,6 ms | 370,6 ms | 109 % |
| **D2** Analysis KPI compute — pełne **18 z 18** wskaźników katalogu P0 | 20 | **18,0 ms** | **26,4 ms** | 11,7 ms | 26,8 ms | 84 % |
| **D3a** Valuation DCF/FCFF — 3 lata projekcji (EV = 201 589 069 PLN) | 20 | **49,4 ms** | **155,2 ms** | 36,9 ms | 214,0 ms | 359 % |
| **D3b** Utrwalenie siatki sensitivity 5×5 (25 komórek) | 20 | **25,8 ms** | **81,3 ms** | 10,5 ms | 111,8 ms | 393 % |
| **D3** Valuation **z** siatką 5×5 (D3a + D3b) | 20 | **93,7 ms** | **204,7 ms** | 49,8 ms | 248,9 ms | 213 % |

### 5.3 Drugi, niezależny przebieg n=12 — dla uczciwości wobec zmienności maszyny

| Ścieżka | n | p50 | p95 | min | max |
| --- | --- | --- | --- | --- | --- |
| D1 Baseline | 12 | 461,9 ms | 867,7 ms | 313,1 ms | 867,7 ms |
| D2 KPI (18) | 12 | 29,9 ms | 46,9 ms | 21,6 ms | 46,9 ms |
| D3a Valuation DCF | 12 | 51,7 ms | 202,0 ms | 29,3 ms | 202,0 ms |
| D3b Siatka 5×5 | 12 | 19,8 ms | 49,1 ms | 11,3 ms | 49,1 ms |
| D3 Valuation + siatka | 12 | 75,1 ms | 215,5 ms | 43,3 ms | 215,5 ms |

**Jak to czytać — trzy zastrzeżenia, których nie wolno pominąć:**

1. **Rozrzut jest duży** (84–393 % mediany). To nie jest szum pomiaru do zignorowania — to realna zmienność na laptopie z współdzielonym CPU i rosnącą w trakcie przebiegu tabelą wyników. Liczby są **punktem odniesienia dla tej maszyny i tego przebiegu**, nie deklaracją SLO.
2. **Przy n=12 p95 metodą nearest-rank = maksimum próbki** (`ceil(0.95×12) = 12`). Dlatego kolumna p95 w tabeli 5.3 jest identyczna z max. Przy n=20 (`ceil(0.95×20) = 19`) p95 jest już 19. z 20 wartości i nie degeneruje się do maksimum — dlatego **do cytowania rekomendujemy przebieg n=20**.
3. **Międzyprzebiegowa różnica D1 jest 2,2×** (206 ms vs 462 ms mediany). Zanim ktokolwiek zadeklaruje SLO na podstawie tych liczb, pomiar trzeba powtórzyć na stabilnym runnerze CI, nie na laptopie.

### 5.4 Brak progu — `EVIDENCE_MISSING`

Bramka FC-11 wymaga „declared SLO p50/p95/p99". **Żadna liczba nie jest zadeklarowana.** Sprawdzone:

- W całym `FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` jedyny liczbowy cel wydajnościowy dotyczy **UI**, nie compute: „≥45 FPS, input p95 <100 ms" dla siatki 10k×120 komórek (§ dot. AP-01). To nie jest SLO compute.
- W schemacie istnieje tabela `observability_slos`, ale to konstrukt **dostępnościowy** (`target_percentage`, `window_days`, `budget_remaining`) — **nie ma ani jednej kolumny latencji** (`%latency%`/`%p50%`/`%p95%`/`%p99%`/`%_ms`) — i jest **pusta (0 wierszy)**.

Wszystkie trzy fakty są zapięte asercjami w `perfSlo.pg.test.ts`, żeby dodanie progu w przyszłości zapaliło test i wymusiło porównanie pomiaru z progiem. W testach nie ma bramki czasowej poza **sanity ceiling 30 s** — regresja 100× wywali build, dryf 20 % nie, bo nie ma budżetu, do którego można by go przyłożyć.

---

## 6. Wszystkie znalezione defekty, z reprodukcją

Klasyfikacja: **P0** = naruszenie granicy tenanta z mutacją; **P1** = naruszenie granicy tenanta z odczytem albo utrata/przekłamanie danych operacyjnych; **P2** = dług jakości sygnału błędu.

---

### W9-C-5 — `computeJobService` nie zna pojęcia organizacji (P0, mutacja międzytenantowa)

**Co jest nie tak.** `getJob(jobId)`, `cancelJob(jobId, reason)` i `failJob({jobId, error})` **nie przyjmują `organizationId`** — ani jako parametru, ani jako predykatu SQL. Każdy, kto zna (albo zgadnie) identyfikator zadania, może je odczytać i **anulować**.

**Reprodukcja** (`tenantMatrix.pg.test.ts`, rodzina 8):
```ts
// org B kolejkuje własne zadanie
const job = await computeJobService.enqueue({ organizationId: B.orgId, /* ... */ });

// aktor z org A, bez żadnego kontekstu B:
const leaked = await computeJobService.getJob(job.job.id);
//  -> zwraca wiersz B, z jego organization_id i input_revision_hash

const cancelled = await computeJobService.cancelJob(job.job.id, 'cancel by another tenant');
//  -> { status: 'cancelled' }; odczyt niezależny potwierdza:
//     compute_jobs.status = 'cancelled', cancel_reason = 'cancel by another tenant'
```
**Dlaczego nic tego nie łapie.** `compute_jobs` **ma** złożony FK `fk_compute_jobs_artifact_org`, ale on pilnuje tylko spójności przy INSERT — nie ma nic wspólnego z tym, kto później czyta i aktualizuje wiersz po kluczu głównym.

**Sugerowany kierunek naprawy (nie wykonany — to zadanie mierzy, nie zmienia):** dodać wymagany `organizationId` do sygnatur `getJob`/`cancelJob`/`failJob` i predykat `AND organization_id = ?` do ich zapytań. `claim()` zostaje bez zmian — jest międzyorganizacyjny **z założenia** (pula workerów bierze po `job_type`), co ADR B04 i istniejący `canonicalServices.pg.test.ts` dokumentują wprost.

---

### W9-C-4 — `writeSensitivityGrid()` pozwala organizacji A skasować i podmienić siatkę organizacji B (P0, mutacja destrukcyjna)

**Co jest nie tak.** Funkcja robi upsert po `(method_id, grid_label)`, a potem `DELETE FROM finance_valuation_sensitivity_cells WHERE grid_id = ?` — **żadne z tych zdań nie ma predykatu `organization_id`** (`valuationSensitivityService.ts:167` i `:180`). Ani `finance_valuation_sensitivity_grids`, ani `..._cells` nie mają złożonego FK `(rodzic, organization_id)`, więc baza też tego nie zatrzyma.

**Reprodukcja** (`tenantMatrix.pg.test.ts`, rodzina 6):
```ts
// 1. B zapisuje własną siatkę — 25 komórek, wszystkie z organization_id = B
await writeSensitivityGrid({ organizationId: B.orgId, methodId: B.methodId,
                             gridLabel: 'W9C_WACC_X_G', cells /* 25 */, createdBy: B.userId });
// dowód fizyczny: 25 komórek należących do B

// 2. A zapisuje siatkę o TEJ SAMEJ etykiecie na metodzie B
await writeSensitivityGrid({ organizationId: A.orgId, methodId: B.methodId,
                             gridLabel: 'W9C_WACC_X_G', cells /* 25 */, createdBy: A.userId });

// 3. odczyt niezależny:
//    komórek należących do B: 0        <-- DANE B SKASOWANE
//    komórek należących do A: 25       <-- na siatce B
```
**Skala szkody.** To nie jest tylko podejrzenie odczytu — to **trwała utrata danych innego najemcy**, bez żadnego śladu w audycie (tabele siatek nie są append-only).

---

### W9-C-1 — `baselineComputeService.loadContext()` czyta dane innej organizacji (P1)

**Co jest nie tak.** Funkcja filtruje po `organizationId` **tylko** `finance_stmt_periods`. Pozostałe odczyty idą po samym `business_version_id`/`entity_id`:
`finance_baseline_models` (`:201`), `finance_business_versions` (`:208`), `finance_stmt_lines` — historia przychodu (`:231`) i bilans otwarcia (`:241`), `finance_baseline_schedules` (`:251`), `finance_baseline_assumptions` (`:258`).

**Reprodukcja** (`tenantMatrix.pg.test.ts`, rodzina 2):
```ts
const loaded = await baselineComputeService.loadContext({
  organizationId: A.orgId,               // kontekst organizacji A
  businessVersionId: B.baselineBvId,     // wersja należąca do organizacji B
  entityId: B.entityId, forecastPeriodIds: [B.periodId],
  openingBalanceSheetPeriodId: B.periodId, /* ... */
});
// loaded.ok === true
// loaded.ctx.model.organization_id === B.orgId
// loaded.ctx.assumptions.get('revenue_pvm::REVENUE_GROWTH_YOY') === znacznik B
// loaded.ctx.schedulesByType.get('debt_maturity')[0].payload.principal_opening === znacznik B
```
Kontrola pozytywna w tym samym pliku: to samo wywołanie **z kontekstu B** zwraca te same dane — czyli wyciek nie jest artefaktem zepsutego fixture'u.

**Co ogranicza szkodę (i czego nie ogranicza).** `runBaselineCompute()` używający tego kontekstu **nie zapisze** wyniku pod cudzą wersję: `fk_finance_baseline_outputs_bv_org` odrzuci INSERT (surowy 23503). Czyli to jest **wyciek odczytu** — ale odczytu **kompletnego modelu finansowego innej firmy**: założeń, harmonogramu długu i bilansu otwarcia.

---

### W9-C-3 — `valuationComputeService.findOrCreateMethod()` zwraca metodę innej organizacji (P1)

**Reprodukcja** (`tenantMatrix.pg.test.ts`, rodzina 6):
```ts
const method = await findOrCreateMethod({ organizationId: A.orgId,
                                          businessVersionId: B.valuationBvId,
                                          methodType: 'DCF_FCFF', createdBy: A.userId });
// method.id === B.methodId ; method.organization_id === B.orgId
```
**Przyczyna:** `valuationComputeService.ts:70` — `SELECT * FROM finance_valuation_methods WHERE business_version_id = ? AND method_type = ?`, bez `organization_id`. To jest też **wektor prowadzący do W9-C-4**: mając `methodId` cudzej organizacji, kolejny krok (siatka) już kasuje dane.

---

### W9-C-2 — `predictionPreflightService.runPreflight()` czyta scenariusz innej organizacji; broni dopiero baza (P1)

**Reprodukcja** (`tenantMatrix.pg.test.ts`, rodzina 5):
```ts
await runPreflight({ organizationId: A.orgId, businessVersionId: B.predictionBvId, runBy: A.userId });
// rzuca: violates foreign key constraint "fk_finance_prediction_preflight_runs_bv_org"
// -> nic nie zostało utrwalone (0 wierszy w finance_prediction_preflight_runs), ALE
//    serwis przeszedł przez odczyt scenariusza B i wykrywanie nakładek na jego danych
```
**Przyczyna:** `predictionPreflightService.ts:141` — `SELECT ... FROM finance_prediction_scenarios WHERE business_version_id = ?`, bez `organization_id`. Obrona wielowarstwowa działa, ale **warstwa serwisu nie egzekwuje granicy**, a wywołujący dostaje surowy błąd Postgresa zamiast typowanej odmowy.

---

### W9-B-1 — anulowanie działającego zadania zostawia księgowanie otwarte na zawsze (P1)

**Co jest nie tak.** `cancelJob()` ustawia `status='cancelled'` i `cancel_requested_at`, ale **nie** ustawia `finished_at`, **nie** zwalnia `lease_owner`/`lease_expires_at` i **nie** zamyka bieżącego wiersza `compute_job_runs` — mimo że schemat ma w enumie `outcome` wartość `'cancelled'` dokładnie na tę okazję.

**Reprodukcja** (`faultMatrix.pg.test.ts`, B4):
```ts
await claim({ workerId: 'w', jobTypes: [jobType], limit: 1 });
await cancelJob(jobId, 'reason');
// compute_jobs:      status='cancelled', finished_at IS NULL, lease_owner='w'  <-- lease nigdy nie zwolniony
// compute_job_runs:  outcome IS NULL, finished_at IS NULL                       <-- próba nigdy nie zamknięta
```
**Konsekwencja praktyczna.** Każde zapytanie „ile trwały zadania" / „jak kończyły się próby" po `compute_job_runs` **cicho zaniża** — anulowane próby wyglądają jak wiecznie trwające. To jest dokładnie ten rodzaj przekłamania, który później podaje się jako metrykę.

---

### W9-C-6 — `computeAnalysisKpis()` zamyka się poprawnie, ale nietypowanym wyjątkiem (P2)

Funkcja ma pełen typowany zestaw `{ok:false, code}` na swoje tryby awarii, ale naruszenie granicy tenanta rzuca gołym `Error('kpiComputeService: business_version <id> not found')`. Warstwa HTTP zamapuje to na **500**, a nie 404 — czyli naruszenie granicy najemcy wygląda jak awaria serwera. Izolacja **trzyma** (guard idzie przez org-scoped `getBusinessVersion`), więc to dług sygnału, nie dziura.

---

### W9-B-2 — wynik `completeJobSuccess()` jest ignorowany przez trzy z czterech serwisów compute (P2)

`completeJobSuccess()` zwraca typowany `{ok:false, code:'NOT_RUNNING'|'OUTPUT_ALREADY_COMMITTED'}`. Ignorują go:
`baselineComputeService.ts:~640`, `kpiComputeService.ts:486`, `predictionComputeService.ts:273` i `:664` (`await` bez przypisania). `valuationComputeService.ts:344` sprawdza `completed.ok`, ale i tak zwraca `{ok: true}` do wywołującego.

**Skutek.** Jeśli job został w międzyczasie anulowany albo wynik już zacommitowano, serwis compute **i tak zgłosi sukces** — a wyniku w `compute_job_outputs` nie będzie. To jest kanoniczny „fałszywy sukces" z reguły złotej nr 1 tego programu.

---

## 7. Lista `EVIDENCE_MISSING`

| Id | Element | Wymagany przez | Stan |
| --- | --- | --- | --- |
| EM-1 | **Reaper wygasłych lease** | WP-B04 §5.3 | Nie istnieje. Porzucone zadanie zostaje w `running` na zawsze i staje się nieosiągalne dla `claim()`. Procedura odzysku sama w sobie **jest poprawna** (udowodnione w B1b) — brakuje wyłącznie tego, kto ma ją uruchomić |
| EM-2 | **Heartbeat** | WP-B04 §5.2 | Nie istnieje. `compute_job_runs.last_heartbeat_at` nigdy nie rośnie, `lease_expires_at` nigdy nie jest przedłużany. Bez EM-1 nie ma to dziś konsekwencji, ale razem z EM-1 zablokuje odzysk |
| EM-3 | **Kill switch** `is_org_compute_killed()` | WP-B04 §5.1/§7.2 | Brak funkcji SQL i brak odpowiednika aplikacyjnego. Migracja WP-C01 przyznaje to w nagłówku |
| EM-4 | **Limit współbieżności per organizacja** `org_concurrency_limit()` | WP-B04 §5.1/§8 | Brak. Zmierzone: 6 zadań jednej organizacji claimowanych jednym wywołaniem, żaden limit nie jest konsultowany |
| EM-5 | **Pętla workera / demon drenujący kolejkę** | WP-B04 §5, master plan §2.3 | Nie istnieje. `claim()` woływany wyłącznie in-process przez serwis, który sam przed chwilą zrobił `enqueue()`. Zadanie w `queued` nie zostanie podjęte przez nic |
| EM-6 | **Wpis w exception ledger przy dead-letter** | WP-B04 §10 (WP-B05 jako konsument) | `failJob()` nie dotyka `finance_exceptions`. Zmierzone: 0 wierszy po dead-letterze |
| EM-7 | **Zadeklarowany liczbowy SLO compute (p50/p95/p99)** | FC-11 | Nie istnieje nigdzie: ani w dokumentach programu (jedyny liczbowy cel to UI-owe „≥45 FPS / input p95 <100 ms"), ani w schemacie (`observability_slos` = konstrukt dostępnościowy bez kolumny latencji, 0 wierszy). Pomiary z §5 są **punktem odniesienia**, nie oceną |
| EM-8 | **Dashboardy, alerty, runbooki** | FC-11 | Poza zakresem tego pakietu; nie badane, nadal bez dowodu |
| EM-9 | **RLS / wymuszenie tenanta na poziomie bazy** | FC-01 (implikowane) | Zero polityk, zero tabel z `relrowsecurity` dla `finance*`/`compute*`. Izolacja wyłącznie aplikacyjna — i w pięciu miejscach nieegzekwowana (§4) |

---

## 8. Reprodukcja całości

```bash
# 1. Efemeryczny PostgreSQL 15 (NIE @16). NIE w katalogu scratchpada — patrz §1.
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA=/private/tmp/w9faultmatrix-pgdata ; PGSOCK=/tmp/w9pgsock ; PORT=57431   # lsof-sprawdzony
rm -rf "$PGDATA" "$PGSOCK" && mkdir -p "$PGDATA" "$PGSOCK"
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" \
  -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" -l /tmp/w9_pg.log start
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE w9_faultmatrix;"
DBURL="postgresql://postgres@127.0.0.1:$PORT/w9_faultmatrix"

# 2. Migracje STRICT (bez --safe)
NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" \
  npx tsx server/scripts/migrate.postgres.ts            # -> exit 0

# 3. Cztery pakiety W9
cd server && DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" \
  npx vitest run --config vitest.config.ts \
    src/services/finance/canonical/__tests__/concurrencyMatrix.pg.test.ts \
    src/services/finance/canonical/__tests__/faultMatrix.pg.test.ts \
    src/services/finance/canonical/__tests__/tenantMatrix.pg.test.ts \
    src/services/finance/canonical/__tests__/perfSlo.pg.test.ts \
    --no-file-parallelism
# -> Test Files 4 passed (4) ; Tests 46 passed (46)

# 3b. KONTROLA NEGATYWNA bramki (musi dać skipped, nie passed)
cd server && NODE_ENV=test npx vitest run --config vitest.config.ts \
  src/services/finance/canonical/__tests__/tenantMatrix.pg.test.ts
# -> Tests 24 skipped (24)

# 4. Pomiar D z zapisem maszynowym i większym n
cd server && W9_PERF_REPS=20 W9_PERF_OUT=/tmp/w9_perf.jsonl \
  DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" \
  npx vitest run --config vitest.config.ts \
    src/services/finance/canonical/__tests__/perfSlo.pg.test.ts --no-file-parallelism

# 5. Regresja: cały katalog canonical
cd server && DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" \
  npx vitest run --config vitest.config.ts src/services/finance/canonical --no-file-parallelism
# -> Test Files 30 passed (30) ; Tests 416 passed (416)

# 6. Sprzątanie
$PGBIN/pg_ctl -D "$PGDATA" -m fast stop && rm -rf "$PGDATA" "$PGSOCK"
```

---

## 9. Commity

Baza gałęzi: `1271a0f721`. **Nic nie wypchnięte.**

| SHA | Partia | Zawartość |
| --- | --- | --- |
| `f43739b345` | A | `concurrencyMatrix.pg.test.ts` — 4 wyścigi, dokładnie jeden zwycięzca |
| `d73d0900e6` | B | `faultMatrix.pg.test.ts` — 14 testów: fault injection na kolejce + brakujące elementy kontraktu zapięte jako fakty |
| `b61a991889` | C | `tenantMatrix.pg.test.ts` — 24 testy: macierz izolacji, 5 defektów międzytenantowych |
| `803de0a620` | D | `perfSlo.pg.test.ts` — 4 testy: pomiar p50/p95 dla trzech ścieżek compute |
| — | raport | ten plik |

---

## 10. Co powinno stać się dalej (propozycja, nie wykonanie)

1. **Najpierw P0.** `getJob`/`cancelJob`/`failJob` dostają wymagany `organizationId` i predykat SQL; `writeSensitivityGrid` dostaje predykat `organization_id` w upsercie i w `DELETE`, a `finance_valuation_sensitivity_grids`/`_cells`/`_terminal`/`_comps` dostają złożony FK do rodzica razem z organizacją. **Uwaga:** ta druga zmiana świadomie zapali asercję `STRUKTURAL W9-C-7` — to zaprojektowany sygnał „wróć do macierzy", nie regresja.
2. **Potem P1 odczytowe.** `loadContext`, `findOrCreateMethod`, `runPreflight` — predykat `organization_id` w każdym zapytaniu i typowana odmowa zamiast surowego 23503.
3. **Dopiero potem kolejka.** Reaper (EM-1) ma gotową, udowodnioną procedurę (B1b) — brakuje procesu, który ją odpala; razem z nim heartbeat (EM-2), bo bez heartbeatu reaper zabierze lease żywemu workerowi.
4. **Na końcu SLO.** Powtórzyć pomiar §5 na stabilnym runnerze CI (nie laptopie — patrz zastrzeżenie o rozrzucie 2,2×), zadeklarować progi p50/p95/p99, a potem przykręcić `perfSlo.pg.test.ts` do tych progów zamiast do sanity ceiling 30 s.

**Nic z powyższego nie zostało w tym pakiecie zrobione — zgodnie z zakresem zadania, które mierzy istniejący system, a nie go zmienia.**
