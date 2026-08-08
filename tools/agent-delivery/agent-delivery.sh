#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <validate|checkpoint|handoff> <v8|documents|finance|ux-table|ux-tools|report-b-ui> [commit message]" >&2
  exit 64
}

action="${1:-}"
track="${2:-}"
message="${3:-}"
[[ -n "$action" && -n "$track" ]] || usage

case "$track" in
  v8)
    expected_branch="codex/recovery-agent-v8-20260808"
    expected_owner="AGENT_V8"
    ;;
  documents)
    expected_branch="codex/recovery-documents-20260808"
    expected_owner="DOCUMENTS"
    ;;
  finance)
    expected_branch="codex/recovery-finance-20260808"
    exact_scope="track-scopes/finance.txt"
    ;;
  ux-table)
    expected_branch="codex/recovery-ux-table-20260808"
    exact_scope="track-scopes/ux-table.txt"
    ;;
  ux-tools)
    expected_branch="codex/recovery-ux-tools-20260808"
    exact_scope="track-scopes/ux-tools.txt"
    ;;
  report-b-ui)
    expected_branch="codex/recovery-report-b-ui-20260808"
    expected_owner="REPORT_B_UI"
    ;;
  *) usage ;;
esac

repo_root="$(git rev-parse --show-toplevel)"
current_branch="$(git branch --show-current)"
matrix="$repo_root/docs/program/recovery-2026-08-08/FILE_OWNERSHIP_MATRIX.tsv"

[[ "$current_branch" == "$expected_branch" ]] || {
  echo "BLOCKED: track '$track' requires branch '$expected_branch'; current branch is '$current_branch'." >&2
  exit 2
}

[[ -f "$matrix" ]] || {
  echo "BLOCKED: ownership matrix is missing: $matrix" >&2
  exit 3
}

changed_file_list="$(mktemp)"
trap 'rm -f "$changed_file_list"' EXIT

{
  git diff --name-only -z HEAD
  git ls-files --others --exclude-standard -z
} > "$changed_file_list"

validate_paths() {
  local invalid=0
  local changed_path owner

  while IFS= read -r -d '' changed_path; do
    if [[ -n "${exact_scope:-}" ]]; then
      if ! grep -Fqx -- "$changed_path" "$repo_root/docs/program/recovery-2026-08-08/$exact_scope"; then
        echo "BLOCKED: '$changed_path' is outside the exact scope for '$track'." >&2
        invalid=1
      fi
      continue
    fi
    owner="$(awk -F '\t' -v candidate="$changed_path" '$1 == candidate { print $3; exit }' "$matrix")"
    if [[ -z "$owner" ]]; then
      echo "BLOCKED: '$changed_path' is absent from the ownership matrix." >&2
      invalid=1
    elif [[ "$owner" != "$expected_owner" ]]; then
      echo "BLOCKED: '$changed_path' belongs to '$owner', not '$expected_owner'." >&2
      invalid=1
    fi
  done < "$changed_file_list"

  [[ "$invalid" -eq 0 ]]
}

validate_paths

case "$action" in
  validate)
    echo "PASS: branch=$current_branch scope=${exact_scope:-$expected_owner} changed=$(tr -cd '\0' < "$changed_file_list" | wc -c | tr -d ' ')"
    ;;
  checkpoint)
    [[ -s "$changed_file_list" ]] || {
      echo "BLOCKED: there are no changes to checkpoint." >&2
      exit 4
    }
    [[ -n "$message" ]] || message="wip($track): safe agent checkpoint"
    while IFS= read -r -d '' changed_path; do
      git add -- "$changed_path"
    done < "$changed_file_list"
    git diff --cached --check
    git commit -m "$message"
    git status --porcelain=v1 | grep -q . && {
      echo "BLOCKED: checkpoint commit completed, but the worktree is still dirty." >&2
      exit 5
    }
    echo "CHECKPOINT_OK: $(git rev-parse HEAD)"
    ;;
  handoff)
    git status --porcelain=v1 | grep -q . && {
      echo "BLOCKED: worktree is dirty. Run checkpoint first." >&2
      exit 6
    }
    git push --set-upstream origin "HEAD:$expected_branch"
    remote_sha="$(git ls-remote origin "refs/heads/$expected_branch" | awk '{print $1}')"
    local_sha="$(git rev-parse HEAD)"
    [[ "$remote_sha" == "$local_sha" ]] || {
      echo "BLOCKED: remote SHA '$remote_sha' differs from local SHA '$local_sha'." >&2
      exit 7
    }
    printf 'READY_FOR_CODEX_REVIEW\nTrack: %s\nBranch: %s\nHEAD SHA: %s\nWorktree clean: YES\nRemote synchronized: YES\nMerge performed: NO\nDeploy performed: NO\nDatabase mutation performed: NO\n' "$track" "$expected_branch" "$local_sha"
    ;;
  *) usage ;;
esac
