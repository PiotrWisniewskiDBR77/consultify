# Rejestr kompletności kart — 2026-09-04

Pomiar dyżuru 324. Liczby sekcji pochodzą wyłącznie z uchwytów DOM w `NModeLeftNav`; kadry są dowodem stanu ekranu, nie źródłem liczby.

| Typ karty / wariant | Pozycji w katalogu | Pozycji renderowanych OFF | Pozycji renderowanych ON | Uchwyt DOM | Kadr | Commit |
| --- | ---: | ---: | ---: | --- | --- | --- |
| Initiative — niepusty szablon `quick_win`, rekord `init-smed-linia-pakowania` | 24 | 6 | 6 | `[data-nmode-section-item]`, grupy: `[data-nmode-section-group]` = 3/3 | `evidence/kompletnosc-kart-20260904/r1-{off,on}-niepusty.png` | uzupełniony w commicie R1 |
| Initiative — pusty/brak szablonu, rekord `init-smed-linia-pakowania` | 24 | 24 | 24 | `[data-nmode-section-item]`, grupy: `[data-nmode-section-group]` = 5/5 | `evidence/kompletnosc-kart-20260904/r1-{off,on}-pusty.png` | uzupełniony w commicie R1 |
| Task | 10 | 8 | 8 | deklaracja `taskNSections` + kontrakt; pomiar DOM z dyżuru 314 niepowtórzony w R4 | — | uzupełniony w commicie R4 |
| Insight | 30 w deskryptorze; 32 w `INSIGHT_SECTIONS` | 32 | 32 | deklaracja `INSIGHT_SECTIONS` + kontrakt; pomiar DOM z dyżuru 314 niepowtórzony w R4 | — | uzupełniony w commicie R4 |

Stan przeglądarki: każdy przebieg uruchomiono w nowym kontekście Playwrighta. Przed wejściem nie istniał `ff.cardContract` ani klucz układu `initiative:*:v2-contract:*`; OFF nie przekazywał parametru, ON przekazywał wyłącznie `?cardContract=1` i ustawiał wspólny klucz w świeżym kontekście.

Granica dowodu R1: `dev-render/screens/karta-initiative.tsx` montuje produkcyjny `InitiativeDocumentView` na identyfikatorze bez prefiksu showcase, ale podstawia transport HTTP. Wynik dowodzi kolejności filtrów i sufitu DOM komponentu; nie dowodzi ścieżki ApiGateway/JWT/PostgreSQL.

## R4 — rozliczenie Task i Insight

- Task: katalog ma 10 nazw. Render `taskNSections` ma 8: `description-scope`, `implementation`, `risk-alternatives`, `checklist`, `dependencies`, `evidence`, `governance`, `attachments-links`. Brakujące imiennie: `comments` i `activity-log`. Nie znaleziono decyzji właściciela sankcjonującej brak, więc werdykt: dług. Gotowy, nienałożony kierunek diffu: dołożyć oba wpisy do `taskNSections` i ich komponenty treści, po osobnym ustaleniu źródeł danych oraz dowodzie mutacyjnym.
- Insight: teza „30 w katalogu, 22 renderowane” jest nieaktualna na markerze. `INSIGHT_CARDS` ma 30, `INSIGHT_SECTIONS` ma 32. Komentarze kontraktu wskazują dwa świadome extras po deduplikacji Fazy 0: `recommendations` i `executive-memo`; nadal są renderowane, ale celowo nie należą do 30-pozycyjnego katalogu. Nie ma więc ośmiu nazw do rozliczenia jako brak renderu.
