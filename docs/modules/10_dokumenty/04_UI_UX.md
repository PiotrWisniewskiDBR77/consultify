---
module_id: MODULE_DOCUMENTS
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-11
---

# UI/UX — Dokumenty / Wordy

## 1. Main Screen

As-Is: `/wordy` exists in router/sidebar ownership but the runtime is placeholder/coming-soon with an honest blocked state. Future runtime must preserve canonical Document Studio ownership and use the executive artifact layout when active.

As-Is nuance from code: module entry in sidebar uses `soon` badge, while `V4ComingSoonView` for `/wordy` uses `Kontakt wymagany` positioning with access-request CTA.

## 2. Runtime States

- Loading: placeholder does not currently load a document workspace; future workspace must show document/template loading state.
- Empty: placeholder must say the module is coming soon; future empty state must guide document creation/import.
- Error: placeholder must not expose raw internals; future errors must be inline/toast with retry.
- Degraded: coming-soon/blocked is the current degraded state and must be clear.
- Success: no active document success state exists as-is; future success must confirm save/export/review results and next step.

## 3. Menu 2 / Menu 3 Contract

As-Is: no active document command system beyond the placeholder route. Future Menu 2 must follow executive module chips where applicable; future Menu 3 must be the document command row/right-side contextual action slot.

Hard rule: contextual AI actions belong to Menu 3/right-side slot only and must never be duplicated as a separate toolbar inside the canvas.

## 4. AI Actions Placement

No active AI document actions are implemented as-is. Future contextual AI actions must live in Menu 3/Dynamic Tabs/local command row right-side slot and must not be duplicated in the canvas.

The interaction model must stay light and functional, aligned with Tables/Presentations: compact contextual actions, small cards/chips, and no heavy inline form overlays.

Teresa is the document-work executor for this lane: she clarifies intent, drafts/edits documents, drives diff/review/approval, and initiates export only through the governed runtime.

## 5. Next Action Guidance

The current placeholder must tell the user that the module is coming soon and what to use instead if applicable. Future workspace must guide create, edit, review, approve, export or retry flows.

Current deep-gap finding: chat can redirect document intent directly to `/wordy` and announce "starting work now", so next-action guidance must explicitly clarify blocked runtime state.

## 6. Source / Evidence / Provenance

As-Is: no generated document claims are produced. Future documents, summaries and exports must show source documents, assumptions, citations or explicit no-source status.

## 7. Approval / Diff / Review

As-Is: no active high-impact document mutations exist. Future document generation, approval and export must use review/diff where relevant and require approval before final output.

Final output/export claims are invalid unless explicit review state and approval state are visible and auditable.

## 8. Anti-Patterns

- Pretending the placeholder is a working document editor.
- AI actions in the document canvas instead of Menu 3.
- Export without source/provenance.
- Save state confused with approval state.
- Hidden destructive edits or silent generation.

## 9. As-Is Gaps

- Main screen is placeholder/coming-soon.
- No active document workspace, document runtime states, provenance UI, review/diff UI or export success flow are validated as implemented.
- Upstream Teresa/chat and template-use entrypoints can route users to `/wordy` as if active document work starts, while mounted runtime remains placeholder.
- UI state vocabulary is inconsistent across sidebar (`soon`) and placeholder page (`Kontakt wymagany`).

## 10. Acceptance Criteria

- Sidebar/route lands on `/wordy`.
- Current UI honestly renders placeholder/coming-soon, not a fake active editor.
- Future document runtime preserves Menu 3 AI placement, source/provenance visibility and approval/review gates.
- Placeholder status remains documented as an As-Is gap until active runtime exists.

## 10A. Hard UX Rules Compliance Matrix

| Rule | As-Is posture | Target posture | Evidence status |
| --- | --- | --- | --- |
| Teresa-executed document work | Teresa can route to `/wordy`, but mounted runtime is still placeholder | Teresa drafts/edits/reviews document artifacts through executable runtime | `PASS_WITH_P2` (docs), runtime `NOT_DONE` |
| Light model like Tables/Presentations | placeholder only | compact command-row + side-panel interactions | `PASS_WITH_P2` |
| Menu 3/right-side actions only | documented globally, no active studio runtime on `/wordy` | strict no-duplicate toolbar policy | `PASS_DOCS`, runtime `NOT_DONE` |
| Mandatory states + next actions | partially documented in runtime states section | full state map with explicit next-step guidance | `PASS_WITH_P2` |
| Explicit review/approval before final output/export claims | declared but not runtime-proven | review and approval required before export claim | `PASS_WITH_P1`, runtime `NOT_DONE` |

## 10B. RAW Alignment Chains (`RAW -> decision -> evidence`)

| Thesis | RAW source | Decision | Evidence / status |
| --- | --- | --- | --- |
| Document flow must be artifact-native with diff/review/approval/export governance. | `docs/RAW/document-studio/92_RAW_DOCUMENT_STUDIO_RESEARCH_2026-05-08.md`, `docs/RAW/document-studio/93_RAW_DOCUMENT_STUDIO_ANALYSIS_2026-05-09.md`, `docs/RAW/document-studio/94_RAW_DOCUMENT_STUDIO_AI_NATIVE_ARTIFACT_ENGINE_2026-05-09.md` | `KEEP` | module docs codified (`PASS_DOCS`), mounted runtime proof `NOT_DONE` |
| Teresa executes document work and context must stay truthful. | `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` (impact-only) | `ENHANCE` | chat routes to `/wordy`; placeholder mount requires explicit blocked messaging (`PASS_WITH_P2`) |
| Menu 3/right-side actions only; no duplicate toolbars. | `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` + global Menu 3 rules | `KEEP` + `ENHANCE` | doctrine present in docs; runtime assertion on mounted `/wordy` remains `NOT_DONE` |
| Approval-before-export is mandatory for final claims. | `92/93/94` (RAW + UI mirrors) | `KEEP` | requirement documented; runtime evidence remains `NOT_DONE` |

## 11. Function Annex — Documents Functions

| Function ID | Function | Entry / Route | As-Is state | UI Component Footprint (key) | Contract |
| --- | --- | --- | --- | --- | --- |
| `DOC_WORDY_PLACEHOLDER` | Wordy Placeholder Runtime | `/wordy` | soon | `V4ComingSoonView` | `functions/DOC_WORDY_PLACEHOLDER.md` |
| `DOC_STUDIO_RUNTIME_TARGET` | Document Studio Runtime Target | planned `/wordy` studio runtime | partial | target `WordyView` document runtime (not currently mounted) | `functions/DOC_STUDIO_RUNTIME_TARGET.md` |
