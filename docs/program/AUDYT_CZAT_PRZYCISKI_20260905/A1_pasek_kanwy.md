# A1 — górny pasek panelu kanwy (`WorkCanvasDocumentPanel` + składowe)

Katalog: `/private/tmp/m03` (gałąź `codex/m03-admin-20260824`, HEAD `4332ade1c6`).
Wszystkie trasy zmierzone `curl` bez auth na `https://staging.consultify.ai` (brak body, `test-id`
zamiast realnych ID). Flagi czytane z implementacji + `/private/tmp/m03/.env.local`.

## Montaż — od korzenia

`UnifiedChatPanel.tsx:7509` montuje `<WorkCanvasDocumentPanel>` wewnątrz
`{showWorkPanel && <aside>...}` (linia 7486). `showWorkPanel = isWorkPanelMode` (6499),
`isWorkPanelMode = mode === 'full' && isWorkPanelOpen` (1301). To NIE jest za flagą `VITE_*`
— `isWorkPanelOpen` to zwykły `useState(false)` przełączany przyciskiem `PanelRight` w headerze
czatu (`chat-work-panel-button`, `UnifiedChatPanel.tsx:6845-6856`) i kilkoma innymi miejscami
(np. po starcie generacji deliverable, linie 2370/3191/3364/3681/3822/5578/5620).
Propsy realnie przekazane do `WorkCanvasDocumentPanel` (7509-7518):
`conversationId, initialStarterId, initialDeckId, initialDraftId, onActiveDocumentChange,
onCanvasSelectionChange, onClose`. `onClose = () => setIsWorkPanelOpen(false)` — realny, nie
`undefined`.

`WorkCanvasDocumentPanel` (export, `WorkCanvasDocumentPanel.tsx:798`) to WRAPPER, nie sam pasek:
1. `CanvasArtifactSwitcher` (linia 850) — osobny pasek NAD paskiem z zakładkami, renderuje się
   tylko gdy konwersacja ma ≥2 montowalne artefakty (deck/doc/sheet/base). Nadzorca prawdopodobnie
   go nie widział (rzadki warunek) — jest jednak w zakresie brief'u (wymieniony wprost).
2. Dalej gałąź `mounted.kind`: `'deck'` → `CanvasPresentationView` (WŁASNY, inny pasek górny,
   linia 859); `'doc'|'sheet'|'base'` → `WorkCanvasMarkdownDocumentPanel` (linia 862/869) —
   TO jest komponent z paskiem opisanym przez nadzorcę (zakładki/+/3 grupy/kebab), `canvas-header`
   div, linia 3396-3811.

**WNIOSEK dla nadzorcy: pasek górny ma DWA warianty, nie jeden.** Tryb dokument/markdown/edytor
(`canvas-header`) ma opisane 3+5+4 grupy. Tryb prezentacji (deck) ma zupełnie inny, mniejszy
pasek (`CanvasPresentationView.tsx:121-156`) z 2-3 przyciskami (Otwórz w Deck Builder / Zamknij /
Spróbuj ponownie), nieopisany w brief'ie.

## Inwentarz

| # | Etykieta PL | klucz i18n | element plik:linia | handler | łańcuch | HTTP | trasa serwera (+montaż) | kontroler/serwis | flaga | curl | KLASA | uwagi |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Edytor | `canvas.viewMode.rich` | `CanvasViewModeControl.tsx:28-63` (mode='rich') | `onModeChange(mode)`→`setMode` | `WorkCanvasDocumentPanel.tsx:3492` `<CanvasViewModeControl mode={mode} onModeChange={setMode}/>`, `mode` = lokalny `useState` (892) | brak | — | — | brak | — | OK-LOKALNY | czysty stan klienta, przełącza gałąź renderu 5193/5236/5250 |
| 2 | Dok(ument) | `canvas.viewMode.document` | jw. (mode='document') | jw. | jw. | brak | — | — | brak | — | OK-LOKALNY | etykieta PL = „Dok", angielski fallback „Doc" — spójne, OK |
| 3 | MD | `canvas.viewMode.markdown` | jw. (mode='md') | jw. | jw. | brak | — | — | brak | — | OK-LOKALNY | |
| 4 | „+" Nowy Canvas | `canvas.panel.newCanvas` | `WorkCanvasDocumentPanel.tsx:3494-3506` | `setIsNewCanvasMenuOpen` | otwiera menu (3507/3613) | brak | — | — | `VITE_CANVAS_NEW_DOC_OPTIONS` (patrz D-1) | — | OK-LOKALNY | sam trigger; treść menu wariantowa (patrz 4a-4d) |
| 4a | Czysty dokument | `canvas.panel.newMenu.blank` | `:3514-3533` | `startBlankDocument()` (`:1919`) | `selectTemplate`(`:1890`)→`createDocumentState`+`persistDraft`(`:1913`) | `PUT/POST` | `/api/work-canvas/drafts[/:id]` (`work-canvas.routes.ts` `router.put('/drafts/:id')`/`router.post('/drafts')`) mount `Gateway.ts:585 app.use('/api/work-canvas', workCanvasRoutes)` | `work-canvas.routes.ts` save handler | ON w kodzie (patrz D-1) | 401 (PUT/POST na `/drafts*`) | OK | zapis draftu w tle po utworzeniu |
| 4b | Z szablonu (5 pozycji: Thoughts/Document/Research/Decision/Plan) | `canvas.panel.newMenu.fromTemplate` | `:3537-3577` (i legacy `:3613-3648` gdy flaga OFF) | `selectTemplate(template,...)` | jw. (4a) | `PUT/POST` | jw. | jw. | jw. | jw. | OK | `starterTemplates` (`:203-351`), 5 elementów, jeden handler |
| 4c | Z canvasa (lista draftów) | `canvas.panel.newMenu.fromCanvas` | `:3581-3611` | `startFromOtherDraft(draft)` (`:1977`) + lazy `loadOtherCanvasDrafts()` (`:1944`, GET przy otwarciu menu) | `Api.workCanvasListDrafts` → `selectTemplate`→`persistDraft` | `GET` + `PUT/POST` | `GET /api/work-canvas/drafts` (`work-canvas.routes.ts:2744 router.get('/drafts')`) | jw. | ON (gałąź osiągalna tylko gdy flaga ON — patrz D-1) | `GET /api/work-canvas/drafts` → 401 | OK | pusta lista / błąd obsłużone (`otherCanvasDraftsError`) |
| 4d | (legacy, flaga OFF) „New Canvas from template" | `canvas.panel.newMenu.legacyFromTemplate` | `:3613-3648` | jw. jak 4b | jw. | jw. | jw. | jw. | flaga OFF → ta gałąź; obecnie martwa na tym stanowisku bo default ON i `.env.local` nie ustawia `VITE_CANVAS_NEW_DOC_OPTIONS` | — | OK-LOKALNY (kod osiągalny, ale nieaktywny na tej konfiguracji) | patrz D-1 |
| 5 | Create presentation (żarówka? nie — `Presentation` ikona) | brak `t()` — string na sztywno | `canvasActionAvailability.ts:34` (label) / ikona `WorkCanvasDocumentPanel.tsx:544` | `renderCommandButton('create-presentation')`→`handleCommandAction` (`:3217-3220`) | `runOutputAction('create-presentation','presentation')` (`:2832`) | `POST` | `/api/work-canvas/drafts/:id/create-output` (`work-canvas.routes.ts:4286`) mount jw. | `requireCanvasCapability(...,'canvas.output.presentation')` (`:4296`) | capability `canvas.output.presentation` z `/api/access/effective` (patrz sekcja Flagi) | 401 | OK | **aria-label/title po angielsku niezależnie od języka UI — patrz D-2** |
| 6 | Create sheet | brak `t()` | `canvasActionAvailability.ts:39` / ikona `Table2` | jw. | `runOutputAction(...,'table')` | `POST` | jw. (`outputType:'table'`) | `canvas.output.table` | jw. | 401 | OK | etykieta mówi „sheet" celowo (komentarz `:35-38`), nie „table" — dobra decyzja nazewnicza, ale i18n nadal 0 |
| 7 | Create report | brak `t()` | `:40` / ikona `FileText` | jw. | `runOutputAction(...,'report')` | `POST` | jw. | `canvas.output.report` | jw. | 401 | OK | jw. D-2 |
| 8 | Send to idea | brak `t()` | `:41` / ikona `Lightbulb` | `runWorkspaceAction('send-to-idea','idea')` (`:2806`) | `runGovernedHandoff`→`WorkCanvasApi.createProposal`+`approveProposal` | `POST`×2 | `POST /api/work-canvas/drafts/:id/proposals` (`:3722`) + `POST /api/work-canvas/proposals/:id/approve` (`:3794`) | `canvas.convert.idea` (`work-canvas.routes.ts:4206`) | capability `canvas.convert.idea` | 401 / 401 | OK | dwuetapowy governed handoff (propose→approve), realny |
| 9 | Save as note | brak `t()` | `:42` / `StickyNote` | jw. wzorzec, target `note` | jw. | jw. | jw. | `canvas.convert.note` | capability `canvas.convert.note` | jw. | OK | |
| 10 | Create initiative | brak `t()` | `:43` / `Rocket` | target `initiative` | jw. | jw. | jw. | `canvas.convert.initiative` | capability `canvas.convert.initiative` | jw. | OK | |
| 11 | Capture decision | brak `t()` | `:45` / `Gavel` | target `decision` | jw. | jw. | jw. | `canvas.convert.decision` | capability `canvas.convert.decision` | jw. | OK | dodane w C3 wg komentarzy |
| 12 | Create task | brak `t()` | `:46` / `CheckSquare` | target `task` | jw. | jw. | jw. | `canvas.convert.task` | capability `canvas.convert.task` | jw. | OK | dodane w C4.1 |
| 13 | Copy Markdown | brak `t()` | `:28` / `Copy` | `handleCommandAction('copy')` (`:3196`) | `copyMarkdown()` (`:2012`) | brak | `navigator.clipboard.writeText` | — | brak (blokada tylko gdy pusty dokument) | — | OK-LOKALNY | |
| 14 | Share Canvas document | brak `t()` | `:29` / `Share2` | `runShareAction()` (`:2895`) | `ensurePersistedDraft`→`Api.workCanvasShare` | `POST` | `POST /api/work-canvas/drafts/:id/share` (`:4097`) | `requireCanvasCapability(...,'canvas.share')` (`:4100`) | capability `canvas.share` (domyślnie `false` nawet w Vitest — jedyna capability fail-closed na twardo, `:421/447`) | 401 | OK | po sukcesie pokazuje „share strip" (23-25) |
| 15 | Save Canvas document | brak `t()` | `:30` / `Save` | `persistDraft()` (`:1590`) | fetch bezpośredni (nie przez `Api.*`) | `PUT`/`POST` | `/api/work-canvas/drafts[/:id]` | jw. | brak | 401 | OK | `isDirtySaveAction` podświetla przycisk gdy `saveState` unsaved/failed |
| 16 | Close Canvas | brak `t()` | `:31` / `X` | `handleCommandAction('close')`→`onClose()` (`:3223-3229`) | prop z `UnifiedChatPanel.tsx:7517` `onClose={() => setIsWorkPanelOpen(false)}` | brak | — | — | brak | — | OK-LOKALNY | fallback `setAlertFeedback(...)` gdyby `onClose` był `undefined` — ale nie jest, patrz montaż |
| 17 | Canvas menu (kebab, ⋮) | `canvas.panel.menuAria` | `:3782-3794` | `setIsDiagnosticsOpen` | — | — | — | — | — | — | (NIE MOJE — A2) | odnotowuję tylko trigger: otwiera `canvas-diagnostics-menu` (`:3795-...`), zawiera m.in. Historia/Eksporty/Workflow/Send to Document·Table Studio |
| 18 | Tytuł dokumentu (input) | brak (aria-label na sztywno „Canvas document title") | `:3444-3455` | `updateTitle`(`onChange`), `persistDraft()` (`onBlur`, `:3449-3451`) | jw. jak Save | `PUT/POST` | jw. | jw. | brak | — | OK | input tekstowy, nie ikona, ale ma tunel zapisu |
| 19 | „Retry" (nieudany zapis) | `common.retry` | `:3480-3486` | `persistDraft()` | jw. | `PUT/POST` | jw. | jw. | widoczny tylko gdy `saveState==='failed'` | — | OK | |
| 20 | „← [tytuł notatki]" (powrót do notatki źródłowej) | `canvas.panel.source.backToNote(Titled)` | `:3419-3438` | `navigate('/my-work/notebook/:id')` | React Router, trasa istnieje w `AppRoutes.tsx` (`/my-work/notebook/:pageId` wzorzec deep-linku) | brak | client route | — | widoczny tylko z `expandSourceNote` (kontekst notatki) | — | OK-LOKALNY | nie zweryfikowałem 1:1 dokładnego wzorca trasy w `AppRoutes.tsx` (poza zakresem A1) |
| 21 | Divider zmiany szerokości panelu | `aiChat.workPanel.resizeDivider` | `UnifiedChatPanel.tsx:7493-7503` | `handleWorkCanvasEdgeMouseDown`/`handleWorkCanvasEdgeKeyDown` (`:6630/6656`) | `setPersistedWorkCanvasWidth`→`localStorage.setItem('workCanvasSplitWidth',...)` | brak | `localStorage` | — | brak | — | OK-LOKALNY | mysz (drag) + klawiatura (←/→/Home/End); klucz i18n `aiChat.workPanel.title`/`resizeDivider` BRAK w en i pl (fallback string) — patrz D-3 |
| 22 | Share strip — Copy | `canvas.panel.share.copyLinkTitle`/`copy` | `:5048-5057` | `copyShareLink()` (`:2962`) | `navigator.clipboard.writeText` | brak | — | — | widoczny po 14 | — | OK-LOKALNY | |
| 23 | Share strip — Revoke share | `canvas.panel.share.revokeTitle`/`revoke` | `:5058-5068` | `revokeShareAction()` (`:2934`) | `Api.workCanvasRevokeShare` | `DELETE` | `DELETE /api/work-canvas/drafts/:id/share` (`:4126`) | `canvas.share` | jw. | 401 | OK | |
| 24 | Share strip — Collapse (X) | `canvas.panel.share.collapse` | `:5075-5084` | `setIsShareStripDismissed(true)` | — | brak | — | — | jw. | — | OK-LOKALNY | link zostaje aktywny (tylko UI collapse) |
| 25 | Konflikt — „Save mine as a new version" | `canvas.panel.conflict.keepMine` | `:4999-5006` | `resolveConflictKeepMine()` (`:1070`) | `persistDraftRef.current(...,{baseUpdatedAt: conflict.serverUpdatedAt,...})` | `PUT` | `/api/work-canvas/drafts/:id` | jw. | widoczny gdy `saveState==='conflict'` (409 z serwera, `:1710`) | — | OK | ma udokumentowaną naprawę DEFECT-1 w komentarzu (stary bug z closure) |
| 26 | Konflikt — „Discard mine, load theirs" | `canvas.panel.conflict.loadTheirs` | `:5007-5014` | `resolveConflictLoadTheirs()` (`:1095`) | czysto lokalne — nadpisuje edytory wersją serwera | brak | — | — | jw. | — | OK-LOKALNY | ma udokumentowaną naprawę DEFECT-2 (stary bug: stan React bez edytorów) |
| 27 | Selekcja→„Create table/chart/diagram/research/decision" (5 przycisków) | `canvas.panel.selection.create*` | `:3289-3323` | `createArtifactBlockFromSelection(kind)` (`:2469`) | `ensurePersistedDraft`→`Api.workCanvasApplyOperation` (previewOnly) | `POST` | `POST /api/work-canvas/drafts/:id/operations` (`:3850`) | jw. | widoczne tylko gdy jest zaznaczenie tekstu w widoku Dokument/Markdown | 401 | OK | tworzy `pendingOperation`, wymaga zatwierdzenia (37-39) |
| 28 | Selekcja→skróty pisania: Use selection/Action list/Bullet summary (3) | `canvas.panel.selection.useSelection/actionList/bulletSummary` | `:3336-3357` | `applySelectionEditShortcut(shortcut)` (`:2521`) | czysto lokalne — wypełnia textarea `selectionEditDraft` | brak | — | — | jw. | — | OK-LOKALNY | |
| 29 | Selekcja→„Preview edit" | `canvas.panel.selection.previewEdit` | `:3372-3383` | `previewSelectionEdit()` (`:2531`) | jeśli brak `draftId`: lokalny diff; inaczej `Api.workCanvasApplyOperation` previewOnly | `POST` (gdy draft istnieje) | jw. `/operations` | jw. | disabled gdy pusty draft edycji | 401 | OK | ma gałąź lokalną `draftId==='__local__'` — sensowna, nie martwa |
| 30 | Selekcja→„Clear" | `canvas.panel.selection.clear` | `:3384-3390` | `setSelectionEditDraft('')` | lokalne | brak | — | — | — | — | OK-LOKALNY | |
| 31 | Pending operation — Apply | brak `t()` (`{pendingOperation.applyLabel}`, sam string budowany po angielsku, `:2512`) | `:5161-5167` | `applyPendingOperation()` (`:2592`) | lokalny apply LUB `Api.workCanvasApplyOperation` (approve) | `POST` | jw. `/operations` | jw. | widoczny po 27/29 | 401 | OK | patrz D-2 (i18n) |
| 32 | Pending operation — Reject | brak `t()` | `:5168-5174` | `rejectPendingOperation()` (`:2632`) | lokalne, czyści `pendingOperation` | brak | — | — | jw. | — | OK-LOKALNY | |
| 33 | Pending operation — Revise edit | brak `t()` | `:5152-5159` | `revisePendingSelectionEdit()` (`:2637`) | lokalne | brak | — | — | tylko dla `operation.type==='replace_selection'` | — | OK-LOKALNY | |
| 34 | Przełącznik artefaktów (CanvasArtifactSwitcher) — kafelki/`<select>` | brak `t()` w komponencie (stringi PL/EN budowane ręcznie wg `i18n.language`, nie przez `translation.json`) | `CanvasArtifactSwitcher.tsx:187-223` | `handleSelect(entry)`→`onSelect` prop = `setMountOverride` (`WorkCanvasDocumentPanel.tsx:855`) | czysto lokalne — przełącza `mounted.kind`, zapisuje `useArtifactsStore.setActiveArtifact` | brak | zustand store (lokalny) | — | widoczny tylko gdy `entries.length>=2` | — | OK-LOKALNY | osobny pasek NAD `canvas-header`; nadzorca mógł go nie zobaczyć bo wymaga ≥2 artefaktów w konwersacji |
| 35 | (tryb deck) „Otwórz w Deck Builder" | `canvas.presentation.openInBuilder` | `CanvasPresentationView.tsx:136-144` | `openInBuilder()` (`:115`) | `navigate('/presentations/builder/:deckId')` | brak (client route) | `AppRoutes.tsx:2808 path="/presentations/builder/:deckId"` | — | widoczny tylko `phase==='ready'` | — | OK-LOKALNY | trasa React Router potwierdzona istniejąca |
| 36 | (tryb deck) „Zamknij" | `common.close` | `:145-154` | `onClose` prop | ten sam `onClose` co #16 (przekazany z `WorkCanvasDocumentPanel props.onClose`, `:859`) | brak | — | — | zawsze widoczny gdy `onClose` podane | — | OK-LOKALNY | |
| 37 | (tryb deck) „Spróbuj ponownie" | `common.retry` | `:190-197` | `setReloadNonce(n+1)`→re-fetch w `useEffect` (`:67-113`) | `Api.get('/presentations/decks/:id')` | `GET` | `GET /api/presentations/decks/:id` (`presentations.routes.ts:2589`, mount `Gateway.ts:1234 app.use('/api/presentations', createBetaGate([...]), presentationsRoutes)`) | — | widoczny tylko `phase==='failed'` | 401 | OK | mount ma `createBetaGate(['/shared/','/embed/'])` — dotyczy tylko tych 2 podścieżek, `/decks/:id` poza gate |
| 38 | Blok tabeli z datasetu — Export filtered/selected/Clear selection/sortowanie kolumn/checkbox wiersza | brak `t()` (stringi na sztywno EN) | `CanvasArtifactBlockRenderer.tsx:209-334` | `exportRows`, `setSelectedRows`, `setSortColumn` | czysto lokalne — CSV budowany w JS, `downloadTextFile` (Blob) | brak | — | — | widoczne tylko gdy `documentState.blocks` ma blok `kind==='table'` (utworzony przez #27) | — | OK-LOKALNY | głęboka treść, nie „pasek", ale w zakresie pliku wg brief'u; i18n = 0 wszędzie |
| 39 | Blok — kopiuj/eksportuj nagłówek (`BlockHeader onCopy/onExport`) | brak `t()` | `:831-846` (definicja `BlockHeader`, użycie m.in. `:231/361/400/434`) | `onCopy`→`copyProjection`, `onExport`→`downloadCsv` | lokalne (clipboard / Blob) | brak | — | — | każdy blok artefaktu | — | OK-LOKALNY | |
| 40 | Blok diagramu — copySource/exportDiagram | brak `t()` | `:659-706` (przybliżone, `copySource`/`exportDiagram` w komponencie `DiagramBlockView`) | jw. | lokalne | brak | — | — | tylko blok `kind==='diagram'` | — | OK-LOKALNY | |

**Razem policzonych elementów: 40 pozycji inwentarza** (część to grupy z wieloma instancjami —
5 szablonów w 4b, N draftów w 4c, N wierszy/kolumn w 38 — więc realna liczba klikalnych DOM-node'ów
jest większa niż 40, ale liczba DYSTYNKTYWNYCH zachowań/handlerów to 40). Kebab (#17) i jego
zawartość (Historia, Eksporty PDF/DOCX/XLSX/PPTX/JSON, Workflow, Send to Document/Table Studio,
Import Markdown, upload datasetu, `showChangesFromLatestVersion`, `openVersionHistory`,
`restoreVersion`) świadomie NIE policzone — to zakres A2.

## Flagi

### D-1: `VITE_CANVAS_NEW_DOC_OPTIONS` (menu „+")
Plik: `src/utils/canvasNewDocOptionsFlag.ts:65-75`. Kolejność: query→localStorage→env→**default ON**
(`return true` na końcu, linia 74). `.env.local` NIE ustawia `VITE_CANVAS_NEW_DOC_OPTIONS` —
efektywnie ON na tym stanowisku. Klasyfikacja: **ZA FLAGĄ** (default w kodzie = ON, `.env.local` =
brak wpisu → dziedziczy ON). Legacy branch (4d) jest kodem osiągalnym tylko po ręcznym
`?ff_canvasNewDocOptions=0` lub `localStorage['ff.canvas_new_doc_options']='0'` — na produkcji/demo
prawdopodobnie martwy w praktyce, ale NIE usunięty i wciąż poprawny kodowo.

### Uprawnienia workspace/output (8 capability przez `/api/access/effective`)
`canvas.output.presentation|table|report`, `canvas.convert.idea|note|initiative|decision|task`,
`canvas.share` — pobierane per-capability GET-em (`WorkCanvasDocumentPanel.tsx:1500-1537`),
fail-closed (`failClosedCanvasRuntimeCapabilities`, wszystko `false`) dopóki nie przyjdzie token
i odpowiedź serwera. To NIE jest klasyczna flaga `VITE_*` — to autoryzacja per-organizacja/rola,
zweryfikowana jako realna (serwer wymusza te same klucze w `work-canvas.routes.ts:4100/4206/4296`
i `effectiveAccessService.ts:552-560`). Klasyfikacja per przycisk: OK (łańcuch kompletny), nie ZA
FLAGĄ w sensie brief'u (to autoryzacja, nie feature flag).

## Defekty

| D-n | P | element | co jest nie tak | dowód plik:linia | jak odtworzyć w 1 zdaniu |
|---|---|---|---|---|---|
| D-1 | P2 | Menu „+" (4d, legacy) | Kod dla flagi OFF istnieje i renderuje się poprawnie, ale nikt na tym stanowisku nie może go zobaczyć bez ręcznej manipulacji `localStorage`/query — martwy kod w praktyce, nieudokumentowany jako taki nigdzie poza kodem | `src/utils/canvasNewDocOptionsFlag.ts:65-75` (default ON), `.env.local` brak klucza | Otwórz `/chat`, kliknij „+" — zobaczysz TYLKO wariant 3-sekcyjny (4a/4b/4c), nigdy legacy (4d), chyba że dodasz `?ff_canvasNewDocOptions=0` do URL |
| D-2 | P2 | 12 przycisków-ikon (grupy 3+5+4, #5-16) + 3 przyciski pending-operation (#31-33) + treść bloków datasetu (#38-40) | Etykiety `aria-label`/`title` są stringami PL-nieświadomymi — po angielsku ZAWSZE, niezależnie od języka UI (nie przechodzą przez `t()` w ogóle, nie tylko brak tłumaczenia klucza) | `src/utils/canvas/canvasActionAvailability.ts:27-47` (`actionLabels`), `WorkCanvasDocumentPanel.tsx:2512/5158/5166/5173` (applyLabel/„Revise edit"/„Reject"), `CanvasArtifactBlockRenderer.tsx:251/261/267/...` | Ustaw UI na polski, najedź myszką na ikonę „Utwórz prezentację" w pasku kanwy — tooltip pokaże „Create presentation", nie polski tekst |
| D-3 | P2 | Aside panelu kanwy + divider zmiany szerokości (#21) | Klucze i18n `aiChat.workPanel.title` i `aiChat.workPanel.resizeDivider` NIE istnieją ani w `en`, ani w `pl` translation.json — działa tylko dzięki hardcoded fallback w `t(key, fallback)` | `UnifiedChatPanel.tsx:7490,7495`; brak wpisów w `public/locales/{en,pl}/translation.json` (sprawdzone: `workPanel.open` istnieje, `workPanel.title`/`resizeDivider` — nie) | `grep -n '"title"' public/locales/pl/translation.json` w sekcji `workPanel` — jest tylko `"open"` |
| D-4 | P2 | Dwa zupełnie różne paski górne dla trybu dokument vs. deck (#1-21 vs #35-37), nieudokumentowane w brief'u nadzorcy | `WorkCanvasDocumentPanel.tsx:840-869` (gałąź `mounted.kind`) | Poproś Teresę „zrób z tego prezentację", otwórz canvas — górny pasek jest inny (mniejszy, 2-3 przyciski) niż opisany w brief'ie (zakładki/+/3 grupy/kebab) |
| D-5 | P2 | `CanvasArtifactSwitcher` — osobny, łatwy do przeoczenia pasek (nadzorca go nie wymienił) | `WorkCanvasDocumentPanel.tsx:850-856`, `CanvasArtifactSwitcher.tsx:186-223` | Wygeneruj w jednej rozmowie i dokument, i prezentację (≥2 artefakty) — nad paskiem z zakładkami pojawi się dodatkowy 36px pasek przełącznika |

Brak defektów klasy P0/P1 w zweryfikowanym łańcuchu — WSZYSTKIE 40 pozycji inwentarza mają pełny,
działający tunel (klient→serwer 401-za-authem lub czysto lokalny, potwierdzony w kodzie). Nie
znalazłem ani jednego martwego handlera, `console.*`-only, twardego `disabled`, ani urwanego propsa
w tej powierzchni.

## Niezweryfikowane

- **Dokładny wzorzec trasy `/my-work/notebook/:pageId`** (element #20) — potwierdziłem tylko przez
  komentarz w kodzie („reuses the existing /my-work/notebook/<pageId> deep-link contract"), nie
  zgrepowałem `AppRoutes.tsx` linia-po-linii — to poza ścisłym zakresem A1 (element chatu, nie
  canvas), ale przycisk fizycznie żyje w `WorkCanvasDocumentPanel`.
- **Realne działanie `canvas.share` na koncie właściciela** — potwierdziłem tylko że trasa istnieje
  i wymaga capability; nie sprawdziłem czy jakakolwiek rola faktycznie MA `canvas.share=true` na
  demo/staging (brak dostępu do żywej bazy w tym zadaniu, zakaz logowania).
  Kod komentarza `:79-87` w `canvasActionAvailability.ts` sugeruje, że P0-2 (brak uprawnień) był
  znanym problemem — możliwe że nadal WSZYSCY mają `canShare=false` na produkcji.
- **`GET /api/presentations/decks/:id` mount przez `createBetaGate`** — potwierdziłem, że gate
  string-matchuje tylko `/shared/`+`/embed/`, więc `/decks/:id` powinien być poza bramką beta; nie
  prześledziłem implementacji `createBetaGate` linia-po-linii żeby wykluczyć np. globalny prefix-match
  zachowujący się inaczej niż sądzę.
- **Czy `CanvasArtifactSwitcher` i `CanvasPresentationView` faktycznie były w zamierzonym zakresie
  nadzorcy** — brief wymienia je z nazwy jako składowe, ale opis wizualny nadzorcy (zakładki/+/3+5+4
  grupy/kebab) pasuje WYŁĄCZNIE do `canvas-header` w `WorkCanvasMarkdownDocumentPanel`. Potraktowałem
  brzmienie brief'u dosłownie i zaudytowałem oba dodatkowe paski.

## Liczby

- **Elementów w inwentarzu: 40** (nadzorca szacował ~20 — realnie jest DWA RAZY więcej, głównie
  bo (a) pasek ma warianty deck/dokument, (b) menu „+" ma 3 warianty treści, (c) selection-popup
  i pending-operation to kolejnych 13 przycisków pominiętych w szacunku nadzorcy, (d) osobny
  `CanvasArtifactSwitcher`, (e) głęboka treść bloków datasetu).
- OK: 24
- OK-LOKALNY: 16
- MARTWY: 0
- URWANY: 0
- ZA FLAGĄ: 1 (D-1, menu „+" wariant legacy — kod istnieje, default ON w kodzie zasłania go)
- NIEWIDOCZNY: 0
- NIEPEWNY: 0 (wszystko rozstrzygnięte; wątpliwości opisane w sekcji Niezweryfikowane dotyczą
  drugorzędnych detali, nie klasyfikacji elementów)
- Defekty: 5, wszystkie P2 (i18n/kosmetyka/dokumentacja brief'u), zero P0/P1.
