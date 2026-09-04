# CODEX DAY355 — FINANCE 403

Stan: **R1–R2 zakończone; R3 zatrzymane merytorycznie; R4–R5 niewykonane**.

## Baza i warunki wejściowe

- Marker: `c0f690bae36a386de27f1a349fbb9674ec03c693`; wynik: `MARKER OK`.
- `rev-parse HEAD`: `c0f690bae36a386de27f1a349fbb9674ec03c693`.
- `status --short | head -3`: pusty.
- Przy starcie: 36 GiB wolnego; porty `6414` i `5554` wolne; brak kontenera `cx-day355-pg`.
- Tip `github-backup/grafika/m03-20260902` uciekł do przodu; zgodnie z DEC-2026-08-26-95 pracuję dokładnie z markera. Lista commitów i plików rozjazdu została zmierzona w logu startowym.

## R0 — zasady twarde

Przeczytałem zasadę pary dowodów: obcy bez aktywnego członkostwa ma dostać `403 ORG_MEMBERSHIP_REVOKED`, a właściciel z `ACTIVE` ma dostać `200`/`201`.

Przeczytałem zasadę jednej przyczyny: nie będę naprawiał 114 przypadków pojedynczo; jeśli pomiar pokaże wiele rodzin, zapiszę je jako wynik.

Przeczytałem zasadę porównań po pełnych nazwach: liczby są mianownikiem, a dowodem różnicy jest lista `fullName` i jej diff.

## R1 — odtworzenie czerwieni po nazwach

Własny odczyt obu artefaktów daje po 277 testów ogółem, 143 zaliczone i 114 czerwonych. Pliki `evidence/g15/day355/przed-nazwy.txt` i `po347-nazwy.txt` zawierają po 114 pełnych nazw z prefiksem pliku. `diff -u` jest pusty (`rc=0`), więc dyżur 347 nie zmienił zbioru czerwieni Finansów.

| Kubełek po treści komunikatu | Liczba |
| --- | ---: |
| `expected 403 to be X` | 59 |
| `createArtifactViaHttp failed: 403 ... ORG_MEMBERSHIP_REVOKED` | 20 |
| `TypeError` / `undefined` | 31 |
| reszta | 4 |
| **Suma** | **114** |

Kaskada 51 przypadków jest potwierdzona na poziomie komunikatów: 20 razy przygotowanie danych kończy się `createArtifactViaHttp failed: 403 ... ORG_MEMBERSHIP_REVOKED`, po czym 31 przypadków kończy się `TypeError: Cannot read properties of undefined`. To skutki wcześniejszej odmowy przygotowania danych, nie 51 niezależnych defektów produktu.

### Świadkowie różnicy — korekta tezy instrukcji

Artefakt JSON nie pokazuje 10 przechodzących przypadków `compare` ani 6 przechodzących `comments`. Pokazuje odpowiednio 7 `failed` + 10 `skipped` oraz 18 `failed` + 6 `skipped`. Wszystkie rzekomo „przechodzące” nazwy są zagnieżdżone w blokach: `the other five Compare axes — versions / entities / scenarios / valuation-methods / actual-vs-forecast` oraz `search-by-cell + changed-cells`. Na podstawie artefaktu nie wolno nazwać ich PASS; są pominięte po awarii fazy przygotowania. To obala opis autora `10/17 PASS` i `6/24 PASS`; przyczyna skipów będzie zweryfikowana w żywym przebiegu R2.

## Korekty wobec instrukcji

- `evidence/g15/day347/*.json`: własny pomiar **26**, instrukcja: 20.
- Raport 347 zawiera **2** trafienia `ORG_MEMBERSHIP_REVOKED` (wiersze 43 i 87), instrukcja: jedno.
- Liście słowników na markerze: **pl 35199, en 33066**, instrukcja: 35198 / 33065.
- Świadkowie częściowi w artefakcie: `compare` 7 failed + 10 skipped, `comments` 18 failed + 6 skipped; nie 10 i 6 PASS.
- Pozostałe bezpieczniki wejściowe: focus=0, list=0, artefakt=0, reach=0.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie udowodniono wymaganej pary przez realny `ApiGateway`; zielona para istniejąca w pakiecie `financeValue.membershipGate` montuje router bezpośrednio.
- Nie udowodniono mutacyjnie warunku statusu `ACTIVE`: zamówiona mutacja pozostała zielona.
- Nie wykonano kwalifikowanego R4: próba katalogowa miała inny mianownik niż artefakt 336 i nie jest porównaniem.

## CO NADAL WYMAGA OSOBNEGO ZLECENIA

Nie wykazano realnego defektu produktu w żadnym z 12 plików. Osobnego zlecenia wymaga natomiast luka dowodowa: samowystarczalny kontrakt przez realny `ApiGateway`, który broni zarówno braku wiersza, jak i statusu `REVOKED`, oraz odtwarzalna fixture dla `day116-approved-valuation-wacc-conflict.realpg.test.ts`.

## PYTANIA DO WŁAŚCICIELA

Czy właściciel zatwierdza osobny dyżur na nowy kontrakt `ApiGateway` dla statusu `REVOKED` oraz kanoniczny seed fixture `day116`? Bez tego nie ma uczciwej podstawy do zastosowania rodzinnej zmiany w 12 plikach ani do wpisu `FIXED`.

## R2 — przyczyna źródłowa i podział

Hipoteza autora jest **potwierdzona pomiarem**, z jednym ważnym doprecyzowaniem FK. Na żywym PostgreSQL pakiet `artifacts-lifecycle-compute` dał 15 total / 15 failed bez seedu, a po dodaniu wzorca użytkownik + członkostwo `ACTIVE` dał 15 total / 15 passed / 0 failed. Sam `INSERT organization_members` bez użytkownika nie jest wykonalnym wariantem: PostgreSQL zatrzymuje `beforeAll` na `organization_members_user_id_fkey`, a wszystkie 15 przypadków raportuje jako skipped. Kontrola `valuation.routes` pozostała 15/15 PASS przed i po.

Przyczyna źródłowa jest w `server/src/middleware/auth.middleware.ts:1901-1911`: zapytanie `SELECT status FROM organization_members WHERE user_id = ? AND organization_id = ?`, warunek `!!membership && normalizeMembershipStatus(membership.status) === 'ACTIVE'`, a jego niespełnienie zwraca `403` z kodem `ORG_MEMBERSHIP_REVOKED`.

Ścieżka produktu istnieje. Rejestracja użytkownika zapisuje członkostwo `ACTIVE` przez `POST /auth/register` w `server/src/routes/auth.routes.ts:1897-1903`; tworzenie organizacji zapisuje właściciela `ACTIVE` w `server/src/services/organizationService.ts:247-255`; dodanie członka zapisuje `ACTIVE` w `server/src/services/organizationService.ts:356-362`. Badane testy tworzą sztuczny kontekst użytkownika/organizacji, lecz pomijają tę produkcyjną precondycję. Dlatego wszystkie 114 czerwieni klasyfikuję jako artefakt pomiaru, a nie dowód defektu produktu.

| Plik | Czerwieni | Klasyfikacja | Dowód |
| --- | ---: | --- | --- |
| `approveRbacGate.pg.test.ts` | 20 | ARTEFAKT | produkcyjny register/add-member zapisuje `ACTIVE`; fikstura nie |
| `comments.routes.pg.test.ts` | 18 | ARTEFAKT | j.w. |
| `saved-views.routes.pg.test.ts` | 17 | ARTEFAKT | j.w. |
| `artifacts-lifecycle-compute.routes.pg.test.ts` | 15 | ARTEFAKT | żywy A/B: 15 FAIL → 15 PASS po wzorcu user+membership |
| `valuation-cross-tenant.routes.pg.test.ts` | 11 | ARTEFAKT | produkcyjny register/add-member zapisuje `ACTIVE`; fikstura nie |
| `pkg-b2-cross-tenant.routes.pg.test.ts` | 9 | ARTEFAKT | j.w. |
| `compare.routes.pg.test.ts` | 7 | ARTEFAKT | j.w. |
| `valuation-b3-review.routes.pg.test.ts` | 6 | ARTEFAKT | j.w. |
| `crosscutting.routes.pg.test.ts` | 5 | ARTEFAKT | j.w. |
| `models.routes.pg.test.ts` | 3 | ARTEFAKT | j.w. |
| `valuation-independent-verifier.pg.test.ts` | 2 | ARTEFAKT | j.w. |
| `day116-approved-valuation-wacc-conflict.realpg.test.ts` | 1 | ARTEFAKT | j.w. |
| **Suma** | **114** | **114 artefakt / 0 realny defekt / 0 nieorzeczone** | suma sprawdzona |

Pełna tabela 28 plików, z mianownikiem, czerwieniami i obecnością seedu, jest w `evidence/g15/day355/rodzina-28.md`.

### Artefakty R2 poza repo

- `r2-artifacts-before.json`: 15/0/15, SHA-256 `8b09e459637d04b58c4b24ee9a6e126068c96364a5d49eb9c64fd351aa3ec7c3`.
- `r2-artifacts-after-seed.json`: 15/15/0, SHA-256 `2bddf26041a9cced68179ef4250d8276ac5bb2e07b5a653cfcc74165e7cc3f1a`.
- `r2-valuation-before.json`: 15/15/0, SHA-256 `8c2550f1b44a32b41d7659c46314e92f29e9f76adabc72539233b1d9ff313b9e`.
- `r2-valuation-after.json`: 15/15/0, SHA-256 `e3bcd8e074278361490113d9033702bc89196e7cccf0af728f4411c840bdbe46`.
- Migracje: drugi przebieg `Applying migrations: 0`, `rc=0`; logi SHA-256 `4ded9a05...` i `14afcb18...`.

### §0.2e — pułapki przebiegów R2

Oba pakiety biegły z `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, `MOCK_DB=false`, `DB_TYPE=postgres`, jawnym `DATABASE_URL` do `127.0.0.1:6414/cx355` i `--retry=0`. Log połączenia potwierdził `DB_IDENTITY ... 127.0.0.1:6414/cx355`. Pułapka (e) dotyczy pakietu artifacts: pierwotne `403` pochodziło z braku członkostwa; A/B je usunął. Pakiet valuation stanowi kontrolę z kompletnym seedem. Pierwsza komenda z repo-root i ścieżką `server/src/...` wykonała 0 testów i została odrzucona jako błąd; poprawny config wymaga uruchomienia z katalogu `server` i ścieżki `src/...`.

### Protokół Z30

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R3 — STOP merytoryczny

Rodzaj: **MERYTORYCZNY**.

Powód: wymagany przez instrukcję dowód mutacyjny nie wykrywa osłabienia warunku statusu, a kwalifikowana para przez realny `ApiGateway` nie jest odtwarzalna na czystej bazie z dostępną fixture.

Licencja, którą sprawdziłem: tabela licencji pozwala wyłącznie na tymczasową mutację `server/src/middleware/auth.middleware.ts` z cofnięciem przez `cp` oraz na uruchamianie trzech nietykalnych pakietów bramki. Mutację wykonałem i cofnąłem; trwały diff middleware jest pusty.

Dowód: przebieg bazowy po ustawieniu wymaganego `JWT_SECRET` i `FINANCE_MEMBERSHIP_GATE_TEST_DB_PREFIX=cx` dał 68/68 PASS. Po zmianie `normalizeMembershipStatus(membership.status) === 'ACTIVE'` na `!!membership` wskazane `financeValue.membershipGate` + `auditsStrictMembership` dały **62/62 PASS**, zamiast wymaganej czerwieni. Zatem mutacja nie została zabita. Pakiet `financeValue.membershipGate` zawiera realne pary `MISSING/REVOKED → 403` i `ACTIVE → 200/201`, lecz montuje router przez `app.use(BASE, verifyToken, requireV8OrgContext, attachV8Context, router)`, a nie `ApiGateway.getInstance().initializeRoutes(app)`. Jedyny czerwony przypadek z realnym `ApiGateway`, `day116-approved-valuation-wacc-conflict`, na czystej bazie nie ma stałych rekordów organizacji, użytkownika ani business version (`0/0/0` z SQL), więc nie może dać właścicielskiego `200/201` bez odtworzenia osobnej, nieopisanej fixture biznesowej.

Co dostarczyłem ZAMIAST zmiany: potwierdzony A/B 15 FAIL → 15 PASS dla przyczyny członkostwa, tabelę 12 plików/suma 114, dowód luki testu mutacyjnego oraz gotowy kierunek naprawy: osobny, realny `ApiGateway` kontrakt `REVOKED → 403` i `ACTIVE → 2xx` na samowystarczalnej fixture.

Co zrobiłbym, gdyby zapadła decyzja X: dodałbym nowy test pod `tests/`, który montuje pełny `ApiGateway`, sam zasiewa minimalny zasób biznesowy i obie tożsamości, a następnie czerwienieje dokładnie po osłabieniu `ACTIVE`. Dopiero po jego RED→GREEN zastosowałbym wspólny seed do 12 pakietów.

Rekomendacja dla nadzorcy: wydać osobny, wąski dyżur na samowystarczalny kontrakt bramki przez `ApiGateway` albo dostarczyć kanoniczny seed stałej fixture `day116`; obecne wymaganie, że istniejące pakiety zaczerwienią się od wskazanej mutacji, jest pomiarowo fałszywe.

Stan: nie zacommitowano żadnej zmiany testów ani produktu; commit zawiera wyłącznie raport z pomiaru. Czy kontynuowałem pozostałe pozycje: **NIE**, ponieważ R4 bez zaakceptowanej zmiany R3 i bez zgodnego mianownika byłby fałszywym przemierzeniem.

## Próba R4 odrzucona jako błąd pomiaru

Na świeżej bazie uruchomienie katalogu `finance-v2/__tests__` wykonało 239 przypadków, nie 277 z artefaktu 336, i zapaliło czerwienie także w plikach kontrolnych. Wynik nie jest porównywalny po nazwach, więc nie służy do twierdzeń „przed/po”. Nie utworzyłem `po-nazwy.txt` i nie ogłaszam spadku 114.

## Commity i statystyki

- `6f93694d5a` — R1: 3 pliki, 287 wstawek.
- `721a1c80f0` — R2: 2 pliki, 75 wstawek, 3 usunięcia.
