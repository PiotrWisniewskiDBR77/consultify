# W3 — determinizm obliczeń (`kpiComputeService` row-order + Valuation FCFF float noise)

**Worktree:** `/Users/piotrwisniewski/consultify-wt/w3-determinizm`
**Gałąź:** `codex/finance-v3-w3-determinizm`
**SHA startowy:** `ceceddeb45` (merge `codex/finance-v3-w3-hashconsol` → `codex/finance-v3-wave2-fanin2`)
**SHA końcowy (po obu naprawach, przed commitem tego raportu):** `2e5af12a6502acf61a0d19c05559dc2efc4a46c5`
**Data:** 2026-08-10/11.
**Baza dowodowa:** efemeryczny PostgreSQL 15, port `57791`, `PGDATA=/private/tmp/fv3-det-pgdata`, gniazdo
`/tmp/fv3detsock`, baza `fv3_det`. Migracje STRICT (bez `--safe`): **exit 0, 637 migracji** (baseline z
poprzedniej sesji: ~636 — rozbieżność ±1, ten sam typ nieszkodliwego driftu punktu odniesienia, jaki
`W3_HASH_CONSOLIDATION_report.md` §7 już odnotował dla 635→636; nie dotknięto żadnej migracji w tej pracy).

---

## 0. Streszczenie

**Oba zgłoszenia POTWIERDZONE i NAPRAWIONE.** Mają **ten sam pierwiastek**: zapytanie SQL bez `ORDER BY`
zasilające sumowanie/serializację, gdzie kolejność wierszy zwracanych przez Postgres nie jest gwarantowana i
faktycznie się zmienia w praktyce (nie tylko teoretycznie) — dokładnie tak, jak podejrzewał autor zadania.

- **Zgłoszenie 1** (`kpiComputeService.ts`, brak `ORDER BY`): rozjazd hasha **osiągalny bez żadnych
  sztuczek** (bez `VACUUM`, bez wymuszania planu) — zwykły `UPDATE` z `persistResults()` sam w sobie
  przestawia fizyczną kolejność wierszy w 1-3 iteracjach na realnej tabeli produkcyjnej. Dowód end-to-end
  przez publiczne API (`computeAnalysisKpis`, symulując realną ścieżkę retry po wygasłym leasie): **10
  przebiegów → 6-7 różnych `content_semantic_hash`** dla bajtowo identycznej treści KPI. **Naprawione**:
  sortowanie w pamięci tuż przed hashowaniem (`hashPayloadFor()`), bez zmiany SQL, bez zmiany kolejności
  zwracanej wywołującym. Po naprawie: 10 przebiegów → **1** hash.
- **Zgłoszenie 2** (Valuation FCFF, `valuationFcffService.ts`): niedeterminizm **potwierdzony i namierzony
  co do linii kodu** (poprzedni agent miał `EVIDENCE_MISSING`). **Ten sam pierwiastek co zgłoszenie 1** —
  `loadCells()` też nie ma `ORDER BY`, a `sumFlow()` sumuje zmiennoprzecinkowo w tej niegwarantowanej
  kolejności. Dowód: 10 niezależnych pełnych przebiegów (realny solver cyrkularności + DCF/FCFF, te same
  dane wejściowe GoldCo) dało **3 różne bity `enterpriseValueComputed`**, mimo że 12 miesięcznych wartości
  EBIT zapisanych do `finance_baseline_outputs` było **bajtowo identyczne** we wszystkich 10 przebiegach —
  rozjazd pochodzi wyłącznie z kolejności SUMOWANIA, nie z wartości źródłowych. **Naprawione**: `sumFlow()`
  sortuje komórki do własnej, kanonicznej (chronologicznej) kolejności `periodIds` wywołującego przed
  sumowaniem. Po naprawie: 10 przebiegów → **1** wartość EV.
- **Waga biznesowa zgłoszenia 2**: różnica rzędu **~1e-9 względnie** (ostatnia cyfra znacząca ośmiocyfrowej
  kwoty PLN) — **zero skutku biznesowego** (żadne zaokrąglenie/prezentacja waluty tego nie ujawni), ale
  **realny skutek na `content_semantic_hash`** (ta sama klasa problemu co zgłoszenie 1).
- **„DCF 0,000000% do oracle"** (WP-D10 report) to twierdzenie o **DOKŁADNOŚCI** (jeden przebieg silnika vs.
  niezależnie policzony oracle), **nie o POWTARZALNOŚCI** (ten sam przebieg dwa razy). To dwie różne
  własności — potwierdzone czytając WP-D10 §3.2 wprost: oracle porównuje WACC/terminal/discount (closed-form,
  bez pętli), nie testuje wielokrotnego przeliczenia tej samej sumy EBIT z wielu miesięcy. Twierdzenie
  pozostaje PRAWDZIWE i nienaruszone tą naprawą.
- **Kontrola negatywna wykonana dla OBU napraw**, w obie strony, z realnymi wartościami — §5/§6.
- **Zero regresji**: `tsc -p server` exit 0/0 linii; `finance/canonical` 37/37 plików, 454/454 testów
  (34/34+446/446 baseline → +3 nowe pliki/+8 nowych testów); `src/services/finance` 47/47, 722/722
  (44/44+714/714 baseline → zgadza się z +3/+8). Jeden **znany, niezwiązany** flaky (`faultMatrix.pg.test.ts`
  — timing wygasania leasu, migało też BEZ moich zmian, przechodzi na powtórce) — §7.

---

## 1. Zgłoszenie 1 — brak `ORDER BY` w `kpiComputeService.ts`

### 1.1 Realne miejsce (zgrepowane, nie z numerów linii)

`server/src/services/finance/canonical/kpiComputeService.ts`, funkcja `computeAnalysisKpis()`:

```sql
SELECT * FROM finance_analysis_kpi_values WHERE business_version_id = ?
```

Brak `ORDER BY`. Wynik trafia bezpośrednio do `evaluateAllRows()` (iteracja `for (const row of
deps.kpiValueRows)`), która buduje tablicę `results[]` w DOKŁADNIE tej kolejności wierszy z SQL. Ta tablica
jest tym, co `canonicalPayloadHash(results)` hashuje jako `content_semantic_hash`.

### 1.2 Czy rozjazd jest osiągalny w praktyce — jak próbowałem wymusić

Poprzedni agent (`W3_HASH_CONSOLIDATION_report.md` §4.3) **teoretyzował** o `VACUUM`/zmianie planu
zapytania jako mechanizmach reorderingu, ale **nie przetestował** żadnego z nich empirycznie. Zrobiłem to
teraz, krok po kroku:

1. **Zwykły powtórzony `UPDATE` (dokładnie to, co robi `persistResults()`) na REALNEJ tabeli
   `finance_analysis_kpi_values`** (18 wierszy — jeden Analysis, wszystkie ACTIVE KPI katalogu P0), bez
   żadnego `VACUUM`, bez zmiany planu: **kolejność `SELECT id FROM finance_analysis_kpi_values WHERE
   business_version_id=?` zmieniła się już po 1. iteracji UPDATE-a** i dalej migotała nieregularnie przez 12
   iteracji (zmieniona: iter 1,2,3,10,11; stabilna: iter 4-9,12). Nie potrzeba było `VACUUM` ani wymuszania
   planu — sam `UPDATE` (prawdopodobnie NIE-HOT z powodu triggera
   `trg_finance_analysis_kpi_values_parent_immutability` czytającego `finance_business_versions` w BEFORE
   UPDATE) już przestawia fizyczną kolejność.
2. Osobno sprawdziłem: `VACUUM` (bez `FULL`) na tabeli-sondzie **też** zmienia kolejność; wymuszenie planu
   (`SET enable_seqscan = off` → index scan po PK) **też** daje inną kolejność niż seq scan. Oba potwierdzają
   dodatkowe, niezależne ścieżki do tego samego efektu, choć nie były już potrzebne po (1).
3. **Dowód end-to-end przez PUBLICZNE API**, nie SQL bezpośrednio: `computeAnalysisKpis()` ma idempotency
   key oparty na `{businessVersionId, sourceVersionId, kpiValueIdsSorted}` — więc zwykłe DRUGIE wywołanie z
   niezmienionym zestawem wierszy trafia w TEN SAM `compute_jobs` wiersz i **rzuca** `failed to self-claim`
   (job nie jest już `'queued'`). Realna druga próba przeliczenia dzieje się wyłącznie przez **własną
   ścieżkę retry tego kodu** — wygasły lease → `reapExpiredLeases()` (`faultMatrix.pg.test.ts`, EM-1)
   ustawia job z powrotem na `'queued'`. Zasymulowałem DOKŁADNIE ten mechanizm (reset `compute_jobs.status`
   na `'queued'`, tak jak robi reaper) i wywołałem `computeAnalysisKpis()` **10 razy** dla tej samej,
   niezmienionej Analysis (18 wierszy KPI, wszystkie cały czas `MISSING` — brak danych źródłowych, więc
   ŻADNA wartość KPI nigdy się nie zmienia):

   ```
   10 runs -> 6 DISTINCT content_semantic_hash values
   (przykład: run1=0d9a809c… run2=7c2e7748… run3=b0456696… run4=7fe8d170… run5-8=9e70c96d… run9-10=b0663a28…)
   ```

   Kolejność `kpiValueId` w zwróconym `results[]` zmieniała się niemal przy każdym przebiegu; hash — razem z
   nią.

**Wniosek: rozjazd JEST osiągalny w praktyce**, dokładnie ścieżką, którą kod sam przewiduje (crash recovery /
lease-expiry retry — `faultMatrix.pg.test.ts` istnieje właśnie po to, żeby tę ścieżkę ćwiczyć), bez potrzeby
`VACUUM` czy wymuszania planu. Nie jest to hipoteza — to zmierzone zachowanie na realnym Postgresie 15.

### 1.3 Decyzja i uzasadnienie

**Naprawiono** — sortowanie w pamięci tuż przed hashowaniem, dokładnie kompromis wskazany w zadaniu jako
warty rozważenia:

```ts
export function hashPayloadFor(results: readonly ComputedKpiResult[]): ComputedKpiResult[] {
  return [...results].sort((a, b) => {
    const ka = `${a.kpiCode}::${a.entityId}::${a.periodId}`;
    const kb = `${b.kpiCode}::${b.entityId}::${b.periodId}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}
// ...
const contentSemanticHash = canonicalPayloadHash(hashPayloadFor(results));
```

Klucz sortowania to `uq_finance_analysis_kpi_values_cell` (kpiCode/entityId/periodId) — WARTOŚCIOWY, nie
pochodzący z fizycznej kolejności ani z losowego UUID `id`, więc jest stabilny niezależnie od tego, co zrobi
Postgres. **SQL zostaje BEZ `ORDER BY`** (uzasadnienie poprzedniego agenta — pinowanie losowego `id` samo w
sobie zmieniałoby kolejność — pozostaje słuszne, ale teraz jest już nieistotne: hash nie zależy od kolejności
SQL wcale). `results` zwracane wywołującym i to, co zapisuje `persistResults()`, **nie są dotknięte** —
zmienia się WYŁĄCZNIE argument przekazywany do `canonicalPayloadHash`.

**Czemu to jest bezpieczniejsza naprawa niż `ORDER BY id`, którą poprzedni agent cofnął:** `ORDER BY id`
zmieniałoby faktyczną kolejność zwracaną przez SQL (więc też to, co widzi `persistResults()`/ewentualni inni
konsumenci `results`) na kolejność losowego UUID — inwazyjna zmiana zachowania. `hashPayloadFor()` NIE
dotyka SQL ani `results` — tylko robi kopię specjalnie do hashowania.

### 1.4 Wpływ na istniejące hashe

Zbadałem to empirycznie, nie tylko teoretycznie — kluczowe odkrycie:

- Rzeczywista **druga** realizacja liczenia hasha dla TEGO SAMEGO zestawu wierszy (`kpiValueIdsSorted`
  niezmieniony) jest zablokowana idempotency-key'em (patrz §1.2 pkt 3) — normalne, zwykłe "przelicz jeszcze
  raz" bez zmiany zestawu wierszy **rzuca błąd**, nie liczy nowego hasha. Jedyna droga do realnego ponownego
  przeliczenia to (a) ścieżka retry po awarii/wygaśnięciu leasu, albo (b) zmiana ZESTAWU wierszy (np. dodanie
  nowego KPI do wyboru) — a to i tak generuje NOWY `inputRevisionHash`/`idempotencyKey`, więc to już jest
  "nowa treść" z punktu widzenia systemu, nie recompute niezmienionej treści.
- W ścieżce (a) — retry po awarii — **hash nigdy nie został zapisany dla przerwanej próby**
  (`stampWorkingRevisionComputeIdentity()` woła się dopiero PO `completeJobSuccess()`), więc nie ma
  ISTNIEJĄCEGO zapisanego hasha do unieważnienia w tym scenariuszu — przerwana próba nigdy niczego nie
  zacommitowała.
- Zatem: **populacja hashy, które fix mógłby realnie zmienić względem tego, co jest dziś w bazie, jest dużo
  mniejsza niż przy `ORDER BY id`** — ogranicza się w praktyce do przypadków, gdy ktoś doda nowe KPI do
  istniejącej Analysis (co i tak jest legitymną zmianą treści, oczekiwaną zmianą hasha) — normalny recompute
  niezmienionej treści przez idempotency guard i tak nigdy nie dotyka ponownie zatwierdzonego hasha.
- **Zamrożone (`APPROVED`) working revisions są bezpieczne z definicji** — trigger
  `finance_analysis_kpi_values_enforce_parent_immutability` blokuje UPDATE na wartościach, gdy
  `business_version_id` ma status `APPROVED`, więc `computeAnalysisKpis()` (które robi `persistResults()`
  UPDATE) i tak nie może ponownie policzyć zamrożonej wersji.
- **EVIDENCE_MISSING**: nie mam dostępu do żywej bazy demo/prod, więc nie sprawdziłem, czy istnieje
  praktyka ręcznego "wymuś przeliczenie" (np. panel admina), który tworzy NOWY `compute_jobs` z innym
  idempotency-key dla tej samej treści — jeśli taki mechanizm istnieje, mogłby dotknąć hashy poza opisanymi
  wyżej dwoma ścieżkami. Nie znalazłem takiego callera w `server/src`/`src` podczas przeglądu, ale nie
  przeszukałem całego repo pod tym kątem wyczerpująco.

---

## 2. Zgłoszenie 2 — niedeterminizm zmiennoprzecinkowy w Valuation FCFF

### 2.1 Potwierdzenie/obalenie — surowe wartości z 10+ przebiegów

**Test 1 — dane statyczne, bez żadnych zapisów między przebiegami** (izolowana sonda: jeden `INSERT` do
`finance_baseline_outputs`, potem 15× `computeFcffSeries()` na niezmienionych danych, plus wymuszenie
`enable_seqscan=off`):

```
15 runs -> 1 distinct FCFF bit pattern, 1 distinct EBIT bit pattern
seq-scan-plan sum:    18643328.623979523778
forced-plan (index) sum: 18643328.623979523778   (identyczna kolejność wierszy, identyczna suma)
```

→ na tabeli źródłowej, do której NIC nie pisze między przebiegami, wynik jest w pełni stabilny — nawet
wymuszenie innego planu zapytania nie zmieniło ani kolejności wierszy, ani sumy dla tej wielkości danych.

**Test 2 — pełny łańcuch, replikacja metodologii `W3_HASH_CONSOLIDATION_report.md` §5.3** (10 NIEZALEŻNYCH
przebiegów: realny solver cyrkularności Baseline `baselineComputeService.runBaselineCompute()` + realny DCF
`valuationComputeService.runDcfFcffValuation()`, identyczne stałe GoldCo, świeży `organization_id`/
`business_version_id` losowy przy każdym przebiegu — bo `finance_baseline_outputs` jest zapisywane tylko raz
na wersję, więc "ten sam fixture" = te same dane wejściowe, nie ten sam wiersz):

```
run 1:  EV=-5465320.2527571739629  EBIT_Y1=24424022.035702560097
run 2:  EV=-5465320.2527572233230  EBIT_Y1=24424022.035702556372
run 3:  EV=-5465320.2527572726831  EBIT_Y1=24424022.035702552646
run 4:  EV=-5465320.2527572233230  EBIT_Y1=24424022.035702556372
run 5:  EV=-5465320.2527572233230  EBIT_Y1=24424022.035702556372
run 6:  EV=-5465320.2527571739629  EBIT_Y1=24424022.035702560097
run 7:  EV=-5465320.2527572726831  EBIT_Y1=24424022.035702552646
run 8:  EV=-5465320.2527571739629  EBIT_Y1=24424022.035702560097
run 9:  EV=-5465320.2527572726831  EBIT_Y1=24424022.035702552646
run 10: EV=-5465320.2527572233230  EBIT_Y1=24424022.035702556372

10 independent full-chain runs (identyczne wejścia) -> 3 distinct EV, 3 distinct EBIT_Y1
```

**POTWIERDZONE** — dokładnie ten sam typ różnicy co w oryginalnym zgłoszeniu (`...17832354` vs
`...1783235`): ostatnie 2-3 cyfry znaczące ośmiocyfrowej liczby.

### 2.2 Źródło — namierzone co do linii kodu

Diagnostyka rozstrzygająca (dodana do sondy): odczytałem WSZYSTKIE 12 miesięcznych wartości EBIT zapisanych
przez `baselineComputeService.ts` do `finance_baseline_outputs`, w USTALONEJ kolejności (`ORDER BY`
odpowiadające chronologicznej tablicy `forecastPeriodIds`), jako dokładne stringi decymalne z Postgresa (bez
żadnej konwersji przez JS), dla wszystkich 10 przebiegów:

```
monthly EBIT series (12 wartości, dokładny string decymalny, kolejność kanoniczna)
  -> 1 DISTINCT series across 10 runs   (BAJTOWO IDENTYCZNE)

manual JS forward-sum tych (identycznych) 12 wartości: 24424022.035702556372
observed ebitY1 values from the 10 runs: 24424022.03570256 | ...556 | ...553
```

**12 zapisanych wartości źródłowych jest bajtowo identycznych we wszystkich 10 przebiegach** —
`baselineComputeService.ts`/`baselineCircularitySolver.ts`/`baselineScheduleEngine.ts` są w pełni
deterministyczne (sprawdzone też statycznie: zero `Map`/`Set`/`Date.now()`/`Math.random()` na ścieżce
liczącej EBIT — `ebit = ebitda - depreciation`, obie strony to czyste funkcje liniowe stałych wejść, żadna
nie zależy od `solved.*` z solvera cyrkularności). **Rozjazd pochodzi WYŁĄCZNIE z kolejności sumowania w
`sumFlow()`** (`valuationFcffService.ts`), które czyta `cells` z `loadCells()`:

```sql
SELECT canonical_line_id, value_status, value_decimal, presentation_currency, unit, multiplier
   FROM finance_baseline_outputs
  WHERE business_version_id = ? AND entity_id = ? AND period_id = ANY(?) AND consolidation_scope = 'CONSOLIDATED'
```

— też bez `ORDER BY`. Kolejność wierszy zmienia się MIĘDZY NIEZALEŻNYMI przebiegami (nie w obrębie jednego,
jak w Teście 1) — najprawdopodobniej dlatego, że `finance_baseline_outputs` jest WSPÓLNĄ, rosnącą tabelą
(każdy z 10 przebiegów dopisuje ~372 nowe wiersze), a planner Postgresa zmienia decyzję (seq scan vs. index
scan po `idx_finance_baseline_outputs_entity_period`) w miarę wzrostu tabeli — indeks sortuje po
`(entity_id, period_id)`, a `period_id` to losowy UUID, więc kolejność z indeksu NIE jest chronologiczna.
**To jest DOKŁADNIE ten sam pierwiastek co zgłoszenie 1**: brak deterministycznej kolejności z SQL, tu
ujawniający się przez wzrost tabeli między przebiegami zamiast przez `UPDATE` w obrębie jednego.

**Sanity check nieasocjatywności**: samo w sobie proste odwrócenie kolejności (forward vs. reverse) tych 12
wartości dawało IDENTYCZNY wynik — te konkretne, gładko malejące wartości okazały się niewrażliwe na prostą
zamianę kierunku. Dopiero **prawdziwa permutacja** (nie odwrócenie) — znaleziona przeszukaniem 200 losowych
przetasowań tych samych 12 wartości — dała rozbieżność, i to odtworzyła DOKŁADNIE 2 z 3 realnie
zaobserwowanych wzorców bitowych (`...560097` i `...552646`) — mocne, niezależne potwierdzenie, że
mechanizmem jest kolejność sumowania, nie coś innego.

### 2.3 Naprawa

`sumFlow()` teraz sortuje `cells` do własnej, kanonicznej (chronologicznej) kolejności `orderedPeriodIds`
(argument `year.periodIds` przekazywany przez wywołującego) PRZED sumowaniem:

```ts
export function sumFlow(cells: CellRow[], lineId: string, orderedPeriodIds: readonly string[]) {
  const rowsForLine = cells.filter((c) => c.canonical_line_id === lineId);
  if (rowsForLine.length < orderedPeriodIds.length) return { value: null, presentCount: rowsForLine.length };
  const periodRank = new Map(orderedPeriodIds.map((pid, idx) => [pid, idx]));
  const sorted = [...rowsForLine].sort((a, b) => (periodRank.get(a.period_id) ?? 0) - (periodRank.get(b.period_id) ?? 0));
  let sum = 0;
  for (const r of sorted) { const v = toFullUnitValue(r); if (v === null) return { value: null, presentCount: rowsForLine.length }; sum += v; }
  return { value: sum, presentCount: rowsForLine.length };
}
```

Dodano `period_id` do `CellRow`/SELECT (potrzebne do sortowania). SQL **zostaje bez `ORDER BY`** (spójne z
decyzją dla zgłoszenia 1). `closingWc`/`closingWcCell` NIE dotknięte — to odczyt jednej wartości (stan na
koniec okresu), nie suma wielu wierszy, więc kolejność go nie dotyczy.

**Po naprawie**: 10 niezależnych pełnych przebiegów → **1 distinct EV**, **1 distinct EBIT_Y1**,
odpowiadające dokładnie ręcznej sumie w kolejności kanonicznej (`24424022.035702556372`).

### 2.4 Waga biznesowa vs. hashowa

- **Waga biznesowa: ZERO.** Różnica to `~24424022.0357025**52646** do 560097`, czyli **~7,5e-6 w
  wartościach bezwzględnych na 24,4 mln** (~3e-13 względnie na tym poziomie; na poziomie EV rzędu -5,46 mln
  różnica to `~2,4e-7` bezwzględnie, `~4,4e-14` względnie) — wielokrotnie poniżej jakiegokolwiek
  zaokrąglenia walutowego (grosze) czy prezentacji (2 miejsca po przecinku, albo zaokrąglenie do tysięcy w
  raportach). **Żaden użytkownik nigdy by tego nie zobaczył** na ekranie ani w eksporcie.
- **Waga hashowa: REALNA.** `content_semantic_hash` Valuation (`canonicalPayloadHash({enterpriseValue,
  fcff: fcff.years})`) zależy bezpośrednio od tej sumy — więc `content_semantic_hash` był podatny na
  DOKŁADNIE ten sam problem co zgłoszenie 1 (recompute niezmienionej treści → inny hash), tylko przez
  ROZBUDOWĘ tabeli między przebiegami zamiast `UPDATE` wewnątrz jednego. Naprawa zgłoszenia 2 naprawia to
  przy okazji — hash Valuation jest teraz również deterministyczny, bo cała wejściowa struktura
  (`fcff.years`) jest teraz deterministyczna.

### 2.5 „DCF 0,000000% do oracle" — dokładność czy powtarzalność?

Sprawdzone wprost w `WP-D10_valuation_compute_engine_report.md` §3.1-3.2: oracle porównuje **JEDEN przebieg
silnika** (`WACC`, `Terminal value`, `Enterprise Value`) z **JEDNYM, niezależnie ręcznie policzonym**
zestawem tych samych wielkości, dla **zadanych z góry** (nie sumowanych z wielu wierszy SQL) rocznych
figur EBIT/D&A/CAPEX/WC. Cytat z raportu: *"both computations are closed-form, non-iterative; there is no
numerical-method noise to account for"*. To jest twierdzenie o **DOKŁADNOŚCI** (silnik zgadza się z
niezależną matematyką dla TYCH SAMYCH danych wejściowych, w JEDNYM przebiegu) — **nie** o **POWTARZALNOŚCI**
(ten sam przebieg dwukrotnie daje ten sam wynik). To dwie różne własności:

- **Dokładność** (accuracy vs. oracle) — **PRAWDZIWA, nienaruszona tą naprawą**. Mój Test 2 (§2.1) pokazuje
  różnice rzędu 1e-9 do 1e-13 względnie — całkowicie poniżej progu ≤0,1% (1e-3), którego wymaga WP-D10, i
  poniżej jakiejkolwiek sensownej precyzji oracle.
- **Powtarzalność** (run-to-run reproducibility) — **BYŁA FAŁSZYWA** przed tą naprawą (3 różne wyniki na 10
  przebiegów tych samych danych), **jest PRAWDZIWA po naprawie** (1 wynik na 10 przebiegów).

Te dwa twierdzenia były wcześniej mylone/nierozróżnione w dokumentacji — WP-D10's "0,000000%" nigdy nie
testował powtarzalności, więc nie jest to twierdzenie sprzeczne z moim wynikiem — po prostu dotyczy innej
własności, którą ten dokument warto doprecyzować, żeby nie sugerować więcej niż faktycznie zmierzono
(sugeruję to jako drobną poprawkę dokumentacyjną, poza zakresem tego zadania).

---

## 3. Kontrola negatywna — zgłoszenie 1

**Plik:** `server/src/services/finance/canonical/__tests__/kpiHashOrderDeterminism.test.ts` (czysty unit,
bez bazy, zawsze biegnie) + `.../kpiComputeService.determinism.pg.test.ts` (real-DB, symuluje ścieżkę retry).

1. Cofnięto `kpiComputeService.ts` do rodzica (`git show HEAD:...kpiComputeService.ts > plik`, **BEZ `git
   stash`**, zgodnie z regułą jednego drzewa/jednego agenta):
   → `kpiHashOrderDeterminism.test.ts`: **3 failed, 1 passed** (`hashPayloadFor is not a function` — 3
     testy zależne od funkcji, 1 test negative-control niezależny przeszedł jak powinien).
   → `kpiComputeService.determinism.pg.test.ts`: **1 failed** — `expected ALL 10 retried recomputes... got
     7 distinct values: 87fe7f9d… 79215ec6… 59c0b2a6… 5430658… 3c35b0e1… e29ffde5… ddd95a1c…`
2. Przywrócono naprawę (skopiowano zapisaną wersję z powrotem):
   → Oba pliki: **5 passed (5)**, zielono.

## 4. Kontrola negatywna — zgłoszenie 2

**Plik:** `server/src/services/finance/canonical/__tests__/valuationFcffOrderDeterminism.test.ts` (czysty
unit, bez bazy, zawsze biegnie; fixture to 12 REALNYCH wartości EBIT przechwyconych z §2.2, nie syntetyczne).

1. Cofnięto `valuationFcffService.ts` do rodzica (ta sama procedura, bez `git stash`):
   → **2 failed** (`sumFlow is not a function` — funkcja jeszcze nie istniała/nie była eksportowana w
     wersji rodzica), **1 passed** (negative-control test niezależny od `sumFlow`, jak powinien).
2. Przywrócono naprawę:
   → **3 passed (3)**, zielono.

Dodatkowo w samym pliku testowym (bez cofania commitu) — test „NEGATIVE CONTROL" demonstruje wprost: sumowanie
tych samych 12 realnych wartości w kolejności kanonicznej vs. w prawdziwej permutacji (znalezionej
przeszukaniem, nie wymyślonej) daje RÓŻNE sumy przy bezpośrednim `.reduce()` bez sortowania — i IDENTYCZNE
przez `sumFlow()`.

---

## 5. Liczby przebiegów (regresja)

| Zakres | Punkt odniesienia (orkiestrator) | Po (ten worktree, zweryfikowane) |
|---|---|---|
| Migracje STRICT, świeża baza | exit 0, ~636 | **exit 0, 637** — drift ±1, ten sam nieszkodliwy typ co poprzednia sesja odnotowała (635→636); nie dotknięto żadnej migracji |
| `finance/canonical` | ~34/34 plików, ~446/446 testów | **37/37 plików, 454/454 testów, exit 0** (+3 pliki/+8 testów — 2 nowe pliki determinism dla zgłoszenia 1, 1 dla zgłoszenia 2, plus rozszerzenie istniejącego) |
| `src/services/finance` | ~44/44 plików, ~714/714 testów | **47/47 plików, 722/722 testów, exit 0** |
| `tsc -p server` | exit 0, zero linii | **exit 0, zero linii** (zweryfikowane po KAŻDEJ z dwóch napraw osobno) |

Zakres `finance/canonical` uruchomiony **dwukrotnie pod rząd** po obu naprawach — identyczny wynik (37/37,
454/454) za każdym razem, w tym raz z `kpiComputeService.determinism.pg.test.ts`'s diagnostyką "fixture nie
zaobserwował churnu" (nieszkodliwy `console.warn`, nie failure — patrz §6).

**Jeden znany, niezwiązany flaky test:** `faultMatrix.pg.test.ts > ... FIXED EM-1: reapExpiredLeases()...`
— zaobserwowany czerwony RAZ w trakcie tej sesji (przy pierwszym uruchomieniu całego zakresu
`finance/canonical` po naprawie zgłoszenia 1), zielony na natychmiastowej powtórce tego samego pliku w
izolacji. Ten sam test i ten sam typ (timing wygasania leasu) co udokumentowany w
`W3_HASH_CONSOLIDATION_report.md` §7 jako pre-existing, niezwiązany z hashowaniem. Nie mój defekt.

## 6. Uwaga o własnej fladze — self-inflicted flake i jego naprawa

Pierwsza wersja `kpiComputeService.determinism.pg.test.ts` miała TWARDĄ asercję "kolejność SQL musi się
zmienić między 10 przebiegami" jako sanity-check własnej premisy testu. Przy uruchomieniu CAŁEGO zakresu
`finance/canonical` (po wcześniejszych testach, które już "uspokoiły" fizyczny układ współdzielonej tabeli
efemerycznego klastra) ta asercja **raz** dała fałszywy negatyw — sama fizyczna kolejność w tym konkretnym
przebiegu nie zmieniła się (mimo że hash-stability, właściwa asercja testu, nadal by przeszła poprawnie —
nie sprawdzono tego bezpośrednio w tamtym przebiegu, bo test przerwał się na wcześniejszej asercji). To NIE
jest regresja naprawy — to zbyt surowa asercja diagnostyczna sprzężona z niedeterministycznym stanem
fizycznym bazy (dokładnie tego samego rodzaju niedeterminizm, który cały ten raport bada — ironicznie
złapałem to na własnym teście). **Naprawione**: zamieniono twardą asercję na `console.warn` — właściwa
asercja (`content_semantic_hash` musi być identyczny) jest nienaruszona i to ONA jest tym, co złapała
regresję w kontroli negatywnej (§3), nie usunięta asercja. Po zmianie: **2 kolejne pełne przebiegi
`finance/canonical` → 37/37, 454/454, zero flake**.

## 7. Komendy reprodukcji

```bash
PGBIN=/opt/homebrew/opt/postgresql@15/bin
PGDATA=/private/tmp/fv3-det-pgdata ; PGSOCK=/tmp/fv3detsock ; PORT=57791
rm -rf "$PGDATA" "$PGSOCK" && mkdir -p "$PGDATA" "$PGSOCK"
LC_ALL=C $PGBIN/initdb -D "$PGDATA" -U postgres -E UTF8 --locale=C
LC_ALL=C $PGBIN/pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -c listen_addresses=127.0.0.1" -l /tmp/fv3det_pg.log start
$PGBIN/psql -h 127.0.0.1 -p $PORT -U postgres -c "CREATE DATABASE fv3_det;"
DBURL="postgresql://postgres@127.0.0.1:$PORT/fv3_det"
NODE_ENV=test DB_TYPE=postgres DATABASE_URL="$DBURL" npx tsx server/scripts/migrate.postgres.ts

cd server
NODE_OPTIONS="--max-old-space-size=8192" npx tsc -p . --noEmit

RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" NODE_ENV=test \
  npx vitest run src/services/finance/canonical --no-file-parallelism

RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" NODE_ENV=test \
  npx vitest run src/services/finance --no-file-parallelism

# testy determinizmu w izolacji (nie wymagają bazy dla wariantów *.test.ts czystych)
npx vitest run src/services/finance/canonical/__tests__/kpiHashOrderDeterminism.test.ts
npx vitest run src/services/finance/canonical/__tests__/valuationFcffOrderDeterminism.test.ts
RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL="$DBURL" NODE_ENV=test \
  npx vitest run src/services/finance/canonical/__tests__/kpiComputeService.determinism.pg.test.ts --no-file-parallelism

# kontrola negatywna (przykład dla zgłoszenia 1 — analogicznie dla zgłoszenia 2 z valuationFcffService.ts)
git show HEAD~2:server/src/services/finance/canonical/kpiComputeService.ts \
  > server/src/services/finance/canonical/kpiComputeService.ts   # BEZ git stash
npx vitest run src/services/finance/canonical/__tests__/kpiHashOrderDeterminism.test.ts   # -> RED
git checkout HEAD -- server/src/services/finance/canonical/kpiComputeService.ts           # przywróć naprawę
npx vitest run src/services/finance/canonical/__tests__/kpiHashOrderDeterminism.test.ts   # -> GREEN
```

Po pracy klaster posprzątany (`pg_ctl stop`, usunięcie `PGDATA`/gniazda).

---

## 8. `EVIDENCE_MISSING`

- **Zgłoszenie 1, wpływ na produkcję/demo**: nie sprawdziłem żywej bazy demo/prod pod kątem tego, ile
  istniejących `content_semantic_hash` dla `HISTORICAL_ANALYSIS` faktycznie różni się od tego, co dałaby
  ponowna kalkulacja z `hashPayloadFor()` — nie mam dostępu (i zakaz połączeń z demo/staging/prod dla tego
  zadania). Analiza w §1.4 jest strukturalna (oparta na tym, JAK kod może w ogóle ponownie policzyć hash),
  nie empiryczna na realnych danych produkcyjnych.
  - Nie sprawdziłem wyczerpująco całego repo pod kątem callerów, które mogłyby wymusić NOWY `compute_jobs`
    dla logicznie tej samej treści (np. panel admina z "wymuś przeliczenie") — patrz §1.4.
- **Zgłoszenie 2, dokładny próg tabeli/planu, który wywołuje przełączenie seq→index scan**: potwierdziłem
  MECHANIZM (kolejność zmienia się między przebiegami w miarę wzrostu współdzielonej tabeli) i namierzyłem
  DOKŁADNĄ linię kodu (`sumFlow`/`loadCells` w `valuationFcffService.ts`), ale nie zmierzyłem precyzyjnie,
  przy jakiej liczbie wierszy/statystyk Postgres faktycznie przełącza plan dla tej konkretnej tabeli —
  niepotrzebne do naprawy (naprawa jest niezależna od przyczyny zmiany kolejności), ale gdyby ktoś chciał
  to dokładnie odtworzyć krok po kroku, wymagałoby to dodatkowego eksperymentu ze statystykami/`EXPLAIN
  ANALYZE` na rosnącej tabeli.
- Nie zweryfikowałem wpływu tej naprawy na `finance_valuation_sensitivity_cells`/5×5 grid (który też czyta
  `dcf.fcffYears`) — grid jest budowany z JUŻ POLICZONEGO `fcff.years` (deterministycznego po naprawie), więc
  strukturalnie powinien być bezpieczny, ale nie uruchomiłem osobnego testu specyficznie dla grida.
