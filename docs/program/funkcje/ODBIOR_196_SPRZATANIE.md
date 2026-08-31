---
doc_id: funkcje-odbior-196
status: canonical
truth_type: acceptance
established: 2026-08-31
---

# ODBIÓR 196 — sprzątanie zbiorcze · ODESŁANY (FIX-196 wydany), potem scalić

R2 (komentarz DEC-104 prawdziwy — łańcuch PATCH zweryfikowany niezależnie) i R3
(UsageMeters — kolizja z 176 to bajt-identyczna niezależna naprawa; merge czysty,
dedup testów przy scaleniu: zostaje wariant `*.smoke` 196) — **PASS**. Zakres
czysty, artefakty SHA-zgodne, jedyny FAIL vitest zastany.

## Dwie poprawki FIX-196
1. **R4 cicha luka:** `Accepted SHA`/`Evidence manifest` w kartach 01/15 zostały
   „—" mimo wartości tuż niżej (b5aa07a28f + evidence-m01; d5a1b6a99e) — dosłowny
   nakaz instrukcji pominięty bez ujawnienia. Dopisać.
2. **R1 dowód za słaby:** test = readFileSync+toContain (dwunasty kształt!).
   Dodać realny render-test 3 stanów podglądu (etykieta+framework / sama
   etykieta / relations=[]).
