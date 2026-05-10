---
module_id: MODULE_OUTPUTS
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Outputs Library

## Runtime Behavior (As-Is)

- Outputs lane centers on `/presentations` with `ReportsAndPresentationsHub` handling aggregate, mine, review, documents, presentations, sheets, and templates tabs.
- Legacy reports entry points redirect into outputs tab contexts instead of separate module ownership.
- Artifact-level create/edit operations route users to specialized builders (`/reports/builder`, presentation wizard/deck builder) while library identity stays in outputs lane.

## State Handling (As-Is)

- Active tab can be route/query driven (`tab` parsing in outputs hub).
- Hub maintains filters, search, view mode, open documents, and contextual help state.
- Data loading is split by artifact family (`useReports`, `usePresentations`, `useTemplates`, `useArtifactOutputsList`, `useSheetOutputs`).

## Security / Tenant / Governance (As-Is)

- Artifact action targets and governance summaries are fetched through explicit API calls in `useRapData`.
- Review/access actions are explicit user-triggered operations; no hidden route-level artifact mutation branch.
- Outputs lane runs inside authenticated app shell and module production gating.
