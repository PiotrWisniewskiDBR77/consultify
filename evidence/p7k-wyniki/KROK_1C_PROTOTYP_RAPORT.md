---
doc_id: p7k-krok1c-prototyp-raport
status: evidence
truth_type: measurement
established: 2026-09-05
autor: robotnik frontendu (korekta 1c)
galaz: cto/p7k-1c (baza codex/p7k-wyniki + scalone codex/p2-tabela)
---

# P7K KROK 1c — raport z korekty prototypu Wyników

Podstawa: `docs/program/PROGRAM_NAPRAWCZY_20260905/P7K_KROK1_WERDYKT_20260905.md`,
sekcja „Werdykt 1b” (K10–K13) + „Pomiar 1c”.
Scalenie `codex/p2-tabela` do `cto/p7k-1c`: **bez konfliktów** (2 pliki, 258 wstawek).

## Tabela korekt

| # | Zrobione | Jak | Dowód |
|---|---|---|---|
| **K10** KPI L2 — przypięte kolumny nachodzą na przewijane | TAK | Trzy niezależne przyczyny, wszystkie usunięte: **(a)** offsety `right` były wpisane na sztywno (STAN 44 px, YTD 234 px) i zakładały kolumnę akcji 44 px oraz YTD/STAN po 190 px — realnie akcje mają 80 px (`ROW_ACTIONS_COLUMN_WIDTH`), a `columnFit` schodził do 139 px; teraz `useEffect` liczy offsety z `getBoundingClientRect()` po renderze. **(b)** przypięte komórki bywały przezroczyste — `thead` dostał nieprzezroczyste tło tokenem (`bg-c-surface-raised`, bez `backdrop-blur`), komórki danych `bg-c-surface`, wiersz grupy `--c-surface-raised` ustawiane wprost w JS. **(c)** GEOMETRIA: MIERNIK = 324 px dobrane tak, że obszar przewijany = 1374 − 324 − 350 (YTD 140 + STAN 130 + akcje 80) = **700 px = dokładnie 5 kolumn po 140 px** — bez tego jeden koniec przewijania zawsze wypadał w połowie miesiąca („GRU 202”, ogon „…2026” pod MIERNIK). Pill „Krytyczne”/„Ostrzeżenie” w całości widoczny. | `prototype/kpi-l2--light.png`, `kpi-l2-start--light.png` (+ `--dark`); w `.json`: `kolumnyRozjazd.rozjechane = 0`, `przezroczysteSticky = 0` |
| **K11** OKR L2 — tekst wchodzi na sąsiednią kolumnę | TAK | Przyczyna była w `col()` prototypu: renderował KAŻDĄ wartość jako `<span whitespace-nowrap>` bez `overflow`, czyli sam wyłączał warstwę `CELL_TEXT_CLAMP_CLASS` + `OverflowTooltip` z `FilterableTable`. Teraz: jedna linia + `truncate` domyślnie, `line-clamp-2` dla treści opisowych, pełna treść zawsze w `title`. KLUCZOWY REZULTAT = 270 px z pomiaru, ZESPÓŁ i OSTATNI CHECK-IN schowane domyślnie w pstryczku kolumn (ten sam zabieg, którym K4/K7 rozwiązały ten konflikt w ROI L1 i KPI L3). | `prototype/okr-l2--light.png`; `wyciekiTekstu = 0` |
| **K12** ROI L1 — NAZWA wchodzi na PRZEDMIOT | TAK | Zdjęte `[&_td]:whitespace-nowrap` (to ono trzymało treść w jednej linii BEZ przycięcia). NAZWA i WARIANT zawijają do 2 linii (opcja dopuszczona w K12), pozostałe kolumny mają szerokość z pomiaru treści; `dataType` obniża podłogi kolumn liczbowych/statusowych, dzięki czemu dziewięć kolumn mieści się w 1374 px bez skalowania. | `prototype/roi-l1--light.png`; `wyciekiTekstu = 0` |
| **K13** KPI L3 — daty, nazwiska, miesiące ucinane; nagłówki łamane w środku słowa | TAK | Zdjęty `[&_th_span]:break-all` (to on robił „OSIĄGNI ĘTY”, „ODPOWIEDZIA LNY”); nagłówki łamią się wyłącznie na spacji (`break-normal` + `hyphens-none`). Szerokości z pomiaru: MIESIĄC 124 („Sierpień 2026” = 91 px + `px-4`×2), ODPOWIEDZIALNY 144, TERMIN 110, STATUS 106 (pill „OTWARTY” = 73 px). Opisy zawijane do 2 linii z pełną treścią w `title`. Karta poszerzona (nawigacja 150, prawy panel 270, tabela `-mx-4`), żeby siedem kolumn zmieściło się bez ścisku. | `prototype/kpi-l3--light.png`; brak „Sierpień 2026”/„Tomasz Nowak”/„18.09.2026” na liście ucięć |

## Pomiar (18 zrzutów 1440, jasny + ciemny)

| zrzut | nakladania | wyciekiTekstu | uciete | bledyKonsoli | aside | przezroczysteSticky |
|---|---|---|---|---|---|---|
| kpi-l1 · kpi-l2 · kpi-l2-start · okr-l1 · okr-l2 · roi-l1 (jasny+ciemny) | 0 | 0 | 0 | 0 | 0 | 0 |
| kpi-l3 · okr-l3 · roi-l2 (jasny+ciemny) | 0 | 0 | 0 | 0 | 1 | 0 |

Pozostałe bramki:
- `grep -c -E "text-c-accent|bg-c-accent|primary-"` → **0**; `StandardModuleBar` → **2**; `ArtifactRightPanel` → **5**.
- Luma pary jasny/ciemny: 224,2 – 230,0 (próg ≥ 100) dla wszystkich dziewięciu widoków.
- `esbuild` prototypu: exit **0**.
- `npx vitest run src/components/shared/ModuleHub/__tests__`: **39/39 zielone**.
- `bash scripts/check-list-canon.sh`: **przechodzi**, dług 361 vs baseline 364 (spadł o 3, baseline NIE aktualizowany — to decyzja nadzorcy).

## Naprawa w mechanice wspólnej (SSOT)

`src/components/shared/ModuleHub/FilterableTable.tsx` — **błąd o jeden w budżecie odstępów liter**:
podłoga nagłówka liczyła `Math.max(0, label.length - 1) * HEADER_TRACKING_PX`, a CSS `letter-spacing`
dokłada odstęp także PO ostatnim znaku. Podłoga wychodziła o ~0,5–1 px za mała i nagłówek dostawał
wielokropek mimo „zmieszczonej” kolumny — zmierzone na KPI L2: „BENCHMARK” w kolumnie 109 px
renderowało się jako „BENCHMA…”. Poprawka: `label.length * HEADER_TRACKING_PX`.
Test: `FilterableTable.columnWidth.test.tsx` → „budzet odstepow liter obejmuje znak ostatni”.
**Dowód mutacyjny wykonany, nie założony**: przywrócenie `- 1` daje 138 zamiast 139 i test pada
(`AssertionError: expected 138 to be 139`). Pierwsza wersja tego testu przechodziła TAKŻE po mutacji
(zaokrąglenie zjadało różnicę) — została przepisana.

## Zmiany w skrypcie zrzutowym i uczciwość pomiaru

`scripts/dev/p7k-prototype-capture.mjs` liczy teraz `nakladania`, `wyciekiTekstu`, `uciete`,
`ucieteLacznie`, `przezroczysteSticky`, `kolumnyRozjazd` oraz robi dodatkowy zrzut
`kpi-l2-start--*` (STY 2026). Przy budowie przyrządu wyszły **trzy sposoby, na które kłamał**:

1. `Range.getClientRects()` nie wie o przycięciu — tekst w `truncate` ma prostokąt poza komórką,
   choć na ekranie nic nie wylewa się na sąsiada. Poprawka: pomijamy tekst, który ma przodka
   przycinającego. Bez tego metryka meldowała wycieki tam, gdzie ich nie było.
2. Każdy `th` poza ostatnim ma absolutnie pozycjonowany uchwyt zmiany szerokości
   (`ColumnResizeHandle`), który dokłada 6 px do `scrollWidth` — pomiar meldował „ucięty nagłówek”
   na KAŻDEJ tabeli, także idealnie zmieszczonej. Poprawka: mierzymy tylko elementy-liście.
3. `scrollWidth > clientWidth` **nie wykrywa** ucięcia zrobionego przez `text-overflow: ellipsis` —
   przeglądarka raportuje szerokość już przyciętą. To jest dziura, przez którą pomiar 1b meldował
   zero, a nagłówki na zrzucie były ucięte. Poprawka: naturalna szerokość tekstu liczona na canvasie
   (font + `letter-spacing` z `getComputedStyle`) porównana z `clientWidth`.

**Dowód mutacyjny przyrządu** (przywrócony po sprawdzeniu): przywrócenie `whitespace-nowrap`
w `col()` → `wyciekiTekstu` skacze z 0 na 2 w okr-l2, roi-l1 i kpi-l3; zwężenie MIESIĄC do 95 px →
„Sierpień 2026” wraca na listę ucięć (naturalna 91, `clientWidth` 66). Bez tego wszystkie zera
w tabeli wyżej byłyby bezwartościowe.

## Granica dowodu — czego ten raport NIE dowodzi

1. **Miara `nakladania` z werdyktu jest z zasady pusta dla tych ekranów.** Prostokąty `td` w tabeli
   nigdy się nie nachodzą (to robi silnik układu), więc `right_i > left_{i+1}` nie wykryłoby ANI
   K11, ANI K12 — one były wyciekiem TEKSTU poza własną komórkę. Dlatego dołożyłem
   `wyciekiTekstu` i to ona jest tu realną bramką; `nakladania` raportuję, bo tak brzmi werdykt.
   Komórki `position: sticky` są z niej wyłączone — przykrywanie przewijanej treści to ich zadanie.
2. **`uciete = 0` nie znaczy „nic nie jest przycięte”.** Znaczy „nic nie jest przycięte BEZ dymka”.
   Osobne pole `ucieteLacznie` pokazuje wszystkie przycięcia, także z `title`: zostają tylko treści
   opisowe zawijane do 2 linii (OKR L2, ROI L1, KPI L3) — czyli dokładnie to, czego wymaga K11–K13.
   Daty, nazwiska i miesiące nie występują tam ani razu.
3. **Geometria KPI L2 jest dobrana pod 1440 px.** Równanie 324 + 700 + 350 = 1374 trzyma się na tej
   szerokości; przy innej obszar przewijany przestaje być całkowitą wielokrotnością 140 px i jeden
   koniec przewijania znów wypadnie w połowie miesiąca. Prototyp jest do odbioru na 1440 — to nie
   jest rozwiązanie produkcyjne i nie wolno go tak przenieść do modułu.
4. **Odkrycie o mechanice wspólnej, nierozwiązane:** `effectiveMinTableWidth = min(minTableWidth, szerokość kontenera)`
   powoduje, że tabela szersza niż obszar ZAWSZE ląduje w gałęzi „nawet podłogi się nie mieszczą”
   i każda kolumna dostaje swoją PODŁOGĘ — **zadeklarowana szerokość jest wtedy ignorowana**
   (poza kolumną pierwotną). Dla KPI L2 znaczy to, że jedyną dźwignią szerokości miesiąca jest
   `dataType` (podłoga `text` = 140 px). Treść musiała się zmieścić w 108 px, więc etykiety
   „CEL” i „Rezultat” są 10-punktowe, a duża zostaje sama wartość. Jeśli właściciel zechce
   szersze miesiące, trzeba zmienić SSOT (np. jawne `minWidth` w `TableColumn`) — tego NIE zrobiłem,
   bo to zmiana kontraktu dotykająca wszystkich list.
5. **Zmieniłem dwie etykiety nagłówków bez pytania** (właściciel nieobecny):
   `STAN · norma / ostrz. / kryt. / brak` → `STAN · N / O / K / B` (KPI L1) i analogicznie w OKR L1.
   Powód mierzalny: podłoga tego nagłówka to 268 px, sama wypychała tabelę poza obszar i chowała
   ostatnią kolumnę pod przypiętą kolumną akcji („AKTUALIZACJA” → „AKTU…”, „05.09.2026” → „05.0”).
   Do cofnięcia jednym słowem, jeśli nadzorca uzna legendę za ważniejszą niż pełna data.
6. **Nie sprawdzałem prototypu klikaniem** — to zrzuty statyczne. Przewijanie poziome KPI L2 jest
   ustawiane programowo w `useEffect`; zachowanie przy ręcznym przewijaniu (poza synchronizacją
   wiersza grupy, która ma nasłuch `scroll`) nie zostało zmierzone.

**STOP do akceptu nadzorcy. KROK 2 nadal zakazany.**
