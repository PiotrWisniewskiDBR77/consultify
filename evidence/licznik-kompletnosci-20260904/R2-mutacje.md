# Dyżur 351 — R2: jedna definicja per drzewo i mutacje

## GREEN

Komenda:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/report tests/unit/assessment --retry=0 --reporter=json --outputFile=/private/tmp/cx-day351-licznik-kompletnosci-artefakty/r2-front-po.json
```

Własny wynik z JSON: 130 suit, 609 testów, 609 passed, 0 failed. Pakiet obejmuje nietknięte testy dyżuru 346. Przed dodaniem kontraktu dyżuru 351 ten sam wybór miał 602 pełne nazwy; dodano dokładnie 7 nazw z `day351.assessmentCompleteness.test.ts`, nie zniknęła żadna.

## Wartości z miejsc R2

| Miejsce | 7/39 albo target-only | pełna sesja |
| --- | ---: | ---: |
| adapter serwer, obszary | 18% | 100% |
| adapter front, obszary | 18% | 100% |
| adapter serwer, osie | 0% dla samych celów | 100% przy odpowiedzi na każdej osi |
| adapter front, osie | 0% dla samych celów | 100% przy odpowiedzi na każdej osi |
| SIRIForm `progress.completed` | wspólna definicja; cel pomijany | odpowiedź liczona |
| DRDForm `progress.completedAxes` | wspólna definicja; cel pomijany | odpowiedź liczona |

## Mutacje per miejsce

Każdą mutację wykonano osobno; po niej uruchomiono tylko odpowiadającą pełną nazwę testu z `--retry=0`. Stan produktu przywracano przez `cp` z `/private/tmp/cx-day351-licznik-kompletnosci-scratch`; `diff -u KOPIA PLIK` po każdym przywróceniu zwrócił exit 0.

| Mutacja | Wynik RED |
| --- | --- |
| serwerowy adapter obszarów: przywrócono `actual > 0 || target > 0` | RED: otrzymano `[100,100]`, oczekiwano `[18,100]`; exit 1 |
| serwerowy adapter osi: przywrócono `current > 0 || target > 0` | RED: otrzymano 100, oczekiwano 0; exit 1 |
| frontowy adapter obszarów: przywrócono `actual > 0 || target > 0` | RED: otrzymano `[100,100]`, oczekiwano `[18,100]`; exit 1 |
| frontowy adapter osi: przywrócono `current > 0 || target > 0` | RED: otrzymano 100, oczekiwano 0; exit 1 |
| SIRIForm: przywrócono lokalny filtr `current > 0 || target > 0` | RED: kontrakt wspólnej definicji nie znalazł wywołania; exit 1 |
| DRDForm: przywrócono lokalny warunek `actual > 0 || target > 0` | RED: kontrakt wspólnej definicji nie znalazł wywołania; exit 1 |
| parytet: tylko frontowej definicji dodano `target > 0` | RED: tablice wyników serwer/front różne; exit 1 |

Po wszystkich przywróceniach pełny pakiet ponownie GREEN. Modele raportu dyżuru 346 używają teraz tej samej definicji z identycznym zachowaniem; ich istniejących asercji nie zmieniono.

## Pułapki §0.2e

Pakiet jest czysto jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true`), więc pułapki tras (a), (b), (c), (d) nie stanowią jego dowodu. Pułapka (e)(1) jest wyłączona kontraktem parytetu obu definicji; (e)(2) potwierdzono osobnym grepem `viz.`; (e)(5) nie wymaga podłączania komponentów, bo SIRI/DRD są bronione kontraktem kodu, a adaptery testem funkcji.
