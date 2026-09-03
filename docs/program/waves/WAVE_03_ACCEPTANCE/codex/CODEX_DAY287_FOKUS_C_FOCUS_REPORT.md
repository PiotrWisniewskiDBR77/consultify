# CODEX — dyżur 287 — fokus `c-focus`

## Baza i sanity

```text
MARKER OK
35afcb15fd7a432ab83df04208eb2114f1aa44e9
```

`git status --short | head -3` nie zwrócił żadnego wiersza. Dysk przed startem: 36 GiB wolne. Porty 6291, 5252 i 5253 były wolne.

Tip `github-backup/grafika/m03-20260902` uciekł przed marker; zgodnie z DEC-2026-08-26-95 praca startuje dokładnie z markera, bez rebase. Pełny log i lista różnic zostały zmierzone przed zmianami.

## R1 — pomiar i wzorzec

- PRZED: 193 wystąpienia w 94 plikach.
- Baseline PRZED: 227 wystąpień w 112 plikach.
- Kanon istniejący w repo: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`.
- `VIOLATION_RE='ring-primary-|outline-primary-|ring-offset-primary-'` łapie `focus-visible:ring-primary-*` przez dopasowanie podciągu, ale nie łapie `crimson-*`. Naprawa przyrządu jest wymagana w R5.

## Korekty wobec instrukcji

Na markerze pomiar potwierdził tezę 193/94. Nowszy tip zawiera równoległe naprawy G14 i baseline, lecz nie został scalony, ponieważ instrukcja nakazuje start dokładnie z markera i zakazuje rebase.

## Stan kolejnych pozycji

R2–R6: w toku.
