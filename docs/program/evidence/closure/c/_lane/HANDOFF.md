# Claude C — lane handoff (Ideas / Documents / Chat / Organization / Meeting)

```text
LANE:            C — Materials/Documents, Chat, Organization, Meeting boundary, Ideas sub-packets
BRANCH:          codex/closure-claude-c-ideas-documents
BASELINE_SHA:    64f507859c717494ffa5e83fae550173c9382230
                 (= refs/tags/closure-execution-baseline-v2-20260816, verified at clean start)
HEAD_SHA:        4c136d63e026f443c24d58f1f57d7282371be387
WORKTREE_CLEAN:  yes (git status --porcelain empty at handoff)
LEASE_SHA256:    7e9a27454b28907a1a5879fcb45051c3de4b0cb5be8092c3a8ed0c55b2fd756c
```

## Headline

The four domains in this lane were not four separate problems. Inventory found
**one** missing mechanism, independently rediscovered in each: a versioned,
content-hashed, human-approved, exactly-once proposal→receipt path. Idea
`/convert` had no idempotency, hash, approval or receipt; Teresa's
`idempotencyKey` was a declared-but-never-read field; Meeting had no proposal
concept at all; Workbook and Document exports were recorded nowhere.

So the lane built that spine once (`20260912_claude_c_handoff_spine.sql`) and
wired the producers to it, rather than adding a fifth per-domain mechanism. Its
guarantees are **PostgreSQL invariants, not application conventions**:

| Guarantee | Enforced by |
| --- | --- |
| exactly one artifact per approved proposal | `idx_handoff_receipt_proposal_unique` |
| no decided state without a recorded human | `artifact_handoff_proposals_decider_check` |
| no export success without real bytes | `artifact_export_receipts_success_check` |
| retry/replay collapses to one row | partial unique on `(organization_id, idempotency_key)` |

Verified by 11 SQL positive/negative controls plus 100 realDB tests.

## TASK_REGISTER

Honest verdicts. **No task is `DONE_CURRENT_SHA`**, because G4 (signed-in
browser/visual) was not run in this lane run and the gate catalog requires it
for every owned task; `DONE` without it is explicitly forbidden.

| TASK_ID | VERDICT | COMMIT | EVIDENCE | OPEN_BLOCKER |
| --- | --- | --- | --- | --- |
| `MAT-POL-001` | `BLOCKED_OWNER` | `d12cee6989` | `MAT-POL-001/DECISION_PACKET.md` | owner decision D1–D4 |
| `MAT-BVP-001` | `PARTIAL` | `bf32538ee6`,`6ef593ec99`,`30a0fc0ef1` | 28 realDB | G4; two non-unified approval engines |
| `MAT-MVP-DOC-001` | `PARTIAL` | `bf32538ee6` | 6 realDB + negative control | G4 |
| `MAT-MVP-PPT-001` | `PARTIAL` | `6ef593ec99` | 12 realDB, real PPTX bytes | G4; no a11y audit |
| `MAT-MVP-XLSX-001` | `PARTIAL` | `30a0fc0ef1` | 10 realDB | G4; formulas still client-only; 1 known flake |
| `MAT-MVP-EXPORT-001` | `PARTIAL` | `6ef593ec99` | 12 realDB | DOC/XLSX export paths not yet wired to receipts |
| `MAT-UI-CANON-001` | `NOT_VERIFIED` | — | — | G4 not run; VoiceOver `BLOCKED_HUMAN` regardless |
| `CHAT-BVP-001` | `PARTIAL` | `4c136d63e0` | 14 realDB | live chat write path outside lease |
| `CHAT-NFR-001` | `PARTIAL` | `4c136d63e0` | fail-closed negatives | streaming/restart outside lease |
| `CHAT-UI-CANON-001` | `NOT_VERIFIED` | — | — | G4 not run |
| `ORG-BVP-001` | `PARTIAL` | `8675af303b` | 11 realDB | pinned consumption wiring outside lease; G4 |
| `ORG-OPS-001` | `PARTIAL` | `8675af303b` | — | monitoring/rebuild/runbook not delivered |
| `ORG-UI-CANON-001` | `NOT_VERIFIED` | — | — | G4; no live claims-review UI exists |
| `MTG-BVP-001` | `PARTIAL` | `7253b63668` | 16 realDB + 48/48 regression | G4; ICR-C-001 |
| `MTG-UI-CANON-001` | `NOT_VERIFIED` | — | — | G4 not run |
| `IDEA-WORKSPACE-SUBPACKET-001` | `NOT_VERIFIED` | — | — | `my-work.routes.ts` outside lease |
| `IDEA-DOCUMENT-HANDOFF-SUBPACKET-001` | `PARTIAL` | `a62dbe3401` | 12 realDB | consumer must create the real target row |

Denominator: 15 top-level tasks + both mandatory Ideas sub-packets = 17 records,
each with a `TASK_EVIDENCE.json` under `docs/program/evidence/closure/c/<id>/`.

## COMMITS_IN_ORDER

```
2cebc41f1e  lane-c spine — proposal, human approval, exactly-one receipt
30a0fc0ef1  MAT-MVP-XLSX-001 — canonicalize workbook DDL, share/revoke, archive, cell CAS
bf32538ee6  MAT-MVP-DOC-001 — content hash + parent lineage, CAS on checkpoint/rollback
6ef593ec99  MAT-MVP-PPT-001, MAT-MVP-EXPORT-001 — hash-bound export receipts
8675af303b  ORG-BVP-001, ORG-OPS-001 — immutable versioned snapshots, approval, exact refs
7253b63668  MTG-BVP-001 — proposal-first meeting notes, exactly-one output
d12cee6989  docs — MAT-POL-001 decision packet + integrator change requests
a62dbe3401  IDEA-DOCUMENT-HANDOFF-SUBPACKET-001 — hash-pinned Idea handoff
4c136d63e0  CHAT-BVP-001, CHAT-NFR-001 — governed chat proposal surface
```

37 files changed vs baseline. Each commit is bounded to one task group and is
independently cherry-pickable.

## MIGRATIONS_AND_FIXTURES

Six migrations, all in the reserved `20260912_claude_c_*` namespace, all
additive, all `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, none
with a foreign key to a pre-existing owner table. No applied migration was
edited (the `source_version` race was closed by a **new** file rather than by
editing the spine).

Fixtures use the `claude_c_` prefix with per-run UUID suffixes. Every suite
asserts zero leftover rows in `afterAll`, independently re-verified by `psql`.

## COMMANDS_AND_DENOMINATORS

```
G0  node scripts/cleanup/verify-closure-lane.mjs c closure-execution-baseline-v2-20260816
G1  npm run type-check                 -> exit 0
    npm run build:backend              -> exit 0
    npm run test:discovery-gate        -> PASS, 4997 discovered / 4997 manifest / 4698 executed
G3  npx tsx server/scripts/migrate.postgres.ts            (fresh)    -> exit 0
    npx tsx server/scripts/migrate.postgres.ts            (repeat)   -> Applying migrations: 0
    npx tsx server/scripts/migrate.postgres.ts --dry-run             -> Pending migrations: 0
    schema_migrations -> 709 success, 0 failed, 0 pending
G2/G5  npx vitest run <the 9 lane files> --no-file-parallelism --maxWorkers=1 --retry=0
       -> 100 passed / 100 discovered  (clean DB, port 55447)
       regression: meeting.m12-golden-flows -> 48/48, stable over 3 runs
```

`--retry=0` is mandatory: the root config sets `retry: CI ? 3 : 1` with
`retryMode: 'run'`, which re-runs a failed test **without** re-running
`beforeAll`. That produced a misleading cascade failure during this run — the
displayed error was from the last retry, not the real first failure.

Node v24.12.0 · npm 11.6.2 · PostgreSQL 16.14 (`pgvector/pgvector:pg16`) ·
isolated container, port 55432 (working) and 55447 (clean re-validation).
`CI=true` is REQUIRED for a localhost DB (`databaseTargetResolver.ts:111-118`);
`NODE_ENV=test` must NOT be used — it substitutes a mock DB.

## REALDB_EVIDENCE — 100 tests

`artifactHandoff` 19 · `chatHandoff` 14 · `meetingBoundary` 16 ·
`presentationExport` 12 · `ideaHandoff` 12 · `organizationContext` 11 ·
`workbook` 10 · `documentStudio` 6. Plus the 48/48 Meeting golden-flow
regression.

Negative controls exercised across the lane: cross-tenant denial, stale/CAS
conflict (409), duplicate/retry/replay, two concurrent requests, provider
failure without false success, cold restart readback, exactly-one receipt, and
zero orphan rows after failure.

Two negative controls are worth calling out because they prove the guards are
load-bearing rather than decorative:
- neutering the document CAS `WHERE` clause turned the stale-version test red,
  then it was reverted and re-confirmed green;
- inserting an export row as `'succeeded'` without a hash is rejected by
  PostgreSQL, while the same row as `'unavailable'` is accepted.

## BROWSER_VISUAL_EVIDENCE

**None produced.** G4 was not run in this lane run. All five `*-UI-CANON-001`
tasks are therefore `NOT_VERIFIED`, and manual VoiceOver / human brand-UX
acceptance remains literally `BLOCKED_HUMAN` per the gate catalog even once
automated proof exists. This is the single largest remaining gap in the lane.

## DEFECTS FOUND AND FIXED WHILE VERIFYING

1. **Organization snapshots were not actually hash-bound.** `content_hash` did
   not match a hash recomputed from the stored `snapshot_json`. node-pg returns
   `Date` for `timestamptz`, a `Date` has no own enumerable keys, so
   `canonicalizeForHash` reduced it to `{}` while `JSON.stringify` wrote an ISO
   string. A snapshot advertised as tamper-evident whose hash did not verify.
   Fixed by applying `toJSON()` before key enumeration and persisting exactly
   the canonical bytes that were hashed.
2. **Workbook operational tables did not exist after migration** — created only
   by runtime DDL on request. Reproduced by querying `information_schema` on a
   from-zero database. This was a live G3 ("zero lazy/runtime DDL") violation;
   now proven closed on a fresh DB.
3. **`presentations` table does not exist** (`to_regclass` → NULL), so the
   pre-existing Idea→Presentation convert target returns 501 on any fresh
   database.
4. **`my_ideas.confidentiality`, `maturity_gates_json`,
   `my_idea_conversions.mapping_version` do not exist** — those migrations are
   self-marked "NOT APPLIED" and genuinely are not applied.

## KNOWN FLAKE (reported, not averaged away)

`workbookClosure.pg.test.ts` → *"NEGATIVE CONTROL: cross-tenant archive denied
(404); archiving blocks sharing"* failed once in three full-suite runs; 10/10 in
isolation and in both narrower pairings. Mechanism: the `makePublic()` helper
asserts `.expect(200)` against a **hardcoded** `baseVersion`, so anything that
bumps the workbook version at that moment yields 409 and the helper throws. The
helper should read the current version instead of assuming it.

## ENVIRONMENT INCIDENT (disclosed)

Mid-run, the lane's working database lost 16 tables including `organizations`
and `users` (1567 → 1551). Its ledger contains fixture rows from
`tests/integration/migration-ordering-parity.realdb.test.ts`
(`500/501_e8_safe_mixed_*.sql`, status `skipped`), which one of the parallel
workers ran against it — that suite writes temporary migrations and drops probe
tables against `DATABASE_URL`.

This corrupted the **test environment**, not the product: a clean rebuild from
the same migration set yields 1567 tables with `organizations` and `users`
present. Every result quoted above was therefore re-validated on the clean
database (port 55447). One agent's self-reported "14/14" for chat was in fact
12 passed / 2 skipped with a suite-level error on the damaged DB — caught only
because results were independently re-run rather than taken on trust.

## CROSS_LANE_CONTRACTS

Consumers read `artifact_handoff_proposals` filtered by `producer_kind`, and
call `handoffSpineService.materializeProposal(...)` themselves to create the
receipt. This lane never writes another lane's owner table.

- `producer_kind='idea'` — payload `idea-artifact-v1`; `producer_record_id` =
  `my_ideas.id`; targets `document|presentation|workbook`. **This is the
  versioned Idea receipt promised to Claude B.**
- `producer_kind='chat'` — payload `ChatProposalPayloadV1` (conversation/message
  ids, server-extracted `citations`, `clientCitations` informational only);
  `producer_record_id` = message id.
- `producer_kind='meeting'` — target `material`; `target_record_id` = the
  `meeting_notes` row, which IS the produced material. Decisions/action items
  inside an approved note are deliberately NOT turned into `tasks`/`decisions`.

Organization exposes pinned snapshot reads (`organization_context_snapshot_versions`,
keyed `(organization_id, version)` with `content_hash`); wiring Chat/Idea to pin
a version instead of reading live mutable context is integrator work, since
`AIPipeline.ts` and `aiContextBuilder.ts` are outside this lease.

## INTEGRATOR_CHANGE_REQUESTS

See `INTEGRATOR_CHANGE_REQUESTS.md`. Three reproduced defects outside the lease:
- **ICR-C-001** — server-side `betaGate` is an unconditional `next()` while
  `MODULE_MEETING` is `'closed'`; the Meeting API is open to any authenticated
  org member. The repo's own GF-06 test asserts the defective 200, so fixing the
  gate requires an owner decision about which behaviour is intended.
- **ICR-C-002** — the mandated G1 command `test:inventory:generate` rewrites a
  file outside every lane lease with only a timestamp delta, making G0 and G1 as
  written mutually unsatisfiable.
- **ICR-C-003** — `verify-closure-lane.mjs` flags a new file as a violation the
  moment it is staged, because `isTracked()` succeeds for staged paths. So
  "commit your work" and "lease PASS" cannot both hold for new source/test
  files.

## G0 RESULT — stated in both states, honestly

- **Pre-commit:** `lane C lease PASS: 25 changed paths`.
- **Post-commit:** 11 violations, all under `server/src/services/<domain>*/`.
  Verified mechanically: **11/11 match lane C's own `allowedNewRoots`
  patterns, and none exists at the baseline tag.** They fail only ICR-C-003's
  tracked-state gate. Zero files outside the lane's domain roots were created,
  and no pre-existing non-leased file was edited.

One incidental finding: `docs/program/METHOD_TOOLS_2026-08-13/test-inventory.json`
was dirtied by the mandated G1 generator and restored with `git restore` after
capturing identical counts — no information lost.

## ROLLBACK_RESULT

Non-destructive by construction. All six migrations are additive; no column or
table was dropped or rewritten, so code at the previous verified SHA still reads
this schema. Reverting the nine commits restores prior behaviour without any
migration rollback. The one behavioural default that changed —
Meeting `generate-notes` from silent auto-persist to proposal-first — retains an
explicit `persist:true` compatibility path.

## UNRESOLVED_ITEMS

1. **G4 browser/visual for all five UI-canon tasks** — the largest gap; VoiceOver
   and human UX acceptance remain `BLOCKED_HUMAN` regardless.
2. **`IDEA-WORKSPACE-SUBPACKET-001`** — not closable from this lane:
   `my-work.routes.ts` is outside the lease.
3. **Chat's ungated tool writes** — `create_task`/`create_decision`/
   `generate_initiative` still bypass approval; the governed surface is an
   alternative path, not yet the only one.
4. **DOC and XLSX export endpoints** are not yet wired to export receipts (only
   presentations are).
5. **`ORG-OPS-001` monitoring/rebuild/runbook** not delivered. Related recorded
   finding: `smoke-organization-context-engine.ts` asserts by grepping source
   files, never executing SQL — its "38/38 PASS" proves nothing about runtime.
6. **The known workbook flake** above.
7. **Owner decisions** in `MAT-POL-001` (D1–D4) remain open; external export
   stays `UNAVAILABLE` under the fail-closed default until recorded.

Nothing was merged into canonical, nothing was pushed, and no deploy or release
action was taken.
