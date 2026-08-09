#!/usr/bin/env bash
set -euo pipefail

repo=${1:?usage: build-five-track-scopes.sh REPO OUTPUT_DIR}
output=${2:?usage: build-five-track-scopes.sh REPO OUTPUT_DIR}
matrix="$repo/docs/program/recovery-2026-08-08/FILE_OWNERSHIP_MATRIX.tsv"
mkdir -p "$output"

collect_worktree() {
  local worktree=$1
  {
    git -C "$worktree" diff --name-only HEAD
    git -C "$worktree" ls-files --others --exclude-standard
  }
}

collect_commits() {
  local commit
  for commit in "$@"; do
    git -C "$repo" diff-tree --no-commit-id --name-only -r "$commit"
  done
}

filter_report_ui() {
  awk -F '\t' 'NR==FNR { owner[$1]=$3; next } owner[$0]=="REPORT_B_UI" { print }' "$matrix" - | sort -u
}

finance_source="/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-finance-recovery-20260807"
ux_table_a="/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-cb01-accessibility-20260808"
ux_table_b="/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-cb03-availability-20260808"
ux_table_c="/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-cb05-spatial-20260808"
ux_tools_source="/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-ui45-followup"

{
  git -C "$finance_source" diff --name-only HEAD
  collect_commits 07f444f8fdf932b331462e7b7b28f9a1f3cb8e9f 723b3080601b23ad501d54a3892779c49ff93e05 1676900f1df66d48554416f8a003764815afd443 eb60c730dd4a60a2ca5c3887808d7d2ceafa3fee
} | awk '/^(server\/src|src|tests)\//' | sort -u > "$output/finance.candidate.txt"

{
  collect_worktree "$ux_table_a"
  collect_worktree "$ux_table_b"
  collect_worktree "$ux_table_c"
} | sort -u | filter_report_ui > "$output/ux-table.candidate.txt"

{
  collect_worktree "$ux_tools_source"
  collect_commits 16d972a242 859abe0980 da6e409e2b
} | sort -u | filter_report_ui > "$output/ux-tools.candidate.txt"

cat "$output/finance.candidate.txt" "$output/ux-table.candidate.txt" "$output/ux-tools.candidate.txt" \
  | sort | uniq -d > "$output/shared-integrator.txt"

for track in finance ux-table ux-tools; do
  comm -23 "$output/$track.candidate.txt" "$output/shared-integrator.txt" > "$output/$track.txt"
done

printf 'finance\t%s\nux-table\t%s\nux-tools\t%s\nshared-integrator\t%s\n' \
  "$(wc -l < "$output/finance.txt" | tr -d ' ')" \
  "$(wc -l < "$output/ux-table.txt" | tr -d ' ')" \
  "$(wc -l < "$output/ux-tools.txt" | tr -d ' ')" \
  "$(wc -l < "$output/shared-integrator.txt" | tr -d ' ')"
