#!/usr/bin/env python3
"""v4: fixes two false-positive classes found by manual spot-check:
  1. `test.skip()` (bare, zero args) called inside a runtime `if (...)`
     block is Playwright's IMPERATIVE conditional-skip idiom, not a
     permanent/forgotten skip -> reclassify as A.
  2. Documentation can live further than one line above the skip call
     (a comment block above the *enclosing* describe/wrapper), inside the
     test's own name string (explanatory text, "(requires X)", "[tag]"),
     or as the first line *inside* the callback body. Broadened detection
     across all three before calling something "truly forgotten".
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from strip_comments import strip_comments

data = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "skip_inventory_v3.json")))

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
file_cache = {}

NAME_HINT_RE = re.compile(
    r"requires|deprecat|no longer exist|not (wired|surfaced|implemented|available)|"
    r"\[MANUAL\]|manual|headless|caboose|SKIPPED|TODO|FIXME|known.issue|blocked|"
    r"pending|unsupported|flaky|verify manually|needs (a )?live|not on-screen",
    re.IGNORECASE,
)


def get_lines(rel):
    if rel not in file_cache:
        with open(os.path.join(ROOT, rel), encoding="utf-8", errors="replace") as fh:
            file_cache[rel] = fh.read().split("\n")
    return file_cache[rel]


def is_comment_line(s):
    s = s.strip()
    return s.startswith("//") or s.startswith("*") or s.startswith("/*") or s.endswith("*/")


def is_wrapper_only(s):
    s = s.strip()
    if not s:
        return True
    # lines that are just describe(...)/test.describe(...) openers or braces
    if re.match(r"^(describe|test\.describe)\(", s):
        return True
    if s in ("{", "});", "})", "});", "() => {"):
        return True
    return False


for r in data:
    rel, line_no = r["file"], r["line"]
    lines = get_lines(rel)
    idx = line_no - 1  # 0-based index of the skip call line

    # -- broadened backward comment search: walk up through blank/wrapper
    # lines (max 8 hops) looking for a real comment line.
    found_comment_above = False
    hops = 0
    j = idx - 1
    while j >= 0 and hops < 8:
        s = lines[j].strip()
        if is_comment_line(s):
            found_comment_above = True
            break
        if is_wrapper_only(s):
            j -= 1
            hops += 1
            continue
        break  # hit real, non-comment code - stop
    r["has_comment_above_v4"] = found_comment_above or r["has_comment_above"]

    # -- forward: first non-blank line inside the callback body is a comment
    found_comment_inside = False
    for k in range(idx + 1, min(idx + 3, len(lines))):
        s = lines[k].strip()
        if not s:
            continue
        if is_comment_line(s):
            found_comment_inside = True
        break
    r["has_comment_inside_body"] = found_comment_inside

    # -- name-string self-explanation (for classic-unconditional entries,
    # 'name_text' holds the quoted first arg incl. quotes)
    name_text = r.get("name_text") or ""
    r["name_self_documents"] = bool(NAME_HINT_RE.search(name_text)) or bool(
        re.search(r"\[[a-z0-9_-]+\]|\([^)]*(requires|no longer|removed)[^)]*\)", name_text, re.IGNORECASE)
    )

    # -- reclassify bare test.skip() found inside an `if (...) {` a couple
    # lines above as an imperative conditional skip (A), not permanent (B).
    if r["subtype"] == "bare-no-args":
        near_if = False
        for k in range(max(0, idx - 3), idx):
            if re.search(r"\bif\s*\(", lines[k]):
                near_if = True
                break
        if near_if:
            r["reclassified_imperative_conditional"] = True
            r["category"] = "A"
            r["subtype"] = "imperative-if-guarded"
        else:
            r["reclassified_imperative_conditional"] = False

    r["justified_v4"] = (
        r["has_comment_above_v4"]
        or r["has_built_in_reason"]
        or r["has_comment_inside_body"]
        or r["name_self_documents"]
    )

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "skip_inventory_v4.json"), "w") as out:
    json.dump(data, out, indent=1)

# final tri-partition
finalcat = []
for r in data:
    if r["justified_v4"]:
        finalcat.append("C")
    elif r["category"] == "A":
        finalcat.append("A")
    else:
        finalcat.append("B")

from collections import Counter
c = Counter(finalcat)
print("FINAL A/B/C:", dict(c), "total=", sum(c.values()))

truly_forgotten = [r for r, f in zip(data, finalcat) if f == "B"]
print("truly forgotten count:", len(truly_forgotten))
for r in truly_forgotten:
    print(" -", r["file"] + ":" + str(r["line"]), r["subtype"])
