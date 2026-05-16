---
uiux_doc_id: UIUX_WORKBENCH
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Workbench — UX contract (AI Operating Workspace)

## Purpose

Zdefiniować `Consultify Workbench` jako centralny tryb pracy z AI: **dual‑pane workspace**, gdzie lewy panel (Teresa/chat) steruje pracą, a prawy panel jest miejscem powstawania i dojrzewania żywych artifactów (sources → diff → approval → export → execution), bez kopiuj‑wklej do zewnętrznych narzędzi.

## Naming

- **UI module / mode name**: `Consultify Workbench`
- **Pattern name**: `Dual Pane Workbench`
- **Core promise**: “chat → artifact → diff → approve → export → execution”

## Applies To

- Shell: układ dwupanelowy + stabilność stanu
- Teresa chat jako panel sterujący
- Prawy panel: edytowalne artifacty (MD/doc/table/slides/whiteboard/mindmap/process flow/…)
- Selection-based edit + command palette
- Diff/accept/reject + versioning + review/approval
- Source-backed mode (fact/inferred/assumption/recommendation)
- Conversions do modułów (Docs/Slides/Tables/Ideas/Initiatives/Tasks/Whiteboard/Process Flow/CRM)
- Client-ready packaging + export history

## Functional Modes (canonical)

- **Chat + Artifact** (wspólny kontekst: client/project/sources/active artifact/selection/roles)
- **Create artifact from prompt / conversation / source pack**
- **Manual editing** (prawdziwa edycja, nie preview)
- **Selection-based AI edit** (rewrite/shorten/expand/translate/add sources/convert)
- **Artifact type switcher** (view vs conversion vs export vs promote)
- **Versioning & diff** (semantic + block diff; rollback)
- **Review / approval** (draft→in_review→approved→client_ready→published)
- **Source-backed artifact** (sources + confidence + labels)
- **Multi-artifact workspace** (tabs + relations + dependency graph)
- **Agentic work mode** (plan→propose→diff→approve→apply→audit)
- **Export / publish** (bundle + client/internal guards)

## Core Objects (UX-visible invariants)

- **Artifact**:
  - **MUST** mieć: `type`, `status`, `owner`, `confidentiality`, `current_version`
  - **MUST** być źródłem prawdy (nie “wklejką z chatu”)
- **ArtifactContentBlock**:
  - **MUST** wspierać `source_references`, `confidence_score`, `ai_origin`, label fact/inferred/assumption/recommendation
- **Diff / Proposed change**:
  - **MUST** być widoczny przed zastosowaniem
  - **MUST** wspierać accept/reject (częściowo)
- **Conversion**:
  - **MUST** zachowywać źródła i mapowanie (np. doc→slides, note→table, rec→initiative, action→task)

## Must

- **MUST**: Prawy panel to miejsce pracy (editable artifact), nie “podgląd odpowiedzi”.
- **MUST**: Split view jest stabilny:
  - resizable bez “latania”,
  - zachowuje stan między akcjami,
  - focus mode / full-screen artifact działa bez utraty kontekstu.
- **MUST**: Selection jest first-class:
  - AI działa na zaznaczeniu/bloku/wierszu/slajdzie/node’zie z pełnym kontekstem artifactu.
- **MUST**: No silent AI changes:
  - każda istotna zmiana AI ma diff + accept/reject.
- **MUST**: Versioning + rollback:
  - zaakceptowane zmiany tworzą wersje; rollback jest bezpieczny i audytowalny.
- **MUST**: Source-backed mode:
  - kluczowe tezy mają źródła albo jawne assumptions,
  - label: fact / inferred / assumption / recommendation,
  - confidence jest jawne.
- **MUST**: Review/approval + client-ready:
  - artifact ma lifecycle i “client-ready guard” (ukrywa internal-only treści).
- **MUST**: Conversions prowadzą do execution:
  - recommendations → initiative candidates,
  - action items → tasks,
  - doc→slides/tables, whiteboard→table itd.
- **MUST**: Governance:
  - permissions, confidentiality, audit trail, export history, retention rules.

## Must Not

- **MUST NOT**: Wymuszać copy/paste do Word/PPT/Notion/Excel/Miro jako standardowego kroku.
- **MUST NOT**: Przemycać zmian AI bez diffu i decyzji usera.
- **MUST NOT**: Udawać źródeł (brak “fake citations”).

## Should

- **SHOULD**: Command palette (Menu 3 / contextual actions) steruje pracą: create/convert/rewrite/show sources/show diff/export/approve.
- **SHOULD**: Cross-artifact consistency check (raport vs tabela vs deck) jako dedykowany QA.
- **SHOULD**: Agentic mode jest krokowy i audytowalny (plan → propose → apply).

## MVP Roadmap (canonical sequencing)

- **MVP 1**: dual pane + create MD/document artifact + manual edit + autosave + export MD/PDF + active artifact context in chat
- **MVP 2**: selection-based commands + rewrite/shorten/expand/translate + inline suggestions
- **MVP 3**: diff + accept/reject + version history + rollback + review/approval + comments
- **MVP 4**: source pack + sources per block + labels + confidence + QA for missing sources
- **MVP 5**: multi-artifact tabs + conversions (Docs/Tables/Slides/Tasks/Initiatives) + bundle exports
- **MVP 6**: enterprise governance + agentic work + client/internal packaging + cross-artifact consistency

## Acceptance Criteria

- [ ] Dual pane działa stabilnie (resize + focus + state persistence).
- [ ] Prawy panel jest edytowalny; zmiany zapisują się (autosave).
- [ ] AI edits są pokazywane jako diff i wymagają decyzji usera.
- [ ] Version history i rollback działają.
- [ ] “Source-backed mode” pokazuje źródła + assumptions + labels.
- [ ] Konwersje do Tasks/Initiatives/Docs/Slides zachowują provenance.

## Related Sources

- `DRD/consultify/docs/UI_UX/41_TERESA_AND_ASSISTANTS.md`
- `DRD/consultify/docs/UI_UX/43_PROPOSAL_APPROVAL_AUDIT.md`
- `DRD/consultify/docs/UI_UX/45_PRIVATE_MODE_AND_MEMORY_UI.md`
- `DRD/consultify/docs/UI_UX/51_PERMISSIONS_AND_LOCKED_UI.md`
- `DRD/consultify/docs/UI_UX/52_TENANT_AND_ACL_SAFETY.md`
- `DRD/consultify/docs/UI_UX/53_TRACEABILITY_AND_SOURCE_UI.md`
- `DRD/consultify/docs/UI_UX/102_RAW_WORKBENCH_AI_SIDE_WORKSPACE_2026-05-09.md`

