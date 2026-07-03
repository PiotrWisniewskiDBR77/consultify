# Nawigacja + Uprawnienia — KANON (warstwa 02-components)

> **Status:** warstwa szczegółu podległa [`CANON.md`](../CANON.md) (§2 hierarchia prawdy). Nie nadpisuje kanonu — doprecyzowuje **nawigację cross-tool** i **bramki uprawnień**.
> **Cel:** jeden punkt prawdy dla sweepu **L1 (nawigacja+uprawnienia)** z macierzy 4 poziomów (`Harvard/wdrozenie-100/_STAN_PRACY_ODBIORY.md`). Spina rozproszone reguły: [CANON §4.5](../CANON.md) (control bars) + [workspace-3-tools-strip](workspace-3-tools-strip.md) + [TABLE_AND_PREVIEW_CANON](../03-modules/TABLE_AND_PREVIEW_CANON.md) (Menu 1/2/3).
> Wersja: v1.0 — 2026-06-29.

---

## 1. Wzorzec referencyjny: Notatnik (hamburger ⋯)

**Implementacja wzorcowa (SSOT):** `src/components/MyWork/NotebookContent.tsx` + `src/components/MyWork/notebook/NotebookHamburgerMenu.tsx`.

Cechy, które czynią go wzorcem — **każdy toolbar narzędzia MUSI je odwzorować**:

1. **Jeden hamburger ⋯** zbiera akcje drugorzędne (overflow) zamiast mnożyć przyciski w pasku. Brak 2./3. rzędu toolbara (zgodne z [CANON §4.5](../CANON.md)).
2. **Pogrupowane pozycje + cienkie dividery** (`separatorBefore`) — grupy semantyczne: *Convert to* (initiative/task/decision/idea/assessment/report/presentation) · *Export/Share* · *Destrukcyjne*.
3. **Wariant `danger`** dla akcji destrukcyjnych (usuń) + confirm (CANON §4.3). Pozycje `disabled` jawnie wyszarzone.
4. **Brak zdublowanych pasków** — toolbar nie powtarza Module Topbar ani Command Row (Menu 3).
5. **AI actions** nie w hamburgerze chrome — żyją po prawej stronie Menu 3 / w 3-tools-strip (panel AI Suggestions).

## 2. Reguły nawigacji cross-tool (MUST)

- **Jeden Command Row (Menu 3)** pod topbarem — [CANON §4.5](../CANON.md). Toolbary narzędzi (Ideas: mind map / process flow / table / whiteboard; Materiały; Wdrożenie) NIE tworzą drugiego rzędu.
- **Wspólny rail Ideas** (`src/components/MyWork/mindmap/CanvasLeftToolbar.tsx`) obsługuje WSZYSTKIE 4 narzędzia Ideas spójnie — akcje per-narzędzie przez prefiks (`mm_` / `wb_` / `pf_` / `tbl_`). **Prefiks MUSI pasować do aktywnego narzędzia** (regresja M08: rail emitował `mm_*` dla Table → akcje do martwej mind-mapy; fix T2.2 2026-06-29 = prefiks `tbl_`).
- **Stan kontrolek** (undo/redo enabled, tryb interakcji) płynie z aktywnego narzędzia, nie z domyślnego (M08: `tbl-undo-state` → rail).
- **Deep-link** do narzędzia jest autorytatywny dla zamontowanego toola (regresja M07/M09: `/workspace/whiteboard` potrafił otworzyć Process Flow — wyścig montażu; fix w `MyWorkHub`).
- **3-tools-strip** (Tools / Context / AI Suggestions) — single-select, klik-aktywny=zamyka. Wzorzec: [workspace-3-tools-strip](workspace-3-tools-strip.md).

## 3. Bramki uprawnień (MUST)

- **Bramki beta/pilot widoczne i spójne** — moduł zbramkowany pokazuje jawny stan (lock/„wkrótce"), nie pustkę ani fałszywy sukces (CANON §4.1 Honest UI).
- **Role-gate jawny** — taby/akcje zależne od roli (admin/pilot) są widoczne-ale-zablokowane lub ukryte spójnie; nie „niejasne" (macierz L1: M03/M04 pilot/permission-gate tabów = do ujawnienia).
- **Gotowy kod nie chowa się za nieprzejrzaną flagą default-OFF** — flagi ukrywające ZWERYFIKOWANE funkcje są kandydatami do flipu ON (decyzja D-D), nie do trwałego ukrycia (M14: Intelligence/What-If/Rollout/Benefits/`ganttBaseline`; M15: Strategic/AI/Portfolio/m14Handoff). Flaga bez wywołań = martwa = do usunięcia; **ale zweryfikuj 0-wywołań w kodzie przed usunięciem** (pułapka: `ganttBaseline` mylnie uznana za martwą — jest używana).
- **DEMO/PROD read-only** — sesja demo-org bywa read-only (403 na zapis); odbiór funkcjonalny wymaga org nie-demo.

## 4. Definicja „L1 ✅" (kryterium macierzy)

Komórka L1 modułu = ✅ gdy łącznie:
- [ ] nawigacja spójna z tym kanonem (jeden Command Row, hamburger-wzorzec, brak zdublowanych pasków),
- [ ] brak martwych przycisków (każda akcja w toolbarze/menu coś robi),
- [ ] bramka ról/pilot/beta jawna (widoczny stan zbramkowania, nie pustka),
- [ ] flagi przejrzane (gotowy kod nie ukryty przypadkiem; martwe flagi usunięte po weryfikacji).

## 5. Worklist sweepu L1 (z macierzy 2026-06-29)

| Moduł | Rozjazd L1 | Status |
|---|---|---|
| M08 Table | rail undo/redo emitował `mm_*` | ✅ NAPRAWIONE (T2.2, `166421b3f5`) |
| M03 My Work | pilot-gating tabów niejasny; convert→initiative UI niewpięty | ⬜ |
| M04 Notatnik | permission-gate taba notebook niejasny | ⬜ |
| M14 Wdrożenie | 5 flag OFF ukrywa gotowe funkcje | ⬜ (flip = D-D) |
| M15 Rezultaty | warstwy za flagami OFF | ⬜ (flip = D-D) |
| M22 / M26 | nietypowe/zbramkowane wejścia (podwójna bramka env / connected-only) | ⬜ (świadome) |

## 6. Binding (doc ↔ kod)

| Reguła | Kod SSOT |
|---|---|
| Hamburger-wzorzec | `src/components/MyWork/notebook/NotebookHamburgerMenu.tsx` |
| Wspólny rail Ideas + prefiksy | `src/components/MyWork/mindmap/CanvasLeftToolbar.tsx` |
| 3-tools-strip switcher | `src/components/shared/WorkspacePanelStrip.tsx` |
| Command Row (Menu 3) | `src/components/shared/ModuleMenu3.tsx` |
| Flagi (przykłady) | `src/components/Execution/executionFeatureFlags.ts` · `src/components/Results/resultsFeatureFlags.ts` |
