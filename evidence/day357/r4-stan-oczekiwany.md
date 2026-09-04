# Dyżur 357 — R4: „Stan oczekiwany — nie zgłaszaj”

## Karty Inicjatyw

Pomiar źródła potwierdza tezę instrukcji:

- klucz query: `ff_initiative_sections_complete` — `src/utils/initiativeSectionsCompleteFlag.ts:1`;
- komentarz kontraktu: fail-closed OFF — `src/utils/initiativeSectionsCompleteFlag.ts:13`;
- SSR zwraca `false` — `src/utils/initiativeSectionsCompleteFlag.ts:15`;
- końcowy default po query/localStorage/env zwraca `false` — `src/utils/initiativeSectionsCompleteFlag.ts:39`.

Do pakietu dopisano, że 6/24 jest stanem po naprawie, która pozostaje ukryta za flagą domyślnie OFF, a nie nowym uszkodzeniem.

## Audyt pozostałych pozycji listy

| Pozycja | Ma numer decyzji lub SHA? | Kotwica |
| --- | --- | --- |
| Karta inicjatywy 6/24 | TAK | `DEC-387`, `DEC-388`, `500ae7d68c`, `e25eb19b64`; dodatkowo `initiativeSectionsCompleteFlag.ts:1,13-15,39`. |
| SWOT może nadal mieć pięć etapów | TAK | `DEC-2026-09-03-383`, `937f2d3193`. |
| Nowe warianty kart Decyzji niewidoczne | TAK | `e25eb19b64`. |
| Pozycje wyjęte i pozostawione w fali 2 | TAK | Każda wymieniona pozycja ma numer `DEC-*`; dwa elementy scalone mają także `660482d485` i `15309dd3a6`. |

Wniosek: żadna pozycja listy nie jest pozbawiona numeru decyzji i SHA jednocześnie.
