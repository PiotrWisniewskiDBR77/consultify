# CODEX DAY 279 — PRZELOT FUNKCJONALNY I ODCZYT NA ZIMNO

## Werdykt

**PARTIAL / EVIDENCE_MISSING dla G05 jako całości.** Zmierzono realnie 1/16 modułów. Organizacja przeżyła cold readback z bazy, ale `POST /api/auth/register` ma krytyczny błąd PostgreSQL po częściowym zapisie: proces kończy się na runtime DDL z typem `DATETIME` (`42704`). Pozostałych 15 modułów nie wywołano i mają uczciwy stan `PODEJRZENIE`.

Nie naprawiono żadnego znaleziska i nie zmieniono żadnego `MODULE_ACCEPTANCE.md`.

## Wejście i baza

Wynik markera i sanity, dosłownie:

```text
MARKER OK
eeb253c3ec13195a04b3848ef2566c5c07786e58
```

Tip uciekł o jeden commit instrukcji:

```text
d39eb9fd67 instrukcja: dyzur 279 - bramka G05 we wszystkich 16 modulach, POMIAR nie naprawa
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_279_PRZELOT.md
```

Dysk przed startem: 72 GiB wolne. Porty 6264, 5244, 5245 były wolne. Kontener: `cx-day279-pg`, obraz `pgvector/pgvector:pg16`, bind `127.0.0.1:6264`, baza `cx279`.

Pierwszy przebieg migracji zakończył się `✅ Postgres migrations complete`; drugi:

```text
Applying migrations: 0
✅ Postgres migrations complete
```

Pomiar tezy wejściowej: `G05 zamkniete w 0 modulach z 16`.

## R1-R2 — realny łańcuch

Łańcuch: realne HTTP → `ApiGateway.getInstance().initializeRoutes(app)` → `verifyToken` → PostgreSQL `127.0.0.1:6264/cx279` → nowy login / świeży JWT → nowa prośba z `Connection: close` → odczyt.

Efektywne środowisko wydrukowane przez harness:

```json
{
  "RUN_DB_TESTS": "1",
  "MOCK_DB": "false",
  "DB_TYPE": "postgres",
  "NODE_ENV": "test",
  "ENABLE_V8_GLOBAL": "true",
  "ENABLE_TEST_AUTH_BYPASS": "false",
  "RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE": "enforce"
}
```

Cold readback organizacji A:

```json
{"status":200,"id":"00f16ff2-c960-43ec-adc3-65ed2634818f","name":"Day279 Organization A 1788367026484"}
```

Kontrola negatywna tokenem organizacji B:

```json
{"status":403,"body":{"error":"Access denied"}}
```

### Krytyczne znalezisko rejestracji

Oba wywołania `POST /api/auth/register` utworzyły organizację i użytkownika, ale przed odpowiedzią proces padł:

```text
error: type "datetime" does not exist
code: 42704
server/src/services/emailVerificationService.ts:26-33
CREATE TABLE IF NOT EXISTS email_verification_tokens (... expires_at DATETIME NOT NULL ...)
```

To nie jest naprawione. Rekordy obu organizacji były następnie osiągalne legalnym `POST /api/auth/login`, a A wróciła realnym `GET /api/organizations/:orgId`.

## Pułapki (a)-(e)

- (a) `ENABLE_V8_GLOBAL=true` było jawnie w tej samej linii; nie uznano 404 za dowód.
- (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` było jawnie w tej samej linii.
- (c) Vitest nie był używany; harness asertował `DB_TYPE=postgres`, a log podał `DB_IDENTITY ... 127.0.0.1:6264/cx279`.
- (d) `ENABLE_TEST_AUTH_BYPASS=false`; kontrola tokenem B faktycznie przeszła przez autoryzację i dostała 403.
- (e) pomiar biegł samodzielnym `npx tsx`, przez produkcyjny Gateway. `RUN_DB_TESTS=1`; odpowiedź zapisu nie była uznana za wynik. Brak retry. Błąd 500/crash odczytano z logu procesu, bo Gateway nie montuje produkcyjnego error middleware z `index.ts`.

## Z30 — zero wysyłki

Dowody przed zapisem:

```text
BRAK ZMIENNYCH POCZTY
SELECT ... FROM settings WHERE key LIKE 'smtp%';
(0 rows)
BRAK DRENAZY W GATEWAY
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Zasięg nazwami (§0.4a)

Nie uruchamiano Vitest, ponieważ instrukcja zakazuje użycia go jako dowodu tego pomiaru. Nazwy scenariuszy standalone zapisano w artefaktach. `diff przed-nazwy.txt po-nazwy.txt` dodaje sześć nazw i nie usuwa żadnej. Są to nazwy scenariuszy harnessu, nie twierdzenie o sześciu testach Vitest.

## TWIERDZENIA NIEZWERYFIKOWANE

Nie wywołano realnie i nie wolno ich uznać za `PRZEŻYWA`: Wywiad, Narzędzia, Ocena, Inicjatywy, Realizacja, Moja praca, Spotkania, Wyniki, Finanse, Materiały, Audyty, Czat, Administracja, Ustawienia, Partner.

Nie wykonano pełnego negatywnego skanu Partnera, więc nie wpisano `BRAK ZAPISU`. Nie sklasyfikowano żadnego modułu `ZA FLAGĄ`, ponieważ nie potwierdzono miejsca odczytu flagi w realnym przebiegu.

## KOREKTY WOBEC INSTRUKCJI

1. Instrukcja wymaga dwóch pomyślnych organizacji przez `/register`. Pomiar wykazał, że trasa zapisuje rekord, ale zabija proces na nieprzenośnym runtime DDL. Kontynuowano bez zmiany produktu, używając legalnego logowania do zapisanych rekordów.
2. `JWT_SECRET=cx279-test-secret-do-not-reuse` z instrukcji jest raportowany przez walidator jako krótszy niż 32 znaki; w `NODE_ENV=test` konfiguracja kontynuuje. Nie zmieniono sekretu, aby zachować literalny komplet env.
3. Sekwencja commitów R1 i R2 została połączona w pierwszy bezpieczny commit harnessu, ponieważ pierwsza egzekucja R1 ujawniła crash przed możliwością zamknięcia oddzielnego punktu. Wynik i granica są jawne.

## Commity i zakres

- `a1fc79b0f4` — standalone harness R1/R2, wypchnięty na `github-backup` natychmiast po commicie.
- Pozostałe commity: patrz końcowy log gałęzi.

Jedyny kod wykonywalny dodany przez dyżur: `server/src/scripts/day279-przelot.ts`. Produkt nie został zmieniony.

## Artefakty

- `/private/tmp/cx-day279-przelot-artefakty/r1-r2-cold-readback.json`
- `/private/tmp/cx-day279-przelot-artefakty/register-postgres-failure.txt`
- `/private/tmp/cx-day279-przelot-artefakty/przed-nazwy.txt`
- `/private/tmp/cx-day279-przelot-artefakty/po-nazwy.txt`

SHA-256:

```text
7137f47693715000fdbf36e4f93af098d019409e8eaed131cd2227110e04f20b  r1-r2-cold-readback.json
fab5555bc608c81b7d6415c3ac4ddfb36a2207404d41c38050fd9e84a324c8e1  register-postgres-failure.txt
01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b  przed-nazwy.txt
c1f60851d3f9f4d3d87ee7869e5bb491bf3a6fc8f722c2604504aced2667468c  po-nazwy.txt
```
