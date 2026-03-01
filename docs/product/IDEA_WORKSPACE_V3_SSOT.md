# Idea Workspace v3 (MyWork → Pomysły) — SSOT

> **Status:** DRAFT (v3)  
> **Owner:** Product / Platform  
> **Scope:** MyWork → Pomysły → Idea detail workspace (single-idea)  
> **Related SSOT:**  
> - `docs/MYWORK_MODULE_SPECIFICATION.md` (module-level SSOT)  
> - `docs/ui-standards/UI_UX_CANON_V3.md` (Ideas canvas tool selector MUST)  
> - `docs/ui-standards/02-components/workspace-3-tools-strip.md` (Tools/Context/AI Suggestions)  
> - `docs/product/TOOLS_CATALOG_V3.md` (Workspace v3 definition; locked + propose→accept)  
> - `docs/product/LINK_GRAPH_V3.md` (Context/Links contract)  
> - `docs/product/REQUIREMENTS_V3_SSOT.md` + `docs/product/PROCESS_MYWORK_TO_DELIVERABLES_V3.md` (traceability / ToolSession)  

---

## 1) Cel produktu

Idea Workspace to **osobisty, wielotrybowy silnik pracy** nad pojedynczym Pomysłem (Idea) w MyWork.

- **Cel:** przejść od “spark” do “gotowego do decyzji / inicjatywy” bez utraty treści, niezależnie od narzędzia (MindMap / Process Flow / Table / Whiteboard).
- **Kanon v3:** przełącznik narzędzia canvasa zmienia *tryb pracy*, nie “widok listy”.  

---

## 2) Powierzchnie (surfaces)

### 2.1 Kolekcja (Ideas hub)

Widoki kolekcji (w MyWork → Pomysły):
- **List** — tabela sortowalna
- **Cards** — grid kart (maturity/stage)
- **Garden** — ścieżka dojrzałości / “journey”

### 2.2 Detail workspace (single idea)

Detail workspace to pełnoekranowy “workspace” nad jedną Ideą:
- canvas (narzędzie pracy) + opcjonalne panele po prawej (3‑tools strip)
- mechanika `locked` / “Accept challenge”
- convert do outputów (Tasks/Decision/Initiative/Team chat) z traceability

---

## 3) Kręgosłup architektury (MUST)

### 3.1 Canvas tool selector (MUST)

Narzędzia canvasa:
- **Mind Map**
- **Process Flow**
- **Table**
- **Whiteboard**

**MUST:**
- `preferredTool` jest zapamiętany per user/per workspace.
- switch nie gubi treści (core model + extensions).

### 3.2 Workspace 3‑Tools Strip (SHOULD → MUST dla parytetu jakości)

W docelowym Idea Workspace panel po prawej jest sterowany przez 3‑tools strip:
- **Tools**: akcje trybu + quick tools (insert/convert/transform)
- **Context / Links**: embedded refs + “Used in” backlinks (SSOT: LinkGraph)
- **AI Suggestions**: tematy do rozważenia (send to chat / insert)

**Reguły:**
- single-open (tylko jeden panel naraz)
- click active = close (value → `null`)

### 3.3 Core data contract: `IdeaWorkspaceGraph` (MUST)

Wszystkie tryby renderują ten sam rdzeń danych.

#### 3.3.1 Canonical schema

- **Graph**
  - `nodes[]`
  - `edges[]`
  - `extensions: Record<string, unknown>` (namespaced tool payload + view state)
  - `preferredTool`

- **Node (minimal)**
  - `id`
  - `title/label`
  - `kind` *(konceptualnie)*:
    - `topic` (MindMap)
    - `step` (ProcessFlow)
    - `decision`
    - `note` (Whiteboard sticky/text)
    - `artifact_ref` (link do Task/Decision/Initiative/Report/Deck/etc.)
  - `artifactRef?`: `{ type, id }`
  - `tags?/category?`
  - `extensions` *(namespaced)* — MUST

- **Edge (minimal)**
  - `id`
  - `fromNodeId`, `toNodeId`
  - `relationType?` (`depends_on`, `supports`, `blocks`, `causes`, …)
  - `label?`
  - `extensions` (style/markers)

#### 3.3.2 View state per tool (MUST)

View state nie jest treścią. Jest zawsze w `extensions.<tool>.viewState`.

Przykłady:
- MindMap: `collapsedNodeIds`, `layoutMode`, `zoom/pan`
- ProcessFlow: `layoutMode`, `snap/showGrid`, `selectedLaneId`
- Table: `columns/sort/filter/groupBy`
- Whiteboard: `zoom/pan`, `snap/grid`, `selectionBox`

#### 3.3.3 No data loss rule (MUST)

- switch trybu **nie wykonuje migracji treści** (tylko renderer + view state)
- jeśli tryb generuje dane “niewidoczne” w innym trybie → trzyma je w `extensions.<namespace>` bez utraty

---

## 3.4 Prawy panel “Tools” — IA + kontrakt selekcji (MUST)

> Celem panelu Tools jest “operacyjny kokpit” dla bieżącego trybu + bieżącej selekcji. To *nie jest* dokumentacja ani feed.

### 3.4.1 Struktura panelu (stała IA)

Panel **Tools** ma stały układ, niezależny od trybu (treść sekcji zależy od trybu i selekcji):

- **Header (chrome)**
  - Nazwa trybu (Mind Map / Process Flow / Table / Whiteboard)
  - Status: `Draft/Saved`, `Locked/Accepted`
  - (opcjonalnie) “Tool help” / mikro‑video (jeśli włączone globalnie)

- **Selection summary (MUST)**
  - “1 node / N nodes / edge / lane / row / none”
  - primary actions zależne od selekcji (np. rename, delete, connect)

- **Quick tools (tryb‑specyficzne, MUST)**
  - Mind Map: add child/sibling, collapse/expand, connect, group
  - Process Flow: add lane, add step/decision/start/end, validate, auto‑layout
  - Table: add column, switch view, group/sort presets, generate view (AI)
  - Whiteboard: add sticky/text, group/cluster, connectors, align (R1.5)

- **Transform / Convert (wspólne, MUST)**
  - Convert selection → `Tasks / Decision / Initiative / Team chat`
  - Convert jest zawsze traceable (ToolSession + source fields)

### 3.4.2 Kontrakt selekcji (MUST)

Selekcja jest wspólna w core i musi działać identycznie w 4 trybach:

- zaznaczenie **node** → edycja properties + quick tools
- zaznaczenie **edge** → relationType/label/style
- zaznaczenie **lane** (Process Flow) → lane title/order + przypisania
- zaznaczenie **row** (Table) → edycja pól + quick convert

**MUST:** panel Tools zawsze odzwierciedla selekcję (bez “pustych” paneli).

---

## 3.5 Integracja z kontekstem całej aplikacji (Context / Links) (MUST)

### 3.5.1 Artifact references (MUST)

Idea Workspace może linkować do artefaktów platformy:
- node `kind=artifact_ref` + `artifactRef={ type, id }`
- (SHOULD) inne node’y mogą mieć `artifactRef` jeśli reprezentują realny obiekt platformy

### 3.5.2 “Context / Links” panel (MUST)

Panel Context/Links jest “platform contract”, nie listą rekomendacji:

- **Embedded references** (chip → preview) do:
  - Initiative / Task / Decision / Report / Presentation / Assessment / Note / Workspace
- **Used in (backlinks)** dla bieżącego obiektu i wskazanych `artifactRef`
- **Suggested links** (AI/heurystyki) jako dodatki, nigdy zamiast kontraktu systemowego

SSOT: `docs/product/LINK_GRAPH_V3.md`.

### 3.5.3 Deep‑link i open w aplikacji (MUST)

Klik “Open” w Context/Links:
- otwiera doc w odpowiednim module (dynamic tabs / openDocuments)
- zachowuje “route coherence” (brak orphan views)

---

## 3.6 Teksty do analizy i wnioski z narzędzi (MUST)

### 3.6.1 Tekst jako treść workspaca (MUST)

Teksty do analizy i wnioski muszą mieć **miejsce w core graph**:
- jako `node.kind=note` (whiteboard sticky/text; mindmap note; flow note)
- jako `annotation` (jeśli wprowadzimy warstwę annotation)

**MUST:** tekst nie może żyć wyłącznie w UI panelu — musi być zapisywalny w graph (żeby switch trybów go nie gubił).

### 3.6.2 AI wnioski jako propozycje (MUST)

AI Suggestions zwraca propozycje typu:
- “Topics to analyze”
- “Findings / insights”
- “Next steps”

Każdy element ma akcje:
- **Send to chat**
- **Insert into workspace** (wstaw jako note/annotation z oznaczeniem AI)
- (opcjonalnie) Convert → Tasks/Decision/Initiative (traceable)

---

## 3.7 Nawigacja wyboru narzędzi (MUST)

### 3.7.1 Zasada nadrzędna

Menu główne (MyWork → Pomysły) prowadzi do:
- kolekcji (List/Cards/Garden)
- detail workspace (po otwarciu idei)

**Tryb narzędzia wybieramy w detail workspace** przez selector w prawym górnym rogu canvasa.

### 3.7.2 Persisted tool preference (MUST)

- `preferredTool` zapisany per user/per workspace
- powrót do idei odtwarza ostatni tryb

### 3.7.3 URL / deep link (SHOULD)

Żeby wspierać nawigację z AI / linków:
- `?tool=mindmap|process_flow|table|whiteboard` (override)
- `?focusNode=<id>` / `?focusLane=<id>` / `?focusRow=<id>` (opcjonalnie)

---

## 4) Zasady AI (MUST)

### 4.1 Propose → Accept (MUST)

AI nie zapisuje zmian “po cichu”. AI zwraca **propozycje**:
- `graphPatch` (nodes/edges/extensions)
- `viewPatch` (viewState)
- `rationale` (1–3 zdania)
- `confidence` (0–1)

User ma akcje:
- **Accept** (apply patch)
- **Reject** (drop)
- (opcjonalnie) Accept partial (per item)

### 4.2 Generatory (MUST dla Process Flow + Table)

**Process Flow**
- lane generator: proponuje lanes + przypisania `laneId`
- flow generator: proponuje kroki (start/action/decision/end) + edges

**Table**
- column generator: proponuje zestaw kolumn + typy + mapping
- view generator: proponuje gotowe widoki pracy (triage/scoring/risks/decision log)
- enrichment generator: proponuje uzupełnienia pól (owner/status/impact/effort)

**Wspólny interfejs generatora (contract):**
- Input: `graph + workspaceContext + activeTool`
- Output: `proposalBatch[]` (apply/reject)

### 4.3 Automatyzacje AI podnoszące jakość (SHOULD; bez spamu)

AI ma podnosić jakość i użyteczność narzędzia bez dominowania UI:

- **Trigger: walidacje** (Process Flow warnings) → AI proponuje poprawki / pytania do uzupełnienia (propose)
- **Trigger: brak postępu** (brak edycji przez X min) → 1 sugestia “next step” (send to chat)
- **Trigger: stage ready** → propozycja: “podsumuj i zaproponuj konwersję”

**Anti‑spam policy (MUST):**
- max 1 sugestia na interakcję/okno czasu
- dismiss/snooze zawsze dostępne
- brak stałego feedu w centrum workspaca

---

## 5) Specyfikacje 4 trybów pracy (funkcje + metoda pracy)

> Każdy tryb ma: **Purpose**, **Core interactions**, **Tools panel**, **Context panel**, **AI suggestions**, **DoD**, **Out of scope (v3)**.

---

### 5.1 Mind Map

#### Purpose
Szybkie rozwijanie wątków (topics), grupowanie i “quiet luxury” sieć zależności.

#### Core interactions (R1 MUST)
- create child / sibling, rename inline
- drag/reparent + reorder gałęzi
- collapse/expand gałęzi
- connect nodes (edge) + label
- keyboard: `Tab/Enter/Esc/Del/Undo`

#### Tools panel (minimum)
- Quick add topic / subtopic
- Collapse/Expand controls
- Convert selection → (Tasks/Decision/Initiative)

#### Context panel
- “Used in” backlinks dla idei i wybranych węzłów (artifact_ref)
- embedded refs (Initiative/Task/Decision/Notebook page)

#### AI Suggestions (examples)
- “Propose 5–7 new branches”
- “Find missing risks / dependencies”
- “Summarize and propose next steps”

#### DoD “jak MindMap”
- 90% działa bez myszy (keyboard speed)
- switch trybu nie gubi treści

#### Out of scope (v3)
- pełny “template marketplace” dla mind maps

---

### 5.2 Process Flow (swimlanes REQUIRED)

#### Purpose
Mapowanie procesu z odpowiedzialnością (lanes), walidacja spójności i przygotowanie do automatyzacji/planowania inicjatyw.

#### Core interactions (R1 MUST)
- swimlanes: create/edit/reorder, drag node between lanes
- shapes: start/end, action, decision
- connectors: directed edge + label (“yes/no” lub custom)
- validations: dangling, missing start/end, decision without two exits (warnings)
- keyboard: `Enter/Esc/Del/Undo`

#### Tools panel (minimum)
- Add lane (owner/role/phase)
- Add step/decision
- Validate flow (show warnings)
- Convert selection → tasks/initiative

#### AI Suggestions (examples)
- “Generate lanes from owners/roles”
- “Propose as‑is flow from MindMap/Table notes”
- “Identify bottlenecks (wait time) assumptions to collect”

#### `extensions.processFlow.*` (MUST)
- `lanes[]`
- `node.shape`, `node.laneId`, `node.metrics?`
- `edge.conditionType`, `edge.label?`
- `viewState` (layout/grid/snap)

#### DoD
- lanes są w R1 (nie “later”)
- flow można zbudować bez “toolbar fatigue”

#### Out of scope (v3)
- pełne BPMN 2.0 symbol set i engine validation
- as‑is/to‑be layers (R2)

---

### 5.3 Table (uniwersalna + dopasowywalna)

#### Purpose
Operacyjne porządkowanie treści (triage/scoring/risks/decision log) z szybkim edytowaniem i konfigurowalnymi widokami.

#### Core interactions (R1 MUST)
- inline edit + tab/enter navigation
- multi-sort, filters, grouping + collapse
- column config: show/hide/reorder/width, pinned primary
- selection: row ↔ node

#### Tools panel (minimum)
- Add column (proposal or manual)
- Switch view (saved views)
- Generate view (AI) — propose
- Convert filtered/selected set → tasks/initiative

#### AI Suggestions (examples)
- “Generate columns for hypothesis triage”
- “Suggest 3 views: risks, scoring, decision log”
- “Enrich missing owner/status fields (propose patches)”

#### `extensions.table.*` (MUST)
- `views[]` + `activeViewId`
- `viewState.columns/sort/filters/groupBy`
- `fieldMap` (logical fields → paths)

#### DoD
- Table nie jest “bieda‑widokiem”: group/filter/sort działa od R1

#### Out of scope (v3)
- formuły/rollupy na poziomie Airtable (R2+)

---

### 5.4 Whiteboard (minimalny, premium interakcje)

#### Purpose
Brain‑dump + clustering + konwersja do MindMap/Flow/Table.

#### Core interactions (R1 MUST)
- sticky notes + text blocks
- pan/zoom, free positioning
- lasso select + multi-move
- connectors

#### Tools panel (minimum)
- Add sticky/text
- Group (cluster) selection
- Convert selection → MindMap/Table/Flow (proposal)

#### AI Suggestions (examples)
- “Cluster these notes into 4 topics”
- “Name clusters and propose next steps”

#### `extensions.whiteboard.*` (MUST)
- `node.kind` (`sticky|text|shape`), style
- `viewState` (zoom/pan/grid/snap)

#### DoD
- 10 kluczowych gestów dopracowanych “feel-first”

#### Out of scope (v3)
- pełny “shape zoo”, plugins, templates marketplace (R2+)

---

## 6) Parytet jakości (Definition of Done) — wspólna checklista

**Każdy tryb spełnia:**
- keyboard minimum: `Enter/Esc/Del/Undo` (+ MindMap: Tab/Enter)
- selection contract (panel Tools/Context/AI)
- persistence: autosave + `preferredTool`
- propose→accept dla AI patchy
- convert + traceability (ToolSession + source)
- no data loss na switchu

---

## 7) Benchmark konkurencji (skrócone wnioski)

> Ten rozdział jest “co kopiujemy / czego unikamy”, a nie lista funkcji SaaS.

- **MindMap**: kopiujemy “keyboard speed” (Miro), unikamy “arcade UI”.
- **ProcessFlow**: kopiujemy lanes + walidacje (Lucid/Visio), unikamy pełnego BPMN w v3.
- **Table**: kopiujemy group/filter/sort jako MUST (Airtable), unikamy “database builder”.
- **Whiteboard**: kopiujemy gesty (Miro/tldraw), unikamy 50 narzędzi w v3.

---

## 8) Telemetria (MUST)

Minimalne eventy (nazwy robocze):
- `ideas_tool_switched` `{ from, to, ideaId }`
- `ideas_selection_changed` `{ tool, selectionType, count }`
- `ideas_generator_proposal_created` `{ tool, generatorType, count }`
- `ideas_proposal_accepted` / `ideas_proposal_rejected` `{ tool, generatorType }`
- `mywork_convert_clicked` / `mywork_convert_completed` `{ from:'idea', toType }`
- `mywork_session_materialized` `{ sessionId, sourceEntityId }`

