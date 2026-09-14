# Q1 P3 Obciążenie — E1 freeze

Werdykt: **READY_FOR_INDEPENDENT_REVIEW — E1 ukończone, E2–E4 poza tym freeze.**

- Implementacja: `f463daac87dce9c8f1ef801a9a46b17d1d57d140`
- Tree implementacji: `de7f6ae7d8287ff4819074fc0f66446ef56dd989`
- Baza: `26b9d88309f1f174fc5450beb49d7b995383ea43` (`origin/integracja/20260911` po fetch)
- Gałąź: `codex/obciazenie-inicjatyw-20260914`
- Backup: `backup/codex/obciazenie-inicjatyw-20260914-20260914`
- Worktree: `/Users/piotrwisniewski/Developer/codex-wt/obciazenie-inicjatyw-20260914`
- PostgreSQL: `cx-q1-workload-pg`, host `5291`, restart `unless-stopped`; pełne migracje na pustej bazie PASS; brak nowej migracji.

## Zamrożony zakres E1

- Heatmapa osoba × tydzień w kanonie `StandardTable` + `StandardPreview`.
- Progi: poniżej 85% zielony, 85–100% bursztynowy, powyżej 100% czerwony; wyłącznie tokeny semantyczne.
- Filtry projektu, kanonicznego statusu inicjatywy i horyzontu 4/8/12/26 tygodni.
- Statusy porównywane przez `InitiativeStatus` z kanonicznych stałych; bez martwych literałów z Wpisu 31.
- Osoby aktywne bez zaplanowanych zadań są jawnie widoczne jako 0%, co zachowuje mianownik dostępnej kadry.
- Front `VITE_INITIATIVES_WORKLOAD` i serwer `ENABLE_INITIATIVES_WORKLOAD` mają domyślnie OFF. Przy OFF nowa trasa zwraca 404, a Hub renderuje poprzedni ekran.
- EN+PL. Brak migracji i brak zmian przydziałów.

## Dowody

- Wszystkie 5 zmienionych plików testowych, `--retry=0 --no-file-parallelism`: **5 plików, 6 testów PASS**.
- ApiGateway + podpisany JWT + RealPG `127.0.0.1:5291`: **PASS**; wybrany projekt i `PENDING_APPROVAL` dają 30h/20h = 150%, obcy projekt jest wykluczony, aktywna osoba bez zadań daje 0%, OFF daje 404.
- `npx tsc -p server/tsconfig.json --noEmit --pretty false`: **PASS**.
- Esbuild zmienionych plików: **PASS**.
- Produkcyjny `vite build` z flagą ON i `NODE_OPTIONS=--max-old-space-size=8192`: **PASS**, 10 732 moduły. Pierwsza próba przy domyślnym heap 4GB zakończyła się OOM po transformacji; nie był to defekt źródła.
- Zbudowany frontend na `127.0.0.1:4214`: jasny i ciemny, 1440×900, po 3 osoby i 8 tygodni, 0 błędów konsoli/strony. Zrzuty: `evidence/q1-p3-workload/e1-light.png`, `evidence/q1-p3-workload/e1-dark.png`; razem poniżej 200KB.
- Normalne hooki commitów PASS; bez `--no-verify`.

## Granica freeze

E2 deklaracja tygodniowej dostępności, E3 adapter do wspólnego silnika raportów P1 oraz E4 propozycje AI wyłącznie podczas planowania pozostają poza E1. E1 nie kopiuje silnika P1 i nie wykonuje żadnych zmian w biegnących przydziałach (DEC-486).
