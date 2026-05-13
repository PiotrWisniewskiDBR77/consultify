---
module_id: MODULE_PRESENTATIONS
function_id: PR_GEN_RUNTIME_TARGET
function_name: Presentations Generator — Runtime Target
doc_kind: FUNCTION_CONTRACT
status: draft
owner: user
owner_business: user
owner_tech: user
last_updated: 2026-05-10
---

# Function Contract — Runtime Target

## 1. Function Identity
- Function ID: `PR_GEN_RUNTIME_TARGET`
- Intended runtime anchor: `PrezentacjeView` generator workspace
- Current mounted status: `partial` (imported but not mounted on `/prezentacje`)

## 2. User Job and Business Outcome
- Purpose: preserve standalone generator target contract without overstating As-Is state.

## 3. Trigger and Entry Points
- Primary trigger and entry points follow the route/runtime scope documented in Section 1.

## 4. UI Component Footprint
- UI footprint follows the mounted runtime anchor and standard module layout components.

## 5. Inputs, Data Contracts, and Dependencies
- Inputs: deck/story/source models (target-state).

## 6. Outputs and Side Effects
- Outputs: governed generation, review and export actions (target-state).

## 7. Ownership and Handoff Boundaries
- Boundaries: current production presentation runtime remains outside this lane.
- Risk: scope drift into outputs ownership if boundaries are not explicit.

## 8. Runtime States and UX Behavior
- Runtime behavior must keep loading/empty/error/degraded/success states explicit with next-step guidance.

## 9. AI, Source, Evidence, Approval
- AI actions, source visibility, and approval expectations follow Menu 3 placement and auditable review rules.

## 10. Security, Roles, and Tenancy
- Security is deny-by-default with tenant/ACL and role boundaries enforced for this function.

## 11. Acceptance Criteria and Test Evidence

- Acceptance checks: section maintained; explicit evidence mapping required for gate compliance.

- Route evidence: module route/view scope for `12_prezentacje` in router declarations (`src/routes/routeConfig.ts` and/or `src/routes/AppRoutes.tsx`) and module view path references.
- Component evidence: module UI footprint under `src/components/**` and `src/views/**` for `12_prezentacje` function surface.
- API evidence: integration boundary through `src/services/api.ts` and backend route ownership in `server/src/routes/**` when endpoint-level mapping is not explicitly documented.
- Test evidence: module regression coverage references in `tests/**` and `tests/e2e/**` aligned to `12_prezentacje` user flows.

### 11A. RAW Alignment (2026-05-11)

| Axis | As-Is | Target | Delta | Decision |
| --- | --- | --- | --- | --- |
| Runtime mount | target view imported, not mounted | governed runtime on `/prezentacje` | no mount in current runtime | `NEW + DEFER_RUNTIME` |
| AI lifecycle | implied governance only | explicit `propose -> review -> accept/reject` model | acceptance detail gap | `ENHANCE` |
| Delivery claims | generic wording | explicit approval before high-impact publish/export claims | missing hard gate text | `ENHANCE` |
| Menu 3 placement | global rule only | function-level right-side action binding | proof chain gap | `ENHANCE` |
| Teresa deck-work execution flow | absent in canonical function sources | expected by hard UX rules for this audit | unresolved source binding | `NEEDS_OWNER_DECISION` |

### 11B. Critical Thesis Mapping

| RAW source thesis | Decision | Evidence |
| --- | --- | --- |
| AI is primary builder but never silent mutator/share/export actor | `KEEP + ENHANCE` | `docs/product/PREZENTACJE_V8_AI_GOVERNANCE.md`, `docs/product/PREZENTACJE_V8_SSOT.md` |
| Outline-first review gate and continuity to builder | `KEEP` | `docs/product/PREZENTACJE_V8_SSOT.md`, `docs/product/PRESENTATION_GENERATOR_V3.md` |
| Runtime target remains target, not As-Is shipped claim | `KEEP` | `03_BEHAVIOR.md`, `04_UI_UX.md`, `07_ACCEPTANCE_AND_TESTS.md` |
| Mounted runtime cannot be claimed on `/prezentacje` until route ownership decision changes | `KEEP` | `src/routes/AppRoutes.tsx` (current mount remains `V4ComingSoonView`) |
| Teresa hard-rule closure must be explicit (`closed` or `owner decision`) | `OWNER_DECISION_REQUIRED` | `07_ACCEPTANCE_AND_TESTS.md` (`OWNER-TERESA-12-001`) |
| Screenshot evidence support | `NOT_DONE` | visual input file unavailable at audit time |

### 11C. Stage 1.5 Ultra-Deep Binding (2026-05-11)

Source: `../STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`.

| Stage 1.5 axis | Function decision | Evidence / status |
| --- | --- | --- |
| Runtime ownership | `NEW_DOC_TARGET + DEFER_RUNTIME` | `PrezentacjeView` is imported but not mounted on `/prezentacje` |
| `/presentations` dependency | `KEEP_AS_09_RUNTIME` | hub/wizard/builder remain active Outputs runtime, not lane-12 shipped runtime |
| AI lifecycle | `ENHANCE` | future runtime must use `proposal -> review -> accept/reject -> audit` |
| Menu 3/right-side rule | `KEEP + ENHANCE` | future contextual AI actions must use Menu 3/right-side only |
| Export/share/publish approval | `ENHANCE` | no high-impact delivery claim without review/approval/audit posture |
| Teresa deck-work execution | `OWNER_DECISION_REQUIRED` | `OWNER-TERESA-12-001` decides impact-only vs mandatory target-runtime gate |
| MELS/screenshot evidence | `NOT_DONE` | source/asset unavailable |

## 12. Open Risks and Change Log
- Risk: scope drift into outputs ownership if boundaries are not explicit.
- Stage 1.5 risk: target runtime can be over-read as shipped if docs omit `DEFER_RUNTIME` and `/presentations` ownership context.
