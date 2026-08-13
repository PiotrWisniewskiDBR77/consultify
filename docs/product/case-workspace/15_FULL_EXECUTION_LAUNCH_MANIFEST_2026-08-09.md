# Case Workspace — FULL_EXECUTION launch manifest

> Status: `FULL_EXECUTION — W1 IN PROGRESS`
> Prepared by: Claude coordinator, on request of Piotr Wisniewski
> Owner decisions recorded: 2026-08-09
> W1 started: 2026-08-09
> Authority: docs/product/case-workspace/13 and 14
> Purpose: score every FULL_EXECUTION launch input as `READY`, `APPROVED`,
> `OWNER_ACTION_REQUIRED`, `N/A_WITH_CODEX_APPROVAL` or `BLOCKED`, with exact
> values/commands, and record the W1 launch record once triggered.

## 0.1 Authorization record

`OWNER_MULTI_AGENT_AUTHORIZATION_REF`: issued directly in the Piotr↔Claude
chat transcript of this session, 2026-08-09, verbatim:

> "Ja, Piotr Wiśniewski, zatwierdzam rozpoczęcie programu Case Workspace w
> trybie FULL_EXECUTION zgodnie z dokumentami 13–15. Ta wiadomość stanowi
> OWNER_MULTI_AGENT_AUTHORIZATION_REF. Zezwalam na utworzenie izolowanego
> worktree i brancha, użycie subagentów, lokalne commity pakietowe oraz
> uruchomienie disposable test database. Nie zezwalam na push, merge do demo,
> deployment ani dostęp do produkcji."

**Recorded deviation:** document 14 §11 specifies this reference must be
"external" and states the template text itself "cannot serve as that
reference," specifically to exclude an in-conversation restatement. Piotr
explicitly and knowingly waived that external-channel requirement in the
message above — the message independently restates full scope and boundaries
(worktree/branch/subagents/local commits/disposable DB allowed; no
push/merge/deploy/production), matching deliberate, informed consent rather
than a casual "go ahead." This is logged here verbatim, as the owner's
explicit amendment to his own process, rather than treated as silently
satisfying the original external-reference clause. Codex review of the
candidate should see this paragraph, not just a `REF: <id>` line.

`CASE_WORKSPACE_RO_DATABASE_URL`: not provided. Per Piotr's instruction in
the same message, W1 proceeds on the disposable test database with synthetic
fixtures; DEMO read-only access is deferred to a gate before integration
tests (T2 onward), not a blocker for W1 domain/requirement work. See §4.

## 0. Launch readiness scorecard

| # | Field | Status |
| --- | --- | --- |
| 1 | Fresh `origin/demo` SHA | `APPROVED` — re-verify at actual W1 start (branch moves) |
| 2 | Isolated worktree/branch name | `APPROVED` — not created yet |
| 3 | Collision handling policy | `APPROVED` — see §3 for exact rules |
| 4 | Read-only runtime access mechanism | `DEFERRED_NOT_BLOCKING` — owner-instructed: gate before integration tests (T2+), not before W1 |
| 5 | Existing-data snapshot | `N/A_WITH_CODEX_APPROVAL` — ref `CW-CODEX-NA-SNAPSHOT-20260809-01` |
| 6 | Disposable test database | `APPROVED`, provisioning `BLOCKED` (local colima issue — see §6) |
| 7 | Windows 11 + NVDA environment | `N/A_WITH_CODEX_APPROVAL` for candidate stage — ref `CW-CODEX-NA-NVDA-20260809-01`; mandatory gate before production rollout |
| 8 | External owner authorization text | `RESOLVED_BY_OWNER_WAIVER` — see §0.1 |
| — | `OWNER_PROTOTYPE_APPROVAL_REF` | `NOT_YET_GRANTED` — UI packets pause at W2-V0; backend/domain work may proceed |

**W1 started 2026-08-09.** Requirement extraction (docs 00-14 + authorities)
and codebase KEEP/EXTEND/ADAPT/DEPRECATE/CREATE mapping are running as a
background workflow (`wf_385b16f2-1fa`); synthesis into the coverage ledgers
and packet registry follows on completion. See §11.

---

## 1. Fresh `origin/demo` SHA — `APPROVED`

```text
SHA:      9d17cac11484a82f729a51044e30453e39fbcb02
Author date: 2026-08-09T16:58:01+02:00
Subject:  fix(release): reconcile demo migration preflight
```

Approved as base. Because `origin/demo` is a live, moving branch, the
coordinator re-runs `git fetch origin demo && git rev-parse origin/demo`
immediately before actually creating the worktree in §2, and records whatever
SHA is current at that moment (it may have advanced past `9d17cac1...` by
then — that is expected and fine; re-verification is the point).

The session worktree used for this manifest (`codex/sync-demo-20260729`)
remains 693 commits behind and is confirmed **not** to be used as base, merge
source, or merge target for this program.

---

## 2. Isolated worktree/branch — `CREATED`

```text
Branch:   claude/case-workspace-v1-20260809
Worktree: /Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809
Base SHA: 9d17cac11484a82f729a51044e30453e39fbcb02 (re-verified 2026-08-09,
          unchanged from §1 at worktree-creation time)
```

Created 2026-08-09 after re-running the §1 preflight. Command used, for the
record:

```bash
git -C "/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify" \
  fetch origin demo
FRESH_DEMO_SHA=$(git -C "/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify" \
  rev-parse origin/demo)
git -C "/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify" \
  worktree add -b claude/case-workspace-v1-20260809 \
  /Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809 \
  "$FRESH_DEMO_SHA"
```

Worker branch convention for W1 packets (document 13 §4.3), unchanged:

```text
claude/case-w<N>-<packet-id>
```

---

## 3. Collision handling policy — `APPROVED`

Owner rulings, binding for W1 onward:

### `codex/v8-full-done-20260808` — analysis source only, never a base

Not a merge/cherry-pick target as a whole branch. Before EPIC E4 (V8 Run/
NodeRun binding), the coordinator reads exactly these three unique commits
(all ahead of `origin/demo`, all dated 2026-08-08) and extracts only the
behaviors that are still current and required — nothing is imported
mechanically:

```text
f2e26ff8bb6c1617505e7a3fa32ca783d63481e0  fix(v8): restore full integration type safety
7542f717830dc3f5800fe838e36423a53ce298c7  fix(v8): harden fresh-db governance proofs
d3e70665ce5ea88bbf58f9b4741d2b7d6cab81bc  feat(v8): include full case evidence in final outputs
```

W1 pre-E4 task: `git show` each of the three, evaluate against the then-
current `origin/demo` V8 code, and hand-port only what is still correct and
needed as a normal Case Workspace commit (with its own message and
rationale) — not a merge commit, not a wholesale cherry-pick.

### Finance and Results — read-only owned domains

`codex/finance-v3-gate-a-20260809` and `codex/results-vnext-g0-20260809`
(and Finance/Results generally) remain **outside Case Workspace ownership**.
EPIC E10 links to Finance/KPI and Results only through their canonical
contracts/APIs (owning-module commands, per invariant 8/13 of document 13).
No Case Workspace packet edits Finance or Results tables, migrations, or
runtime directly. If a needed capability doesn't exist as a contract yet, that
is reported as a dependency, not worked around with a direct table write.

### `codex/pre-rebuild-*` branches and `codex/pre-rebuild-v8-ui-integration-20260809`

Do not block the program. `pre-rebuild-v8-ui-integration` is identical to
`origin/demo` tip (no unique commits) and the other two `pre-rebuild-*`
branches carry no unique commits either (stale, behind-only) — confirmed in
§3 of the prior recon. No coordination action required unless one of them is
revived with new commits before W1 starts, in which case the coordinator
re-checks ahead/behind at worktree-creation time.

### Everything else from the original collision map

Unchanged from the prior recon snapshot (documents-suite-v2-resume,
agent-documents-final, cb01-accessibility, cb05-spatial-command, etc.) — none
of those required an owner ruling for this launch; they remain "check the
diff before touching shared files" items if/when a packet's scope happens to
border them.

---

## 4. Read-only runtime access mechanism — `OWNER_ACTION_REQUIRED` (the technical blocker)

Unchanged from the prior manifest version. This is the one remaining
technical blocker before W1 domain/persistence work can validate anything
against real DEMO shape.

```sql
CREATE ROLE case_workspace_ro WITH LOGIN PASSWORD '<managed-secret>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE case_workspace_ro SET default_transaction_read_only = on;

GRANT CONNECT ON DATABASE <demo_db_name> TO case_workspace_ro;
GRANT USAGE ON SCHEMA public, v8 TO case_workspace_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public, v8 TO case_workspace_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public, v8
  GRANT SELECT ON TABLES TO case_workspace_ro;
```

Remember to qualify schema explicitly in every inspection query — DEMO's
`search_path` does not include `v8` (project memory
`m09-materials-mvp-2026-08-05`), so an unqualified `v8_feature_flags` silently
resolves against empty `public.*`.

**Delivery contract, unchanged and non-negotiable:** the resulting connection
string is a secret. It must arrive as an environment variable
(`CASE_WORKSPACE_RO_DATABASE_URL`) written directly into the worker
environment by whoever administers DEMO — never pasted into this chat, never
committed to the repo. Once that variable is present and connects
successfully, this field becomes `READY`.

---

## 5. Existing-data snapshot — `N/A_WITH_CODEX_APPROVAL`

```text
Requirement: EXISTING_DATA_SNAPSHOT (document 14 §11 launch template)
Approval ref: CW-CODEX-NA-SNAPSHOT-20260809-01
Reason: Case Workspace has zero existing Case/CasePlanVersion/Run records to
        migrate or rehearse against. Producing or anonymizing a real DEMO
        client-data snapshot would create unnecessary data-handling risk for
        no migration benefit.
Consequence: T2/T5/T7/T8 database and functional tests run exclusively
        against synthetic fixtures seeded into the disposable test database
        from §6. No production/DEMO data is dumped, anonymized, or stored for
        this program.
Recorded: 2026-08-09
```

This closes what was previously an `OWNER_ACTION_REQUIRED` item (PII
inventory / anonymization tooling). No anonymization script needs to be built
for this program. `CURRENT_RUNTIME_READONLY_SOURCE` (§4) remains required —
that is schema/shape inspection through the read-only role, not a data
snapshot, and is unaffected by this N/A.

---

## 6. Disposable test database — `APPROVED`, provisioning `BLOCKED`

Approved mechanism unchanged from the prior manifest version. Actual
provisioning hit a local environment issue on first attempt (2026-08-09):
this machine runs Docker via `colima`, not Docker Desktop. Both existing
colima profiles (`default` and a pre-existing `pgtest` profile, evidently
provisioned for exactly this kind of use before) failed to start with
`failed to run attach disk ... in use by instance`, i.e. a disk-lock left
over from a prior ungraceful shutdown, not an active concurrent user (`colima
list` showed both as `Stopped`). Not forced/reset, since a shared local VM
disk is exactly the kind of state this program should not clobber without
understanding it first — this needs a clean `colima delete`+recreate (or an
equivalent fix) as a small, separate step, owned by whoever normally manages
this machine's colima profiles.

This does not block W1's requirement-extraction/codebase-mapping work, which
needs no database. It does block any T2 (database integration) test run
until fixed — tracked as an open item, not silently skipped.

Approved commands, unchanged, to run once the colima/docker issue is
resolved:

```bash
# pre-step at actual W1 start: ensure Docker Desktop is running

docker run --rm -d \
  --name case-workspace-test-pg \
  -e POSTGRES_USER=case_workspace \
  -e POSTGRES_PASSWORD=case_workspace \
  -e POSTGRES_DB=case_workspace_test \
  -p 127.0.0.1:55432:5432 \
  pgvector/pgvector:pg16

DISPOSABLE_TEST_DATABASE="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test"
```

```bash
DB_TYPE=postgres LC_ALL=C NODE_ENV=test \
  DATABASE_URL="$DISPOSABLE_TEST_DATABASE" \
  npm run db:migrate:strict
```

Given §5, this database is also where all synthetic Case Workspace fixtures
live for T2/T5/T7 — there is no separate "existing data" rehearsal path for
this program.

---

## 7. Windows 11 + NVDA environment — `N/A_WITH_CODEX_APPROVAL` for candidate stage

```text
Requirement: NVDA_ENVIRONMENT (document 14 DoD-H)
Approval ref: CW-CODEX-NA-NVDA-20260809-01
Reason: No Windows 11 + NVDA environment is reachable from this execution
        environment (macOS host); provisioning one is a same-day purchase/
        infrastructure decision out of scope for candidate-stage execution.
Scope of the N/A: candidate implementation and READY_FOR_CODEX_REVIEW only.
Mandatory follow-up gate: NVDA verification remains a required, currently
        open DoD-H item and is a hard gate before any production rollout of
        Case Workspace screens. It is tracked here, not silently dropped.
Recorded: 2026-08-09
```

This field carries into the coverage ledgers at W1 as an open follow-up item,
not a closed row — `RESPONSIVE_ACCESSIBILITY_LEDGER.csv` records this exact
ref and the rollout-gate condition, per document 14 §6's rule that
`N/A_WITH_CODEX_APPROVAL` still needs a ledger row with the approval
reference, not just an aggregate note.

---

## 8. External owner authorization text — `OWNER_ACTION_REQUIRED` (the other remaining blocker)

Unchanged from the prior manifest version — still pending. Ready-to-send text:

```text
OWNER_MULTI_AGENT_AUTHORIZATION_REF — Case Workspace program

For the Case Workspace program defined by
docs/product/case-workspace/13_CLAUDE_MULTI_AGENT_IMPLEMENTATION_MASTER_PLAN.md,
I, Piotr Wisniewski, authorize one Claude coordinator to use bounded
sub-agents only through the ownership, isolated worktree, allowlist,
fan-out/fan-in and evidence rules in that plan. This is a scoped exception to
"zero sub-agentów" for this program only, not a general repository rule
change.

Claude may create branches/worktrees and small local packet commits under
this authorization. It does not authorize push, merge to demo, deploy,
production access, or database mutation outside the approved disposable test
database.

Base: origin/demo @ 9d17cac11484a82f729a51044e30453e39fbcb02 (2026-08-09).
Integration branch: claude/case-workspace-v1-20260809.

Issued: <your timestamp, your channel, your identity>
```

**Delivery contract:** send this (or your own equivalent wording carrying the
same meaning) through a channel external to this chat — email to yourself is
sufficient, as you proposed. Then give me either the message ID, or its exact
date/time and subject line, as `OWNER_MULTI_AGENT_AUTHORIZATION_REF`. That
reference is what unblocks this row.

---

## 9. `OWNER_PROTOTYPE_APPROVAL_REF` — `NOT_YET_GRANTED`

Unchanged. Sequencing unchanged:

- Backend/domain/runtime packets (schema, capability registry, V8 binding per
  §3's hand-port rule, waits/events, approvals engine, migrations, non-UI
  tests) may proceed once §4 and §8 are resolved.
- Any production UI packet (E7 My Work screens, E8 Chat cards, E10 artifact
  surfaces) stops at the W2-V0 prototype gate for your preliminary
  visual-direction approval before any real integrated UI commit lands.

---

## 10. Trigger condition for W1 / FULL_EXECUTION — fired 2026-08-09

Per Piotr's authorization in §0.1, the trigger fired without waiting on
`CASE_WORKSPACE_RO_DATABASE_URL` (explicitly deferred to a pre-integration-
test gate, §4). Sequence executed:

1. re-ran the §1 preflight (`git fetch origin demo`) — SHA unchanged at
   `9d17cac11484a82f729a51044e30453e39fbcb02`;
2. created the §2 worktree/branch from that SHA;
3. attempted the §6 disposable test database — blocked on a local colima
   issue, tracked, not fixed yet;
4. launched W1 baseline work (§11) rather than waiting on step 3, since
   requirement extraction and codebase mapping need no database.

## 11. W1 execution status

Background workflow `wf_385b16f2-1fa` ("case-workspace-w1-baseline"),
launched 2026-08-09, running against the worktree in §2:

- **Extract Requirements** — 8 parallel readers, one per document cluster
  (00-03, 04-05, 06-07, 08/09/11, 10/12, 13§2+14§5, V8 SSOT authority, UI
  standards authority), each returning structured requirement rows
  (`req_id`, `source_file`, `text`, `epics`, `authority_level`, `category`).
- **Map Codebase** — 5 parallel readers, one per area (V8 runtime,
  My Work/Chat, capability/command patterns, UI standard components,
  migrations/flags/outbox), each returning KEEP/EXTEND/ADAPT/DEPRECATE/CREATE
  findings with real file paths.

On completion, the coordinator synthesizes both outputs into
`docs/product/case-workspace/acceptance/` (created on the new worktree, not
the iCloud session tree): the coverage-ledger skeletons named in document 14
§6, a packet registry, and a dependency graph — the concrete W1/EPIC-E0
deliverable. That synthesis, plus the pre-E4 hand-port of `v8-full-done`'s
three commits (§3), plus the W2-V0 prototype gate (unblocked only by real
`OWNER_PROTOTYPE_APPROVAL_REF`), are the next checkpoints — tracked in this
session's task list (#4-#9).
