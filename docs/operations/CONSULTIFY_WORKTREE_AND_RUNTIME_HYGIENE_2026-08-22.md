# Consultify worktree and runtime hygiene — 2026-08-22

Status: `INVENTORIED / ACTIVE_CHECKOUT_CLEAN / DESTRUCTIVE_CLEANUP_DEFERRED`

## Protected active candidate

- checkout: `/Users/piotrwisniewski/Developer/Consultify`
- branch: `codex/wave3-16-module-acceptance-20260821`
- HEAD after table preflight: `5f24c51d4c40f0fef63a3493e1ecb3a38ca839ef`
- worktree status: clean
- remote mutation: none
- Railway/deploy mutation: none

## Registered worktrees

Git currently registers eight worktrees/checkouts:

| Path | HEAD | State | Cleanup decision |
|---|---|---|---|
| `/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git` | `b21affa8cd` | bare recovery vault | `PROTECT` |
| `/private/tmp/consultify-staging-exact-e6ca` | `e6ca206c00` | detached; `server/src/index.ts` modified | `QUARANTINE_DIRTY / DO_NOT_REMOVE` |
| `/private/tmp/consultify-swot-review-1fce2f0631` | `1fce2f0631` | detached; clean | `RETAIN_UNTIL_OWNER_REPLAY_RECONCILED` |
| `/private/tmp/consultify-visual-f9flsw` | `72a590b0b6` | detached; clean | `RETAIN_PENDING_EVIDENCE_RECONCILIATION` |
| `/private/tmp/consultify-wave3-finance-candidate` | `b834519c5b` | detached; 37 tracked/untracked WIP paths | `QUARANTINE_DIRTY / DO_NOT_REMOVE` |
| `/Users/piotrwisniewski/.codex/worktrees/8262/Consultify` | `9bb4a54901` | bare-style Codex checkout registration | `DO_NOT_TOUCH_WITHOUT_CODEX_CONTEXT` |
| `/Users/piotrwisniewski/Developer/Consultify` | `5f24c51d4c` | active clean candidate | `AUTHORITATIVE_WORKING_CHECKOUT` |
| `/Users/piotrwisniewski/Developer/Consultify-wave3-exact-83a6a4` | `b834519c5b` | detached; clean | `RETAIN_AS_FINANCE_BASELINE` |

The Finance worktree is the highest loss risk and is intentionally not removed,
reset, stashed or rewritten. Its current dirty state was separately archived and
reconciled before any physical cleanup decision.

## Late-worktree preservation and reconciliation

Location:
`/Users/piotrwisniewski/Developer/Consultify/.tmp/incident-20260822/workspace-preservation/late-worktrees`

| Artifact | Paths | Mode | SHA-256 | Verification |
|---|---:|---:|---|---|
| `finance-wip-b834519c5b-20260822.tar.gz` | 37 | `0600` | `5b85f1f95f225ebda3e389e5be6beef8cddd0bd39a6f5122dd6cae3297e31ff4` | archive listing count `37` |
| `staging-wip-e6ca206c00-20260822.tar.gz` | 1 | `0600` | `7aedb3fd7efd740b959cb824e5383c2c787c941ecc708c5894478238f5fef2c9` | archive listing count `1` |

Finance reconciliation against the active candidate found all 37 paths present:
24 are byte-identical and 13 contain later candidate evolution. Inspection of
the divergent code shows the detached Finance tree would remove later safety
work, including honest missing-value rendering, the complete multi-fixture
runtime guard and newer regression coverage. It is therefore preserved as an
immutable recovery source, not copied over the newer exact-SHA candidate.

The single staging delta was unique and safety-relevant: although
`DB_MANAGED_SCHEMA=off` skipped the legacy initializer, the active server still
continued into connection-pool, migration, SQL-chain and seeding readiness.
The guarded early return was integrated into the active candidate so a
verify-only owner-review runtime cannot mutate a qualified shared database.
Focused startup contracts pass `5/5`; root typecheck passes.

## Repository integrity and branch hygiene

- `git fsck --connectivity-only` completed without missing/corrupt objects.
- Dangling objects exist, including dangling commits. This is expected in a
  heavily used recovery repository and is a reason not to run prune/gc now.
- The repository contains a very large historical branch/ref population. It is
  operational clutter, but deleting refs tonight would create avoidable loss
  risk. Ref cleanup is deferred until reachability, remote presence and owner
  value are classified into keep/archive/delete sets.
- Remotes were inspected only. No fetch, push, merge or deploy occurred.

## Local runtime hygiene

Two stale Consultify processes were listening from temporary worktrees:

| Port | Previous cwd | Action | Verification |
|---:|---|---|---|
| `3001` | `/private/tmp/consultify-staging-exact-e6ca/server` | targeted `SIGTERM` | process absent; port no longer listening |
| `4119` | `/private/tmp/consultify-swot-review-1fce2f0631` | targeted `SIGTERM` | process absent; port no longer listening |

Local PostgreSQL on `5432` was not stopped. Processes belonging to FizzUp,
Kancelaria and unrelated websites were not touched.

## Safe next cleanup gate

1. Compare the dirty staging and Finance worktrees with the adopted candidate.
2. Preserve every unique tracked and untracked path in a verified archive or
   named checkpoint.
3. Bind each retained browser/evidence packet to its SHA and module register.
4. Only then unregister obsolete clean temporary worktrees.
5. Classify branches separately; do not combine worktree deletion with ref
   deletion or Railway changes in one operation.

Until those gates pass, `git worktree remove`, `git worktree prune`, destructive
branch deletion, aggressive `git gc`, reset, clean and stash remain prohibited.
