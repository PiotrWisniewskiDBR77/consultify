#!/usr/bin/env bash
# shellcheck shell=bash
#
# Atomic git add + commit + attribution verification.
#
# Defends against the Google Drive Desktop "parallel sync" issue
# documented in DRD/consultify/docs/operations/PARALLEL_SYNC_REMEDIATION_2026-05-09.md.
#
# Why this script exists:
#
#   - Google Drive Desktop syncs ~/Documents/Antygracity/ with cloud,
#     causing transient file deletions during file-provider migration
#     and mis-attributing commits to other-machine identities (e.g.
#     `staging`).
#   - The window between `git add` and `git commit` is the most fragile
#     — a sync event landing inside that window strips the staged
#     change away (`no changes added to commit`) or rewrites attribution.
#   - This wrapper chains both operations in a single shell with a
#     short pre-flight delay to settle FS, then verifies attribution
#     after the commit succeeds.
#
# Contract:
#
#   - Exits 0 on success, non-zero on any failure (no silent fallbacks).
#   - Exits 1 if attribution after commit doesn't match git config user.
#   - Exits 2 if no files staged after `git add` (sync window collision).
#   - Pre-flight: 200ms FS settle delay so concurrent sync writes
#     drain before we touch the index.
#
# Usage:
#
#   atomic-commit.sh -m "commit message" file1 file2 ...
#   atomic-commit.sh -F message-file.txt file1 file2 ...
#   atomic-commit.sh -m "commit message" -A   (stage all tracked changes)
#
# Caller responsibilities:
#
#   - Run from inside the target git working directory (cwd matters).
#   - Keep `git config user.name` / `user.email` correctly set in this
#     repo (or globally) — the script verifies against them.
#
# Related:
#
#   - DRD/consultify/scripts/git-tools/post-commit-attribution-check
#     (post-commit hook installable via install-hooks.sh)
#   - DRD/consultify/docs/operations/PARALLEL_SYNC_REMEDIATION_2026-05-09.md
#     (root cause + remediation playbook)

set -euo pipefail

# -------------------------------------------------------------------
# CLI parsing
# -------------------------------------------------------------------

mode="files"           # `files` (explicit list) or `all` (-A flag)
msg=""
msg_file=""
files=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message)
      shift
      [[ -z "${1:-}" ]] && { echo "atomic-commit: -m requires an argument" >&2; exit 64; }
      msg="$1"
      shift
      ;;
    -F|--file)
      shift
      [[ -z "${1:-}" ]] && { echo "atomic-commit: -F requires an argument" >&2; exit 64; }
      msg_file="$1"
      shift
      ;;
    -A|--all)
      mode="all"
      shift
      ;;
    --help|-h)
      sed -n '2,40p' "$0" | sed 's/^#//' >&2
      exit 0
      ;;
    --)
      shift
      while [[ $# -gt 0 ]]; do files+=("$1"); shift; done
      ;;
    -*)
      echo "atomic-commit: unknown flag '$1'" >&2
      exit 64
      ;;
    *)
      files+=("$1")
      shift
      ;;
  esac
done

if [[ -z "$msg" && -z "$msg_file" ]]; then
  echo "atomic-commit: commit message required (use -m or -F)" >&2
  exit 64
fi
if [[ "$mode" == "files" && ${#files[@]} -eq 0 ]]; then
  echo "atomic-commit: no files to stage (use -A to stage everything tracked)" >&2
  exit 64
fi

# -------------------------------------------------------------------
# Pre-flight: verify we're inside a git work tree.
# -------------------------------------------------------------------

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "atomic-commit: not a git work tree (cwd=$(pwd))" >&2
  exit 65
fi

expected_name="$(git config user.name 2>/dev/null || true)"
expected_email="$(git config user.email 2>/dev/null || true)"

if [[ -z "$expected_name" || -z "$expected_email" ]]; then
  echo "atomic-commit: git user.name / user.email is not configured" >&2
  exit 65
fi

# -------------------------------------------------------------------
# Step 1: short pre-flight settle (defends against sync window).
# -------------------------------------------------------------------

# 200ms FS settle. Enough to let Google Drive's file-provider drain
# any pending operations on the files we're about to stage. Not so
# long that interactive use suffers.
sleep 0.2

# -------------------------------------------------------------------
# Step 2: stage atomically.
# -------------------------------------------------------------------

if [[ "$mode" == "all" ]]; then
  # `-A` stages every tracked change including deletions. This is
  # the convenience path; use only when you're sure your `git status`
  # is clean of unrelated changes.
  git add -A
else
  # Use `--` to defend against accidental flag interpretation if any
  # filename starts with `-`.
  git add -- "${files[@]}"
fi

# Sanity: was anything actually staged?
if git diff --cached --quiet; then
  echo "atomic-commit: nothing staged after add (likely sync window collision)" >&2
  echo "atomic-commit: retry recommended; if persistent, re-read PARALLEL_SYNC_REMEDIATION_2026-05-09.md" >&2
  exit 2
fi

# -------------------------------------------------------------------
# Step 3: commit atomically (no shell redirection between add+commit).
# -------------------------------------------------------------------

# `--author` is intentionally NOT set here — we want git to use the
# configured user. The post-commit verification will catch mis-set
# config or external resync.
if [[ -n "$msg_file" ]]; then
  git commit --quiet -F "$msg_file"
else
  git commit --quiet -m "$msg"
fi

# -------------------------------------------------------------------
# Step 4: verify attribution.
# -------------------------------------------------------------------

actual_name="$(git log -1 --format='%an' 2>/dev/null || true)"
actual_email="$(git log -1 --format='%ae' 2>/dev/null || true)"
sha="$(git log -1 --format='%h' 2>/dev/null || true)"

if [[ "$actual_name" != "$expected_name" || "$actual_email" != "$expected_email" ]]; then
  echo "atomic-commit: ATTRIBUTION MISMATCH on $sha" >&2
  echo "atomic-commit:   expected: $expected_name <$expected_email>" >&2
  echo "atomic-commit:   actual:   $actual_name <$actual_email>" >&2
  echo "atomic-commit: commit succeeded but attribution is wrong — investigate before pushing" >&2
  exit 1
fi

printf '[atomic-commit] %s %s | %s\n' \
  "$sha" \
  "$(git log -1 --format='%an')" \
  "$(git log -1 --format='%s')" >&2

exit 0
