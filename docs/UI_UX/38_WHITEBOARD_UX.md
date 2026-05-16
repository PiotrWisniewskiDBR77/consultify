---
uiux_doc_id: UIUX_WHITEBOARD
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Whiteboard — UX contract (AI Collaborative Whiteboard Artifact Engine)

## Purpose

Zdefiniować docelowy UX dla `Consultify Whiteboard`: AI‑native **Visual Collaboration & Workshop Intelligence Engine**, który prowadzi od chaosu warsztatowego do uporządkowanej wiedzy i execution (decyzje → inicjatywy → taski → artefakty: docs/slides/tables/process flow/mindmap) z provenance, wersjami, diffem i governance.

## Naming

- **UI module name**: `Consultify Whiteboard` (lub: `Whiteboard Studio`)
- **Recommended internal name**: `Whiteboard Artifact Engine`
- **Core promise**: “Board is a governed artifact, not a canvas file”

## Applies To

- Infinite canvas + obiekty (sticky/cards/frames/connectors)
- Workshop mode (facilitator/participant, timer, voting, private ideation)
- AI clustering + synthesis + QA (non-destructive, approval-gated)
- Conversions: initiatives/tasks/docs/slides/tables/mindmap/process flow
- Versioning + diff + audit + export
- Permissions + confidentiality + client/internal modes

## Functional Modes (canonical)

- **Create board from prompt**
- **Generate board from notes/interview/transcripts/docs/SOP/tables/CRM**
- **Manual visual collaboration**
- **Workshop mode (live facilitation)**
- **AI brainstorming** (ideas as proposals, not silent inserts)
- **AI clustering & synthesis** (themes/duplicates/contradictions/gaps)
- **Decision / hypothesis / problem boards**
- **Strategy canvases** (BMC/VPC/Transformation/AI Adoption/Digital Roadmap/…)
- **Convert board → initiatives**
- **Convert board → tasks / action plan**
- **Convert board → docs/slides/tables**
- **Convert board → mindmap / process flow**

## Key Application Components (conceptual contract)

- **Whiteboard Request Intake** (cel, tryb, uczestnicy, poufność, outputy, template)
- **Source Pack Builder** (źródła + provenance per object/claim)
- **AI Whiteboard Generator** (prompt+sources → frames/sections/objects + assumptions + missing info)
- **Whiteboard Modeling Engine** (źródło prawdy: obiekty, meta, links, versions, statuses)
- **Infinite Canvas / Visual Editor** (zoom/pan, multi-select, grouping, minimap, filters, search)
- **Object Inspector** (owner/status/tags/sources/votes/confidence/linked artifacts)
- **AI Clustering & Synthesis Engine** (clusters, duplicates, decisions, risks, action items)
- **Workshop Facilitation Engine** (timer, private mode, reveal, voting, follow presenter)
- **Whiteboard QA Engine** (kompletność: cel, decyzje, ownerzy, źródła, duplikaty, wykonanie)
- **Versioning & Diff Engine** (object-level diff + approvals + rollback)
- **Governance Engine** (permissions, confidentiality, audit trail, retention)
- **Export Engine** (PDF/PNG/SVG + downstream artifacts)

## Core Objects (UX-visible invariants)

- **WhiteboardArtifact**:
  - **MUST** być źródłem prawdy (nie screenshot/plik)
  - **MUST** mieć `status`, `version`, `owner`, `confidentiality`
- **WhiteboardObject**:
  - **MUST** mieć: typ, treść, autora, pozycję/rozmiar
  - **MUST** wspierać `source_references` + `confidence` dla AI/wniosków
- **WhiteboardCluster / WhiteboardAnalysis**:
  - **MUST** rozdzielać: fakty vs założenia vs rekomendacje
  - **MUST** być non-destructive względem oryginalnych obiektów

## Must

- **MUST**: Whiteboard jest artifactem, nie “ładnym obrazkiem”.
- **MUST**: AI nie robi “silent destructive edits”:
  - clustering/sortowanie/przenoszenie obiektów musi działać jako `proposal → approve → version`.
- **MUST**: Non-destructive synthesis:
  - oryginalne sticky notes pozostają zachowane; AI tworzy klastery/summaries jako warstwę.
- **MUST**: Source provenance:
  - kluczowe obiekty i wnioski AI mają źródła (albo jawne `assumption`).
- **MUST**: Workshop mode ma narzędzia facylitacji:
  - timer, voting, private ideation + reveal, follow presenter / bring everyone to frame.
- **MUST**: Execution conversions są natywne:
  - board → initiative candidates,
  - board → task candidates,
  - board → docs/slides/tables (z linkiem do źródeł).
- **MUST**: Governance:
  - permissions, confidentiality (client/internal), audit trail, version history.
- **MUST**: Stabilność i performance:
  - canvas działa płynnie dla setek obiektów (docelowo tysiące) i nie “gubi” layoutu bez zgody.
- **MUST**: Export minimalny:
  - PDF + PNG/SVG czytelne; export nie może być “fake success”.

## Must Not

- **MUST NOT**: Być kopią Miro/Mural/FigJam 1:1.
- **MUST NOT**: Traktować AI clustering jako nieodwracalne przestawienie tablicy bez approve.
- **MUST NOT**: Gubić metadanych obiektów (kolory/tagi/źródła) przy AI porządkowaniu.
- **MUST NOT**: Tworzyć inicjatyw/tasków bez jawnego zatwierdzenia usera.

## Should

- **SHOULD**: Użyć gotowego canvas SDK (np. tldraw) i budować przewagę w modelu danych + AI + governance.
- **SHOULD**: Minimap, outline, search i filters są obowiązkowe dla dużych boardów.
- **SHOULD**: “Private mode / silent brainstorming” jako standard warsztatowy.
- **SHOULD**: Board QA daje czytelną ocenę “gotowości do execution” (maturity score).
- **SHOULD**: Import/export do zewnętrznych whiteboardów jako etap późniejszy (nie core).

## MVP Roadmap (canonical sequencing)

- **MVP 1**: stabilny WhiteboardArtifact + manual editing + frames/connectors + autosave + export + comments
- **MVP 2**: board-from-sources + provenance + confidence + inspector + basic QA
- **MVP 3**: workshop mode + AI clustering (as proposals) + summary + action item detection
- **MVP 4**: whiteboard-to-execution (initiatives/tasks/docs/slides/tables) + decision log/risk register outputs
- **MVP 5**: enterprise governance + versions/diff/rollback + template registry + semantic search + integrations

## Acceptance Criteria

- [ ] Board zapisuje się jako `WhiteboardArtifact` (obiekty jako dane), nie jako obraz.
- [ ] AI clustering działa jako propozycja i tworzy nową wersję po approve.
- [ ] Obiekty zachowują kolor/tagi/źródła; nie ma “znikających karteczek” po AI sort.
- [ ] Workshop mode umożliwia 60-min live warsztat (timer, voting, private→reveal, follow presenter).
- [ ] Board→initiative/task/docs/slides/tables działa i utrzymuje link do źródłowych obiektów.
- [ ] Export PDF + PNG/SVG jest czytelny i stabilny.

## Related Sources

- `DRD/consultify/docs/UI_UX/43_PROPOSAL_APPROVAL_AUDIT.md`
- `DRD/consultify/docs/UI_UX/51_PERMISSIONS_AND_LOCKED_UI.md`
- `DRD/consultify/docs/UI_UX/52_TENANT_AND_ACL_SAFETY.md`
- `DRD/consultify/docs/UI_UX/53_TRACEABILITY_AND_SOURCE_UI.md`
- `DRD/consultify/docs/UI_UX/95_RAW_WHITEBOARD_AI_COLLABORATIVE_WHITEBOARD_ENGINE_2026-05-09.md`

