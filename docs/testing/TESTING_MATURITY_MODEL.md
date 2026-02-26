# Testing Maturity Model

| Field | Value |
|-------|-------|
| Last assessed | 2026-02-26 |
| Current level | **Level 4 → Level 5** (5/6 L5 criteria met, advancing) |
| Assessed by | Engineering Lead |
| Related | [Quality Scorecard](quality-scorecard.json) · [Test Plan](PLAN_ROZWOJU_SYSTEMU_TESTOW_AUTOMATYCZNYCH_2026-02-26.md) |

---

## Model Overview

The Testing Maturity Model defines five levels of engineering quality practice. Each level builds on the previous one. This assessment maps Consultify's current state against each level with concrete evidence from the codebase and CI pipeline.

```
Level 5 ─ Continuous Improvement    ◻ 5/6 (advancing)
Level 4 ─ Automated Governance      ✅ Complete
Level 3 ─ Quality Enforcement       ✅ Complete
Level 2 ─ Structured Coverage       ✅ Complete
Level 1 ─ Basic Testing             ✅ Complete
```

---

## Level 1 — Basic Testing

> Tests exist and run in CI.

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Unit tests exist | ✅ | 211 unit test files (`tests/unit/`) |
| Tests run in CI on every push | ✅ | `test-suite.yml` triggers on push + PR |
| Test failures block deployment | ✅ | PR required checks in GitHub branch protection |
| Test framework is standardized | ✅ | Vitest (unit/component/integration) + Playwright (E2E) |

**Verdict: PASSED**

---

## Level 2 — Structured Coverage

> Coverage is measured, tracked, and enforced at meaningful thresholds.

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Global coverage threshold ≥ 80% | ✅ | `vitest.config.ts`: 85% statements/functions/lines |
| Per-file coverage on critical paths ≥ 95% | ✅ | `vitest.l1.config.ts`, `vitest.l2.config.ts`, `vitest.l3.config.ts` — 95% per-file |
| Coverage gates block PR merge | ✅ | CI jobs: `levels-coverage-gates`, `critical-path-coverage` |
| Coverage report archived as artifact | ✅ | `coverage-report` artifact, 30-day retention |
| Test layers are defined (unit/component/integration/e2e) | ✅ | L1–L5 model in CI with dedicated configs per layer |
| Patch coverage enforced on PRs | ✅ | `patch-coverage` job: ≥ 80% on changed files |

**Verdict: PASSED**

---

## Level 3 — Quality Enforcement

> Automated gates prevent low-quality code from merging. False/placeholder tests are detected.

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Anti-placeholder gate | ✅ | `quality-check.ts`: blocks PLACEHOLDER, FAKE_UNIT, FAKE_INTEGRATION |
| Skip/Only gate | ✅ | `skip-scan-gate.ts`: zero-tolerance `.only()`, managed `.skip()` with TTL allowlist |
| Security integrity gate (P0) | ✅ | `verify-security-integrity.ts`: 29 automated checks (CSRF, auth, CORS, JWT, encryption, CSP, HSTS…) |
| npm audit gate (CVE blocking) | ✅ | `npm-audit-gate.ts`: blocks high/critical vulnerabilities |
| Linting + type checking enforced | ✅ | `lint-typecheck` job: ESLint + tsc on every PR |
| All PR gates have explicit timeouts | ✅ | `timeout-minutes` on all 17 CI jobs (3–25 min) |

**Verdict: PASSED**

---

## Level 4 — Automated Governance

> Quality is measured per module. Policies exist for flaky tests, high-risk changes, and test debt.

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Quality scorecard per module | ✅ | `scripts/testing/quality-scorecard.ts` — 12 modules tracked, 0 F grades, critical avg 95/100 |
| Test impact analysis | ✅ | `scripts/testing/test-impact-analysis.ts` — source→test mapping |
| Flaky test tracking infrastructure | ✅ | `scripts/testing/flaky-test-tracker.ts` — registry + quarantine |
| Skip allowlist with TTL + owner | ✅ | `scripts/testing/skip-allowlist.json` — expiration dates enforced |
| Tiered E2E strategy (Tier-0 PR / Tier-1 nightly) | ✅ | Tier-0: 5 files (PR gate), Tier-1: 18 files (nightly) |
| CI differentiates PR gates vs nightly | ✅ | Clear PR-blocking vs `github.event_name != 'pull_request'` jobs |
| Integration tests sharded for speed | ✅ | 3-way sharding on integration tests |
| Baseline metrics documented | ✅ | `docs/testing/baseline-metrics.json` — 738 test files, module distribution |
| Definition of Done for high-risk areas | ✅ | Auth, Billing, Permissions require negative tests + security coverage |
| JUnit artifacts + summary dashboard | ✅ | All test jobs upload JUnit XML, `test-summary` parses + reports |

**Verdict: PASSED**

---

## Level 5 — Continuous Improvement

> Quality trends are tracked over time. Monthly audits drive improvement. Testing scales with team growth.

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Monthly L1–L5 audit with trend data | ✅ | `scripts/testing/monthly-audit.ts` + `docs/testing/audits/` archive |
| Quality trend dashboard (30-day rolling) | ✅ | `e2e-nightly.yml` SLO dashboard + `test-summary` JUnit parsing |
| Test debt reduction plan (top 5 items) | ✅ | Monthly audit auto-generates top debt items (P0/P1 prioritized) |
| Rotational Quality Champion per sprint | 🔲 | Process defined in test plan, not yet operational |
| DD checklist 100% complete | ✅ | `docs/due-diligence/TECH_DD_CHECKLIST.md` maintained |
| Testing Maturity Model documented | ✅ | This document |

**Verdict: NEARLY COMPLETE (5/6 criteria met — only operational rotation pending)**

---

## Evidence Summary for VC Auditors

### Automated Quality Gate Stack (every PR)

```
PR opened
 │
 ├── lint + typecheck (ESLint + tsc)
 ├── quality-check (anti-placeholder, 8 test classifications)
 ├── skip-scan (zero .only(), managed .skip() with TTL)
 ├── security-integrity (29 checks: CSRF, auth, CORS, JWT, CSP, HSTS, encryption…)
 ├── L1–L3 coverage gates (95% per-file on critical paths)
 ├── critical-path coverage (95% on auth/csrf/permission middleware)
 ├── patch coverage (≥80% on changed files)
 ├── unit tests (4 shards)
 ├── component tests (8 shards)
 ├── integration tests (3 shards + PostgreSQL)
 └── E2E Tier-0 smoke (5 test files, ~40 scenarios)
      │
      └── All pass → merge allowed
```

### Key Metrics

| Metric | Value |
|--------|-------|
| Test files | 738 |
| Quality gates | 7 (lint, quality-check, skip-scan, security-integrity, L1–L3 coverage, critical-path, patch-coverage) |
| Security integrity checks | 29 |
| Coverage (global) | ≥ 85% threshold (96% actual) |
| Coverage (critical paths) | ≥ 95% per-file |
| Patch coverage (PR) | ≥ 80% |
| CI jobs | 17 |
| CI job timeouts | Explicit on all jobs (3–25 min) |
| Skip allowlist entries | 1 (with expiration date) |
| Tier-0 smoke scenarios | ~40 across 5 test files |
| Integration test sharding | 3-way |
| Unit test sharding | 4-way |

### Artifacts Available on Request

| Artifact | Location | Format |
|----------|----------|--------|
| Quality scorecard | `docs/testing/quality-scorecard.json` | JSON |
| Baseline metrics | `docs/testing/baseline-metrics.json` | JSON |
| Test plan | `docs/testing/PLAN_ROZWOJU_SYSTEMU_TESTOW_AUTOMATYCZNYCH_2026-02-26.md` | Markdown |
| CI workflow | `.github/workflows/test-suite.yml` | YAML |
| Security integrity gate | `scripts/security/verify-security-integrity.ts` | TypeScript |
| Coverage configs | `vitest.l1.config.ts`, `vitest.l2.config.ts`, `vitest.l3.config.ts` | TypeScript |
| Skip allowlist | `scripts/testing/skip-allowlist.json` | JSON |

---

## Roadmap to Level 5

| Item | Target | Status |
|------|--------|--------|
| Monthly automated audit report | Q1 2026 | Planned |
| Quality trend dashboard | Q1 2026 | Planned |
| Test debt reduction backlog | Q1 2026 | Planned |
| Quality Champion rotation | Q2 2026 | Process defined |

---

*This document is reviewed monthly as part of the L1–L5 testing audit.*
