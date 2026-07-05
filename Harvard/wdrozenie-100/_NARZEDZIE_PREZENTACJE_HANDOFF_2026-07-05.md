# HANDOFF — Narzędzie Prezentacje (Presentation Studio) — 2026-07-05

> **Dla kogo:** agent, który NIE zna tej sesji, wraca "jutro" (być może na wyższym planie taryfowym). Ten dokument jest samowystarczalny — nie zakłada pamięci poprzedniej rozmowy.
> **TL;DR:** Program finiszu Prezentacji (15 pakietów: P0.1→P3.2 + W7 + Step 1a/1b) jest zmergowany na gałąź `feat/prezentacje-finisz` (bazującej na `canon-kit`). Regresja testowa (W7 guard-split ↔ Step 1b) NAPRAWIONA. Gałąź **NIE jest zdeployowana** — demo pozostaje nietknięte na dotychczasowym stanie (`1847934ebd`, Atelier). Backlog i otwarte decyzje Piotra niżej.

---

## 1 · Stan

- **Gałąź robocza:** `feat/prezentacje-finisz`, odgałęziona z `canon-kit` (merge-base = `a2b8b8b06a`, tip `canon-kit` w chwili prac = `1b024c1945`).
- **Merge do worktree:** `git merge --no-verify feat/prezentacje-finisz` wykonany czysto (fast-forward, brak konfliktów) w worktree `.claude/worktrees/agent-a94ce4c76351fa857`. Po naprawie regresji (patrz §2) HEAD = `5d0a8b37d4`.
- **NIEZDEPLOYOWANA.** Zweryfikowane: `git merge-base --is-ancestor <tip> demo` → **exit 1** (tip programu NIE jest przodkiem `demo`). Gałąź `demo` (Railway) pozostaje na `196fa2b3d2` — Atelier/StoryRail/DRD, święte, nienaruszone. Nic z tej roboty nie trafiło na demo.
- **Ważne:** ta praca żyje wyłącznie w `feat/prezentacje-finisz` (i tym worktree). Następca musi PUSHNĄĆ/zmergować do docelowej gałęzi integracyjnej wg decyzji Piotra — sam merge do `feat/prezentacje-finisz` NIE jest równoznaczny z "wdrożone".

### 1.1 · Zmergowane pakiety (chronologicznie, z SHA i efektem)

Poniższe to **first-parent chronologia** merge-commitów `merge(prezentacje): ...` na tej gałęzi (`git log --first-parent --oneline canon-kit..HEAD | grep prezentacje`), każdy = jeden pakiet z gate'u Piotra. Rodzic startowy: `1b024c1945` (canon-kit tip).

| # | SHA (merge) | Pakiet | Efekt jednym zdaniem |
|---|---|---|---|
| 1 | `ba32b41975` | P0.4 | Testy route-level: export-gate, public-viewer whitelist, autosave-conflict (`14d83e06fb`) — dowód na realnym Supertest, nie fałszywa zieleń |
| 2 | `9118b3a991` | P0.1+P0.2 | Usunięto duplikaty plików, i18n SlideSorter (`t()` zamiast literalu PL), ukryto martwe przyciski toolbara |
| 3 | `e14ad6cbdc` | P0.5 (bez etykiety w tytule) | Autosave compare-and-swap — zamyka lost-update race (409 na konkurencyjny zapis) `82addf0a1c` |
| 4 | `68874ba765` | P0.3 (bez etykiety) | Bundle export runtime + generation lock hardening (`bundleExportRuntime.ts`, `bundlePptxRuntime.ts`) |
| 5 | `6b15a232e0` | Step 1b data-path (bez etykiety) | `deckCompositionDataPath.test.ts` + `deckVisualDirectorComposition.test.ts` dodane; `DeckBuilder.tsx` i `presentationVisualDirectorService.ts` wired |
| 6 | `0301934b87` | P2.1 | `imageRouter` → generacja slajdów decka (fail-open, T0 stock images) `ed5928af91` |
| 7 | `cd0aed47ed` | P1.2 | Step 1b — dowód wizualny (render + VisionQA before/after), gate Piotra: zrzuty w `docs/qa/deliverables/runs/2026-07-04-step1b/` |
| 8 | `169580f547` | P2.2 | Podpięcie przycisków "AI Generate" + "Upload" w toolbarze do istniejących mechanizmów (`888513a853`) |
| 9 | `712333064c` | P2.4 | `factBook` contradiction-audit + provenance footnotes wpięte w generację decka (`822aa26420`) |
| 10 | `a9950c6c7a` | P0.3-b | Lock na LEGACY `generate/deck` route (konkurencyjna generacja) `d911b2bb53` |
| 11 | `f6d33190f6` | **W7** | Fill-canvas (rytm pionowy) + **guard-split** — degraduje split/two-column gdy treść rzadka (`2acec9fc46`) + proof harness (`2ed3076a3f`). **To pakiet, który spowodował regresję §2.** |
| 12 | `336c635ffe` | P3.2 | Rate-limit + revoke testy dla public deck share-link (`5ffb278a59`) |
| 13 | `fc76eab23f` | P3.1 | Collab invite (share-link) + banner konfliktu 409 (`8e386567e6`) — **NIE pełny per-user invite**, patrz §3 |
| 14 | `f3b329b5d5` | P2.5 | Odznaka jakości/walidacji na liście decków (`b8ebfd1c55`) — **NIE pełny scorecard**, patrz §3 |
| 15 | `f39c4d8a37` | P2.3 | Data-bound wykresy w FE renderer decka (recharts, zabija fake-data fallback) `dfad2c6e9e` + `4b60d80f04` (dowód before/after) |

Dodatkowo (poza numeracją P/W, ale część tej sesji): **Step 1a/1b fundament** `beaf589fe7` (B1 composition planner) + `d615cd7537`/`9afeb47e22`/`83deedad17` (FE renderer honoruje composition B1, data-path).

### 1.2 · Commit naprawy regresji (ta sesja)
- `5d0a8b37d4` — `test(deck): reconcile Step 1b layout tests with W7 guard-split` (+ 2 fixy tsc w `deckChartAdapter.ts`, patrz §2.4).

---

## 2 · Naprawa regresji (Część A tego zlecenia)

### 2.1 · Diagnoza
Pełna bateria testów po merge ujawniła 6 failing testów w 2 plikach:
- `tests/unit/deliverables/deckLayoutEngineHonor.test.ts` (5 testów)
- `tests/unit/deliverables/deckCompositionDataPath.test.ts` (1 test)

Przyczyna: **W7 guard-split** (`shouldAvoidSplit()` w `src/components/Presentations/DeckBuilder/layouts/LayoutEngine.ts`) to INTENCJONALNA reguła Piotra (gate P1.2) — degraduje layout split/two-column do stacked/full gdy:
- (a) którakolwiek kolumna wyszłaby pusta, LUB
- (b) najlżejsza kolumna < 35% najcięższej, LUB
- (c) łączna "waga" bloków < 5 jednostek, LUB
- (d) obie kolumny to sam krótki tekst (brak tall-fill: chart/image/kpi/table/…) a najcięższa kolumna < ~6 wagi.

Testy Step 1b (pakiet P1.1/starszy niż W7) używały fixture'ów typu `blocks: [block('heading')]` — DOKŁADNIE ten rzadki przypadek, który W7 ma degradować. To nie jest bug W7 — to jest bug w fixture'ach testowych, które nie nadążyły za nowszą, poprawną regułą.

### 2.2 · Naprawa
- **`deckLayoutEngineHonor.test.ts`**: wzbogacono fixture'y (`richBlocks()` = heading + chart + bullet_list(3 pozycje) + 2× kpi_widget) tak, by każdy archetyp z `ARCHETYPE_TO_TEMPLATE` przechodził próg guard-split (waga ≥5, balans kolumn ≥35%, tall-fill w kolumnie). Jeden archetyp (`left_image` → `cover_left_image`) wymagał osobnego fixture'a (`richBlocksForLeftImage()`), bo `assignBlocksToRegions` zawsze sortuje `heading` jako pierwszy blok i ten kradnie 1-slotowy region `image`, zanim prawdziwy blok `image` tam trafi — podmieniono wiodący `heading` na `image`.
- **`deckCompositionDataPath.test.ts`**: dla przypadku `kpi_grid_2x2` zaktualizowano OCZEKIWANIE (nie fixture) — `deckFromUnifiedJson` dla slajdu `performance_overview` emituje TYLKO JEDEN blok `metric_strip` (nigdy 4 osobne bloki KPI), więc `kpi_grid_4` (4 komórki) i tak zostałby zdegradowany przez regułę (a) — pusta kolumna to REALNE zachowanie produkcyjne, nie artefakt testu. Nowe oczekiwanie: `exec_top_kpi` ("KPI Strip + Content" — poprawny, niesplitowy fallback, wciąż honorujący `metric_strip` w dedykowanym regionie `kpi`). Asercje przenoszenia composition (`card.layout_id`, `card.composition`) NIETKNIĘTE.
- **Guard-split (`shouldAvoidSplit`, `LayoutEngine.ts`) NIE ZMIENIONY.** Zero zmian w logice produkcyjnej W7.

### 2.3 · Dowód koegzystencji
```
npx vitest run tests/unit/deliverables/deckLayoutEngineHonor.test.ts \
  tests/unit/deliverables/deckCompositionDataPath.test.ts \
  tests/components/Presentations/LayoutEngine.w7.test.ts \
  --reporter=dot --no-file-parallelism
```
→ **31/31 PASS** (3 pliki, wszystkie razem, bez izolacji) — dowód, że W7 i Step 1b współistnieją.

### 2.4 · Efekt uboczny: 2 błędy tsc odsłonięte przez merge (naprawione)
`npx tsc --noEmit` na zmergowanej gałęzi zwracał 13 błędów vs 11 na baseline `canon-kit` (porównanie przez `git worktree add --detach`, `NODE_OPTIONS="--max-old-space-size=8192"` bo domyślny heap OOM-uje na tym repo). 2 nowe błędy w `src/components/Presentations/DeckBuilder/blocks/deckChartAdapter.ts` (`adaptHarvey`, wprowadzone przez pakiet P2.3) — literał mapowany miał `note: string | undefined` (wymagane pole) niezgodne z opcjonalnym `HarveyBall.note?` w kontekście type-predicate assignability (TS2677/TS2322). Fix: budowanie obiektu `HarveyBall` przyrostowo, `note` ustawiane tylko gdy obecne. Po fixie: **11 błędów tsc, identycznie jak baseline canon-kit — 0 nowych.**

### 2.5 · Wyniki pełnej baterii (po naprawie)
```
npx vitest run tests/components/Presentations tests/components/ReportsAndPresentations \
  tests/unit/deliverables \
  tests/integration/routes/presentations.export-gate.route.test.ts \
  tests/integration/routes/presentations.autosave-conflict.route.test.ts \
  tests/integration/routes/presentations.generate-deck-lock.route.test.ts \
  tests/integration/routes/presentations.share-revoke-and-rate-limit.route.test.ts \
  --reporter=dot --no-file-parallelism
```
→ **1003 / 1007 testów PASS · 102/105 plików PASS.** Jedyne failing: 4 testy w 3 plikach deeplink (pre-existing, patrz §2.6).

### 2.6 · Pre-existing dług (NIE naprawiony, potwierdzony identyczny na canon-kit)
- `tests/components/ReportsAndPresentations/PresentationsTabContent.deeplink.test.tsx` (2 testy)
- `tests/components/ReportsAndPresentations/ReportsTabContent.deeplink.test.tsx` (1 test)
- `tests/components/ReportsAndPresentations/OutputsAggregateTabContent.deeplink.test.tsx` (1 test)

Przyczyna: `vi.mock('../../../src/components/shared/ModuleHub')` w tych plikach jest "bare" (nie zwraca `useTableSelection`), a komponenty (`PresentationsTabContent.tsx:382`, `ReportsTabContent.tsx:322`, analogicznie w Outputs) wołają `useTableSelection(itemIds)` z tego modułu (canon §3.5 — row selection + bulk archive). Zweryfikowane komendą identyczną na `canon-kit` (worktree `git worktree add --detach ... canon-kit` wewnątrz drzewa repo — WAŻNE: poza drzewem repo `npx vitest`/`tsc` nie znajdą `node_modules` po symlinku, bo node_modules tego repo NIE jest per-worktree, tylko realny katalog rozwiązywany przez node przez chodzenie do rodzica; root node_modules jest w `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules`) — identyczne 3 failed/2 passed, te same 4 testy, ten sam błąd. **Dwa pozostałe pliki w tym samym katalogu (`SheetsTabContent.deeplink.test.tsx`, `TemplatesTabContent.deeplink.test.tsx`) PRZECHODZĄ** (ich komponenty nie wołają `useTableSelection` lub mają kompletniejszy mock).
- **Nie naprawiać w ramach tego zlecenia** — poza scope (task explicite: "PRE-EXISTING (NIE Twoje, NIE naprawiaj)"). Kandydat do osobnego zadania: dodać `useTableSelection: () => ({...})` do mocka `ModuleHub` w tych 3 plikach.

---

## 3 · Backlog — CO ZOSTAŁO

1. **P1.3 — PPTX parity (LAYOUT_REGISTRY honoruje composition).** `server/src/services/report/pptx/layouts/index.ts` (LAYOUT_REGISTRY) NIE ma dziś świadomości `composition`/`layoutVariantId` — eksport PPTX renderuje z osobnej ścieżki niż ekran (FE `LayoutEngine.ts`). Ekran = wyeksportowany plik muszą wyglądać tak samo (ekran=eksport parity) — dziś NIE. To największa strukturalna luka programu.
2. **Grow-content (następny krok po W7).** W7 fill-canvas centrowanie/rozkład eliminuje "martwy dół", ale NIE eliminuje pustki — potrzebne **powiększanie realnej treści**: większy hero-number, bogatsze kafelki KPI, realne wykresy (P2.3 już zrobił część — data-bound charty zamiast placeholderów, ale nie skalowanie/rozmiar). Zobacz zastrzeżenie w `docs/qa/deliverables/runs/2026-07-04-w7-fillcanvas/README.md`: *"NIE bije jeszcze Gammy samodzielnie... to robota bloków (KpiWidget/Chart scaling) i kolejnych rund (W7.2–7.5, W10 wykresy)"*.
3. **FT-6 live pilot.** `scripts/deliverables/live-pilot-ft6.mts` istnieje, ale nie był odpalony w ramach tej sesji (wymaga `LIVE_PILOT=1` + klucza stagingowego). Pomiar jakości scoringu na prawdziwym modelu, nie tylko harness deterministyczny.
4. **Pełny per-deck quality scorecard (follow-up P2.5).** Dziś tylko odznaka `validationState` (validated/pending/attention_required) na liście. Pełny `bundleQualityScorecard` (0-100 + A-F + 7 wymiarów + topIssues) istnieje TYLKO dla business-plan-bundle (`generateBundleFromSpine`) — nigdy nie jest liczony dla `presentation_decks`. Żeby pokazać uczciwy scorecard per-deck, trzeba go najpierw wyliczać dla decków.
5. **Pełny per-user invite + presence WS (follow-up P3.1).** Dziś: share-link invite + banner konfliktu 409 (optimistic UI, brak realnego multi-user presence). PEŁNE rozwiązanie wymaga: nowej tabeli/schematu `presentation_deck_collaborators` (kto ma dostęp, rola) + gateway WebSocket `/ws/presentations/:deckId` (analogicznie do istniejącego `ideaCollabWs` dla Ideas pool) dla realtime presence/cursor. Nic z tego nie istnieje jeszcze w kodzie (zweryfikowane grepem — zero trafień).
6. **Klucze obrazów Ideogram/Recraft (T2-3 imageRouter).** P2.1 wpięło `imageRouter` z fail-open na stock (Unsplash/Pexels, tier T0). Wyższe tiery (Ideogram, Recraft, Qwen-Image, nano-banana/Gemini) istnieją w kodzie ale wymagają kluczy API — dziś fallback na T0 stock.

---

## 4 · OTWARTE DECYZJE PIOTRA (nic nie rusza bez tego)

- **(a) Akceptacja wizualna Step 1b + W7 do deployu (GATE).** Piotr musi obejrzeć i zaakceptować zrzuty w:
  - `docs/qa/deliverables/runs/2026-07-04-step1b/` (README + `png/` 14 zrzutów + `visionqa-results.json`) — Δ VisionQA dodatnie (+0.026 overall), ale slide1 (`two_column`) i slide2 (`kpi_grid_2x2`) mają LOKALNE REGRESJE (patrz zastrzeżenia niżej). Slajdy 0/5 bajt-identyczne (heurystyka już OK).
  - `docs/qa/deliverables/runs/2026-07-04-w7-fillcanvas/` (README + `png/` + `fill-geometry.json` + `visionqa-results.json`) — dead-bottom −39%, guard-split zbił półpustą kolumnę slide1, zero regresji na coverze. Ale: *"NIE bije jeszcze Gammy samodzielnie"* (patrz backlog #2 grow-content).
  - `docs/qa/deliverables/runs/2026-07-04-p23-charts/` (README + `png/`) — before/after data-bound wykresów (slide2 line, slide4 bar 3-series). **Zastrzeżenie: linia na slide2 urywa się (artefakt recharts `type="monotone"` — do zbadania, nie blokujące ale widoczne w screenach).**
  - Bez akceptacji tych trzech run-ów → NIE deployować feat→demo.
- **(b) Czy włączyć `VITE_ENABLE_DECK_COLLABORATE`?** P3.1 zostawił flagę **OFF** (default) — zakładka "Collaborate" w `ShareModal.tsx` renderuje się tylko gdy `import.meta.env.VITE_ENABLE_DECK_COLLABORATE === 'true'`. Włączenie wymaga decyzji: czy share-link-only invite (co P3.1 zbudowało) wystarcza na v1, czy czekać na pełny per-user model (backlog #5).
- **(c) Pierwszy deploy feat→demo.** Ta gałąź (`feat/prezentacje-finisz`) nie była nigdy deployowana. Pierwszy deploy wymaga jawnej zgody Piotra (zasada: demo święte, zmiany wyglądu tylko po akceptacji zrzutów — patrz §5).
- **(d) Klucze obrazów.** Ideogram/Recraft (i inne wyższe tiery `imageRouter`) czekają na klucze API — bez nich program zostaje na T0 stock fallback (fail-open, działa, ale nie premium-image).

---

## 5 · JAK WZNOWIĆ

1. **Gałąź:** `feat/prezentacje-finisz` (bazuje na `canon-kit`). Commit naprawy regresji: `5d0a8b37d4` na tej gałęzi w worktree `.claude/worktrees/agent-a94ce4c76351fa857` (jeśli ten worktree już nie istnieje, praca jest scalona z historią gałęzi — sprawdź `git log feat/prezentacje-finisz` po SHA z §1.2).
2. **Worktree:** to jest **współdzielone repo** — NIGDY `git stash` (może zjeść cudzy commit w innej sesji). Do porównań baseline użyj `git worktree add --detach <path> <ref>` — ale **`<path>` MUSI być wewnątrz drzewa repo** (np. `.claude/worktrees/xyz`), bo `node_modules` nie jest per-worktree — Node rozwiązuje pakiety chodząc w górę do `node_modules` roota repo (`/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/node_modules`). Worktree utworzony w `/tmp` NIE znajdzie `node_modules` i `npx vitest`/`tsc` się wysypie. Po użyciu: `git worktree remove <path> --force`.
3. **Merge integracyjny:** jeśli trzeba zmergować coś do `feat/prezentacje-finisz` (lub odwrotnie do innej gałęzi integracyjnej), użyj `git merge --no-verify` — husky pre-commit/pre-push hooki na tym repo potrafią blokować merge nawet gdy zmiany są czyste (dawniej "stash failed" false-positive). NIE pomijaj hooków dla zwykłych commitów bez wyraźnej potrzeby — tylko dla merge, gdy hook faktycznie przeszkadza.
4. **`/tests/` jest w `.gitignore` (linia 209).** `git add` po cichu POMIJA nowe pliki `.ts`/`.tsx` w `tests/`. ZAWSZE `git add -f` dla nowych/zmodyfikowanych plików testowych, inaczej commit "przejdzie" ale bez realnych zmian.
5. **Commit natychmiast** po każdej domkniętej jednostce pracy — nie zostawiaj dużych niescommitowanych diffów w współdzielonym repo.
6. **Demo święte.** Gałąź `demo` (Railway) = obecny stan produkcyjny (Atelier + StoryRail + DRD, `196fa2b3d2` w chwili pisania tego dokumentu). ŻADNA zmiana wyglądu z tego programu nie idzie na `demo` bez jawnej zgody Piotra NA ZRZUTACH (nie na opisie/tekście) — patrz gate w §4(a).
7. **Reporter `dot`, nie `basic`/domyślny.** `--reporter=dot --no-file-parallelism` dla baterii testów prezentacji — czytelniejszy output, mniej szumu w kontekście agenta.
8. **tsc baseline.** Domyślny heap Node OOM-uje na `npx tsc --noEmit` na tym repo — użyj `NODE_OPTIONS="--max-old-space-size=8192"`. Baseline `canon-kit` = **11 błędów tsc** (niepowiązane z Prezentacjami — DocumentStudio/tipTapToSchema, MyWork/reactflow API drift, MyWork/table test, Results/PortfolioInsightsPanel, Results/ValueDriverTree). Każdy nowy błąd wprowadzony przez merge/zmiany MUSI wracać do 11 lub mniej (porównuj przez worktree `--detach` na `canon-kit`, jak w §5.2).
9. **Weryfikacja przed twierdzeniem "gotowe".** Nigdy nie ogłaszaj "zrobione" na podstawie samego przejścia `tsc`/`eslint` — dla zmian UI zawsze render+screenshot (preview tools) przed raportem do Piotra.

---

## 6 · ZRZUTY do oceny (ścieżki + zastrzeżenia)

| Run | Ścieżka | Co pokazuje | Zastrzeżenia |
|---|---|---|---|
| Step 1b (P1.2 gate) | `docs/qa/deliverables/runs/2026-07-04-step1b/` | Composition B1 realnie zmienia layout 5/7 slajdów; VisionQA Δ +0.026 overall | slide1 (`two_column`) VisionQA −0.08 (rozrzedzenie treści); slide2 (`kpi_grid_2x2`) −0.04 (wykres-placeholder w harnessie zaniża balans); wyniki bezwzględne niskie (~0.23 balance) bo harness renderuje na scenie 720px z pustą przestrzenią u dołu identycznie w before/after — Δ miarodajne, poziom bezwzględny NIE |
| W7 fill-canvas + guard-split | `docs/qa/deliverables/runs/2026-07-04-w7-fillcanvas/` | Dead-bottom −39% (0.709→0.433), guard-split zbił półpustą kolumnę slide1, zero regresji na coverze (piksel-identyczny) | **"NIE bije jeszcze Gammy solo"** — potrzebne grow-content (backlog #2); VisionQA na tym harnessie ZBYT SZUMIĄCY dla oceny layoutu (placeholder-wykresy), arbitrem jest geometria (`fill-geometry.json`), nie VisionQA |
| P2.3 data-bound charts | `docs/qa/deliverables/runs/2026-07-04-p23-charts/` | Before=ikona-placeholder / fake Q1-Q4 dane → After=recharts realny, data-bound, paleta motywu | **slide2 (line chart) linia urywa się** — podejrzewany artefakt `recharts` `type="monotone"` na fixture z 12 punktami — do zbadania wizualnie, nie zweryfikowane jako blokujące |

Wszystkie trzy run-y mają w README dokładne komendy regeneracji (`node --import tsx scripts/deliverables/{step1b,w7,w7}/...`).

---

## 7 · Szybki start dla następcy (checklist)

- [ ] Przeczytaj ten dokument w całości.
- [ ] `git log --oneline feat/prezentacje-finisz -5` — potwierdź że widzisz commit `5d0a8b37d4` (naprawa regresji) jako najnowszy z tej sesji.
- [ ] Uruchom baterię z §2.5 — potwierdź 1003/1007 (4 pre-existing deeplink, nie więcej).
- [ ] Uruchom `npx tsc --noEmit` (z większym heapem) — potwierdź 11 błędów (baseline canon-kit), nie więcej.
- [ ] Nie deployuj nigdzie bez przeczytania §4 (otwarte decyzje Piotra) i uzyskania jego zgody na zrzuty z §6.
- [ ] Backlog z §3 to punkt startowy dla kolejnej rundy pakietów (P1.3 PPTX parity jest prawdopodobnie najwyższym priorytetem — bez niego eksport i ekran się rozjeżdżają).
