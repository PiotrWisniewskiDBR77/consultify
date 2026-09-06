# P12 — nowe decyzje właściciela

| Pytanie | Rekomendacja CTO | Co się stanie po „Tak” |
|---|---|---|
| Czy wymóg „migracja ostatnia” oznacza ostatnią migrację datowaną, skoro `migrationOrdering` jawnie uruchamia po fazie datowanej jeszcze fazy late i unordered? | Tak — zachować zadaną nazwę `20262103_…` i mierzyć ostatnią pozycję w fazie datowanej. | Nazwa pozostaje zgodna z DEC-424; raport nie będzie fałszywie twierdził, że plik jest ostatni globalnie. |
