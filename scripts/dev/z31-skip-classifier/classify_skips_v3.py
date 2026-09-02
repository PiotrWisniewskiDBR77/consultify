#!/usr/bin/env python3
"""v3: comment-aware. Strips // and /* */ comments (respecting strings)
before matching skip/skipIf calls, eliminating false positives from
comments that merely *mention* `describe.skipIf(true)` etc. Then applies
the same classification + backward env-resolution as v1/v2, in one pass."""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from strip_comments import strip_comments

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
EXCLUDE_DIRS = {"node_modules", ".git", "dist", "build", "coverage"}

CALL_RE = re.compile(r"\b(describe|it|test)\.(skip|skipIf)\(")

ENV_KEYWORDS = re.compile(
    r"process\.env|DATABASE_URL|RUN_DB_TESTS|MOCK_DB|REAL_DB|realDb|REAL_PG|realPg|hasAuth|"
    r"API_KEY|apiKey|TOKEN|token|DEMO_PRESENT|dbContainer|databaseUrl|LLM|"
    r"STT_AVAILABLE|VOICE|WHISPER|staging|loadAuth|E2E_|OPENAI|OPENROUTER|GEMINI|"
    r"CI\b|ENV\b|FEATURE_FLAG|isRealDatabaseTestModeRequested|OLLAMA|SKIP_INTEGRATION",
    re.IGNORECASE,
)
VAR_DECL_RE_TMPL = r"\b(?:const|let|var)\s+{name}\s*[:=]"


def find_ts_files(root):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fn in filenames:
            if fn.endswith((".ts", ".tsx", ".mts")):
                yield os.path.join(dirpath, fn)


def extract_call(text, start_paren_idx):
    depth = 0
    i = start_paren_idx
    n = len(text)
    in_str = None
    out = []
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
            out.append(ch)
            i += 1
            continue
        if ch == ")":
            depth -= 1
            out.append(ch)
            i += 1
            if depth == 0:
                break
            continue
        out.append(ch)
        i += 1
        if len(out) > 20000:
            break
    return "".join(out)


def top_level_args(call_text):
    inner = call_text[1:-1] if call_text.endswith(")") else call_text[1:]
    args = []
    depth = 0
    in_str = None
    cur = []
    i = 0
    n = len(inner)
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
            cur.append(ch)
            i += 1
            continue
        if ch in ")]}":
            depth -= 1
            cur.append(ch)
            i += 1
            continue
        if ch == "," and depth == 0:
            args.append("".join(cur).strip())
            cur = []
            i += 1
            continue
        cur.append(ch)
        i += 1
    if cur:
        args.append("".join(cur).strip())
    return args


def resolve_env(stripped_lines, orig_lines, line_no, condition):
    if not condition:
        return False
    if ENV_KEYWORDS.search(condition):
        return True
    ident_m = re.match(r"^!?\(?\s*([A-Za-z_$][A-Za-z0-9_$]*)", condition)
    if not ident_m:
        return False
    ident = ident_m.group(1)
    decl_re = re.compile(VAR_DECL_RE_TMPL.format(name=re.escape(ident)))
    start = max(0, line_no - 80)
    for i in range(min(line_no, len(stripped_lines)) - 1, start - 1, -1):
        if decl_re.search(stripped_lines[i]):
            chunk = stripped_lines[i]
            j = i
            while ";" not in chunk and j - i < 8 and j + 1 < len(stripped_lines):
                j += 1
                chunk += " " + stripped_lines[j]
            return bool(ENV_KEYWORDS.search(chunk))
    return False


def classify_entry(mod, args, has_comment_above):
    first_arg = args[0] if args else ""
    is_string_first = bool(re.match(r"""^['"`]""", first_arg))
    is_true_literal = first_arg.strip() == "true"
    is_empty = len(args) == 0
    reason_arg = None
    if len(args) >= 2 and re.match(r"""^['"`]""", args[1].strip()):
        reason_arg = args[1].strip()

    if mod == "skipIf":
        if is_true_literal:
            return {"category": "B", "subtype": "skipIf-true-permanent", "condition": "true",
                    "reason_arg": None, "has_built_in_reason": False}
        return {"category": "A", "subtype": "cond", "condition": first_arg[:200],
                "reason_arg": reason_arg, "has_built_in_reason": reason_arg is not None}

    # mod == 'skip'
    if is_empty:
        return {"category": "B", "subtype": "bare-no-args", "condition": None,
                "reason_arg": None, "has_built_in_reason": False}
    if is_string_first:
        return {"category": "B", "subtype": "classic-unconditional", "condition": None,
                "reason_arg": None, "has_built_in_reason": False, "name_text": first_arg[:200]}
    if is_true_literal:
        return {"category": "B", "subtype": "hardcoded-true-with-reason", "condition": "true",
                "reason_arg": reason_arg, "has_built_in_reason": reason_arg is not None}
    return {"category": "A", "subtype": "playwright-runtime-cond", "condition": first_arg[:200],
            "reason_arg": reason_arg, "has_built_in_reason": reason_arg is not None}


def main():
    results = []
    for path in find_ts_files(ROOT):
        rel = os.path.relpath(path, ROOT)
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as fh:
                orig_text = fh.read()
        except Exception:
            continue
        stripped_text = strip_comments(orig_text)
        if not CALL_RE.search(stripped_text):
            continue
        stripped_lines = stripped_text.split("\n")
        orig_lines = orig_text.split("\n")
        for m in CALL_RE.finditer(stripped_text):
            mod = m.group(2)
            paren_idx = m.end() - 1
            call_text = extract_call(stripped_text, paren_idx)
            args = top_level_args(call_text)
            line_no = stripped_text.count("\n", 0, m.start()) + 1
            prev_line = orig_lines[line_no - 2] if line_no - 2 >= 0 else ""
            prev_stripped = prev_line.strip()
            has_comment_above = (
                prev_stripped.startswith("//")
                or prev_stripped.startswith("*")
                or prev_stripped.endswith("*/")
                or prev_stripped.startswith("/*")
            )
            info = classify_entry(mod, args, has_comment_above)
            if info["category"] == "A" and info["subtype"] in ("cond", "playwright-runtime-cond"):
                is_env = resolve_env(stripped_lines, orig_lines, line_no, info.get("condition"))
                info["subtype"] = ("env-" if is_env else "other-") + info["subtype"]
            info["has_comment_above"] = has_comment_above
            results.append({
                "file": rel,
                "line": line_no,
                "mod": mod,
                **info,
            })

    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "skip_inventory_v3.json"), "w") as out:
        json.dump(results, out, indent=1)

    from collections import Counter
    cat_counts = Counter(r["category"] for r in results)
    subtype_counts = Counter((r["category"], r["subtype"]) for r in results)
    for r in results:
        r["truly_forgotten"] = (
            r["category"] == "B"
            and not r["has_comment_above"]
            and not r["has_built_in_reason"]
        )
    forgotten = sum(1 for r in results if r["truly_forgotten"])
    documented = sum(1 for r in results if r["has_comment_above"] or r["has_built_in_reason"])

    print(f"TOTAL: {len(results)}")
    print("=== category ===")
    for k, v in cat_counts.most_common():
        print(f"{k}: {v}")
    print("=== subtype ===")
    for k, v in subtype_counts.most_common():
        print(f"{k}: {v}")
    print(f"documented: {documented}")
    print(f"truly forgotten (B, no comment, no built-in reason): {forgotten}")

    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "skip_inventory_v3.json"), "w") as out:
        json.dump(results, out, indent=1)


if __name__ == "__main__":
    main()
