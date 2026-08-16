# Lane B — final handoff

```text
LANE: Claude B — transformation core (Decisions/Tasks/Agent, Initiatives, Execution)
BRANCH: codex/closure-claude-b-transformation
BASELINE_SHA: 64f507859c717494ffa5e83fae550173c9382230
HEAD_SHA: see `git rev-parse HEAD` at the tip of this branch (docs commit on top of a8c1a64be1)
WORKTREE_CLEAN: yes
G0_AFTER_COMMIT: reports 4 violations — a verifier defect, see GATE-CATALOG DEFECTS
LEASE_SHA256: f4d75f0aed94f2e34acaec63d91c245495e7e0f658aa36d1122342c2acecc612
```

Baseline tag `closure-execution-baseline-v2-20260816` (annotated object `876d0942021fafd4f570c29796c1265a567de57c`)
resolves to `64f507859c` and equalled HEAD at start. NOT merged anywhere. NOT pushed.

## TASK_REGISTER — exact denominator 15

| TASK_ID | VERDICT | COMMIT | EVIDENCE | OPEN_BLOCKER |
| --- | --- | --- | --- | --- |
| MYW-REALDB-FIXTURE-AUTH-001 | PARTIAL | a8c1a64be1 | `b/MYW-REALDB-FIXTURE-AUTH-001/` | packet names non-existent `inbox_items`; lane G2 red at baseline |
| MYW-AGT-BVP-001 | BLOCKED_OWNER | — | `b/MYW-AGT-BVP-001/` | packet chain inverted; writer consolidation needs 19+24 out-of-lease files |
| AGT-OPS-001 | BLOCKED_OWNER | — | `b/AGT-OPS-001/` | `ai-tasks` consumer never started; all fix files outside every lease |
| MYW-AGT-UI-CANON-001 | BLOCKED_HUMAN | — | `b/MYW-AGT-UI-CANON-001/` | named human UX + VoiceOver verdict |
| INI-BVP-001 | PARTIAL | 62c1968742 | `b/INI-BVP-001/` | defect fixed and proven; G4 browser evidence not produced |
| INI-MVP-PROFILE-001 | PARTIAL | — | `b/INI-MVP-PROFILE-001/` | 19 live writers; RBAC unenforced at defaults |
| INI-MVP-PORTFOLIO-001 | FIX_REQUIRED | — | `b/INI-MVP-PORTFOLIO-001/` | Timeline not reproducible in principle; 4/8 files out-of-lease |
| INI-MVP-GATE-001 | **DONE_CURRENT_SHA** | 21563831ed | `b/INI-MVP-GATE-001/` | none |
| INI-MVP-CARDS-001 | PARTIAL | — | `b/INI-MVP-CARDS-001/` | tables empty — determinism unverifiable empirically; no reopen command exists |
| INI-UI-CANON-001 | BLOCKED_HUMAN | — | `b/INI-UI-CANON-001/` | named human UX + VoiceOver verdict |
| EXE-BVP-001 | FIX_REQUIRED | — | `b/EXE-BVP-001/` | no Initiative→Execution link at schema level |
| EXE-MVP-SPINE-001 | PARTIAL | — | `b/EXE-MVP-SPINE-001/` | 4 competing models, 4 health formulas; unification is a scope decision |
| EXE-MVP-ACTIONS-001 | FIX_REQUIRED | — | `b/EXE-MVP-ACTIONS-001/` | both gaps confirmed and in-lease, but are behaviour changes needing sign-off |
| EXE-FLOW-ADAPTER-001 | BLOCKED_OWNER | — | `b/EXE-FLOW-ADAPTER-001/` | adapter service outside every lease |
| EXE-UI-CANON-001 | BLOCKED_HUMAN | — | `b/EXE-UI-CANON-001/` | named human UX + VoiceOver verdict |

`DONE_CURRENT_SHA` 1 · `PARTIAL` 5 · `FIX_REQUIRED` 3 · `BLOCKED_OWNER` 3 · `BLOCKED_HUMAN` 3 = **15/15**.

## COMMITS_IN_ORDER

1. `62c1968742` fix(initiatives): INI-BVP-001 one candidate yields exactly one materialization
2. `21563831ed` feat(initiatives): INI-MVP-GATE-001 add the missing production gate-decision writer
3. `a8c1a64be1` test(my-work): MYW-REALDB-FIXTURE-AUTH-001 governed positive fixture on real PostgreSQL
4. this docs commit — lane evidence, 15 TASK_EVIDENCE.json, contracts and integrator requests

## FILES_CHANGED (production code — 3 files)

- `server/src/services/initiative/initiativeCandidateService.ts`
- `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts` (comment only)
- `server/src/routes/pmo/initiatives.routes.ts`

Plus 4 new test files under leased roots. Everything else is evidence.

## MIGRATIONS_AND_FIXTURES

**No migration was added.** The reserved namespace `20260911_claude_b_*` was not used, because no schema
gap was reproduced that required one. Consequently there is no schema rollback and additive-schema
compatibility is unaffected. Fixtures use the `claude_b_` prefix and clean up to zero residual rows.

## COMMANDS_AND_DENOMINATORS

- G0 `verify-closure-lane.mjs b …` → PASS throughout.
- G1 `type-check` 0 · `build:backend` 0 · `build` 0 · discovery gate PASS 4997/4997.
- G2 (catalog command + `--retry=0`): 747 collected of 761 real test files — 107 files failed / 557 passed /
  83 skipped; 287 tests failed / 4270 passed / 617 skipped. **Red at the sealed baseline, pre-existing.**
- G2 recovery: the 14 leased acceptance files the catalog command cannot collect, run under
  `vitest.acceptance.config.ts` on a real DB → 105 tests, 91 passed / 14 failed.
- G3 strict migration: fresh/repeat/dry-run all exit 0; `schema_migrations` 703 success / 0 failed / 0 pending;
  **703/703 stored checksums independently verified** against the files at baseline; 1678 tables.
- G3 task realDB: 110 leased realDB files on an isolated DB → 77 passed / 7 failed / 26 skipped;
  675 tests → 565 passed / 51 failed / 59 skipped.

## REALDB_EVIDENCE

Three isolated containers, unique ports, never a developer or demo DB:
`consultify-closure-b-64f50785` (:55811, primary), `…-realdb-…` (:55812, independent verification),
`…-clean-…` (:55813, clean-room). Required env trio `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false` —
`NODE_ENV=test` alone substitutes a mock DB (`server/src/database/Database.ts:80-89`). The migration runner
needs `CI=true` instead, to pass its local-host guard (`config/databaseTargetResolver.ts:111-119`).

## BROWSER_VISUAL_EVIDENCE

None produced. All three `*-UI-CANON-001` tasks are `BLOCKED_HUMAN` by the gate catalog's own rule. Each
carries a complete packet: mounted-surface inventory, ordered per-role journey, artifact naming, the exact
G4 env block (`E2E_USE_WEB_SERVER=true`, `E2E_MOCK_DB=false` — `playwright.config.ts:43` defaults MOCK_DB to
`'true'`, which G4 forbids), and a named-human sign-off template.

## CROSS_LANE_CONTRACTS

- To **Codex (Results/Finance)**: versioned Execution→Results signal contract with schema+version, stable
  source ID, idempotency key, exactly-once receipt semantics and a consumer-test packet — in
  `b/EXE-FLOW-ADAPTER-001/ADAPTER_CONTRACTS.md`. Lane B did not edit Results code.
- To **Claude C (Ideas)**: the Idea receipt seam was consumed read-only; no `Idea*` file was edited. The seam
  is a read-only resolver in `my-work.routes.ts`; the separate canvas "Idea Receipt" concept is NOT the seam.
- **Initiative→Execution intake**: specified as a contract because no such adapter exists — `case_core` has
  no `initiative_id` column and no FK to `initiatives`.

## INTEGRATOR_CHANGE_REQUESTS

1. **Lease coverage gap (lane-scope).** 29 files comprising the whole Decisions/Tasks/Inbox server
   implementation belong to NO lease. "One writer per My Work projection" is unachievable in-lease:
   `decisions` has 26 writers (7 Lane B), `tasks` 36 (12), `transformation_cases` 15 (3).
2. **Start the `ai-tasks` consumer.** `initWorker` has zero callers, so agent plans enqueue and never run.
   Two boot-wiring calls, mechanically identical to the existing `case_workspace_event_outbox` fix.
   All files out-of-lease.
3. **`closureDeliveryReceiptService.ts`**: add payload schema version and a max-attempt/dead-letter ceiling;
   stop `demoSeedService.ts:2318` bypassing the durable receipt. Out-of-lease.
4. **`ie_outbox_events` has zero consumers** — decide whether to wire or remove. Producer is in-lease, the
   decision is not.
5. **Gate-catalog defects** (below) need the catalog owner, not a lane.

## GATE-CATALOG DEFECTS FOUND

- G1 mandates `test:inventory:generate`, which writes a tracked file in NO lease — G1 requires what G0
  forbids. (Verified content-identical at baseline; only the timestamp differs.)
- G2's command cannot collect 14 leased acceptance tests, and runs 110 further leased realDB tests with no
  database. **124 of 761 leased files (16%) are realDB tests the gate cannot prove.**
- `vitest.config.ts:311` `retry: CI?3:1` silently re-runs failures; every lane run added `--retry=0`.
- `environmentMatchGlobs` (`vitest.config.ts:355`) is dead in Vitest 4, so backend tests run under **jsdom**.
  This is not theoretical: the gate pg test fails with a jsdom `Location` TypeError under the default config
  and passes 9/9 under `--environment node`.
- `counts.playwright = 30` includes 4 PNGs, 1 HTML fixture and 3 extension-less files Playwright cannot
  collect. Real runnable denominator is **22**.
- **`verify-closure-lane.mjs` is self-defeating for new files (found by committing).** Its rule is
  `isNew && matchesAllowedRoot`, where `isNew = !isTracked(file)`. A new implementation/test file placed
  under a permitted domain root passes while UNTRACKED, but the moment it is committed — which the contract
  explicitly mandates ("commit bounded logical changes with task IDs") — `isTracked` becomes true, `isNew`
  becomes false, and the same unchanged file is reported as a lease violation. After Lane B's three code
  commits the verifier reports 4 violations, all of which are the new test files it had previously accepted:

  ```
  lane B lease violation (4):
  - server/src/services/initiative/__tests__/ini-bvp-001-candidate-single-materialization.pg.test.ts
  - server/src/services/initiative/__tests__/ini-mvp-gate-001-lifecycle-gate-route.test.ts
  - server/src/services/initiative/__tests__/ini-mvp-gate-001-lifecycle-gate-writer.pg.test.ts
  - server/src/services/myWork/__tests__/myw-realdb-fixture-auth-001.pg.test.ts
  ```

  Verified mechanically: all four paths DO match lane B's `allowedNewRoots` regexes; the only changed input
  is their tracked status. Evidence files are unaffected because `reservedEvidence` is checked before the
  tracked test. G0 is therefore unpassable for any lane that both creates a permitted new file AND commits
  it. Lane B did NOT work around this (no un-committing, no manifest edit, no `--no-verify`) — it is
  reported as a catalog/tooling defect for the integrator. Suggested fix: treat a path matching
  `allowedNewRoots` as permitted regardless of tracked status, or regenerate the lease manifest after each
  lane's commits.
- `verify-closure-lane.mjs` echoes the manifest's self-declared `.sha256` without recomputing it; the lease
  identity is self-asserted. (Raw file digest is `bc4aca9bbc5e54d8cd4eee5afa75d7cc7c2c5cb3ddf9180b7706e6a34a1b34b1`.)

## ROLLBACK_RESULT

Revert the three code commits; all changes are additive application code plus new tests, and no migration
was added, so no schema rollback is needed and old readers tolerate the schema unchanged.

## UNRESOLVED_ITEMS

- Lane G2 is red at the sealed baseline (107 files) — pre-existing, not introduced here.
- `tests/integration/initiatives/m05fix01-candidate-acceptance-receipt.pg.test.ts` fails at DDL setup
  ("cannot drop … because other objects depend on them") **identically on a fresh migrated database** —
  verified pre-existing, NOT a regression from INI-BVP-001.
- 26 leased realDB files skip; 7 fail (5 are Case Workspace live-stack/long-run suites needing a running app).
- `bindTransformationCaseProject` has no `expectedVersion` parameter (low severity).
