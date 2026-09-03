# Rejestr fokusu `c-focus` — dyżur 287

Marker: `35afcb15fd`

Kanon: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`. Zachowujemy istniejącą szerokość pierścienia, lecz wariant `focus:` zmieniamy na `focus-visible:` i kolor `primary-*` / `crimson-*` na `c-focus`.

Stan PRZED: **193 wystąpienia w 94 plikach** według wiążącego pomiaru:

```bash
git grep -nE 'focus(-visible)?:(ring|outline)-(primary|crimson)|ring-offset-primary' -- src
```

Mechaniczny diff roboczy: **193 → 0** w **94 → 0** plikach. Legalnie zacommitowany podzbiór usuwa 110 wystąpień z 59 plików; na HEAD pozostaje **83 wystąpienia w 35 plikach**. Pozostały gotowy diff 35 plików jest niezacommitowany, ponieważ `check-triada` blokuje linie zawierające zastane `text-primary-*`, `border-primary-*`, `bg-primary-*` albo `focus:border-primary-*`, których Z40 zabrania zmieniać.

| Zakres | PRZED | PO w HEAD | PO w worktree | Commit |
| --- | ---: | ---: | ---: | --- |
| cała aplikacja `src/` | 193 / 94 pliki | 83 / 35 plików | 0 / 0 plików | `b91e835511`, baseline `b6542f5238` |

Stan bezpiecznika PRZED: `check-focus-canon --ci: OK`, baseline 112 plików / 227 wystąpień. `VIOLATION_RE='ring-primary-|outline-primary-|ring-offset-primary-'` obejmował warianty Tailwind przez dopasowanie podciągu, ale nie `crimson-*`. Po naprawie wzorzec jest ograniczony do wariantów fokusu i obejmuje `primary|crimson`; baseline zacommitowanego HEAD to 83/35. Na pełnym diffie roboczym pomiar i test dają 0/0.
