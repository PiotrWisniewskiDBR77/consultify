# INSTRUKCJA DYŻURU nr 23 — Codex — „Finance: mechanika tylna wg kontraktu odzyskania — osiągalność kanonicznej powierzchni, kontrakt uprawnień i błędów, ochrona konfliktu, idempotencja, audyt mutacji, szew nieaktualności i ROI — WYŁĄCZNIE MECHANIKA TYLNA"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–22. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-26.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Ten dyżur jest inny niż poprzednie. Moduł **10 Finance nie miał panelu
eksperckiego** — nie ma oceny 4/10 ani listy siedmiu grzechów. Ma za to coś
mocniejszego: **kontrakt właścicielski wykonawczy**, wystawiony 2026-08-23:

```
docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/FINANCE_RECOVERY_AND_COMPLETION_CONTRACT_2026-08-23.md
```

**To jest Twoje główne źródło zakresu.** Czytasz go w całości, przed startem,
i przekładasz na pozycje z DoD. Ten dokument (instrukcja dyżuru) jest tylko
tłumaczeniem tamtego kontraktu na **tylną połowę** — front jest robiony osobno,
przez robotników wewnętrznych, po prototypie i akcepcie właściciela.

Pozostałe materiały wiążące, które czytasz **przed** startem (są w repo, na
Twojej bazie):

```
docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/MODULE_ACCEPTANCE.md
docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/FINANCE_G06_STATE_A11Y_DENOMINATOR_2026-08-23.md
docs/program/waves/WAVE_03_ACCEPTANCE/RESULTS_FINANCE_DAY4_REPORT_2026-08-25.md
docs/program/waves/WAVE_03_ACCEPTANCE/night-sweep-20260826/NIGHT_FIXES_A_REPORT_20260826.md
```

Dwa ostatnie są **raportami cudzych dyżurów**, nie kontraktami. Czytasz je po to,
żeby **nie powtórzyć cudzej pracy** i żeby zobaczyć, gdzie tamte dyżury postawiły
`STOP` z powodu **braku po stronie serwera** — bo dokładnie te braki są Twoje.

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

1. **★ CAŁE `src/` JEST POZA ZAKRESEM. Bez wyjątku.** Resolver kart, wspólny
   shell rejestrów, pięć workspace'ów, preview, menu 2/3, kanon wizualny,
   polonizacja, odłączenie `Benefits/*`, tryb próbki `financeOwnerSampleData` —
   **robią robotnicy wewnętrzni**, po prototypie i akcepcie właściciela na
   czystym zrzucie (CLAUDE.md reguła 7: właściciel **nigdy** nie jest pierwszym
   testerem wizualnym). Ty budujesz **TYŁ**: trasy, kontrakty odpowiedzi,
   semantykę zapisu, ochronę konfliktu, audyt, testy. Podział jest twardy — §1.6.
2. **Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej
   flagi.** Dotyczy to w szczególności `ENABLE_V8_GLOBAL`, `MODULE_ECONOMICS`
   i czterech flag workspace'ów Finance V3. Jeżeli uznasz, że pozycja wymaga
   otwarcia flagi — to jest **STOP**, nie improwizacja (CLAUDE.md reguła 9).
3. **Wszystko, co budujesz, musi być realne.** Trasa bez ścieżki zapisu = STOP.
   Brak API pod funkcją → wpis `BRAK_API` z kontraktem, **nigdy** trasa-widmo.
4. **★ ZAKAZ ATRAPY Z ZEWNĘTRZNYM SKUTKIEM (Z22 / `DEC-2026-08-26-108`).**
   Odpowiedź „sukces" + skutek widoczny na zewnątrz (zdarzenie audytu, wpis
   w outboxie, pokwitowanie, powiadomienie, eksport) **przy braku faktycznej
   zmiany w bazie** = odrzucenie pozycji. Dzień 19 poległ dokładnie na tym.
   W tym dyżurze pułapka jest bliżej niż zwykle: **pozycja E to dopisywanie
   zdarzeń audytu.** Zdarzenie audytu dla mutacji, która się nie wykonała, jest
   **wzorcową atrapą z zewnętrznym skutkiem** — audyt zapisujesz w tej samej
   transakcji co mutację albo wcale.
5. **★ Kontrakt właścicielski jest w ~70 % o froncie.** `FIN-REC-002`
   (resolver), `FIN-REC-003` (wspólny shell), `FIN-REC-012` (jakość wizualna
   i dostępność) i cała §3 (nawigacja, preview, `Back`) to **nie Twój dyżur**.
   Nie „przygotowujesz" pod nie kodu, nie dopisujesz do nich endpointów „na
   zapas". Twoje są tylne połowy `FIN-REC-004…011`, `013`, `014` — rozpisane
   w §1.2 i §1.8.
6. **★ Uczciwy pusty stan i uczciwy błąd merytoryczny > udawany wynik.**
   Kontrakt mówi to wprost: „**błąd merytoryczny zamiast `0` dla brakującej
   wartości**" (§4.2) i „nie może prezentować wyniku wyceny, jeżeli krytyczne
   źródła lub wagi są niepoprawne" (§4.5). Każda Twoja zmiana ma tę dyscyplinę
   **wzmacniać, nigdy nie rozcieńczać**.
7. **Odbiór wizualny i decyzja o pokazaniu właścicielowi = nadzorca, po dyżurze.**
   W raporcie piszesz „gotowe do odbioru przez nadzorcę", **nigdy** „gotowe do
   pokazania właścicielowi". Kontrakt ma na to własną skalę (§7): `CODE_PRESENT`
   → `TECHNICAL_PASS` → `READY_FOR_OWNER_REVIEW` → `OWNER_ACCEPTED`. **Najwyżej,
   co wolno Ci zadeklarować, to `TECHNICAL_PASS`.**
8. **`DEC-65` — dane demo są chronione, wspólna baza jest święta.** Zero Railway,
   zero zdalnych migracji/seedów, zero zapisów do wspólnej bazy demo. Migracje =
   `MIGRATION_PREPARED`, addytywne, kompatybilne wstecz, z dowodem idempotencji
   na jednorazowym lokalnym kontenerze.
9. **★ `DEC-05` — gałąź `codex/preserve-finance-owner-wip-20260823` jest
   ODRZUCONA i NIE WOLNO jej wskrzeszać.** Zweryfikowano wszystkie 1786 dodanych
   linii: 0 unikalnej wartości, 0 unikalnych kluczy tłumaczeń, drzewo jest
   ścisłym podzbiorem kandydata. **Nie czytasz jej, nie cherry-pickujesz z niej,
   nie „inspirujesz się" nią.** Zobacz też Z4.

Naruszenie tego ograniczenia = odrzucenie dyżuru, niezależnie od jakości reszty.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **gałąź `codex/m03-admin-20260824`**. Nadzorca podaje Ci
   **SHA commitu-markera** przy wklejaniu tej instrukcji.

   **SHA markera: «MARKER_SHA»**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

2. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/preserve-finance-owner-wip-20260823`, `codex/results-finance-day4-*`
   ani `codex/wave3-16-module-acceptance-*`.
   Załóż raport, wpisz pozycję STOP z wynikiem obu komend i zakończ dyżur.

   **Reguła rozejścia (`DEC-2026-08-26-95`).** Jeżeli marker **JEST** przodkiem,
   ale tip uciekł do przodu (nadzorca scalił coś po związaniu markera) — **to nie
   jest STOP**. Startujesz **dokładnie z markera**, wypisujesz w raporcie
   `git log --oneline <marker>..codex/m03-admin-20260824` i listę plików
   rozejścia; scalenie z nowszym tipem wykonuje nadzorca przy odbiorze.
   **Rebase w trakcie dyżuru: ZAKAZANY.**

3. **★ Weryfikacja stanu wejściowego (warunek wstępny, NIE formalność).**
   Sprawdzasz sam; wynik jest obowiązkową pozycją raportu:

   ```bash
   # (a) kanoniczna powierzchnia Finance V3 istnieje DOKŁADNIE tak
   ls server/src/routes/v8/finance-v2/                       # 15 plików .routes.ts + index.ts + _shared.ts
   grep -n "financeV2Router.use(requireActiveMembership)"    server/src/routes/v8/finance-v2/index.ts
   grep -n "requireCanonicalFinanceMutation"                 server/src/routes/v8/finance-v2/index.ts
   grep -n "v8Router.use('/finance-v2'"                      server/src/routes/v8/index.ts
   grep -n "mountedFinanceStatementRouter"                   server/src/Gateway.ts
   grep -n "app.use('/api/v8', v8FeatureGate, v8Router)"     server/src/Gateway.ts

   # (b) rdzeń, który uzupełniasz — musi istnieć DOKŁADNIE tak
   grep -n "readExpectedVersion\|readIdempotencyKey\|mapOrgRoleToFinanceRole" server/src/routes/v8/finance-v2/_shared.ts
   grep -n "/artifacts/:artifactId/capabilities"             server/src/routes/v8/finance-v2/artifacts.routes.ts
   grep -n "freshness-events"                                server/src/routes/v8/finance-v2/crosscutting.routes.ts
   grep -n "derived-analysis"                                server/src/routes/v8/finance-v2/lineage-navigator.routes.ts
   ls server/src/services/finance/canonical/roiFinanceLinkAdapter.ts
   ls server/src/services/finance/canonical/roiFinanceReconciliationAdapter.ts

   # (c) czego NIE WOLNO cofnąć — ochrona zastanych actuals i tenant-FK
   ls server/migrations/20260809_finance_v3_e007_03_legacy_actual_protection.sql
   ls server/migrations/20261061_finance_valuation_input_events_tenant_fks.sql
   ```

   Brak (a) = **STOP całego dyżuru** — pracujesz na innej bazie, niż zakłada ta
   instrukcja. Brak (b) = **STOP z opisem** (ktoś to ruszył — sprawdź kto i czym).
   Brak (c) = **STOP** (ktoś cofnął ochronę danych zastanych).

4. **Sprawdź, że materiały wiążące widzisz:**

   ```bash
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/FINANCE_RECOVERY_AND_COMPLETION_CONTRACT_2026-08-23.md   # oczekiwane 284
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/MODULE_ACCEPTANCE.md                                     # oczekiwane 151
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "DEC-2026-08-24-05"  docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "DEC-2026-08-26-80"  docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "DEC-2026-08-26-116" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "DEC-2026-08-25-65"  docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   ```

   Brak któregokolwiek = **STOP**. Rozbieżność liczb (rejestr rośnie) = **nie
   STOP**, tylko wpis w „Korektach wobec instrukcji" — pod warunkiem, że treść
   wskazanych decyzji się zgadza.

5. Tworzysz **własną świeżą gałąź** z markera (podmień `<data>` na faktyczną,
   format `YYYYMMDD`):

   ```bash
   git branch codex/finance-day23-<data> «MARKER_SHA»
   git worktree add /private/tmp/consultify-finance-day23 codex/finance-day23-<data>
   cd /private/tmp/consultify-finance-day23
   ```

6. **Wszystkie porównania w raporcie robisz wobec bazy**, nie wobec `HEAD~1`:

   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```

### 0.2. Bezwzględne ZAKAZY

| #       | Zakaz                                                                                                                                                                                                                                                                                                                                            | Dlaczego                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Z1      | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/finance-day23-<data>`                                                                                                                                                                              | Push na `origin`/demo wykonuje wyłącznie nadzorca                                                            |
| Z2      | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824` ani gałęzi `codex/preserve-*`, `codex/results-finance-day4-*`, `codex/wave3-16-module-acceptance-*`, `codex/day2*-instrukcja-*`                                                                                                                          | `demo` = święta baza; tamte gałęzie są historią odebraną albo cudzym torem                                   |
| Z3      | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru                                                                                                                                                                                                            | Krach 3/4 powstał tak; DEC-95                                                                                |
| **Z4**  | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`), w szczególności **`codex/preserve-finance-owner-wip-20260823` (`e7574b340e`)**                                                                                                                                                               | `DEC-2026-08-24-05`: gałąź `REVIEWED_PATH_BY_PATH / NO_ADOPTION`, 1786 linii sprawdzonych, 0 unikalnej wartości |
| **Z5**  | **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-86` — patrz Blok 0                                                                                                          | Chroniony, brudny worktree właściciela                                                                       |
| Z6      | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` (m.in. `consultify-day23-instrukcja`, `consultify-results-finance-day4`, `consultify-initiatives-day21`, `consultify-meetings-day19`, `consultify-staging-fixes`)                                                                                                               | Cudze worktree, część w użyciu                                                                               |
| Z7      | **Nie zajmujesz portów sesyjnych** (3777, 3987, 4046/4047, 4056/4057, 4060/4061, 4067, 4110/4111, 4280/4281, 4290/4291, 4294/4295, 4300–4306, 4312, 4319, 4324/4325, 4336/4337, 4339/4340, 4370, 4380/4381, 4418, 4428, 4480/4481, 5000, 5037, 5432, 5447, 5449, 5467, 5471). **Twój kontener PG = 5483**; lokalny runtime, jeśli konieczny — **4348/4349**. Port zajęty → bierzesz pierwszy wolny i wpisujesz do raportu | 5471 zajmował dzień 21, 5447/5449 dni 17/19; 4110/4111, 4339/4340, 4380/4381 to runtime'y dowodowe Finance   |
| Z8      | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (DEC-65)                                                                                                                                                                                                              | Produkcja/demo poza zakresem                                                                                 |
| **Z9**  | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo/staging/produkcja, nigdy cudza retained-DB. **W szczególności ZAKAZ dotykania zachowanych baz dowodowych Finance** (`consultify_w3_finance_owner_*`). **KOREKTA `DEC-2026-08-26-98`: Z9 przerywa DANĄ CZYNNOŚĆ, nie cały dyżur** — patrz ramka pod tabelą        | „dane demo = twarz produktu" (DEC-65); bazy `consultify_w3_finance_owner_*` to dowód odbiorowy modułu        |
| **Z10** | **Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej flagi.** Także zero „tymczasowej flagi na czas testu". Dotyczy `ENABLE_V8_GLOBAL`, `MODULE_ECONOMICS`, czterech flag workspace'ów Finance V3 i profilu `ff_wave3FinanceOwnerReview`                                                                                    | CLAUDE.md reguła 9; DEC-05 („4 flagi V3 włączane POJEDYNCZO, każda po akcepcie właściciela na zrzucie")      |
| Z11     | **Nie zmieniasz `src/components/ProtectedRoute.tsx`, `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts`** ani gramatyki tras `/finance/*`                                                                                                                                                                                                  | Gramatyka zaakceptowana (`DEC-2026-08-24-07`)                                                                |
| Z12     | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/FINANCE_DAY23_REPORT_20260826.md`. Jedyny inny dokument, który wolno zmienić, to `modules/10_FINANCE/MODULE_ACCEPTANCE.md` — wyłącznie w ramach `R.1`                                                                     | Repo tonie w dokumentach-duchach                                                                             |
| Z13     | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie ani raporcie. **Nie zmieniasz też kontraktu odzyskania** — jeżeli uważasz, że kontrakt się myli, piszesz **erratę w raporcie**, nie patch w kontrakcie                                                                                            | Rejestr decyzji jest `FINAL / IRREVOCABLE`; kontrakt jest właścicielski                                       |
| **Z14** | **Nie budujesz generowania treści modelem i nie podpinasz dostawcy LLM.** Kontrakt wielokrotnie mówi „Analyze AI" / „propozycje AI" (§3.1, §4.2, §4.4, §4.5 krok 6) — **to wszystko jest poza tym dyżurem**. Zero nowych wywołań `llmService`                                                                                                   | Silnik AI = osobny moduł, ostatni w programie; DEC-51                                                        |
| Z15     | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych/`UNKNOWN`/błędnych.** Brakująca wartość **nie** staje się zerem (kontrakt §4.2 wprost); historyczne wartości ufności (`overall_confidence`, `mapping_confidence`) **nie są nadpisywane** (DEC-05); `roi_realized_values`, `v8_roi_realization_entries`, `benefit_tracking.actual_*` pozostają **append-only** | Uczciwy pusty stan > udawany wynik; migracja `20260809_finance_v3_e007_03_legacy_actual_protection.sql`      |
| **Z16** | **★★ `server/src/services/effectiveAccessService.ts` jest ABSOLUTNIE NIETYKALNY** — także `frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts`, `middleware/*orgStatus*`, `PermissionsService`, `middleware/v8FeatureGate.middleware.ts`, `middleware/v8OrgGate*`. Wolno **czytać** i **cytować**                    | Model uprawnień naprawiany in-house po 3 audytach (DEC-105); bramki V8 to decyzja produktowa, nie inżynierska |
| **Z17** | **★ Zakaz wszystkiego poza modułem Finance** — z imiennymi licencjami z ramki poniżej. Cały front, powłoka SPEC-A, kanon triady, **billing platformowy superadmina**: **NIE**                                                                                                                                                                    | „jeden moduł na raz"; podział FRONT/TYŁ (§1.6)                                                               |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts`, żadnego `vitest.*.config.ts`, **`server/vitest.config.ts`**, `server/vitest.config.v8-db.ts` ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru** | Dyżur nr 2 wywalił tak 27 cudzych testów                                                                     |
| **Z19** | **★★ ZAKAZ uruchamiania jakichkolwiek testów DB bez jawnego `DATABASE_URL` wskazującego kontener TEGO dyżuru, podanego W TEJ SAMEJ LINII komendy.** Kolejność Bloku 0: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar**. Do raportu obowiązkowy **dowód celu połączenia**                                                | Dzień 17 zmierzył stan wejściowy na cudzej/niezmigrowanej bazie (DEC-96/98)                                  |
| **Z20** | **★ DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`) — patrz ramka pod tabelą. **W tym module to jest pozycja nr 1, nie formalność** — patrz §B                                                                                                                                                                     | Bramka DoD dnia 60 przepuściła „P.2 ZROBIONE" przy czterech żywych martwych gałęziach                        |
| **Z21** | **★ Test wstrzykujący zależności NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`) — każda pozycja z wywołaniem zewnętrznym musi mieć **test domyślnego okablowania**                                                                                                                                                                   | Dzień 18: 8/8 testów zielonych, warstwa AI martwa, bo wszystkie wstrzykiwały własne `generate`               |
| **Z22** | **★ Zakaz atrapy z zewnętrznym skutkiem** (`DEC-2026-08-26-108`) — sukces + efekt na zewnątrz przy braku zmiany w bazie = odrzucenie pozycji. **Dotyczy zdarzeń audytu (§E) w pierwszej kolejności**                                                                                                                                            | Dzień 19: `DELETE /occurrence` rozsyłał `CANCEL` bez zmiany w bazie                                          |
| **Z23** | **★ Pomiar testów BEZ ZAWĘŻANIA** (`DEC-2026-08-26-108`) — wynik z pełnego zakresu §0.4a, z rozbiciem **zastane / wprowadzone**                                                                                                                                                                                                                 | Dzień 19 zadeklarował „98/98 PASS" przy 164/167 w zakresie własnej instrukcji i dwóch wniesionych czerwonych |

**★ Z9 — procedura po korekcie `DEC-2026-08-26-98` (nie zabijaj dyżuru).**
Jeżeli złapiesz się na komendzie DB bez przypiętego env: **zatrzymaj tę komendę →
ustal skutek (czy w ogóle doszło do połączenia i czy był ZAPIS) → zapisz
ustalenie w raporcie → przypnij env → KONTYNUUJ pozycję.** Twardy STOP całego
dyżuru **wyłącznie** przy stwierdzonym realnym **zapisie** do bazy spoza dyżuru.
`localhost:5432/iris_test` to wewnętrzny fallback konwencji testowej repo
(`tests/setup.ts`), nie obca baza — ale i tak nie mierzysz przeciwko niemu.
**Baza `consultify_w3_finance_owner_recovered_20260823` (i każda inna
`consultify_w3_finance_owner_*`) jest zachowanym dowodem odbiorowym modułu —
połączenie się z nią to Z9, a JAKIKOLWIEK zapis do niej to twardy STOP.**

**★ Z19 — dlaczego to jest twarde, a nie biurokracja.**
`server/src/database/Database.ts` przy `NODE_ENV=test` **BEZ** `RUN_DB_TESTS=1`
podstawia **mock DB** i cały pakiet „przechodzi" przeciwko niczemu. Dodatkowo
finansowe pakiety `*.pg.test.ts` są opakowane w `describe.skipIf(!REAL_PG)`,
gdzie `REAL_PG = RUN_DB_TESTS==='1' && MOCK_DB==='false' &&
DATABASE_URL.startsWith('postgres')` — **przy niekompletnym env cały pakiet
raportuje SKIPPED, nie FAIL.** „0 failed" przy 60 SKIPPED to nie jest dowód.
Dlatego **każde** uruchomienie testu dotykającego bazy ma env **w tej samej
linii**, z **czterema** zmiennymi (`MOCK_DB=false` jest tu obowiązkowe):

```bash
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5483/cx_day23" \
npx vitest run --config server/vitest.config.ts <plik> --no-file-parallelism
```

i **każdy** taki przebieg jest poprzedzony dowodem celu połączenia:

```bash
docker exec cx-day23-pg psql -U postgres -d cx_day23 -c "SELECT current_database(), inet_server_port();"
```

Wynik tej komendy (**dosłowny**) jest obowiązkową pozycją raportu. Pomiar bez
dowodu celu = pomiar nieistniejący. **Do raportu podajesz też liczbę SKIPPED
w każdym przebiegu** — pakiet z `skipIf` i 0 uruchomionych testów jest
`NIE_ZMIERZONY`, nie `PASS`.

**★ Z20 — jak wygląda dowód osiągalności (nowy wymóg DoD, `DEC-104`).**
Nie wystarczy „funkcja istnieje i ma test jednostkowy". Dla **każdej** pozycji
podajesz w raporcie **ścieżkę wywołania od realnego wejścia**:

```
realne wejście (metoda + URL, jaki wychodzi z przeglądarki)
  → bramki przed montażem (v8FeatureGate / v8OrgGate / requireActiveMembership — plik:linia)
  → montaż w Gateway.ts / routes/v8/index.ts (plik:linia)
  → router (plik:linia)
  → serwis kanoniczny (plik:linia)
  → zapis do tabeli (nazwa tabeli, kolumna)
```

Ścieżka bez montażu **albo za zamkniętą bramką** = kod nieosiągalny = pozycja
`NIE_ZACZĘTE` / `ZABLOKOWANE_BRAMKĄ`, nawet jeśli plik jest napisany
i przetestowany. **Dokładnie tak przepadło „P.2 ZROBIONE_WG_DoD" w `DEC-60`.**
W tym module bramki są realnym problemem — patrz §B.

**★ Z21 — co to znaczy „test domyślnego okablowania" w Finance.**
Wszystkie zastane pakiety `server/src/routes/v8/finance-v2/__tests__/*.pg.test.ts`
budują **własny** `express()` i wstrzykują `req.user` / `req.v8Context` ręcznym
middleware (wzorzec `appAs(role)` — np.
`server/src/routes/v8/finance-v2/__tests__/statements.routes.pg.test.ts:37-50`).
Taki test **dowodzi** zachowania `requireActiveMembership` i
`requireCanonicalFinanceMutation` (bo one żyją **wewnątrz** `financeV2Router`),
ale **nie dowodzi niczego** o `verifyToken`, `requireV8OrgContext`, `v8OrgGate`,
`attachV8Context` ani `v8FeatureGate` — te żyją **powyżej**, w
`server/src/routes/v8/index.ts` i `server/src/Gateway.ts`. Dla pozycji **B** i **C**
to jest różnica między „udowodniłem" a „niczego nie udowodniłem". Masz mieć
**oba**: test na wstrzykniętym kontekście (dowodzi logiki routera) **i** test
domyślnego okablowania (dowodzi, że produkcyjny łańcuch montażu przepuszcza
żądanie do tego routera i odrzuca obcą organizację).

**Zasięg Z18 — konkretnie.**

```
tests/setup.ts
tests/helpers/**            (w tym unifiedMockSetup.js)
tests/__mocks__/**
vitest.config.ts  vitest.l1.config.ts  vitest.l2.config.ts  vitest.l3.config.ts
vitest.acceptance.config.ts  vitest.security.config.ts  vitest.orphans.config.ts
vitest.perf.config.ts  vitest.migration.config.ts
server/vitest.config.ts       ← UŻYWASZ GO, NIE ZMIENIASZ. Twoje nowe pliki muszą
                                pasować do jego zastanego include:
                                'src/**/*.{test,spec}.{ts,tsx}'
server/vitest.config.v8-db.ts
scripts/testing/run-fin005-pg-tests.mjs                     (cudzy runner)
```

Gdy potrzebujesz innego zachowania mocka: **opt-in, nigdy globalnie** — `vi.mock`
lokalnie w Twoim pliku testowym albo dedykowany helper w **nowym** pliku
importowanym tylko przez Twoje testy. Jeśli Twój test nie przechodzi bez zmiany
globalnego mocka — to **STOP**, nie zmiana globalnego mocka.

**Zasięg Z17 — granica jest ostra.**

```
WOLNO (Twój zakres):
  server/src/routes/v8/finance-v2/**                            (+ __tests__ obok)
      w szczególności: _shared.ts · artifacts.routes.ts · versions.routes.ts
                       statements.routes.ts · analysis.routes.ts · baseline.routes.ts
                       prediction.routes.ts · valuation.routes.ts · compute.routes.ts
                       crosscutting.routes.ts · lineage-navigator.routes.ts
                       comments.routes.ts · compare.routes.ts · saved-views.routes.ts
                       export-import.routes.ts · models.routes.ts · index.ts
      NOWE pliki: financeErrorTaxonomy.ts, financeMutationAudit.ts,
                  financeCapabilityContract.ts
  server/src/services/finance/canonical/**                      (+ __tests__ obok)
      w szczególności: lifecycleService.ts · artifactVersionService.ts
                       lineageFreshnessService.ts · lineageService.ts
                       roiFinanceLinkAdapter.ts · roiFinanceReconciliationAdapter.ts
  server/src/services/finance/financeCandidateHandoffCore.ts    (TYLKO §F.1 — wykrycie dryfu źródła)
  server/src/services/finance/financeStatementPackCandidateHandoff.ts (TYLKO §F.1 — `sourceVersion: 'unknown'`)
  server/src/routes/financeCandidateHandoff*.routes.ts          (TYLKO §F.1 — wystawienie stanu dryfu w odczycie)
  server/migrations/2026114<x>_finance_day23_*.sql               (NOWE pliki, numeracja wg §0.3)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/MODULE_ACCEPTANCE.md   (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/FINANCE_DAY23_REPORT_20260826.md          (jedyny nowy dokument)

IMIENNE LICENCJE POZA MODUŁEM (wolno WOŁAĆ/CZYTAĆ istniejące, NIE zmieniać ich kodu —
z DWOMA wyjątkami oznaczonymi „WOLNO ZMIENIĆ DOKŁADNIE"):
  §B   — server/src/Gateway.ts                                  (CZYTASZ jako dowód montażu; ZMIANA = STOP)
         server/src/routes/v8/index.ts                          (CZYTASZ; ZMIANA = STOP)
         server/src/routes/v8/financeStatementMountedSurface.ts  (CZYTASZ; ZMIANA = STOP — to bramka produktowa)
         server/src/middleware/v8FeatureGate.middleware.ts       (CZYTASZ; ZMIANA = ODRZUCENIE, Z16)
         server/src/middleware/v8Auth.middleware.ts              (CZYTASZ — źródło `getV8Context`; ZMIANA = ODRZUCENIE, Z16)
         server/src/middleware/auth.middleware.ts                (CZYTASZ — pochodzenie `organizationId`; ZMIANA = ODRZUCENIE, Z16)
  §C   — server/src/services/legacyCutover/requireActiveMembership.ts
             ::requireActiveMembership · ::requireFinanceEditorMembership   (WOŁASZ przez istniejący montaż; NIE zmieniasz)
  §E   — server/src/services/AuditEventsService.ts ::auditEventsService     (CZYTASZ i WOŁASZ istniejące API; NIE zmieniasz)
         server/src/routes/audit-events.routes.ts                          (CZYTASZ jako dowód odczytu strumienia; NIE zmieniasz)
  §F.2 — server/src/services/resultsVnext/roi/**                (CZYTASZ i WOŁASZ istniejące komendy; NIE zmieniasz — to moduł Results)
  §G.1 — **WOLNO ZMIENIĆ DOKŁADNIE JEDEN HANDLER** w każdym z dwóch plików,
         wyłącznie w zakresie „przestań zwracać fałszywy sukces" (zero innych zmian w pliku):
           server/src/routes/v8/finance.routes.ts:1713-1735   (POST /models/:modelId/analyze — 202 `queued`, nic nie kolejkowane)
           server/src/routes/economics.routes.ts:2375-2401    (POST /financial-analyses/:id/insights — `status:'generated'`, nic nie wygenerowane)
         Reszta OBU plików: TYLKO ODCZYT. Naruszenie = odrzucenie pozycji.
  §G.3 — **WOLNO ZMIENIĆ WYŁĄCZNIE KOMENTARZE-NAGŁÓWKI** (zero zmian zachowania) w:
           server/src/routes/v8/financeValueDemoAllowlist.ts
           server/src/routes/v8/financeValueRoutes.ts
           server/src/routes/v8/finance-value.routes.ts
           server/src/routes/financeCandidateHandoffStatementPack.routes.ts
  §H   — server/scripts/release-migration-gate.ts               (CZYTASZ listę relacji krytycznych; ZMIANA = STOP)
  wzorzec testu — server/src/routes/v8/finance-v2/__tests__/statements.routes.pg.test.ts (CZYTASZ jako wzorzec)

NIE WOLNO:
  CAŁE src/**                                                   ← podział FRONT/TYŁ (§1.6); zero wyjątków, także „jedna linia importu"
  server/src/services/effectiveAccessService.ts                 ← Z16, ODRZUCENIE
  server/src/services/frameworkEntitlementService.ts · middleware/frameworkEntitlement.middleware.ts
  server/src/middleware/**                                      ← poza czytaniem
  server/src/routes/billing/**  ·  server/src/routes/billing.routes.ts   ← BILLING PLATFORMOWY SUPERADMINA = INNY MODUŁ
  server/src/services/tokenBillingService.ts                    ← jw. (billing_invoices)
  server/src/routes/economics.routes.ts                         ← poza JEDNYM handlerem z licencji §G.1
  server/src/routes/v8/finance.routes.ts                        ← poza JEDNYM handlerem z licencji §G.1
  server/src/routes/benefits.routes.ts · budget.routes.ts · budgets.routes.ts · benefitsRegister.routes.ts
  server/src/routes/finance-statements.routes.ts · finance-enterprise.routes.ts · financial-modeling.routes.ts
  server/src/routes/v8/finance-planning.routes.ts · finance-intelligence.routes.ts · finance-valuation.routes.ts
  server/migrations/<istniejące pliki>                          ← TYLKO ODCZYT (nowe DDL = nowy plik)
  tests/e2e/**  ·  tests/acceptance/**                          ← cudzy tor odbiorowy
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie jest**
praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie, idziesz
dalej. Wyjątku nie ma nawet dla „jednej linii importu".

### 0.3. Higiena wykonania

- **Commit per pozycja.** Jedna pozycja = jeden commit. Conventional commits:
  ```
  docs(finance): inventory the recovery contract against the shipped backend (A)
  test(finance): prove the canonical five-card surface is reachable from the production mount (B)
  feat(finance): complete the artifact capability contract for all five canonical types (C.1)
  refactor(finance): one typed mutation error taxonomy instead of message-regex status guessing (C.2)
  feat(finance): optimistic concurrency on the canonical card mutations that lacked it (D.1)
  feat(finance): make canonical mutation retries idempotent instead of duplicating (D.2)
  feat(finance): emit an audit event in the same transaction as the mutation (E)
  feat(finance): mark approved children stale when their source version changes (F.1)
  feat(finance): expose the ROI/Finance link half over the canonical API (F.2)
  fix(finance): return honest unknowns instead of technical identifiers (G)
  docs(finance): record that module 10 has no open fresh-database schema gap (H)
  docs(finance): raise 10_FINANCE acceptance to the delivered scope (R.1)
  ```
- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita.
- **Testy celowane per pozycja** — **nigdy pełny `tsc` ani pełny `vitest` repo.**
- **★ KAŻDA nowa powierzchnia = minimum CZTERY testy zachowania**: happy ·
  ścieżka błędu (4xx/5xx) · pusty stan · **negatyw tenanta** (obcy
  `organizationId` dostaje 404/403, nigdy 200).
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `toContain('...')`, **nie liczy się do DoD**.
- **Typy punktowo** (`npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null`),
  **nie** pełny `tsc -p`.
- **★ Nowe pliki testowe kładziesz OBOK kodu**, w
  `server/src/routes/v8/finance-v2/__tests__/` albo
  `server/src/services/finance/canonical/__tests__/`, z sufiksem **`.pg.test.ts`**
  dla testów na realnym PG — to zastana konwencja tego modułu (nie `.realdb.test.ts`,
  który należy do innych drzew). Dodają się normalnie (`git add`, bez `-f`).
  **NOWE pliki w `tests/` wymagałyby `git add -f`** — ale w tym dyżurze nie masz
  powodu tam pisać.
- **★ MIGRACJE — reguły twarde, bez wyjątków.**
  1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
     `INSERT ... ON CONFLICT DO NOTHING`. **Zakaz** `DROP`,
     `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`, bezwarunkowego `UPDATE`.
  2. **★★ NUMERACJA — DZIEŃ 23 MA PRZYDZIELONY PRZEDZIAŁ `20261140`–`20261149`**
     (`DEC-2026-08-26-98`, rozszerzenie). Reguła „najwyższy + 1" obowiązuje
     **TYLKO WEWNĄTRZ tego przedziału**. Numery spoza przedziału są **ZAKAZANE**,
     nawet jeśli `ls` pokazuje je jako wolne — dni 17–22 i prace wewnętrzne mają
     pule `20261076`–`20261139` i **część z nich nie jest jeszcze scalona, więc
     `ls` ich nie pokaże**.
     **Obowiązkowy `ls | grep` PRZED KAŻDYM plikiem:**
     ```bash
     ls server/migrations | grep -E '^202611[0-9]{2}' | sort | tail -3   # co widać jako zajęte
     ls server/migrations | grep '^20261140'                             # MUSI być PUSTE przed utworzeniem pliku
     ```
     Nazwa: `<numer>_finance_day23_<temat>.sql`.
     **Pierwszy wolny w Twoim przedziale to `20261140`.** Sprawdź to sam.
     `migrate.postgres.ts` stosuje migracje w porządku **alfabetycznym nazw
     plików**, więc kolizja numeru to cicha katastrofa — dokładnie ta, którą
     wykrył odbiór dnia 18 (`DEC-107`) i której winna była instrukcja, nie Codex.
     **★ Errata do konwencji:** w repo **już istnieją zdublowane numery**
     (`20261054`, `20261057`, `20261058`, `20261061` — po dwa pliki każdy).
     To jest zastany dług, **nie precedens**. Ty bierzesz numer unikalny.
  3. **★ ZERO nowych kluczy obcych** do tabel `finance_*` / `financial_*` **poza
     tenant-FK wzorowanymi 1:1 na `20261061_finance_valuation_input_events_tenant_fks.sql`**,
     i tylko jeśli pozycja tego jawnie wymaga. Tenant i istnienie rodzica
     sprawdzasz **w warstwie aplikacji**, jak reszta `finance/canonical`.
  4. **★ DOWÓD IDEMPOTENCJI + KOMPATYBILNOŚCI WSTECZ (DEC-65)** — warunek
     oddania każdej pozycji z migracją. Jednorazowy kontener, trzy przebiegi,
     wyniki do raportu. **Sprzątanie kontenera I wolumenów jest obowiązkowe.**
  5. **★ Prawdopodobnie NIE POTRZEBUJESZ ŻADNEJ MIGRACJI.** Zweryfikowano przy
     wystawianiu instrukcji: moduł 10 Finance ma **zero** obiektów w klasach
     `ONLY_DEAD` i `NO_MIGRATION` z audytu `DEC-116` (patrz §H i errata §1.8
     pkt 4). Tabele, których dotykasz, istnieją. **Nie dodawaj migracji „na
     wszelki wypadek"** — jedyne prawdopodobne DDL to indeks pod nowy odczyt
     albo tabela pokwitowań idempotencji, jeśli §D.2 udowodni, że jej nie ma.
- **`MIGRATION_PREPARED`** — migracja jest przygotowana i udowodniona lokalnie,
  **nigdy** uruchomiona zdalnie (`REMOTE_EXECUTION_NOT_AUTHORIZED`).

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

Pozycja jest zrobiona, gdy spełnia **wszystkie jedenaście**:

1. **Realne dane** — odczyt i zapis idą do backendu. Zero mocków jako źródła
   prawdy. Pusty wynik = uczciwy pusty stan; brakująca wartość = **błąd
   merytoryczny albo jawne `UNKNOWN` z powodem, nigdy `0`** (kontrakt §4.2).
2. **Zapis z readbackiem** — po komendzie zapisującej test ponownie odczytuje
   stan z bazy **niezależnym połączeniem** (osobny `pg.Pool`), nie z koperty
   odpowiedzi. Kontrakt nazywa to „cold reopen" (§6) i wymaga go wprost.
3. **Zero atrap.** Brak API → wpis `BRAK_API`. **I zero atrap z zewnętrznym
   skutkiem (Z22)**: jeśli odpowiedź mówi „zapisano/zatwierdzono/przeliczono",
   w bazie MUSI być zmiana — dowodzisz to liczbą wierszy/wersją agregatu przed
   i po. **Zdarzenie audytu bez zmiany w bazie = wzorcowa atrapa.**
4. **Minimum 4 testy zachowania** (happy · błąd · pusty · negatyw tenanta),
   behawioralne. Testy grepujące źródło się nie liczą.
5. **★ Test HTTP realnego routera** przez `supertest` na **realnym PG**
   (wzorzec: `server/src/routes/v8/finance-v2/__tests__/statements.routes.pg.test.ts`).
   Test na zmockowanej domenie **nie zastępuje** tego wymogu.
6. **★ DOWÓD OSIĄGALNOŚCI (Z20)** — pełna ścieżka wywołania od realnego wejścia
   do zapisu, **z bramkami**, w formacie z ramki Z20, w raporcie. **Bez niej
   pozycja jest `NIE_ZACZĘTE`, choćby kod był napisany i przetestowany.**
7. **★ TEST DOMYŚLNEGO OKABLOWANIA (Z21)** — dla każdej pozycji, która wywołuje
   coś spoza własnego pliku (autoryzacja, serwis kanoniczny, unit of work):
   osobny test **bez wstrzykiwania**, przeciwko domyślnym zależnościom
   produkcyjnym.
8. **Kontrole negatywne tenanta** — obcy `organizationId` nigdy nie dostaje
   `200`. `organizationId` bierzesz **wyłącznie z `getV8Context(req)`**, nigdy
   z `body`/`query`/`params`. **★ ERRATA, przeczytaj uważnie:** w tym repo
   `organizationId` **NIE jest „tylko z tokenu"** — `auth.middleware.ts:648-650`
   dopuszcza nagłówki `x-org-context` / `x-organization-id`, ale **dopiero po
   sprawdzeniu w bazie aktywnego członkostwa** (`:803-824`). Dlatego Twój test
   negatywny musi być **podwójny**: (a) obca organizacja w `body` → ignorowana,
   (b) obca organizacja w nagłówku `x-org-context` **bez** aktywnego członkostwa
   → `403`/`404`, nigdy `200`. Kontrakt §FIN-REC-010 wymaga tego wprost
   („Niedozwolona organizacja nie może odczytać obiektu po bezpośrednim ID").
9. **Realny PG w jednorazowym Dockerze** (port 5483) z pełnymi migracjami,
   z dowodem celu połączenia (Z19), **z liczbą SKIPPED**, ze sprzątnięciem
   kontenera **i wolumenów**.
10. **Plik przez `prettier`** przed commitem.
11. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód → poziom
    ukończenia wg kontraktu §7` (najwyżej `TECHNICAL_PASS`).

> Punkty „zrzut light+dark", „i18n napisów UI", „responsywność" i cała macierz
> `FIN-REC-012` **nie obowiązują** w tym dyżurze — front jest poza zakresem
> (§1.6). Klucze i18n tworzysz **wyłącznie** dla napisów, które faktycznie
> wychodzą z Twojego API (kody i komunikaty błędów), i wtedy parytet PL+EN
> obowiązuje w tym samym commicie.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu (Z23)

Przed oddaniem raportu:

1. Wypisz wszystkie dotknięte pliki: `git diff --name-only codex/m03-admin-20260824...HEAD`.
2. Wyodrębnij **współdzielone** (importuje je ktoś spoza Twojego zakresu):
   `server/src/routes/v8/finance-v2/index.ts`,
   `server/src/routes/v8/finance-v2/_shared.ts`,
   `server/src/services/finance/canonical/lifecycleService.ts`,
   `server/src/services/finance/canonical/artifactVersionService.ts`.
3. Uruchom testy **katalogów konsumentów**, nie tylko własnych plików. Minimum
   (każde z jawnym kompletem env w tej samej linii tam, gdzie dotyka bazy — Z19):
   ```bash
   # realny PG — cała powierzchnia tras kanonicznych Finance
   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
   DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5483/cx_day23" \
   npx vitest run --config server/vitest.config.ts \
     server/src/routes/v8/finance-v2/__tests__ --no-file-parallelism

   # realny PG — serwisy kanoniczne (w tym adaptery ROI/Finance)
   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
   DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5483/cx_day23" \
   npx vitest run --config server/vitest.config.ts \
     server/src/services/finance/canonical/__tests__ --no-file-parallelism

   # bez bazy
   npx vitest run tests/unit/finance
   npx vitest run tests/integration/p05-finance-lane.contract.test.ts
   npx vitest run server/src/routes/v8/__tests__
   ```
4. **★ Wynik podajesz BEZ ZAWĘŻANIA, z rozbiciem `zastane / wprowadzone`
   i z liczbą SKIPPED:**
   ```
   Zakres §0.4a: <X>/<Y> PASS, <S> SKIPPED
     czerwone ZASTANE (były czerwone na bazie, przed moim pierwszym commitem): <lista plików + liczby>
     czerwone WPROWADZONE (zapalone przez mój commit): <lista + SHA commitu, który je zapalił>
     SKIPPED z powodu env: <lista> ← jeśli niepuste, pomiar jest CZĘŚCIOWY
   ```
   **Deklaracja „N/N PASS" na wybranym podzbiorze przy czerwonych w zakresie
   §0.4a = zawyżenie i podstawa odrzucenia** (`DEC-108`, P1 dnia 19).
   **Deklaracja „PASS" przy pakiecie w całości SKIPPED = to samo.**
5. Deklarujesz jawnie `ZASIĘG PEŁNY` / `ZASIĘG CZĘŚCIOWY` (i co pominąłeś,
   i dlaczego). `CZĘŚCIOWY` bez wyliczenia pozycji jest odrzucany.
6. **Baseline liczysz PRZED pierwszym commitem** (Blok 0 pkt 7) — inaczej nie
   masz jak odróżnić zastanego od wprowadzonego. **Znany czerwony zastany**,
   zgłoszony przez dyżur dnia 4 i do potwierdzenia w Twoim baseline:
   `tests/unit/finance/financeFallbackGating.test.ts` — 2 przypadki oczekują
   `MODULE_ECONOMICS=open`, zastany kod zwraca `closed`. **Nie naprawiasz go**
   (Z10 + Z17): to gating nawigacji, nie mechanika Finance.

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**
Zatrzymujesz się w szczególności, gdy musiałbyś:

- dotknąć `effectiveAccessService.ts`, `v8FeatureGate.middleware.ts` albo
  dowolnego pliku modelu uprawnień (Z16) — to jest STOP **zawsze**, także
  „addytywnie, tylko cache";
- **otworzyć jakąkolwiek bramkę, żeby Twoja pozycja stała się osiągalna**
  (`ENABLE_V8_GLOBAL`, `MODULE_ECONOMICS`, flagi V3, `financeStatementMountedSurface`)
  — to jest **decyzja produktowa właściciela**, nie Twoja (Z10, DEC-05);
- osłabić/usunąć asercję w teście istniejącym wcześniej;
- zamienić brakującą wartość na `0`, nadpisać historyczną wartość ufności albo
  zapisać cokolwiek do `roi_realized_values` / `v8_roi_realization_entries` /
  `benefit_tracking.actual_*` (Z15);
- dodać migrację nieaddytywną, z nowym kluczem obcym poza wzorcem tenant-FK,
  albo z numerem **spoza przedziału `20261140`–`20261149`**;
- stworzyć flagę funkcyjną albo zmienić domyślną wartość istniejącej (Z10);
- wejść we `src/**` (Z17, §1.6) — **także po to, żeby „tylko podpiąć nowy
  endpoint" albo „tylko zaczytać nowe pole"**;
- wejść w billing platformowy superadmina (`server/src/routes/billing/**`,
  `tokenBillingService.ts`) — **to inny moduł** (Z17, errata §1.8 pkt 4);
- zbudować trasę, która zwraca sukces i wywołuje skutek zewnętrzny (audyt,
  outbox, pokwitowanie) bez zmiany w bazie (Z22);
- podpiąć dostawcę LLM albo dodać wywołanie modelu (Z14);
- test nie przechodzi i naprawa wymaga zmiany GLOBALNEGO mocka/configu vitest
  (Z18) — STOP zawsze, bez „addytywnie, więc nic nie zepsuje";
- pomiar zasięgu (§0.4a) pokazał czerwone testy w cudzym module — nie
  „naprawiasz" po cichu: opisujesz, który commit je zapalił.

Format wpisu STOP:

```
### STOP — <pozycja>
Powód: <jedno zdanie>
Dowód: <plik:linia lub komenda + wynik>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
```

---

## 1. KONTEKST

### 1.1. Skąd bierze się ten dyżur

Moduł 10 Finance **nie miał panelu eksperckiego** — inaczej niż Inicjatywy
(`DEC-104`) czy Chat. Nie ma więc oceny „4,0/10" ani listy siedmiu grzechów.
Ma coś, czego tamte moduły nie miały: **kontrakt właścicielski wykonawczy**
(`FINANCE_RECOVERY_AND_COMPLETION_CONTRACT_2026-08-23.md`, 284 linie, status
`IMPLEMENTATION CONTRACT / NOT IMPLEMENTED / NOT OWNER ACCEPTED`) z piętnastoma
zadaniami `FIN-REC-001…015`, macierzą weryfikacji i czterostopniową skalą
ukończenia.

Ten kontrakt był już raz atakowany — **dyżurem dnia 4** (`RESULTS_FINANCE_DAY4_REPORT_2026-08-25.md`,
sekcja F). Tamten dyżur był **frontowy** i zamknął `FIN-REC-001` (inwentarz),
`FIN-REC-002` (resolver, 109/109 PASS) oraz część `FIN-REC-003` (wspólny shell).
**Cztery pozycje postawił na `STOP` — i każda z nich stoi z powodu braku po
stronie serwera:**

| STOP dnia 4        | Cytat z raportu                                                                                                                | Czyj to brak         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| `F.6` stany brzegowe | „brak uprawnień oraz część konfliktów/błędów obliczeń **nie mają jednolitego, typowanego kontraktu** we wszystkich pięciu workspace'ach; role są dodatkowo zaszyte jako `preparer`" | **TYŁ** — Twój, §C   |
| `F.6` macierz 5×8  | kolumna „brak uprawnień": **`NIEODRÓŻNIALNY` we WSZYSTKICH pięciu kartach**; kolumna „konflikt wersji": `NIEODRÓŻNIALNY` w czterech z pięciu | **TYŁ** — Twój, §C/§D |
| `F.5` pkt 2        | „`STOP`: brak testu 6 mountów z POST/PUT-throwing mockiem"                                                                     | mieszany             |
| `F.7` pkt 3/6      | „Real PostgreSQL: `STOP / NOT VERIFIED`"; „realny 403 per karta pozostaje `NOT VERIFIED` **z powodu braku capability contract**" | **TYŁ** — Twój, §C   |

Drugi dyżur, który zostawił Ci robotę, to **nocny sweep wizualny A**
(`DEC-2026-08-26-80`, `NIGHT_FIXES_A_REPORT_20260826.md`). Był to dyżur
**frontowy** (właściciel zaakceptował go graficznie), ale zgłosił dwie luki,
których front **nie mógł** naprawić, bo dane nie wychodzą z serwera:

- **Etykiety linii sprawozdania.** „prawdziwy `resolveLineLabel` w produkcji to
  dosłownie `lineCode ?? canonicalLineId ?? rowKey` — **nie ma ŻADNEGO słownika
  `canonicalLineId`→polska nazwa nawet dla zmapowanych linii**".
- **Tożsamość autora w łańcuchu pochodzenia wyceny.** „`authorId` NIE jest
  rozwiązywany do imienia i nazwiska — nie ma w tym workspace żadnego katalogu
  użytkowników, więc zostaje jako »Autor (ID techniczne)«".

Obie są w §G.4, obie z **twardym zakazem zmyślania**: jeśli słownika nie ma
w bazie, produktem jest **uczciwe `BRAK_DANYCH` + kontrakt dla frontu**, nie
wymyślona taksonomia.

**To jest ten dyżur.** Osiem pozycji, wszystkie po stronie serwera.

### 1.2. ZAKRES — dokładnie osiem pozycji, nic więcej

| Poz.    | Nazwa                                              | Stan zastany (do potwierdzenia w Bloku 0)                                                                                          | Twój produkt                                                                                                    | `FIN-REC`         |
| ------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------- |
| **A**   | **Inwentarz stanu wobec kontraktu**                | Kontrakt ma 15 zadań; dwa dyżury zamknęły część frontu; nikt nie rozliczył tyłu                                                     | Tabela `FIN-REC-001…015` → `ZROBIONE / CZĘŚCIOWO / BRAK / POZA_ZAKRESEM_TYŁU`, każda pozycja z `plik:linia`         | `001`, `015`      |
| **B**   | **Osiągalność kanonicznej powierzchni**            | `/api/v8/finance-v2/*` siedzi za `v8FeatureGate` (`ENABLE_V8_GLOBAL`) + `v8OrgGate`; obok istnieje DRUGI tor zapisu w `v8/finance.routes.ts` | Mapa osiągalności 5 kart od realnego wejścia + test domyślnego okablowania + rozstrzygnięcie drugiego toru        | `010`, `014`      |
| **C**   | **Kontrakt uprawnień i błędów**                    | `GET /artifacts/:id/capabilities` istnieje, ale rola jest wyprowadzana z roli org (`AP-09` nie istnieje); statusy błędów zgadywane z treści komunikatu | Kompletny kontrakt zdolności dla 5 typów + JEDNA typowana taksonomia błędów mutacji                                | `010`, `011`      |
| **D**   | **Ochrona konfliktu i idempotencja ponowienia**    | CAS na 5 trasach z ~58 mutujących; cały blok wyceny B3 bez CAS i bez klucza idempotencji; w `models.routes.ts` CAS samospełniający się | CAS tam, gdzie agregat ma wersję; idempotencja ponowienia; jawne `409`/`412`                                       | `010`, `011`      |
| **E**   | **Audyt mutacji**                                  | ZERO odwołań do audytu w `finance-v2`; tylko przejścia cyklu życia lądują w `artifact_lifecycle_events`; płaszczyzna danych **nieaudytowana** | Zdarzenie audytu w TEJ SAMEJ transakcji co mutacja, dla wszystkich mutacji płaszczyzny danych                       | `010`             |
| **F**   | **Nieaktualność i szew ROI**                       | Kanoniczne lineage MA realną propagację `STALE_SOURCE`; handoff do Kandydata zamraża migawkę i **nigdy nie porównuje odcisku**; połowa LINK szwu ROI/Finance nie ma produkcyjnego wołającego | Wykrycie dryfu źródła w handoffie + osiągalna połowa LINK szwu ROI/Finance (albo uczciwy STOP)                    | `013`             |
| **G**   | **Uczciwość odpowiedzi i sprzątanie serwera**      | Dwa endpointy zwracają fałszywy sukces (`generated` / `202 queued`); pięć zamontowanych powierzchni bez ani jednego klienta; cztery nagłówki-kłamstwa; brak etykiet linii i tożsamości autora | Jawny błąd/`degraded` zamiast fałszywego sukcesu; usunięcie martwego; uczciwe `BRAK_DANYCH` z kontraktem dla frontu | `011`, `013`      |
| **H**   | **Luka schematu od zera dla modułu 10**            | Audyt `DEC-116` zostawił 150 obiektów `NO_MIGRATION` „do decyzji produktowej per moduł"                                             | Rozliczenie, ile z nich należy do Finance — **prawdopodobnie zero**; wpis, nie migracja „na wszelki wypadek"        | `010`             |
| **T**   | **Testy**                                          | —                                                                                                                                    | Pozycja własna, nie dodatek — §T                                                                                    | `014`             |
| **R.1** | `MODULE_ACCEPTANCE.md` 10_FINANCE                  | nie podniesiony o tylny zakres                                                                                                       | Podniesienie o **faktycznie dowieziony** zakres, najwyżej do `TECHNICAL_PASS`                                       | `015`             |

### 1.3. POZA ZAKRESEM — jawnie, żebyś nie zaczął

1. **★ CAŁE `src/`.** Resolver (`FIN-REC-002` — **zrobiony** dnia 4), wspólny
   shell rejestrów (`FIN-REC-003`), pięć workspace'ów, preview, `Back`, menu
   2/3, kreatory (`FIN-REC-009` — front), jakość wizualna i dostępność
   (`FIN-REC-012`), polonizacja, odłączenie `Benefits/*` (`F.8` dnia 4 — plan
   gotowy, wykonanie po akcepcie właściciela). **Robotnicy wewnętrzni po
   prototypie i akcepcie właściciela.**
2. **`financeOwnerSampleData`** jako mechanizm frontowy — patrz §G.4, gdzie
   rozstrzygam to jawnie. Plik żyje w `src/components/Economics/`, więc jest
   poza Twoim zasięgiem; **Twoja część to udowodnienie, że SERWER nie podmienia
   niczego**.
3. **Billing platformowy superadmina** — `server/src/routes/billing/**`,
   `tokenBillingService.ts`, tabele `billing_invoices`, `credit_notes`,
   `invoice_templates`, `tax_rates`, `discount_codes`. **To inny moduł.**
   Errata §1.8 pkt 4 tłumaczy, dlaczego brief mógł Cię tu pomylić.
4. **`effectiveAccessService` i cały model uprawnień** (Z16). Pozycja `C` buduje
   **kontrakt zdolności specyficzny dla Finance** na istniejących bramkach —
   nie dotyka modelu uprawnień.
5. **Silnik AI / generowanie treści modelem** (Z14). Kontrakt mówi o „Analyze
   AI", „propozycjach AI" i „Advisorze" — **wszystko to jest poza tym dyżurem.**
   Pozycja `G.1` dotyczy **uczciwości odpowiedzi**, nie włączania AI.
6. **Otwieranie bramek, flag i modułu** (Z10). `MODULE_ECONOMICS: 'closed'`
   (`src/utils/betaAccess.ts:47`) i `ENABLE_V8_GLOBAL` **zostają jak są**.
7. **Migracje zdalne, staging, Railway, bazy `consultify_w3_finance_owner_*`**
   (DEC-65, Z8, Z9).
8. **Gałąź `codex/preserve-finance-owner-wip-20260823`** (Z4, `DEC-05`).

### 1.4. Decyzje wiążące

1. **`DEC-2026-08-25-65` (DEC-65)** — wspólna kanoniczna baza = obecna baza demo;
   migracje = `MIGRATION_PREPARED` / `REMOTE_EXECUTION_NOT_AUTHORIZED`; zakaz
   zdalnych migracji/seedów/zapisów. **Prawo nadrzędne.**
2. **`DEC-2026-08-24-05`** — Finance ma **jedną linię** (`EconomicsView` →
   `FinanceHub` → warsztaty Finance V3). Gałąź `codex/preserve-finance-owner-wip-20260823`
   (`e7574b340e`) = `REVIEWED_PATH_BY_PATH / NO_ADOPTION`, **odrzucona w całości
   jako źródło kodu** (1786 linii sprawdzonych, 0 unikalnej wartości, 0 unikalnych
   kluczy tłumaczeń). **Cztery flagi V3 włączane POJEDYNCZO, każda po akcepcie
   właściciela na zrzucie.** Polityka danych: **historyczne wartości ufności NIE
   są nadpisywane.**
3. **`DEC-2026-08-26-80`** — nocny sweep wizualny A zaakceptowany **graficznie,
   do MVP**; poprawki merytoryczne = backlog po-MVP. Twoje dwie luki tylne (§G.4)
   pochodzą stamtąd.
4. **`DEC-2026-08-26-116`** — dwa runnery migracji, dwa ledgery; 212 plików nigdy
   niestosowanych; `20261120_fresh_db_schema_gap_closure.sql` domknęło 106
   obiektów `ONLY_DEAD`; **150 obiektów `NO_MIGRATION` pozostaje jako decyzja
   produktowa per moduł.** Bramka wzmocniona checkiem
   `schema_coverage_critical_relations`. **Zakaz poszerzania wzorca autorun jako
   „naprawy".**
5. **`DEC-2026-08-26-104`** — **DoD wymaga dowodu OSIĄGALNOŚCI** (u Ciebie: Z20).
6. **`DEC-2026-08-26-107`** — **test wstrzykujący zależności NIE dowodzi ścieżki
   produkcyjnej** (u Ciebie: Z21). Plus: **źródłem kolizji migracji była
   instrukcja** — stąd przedziały numerów.
7. **`DEC-2026-08-26-108`** — **zakaz atrapy z zewnętrznym skutkiem** (Z22)
   i **pomiar testów bez zawężania** (Z23).
8. **`DEC-2026-08-26-98`** — korekta Z9 (przerywa czynność, nie dyżur), mechanizm
   env w tej samej linii, **rezerwacja numerów migracji**; dzień 23 =
   **`20261140`–`20261149`**.
9. **`DEC-2026-08-26-96`** — Z19 (kolejność Bloku 0, jawny `DATABASE_URL`, dowód
   celu połączenia).
10. **`DEC-2026-08-26-95`** — rozejście marker→tip bez kolizji rozstrzyga nadzorca;
    dokładny start z markera, bez rebase.
11. **`DEC-86`** — symlink `node_modules` do odczytu + numeracja migracji
    „najwyższy + 1 ze sprawdzeniem" (u Ciebie: wewnątrz przedziału).
12. **`DEC-2026-08-26-51`** — zakaz atrapy AI; deterministyczne wyliczenie **nie
    może** nosić ikony ani nazwy AI.

### 1.5. Stan faktyczny — mapa techniczna (ZWERYFIKUJ W BLOKU 0)

Ta mapa została zdjęta z gałęzi `codex/m03-admin-20260824` przy wystawianiu
instrukcji. **Traktuj ją jako hipotezę do potwierdzenia, nie jako prawdę.**
Każda rozbieżność idzie do „Korekt wobec instrukcji".

```
# MONTAŻ I BRAMKI (pozycja B)
server/src/Gateway.ts:1490            app.use('/api/v8', mountedFinanceStatementRouter)   ← OMIJA v8FeatureGate
server/src/Gateway.ts:1491            app.use('/api/v8', v8FeatureGate, v8Router)
server/src/routes/v8/index.ts:86-91   v8OrgGate → attachV8Context → v8MetricsMiddleware → mutationAbortCanary
server/src/routes/v8/index.ts:115     v8Router.use('/finance-v2', financeV2Routes)
server/src/routes/v8/index.ts:116     v8Router.use('/finance', financeRoutes)             ← DRUGI TOR ZAPISU
server/src/middleware/v8FeatureGate.middleware.ts:15   ENABLE_V8_GLOBAL === 'true'
server/src/routes/v8/financeStatementMountedSurface.ts:12-34   allowlista: TYLKO /finance/statements/* (legacy), NIE /finance-v2/*

# STRAŻNICY WEWNĄTRZ ROUTERA (pozycja C)
server/src/routes/v8/finance-v2/index.ts:61   financeV2Router.use(requireActiveMembership)
server/src/routes/v8/finance-v2/index.ts:62   financeV2Router.use(requireCanonicalFinanceMutation)
server/src/routes/v8/finance-v2/index.ts:45-59   definicja: non-GET na 9 prefiksach → requireFinanceEditorMembership
server/src/routes/v8/finance-v2/_shared.ts:33-39  mapOrgRoleToFinanceRole — rola Finance WYPROWADZANA z roli org;
                                                  komentarz :28-31 mówi wprost: „until per-user Finance role
                                                  assignment (AP-09, out of scope) exists"
server/src/routes/v8/finance-v2/artifacts.routes.ts:342   GET /artifacts/:artifactId/capabilities

# CAS I IDEMPOTENCJA (pozycja D) — helpery istnieją, użycie jest wyspowe
server/src/routes/v8/finance-v2/_shared.ts:41   readExpectedVersion
server/src/routes/v8/finance-v2/_shared.ts:48   readIdempotencyKey
MA CAS:            versions.routes.ts:133 · baseline.routes.ts:70-76 (context) · prediction.routes.ts:78-83
                   export-import.routes.ts:248 · valuation.routes.ts:173-221 (tylko most legacy)
CAS WARUNKOWY:     statements.routes.ts:124 · analysis.routes.ts:90   ← tylko gdy attemptReadinessTransition===true
CAS SAMOSPEŁNIAJĄCY: models.routes.ts:148, :234   ← expectedVersion ?? current.version — klient bez nagłówka ZAWSZE wygrywa
BEZ CAS:           baseline.routes.ts:176 (assumptions), :237 (compute) · prediction.routes.ts:115, :162
                   artifacts.routes.ts:122, :390 · versions.routes.ts:173
                   CAŁY blok wyceny valuation.routes.ts:244-908 (m.in. :520 wacc-inputs, :582 dcf, :717 bridge)

# AUDYT (pozycja E)
grep -rn "audit" server/src/routes/v8/finance-v2/   → PUSTO (poza __tests__)
server/src/services/AuditEventsService.ts:201       auditEventsService — ZERO importerów z Finance
server/src/services/finance/canonical/artifactVersionService.ts:340/573/1157/1466
                                                    artifact_lifecycle_events — TYLKO cykl życia

# NIEAKTUALNOŚĆ (pozycja F.1)
server/src/services/finance/canonical/lineageFreshnessService.ts:224-300   REALNA propagacja STALE_SOURCE (BFS, org-scoped)
server/src/services/finance/canonical/artifactVersionService.ts:597, :1191 wyzwalacze W TEJ SAMEJ transakcji
server/src/services/finance/canonical/artifactVersionService.ts:915-921    approve zablokowany, gdy freshness ≠ CURRENT
server/src/services/finance/financeCandidateHandoffCore.ts:85-86, 108-109  sourceVersion/sourceFingerprint — ZAPISANE, NIGDY NIEPORÓWNANE
server/src/services/finance/financeStatementPackCandidateHandoff.ts:151    sourceVersion: 'unknown' na sztywno

# SZEW ROI/FINANCE (pozycja F.2)
server/src/services/finance/canonical/roiFinanceReconciliationAdapter.ts   OSIĄGALNY: economics.routes.ts:26 (findReconciliationTargetForInitiative)
server/src/services/finance/canonical/roiFinanceLinkAdapter.ts             ZERO produkcyjnych wołających (tylko własne testy)

# FAŁSZYWY SUKCES (pozycja G.1)
server/src/routes/v8/finance.routes.ts:1713-1735   POST /models/:modelId/analyze → 202 {status:'queued'} — NIC nie kolejkowane
server/src/routes/economics.routes.ts:2375-2401    POST /financial-analyses/:id/insights → {status:'generated'} — NIC nie wygenerowane

# MARTWE ZAMONTOWANE (pozycja G.2) — zero klientów
Gateway.ts:1446   /api/finance-v4        → finance-enterprise.routes.ts
Gateway.ts:1402   /api/budget            → budget.routes.ts
Gateway.ts:956    /api/budgets           → budgets.routes.ts
routes/v8/index.ts:117  /finance-value   → financeValueRoutes  (alias; /finance/value ŻYJE w 11 plikach)
routes/v8/index.ts:112  /finance/value-tracking → finance-value.routes.ts

# NAGŁÓWKI-KŁAMSTWA (pozycja G.3)
server/src/routes/v8/financeValueDemoAllowlist.ts:19-20        „deliberately not imported by Gateway.ts" — a JEST, Gateway.ts:417/559, i omija demoWriteGuard
server/src/routes/v8/financeValueRoutes.ts:12                  „intentionally NOT mounted" — a JEST (dwa razy)
server/src/routes/v8/finance-value.routes.ts:22-23             jw.
server/src/routes/financeCandidateHandoffStatementPack.routes.ts:4-6   „NOT mounted here" — a JEST, Gateway.ts:1434

# TESTY (wzorzec)
server/src/routes/v8/finance-v2/__tests__/*.pg.test.ts        21 plików
server/src/services/finance/canonical/__tests__/*.pg.test.ts  ~35 plików
wzorzec bramki: describe.skipIf(!REAL_PG), REAL_PG = RUN_DB_TESTS==='1' && MOCK_DB==='false' && DATABASE_URL.startsWith('postgres')
wzorzec appAs(): statements.routes.pg.test.ts:37-50 — WSTRZYKUJE req.user/req.v8Context (patrz Z21)
config: server/vitest.config.ts (NIE ZMIENIASZ, Z18)

# MIGRACJE
najwyższa widoczna: 20261120_fresh_db_schema_gap_closure.sql
Twój przedział: 20261140-20261149 (ls | grep '^2026114' → PUSTE przy wystawianiu instrukcji)
```

### 1.6. ★ PODZIAŁ FRONT / TYŁ — reguła rozstrzygająca

Kontrakt odzyskania jest napisany **oczami użytkownika**, więc miesza obie
strony w jednym zdaniu. Reguła rozstrzygająca jest prosta:

> **Jeżeli dowód da się przeprowadzić `supertest`-em przeciwko routerowi
> i realnemu PG — to Twoje. Jeżeli dowodem musi być zrzut ekranu — to nie
> Twoje.**

Zastosowanie do kontraktu, pozycja po pozycji:

| `FIN-REC` | Front (nie Twoje)                                       | Tył (Twoje)                                                                          |
| --------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `001`     | inwentarz komponentów                                   | **inwentarz tras, bramek, powierzchni zapisu** (§A)                                    |
| `002`     | **CAŁE — zrobione dnia 4**                              | —                                                                                       |
| `003`     | **CAŁE**                                                | —                                                                                       |
| `004-008` | montaż workspace'u, wygląd karty                        | **API pod każdą kartą: zapis, readback, wersja, zatwierdzenie, handoff** (§B, §C, §D)  |
| `009`     | kreator, przejście po utworzeniu, anulowanie            | **brak fantomowego rekordu i brak podwójnego POST po stronie serwera** (§D.2)          |
| `010`     | —                                                       | **CAŁE: tenant, rola, CAS, audit event, cold reopen** (§C, §D, §E)                      |
| `011`     | osobne, czytelne stany w UI                             | **typowany kontrakt błędów, po którym UI może te stany rozróżnić; retry bez duplikatu** (§C.2, §D.2) |
| `012`     | **CAŁE**                                                | —                                                                                       |
| `013`     | preview danych wejściowych, link zwrotny                | **przekazanie source version, lineage, kontrolowana informacja o nieaktualności** (§F)  |
| `014`     | testy komponentowe, Browser E2E                         | **testy jednostkowe przejść, testy integracyjne API na realnym PG, negatyw tenanta** (§T) |
| `015`     | **CAŁE — odbiór właścicielski**                         | —                                                                                       |

**Produktem Twojego dyżuru dla frontu jest sekcja „KONTRAKT DLA FRONTU"
w raporcie** — tabela tras, ciał, odpowiedzi i kodów błędów. Robotnik wewnętrzny
bierze ją i podpina, nie zgadując.

### 1.7. ★ Znane pułapki — przeczytaj, zanim zaczniesz

1. **`describe.skipIf(!REAL_PG)` zamienia brak env w zielony wynik.** Pakiet
   z 40 testami przy niekompletnym env raportuje `40 skipped`, a nie `40 failed`.
   **Zawsze podawaj liczbę SKIPPED.** Wymagane są **cztery** zmienne, nie dwie
   (`MOCK_DB=false` włącznie) — §Z19.
2. **`v8FeatureGate` może uczynić 4 z 5 kart nieosiągalnymi.** Tylko legacy
   `/api/v8/finance/statements/*` ma bypass (`financeStatementMountedSurface.ts`).
   **Nie otwieraj bramki. Zmierz i opisz.** (§B)
3. **`models.routes.ts:148` — CAS, który zawsze przechodzi.**
   `expectedVersion ?? current.version` czyta wersję i sam sobie ją podstawia.
   To wygląda jak ochrona konfliktu i nią nie jest.
4. **`statements.routes.ts:124` / `analysis.routes.ts:90` — CAS tylko przy
   przejściu stanu.** Zapis danych bez `attemptReadinessTransition` idzie
   **bez żadnej kontroli współbieżności**.
5. **Zdarzenie audytu poza transakcją mutacji = Z22.** Jeżeli audyt zapisze się,
   a mutacja padnie (albo odwrotnie) — masz atrapę z zewnętrznym skutkiem.
   **Jedna transakcja albo nic.**
6. **`v8/finance.routes.ts` pisze do TYCH SAMYCH serwisów kanonicznych**
   (`budgetRegistrationService`, `statementPackArchiveCommandService`,
   `digitizationAnalysisArchiveCommandService`, `budgetDiscardCommandService`,
   `financeSettingsCommandService`) — z **innym** łańcuchem strażników.
   Zamknięcie dziury w `finance-v2` niczego nie zamyka, jeśli ta sama komenda
   jest osiągalna obok. **To jest ustalenie do RAPORTU i STOP-u, nie do
   samodzielnego przepinania.** (§B.3)
7. **Kanoniczne lineage MA staleness — nie buduj go drugi raz.**
   `lineageFreshnessService.ts:224-300` robi BFS po potomkach i oznacza
   `STALE_SOURCE`, a `artifactVersionService.ts:915-921` blokuje `approve`
   przy `freshness ≠ CURRENT`. Luka jest **gdzie indziej**: w handoffie do
   Kandydata (§F.1).
8. **Zakaz zmyślania taksonomii.** Jeśli w bazie nie ma słownika
   `canonicalLineId` → nazwa, to produktem jest `BRAK_DANYCH` + kontrakt, a nie
   wymyślony słownik polskich nazw pozycji sprawozdania finansowego. To samo
   dotyczy imion autorów. **Zmyślona taksonomia księgowa jest gorsza niż surowy
   kod** — surowy kod da się rozpoznać, zmyślona nazwa nie.
9. **`x-org-context` to realna droga wejścia organizacji.** Test negatywny
   tylko na `body.organizationId` **nie wystarcza** — patrz DoD pkt 8.
10. **Numeracja migracji: w repo są już zdublowane numery** (`20261054`,
    `20261057`, `20261058`, `20261061`). To dług, nie precedens.

### 1.8. ★ ERRATA DO MATERIAŁU ZLECENIA — czytaj, zanim zaczniesz szukać

Materiał, na podstawie którego powstała ta instrukcja, zawierał cztery
nieścisłości. **Poniższe ustalenia są wiążące i zastępują brief.** Jeżeli
znajdziesz kolejne — wpisujesz je w „Korekty wobec instrukcji" dokładnie w tym
formacie i **też stają się wiążące dla odbioru**.

1. **`financeOwnerSampleData` NIE jest pozycją tylną i NIE jest otwarta.**
   Brief sugerował, że flaga „podmienia listy na zaszyte próbki" i jest
   kandydatem na pozycję dyżuru. Weryfikacja: mechanizm żyje **wyłącznie
   w `src/`** (`src/components/Economics/financeOwnerSampleData.ts`,
   `FinanceHub.tsx:127`, `hooks/useFinanceData.ts:35`) — czyli **poza Z17** —
   i został **utwardzony 2026-08-25** przez pozycję `F.4` dyżuru dnia 4
   (commit `207124e9e9`, 5/5 PASS): odmowa na hoście produkcyjnym, jawny banner
   `data-testid="finance-sample-data-banner"`, zamrożony licznik próbek, zero
   zmian w danych. **Nie jest to więc atrapa udająca dane klienta — jest to
   jawnie oznaczony tryb przykładowy**, czyli dokładnie to, co dopuszcza
   polityka „zakaz atrap, dopuszczalny jawny tryb przykładowy".
   **Twoja część tej sprawy jest wąska i tylna** — §G.4 pkt 1: udowodnić, że
   **serwer** nigdy nie podstawia próbki, że pusta baza daje pustą listę,
   i że nie istnieje serwerowa furtka analogiczna do tej, którą dzień 4 zamknął
   po stronie klienta. **Nie ruszasz pliku frontowego.**
2. **Kontrakt odzyskania jest w większości frontowy.** `FIN-REC-002`, `003`,
   `012`, `015` i cała §3 kontraktu (menu, preview, `Back`, direct URL) nie mają
   tylnej połowy. `FIN-REC-002` jest ponadto **już zrobione** (dzień 4, 109/109
   PASS). **Nie rozliczaj ich jako swoich braków** — w §A oznaczasz je
   `POZA_ZAKRESEM_TYŁU` z odsyłaczem, a nie `BRAK`.
3. **Kontrakt NIE żąda spójności z Results/ROI — i to jest ważne rozróżnienie.**
   Brief kazał zadbać o „spójność z Results/ROI tam, gdzie kontrakt tego żąda".
   Weryfikacja: w 284 liniach kontraktu **nie pada ani „Results", ani „ROI"** —
   `FIN-REC-013` mówi wyłącznie o handoffach **wewnątrz** Finance
   (Statements→Analysis→Models→Prediction/Valuation). Szew ROI/Finance istnieje
   w kodzie (`roiFinanceLinkAdapter.ts`, `roiFinanceReconciliationAdapter.ts`,
   tabela `rvn_roi_finance_reconciliations`, migracja `20260820_rvn_roi_finance_seam.sql`),
   ale jego podstawą jest `ROI-E007`, nie ten kontrakt. **Dlatego §F.2 jest
   pozycją OPCJONALNĄ o jasno ograniczonym celu: osiągalność już zbudowanej
   połowy LINK, zero nowej semantyki.** Nie wolno Ci pod tym pretekstem
   projektować integracji Finance↔Results.
4. **`billing_invoices` i `credit_notes` NIE należą do modułu 10 Finance.**
   Brief kazał sprawdzić, „które z obiektów `NO_MIGRATION` dotyczą Finance".
   Odpowiedź, zweryfikowana przy wystawianiu instrukcji: **żaden.**
   - `billing_invoices` — jedyne odwołanie:
     `server/src/services/tokenBillingService.ts:313` (rozliczanie tokenów,
     Stripe). Brak `CREATE TABLE` w `server/migrations/` — klasa `NO_MIGRATION`
     nadal otwarta, ale **właścicielem jest billing platformowy superadmina**.
   - `credit_notes` — router `server/src/routes/billing/billing.routes.ts`,
     bramkowany `requireSuperAdmin`, montaż `Gateway.ts:575-576`
     (`/api/billing`, `/api/superadmin/billing`). Producent **już powstał**
     w `20261120_fresh_db_schema_gap_closure.sql:657`.
   - `server/src/routes/billing.routes.ts` (poziom główny) to **martwy duplikat**
     — `Gateway.ts` importuje wyłącznie `./routes/billing/billing.routes.js`.
     Zgłaszasz do „Znalezisk", **nie kasujesz** (inny moduł).
   - **Moduł 10 Finance ma ZERO obiektów w klasach `ONLY_DEAD` i `NO_MIGRATION`.**
     Żadna tabela `finance_*` / `financial_*` nie występuje w
     `20261120_fresh_db_schema_gap_closure.sql`; blok `ADD COLUMN` tej migracji
     (linie 2198-2276) dotyka wyłącznie `organizations`, `subscription_plans`,
     `organization_billing`, `knowledge_chunks`, `initiative_status_history`,
     `ai_playbook_templates`, `email_templates`, `kb_articles`.
     **§H jest więc pozycją WERYFIKACYJNĄ, nie budowlaną** — najprawdopodobniej
     jej produktem jest jedno zdanie „brak zadań dla modułu 10" z dowodem.
5. **`FRESH_POSTGRES_SCHEMA_AUDIT_2026-08-23.md` to NIE jest audyt `DEC-116`.**
   To wcześniejszy, inny dokument (83 linie, łańcuch 830/831 migracji), bez
   klasyfikacji `ONLY_DEAD`/`NO_MIGRATION`. Klasyfikacja `DEC-116` żyje
   w **dwóch** miejscach: `OWNER_DECISION_LEDGER_2026-08-24.md:168` oraz
   w nagłówku `server/migrations/20261120_fresh_db_schema_gap_closure.sql:1-60`.
   **Uwaga: te dwa źródła podają różne liczby** obiektów `NO_MIGRATION`
   (rejestr: 150; nagłówek migracji: 96). Rozbieżność odnotowujesz, **nie
   rozstrzygasz** — dla Ciebie i tak wynikiem jest zero (pkt 4).

---

## §A. INWENTARZ STANU WOBEC KONTRAKTU ODZYSKANIA — produkt Bloku 0

**To jest pozycja, nie rozgrzewka.** Kontrakt ma piętnaście zadań i cztery
poziomy ukończenia; nikt dotąd nie rozliczył jego **tylnej** połowy. Bez tej
tabeli reszta dyżuru jest zgadywaniem, a odbiór nie ma jak sprawdzić, czego nie
zrobiłeś.

### A.1 — Tabela `FIN-REC-001…015`

Dla **każdego** z piętnastu zadań kontraktu wypełniasz wiersz:

| `FIN-REC` | Tylna połowa zadania (jedno zdanie) | Stan | Dowód `plik:linia` | Pozycja tego dyżuru |
| --------- | ----------------------------------- | ---- | ------------------ | ------------------- |

Dozwolone wartości `Stan`, i **tylko** te:

- `ZROBIONE` — tylna połowa istnieje, jest osiągalna i ma test behawioralny.
  **Podajesz test.**
- `CZĘŚCIOWO` — istnieje częściowo; **piszesz, czego brakuje**, jednym zdaniem.
- `BRAK` — tylnej połowy nie ma.
- `POZA_ZAKRESEM_TYŁU` — zadanie nie ma tylnej połowy (np. `FIN-REC-003`,
  `012`, `015`) **albo zostało zrobione po froncie przez inny dyżur**
  (`FIN-REC-002`, dzień 4). **Podajesz odsyłacz.**

`Stan` nadajesz **wyłącznie na podstawie kodu i testów, które sam uruchomiłeś**,
nigdy na podstawie cudzego raportu. Cudzy raport jest wskazówką, gdzie patrzeć.

### A.2 — Mapa osiągalności `trasa → bramki → router → serwis → tabela`

Osobna tabela, po jednym wierszu na **każdą z pięciu kart** kontraktu
(Statements, Analysis, Models/Baseline, Prediction, Enterprise Valuation),
w formacie z ramki Z20. Pozycje bez montażu albo za zamkniętą bramką dostają
`ZABLOKOWANE_BRAMKĄ` z nazwą bramki.

### A.3 — Inwentarz powierzchni zapisu

Lista **wszystkich** tras mutujących modułu Finance (metoda + ścieżka +
`plik:linia`), z czterema kolumnami:

`CAS?` · `Klucz idempotencji?` · `Zdarzenie audytu?` · `Negatyw tenanta w teście?`

To jest surowiec dla §C, §D i §E. **Bez tej tabeli tamte pozycje są
nieodbieralne**, bo nie wiadomo, co było przed.

**DoD `A`:** trzy tabele w raporcie; każdy wiersz z `plik:linia`; zero pozycji
`UNKNOWN` ukrytych jako gotowe (kontrakt `FIN-REC-001` żąda tego dosłownie);
commit `docs(finance): ...`.

---

## §B. OSIĄGALNOŚĆ KANONICZNEJ POWIERZCHNI — sedno dyżuru

Kontrakt §10 („Definicja końca modułu") mówi: „pięć rejestrów i **pięć pełnych
kart działa na jednym candidate SHA**". `MODULE_ACCEPTANCE` 10_FINANCE opisuje
runtime'y, na których to działało — ale **każdy z nich był runtime'em dowodowym
z własną bazą i własnymi flagami**. Pytanie, na które nikt nie odpowiedział
brzmi: **czy kanoniczna powierzchnia Finance jest osiągalna na domyślnym
okablowaniu?**

### B.1 — Mapa osiągalności pięciu kart (obowiązkowa)

Ustal **empirycznie**, testem HTTP na realnym PG, dla każdego z pięciu typów:

1. czy żądanie z poprawnym tokenem i aktywnym członkostwem **dochodzi** do
   routera `finance-v2`;
2. jeśli **nie** — która bramka je zatrzymuje (`v8FeatureGate` /
   `v8OrgGate` / `requireActiveMembership` / `requireCanonicalFinanceMutation`)
   i z jakim kodem;
3. czy istnieje ścieżka omijająca (jak `financeStatementMountedSurface` dla
   legacy Statements) i **co dokładnie** obejmuje jej allowlista.

**To jest pomiar, nie naprawa.** Jeżeli okaże się, że cztery z pięciu kart są
niedostępne bez `ENABLE_V8_GLOBAL=true`, **NIE otwierasz flagi** (Z10) — piszesz
`ZABLOKOWANE_BRAMKĄ`, podajesz `plik:linia` bramki i **stawiasz STOP z
propozycją dla nadzorcy**. To jest decyzja produktowa właściciela (`DEC-05`:
„4 flagi V3 włączane POJEDYNCZO, każda po akcepcie właściciela na zrzucie").

**DoD `B.1`:** tabela 5 kart × (osiągalna? · bramka · kod · obejście); test HTTP
na realnym PG dla każdego wiersza; wpis w „Dowodach osiągalności".

### B.2 — Test domyślnego okablowania (Z21, obowiązkowy)

Zastane pakiety `*.pg.test.ts` budują własny `express()` i wstrzykują
`req.user` / `req.v8Context` (`statements.routes.pg.test.ts:37-50`). Dowodzą
przez to logiki routera i strażników **wewnątrz** `financeV2Router`,
ale **nie dowodzą niczego** o łańcuchu montażu powyżej.

Budujesz **nowy** pakiet, który montuje aplikację **przez produkcyjny łańcuch**
(`routes/v8/index.ts` → `finance-v2/index.ts`), bez ręcznego wstrzykiwania
kontekstu, i dowodzi minimum czterech rzeczy:

1. żądanie bez tokenu → `401`;
2. żądanie z tokenem, ale bez aktywnego członkostwa → `403`;
3. żądanie z aktywnym członkostwem → dochodzi do handlera;
4. żądanie z nagłówkiem `x-org-context` wskazującym **obcą** organizację, bez
   członkostwa w niej → `403`/`404`, **nigdy** `200` i **nigdy** dane obcej
   organizacji.

**Jeżeli nie da się zamontować produkcyjnego łańcucha w teście bez zmiany
globalnej infrastruktury testowej — to jest STOP (Z18), nie zmiana
infrastruktury.**

**DoD `B.2`:** nowy plik `*.pg.test.ts`; 4 przypadki; realny PG; dowód celu
połączenia; wpis w tabeli „Testy domyślnego okablowania".

### B.3 — Drugi tor zapisu na tę samą pamięć kanoniczną (ustalenie + STOP)

`server/src/routes/v8/finance.routes.ts` (~4 554 linie, ~85 endpointów) importuje
**te same serwisy komend kanonicznych**, co `finance-v2`
(`budgetRegistrationService`, `statementPackArchiveCommandService`,
`digitizationAnalysisArchiveCommandService`, `budgetDiscardCommandService`,
`financeSettingsCommandService`), ale **poza łańcuchem strażników
`finance-v2/index.ts:61-62`**.

Twoim produktem jest **ustalenie**, nie przepięcie:

1. lista komend kanonicznych osiągalnych **oboma** torami (nazwa serwisu +
   `plik:linia` obu wejść);
2. dla każdej: czy strażnicy obu torów są **równoważne** (kto może wywołać,
   z jaką rolą, z jaką kontrolą tenanta);
3. jeżeli **nie są** — to jest **realna dziura**, i wtedy **STOP** z opisem,
   bo przepięcie 85 endpointów to osobna decyzja produktowa.

**Zakaz:** nie usuwasz, nie przepinasz i nie „ujednolicasz" `v8/finance.routes.ts`.
Ten plik jest w ramce `NIE WOLNO` poza jednym handlerem z licencji §G.1.

**DoD `B.3`:** tabela komend dwutorowych; werdykt „równoważne / nierównoważne"
per komenda, z dowodem; przy „nierównoważne" — wpis STOP.

---

## §C. KONTRAKT UPRAWNIEŃ I BŁĘDÓW — zamknięcie STOP-u `F.6` dnia 4

Dyżur dnia 4 nie mógł zrobić stanów brzegowych, bo **serwer nie daje frontowi
czym ich rozróżnić**. Cytat z jego macierzy 5×8: kolumna „brak uprawnień" =
`NIEODRÓŻNIALNY` we wszystkich pięciu kartach. To jest brak **tylny**.

### C.1 — Kompletny kontrakt zdolności dla pięciu typów

Zastane: `GET /api/v8/finance-v2/artifacts/:artifactId/capabilities`
(`artifacts.routes.ts:342-379`) zwraca `{artifactId, businessVersionId, status,
version, freshness, role, allowedActions}`. Rola pochodzi z
`mapOrgRoleToFinanceRole(userRole)` (`_shared.ts:33-39`) — czyli **z roli
w organizacji**, bo przypisanie roli Finance per użytkownik (`AP-09`) nie
istnieje; komentarz w `_shared.ts:28-31` mówi to wprost.

Twój produkt:

1. **Zweryfikuj empirycznie**, czy endpoint działa dla **wszystkich pięciu**
   typów artefaktów, nie tylko dla tego, na którym go zbudowano. Test
   tabelaryczny: 5 typów × 4 role (`viewer` / `preparer` / `approver` /
   `finance_admin`) × minimum 3 statusy = tabela `allowedActions`.
2. **Zweryfikuj wybór wersji bieżącej.** `artifacts.routes.ts:353-354` bierze
   `versions[versions.length - 1]` jako „bieżącą". Sprawdź, czy
   `listBusinessVersions` gwarantuje porządek i czy istnieje jawny wskaźnik
   wersji bieżącej (`MODULE_ACCEPTANCE` wspomina o „current-pointer equality").
   Jeżeli „ostatnia z listy" ≠ „bieżąca" — to jest **defekt**, napraw go
   i udowodnij testem.
3. **Uzupełnij braki**, jeśli któryś typ lub akcja nie ma pokrycia — addytywnie,
   bez zmiany kształtu odpowiedzi dla przypadków już pokrytych (to zamrożony
   kontrakt `WP-B02 §4.3`).
4. **Negatyw tenanta:** artefakt obcej organizacji → `404`, nigdy `403` z
   danymi, nigdy `200`.
5. **Kontrakt dla frontu** — pełna tabela do raportu: typ, status, rola →
   `allowedActions`. To jest **jedyny** produkt, którego robotnik frontowy
   potrzebuje, żeby zdjąć z `FinanceHub.tsx` sześć zaszytych `preparer`.

**Zakaz:** nie budujesz przypisania roli Finance per użytkownik (`AP-09` jest
poza zakresem i wymagałby zmian w modelu uprawnień — Z16). Jeżeli uznasz, że
kontrakt zdolności bez `AP-09` jest niepełny — piszesz to w raporcie jako
ograniczenie, nie budujesz `AP-09`.

**DoD `C.1`:** test tabelaryczny 5×4×3 na realnym PG; negatyw tenanta; test
domyślnego okablowania (Z21); tabela `allowedActions` w raporcie; commit.

### C.2 — Jedna typowana taksonomia błędów mutacji

Zastane jest heterogeniczne i miejscami niebezpieczne:

- `_shared.ts:56` daje kopertę `{error, code}` — dobrze;
- ale statusy są wyprowadzane **ad hoc** w każdym pliku, a w
  `valuation.routes.ts:153` **z wyrażenia regularnego na treści komunikatu**
  (`/must be approved before it can seed a valuation$/`). Zmiana literówki
  w komunikacie zmienia kod HTTP. To nie jest kontrakt, to przypadek;
- `models.routes.ts:173` zwraca `{code:'VERSION_CONFLICT'}` **bez** pola `error`
  (zamrożony fixture `F4`) — czyli koperta nie jest jednolita nawet dziś.

Twój produkt — **nowy plik** `server/src/routes/v8/finance-v2/financeErrorTaxonomy.ts`:

1. **Zamknięty zbiór klas błędu** z jednoznacznym mapowaniem na status HTTP.
   Minimum, wymagane przez kontrakt `FIN-REC-011` („loading, brak danych, brak
   uprawnień, niezgodne ID, błąd API, konflikt wersji, błąd obliczeń, częściowe
   dane"):

   | Klasa                  | HTTP  | Kiedy                                                     |
   | ---------------------- | ----- | --------------------------------------------------------- |
   | `INVALID_BODY`         | `400` | ciało niepoprawne składniowo                              |
   | `FORBIDDEN_ROLE`       | `403` | rola nie ma tej akcji w `allowedActions`                   |
   | `NOT_FOUND`            | `404` | brak obiektu **lub obcy tenant** (fail-closed, bez wycieku) |
   | `VERSION_CONFLICT`     | `409` | CAS odrzucił zapis                                        |
   | `STATE_PRECONDITION`   | `409` | status nie pozwala na akcję                               |
   | `DATA_INCOMPLETE`      | `422` | dane wejściowe niekompletne merytorycznie                 |
   | `COMPUTE_FAILED`       | `422` | obliczenie padło merytorycznie                            |

   **Zbiór dopasuj do stanu faktycznego z §A.3** — powyższe to minimum, nie
   zamknięta lista. Każda klasa, którą dodasz, musi mieć realnego producenta.
2. **Zlikwiduj wyprowadzanie statusu z treści komunikatu.** Po zmianie
   `grep -n "test(message)\|\.test(String(error" server/src/routes/v8/finance-v2/`
   ma być puste (albo mieć jawnie uzasadnione wyjątki w raporcie).
3. **Zero zmian kontraktu tam, gdzie jest zamrożony.** `models.routes.ts:173`
   (`{code:'VERSION_CONFLICT'}` bit-identyczne z fixture `WP-A02 F4`)
   **zostaje**. Taksonomia ma go **opisywać**, nie przepisywać. Jeżeli
   ujednolicenie wymagałoby złamania fixture — to jest STOP.
4. **Parytet PL+EN** dla komunikatów, które faktycznie wychodzą z API
   (§0.4 przypis).

**DoD `C.2`:** nowy plik taksonomii; wszystkie trasy `finance-v2` używają go
zamiast lokalnych `?:`; test jednostkowy zbioru (każda klasa → dokładnie jeden
status); minimum 4 testy behawioralne HTTP dowodzące **rozróżnialności**
(`403` ≠ `404` ≠ `409` ≠ `422` na tej samej trasie); tabela klas w raporcie
jako kontrakt dla frontu; commit.

---

## §D. OCHRONA KONFLIKTU I IDEMPOTENCJA PONOWIENIA

Kontrakt `FIN-REC-010`: „Każda mutacja ma właściwy tenant, role check,
**wersję/CAS lub równoważną ochronę konfliktu** i audit event".
Kontrakt `FIN-REC-011`: „**Retry nie może duplikować mutacji.**"
Macierz §6: „Konflikt → jawny komunikat, **bez cichego nadpisania**".

### D.1 — CAS tam, gdzie agregat ma wersję

Punkt wyjścia to tabela z §A.3. Stan zastany (do potwierdzenia):

| Grupa                   | Trasy                                                                                                       | Problem                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| CAS realny              | `versions.routes.ts:133` · `baseline.routes.ts:70-76` · `prediction.routes.ts:78-83` · `export-import.routes.ts:248` · `valuation.routes.ts:173-221` | —                                              |
| CAS **warunkowy**       | `statements.routes.ts:124` · `analysis.routes.ts:90`                                                        | zapis danych bez przejścia stanu idzie bez CAS |
| CAS **samospełniający** | `models.routes.ts:148` · `models.routes.ts:234`                                                             | `expectedVersion ?? current.version`           |
| **Bez CAS**             | `baseline.routes.ts:176, 237` · `prediction.routes.ts:115, 162` · `artifacts.routes.ts:122, 390` · `versions.routes.ts:173` · cały blok `valuation.routes.ts:244-908` | ciche nadpisanie                               |

Twój produkt, w tej kolejności ważności:

1. **`models.routes.ts` — usuń samospełnianie.** Brak `expectedVersion` ma dawać
   `400 EXPECTED_VERSION_REQUIRED` (wzorzec: `versions.routes.ts:133-136`),
   a nie podstawienie świeżo odczytanej wersji. **Uwaga na zamrożony fixture
   `F4`** — jeżeli fixture wymaga przejścia bez nagłówka, to jest STOP z opisem,
   nie osłabienie fixture.
2. **`baseline.routes.ts:176` (assumptions) — CAS obowiązkowy.** To zbiorczy
   upsert na najczęściej edytowanej powierzchni; dziś dwóch użytkowników
   nadpisuje się bez śladu.
3. **Blok wyceny `valuation.routes.ts:244-908`** — minimum dla tras, które
   **modyfikują istniejący obiekt**: `PATCH /variants/:bvId` (`:335`),
   `PUT /wacc-inputs` (`:520`), `PUT /bridge` (`:717`). Trasy czysto tworzące
   (`POST /cases`, `POST /variants`) idą do `D.2`, nie tutaj.
4. **`statements`/`analysis`** — rozstrzygnij uczciwie: albo CAS bezwarunkowy,
   albo jawny wpis, dlaczego zapis danych nie potrzebuje wersji, poparty
   właściwością serwisu (np. idempotentny upsert po kluczu naturalnym).
   **„Nie zdążyłem" jest lepsze niż „uznałem, że nie trzeba" bez dowodu.**

**Zasada nadrzędna:** CAS dodajesz **tylko tam, gdzie agregat naprawdę ma
wersję** i serwis potrafi ją sprawdzić w tej samej transakcji. Dodanie pola
`expectedVersion`, które nikt nie weryfikuje, jest **atrapą** (Z22) — gorszą
niż jej brak, bo front zacznie jej ufać.

**DoD `D.1`:** dla każdej zmienionej trasy — test wyścigu na realnym PG (dwa
zapisy z tą samą `expectedVersion`: pierwszy `200`, drugi `409`, w bazie
**jedna** zmiana, potwierdzona niezależnym połączeniem); negatyw tenanta;
tabela „przed/po" w raporcie z liczbami, nie przymiotnikami.

### D.2 — Idempotencja ponowienia

Kontrakt `FIN-REC-009`: „bez fantomowego rekordu i **bez podwójnego POST**".
Kontrakt `FIN-REC-011`: „**Retry nie może duplikować mutacji.**"

Zastane: `readIdempotencyKey` (`_shared.ts:48`) jest używany w
`compute.routes.ts:82`, `lineage-navigator.routes.ts:231`, `baseline.routes.ts:98`,
`models.routes.ts:202`, `export-import.routes.ts:232`, `prediction.routes.ts:73`
i w moście legacy wyceny. **Trasy czysto tworzące go nie wymagają** —
`POST /artifacts` (`artifacts.routes.ts:122`), `POST /valuation/cases` (`:244`),
`POST /valuation/cases/:caseId/variants` (`:289`).

Twój produkt:

1. **Wymóg klucza idempotencji na trasach tworzących** obiekty kanoniczne,
   z zachowaniem przy powtórzeniu: **ten sam klucz → ta sama odpowiedź, jeden
   wiersz w bazie**, nie drugi obiekt i nie `409`.
2. **Sprawdź, czy jest gdzie ten klucz trzymać.** Jeżeli istnieje zastany
   wzorzec pokwitowań (`*_command_receipts`, `finance_import_receipts`,
   `finance_prediction_authoring_receipts`) — **użyj go**, nie twórz drugiego.
   Jeżeli dla danej trasy nie ma, a jest potrzebny — to **jedyny prawdopodobny
   powód migracji w tym dyżurze** (§0.3 pkt 5).
3. **★ Zakaz atrapy (Z22):** powtórzenie ma zwrócić sukces **dlatego, że
   pierwotny zapis istnieje w bazie**, a nie dlatego, że handler zobaczył
   powtórzony klucz i „udał, że zrobił".

**DoD `D.2`:** test ponowienia na realnym PG dla każdej zmienionej trasy
(dwukrotne wywołanie z tym samym kluczem → `COUNT(*) = 1` z niezależnego
połączenia, obie odpowiedzi identyczne); test **różnych** kluczy → dwa obiekty;
negatyw tenanta; commit.

---

## §E. AUDYT MUTACJI — najgłębsza dziura kontraktu `FIN-REC-010`

Kontrakt mówi wprost: „Każda mutacja ma właściwy tenant, role check, wersję/CAS
lub równoważną ochronę konfliktu **i audit event**".

Stan zastany (do potwierdzenia w Bloku 0):

- `grep -rn "audit" server/src/routes/v8/finance-v2/` (bez `__tests__`) →
  **PUSTO**;
- **żaden plik Finance nie importuje `auditEventsService`**
  (`server/src/services/AuditEventsService.ts:201`) — robią to Inicjatywy, OKR,
  My Work, Chat, Prezentacje, Auth. **Finance nie.**
- jedyny ślad to lokalny, dopisywalny rejestr `artifact_lifecycle_events`,
  pisany w `artifactVersionService.ts:340` (`CREATE`), `:573` (przejście
  statusu), `:1157` (`APPROVE`), `:1466` (`REOPEN`).

Czyli: **cykl życia jest audytowany, cała płaszczyzna danych nie.** Mapowanie
sprawozdania, uzgodnienie, przeliczenie analizy, założenia bazowe, autoring
prognozy, wszystkie zapisy wyceny (WACC, DCF, mostek EV→Equity, wrażliwość) —
**nie zostawiają śladu nigdzie.**

Twój produkt:

1. **Jedno miejsce**, nie piętnaście: nowy plik
   `server/src/routes/v8/finance-v2/financeMutationAudit.ts` albo — jeśli
   ustalisz, że lepszym miejscem jest warstwa serwisu — odpowiednik w
   `services/finance/canonical/`. **Uzasadnij wybór w raporcie.**
2. **★ W TEJ SAMEJ TRANSAKCJI CO MUTACJA.** To jest warunek konieczny, nie
   optymalizacja. Audyt zapisany poza transakcją mutacji to **wzorcowa atrapa
   z zewnętrznym skutkiem** (Z22): albo zobaczysz ślad zmiany, której nie ma,
   albo zmianę bez śladu. Serwisy kanoniczne mają wzorzec
   `withPinnedPostgresTransaction` — użyj go.
3. **Zero audytu dla nieudanej mutacji.** Odrzucenie na CAS, `403` albo `422`
   **nie** produkuje zdarzenia „zmieniono".
4. **Rozstrzygnij docelowy rejestr uczciwie.** Dwie opcje, wybierasz jedną
   i uzasadniasz:
   - **rozszerzyć `artifact_lifecycle_events`** o zdarzenia płaszczyzny danych
     (spójne z modułem, ale rejestr przestaje być „tylko cykl życia");
   - **wołać `auditEventsService`** (spójne z resztą korpusu, Finance wchodzi do
     wspólnego strumienia audytu).
   **Nie rób obu.** Nie twórz trzeciego rejestru.
5. **Zakres minimalny, jeśli czasu mało:** trasy, które zmieniają liczby
   widoczne w karcie — `statements map/reconcile`, `analysis compute`,
   `baseline assumptions/compute`, `prediction authoring/calculate`,
   `valuation wacc-inputs/compute-dcf/bridge`. Resztę oznacz uczciwie.

**DoD `E`:** dla każdej objętej trasy — test na realnym PG, który po udanej
mutacji odczytuje **niezależnym połączeniem** dokładnie jedno zdarzenie audytu
z poprawnym `organizationId`, aktorem i identyfikatorem obiektu; **test
negatywny: mutacja odrzucona → ZERO zdarzeń**; **test transakcyjny: wymuszona
awaria zapisu → ZERO zdarzeń** (wzorzec dowodu z odbioru dnia 19); negatyw
tenanta; tabela objętych/nieobjętych tras w raporcie; commit.

---

## §F. NIEAKTUALNOŚĆ POTOMKA I SZEW ROI

Kontrakt `FIN-REC-013`, zdanie ostatnie: „**Aktualizacja źródła nie nadpisuje
automatycznie zatwierdzonego obiektu potomnego; tworzy kontrolowaną informację
o nieaktualności.**"

**★ Zanim zaczniesz: kanoniczne lineage TO JUŻ MA.** `lineageFreshnessService.ts:224-300`
robi BFS po potomkach i oznacza `STALE_SOURCE`, org-scoped, z uczciwym
raportowaniem obcięcia głębokości; wyzwalacze siedzą w
`artifactVersionService.ts:597` i `:1191`, **w tej samej transakcji**;
`approve` jest zablokowany przy `freshness ≠ CURRENT` (`:915-921`); jest
dopisywalny rejestr `finance_lineage_freshness_events` i trasa odczytu
`GET /versions/:bvId/freshness-events` (`crosscutting.routes.ts:80`).
**Nie buduj tego drugi raz. Potwierdź testem i idź dalej.**

### F.1 — Dryf źródła w handoffie do Kandydata (realna luka)

Zastane: cztery routery handoffu (`financeCandidateHandoff*.routes.ts`,
zamontowane `Gateway.ts:1422-1445`) zapisują wiersz w `finance_candidate_handoffs`
z **zamrożoną migawką** `source_snapshot` (`financeCandidateHandoffCore.ts:385`),
która przy odczycie jest **czytana z wiersza, nigdy nie wyprowadzana ponownie**
(`:311, :341-343, :425-429`). Migawka niesie `sourceVersion` i
`sourceFingerprint` (`:85-86`, domyślnie `UNKNOWN` w `:108-109`) — **i nikt ich
nigdy nie porównuje z żywym źródłem.** Dla sprawozdań `sourceVersion` jest na
sztywno `'unknown'` (`financeStatementPackCandidateHandoff.ts:151`), bo
`financial_statement_packs` nie ma kolumny wersji.

Skutek: po utworzeniu Kandydata **każda późniejsza zmiana źródła jest
niewidoczna** — Kandydat wskazuje na zamrożoną migawkę bez żadnego sygnału
dryfu. To jest dokładnie to, czego zakazuje `FIN-REC-013`.

Twój produkt:

1. **Wykrycie dryfu przy odczycie**: `GET .../:id` porównuje zapisany
   `sourceFingerprint` z odciskiem policzonym z **żywego** źródła i zwraca jawne
   pole stanu (`CURRENT` / `SOURCE_DRIFTED` / `UNKNOWN` z powodem).
2. **★ `UNKNOWN ≠ CURRENT`.** Tam, gdzie odcisku nie da się policzyć (np.
   sprawozdanie bez wersji), zwracasz `UNKNOWN` **z powodem** — nigdy
   `CURRENT`, nigdy `SOURCE_DRIFTED`. Uczciwe „nie wiem" jest wymogiem, nie
   ustępstwem (Z15).
3. **★ Zero automatycznego nadpisania.** Kontrakt mówi „**nie nadpisuje
   automatycznie**". Wykrycie dryfu **informuje**, nie odświeża migawki
   i nie zmienia Kandydata.
4. **`sourceVersion: 'unknown'` dla sprawozdań** — rozstrzygnij uczciwie:
   albo znajdziesz w schemacie realny nośnik wersji i go użyjesz, albo
   zostawiasz `unknown` i **opisujesz, czego brakuje**. Nie wymyślaj wersji.

**DoD `F.1`:** test na realnym PG: utwórz handoff → zmień źródło → odczyt
zwraca `SOURCE_DRIFTED`; test „źródło nietknięte → `CURRENT`"; test „brak
nośnika wersji → `UNKNOWN` z powodem"; test „odczyt NIE zmienia wiersza
handoffu" (porównanie `updated_at`/wersji przed i po, niezależnym połączeniem);
negatyw tenanta; commit.

### F.2 — Połowa LINK szwu ROI/Finance (OPCJONALNA)

**Przeczytaj erratę §1.8 pkt 3, zanim tu wejdziesz.** Kontrakt odzyskania
**nie żąda** integracji z Results/ROI; ta pozycja istnieje wyłącznie dlatego,
że **kod jest już napisany i nieosiągalny** — a to jest wzorzec, który `DEC-104`
kazał tępić.

Zastane:
- `roiFinanceReconciliationAdapter.ts` (połowa UZGODNIENIA) **jest osiągalny** —
  `economics.routes.ts:26` importuje `findReconciliationTargetForInitiative`;
- `roiFinanceLinkAdapter.ts` (połowa LINK) ma **zero produkcyjnych wołających**
  — jedyne odwołania to jego własny plik i jego własny test
  `__tests__/roiFinanceLinkAdapter.pg.test.ts`.

Twój produkt — **jeden z dwóch, nie oba**:

- **(a)** udostępnić istniejące operacje LINK
  (`linkFinanceArtifactToRoiCase`, `getFinanceContextForLink`,
  `listFinanceLinksForCase`) przez trasę w `finance-v2`, z pełnym DoD;
- **(b)** **uczciwy STOP**: „kod istnieje, jest nieosiągalny, oto dowód, oto co
  bym zrobił" — jeżeli okaże się, że brakuje decyzji produktowej o tym, kto
  i kiedy wiąże artefakt Finance z przypadkiem ROI.

**Twarde ograniczenia:** zero nowej semantyki uzgodnienia; zero zapisów do
`roi_realized_values`, `v8_roi_realization_entries`,
`benefit_tracking.actual_*` (append-only od
`20260809_finance_v3_e007_03_legacy_actual_protection.sql`, Z15); wszystkie
zapisy wyłącznie przez istniejące komendy
`server/src/services/resultsVnext/roi/` (Z17 — czytasz i wołasz, nie zmieniasz).

**`F.2` wolno uczciwie odłożyć.** Jest ostatnia w kolejności.

**DoD `F.2` (opcja a):** trasa + test HTTP na realnym PG; negatyw tenanta;
dowód, że powtórzone wiązanie nie tworzy drugiego wiersza; dowód osiągalności;
test domyślnego okablowania; commit.

---

## §G. UCZCIWOŚĆ ODPOWIEDZI I SPRZĄTANIE SERWERA

### G.1 — Dwa endpointy zwracające fałszywy sukces (Z22, `DEC-51`)

1. `server/src/routes/v8/finance.routes.ts:1713-1735` — `POST /models/:modelId/analyze`
   zwraca **HTTP 202** z `{analysisId: uuidv4(), status: 'queued', message: 'Analiza w kolejce'}`.
   **Nic nie jest kolejkowane.** `analysisId` to jednorazowy UUID, którego żaden
   endpoint nie rozwiąże. Użytkownik dostaje obietnicę i czeka w nieskończoność.
2. `server/src/routes/economics.routes.ts:2375-2401` — `POST /financial-analyses/:id/insights`
   zwraca `{id: uuidv4(), type, status: 'generated', summary: 'Analiza gotowa', items: []}`.
   **Nic nie zostało wygenerowane.** `status: 'generated'` jest nieprawdą.

Produkt: **jawna odpowiedź o niedostępności** — `501`/`503` z kodem
z taksonomii `C.2` albo `200` z jednoznacznym `status: 'unavailable'` i powodem.
**Wybierasz jeden kształt i stosujesz go w obu miejscach.**

**Zakazy, wszystkie twarde:**
- **nie podpinasz AI** (Z14) — to jest pozycja o uczciwości, nie o włączaniu
  silnika;
- **nie budujesz kolejki**, żeby `202` stało się prawdą;
- **zmieniasz DOKŁADNIE te dwa handlery**; reszta obu plików to tylko odczyt
  (licencja §G.1 w ramce Z17). Naruszenie = odrzucenie pozycji.
- **sprawdź konsumentów po stronie `src/` PRZED zmianą** (grep) i wpisz ich do
  raportu jako „front do dostosowania" — **nie dostosowujesz ich sam** (Z17).

**DoD `G.1`:** test HTTP dowodzący, że odpowiedź nie twierdzi już sukcesu; lista
konsumentów frontowych w raporcie; commit.

### G.2 — Martwe zamontowane powierzchnie serwera

Pięć powierzchni jest zamontowanych i **nie ma ani jednego klienta**
(zweryfikuj sam, `grep` po `src/`, `apps/`, `packages/`, `tests/`):

| Montaż                  | Router                       | Klienci |
| ----------------------- | ---------------------------- | ------- |
| `Gateway.ts:1446` `/api/finance-v4` | `finance-enterprise.routes.ts` (663 l.) | 0 (tylko martwe helpery w `src/services/api.ts`) |
| `Gateway.ts:1402` `/api/budget`     | `budget.routes.ts`           | 0 (tylko test integracyjny) |
| `Gateway.ts:956` `/api/budgets`     | `budgets.routes.ts`          | 0 |
| `routes/v8/index.ts:117` `/finance-value` | `financeValueRoutes` (alias) | 0 — **ale `/finance/value` z `index.ts:109` ŻYJE w 11 plikach** |
| `routes/v8/index.ts:112` `/finance/value-tracking` | `finance-value.routes.ts` | 0 |

**Produktem jest ustalenie z dowodem, nie masowa kasacja.** Usuwasz **wyłącznie**
to, dla czego masz komplet: (a) zero konsumentów w `src/`, `apps/`, `packages/`;
(b) zero konsumentów w `tests/` **albo** test, który testuje wyłącznie martwy
kod; (c) montaż jest w `Gateway.ts` / `routes/v8/index.ts` — **a te pliki są
poza Twoim zasięgiem**, więc samo odmontowanie jest **STOP-em dla nadzorcy**,
nie Twoją zmianą.

**W praktyce:** dla tego dyżuru `G.2` jest najprawdopodobniej **inwentarzem
z rekomendacją**, a nie kasacją. To jest wartościowy produkt — dokładnie taki,
jaki `DEC-109` wykonało dla Inicjatyw (12 824 linie usunięte po udowodnieniu
zerowej osiągalności per plik). **Nie usuwaj martwego frontu** (osobny tor).

**DoD `G.2`:** tabela pięciu powierzchni × dowód martwości (`grep` z wynikiem)
× rekomendacja; przy czymkolwiek usuniętym — test potwierdzający, że nic
żywego nie zniknęło; commit.

### G.3 — Cztery nagłówki-kłamstwa

Cztery pliki niosą komentarz stwierdzający, że **nie są zamontowane**, podczas
gdy są:

| Plik                                                  | Twierdzi                                  | Faktycznie                                          |
| ----------------------------------------------------- | ----------------------------------------- | --------------------------------------------------- |
| `routes/v8/financeValueDemoAllowlist.ts:19-20`        | „deliberately not imported by Gateway.ts" | `Gateway.ts:417` import, `:559` użycie — **i omija `demoWriteGuard`** |
| `routes/v8/financeValueRoutes.ts:12`                  | „intentionally NOT mounted in Gateway"    | zamontowany **dwukrotnie** (`routes/v8/index.ts:109` i `:117`) |
| `routes/v8/finance-value.routes.ts:22-23`             | jw.                                       | `routes/v8/index.ts:112`                            |
| `routes/financeCandidateHandoffStatementPack.routes.ts:4-6` | „NOT mounted here"                   | `Gateway.ts:1434`                                   |

Produkt: **poprawka wyłącznie komentarzy** (licencja §G.3), z podaniem
faktycznego `plik:linia` montażu. **Zero zmian zachowania.**

**★ Pierwszy wiersz jest poważniejszy niż literówka i wymaga osobnego wpisu.**
`financeValueDemoAllowlist.ts` jest realnie wpięty w `Gateway.ts:559`
(`isStatelessComputeDemoRoute`) i **wyłącza `demoWriteGuard`** dla pewnych tras.
Nagłówek mówi, że to „tylko propozycja". Ktoś czytający ten plik uwierzy, że
bezpiecznik demo działa wszędzie. **Wobec `DEC-65` („dane demo = twarz
produktu") to jest ustalenie dla nadzorcy** — wpisujesz je do „Pozycji
otwartych" jako osobny punkt, **nie zmieniasz zachowania** (Gateway poza
zasięgiem).

**DoD `G.3`:** cztery poprawione nagłówki; `git diff` pokazuje **wyłącznie**
linie komentarza; osobny wpis o `demoWriteGuard` w „Pozycjach otwartych";
commit.

### G.4 — Uczciwe „nie wiem" zamiast identyfikatorów technicznych i zamiast próbek

**1. Dane przykładowe — rozstrzygnięcie (przeczytaj erratę §1.8 pkt 1).**

Zasada, która obowiązuje w tym programie: **dane przykładowe nie mogą UDAWAĆ
danych klienta. Dopuszczalny jest jawnie oznaczony tryb przykładowy.**
Mechanizm frontowy (`financeOwnerSampleData`) spełnia już warunek drugi —
jest oznaczony bannerem, odmawia na hoście produkcyjnym, ma zamrożony licznik
(dzień 4, `F.4`, commit `207124e9e9`). **Jest poza Twoim zasięgiem (Z17).**

**Twoja część jest tylna i wąska:**
- udowodnij testem na realnym PG, że **pusta organizacja dostaje pustą listę**
  z `GET /api/v8/finance-v2/artifacts` — `[]`, nie próbkę, nie wiersz-widmo;
- przeszukaj **kanoniczne** ścieżki serwera pod kątem podstawiania danych
  (`sample|demo|mock|placeholder|fixture|fake|dummy|seed`) i **wpisz wynik do
  raportu, także jeśli jest pusty**;
- jeżeli **znajdziesz** serwerową furtkę podstawiającą dane — **usuwasz ją**;
  to jest atrapa (Z22, `DEC-51`), niezależnie od intencji;
- jeżeli **nie znajdziesz** — piszesz to wprost, z komendą i wynikiem. To też
  jest produkt: dowód, że tył jest czysty, przenosi dyskusję o próbkach
  jednoznacznie na front.

**2. Etykiety kanoniczne linii sprawozdania.**
Nocny sweep A ustalił, że produkcyjny `resolveLineLabel` to dosłownie
`lineCode ?? canonicalLineId ?? rowKey` i że **nie istnieje żaden słownik**
`canonicalLineId` → nazwa. Sprawdź w schemacie, czy taksonomia istnieje
(kandydaci: migracja `20261058_finance_statement_canonical_mapping_taxonomy.sql`,
tabele `finance_stmt_*`, katalog `finance_analysis_kpi_catalog`).

- **Jeśli istnieje** — wystaw etykietę w DTO odczytu linii
  (`statements.routes.ts:168`), addytywnie, obok istniejących pól.
- **Jeśli nie istnieje** — **wpis `BRAK_DANYCH` + kontrakt dla frontu.**
  **★ Zakaz zmyślania taksonomii księgowej.** Wymyślony słownik polskich nazw
  pozycji sprawozdania finansowego jest **gorszy** niż surowy kod: surowy kod
  użytkownik rozpozna jako techniczny, zmyśloną nazwę weźmie za prawdę.

**3. Tożsamość aktora w łańcuchu pochodzenia.**
`authorId` nie jest rozwiązywany do nazwiska. Sprawdź, czy serwer ma
tenant-scoped drogę rozwiązania aktora do nazwy wyświetlanej **bez** dotykania
modelu uprawnień (Z16). Jeśli tak — dołóż pole addytywnie w DTO lineage.
Jeśli nie — `UNKNOWN` z powodem, plus kontrakt. **Nie zmyślaj imion.**

**DoD `G.4`:** dowód pustej listy dla pustej organizacji (realny PG, niezależne
połączenie); wynik przeszukania serwera (także pusty) z komendą; dla punktów 2
i 3 — albo pole w DTO z testem, albo wpis `BRAK_DANYCH` z kontraktem; commit.

---

## §H. LUKA SCHEMATU OD ZERA DLA MODUŁU 10 (`DEC-116`) — pozycja weryfikacyjna

**Przeczytaj erratę §1.8 pkt 4 i 5.** Oczekiwany wynik tej pozycji to **jedno
zdanie: „moduł 10 Finance nie ma otwartej luki schematu"** — z dowodem.
Instrukcja podaje Ci ten wynik, **ale masz go potwierdzić sam**, bo audyt jest
z 2026-08-23, a Ty pracujesz na innym tipie.

Kroki:

1. Odczytaj klasyfikację **z obu jej miejsc**:
   `OWNER_DECISION_LEDGER_2026-08-24.md:168` oraz nagłówek
   `server/migrations/20261120_fresh_db_schema_gap_closure.sql:1-60`.
   **Odnotuj rozbieżność liczb** (150 vs 96) — nie rozstrzygasz jej.
2. Potwierdź, że `20261120` **nie tworzy** żadnej tabeli `finance_*` /
   `financial_*` i że jego blok `ADD COLUMN` nie dotyka tabel Finance.
3. Na swoim jednorazowym kontenerze, **po pełnym łańcuchu migracji**, sprawdź
   `to_regclass` dla kompletu tabel kanonicznych Finance używanych przez
   `services/finance/canonical/**`. Wszystkie mają istnieć.
   **Jeżeli któraś nie istnieje — to jest znalezisko klasy `DEC-116` dla modułu
   10 i wtedy (i tylko wtedy) tworzysz migrację w przedziale
   `20261140`–`20261149`.**
4. Przeczytaj listę relacji krytycznych w
   `server/scripts/release-migration-gate.ts:175-200` i sprawdź, czy któraś
   należy do Finance. **Nie zmieniasz tego pliku.**
5. **Zakaz absolutny:** nie poszerzasz wzorca autorun ani
   `isSqliteOnlyMigration()` „jako naprawy" — komunikat bramki zakazuje tego
   wprost, a `DEC-116` podnosi to do rangi ustalenia programowego.

**DoD `H`:** tabela `to_regclass` dla tabel kanonicznych Finance (nazwa →
`t`/`f`) z jednorazowego kontenera po pełnych migracjach; jawne zdanie
o wyniku; przy braku luki — **żadnej migracji**; commit `docs(finance): ...`.

---

## §T. TESTY — pozycja własna, nie dodatek

### T.1 — Pokrycie nowych i zmienionych powierzchni

Każda zmieniona lub dodana trasa ma **komplet czterech** testów behawioralnych
(happy · błąd · pusty · negatyw tenanta) **plus** test HTTP na realnym PG.
Konwencja plików: `*.pg.test.ts` obok kodu, w
`server/src/routes/v8/finance-v2/__tests__/` albo
`server/src/services/finance/canonical/__tests__/`.

Uruchamianie — **zawsze cztery zmienne env w tej samej linii** (Z19):

```bash
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5483/cx_day23" \
npx vitest run --config server/vitest.config.ts <plik> --no-file-parallelism
```

### T.2 — Negatywy tenanta jako osobny, jawny pakiet — z dowodem mutacyjnym

Kontrakt `FIN-REC-010`: „Niedozwolona organizacja nie może odczytać obiektu po
bezpośrednim ID". Kontrakt `FIN-REC-014`: „Test negatywny uprawnień/tenantu".

Wymagania:

1. Negatyw **podwójny** dla każdej trasy: obca organizacja w `body`
   **oraz** w nagłówku `x-org-context` bez aktywnego członkostwa (DoD pkt 8).
2. **★ DOWÓD MUTACYJNY**: dla minimum trzech tras usuwasz **tymczasowo,
   lokalnie, bez commitowania** filtr organizacji w zapytaniu i pokazujesz,
   że test **czerwienieje**. Test, który przechodzi po neutralizacji filtru,
   nie dowodzi izolacji (dokładnie ta pułapka złapana przy odbiorze dnia 18).
   Wynik obu przebiegów idzie do raportu.
3. Odpowiedź na obcy tenant = `404`, **nigdy** `403` z danymi obiektu i nigdy
   `200` (fail-closed, zgodnie z komentarzem `artifacts.routes.ts:423-425`).

### T.3 — Zakaz osłabiania testów zastanych

Nie zmieniasz asercji w testach istniejących wcześniej. Jeżeli Twoja zmiana
kontraktu wymusza zmianę cudzego testu — **wpisujesz przed/po do raportu**
(pełny tekst asercji) i traktujesz to jako pozycję do zatwierdzenia przez
nadzorcę, nie jako szczegół. **Zamrożone fixtures `WP-A02`/`WP-B02` są
nietykalne** — kolizja z nimi to STOP.

### T.4 — Zakaz fałszywego zielonego

`describe.skipIf(!REAL_PG)` zamienia niekompletny env w `skipped`, nie `failed`.
**Każdy przebieg w raporcie ma trzy liczby: PASS / FAIL / SKIPPED.** Pakiet
z zerem uruchomionych testów jest `NIE_ZMIERZONY`.

---

## §R. REJESTR I DOWODY

### R.1 — `MODULE_ACCEPTANCE.md` 10_FINANCE do stanu faktycznego

Uzupełniasz **wyłącznie** o to, co faktycznie dowiozłeś, i **wyłącznie**
w istniejącej strukturze pliku (tabela `G00–G20`, „Technical preflight
findings", „Exact-current source evidence").

**Twarde ograniczenia:**
- **maksymalny poziom, jaki wolno Ci zadeklarować, to `TECHNICAL_PASS`**
  (kontrakt §7). Nie `READY_FOR_OWNER_REVIEW`, nie `OWNER_ACCEPTED`;
- nie zmieniasz `Owner verdict` (jest `PENDING`);
- nie zmieniasz statusów bramek `G07`–`G20`;
- nie dopisujesz nowych wierszy do „Owner UI/UX/CX register" — to rejestr uwag
  właściciela, nie Twoich ustaleń. Twoje ustalenia idą do „Technical preflight
  findings" z nowymi ID `FIN-PF-0<n>` (najwyższy zastany + 1; sprawdź `grep`).

### R.2 — Komplet dowodów (kontrakt §8)

Kontrakt wymienia osiem elementów pakietu dowodowego. **Cztery z nich są
frontowe** (zrzuty rejestru/preview/karty, log console/network) — te oznaczasz
`POZA_ZAKRESEM_TYŁU`. Pozostałe cztery **dostarczasz**:

- branch/base/candidate SHA + lista zmienionych plików;
- manifest procesu, portów, bazy (**bez URL-a i hasła**);
- wyniki testów z licznikami `PASS/FAIL/SKIP`;
- dowód zapisu, ponownego odczytu i zimnego otwarcia (readback niezależnym
  połączeniem po restarcie procesu testowego);
- jawna lista pozostałych `NOT_TESTED`, `BLOCKED`, `EVIDENCE_MISSING`.

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~100 min, NIE pomijasz) — ★ KOLEJNOŚĆ WG Z19

1. `git fetch --all --prune`; weryfikacja markera **komendą `merge-base
   --is-ancestor` z §0.1 pkt 1** (SHA markera jest tam, w jednym miejscu — nie
   przepisujesz go z pamięci). Brak → STOP i koniec dyżuru. Rozejście marker→tip
   → wpis, start z markera (DEC-95), **bez rebase**.

2. **★ NAJPIERW KONTENER I MIGRACJE, DOPIERO POTEM JAKIKOLWIEK POMIAR** (Z19).
   Gałąź + worktree (§0.1 pkt 5), symlink `node_modules` (DEC-86, tylko odczyt),
   potem:

   ```bash
   docker run -d --name cx-day23-pg \
     --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
     -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day23 \
     -p 5483:5432 pgvector/pgvector:pg16
   export DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5483/cx_day23"
   # DOWÓD CELU POŁĄCZENIA — do raportu, dosłownie:
   docker exec cx-day23-pg psql -U postgres -d cx_day23 -c "SELECT current_database(), inet_server_port();"
   NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict      # przebieg 1 — pełne migracje projektu
   NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict      # przebieg 2 → Applying migrations: 0
   NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry # dry → Pending migrations: 0
   ```

   Dopiero teraz wolno uruchomić cokolwiek, co dotyka bazy — zawsze z jawnym
   kompletem `DATABASE_URL` + `DB_TYPE=postgres` + `NODE_ENV=test` +
   `RUN_DB_TESTS=1` + `MOCK_DB=false` **w tej samej linii**.

3. **Weryfikacja stanu wejściowego** (§0.1 pkt 3) i materiałów wiążących
   (§0.1 pkt 4). Brak (a) = STOP.

4. **Numer migracji — WEWNĄTRZ PRZEDZIAŁU `20261140`–`20261149`** (§0.3 pkt 2):

   ```bash
   ls server/migrations | grep -E '^202611[0-9]{2}' | sort | tail -3
   ls server/migrations | grep '^20261140'        # MUSI być puste
   ```

   **Pamiętaj o §0.3 pkt 5: najprawdopodobniej NIE potrzebujesz migracji.**

5. **Weryfikacja mapy z §1.5 i erraty z §1.8** — każdą rozbieżność do „Korekt".
   Obowiązkowo:

   ```bash
   grep -n "mountedFinanceStatementRouter\|v8FeatureGate, v8Router" server/src/Gateway.ts
   grep -n "finance-v2\|'/finance'" server/src/routes/v8/index.ts
   grep -n "ENABLE_V8_GLOBAL" server/src/middleware/v8FeatureGate.middleware.ts
   grep -n "requireActiveMembership\|requireCanonicalFinanceMutation" server/src/routes/v8/finance-v2/index.ts
   grep -n "mapOrgRoleToFinanceRole" -A 8 server/src/routes/v8/finance-v2/_shared.ts
   grep -rn "readExpectedVersion\|readIdempotencyKey" server/src/routes/v8/finance-v2/
   grep -rn "audit" server/src/routes/v8/finance-v2/ | grep -v __tests__      # oczekiwane: PUSTO
   grep -rn "auditEventsService" server/src/services/finance server/src/routes/v8/finance-v2   # oczekiwane: PUSTO
   grep -n "expectedVersion ?? current.version" server/src/routes/v8/finance-v2/models.routes.ts
   grep -n "test(message)\|regex" server/src/routes/v8/finance-v2/valuation.routes.ts | head
   grep -rn "roiFinanceLinkAdapter" server/src | grep -v __tests__            # oczekiwane: TYLKO własny plik
   grep -n "sourceVersion" server/src/services/finance/financeStatementPackCandidateHandoff.ts
   grep -n "STALE_SOURCE" server/src/services/finance/canonical/lineageFreshnessService.ts
   grep -n "status: 'queued'" server/src/routes/v8/finance.routes.ts
   grep -n "status: 'generated'" server/src/routes/economics.routes.ts
   grep -rn "finance_\|financial_" server/migrations/20261120_fresh_db_schema_gap_closure.sql | head   # oczekiwane: PUSTO (errata §1.8 pkt 4)
   ```

6. **★ BASELINE TESTÓW — PRZED PIERWSZYM COMMITEM** (§0.4a pkt 6), z jawnym
   kompletem env tam, gdzie dotyczy. Wyniki (`PASS/FAIL/SKIPPED` **per plik**)
   do raportu. **Czerwone testy zastane opisujesz, nie „naprawiasz"** — znany
   kandydat: `tests/unit/finance/financeFallbackGating.test.ts`. Bez tego
   baseline'u nie masz jak spełnić Z23.

7. Założenie raportu (§9) i wpisanie wyników 1–6 **plus pozycji `A`**
   (§A powstaje w Bloku 0 — to jego produkt).

### Blok 1 — osiągalność (B.1 → B.2 → B.3)

**Zaczynasz od tego, zawsze.** Pozycja `B` rozstrzyga, czy reszta dyżuru ma
sens: jeżeli cztery z pięciu kart są niedostępne na domyślnym okablowaniu, to
jest **najważniejsza informacja całego dyżuru** i nadzorca musi ją dostać
niezależnie od tego, ile zdążysz zbudować dalej.

### Blok 2 — kontrakt (C.1 → C.2)

Zamyka `STOP F.6` dnia 4 i odblokowuje robotnika frontowego. `C.2` jest
fundamentem dla `D` i `E` (kody `409`/`422` biorą się z taksonomii), więc idzie
przed nimi.

### Blok 3 — ochrona zapisu (D.1 → D.2 → E)

**Jeżeli czasu mało — rób `D.1` przed `D.2`, a `E` przed `F`.** Ciche
nadpisanie danych finansowych jest gorsze niż brak śladu, a brak śladu jest
gorszy niż brak wykrycia dryfu.

### Blok 4 — szew i uczciwość (F.1 → G.1 → G.3 → G.4 → G.2 → F.2)

`G.1` i `G.3` są tanie i natychmiast wartościowe. `G.2` to głównie inwentarz.
**`F.2` jest ostatnia i wolno jej nie robić.**

### Blok 5 — schemat (H)

Tanie, jeśli kontener już stoi. Prawdopodobny wynik: „brak zadań".

### Blok 6 — domknięcie (obowiązkowo, ~90 min)

1. `§T` (testy, negatywy tenanta z dowodem mutacyjnym), `R.1`, `R.2` dla tego,
   co faktycznie zbudowałeś.
2. **Pomiar zasięgu (§0.4a) z rozbiciem zastane/wprowadzone i liczbą SKIPPED (Z23).**
3. **Dziesięć dowodów** (do raportu):
   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "tests/setup|tests/helpers|tests/__mocks__|vitest.*config"   # PUSTY (Z18)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^src/"                                                     # PUSTY (front poza zakresem)
   git diff codex/m03-admin-20260824...HEAD -- server/src/services/effectiveAccessService.ts server/src/middleware            # PUSTY (Z16 — KRYTYCZNE)
   git diff codex/m03-admin-20260824...HEAD -- server/src/Gateway.ts server/src/routes/v8/index.ts                            # PUSTY (montaż = decyzja nadzorcy)
   git diff codex/m03-admin-20260824...HEAD -- server/src/routes/billing server/src/routes/billing.routes.ts server/src/services/tokenBillingService.ts   # PUSTY (inny moduł)
   git diff codex/m03-admin-20260824...HEAD -- server/src/routes/v8/finance.routes.ts | grep -c "^[-+]"                        # tylko handler :1713-1735 (G.1)
   git diff codex/m03-admin-20260824...HEAD -- server/src/routes/economics.routes.ts | grep -c "^[-+]"                         # tylko handler :2375-2401 (G.1)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^server/migrations/"                                        # PUSTY albo tylko 2026114x_finance_day23_*
   git diff codex/m03-admin-20260824...HEAD | grep -E "^\+.*(defaultValue|useFeatureFlags|process.env.ENABLE_)"                # PUSTY (zero flag, Z10)
   git diff codex/m03-admin-20260824...HEAD | grep -E "^\+.*(llmService|generateResponse|getLLMServiceInstance)"               # PUSTY (Z14)
   docker ps -a --filter name=cx-day23-pg ; docker volume ls | grep -i cx-day23                                                # PUSTO (sprzątnięte)
   ```
4. **Dowody osiągalności (Z20)** dla każdej pozycji — zebrane w jednej sekcji.
5. **Sprzątanie kontenera I wolumenów** (obowiązkowe):
   ```bash
   docker rm -f cx-day23-pg && docker volume ls -q | grep -i cx-day23 | xargs -r docker volume rm && docker volume prune -f
   ```

### Zasada nadrzędna kolejności

Lepiej **domknięte** `A` + `B` + `C` + testy niż osiem pozycji „prawie". Każda
pozycja albo spełnia DoD, albo jest uczciwie oznaczona (`STOP` / `BRAK_API` /
`CZĘŚCIOWO` / `NIE_ZACZĘTE` / `ZABLOKOWANE_BRAMKĄ`).

**Jeżeli po Bloku 0 i 1 nie masz już czasu — to nadal jest DOBRY dyżur.**
Rozliczenie kontraktu wobec kodu i odpowiedź na pytanie „czy pięć kart jest
w ogóle osiągalnych na domyślnym okablowaniu" są warte więcej niż osiem pozycji
bez dowodów.

---

## 9. RAPORT — jedyny dokument, który tworzysz

Ścieżka, dokładnie jedna:

```
docs/program/waves/WAVE_03_ACCEPTANCE/FINANCE_DAY23_REPORT_20260826.md
```

Nie tworzysz drugiego pliku nigdzie indziej (Z12).

### 9.1. Szablon

```markdown
# Finance dzień 23 — raport dyżuru <data>

Baza: codex/m03-admin-20260824 @ <SHA tipa>
Marker: «MARKER_SHA» — POTWIERDZONY / BRAK
Gałąź: codex/finance-day23-<data>
Worktree: /private/tmp/consultify-finance-day23
Port PG: 5483 · kontener cx-day23-pg usunięty: TAK/NIE · wolumeny usunięte: TAK/NIE
Poziom ukończenia wg kontraktu §7 (najwyżej TECHNICAL_PASS): <...>

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

<czy dotykałeś /Users/piotrwisniewski/Developer/Consultify; symlink node_modules — tylko odczyt>
<czy dotykałeś jakiejkolwiek bazy consultify_w3_finance_owner_* — Z9>

## ★ Dowód celu połączenia (Z19 / DEC-96)

<dosłowny wynik: SELECT current_database(), inet_server_port();>
<lista przebiegów testów DB z pełnym kompletem env w tej samej linii>

## Warunki wstępne — tabela

<marker · kanoniczna powierzchnia (a) obecna · rdzeń (b) obecny · ochrona danych (c)
nienaruszona · kontrakt odzyskania 284 linie · rejestr decyzji · numer migracji wolny
w przedziale 20261140-20261149 (ls|grep) · migracje 1/2/dry · BASELINE testów przed>

## §A — INWENTARZ KONTRAKTU (produkt Bloku 0)

### A.1 — FIN-REC-001…015
| FIN-REC | Tylna połowa | Stan | Dowód plik:linia | Pozycja dyżuru |

### A.2 — Mapa osiągalności pięciu kart
| Karta | Wejście (metoda+URL) | Bramki | Montaż | Router | Serwis | Tabela | Werdykt |

### A.3 — Inwentarz powierzchni zapisu
| Metoda + ścieżka | plik:linia | CAS? | Klucz idempotencji? | Audyt? | Negatyw tenanta? |

## Pozycje — tabela zbiorcza

| Pozycja | Status (ZROBIONE_WG_DoD / CZĘŚCIOWO / STOP / BRAK_API / NIE_ZACZĘTE / ZABLOKOWANE_BRAMKĄ) | Commit | Dowód | Poziom §7 |
| A inwentarz | | | | |
| B.1 mapa osiągalności | | | | |
| B.2 test domyślnego okablowania | | | | |
| B.3 drugi tor zapisu | | | | |
| C.1 kontrakt zdolności | | | | |
| C.2 taksonomia błędów | | | | |
| D.1 CAS | | | | |
| D.2 idempotencja | | | | |
| E audyt mutacji | | | | |
| F.1 dryf źródła w handoffie | | | | |
| F.2 połowa LINK ROI (opcjonalna) | | | | |
| G.1 fałszywy sukces | | | | |
| G.2 martwe zamontowane | | | | |
| G.3 nagłówki-kłamstwa | | | | |
| G.4 uczciwe „nie wiem" + próbki | | | | |
| H schemat modułu 10 | | | | |
| T testy | | | | |
| R.1 rejestr | | | | |

## ★ DOWODY OSIĄGALNOŚCI (Z20 / DEC-104) — obowiązkowe dla KAŻDEJ pozycji

| Pozycja | Wejście (metoda + URL) | Bramki (plik:linia) | Montaż (plik:linia) | Router (plik:linia) | Serwis (plik:linia) | Zapis (tabela.kolumna) |

## ★ TESTY DOMYŚLNEGO OKABLOWANIA (Z21 / DEC-107)

| Pozycja | Co wołane bez wstrzykiwania | Plik testu | Wynik |

## Tabele werdyktów

### B — osiągalność | Karta | Osiągalna? | Bramka blokująca | Kod | Obejście |

### B.3 — dwutorowość | Komenda kanoniczna | Wejście finance-v2 | Wejście v8/finance | Strażnicy równoważni? |

### C.1 — zdolności | Typ | Status | Rola | allowedActions | Wynik |

### C.2 — taksonomia | Klasa | HTTP | Producent (plik:linia) | Test rozróżnialności |

### D.1 — CAS | Trasa | PRZED (CAS?) | PO | Test wyścigu: 1. odpowiedź / 2. odpowiedź / wierszy w bazie |

### D.2 — idempotencja | Trasa | Ten sam klucz → obiektów | Różne klucze → obiektów | Nośnik klucza |

### E — audyt | Trasa | Zdarzenie? | W tej samej transakcji? | Test awarii → 0 zdarzeń? |

### F.1 — dryf | Przypadek | Odcisk zapisany | Odcisk żywy | Stan zwrócony | Handoff niezmieniony? |

### G — sprzątanie | Co ustalono/zmieniono | Dowód martwości (grep) | Test potwierdzający |

### H — schemat | Tabela kanoniczna | to_regclass | Werdykt |

## ★ KONTRAKT DLA FRONTU (produkt §1.6)

| Trasa | Metoda | Body | Odpowiedź | Kody błędów |
<wszystkie nowe i zmienione trasy + pełna tabela allowedActions (C.1)
+ pełna tabela klas błędu (C.2) + pozycje „front do dostosowania" z G.1>

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy

<w tym OBOWIĄZKOWO osobny punkt o financeValueDemoAllowlist / demoWriteGuard (§G.3)>

## Znaleziska (NIE naprawiane przeze mnie)

## Korekty wobec instrukcji

<w tym każda rozbieżność wobec mapy §1.5 i erraty §1.8 — formatem z §1.8;
wpisane tu ustalenia są wiążące dla odbioru>

## Migracje

<numer albo „brak migracji"; dowód ls|grep w przedziale 20261140-20261149,
addytywność, brak FK, idempotencja (3 przebiegi), kompatybilność wstecz,
MIGRATION_PREPARED>

## Testy

### Baseline (przed pierwszym commitem) — PASS/FAIL/SKIPPED per plik

### Wynik końcowy — ★ PEŁNY ZAKRES §0.4a, BEZ ZAWĘŻANIA (Z23)

Zakres §0.4a: <X>/<Y> PASS, <S> SKIPPED
czerwone ZASTANE: <lista + liczby>
czerwone WPROWADZONE: <lista + SHA commitu, który je zapalił> ← jeśli PUSTE, napisz to wprost
SKIPPED z powodu env: <lista> ← jeśli niepuste, ZASIĘG CZĘŚCIOWY

### Zmiany w testach istniejących — przed/po (T.3)

### Dowody mutacyjne izolacji tenanta (T.2) — min. 3 trasy, oba przebiegi

### Dziesięć dowodów Bloku 6

## Licznik

<pozycji w zakresie / domknięte / częściowe / STOP / niezaczęte / zablokowane bramką>

## Czego NIE zrobiłem i dlaczego
```

### 9.2. Zasady raportowania

1. **Piszesz stan faktyczny, nie intencje.** „Zaimplementowałem" bez testu na
   realnym routerze = `CZĘŚCIOWO`. Bez dowodu osiągalności = `NIE_ZACZĘTE`.
2. **Każda pozycja ma commit SHA.** Brak commitu = `NIE_ZACZĘTE`.
3. **Liczby, nie przymiotniki.** „bezpieczniej" → `3 z 58 tras miały CAS →
   19 z 58`. „lepszy audyt" → `0 zdarzeń dla płaszczyzny danych → 11 tras
   audytowanych`.
4. **Statusy tylko z listy**: `ZROBIONE_WG_DoD` · `CZĘŚCIOWO` · `STOP` ·
   `BRAK_API` · `NIE_ZACZĘTE` · `ZABLOKOWANE_BRAMKĄ`.
5. **Poziom ukończenia tylko wg kontraktu §7**, najwyżej `TECHNICAL_PASS`.
   Nie scalasz poziomów (kontrakt §7 zabrania tego wprost).
6. **Nie zawyżasz.** Dzień 16 zawyżył `I.1`, dzień 19 zawyżył liczbę testów —
   oba odbiory to wyłapały. **Zawyżenie kosztuje więcej niż uczciwe `CZĘŚCIOWO`.**
7. **Nie piszesz „gotowe do pokazania właścicielowi"** — piszesz „gotowe do
   odbioru przez nadzorcę".

---

## 10. ŚCIĄGA

### 10.1. Komendy

```bash
# formatowanie — PRZED KAŻDYM COMMITEM
npx prettier --write <pliki tego commita>

# typy punktowo (NIGDY pełny tsc)
npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null

# test celowany BEZ bazy
npx vitest run tests/unit/finance/<plik>.test.ts

# test celowany Z bazą — ZAWSZE tak (Z19), CZTERY zmienne env W TEJ SAMEJ LINII
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5483/cx_day23" \
npx vitest run --config server/vitest.config.ts \
  server/src/routes/v8/finance-v2/__tests__/<plik>.pg.test.ts --no-file-parallelism

# numeracja migracji — PRZED KAŻDYM NOWYM PLIKIEM, TYLKO W PRZEDZIALE 20261140-20261149
ls server/migrations | grep -E '^202611[0-9]{2}' | sort | tail -3
ls server/migrations | grep '^20261140'        # MUSI być puste

# migracje — jednorazowy kontener, dowód (1)(2)(3), sprzątanie kontenera I wolumenów
docker run -d --name cx-day23-pg --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day23 -p 5483:5432 pgvector/pgvector:pg16
docker exec cx-day23-pg psql -U postgres -d cx_day23 -c "SELECT current_database(), inet_server_port();"
export DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5483/cx_day23"
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry
docker rm -f cx-day23-pg && docker volume ls -q | grep -i cx-day23 | xargs -r docker volume rm && docker volume prune -f

# porównanie do bazy (NIE do HEAD~1)
git diff --name-only codex/m03-admin-20260824...HEAD
```

### 10.2. Dwanaście rzeczy, które najłatwiej zepsuć

1. **Uruchomienie testu DB bez kompletu czterech zmiennych env w tej samej
   linii** → `describe.skipIf` zamienia to w `skipped`, raport pokazuje
   „0 failed", a nic nie zostało zmierzone (Z19; dzień 17 poległ na wariancie
   tego samego błędu).
2. **Deklaracja „PASS" przy pakiecie w całości SKIPPED** → Z23, zawyżenie.
3. **Otwarcie `ENABLE_V8_GLOBAL` albo `MODULE_ECONOMICS`, żeby pozycja stała się
   osiągalna** → Z10 + `DEC-05`; to jest decyzja właściciela, nie Twoja.
4. **Zdarzenie audytu poza transakcją mutacji** → Z22, wzorcowa atrapa
   z zewnętrznym skutkiem.
5. **Dodanie pola `expectedVersion`, którego nikt nie weryfikuje** → atrapa
   gorsza od braku, bo front zacznie jej ufać.
6. **Powielenie mechanizmu staleness** — kanoniczne lineage już go ma
   (`lineageFreshnessService.ts:224-300`); luka jest w handoffie do Kandydata.
7. **Zmyślenie taksonomii linii sprawozdania albo imienia autora** → gorsze niż
   surowy identyfikator (§G.4, `Z15`).
8. **Wejście w `server/src/routes/billing/**` albo `tokenBillingService.ts`**
   → inny moduł (errata §1.8 pkt 4).
9. **Zmiana `Gateway.ts` albo `routes/v8/index.ts`**, żeby odmontować martwą
   powierzchnię → montaż to decyzja nadzorcy; Twój produkt to inwentarz (§G.2).
10. **Złamanie zamrożonego fixture** `WP-A02 F4` (`models.routes.ts:173`)
    w imię „ujednolicenia taksonomii" → STOP, nie zmiana fixture.
11. **Test negatywny tenanta tylko na `body.organizationId`** → `x-org-context`
    to realna droga wejścia organizacji (DoD pkt 8).
12. **Wejście we `src/`** → Z17 + złamanie podziału FRONT/TYŁ i reguły 7
    („właściciel nigdy nie jest pierwszym testerem wizualnym").

### 10.3. Czego NIE robisz, choć „aż się prosi"

- nie dotykasz `src/` — **ani jednej linii**, nawet żeby podłączyć własny
  endpoint albo zdjąć sześć zaszytych `preparer` z `FinanceHub.tsx`;
- nie tworzysz flagi i nie zmieniasz domyślnej wartości istniejącej;
- nie otwierasz modułu ani bramki V8;
- nie budujesz `AP-09` (przypisania roli Finance per użytkownik);
- nie podpinasz dostawcy LLM (`G.1` to uczciwość odpowiedzi, nie AI);
- nie przepinasz i nie ujednolicasz `v8/finance.routes.ts` (85 endpointów) —
  ustalasz i stawiasz STOP;
- nie tworzysz trzeciego rejestru audytu — wybierasz jeden z dwóch istniejących;
- nie nadpisujesz historycznych wartości ufności ani zapisanych `actual_*`;
- nie usuwasz martwego **frontu** (osobny tor);
- nie rozszerzasz leniwych bootstrapów `CREATE TABLE IF NOT EXISTS` w runtime —
  nowe DDL idzie **wyłącznie** migracją w przydzielonym przedziale;
- nie poszerzasz wzorca autorun migracji „jako naprawy" (`DEC-116`);
- nie robisz `rebase` na nowszy tip m03 (DEC-95 — robi to nadzorca);
- nie wskrzeszasz `codex/preserve-finance-owner-wip-20260823` (Z4, `DEC-05`).

---

## 11. NA KONIEC

Ten moduł ma **najbardziej rozbudowaną dokumentację odbiorową w całym
korpusie** — 151-linijkowy `MODULE_ACCEPTANCE` z czternastoma znaleziskami
`FIN-PF-001…014`, pięcioma zachowanymi bazami dowodowymi i łańcuchem
sprawozdawczym udowodnionym na realnym PostgreSQL. I ma **całą płaszczyznę
danych bez jednego zdarzenia audytu**, **cały blok wyceny bez ochrony
konfliktu** i **dwa endpointy, które kłamią, że coś zrobiły**.

To nie jest sprzeczność — to diagnoza. Ten moduł był dowodzony **głęboko**
(łańcuch sprawozdanie → analiza → model → prognoza → wycena, wersje, hashe,
lineage) i **wąsko** (na jednej ścieżce, na jednym runtime, z jednym
fixture'em). Twój dyżur nie dobudowuje szóstej karty. **Twój dyżur sprawdza,
czy to, co dowiedziono na jednej ścieżce, obowiązuje na wszystkich.**

Trzy rzeczy decydują o odbiorze:

1. **Odpowiedź na pytanie o osiągalność — z liczbą.** Nie „powierzchnia
   kanoniczna działa", tylko _„5 z 5 kart osiągalnych na domyślnym okablowaniu"_
   albo _„1 z 5; pozostałe cztery zatrzymuje `v8FeatureGate` przy
   `ENABLE_V8_GLOBAL` niezdefiniowanym — `middleware/v8FeatureGate.middleware.ts:15`"_.
   Ta druga odpowiedź jest **równie wartościowa** i **nie wolno jej naprawić
   flagą**.
2. **Rozliczenie kontraktu, nie parafraza kontraktu.** Piętnaście wierszy
   `FIN-REC`, każdy ze stanem i `plik:linia`. Kontrakt istnieje od 2026-08-23
   i nikt jeszcze nie powiedział, ile z jego **tylnej** połowy stoi.
3. **Uczciwość ponad zasięg.** Osiem pozycji „prawie" jest gorsze niż trzy
   domknięte i pięć uczciwie oznaczonych. Dwa ostatnie odbiory wstrzymały merge
   za **zawyżenie**, nie za brak zakresu. A ten moduł ma własną skalę uczciwości
   (kontrakt §7) — **`TECHNICAL_PASS` jest sufitem, nie punktem wyjścia do
   negocjacji.**

**Zero zmian w `src/`. Zero otwierania bramek. Zero flag. Zero atrap —
zwłaszcza tych, które zwracają 200, i tych, które zapisują ślad zmiany, której
nie było.**
