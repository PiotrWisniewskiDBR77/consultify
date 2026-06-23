# GOTOWOŚĆ M08 — Ideas · Table (do odbioru manualnego)

> **Moduł:** M08 Ideas-Table (pula `ideas`, ≠ M20 Tabele Studio) · **Status:** DO ODBIORU
> **Data:** 2026-06-23 · **Branch:** `feat/deliverables-w1`
> **Zakres dokumentu:** zamknięcie wszystkich kryteriów DoD **z wyjątkiem #3 i18n** (ODROCZONE — M08 ma największy dług i18n w puli, ~1695×/~1288 ternaries `isPl ?`; sweep w FAZIE 4, precedens M03: zamknięty 6/7 z i18n→Faza4).
> **Źródła:** teczka `Harvard/wdrozenie-100/M08-ideas-table.md`, karta `Harvard/modules/M08-ideas-table/KARTA_AUDYTU.md`, testy manualne `Harvard/Testy manualne/TESTY_M08_IDEAS_TABLE.md`, cases `Harvard/Testy manualne/CASES_M08_TABLE_30.md`.
> **Kod:** `src/components/MyWork/IdeaTableTool.tsx`, `src/components/MyWork/table/` (~50 plików), `server/src/routes/my-work.routes.ts`, `server/src/services/ideaAISuggestionsService.ts`.

---

## EPIKI (5/5 wg trackera)

| # | Epik | Domyka | Status |
|---|------|--------|--------|
| E1 | 4 przyciski bez zawsze-błędu (Import / ActivityFeed / AuditTrail / Snapshot) | B/zaufanie | ✅ ZAMKNIĘTA (`676e620993` + re-usunięcie sieroty SnapshotManager) |
| E2 | Uczciwe AI (filtry, fenced-JSON, ai-fill toast, generate_table, stream) | D | ✅ ZAMKNIĘTA (`99cda117a5` filterEval; fenced-JSON+stream+generate_table = false-positive; ai-fill toast dodany 06b) |
| E3 | Org-scope domknięty (4 zapisy develop + AI ownership-guard) | C/bezpieczeństwo | ✅ ZAMKNIĘTA (`0ae8a6cd15` + `ai-generate` guard `:5103`/`:8861`) |
| E4 | Martwy kod + dual-stack (DP-7) | C/path-B | 🟡 CZĘŚCIOWA — sieroty (`PublicFormView`, `offline/`) usunięte; **cut mostu path-B = D-01 ODROCZONA** (refaktor ~40% narzędzia, koordynacja z M20, NIE correctness-bug) |
| E5 | Testy do CI | jakość | ✅ ZAMKNIĘTA — `vitest run src/components/MyWork` wpięte w job `component` (`test-suite.yml:367-369`), 195/195 PASS |

---

## DoD — tabela (skip #3 i18n = ODROCZONE)

| # | Kryterium | Stan | Dowód `plik:linia` |
|---|-----------|------|--------------------|
| 1 | **Front↔back** | ✅ | 4 przyciski toolbar mają auth i degradują do cichego empty-state, brak always-error toast (`ActivityFeed.tsx`, `AuditTrailPanel.tsx`, Import = file-input). **Dwie deltą z teczki — sprawdzone, OBIE zamknięte:** (a) `generate_table` martwa w prompcie serwera → `grep -F generate_table server/src/services/ideaAISuggestionsService.ts` = **NONE** i **0 ref. w FE** → nieosiągalna ścieżka, brak dead-feature przycisku (false-positive); (b) fenced-JSON crash `table-action` → `ideaAISuggestionsService.ts:430` stripuje fences (`.replace(/^```(?:json)?\s*/i,'')…`) **przed** `JSON.parse` (`:431`), całość w `try/catch` → `{type:'error'}` (`:432-437`), nie crashuje. Rename tabeli = React-only (cross-zone, brak endpointu M20) — patrz manual-focus. |
| 2 | **Bezpieczeństwo** | ✅ | Org+user scope w 4 zapisach `develop` + ownership-guard SELECT przed LLM na 4 AI-endpointach (`ai-suggestions`/`ai-table-action`/`ai-fill` `0ae8a6cd15`; `ai-generate` `:5103`/mirror `:8861`). **Test cross-org istnieje i jest pełny:** `tests/integration/mywork/my-work.ai-ownership.contract.test.ts` (CI-gated `tests/integration`) — per-endpoint: unknown/cross-org → **404 + LLM NIE wołany** (`:142-150`), owned → guard przechodzi (`:152`), SELECT scoped `WHERE id=? AND user_id=? AND organization_id=?` (`:161-167`). 12/12. **Brak nowego testu do autorstwa — pokrycie kompletne.** |
| 3 | **i18n** | ⏸️ **ODROCZONE** | bare-missing gate = 0 (hard gate PASS, dwujęzyczność PL/EN działa funkcjonalnie); ~1288 ternaries `isPl ?` = canonical-debt → FAZA 4 sweep. **NIE blokuje odbioru** (precedens M03 6/7). |
| 4 | **Tokeny koloru** | ✅ (z notą) | Cele Visual Standard egzekwowane na zmigrowanych komórkach (PriorityCell/RiskScoreCell rose→danger, naprawione w 06b → 195/195). Surowe hex (`grep #RRGGBB` = ~323 trafień) to **palety danych domenowych** (`COLUMN_TYPE_COLORS`/`SELECT_COLORS`/scoring/heatmap w `tableTypes.ts`) — semantyka kolorów-danych, nie tokeny UI chrome; zgodne z kanonem (kolory danych ≠ tokeny powierzchni). UI chrome jeździ na tokenach/Tailwind. |
| 5 | **§27 (Table/Menu canon)** | **N/D** (uzasadnione) | §27 FilterableTable/Menu 1·2·3 = kanon **list-tabel widoku listy** (CRUD encji aplikacji). M08 to **narzędzie-grid canvasa** (Airtable/Notion-database wewnątrz idea-workspace), nie lista encji — własny model: 25 typów kolumn, FormulaEngineV2, własny FilterBuilder/`filterEval`, sort/CSV, widoki legacy. 3 surowe `<table>` (`IdeaTableTool.tsx`, `table/ViewRouter.tsx`, `table/GridView.tsx`) = **renderery danych grida**, nie list-tabele do migracji na FilterableTable. §27 nie aplikuje się. |
| 6 | **E2E w PR-gate** | ✅ | Co-located vitest (195/195) wpięte w job `component` (`.github/workflows/test-suite.yml:367-369`). E2E Playwright: `tests/e2e/smoke/m08-table-acceptance.spec.ts` (reprezentatywne ~20 z manuala, decyzja 2026-06-20) + `tests/e2e/cases/m08-cases.spec.ts` (32 testy = 30 MC-08 cases). **CASES_M08 = 29/1/0 zielone** (1 skip = voice/OCR Web-Speech honest-skip). Defer joby na Londyn = polityka kosztowa program-wide (nie M08). |
| 7 | **UI/UX canon** | ✅ | Empty/loading/error OK; dark-mode + EN bez error-boundary (asercja w smoke S09/S10); toolbar afordancje stabilne (`title=`); typewriter Copilot nad realnym tekstem API (nie fabrykacja — false-positive). Spójność z kanonem My Work / Ideas workspace. |

**Bramka DoD: 6/6 wymaganych (1,2,4,5,6,7) ✅ · #3 ODROCZONE.**

---

## TESTY MANUALNE

- **Dokument:** `Harvard/Testy manualne/TESTY_M08_IDEAS_TABLE.md` (data 2026-06-16, aktualny — mapa komponent↔plik↔stan zgodna z bieżącym kodem).
- **Liczba scenariuszy:** **100** numerowanych (sekcje 1–18; persist S1-S5 krytyczne, 25 typów kolumn, CRUD/sort/filtr, AI NL-bar/ai-fill/Copilot/Categorize, eksport CSV+prezentacja, konwersja wierszy, szablony frameworków, skróty klaw., znane bugi).
- **Cases bogate:** `Harvard/Testy manualne/CASES_M08_TABLE_30.md` = **30 case'ów** (MC-08-01…30); automaty `tests/e2e/cases/m08-cases.spec.ts` = **29/1/0 zielone** (1 honest-skip voice/OCR), 24 screeny w `tests/e2e/screenshots/cases/m08/`.

### Manual-focus (na co patrzeć ręcznie + noty do otwartych delt)

1. **Rename tabeli [KNOWN-BUG / manual-verify]** — `IdeaTableTool.tsx:789` rename to React-state only (zero API; brak endpointu M20 dla nazwy). **Po reload nazwa wraca do starej.** Testować że *zachowanie jest znane/oflagowane*, nie że naprawione (flag dla Harvard 5 / M20). Nie blokuje odbioru — persist danych tabeli jest trwały (S1-S5).
2. **Persist + reload (S1-S5)** — krytyczne: dodaj kolumny/wiersze, reload, dane muszą zostać (`extensions_json` blob, optimistic-lock map-sync).
3. **AI realne (ai-fill / Copilot / NL command-bar)** — fenced-JSON i stream są OK w kodzie (delty zamknięte); ręcznie potwierdzić że ai-fill „brak wartości" pokazuje **toast** (06b), Copilot streamuje nad realnym tekstem, NL-bar nie crashuje na ```json.
4. **Filtry between/in + słownik operatorów** — naprawione (`filterEval.ts`), zweryfikować że nie są cichym no-op.
5. **4 przyciski toolbar** — Import/ActivityFeed/AuditTrail nie rzucają always-error (ciche empty), Snapshot usunięty.
6. **Path-B / platform (FLAG OFF)** — poza zakresem odbioru v1; multi-tabele/FormBuilder/AuditTrail-platform/provenance = beta-zamknięte (`ENABLE_TABLE_PLATFORM_METADATA_FIRST=false`).

---

## TESTY DODANE / STAN POKRYCIA

- **Bezpieczeństwo (#2):** `tests/integration/mywork/my-work.ai-ownership.contract.test.ts` **JUŻ ISTNIEJE** i jest kompletny (cross-org 404 + LLM-not-called + org-scoped SELECT na 4 AI-endpointach, 12/12, CI-gated). **Nowy test NIE był potrzebny** — pokrycie cross-org/access-regression dla narzędzia tabeli jest pełne.
- **Co-located (#6):** 20 plików / 195 testów `src/components/MyWork` w job `component` (195/195 PASS).
- **E2E (#6):** smoke (reprezentatywne) + cases (29/1/0).

---

## OTWARTE / ODROCZONE (nie blokuje odbioru)

| Pozycja | Klasa | Decyzja |
|---|---|---|
| #3 i18n (~1288 ternaries `isPl ?`) | canonical-debt | **ODROCZONE → FAZA 4 sweep** (bare-missing=0, dwujęzyczność działa) |
| Cut mostu path-B (DP-7 / D-01) | refaktor ~40% narzędzia | **ODROCZONE** — koordynacja z M20 (backend `table-platform.*` ZOSTAJE), nie correctness-bug |
| Rename tabeli przez API | cross-zone (brak endpointu M20) | flag dla Harvard 5 / M20; manual-verify jako known-bug |

---

## WERYFIKACJE WYKONANE (file:line)

- `generate_table` w prompcie serwera: `grep -F generate_table server/src/services/ideaAISuggestionsService.ts` → **NONE**; 0 ref. w FE → false-positive (nie dead-feature path). **#1 OK.**
- Fenced-JSON: `ideaAISuggestionsService.ts:430` strip + `:431` parse + `:432` try/catch → brak crash. **#1 OK.**
- Ownership-guard test: `my-work.ai-ownership.contract.test.ts:142-167` (4 endpointy). **#2 OK.**
- CI wiring: `.github/workflows/test-suite.yml:367-369`. **#6 OK.**
- Surowe `<table>`: tylko renderery grida (`IdeaTableTool.tsx`, `ViewRouter.tsx`, `GridView.tsx`) → §27 **N/D**. **#5 OK.**
