# R3 — rodzina fałszywego twierdzenia

Pomiar raportu 295:

```text
bash -c "grep -n 'Dopisek dyzuru 331|Dopisek dyżuru 331|bezimienn' docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY295_MOJAPRACA_INICJATYWY_REPORT.md"
kod grepa=1
```

Historia pliku kończy się na `1dc4b60f54 docs(day295): zamknij raport dowodów Mojej Pracy` (wcześniej `d2ffa839d2`). Pozycja sprostowania jest bezprzedmiotowa: fałszywe twierdzenie nie dotarło na linię integracyjną. Raportu 295 nie zmieniono.

Pomiar rodziny na HEAD:

```text
rg -n -i 'bezimienn.{0,160}mianownik|mianownik.{0,160}bezimienn|bezimienny widoczny|zatrzymał uczciwy|zatrzymal uczciwy' docs evidence
kod rodziny=1
```

Lista rodziny: pusta. Generatora raportu 295 również nie znaleziono (`grep -rl 'CODEX_DAY295' scripts/`, kod 1).
