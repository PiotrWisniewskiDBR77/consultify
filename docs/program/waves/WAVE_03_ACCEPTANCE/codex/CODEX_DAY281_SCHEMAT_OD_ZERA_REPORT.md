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

## Twierdzenia niezweryfikowane

- Realna rejestracja przez `ApiGateway` przed naprawą — R3 jeszcze niewykonane.
- Idempotencja drugiego przebiegu po naprawie — R5 jeszcze niewykonane.
- Pełny rejestr tabel tworzonych poza migracjami — R2 w toku.

## Stan

R1 wykonane. R2–R6 pozostają otwarte.
