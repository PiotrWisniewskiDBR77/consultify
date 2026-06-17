import re, json, sys

FP = "/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/src/components/Initiatives/sections/TimelinePlanner.tsx"
src = open(FP, encoding="utf-8").read()

NS = "initiatives.timelinePlanner."

# ---- camelKey generation -------------------------------------------------
import unicodedata
STOP = set()
def slug(en):
    # strip diacritics
    s = unicodedata.normalize('NFKD', en).encode('ascii','ignore').decode('ascii')
    # keep letters/digits/spaces
    s = re.sub(r"[^A-Za-z0-9 ]+", " ", s)
    words = [w for w in s.split() if w]
    words = words[:5]
    if not words:
        return "text"
    out = words[0].lower()
    for w in words[1:]:
        out += w[:1].upper() + w[1:].lower()
    return out

keys = {}            # key -> {pl,en}
pair_to_key = {}     # (pl,en) -> key

def keyfor(pl, en):
    if (pl,en) in pair_to_key:
        return pair_to_key[(pl,en)]
    base = slug(en)
    k = base
    i = 2
    while k in keys and (keys[k]["pl"], keys[k]["en"]) != (pl,en):
        k = base + str(i); i += 1
    keys[k] = {"pl": pl, "en": en}
    pair_to_key[(pl,en)] = k
    return k

# ---- ternary matcher -----------------------------------------------------
# Match isPolish ? <A> : <B> where A and B are string literals (single quotes,
# possibly with template literals). Allow optional newlines/whitespace around ? and :
# A literal: '...'  or `...`
STR = r"(?:'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)"
TERN = re.compile(r"isPolish\s*\?\s*(" + STR + r")\s*:\s*(" + STR + r")")

def unquote(lit):
    # returns (text, is_template)
    q = lit[0]
    inner = lit[1:-1]
    if q == "'":
        inner = inner.replace("\\'", "'").replace('\\\\','\\')
    return inner, q == '`'

# template var extraction: convert `Foo ${x}` -> ("Foo {{x}}", {"x": "x-expr"})
def tpl_to_icu(inner):
    parts = []
    args = {}
    def repl(m):
        expr = m.group(1).strip()
        # derive a name
        name = re.sub(r'[^A-Za-z0-9]', '', expr.split('.')[-1].split('(')[0]) or "v"
        args[name] = expr
        return "{{" + name + "}}"
    icu = re.sub(r"\$\{([^}]*)\}", repl, inner)
    return icu, args

skipped = []
ncount = 0

LOCALE_CODES = {"pl","en","pl-PL","en-US","en-GB","pl_PL","en_US"}

def replace(m):
    global ncount
    a, b = m.group(1), m.group(2)
    pl, pl_tpl = unquote(a)
    en, en_tpl = unquote(b)
    # SKIP locale-code ternaries (passed to formatters / Date locales)
    if pl in LOCALE_CODES and en in LOCALE_CODES:
        skipped.append((pl,en))
        return m.group(0)
    # both template w/ interpolation
    if pl_tpl or en_tpl:
        plicu, plargs = tpl_to_icu(pl)
        enicu, enargs = tpl_to_icu(en)
        # use union of arg names from EN (preferred), fallback PL
        argmap = {}
        argmap.update(plargs); argmap.update(enargs)
        if not argmap:
            # template without interpolation -> treat as plain
            if plicu == enicu:
                ncount += 1
                return repr_str(plicu)
            k = keyfor(plicu, enicu)
            ncount += 1
            return f"t('{NS}{k}')"
        k = keyfor(plicu, enicu)
        ncount += 1
        opts = ", ".join(f"{n}: {e}" for n,e in argmap.items())
        return f"t('{NS}{k}', {{ {opts} }})"
    # plain strings
    if pl == en:
        ncount += 1
        return repr_str(pl)
    k = keyfor(pl, en)
    ncount += 1
    return f"t('{NS}{k}')"

def repr_str(s):
    # produce a single-quoted JS string
    return "'" + s.replace("\\","\\\\").replace("'","\\'") + "'"

new = TERN.sub(replace, src)

open(FP,"w",encoding="utf-8").write(new)

# write keys file (without leading 'initiatives.' prefix, WITH sub-namespace)
out = {}
for k,v in keys.items():
    out["timelinePlanner."+k] = v
KEYS_FP = "/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/scripts/i18n-sweep/keys_agentA.json"
json.dump(out, open(KEYS_FP,"w",encoding="utf-8"), ensure_ascii=False, indent=2)

print("replacements:", ncount)
print("unique keys:", len(keys))
