---
module_id: MODULE_DOCUMENTS
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — Dokumenty / Wordy

## 1. Main Screen

As-Is: `/wordy` exists in router/sidebar ownership but the runtime is placeholder/coming-soon with an honest blocked state. Future runtime must preserve canonical Document Studio ownership and use the executive artifact layout when active.

## 2. Runtime States

- Loading: placeholder does not currently load a document workspace; future workspace must show document/template loading state.
- Empty: placeholder must say the module is coming soon; future empty state must guide document creation/import.
- Error: placeholder must not expose raw internals; future errors must be inline/toast with retry.
- Degraded: coming-soon/blocked is the current degraded state and must be clear.
- Success: no active document success state exists as-is; future success must confirm save/export/review results and next step.

## 3. Menu 2 / Menu 3 Contract

As-Is: no active document command system beyond the placeholder route. Future Menu 2 must follow executive module chips where applicable; future Menu 3 must be the document command row/right-side contextual action slot.

## 4. AI Actions Placement

No active AI document actions are implemented as-is. Future contextual AI actions must live in Menu 3/Dynamic Tabs/local command row right-side slot and must not be duplicated in the canvas.

## 5. Next Action Guidance

The current placeholder must tell the user that the module is coming soon and what to use instead if applicable. Future workspace must guide create, edit, review, approve, export or retry flows.

## 6. Source / Evidence / Provenance

As-Is: no generated document claims are produced. Future documents, summaries and exports must show source documents, assumptions, citations or explicit no-source status.

## 7. Approval / Diff / Review

As-Is: no active high-impact document mutations exist. Future document generation, approval and export must use review/diff where relevant and require approval before final output.

## 8. Anti-Patterns

- Pretending the placeholder is a working document editor.
- AI actions in the document canvas instead of Menu 3.
- Export without source/provenance.
- Save state confused with approval state.
- Hidden destructive edits or silent generation.

## 9. As-Is Gaps

- Main screen is placeholder/coming-soon.
- No active document workspace, document runtime states, provenance UI, review/diff UI or export success flow are validated as implemented.

## 10. Acceptance Criteria

- Sidebar/route lands on `/wordy`.
- Current UI honestly renders placeholder/coming-soon, not a fake active editor.
- Future document runtime preserves Menu 3 AI placement, source/provenance visibility and approval/review gates.
- Placeholder status remains documented as an As-Is gap until active runtime exists.

## 11. Function Annex — Documents Functions

| Function ID | Function | Entry / Route | As-Is state | UI Component Footprint (key) | Contract |
| --- | --- | --- | --- | --- | --- |
| `DOC_WORDY_PLACEHOLDER` | Wordy Placeholder Runtime | `/wordy` | soon | `V4ComingSoonView` | `functions/DOC_WORDY_PLACEHOLDER.md` |
| `DOC_STUDIO_RUNTIME_TARGET` | Document Studio Runtime Target | planned `/wordy` studio runtime | partial | target `WordyView` document runtime (not currently mounted) | `functions/DOC_STUDIO_RUNTIME_TARGET.md` |
