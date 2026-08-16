#!/usr/bin/env bash
set -euo pipefail

base_ref="${1:-origin/demo}"

# HTTP/SQL captures and raw regression transcripts intentionally preserve the
# exact bytes emitted by external tools. Rewriting their CRLF/trailing spaces
# would mutate evidence. All code and ordinary documentation remain in scope.
git diff --check "${base_ref}...HEAD" -- . \
  ':(exclude)docs/qa/**' \
  ':(exclude)docs/program/**/readiness/evidence/**' \
  ':(exclude)docs/program/**/regression-batches/**' \
  ':(exclude)docs/program/**/HANDOFF_*_TESTS.tsv'

echo "Candidate whitespace gate passed; immutable raw-evidence paths excluded by policy."
