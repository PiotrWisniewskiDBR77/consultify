# ODBIÓR W1 + W2 — CODEX 3 „Finanse MINIMUM" (F-M2/M3/M4/M6/M7)

Odbiorca: sesja Opus (C5). Tryb: trójwarstwowy W1 (kod vs kontrakt) + W2 (runtime na realnym
PostgreSQL). Wzór formy: `CODEX1_INICJATYWY/97_ODBIOR_W1_W2.md`, `.../96_ODBIOR_C2_E3_E5.md`.

---

## 0. Metryka odbioru

| Pozycja | Wartość (zmierzona przeze mnie) |
| --- | --- |
| Worktree odbioru | `/Users/piotrwisniewski/Developer/wt/c5-odbior-codex3` |
| Gałąź odbioru | `mvp/c5-odbior-codex3-20260911` |
| SHA odbierany (`git rev-parse HEAD` po wejściu) | `39ea4ce7f225c8f64fa0076af0ebfbbb46ec627e` |
| Marker/baza Codexa | `19440011e9132577c8f3a6d1704ec00ddc1da8e4` |
| `merge-base --is-ancestor 19440011e9 mvp/inicjatywy-lancuch-20260907` | **TAK** — marker jest przodkiem linii integracyjnej |
| Commity dostawy | 5: `072e62c607` (E1) · `dc35ce7d2a` (E2) · `4958b7efd7` (E3) · `599d4e0ca3` (E4) · `39ea4ce7f2` (E7 raport) |
| Baza runtime | `consultify_kopia_c5` w kontenerze `consultify-pg18` (PG18, `127.0.0.1:54418`), `TEMPLATE consultify_staging_1009` |
| Stan bazy odbioru | 8 organizacji, `finance_business_versions` DRAFT 18, `finance_lineage_edges` 2, `finance_stmt_lines` 238, 7 × `STATEMENT_PACK` — **dane CD PROJEKT obecne** (org `a3e05d4a-…`) |
| Zewnętrzne połączenia | ZERO (brak Railway/demo/staging/produkcji; `server.env` nie ładowany) |
| Zrzuty ekranu | ZERO — E4 nie osadził powłoki, nie ma czego pokazać |
| Baza kopii po pracy | **DROP wykonany** (patrz §11) |
| Czas pracy | ~70 min |

**★ Znalezisko proceduralne o samej dostawie.** Instrukcja bloku
(`CODEX3_FINANSE_MINIMUM/01_INSTRUKCJA.md`, 1618 linii) **nie znajduje się w drzewie gałęzi
Codexa**. Powstała w commicie `0efd83ed93`, który **nie jest przodkiem** `39ea4ce7f2`
(`merge-base --is-ancestor 0efd83ed93 39ea4ce7f2` → NIE). Gałąź Codexa niesie w tym katalogu
wyłącznie `98_RAPORT.md`. Kontrakt odczytałem z `git show 0efd83ed93:…/01_INSTRUKCJA.md`.
To nie jest naruszenie po stronie Codexa (instrukcja kazała startować **dokładnie z markera**),
ale przy scaleniu trzeba pamiętać, że dostawa nie zawiera własnego kontraktu.

---

## 1. Licencja per plik (W1a)

Pełny zbiór zmian `19440011e9..39ea4ce7f2` = **10 plików**.

| # | Plik | A/M | Wiersz licencji | Ocena |
| --- | --- | --- | --- | --- |
| 1 | `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX3_FINANSE_MINIMUM/98_RAPORT.md` | A | „JEDYNY nowy dokument, jaki wolno Ci utworzyć" | **OK** |
| 2 | `server/src/routes/v8/finance-v2/__tests__/lineageBulk.pg.test.ts` | A | `server/src/routes/v8/finance-v2/__tests__/*.pg.test.ts` (NOWE) — PEŁNA | **OK** |
| 3 | `server/src/routes/v8/finance-v2/__tests__/statementPackApproval.pg.test.ts` | A | jw. — PEŁNA | **OK** |
| 4 | `server/src/routes/v8/finance-v2/crosscutting.routes.ts` | M | WĄSKA: wyłącznie DODANIE trasy bulk-read; zakaz zmiany `GET /versions/:businessVersionId/lineage` | **OK** — patrz §1a |
| 5 | `server/src/services/finance/canonical/lineageService.ts` | M | WĄSKA: wyłącznie DODANIE funkcji wielo-`businessVersionId`; zakaz zmiany `getAncestors`/`getDescendants` | **OK** — patrz §1a |
| 6 | `src/components/Finance/statementPackWorkspaceV2/deriveStatementTable.ts` | M | PEŁNA — rdzeń E4 | **OK** |
| 7 | `src/services/api/financeV2.api.ts` | M | WĄSKA: wyłącznie DODANIE klienta bulk-read | **OK** — czysto addytywne (jedna nowa funkcja + jeden import typu) |
| 8 | `src/services/api/financeV2.types.ts` | M | **BRAK W TABELI LICENCJI** → domyślnie TYLKO ODCZYT | **NARUSZENIE FORMALNE** — patrz §1b |
| 9 | `src/components/Finance/statementPackWorkspaceV2/__tests__/codex3FinanceMinimum.contract.test.ts` | A | tabela wymienia `tests/**` i `server/src/**/__tests__/**`; **`src/components/**/__tests__/**` nie jest wymienione** | **NARUSZENIE FORMALNE (drobne)** — patrz §1b |
| 10 | `src/components/Finance/statementPackWorkspaceV2/__tests__/deriveStatementTable.test.ts` | M | jw. | **NARUSZENIE FORMALNE (drobne)** — jw. |

Kontrola rozłączności (lista „JAWNIE NIE ZAPISZE", komenda z §1013 instrukcji, uruchomiona
przeze mnie na pełnym diffie): **BRAK NARUSZEŃ**. Nie tknięto `auth.middleware.ts`, `Gateway.ts`,
`betaGate.middleware.ts`, `effectiveAccessService.ts`, `betaMenuStatus.ts`, `menuConfig.ts`,
`AppRoutes.tsx`, `src/components/standard/**`, `BaselineWorkspace`, `Finance/Valuation/**`,
`tests/setup.ts`, żadnego `vitest*.config.ts`/`playwright*.config.ts`, `_backup/**`,
`MVP_FINAL_ZAMROZONE.json`, `OWNER_DECISION_LEDGER`, `F1_FINANSE_*`.

### 1a. Addytywność E3 — sprawdzona linia po linii

* `crosscutting.routes.ts`: dodano helper `toLineageDto` i **jedną** nową trasę
  `POST /versions/lineage-edges/bulk-read` (linie 30–71). Jedyna zmiana w istniejącej linii to
  rozszerzenie listy importów o `getLineageForBusinessVersions`. Istniejące cztery `router.get`
  (`:78`, `:126`, `:160`, `:193`) — **bajt w bajt bez zmian**, kształt odpowiedzi i kody błędów
  nietknięte. Ścieżka `/versions/lineage-edges/bulk-read` nie koliduje z
  `POST /versions/lineage-edges` z `lineage-navigator.routes.ts:459` (inna, dłuższa ścieżka;
  potwierdzone runtime'em — patrz §5).
* `lineageService.ts`: dopisano **jedną** funkcję `getLineageForBusinessVersions` na końcu pliku
  (`:344`). `getAncestors`/`getDescendants` i ich sygnatury bez zmian.
* `financeV2.api.ts`: dopisano `getFinanceVersionLineageBulk`; żaden istniejący eksport nie
  zmieniony.
* `financeV2.types.ts`: dopisano `interface BulkVersionLineageDto` (`:1145-1148`). Żadne
  istniejące pole nie zmienione. **Kontrola zgodności DTO:** serwer zwraca `sourceDisplayName`,
  `sourceNaturalKey`, `targetDisplayName`, `targetNaturalKey`; `LineageEdgeDto:1130-1133` już je
  ma jako opcjonalne → **kontrakt klient↔serwer jest spójny**, nie ma cichego rozjazdu.

### 1b. Naruszenia formalne licencji — waga

Oba naruszenia są **addytywne i bez promienia rażenia**:

* `financeV2.types.ts` — pliku brakuje w tabeli licencji, choć wiersz `financeV2.api.ts` zamawia
  „DODANIE klienta odczytu zbiorczego", a klient bez DTO jest nienapisywalny. To **luka
  instrukcji**, nie samowola Codexa. Odnotowuję i **nie traktuję jako powodu odrzucenia**.
* trzy pliki testowe w `src/components/**/__tests__/**` — tabela licencjonuje `tests/**` i
  `server/src/**/__tests__/**`, pomija front. Ta sama klasa luki. Bez konsekwencji.

---

## 2. Migracje

* Nowe pliki w `server/migrations/`: **ZERO**. `git diff --name-only 19440011e9..39ea4ce7f2 --
  server/migrations` → 0 plików.
* Zajęte numery w przedziale licencyjnym `20262150`–`20262159`: **0** (`ls server/migrations |
  grep -cE "^2026215[0-9]"`).
* Najwyższy zajęty numer w repo: **20262107** (zgodny z liczbą autora).
* Żaden istniejący plik migracji nie zmodyfikowany.
* **Runner dwukrotnie na mojej kopii** (`npx tsx server/scripts/migrate.postgres.ts`,
  `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=…consultify_kopia_c5`):
  przebieg 1 → `Applying migrations: 0` + `✅ Postgres migrations complete`, `EXIT=0`;
  przebieg 2 → identycznie, `EXIT=0`. Dowody: `evidence/c5-odbior-codex3/migracje-1.txt`,
  `migracje-2.txt`.
* Wniosek: `Z40` (addytywność, zero `DROP`/`RENAME`/`DELETE`/`TRUNCATE`) **niemożliwy do
  naruszenia** — nie ma ani jednej migracji.

---

## 3. Zakazy Z1–Z46 — to, co dało się zmierzyć w kodzie

| Zakaz | Wynik pomiaru | Komenda / dowód |
| --- | --- | --- |
| `Z1` push | **CZYSTO** — gałąź `codex/finanse-minimum-20260911` żyje tylko lokalnie w vaulcie | `git branch -a --contains 39ea4ce7f2` → jedna gałąź lokalna, zero `remotes/*` |
| `Z10` flagi | **CZYSTO** — `VITE_FINANCE_MINIMUM` ma **0 użyć produkcyjnych**; jedyne trafienie to asercja w czerwonym kontrakcie E1 | `grep -rn "VITE_FINANCE_MINIMUM" src server` → 1 trafienie, test |
| `Z13` dokumenty | **CZYSTO** — dokładnie jeden nowy plik w `docs/` (`98_RAPORT.md`); zero logów/JSON-ów w repo | `git diff --name-only … -- docs` |
| `Z18` infrastruktura testowa | **CZYSTO** — zero zmian w `tests/setup.ts`, `tests/helpers/**`, `vitest*.config.ts`, `assertRealPostgres.ts` | kontrola rozłączności §1 |
| `Z30` SMTP | **CZYSTO** — zero zmiennych SMTP w diffie, zero uruchomień `server/src/index.ts`; ja też nie ładowałem `server.env` | `git diff … \| grep -iE "SMTP\|MAIL"` → pusto |
| `Z31` strażnik realdb | **CZYSTO** — `assertRealPostgresTestEnvironment()` wołany **bez argumentów** w obu testach `.pg.test.ts` | `lineageBulk.pg.test.ts:32`, `statementPackApproval.pg.test.ts:42` |
| `Z35` wyciszanie | **CZYSTO** — w całym diffie zero nowych `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `.skip(`, `.todo(`, `continue-on-error` | `git diff … \| grep "^+" \| grep -E …` → BRAK |
| `Z40` migracje | **CZYSTO** (§2) | — |
| `Z41` nazwa bazy parametrem | **CZYSTO** — zero skryptów danych w dostawie; testy czytają wyłącznie `process.env.DATABASE_URL` i `skipIf` gdy go nie ma; **zero literałów** `consultify_staging_1009`/`trolley`/`thomas` | `grep -rn` w dwóch nowych testach |
| `Z42` manifest tylko przy `--apply` | **N/D** — E6 niewykonane, manifest nie powstał | raport Codexa §7, potwierdzone brakiem plików |
| `Z43` zakaz przybijania stanu zastanego | **CZYSTO CO DO ZASADY** — 4 z 8 kontraktów E1 i 6 z 8 przypadków E2 są `it.fails`, oba pliki mają nagłówek `// CZERWONY Z ZAŁOŻENIA`. **ALE** patrz FIX-3 i FIX-4 — dwa z tych `it.fails` są niebezpieczne | `codex3FinanceMinimum.contract.test.ts:1-3`, `statementPackApproval.pg.test.ts:1` |
| `Z45` ciche połknięcia | **CZYSTO** — zero nowych `catch(() => {})`; zastane **7** potwierdzone moim grepem (`FinanceSavedViewsPanel.tsx:118`, `FinanceHub.tsx:1283,1284,1285,1287,1288,1290`) | `grep -rn "catch(() => {})" …` → 7 |
| `Z46` / `DEC-461` i18n | **NARUSZONE — patrz FIX-1.** Zero kluczy dopisanych do `public/locales/{pl,en}/translation.json`, a E3 wprowadza **dwa nowe komunikaty użytkownika**, w których treścią jest **surowy kod techniczny** | `crosscutting.routes.ts:59,63` |
| `Z15` LLM | **CZYSTO** — zero wywołań `llmService`/`/api/ai`/`GoogleGenerativeAI` w diffie | `git diff … \| grep -i` → pusto |
| `Z22` realny Gateway | **CZYSTO** — oba testy montują `ApiGateway.getInstance().initializeRoutes(app)`, nie goły router | `lineageBulk.pg.test.ts:56`, `statementPackApproval.pg.test.ts:65` |
| `Z29` `--retry=0` | **CZYSTO** — `{ retry: 0 }` w opcjach `describe` obu plików; ja też biegłem z `--retry=0` | — |

---

## 4. Liczby: „Codex twierdzi" vs „ja zmierzyłem"

| K | Co | Codex | JA (własna komenda na `39ea4ce7f2`) | Werdykt |
| --- | --- | --- | --- | --- |
| K1 | klasy crimson w Finansach+Economics | 34 | **34** | ZGODNE |
| K1b | pliki z crimsonem | 9 | **9** | ZGODNE |
| K2 | nieoznaczone `<table>` | 14 | **14** | ZGODNE (F1 „13" pozostaje błędem arytmetycznym F1) |
| K2b | wszystkie `<table>` | 22 | **22** | ZGODNE |
| K4 | trasy w `crosscutting.routes.ts` | 4 GET + 1 bulk POST | **5** (`:53` POST, `:78/:126/:160/:193` GET) | ZGODNE |
| K5 | `ArtifactRightPanel`/`<aside>` w karcie pakietu | 0 | **0** | ZGODNE — E4 powłoki NIE osadził |
| — | ciche `catch(() => {})` | 7 | **7** | ZGODNE |
| — | migracje w `20262150-59` | 0 | **0** | ZGODNE |
| — | najwyższy numer migracji | 20262107 | **20262107** | ZGODNE |
| K8 | zastane czerwone testy | 29 (autor instrukcji podał cudze 27) | **29** | ZGODNE |
| §0.4a | zasięg testów PO | 750 nazw / 721 passed / 29 failed | **750 / 721 / 29** | ZGODNE **co do liczby**, z zastrzeżeniem poniżej |
| K3 | wersje biznesowe wg statusu | „0 na świeżej bazie (autor: DRAFT 18)" | **DRAFT 18** na kopii stagingu | **ROZJAZD — patrz niżej** |

**★ Sprostowanie do K3 i do §0.4a — najważniejsza korekta liczbowa tego odbioru.**
Codex zbudował **świeży kontener z samymi migracjami** (`cx-codex3-pg`, baza `cx_codex3_finanse`),
więc każdy jego pomiar danych („0 BV", „0 krawędzi", „nie zmierzono wierszy bez źródła")
opisuje **pustą instalację, nie produkt**. Na kopii stagingu wszystkie liczby autora instrukcji
**potwierdzają się co do jednego**: `DRAFT 18`, `STATEMENT_TO_ANALYSIS 2`, `STATEMENT_PACK 7`,
`VALUATION_CASE 4`, `HISTORICAL_ANALYSIS 3`, `BASELINE_MODEL 2`, `PREDICTION_SCENARIO 2`,
`finance_stmt_lines 238`. Zdanie z raportu Codexa „na świeżej bazie nie ma 18 DRAFT; było 0"
jest **prawdziwe o jego kontenerze i nieprawdziwe o produkcie**. Konsekwencja praktyczna:
**E3 nigdy nie został uruchomiony przeciw realnym danym rodowodu** — ja to zrobiłem (§5).

Dodatkowo: liczba „744→750 nazw" u Codexa nie jest zasięgiem **całego frontu**, tylko pakietu
`src/components/Finance` + `src/components/Economics` — mój przebieg dokładnie tego zakresu daje
identyczne 750/721/29. Raport nie mówi tego wprost; przy scaleniu nie wolno tej liczby czytać
jako „cały front".

---

## 5. Runtime na realnym PostgreSQL (W2)

Środowisko każdego biegu (jedna linia, `Z26`):
`RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true
ENABLE_TEST_AUTH_BYPASS=false DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54418/consultify_kopia_c5
JWT_SECRET=<43 znaki> vitest --config server/vitest.config.ts --retry=0`.

**★ Pułapka runnera, którą sam złapałem i którą MUSI znać robotnik.** `server/vitest.config.ts`
ma `include: ['src/**', 'tests/**']` i **root = `process.cwd()`**. Uruchomienie z korzenia repo
daje `No test files found, exiting with code 1` — czyli **fałszywy „0 testów", nie PASS**.
Biegi serwerowe trzeba odpalać **z katalogu `server/`** ze ścieżką `src/routes/...`.
Druga pułapka: `JWT_SECRET` krótszy niż **32 znaki** przechodzi walidację konfiguracji z błędem
i **każde uwierzytelnione żądanie kończy się `401`** — mój pierwszy przebieg E3 dał przez to
7/8 czerwonych, co nie było defektem produktu.

### 5a. Tabela testów

| Etap | Plik | Codex | JA | Uwaga |
| --- | --- | --- | --- | --- |
| E3 | `server/src/routes/v8/finance-v2/__tests__/lineageBulk.pg.test.ts` | 8/8 | **8 passed / 0 failed** | POTWIERDZONE na kopii stagingu (dowód: `evidence/c5-odbior-codex3/e3-lineage.json`) |
| E2 | `server/src/routes/v8/finance-v2/__tests__/statementPackApproval.pg.test.ts` | „2 zielone, 6 czerwonych kontraktów" | **8 „passed"** — z czego **6 to `it.fails`, tzn. ciała nadal padają** | `evidence/…/e2-approval.json` + `e2-bez-itfails.json` |
| E1+E4 | `codex3FinanceMinimum.contract.test.ts` + `deriveStatementTable.test.ts` | 33/33 | **33 passed / 0 failed** | z czego 4 to `it.fails` (E1) |
| regresja modułu | `src/components/Finance` + `src/components/Economics` | 750/721/29 | **750 / 721 / 29** | lista czerwonych bez zmian |

### 5b. Dowód mutacyjny — powtórzony przeze mnie samodzielnie

Mutacja **E3 scope organizacji**: w `lineageService.ts` zamieniłem
`WHERE e.organization_id = ?` na `WHERE (e.organization_id = ? OR TRUE)` (odłożenie oryginału
przez `cp`, **nie** `git stash` — `Z27`).

* **RED:** 8 total → 7 passed / **1 failed**, dokładnie
  `does not disclose another organization lineage`. Dowód: `evidence/…/mutacja-e3-org-red.json`.
* **Przywrócenie przez `cp`**, `git diff --stat` → **pusty**.
* **GREEN:** wcześniejszy przebieg 8/8 na identycznym drzewie.

Wniosek: test tenant-scopingu **realnie broni** izolacji, nie jest ozdobą. Dowód mutacyjny nr 1
Codexa **odtworzony niezależnie**.

### 5c. E3 na realnych danych i tenant-scoping

`POST /api/v8/finance-v2/versions/lineage-edges/bulk-read` przeszedł przez **realny
`ApiGateway`** (`initializeRoutes`), realny `verifyToken` (bypass wyłączony), podpisany JWT,
na bazie z **realnymi 2 krawędziami** `STATEMENT_TO_ANALYSIS` organizacji `a3e05d4a-…`
(ta sama, która trzyma pakiet
„Grupa Kapitałowa CD PROJEKT — skonsolidowane sprawozdanie 2025 (z 2024)").

Zmierzone kody odpowiedzi (`Z34`):
* bez nagłówka `Authorization` → **401** (nie 404 — `ENABLE_V8_GLOBAL` działa);
* dwa BV własnej organizacji → **200**, `edges` = 1, `businessVersionIds` w kolejności wejścia;
* nazwy zamiast hashy → **200**, `sourceDisplayName`/`targetDisplayName` wypełnione;
* duplikaty ID → **200**, deduplikacja przed zapytaniem;
* **obca organizacja pytająca o cudze BV → 200 z `edges: []` — ZERO WYCIEKU**;
* nieistniejące BV → **200**, uczciwa pusta lista (`Z16` — nie udawany błąd);
* 101 unikalnych ID → **400** `BUSINESS_VERSION_IDS_LIMIT_EXCEEDED`;
* pusty string w tablicy → **400** `INVALID_BUSINESS_VERSION_IDS` (a **nie** fałszywa pustka —
  `Z23` spełnione).

Trasa jest zamontowana **za** `createModuleGate('MODULE_ECONOMICS')` (`Gateway.ts:1480`), więc
dziś odpowiada tylko rolom zwolnionym z bety.

### 5d. E4 — czy gałąź „flaga OFF" niczego nie psuje

`deriveStatementTable` po zmianie **nadal zwraca** `periods/rows/warnings/entityIds` sekcji `ALL`
(nowy `DerivedStatementTable extends DerivedStatementTableSection`), a `pickHeaderCurrencyAndScale`
tylko **rozszerzono** o przyjmowanie sekcji. Jedyny konsument produkcyjny
(`CanonicalStatementTableV2.tsx:126-127`) kompiluje się i zachowuje bez zmian.

Pomiar zamiast domysłu: podmieniłem `deriveStatementTable.ts` na wersję z markera i uruchomiłem
`CanonicalStatementTableV2.test.tsx` + `SourceEvidencePanel.test.tsx`:
**marker 20 total / 17 passed / 3 failed** — **Codex 20 / 17 / 3**. Identycznie.
E4 **nie wprowadził regresji** u konsumenta. `git diff --stat` po przywróceniu — pusty.

### 5e. tsc / esbuild

* `node_modules/.bin/tsc -p server/tsconfig.json --noEmit` → **kod wyjścia 0**, zero błędów
  (mierzone bez potoku; dowód `evidence/c5-odbior-codex3/tsc-server.txt`).
* esbuild per dotknięty plik frontu: `financeV2.api.ts` → 0, `financeV2.types.ts` → 0,
  `deriveStatementTable.ts` → 0.
* Pełnego `tsc` frontu nie uruchamiałem (8 GB — robi nadzorca w bramce linii).

---

## 6. Trzy STOP-y — ocena merytoryczna

### STOP 1 — pozycja Finansów w menu · **UZNANY, OK**
`MODULE_ECONOMICS: 'closed'` w obu lustrach (`src/utils/betaMenuStatus.ts:51`,
`server/src/sharedRuntime/utils/betaMenuStatus.ts:52`). Pliki na liście „TYLKO ODCZYT — DECYZJA
WŁAŚCICIELA". Codex zmierzył i nie ruszył. **Prawidłowo.**

### STOP 2 — preparer za BetaGate · **UZNANY, i defekt jest POWAŻNIEJSZY, niż Codex napisał**

Zmierzyłem to sam, przez realny Gateway, na własnej kopii — nie z grepa.

Odtworzenie tezy Codexa: wszystkie 6 czerwonych przypadków E2 pada **w tym samym miejscu** —
`POST /api/v8/finance-v2/artifacts` jako `FINANCE_ADMIN` → `403 {"code":"BETA_LOCKED"}`.
Potwierdzone (`evidence/…/e2-bez-itfails.json`, bieg z podmienionym `it.fails` → `it`).

**Pomiar, którego Codex nie zrobił — czy JAKAKOLWIEK rola dowozi pakiet do `APPROVED`:**

| Krok jako **OWNER** | Kod | Ciało |
| --- | --- | --- |
| `POST /artifacts` (STATEMENT_PACK) | **201** | utworzony |
| `POST /versions/:bv/transitions` `submit_for_review` | **403** | `Role approver may not perform submit_for_review on a version in DRAFT` |
| `POST /versions/:bv/transitions` `start_review` | **409** | `version is in status DRAFT, which has no such transition` |
| `POST /models/:artifactId/approve` | **409** | `no version of this model is in IN_REVIEW` |
| zimny odczyt drugim klientem `pg` | — | `status=DRAFT, approved_by=null` |

`ADMIN` → `POST /artifacts` **201** (przechodzi betę, mapuje się tak samo na `approver`).
`MEMBER` → **403 BETA_LOCKED**.

**Przyczyna, plik:linia:**
* `server/src/middleware/betaGate.middleware.ts:38-47` — `createModuleGate` przepuszcza
  **wyłącznie** `OWNER`, `ADMIN`, `ADMINISTRATOR`, `SUPERADMIN`.
* `server/src/routes/v8/finance-v2/_shared.ts:33-38` — `mapOrgRoleToFinanceRole`:
  `owner|admin → approver`, `editor|finance_editor → preparer`, `finance_admin → finance_admin`,
  **reszta → `viewer`** (czyli `ADMINISTRATOR` i `SUPERADMIN` → `viewer`).
* `server/src/services/finance/canonical/lifecycleService.ts:87,95,111,127` — `submit_for_review`
  i pokrewne przejścia mają `allowedRoles: ['preparer','finance_admin']`.

**Część wspólna zbioru „przechodzi BetaGate" i zbioru „może wykonać przejście" jest PUSTA.**
Dziś **żadna rola nie może wyprowadzić żadnej wersji finansowej ze stanu `DRAFT` przez API** —
i nie dotyczy to tylko pakietu sprawozdań, tylko **całego cyklu życia modułu Finanse**
(ten sam `lifecycleService` rządzi wszystkimi przejściami). To wyjaśnia też pomiar
`DRAFT 18 / APPROVED 0` na stagingu: nie „nikt nie kliknął", tylko **nie da się**.

**Werdykt:** to **realny defekt produktu do rejestru**, nie wina Codexa. Codex miał licencję
„TYLKO ODCZYT" na wszystkie trzy pliki i słusznie dostarczył czerwony kontrakt zamiast obejścia.
Jego opis jest prawdziwy, ale **zaniża zasięg** („OWNER/ADMIN mapuje się na approver" — tak, i
skutkiem jest zablokowanie **całego** łańcucha, nie tylko zatwierdzenia).

### STOP 3 — przewód listy (ID legacy vs kanoniczne BV) · **UZNANY, ale rekomendacja inna**
Teza Codexa jest prawdziwa: `FinanceHub.tsx` karmi listę identyfikatorami legacy
(`financial_statement_packs:*`), a `bulk-read` przyjmuje `business_version_id`. Potwierdziłem to
w danych: 3 z 7 pakietów `STATEMENT_PACK` mają `natural_key` w formie
`financial_statement_packs:<uuid>` i **puste `display_name`** — most legacy→kanon jest
niekompletny. Podanie `statement.id` do E3 dałoby uczciwą pustkę, nie 404, ale bezużyteczną.
**Czy zależy to od bloku Codex 2 (jeden magazyn)?** Nie w 100%. Tabela `finance_artifact_aliases`
(13 wierszy) już dziś przechowuje mapowanie legacy→kanon. **Da się prościej:** rozszerzyć
`bulk-read` o rozwiązywanie aliasów po stronie serwera (jedno `JOIN` w tej samej, już
zalicencjonowanej funkcji) zamiast czekać na pełny „jeden magazyn". To decyzja nadzorcy, nie
Codexa — odnotowuję jako alternatywę tańszą o cały blok.

---

## 7. Werdykt per etap

| Etap | Werdykt | Uzasadnienie jednym zdaniem |
| --- | --- | --- |
| **E1** (testy charakteryzujące) | **SCAL Z FIX-EM** | Osiem kontraktów jest uczciwie czerwonych i zgodnych z `Z43`, ale dwa `it.fails` zamawiają złą naprawę i jeden czyta pliki przez `process.cwd()` (FIX-3, FIX-5). |
| **E2** (zatwierdzanie pakietu) | **SCAL Z FIX-EM** | STOP jest merytorycznie prawdziwy i potwierdzony na moim runtime, ale `it.fails` na przypadku bezpieczeństwa („viewer dostaje 403") **zamieni przyszłą dziurę w zielony wynik** — to trzeba naprawić przed scaleniem (FIX-4). |
| **E3** (bulk-read rodowodu) | **SCAL** | Czysto addytywny backend, 8/8 na realnym Gateway + realnym PG + realnych danych, tenant-scoping potwierdzony niezależnym dowodem mutacyjnym; jedyny dług to komunikaty błędów (FIX-1). |
| **E4** (derywacja 3 sekcji) | **SCAL** | Czysta funkcja, 33/33, konsument bez regresji (20/17/3 przed i po) — powłoka/aside/flaga świadomie nieosadzone i tak zaraportowane. |
| **E5** (crimson + kanon tabel) | **NIE DOTYCZY — NIE WYKONANE** | Zero commitów; 34 klasy crimson i 14 nieoznaczonych tabel stoją nietknięte (potwierdzone moim pomiarem). |
| **E6** (seed EN CD PROJEKT) | **NIE DOTYCZY — NIE WYKONANE** | Zero skryptu, zero manifestu, zero `apply` — `Z41`/`Z42` niemożliwe do naruszenia. |
| **E7** (raport) | **SCAL Z ERRATĄ** | Raport jest rzetelny i sam wskazuje własne luki, ale dwie liczby wymagają sprostowania w §4 (baza pusta ≠ produkt; „750 nazw" to moduł, nie front). |

**Werdykt zbiorczy: SCALIĆ dostawę (E1–E4 + raport) po wykonaniu FIX-1…FIX-4.**
Dostawa nie wprowadza żadnej zmiany widocznej dla użytkownika przy wyłączonych flagach: jedyne
dotknięte pliki produkcyjne frontu to `deriveStatementTable.ts` (addytywne, konsument bez zmian
zachowania) i `financeV2.api.ts`/`.types.ts` (nowa funkcja bez wołacza). **Zgodnie z oczekiwaniem:
nic się nie zmienia.**

---

## 8. Lista FIX-ów dla robotnika (Sonnet)

**FIX-1 · Surowy kod techniczny jako komunikat użytkownika (P4 / `DEC-461` / `Z46`)**
* Gdzie: `server/src/routes/v8/finance-v2/crosscutting.routes.ts:59` i `:63`.
* Co: `sendError(res, 400, 'INVALID_BUSINESS_VERSION_IDS', 'INVALID_BUSINESS_VERSION_IDS')` —
  czwarty argument to **treść pokazywana użytkownikowi**, a wpisano w niego kod.
  To samo w linii 63.
* Dlaczego: `sendError` (`_shared.ts:56-57`) wstawia 4. argument do pola `error`, które UI
  renderuje. Wszystkie sąsiednie trasy podają zdanie
  (`analysis.routes.ts:46` → `'tier must be one of UNIVERSAL, INDUSTRY, ORG_CUSTOM'`;
  `crosscutting.routes.ts:86` → `'maxDepth must be a finite number'`). Codex złamał wzorzec
  własnego pliku o 27 linii wyżej.
* Jak: wpisać zdanie po angielsku w stylu sąsiadów (np.
  `'businessVersionIds must be a non-empty array of strings'`,
  `'businessVersionIds accepts at most 100 unique ids'`).
* Sprawdzenie: `lineageBulk.pg.test.ts` asercjuje `response.body.code`, **nie** `error` — więc
  test przechodzi bez zmian; potwierdzić `8 passed` po poprawce.

**FIX-2 · Uzupełnić tabelę licencji o `src/services/api/financeV2.types.ts`**
* Gdzie: `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX3_FINANSE_MINIMUM/01_INSTRUKCJA.md`,
  wiersz obok `src/services/api/financeV2.api.ts` (~linia 951).
* Co: dopisać wiersz „WĄSKA LICENCJA — wyłącznie DODANIE DTO"; analogicznie dopisać
  `src/components/**/__tests__/**` do wiersza testów.
* Dlaczego: klient bez DTO jest nienapisywalny — instrukcja zamawiała rzecz, na którą nie dała
  licencji. To luka kontraktu, nie samowola; naprawiamy dokument, nie kod.
* Jak sprawdzić: ponowne przejście listy z §1 daje zero naruszeń formalnych.

**FIX-3 · Czerwony kontrakt E1 zamawia naprawę, która niczego nie naprawi**
* Gdzie: `src/components/Finance/statementPackWorkspaceV2/__tests__/codex3FinanceMinimum.contract.test.ts:13-17` (`it.fails`, linia 13).
* Co: `it.fails('… approval is exposed under the statements route')` żąda aliasu
  `'/statements/:artifactId/approve'` w `models.routes.ts`.
* Dlaczego: zmierzyłem — trasa `POST /models/:artifactId/approve` **działa i odpowiada**
  (401 bez tokenu, 409 z tokenem OWNER-a). Blokadą **nie jest nazwa trasy**, tylko pusta część
  wspólna BetaGate × mapowania ról (§6 STOP 2). Alias byłby pracą bez skutku, a kontrakt
  utrwala fałszywą diagnozę.
* Jak: zastąpić ten kontrakt kontraktem na **realną** przyczynę — „istnieje rola, która
  przeprowadza `STATEMENT_PACK` z `DRAFT` do `APPROVED` przez `ApiGateway`" (jako `it.fails`,
  dopóki decyzja właściciela nie zapadnie).
* Sprawdzenie: `RUN_DB_TESTS=0 MOCK_DB=true npx vitest run <plik> --retry=0` → nadal 8 „passed".

**FIX-4 · `it.fails` na przypadku BEZPIECZEŃSTWA — bezpiecznik nagradza defekt**
* Gdzie: `server/src/routes/v8/finance-v2/__tests__/statementPackApproval.pg.test.ts:130`
  (`it.fails('rejects a viewer with 403 and leaves the row unchanged')`).
* Co: przypadek jest odwrócony — `it.fails` raportuje **PASS wtedy, gdy ciało padnie**.
* Dlaczego: dziś pada na `BETA_LOCKED` przy tworzeniu fikstury. Ale gdy BetaGate zostanie
  otwarty, a jednocześnie `viewer` **będzie mógł** zatwierdzić (czyli powstanie realna dziura),
  ciało też padnie — i suita dalej pokaże zielone. To dokładnie kształt „bezpiecznik nagradza
  defekt": im większy defekt, tym łatwiej przejść. Ten sam zarzut dotyczy `:153` (409 bez
  mutacji) i `:166` (wyścig dwóch zatwierdzeń).
* Jak: wydzielić budowę fikstury do osobnego, **zwykłego** `it`, które ma prawo być czerwone
  („nie da się utworzyć pakietu — BETA_LOCKED"), a same asercje bezpieczeństwa zostawić jako
  zwykłe `it` **poprzedzone `skipIf`** zależnym od powodzenia fikstury. Nigdy `it.fails` na
  asercji „atak odrzucony".
* Sprawdzenie: po otwarciu ścieżki roli test „viewer" musi **paść na czerwono**, jeśli viewer
  zatwierdzi — dowód mutacyjny: tymczasowo dodać `'viewer'` do `APPROVE_ALLOWED_ROLES` i
  potwierdzić czerwień, potem cofnąć przez `cp`, `git diff` pusty.

**FIX-5 · Kontrakt E1 czyta pliki przez `process.cwd()`**
* Gdzie: `codex3FinanceMinimum.contract.test.ts:9` (`const repoRoot = process.cwd()`).
* Co: test działa tylko uruchomiony z korzenia repo; z `server/` rozsypuje się na `ENOENT`.
* Dlaczego: to ten sam kształt, co pułapka runnera z §5 — pomiar zależny od katalogu, z którego
  ktoś przypadkiem odpalił vitest.
* Jak: liczyć korzeń od `import.meta.url` (`path.resolve(fileURLToPath(import.meta.url), '../../../../../..')`).
* Sprawdzenie: uruchomić ten sam plik z `server/` i z korzenia — oba razy 8 „passed".

---

## 9. Co zostaje — i kto ma to zrobić

| Pozycja | Stan | Rekomendacja |
| --- | --- | --- |
| **E5** — 34 klasy crimson (9 plików) + 14 nieoznaczonych `<table>` | nietknięte | **Robotnik wewnętrzny (Sonnet), commit per plik.** To praca mechaniczna, wysokokolizyjna, bez potrzeby kontekstu Codexa. Nie oddawać Codexowi 3b — marnotrawstwo. Bezpiecznik: `scripts/check-list-canon.sh` przed pushem. |
| **E6** — seed EN CD PROJEKT z trybami i manifestem | niewykonane | **Codex 3b.** Wymaga `--dry-run/--apply/--rollback/--verify`, `Z41`/`Z42`, i dyscypliny manifestu — to nie jest praca na jeden dyżur robotnika. Warunek wstępny: rozstrzygnięcie z §11 raportu Codexa (czy migrować zastany polski rekord). |
| **Przewód E3 do listy** (ID legacy → BV) | backend gotowy, front bez wołacza | **Robotnik wewnętrzny, ale PO decyzji nadzorcy**, którą z dwóch dróg: (a) czekać na Codex 2 „jeden magazyn", (b) rozwiązać aliasy w `getLineageForBusinessVersions` po stronie serwera (13 wierszy `finance_artifact_aliases` już istnieje). Rekomenduję (b) — tańsze o cały blok, mieści się w istniejącej licencji. |
| **E4 powłoka + `<aside>` + flaga `VITE_FINANCE_MINIMUM`** | derywacja gotowa, powłoki 0 | **Robotnik wewnętrzny** wg skilla `consultify-artefakty` (SPEC-A, archetyp D Matryca). Warunek `CLAUDE.md` §7: prototyp → OK Piotra → mój zrzut z dev-render → dopiero potem Piotr. |
| **BetaGate × mapowanie ról = zbiór pusty** | **REALNY DEFEKT PRODUKTU** | **Nie robotnik i nie Codex — decyzja właściciela + naprawa centralna z audytem.** Do rejestru jako pozycja własna. Dopóki `MODULE_ECONOMICS='closed'`, defekt jest niewidoczny dla użytkownika; w chwili otwarcia modułu Finanse będą **martwe w zapisie**. Zalecam wpis do rejestru **teraz**, nie przy otwieraniu. |
| **7 zastanych cichych `catch(() => {})`** | `FinanceSavedViewsPanel.tsx:118`, `FinanceHub.tsx:1283,1284,1285,1287,1288,1290` | Robotnik wewnętrzny, osobny dyżur; poza tym blokiem (`Z45` zabraniał Codexowi sprzątania). |

---

## 10. Twierdzenia niezweryfikowane w TYM odbiorze

1. **Pełny `tsc` frontu** — nie uruchomiony (8 GB). Zastąpiony esbuildem per dotknięty plik
   (3/3 zielone) i pełnym `tsc` serwera (exit 0). Bramkę frontu wykonuje nadzorca na linii.
2. **Zasięg testów całego frontu** — mierzyłem wyłącznie `src/components/Finance` +
   `src/components/Economics` (750/721/29). Nie twierdzę nic o pozostałych modułach.
3. **Porównanie po `fullName` przed/po** (`Z37`) — nie odtworzyłem listy 29 nazw z markera
   dla całego modułu; odtworzyłem ją **punktowo** dla jedynego zagrożonego konsumenta
   (`CanonicalStatementTableV2` + `SourceEvidencePanel`: 3 czerwone przed = 3 czerwone po).
   Twierdzenie Codexa o identycznym SHA-256 list `przed-failed-nazwy.txt`/`po-failed-nazwy.txt`
   przyjmuję **bez własnego dowodu**.
4. **Zachowanie E3 przy >100 realnych BV w jednym żądaniu** — sprawdzony tylko limit (400),
   nie wydajność. Codex nie udowodnił potrzeby indeksu i nie dodał migracji; ja też nie mierzyłem.
5. **Cokolwiek wizualnego** — zero zrzutów, bo nie ma czego renderować (K5 = 0).
   Wszystkie zdania o wyglądzie Finansów w tym odbiorze są zdaniami o kodzie, nie o obrazie.
6. **Artefakty Codexa poza repo** (`~/Developer/codex-wt/codex3-artefakty/`) — istnieją (28 plików,
   zgodne co do nazw z §14 raportu), ale **nie weryfikowałem ich sum SHA-256** ani zawartości
   poza tym, co odtworzyłem własnymi biegami.
7. **Czy `ADMINISTRATOR`/`SUPERADMIN` mają jakąkolwiek inną ścieżkę** — z lektury
   `_shared.ts:33-38` wynika mapowanie na `viewer`, ale **nie zmierzyłem** tego żądaniem HTTP
   (zmierzyłem `OWNER`, `ADMIN`, `MEMBER`, `FINANCE_ADMIN`).

---

## 11. Higiena stanowiska

* Baza `consultify_kopia_c5` — **utworzona z `TEMPLATE consultify_staging_1009` i usunięta
  (`DROP DATABASE`) po zakończeniu pomiarów.** Fikstury testowe (organizacje `codex3-lineage-*`,
  `codex3-approval-*`, `c5-e2-*`) zginęły razem z nią; **żadne dane pokazowe nie zostały tknięte**.
* Kontener `cx-codex3-pg` (port 6453) i inne bazy w `consultify-pg18` — **nie dotknięte**.
* Katalog właściciela `~/Developer/Consultify` — **nie modyfikowany** (jedyny kontakt: symlink
  `node_modules` do odczytu).
* Cudze worktree — **nie dotknięte i nie kasowane**. `git stash` — **ani razu**; stan odkładany
  przez `cp` (`Z27`).
* `git push` — **ZERO**.
* Dowody biegów: `evidence/c5-odbior-codex3/` (JSON-y vitest, logi migracji, `tsc`, esbuild,
  pomiar K-punktów, ścieżka ról OWNER/ADMIN/MEMBER). Bez binariów.

### 11a. Uczciwa uwaga o cudzej bazie (nie moja operacja, ale odnotowuję)

Przy wejściu w `consultify-pg18` (23:20) lista baz zawierała m.in. `consultify_kopia_n2`.
Po moim `DROP DATABASE consultify_kopia_c5` (23:31) tej bazy **już nie było**.
Moja komenda nazwała **wyłącznie** `consultify_kopia_c5` i zwróciła dokładnie jedno
`DROP DATABASE`. Najprawdopodobniej sprzątnęło ją równoległe stanowisko
(`~/Developer/wt/n2-karty-b`), ale **nie mogę tego udowodnić po fakcie** — dlatego zapisuję
obserwację zamiast milczeć. Jeżeli ktoś tej bazy potrzebował, punkt odtworzenia to
`CREATE DATABASE consultify_kopia_n2 TEMPLATE consultify_staging_1009`.
