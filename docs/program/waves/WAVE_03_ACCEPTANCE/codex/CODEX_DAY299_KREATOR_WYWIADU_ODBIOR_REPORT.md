# Dyżur 299 — odbiór kreatorów

Marker: `416432abafe31a390a909cf7e460a4bad7bef191` (`MARKER OK`)  
Gałąź: `codex/day299-kreator-wywiadu-odbior-20260903`  
Stan początkowy: czysty worktree.

## R1 — pomiar

- Rodzina `creator-shell|creatorShell`: 6 plików, zgodnie z tezą instrukcji.
- Powierzchnie produktowe: 2 — `InsightCreatorModal` (wejście w Interview) i `InitiativeWizardModal` (wejścia `InitiativesHub` / `UnifiedCreateLauncher`).
- Flaga jest domyślnie ON od `ba0da208a3`; inicjatywy importują i wywołują ten sam `isInterviewCreatorShellEnabled`.
- Część B listy `TRIADA_KANON.md`: 43 punkty.
- Bazowy test a11y: 12 przypadków, 8 PASS i 4 FAIL; wszystkie cztery padają na starym wzorcu `Insight Title *` / `Tytuł wniosków *`.
- Dostępna nazwa wyrenderowanego pola według realnego DOM z Testing Library wynika z powiązanego `label` i brzmi `Insight Title (required)` / `Tytuł wniosków (wymagane)`. Produkt zachowuje `htmlFor=insight-creator-title`, `id=insight-creator-title`, `required` i `aria-required=true`; czerwone są zestarzałe asercje.

Łańcuch harnessu montuje realny `InsightCreatorModal`, ale jego host nie jest produkcyjnym wejściem. Łańcuch produktu Interview i wejście Initiatives nie zostały uruchomione przed R2, dlatego nie stawiam twierdzeń o geometrii na podstawie samego harnessu.

Artefakty: `/private/tmp/cx-day299-kreator-wywiadu-artefakty/r1-static.txt`, `przed.json`, `przed-nazwy.txt`.

## Korekty wobec instrukcji

Tezy liczbowe zostały potwierdzone. Instrukcja nie zawiera zapowiadanej „tabeli licencji”. Jednocześnie Z12 nazywa `src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx` nietykalnym do zapisu, a R2 nakazuje naprawić cztery zestarzałe asercje właśnie w tym pliku. Bez imiennego wyjątku bezpieczniejsza interpretacja zabrania tej edycji.
