# Plan testów — SERIA B (Mózg generatywny premium / FT-6)

> Program **Generatory Deliverable**, fala **W4**. Seria B = generatory AI premium
> (deck / doc / table) — **skok jakości**, nie UI-klikanie. Jakość mierzymy
> **programowo** (scoring engine) + **head-to-head** vs Gamma / Airtable / Kimi.
>
> **SSOT powiązane**
> - Spec produktowy: `docs/product/DELIVERABLES_GENERATORS_SPEC.md`
> - Scenariusze (90): `docs/qa/deliverables/scenarios/M{18,19,20}_*.md`
> - Katalog kryteriów (kod): `tests/integration/deliverables/catalog/{decks,reports,tables}.ts`
> - Scoring engine: `tests/integration/deliverables/scoring/{deck,doc,table}Scoring.ts` (+ `scoringTypes.ts`)
> - Runner LIVE (plain-node): `scripts/deliverables/live-pilot-ft6.mts`
> - Wyniki pilota: `docs/qa/deliverables/runs/2026-06-22-live-pilot-{sonnet46,gpt4o}.json`
> - Tier/flaga: `server/src/services/deliverableGenerationTier.ts` (`ENABLE_DELIVERABLES_PREMIUM`)
> - Generatory: `presentationLayoutDirectorService.ts` (B1), `documentStudio/documentStructureGenerator.ts`
>   + `documentStudio/documentBlockContentGenerator.ts` (B3), `tableSchemaGeneratorService.ts` (B4)

---

## 0. Dwie warstwy testów — przeczytaj najpierw

Dla Serii B testy są **dwojakie**. Nie myl ich:

### Warstwa 1 — AUTOMATYCZNE programowe (Scoring-auto) — DZIAŁA DZIŚ
Odpalamy **realne** serwisy generatorów na **żywym LLM** (premium, Anthropic Sonnet
wg D1) **w plain-node** (NIE vitest — SDK structured pada pod vitest: undici/provider-utils
parsuje 200-OK jako „Invalid JSON"). Wynik scorujemy tym samym enginem co mock-harness.

- **Runner**: `scripts/deliverables/live-pilot-ft6.mts`
- **Komenda** (klucz ze stagingu Railway):
  ```bash
  ANTHROPIC_API_KEY=<klucz-staging> ENABLE_DELIVERABLES_PREMIUM=true \
    node --import tsx scripts/deliverables/live-pilot-ft6.mts
  ```
- **Bezpieczeństwo**: runner ustawia `DOTENV_IGNORE_LOCAL=1` → NIE dotyka `.env.local`
  (= PROD centerbeam) i NIE inicjalizuje DB. Generacja jest czysta (bez DB).
- **Artefakt**: JSON do `docs/qa/deliverables/runs/<data>-live-pilot-<model>.json`
  (`byModule[].avgScorePct`, `rows[].scorePct/passed/failures/sample`).
- **Scoring**: `scoreDeck` / `scoreDoc` / `scoreTable`. `scorePct` = % kryteriów ✓
  (informacyjny). `passed = substantivePassed && graphicPassed` (zero failów w obu
  kategoriach — bardzo surowe, dlatego pilot ma 0 PASS przy avg 61%).

### Warstwa 2 — MANUALNE / Playwright-UI (Manual-UI, Head-to-head) — WYMAGA WPIĘCIA
Przelot przez **żywy pipeline UI** (deck builder / doc studio / table grid) za flagą
`ENABLE_DELIVERABLES_PREMIUM`, z porównaniem head-to-head i screenshotem.

> ⚠️ **UCZCIWIE: dziś NIEWYKONALNE z UI.** Flaga `ENABLE_DELIVERABLES_PREMIUM` jest
> domyślnie **OFF** (`deliverableGenerationTier.ts:13` — default OFF = dzisiejsze
> zachowanie), a generatory premium **nie są jeszcze wpięte w żywy pipeline UI**
> (chat→canvas→studio). Warstwa 2 staje się wykonalna dopiero po: (a) ustawieniu
> flagi na Railway, (b) wpięciu generatorów w UI, (c) deployu. Do tego czasu te
> przypadki są **BLOCKED / projektowe** — opisane, by były gotowe, ale nie do
> odhaczenia. **Nie wolno twierdzić, że jakość UI potwierdzona, dopóki nie ma
> żywego LLM przez UI.**

### Legenda kolumny „Typ"
- **Scoring-auto** — warstwa 1, mierzalne dziś (runner + scoring engine).
- **Manual-UI** — warstwa 2, przelot przez UI + screenshot (BLOCKED do wpięcia).
- **Head-to-head** — ocena porównawcza vs konkurent (Gamma/Airtable/Kimi); część
  programowa (eksport artefaktu) + część ekspercka (ocena 1–5 przez QA/Piotra).

### Stan z pilota FT-6 (2026-06-22, plain-node, Sonnet — golden S01/S06/S16 per moduł)
| Moduł | passed | avg scorePct | uwaga |
|---|---|---|---|
| deck (B1) | 0/3 | **79%** | premium działa; do 10 distinct layoutów; image-brief na każdym slajdzie. S16=93%, S01=78%, S06=67% |
| table (B4) | 0/3 | **70%** | typowane pola + seed rows; S06=90%, S16=91%, S01=29% (słaby na Sml) |
| doc (B3) | 0/3 | **32%** | STRUKTURA premium-grade, ale **content-gen pada na timeout** przez stall inicjalizacji DB w harnessie — jakość treści **niezmierzona**. S01=50/S06=33/S16=14 = mierzy podłogę, nie mózg |

> 0 PASS = surowość bramki (zero-fail w obu kategoriach), NIE „nic nie działa".
> `scorePct` to realny sygnał jakości. Progi FT-6 (sekcja 7) celują w `scorePct`.

---

## B1 — Deck → AI Layout Director

**Cel**: dla intentu + listy slajdów LLM dobiera layout (z 17-katalogu), spójny motyw/paletę
(1 paleta/deck), generuje image-brief per slajd, KPI/roadmap gdzie trzeba; jakość ≈ Gamma.
**FT**: FT-1 (kontrakt schema/Zod), FT-2 (golden output), FT-6 (rubric/scoring na golden-tematach),
FT-8 (fallback gdy AI off → deterministyczna podłoga, `fallbackUsed=true`, `source≠'llm'`).
**Stan z pilota**: PREMIUM żywy, avg **79%** (vs ~58% podłoga); S16 [Xtr]=93%, S01=78%, S06=67%.

| ID | Tytuł | Typ | Jak uruchomić | Kryterium zaliczenia | Artefakt dowodowy | FT |
|---|---|---|---|---|---|---|
| B1-S01 | Golden 3-temat → różne layouty | Scoring-auto | runner FT-6 (komenda §0); scenariusze `DECK_SCENARIOS` (`catalog/decks.ts`) S01/S06/S16 | `scoreDeck` `minDistinctLayouts` ✓ ORAZ `noTripleRun=0 violations`; deck ≥8 slajdów → ≥8 distinct layoutów | `runs/<data>...json` → `rows[deck].sample.distinctLayouts/layouts` | FT-6/FT-2 |
| B1-S02 | Motyw/paleta dopasowana, JEDNA na deck | Scoring-auto | jw. | `single palette`=1 distinct paletteId; wszystkie `paletteId ∈ PALETTE_CATALOG` (13) | `rows[deck].sample.palettes` | FT-6 |
| B1-S03 | Image-brief na slajdach | Scoring-auto | jw. | `imageBriefMinSlides` ✓; pilot: brief na każdym slajdzie | `rows[deck].sample.withBrief / sampleBrief` | FT-6 |
| B1-S04 | Slajd KPI obecny gdy temat metryczny | Scoring-auto | golden-temat z KPI (np. S z `requireLayoutAtLeast: kpi_strip`) | `requireLayoutAtLeast {intent:'kpi_*', min:1}` ✓ | `rows[deck].sample.layouts` | FT-6 |
| B1-S05 | Roadmap layout gdy temat = harmonogram | Scoring-auto | golden-temat „roadmap/plan wdrożenia" | `requireLayoutAtLeast {intent:'roadmap', min:1}` ✓ | `rows[deck].sample.layouts` | FT-6 |
| B1-S06 | Fallback gdy AI OFF = podłoga deterministyczna | Scoring-auto | runner **bez** premium: `ENABLE_DELIVERABLES_PREMIUM=false` (lub `preferPremium:false`) | `fallbackUsed=true`, `tierUsed='STANDARD'`, brak crasha, deck nadal waliduje schema (layouty/palety ∈ catalog) | nowy run JSON z `fallbackUsed=true` | FT-8 |
| B1-S07 | Kontrakt schema/Zod (kształt wyniku) | Scoring-auto | jw. — pierwszy run | `palettes from catalog` ✓ ORAZ `layouts from catalog` ✓ (Zod enum nie przepuścił śmieci); `plans.length` w `[minSlides,maxSlides]` | `rows[deck].failures` puste dla tych kryteriów | FT-1 |
| B1-S08 | Jakość vs Gamma (ekspercka) | Head-to-head | wyrenderuj deck z artefaktu do PNG/PDF (sekcja 6) + ten sam intent w Gamma; ocena 1–5 w 4 osiach (layout-fit / hierarchia / motyw / „gotowe do klienta") | mediana ocen ≥ **4/5**; brak osi < 3 | tabela ocen + 2× PNG (nasz vs Gamma) w `runs/<data>/h2h-deck/` | FT-6 |
| B1-S09 | Dark mode renderu | Manual-UI ⚠ | po wpięciu: deck builder w dark, ten sam deck | brak crimson-leak, kontrast ≥4.5:1, paleta czytelna na dark | screenshot `…/B1-dark.png` | FT-6 |

---

## B2 — Deck → warianty / remix

**Cel**: regeneracja slajdu w N wariantach (różne layouty/ujęcia) z zachowaniem treści;
wybór wariantu persystuje; undo wraca do poprzedniego.
**FT**: FT-1 (kontrakt remix), FT-3 (idempotencja/stabilność), FT-6 (jakość wariantów), FT-7 (persystencja wyboru).
**Stan z pilota**: **NIEZMIERZONE** — pilot FT-6 nie obejmuje remixu (runner woła tylko
`planDeckLayout` raz). Remix wymaga osobnego ścieżki testowej.

| ID | Tytuł | Typ | Jak uruchomić | Kryterium zaliczenia | Artefakt dowodowy | FT |
|---|---|---|---|---|---|---|
| B2-S01 | Remix slajdu → 3 warianty | Scoring-auto | rozszerzyć runner: zawołać layout-director N=3× na 1 slajdzie z różnym seedem; scorować każdy | 3 wynikowe warianty, ≥2 distinct `layoutIntent`; każdy waliduje schema | nowy JSON `runs/<data>-remix.json` (3 plany) | FT-6/FT-1 |
| B2-S02 | Treść (key_message) zachowana w wariantach | Scoring-auto | jw. | `key_message`/headline semantycznie ten sam w 3 wariantach (porównanie keyword-overlap ≥ próg) | diff w JSON | FT-3 |
| B2-S03 | Stabilność / brak driftu palety | Scoring-auto | jw. | wszystkie warianty trzymają paletę deck (`single palette`) | JSON | FT-3 |
| B2-S04 | Wybór wariantu persystuje | Manual-UI ⚠ | po wpięciu: wybierz wariant 2, reload | wybrany wariant po reloadzie = ten sam (persyst w canvas/studio) | screenshot przed/po reload | FT-7 |
| B2-S05 | Undo wraca do poprzedniego slajdu | Manual-UI ⚠ | po wpięciu: remix → Undo | slajd = stan sprzed remixu | screenshot | FT-7 |
| B2-S06 | Dark mode | Manual-UI ⚠ | po wpięciu | jw. B1-S09 | screenshot | FT-6 |

---

## B3 — Doc → AI pełna struktura bloków

**Cel**: dla intentu + outline LLM buduje strukturę bloków premium-grade
(`kpi`/`chart`/`callout`/`bulletList`/`table`/`heading`/`text`), z groundingiem ze źródeł
(cytowania) i poprawnym PL/EN; jakość treści ≈ Kimi/Claude.
**FT**: FT-1 (kontrakt struktury), FT-2 (golden), FT-6 (rubric struktura + treść), FT-8 (fallback).
**Stan z pilota**: STRUKTURA premium-grade (poprawne typy bloków), **ALE content-gen pada na
timeout** przez stall inicjalizacji DB w harnessie — **jakość treści jeszcze niezmierzona**.
Pilot avg 32% mierzy PODŁOGĘ (S01=50/S06=33/S16=14), nie mózg. **To jest blocker do zdjęcia.**

| ID | Tytuł | Typ | Jak uruchomić | Kryterium zaliczenia | Artefakt dowodowy | FT |
|---|---|---|---|---|---|---|
| B3-S01 | **Odblokować content-gen** (root-cause timeout) | Scoring-auto | naprawić w runnerze stall DB-init dla `generateDocumentContent` (np. seam bez DB / stub registry); re-run FT-6 doc | `rows[doc].error` puste; content faktycznie wraca (nie timeout) | re-run JSON z niezerowym `sample.totalBlocks` i brakiem `error` | FT-6 |
| B3-S02 | Raport audytowy → sekcje + tabela + KPI | Scoring-auto | po B3-S01: golden „raport audytowy" (S16) | `requireBlockType` dla `kpi≥1`, `table≥1`, `chart≥1`; `minSections` ✓; `minDistinctBlockTypes` ✓ | `rows[doc].sample.blockTypes/sections` | FT-6/FT-2 |
| B3-S03 | Memo → struktura prosta (constraint) | Scoring-auto | golden „krótkie memo" (S01) | `maxSections` mała; `forbidBlockType` (np. brak `chart`/`kpi` w prostym memo) ✓ | JSON | FT-6 |
| B3-S04 | Jakość treści (nie tylko struktura) | Scoring-auto + ekspercka | po B3-S01; scoring `anyTextContains` + ocena ekspercka prozy (1–5) | `anyTextContains` keywordy domenowe ✓; ocena prozy ≥4/5 (brak „wody"/halucynacji) | JSON + notatka oceny | FT-6 |
| B3-S05 | Grounding ze źródła (cytowania) | Scoring-auto | golden z `minCitations`; przekazać `citationCount` | `minCitations` ✓; cytowania wskazują dostarczone źródło (nie zmyślone) | `rows[doc].artifact.citations` | FT-6 |
| B3-S06 | PL/EN poprawny | Scoring-auto | dwa runy: `language:'PL'` i `'EN'` | nagłówki/treść w żądanym języku (heurystyka językowa lub `anyTextContains` per język) | 2 JSON-y | FT-6 |
| B3-S07 | Fallback gdy AI OFF | Scoring-auto | `ENABLE_DELIVERABLES_PREMIUM=false` | struktura deterministyczna wraca, brak crasha; schema waliduje | run JSON STANDARD | FT-8 |
| B3-S08 | Kontrakt struktury (Zod/typy bloków) | Scoring-auto | pierwszy run | wszystkie `block.type ∈ DocBlockType` (11 typów); brak nieznanych | `rows[doc].failures` puste dla typów | FT-1 |

---

## B4 — Tabela → AI typowany schemat + kolory + seed

**Cel**: dla intentu LLM generuje typowany schemat (number/currency/percent/date/singleSelect/
multiSelect/checkbox/url/email/phone/rating), kolorowe opcje selectów (hex, traffic-light dla
statusów), ≥3 seed rows; jakość ≈ Airtable.
**FT**: FT-1 (kontrakt), FT-2 (golden), FT-6 (rubric), FT-8 (fallback).
**Stan z pilota**: avg **70%**; S06=90%, S16=91% (Med/Lrg mocne), **S01=29% (Sml słaby)** —
golden Sml wymaga uwagi (mało pól → łatwiej oblać `minTypedFields`/`requireFieldType`).

| ID | Tytuł | Typ | Jak uruchomić | Kryterium zaliczenia | Artefakt dowodowy | FT |
|---|---|---|---|---|---|---|
| B4-S01 | „Tabela ryzyk" → typy + kolory | Scoring-auto | runner FT-6 (`TABLE_SCENARIOS` S01/S06/S16) | `requireFieldType` (singleSelect dla severity) ✓; `expectTrafficLightColors` (R+A+G semantyczne) ✓ | `rows[table].sample.fields/fieldTypes` | FT-6 |
| B4-S02 | Budżet → typ currency | Scoring-auto | golden „budżet projektu" | `requireFieldType {currency,≥1}` ✓; `minTypedFields` ✓ | `rows[table].sample.fields` | FT-6 |
| B4-S03 | Status → singleSelect kolorowy | Scoring-auto | golden ze statusem | `requireSelectColors` (każda opcja ma hex) ✓; `requireSelectLabels` (np. To-Do/In-Progress/Done) ✓ | JSON | FT-6 |
| B4-S04 | Seed-rows ≥3 | Scoring-auto | jw. | `seed row count` ≥ `minRows` (quality-gate B4 wymaga ≥3) | `rows[table].sample.seedRows` | FT-6 |
| B4-S05 | Poprawić golden Sml (S01) | Scoring-auto | zdiagnozować S01=29%: które kryteria failują na małej tabeli; dostosować prompt/golden | S01 `scorePct` ≥ próg Sml (sekcja 7) | re-run JSON | FT-6 |
| B4-S06 | Kontrakt schema (typy ∈ katalog) | Scoring-auto | pierwszy run | wszystkie `field.type ∈ TYPED_FIELDS∪{singleLineText}`; brak nieznanych typów | `rows[table].failures` puste dla typów | FT-1 |
| B4-S07 | Fallback gdy AI OFF | Scoring-auto | `ENABLE_DELIVERABLES_PREMIUM=false` | `fallbackUsed=true`, schema deterministyczny waliduje, brak crasha | run JSON STANDARD | FT-8 |
| B4-S08 | vs Airtable (ekspercka) | Head-to-head | eksport schematu do XLSX (WorkbookBuilder) lub PNG gridu; ten sam intent w Airtable; ocena 1–5 (typowanie / kolory / seed realistyczny / „gotowe do użycia") | mediana ≥ **4/5**; brak osi < 3 | tabela ocen + artefakty w `runs/<data>/h2h-table/` | FT-6 |
| B4-S09 | Dark mode gridu | Manual-UI ⚠ | po wpięciu: table grid w dark | kolory selectów czytelne na dark, kontrast ✓ | screenshot | FT-6 |

---

## B5 — Premium tier wiring + telemetria

**Cel**: flaga `ENABLE_DELIVERABLES_PREMIUM` steruje tierem (PREMIUM vs STANDARD); spend
otagowany `deliverable_generation`; OFF = dzisiejsze zachowanie (fail-open, nigdy nie rzuca).
**FT**: FT-1 (kontrakt `resolveDeliverableTier`), FT-8 (fail-open / OFF=STANDARD).
**Stan z pilota**: tier-wiring **istnieje i zweryfikowany w runnerze** (premium aktywne →
`tierUsed='PREMIUM'`, `source='llm'`). Telemetria w UI **niezweryfikowana** (wymaga wpięcia).

| ID | Tytuł | Typ | Jak uruchomić | Kryterium zaliczenia | Artefakt dowodowy | FT |
|---|---|---|---|---|---|---|
| B5-S01 | Generacja premium gdy flaga ON | Scoring-auto | runner z `ENABLE_DELIVERABLES_PREMIUM=true` | `resolveDeliverableTier → 'PREMIUM'`; `rows[*].tierUsed='PREMIUM'`, `fallbackUsed=false`, `source='llm'` | run JSON (sonnet46) | FT-1 |
| B5-S02 | OFF = STANDARD (dzisiejsze zachowanie) | Scoring-auto | runner z flagą `false` LUB `preferPremium:false` | `resolveDeliverableTier → 'STANDARD'`; generatory dają podłogę, nie crashują | run JSON STANDARD | FT-8 |
| B5-S03 | Fail-open na błąd resolucji flagi | Scoring-auto | unit: `resolveDeliverableTier` z rzucającym `featureFlags` (DI seam `premiumEnabled`) | zwraca `'STANDARD'`, loguje warn, nie rzuca (`deliverableGenerationTier.ts:67`) | unit-test log / assert | FT-8 |
| B5-S04 | Log kosztu otagowany | Scoring-auto/Manual | sprawdzić, że spend generacji nosi `purpose='deliverable_generation'` (`DELIVERABLE_GENERATION_PURPOSE`) | wpis kosztu w cost-monitoring z tym purpose | wycinek logu/telemetrii | FT-1 |
| B5-S05 | Telemetria widoczna w panelu | Manual-UI ⚠ | po wpięciu: panel kosztów/telemetrii w UI | premium-generacja pojawia się w panelu z kosztem | screenshot panelu | FT-1 |

---

## 6. Artefakty dowodowe — jak je generować

1. **JSON wyników (zawsze)** — runner zapisuje automatycznie do
   `docs/qa/deliverables/runs/<data>-live-pilot-<model>.json`. To jest **podstawowy
   dowód** dla wszystkich Scoring-auto. Konwencja nazw: data + model + opcjonalny sufiks
   trybu (`-remix`, `-standard`, `-en`).
2. **Render do PNG/PDF dla oceny wizualnej (Head-to-head)**:
   - **Deck** — z artefaktu `plans[]` zbuduj slajdy i wyrenderuj. Najprościej:
     wykorzystać istniejący renderer prezentacji / skill `pptx` (eksport do .pptx →
     `export_pdf`), albo zrzut z UI po wpięciu. Zapis do `runs/<data>/h2h-deck/nasz-<S>.png`
     obok `gamma-<S>.png`.
   - **Doc** — `documentStudio/documentPdfRenderer.ts` / `documentDocxRenderer.ts` już
     istnieją; wyrenderuj artefakt do PDF/DOCX i zrób miniaturę PNG.
   - **Table** — `WorkbookBuilder`/`documentDocxRenderer` → XLSX, lub zrzut gridu z UI.
3. **Tabela ocen eksperckich (Head-to-head)** — markdown obok artefaktów: per oś (1–5)
   nasz vs konkurent, mediana, podpis oceniającego (QA/Piotr). Bez tego head-to-head =
   niedomknięty (ocena wizualna jest z definicji ekspercka, nie auto).
4. **Screenshoty (Manual-UI)** — dopiero po wpięciu; konwencja jak w `docs/qa/screens/`.

---

## 7. Próg jakości FT-6 (propozycja Q1)

Bramka „PASS/FAIL" engine'u (`passed = zero failów w obu kategoriach`) jest celowo
surowa (pilot: 0/9 PASS przy avg 61%) — nadaje się do **self-heal/regresji per-kryterium**,
ale jako **bramka jakości fali** jest zbyt twarda na start. Proponuję **bramkę na `scorePct`**
(realny, ciągły sygnał), kalibrowaną do podłogi zmierzonej w pilocie:

| Typ | Próg Q1 (gate fali) | Cel (aspiracyjny) | Uzasadnienie z pilota |
|---|---|---|---|
| **Deck (B1)** | śr. `scorePct` ≥ **75%** ORAZ żaden golden < **65%** | śr. ≥ 85% | pilot śr. 79% (S01 78 / S06 67 / S16 93) — 75% jest osiągalne dziś, 65%-floor podnosi S06 |
| **Table (B4)** | śr. `scorePct` ≥ **75%** ORAZ żaden golden < **60%** | śr. ≥ 88% | pilot śr. 70% (S06 90 / S16 91 / **S01 29**) — Med/Lrg już mocne; floor 60% wymusza naprawę Sml (B4-S05) |
| **Doc (B3)** | **NIE USTALAĆ progu, dopóki content-gen nie odblokowany** (B3-S01). Po odblokowaniu: śr. `scorePct` ≥ **70%** ORAZ żaden golden < 55% | śr. ≥ 85% | pilot 32% = podłoga (timeout content) — **NIE jest miarą jakości**; ustalenie progu na tej liczbie byłoby nieuczciwe |

**Reguły dodatkowe (twarde, niezależne od `scorePct`)** — muszą być ✓ niezależnie:
- Deck: `single palette`=1, layouty/palety ∈ catalog, `noTripleRun`=0. (graficzny kanon — niepodlegalne)
- Table: `requireSelectColors` (każdy select ma hex), typy ∈ katalog.
- Wszystkie: `source='llm'` + `fallbackUsed=false` gdy premium ON (inaczej mierzymy podłogę, nie mózg).

**Próbka golden**: minimum 3 per moduł (Sml/Med/Lrg = S01/S06/S16, jak w pilocie).
Dla solidnego gate'u fali docelowo **≥6 per moduł** (dołożyć S03/S11/S21 = środki tierów).

---

## 8. Wykonalność dziś — uczciwie

### ✅ Da się zmierzyć TERAZ (Scoring-auto, warstwa 1)
- **B1 (deck)** i **B4 (table)** w pełni — runner FT-6 na żywym LLM (klucz ze stagingu),
  scoring engine, zapis JSON. Pilot już to udowodnił (deck 79%, table 70%).
- **B5 tier-wiring** (S01/S02/S03) — przez runner (ON/OFF) + unit na `resolveDeliverableTier`.
- **Fallback FT-8** dla B1/B4 — wystarczy odpalić runner z flagą `false`.
- Wymaga tylko: **ważnego klucza LLM ze stagingu Railway** (lokalnie brak — patrz finding
  „Deliverables FT-6 pilot blocker"; mierzono podłogę deterministyczną przy braku klucza).

### ⚠️ Wymaga PRACY zanim zmierzymy (Scoring-auto, ale zablokowane)
- **B3 (doc) — content-gen**: pada na timeout (stall DB-init w harnessie). Trzeba odblokować
  ścieżkę (B3-S01: seam bez DB / stub registry) ZANIM jakość treści cokolwiek znaczy.
  **Dziś jakość treści doc = NIEZMIERZONA.** Nie wolno raportować jako potwierdzonej.
- **B2 (remix)**: runner nie pokrywa — trzeba rozszerzyć o wielokrotne wołanie generatora.
- **Head-to-head (B1-S08, B4-S08, B3-S04)**: część programowa (render artefaktu) wykonalna;
  **ocena wizualna jest ekspercka** (1–5 przez człowieka) — nie zautomatyzujemy jej sensownie.

### 🚫 Wymaga WPIĘCIA w UI/deploya (Manual-UI, warstwa 2)
- Wszystkie **Manual-UI** (B1-S09, B2-S04/S05/S06, B4-S09, B5-S05): flaga
  `ENABLE_DELIVERABLES_PREMIUM` dziś **OFF na Railway** i generatory premium
  **niewpięte w żywy pipeline UI** (chat→canvas→studio). Wymagają:
  1. ustawienia flagi na Railway (staging),
  2. wpięcia generatorów w UI,
  3. deployu i live-verify w przeglądarce (zgodnie z regułą „Verify before claiming").
- **Persystencja/undo wariantów (B2)** i **telemetria w panelu (B5-S05)** = tylko po wpięciu.

### 📋 Wymaga golden-promptów Q3
- Progi fali (sekcja 7) na ≥6 golden per moduł wymagają dopisania środkowych tierów
  (S03/S11/S21) do `catalog/{decks,reports,tables}.ts` z kryteriami — dziś runner bierze
  po jednym z każdego tieru (`pick()` w runnerze: S≤5, 6–15, 16–25).
- **B3** progu nie ustalać do czasu odblokowania content-gen (B3-S01).

### Podsumowanie uczciwości
- **Potwierdzone żywym LLM**: struktura+graficzny kanon deck/table (i częściowo treść deck/table)
  na próbce 3 golden — przy DOSTĘPNYM kluczu. Lokalnie w pilocie brakowało klucza =
  zmierzono PODŁOGĘ, nie mózg premium. **Nie twierdzimy, że jakość premium potwierdzona,
  dopóki nie ma re-runu na ważnym kluczu.**
- **NIEpotwierdzone**: jakość treści doc (B3, blocker timeout), remix (B2), cokolwiek przez UI.
