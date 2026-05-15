# WIP / Stash Index (2026-04-16)
This file is a recovery index created during stabilization cleanup.

## Current state
- Primary working directory: `DRD/consultify`
- Primary branch: `develop`
- `origin/staging` has been fast-forwarded to match `origin/main` (no drift).
- Staging and production are responding (`/ping` returns `200`).

## Why this exists
During cleanup we intentionally used `git stash` to keep worktrees clean and to safely remove extra worktrees without losing work.
To avoid any risk of losing those stashes, we created regular local branches under `wip/*` that **point directly to stash commits**.

Important:
- These `wip/*` branches are **local only** unless you explicitly push them.
- Stashes were **not deleted**. Branches are an extra safety anchor.

## WIP branches created from key stashes
- `wip/audit/pre-wip-branches-snapshot`
- `wip/audit/hero-section-residue`
- `wip/audit/staging-checkout-residue`
- `wip/audit/vts-readiness-hotfix-snapshot`
- `wip/audit/v8-archive-snapshot`
- `wip/audit/b07d-v8-planning-proof-snapshot`
- `wip/audit/cursor-backend-fixes-snapshot`
- `wip/audit/cursor-teresa-voice-snapshot`
- `wip/audit/ui-only-snapshot`
- `wip/audit/prod-deploy-d1a0d01a56-snapshot`
- `wip/audit/prod-firefox-hotfix-snapshot`

Legacy/older safety stashes anchored as branches:
- `wip/legacy/main-owner-bypass-permissions`
- `wip/legacy/develop-owner-bypass-permissions`
- `wip/legacy/staging-presentation-fixes`
- `wip/legacy/ws-c-artifact-evidence-backup-unstaged`

## Recovery recipes
### Inspect what’s inside a WIP branch (no changes applied)
```bash
git show --stat <branch>
git log --oneline --decorate -1 <branch>
```

### Create a real feature branch from a WIP snapshot (recommended workflow)
```bash
git checkout -b feature/from-wip <branch>
```

### Apply a stash directly (if you prefer stashes)
```bash
git stash list
git stash show -p stash@{N} | less
git stash apply stash@{N}
```

