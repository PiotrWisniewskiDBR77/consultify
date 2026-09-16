# TEMPLATE-1b — czystka 96

Status: **FROZEN / QUEUED FOR CTO REVIEW**. Pakiet wykonuje czystkę wyłącznie przez migrację addytywną `20262272`, po trzech bazach z `20262271`. Nie był uruchamiany na stagingu ani produkcji.

## Zakres i mianownik

- Źródło decyzji: `INWENTARZ.csv`, SHA-256 `8a4d9b78879b2a6f3817c937fa14c3ba0a0bdd31f722ffc32697370300a8def1`.
- Mianownik `fullName=96`: 20 `KEEP`, 16 `REBUILD`, 60 `DEPRECATE`.
- Rodziny: 78 `DOC-BASE`, 16 `DECK-BASE`, 2 `SHEET-BASE`.
- Runtime: 46 document, 33 report, 15 presentation, 2 sheet.
- Aktualny zrzut read-only staging z 16.09 zawiera wszystkie źródła #1–92 oraz pełny łańcuch artefakt → origin link → źródło dla #93–96. Import lokalny: 56 document, 33 report, 27 presentation, 49 sheet, 588 artefaktów i 486 linków.

## Zachowanie

Przed pierwszym trwałym zapisem migracja wymaga dokładnie 96 unikalnych pozycji, jednego źródła i istniejącej migawki każdej pozycji, jednego właściwego linku dla #93–96, trzech zatwierdzonych baz `20262271` i aktywnych źródeł `KEEP`. Na fresh bez runtime-seedowanych baz kończy się `NOTICE` i nie tworzy backupu ani danych.

Po preflight:

- zapisuje niezmienne before-image sześciu tabel w `template_1_20262272_backup`;
- wygasza 60 źródeł i ich karty bez usuwania payloadów;
- zachowuje 20 `KEEP` oraz sprawdzone bazy #15/#81;
- mapuje profile `REBUILD` na rodzinę i pozostawia je jako draft do testu żywego obiektu;
- zachowuje `is_draft` monotonicznie przez `GREATEST`: żaden z 22 początkowych draftów Northwind nie wraca do stanu aktywnego;
- dla #53 pozostawia starą kartę raportu aktywną i tworzy nową kartę decku jako draft, więc nie istnieją dwie aktywne karty jednego wołacza;
- ustawia dokładnie jeden aktywny default `RESULTS_KPI_REPORT`;
- kończy readbackiem: 60 źródeł wygaszonych, 22 pozycje proven aktywne, 13 profili przebudowanych jako draft.

`20262271` ogranicza kontrolę „duplicate active base card” do trzech kanonicznych par origin runtime/id. Ponowny przebieg po przypisaniu rodzin przez czystkę nie myli profili rodziny z kartą bazową.

Rollback `rollback/20262272_template_library_cleanup_96.down.sql` usuwa wyłącznie rekordy utworzone przez migrację, odtwarza wszystkie before-image i usuwa indeks tylko wtedy, gdy nie istniał przed migracją.

## Dowody lokalne

- PostgreSQL 17 + pgvector, fresh strict: **924 migracje, RC=0**.
- Fresh direct rerun `20262272`: kontrolowany no-op, RC=0; backup nie istnieje, artefakty/linki 0/0.
- Lokalny import sześciu CSV staging, następnie `20262271 → 20262272`: RC=0; readback 60/22/13.
- Drugi `20262272`: RC=0; hashe sześciu tabel po pierwszym i drugim apply identyczne (`staging-final-idempotency.diff` ma 0 B).
- Ponowny `20262271` po czystce: RC=0, bez fałszywego „duplicate active base card”.
- #53: stara karta `is_draft=0`, `ready`, źródło aktywne; nowa karta `is_draft=1`, `draft`, lifecycle `draft`.
- Początkowe drafty Northwind: **22/22 nadal `is_draft=1`, 0 podniesionych do aktywnych**.
- Rollback: RC=0; hashe sześciu tabel przed apply i po rollbacku identyczne (`staging-final-rollback.diff` ma 0 B).
- Mapa kontra `INWENTARZ.csv`: PASS, 96/96. `git diff --check`: PASS.

Dowody znajdują się w `evidence-v2/`. Zrzut staging służył wyłącznie do lokalnego importu. Pakiet nie wykonuje staging write, deployu, operacji Railway ani zmian chronionych refów.
