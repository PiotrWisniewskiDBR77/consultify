# CODEX DAY 281 — schemat od zera

## Wejście

Wynik markera, dosłownie:

```text
MARKER OK
```

Wynik sanity, dosłownie:

```text
eeb253c3ec13195a04b3848ef2566c5c07786e58
```

Worktree był czysty; `git status --short | head -3` nie zwrócił żadnej linii.

Tip `github-backup/grafika/m03-20260902` uciekł do przodu. Zgodnie z `DEC-2026-08-26-95` praca biegnie dokładnie z markera; listę commitów i plików rozjazdu zmierzono przed zmianami.

## R1 — pomiar bazowy

Na świeżym `pgvector/pgvector:pg16` pełny runner zgłosił 882 migracje i zakończył `Postgres migrations complete`. W logu brak błędów i ostrzeżeń. `schema_migrations` zawiera 882 wiersze. Tabela `email_verification_tokens` po migracjach nie istnieje (`to_regclass` zwrócił `NULL`).

Artefakt: `/private/tmp/cx-day281-schemat-od-zera-artefakty/r1-migrate-full.log`, SHA-256 `c5fd75a05660423fff9f6a10345691417d9d5a661129f3d9d7abf1e25898334a`.

## Z30 — dowód przed zapisem

- `env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)"` zwróciło `BRAK ZMIENNYCH POCZTY`.
- Zapytanie o `settings.key LIKE 'smtp%'` po migracjach zwróciło 0 wierszy.
- Grep drenaży w `server/src/Gateway.ts` zwrócił 0 trafień.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## KOREKTY wobec instrukcji

- Teza o 208 wystąpieniach `CREATE TABLE IF NOT EXISTS` w serwisach zgadza się z pomiarem.
- Teza o sześciu plikach serwisowych z `DATETIME` zgadza się z pomiarem.
- Teza, że pełny łańcuch migracji od zera sam się wywraca, nie potwierdziła się: na markerze pełny przebieg 882 migracji zakończył się sukcesem. Nie obala to osobnej tezy o rejestracji.
- Gałąź bazowa zawiera nowsze commity niż marker; zgodnie z instrukcją nie zostały scalone ani rebazowane.

## R2 — rejestr runtime DDL

Literalny mianownik wynosi 208 trafień w 100 plikach. Inwentarz obejmuje wszystkie trafienia: 22 instrukcje z `DATETIME`, 52 statycznie nazwane instrukcje bez wykrytej migracji oraz 12 nazw `UNKNOWN`. Pełna tabela jest w rejestrze. Artefakt: `/private/tmp/cx-day281-schemat-od-zera-artefakty/r2-runtime-ddl-inventory.md`, SHA-256 `c059371f8492775708ec9d351b2ed4ed5e61f85275d0f3f4874392412aa6f520`.

## R3 — czerwony dowód mutacyjny

Samodzielny harness `npx tsx` zamontował realny `ApiGateway`, nasłuchiwał na `127.0.0.1:5248` i wykonał realne `POST /api/auth/register`. Log potwierdził `DB_TYPE=postgres` oraz `DB_IDENTITY ... 127.0.0.1:6268/cx281`. Runtime DDL zakończyło się błędem PostgreSQL `42704: type "datetime" does not exist`; proces zakończył się przed zapisaniem statusu HTTP. Readback wykazał częściowy zapis użytkownika i organizacji oraz brak tabeli `email_verification_tokens`.

Artefakt: `/private/tmp/cx-day281-schemat-od-zera-artefakty/r3-registration-before.log`, SHA-256 `16d88412ae72274ad3593cee030625b1d4775bfc6abeec9c56be73fb089620eb`.

Pułapki (a)–(e): Vitest nie został użyty, więc globalny mock `fetch` nie działał; `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, jawny lokalny `DATABASE_URL` i `JWT_SECRET` były w tej samej linii. Brak error middleware w `Gateway.ts` został skompensowany lokalnym middleware harnessu, ale awaria nastąpiła jako nieobsłużone odrzucenie wcześniej; pełny wyjątek jest w logu. Nie było retry.

## R4 — naprawa licencjonowana

Zakres zmiany jest ograniczony do `server/src/services/emailVerificationService.ts` i nowej migracji `server/migrations/20261911_email_verification_tokens.sql`. Typy runtime DDL zmieniono z `DATETIME` na `TIMESTAMPTZ`; nieudane DDL jest teraz logowane jako `error`, wynik każdej operacji jest sprawdzany, a `ensured` nie blokuje ponowienia po błędzie. Nowa migracja tworzy tabelę i oba indeksy. Jawny przebieg jednej migracji na lokalnej bazie przeszedł; schema readback potwierdził siedem kolumn i trzy indeksy. Log: `/private/tmp/cx-day281-schemat-od-zera-artefakty/r4-migration-only.log`, SHA-256 `962c19de7e5c6d8f0daf3a696e143b1b4b209b4f1be8277905673a3b88bc2500`.

## R5 — pełne odtworzenie po naprawie

Własny kontener został usunięty wraz z wolumenem i utworzony ponownie. Świeży pełny przebieg zastosował 883 migracje, w tym nową migrację, i zakończył sukcesem. Rejestracja przez realny `ApiGateway` na 5249 zwróciła HTTP `200` z `emailVerificationSent:true`. Readback wykazał użytkownika oraz jeden ważny, nieużyty token. Drugi pełny przebieg zgłosił `Applying migrations: 0`.

Artefakty: `r5-migrate-fresh.log` (`0f79607528aed81e48fcbc65b3a6675b44dba12e3f3f92fb51ad88f3a436d046`), `r5-registration-after.log` (`8903494c2bbda6730c1fbfbd29726b690c1bf7d8f5098c0ecade9bf92b49de7b`), `r5-migrate-second.log` (`4e465022de0a6c7a8d2e796aa3e1d16be83ba49d99a151180128cf868e18095a`).

Pułapki (a)–(e): użyto tego samego samodzielnego harnessu bez Vitest; komplet env wskazywał wyłącznie lokalną bazę. `DB_IDENTITY` potwierdził `127.0.0.1:6268/cx281`. Odpowiedź została uzyskana bez retry. Po odpowiedzi własny proces zakończono ręcznie, ponieważ otwarta pula DB utrzymywała event loop; nie zmienia to zapisanej odpowiedzi ani niezależnego readbacku.

## Pomiar nazw przypadków §0.4a

`przed-nazwy.txt` i `po-nazwy.txt` zawierają te same trzy pełne nazwy. `diff -u` nie zwrócił żadnej linii; żadna nazwa nie zniknęła ani nie została dodana. Oba pliki mają SHA-256 `6618352b19e28b16a142864cdbde0a81bda062a25f036484ab703873f988bade`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Dla wpisów oznaczonych `UNKNOWN` nie rozstrzygnięto nazwy tabeli ani migracji bez wykonania dynamicznego kodu.
- Pięć pozostałych plików z runtime `DATETIME` nie zostało wykonanych na ich realnych ścieżkach HTTP/jobów.
- 52 statycznie nazwane runtime DDL bez wykrytej migracji wymagają osobnych pomiarów osiągalności; inwentarz nie dowodzi, że każda ścieżka jest aktywna.

## Stan

R1–R6 wykonane. Gałąź oczekuje na niezależny odbiór nadzorcy; nie została scalona ani wdrożona.
