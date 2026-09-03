# CODEX DAY 291 — runtime dowody P0/P1

Data pomiaru: 2026-09-03. Gałąź: `codex/day291-runtime-dowody-p0p1-20260903`.

## R1 — środowisko

Stan: `PASS` dla lokalnego środowiska dowodowego. Użyto wyłącznie kontenera
`cx-day291-pg`, portu PostgreSQL `6295`, backendu `5260` i Vite `5261`.

### Marker — wynik dosłowny

```text
67d235cfa0 Merge agent/p0p1-rozliczenie-20260903: rozliczenie 121 pozycji P0/P1 (33 naprawione, 43 otwarte, 8 nieweryfikowalne, 1 zdezaktualizowana, 36 z rejestrow poza licznikiem)
MARKER OK
67d235cfa079d663ea87ddb46a167c0aa9d7ecab
```

`git status --short | head -3` nie wypisał żadnej linii.

Tip `github-backup/grafika/m03-20260902` był 12 commitów przed markerem; listę
commitów i 29 zmienionych ścieżek zmierzono przed utworzeniem środowiska.
Praca pozostała dokładnie na markerze zgodnie z DEC-2026-08-26-95.

### Migracje i baza

Pierwszy strict run bez `--safe` zakończył się:

```text
→ 20260812a_case_workspace_outbox_next_retry_at.sql
→ 20260813b_audits_source_classification_split.sql
→ 20260813c_method_core_roles_and_approvals.sql
→ init-pgvector.sql
✅ Postgres migrations complete
```

Drugi przebieg: `Applying migrations: 0` i `✅ Postgres migrations complete`.
Liczba plików w `server/migrations`: `1103`. Kanoniczny seeder Inicjatyw
utworzył lokalną bazę `consultify_w3_initiatives_owner_day291` z `886`
zastosowanymi migracjami, 6 personami, dwiema organizacjami i trwałym markerem
fixture `FINAL`. Runtime manifest potwierdził SHA markera, `migrationState: ok`,
`sqlMigrationState: ok`, backend 200, frontend 200 i `clientMarkerVerified: true`.

### Z30

`env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)"` zwróciło `BRAK ZMIENNYCH
POCZTY`. `Gateway.ts` nie zawiera startu drenażu. Po migracjach zapytanie do
`settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy. Runtime potwierdził
`DOTENV_DISABLED` po obu stronach i brak zakazanych kluczy w pięciu procesach.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane.

### Pomiar nazw testów PRZED

`tests/unit/initiatives/initiativeRecordCanon.test.ts`: 6/6 PASS. Pełne nazwy
są w `/private/tmp/cx-day291-runtime-dowody-artefakty/przed-nazwy.txt`.
Pakiet jest czysto statyczny (`RUN_DB_TESTS=0 MOCK_DB=true`); nie dowodzi
egzekucji DB ani auth i nie przechodzi przez pułapki (a)-(e).

### Korekty wobec instrukcji

Surowe `grep -c 'NIEWERYFIKOWALNE'` zwróciło `12`, nie `8`, ponieważ poza ośmioma
wierszami pozycji liczy również tekst i wiersze podsumowań. Lista identyfikatorów
z tabeli nadal zawiera dokładnie osiem pozycji wskazanych w zleceniu.

## R2 — ASM-OWN-001/002/003

Scenariusze źródłowe: `OWNER_FEEDBACK_REGISTER.md:10-43,102-151,207-240`
oraz `modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md:109-111`. Zmierzone przez
kanoniczny runtime, prawdziwy login OWNER, podpisany JWT,
`ApiGateway.initializeRoutes`, realny PostgreSQL i flagę V8 włączoną przez
kanoniczny bootstrap. `ENABLE_TEST_AUTH_BYPASS=false`; runtime pracował w
`NODE_ENV=development`, więc testowe samowyłączenia auth i Results nie miały
zastosowania.

| ID | HTTP / ciało | Zimny readback | Werdykt |
| --- | --- | --- | --- |
| ASM-OWN-001 | `GET /api/method/packs` → 200 `{"packs":[]}`; `GET /api/method/sessions` → 200, jawna pusta lista | osobny klient `pg`: `owner_sessions=0` | `NIE DOTYCZY KODU → G16`: route działa lokalnie; wcześniejsze proxy 404 jest rozjazdem wdrożenia. Pusty katalog w tej fixture nie dowodzi kompletności treści/licencji. |
| ASM-OWN-002 | `GET /api/method/sessions` → 200; deep-link do nieistniejącej sesji → 404 `Session not found` | `owner_sessions=0`; `foreign_sessions=0` | `NIE DOTYCZY KODU → G16` dla 404 proxy; fail-closed jest sprawny. Utworzenie nowej sesji nie było częścią fixture Inicjatyw i pozostaje niezmierzone. |
| ASM-OWN-003 | `GET /api/method/outputs` → 200 `{"outputs":[],"total":0,...}` | `owner_outputs=0` | `NIE DOTYCZY KODU → G16`: endpoint jest osiągalny; brak Output w tej fixture jest uczciwym stanem pustym, nie dowodem trwałości Assessment. |

Obcy OWNER otrzymał własną pustą listę sesji 200; nie zobaczył danych tenant-a
głównego. Artefakty: `evidence/runtime-p0p1-20260903/asm-*.txt` i
`asm-cold-readback.json`.

Gotowe zdania do rejestru:

- ASM-OWN-001: „Lokalny marker 67d235cfa0 wystawia `/api/method/packs` i
  `/sessions` przez realny Gateway/JWT/PG z HTTP 200; wcześniejsze 404 za proxy
  klasyfikujemy jako defekt wdrożenia do G16, nie kodu.”
- ASM-OWN-002: „Nieistniejąca sesja fail-closed daje jawne 404 `Session not
  found`; lokalny draft nie został uznany za serwerową sesję.”
- ASM-OWN-003: „`/api/method/outputs` lokalnie odpowiada 200, a osobny klient PG
  potwierdza 0 trwałych Output w użytej fixture; proxy 404 nie reprodukuje się.”
