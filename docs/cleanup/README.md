# Repository Cleanup

This directory is the canonical source of truth for repository hygiene, cleanup policy, and historical-tree classification.

It does **not** define product behavior. For product truth use `docs/product/DOCUMENTATION_REGISTRY.md`. For UI truth use `docs/ui-standards/README.md` and `docs/ui-standards/FROZEN_LAYOUTS.md`. For strategy truth use `docs/strategy/README.md`.

## Read Order

1. `CLEANUP_CURRENT_STATE_20260816.md` — the only current operational state
2. `CLEANUP_RECOVERY_LEDGER_20260816.md` — package, branch, worktree, and quarantine decisions
3. `POST_CLEANUP_COMPLETION_PLAN.md` — the product completion plan after cleanup
4. `REPO_CLEANUP_GOVERNANCE.md` — durable cleanup rules
5. `REPO_CLEANUP_LEDGER.md` — historical cleanup decisions predating the current recovery
6. `PARALLEL_DOC_TREES_CLASSIFICATION.md`
7. `SOFTS_REFERENCE_HANDLING.md`
8. `MAINTAINER_HYGIENE_CHECKLIST.md`

All dated five-hour plans, acceleration briefs, status snapshots, and earlier
cleanup checkpoints are evidence only unless the current-state document links
to them explicitly. They must not be used as active execution instructions.

## Scope

- classify canonical vs historical vs garbage material
- define safe archive and quarantine rules
- record cleanup decisions and high-noise areas
- explain how `docs/`, `wdrozenia/`, `Consulitinity przegląd/`, and `Softs/` should be interpreted

## Non-goals

- replacing product SSOTs
- deleting benchmark corpora in one pass
- rewriting old planning trees into new product docs during cleanup
