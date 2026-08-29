# CODEX DAY 78 — pomiar jakości grafiki generatora PPT

Data pomiaru: 2026-08-29  
Marker: `30db1565756300a0819509227642e53fd68327ee`  
Gałąź robocza: `codex/day78-ppt-rubric-20260829`  
Zakres: wyłącznie pomiar; **ZERO NAPRAW**.

## Werdykt

**3 z 3 decków: DO POPRAWY.** Żaden nie przechodzi bramki graficznej `≥80%` oraz „żaden wymiar G = 0”. Wyniki graficzne: FINAL `7 z 18`, PERFEKCJA-W7 `7 z 18`, BATTERY `7 z 18`; próg wynosi `15 z 18` po zaokrągleniu w górę.

Najsilniejszy wspólny wynik liczbowy: wszystkie trzy pliki używają tekstu body/caption poniżej minimum decku projekcyjnego `24 pt`; odczyt struktury wykazał minima `6.5 pt`, body zwykle `10–13 pt`. W każdym decku G4 = `0`.

**Head-to-head NIEWYKONANY, powód: brak referencji wytworzonej z tego samego golden-promptu.** Repo zawiera `2026-06-25-GAMMA-AI-readiness-HEADTOHEAD.pptx`, ale nie ma dowodu, że jest wynikiem tego samego wejścia co którykolwiek z trzech mierzonych decków. Do wykonania potrzeba: dokładnego golden-promptu i paczki źródłowej użytej dla wybranego decku, wyniku Gamma z tego samego wejścia oraz zatwierdzenia, że oba eksporty oceniamy w tym samym trybie (PowerPoint lub ten sam renderer).

## §0.1 — baza, marker i sanity (wyniki dosłowne)

Wolne miejsce:

```text
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    88Gi    12%    459k  923M    0%   /
```

Komenda (2):

```text
37c6963032 docs(instrukcje): dyzur 77 (petla szablon->dokument) i 78 (pomiar rubryki PPT)
30db156575 docs(ledger): DEC-294..298 — EV UJEMNE dla CD Projekt, 4 seedery, Materialy 8/8 defektow, klasa A 418/418
c638b3dba4 merge: dyzur 76 — Materialy 20/20, 8/8 defektow nadal wystepuje
f926fa4455 merge: dyzur 75 — 4/4 seedery, max 2 linie na plik
fb0ad6c6f5 merge: dyzur 74 — DOWOD MERYTORYCZNY: liczby z wnetrz, EV ujemne
d502af3094 merge: dyzur 69 checkpoint — klasa A 418/418, klasa F 57/57
3d2cb04d79 docs(day76): record Materials owner evidence matrix
98bf02b2aa docs(day75): report migration counter repair
019a68a00d fix(i18n): domknij klucze obszarow C1
cdf73ad82e fix(assessment): retain migration floor
4bad64f3cd fix(initiatives): retain migration floor
a155dcc732 docs(finance): add day74 material proof
1e73b81a8f fix(my-work): accept current migration ledger
d222a05e68 fix(assessment): report current migration ledger
c89ef169cf fix(initiatives): report current migration ledger
56329a32ca fix(organization): accept current migration ledger
d0d08b3e5a docs(instrukcje): dyzur 76 Materialy — macierz 20/20 + rozstrzygniecie 8 znanych defektow
8d254e6bae docs(instrukcje): dyzur 74 (Finanse — dowod merytoryczny) i 75 (naprawa licznikow migracji)
b4c883b9ec docs(ledger): DEC-292/293 odbior dyzuru 73 — uczciwe 16/20, modul pokazuje realna wartosc
48fe3a11c7 merge: dyzur 73 Wykonanie — uczciwe 16/20, cztery warianty nieosiagalne
e53d85f642 docs(day73): resume execution owner evidence after correction
53f22ac43c docs: DEC-288..291 uwaga wlasciciela o tabeli zewnetrznej, silnik POLICZYL CD Projekt, odbior 72, naprawa 0.4a
b9036590db merge: dyzur 72 Wyniki — 20/20 zrzutow, modul mial zero dowodow
558a3437e2 docs(ledger): DEC-287 checkpoint 69 — 3/3 formattery pl-PL, finance 207->131
094f021c1a merge: dyzur 69 checkpoint — 3/3 formattery pl-PL, finance 207->131
MARKER OK
```

Komenda (7):

```text
30db1565756300a0819509227642e53fd68327ee
```

`git status --short | head -3` nie wypisał żadnej linii.

Tip gałęzi bazowej uciekł o jeden commit do przodu, co zgodnie z §0.1 nie jest STOP-em:

```text
37c6963032 docs(instrukcje): dyzur 77 (petla szablon->dokument) i 78 (pomiar rubryki PPT)
```

Różnica nazw plików marker..tip:

```text
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_77_PETLA_SZABLONOW.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_78_PPT_RUBRYKA.md
```

Stan wejściowy: rubryki `2 z 2` obecne; LibreOffice `26.2.4.2 0229ac93fcf0d7cbc6376066c6f35021cef002dc`; porty `5950` i `4720` wolne.

## BLOK 0 i Z30

Kontener: `cx-day78-pg`, obraz `pgvector/pgvector:pg16`, host wyłącznie `127.0.0.1:5950`, baza `cx_day78`. Pierwszy przebieg migratora zakończył się `✅ Postgres migrations complete`; drugi przebieg: `Applying migrations: 0` i `✅ Postgres migrations complete`. Niezależny odczyt: tabela `schema_migrations` zawiera `863` wiersze. Próba nazwy `migrations` zwróciła uczciwy błąd `relation "migrations" does not exist`; realna tabela na markerze to `schema_migrations`.

Dowody Z30:

```text
BRAK ZMIENNYCH POCZTY
 key | left
-----+------
(0 rows)
```

Grep `startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron` w `server/src/Gateway.ts` zwrócił `0` trafień.

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

## Metoda i pułapki dowodowe

Każdy deck został oceniony dwutorowo:

1. rendering LibreOffice do PDF i PNG — dowodzi wyglądu w tym rendererze;
2. odczyt OOXML przez `python-pptx 1.0.2` — dowodzi współrzędnych, rozmiarów pól, tekstu i fontów zapisanych w pliku.

Pułapki Z33 (a)–(d) nie dotyczą tego pomiaru: nie uruchamiano tras, auth, Vitest ani pakietów DB jako dowodu jakości. Pułapka (e) dotyczy każdego wyniku wizualnego. Dlatego defekty opieram na renderingu i — gdzie możliwe — potwierdzam strukturą. Nie twierdzę, że rendering LibreOffice jest wierny PowerPointowi.

## B.1 — pełna rubryka: `3 z 3`

Skala każdego wymiaru: `0/1/2`. Mianowniki: K `18`, M `10`, G `18`.

### 1. `2026-06-28-DECK-FINAL.pptx`

| Oś | Punkty | Wymiar po wymiarze |
| --- | ---: | --- |
| K | **13 z 18 (72.2%) — FAIL** | K1 2; K2 0; K3 2; K4 2; K5 2; K6 2; K7 2; K8 1; K9 0 |
| M | **8 z 10 (80.0%) — PASS progowy** | M1 1; M2 1; M3 2; M4 2; M5 2 |
| G | **7 z 18 (38.9%) — FAIL** | G1 2; G2 1; G3 1; G4 0; G5 2; G6 0; G7 0; G8 1; G9 0 |

Wymiary `0`: K2 agenda/struktura; K9 brak ucięć; G4 hierarchia typografii; G6 grafiki; G7 czytelność wykresów; G9 wykończenie. Krytyczne G równe `0`: **4 z 9**.

Uzasadnienie skrócone: deck ma logiczną narrację i dane, lecz nie ma agendy; render ma tytuły wychodzące poza pasek, pionowo łamaną etykietę, nieczytelne oznaczenia trendów i podwójną numerację. Struktura pokazuje rozmiary `6.5–54 pt`, w tym body `11–13 pt`, zamiast floor `24 pt`. Brak obrazów/pictures w strukturze całego pliku.

### 2. `2026-06-28-DECK-PERFEKCJA-W7.pptx`

| Oś | Punkty | Wymiar po wymiarze |
| --- | ---: | --- |
| K | **13 z 18 (72.2%) — FAIL** | K1 2; K2 0; K3 2; K4 2; K5 2; K6 2; K7 2; K8 1; K9 0 |
| M | **9 z 10 (90.0%) — PASS** | M1 1; M2 2; M3 2; M4 2; M5 2 |
| G | **7 z 18 (38.9%) — FAIL** | G1 2; G2 1; G3 1; G4 0; G5 2; G6 0; G7 0; G8 1; G9 0 |

Wymiary `0`: K2 agenda/struktura; K9 brak ucięć; G4 hierarchia typografii; G6 grafiki; G7 czytelność wykresów; G9 wykończenie. Krytyczne G równe `0`: **4 z 9**.

W7 lokalizuje baner problemu na slajdzie 7, ale nie usuwa wspólnych defektów grafiki. Struktura ma te same minima fontów (`6.5 pt`) i ten sam zestaw geometrii krytycznej co FINAL. Brak obrazów/pictures w całym pliku.

### 3. `2026-06-28-BATTERY-Model-inwestycyjny-AI-AI_Platform_Solutions-prezentacja.pptx`

| Oś | Punkty | Wymiar po wymiarze |
| --- | ---: | --- |
| K | **13 z 18 (72.2%) — FAIL** | K1 2; K2 0; K3 2; K4 2; K5 2; K6 2; K7 2; K8 1; K9 0 |
| M | **8 z 10 (80.0%) — PASS progowy** | M1 1; M2 2; M3 2; M4 2; M5 1 |
| G | **7 z 18 (38.9%) — FAIL** | G1 2; G2 1; G3 1; G4 0; G5 1; G6 0; G7 1; G8 1; G9 0 |

Wymiary `0`: K2 agenda/struktura; K9 brak ucięć; G4 hierarchia typografii; G6 grafiki; G9 wykończenie. Krytyczne G równe `0`: **3 z 9**.

Deck ma realne dane i osie wykresów, ale powtarza karty/KPI, zawiera skrajnie mały tekst (`6.5–13 pt`) i nie ma żadnych obrazów. Tytuł slajdu 5 łamie się poza stały pasek w renderingu LibreOffice.

### Uwaga o M1 i K8

M1 = `1`, nie `2`, ponieważ pliki zawierają deklarowane źródła i spójne liczby, lecz dyżur nie otrzymał paczek źródłowych pozwalających potwierdzić grounding każdej liczby. K8 = `1`, bo źródła występują tylko na wybranych slajdach, nie jako pełne lineage decku. To jest `EVIDENCE_MISSING`, nie założenie.

## B.2 — obserwacje nadzorcy: `8 z 8`

| # | Werdykt | Slajd i dowód | Źródło obserwacji |
| --- | --- | --- | --- |
| 1 | **POTWIERDZAM** | FINAL 2 i 3; PERFEKCJA 2 i 3. Pole tytułu ma `y=0.1`, `h=0.72`, więc kończy się na `0.82`, podczas gdy pasek ma `h=0.8`; LibreOffice pokazuje drugą linię w białym polu. | rendering + struktura |
| 2 | **POTWIERDZAM** | FINAL/PERFEKCJA slajd 8. Pole `Wpływ`: `w=0.3 in`, `h=0.4 in`; LibreOffice łamie napis litera po literze. | rendering + struktura |
| 3 | **POTWIERDZAM defekt; NIE POTWIERDZAM dokładnie wartości ~40%** | FINAL/PERFEKCJA slajdy 4, 6, 8: pełnowysokie karty/panele przy 1–2 liniach treści zostawiają dominującą pustkę. Bez analizy pikselowej PowerPoint nie ma podstaw do uczciwego procentu `40%`. | rendering + struktura |
| 4 | **POTWIERDZAM dla FINAL; OBALAM dla PERFEKCJA-W7** | FINAL slajd 7: `Cause / Impact / Severity`, `HIGH / MEDIUM`; w W7 widoczny baner jest po polsku, ale tabela nie renderuje się w ogóle, więc nie jest to naprawiony polski odpowiednik. | rendering + odczyt tekstów OOXML |
| 5 | **OBALAM tezę „przypadkowo”** | FINAL/PERFEKCJA slajd 8. Kod jawnie mapuje top-left→green, top-right→amber, bottom-left→blue, bottom-right→red. Kolory są hard-coded i mogą nie pasować do Brand Kit, ale nie są losowe. | kod + rendering |
| 6 | **POTWIERDZAM** | FINAL/PERFEKCJA slajd 5: dwie serie słupków mają ten sam granat; legenda jest mikroskopijna. | rendering; kod fallbacku kolorów |
| 7 | **POTWIERDZAM częściowo; OBALAM słowo „wszystkie”** | Slajdy treści 2–12 mają jednocześnie `n/12` i osobne `n`. Slajdy 1 i 13 nie mają podwójnej numeracji. Zasięg: `11 z 13` slajdów, nie `13 z 13`. | rendering + struktura |
| 8 | **POTWIERDZAM** | FINAL/PERFEKCJA slajd 3: `▲`, `▼`, `◆`, `▲` bez legendy i bez delty. | rendering + struktura |

## B.4 — przyczyny źródłowe `plik:linia`

### A. Stała geometria i nieskuteczny guard tytułu — obserwacja 1

- `server/src/services/report/pptx/designTokens.ts:38-48` — stała siatka: `headerH: 0.8`, `contentY: 1.0`.
- `server/src/services/report/pptx/atomics/SlideTitle.ts:81-110` — heurystyczne liczenie szerokości; ścieżka „fits” pozostawia `wrap: true`, co pozwala LibreOffice złamać tekst mimo przewidywania jednej linii.
- `server/src/services/report/pptx/atomics/SlideTitle.ts:118-145` — stałe `y=0.1`, `h=0.72` i fallback `fit:'shrink'`; pole kończy się `0.02 in` poniżej paska.
- `server/src/services/report/pptx/atomics/HeaderBar.ts:11-21` — pasek ma stałe `tokens.grid.headerH`.

Wniosek: hipoteza o stałym kontenerze jest potwierdzona dla tytułu, ale „brak auto-fit” jest zbyt szeroka — auto-fit istnieje, tylko strukturalnie pozostaje fallbackiem zależnym od renderera, a wcześniejsza heurystyka potrafi wybrać `wrap:true`.

### B. Zbyt wąska etykieta osi bez rotacji — obserwacja 2

- `server/src/services/report/pptx/layouts/PrioritizationMatrixLayout.ts:64-83` — `axisLabelGap=0.35`, pole Y ma szerokość `axisLabelGap - 0.05 = 0.30 in`; komentarz mówi „place vertically”, ale kod nie ustawia rotacji. To bezpośrednio produkuje łamanie litera po literze.

### C. Pełnowysokie karty i limitowana wysokość treści — obserwacja 3

- `server/src/services/report/pptx/layouts/KeyMessagesLayout.ts:86-105` — `cardH` bierze całe `contentH`, a `descH` jest ograniczone do `1.8 in`; blok jest centrowany w karcie.
- `server/src/services/report/pptx/layouts/KeyMessagesLayout.ts:107-121` — tło karty zawsze ma pełne `cardH`.
- `server/src/services/report/pptx/layouts/KeyMessagesLayout.ts:168-209` — treść ma stałe wysokości ikon/nagłówków/opisu, niezależnie od faktycznej liczby linii.

Wniosek: obserwacje 1–3 **nie mają jednej identycznej przyczyny**. Łączy je stała geometria, lecz tytuł przegrywa przez heurystykę fit + pasek, oś przez pole `0.30 in` bez rotacji, a karty przez pełne `contentH` i capped text box.

### D. Angielskie etykiety i severity — obserwacja 4

- `server/src/services/report/pptx/composites/ProblemCauseImpact.ts:77-110` — nagłówki `Cause`, `Impact`, `Severity` są hard-coded bez gałęzi językowej.
- `server/src/services/report/pptx/composites/ProblemCauseImpact.ts:112-133` — severity jest renderowane przez `c.severity.toUpperCase()`.

### E. Kolory kwadrantów — obserwacja 5 (teza o losowości obalona)

- `server/src/services/report/pptx/layouts/PrioritizationMatrixLayout.ts:26-39` — jawne mapowanie koloru i pozycji.
- `server/src/services/report/pptx/layouts/PrioritizationMatrixLayout.ts:99-126` — wybór koloru po `quad.position`; hard-coded poza tokenami motywu.

### F. Jednokolorowy wykres — obserwacja 6

- `server/src/services/report/pptx/composites/SingleInsightChart.ts:45-61` — każda seria bez własnego `s.color` dostaje ten sam `tokens.colors.primary`.

### G. Podwójna numeracja — obserwacja 7

- `server/src/services/report/pptx/atomics/PageNumber.ts:11-28` — każdy layout dodaje natywny `slide.slideNumber`.
- `server/src/services/report/pptx/PptxPipelineService.ts:461-491` — pipeline niezależnie dodaje footer zawierający `${pageNumber}/${totalPages}`.
- `server/src/services/report/pptx/PptxPipelineService.ts:379` — `addHeaderFooter` jest wołane po renderze layoutu, więc oba mechanizmy współistnieją.

### H. Symbole trendu bez znaczenia — obserwacja 8

- `server/src/services/report/pptx/atomics/TrendIndicator.ts:14-18` — symbole `▲/▼/◆`.
- `server/src/services/report/pptx/atomics/TrendIndicator.ts:27-37` — przy braku delty renderowany jest sam symbol; komponent nie dodaje legendy.

### I. Wspólne defekty rubryki G4/G6/G8

- `server/src/services/report/pptx/designTokens.ts:26-36` — body `13 pt`, caption `11 pt`, footnote `9 pt`; to nie spełnia specyfikacji decku projekcyjnego `24 pt`.
- `server/src/services/report/pptx/layouts/KeyMessagesLayout.ts:30-51` — obraz jest opcjonalny i powstaje tylko przy `asset.path` lub `asset.dataUri`; w trzech plikach liczba obiektów picture wynosi `0 z 3 decków`.
- `server/src/services/report/pptx/PptxPipelineService.ts:203-238` — logo jest dodawane wyłącznie dla custom template z poprawnym `logoDataUri`; badane decki nie zawierają logo, mimo powtarzalnych kolorów i fontu.

## Artefakty poza repo

Katalog: `/private/tmp/cx-day78-ppt-rubric-artefakty`. Manifest zawiera sumy `48 z 48` plików: 3 PDF, 39 PNG slajdów, 3 contact sheets i 3 pliki odczytu struktury JSON. Kluczowe sumy:

```text
39bbb9ffbc4dedbc2c6218384383d902740e402d6843eb483a67996fc4caf7bf  final/2026-06-28-DECK-FINAL.pdf
2fd91e145d83501ba6d7a9e674095c9be951c92bdd8fe2800e9175e3a6e7c160  perfekcja/2026-06-28-DECK-PERFEKCJA-W7.pdf
85ec00dfbd44230b8a106dae5043ac5b61437f73581b957b78d48e3234d9feba  battery/2026-06-28-BATTERY-Model-inwestycyjny-AI-AI_Platform_Solutions-prezentacja.pdf
baabb69b5e0cfc8b7322fe66130f6e20f7b621d52e4b04a917941ee2492d02f5  final-contact.png
99fb171dc64b0921d93c2d7a20497caa6d915626ad70506b1bec0a5be8fd565d  perfekcja-contact.png
d88ce9d374b84b89276b6767fe9e11b826cb09e1f043ac07bbba68ffc8a08fd4  battery-contact.png
1dbec7c33a6555d97a40da59633fa70edbaedbf150f4e40db2703e1da55bd6f9  SHA256SUMS.txt
```

## Korekty wobec instrukcji

1. Teza §A.5 „kolory macierzy ... przypadkowo” została **obalona**: `PrioritizationMatrixLayout.ts:26-39` ma deterministyczne mapowanie semantyczne. Nadal jest to paleta hard-coded, ale nie losowa.
2. Teza §A.7 „podwójna numeracja ... wszystkie” została **zawężona pomiarem** do `11 z 13` slajdów; cover i closing nie mają dubla.
3. Oczekiwany wynik weryfikacji stanu wejściowego nie był w instrukcji podany liczbowo; wynik rzeczywisty: rubryki `2 z 2`, LibreOffice `26.2.4.2`.
4. Komenda licznika na intuicyjnej tabeli `migrations` nie działała (`relation does not exist`); pomiar wykonano na wykrytej tabeli `schema_migrations`: `863`.
5. Próba złożenia contact sheets przez ImageMagick wykazała `magick not found` i `montage not found`; zastosowano dostępne Pillow poza repo. Nie zmienia to renderów źródłowych.

## Kryteria K1–K6

| Kryterium | Stan | Dowód |
| --- | --- | --- |
| K1 | **SPEŁNIONE** | `3 z 3` decków, każde: K `9 z 9`, M `5 z 5`, G `9 z 9` wymiarów wyszczególnione |
| K2 | **SPEŁNIONE** | wszystkie wymiary `0` wypisane imiennie przy każdym decku |
| K3 | **SPEŁNIONE** | obserwacje `8 z 8`, numer slajdu i typ dowodu |
| K4 | **SPEŁNIONE** | przyczyny pogrupowane A–I, każda z `plik:linia` |
| K5 | **SPEŁNIONE uczciwie** | head-to-head `NIEWYKONANY`, dokładny brak i wymagane wejścia wskazane |
| K6 | **DO WERYFIKACJI KOŃCOWEJ** | przed commitem jedyną zmianą jest ten raport; wynik końcowego diff poniżej zostanie sprawdzony przed push |

## K — lista plików wobec markera

Oczekiwany i wymagany wynik po commicie:

```text
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY78_PPT_RUBRIC_REPORT.md
```

Nie zmieniono żadnego pliku kodu, testu, PPTX ani artefaktu w repo.
