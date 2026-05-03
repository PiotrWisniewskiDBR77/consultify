# Canvas Source Of Truth

Status: `DRAFT / PRODUCT SSOT`
Owner: Product + Engineering
Created: 2026-05-02
Scope: Consultify Canvas, czyli prawe okno robocze uruchamiane z chatu oraz docelowy runtime pracy nad dokumentami, research, artefaktami i decyzjami.

## 1. Cel dokumentu

Ten dokument jest jednym miejscem prawdy dla produktu `Canvas`.

Canvas nie jest kolejną osobną aplikacją, osobnym chatem ani przypadkowym panelem podglądu. Canvas ma być głównym miejscem pracy obok rozmowy z Teresą:

```text
lewa strona: istniejący chat / rozmowa z Teresą
prawa strona: Canvas / work area / dokumenty / research / artefakty
```

Docelowo Canvas ma być wymarzonym miejscem pracy dla osoby biznesowej: miejscem do zbierania myśli, budowania pomysłów, pisania dokumentów, startowania prezentacji, prowadzenia market research, konsultowania decyzji, tworzenia briefów, planów, notatek, raportów i materiałów wykonawczych.

Produktowa ambicja:

```text
od rozmowy -> do ustrukturyzowanej pracy -> do artefaktu -> do decyzji / inicjatywy / taska / deliverable
```

## 2. Hierarchia źródeł

Ten dokument konsoliduje:

- `testy_antygravity/acceptance-matrices/v10-expanded-canvas.md`
- `testy_antygravity/test-packs/v10-expanded-canvas-gate.md`
- `UI_UX_SOURCE_OF_TRUTH.md`
- `consultify/docs/AI_dev_fin.md`
- `consultify/docs/ui-standards/CONSULTIFY_UI_UX_GOLDEN_STANDARD.md`
- `consultify/docs/product/CANVAS_OS_CONTRACT_FREEZE.md`
- `consultify/docs/product/WORKSTATION_CANVAS_FINAL_MASTER_PLAN_2026-03-16.md`
- `consultify/docs/product/WORKSTATION_CANVAS_RECOMMENDED_FEATURES_2026-03-16.md`
- `consultify/docs/product/IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_CANON.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_0_BASELINE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_1_PREMIUM_SURFACE_GATE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_2_ARTIFACT_BLOCK_CONTRACT_GATE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_3_NATIVE_BLOCK_RENDERERS_GATE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_4_BUSINESS_TRANSFORMATIONS_GATE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_5_RESEARCH_DECISION_WORKSPACE_GATE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_6_OUTPUT_LIBRARY_EXPORT_GATE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_7_DATA_ANALYSIS_DASHBOARD_GATE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_8_TEAM_WORKFLOW_RUNTIME_GATE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_9_DEEP_CONTEXT_MEMORY_GATE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_14_FINAL_ROLLOUT_GATE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_15_RENDERER_RUNTIME_GATE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_16_DATA_IMPORT_GATE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_17_WORKFLOW_COLLABORATION_GATE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_18_CONTROLLED_DATA_ANALYSIS_GATE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_19_MULTI_TEMPLATE_WORKFLOW_GATE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_20_WORKFLOW_TIMELINE_GATE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_21_WORKFLOW_CONTEXT_GATE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_22_WORKFLOW_OUTPUT_LEDGER_GATE.md`
- `consultify/docs/product/BUSINESS_WORK_CANVAS_STAGE_23_SAFE_WORKFLOW_CONTEXT_GATE.md`
- `consultify/docs/product/CANVAS_INTERACTIVITY_RESEARCH_AND_IMPLEMENTATION_BLUEPRINT.md`
- obecny kod: `WorkCanvasRuntime`, `UnifiedChatPanel`, `ResearchSessionsDock`, `Wave5ArtifactRuntimePanel`, `work-canvas.routes.ts`

Jeśli dokumenty są sprzeczne, obowiązuje kolejność:

1. `UI_UX_SOURCE_OF_TRUTH.md` dla invariantów UI, governance, traceability i severity.
2. `CONSULTIFY_UI_UX_GOLDEN_STANDARD.md` dla visual language i shelli.
3. `BUSINESS_WORK_CANVAS_CANON.md` dla strategicznego produktu, zakresu funkcjonalnego, UI/UX i technologii Business Work Canvas.
4. `BUSINESS_WORK_CANVAS_IMPLEMENTATION_PLAN.md` dla etapowego planu realizacji, quality gates i ochrony kontekstu w trakcie wdrożenia.
5. `BUSINESS_WORK_CANVAS_STAGE_0_BASELINE.md` dla zamrożonego baseline obecnego runtime przed dalszym wdrożeniem.
6. `BUSINESS_WORK_CANVAS_STAGE_1_PREMIUM_SURFACE_GATE.md` dla zamrożonego kontraktu premium work surface przed Stage 2.
7. `BUSINESS_WORK_CANVAS_STAGE_2_ARTIFACT_BLOCK_CONTRACT_GATE.md` dla zamrożonego kontraktu typed artifact blocks przed Stage 3.
8. `BUSINESS_WORK_CANVAS_STAGE_3_NATIVE_BLOCK_RENDERERS_GATE.md` dla zamrożonego kontraktu pierwszych natywnych rendererów bloków przed Stage 4.
9. `BUSINESS_WORK_CANVAS_STAGE_4_BUSINESS_TRANSFORMATIONS_GATE.md` dla zamrożonego kontraktu governed block-aware transformations przed Stage 5.
10. `BUSINESS_WORK_CANVAS_STAGE_5_RESEARCH_DECISION_WORKSPACE_GATE.md` dla zamrożonego kontraktu research/decision workspace przed Stage 6.
11. `BUSINESS_WORK_CANVAS_STAGE_6_OUTPUT_LIBRARY_EXPORT_GATE.md` dla zamrożonego kontraktu output metadata, lineage i export maturity przed Stage 7.
12. `BUSINESS_WORK_CANVAS_STAGE_7_DATA_ANALYSIS_DASHBOARD_GATE.md` dla zamrożonego kontraktu data analysis/dashboard runtime przed Stage 8.
13. `BUSINESS_WORK_CANVAS_STAGE_8_TEAM_WORKFLOW_RUNTIME_GATE.md` dla zamrożonego kontraktu workflow ledger przed Stage 9.
14. `BUSINESS_WORK_CANVAS_STAGE_9_DEEP_CONTEXT_MEMORY_GATE.md` dla zamrożonego kontraktu deep context/memory przed dalszym hardeningiem.
15. `BUSINESS_WORK_CANVAS_STAGE_14_FINAL_ROLLOUT_GATE.md` dla finalnego rollout gate po pięciu etapach domknięcia.
16. `BUSINESS_WORK_CANVAS_STAGE_15_RENDERER_RUNTIME_GATE.md` dla domknięcia runtime rendererów chart/diagram.
17. `BUSINESS_WORK_CANVAS_STAGE_16_DATA_IMPORT_GATE.md` dla dojrzałości importu danych XLSX.
18. `BUSINESS_WORK_CANVAS_STAGE_17_WORKFLOW_COLLABORATION_GATE.md` dla metadanych review/collaboration workflow.
19. `BUSINESS_WORK_CANVAS_STAGE_18_CONTROLLED_DATA_ANALYSIS_GATE.md` dla kontrolowanych transformacji analitycznych.
20. `BUSINESS_WORK_CANVAS_STAGE_19_MULTI_TEMPLATE_WORKFLOW_GATE.md` dla wieloszablonowych planów workflow.
21. `BUSINESS_WORK_CANVAS_STAGE_20_WORKFLOW_TIMELINE_GATE.md` dla audytowego timeline workflow.
22. `BUSINESS_WORK_CANVAS_STAGE_21_WORKFLOW_CONTEXT_GATE.md` dla integracji timeline workflow z kontekstem AI.
23. `BUSINESS_WORK_CANVAS_STAGE_22_WORKFLOW_OUTPUT_LEDGER_GATE.md` dla widocznego ledgeru outputów workflow.
24. `BUSINESS_WORK_CANVAS_STAGE_23_SAFE_WORKFLOW_CONTEXT_GATE.md` dla bezpiecznej projekcji workflow w kontekście AI.
25. Ten dokument dla skonsolidowanej definicji produktu Canvas.
26. `CANVAS_INTERACTIVITY_RESEARCH_AND_IMPLEMENTATION_BLUEPRINT.md` dla szczegółowej macierzy konkurencji, bloków artefaktów i rendererów.
27. Najnowsze acceptance matrices / test packs dla Canvas.
28. Starsze dokumenty Workstation Canvas / Idea Workspace jako inspiracja i backlog funkcji.
29. Aktualny kod jako stan implementacji, nie jako prawda produktowa.

Decyzja formatu treści jest zamrożona w `docs/architecture/adr/0001-markdown-first-json-native-markdown-projection.md`.

## 3. Definicja Canvas

Canvas to prawy obszar pracy w doświadczeniu `chat + work area`.

Canvas ma trzy znaczenia:

1. **Work Area** - puste lub aktywne miejsce pracy obok chatu.
2. **Artifact Workspace** - środowisko do tworzenia i edycji dokumentów, notatek, raportów, decyzji, briefów, tabel, checklist, prezentacji i research outputs.
3. **Governed Business Runtime** - miejsce, w którym AI może proponować mutacje biznesowe, ale nic ważnego nie wykonuje po cichu.

Canvas nie jest:

- oddzielnym chatem,
- osobną aplikacją z własnym, konkurencyjnym shellem,
- tylko preview panelem,
- tylko edytorem markdown,
- tylko whiteboardem,
- skrótem do KIMI / Wordy / Excele / Prezentacje,
- kolejnym miejscem do pokazywania raw JSON albo technicznych payloadów.

## 3A. Content Storage Contract

Canvas używa kontraktu `Markdown-first, JSON-when-native, always Markdown projection`.

Każdy zasób Canvas ma warstwę Markdown. Nie każdy zasób Canvas ma Markdown jako jedyne źródło prawdy.

Naturalne dokumenty używają Markdown jako canonical source:

- notes,
- brief,
- decision memo,
- research report,
- implementation plan,
- presentation outline,
- meeting note,
- market analysis.

Struktury natywne używają JSON jako canonical source, ale utrzymują Markdown projection:

- table,
- deck/slides,
- mind map,
- whiteboard,
- process flow,
- form,
- KPI model.

Minimalny envelope:

```ts
{
  canonicalFormat: 'markdown' | 'json',
  artifactType: string,
  contentMd: string,
  contentJson?: unknown,
  contentSchemaVersion?: string,
  markdownProjectionStatus: 'synced' | 'stale' | 'failed' | 'missing',
  markdownProjectedAt?: string,
  projectionError?: string
}
```

Domyślny widok biznesowy używa `contentMd`. Natywne edytory używają `contentJson`. Chat, MCP, search/RAG, review i Canvas preview używają Markdown projection. Raw JSON może być dostępny tylko jako jawny source/export/admin/dev view.

## 4. Główna obietnica produktu

Canvas ma pozwolić użytkownikowi zacząć od nieuporządkowanej myśli i dojść do biznesowego outputu.

Przykładowe ścieżki:

- mam pomysł -> rozmawiam z Teresą -> Canvas robi notatkę / strukturę -> powstaje Idea.
- mam problem rynkowy -> Teresa zadaje pytania -> Canvas prowadzi research -> powstaje raport.
- mam chaotyczny plan -> Canvas porządkuje go w brief, checklistę, decision memo albo deck outline.
- mam decyzję -> Canvas pokazuje opcje, założenia, ryzyka, confidence i źródła.
- mam materiał dla klienta -> Canvas zamienia go w document/deck/sheet deliverable z wersją i provenance.
- mam proces -> Canvas może wejść w mind map / whiteboard / process flow / table jako natywne sposoby myślenia.

Docelowy efekt psychologiczny:

```text
"To jest moje centrum dowodzenia pracą biznesową."
```

## 5. Nienegocjowalne zasady

### 5.1 Jeden chat, jeden kontekst

Lewy panel to istniejący `UnifiedChatPanel`, nie nowy mini-chat.

Canvas musi używać tej samej rozmowy, tej samej historii i tego samego `conversationId`.

Blokery:

- nowa rozmowa wraca do poprzedniej,
- pytanie znika z historii,
- Canvas tworzy lokalne fake `conversationId`,
- chat w Canvas traci kontekst po refreshu.

### 5.2 Chat po lewej, praca po prawej

Po otwarciu Canvas:

- lewy chat jest zwężony do panelu rozmowy,
- input zostaje na dole,
- nie pokazujemy dużego marketingowego welcome screena,
- prawa strona jest głównym obszarem pracy.

### 5.3 No silent execution

Każda istotna mutacja musi iść przez:

```text
proposal -> approval -> execution -> read-back / audit
```

Dotyczy szczególnie:

- Idea,
- Initiative,
- Task,
- Brief,
- Decision,
- Research Report,
- Client Deliverable,
- eksport / share zewnętrzny,
- zapis do trwałego artefaktu.

### 5.4 Save state != lifecycle state

`Saved` oznacza tylko, że dane są zapisane.

`Draft`, `In Review`, `Approved`, `Final` oznaczają lifecycle/governance.

Canvas nie może mylić tych pojęć.

### 5.5 Traceability

Ważne rekomendacje, decyzje, KPI, ROI, raporty i research muszą pokazywać:

- źródła albo jawny brak źródeł,
- założenia,
- confidence,
- ograniczenia,
- provenance rozmowy / dokumentu / research session.

### 5.6 Honest availability

Jeśli dokument, deck, sheet, KIMI lane, export albo research lifecycle nie są gotowe, UI mówi to uczciwie.

Nie wolno opisywać scaffoldingu jako produkcyjnej funkcji.

### 5.7 No raw internals

Canvas nie pokazuje użytkownikowi biznesowemu:

- `[object Object]`,
- raw JSON jako stanu,
- `NaN`, `Invalid Date`,
- stack trace,
- technicznego ACL error bez biznesowego tłumaczenia.

## 6. Docelowy układ UX

### 6.1 Podstawowy shell

Desktop:

```text
┌────────────────────────────┬────────────────────────────────────────┐
│ Chat / Teresa              │ Canvas / Work Area                     │
│                            │                                        │
│ historia rozmowy           │ dokument / research / artefakt         │
│                            │                                        │
│ composer na dole           │ narzędzia i główna praca               │
└────────────────────────────┴────────────────────────────────────────┘
```

Mobile/tablet:

- chat i Canvas mogą przełączać się jako panele,
- przełączenie nie traci draftu, rozmowy ani stanu inputu,
- główne akcje pozostają dostępne.

### 6.2 Start pustego Canvas

Pusty Canvas nie ma być martwą kartą.

Powinien oferować szybkie starty pracy:

- `Note`
- `Document`
- `Research`
- `Decision memo`
- `Brief`
- `Presentation outline`
- `Table / checklist`
- `Mind map`
- `Whiteboard`
- `Process flow`

Starty muszą być intencjami biznesowymi, nie listą technicznych narzędzi.

Przykłady etykiet:

- `Zbierz myśli`
- `Napisz dokument`
- `Zrób research`
- `Przygotuj decyzję`
- `Zaprojektuj prezentację`
- `Rozpisz plan działań`
- `Zmapuj proces`

### 6.3 Przyciski w głównej części Canvas

W głównej części ekranu powinny być widoczne tylko akcje, które pomagają rozpocząć albo kontynuować pracę.

Proponowany zestaw pierwszego poziomu:

| Akcja               | Cel                                                    | Docelowy runtime                 |
| ------------------- | ------------------------------------------------------ | -------------------------------- |
| `Note`              | szybkie zebranie myśli / meeting note / discovery note | MarkdownCanvas                   |
| `Document`          | dokument roboczy, brief, memo, plan                    | DocumentCanvas / Artifact        |
| `Research`          | research mission, market research, evidence report     | ResearchCanvas + ResearchSession |
| `Decision`          | decision memo, opcje, ryzyka, confidence               | DecisionCanvas / Artifact        |
| `Presentation`      | outline decka, potem deck artifact                     | DeckCanvas / KIMI lane when real |
| `Table / Checklist` | plan działań, porównanie, backlog                      | TableCanvas / ChecklistCanvas    |
| `Whiteboard`        | luźna praca warsztatowa, sticky, clustering            | Workstation Canvas               |
| `Mind Map`          | mapowanie problemu, hipotez, opcji                     | Workstation Canvas               |
| `Process`           | proces, BPMN-ready flow, value stream                  | Workstation Canvas               |

Nie wszystko musi być produkcyjne od razu. Każda akcja ma mieć etykietę capability:

- `real`
- `partial`
- `scaffold`
- `missing`
- `out_of_scope`

## 7. Jak Canvas wywołuje się z chatu

Canvas może być otwarty:

1. ręcznie przyciskiem w headerze chatu,
2. automatycznie po wykryciu intencji dokumentowej,
3. z odpowiedzi Teresy przez akcję typu `Open in Canvas`,
4. z research/deep research przez `Create Research Canvas`,
5. z artifact/proposal przez `Review in Canvas`,
6. z istniejącego dokumentu/artefaktu przez `Continue in Canvas`.

Ważny kontrakt:

- otwarcie Canvas nie tworzy nowej rozmowy,
- chat pozostaje tym samym runtime,
- Canvas dostaje `conversationId`,
- Canvas może mieć `draftId`, `artifactId`, `researchSessionId`,
- URL powinien dać się odświeżyć bez utraty pracy.

## 8. Typy obiektów Canvas

Canvas musi rozróżniać typy outputów.

Minimalna taksonomia:

- `Note`
- `Idea`
- `Initiative`
- `Task`
- `Brief`
- `Decision`
- `Research Report`
- `Client Deliverable`
- `Document`
- `Sheet`
- `Deck`
- `Mind Map`
- `Whiteboard`
- `Process Flow`
- `Table`
- `Checklist`

Niedozwolone:

- jeden niejasny typ `document` dla wszystkiego,
- przycisk `Idea` tworzący rekord bez proposal,
- research jako zwykły tekst bez lifecycle,
- deck/sheet/document reklamowane jako gotowe, gdy są tylko placeholderem.

## 9. Dokumenty i pisanie

Canvas ma być miejscem do tworzenia dokumentów biznesowych.

Funkcje docelowe:

- markdown/source + preview,
- edycja bezpośrednia w prawym panelu,
- tytuł i typ dokumentu,
- autosave + manual save,
- wersja / historia zmian,
- copy / export / download,
- możliwość poproszenia Teresy o poprawę zaznaczonego fragmentu,
- outline / sections,
- comments / review,
- convert to artifact.

Typowe dokumenty:

- discovery note,
- meeting note,
- client brief,
- market research brief,
- decision memo,
- strategy memo,
- implementation plan,
- ROI assumptions note,
- competitor analysis,
- executive summary,
- presentation outline,
- report draft.

## 10. Research

Research w Canvas nie może być drugim, luźnym mechanizmem researchu.

Docelowo `ResearchCanvas` używa `ResearchSession`.

Wymagane elementy:

- research mission,
- research questions,
- planned / approved / running / completed / failed state,
- evidence list / sources,
- contradictions,
- source quality,
- confidence,
- final report artifact,
- degraded states,
- brak fake sources.

Deep research może pokazywać źródła szerzej. Zwykłe odpowiedzi chatowe nie powinny zalewać UI kartami źródeł.

## 11. Artefakty i governance

Canvas ma tworzyć trwałe artefakty przez jeden wspólny model.

Docelowe encje centralne z `AI_dev_fin.md`:

- `TrustBundle`
- `ResearchSession`
- `AIRun`
- `Artifact`

Każdy trwały output musi mieć:

- `artifactId`,
- `artifactType`,
- `version`,
- source/provenance summary,
- lifecycle state,
- audit/read-back,
- permissions.

Obecnie istnieją dwa światy:

1. `work_canvas_drafts` / `work_canvas_proposals`.
2. Wave 5 artifact runtime przez `/api/artifacts`.

Docelowo Canvas nie może produkować trzeciej prawdy. `Save as artifact` powinno integrować się z Wave 5 artifact runtime albo z jego następcą.

## 12. Workstation Canvas backlog

Starsze dokumenty Workstation Canvas opisują ważną przyszłą warstwę pracy wizualnej.

Docelowe lokalne systemy:

- `Mind Map`
- `Whiteboard`
- `Process Flow`
- `Table`

Cross-canvas primitives:

- frames/sections,
- present mode,
- lasso/marquee selection,
- multi-select actions,
- z-order,
- align/distribute,
- snap-to-grid/guides,
- anchored comments,
- export PNG/SVG/JSON/PDF,
- hand tool,
- tool lock,
- drag/drop,
- template/library entry,
- presence/live cursors,
- facilitation mode,
- timer/voting.

Whiteboard P0:

- sticky notes,
- pen/highlighter,
- eraser,
- images,
- affinity clustering,
- paste-first UX.

Mind Map P0:

- outline view,
- search/jump,
- themes,
- import/export CSV,
- Mermaid mindmap import.

Process Flow P0:

- BPMN core,
- lanes/pools,
- properties strip,
- rules engine / Problems panel,
- flow-aware routing,
- BPMN import/export.

Te funkcje są backlogiem Canvas, ale nie powinny blokować pierwszego dobrego work area do dokumentów i researchu.

## 13. Obecny stan kodu

### 13.1 Istniejące elementy

- `src/components/AIChat/UnifiedChatPanel.tsx`
  - kanoniczny chat,
  - full/split mode,
  - streaming,
  - attachments,
  - deep research,
  - artifact detection,
  - obecnie ma też prosty work panel placeholder.

- `src/components/AIChat/WorkCanvasRuntime.tsx`
  - osobna trasa `/ai/work-canvas`,
  - draft hydration,
  - `draftId`, `conversationId`, `kind`,
  - preview/source,
  - proposal chips,
  - save-as-artifact placeholder.

- `server/src/routes/work-canvas.routes.ts`
  - API dla draftów i proposals,
  - SQLite tables `work_canvas_drafts`, `work_canvas_proposals`,
  - verifyToken.

- `src/components/AIChat/ResearchSessionsDock.tsx`
  - UI dla research sessions.

- `src/components/AIChat/Wave5ArtifactRuntimePanel.tsx`
  - UI dla Wave 5 artifacts.

- `server/src/routes/research.routes.ts`
  - research API.

- `server/src/services/researchSessionService.ts`
  - research session lifecycle.

- `server/src/services/wave5ArtifactRuntimeService.ts`
  - artifact runtime.

### 13.2 Największe luki

1. `WorkCanvasRuntime` jest bardziej scaffoldem niż docelowym Canvas.
2. Right panel nie jest jeszcze prawdziwym edytorem.
3. ResearchSession nie jest realnie spięty z Canvas draftem.
4. Work Canvas save-as-artifact nie jest jednym światem z Wave 5 artifacts.
5. Proposals w Work Canvas są częściowo syntetyczne.
6. Access control Work Canvas API różni się od research/artifacts.
7. KIMI/document/sheet/deck lanes są bardziej obietnicą niż runtime.
8. Brakuje jednego modelu Canvas document state.
9. Brakuje jasnych entry points z chatu do konkretnego typu pracy.
10. Brakuje dopracowanego empty state i command surface dla Canvas.

## 14. Docelowe moduły prawego panelu

Canvas powinien mieć stopniowo następujące tryby:

### Phase 1 - Clean Work Area

- przycisk w chat header otwiera prawy panel,
- chat po lewej przechodzi w układ rozmowy,
- input na dole,
- prawa strona ma czysty empty state,
- brak pełnego welcome screena po lewej.

### Phase 2 - Document Canvas

- utworzenie notatki/dokumentu z chatu,
- bezpośrednia edycja tekstu,
- autosave,
- preview/source,
- title/type,
- simple export/copy.

### Phase 3 - Chat To Canvas

- Teresa może tworzyć lub aktualizować aktywny Canvas,
- odpowiedź może mieć akcję `Open in Canvas`,
- user może powiedzieć "wrzuć to do Canvas",
- Canvas zachowuje powiązanie z conversationId.

### Phase 4 - Research Canvas

- start research mission,
- `ResearchSession` lifecycle,
- evidence/source panel,
- final report artifact.

### Phase 5 - Governed Artifacts

- save to real Artifact runtime,
- versioning,
- proposal-first conversion do Idea/Initiative/Task/Decision,
- approval/read-back/audit.

### Phase 6 - Deliverables

- document/deck/sheet lanes,
- export/download,
- client-ready outputs,
- KIMI integration only where real.

### Phase 7 - Visual Workstations

- mind map,
- whiteboard,
- process flow,
- table,
- shared canvas primitives.

## 15. Acceptance criteria

Canvas passes only when:

- aktywny chat + aktywny Canvas są widoczne jednocześnie,
- refresh nie gubi rozmowy ani draftu,
- chat-to-canvas nie tworzy osobnego chatu,
- typ pracy jest jasny,
- ważna mutacja jest proposal-first,
- reject nie mutuje danych,
- approve daje read-back/audit,
- research ma lifecycle i evidence,
- durable output ma artifact id/type/version,
- save state i lifecycle state są rozdzielone,
- brak raw internals,
- role/tenant gates są backend-side,
- mobile/tablet nie gubi stanu,
- unavailable lanes są opisane uczciwie.

Canvas is blocked if:

- robi hidden business mutation,
- pokazuje fake success,
- traci draft po refreshu,
- używa fake sources,
- miesza save z approval,
- pokazuje userowi raw JSON/errors,
- reklamuje scaffold jako gotową funkcję,
- tworzy kolejne rozłączone runtime bez wspólnej tożsamości.

## 16. Najbliższe decyzje produktowe do omówienia

1. Jakie przyciski startowe mają być w pustym Canvas jako Phase 1/2?
2. Czy pierwszy realny runtime robimy jako `Document Canvas` czy `Research Canvas`?
3. Czy nowy prawy panel w `UnifiedChatPanel` zastępuje `/ai/work-canvas`, czy najpierw współistnieje?
4. Jaki ma być jeden model danych Canvas draftu?
5. Kiedy `save-as-artifact` zaczyna używać Wave 5 artifact runtime?
6. Jakie role mogą tworzyć, zapisywać, eksportować i zatwierdzać Canvas outputs?
7. Jak ma wyglądać command row / Menu 3 dla Canvas?
8. Czy source display w Canvas różni się od source display w chat?
9. Jakie są pierwsze trzy business templates, które mają robić efekt "wow"?
10. Jak mierzymy, że Canvas stał się miejscem dowodzenia firmą?

## 17. Proponowany pierwszy produktowy cutline

Najmniejszy sensowny Canvas, od którego warto zacząć:

1. Otwierany z chatu prawy panel.
2. Lewy chat w trybie rozmowy, input na dole.
3. Empty Canvas z przyciskami:
   - `Zbierz myśli`
   - `Napisz dokument`
   - `Zrób research`
   - `Przygotuj decyzję`
   - `Rozpisz plan`
4. Po kliknięciu `Napisz dokument`: powstaje edytowalny `DocumentCanvas`.
5. Teresa może dopisać do aktywnego dokumentu przez jawne akcje.
6. Draft zapisuje się i przeżywa refresh.
7. `Save as artifact` jest uczciwie oznaczone jako draft artifact albo realnie spięte z artifact runtime.

To jest baza. Dopiero potem dokładamy governance, research lifecycle, deliverables i workstation canvases.
