---
module_id: MODULE_TABLES
doc_kind: DEEP_GAP_AUDIT_CODE_VS_DOCS
scope_anchor: 11_tabele/MODULE_DEEP_AUDIT_CODE_VS_DOCS
mode: docs-only
owner: user
status: approved_for_docs
last_updated: 2026-05-11
---

# Deep Gap Audit — Code vs Docs (`/excele`)

## Scope

Deep audit for module `11_tabele` across runtime code reality and module contract docs for:

- `/excele` route behavior (As-Is)
- target runtime contract (`TB_TABLE_RUNTIME_TARGET`)

## Step 1 — Runtime Reality Check

### 1) What is live today

- `routeConfig.ts` maps `ROUTES.EXCELE` to `/excele` and `AppView.EXCELE`.
- `menuConfig.ts` includes `MODULE_EXCELE` (`Tables`) with badge `soon`.
- `AppRoutes.tsx` mounts `/excele` to `V4ComingSoonView` behind `ProtectedRoute`.
- `V4ComingSoonView.tsx` renders a coming-soon/contact-required surface with explicit CTA.

### 2) What is only target or partial

- `ExceleView` is imported in `AppRoutes.tsx` but not mounted on `/excele`.
- `TB_TABLE_RUNTIME_TARGET` is therefore still target contract, not route runtime.

### 3) Cross-surface behavior that affects `/excele` truth

- `UnifiedChatPanel.tsx` intercepts Excele intent and redirects to `/excele` (still placeholder).
- `UnifiedChatPanel.tsx` intercepts generic table intent and opens `ChatToSchemaPanel` in My Work context, not on `/excele`.
- Executed table-builder flow deep-links to `/my-work/ideas/.../workspace/table?tpTable=...`.

### 4) Runtime truth statement

Current system has active table-creation path via Teresa + My Work table workspace, while `/excele` remains placeholder-only.
That split is valid technically but under-documented in module 11 contract.

## Step 1 — Gap Register (Code vs Docs)

| Gap ID | Priority | Gap | Evidence |
| --- | --- | --- | --- |
| `TB-DEA-P0-009` | P0 | `/excele` docs do not explicitly describe active Teresa table-builder diversion into My Work workspace | `AppRoutes.tsx`, `UnifiedChatPanel.tsx` |
| `TB-DEA-P1-010` | P1 | Placeholder runtime has success CTA feedback but no explicit error/degraded UX for module-interest write failures | `V4ComingSoonView.tsx` |
| `TB-DEA-P1-011` | P1 | Approval chain exists in schema proposal flow, but module docs do not bind it to concrete code evidence anchors | `useSchemaProposal.ts`, `SchemaDiffPreview.tsx` |
| `TB-DEA-P1-012` | P1 | Provenance UI exists (`ProvenanceBadge`) but required payload contract (`assumption/confidence`) is broader than verified runtime guarantees | `connectors/ProvenanceBadge.tsx` |
| `TB-DEA-P1-013` | P1 | Schema mutation classes (`safe/review_required/high_impact`) are documented but not represented as explicit runtime taxonomy in reviewed code | `functions/TB_TABLE_RUNTIME_TARGET.md`, `useSchemaProposal.ts` |

## Step 2 — RAW Comparison + Depth Upgrade

### Must / Should / Out

#### Must

- Keep `/excele` described as placeholder runtime until actual mount changes.
- Keep no-hidden-write and explicit approval posture for high-impact table mutations.
- Preserve Menu 3/right-side control doctrine in target runtime contract.
- Maintain RAW chain: requirement -> decision -> evidence or `NOT_DONE`.

#### Should

- Make Teresa routing split explicit in module docs (`/excele` placeholder vs My Work table builder).
- Add evidence depth level for state coverage and provenance payload depth.
- Add explicit code anchors for approval and diff mechanics.

#### Out

- Runtime remounting `/excele` to `ExceleView`.
- API or component behavior changes.
- Any non-doc mutation.

### As-Is / Target / Delta

| Area | As-Is | Target | Delta |
| --- | --- | --- | --- |
| `/excele` route | Placeholder only | Mounted Table Studio runtime | Keep As-Is truth; track target explicitly |
| Teresa table flow | Active via My Work table builder | Unified primary table runtime contract | Document split ownership and boundaries |
| Approval chain | Present in schema proposal hooks | Canonical across module contract | Bind docs to explicit code evidence |
| Provenance payload | Connector-level provenance + trust chain | Full row/value provenance with assumption/confidence semantics | Mark partial and track P1 closure |
| Runtime state evidence | Broadly described | Full loading/empty/error/degraded/success evidence map | Expand acceptance matrix depth |

### KEEP / ENHANCE / NEW / DEFER

#### KEEP

- Honest placeholder messaging for `/excele`.
- Existing function split `TB_EXCELE_PLACEHOLDER` vs `TB_TABLE_RUNTIME_TARGET`.

#### ENHANCE

- Runtime reality narrative to include Teresa diversion path and My Work runtime anchor.
- Acceptance evidence pointers with exact code anchors.

#### NEW

- Deep audit backlog rows (`TB-DEA-*`) synchronized to board and function cards.
- Explicit code-vs-docs evidence matrix and closure policy.

#### DEFER

- Runtime implementation decision (mount Table Studio directly on `/excele` or keep split lane beyond docs gate).

## RAW -> Decision -> Evidence / NOT_DONE Chain

| RAW requirement | Decision | Evidence | Status |
| --- | --- | --- | --- |
| Source provenance per row/field should be first-class | Keep as target requirement; mark current runtime partial | `ProvenanceBadge.tsx`, module function contracts | `PASS_WITH_P1` |
| Approval + diff before high-impact mutation | Keep and harden | `useSchemaProposal.ts`, `SchemaDiffPreview.tsx` | `PASS_WITH_P1` |
| Workflow from Teresa into table operations | Keep, but document split runtime path explicitly | `UnifiedChatPanel.tsx` + module docs | `ENHANCED` |
| Explicit runtime states | Keep and deepen evidence mapping | `V4ComingSoonView.tsx`, `07_ACCEPTANCE_AND_TESTS.md` | `ENHANCED` |
| No hidden write | Keep as hard guardrail | `functions/*`, `06_PERMISSIONS_AND_SECURITY.md` | `PASS` |

## Final

`APPROVED_FOR_DOCS`

Reason:

- Docs are synchronized to real runtime facts and governance posture.
- Runtime remains a later implementation decision; this report does not authorize route remounting or API/component behavior changes.
