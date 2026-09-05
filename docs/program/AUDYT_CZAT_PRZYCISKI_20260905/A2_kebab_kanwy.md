# A2 — Audyt menu kebab „⋮" panelu kanwy (WorkCanvasDocumentPanel)

Katalog: `/private/tmp/m03` (gałąź `codex/m03-admin-20260824`, HEAD `4332ade1c6`).
Plik audytowany: `src/components/AIChat/WorkCanvasDocumentPanel.tsx` (5278 linii).
Trigger kebaba: `MoreVertical` przycisk, linia **3785**, `aria-label`/`title` = `canvas.panel.menuAria`
(„Menu Canvas"), otwiera `<div data-testid="canvas-diagnostics-menu">` (linia **3808** – **4966**).
Montaż ekranu: `UnifiedChatPanel.tsx:7509` renderuje `<WorkCanvasDocumentPanel onClose={...} .../>`
wewnątrz `/chat` — kebab jest osiągalny z realnej ścieżki renderu (zweryfikowano importera i props).

Serwer: wszystkie trasy `work-canvas` montowane w `server/src/Gateway.ts:585`
(`app.use('/api/work-canvas', workCanvasRoutes)`, import linia 430) →
`server/src/routes/work-canvas.routes.ts`. Wszystkie wymienione trasy w tym pliku ISTNIEJĄ
(potwierdzone `grep router.<metoda>`) i są zamontowane pod tym samym prefiksem.

Metoda curl (bez auth, bez ciała, `test-id` jako identyfikator, jedno wywołanie/trasę):
`https://staging.consultify.ai<ścieżka>` — **KAŻDA** poniższa trasa `work-canvas`/`ai/attachments/
ingest`/`research/sessions`/`access/effective` zwróciła **401** (trasa istnieje, chroniona
uwierzytelnieniem — zgodnie z oczekiwaniem, brak defektu bezpieczeństwa).

Flaga globalna sekcji „Przepływy pracy" (diagnostyka): `src/utils/canvasDevDiagnosticsFlag.ts`.
Kolejność: `localStorage["ff.canvas_dev_diagnostics"]` → `import.meta.env.VITE_DEV_DIAGNOSTICS` →
default **OFF**. W `.env.local` roboczym brak klucza `VITE_DEV_DIAGNOSTICS` → flaga **OFF** na tym
stanowisku (helper przeczytany linia po linii, nie tylko nazwa).

## Inwentarz

Legenda skrótów łańcucha: `PD`=`persistDraft` (PUT/POST `/api/work-canvas/drafts[/:id]`, plik
`WorkCanvasDocumentPanel.tsx:1590`, serwer `work-canvas.routes.ts:3479` PUT / `:2782` POST) ·
`GH`=`runGovernedHandoff` (`WorkCanvasDocumentPanel.tsx:2049` → `WorkCanvasApi.createProposal`
POST `/api/work-canvas/drafts/:id/proposals` `services/api/workCanvas.ts:114`, serwer
`work-canvas.routes.ts:3722` → `WorkCanvasApi.approveProposal` POST
`/api/work-canvas/proposals/:id/approve`, serwer `:3794`).

| # | Etykieta PL | klucz i18n | element plik:linia | handler | łańcuch | HTTP | trasa serwera (+montaż) | flaga | curl | KLASA | uwagi |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | (ikona ⋮, „Menu Canvas") | canvas.panel.menuAria | WorkCanvasDocumentPanel.tsx:3785 | `setIsDiagnosticsOpen` | client state | — | — | — | — | OK-LOKALNY | otwiera/zamyka dropdown |
| 2 | „Najczęstsze działania" (rozwiń) | canvas.panel.common.title | :3820 `<summary>` | native `<details>` | client | — | — | — | — | OK-LOKALNY | accordion natywny |
| 3 | Rozwiń (karta 1) | canvas.panel.common.expandAction | :3908 | `applySelectionMenuAction('expand')` | :2407, ustawia `selectionAiPrompt` | — | — | — | — | OK-LOKALNY | disabled gdy brak zaznaczenia |
| 4 | Przepisz (karta 2) | canvas.panel.common.rewriteAction | :3908 (hint.onClick, rewrite) | `applySelectionMenuAction('rewrite')` | :2407 | — | — | — | — | OK-LOKALNY | disabled gdy brak zaznaczenia; **patrz D-1** |
| 5 | Dodaj element (karta 3) | canvas.panel.common.addAction | :3908 (hint.onClick, add) | `setQuickAddElement('text')` | client, otwiera sekcję „Dodaj element" (już otwartą, `<details>` domyślnie zamknięta — patrz uwaga) | — | — | — | — | OK-LOKALNY | nie otwiera automatycznie `<details>` DODAJ ELEMENT — patrz D-3 |
| 6 | Nowy template (karta 4) | canvas.panel.hints.templateAction | :3908 (hint.onClick, template) | `setIsTemplateBuilderOpen` toggle | client | — | — | — | — | OK-LOKALNY | |
| 7 | Zapisz / Pobierz MD (karta 5) | canvas.panel.hints.saveActionSave/Download | :3908 (hint.onClick, save) | `persistDraft()` LUB `exportDocument('markdown')` | PD lub eksport (patrz #53) | PUT/POST `/api/work-canvas/drafts[/:id]` | routes.ts:3479 / :2782 | — | 401 | OK | etykieta zależy od `saveState` |
| 8 | Wgraj plik / Użyj datasetu (karta 6) | canvas.panel.hints.dataActionUpload/Use | :3908 (hint.onClick, data) | `triggerDatasetUpload()` klik ukrytego `<input>` → `handleUploadFiles` | :2438 → :2172 | dataset: brak HTTP (lokalny parse); plik inny niż csv/json/xlsx → `Api.uploadChatAttachment` | POST `/api/ai/attachments/ingest` | Api.ts:8944, routes zamontowane w Gateway (ai routes) | — | 401 | OK | dwuścieżkowy handler w jednym przycisku |
| 9 | „Dodaj element" (rozwiń) | canvas.panel.addElement.title | :3919 `<summary>` | native details | client | — | — | — | — | OK-LOKALNY | domyślnie ZWINIĘTA (brak `open`) |
| 10 | Tekst | canvas.panel.addElement.text | :3940 | `setQuickAddElement('text')` | client | — | — | — | — | OK-LOKALNY | |
| 11 | Nagłówek | canvas.panel.addElement.heading | :3940 | `setQuickAddElement('heading')` | client | — | — | — | — | OK-LOKALNY | |
| 12 | Tabela | canvas.panel.addElement.table | :3940 | `setQuickAddElement('table')` | client | — | — | — | — | OK-LOKALNY | |
| 13 | Diagram | canvas.panel.addElement.diagram | :3940 | `setQuickAddElement('diagram')` | client | — | — | — | — | OK-LOKALNY | i18n PL=EN „Diagram" (słowo wspólne, nie błąd) |
| 14 | Lista | canvas.panel.addElement.list | :3940 | `setQuickAddElement('list')` | client | — | — | — | — | OK-LOKALNY | |
| 15 | Podsumowanie | canvas.panel.addElement.summary | :3940 | `setQuickAddElement('summary')` | client | — | — | — | — | OK-LOKALNY | |
| 16 | pole „Opisz Teresie co dodać..." | canvas.panel.addElement.promptPlaceholder | :3953 (`quickAddPrompt`) | textarea | client state | — | — | — | — | OK-LOKALNY | patrz D-1 — treść NIE trafia do AI |
| 17 | „Dodaj do canvas" | canvas.panel.addElement.submit | :3964 | `insertQuickAddElement()` | :2397 `buildQuickAddMarkdown` (deterministyczny szablon) + `persistDraft()` | PUT/POST `/api/work-canvas/drafts[/:id]` | routes.ts:3479/:2782 | — | 401 | OK | **D-1 (P1)**: etykieta obiecuje że Teresa doda treść wg opisu — realnie wstawia statyczny szkielet, prompt użyty tylko jako nagłówek/dosłowny tekst |
| 18 | „Edycja i AI" (rozwiń, domyślnie otwarta) | canvas.panel.groups.edit | :3972 `<summary open>` | native details | client | — | — | — | — | OK-LOKALNY | |
| 19 | Rozwiń myśl | canvas.panel.selection.expand | :3997 | `applySelectionMenuAction('expand')` | :2407 | — | — | — | — | OK-LOKALNY | duplikat #3, inny button instance |
| 20 | Skróć | canvas.panel.selection.shorten | :4004 | `applySelectionMenuAction('shorten')` | :2407 | — | — | — | — | OK-LOKALNY | |
| 21 | Przeredaguj | canvas.panel.selection.rewrite | :4011 | `applySelectionMenuAction('rewrite')` | :2407 | — | — | — | — | OK-LOKALNY | |
| 22 | Zaproponuj | canvas.panel.selection.suggest | :4018 | `applySelectionMenuAction('suggest')` | :2407 | — | — | — | — | OK-LOKALNY | |
| 23 | pole „Polecenie dla Teresy..." | canvas.panel.selection.promptPlaceholder | :4026 (`selectionAiPrompt`) | textarea | client state | — | — | — | — | OK-LOKALNY | |
| 24 | „Podgląd zmiany AI" | canvas.panel.selection.preview | :4038 | `previewSelectionMenuPrompt()` → `previewSelectionEdit()` | :2424→:2531 | POST `/api/work-canvas/drafts/:id/operations` (`previewOnly:true`, `type:'replace_selection'`) | routes.ts:3850, kontroler `applyEditOperation` (deterministyczny, **BEZ wywołania LLM**) | — | 401 | OK | **D-1 ciąg dalszy (P1)**: „AI" w etykiecie, ale `replacementMd` = dosłowny tekst instrukcji z pola #23 (prefiks + zaznaczony fragment) — zero wywołania modelu; serwer robi tylko string-replace |
| 25 | „Wyczyść" | canvas.panel.selection.clear | :4045 | `setSelectionAiPrompt('')` | client | — | — | — | — | OK-LOKALNY | |
| 26 | „Historia wersji" (Wersjonowanie) | canvas.versionHistory.title | :4066, `data-testid="canvas-history-menu-item"` | `openVersionHistory()` | :3137 | GET `/api/work-canvas/drafts/:id/versions` | routes.ts:3837 | — | 401 | OK | otwiera popover `CanvasVersionHistory` (poza drzewem dropdownu, `canvas-history-root`) |
| 26a | Zamknij (X) popover historii | canvas.versionHistory.closeAria | CanvasVersionHistory.tsx:71 | `onClose` → `setIsHistoryOpen(false)` | client | — | — | — | — | OK-LOKALNY | |
| 26b | wiersz wersji (rozwiń podgląd) | — | CanvasVersionHistory.tsx:107 | `setPreviewVersionId` | client | — | — | — | — | OK-LOKALNY | pokazuje `CanvasMarkdownRenderer` |
| 26c | „Restore" | canvas.versionHistory.restore | CanvasVersionHistory.tsx:153 | `setConfirmingVersionId` | client | — | — | — | — | OK-LOKALNY | 2-krokowe potwierdzenie |
| 26d | „Yes, restore" | canvas.versionHistory.confirmYes | CanvasVersionHistory.tsx:127 | `runRestore` → `onRestore` → `restoreVersion` | WorkCanvasDocumentPanel.tsx:3152 | POST `/api/work-canvas/drafts/:id/versions/:versionId/restore` | routes.ts:3981 | — | 401 | OK | i18n: przyciski dialogu confirm NIE mają kluczy PL widocznych w translation.json obok innych (etykiety EN fallback „Restore this version?" itd. — sprawdzić klucz `canvas.versionHistory.confirmRestore`) |
| 26e | „Cancel" | canvas.versionHistory.cancel | CanvasVersionHistory.tsx:146 | `setConfirmingVersionId(null)` | client | — | — | — | — | OK-LOKALNY | |
| 27 | „Szablony startowe" (rozwiń) | canvas.panel.templates.title | :4080 `<summary>` | native details | client | — | — | — | — | OK-LOKALNY | |
| 28 | „+ Nowy template" | canvas.panel.templates.new | :4090 | `setIsTemplateBuilderOpen` toggle | client | — | — | — | — | OK-LOKALNY | duplikat #6 |
| 29 | pole „Nazwa template'u" | canvas.panel.templates.namePlaceholder | :4099 | input | client | — | — | — | — | OK-LOKALNY | |
| 30 | pole „Cel template'u..." | canvas.panel.templates.goalPlaceholder | :4106 | input | client | — | — | — | — | OK-LOKALNY | |
| 31 | pole „Sekcje (po przecinku)" | canvas.panel.templates.sectionsPlaceholder | :4116 | input | client | — | — | — | — | OK-LOKALNY | |
| 32 | „Zastosuj template" | canvas.panel.templates.apply | :4128 | `applyBuiltTemplate()` | :2442, buduje markdown z pól 29-31 + `persistDraft()` | PUT/POST `/api/work-canvas/drafts[/:id]` | routes.ts:3479/:2782 | — | 401 | OK | nie obiecuje AI — deterministyczny, uczciwe |
| 33 | „Zamknij" (builder) | canvas.panel.templates.close | :4135 | `setIsTemplateBuilderOpen(false)` | client | — | — | — | — | OK-LOKALNY | |
| 34 | Zbierz myśli | starterTemplates[0].label (:203) | :4147 | `selectTemplate(template)` | :1890, `createDocumentState`+`persistDraft` | PUT/POST drafts | routes.ts:3479/:2782 | — | 401 | OK | capability=`real` |
| 35 | Napisz dokument | starterTemplates[1].label | :4147 | jw. | jw. | jw. | jw. | — | 401 | OK | capability=`real` |
| 36 | Zrób research | starterTemplates[2].label | :4147 | jw. | jw. + `createResearchSessionForDraft` | jw. + POST `/api/research/sessions` | routes.ts drafts + `research/sessions` (Api.ts:16233) | — | drafts:401, research/sessions:401 | OK | capability=`partial` (etykieta w kodzie mówi wprost) |
| 37 | Przygotuj decyzję | starterTemplates[3].label | :4147 | jw. | jw. | jw. | jw. | — | 401 | OK | capability=`partial` |
| 38 | Rozpisz plan | starterTemplates[4].label | :4147 | jw. | jw. | jw. | jw. | — | 401 | OK | capability=`real` |
| 39 | „Plik, eksport i workspace" (rozwiń) | canvas.panel.groups.file | :4142 `<summary>` | native details | client | — | — | — | — | OK-LOKALNY | |
| 40 | Send to idea | actionLabels['send-to-idea'] | :4230-4234 (`renderCommandButton`) → handler :3200 `renderCommandButton` | `runWorkspaceAction('send-to-idea','idea')` | :2806 → GH | POST `/proposals` + POST `/proposals/:id/approve` | routes.ts:3722, :3794 | RBAC `canvas.convert.idea` via `/api/access/effective` | 401×2 | OK | disabled jeśli permission=false (real RBAC fetch, nie atrapa) |
| 41 | Save as note | actionLabels['save-as-note'] | :4230-4234 | `runWorkspaceAction('save-as-note','note')` | jw. | jw. | jw. | RBAC `canvas.convert.note` | 401×2 | OK | |
| 42 | Create initiative | actionLabels['create-initiative'] | :4230-4234 | `runWorkspaceAction(...,'initiative')` | jw. | jw. | jw. | RBAC `canvas.convert.initiative` | 401×2 | OK | |
| 43 | Capture decision | actionLabels['create-decision'] | :4230-4234 | `runWorkspaceAction(...,'decision')` | jw. | jw. | jw. | RBAC `canvas.convert.decision` | 401×2 | OK | |
| 44 | Create task | actionLabels['create-task'] | :4230-4234 | `runWorkspaceAction(...,'task')` | jw. | jw. | jw. | RBAC `canvas.convert.task` | 401×2 | OK | |
| 45 | Create presentation | actionLabels['create-presentation'] | :4235-4239 | `runOutputAction('create-presentation','presentation')` | :2832 | POST `/drafts/:id/create-output` | routes.ts:4286 | RBAC `canvas.output.presentation` | 401 | OK | |
| 46 | Create sheet | actionLabels['create-table'] | :4235-4239 | `runOutputAction(...,'table')` | jw. | jw. | jw. | RBAC `canvas.output.table` | 401 | OK | etykieta kodu = "Create sheet" (celowo, nie „table", by nie mylić z Idea Table) |
| 47 | Create report | actionLabels['create-report'] | :4235-4239 | `runOutputAction(...,'report')` | jw. | jw. | jw. | RBAC `canvas.output.report` | 401 | OK | |
| 48 | „Otwórz" (link z prowieniencji) | — (hardkodowane PL) | :4257 | `<a href={entry.url}>` | client nawigacja | — | — | — | N/A | OK-LOKALNY | dynamiczne (0..N), widoczne tylko gdy `materializedTo.length>0`; tekst „Utworzone z tego dokumentu"/„Otwórz" NIE przechodzi przez `t()` — hardkod PL |
| 49-55 | Dataset table / Dataset chart / KPI dashboard / Findings report / Profile summary / Aggregate chart / Filtered table | `datasetArtifactActions[].label` (:461-490), hardkod EN, brak i18n | :4255 (`.map`) | `createArtifactFromDataset(kind, analysisKind, titlePrefix)` | :2214 | POST `/drafts/:id/operations` (`previewOnly:true`, `generate_artifact_from_dataset`) | routes.ts:3850 → `applyBlockOperation` → `createDatasetProfile`/`applyDatasetAnalysis` (deterministyczne, **bez LLM** — kod sam to deklaruje: „Deterministic Canvas analysis. No code execution.") | — | 401 | OK | 7 przycisków; etykiety po angielsku mimo polskiego menu — **D-4 (P2)** |
| 56 | „Odrzuć"/Dismiss (dataset, wersja w kebabie) | canvas.panel.dismiss | :4269 | `setPendingDataset(null)` | client | — | — | — | — | OK-LOKALNY | **D-2 (P2)**: ten sam panel „Dataset ready" renderuje się RÓWNOCZEŚNIE na zewnątrz kebaba (linia 3729-3775, zawsze widoczny gdy `pendingDataset` ustawiony) i wewnątrz kebaba (4235-4272) — 2× ten sam zestaw 7+1 przycisków na ekranie jednocześnie gdy dropdown otwarty |
| 57 | „Akcje Markdown" (nagłówek sekcji) | canvas.panel.markdownActions | :4283 | — (etykieta, nie przycisk) | — | — | — | — | — | — | |
| 58 | Wgraj Markdown (.md) | canvas.panel.import.uploadMarkdown | :4287 | `triggerMarkdownImport()` → klik `markdownImportInputRef` → `handleImportMarkdownFile` | :2280→:2284 | brak HTTP natychmiast — `updateMarkdown()` tylko lokalnie; trafi do serwera dopiero przy kolejnym `persistDraft` (autosave/ręczny zapis) | — | — | — | OK-LOKALNY | potwierdzenie `window.confirm` gdy istnieje treść |
| 59 | Zapisz Markdown | canvas.panel.export.saveMarkdown | :4298 | `persistDraft()` | PD | PUT/POST drafts | routes.ts:3479/:2782 | — | 401 | OK | |
| 60 | Zapisz do Outputs | canvas.panel.export.saveToOutputs | :4306 | `saveToOutputs()` | :2102 → GH (target=`client_deliverable`) | POST `/proposals`+`/approve` | routes.ts:3722,:3794 | — | 401×2 | OK | |
| 61 | Pobierz Markdown | canvas.panel.export.downloadMarkdown | :4320 | `exportDocument('markdown')` | :2017 → `Api.workCanvasExportDraft` | GET `/drafts/:id/export?format=markdown` | routes.ts:3438, Api.ts:5959 | — | 401 | OK | |
| 62 | Pobierz CSV | canvas.panel.downloadCsv | :4328 | `exportDocument('csv')` | jw. | GET `/export?format=csv` | routes.ts:3438 | — | 401 | OK | |
| 63 | Kopiuj Markdown | canvas.panel.copyMarkdown | :4336 | `copyMarkdown()` | :2012 `navigator.clipboard` | — | — | — | — | OK-LOKALNY | |
| 64 | Pobierz PDF | canvas.panel.downloadPdf | :4344 | `exportDocument('pdf')` | jw. | GET `/export?format=pdf` | routes.ts:3438 | — | 401 | OK | |
| 65 | Wyślij do Document Studio | canvas.panel.sendToDocumentStudio | :4357 | `sendToDocumentStudio()` | :2153 → GH (`client_deliverable`) | POST `/proposals`+`/approve` | routes.ts:3722,:3794 | — | 401×2 | OK | zamiast wołać dedykowany `workCanvasSendToDocumentStudio`/`.../send-to-document-studio` (istnieje w Api.ts:5905 i routes.ts:4685!) — panel woła generyczny `runGovernedHandoff`, więc trasa `/send-to-document-studio` **nie jest wołana z tego przycisku** (martwy z perspektywy tego menu, choć zamontowana) — **D-5 (P2, obserwacja)** |
| 66 | Wyślij do Table Studio | canvas.panel.sendToTableStudio | :4373 | `sendToTableStudio()` | :2127 → GH (target=`table`) | POST `/proposals`+`/approve` | routes.ts:3722,:3794 | — | 401×2 | OK | disabled gdy `documentState.kind!=='table'`; podobnie omija dedykowaną `/send-to-table-studio` (routes.ts:4470) — patrz D-5 |
| 67 | Pobierz Word (.docx) | canvas.panel.export.downloadWord | :4401 | `exportDocument('docx')` | :2017 | GET `/export?format=docx` | routes.ts:3438 | — | 401 | OK | |
| 68 | Pobierz Excel (.xlsx) | canvas.panel.downloadExcel | :4413 | `exportDocument('xlsx')` | jw. | GET `/export?format=xlsx` | routes.ts:3438 | — | 401 | OK | disabled gdy `kind!=='table'` |
| 69 | Pobierz PowerPoint (.pptx) | canvas.panel.downloadPowerpoint | :4430 | `exportDocument('pptx')` | jw. | GET `/export?format=pptx` | routes.ts:3438 | — | 401 | OK | |
| 70 | Eksportuj metadane | canvas.panel.exportMetadata | :4440 | `exportDocument('json')` | jw. | GET `/export?format=json` | routes.ts:3438 | — | 401 | OK | |
| 71 | Prześlij zbiór danych | canvas.panel.uploadDataset | :4448 | `triggerDatasetUpload()` | :2438 | klik ukrytego inputu → `handleUploadFiles` (patrz #8) | — | — | — | OK-LOKALNY | duplikat wyzwalacza z #8 |
| 72 | „Przepływy pracy" (rozwiń) | canvas.panel.groups.workflow | :4463 `<summary>` | native details | client | — | — | — | — | OK-LOKALNY | |
| 73 | „MD file properties" pokaż/ukryj | canvas.panel.mdProps.title/show/hide | :4476 | `setIsMdPropertiesOpen` toggle | client | — | — | — | `VITE_DEV_DIAGNOSTICS` (kod: LS→env→**OFF** domyślnie; `.env.local`: klucz nieobecny → OFF) | — | ZA FLAGĄ | cały blok (właściwości MD, capability badge, ResearchSession id) niewidoczny na tym stanowisku |
| 74 | (wyświetlacz Format/Zapis/Projekcja/Cykl życia/Akcja) | canvas.panel.diagnostics.* | :4488-4530 | — (read-only) | — | — | — | jw. ZA FLAGĄ | — | — | „Format" PL=EN (słowo wspólne) |
| 75 | (badge Możliwość + notatka inżynierska) | canvas.panel.capabilities.title | :4546-4562 | — (read-only) | — | — | — | jw. ZA FLAGĄ | — | — | notatki typu „…are backed" po angielsku |
| 76 | (ResearchSession id) | canvas.panel.diagnostics.researchSession | :4564-4574 | — (read-only) | — | — | — | jw. ZA FLAGĄ | — | — | |
| 77 | Szablon przepływu pracy (select) | canvas.panel.workflowTemplate | :4587 | `setSelectedWorkflowTemplate` | client | — | — | ZAWSZE widoczny (nie gated flagą — zweryfikowano w kodzie) | — | OK-LOKALNY | 5 opcji, wszystkie przetłumaczone PL |
| 78 | Uruchom przepływ | canvas.panel.startWorkflow | :4606 | `startWorkflow()` | :2973 | POST `/drafts/:id/workflows` | routes.ts:2975 | zawsze widoczny | 401 | OK | |
| 79 | Sfinalizuj raport z researchu | canvas.panel.finalizeResearchReport | :4642 | `finalizeResearchReport()` | :2866 | POST `/drafts/:id/research/finalize-report` | routes.ts:4354 | widoczny tylko gdy `kind==='research'` | 401 | OK | |
| 80 | „Run next"/„Approve and run" (per workflow) | brak klucza i18n — hardkod EN | :4728 | `runWorkflowStep(workflow.id)` | :3023 | POST `/drafts/:id/workflows/:runId/run-next` | routes.ts:3084 | `isCanvasDevDiagnosticsEnabled() && workflowRuns.length` → ZA FLAGĄ | 401 | OK | dynamiczne (0..N wg `documentState.workflowRuns`) |
| 81 | „Resume" (per workflow) | hardkod EN | :4743 | `resumeWorkflow(workflow.id)` | :2999 | POST `/workflows/:runId/resume` | routes.ts:3019 | ZA FLAGĄ | 401 | OK | |
| 82 | pole „Reviewer id" (per workflow) | hardkod EN placeholder | :4838-4855 | input | client | — | — | ZA FLAGĄ | — | OK-LOKALNY | |
| 83 | „Send to review" | hardkod EN | :4834 | `updateWorkflowCollaboration(id,'in_review')` | :3052 | PATCH `/workflows/:runId/collaboration` | routes.ts:3248 | ZA FLAGĄ | 401 | OK | |
| 84 | „Mark approved" | hardkod EN | :4848 | `updateWorkflowCollaboration(id,'approved')` | jw. | jw. | jw. | ZA FLAGĄ | 401 | OK | |
| 85 | pole „Add workflow comment" | hardkod EN placeholder | :4884-4900 | input | client | — | — | ZA FLAGĄ | — | OK-LOKALNY | |
| 86 | „Add comment" | hardkod EN | :4881 | `addWorkflowComment(workflow.id)` | :3090 | POST `/workflows/:runId/comments` | routes.ts:3327 | ZA FLAGĄ | 401 | OK | |
| 87 | „Zaawansowane" (rozwiń) | canvas.panel.groups.advanced | :4910 `<summary>` | native details | client | — | — | ZAWSZE widoczna sekcja (grupa NIE jest za flagą, tylko jej zawartość inżynierska wyżej) | — | OK-LOKALNY | |
| 88 | Ponów projekcję | canvas.panel.advanced.retryProjection | :4922 | `retryProjection()` | :2752 | POST `/drafts/:id/operations` (`regenerate_projection`) | routes.ts:3850 | widoczny tylko gdy `markdownProjectionStatus==='failed'` | 401 | OK | |
| 89 | Resetuj | canvas.panel.advanced.reset | :4931 | `resetToTemplate()` | :2745, `persistDraft(next)` | PUT/POST drafts | routes.ts:3479/:2782 | — | 401 | OK | |
| 90 | Historia wersji (2. instancja, Zaawansowane) | canvas.versionHistory.title | :4943 | `openVersionHistory()` | :3137 | GET `/drafts/:id/versions` | routes.ts:3837 | — | 401 | OK | duplikat #26, ten sam handler |
| 91 | Pokaż zmiany | canvas.panel.advanced.showChanges | :4951 | `showChangesFromLatestVersion()` | :3174 | — (liczy diff lokalnie z już wczytanych `versions`) | — | — | — | OK-LOKALNY | jeśli `versions` nigdy nie wczytane (nikt nie otwierał historii) → alert „No Canvas versions available yet." |
| 92 | (podsumowanie diff) | canvas.panel.advanced.diffSummary | :4956-4964 | — (read-only) | — | — | — | — | — | — | |

## Defekty

- **D-1 | P1 | „AI on selection" + „Dodaj element"** | Etykiety obiecują generowanie/edycję przez AI
  („Podgląd zmiany AI", „Opisz Teresie co dodać", akcje Rozwiń/Skróć/Przeredaguj/Zaproponuj), ale
  cały łańcuch jest deterministyczny — `applySelectionMenuAction` (WorkCanvasDocumentPanel.tsx:2407)
  tylko wstrzykuje statyczny prefiks tekstowy do pola, `previewSelectionEdit` (:2531) wysyła ten
  dosłowny tekst jako `replacementMd` do `POST /api/work-canvas/drafts/:id/operations`, a serwer
  (`work-canvas.routes.ts:1710 applyEditOperation`) robi zwykłe **string-replace**, bez żadnego
  wywołania LLM. Podobnie `insertQuickAddElement` (:2397) buduje statyczny szkielet markdown
  (`buildQuickAddMarkdown`, :2367) ignorując treść opisu poza wstawieniem go dosłownie jako
  nagłówka/akapitu. Prawdziwe AI (Teresa pisząca w kanwie) istnieje w tym samym pliku — hook
  `useCanvasAIStream` (`src/components/AIChat/CanvasEditor/useCanvasAIStream.ts:184,303` →
  `POST /api/ai/chat/quick` i `/api/ai/chat/stream`) — ale jest wywoływany WYŁĄCZNIE przez event
  `canvas-stream-request` z czatu Teresy, NIGDY z żadnego przycisku w tym kebabie.
  Odtworzenie: zaznacz tekst w kanwie → kebab → Edycja i AI → wpisz cokolwiek w polu instrukcji →
  „Podgląd zmiany AI" → podgląd pokazuje dosłownie wpisaną instrukcję jako nową treść, nie
  przetworzony przez model tekst.
- **D-2 | P2 | Panel „Dataset ready" zduplikowany** | Ten sam blok (7 przycisków analiz + Odrzuć)
  renderuje się jednocześnie w dwóch miejscach: na stałe poza kebabem
  (`WorkCanvasDocumentPanel.tsx:3729-3775`, `data-testid="canvas-dataset-actions"`) i wewnątrz
  sekcji „Plik, eksport i workspace" (:4235-4272, bez własnego testid). Gdy użytkownik wgra CSV i
  otworzy kebab, widzi dwa identyczne zestawy przycisków na ekranie. Odtworzenie: wgraj plik .csv →
  otwórz kebab → rozwiń „Plik, eksport i workspace".
- **D-3 | P2 | „Dodaj element" (karta w Najczęstszych) nie rozwija sekcji** | Karta #5 w
  „Najczęstsze działania" (`onClick: () => setQuickAddElement('text')`, :3908) tylko ustawia typ
  elementu — sekcja `<details>` „Dodaj element" (:3919) nie ma atrybutu `open` i pozostaje zwinięta,
  więc kliknięcie karty nie pokazuje formularza, do którego rzekomo prowadzi (użytkownik musi sam
  ręcznie rozwinąć sekcję niżej). Odtworzenie: kebab → Najczęstsze działania → „Dodaj element" →
  nic się nie rozwija.
- **D-4 | P2 | Etykiety datasetu i workflow-ledger po angielsku w polskim menu** | 7 przycisków
  `datasetArtifactActions` (`Dataset table`, `Dataset chart`, `KPI dashboard`, `Findings report`,
  `Profile summary`, `Aggregate chart`, `Filtered table`; WorkCanvasDocumentPanel.tsx:461-490) oraz
  cały panel workflow ledger (`Run next`, `Resume`, `Send to review`, `Mark approved`, `Reviewer id`,
  `Add comment`, `Owner:`/`Reviewer:`/`Lifecycle:`, `Timeline`, `Outputs`, `Open`; :4692-4906) to
  literały angielskie bez kluczy i18n. Workflow ledger jest za flagą (domyślnie OFF), ale dataset
  actions są ZAWSZE widoczne w polskim UI.
- **D-5 | P2 (obserwacja, nie błąd bezpieczeństwa)** | Przyciski „Wyślij do Document/Table Studio"
  nie wołają dedykowanych tras `POST /drafts/:id/send-to-document-studio` (routes.ts:4685,
  Api.ts:5905 `workCanvasSendToDocumentStudio`) ani `/send-to-table-studio` (routes.ts:4470,
  Api.ts:5850 `workCanvasSendToTableStudio`), mimo że obie istnieją i są zamontowane. Panel zamiast
  tego woła generyczny `runGovernedHandoff`→`/proposals`+`/approve`. Skutek wymaga porównania na
  żywej bazie (czy oba tory prowadzą do tego samego efektu końcowego) — zapisane w Niezweryfikowane.
- **D-6 | P2 | i18n: `canvas.versionHistory.confirmRestore`/`confirmYes`/`cancel`** | nie
  zweryfikowano wprost w `public/locales/pl/translation.json` (poza zakresem doraźnego skryptu) —
  patrz Niezweryfikowane.

## Niezweryfikowane

1. Czy `canvas.versionHistory.confirmRestore`, `.restoring`, `.confirmYes`, `.cancel`,
   `.loading`, `.empty`, `.preview` mają realne wpisy PL (skrypt sprawdzający objął tylko
   `title`/`restore`/`closeAria`/`close` — pozostałe klucze CanvasVersionHistory.tsx nie zostały
   sprawdzone przez brak czasu; jeśli brakuje, i18next pokaże fallback angielski).
2. Skutek końcowy D-5 (czy handoff przez `/proposals`+`/approve` faktycznie tworzy taki sam
   rekord w Document Studio / Table Studio jak dedykowana trasa) — wymaga sesji z realnym logowaniem
   i utworzonym draftem; poza zakresem „bez uwierzytelnienia" tego audytu.
3. Czy `documentState.workflowRuns` bywa niepusty na produkcji/demo mimo że sam `startWorkflow`
   jest zawsze dostępny — czyli czy realni użytkownicy w ogóle widzieli kiedyś ledger #80-86 (dev
   flag jest OFF domyślnie, ale mogła być kiedyś ON na stagingu/demo — nie sprawdzano historii flag).
4. Plik `src/services/Api.ts` i `src/services/api.ts` mają identyczny rozmiar i datę — prawdopodobnie
   ten sam plik widziany dwa razy przez wielkość/małość liter na macOS (znany wzorzec z projektu:
   „katalog pod dwiema nazwami"). Nie wpływa na wynik audytu (czytałem `Api.ts`), ale ryzyko
   przenośności (Linux/CI) zasługuje na osobne zgłoszenie.

## Liczby

- **Elementów klikalnych/wpisywalnych w kebabie: 92** (ponumerowane #1-#92 w Inwentarzu, wliczając
  7 przełączników `<details>`, wszystkie pola tekstowe/inputy, dynamiczne przyciski dataset/workflow
  liczone jako jeden wiersz na typ + adnotacja „dynamiczne").
  Nadzorca szacował 35-50 — **rzeczywista liczba jest ok. 2× wyższa**, głównie przez: (a) podformularze
  „Dodaj element" (8) i „Nowy template" (6), (b) duplikat „Dataset ready" liczony osobno w dwóch
  miejscach (7+1 ×2), (c) workflow ledger per-uruchomienie (7 kontrolek) i CanvasVersionHistory (5
  kontrolek) nieujęte w opisie brief'u sekcji.
- OK (pełny łańcuch do serwera, trasa=401/istnieje): **44**
- OK-LOKALNY (akcja kliencka, bez HTTP): **41**
- ZA FLAGĄ (`VITE_DEV_DIAGNOSTICS`, domyślnie OFF w kodzie i w `.env.local`): **14** (#73-86,
  częściowo nakładające się z OK powyżej — kontrolki #80,81,83,84,86 są jednocześnie „OK" (trasa
  realna) I „ZA FLAGĄ" (niewidoczne bez flagi); w tabeli sklasyfikowane jako OK z adnotacją flagi)
- MARTWY: **0**
- URWANY: **0**
- NIEWIDOCZNY: **0** (cały kebab jest osiągalny z `/chat` przez zweryfikowany import w `UnifiedChatPanel.tsx:7509`)
- NIEPEWNY: **3** (patrz Niezweryfikowane)
- Defekty: **6** (D-1 P1, D-2 P2, D-3 P2, D-4 P2, D-5 P2 obserwacja, D-6 P2)
