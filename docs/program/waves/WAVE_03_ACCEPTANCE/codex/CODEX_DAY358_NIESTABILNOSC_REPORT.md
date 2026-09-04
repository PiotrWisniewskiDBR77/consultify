# CODEX DAY 358 — NIESTABILNOŚĆ BLOKU 3

## Werdykt

**Przyczyna: `server/src/database/PostgresDatabase.ts:1570-1573` — dziesięć kolejnych przebiegów bez zmiany wyniku, dowód mutacyjny w obie strony w `evidence/g19/day358/`.**

Równoległe forki Vitest uruchamiały jednocześnie runtime'owy `initDb()` na tej samej, już zmigrowanej bazie. Nieatomowe sekwencje „sprawdź → dodaj” oraz równoległe DDL kolidowały w katalogu PostgreSQL. Jedna zmiana serializuje cały `initDb()` między procesami advisory lockiem na dedykowanym połączeniu i zawsze zwalnia połączenie w `finally`.

## Stan wejściowy

```text
29fcbd4de20ca26d2febc50d9455128cab47ffce
MARKER OK
git status --short: <pusto>
```

Marker jest przodkiem tipa. Tip odszedł do przodu wyłącznie o instrukcje 351–358, ich źródła i korektę szkieletu Z29; pracę rozpoczęto dokładnie z markera. Wolne miejsce: 25 GiB. Porty 6417 i 5557 były wolne.

Migracje: pierwszy przebieg zakończył się `Postgres migrations complete`; tabela `schema_migrations` zawierała 894 wpisy. Drugi przebieg: `Applying migrations: 0`, exit 0.

## R1 — macierz po pełnych nazwach

Pełna macierz 18 × 10: `evidence/g19/day358/r1-macierz.md`.

- 01: 12 GREEN / 6 RED.
- 02–10: 18 GREEN / 0 RED.
- Rdzeń RED 10/10: brak.
- Pierścień mieszany: day274 ×1, day275 ×1, day276-deck ×2, day277 ×2.
- day276-workbook ×2: GREEN 10/10.

Podział autora „rdzeń 4 + pierścień 4” został obalony. Domniemany rdzeń day277 był zielony 9/10, a workbook był zielony 10/10. H4 potwierdzono dla wszystkich sześciu przypadków mieszanych: czerwony pierwszy przebieg był szybszy niż mediana zielonych.

## R2 — treść 500 i kandydaci

Dosłowna treść istotnych błędów znajduje się w `evidence/g19/day358/r2-tresc-500.txt`:

```text
column "resource_tools" of relation "initiatives" already exists
code 42701
at ensureColumn (server/src/database/PostgresDatabase.ts:2666:9)
at initDb (server/src/database/PostgresDatabase.ts:2675:5)

duplicate key value violates unique constraint "pg_class_relname_nsp_index"
code 23505
Key (relname, relnamespace)=(idx_milestones_status, 2200) already exists.
at initDb (server/src/database/PostgresDatabase.ts:2777:5)

Key (relname, relnamespace)=(idx_initiative_dependencies_to, 2200) already exists.
at initDb (server/src/database/PostgresDatabase.ts:2804:5)
```

HTTP day277 w przebiegu R1 miał status 500, body `{}`, text `"{}"`; rzeczywisty komunikat i stos były w logu serwera. Pełny log: `/private/tmp/cx-day358-niestabilnosc-artefakty/r2-verbose.log`, SHA-256 `f362de893798173b30e92de94bf7080e8958aff0f42da300100714485de5ca4d`.

Tabela dowodów i werdyktów: `evidence/g19/day358/r2-kandydaci.md`. Potwierdzono kolizję równoległego `initDb()` oraz konieczność równoległości; obalono defekt wewnętrzny day277, wyciek połączeń (szczyt 16/100), losowanie kolejności plików i `beforeEach`. Zegar/TZ pozostał nierozstrzygnięty, ponieważ R2.1 wskazał przyczynę i zgodnie z instrukcją przeszedłem do R3.

## R3 — jedna zmiana i para mutacyjna

Zmiana: `server/src/database/PostgresDatabase.ts:1570-1573,3880-3883`.

- Mutacja bez locka, świeża baza: 01 = 12/18, 02–10 = 18/18; niestabilność wróciła.
- Przywrócenie przez `cp`, świeża baza: 10/10 przebiegów = 18/18.
- `diff -u przed-nazwy.txt po-nazwy.txt`: pusty.
- JSON-y obu połówek i opis: `evidence/g19/day358/r3-*` oraz `po-naprawie-*.json`.

## H1–H7

| Teza | Werdykt | Dowód |
|---|---|---|
| H1: 12/18 nie było trzecim wynikiem | POTWIERDZONA | Cztery historyczne JSON-y mają 12 suit, 18 testów i 6 wpisów; 12 nie jest liczbą PASS. |
| H2: rdzeń 4 + pierścień 4 | OBALONA | Macierz R1: brak rdzenia; sześć mieszanych, workbook 10/10 GREEN. |
| H3: rdzeń to realny defekt | OBALONA | day277 był GREEN 9/10 bez zmiany kodu. |
| H4: RED szybki / GREEN wolny | POTWIERDZONA | Czasy w `r1-macierz.md`. |
| H5: kolejność plików nie jest przyczyną | POTWIERDZONA | server config nie ma shuffle; kolejność nie jest losowana. |
| H6: beforeEach nie jest przyczyną | POTWIERDZONA | grep: zero trafień; pliki day27x używają beforeAll i randomUUID. |
| H7: brakowała treść 500 | POTWIERDZONA I UZUPEŁNIONA | Log verbose ujawnił 42701/23505 i dokładne miejsca. |

## Zasięg i pułapki §0.2e

Pakiety R1, R2 parallel/no-parallel, izolowany day277 oraz R3 uruchamiano z cwd `server/`, `server/vitest.config.ts`, `--retry=0` i kompletem env w tej samej linii: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=...:6417/cx358 JWT_SECRET=...`. Tym wyłączono pułapki (a)–(d). Pułapkę (e) wyłączono przez sprawdzanie `numTotalTests=18` w każdym JSON-ie i porównanie `fullName`; `przed-nazwy.txt` i `po-nazwy.txt` są identyczne.

## Z30 — brak wysyłki

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Korekty wobec instrukcji

- Słowniki na markerze mają `pl 35199`, `en 33066`, a nie 35198/33065. Nie zmalały.
- Z29 zawiera historycznie nieaktualne uzasadnienie `retry: CI ? 3 : 1`; pomiar potwierdził `vitest.config.ts:339 retry: 0` i zero trafień w `server/vitest.config.ts`.
- Kontrola wyciszeń z instrukcji zgłasza istniejące na markerze `it.fails` w day274 oraz wymagane `retry: 0` w plikach testowych. Nie są zmianą dyżuru; day277 po diagnostyce przywrócono do stanu markera.

## Konfiguracje i bramki końcowe

```text
git diff --stat -- vitest.config.ts server/vitest.config.ts
<pusto>

pl 35199
en 33066
focus-canon=0
list-canon=0
artefakt=0
reach=0
```

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano macierzy TZ=UTC/Europe/Warsaw po znalezieniu przyczyny w R2.1.
- Nie wykonano osobno 10 przebiegów każdego z pozostałych pięciu plików; day277 wykonano 5 razy, a pełny pakiet bez równoległości 10 razy.
- Nie jest dowiedzione, że każda możliwa równoległa sekwencja DDL poza Blokiem 3 została pokryta; dowód obejmuje badany Blok 3 i wskazane błędy.

## CO NADAL WYMAGA OSOBNEGO ZLECENIA

- Rozważyć usunięcie runtime'owego DDL na rzecz wyłącznego łańcucha migracji; obecna poprawka serializuje istniejący mechanizm, ale nie zmniejsza jego promienia ani czasu startu.
- Osobno skorygować generator kontroli wyciszeń, który traktuje wymagane `retry: 0` i zastane `it.fails` jako naruszenie.

## PYTANIA DO WŁAŚCICIELA

Nie mam zastrzeżeń.

## Granica dowodu

Żadna liczba z Bloku 3 uzyskana w tym dyżurze nie jest podstawą do podniesienia wiersza `G19` w żadnym `MODULE_ACCEPTANCE.md`.

