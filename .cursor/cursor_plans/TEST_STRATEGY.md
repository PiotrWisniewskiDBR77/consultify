# Consultify — Test Strategy (5 Levels)

## Goals
- **Security-first**: prioritize correctness for auth, permissions, tenant isolation, billing, webhooks, legal/export.
- **Determinism**: tests must be repeatable locally and in CI (no real external API calls).
- **Fast feedback**: unit + component tests should be fast; integration and E2E are slower but stable.
- **Coverage as a tool**: maximize meaningful coverage; apply stricter gates to critical modules.

## Test Levels

### Level 1 — Unit (Pure Logic)
**What**: logic with no I/O (parsers, validators, policy engines, transformers, routers).  
**How**: Vitest, isolated dependencies (stubs/mocks).  
**Rule**: if a module mixes logic and DB/network, carve out pure helpers and test those here.

### Level 2 — Integration (API + DB)
**What**: Express routes + middleware + DB behavior + authorization boundaries.  
**How**: Supertest against the real Express app; SQLite `:memory:` fixtures; external integrations stubbed.  
**Rule**: critical flows must be covered here even if unit tests exist.

### Level 3 — Component (React)
**What**: critical UI components and views: render + state + validation + permission-driven UI.  
**How**: Testing Library + Vitest (jsdom).  
**Rule**: avoid snapshot spam; assert behaviors.

### Level 4 — E2E (User Flows)
**What**: top user journeys and regressions.  
**How**: Playwright with `webServer` + deterministic LLM stub.  
**Rule**: keep E2E minimal but high value; no flaky time-based tests.

### Level 5 — Performance
**What**: regressions of latency/throughput/memory for critical endpoints and DB hotspots.  
**How**: Vitest perf config + autocannon where appropriate; budget thresholds.  
**Rule**: baseline first, then enforce budgets.

## Environment Rules
- **No real external calls** in automated tests (LLM, Stripe, SMTP, etc.). Use stubs/mocks.
- **SQLite `:memory:`** is the default DB for integration tests.
- **Time/UUID**: prefer controlled clock and deterministic UUID in tests (avoid flakes).

## Naming / Placement
- Unit: `tests/unit/**`
- Integration: `tests/integration/**`
- Component: `tests/components/**`
- E2E: `tests/e2e/**`
- Performance: `tests/performance/**`


