# R2 — izolacja

- `day277-decyzje-zapis.pg.test.ts` uruchomiony samodzielnie pięć razy na świeżej bazie: 2/2 GREEN w każdym przebiegu.
- Pełny Blok 3 na świeżej bazie z `--no-file-parallelism`: 18/18 GREEN w każdym z 10 przebiegów.
- Pozostałych pięciu plików nie uruchamiano po 10 razy osobno, ponieważ R2.1 ujawnił konkretną przyczynę z `plik:linia`; zgodnie z R2.1 dalszych kandydatów nie trzeba było domykać przed przejściem do R3.

