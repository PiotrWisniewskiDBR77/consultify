# Google Drive sync vs this repo — the problem and the fix

**Status:** active hazard · mitigations in place · one durable step needs the owner.

## What happens

This repo lives at `~/Documents/Antygracity/DRD/consultify`, and **Google Drive for
Desktop syncs `~/Documents`** (proof: `~/Documents` contains `.tmp 2.driveupload`,
`.tmp 3.driveupload`, … — Drive's upload scratch dirs).

Because Drive syncs the folder *including `.git/`*, it periodically:

1. **Duplicates files** — `foo.ts` → `foo 2.ts`, `foo 3.ts` (Drive's collision rename).
   At one point there were **>10,000** such duplicates in the tree.
2. **Duplicates Git internals** — `.git/index 2.lock`, `.git/*.driveupload`,
   `.git/hooks/pre-push 2`. This corrupts the Git index and produces phantom
   **`UU` (unmerged)** states *with no merge in the reflog* — exactly what we hit.
3. **Writes conflict markers into source files** on multi-machine races
   (`<<<<<<<`, `=======`, `>>>>>>>`), which breaks `tsc`/`esbuild`.

All three break the build at random, unrelated to any code change.

## Mitigations already in place (committed)

- **`.gitignore`** ignores `* 2.*`, `* 3.*`, `* 4.*`, `*.driveupload`,
  `* conflicted copy *` so duplicates can't be committed.
- **pre-commit hook** (`scripts/git-tools/hooks/pre-commit`, wired via
  `core.hooksPath`) **refuses** any commit that contains a duplicate file or a
  conflict marker — pollution can never enter history.
- **`scripts/fix-gdrive-pollution.sh`** — one command to clean the tree + `.git`
  and report any conflict markers. Run it whenever the build breaks oddly:
  ```bash
  bash scripts/fix-gdrive-pollution.sh
  ```
  If it reports conflict markers, restore those files (HEAD is clean):
  ```bash
  git checkout HEAD -- <file>
  ```

## The durable fix (owner action — pick ONE)

The mitigations stop pollution from being *committed*, but Drive will keep
creating it on disk until the repo (or at least `.git`) is out of the sync path.

**Option A — move the repo out of `~/Documents` (simplest, recommended):**
```bash
mkdir -p ~/dev
mv ~/Documents/Antygracity/DRD/consultify ~/dev/consultify
# reopen the project from ~/dev/consultify
```

**Option B — keep the working tree where it is, but move `.git` out of sync**
(stops the index corruption; Drive can still touch source files, but the hook +
script handle that):
```bash
cd ~/Documents/Antygracity/DRD/consultify
mkdir -p ~/.git-stores
mv .git ~/.git-stores/consultify.git
printf 'gitdir: %s/.git-stores/consultify.git\n' "$HOME" > .git
git --git-dir="$HOME/.git-stores/consultify.git" config core.worktree "$PWD"
git status   # verify
```

**Option C — exclude this folder in Google Drive settings** (Drive for Desktop →
Preferences → Google Drive → folders to sync) and stop syncing the project tree.

Until one of these is done, expect to run `scripts/fix-gdrive-pollution.sh`
occasionally. The build gates (tsc/esbuild) + the pre-commit hook will catch any
pollution before it ships.
