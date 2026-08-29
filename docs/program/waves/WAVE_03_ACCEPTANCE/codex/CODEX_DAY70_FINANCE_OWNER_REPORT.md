# Dyżur 70 — Finanse — pakiet odbioru właściciela G07–G10

## Wynik

`PARTIAL / STOP MERYTORYCZNY` dla B.1 oraz `EVIDENCE_MISSING` dla B.2–B.3.
Dokładny PDF właściciela istnieje i przechodzi bramkę SHA-256, ale literalna
kolejność instrukcji tworzy i migruje `cx_day70`, a następnie uruchamia seeder,
który wymaga, by ta sama baza jeszcze nie istniała. Seeder zakończył się
`BLOCKED: target database already exists`; cold readback nie był zielony.
Zgodnie z §B.1 nie uruchomiono runtime'u ani macierzy zrzutów.

## Rodowód i §0.1

- Marker: `f21bc627ad9c30b5dcc33b07af6e259d22a3456f`.
- Gałąź: `codex/day70-finance-owner-20260829`.
- Pierwszy commit i natychmiastowy push `github-backup`:
  `6ef8c3f08ca60481639645b061a66d0450e6e3a8`.
- Worktree: `/private/tmp/cx-day70-finance` utworzony z bare-vaulta.
- Remote użyty do fetch/push: wyłącznie `github-backup`; nie użyto `--all`.
- Wolne miejsce przed startem: `18Gi` (próg STOP: poniżej `5 GB`).
- PostgreSQL: `cx-day70-pg`, `127.0.0.1:5942`, DB `cx_day70`, obraz
  `pgvector/pgvector:pg16`.
- Porty `5942` i `4640` przed startem: brak procesów nasłuchujących.
- Artefakty poza repo: `/private/tmp/cx-day70-artefakty`.
- Cleanup: własny kontener usunięto przez `docker rm -fv cx-day70-pg`;
  komenda wypisała `cx-day70-pg`. Po sprzątnięciu porty `5942` i `4640`
  ponownie nie miały procesu nasłuchującego. Baza była efemeryczna i została
  usunięta wraz z wolumenem; manifest dowodowy poza repo zachowano.

Wynik markera, dosłownie:

```text
MARKER OK
```

Wynik sanity, dosłownie:

```text
f21bc627ad9c30b5dcc33b07af6e259d22a3456f
```

`git status --short | head -3` nie wypisał żadnej linii.

Tip gałęzi instrukcji uciekł do przodu o dwa commity, co zgodnie z §0.1 nie
jest STOP-em:

```text
f824f55a9c docs(instrukcje): przenumerowanie 63/64 -> 69/70 (kolizja z istniejacymi dyzurami)
68bc2892e7 docs(instrukcje): dyzur 63 fala jezykowa + dyzur 64 Finanse wg szkieletu 02
```

Różnica nazw plików:

```text
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_69_FALA_JEZYKOWA.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_70_FINANSE_ODBIOR.md
```

## W1–W3 — stan wejściowy

```text
e993f390ccf5d67143b1076ef7b6d9eed23f234f1c29dc23892eeb57418e3c0e  /Users/piotrwisniewski/Developer/consultify-fixtures/finance-owner-source.pdf
31:const SOURCE_SHA = 'e993f390ccf5d67143b1076ef7b6d9eed23f234f1c29dc23892eeb57418e3c0e';
44:| G07 ... | `PARTIAL / OWNER_REPLAY_BLOCKED` ...
45:| G08 ... | `PARTIAL / EVIDENCE_MISSING` ...
46:| G09 ... | `PARTIAL / STOP` ...
47:| G10 ... | `PARTIAL / EVIDENCE_MISSING` ...
```

PDF i `SOURCE_SHA` są zgodne co do znaku. Stan G07–G10 odpowiada oczekiwaniu
instrukcji.

## Z30 — zero wysyłki

Przed pierwszym zapisem:

```text
BRAK ZMIENNYCH POCZTY
```

Po migracjach:

```text
 key | left
-----+------
(0 rows)
```

Skan `server/src/Gateway.ts` dla
`startNotificationOutboxDrainCron|outboxWorker|platformOutboxDrainCron` zwrócił
zero trafień.

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.**

## B.1 — migracje, seed i readback

Pierwszy przebieg repozytoryjnego migratora zakończył się:

```text
→ init-pgvector.sql
✅ Postgres migrations complete
```

Drugi przebieg był idempotentny:

```text
Applying migrations: 0
✅ Postgres migrations complete
```

Niezależny readback ledgera:

```text
 successful_migrations
-----------------------
                   863
(1 row)
```

Literalny seed z kompletem zmiennych w jednej linii, PDF z W1, loopback URL,
nowym manifestem, `FINANCE_OWNER_FIXTURE_CONFIRM=YES` i
`--confirm-db=cx_day70` zakończył się `exit 1`:

```text
Error: [W3 Finance fixture] BLOCKED: target database already exists
```

Obowiązkowy cold readback zakończył się `exit 1`:

```text
Error: [W3 Finance fixture] BLOCKED: cold readback requires the matching FINAL Finance receipt
```

Seeder pozostawił manifest `0600` w stanie
`FAILED_BEFORE_DURABLE_MARKER`:

- ścieżka: `/private/tmp/cx-day70-artefakty/finance-owner-fixture-manifest.json`;
- SHA-256: `a00e968265d6a4daef4b0e66483e1cfada80955581761997e249c2398a4f6ee3`;
- nie powstał FINAL receipt ani trwały marker własności.

### Pułapki §0.2d / Z33

- Migrator: `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres` i
  jawny loopback `DATABASE_URL` stały w tej samej linii. Drugi przebieg `0`
  oraz SQL do `cx_day70` dowodzą pracy na realnym PostgreSQL.
- Seeder: nie jest pakietem Vitest i nie montuje tras; pułapki (a), (b), (d)
  oraz (e) nie leżą na jego ścieżce. Pułapka (c) nie dotyczy procesu seedera,
  a bazę potwierdza jawny `FINANCE_OWNER_FIXTURE_DATABASE_URL` i błąd o
  istniejącej bazie.
- Nie uruchomiono żadnego pakietu jako dowodu HTTP/UI, więc nie przypisano
  zielonego wyniku bramkom `ENABLE_V8_GLOBAL`, `verifyToken` ani `v8OrgGate`.

## B.2–B.3 — zrzuty i ogląd

- Wymagany mianownik: `5 × 2 × 2 = 20`.
- Pliki PNG na dysku: `0`.
- Zrzuty zakwalifikowane w raporcie: `0 z 20`.
- Własna inspekcja obrazów: `N/A — nie powstał żaden obraz`.
- `NIEZWERYFIKOWANE`: język nagłówków, język wartości komórek, ucięcia,
  kolizje, surowe klucze/ID, wygląd pustego stanu, light/dark, pełny stan,
  realne logowanie, pięcioekranowa ścieżka i akceptacja właściciela.

Nie relabelowano pustego ekranu, API ani wcześniejszych zrzutów jako dowodu.

## Wynik G07–G10

| Gate | Wynik | Brak |
| --- | --- | --- |
| G07 | `PARTIAL / OWNER_REPLAY_BLOCKED` | FINAL fixture, realne logowanie i obejrzana karta właściciela |
| G08 | `PARTIAL / EVIDENCE_MISSING` | `0 z 20` wymaganych zrzutów |
| G09 | `PARTIAL / STOP` | zielony readback i uwierzytelnione przejście pięciu ekranów |
| G10 | `PARTIAL / EVIDENCE_MISSING` | light/dark × empty/full dla pięciu ekranów |

Akceptacji właściciela, gotowości release, stagingu ani produkcji nie
deklarowano.

## STOP — B.1 fixture

Rodzaj: MERYTORYCZNY

Powód: literalna baza `cx_day70` musi według §0.2c istnieć i być w pełni
zmigrowana przed seedem, lecz `seed()` odmawia każdej istniejącej bazy.

Licencja, którą sprawdziłem: §D pozwala zapisać wyłącznie ten raport i
`modules/10_FINANCE/MODULE_ACCEPTANCE.md`; seeder jest jawnie tylko do odczytu
na mocy Z12/Z40. Wynik: nie zmieniono skryptu, `SOURCE_SHA`, migracji ani kodu.

Dowód: §0.2c linie 245–259 instrukcji tworzą `POSTGRES_DB=cx_day70` i migrują
`cx_day70`; `server/scripts/seed-wave3-finance-owner-review.ts:269` odmawia,
gdy `databaseExists(...)` jest prawdą; rzeczywisty wynik to
`BLOCKED: target database already exists`.

Co dostarczyłem ZAMIAST zmiany: pomiar W1–W3, dwukrotny migrator, niezależny
ledger `863`, dowody Z30, czerwony seed, czerwony readback, manifest failure i
aktualizację bramek bez zawyżenia.

Co zrobiłbym, gdyby zapadła decyzja X: po wydaniu niesprzecznej procedury
utworzenia bazy wykonałbym seeder bez zmiany jego fail-closed guardów. Dopiero
FINAL receipt i zielony cold readback odblokowałyby realne logowanie oraz
macierz 20 zrzutów.

Rekomendacja dla nadzorcy: ujednolicić kontrakt instrukcji i seedera w jednym
z dwóch kierunków: albo kontener startuje z bazą administracyjną, a seeder
tworzy `cx_day70`, albo istniejący seeder przyjmuje wyłącznie pustą, już
zmigrowaną bazę bez próby `CREATE DATABASE`. Osobno zaktualizować twardy
readback `834`, ponieważ marker ma zmierzone `863` udane migracje.

Stan: zacommitowano wyłącznie dokumentację na gałęzi dyżuru.

Czy kontynuowałem pozostałe pozycje: TAK w granicach bezpiecznych pomiarów i
raportu; NIE dla screenshotów, ponieważ §B.1 dosłownie zabrania przejścia dalej
bez zielonego readbacku.

## Korekty wobec instrukcji

1. Konflikt procedury bazy:
   - §0.2c(A): `POSTGRES_DB=cx_day70`, następnie dwa przebiegi migratora na
     `.../cx_day70`;
   - `server/scripts/seed-wave3-finance-owner-review.ts:269`:
     `if (await databaseExists(admin, ctx.databaseName)) fail('target database already exists')`.
   Bezpieczniejsza interpretacja: zachowano literalną kolejność instrukcji i
   guard seedera; nie usunięto bazy ani manifestu, by próbować wygodniejszej
   procedury.
2. Drugi konflikt nazwy: §B.1 wymaga `cx_day70`, lecz wewnętrzny
   `run-wave3-finance-owner-review.ts:30-32` dopuszcza tylko
   `consultify_w3_finance_owner_*`. Ten guard nie został osiągnięty z powodu
   wcześniejszego fail-closed; nie zmieniono nazwy ani kodu.
3. Rozbieżność pomiarowa, nie sprzeczność: `coldReadback()` oczekuje dokładnie
   `834` migracji (`seed-wave3-finance-owner-review.ts:202`), a świeży marker
   ma `863`. Wartością wiążącą w tym raporcie jest SQL `863`.
4. Dokument odwołuje się do nieobecnych §0.3, §0.4a, tabeli licencji i §R.1.
   Zastosowano ostrzejsze ograniczenie §D: zapis tylko dwóch dokumentów,
   żadnych testów ani kodu. Zasięg testów wynosi uczciwie: `0` pakietów, bo
   dyżur dowodowy nie zmienia produktu, a B.1 nie uzyskało zielonego readbacku.

## Kryteria K1–K5

- K1: `FAIL` — readback czerwony.
- K2: `PASS` — raport `0`, dysk `0` PNG.
- K3: `N/A / EVIDENCE_MISSING` — nie powstał żaden zrzut; sekcja
  NIEZWERYFIKOWANE jest jawna.
- K4: `PASS` — po pierwszym commicie komenda wypisała dosłownie:

  ```text
  docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY70_FINANCE_OWNER_REPORT.md
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/MODULE_ACCEPTANCE.md
  ```

  Nie ma plików z `src/` ani `server/src/`.
- K5: `PASS` dla prawdomówności rejestru — G07–G10 pozostają `PARTIAL`.

## Pliki i testy

- Zmienione pliki repo: wyłącznie ten raport i
  `modules/10_FINANCE/MODULE_ACCEPTANCE.md`.
- Kod produktu, testy, migracje, flagi i locale: bez zmian.
- Pakiety Vitest uruchomione jako dowód: `0`.
- Dowód mutacyjny: `N/A` — niczego nie oznaczono `FIXED` ani `VERIFIED`.
- `--retry=0`: `N/A` — nie uruchomiono Vitest.

## Wznowienie po DEC-2026-08-29-264 — poprawka wydania

### Rozstrzygnięcie

`STOP MERYTORYCZNY` pozostaje w mocy, ale pierwszy konflikt został usunięty.
Poprawiona procedura została wykonana dosłownie: kontener wystartował wyłącznie
z administracyjną bazą `postgres`, potwierdzono brak `cx_day70`, nie uruchomiono
ręcznie `migrate.postgres.ts`, po czym uruchomiono pojedynczy `seed` z nową
ścieżką manifestu.

Tip poprawionej instrukcji: `85619fcb9e`; marker nadal zwrócił `MARKER OK`.
Przed wznowieniem worktree był czysty, porty `5942` i `4640` były wolne, a
`/private/tmp/cx-day70-artefakty/finance-owner-fixture-manifest-resume-1.json`
nie istniał. Stary manifest pierwszej próby zachowano bez zmian.

### B.1 — rzeczywisty wynik poprawionej procedury

Przed seedem katalog PostgreSQL potwierdził brak bazy docelowej:

```text
 datname
---------
(0 rows)
```

Seeder wykonał `CREATE DATABASE`, zapisał trwały marker oraz uruchomił pełne
migracje, lecz zakończył się `exit 1`:

```text
Error: [W3 Finance fixture] BLOCKED: full-chain harness failed with status 1
```

Manifest `0600` zachował dokładną przyczynę:

```text
ownershipState: FAILED_AFTER_DURABLE_MARKER
databaseName: cx_day70
Error: Database name must match consultify_w3_finance_owner_*
```

Dowody po awarii:

```text
fixture_id: W3-FINANCE-OWNER-v1
database_name: cx_day70
successful_migrations: 863
```

- Manifest:
  `/private/tmp/cx-day70-artefakty/finance-owner-fixture-manifest-resume-1.json`.
- SHA-256 manifestu:
  `f9018d2855106004915140270236a080d7dba6c31abf0dedfe59164cebc08f71`.
- FINAL receipt: nie powstał.
- Readback: nie uruchomiono, ponieważ seed nie zakończył się sukcesem i manifest
  nie ma stanu FINAL.
- Zrzuty: nadal `0 z 20`; §B.1 nie zezwala przejść dalej bez zielonego
  readbacku.

### STOP — B.1, wznowienie

Rodzaj: MERYTORYCZNY

Powód: wiążący URL i `--confirm-db` wymagają nazwy `cx_day70`, natomiast
wewnętrzny harness wywołany przez seeder odrzuca każdą nazwę, która nie pasuje
do `consultify_w3_finance_owner_*`.

Licencja, którą sprawdziłem: §D oraz Z12/Z40 — seeder, runner, `SOURCE_SHA`,
migracje i kod są tylko do odczytu. Wynik: zmieniono wyłącznie raport i
`MODULE_ACCEPTANCE.md`.

Dowód: §B.1 wiersz `FINANCE_OWNER_FIXTURE_DATABASE_URL` oraz argument
`--confirm-db=cx_day70`; `server/scripts/run-wave3-finance-owner-review.ts:30-33`
sprawdza prefiks i rzuca `Database name must match consultify_w3_finance_owner_*`.
Rzeczywisty manifest ma `FAILED_AFTER_DURABLE_MARKER` i ten sam błąd.

Co dostarczyłem ZAMIAST zmiany: realny przebieg poprawionej procedury, dowód
utworzenia bazy i markera, ledger `863`, manifest błędu, kontraktowy reset z
niezależnym potwierdzeniem braku bazy oraz zachowane `0/20`.

Co zrobiłbym, gdyby zapadła decyzja X: po ujednoliceniu jednej wiążącej nazwy
bazy ponowiłbym seed z kolejną nową ścieżką manifestu. Dopiero FINAL receipt i
zielony readback odblokowałyby realne logowanie oraz macierz zrzutów.

Rekomendacja dla nadzorcy: poprawić u źródła wyłącznie kontrakt nazwy — albo
§B.1 ma używać nazwy zgodnej z `consultify_w3_finance_owner_*`, albo runner ma
zaakceptować dokładne `cx_day70`. Nie zmieniać `SOURCE_SHA` ani nie omijać
loopback/manifest/marker guards.

Stan: dokumentacja zaktualizowana na gałęzi dyżuru; kod niezmieniony.

Czy kontynuowałem pozostałe pozycje: NIE dla B.2–B.3, ponieważ poprawiona
instrukcja dosłownie klasyfikuje ponowną odmowę seedera jako STOP, a §B.1
zabrania przejścia bez zielonego readbacku.

### Cleanup wznowienia

Kontraktowy `reset` użył dokładnie dopasowanego manifestu i trwałego markera:

```json
{"fixtureId":"W3-FINANCE-OWNER-v1","databaseName":"cx_day70","dropped":true,"catalogAbsent":true}
```

Niezależny odczyt katalogu zwrócił `0 rows`. Następnie własny kontener usunięto
przez `docker rm -fv cx-day70-pg`; porty `5942` i `4640` są wolne. Manifesty
dowodowe poza repo zachowano.

## Wznowienie po DEC-2026-08-29-269 — poprawka wydania nr 2

### Rozstrzygnięcie trzeciej próby

`STOP MERYTORYCZNY`. Poprawka nr 2 usunęła konflikt nazwy i trzeci seed
przeszedł cały harness danych, ale kanoniczny cold readback odrzucił aktualną
liczbę migracji. Nie uruchomiono runtime'u ani zrzutów, ponieważ wymagany
manifest `resume-2` nie osiągnął stanu FINAL.

Tip poprawionej instrukcji: `a4e3312908`; marker: `MARKER OK`. Przed próbą
worktree był czysty, porty `5942`, `4640`, `4641` oraz chronione
`3940`, `3941`, `4363`, `4364` były wolne. Oba poprzednie manifesty `0600`
istniały i zostały zachowane; `resume-2` nie istniał.

Wiążące wartości użyte dosłownie:

```text
database: consultify_w3_finance_owner_day70
URL: postgresql://postgres:cx@127.0.0.1:5942/consultify_w3_finance_owner_day70
--confirm-db=consultify_w3_finance_owner_day70
manifest: /private/tmp/cx-day70-artefakty/finance-owner-fixture-manifest-resume-2.json
```

Kontener wystartował z `POSTGRES_DB=postgres`; przed seedem katalog zwrócił
`0 rows` dla bazy docelowej. Nie uruchomiono ręcznie migratora.

### Dokładny błąd B.1

Seeder zakończył się `exit 1`:

```text
Error: [W3 Finance fixture] BLOCKED: cold readback mismatch: {"migrations":863,"approved_versions":5,"statements":6,"source_receipts":6,"baseline_contexts":1}
```

Źródło błędu:

- `server/scripts/seed-wave3-finance-owner-review.ts:238` wymaga
  `Number(readback.migrations) !== 834` jako warunku błędu;
- `server/scripts/seed-wave3-finance-owner-review.ts:244` emituje dokładny
  `cold readback mismatch`;
- rzeczywisty ledger świeżo zmigrowanej bazy wynosi `863`;
- pozostałe kardynalności są dokładnie oczekiwane: 5 approved versions,
  6 statements, 6 source receipts i 1 baseline context.

Kanoniczny manifest:

- ścieżka:
  `/private/tmp/cx-day70-artefakty/finance-owner-fixture-manifest-resume-2.json`;
- tryb: `0600`;
- SHA-256: `c78798a62ae342176666a3e0851d9276d6f5a506584f12216c6b165208bc125c`;
- stan: `FAILED_AFTER_DURABLE_MARKER`;
- baza: `consultify_w3_finance_owner_day70`.

Harness pozostawił także pomocniczy manifest wygenerowanych danych:

- `/private/tmp/cx-day70-artefakty/finance-owner-fixture-manifest-resume-2.json.generated-25661`;
- tryb `0600`, SHA-256
  `1d63fe955072d55a324fc37767cbf21a81934f8d339dbad13649d166a0f96b7e`;
- zawiera 6 statements i pięć workspace'ów: statement, baseline, prediction,
  valuation, analysis.

Pomocniczego manifestu nie użyto do adopcji runtime'u: §B.1 wiąże dokładną
ścieżkę `resume-2`, a kanoniczny seeder nie ukończył własnego cold readbacku
ani nie przepisał FINAL receipt. Użycie pliku `.generated-*` byłoby obejściem
bramki i relabelowaniem nieukończonego wyniku.

### STOP — B.1, trzecia próba

Rodzaj: MERYTORYCZNY

Powód: aktualny marker tworzy 863 udane migracje, a cold readback seedera ma
historyczny twardy mianownik 834 i odrzuca poza tym poprawny fixture.

Licencja, którą sprawdziłem: §D oraz Z12/Z40 — seeder, jego cold readback,
migracje i `SOURCE_SHA` są tylko do odczytu. Wynik: nie zmieniono kodu ani
bramki `834`.

Dowód: `seed-wave3-finance-owner-review.ts:238,244` oraz dokładny komunikat
zawierający `migrations:863` i prawidłowe `5/6/6/1`.

Co dostarczyłem ZAMIAST zmiany: trzeci realny seed, pełny fixture danych,
niezależny ledger, oba manifesty `0600` z hashami, brak adopcji niekanonicznego
receipt, marker-bound reset i zachowane uczciwe `0/20`.

Co zrobiłbym, gdyby zapadła decyzja X: po aktualizacji wiążącego kontraktu
migracji w seederze ponowiłbym seed z kolejną nową ścieżką manifestu. Dopiero
kanoniczny FINAL receipt i zielony `readback` pozwolą uruchomić
`start-wave3-owner-runtime.mjs` na `4640/4641` oraz realne logowanie.

Rekomendacja dla nadzorcy: zaktualizować lub wyprowadzić z bieżącego ledgera
twarde `834` w `coldReadback()` oraz zwracaną wartość `migrations: 834` na
liniach 238 i 247. Zachować kardynalności 5/6/6/1 i wszystkie guardy źródła,
markera, loopback oraz FINAL receipt.

Stan: zacommitowano wyłącznie dokumentację na gałęzi dyżuru.

Czy kontynuowałem pozostałe pozycje: NIE. §B.1 wymaga zielonego readbacku,
a K3 zabrania substytutu runtime'u, renderu bez stylów i obejścia logowania.

### Cleanup trzeciej próby

Kontraktowy reset, związany dokładnym markerem i manifestem, zwrócił:

```json
{"fixtureId":"W3-FINANCE-OWNER-v1","databaseName":"consultify_w3_finance_owner_day70","dropped":true,"catalogAbsent":true}
```

Niezależny katalog zwrócił `0 rows`. Własny kontener usunięto przez
`docker rm -fv cx-day70-pg`; wszystkie porty `5942`, `4640`, `4641`, `3940`,
`3941`, `4363`, `4364` są wolne. Trzy kanoniczne manifesty STOP oraz pomocniczy
manifest `.generated-*` zachowano poza repo jako dowody.
