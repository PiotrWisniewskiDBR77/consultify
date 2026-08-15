# Git and WIP recovery status — 2026-08-15

## Decision

Module acceptance may continue only from the clean canonical checkout. No dirty branch or worktree is an integration base. Valuable work is moved by reviewed commit or module-scoped diff only.

## Inventory snapshot

- 373 checkouts/worktrees classified.
- 228 clean.
- 144 dirty and preserved in the cleanup evidence archive.
- 1 inaccessible or timed-out checkout; retained as `UNKNOWN`, not deleted.
- The 144 dirty snapshots contain binary patches, untracked archives where applicable, and verified SHA-256 manifests under `/Users/piotrwisniewski/Developer/consultify-cleanup-evidence-20260814`.

The original snapshot was captured on 2026-08-14. A later delta in the main iCloud checkout was therefore preserved separately under:

`/Users/piotrwisniewski/Developer/consultify-cleanup-evidence-20260814/preservation/001-635fd2d48d5a-delta-20260815`

That incremental snapshot contains the current tracked diff and these three post-snapshot untracked files:

- `missing-tip-relation-old.tsv`
- `server/scripts/seed-cepd-interview-templates.mjs`
- `server/scripts/seed-cepd-organization.ts`

Both archives pass gzip validation, the tar contains the three explicit paths, and `shasum -a 256 -c SHA256SUMS` passes.

## Highest-priority preservation set

| Area | Location / tip | Classification |
| --- | --- | --- |
| Initiatives / Execution | `consultify-initiatives-execution-20260809`, `bba792eabc13` | Unique commits plus dirty UI/API/E2E; module-diff required |
| Artifact QA | `/private/tmp/consultify-artifact-qa-292bafd4`, `b79fc79554a5` | Unique WIP including `20260812_report_builder_report_source_refs.sql` |
| Results vNext | `consultify-results-vnext-g0-20260809`, `8b03e2dba590` | Unique WIP including `20260810_fix_initiatives_status_default.sql` |
| Agent final integration | tip `d97a6564a582` | Unique `ProjectTeamCard.tsx`; review before integration |
| Idempotency tools | `wt-idem`, `ef29137d1ea1` | Two unique commits plus one untracked file |
| Large WIP families | Agent T01, CB01/03/05, Documents v2, Finance recovery, IE recovery | Preserve only; never whole-branch merge |

The large IE recovery checkout is classified `BROKEN_WIP`. A dehydrated central-integration checkout showing 18,889 deletions is not product work and is retained only as evidence.

## Already represented in canon

- Agent Hub commit `3a9bf4db7766ba5f897638619f4ca8618199c50f` is an ancestor of the product checkpoint.
- Acceptance fixture commits `808c3b098878` and `0f06545a9198`, realDB fixture `c371ec68`, demo flags `886d602`, Finance mount `74e232b`, final integration `b2238f7`, Agent UX `ff016e2`, and governance `5068404` have equivalent patches in canon. Their old branches are not required integration bases.

Finance commits `19b4b06934` and `4489fdcab` remain on `origin/codex/finance-v3-complete-product-integration`; they require a reviewed module comparison and are not approved for wholesale merge.

## Unresolved recovery set

- 460 unique referenced tip SHAs are not present in the canonical object cache.
- 516 reference records were inventoried; 511 occurrences remain unresolved.
- These entries are `UNKNOWN_OBJECT / RECOVERY_REQUIRED`, not proof of data loss and not deletion candidates.
- Old iCloud metadata, inaccessible compressed `.git` worktrees, and the UX Tools checkout with six conflicts remain preserved until object recovery is closed.
- Clean local-only demo, Ideas, Tools, and Assessment commits remain named preservation points even where they are not on remote.

## Safe operating rule

Before accepting a module:

1. Start from the clean canonical SHA recorded by the acceptance checkpoint.
2. Compare any candidate against canon by commit and module path.
3. Prove route, UI, API, service, migration, fixture, and test ownership.
4. Integrate only the reviewed delta.
5. Re-run the module gate on the new exact SHA.
6. Do not delete the source checkout until its classification is closed and the recovery evidence is independently restorable.

This inventory materially lowers the risk of rebuilding forgotten functionality, but it does not claim that all 460 missing Git objects have been recovered or semantically reviewed.
