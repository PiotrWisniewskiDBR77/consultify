# COMPLETION DOSSIER — Module 17 Panel Administratora / Admin
**Date:** 2026-06-03 | **Branch:** feat/wave1-foundations | **Auditor:** agent

---

## 1. Purpose / Vision

**Goal:** Full governance control plane in two layers — (1) **tenant admin** (`/admin/*`): org-scoped command center for members/roles, billing/plans, AI posture, security/IAM/SCIM, audit log; (2) **superadmin** (`/superadmin/*`): cross-tenant platform operations, virtual workers control plane, model registry, AI governance, DLP, system/configuration/security/content governance.

The far goal is that an org admin can govern the entire tenant — who has access, what AI budget they consume, which models they can use, what data leaves the org — without ever touching the platform plane, and that every sensitive mutation produces an immutable audit record. Superadmin governs the platform layer above that.

Sources: `docs/modules/17_panel-administratora/01_PURPOSE.md`, `02_SCOPE.md`, `STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`, `docs/product/SUPERADMIN_V8_SSOT.md`.

---

## 2. Readiness Score

| Sub-plane | Score | Delta from Jun-02 baseline |
|---|---|---|
| **Admin (`/admin/*`)** | **67 / 100** | +29 vs 38 (Jun-02) |
| **Superadmin (`/superadmin/*`)** | **71 / 100** | +4 vs 67 (Jun-02) |
| **Combined / governance integrity** | **67 / 100** | — |

### 2a — Admin plane: Real / working

- All 5 sections mounted and routed: `AdminSettingsModule.tsx:27,144-154` — `people/billing/ai/security/audit` each render distinct panels; `AdminSettingsSidebar.tsx:25-65` declares all 5 in `NAV_ITEMS`.
- **Billing panel** — `AdminBillingFinOpsPanel.tsx:89-200` calls real DB routes; `adminP32.routes.ts:863-979` upserts `organization_billing` + `organization_limits` + `organizations` and emits `actionType:'update_billing'` audit at line 1853. D8 manual-billing decision satisfied.
- **Security panel** — `AdminSecurityIdentityPanel.tsx:78-83` renders 6 sub-panels; all backed by `/api/admin/security`, `/iam/policy`, `/iam/assignments`, `/identity/scim/*`, `/risk/summary` (`adminP32.routes.ts`).
- **Audit panel** — `AdminAuditLogPanel.tsx:29-31` wires to `getTenantAdminAuditLogs`, `getTenantAdminAuditStats`, `getAdminRiskSummary`, `getAdminComplianceSummary`.
- **AI Controls panel** — `AdminAIControlCenterPanel.tsx:36` calls `Api.getAdminAISummary()` → `GET /api/admin/ai/summary` (adminP32 line 1870); delegates to `OrgAISettingsView` and `AIModule`.
- **18 sensitive audit events** covered by `adminAuditService.logAction()` (`adminP32.routes.ts:1641-2253`): billing plan update, IAM policy, SCIM tokens, group mappings, payment methods, security policy, collaboration controls, data-retention.
- **SUPERADMIN boundary guard** — `ProtectedRoute.tsx:68-73`: explicit `if (requiredRole === 'ADMIN' && normalizeAppRole(role) === 'SUPERADMIN')` redirects to `/superadmin`. ADM-RAW-P0-001 resolved.
- Cross-org boundary enforced: `adminP32.routes.ts:300-306` → 403 `ADMIN_BOUNDARY_VIOLATION` for other-org attempts.

### 2b — Admin plane: Gaps to 100%

- **Member role-change/remove not audited** — `AdminMembersRolesPanel.tsx:129,143` calls `Api.updateOrganizationMemberRole` / `Api.removeOrganizationMember` → `/api/organizations/:id/members/*` (Mod 16 route), NOT adminP32. No `adminAuditService.logAction` fires. ADM-RAW-P1-004 remainder open.
- **Admin/AI sub-governance tabs never mounted** — `src/components/Admin/AI/` contains 8 built sub-tabs (`AccessLimitsTab`, `PolicyGovernanceTab`, `ModelsProvidersTab`, `AuditComplianceTab`, `FeaturesPrivacyTab`, `ChatTracesViewer`, `HealthMonitoringTab`, `UsageAnalyticsDashboard`). `AdminAIControlCenterPanel.tsx` only exposes two flat tabs (`OrgAISettingsView` + `AIModule`). The Admin/AI sub-tab suite is fully implemented but unreachable from admin; `UsageAnalyticsDashboard` and `ChatTracesViewer` are actually mounted in **superadmin** (`AIPlatformModule.tsx:131`, `AIOperationsModule.tsx:109,115`).
- **Billing notify-email stub** — `adminP32.routes.ts:1236,1243`: hardcoded `['billing@example.com']` / `['finance@example.com']`; no per-org storage.
- **Payment method brand hardcoded** — `adminP32.routes.ts:1055`: brand `'Visa'`; no Stripe validation.
- **Backup routes 503** — `server/src/routes/admin/backup.routes.ts:52,70,99,122,145,168`: all endpoints return 503 when `BackupService` absent (unchanged).
- **Tab color token drift** — `AdminAIControlCenterPanel.tsx:99`, `AdminSecurityIdentityPanel.tsx:66`: active tab uses `bg-primary-600`; shell sidebar uses `bg-crimson-*`.
- **Zero UI tests** for `AdminBillingFinOpsPanel`, `AdminAIControlCenterPanel`, `AdminSecurityIdentityPanel`, `AdminAuditLogPanel`.
- **No ACL denial matrix** — no route-level tests proving MEMBER/GUEST cannot call admin mutations (ADM-RAW-P2-006).

### 2c — Superadmin plane: Real / working

- Six-module shell (`Customers`, `AI Platform`, `System`, `Governance`, `Security`, `Configuration`, `Virtual Workers`) — `SuperAdminView.tsx:58,158`.
- `verifySuperAdmin` + `requireSuperAdminCapability` at `router.use` level (`superadmin.routes.ts:345,348`); DB role verified fail-closed on every request.
- `AIBudgetsView` real and mounted (`SecurityModule.tsx:211`) — `/api/ai-budgets/*` with `requireRole('super_admin','admin','owner')` guard.
- `VirtualWorkersModule` mounted and rendered (`SuperAdminView.tsx:158`); Teresa profile/release/preview sub-tabs real.
- AI Platform module: `UsageAnalyticsDashboard`, `ChatTracesViewer`, `HealthMonitoringTab` all mounted under `AIPlatformModule` and `AIOperationsModule`.

### 2d — Superadmin plane: Gaps

- **Alert email delivery stub** — `PresentationGovernanceAlertSubscriptionsView.tsx:1051`: label unchanged, email send is a stub.
- **Backup 503** — same as admin plane.

---

## 3. Teresa Integration

### Depth — what is wired

- **Teresa voice/TTS** — fully governed: `TERESA_VOICE_ENABLED` env flag + Gemini Live server-key check at `v10/teresa.routes.ts:50-65`; `TeresaVoiceContext.tsx` provides fail-closed no-op when provider absent.
- **Superadmin AI Budgets** — `AIBudgetsView.tsx:253-258` calls `/api/ai-budgets/budgets|alerts|stats|model-costs|model-permissions`. `aiBudgetService.ts:165-209` supports org-scoped and user-scoped budget rows with hard-limit flag. Budget alerts fire via `cost-monitoring.service.ts:332`.
- **Org-level AI settings** — `OrgAISettingsView.tsx:192` calls `AdminApi.getOrganizationAISettings` → `/api/ai-settings/org/:id` (mounted at `Gateway.ts:486`); covers policy level, enabled models, daily call limits, monthly token budget, auto-disable on budget exceed.

### Missing — Teresa integration gaps

- **`setBudgetConfig` on cost-monitoring singleton is never called from admin or billing-plan writes** — `cost-monitoring.service.ts:259` defines `setBudgetConfig()` but zero callers outside the file exist in the codebase. Org-level limits written by `adminP32.routes.ts:951-961` (`max_ai_calls_per_day`, `max_total_tokens`) are stored in `organization_limits` DB table, but `ai.routes.ts` never reads `organization_limits` before routing Teresa/chat calls. **Admin can set limits; they have zero runtime enforcement on actual AI calls.** This is the largest governance gap in the module.
- **No per-user Teresa credit budget in admin** — `AccessLimitsTab.tsx:86-145` (in `src/components/Admin/AI/`) implements user-tier assignment with per-tier token limits and cost attribution. The backend route `PUT /api/admin-data/user-tiers/:orgId/:userId` exists at `adminData.routes.ts:40`. However, **this entire sub-tab is never rendered in the admin AI panel** — it lives in an unlinked component tree. Tenant admins have no live UI surface to assign AI tiers or per-user budgets.
- **Teresa framing governance not editable** — the Teresa tenant workspace prompt (`ai.routes.ts:1799-1811`) is hardcoded in server source; no admin surface exists to modify or review it per org.
- **No Teresa-specific admin controls** — no org-level Teresa enable/disable toggle, no Teresa model override per org, no Teresa audit log filter in `AdminAuditLogPanel`.

---

## 4. System Integration

| Handoff | State | File:line |
|---|---|---|
| Admin billing → `organization_limits` | **Working** | `adminP32.routes.ts:943-961` upserts limits |
| `organization_limits` → AI call enforcement | **BROKEN — not wired** | `ai.routes.ts` never reads `organization_limits` |
| Admin billing → cost-monitoring singleton | **BROKEN — not called** | `cost-monitoring.service.ts:259`; no caller |
| Admin billing → Mod 08 self-serve UI | **Working (flag-gated)** | `AdminBillingFinOpsPanel` + `billingAdmin.routes.ts` |
| Admin members → adminP32 audit | **BROKEN** | `AdminMembersRolesPanel.tsx:129,143` → org-members route, no audit |
| Admin AI panel → Admin/AI sub-tabs | **BROKEN — not mounted** | `AdminAIControlCenterPanel.tsx` delegates to `OrgAISettingsView`/`AIModule` only |
| Admin/AI sub-tabs → Superadmin | `UsageAnalyticsDashboard` + `ChatTracesViewer` mounted under superadmin, not admin | `AIPlatformModule.tsx:131`, `AIOperationsModule.tsx:109` |
| AI budget service → Teresa call path | **Gap** | `aiBudgetService.ts` tracks usage post-facto; no pre-call limit check in `ai.routes.ts` |
| Admin → Mod 16 (members) | Cross-route, bypasses capability gate | `AdminMembersRolesPanel.tsx:129,143` |

---

## 5. Completion Plan to 100%

### P0 — Correctness / security blockers

| ID | Gap | File:line | Effort |
|---|---|---|---|
| P0-1 | Wire `organization_limits` enforcement into `ai.routes.ts` — read `max_ai_calls_per_day` + `max_total_tokens` from DB before routing each Teresa/chat call | `ai.routes.ts` + `organization_limits` table | 1d |
| P0-2 | Call `setBudgetConfig()` after every billing-plan write so cost-monitoring singleton reflects live org limits | `adminP32.routes.ts:963-979`, `cost-monitoring.service.ts:259` | 2h |
| P0-3 | Audit member role-change + remove — either route PATCH/DELETE through adminP32 capability gate or add `adminAuditService.logAction` call in the org-members route handler | `AdminMembersRolesPanel.tsx:129,143` + `organizations.routes.ts` | 3h |

### P1 — Quality gaps

| ID | Gap | File:line | Effort |
|---|---|---|---|
| P1-1 | Mount `AccessLimitsTab` in `AdminAIControlCenterPanel` as a third tab — exposes user-tier assignment + per-user AI budget to org admins | `AdminAIControlCenterPanel.tsx:24,120` + `AccessLimitsTab.tsx` | 2h |
| P1-2 | Mount remaining Admin/AI sub-tabs (`PolicyGovernanceTab`, `ModelsProvidersTab`, `AuditComplianceTab`, `FeaturesPrivacyTab`) behind a tabbed `AdminAIControlCenterPanel` with ≥4 tabs | `AdminAIControlCenterPanel.tsx:24` | 4h |
| P1-3 | Replace `billing@example.com` / `finance@example.com` stubs with per-org `billing_alert_email` field in `billing_alerts` table; surface as editable field in Budgets & Tax tab | `adminP32.routes.ts:1236,1243` + DB migration | 3h |
| P1-4 | Add org-level Teresa enable/disable toggle and model-override selector to `OrgAISettingsView` or `AdminAIControlCenterPanel`; persist to `org_ai_settings` | `OrgAISettingsView.tsx` + `ai-settings.routes.ts` | 4h |

### P2 — Coverage + polish

| ID | Gap | File:line | Effort |
|---|---|---|---|
| P2-1 | ACL denial matrix — route-level tests proving MEMBER/GUEST cannot call `/api/admin/billing/plan`, `/api/admin/iam/assignments`, etc. (ADM-RAW-P2-006) | `server/src/routes/__tests__/adminP32.routes.test.ts` | 1d |
| P2-2 | Fix active-tab token: replace `bg-primary-600` with `bg-crimson-600` | `AdminAIControlCenterPanel.tsx:99`, `AdminSecurityIdentityPanel.tsx:66` | 15m |
| P2-3 | UI component tests for `AdminBillingFinOpsPanel`, `AdminAIControlCenterPanel`, `AdminSecurityIdentityPanel`, `AdminAuditLogPanel` | `src/components/Admin/__tests__/` | 1.5d |
| P2-4 | Wire `BackupService` or replace 503 stubs with a documented `501 Not Implemented` response | `server/src/routes/admin/backup.routes.ts:52,70,99,122,145,168` | 2h |
| P2-5 | Superadmin: wire alert-subscription email delivery (`PresentationGovernanceAlertSubscriptionsView.tsx:1051`) to real email provider | `PresentationGovernanceAlertSubscriptionsView.tsx:1051` | 1d |

---

## 6. Owner-Decision Gates

- **D8 (Stripe)** — payment method brand hardcoding (`adminP32.routes.ts:1055`) resolves only after Stripe integration. Does not block P0-P1.
- **Teresa framing governance** — whether org admins should be able to edit the Teresa system prompt per org is an owner decision (product scope). Not coded anywhere today.

---

## Summary

**Admin plane: 67/100.** The five-section shell is genuinely wired with real DB backends and 18 sensitive audit events. The two largest gaps holding it back from 100% are architectural: (1) the billing-plan → `organization_limits` write has zero runtime enforcement on AI calls — `ai.routes.ts` never reads those limits, so the admin AI budget controls are purely cosmetic; (2) the rich Admin/AI sub-tab suite (`AccessLimitsTab`, `PolicyGovernanceTab`, `ModelsProvidersTab` and 5 more) exists and is backend-connected but is never rendered — org admins see only a two-tab AI panel. Member role-change/remove still bypasses the adminP32 capability gate and emits no audit events, leaving the people-plane's most sensitive mutations unlogged.

**Superadmin: 71/100.** Solid — real DB-backed shell, fail-closed guard, Virtual Workers mounted, AI Budgets wired. Residual gaps: alert email delivery stub, backup 503, Teresa framing not editable per tenant.

**Teresa/AI governance: weakest area.** The `organization_limits` → enforcement gap (P0-1 + P0-2) means every AI control configured through admin is decorative until `ai.routes.ts` reads those limits. This must close before v1 GA for the governance story to be credible.
