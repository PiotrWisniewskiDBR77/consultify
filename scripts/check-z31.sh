#!/usr/bin/env bash
# Z31 detektor (2026-08-31) — ratchet guard for two classes of test-suite lie
# measured that day: (1) a test pinned to a literal disposable-database NAME
# instead of the RUN_DB_TESTS/MOCK_DB/postgres:// gate, which silently skips
# (exit 0) the instant that one database is renamed or missing; (2) a
# permanent, unconditional skip (describe.skip/it.skip/bare test.skip()) with
# no adjacent justification anywhere - "disabled and forgotten".
#
# Report mode always exits 0; --ci blocks only NEW debt above the baseline
# (per class, per file). Existing debt is grandfathered into the baseline so
# this does not block unrelated work - see
# docs/program/funkcje/INWENTARZ_POMINIEC.md for the full inventory this
# baseline was seeded from (7 db-name pins already unpinned that day, 7
# permanent-unjustified skips left as pre-existing debt).
#
# Detection is comment-aware (strips // and /* */ before matching, respecting
# string literals) - a naive regex over raw source over-counted by matching a
# comment that merely *quotes* `describe.skipIf(true)` as prose (see the
# INWENTARZ doc). Justification search for the permanent-skip class is
# deliberately generous (comment up to 8 lines back through wrapper-only
# lines, first line inside the callback body, built-in Playwright reason
# arg, self-explaining name/tag) - a guard that cries wolf on documented
# code gets disabled by the first person it blocks (see prompt: "bezpiecznik
# ktory wyje bez powodu, zostanie wylaczony przez pierwsza osobe, ktorej
# przeszkodzi"). Underclaiming a violation is the safe failure mode here;
# overclaiming one is not.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BASELINE="scripts/check-z31.baseline.json"
MODE=report
FILES=()

for arg in "$@"; do
  case "$arg" in
    --ci) MODE=ci ;;
    --update-baseline) MODE=update ;;
    -h|--help)
      echo "usage: scripts/check-z31.sh [--ci|--update-baseline] [test files...]"
      exit 0
      ;;
    --*) echo "check-z31: unknown option: $arg" >&2; exit 2 ;;
    *) FILES+=("$arg") ;;
  esac
done

if [ "${#FILES[@]}" -eq 0 ]; then
  while IFS= read -r file; do
    [ -n "$file" ] && FILES+=("$file")
  done < <(git ls-files | grep -E '\.(test|spec)\.(ts|tsx|mts)$' || true)
fi

python3 - "$MODE" "$BASELINE" "${FILES[@]}" <<'PY'
import json
import re
import sys
from pathlib import Path

mode, baseline_path, *names = sys.argv[1:]


def strip_comments(text: str) -> str:
    """JS/TS-aware comment stripper; preserves line numbers and string
    contents so regexes over the result never see comment text as code."""
    out = []
    i, n = 0, len(text)
    in_str = None
    while i < n:
        ch = text[i]
        if in_str:
            out.append(ch)
            if ch == "\\" and i + 1 < n:
                i += 1
                out.append(text[i])
            elif ch == in_str:
                in_str = None
            i += 1
            continue
        if ch in ("'", '"', "`"):
            in_str = ch
            out.append(ch)
            i += 1
            continue
        if ch == "/" and i + 1 < n and text[i + 1] == "/":
            j = i
            while j < n and text[j] != "\n":
                j += 1
            out.append(" " * (j - i))
            i = j
            continue
        if ch == "/" and i + 1 < n and text[i + 1] == "*":
            j = i + 2
            while j + 1 < n and not (text[j] == "*" and text[j + 1] == "/"):
                j += 1
            j = min(j + 2, n)
            out.append("".join(c if c == "\n" else " " for c in text[i:j]))
            i = j
            continue
        out.append(ch)
        i += 1
    return "".join(out)


# ---------------------------------------------------------------------
# Class 1: database-NAME pins (Z31 proper). A gate is fine when it checks
# RUN_DB_TESTS/MOCK_DB/DATABASE_URL.startsWith('postgres') - the moment it
# also demands one specific literal name/host/port, it silently skips (or,
# worse, throws unhelpfully) on any other disposable database.
# ---------------------------------------------------------------------
PIN_PATTERNS = [
    re.compile(r"DATABASE_URL[^\n;]{0,40}?\.(?:endsWith|includes)\(\s*['\"][^'\"]*['\"]\s*\)"),
    re.compile(r"DATABASE_URL[^\n;]{0,10}?===\s*['\"]postgres(?:ql)?://[^'\"]+['\"]"),
    re.compile(r"expectedDatabase\s*:\s*['\"][^'\"]+['\"]"),
    # the day47/day42-style inner re-pin: `target.rows[0]?.database !== 'cx_day47'`
    # narrowed to `rows[0]` specifically so it doesn't match an unrelated
    # `.name !== '...'` filter over arbitrary application data (e.g. a
    # backup-manifest table-name filter - a real false positive hit during
    # dogfooding, see docs/program/funkcje/INWENTARZ_POMINIEC.md).
    re.compile(r"rows\[0\]\??\.(?:name|database)\s*!==\s*['\"][a-zA-Z0-9_]+['\"]"),
]


def find_db_pins(stripped: str):
    hits = []
    for pat in PIN_PATTERNS:
        for m in pat.finditer(stripped):
            line = stripped.count("\n", 0, m.start()) + 1
            hits.append(line)
    return sorted(set(hits))


# ---------------------------------------------------------------------
# Class 2: permanent, unjustified skips - describe.skip('name', fn) /
# it.skip(...) / bare test.skip() / test.skip(true, ...) with NO adjacent
# justification anywhere nearby.
# ---------------------------------------------------------------------
CALL_RE = re.compile(r"\b(describe|it|test)\.(skip|skipIf)\(")
NAME_HINT_RE = re.compile(
    r"requires|deprecat|no longer exist|not (wired|surfaced|implemented|available)|"
    r"\[MANUAL\]|manual|headless|SKIPPED|TODO|FIXME|known.issue|blocked|"
    r"pending|unsupported|flaky|verify manually|needs (a )?live|not on-screen",
    re.IGNORECASE,
)


def extract_call(text, paren_idx):
    depth, i, n, in_str, out = 0, paren_idx, len(text), None, []
    while i < n:
        ch = text[i]
        if in_str:
            out.append(ch)
            if ch == "\\":
                i += 1
                if i < n:
                    out.append(text[i])
            elif ch == in_str:
                in_str = None
            i += 1
            continue
        if ch in ("'", '"', "`"):
            in_str = ch
            out.append(ch)
            i += 1
            continue
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        out.append(ch)
        i += 1
        if ch == ")" and depth == 0:
            break
        if len(out) > 20000:
            break
    return "".join(out)


def top_level_args(call_text):
    inner = call_text[1:-1] if call_text.endswith(")") else call_text[1:]
    args, depth, in_str, cur, i, n = [], 0, None, [], 0, len(inner)
    while i < n:
        ch = inner[i]
        if in_str:
            cur.append(ch)
            if ch == "\\":
                i += 1
                if i < n:
                    cur.append(inner[i])
            elif ch == in_str:
                in_str = None
            i += 1
            continue
        if ch in ("'", '"', "`"):
            in_str = ch
            cur.append(ch)
            i += 1
            continue
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif ch == "," and depth == 0:
            args.append("".join(cur).strip())
            cur = []
            i += 1
            continue
        cur.append(ch)
        i += 1
    if cur:
        args.append("".join(cur).strip())
    return args


def is_comment_line(s):
    s = s.strip()
    return s.startswith("//") or s.startswith("*") or s.startswith("/*") or s.endswith("*/")


def is_wrapper_only(s):
    s = s.strip()
    if not s:
        return True
    if re.match(r"^(describe|test\.describe)\(", s):
        return True
    return s in ("{", "});", "})", "() => {")


def find_forgotten_skips(source: str, stripped: str):
    lines = stripped.split("\n")
    orig_lines = source.split("\n")
    hits = []
    for m in CALL_RE.finditer(stripped):
        mod = m.group(2)
        call_text = extract_call(stripped, m.end() - 1)
        args = top_level_args(call_text)
        line_no = stripped.count("\n", 0, m.start()) + 1
        idx = line_no - 1

        first_arg = args[0] if args else ""
        is_string_first = bool(re.match(r"""^['"`]""", first_arg))
        is_true_literal = first_arg.strip() == "true"
        is_empty = len(args) == 0
        has_reason = len(args) >= 2 and bool(re.match(r"""^['"`]""", args[1].strip()))

        if mod == "skipIf":
            continue  # conditional by construction - not this guard's target
        permanent = is_empty or is_string_first or is_true_literal
        if not permanent:
            continue  # runtime-conditional test.skip(condition, reason)

        if is_empty:
            # imperative in-body `test.skip()` guarded by an enclosing
            # if/catch a few lines up is conditional, not permanent.
            near_guard = any(
                re.search(r"\b(if|catch)\s*\(", orig_lines[k])
                for k in range(max(0, idx - 3), idx)
            )
            if near_guard:
                continue

        if has_reason:
            continue  # built-in Playwright reason argument - documented

        name_text = first_arg if is_string_first else ""
        if name_text and (
            NAME_HINT_RE.search(name_text)
            or re.search(r"\[[a-z0-9_-]+\]|\([^)]*(requires|no longer|removed)[^)]*\)", name_text, re.IGNORECASE)
        ):
            continue  # self-documenting name/tag

        found_comment = False
        hops, j = 0, idx - 1
        while j >= 0 and hops < 8:
            s = orig_lines[j].strip()
            if is_comment_line(s):
                found_comment = True
                break
            if is_wrapper_only(s):
                j -= 1
                hops += 1
                continue
            break
        if found_comment:
            continue
        for k in range(idx + 1, min(idx + 3, len(orig_lines))):
            s = orig_lines[k].strip()
            if not s:
                continue
            if is_comment_line(s):
                found_comment = True
            break
        if found_comment:
            continue

        hits.append(line_no)
    return sorted(set(hits))


def scan(path: str):
    p = Path(path)
    if not p.exists():
        return [], []
    try:
        source = p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return [], []
    stripped = strip_comments(source)
    return find_db_pins(stripped), find_forgotten_skips(source, stripped)


current_pins = {}
current_skips = {}
for name in names:
    pins, skips = scan(name)
    if pins:
        current_pins[name] = pins
    if skips:
        current_skips[name] = skips

baseline_file = Path(baseline_path)
baseline = {"pins": {}, "skips": {}}
if baseline_file.exists():
    baseline = json.loads(baseline_file.read_text(encoding="utf-8"))

pin_total = sum(len(v) for v in current_pins.values())
skip_total = sum(len(v) for v in current_skips.values())
print(f"check-z31: {pin_total} database-name pin(s) in {len(current_pins)} file(s), "
      f"{skip_total} permanent-unjustified skip(s) in {len(current_skips)} file(s)")
for name, ls in sorted(current_pins.items()):
    for line in ls:
        print(f"{name}:{line}: pinned to a literal database name/connection string instead of the RUN_DB_TESTS/MOCK_DB/postgres:// gate (Z31)")
for name, ls in sorted(current_skips.items()):
    for line in ls:
        print(f"{name}:{line}: permanent skip with no adjacent justification (comment/reason/self-documenting name) - disabled and forgotten")

if mode == "update":
    data = {
        "pins": {k: len(v) for k, v in sorted(current_pins.items())},
        "skips": {k: len(v) for k, v in sorted(current_skips.items())},
    }
    baseline_file.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"check-z31: baseline updated: pins={sum(data['pins'].values())} skips={sum(data['skips'].values())}")
    raise SystemExit(0)

if mode == "ci":
    grew = []
    old_pins = baseline.get("pins", {})
    old_skips = baseline.get("skips", {})
    for name, ls in current_pins.items():
        if len(ls) > int(old_pins.get(name, 0)):
            grew.append((name, "pin", len(ls), int(old_pins.get(name, 0))))
    for name, ls in current_skips.items():
        if len(ls) > int(old_skips.get(name, 0)):
            grew.append((name, "skip", len(ls), int(old_skips.get(name, 0))))
    if grew:
        for name, kind, now, old in grew:
            print(f"check-z31: {kind} debt grew for {name}: {old} -> {now}", file=sys.stderr)
        raise SystemExit(1)

raise SystemExit(0)
PY
