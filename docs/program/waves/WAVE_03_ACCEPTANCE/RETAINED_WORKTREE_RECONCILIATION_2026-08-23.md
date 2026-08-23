# Retained worktree reconciliation — 2026-08-23

Status: `HASHED / CONTENT_RECONCILED / REMOVAL_NOT_YET_EXECUTED`

## Safety boundary

- Primary integration checkout: `/Users/piotrwisniewski/Developer/Consultify`
- Branch: `codex/wave3-16-module-acceptance-20260821`
- Exact comparison SHA: `4166de0460b1716b66d1de0c954818f20fdab2f2`
- Primary checkout was clean before this evidence document was added.
- No file was copied from a retained worktree, and no worktree, branch, volume,
  database, deployment or runtime was removed or mutated during reconciliation.
- Classification means content disposition only. It is not release evidence and
  does not authorize cleanup by itself.

## Result

An independent read-only review and a byte comparison against the exact primary
checkout found no unique valuable WIP in the three dirty retained worktrees.
Every path is classified `REDUNDANT_AFTER_HASH_PROOF`:

| Worktree | Dirty paths | Byte-identical to primary | Different but reviewed as equivalent, superseded or regressive |
| --- | ---: | ---: | ---: |
| `/private/tmp/consultify-staging-exact-e6ca` | 1 | 0 | 1 |
| `/private/tmp/consultify-wave3-finance-candidate` | 37 | 22 | 15 |
| `/Users/piotrwisniewski/.codex/worktrees/1ad1/Consultify` | 21 | 17 | 4 |

The Finance worktree must not be applied wholesale. Its 15 differing paths
contain older or weaker variants, including legacy statement-confirmation
writes, weaker runtime guards and fabricated registry presentation defaults.
The staging `server/src/index.ts` is superseded by the typed, more informative
implementation in the primary checkout. The owner-feedback worktree's differing
documents are older snapshots; the primary checkout retains the later evidence
and stronger owner gates.

## Current byte-comparison exceptions

The following paths differ from the primary checkout but are already covered by
the independent semantic review above:

### Staging exact

- `server/src/index.ts`

### Finance candidate

- `docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/MODULE_ACCEPTANCE.md`
- `public/locales/en/translation.json`
- `public/locales/pl/translation.json`
- `scripts/dev/start-wave3-owner-runtime.mjs`
- `server/src/routes/v8/finance-v2/__tests__/cross-tenant.routes.pg.test.ts`
- `server/src/routes/v8/finance-v2/artifacts.routes.ts`
- `server/src/services/__tests__/statementOwnerAcceptance.pg.test.ts`
- `src/components/Economics/FinanceHub.tsx`
- `src/components/Economics/__tests__/useFinanceData.test.tsx`
- `src/components/Economics/financeTypes.ts`
- `src/components/Economics/hooks/useFinanceData.ts`
- `src/components/shared/ModuleHub/ModuleNavBar.tsx`
- `src/services/api/financeV2.api.ts`
- `tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts`
- `server/scripts/seed-wave3-finance-owner-review.ts`

### Owner-feedback worktree

- `src/components/Discovery/DiscoveryToolsHub.tsx`
- `docs/program/waves/WAVE_03_ACCEPTANCE/CHAT_TO_TOOLS_IMPLEMENTATION_RECONCILIATION_2026-08-23.md`
- `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_NOTES_CHAT_TO_TOOLS_2026-08-23.md`
- `docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/04_ASSESSMENT/`

## Removal gate

Removal remains pending until all of the following are true:

1. this packet is committed in the clean integration history;
2. the exact primary SHA after reconciliation is recorded;
3. `git status`, branch and worktree identities are re-read immediately before
   removal;
4. no agent or process is using the target worktree;
5. only the three exact paths listed above are targeted;
6. removal is followed by `git worktree list --porcelain` readback.

Until that gate passes, retained worktrees remain preserved even though their
content is reconciled.
