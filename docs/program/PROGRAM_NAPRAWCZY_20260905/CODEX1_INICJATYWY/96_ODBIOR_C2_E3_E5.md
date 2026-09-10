# ODBIÓR C2 — druga część dostawy Codexa (E3 · E4 · E5 · E6)

Odbiór trójwarstwowy, wykonany 2026-09-10 przez robotnika Opus na zlecenie nadzorcy (CTO).
Zakres: `49cd114773` → `b5201f1c03` (4 commity: E3 `ce2d053b49`, E5 `606b5a0efd`,
E4 `feacde5d64`, E6 `b5201f1c03`).

## 0. Stanowisko i odchylenia od zlecenia

| Pozycja | Wartość |
|---|---|
| Worktree | `/Users/piotrwisniewski/Developer/wt/c1-odbior` |
| Gałąź / HEAD | `mvp/c2-odbior-20260910` = `b5201f1c03` (marker `4630b1ee4c` jest przodkiem) |
| Kontrakt | `01_INSTRUKCJA.md` §E3, §E5 + `02_DECYZJA_NADZORCY_E3_E4.txt` (oba z `mvp/inicjatywy-lancuch-20260907`) |
| Baza pomiarowa | kontener `consultify-pg18` (127.0.0.1:54418), baza z `TEMPLATE consultify_staging_1009` |
| Procesy | 4231 = `ENABLE_INITIATIVE_UNIFIED_READ=true`, 4241 = `false` |
| Push | ŻADEN. Kod Codexa NIETKNIĘTY (FIX-y tylko opisane). `~/Developer/codex-wt/` tylko odczyt (`ls`, `shasum`). |

**ODCHYLENIE 1 — nazwa bazy.** Zlecenie mówiło `consultify_kopia_c2`. Skrypt E3
**odmawia pracy na jakiejkolwiek bazie o innej nazwie niż `codex1_staging_1009`**
(`scripts/dane/migruj-inicjatywy-do-kanonu.ts:68`, twardy `throw`). Żeby ocenić
DOSTARCZONY skrypt, a nie jego przeróbkę, kopię nazwałem `codex1_staging_1009`.
To odchylenie jest jednocześnie znaleziskiem — patrz **FIX-E3-1**.

**ODCHYLENIE 2 — jak uruchomiłem API.** Nie uruchomiłem `server/src/index.ts`
(ta sama przesłanka Z30, którą podniósł Codex: baza jest kopią ŻYWEGO stagingu
z danymi klientów, a `~/Developer/consultify-secrets/server.env` niesie **żywe
poświadczenia SMTP** — `SMTP_HOST/USER/PASS`, zmierzone). Zbudowałem minimalny
nasłuch `evidence/c2-odbior/harness-listen.mts`: `express` + `ApiGateway.initializeRoutes`
+ `app.listen`, zero Schedulera / cronów / drenaży. Zmienne poczty jawnie wykasowane
w `evidence/c2-odbior/env-c2.sh`.

---

## 1. WARSTWA 1 — kod vs kontrakt i decyzja nadzorcy

### 1.1. E3 — migracja (`ce2d053b49`)

| Wymóg kontraktu / decyzji | Wynik | Dowód |
|---|---|---|
| Z40: zero `DROP`/`RENAME`/`DELETE`/`TRUNCATE` na `initiatives*` | **SPEŁNIONE** | jedyny `DELETE` w skrypcie to `:140` na `ie_aggregate_state` (rejestr kanoniczny), nie na `initiatives*`. Zero `DROP`/`RENAME`/`TRUNCATE`. |
| Z40: zero modyfikacji istniejących plików `server/migrations/**` | **SPEŁNIONE** | `git diff 49cd114773 b5201f1c03 -- server/migrations` = pusty. Nowego pliku 20262130–20262139 też nie ma (raport: „migracja SQL nie była potrzebna" — zgodne). |
| `--dry-run` domyślny | **SPEŁNIONE** | `:50-56`, brak flag ⇒ `dry-run`. |
| `--apply` na dwa klucze + `--oczekiwany-host` | **SPEŁNIONE, sprawdzone negatywnie** | bez `MIGRACJA_INICJATYW_APPLY=true` → `ODMOWA`; bez `--oczekiwany-host=127.0.0.1` → `ODMOWA`. Obie próby wykonane. |
| Manifest z pełnymi wierszami dla POMINIĘTYCH | **SPEŁNIONE** | osobny plik `-do-decyzji-wlasciciela.json`, tryb `0600`, 105 wierszy × **106 kolumn** każdy, z listą powodów per wiersz. |
| Przywracanie kasuje WYŁĄCZNIE agregaty z manifestu | **SPEŁNIONE** | `:135-143` operuje na `manifest.createdAggregateIds`; `ON CONFLICT DO NOTHING` + `rowCount===1` (`:186`) gwarantuje, że do manifestu trafiają wyłącznie realnie wstawione wiersze, więc rollback nie tknie zastanych 31. |
| Idempotencja | **SPEŁNIONE** | apply #2: `eligible=0`, `created=0`, bezbłędnie. |
| Kryteria kwalifikacji (2 kwalifikowalne / 105 pominiętych) | **PRAWDA, odtworzone własnym SQL-em** | patrz 1.2 |
| `--verify` „zawsze" | **CZĘŚCIOWO** | wymaga `--manifest=`/`--rollback=`; bez manifestu nie da się uruchomić. Dopuszczalne, ale niezgodne z literą tabeli trybów. |

### 1.2. Weryfikacja liczb Codexa — własny SQL na kopii

| Liczba | Codex | Mój pomiar | Zgoda |
|---|---|---|---|
| `initiatives` / kanon inicjatyw | 121 / 31 | 121 / 31 | TAK |
| legacy bez kanonu / kanon bez legacy / wspólne | 107 / 17 / 14 | 107 / 17 / 14 | TAK |
| zbiór migracji: bez `project_id` | 77 | 77 | TAK |
| zbiór migracji: bez `owner_business_id` | 98 | 98 | TAK |
| zbiór migracji: bez obu | 70 | 70 | TAK |
| unia pominiętych / kwalifikowalne | 105 / 2 | 105 / 2 | TAK |
| cała tabela: 78 / 104 / 71 / unia 111 | 78 / 104 / 71 / 111 | 78 / 104 / 71 / 111 | TAK |
| md5 `initiatives` | `211e648a64804feb2f6ea09bffe7e13a` | `211e648a64804feb2f6ea09bffe7e13a` | TAK |

Rozkład powodów w manifeście „do decyzji właściciela" (mój odczyt pliku):
`BRAK_PROJECT_ID+BRAK_OWNER_BUSINESS_ID` = 70, `BRAK_OWNER_BUSINESS_ID` = 28,
`BRAK_PROJECT_ID` = 7. Sumuje się do 105 i domyka się z 77/98/70.

**Artefakty Codexa (`~/Developer/codex-wt/codex1-artefakty`, tylko odczyt): ISTNIEJĄ, sumy się zgadzają.**
Sprawdziłem 7 sum sha256 z §13 raportu (`e3-dry-run`, `e3-apply-1`, `e3-apply-2`,
`e3-rollback`, `e5-on-matrix-final`, `e5-off-matrix-final`, `diff-e5-nazwy`) — **7/7 identyczne**.
Trzy manifesty z §7: rozmiary 507 B / 920 043 B / 510 B, tryby `0600`, sumy sha256 — **3/3 identyczne**.
Pliki `e3-initiatives-md5-*.txt` niosą tę samą wartość co mój niezależny pomiar.

### 1.3. E4 — pisarze (`feacde5d64`)

**Kod pisarzy NIETKNIĘTY — dowód twardy.** Cały diff `server/src` między `49cd114773`
a `b5201f1c03` to **wyłącznie nowy plik testu E5**; ani jednej linii w kontrolerach,
trasach, serwisach czy middleware. Decyzja CTO („sześć pisarzy zostaje") wykonana
dosłownie, bez ukrytych zmian.

### 1.4. E5 — test siedmiu powierzchni (`606b5a0efd`)

**Które siedem tras.** `nowyRekordSiedemPowierzchni.pg.test.ts:76-84`:
`/api/initiatives` · `/api/initiatives/:id` · `/api/initiatives/:id/kpis` ·
`/api/v8/execution-control/capacity/timeline?initiativeId=` · `/api/my-work/executive-analytics` ·
`/api/v8/results/dashboard?initiativeId=` · `/api/report-builder/backlinks/initiative/:id`.

Uwaga o mapowaniu: kontrakt jako powierzchnię 1 wymieniał **widok rejestru w Playwright**,
a KPI było kryterium powierzchni 6 („Wyniki"). Codex podstawił za powierzchnię 1
trasę listy, a KPI i „Wyniki" rozdzielił na dwie pozycje. Przy uznanym STOP-ie
na Playwright to podstawienie jest sensowne, ale **warstwa przeglądarki nie jest
zmierzona i nie wolno jej liczyć jako którejkolwiek z siedmiu**.

| Wymóg | Wynik |
|---|---|
| Asercje dotyczą TREŚCI, nie tylko kodu 200 (Z23) | **SPEŁNIONE dla 6 z 7** — `visible` = `status===200 && body.includes(title)` (`:94`). Wyjątek: KPI (`:93`) liczone słabym kryterium „200 i brak `INITIATIVE_NOT_FOUND`". |
| Test na realnym PG (`RUN_DB_TESTS=1`) | **SPEŁNIONE** — `assertRealPostgresTestEnvironment()` (`:31`), `expect(DB_TYPE).toBe('postgres')` (`:30`). |
| `--retry=0` | **SPEŁNIONE** — `NO_RETRY = { retry: 0 }` (`:16-18`). |
| Rekord tworzony „przyciskiem w UI" | **NIE** — tworzenie idzie żądaniem HTTP na `runtime-v1` (ta sama ścieżka, którą woła kreator, ale bez przeglądarki). Konsekwencja uznanego STOP-u. |
| **Akapit `§0.2e` (pułapki a–e) w pakiecie** | **BRAK — ani w pliku testu, ani w raporcie.** Instrukcja: „Pomiar bez tego akapitu nie liczy się jako dowód". Patrz FIX-E5-2; dowód dorobiłem sam (1.5). |
| Trzy dowody mutacyjne dla E5 (Z32) | **NIE WYKONANE.** Raport §4 mówi o tym wprost i nie deklaruje E5 jako VERIFIED — uczciwe, ale definicja ukończenia E5 nie jest spełniona. |
| Definicja ukończenia „siedem sprawdzeń zielonych" | **NIE OSIĄGNIĘTA (3/7).** Codex deklaruje to sam w §12. |

### 1.5. Pułapki §0.2e — dowód, którego zabrakło w pakiecie (zrobiłem go za Codexa)

- **(a) `ENABLE_V8_GLOBAL`** — ustawiłem `=true` w OBU przebiegach i na obu procesach.
  Powierzchnie 4 i 6 **dalej dają 404**, a treść odpowiedzi to
  `{"error":"Initiative <id> not found","code":"INITIATIVE_NOT_FOUND"}` — czyli
  bramka **domenowa** (jedna z 50 pytających tabelę zastaną), nie `v8FeatureGate`
  (ten odcina przed uwierzytelnieniem i nie zna id). **Pułapka (a) NIE fałszuje wyniku Codexa.**
- **(b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`** — ustawione. Wynik
  powierzchni „Wyniki" bez zmian (404 domenowe). **Nie fałszuje.**
- **(d) `ENABLE_TEST_AUTH_BYPASS`** — jawnie `unset`; test podpisuje realny JWT
  `config.JWT_SECRET` (`:38`), a `/api/auth/me` na tym tokenie zwraca 200 z realnym
  użytkownikiem. **Nie dotyczy.**
- **(c) `DB_TYPE='sqlite'` w `vitest.config.ts:218`** — omijane przez
  `MOCK_DB=false DB_TYPE=postgres` w tej samej linii (config używa `process.env.DB_TYPE || 'sqlite'`).
- **(e) `409` z middleware** — nie dotyczy E5 (pakiet nie robi zapisów do tras zastanych).

**Wniosek: liczby Codexa (ON 3/7, OFF 0/7) są PRAWDZIWE. Brakuje dowodu, że są prawdziwe.**

### 1.6. STOP Playwright (Z30) — ocena zasadności

**STOP UZNAJĘ ZA ZASADNY, ale uzasadnienie w raporcie jest nieścisłe i słabsze niż prawda.**

- Nieścisłość: raport twierdzi, że „harness uruchamia `server/src/index.ts`
  (`playwright.config.ts:125-128`)". Ten blok jest **warunkowy** —
  `playwright.config.ts:9`: `const useWebServer = process.env.E2E_USE_WEB_SERVER === 'true'`,
  domyślnie **wyłączony**. Sam config nie startuje `index.ts`.
- Prawdziwy powód, **zmierzony przeze mnie**: Playwright bez `webServer` wymaga
  działającego backendu pod `E2E_API_URL`. Zbudowałem Z30-bezpieczny zamiennik
  (`ApiGateway` + `listen`, bez drenaży) i puściłem na nim realny frontend (Vite 3251
  → API 4231, zalogowany DBR77). **Moduł Inicjatywy nie ładuje danych**:
  ekran „Failed to load initiatives … `UNKNOWN_ERROR`",
  `GET /api/initiatives → 401 {"error":"No token provided"}`, `GET /api/csrf-token → 404`,
  a z konsoli tej samej strony `fetch('/api/initiatives', {Authorization})` → **200**.
  Przyczyna: `/api/csrf-token` jest montowany w `server/src/index.ts:1251`, a lista
  dozwolonych nagłówków CORS (`x-csrf-token`) w `server/src/index.ts:1130` —
  **`ApiGateway.initializeRoutes()` ich nie montuje**.
- Czyli: **taniego, Z30-bezpiecznego hosta dla przeglądarki NIE MA**; trzeba albo
  odpalić `index.ts` (zakazane na bazie z żywymi danymi), albo odtworzyć jego
  globalny stos middleware. Dowód: `evidence/c2-odbior/warstwa-przegladarki.txt`.

---

## 2. WARSTWA 2 — runtime na kopii

### 2.1. Migracja E3 — pełny cykl, liczby zmierzone

| Krok | `initiatives` | kanon inicjatyw | rozjazd (legacy bez kanonu) | md5 `initiatives` | receipts outboxu |
|---|---|---|---|---|---|
| stan wejściowy | 121 | 31 | 107 | `211e648a…e7cc13a`¹ | 0 |
| `--dry-run` | 121 | 31 | 107 (`= 2 kwalifikowalne + 105 POMINIĘTE`) | bez zmian | 0 |
| `--apply` #1 | 121 | **33** | **105** (`created=2`) | **bez zmian** | **0** |
| `--apply` #2 | 121 | 33 | 105 (`eligible=0, created=0`) | bez zmian | 0 |
| `--verify` (manifest apply) | — | — | — | — | `ok=true, present=2/2, missing=105/105` |
| `--rollback=<manifest>` | 121 | **31** | **107** (`deleted=2`) | **bez zmian** | 0 |
| `--verify` (kwit rollbacku) | — | — | — | — | `ok=true, present=0/0, missing=107/107` |

¹ pełna wartość: `211e648a64804feb2f6ea09bffe7e13a` — identyczna PRZED, PO APPLY i PO ROLLBACKU.

**Dowód rollbacku mocniejszy niż wymagany.** Po przywróceniu porównałem pełny md5
ładunku kanonu (`organization_id||aggregate_id||version||payload_json`, 31 wierszy)
kopii z **nietkniętą bazą źródłową**: `648e040c5da1aecfa0638768adc79c91` w obu.
Stan wraca **co do bajtu**, nie tylko co do liczby wierszy.

### 2.2. Siedem powierzchni — mój własny pomiar na realnym nasłuchu HTTP

Rekord utworzony ścieżką `runtime-v1` (`source-proposals` 201 → `registrations` 201),
SQL `kanon=1 zastany=0`. Ten sam rekord odpytany na obu procesach.
`ENABLE_V8_GLOBAL=true`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`.

| # | Powierzchnia | Trasa | ON (4231) | OFF (4241) | Widoczny ON |
|---|---|---|---|---|---|
| 1 | Rejestr / lista | `/api/initiatives` | 200, id+tytuł | 200, pusta lista `[]` | **TAK** |
| 2 | Karta | `/api/initiatives/:id` | 200, id+tytuł | 404 `INITIATIVE_NOT_FOUND` | **TAK** |
| 3 | KPI | `/api/initiatives/:id/kpis` | 200 `{"kpis":[]}` | 404 | **TAK — kryterium słabe** (bez id, bez tytułu) |
| 4 | Kokpit Realizacji | `/api/v8/execution-control/capacity/timeline` | **404** `INITIATIVE_NOT_FOUND` | 404 | NIE |
| 5 | Moja Praca | `/api/my-work/executive-analytics` | 200 bez rekordu | 200 bez rekordu | NIE |
| 6 | Wyniki | `/api/v8/results/dashboard` | **404** `INITIATIVE_NOT_FOUND` | 404 | NIE |
| 7 | Raporty | `/api/report-builder/backlinks/initiative/:id` | 200, echo id, bez tytułu | to samo | NIE (Z23) |

**ON 3/7 · OFF 0/7 — dokładnie jak w raporcie Codexa.** To samo wyszło z uruchomienia
JEGO testu (`vitest`, ON i OFF, oba `2 passed`) oraz z mojego skryptu na realnym
gnieździe TCP. Uczciwy odczyt macierzy: **2/7 po treści + 1/7 po kryterium słabym**.

### 2.3. Czy migracja E3 cokolwiek zmienia dla użytkownika — NIE

`GET /api/initiatives` przed / po `--apply` / po rollbacku:

```
PRZED-APPLY   DBR77/ON=121  DBR77/OFF=106  TT22TT/ON=2  TT22TT/OFF=2
PO-APPLY      DBR77/ON=121  DBR77/OFF=106  TT22TT/ON=2  TT22TT/OFF=2
PO-ROLLBACKU  DBR77/ON=121  DBR77/OFF=106  TT22TT/ON=2  TT22TT/OFF=2
```

**Zero różnicy na każdej organizacji, w obu ustawieniach flagi.** Powód: czytnik
z E2 robi UNION obu magazynów, więc te 2 rekordy i tak były na liście gałęzią zastaną;
migracja jedynie przenosi je na gałąź kanoniczną tej samej mapy.

**Ponadto: obie kwalifikowalne inicjatywy należą do organizacji `3935603f…` („TT22TT")
i są śmieciem testowym** — „próba 1" oraz szkic wygenerowany z kanwy.
**DBR77 dostaje 0 migrowanych rekordów ze 106.** Northwind — 0 z 13.

Realna wartość E3 na tym zbiorze nie leży w widoczności (ta jest z E2), tylko
w udostępnieniu **komend kanonicznych** (cykl życia, bramki) dla rekordów zastanych.
Ta wartość dziś dotyczy 2 śmieciowych rekordów.

### 2.4. Izolacja tenanta, 5xx, konsola

- **Izolacja: OK.** Wszystkie 121 pozycji zwróconych DBR77 przy fladze ON niosą
  `organizationId` = DBR77 (`121` to zbieg okoliczności z globalną liczbą `initiatives`;
  rozkład to 106 zastanych + 15 kanonicznych bez odpowiednika, wszystkie DBR77).
- **0 × 5xx** w logach obu procesów (`/tmp/c2-4231.log`, `/tmp/c2-4241.log`);
  0 × `unhandled`, 0 × `FATAL`. Trafienia wzorca „5xx" okazały się znacznikami czasu.
- Konsola przeglądarki: błąd modułu Inicjatywy opisany w 1.6 — artefakt mojego
  minimalnego nasłuchu (brak `/api/csrf-token`), nie defekt dostawy.

### 2.5. Czy scalenie z C1-FIX 1–8 coś zmienia — NIE (zmierzone)

Gałąź Codexa nie zawiera C1-FIX 1–8 (`a25dec1083` na linii integracyjnej).
Zrobiłem próbne scalenie na gałęzi tymczasowej i zmierzyłem:

- **Zero konfliktów, zero wspólnych plików.** C1-FIX dotyka
  `InitiativeController.ts`, `initiativeUnifiedReader.ts`, `dwaMagazynyRozjazd.pg.test.ts`,
  `statusDictionaryParity.test.ts` — dostawa C2 dotyka `scripts/dane/…`, `98_RAPORT.md`
  i **nowego** pliku testu E5. Przecięcie puste.
- **Macierz E5 po scaleniu bez zmian: ON 3/7, OFF 0/7, oba przebiegi `2 passed`.**
  Mimo że FIX-1 przepisał 228 linii czytnika.
- Cały katalog `server/src/domain/initiatives-execution/__tests__/` po scaleniu:
  **16 plików zielonych / 17**, w obu ustawieniach flagi. Jedyna porażka —
  `initiativeOwnerEligibility.swiezyProjekt.realdb.test.ts:59` — jest **niezwiązana**
  z dostawą (test wstawia do `organization_members` bez `id`, a w schemacie zrzutu
  stagingu ta kolumna nie ma `DEFAULT`; ten sam błąd wystąpiłby bez dostawy C2).

---

## 3. WERDYKT

| Etap | SHA | Werdykt |
|---|---|---|
| **E3 — migracja** | `ce2d053b49` | **SCAL Z FIX-EM** (FIX-E3-1…6) |
| **E4 — decyzja o pisarzach** | `feacde5d64` | **SCAL** (bez zastrzeżeń) |
| **E5 — test 7 powierzchni** | `606b5a0efd` | **SCAL Z FIX-EM** (FIX-E5-1…4) |
| **E6 — raport** | `b5201f1c03` | **SCAL Z FIX-EM** (FIX-E6-1…3) |

Uzasadnienie w jednym zdaniu: **dostawa jest uczciwa — każda liczba, którą sprawdziłem,
okazała się prawdziwa, a każdy artefakt istnieje i ma zgodną sumę — ale E3 dowozi
mechanikę, która na realnych danych nie migruje niczego wartościowego, a E5 dowozi
pomiar zamiast celu i przybija stan zastany asercją.**

### FIX-y dla Sonneta (plik:linia)

**E3 — `scripts/dane/migruj-inicjatywy-do-kanonu.ts`**

1. **FIX-E3-1 (blokujący realne użycie) — `:68`.** Nazwa bazy przybita:
   `if (database !== 'codex1_staging_1009') throw`. Skrypt jest bezużyteczny poza
   kontenerem Codexa — nie da się nim zmigrować kopii demo ani stagingu.
   Naprawa: wymagany jawny `--baza=<nazwa>` **plus** czarna lista hostów
   (skopiuj `FORBIDDEN_DB_HOSTS` z `tests/integration/_helpers/assertRealPostgres.ts`),
   żeby luzowanie nazwy nie otworzyło drogi do Railway.
2. **FIX-E3-2 — `:192-203`.** `--dry-run` **zapisuje na dysk** manifest i plik
   „do decyzji właściciela" (920 KB pełnych wierszy klienta, 106 kolumn). Tryb suchy
   nie powinien produkować kopii danych osobowych. Naprawa: w `dry-run` pisać wyłącznie
   przy jawnym `--zapisz-manifest`.
3. **FIX-E3-3 — `:197-201`.** Manifest główny nie zawiera ścieżki do pliku
   „do decyzji właściciela" ani md5 `initiatives` przed/po. Za tydzień z samego
   manifestu nie odtworzysz kompletu dowodów. Naprawa: pola `ownerDecisionManifestPath`,
   `initiativesMd5Before`, `initiativesMd5After`.
4. **FIX-E3-4 — `:140`.** Rollback kasuje po `aggregate_id` **bez `organization_id`**,
   choć klucz główny jest trójkolumnowy (`ie_aggregate_state_pkey (organization_id, aggregate_type, aggregate_id)`).
   Naprawa: zapisywać w manifeście pary `{organizationId, aggregateId}` i kasować po parze.
5. **FIX-E3-5 — `:91`.** Gdy `row.status` nie ma w mapie `STATUS`, do kanonu wchodzi
   **surowa** wartość jako `lifecycleState`. To ciche zgadywanie stanu spoza słownika.
   Naprawa: brak w mapie ⇒ wiersz POMINIĘTY z powodem `NIEZNANY_STATUS`.
6. **FIX-E3-6 — `:162-163`.** `--verify` na manifeście z pustą listą `createdAggregateIds`
   (przypadek `apply` #2) zwraca `ok=true` niezależnie od tego, czy agregaty w bazie są.
   Naprawa: dla `mode==='apply' && created===0` porównywać rozjazd z `missingBefore`,
   nie tylko z `missingAfter`.

**E5 — `server/src/domain/initiatives-execution/__tests__/nowyRekordSiedemPowierzchni.pg.test.ts`**

7. **FIX-E5-1 (blokujący dla CI) — `:105`.**
   `expect(visible).toEqual(ON ? ['lista','karta','KPI'] : [])` **przybija stan zastany**.
   Test jest zielony dziś i **zrobi się CZERWONY dokładnie wtedy, gdy ktoś podłączy
   powierzchnię 4/5/6/7** — czyli karze za postęp. Plik jest zbierany przez domyślną
   suitę (`vitest.config.ts:303-304`), więc trafi do bramki CI. Naprawa: rozdzielić na
   (a) asercję celu `expect(visible).toEqual(expect.arrayContaining(['lista','karta','KPI']))`
   oraz (b) osobny, jawnie opisany snapshot stanu zastanego z komentarzem
   „dopóki 47 bramek nie jest przełączonych".
8. **FIX-E5-2 — nagłówek pliku + `beforeAll` `:29-42`.** Brak akapitu `§0.2e`.
   Naprawa: komentarz nagłówkowy z rozstrzygnięciem pułapek (a)–(e) **oraz** twarde
   asercje w `beforeAll`: `expect(process.env.ENABLE_V8_GLOBAL).toBe('true')`,
   `expect(process.env.RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE).toBe('enforce')`,
   `expect(process.env.ENABLE_TEST_AUTH_BYPASS).toBeUndefined()`. Treść merytoryczną
   weź z sekcji 1.5 tego odbioru — jest zmierzona.
9. **FIX-E5-3 — `:92-94`.** Powierzchnia „KPI" zaliczana kryterium słabym
   (`200` i brak `INITIATIVE_NOT_FOUND`), a odpowiedź to `{"kpis":[]}` — bez id i bez
   tytułu. Kontrakt przypisał to kryterium powierzchni „Wyniki", nie KPI.
   Naprawa: dodać do wiersza macierzy pole `kryterium: 'tresc' | 'brak-404'`
   i raportować „2/7 po treści + 1/7 po kryterium słabym".
10. **FIX-E5-4 — `:29-55`.** `beforeAll` bez `try/finally`: przerwany setup zostawia
    organizację, użytkownika i projekt w bazie. Na kopii nieszkodliwe, na współdzielonej
    bazie to śmieci w danych demo. Naprawa: sprzątanie w `afterAll` bezwarunkowo
    po `organizationId`, także gdy `beforeAll` padł.

**E6 — `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX1_INICJATYWY/98_RAPORT.md`**

11. **FIX-E6-1 — §9.** Nie nazwano wprost, że warunek STOP z `§E3` („liczba pominiętych
    przekracza 30% zbioru") był **spełniony z ogromnym zapasem: 105/107 = 98,1%**,
    i że rozstrzygnęła go z góry decyzja CTO. To najważniejsza liczba tego etapu.
12. **FIX-E6-2 — §3/E5 i §9.** Poprawić uzasadnienie STOP-u Playwright: `E2E_USE_WEB_SERVER`
    jest domyślnie WYŁĄCZONE (`playwright.config.ts:9`), więc config nie startuje
    `index.ts` bezwarunkowo. Prawdziwy (i mocniejszy) powód: brak Z30-bezpiecznego
    hosta dla przeglądarki, bo `/api/csrf-token` (`index.ts:1251`) i nagłówki CORS
    (`index.ts:1130`) nie są w `ApiGateway`. Dowód: sekcja 1.6 tego odbioru.
13. **FIX-E6-3 — §3/E3 i §11.** Dopisać dwa zmierzone fakty: (a) migracja **nie zmienia
    żadnej liczby widocznej przez API** (lista przed/po/rollback identyczna na każdej org),
    (b) **DBR77 dostaje 0 migrowanych rekordów ze 106**, a obie kwalifikowalne inicjatywy
    to śmieć testowy w organizacji „TT22TT".

---

## 4. DO DECYZJI WŁAŚCICIELA — 105 pominiętych rekordów

**Czego zabrakło, żeby rozstrzygnąć samodzielnie:** kanon wymaga JEDNOCZEŚNIE
`projectId` i `initiativeOwnerId` (`initiativeWriteTruth.ts:186`), a w danych
tych pól po prostu nie ma i **nie da się ich wyprowadzić z niczego innego**.

### Rozkład (zmierzony, zbiór 107 rekordów bez agregatu)

| Organizacja | pominiętych | brak tylko projektu | brak tylko właściciela | brak obu | kwalifikowalnych |
|---|---|---|---|---|---|
| **DBR77** | **100** | 2 | 28 | 70 | **0** |
| Northwind Manufacturing | 5 | 5 | 0 | 0 | 0 |
| TT22TT (`3935603f…`) | 0 | — | — | — | **2** (śmieć testowy) |
| **Razem** | **105** | **7** | **28** | **70** | **2** |

### Opcje — z liczbami

**Opcja 0 — zostawić jak jest (rekomendacja krótkoterminowa).**
105 rekordów zostaje wyłącznie w magazynie zastanym. Koszt jest **mniejszy niż się wydaje**:
przy fladze `ENABLE_INITIATIVE_UNIFIED_READ=true` te rekordy i tak **są widoczne**
(czytnik robi UNION) — zmierzone w 2.3. Realny koszt: brak komend kanonicznych
(cykl życia, bramki) dla tych 105.

**Opcja A — wyprowadzić właściciela z pól zastępczych. NIE REKOMENDUJĘ.**
`coalesce(owner_execution_id, created_by)` daje wartość dla **40 ze 98** rekordów
bez właściciela. **Ale tylko 5 z tych 40 wskazuje na użytkownika istniejącego
w tej samej organizacji** — pozostałe 35 to wiszące referencje (usunięci użytkownicy
albo id spoza organizacji). Powstałyby agregaty z właścicielem-widmem. Zysk netto
kwalifikowalnych: 25, z czego 20 z fikcyjnym właścicielem.

**Opcja B — wyprowadzić projekt. NIEMOŻLIWA z danych.**
Ze 77 rekordów bez `project_id`: **0** ma `program_id`, **0** `report_id`,
**0** `source_assessment_id`, **0** `workstream_id`. Żadnego tropu. Jedyna uczciwa
forma to **jawna decyzja właściciela**: „projekt-skrzynka" per organizacja
(DBR77 ma dziś 16 projektów — trzeba by 17-tego, np. „Inicjatywy bez projektu").

**Opcja C — rozluźnić kanon (`initiativeWriteTruth.ts:186`), dopuścić `projectId = null`.**
Odblokowuje wszystkie 105 naraz i nic nie zgaduje. Cena: zmiana reguły produktu —
kanon przestaje gwarantować, że inicjatywa należy do projektu. To decyzja produktowa,
nie techniczna.

**Opcja D — ręczna mapa (najuczciwsza, najdroższa).**
Właściciel/konsultant przypisuje pola z pełnego manifestu (105 wierszy × 106 kolumn,
plik gotowy). Nakład: **70 wierszy wymaga obu pól, 28 tylko właściciela, 7 tylko projektu**.
Praktycznie cała praca dotyczy DBR77 (100 ze 105).

**Moja rekomendacja dla nadzorcy:** Opcja 0 na czas MVP + zadać właścicielowi jedno
pytanie z Opcji B/C: „czy inicjatywa może istnieć bez projektu — czy zakładamy
projekt-skrzynkę per organizacja?". Odpowiedź rozstrzyga 77 rekordów jednym zdaniem;
resztę (28 bez właściciela, z projektem) można wtedy domknąć Opcją D na małej próbce.

---

## 5. ZNALEZISKA POBOCZNE (poza zakresem dostawy, do rejestru)

1. **★ SIÓDMY pisarz zastany, nieuwzględniony w E4 — `server/src/services/demo/demoSeedService.ts:2295`.**
   Zaobserwowane na żywo: samo otwarcie aplikacji w przeglądarce zasiało **2 sesje demo
   po 22 inicjatywy = 44 nowe wiersze w `initiatives`**, z czego **0 w kanonie**
   (`DEMO_ORG_ID=ateliertoys-demo` z `server.env`). Plik ma `INSERT INTO initiatives`
   i **ani jednego** `INSERT INTO ie_aggregate_state`. Każda sesja demo powiększa
   rozjazd między magazynami o 22 rekordy. Inwentarz `§0.1a` (oparty na wzorcach
   middleware) tego pisarza nie widzi.
2. **Hałas w logach z czytnika E2** — `initiativeUnifiedReader.ts:68` i `:94` logują
   `warn` **per wiersz** z brakującymi polami nagłówka. Zmierzone: **424 ostrzeżenia
   z ~9 wywołań listy** (ok. 105 na jedno `GET /api/initiatives` dla DBR77).
   Naprawa: jedno ostrzeżenie zbiorcze z licznikiem. (Dotyczy C1/E2, nie C2.)
3. **`initiativeOwnerEligibility.swiezyProjekt.realdb.test.ts:59`** pada na schemacie
   zrzutu stagingu — wstawia do `organization_members` bez `id`, a kolumna nie ma
   `DEFAULT`. Niezwiązane z dostawą; ta sama rodzina co „schemat mieszka poza migracjami".
4. **`server.env` niesie ŻYWE poświadczenia SMTP** (`SMTP_HOST/PORT/USER/PASS/FROM`,
   `EMAIL_FROM`). Przepis startowy „`source ~/Developer/consultify-secrets/server.env`"
   wnosi je do procesu. Kto uruchomi `server/src/index.ts` na kopii żywych danych
   bez `NODE_ENV=test`, ma otwartą drogę do realnej wysyłki. Proponuję dopisać
   `unset SMTP_* EMAIL_FROM` do kanonicznego przepisu odbiorowego.

---

## 6. Artefakty tego odbioru

Katalog `evidence/c2-odbior/` (w repo, `git add -f`):

| Plik | Zawartość |
|---|---|
| `env-c2.sh` | środowisko pomiarowe (z jawnym wykasowaniem poświadczeń poczty) |
| `harness-listen.mts` | minimalny nasłuch HTTP bez `index.ts` (Z30-bezpieczny) |
| `probe.mjs`, `count.mjs`, `leak.mjs`, `pelny-cykl.mjs` | sondy: 7 powierzchni, liczby list per org, izolacja tenanta, pełny cykl |
| `probe-przed-ON.json`, `probe-przed-OFF.json` | macierz na rekordzie ZASTANYM (ON == OFF) |
| `e5-ON-c2.json`, `e5-OFF-c2.json` | macierz z uruchomienia testu Codexa |
| `pelny-cykl-wynik.txt` | pełny cykl na realnym gnieździe TCP (2.2) |
| `liczby-cyklu.txt` | liczby list przed / po apply / po rollbacku (2.3) |
| `warstwa-przegladarki.txt` | pomiar warstwy przeglądarkowej i ocena STOP-u Playwright (1.6) |

Manifesty migracji z moich przebiegów leżą **poza repo**
(`~/Developer/c2-artefakty/`), bo plik „do decyzji właściciela" zawiera 105 pełnych
wierszy z danymi klienta.

Baza `codex1_staging_1009` w kontenerze `consultify-pg18` zostaje **usunięta**
po zamknięciu odbioru. Kontener `cx-codex1-inicjatywy-pg` (Codexa) nietknięty.
