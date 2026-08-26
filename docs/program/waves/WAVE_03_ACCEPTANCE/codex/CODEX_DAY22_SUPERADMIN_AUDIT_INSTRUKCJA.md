# INSTRUKCJA DYŻURU nr 22 — Codex — „Superadmin fala 3: uniwersalność audytu i egzekwowanie — domknięcie TRI-MUST-08 — WYŁĄCZNIE MECHANIKA TYLNA"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–21. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-26.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Ten dyżur domyka **jedną, dokładnie nazwaną pozycję MUST z rejestru werdyktu
trójkąta**: `TRI-MUST-08` — _„audyt mutacji admina nie jest uniwersalny"_.

Dzień 15 (`DEC-2026-08-26-85`) zrobił połowę roboty i **uczciwie to zaraportował**.
Odbiór bezpieczeństwa zapisał w rejestrze zdanie, które jest sednem Twojego dyżuru:

> **`TRI-MUST-08/12` NIE raportować jako w pełni domknięte — audyt TAK,
> uniwersalność projekcji (3/5 tabel, 20/83 pisarzy) i egzekwowanie
> zawieszenia NIE.**

Zawieszenie organizacji zostało domknięte **osobno i bez Ciebie**
(`DEC-2026-08-26-105`, osiem frontów, trzy niezależne audyty adwersaryjne).
**Ty domykasz drugą połowę: uniwersalność.**

Materiały wiążące, które czytasz **przed** startem (są w repo, na Twojej bazie):

```
docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
docs/program/waves/WAVE_03_ACCEPTANCE/TRIANGLE_COMPLETENESS_VERDICT_2026-08-24.md
docs/program/waves/WAVE_03_ACCEPTANCE/SUPERADMIN_DAY15_REPORT_20260826.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY15_SUPERADMIN_INSTRUKCJA.md
docs/program/waves/WAVE_03_ACCEPTANCE/modules/14_ADMIN/MODULE_ACCEPTANCE.md
```

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

1. **★ CAŁE `src/` JEST POZA ZAKRESEM. Bez wyjątku.** Ekrany audytu, filtry,
   kolumny, polonizacja, `EnterpriseAuditLog.tsx`, `AdminCommandCenterPanel.tsx`
   — **robią robotnicy wewnętrzni**, po prototypie i akcepcie właściciela na
   czystym zrzucie (CLAUDE.md reguła 7: właściciel **nigdy** nie jest pierwszym
   testerem wizualnym). Ty budujesz **TYŁ**: pisarzy audytu, projekcję, trasy,
   kontrakty odpowiedzi, testy. Jeżeli front wymaga zmiany — **wypisujesz
   kontrakt dla robotnika frontowego w raporcie**, nie dotykasz `src/`.
2. **★★ STRAŻNIK ZAWIESZENIA ORGANIZACJI JEST NIETYKALNY (`DEC-2026-08-26-105`).**
   `server/src/services/organizationSuspensionGuard.ts` i wszystkie osiem
   frontów wejściowych, które go wołają, przeszły **trzy niezależne audyty
   adwersaryjne**, z których każdy obalał kompletność poprzedniego. Wolno
   **czytać**. **Jakakolwiek zmiana = STOP i odrzucenie dyżuru.** Dotyczy to
   także `server/src/routes/admin-bulk.routes.ts:22`
   (`import { invalidatePlatformSuperAdminCache }`) — plik jest w Twoim zakresie,
   **ta linia i jej użycie nie są**.
3. **★ `effectiveAccessService` jest NIETYKALNY (Z16).** Model uprawnień jest
   naprawiany wewnętrznie. Dotknięcie = odrzucenie dyżuru.
4. **Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej
   flagi.** Jeżeli uznasz, że potrzebujesz flagi — to jest **STOP**, nie
   improwizacja (CLAUDE.md reguła 9).
5. **★ ZAKAZ ATRAPY Z ZEWNĘTRZNYM SKUTKIEM (Z22 / `DEC-2026-08-26-108`).**
   W tym dyżurze ma to szczególną postać: **wpis audytowy JEST skutkiem
   zewnętrznym.** Audyt mówiący „usunięto konto serwisowe", podczas gdy konto
   nadal istnieje, jest **gorszy niż brak audytu** — kłamie w dokumencie
   dowodowym. Kolejność jest zawsze: **najpierw skuteczna mutacja, potem wpis**.
6. **★ Uczciwy brak > udawana kompletność.** Nie fabrykujesz `risk_score`,
   nie dopisujesz wierszy audytu „żeby liczba wyszła", nie deklarujesz
   `83/83`, jeżeli gwarancja jest fail-open. Dzień 15 tego nie zrobił i
   **za to dostał `SUPERVISOR_ACCEPT`** — kopiujesz jego uczciwość, nie tylko
   jego kod.
7. **Odbiór wizualny i decyzja o pokazaniu właścicielowi = nadzorca, po dyżurze.**
   W raporcie piszesz „gotowe do odbioru przez nadzorcę", **nigdy** „gotowe do
   pokazania właścicielowi".
8. **`DEC-65` — dane demo są chronione, wspólna baza jest święta.** Zero Railway,
   zero zdalnych migracji/seedów, zero zapisów do wspólnej bazy demo. Migracje =
   `MIGRATION_PREPARED`, addytywne, kompatybilne wstecz, z dowodem idempotencji
   na jednorazowym lokalnym kontenerze.

Naruszenie tego ograniczenia = odrzucenie dyżuru, niezależnie od jakości reszty.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **gałąź `codex/m03-admin-20260824`**. Nadzorca podaje Ci
   **SHA commitu-markera** przy wklejaniu tej instrukcji.

   **SHA markera: 609e9235e0**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor 609e9235e0 codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

2. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/admin55-*`, `codex/initiatives-*` ani `codex/preserve-*`.
   Załóż raport, wpisz pozycję STOP z wynikiem obu komend i zakończ dyżur.

   **Reguła rozejścia (`DEC-2026-08-26-95`).** Jeżeli marker **JEST** przodkiem,
   ale tip uciekł do przodu (nadzorca scalił coś po związaniu markera) — **to nie
   jest STOP**. Startujesz **dokładnie z markera**, wypisujesz w raporcie
   `git log --oneline <marker>..codex/m03-admin-20260824` i listę plików
   rozejścia; scalenie z nowszym tipem wykonuje nadzorca przy odbiorze.
   **Rebase w trakcie dyżuru: ZAKAZANY.**

3. **★ Weryfikacja stanu wejściowego (warunek wstępny, NIE formalność).** Ten
   dyżur zakłada, że **dzień 15 (`DEC-85`) i domknięcie zawieszenia (`DEC-105`)
   są w Twojej bazie**. Sprawdzasz sam; wynik jest obowiązkową pozycją raportu:

   ```bash
   # (a) DZIEŃ 15 SCALONY — trzecia noga projekcji istnieje
   grep -n "normalizeUnifiedAuditEvent" server/src/routes/adminP32.routes.ts
   grep -n "FROM audit_events" server/src/routes/adminP32.routes.ts
   ls server/migrations/20260826_day15_audit_events_org_ts_index.sql
   ls server/src/routes/__tests__/day15.adminP32.auditProjection.pg.test.ts

   # (b) DEC-105 SCALONY — strażnik zawieszenia istnieje (NIE DOTYKASZ GO)
   ls server/src/services/organizationSuspensionGuard.ts
   grep -rln "organizationSuspensionGuard" server/src | wc -l   # oczekiwane: kilkanaście plików

   # (c) rdzeń, który rozszerzasz — musi istnieć DOKŁADNIE tak
   grep -n "async function readTenantAdminAuditProjection" server/src/routes/adminP32.routes.ts
   grep -n "async function getAdminActor" server/src/routes/adminP32.routes.ts
   grep -n "app.use('/api/', auditLogMiddleware)" server/src/index.ts
   grep -n "export function requireAudit" server/src/middleware/requireAudit.middleware.ts
   grep -n "async logAction" server/src/services/adminAuditService.ts

   # (d) czego NIE WOLNO cofnąć — uczciwość dnia 15
   grep -n "risk_score: null" server/src/routes/adminP32.routes.ts   # noga audit_events NIE fabrykuje ryzyka
   ```

   **Brak (a) = STOP całego dyżuru** — pracujesz na bazie sprzed dnia 15
   i budowałbyś trzecią nogę projekcji drugi raz.
   **Brak (b) = STOP** — jesteś przed `DEC-105`; nie wolno Ci w tej sytuacji
   niczego dopisywać w obszarze zawieszenia.
   Brak (c) = STOP z opisem (ktoś już to ruszył — sprawdź, kto i czym).
   Brak (d) = STOP (ktoś zaczął fabrykować `risk_score`).

4. **Sprawdź, że materiały wiążące widzisz:**

   ```bash
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md        # oczekiwane 168
   grep -n "DEC-2026-08-26-85"  docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "DEC-2026-08-26-105" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "DEC-2026-08-26-116" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "DEC-2026-08-26-98"  docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   grep -n "TRI-MUST-08\|TRI-OBS-18" docs/program/waves/WAVE_03_ACCEPTANCE/TRIANGLE_COMPLETENESS_VERDICT_2026-08-24.md
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/SUPERADMIN_DAY15_REPORT_20260826.md        # oczekiwane 287
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/14_ADMIN/MODULE_ACCEPTANCE.md      # oczekiwane 84
   ```

   Brak któregokolwiek = **STOP**. Rozbieżność liczb (rejestr rośnie) = **nie
   STOP**, tylko wpis w „Korektach wobec instrukcji" — pod warunkiem, że treść
   wskazanych decyzji się zgadza.

5. Tworzysz **własną świeżą gałąź** z markera (podmień `<data>` na faktyczną,
   format `YYYYMMDD`):

   ```bash
   git branch codex/superadmin-day22-<data> 609e9235e0
   git worktree add /private/tmp/consultify-superadmin-day22 codex/superadmin-day22-<data>
   cd /private/tmp/consultify-superadmin-day22
   ```

6. **Wszystkie porównania w raporcie robisz wobec bazy**, nie wobec `HEAD~1`:

   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```

### 0.2. Bezwzględne ZAKAZY

| #       | Zakaz                                                                                                                                                                                                                                                                                                                                                                                          | Dlaczego                                                                                                     |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Z1      | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/superadmin-day22-<data>`                                                                                                                                                                                                                          | Push na `origin`/demo wykonuje wyłącznie nadzorca                                                            |
| Z2      | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824` ani gałęzi `codex/admin55-*`, `codex/initiatives-*`, `codex/meetings-day*`, `codex/staging-fixes-*`                                                                                                                                                                                                     | `demo` = święta baza; tamte gałęzie są historią odebraną                                                     |
| Z3      | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru                                                                                                                                                                                                                                                           | Krach 3/4 powstał tak; DEC-95                                                                                |
| **Z4**  | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`)                                                                                                                                                                                                                                                                                              | Wymagania są w rejestrze uwag i decyzjach                                                                    |
| **Z5**  | **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-86` — patrz Blok 0                                                                                                                                                         | Chroniony, brudny worktree właściciela                                                                       |
| Z6      | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` (m.in. `consultify-day22-instrukcja`, `consultify-initiatives-day21`, `consultify-day21-instrukcja`, `consultify-meetings-day19`, `consultify-staging-fixes`)                                                                                                                                                                  | Cudze worktree, część w użyciu                                                                               |
| Z7      | **Nie zajmujesz portów sesyjnych** (3777, 3987, 4046/4047, 4056/4057, 4060/4061, 4067, 4280/4281, 4290/4291, 4294/4295, 4300–4306, 4312, 4319, 4324/4325, 4336/4337, 4340, 4370, 4418, 4428, 4480/4481, 5000, 5037, 5432, 5447, 5449, 5467, 5471). **Twój kontener PG = 5481**; lokalny runtime, jeśli konieczny — **4346/4347**. Port zajęty → bierzesz pierwszy wolny i wpisujesz do raportu | 5471 zajmuje dzień 21, 5467 dzień 19, 5447/5449 dni 17/19                                                    |
| Z8      | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (DEC-65)                                                                                                                                                                                                                                                             | Produkcja/demo poza zakresem                                                                                 |
| **Z9**  | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo/staging/produkcja, nigdy cudza retained-DB. **KOREKTA `DEC-2026-08-26-98`: Z9 przerywa DANĄ CZYNNOŚĆ, nie cały dyżur** — patrz ramka pod tabelą                                                                                                                                                                 | „dane demo = twarz produktu" (DEC-65)                                                                        |
| **Z10** | **Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej flagi.** Także zero „tymczasowej flagi na czas testu"                                                                                                                                                                                                                                                                | CLAUDE.md reguła 9                                                                                           |
| Z11     | **Nie zmieniasz `src/components/ProtectedRoute.tsx`, `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts`** ani gramatyki tras `/admin/*` i `/superadmin/*`                                                                                                                                                                                                                                 | Gramatyka zaakceptowana (`DEC-2026-08-24-07`)                                                                |
| Z12     | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/SUPERADMIN_DAY22_REPORT_20260826.md`. Jedyny inny dokument, który wolno zmienić, to `modules/14_ADMIN/MODULE_ACCEPTANCE.md` — wyłącznie w ramach `R.1`                                                                                                                   | Repo tonie w dokumentach-duchach                                                                             |
| Z13     | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** ani wpisów w `TRIANGLE_COMPLETENESS_VERDICT_2026-08-24.md` i nie podważasz ich w kodzie ani raporcie                                                                                                                                                                                                                         | Rejestr decyzji jest `FINAL / IRREVOCABLE`                                                                   |
| **Z14** | **Nie budujesz generowania treści modelem i nie podpinasz dostawcy LLM.** Zero nowych wywołań `llmService`. Audyt jest deterministyczny i ma taki zostać                                                                                                                                                                                                                                       | Silnik AI = osobny moduł, ostatni w programie; DEC-51                                                        |
| Z15     | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych / `null` / `degraded`.** `risk_score: null` **nie** staje się liczbą; `degraded` z powodem **zostaje**                                                                                                                                                                                                                               | Uczciwy pusty stan > udawany wynik                                                                           |
| **Z16** | **★★ `server/src/services/effectiveAccessService.ts` jest ABSOLUTNIE NIETYKALNY** — także `frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts`, `PermissionsService`. Wolno **czytać** i **cytować**                                                                                                                                                              | Model uprawnień naprawiany in-house po 3 audytach; zmiana zepsułaby TRI-MUST-12                              |
| **Z17** | **★ Zakaz wszystkiego poza obszarem audytu Admin/Superadmin** — z imiennymi licencjami z ramki poniżej. Cały front, powłoka SPEC-A, kanon triady: **NIE**                                                                                                                                                                                                                                      | „jeden moduł na raz"; podział FRONT/TYŁ (§1.6)                                                               |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config*.ts`, ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru**                                            | Dyżur nr 2 wywalił tak 27 cudzych testów                                                                     |
| **Z19** | **★★ ZAKAZ uruchamiania jakichkolwiek testów DB bez jawnego `DATABASE_URL` wskazującego kontener TEGO dyżuru, podanego W TEJ SAMEJ LINII komendy.** Kolejność Bloku 0: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar**. Do raportu obowiązkowy **dowód celu połączenia**                                                                                              | Dzień 17 zmierzył stan wejściowy na cudzej/niezmigrowanej bazie (DEC-96/98)                                  |
| **Z20** | **★ DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`) — patrz ramka pod tabelą                                                                                                                                                                                                                                                                                      | Bramka DoD dnia 60 przepuściła „ZROBIONE" przy czterech żywych martwych gałęziach                            |
| **Z21** | **★ Test wstrzykujący zależności NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`) — każda pozycja z wywołaniem zewnętrznym musi mieć **test domyślnego okablowania**                                                                                                                                                                                                                  | Dzień 18: 8/8 testów zielonych, warstwa AI martwa, bo wszystkie wstrzykiwały własne `generate`               |
| **Z22** | **★ Zakaz atrapy z zewnętrznym skutkiem** (`DEC-2026-08-26-108`) — sukces + efekt na zewnątrz przy braku zmiany w bazie = odrzucenie pozycji. **W tym dyżurze: wpis audytowy JEST efektem zewnętrznym**                                                                                                                                                                                        | Dzień 19: `DELETE /occurrence` rozsyłał `CANCEL` bez zmiany w bazie                                          |
| **Z23** | **★ Pomiar testów BEZ ZAWĘŻANIA** (`DEC-2026-08-26-108`) — wynik z pełnego zakresu §0.4a, z rozbiciem **zastane / wprowadzone**                                                                                                                                                                                                                                                                | Dzień 19 zadeklarował „98/98 PASS" przy 164/167 w zakresie własnej instrukcji i dwóch wniesionych czerwonych |

**★ Z9 — procedura po korekcie `DEC-2026-08-26-98` (nie zabijaj dyżuru).**
Jeżeli złapiesz się na komendzie DB bez przypiętego env: **zatrzymaj tę komendę →
ustal skutek (czy w ogóle doszło do połączenia i czy był ZAPIS) → zapisz
ustalenie w raporcie → przypnij env → KONTYNUUJ pozycję.** Twardy STOP całego
dyżuru **wyłącznie** przy stwierdzonym realnym **zapisie** do bazy spoza dyżuru.
`localhost:5432/iris_test` to wewnętrzny fallback konwencji testowej repo
(`tests/setup.ts`), nie obca baza — ale i tak nie mierzysz przeciwko niemu.

**★ Z19 — dlaczego to jest twarde, a nie biurokracja.**
`server/src/database/Database.ts` przy `NODE_ENV=test` **BEZ** `RUN_DB_TESTS=1`
podstawia **mock DB** i cały pakiet „przechodzi" przeciwko niczemu. Dodatkowo
część odczytów w repo idzie przez `DbPromise` z domyślnym `fallback:true`, więc
brak tabeli potrafi udawać pustą listę — a **w audycie brak tabeli udający pustą
listę to najgorszy możliwy fałsz**. Wzorzec dnia 15
(`day15.adminP32.auditProjection.pg.test.ts:10-19`) wymaga **czterech** zmiennych,
nie dwóch. Dlatego **każde** uruchomienie testu dotykającego bazy ma env
**w tej samej linii**:

```bash
DATABASE_URL="postgres://postgres:cx@localhost:5481/cx_day22" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
npx vitest run <plik>
```

i **każdy** taki przebieg jest poprzedzony dowodem celu połączenia:

```bash
docker exec cx-day22-pg psql -U postgres -d cx_day22 -c "SELECT current_database(), inet_server_port();"
```

Wynik tej komendy (**dosłowny**) jest obowiązkową pozycją raportu. Pomiar bez
dowodu celu = pomiar nieistniejący.

**★ Z20 — jak wygląda dowód osiągalności.**
Nie wystarczy „funkcja istnieje i ma test jednostkowy". Dla **każdej** pozycji
podajesz w raporcie **ścieżkę wywołania od realnego wejścia**:

```
realne wejście (metoda + URL, jaki wychodzi z przeglądarki)
  → montaż w Gateway.ts / index.ts (plik:linia)
  → router (plik:linia)
  → serwis/pisarz audytu (plik:linia)
  → zapis do tabeli (nazwa tabeli, kolumna)
  → odczyt przez projekcję (plik:linia nogi, która ten wiersz podnosi)
```

**Ostatni wiersz jest w tym dyżurze obowiązkowy.** Pisarz audytu, którego
żadna noga projekcji nie czyta, jest kodem nieosiągalnym z punktu widzenia
`AC-005` — pozycja `CZĘŚCIOWO`, nie `ZROBIONE_WG_DoD`.

**★ Z21 — co to znaczy „test domyślnego okablowania".**
Trasy Admin są montowane w `server/src/Gateway.ts:647`
(`app.use('/api/admin', adminP32Routes)`), a globalny pisarz audytu w
`server/src/index.ts:1274` (`app.use('/api/', auditLogMiddleware)`). Test, który
buduje własny `express()` i montuje sam router, **nie przechodzi przez globalny
middleware** — czyli nie dowodzi niczego o tym, czy mutacja zostawia wiersz
w `audit_events`/`activity_logs`/`audit_log`. Dla każdej pozycji, która polega
na globalnym pisarzu, potrzebujesz testu, który ten middleware **faktycznie
zamontuje**, albo — jeżeli to niewykonalne — **jawnego wpisu, że pozycja opiera
się wyłącznie na pisarzu semantycznym**, i wtedy pisarz semantyczny musi być
w kodzie trasy, nie w middleware.

**Zasięg Z18 — konkretnie.**

```
tests/setup.ts
tests/helpers/**            (w tym unifiedMockSetup.js)
tests/__mocks__/**
vitest.config.ts  vitest.l1.config.ts  vitest.l2.config.ts  vitest.l3.config.ts
vitest.acceptance.config.ts  vitest.security.config.ts  vitest.orphans.config.ts
vitest.perf.config.ts  vitest.migration.config.ts
server/vitest.config.ts  server/vitest.config.v8-db.ts
tests/integration/**/vitest.*.config.ts
```

Gdy potrzebujesz innego zachowania mocka: **opt-in, nigdy globalnie** — `vi.mock`
lokalnie w Twoim pliku testowym albo dedykowany helper w **nowym** pliku
importowanym tylko przez Twoje testy. Jeśli Twój test nie przechodzi bez zmiany
globalnego mocka — to **STOP**, nie zmiana globalnego mocka.

**Zasięg Z17 — granica jest ostra.**

```
WOLNO (Twój zakres):
  server/src/routes/admin/break-glass.routes.ts                  (B.1)
  server/src/routes/admin/service-accounts.routes.ts             (B.1)
  server/src/routes/admin-bulk.routes.ts                         (B.1 — Z WYJĄTKIEM linii 22
                                                                  i użycia invalidatePlatformSuperAdminCache: DEC-105)
  server/src/routes/access-control.routes.ts                     (B.2)
  server/src/routes/admin/domains.routes.ts                      (B.2)
  server/src/routes/adminP32.routes.ts                           (TYLKO §B.3 — nogi projekcji — i §E.1)
  server/src/controllers/SuperAdminController.ts                 (TYLKO §E.2, TYLKO getAdminAuditLogs /
                                                                  getAdminAuditStats / exportAuditLogs,
                                                                  i TYLKO jeśli §E.2 skończy się budową,
                                                                  a nie STOP-em z kontraktem)
  server/migrations/2026113<x>_superadmin_day22_*.sql             (NOWE pliki, numeracja wg §0.3)
  server/src/routes/__tests__/day22.*.test.ts                     (NOWE pliki)
  server/src/routes/admin/__tests__/day22.*.test.ts               (NOWE pliki)
  tests/integration/admin/*day22*.realdb.test.ts                  (NOWE pliki, git add -f)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/14_ADMIN/MODULE_ACCEPTANCE.md      (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/SUPERADMIN_DAY22_REPORT_20260826.md        (jedyny nowy dokument)

IMIENNE LICENCJE (wolno WOŁAĆ/CZYTAĆ istniejące, NIE zmieniać ich kodu):
  §B.1 — server/src/middleware/requireAudit.middleware.ts::requireAudit / req.emitAuditEvent
         (MONTUJESZ na swoich trasach i WOŁASZ; ZMIANA PLIKU = STOP)
  §B.2 — server/src/services/adminAuditService.ts::logAction
         (WOŁASZ; ZMIANA PLIKU = STOP — patrz pułapki §1.7)
  §B.3 — server/src/services/AuditEventsService.ts · ActivityService.ts · auditService.ts
         (CZYTASZ, żeby udowodnić potrójny zapis; NIE zmieniasz)
         server/src/middleware/auditLog.middleware.ts   (CZYTASZ; ZMIANA = STOP — to globalny pisarz
                                                        całej aplikacji, nie tylko Admina)
  §C   — server/src/routes/adminP32.routes.ts::getAdminActor  (CZYTASZ jako wzorzec odmowy; NIE zmieniasz)
  §D   — server/scripts/migrate.postgres.ts::isSqliteOnlyMigration (CZYTASZ; NIE naprawiasz klasyfikatora)
  wzorzec testu — server/src/routes/__tests__/day15.adminP32.auditProjection.pg.test.ts (CZYTASZ jako wzorzec)

NIE WOLNO:
  CAŁE src/**                                                   ← podział FRONT/TYŁ; zero wyjątków,
                                                                  także „jedna linia importu"
  server/src/services/organizationSuspensionGuard.ts            ← DEC-105, ODRZUCENIE DYŻURU
  server/src/middleware/auth.middleware.ts
  server/src/middleware/apiKeyAuth.middleware.ts
  server/src/realtime/**  ·  server/src/gateways/**             ← osiem frontów DEC-105
  server/src/controllers/AuthController.ts · UserController.ts · InvitationController.ts
  server/src/services/effectiveAccessService.ts                 ← Z16, ODRZUCENIE
  server/src/services/frameworkEntitlementService.ts · middleware/frameworkEntitlement.middleware.ts
  server/src/routes/auth.routes.ts  ·  server/src/routes/superadmin.routes.ts (poza czytaniem)
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
  docs(admin): inventory of the five audit tables and their writers (A.1)
  docs(admin): full inventory of 83 admin mutations and their audit coverage (A.2)
  feat(admin): fail-closed audit for break-glass, service accounts and bulk role change (B.1)
  feat(admin): semantic audit writers for access requests and domain takeover (B.2)
  test(admin): prove the triple write and settle the fourth projection leg (B.3)
  test(admin): negative enforcement controls for every newly audited mutation (C.1)
  test(admin): prove a rejected mutation leaves no phantom audit row (C.2)
  chore(db): close the scheduled_events fresh-database gap (D)
  fix(admin): make the superadmin audit surface see the extended projection (E.2)
  docs(admin): raise 14_ADMIN acceptance to the delivered scope (R.1)
  ```
- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita.
- **Testy celowane per pozycja** — **nigdy pełny `tsc` ani pełny `vitest` repo.**
- **★ KAŻDA nowa powierzchnia = minimum CZTERY testy zachowania**: happy ·
  ścieżka błędu (4xx/5xx) · pusty stan · **negatyw tenanta** (obcy
  `organizationId` dostaje 404/403, nigdy 200).
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `toContain('...')`, **nie liczy się do DoD**. W tym dyżurze ma to
  ostrze szczególne: dowodem audytu jest **wiersz w tabeli odczytany niezależnym
  połączeniem**, nigdy obecność wywołania `logAction` w kodzie.
- **Typy punktowo** (`npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null`),
  **nie** pełny `tsc -p`.
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok kodu
  w `server/src/` dodają się normalnie.
- **★ MIGRACJE — reguły twarde, bez wyjątków.**
  1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
     `INSERT ... ON CONFLICT DO NOTHING`. **Zakaz** `DROP`,
     `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`, bezwarunkowego `UPDATE`.
  2. **★★ NUMERACJA — DZIEŃ 22 MA PRZYDZIELONY PRZEDZIAŁ `20261130`–`20261139`.**
     Reguła „najwyższy + 1" obowiązuje **TYLKO WEWNĄTRZ tego przedziału**.
     Numery spoza przedziału są **ZAKAZANE, nawet jeśli są wolne**:
     - `20261120` = domknięcie luki świeżej bazy (`DEC-116`) — **zajęte**;
     - `20261121`–`20261129` = **zarezerwowane dla prac wewnętrznych**, nie ruszasz;
     - `20261076`–`20261119` = pule dni 17–21, część **jeszcze nie scalona**,
       więc `ls` ich u Ciebie nie pokaże — to nie znaczy, że są wolne.

     **Obowiązkowy `ls | grep` PRZED KAŻDYM plikiem:**

     ```bash
     ls server/migrations | grep -E '^202611[0-9]{2}' | sort | tail -5   # co widać jako zajęte
     ls server/migrations | grep '^20261130'                              # MUSI być PUSTE przed utworzeniem pliku
     ```

     Nazwa: `<numer>_superadmin_day22_<temat>.sql`.
     **Pierwszy wolny w Twoim przedziale to `20261130`.** Sprawdź to sam.
     `migrate.postgres.ts` stosuje migracje w porządku **alfabetycznym nazw
     plików**, więc kolizja numeru to cicha katastrofa — dokładnie ta, którą
     wykrył odbiór dnia 18 (`DEC-107`) i której winna była instrukcja, nie Codex.

  3. **★ ZERO nowych kluczy obcych** do tabel audytowych. Istniejące FK
     `admin_audit_logs.admin_id → users(id)` i `organization_id → organizations(id)`
     zostają — ale ich **nie powielasz** w nowych obiektach.
  4. **★ DOWÓD IDEMPOTENCJI + KOMPATYBILNOŚCI WSTECZ (DEC-65)** — warunek
     oddania każdej pozycji z migracją. Jednorazowy kontener, trzy przebiegi,
     wyniki do raportu. **Sprzątanie kontenera I wolumenów jest obowiązkowe.**
  5. **Prawdopodobnie NIE potrzebujesz żadnej migracji.** Pisarze audytu piszą
     do istniejących tabel; `scheduled_events` (`§D`) jest bardzo prawdopodobnie
     już domknięte przez `20261120`. **Zweryfikuj to w Bloku 0 i nie dodawaj
     migracji „na wszelki wypadek".** Migracja bez udowodnionego braku obiektu
     na świeżej bazie = pozycja odrzucona.
- **`MIGRATION_PREPARED`** — migracja jest przygotowana i udowodniona lokalnie,
  **nigdy** uruchomiona zdalnie (`REMOTE_EXECUTION_NOT_AUTHORIZED`).

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

Pozycja jest zrobiona, gdy spełnia **wszystkie dwanaście**:

1. **Realne dane** — odczyt i zapis idą do backendu. Zero mocków jako źródła
   prawdy. Pusty wynik = uczciwy pusty stan; nieznane = `null` z powodem,
   **nigdy zmyślona liczba**.
2. **Zapis z readbackiem** — po komendzie zapisującej test ponownie odczytuje
   stan z bazy **niezależnym połączeniem** (osobny `pg.Pool`), nie z koperty
   odpowiedzi. **Dotyczy to zarówno mutacji, jak i jej wiersza audytowego.**
3. **Zero atrap.** Brak API → wpis `BRAK_API`. **I zero atrap z zewnętrznym
   skutkiem (Z22)**: jeżeli wiersz audytu mówi „usunięto", w bazie MUSI nie być
   usuwanego obiektu — dowodzisz to liczbą wierszy przed i po.
4. **Minimum 4 testy zachowania** (happy · błąd · pusty · negatyw tenanta),
   behawioralne.
5. **★ Test HTTP realnego routera** przez `supertest` na **realnym PG**
   (wzorzec: `server/src/routes/__tests__/day15.adminP32.auditProjection.pg.test.ts`).
   Test na zmockowanej bazie **nie zastępuje** tego wymogu.
6. **★ DOWÓD OSIĄGALNOŚCI (Z20)** — pełna ścieżka od realnego wejścia do zapisu
   **i do nogi projekcji, która ten wiersz podnosi**. Bez ostatniego ogniwa
   pozycja jest `CZĘŚCIOWO`.
7. **★ TEST DOMYŚLNEGO OKABLOWANIA (Z21)** — dla każdej pozycji, która polega
   na globalnym `auditLogMiddleware`: test przez zamontowany middleware, albo
   jawny wpis, że pozycja opiera się wyłącznie na pisarzu semantycznym.
8. **Kontrole negatywne tenanta** — obcy `organizationId` nigdy nie dostaje
   `200`; `organizationId` **wyłącznie z tokenu**, nigdy z body/query. Test
   wysyła obcą organizację w body i dostaje `404`/`403`, nie `200`. **Dodatkowo:
   wiersz audytu ma organizację wołającego, nie tę z ciała żądania.**
9. **★ Kontrola negatywna egzekwowania** — żądanie bez wymaganego uprawnienia
   jest ODRZUCONE (`401`/`403`) **i nie zostawia śladu mutacji**; ślad audytowy
   przy odrzuceniu — wg konwencji ustalonej w `§C.2`, nie wg Twojego uznania.
10. **Realny PG w jednorazowym Dockerze** (port 5481) z pełnymi migracjami,
    z dowodem celu połączenia (Z19), ze sprzątnięciem kontenera **i wolumenów**.
11. **Plik przez `prettier`** przed commitem.
12. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód`.

> Punkty „zrzut light+dark" i „i18n napisów UI" **nie obowiązują** w tym dyżurze —
> front jest poza zakresem. Klucze i18n tworzysz **wyłącznie** dla napisów, które
> faktycznie wychodzą z Twojego API (kody i komunikaty błędów), i wtedy parytet
> PL+EN obowiązuje w tym samym commicie.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu (Z23)

Przed oddaniem raportu:

1. Wypisz wszystkie dotknięte pliki: `git diff --name-only codex/m03-admin-20260824...HEAD`.
2. Wyodrębnij **współdzielone** (importuje je ktoś spoza Twojego zakresu):
   `server/src/routes/adminP32.routes.ts`,
   `server/src/controllers/SuperAdminController.ts`,
   `server/src/routes/admin-bulk.routes.ts`,
   `server/src/routes/access-control.routes.ts`.
3. Uruchom testy **katalogów konsumentów**, nie tylko własnych plików. Minimum
   (każde z jawnym `DATABASE_URL` w tej samej linii tam, gdzie dotyka bazy — Z19):
   ```bash
   npx vitest run server/src/routes/__tests__/adminP32.auditProjection.pg.test.ts
   npx vitest run server/src/routes/__tests__/day15.adminP32.auditProjection.pg.test.ts
   npx vitest run server/src/routes/__tests__/superadmin-organization-reactivation-audit.day15.test.ts
   npx vitest run server/src/routes/__tests__/cross-org-idor-m17.test.ts
   npx vitest run tests/unit/backend/routes/adminP32.security-audit.test.ts
   npx vitest run tests/integration/admin
   npx vitest run server/src/middleware/__tests__/organizationSuspensionEnforcement.middleware.test.ts
   npx vitest run server/src/middleware/__tests__/apiKeyOrgSuspension.middleware.test.ts
   npx vitest run server/src/services/__tests__/effectiveAccessService.test.ts
   ```
   Dwa ostatnie pakiety DEC-105 i Z16 są w zakresie **nie dlatego, że je
   zmieniasz** (nie wolno Ci), tylko dlatego, że **muszą pozostać zielone** —
   to jest Twój dowód, że ich nie ruszyłeś.
4. **★ Wynik podajesz BEZ ZAWĘŻANIA, z rozbiciem `zastane / wprowadzone`:**
   ```
   Zakres §0.4a: <X>/<Y> PASS
     czerwone ZASTANE (były czerwone na bazie, przed moim pierwszym commitem): <lista plików + liczby>
     czerwone WPROWADZONE (zapalone przez mój commit): <lista + SHA commitu, który je zapalił>
   ```
   **Deklaracja „N/N PASS" na wybranym podzbiorze przy czerwonych w zakresie
   §0.4a = zawyżenie i podstawa odrzucenia** (`DEC-108`, P1 dnia 19).
5. Deklarujesz jawnie `ZASIĘG PEŁNY` / `ZASIĘG CZĘŚCIOWY` (i co pominąłeś,
   i dlaczego). `CZĘŚCIOWY` bez wyliczenia pozycji jest odrzucany.
6. **Baseline liczysz PRZED pierwszym commitem** (Blok 0 pkt 7) — inaczej nie
   masz jak odróżnić zastanego od wprowadzonego.

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**
Zatrzymujesz się w szczególności, gdy musiałbyś:

- dotknąć `organizationSuspensionGuard.ts` albo dowolnego z ośmiu frontów
  `DEC-105` — to jest STOP **zawsze**, także „addytywnie, tylko audyt";
- dotknąć `effectiveAccessService.ts` albo dowolnego pliku modelu uprawnień (Z16);
- zmienić `auditLog.middleware.ts`, `requireAudit.middleware.ts`
  albo `adminAuditService.ts` — te trzy pliki **wołasz**, nie zmieniasz;
- osłabić/usunąć asercję w teście istniejącym wcześniej;
- sfabrykować `risk_score`/`risk_level` dla nogi, która ich nie ma (Z15);
- dodać migrację nieaddytywną, z kluczem obcym, albo z numerem **spoza
  przedziału `20261130`–`20261139`**;
- stworzyć flagę funkcyjną albo zmienić domyślną wartość istniejącej (Z10);
- wejść we `src/**` (Z17) — **także po to, żeby „tylko pokazać nową kolumnę"**;
- zapisać wiersz audytu **przed** potwierdzeniem skuteczności mutacji (Z22);
- zmienić konwencję śladu przy odmowie bez decyzji nadzorcy (§C.2);
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

`TRI-MUST-08` w werdykcie trójkąta
(`TRIANGLE_COMPLETENESS_VERDICT_2026-08-24.md:75`) brzmi:

> **Audyt mutacji admina nie jest uniwersalny.** Projekcja `/api/admin/audit-logs`
> ma tylko 2 źródła; mutacje zespołów, domen, `ai-settings`/`ai-governance` nie
> zostawiają wpisu. Narusza kontrakt spec „every Admin mutation defines … audit
> trail" (`AC-005`).

Dzień 15 dołożył **trzecie źródło** (`audit_events`) i zrobił **inwentarz**
(83 mutacje / 20 pisarzy semantycznych / 63 bez). Pozycję `A.3` — _pisarze
semantyczni dla najgroźniejszych mutacji_ — zaraportował jako **`NIE_ZACZĘTE`**
(`SUPERADMIN_DAY15_REPORT_20260826.md:166-168`), a kontrakt `AC-005` jako
**`NOT PROVEN`**.

**To jest dokładnie Twój dyżur.** Nie zaczynasz od zera i nie powtarzasz dnia 15
— **kończysz jego `A.3`, domykasz projekcję i dokładasz to, czego dzień 15 nie
miał: kontrole negatywne egzekwowania.**

### 1.2. ZAKRES — dokładnie pięć obszarów, nic więcej

| Poz.    | Nazwa                               | Stan zastany                                                                                       | Twój produkt                                                                                                                  |
| ------- | ----------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **A**   | **Inwentarz pisarzy audytu**        | Dzień 15 zrobił inwentarz Admina (83/20/63); brak inwentarza **tabel** i brak zasięgu poza Adminem | Dwie tabele: pięć tabel audytowych × pisarz × tryb awarii × czy w projekcji; **pełna lista pisarzy z klasyfikacją 3-stanową** |
| **B**   | **Rozszerzenie pokrycia**           | 63 mutujące trasy bez pisarza semantycznego; `A.3` dnia 15 `NIE_ZACZĘTE`                           | Pisarze semantyczni dla rankingu dotkliwości 1–5 + rozstrzygnięcie czwartej/piątej nogi projekcji                             |
| **C**   | **Kontrole negatywne egzekwowania** | Brak testów dowodzących, że odmowa jest odmową i że nie zostawia wiersza-widma                     | Pakiet negatywów per trasa + ustalona i udowodniona konwencja śladu przy odmowie + dowód mutacyjny                            |
| **D**   | **TRI-OBS-18 / `scheduled_events`** | `DEC-85` zostawił otwarte; `DEC-116` dołożył `20261120` — **prawdopodobnie już zamknięte**         | Dowód na świeżej bazie: zamknięte (bez migracji) albo migracja addytywna z przedziału                                         |
| **E**   | **Spójność odczytu audytu**         | Dwie powierzchnie odczytu; superadminowa czyta **jedną** tabelę                                    | Dowód, że wpisy z `B` są widoczne; dla powierzchni superadmina — rozszerzenie serwerowe **albo** STOP + kontrakt              |
| **T**   | **Testy**                           | —                                                                                                  | Pozycja własna, nie dodatek — §T                                                                                              |
| **R.1** | `MODULE_ACCEPTANCE.md` 14_ADMIN     | nie podniesiony o dzień 22                                                                         | Podniesienie o **faktycznie dowieziony** zakres                                                                               |

### 1.3. POZA ZAKRESEM — jawnie, żebyś nie zaczął

1. **★ CAŁE `src/`.** Ekrany audytu, filtry, eksport z przeglądarki,
   `EnterpriseAuditLog.tsx`, `AdminCommandCenterPanel.tsx`, katalogi P33/P.1–P.4
   za flagą OFF (czekają na polish-pass frontowy) — **robotnicy wewnętrzni po
   prototypie i akcepcie właściciela**. Jeżeli Twoja praca wymaga zmiany frontu:
   **kontrakt w raporcie**, nie kod.
2. **★ Strażnik zawieszenia organizacji (`DEC-105`).** Zamknięty po trzech
   audytach. Nie dokładasz mu audytu, nie „wzmacniasz", nie refaktorujesz.
3. **Model uprawnień** (Z16) — `effectiveAccessService` i rodzina.
4. **Klasyfikator migracji** (`isSqliteOnlyMigration`, `TRI-MUST-05`). Wolno
   **czytać**, żeby ustalić, czy tabela powstaje na świeżej bazie. **Nie
   naprawiasz go** — to osobny blok programowy (`DEC-116`).
5. **`api_logs` bez kolumn `api_key_id`/`tokens_used`/`cost`** — dzień 15 oznaczył
   jako `BRAK_API`. Nie improwizujesz semantyki kosztów.
6. **`LIMIT 1000` przed paginacją w projekcji** — zastany dług, świadomie
   zostawiony przez dzień 15. Nie „naprawiasz przy okazji"; jeżeli Twoja czwarta
   noga powstanie, dostaje **ten sam** limit dla spójności.
7. **Silnik AI / generowanie treści modelem** (Z14).
8. **Migracje zdalne, staging, Railway** (DEC-65, Z8).

### 1.4. Decyzje wiążące

1. **`DEC-2026-08-25-65` (DEC-65)** — wspólna kanoniczna baza = obecna baza demo;
   migracje = `MIGRATION_PREPARED` / `REMOTE_EXECUTION_NOT_AUTHORIZED`; zakaz
   zdalnych migracji/seedów/zapisów. **Prawo nadrzędne.**
2. **`DEC-2026-08-26-85`** — odbiór dnia 15. Źródło zdania „`TRI-MUST-08` NIE
   raportować jako w pełni domknięte: 3/5 tabel, 20/83 pisarzy". **To jest
   definicja Twojego celu.**
3. **`DEC-2026-08-26-105`** — egzekwowanie zawieszenia organizacji SCALONE po
   trzech audytach adwersaryjnych. **Poza zakresem, nietykalne.**
4. **`DEC-2026-08-26-116`** — luka schematu bazy od zera; migracja
   `20261120_fresh_db_schema_gap_closure.sql` zamyka klasę `ONLY_DEAD`
   (106 obiektów). **Klasa `NO_MIGRATION` (96 obiektów) jest CELOWO poza
   zakresem** — jeżeli Twój brak trafia do tej klasy, to jest STOP z opisem,
   nie improwizowana migracja.
5. **`DEC-2026-08-26-98`** — korekta Z9 (przerywa czynność, nie dyżur), mechanizm
   env w tej samej linii, **rezerwacja numerów migracji**; dzień 22 =
   **`20261130`–`20261139`**.
6. **`DEC-2026-08-26-96`** — Z19 (kolejność Bloku 0, jawny `DATABASE_URL`, dowód
   celu połączenia).
7. **`DEC-2026-08-26-95`** — rozejście marker→tip bez kolizji rozstrzyga nadzorca;
   dokładny start z markera, bez rebase.
8. **`DEC-2026-08-26-104`** — DoD wymaga dowodu **osiągalności** (u Ciebie: Z20,
   z obowiązkowym ostatnim ogniwem „noga projekcji").
9. **`DEC-2026-08-26-107`** — test wstrzykujący zależności nie dowodzi ścieżki
   produkcyjnej (Z21). Plus: źródłem kolizji migracji była instrukcja — stąd przedziały.
10. **`DEC-2026-08-26-108`** — zakaz atrapy z zewnętrznym skutkiem (Z22)
    i pomiar testów bez zawężania (Z23).
11. **`DEC-86`** — symlink `node_modules` do odczytu + numeracja migracji
    „najwyższy + 1 ze sprawdzeniem" (u Ciebie: wewnątrz przedziału).

### 1.5. Stan faktyczny — mapa techniczna (zweryfikuj w Bloku 0)

Każdą linię weryfikujesz sam; rozbieżność → „Korekty wobec instrukcji".
Numery linii pochodzą z pomiaru na tipie `codex/m03-admin-20260824` z 2026-08-26
i **mogą się przesunąć** — grepuj po treści, nie po numerze.

```
# PIĘĆ TABEL AUDYTOWYCH — sedno frazy „3/5 tabel" z DEC-85

(1) admin_audit_logs
    producent DDL:  server/migrations/236_security_module_extended.sql:170   (numer <500 — NIE uruchamiany)
                    server/migrations/900_prod_missing_tables_hotfix.sql:841 (numer >=500 — URUCHAMIANY)
    pisarz:         server/src/services/adminAuditService.ts:82  (logAction, INSERT)
    tryb awarii:    FAIL-OPEN — try/catch połyka błąd, zwraca { persisted: false } (:96-101)
    kolumny:        organization_id (jest, z FK), admin_id NOT NULL FK → users(id),
                    action_type, resource_type NOT NULL, risk_score, status
    w projekcji:    TAK — noga A (przez adminAuditService.getLogs)

(2) role_change_audit_events
    producent DDL:  server/migrations/20260816_admin_iam_operations.sql:1
    pisarz:         ścieżka IAM (zmiany ról / usunięcie członka)
    w projekcji:    TAK — noga B (adminP32.routes.ts, SELECT ... FROM role_change_audit_events)
    normalizacja:   normalizeIamAuditEvent — ★ FABRYKUJE risk_score z zaszytego mapowania
                    (member_removed 80 / role_change 60 / reszta 40). To jest ZASTANE
                    i UDOKUMENTOWANE — nie powielasz tego wzorca w nowych nogach.

(3) audit_events
    producent DDL:  server/migrations/20260809_artifact_studio_audit_and_presentation_cards.sql:7
                    (drugi producent 229_admin_overview_seed.sql — numer <500 I nazwa 'seed' → NIE uruchamiany)
    pisarze:        (a) server/src/middleware/auditLog.middleware.ts:400  — globalny, fail-open
                    (b) server/src/middleware/requireAudit.middleware.ts  — req.emitAuditEvent, FAIL-CLOSED
                        (rzuca przy nieudanym zapisie → trasa może zwrócić 503)
    kolumny:        ★ org_id (NIE organization_id), ts (NIE created_at),
                    action I action_type, actor_id I actor_user_id, entity_type I resource_type
    w projekcji:    TAK — noga C, dołożona przez dzień 15 (normalizeUnifiedAuditEvent)
                    ★ risk_score/risk_level = null — ŚWIADOMA UCZCIWOŚĆ, NIE ZMIENIASZ (Z15)
    indeks:         server/migrations/20260826_day15_audit_events_org_ts_index.sql  (org_id, ts DESC)

(4) activity_logs                                    ← ★ NIE W PROJEKCJI
    producent DDL:  server/migrations/000_z_core_baseline.sql:482
    pisarz:         server/src/services/ActivityService.ts:112/145
                    wołany z auditLog.middleware.ts:384 — TEN SAM globalny middleware
    czytany przez:  server/src/routes/security.routes.ts:335-360 (osobna powierzchnia „Audit logs")

(5) audit_log   (LICZBA POJEDYNCZA — to inna tabela niż audit_logs!)   ← ★ NIE W PROJEKCJI
    producent DDL:  server/migrations/000_zz_core_baseline_producers_fresh_db_gap.sql:193
                    (drugi producent 259_audit_logging.sql — numer <500 → NIE uruchamiany)
    pisarz:         server/src/services/auditService.ts:110
                    wołany z auditLog.middleware.ts:426 — TEN SAM globalny middleware

★ WNIOSEK, KTÓRY MUSISZ POTWIERDZIĆ ALBO OBALIĆ W A.1:
  Globalny auditLogMiddleware wykonuje POTRÓJNY ZAPIS przy każdej udanej (2xx)
  mutacji /api/*: activity_logs + audit_events + audit_log.
  Projekcja czyta 3 z 5 tabel — ale trzy nieczytane/czytane pozycje NIE są
  trzema różnymi zdarzeniami. To ma bezpośrednie konsekwencje dla §B.3.

# GLOBALNY PISARZ (czytasz, NIE zmieniasz)
server/src/index.ts:1274        app.use('/api/', auditLogMiddleware)
server/src/middleware/auditLog.middleware.ts
  :371   if (statusCode >= 200 && statusCode < 300)   ★ TYLKO SUKCESY SĄ AUDYTOWANE
  :374   if (!organizationId || !userId) return       ★ POMIJA żądania bez kontekstu org/user
  :384   getActivityService().then(...)               → activity_logs
  :400   getAuditEventsService().then(...)            → audit_events   (V4-ENT-03 dual-write)
  :426   getAuditService().then(...)                  → audit_log
  ★ Wszystkie trzy są .then/.catch BEZ await — fire-and-forget, fail-open.
    Test, który sprawdza wiersz natychmiast po odpowiedzi HTTP, potrafi
    złapać wyścig. To jest realna pułapka — patrz §1.7 pkt 5.

# PISARZ FAIL-CLOSED (montujesz i wołasz, NIE zmieniasz)
server/src/middleware/requireAudit.middleware.ts
  :78    export function requireAudit(req, res, next)
  :87    req.emitAuditEvent = (input) => Promise<string>   — odrzuca obietnicę przy błędzie zapisu
  konsumenci dziś: superadmin.routes.ts, my-work.routes.ts (~20 miejsc), artifacts.routes.ts,
                   dataExport.routes.ts, presentations.routes.ts, benefits.routes.ts,
                   table-platform.routes.ts, pmo/tasks.routes.ts, chat-projects.routes.ts i in.
  ★ ŻADEN plik modułu Admin go dziś nie używa. To jest luka, którą zamykasz w B.1.

# PROJEKCJA (Twój zakres — TYLKO nogi i trasy odczytu)
server/src/routes/adminP32.routes.ts
  :286   getAdminActor(req, res, requiredCapabilities)
         ★ orgId WYŁĄCZNIE z tokenu (:299); ?orgId != token → 403 ADMIN_BOUNDARY_VIOLATION (:308)
         ★ brak org/actor → 401; błąd odczytu członkostwa → 503
         TO JEST WZORZEC ODMOWY, który kopiujesz w C.1 — nie wymyślasz własnego
  :2208  normalizeIamAuditEvent
  :2230  normalizeUnifiedAuditEvent      ← dołożone przez dzień 15
  :2256  readTenantAdminAuditProjection(orgId)  — Promise.all na TRZECH nogach,
         każda z twardym LIMIT 1000, merge + dedup po `${organization_id}:${id}`, sort w JS
  :3054  GET /audit-logs           (capability 'audit:read')
  :3081  GET /audit-logs/stats     (capability 'audit:read')
  :3100  GET /audit-logs/export    (capability 'audit:export' | 'audit:read')
server/src/Gateway.ts:647   app.use('/api/admin', adminP32Routes)

# DRUGA POWIERZCHNIA ODCZYTU (pozycja E.2)
server/src/routes/superadmin.routes.ts:3535-3541
  GET  /admin/audit-logs          → SuperAdminController.getAdminAuditLogs
  GET  /admin/audit-logs/stats    → SuperAdminController.getAdminAuditStats
  GET  /admin/audit-logs/export   → SuperAdminController.exportAuditLogs
  POST /admin/audit-logs/:id/resolve
server/src/controllers/SuperAdminController.ts:4638  getAdminAuditLogs
  ★ SELECT l.* FROM admin_audit_logs l LEFT JOIN users u ...  — JEDNA NOGA.
    Wiersze z audit_events i role_change_audit_events są tam NIEWIDOCZNE.
    Ma jawny tryb `degraded` z powodem przy braku tabeli (:4694-4706) — uczciwy wzorzec.
  ★ Ta powierzchnia jest PLATFORMOWA (bez filtra org) — inna semantyka niż /api/admin.
    Rozszerzając ją, NIE wolno Ci wprowadzić filtra org ani go usunąć bez decyzji.
konsumenci frontu: src/services/api.ts:12268, :14034, :14067, :14864, :14871

# 63 MUTACJE BEZ PISARZA SEMANTYCZNEGO — rozkład (pomiar 2026-08-26, potwierdź go)
  adminP32.routes.ts                          20 mutacji / 19 audytów  (1 bez: POST /sso-self/validate — dry-run, słusznie)
  admin/enterprise-compliance.routes.ts       10 / 0
  ai-governance.routes.ts                      6 / 0
  admin-data.routes.ts                         6 / 0
  access-control.routes.ts                     6 / 0
  ai/ai-settings.routes.ts                     5 / 1
  organization/teams.routes.ts                 5 / 0
  admin/domains.routes.ts                      4 / 0
  admin/backup.routes.ts                       4 / 0
  admin-bulk.routes.ts                         3 / 0
  admin/service-accounts.routes.ts             2 / 0
  admin/health-panel.routes.ts                 2 / 0
  admin/break-glass.routes.ts                  2 / 0
  admin/ai-quality.routes.ts                   2 / 0
  adminAlerts · sessions · security-alerts · seats · organization-profile · guests   6 / 0
  ─────────────────────────────────────────────────────────────────────
  RAZEM 83 mutacje / 20 z pisarzem semantycznym / 63 bez
```

### 1.6. Podział FRONT / TYŁ — twardy

| Warstwa                                                                    | Kto                  | Kiedy                                |
| -------------------------------------------------------------------------- | -------------------- | ------------------------------------ |
| pisarze audytu w trasach, projekcja, kontrakty odpowiedzi, migracje, testy | **TY**               | ten dyżur                            |
| kolumny/filtry/etykiety ekranów audytu, eksport z przeglądarki, i18n UI    | robotnicy wewnętrzni | po prototypie i akcepcie właściciela |

Produktem styku jest **tabela „KONTRAKT DLA FRONTU"** w raporcie: dla każdej
zmienionej lub nowej trasy — metoda, URL, body, kształt odpowiedzi, kody błędów,
oraz **jawna adnotacja, czy istniejący front to skonsumuje bez zmian**.

### 1.7. Errata i pułapki — przeczytaj przed pisaniem pierwszej linii

1. **`adminAuditService.logAction` to nietypowany worek.** Sygnatura to
   `data: any`. Organizację rozstrzyga kaskadą
   `organizationId ?? orgId ?? details.orgId ?? details.organizationId`.
   **`resource_type` domyślnie przyjmuje wartość `actionType`** (bo kolumna jest
   `NOT NULL`) — jeżeli chcesz sensowny typ zasobu, **musisz go podać jawnie**.
   Test, który przechodzi przy `resource_type === action_type`, nie jest testem.
2. **`admin_audit_logs.admin_id` ma `NOT NULL` i FK do `users(id)`.**
   Audyt akcji wykonanej przez aktora, którego nie ma w `users`, **cicho przepada**
   (fail-open, `logger.warn`). Twoje testy muszą zakładać realny wiersz w `users` —
   i muszą asertować `persisted`, a nie tylko brak wyjątku.
3. **Komentarz w `adminAuditService.getStats` (`// No organization_id column`) jest
   NIEAKTUALNY** — kolumna istnieje (`236:172`, `900:843`) i `logAction` ją
   wypełnia. To znalezisko do raportu, **nie** powód do zmiany pliku (Z17: wołasz,
   nie zmieniasz).
4. **`resolveLog` aktualizuje wiersz po samym `id`, bez zakresu organizacji**
   (`adminAuditService.ts:165`). Dziś jest to osiągalne wyłącznie z powierzchni
   superadmina, więc **nie jest to dziura tenantowa** — ale jeżeli w `E.2`
   dotkniesz tej ścieżki, **nie wolno Ci jej wystawić na powierzchnię
   tenantową**. Wpis do „Znalezisk" obowiązkowy.
5. **Potrójny zapis globalnego middleware jest fire-and-forget.** Trzy `.then()`
   bez `await`. Test, który po `expect(res.status).toBe(200)` od razu robi
   `SELECT`, potrafi nie zobaczyć wiersza — i **to nie jest dowód braku audytu**.
   Rozwiązanie: **odpytuj z krótkim polling-em z twardym budżetem czasu**
   (np. do 2 s, co 50 ms) i **zapisz to w teście jawnie**. Nie „popraw" tego
   przez `await` w middleware (Z17: nie zmieniasz tego pliku).
6. **`audit_events` ma inne nazwy kolumn.** `org_id`, `ts`, i podwójne pary
   `action`/`action_type`, `actor_id`/`actor_user_id`, `entity_type`/`resource_type`.
   Normalizacja jest w JS (`normalizeUnifiedAuditEvent`) — jeżeli dokładasz pola,
   dokładasz je **tam**, addytywnie.
7. **Nie fabrykujesz `risk_score`.** Noga IAM to robi (zaszyte mapowanie) — to
   stan zastany i udokumentowany. Noga `audit_events` zwraca `null`, bo dzień 15
   świadomie odmówił zmyślania. **Kopiujesz odmowę, nie mapowanie.**
8. **Dedup w projekcji jest po `${organization_id}:${id}`.** Jeżeli dołożysz nogę
   z tabeli, której `id` może się powtórzyć z inną nogą (np. ten sam UUID
   zapisany do dwóch tabel przez jeden middleware), **dedup zje wiersz** i będziesz
   miał cichą utratę. Sprawdź to eksperymentem, nie rozumowaniem.
9. **`GET /audit-logs` filtruje i paginuje PO obcięciu do 1000 na nogę.** Zastany
   dług. Nie naprawiasz; wpisujesz do „Znalezisk", jeżeli Twoja praca go pogłębia.

---

## §A. INWENTARZ PISARZY AUDYTU — pozycja Bloku 0, PRODUKT OBOWIĄZKOWY

**Produktem są trzy tabele w raporcie. Bez nich cała reszta dyżuru jest
zgadywaniem — i tak zostanie oceniona.**

`§A` robisz **przed** jakąkolwiek zmianą kodu i **commitujesz osobno** (commit
`docs(admin): ...`). Jeżeli po `§A` skończy Ci się czas — **to nadal jest dobry
dyżur**, bo `§A` jest bazą pod dyżur 23 i pod decyzję właściciela o zakresie.

### A.1 — Inwentarz pięciu tabel audytowych

Dla **każdej** z pięciu tabel (`admin_audit_logs`, `role_change_audit_events`,
`audit_events`, `activity_logs`, `audit_log`) ustalasz i wpisujesz:

| Kolumna tabeli raportu    | Jak ustalasz                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------- |
| plik-producent DDL        | `grep -rn "CREATE TABLE IF NOT EXISTS <t>" server/migrations/*.sql`                 |
| czy jest na świeżej bazie | **`\d <t>` na Twoim kontenerze po pełnych migracjach** — nie z lektury kodu         |
| pisarz(e) w kodzie        | `grep -rn "INSERT INTO <t>" server/src`                                             |
| tryb awarii zapisu        | czytasz pisarza: fail-open (połknięty błąd) / fail-closed (rzuca) / fire-and-forget |
| kolumna organizacji       | `organization_id` / `org_id` / brak                                                 |
| kolumna czasu             | `created_at` / `ts` / `timestamp`                                                   |
| czytana przez projekcję?  | `grep -n "FROM <t>" server/src/routes/adminP32.routes.ts`                           |
| czytana przez inną trasę? | `grep -rn "FROM <t>" server/src/routes server/src/controllers`                      |

**Obowiązkowe rozstrzygnięcie w tej pozycji:** czy fraza `3/5 tabel` z `DEC-85`
odnosi się do tej piątki. **Jeżeli ustalisz inny skład piątki — wpisz to do
„Korekt wobec instrukcji" i pracuj na SWOIM składzie**, nie na moim. Poprzedni
dyżurni wyłapywali błędy w materiale diagnostycznym i **to podnosiło jakość
odbioru, nie obniżało**.

**DoD `A.1`:** tabela pięciu (lub Twojej ustalonej liczby) tabel z wypełnionymi
wszystkimi kolumnami; **wynik `\d` z realnego kontenera dla każdej**; jawne
zdanie, ile tabel czyta projekcja i dlaczego pozostałe nie.

### A.2 — Pełny inwentarz pisarzy (★ produkt obowiązkowy dyżuru)

**Zakres inwentarza jest SZERSZY niż moduł Admin.** Dzień 15 policzył 83 trasy
Admina. Ty dokładasz operacje **destrukcyjne / uprawnieniowe / eksportowe**
także poza modułem Admin — bo `AC-005` mówi o audycie, a nie o katalogu plików.

Minimalny zasięg skanowania:

```bash
# (a) moduł Admin — potwierdź pomiar 83/20/63
for f in $(ls server/src/routes/admin*.ts server/src/routes/admin/*.ts \
              server/src/routes/organization/teams.routes.ts \
              server/src/routes/ai/ai-settings.routes.ts \
              server/src/routes/ai-governance.routes.ts \
              server/src/routes/access-control.routes.ts 2>/dev/null); do
  m=$(grep -cE "^\s*router\.(post|put|patch|delete)\(" "$f")
  a=$(grep -cE "logAction|emitAuditEvent|auditEventsService" "$f")
  [ "$m" -gt 0 ] && echo "$m mut / $a audit  $f"
done | sort -rn

# (b) POZA Adminem — operacje uprawnieniowe i destrukcyjne
grep -rn "DELETE FROM organizations\|DELETE FROM users\|DELETE FROM organization_members" server/src | head -40
grep -rln "role\s*=\|updateRole\|changeRole\|setRole" server/src/routes server/src/controllers | head -30
grep -rn "api_key\|apiKey\|sk_live\|scim\|SCIM" server/src/routes | grep -iE "post|put|patch|delete" | head -30
grep -rln "dataExport\|exportOrganization\|bulkExport" server/src/routes | head -20
grep -rn "organizations SET status\|status = 'suspended'\|purge_scheduled" server/src | head -20

# (c) kto już używa fail-closed
grep -rln "requireAudit" server/src/routes | grep -v __tests__
```

**Format tabeli inwentarza (obowiązkowy, jedna linia na trasę):**

| Plik:linia | Metoda + ścieżka | Klasa operacji | Pisarz | Tabela docelowa | Klasyfikacja |
| ---------- | ---------------- | -------------- | ------ | --------------- | ------------ |

gdzie:

- **Klasa operacji**: `DESTRUKCYJNA` (usuwa dane) · `UPRAWNIENIOWA` (zmienia
  role/dostęp/klucze) · `STATUSOWA` (zmienia status org/użytkownika) ·
  `EKSPORT` (wynosi dane) · `KONFIGURACYJNA` (reszta);
- **Klasyfikacja** — dokładnie jedna z **trzech**:
  - `AUDYTOWANY_PROJEKCJĄ` — zostawia wiersz, który **jedna z nóg
    `readTenantAdminAuditProjection` faktycznie podnosi**;
  - `AUDYTOWANY_INACZEJ` — zostawia wiersz w tabeli **poza** projekcją
    (`activity_logs`, `audit_log`) albo w rejestrze dziedzinowym;
  - `NIEAUDYTOWANY` — nie zostawia śladu w żadnej z pięciu tabel.

**★ Uwaga, która decyduje o wartości tego inwentarza.** Globalny middleware
pisze do `audit_events`, którą projekcja czyta od dnia 15. Kusi więc, żeby
oznaczyć **wszystkie 83 trasy** jako `AUDYTOWANY_PROJEKCJĄ` i ogłosić `83/83`.
**To byłoby zawyżenie i zostanie odrzucone**, bo gwarancja globalnego middleware
ma cztery udokumentowane dziury:

1. pisze **tylko przy 2xx** (`auditLog.middleware.ts:371`);
2. **pomija** żądania bez `organizationId`/`userId` (`:374`);
3. jest **fail-open i fire-and-forget** — utrata wiersza nie zatrzymuje mutacji
   i nie zostawia sygnału poza `logger.error`;
4. `resourceType`/`entityId` wywodzi z **segmentów URL**, więc dla tras typu
   `POST /sessions` czy `POST /bulk` daje wpis **bezużyteczny forensycznie**
   („coś zrobiono na `sessions`"), a nie „przyznano dostęp awaryjny użytkownikowi
   X, zatwierdzony przez Y, powód Z".

Dlatego w tabeli inwentarza **`AUDYTOWANY_PROJEKCJĄ` przysługuje wyłącznie
trasie z pisarzem SEMANTYCZNYM** (`logAction` albo `emitAuditEvent`) w kodzie
trasy. Pokrycie samym globalnym middleware zapisujesz w **osobnej kolumnie
„pokrycie generyczne: TAK/NIE"** i osobno je sumujesz. Dwie liczby, nie jedna.

**DoD `A.2`:** pełna tabela; dwie sumy (semantyczna i generyczna) z jawnym
mianownikiem; potwierdzenie albo obalenie pomiaru 83/20/63; lista tras
destrukcyjnych/uprawnieniowych **spoza** modułu Admin z tą samą klasyfikacją.

### A.3 — Ranking dotkliwości i decyzja drogi

Na podstawie `A.2` układasz **ranking dotkliwości** — nie po liczbie tras, tylko
po **szkodzie z niewykrytego nadużycia**. Punkt wyjścia dnia 15 (potwierdź albo
zmień, uzasadniając):

1. `admin/break-glass.routes.ts` — przyznanie/odebranie dostępu awaryjnego;
2. `admin/service-accounts.routes.ts` — poświadczenia maszynowe;
3. `admin-bulk.routes.ts` — masowa zmiana ról;
4. `access-control.routes.ts` — zatwierdzanie/odrzucanie wniosków o dostęp;
5. `admin/domains.routes.ts` — przejęcie i weryfikacja domeny.

Dla każdej pozycji rankingu wybierasz **jedną** drogę i **uzasadniasz w raporcie**:

| Droga                                  | Pisarz               | Tabela             | Zachowanie przy awarii | Widoczna w projekcji |
| -------------------------------------- | -------------------- | ------------------ | ---------------------- | -------------------- |
| (i) `logAction`                        | `adminAuditService`  | `admin_audit_logs` | **fail-open**          | TAK (noga A)         |
| (ii) `requireAudit` + `emitAuditEvent` | `AuditEventsService` | `audit_events`     | **fail-closed (503)**  | TAK (noga C)         |

**Rekomendacja domyślna: (ii) dla rankingu 1–3, (i) dla 4–5.**
Uzasadnienie: dla dostępu awaryjnego, poświadczeń maszynowych i masowej zmiany
ról **fail-open jest złym kontraktem** — operacja, która się udała, a której
nikt nie odnotował, jest w tych trzech przypadkach nie do odróżnienia od
włamania. **Nie mieszasz obu dróg w jednej trasie.**

Jeżeli Twoja analiza da inną rekomendację — **wolno, pod warunkiem pisemnego
uzasadnienia w raporcie**. Zakazane jest tylko jedno: wybór bez uzasadnienia.

**DoD `A.3`:** ranking z uzasadnieniem szkody; tabela `plik → droga → dlaczego`;
jawne zdanie, ile tras z rankingu weźmiesz w `§B` (i dlaczego nie więcej).

---

## §B. ROZSZERZENIE POKRYCIA — pisarze semantyczni i nogi projekcji

**Zakres twardy: MAKSYMALNIE PIĘĆ PLIKÓW z górnych pozycji rankingu.**
Nie „wszystkie 63 trasy" — to praca na kilka dyżurów i skończyłaby się 63
płytkimi wpisami zamiast kilkunastu użytecznych. Lepiej **siedem tras
z pełnym DoD** niż sześćdziesiąt trzy z `logAction` wklejonym na ślepo.

### B.1 — Pisarze fail-closed dla rankingu 1–3

**Trasy w zakresie (7):**

```
server/src/routes/admin/break-glass.routes.ts
  POST   /sessions        (~:66)   otwarcie sesji break-glass  — reason + approvedBy
  DELETE /sessions/:id    (~:109)  odebranie sesji break-glass
server/src/routes/admin/service-accounts.routes.ts
  POST   /                (~:42)   utworzenie konta serwisowego + scopes
  DELETE /:id             (~:63)   unieważnienie konta serwisowego
server/src/routes/admin-bulk.routes.ts
  POST   (~:37) (~:115) (~:164)    masowe operacje — ustal semantykę każdej z kodu
```

**Wzorzec (droga ii):** montujesz `requireAudit` na trasie i wołasz
`req.emitAuditEvent({ action, resourceType, resourceId, before, after, metadata })`
**po** potwierdzeniu skuteczności mutacji.

**Pięć rzeczy, które muszą się zgodzić:**

1. **Kolejność.** Najpierw mutacja i jej potwierdzenie (readback albo `changes > 0`),
   dopiero potem `emitAuditEvent`. Odwrotna kolejność to Z22.
2. **Fail-closed naprawdę zamyka.** Skoro `emitAuditEvent` rzuca przy nieudanym
   zapisie, trasa musi to obsłużyć **jawnie** — `503` z kodem
   `AUDIT_UNAVAILABLE`, nie ciche `catch {}`. **Test tego wymaga: awaria zapisu
   audytu → 503.**
3. **★ Ale mutacja już się wykonała.** To jest realny problem projektowy, nie
   formalność: `DELETE /service-accounts/:id` unieważnia konto, potem audyt pada,
   trasa zwraca 503 — a konto **jest** unieważnione. Klient zobaczy błąd, mimo że
   operacja przeszła. **Masz dwie dopuszczalne odpowiedzi i musisz wybrać jedną
   świadomie, opisując ją w raporcie:**
   - **(a)** transakcja obejmująca mutację i wpis audytu — jeżeli obie idą do tej
     samej bazy i ścieżka na to pozwala (**sprawdź, czy pozwala; nie zakładaj**);
   - **(b)** `503` z kopertą jawnie mówiącą, że **operacja została wykonana, ale
     nie została odnotowana** — i wpis do „Znalezisk" jako dług.
     **Milczące `503` sugerujące, że nic się nie stało, jest zakazane** — to
     odwrotność Z22 i równie szkodliwe.
4. **Semantyka, nie URL.** `resourceType` = `break_glass_session` /
   `service_account` / `bulk_role_change`, nie `sessions`. `metadata` zawiera to,
   co jest potrzebne do dochodzenia: kto zatwierdził, jaki powód, ilu użytkowników
   dotknęła operacja masowa, jakie `scopes` dostało konto. **Zero PII ponad
   niezbędne**: identyfikatory tak, adresy e-mail/nazwiska/treści — nie.
   Sekrety, tokeny, klucze konta serwisowego — **nigdy**, nawet skrócone.
5. **Tenant z kontekstu operacji**, czyli z tokenu (`req.user.organizationId`),
   **nigdy** z body/query. Test to udowadnia (patrz `§C.1`).

**DoD `B.1`:** 7 tras (lub mniej, uczciwie wyliczonych) z pisarzem fail-closed;
per trasa: mutacja → readback → wiersz w `audit_events` z poprawnym `org_id`,
`actor_id`, `action`, `resource_type` **różnym od `action`** i sensownym
`metadata`; test awarii audytu → `503`; **dowód, że wiersz podnosi noga C
projekcji** (`GET /api/admin/audit-logs` go zwraca); negatyw tenanta; decyzja
z pkt 3 opisana.

### B.2 — Pisarze semantyczni dla rankingu 4–5 (pozycja warunkowa)

**Robisz tylko wtedy, gdy `B.1` jest domknięte.** Trasy:

```
server/src/routes/access-control.routes.ts    6 mutacji (~:39, :156, :242, :285, :415, :529)
server/src/routes/admin/domains.routes.ts     4 mutacje (~:79, :126, :155, :185)
```

Droga wg `A.3` (domyślnie `logAction`). Pułapki `logAction` — §1.7 pkt 1–2:
**podajesz `resourceType` jawnie**, **podajesz `organizationId` jawnie**,
**asertujesz `persisted`**.

**Znalezisko do potwierdzenia:** dzień 15 odnotował, że stan weryfikacji domeny
jest trzymany w **pamięci procesu** (`Map`, `admin/domains.routes.ts` ok. `:180`).
Jeżeli to nadal prawda, audyt „zweryfikowano domenę" opisuje zdarzenie, które
**nie przetrwa restartu**. Wpisujesz do „Znalezisk" i **nie naprawiasz** —
trwałość weryfikacji domeny to osobna decyzja produktowa.

**DoD `B.2`:** jak `B.1`, minus wymóg `503` (droga (i) jest fail-open z definicji —
**i to musisz w raporcie nazwać ograniczeniem, nie przemilczeć**).

### B.3 — Czwarta i piąta noga projekcji — rozstrzygnięcie, nie odruch

**To jest pozycja, w której najłatwiej zrobić szkodę.** Fraza `3/5 tabel`
z `DEC-85` kusi, żeby po prostu dołożyć dwie nogi: `activity_logs` i `audit_log`.
**Zanim to zrobisz, musisz udowodnić eksperymentem, czym te wiersze są.**

**Obowiązkowy eksperyment (realny PG, przez zamontowany globalny middleware):**

1. wykonaj **jedną** udaną mutację `/api/*` z pełnym kontekstem org/user;
2. odczytaj niezależnym `pg.Pool` liczbę wierszy dodanych w tym oknie czasu
   do **każdej** z pięciu tabel;
3. wpisz wynik do raportu jako tabelę `tabela → liczba wierszy → id → czy to to
samo zdarzenie`.

**Hipoteza do potwierdzenia albo obalenia:** `activity_logs`, `audit_events`
i `audit_log` dostają **trzy zapisy tego samego zdarzenia** z jednego przebiegu
`auditLog.middleware.ts` (linie `:384`, `:400`, `:426`). Jeżeli tak jest, to:

- dołożenie nóg 4 i 5 **nie dodaje ani jednego zdarzenia** do projekcji;
- **potraja liczbę wierszy na ekranie** dla każdej mutacji przechodzącej przez
  globalny middleware (dedup po `${organization_id}:${id}` nie pomoże, bo każda
  tabela nadaje własne `id`);
- czyli **„domknięcie 5/5 tabel" pogorszyłoby produkt**, a nie poprawiło.

**Twój produkt w tej pozycji to ROZSTRZYGNIĘCIE z dowodem, w jednej z trzech postaci:**

- **(A) NIE dodaję nóg 4/5** — z tabelą eksperymentu dowodzącą równoważności
  zdarzeniowej i ze zdaniem do raportu: _„pokrycie zdarzeniowe jest 5/5, pokrycie
  tabelowe 3/5 i takie ma pozostać, bo pozostałe dwie tabele to duplikaty tego
  samego zdarzenia; luką `TRI-MUST-08` nie są tabele, tylko pisarze"_.
  **To jest wynik oczekiwany i w pełni wystarczający.**
- **(B) Dodaję nogę** — **wyłącznie** jeżeli eksperyment pokaże zdarzenia,
  których **żadna** z trzech obecnych nóg nie widzi. Wtedy: ten sam `LIMIT 1000`,
  ta sama normalizacja w JS, `risk_score = null` (Z15), **filtr tenanta
  obowiązkowy**, dedup rozszerzony tak, żeby nie potrajał, i **test dowodzący
  braku duplikatów** dla mutacji przechodzącej przez globalny middleware.
  Indeks `(organization_id, created_at)` — dokładasz migracją z przedziału
  **tylko jeżeli `\d` pokaże, że go nie ma**.
- **(C) STOP** — jeżeli eksperyment da wynik niejednoznaczny. Opisujesz co
  zmierzyłeś i czego nie umiesz rozstrzygnąć bez decyzji.

**DoD `B.3`:** tabela eksperymentu z realnymi liczbami z realnego PG; jedno
z trzech rozstrzygnięć z uzasadnieniem; jeżeli `(B)` — pełny DoD nowej nogi
włącznie z testem braku duplikatów i regresją **istniejących** pakietów
`adminP32.auditProjection.pg.test.ts` i `day15.adminP32.auditProjection.pg.test.ts`
**bez modyfikacji tych plików**.

---

## §C. KONTROLE NEGATYWNE EGZEKWOWANIA

Dzień 15 udowodnił **izolację tenanta** (`6/6 PASS` cross-org). Nie udowodnił
**egzekwowania uprawnień** ani **braku wiersza-widma przy odmowie**. To jest
Twoja pozycja i jest ona **równie ważna jak `§B`** — audyt, który loguje
odrzucone operacje jako wykonane, jest gorszy niż brak audytu.

### C.1 — Odmowa jest odmową

Dla **każdej** trasy dotkniętej w `§B` osobny przypadek testowy:

| Scenariusz                                    | Oczekiwane                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------------- |
| brak tokenu / brak `organizationId` w tokenie | `401`, zero zmian w bazie                                                          |
| token org B, zasób org A                      | `404` albo `403` — **nigdy `200`**, zero zmian w bazie                             |
| `?orgId` inny niż org z tokenu                | `403 ADMIN_BOUNDARY_VIOLATION` (wzorzec `getAdminActor:308`)                       |
| rola bez wymaganej zdolności (np. `MEMBER`)   | `403`, zero zmian w bazie                                                          |
| obcy `organizationId` **w ciele żądania**     | ignorowany; wynik `404`/`403`; **wiersz audytu, jeśli powstanie, ma org z TOKENU** |

**★ Asercja „zero zmian w bazie" jest obowiązkowa i liczona wierszami**, nie
kodem statusu. Wzorzec z `DEC-105`: _„bramy asertują odmowę przez BRAK ZAPISÓW,
nie przez sam kod statusu"_. Kopiujesz ten wzorzec dosłownie.

### C.2 — Ślad przy odmowie — najpierw USTAL KONWENCJĘ, potem testuj

**Nie zakładaj, jaka jest konwencja. Ustal ją z kodu i zapisz w raporcie.**

Punkt wyjścia (potwierdź albo obal):

- globalny `auditLogMiddleware` pisze **wyłącznie przy 2xx** (`:371`) — czyli
  **odmowa nie zostawia śladu generycznego**;
- pisarze semantyczni (`logAction`, `emitAuditEvent`) są w trasach wołani **po
  udanej mutacji** — czyli **odmowa nie zostawia śladu semantycznego**;
- `grep -rn "denied\|DENIED\|ACCESS_DENIED" server/src/routes/adminP32.routes.ts
server/src/routes/access-control.routes.ts` — w obszarze Admin **nie znajduje
  pisarza audytu odmowy**, tylko zwroty `403`.

Jeżeli to potwierdzisz, konwencja repozytorium brzmi:
**„odmowa NIE zostawia śladu audytowego"**. Wtedy Twoja pozycja `C.2` to:

1. **udowodnić brak wiersza-widma**: odrzucona mutacja → `SELECT COUNT(*)`
   niezależnym połączeniem na **wszystkich pięciu** tabelach → zero nowych
   wierszy odnoszących się do tej operacji;
2. **wpisać do „Znalezisk" z propozycją**: brak audytu odmowy oznacza, że
   **próba nadużycia jest niewidoczna** — atakujący może odpytywać granice
   tenanta bez żadnego śladu. Propozycja naprawy (jedno zdanie + wskazanie
   miejsca), **decyzja właściciela, nie Twoja**;
3. **NIE budować audytu odmowy w tym dyżurze.** To zmiana konwencji
   ogólnoaplikacyjnej, dotyka globalnego middleware (Z17 — nie wolno) i wymaga
   rozstrzygnięcia o wolumenie (każdy skan portu generowałby wiersze). **Budowa
   bez decyzji = STOP.**

**Jeżeli ustalisz, że konwencja jest INNA** (np. znajdziesz istniejącego pisarza
odmowy w innym module) — wtedy `C.2` jest odwrotne: dopisujesz ślad odmowy dla
tras z `§B` **wzorem tego istniejącego pisarza**, i to jest pozycja kodowa.
Wpisujesz to do „Korekt wobec instrukcji" i mówisz, gdzie znalazłeś wzorzec.

### C.3 — Dowód mutacyjny (test ma zęby)

Dla co najmniej **dwóch** tras z `§B` pokazujesz, że test faktycznie działa:
tymczasowo neutralizujesz filtr organizacji / sprawdzenie uprawnień w kodzie,
uruchamiasz test, **musi być czerwony**, przywracasz kod. Wynik (czerwony przed
przywróceniem, z liczbami) wpisujesz do raportu.

**Test, który przechodzi po usunięciu filtru organizacji, nie jest testem
izolacji.** To jest wzorzec z `DEC-107` i `DEC-105`; bez niego `§C` jest
`CZĘŚCIOWO`.

**DoD `§C`:** pakiet negatywów per trasa (min. 5 scenariuszy z tabeli `C.1`);
dowód braku wiersza-widma na pięciu tabelach; ustalona i zacytowana konwencja
`C.2`; dwa dowody mutacyjne z wynikiem czerwonym.

---

## §D. TRI-OBS-18 — `scheduled_events` na świeżej bazie

`DEC-85` zostawił otwarte: _„`scheduled_events` brak na świeżej bazie
(`TRI-OBS-18`)"_. Od tamtej pory weszła migracja `20261120_fresh_db_schema_gap_closure.sql`
(`DEC-116`), która domyka klasę `ONLY_DEAD` — **i według mojego odczytu zawiera
`scheduled_events` (ok. linii 1767–1789: `CREATE TABLE IF NOT EXISTS
scheduled_events` + dwa indeksy).**

**Twoja pozycja to WERYFIKACJA, nie budowa.**

```bash
# po pełnych migracjach na Twoim świeżym kontenerze:
docker exec cx-day22-pg psql -U postgres -d cx_day22 -c "\d scheduled_events"
docker exec cx-day22-pg psql -U postgres -d cx_day22 -c \
  "SELECT to_regclass('public.scheduled_events') AS scheduled_events,
          to_regclass('public.admin_audit_logs') AS admin_audit_logs,
          to_regclass('public.audit_events') AS audit_events,
          to_regclass('public.role_change_audit_events') AS role_change_audit_events,
          to_regclass('public.activity_logs') AS activity_logs,
          to_regclass('public.audit_log') AS audit_log;"
grep -n "scheduled_events" server/migrations/20261120_fresh_db_schema_gap_closure.sql
```

**Trzy możliwe wyniki i trzy różne zachowania:**

- **`scheduled_events` ISTNIEJE** → `TRI-OBS-18` w części dotyczącej tej tabeli
  jest **ZAMKNIĘTE przez `DEC-116`**. Wpisujesz do raportu dosłowny wynik
  `\d` i **NIE dodajesz żadnej migracji**. Status pozycji:
  `ZROBIONE_WG_DoD (weryfikacja — zamknięte przez 20261120, zero kodu ode mnie)`.
  **To jest wynik oczekiwany.**
- **NIE ISTNIEJE, a producent DDL jest w repo** (klasa `ONLY_DEAD` pominięta
  przez `20261120`) → migracja addytywna `20261130_superadmin_day22_scheduled_events.sql`,
  przepisany DDL producenta, `CREATE TABLE IF NOT EXISTS` + indeksy, pełny dowód
  idempotencji (3 przebiegi).
- **NIE ISTNIEJE i żaden plik jej nie tworzy** (klasa `NO_MIGRATION`) → **STOP**.
  `DEC-116` mówi wprost: klasa `NO_MIGRATION` jest **celowo poza zakresem**,
  bo to decyzja produktowa per moduł. Opisujesz i zostawiasz.

**Przy okazji, tym samym zapytaniem, rozstrzygasz to samo dla pięciu tabel
audytowych** — wynik wchodzi do tabeli `A.1` (kolumna „czy jest na świeżej
bazie"). Jeżeli którakolwiek z nich nie powstaje na świeżej bazie, jest to
**znalezisko o randze `TRI-OBS-18`** i wpisujesz je jako takie: audyt, którego
tabela nie istnieje w nowym środowisku, jest audytem, który cicho nie działa.

**DoD `§D`:** dosłowny wynik `to_regclass` dla sześciu relacji; rozstrzygnięcie
z trzech powyższych; migracja **tylko** przy wyniku drugim, z pełnym dowodem.

---

## §E. SPÓJNOŚĆ ODCZYTU AUDYTU

### E.1 — Powierzchnia tenantowa widzi wpisy z `§B`

Dla **każdej** trasy z `§B` dowodzisz **HTTP-em, nie SQL-em**, że wpis jest
widoczny:

```
1. wykonaj mutację przez supertest na realnym routerze i realnym PG
2. GET /api/admin/audit-logs        → wiersz JEST na liście, z poprawnym action_type i resource_type
3. GET /api/admin/audit-logs/stats  → licznik wzrósł o 1
4. GET /api/admin/audit-logs/export → wiersz JEST w CSV
5. token org B → wiersza NIE MA na żadnej z trzech
```

Punkt 5 jest obowiązkowy dla każdej trasy — bez niego `E.1` jest `CZĘŚCIOWO`.

**Uwaga na wyścig:** globalny middleware jest fire-and-forget (§1.7 pkt 5).
Wpisy z `§B` idą przez pisarzy semantycznych, którzy **są `await`-owani**, więc
tu wyścigu nie powinno być — ale jeżeli go zobaczysz, **opisz go**, nie maskuj
`sleep`-em bez komentarza.

### E.2 — Powierzchnia superadmina — ustalenie i decyzja

**Stan zastany do potwierdzenia:** `SuperAdminController.getAdminAuditLogs`
(~`:4638`) czyta **wyłącznie** `admin_audit_logs`:

```sql
SELECT l.*, u.email, u.first_name, u.last_name
  FROM admin_audit_logs l LEFT JOIN users u ON l.admin_id = u.id
 WHERE 1=1 ...
```

Skutek, który musisz zmierzyć i wpisać: **wpisy z `B.1` (droga fail-closed →
`audit_events`) będą widoczne na ekranie tenantowym `/api/admin/audit-logs`,
ale NIEWIDOCZNE na ekranie superadmina `/api/superadmin/admin/audit-logs`.**
Ten sam problem dotyczy już dziś nogi IAM (`role_change_audit_events`).

**Zmierz to testem, nie rozumowaniem**: mutacja z `B.1` → obie powierzchnie →
tabela `powierzchnia × widoczny?`.

**Dwie dopuszczalne odpowiedzi:**

- **(A) Rozszerzenie serwerowe** — dokładasz do `SuperAdminController` odczyt
  z pozostałych źródeł. **Trzy twarde warunki:**
  1. **Semantyka platformowa zostaje platformowa.** Ta powierzchnia jest
     cross-tenant **z założenia** (superadmin widzi wszystkie organizacje).
     **Nie wolno Ci dołożyć filtra org** ani go usunąć — zmieniłbyś kontrakt
     ekranu bez decyzji. Wiersze z innych źródeł dokładasz w **tej samej**
     semantyce zasięgu.
  2. **Tryb `degraded` zostaje.** Istniejąca obsługa braku tabeli
     (`degraded` + `degradedReason`, ~`:4694-4706`) jest **wzorcem uczciwości** —
     nowe źródła dostają taką samą obsługę, każde niezależnie. Awaria jednego
     źródła **nie może** wyzerować listy.
  3. **Kontrakt odpowiedzi bez zmian łamiących.** Front (`src/services/api.ts`
     `:12268`, `:14034`, `:14864`) konsumuje istniejący kształt. Pola dokładasz
     **addytywnie**; `risk_score`/`risk_level` z nowych źródeł = `null` (Z15),
     **nie fabrykujesz**. Jeżeli front tego nie zniesie — to jest `(B)`.
- **(B) STOP + kontrakt dla robotnika frontowego** — jeżeli rozszerzenie
  wymagałoby zmiany kształtu odpowiedzi albo zmiany w `src/`. Wtedy w raporcie:
  dokładna tabela kontraktu (metoda, URL, body, odpowiedź, kody błędów), lista
  plików frontu do dotknięcia i **jedno zdanie, co użytkownik traci do czasu
  naprawy**.

**Obie odpowiedzi są dobre.** Zła jest tylko trzecia: dołożenie źródeł bez
sprawdzenia frontu i bez trybu `degraded`.

**DoD `§E`:** tabela `trasa × powierzchnia × widoczny?` dla każdej trasy z `§B`;
punkt 5 (`negatyw tenanta`) dla `E.1`; rozstrzygnięcie `E.2` w postaci `(A)`
z testami albo `(B)` z pełnym kontraktem.

---

## §T. TESTY — pozycja własna, nie dodatek

### T.1 — Pokrycie nowych i zmienionych powierzchni

Nowe pliki: `server/src/routes/__tests__/day22.*.test.ts` (wzorzec i sposób
włączania: `day15.adminP32.auditProjection.pg.test.ts` — `describe.skipIf(!enabled)`
z czterema zmiennymi środowiskowymi) oraz — dla scenariuszy wielotrasowych —
`tests/integration/admin/*day22*.realdb.test.ts` (**`git add -f`**).
**Konfiguracji vitest NIE DOTYKASZ (Z18).**

| Powierzchnia                          | Poz.  | Minimum                                                                                                    |
| ------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------- |
| break-glass `POST`/`DELETE /sessions` | B.1   | happy + wiersz audytu · awaria audytu → `503` · walidacja `400` · negatyw tenanta · widoczność w projekcji |
| service accounts `POST`/`DELETE`      | B.1   | jw. + **zero sekretów w `metadata`** (asercja na treści wiersza)                                           |
| bulk (3 trasy)                        | B.1   | jw. + `metadata` zawiera liczbę dotkniętych podmiotów, a nie tylko „ok"                                    |
| access-control / domains              | B.2   | happy + `persisted` · `resource_type !== action_type` · negatyw tenanta · widoczność w projekcji           |
| eksperyment potrójnego zapisu         | B.3   | jedna mutacja → liczby wierszy w pięciu tabelach; przy `(B)`: **brak duplikatów** w projekcji              |
| negatywy egzekwowania                 | C.1   | 5 scenariuszy z tabeli × każda trasa z `§B`; **asercja przez brak zapisów**                                |
| brak wiersza-widma przy odmowie       | C.2   | odrzucona mutacja → zero nowych wierszy w pięciu tabelach                                                  |
| dowód mutacyjny                       | C.3   | 2 trasy × czerwony przed przywróceniem kodu                                                                |
| świeża baza                           | D     | `to_regclass` dla sześciu relacji (nie test — dowód w raporcie)                                            |
| spójność odczytu                      | E.1/2 | obie powierzchnie × każda trasa z `§B` × widoczny/niewidoczny                                              |
| regresja dnia 15                      | —     | `adminP32.auditProjection.pg.test.ts` i `day15.*.pg.test.ts` **zielone BEZ MODYFIKACJI PLIKÓW**            |
| regresja DEC-105 / Z16                | —     | pakiety zawieszenia i `effectiveAccessService` **zielone** — dowód, że ich nie ruszyłeś                    |

### T.2 — Negatywy tenanta jako osobny, jawny pakiet

Jeden plik z negatywami tenanta dla **wszystkich** nowych i zmienionych tras.
Obcy `organizationId` nigdy nie dostaje `200`. `organizationId` z body/query
**jest ignorowany** — test to udowadnia (wysyłasz obcą organizację w body
i dostajesz `404`/`403`, nie `200`), **oraz** sprawdza, że powstały wiersz audytu
ma organizację z **tokenu**.

### T.3 — Zakaz osłabiania testów zastanych

Nie osłabiasz asercji istniejących wcześniej. Jeżeli test wymaga zmiany, bo
rozszerzyłeś kontrakt **addytywnie** (nowe pole) i asercja jest `toEqual` całego
obiektu — **dopisujesz pole**, nie zmieniasz wartości istniejących; **każdy taki
przypadek to obowiązkowy wpis „przed/po" w raporcie**. Zamiana `toBe` na
`not.toBe` bez wpisu = podstawa odrzucenia (`DEC-108`, P1 dnia 19).

**Dwa pakiety mają pozostać BITOWO NIEZMIENIONE:**
`server/src/routes/__tests__/adminP32.auditProjection.pg.test.ts` i
`server/src/routes/__tests__/day15.adminP32.auditProjection.pg.test.ts`.
Jeżeli Twoja zmiana je psuje — psuje projekcję, i to jest STOP, nie edycja testu.

### T.4 — i18n

Tylko dla napisów wychodzących z Twojego API (komunikaty i kody błędów, np.
`AUDIT_UNAVAILABLE`). Parytet PL+EN w tym samym commicie. **Zero nowych kluczy
„na zapas" pod nieistniejący front.**

---

## §R. REJESTR I DOWODY

### R.1 — `MODULE_ACCEPTANCE.md` 14_ADMIN do stanu faktycznego

Podnosisz **wyłącznie** o to, co faktycznie działa i ma dowód (commit + test +
przebieg na realnym PG). **Nie deklarujesz gotowości, której nie ma. Nie
zmieniasz statusów cudzych pozycji. Nie ustawiasz `Owner verdict`** — to należy
do właściciela. Jeśli pozycja skończyła się `CZĘŚCIOWO`/`STOP`, w rejestrze ma
być `CZĘŚCIOWO`/`STOP`, nie „done".

**★ `TRI-MUST-08` oznaczasz jako w pełni domknięte TYLKO wtedy, gdy potrafisz
podać liczbę: ile mutacji destrukcyjnych/uprawnieniowych ma pisarza semantycznego
widzianego przez projekcję, z mianownikiem.** Jeżeli liczba to np. `27/83` —
piszesz `27/83` i status `CZĘŚCIOWO`. Dzień 15 napisał `20/83` i dostał
`SUPERVISOR_ACCEPT`. **Zawyżenie kosztuje więcej niż uczciwe `CZĘŚCIOWO`.**

**Wzorzec pozytywny:** odbiór dnia 19 pochwalił diff, który dodawał **dokładnie
jeden token: `CZĘŚCIOWO`**.

### R.2 — Komplet dowodów

Wyniki testów (z rozbiciem zastane/wprowadzone — Z23), **dowód celu połączenia
(Z19)**, trzy tabele inwentarza (`A.1`, `A.2`, `A.3`), tabela eksperymentu
potrójnego zapisu (`B.3`), tabela negatywów (`C.1`), dowody mutacyjne (`C.3`),
wynik `to_regclass` (`D`), tabela spójności odczytu (`E`), **dowody osiągalności
(Z20) dla każdej pozycji — z ogniwem „noga projekcji"**, tabela kontraktów dla
frontu, dowód idempotencji migracji (jeżeli powstała), dowód sprzątnięcia
kontenera **i wolumenów**. Bez kompletu — pozycja `CZĘŚCIOWO`.

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~90 min, NIE pomijasz) — ★ KOLEJNOŚĆ WG Z19

1. `git fetch --all --prune`; weryfikacja markera **komendą `merge-base
--is-ancestor` z §0.1 pkt 1** (SHA markera jest tam, w jednym miejscu — nie
   przepisujesz go z pamięci). Brak → STOP i koniec dyżuru. Rozejście marker→tip
   → wpis, start z markera (`DEC-95`), **bez rebase**.

2. **★ NAJPIERW KONTENER I MIGRACJE, DOPIERO POTEM JAKIKOLWIEK POMIAR** (Z19).
   Gałąź + worktree (§0.1 pkt 5), symlink `node_modules` (`DEC-86`, tylko odczyt),
   potem:

   ```bash
   docker run -d --name cx-day22-pg \
     --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
     -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day22 \
     -p 5481:5432 pgvector/pgvector:pg16
   export DATABASE_URL="postgres://postgres:cx@localhost:5481/cx_day22"
   # DOWÓD CELU POŁĄCZENIA — do raportu, dosłownie:
   docker exec cx-day22-pg psql -U postgres -d cx_day22 -c "SELECT current_database(), inet_server_port();"
   NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict      # przebieg 1 — pełne migracje projektu
   NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict      # przebieg 2 → Applying migrations: 0
   NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry # dry → Pending migrations: 0
   ```

   Dopiero teraz wolno uruchomić cokolwiek, co dotyka bazy — zawsze z jawnym
   `DATABASE_URL`, `DB_TYPE=postgres`, `NODE_ENV=test`, `RUN_DB_TESTS=1`,
   `MOCK_DB=false` **w tej samej linii**.

3. **Weryfikacja stanu wejściowego** (§0.1 pkt 3) i materiałów wiążących
   (§0.1 pkt 4). Brak dnia 15 albo brak `DEC-105` = STOP.

4. **★ `§D` na świeżo zmigrowanej bazie** — `to_regclass` dla sześciu relacji.
   Robisz to **tutaj**, bo wynik zasila tabelę `A.1` i przesądza, czy w ogóle
   potrzebujesz migracji.

5. **Numer migracji — WEWNĄTRZ PRZEDZIAŁU `20261130`–`20261139`** (§0.3 pkt 2),
   **tylko jeżeli pkt 4 wykazał brak**:

   ```bash
   ls server/migrations | grep -E '^202611[0-9]{2}' | sort | tail -5
   ls server/migrations | grep '^20261130'        # MUSI być puste
   ```

6. **Weryfikacja mapy z §1.5 i pułapek z §1.7** — każdą rozbieżność do „Korekt".
   Obowiązkowo:

   ```bash
   grep -n "readTenantAdminAuditProjection\|normalizeUnifiedAuditEvent\|normalizeIamAuditEvent" server/src/routes/adminP32.routes.ts
   grep -n "FROM audit_events\|FROM role_change_audit_events" server/src/routes/adminP32.routes.ts
   grep -n "risk_score: null" server/src/routes/adminP32.routes.ts
   grep -n "async function getAdminActor" -A 35 server/src/routes/adminP32.routes.ts
   grep -n "statusCode >= 200\|!organizationId || !userId" server/src/middleware/auditLog.middleware.ts
   grep -n "getActivityService()\|getAuditEventsService()\|getAuditService()" server/src/middleware/auditLog.middleware.ts
   grep -n "INSERT INTO activity_logs" server/src/services/ActivityService.ts
   grep -n "INSERT INTO audit_events" server/src/services/AuditEventsService.ts
   grep -n "INSERT INTO audit_log" server/src/services/auditService.ts
   grep -n "INSERT INTO admin_audit_logs" -B 20 server/src/services/adminAuditService.ts
   grep -n "FROM admin_audit_logs" server/src/controllers/SuperAdminController.ts
   grep -rln "requireAudit" server/src/routes | grep -v __tests__
   grep -rn "organizationSuspensionGuard" server/src/routes/admin-bulk.routes.ts   # ← ta linia jest NIETYKALNA
   ```

7. **★ BASELINE TESTÓW — PRZED PIERWSZYM COMMITEM** (§0.4a pkt 6), z jawnym
   `DATABASE_URL` tam, gdzie dotyczy. Wyniki (liczby PASS/FAIL **per plik**) do
   raportu. **Czerwone testy zastane opisujesz, nie „naprawiasz".** Bez tego
   baseline'u nie masz jak spełnić Z23.

8. Założenie raportu (§9) i wpisanie wyników 1–7.

### Blok 1 — inwentarz (A.1 → A.2 → A.3), commit `docs(admin)`

**Najważniejsza pozycja dyżuru pod względem trwałości — zaczynasz od niej,
zawsze.** Kod z `§B` się zestarzeje; inwentarz z `§A` będzie bazą dla dyżuru 23
i dla decyzji właściciela o zakresie. **Jeżeli dyżur skończy się po Bloku 1
z rzetelnym inwentarzem — to jest dobry dyżur.**

### Blok 2 — pisarze fail-closed (B.1) + ich negatywy (C.1 dla tych tras)

Ranking 1–3, siedem tras. **Robisz `C.1` od razu po każdej trasie**, nie na
końcu — negatyw napisany razem z trasą jest testem, negatyw dopisany na końcu
jest formalnością.

### Blok 3 — rozstrzygnięcie nóg projekcji (B.3) + spójność odczytu (E.1)

`B.3` jest **eksperymentem, nie budową** — tanie i o dużej wartości
rozstrzygającej. `E.1` domyka `B.1` dowodem HTTP.

### Blok 4 — brak wiersza-widma i dowody mutacyjne (C.2, C.3)

Tanie i samodzielne. **Jeśli czasu mało, rób `C.2`/`C.3` PRZED `B.2`** —
dowód, że odmowa jest odmową, jest wart więcej niż dwa kolejne pisarze.

### Blok 5 — pozycje warunkowe (B.2, E.2)

`B.2` tylko przy domkniętym `B.1`. `E.2` — najpierw **pomiar** (który
i tak jest obowiązkowy), potem decyzja `(A)`/`(B)`. **`(B)` z dobrym kontraktem
jest pełnowartościowym produktem**, nie porażką.

### Blok 6 — domknięcie (obowiązkowo, ~90 min)

1. `§T` (negatywy tenanta z dowodem mutacyjnym), `R.1`, `R.2` dla tego,
   co faktycznie zbudowałeś.
2. **Pomiar zasięgu (§0.4a) z rozbiciem zastane/wprowadzone (Z23).**
3. **Dziesięć dowodów** (do raportu):
   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "tests/setup|tests/helpers|tests/__mocks__|vitest.*config"   # PUSTY (Z18)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^src/"                                                     # PUSTY (front poza zakresem)
   git diff codex/m03-admin-20260824...HEAD -- server/src/services/organizationSuspensionGuard.ts                             # PUSTY (DEC-105 — KRYTYCZNE)
   git diff codex/m03-admin-20260824...HEAD -- server/src/middleware/auth.middleware.ts server/src/middleware/apiKeyAuth.middleware.ts server/src/realtime server/src/gateways   # PUSTY (DEC-105)
   git diff codex/m03-admin-20260824...HEAD -- server/src/services/effectiveAccessService.ts                                  # PUSTY (Z16 — KRYTYCZNE)
   git diff codex/m03-admin-20260824...HEAD -- server/src/middleware/auditLog.middleware.ts server/src/middleware/requireAudit.middleware.ts server/src/services/adminAuditService.ts   # PUSTY (wołasz, nie zmieniasz)
   git diff codex/m03-admin-20260824...HEAD -- server/src/routes/__tests__/adminP32.auditProjection.pg.test.ts server/src/routes/__tests__/day15.adminP32.auditProjection.pg.test.ts    # PUSTY (T.3)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^server/migrations/"                                        # PUSTY albo tylko 2026113x_superadmin_day22_*
   git diff codex/m03-admin-20260824...HEAD | grep -E "^\+.*(defaultValue|useFeatureFlags|process.env.ENABLE_)"                # PUSTY (zero flag, Z10)
   docker ps -a --filter name=cx-day22-pg ; docker volume ls | grep -i cx-day22                                                # PUSTO (sprzątnięte)
   ```
4. **Dowody osiągalności (Z20)** dla każdej pozycji — zebrane w jednej sekcji,
   z obowiązkowym ogniwem „noga projekcji".
5. **Sprzątanie kontenera I wolumenów** (obowiązkowe):
   ```bash
   docker rm -f cx-day22-pg && docker volume ls -q | grep -i cx-day22 | xargs -r docker volume rm && docker volume prune -f
   ```

### Zasada nadrzędna kolejności

Lepiej **domknięte** `A` + `B.1` + `C` niż pięć obszarów „prawie". Każda pozycja
albo spełnia DoD, albo jest uczciwie oznaczona (`STOP` / `BRAK_API` /
`CZĘŚCIOWO` / `NIE_ZACZĘTE`).

**Jeżeli po Blokach 1 i 2 nie masz już czasu — to jest DOBRY dyżur.** Rzetelny
inwentarz i siedem najgroźniejszych mutacji z audytem fail-closed i negatywami
są warte więcej niż pięć obszarów bez dowodów.

---

## 9. RAPORT — jedyny dokument, który tworzysz

Ścieżka, dokładnie jedna:

```
docs/program/waves/WAVE_03_ACCEPTANCE/SUPERADMIN_DAY22_REPORT_20260826.md
```

Nie tworzysz drugiego pliku nigdzie indziej (Z12).

### 9.1. Szablon

```markdown
# Superadmin dzień 22 — raport dyżuru <data>

Baza: codex/m03-admin-20260824 @ <SHA tipa>
Marker: 609e9235e0 — POTWIERDZONY / BRAK
Gałąź: codex/superadmin-day22-<data>
Worktree: /private/tmp/consultify-superadmin-day22
Port PG: 5481 · kontener cx-day22-pg usunięty: TAK/NIE · wolumeny usunięte: TAK/NIE

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

<czy dotykałeś /Users/piotrwisniewski/Developer/Consultify; symlink node_modules — tylko odczyt>

## Oświadczenie o obszarach nietykalnych (DEC-105 / Z16)

<dosłowne wyniki git diff dla organizationSuspensionGuard, ośmiu frontów,
effectiveAccessService, auditLog.middleware, requireAudit.middleware, adminAuditService>

## ★ Dowód celu połączenia (Z19 / DEC-96)

<dosłowny wynik: SELECT current_database(), inet_server_port();>
<lista przebiegów testów DB z jawnym DATABASE_URL w tej samej linii>

## Warunki wstępne — tabela

<marker · dzień 15 scalony (trzecia noga obecna) · DEC-105 scalony (strażnik obecny) ·
rdzeń (c) obecny · uczciwość (d) nienaruszona · rejestr decyzji · numer migracji
w przedziale 20261130-20261139 (ls|grep) · migracje 1/2/dry · BASELINE testów przed>

## Pozycje — tabela zbiorcza

| Pozycja | Status (ZROBIONE_WG_DoD / CZĘŚCIOWO / STOP / BRAK_API / NIE_ZACZĘTE) | Commit | Dowód |
| A.1 inwentarz pięciu tabel | | | |
| A.2 pełny inwentarz pisarzy | | | |
| A.3 ranking + decyzja drogi | | | |
| B.1 pisarze fail-closed (ranking 1-3) | | | |
| B.2 pisarze semantyczni (ranking 4-5) | | | |
| B.3 rozstrzygnięcie nóg 4/5 | | | |
| C.1 negatywy egzekwowania | | | |
| C.2 brak wiersza-widma + konwencja | | | |
| C.3 dowody mutacyjne | | | |
| D scheduled_events / świeża baza | | | |
| E.1 spójność odczytu tenantowego | | | |
| E.2 powierzchnia superadmina | | | |
| T testy | | | |
| R.1 rejestr 14_ADMIN | | | |

## ★ A.1 — INWENTARZ PIĘCIU TABEL AUDYTOWYCH

| Tabela | Producent DDL | Na świeżej bazie? (\d) | Pisarz(e) | Tryb awarii | Kol. org | Kol. czasu | W projekcji? | Inny czytelnik |

## ★ A.2 — PEŁNY INWENTARZ PISARZY (produkt obowiązkowy)

| Plik:linia | Metoda + ścieżka | Klasa operacji | Pisarz | Tabela | Klasyfikacja | Pokrycie generyczne |

Sumy: pisarze semantyczni <X>/<Y> · pokrycie generyczne <Z>/<Y>
Potwierdzenie/obalenie pomiaru 83/20/63: <...>
Trasy destrukcyjne/uprawnieniowe SPOZA modułu Admin: <tabela>

## ★ A.3 — RANKING DOTKLIWOŚCI I DECYZJA DROGI

| # | Plik | Szkoda z niewykrytego nadużycia | Droga (i)/(ii) | Uzasadnienie | W zakresie tego dyżuru? |

## ★ DOWODY OSIĄGALNOŚCI (Z20) — obowiązkowe dla KAŻDEJ pozycji

| Pozycja | Realne wejście (metoda + URL) | Montaż (plik:linia) | Router (plik:linia) | Pisarz (plik:linia) | Zapis (tabela.kolumna) | Noga projekcji (plik:linia) |

## ★ TESTY DOMYŚLNEGO OKABLOWANIA (Z21 / DEC-107)

| Pozycja | Co wołane bez wstrzykiwania | Plik testu | Wynik |

## Tabele werdyktów

### B.1 — pisarze fail-closed | Trasa | Mutacja potwierdzona? | Wiersz audytu | resource_type != action_type? | 503 przy awarii audytu? | Decyzja pkt 3 (a/b) |

### B.3 — eksperyment potrójnego zapisu | Tabela | Wierszy po 1 mutacji | id | To samo zdarzenie? | Rozstrzygnięcie (A/B/C) |

### C.1 — negatywy | Trasa | Scenariusz | Kod | Wierszy zmienionych | Wynik |

### C.2 — wiersz-widmo | Trasa | Odmowa (kod) | Nowych wierszy w 5 tabelach | Konwencja ustalona |

### C.3 — dowody mutacyjne | Trasa | Co zneutralizowano | Wynik testu (musi być czerwony) | Kod przywrócony? |

### D — świeża baza | Relacja | to_regclass | Producent | Rozstrzygnięcie |

### E — spójność odczytu | Trasa z §B | /api/admin/audit-logs | /stats | /export | negatyw org B | /api/superadmin/admin/audit-logs |

## ★ KONTRAKT DLA FRONTU (produkt §1.6)

| Trasa | Metoda | Body | Odpowiedź | Kody błędów | Front skonsumuje bez zmian? |
<wszystkie nowe i zmienione trasy + pozycje „front do zbudowania" + co użytkownik traci do czasu naprawy>

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy

## Znaleziska (NIE naprawiane przeze mnie)

<m.in.: nieaktualny komentarz w adminAuditService.getStats; resolveLog bez zakresu org;
weryfikacja domeny w pamięci procesu; LIMIT 1000 przed paginacją; brak audytu odmowy>

## Korekty wobec instrukcji

<w tym każda rozbieżność wobec §1.5 i §1.7 — numery linii, skład „pięciu tabel", pomiar 83/20/63>

## Migracje

<numer, dowód ls|grep w przedziale 20261130-20261139, addytywność, brak FK,
idempotencja (3 przebiegi), kompatybilność wstecz, MIGRATION_PREPARED —
ALBO jawne „żadna migracja nie była potrzebna, bo <dowód>">

## Testy

### Baseline (przed pierwszym commitem)

### Wynik końcowy — ★ PEŁNY ZAKRES §0.4a, BEZ ZAWĘŻANIA (Z23)

Zakres §0.4a: <X>/<Y> PASS
czerwone ZASTANE: <lista + liczby>
czerwone WPROWADZONE: <lista + SHA commitu, który je zapalił> ← jeśli PUSTE, napisz to wprost

### Zmiany w testach istniejących — przed/po (T.3)

### Dziesięć dowodów Bloku 6

## ★ TRI-MUST-08 — STAN W LICZBACH

Przed dyżurem: <X>/83 pisarzy semantycznych widzianych przez projekcję (<...>%)
Po dyżurze: <Y>/83 (<...>%)
Tabele w projekcji: <3 albo 4/5> — uzasadnienie z B.3
Werdykt AC-005: PROVEN / NOT PROVEN / PARTIALLY PROVEN — z uzasadnieniem

## Licznik

<pozycji w zakresie / domknięte / częściowe / STOP / niezaczęte>

## Czego NIE zrobiłem i dlaczego
```

### 9.2. Zasady raportowania

1. **Piszesz stan faktyczny, nie intencje.** „Zaimplementowałem" bez testu na
   realnym routerze = `CZĘŚCIOWO`. Bez dowodu osiągalności = `NIE_ZACZĘTE`.
2. **Każda pozycja ma commit SHA.** Brak commitu = `NIE_ZACZĘTE`.
3. **Liczby, nie przymiotniki.** „lepsze pokrycie" → `20/83 → 27/83`.
   „widoczne w audycie" → `GET /api/admin/audit-logs zwraca wiersz id=…`.
4. **Statusy tylko z listy**: `ZROBIONE_WG_DoD` · `CZĘŚCIOWO` · `STOP` ·
   `BRAK_API` · `NIE_ZACZĘTE`.
5. **Nie zawyżasz.** Dzień 16 zawyżył `I.1`, dzień 19 zawyżył liczbę testów —
   oba odbiory to wyłapały. **Dzień 15 NIE zawyżył i dostał `SUPERVISOR_ACCEPT`
   mimo `A.3 NIE_ZACZĘTE`.** To jest wzorzec, który kopiujesz.
6. **Nie piszesz „gotowe do pokazania właścicielowi"** — piszesz „gotowe do
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
npx vitest run server/src/routes/__tests__/<plik>.test.ts

# test celowany Z bazą — ZAWSZE tak (Z19), env W TEJ SAMEJ LINII, CZTERY zmienne
DATABASE_URL="postgres://postgres:cx@localhost:5481/cx_day22" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
npx vitest run server/src/routes/__tests__/day22.breakGlassAudit.pg.test.ts

# numeracja migracji — PRZED KAŻDYM NOWYM PLIKIEM, TYLKO W PRZEDZIALE 20261130-20261139
ls server/migrations | grep -E '^202611[0-9]{2}' | sort | tail -5
ls server/migrations | grep '^20261130'        # MUSI być puste

# obecność relacji na ŚWIEŻEJ bazie (§D, §A.1)
docker exec cx-day22-pg psql -U postgres -d cx_day22 -c \
  "SELECT to_regclass('public.scheduled_events'), to_regclass('public.admin_audit_logs'),
          to_regclass('public.audit_events'), to_regclass('public.role_change_audit_events'),
          to_regclass('public.activity_logs'), to_regclass('public.audit_log');"

# kontener — jednorazowy, dowód (1)(2)(3), sprzątanie kontenera I wolumenów
docker run -d --name cx-day22-pg --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=2g \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day22 -p 5481:5432 pgvector/pgvector:pg16
docker exec cx-day22-pg psql -U postgres -d cx_day22 -c "SELECT current_database(), inet_server_port();"
export DATABASE_URL="postgres://postgres:cx@localhost:5481/cx_day22"
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry
docker rm -f cx-day22-pg && docker volume ls -q | grep -i cx-day22 | xargs -r docker volume rm && docker volume prune -f

# nowe pliki w tests/ wymagają -f
git add -f tests/integration/admin/day22-audit-enforcement.realdb.test.ts

# porównanie do bazy (NIE do HEAD~1)
git diff --name-only codex/m03-admin-20260824...HEAD
```

### 10.2. Dwanaście rzeczy, które najłatwiej zepsuć

1. **Uruchomienie testu DB bez czterech zmiennych w tej samej linii**
   (`DATABASE_URL`, `DB_TYPE`, `RUN_DB_TESTS=1`, `MOCK_DB=false`) → mock DB albo
   `describe.skipIf` cichy skip, wynik bez wartości (Z19; dzień 17 na tym poległ).
2. **Numer migracji spoza przedziału `20261130`–`20261139`** → cicha kolizja
   w porządku alfabetycznym (dzień 18, `DEC-107`). `20261121-29` są zarezerwowane
   i **nie widać ich w `ls`**.
3. **Dotknięcie `organizationSuspensionGuard.ts` albo któregoś z ośmiu frontów**
   → `DEC-105`, odrzucenie dyżuru. To jest po trzech audytach.
4. **Dotknięcie `auditLog.middleware.ts` / `requireAudit.middleware.ts` /
   `adminAuditService.ts`** → to globalne pisarze CAŁEJ aplikacji. Wołasz, nie
   zmieniasz. „Dodam tylko `await`" = STOP.
5. **Dołożenie nóg 4/5 projekcji bez eksperymentu** → potrojenie wierszy na
   ekranie audytu, podane jako domknięcie `TRI-MUST-08`.
6. **Ogłoszenie `83/83` na podstawie globalnego middleware** → zawyżenie.
   Middleware ma cztery udokumentowane dziury (§A.2).
7. **Wpis audytu przed potwierdzeniem mutacji** → Z22 w najgorszej postaci:
   dokument dowodowy, który kłamie.
8. **Ciche `503` z fail-closed, sugerujące że nic się nie stało**, podczas gdy
   mutacja przeszła → odwrotność Z22, równie szkodliwa (§B.1 pkt 3).
9. **Test sprawdzający wiersz natychmiast po odpowiedzi HTTP** → wyścig
   z fire-and-forget, wynik losowy podany jako dowód (§1.7 pkt 5).
10. **`resource_type === action_type`** → `logAction` domyślnie tak robi.
    Test, który tego nie sprawdza, przepuszcza bezużyteczny audyt (§1.7 pkt 1).
11. **Deklaracja „N/N PASS" na wybranym podzbiorze** → Z23, zawyżenie
    (dzień 19, `DEC-108`).
12. **Wejście we `src/`** → Z17 + złamanie podziału FRONT/TYŁ i reguły 7
    („właściciel nigdy nie jest pierwszym testerem wizualnym").

### 10.3. Czego NIE robisz, choć „aż się prosi"

- nie dotykasz `src/` — **ani jednej linii**, nawet żeby pokazać nową kolumnę;
- nie „wzmacniasz" strażnika zawieszenia i nie dokładasz mu audytu (`DEC-105`);
- nie dodajesz cache ani niczego w `effectiveAccessService` (Z16);
- nie naprawiasz `isSqliteOnlyMigration` ani klasy `NO_MIGRATION` (`DEC-116`);
- nie naprawiasz `LIMIT 1000` przed paginacją (zastany dług dnia 15);
- nie fabrykujesz `risk_score` dla nowych źródeł — `null` jest odpowiedzią;
- nie budujesz audytu odmowy bez decyzji (`C.2` pkt 3);
- nie dopisujesz kolumn do `api_logs` i nie improwizujesz semantyki kosztów;
- nie zmieniasz `InitiativeController.ts`, `AuthController.ts` ani żadnego
  kontrolera spoza imiennej licencji `§E.2`;
- nie robisz `rebase` na nowszy tip m03 (`DEC-95` — robi to nadzorca);
- nie zmieniasz plików testowych dnia 15 (`T.3`).

---

## 11. NA KONIEC

`TRI-MUST-08` nie jest luką w kodzie. Jest luką **w dowodzie**.

Aplikacja ma **pięć** tabel audytowych, **trzy** różne mechanizmy zapisu i
**dwie** powierzchnie odczytu, które widzą różne rzeczy. Przy tym bogactwie
mechanizmów **63 z 83 mutacji administracyjnych nie zostawia wpisu, który
ktokolwiek mógłby użyć w dochodzeniu** — a najgroźniejsze z nich (dostęp
awaryjny, poświadczenia maszynowe, masowa zmiana ról) nie zostawiają go wcale.

Trzy rzeczy decydują o odbiorze:

1. **Inwentarz, który mówi prawdę — z dwiema liczbami, nie jedną.** Pokrycie
   semantyczne i pokrycie generyczne to nie to samo, a różnica między nimi jest
   całą treścią `TRI-MUST-08`. Inwentarz bez tego rozróżnienia jest zawyżeniem
   podanym jako dokument.
2. **Siedem najgroźniejszych mutacji z audytem, który wytrzyma dochodzenie.**
   Nie „dodałem `logAction`", tylko _„`DELETE /service-accounts/:id` zapisuje
   `resource_type=service_account`, `resource_id`, `scopes`, aktora z tokenu
   i powód; przy awarii audytu zwraca `503`; wiersz jest widoczny w
   `GET /api/admin/audit-logs`; token obcej organizacji nie widzi go wcale"_.
3. **Odmowa udowodniona brakiem zapisów, nie kodem statusu.** To jest wzorzec,
   który `DEC-105` wypracował przy trzech audytach adwersaryjnych. Kopiujesz go.

Dzień 15 dostał `SUPERVISOR_ACCEPT` **z pozycją `A.3` oznaczoną `NIE_ZACZĘTE`
i kontraktem `AC-005` oznaczonym `NOT PROVEN`** — bo policzył uczciwie i nie
udawał. Ty kończysz jego pracę na tych samych zasadach.

**Zero zmian w `src/`. Zero dotknięcia strażnika zawieszenia. Zero dotknięcia
modelu uprawnień. Zero flag. Zero atrap — a wpis audytu, który kłamie, jest
najgorszą atrapą, jaką można w tym systemie zbudować.**
