# Consultify final MVP — integration control plane

Captured: `2026-08-23`

Status: `ACTIVE / RECOVERY_ANCHORED / INTEGRATION_IN_PROGRESS / RELEASE_NOT_AUTHORIZED`

This file is the single navigation and execution control plane for final MVP
integration. It does not replace module registers, owner wording, screenshots,
database inventories or gate evidence. Those remain authoritative at their
linked paths.

## 1. Controlled candidate

| Property | Current value |
| --- | --- |
| Checkout | `/Users/piotrwisniewski/Developer/Consultify-final-mvp-integration-20260823` |
| Branch | `codex/final-mvp-integration-20260823` |
| Current source HEAD | `e8daa9405fc3423fe2af55fbea63c2db9bb5eeaf` after Wave Tri reconciliation and source/runtime ledger binding |
| Frozen runtime SHA | `a2b500caca36d423bf9b215f25fc1c7aba4484b3` |
| Working tree at runtime freeze | clean at `a2b500caca`; runtime must be restarted before claims about later source HEADs |
| Production / Railway mutation | `NOT_AUTHORIZED / NOT_PERFORMED` |
| Current local client | `http://127.0.0.1:4390` |
| Current local API | `http://127.0.0.1:4391` |
| Runtime manifest | `/tmp/consultify-wave3-runtime-manifest-assessment-a2b500-20260823.json` |
| Preserved local seeded DB | `consultify_w3_assessment_owner_finaldemo_bcfb` on local port `34945` |
| Fixture | `W3-ASSESSMENT-OWNER-v1`, SHA-256 `02534c510954f578f9ac621b4807ab3299b5ec057e13acaeaf71cb98ec641fa9` |

Runtime evidence at this freeze:

- `/api/ready = 200` and reports build SHA `a2b500caca36d423bf9b215f25fc1c7aba4484b3`;
- database `ready`;
- SQL migration chain `ok`, no failed, skipped, pending or unexplained-drift migrations;
- adopted database and fixture ownership marker verified and preserved;
- browser marker `LOCAL @a2b500caca36` verified.

This proves the current local Assessment runtime identity and health. It does
not prove completion of other modules, Railway parity, owner acceptance or
release readiness.

## 2. Recovery anchors

| Anchor | Commit / tag | Complete bundle | SHA-256 |
| --- | --- | --- | --- |
| Owner-review preservation | `af75a84e379312f429bb111e4221c8779cf08d57`; `checkpoint/wave3-owner-review-20260823-2135` | `/Users/piotrwisniewski/Developer/Consultify-safety-checkpoints/wave3-owner-review-af75a84e37.bundle` | `688d505ac996b38f25d96997c04a85d5e26f9e1b95b75b96d07bd0737c33d5b2` |
| Assessment navigator | `a2b500caca36d423bf9b215f25fc1c7aba4484b3`; `checkpoint/assessment-navigator-20260823-2137` | `/Users/piotrwisniewski/Developer/Consultify-safety-checkpoints/assessment-navigator-a2b500caca.bundle` | `4078856900803bbb9cfebbf3e544c4826d8c082afdbd2d0763f9355fe553c247` |

No cleanup, deletion or pruning is authorized from this file. The retained
state inventory remains
[`WIP_EXACT_STATE_MANIFEST_2026-08-23.md`](waves/WAVE_03_ACCEPTANCE/WIP_EXACT_STATE_MANIFEST_2026-08-23.md),
and the prior semantic comparison remains
[`RETAINED_WORKTREE_RECONCILIATION_2026-08-23.md`](waves/WAVE_03_ACCEPTANCE/RETAINED_WORKTREE_RECONCILIATION_2026-08-23.md).

## 3. Acceptance denominator and sources of truth

The denominator is exactly `16 modules x 21 gates (G00-G20) = 336 gates`.
`OWNER_ACCEPTED` is a separate explicit owner verdict after the gates; it is
never inferred from tests or screenshots.

1. Program rules and gate definitions:
   [`WAVE_03_ACCEPTANCE/README.md`](waves/WAVE_03_ACCEPTANCE/README.md) and
   [`MODULE_TEMPLATE.md`](waves/WAVE_03_ACCEPTANCE/MODULE_TEMPLATE.md).
2. Current module rows:
   [`MASTER_STATUS_REGISTER.md`](waves/WAVE_03_ACCEPTANCE/MASTER_STATUS_REGISTER.md).
3. Authoritative atomic module registers:
   [`modules/`](waves/WAVE_03_ACCEPTANCE/modules/).
4. Program-level owner verdict register:
   [`WAVE_03_16_MODULE_OWNER_ACCEPTANCE_REGISTER.md`](waves/WAVE_03_16_MODULE_OWNER_ACCEPTANCE_REGISTER.md).
5. Atomic owner-feedback navigation without replacement of source evidence:
   [`OWNER_NOTES_CHAT_TO_TOOLS_2026-08-23.md`](waves/WAVE_03_ACCEPTANCE/OWNER_NOTES_CHAT_TO_TOOLS_2026-08-23.md)
   and [`owner_feedback/README.md`](waves/WAVE_03_ACCEPTANCE/owner_feedback/README.md).
6. Exact-SHA invalidation and runtime chain:
   [`SHA_RUNTIME_LEDGER.md`](waves/WAVE_03_ACCEPTANCE/SHA_RUNTIME_LEDGER.md).
7. Final one-candidate replay contract:
   [`FINAL_16_MODULE_REPLAY.md`](waves/WAVE_03_ACCEPTANCE/FINAL_16_MODULE_REPLAY.md).
8. Canonical route, component, fixture and evidence map for all modules:
   [`MODULE_SOURCE_FIXTURE_EVIDENCE_INVENTORY_2026-08-23.md`](waves/WAVE_03_ACCEPTANCE/MODULE_SOURCE_FIXTURE_EVIDENCE_INVENTORY_2026-08-23.md).

The structural verifier currently proves `16` module directories, `21` gates
per module, `16` master rows and `Mobile: DEFERRED_NON_GATING`. It proves
structure only:

```bash
node scripts/wave3/verify-acceptance-packages.mjs
```

## 4. Candidate-source disposition

| Source | Relationship to current HEAD | Disposition |
| --- | --- | --- |
| `43730f86f8` Wave 3 integration base | ancestor | integrated; historical exact-SHA evidence remains historical |
| `bcfb01483a` accepted classic initiatives adapter | ancestor | integrated |
| `d8561ed5c2` Finance canonical ID bridge | ancestor | integrated |
| `54987e405a` recovered Finance fixture documentation | ancestor | integrated |
| `d48f4d7fc8` / `codex/wave3-four-modules-bcfb0148` | originally not an ancestor; one unique documentation commit | semantically reviewed; its single file was selectively integrated by cherry-pick as `3d0028802d`; source branch/worktree remains preserved |
| retained dirty/detached worktrees | mixed | evidence/comparison sources only until exact live re-inventory and explicit cleanup authority |

## 5. Current exact-candidate delta

Assessment compact navigation is now proven on the controlled candidate:

- only one top-level method axis is expanded at a time;
- switching from `Procesy Cyfrowe` to `Produkty Cyfrowe` collapses the former;
- Interview remains a single focused question step;
- the visible mode set is `Interview / Matrix / Report`, with `Settings`
  separate;
- focused component tests: `24/24 PASS`;
- durable evidence:
  [`exact-candidate-a2b500-assessment-2026-08-23/INDEX.md`](waves/WAVE_03_ACCEPTANCE/evidence/exact-candidate-a2b500-assessment-2026-08-23/INDEX.md).

Assessment remains `OWNER_REVIEW_IN_PROGRESS`; this bounded correction is not
module acceptance.

## 6. Integration queue

Work is executed in this order, on this one branch:

1. Reconcile the current source HEAD into the master row and SHA ledger without
   rewriting historical evidence.
2. For every module, locate the best existing implementation before editing;
   bind non-empty deterministic fixture data; capture current table, preview,
   context menu, workspace and negative states.
3. Convert every mismatch into the existing module register with source,
   expected result, severity and closure evidence. No second findings queue.
4. Close P0/P1 and explicitly dispose P2/P3, then run technical, visual,
   accessibility, persistence/readback and tenant/role gates.
5. Integrate the governed transformation flow:
   `Assessment -> Insights/Reports/Initiatives -> Execution -> Results -> Finance -> Materials`,
   including lineage, approvals, versioning and cold readback.
6. Reconcile remaining-nine, NFR, security, migration, backup/restore and DR
   registers against the same frozen candidate.
7. Run the final `16 x G00-G20` replay on one exact SHA and request explicit
   owner verdicts. Only after that can a release candidate be proposed.

## 7. Stop-loss rules

- Do not create another integration branch or competing module implementation.
- Do not promote screenshots, fixtures, unit tests or browser smoke to owner
  acceptance.
- Do not merge a retained branch or copy a retained worktree wholesale.
- Do not delete a branch, worktree, bundle, database, volume or evidence file
  during reconciliation.
- Do not touch production or Railway without a separate explicit release
  authorization and a freshly verified target.
- If two attempts fail, change method and preserve the literal failure.
