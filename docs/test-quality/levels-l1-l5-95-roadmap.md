# Test Quality Roadmap (L1–L5) — 95% Gates + Checklist

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

**Gate files (coverage.include):**

- [ ] `server/src/middleware/auth.middleware.ts`
- [ ] `server/src/middleware/csrf.middleware.ts`
- [ ] `server/src/middleware/permission.middleware.ts`
- [ ] `server/src/middleware/inputSanitization.middleware.ts`
- [ ] `server/src/services/accessPolicyService.ts`

**Checklist:**

- [ ] For each gate file: statements/lines/functions ≥ 95%
- [ ] Branches ≥ 80% (minimum), then tighten later if helpful
- [ ] Add tests only for real branches (no “coverage padding”)
- [ ] (Optional) Expand L1 scope with `server/src/middleware/rateLimiting.middleware.ts` and add real unit tests

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

---

## L3 — Integration (no listen(), real routes + db) (95% per-file gate)

**Goal:** run “real” route stacks in-process (Express `app.handle` dispatch) without binding ports.

**Gate command:**

- `npm run test:l3:coverage`

**Gate files (per-file thresholds):**

- [ ] `server/src/routes/securityPolicies.routes.ts`
- [ ] `server/src/routes/security/roles.routes.ts`

**Checklist:**

- [ ] Add next router/controller integration suite (one slice at a time)
- [ ] DB is real (sqlite per-worker file), no “mock server” that never touches our routes
- [ ] Expand L3 gate list only when tests exist to sustain it

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
