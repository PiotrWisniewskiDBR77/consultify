---
module_id: MODULE_TABLES
function_id: TB_TABLE_RUNTIME_TARGET
function_name: Tables — Table Runtime Target
doc_kind: FUNCTION_CONTRACT
status: draft
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Table Runtime Target

## 1. Function Identity
- Function ID: `TB_TABLE_RUNTIME_TARGET`
- Intended runtime anchor: `ExceleView`/Table Studio workspace
- Current mounted status: `partial` (imported but not mounted on launch route)
- Deep-audit reality: active table-builder execution currently runs through Teresa + My Work table workspace path, not through `/excele`.

## 2. User Job and Business Outcome
- Purpose: preserve target table runtime contract while staying honest about As-Is gap.
- Runtime must support Teresa-context primary entry and lightweight iterative table work consistent with Word/Presentation operating rhythm.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.
- As-Is trigger split:
  - Excele intent -> redirect to `/excele` placeholder.
  - Table intent -> `ChatToSchemaPanel` in My Work workspace and deep-link to My Work table route.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: table schemas, rows/cells, formulas, source datasets (target-state).
- Provenance minimum (target-state contract): each high-impact AI/computed/imported value should carry source/ref, assumption marker, confidence class, and timestamp.

## 6. Outputs and Side Effects
- Outputs: governed table editing/review/export actions (target-state).
- Mutation policy: high-impact operations follow explicit approval chain; no hidden writes.

## 7. Ownership and Handoff Boundaries
- Boundaries: no claim of active mounted workspace today.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.
- Required runtime-state contract:
  - Loading: schema/data fetch status visible with cancellation/retry path.
  - Empty: guided create/import actions with Menu 3 right-side entry actions.
  - Error: business-readable cause with safe redaction of internals.
  - Degraded: partial dataset/failed dependencies explicitly flagged before export/approval.
  - Success: explicit read-back confirmation after approved operations.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.
- Canonical approval flow for high-impact operations:
  `proposal -> diff preview -> owner decision (accept/reject) -> execution -> audit log -> read-back`.
- Menu 3/right-side command row is the canonical slot for AI/workflow actions; duplicate action surfaces in canvas/grid are disallowed.
- Current docs resolution locks this as target contract only; no line in this file authorizes mounted `/excele` runtime.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.
- Board card mapping: `TB-INT-P0-001`, `TB-INT-P0-002`, `TB-INT-P0-003`, `TB-INT-P1-004`, `TB-INT-P1-005`, `TB-INT-P2-007` (see `../RAW_TARGET_STATE_2_0_PACKET.md`).
- Deep audit mapping: `TB-DEA-P0-009`, `TB-DEA-P1-011`, `TB-DEA-P1-012`, `TB-DEA-P1-013`.
- Deep RAW mapping: `TB-RAW-P0-014`, `TB-RAW-P1-015`, `TB-RAW-P1-016`.
- As-Is/Target guardrail:
  - As-Is claims cannot state mounted runtime behavior until route mounting is verified.
  - Target capabilities remain contract commitments with explicit `NOT_DONE` tracking when evidence is missing.
- Schema mutation classes (target-state):
  - `safe`: non-destructive metadata tweak.
  - `review_required`: downstream impact possible, owner review required.
  - `high_impact`: destructive or cross-object impact; explicit approval mandatory.

- Route evidence: module route/view scope for `11_tabele` in router declarations (`src/router/routeConfig.ts` and/or `src/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `11_tabele` function surface.
- Code reality anchors:
  - `UnifiedChatPanel.tsx` (`detectTableIntent`, `ChatToSchemaPanel`, `onExecuted` deep-link).
  - `useSchemaProposal.ts` (`generate/execute/reject/refine/undo/redo` proposal lifecycle).
  - `SchemaDiffPreview.tsx` (diff preview semantics before execution).
  - `connectors/ProvenanceBadge.tsx` (connector-level provenance chain visualization).
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `11_tabele` user flows.

## 11.1 Problem Resolution

| Problem | Resolution |
| --- | --- |
| Strategic runtime unification was undecided | For this docs gate, keep the split: `/excele` placeholder is As-Is, Teresa->My Work is the active table-builder path, and Table Studio remains target runtime. |
| Approval chain needed concrete anchor language | Bind target approval to proposal lifecycle, diff preview, owner decision, execution, audit log, and read-back. |
| Provenance target exceeded runtime proof | Keep full source/ref + assumption + confidence + timestamp as target minimum; mark current runtime depth as partial. |
| Schema mutation classes were not encoded as runtime taxonomy | Keep `safe/review_required/high_impact` as target taxonomy and `RUNTIME_PENDING` until implemented. |

## 12. Open Risks and Change Log
- Risk: target-state expectations confused with current runtime.
- Risk: missing dependency impact preview may cause unsafe schema changes.
- Risk: provenance without read-back confirmation can create false trust in AI-enriched outputs.
- Risk: schema mutation classes are documented contractually and remain `RUNTIME_PENDING` until explicitly encoded as `safe/review_required/high_impact`.
- Risk: RAW requirement depth can be overstated if `IMPACT_ONLY` sources are treated as direct runtime evidence instead of influence constraints.
