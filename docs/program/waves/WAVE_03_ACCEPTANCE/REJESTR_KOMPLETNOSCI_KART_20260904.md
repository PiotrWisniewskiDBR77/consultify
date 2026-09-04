# Rejestr kompletności kart — 2026-09-04

Pomiar dyżuru 324. Liczby sekcji pochodzą wyłącznie z uchwytów DOM w `NModeLeftNav`; kadry są dowodem stanu ekranu, nie źródłem liczby.

| Typ karty / wariant | Pozycji w katalogu | Pozycji renderowanych OFF | Pozycji renderowanych ON | Uchwyt DOM | Kadr | Commit |
| --- | ---: | ---: | ---: | --- | --- | --- |
| Initiative — niepusty szablon `quick_win`, rekord `init-smed-linia-pakowania` | 24 | 6 | 6 | `[data-nmode-section-item]`, grupy: `[data-nmode-section-group]` = 3/3 | `evidence/kompletnosc-kart-20260904/r1-{off,on}-niepusty.png` | uzupełniony w commicie R1 |
| Initiative — pusty/brak szablonu, rekord `init-smed-linia-pakowania` | 24 | 24 | 24 | `[data-nmode-section-item]`, grupy: `[data-nmode-section-group]` = 5/5 | `evidence/kompletnosc-kart-20260904/r1-{off,on}-pusty.png` | uzupełniony w commicie R1 |

Stan przeglądarki: każdy przebieg uruchomiono w nowym kontekście Playwrighta. Przed wejściem nie istniał `ff.cardContract` ani klucz układu `initiative:*:v2-contract:*`; OFF nie przekazywał parametru, ON przekazywał wyłącznie `?cardContract=1` i ustawiał wspólny klucz w świeżym kontekście.

Granica dowodu R1: `dev-render/screens/karta-initiative.tsx` montuje produkcyjny `InitiativeDocumentView` na identyfikatorze bez prefiksu showcase, ale podstawia transport HTTP. Wynik dowodzi kolejności filtrów i sufitu DOM komponentu; nie dowodzi ścieżki ApiGateway/JWT/PostgreSQL.
