# TBL-FU-C7-3 — AI Operator DB-Backed Integration Tests

**Source sprint:** Block C / C-S7
**Filed:** 2026-05-08
**Priority:** P2
**Status:** `OPEN`
**Owner:** Agent A (backend) + Agent D (QA)

## Why this exists

The validation matrix L4.1–L4.7 calls for DB-backed integration tests. Block C ships unit tests with mocked `getDatabase()` instead, because the existing `tablePlatform` test suite doesn't have an integration-test harness wired up. The mocked unit suite is comprehensive (115 tests) but doesn't catch SQL errors, migration drift, or RETURNING-clause assumptions.

## Scope

1. Add a `vitest --project integration` config that boots a Postgres container or uses an existing testcontainers helper.
2. Run all four migrations (`20260508_block_c_ai_operator.sql`, `20260509_block_c_qa_engine.sql`, `20260510_block_c_source_pack.sql`, plus prerequisites).
3. Port the following critical paths to integration tests:
   - L4.1 — AI Editor cell level: propose → apply → record updated.
   - L4.4 — Token budget hard cap → 429.
   - L4.5 — QA report persisted + retrievable.
   - L4.6 — Source pack creation + V8 snapshot round-trip.
   - L4.7 — Super-admin gate at HTTP layer.
4. Wire to CI as a separate workflow (don't block the unit suite).

## Out of scope

- E2E tests through the frontend (that's TBL-FU-C7-4 / Playwright).
- Multi-tenant load testing.

## Definition of done

- 5+ integration tests landing in `server/src/services/tablePlatform/__integration__/`.
- CI workflow runs them on PR; failure blocks merge.
