## Po co ten dyżur istnieje

Odbiór adwersaryjny 04.09 zmierzył konta serwisowe **realnym łańcuchem**: `ApiGateway` +
podpisany JWT + Postgres po pełnych migracjach, i — czego test dyżuru 321 **nie miał** — z
**realnym wierszem** w `tp_service_accounts`. Wynik:

| | org UUID | org TEXT | przed dyżurem 321 (TEXT) |
| --- | --- | --- | --- |
| `GET` | `200` + realne dane | `200` + `[]` | `400 INVALID_IDENTIFIER` |
| `POST` | `201`, token wydany | **`500`, ciało `{}`** | `400` |
| `DELETE` | — | **`500`, ciało `{}`** | `400` |
| obcy tenant | `403` | `403` | `403` |

**Teza „cały moduł przestaje działać" jest OBALONA** — dla organizacji z identyfikatorem UUID
moduł czyta i zapisuje. To jest dobra wiadomość i wchodzi do raportu jako wynik, nie jako
przypis.

Defekt jest węższy i konkretniejszy. Dyżur 321 przeniósł bramkę identyfikatora **wyłącznie do
`GET`** (`server/src/routes/admin/service-accounts.routes.ts` ok. 54:
`if (!validateUUID(organizationId)) return res.json({ success: true, data: [] });`). `POST` i
`DELETE` bramki nie dostały. Skutek: dla organizacji o identyfikatorze spoza UUID zapisy zamieniły
**jawny, diagnozowalny `400`** na **`500` z pustym ciałem — bez `errorCode` i bez
`correlationId`**, czyli bez czegokolwiek, po czym użytkownik może to zgłosić, a my odnaleźć
w logach.

### Ryzyko jest realne, nie teoretyczne

`server/migrations/000_z_core_baseline.sql` ok. 1059:

```sql
INSERT OR IGNORE INTO organizations (id, name, status) VALUES ('system', 'System', 'active');
```

Identyfikator `system` **nie przechodzi** `validateUUID` (`server/src/utils/validation.ts`, regex
`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`). **Świeża instalacja ma
organizację spoza UUID.** Dyżur 321 zmierzył „4 organizacje" na wierszach, **które sam wstawił** —
to nie był pomiar stanu zastanego.

> ★ **Drugie dno, które sam masz rozstrzygnąć:** ten `INSERT` stoi pod składnią `INSERT OR IGNORE`,
> która jest **dialektem SQLite**. Z tego, że wiersz stoi w pliku migracji, **nie wynika**, że
> wszedł na Postgresa. Sprawdź na SWOJEJ bazie po pełnych migracjach, czy on tam realnie jest —
> i **obie odpowiedzi są cenne**: jeśli jest, ryzyko potwierdzone; jeśli go nie ma, znalazłeś
> osobną, cichą dziurę w odtwarzaniu bazy od zera.

### Sprzeczność, którą rozstrzygasz pomiarem, nie zgadywaniem

Globalny handler `server/src/utils/ErrorHandler.ts` ok. 258-267 zwraca dla błędu nieoperacyjnego
**niepuste** ciało:

```ts
res.status(500).json({
  status: 'error',
  correlationId: typeof correlationId === 'string' ? correlationId : null,
  error: { code: 'INTERNAL_ERROR', message: 'Something went very wrong!', timestamp: … },
});
```

Odbiór zmierzył jednak `500` z ciałem `{}`. **Obie rzeczy nie mogą być prawdą naraz.** Zanim
cokolwiek naprawisz, ustal **pomiarem**, kto realnie odpowiada na tej trasie: ten handler, inny
handler, czy odpowiedź powstaje przed jego zamontowaniem. To jest pierwsza rzecz w `R1` i
**najcenniejszy pojedynczy wynik tego dyżuru** — bo jeśli globalny handler nie odpowiada na
trasach administracyjnych, to dotyczy nie tylko kont serwisowych.

### Druga pozycja: strażnik łapie nazwę, nie wzorzec

`tests/unit/backend/security/noRawErrorMessage.test.ts` ma funkcję `catchVariableViolations()`,
która zbiera nazwy zmiennych wyrażeniem:

```js
[...source.matchAll(/catch\s*\(\s*([A-Za-z_$][\w$]*)/g)]
```

Po `catch` musi stać `(` i **od razu** identyfikator. W zapisie `.catch((problem) => …)` po
pierwszym `(` stoi **drugi** `(`, więc dopasowanie nie zachodzi i nazwa `problem` nigdy nie trafia
do skanu. Mutacja `.catch((problem) => res.json({ error: problem.message }))` **przeszła na
zielono**.

**Strażnik ma łapać WZORZEC, nie nazwę.** Moje liczby powierzchni w `server/src/routes` (bez
testów): **267** wystąpień `.catch(`, **251** z callbackiem w nawiasie. Zlecenie mówiło o „81
takich miejscach" — to inna definicja tego, co się liczy. **Zmierz swoją i podaj definicję.**

## ★ Zmierz moje liczby sam

Twierdzę: bramka `validateUUID` stoi tylko w `GET` (jedno trafienie w pliku trasy); `system` jest
identyfikatorem spoza UUID i stoi w migracji `000_z_core_baseline.sql` ok. 1059 pod składnią
SQLite; globalny handler zwraca niepuste ciało; strażnik ma progi 44 i 47 i zbiera nazwy tylko
z `catch (X)`; w trasach jest 267 `.catch(` i 251 z callbackiem; liście `translation.json` =
pl 35198 / en 33065.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

---

## B.1. TABELA LICENCJI PLIKOWYCH — CAŁA ŚCIEŻKA

> **★★ ZASTRZEŻENIE.** Poniższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz, jest
> opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi« jest
> NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Warstwa | Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- | --- |
| **walidator** | `server/src/utils/validation.ts` (`validateUUID`) | **TYLKO ODCZYT — PLIK PRZEKROJOWY.** Używany w całym serwerze; poluzowanie regexu przepuściłoby identyfikatory w miejscach, których nie mierzysz | **CZERWONY KONTRAKT TESTOWY** (`it('KONTRAKT DLA DYŻURU 326 — …')`, nagłówek `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`) + brief: plik:linia · ilu konsumentów · promień rażenia. **Pozycja z takim produktem jest ZROBIONA, nie STOP** |
| **trasa (tył)** | `server/src/routes/admin/service-accounts.routes.ts` | **★ PEŁNA LICENCJA** w zakresie `R2`: bramka identyfikatora na `POST` i `DELETE`, kształt odpowiedzi błędu (`errorCode` + `correlationId` w KAŻDEJ). **ZAKAZ zmiany kodów uprawnień** `ADMIN_BOUNDARY_VIOLATION` / `ADMIN_MEMBERSHIP_REQUIRED` / `ADMIN_ACCESS_REQUIRED` i **ZAKAZ zmiany kolejności middleware** (`verifyToken` → strażnik org → `verifyAdmin` → `requireAudit`) | — |
| **trasa (tył)** | `server/src/routes/table-platform.routes.ts` | **TYLKO ODCZYT** — drugi konsument `tp_service_accounts`; ustal, czy dziedziczy ten sam defekt | Wpis do rejestru + gotowy diff **nienałożony** |
| **kontroler / serwis (tył)** | `server/src/services/tablePlatform/ServiceAccountService.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE jawne odrzucenie niepoprawnego identyfikatora organizacji zamiast wyjątku bez kodu.** Zakaz zmiany kształtu zwracanych danych, zakaz zmiany logiki wydawania tokenu, zakaz zmiany zapytań SQL poza dodaniem walidacji wejścia | Gotowy diff + brief |
| **repozytorium / SQL** | Zapytania w `ServiceAccountService.ts` i w trasie (`SELECT id FROM tp_service_accounts WHERE id = ? AND organization_id = ?`) | **TYLKO ODCZYT — to jest zakres izolacji tenantów.** Zmiana `WHERE` przy tej okazji byłaby cichą zmianą modelu bezpieczeństwa | Wpis + czerwony kontrakt |
| **globalny handler** | `server/src/utils/ErrorHandler.ts` | **TYLKO ODCZYT — PLIK PRZEKROJOWY** (`Z12`). Twoim zadaniem jest **ustalić, czy on w ogóle odpowiada na tej trasie**, nie zmienić go | Brief z pomiarem: kto realnie odpowiada · dlaczego ciało jest puste · gotowy diff **nienałożony** · promień rażenia (ile tras administracyjnych) |
| **mapper** | `server/src/middleware/appErrorMapper.ts` | **TYLKO ODCZYT — teren dyżuru 325** | Wpis do raportu: plik, linia, treść problemu, gotowa rekomendacja jako diff, **nienałożony**. Pozycja idzie dalej |
| **migracje** | `server/migrations/**` | **BEZ LICENCJI — ten dyżur nie dodaje ani nie zmienia żadnej migracji.** Przedział nieprzydzielony. Jeżeli ustalisz, że `INSERT OR IGNORE` nie działa na Postgresie, produktem jest **wpis do rejestru + gotowy diff nienałożony**, nigdy migracja dopisana przy okazji | STOP MERYTORYCZNY z briefem, idziesz do następnej pozycji |
| **strażnik** | `tests/unit/backend/security/noRawErrorMessage.test.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE ROZSZERZENIE WYKRYWANIA.** Wolno: poprawić wyrażenie zbierające nazwy zmiennych tak, żeby obejmowało callbacki `.catch((x) => …)`; dodać nowe wzorce wycieków; dodać nowe `it(...)`. **ZAKAZ podnoszenia progów `ALTERNATE_LEAK_BASELINE` (44) i `VARIABLE_AGNOSTIC_LEAK_BASELINE` (47)**, zakaz zawężania zbioru skanowanych plików, zakaz usuwania istniejących `it(...)`. Jeżeli uszczelnienie ujawni dług większy niż próg — **nie podnosisz progu**: opisujesz dług w rejestrze i wpisujesz `STOP MERYTORYCZNY` z liczbą, a strażnika zostawiasz uszczelnionego z **osobnym, nowym** `it(...)` opisującym stan faktyczny | Nowy plik testowy obok, z tym samym zakresem skanu |
| **testy (istniejące)** | `server/src/routes/__tests__/service-accounts.routes.test.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisanie NOWYCH `it(...)`.** Zakaz zmiany i osłabiania istniejących pięciu | Nowy plik testowy obok |
| **testy (NOWE)** | `server/src/routes/__tests__/**` (NOWE), `tests/**` (NOWE) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18`, `Z29` (`--retry=0`) i `Z31` (`assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW**). **Nowe pliki w `tests/` wymagają `git add -f`** | — |
| **i18n** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie. **Liczba liści nie może zmaleć** (baza: pl 35198 / en 33065 — komenda w `B.3`). Realnie ten dyżur prawdopodobnie ich nie dotknie | — |
| **rejestr** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KONT_SERWISOWYCH_20260904.md` (**NOWY**) | **★ PEŁNA LICENCJA** | — |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY326_KONTA_SERWISOWE_REPORT.md` | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **bramki** | `server/src/middleware/auth.middleware.ts`, `admin.middleware.ts`, `requireAudit.middleware.ts`, `v8FeatureGate.middleware.ts`, `resultsInternalBetaVisibility.middleware.ts`, `server/src/Gateway.ts` | **TYLKO ODCZYT — `Z12`, BEZWZGLĘDNIE** | **CZERWONY KONTRAKT TESTOWY** + brief. Pozycja jest wtedy **ZROBIONA**, nie STOP |
| **infra testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: co blokuje pomiar, jaka byłaby zmiana, jak obszedłeś to zmiennymi w linii komendy. Pozycja jest zrobiona z takim opisem |
| **front** | `src/**` | **TYLKO ODCZYT** — ten dyżur nie zmienia frontu | Opis w raporcie z dowodem plik:linia |
| **decyzje** | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| **cudzy teren** | `src/services/errors/appErrorCopy.ts`, `src/services/api.ts`, `server/src/routes/resultsVnext/okr.routes.ts`, `kpiScorecard.routes.ts` — **teren dyżuru 325**; `src/components/Initiatives/**`, `src/components/**/*ardContract*.ts` — **teren dyżuru 324** | **TYLKO ODCZYT** | Wpis do raportu z gotową rekomendacją jako diff, **nienałożony**. Pozycja idzie dalej |
| — | **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

**Jedna pozycja = jeden wiersz = jeden commit = jeden werdykt. Commit po KAŻDEJ pozycji, push na
`github-backup` po pierwszym commicie i po każdej kolejnej (`Z34a`).**

| Pozycja | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Macierz dowodowa + rozstrzygnięcie, kto produkuje `500` z pustym ciałem | TAK | NIE — dowód: pomiar jest odczytem; `ErrorHandler.ts` nie jest zmieniany | bazowe | Sześć komórek macierzy (3 metody × 2 kształty identyfikatora), **każda jako PARA** „obcy nie widzi" + „właściciel widzi realny wiersz"; stan świeżej bazy odczytany **PRZED** własnym zapisem; nazwany handler odpowiadający `500` | `npx vitest run <Twój nowy test> --config server/vitest.config.ts --retry=0` z pełnym kompletem env `§0.2c` (B) | `test(service-accounts): macierz dowodowa na realnym Postgresie (326 R1)` |
| R2 | Bramka identyfikatora na `POST` i `DELETE`; koperta błędu kompletna | TAK | NIE — dowód: `B.1` daje pełną licencję na plik trasy | +3 testy | Dla org spoza UUID: `POST` i `DELETE` zwracają **jawny kod 4xx** z `errorCode` **i** `correlationId`; **żadna** odpowiedź błędu tej trasy nie jest bez tych dwóch pól; dla org UUID zachowanie **bit w bit jak przed zmianą** (para „właściciel widzi") | jw. | `fix(service-accounts): bramka identyfikatora na POST i DELETE (326 R2)` |
| R3 | Strażnik łapie wzorzec, nie nazwę | TAK | NIE — dowód: `B.1` daje wąską licencję na plik strażnika, wyłącznie rozszerzającą | +1 test | Mutacja `.catch((problem) => res.json({ error: problem.message }))` **CZERWIENI**; progi 44 i 47 **niepodniesione**; zakres skanu **niezawężony** | `npx vitest run tests/unit/backend/security/noRawErrorMessage.test.ts --retry=0` + dowód mutacyjny | `fix(security): straznik wyciekow lapie wzorzec, nie nazwe (326 R3)` |
| R4 | Rozliczenie `INSERT OR IGNORE` na Postgresie | NIE | NIE | n/d | Odpowiedź na pytanie „czy organizacja `system` realnie istnieje w bazie po migracjach", z zapytaniem i wynikiem; jeżeli nie — opis dziury w odtwarzaniu bazy od zera + gotowy diff **nienałożony** | `docker exec cx-day326-pg psql -U postgres -d cx326 -c "SELECT id, name FROM organizations;"` | `docs(day326): rozliczenie seeda organizacji system (326 R4)` |
| R5 | Powierzchnia `.catch(` w trasach | NIE | NIE | n/d | **Twoja** liczba z podaną definicją; ile z nich realnie wycieka do odpowiedzi HTTP, a ile idzie do loggera (logger ma prawo do surowej treści) | `grep -rnE "\.catch\(\s*\(" server/src/routes --include="*.ts" \| grep -v __tests__ \| wc -l` (w `bash`) | `docs(day326): powierzchnia .catch w trasach (326 R5)` |
| R6 | Raport | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" **niepusta**, jawny zapis **obalenia** tezy „cały moduł przestaje działać" | — | `docs(day326): raport` |

> **Kolumna „Wymaga plików przekrojowych?" jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi `NIE`.** Żadna pozycja nie wymaga zmiany `validateUUID`, `ErrorHandler.ts` ani żadnej
> bramki z `Z12`: gdyby wymagała, produktem jest czerwony kontrakt + brief, a pozycja jest
> **ZROBIONA**.

---

## B.3. TABELA MIANOWNIKÓW

**Każdą liczbę mierzysz sam (`Z24`) i podajesz swoją. Wszystkie komendy uruchamiasz w `bash`.**

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Trafienia `validateUUID` w pliku trasy | 1 (tylko `GET`) | `grep -c "validateUUID" server/src/routes/admin/service-accounts.routes.ts` | TAK — brak trafień w `POST`/`DELETE` JEST wynikiem |
| 2 | Wystąpienia `.catch(` w `server/src/routes` (bez testów) | 267 | `grep -rn "\.catch(" server/src/routes --include="*.ts" \| grep -v "__tests__" \| wc -l` | TAK |
| 3 | Z tego z callbackiem w nawiasie | 251 | `grep -rnE "\.catch\(\s*\(" server/src/routes --include="*.ts" \| grep -v "__tests__" \| wc -l` | TAK — **zlecenie mówiło „81"; podaj swoją liczbę i definicję** |
| 4 | Progi strażnika wycieków | 44 i 47 | `grep -n "ALTERNATE_LEAK_BASELINE\|VARIABLE_AGNOSTIC_LEAK_BASELINE" tests/unit/backend/security/noRawErrorMessage.test.ts` | TAK — **nie wolno ich podnieść** |
| 5 | Organizacje w bazie **przed** Twoim pierwszym zapisem | **do zmierzenia** — autor nie podaje | `docker exec cx-day326-pg psql -U postgres -d cx326 -c "SELECT id, name, status FROM organizations;"` | TAK — **to jest pomiar stanu zastanego; dyżur 321 policzył tu wiersze, które sam wstawił** |
| 6 | Zastosowane migracje | **do zmierzenia** — autor nie podaje | wynik `npx tsx server/scripts/migrate.postgres.ts` (obydwa przebiegi, `§0.2c` (A)) | TAK — zlecenie mówiło „891"; **licz sam** |
| 7 | Przypadki w istniejącym teście trasy | 5 | `grep -c "  it(" server/src/routes/__tests__/service-accounts.routes.test.ts` | TAK — żaden nie asertuje realnego wiersza w odpowiedzi `GET` |
| 8 | Liście `translation.json` | pl 35198 / en 33065 | `node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'` | TAK — **liczba nie może zmaleć**; tablice liczone element po elemencie |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `server/src/routes/admin/service-accounts.routes.ts` | istniejący | R2 | ZEROWE — 324 i 325 mają go jawnie jako cudzy teren |
| 2 | `tests/unit/backend/security/noRawErrorMessage.test.ts` | istniejący | R3 | ZEROWE — 325 ma go jawnie jako cudzy teren |
| 3 | `server/src/routes/__tests__/service-accounts.routes.<nowy>.test.ts` | NOWY | R1/R2 | ZEROWE |
| 4 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KONT_SERWISOWYCH_20260904.md` | NOWY | R1/R4/R5 | ZEROWE |
| 5 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY326_KONTA_SERWISOWE_REPORT.md` | NOWY | R6 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `server/src/services/tablePlatform/ServiceAccountService.ts` | R2 | Tylko jeśli pomiar `R1` pokaże, że `500` rodzi się w serwisie, a nie w trasie — i tylko jawne odrzucenie niepoprawnego identyfikatora |
| `server/src/routes/__tests__/service-accounts.routes.test.ts` | R2 | Tylko dopisanie nowych `it(...)` |
| `public/locales/{pl,en}/translation.json` | R2 | Tylko jeśli nowa odpowiedź niesie klucz i18n; parytet w tym samym commicie, liczba liści nie maleje |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
server/src/utils/validation.ts                          — przekrojowy (validateUUID)
server/src/utils/ErrorHandler.ts                        — przekrojowy; produkt = brief + diff NIENAŁOŻONY
server/src/middleware/auth.middleware.ts                — Z12
server/src/middleware/admin.middleware.ts               — Z12
server/src/middleware/requireAudit.middleware.ts        — Z12
server/src/Gateway.ts                                   — Z19
server/src/middleware/appErrorMapper.ts                 — teren dyżuru 325
src/services/errors/appErrorCopy.ts, src/services/api.ts — teren dyżuru 325
server/src/routes/resultsVnext/okr.routes.ts, kpiScorecard.routes.ts — teren dyżuru 325
src/components/Initiatives/**, src/components/**/*ardContract*.ts — teren dyżuru 324
server/migrations/**                                    — przedział nieprzydzielony
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6352 | `lsof -nP -iTCP:6352 -sTCP:LISTEN` → puste (sprawdzone przy pisaniu instrukcji) |
| Port harnessu | 5492 | `lsof -nP -iTCP:5492 -sTCP:LISTEN` → puste |
| Kontener | `cx-day326-pg` | `docker ps --format '{{.Names}}' \| grep cx-day326` → brak |
| Baza | `cx326` | n/d |
| Gałąź | `codex/day326-konta-serwisowe-20260904` | nie istnieje na `github-backup` |
| Worktree | `/private/tmp/cx-day326-konta-serwisowe` | nie istnieje |
| Przedział migracji | **NIEPRZYDZIELONY** — dyżur nie dodaje migracji | n/d |
| Flagi | **żadnych nowych, żadnych zmian domyślnych** | `git diff <marker>..HEAD -- '.env*' 'docker-compose*' 'railway*'` → pusto |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day326-konta-serwisowe
git diff --name-only --cached | tee /private/tmp/cx-day326-konta-serwisowe-artefakty/staged.txt
grep -iE 'utils/validation\.ts|utils/ErrorHandler\.ts|auth\.middleware|admin\.middleware|requireAudit|Gateway\.ts|appErrorMapper|appErrorCopy|services/api\.ts|resultsVnext/okr\.routes|kpiScorecard\.routes|components/Initiatives/|ardContract|server/migrations/' \
  /private/tmp/cx-day326-konta-serwisowe-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged <plik>)" \
  || echo "rozlacznosc OK"
```

---

## R1 — MACIERZ DOWODOWA I KTO PRODUKUJE `500` Z PUSTYM CIAŁEM

**Kolejność jest wiążąca** (`Z20`): najpierw kontener + pełne migracje (`§0.2c` (A), obydwa
przebiegi), potem **odczyt stanu zastanego**, dopiero potem jakikolwiek własny zapis.

**Krok 1 — stan zastany, PRZED Twoim pierwszym zapisem:**

```bash
docker exec cx-day326-pg psql -U postgres -d cx326 \
  -c "SELECT id, name, status FROM organizations ORDER BY id;"
#   zapisz WYNIK DOSŁOWNIE. To jest pomiar świeżej bazy, nie Twoich danych.
#   Sprawdź osobno, czy jest tam wiersz o id 'system' (patrz drugie dno w treści).
```

**Krok 2 — macierz, każda komórka jako PARA.** Realne żądania HTTP przez
`ApiGateway.getInstance().initializeRoutes(app)` (`Z22`), z podpisanym JWT, z **realnie wstawionym
wierszem** w `tp_service_accounts`, z zapisanym **kodem odpowiedzi** (`Z34`):

| Metoda | org UUID | org spoza UUID |
| --- | --- | --- |
| `GET` | (a) obcy → `403`; (b) właściciel → `200` **z tym wierszem w `data`** | (a) obcy → ?; (b) właściciel → ? |
| `POST` | (a) obcy → ?; (b) właściciel → ? | (a) obcy → ?; (b) właściciel → ? |
| `DELETE` | (a) obcy → ?; (b) właściciel → ? | (a) obcy → ?; (b) właściciel → ? |

★ **Komórka „właściciel widzi" MUSI asertować realny wiersz, nie pustą listę.** Test dyżuru 321
sprawdzał `data: []` i przeszedłby **tak samo przy całkowicie zepsutym listowaniu** — pusta lista
nie odróżnia „obcy nie widzi" od „nikt nic nie widzi".

**Krok 3 — kto odpowiada.** Dla każdego zmierzonego `500` ustal **imiennie**, który handler
zapisał odpowiedź i dlaczego ciało jest puste (albo: **że wcale nie jest puste** i pomiar odbioru
się mylił — to też jest cenny wynik). Ta odpowiedź trafia do raportu z dowodem: plik, linia,
sposób ustalenia.

★ **Akapit `§0.2e` obowiązkowy dla każdego pakietu** — która z pułapek (a)-(e) dotyczy, jak ją
wyłączyłeś i co dowodzi, że wyłączyłeś. Bez `ENABLE_TEST_AUTH_BYPASS=false` Twoje `403` powstanie
z całkiem innego powodu, a bez `MOCK_DB=false` odczyty pójdą **cicho** na atrapę bazy, która
zwraca `changes: 1` dla każdego `UPDATE` niezależnie od `WHERE`.

Prawo zatrzymania po tej pozycji.

## R2 — BRAMKA NA `POST` I `DELETE`, KOPERTA BŁĘDU KOMPLETNA

Dla organizacji o identyfikatorze spoza UUID `POST` i `DELETE` mają zwracać **jawny kod 4xx**
z `errorCode` **i** `correlationId`. **Żadna** odpowiedź błędu tej trasy nie może być bez tych
dwóch pól — to jest próg tej pozycji, sprawdzany po kolei dla wszystkich gałęzi błędu w pliku
(`401`, `403` ×3, `400`, `404`, `409`, `503 AUDIT_UNAVAILABLE`, `500`).

**Dla organizacji z identyfikatorem UUID zachowanie musi zostać bit w bit takie samo** — para
„właściciel widzi" przed i po zmianie, z tym samym kodem i tym samym wierszem w `data`. Regresja
tu byłaby gorsza niż defekt, który naprawiasz.

**Dowód mutacyjny obowiązkowy, wycelowany w ZABEZPIECZENIE, nie w mechanizm** (`Z32`): usuń
dodaną bramkę z `POST` → nowy test **CZERWONY** (bo wraca `500` bez `errorCode`); przywróć przez
`cp` z kopii w `SCRATCH` (`Z27`, nigdy `git stash`) → **ZIELONY**; `git diff` po cofnięciu
**pusty**. Obie komendy i oba wyniki dosłownie w raporcie.

★ **`Z23` — zero atrap.** „Naprawa" polegająca na `try/catch` zwracającym `200` albo pustą listę
jest **odrzuceniem pozycji**, nie naprawą. Uczciwy `4xx` z kodem jest wzorcem poprawnym.

Prawo zatrzymania po tej pozycji.

## R3 — STRAŻNIK ŁAPIE WZORZEC, NIE NAZWĘ

Uszczelniasz `catchVariableViolations()` tak, żeby obejmował **callbacki**: `.catch((problem) =>
…)`, `.catch(function (problem) { … })` i warianty z typem (`(problem: unknown)`). Zakres skanu
**niezawężony**, progi **niepodniesione**.

**Dowód mutacyjny wycelowany w zabezpieczenie:** wstaw do dowolnej trasy w zakresie skanu linię
`.catch((problem) => res.json({ error: problem.message }))` → strażnik **CZERWIENI**; usuń przez
`cp` z kopii → **ZIELONY**; `git diff` po cofnięciu **pusty**.

★ Jeżeli uszczelnienie ujawni dług większy niż zastane progi — **nie podnosisz progu**. Opisujesz
dług liczbą w rejestrze, wpisujesz `STOP MERYTORYCZNY`, zostawiasz strażnika uszczelnionego
z **osobnym, nowym** `it(...)` opisującym stan faktyczny, i idziesz dalej.

Prawo zatrzymania po tej pozycji.

## R4 — ROZLICZENIE SEEDA `system` NA POSTGRESIE

Odpowiedz na pytanie: **czy organizacja `system` realnie istnieje w bazie po pełnych migracjach?**
Zapytanie i wynik dosłownie. Jeżeli **tak** — ryzyko z treści potwierdzone i `R2` ją realnie
chroni. Jeżeli **nie** — znalazłeś osobną, cichą dziurę w odtwarzaniu bazy od zera
(`INSERT OR IGNORE` jest dialektem SQLite); opisz ją w rejestrze z gotowym diffem **nienałożonym**
i **nie dopisuj migracji przy okazji**.

Prawo zatrzymania po tej pozycji.

## R5 — POWIERZCHNIA `.catch(` W TRASACH

**Twoja** liczba z podaną definicją. Rozdziel: ile z nich realnie pisze do odpowiedzi HTTP
(`res.` / `.json(`), a ile idzie wyłącznie do loggera — **logger ma prawo i obowiązek do surowej
treści**, to nie jest wyciek. Bez tego rozdzielenia liczba jest myląca w drugą stronę.

Prawo zatrzymania po tej pozycji.

## R6 — RAPORT

Struktura `§R.2`. Obowiązkowo: **jawny zapis obalenia tezy** „cały moduł przestaje działać"
(z macierzą), sześć komórek macierzy jako pary „obcy nie widzi" + „właściciel widzi realny wiersz",
nazwany handler odpowiadający `500`, dowody mutacyjne w obie strony dla `R2` i `R3`, akapit
`§0.2e` dla każdego uruchomionego pakietu, deklaracja `§0.2b` (`Z30`), sekcja **TWIERDZENIA
NIEZWERYFIKOWANE** niepusta.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 zrobione (macierz + nazwany handler), R2 zrobione,
R3-R6 nietknięte" jest pełnowartościowym wynikiem — o ile każda komórka macierzy stoi na parze
dowodowej, a nie na pustej liście.

**Odwrotna kolejność — rejestry (R4/R5) zrobione, rdzeń (R1/R2/R3) „częściowo" — jest podstawą
odrzucenia.**

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela niżej | TAK |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone pętlą `[ -e "$p" ]` na worktree z markera; zero `BRAK` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, osiem wierszy; dwie pozycje jawnie oznaczone jako **do zmierzenia przez wykonawcę** (autor ich nie podaje, bo nie zmierzył) |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4 |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych (324, 325) | TAK — `B.4.4`; porty 5492/6352 zmierzone jako wolne |
| 7 | Komendy paste-ready, z `#   oczekiwane: …` | TAK |
| 8 | Pułapki środowiska w całości + siedem pułapek modułu | TAK |
| 9 | Samodzielność — zero odwołań do rozmów i „poprzedniego dyżuru" bez ścieżki | TAK |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu w dokumencie: `0`; wierszy `Z`: `41` | TAK |

### AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para wymagań, która mogłaby się wykluczać | Gdzie ROZSTRZYGNIĘTA w tym dokumencie |
| --- | --- |
| Zakaz `Z12` „bramki nietykalne" **vs** `R3` zmienia strażnika bezpieczeństwa | `Z12` (wyjątek imienny) + `B.1` — wąska licencja **wyłącznie rozszerzająca** wykrywanie; zakaz podnoszenia progów i zawężania skanu |
| „Uszczelnij strażnika" **vs** „nie podnoś progów" przy większym długu | `R3`, akapit końcowy — strażnik zostaje uszczelniony, dług idzie do rejestru jako `STOP MERYTORYCZNY` z liczbą, próg **niepodniesiony** |
| „Napraw `500` z pustym ciałem" **vs** `ErrorHandler.ts` tylko do odczytu | `B.1` + `R1` — najpierw **ustalasz pomiarem**, kto odpowiada; produktem dla `ErrorHandler.ts` jest brief + diff **nienałożony** |
| Treść instrukcji mówi „`500` z ciałem `{}`" **vs** kod handlera zwraca ciało niepuste | Rozstrzygnięte JAWNIE w treści („Sprzeczność, którą rozstrzygasz pomiarem") i w `R1` krok 3 — **to nie jest sprzeczność instrukcji, tylko rozkaz pomiarowy** |
| Zakaz `Z23` „zero atrap" **vs** pokusa naprawy `500` przez `200` z pustą listą | `R2`, akapit `Z23` — taka „naprawa" jest odrzuceniem pozycji |
| Zakaz `Z9` „żadnej bazy poza własnym kontenerem" **vs** wymóg realnego wiersza w `tp_service_accounts` | `R1` — wiersz wstawiasz do SWOJEJ bazy `cx326`, po pełnych migracjach; stan zastany odczytujesz PRZED tym zapisem |
| Zakaz `Z13` „dokładnie JEDEN nowy dokument" **vs** `R1`/`R4`/`R5` piszą do rejestru | `Z13` (pole „jedyny inny dokument") — raport + jeden imiennie wskazany rejestr |
| „Nie dodajesz migracji" **vs** możliwe odkrycie, że seed `system` nie wchodzi na Postgresa | `B.1` (wiersz migracji) + `R4` — produktem jest wpis do rejestru i diff **nienałożony**, nigdy migracja dopisana przy okazji |
