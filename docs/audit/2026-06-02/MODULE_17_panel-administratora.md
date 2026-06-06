# Module 17 — Panel Administratora — Readiness Scorecard

**Readiness: 38/100 — Tier: Alpha**
**Route(s):** `/admin/*` (AdminView), `/superadmin/*` (SuperAdminView)
**One-line verdict:** The admin plane has one real section wired (members/access codes) but all documented subsections (billing, AI, security, audit, compliance) are aliased back to the same people panel — the superadmin plane is far more complete but carries its own stubs and an unresolved hard-boundary security hole.

## Admin vs Superadmin breakdown
- Admin (`/admin/*`): Alpha — sidebar declares three sections (`people`, `billing`, `operations`) but all three render the same `AdminMembersRolesPanel`; the documented subsections are effectively hidden no-ops.
- Superadmin (`/superadmin/*`): Beta — a full six-module shell (Customers, AI Platform, System, Governance, Security, Configuration) is mounted and mostly backend-wired; discrete stubs exist in alerts-email delivery and backup, and the admin/superadmin role boundary is structurally broken.

## What's REAL (verified + backend-wired)
- Members list / invite / role-change / remove: `src/components/Admin/AdminMembersRolesPanel.tsx:75,105,129,142` → `GET/POST /api/organizations/:orgId/members`, `PATCH .../role`, `DELETE .../members/:id`
- Access-code generation: `AdminMembersRolesPanel.tsx:158` → `POST /api/admin/access-codes` (adminP32 routes, `server/src/routes/adminP32.routes.ts:1579`)
- Ownership transfer flow: `src/views/admin/OwnershipManagementView.tsx:66-172` via `AdminApi.*` — real endpoints
- Superadmin: Organizations, users, impersonation, activities, dashboard stats — `server/src/routes/superadmin.routes.ts:668-766` wired to `SuperAdminController.ts`
- Superadmin billing: invoices, subscriptions, credit notes — `server/src/routes/superadmin.routes.ts` + `billingAdminRoutes` mounted at `/api/superadmin/billing` (`Gateway.ts:356`)
- Feature flags: `src/components/SuperAdmin/FeatureFlagsPanel.tsx:62` → `Api.getFeatureFlags()`, toggle, delete all real
- Admin P32 billing summary: real DB query in `server/src/routes/adminP32.routes.ts:785-827`
- AI observability / AI quality / AI governance / model-registry: mounted routes in `Gateway.ts:450-518`
- Superadmin audit logs (platform-level): `src/views/superadmin/iam/AdminAuditLogsView.tsx:217` calls `Api.getAdminAuditLogs()`
- AICoreRuntimePanel: wired to `V8AICoreApi` (`src/components/Admin/AI/AICoreRuntimePanel.tsx:5`)

## What's MOCK / hardcoded / stub
- Admin sidebar shows `billing` and `operations` as distinct sections but both alias to `'people'` in `SECTION_ALIASES` and all three `case` branches render `<AdminMembersRolesPanel />` (`src/views/admin/AdminSettingsModule.tsx:39-117`). The header metadata for billing/operations also copies the people subtitle verbatim (lines 29-36).
- `AdminBillingFinOpsPanel`, `AdminAIControlCenterPanel`, `AdminCollaborationControlsPanel`, `AdminSecurityIdentityPanel`, `AdminScimLifecyclePanel`, `AdminIamPolicyPanel`, `AdminOrganizationOperationsPanel`, `AdminEnterpriseOverviewPanel`, `AdminAuditLogPanel` etc. are all **implemented but never mounted** in the live admin shell — zero imports outside `src/components/Admin/` directory.
- Backup routes always return 503 when BackupService is absent: `server/src/routes/admin/backup.routes.ts:52,70,99,122,145,168`
- Alert-subscription email delivery labelled a stub: `src/views/superadmin/PresentationGovernanceAlertSubscriptionsView.tsx:1051`
- Payment method hint hard-codes demo value: `src/components/Admin/AdminBillingFinOpsPanel.tsx:66` (`pm_demo_4242`)
- DEFAULT_BILLING_ALERTS fallback in billing panel is static client-side data: `AdminBillingFinOpsPanel.tsx:17-20`
- Several large Admin/* components exist in duplicate with " 2" / " 3" suffixes (e.g. `AdminRiskSummaryPanel 2.tsx`, `AdminState 2.tsx`, `AuditLogViewer 2.tsx`) — dead files

## What's BROKEN / NO_GO / missing
- **P0 security: SUPERADMIN can access `/admin/*`** — `ProtectedRoute.tsx:24` assigns `SUPERADMIN: 3 >= ADMIN: 2`, so superadmin passes the admin guard silently without audit. Documented as `ADM-RAW-P0-001 NEEDS_OWNER_DECISION` (`STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md:76`).
- Admin URLs `/admin/billing`, `/admin/ai`, `/admin/security`, `/admin/audit` silently redirect to the members panel — the sidebar shows only `Team & Access` (one nav item) even though SECTION_ALIASES defines eight aliases (`AdminSettingsSidebar.tsx:27`).
- `/api/admin/billing/summary` URL used by `AdminBillingFinOpsPanel` (`api.ts:8213`) has no matching mount in Gateway — the only billing admin mount is `/api/superadmin/billing`; the tenant-admin billing surface has no live backend route.
- High-risk write audit proof not complete: `ADM-RAW-P1-004 NOT_DONE` — no module-local proof that every admin mutation emits an audit event.
- ACL denial matrix absent (`ADM-RAW-P2-006 NOT_DONE`): no owner/admin/member/guest route + mutation denial coverage.

## Backend wiring
- **Real:** adminP32 (`/api/admin/*` people, IAM, access-codes, billing summary/alerts), superadmin routes (org/user CRUD, invoices, subscriptions, feature flags, AI governance, AI quality, model registry, observability), access-codes standalone route, SCIM route.
- **Missing / broken:** `/api/admin/billing/summary` (tenant-admin billing not mounted); all Admin/* panel API methods in `api.ts` for billing, AI summary, IAM, SCIM, collaboration controls (lines 8212-8391) hit routes that exist in adminP32 but the corresponding UI panels are never rendered; backup endpoints return 503 unless BackupService is configured.

## UI/UX consistency
- Superadmin shell uses a purpose-built `SuperAdminSidebar` + lazy-loaded module pattern — consistent and structured.
- Admin shell has a styled settings-style sidebar (`AdminSettingsSidebar.tsx`) but only one nav item is rendered; `billing` and `operations` are declared in the type but absent from `NAV_ITEMS` array (`AdminSettingsSidebar.tsx:20-27`).
- Header metadata for `billing` and `operations` sections is copy-pasted from the `people` section — an internal content bug visible only if sections are ever rendered.
- Large admin panel components (65 files in `src/components/Admin/`) are built in full isolation without a live mount path; their existence creates maintenance overhead with no user value.

## Tests
- **Superadmin:** real integration test suite — `tests/integration/superadmin-api-endpoints.test.ts`, `superadmin-revenue-api.test.ts`, `superadmin-customers-api.test.ts`, `superadmin-navigation.test.tsx`, analytics hardening test, routing tests, `SSOConfigurationView.test.tsx`
- **Admin server routes:** `server/src/routes/__tests__/adminP32.routes.test.ts` covers billing summary + IAM assignment paths; `analytics-superadmin.routes.test.ts`, `v8/admin.routes.test.ts`
- **Admin UI:** only `ChatV9Flags*.test.tsx` files in `src/components/Admin/__tests__/` — unrelated to admin panel features; zero component tests for `AdminMembersRolesPanel`, `AdminSettingsModule`, or ownership transfer
- Overall: backend test coverage is partial-but-meaningful for superadmin; admin UI tests are absent for core flows

## Doc-vs-code drift
- STATUS.md and CODEMAP.md correctly identify the admin runtime as `people`-only (`AdminMembersRolesPanel`) — accurate.
- BEHAVIOR.md documents three open gaps (`ADM-RAW-P0-001`, `ADM-RAW-P1-004`, `ADM-RAW-P2-006`) all still open in code — docs accurately track reality.
- Docs do NOT capture that 65 Admin/* components and all their API methods (`api.ts:8212-8391`) are fully implemented but unmounted — a significant gap between what exists in the repo and what is reachable at runtime.
- Docs do not call out the `SECTION_ALIASES` no-op routing or the `NAV_ITEMS` single-entry sidebar — these are silent behavioural truncations undocumented anywhere.

## Top gaps to reach market-ready (prioritized)
1. **[P0 security] Resolve ADM-RAW-P0-001** — decide and implement whether superadmin can access `/admin/*`; if not, add an explicit exclusion guard in `ProtectedRoute` or mount a separate admin check that rejects `SUPERADMIN` role.
2. **[P0 UX/completeness] Mount the admin billing section** — add a billing route to Gateway serving `/api/admin/billing/*` (adminP32 already has the DB logic) and wire `AdminBillingFinOpsPanel` to the settings module sidebar.
3. **[P1] Expand admin sidebar and content routing** — `AdminSettingsSidebar.tsx` must surface all sections in `NAV_ITEMS`; `AdminSettingsModule.tsx` switch must render the correct panel per section rather than `AdminMembersRolesPanel` for every case.
4. **[P1] Audit proof for high-risk admin writes** — systematically verify that role changes, removals, ownership transfers, and access-code generation all emit `audit_events` rows; resolve `ADM-RAW-P1-004`.
5. **[P2] Remove or consolidate dead admin components** — `AdminRiskSummaryPanel 2.tsx`, `AdminState 2.tsx`, `AuditLogViewer 2.tsx` and similar duplicate files should be deleted; all unmounted Admin/* panels need a clear roadmap (mount them or remove them).
6. **[P2] Add ACL denial matrix coverage** — add route-level tests proving that MEMBER and GUEST cannot perform admin mutations (resolves `ADM-RAW-P2-006`).
7. **[P3] Fix stub email delivery for alert subscriptions** — `PresentationGovernanceAlertSubscriptionsView.tsx:1051` explicitly labels email delivery as a stub; must be wired to a real email provider before superadmin alerting is production-safe.
