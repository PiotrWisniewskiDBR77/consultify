# ODBIÓR TRÓJWARSTWOWY — CODEX2 „Jeden magazyn, część 2: część zapisowa inicjatyw + reszta projekcji"

Odbierający: Opus (sesja C6), 2026-09-11. Wzór formy i rygoru:
`CODEX1_INICJATYWY/97_ODBIOR_W1_W2.md`, `CODEX1_INICJATYWY/96_ODBIOR_C2_E3_E5.md`,
`CODEX3_FINANSE_MINIMUM/97_ODBIOR_W1_W2.md`.

**Każda liczba w tym dokumencie jest zmierzona przeze mnie na moim stanowisku.**
Liczby z meldunku Codexa i z instrukcji traktuję jako premisę do obalenia, nie jako fakt.

---

## 0. METRYKA STANOWISKA (odtwarzalne)

| Pozycja | Wartość zmierzona |
| --- | --- |
| Gałąź odbioru | `mvp/c6-odbior-codex2-20260911` |
| Worktree | `/Users/piotrwisniewski/Developer/wt/c6-odbior-codex2` (symlink `node_modules`) |
| `git rev-parse HEAD` | `4f4110b0c3bee67dad3d9fca3aec436d79513058` |
| Marker/baza | `19440011e9` — `git merge-base --is-ancestor 19440011e9 HEAD` → `0` |
| Commity dostawy | 6 (E1 ×1, E3 ×4, E9 raport ×1) |
| Diff dostawy | 10 plików, `+486 / −30` |
| Baza pomiaru | `consultify_kopia_c6` = `TEMPLATE consultify_staging_1009`, kontener `consultify-pg18` (`127.0.0.1:54418`) |
| Stan bazy na wejściu | `initiatives` **121**, `ie_aggregate_state(initiative)` **31**, `organizations` **8** |
| Migracje runnera na kopii | przebieg 1: `Applying migrations: 0` + `Postgres migrations complete`, exit `0` (kopia stagingu jest już na wysokości markera) |
| `tsc -p server/tsconfig.json --noEmit` | exit `0`, **0 linii** wyjścia (bez potoku, 48 s) |
| Zakaz naruszony? | nie: zero połączeń do Railway/demo/stagingu/produkcji; zero `git push`; zero `git stash` (mutacje cofane przez `cp`) |
| Dowody | `evidence/c6-odbior-codex2/` (6 plików, bez binariów) |
| Baza po pracy | `DROP DATABASE consultify_kopia_c6` — **TAK**, wykonane |

**Meldunek Codexa jest uczciwy.** Nie znalazłem ani jednego zawyżenia: E2 i E4–E7
faktycznie niezrobione, E8 faktycznie nietknięte, dowodów mutacyjnych faktycznie brak,
a werdykt własny Codexa („NIEGOTOWE DO ODBIORU / NOT_PROVEN") zgadza się z moim pomiarem.
Znaleziska poniżej to rzeczy, których Codex **nie zmierzył**, a nie rzeczy, które przemilczał.

---

## 1. LICENCJA PER PLIK (W1a)

| # | Plik | Licencja z ★★ TABELI | Co realnie zmieniono | Werdykt |
| --- | --- | --- | --- | --- |
| 1 | `server/src/controllers/InitiativeController.ts` | ★ PEŁNA w zakresie E1/E3 | +114: moduł-pool + flaga + gałąź kanoniczna w `updateInitiative` wewnątrz `if (!existing)`; stała `INITIATIVE_UPDATED_MESSAGE` | **ZGODNY** |
| 2 | `server/src/routes/v8/results.routes.ts` | ★ WĄSKA — wyłącznie linia bramki | dokładnie bramka `:544-560` + import czytnika | **ZGODNY** |
| 3 | `server/src/routes/v8/execution-control.routes.ts` | ★ WĄSKA — wyłącznie linia bramki | dokładnie bramka `:604-620` + import czytnika | **ZGODNY** |
| 4 | `src/components/Initiatives/InitiativeDocumentView.tsx` | ★ WĄSKA + ZAMROŻONE `05_INITIATIVES`; zakaz JSX | +5 linii wyłącznie w `handleSaveRuntimeOnlyMetadata` (`ownerChanged` + `ownerId` w ładunku). **Zero JSX, zero klas, zero etykiet** | **ZGODNY** |
| 5 | `src/components/Initiatives/initiativeDocumentSource.ts` | ★ WĄSKA (warstwa wysyłania) | +4: `ownerId` w typie i mapowanie `ownerId → initiativeOwnerId` | **ZGODNY** |
| 6 | `src/services/initiativeWriteTruth.ts` | ★ WĄSKA + ZAMROŻONE `WSPOLNE` | +1 linia w `KLUCZE_ODMOWY` | **ZGODNY formalnie** (skutek → §5.6) |
| 7 | `scripts/dane/migruj-inicjatywy-do-kanonu.ts` | ★ WĄSKA — wyłącznie `FIX-E3-1…6` | +31/−? : scalenie list hostów HARD+SOFT, `NIEZNANY_STATUS`→`UNKNOWN_STATUS`, `mkdirSync`/zapis manifestu tylko w trybie zapisującym | **ZGODNY** |
| 8 | `server/src/domain/initiatives-execution/__tests__/initiativeCanonicalPut.pg.test.ts` | ★ PEŁNA (NOWY test) | nowy plik, 108 linii, 6 przypadków | **ZGODNY** |
| 9 | `src/components/Initiatives/__tests__/initiativeDocumentSource.saveRuntimeOnlyMetadata.test.ts` | tabela licencjonuje **NOWE** pliki testowe; ten jest ISTNIEJĄCY | +54 linie, wyłącznie 4 nowe `it(...)`, zero zmian w istniejących | **NARUSZENIE FORMALNE, ZEROWE REALNE** — nic nie usunięto, nic nie osłabiono |
| 10 | `docs/.../CODEX2_JEDEN_MAGAZYN_2/98_RAPORT.md` | ★ jedyny nowy dokument (Z13) | 155 linii | **ZGODNY** |

**Lista „JAWNIE NIE ZAPISZE" — sprawdzona imiennie: ani jeden plik z listy nie został
zmieniony.** `effectiveAccessService.ts` jest wyłącznie **importowany** (odczyt),
`pmoValidation.middleware.ts`, `Gateway.ts`, `auth.middleware.ts`,
`initiative.validators.ts`, `tests/setup.ts`, `vitest*.config.ts`, `src/components/standard/**`
— bez zmian. **Z18 (infrastruktura testowa) i Z12 (model uprawnień) nienaruszone.**

**ROZŁĄCZNOŚĆ:** wszystkie 10 plików mieści się w liście „zapisywane NA PEWNO/WARUNKOWO".
Warunek dla pliku 4 („tylko po zielonym dowodzie mutacyjnym E1 na realnym Postgresie")
**nie był spełniony w chwili zapisu** — dowód mutacyjny nie istniał; wykonałem go dopiero ja (§5.3).
To naruszenie kolejności, nie treści: dowód wykonany po fakcie wypadł zielony dla `title`,
czerwony (dziura) dla właściciela.

---

## 2. MIGRACJE

| Pytanie | Pomiar |
| --- | --- |
| Ile nowych plików w `server/migrations/`? | `ls server/migrations \| grep -cE "^2026214[0-9]"` → **0** |
| Czy blok dotknął istniejących migracji? | nie — `git diff --stat 19440011e9 4f4110b0c3 -- server/migrations` pusty |
| Addytywność (Z40) | trywialnie spełniona — zero migracji |
| Runner ×2 = 0 | przebieg 1 na kopii: `Applying migrations: 0`. Kopia stagingu jest już na wysokości markera, więc idempotencja runnera jest tu nietestowalna z definicji — **to nie jest dowód idempotencji, tylko stwierdzenie, że blok nie dołożył schematu** |

**Ryzyko migracyjne bloku: ZEROWE.** Cała dostawa jest odwracalna wyłączeniem flagi.

---

## 3. ZAKAZY Z1–Z46 — mierzalne w kodzie

| Zakaz | Pomiar | Werdykt |
| --- | --- | --- |
| `Z1`/`Z2`/`Z3` | brak pushów, gałąź Codexa istnieje tylko lokalnie, brak force/reset | OK |
| `Z10` (flagi) | `grep -rn ENABLE_INITIATIVE_UNIFIED_WRITE server src scripts` → **1 trafienie**, `InitiativeController.ts:134`, postać `process.env.X === 'true'` — bez `??`, bez wczesnego `return true` (kształt 20. z rejestru NIE wystąpił). Domyślna `ENABLE_INITIATIVE_UNIFIED_READ` nietknięta | **OK** |
| `Z11` (nowy ekran) | zero zmian JSX w całej dostawie | OK |
| `Z12` (uprawnienia) | pliki platformowe nietknięte; `effectiveAccessService` tylko importowany | OK |
| `Z13` (dokumenty) | dokładnie jeden nowy dokument (`98_RAPORT.md`); artefakty poza repo z `shasum` | OK |
| `Z15` (zero LLM) | `grep llmService/api/ai/GoogleGenerativeAI` w diffie → 0 | OK |
| `Z18` (infra testowa) | 0 zmian | OK |
| `Z23` (zero atrap) | **kluczowe**: Codex NIE dopisał pól do kopert, żeby zazielenić E8, i jawnie nazwał „200 bez treści" jako niezaliczenie. Zgadza się z moim pomiarem (§5.4) | **OK — postawa wzorowa** |
| `Z29` (`--retry=0`) | `describe(..., { retry: 0 })` w nowym pliku testu; mój przebieg z `--retry=0` | OK |
| `Z30` (zero wysyłki) | `SELECT count(*) FROM ie_outbox_delivery_receipts` po moich przebiegach → **0** (asercja wewnątrz testu Codexa, potwierdzona) | OK |
| `Z32` (dowody mutacyjne) | **NIEWYKONANE przez Codexa — przyznane wprost.** Wykonałem 4 (§5.3) | **NIESPEŁNIONY po stronie dostawcy** |
| `Z35` (wyciszanie) | zero `@ts-ignore`, `eslint-disable`, `.skip` w diffie | OK |
| `Z40` (tabele zastane) | zero `DROP`/`RENAME`/`DELETE` | OK |
| `Z41` (nazwa bazy parametrem) | `--baza=` + `--oczekiwany-host=` **istniały już na markerze** (pomiar: `git show 19440011e9:scripts/dane/…` linie 65–66, 112, 117–121). Wkład Codexa to scalenie list hostów HARD/SOFT — realny, ale mniejszy niż sugeruje meldunek | OK, z korektą atrybucji |
| `Z42` (manifest tylko w trybie zapisu) | zrobione w tym bloku: `mkdirSync`+`writeFileSync` wyłącznie gdy `mode==='apply' \|\| zapiszManifestDryRun`, `mode 0o600` | **OK** |
| `Z43` (`arrayContaining`) | nowy test E1 używa `expect.arrayContaining(['priority'])` dla `unsupportedFields`; `toEqual([])` w pliku E8 **nie pochodzi z tego bloku** (plik nietknięty) | OK dla dostawy |
| `Z45` (zero ciszy) | w diffie **nie dodano** ani jednego `catch {}`. ALE: odmowa `409` z nowej gałęzi **nie dociera do człowieka zdaniem w jego języku** — §5.6. To nie jest cisza, to jest kod techniczny w interfejsie | **CZĘŚCIOWO NIESPEŁNIONY** |
| `Z46` (i18n PL+EN) | nowych kluczy **nie dodano**; użyto istniejącego `initiatives.runtimeOnlyEditBlocked`, obecnego i **realnie przetłumaczonego** w `pl` (11842) i `en` (12658). Kształt „klucz istnieje ≠ przetłumaczony" NIE wystąpił | OK formalnie, §5.6 merytorycznie |
| DEC-461 (EN w kodzie) | wszystkie nowe komentarze i nazwy po angielsku; nowy test i komentarze Codexa — EN | OK |

---

## 4. LICZBY CODEXA vs MOJE

| K | Codex melduje | Mój pomiar | Zgodność |
| --- | --- | --- | --- |
| K1 bramki zastane | 50 → **48** | `git grep "SELECT id FROM initiatives WHERE id" 19440011e9 -- server/src \| grep -v __tests__ \| wc -l` = **50**; to samo na `4f4110b0c3` = **48** | **ZGODNE CO DO LICZBY, MYLĄCE CO DO ZNACZENIA** — patrz niżej |
| K2 fallbacki | 3 → 5 | 3 na markerze + 2 nowe = 5 | ZGODNE |
| K3 bramki ocen | 37, niezrobione | E4 niezrobione — zgadza się | ZGODNE |
| K4 pola karty z pisarzem | **4/4** | 3/4 dowiedzione, **4. pole (właściciel) bez ani jednej asercji serwerowej** (mutacja M2 → zielono) | **ZAWYŻONE** |
| K5 sześć ścieżek legacy | 0/6 wycofanych | E2 niezrobione | ZGODNE |
| K6 siedem powierzchni | 2/7 treść + 1/7 słabe | **2/7 po treści + 1/7 słabe** (moja sonda, §5.4) | **ZGODNE CO DO CYFRY** |
| K7–K8 | niezmierzone | E5/E6 niezrobione | ZGODNE |
| K9 seed demo | 0 lokalnie | E7 niezrobione | ZGODNE |
| K10 pominięte przez migrator | 0 / `UNKNOWN` | nie przebiegałem cyklu migratora (poza zakresem odbioru) | NIEZWERYFIKOWANE |

**★ Najważniejsza korekta: licznik K1 jest zepsutym przyrządem.**
Spadek 50→48 pochodzi w **całości** z przepisania tekstu SQL:
`git grep "SELECT 1 AS found FROM initiatives" 19440011e9` → **0**, na tipie → **2**
(commity „preserve legacy gate metric"). Zapytanie zastane **dalej istnieje** w obu plikach —
musi, bo przy fladze OFF kontrakt wymaga zachowania dzisiejszego zachowania co do bitu.

Wniosek nie jest oskarżeniem Codexa (obie bramki realnie przełączył, co udowodniłem mutacją M3),
lecz **ostrzeżeniem dla następnych bloków**: przy wymogu parytetu OFF licznik K1 **nigdy nie spadnie
do 3**, bo każda poprawnie przełączona bramka zostawia gałąź zastaną. Dopóki miarą jest tekst SQL,
da się go obniżyć bez przełączania czegokolwiek. **Miarą musi być obecność wywołania
`initiativeExists`/`initiativeUnifiedReader` w tej samej bramce, nie kształt literału.**

---

## 5. RUNTIME (W2) — na mojej kopii `consultify_kopia_c6`

Komplet env w jednej linii dla każdego przebiegu:
`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true
ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54418/consultify_kopia_c6
JWT_SECRET=<48 znaków> npx vitest run <ścieżka> --retry=0`
(config: **root** `vitest.config.ts`; `server/vitest.config.ts` daje fałszywe 0 testów).

### 5.1 Testy Codexa — odtworzone

| Pakiet | Meldunek Codexa | Mój przebieg |
| --- | --- | --- |
| `server/src/domain/initiatives-execution/__tests__/initiativeCanonicalPut.pg.test.ts` (realdb) | 6/6 | **6 passed (6)**, realny PG, realny `ApiGateway.getInstance().initializeRoutes(app)` (Z22 spełnione), realny JWT |
| `src/components/Initiatives/__tests__/initiativeDocumentSource.saveRuntimeOnlyMetadata.test.ts` (klient) | 7/7 | **7 passed (7)** |
| `server/src/domain/initiatives-execution/__tests__/nowyRekordSiedemPowierzchni.pg.test.ts` (E8) | „nieukończone" | plik **nietknięty przez blok** (`git diff 19440011e9 4f4110b0c3 --` pusty), dalej **2 × `it.todo`** i `toEqual([])` w gałęzi OFF. E8 = **0 % wykonania** |

**§0.4a (Z24):** żadna nazwa testu nie ZNIKNĘŁA — dostawa jest czysto addytywna
(diff w plikach testowych zawiera wyłącznie linie `+`). DODANE: 6 nazw realdb + 4 nazwy klienckie.
Pełnego korpusu nie przebiegałem (poza zakresem odbioru, deklaruję w §10).

### 5.2 Przebieg przez realny `ApiGateway` — moja sonda (nie testy Codexa)

Sonda: `server/src/domain/initiatives-execution/__tests__/c6probe.tmp.pg.test.ts`
(plik **tymczasowy, NIE scalany**; wyniki w `evidence/c6-odbior-codex2/runtime-ON.json`
i `runtime-OFF.json`). Rekord powstaje drogą właściciela:
`POST /api/initiatives/runtime-v1/source-proposals` → `POST …/registrations` (oba `201`).
SQL kontrolny: `kanon = 1, zastany = 0` w obu przebiegach.

### 5.3 Dowody mutacyjne — CZTERY, wykonane przeze mnie (`evidence/…/mutacje.txt`)

| Mutacja | Oczekiwanie kontraktu | Wynik |
| --- | --- | --- |
| **M1** `{ title: body.title }` → `MUT-${…}` | test CZERWONY | **1 failed / 5 passed** → cofnięte `cp` → **6/6**, `git diff` pusty ✅ |
| **M2** usunięcie mapowania `initiativeOwnerId` | test CZERWONY | **6/6 ZIELONY** ❌ **DZIURA W POKRYCIU** |
| **M3** `isInitiativeUnifiedReadEnabled()` → `false` w `results.routes.ts` | test CZERWONY | **żaden test nie czerwienieje — dla E3 nie ma testu.** Sonda: powierzchnia „Wyniki" `200 → 404 INITIATIVE_NOT_FOUND`; po cofnięciu `200`, `git diff` pusty. Zmiana JEST nośna, ale broni jej wyłącznie mój pomiar ⚠️ |
| **M4** `WHERE organization_id = $1` → `(… OR true)` w `postgresInitiativeReader.findById` | test izolacji CZERWONY | **1 failed** („does not reveal a canonical record to another tenant"); sonda: `PUT` obcą organizacją `404 → 500`, **tytuł agregatu niezmieniony**. Po cofnięciu zielony, `git diff` pusty ✅ |

### 5.4 Siedem powierzchni — macierz ON / OFF (moja sonda, jeden rekord kanoniczny)

| # | Powierzchnia | OFF (`READ=false, WRITE=false`) | ON (`READ=true, WRITE=true`) | Kryterium |
| --- | --- | --- | --- | --- |
| 1 | lista `GET /api/initiatives` | `200`, **bez** id i tytułu | `200`, **id + tytuł** | treść ✅ |
| 2 | karta `GET /api/initiatives/:id` | `404 INITIATIVE_NOT_FOUND` | `200`, **tytuł** | treść ✅ |
| 3 | KPI `…/kpis` | `404` | `200`, **bez id** | słabe ⚠️ |
| 4 | Realizacja `…/execution-control/capacity/timeline` | `404 INITIATIVE_NOT_FOUND` | **`200`, bez id i bez tytułu** | **NIEZALICZONE (Z23)** |
| 5 | Moja Praca `…/my-work/executive-analytics` | `200` bez rekordu | `200` **bez rekordu** | NIEZALICZONE |
| 6 | Wyniki `…/results/dashboard` | `404 INITIATIVE_NOT_FOUND` | **`200`, bez id i bez tytułu** | **NIEZALICZONE (Z23)** |
| 7 | Raporty `…/report-builder/backlinks/initiative/:id` | `200`, id, bez tytułu | `200`, id, **bez tytułu** | NIEZALICZONE |

**Wynik: 2/7 po treści + 1/7 po kryterium słabym — identycznie jak melduje Codex.**
Dorobek E3 jest realny, ale **wyłącznie w bramce**: powierzchnie 4 i 6 przestały kłamać `404`,
a zaczęły zwracać pustą kopertę `200`. Dla użytkownika **nie zmieniło się nic** —
i to jest dokładnie ten kształt, który odbiór C2 nazwał „kryterium słabym" i odrzucił.
**Przy OFF wszystko jest bit w bit jak na markerze** (macierz OFF = stan zastany, `PUT` = `404`).

### 5.5 Zapis (punkt 6 z E8) — działa

| Pomiar | Wynik |
| --- | --- |
| `PUT /api/initiatives/:id` {title, summary, description}, flaga ON | **`200`** w 33 ms, `{id, message:"Initiative updated"}` |
| readback `ie_aggregate_state` | `version 1 → 2`, `title` nowy, `problem`=`description` karty, `proposedOutcome`=`summary` karty |
| ponowny odczyt powierzchni 1 i 2 | **pokazują nową wartość** ✅ |
| `PUT` z polem niewspieranym (`priority`) | **`409`**, `code: INITIATIVE_CANONICAL_WRITE_REQUIRED`, `unsupportedFields:["priority"]`, `canonicalWriter:"/api/initiatives/runtime-v1"` — kontrakt E1b co do joty ✅ |
| tenant: `PUT` i `GET` tokenem obcej organizacji | **`404` / `404`**, tytuł agregatu niezmieniony ✅ |
| flaga OFF | `PUT` → **`404 {"error":"Initiative not found"}`** — identycznie z markerem ✅ |
| `ie_outbox_delivery_receipts` | **0** ✅ (Z30) |

**★ IDEMPOTENCJA — ZŁAMANA (zmierzone).** Ten sam ładunek wysłany dwa razy:
`drugiStatus 200`, `version 2 → 3`, `ie_command_receipts` = 4.
Powód: `clientRequestId: ` + `legacy-put-${uuidv4()}` — **nowy identyfikator przy każdym żądaniu**,
więc warstwa idempotencji agregatu nie ma czego rozpoznać. Podwójne kliknięcie, retry przeglądarki
albo ponowienie po timeoucie tworzą drugą komendę i drugą wersję agregatu.
Kontrakt E1b („zero pętli", licznik żądań = 1) **nie ma na to ani jednej asercji** — Codex przyznaje,
że licznika w oknie 12 s nie zmierzył.

**★ `expectedVersion` dociągane po cichu.** `expectedVersion: canonical.version` — serwer sam czyta
bieżącą wersję tuż przed zapisem, więc **ochrona przed nadpisaniem cudzej edycji znika**
(dwóch redaktorów nadpisze się bez `409`). Instrukcja przewidziała dokładnie tę sytuację jako
**STOP MERYTORYCZNY z opisem ryzyka** („albo serwer dociąga wersję sam — i wtedy tracimy ochronę…").
Codex wybrał wariant, **nie zgłaszając STOP-u i nie opisując ryzyka w raporcie.**

### 5.6 Odmowa NIE dociera do człowieka po polsku (łańcuch przerwany)

Codex dopisał `INITIATIVE_CANONICAL_WRITE_REQUIRED → initiatives.runtimeOnlyEditBlocked`
do `KLUCZE_ODMOWY` (`initiativeWriteTruth.ts:179`). Prześledziłem konsumenta:

* `opiszOdmoweTworzeniaInicjatywy` jest wołane **tylko** z `InitiativeDocumentView.tsx:3432`
  i z wnętrza `initiativeWriteTruth.ts` — czyli **wyłącznie na kanonicznej ścieżce karty**
  (`PATCH runtime-v1`), która **nigdy nie wysyła `PUT /api/initiatives/:id`**;
* jedyni realni wołacze zastanego `PUT` w `src/` to `Api.updateInitiative`
  (`src/services/api.ts:7104`) → `src/components/assessment/manage/InitiativesManagementPanel.tsx:394`
  i `src/components/Finance/Prediction/ScenarioAssumptionsView.tsx`. Panel wysyła
  `{title, name, description, priority, riskLevel, category}` — czyli **przy fladze ON
  dostanie `409` przy każdej edycji rekordu kanonicznego**;
* ten `409` idzie przez `handleResponse` → `normalizeApiErrorMessage`. Ciało odmowy
  **nie ma pola `message` ani `error`**, a kod `INITIATIVE_CANONICAL_WRITE_REQUIRED`
  **nie istnieje w `API_ERROR_FALLBACKS_EN` ani w `errors.*`** (`grep` → 0 trafień poza
  `initiativeWriteTruth.ts`). `normalizeApiError` schodzi do ostatniego `return { message: fallback }`,
  a `fallback` to `HTTP ${res.status} ${res.statusText}`.

**Efekt dla użytkownika: toast `HTTP 409 Conflict`.** Angielski kod techniczny w interfejsie,
zero wyjaśnienia, zero wskazówki co zrobić. To jednocześnie: kształt „biblioteka bez wywołania"
(klucz dopisany do lejka, którego ta ścieżka nie używa), złamanie twardej reguły 2 z `E1b`
(„odmowa dociera do człowieka po polsku i po angielsku") i powrót kodu technicznego do UI (P4).

### 5.7 Wydajność `GET /api/initiatives` (10 próbek, ta sama kopia, 121+31 rekordów)

| Flaga | mediana | min | max |
| --- | --- | --- | --- |
| `READ=ON` | **22 ms** | 21 | 26 |
| `READ=OFF` | **57 ms** | 50 | 69 |

**Brak regresji** — próg STOP-u z E3 (300 ms) nie jest zagrożony; ścieżka kanoniczna jest tu
**szybsza** od zastanej. Dla porównania odbiór C1 mierzył ON 26 ms / OFF 24,5 ms — różnica
wynika z innej bazy i innego kształtu danych, nie z regresji; **nie przenoszę tamtych liczb jako swoich**.

---

## 6. KOLIZJA Z PISARZEM Z LINII (E1a/N1 vs E1 Codexa) — JEDEN PISARZ CZY DWA?

**Odpowiedź: dwie ścieżki, jeden magazyn docelowy, zero kolizji funkcjonalnej — ale dwa
egzemplarze tego samego mapowania.**

| Ścieżka | Plik:linia | Kiedy działa | Komenda |
| --- | --- | --- | --- |
| **A — klient (N1/E1a, już na linii)** | `src/components/Initiatives/InitiativeDocumentView.tsx:3410` → `initiativeDocumentSource.ts:99-105` → `initiativeWriteTruth.amendRegisteredInitiative` | karta otwarta na rekordzie **runtime-only**; ścieżka **nie wysyła `PUT`** (asercja `never calls PUT /api/initiatives/:id` — przechodzi) | `PATCH /api/initiatives/runtime-v1/initiatives/:id/metadata` |
| **B — serwer (E1 Codexa, nowa)** | `server/src/controllers/InitiativeController.ts:885-965` | **każdy inny** wołacz zastanego `PUT` trafiający na rekord kanoniczny (panel Ocen, Finanse/Scenariusze, integracje) | ta sama domenowa `amendInitiativeMetadata` |

* **Nie kolidują**: B odpala się wyłącznie w gałęzi `if (!existing)`, czyli gdy rekordu **nie ma**
  w magazynie zastanym; rekordy zastane idą dzisiejszą ścieżką bit w bit. A i B nigdy nie strzelają
  jednocześnie w jednym żądaniu.
* **Uzupełniają się**: A zamyka kartę, B zamyka „resztę aplikacji". Razem dają pierwszy raz
  zapis kanoniczny z obu stron.
* **Ale mapowanie pól jest zduplikowane**: `description → problem`, `summary → proposedOutcome`
  żyje teraz w `initiativeDocumentSource.ts:102-103` (klient) i `InitiativeController.ts:950-952` (serwer) **i** w `InitiativeController.ts:950-952`.
  Oba egzemplarze zgadzają się dziś (zweryfikowane: readback pokazuje `problem = "C6 problem 2"`
  z pola `description`). Rozjazd jednego z nich nie zapali żadnego testu wspólnego —
  to ten sam kształt, co „dwa egzemplarze słownika stanów" z §12 raportu Codexa.
* **Różnica uprawnień, której nikt nie zgłosił**: B autoryzuje przez
  `evaluateEffectiveCapability(…, { requireOwnership: true, ownerPredicate: initiativeOwnerId === userId })`
  — identycznie jak komenda `runtime-v1` (`initiativesExecutionRuntime.routes.ts:7618`), czyli
  **spójnie z kanonem**. Ale ścieżka zastana autoryzuje szerzej
  (`resolveInitiativeCapabilityContext` + profil ról: sponsor, role bramkowe, RACI —
  `InitiativeController.ts:994`). Skutek produktowy: **sponsor/PMO, który dziś edytuje inicjatywę
  zastaną, dostanie `403 CAPABILITY_REQUIRED` na inicjatywie kanonicznej.**
  Instrukcja przewidziała to jako STOP („`initiativeOwnerId` przechodzi walidację uprawnień inaczej
  niż ścieżka zastana — STOP z tabelą kto może zmienić właściciela"). **STOP nie został zgłoszony.**

---

## 7. WERDYKT PER ETAP

| Etap | Werdykt | Uzasadnienie jednozdaniowe |
| --- | --- | --- |
| **E1** (zapis kanoniczny rekordu) | **SCAL Z FIX-EM** (FIX-1…FIX-4) | Rdzeń działa i jest zmierzony na realnym PG przy obu stanach flagi; braki są naprawialne i żaden nie dotyka OFF |
| **E1a** (karta wysyła właściciela) | **SCAL Z FIX-EM** (FIX-2) | Mapowanie poprawne, ale czwarte pole nie ma ani jednej asercji serwerowej (mutacja M2 zielona) |
| **E1c** (skrypt migracji) | **SCAL** | Zmiany addytywne i zawężające (staging przeniesiony z listy miękkiej na twardą), `--dry-run` przestał pisać dane klienta; atrybucja w meldunku zawyżona, kod — nie |
| **E3** (47 bramek) | **SCAL Z FIX-EM** (FIX-5, FIX-6) | 2 z 47 przełączone poprawnie i nośnie (mutacja M3), ale bez ani jednego testu i z licznikiem K1, który po tej zmianie mierzy tekst SQL zamiast bramki |
| **E2, E4, E5, E6, E7** | **BRAK DOSTAWY** | Nie ma czego scalać ani odrzucać |
| **E8** (7/7) | **NIE SCALAJ — nic nie dostarczono** | Plik testu nietknięty, 2 × `it.todo` żyją dalej, 4 powierzchnie nadal nie pokazują rekordu |
| **E9** (raport) | **SCAL** | Układ pełny, czerwone bramki jawne, werdykt własny uczciwy — wzór dla kolejnych bloków |

**Werdykt całościowy: SCAL DOSTAWĘ (6 commitów) Z SZEŚCIOMA FIX-AMI, FLAGA ZOSTAJE OFF.**
Ryzyko scalenia przy OFF jest zmierzone jako zerowe: cała macierz OFF i `PUT` przy OFF są
bit w bit jak na markerze, `tsc` zielony, zero migracji. **Włączenie `ENABLE_INITIATIVE_UNIFIED_WRITE`
na stagingu dopiero po FIX-1 i FIX-2** — bez nich pierwsza edycja z panelu Ocen pokaże
użytkownikowi `HTTP 409 Conflict`.

---

## 8. LISTA FIX-ÓW DLA SONNETA

| # | Plik:linia | Co zrobić | Dlaczego | Jak sprawdzić |
| --- | --- | --- | --- | --- |
| **FIX-1** ★ blokuje ON | `src/utils/apiErrorFallbacks.ts` + `public/locales/{pl,en}/translation.json` | Dodać kod `INITIATIVE_CANONICAL_WRITE_REQUIRED` do `API_ERROR_FALLBACKS_EN` i klucz `errors.INITIATIVE_CANONICAL_WRITE_REQUIRED` w PL **i** EN, z realnym tłumaczeniem (np. PL: „Ta inicjatywa jest w nowym rejestrze — zapisz ją z karty inicjatywy"). **Nie dopisywać `error` do ciała odpowiedzi serwera** (serwer niesie wyłącznie kod i status — reguła E1b.2) | Dziś `Api.updateInitiative` → `handleResponse` → `normalizeApiError` nie zna kodu i ciało nie ma `message`, więc użytkownik panelu Ocen widzi toast **`HTTP 409 Conflict`** (§5.6) | Flaga ON, edycja inicjatywy kanonicznej w `InitiativesManagementPanel` → toast po polsku; `grep INITIATIVE_CANONICAL_WRITE_REQUIRED public/locales/pl public/locales/en src/utils` → ≥3 trafienia |
| **FIX-2** ★ | `server/src/domain/initiatives-execution/__tests__/initiativeCanonicalPut.pg.test.ts` | Dodać przypadek: `PUT {ownerId: <inny uprawniony>}` → `200` → readback `payload_json.initiativeOwnerId` = nowy. Plus przypadek `ownerId` nieuprawniony → `422 INITIATIVE_OWNER_INELIGIBLE` | Mutacja M2 (usunięcie mapowania właściciela) zostawia pakiet **zielony** — czwarte pole K4 nie jest niczym bronione | Powtórzyć M2: usunąć linię `initiativeOwnerId` w `InitiativeController.ts:953` → pakiet musi być **CZERWONY**; cofnąć `cp` → zielony, `git diff` pusty |
| **FIX-3** ★ | `server/src/controllers/InitiativeController.ts:944` | `clientRequestId` ma być **deterministyczny z żądania** (np. hash `id + orgId + posortowany ładunek`, albo nagłówek `Idempotency-Key`/`X-Correlation-ID`, gdy klient go wysyła) zamiast `legacy-put-${uuidv4()}` | Zmierzone: dwa identyczne `PUT` → `version 2 → 3`, 4 pokwitowania komend. Retry/podwójne kliknięcie mnoży wersje agregatu | Sonda: wysłać ten sam ładunek dwa razy → `version` **nie rośnie** przy drugim, `ie_command_receipts` bez przyrostu |
| **FIX-4** | `server/src/controllers/InitiativeController.ts:943` + `98_RAPORT.md` | Albo przyjąć `expectedVersion` od klienta, albo **jawnie udokumentować** utratę ochrony przed nadpisaniem (kontrakt wymagał STOP-u z opisem ryzyka) oraz dopisać test „dwie równoległe edycje" | `expectedVersion: canonical.version` dociągane po cichu = brak `409` przy kolizji redaktorów (§5.5) | Test: dwa `PUT` z przeplotem odczytu wersji → druga edycja albo `409`, albo udokumentowane „ostatni wygrywa" |
| **FIX-5** | `server/src/routes/v8/results.routes.ts:544`, `server/src/routes/v8/execution-control.routes.ts:604` | Dopisać **test tras** obu bramek (ON: rekord kanoniczny → nie `404`; OFF: `404`; obca organizacja → `404` przy ON i OFF). Jeżeli blokuje niepełny mock `validateOrgMembership` — napisać test **realdb przez `ApiGateway`**, jak w pakiecie E1, zamiast naprawiać globalny mock (Z18!) | Mutacja M3: wyłączenie czytnika kanonicznego **nie czerwieni niczego** — E3 nie ma pokrycia | Powtórzyć M3 (`isInitiativeUnifiedReadEnabled()` → `false`) → nowy test **CZERWONY** |
| **FIX-6** | `docs/.../CODEX2_JEDEN_MAGAZYN_2/01_INSTRUKCJA.md` (definicja K1) — dla kolejnego bloku | Przedefiniować K1: liczyć bramki **bez** wywołania `initiativeExists`/`initiativeUnifiedReader` w tej samej funkcji, nie wystąpienia literału `SELECT id FROM initiatives WHERE id` | Licznik spadł 50→48 przez przepisanie SQL na `SELECT 1 AS found`; przy wymogu parytetu OFF nigdy nie spadnie do 3 i da się go obniżyć bez przełączania bramki (§4) | Nowa komenda na tipie ma dać **47**, a na markerze **50** |

FIX-y 1–3 są warunkiem włączenia flagi. FIX-4 i FIX-6 są warunkiem **kolejnego** bloku,
nie scalenia tego. Szacowany rozmiar: FIX-1 ~30 min, FIX-2 ~40 min, FIX-3 ~40 min,
FIX-5 ~90 min (największy), FIX-4/6 po ~20 min.

---

## 9. CO ZOSTAJE — I KTO MA TO ZROBIĆ

Wykonano **1,5 etapu z ośmiu roboczych** (E1 + 2/47 bramek E3 + kosmetyka E1c).
To jest ok. **15 %** zakresu instrukcji. Blok był **za duży** — i to jest główna lekcja
organizacyjna, nie porażka wykonawcy: Codex zatrzymał się uczciwie zamiast udawać.

| Pozycja | Rozmiar realny | Rekomendacja |
| --- | --- | --- |
| **E3 — 45 pozostałych bramek** | mechaniczne, ale 17 plików × test | **Robotnik wewnętrzny (Sonnet), 3 paczki po ~15 bramek**, każda: podmiana + test realdb + mutacja. Wzorzec już istnieje w 2 plikach Codexa — to jest kopiowanie, nie projektowanie |
| **E8 — 7/7** | zależy od E3 (powierzchnie 4 i 6) i od projekcji Mojej Pracy | **Dopiero PO E3.** Dziś 4 z 7 powierzchni nie ma czego pokazać — zielony E8 wymaga realnych projekcji, nie poprawek testu. Robotnik wewnętrzny po E3 |
| **E2 — sześciu pisarzy legacy** | projekt kontraktu + 6 komend + 6 testów | **Codex 2b**, ale **wyłącznie ten jeden temat** i **po połowie**: blok „E2a — trzy komendy (milestones, resources, budget-items)", potem „E2b — trzy (staffing, gate-roles, move)" |
| **E4 — projekcja ocen** | nowy plik + 37 bramek + przepięcie klienta | **Codex 2c, osobny blok** — to jest samodzielna robota wielkości całego CODEX1 |
| **E5 — pokrycie aliasów finansowych** | pomiar + skrypt + test | **Robotnik wewnętrzny**; most istnieje, to jest pokrycie, nie architektura |
| **E6 — tożsamość artefaktów** | odczyt nad dwoma magazynami + policzenie 65/136 | **Robotnik wewnętrzny**, po decyzji właściciela o osieroconych linkach |
| **E7 — seed demo pisze do kanonu** | jeden `INSERT` obok istniejącego | **Robotnik wewnętrzny, 1 godzina** — najtańsza pozycja z całej listy, a powstrzymuje powiększanie rozjazdu przy każdym otwarciu demo. **Zrobić najpierw** |

**Reguła na następne zlecenia dla Codexa: blok = JEDEN etap rdzeniowy, nie dziewięć.**
Ten blok miał 2082 linie instrukcji i 9 etapów; dostarczył 1,5. Blok o połowie mniejszy
(E2a albo E4 same) ma szansę wrócić kompletny, z dowodami mutacyjnymi, których tu zabrakło.

---

## 10. NIEZWERYFIKOWANE (mówię wprost, czego NIE zmierzyłem)

1. **Pełny korpus testów** — przebiegłem 3 pakiety (E1 realdb, E1 klient, moja sonda) + odczyt E8.
   Nie wiem, czy dostawa nie psuje któregoś z pozostałych pakietów; `tsc` zielony to nie to samo.
2. **Cykl migratora** `dry-run → apply ×2 → verify → rollback → verify` na mojej kopii — nie wykonany.
   Ocena E1c jest **statyczna** (czytanie diffu), nie behawioralna. `md5` tabeli `initiatives`
   przed/po nie został przeze mnie potwierdzony.
3. **Zachowanie przeglądarki** — zero zrzutów, zero klikania. Mówię o kodach HTTP i o łańcuchu
   w kodzie, nie o tym, co widzi oko. Wniosek z §5.6 („toast `HTTP 409 Conflict`") jest wyprowadzony
   z odczytu `handleResponse`/`normalizeApiError`, **nie z zobaczonego ekranu**.
4. **Pozostałe 45 bramek** — nie sprawdzałem, czy któraś już dziś zwraca coś innego niż zakłada instrukcja.
5. **Cztery zapytania filtrujące z `FIX-6` odbioru W1/W2** (`?limit=10`, `?source=assessment`,
   `?priority=high`, `?projectId=unassigned`) — **nie zmierzone przy ON i OFF.** Blok ich nie dotknął,
   ale to jest warunek włączenia flagi odczytu i ktoś musi go zmierzyć przed ON.
6. **Hałas w logach** (`C1-FIX-5`, ≤1 linia ostrzeżenia na żądanie) — nie policzony.
7. **Liczby z kopii stagingu właściciela** dla 105 rekordów bez `project_id`/`owner_business_id` —
   poza zakresem tego odbioru; pytanie do właściciela z raportu Codexa **pozostaje otwarte**.
8. **`ScenarioAssumptionsView.tsx`** — potwierdziłem, że woła `Api.updateInitiative`,
   ale nie sprawdziłem, jakie pola wysyła (czyli czy też dostanie `409`).

---

## DOWODY

`evidence/c6-odbior-codex2/` (w repo, `git add -f`, bez binariów):

| Plik | Co zawiera |
| --- | --- |
| `pomiary-w1.txt` | K1 na markerze i tipie, migracje, `tsc`, stan bazy |
| `mutacje.txt` | cztery dowody mutacyjne z komendami i wynikami w obie strony |
| `runtime-ON.json` | macierz 7 powierzchni, zapis, idempotencja, `409`, tenant, wydajność — flagi ON |
| `runtime-OFF.json` | to samo przy flagach OFF (linia bazowa = marker) |
| `mutacja-M3-e3-results.json` | pomiar po wyłączeniu czytnika kanonicznego w Wynikach |
| `mutacja-M4-tenant.json` | pomiar po zdjęciu `organization_id` z `findById` |

Sonda `c6probe.tmp.pg.test.ts` była plikiem **tymczasowym** i **nie wchodzi do repo** —
jej pełne wyniki są w dwóch plikach `runtime-*.json` powyżej.
Baza `consultify_kopia_c6` została **skasowana** po zakończeniu pomiarów.
