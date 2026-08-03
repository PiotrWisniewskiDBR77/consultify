# Docelowa struktura i migracja standardów UI/UX

> Status: obowiązujący plan organizacji. Migracja nie nadaje automatycznie statusu `CANONICAL`.

## Warstwy

| Warstwa | Odpowiedzialność | Czego nie przechowuje |
|---|---|---|
| `CANON.md` | autorytet, governance, hierarchia | szczegółów pojedynczego komponentu |
| `00-foundation/` | tokeny i fundament wizualny | anatomii modułu |
| `01-shell-layout/` | kompozycja całych powierzchni | lokalnych wyjątków |
| `02-components/families/` | jedna karta na rodzinę komponentu | powtórzeń zasad fundamentu |
| `03-modules/` | wzorce złożenia ekranów | lokalnego komponentu modułu |
| `docs/modules/*/04_UI_UX.md` | użycie wzorców w funkcjach | ustanawiania nowego wyglądu |
| `artifacts/visual-qa/` | materiał audytowy | prawa i wzorców bez odbioru |
| `_archive/` | historia | aktywnych reguł |

## Reguła screenshotów

Screenshot ma domyślnie status `AUDIT_EVIDENCE`. `REFERENCE_READY` otrzymuje dopiero po jawnej kontroli względem karty komponentu. Obecnie referencyjne są wyłącznie zatwierdzone przepływy **Zadania** i **Decyzje**. Pozostałe obrazy My Work służą wykrywaniu problemów.

## Mapa migracji treści

| Źródło | Treść zachowywana | Cel | Status |
|---|---|---|---|
| Golden Standard | shell, kontrolki, table, preview, N-mode | pierwsze 5 kart + kolejne rodziny | rozpoczęta |
| Operating Standard | governance, audyt, DoD | `CANON.md`, standard implementacyjny | migrowane; źródło nieautorytatywne |
| TRIADA | zachowanie list, table, preview, kanban | UI-HUB/TABLE/PREVIEW/ACTION | wiążące źródło szczegółowe |
| FROZEN_LAYOUTS | kolejność i zamrożone regiony | UI-SHELL/HUB | wiążące |
| component registry | 26 rodzin i stan adopcji | `families/*/STANDARD.md` | katalog utworzony |
| screenshoty My Work | błędy i pokrycie stanów | przyszły issue register | audit evidence |

## Zasada migracji

Treści nie kopiujemy bez oceny. Każda reguła trafia do dokładnie jednego domu, dostaje właściciela, binding do kodu i test akceptacyjny. Stary dokument pozostaje materiałem migracyjnym do chwili opróżnienia, a następnie trafia do `_archive/`.

## Bramki statusu `CANONICAL`

Pełna karta, jedno API, implementacja referencyjna, konsumenci, stany, light/dark, keyboard/a11y, testy, evidence po odbiorze oraz plan usunięcia duplikatów. Brak któregokolwiek elementu oznacza maksymalnie `APPROVED_SPEC` lub `IMPLEMENTED`.

