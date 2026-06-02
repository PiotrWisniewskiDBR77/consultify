#!/usr/bin/env bash
# shellcheck shell=bash
#
# One-time installer for git-tools/ hooks.
#
# Sets `core.hooksPath` for the current repo to point at our hooks
# directory, then ensures every script in there is executable. After
# this runs once, all commits in this repo get attribution-checked
# automatically.
#
# Idempotent: safe to run multiple times. Safe to commit the
# `core.hooksPath` config because it's a per-repo (not global) setting.
#
# Usage:
#
#   cd <git-work-tree>
#   ./scripts/git-tools/install-hooks.sh
#
# Verifies the hook fires by listing the configured path and showing
# the registered hooks.

set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "install-hooks: not a git work tree (cwd=$(pwd))" >&2
  exit 65
fi

# Resolve the hooks directory relative to the script's own location
# so this works regardless of where the user invokes it from.
script_dir="$(cd "$(dirname "$0")" && pwd -P)"
hooks_dir="$script_dir/hooks"

mkdir -p "$hooks_dir"

# Wire up post-commit. Symlinking from hooks/ → ../post-commit-attribution-check
# means changes to the underlying script don't require a re-install.
post_commit_link="$hooks_dir/post-commit"
post_commit_target="../post-commit-attribution-check"

if [ -L "$post_commit_link" ] && [ "$(readlink "$post_commit_link")" = "$post_commit_target" ]; then
  : # already correct
else
  rm -f "$post_commit_link"
  ln -s "$post_commit_target" "$post_commit_link"
fi

# Ensure underlying scripts are executable.
chmod +x "$script_dir/atomic-commit.sh" "$script_dir/post-commit-attribution-check" 2>/dev/null || true

# Wire core.hooksPath for this repo. Path must be relative to repo
# top-level so the same config works for anyone who clones this repo.
repo_top="$(git rev-parse --show-toplevel)"
rel_hooks_dir="${hooks_dir#$repo_top/}"

# If we're inside the consultify submodule, repo_top is .../consultify
# and rel_hooks_dir is `scripts/git-tools/hooks`. If we're in the
# parent, rel_hooks_dir is `DRD/consultify/scripts/git-tools/hooks`.
git config core.hooksPath "$rel_hooks_dir"

# Done.
echo "install-hooks: configured this repo to use core.hooksPath = $rel_hooks_dir"
echo "install-hooks: registered hooks:"
ls -la "$hooks_dir"
echo
echo "install-hooks: verify with: git config --get core.hooksPath"
echo "install-hooks: test with:   make a small commit and watch stderr"
