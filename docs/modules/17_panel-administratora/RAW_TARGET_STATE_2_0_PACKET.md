---
module_id: MODULE_ADMIN_PANEL
doc_kind: RAW_TARGET_STATE_2_0_PACKET
scope_anchor: 17_panel-administratora/MODULE_INTEGRATION
mode: docs-only
version: 2.0
owner: user
status: needs_owner_decision
last_updated: 2026-05-11
---

# RAW Target State 2.0 Packet — Module 17 Panel Administratora

## 0. Mission and Function Scope

This packet closes module-17 docs contract for:

- `ADM_ADMIN_WORKSPACE`
- `ADM_SUPERADMIN_BOUNDARY`

with strict evidence chains and explicit ownership split against module 18 and superadmin.

## 1. Source Register

### 1.1 Module Contract Inputs

- `00_META.md` -> `07_ACCEPTANCE_AND_TESTS.md`
- `functions/ADM_ADMIN_WORKSPACE.md`
- `functions/ADM_SUPERADMIN_BOUNDARY.md`
- `RAW_INPUT.md`
- `DEEP_RAW_GAP_AUDIT_2026-05-11.md`
- `IMPLEMENTATION_TASK_BOARD.md`
- `function-cards/*`

### 1.2 Cross-SOT Inputs (mandatory)

- `docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`
- `docs/product/SUPERADMIN_V8_SSOT.md`
- `docs/product/VIRTUAL_WORKERS_SUPERADMIN_IMPLEMENTATION_PLAN_V8.md`
- `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_32_ADMIN_ENTERPRISE_2026-04-11.md`
- `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_32_ADMIN_2026-03-29.md`

### 1.3 Runtime Reality Inputs (mandatory code)

- `src/routes/routeConfig.ts`
- `src/routes/AppRoutes.tsx`
- `src/components/navigation/Sidebar/menuConfig.ts`
- `src/views/admin/AdminView.tsx`
- `src/views/SettingsView.tsx`
- `src/views/superadmin/SuperAdminView.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/views/admin/AdminSettingsModule.tsx`

## 2. Step 1 — Gap Audit (As-Is vs code)

### 2.1 Runtime Reality Check

- `/admin/*` is mounted and guarded by `requiredRole="ADMIN"`, rendering `AdminView`.
- `/settings/*` is a distinct authenticated route that renders `SettingsView`.
- `/superadmin/*` is mounted separately with `requiredRole="SUPERADMIN"` and dedicated superadmin shell.
- `ProtectedRoute` role hierarchy currently allows superadmin to satisfy admin guard.

### 2.2 Gap Classes

#### A) Permission drift

- P0: hard boundary doctrine says planes are separated, but route guard hierarchy permits superadmin into admin route tree.

#### B) Ownership drift

- P1: historical narrow P32 contract and enterprise P32 contract differ for operations/branding scope; module docs must enforce precedence and no duplication.

#### C) Route drift

- P1: app-view aliases map to admin subroutes (for example admin workspace -> integrations) and need explicit contract language.

#### D) Evidence gaps

- P1/P2: missing module-local ACL regression pack and explicit high-risk mutation audit proof matrix.

### 2.3 Normalized Backlog

| Card ID | Priority | Gap | Owner Surface | Status |
| --- | --- | --- | --- | --- |
| `ADM-RAW-P0-001` | `P0` | superadmin can access admin route via hierarchy (`SUPERADMIN > ADMIN`) | `ADM_SUPERADMIN_BOUNDARY` | `NEEDS_OWNER_DECISION` |
| `ADM-RAW-P0-002` | `P0` | hard ownership split must be explicit in all contracts (17 vs 18 vs superadmin) | both functions | `DOCS_RESOLVED` |
| `ADM-RAW-P1-003` | `P1` | admin alias route/AppView mapping insufficiently explicit | `ADM_ADMIN_WORKSPACE` | `DOCS_RESOLVED` |
| `ADM-RAW-P1-004` | `P1` | missing high-risk write audit runtime evidence packet | `ADM_ADMIN_WORKSPACE` | `NOT_DONE` |
| `ADM-RAW-P1-005` | `P1` | settings handoff and no-duplicate ownership assertions not normalized across docs | both functions | `DOCS_RESOLVED` |
| `ADM-RAW-P2-006` | `P2` | role-matrix regression coverage incomplete (owner/admin/member/guest) | module acceptance | `NOT_DONE` |

### 2.4 Resolution Decisions (2026-05-11)

| Problem | Resolution | Evidence / Boundary | Result |
| --- | --- | --- | --- |
| Hard split vs route hierarchy conflict | keep conflict explicit and escalate for owner policy decision | `ProtectedRoute.tsx`, `SUPERADMIN_V8_SSOT.md` | `NEEDS_OWNER_DECISION` |
| ownership drift between historical and enterprise P32 docs | treat enterprise P32 as precedence; keep anti-dup rules from historical P32 | both P32 plans + inventory | `DOCS_RESOLVED` |
| route alias ambiguity | document launcher vs alias mapping explicitly | `routeConfig.ts`, `menuConfig.ts`, `AdminSettingsModule.tsx` | `DOCS_RESOLVED` |
| missing runtime proof for audit guarantees | do not claim pass; mark `NOT_DONE` until evidence exists | acceptance matrix rows | `NOT_DONE` |

## 3. Step 2 — RAW Alignment

### 3.1 Must / Should / Out

#### Must

- tenant admin ownership in module 17
- user preferences ownership in module 18
- platform ownership in superadmin
- no hidden write / no silent role escalation claims
- every critical claim uses `source -> decision -> evidence/NOT_DONE`

#### Should

- explicit route aliases and handoff links
- explicit deny guidance and escalation language in acceptance docs

#### Out

- runtime code edits
- forced interpretation that P0 permission drift is already fixed

### 3.2 As-Is / Target / Delta

| Area | As-Is | Target | Delta |
| --- | --- | --- | --- |
| Route surfaces | separate roots mounted | same | keep |
| Guard semantics | superadmin passes admin guard | explicit policy for cross-plane access | owner decision required |
| Ownership docs | mostly aligned, mixed granularity across sources | one normalized matrix per module docs | docs aligned |
| Evidence posture | some claims generic | claim-level matrix with `NOT_DONE` where missing | docs aligned |

### 3.3 Decision Table (KEEP / ENHANCE / NEW / DEFER)

| Decision | Item | Why |
| --- | --- | --- |
| `KEEP` | tenant admin cockpit structure in admin module | aligned with enterprise P32 and mounted runtime |
| `KEEP` | separate `/settings/*` and `/superadmin/*` route roots | current runtime separation and SSOT |
| `ENHANCE` | route alias + boundary narrative in behavior and functions | remove route drift ambiguity |
| `ENHANCE` | acceptance and permission matrix with evidence IDs | enforce evidence-only gate |
| `NEW` | deep audit + board + cards + packet chain | full RAW governance closure |
| `DEFER` | final policy for superadmin access to admin routes | P0 owner decision gate |

## 4. Critical Chain Ledger

| Source claim | Source | Decision | Evidence / NOT_DONE |
| --- | --- | --- | --- |
| Admin is tenant command center | enterprise P32 | `KEEP` | `AdminSettingsModule.tsx`, inventory admin rows |
| Settings owns personal preferences | historical P32 ownership matrix | `KEEP` | `SettingsView.tsx` personal sections |
| Superadmin is platform-only control plane | superadmin SSOT | `KEEP` | `SuperAdminView.tsx` + route tree |
| No role escalation across planes | security doctrine | `DEFER` | `NOT_DONE` due current `ProtectedRoute` hierarchy |
| High-impact admin writes are auditable | P32 contracts and inventory | `ENHANCE` | `NOT_DONE` module-local runtime evidence missing |

## 5. Final Gate

`NEEDS_OWNER_DECISION`

Why:

- Docs are now aligned and hardened, but P0 permission drift and its policy resolution remain open.
