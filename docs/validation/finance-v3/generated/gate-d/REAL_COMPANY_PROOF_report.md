# REAL_COMPANY_PROOF — Finance v3 na prawdziwych danych spółek

**Zakres:** handoff `FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` §13 — „Po GoldCo: CD Projekt,
Apator, Tesco i Tesla jako real-data proof. **Apator musi zachować poprawną skalę około PLN 466 mln, nie
466 tys.**"

**Data:** 2026-08-10 · **Gałąź:** `codex/finance-v3-roi-e007-integration` (HEAD przed commitem `efd0378a5c`)
**Baza:** własny efemeryczny PostgreSQL 15.15, `initdb --locale=C`, port 56347, katalog
`/private/tmp/apator-realco-pgdata`, zatrzymany i usunięty po przebiegu. **Żadnego kontaktu z demo/dev/prod.**
**Kod produkcyjny nietknięty** — to test istniejących serwisów; znalezione błędy są udokumentowane, nie naprawiane.

**Werdykt:** `REAL_DATA_PROOF_PARTIAL` — Apator przechodzi łańcuch Statements → Analysis i **utrzymuje
poprawną skalę (PLN, setki milionów / miliardy)**, ale ten sam pakiet dowodowy ujawnia, że **błąd 1000× jest
ŻYWY dla dokumentów anglojęzycznych** (Tesla, Coca-Cola, BMW, bp) — a to jest dokładnie klasa błędu z §13.

---

## 1. Co realnie jest w repo (ustalenie przed pracą)

Źródłowych PDF-ów Apatora **nie ma w repo** — `knowledge/Finanse/` zawiera wyłącznie podkatalog
„FINANSE materiały" (podręczniki). Ścieżki z manifestów (`knowledge/Finanse/Apator SA Raport R 2024.pdf`
itd.) wskazują na pliki, które nie są wersjonowane.

Natomiast **prawdziwe, wyekstrahowane wartości sprawozdań SĄ w repo** — w dowodach z przebiegu importu:

| Plik | Zawartość | Czy ma surowe liczby? |
|---|---|---|
| `generated/STATEMENT_IMPORT_SAMPLE_AUDIT_2026-03-15.json` (693 KB) | 11 dokumentów, `topMappedLines` z `canonicalId` + `label` + `value` | **TAK — 355 pozycji dla samego Apatora** |
| `generated/APATOR_VERIFY_v7.json` | to samo, węższy wycinek (3 linie BS zamiast 33) | TAK, uboższe |
| `generated/APATOR_VERIFY_v2..v9`, `v6/v8/v9_stability` | metryki stabilności/pokrycia | metadane |
| `generated/FINANCE_IMPORT_APATOR_FULL_RESULTS_2026-03-15.json` | statusy uploadu/detekcji/mapowania, `coveragePct`, `readinessStatus` | **NIE — tylko metadane** |
| `generated/STATEMENT_IMPORT_APATOR_FULL_MANIFEST_2026-03-15.json` | lista plików wejściowych | NIE |
| `generated/OFFLINE_AUDIT_NON_APATOR_v3..v21*.json` | jw., dla BMW/KGHM/bp/KO/Tesla | metadane + `topMappedLines` z wartościami |

**Dostępność spółek z §13** (`crosscompany_scale_survey.json`):

| Spółka z §13 | W repo? | Dokumenty |
|---|---|---|
| **Apator** | **TAK** | Apator SA R 2024, Grupa Apator RS 2023, Grupa Apator RS 2024, Raport skonsolidowany (FY2022) |
| **Tesla** | **TAK** | Tesla 10-K 2024 |
| CD Projekt | **NIE** | — |
| Tesco | **NIE** | — |

Dodatkowo obecne (poza §13): BMW Group 2024, KGHM SRR 2024, bp 2025, Coca-Cola 10-K, oraz dwa
arkusze „BDG 2026 V1" (xlsx/xls).

**Wniosek o zakresie:** pełny proof end-to-end da się zrobić **tylko dla Apatora** (3 kolejne lata GRUPY
skonsolidowanej: FY2022 → FY2023 → FY2024, komplet BS/P&L/CF). Tesla ma jeden rok i — jak pokazuje §5 —
dane rozsypane przez błąd parsowania. **Niczego nie dofabrykowałem**: wszystkie liczby poniżej pochodzą
verbatim z `STATEMENT_IMPORT_SAMPLE_AUDIT_2026-03-15.json` (kopia robocza:
`realcompany/apator_real_source.json`), a linie wyprowadzone w PASS B mają jawny wzór w `sourceRef.derivation`.

---

## 2. Co zrobiono

`realcompany/apator_real_pipeline.ts` (wzorowany na `goldco/goldco_full_dag.ts`) przepuszcza prawdziwe dane
Apatora przez **realne serwisy Gate D**: `statementMappingService` → `statementReconciliationService` →
readiness gate → `artifactVersionService` (review/approve) → `lineageService` → `kpiComputeService` (18 KPI P0).
Trzy okresy FY2022/23/24 spięte przez `previous_period_id`, jedna encja `GROUP`, `unit='THOUSANDS'`, PLN.

Dwa przebiegi na tych samych danych:

- **PASS A — „jak wyszło z ekstrakcji"**: mapowanie 1:1 kanoniczne ID ekstraktora → kod P0, bez ingerencji analityka.
- **PASS B — „uzupełnione przez analityka"**: dodatkowo linie wyprowadzone z tożsamości księgowych
  (NET_INCOME, EBITDA, D&A, CFO, FCF, OPEX, WORKING_CAPITAL) i normalizacja znaku kosztów.

Plus cztery sondy: kontrola skali (`UNITS` vs `THOUSANDS`), roll-forward zysków zatrzymanych, tolerancja
bilansu, `sign_convention`, oraz wycena FCFF na realnych danych.

Czas przebiegu: **~1,1 s**. Artefakty: `realcompany/apator_real_pipeline_results.json`,
`realcompany/apator_real_pipeline_run.log`.

---

## 3. APATOR SCALE PROOF (rdzeń zadania)

Prawdziwe wartości Grupy Apator FY2024 po przejściu przez `finance_stmt_lines`, odczytane produkcyjną
funkcją `valuationFcffService.toFullUnitValue()` (`value_decimal × FINANCE_UNIT_MULTIPLIER[unit] × multiplier`):

| Kod P0 | `value_decimal` (zapis) | `unit` | Pełne PLN | Odczyt „ślepy na jednostkę" |
|---|---:|---|---:|---:|
| REVENUE | 1 227 799 | THOUSANDS | **1 227 799 000** | 1 227 799 (**1000× za mało**) |
| TOTAL_ASSETS | 965 357 | THOUSANDS | **965 357 000** | 965 357 |
| EQUITY | 592 502 | THOUSANDS | **592 502 000** | 592 502 |
| EBITDA | 142 446 | THOUSANDS | **142 446 000** | 142 446 |
| EBIT | 85 134 | THOUSANDS | **85 134 000** | 85 134 |
| NET_INCOME | 73 214 | THOUSANDS | **73 214 000** | 73 214 |
| LONG_TERM_DEBT | 63 274 | THOUSANDS | **63 274 000** | 63 274 |
| CASH | 17 716 | THOUSANDS | **17 716 000** | 17 716 |

**Wycena na realnym FCFF** (sonda 4, produkcyjne `computeGordonTerminalValue` + `discountCashFlows` +
`computeEquityValue`). Wejścia wyłącznie z realnych liczb Apatora FY2024:
EBIT 85 134 000 PLN · efektywna stopa podatku 10,52% (8 604/81 818) · D&A 57 312 000 PLN ·
CAPEX 43 691 000 PLN · ΔWC 31 347 000 PLN → **FCFF = 58 455 289 PLN**.

Siatka 5 WACC × 3 g (**pasmo ilustracyjne, nie opinia wyceniająca** — chodzi wyłącznie o rząd wielkości):

| | EV (PLN) |
|---|---|
| minimum z 15 komórek (WACC 12%, g 1%) | **531 411 715** |
| maksimum (WACC 8%, g 3%) | **1 169 105 773** |
| **wszystkie 15 komórek ≥ PLN 100 mln** | **TAK** |
| ten sam rachunek przy odczycie ślepym na jednostkę | **531 412 … 1 169 106 PLN** (poniżej PLN 1,2 mln) |

**Werdykt skali: PASS.** Wartości Apatora lądują w paśmie 10⁸–10⁹ PLN (kotwica z §13 „~PLN 466 mln" leży
wewnątrz tego pasma). Awaryjny tryb „466 tys." jest odtworzony jako kontrfakt: odczyt ignorujący
`unit`/`multiplier` daje dokładnie 1000× mniej — czyli setki tysięcy zamiast setek milionów.

**Kontrola niezależna (scale control):** te same realne liczby zaimportowano po raz drugi, przemnożone
×1000 i zadeklarowane jako `unit='UNITS'`. Wszystkie **36/36 komórek KPI jest identycznych** co do bitu
(`kpiInvariance: compared=36, identical=36, mismatches=0`). To nie jest przypadek: **wszystkie 18 KPI z
katalogu P0 to RATIO/PERCENT/DAYS**, czyli ilorazy wielkości w tej samej jednostce. Warstwa Analysis jest
z konstrukcji odporna na skalę — mimo że `kpiComputeService.loadStmtLineCells()` **w ogóle nie czyta
kolumny `unit`**. Dziś to nie szkodzi; to jest dokładnie ta bezpieczna zależność, którą trzeba świadomie
utrzymać: **pierwszy KPI o wymiarze walutowym w katalogu P0 natychmiast wprowadzi błąd 1000×.**
Zapisane jako ryzyko RC-07.

---

## 4. Statements → Analysis: co realnie policzyło się na niepełnych danych

`finance_stmt_readiness_check` przeszedł w obu przebiegach (`CLEAN`, residual 0), pakiety osiągnęły
`APPROVED`. Bilans, roll-forward gotówki (22 939 + (−5 223) = 17 716) i łańcuch okresów zgadzają się na
prawdziwych danych bez ani jednej korekty.

**PASS A (jak wyszło z ekstrakcji): 68 z 280 wartości trafiło na kanoniczne linie; 212 wykluczono.**
KPI FY2024: **7/18 z wartością**, z czego **6 wiarygodnych** (jedno — INTEREST_COVERAGE — z błędnym znakiem,
oflagowane); 2 `NOT_APPLICABLE`, 9 `MISSING`.

**PASS B (uzupełnione): 84 zmapowane wiersze, 0 wykluczonych.** KPI FY2024: **15/18 z wartością**,
z czego 14 wiarygodnych (DPO liczone z uszkodzonego AP — RC-05); 3 `MISSING`.

| KPI (FY2024) | PASS A | PASS B | komentarz |
|---|---|---|---|
| GROSS_MARGIN_PCT | 0,25634 | 0,25634 | zgodne |
| CURRENT_RATIO | 1,50982 | 1,50982 | |
| QUICK_RATIO | 0,78154 | 0,78154 | |
| CASH_RATIO | 0,05723 | 0,05723 | |
| DEBT_TO_EQUITY | 0,10679 | 0,10679 | |
| REVENUE_GROWTH_YOY | 0,07969 | 0,07969 | 1 227 799 / 1 137 174 − 1 |
| INTEREST_COVERAGE | **−11,2033** `NEGATIVE_DENOMINATOR` | **8,6194** | PASS A bierze „Wynik na działalności finansowej" jako koszt odsetek (RC-08) |
| DIO | `NOT_APPLICABLE` | 93,749 | PASS A: ujemny mianownik (COGS jak w sprawozdaniu = −913 065) |
| DPO | `NOT_APPLICABLE` | **18,903** | wartość policzona z **uszkodzonego** AP (RC-05) |
| EBITDA_MARGIN_PCT | `MISSING` | 0,11602 | EBITDA nie istnieje w sprawozdaniu, trzeba wyprowadzić |
| NET_MARGIN_PCT | `MISSING` | 0,05963 | jw. NET_INCOME |
| ROA / ROE | `MISSING` | 0,07546 / 0,12941 | jw. |
| OPERATING_CASH_FLOW_MARGIN | `MISSING` | 0,01796 | CFO nie występuje jako osobna pozycja |
| FCF_MARGIN | `MISSING` | −0,01763 | |
| **DSO** | `MISSING` | **`MISSING`** | brak AR za FY2023 w ekstrakcji (RC-06) |
| **CASH_CONVERSION_CYCLE** | `MISSING` | **`MISSING`** | pochodna DSO |
| **DEBT_TO_EBITDA** | `MISSING` | **`MISSING`** | `LTM_SUM_4Q` wymaga okresów kwartalnych (RC-09) |

**To jest najcenniejszy wynik odcinka:** na prawdziwym, kompletnym rocznym raporcie giełdowej spółki
katalog P0 dowozi **7/18 KPI bez pracy analityka** i **15/18 po ręcznym uzupełnieniu**, przy czym 3 KPI
są nieosiągalne strukturalnie (brak danych źródłowych w jednym roku + wymóg kwartałów).

Linie, których **nie dało się wyprowadzić** mimo prób: `CFO` i `FCF` za FY2023 — bo raport RS 2023 nie
oddał do ekstrakcji pozycji „przepływy z działalności finansowej", a CFO liczę jako
`net change − CFI − CFF`. Jedna brakująca pozycja CF wywraca dwa KPI za cały rok.

---

## 5. ⚠ Znaleziska — pełna lista

RC-01…RC-06 są emitowane automatycznie przez pipeline (`apator_real_pipeline_results.json → findings`).
RC-00, RC-07, RC-08 i RC-09 pochodzą z survey'a i z analizy wyników — dowody wskazane przy każdym.

### RC-00 (**P0**) — błąd 1000× jest ŻYWY dla dokumentów z angielskim separatorem tysięcy

Kotwica z §13 („466 mln, nie 466 tys.") jest **spełniona dla Apatora i nie jest spełniona dla reszty**.
Ekstraktor interpretuje przecinek jako separator dziesiętny, więc anglojęzyczne „122,070" staje się
`122.07`. **Ciąg cyfr jest zachowany, zmienia się tylko rząd wielkości — dokładnie o 1000×.**

Detektor (`crosscompany_scale_survey.ts`: odsetek wyekstrahowanych wartości z częścią ułamkową):

| Dokument | deklarowana skala | % wartości z ułamkiem | wniosek |
|---|---|---:|---|
| Apator SA R 2024 | thousands | **0,0%** z 75 | czysto (polski format: spacja) |
| Grupa Apator RS 2023 | thousands | **0,0%** z 89 | czysto |
| Grupa Apator RS 2024 | thousands | **0,0%** z 90 | czysto |
| Raport skonsolidowany Apator | thousands | **0,0%** z 101 | czysto |
| KGHM SRR 2024 | millions | 2,4% z 42 | czysto (format PL) |
| BMW Group 2024 | millions | **46,2%** z 52 | **uszkodzone** |
| bp 2025 | thousands | **48,3%** z 60 | **uszkodzone** |
| Coca-Cola 10-K | millions | **71,4%** z 35 | **uszkodzone** |
| **Tesla 10-K 2024** | millions | **74,4%** z 39 | **uszkodzone** |

Dowody jednostkowe (wartość zapisana → ta sama sekwencja cyfr przy poprawnej interpretacji separatora):

- Tesla `fsl-bs-total-assets` = **122.07** → 122 070 (mln USD). Deklarowana skala „millions" ⇒ system
  widzi USD 122,07 mln zamiast USD 122,07 mld.
- Tesla `fsl-bs-cash` = **16.139** → 16 139. `fsl-bs-inventory` = **12.017** → 12 017.
- Coca-Cola `fsl-bs-total-assets` = **100.549** → 100 549. `fsl-bs-cash` = **10.828** → 10 828.
- BMW `fsl-bs-total-assets` = **267.732** → 267 732. `fsl-bs-current-assets` = **36.752** → 36 752.
- bp `fsl-bs-total-assets` = **26.574** → 26 574 (przy błędnie wykrytej skali „thousands", więc łączny
  błąd rzędu 10⁷).

To nie jest hipoteza o wartościach rynkowych — dowód jest wewnętrzny: **identyczny ciąg cyfr, inny
separator**, przy 0% takich przypadków w czterech dokumentach polskich i 46–74% w czterech anglojęzycznych.
Warstwa Gate D (`unit`/`multiplier`) jest tu bez winy i bez szans: dostaje już zepsutą liczbę.

**Reprodukcja:** `npx tsx docs/validation/finance-v3/generated/gate-d/realcompany/crosscompany_scale_survey.ts`
(bez bazy danych).

### RC-01 (P1) — taksonomia P0 unosi ułamek prawdziwego sprawozdania IFRS

**212 z 280** prawdziwych wartości Apatora (89 różnych identyfikatorów ekstraktora) nie ma celu w 31-kodowej
taksonomii `financial_statement_lines` (is_system). Ekstraktor emituje rejestr 251 pozycji
(`server/src/services/financeCanonicalRegistry.ts`), Gate D rozumie 31. Wszystko poniżej poziomu EBIT —
leasing/ROU, wartość firmy, podatek odroczony, ruchy kapitału obrotowego, OCI, udziały niekontrolujące —
odpada na granicy Gate D. Import przechodzi jako `CLEAN` z residual 0, więc **utrata detalu jest cicha**.

### RC-02 (P1) — roll-forward zysków zatrzymanych odrzuca prawidłowo złożone realne sprawozdanie IFRS

Sonda 1: do PASS B dołożono prawdziwą, raportowaną dywidendę. Wynik — **cały import wywalony wyjątkiem**:

```
finance_stmt_lines: retained earnings roll-forward failed ... :
opening=-29215 + NI=8504 - dividends=14612 != closing=-72699 (diff=37376, tolerance=1000)
```

Ręczne przeliczenie z realnych danych:

| Rok | opening RE | + NI | − dywidendy | = implikowane | raportowane closing RE | luka (tys. PLN) |
|---|---:|---:|---:|---:|---:|---:|
| FY2023 | −29 215 | 8 504 | 14 612 | −35 323 | **−72 699** | −37 376 |
| FY2024 | −72 699 | 73 214 | 17 428 | −16 913 | **8 590** | +25 503 |

Tożsamość P0 `openingRE + NI − dividends = closingRE` **nie obowiązuje** w realnym skonsolidowanym kapitale
IFRS (przeksięgowania na „Pozostałe kapitały", akcje własne, OCI, NCI). Skutek jest maksymalnie dotkliwy:
`CREATE CONSTRAINT TRIGGER ... DEFERRABLE` przerywa całą transakcję mapowania — analityk nie dostaje
ostrzeżenia ani wyjątku do rozstrzygnięcia, tylko utratę całego importu. GoldCo tego nie wykryło, bo
syntetyczny oracle spełnia tożsamość z definicji.

### RC-03 (P1) — tolerancja bilansu skaluje się 1000× razem z deklarowaną jednostką

`finance_stmt_balance_tolerance()` zwraca `finance_stmt_unit_value(unit)` (=1000 dla `THOUSANDS`) i
porównuje to z `value_decimal`, które **już jest wyrażone w tysiącach**. Komentarz w migracji mówi
„1 full presentation unit" (czyli 1 000 PLN), a efektywnie dopuszczone jest **1 000 000 PLN**.

Sonda 2 na realnym bilansie Apatora FY2024:

| wstrzyknięta nierównowaga | w pełnych PLN | wynik |
|---:|---:|---|
| 500 tys. | 500 000 PLN | **ZAAKCEPTOWANE** (bilans „się zgadza") |
| 1 500 tys. | 1 500 000 PLN | odrzucone |

Przy `unit='UNITS'` ten sam kod toleruje 1 PLN. To ta sama klasa błędu jednostkowego co Apator 1000×,
tylko w drugą stronę — i dotyka bramki, która ma być ostatnią linią obrony przed niezbilansowanym pakietem.
`server/migrations/20260809_finance_v3_d01_statements_02_integrity.sql:41-68`.

### RC-04 (P1) — `sign_convention` jest zapisywane, ale nigdy nie stosowane przy liczeniu

Realne sprawozdania niosą koszty ze znakiem ujemnym (Apator FY2024 COGS = −913 065 tys. PLN); formuły P0
zakładają konwencję dodatnią (oracle GoldCo ma `cogs: 106000000`). Sonda 3: zadeklarowano
`signConvention='CONTRA'` dla wszystkich ujemnych linii kosztowych. Zapis się udaje —
`finance_stmt_lines.sign_convention='CONTRA'` dla COGS, `value_decimal=-913065` — ale
**DIO FY2024 dalej `NOT_APPLICABLE` (`negative_denominator_policy=FORCE_NA`)**.
Powód: `kpiComputeService.loadStmtLineCells()` (ok. linii 205–215) pobiera tylko
`entity_id, canonical_line_id, period_id, consolidation_scope, accumulation_basis, value_status, value_decimal`.
Kolumny `sign_convention` nie ma w projekcji. Jedyne wyjście dla analityka to fizyczne odwrócenie znaku,
co niszczy wartość „as filed".

### RC-05 (P1) — nieprawdopodobna wartość z ekstrakcji przechodzi przez cały łańcuch bez zaczepienia

`fsl-bs-ap` (zobowiązania handlowe) Grupy Apator: FY2022 = 121 894, FY2023 = 93 591, **FY2024 = 722** tys. PLN.
Spadek o 99,2% r/r przy przychodach 1,23 mld PLN to defekt ekstrakcji, nie zdarzenie gospodarcze.
Żaden readiness check, żadna reguła rekonsyliacji ani żaden `quality_flag` tego nie łapie —
**DPO FY2024 = 18,90 dnia zapisuje się jako `PRESENT_NONZERO`** (wobec 44,62 za FY2023). Uśrednianie
`AVERAGE_CURRENT_AND_PRIOR` częściowo maskuje skalę defektu, przez co liczba wygląda wiarygodnie.

### RC-06 (P2) — brak jednej pozycji w jednym roku cicho wyłącza dwa KPI

`fsl-bs-ar` jest wyekstrahowane dla FY2022 (189 804) i FY2024 (185 495), **ale nie dla FY2023** — ten sam
emitent, ten sam typ sprawozdania. Skutek: DSO i CASH_CONVERSION_CYCLE za FY2024 są `MISSING` również w
PASS B. Użytkownik widzi „brak danych" bez informacji, że brakuje jednego wiersza z jednego roku.

### RC-07 (ryzyko, P2) — niezmienniczość KPI wobec jednostki jest przypadkowa, nie wymuszona

Wszystkie 18 KPI P0 to `RATIO`/`PERCENT`/`DAYS`, więc jednostka się skraca — i dlatego 36/36 komórek
zgadza się bit w bit między `THOUSANDS` a `UNITS`. Ale `kpiComputeService` **nie czyta `unit` ani
`multiplier`** (w odróżnieniu od `valuationFcffService.toFullUnitValue()`, który robi to poprawnie).
Pierwszy KPI o wymiarze walutowym (np. „EBITDA w PLN", „net debt") wprowadzi błąd 1000× w tej warstwie.
Rekomendacja: test regresyjny, który jest dziś zielony i pęknie w dniu dodania takiego KPI.

### RC-08 (P2) — ekstraktor przypisuje pozycje do kanonicznych ID o innym znaczeniu

Dwa przypadki wprost na Apatorze:
- `fsl-pl-interest` ← „Wynik na działalności finansowej" (**wynik netto**, nie koszt odsetek) →
  INTEREST_COVERAGE = **−11,20** z flagą `NEGATIVE_DENOMINATOR` w PASS A; poprawnie 8,62 po podstawieniu
  `fsl-cf-operating-interest-cost` = 9 877.
- `fsl-pl-opex` ← „Zysk ze sprzedaży" (**zysk**, nie koszty operacyjne).

Silnik KPI zachował się tu przyzwoicie — oflagował ujemny mianownik zamiast schować wynik.

### RC-09 (obserwacja, P3) — DEBT_TO_EBITDA jest strukturalnie niedostępne dla danych rocznych

`formula_ast` używa `periodOffset='LTM_SUM_4Q'`, a `resolvePeriodOffset` zwraca dla okresu FY
`WRONG_PERIOD_TYPE_FOR_LTM`. Zachowanie jest **uczciwe** — powód trafia do
`finance_analysis_kpi_values.interpretation_text`:
`"WRONG_PERIOD_TYPE_FOR_LTM: LTM_SUM_4Q requires a period_type='Q' current period, got 'FY'"`.
Warto jednak wiedzieć, że najczęstszy realny kształt danych (opublikowany raport roczny) z definicji
nie dowozi 1 z 18 KPI.

---

## 6. Czym realne dane różniły się od GoldCo

| Wymiar | GoldCo (syntetyczny) | Apator (realny) | Konsekwencja |
|---|---|---|---|
| Znak kosztów | dodatni (`cogs: 106000000`) | ujemny, jak w sprawozdaniu (−913 065) | DIO/DPO → `NOT_APPLICABLE` (RC-04) |
| Roll-forward RE | spełniony z konstrukcji | luka 25–37 mln PLN | **import odrzucony** (RC-02) |
| Kompletność linii | oracle dostarcza EBITDA/CFO/NET_INCOME | brak EBITDA, D&A, CFO, FCF, NET_INCOME | 8 KPI wymaga wyprowadzenia |
| Ciągłość między latami | pełna | brak AR w FY2023, brak CFF w FY2023 | 2 KPI trwale `MISSING` |
| Szerokość taksonomii | pack zbudowany pod 31 kodów | 89 identyfikatorów bez celu | 76% detalu odpada (RC-01) |
| Jakość wartości | z definicji poprawne | AP FY2024 = 722 (defekt) | liczba nieprawdziwa, status `PRESENT_NONZERO` (RC-05) |
| Format liczb | jeden, kontrolowany | PL: spacja; EN: przecinek | **błąd 1000× dla EN** (RC-00) |
| Typ okresu | FY + miesiące | wyłącznie FY | DEBT_TO_EBITDA niedostępne (RC-09) |

---

## 7. Reprodukcja

```bash
PORT=56347   # sprawdź lsof -i:$PORT; nigdy 5432/28711/52824/57900/28933
LC_ALL=C /opt/homebrew/opt/postgresql@15/bin/initdb --locale=C -E UTF8 \
  -D /private/tmp/apator-realco-pgdata -U postgres
LC_ALL=C /opt/homebrew/opt/postgresql@15/bin/pg_ctl -D /private/tmp/apator-realco-pgdata \
  -o "-p $PORT -h 127.0.0.1 -k /private/tmp" -l /private/tmp/apator-pg.log start
/opt/homebrew/opt/postgresql@15/bin/createdb -h 127.0.0.1 -p $PORT -U postgres finance_v3_realcompany

DB_TYPE=postgres NODE_ENV=test \
  DATABASE_URL=postgresql://postgres@127.0.0.1:$PORT/finance_v3_realcompany \
  npx tsx server/scripts/migrate.postgres.ts

DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
  DATABASE_URL=postgresql://postgres@127.0.0.1:$PORT/finance_v3_realcompany \
  npx tsx docs/validation/finance-v3/generated/gate-d/realcompany/apator_real_pipeline.ts

# survey nie wymaga bazy
npx tsx docs/validation/finance-v3/generated/gate-d/realcompany/crosscompany_scale_survey.ts

/opt/homebrew/opt/postgresql@15/bin/pg_ctl -D /private/tmp/apator-realco-pgdata stop
rm -rf /private/tmp/apator-realco-pgdata
```

Weryfikacja seedu przed przebiegiem: `finance_analysis_kpi_catalog` ACTIVE = 18,
`financial_statement_lines` = 31, tabel `finance_stmt*` = 7.

---

## 8. Artefakty

| Plik | Co zawiera |
|---|---|
| `realcompany/apator_real_source.json` | 355 prawdziwych pozycji Apatora (4 dokumenty), verbatim z audytu ekstrakcji |
| `realcompany/apator_real_pipeline.ts` | pipeline Statements → Analysis + 4 sondy |
| `realcompany/apator_real_pipeline_results.json` | wszystkie KPI, scale proof, sondy, znaleziska |
| `realcompany/apator_real_pipeline_run.log` | pełny log przebiegu |
| `realcompany/crosscompany_scale_survey.ts` | detektor skali/waluty/separatora dla 11 dokumentów |
| `realcompany/crosscompany_scale_survey.json` | wynik survey, w tym dowody RC-00 |

## 9. Rekomendowana kolejność napraw (poza tym pakietem)

1. **RC-00 (P0)** — normalizacja separatora liczb per format dokumentu w ekstraktorze; do czasu naprawy
   każdy dokument anglojęzyczny jest niewiarygodny co do rzędu wielkości. Bramka: detektor z
   `crosscompany_scale_survey.ts` (odsetek wartości ułamkowych) jako test regresyjny.
2. **RC-02 (P1)** — roll-forward RE musi być *wyjątkiem do rozstrzygnięcia* (`finance_exceptions_current`),
   nie `RAISE EXCEPTION` wywracającym transakcję; albo tożsamość musi objąć OCI/przeksięgowania/NCI.
3. **RC-03 (P1)** — `finance_stmt_balance_tolerance()` musi liczyć tolerancję w tej samej skali co
   `value_decimal` (dziś zawyża 1000× przy `THOUSANDS`).
4. **RC-04 (P1)** — dodać `sign_convention` do projekcji `loadStmtLineCells()` i zastosować przy odczycie
   komórki, albo jawnie usunąć kolumnę i wymusić normalizację na wejściu.
5. **RC-05 (P1)** — kontrola prawdopodobieństwa r/r na poziomie rekonsyliacji (np. skok >50% na pozycji
   bilansowej → wyjątek `DATA_QUALITY`), bo dziś nic tego nie łapie.
6. **RC-01 (P1)** — decyzja właścicielska: rozszerzyć taksonomię P0 albo jawnie raportować, ile pozycji
   źródłowych zostało porzuconych (dziś import melduje `CLEAN`).
