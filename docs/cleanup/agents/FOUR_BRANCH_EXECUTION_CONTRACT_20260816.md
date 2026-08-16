# Consultify — contract for four-branch completion execution

Status: `ACTIVE / AUTHORITY_PACKET`

Plan authority: `../POST_CLEANUP_COMPLETION_PLAN.md`

Product/code baseline: `0f5652690b59f5ebe3f465131bd591a2c4340d2e`

Authority packet commit: `aca1b7a126`

## Branches and ownership

| Lane | Branch | Exclusive task ownership | Integration order |
| --- | --- | --- | ---: |
| Codex integrator | `codex/recovery-canonical-20260816` | 37 retained tasks, shared files, integration and final gates | canonical |
| Claude A | `codex/closure-claude-a-method-evidence` | 15 tasks: Assessment, Audits, Tools and two Interview evidence/delivery tasks | 1 |
| Claude B | `codex/closure-claude-b-transformation` | 15 tasks: Decisions/Tasks/Agent, Initiatives and Execution | 2 |
| Claude C | `codex/closure-claude-c-ideas-documents` | 15 tasks: Materials/Documents, Chat, Organization and Meeting document boundary; Ideas mandatory sub-packets | 3 |

Branches are sealed from the authority packet descendant recorded in each lane
packet; product code is unchanged from the product/code baseline above. A
worker must verify both identities before editing.

## Mandatory operating instruction

`Pracuj do skutku` means continue until every owned task has a literal verdict
and evidence. It does not authorize push, deploy, destructive Git operations,
production changes, policy decisions or work outside the allowlist.

Each worker must:

1. read its full lane packet and the canonical 82-task plan;
2. inventory current implementation before changing code;
3. classify each task `DONE_CURRENT_SHA`, `PARTIAL`, `FIX_REQUIRED`,
   `BLOCKED_OWNER`, or `NOT_VERIFIED`;
4. implement only reproduced gaps inside its domain allowlist;
5. run focused, type/build, fresh+upgrade realDB and browser/visual gates in
   proportion to the task;
6. commit bounded logical changes with task IDs in commit messages;
7. finish with a machine-checkable handoff and a clean worktree.

## Shared files reserved for Codex integrator

Workers must not edit these without an `INTEGRATOR_CHANGE_REQUEST`:

- root/server Gateway and route registries;
- `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts` and global menus;
- global API barrels, shared DTO/types and capability registries;
- environment templates and global feature-flag registries;
- migration runner/order/parity registries;
- `package.json`, lockfiles and root build/test configuration;
- cleanup SSOT, 82-task plan and the four-branch contract;
- Railway/deploy/release scripts and infrastructure configuration.

An integrator request contains task ID, exact file, minimal hunk, reason,
consumer tests and required ordering. The worker continues other safe work
instead of modifying the shared file.

## Migration and fixture isolation

- Claude A reserves migration namespace/date prefix `20260910_claude_a_*`.
- Claude B reserves `20260911_claude_b_*`.
- Claude C reserves `20260912_claude_c_*`.
- A migration is allowed only after a reproduced schema gap and must be
  additive, ordered, idempotent and verified on fresh plus upgrade PostgreSQL.
- Applied migrations are never edited.
- Fixture names use `claude_a_`, `claude_b_`, or `claude_c_` prefixes and must
  record tenant/org/actor IDs and cleanup behavior.

## Cross-lane contracts

Workers may add a versioned domain adapter or contract test inside their owned
domain. They may not edit another lane's implementation. Upstream/downstream
needs become a handoff contract containing:

- producer/consumer task IDs;
- payload schema/version and stable source ID;
- idempotency key and receipt/outbox semantics;
- owner table/writer;
- positive, retry/replay, stale and tenant-negative examples.

Codex integrates A → B → C and reruns downstream invalidation gates after each
lane. Agents do not merge each other and do not merge into canonical.

## Git and safety

Forbidden: broad merge, force push, deploy, branch/ref deletion, `reset --hard`,
`clean`, stash, broad staging, destructive migration, silent test weakening,
mocking a required provider, or changing a frozen owner decision.

Stage only owned files. Before every commit run `git diff --check`; after the
last commit report `git status --short`, baseline, HEAD and changed paths.

## Evidence and DONE

Every completed task records:

- exact baseline, product SHA and evidence SHA;
- commands, exit codes and discovered/executed/pass/fail/skip/todo counts;
- Node/npm/Vitest/Playwright/PostgreSQL/pgvector versions where relevant;
- migration ledger and fixture IDs;
- tenant, role, stale, retry, concurrency and provider negatives;
- browser trace/screenshots and artifact hashes;
- cold reopen/restart and cleanup result;
- rollback/flag compatibility.

Historical evidence is context only. Prose `PASS` without denominator and exact
SHA is not evidence.

## Required final handoff

```text
LANE:
BRANCH:
BASELINE_SHA:
HEAD_SHA:
WORKTREE_CLEAN:

TASK_REGISTER:
- TASK_ID | VERDICT | COMMIT | EVIDENCE | OPEN_BLOCKER

COMMITS_IN_ORDER:
FILES_CHANGED:
MIGRATIONS_AND_FIXTURES:
COMMANDS_AND_DENOMINATORS:
REALDB_EVIDENCE:
BROWSER_VISUAL_EVIDENCE:
CROSS_LANE_CONTRACTS:
INTEGRATOR_CHANGE_REQUESTS:
ROLLBACK_RESULT:
UNRESOLVED_ITEMS:
```

A task with missing human/legal/provider/production authority remains literal
`BLOCKED_OWNER`; the worker must close every technically executable sub-gate
and provide a concise decision packet rather than stopping the whole lane.
