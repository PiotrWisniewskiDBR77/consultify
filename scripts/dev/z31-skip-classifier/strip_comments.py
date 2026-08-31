"""JS/TS-aware comment stripper that preserves line numbers and string
contents (so regex on the result still finds real code, not comments)."""

def strip_comments(text: str) -> str:
    out = []
    i = 0
    n = len(text)
    in_str = None  # one of ' " `
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
            # line comment - blank out until newline
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
            segment = text[i:j]
            out.append("".join(c if c == "\n" else " " for c in segment))
            i = j
            continue
        out.append(ch)
        i += 1
    return "".join(out)
