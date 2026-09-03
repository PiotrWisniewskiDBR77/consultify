# Dynamic SWOT — siedem etapów (2026-09-03)

Stan: prototyp fali 2, jedna flaga domyślnie OFF; bez rozszerzenia na pozostałe paczki.

## R1. Pomiar i mapowanie

| Etap kanonu | Dzisiejsza faza | Dzisiejsza brama | Czego brak |
|---|---|---|---|
| Mission & Context | `mission` | `swot-mission-decision` | — |
| Input & Exploration | `input` | `swot-input-evidence` | — |
| Method Build | `swot` | `swot-build-classification` | — |
| Synthesis & Insights | `insights` | `swot-insight-pairing` | — |
| Recommendations | brak | brak | osobna historia rekomendacyjna i jawna akceptacja konsultanta |
| Results & Readiness | `outputs` (dzisiejsza semantyka wymaga późniejszego uproszczenia) | `swot-output-tradeoff` | nazwa i ocena gotowości nie są dziś zgodne z pełnym §6.16 |
| Review | brak | brak | zatwierdzenie albo zwrot z komentarzem przez uprawnioną osobę |

Pomiar: `dynamicSwot.pack.ts` ma 301 linii, pięć faz i pięć pytań-bram. Jest 19 spisanych paczek, ale pomiar faz obala tezę „wszystkie poza jedną po pięć”: 14 ma pięć, jedna osiem, a cztery mają cztery fazy. Wszystkie pięć modułów `src/config/swot/` ma konsumentów poza własnym katalogiem: `conclusionPrompts` 37, `dynamicSwotQuestionBank` 19, `swotAcceptGate` 5, `swotInsightStaircase` 9, `swotTensionEngine` 12. Nie ma „biblioteki bez wywołania”.

## R2. Rozstrzygnięcie źródeł

§6.15 mówi: „bezpośrednio po `Synthesis & Insights`, należy dodać osobną pozycję `Recommendations`”. §6.16 nazywa `Results & Readiness` „ostatnim etapem”, ale §6.B tego samego kontraktu zapisuje pełny kręgosłup kończący się `… Results & Readiness → Review` i definiuje Review jako zatwierdzenie albo zwrot z komentarzem.

Bezpieczne rozstrzygnięcie: w modelu paczki brakuje `Recommendations` i `Review`; obecne `outputs` pozostaje kompatybilnym nośnikiem `Results & Readiness`, choć jego treść wymaga osobnej późniejszej korekty. Sformułowanie „ostatni etap” w §6.16 jest sprzeczne z późniejszym, kompletnym §6.B; nie używam go do usunięcia Review. Pytanie do właściciela: czy „ostatni” w §6.16 oznacza ostatni etap pracy konsultanta przed formalnym Review?

## Skutek dla pozostałych 18 paczek

Nie są zmieniane. Przy identycznym modelu każda wymaga osobnej mapy semantycznej, dwóch bram i testu wznawialności. Dolne oszacowanie kodowe to 18 × 2 = 36 nowych deskryptorów faz i 36 bram, plus testy i dowód wizualny per paczka. To oszacowanie strukturalne, nie wycena czasu.

