# W2 (seria R) — BLUEPRINTY IMPLEMENTACYJNE (z 5 reconów 2026-06-21)

> Wejście wykonawcze dla fali W2. Każdy R = rozłączny zakres plików (poza R1↔R2 wspólny panel doc). Testy ZAWSZE pod `tests/` (NIE `src/**/__tests__` — CI je pomija). Wszystko za flagą per-org (wzór M13, klienci OFF).

## Mapa rozłączności (kto co dotyka)
- **R1** edytuje `src/components/DocumentStudio/DocumentStudioDocumentPanel.tsx` + tworzy `DocumentStudio/editor/**`. Fundament.
- **R2** tworzy `DocumentStudio/inline-ai/**` (niezależne) + PO R1 wpięcie w edytor + usunięcie `DocumentStudioEditorPanel.tsx`. Zależy od R1.
- **R3** tworzy WYŁĄCZNIE `DocumentStudio/blocks/**` (nowe pliki). Rozłączne. R1 konsumuje po fakcie.
- **R4** edytuje `Presentations/DeckBuilder/**` + `presentationStudio.{api,routes}` + `presentationGeneratorService`. Rozłączna domena.
- **R5** edytuje `MyWork/table/**` (ViewRouter/GridView/types) + tworzy `formulaEngineCore.ts`. Rozłączna domena.

---

## R1 — Doc → TipTap editor (fundament; buduje Claude)
**Zastąpić** `renderSectionPreview` (DocumentStudioDocumentPanel.tsx L92-170; wywołanie L2001) edytorem TipTap.
**Nowe pliki** `src/components/DocumentStudio/editor/`: `DocumentTipTapEditor.tsx` (useEditor+EditorContent, content keyed na artifactId — UNIKAĆ remount-on-edit [[finding_ideas_canvas_remount_on_edit]]), `documentEditorExtensions.ts` (StarterKit + extension-table + reuse `CalloutNode` z notebook + node'y kpiStrip/docChart placeholder), `schemaToTipTap.ts` + `tipTapToSchema.ts` (round-trip ZERO utraty: blockId/sectionId/sourceRef/isAssumption w attrs), `nodes/{KpiStripNode,ChartNode,QuoteNode,DocImageNode}.tsx` (placeholder NodeView — R3 podmieni wnętrze, attrs = stabilny kontrakt `payloadJson`).
**Pakiety:** wszystkie `@tiptap/*` JUŻ w deps (nic nie instalować). Wzór: `CanvasEditor/canvasEditorExtensions.ts` (gotcha: wyłączyć w StarterKit link/underline — „Duplicate extension names" TipTap v3) + `Reports/Premium/Editor/Extensions/*` (Node.create+ReactNodeViewRenderer) + autosave `CanvasRichEditor.tsx` (debounce 300ms).
**Enum gotcha:** FE switch używał `'list'`, backend ma `bullet_list`/`numbered_list` — mapper tolerancyjny w obie strony.
**Autosave (E3):** debounce → `tipTapToSchema` → `onSchemaUpdated` + zapis. RYZYKO: brak bare-schema-PUT w API (dziś proposal→approve). Potwierdzić ścieżkę `work_canvas_drafts` vs nowy `PUT /:artifactId/schema` PRZED E3. E1/E2 w pełni FE bez tego.
**Testy** `tests/unit/documentStudio/editor/**` + `tests/integration/`: FT-1 ≥8 (round-trip wszystkich 13 typów bloków, render per typ ≠ JSON, edycja, i18n, legacy `list`), FT-2 ≥3 (autosave PG round-trip, reload, optimistic-lock 409, debounce).
**Kolejność:** E1 edytor read-from-schema → E2 round-trip (NAJWAŻNIEJSZY test) → E3 autosave.

## R2 — Doc inline-AI „zaznacz→popraw" + kasacja proposalu (buduje Claude, po R1)
**Niezależne TERAZ:** `DocumentStudio/inline-ai/{DocumentInlineAIMenu,useDocumentInlineAI,inlineActionPrompts}.tsx/ts` — wzór `CanvasEditor/CanvasAIFloatingMenu.tsx` (pozycja via getBoundingClientRect+clamp; akcje Skróć/Rozwiń/Ton/Popraw/Wyjaśnij). NIE importować Canvas menu (sprzężone) — skopiować wzorzec.
**Apply ścieżka A (zalecana):** reuse istniejący endpoint `POST /:artifactId/editor/proposals/local` (`createDocumentStudioLocalProposal` w api.ts) → diff before/after → approve/reject. Org-scope+audit+guardrails (cytaty/liczby) ZA DARMO z `documentEditorRefiner`. Blok z `sourceRef` → scope `source` (twardy guard).
**USUNĄĆ (po R1):** `DocumentStudioEditorPanel.tsx` (519 lin, jedyny konsument = TeresaDrawerPanel L1427-1452 w panelu) + import L64. Refiner + 6 proposal-funkcji serwera ZOSTAWIĆ (REST/governance). `DocumentStudioView.tsx` — usunąć tylko ETYKIETY „Mode 1/2/3" (nie phase/tab logikę — to T1).
**Testy** `tests/components/documentStudio/`: FT-1 ≥5 (selection→local-proposal z sectionId/blockId, akcje→instruction, approve/reject, sourceRef→scope source), FT-2 ≥3 (org-scope IDOR, fail→deterministic, audit), FT-8 ≥2 (401/404 cross-org, brak scope-pickera w UI).

## R3 — Doc render tabel/wykresów/KPI recharts (buduje AGENT; tylko nowe pliki)
**Katalog NOWY** `src/components/DocumentStudio/blocks/`: `docChartPalette.ts` (paleta Harvard z `ReportBuilder/blocks/ChartRenderer.tsx` + `clampPalette(n)` cap ≤7), `DocChartBlock.tsx` (recharts bar/line/pie/area+donut; `ResponsiveContainer`+własny height 240-300px; pie ≤5 wycinków/agreguj „Inne"; serie ≤8; osie+legenda+Tooltip OBOWIĄZKOWE), `DocTableBlock.tsx` (`<table>` bold-header+zebra+ramki1px+padding12px; `riskSemantics` koloruje Likelihood/Impact+etykieta), `DocKpiStrip.tsx` (siatka kart; wspiera `{items[]}` ORAZ `{columns,rows}`), `docBlockContent.ts` (czyste narratory: `narrowChartContent/narrowTableContent/narrowKpiContent` — TOLERANCJA dual-key `columns??headers`, `items[]`vs`rows`; nigdy nie rzucają→`null/[]`), `index.ts`.
**recharts:** `^2.15.4` JUŻ w deps. Wzór `ReportBuilder/blocks/ChartRenderer.tsx`.
**Kształt chart** (otypowany, `DocumentStudio/types.ts:108`): `{kind,title,categories?,xAxisLabel?,yAxisLabel?,series:{label,values,color?}[],caption?}`. Transformacja do recharts: `categories×series → [{name:cat_i,[label]:values[i]}]`.
**Styk z R1:** R3 dostarcza czyste komponenty (props in→JSX out, zero TipTap). R1 osadza w NodeView: `const c=narrowChartContent(node.attrs.content); return c?<DocChartBlock content={c}/>:<pre/>`. MOST natychmiastowy: R3 może też wpiąć dispatch w `renderSectionPreview` (~6 linii) zamiast JSON.stringify — ALE to plik R1; **R3 NIE dotyka panelu**, zostawia wiring R1/Claude. R3 = wyłącznie `blocks/`.
**Param graficzne:** `DELIVERABLES_GRAPHIC_PARAMETERS.md` §P-CHART/§2/§3.
**Testy** `tests/components/DocumentStudio/blocks/`: FT-1 ≥4-7 (bar/line/pie+limit≤5, kpi oba shape'y, table dual-key, limity serie/paleta, narratory na śmieciach→null). RYZYKO: recharts `ResponsiveContainer` w jsdom = 0×0 → mockować na `<div 600×300>` w testach.

## R4 — Deck Gamma-flow (buduje AGENT; domena Presentations)
**Inwentarz USUŃ/MUST (FE, `Presentations/DeckBuilder/`):**
- USUŃ: `CardFloatingToolbar.tsx` (dead, niewpięty — grep ref przed kasacją), layout-picker w `CardCanvas.tsx` (L96-135)+prop `onChangeLayout`+`handleChangeLayout` (DeckBuilder L876), Animations toggle (`DeckBuilderTopBar` L181-198), panele `media`+`artifacts` w `BlockToolbar.tsx` (L237-266, martwe).
- PRZENIEŚ do menu „⋯": QA/Governance/Analytics/Audit/History (TopBar + `DeckBuilderMelsChips`).
- MUST (nie ruszać): Undo/Redo (`useDeckState`), Theme/branding (`DeckThemeProvider`), Present mode (`PresentMode.tsx`), Share, Teresa toggle, Confidentiality badge.
- FIX: `CommandPalette.tsx:176` share→onPresent bug.
**AI-driven edit (E2, GŁÓWNA ścieżka):** rozszerzyć `regenerateSlide(deckId,idx,orgId,{instruction?})` (`presentationGeneratorService.ts:1660`) — instrukcja→`generateNarrative` + poszerzyć dozwolone intenty (dziś tylko 4 narrative; manual wymaga dowolnego slajdu) + fallback gdy AI off (zostaw try/catch). Route `presentationStudio.routes.ts:1106` czyta `req.body.instruction`. API `presentationStudio.api.ts:500` param `instruction`. FE: `handleRegenerateCard`→`handleRewriteCard(idx,instruction?)`, po sukcesie użyć zwróconego `data.slide`→`updateCard(...)` (OPCJA B, undo działa — NIE `setDeckReloadKey` który gubi undo). UX: inline-input „Przerób ten slajd…" na hover karty (`CardCanvas.tsx:136-156`).
**Granica z serią B:** R4 = mniej przycisków + 1 free-text-rewrite/slajd na ISTNIEJĄCYM narrative-engine. NIE buduje Layout Directora (B1) ani wariantów layoutu/remix (B2). Usuwamy ręczny layout-picker (nie zostawiać martwego — remix wejdzie w to miejsce w B2).
**Testy** `tests/components/Presentations/` (wzór `DeckBuilder.test.tsx`): FT-1 ≥4 (regenerateSlide(instruction) mutuje tylko slides[idx]; bez instrukcji=stare zachowanie; handleRewriteCard→updateCard; UNDO po rewrite; fallback toast). FT-3 ≥2 e2e (zmień slajd; present mode). RYZYKO: ContextPack null→regen no-op (gdy instrukcja jest a snapshot brak — lecieć LLM na slajd+instrukcja).

## R5 — Tabela CF w gridzie + jeden silnik formuł AST (buduje AGENT; domena MyWork/table)
**KRYTYCZNE: właściwy grid to `PlatformGridView` (funkcja LOKALNA w `ViewRouter.tsx` L101-296), NIE `GridView.tsx`.** CF martwy tu i w `GridView.tsx` (DataGrid, galeria). Legacy `IdeaTableTool.tsx` renderRow (L1244) — jedyne gdzie CF działa — NIE RUSZAĆ.
**CF wpięcie (E1):** `ViewRouter.tsx` PlatformGridView `renderRow` (L202) `<td>` (L217) → `style={getConditionalStyle(formatRules,col.key,row.data?.[col.key])}` (z `ConditionalFormatting.tsx:378`, gotowy); prop `formatRules` z `useTableData()`. Też `GridView.tsx` DataGrid `<td>` L637 (rozszerzyć istniejący style). `TableDataProvider.tsx` (~L306) wystawić `formatRules` w context.
**Persyst CF (E3):** `tp_views.config` to JSONB; `MetadataService.updateView` (L757) zapisuje dowolny config BEZ migracji. `src/types/tablePlatform.ts` ViewConfig (L232) + `conditional_formatting?: FormatRule[]`. `useTablePlatformIntegration.ts` (L234) reader `activeViewConfig.conditional_formatting` + writer `updateConditionalFormatting(rules)→updateView`. Legacy `useTablePersistence` bez zmian.
**Formuły (E2):** NOWY `formulaEngineCore.ts` = port CZYSTEJ części `server/.../formulaEngine.ts` (tokenize/Parser/parseFormula/evaluateFormula/extractFieldDependencies/BUILTINS/FormulaError — BEZ Database/Logger). `tableTypes.evaluateFormula` (L318, dziś `new Function`) → delegować do core. `FormulaEngineV2` → przepisać na core (agregaty `children.`/`related.` zostają warstwą NAD core, rozwiązać do literałów przed parse). Zachować sygnatury (anti-regres).
**Testy** `tests/unit/table/` + `tests/integration/table/`: FT-1 ≥6 (CF per operator koloruje; AST SUM/AVG/IF/CONCAT; SPÓJNOŚĆ FE↔BE 8 formuł identyczny wynik), FT-2 ≥3 (CF persyst round-trip przez updateView/ViewConfig), FT-8 ≥2 (org-scope tp_views). RYZYKO: precedencja CF inline vs sticky-primary bg; `bumpSchemaVersion` w updateView może triggerować re-render (echo M06/M07).
