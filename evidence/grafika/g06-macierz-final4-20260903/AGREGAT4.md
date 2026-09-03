# Pomiar #4 (uzupełniający) — 30 ekranów ze ślepą plamą nr 3, marker `cfb21c0959`, 2026-09-03 19:44–19:56Z

Przyczyna: przycisk „Szukaj” w `ModuleNavBar` podmienia rząd Menu 3; pętla rozwijania sekcji klikała go i chipy/taby znikały przed skanem axe (pomiar #3 nie widział tego rzędu na 30/248 ekranach). Wariant A = 27 ekranów odzyskanych flagą `--cofnij-jesli-skraca=1` (+ `--rozwin-sekcje=1 --klik-po-rozwinieciu=1 --osiad-po-rozwinieciu=1500 --a11y=1`). Wariant B = 3 ekrany (canvas/Escape) BEZ rozwijania (`--a11y=1`). Każdy ekran 8 kadrów (pl/en × light/dark × 1440/1024).

| Moduł | Ekrany | Kadry | Kadry z realnym a11y | Reguły | Realny błąd konsoli | Konsola pochodna braku backendu | Wynik |
| --- | ---: | ---: | ---: | --- | ---: | ---: | --- |
| 01_ORGANIZATION | 1 | 8 | 0 | — | 0 | 8 | **ZERO** |
| 02_INTERVIEW | 2 | 16 | 0 | — | 0 | 72 | **ZERO** |
| 03_TOOLS | 1 | 8 | 0 | — | 0 | 0 | **ZERO** |
| 04_ASSESSMENT | 7 | 56 | 0 | — | 0 | 200 | **ZERO** |
| 06_EXECUTION | 3 | 24 | 0 | — | 0 | 768 | **ZERO** |
| 07_MY_WORK_AGENT | 1 | 8 | 0 | — | 0 | 0 | **ZERO** |
| 08_MEETINGS | 1 | 8 | 0 | — | 0 | 24 | **ZERO** |
| 09_RESULTS | 7 | 56 | 0 | — | 0 | 0 | **ZERO** |
| 10_FINANCE | 1 | 8 | 0 | — | 0 | 56 | **ZERO** |
| 12_AUDITS | 1 | 8 | 0 | — | 0 | 24 | **ZERO** |
| 13_CHAT | 3 | 24 | 4 | color-contrast | 0 | 0 | **DŁUG** |
| 14_ADMIN | 2 | 16 | 0 | — | 0 | 0 | **ZERO** |
