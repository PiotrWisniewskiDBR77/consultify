# Test Quality Roadmap (L1–L5) — 95% Gates + Checklist

Last updated: 2026-02-21

This roadmap is designed to be **honest**:

- **No placeholder tests** (no `expect(true).toBe(true)`, no fake inline implementations pretending to test real code).
- **95% coverage applies only to the explicitly scoped “gate files” per level** (per-file thresholds), not to the whole repo.
- L4/L5 are **not** “95% coverage” levels — they are runtime/e2e and integrity/security/perf gates.

> How to refresh status at any time:
>
> - `npm run test:quality-check`
> - `npm run test:l1:coverage`
> - `npm run test:l2:coverage`
> - `npm run test:l3:coverage`
> - `npm run test:l4`
> - `npm run test:l5`

---

## ✅ Global Integrity (always-on)

- [ ] `npm run test:quality-check` passes (0 `PLACEHOLDER`, 0 `FAKE_UNIT`, 0 `FAKE_INTEGRATION`)
- [ ] `FAKE_INTEGRATION_RISK` driven to 0 (then enable `QUALITY_CHECK_FAIL_ON_RISK=1` in CI)
- [ ] `npm run test:security` passes (no `listen()`-based flakiness)
- [ ] `npm run test:unit:critical` passes
- [ ] `npm run test:levels` passes (L1→L5 pipeline)

---

## L1 — Unit / Security Boundary (95% per-file gate)

**Goal:** 95%+ coverage on critical server boundary code (auth/csrf/permission/sanitization/policy).

**Gate command:**

- `npm run test:l1:coverage`

**Gate files (per-file thresholds; source of truth: `scripts/testing/coverage-thresholds.ts --profile l1`):**

- [ ] `server/src/middleware/auth.middleware.ts`
- [ ] `server/src/middleware/csrf.middleware.ts`
- [ ] `server/src/middleware/permission.middleware.ts`
- [ ] `server/src/middleware/inputSanitization.middleware.ts`
- [ ] `server/src/services/accessPolicyService.ts`

**Checklist:**

- [ ] For each gate file: statements/lines/functions ≥ 95%
- [ ] Branches ≥ 80% (minimum), then tighten later if helpful
- [ ] Add tests only for real branches (no “coverage padding”)

**2026-02-21 expansion candidates (recent code added/changed; add only with real tests):**

- [ ] `server/src/middleware/rateLimitUserId.middleware.ts`
- [ ] `server/src/middleware/resourceQuota.middleware.ts`
- [ ] `server/src/utils/security.utils.ts`

Notes:
- Current L1 coverage include list (`vitest.l1.config.ts`) also contains `server/src/utils/cookieAuth.ts` and `server/src/utils/piiRedactor.ts`, but they are not enforced by the per-file threshold tool yet. Decide whether to:
  - add them to L1 thresholds (preferred if they are boundary-critical), or
  - remove them from `coverage.include` to keep L1 scoped to enforced gates only.

---

## L2 — Component/UI (95% per-file gate)

**Goal:** 95%+ coverage on selected UI boundary components (auth + navigation + organization refactor).

**Gate command:**

- `npm run test:l2:coverage`

**Gate files (per-file thresholds):**

- [ ] `views/auth/LoginView.tsx`
- [ ] `src/components/auth/MFASetup.tsx`
- [ ] `src/components/auth/MFAChallenge.tsx`
- [ ] `src/components/navigation/Sidebar/menuConfig.ts`
- [ ] `src/components/navigation/Sidebar/Sidebar.tsx`
- [ ] `src/components/navigation/Sidebar/NavItem.tsx`
- [ ] `src/components/navigation/Sidebar/SidebarFooter.tsx`
- [ ] `src/components/navigation/Sidebar/SidebarHeader.tsx`
- [ ] `src/components/navigation/Sidebar/FloatingSubmenu.tsx`
- [ ] `src/views/OrganizationView.tsx`
- [ ] `src/components/Organization/OrganizationSidebar.tsx`

**Checklist:**

- [ ] Organization entry is a single Sidebar item (no subItems)
- [ ] `/organization/*` routes work and internal sidebar switches sections
- [ ] Mobile behavior: open/close internal sidebar works (overlay + buttons)
- [ ] For each gate file: statements/lines/functions ≥ 95%, branches ≥ 80%

**2026-02-21 expansion candidates (UI/UX + AI Chat; add only after wiring them into L2 runner):**

- [ ] Add `tests/components/AIChat/**/*.{test,spec}.{ts,tsx}` into the L2 runner (`vitest.l2.config.ts`) so these tests actually execute under `test:l2:coverage`.
- [ ] Add per-file thresholds for:
  - `src/components/AIChat/UnifiedChatPanel.tsx`
  - `src/components/AIChat/CoThinkerModeSelector.tsx`
  - `src/components/AIChat/ToolsMenu.tsx`
  - `src/components/AIChat/ConversationList.tsx`

---

## L3 — Integration (no listen(), real routes + db) (95% per-file gate)

**Goal:** run “real” route stacks in-process (Express `app.handle` dispatch) without binding ports.

**Gate command:**

- `npm run test:l3:coverage`

**Gate files (per-file thresholds; source of truth: `vitest.l3.config.ts` + `scripts/testing/coverage-thresholds.ts --profile l3`):**

- [ ] `server/src/routes/securityPolicies.routes.ts`
- [ ] `server/src/routes/security.routes.ts`
- [ ] `server/src/routes/security/roles.routes.ts`
- [ ] `server/src/routes/notifications/notificationSettings.routes.ts`
- [ ] `server/src/routes/loginHistory.routes.ts`
- [ ] `server/src/routes/verify.routes.ts`
- [ ] `server/src/routes/mcp.routes.ts`
- [ ] `server/src/routes/audit.routes.ts`
- [ ] `server/src/routes/auditLog.routes.ts`
- [ ] `server/src/routes/systemHealth.routes.ts`
- [ ] `server/src/routes/db-metrics.routes.ts`
- [ ] `server/src/routes/status.routes.ts`
- [ ] `server/src/routes/status-reports.routes.ts`
- [ ] `server/src/routes/stabilization.routes.ts`
- [ ] `server/src/routes/apiKeys.routes.ts`
- [ ] `server/src/routes/healthRoutes.ts`
- [ ] `server/src/routes/health.routes.ts`
- [ ] `server/src/controllers/HealthCheckController.ts`

**Checklist:**

- [ ] Add next router/controller integration suite (one slice at a time)
- [ ] DB is real (sqlite per-worker file), no “mock server” that never touches our routes
- [ ] Expand L3 gate list only when tests exist to sustain it

**2026-02-21 expansion candidates (recent platform changes; prefer deterministic “DB + guards” routes first):**

- [ ] Billing/admin analytics (existing integration coverage suggests good ROI):
  - `server/src/routes/billing/billing.routes.ts`
  - tests: `tests/integration/routes/billing*.test.*`, `tests/integration/superadmin-revenue-api.test.ts`
- [ ] Stripe webhook route (only if we can keep it honest + deterministic without “fake Stripe”):
  - `server/src/routes/webhooks/stripe.routes.ts`

---

## L4 — E2E (Playwright) readiness (runtime gate)

**Goal:** stable browser workflows (no `test.skip`, deterministic webServer).

**Gate command:**

- `npm run test:l4`
- Full suite (non-gating / nightly): `npm run test:e2e:full`

**Checklist:**

- [ ] Smoke suite is tiny and stable (`tests/e2e/smoke/**`)
- [ ] `playwright` suite passes in CI mode
- [ ] No `test.skip` in critical flows (login, navigation, one core module happy path)
- [ ] WebServer starts reliably (no `tsx` IPC issues; no privileged bind)
- [ ] Results artifacts collected (`test-results/` output)
- [ ] Add/keep smoke coverage for “recently expanded surface area”:
  - AI Chat panel render + basic interaction
  - One hub navigation path (Execution / Benefits / Finance) that proves routing + auth context

---

## L5 — Security + Performance integrity (runtime & guardrails)

**Goal:** integrity gates that prevent regressions and “testing theatre”.

**Gate command:**

- `npm run test:l5`

**Checklist:**

- [ ] `npm run test:quality-check` passes
- [ ] `npm run security:integrity` passes
- [ ] `npm run test:security` passes (no port-binding tests)
- [ ] `npm audit --audit-level=high` passes (dependency remediation may be required; see `docs/security/npm-audit-remediation.md`)
- [ ] `npm run test:performance` passes (only “real” perf tests; no placeholders)
- [ ] (Optional but recommended) `npm run deploy:gate` passes locally and in CI for release branches
