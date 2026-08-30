# CODEX DAY 161 — integralność łańcucha migracji

Data pomiaru: 2026-08-30  
Marker: `218d020958`  
Gałąź: `codex/day161-lancuch-migracji-20260830`  
Werdykt: **R1 PASS, R3 PASS, R2 PARTIAL, R4 NIE DOTYCZY — brak nowego przypadku potwierdzonego przebiegiem**.

Przyrost na bazie już zmigrowanej nie jest dowodem integralności łańcucha. Wszystkie twierdzenia o pełnym łańcuchu poniżej pochodzą z efemerycznej pustej bazy `cx-day161-pg`, `pgvector/pgvector:pg16`, opublikowanej wyłącznie na `127.0.0.1:6049`.

## Stan wejściowy

Wolne miejsce: `21 GiB` (próg STOP: mniej niż 5 GiB). Porty `6049`, `4990`, `4991` były wolne. Dokument miał stan `WYDANY`.

Wynik kontroli markera (§0.1 pkt 2), dosłownie:

```text
MARKER OK
```

Tip `github-backup/codex/m03-admin-20260824` był 7 commitów przed markerem. Zgodnie z regułą rozejścia praca zaczęła się dokładnie z markera; scalenie tipa pozostaje po stronie nadzorcy.

Wynik sanity (§0.1 pkt 7), dosłownie:

```text
218d020958a0470e043ce5be9537a1b15f351884
```

`git status --short | head -3` nie wypisał nic.

Przy pierwszej próbie docelowy katalog już zawierał osobny checkout (`.git` był katalogiem), nie worktree vaulta. Został zachowany bez kasowania pod `/private/tmp/cx-day161-lancuch-migracji-scratch/preexisting-standalone-checkout`; właściwy worktree utworzono następnie z bare-vaulta i skonfigurowano przez `config.worktree` z `core.bare=false`.

## T1/T2 — rzeczywista kolejność i ślepa plamka

`migrate.postgres.ts:853` przekazuje kandydatów do `sortMigrationsDeterministically`. `files.sort()` w `getAllMigrations()` jedynie stabilizuje listę wejściową. `migrationOrdering.ts` dzieli pliki na fazy i stosuje ręczne mapy wyjątków. Nie analizuje treści SQL, więc nie wykrywa automatycznie inwersji producent–konsument wewnątrz tej samej fazy; taka para wymaga wcześniej znanego wpisu lub empirycznego fresh-DB gate.

## R1 — pusta baza, dry-run, strict i idempotencja

Start pierwszego kontenera:

```text
/cx-day161-pg 2026-08-30T12:14:07.169945464Z [{127.0.0.1 6049}]
```

Dry-run na pustej bazie:

```text
Pending migrations: 868
day159 713
gap_closure 847
pending_total 868
```

Między pozycjami 713 i 847 jest 133 pliki. Liczby autora instrukcji (`713/868`, `847/868`, 133 między nimi) zostały potwierdzone prawdziwą listą runnera.

Pierwszy strict-run, bez `--safe`:

```text
Applying migrations: 868
...
✅ Postgres migrations complete
```

Ledger po przebiegu:

```text
 status  | count
---------+-------
 success |   868
```

Natychmiastowy replay tej samej komendy:

```text
Applying migrations: 0
✅ Postgres migrations complete
```

Wynik koryguje roboczą tezę, że na markerze musi istnieć jeszcze przypadek wywracający łańcuch: pełny strict-run nie ujawnił nowej awarii. Nie dowodzi to braku wszystkich latentnych zależności warunkowych; dowodzi, że aktualny pusty łańcuch wykonuje się do końca.

Artefakty:

| Plik | SHA-256 |
|---|---|
| `/private/tmp/cx-day161-lancuch-migracji-artefakty/r1-dry-run-before.log` | `30ca577188421a0ffd52d9d8c0bfe6a4338e54437446cd0e05f3c1c5bf52025a` |
| `/private/tmp/cx-day161-lancuch-migracji-artefakty/r1-strict-before.log` | `c5a83ec23027f27c267eb25126a35c0ff5bd3fa666201f8fc502f4df0b6fc301` |
| `/private/tmp/cx-day161-lancuch-migracji-artefakty/r1-strict-idempotence.log` | `e6c94071b551468bd7e7037af7146457a9fec3923b5ead4bea2139bd935c272a` |

## R2 — inwentarz zależności kolumnowych

Jednorazowy skrypt w scratchu odtworzył kolejność wyłącznie z zapisanego dry-runu, przeszedł wszystkie 864 uruchamialne pliki SQL, zebrał producentów z `CREATE TABLE` i `ALTER TABLE ... ADD COLUMN`, a następnie kwalifikowane odczyty `alias.column` w instrukcjach zawierających `SELECT`, `UPDATE`, `DELETE` lub `WITH`.

Zakres wyniku:

| Miara | Wynik |
|---|---:|
| runnable ogółem | 868 |
| runnable SQL | 864 |
| unikalne rozpoznane odczyty `alias.column` | 698 |
| producent wcześniej lub w tym samym pliku | 253 |
| producent nierozpoznany przez parser | 440 |
| kandydat `AFTER` przed ręczną weryfikacją | 5 |

Pełna tabela 698 wierszy: `/private/tmp/cx-day161-lancuch-migracji-artefakty/r2-alias-qualified-inventory.csv`, SHA-256 `d8fb6bc0461fb5517186fd67d786299dbdbd1559c8996476addc788c0f36567a`.

Pięć kandydatów:

| Migracja (pozycja) | Odczyt | Producent wskazany przez parser (pozycja) | Ręczna weryfikacja |
|---|---|---|---|
| `940_mw010_vault_document_versions.sql` (249) | `knowledge_docs.chunk_count` | `20261039_knowledge_vault_document_metadata.sql` (798) | fałszywy alarm: backfill jest za katalogowym `IF EXISTS` wszystkich używanych kolumn; na fresh DB bez kolumn jest no-op |
| jw. | `knowledge_docs.organization_id` | `942_chat_m01p04a_attachment_status.sql` (252) | jw.; katalogowa bramka przed odczytem |
| jw. | `knowledge_docs.owner_id` | `20260719_baseline_gap.sql` (489) | jw.; katalogowa bramka przed odczytem |
| `956a_partner_referral_legacy_shape_repair.sql` (270) | `partner_campaign_links.partner_org_id` | `957_partner_public_referral_click_receipts.sql` (271) | fałszywy alarm: blok zaczyna od `to_regclass(...) IS NULL` i `RETURN`; fresh DB jest jawnie no-op |
| jw. | `partner_referral_clicks.partner_org_id` | `957_partner_public_referral_click_receipts.sql` (271) | jw.; jawny `RETURN` przed odczytem |

**Ograniczenie B6:** to nie jest kompletny semantyczny parser PostgreSQL. Nie obejmuje niezkwalifikowanych nazw kolumn, dynamicznego SQL, części zagnieżdżonych konstrukcji, poprawnego rozwijania wszystkich `CREATE TABLE` z typami zawierającymi przecinki ani producentów runtime. `440` pozycji `PRODUCER_NOT_PARSED` pozostaje jawnie nierozstrzygniętych. Czego zabrakło, żeby rozstrzygnąć samodzielnie: parsera AST obejmującego dialekt PostgreSQL/PLpgSQL oraz mapowania runtime DDL na ten sam graf zależności.

## R3 — bramka regresyjna

Wybrano wariant (a): `scripts/dev/day161-fresh-migration-check.sh`. Statyczny wariant (b) oparty na ręcznie utrzymywanym inwentarzu nie wykrywa automatycznie nowej migracji i przy 440 nierozpoznanych producentach dawałby fałszywe poczucie kompletności.

Gate:

- odmawia adopcji istniejącego kontenera i zajętego portu;
- stawia świeży `pgvector/pgvector:pg16` na `127.0.0.1:6049`;
- uruchamia strict-run z pełnym env w jednej linii;
- wymaga `✅ Postgres migrations complete`;
- wymaga niepustego ledgera zawierającego wyłącznie `success`;
- wykonuje replay i wymaga `Applying migrations: 0`;
- przez trap usuwa wyłącznie własny kontener z wolumenem.

Kontrola pozytywna:

```text
POSITIVE_GATE_EXIT=0
Applying migrations: 0
✅ Postgres migrations complete
DAY161_FRESH_MIGRATION_GATE=PASS
```

Rewalidacja po wznowieniu dyżuru, 2026-08-30 14:42–14:43 CEST, ponownie
uruchomiła gate od nowego pustego kontenera: `Applying migrations: 868`,
`✅ Postgres migrations complete`, replay `Applying migrations: 0` i
`DAY161_FRESH_MIGRATION_GATE=PASS`. Trap usunął `cx-day161-pg` razem z wolumenem.
Log strict-run: `/private/tmp/cx-day161-lancuch-migracji-artefakty/day161-fresh-migration-gate.log`,
SHA-256 `799dec0b20e5afad511816d9e1cabeac65c1895e773eeebcf68ef43c718f294c`;
log replay: `/private/tmp/cx-day161-lancuch-migracji-artefakty/day161-fresh-migration-gate-replay.log`,
SHA-256 `66dbb3f87ad9bb8fd650bbe9d26d4b9e3d3815c65e525c9b625c222b6df8bbc9`.

Kontrola negatywna: po tymczasowym usunięciu istniejącego strażnika day159 z kopią w scratchu gate na nowej pustej bazie zwrócił:

```text
→ 20260830_day159_chunk_org_backfill.sql
✗ 20260830_day159_chunk_org_backfill.sql: column k.metadata does not exist
❌ Postgres migrate failed: column k.metadata does not exist
```

Plik przywrócono przez `cp`; `git diff -- server/migrations/20260830_day159_chunk_org_backfill.sql` był pusty. Ponowny gate był zielony. Artefakty: `r3-negative-control.log` SHA-256 `f8e9a714089b53e6fcaa6d2e9c35408054a952cb77223ddf0bc5f270fefb4d0d`; `r3-positive-after-restore.log` SHA-256 `1f54e62b9911191f1a6eabf73ece3de20911d2352e0117db700b1c8ff66903d8`.

## R4 — naprawy

Nie zmieniono żadnej migracji. R1 przeszedł, a pięć statycznych kandydatów okazało się jawnie osłoniętymi no-opami na fresh DB. Zgodnie z licencją nie dodano strażników bez potwierdzonego czerwonego przypadku.

## Z30 — zero wysyłki

Przed zapisem `env` zwrócił `BRAK ZMIENNYCH POCZTY`; grep drenaży w `server/src/Gateway.ts` nie zwrócił trafień. Po migracji zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Pułapki §0.2d/Z33 dla użytych dowodów: dotyczyła wyłącznie pułapka (e), wyłączona przez nowy pusty kontener, pełny env w tej samej linii, uruchomienie z korzenia repo i kolejność pobraną z realnego `--dry-run`. Pułapki HTTP/auth (a)–(d) nie leżą na ścieżce skryptu migracyjnego; nie uruchamiano pakietu HTTP ani Vitest.

## Korekty wobec instrukcji

1. §0.1 wymaga utworzenia worktree w pustej ścieżce; ścieżka zawierała osobny checkout. Zachowano go odzyskiwalnie i utworzono właściwy worktree z vaulta bez kasowania danych.
2. §4 mówi o porcie „do wyboru”, ale Z7 przybija `6049`; zastosowano bezpieczniejszy, konkretny Z7.
3. Z24 odsyła do `§0.4a`, którego w 837-liniowym wydanym dokumencie nie ma. Nie przepisano cudzej liczby testów; raportuje się własne mianowniki R1/R2 oraz brak uruchomienia Vitest. Czego zabrakło: treści §0.4a definiującej wymagany pomiar zasięgu.
4. Teza robocza T2 nakazuje zakładać inne pary; empiryczny R1 nie znalazł kolejnej pary wywracającej aktualny fresh chain. To sukces pomiarowy, nie podstawa do dopisywania niepotwierdzonych strażników.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano semantycznie 440 odwołań `PRODUCER_NOT_PARSED` ani niezkwalifikowanych/dynamicznych odwołań SQL.
- Nie zweryfikowano zachowania `--safe`.
- Nie zweryfikowano niezależnych ścieżek `DatabaseInitializer.ts` i `PostgresDatabase.initDb()`.
- Nie wykonano runtime HTTP, frontu ani harnessu na `4990/4991`; są poza zakresem migracyjnego gate.
- Nie uruchomiono Vitest; wydana instrukcja nie zawiera przywołanego §0.4a, a wybrany R3 jest samodzielnym real-DB gate.
- Brak nowego potwierdzonego przypadku oznacza brak podstaw do twierdzenia, że wszystkie latentne inwersje zostały wykluczone.

## Pliki dyżuru

Docelowo zmienione wyłącznie:

- `scripts/dev/day161-fresh-migration-check.sh`
- `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY161_LANCUCH_MIGRACJI_REPORT.md`

Nie wykonano połączeń do Railway, demo, stagingu ani produkcji. Nie uruchomiono Railway CLI, pełnego serwera, LLM ani zewnętrznej wysyłki.
