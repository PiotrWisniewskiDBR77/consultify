#!/usr/bin/env bash
set -euo pipefail

repo=${1:?usage: snapshot-dirty-worktrees.sh REPO SNAPSHOT_DIR}
snapshot_root=${2:?usage: snapshot-dirty-worktrees.sh REPO SNAPSHOT_DIR}

mkdir -p "$snapshot_root/worktrees" "$snapshot_root/global"
index="$snapshot_root/global/WORKTREE_SNAPSHOT_INDEX.tsv"
: > "$index"

git -C "$repo" worktree list --porcelain | awk '
  /^worktree / { if (path != "") print path; path=substr($0, 10) }
  END { if (path != "") print path }
' | while IFS= read -r worktree; do
  [[ -d "$worktree" ]] || continue
  status=$(git -C "$worktree" status --porcelain=v1 --untracked-files=all)
  [[ -n "$status" ]] || continue

  name=$(basename "$worktree" | tr -cs 'A-Za-z0-9._-' '_')
  path_id=$(printf '%s' "$worktree" | shasum -a 256 | cut -c1-12)
  destination="$snapshot_root/worktrees/${name}__${path_id}"
  mkdir -p "$destination"

  branch=$(git -C "$worktree" branch --show-current)
  [[ -n "$branch" ]] || branch=DETACHED
  head=$(git -C "$worktree" rev-parse HEAD)
  tracked=$(printf '%s\n' "$status" | awk 'substr($0,1,2)!="??" {n++} END {print n+0}')
  untracked=$(printf '%s\n' "$status" | awk 'substr($0,1,2)=="??" {n++} END {print n+0}')

  git -C "$worktree" status --porcelain=v1 --untracked-files=all > "$destination/status.txt"
  git -C "$worktree" diff --binary HEAD > "$destination/tracked.patch"
  git -C "$worktree" diff --cached --binary > "$destination/index.patch"
  git -C "$worktree" ls-files --others --exclude-standard -z > "$destination/untracked-files.zlist"
  if [[ -s "$destination/untracked-files.zlist" ]]; then
    tar -C "$worktree" --null -T "$destination/untracked-files.zlist" -czf "$destination/untracked-files.tar.gz"
    tar -tzf "$destination/untracked-files.tar.gz" > "$destination/untracked-archive-list.txt"
  fi

  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$destination" "$worktree" "$branch" "$head" "$tracked" "$untracked" >> "$index"
done

git -C "$repo" bundle create "$snapshot_root/global/consultify-all-refs.bundle" --all
find "$snapshot_root" -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 shasum -a 256 > "$snapshot_root/MANIFEST.sha256"
shasum -a 256 -c "$snapshot_root/MANIFEST.sha256"
