# W2 — FC-11 Performance SLO: regression ceilings declared, production SLO EVIDENCE_MISSING

**Program:** `docs/validation/finance-v3/FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` — gate **FC-11** (Performance and operations)
**Priorytet:** najbardziej pusta bramka programu — 0 PASS, 7 `EVIDENCE_MISSING` na 10 warunków (patrz §9)
**Data:** 2026-08-10
**Worktree:** `/Users/piotrwisniewski/consultify-wt/w2-slo`
**Gałąź:** `codex/finance-v3-w2-slo`, odbita od `cecc7975c1`
**Commity tej pracy:** `4e802059f4` (pomiary), `3d8815def6` (progi + odwrócenie asercji), niniejszy raport = trzeci commit
**Charakter pracy:** deklaracja progów regresyjnych CI + rzetelna próba (i rzetelna odmowa) zadeklarowania produkcyjnego SLO.

> **Zamrożenie uszanowane.** `codex/finance-v3-closeout-fanin` @ `19b4b06934` nietknięta. Zero merge, zero push, zero połączeń ze staging/demo/produkcją. Wszystko poniżej zmierzone na własnym, efemerycznym klastrze PostgreSQL 15, usuniętym po pracy.

---

## 0. Werdykt w jednym akapicie

**Progi regresyjne CI SĄ teraz zadeklarowane** — pięć progów, po jednym na ścieżkę compute (D1 Baseline, D2 KPI, D3a Valuation DCF, D3b Sensitivity grid, D3 razem), każdy wyprowadzony liczbowo z dwóch własnych, niezależnych przebiegów n=20 plus dwóch cytowanych przebiegów W9, z jawnym mnożnikiem bezpieczeństwa (5×) i jawnym uzasadnieniem tego mnożnika. Kontrola negatywna potwierdza, że próg **łapie realną regresję** (czerwony przy wstrzykniętym opóźnieniu) **i nie jest bezużytecznie luźny** (granica zapłonu leży w okolicach samego mnożnika projektowego, nie 10×). **Produkcyjny SLO (p50/p95/p99 jako budżet, do którego rozliczany jest system na żywo) pozostaje `EVIDENCE_MISSING` — świadomie i celowo.** Powód jest teraz mocniejszy niż w W9: moje własne dwa przebiegi n=20, na tej samej maszynie, tej samej bazie, zero zmian w kodzie między nimi, dały medianę D1 Baseline **1368,1 ms vs 147,34 ms — różnica 9,3×**, gorszą niż cytowana różnica międzyprzebiegowa 2,2× z W9. Ładunek maszyny w trakcie tej pracy sięgał load average **168 przy 16 rdzeniach** (inni agenci równolegle stawiają własne klastry Postgresa) — to nie jest środowisko, na którym można uczciwie postawić budżet produkcyjny.

**Rekomendacja bramki FC-11:** pozostaje `EVIDENCE_MISSING` dla połowy produkcyjnej (deklarowany SLO), ale **nie jest już pusta** — regresja CI ma teraz twardy, uzasadniony, przetestowany negatywnie mechanizm. Zobacz §9 za pełną inwentaryzację 10 warunków.

---

## 1. Środowisko i metoda

| Element | Wartość |
| --- | --- |
| Baza | PostgreSQL **15.15** (Homebrew, **nie** @16), własny efemeryczny klaster |
| `initdb`/`pg_ctl` | `LC_ALL=C`, `--locale=C`, `-E UTF8`, `listen_addresses=127.0.0.1` |
| Katalog danych | `/private/tmp/fv3-slo-pgdata` (poza scratchpadem sesji), gniazdo `/tmp/fv3slosock` |
| Port | **57701** — poza zakazaną listą, sprawdzony wolny przed startem |
| Migracje | `server/scripts/migrate.postgres.ts` **strict** (bez `--safe`) → **exit 0**, 88 plików migracji, 1457 tabel na świeżej bazie |
| Bramka testów | `RUN_DB_TESTS=1` **oraz** `MOCK_DB=false` **oraz** jawny `DATABASE_URL` |
| Runner | `npx vitest run --config vitest.config.ts ... --no-file-parallelism`, z `server/` |
| Sprzątanie | wykonane po zakończeniu pracy (`pg_ctl -m fast stop` + `rm -rf` katalogu danych i gniazda) |

**Obciążenie maszyny w trakcie pracy** (kluczowy kontekst wniosków, nie usterka — patrz §5): równolegle na tej samej maszynie pracowało kilku innych agentów z własnymi klastrami Postgresa.

| Moment | `uptime` |
| --- | --- |
| Przed regresją PRZED zmianami | `load averages: 133.23 77.53 61.12` |
| Przed własnym przebiegiem #1 (n=20) | `load averages: 168.48 152.65 117.72` |
| Przed własnym przebiegiem #2 (n=20) | `load averages: 90.01 141.19 120.46` |
| Przed regresją PO zmianach | `load averages: 105.27 83.94 71.04` |

Load average 90–168 na maszynie 16-rdzeniowej to ekstremalne, niestabilne obciążenie — każdy pomiar poniżej trzeba czytać w tym kontekście.

---

## 2. Regresja `finance/canonical` — PRZED i PO, obie liczby

| | Test Files | Tests |
| --- | --- | --- |
| **PRZED** zmianami (HEAD `cecc7975c1`, ten sam klaster) | 1 failed / 30 passed (31) | 417 passed / 4 skipped (421) |
| **PO** zmianach (commit `3d8815def6`) | 1 failed / 30 passed (31) | 418 passed / 4 skipped (422) |

Różnica: **+1 passed** — to nowy, czysto synchroniczny test `W2 (inverted #1-3): CI regression ceilings ARE now declared in code...` dodany w tej pracy. **Zero nowych awarii.**

Jedyna awaria, identyczna PRZED i PO (nie spowodowana tą pracą):

```
FAIL src/services/finance/canonical/__tests__/coldReopen.pg.test.ts
     > "Finance v3 cold reopen — FC-05.8 / FC-07.9 / FC-12.4"
SensitivityGridAccessError: writeSensitivityGrid: method undefined not found
  for organization org-w10-coldreopen-...
  at valuationSensitivityService.ts:190:13 (via withPinnedPostgresTransaction PostgresDatabase.ts:546)
  at coldReopen.pg.test.ts:734:5
```

`perfSlo.pg.test.ts` jest jedynym plikiem, który dotknęłam w tym katalogu; ta awaria dotyczy `coldReopen.pg.test.ts` / `valuationSensitivityService.ts` — obu plików nie dotykam (poza moim zakresem robotnika; te serwisy należą do innej, równoległej pracy). Zanotowana i pozostawiona, zgodnie z poleceniem koordynatora — nie diagnozowana dalej.

Surowe logi: `w2_fc11_slo_evidence/baseline_regression_BEFORE.txt`, `.../baseline_regression_AFTER.txt`.

`tsc -p server --noEmit`: **exit 0**.

---

## 3. Własne pomiary — dwa niezależne przebiegi n=20

Fixture identyczny z W9: GoldCo Manufacturing S.A. (PARENT, FY2025), przychód 182 mln PLN, ten sam solver cyrkularności, ten sam 18-KPI katalog, ta sama siatka WACC×g 5×5.

### Własny przebieg #1 (uptime load avg ~168)

| Ścieżka | n | p50 | p95 | min | max | rozrzut |
| --- | --- | --- | --- | --- | --- | --- |
| D1 Baseline | 20 | **1368,10 ms** | **1824,08 ms** | 657,07 | 2307,77 | 120,66 % |
| D2 KPI | 20 | **54,41 ms** | **140,23 ms** | 26,77 | 162,03 | 248,59 % |
| D3a Valuation DCF | 20 | **79,90 ms** | **113,29 ms** | 46,13 | 175,63 | 162,07 % |
| D3b Sensitivity grid | 20 | **32,33 ms** | **64,96 ms** | 13,23 | 74,01 | 188,01 % |
| D3 razem | 20 | **117,14 ms** | **169,67 ms** | 67,92 | 195,33 | 108,77 % |

### Własny przebieg #2 (uptime load avg ~90–141, ~3 min później)

| Ścieżka | n | p50 | p95 | min | max | rozrzut |
| --- | --- | --- | --- | --- | --- | --- |
| D1 Baseline | 20 | **147,34 ms** | **391,10 ms** | 103,41 | 427,82 | 220,17 % |
| D2 KPI | 20 | **12,91 ms** | **25,88 ms** | 9,88 | 65,32 | 429,35 % |
| D3a Valuation DCF | 20 | **49,86 ms** | **115,58 ms** | 33,11 | 115,93 | 166,11 % |
| D3b Sensitivity grid | 20 | **13,95 ms** | **80,50 ms** | 10,31 | 101,82 | 655,95 % |
| D3 razem | 20 | **68,95 ms** | **151,29 ms** | 44,45 | 192,71 | 215,02 % |

**Różnica między MOIMI DWOMA przebiegami, ta sama maszyna, ten sam kod, ~3 minuty od siebie:**

| Ścieżka | p50 #1 | p50 #2 | krotność |
| --- | --- | --- | --- |
| D1 Baseline | 1368,10 ms | 147,34 ms | **9,28×** |
| D2 KPI | 54,41 ms | 12,91 ms | **4,21×** |
| D3a Valuation DCF | 79,90 ms | 49,86 ms | **1,60×** |
| D3b Sensitivity grid | 32,33 ms | 13,95 ms | **2,32×** |
| D3 razem | 117,14 ms | 68,95 ms | **1,70×** |

Surowe dane (JSONL, wszystkie 20 próbek na ścieżkę): `w2_fc11_slo_evidence/own_run1_n20.jsonl`, `.../own_run2_n20.jsonl`.

### Zestawienie z cytowanymi przebiegami W9 (`W9_FAULT_CONCURRENCY_TENANT_MATRIX_report.md` §5)

| Ścieżka | p95 własny #1 | p95 własny #2 | p95 cytowany n=20 | p95 cytowany n=12 |
| --- | --- | --- | --- | --- |
| D1 Baseline | 1824,08 | 391,10 | 336,8 | 867,7 (= max, degeneracja) |
| D2 KPI | 140,23 | 25,88 | 26,4 | 46,9 (= max, degeneracja) |
| D3a Valuation DCF | 113,29 | 115,58 | 155,2 | 202,0 (= max, degeneracja) |
| D3b Sensitivity grid | 64,96 | 80,50 | 81,3 | 49,1 (= max, degeneracja) |
| D3 razem | 169,67 | 151,29 | 204,7 | 215,5 (= max, degeneracja) |

Cztery niezależne przebiegi (dwa moje, dwa cytowane), ta sama metoda, ten sam fixture, **żadne dwa się nie zgadzają w granicach mniejszych niż ~2–9×**. To nie jest szum do wygładzenia — to jest cała treść wniosku w §5.

### Dodatkowy, POBOCZNY punkt danych — pełna regresja katalogu (NIE do cytowania jako izolowany pomiar)

Regresja punktu odniesienia PRZED zmianami (§2) uruchomiła `perfSlo.pg.test.ts` z domyślnym `REPS=12` w ramach przebiegu **całego katalogu `finance/canonical`** (30 innych plików testowych na tym samym klastrze, sekwencyjnie, ale przy ekstremalnym obciążeniu maszyny load avg ~133). Wynik: D1 Baseline p50=**3147,39 ms**, p95=**6735,82 ms** — **15× wolniej** niż jakikolwiek izolowany przebieg powyżej. Ten punkt **celowo NIE wchodzi** do wyprowadzenia progów w §4 (nie jest to izolowany pomiar pojedynczej ścieżki — inne pliki testowe zostawiają dane/obciążenie na tym samym połączeniu), ale jest silnym, dodatkowym dowodem tezy z §0: skala pomiaru na tej maszynie potrafi się rozjechać nawet 15-krotnie w zależności od tego, co jeszcze działa obok.

---

## 4. Progi regresyjne CI — zaprojektowane, nie zmierzone wprost

Plik: `server/src/services/finance/canonical/__tests__/perfSloThresholds.ts`.

**Formuła:** `ceilingMs = ceil(observedMaxP95Ms × 5 / 50) × 50` — zaokrąglenie w górę do pełnych 50 ms dla czytelności audytu.

`observedMaxP95Ms` = **największe** p95 zaobserwowane dla danej ścieżki spośród WSZYSTKICH czterech znanych izolowanych przebiegów n≥12 (własne #1, własne #2, cytowany n=20, cytowany n=12) — **nie** mediana, nie średnia, tylko najgorszy znany przypadek. Przebieg z pełnej regresji katalogu (§3, 15× wolniejszy) jest **wyłączony** z tej podstawy — nie jest izolowanym pomiarem ścieżki.

**Mnożnik = 5.** Uzasadnienie liczbowe: żaden z czterech znanych izolowanych przebiegów, przemnożony przez próg zbudowany z `max × 5`, nawet się nie zbliża do zapalenia (z konstrukcji — próg to `max × 5`, więc sam `max` to 20 % progu). Kontrola negatywna (§7) pokazuje, że granica zapłonu leży w okolicach samego mnożnika (potrzeba dołożyć rząd wielkości `observedMaxP95Ms`, nie 10×) — więc 5× nie jest ani tak luźne, że nic nie złapie, ani tak ciasne, że złapie zwykły szum maszyny.

| Ścieżka | observedMaxP95Ms | źródło maksimum | mnożnik | **ceilingMs** |
| --- | --- | --- | --- | --- |
| D1 Baseline | 1824,08 ms | własny #1 | 5× | **9150 ms** |
| D2 KPI | 140,23 ms | własny #1 | 5× | **750 ms** |
| D3a Valuation DCF | 202,0 ms | cytowany n=12 | 5× | **1050 ms** |
| D3b Sensitivity grid | 81,3 ms | cytowany n=20 | 5× | **450 ms** |
| D3 razem | 215,5 ms | cytowany n=12 | 5× | **1100 ms** |

Dla porównania: stary, niewyprowadzony sanity ceiling był **płaski 30 000 ms dla każdej ścieżki** — regresja 100× (np. D2 z 140 ms do 14 s) go nie złapie, a nowy próg (750 ms) złapałby ją natychmiast (14 000 > 750). Jednocześnie żaden z ośmiu zmierzonych p95 (4 ścieżki × 2 własne przebiegi, plus 4×2 cytowane) nie zbliża się do nowego progu — margines jest realny, nie kosmetyczny.

**To są progi REGRESYJNE dla CI — jawnie NIE produkcyjny SLO.** Różnica jest fundamentalna: próg regresyjny pyta „czy ten kod jest dramatycznie wolniejszy niż był", SLO produkcyjny pyta „czy klient dostaje odpowiedź w budżecie czasu, na który firma się umówiła". Pierwsze pytanie da się dziś uczciwie postawić (mam dwa niezależne pomiary tego samego kodu). Drugie — nie (mam dwa niezależne pomiary, które różnią się 9,3×, na maszynie, która nie jest reprezentatywna dla produkcji).

---

## 5. Dlaczego p99 przy tym n jest bezwartościowe

Metoda nearest-rank: `rank(p) = ceil(p/100 × n)`. Dla p99 przy n=20: `ceil(0,99 × 20) = ceil(19,8) = 20` — **czyli p99 = max próbki**, dokładnie ten sam problem degeneracji, który W9 opisało dla p95 przy n=12 (`ceil(0,95×12)=12`). Nawet przy n=100 (nierealistyczne dla testu integracyjnego na realnej bazie — pojedynczy przebieg D1 przy n=20 już trwa >30 s) p99 potrzebowałby **co najmniej** kilkuset niezależnych próbek, żeby przestać być statystycznym szumem opartym na jednej-dwóch najwolniejszych obserwacji z próbki. Deklarowanie liczbowego p99 dziś oznaczałoby podanie wartości `max()` przebrandowanej jako "p99" — dokładnie ten rodzaj zaokrąglenia w górę, przed którym ostrzega ten program. **p99 pozostaje `EVIDENCE_MISSING` z przyczyn metodologicznych, niezależnie od stabilności maszyny.**

---

## 6. Trzy odwrócone/rozdzielone asercje — przed i po

Plik: `server/src/services/finance/canonical/__tests__/perfSlo.pg.test.ts`.

Stary, pojedynczy test `EVIDENCE_MISSING: no numeric compute SLO is declared anywhere in the program` miał trzy asercje. Rozdzielony na dwa testy: nowy pozytywny (`W2 (inverted #1-3)`) + zachowany `EVIDENCE_MISSING` (przeskalowany na "produkcyjny SLO w schemacie").

| # | Asercja | PRZED (W9) | PO (W2) |
| --- | --- | --- | --- |
| 1 | `sloTables` = tylko `observability_slos` | Twierdziła: „w całym schemacie nie ma dedykowanej tabeli latencji/budżetu — jedyna tabela SLO to konstrukt dostępnościowy". | **Wartość NIEZMIENIONA** (świadoma decyzja schematu, §8) — ale zakres testu jest teraz jawnie „SLO PRODUKCYJNY w schemacie", nie „SLO nigdzie". Nowy test obok dowodzi, że w KODZIE progi już istnieją (`Object.values(PERF_REGRESSION_THRESHOLDS)` ma dokładnie 5 wpisów) — to jest literalna inwersja starego globalnego twierdzenia „nic nigdzie nie jest zadeklarowane". |
| 2 | `latencyColumns` na `observability_slos` = `[]` | Twierdziła: „nie istnieje żaden numeryczny kształt (ms/p50/p95/p99), w którym można by trzymać próg". | **Wartość NIEZMIENIONA w bazie** — ale nowy test dowodzi, że numeryczny kształt TERAZ istnieje: każdy z 5 wpisów `PERF_REGRESSION_THRESHOLDS` ma `ceilingMs > 0` i `observedMaxP95Ms > 0`. Kształt istnieje — tylko w kodzie, nie w tej tabeli (decyzja §8). |
| 3 | `declaredRows` w `observability_slos` = `0` | Twierdziła: „zero zadeklarowanych wierszy SLO jakiegokolwiek rodzaju". | **Wartość NIEZMIENIONA** dla `observability_slos` (nadal 0 — brak uczciwych danych produkcyjnych do wpisania, §8) — ale nowy test dowodzi, że wszystkie 5 progów regresyjnych jest istotnie ciaśniejszych niż stary płaski sanity ceiling (`ceilingMs < 30 000` dla każdego) — to jest miara „ile realnie zadeklarowano", zastępująca „zero wierszy" jako jedyny dowód. |

**Uczciwość tego rozdzielenia:** dwie z trzech surowych wartości w bazie (`sloTables`, `latencyColumns`, `declaredRows`) pozostają dosłownie te same co w W9 — to jest **zamierzone**, nie niedopatrzenie: decyzja w §8 mówi wprost, że NIE rozszerzam `observability_slos`. Odwróceniu ulega nie liczba w bazie, tylko **globalne twierdzenie testu** — z „SLO nie jest zadeklarowany NIGDZIE" (fałszywe od tego commita) na „SLO regresyjny jest zadeklarowany w kodzie; SLO produkcyjny w schemacie — nadal nie" (prawdziwe i precyzyjne).

---

## 7. Kontrola negatywna — w obie strony

Mechanizm: `W2_PERF_NEGATIVE_CONTROL_PATH` / `W2_PERF_NEGATIVE_CONTROL_INJECT_MS` — opóźnienie wstrzykiwane **wewnątrz mierzonego okna w `perfSlo.pg.test.ts`** (plik, który jest moją własnością), nigdy w `kpiComputeService.ts` ani innym z czterech serwisów compute (te należą do innej, równoległej pracy — patrz §10 punkty kolizji). Ścieżka testowa: D2 (najszybsza, próg 750 ms), n=8 dla szybkości diagnostyki.

| Krok | Wstrzyknięcie | p95 zmierzone | Próg | Wynik |
| --- | --- | --- | --- | --- |
| 1. Spowolnij | +900 ms | 1132,72 ms | 750 ms | **CZERWONY** — `expected 1132.72 to be less than 750`, z pełnym komunikatem pokazującym podstawę progu |
| 2. Cofnij | brak (0 ms) | 356,55 ms | 750 ms | **ZIELONY** (nawet przy p95 na poziomie 47 % progu z samego szumu maszyny) |
| 3a. Ile trzeba (dół) | +400 ms | 564,12 ms | 750 ms | zielony (75 % progu) |
| 3b. Ile trzeba (blisko) | +550 ms | 735,73 ms | 750 ms | zielony (98 % progu — bardzo blisko) |
| 3c. Ile trzeba (blisko) | +600 ms | 711,91 ms | 750 ms | zielony |
| 3d. Ile trzeba (zapłon) | +650 ms | 969,69 ms | 750 ms | **czerwony** |

**Wniosek kontroli odwrotności:** granica zapłonu leży między +600 ms a +650 ms wstrzykniętego opóźnienia — to **~4,3–4,6×** wartości `observedMaxP95Ms` (140,23 ms) użytej do zbudowania progu, czyli w okolicach samego zaprojektowanego mnożnika (5×). Próg **nie wymaga** spowolnienia 10-krotnego, żeby zareagować — brief wprost ostrzegał, że taki próg byłby bezużyteczny; ten nim nie jest. Jednocześnie zwykły szum maszyny (356,55 ms na tym samym n=8, bez żadnego wstrzyknięcia) zostaje bezpiecznie pod progiem.

Surowe logi kontroli: `w2_fc11_slo_evidence/negative_control_D2.txt`.

Bramka DB (skipped bez `RUN_DB_TESTS`/`MOCK_DB`/`DATABASE_URL`): nie zmieniona w tym pliku (`describe.skipIf(!REAL_PG)` — mechanizm dziedziczony z W9, niezmieniony), więc nadal `skipped`, nigdy `passed` bez trzech zmiennych.

---

## 8. Decyzja: `observability_slos` NIE jest rozszerzana

**Decyzja: NIE.** Ani rozszerzenie `observability_slos` o kolumny latencji, ani nowa dedykowana tabela SLO latencji nie powstają w tej pracy. Żadna migracja nie jest dodawana.

**Uzasadnienie:**

1. **`observability_slos` ma niewłaściwy kształt dla percentyli latencji.** Kolumny `target_percentage`/`window_days`/`budget_remaining` (`server/migrations/20260719_baseline_gap.sql:6655`) modelują budżet dostępności typu "99,9 % przez 30 dni" — SLO percentylowe latencji (p50/p95/p99 w ms, per ścieżka compute) to inny kształt danych. Wciśnięcie ich do tych samych kolumn (np. `target_percentage` jako "procent requestów pod p95") byłoby naciąganiem znaczenia kolumny, nie modelowaniem.
2. **Nie ma uczciwej wartości do wpisania.** Migracja addytywna bez wiersza produkcyjnego SLO byłaby dokładnie tym wzorcem, który ten program już wielokrotnie oznaczył jako fałszywy sygnał ukończenia — schemat istnieje, adopcja zero. (Ten sam raport W9 flagował `observability_slos` jako pustą — 0 wierszy — właśnie z tego powodu; dodanie kolumn bez wierszy powtarza ten wzorzec jeden poziom niżej.)
3. **Próg regresyjny CI to inny byt niż SLO produkcyjny.** Próg regresyjny jest sprawdzany **przy buildzie** (CI), nie w runtime — nie potrzebuje wiersza w bazie produkcyjnej, żeby zawalić build. Żyje poprawnie w kodzie (`perfSloThresholds.ts`), obok testu, który go egzekwuje — audytowalny w code review, wersjonowany razem z kodem, którego dotyczy.
4. **Gdy pojawi się uczciwie zmierzony SLO produkcyjny** (stabilny runner CI, wiele dni pomiaru, brak współbieżnego obciążenia maszyny innymi agentami), rekomendacja jest: **nowa, dedykowana tabela** (np. `observability_latency_slos` z kolumnami `path`, `p50_ms`, `p95_ms`, `p99_ms`, `measured_on`, `sample_size`) — **nie** mieszanie z `observability_slos`, z tych samych powodów kształtu co w punkcie 1. To jest praca poza dzisiejszym zakresem — `EVIDENCE_MISSING`, nie zaprojektowana tutaj poza tą rekomendacją.

Ta decyzja jest odwracalna i tania: gdyby ktoś się nie zgodził, dodanie migracji addytywnej później nic nie kosztuje. Dodanie jej teraz, z pustymi/naciąganymi danymi, kosztowałoby więcej — kolejny artefakt do audytowania i tłumaczenia.

---

## 9. Inwentaryzacja 10 warunków FC-11

**Metodologiczna uwaga o pochodzeniu tej listy.** W repozytorium **nie znalazłam** jednego kanonicznego pliku z dosłownie ponumerowanymi „10 warunkami FC-11". `FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` §FC-11 wymienia 4 punkty-parasole (`declared SLO p50/p95/p99`; `load, fault, retry, concurrency i queue tests`; `dashboards, alerts i runbooks`; `export/import/compute nie blokują UI`). Poniższa lista **rozwija** te 4 punkty do 10 sprawdzalnych warunków, krzyżując je z listą `EVIDENCE_MISSING` EM-1…EM-9 z W9 (`W9_FAULT_CONCURRENCY_TENANT_MATRIX_report.md` §7). To rekonstrukcja robocza, nie cytat — oznaczona jako taka.

| # | Warunek | Werdykt PRZED (W9) | Werdykt PO (W2, ta praca) | Kto to zamyka |
| --- | --- | --- | --- | --- |
| 1 | Zadeklarowany SLO **p50** (produkcyjny) | `EVIDENCE_MISSING` | `EVIDENCE_MISSING` — świadomie, uzasadnienie §0/§3 (różnica 9,3× między własnymi przebiegami) | nie zamknięte (celowo) |
| 2 | Zadeklarowany SLO **p95** (produkcyjny) | `EVIDENCE_MISSING` | `EVIDENCE_MISSING` (produkcyjny) — ale **próg regresyjny p95 dla CI istnieje** (nowy, węższy byt, §4) | częściowo — tylko wymiar CI |
| 3 | Zadeklarowany SLO **p99** (produkcyjny) | `EVIDENCE_MISSING` | `EVIDENCE_MISSING` — **z dodatkowym powodem metodologicznym** (degeneracja nearest-rank przy n=20, §5), nie tylko brakiem stabilnej maszyny | nie zamknięte (celowo, podwójnie uzasadnione) |
| 4 | Testy **load** (współbieżne obciążenie wielu żądań, nie seryjne powtórzenia) | nie badane | **nie badane** — ta praca mierzy seryjne, pojedyncze wywołania jednego tenanta, nie równoległy ruch produkcyjny | poza zakresem tej pracy |
| 5 | Testy **fault injection** | `PASS` (W9 część B) | bez zmian (nie w moim zakresie) | już zamknięte przez W9 |
| 6 | Testy **retry** | `PASS` (W9 B-extra, DLQ) | bez zmian | już zamknięte przez W9 |
| 7 | Testy **concurrency** | `PASS` (W9 część A) | bez zmian | już zamknięte przez W9 |
| 8 | **Queue** — pełny cykl życia (reaper EM-1, heartbeat EM-2, kill switch EM-3, limit współbieżności EM-4, pętla workera EM-5) | `EVIDENCE_MISSING`/brak (5 luk) | bez zmian — **jawnie poza zakresem tej pracy** (te elementy dotyczą `computeJobService.ts`, własność innej, równoległej pracy) | nie zamknięte, nie moje |
| 9 | **Dashboardy, alerty, runbooki** (EM-8) | `EVIDENCE_MISSING` | bez zmian — **jawnie poza zakresem** (brief: „EM-8 jest poza twoim zakresem — nie udawaj, że go zamykasz") | nie zamknięte, nie moje |
| 10 | `export/import/compute` **nie blokują UI** | nie badane | nie badane — ta praca mierzy tylko czas serwisu backendowego, nie zachowanie UI podczas oczekiwania | poza zakresem tej pracy |

**Zliczenie:** 0/10 `PASS` w sensie „w pełni zamknięte przez tę pracę" pozostaje trafne — bo warunki 5-7 były już zamknięte PRZED (nie przeze mnie), a żaden z pozostałych siedmiu nie przechodzi w pełny `PASS` w tej pracy. Ale **jakość `EVIDENCE_MISSING` się zmieniła** dla warunków 1-3: zamiast „nic nie sprawdzone, nic nie zadeklarowane", mamy teraz „sprawdzone dwa razy niezależnie, świadomie i uzasadnione odmówione, z gotowym zamiennikiem dla CI". To jest różnica między pustą bramką a bramką z udokumentowanym, przetestowanym powodem, dla którego pozostaje pusta w połowie produkcyjnej.

---

## 10. Punkty kolizji i higiena

- **Nie dotknięte:** `computeJobService.ts`, `baselineComputeService.ts`, `kpiComputeService.ts`, `valuationComputeService.ts`, `valuationSensitivityService.ts` — własność innej, równoległej pracy. Kontrola negatywna (§7) wstrzykuje opóźnienie **wyłącznie** wewnątrz `perfSlo.pg.test.ts`, dokładnie żeby tego uniknąć.
- **Zaobserwowana, nie naprawiana:** awaria `coldReopen.pg.test.ts` (`SensitivityGridAccessError` w `valuationSensitivityService.ts:190`) — identyczna PRZED i PO tą pracą, poza zakresem, zgłoszona w §2.
- **Nowe pliki:** `perfSloThresholds.ts` (dodany przeze mnie), evidence w `docs/validation/finance-v3/generated/gate-d/w2_fc11_slo_evidence/` (dodane `git add -f`, zgodnie z zasadą dla nowych plików w `tests/`/evidence).
- Zero push, zero merge, zero dotknięcia `codex/finance-v3-closeout-fanin`.

---

## 11. Progi odbioru — checklist

| Wymóg | Status |
| --- | --- |
| Migracje STRICT exit 0 | ✅ (§1) |
| `finance/canonical` zielone, bez regresji, obie liczby podane | ✅ (§2) — 30 passed/1 failed PRZED i PO, identyczna pre-istniejąca awaria, +1 test |
| `tsc -p server` exit 0 | ✅ |
| Min. 2 własne przebiegi n=20, surowe dane | ✅ (§3, JSONL w evidence) |
| Kontrola negatywna w obie strony | ✅ (§7) — czerwony przy +900ms, zielony po cofnięciu, granica zapłonu +600–650ms (nie 10×) |
| Progi uzasadnione liczbowo, nie „wydaje się rozsądne" | ✅ (§4) |
| p99 przy tym n — wyjaśnione dlaczego bezwartościowe | ✅ (§5) |
| Decyzja `observability_slos` z uzasadnieniem | ✅ (§8) — NIE rozszerzać |
| Trzy odwrócone asercje, przed→po | ✅ (§6) |
| Inwentaryzacja 7 `EVIDENCE_MISSING` / 10 warunków FC-11 | ✅ (§9) |

**Rekomendacja dla bramki FC-11:** pozostaje częściowo `EVIDENCE_MISSING` (warunki 1, 3, 4, 8, 9, 10 — produkcyjny SLO, load testy, queue lifecycle, dashboardy/alerty/runbooki, UI non-blocking) — ale **nie jest już pustą deklaracją**: ma teraz dwa niezależne, udokumentowane pomiary, jawnie uzasadnioną odmowę deklaracji produkcyjnej, i w pełni działający, przetestowany negatywnie mechanizm regresji CI dla trzech ścieżek compute. Następny krok, jeśli program chce zamknąć warunki 1-2 produkcyjnie: powtórzyć ten pomiar (te same trzy ścieżki, ten sam fixture) na dedykowanym, niedzielonym runnerze CI, przez co najmniej kilka dni, zanim jakakolwiek liczba trafi do `observability_slos`-następcy opisanego w §8.
