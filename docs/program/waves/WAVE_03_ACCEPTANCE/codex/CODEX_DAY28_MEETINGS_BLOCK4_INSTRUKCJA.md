# INSTRUKCJA DYŻURU nr 28 — Codex — „Meetings blok 4: domknięcie długu dowodowego C.3/C.2/D/E/F + strefa czasowa `recurrenceId`"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–27. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-27.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Ten dyżur jest **czwartym blokiem modułu Meetings** i jest bezpośrednią
kontynuacją bloku 3 (dyżur nr 24), scalonego decyzją
`DEC-2026-08-26-134` w `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md:185`.

Ta decyzja kończy się zdaniem, które jest Twoim zleceniem:

> „**FIX-y C.3/C.2/D/E-F SPAKOWANE do kontynuacji dyżurowej Meetings blok 4**
> (ekonomia: nie mnożymy wewnętrznych partii; walidacja jawnej strefy
> `recurrenceId` → `400 INVALID_OCCURRENCE` jako preferowane rozstrzygnięcie C.3)."

**Blok 3 dowiózł MECHANIKĘ. Nie dowiózł DOWODÓW.** Pięć pozycji weszło jako
`CZĘŚCIOWO`, a jedna — najgroźniejsza — weszła z **raportem, który wyprzedził
dowód**: raport dnia 24 zadeklarował „decyzja C.4(b) test+errata", a w repo nie
ma ani tego testu, ani tej erraty. Odbiorca musiał sam wykonać brakujący pomiar
i znalazł P1. **Twoim produktem jest zamknięcie tej luki i pozostałych czterech
— nic poza tym.**

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

**Budujesz WYŁĄCZNIE mechanikę tylną modułu Meetings. Front jest poza zakresem
w całości. Moduł zostaje ZAMKNIĘTY (`closed`).**

1. **★ CAŁY KATALOG `src/` JEST POZA ZAKRESEM DO ZAPISU.** Wolno Ci go
   **czytać i grepować** (to jest wręcz wymagane — §BLOK 0 pkt 8), ale **nie
   zmieniasz w nim ani jednego znaku**, także „jednej linii importu", także po
   to, żeby „tylko pokazać nowe pole". Jedyny wyjątek: **żaden**.
2. **★ MODUŁ ZOSTAJE `closed`.** `src/utils/betaAccess.ts:53` ma
   `MODULE_MEETING: 'closed'`. Zmiana tej wartości to **odrzucenie całego
   dyżuru**, nie STOP. Otwarcie modułu jest bramką właściciela, nie Twoją.
3. **★ NIE DOPISUJESZ FUNKCJI, KTÓRYCH NIKT NIE ZAMÓWIŁ.** Ten dyżur ma sześć
   pozycji roboczych i jedną dokumentacyjną (§1.3). Wszystko, co Ci „po drodze"
   przyjdzie do głowy — rozwijanie serii w API Meetings, TZID w ICS, konwersja
   wall-clock, funnel do Initiatives, otwarcie tras dla ról klienckich — jest
   **POZA ZAKRESEM** (§1.4) i idzie do „Znalezisk", nie do kodu.
4. **★ TEN DYŻUR PRAWIE NIC NIE BUDUJE — ON DOWODZI.** Pięć z sześciu pozycji
   to w większości **testy** na mechanice, która już stoi. Jedyna realna zmiana
   zachowania produktu to **§A** (walidacja strefy) i dwie punktowe poprawki
   w §C.3 i §E.2. Jeżeli łapiesz się na pisaniu nowego serwisu — zatrzymaj się
   i przeczytaj §1.4.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **gałąź `codex/m03-admin-20260824`**, przypięta do
   commitu-markera podanego niżej.

   **SHA markera: «MARKER_SHA»**

2. **Sprawdzasz marker PIERWSZĄ komendą dyżuru:**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor «MARKER_SHA» HEAD && echo "MARKER OK" || echo "MARKER BRAK"
   ```

   (`HEAD` = tip gałęzi `codex/m03-admin-20260824`; jeżeli stoisz gdzie indziej,
   podstaw nazwę gałęzi zamiast `HEAD` i zapisz to w raporcie.)

3. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/preserve-*`, `codex/meetings-day16-*`, `codex/meetings-day19-*`,
   **`codex/meetings-day24-*`**, `codex/assessment-*`, `codex/mgmtreports-*`
   ani z żadnej gałęzi dni 17–27. Załóż raport, wpisz pozycję STOP z wynikiem
   obu komend i zakończ dyżur.

   **Reguła rozejścia (`DEC-2026-08-26-95`).** Jeżeli marker JEST przodkiem, ale
   tip uciekł do przodu (nadzorca scalił coś po związaniu markera) — **to nie
   jest STOP**. Startujesz **dokładnie z markera**, wypisujesz w raporcie
   `git log --oneline <marker>..codex/m03-admin-20260824` i listę plików
   rozejścia; scalenie z nowszym tipem wykonuje nadzorca przy odbiorze. Rebase
   w trakcie dyżuru: **ZAKAZANY**.

4. **★ Weryfikacja stanu wejściowego (warunek wstępny, NIE formalność).**
   Sprawdzasz sam; wynik jest obowiązkową pozycją raportu. **Każda z tych komend
   ma w §1.7 podany oczekiwany wynik — rozbieżność idzie do „Korekt wobec
   instrukcji", nie do improwizacji:**

   ```bash
   # (a) blok 3 jest scalony — bez tego nie ma czego domykać
   git log --oneline -1 --grep="Meetings day 24" --all              # oczekiwane: e6e923d441 (merge, DEC-134)
   git show --stat 908ec7434d | tail -8                             # oczekiwane: 6 plików, 675 insercji

   # (b) walidacja occurrence NIE zna dziś strefy — sedno pozycji A
   sed -n '1233,1243p' server/src/routes/meeting.routes.ts          # oczekiwane: tylko pusty/CRLF/scope

   # (c) resolver materialTitle stoi, ale nie ma ani jednego testu — sedno pozycji C
   grep -rn "materialTitle" server/src src tests | wc -l            # oczekiwane: 2 (obie linie w meetingBoundaryService.ts)

   # (d) moduł jest zamknięty i ma zostać zamknięty
   grep -n "MODULE_MEETING" src/utils/betaAccess.ts                 # oczekiwane: :53 'closed'

   # (e) inwentarz tras
   grep -c "^router\.\(get\|post\|patch\|put\|delete\)" server/src/routes/meeting.routes.ts   # oczekiwane: 32

   # (f) rejestr decyzji
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane: >= 192
   grep -c "DEC-2026-08-26-134" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md  # oczekiwane: >= 1
   ```

5. **Własna gałąź i własny worktree** (nigdy praca na `codex/m03-admin-20260824`):

   ```bash
   git branch codex/meetings-day28-<data> «MARKER_SHA»
   git worktree add /private/tmp/consultify-meetings-day28 codex/meetings-day28-<data>
   cd /private/tmp/consultify-meetings-day28
   ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules node_modules   # DEC-86, TYLKO ODCZYT
   ```

6. **★ KOMENDA BAZOWA — wszystkie porównania w raporcie robisz wobec markera**,
   nigdy wobec `HEAD~1`:

   ```bash
   git diff --name-only «MARKER_SHA»...HEAD
   ```

   Ta komenda ma w tym dokumencie własną nazwę — **„komenda bazowa"** — i wraca
   w §0.3, §0.4a i w szablonie raportu. Wynik wklejasz do raportu dosłownie.

### 0.2. Bezwzględne ZAKAZY

| #       | Zakaz                                                                                                                                                                                                                                                                                                                                               | Dlaczego                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Z1      | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/meetings-day28-<data>`                                                                                                                                                                                 | Push na `origin`/demo wykonuje wyłącznie nadzorca                                                                   |
| Z2      | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej gałęzi `codex/meetings-*`, `codex/assessment-*`, `codex/mgmtreports-*`, `codex/chat-*`                                                                                                                                                            | `demo` = święta baza; tamte gałęzie to historia odebrana albo praca w toku                                          |
| Z3      | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru                                                                                                                                                                                                                | Krach 3/4 powstał tak; `DEC-95`                                                                                     |
| **Z4**  | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`)                                                                                                                                                                                                                                                   | Wymagania są w rejestrze uwag i decyzjach                                                                           |
| **Z5**  | **★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-86`                                                                                                                           | Chroniony, brudny worktree właściciela — praca własna Piotra                                                        |
| Z6      | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` — w chwili wystawienia żyje ich **59**, w tym `consultify-meetings-day24`, `consultify-assessment-day25`, `consultify-chat-front-day26`, `consultify-mgmtreports-full`, `consultify-day28-instrukcja`                                                                               | Cudze worktree, część w aktywnym użyciu                                                                             |
| Z7      | **Nie zajmujesz portów sesyjnych.** W chwili wystawienia NASŁUCHUJĄ m.in.: 5000, 5037, **5432**, **5474**, 6379, 7000, 7679, 7768, 11434. **Twój kontener PG = 5507.** Port zajęty → bierzesz pierwszy wolny i wpisujesz do raportu                                                                                                                 | Cudze dyżury pracują równolegle                                                                                     |
| Z8      | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (`DEC-65`)                                                                                                                                                                                                                | Produkcja/demo poza zakresem                                                                                        |
| **Z9**  | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo/staging/produkcja, nigdy cudza retained-DB. **KOREKTA `DEC-2026-08-26-98`: Z9 przerywa DANĄ CZYNNOŚĆ, nie cały dyżur** — patrz ramka pod tabelą                                                                                                                      | „dane demo = twarz produktu" (`DEC-65`)                                                                             |
| **Z10** | **Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej flagi.** Także zero „tymczasowej flagi na czas testu". Dotyczy w szczególności `MODULE_MEETING`, `MEETING_INVITES_LIVE`, `BETA_ADMINS_EXEMPT`, `DEMO_ORG_ID`                                                                                                              | CLAUDE.md reguła 9                                                                                                  |
| Z11     | **Nie zmieniasz `src/components/ProtectedRoute.tsx`, `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts`** ani gramatyki tras `/meetings/*`. **Nie dodajesz nowej trasy HTTP** — ten dyżur nie ma ani jednego nowego endpointu                                                                                                                  | Gramatyka zaakceptowana (`DEC-2026-08-24-07`); nowa trasa = nowa powierzchnia do odbioru                            |
| Z12     | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY28_REPORT_20260827.md`. Jedyny inny dokument, który wolno zmienić, to `modules/08_MEETINGS/MODULE_ACCEPTANCE.md` — wyłącznie w ramach `R.1`. **Raportów dni 16/19/24 NIE edytujesz**                              | Repo tonie w dokumentach-duchach                                                                                    |
| Z13     | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie. Jeżeli uważasz, że decyzja się myli — piszesz **erratę w raporcie**, nie patch w rejestrze                                                                                                                                                          | Rejestr decyzji jest `FINAL / IRREVOCABLE`                                                                          |
| **Z14** | **Nie budujesz generowania treści modelem i nie podpinasz dostawcy LLM.** `meetingIntelligenceService` wołasz bez zmian albo w ogóle. Zero nowych wywołań `llmService`, zero `/api/ai/**`                                                                                                                                                           | Silnik AI = osobny moduł, ostatni w programie; `DEC-51`                                                             |
| Z15     | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych / `null` / `failed`.** `materializationStatus='failed'` **zostaje**; `deliveryStatus='failed'` dla jednego odbiorcy **zostaje**; `materialTitle: null` przy niepustym `materialArtifactId` **zostaje** (to jest KONTRAKT pozycji C, nie defekt)                                           | Uczciwy pusty stan > udawany wynik                                                                                  |
| **Z16** | **★★ `server/src/services/effectiveAccessService.ts` jest ABSOLUTNIE NIETYKALNY** — a razem z nim `frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts`, `PermissionsService`, `server/src/services/v8/artifactRegistryService.ts`, **`server/src/services/v8/recurrenceEngine.ts`**. Wolno **czytać** i **wołać**      | Model uprawnień i rejestr artefaktów naprawiane in-house; STOP dnia 19 na `recurrenceEngine` był zasadny            |
| **Z17** | **★ Zakaz wszystkiego poza modułem Meetings** — z imiennymi licencjami z ramki poniżej. Cały front (`src/**` do zapisu), powłoka SPEC-A, kanon triady, cudze serwisy: **NIE**                                                                                                                                                                       | „jeden moduł na raz"; podział FRONT/TYŁ (§1.6)                                                                      |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config*.ts`, ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru** | Dyżur nr 2 wywalił tak 27 cudzych testów                                                                            |
| **Z19** | **★★ ZAKAZ uruchamiania jakichkolwiek testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, podanego W TEJ SAMEJ LINII komendy — PIĘĆ zmiennych, nie dwie.** Kolejność Bloku 0: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar**. Do raportu obowiązkowy **dowód celu połączenia** i **liczba SKIPPED**     | Dzień 17 zmierzył stan wejściowy na cudzej/niezmigrowanej bazie (`DEC-96/98`); dzień 19 mierzył bez `MOCK_DB=false` |
| **Z20** | **★ DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`) — patrz ramka pod tabelą                                                                                                                                                                                                                                           | Bramka DoD dnia 60 przepuściła „ZROBIONE" przy czterech żywych martwych gałęziach                                   |
| **Z21** | **★ Test wstrzykujący zależności NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`) — patrz ramka pod tabelą; **w tym dyżurze to jest lekcja pozycji E**: harness dnia 24 zamaskował mapowanie `AuthorizationError` własnym handlerem błędów                                                                                                 | Dzień 18: 8/8 testów zielonych, warstwa AI martwa, bo wszystkie wstrzykiwały własne `generate`                      |
| **Z22** | **★ Zakaz atrapy z zewnętrznym skutkiem** (`DEC-2026-08-26-108`) — **sukces + skutek na zewnątrz (mail / ICS / `CANCEL`) przy braku zmiany w bazie = ODRZUCENIE pozycji**. Dowodzisz zmianę w bazie osobnym `SELECT` przed i po, niezależnym poolem                                                                                                 | Dzień 19: `DELETE /occurrence` rozsyłał `CANCEL` do ludzi, nie zmieniwszy nic w bazie                               |
| **Z23** | **★ Pomiar testów BEZ ZAWĘŻANIA** (`DEC-2026-08-26-108`) — wynik z **PEŁNEGO zakresu §0.4a**, z rozbiciem **ZASTANE / WPROWADZONE** i liczbą **SKIPPED**. **Podanie zawężonego wyboru = naruszenie**                                                                                                                                                | Dzień 19 zadeklarował „98/98 PASS" przy 189/193 w zakresie własnej instrukcji                                       |

**★ Z9 — procedura po korekcie `DEC-2026-08-26-98` (nie zabijaj dyżuru).**
Jeżeli złapiesz się na komendzie DB bez przypiętego env: **zatrzymaj tę komendę →
ustal skutek (czy w ogóle doszło do połączenia i czy był ZAPIS) → zapisz
ustalenie w raporcie → przypnij env → KONTYNUUJ pozycję.** Twardy STOP całego
dyżuru **wyłącznie** przy stwierdzonym realnym **zapisie** do bazy spoza dyżuru.
`localhost:5432/iris_test` to wewnętrzny fallback konwencji testowej repo
(`tests/setup.ts`), nie obca baza — ale i tak nie mierzysz przeciwko niemu.

**★★ Z19 — PIĘĆ zmiennych w tej samej linii, i dlaczego to nie jest biurokracja.**

- `server/src/database/Database.ts` — `process.env.MOCK_DB === 'true'` podstawia
  **mock DB BEZWARUNKOWO**, niezależnie od `RUN_DB_TESTS`;
- `tests/setup.ts` — `process.env.MOCK_DB = process.env.MOCK_DB || 'true'`,
  czyli **brak jawnego `MOCK_DB=false` USTAWIA `MOCK_DB='true'`**;
- `tests/setup.ts` — globalny mock `auth.middleware.js`: przy **braku** nagłówka
  `Authorization` i przy `MOCK_DB !== 'false'` wstrzykuje użytkownika
  `role: 'owner', isSuperAdmin: true` i woła `next()`. Czyli **anonim dostaje
  `200` zamiast `401`** — nie dlatego, że produkt jest dziurawy, tylko dlatego,
  że pomiar był robiony bez `MOCK_DB=false`. Dzień 24 potwierdził to
  eksperymentalnie (errata poz. 1 raportu dnia 24).

**Bez `MOCK_DB=false` każdy Twój pomiar autoryzacji jest fikcją — środowisko
wstrzykuje anonimowi rolę właściciela.** Dlatego **każde** uruchomienie testu
dotykającego bazy ma env **w tej samej linii**:

```bash
DATABASE_URL="postgres://postgres:cx@localhost:5507/cx_day28" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
npx vitest run <plik>
```

i **każdy** taki przebieg jest poprzedzony dowodem celu połączenia:

```bash
docker exec cx-day28-pg psql -U postgres -d cx_day28 -c "SELECT current_database(), inet_server_port();"
```

Wynik tej komendy (**dosłowny**) jest obowiązkową pozycją raportu. Pomiar bez
dowodu celu = pomiar nieistniejący. **Pakiet w całości `SKIPPED` zaraportowany
jako `PASS` = zawyżenie i podstawa odrzucenia.**

**★ Z20 — jak wygląda dowód osiągalności.**
Nie wystarczy „funkcja istnieje i ma test jednostkowy". Dla **każdej** pozycji
podajesz w raporcie **ścieżkę wywołania od realnego wejścia**:

```
realne wejście (metoda + URL, jaki wychodzi z przeglądarki albo z klienta HTTP)
  → montaż w Gateway.ts (plik:linia)
  → middleware routera (verifyToken / isAuthenticated / closedBetaModuleGate)
  → handler trasy (plik:linia)
  → serwis (plik:linia)
  → zapis do tabeli (nazwa tabeli, kolumna)
  → ODCZYT, który ten wiersz podnosi (plik:linia)
```

Montaż jest w `server/src/Gateway.ts:769` (`app.use('/api/meeting', meetingRoutes)`).
**Ostatni wiersz jest obowiązkowy.** Zapis, którego żaden odczyt nie podnosi,
jest z punktu widzenia produktu niewidoczny: pozycja `CZĘŚCIOWO`, nie
`ZROBIONE_WG_DoD`.

**★ Uczciwa forma ostatniego ogniwa w tym dyżurze.** Piętnaście z trzydziestu
dwóch tras Meetings **nie ma dziś żadnego konsumenta frontowego** (§1.2 poz. 10).
Dla tras backend-only ostatnim ogniwem jest **koperta HTTP odczytu** (np.
`res.json({ notes })` w `meeting.routes.ts:1011`) — i wtedy **piszesz to
wprost**: „ostatnie ogniwo = koperta HTTP; brak konsumenta w `src/`".
**Nie wolno Ci** dopisać konsumenta frontowego, żeby ogniwo „domknąć" (Z17),
i **nie wolno Ci** przemilczeć jego braku.

**★ Z21 — co to znaczy „test domyślnego okablowania".**
Test, który buduje własny `express()` i **wstrzykuje własny serwis albo własny
handler błędów**, nie dowodzi niczego o produkcji. Wzorzec dopuszczalny (i jedyny
wzorzec dowodowy tego dyżuru) to
`tests/integration/routes/meeting.day19.postgres.integration.test.ts:41-45`:
importuje **realny router** (`server/src/routes/meeting.routes.js`), montuje go
pod `/api/meeting` i mockuje **wyłącznie** `auth.middleware.js` (bo nie ma sesji
przeglądarki) oraz `Logger.js` (bo szum). **Serwisy Meetings, bramka beta, baza,
mapowanie błędów — realne.** Każde odstępstwo od tego wzorca wymaga jawnego
wpisu w raporcie z uzasadnieniem.

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
  server/src/routes/meeting.routes.ts                                (pozycje A, D, E — ADDYTYWNIE)
  server/src/services/meetingBoundary/meetingBoundaryService.ts      (TYLKO pozycja C.3 — przekazanie userId/roleKey w retry)
  server/src/services/meeting/meetingNoteTaskFunnelService.ts        (TYLKO pozycja E.2 — uczciwe `replayed`)
  server/src/services/meeting/meetingOccurrenceService.ts            (TYLKO strażnik obronny §A.5 — i tylko jeśli §A.5 go dopuści)
  server/src/routes/__tests__/day28.*.test.ts                        (NOWE pliki)
  server/src/services/meeting/__tests__/day28.*.test.ts              (NOWE pliki)
  server/src/services/meetingBoundary/__tests__/day28.*.test.ts      (NOWE pliki)
  tests/integration/routes/meeting.day28.*.postgres.integration.test.ts   (NOWE pliki, git add -f)
  tests/integration/routes/meeting.day24.dst-split.postgres.integration.test.ts       (★ ROZBUDOWUJESZ, pozycja B — nie osłabiasz)
  tests/integration/routes/meeting.day24.occurrence-role-gate.postgres.integration.test.ts (★ ROZBUDOWUJESZ, pozycja D)
  tests/integration/routes/meeting.day24.task-funnel.postgres.integration.test.ts     (★ ROZBUDOWUJESZ, pozycja E)
  server/migrations/2026117<x>_meetings_day28_*.sql                  (NOWE pliki — najpewniej ŻADNA, §0.3)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md   (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY28_REPORT_20260827.md          (jedyny nowy dokument)

IMIENNE LICENCJE (wolno CZYTAĆ i WOŁAĆ istniejące, NIE zmieniać ich kodu):
  §A  — server/src/services/v8/recurrenceEngine.ts            (CZYTASZ jako źródło definicji recurrenceId; ZMIANA = STOP, Z16)
        pakiet `rrule` (node_modules)                          (WOLNO użyć W TEŚCIE do policzenia siatki serii)
  §C  — server/src/services/v8/artifactRegistryService.ts::getArtifactForUser  (WOŁASZ; ZMIANA = STOP, Z16)
        server/src/services/meeting/meetingAttachmentService.ts:29-83          (CZYTASZ jako wzorzec resolvera)
  §D  — server/src/services/meeting/meetingInvitationService.ts (CZYTASZ i SPY-UJESZ; ZMIANA = STOP)
  §E  — server/src/services/TaskService.ts                     (WOŁASZ; ZMIANA = STOP)
        server/src/utils/ErrorHandler.ts::errorHandlerMiddleware (MONTUJESZ w teście; ZMIANA = STOP — §E.3)
        server/src/services/myWork/agentApprovedMaterializationService.ts     (CZYTASZ jako wzorzec lejka)
  §F  — server/src/services/meeting/meetingInvitationService.ts (CZYTASZ; ZMIANA = STOP — §F to TEST)
        server/src/services/emailService.ts                     (CZYTASZ; mockujesz LOKALNIE w swoim pliku; ZMIANA = STOP)
        server/src/utils/ics/icsBuilder.ts                      (CZYTASZ; ZMIANA = STOP — brak TZID jest ŚWIADOMY, §1.2 poz. 8)
  wzorce testów — tests/integration/routes/meeting.day19.postgres.integration.test.ts
                  server/src/services/meetingBoundary/__tests__/meetingBoundaryMountedAuth.pg.test.ts
                  (CZYTASZ jako wzorzec realnego JWT + realnych wierszy users/organizations)

NIE WOLNO:
  ★ CAŁE src/** DO ZAPISU (odczyt i grep — TAK, wręcz wymagane)   ← podział FRONT/TYŁ; zero wyjątków
  ★ src/utils/betaAccess.ts                                        ← ZMIANA = ODRZUCENIE DYŻURU
  server/src/services/effectiveAccessService.ts                    ← Z16
  server/src/services/v8/artifactRegistryService.ts                ← Z16
  server/src/services/v8/recurrenceEngine.ts                       ← Z16 (STOP dnia 19 był zasadny)
  server/src/services/meeting/meetingInvitationService.ts          ← §D i §F to TESTY, nie zmiana kodu
  server/src/services/meeting/meetingDay16Service.ts               ← odebrane DEC-92
  server/src/services/meeting/meetingAttachmentService.ts          ← odebrane DEC-111
  server/src/services/TaskService.ts                               ← WOŁASZ, nie zmieniasz
  server/src/utils/ics/icsBuilder.ts                               ← odebrane DEC-92 (FIX-1..9)
  server/src/utils/ErrorHandler.ts · server/src/middleware/errorHandler.ts  ← MONTUJESZ, nie zmieniasz
  server/src/middleware/auth.middleware.ts · betaGate.middleware.ts ← czytasz, nie zmieniasz
  server/src/services/artifactHandoff/**                           ← kręgosłup, wołany bez zmian
  server/src/services/initiativeService.ts / createInitiativeService ← Initiatives = BRAK_API, tak zostaje
  server/migrations/<istniejące pliki>                             ← TYLKO ODCZYT (nowe DDL = nowy plik)
  tests/e2e/**  ·  tests/acceptance/**                             ← cudzy tor odbiorowy (MIERZYSZ, nie zmieniasz)
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie jest**
praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie, idziesz
dalej. Wyjątku nie ma nawet dla „jednej linii importu".

### 0.3. Higiena wykonania

- **★ COMMIT PER POZYCJA — TWARDO.** Dzień 24 wrzucił cztery pozycje do jednego
  commita (`908ec7434d`) i to było **dodatkowym powodem, dla którego żadna
  z nich nie dostała `ZROBIONE_WG_DoD`**. Nie powtarzaj tego. Conventional
  commits:

  ```
  fix(meeting): reject occurrence mutations whose recurrenceId carries no explicit zone (A)
  test(meeting): bind the DST split proof to the real series grid, not to its own formula (B)
  test(meeting): prove the material title resolver denies a revoked artifact (C)
  test(meeting): complete the occurrence role gate matrix and prove denial sends nothing (D)
  fix(meeting): report replayed honestly and map project authorization failures on the real pipeline (E)
  test(meeting): prove one failing recipient does not block the rest of the invite batch (F)
  docs(meeting): raise 08_MEETINGS acceptance to the delivered scope (R.1)
  docs(meeting): day 28 duty report (R.2)
  ```

- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita:
  `npx prettier --write <pliki>`. W repo **nie ma** skryptu `format` — wołasz
  `npx prettier` wprost.
- **Typy punktowo** — `npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null`.
  **NIGDY pełny `tsc -p` repo, NIGDY pełny `vitest` repo.**
  **★ Uwaga: `esbuild` TRANSPILUJE, nie typuje — nie złapie błędu typu.** Dlatego
  każda zmiana kontraktu ma test behawioralny, który złapie to, czego esbuild nie
  widzi.
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `toContain('...')`, **nie liczy się do DoD** (Z21). **Wyjątek, który
  MUSISZ znać:** istniejący `tests/unit/backend/middleware/meetingBetaGate.test.ts`
  **czyta źródło routera i asertuje dokładny ciąg trzech linii `router.use(...)`**
  (`meeting.routes.ts:259-261`). Tego testu **nie ruszasz**, ale **każde
  przestawienie kolejności tych trzech linii go wywali**. Dodawanie nowych
  `router.use(...)` **po** nich jest bezpieczne. W tym dyżurze i tak nie dodajesz
  żadnego `router.use`.
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok kodu
  w `server/src/` dodają się normalnie.
- **★ MIGRACJE — reguły twarde.**
  1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
     `INSERT ... ON CONFLICT DO NOTHING`. **Zakaz** `DROP`,
     `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`, bezwarunkowego `UPDATE`.
  2. **★★ NUMERACJA — DZIEŃ 28 MA PRZYDZIELONY PRZEDZIAŁ `20261170`–`20261179`.**
     Reguła „najwyższy + 1" obowiązuje **TYLKO WEWNĄTRZ tego przedziału**.
     Numery spoza przedziału są **ZAKAZANE, nawet jeśli `ls` pokazuje je jako
     wolne**: `20261124`–`20261169` to pule dni 22–27 i prac wewnętrznych,
     **część jeszcze nie scalona**, więc `ls` ich u Ciebie nie pokaże — to nie
     znaczy, że są wolne. (Najwyższy widoczny na markerze to `20261123`;
     **nie** bierz `20261124`.)

     **Obowiązkowy `ls | grep` PRZED KAŻDYM plikiem:**

     ```bash
     ls server/migrations | grep -E '^202611[0-9]{2}' | sort | tail -5   # co widać jako zajęte
     ls server/migrations | grep '^2026117'                              # MUSI być PUSTE przed utworzeniem pliku
     ```

     Nazwa: `<numer>_meetings_day28_<temat>.sql`. `migrate.postgres.ts` stosuje
     migracje w porządku **alfabetycznym nazw plików**, więc kolizja numeru to
     cicha katastrofa — dokładnie ta, którą wykrył odbiór dnia 18 (`DEC-107`).

  3. **★ ZERO nowych kluczy obcych.** Meetings świadomie ich nie ma
     (`20260826_meetings_day10_decisions.sql:2`). Nie powielasz.
  4. **★★ NAJPEWNIEJ NIE POTRZEBUJESZ ŻADNEJ MIGRACJI.** Sprawdziłem to za
     Ciebie: żadna z sześciu pozycji nie wprowadza nowego obiektu bazodanowego.
     `tasks.idempotency_key` z częściowym unikatem `idx_tasks_idempotency_org`
     już istnieje (`server/migrations/20260804_m02a_tasks_tenant_idempotency.sql`),
     kolumny serii istnieją od `20261075`, ledger materializacji od `20261090`.
     **Migracja bez udowodnionego braku obiektu na świeżej bazie = pozycja
     odrzucona.** Jeżeli mimo to uznasz, że migracja jest konieczna — najpierw
     dowód `\d <tabela>` z Twojego kontenera w raporcie, potem plik.
  5. **`MIGRATION_PREPARED`** — migracja jest przygotowana i udowodniona lokalnie,
     **nigdy** uruchomiona zdalnie (`REMOTE_EXECUTION_NOT_AUTHORIZED`).

- **★ Dane demo = twarz produktu.** Wszystko, co zapisujesz, zapisujesz do
  **swojego jednorazowego kontenera**. Zero rekordów testowych gdziekolwiek
  indziej. Sprzątanie kontenera **i wolumenów** jest obowiązkowe (§BLOK 0 pkt 10).

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

Pozycja jest zrobiona, gdy spełnia **wszystkie dwanaście**:

1. **Realne dane** — odczyt i zapis idą do backendu. Zero mocków jako źródła
   prawdy. Pusty wynik = uczciwy pusty stan; nieznane = `null` z powodem,
   **nigdy zmyślona wartość**.
2. **Zapis z readbackiem** — po komendzie zapisującej test ponownie odczytuje
   stan z bazy **niezależnym połączeniem** (osobny `pg.Pool`), nie z koperty
   odpowiedzi.
3. **Zero atrap, a w szczególności zero atrap z zewnętrznym skutkiem (Z22).**
   Brak API → wpis `BRAK_API`. Jeżeli trasa zwraca `deliveries` z `method:'CANCEL'`,
   w bazie **MUSI** być zmiana stanu — dowodzisz ją osobnym `SELECT` przed i po.
4. **Minimum 4 testy zachowania** (happy · błąd 4xx/5xx · uczciwy pusty stan ·
   **negatyw tenanta**), behawioralne. Pozycje C/D/E mają wyższe minima podane
   we własnych paragrafach.
5. **★ Test HTTP realnego routera** przez `supertest` na **realnym PG** (wzorzec:
   `tests/integration/routes/meeting.day19.postgres.integration.test.ts`). Test
   na zmockowanym `meetingService` **nie zastępuje** tego wymogu.
6. **★ DOWÓD OSIĄGALNOŚCI (Z20)** — pełna ścieżka od realnego wejścia do zapisu
   **i do odczytu, który ten wiersz podnosi** (dla tras bez frontu: koperta HTTP,
   nazwana wprost).
7. **★ TEST DOMYŚLNEGO OKABLOWANIA (Z21)** — realny router, realne serwisy,
   **realne mapowanie błędów**; mockowanie ograniczone do `auth.middleware.js`,
   `Logger.js` i — wyłącznie w `§F` — `emailService.js`. **Każdy inny mock
   wymaga wpisu w raporcie z uzasadnieniem.**
8. **Kontrole negatywne tenanta** — obcy `organizationId` nigdy nie dostaje
   `200`; `organizationId` **wyłącznie z tokenu**, nigdy z body/query. Test
   wysyła obcą organizację w body i dostaje `404`/`403`, nie `200`.
9. **★ Kontrola negatywna roli** — żądanie bez wymaganej roli jest ODRZUCONE
   **i nie zostawia śladu mutacji** (dowodzisz liczbą wierszy przed i po)
   **oraz nie wywołuje skutku zewnętrznego** (spy na mailerze — §D).
10. **Realny PG w jednorazowym Dockerze** (port 5507, obraz
    **`pgvector/pgvector:pg16`** — `postgres:15` **NIE przechodzi migracji**,
    brak rozszerzenia `vector`) z pełnymi migracjami, z dowodem celu połączenia
    (Z19), ze sprzątnięciem kontenera **i wolumenów**.
11. **Plik przez `prettier`** przed commitem.
12. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód osiągalności →
dowód testowy`.

> Punkty „zrzut light+dark" i „i18n napisów UI" **nie obowiązują** w tym dyżurze —
> front jest poza zakresem. Klucze i18n tworzysz **wyłącznie** dla napisów, które
> faktycznie wychodzą z Twojego API (kody i komunikaty błędów), i wtedy parytet
> PL+EN obowiązuje w tym samym commicie.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu (Z23)

**Ten paragraf definiuje PEŁNY zakres pomiaru. Raport podaje wynik z CAŁEGO tego
zakresu. Podanie zawężonego wyboru = naruszenie Z23.**

1. Wypisz wszystkie dotknięte pliki **komendą bazową** (§0.1 pkt 6).
2. Wyodrębnij **współdzielone** (importuje je ktoś spoza Twojego zakresu):
   `server/src/routes/meeting.routes.ts`,
   `server/src/services/meetingBoundary/meetingBoundaryService.ts`,
   `server/src/services/meeting/meetingNoteTaskFunnelService.ts`,
   ewentualnie `server/src/services/meeting/meetingOccurrenceService.ts`.
3. **Zmierz zakres DWA RAZY:**
   - **(a) na markerze, PRZED pierwszym commitem** → czerwone **ZASTANE**;
   - **(b) na `HEAD` po ostatnim commicie** → różnica to czerwone **WPROWADZONE**.
     Obie liczby idą do raportu, w formacie `X PASS / Y FAIL / Z SKIPPED`, per plik.
4. Uruchom **minimum** poniższą listę. `ENV` niżej oznacza dosłownie
   `DATABASE_URL="postgres://postgres:cx@localhost:5507/cx_day28" DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false`
   **w tej samej linii komendy** (Z19):

   ```bash
   # --- pakiety bez bazy ---
   npx vitest run server/src/routes/__tests__/meeting.routes.test.ts
   npx vitest run server/src/services/__tests__/meetingService.test.ts
   npx vitest run server/src/services/meeting/__tests__/meetingInvitationService.test.ts
   npx vitest run server/src/utils/ics/__tests__
   npx vitest run tests/unit/backend/middleware/meetingBetaGate.test.ts
   npx vitest run tests/unit/meeting
   npx vitest run tests/unit/backend/services/taskService.test.ts

   # --- pakiety na realnym PG (KOMPLET pięciu zmiennych w tej samej linii) ---
   ENV npx vitest run server/src/services/meetingBoundary/__tests__
   ENV npx vitest run server/src/services/meeting/__tests__
   ENV npx vitest run server/src/routes/__tests__/meeting.day10.records.routes.pg.test.ts
   ENV npx vitest run tests/integration/routes/meeting.day19.postgres.integration.test.ts
   ENV npx vitest run tests/integration/routes/meeting.occurrence-cancel.postgres.integration.test.ts
   ENV npx vitest run tests/integration/routes/meeting.materialization-retry.postgres.integration.test.ts
   ENV npx vitest run tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts
   ENV npx vitest run tests/integration/routes/meeting.decision-follow-up-records.postgres.integration.test.ts
   ENV npx vitest run tests/integration/routes/meeting.day24.dst-split.postgres.integration.test.ts
   ENV npx vitest run tests/integration/routes/meeting.day24.occurrence-role-gate.postgres.integration.test.ts
   ENV npx vitest run tests/integration/routes/meeting.day24.task-funnel.postgres.integration.test.ts

   # --- konsumenci SPOZA Meetings, dotknięci przez §E (muszą zostać zielone) ---
   ENV npx vitest run server/src/services/myWork/__tests__

   # --- regresja frontu (NIE zmieniasz frontu, ale musi zostać jak było) ---
   npx vitest run src/components/Meeting/__tests__
   npx vitest run src/routes/__tests__/meetingsCanonicalRoute.test.ts
   ```

   Pakiet `myWork/__tests__` i `taskService.test.ts` są w zakresie **nie dlatego,
   że je zmieniasz** (nie wolno Ci), tylko dlatego, że **muszą pozostać zielone** —
   to jest Twój dowód, że `§E` nie ruszył cudzego lejka.

5. **★ Wynik podajesz BEZ ZAWĘŻANIA, z rozbiciem i z liczbą SKIPPED:**

   ```
   Zakres §0.4a: <X>/<Y> PASS, <S> SKIPPED
     czerwone ZASTANE (czerwone na markerze, PRZED moim pierwszym commitem): <lista plików + liczby>
     czerwone WPROWADZONE (zapalone przez mój commit): <lista + SHA commitu, który je zapalił>
     SKIPPED z powodu env: <lista> ← jeśli niepuste, pomiar jest CZĘŚCIOWY
   ```

   **Deklaracja „N/N PASS" na wybranym podzbiorze przy czerwonych w zakresie
   §0.4a = zawyżenie i podstawa odrzucenia.** **Deklaracja „PASS" przy pakiecie
   w całości SKIPPED = to samo.**

6. Deklarujesz jawnie `ZASIĘG PEŁNY` / `ZASIĘG CZĘŚCIOWY` (i co pominąłeś,
   i dlaczego). `CZĘŚCIOWY` bez wyliczenia pozycji jest odrzucany.
7. **Osłabienie asercji w teście istniejącym wcześniej wymaga wpisu „przed/po"
   w raporcie.** Dotyczy to również usunięcia bloku `describe`. Osłabienie bez
   wpisu = odrzucenie. **W tym dyżurze rozbudowujesz trzy pliki dnia 24 —
   każda linia, którą w nich ZMIENIASZ (a nie dodajesz), idzie do tabeli
   „przed/po".**
8. **★ ZNANE CZERWONE ZASTANE — potwierdź albo obal, nie przepisuj na wiarę:**

   | Plik                                                          | Objaw wg dnia 24                                       | Co masz zrobić                                      |
   | ------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
   | `src/components/Meeting/__tests__/MeetingObjectPage.test.tsx` | 1 test czerwony, brak tekstu `Ship v2`                 | Potwierdź jako zastane. **NIE naprawiasz** (Z17)    |
   | `meetingBoundaryMountedAuth.pg.test.ts`                       | dzień 24: `22/22 PASS`, anonim `401` z `MOCK_DB=false` | Potwierdź. Rozbieżność → „Korekty wobec instrukcji" |

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**
Zatrzymujesz się w szczególności, gdy musiałbyś:

- zmienić `MODULE_MEETING: 'closed'` na `'open'` — to jest **odrzucenie dyżuru**,
  nie STOP;
- wejść we `src/**` z zapisem (Z17) — **także po to, żeby „tylko pokazać nowe
  pole" albo „domknąć ostatnie ogniwo Z20"**;
- dotknąć `effectiveAccessService.ts`, `artifactRegistryService.ts` albo
  `recurrenceEngine.ts` (Z16) — STOP **zawsze**, także „addytywnie";
- dotknąć `meetingInvitationService.ts` albo `icsBuilder.ts` (§D i §F to
  **testy**, nie zmiana kodu), albo osłabić którąkolwiek asercję
  `not.toHaveBeenCalled()` na mailerze;
- **wysłać cokolwiek na zewnątrz** (Z22 / `DEC-65`) — także „na
  `smtp.example.com` na próbę"; reżim §F jest bezwarunkowy;
- dodać `idempotencyKey` do `createInitiativeService` — to jest **`BRAK_API`**,
  tak rozstrzygnięte w `DEC-108`, i tak zostaje;
- dodać nową trasę HTTP albo `router.use` (Z11 / §0.3);
- rozszerzyć walidację §A poza trasę `occurrence` (np. na `POST /` albo
  `PUT /:id`) — to jest **zmiana kontraktu tworzenia spotkania**, osobna decyzja
  produktowa: **STOP z propozycją**, nie cicha zmiana;
- osłabić/usunąć asercję w teście istniejącym wcześniej (jeżeli test jest
  sprzeczny z nowym kontraktem — wzorzec FIX-2 dnia 19: **udowodnij wspólny
  korzeń, zaktualizuj TEST, wpisz przed/po do raportu**, nie usuwaj);
- przestawić kolejność `router.use(verifyToken); router.use(isAuthenticated);
router.use(closedBetaModuleGate);` (`meeting.routes.ts:259-261`);
- dodać migrację nieaddytywną, z kluczem obcym, albo z numerem **spoza
  przedziału `20261170`–`20261179`**;
- stworzyć flagę funkcyjną albo zmienić domyślną wartość istniejącej (Z10);
- test nie przechodzi i naprawa wymaga zmiany GLOBALNEGO mocka/configu vitest
  (Z18) — STOP zawsze, bez „addytywnie, więc nic nie zepsuje";
- pomiar zasięgu (§0.4a) pokazał czerwone testy w cudzym module — nie
  „naprawiasz" po cichu: opisujesz, który commit je zapalił.

**Zakaz obchodzenia hooka pre-commit (`--no-verify`) — to jest zakaz, nie STOP:**
naprawiasz kod, nie omijasz strażnika.

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

Meetings przeszedł cztery dyżury. Dzień 10 zbudował rdzeń (spotkania, decyzje,
follow-upy). Dzień 16 dołożył uczestników, ICS i wysyłkę ze strażnikami
(`DEC-92`). Dzień 19 dołożył materializację notatek, edycję i odwoływanie serii,
resolver załączników (`DEC-111`). Dzień 24 dołożył dowód DST, bramki occurrence,
resolver `materialTitle` i funnel notatka→zadanie (`DEC-134`).

**Każdy z nich zostawił dług DOWODOWY, nie funkcjonalny.** Dzień 24 zostawił go
najwięcej — jego własna tabela zbiorcza to
`0 ZROBIONE_WG_DoD / 5 CZĘŚCIOWO / 3 NIE_ZACZĘTE`
(`docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY24_REPORT_20260826.md:150`).

**Odbiór `DEC-2026-08-26-134` scalił zakres, ale wypisał cztery zarzuty. To jest
Twoja mapa. Cytuję rejestr dosłownie:**

> **P1-1 — ODBIORCA SAM WYKONAŁ POMIAR, KTÓREGO ZABRAKŁO (§C.3)**: `recurrenceId`
> BEZ sufiksu strefy przechodzi walidację i daje wynik zależny od strefy procesu
> serwera — rozjazd 1 h (jesień) / 2 h (wiosna), seria ucięta w złym momencie PO
> CICHU; raport deklarował „decyzja C.4(b) test+errata", ale **nie ma ani testu,
> ani erraty** — jedyne miejsce, gdzie raport wyprzedził dowód.
>
> **P1-2**: resolver D wchodzi **BEZ ANI JEDNEGO TESTU** (ścieżka bezpieczeństwa —
> wyciek tytułu; `grep materialTitle` po `tests/` = zero) — D pozostaje CZĘŚCIOWO.
>
> **P2**: test DST wiąże tylko formułę `UNTIL=recurrenceId−1s`, **NIE wiąże okazji
> z granicą czasu** (mutacja: niezgodny z DST `recurrenceId` przechodzi); retry
> bez `userId` zeruje `material_title` (dziś nieszkodliwe — pola nikt nie czyta,
> co znaczy też, że kontrakt frontowy opisuje pole bez konsumenta); harness
> funnela **maskuje mapowanie `AuthorizationError` własnym handlerem**; flaga
> `replayed` niedokładna przy wyścigu.

To jest **brief wynikowy, nie literalny**: powyższe zdania mówią, JAKI STAN
KOŃCOWY ma zaistnieć. **Nie masz wykonać ich literalnie, jeśli kod pokazuje coś
innego** — masz wykonać to, co daje ten stan. §1.2 zawiera czternaście miejsc,
w których zweryfikowałem kod za Ciebie i wynik **różni się** od tego, co można by
wywnioskować z samych raportów.

### 1.2. ★★ ERRATA — CZTERNAŚCIE RZECZY ZWERYFIKOWANYCH W KODZIE

**Wszystko poniżej sprawdziłem grepem na markerze. Każdy punkt masz potwierdzić
u siebie i zapisać wynik w raporcie (sekcja „Weryfikacja erraty §1.2"). Jeżeli
u Ciebie wychodzi inaczej — to idzie do „Korekt wobec instrukcji", nie do
improwizacji.**

1. **Zasięg P1-1 jest SZERSZY niż mówi rejestr.** `DEC-134` opisuje skutek jako
   „seria ucięta w złym momencie" — czyli gałąź `this_and_following`. W kodzie
   `cutover = new Date(input.recurrenceId)` (`meetingOccurrenceService.ts:44`)
   jest używane w **DWÓCH** gałęziach:
   - `scope='this'` — `recurrence_exception_at = cutover.toISOString()`
     (`:98-121`) **oraz** `SELECT` deduplikujący (`:87-90`): wiersz-wyjątek ląduje
     w złym instancie i deduplikacja nie trafia;
   - `scope='this_and_following'` — `withUntil(..., cutover.toISOString())` (`:124`)
     **oraz** repartycja wyjątków `recurrence_exception_at >= cutover` (`:165-168`);
   - `scope='all'` — `cutover` nieużywane, brak skutku.

   **To masz ZMIERZYĆ, nie przepisać.** Pozycja A wymaga pomiaru dla `this`
   **i** `this_and_following`.

2. **★ WARIANT (a) JEST BEZPIECZNY — warunek STOP dnia 24 NIE zachodzi.**
   Instrukcja dnia 24 (§C.4) mówiła: „jeżeli **jakikolwiek** istniejący test lub
   kod frontu wysyła wartość bez strefy — to jest STOP". Sprawdziłem:
   `grep -rn "recurrenceId" src tests server/src` daje **ZERO wołających w `src/`**
   (front w ogóle nie zna tej trasy) i **wszystkie literały w testach mają sufiks
   `Z`** (`...T08:00:00.000Z`). **Warunek STOP nie zachodzi — wariant (a)
   wykonujesz.** Ale **powtarzasz ten grep u siebie i wklejasz wynik**; jeżeli
   pojawi się choć jeden wołający bez strefy — wtedy STOP.

3. **★ DRUGA DZIURA STREFOWA W TEJ SAMEJ RODZINIE.**
   `meeting.routes.ts:185`: `const RRULE_UNTIL_RE = /^[0-9]{8}(T[0-9]{6}Z?)?$/` —
   **`Z` jest OPCJONALNE**. Klient może wysłać `recurrenceRule` z
   `UNTIL=20261101T075959` (bez `Z`) i przejdzie walidację. To ta sama klasa
   defektu co P1-1. **Rozstrzygasz ją w §A.6 — z tym samym testem grepowym
   przed zmianą.**

4. **★ MODUŁ MEETINGS NIGDY NIE ROZWIJA SERII.** `materializeInstances`
   (`recurrenceEngine.ts:32`) ma **jednego** konsumenta w całym repo:
   `server/src/routes/v8/my-work.routes.ts:34` (kalendarz My Work). Trasy
   `/api/meeting` **nie wołają go w ogóle** — `GET /` zwraca surowe wiersze
   `meetings`. **Konsekwencja, którą musisz rozumieć:** w API Meetings **nie ma
   PRODUCENTA `recurrenceId`**. Nikt nie mówi klientowi, jakie wartości są
   dopuszczalne. Dlatego walidacja §A jest tanim zabezpieczeniem (nic nie psuje),
   a wiązanie okazji z siatką serii (§B) musi być policzone **w teście**, nie
   przez serwer.

5. **★ `materialTitle` MA ZERO KONSUMENTÓW W CAŁYM REPO.**
   `grep -rn "materialTitle" server/src src tests` daje **dokładnie dwa
   trafienia**, oba w `meetingBoundaryService.ts` (`:107` typ, `:188` mapper).
   Ani router, ani front, ani żaden test go nie czyta. To potwierdza zdanie
   `DEC-134` „kontrakt frontowy opisuje pole bez konsumenta". **ALE pole i tak
   wychodzi po HTTP** — `GET /:id/notes` robi `res.json({ notes })`
   (`meeting.routes.ts:1011`), więc wyciek był realny w kopercie API. Naprawa
   dnia 24 jest zasadna; brakuje jej wyłącznie dowodu (pozycja C).

6. **★ `AuthorizationError` MA W PRODUKCJI MAPOWANIE NA `403` — ale NIE przez
   ten plik, który wygląda na oczywisty.** Łańcuch, który sprawdziłem:
   - `TaskService.ts:344` rzuca `new AuthorizationError('Access to this project denied')`;
   - `server/src/types/index.ts:422` — `AuthorizationError extends AppError`,
     `super(403, message, 'AUTHORIZATION_ERROR')`;
   - `server/src/types/index.ts:391` — `AppError` ma **publiczne pole
     `statusCode`** (uwaga: to **zdeprecjonowana** kopia `AppError`; kanoniczna
     jest w `utils/ErrorHandler.ts` i ma **inną kolejność argumentów** — nie mieszaj);
   - **produkcyjny handler to `errorHandlerMiddleware` z
     `server/src/utils/ErrorHandler.ts:156`, montowany w `server/src/index.ts:1748`.**
     `server/src/middleware/errorHandler.ts` **nie jest montowany przez
     `index.ts`** — nie bierz go „bo nazwa pasuje".
   - `Gateway.ts` **nie montuje żadnego handlera błędów** — sprawdziłem.

   ⇒ Pozycja E ma zamontować **`errorHandlerMiddleware` z `utils/ErrorHandler.js`**
   za routerem i dowieść, że `403` przychodzi z produkcyjnego mapowania, a nie
   z handlera napisanego przez Ciebie. To jest sedno zarzutu „harness maskuje
   mapowanie".

7. **★ `emailService` CZYTA KONFIGURACJĘ SMTP Z TABELI `settings`, NIE TYLKO
   Z ENV.** `server/src/services/emailService.ts:168-172` robi
   `SELECT key, value FROM settings WHERE key LIKE 'smtp_%'`, a env
   (`SMTP_HOST/PORT/USER/PASS/FROM`) to dopiero **fallback** (`:180-191`).
   Realny transport to `nodemailer.createTransport` (`:204-213`), warunkowany
   `if (smtpConfig.host && smtpConfig.auth?.user)` (`:202`).
   ⇒ **W §F, ZANIM dotkniesz gałęzi live, MUSISZ udowodnić, że Twój kontener
   nie ma ani jednego wiersza `smtp_%` w `settings`.** Bez tego dowodu §F jest
   STOP-em, a nie pozycją. (Plik ma `// @ts-nocheck` w linii 1 — **nie
   „naprawiasz" tego**, to cudzy plik.)

8. **★ BRAK `TZID` W ICS JEST ŚWIADOMY — NIE JEST DEFEKTEM.**
   `server/src/utils/ics/icsBuilder.ts:112-127` niesie komentarz FIX-1 dnia 16:
   wcześniejsze `TZID=<timezone>` bez konwersji wall-clock przesuwało każde
   zaproszenie o offset strefy. Dziś emitowane jest czyste UTC z `Z`
   (`formatIcsDate`, `:54-61`) plus informacyjne `X-CONSULTIFY-TIMEZONE`
   (`:127`). Brak `VTIMEZONE`. **Odebrane `DEC-92`. Nie ruszasz.** Jeżeli
   pozycja §A skusi Cię do „przy okazji naprawmy strefę w ICS" — to jest STOP.

9. **★ TRAS JEST 32, NIE 31.** Dzień 24 zinwentaryzował 31 i sam dodał jedną
   (funnel `POST /:id/notes/:noteId/action-items/:index/task`,
   `meeting.routes.ts:1110`). Na markerze
   `grep -c "^router\.\(get\|post\|patch\|put\|delete\)" server/src/routes/meeting.routes.ts`
   daje **32**. Plik ma **1299 linii**.

10. **★ PIĘTNAŚCIE Z TRZYDZIESTU DWÓCH TRAS NIE MA KONSUMENTA FRONTOWEGO.**
    Front woła moduł wyłącznie przez `src/services/api.ts:3538-3745`
    (siedemnaście kształtów). **Bez konsumenta są m.in.:** wszystkie
    `/:id/participants*`, `POST /:id/invitations/send` (cała ścieżka ICS/e-mail
    jest nieosiągalna z UI), wszystkie `/:id/attachments*`,
    `POST /:id/notes/:noteId/materialization/retry`,
    `POST /:id/notes/:noteId/action-items/:index/task` (funnel dnia 24),
    **`PATCH` i `DELETE /:id/occurrence`** oraz trzy trasy legacy
    (`/:id/decisions`, `/:id/follow-ups`, `/:meetingId/follow-ups/:followUpId`).
    **Tę liczbę PRZELICZASZ SAM w BLOKU 0 pkt 8 — nie przepisujesz jej.**

11. **★ `meetings.start_at` TO KOLUMNA `TEXT`.**
    `server/migrations/20260623_meetings_baseline.sql:30` — `start_at TEXT NOT NULL`.
    Baza przechowuje **dosłownie to, co przyszło**, więc w bazie **może** leżeć
    `start_at` bez sufiksu strefy. To znaczy, że gałąź bez RRULE w silniku
    (`recurrenceEngine.ts:49`, `recurrenceId: seriesStartAt`) może wyprodukować
    `recurrenceId` bez strefy. **To jest ZNALEZISKO, nie Twoja naprawa** —
    naprawa oznaczałaby zmianę kontraktu `POST /` i `PUT /:id` (STOP wg §0.5).
    Wpisujesz do „Znalezisk" z tą analizą.

12. **★ MODUŁ MEETINGS NIE UŻYWA `effectiveAccessService` W OGÓLE.**
    `grep "effectiveAccess\|requireCapability\|capability" server/src/routes/meeting.routes.ts`
    = **zero trafień**. Autoryzacja opiera się wyłącznie na lokalnych helperach
    tego routera: `getMeetingUserRole` (`:124`), `requireMeetingAdmin` (`:128`),
    `isMeetingAdmin` (`:137`), `canAccessMeeting` (`:147`), `denyMeetingAccess`
    (`:159`). **Z16 jest zakazem DOTYKANIA, nie zaproszeniem do wpięcia** —
    wpięcie `effectiveAccessService` w Meetings to osobna decyzja produktowa
    i **poza zakresem**.

13. **★ REJESTR DECYZJI URÓSŁ.** Na markerze ma **192 linie**, a ostatnia
    decyzja to `DEC-2026-08-27-141`. Dzień 24 raportował 180. Rozbieżność jest
    **oczekiwana** (rejestr rośnie) — nie zgłaszaj jej jako defektu, tylko
    zapisz zmierzoną liczbę.

14. **★ NAJWYŻSZY WIDOCZNY NUMER MIGRACJI TO `20261123`.** Przedział
    `20261170`–`20261179` jest pusty. `20261124`–`20261169` **nie jest wolne**,
    mimo że `ls` go nie pokazuje (§0.3 pkt 2).

### 1.3. ZAKRES — dokładnie sześć pozycji roboczych + dwie dokumentacyjne

| Poz.  | Nazwa                                                                    | Rodowód                | Rodzaj             |
| ----- | ------------------------------------------------------------------------ | ---------------------- | ------------------ |
| **A** | Jawna strefa w `recurrenceId` → `400 INVALID_OCCURRENCE`                 | `DEC-134` P1-1 (C.3)   | kod + testy        |
| **B** | Dowód DST związany z REALNĄ siatką serii, nie z własną formułą           | `DEC-134` P2 (C.2)     | test (rozbudowa)   |
| **C** | `materialTitle` — pełny pakiet dowodowy + retry bez `userId`             | `DEC-134` P1-2, P2 (D) | testy + 1 poprawka |
| **D** | Bramka occurrence — pełne osiem przypadków + spy mailera                 | `DEC-134` (E)          | test (rozbudowa)   |
| **E** | Funnel — pełne osiem + `replayed` pod wyścigiem + realne mapowanie błędu | `DEC-134` P2 (F)       | testy + 1 poprawka |
| **F** | Częściowa awaria wysyłki — w reżimie strażników                          | dług dnia 24 (G)       | test               |
| R.1   | `MODULE_ACCEPTANCE.md` 08_MEETINGS — atomowy wpis                        | —                      | dokument           |
| R.2   | Raport dyżuru                                                            | —                      | dokument           |

**Kolejność priorytetu, gdyby zabrakło czasu: A → C → E → D → B → F.**
A jest jedyną pozycją, która naprawia realne, ciche zafałszowanie danych.
F jest jedyną, która dotyka gałęzi wysyłki — jeżeli czegokolwiek masz **nie**
zrobić, to F, i wtedy piszesz uczciwe `NIE_ZACZĘTE`, **nigdy** nie udajesz.

### 1.4. POZA ZAKRESEM — jawnie, żebyś nie zaczął

- **Macierz dostępu G.2** (75 komórek, `NIE_ZACZĘTE` w dniu 24) — `DEC-134`
  spakował do bloku 4 **wyłącznie** C.3/C.2/D/E-F. Macierz wymaga wstrzyknięcia
  stanu `open`, czyli dotknięcia bramki beta — osobna decyzja. **Nie zaczynasz.**
- **Pakiet 13 tras × 4 (pozycja B dnia 24)** — jw., poza pakietem `DEC-134`.
- **Otwarcie modułu dla ról klienckich** — bramka właściciela.
- **Rozwijanie serii w API Meetings** / wpięcie `materializeInstances` — nowa
  funkcja, nie dług dowodowy.
- **Konwersja wall-clock / TZID w ICS / `VTIMEZONE`** — świadomie usunięte
  `DEC-92` (§1.2 poz. 8).
- **Walidacja strefy w `POST /` i `PUT /:id`** — zmiana kontraktu tworzenia
  spotkania (§0.5, STOP z propozycją).
- **`idempotencyKey` w `createInitiativeService`** — `BRAK_API` wg `DEC-108`.
- **Jakikolwiek front**: `MeetingHub.tsx` (1732 linie), `MeetingObjectPage.tsx`
  (1292 linie), `src/services/api.ts` — **czytasz, nie zmieniasz**.
- **Wpięcie `effectiveAccessService` do Meetings** (§1.2 poz. 12).
- **Sprzątanie martwych tras** — 15 tras bez konsumenta to znalezisko dla
  nadzorcy, nie Twoja robota. **Nie kasujesz ani jednej.**

### 1.5. Decyzje wiążące (nie podważasz ich w kodzie ani w raporcie)

| Decyzja                                | Co wiąże                                                                                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEC-2026-08-25-58` (ledger `:110`)    | `PATCH /:id/status` **nie ma** `requireMeetingAdmin` — zdjęto ją świadomie (`FIX-M-3`). **Nie przywracasz.**                                                         |
| `DEC-2026-08-26-92` (ledger `:144`)    | ICS w UTC z `Z`, bez `TZID`/`VTIMEZONE`; whitelist RRULE; `STATUS:CANCELLED`; folding 75 oktetów; strażniki mailera. **Nie ruszasz.**                                |
| `DEC-2026-08-26-111` (ledger `:163`)   | Realne odwołanie serii przez `recurrence_status='cancelled'` (bez `DELETE`); precondition retry; `H.2` Initiatives = `BRAK_API`.                                     |
| `DEC-2026-08-26-134` (ledger `:185`)   | Podział bramek occurrence: `PATCH` = admin **lub** twórca (`404` przy odmowie), `DELETE` = `requireMeetingAdmin` (`403`). **Nie zmieniasz podziału** — dowodzisz go. |
| `DEC-2026-08-26-104` / `-107` / `-108` | Z20 / Z21 / Z22 + Z23.                                                                                                                                               |
| `DEC-65`                               | Zero Railway, zero zdalnych baz/migracji, zero realnych wysyłek.                                                                                                     |

### 1.6. Podział FRONT / TYŁ — co robisz Ty, co robotnik frontowy

Ty budujesz **TYŁ**. Dla każdej pozycji, która zmienia kształt odpowiedzi API
albo kod błędu, wpisujesz do raportu **kontrakt dla robotnika frontowego**
w formacie:

```
| Trasa | Metoda | Body | Odpowiedź (pola) | Kody błędów | Co front ma pokazać |
```

W szczególności **musisz** dostarczyć kontrakt dla:

- **A** — nowy kod odmowy `400 INVALID_OCCURRENCE` z powodem „brak jawnej strefy",
  wraz z **jednoznaczną instrukcją, w jakim formacie front ma wysyłać
  `recurrenceId`** (to jest realna wartość dla przyszłego robotnika frontowego,
  bo dziś API **nie ma producenta** tej wartości — §1.2 poz. 4);
- **C** — `materialTitle` może być `null` mimo `materialArtifactId != null`
  (front **nie może** wtedy renderować linku do materiału) + jawne stwierdzenie,
  że **dziś pola nikt nie czyta**;
- **E** — semantyka `replayed` (a jeżeli §E.2 skończy się STOP-em: **jawne
  ostrzeżenie, że `replayed` jest best-effort i front nie może na nim opierać
  komunikatu**) + kod `403` dla braku dostępu do projektu.

**Nie tworzysz kluczy i18n dla napisów UI.** Tworzysz je wyłącznie dla
komunikatów, które faktycznie wychodzą z Twojego API — i wtedy parytet PL+EN
w tym samym commicie.

### 1.7. Mapa plików, które Cię obchodzą (stan zweryfikowany na markerze)

```
TRASY
  server/src/routes/meeting.routes.ts                       1299 linii, 32 trasy
    :90-101   statusForSpineErrorCode — mapowanie kodów kręgosłupa na HTTP
    :124-159  getMeetingUserRole / requireMeetingAdmin / isMeetingAdmin /
              canAccessMeeting / denyMeetingAccess   ← lokalny model uprawnień modułu
    :185      RRULE_UNTIL_RE — ★ `Z` OPCJONALNE (pozycja A.6)
    :186-231  validateRecurrenceRule — whitelist RRULE (FIX-2 dnia 16)
    :234-241  isValidIanaTimezone — Intl.DateTimeFormat, użyte w POST / i PUT /:id
    :259-262  router.use(verifyToken) → isAuthenticated → closedBetaModuleGate → ensureMeetingTables
    :531      POST /:id/invitations/send                   ← pozycja F
    :996-1012 GET /:id/notes  (res.json({notes}) w :1011)  ← pozycja C
    :1030     POST /:id/notes/:noteId/decision             ← pozycja C (druga ścieżka odczytu)
    :1079     POST /:id/notes/:noteId/materialization/retry ← pozycja C.3
    :1110-1151 POST /:id/notes/:noteId/action-items/:index/task ← pozycja E
              (★ catch łapie TYLKO MeetingNoteTaskFunnelError; reszta leci `throw`)
    :1228-1287 handleOccurrenceMutation                    ← pozycje A i D
              :1233-1243 walidacja (pusty / CRLF / scope) — ★ BEZ strefy
              :1251-1256 bramki: cancel → requireMeetingAdmin; edit → admin|twórca
              :1266-1279 sendMeetingInvitations PO bramce (strukturalna gwarancja Z22)
    :1290/1294 PATCH / DELETE /:id/occurrence

SERWISY
  server/src/services/meeting/meetingOccurrenceService.ts   178 linii
    :12-18    recurrenceUntilBefore — new Date(recurrenceId) − 1 s → UTC      ← pozycja A
    :20-26    withUntil — podmiana UNTIL= w regule
    :44-46    cutover = new Date(recurrenceId); guard tylko NaN + CRLF        ← pozycja A
    :66-83    scope='all'   (recurrence_status='cancelled' na masterze)
    :87-121   scope='this'  (recurrence_exception_at = cutover)               ← pozycja A
    :124-169  scope='this_and_following' (UNTIL + split + repartycja)         ← pozycje A, B
  server/src/services/meetingBoundary/meetingBoundaryService.ts
    :107,:188 materialTitle — typ i mapper (★ ZERO innych konsumentów w repo)
    :274-315  getMeetingNote (resolver: :304-315)                             ← pozycja C
    :320-369  listMeetingNotesForMeeting (resolver z cache Map: :351-369)     ← pozycja C
    :871-877  retryMeetingNoteMaterialization → getMeetingNote(input) w :877         ← pozycja C.3
              ★ input NIE ma userId ani roleKey → materialTitle zawsze null
    :699-700  wzorzec ścieżki uprzywilejowanej: userId: materializedBy, roleKey: 'owner'
  server/src/services/meeting/meetingNoteTaskFunnelService.ts   95 linii
    :50-53    pre-SELECT po idempotency_key
    :83       ★ replayed = Boolean(replayBefore.rows[0])  ← pozycja E.2 (wyścig)
    :86-92    catch: TASK_IDEMPOTENCY_COLLISION → błąd; 23505 → retry z replayed:true
  server/src/services/meeting/meetingInvitationService.ts   152 linie (NIE ZMIENIASZ)
    :20-23    isLiveTransportEnabled — MEETING_INVITES_LIVE==='true' && SMTP_HOST && SMTP_USER
    :42       demoOrgId = process.env.DEMO_ORG_ID || 'demo-org'
    :75-84    blocked_demo  (organizationId === demoOrgId)
    :85-94    captured      (!live)  — pełny ICS leci WYŁĄCZNIE do logger.debug
    :96-123   live          (try/catch PER ODBIORCĘ, FIX-7 dnia 16)           ← pozycja F
    :125      setParticipantDelivery
    :130-148  INSERT INTO meeting_invitation_deliveries  { fallback: false }
  server/src/services/emailService.ts                     241 linii (NIE ZMIENIASZ)
    :1        // @ts-nocheck  (nie „naprawiasz")
    :168-172  ★ SELECT key,value FROM settings WHERE key LIKE 'smtp_%'
    :180-191  fallback na env SMTP_*
    :202-213  nodemailer.createTransport + sendMail  ← REALNY TRANSPORT
  server/src/utils/ics/icsBuilder.ts                      154 linie (NIE ZMIENIASZ)
    :112-127  komentarz FIX-1: świadome UTC bez TZID + X-CONSULTIFY-TIMEZONE
  server/src/services/v8/recurrenceEngine.ts              192 linie (Z16 — CZYTASZ)
    :32       materializeInstances (★ jedyny konsument: routes/v8/my-work.routes.ts:34)
    :49,:139  recurrenceId = seriesStartAt (surowe z bazy!)
    :94-111   recurrenceId = occ.toISOString() → ZAWSZE z 'Z'
    :147-152  formatRRuleDate — DTSTART w UTC bez TZID
    :158      parseRRule    :170  validateRecurrenceModel

MAPOWANIE BŁĘDÓW (pozycja E)
  server/src/types/index.ts:391          AppError (kopia zdeprecjonowana) — public statusCode
  server/src/types/index.ts:422          AuthorizationError → 403 / AUTHORIZATION_ERROR
  server/src/services/TaskService.ts:344 throw new AuthorizationError(...)
  server/src/utils/ErrorHandler.ts:156   ★ errorHandlerMiddleware — PRODUKCYJNY
  server/src/index.ts:1748               app.use(errorHandlerMiddleware)   ← jedyny montaż
  server/src/middleware/errorHandler.ts  ← NIE jest montowany przez index.ts. Nie bierz go.

BRAMKI
  src/utils/betaAccess.ts:53             MODULE_MEETING: 'closed'  (TYLKO ODCZYT)
  server/src/middleware/betaGate.middleware.ts   closedBetaModuleGate
  server/src/Gateway.ts:193 / :769       import + app.use('/api/meeting', meetingRoutes)

FRONT (TYLKO ODCZYT)
  src/services/api.ts:3538-3745          jedyny klient /api/meeting (17 kształtów)
  src/components/Meeting/MeetingHub.tsx        1732 linie
  src/components/Meeting/MeetingObjectPage.tsx 1292 linie

TESTY, KTÓRE MUSZĄ ZOSTAĆ ZIELONE
  server/src/services/meeting/__tests__/meetingDay16.pg.test.ts:166,182   strażnicy mailera (not.toHaveBeenCalled)
  tests/unit/backend/middleware/meetingBetaGate.test.ts                    asercja na źródle routera (kolejność router.use)
  tests/unit/meeting/meetingCaptureDefaultOff.contract.test.ts             kontrakt braku nagrywania
  tests/integration/routes/meeting.occurrence-cancel.postgres.integration.test.ts
  tests/integration/routes/meeting.day19.postgres.integration.test.ts

TESTY, KTÓRE ROZBUDOWUJESZ (nie osłabiasz — §0.4a pkt 7)
  tests/integration/routes/meeting.day24.dst-split.postgres.integration.test.ts          (pozycja B)
  tests/integration/routes/meeting.day24.occurrence-role-gate.postgres.integration.test.ts (pozycja D)
  tests/integration/routes/meeting.day24.task-funnel.postgres.integration.test.ts        (pozycja E)
```

### 1.8. Pułapki, na które wpadli poprzednicy (nie powtarzaj)

1. **Dzień 19, P0:** trasa zwracała `200` i rozsyłała `CANCEL`, nie zmieniwszy
   nic w bazie. **Lekcja:** dowód zmiany w bazie **przed** dowodem efektu (Z22).
2. **Dzień 19, P1:** „98/98 PASS" na wybranym podzbiorze przy 189/193
   w rzeczywistym zakresie. **Lekcja:** Z23.
3. **Dzień 18, P0:** 8/8 testów zielonych nad martwym kodem, bo każdy wstrzykiwał
   własne zależności. **Lekcja:** Z21.
4. **★ Dzień 24, P1-1 — NAJWAŻNIEJSZA DLA CIEBIE:** raport zadeklarował decyzję
   („C.4(b) test+errata"), której **w repo nie było**. To jest jedyny rodzaj
   błędu, którego odbiór nie wybacza: **deklaracja bez artefaktu**. Zanim
   napiszesz w raporcie „zdecydowałem X" — upewnij się, że w diffie jest plik,
   który to X realizuje.
5. **★ Dzień 24 — higiena commitów:** cztery pozycje w jednym commicie
   `908ec7434d`. To był **dodatkowy powód nieprzyznania DoD**. Commit per
   pozycja, twardo.
6. **★ Ten dyżur, nowa pułapka — DWA `AppError`.** `server/src/types/index.ts:391`
   i `server/src/utils/ErrorHandler.ts` to **dwie różne klasy o tej samej nazwie
   i różnej kolejności argumentów konstruktora**. `TaskService` importuje wersję
   z `types/index.js`. Nie mieszaj ich w teście.
7. **★ Ten dyżur, nowa pułapka — DWA „errorHandler".** Produkcyjny to
   `errorHandlerMiddleware` z `utils/ErrorHandler.ts`. `middleware/errorHandler.ts`
   wygląda kanonicznie, ale `index.ts` go nie montuje. Zamontowanie tego drugiego
   w teście to **dokładnie ten sam błąd, co harness dnia 24** (Z21).
8. **★ Ten dyżur, nowa pułapka — `settings` w bazie bije env.** §1.2 poz. 7.
   Test §F, który ustawi env i uzna, że „skoro env kontroluje transport, to jest
   bezpiecznie", myli się: `emailService` najpierw pyta bazy.
9. **★ Ten dyżur, nowa pułapka — test dnia 24 asertuje formułę przeciwko samej
   sobie.** `meeting.day24.dst-split...test.ts:74` liczy oczekiwaną wartość jako
   `new Date(recurrenceId) - 1000`, czyli **tą samą formułą, którą testuje**
   (`meetingOccurrenceService.ts:13`). Test przechodzi dla **dowolnego**
   `recurrenceId`, także takiego, który nie jest okazją serii. Pozycja B to
   naprawia.
10. **★ `TaskService.createTask` czyta `organization_id` z tabeli `users`** i rzuca
    `NotFoundError('User organization')`, gdy wiersza nie ma. Test funnela **musi**
    założyć realne wiersze `organizations` + `users` (wzorzec
    `meetingBoundaryMountedAuth.pg.test.ts`), a nie tylko mockować nagłówki.
11. **★ `projectId` w `CreateTaskSchema` jest walidowane jako UUID.** Funnel już
    to obchodzi (`meetingNoteTaskFunnelService.ts` — `isUuid(input.projectId) ? ... : null`).
    **Nie „upraszczaj" tego.**

---

## BLOK 0 — START (wykonaj po kolei, ZANIM napiszesz pierwszą linię kodu)

1. **Marker i gałąź** — §0.1 pkt 2, 5. Wynik obu komend do raportu.

2. **Zależności — symlink, nie instalacja (`DEC-86`).**

   ```bash
   cd /private/tmp/consultify-meetings-day28
   ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules node_modules
   ls node_modules/.bin/vitest && echo "DEPS OK"
   ```

   To **jedyny** dozwolony kontakt z chronionym katalogiem (Z5), wyłącznie do
   odczytu. `npm ci` w worktree jest niewskazane.

3. **Kontener PG — NAJPIERW baza, POTEM jakikolwiek pomiar (Z19 / `DEC-96`).**

   ```bash
   docker run -d --name cx-day28-pg \
     -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day28 \
     -p 5507:5432 pgvector/pgvector:pg16
   sleep 8
   docker exec cx-day28-pg psql -U postgres -d cx_day28 -c "SELECT current_database(), inet_server_port();"
   ```

   **Obraz `pgvector/pgvector:pg16` jest OBOWIĄZKOWY.** `postgres:15` nie ma
   rozszerzenia `vector` i **nie przechodzi migracji** — cały pomiar poleci
   w gruz na losowym pliku i stracisz godzinę na diagnozę cudzego problemu.

4. **Pełne migracje projektu — dwa przebiegi + dry-run.**

   ```bash
   DATABASE_URL="postgres://postgres:cx@localhost:5507/cx_day28" DB_TYPE=postgres NODE_ENV=test \
     npx tsx server/scripts/migrate.postgres.ts --strict 2>&1 | tail -20   # przebieg 1
   DATABASE_URL="postgres://postgres:cx@localhost:5507/cx_day28" DB_TYPE=postgres NODE_ENV=test \
     npx tsx server/scripts/migrate.postgres.ts --strict 2>&1 | tail -5    # przebieg 2: MUSI być 0
   DATABASE_URL="postgres://postgres:cx@localhost:5507/cx_day28" DB_TYPE=postgres NODE_ENV=test \
     npx tsx server/scripts/migrate.postgres.ts --dry-run 2>&1 | tail -5   # Pending: 0
   ```

   Liczby z przebiegów 1/2/dry są obowiązkową pozycją raportu (dzień 24 podał
   `851 / 0 / 0`).

5. **Sprawdzenie obiektów, na których stoją Twoje pozycje.**

   ```bash
   docker exec cx-day28-pg psql -U postgres -d cx_day28 -c "\d meetings" | grep -E "start_at|recurrence_|split_from|timezone"
   docker exec cx-day28-pg psql -U postgres -d cx_day28 -c "\d meeting_note_materializations"
   docker exec cx-day28-pg psql -U postgres -d cx_day28 -c "\d meeting_invitation_deliveries"
   docker exec cx-day28-pg psql -U postgres -d cx_day28 -c "\di idx_tasks_idempotency_org"
   docker exec cx-day28-pg psql -U postgres -d cx_day28 -c "\d v8_output_artifacts" | grep -E "title_snapshot|origin_record_id"
   # ★ WARUNEK POZYCJI F (§1.2 poz. 7) — MUSI być 0 wierszy:
   docker exec cx-day28-pg psql -U postgres -d cx_day28 -c "SELECT count(*) FROM settings WHERE key LIKE 'smtp_%';"
   ```

   Brak `idx_tasks_idempotency_org` → **STOP pozycji E** z wpisem.
   Niezerowa liczba wierszy `smtp_%` → **STOP pozycji F** z wpisem.

6. **Namespace migracji — sprawdź i zapisz.**

   ```bash
   ls server/migrations | grep -E '^202611[0-9]{2}' | sort | tail -5
   ls server/migrations | grep '^2026117'   # MUSI być puste
   ```

7. **Weryfikacja stanu wejściowego z §0.1 pkt 4** — wszystkie `grep`/`sed`/`wc`,
   wynik do raportu, porównany z §1.7.

8. **★ INWENTARZ ENDPOINTÓW I KONSUMENTÓW — obowiązkowy, robisz go TERAZ,
   PRZED pierwszą linią kodu (lekcja `DEC-2026-08-26-117`).**

   Powód, dla którego to jest osobny krok, a nie ozdobnik: w module Audytów
   robotnik zbudował ekran, który wołał **inny renderer niż ten, którego treść
   była plombowana hashem** — bo nie sprawdził, kto co woła. Ty pracujesz
   w module, w którym **piętnaście z trzydziestu dwóch tras nie ma konsumenta**.
   Bez tej mapy nie odróżnisz „naprawiłem" od „naprawiłem coś, czego nikt nie
   używa" — a to jest różnica między `ZROBIONE_WG_DoD` a `CZĘŚCIOWO`.

   ```bash
   # (a) wszystkie trasy modułu, z numerami linii
   grep -n "^router\.\(get\|post\|patch\|put\|delete\)" -A 1 server/src/routes/meeting.routes.ts

   # (b) wszystko, co front wysyła pod /api/meeting
   grep -n 'API_URL}/meeting' src/services/api.ts

   # (c) kto w src/ woła te metody klienta
   grep -rn "getMeetings\|getMeeting(\|createMeeting\|updateMeeting\|deleteMeeting\|generateNotes\|MeetingNotes\|decision-records\|follow-up-records" src/components src/services | grep -v __tests__

   # (d) trasy, których szukasz szczególnie — czy ktokolwiek je woła
   grep -rn "occurrence\|invitations/send\|/participants\|/attachments\|materialization/retry\|action-items" src/ | grep -v __tests__
   ```

   **Produkt tego kroku (obowiązkowa tabela w raporcie):**

   | #   | Metoda + ścieżka | linia w routerze | woła to (plik:linia w `src/`) albo `BRAK KONSUMENTA` |
   | --- | ---------------- | ---------------- | ---------------------------------------------------- |

   Na końcu tabeli podajesz **dwie liczby**: ile tras ma konsumenta i ile nie ma.
   §1.2 poz. 9-10 podaje moje: **32 trasy, 15 bez konsumenta**. **Jeżeli u Ciebie
   wychodzi inaczej — Twoja liczba jest prawdziwa, moja idzie do „Korekt".**

9. **★ BASELINE — PRZED pierwszym commitem, komplet komend §0.4a.**
   Zapisz liczby **per plik**. Bez tego nie odróżnisz zastanego od wprowadzonego
   i cały raport jest nieweryfikowalny (`DEC-108`, P1). Baseline uruchamiasz
   **z kompletem pięciu zmiennych**.

10. **Sprzątanie na końcu dyżuru (obowiązkowe, wpis do raportu):**

    ```bash
    docker rm -f cx-day28-pg
    docker volume prune -f
    ```

---

## A. JAWNA STREFA W `recurrenceId` (C.3 — P1-1 z `DEC-134`)

### A.1. Defekt — stan zweryfikowany

Walidacja wejścia (`meeting.routes.ts:1233-1243`) sprawdza **trzy** rzeczy:
niepustość, brak `CR/LF`, poprawność `scope`. Serwis
(`meetingOccurrenceService.ts:44-46`) dokłada **jedną**: `Number.isFinite`.

Dla ciągu ISO **bez** sufiksu strefy (`'2026-11-01T08:00:00'`):

- `Number.isFinite(new Date('2026-11-01T08:00:00').getTime())` → **`true`**,
  czyli **przechodzi obie walidacje**;
- JavaScript interpretuje tę wartość jako **czas lokalny procesu**, więc
  `cutover` przesuwa się o offset maszyny, na której działa serwer.

**Skutek nie jest błędem widocznym — jest cichym rozjazdem danych.**

### A.2. Zasięg — TRZY gałęzie, nie jedna (errata §1.2 poz. 1)

| `scope`              | Gdzie `cutover` wchodzi w dane                                                                   | Skutek rozjazdu                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `this`               | `recurrence_exception_at = cutover.toISOString()` (`:98-121`) **oraz** `SELECT` dedup (`:87-90`) | Wyjątek ląduje w złym instancie; deduplikacja nie trafia → duplikat     |
| `this_and_following` | `withUntil(rule, cutover.toISOString())` (`:124`) **oraz** repartycja `>= cutover` (`:165-168`)  | Seria ucięta w złym momencie; część wyjątków przypięta do złego rodzica |
| `all`                | `cutover` nieużywane                                                                             | Brak skutku                                                             |

**Masz to ZMIERZYĆ dla `this` i `this_and_following`, nie przepisać z tabeli.**

### A.3. Pomiar PRZED naprawą — warunek pozycji

Nie wolno Ci naprawić przed zmierzeniem. Dowód rozjazdu jest **osobnym
artefaktem** i wchodzi do raportu jako tabela liczb.

1. Napisz test (nowy plik
   `tests/integration/routes/meeting.day28.occurrence-timezone.postgres.integration.test.ts`,
   `git add -f`), który:
   - zakłada serię cotygodniową ze `startAt` w **`Europe/Warsaw`**;
   - wysyła `PATCH /:id/occurrence` z `recurrenceId` **bez strefy**,
     raz ze `scope: 'this'`, raz ze `scope: 'this_and_following'`;
   - **odczytuje faktyczny stan bazy niezależnym `pg.Pool`**:
     dla `this` → `recurrence_exception_at` wiersza-wyjątku;
     dla `this_and_following` → `recurrence_rule` mastera (wartość `UNTIL=`).
2. Uruchom **ten sam test dwa razy**, zmieniając wyłącznie strefę procesu
   (zmienna `TZ` **w tej samej linii komendy**, obok kompletu pięciu zmiennych
   z Z19):

   ```bash
   TZ=UTC            ENV npx vitest run tests/integration/routes/meeting.day28.occurrence-timezone.postgres.integration.test.ts
   TZ=Europe/Warsaw  ENV npx vitest run tests/integration/routes/meeting.day28.occurrence-timezone.postgres.integration.test.ts
   ```

3. **Do raportu idzie tabela czterech wartości** (2 scope × 2 strefy),
   dosłownie odczytanych z bazy, plus wyliczona różnica w godzinach.
   **Jeżeli różnicy NIE MA — to jest wynik cenny i piszesz to wprost**: zarzut
   P1-1 nie potwierdza się w tej postaci, i **wtedy nie naprawiasz**, tylko
   opisujesz (STOP pozycji A z pełnymi liczbami).

### A.4. Naprawa — wariant (a), preferowany przez `DEC-134`

**Zanim tkniesz kod — powtórz grep bezpieczeństwa i wklej wynik do raportu:**

```bash
grep -rn "recurrenceId" src tests server/src | grep -v node_modules
```

- **Jeżeli w `src/` (front) jest choć jeden wołający — STOP.** Zmiana kontraktu
  wywaliłaby żywy ekran.
- **Jeżeli w `tests/` jest choć jeden literał `recurrenceId` BEZ sufiksu strefy
  (poza Twoim własnym testem z §A.3) — STOP.** Nie „poprawiasz cudzego testu",
  żeby przepuścić własną zmianę.
- Na markerze sprawdziłem: **front zero, wszystkie literały testowe z `Z`**
  (§1.2 poz. 2). Spodziewam się, że u Ciebie wyjdzie tak samo — ale to Twój
  grep decyduje, nie mój.

**Implementacja — dokładnie jedno miejsce, addytywnie:**
`handleOccurrenceMutation` w `server/src/routes/meeting.routes.ts`, w istniejącym
bloku walidacji (`:1233-1243`), **bez dodawania `router.use`**:

```
recurrenceId musi mieć jawną strefę: sufiks 'Z' albo '±HH:MM'
  → w przeciwnym razie 400 { error: <komunikat>, code: 'INVALID_OCCURRENCE' }
```

Kod odmowy to **`INVALID_OCCURRENCE`** — ten sam, którego trasa już używa
(`:1242`), więc kontrakt kodów błędów **nie rośnie**. Komunikat tekstowy ma
powiedzieć **co jest nie tak i jak ma być** („recurrenceId must carry an explicit
time zone (…Z or ±HH:MM)"). i18n PL+EN w tym samym commicie, jeżeli komunikat
wychodzi z API jako tekst dla użytkownika.

### A.5. Czy dokładać strażnik w serwisie?

`meetingOccurrenceService.ts:44-46` już rzuca `INVALID_RECURRENCE_ID` przy `NaN`,
a router mapuje `INVALID_*` na `400` (`:1285`). Dołożenie tam **tego samego**
wymogu strefy jest dopuszczalne **wyłącznie jako addytywny strażnik obrony
w głąb** i **tylko jeśli**:

- nie zmienia żadnej istniejącej ścieżki na `500`;
- masz test, który dowodzi, że komunikat i kod HTTP są takie same jak z routera;
- wpisujesz w raporcie, dlaczego uznałeś to za potrzebne.

**Domyślnie: NIE dokładasz.** Jedno miejsce walidacji jest lepsze niż dwa
rozjeżdżające się. `recurrenceEngine.ts` — **ZAKAZ bezwzględny** (Z16).

### A.6. Druga dziura w tej samej rodzinie — `UNTIL` bez `Z` (errata §1.2 poz. 3)

`meeting.routes.ts:185` — `RRULE_UNTIL_RE = /^[0-9]{8}(T[0-9]{6}Z?)?$/`.

1. **Zmierz:** wyślij `changes.recurrenceRule` z `UNTIL=20261101T075959` (bez `Z`)
   i sprawdź, czy przechodzi walidację i co ląduje w `recurrence_rule`.
2. **Grep bezpieczeństwa** (ta sama reguła co w §A.4):

   ```bash
   grep -rn "UNTIL=" src tests server/src | grep -v node_modules
   ```

   `withUntil` (`meetingOccurrenceService.ts:20-26`) produkuje wartość
   z `toISOString()`, czyli **zawsze z `Z`** — więc własna produkcja serwera jest
   bezpieczna. Pytanie dotyczy **cudzych wołających**.

3. **Rozstrzygnięcie:**
   - **wszyscy wołający mają `Z`** → zaostrzasz regex do wymagania `Z`
     (`/^[0-9]{8}(T[0-9]{6}Z)?$/`), z testem pozytywnym i negatywnym;
   - **którykolwiek nie ma** → **NIE zaostrzasz**, wpisujesz do „Znalezisk"
     z propozycją kontraktu i uzasadnieniem.

   Obie ścieżki są poprawne. **Niepoprawne jest przemilczenie.**

### A.7. Testy (minimum sześć), realny router + realny PG

| #   | Przypadek                                                     | Oczekiwanie                                                                                              |
| --- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | `recurrenceId` z `Z`, `scope='this'`                          | `200`, wiersz-wyjątek na właściwym instancie (readback)                                                  |
| 2   | `recurrenceId` z `+01:00`, `scope='this_and_following'`       | `200`, `UNTIL` poprawny (readback)                                                                       |
| 3   | `recurrenceId` **bez strefy**, `scope='this'`                 | `400 INVALID_OCCURRENCE`, **zero wierszy dodanych** (count przed/po)                                     |
| 4   | `recurrenceId` **bez strefy**, `scope='this_and_following'`   | `400 INVALID_OCCURRENCE`, `recurrence_rule` mastera **niezmieniona**                                     |
| 5   | `recurrenceId` **bez strefy**, `scope='all'`, metoda `DELETE` | `400`, **`recurrence_status` mastera niezmieniony** i **`sendMeetingInvitations` NIEWOŁANE** (spy — Z22) |
| 6   | ten sam pakiet uruchomiony `TZ=UTC` **i** `TZ=Europe/Warsaw`  | identyczne wyniki w obu strefach                                                                         |

Przypadek 5 jest krytyczny: odmowa, po której poszedłby `CANCEL`, byłaby tą samą
klasą błędu co P0 dnia 19.

### A.8. DoD pozycji A

1. Tabela pomiaru PRZED naprawą (4 wartości + różnice), z komendami.
2. Wynik grepu bezpieczeństwa (§A.4) wklejony dosłownie.
3. Zmiana **wyłącznie** w `meeting.routes.ts` (ewentualnie strażnik §A.5
   z uzasadnieniem).
4. Sześć testów wyżej, zielone, oba przebiegi `TZ`.
5. Rozstrzygnięcie §A.6 (zaostrzenie albo znalezisko) — **jawne**.
6. Kontrakt dla frontu (§1.6) z formatem `recurrenceId`.
7. `meeting.occurrence-cancel...test.ts`, `meeting.day19...test.ts`,
   `meeting.day24.dst-split...test.ts` i `meeting.day24.occurrence-role-gate...test.ts`
   **nadal zielone** (wszystkie ich literały mają `Z`, więc powinny przejść;
   **jeżeli nie przechodzą — Twoja walidacja jest za szeroka**).

---

## B. DOWÓD DST ZWIĄZANY Z REALNĄ SIATKĄ SERII (C.2 — P2 z `DEC-134`)

### B.1. Defekt jest w TEŚCIE, nie w kodzie

`tests/integration/routes/meeting.day24.dst-split.postgres.integration.test.ts:74`
liczy wartość oczekiwaną tak:

```ts
const expected = new Date(new Date(scenario.recurrenceId).getTime() - 1000);
```

To jest **dosłownie ta sama formuła**, co `recurrenceUntilBefore`
(`meetingOccurrenceService.ts:13`). Test asertuje implementację przeciwko samej
sobie. Rejestr nazywa to precyzyjnie:

> „test DST wiąże tylko formułę `UNTIL=recurrenceId−1s`, **NIE wiąże okazji
> z granicą czasu** (mutacja: niezgodny z DST `recurrenceId` przechodzi)"

**Dowód mutacyjny, który masz wykonać PIERWSZY:** podaj `recurrenceId` przesunięty
o **+1 h** względem realnej okazji serii (czyli instant, który **nie jest** żadnym
wystąpieniem) i pokaż, że test dnia 24 **nadal przechodzi**. Wynik (dosłowny
`stdout`) idzie do raportu **przed** jakąkolwiek naprawą.

### B.2. Co ma powstać

Rozbudowa istniejącego pliku dnia 24 (**nie osłabiasz jego asercji — dokładasz**),
w której wartość oczekiwana jest liczona **niezależnie od produkcyjnej formuły**:

1. Test sam wylicza **realną siatkę okazji serii** z `DTSTART` + `RRULE`, używając
   pakietu `rrule` **w pliku testowym** (ten sam pakiet, którego używa
   `recurrenceEngine.ts:16` — ale **silnika nie wołasz i nie zmieniasz**, Z16).
2. `recurrenceId` do żądania bierzesz **z tej siatki**, nie z literału.
3. Asercja: `UNTIL` = (okazja z siatki) − 1 s, wyrażone w UTC —
   **i dodatkowo** `UNTIL` **nie jest przesunięty o godzinę** względem tej
   wartości (to jest sedno; błąd DST objawiłby się dokładnie tak).
4. **Oba kierunki DST**, jak w dniu 24: jesień 2026 (CEST→CET, `2026-10-25`)
   i wiosna 2027 (CET→CEST, `2027-03-28`). Tylko dwa kierunki razem dowodzą,
   że nie ma stałego offsetu.
5. **Test odporności na mutację:** `recurrenceId` **spoza siatki** (okazja ±1 h).
   Tu jest rozwidlenie i **musisz je jawnie rozstrzygnąć**:
   - **(a)** serwer dziś **przyjmuje** taki `recurrenceId` (spodziewany wynik) —
     wtedy test **dokumentuje to zachowanie jako znalezisko**, a Ty wpisujesz
     do raportu propozycję kontraktu („serwer powinien odrzucać `recurrenceId`
     spoza siatki serii kodem `404 RECURRENCE_NOT_FOUND`") **z uzasadnieniem,
     dlaczego NIE zbudowałeś tego sam**: walidacja siatki wymaga rozwinięcia
     serii, czyli wołania `recurrenceEngine` — a to jest Z16 **i** nowa funkcja
     poza zakresem (§1.4);
   - **(b)** serwer odrzuca — wtedy asercja to potwierdza i piszesz to wprost.

   **Zbudowanie walidacji siatki po stronie serwera jest STOP-em, nie zadaniem.**

### B.3. DoD pozycji B

1. Dowód mutacyjny „test dnia 24 przechodzi dla `recurrenceId` spoza siatki" —
   `stdout` w raporcie, **przed** naprawą.
2. Rozbudowany plik dnia 24: siatka liczona niezależnie, oba kierunki DST,
   test odporności na mutację.
3. **Tabela „przed/po" dla każdej ZMIENIONEJ (nie dodanej) linii** tego pliku
   (§0.4a pkt 7).
4. Jawne rozstrzygnięcie (a)/(b) z §B.2 pkt 5.
5. `meetingOccurrenceService.ts` i `recurrenceEngine.ts` — **pusty diff**
   (dowód komendą bazową).
6. Pakiet uruchomiony w `TZ=UTC` **i** `TZ=Europe/Warsaw`, identyczne wyniki.

---

## C. `materialTitle` — PEŁNY PAKIET DOWODOWY (D — P1-2 i P2 z `DEC-134`)

### C.1. Stan zweryfikowany

Resolver **JEST** — dzień 24 dowiózł go w `908ec7434d`:

- `meetingBoundaryService.ts:304-315` (`getMeetingNote`) — woła `getArtifactForUser`
  gdy jest `material_artifact_id` **i** `userId`; brak dostępu → `material_title = null`;
- `meetingBoundaryService.ts:351-369` (`listMeetingNotesForMeeting`) — to samo,
  z cache `Map<artifactId, Promise<title|null>>`, więc rozwiązuje **tylko unikalne**
  identyfikatory;
- router przekazuje realnego użytkownika (`meeting.routes.ts:1008-1009`).

**Nie ma ani jednego testu.** `grep -rn "materialTitle" server/src src tests` = 2
trafienia, oba w samym serwisie (§1.2 poz. 5). To jest **ścieżka bezpieczeństwa
bez pokrycia** — dokładnie zarzut P1-2.

### C.2. Testy (minimum sześć), realny router + realny PG

| #   | Przypadek                                                  | Oczekiwanie                                             |
| --- | ---------------------------------------------------------- | ------------------------------------------------------- |
| 1   | notatka zmaterializowana, użytkownik **ma** dostęp         | `materialTitle` = realny tytuł z `v8_output_artifacts`  |
| 2   | notatka zmaterializowana, dostęp **odebrany**              | `materialTitle: null`, `materialArtifactId` **zostaje** |
| 3   | notatka niezmaterializowana                                | `materialTitle: null`, `materialArtifactId: null`       |
| 4   | obca organizacja                                           | `404`, **zero wycieku tytułu w ciele odpowiedzi**       |
| 5   | `POST /:id/notes/:noteId/decision` (druga ścieżka odczytu) | ta sama reguła co w `GET /:id/notes`                    |
| 6   | N notatek, K unikalnych materiałów                         | **dokładnie K** wywołań resolvera (spy)                 |

Przypadek 6 zamyka dług wydajnościowy: dzień 21 dostał P1 za burzę autoryzacyjną
O(3N) (`DEC-104`). Liczbę wpisujesz do raportu w formacie
`N notatek, K unikalnych materiałów → K wywołań`.

### C.3. Odtworzenie wycieku PRZED naprawą — warunek pozycji

Wzorzec FIX-ów dnia 19 (`DEC-111`: „każdy z ODTWORZENIEM BŁĘDU PRZED NAPRAWĄ
jako dowodem"). Naprawa już jest scalona, więc odtwarzasz ją **odwrotnie**:

1. w **roboczym, NIE commitowanym** stanie tymczasowo cofnij resolver (wróć do
   surowego `row.material_title` z JOIN-a);
2. uruchom test nr 2 → **musi upaść** (tytuł wycieka mimo odebranego dostępu);
3. przywróć resolver → test zielony;
4. `stdout` obu przebiegów idzie do raportu; **`git status` po tym kroku musi być
   czysty względem `meetingBoundaryService.ts`** — dowodzisz komendą bazową.

### C.4. Retry bez `userId` (P2 z `DEC-134`)

`retryMeetingNoteMaterialization` (`meetingBoundaryService.ts:871-877`) woła
`getMeetingNote(input)`, gdzie `input` to `{organizationId, meetingId, noteId,
materializedBy}` — **bez `userId` i bez `roleKey`**. Skutek: `materialTitle`
jest tam **zawsze `null`**.

Rejestr nazywa to „dziś nieszkodliwe — pola nikt nie czyta". Sprawdź to sam
(grep z §C.1) i **rozstrzygnij jawnie, jedną z dwóch dróg**:

- **(a) Naprawa, minimalna i addytywna:** przekaż `userId: input.materializedBy,
roleKey: 'owner'` — dokładnie tak, jak robi to sąsiednia ścieżka
  uprzywilejowana w tym samym pliku (`:699-700`). **Wymaga testu**: retry na
  notatce ze zmaterializowanym materiałem zwraca niepusty `materialTitle`.
- **(b) Errata:** zostawiasz i wpisujesz do „Znalezisk" z uzasadnieniem, dlaczego
  `null` jest tam poprawny.

**Wybierasz jedną i uzasadniasz.** Milczenie = niedomknięta pozycja.

### C.5. Uczciwe nazwanie ostatniego ogniwa (Z20)

W raporcie piszesz **wprost**: ostatnim ogniwem dla `materialTitle` jest
**koperta HTTP** `res.json({ notes })` (`meeting.routes.ts:1011`), bo **żaden
komponent w `src/` tego pola nie czyta**. Nie wolno Ci dopisać konsumenta (Z17)
ani udawać, że go nie ma potrzeby wymieniać.

### C.6. DoD pozycji C

1. Sześć testów wyżej, zielone, realny router + realny PG.
2. Odtworzenie wycieku przed naprawą (§C.3), `stdout` obu przebiegów.
3. Pomiar liczby wywołań resolvera `N/K/K`.
4. Rozstrzygnięcie §C.4 (a) albo (b), z testem jeżeli (a).
5. Lista **wszystkich wołających** obu funkcji odczytu z potwierdzeniem, że żaden
   się nie wywalił:
   `grep -rn "getMeetingNote\|listMeetingNotesForMeeting" server/src src tests`.
6. Kontrakt dla frontu (§1.6) + jawne zdanie o braku konsumenta.
7. `artifactRegistryService.ts` — **pusty diff** (Z16).

---

## D. BRAMKA OCCURRENCE — PEŁNE OSIEM + SPY MAILERA (E z dnia 24)

### D.1. Stan zweryfikowany

Bramki **są** i są dokładnie wg `DEC-134`
(`meeting.routes.ts:1251-1257`):

```
meeting = getMeeting(...)
if (!meeting || !canAccessMeeting(...)) → denyMeetingAccess (404)   // bez zmian
if (cancel)  { if (!requireMeetingAdmin(req, res)) return; }        // DELETE → 403
else if (!isMeetingAdmin(req) && meeting.createdBy !== userId) → denyMeetingAccess (404)  // PATCH
```

`sendMeetingInvitations` jest wołane **dopiero po** bramce (`:1266-1279`) — to
strukturalna gwarancja, że odmowa nie wysyła nic. **Dzień 24 dowiódł 4 z 8
przypadków** i **nie dowiódł spy'a na mailerze**. Ty domykasz do ośmiu.

**Podziału bramek NIE zmieniasz** (`DEC-134` + `DEC-58`). `PATCH /:id/status`
**nie dostaje** `requireMeetingAdmin` — nie ruszasz go w ogóle.

### D.2. Testy (pełne osiem), rozbudowa

`tests/integration/routes/meeting.day24.occurrence-role-gate.postgres.integration.test.ts`

| #   | Rola × trasa                                      | Oczekiwanie                                                      |
| --- | ------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | `ADMIN`, `PATCH`                                  | `200`, zmiana w bazie (readback niezależnym poolem)              |
| 2   | twórca (`USER`), `PATCH`                          | `200`, zmiana w bazie                                            |
| 3   | uczestnik nie-twórca (`USER`), `PATCH`            | `404`, **zero zmian w bazie** (count przed/po)                   |
| 4   | `ADMIN`, `DELETE`                                 | `200`, `recurrence_status='cancelled'` odczytane niezależnie     |
| 5   | twórca (`USER`), `DELETE`                         | `403`, **zero zmian w bazie**                                    |
| 6   | uczestnik nie-twórca (`USER`), `DELETE`           | `403`, **zero zmian w bazie**                                    |
| 7   | obca organizacja, **obie** trasy                  | `404`, zero zmian, **zero wycieku tytułu spotkania w ciele**     |
| 8   | **odmowa nie wysyła zaproszeń** (spy na mailerze) | `sendMeetingInvitations` **niewołane** dla przypadków 3, 5, 6, 7 |

**Przypadek 8 jest krytyczny (Z22)** i jest tym, czego dzień 24 nie dowiódł.
Spy zakładasz **lokalnie** (`vi.mock` na `meetingInvitationService.js` w Twoim
pliku), nigdy globalnie (Z18). **`meetingInvitationService.ts` pozostaje
nietknięty** — dowodzisz pustym diffem.

### D.3. Dowód mutacyjny (obowiązkowy)

`DEC-134` potwierdził tę technikę przy odbiorze („usunięcie bramki → 2/4
czerwone"). Powtarzasz ją na pełnym pakiecie:

1. w stanie roboczym, **NIE commitowanym**, usuń bramkę `cancel` (`:1253-1254`);
2. uruchom pakiet → wypisz, **ile i które** testy się zapaliły;
3. przywróć; potwierdź pusty diff.

To samo dla bramki `PATCH` (`:1255-1257`). **Jeżeli usunięcie bramki nie zapala
ani jednego testu — Twój pakiet nie testuje bramki.**

### D.4. DoD pozycji D

1. Osiem przypadków, zielone, realny router + realny PG.
2. Dowód „zero zmian w bazie" **liczbą wierszy przed/po** dla każdej odmowy.
3. Spy mailera dla wszystkich czterech odmów.
4. Dowód mutacyjny dla obu bramek, `stdout` w raporcie.
5. Tabela „przed/po" dla zmienionych linii pliku dnia 24 (§0.4a pkt 7).
6. `PATCH /:id/status` — **pusty diff** (`DEC-58`).
7. `meeting.occurrence-cancel...test.ts` i `meeting.day19...test.ts` **nadal
   zielone** — wołają te trasy rolą `administrator`; **jeżeli padną, Twój pakiet
   coś zepsuł**.

---

## E. FUNNEL NOTATKA→ZADANIE — PEŁNE OSIEM + WYŚCIG + REALNE MAPOWANIE (F z dnia 24)

### E.1. Stan zweryfikowany

Trasa `POST /api/meeting/:id/notes/:noteId/action-items/:index/task`
(`meeting.routes.ts:1110-1149`) i serwis
`server/src/services/meeting/meetingNoteTaskFunnelService.ts` (95 linii) **są**.
Klucz idempotencji: `meeting-note-action:${noteId}:${index}`,
`sourceType='meeting_note_action_item'`,
`sourceId='${meetingId}:${noteId}:${index}'`. Nośnik: istniejący
`idx_tasks_idempotency_org`. **Migracji nie ma i nie będzie.**

**Dzień 24 dowiózł 5 z 8 przypadków** i zostawił trzy zarzuty P2. Domykasz je.

### E.2. `replayed` pod wyścigiem — defekt zweryfikowany

`meetingNoteTaskFunnelService.ts:50-53` robi **pre-SELECT**, a `:83` zwraca
`replayed: Boolean(replayBefore.rows[0])`.

Scenariusz wyścigu: dwa równoległe żądania, **oba** przechodzą pre-SELECT przy
pustej tabeli. Jedno wstawia wiersz. Drugie trafia na wewnętrzny replay
`TaskService.createTask` (który zwraca istniejące zadanie **bez wyjątku**) →
`create()` kończy się sukcesem, wyjątku `23505` nie ma, więc kod dochodzi do
`:83` i zwraca **`replayed: false` dla żądania, które w rzeczywistości było
replayem**.

**Co robisz:**

1. **Odtwórz** — test współbieżności (`Promise.all` dwóch identycznych żądań)
   asertujący, że **dokładnie jedno** ma `replayed: true`. Pokaż, że dziś
   potrafi być `false/false` (uruchom kilkukrotnie i zapisz rozkład wyników;
   jeżeli wyścig się nie odtwarza — zapisz to uczciwie i przejdź do pkt 3).
2. **Napraw uczciwie, bez dotykania `TaskService` (Z17).** Kierunek: przestań
   wnioskować `replayed` z pre-SELECT-u, wyprowadź go z tego, **co faktycznie
   zaszło** — np. porównując tożsamość/`created_at` zwróconego zadania z chwilą
   wywołania, albo wykonując post-SELECT po `idempotency_key` i rozstrzygając na
   podstawie `id` zwróconego zadania. **Wybór jest Twój; uzasadnienie
   obowiązkowe.**
3. **Jeżeli uczciwe wyprowadzenie NIE JEST możliwe bez zmiany `TaskService`** —
   to jest **STOP z kontraktem**, a nie cicha zmiana cudzego serwisu. Wtedy
   kontrakt dla frontu (§1.6) **musi** zawierać zdanie: „`replayed` jest
   best-effort; front nie może na nim opierać komunikatu dla użytkownika".

### E.3. Mapowanie `AuthorizationError` na REALNYM potoku (P2 — „harness maskuje")

Catch trasy (`meeting.routes.ts:1143-1150`) łapie **wyłącznie**
`MeetingNoteTaskFunnelError`; wszystko inne leci `throw`. `TaskService.verifyProjectAccess`
(`TaskService.ts:335-346`) rzuca `AuthorizationError`, więc **kod HTTP zależy
w całości od handlera błędów zamontowanego za routerem**.

**Wymóg tej pozycji — i to jest jej sedno:**

1. Test montuje **produkcyjny** handler:
   `errorHandlerMiddleware` z **`server/src/utils/ErrorHandler.js`**
   (`:156`), tak jak robi to `server/src/index.ts:1748`.
   **NIE montujesz** `server/src/middleware/errorHandler.ts` (nie jest
   montowany przez `index.ts`) i **NIE piszesz własnego handlera** — to
   dokładnie ten błąd, za który dzień 24 dostał P2 (Z21).
2. Asercja: żądanie z `projectId` bez członkostwa dostaje **`403`** z kodem
   `AUTHORIZATION_ERROR` — **z produkcyjnego mapowania**, nie z Twojego kodu.
3. **Dowód mutacyjny:** zamień w teście produkcyjny handler na własny
   „przezroczysty" i pokaż, że wynik się zmienia (albo że test przestaje mieć
   sens). To jest dowód, że asercja mierzy potok, a nie harness.
4. Jeżeli okaże się, że produkcyjny handler **nie** daje `403` — **nie
   naprawiasz go** (`utils/ErrorHandler.ts` poza zakresem). Dokładasz mapowanie
   **w catchu trasy funnela** (plik jest w Twoim zakresie) i opisujesz to jako
   świadomą decyzję.

### E.4. Testy (pełne osiem + wyścig), rozbudowa

`tests/integration/routes/meeting.day24.task-funnel.postgres.integration.test.ts`

| #   | Przypadek                                    | Oczekiwanie                                                                                         |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | notatka `approved`, indeks poprawny, `ADMIN` | `200`, wiersz w `tasks` (readback niezależnym `pg.Pool`)                                            |
| 2   | powtórzenie tego samego żądania              | `200`, `replayed: true`, **`count(*)` w `tasks` bez zmian**                                         |
| 3   | notatka `proposed`                           | `409 NOTE_NOT_APPROVED`, **zero wierszy w `tasks`**                                                 |
| 4   | notatka `rejected`                           | `409 NOTE_NOT_APPROVED`, **zero wierszy**                                                           |
| 5   | indeks poza zakresem                         | `404 ACTION_ITEM_NOT_FOUND`, zero wierszy                                                           |
| 6   | rola `USER`                                  | `403`, zero wierszy                                                                                 |
| 7   | obca organizacja (ten sam `noteId`)          | `404`, zero wierszy                                                                                 |
| 8   | **`projectId` bez członkostwa** (§E.3)       | **`403 AUTHORIZATION_ERROR` z produkcyjnego handlera**, zero wierszy                                |
| 9   | **wyścig** (`Promise.all` × 2)               | dokładnie **jeden** wiersz w `tasks`, obie odpowiedzi `200`, **dokładnie jedna** z `replayed: true` |

Testy **muszą** zakładać realne wiersze `organizations` + `users` — `createTask`
czyta `organization_id` z tabeli `users` (§1.8 poz. 10).

### E.5. Ostatnie ogniwo My Work (Z20) — czego dzień 24 nie dowiózł

Dzień 24 zamknął pozycję jako `CZĘŚCIOWO` m.in. dlatego, że **nie pokazał, która
lista My Work podniesie utworzone zadanie**. Domykasz to:

1. znajdź zapytanie odczytu, które zwróci ten wiersz (`plik:linia`);
2. **udowodnij testem**, że po utworzeniu zadania funnelem ten odczyt je zwraca
   (realny PG, ta sama organizacja i użytkownik);
3. jeżeli **żaden** odczyt go nie podnosi — to jest **znalezisko pierwszej wagi**
   i piszesz to wprost: zadanie jest funkcjonalnie niewidoczne, pozycja zostaje
   `CZĘŚCIOWO`. **Nie budujesz** brakującego odczytu (poza zakresem).

### E.6. DoD pozycji E

1. Dziewięć przypadków wyżej, zielone, realny router + realny PG + **produkcyjny
   handler błędów**.
2. Odtworzenie wyścigu `replayed` i rozstrzygnięcie §E.2 (naprawa albo STOP
   z kontraktem).
3. Dowód mutacyjny handlera (§E.3 pkt 3).
4. Ostatnie ogniwo My Work — `plik:linia` **i test**, albo jawne znalezisko.
5. Tabela „przed/po" dla zmienionych linii pliku dnia 24.
6. `TaskService.ts`, `utils/ErrorHandler.ts`, `myWork/**` — **pusty diff**.
7. `taskService.test.ts` i `server/src/services/myWork/__tests__` **zielone**.
8. Jawny wpis: **Initiatives = `BRAK_API`** z jednozdaniowym powodem.
9. Kontrakt dla frontu z semantyką `replayed` i kodem `403`.

---

## F. CZĘŚCIOWA AWARIA WYSYŁKI — W REŻIMIE STRAŻNIKÓW (G z dnia 24)

### F.1. Co już jest, a czego brakuje

`meetingInvitationService.ts:96-123` (FIX-7 dnia 16): `sendEmail` jest
w `try/catch` **wewnątrz pętli po odbiorcach**, więc wyjątek dla jednego odbiorcy
daje mu `status: 'failed'` i **nie przerywa** pętli. Test jednostkowy istnieje
(`server/src/services/meeting/__tests__/meetingInvitationService.test.ts`,
127 linii, wszystko zmockowane).

**Brakuje dowodu na realnym PG** — że `setParticipantDelivery` (`:125`)
i `INSERT INTO meeting_invitation_deliveries` (`:130-148`) faktycznie zapisują
właściwe statusy dla właściwych uczestników. Dzień 24 zostawił to jako
`NIE_ZACZĘTE`.

### F.2. ★★ REŻIM WYSYŁKI — REGUŁA NADRZĘDNA CAŁEGO DYŻURU

**Każdy test, który dochodzi do `sendMeetingInvitations` BEZ lokalnego mocka
mailera, wolno uruchamiać WYŁĄCZNIE w trybie `captured`** — czyli przy
`MEETING_INVITES_LIVE` **nieustawionym**. To jest reguła nadrzędna i obowiązuje
także pozycje A, D i E (wszystkie dotykają tej samej funkcji).

Gałąź `live` (`:96-123`) wolno dotknąć **wyłącznie** przy spełnieniu **PIĘCIU**
warunków **łącznie**. Brak dowodu któregokolwiek = **STOP pozycji F**:

1. **`emailService.send` jest zamockowany LOKALNIE w Twoim pliku testowym**
   (`vi.mock('../../services/emailService.js', ...)`) **zanim** ustawisz
   cokolwiek w env. Wzorzec: `meetingInvitationService.test.ts:24-26`.
   **Realny `nodemailer` nie może mieć szansy powstać.**
2. **`SMTP_HOST` ustawiasz na wartość niemarszrutowalną**: `smtp.example.invalid`.
   TLD `.invalid` jest zarezerwowany i nie rozwiąże się w DNS. **Nigdy** realny
   host.
3. **Env ustawiasz w `beforeAll`/`beforeEach` SWOJEGO pliku i przywracasz
   w `afterAll`/`afterEach`.** **Nigdy** w linii komendy i **nigdy** globalnie —
   inaczej zatrujesz inne pakiety w tym samym przebiegu.
4. **★ `settings` w bazie nie zawiera konfiguracji SMTP** (errata §1.2 poz. 7).
   Dowód **przed** testem, wklejony do raportu:

   ```bash
   docker exec cx-day28-pg psql -U postgres -d cx_day28 -c "SELECT count(*) FROM settings WHERE key LIKE 'smtp_%';"
   ```

   Niezerowy wynik → **STOP**. `emailService.ts:168-172` czyta bazę **przed** env,
   więc sam pusty env **nie wystarcza**.

5. **Organizacja testowa NIE nazywa się `demo-org`** i **nie ustawiasz
   `DEMO_ORG_ID`** (Z10) — inaczej wpadniesz w gałąź `blocked_demo` (`:75-84`)
   i nie zmierzysz niczego.

**Jeżeli nadzorca uzna, że nawet zamockowana gałąź `live` jest zbyt ryzykowna,
skreśli tę pozycję przed wydaniem instrukcji.** Jeżeli pozycja tu jest — reżim
wyżej jest jej warunkiem, nie sugestią.

### F.3. Scenariusz

1. Realny PG, realny router, spotkanie z **organizatorem + trzema odbiorcami**.
2. `emailService.send` mockowany **lokalnie** tak, że rzuca **wyłącznie** dla
   drugiego odbiorcy, a dla pozostałych zwraca `true`.
3. `POST /:id/invitations/send`.
4. **Asercje na odpowiedzi:** trzy wpisy `deliveries`; drugi ma `status:'failed'`
   i niepuste `error`; pierwszy i trzeci `status:'sent'`.
5. **Asercje na bazie (niezależny `pg.Pool`, to jest sedno):**
   - `meeting_invitation_deliveries` ma **trzy** wiersze dla tej próby, ze
     statusami w tej samej kolejności i z niepustym `error` **tylko** dla drugiego;
   - `meeting_participants.delivery_status` (przez `setParticipantDelivery`)
     zgadza się per uczestnik;
   - `sequence` we wszystkich trzech wierszach jest **taki sam**.
6. **Test odwrotności:** awaria **pierwszego** odbiorcy — pozostali dwaj i tak
   dostają wiersze. (Bez tego nie wiadomo, czy pętla nie kończy się po prostu na
   końcu listy.)
7. **Test trybu `captured`** (bez gałęzi live, bez mocka warunkującego):
   `MEETING_INVITES_LIVE` nieustawione → trzy wiersze ze statusem `captured`
   i **zero wywołań mailera** (spy `not.toHaveBeenCalled()`).

### F.4. DoD pozycji F

1. Plik
   `tests/integration/routes/meeting.day28.smtp-partial-failure.postgres.integration.test.ts`
   (`git add -f`), realny router + realny PG, mock **wyłącznie** mailera
   (+ `auth.middleware`/`Logger` wg wzorca).
2. Trzy scenariusze (§F.3 pkt 4-5, pkt 6, pkt 7), po komplecie asercji
   bazodanowych.
3. **Dowód warunku 4 z §F.2** (`count(*)` z `settings`), wklejony dosłownie.
4. Dowód, że `meetingInvitationService.ts`, `emailService.ts` i `icsBuilder.ts`
   **nie zostały zmienione** — komenda bazowa, wynik **pusty**.
5. **Strażniki dnia 16 zielone**, z cytatem wyniku:
   `server/src/services/meeting/__tests__/meetingDay16.pg.test.ts` — asercje
   `not.toHaveBeenCalled()` (`:166`, `:182`) dalej przechodzą.
6. **Oświadczenie o braku realnej wysyłki**, jawne, z listą ustawionych zmiennych
   i **miejscem** ich ustawienia (plik:linia w Twoim teście).

---

## R.1. `MODULE_ACCEPTANCE.md` — 08_MEETINGS

Podnosisz **wyłącznie o faktycznie dowieziony zakres**. Dzień 19 dostał pochwałę
za to, że jego diff w tym pliku „dodaje dokładnie jeden token: `CZĘŚCIOWO`"
(`DEC-108`). Dzień 24 utrzymał ten poziom (linia `DAY24-C/D/E/F-TYŁ`,
`MODULE_ACCEPTANCE.md:88`). Trzymaj go dalej.

- Jedna nowa linia `DAY28-A/B/C/D/E/F-TYŁ` (albo aktualizacja linii `DAY24-*`),
  z **prawdziwymi** statusami per pozycja.
- **Zakaz** podnoszenia `MTG-OWNER-01` (`OWNER_GATE_PENDING`, `:66`) — to nie
  Twoja bramka.
- **Zakaz** wpisywania czegokolwiek o otwarciu modułu.
- Jeżeli struktura pliku nie ma miejsca na atomowy wpis — **STOP z opisem**
  (wzorzec: STOP `R.1` dnia 18 uznany za zasadny, `DEC-107`).

---

## 2. SZABLON RAPORTU — jedyny dokument, który tworzysz

Ścieżka: `docs/program/waves/WAVE_03_ACCEPTANCE/MEETINGS_DAY28_REPORT_20260827.md`

```markdown
# Meetings dzień 28 (blok 4) — raport dyżuru <data>

Baza: `codex/m03-admin-20260824` @ <marker>
Marker: POTWIERDZONY / BRAK (+ wynik `git merge-base --is-ancestor`)
Gałąź: `codex/meetings-day28-<data>`
Worktree: `/private/tmp/consultify-meetings-day28`
Port PG: 5507 · obraz: `pgvector/pgvector:pg16` · kontener `cx-day28-pg` usunięty: TAK/NIE · wolumeny usunięte: TAK/NIE

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

## Dowód celu połączenia (Z19/DEC-96)

<dosłowny wynik SELECT current_database(), inet_server_port()>

## ★ WERYFIKACJA ERRATY §1.2 — czternaście punktów

<punkt po punkcie: POTWIERDZONY / ROZBIEŻNY + dowód>

## Warunki wstępne — tabela

<marker · migracje 1/2/dry · obiekty bazy · namespace 20261170-79 · settings smtp\_% · baseline>

## ★ INWENTARZ ENDPOINTÓW I KONSUMENTÓW (BLOK 0 pkt 8)

<tabela 32 wierszy + dwie liczby zbiorcze>

## Pozycje — tabela zbiorcza

| Pozycja | Status | Commit | Dowód |
<statusy: ZROBIONE_WG_DoD / CZĘŚCIOWO / STOP / BRAK_API / NIE_ZACZĘTE>

## ★ A — STREFA W recurrenceId

### Pomiar PRZED naprawą: tabela 4 wartości (2 scope × 2 TZ) + różnice

### Grep bezpieczeństwa (wynik dosłowny) + decyzja: naprawa / STOP

### §A.5 — czy dołożono strażnik w serwisie i dlaczego

### §A.6 — UNTIL bez Z: zaostrzenie / znalezisko + uzasadnienie

### Sześć testów: wyniki, oba przebiegi TZ

## ★ B — DST ZWIĄZANY Z SIATKĄ SERII

### Dowód mutacyjny PRZED naprawą (stdout): test dnia 24 przechodzi dla recurrenceId spoza siatki

### Jak liczona jest siatka w teście (bez wołania recurrenceEngine)

### Oba kierunki DST — wartości

### Rozstrzygnięcie (a)/(b) z §B.2 pkt 5

### Tabela „przed/po" zmienionych linii pliku dnia 24

## ★ C — materialTitle

### Sześć testów: wyniki

### Odtworzenie wycieku przed naprawą (stdout obu przebiegów)

### Pomiar wywołań resolvera: N notatek, K materiałów, K wywołań

### §C.4 — retry bez userId: decyzja (a)/(b) + uzasadnienie

### Ostatnie ogniwo Z20 — nazwane wprost (koperta HTTP, brak konsumenta w src/)

### Lista wszystkich wołających obu funkcji

## ★ D — BRAMKA OCCURRENCE

### Osiem przypadków: kod HTTP + liczba wierszy przed/po

### Spy mailera dla czterech odmów

### Dowód mutacyjny obu bramek (stdout)

### Dowód pustego diffu PATCH /:id/status

## ★ E — FUNNEL

### Dziewięć przypadków: wyniki

### Wyścig replayed: odtworzenie (rozkład wyników) + decyzja naprawa/STOP

### Mapowanie AuthorizationError: który handler zamontowany (plik:linia) + dowód mutacyjny

### Ostatnie ogniwo My Work: plik:linia + test, albo znalezisko

### Initiatives = BRAK_API — powód

## ★ F — CZĘŚCIOWA AWARIA WYSYŁKI

### Dowód warunku 4 (count settings smtp\_%)

### Trzy scenariusze: wyniki + asercje bazodanowe

### Dowód pustego diffu meetingInvitationService.ts / emailService.ts / icsBuilder.ts

### Strażniki dnia 16 zielone (cytat)

### Oświadczenie: zero realnych wysyłek, lista zmiennych i miejsce ustawienia

## Kontrakt dla frontu

| Trasa | Metoda | Body | Odpowiedź | Kody błędów | Co front ma pokazać |

## Migracje

<najpewniej: BRAK. Jeżeli jest — numer z 20261170-79 + trzy przebiegi + dowód braku obiektu>

## ★ POMIAR TESTÓW (Z23) — PEŁNY zakres §0.4a

### Zakres §0.4a: X/Y PASS, S SKIPPED

### Czerwone ZASTANE (na markerze, PRZED pierwszym commitem) — per plik

### Czerwone WPROWADZONE — per plik + SHA commitu, który je zapalił

### SKIPPED z powodu env

### Testy osłabione / usunięte bloki describe (przed/po, §0.4a pkt 7)

### Deklaracja: ZASIĘG PEŁNY / ZASIĘG CZĘŚCIOWY + wyliczenie pominięć

## ★ Dowód braku atrapy (Z22)

<dla każdej pozycji ze skutkiem zewnętrznym: zmiana w bazie PRZED efektem>

## Bezpieczniki — dowody (pusty diff per plik)

Z5 · Z10 (betaAccess.ts) · Z16 (effectiveAccessService, artifactRegistryService, recurrenceEngine)
Z17 (src/\*\* — pusty diff) · Z18 (globalna infra testowa) · DEC-65 (Railway/zdalne/maile)

## Errata i korekty wobec instrukcji

## Znaleziska (NIE naprawiane przeze mnie)

<m.in.: start_at TEXT bez wymogu strefy; 15 tras bez konsumenta; recurrenceId spoza siatki serii>

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy

### STOP — <pozycja>

## Licznik (8 pozycji: ZROBIONE_WG_DoD / CZĘŚCIOWO / STOP / BRAK_API / NIE_ZACZĘTE)

## Czego NIE zrobiłem i dlaczego

## Gotowość
```

**Zasady raportowania:**

- **Nie zawyżasz.** `CZĘŚCIOWO` z uczciwym opisem jest warte więcej niż
  `ZROBIONE_WG_DoD` bez dowodu. Dzień 24 dostał `SUPERVISOR_ACCEPT` mimo
  `0/5/3` — **bo był uczciwy**; jedyny zarzut P1-1 dotyczył **jednego** zdania,
  w którym raport wyprzedził dowód.
- **Nie deklarujesz decyzji bez artefaktu.** „Zdecydowałem X" musi mieć w diffie
  plik realizujący X (§1.8 poz. 4).
- **Nie przepisujesz moich liczb.** Wszystko z §1.2 i §1.7 masz zmierzyć u siebie.
- **Każda liczba ma komendę.** Wynik bez komendy jest nieweryfikowalny.

---

## 3. LISTA KONTROLNA PRZED ODDANIEM

```bash
# ★ OSTATNIA BRAMKA — wszystkie MUSZĄ być puste
git diff --name-only «MARKER_SHA»...HEAD -- src/                       # ← Z17: PUSTE
git diff --name-only «MARKER_SHA»...HEAD -- server/src/services/effectiveAccessService.ts
git diff --name-only «MARKER_SHA»...HEAD -- server/src/services/v8/recurrenceEngine.ts
git diff --name-only «MARKER_SHA»...HEAD -- server/src/services/v8/artifactRegistryService.ts
git diff --name-only «MARKER_SHA»...HEAD -- server/src/services/meeting/meetingInvitationService.ts
git diff --name-only «MARKER_SHA»...HEAD -- server/src/services/emailService.ts
git diff --name-only «MARKER_SHA»...HEAD -- server/src/utils/ics/icsBuilder.ts
git diff --name-only «MARKER_SHA»...HEAD -- server/src/services/TaskService.ts
git diff --name-only «MARKER_SHA»...HEAD -- server/src/utils/ErrorHandler.ts
git diff --name-only «MARKER_SHA»...HEAD -- tests/setup.ts tests/helpers tests/__mocks__
git diff --name-only «MARKER_SHA»...HEAD -- 'vitest*.config.ts' 'server/vitest*.ts'
git diff --name-only «MARKER_SHA»...HEAD -- tests/e2e tests/acceptance
```

Dalej, punkt po punkcie:

1. [ ] Marker potwierdzony, praca na własnej gałęzi, worktree własny.
2. [ ] Errata §1.2 zweryfikowana w czternastu punktach.
3. [ ] Inwentarz endpointów i konsumentów w raporcie (32 wiersze + dwie liczby).
4. [ ] Baseline zmierzony **przed** pierwszym commitem, z kompletem pięciu zmiennych.
5. [ ] Commit per pozycja (nie jeden zbiorczy — lekcja dnia 24).
6. [ ] `prettier` na plikach każdego commita.
7. [ ] Każda pozycja ma dowód osiągalności z ostatnim ogniwem nazwanym wprost.
8. [ ] Każda odmowa ma dowód „zero zmian w bazie" **i** „zero skutku zewnętrznego".
9. [ ] Dowody mutacyjne: B (test dnia 24 przechodzi spoza siatki), D (obie
       bramki), E (handler błędów).
10. [ ] Pomiar §0.4a **pełny**, z rozbiciem ZASTANE/WPROWADZONE i SKIPPED.
11. [ ] Tabele „przed/po" dla każdej zmienionej linii w trzech plikach dnia 24.
12. [ ] Kontrakt dla frontu dla A, C i E.
13. [ ] Zero realnych wysyłek, oświadczenie jawne, dowód `settings`.
14. [ ] Migracje: BRAK, albo numer z `20261170`–`20261179` z trzema przebiegami.
15. [ ] Kontener PG i wolumeny usunięte.
16. [ ] `MODULE_ACCEPTANCE.md` — atomowy wpis, bez `MTG-OWNER-01`, bez otwarcia modułu.
17. [ ] `MODULE_MEETING` nadal `'closed'` (pusty diff `src/utils/betaAccess.ts`).
18. [ ] Żadnego `git push` na `origin` (Z1).

---

## 4. JEDNO ZDANIE NA KONIEC

Dzień 24 zbudował mechanikę i **powiedział o jednej rzeczy więcej, niż zrobił** —
i to jedno zdanie kosztowało cały moduł ocenę `CZĘŚCIOWO`; Twoim zadaniem nie
jest zbudować więcej, tylko **domknąć różnicę między tym, co w tym module działa,
a tym, co da się o nim udowodnić** — i jeżeli którejś różnicy nie domkniesz,
napisz to wprost, bo `NIE_ZACZĘTE` z powodem jest w tym programie warte więcej
niż `ZROBIONE` bez dowodu.
