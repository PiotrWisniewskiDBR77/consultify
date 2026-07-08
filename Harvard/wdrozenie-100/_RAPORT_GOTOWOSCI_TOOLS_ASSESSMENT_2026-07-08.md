# RAPORT GOTOWOŚCI — Tools (silniki) + Asystent Assessment (2026-07-08)

**Branch:** `feat/tools-assessment-dbr77` (baza origin/Londyn). **~25 commitów. Zero push/deploy/zapisu do bazy demo.**
**Werdykt jednozdaniowy:** silniki 11 narzędzi + doktryny + wiring **zbudowane i w 100% type-clean (tsc: 0 błędów w moich plikach)**; **jeden blocker do live-firing** (kontrakt kluczy sekcji) wymaga weryfikacji w działającej apce; asystent SIRI/ADMA podniesiony w 2 z 6 punktów.

---

## 1. CO ZBUDOWANE

### A. Dokumentacja narzędzi (pierwsza w historii projektu)
11 doktryn `_TOOLS_DOKTRYNA/*.md` (~200KB, web-verified źródła): VSM · Theory of Constraints · Decision Quality · Control Tower · Digital Value Pools · Legacy/Gartner TIME · Automation Pipeline · Robotics Feasibility · Logistics Automation · Integration Diagnostic · Data Inventory. Każda: cel · kiedy · inputy · metoda · **jak się wnioskuje** · **jakie insighty produkuje** · worked example · źródła. Insight-first.
+ `_TOOLS_MODEL_DZIALANIA` (przepływ 7 ogniw + architektura) + `_TOOLS_ENGINE_PROGRAM` (SSOT programu).

### B. Silniki 11 narzędzi (18 147 linii, config)
Każdy w `src/config/{tool}/`: `deepeningLadder` (drabina + bank PL/EN) + `{tool}Engine` (DETERMINISTYCZNE metryki metodyki) + `conclusionPrompts` (insight-first) + `index` (barrel + adapter). Wszystkie esbuild-clean, smoke-tested przez workerów. Przykłady rdzenia silnika:
- vsm: PCE + prawdziwy constraint (kolejki, flaga `differsFromIntuition`) + ukryta fabryka przeróbek.
- constraint-control: constraint (przepustowość vs popyt, nie zajętość) + throughput accounting T/I/OE + policy constraint.
- decision-engine: `overallQuality = MINIMUM` ogniw (łańcuch=najsłabsze), tornado `flipsRecommendation`.
- legacy: Gartner TIME + dependency-override (węzeł ELIMINATE→MIGRATE) + roadmapa grafem zależności.
- (pełna macierz w `_TOOLS_MODEL_DZIALANIA` §5).

### C. Wiring (Tools → runtime)
`promptRegistry.ts`: 11 importów + 11 branchy grounded-conclusion **przed** generic OPERATIONAL_TOOL_TYPES (anty-dead-code OXFORD #102). `useToolAI.ts`: 11 wpisów `OPERATIONAL_AI_TOOLS` (Draft Session + Rethink). **Wszystkie 11 szkieletów → status PEŁNY po stronie silnika.**

### D. Asystent Assessment (SIRI/ADMA/DRD) — 2 z 6 zmian
- ✅ **Zmiana 5:** fix kluczy `ADMA_PILLAR_WHY_HINTS` (4/5 filarów cicho padało na GENERIC).
- ✅ **Zmiana 2:** wpięcie per-pytanie AI guidance w SIRI + ADMA editory (był tylko DRD) — usuwa asymetrię; c-* nie crimson.
- Plan pozostałych 4 (1/3/4/6) w `_ASYSTENT_ASSESSMENT_PLAN`.

---

## 2. POZIOM GOTOWOŚCI (macierz)
| Warstwa | Tools (11) | Asystent (SIRI/ADMA/DRD) |
|---|---|---|
| Dokumentacja/doktryna | ✅ 100% | ✅ plan + audyt |
| Kod silnika/logika | ✅ 100%, tsc-clean | 🟡 zmiany 2+5 z 6 |
| Wiring do runtime | ✅ 100% | ✅ (zmiana 2 wpięta) |
| **Dane wejściowe (sekcje)** | 🔴 **BLOCKER — patrz §3** | ✅ (guidance dostaje dimension/level) |
| Live firing (działa u klienta) | ⛔ niepotwierdzone | ⛔ odbiór Piotra |
| Gate wizualny/UX Piotra | ⛔ czeka | ⛔ czeka |

---

## 3. 🔴 BLOCKER #1 — kontrakt kluczy sekcji (jedyny do live-firing)
11 nowych narzędzi mapuje na **generyczne** `TOOLSET_OPERATIONAL_STEPS`/`TOOLSET_DIGITAL_STEPS` (useToolStore). `createInitialOperationalData` keyuje sekcje po **step.id** (`fill`, `context`…). Adaptery silników czytają klucze **semantyczne** (`steps`, `moves`, `nodes`, `skus`…). **Nie pasują.** Konsekwencja: silnik dostanie pustą sesję → `build{Tool}ConclusionPrompt` zwróci `null` → fallthrough do generic summary. Silniki są wpięte, ale **nie odpalą na danych z generycznego kreatora**.

**Uwaga (ważna):** ten sam mismatch występuje w DZIAŁAJĄCYCH narzędziach operacyjnych (`inventory-autopilot`: step-id `sku-classification` vs adapter `skus`). To sugeruje, że sekcje semantyczne są populowane ŚCIEŻKĄ AI (`generateFullSession` keyuje semantycznie), nie surowym kreatorem — **czego statyczna analiza nie potwierdza.** Dlatego:

**DECYZJA/NEXT (wymaga live):** odpalić 1 sesję na żywej apce (np. vsm-builder), wygenerować Draft Session, podejrzeć realne klucze `sections` → (a) jeśli AI keyuje semantycznie, silniki odpalą — potwierdzić; (b) jeśli nie, dobudować dedykowane `{TOOL}_STEPS` (wzór `INVENTORY_STEPS`) z sekcjami = klucze adaptera. To ~1 dzień pracy, ale MUSI iść z live-weryfikacją, nie na ślepo.

---

## 4. WALIDACJA (co realnie sprawdzone)
- **esbuild:** wszystkie 44 pliki silników + 3 pliki asystenta + 2 pliki wiring = czyste.
- **tsc --noEmit (cały projekt, 8GB heap):** 27 błędów OGÓŁEM, **wszystkie pre-existing na Londyn** (CanvasRichEditor, DocumentTipTapEditor, PortfolioInsightsPanel… — niezwiązane), **0 w moim kodzie**.
- **Smoke-testy runtime** (workerzy, per silnik): odtwarzają worked-example z doktryn (np. constraint=krok z kolejką nie najbardziej zajęty; picking 58% ruchu; TIME dependency-override).
- ⛔ **NIE sprawdzone:** działanie w żywej apce (UI+DB), odbiór wzrokiem Piotra. To bramki Piotra.

---

## 5. CO POZOSTAJE (bramki decyzyjne Piotra)
1. **Live-firing Tools (§3)** — potwierdzić kontrakt sekcji / dobudować `{TOOL}_STEPS`. Priorytet #1 (bez tego silniki są inertne).
2. **Asystent zmiany 1/3/4/6** — initiative-gen czyta conclusion-model; cross-dimension so-what; DRD `whatItMeans` różnicowanie; scalenie Gemini-direct z platform LLM. (Plan gotowy.)
3. **Teresa create-tool-session** — realna luka AI-native (Teresa nie tworzy sesji Tools z czatu). Budować?
4. **11 szkieletów: decyzja produktowa** — teraz mają silniki; czy pokazywać w pickerze od razu, czy po live-verify?
5. **Odbiór wizualny/UX + deploy** — TYLKO Piotr. Ja: zero push/deploy.

---

## 6. HIGIENA
Branch `feat/tools-assessment-dbr77`, ~25 commitów (commit-per-krok). Workerzy: WYKONAJ-SAM guard (po nocnych zombie). Symlink node_modules (walidacja) do usunięcia. Doktryny to pliki .md (wartość same w sobie). Zero regresji na plikach dzielonych (tsc potwierdza).
