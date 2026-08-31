# CODEX DAY 79 — naprawa layoutu generatora PPT

Data: 2026-08-29  
Marker: `f6032bdaaa52469871e1010190c40d62261b8113`  
Gałąź: `codex/day79-ppt-layout-20260829`  
Zakres kodu: wyłącznie `server/src/services/report/pptx/**`.

## Werdykt

**6 z 6 przyczyn naprawione i potwierdzone parami renderów LibreOffice oraz odczytem OOXML.** Kontrolowany deck z identycznego UnifiedJSON wzrósł z **7 z 18** do **12 z 18** w tej samej rubryce G. Historyczny plik `docs/qa/deliverables/runs/2026-06-28-DECK-FINAL.pptx` pozostaje niezmienionym artefaktem (`sha256 54a40c…`) i nie ma w repo źródłowego UnifiedJSON, dlatego ścisły pomiar tego konkretnego pliku wynosi uczciwie **7 z 18 przed i 7 z 18 po**; wynik silnika na tym konkretnym wejściu po zmianie jest `NOT_PROVEN / EVIDENCE_MISSING`, a nie domyślnie podmieniony wynikiem decku kontrolnego.

## §0.1 — baza, marker i sanity

Wolne miejsce: `82 GiB`; porty `5951` i `4730`: `0 z 2` zajętych.

Komenda (2), wynik dosłowny:

```text
972a68e723 docs(instrukcje): dyzury 79/80/81 — pierwsze NAPRAWCZE, na podstawie diagnoz z 76/77/78
f6032bdaaa docs(ledger): DEC-299..302 — petla Word dziala, grafika PPT 7/18, komplet przyczyn, defekt #4 zdiagnozowany
795b85dcc4 merge: dyzur 76 — diagnoza defektu #4: DeckBuilderBottomBar h-full, canvas 487x0px
149ebcab97 merge: dyzur 78 — rubryka PPT 7 z 18 przy minimum 15, przyczyny plik:linia
c58ce527cb merge: dyzur 77 — petla: Word DZIALA, PPT blokuje 403 TEMPLATE_FORBIDDEN
a5e3cefaa4 docs(day78): clarify push proof
d443a933a2 docs(day77): report template document loop
15eea05166 docs(day78): record final isolation proof
52daf0feea docs(day78): measure PPT decks with quality rubric
e00611d6ef docs(acceptance): diagnose day76 presentation blank canvas
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
MARKER OK
```

Komenda (7), wynik dosłowny:

```text
f6032bdaaa52469871e1010190c40d62261b8113
```

`git status --short | head -3` nie wypisał żadnej linii. Krok (4) wypisał dokładnie `[core]` oraz `bare = false`.

Tip uciekł o `1 z 1` commitów:

```text
972a68e723 docs(instrukcje): dyzury 79/80/81 — pierwsze NAPRAWCZE, na podstawie diagnoz z 76/77/78
```

Różnica marker..tip obejmuje `3 z 3` instrukcji: dyżury 79, 80 i 81. Zgodnie z `DEC-2026-08-26-95` start nastąpił dokładnie z markera.

## BLOK 0 i Z30

Kontener `cx-day79-pg`, `pgvector/pgvector:pg16`, wyłącznie `127.0.0.1:5951`, baza `cx_day79`. Pierwsze migracje: `✅ Postgres migrations complete`; drugi przebieg: `Applying migrations: 0` i `✅ Postgres migrations complete`. Niezależny odczyt: `863` wiersze w `schema_migrations`.

```text
BRAK ZMIENNYCH POCZTY
 key | left
-----+------
(0 rows)
```

Grep drenaży w `server/src/Gateway.ts`: `0` trafień.

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

## B.1–B.6 — sześć przyczyn

Pułapki Z33 (a)–(d) nie dotyczą renderów: nie uruchamiano tras ani auth jako dowodu. Pułapka (e) dotyczy wszystkich obserwacji; dlatego rendering LibreOffice jest uzupełniony odczytem struktury OOXML przez `python-pptx`/XML i nie jest przedstawiany jako wierny PowerPointowi.

| Pozycja | Zmiana | Commit | Render PRZED → PO (sha256) | Dowód strukturalny |
| --- | --- | --- | --- | --- |
| B.1 / F | `PageNumber` stał się kompatybilnym no-op; jedynym właścicielem numeracji jest stopka pipeline | `24fa36fd65` | `b1-before.png` `300c9a…` → `b1-after.png` `05b335…` | slajd 2: teksty `2/6` i `2` → tylko `2/6` |
| B.2 / D | nagłówki i ważność zależą od `meta.language` | `7a3336b7e5` | `b2-before.png` `05b335…` → `b2-after.png` `df4d6f…` | `Cause/Impact/Severity`, `HIGH/MEDIUM/LOW` → `Przyczyna/Wpływ/Ważność`, `WYSOKA/ŚREDNIA/NISKA` |
| B.3 / B | etykieta Y używa `vert270`, pełnej wysokości osi i centrowania | `ad7232912a` | `b3-before.png` `da9ac3…` → `b3-after.png` `18a07e…` | `slide3.xml`: `vert="vert270"` występuje `1 z 1` razy |
| B.4 / E | fallback serii cyklicznie korzysta z palety tokenów; jawny `s.color` nadal wygrywa | `07ea544f44` | `b4-before.png` `f5921e…` → `b4-after.png` `a4623f…` | `chart1.xml`: `0A2A4E` i `0E9F6E`, `2 z 2` różne kolory serii |
| B.5 / A | pojedyncza linia ma `wrap:false`; domyślne pole `y=0.08`, `h=0.64`, koniec `0.72 < 0.8 in` | `140cceed2e` | `b5-before.png` `df4d6f…` → `b5-after.png` `192567…` | geometria pola mieści się w pasku z zapasem `0.08 in` |
| B.6 / C | wysokość karty zależy od liczby linii; układ stacked ma zwarte `0.9 in` | `94fc58177b` | `b6-before.png` `64b7ce…` → `b6-after.png` `a2a04c…` | karta nie dziedziczy już całego `contentH`; `naturalCardH <= availableCardH` |

Wszystkie pliki par leżą w `/private/tmp/cx-day79-ppt-layout-artefakty/pairs/`. Każda pozycja: commit, push na `github-backup`, generacja produkcyjnym `PptxPipelineService`, konwersja LibreOffice i oględziny.

## B.7 — ta sama rubryka, N z 18 przed i po

Deck kontrolny powstał z dokładnie tego samego UnifiedJSON przed i po (`6 z 6` slajdów). Wynik:

| Wymiar | Przed | Po | Uzasadnienie zmiany |
| --- | ---: | ---: | --- |
| G1 | 2 | 2 | bez zmiany |
| G2 | 1 | 1 | nadal ograniczona hierarchia |
| G3 | 1 | 2 | zwarte karty, mniej pustki wewnętrznej |
| G4 | 0 | 0 | floor 24 pt pozostaje poza sześcioma przyczynami |
| G5 | 2 | 2 | bez zmiany |
| G6 | 0 | 0 | brak obrazów pozostaje poza zakresem |
| G7 | 0 | 2 | rozróżnialne serie i czytelna oś |
| G8 | 1 | 1 | bez zmiany |
| G9 | 0 | 2 | usunięte widoczne duble, angielskie etykiety i wyjście tytułu |
| **Razem** | **7 z 18** | **12 z 18** | wzrost `5 z 18`; nadal poniżej progu `15 z 18` |

Artefakty: `before/day79-before.pptx` `d59098…`; `b6-after/day79-b6-after.pptx` `29f993…`.

**Korekta wobec instrukcji B.7:** dokument wymaga oceny po na „tym samym decku `2026-06-28-DECK-FINAL.pptx`”, ale repo zawiera tylko gotowy binarny PPTX i nie zawiera jego UnifiedJSON/golden input. Nie wolno utożsamiać innego wejścia z tym plikiem. Bezpieczna interpretacja: (1) zachować ścisły wynik historycznego artefaktu `7 z 18 → 7 z 18`, ponieważ pliku nie modyfikowano; (2) osobno zmierzyć silnik na identycznym kontrolowanym wejściu `7 z 18 → 12 z 18`; (3) oznaczyć regenerację dokładnego historycznego wejścia `EVIDENCE_MISSING` zamiast improwizować źródło.

## Testy, build i lista plików

Pakiet testów jest czysto jednostkowy/OOXML: `RUN_DB_TESTS=0 MOCK_DB=true`, bez tras, auth i DB. Pułapki Z33 (a)–(d): nie leżą na ścieżce; dowód stanowi lista pakietów (`pptx/**/__tests__`, `tests/unit/reports/pptx-layouts.test.ts`). Pułapka (e): testy OOXML nie dowodzą renderingu, dlatego są uzupełnione `12 z 12` screenshotów.

Porównanie JSON po `fullName`: `33 z 33` PASS przed, `33 z 33` PASS po; lista „zielony przed / czerwony po”: **PUSTA (`0 z 33`)**. `--retry=0` użyte w obu komendach. SHA: `tests-before.json` `1f8ccd…`; `tests-after.json` `37b2cd…`.

Build produkcyjny serwera: `NODE_OPTIONS="--max-old-space-size=3072" ../node_modules/.bin/tsc --build tsconfig.build.json` — `exit 0`, `dist/` utworzony. Zastany `dist/` przeniesiono odzyskiwalnie do `/private/tmp/cx-day79-ppt-layout-scratch/dist-before-final-build`, ponieważ środowisko wykonawcze odrzuciło destrukcyjne `rm -rf`; kod i wynik builda nie zostały przez to zmienione.

`git diff --name-only marker..HEAD` przed raportem:

```text
server/src/services/report/pptx/atomics/BodyText.ts
server/src/services/report/pptx/atomics/PageNumber.ts
server/src/services/report/pptx/atomics/SlideTitle.ts
server/src/services/report/pptx/composites/ProblemCauseImpact.ts
server/src/services/report/pptx/composites/SingleInsightChart.ts
server/src/services/report/pptx/layouts/KeyMessagesLayout.ts
server/src/services/report/pptx/layouts/PrioritizationMatrixLayout.ts
server/src/services/report/pptx/layouts/ProblemCauseImpactLayout.ts
```

Po dodaniu jedynego raportu końcowy zakres spełnia K6: kod wyłącznie `server/src/services/report/pptx/**` plus ten raport; zero zmian `src/`, locales, migracji, infrastruktury testowej i mapowania kolorów kwadrantów `PrioritizationMatrixLayout.ts:26-39`.

## Kryteria K1–K6

| Kryterium | Stan |
| --- | --- |
| K1 | SPEŁNIONE: `6 z 6` przyczyn |
| K2 | SPEŁNIONE: `12 z 12` screenshotów, `6 z 6` par |
| K3 | PARTIAL: kontrolny ten sam input `7 z 18 → 12 z 18`; dokładny historyczny artefakt `7 z 18 → 7 z 18`, regeneracja `EVIDENCE_MISSING` |
| K4 | SPEŁNIONE: build produkcyjny `exit 0` |
| K5 | SPEŁNIONE: `0 z 33` regresji po pełnych nazwach |
| K6 | SPEŁNIONE: wyłącznie licencjonowany kod + jeden raport |

