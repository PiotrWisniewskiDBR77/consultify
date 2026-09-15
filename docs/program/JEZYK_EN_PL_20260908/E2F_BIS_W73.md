# E2f-bis — uczciwy mianownik języka (Wpis 73)

Zakres: wyłącznie przyrząd i dokumentacja. Kod interfejsu produktu nie został
zmieniony. Dwa commity WIP CTO zostały przeniesione z `a523058b47` na dokładną
bazę `f2628a0d36`; `git range-diff` wykazał dwa commity bez zmiany treści.

## Co mierzy nowy przyrząd

- `wykryjAngielski`: 490 mocnych i 142 słabe słowa UI, sygnały sufiksowe oraz
  Title Case. Dwuznaczne zapożyczenia (`company`, `status`, `lead`, `backlog`,
  `role`, `most`, `stale`) nie są samodzielnym dowodem języka.
- `K4obj`/`K4objPL`: literały w `label`, `title`, `placeholder`, `header`,
  `description`, `tooltip` i `emptyText` oraz zgodnych ujściach. Identyfikatory,
  wartości techniczne, ścieżki i SCREAMING_CASE są pomijane.
- `K8spl`: obejmuje `services/assessment` i `services/actionCard`; nadal pomija
  testy.
- `K11`: wykrywa pojedynczy, podwójny i szablonowy literał zawierający `{t(`.

Jednoliterowe tokeny nie są dowodem języka. Usuwa to fałszywe rozpoznanie
angielskiego `I` oraz skrótów `W`/`Z` jako polskich. `SA` także nie stanowi
samodzielnego dowodu PL. Dzięki temu `compileDrdPack('en')` zachowuje
`K10dPL=0`; wcześniejsza wersja WIP fałszywie zwracała 27.

## Próba precyzji 30/30

Test `pomiar-jezyka.e2f-bis.test.mjs` zawiera 30 angielskich etykiet z rodzin
Execution, Settings i Initiatives oraz 30 oczekiwanych pominięć: nazw własnych,
dwuznacznych pojedynczych słów i polskich napisów z angielskimi zapożyczeniami.

| Próba | Poprawny wynik | Wynik |
|---|---:|---:|
| angielskie etykiety | 30/30 | 100% trafień w próbce |
| bezpieczne pominięcia | 30/30 | 100% poprawnych pominięć w próbce |

To jest próba regresyjna, nie estymata kompletności całego repozytorium.

## Zmiana mianownika: stary detektor → E2f-bis

Stary stan pochodzi z baseline linii. Nowy stan to pełny skan tego samego drzewa
produktu po zmianie detektora. Wzrost oznacza ujawniony dług, a nie regresję UI.

| Kategoria | Stary | E2f-bis |
|---|---:|---:|
| K1 | 2 | 5 |
| K1def | 1 | 75 |
| K2 | 4 | 136 |
| K4pl | 22 | 81 |
| K4en | 869 | 5516 |
| K4objPL | niemierzone | 866 |
| K4obj | niemierzone | 5375 |
| K5pl | 256 | 262 |
| K5en | 1822 | 7161 |
| K8spl | 91 | 95 |
| K8sen | 825 | 3183 |
| K9pPL | 33 | 36 |
| K9pMIX | 0 | 1 |
| K9pBRAK | 77 | 77 |
| K10dPL | 0 | 0 |
| K10dROZ | 2 | 2 |
| K11 | niemierzone | 1 |

Pełny wynik per moduł i przykłady stanowią nowy ratchet w `baseline.json`.
