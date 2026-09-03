# Rejestr fokusu `c-focus` — dyżur 287

Marker: `35afcb15fd`

Kanon: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus`. Zachowujemy istniejącą szerokość pierścienia, lecz wariant `focus:` zmieniamy na `focus-visible:` i kolor `primary-*` / `crimson-*` na `c-focus`.

Stan PRZED: **193 wystąpienia w 94 plikach** według wiążącego pomiaru:

```bash
git grep -nE 'focus(-visible)?:(ring|outline)-(primary|crimson)|ring-offset-primary' -- src
```

Tabela plikowa zostanie uzupełniona po mechanicznej zmianie o kolumny PRZED, PO i commit.

Stan bezpiecznika PRZED: `check-focus-canon --ci: OK`, baseline 112 plików / 227 wystąpień. `VIOLATION_RE='ring-primary-|outline-primary-|ring-offset-primary-'` obejmuje warianty Tailwind przez dopasowanie podciągu, w tym `focus-visible`, ale nie obejmuje `crimson-*`.
