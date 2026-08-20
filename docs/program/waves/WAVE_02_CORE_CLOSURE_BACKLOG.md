# Consultify — Wave 02 Core Closure backlog

Status: `READY_AFTER_WAVE_01_PASS`

## P1 — Finance exact-six schema and owner flow

Source packet: `f5c6a7f16f95a6b800afb19b08832d2c6930514c`.

Owned paths:

- one new late Finance migration;
- `server/src/services/financialStatementService.ts` schema preflight;
- `server/src/services/statementMultiSectionImportService.ts` error propagation;
- the exact real-PG owner acceptance test;
- only necessary baseline/bootstrap definition that resurrects the obsolete index.

DoD: obsolete index absent, period-aware index exact, red/green drift test, fresh+late+repeat+dry migration proof, mounted exact-six → map → confirm → receipt → downstream → cold readback. No production database.

Fan-in order: first.

## P2 — Results writers and Transform runtime

Canonical sources are already integrated; do not recover old implementation branches.

Owned scope:

- inventory five Results null-successor writers;
- decision per writer: canonicalize, build successor or approved-out;
- usage telemetry fixture and backfill/readback where required;
- real Transform owner flow with durable lineage, negative tenant control and rollback.

DoD: no null-successor ambiguity in MVP scope; no synthetic-only acceptance.

Fan-in order: second, after P1 only if shared migrations or Finance lineage are touched; otherwise may execute in parallel.

## P3 — Federated Teresa/UI manifest

Owned scope:

- new read-only federation contract and adapters;
- adapters for Idea, Dynamic SWOT, Chat, Execution and Case Workspace first;
- mounted-route denominator and CI failure on `MISSING`/duplicate IDs;
- no new executor and no copied manual registry.

DoD: every mounted mutation in these MVP modules exposes role, tenant, effect, preview/confirm, idempotency, receipt/audit, compensation and UI/Teresa executor identity; unsupported entries are explicit.

Fan-in order: third. May be developed in parallel but integrates only after P1/P2 shared API review.

## P4 — Dynamic SWOT bounded owner header

Protected worktree: `/private/tmp/consultify-uia001-owner-header-fix-8e5c`.

Eligible paths only:

- `src/components/DiscoveryTools/KnownToolDetailView.tsx`;
- `src/components/shared/NModeLayout/NModeHeader.tsx`;
- `src/components/shared/NModeLayout/NModeShell.tsx`;
- `src/components/shared/NModeLayout/types.ts`;
- `src/components/shared/NModeLayout/__tests__/NModeHeader.ownerActions.test.tsx`.

DoD: compare each path against current canon, port only missing owner-facing behavior, focused tests + typecheck + mounted browser proof, clean commit. Reject broad branch diff.

Fan-in order: fourth; this is UI-adjacent and must not interfere with core schema work.

## Integrator gate after every fan-in

- exact source and target SHA recorded;
- `git diff --check`;
- no duplicate route/writer/action ID;
- focused positive and negative tests;
- real PostgreSQL for persistence changes;
- root/server typecheck for shared contracts;
- clean candidate before next fan-in.

Maximum three active packets. P4 starts only when one of P1–P3 has reached review or stop-loss.
