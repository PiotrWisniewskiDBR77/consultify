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

## Korekty wobec instrukcji

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

## Twierdzenia niezweryfikowane

- Idempotencja drugiego przebiegu po naprawie — R5 jeszcze niewykonane.
- Dla wpisów oznaczonych `UNKNOWN` nie rozstrzygnięto nazwy tabeli ani migracji bez wykonania dynamicznego kodu.

## Stan

R1–R3 wykonane. R4–R6 pozostają otwarte.
