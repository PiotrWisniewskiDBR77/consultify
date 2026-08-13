# W3 — konsolidacja liczenia hasha treści (`content_semantic_hash`) + rozstrzygnięcie "canonical"

**Worktree:** `/Users/piotrwisniewski/consultify-wt/w3-hashconsol`
**Gałąź:** `codex/finance-v3-w3-hashconsol`
**SHA startowy:** `6612f862ca` (branch tip w chwili startu — `docs(gate-d): session handoff 2026-08-11 — candidate SHA 8db62fa385`)
**SHA końcowy (po pracy, przed commitem raportu):** patrz `git log -1` w chwili commitu tego pliku.
**Data:** 2026-08-10/11.
**Baza dowodowa:** efemeryczny PostgreSQL 15, port `57771`, `PGDATA=/private/tmp/fv3-hc-pgdata`, baza `fv3_hc` (+ pomocnicze `fv3_hc2`/`fv3_hc3` tylko do powtórki migracji STRICT, usunięte po pracy).

---

## 1. Streszczenie

- **4 silniki compute konsolidowane**, zgodnie z zadaniem: `baselineComputeService.ts`, `kpiComputeService.ts`,
  `valuationComputeService.ts`, `predictionComputeService.ts` (dwa miejsca w tym samym pliku) — wszystkie pięć
  wklejonych `createHash('sha256').update(JSON.stringify(X)).digest('hex')` (rola: `content_semantic_hash`)
  zastąpione importem `canonicalPayloadHash(X)` z `./contentHash.js`.
- **5 miejsc świadomie NIE skonsolidowanych** — inna rola (klucz idempotencji / odcisk wejścia / digest
  dowodowy AI / weryfikacyjny digest testowy), nie `content_semantic_hash`. Szczegóły w tabeli §2.
- **Sprawa "canonical" (sortowanie kluczy):** zbadana empirycznie w kodzie — **żaden dzisiejszy producent nie
  buduje payloadu w niestabilnej kolejności kluczy JSON**. Rekomendacja: **NIE zmieniać algorytmu**
  `canonicalPayloadHash`. Uzasadnienie i jedno realne (ale INNE — nie key-order) ryzyko znalezione po drodze:
  §4.
- **Dowód niezmienności hashy:** empiryczny, na żywej bazie, w jednym przebiegu — legacy inline expression vs
  `canonicalPayloadHash` na TYCH SAMYCH, realnie obliczonych payloadach ze wszystkich 4 silników dały
  identyczny wynik. Szczegóły §5.
- **Strażnik:** nowy test `hashConsolidationGuard.test.ts` (statyczna analiza źródeł, bez bazy), kontrola
  negatywna w obie strony wykonana i udokumentowana. §6.
- **Zero regresji**: `tsc -p server` exit 0/0 linii; `finance/canonical` 34/34 plików, 446/446 testów (33/33,
  444/444 + 1 nowy plik strażnika, 2 nowe testy); `services/finance` 44/44, 714/714; migracje STRICT exit 0.
  Jeden **znany, niezwiązany z tą zmianą** flaky test (`faultMatrix.pg.test.ts` — lease-expiry timing) —
  udokumentowany w §7, nie mój defekt.
- **Punkt kolizji z innym agentem** (backfill/eksport, `finance_export_manifests`): §8 — brak konfliktu
  plikowego, ale jest UWAGA na przyszłość.

---

## 2. Inwentaryzacja — wszystkie `createHash('sha256')` w `server/src/services/finance`

| # | Plik:linia (SHA startowy) | Payload (co dokładnie hashuje) | Kolumna DB / konsument | Rola | Decyzja |
|---|---|---|---|---|---|
| 1 | `canonical/contentHash.ts:32` | dowolny `payload` przekazany przez wywołującego | `content_semantic_hash` (wszędzie, przez wywołujących) | **Prymityw** — jedyna definicja algorytmu | Bez zmian — to jest cel konsolidacji |
| 2 | `canonical/baselineComputeService.ts:425` (`inputRevisionHash`) | `{businessVersionId, entityId, forecastPeriodIds}` — payload literalny, stała kolejność kluczy | `compute_jobs.input_revision_hash` + `idempotencyKey` string | **Klucz idempotencji** compute_jobs.enqueue — nie `content_semantic_hash` | **Świadomie zostawione inline** |
| 3 | `canonical/baselineComputeService.ts:670` (`contentSemanticHash`) | `monthlyResults: PeriodComputeSummary[]` — array budowany w pętli po `params.forecastPeriodIds` (kolejność od wywołującego, chronologiczna) | `finance_business_versions.content_semantic_hash` / `finance_working_revisions...` / `finance_compute_snapshots...` (przez `completeJobSuccess`) | **Hash treści** artefaktu | **SKONSOLIDOWANE** → `canonicalPayloadHash(monthlyResults)` |
| 4 | `canonical/kpiComputeService.ts:490` (`inputRevisionHash`) | `{businessVersionId, sourceVersionId, kpiValueIdsSorted}` — `kpiValueIdsSorted` jawnie `.sort()`-owany | `compute_jobs.input_revision_hash` + idempotencyKey | **Klucz idempotencji** | **Świadomie zostawione inline** |
| 5 | `canonical/kpiComputeService.ts:529` (`contentSemanticHash`) | `results: ComputedKpiResult[]` — literalne obiekty o stałej kolejności pól; kolejność ARRAY zależy od SQL bez `ORDER BY` (patrz §4.3 — osobne ryzyko, NIE key-order) | jw. | **Hash treści** | **SKONSOLIDOWANE** → `canonicalPayloadHash(results)` |
| 6 | `canonical/valuationComputeService.ts:369` (`inputRevisionHash`) | `{valuationBusinessVersionId, entityId, projectionYears, terminal}` | `compute_jobs.input_revision_hash` + idempotencyKey | **Klucz idempotencji** | **Świadomie zostawione inline** |
| 7 | `canonical/valuationComputeService.ts:397` (`contentSemanticHash`) | `{enterpriseValue, fcff: fcff.years}` — brak jakichkolwiek id-ów, czyste liczby/`fiscalYear` | jw. | **Hash treści** | **SKONSOLIDOWANE** → `canonicalPayloadHash({...})` |
| 8 | `canonical/predictionComputeService.ts:257` (`contentSemanticHash`, gałąź "baseline pass-through/reuse") | `baselineContentHashSource` — `{alreadyComputed:true, rows: existingRows}` (SQL `ORDER BY canonical_line_id, period_id`) LUB `{passthroughOf: job.id, monthlyResults}` | jw. | **Hash treści** | **SKONSOLIDOWANE** → `canonicalPayloadHash(baselineContentHashSource)` |
| 9 | `canonical/predictionComputeService.ts:475` (`inputRevisionHash`) | `{businessVersionId, entityId, forecastPeriodIds}` | `compute_jobs.input_revision_hash` + idempotencyKey | **Klucz idempotencji** | **Świadomie zostawione inline** |
| 10 | `canonical/predictionComputeService.ts:719` (`contentSemanticHash`, główny compute) | `periods: PeriodPredictionResult[]` — pętla po `forecastPeriodIds` (kolejność od wywołującego) | jw. | **Hash treści** | **SKONSOLIDOWANE** → `canonicalPayloadHash(periods)` |
| 11 | `canonical/predictionPreflightService.ts:279` (`assumptionSetSemanticHash`) | `{driverOverrides: [...tuples...], impactChain: [...tuples...]}` — **tablice krotek, nie obiekty** → brak ryzyka kolejności kluczy z definicji | `finance_prediction_preflight_runs.assumption_set_semantic_hash` (INNA kolumna niż `content_semantic_hash`) | **Odcisk zestawu założeń** — wykrywanie superseded preflight run, nie hash treści artefaktu | **Świadomie zostawione inline** |
| 12 | `canonical/valuationAdvisorService.ts:1316` (`evidenceDigest`) | `{ruleId, title, narrative, evidenceRef}`, wynik prefiksowany `'sha256:'` | `finance_valuation_advisor_outputs.ai_evidence_digest` (INNA kolumna) | **Digest dowodowy AI** — integralność jednego frozen finding'u, nie hash treści artefaktu; inny format (prefiks) | **Świadomie zostawione inline** |
| 13 | `financeCandidateHandoffCore.ts:146` (`computeSourceFingerprint`) | dowolny `payload`, obcięty do 16 hex znaków | brak jednej stałej kolumny — lineage/idempotency-integrity identifier w Phase-2 handoff | Explicite udokumentowane w JSDoc pliku jako "NOT a `content_semantic_hash`" | **Świadomie zostawione inline** |
| 14 | `canonical/__tests__/coldReopenReader.ts:78` (`digest`) | wynik własnej `canonicalize()` (KTÓRA sortuje klucze — patrz §4.2) nad pełnym payloadem odczytu | tylko wewnątrz testu W10 (FC-05.8/FC-07.9/FC-12.4), nie zapisywane do żadnej kolumny produkcyjnej | **Digest weryfikacyjny cold-reopen** — dowód "read-back == write", tylko testowy | **Świadomie zostawione** (plik testowy, inny cel) |

**Już wcześniej skonsolidowane (W10-D01, przed tym zadaniem, zweryfikowane bez zmian):**
`collaboration/autosaveService.ts`, `canonical/statementReconciliationService.ts`, `canonical/financeImportService.ts`,
`canonical/artifactVersionService.ts` (`EMPTY_WORKING_REVISION_CONTENT_HASH`) — wszystkie importują
`canonicalPayloadHash`/`EMPTY_WORKING_REVISION_CONTENT_HASH` z `contentHash.ts`. Strażnik (§6) ponownie asercjuje
ten fakt, żeby przyszła zmiana nie usunęła po cichu tego importu.

**Wynik:** 4 z 4 wskazanych przez orkiestratora silników skonsolidowane (5 wywołań `createHash('sha256')` →
`canonicalPayloadHash`, licząc dwa miejsca w `predictionComputeService.ts`). 5 pozostałych miejsc (idempotency
×4, evidence/fingerprint/test-digest ×3 liczone osobno — patrz wiersze 11-14) świadomie zostawionych z
udokumentowanym uzasadnieniem per wiersz.

---

## 3. Zmienione pliki (diff)

```
 server/src/services/finance/canonical/baselineComputeService.ts   |  3 ++-
 server/src/services/finance/canonical/contentHash.ts              | 33 ++++++++++++++++++++-
 server/src/services/finance/canonical/kpiComputeService.ts        | 13 ++++++++++++-
 server/src/services/finance/canonical/predictionComputeService.ts |  5 +++--
 server/src/services/finance/canonical/valuationComputeService.ts  |  3 ++-
 5 files changed, ~52 insertions(+), ~6 deletions(-)
 + 1 nowy plik: canonical/__tests__/hashConsolidationGuard.test.ts
```

Każda zmiana w 4 silnikach to: (a) 1 nowa linia importu `import { canonicalPayloadHash } from './contentHash.js';`,
(b) zamiana `createHash('sha256').update(JSON.stringify(X)).digest('hex')` → `canonicalPayloadHash(X)` w
miejscu (miejscach) `content_semantic_hash`. `kpiComputeService.ts` ma dodatkowo komentarz dokumentujący
świadomą decyzję "nie fixuję" dla ryzyka z §4.3 (patrz niżej) — stąd większy diff (+13/-1) niż w pozostałych
trzech silnikach. `contentHash.ts` ma dopisany JSDoc (§4.2) tłumaczący wprost, że "canonical" nie sortuje
kluczy — kod funkcji (`canonicalPayloadHash`) **niezmieniony co do bajta**, dopisana tylko dokumentacja.

Import `createHash` z `node:crypto` **zostaje** we wszystkich czterech silnikach — nadal używany przez
`inputRevisionHash` (rola: klucz idempotencji, świadomie nie skonsolidowana, patrz §2).

---

## 4. Sprawa "canonical" — czy `JSON.stringify`-owa zależność od kolejności kluczy jest realnym ryzykiem

### 4.1 Teza z zadania

`canonicalPayloadHash` robi `createHash('sha256').update(JSON.stringify(payload)).digest('hex')`.
`JSON.stringify` **jest** zależny od kolejności kluczy własnych obiektu (insertion order dla kluczy
string) — `{a:1,b:2}` i `{b:2,a:1}` dają różny tekst, więc różny hash, mimo identycznej "treści" semantycznej.
Nazwa "canonical" sugeruje, że to nie powinno mieć znaczenia — a dziś ma.

### 4.2 Czy REALNIE dochodzi do rozjazdu z powodu kolejności kluczy — dowód z kodu, nie z rozważań

Przejrzano **każdy** producent payloadu przekazywanego dziś do `canonicalPayloadHash()` (włącznie z tymi już
skonsolidowanymi wcześniej w W10-D01):

| Producent | Konstrukcja payloadu | Ryzyko kolejności kluczy? |
|---|---|---|
| `baselineComputeService.monthlyResults` | `monthlyResults.push({periodId, converged, iterationsUsed, cash, netIncome, qualityFlag})` — **literał**, stała kolejność pól za każdym razem | Nie |
| `kpiComputeService.results` | `results.push({kpiValueId, kpiCode, entityId, periodId, status, value, qualityFlag, detail})` — literał, identyczny w KAŻDEJ gałęzi (early-return MISSING i normalna ścieżka mają TĘ SAMĄ kolejność pól); końcowy `.map(r => ({...r, deltaVsPrior, deltaPctVsPrior}))` to spread NAD obiektem o zawsze tej samej kolejności → dopisane klucze zawsze na końcu, deterministycznie | Nie |
| `valuationComputeService.{enterpriseValue, fcff: fcff.years}` | `years.push({fiscalYear, status, ebit, depreciationAmortization, closingWorkingCapital, deltaWorkingCapital, capex, fcff, missingReason})` — literał, stała kolejność | Nie |
| `predictionComputeService.baselineContentHashSource` | `{alreadyComputed:true, rows}` LUB `{passthroughOf, monthlyResults}` — literały; `rows` z SQL **z `ORDER BY canonical_line_id, period_id`** | Nie |
| `predictionComputeService.periods` | `periods.push({periodId, values, varianceVsBaseline: variance})`; `values` — literał o stałej kolejności; `variance` budowany dynamicznym przypisaniem `variance[code] = ...` **ale w pętli po stałej tablicy literału `CANONICAL_CODES`** (`baselineComputeService.ts:111`), więc kolejność kluczy zawsze zgodna z tą stałą tablicą, niezależnie od tego, które kody akurat mają wartość | Nie |
| `statementReconciliationService` (już skonsolidowane) | `{totals, reconciliationRowCount}` — literał | Nie |
| `autosaveService` (już skonsolidowane) | `payload` — operation stack, budowany append-only | Nie (nie badane głębiej — poza zakresem tego zadania, nie dotknięte) |

**Nie znaleziono ŻADNEGO producenta**, który buduje obiekt przez `Object.fromEntries()` po `Map`, przez spread
warunkowy (`{...(cond ? {a:1} : {})}`), albo bezpośrednio z wyniku zapytania SQL o zmiennej kolejności
**kolumn** (żaden payload nie jest `SELECT *` zrzucony 1:1 do hasha — zawsze przechodzi przez jawną,
literalną projekcję pól w JS).

**Rekomendacja: NIE zmieniać algorytmu `canonicalPayloadHash`.** Klucz-order-dependence jest dziś **długiem
nazewniczym** ("canonical" to zbyt mocne słowo dla "sha256 po surowym `JSON.stringify`"), **nie żywym
defektem** — żaden istniejący producent go nie uruchamia. Zamiast zmieniać algorytm, dopisano **do
`contentHash.ts` ostrzeżenie w JSDoc** (patrz commit) tłumaczące ograniczenie wprost, żeby następny autor nowego
producenta wiedział, że MUSI budować payload w stałej kolejności kluczy (co i tak już robi każdy istniejący —
przez literały obiektowe) zamiast polegać na "canonical" robiącym to za niego.

Wzorzec **prawdziwie** kanonicznej (sortującej klucze, rekurencyjnej) serializacji **już istnieje w repo** —
`coldReopenReader.ts`'s `canonicalize()` (§2, wiersz 14) — i mógłby zostać przeniesiony do
`canonicalPayloadHash`, GDYBY ryzyko było realne. Nie jest — patrz §4.4 poniżej dla analizy ryzyka
unieważnienia, która i tak by to zdyskwalifikowała nawet gdyby ryzyko key-order było realne.

### 4.3 Inne, REALNE ryzyko znalezione po drodze (nie key-order — kolejność ARRAY z SQL)

`kpiComputeService.ts:481`: `SELECT * FROM finance_analysis_kpi_values WHERE business_version_id = ?` —
**bez `ORDER BY`**. Kolejność wierszy zwróconych przez Postgres dla zapytania bez `ORDER BY` **nie jest
gwarantowana** przez specyfikację (zależy od query plan — sequential vs index vs parallel scan, może się
zmienić po `VACUUM FULL`/`CLUSTER`/wzroście tabeli powodującym decyzję o parallel workerach). Ta kolejność
wierszy determinuje kolejność ITERACJI w `evaluateAllRows()` (`for (const row of deps.kpiValueRows)`), co z
kolei determinuje kolejność elementów w `results[]` — dokładnie payload hashowany jako `content_semantic_hash`.

**To jest realne ryzyko rozjazdu** (te same wartości KPI, inny hash), ale **INNEGO rodzaju** niż to, o które
pytało zadanie (kolejność kluczy JSON) — to kolejność ELEMENTÓW TABLICY z nieuporządkowanego zapytania SQL,
analogiczny mechanizm, inny poziom.

**Świadomie NIE naprawione.** Próbowano naprawić (`ORDER BY id`) i **cofnięto** po analizie: `id` w
`finance_analysis_kpi_values` to losowy UUID (`randomUUID` — patrz import `randomUUID as uuidv4` w tym samym
pliku), nieskorelowany z kolejnością insercji. Dodanie `ORDER BY id` **zmienia** faktyczną kolejność
zwracanych wierszy względem tego, co Postgres dziś typowo zwraca (sequential scan w kolejności fizycznej ≈
insercji, dla małej, niemodyfikowanej po zapisie tabeli) — czyli **zmienia wartość `content_semantic_hash`
przy najbliższym recompute** dla KAŻDEJ już istniejącej wersji analitycznej. To dokładnie ten sam rodzaj
ryzyka, o którym mówi §4.4/zadanie dla zmiany algorytmu hasha — więc zastosowano tę samą dyscyplinę: **nie
naprawiono, tylko udokumentowano w kodzie** (komentarz przy zapytaniu w `kpiComputeService.ts`) i w tym
raporcie, decyzja zostawiona właścicielowi.

**Rekomendacja dla właściciela:** jeśli to ma być naprawione, zrobić to jako OSOBNĄ, świadomą zmianę z
backfillem/re-computem WSZYSTKICH istniejących `HISTORICAL_ANALYSIS` working revisions (żeby ich
`content_semantic_hash` nie "zmienił się" bez realnej zmiany treści przy pierwszym recompute po naprawie) —
nie jako efekt uboczny konsolidacji hasha.

### 4.4 ★ Analiza ryzyka unieważnienia istniejących hashy (gdyby jednak zmieniać algorytm)

Nie dotyczy tej zmiany (algorytm `canonicalPayloadHash` NIE został zmieniony), ale udokumentowane na
wypadek gdyby ktoś later zdecydował inaczej niż rekomendacja §4.2:

- `content_semantic_hash` jest zapisany na `finance_business_versions`, `finance_working_revisions`,
  `finance_compute_snapshots` — trzy miejsca (patrz `contentHash.ts` nagłówek).
- `computePinning.ts` porównuje `current.content_semantic_hash` żywej working revision z hashem podanym przy
  pinowaniu computu — zmiana algorytmu oznacza, że **pinning istniejących, jeszcze niezamrożonych** working
  revisions zacznie fałszywie raportować "treść się zmieniła" (bo stary hash w bazie ≠ nowy hash policzony na
  identycznej treści przez nowy algorytm) — dokładnie ryzyko, przed którym ostrzega zadanie.
  `EMPTY_WORKING_REVISION_CONTENT_HASH` (stała eksportowana z `contentHash.ts`, używana w
  `artifactVersionService.createArtifact()`) też by się zmieniła — trzeba by przeliczyć i zweryfikować każde
  miejsce, które ją konsumuje.
- Na `(working_revision_id, compute_run_id)` jest ograniczenie unikalności (`compute_job_outputs`) —
  zmiana algorytmu SAMA W SOBIE go nie narusza (to nie jest constraint NA hashu), ale freshness/staleness
  logic gdziekolwiek porównuje hash "przed" z hashem "po" (np. `finance_lineage_freshness_events`,
  `bv.freshness`) potencjalnie zacznie znakować rzeczy jako STALE bez realnej zmiany.
- **Backfill byłby wymagany**: każdy zamrożony (`APPROVED`/`immutable_since IS NOT NULL`) artifact ma hash
  policzony starym algorytmem na zawsze zamrożonych danych — zmiana algorytmu NIE zmienia tych zapisanych
  wartości (są tylko odczytywane, nigdy przeliczane po zamrożeniu), więc **zamrożone dane są bezpieczne z
  definicji** — ryzyko dotyczy wyłącznie **żywych, niezamrożonych** working revisions przy ICH NASTĘPNYM
  recompute/checkpoincie.

**Wniosek:** ponieważ §4.2 nie znalazł żywego defektu uzasadniającego zmianę algorytmu, ryzyko z tej sekcji
pozostaje czysto hipotetyczne — **nie podejmowano żadnej zmiany algorytmu, więc nic z powyższego się nie
zmaterializowało w tej pracy.**

---

## 5. Dowód, że hashe się NIE ZMIENIŁY (real DB, wszystkie 4 silniki)

### 5.1 Metoda

`createHash('sha256').update(JSON.stringify(x)).digest('hex')` (stary inline kod) i `canonicalPayloadHash(x)`
(nowy prymityw) są **tekstowo identycznym wyrażeniem** — `contentHash.ts:32` to dosłownie ta sama linia.
Podstawienie samo w sobie jest więc matematycznie bezinwazyjne DLA TEGO SAMEGO `x`. Realne ryzyko regresji to
nie algorytm, tylko "czy w refaktorze przypadkiem podano INNY argument" (literówka, zła zmienna). To zbadano
empirycznie, na żywej bazie, w jednym przebiegu:

1. W każdym z 4 miejsc tymczasowo dodano (potem usunięto — nie ma w finalnym diffie, patrz §3) asercję:
   `if (process.env.HASH_CONSOLIDATION_PROOF === '1') { const legacy = createHash('sha256')...; if (legacy !== contentSemanticHash) throw ... }`
   — porównującą stary i nowy hash na TYM SAMYM, realnie obliczonym payloadzie, w tym samym przebiegu.
2. Uruchomiono `coldReopen.pg.test.ts` (buduje pełny łańcuch GoldCo: Statement → Analysis → Baseline →
   Prediction → Valuation, przez prawdziwe serwisy produkcyjne, na zmigrowanym Postgresie) z
   `HASH_CONSOLIDATION_PROOF=1`.
3. Wynik: **4/4 testy PASSED, exit 0** — żadna z asercji nie rzuciła. Dowód, że dla realnie obliczonych
   payloadów wszystkich 4 silników (`baseline.monthlyResults`, `kpi.results`, `valuation.{enterpriseValue,fcff}`,
   `prediction.baselineContentHashSource` ORAZ `prediction.periods` — oba miejsca w tym pliku) stary i nowy
   kod dają **identyczny** hash.
4. Asercje usunięto z kodu produkcyjnego po użyciu (patrz diff §3 — nie ma ich w finalnej wersji), żeby nie
   zostawiać martwego debug-kodu.

### 5.2 Dodatkowy dowód — bezpośrednie porównanie wartości w bazie (przed/po edycji)

Uruchomiono `coldReopen.pg.test.ts` PRZED edycją i PO edycji (dwa osobne, niezależne przebiegi — inna losowa
`orgId` i inne losowe UUID wierszy za każdym razem, więc payloady `baseline`/`kpi`/`prediction` NIE są
bit-identyczne między przebiegami z powodu osadzonych losowych id, niezwiązanych z moją zmianą — patrz §4.3).
`content_semantic_hash` odczytany bezpośrednio z `finance_business_versions` po każdym przebiegu:

| Etap | PRZED (org `...4eaf2d8a`) | PO (org `...a8fc2d5f`) | Identyczny? |
|---|---|---|---|
| Statement (nie dotknięty tą zmianą) | `94b9d25f5db9e79b...` | `94b9d25f5db9e79b...` | **TAK** (bit-identyczny — payload bez id-ów) |
| Analysis/KPI | `9f5a84b9981672cf...` | `8991a329fde7533f...` | Nie (oczekiwane — payload zawiera losowe `kpiValueId`/`entityId`, patrz §4.3) |
| Baseline | `67da8f09eab64c28...` | `a92ae8baf3153667...` | Nie (oczekiwane — payload zawiera losowe `periodId`) |
| Prediction | `832a7e61ba1f8bcb...` | `43f008c9be9b8471...` | Nie (oczekiwane — j.w.) |
| Valuation | `a066152eb1bfc0c8...` | `9a88709c54a9fdeb...` | Nie — **ale NIE z powodu mojej zmiany**, patrz §5.3 |

`Statement` (już skonsolidowany wcześniej w W10-D01, nie dotknięty tą pracą) daje **bit-identyczny** hash
między dwoma zupełnie niezależnymi przebiegami — to jedyny payload w tej tabeli bez żadnych osadzonych id-ów, i
służy jako niezależne potwierdzenie, że "ta sama treść → ten sam hash" faktycznie trzyma się na żywej bazie,
przy niezmienionym kodzie.

### 5.3 Uboczne odkrycie — niedeterminizm zmiennoprzecinkowy w Valuation (POZA ZAKRESEM tej pracy)

Oczekiwano, że hash Valuation (payload `{enterpriseValue, fcff.years}` — bez żadnych id-ów, same liczby) też
będzie bit-identyczny między dwoma przebiegami tego samego, deterministycznego fixture'u (GoldCo, statyczny
`goldco_oracle.json`). **Nie był.** Zbadano `evidence.fc07_9.enterpriseValueComputed`:

- PRZED: `238070438.17832354`
- PO: `238070438.1783235`

Różnica na **ostatniej cyfrze znaczącej** (float64) — klasyczny objaw nie-asocjatywności sumowania
zmiennoprzecinkowego w innej kolejności między przebiegami (np. sumowanie po wyniku SQL bez pełnego
`ORDER BY` gdzieś w łańcuchu FCFF/EBIT). **To NIE jest spowodowane moją zmianą** — nie dotknięto
`valuationFcffService.ts`, `valuationDiscountService.ts`, `valuationWaccService.ts` ani żadnej logiki
liczącej te wartości; §5.1 już dowiodło (w ramach JEDNEGO przebiegu, na REALNIE obliczonym `enterpriseValue`
tamtego przebiegu), że mój refaktor sam w sobie jest bezinwazyjny.

To jest jednak **osobny, realny problem** z tej samej rodziny co ryzyko z §4.3 (recompute "tych samych"
danych daje inny hash bez realnej zmiany treści) — wart osobnego zgłoszenia. Zgłoszono jako task w tle (patrz
sekcja "Zgłoszenia poboczne" poniżej), NIE naprawiono — poza zakresem "konsolidacja hasha", dotyczy silnika
FCFF, nie sposobu liczenia hasha.

---

## 6. Strażnik i jego kontrola negatywna

**Plik:** `server/src/services/finance/canonical/__tests__/hashConsolidationGuard.test.ts` (nowy, statyczna
analiza źródeł — bez bazy, zawsze uruchamiany, nie wymaga `RUN_DB_TESTS`).

**Mechanizm:** liczy wystąpienia `createHash('sha256'|"sha256")` w każdym pliku `.ts` pod
`server/src/services/finance` (wyłączając `*.test.ts`/`*.pg.test.ts`) i porównuje z zamkniętą listą
dozwolonych (plik → liczba → **uzasadniona rola**, ta sama tabela co §2). Każde wystąpienie ponad
dozwoloną liczbę — nowy plik ALBO jedno więcej w już wymienionym pliku — czerwieni test. Drugi test w tym
samym pliku asercjuje, że 4 skonsolidowane silniki + 3 wcześniej skonsolidowane (W10-D01) faktycznie
importują `canonicalPayloadHash` z `contentHash.ts` (chroni przed cichym usunięciem importu w przyszłości).

**Kontrola negatywna (wykonana, obie strony):**
1. Tymczasowo przywrócono inline `createHash('sha256').update(JSON.stringify(results)).digest('hex')` w
   `kpiComputeService.ts` (zamiast `canonicalPayloadHash(results)`).
   → `npx vitest run .../hashConsolidationGuard.test.ts` → **1 failed, 1 passed** (dokładny komunikat:
   `canonical/kpiComputeService.ts: found 2, allowlisted 1 — new inline sha256 call...`).
2. Cofnięto zmianę (przywrócono `canonicalPayloadHash(results)`).
   → `npx vitest run .../hashConsolidationGuard.test.ts` → **2 passed** (zielono).

Strażnik reaguje w obie strony, zgodnie z wymogiem.

**Wynik po włączeniu do zakresu `finance/canonical`:** 34 pliki (było 33 + 1 nowy), 446 testów (było
444 + 2 nowe w tym pliku).

**Bonus — strażnik złapał mnie samego, na żywo.** Po dopisaniu JSDoc-owego wyjaśnienia do
`contentHash.ts` (§4.2 — wyjaśnienie że "canonical" nie sortuje kluczy) strażnik faktycznie
**zaczerwienił się** przy zwykłym uruchomieniu całego zakresu `finance` — bo nowy komentarz cytuje frazę
`createHash('sha256')` w prozie dwa razy, podnosząc realną liczbę wystąpień w tym pliku z 2 do 3. To NIE
była zaplanowana kontrola negatywna — to strażnik złapał realny (nieszkodliwy, bo to tylko komentarz) wzrost
liczby dopasowań, dokładnie tak, jak ma. Naprawiono podnosząc dozwoloną liczbę dla `contentHash.ts` do 3, z
wyjaśnieniem w samym teście, że dwa z trzech dopasowań to cytaty w prozie, nie kod. Traktuję to jako
dodatkowy, silniejszy dowód działania strażnika niż sama zaplanowana kontrola negatywna poniżej.

---

## 7. Liczby przebiegów (regresja)

| Zakres | Przed (punkt odniesienia orkiestratora) | Po (ten worktree, zweryfikowane) |
|---|---|---|
| Migracje STRICT | exit 0, 635 | **exit 0, 636** — rozbieżność 635→636 zweryfikowana 2× deterministycznie na świeżej bazie; nie dotknięto ŻADNEJ migracji w tej pracy, więc to niezależna drobna nieścisłość zastanego punktu odniesienia, nie regresja tej zmiany |
| `finance/canonical` | 33/33 plików, 444/444 testów, exit 0 | **34/34 plików, 446/446 testów, exit 0** (+1 plik/+2 testy = nowy strażnik) |
| `src/services/finance` | 43/43 plików, 712/712 testów, exit 0 | **44/44 plików, 714/714 testów, exit 0** |
| `tsc -p server` | exit 0, zero linii | **exit 0, zero linii** |

Wszystkie przebiegi wykonane z `--no-file-parallelism` (bez tej flagi zdarzają się race'y w init schematu
między równoległymi plikami testowymi na tym samym połączeniu — szum harnessu, niezwiązany z moją zmianą;
`--no-file-parallelism` daje deterministyczne 0 błędów w każdym z >5 powtórzeń).

**Jeden znany flaky test, niezwiązany z tą zmianą:**
`faultMatrix.pg.test.ts > ... FIXED EM-1: reapExpiredLeases() requeues an abandoned job...` — zawiódł raz na
~4 przebiegi (przed I po mojej edycji — obserwowane w OBU stanach kodu), zawsze przechodzi na powtórce. Test
dotyczy lease-expiry timing (zależny od zegara), nie hasha — nie dotknięty tą pracą, niezwiązany przyczynowo.

---

## 8. Punkty kolizji z innym agentem

Instrukcja: równolegle inny agent pracuje w `server/scripts/finance-v3-backfill-*.ts` i `finance_export_manifests`,
i będzie IMPORTOWAŁ `canonicalPayloadHash`.

- **`contentHash.ts` NIE zostało zmienione** w tej pracy — sygnatura `canonicalPayloadHash(payload: unknown): string`
  i zachowanie (algorytm) są identyczne jak przed startem tego zadania. Zero kolizji API.
- Zmienione pliki (`baselineComputeService.ts`, `kpiComputeService.ts`, `valuationComputeService.ts`,
  `predictionComputeService.ts`) leżą poza `server/scripts/` i poza `finance_export_manifests` — zero
  nakładania się plików.
- **Uwaga na przyszłość dla tamtego agenta:** jeśli backfill/eksport ma PRZELICZAĆ `content_semantic_hash` dla
  istniejących wierszy pochodzących z tych 4 silników i porównywać z wartością już zapisaną w bazie — wynik
  powinien się zgadzać (§5 dowodzi, że mój refaktor jest bezinwazyjny), **z jednym wyjątkiem**: jeśli backfill
  rekomputuje Analysis/KPI lub Valuation dla tych samych logicznych danych, może natrafić na niedeterminizm
  opisany w §4.3 (kolejność SQL bez `ORDER BY`) i §5.3 (float non-associativity w Valuation) — te dwa efekty
  ISTNIAŁY PRZED tą pracą i nie są przeze mnie wprowadzone, ale backfill/reconciliation script może je
  napotkać jako "hash się nie zgadza mimo tej samej treści". Warto, żeby ten agent o tym wiedział.

---

## 9. Zgłoszenia poboczne (poza zakresem tego zadania, nie naprawione)

1. **`kpiComputeService.ts`** — `SELECT * FROM finance_analysis_kpi_values WHERE business_version_id = ?` bez
   `ORDER BY` (linia ~481) może dać różną kolejność `results[]`, a więc różny `content_semantic_hash`, dla
   identycznych wartości KPI między dwoma recompute. Naprawa (`ORDER BY id`) istnieje i została ZBADANA, ale
   **świadomie cofnięta** — zmieniłaby faktyczną kolejność zwracanych wierszy (losowe UUID ≠ kolejność
   insercji), unieważniając `content_semantic_hash` istniejących Analysis working revisions przy ich
   najbliższym recompute. Decyzja zostawiona właścicielowi (§4.3 ma pełne uzasadnienie i rekomendację).
2. **Niedeterminizm zmiennoprzecinkowy w Valuation** — `enterpriseValueComputed` różni się na ostatniej cyfrze
   (`...17832354` vs `...1783235`) między dwoma przebiegami tego samego deterministycznego fixture'u,
   niezwiązane z hashowaniem, dotyczy silnika FCFF/discount (`valuationFcffService.ts` i sąsiedzi) — poza
   zakresem tego zadania, nie badane głębiej (nie ustalono dokładnego źródła — prawdopodobnie sumowanie w
   różnej kolejności z zapytania SQL bez pełnego `ORDER BY` gdzieś w łańcuchu wejściowym FCFF). Zgłoszone
   jako osobny task w tle.

---

## 10. Komendy reprodukcji

```bash
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA=/private/tmp/fv3-hc-pgdata ; PGSOCK=/tmp/fv3hcsock ; PORT=57771
rm -rf "$PGDATA" "$PGSOCK" && mkdir -p "$PGDATA" "$PGSOCK"
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" -l /tmp/fv3hc_pg.log start
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE fv3_hc;"
DBURL="postgresql://postgres@127.0.0.1:$PORT/fv3_hc"
NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" npx tsx server/scripts/migrate.postgres.ts

cd server
NODE_OPTIONS="--max-old-space-size=8192" npx tsc -p . --noEmit

RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" NODE_ENV=test \
  npx vitest run src/services/finance/canonical --no-file-parallelism

RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" NODE_ENV=test \
  npx vitest run src/services/finance --no-file-parallelism

# strażnik sam (bez bazy, zawsze biegnie)
npx vitest run src/services/finance/canonical/__tests__/hashConsolidationGuard.test.ts

# dowód real-DB "hash unchanged" (opcjonalny, wymaga migracji na świeżej bazie)
RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" NODE_ENV=test \
  W10_EVIDENCE_PATH=/tmp/coldreopen_evidence.json \
  npx vitest run src/services/finance/canonical/__tests__/coldReopen.pg.test.ts --no-file-parallelism
```

---

## 11. `EVIDENCE_MISSING`

- Nie zweryfikowano wpływu (jeśli istnieje) na `server/scripts/finance-v3-backfill-*.ts` — nie uruchomiono
  tych skryptów, żeby nie wchodzić na teren równoległego agenta (zgodnie z instrukcją). Deklaratywna analiza
  (§8) oparta na tym, że `contentHash.ts` się nie zmienił.
- Nie ustalono DOKŁADNEGO źródła niedeterminizmu zmiennoprzecinkowego z §5.3/§9.2 (który dokładnie krok w
  łańcuchu FCFF sumuje w niestabilnej kolejności) — tylko stwierdzono jego istnienie i wykluczono związek z tą
  zmianą.
