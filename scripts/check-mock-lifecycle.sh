#!/usr/bin/env bash
# DAY211: ratchet for chained mock implementations installed in beforeAll.
# Report mode always exits 0; --ci blocks only debt above the per-file baseline.
# FIX-211: matching is per-target (same spy identity in beforeAll and
# beforeEach), not "any setter anywhere in beforeEach clears the whole file";
# and only vi.spyOn(...) counts as blocking debt - bare vi.fn() survives
# clearAllMocks() regardless of beforeEach and is reported as a non-blocking
# warning only. See scripts/check-mock-lifecycle.baseline.json and the
# FIX-211 report for the evidence behind both changes.
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
# FIX-211: only vi.spyOn(...) reliably loses its implementation under the
# repo's global clearAllMocks() (tests/setup.ts) - confirmed empirically
# (6/6 reproductions in the FIX-211 report). Bare vi.fn(), whether stored in
# a variable or assigned straight onto an object property, survives
# clearAllMocks in every case tried. So vi.spyOn(...) chains are BLOCKING;
# anything else matching setter_re is reported as a non-blocking WARNING
# only (kept for visibility, not counted toward the baseline/--ci gate).
spyon_re = re.compile(
    r"vi\s*\.\s*spyOn\s*\(\s*([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)\s*,\s*['\"]([A-Za-z_$][\w$]*)['\"]\s*\)"
)
# `varName = vi.spyOn(obj, 'method')` lets a beforeEach reinstall through a
# spy variable resolve to the same "obj.method" target as the beforeAll spy.
assign_re = re.compile(
    r"\b([A-Za-z_$][\w$]*)\s*=\s*vi\s*\.\s*spyOn\s*\(\s*([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)\s*,\s*['\"]([A-Za-z_$][\w$]*)['\"]\s*\)"
)
# Generic receiver chain immediately before a `.mockXxx(` call, e.g.
# `contextDocumentServiceMock.listAccessibleDocuments` or `vi.fn()`.
chain_re = re.compile(r'([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)(?:\s*\([^()]*\))?$')

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

def hook_blocks(clean):
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
            found[match.group(1)].append((brace, end))
    return found

def var_targets(source):
    """Map `varName -> 'obj.method'` for every `varName = vi.spyOn(obj,'method')`
    found anywhere in the (unmasked) file, so a beforeEach reinstall through a
    spy variable resolves to the same target as the beforeAll spy."""
    targets = {}
    for m in assign_re.finditer(source):
        obj = re.sub(r'\s+', '', m.group(2))
        targets[m.group(1)] = f'{obj}.{m.group(3)}'
    return targets

def target_key(source, dot_index, targets):
    """Best-effort identity of the mock armed by the setter call whose
    `.mockXxx(` starts at `dot_index` in `source` (the ORIGINAL, unmasked
    text - masking blanks out string literals, which would hide the spyOn
    method name). Returns (kind, key): kind is 'spy' (vi.spyOn - blocking)
    or 'fn' (anything else - warning only)."""
    window_start = max(0, dot_index - 300)
    prefix = source[window_start:dot_index]
    for sm in spyon_re.finditer(prefix):
        if sm.end() == len(prefix):
            obj = re.sub(r'\s+', '', sm.group(1))
            return 'spy', f'{obj}.{sm.group(2)}'
    cm = chain_re.search(prefix)
    if cm:
        chain = re.sub(r'\s+', '', cm.group(0))
        base = re.match(r'[A-Za-z_$][\w$]*', chain)
        if base and '.' not in chain and base.group(0) in targets:
            return 'spy', targets[base.group(0)]
        return 'fn', chain
    return 'fn', f'@{dot_index}'

def scan(name):
    """Returns a list of (line, kind) for each beforeAll setter that is not
    reinstalled, for the SAME target, in a beforeEach in this file. Per-target
    matching (not "any setter anywhere in beforeEach clears the whole file")."""
    path = Path(name)
    if not path.is_file(): return []
    source = path.read_text(encoding='utf-8')
    clean = mask(source)
    hooks = hook_blocks(clean)
    targets = var_targets(source)

    def setters_in(spans):
        hits = []
        for brace, end in spans:
            block = clean[brace:end]
            for hit in setter_re.finditer(block):
                dot_index = brace + hit.start()
                kind, key = target_key(source, dot_index, targets)
                hits.append((dot_index, kind, key))
        return hits

    before_each_spy_keys = {key for _, kind, key in setters_in(hooks['beforeEach']) if kind == 'spy'}

    violations = []
    for dot_index, kind, key in setters_in(hooks['beforeAll']):
        if kind == 'spy' and key in before_each_spy_keys:
            continue  # same spy target reinstalled per-test - not a violation
        line = source.count('\n', 0, dot_index) + 1
        violations.append((line, kind))
    violations.sort()
    return violations

current = {}
for name in names:
    hits = scan(name)
    if hits: current[name] = hits

baseline_file = Path(baseline_path)
baseline = {'total': 0, 'files': {}}
if baseline_file.exists(): baseline = json.loads(baseline_file.read_text(encoding='utf-8'))

blocking_total = sum(1 for hits in current.values() for _, kind in hits if kind == 'spy')
warning_total = sum(1 for hits in current.values() for _, kind in hits if kind == 'fn')
print(f"mock-lifecycle: {blocking_total} blocking violation(s), {warning_total} warning(s) in {len(current)} file(s)")
for name, hits in sorted(current.items()):
    for line, kind in hits:
        if kind == 'spy':
            print(f"{name}:{line}: chained vi.spyOn(...) mock implementation in beforeAll without a beforeEach reinstall for the same target")
        else:
            print(f"{name}:{line}: WARNING (non-blocking): mock setter in beforeAll without a matching beforeEach reinstall (bare vi.fn() survives clearAllMocks - informational only)")

# Blocking bookkeeping (baseline + --ci growth check) tracks vi.spyOn hits
# only - see the FIX-211 note at the top of this file.
current_blocking = {name: [line for line, kind in hits if kind == 'spy'] for name, hits in current.items()}
current_blocking = {name: lines for name, lines in current_blocking.items() if lines}

if mode == 'update':
    data = {'total': sum(len(v) for v in current_blocking.values()), 'files': {k: len(v) for k, v in sorted(current_blocking.items())}}
    baseline_file.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    print(f"mock-lifecycle: baseline updated: {data['total']}")
    raise SystemExit(0)

if mode == 'ci':
    grew = []
    old_files = baseline.get('files', {})
    for name, lines in current_blocking.items():
        if len(lines) > int(old_files.get(name, 0)): grew.append((name, len(lines), int(old_files.get(name, 0))))
    if grew:
        for name, now, old in grew: print(f"mock-lifecycle: debt grew for {name}: {old} -> {now}", file=sys.stderr)
        raise SystemExit(1)

raise SystemExit(0)
PY
