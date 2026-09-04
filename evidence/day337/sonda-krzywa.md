# R1 — krzywa czasowa sondy

Ekran: `idea-table-timeline-stuck`, `lang=pl`, `theme=light`, viewport 1440×900.

| Czas po `domcontentloaded` | Widoczne kontrolki |
| ---: | ---: |
| 200 ms | 1 |
| 400 ms | 1 |
| 800 ms | 86 |
| 1500 ms | 86 |
| 3000 ms | 86 |
| 5000 ms | 86 |
| 8000 ms | 86 |
| 12000 ms | 86 |
| 20000 ms | 86 |

Pierwszy zimny przebieg mierzony od `waitUntil: commit` nie nadawał się do interpretacji czasowej: kompilacja Vite zajęła około 7,5 s i próbki były spóźnione. Wynik ten odrzucono jako błąd procedury pomiarowej, nie wynik produktu.

Wniosek: próg może zwolnić na jednokontrolkowej powłoce. Warunek końcowy wymaga pięciu identycznych próbek co 200 ms, progu kontraktu oraz jawnego odrzucenia znanej powłoki `count <= 1`.
