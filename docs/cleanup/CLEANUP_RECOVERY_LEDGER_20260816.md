# Consultify cleanup recovery ledger — 2026-08-16

## Status vocabulary

- `INTEGRATED_PENDING_VERIFICATION` — present in candidate, acceptance gates open
- `INTEGRATE_SELECTIVELY` — valuable source package; replay allowlisted commits
- `BLOCKED` — no integration until the stated decision or reconstruction
- `SUPERSEDED` — branch-level merge prohibited; preserve evidence or selected files
- `QUARANTINE_EVIDENCE` — retain unchanged until recovery is proven
- `PRUNE_LATER` — deletion only after a manifest and recoverability proof

## Package ledger

| Package | Source SHA | Decision | Blocking evidence / next action |
| --- | --- | --- | --- |
| Baseline demo | `e45904dc7940f259b9cf017c283264d5c166c9ab` | canonical baseline | Never infer production readiness from this role. |
| Assessment | `031772082b7d4925e11986016079d02adeb17382` | `INTEGRATED_PENDING_VERIFICATION` | Library-to-session gap, registry split, fresh gates missing. |
| Assessment clean handoff | `0f0bce1c9954681ef8e01618529f10614d9de951` | `INTEGRATE_SELECTIVELY` | Diverged from demo; use as source for later fixes/evidence, not branch merge. |
| Tools | source `b8d5747e53936ec130bc80c43e868e71f1fa2b60`; candidate `4cd5d54317` | `INTEGRATED_PENDING_VERIFICATION` | 49 patch-unique non-merge commits replayed. Static/type/discovery pass. Fresh strict PostgreSQL applies 703/703 then 0; full realDB denominator passes 12/12 files, 100/100 tests after schema-parity repair. Browser E2E and initiative-quality acceptance remain missing. `RUNTIME_ACTIVE=0` remains literal. |
| Audits | source `1927914dddad0e2932bcd5238ff6eb611859e4cf`; candidate `ff2d3dfd8e` | `INTEGRATED_PENDING_VERIFICATION` | 34 patch-unique non-merge commits replayed. Fresh isolated realDB run passes 32/32 files, 259/259 tests, no skips. `audit_events` compatibility repair passed type-check, the full denominator, and catalog readback. Browser E2E remains open. Flag remains OFF. |
| Finance | `c78086057d38f57c5351c6254d41f02fd50246b6` | `BLOCKED` | Choose one canonical owner across legacy/V3/V4/V8/V10 before replay. |
| Results | `8b03e2dba59055cd9abc74b48cea2990d12c0d3b` | `BLOCKED` | Confirm latest cumulative fan-in, mount/flag and Finance seam. |
| UX recovery | local `c67726e98bcde5a9b129d09885bfb5104896bbf4`; remote `c6878103b4d43563bc1adbf6f885990340dc52e4` | `BLOCKED` | Provenance mismatch and contaminated recovery worktree. |
| UI45 | `64856e790afd0a66547d993fba13769878669c62` | `SUPERSEDED` | Preserve evidence and reconstruct only current-canon files. |
| CEPD | `99b1fcf7d67fe30bb15e089cfbf5650ce54a9ea1` | `INTEGRATE_SELECTIVELY` | Extract eight named commits/files; whole branch is cross-system. |
| Frozen main worktree | `869f9c322c61f01030c2900ea9c79ff046707f00` plus local state | `QUARANTINE_EVIDENCE` | Never reset, clean, stash, or merge as a unit. |

## Worktree and branch policy

- All 352 registered worktrees remain protected during module recovery.
- Three formally prunable entries with missing gitdirs remain `PRUNE_LATER`
  until their branch and tip SHA are preserved in the final quarantine manifest.
- Branches sharing identical tip SHAs are deduplication candidates, not proof
  that their worktrees are clean or disposable.
- No local or remote branch ref is deleted before its patch identity is mapped
  to the accepted candidate or to a recovery bundle.

## Planned recovery order

1. Assessment verification and missing entry/source-of-truth resolution
2. Tools browser verification and initiative-quality gate
3. Audits browser verification
4. Case and Artifact reconciliation
5. Results and Finance owner/data reconciliation
6. CEPD allowlisted replay
7. UX clean reconstruction
8. Worktree and branch deduplication
