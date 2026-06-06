#!/usr/bin/env bash
#
# fix-gdrive-pollution.sh — remove Google-Drive sync pollution from this repo.
#
# Google Drive for Desktop syncs ~/Documents and periodically:
#   * duplicates files            -> "foo 2.ts", "foo 3.ts", "foo 4.ts"
#   * dups Git internals          -> ".git/index 2.lock", ".git/*.driveupload"
#   * writes conflict markers into source files on multi-machine races
#
# This script removes the first two classes safely (the originals remain) and
# REPORTS the third (conflict markers) for manual `git checkout HEAD -- <file>`,
# since auto-reverting source could discard real work.
#
# Safe + idempotent. Run anytime the build mysteriously breaks. The durable fix
# (stop syncing .git) is in docs/GDRIVE_SYNC.md.
#
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "→ Cleaning Google-Drive duplicates from .git (index-corruption vector)…"
git_dupes=$(find .git -type f \( -name '* [0-9].*' -o -name '*.driveupload' -o -name '* conflicted copy *' \) 2>/dev/null | wc -l | tr -d ' ')
find .git -type f \( -name '* [0-9].*' -o -name '*.driveupload' -o -name '* conflicted copy *' \) -delete 2>/dev/null || true
find .git -name 'index [0-9].lock' -delete 2>/dev/null || true
find .git/hooks -name '* [0-9]' -delete 2>/dev/null || true
echo "  removed $git_dupes file(s) from .git"

echo "→ Cleaning Google-Drive duplicates from the working tree (excluding node_modules/.git)…"
wt_dupes=$(find . -path ./node_modules -prune -o -path ./.git -prune -o \
  \( -name '* [0-9].*' -o -name '*.driveupload' -o -name '* conflicted copy *' \) -type f -print 2>/dev/null \
  | grep -vE 'node_modules|/\.git/' | wc -l | tr -d ' ')
find . -path ./node_modules -prune -o -path ./.git -prune -o \
  \( -name '* [0-9].*' -o -name '*.driveupload' -o -name '* conflicted copy *' \) -type f -print 2>/dev/null \
  | grep -vE 'node_modules|/\.git/' | while IFS= read -r f; do rm -f "$f"; done
echo "  removed $wt_dupes duplicate file(s) from the working tree"

echo "→ Scanning tracked source for Git conflict markers…"
marked=$(git grep -lE '^(<{7}|={7}|>{7})( |$)' -- 'src/**' 'server/src/**' 2>/dev/null || true)
if [ -n "$marked" ]; then
  echo "  ⚠ conflict markers found in:" >&2
  printf '     %s\n' $marked >&2
  echo "  These are likely clean in HEAD. To restore: git checkout HEAD -- <file>" >&2
else
  echo "  none ✓"
fi

echo "✓ done."
