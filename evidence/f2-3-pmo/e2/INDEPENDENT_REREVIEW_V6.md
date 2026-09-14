# F2-3 PMO E2 — szósty świeży niezależny rereview

**Werdykt: ACCEPT dla dokładnego manifestu V6. P1 z V5 jest zamknięte dowodem zachowania produkcyjnego komponentu: Cancel i X zamykają modal bez wywołania API, a Submit wykonuje dokładnie jedno wywołanie API i przekazuje zapisany rekord do callbacku.**

Rereview wykonano 2026-09-13 21:21 CDT na gałęzi `codex/pmo-projekty-role-statusy-20260913`, przy bazie i niezmienionym HEAD `ba25e564592f4a803ecf53edf81b7d8c84524426`. SHA-256 dokładnego manifestu V6 wynosi `37b6a7e165254a7587f62a9c59ae843cac636af78172faa430942d61ff9d7a44`; wszystkie 80/80 wpisów przeszły świeże `sha256sum -c`, dryf wynosi 0. Ten raport jest oddzielnym artefaktem review i nie należy do manifestu autora.

## Zamknięcie HOLD V5

- Produkcyjny `CreateProjectModal` ma natywny formularz z `onSubmit`. X i Cancel mają jawne `type="button"`, właściwy przycisk Create ma `type="submit"`, a X ma dostępną nazwę.
- Trwały test montuje ten sam produkcyjny komponent z poprawną nazwą projektu. Cancel: `onClose=1`, `Api.createProject=0`, `onSaved=0`. X: `onClose=1`, `Api.createProject=0`, `onSaved=0`. Submit: `Api.createProject=1`, `onSaved=1`, `onClose=1`, z kontrolą przekazanego `name` i `pmo_standard`.
- Świeży niezależny focused run objął 6 plików i przeszedł 17/17 testów, retry 0. Obejmuje modal, role z realnym kształtem API, EN+PL, kontrakt list, model PMO oraz flagę i routing.
- Inspekcja ograniczonej delty V6 nie wykazała zmiany zachowania poza naprawą submitterów i trwałym testem regresji. Zachowane raporty V4/V5 dokumentują wcześniejszą akceptację pełnego zakresu oraz jedyne późniejsze P1.

## Bramki

- `check-action-coverage.sh src/components/MyWork/CreateProjectModal.tsx`: PASS, 1 plik, 0 nowych naruszeń, baseline 0.
- `check-actions.sh --verbose`: PASS — 234 akcje, 124 stringi runtime, 7 zdarzeń i 4 metody API; staged MyWork coverage 4 pliki, 0 nowych naruszeń.
- Zamrożony feature-enabled build: PASS, 10 715 modułów, 34.88 s, SHA-256 pliku dowodowego `537bc85996faf2045b05f03f699f75c08c4ed7a49f3dab29aaec52cc4a7112fc`. Świeży niezależny build z `NODE_OPTIONS=--max-old-space-size=8192` również PASS: 10 715 modułów, 35.36 s. Próba przy domyślnym limicie około 4 GB doszła do transformacji 10 715 modułów i zakończyła się OOM; udany bieg 8 GB potwierdza ograniczenie pamięci procesu, bez sprzeczności z zamrożonym dowodem.
- Pełny frontend TypeScript pozostaje neutralną deltą, a nie twierdzeniem o zielonym repo: baza i kandydat mają po 189 diagnostyk `error TS`, ich pełne wyjścia są bajtowo identyczne i mają wspólny SHA-256 `47bd5cef37ba70021bf6936106633cfd6ed97f64514f8b3dc9fc86375d3b68a5`.
- `git diff --check`: PASS. Nie rozpoczęto E3, migracji, deployu ani pushu.

Nie znaleziono nowego P1/P2 w zakresie V6. Dokładny manifest V6 jest **ACCEPT** do zwykłego commitowania przez autora zgodnie z procesem paczki.
