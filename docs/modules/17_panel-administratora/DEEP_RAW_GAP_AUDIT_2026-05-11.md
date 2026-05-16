---
module_id: MODULE_ADMIN_PANEL
doc_kind: DEEP_RAW_GAP_AUDIT
scope_anchor: 17_panel-administratora/MODULE_INTEGRATION
mode: docs-only
owner: user
status: needs_owner_decision
last_updated: 2026-05-11
---

# Deep RAW Gap Audit — Module 17 Panel Administratora

## Objective

Deep closure for module 17 in two steps:

1) As-Is gap audit (code vs docs)  
2) RAW alignment and decision hardening with evidence-only policy

## Evidence Baseline

### Mandatory Code Evidence (As-Is)

- `src/routes/routeConfig.ts`
- `src/routes/AppRoutes.tsx`
- `src/components/navigation/Sidebar/menuConfig.ts`
- `src/views/admin/AdminView.tsx`
- `src/views/SettingsView.tsx`
- `src/views/superadmin/SuperAdminView.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/views/admin/AdminSettingsModule.tsx`

### Mandatory Contract Evidence

- `docs/modules/17_panel-administratora/00_META.md` -> `07_ACCEPTANCE_AND_TESTS.md`
- `docs/modules/17_panel-administratora/functions/ADM_ADMIN_WORKSPACE.md`
- `docs/modules/17_panel-administratora/functions/ADM_SUPERADMIN_BOUNDARY.md`

### Mandatory Cross-SOT Evidence

- `docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`
- `docs/product/SUPERADMIN_V8_SSOT.md`
- `docs/product/VIRTUAL_WORKERS_SUPERADMIN_IMPLEMENTATION_PLAN_V8.md`
- `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_32_ADMIN_ENTERPRISE_2026-04-11.md`
- `docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_32_ADMIN_2026-03-29.md`

## Step 1 — Gap Audit (As-Is vs code)

### Entrypoints and Role Gating (runtime truth)

- Sidebar launcher: `ADMIN` -> `AppView.ADMIN_DASHBOARD` (tenant admin entry).
- Route mount: `/admin/*` -> `ProtectedRoute(requiredRole="ADMIN")` -> `AdminView` -> `AdminSettingsModule`.
- Settings root is separate: `/settings/*` -> `ProtectedRoute(requireAuth=true)` -> `SettingsView`.
- Superadmin root is separate: `/superadmin/*` -> `ProtectedRoute(requiredRole="SUPERADMIN")` -> `SuperAdminView`.
- Critical runtime fact: role hierarchy in `ProtectedRoute` is numeric and allows `SUPERADMIN` to satisfy `requiredRole="ADMIN"` (`SUPERADMIN:3 >= ADMIN:2`).

### Boundary Map (Admin vs Settings vs Superadmin)

- Admin (module 17): tenant operations cockpit sections (`overview`, `people`, `security`, `billing`, `ai`, `integrations`, `audit`, `operations`).
- Settings (module 18 ownership): user preferences plus tenant defaults/tenant-security discoverability and handoff language.
- Superadmin (platform): dedicated plane and shell with cross-tenant scope.

### Gap Register

| Gap ID | Priority | Type | Finding | Evidence | Decision | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `ADM-DEEP-P0-001` | `P0` | permission drift | Superadmin can pass ADMIN route guard because of role hierarchy (`SUPERADMIN > ADMIN`) while contract expects hard plane split | `ProtectedRoute.tsx`, `AppRoutes.tsx`, `SUPERADMIN_V8_SSOT.md` ownership rules | `NEEDS_OWNER_DECISION` | `NOT_DONE` |
| `ADM-DEEP-P1-002` | `P1` | ownership drift | Admin operations include branding/domains while historical P32 doc (2026-03-29) assigns org identity writes to P30; enterprise P32 (2026-04-11) extends Admin ownership | both P32 contracts + `AdminSettingsModule.tsx` operations section | `KEEP (latest enterprise precedence)` | `DOCS_RESOLVED` |
| `ADM-DEEP-P1-003` | `P1` | route drift risk | `AppView.ADMIN_WORKSPACE` maps to `/admin/integrations` (alias behavior), while module launcher uses `/admin` root; docs must call out aliasing explicitly | `routeConfig.ts`, `menuConfig.ts`, `AdminSettingsModule.tsx` | `ENHANCE` | `DOCS_RESOLVED` |
| `ADM-DEEP-P1-004` | `P1` | evidence gap | No module-local runtime evidence that admin write flows always emit audit trail for high-risk actions | module docs + inventory + code anchors | `ENHANCE` | `NOT_DONE` |
| `ADM-DEEP-P2-005` | `P2` | evidence gap | No explicit ACL regression packet proving denied states across owner/admin/member/guest by route + mutation class | module docs + acceptance matrix | `NEW` | `NOT_DONE` |

## Step 2 — RAW Alignment + Decision Hardening

### Must / Should / Out

#### Must

- Hard ownership split remains explicit:
  - module 17 = tenant admin ownership
  - module 18 = user preferences ownership
  - superadmin = platform ownership
- No hidden write and no silent role escalation claims.
- Every critical claim follows chain: `source -> decision -> evidence/NOT_DONE`.

#### Should

- Keep alias and handoff paths explicit (`/admin` root, `/admin/integrations`, settings deep-links).
- Keep deny-by-default and auditable override language visible in acceptance matrix.

#### Out

- Runtime code changes.
- Any claim that P0 permission drift is fixed.

### As-Is vs Target vs Delta

| Area | As-Is | Target | Delta |
| --- | --- | --- | --- |
| Plane separation | separate routes exist but guard hierarchy allows superadmin into `/admin/*` | strict boundary with explicit policy for cross-plane access | owner decision needed (`ADM-DEEP-P0-001`) |
| Ownership split | largely aligned with enterprise P32 + superadmin SSOT | explicit no-duplication matrix and handoff language in module docs | docs hardened |
| Route/AppView mapping | launcher and route mounted; alias views map to admin subroutes | no ambiguity in docs for aliases and internal sections | docs hardened |
| Audit evidence | partial doc assertions; limited runtime proof in module contract | claim-level evidence rows or `NOT_DONE` | acceptance updated with `NOT_DONE` rows |

### Decision Table (KEEP / ENHANCE / NEW / DEFER)

| Decision | Item | Why | Evidence |
| --- | --- | --- | --- |
| `KEEP` | `/admin/*`, `/settings/*`, `/superadmin/*` as separate mounted roots | runtime and IA split are real and stable | `AppRoutes.tsx`, `routeConfig.ts`, contract inventory |
| `KEEP` | enterprise admin ownership expansion (billing/ai/audit/operations in P32) | latest enterprise contract supersedes narrow P32 | `FINAL_IMPLEMENTATION_PLAN_32_ADMIN_ENTERPRISE_2026-04-11.md` |
| `ENHANCE` | alias and handoff narrative (Admin root vs subroute aliases) | reduce route drift confusion | `routeConfig.ts`, `AdminSettingsModule.tsx` |
| `ENHANCE` | acceptance evidence matrix with explicit `NOT_DONE` | no PASS without proof rule | updated `07_ACCEPTANCE_AND_TESTS.md` |
| `NEW` | module packet + board + function execution cards | close RAW governance and task traceability | new packet/board/cards |
| `DEFER` | final policy for superadmin access into tenant admin plane | requires explicit owner decision due security and operations impact | `ADM-DEEP-P0-001` |

## Critical Claim Chains

| Claim | Source | Decision | Evidence / NOT_DONE |
| --- | --- | --- | --- |
| Tenant admin module owns tenant operations | enterprise P32 contract | `KEEP` | `AdminSettingsModule.tsx` sections + inventory rows |
| User preferences ownership remains outside module 17 | P32 (2026-03-29) ownership table + settings runtime | `KEEP` | `SettingsView.tsx` section model (`profile`, `theme`, etc.) |
| Superadmin is separate platform plane | Superadmin V8 SSOT + route tree | `KEEP` | `/superadmin/*` dedicated route and `SuperAdminView` |
| No role escalation across planes | security rule + superadmin invisibility rule | `DEFER` | `NOT_DONE` because current guard hierarchy permits superadmin on `/admin/*` |
| High-impact admin writes are always auditable | contracts and inventory expectation | `ENHANCE` | `NOT_DONE` at module-evidence level (runtime proof packet missing) |

## Final Verdict

`NEEDS_OWNER_DECISION`

Reason:

- Docs are aligned on ownership and route mapping, but P0 permission drift (`ADM-DEEP-P0-001`) requires owner-level policy decision before verdict can move to `APPROVED_FOR_DOCS`.
