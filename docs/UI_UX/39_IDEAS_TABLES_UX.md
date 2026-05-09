---
uiux_doc_id: UIUX_IDEAS_TABLES
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Ideas Tables — UX contract (AI Structured Thinking Table Engine)

## Purpose

Zdefiniować docelowy UX dla `Ideas Tables` w module `Ideas`: tabela jako **żywy, wersjonowany consulting artifact** (provenance per row/cell, scoring, QA, diff/approval) oraz silnik, który prowadzi od chaosu (notes/interview/whiteboard/mindmap/process flow) do decyzji i execution (inicjatywy/task + docs/slides/roadmap).

## Naming

- **UI feature name**: `Ideas Tables`
- **Architecture name**: `AI Structured Thinking Table Engine`
- **Core promise**: “Table is a governed decision artifact, not a mini‑Excel”

## Applies To

- Prompt-to-table i source-to-table (notes/interview/docs/whiteboard/mindmap/process flow)
- Grid UI + row inspector
- Field types + views (grid/grouped/kanban/matrix/…)
- AI enrichment + scoring + duplicate/merge
- Table QA + versioning + semantic diff + approvals
- Table→Initiatives / Table→Tasks / Table→Docs / Table→Slides (+ back to whiteboard/mindmap/process flow)
- Governance: permissions, client/internal mode, audit, retention

## Functional Modes (canonical)

- **Create table from prompt** (z kolumnami, field types, scoring i preview)
- **Generate from sources** (notes/interview/docs/transcripts/PDF/whiteboard/mindmap/process flow)
- **Manual editing** (rows/columns/types/views/comments/tags/links)
- **Register modes** (Idea register / Risk register / Decision table / Hypotheses table / Initiative prioritization)
- **AI scoring & enrichment** (impact/effort/risk/confidence + suggested KPI/owner/deps)
- **AI duplicate detection & merge** (merge jako propozycja z diff i approval)
- **Table-to-execution** (inicjatywy/task/plan)
- **Table-to-artifact** (docs/slides/whiteboard/mindmap/process flow)

## Core Objects (UX-visible invariants)

- **TableArtifact**:
  - **MUST** mieć `owner`, `status`, `version`, `confidentiality`, `table_type`
  - **MUST** być źródłem prawdy (nie export w XLSX)
- **TableRow**:
  - **MUST** mieć `source_references` dla AI‑pochodnych rekordów (albo jawne `assumption`)
  - **MUST** wspierać linked artifacts (notes/process/whiteboard/…)
- **TableCellValue**:
  - **MUST** wspierać provenance per field (`source_references`, `confidence_score`, `ai_origin`)
  - **MUST** rozróżniać status wartości: `fact` / `inferred` / `assumption` / `recommendation`
- **TableVersion + semantic diff**:
  - **MUST** pokazywać zmiany wierszy/kolumn/komórek/źródeł w sposób decyzyjny (nie tylko techniczny)

## Must

- **MUST**: To nie jest mini‑Excel ani kopia Airtable. To “structured thinking engine”.
- **MUST**: Source provenance:
  - ważne wiersze i ważne wartości AI mają źródła albo jawne `assumption`.
- **MUST**: Confidence + origin:
  - AI‑wygenerowane/uzupełnione wartości mają `confidence_score` i `ai_origin`.
- **MUST**: Scoring jest core:
  - impact/effort/risk/confidence (lub model custom) jest jawny, audytowalny i przeliczalny.
- **MUST**: Duplicate/merge jest kontrolowane:
  - merge jako propozycja + diff + approval + merge history; bez auto‑merge.
- **MUST**: Table QA:
  - braki danych, required columns, sprzeczności, brak ownerów/action items są wykrywane i widoczne.
- **MUST**: Versioning + diff + rollback:
  - każda większa zmiana (AI enrichment, merge, scoring bulk) tworzy wersję; rollback tworzy nową wersję.
- **MUST**: Table-to-execution:
  - top rows → initiative candidates / task candidates z linkiem do source rows.
- **MUST**: Governance:
  - permissions + client/internal mode + audit trail; denial bez leakage.
- **MUST**: Performance:
  - grid wspiera duże tabele (virtual scrolling) + stabilny autosave.

## Must Not

- **MUST NOT**: Ukrywać pochodzenia AI (brak “magicznych” wartości bez origin/confidence).
- **MUST NOT**: Pozwalać, by AI scoring/merge stały się “prawdą” bez możliwości korekty i historii zmian.
- **MUST NOT**: Tracić źródeł przy merge/dedupe.

## Should

- **SHOULD**: Widoki: grid (domyślny), grouped, kanban (status), matrix (impact/effort) jako P1.
- **SHOULD**: Export XLSX/CSV/PDF istnieje, ale “source of truth” zostaje w `TableArtifact`.
- **SHOULD**: Templates/registry dla 45 startowych tabel (Idea/Risk/Decision/Initiatives/…).
- **SHOULD**: “Table maturity score” jako szybka ocena gotowości do decyzji/execution.

## Acceptance Criteria

- [ ] Prompt-to-table generuje strukturę + preview + tworzy `TableArtifact`.
- [ ] Source-to-table tworzy wiersze z `source_references` i `confidence`.
- [ ] Row inspector pokazuje: sources, linked artifacts, AI assumptions/origin.
- [ ] AI scoring działa jako sugestia (origin+confidence) i jest audytowalny.
- [ ] Duplicate detection pokazuje podobieństwa; merge wymaga approve i zachowuje źródła.
- [ ] Table QA pokazuje braki danych/ownerów/required fields.
- [ ] Table→initiative/task zachowuje link do source rows.

## Related Sources

- `DRD/consultify/docs/UI_UX/43_PROPOSAL_APPROVAL_AUDIT.md`
- `DRD/consultify/docs/UI_UX/51_PERMISSIONS_AND_LOCKED_UI.md`
- `DRD/consultify/docs/UI_UX/52_TENANT_AND_ACL_SAFETY.md`
- `DRD/consultify/docs/UI_UX/53_TRACEABILITY_AND_SOURCE_UI.md`
- `DRD/consultify/docs/UI_UX/101_RAW_IDEAS_TABLES_STRUCTURED_THINKING_TABLE_ENGINE_2026-05-09.md`

