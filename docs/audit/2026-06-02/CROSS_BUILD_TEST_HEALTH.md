# Cross-Cutting — Build / Type / Test / CI Health

**Health grade: C — solid CI structure & test breadth, but 3 active red signals: 5 unit tests failing locally (mock contract broken), 2 E2E smoke failures (flaky wizard + finance lane timeout), and a 183-file " 2" duplicate-file debris cluster that will silently shadow canonical files.**

---

## Current test results (from artifacts)

### Unit tests (`vitest.out` — last local run, 2026-06-02)
- **5 tests FAILING** in `tests/unit/api.test.ts` — "Frontend API Circuit Breaker" suite.
- Root cause: `clearGlobalTransportFailure` is not exported from the `@/services/api` mock. The Phase 0 chat-security work likely added this export to the real module but the test mock was not updated. All 5 tests fail on `beforeEach` before any assertion runs.
- 7 suites / 14 tests PASSING (composer command palette unit tests — last committed suite).

### E2E smoke (`e2e-results.xml` — 2026-06-02 local run)
- Total: 38 tests, **2 failures**, 11 skipped.
- **FAILURE 1** — `interview-initiative-wizard.spec.ts:213`: `initiative-wizard-modal` heading never visible after 10 s (retried 3x, persistent). Likely a timing/selector issue introduced by a recent modal refactor.
- **FAILURE 2** — `p05-finance-lane.spec.ts:43`: `POST /api/v8/finance/lane/start` times out at 15 s (retried 3x). Finance lane AI endpoint is either missing or too slow locally.
- 35 passing / 11 skipped (downstream of the first failure).

### QA E2E (`e2e-results-qa.xml` — 2026-05-18)
- 1/1 tests passed (radar gate). Stale — 2-week-old artifact.

### Component tests (`tests/components/junit.xml`)
- 0 suites, 0 tests. The component test run was empty/aborted in the last recorded run (success=false). Likely ran against an empty glob.

---

## Test strategy & layers

| Layer | Config | Purpose |
|---|---|---|
| L1 | `vitest.l1.config.ts` | Per-file 95% coverage gate — utility/pure functions |
| L2 | `vitest.l2.config.ts` | Per-file 95% coverage gate — services/hooks |
| L3 | `vitest.l3.config.ts` | Per-file 95% coverage gate — API/server integration |
| Unit | `vitest.config.ts` | General unit suite (sharded 4-way in CI) |
| Server | `server/vitest.config.ts` | Backend unit tests |
| Security | `vitest.security.config.ts` | Security-focused tests (non-PR only) |
| Performance | `vitest.perf.config.ts` + `vitest.migration.config.ts` | DB perf + migration tests (non-PR only) |
| E2E Smoke | `playwright.smoke.config.ts` | Tier-0 deterministic UI smoke |
| E2E Full | `playwright.config.ts` | Full Playwright suite |
| E2E QA | `playwright.qa.config.ts` | QA-environment targeted smoke |

CI also runs: skip/only gate, test-quality anti-placeholder check, flaky tracker, patch coverage gate (≥80% on changed files), critical-path 95% coverage for 4 security middleware files.

---

## Coverage distribution

| Area | Test files | Notes |
|---|---|---|
| `src/` (frontend) | 93 `.test.ts/.tsx` in src/ | Heavily concentrated in `src/utils/__tests__/` (flag utilities, trust badge, voice). Only **53 component `.test.tsx` files** vs **1,924 component `.tsx` files** — ~2.75% component test coverage. |
| `tests/unit/` | 590 files | Broad unit coverage of services, API, utilities |
| `tests/integration/` | 319 files | Integration tests sharded 3-way in CI |
| `server/src/` | 375 `.test.ts` | Good backend coverage |
| `tests/e2e/` | 169 `.spec.ts` | Strong E2E breadth across module smokes |

**Confirmed sparse area:** Frontend React component tests. 1,924 component files, 53 test files = 2.75% coverage. The component test job last ran with 0 results, suggesting glob or config is broken.

---

## TypeScript health

| Metric | Count |
|---|---|
| `@ts-nocheck` files | **207 files** (223 occurrences) |
| `@ts-ignore` | 22 |
| `@ts-expect-error` | 33 |
| `: any` in `src/` | ~4,822 occurrences |
| `: any` in `server/src/` | ~5,828 occurrences |

**Critical escape hatch:** `server/package.json` sets `"build": "tsc --noCheck"`. The server compiles to JS in production without any type validation. The `typecheck` and `type-check:backend` scripts exist and run `tsc --noEmit`, but they are only invoked in the CI `lint-typecheck` job — not in the production build path. A type error introduced locally would ship to Railway without failing the build step.

207 files with `@ts-nocheck` is a severe signal. Combined with 10,650 `: any` occurrences across both packages, TypeScript is providing minimal safety net over a large fraction of the codebase.

---

## Lint health

| Metric | Count |
|---|---|
| `eslint-disable` in `src/` | 107 |
| `eslint-disable` in `server/src/` | 32 |
| TODO/FIXME/HACK in `src/` | 41 |
| TODO/FIXME/HACK in `server/src/` | 250 |

250 server-side TODO/FIXME/HACK markers is high — suggests accumulated unresolved debt, especially in wave-series services. ESLint is gated in CI (`npm run lint` blocks PR), which limits regression, but the existing suppressions are not tracked or decaying.

---

## Code debris (messy-merge indicators)

| Type | Count |
|---|---|
| `" 2.ts"` / `" 2.tsx"` duplicates in `src/` | **156 files** |
| `" 2.ts"` duplicates in `server/src/` | **27 files** |
| `_backup` directory in `server/src/` | 1 (`ts-js-collisions/`) |
| `_quarantine/` at root | 2 snapshot archives + `docs-duplicates/` |
| `.codex-worktrees/` directories | L1, L2, L3, L4 (4 active worktrees) |

183 total `" 2"` phantom files in `src/` + `server/src/` are the most dangerous debris. These are macOS Finder-style collision copies (e.g. `api 2.ts` alongside `api.ts`). TypeScript does not import them by default, but any tooling that globs `**/*.ts` (eslint, coverage, test discovery) may pick up the doubles, silently doubling counts or causing import resolution surprises. The `src/services/api 2.ts` duplicate is particularly concerning given the failing circuit-breaker tests reference `@/services/api`.

---

## CI gates

| Workflow | Trigger | What it enforces |
|---|---|---|
| `test-suite.yml` | push/PR to `main`/`develop` | Lint+typecheck, security integrity (29 checks), npm audit gate, skip/only scan, anti-placeholder quality check, unit (4 shards), component, integration (3 shards), E2E Tier-0, readiness smoke, L1/L2/L3 coverage gates (95%), patch coverage (≥80%), performance (non-PR), security tests (non-PR) |
| `railway-deploy.yml` | push to `develop` | Railway staging/production deploy gate |
| `e2e-nightly.yml` | nightly | Extended E2E nightly run |
| `e2e-weekly.yml` | weekly | Full E2E weekly sweep |
| `security-scan.yml` | scheduled | Dependency/SAST scan |
| `domain-closure-smoke.yml` | PR | Domain-closure smoke |
| `module-contract-rerun.yml` | on-demand | Module contract re-verification |
| `i18n-check.yml` | PR | i18n key drift check |

**PR gate blocker note:** Most heavy jobs (unit, integration, E2E, coverage) are deferred on PRs targeting non-`main`/`develop` branches. PRs to the current branch (`feat/ee-deliverables-unification`) skip these gates entirely — only lint, typecheck, security-integrity, skip-scan, and anti-placeholder run.

---

## Prioritized fixes

1. **Fix the `api.test.ts` mock contract** (`tests/unit/api.test.ts`) — `clearGlobalTransportFailure` must be re-exported from the `vi.mock` factory for `@/services/api`. 5 tests are currently broken; this is a quick fix.

2. **Add `tsc` to server production build** — Remove `--noCheck` from `server/package.json` `build` script (or add a pre-build typecheck step). Type errors currently ship silently to Railway.

3. **Purge the 183 `" 2"` duplicate files** — Bulk-delete all `src/**/* 2.ts`, `src/**/* 2.tsx`, `server/src/**/* 2.ts`. These are Finder collision copies with no canonical references; they pollute coverage counts and tool globbing.

4. **Fix the component test glob** (`tests/components/junit.xml` shows 0 tests ran) — The component test job is effectively dead. Identify the broken glob/config and restore it; 1,924 components have near-zero direct test coverage.

5. **Investigate E2E initiative wizard failure** (`interview-initiative-wizard.spec.ts:213`) — `initiative-wizard-modal` heading is not found. Likely a `data-testid` change or modal render timing regression. Reproducible across 3 retries.

6. **Investigate finance lane timeout** (`p05-finance-lane.spec.ts:43`) — `POST /api/v8/finance/lane/start` times out at 15 s. Check if the route is registered and the AI job queue is initializing in the test server setup.

7. **Reduce `@ts-nocheck` surface** — 207 files is a structural risk. Prioritize removing `@ts-nocheck` from server service files first (wave services have the most TODO debt and are also least tested by type system).
