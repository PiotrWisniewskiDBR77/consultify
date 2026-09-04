# Dyżur 335 — imienny otwarty dług G19

Pełny imienny mianownik bieżącego dryfu znajduje się w `evidence/g19/day335-dryf.md`: 104 pliki wymienione jeden po drugim w sekcjach kategorii. Do czasu przypisania każdemu z nich dowodu wizualnego albo serwerowego wszystkie te nazwy pozostają otwartym długiem G19, z następującymi jawnie zmierzonymi wyjątkami częściowego pokrycia:

- `server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts` oraz chroniona ścieżka `server/src/controllers/TaskController.ts`: para workload i filtr organizacji mają bieżący dowód GREEN→RED→GREEN;
- `server/src/routes/__tests__/day277-decyzje-zapis.pg.test.ts`: poprawiony payload ma dowód 2/2 GREEN i mutację brakującego `escalation` dającą 2/2 RED;
- sześć plików testowych Bloku 2 ma 218/218 jednostkowych przypadków, ale nie stanowi dowodu RealPG;
- 18 plików Bloku 1 wykonało 131 przypadków, lecz cztery przypadki pozostają czerwone.

Nie uznaję powyższych wyjątków za zamknięcie całych plików produkcyjnych ani całej bramki. W szczególności wszystkie 77 zmienionych, nietestowych plików `server/src/routes/**`, dwa słowniki oraz 10 plików UI pozostają imiennie wymienione w `day335-dryf.md` jako dług wymagający przypisania dowodu. Samo istnienie zielonego pakietu nie mapuje automatycznie testu do każdego pliku.

Granica: lista jest konserwatywna i może zawierać pliki z dowodem historycznym, którego nie udało się jeszcze przypiąć do bieżącego HEAD. Nie usuwa się ich z długu na podstawie nazwy lub grepu.
