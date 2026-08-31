---
doc_id: funkcje-odbior-196
status: canonical
truth_type: acceptance
established: 2026-08-31
---

# ODBIÓR 196 — sprzątanie zbiorcze · SCALONO PO FIX-196

★ FIX-196 (`bae4298901`): pola werdyktu kart 01/15 wypełnione (SHA/manifest z
CLOSED_FINAL; Settings bez manifestu — CLOSED_FINAL nie podaje ścieżki, uczciwie
zostawione); grep-test zastąpiony realnym render-testem DOM 3 stanów przez
StandardPreview (mutacja: surowy sourceType → 2/3 czerwone). 46/46 zielonych.

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
