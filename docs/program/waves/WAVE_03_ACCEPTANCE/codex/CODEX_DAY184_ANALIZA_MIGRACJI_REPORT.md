# CODEX DAY184 — ANALIZA MIGRACJI TASKS

Status: wykonano analize, bez zmian kodu produktu i bez migracji danych. Produkt: `docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md`.

## Baza i marker

```text
2ec857243a docs(codex): dyzury 180 i 184 wydane...
...
18661cc6a0 Merge branch 'codex/m03-admin-20260824'...
MARKER OK
18661cc6a007769dd419060ff3089860f1163afc
```

Tip byl do przodu; praca zgodnie z DEC-95 wystartowala dokladnie z markera. Porty 6093/5038/5039 byly wolne. Plan przed dyzurem nie istnial. Dysk przed startem: 5.4 GiB wolne (prog 5 GiB spelniony).

## Wynik

- Fresh migration: `Applying migrations: 870` (`day161-fresh-migration-gate.log:6`), `✅ Postgres migrations complete` (`day161-fresh-migration-gate.log:877`).
- Replay: `Applying migrations: 0`, `✅ Postgres migrations complete` (`day161-fresh-migration-gate-replay.log`).
- Napis `DAY161_FRESH_MIGRATION_GATE=PASS` nie wystepuje w zadnym z dwoch logow powyzej (zweryfikowane grepem); usuniety jako niepodparte twierdzenie.
- Fresh schema `tasks`: 80 kolumn.
- Grep: INSERT/UPDATE/DELETE/FROM tasks = 35/68/18/322 linii; 52 unikalne pliki mutujace. Router pmo/tasks = 24 mutujace trasy.
- Kanon: produkcyjnie jeden writer file; grep wszystkich TS daje 9 INSERT, 1 UPDATE i 89 FROM (testy wlaczone w liczbach liniowych).
- Lokalny denominator syntetyczny: total 2; personal/no initiative 1; no due 1; no parseable SLA 1; wiersz z initiative bez active execution case 1. Kwalifikowalne bez przygotowania: 0.

## Korekty wobec instrukcji

1. T1 potwierdzona: dwa pliki nie istnieja w `server/src/repositories`; sa w `server/src/domain/initiatives-execution`.
2. T2 potwierdzona: `task` remediation i `execution_task` execution work to rozne typy.
3. T3 potwierdzona: 24 trasy; „22 operacje” nie jest denominatorom kodu. Dzisiejsze 52 pliki obejmuja produkcje, testy i skrypty, wiec nie sa wprost porownywalne ze starymi 22 bez identycznego filtra.
4. Migracja 932 tworzy szesc tabel `ie_*`, nie piec: piec magazynow material-command wymienionych w instrukcji plus `ie_governance_policies`.
5. Dowod Day160 jest nieprzenosny: `day160.task-write-gate.pg.test.ts:68` wymaga nazwy `cx160`, a `:107` starego katalogu artefaktu. Wynik: suite failed, 3 tests skipped; nie jest PASS ani dowodem HTTP.

## Z30

```text
BRAK ZMIENNYCH POCZTY
ZERO DRENAZY W GATEWAY
SELECT ... FROM settings WHERE key LIKE 'smtp%'; -> (0 rows)
```

Nie ustawilem zadnej zmiennej SMTP ani flagi wysylki. Baza tego dyzuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomilem `server/src/index.ts` ani zadnego drenazu outboxu. Zaden e-mail ani zaproszenie kalendarzowe nie zostalo wyslane.

## Test Day160 — uczciwy wynik

Komenda miala kompletny env, real PG, `ENABLE_TEST_AUTH_BYPASS=false`, `ENABLE_V8_GLOBAL=true`, enforcement visibility i `--retry=0`. Pulapki srodowiska zostaly wylaczone; test zatrzymal wlasny, nieprzenosny guard nazwy bazy przed przypadkami. JSON: 2 failed suites raportera, 3 pending/skipped, 0 passed. To `NOT_PROVEN`, nie regresja produktu.

## Artefakty

`day184-day160-gate.json` — `7d1e9ea87c35a0618c346e7295df916949667e3ad7dd46efcc5bf0b4245029fe`; `day161-fresh-migration-gate.log` — `bcf0787f8d683961aa39a7bd4547c02dbebfe6923147a8a892e7e309d5f0097c`; `day161-fresh-migration-gate-replay.log` — `292ed226f355b1f33f76d8bf76ab1e34e7cf87543f526f58d83c6e072cf734bd`. Wszystkie w `/private/tmp/cx-day184-analiza-migracji-artefakty/`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie przeszedlem do wolacza kazdego z 52 plikow; pozycje uslugowe poza znanymi routerami maja klasyfikacje „zalezy od wywolujacego”. Dla `pmo/tasks.routes.ts` (24 trasy) klasyfikacja za/poza brama jest teraz per-trasa i zweryfikowana statycznie (montaz `requireCanonicalExecutionWriter` na `tasks.routes.ts:67`); dla pozostalych ~28 plikow nadal nie.
- Sprawdzilem wszystkie szesc punktow montazu wymienionych w instrukcji (`tasks.routes.ts:67`, `Gateway.ts:1036,1389,1454`, `v8/index.ts:107`, `initiatives.routes.ts:160`) z realnymi liniami; nie udowodnilem, ze nie istnieje montaz dynamiczny poza grepem.
- Zmierzylem na syntetycznym zbiorze, ze 1/1 initiative-bearing legacy task nie ma active case; nie jest to pomiar danych demo/produkcyjnych i nie moze byc na nie ekstrapolowany. Lancuch genezy `execution_case` (A4.0, 5 komend) jest teraz zweryfikowany z realnymi liniami, ale sam pomiar denominatora na danych demo/produkcyjnych NIE zostal wykonany.
- Aktor systemowy i `policyId=execution-work`, version 1 sa propozycja oparta na sciezce produktowej; istnienie/autoryzacja konta systemowego nie sa potwierdzone.
- Plan odwrotu jest domkniety jako forward-repair; nie wykonano destrukcyjnego eksperymentu rollbacku, zgodnie z zakazem migracji danych.
- `POST /api/my-work/personal-tasks` jest teraz statycznie potwierdzony jako jedyny NAZWANY pisarz poza brama (mount `Gateway.ts:1036` bez `requireCanonicalExecutionWriter`, insert `my-work.routes.ts:1379`) — ale to dowod statyczny (grep + odczyt kodu), nie realny HTTP end-to-end. Calkowita liczba WSZYSTKICH osiagalnych writerow poza brama pozostaje `NOT_PROVEN`; znany Day160 jest nadal zablokowany przez naruszenie Z31.
- Nie utworzono zadania kanonicznego realnym HTTP, bo seed nie tworzy execution_case, a instrukcja zakazuje surowej migracji danych; ten dowod nalezy do dyzuru wykonania po ustanowieniu domu kanonicznego.
- Nowe (FIX-184): `060_work_dimensions.sql:198` bezwarunkowo dodaje `tasks.facility_id` (bez `IF NOT EXISTS`), ale ta kolumna NIE wystepuje w 80-kolumnowym pomiarze fresh-DB wlasciciela i nie ma zadnego DROP w `server/migrations` (zweryfikowane grepem). Przyczyna nieobecnosci jest `NOT_PROVEN` — moze to byc blad tej migracji (silent fail per-statement w runnerze) albo blad w oryginalnym pomiarze SQL; nie scigane dalej, poza zakresem FIX-184.
- Nowe (FIX-184): `20260719_baseline_gap.sql` ma ~645 linii `add column if not exists` na dziesiatkach tabel; zweryfikowalem tylko piec linii dotyczacych `tasks` (13581-13589). Pozostale linie tego pliku (inne tabele) nie byly sprawdzane pod katem podobnych konfliktow kolejnosci z innymi migracjami.
- Nowe (FIX-184): trzy warianty dla `POST /api/my-work/personal-tasks` (A5) maja koszty „rzad wielkosci” oparte na przegladzie kodu (typy zmian, liczba dotknietych plikow), nie na realnej wycenie inzynierskiej ani prototypie. Podobnie rekomendacja sidecar-agregatu dla `risks`/`alternatives` (A3) to propozycja architektoniczna oparta na istniejacym wzorcu relacji (`executionWork.ts:167-176`), nie zaimplementowany i przetestowany kontrakt.

## Zakres zmian

Wyłącznie dwa pliki `.md`. Zero zmian w `server/src`, `src`, migracjach i bramie. Kontener `cx-day184-pg` zostal usuniety z wolumenem przez trap bramki Day161.
