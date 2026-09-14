GET /api/initiatives  ->  n=3 :: Aktualna A[archived=False], Aktualna B[archived=False], Zamknieta bez archiwum[archived=False]
GET /api/initiatives?includeArchived=true  ->  n=5 :: Aktualna A[archived=False], Aktualna B[archived=False], Zamknieta bez archiwum[archived=False], Archiwalna X[archived=True], Archiwalna Y[archived=True]
GET /api/initiatives?archived=true  ->  n=2 :: Archiwalna X[archived=True], Archiwalna Y[archived=True]
GET /api/initiatives?archived=false  ->  n=3 :: Aktualna A[archived=False], Aktualna B[archived=False], Zamknieta bez archiwum[archived=False]

--- kontekst pomiaru (2026-09-14) ---
Baza: lokalny Postgres (docker af-pg, 127.0.0.1:6492/af), strict migrate na PUSTEJ bazie.
Dane: 5 inicjatyw w jednej organizacji — 3 z archived=false (w tym jedna CLOSED,
ale NIE zarchiwizowana) i 2 z archived=true.

STAN PRZED NAPRAWA (premisa potwierdzona): getInitiatives nie mial ANI JEDNEGO
warunku o archiwum — wygenerowany SQL konczyl sie na
  WHERE i.organization_id = ? ORDER BY i.created_at DESC
(zrzut SQL z testu RED: server/src/controllers/__tests__/InitiativeController.archivedFilter.test.ts).
Czyli GET /api/initiatives zwracalo n=5 — tyle samo, co dzis ?includeArchived=true.

STAN PO NAPRAWIE — cztery wywolania wyzej: 3 / 5 / 2 / 3.
