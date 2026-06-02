# `scripts/git-tools/` — Git operation hardening

> Tooling that defends commits in this repo against the "Google Drive
> parallel sync" issue documented in
> `docs/operations/PARALLEL_SYNC_REMEDIATION_2026-05-09.md`.

## Why this directory exists

The Antygracity workspace lives under `~/Documents/Antygracity/`, which
on macOS is a default Google Drive Desktop sync target. Drive sync can:

- Transiently delete files mid-task (during file-provider migration),
  causing `git add ... && git commit ...` to land as `no changes added`.
- Re-sync commits from other-machine identities (e.g. `staging`),
  silently rewriting attribution on the local clone.

These tools make commit operations **atomic** (smaller window for sync
collisions) and **self-verifying** (every commit's attribution is
checked against `git config user.name / user.email`).

## What's here

| File | Purpose |
| ---: | ---: |
| `atomic-commit.sh` | Proactive wrapper. Runs `git add` + `git commit` + attribution verify in a single shell with a 200ms FS-settle. |
| `post-commit-attribution-check` | Hook script that warns on stderr after every commit if `%an %ae` ≠ configured user. |
| `install-hooks.sh` | One-time installer. Sets `core.hooksPath` to point at `hooks/` and symlinks the hook in place. |
| `hooks/` | Auto-generated. Contains the `post-commit` symlink installed by `install-hooks.sh`. |

## One-time setup

```bash
cd <repo-root>             # e.g. ~/Documents/Antygracity/DRD/consultify
./scripts/git-tools/install-hooks.sh
```

Verify:

```bash
git config --get core.hooksPath
# → scripts/git-tools/hooks
```

## Day-to-day use

### Making commits with attribution defense

```bash
./scripts/git-tools/atomic-commit.sh -m "feat: my change" path/to/file1 path/to/file2
```

Or with `-F` for a HEREDOC-style message:

```bash
./scripts/git-tools/atomic-commit.sh -F /tmp/commit-msg.txt path/to/file
```

Or with `-A` to stage all tracked changes (use carefully):

```bash
./scripts/git-tools/atomic-commit.sh -A -m "refactor: housekeeping"
```

The script:

1. Settles for 200ms (lets concurrent Google Drive sync drain).
2. Stages files atomically.
3. Aborts with exit code 2 if nothing was staged (`no changes added` —
   classic sync-window collision).
4. Commits.
5. Re-reads `%an %ae` from the just-created commit.
6. Aborts with exit code 1 if attribution doesn't match config (so
   you can investigate before pushing).

### Hook-based safety net (any commit path)

After running `install-hooks.sh`, every commit — whether through
`atomic-commit.sh`, `git commit` directly, an IDE GUI, or a rebase —
runs `post-commit-attribution-check`. If attribution is wrong, you'll
see:

```
[post-commit] ⚠ ATTRIBUTION MISMATCH on a1b2c3d
[post-commit]   subject:  feat: …
[post-commit]   expected: Piotr <piotr.wisniewski@dbr77.com>
[post-commit]   actual:   staging <…>
[post-commit]   action:   investigate before pushing — see …
```

The hook **does not block** — the commit already happened. Its job is
to make the bug **loud and impossible to miss**.

## What this does NOT solve

These tools mitigate symptoms but do not eliminate root cause. The
permanent fix lives in §2 of `PARALLEL_SYNC_REMEDIATION_2026-05-09.md`:
either disable Google Drive sync for `~/Documents/Antygracity/` or
move the repo to `~/Code/Antygracity/`.

## Exit codes (atomic-commit.sh)

| Code | Meaning |
| ---: | ---: |
| 0 | Success — commit landed with correct attribution. |
| 1 | Commit landed but attribution mismatch — investigate before pushing. |
| 2 | Nothing staged after `git add` — likely sync-window collision; retry. |
| 64 | Bad CLI usage (missing `-m`, etc.). |
| 65 | Not in a git work tree, or `user.name/email` not configured. |

These codes are stable and safe to consume from CI / wrapper scripts.
