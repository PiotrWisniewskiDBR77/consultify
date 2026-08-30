# CODEX DAY 145 — kanoniczne polecenia RAID

## Stan wejściowy

`§0.1-BIS`:

```text
git merge-base --is-ancestor c685ea65af HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK

git status --short
(brak wyjścia)

git branch --show-current
codex/day145-raid-polecenia-20260830

ls -la node_modules
lrwxr-xr-x@ ... node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules

df -h /
/dev/disk3s1s1  1.8Ti  12Gi  20Gi  37% ... /

PORT 6031 WOLNY
PORT 4956 WOLNY
PORT 4957 WOLNY
BRAK KOLIZJI W DOCKER PS
```

`§0.1` T1–T4:

```text
T1: kontrakt day141 zawiera realny ApiGateway i sekwencję POST -> SELECT -> DELETE -> SELECT.
T2: grep wskazał wyłącznie raid-mitigations; brak raid-items.
T3: grep domeny po "raid-item" bez testów: 0.
T4: adoptAcceptedClassicInitiative.ts zawiera commandType i wzorzec materialnego polecenia.
```

Migracje na `postgresql://postgres:cx@127.0.0.1:6031/cx145`: pierwszy przebieg zakończony `✅ Postgres migrations complete`; drugi: `Applying migrations: 0`, `✅ Postgres migrations complete`.

Dowód Z30 przed zapisem:

```text
BRAK ZMIENNYCH POCZTY
SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';
(0 rows)
grep ... server/src/Gateway.ts
(0 trafień)
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Korekty wobec instrukcji

1. `§0.1-BIS`: zasób wyłączny to `6031/cx145`; kontrakt tylko do odczytu w linii 80 oczekuje dosłownie `6027/cx141`. Bezpieczna interpretacja: uruchomiłem test wyłącznie na przydzielonej bazie, nie zmieniłem asercji i nie użyłem cudzego portu. Ten jeden przypadek pozostaje FAIL z powodu starego koordynatu, nie zachowania produktu.
2. `§R.2` żąda „wszystkich komend §0.4”, ale dokument nie zawiera §0.4; `§0.1-BIS` rozstrzyga to jako martwe odwołanie. Pominąłem nieistniejący pomiar.
3. R1 cytuje stary koordynat `6027/cx141`; wiążący jest zasób `6031/cx145` z §0.1-BIS i Z7.

## R1 — `raid-item.create`

Commit `c6d9c8ac2b`. Dodano osobne polecenie `raid-item.create`, transakcyjny `INSERT INTO raid_items`, blokadę advisory dla tenant/inicjatywa, wersjonowanie przez `aggregateType=raid_item`, idempotencję z command bus i audyt/outbox.

## R2 — `raid-item.delete` i trasy

Commity `c6d9c8ac2b`, `9ec4eb1149`. Dodano fizyczny, tenantowo i inicjatywowo zawężony `DELETE`, trasy POST/DELETE przez produkcyjny router, walidację Zod oraz autoryzację `initiative.update`. DELETE zwraca 200 także dla replay.

Kontrakt zachowania `requires a canonical RAID-item create/read/delete...` przeszedł na realnym PG: POST 201, bezpośredni SELECT zwrócił wiersz, DELETE 200, końcowy SELECT miał `rowCount=0`. Test legacy 409 i inwentarz 409 także pozostały PASS.

## R3 — capabilities i pozostałe powierzchnie

Dodano `executionWrites.raidItem.create/delete` z wymaganymi ścieżkami oraz `legacyDenialCode=EXECUTION_RUNTIME_V1_WRITE_REQUIRED`.

W istniejącym `executionWrites` nie znaleziono kanonicznych odpowiedników dla powierzchni z kontraktu: `POST milestones`, `POST resources`, `POST staffing-plans`, `PUT gate-roles`, `POST start-execution`, `POST block`, `POST move`, `POST apply-template`, `POST apply-blueprint`. `POST budget-items` ma odpowiednik funkcjonalny `POST .../budget-entries/:entryId`, lecz nie identyczny kształt ścieżki.

## Para przebiegów W-A i pomiar różnicowy W-C

Identyczna komenda Vitest, z katalogu `server/`, z zewnętrznym configiem bez przypięcia SQLite, `--retry=0` i kompletem env dnia 145:

```text
PRZED: 4 total; 2 PASS; 2 FAIL; 0 pending
FAIL ... binds the proof package ... (stary hardcode 6027/cx141)
PASS ... legacy RAID POST returns 409 ...
PASS ... inventories other Initiative-card legacy mutations ...
FAIL ... requires a canonical RAID-item create/read/delete ... (404 zamiast 201)

PO: 4 total; 3 PASS; 1 FAIL; 0 pending
FAIL ... binds the proof package ... (ten sam stary hardcode 6027/cx141)
PASS ... legacy RAID POST returns 409 ...
PASS ... inventories other Initiative-card legacy mutations ...
PASS ... requires a canonical RAID-item create/read/delete ...
```

`npx tsc -p server/tsconfig.json --noEmit --pretty false`: exit 0, brak wyjścia.

## W-D — granica zmian

```text
server/src/domain/initiatives-execution/materialCommand.ts
server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts
server/src/domain/initiatives-execution/raidItem.ts
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY145_RAID_POLECENIA_REPORT.md
```

Zero zmian w `src/**`, migracjach, kontrakcie day141 i globalnych configach testowych.

## Pułapki (a)–(e)

- (a) `ENABLE_V8_GLOBAL=true` było w tej samej linii.
- (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` było w tej samej linii.
- (c) użyto configu poza repo bez `test.env.DB_TYPE=sqlite`; test potwierdził `DB_TYPE=postgres`, ale jego dalsza asercja starego URL pozostała FAIL.
- (d) `ENABLE_TEST_AUTH_BYPASS=false`; żądania przeszły przez produkcyjny `ApiGateway` i podpisany JWT.
- (e) plik day141 nie został zmieniony; produkt zazielenił przypadek POST/SELECT/DELETE/SELECT.

## Artefakty

```text
ca63aca6b87c04b846b3db66396002568eacdf10e6fdf43032c80225e60d0df7  migrate-1.log
e4f13bfc587b3b1b66517392341405e7396319fb1eb3e04dd9d1f730d79795b9  migrate-2.log
7eddecc4f16f22d0936fd07c74dd7bb5eed93860aa893389f1105397b204dae5  day145-before.json
170b70c1516bc5d4d2490c3b36827c8294013e377968028623a7bfa03ad99347  day145-after-2.json
```

Artefakty są w `/private/tmp/cx-day145-raid-polecenia-artefakty` i nie weszły do repo.

## TWIERDZENIA NIEZWERYFIKOWANE

- B1 w dosłownym brzmieniu „plik przechodzi w całości” jest **NIEZWERYFIKOWANE / niemożliwe na zasobie dnia 145**, bo niezmienialna asercja przypina cudzy, stary adres `6027/cx141`. Zachowanie produktowe tego pliku ma 3/3 istotne przypadki PASS, ale cały pakiet ma 3 PASS / 1 FAIL.
- B4–B6 nie mają osobnych asercji w chronionym kontrakcie day141; mechanizm command bus jest użyty, lecz nie wykonano osobnego real-HTTP pomiaru konfliktu, replay ani zapytania audytu. Stan: `NOT_PROVEN`.
- B8 przez realny GET capabilities nie został wykonany; wpis istnieje w produkcyjnym handlerze, ale runtime HTTP nie został zmierzony dla tej odpowiedzi. Stan: `NOT_PROVEN`.
- Brak konsumenta frontowego w tym dyżurze; `src/**` było jawnie nietykalne, więc osiągalność od UI nie jest dowiedziona.

Nie pushowałem.
