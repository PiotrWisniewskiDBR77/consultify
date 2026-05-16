---
module_id: MODULE_DOCUMENTS
doc_kind: CODEMAP
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Codemap — Dokumenty (Document Studio)

## Route / AppView / Entry component

Routing dla “Dokumenty” jest **w fazie budowy**: doc runtime ma być dostępny chat-first + przez hub Outputs.

- **Primary user entry (today)**: `Outputs Library` `/presentations` → tab `Documents` (`ReportsAndPresentationsHub`)
- **Planned route (Document Studio)**: `/document-studio/:artifactId` (wg `CONSULTIFY_DOCUMENT_STUDIO_V1_IMPLEMENTATION_PLAN.md`)
- **Backend API (planned)**: `/api/document-studio/*` (wg planu)
- **Frontend components (planned)**:
  - `src/components/DocumentStudio/DocumentStudioIntakePanel.tsx`
  - `src/components/DocumentStudio/DocumentStudioWorkspace.tsx`
  - `src/components/DocumentStudio/DocumentStudioExportButton.tsx`

## Implementation notes

Zasada architektoniczna: Document Studio **nie tworzy równoległego registry** — trwały stan idzie przez v8.1 substrate (`Artifact`, `ArtifactRun`, `ArtifactVersion`, `ArtifactSourceRef`).

