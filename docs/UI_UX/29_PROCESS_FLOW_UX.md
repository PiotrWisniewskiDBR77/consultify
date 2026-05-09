---
uiux_doc_id: UIUX_PROCESS_FLOW
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Process Flow Studio — UX contract (AI Process Intelligence Engine)

## Purpose

Zdefiniować docelowy UX dla `Consultify Process Flow Studio`: proces jako **żywy artifact** (model danych + wersje + diff + governance) oraz engine, który prowadzi od prompt/notes/docs do procesu, a od procesu do diagnozy, rekomendacji i działań (inicjatywy/task/SOP/deck/tabele/roadmap).

## Naming

- **UI module name**: `Consultify Process Flow Studio`
- **Architecture name**: `AI Process Intelligence Engine` / `AI Process Flow Analysis Engine`
- **Core promise**: “Process is a living operational model, not a pretty picture”

## Applies To

- Process capture (prompt / notes / interview / document)
- Visual editor (canvas) + inspector
- Current/Future/Target states
- AI analysis + Lean/VSM layer + QA
- Process→Initiatives, Process→Tasks/Workflow, Process→SOP, Process→Docs/Slides/Tables
- Versioning + diff + approval + export + audit

## Functional Modes (canonical)

- **Generate from prompt**
- **Generate from notes/interview/transcript/document/SOP/table**
- **Manual mapping** (nodes/edges/swimlanes/subprocesses)
- **State management**: current vs future vs target
- **AI process analysis** (bottlenecks/risks/owners/handovers/automation/AI opps/KPI gaps)
- **Lean/VSM analysis** (VA/NVA, lead/cycle/waiting time, waste)
- **Convert problems → initiatives (candidates)** (z KPI/owner/effort/priority)
- **Convert process → tasks/workflow/SOP**
- **Process as source for docs/tables/presentations**

## Key Application Components (conceptual contract)

- **Process Request Intake** (cel analizy, kontekst klient/projekt, standard modelowania, oczekiwany output)
- **Source Pack Builder** (źródła + provenance per step)
- **AI Process Parser** (tekst→model procesu z confidence)
- **Process Modeling Engine** (nodes/edges/swimlanes/subprocesses + standardy: business flow / BPMN-like / SIPOC / VSM)
- **Process Canvas / Visual Editor** (drag/drop, auto-layout, zoom/pan, filters, highlight)
- **Process Step Inspector** (owner/input/output/time/waiting/risk/KPI/sources)
- **AI Process Analysis Engine** (problemy + rekomendacje + confidence)
- **Lean/VSM Engine** (opcjonalna warstwa analityczna)
- **Process QA Engine** (spójność: start/end, owner, IO, dead ends, orphan nodes)
- **Versioning & Diff Engine** (structural diff: nodes/edges/owners/times/risks/KPI)
- **Governance Engine** (approval, permissions, confidentiality, audit)
- **Export Engine** (PNG/SVG, PDF, Markdown/Doc/SOP, PPT, tables; BPMN XML jako tryb/etap późniejszy)

## Core Objects (UX-visible invariants)

- **ProcessFlowArtifact**:
  - **MUST** mieć `status` + `version` + `owner` + `confidentiality` + `modeling_standard`
  - **MUST** wspierać rozdzielenie current/future/target (jako wersje lub stany)
- **ProcessNode / Edge / Swimlane**:
  - **MUST** istnieć jako dane (nie tylko layout na canvasie)
  - **MUST** wspierać `source_references` i `confidence_score` dla AI‑pochodnych elementów
- **ProcessAnalysis**:
  - **MUST** rozdzielać: fakty vs założenia vs rekomendacje
  - **MUST** pokazywać `confidence_score` + braki danych
- **InitiativeCandidate / Task plan**:
  - **MUST** linkować do `source_node_ids` / `source_process_step`

## Must

- **MUST**: Proces nie jest obrazkiem. Jest artifactem z modelem danych.
- **MUST**: System działa bez event logów (process mining nie jest wymagane w MVP).
- **MUST**: AI generuje drafty, ale:
  - oznacza założenia,
  - pokazuje confidence,
  - dodaje source provenance,
  - krytyczne zmiany/konwersje przechodzą przez approval.
- **MUST**: Każdy istotny krok procesu ma ownera (albo jest jawnie oznaczony jako `missing owner`).
- **MUST**: Każdy istotny krok ma input/output (albo jawny brak).
- **MUST**: Current state i future state są rozdzielone (i porównywalne).
- **MUST**: Istnieje `Process QA` i jest używalny w warsztacie (lista błędów + linki do kroków).
- **MUST**: `Versioning + diff` jest core (nie dodatkiem).
- **MUST**: Proces prowadzi do działań:
  - problems → initiative candidates,
  - future state → task plan / SOP / exec materials.
- **MUST**: Export minimalny:
  - PDF oraz PNG/SVG (z czytelnym layoutem).
- **MUST**: Governance i bezpieczeństwo:
  - permissions + confidentiality mode,
  - audit trail,
  - denial/locked bez leakage.

## Must Not

- **MUST NOT**: Być kopią Miro/Visio/BPMN toola/Celonis 1:1.
- **MUST NOT**: Udawać pewności tam, gdzie nie ma źródeł (no “fake confidence”).
- **MUST NOT**: Automatycznie tworzyć inicjatyw “na serio” bez zatwierdzenia usera (candidate-first).
- **MUST NOT**: Narzucać BPMN jako domyślnego UX dla biznesu.

## Should

- **SHOULD**: Domyślny standard modelowania: “business flow”; BPMN-like jako tryb advanced.
- **SHOULD**: Auto-layout jest osobnym “quality gate” (duże mapy muszą być czytelne).
- **SHOULD**: Lean/VSM jest warstwą analityczną (opcjonalną), nie obowiązkowym stylem rysowania.
- **SHOULD**: Heurystyczny “what-if” w MVP (później data-driven simulation).
- **SHOULD**: Import/export integracje (Miro/Lucid/Visio) jako etap późniejszy.

## MVP Roadmap (canonical sequencing)

- **MVP 1**: artifact + prompt-to-process + manual mapping + canvas + autosave + export PDF/PNG + comments
- **MVP 2**: source pack + notes/docs-to-process + provenance + confidence + inspector + basic QA
- **MVP 3**: AI analysis + current/future + versioning + diff + recommendations (z założeniami)
- **MVP 4**: Lean/VSM + initiative conversion + process-to-task + process-to-SOP
- **MVP 5**: enterprise governance + template registry + BPMN export/import + simulation + semantic search + library

## Acceptance Criteria

- [ ] Użytkownik tworzy draft procesu z promptu i zapisuje go jako artifact (nie plik).
- [ ] Canvas edytuje process nodes/edges bez utraty danych; działa autosave.
- [ ] `Process QA` wykrywa braki (start/end/owner/input/output/dead ends) i linkuje do elementów.
- [ ] Można utworzyć future state i zobaczyć diff względem current state.
- [ ] AI analiza pokazuje bottlenecks/risks/automation opps + confidence + assumptions.
- [ ] Problems → initiative candidates zachowują link do kroków źródłowych.
- [ ] Export do PDF i PNG/SVG jest czytelny i stabilny.

## Related Sources

- `DRD/consultify/docs/UI_UX/43_PROPOSAL_APPROVAL_AUDIT.md`
- `DRD/consultify/docs/UI_UX/51_PERMISSIONS_AND_LOCKED_UI.md`
- `DRD/consultify/docs/UI_UX/52_TENANT_AND_ACL_SAFETY.md`
- `DRD/consultify/docs/UI_UX/53_TRACEABILITY_AND_SOURCE_UI.md`
- `DRD/consultify/docs/UI_UX/98_RAW_PROCESS_FLOW_AI_PROCESS_INTELLIGENCE_2026-05-09.md`

