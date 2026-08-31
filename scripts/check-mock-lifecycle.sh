#!/usr/bin/env bash
# DAY211: ratchet for chained mock implementations installed in beforeAll.
# Report mode always exits 0; --ci blocks only debt above the per-file baseline.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BASELINE="scripts/check-mock-lifecycle.baseline.json"
MODE=report
FILES=()

for arg in "$@"; do
  case "$arg" in
    --ci) MODE=ci ;;
    --update-baseline) MODE=update ;;
    -h|--help)
      echo "usage: scripts/check-mock-lifecycle.sh [--ci|--update-baseline] [test files...]"
      exit 0
      ;;
    --*) echo "check-mock-lifecycle: unknown option: $arg" >&2; exit 2 ;;
    *) FILES+=("$arg") ;;
  esac
done

if [ "${#FILES[@]}" -eq 0 ]; then
  while IFS= read -r file; do
    [ -n "$file" ] && FILES+=("$file")
  done < <(git ls-files | grep -E '\.(test|spec)\.(ts|tsx|js|jsx)$' || true)
fi

python3 - "$MODE" "$BASELINE" "${FILES[@]}" <<'PY'
import json
import re
import sys
from pathlib import Path

mode, baseline_path, *names = sys.argv[1:]
setter_re = re.compile(r'\.mock(?:ResolvedValue|Implementation|ReturnValue|RejectedValue)\s*\(')
hook_re = re.compile(r'\b(beforeAll|beforeEach)\s*\(')

def mask(source):
    out = list(source)
    i = 0
    state = None
    while i < len(out):
        ch = source[i]
        nxt = source[i + 1] if i + 1 < len(out) else ''
        if state is None:
            if ch == '/' and nxt == '/': state = 'line'; out[i] = out[i + 1] = ' '; i += 2; continue
            if ch == '/' and nxt == '*': state = 'block'; out[i] = out[i + 1] = ' '; i += 2; continue
            if ch in "'\"`": state = ch; out[i] = ' '; i += 1; continue
        elif state == 'line':
            if ch == '\n': state = None
            else: out[i] = ' '
            i += 1; continue
        elif state == 'block':
            if ch == '*' and nxt == '/': out[i] = out[i + 1] = ' '; state = None; i += 2; continue
            if ch != '\n': out[i] = ' '
            i += 1; continue
        else:
            if ch == '\\':
                out[i] = ' '
                if i + 1 < len(out): out[i + 1] = ' '
                i += 2
                continue
            if ch == state: out[i] = ' '; state = None; i += 1; continue
            if ch != '\n': out[i] = ' '
            i += 1; continue
        i += 1
    return ''.join(out)

def hook_blocks(source):
    clean = mask(source)
    found = {'beforeAll': [], 'beforeEach': []}
    for match in hook_re.finditer(clean):
        brace = clean.find('{', match.end())
        if brace < 0: continue
        depth = 0
        end = None
        for pos in range(brace, len(clean)):
            if clean[pos] == '{': depth += 1
            elif clean[pos] == '}':
                depth -= 1
                if depth == 0: end = pos + 1; break
        if end:
            found[match.group(1)].append((brace, end, clean[brace:end]))
    return found

def scan(name):
    path = Path(name)
    if not path.is_file(): return []
    source = path.read_text(encoding='utf-8')
    hooks = hook_blocks(source)
    before_each_has_setter = any(setter_re.search(block) for _, _, block in hooks['beforeEach'])
    violations = []
    if before_each_has_setter: return violations
    for start, _, block in hooks['beforeAll']:
        for hit in setter_re.finditer(block):
            line = source.count('\n', 0, start + hit.start()) + 1
            violations.append(line)
    return violations

current = {}
for name in names:
    hits = scan(name)
    if hits: current[name] = hits

baseline_file = Path(baseline_path)
baseline = {'total': 0, 'files': {}}
if baseline_file.exists(): baseline = json.loads(baseline_file.read_text(encoding='utf-8'))

print(f"mock-lifecycle: {sum(len(v) for v in current.values())} violation(s) in {len(current)} file(s)")
for name, lines in sorted(current.items()):
    for line in lines: print(f"{name}:{line}: chained mock implementation in beforeAll without beforeEach reinstall")

if mode == 'update':
    data = {'total': sum(len(v) for v in current.values()), 'files': {k: len(v) for k, v in sorted(current.items())}}
    baseline_file.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    print(f"mock-lifecycle: baseline updated: {data['total']}")
    raise SystemExit(0)

if mode == 'ci':
    grew = []
    old_files = baseline.get('files', {})
    for name, lines in current.items():
        if len(lines) > int(old_files.get(name, 0)): grew.append((name, len(lines), int(old_files.get(name, 0))))
    if grew:
        for name, now, old in grew: print(f"mock-lifecycle: debt grew for {name}: {old} -> {now}", file=sys.stderr)
        raise SystemExit(1)

raise SystemExit(0)
PY
