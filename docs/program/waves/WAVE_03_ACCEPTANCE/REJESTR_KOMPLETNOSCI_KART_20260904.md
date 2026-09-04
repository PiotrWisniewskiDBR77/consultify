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

## R5 — archetyp REKORD z §13.1

Pomiar: 11 wierszy, 4 typy z kontraktem, 7 bez kontraktu.

| Artefakt | Kontrakt | Ekran w `src/` |
| --- | --- | --- |
| Initiative | tak — `initiativeCardContract.ts` | tak — `InitiativeDocumentView.tsx` |
| Task | tak — `taskCardContract.ts` | tak — `TaskDetailView.tsx` |
| Decision | tak — `decisionCardContract.ts` | tak — `DecisionDetailView.tsx` |
| KPI | nie | tak — `ResultsVNext/kpiTool/KpiToolPage.tsx` |
| Insight | tak — `insightCardContract.ts` | tak — `InsightViewer.tsx` |
| Idea | nie | tak — `MyWork/IdeaMapWorkspace.tsx` i powiązane widoki |
| RAID | nie | brak samodzielnego ekranu rekordu znalezionego po pełnym skanie nazw; istnieją API i powierzchnie osadzone |
| Milestone | nie | brak samodzielnego ekranu rekordu; istnieją powierzchnie osadzone i runtime execution |
| Change Request | nie | brak samodzielnego ekranu rekordu; istnieją typy i sekcje osadzone |
| Stage Gate | nie | brak samodzielnego ekranu rekordu; istnieją API, typy i sekcje osadzone |
| Action Proposal | nie | tak — `views/ActionProposalView.tsx` i `components/ai/ActionProposalDetail.tsx` |

## DO DECYZJI WŁAŚCICIELA — nazwy Menu 3 Initiative

| §13.1 | Produkt dzisiaj |
| --- | --- |
| Zadania · Definicja · Wdrożenie · Ekonomia · Governance · Zespół | Zakres i plan · Decyzje i ryzyko · Rezultaty · Ludzie · Zapisy |

Kadr obecnego stanu: `evidence/kompletnosc-kart-20260904/r3-pl-light-PARTIAL.png` (w lewym menu na wariancie `quick_win` widoczne są tylko trzy z pięciu grup: Zakres i plan, Rezultaty, Zapisy).

Czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie: brak decyzji właściciela, czy sześć nazw §13.1 jest docelową taksonomią, czy opisem semantycznym, który wolno mapować na pięć zaakceptowanych grup produktu.

## Dyżur 338 — R1: własny pomiar wejściowy

Rekord we wszystkich czterech przebiegach: `init-smed-linia-pakowania`. Każdy przebieg dostał świeży kontekst Playwrighta. Liczby pochodzą wyłącznie z uchwytów DOM, a stan `localStorage` zapisano w tym samym JSON-ie i w tej samej chwili co zliczenie.

| Szablon | Flaga zastanego kontraktu | Pozycji | Grup | `ff.cardContract` | Klucz kolejności sekcji | Dowód |
| --- | --- | ---: | ---: | --- | --- | --- |
| `quick_win` | OFF | 6 | 3 | `"0"` | `null` | `evidence/kompletnosc-24-sekcji-20260904/r1/r1-off-niepusty.json` |
| `quick_win` | ON | 6 | 3 | `"1"` | `null` | `evidence/kompletnosc-24-sekcji-20260904/r1/r1-on-niepusty.json` |
| brak | OFF | 24 | 5 | `"0"` | `null` | `evidence/kompletnosc-24-sekcji-20260904/r1/r1-off-pusty.json` |
| brak | ON | 24 | 5 | `"1"` | `null` | `evidence/kompletnosc-24-sekcji-20260904/r1/r1-on-pusty.json` |

Własna różnica zbiorów dla `quick_win` (po usunięciu dynamicznych liczników z tekstów DOM): Harmonogram; Zależności; Produkty i kamienie milowe; Decyzje; Ryzyko i RAID; Bramy; Sugerowane zmiany; Dziennik zmian; Zespół; RACI; Właściciele strumieni; Analiza finansowa; Wpływ finansowy; OKR; Hipoteza; Zasoby; Użyte w (powiązania); Wnioski i lekcje.

Rozbieżność wobec listy osiemnastu z instrukcji: **brak** — skład zbioru jest identyczny. Zrzuty `off-niepusty.png` i `on-niepusty.png` są bajtowo identyczne (`38781015…`), co potwierdza, że zastana flaga kontraktu nie usuwa sufitu narzuconego wcześniej przez szablon.

Granica dowodu: harness montuje produkcyjny `InitiativeDocumentView`, ale podstawia transport HTTP. Pomiar dowodzi zachowania DOM komponentu, nie ścieżki ApiGateway/JWT/PostgreSQL ani wdrożenia.
