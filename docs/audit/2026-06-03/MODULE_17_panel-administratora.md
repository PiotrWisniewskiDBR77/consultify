# Module 17 — Panel Administratora — Readiness Scorecard

**Readiness: 67/100 — Tier: Beta — Δ +29 vs baseline 38 (2026-06-02)**
**Route(s):** `/admin/*` (AdminSettingsModule), `/superadmin/*` (SuperAdminView)
**One-line verdict:** The admin plane has been substantially reworked — all five sections (People/Billing/AI/Security/Audit) are now genuinely mounted with real backend routes; the P0 SUPERADMIN boundary hole is closed; but several sub-surface stubs, a tab-color inconsistency, and missing member-mutation audit events keep it from Beta+.

---

## Admin vs Superadmin breakdown

- **Admin (`/admin/*`):** Beta — all 5 nav items render distinct panels; billing, AI, security, and audit are live-wired for the first time. Member role-changes/removes still hit the org-members route (not adminP32's capability-gated path); `bg-primary-600` used for active tabs in AI and Security panels instead of crimson.
- **Superadmin (`/superadmin/*`):** Beta — unchanged from baseline; full six-module shell, real DB-backed routes, `verifySuperAdmin` + `requireSuperAdminCapability` applied at `router.use` level. Backup 503 and email-stub gaps persist.

---

## What's REAL (verified + backend-wired)

**Admin shell — major additions since 2026-06-02:**

- **5 sections fully mounted** — `AdminSettingsModule.tsx:27,143-157` defines `PRIMARY_SECTIONS = ['people','billing','ai','security','audit']` and switches to a distinct panel for each; `AdminSettingsSidebar.tsx:25-65` declares all 5 in `NAV_ITEMS` (was 1).
- **SECTION_ALIASES fixed** — `AdminSettingsModule.tsx:68-92`: `'billing'→'billing'`, `'ai'→'ai'`, `'security'→'security'`, `'audit'→'audit'` (was aliased to `'people'`).
- **Billing & Plans panel** — `AdminBillingFinOpsPanel.tsx:89-200` calls `Api.getAdminBillingSummary/Plans/PaymentMethods/Invoices/Alerts/TaxSettings/UsageDetails` and `Api.assignAdminBillingPlan` → `GET /api/admin/billing/plans` + `PUT /api/admin/billing/plan` (`adminP32.routes.ts:1822,1839`). All real DB writes with `assignBillingPlan()` (lines 863-979), cross-writing `organization_billing`, `organization_limits`, and `organizations`.
- **Manual plan/limit assignment** — `adminP32.routes.ts:863-979`: validates planId against `subscription_plans`, upserts `organization_billing` + `organization_limits` + `organizations`; emits `actionType:'update_billing'` audit at line 1853. GET `/api/admin/billing/plans` returns live DB rows (line 1822). **D8 manual-billing decision satisfied.**
- **AI Controls panel** — `AdminAIControlCenterPanel.tsx:36` calls `Api.getAdminAISummary()` → `GET /api/admin/ai/summary` (adminP32 line 1870); tabs delegate to `OrgAISettingsView` and `AIModule`.
- **Security & Identity panel** — `AdminSecurityIdentityPanel.tsx:78-83` renders 6 sub-panels (policy, collaboration, API-access, IAM, SCIM, risk); all backed by `adminP32.routes.ts` routes (`/security`, `/collaboration`, `/iam/policy`, `/iam/assignments`, `/identity/scim/*`, `/risk/summary`).
- **Audit Log panel** — `AdminAuditLogPanel.tsx:29-31` calls `Api.getTenantAdminAuditLogs`, `getTenantAdminAuditStats`, `getAdminRiskSummary`, `getAdminComplianceSummary` → `GET /api/admin/audit-logs`, `/audit-logs/stats`, `/risk/summary`, `/compliance/summary`.
- **P0 SUPERADMIN boundary — CLOSED** — `ProtectedRoute.tsx:68-73`: explicit check `if (requiredRole === 'ADMIN' && normalizeAppRole(role) === 'SUPERADMIN')` redirects to `/superadmin`. ADM-RAW-P0-001 resolved.
- **Audit coverage** — 18 `isSensitive:true` audit events covering: security policy update, add member, access code generation, billing plan update, IAM policy update, delegated role assign/revoke, payment method add/default/remove, billing alerts/tax update, data-retention policy, SCIM token create/revoke, group-mapping create/delete, collaboration controls. `adminAuditService.logAction()` confirmed at `adminP32.routes.ts:1641-2253`.
- **Cross-org boundary** — `adminP32.routes.ts:300-306`: `orgId !== req.user.organizationId && !isSuperAdmin` → 403 `ADMIN_BOUNDARY_VIOLATION`.
- **Superadmin guard** — `superadmin.routes.ts:345,348`: `router.use(verifyToken)` then `router.use(requireSuperAdmin)` (= `verifySuperAdmin` from `superAdmin.middleware.ts`). DB role verified on every request (middleware line 402-413: fail-closed if DB error → 403). P0 intact.
- **Duplicate dead files** — none found; the " 2"/" 3" suffixed components from baseline are gone.

---

## What's MOCK / stub / incomplete

- **Billing alert `notifyEmails`** — `adminP32.routes.ts:1236,1243`: hardcoded `['billing@example.com']` and `['finance@example.com']`; real email field is not stored per-org.
- **Payment method type** — `adminP32.routes.ts:1055`: brand hard-coded as `'Visa'`; no real Stripe validation.
- **Backup routes** — `server/src/routes/admin/backup.routes.ts:52,70,99,122,145,168`: still return 503 when `BackupService` absent (unchanged from baseline).
- **Superadmin alert email delivery** — `PresentationGovernanceAlertSubscriptionsView.tsx:1051`: label stub unchanged.

---

## What's BROKEN / risk

- **Member role-change / remove not audited** — `AdminMembersRolesPanel.tsx:129,143` calls `Api.updateOrganizationMemberRole` and `Api.removeOrganizationMember` → `PATCH /organizations/:id/members/:id/role` and `DELETE /organizations/:id/members/:id`. These hit the org-members route (Mod 16), NOT adminP32, so they bypass adminP32's capability gate and emit no `adminAuditService.logAction`. ADM-RAW-P1-004 partially resolved (billing/IAM/SCIM writes audited; people writes still unaudited).
- **Tab active color inconsistency** — `AdminAIControlCenterPanel.tsx:99` and `AdminSecurityIdentityPanel.tsx:66` use `bg-primary-600` for active tab state; shell sidebar uses `bg-crimson-*`. Minor visual drift; not a runtime failure.
- **`billing@example.com` notify email** — server-side stub exposed to API consumers; low severity but incorrect data.
- **ACL denial matrix absent** — no route-level tests that MEMBER/GUEST cannot call admin mutations (ADM-RAW-P2-006 open).

---

## Backend wiring

- **Real:** `/api/admin` (adminP32): people GET/POST, access-codes GET/POST, overview, billing (summary/plans/plan/payment-methods/invoices/usage/alerts/tax), ai/summary, iam (policy/assignments), identity/scim (tokens/group-mappings), risk/summary, compliance/summary/data-retention, collaboration, security, audit-logs/stats/export.
- **Real:** `/api/superadmin` (superadmin.routes.ts + billingAdminRoutes): org/user CRUD, impersonation, feature flags, AI governance/quality, model registry, observability, analytics, DLP, security events, IAM/audit sessions.
- **Missing/broken:** Backup `503`; notify-email per-org store; member role-change/remove not through adminP32 capability gate.

---

## UI/UX adherence

- Shell: `bg-slate-50 dark:bg-navy-950`, content cards `rounded-2xl`, sidebar active state `bg-crimson-50 border-crimson-200` — correct.
- Active tab buttons inside AI and Security panels use `bg-primary-600` — inconsistent with crimson system.
- Responsive mobile sidebar (hamburger) present and functional.

---

## Cross-module handoffs

- **Mod 08 (Billing):** `PUT /api/admin/billing/plan` + `/billing/plans` satisfies D8 manual-invoice-first requirement. Writes canonical `organization_billing` + `organization_limits` tables read by mod 08 access policy. Wired.
- **Mod 16 (Org/Members):** People panel still delegates member invite/role/remove to `/api/organizations/:id/members/*` (Mod 16 routes) rather than adminP32's own member endpoints. This bypasses capability gates and audit — functional but architecturally fragmented.

---

## Tests

- Server: `adminP32.routes.test.ts` covers billing summary + IAM; `analytics-superadmin.routes.test.ts`, `SSOConfigurationView.test.tsx` real.
- UI: zero component tests for `AdminBillingFinOpsPanel`, `AdminAIControlCenterPanel`, `AdminSecurityIdentityPanel`, or `AdminAuditLogPanel` — newly mounted but untested.

---

## Top gaps to reach market-ready (prioritized)

1. **[P1] Audit member role-change and remove** — either route `PATCH/DELETE /organizations/:id/members/*` through adminP32 with `logAction`, or add `adminAuditService.logAction` calls in the org-members route. Resolves ADM-RAW-P1-004 remainder.
2. **[P1] Fix notify-email storage** — replace `billing@example.com` / `finance@example.com` stubs with per-org email field in `billing_alerts` table; surface as an editable field in the Budgets & Tax tab.
3. **[P2] Align active-tab token** — `AdminAIControlCenterPanel.tsx:99` and `AdminSecurityIdentityPanel.tsx:66`: replace `bg-primary-600` with `bg-crimson-600` to match shell sidebar.
4. **[P2] ACL denial matrix tests** — add route-level tests proving MEMBER/GUEST cannot call `/api/admin/billing/plan`, `/api/admin/iam/assignments`, etc. (ADM-RAW-P2-006).
5. **[P3] Backup service** — wire `BackupService` or remove the `503` stubs from `admin/backup.routes.ts`.
