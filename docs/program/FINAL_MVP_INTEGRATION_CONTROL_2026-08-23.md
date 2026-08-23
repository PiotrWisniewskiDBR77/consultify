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
| Integrated product baseline | `1b6bb33565` after Wave Tri reconciliation, selective Dynamic SWOT recovery, Final Demo / Materials integration, Finance reconciliation and Chat-to-Tools source qualification |
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
| Sixteen-module source map | `b973c2d1964c04e0f843852b649ab935516cf934`; `checkpoint/final-mvp-16-module-map-20260823-2155` | `/Users/piotrwisniewski/Developer/Consultify-safety-checkpoints/final-mvp-16-module-map-b973c2d196.bundle` | `12b8a9143284cf9f7621335a8a002eefc35bdce3c77a16ff51284f568c0313f7` |
| Dynamic SWOT integration | `47f206f5722260198880a3d64cc6925212e3f224`; `checkpoint/final-mvp-dynamic-swot-integrated-20260823-2235` | `/Users/piotrwisniewski/Developer/Consultify-safety-checkpoints/final-mvp-dynamic-swot-47f206f572.bundle` | `05e56ff0f3cf105a2f4236af9e915dfe7882cd229b1b4dbf370f0693132dd5c2` |
| Materials integration | `7a3d5b05def22781686b1a458316969f98aba902`; `checkpoint/final-mvp-materials-integrated-20260823-2300` | `/Users/piotrwisniewski/Developer/Consultify-safety-checkpoints/final-mvp-materials-7a3d5b05de.bundle` | `4730b6879ba20dcced254f3d44fc6fb2c112592a6bbfde9d06a745a1bc81d0e8` |
| Final Demo integration | `423af5c9f869e214300a5c1eb7aad51a277382a6`; `checkpoint/final-mvp-finaldemo-integrated-20260823-2240` | `/Users/piotrwisniewski/Developer/Consultify-safety-checkpoints/final-mvp-finaldemo-423af5c9f8.bundle` | `5c7d170da2669f84f6847c7be493879720814c76f122fd8716f8b7fd0ea11f12` |
| Chat-to-Tools qualification | `1b6bb33565afba7e4042dd78387ae4f16376b61d`; `checkpoint/final-mvp-chat-to-tools-qualified-20260823-2355` | `/Users/piotrwisniewski/Developer/Consultify-safety-checkpoints/final-mvp-chat-to-tools-qualified.bundle` | `892cf903c783aa7cf9332d052deefe4fc83f66f21463a7bbe364438efdd94be4` |

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
| `1fce2f0631` / retained Dynamic SWOT source | originally not an ancestor; 22 unique product commits | selectively integrated commit-by-commit; JSX, owner-feedback interaction and DRD shell contracts reconciled at `6e9f116f82`; source worktree remains preserved |
| `bcfb01483a` detached Final Demo worktree plus dirty WIP | 27 changed files across Initiatives, Execution, Results, feature flags, tests and documentation | archived first, then preserved on `codex/preserve-finaldemo-wip-20260823` at `9f29cb00ff4a98551a6c76f3f547bcd922fdfed1`; cherry-picked cleanly as `28e901b813912f3e3ed3c069ae927a6d52c91fdf`; source worktree remains preserved |
| `b834519c5b` detached Finance worktree plus dirty WIP | 37 changed files across Finance UI/API/backend/runtime/tests/docs | archived first, then preserved on `codex/preserve-finance-owner-wip-20260823` at `e7574b340e7262dc096cd8ac4d9cff61fed0a19c`; reconciliation proved the package was already present on the newer candidate, except for an apparent API addition that duplicated the existing `listFinanceArtifacts` client; duplicate removed at `55fc3e8998`; source worktree remains preserved |
| `ca9ef206` detached Chat-to-Tools worktree plus dirty WIP | 140 task files excluding the accidental `false/` npm-cache tree and explicitly excluded Assessment / inherited Discovery hub scope | archived first, then preserved exactly on `codex/preserve-chat-to-tools-wip-20260823` at `7c3b559ca8d8e8e06566a072b0078d3f9666dfba`; byte comparison proves the bounded Chat, Interview, My Work / Notebook and Tools product files are already represented on the controlled candidate; source worktree remains preserved |
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

Dynamic SWOT source reconciliation is technically green on integrated product
baseline `6e9f116f82`: the focused suite is `34/34 PASS`, full TypeScript
type-check is `PASS`, and `git diff --check` is clean. This is source-level
evidence only; the mounted runtime remains `a2b500caca36`, so browser replay,
persistence/readback and owner quality acceptance remain open.

Materials has one bounded source correction ready on this candidate:

- the Documents library is bound to canonical document artifacts rather than
  the historical Reports table;
- its primary action is `New document`, not `New report`;
- the deterministic owner-review seed publishes the document and workbook to
  `v8_output_artifacts` with canonical origin links;
- the seed remains fail-closed to loopback PostgreSQL databases named
  `consultify_w3_materials_owner_*` and therefore is not authority to mutate a
  shared or production database;
- full TypeScript type-check is `PASS` and `git diff --check` is clean;
- the broad legacy Materials hub harness is `13 PASS / 10 FAIL` because it
  still asserts the removed `ModuleHub` `active-tab` marker after the product
  migrated to `StandardModuleBar`. This is recorded test debt, not browser,
  persistence or owner-acceptance proof.

The Materials correction therefore remains `SOURCE_VERIFIED /
RUNTIME_NOT_REPLAYED / OWNER_ACCEPTANCE_REQUIRED`.

The preserved Final Demo package is now integrated selectively into the same
candidate. It restores and reconciles the current Initiatives, Execution and
Results owner-review surfaces, deterministic local review data, canonical
Execution initiative linkage and Results domain navigation. Verification on
the integrated candidate proves:

- full TypeScript type-check: `PASS`;
- focused Initiatives / Execution / Results / feature-flag suite:
  `147/147 PASS` across `6/6` test files;
- `git diff --check`: `PASS` before the checkpoint commit;
- the one stale Initiatives architecture assertion was updated to test the
  canonical-register delegation that the product now mounts, rather than the
  removed inline preview implementation; the correction is committed at
  `8c96a1c77a`.

This is `SOURCE_INTEGRATED / TECHNICAL_PASS`. It is not yet browser replay,
persistence/readback, a complete `16 x 21` gate result or owner acceptance.

The retained Finance owner-review package has also been reconciled without a
wholesale worktree copy. Its `37` dirty files were preserved first. Comparing
and cherry-picking the package onto the newer candidate showed that its product,
backend, migration, fixture, test and documentation changes were already
represented by later source. The sole apparent delta added a second copy of the
already-existing `listFinanceArtifacts` API client; that duplicate was removed
without rewriting history. The resulting source tree is byte-for-byte unchanged
from the pre-reconciliation candidate (`git diff 423af5c9f8 --stat` is empty).
Verification on the reconciled tree proves:

- full TypeScript type-check: `PASS`;
- focused Finance API, Finance data hook and Finance deep-link suite:
  `22/22 PASS` across `3/3` test files;
- the broader owner-runtime guard is `31 PASS / 13 FAIL`; all `13` failures are
  environmental `ECONNREFUSED 127.0.0.1:34940` because its dedicated local
  PostgreSQL dependency was not running. They are retained as an open runtime
  gate and are not represented as Finance regressions or as passes.

Finance is therefore `SOURCE_RECONCILED / TECHNICAL_PASS /
RUNTIME_DB_GATE_OPEN / OWNER_ACCEPTANCE_REQUIRED`.

The retained Chat-to-Tools owner-review package has now been reconciled against
the controlled candidate without copying its accidental `false/` npm-cache
tree or the explicitly excluded Assessment and inherited Discovery hub files.
The bounded product comparison proves:

- Chat backend, migration, store and owner-review UI are functionally present;
  the only source comparison difference is seven trailing one-line file endings,
  not missing behavior;
- Interview, My Work / Notebook and the bounded Tools paths are byte-identical
  to the preserved source package;
- focused Chat suite: `43/43 PASS` across `10/10` files;
- combined Interview / My Work / Notebook / bounded Tools suite:
  `132/132 PASS` across `30/30` files after replacing one stale source-string
  assertion with the current `aria-disabled` fail-closed accessibility contract;
- full TypeScript type-check: `PASS`;
- `git diff --check`: `PASS` before the qualification commit.

This segment is therefore `SOURCE_RECONCILED / TECHNICAL_PASS /
RUNTIME_REPLAY_REQUIRED / OWNER_ACCEPTANCE_REQUIRED`.

### Preserved dirty-source snapshots

Before selective integration, every dirty source checkout was archived without
cleaning, stashing, resetting or changing the source worktree. The archives are
under `/Users/piotrwisniewski/Developer/Consultify-safety-checkpoints/wip-20260823-2245/`:

| Source snapshot | SHA-256 |
| --- | --- |
| `chat-to-tools-dirty-files.tar.gz` | `8d24a3118851dbcb854901ab04198d2e72353dc6f5dcadbcc1d418772aac6854` |
| `finaldemo-dirty-files.tar.gz` | `c013cb7ea6a3210a1f1452277a0b4b0b50c9df834105712fa5a7d8cf5949d5ef` |
| `finance-dirty-files.tar.gz` | `1adae68e260bcbf10388a6d50ebe2d0330cdf868f1832d98b9e03dceee7aa5ee` |
| `materials-dirty-files.tar.gz` | `d1a0f6199a23c7c03feef53554f8ffbc0a9666a6ba795e5cd4158a097765608c` |
| `staging-e6ca-dirty-files.tar.gz` | `69aafc200ab6f3bacd87c0d17dd64fbda004aaaa2ef2159b28576e6f350a0f9e` |
| `wave3-main-dirty-files.tar.gz` | `4d4baa645a18a5a7fb0de291c1979307b022fc94997b30f0cfd2f49474c40803` |

These are recovery evidence, not candidates to merge wholesale.

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
