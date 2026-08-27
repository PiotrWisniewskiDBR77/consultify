# INSTRUKCJA DYŻURU nr 34 — Codex — „PARYTET WIZUALNY silnika dokumentu DRD"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–33. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-28.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

---

## ★★ PO CO TEN DYŻUR ISTNIEJE — jednym akapitem

Dyżur 32 zbudował **silnik** raportu DRD: dokument `.docx` powstaje z danych sesji
oceny leżących w bazie, przez realną trasę, dla dowolnego tenanta. **Mechanika
została odebrana jako ZIELONA** (decyzja `DEC-2026-08-28-174`): bitowa niezmienność
wyjścia legacy potwierdzona niezależnie, 7/7 testów realdb, dwa tenanty, inline
`rFonts` 638→0. **Warstwa wizualna została odebrana jako CZERWONA** i skierowana
na osobny tor — czyli tutaj.

Wzorcem jest **złoty plik** — 29-stronicowy raport DRD dla fikcyjnej spółki
Metalpol, zbudowany ręcznie, po którym właściciel produktu napisał: **„sa
zajebiste"** (`DEC-2026-08-28-151`, gałąź `codex/golden-drd-report-20260827`,
commit `c2a91d0258`). To jedyny dokument w historii tego programu, który
właściciel zaakceptował. **Twoje zadanie: doprowadzić WYJŚCIE SILNIKA do jego
ligi wizualnej — bez psucia komukolwiek innemu ani jednego bajtu.**

**Zdanie, które warto zapamiętać na pamięć:** dokument, który wygląda jak złoty
plik, ale w miejsce brakującej prozy wstawia zmyślone zdania, jest gorszy niż
brak dokumentu i oznacza odrzucenie CAŁEGO dyżuru. Twoja praca to **forma**, nie
treść. Treści nie dopisujesz — ani ręką, ani modelem.

---

## ★ SIEDEM OGRANICZEŃ KRYTYCZNYCH — przeczytaj przed §0

1. **★★ WARUNEK NIENARUSZALNY CAŁEGO DYŻURU: BITOWA NIEZMIENNOŚĆ WYJŚCIA DLA
   WSZYSTKICH KONSUMENTÓW SPOZA PROFILU DRD.** `documentDocxRenderer.ts` i
   `documentDocxStyles.ts` są kodem WSPÓŁDZIELONYM. **Każda** Twoja zmiana w nich
   musi być bramkowana `isDrdReportProfile(...)`. Dowodem jest porównanie SHA
   trzech plików wewnątrz `.docx` (`word/document.xml`, `word/styles.xml`,
   `word/numbering.xml`) PRZED i PO, dla **co najmniej trzech bogatych schematów
   legacy**. **Bez tego dowodu dyżur jest odrzucony w całości, niezależnie od
   tego, jak dobrze wygląda dokument DRD.** Szczegóły: §N.
2. **★★ ZERO ZMIAN W `src/**`.** Cały katalog frontowy jest poza zakresem do
   zapisu. Wolno Ci go czytać i grepować. Nie dopisujesz przycisku, nie dopisujesz
   importu, nie „domykasz ogniwa". Front jest osobnym dyżurem. Wyjątek: **żaden**.
3. **★★ ZERO LLM.** Zero `llmService`, zero `initializeAI()`, zero
   `aiAssessmentReportGenerator`, zero kluczy AI w jakimkolwiek środowisku, także
   „na chwilę". Cała treść dokumentu pozostaje deterministyczna: wyliczona
   z danych, stała, albo jawny placeholder.
4. **★★ ZERO LIBREOFFICE (i żadnego innego pakietu biurowego) W KODZIE
   SERWEROWYM.** Railway go nie ma. Złoty plik był budowany skryptem wołającym
   `soffice` dwa razy (rasteryzacja SVG→PNG i render PDF do pomiaru numerów
   stron) — **obie te ścieżki są dla silnika zakazane**. `puppeteer` jest
   w `devDependencies` i **też jest zakazany** (`DEC-132`).
   **Licencja lokalna:** do WŁASNEJ inspekcji wyrenderowanych plików wolno Ci
   użyć LibreOffice **na swojej maszynie**, poza repo, wyłącznie do produkcji
   PDF/PNG dowodowych. Warunek: **ani jedna linia kodu w `server/**` ani
   `scripts/**` nie może o nim wiedzieć**, a fakt użycia opisujesz w raporcie.
5. **★ ZERO ZMYŚLANIA TREŚCI.** Nie wstawiasz przykładowych zdań, nazwiska
   oceniającego, branży klienta, „lorem ipsum" ani prozy z `data.cjs` złotego
   pliku. `data.cjs` to treść o Metalpolu — wstawiona komukolwiek innemu jest
   kłamstwem o kliencie.
6. **★ NIE PISZESZ DRUGIEGO GENERATORA OBOK.** Miejsce docelowe to istniejący
   silnik `server/src/services/documentStudio/**` z pakietem `docx@9.5.1`.
   Skopiowanie `build.cjs` do `server/` = odrzucenie dyżuru: repo ma już pięć
   niezależnych systemów stylowania eksportu i szósty jest ostatnią rzeczą,
   jakiej potrzebuje (`DEC-132` pkt 2).
7. **★ DZIEWIĘĆ POZYCJI ROBOCZYCH (§N, §A–§H, §W) I DWIE DOKUMENTACYJNE
   (§R.1, §R.2).** Wszystko inne, co przyjdzie Ci po drodze do głowy —
   tłumaczenie 233 opisów poziomów, naprawa atrap `/export/pdf` i `/export/pptx`,
   ujednolicenie pięciu systemów stylowania, `docxtemplater`, szablony `.dotx`,
   generacja PPT, uzupełnienie danych demo — jest **POZA ZAKRESEM** (§1.6)
   i idzie do „Znalezisk", nie do kodu.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **gałąź `codex/m03-admin-20260824`**, przypięta do
   commitu-markera podanego niżej.

   **SHA markera: 3e707a9d3c**

   > **★★ RAMKA WYJAŚNIAJĄCA WARTOWNIKA — CAŁA W BLOKU CYTOWANYM. NIE JEST
   > INSTRUKCJĄ OPERACYJNĄ.**
   >
   > Pole markera wyżej jest **wiązane przez nadzorcę** skryptem
   > `scripts/codex/bind-marker.sh`, który podstawia SHA **wyłącznie w liniach
   > operacyjnych** i **pomija każdą linię zaczynającą się od `>`** — czyli całą
   > tę ramkę. Dlatego w tej ramce literał wartownika zostaje nietknięty i to
   > jest stan POPRAWNY.
   >
   > **Jeżeli w polu markera wyżej (linia operacyjna, bez `>`) widzisz nadal
   > literał `«MARKER_SHA»` — instrukcja NIE ZOSTAŁA ZWIĄZANA. To jest STOP:
   > zakładasz raport, wpisujesz pozycję „instrukcja niezwiązana", i kończysz
   > dyżur bez dotykania kodu.**
   >
   > **Jeżeli w polu markera stoi realny, dziesięcio- do czterdziestoznakowy
   > SHA — to NIE jest wartownik i NIE jest powodem do STOP-u.** Jedyny STOP
   > z tytułu markera to negatywny wynik weryfikacji z pkt 2.
   >
   > **Historia (do wiadomości, nie do działania):** w dniach 29 i 32 nadzorca
   > wiązał marker globalnym `sed`, który podstawiał SHA także w treści tej
   > ramki. Ramka zaczynała wtedy wskazywać prawdziwy marker jako wartownik
   > i dyżur zatrzymywał się — prawidłowo, ale bez potrzeby. Dwa dyżury
   > stracone. Od 2026-08-28 wiązanie idzie skryptem, który bloków cytowanych
   > nie tyka.

2. **Sprawdzasz marker PIERWSZĄ komendą dyżuru** (podstawiając za `<SHA>` to,
   co realnie stoi w polu markera wyżej):

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor <SHA> codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

3. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/preserve-*`, `codex/golden-drd-report-20260827`, `codex/document-engine-day32-*`,
   `codex/assessment-day20-*`, `codex/assessment-day25-*`, `codex/assessment-day29-*`,
   `codex/assessment-report-front-day27-*`, `codex/meetings-*`, `codex/mgmtreports-*`
   ani z żadnej gałęzi dni 17–33. Załóż raport, wpisz pozycję STOP z wynikiem obu
   komend i zakończ dyżur.

   **Reguła rozejścia (`DEC-2026-08-26-95`).** Jeżeli marker JEST przodkiem, ale
   tip uciekł do przodu — **to nie jest STOP**. Startujesz **dokładnie z markera**,
   wypisujesz w raporcie `git log --oneline <SHA>..codex/m03-admin-20260824`
   i listę plików rozejścia; scalenie z nowszym tipem wykonuje nadzorca przy
   odbiorze. **Rebase w trakcie dyżuru: ZAKAZANY.**

4. **Twoja gałąź i worktree.** Zakładasz **świeżą gałąź z markera**:
   `codex/document-visual-day34-<data>`, w **własnym worktree** pod
   `/private/tmp/consultify-day34-<coś>`. Pracujesz wyłącznie tam.

5. **Weryfikacja stanu wejściowego — komendy (a)–(h), wyniki DOSŁOWNIE do
   raportu.** Instrukcja została napisana na podstawie pomiaru nadzorcy; jeżeli
   Twoje wyniki się różnią, to **Twoje** są prawdą, a rozbieżność idzie do
   sekcji „Korekty wobec instrukcji".

   ```bash
   # (a) czy dzień 32 jest w bazie — serwis mapujący i profil DRD
   ls -la server/src/services/assessment/assessmentDrdReportSchemaService.ts
   grep -n "isDrdReportProfile" server/src/services/documentStudio/documentDocxStyles.ts

   # (b) klamra kolumn — źródło P0-2
   grep -n "DOCX_TABLE_MAX_COLS = " server/src/services/documentStudio/documentDocxStyles.ts
   grep -n "clampTableColumns(" server/src/services/documentStudio/documentDocxRenderer.ts

   # (c) etykiety podpisów — źródło P1-4
   grep -n "captionLabel = " server/src/services/documentStudio/documentDocxRenderer.ts

   # (d) okładka legacy — źródło P0-1
   grep -n "documentTypeLabels\|densityLabels\|confidentialityLabels" server/src/services/documentStudio/documentDocxRenderer.ts

   # (e) limity słów — źródło P1-7
   grep -n "CONTRACT_V1_MISSING_SLOT_LIMITS" -A 4 server/src/services/assessment/assessmentDrdReportSchemaService.ts

   # (f) KTO REALNIE WOŁA renderer — lista konsumentów, których nie wolno ruszyć
   grep -rn "renderDocumentSchemaToDocxBuffer" server/src --include="*.ts" | grep -v "__tests__"
   grep -rn "documentDocxStyles.js" server/src --include="*.ts" | grep -v "__tests__"

   # (g) czy istnieje harness parytetu z dnia 32 (rozszerzasz go, nie piszesz od nowa)
   ls -la server/src/services/documentStudio/__tests__/day32.rendererParity.test.ts
   ls -la server/src/services/documentStudio/__tests__/fixtures/ 2>/dev/null | head

   # (h) dowody dnia 32, które będziesz porównywał
   ls -la docs/program/waves/WAVE_03_ACCEPTANCE/evidence/document-engine-day32-20260828/
   ```

### 0.2. Bezwzględne ZAKAZY

| # | Zakaz | Dlaczego |
| --- | --- | --- |
| Z1 | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/document-visual-day34-<data>` | Push na `origin`/demo wykonuje wyłącznie nadzorca |
| Z2 | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824`, **`codex/golden-drd-report-20260827`**, `codex/document-engine-day32-*` ani żadnej gałęzi `codex/assessment-*`, `codex/meetings-*`, `codex/mgmtreports-*`, `codex/chat-*`, `codex/tools-*` | `demo` = święta baza; tamte gałęzie to historia odebrana albo praca w toku; gałąź złotego pliku niesie zamknięty dowód akceptu właściciela |
| Z3 | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4 powstał tak; `DEC-95` |
| **Z4** | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) | Wymagania są w rejestrze uwag i decyzjach |
| **Z5** | **★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-86` | Chroniony, brudny worktree właściciela — praca własna Piotra |
| Z6 | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` — żyje ich kilkadziesiąt, w tym `consultify-golden-docx`, `consultify-day32-*`, `consultify-day34-instrukcja` | Cudze worktree, część w aktywnym użyciu |
| Z7 | **Nie zajmujesz portów sesyjnych. TWÓJ KONTENER PG = `5605`.** Zakazane wprost, także gdy akurat wolne: **5499 · 5474 · 5498 · 5511 · 5512 · 5521 · 5533 · 5544 · 5556 · 5563 · 5566 · 5567 · 5571 · 5573 · 5575 · 5577 · 5581 · 5588 · 5589 · 5591 · 5597 · 5613 · 5629 · 55291 · 55677 · 55941 · 59321**. Port zajęty → bierzesz pierwszy wolny **powyżej 5605, z pominięciem 5613 i 5629**, i wpisujesz go **jawnie** do raportu | Cudze dyżury pracują równolegle; tamte porty bywają wskrzeszane przez odbiorców |
| Z8 | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (`DEC-65`) | Produkcja/demo poza zakresem |
| **Z9** | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo/staging/produkcja, nigdy cudza retained-DB. **KOREKTA `DEC-2026-08-26-98`: Z9 przerywa DANĄ CZYNNOŚĆ, nie cały dyżur** — patrz ramka pod tabelą | „dane demo = twarz produktu" (`DEC-65`) |
| **Z10** | **Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej flagi.** Także zero „tymczasowej flagi na czas testu". Dotyczy w szczególności `ff_assessmentReportView`, `drdHttpSourceOfTruthV1`, `drdMethodWorkspaceSliceV1`, `methodWorkspaceShellV1`, `ENABLE_DELIVERABLES_LIGHT`, `ENABLE_V8_GLOBAL`, `DEMO_ORG_ID`, `enableStubRoutes` | CLAUDE.md reguła 9. **Bramka `isDrdReportProfile(schema)` NIE jest flagą** — jest predykatem po zawartości schematu i tak masz ją stosować |
| Z11 | **Zero nowych tras HTTP.** Trasa `.docx` powstała w dniu 32 (`GET /api/method/sessions/:sessionId/assessment-report.docx`) i **jest kompletna**. Nie zmieniasz `server/src/Gateway.ts`, `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts` ani gramatyki tras | Gramatyka zaakceptowana (`DEC-2026-08-24-07`); ten dyżur zmienia BAJTY pliku, nie powierzchnię HTTP |
| Z12 | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/DOCUMENT_ENGINE_VISUAL_DAY34_REPORT_20260828.md`. Jedyny inny dokument, który wolno zmienić, to `modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md` — wyłącznie w ramach `R.1`. **Raportu dnia 32 (`DOCUMENT_ENGINE_DAY32_REPORT_20260828.md`) NIE edytujesz** | Repo tonie w dokumentach-duchach; tamten raport jest zamkniętym dowodem odbiorowym |
| Z13 | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie. Uważasz, że decyzja się myli — piszesz **erratę w raporcie**, nie patch w rejestrze | Rejestr decyzji jest `FINAL / IRREVOCABLE` |
| **Z14** | **★★ ZERO LLM.** Zero `llmService`, zero `initializeAI()`/`injectAIClient()`, zero `aiAssessmentReportGenerator`, zero kluczy AI w jakimkolwiek środowisku, zero tras `/api/ai/**` | Silnik AI = osobny moduł, ostatni w programie; `DEC-51`, `DEC-2026-08-28-152` |
| **Z15** | **★★ ZERO ZMYŚLANIA. Brak danych = uczciwy placeholder, nigdy wypełniacz.** W tym dyżurze pokusa jest INNA niż w 32 i groźniejsza: **poprawiasz WYGLĄD, więc kusi, żeby „dla ładnej okładki" dopisać branżę, zatrudnienie, nazwisko oceniającego albo sponsora.** Czego kontrakt nie niesie — to jawny placeholder w wierszu metryczki, **nigdy zmyślona wartość i nigdy zniknięcie wiersza** | Sedno §A; `DEC-146`/`DEC-150` |
| **Z16** | **★★ NIETYKALNE: `server/src/services/effectiveAccessService.ts`, `frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts`, `PermissionsService`, `server/src/services/v8/artifactRegistryService.ts`, `server/src/services/methodCore/**`, `server/src/method-core/outputs/**`.** Wolno **czytać** i **wołać** | Model uprawnień i jądro Method Core naprawiane in-house; jądro współdzielone z Audits/SIRI (`DEC-139`) |
| **Z17** | **★ Zakaz wszystkiego poza wskazanym zakresem** — z imiennymi licencjami z ramki w §1.7 | „jeden moduł na raz"; podział FRONT/TYŁ |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config*.ts`, ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru** | Dyżur nr 2 wywalił tak 27 cudzych testów |
| **Z19** | **★★ ZAKAZ uruchamiania jakichkolwiek testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, podanego W TEJ SAMEJ LINII komendy — PIĘĆ zmiennych.** Kolejność Bloku 0: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar**. Do raportu obowiązkowy **dowód celu połączenia** i **liczba SKIPPED** | Dzień 17 zmierzył stan wejściowy na cudzej/niezmigrowanej bazie (`DEC-96/98`); dzień 19 mierzył bez `MOCK_DB=false` |
| **Z20** | **★ DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`) — patrz ramka pod tabelą | Bramka DoD dnia 60 przepuściła „ZROBIONE" przy czterech żywych martwych gałęziach |
| **Z21** | **★ Test wstrzykujący zależności NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`). Wariant tego dyżuru: **test, który woła `buildAssessmentDrdReportSchema` z ręcznie napisanym obiektem kontraktu i sprawdza kształt schematu, nie dowodzi NICZEGO o wyglądzie pliku.** Dowodem są bajty `.docx` z realnej trasy | Dzień 18: 8/8 zielonych, warstwa martwa |
| **Z22** | **★ Zakaz atrapy z zewnętrznym skutkiem** (`DEC-2026-08-26-108`). Wariant tego dyżuru: **ładna okładka, której wartości nie pochodzą z wierszy w bazie** (bo serwis ma domyślne wartości, bo test wstrzyknął dane, bo mapa ma fallback z przykładem) | Dzień 19: `DELETE /occurrence` rozsyłał `CANCEL`, nie zmieniwszy nic w bazie |
| **Z23** | **★ Pomiar testów BEZ ZAWĘŻANIA** (`DEC-2026-08-26-108`) — wynik z **PEŁNEGO zakresu §0.4**, z rozbiciem **ZASTANE / WPROWADZONE** i liczbą **SKIPPED**. **Podanie zawężonego wyboru = naruszenie** | Dzień 19 zadeklarował „98/98 PASS" przy 189/193 w zakresie własnej instrukcji |
| **Z24** | **★★ ŻADNEJ ZMIANY W `documentDocxRenderer.ts` / `documentDocxStyles.ts` POZA BRAMKĄ `isDrdReportProfile(...)`.** Także „drobnej", także „oczywiście neutralnej", także w komentarzu, który zmienia numerację linii w snapshotach. Jeżeli zmiana nie mieści się w bramce — **STOP i pozycja w raporcie** | Warunek nienaruszalny; §N jest jego jedynym dowodem |
| **Z25** | **★★ TESTY REALDB WYŁĄCZNIE Z JAWNYM `DATABASE_URL` WSKAZUJĄCYM KONTENER TEGO DYŻURU.** `tests/setup.ts:386-387` ma fallback: przy braku `DATABASE_URL` ustawia `postgresql://iris:iris_test@localhost:5432/iris_test`. Port **5432 na tej maszynie NASŁUCHUJE** (zmierzone przez nadzorcę) — czyli brak jawnego URL kieruje Twój test na **cudzą żywą bazę** | Cicha kontaminacja cudzego środowiska; wynik pomiaru bez wartości |
| **Z26** | **★★ OBOWIĄZKOWO `RUN_DB_TESTS=1 MOCK_DB=false` W TEJ SAMEJ LINII.** `tests/setup.ts:382` robi `process.env.MOCK_DB = process.env.MOCK_DB \|\| 'true'` — **brak jawnego `MOCK_DB=false` USTAWIA atrapę**. `Database.ts` podstawia wtedy mock **bezwarunkowo**, niezależnie od `RUN_DB_TESTS`. Dodatkowo globalny mock `auth.middleware.js` przy `MOCK_DB !== 'false'` i braku nagłówka `Authorization` wstrzykuje `role: 'owner', isSuperAdmin: true` — **anonim dostaje `200` zamiast `401`**. Odczyty idą wtedy cicho na atrapę i dają **mylące fałszywe `404`** („sesja nie istnieje") przy poprawnie zasianej bazie | Zmierzone; dzień 19 stracił pół dyżuru na diagnozowaniu takiego `404` |
| **Z27** | **★★ ZAKAZ `git stash` DO DOWODÓW MUTACYJNYCH.** Stash jest **współdzielony między worktree tego samego repo** — `git stash push` w Twoim worktree schowa również zmiany cudzego dyżuru, a `git stash pop` przywróci je w niewłaściwym miejscu. Do porównania PRZED/PO (§N) używasz **kopii plików**: `cp <plik> /private/tmp/consultify-day34-work/<plik>.przed` i odtwarzasz `cp` z powrotem. **Nigdy `git stash`, `git checkout -- <plik>` na plikach, których nie jesteś jedynym autorem w tej sesji, ani `git worktree` cudzych gałęzi** | Stash jest globalny per-repo, nie per-worktree — pułapka wykryta 2026-08-28 |

**★ Z9 — procedura po korekcie `DEC-2026-08-26-98` (nie zabijaj dyżuru).**
Jeżeli złapiesz się na komendzie DB bez przypiętego env: **zatrzymaj tę komendę →
ustal skutek (czy w ogóle doszło do połączenia i czy był ZAPIS) → zapisz
ustalenie w raporcie → przypnij env → KONTYNUUJ pozycję.** Twardy STOP całego
dyżuru **wyłącznie** przy stwierdzonym realnym **zapisie** do bazy spoza dyżuru.

**★★ Z25+Z26 — komplet env, i dlaczego to nie jest biurokracja.**

```bash
DATABASE_URL="postgres://postgres:cx@localhost:5605/cx_day34" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
npx vitest run <plik>
```

i **każdy** taki przebieg jest poprzedzony dowodem celu połączenia:

```bash
docker exec cx-day34-pg psql -U postgres -d cx_day34 -c "SELECT current_database(), inet_server_port();"
docker port cx-day34-pg
```

Wynik tych komend (**dosłowny**) jest obowiązkową pozycją raportu. Pomiar bez
dowodu celu = pomiar nieistniejący. **Pakiet w całości `SKIPPED` zaraportowany
jako `PASS` = zawyżenie i podstawa odrzucenia.** (`docker exec ... psql` łączy się
socketem wewnątrz kontenera, więc `inet_server_port()` bywa pusty — to **nie
jest** błąd; wtedy wystarcza `docker port`.)

**★ Z20 — jak wygląda dowód osiągalności w TYM dyżurze.**
Ostatnim ogniwem **nie jest** funkcja ani test jednostkowy. Jest nim **plik na
dysku, otwarty i obejrzany**:

```
realne wejście: GET /api/method/sessions/:sessionId/assessment-report.docx + JWT
  → montaż routera /api/method (Gateway.ts, plik:linia)
  → middleware (verifyToken → trialEntryGuard) w kolejności produkcyjnej
  → handler (server/src/routes/method-core.routes.ts:552-591)
  → assessmentReportContractService.build(...)  → ODCZYT tabel (nazwy)
  → buildAssessmentDrdReportSchema(...)          (plik:linia)
  → renderDocumentSchemaToDocxBuffer(...)        (plik:linia)
  → bajty odpowiedzi (nagłówki + rozmiar)
  → PLIK ZAPISANY NA DYSK → RENDER DO PDF/PNG → OBEJRZANY STRONA PO STRONIE
```

**Ostatniego ogniwa nie wolno pominąć ani zastąpić asercją na XML.** Dyżur 32
przeszedł mechanicznie i został odrzucony wizualnie **dokładnie dlatego, że
nikt nie otworzył pliku oczami.**

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

### 0.3. Higiena wykonania

- **★ COMMIT PER POZYCJA — TWARDO.** Conventional commits — dokładnie te
  (zangielszczone treści, polski raport):

  ```
  test(document-studio): pin byte-identical legacy docx output across three rich schemas (N)
  feat(document-studio): render a dedicated DRD cover block with the full metadata table (A)
  feat(document-studio): keep every matrix column under the DRD profile (B)
  feat(assessment): demote the editorial microstructure to placeholder metadata (C)
  feat(document-studio): localize and de-duplicate figure and table captions (D)
  feat(document-studio): raise the radar chart to print resolution and document typography (E)
  feat(document-studio): align the DRD footer with the accepted golden layout (F)
  feat(assessment): recalibrate missing-slot word limits against the golden report (G)
  docs(assessment): evidence that Word fills the native table of contents (H)
  test(assessment): page-by-page visual parity proof for two tenants (W)
  docs(assessment): raise 04_ASSESSMENT acceptance to the delivered visual scope (R.1)
  docs(assessment): day 34 duty report (R.2)
  ```

- **★ Odczyt wzorca — procedura, która NIE brudzi worktree.** Wszystko, co
  wypakowujesz ze złotego pliku i z dowodów dnia 32, ląduje **poza worktree**,
  w `/private/tmp/consultify-day34-work/`:

  ```bash
  mkdir -p /private/tmp/consultify-day34-work && cd /private/tmp/consultify-day34-work
  G=codex/golden-drd-report-20260827
  P=docs/program/waves/WAVE_03_ACCEPTANCE/prototypes/golden-drd-report
  git -C <root-repo> show $G:$P/RAPORT_DRD_METALPOL_WZORZEC.docx > wzorzec.docx
  git -C <root-repo> show $G:$P/RAPORT_DRD_METALPOL_WZORZEC.pdf  > wzorzec.pdf
  for f in build.cjs data.cjs radar.cjs postprocess.cjs measure.cjs make.sh; do
    git -C <root-repo> show $G:$P/generator/$f > $f
  done
  git -C <root-repo> show $G:$P/generator/radar.png > wzorzec-radar.png
  rm -rf wz && mkdir wz && (cd wz && unzip -q ../wzorzec.docx)
  ```

  **Tego katalogu NIE commitujesz i NIE linkujesz z kodu serwerowego.** Jest to
  materiał pomiarowy, nie zależność. **Z `data.cjs` wolno Ci czytać WYŁĄCZNIE
  liczby i strukturę — ani jedno zdanie prozy nie wchodzi do kodu (Z15).**

- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita:
  `npx prettier --write <pliki>`. W repo **nie ma** skryptu `format`.
- **Typy punktowo** — `npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null`.
  **NIGDY pełny `tsc -p` repo, NIGDY pełny `vitest` repo.**
  **★ `esbuild` TRANSPILUJE, nie typuje.** Dla plików pisanych od zera dopuszczam
  **jeden** przebieg `npx tsc --noEmit --skipLibCheck <plik>.ts` z filtrem do
  własnych plików; wynik do raportu. **Zakaz `tsc -p server/tsconfig.json`.**
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `toContain('...')`, **nie liczy się do DoD** (Z21). Dla `.docx`
  „behawioralny" znaczy: **rozpakowujesz wyprodukowany bufor i asertujesz na
  realnym XML** (`word/document.xml`, `word/styles.xml`, `word/footer*.xml`,
  `word/numbering.xml`), a nie na kodzie, który go tworzy.
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok kodu
  w `server/src/` dodają się normalnie.
- **★ MIGRACJE — reguły twarde.**
  1. **Wyłącznie addytywne.** Zakaz `DROP`, `ALTER COLUMN ... TYPE`, `RENAME`,
     `DELETE`, bezwarunkowego `UPDATE`.
  2. **★★ NUMERACJA — DZIEŃ 34 MA PRZYDZIELONY PRZEDZIAŁ `20261230`–`20261239`.**
     Reguła „najwyższy + 1" obowiązuje **TYLKO WEWNĄTRZ tego przedziału**. Numery
     spoza przedziału są **ZAKAZANE, nawet jeśli `ls` pokazuje je jako wolne**:
     `20261124`–`20261229` to pule dni 22–33 i prac wewnętrznych, **część jeszcze
     nie scalona**, więc `ls` ich u Ciebie nie pokaże — to nie znaczy, że są wolne.

     **Obowiązkowy `ls | grep` PRZED KAŻDYM plikiem:**

     ```bash
     ls server/migrations | grep -E '^2026[0-9]{4}' | sort | tail -5   # co widać jako zajęte
     ls server/migrations | grep '^2026123'                            # MUSI być PUSTE
     ```

     Nazwa: `<numer>_assessment_day34_<temat>.sql`. `migrate.postgres.ts` stosuje
     migracje w porządku **alfabetycznym nazw plików**, więc kolizja numeru to
     cicha katastrofa (`DEC-107`).
  3. **★ ZERO nowych kluczy obcych.**
  4. **★★ TA PRACA NAJPEWNIEJ NIE WYMAGA ŻADNEJ MIGRACJI. Sprawdziłem to za
     Ciebie:** wszystkie dziewięć pozycji roboczych dotyczy **warstwy renderowania
     i mapowania kontraktu na schemat dokumentu** — zero nowych obiektów
     bazodanowych, zero nowych kolumn, zero nowych odczytów spoza
     `assessmentReportContractService`. **Spodziewana liczba migracji: 0.**
     Migracja bez udowodnionego braku obiektu na świeżej bazie = pozycja
     odrzucona. Jeżeli mimo to uznasz, że migracja jest potrzebna — **STOP,
     opis w raporcie, decyzja nadzorcy.**
- **★ SPRZĄTANIE ŚRODOWISKA — dokładnie tak i nie inaczej.**

  ```bash
  docker rm -fv cx-day34-pg
  ```

  **ABSOLUTNY ZAKAZ `docker volume prune`, `docker system prune`, `docker volume rm`
  na czymkolwiek, czego nazwy nie znasz.** Równolegle żyją kontenery i wolumeny
  innych dyżurów; `prune` kasuje cudze retained-DB i jest nieodwracalny.
  `docker rm -fv <nazwa>` usuwa **wyłącznie** kontener tego dyżuru wraz z jego
  anonimowymi wolumenami — i to jest cała procedura. Sprzątasz **na końcu dyżuru,
  po ostatnim pomiarze**, i odnotowujesz to w raporcie.

### 0.4. BLOK 0 — środowisko i pomiar wejściowy (kolejność obowiązkowa)

**Kolejność jest częścią wymogu. Najpierw baza, potem pomiar.**

1. **Kontener** (port **5605**, patrz Z7):

   ```bash
   docker run -d --name cx-day34-pg -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day34 \
     -p 5605:5432 pgvector/pgvector:pg17
   # odczekaj na gotowość, potem DOWÓD CELU:
   docker exec cx-day34-pg psql -U postgres -d cx_day34 -c "SELECT current_database(), inet_server_port();"
   docker port cx-day34-pg
   ```

2. **Pełne migracje na PUSTEJ bazie** (tryb strict):

   ```bash
   DATABASE_URL="postgres://postgres:cx@localhost:5605/cx_day34" DB_TYPE=postgres \
     npx tsx server/src/database/migrate.postgres.ts
   ```

   Liczba zastosowanych migracji i ewentualne błędy — **dosłownie do raportu**.
   Migracja, która nie przechodzi na pustej bazie, jest **znaleziskiem
   raportowym**, nie powodem do jej „poprawienia" (poza zakresem, Z17).

3. **Pomiar WEJŚCIOWY — pełny zakres, bez zawężania (Z23).**

   ```bash
   DATABASE_URL="postgres://postgres:cx@localhost:5605/cx_day34" \
   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
   npx vitest run \
     server/src/services/documentStudio/__tests__ \
     server/src/services/assessment/__tests__ \
     server/src/routes/assessment/__tests__ \
     tests/unit/backend/routes \
     --reporter=verbose
   ```

   **Czerwone ZASTANE wypisujesz imiennie w raporcie PRZED rozpoczęciem §N.**
   Bez tej listy nie da się odróżnić Twojej regresji od cudzego długu i odbiór
   przyjmie najgorszą interpretację.

4. **Weryfikacja stanu wejściowego z §0.1 pkt 5** — komendy (a)–(h), wyniki
   dosłownie do raportu, rozbieżności do „Korekt wobec instrukcji".

5. **★ ODCZYT WZORCA I DOWODU DNIA 32 WŁASNYMI OCZAMI — PRZED PIERWSZĄ LINIĄ
   KODU.** To nie jest formalność; to jedyny sposób, żeby zrozumieć, o czym jest
   ten dyżur.

   ```bash
   cd /private/tmp/consultify-day34-work
   # wzorzec: 29 stron PDF — OBEJRZYJ WSZYSTKIE
   #   (podgląd PDF systemowy albo render do PNG — patrz ograniczenie krytyczne 4)
   # wyjście silnika dnia 32:
   cp <worktree>/docs/program/waves/WAVE_03_ACCEPTANCE/evidence/document-engine-day32-20260828/raport-drd-org-a.docx .
   rm -rf ev && mkdir ev && (cd ev && unzip -q ../raport-drd-org-a.docx)
   ```

   W raporcie potwierdzasz **jednym zdaniem, ile stron wzorca obejrzałeś i co
   zobaczyłeś na stronie tytułowej obu plików.** Bez tego zdania pozycje §A–§F
   nie są odbierane.

---

## 1. STAN WEJŚCIOWY — ustalenia ZMIERZONE przez nadzorcę

Poniższe zostało **zmierzone na markerze**, nie przepisane z cudzego raportu.
**Każdą liczbę masz obowiązek powtórzyć własnym pomiarem** i wpisać rozbieżność
do „Korekt wobec instrukcji". Numery linii są z markera i mogą się przesunąć —
**odnajdujesz je grepem, nie ufasz numerowi.**

### 1.1. Wzorzec (złoty plik) — pomiar

| Cecha | Wartość zmierzona | Skąd |
| --- | --- | --- |
| Commit | `c2a91d0258707a446be797664b967fe1ad20f8ac` | `git log -1 codex/golden-drd-report-20260827` |
| Strony | 29 (PDF) | `RAPORT_DRD_METALPOL_WZORZEC.pdf` |
| Tabele | 18 | `document.xml.count('<w:tbl>')` |
| `w:styleId` w `styles.xml` | 22 | zbiór unikalnych |
| inline `w:rFonts` w `document.xml` | **638** | `len(re.findall(r'<w:rFonts', x))` |
| Okładka | znak marki (`● C O N S U L T I F Y`, crimson) · kicker · tytuł · nazwa klienta · **metryczka 9-wierszowa** | akapity 0–19 |
| Metryczka — wiersze | Klient · Profil działalności · Zatrudnienie · Okres oceny · Oceniający · Sponsor po stronie klienta · Metodyka · Sygnatura sesji · Data wydania | `build.cjs` fn. metryczki |
| Radar PNG | **2482 × 1432 px**, proporcja **1,733** | `IHDR` |
| Radar osadzenie | `<wp:extent cx="5772150" cy="3324225"/>` = **6,312 × 3,634 cala** → **≈ 393 dpi** | `document.xml` |
| Podpis rysunku | `Rysunek 1. …` (JEDEN, pełnym zdaniem) | akapit stylem `Podpis` |
| Podpisy tabel | `Tabela N. …` | jw. |
| Stopka | `Poufne — <klient>` ⟶tab⟶ `Strona N z M` ⟶tab⟶ `● Consultify` (kropka crimson), linia górna `HAIR`, tab-stopy CENTER + RIGHT | `makeFooter()` |
| Streszczenie zarządcze — proza | **131 słów** (Lead 68 + Treść 69); z podpisem rysunku i etykietami tabeli: 206 | zliczone per akapit |
| Wnioski końcowe — proza | **276 słów** (4 akapity); z linią decyzyjną i podpisem zamykającym ≈ 369 | jw. |
| Linia decyzyjna — komórki | Kierunek **21** · Priorytet **16** · Horyzont **12** · Warunek sukcesu **15** słów | jw. |
| Spis treści | **NIE jest polem natywnym Worda** — numery stron `3 / 26 / 28` są WPISANE na sztywno, zmierzone renderem PDF przez LibreOffice (`measure.cjs`) | `document.xml`, style `TOC1`/`TOC2` |

> **★ To ostatni wiersz jest ważny dla §H.** Wzorzec ma spis treści „na sztywno",
> bo prototyp mógł sobie pozwolić na LibreOffice. **Silnik ma pole natywne i to
> jest ŚWIADOMA RÓŻNICA NA KORZYŚĆ SILNIKA**, nie luka — pole natywne aktualizuje
> się przy każdej edycji i druku, wpisane liczby kłamią po pierwszej zmianie.
> §H nie ma tego „naprawiać"; §H ma to **udowodnić zrzutem z realnego Worda.**

### 1.2. Wyjście silnika (dzień 32) — pomiar tego samego

Plik: `docs/program/waves/WAVE_03_ACCEPTANCE/evidence/document-engine-day32-20260828/raport-drd-org-a.docx`
(organizacja „Zakład Wtryskowni Ćmielów").

| Cecha | Wartość zmierzona | Werdykt |
| --- | --- | --- |
| Tabele | 17 | ~ |
| `w:styleId` | 32 | ~ |
| inline `w:rFonts` | **0** | ★ przewaga silnika |
| Okładka — akapity | 4: tytuł · **`client final report · PL · comprehensive · poufne dla klienta`** · `Odbiorcy: …` · `Wygenerowano: …` | **P0-1 CZERWONE** |
| Metryczka | **nie istnieje** | **P0-1 CZERWONE** |
| Kolumny matrycy | klamra: **`+3 more` ×2 i `+2 more` ×2** w jednym pliku | **P0-2 CZERWONE** |
| Podpisy | `Figure 1 — Profil dojrzałości DRD` + osobny `Rys. 1. …` (**podwójny**); `Table 1 — Tab. 1. …` (**podwójny prefiks w jednej linii**); **8 podpisów-sierot bez treści**: `Table 3, 5, 7, 9, 11, 13, 15, 16` | **P1-4 CZERWONE** |
| Radar PNG | **960 × 540 px**, proporcja **1,778** | **P1-5 CZERWONE** |
| Radar osadzenie | `<wp:extent cx="6096000" cy="3429000"/>` = 6,667 × 3,75 cala → **144 dpi** | **P1-5 CZERWONE** |
| Stopka | `Poufne — Zakład Wtryskowni Ćmielów   \|   poufne — tylko dla klienta   \|   Strona N z M`, wyrównanie do prawej, separator `   \|   `, **bez znaku marki**, poufność **podwojona** | **P1-6 CZERWONE** |
| Rusztowanie redakcyjne | **117 punktów** listy `stan faktyczny / ocena i wiarygodność / znaczenie dla przedsiębiorstwa / luka i sens poziomu docelowego / najbliższy krok` **jako treść dokumentu** | **P0-3 CZERWONE** |
| Placeholdery | 102 akapity/komórki `Sekcja do uzupełnienia — limit N–M słów.` | ~ (uczciwe) |
| Udział słów placeholderowych | **759 / 2845 = 27 %**; łącznie z rusztowaniem ≈ **41 %** | ★ patrz §1.4 |
| Spis treści | kicker `NAWIGACJA` + **pole natywne Worda** (`TableOfContents`, `updateFields: true`) | **P2-8 NIEZMIERZONE** |

> **★ KOREKTA WOBEC USTALEŃ ODBIORU — trzy liczby się nie zgodziły. Podaję je
> jawnie, bo instrukcja ma być prawdą, nie przepisaniem cudzego wniosku.**
>
> 1. Odbiór mówił o **jednym** nagłówku „+3 more". Pomiar: w jednym pliku są
>    **cztery** klamry — `+3 more` ×2 (osie o 7 poziomach) i `+2 more` ×2
>    (osie o 6 poziomach). Skala problemu jest większa niż w ustaleniu.
> 2. Odbiór mówił o **gołym `Table 16` na s. 18**. Pomiar: **osiem** sierot
>    (`Table 3, 5, 7, 9, 11, 13, 15, 16`) — to wszystkie tabele linii decyzyjnej,
>    które nie mają `caption` w danych.
> 3. Odbiór mówił, że **61 % słów raportu to placeholder**. Pomiar nadzorcy:
>    **27 %** słów literalnie placeholderowych, **≈41 %** licząc rusztowanie
>    redakcyjne. **Zmierz to sam i podaj SWOJĄ metodę liczenia** — obie liczby
>    są prawdziwe przy różnych definicjach „słowa raportu" (mój licznik pomija
>    natywne pole TOC, które w XML nie ma tekstu).
> 4. Odbiór mówił o wzorcowym radarze **1890 × 1091 @ 300 dpi**. Pomiar:
>    **2482 × 1432 px**, osadzony na **6,312 cala** → **≈ 393 dpi**, proporcja
>    **1,733**. **Cel §E bierzesz z MOJEGO pomiaru, nie z ustalenia odbioru.**
> 5. Odbiór mówił, że wzorcowe streszczenie ma **≈160** słów, a wnioski **≈410**.
>    Pomiar: **131** i **276** słów prozy. **Cel §G wyprowadzasz z własnego
>    pomiaru wzorca, nie z żadnej z tych liczb** — procedura w §G.1.

### 1.3. ★★ KTO WOŁA RENDERER — lista, której nie wolno zepsuć (KOREKTA)

**Ustalenie odbioru mówiło o „sześciu konsumentach, w tym PUBLICZNEJ trasie
`report-builder-public.routes.ts:596`". To ostatnie jest NIEPRAWDĄ i sprawdziłem
to za Ciebie.** `report-builder-public.routes.ts` **nie importuje ani
`documentDocxRenderer`, ani `documentDocxStyles`** — ma własną, lokalną funkcję
`writePublicReportDocx` (linia 187), zbudowaną wprost na pakiecie `docx`
(`import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'`).
Trasa publiczna jest więc **poza promieniem rażenia tego dyżuru** — co jej NIE
zdejmuje z listy „nie dotykasz" (Z17), tylko zmienia uzasadnienie.

**Realni konsumenci — zmierzone `grep -rn`, wszystkie do potwierdzenia w §0.1(f):**

| # | Plik | Import | Ryzyko |
| --- | --- | --- | --- |
| 1 | `server/src/routes/method-core.routes.ts:100` | `renderDocumentSchemaToDocxBuffer` | **to jest trasa DRD — Twoja** |
| 2 | `server/src/services/v8/transformationFinalOutputService.ts:9` | `renderDocumentSchemaToDocxBuffer` | legacy — bitowa niezmienność |
| 3 | `server/src/services/deliverables/bundleExportRuntime.ts:12` | `renderDocumentSchemaToDocxBuffer` | legacy — bitowa niezmienność |
| 4 | `server/src/services/documentStudio/documentStudioService.ts:72` (użycie: `:1605`) | `renderDocumentSchemaToDocxBuffer` | legacy — **najszerszy**, Document Studio |
| 5 | `server/src/services/initiative/initiativeMaterializeService.ts:28` | `renderDocumentSchemaToDocxBuffer` | legacy — bitowa niezmienność |
| 6 | `server/src/services/documentStudio/documentPdfRenderer.ts:48` | `resolveFormattingClass` z `documentDocxStyles` | **★ konsument STYLÓW, nie renderera** — zmiana w `resolveFormattingClass` zmienia wyjście **PDF**, nie DOCX. Nie dotykasz tej funkcji. |
| 7 | `server/src/services/assessment/assessmentDrdReportSchemaService.ts:3` | `DRD_DOCX_STYLE_IDS`, `DRD_REPORT_PALETTE` | Twój |

**W raporcie podajesz swoją listę z `grep` i konfrontujesz ją z powyższą.**
Jeżeli u Ciebie wyjdzie inaczej — prawdą jest Twój pomiar, a rozbieżność idzie
do „Korekt".

### 1.4. ★ UCZCIWOŚĆ SKALI — czego ten dyżur NIE naprawia

W bazie dowodowej dnia 32 był **jeden oceniony obszar na 39**. Dlatego dokument
w dużej części składa się z uczciwych placeholderów. **To NIE jest wada wizualna
i NIE naprawiasz tego zmyślaniem treści (Z15).**

Konsekwencje dla Ciebie, wszystkie obowiązkowe:

1. **Nie „ratujesz" wyglądu przez zagęszczenie danych demo.** Uzupełnienie danych
   sesji oceny to **osobny dyżur danych demo** — wpisujesz to do „Znalezisk"
   jako zależność zewnętrzną i **nazywasz po imieniu w raporcie**.
2. **Twoje dwie organizacje dowodowe z §W mają mieć WIĘCEJ ocenionych obszarów
   niż jeden** — bo inaczej nie zobaczysz na oczy tego, co naprawiasz (matryca
   z wypełnionymi cyframi poziomu, radar z dwoma wielokątami). To jest **seed
   w Twoim teście, w Twoim kontenerze**, nie zmiana danych demo w repo.
3. **Jeśli po zasianiu danych któraś oś dalej nie ma ani jednego wyniku — radar
   ma to pokazać uczciwie** (brak wielokąta = brak danych). **Nie maskujesz
   tego zerami, średnią ani „reprezentatywną" krzywą.**
4. W raporcie podajesz **udział słów placeholderowych dla obu swoich plików**
   oraz **swoją definicję licznika** (§1.2, korekta 3).

### 1.5. Uczciwy placeholder — brzmienie, którego NIE zmieniasz

Ekran raportu Oceny (dzień 27, zaakceptowany — `DEC-146`, `DEC-150`) pokazuje
puste sloty literałem z `public/locales/pl/translation.json`:

```
"emptySlot": "Sekcja do uzupełnienia — limit {{min}}–{{max}} słów."
```

Serwis §D dnia 32 mówi tym samym głosem (`placeholder()`, `assessmentDrdReportSchemaService.ts:47-49`).
**Brzmienia bazowego NIE zmieniasz.** §C dokłada do niego **jedno zdanie
metadanych**; §G zmienia **liczby limitów**. Nic więcej.

Znaki: półpauza `—` to `U+2014`, a półpauza w zakresie `–` to `U+2013`. **To są
dwa różne znaki i pomylenie ich jest defektem typograficznym, który odbiór
wyłapie.**

### 1.6. Poza zakresem (idzie do „Znalezisk", nie do kodu)

1. **Uzupełnienie danych demo sesji oceny** — §1.4 pkt 1. Zależność zewnętrzna.
2. **Tłumaczenie 233 opisów poziomów** (`DRDLevel.description`).
3. **Atrapy eksportu Assessment** — `/export/pdf`, `/export/pptx` (`DEC-132` pkt 5).
4. **Ujednolicenie pięciu systemów stylowania eksportu.**
5. **`docxtemplater`, szablony `.dotx`, generacja PPT.**
6. **Przycisk „Pobierz .docx" we froncie** — osobny dyżur frontowy, `src/**` zamknięte.
7. **Trasa publiczna `report-builder-public.routes.ts`** — §1.3; jej własny,
   ubogi generator DOCX jest **znaleziskiem**, nie zadaniem.
8. **Kontrakt raportu v2.** §G jest wprost zaprojektowane tak, **żeby v2 nie był
   potrzebny** — limity są stałymi w kodzie serwisu.

### 1.7. Granica plikowa — ostra

```
WOLNO (Twój zakres):
  server/src/services/documentStudio/documentDocxStyles.ts            (§B/§E/§F — WYŁĄCZNIE pod bramką isDrdReportProfile; Z24)
  server/src/services/documentStudio/documentDocxRenderer.ts          (§A/§B/§D/§E/§F — WYŁĄCZNIE pod bramką isDrdReportProfile; Z24)
  server/src/services/documentStudio/documentChartRasterizer.ts       (§E — rozdzielczość i typografia radaru)
  server/src/services/documentStudio/documentStudioTypes.ts           (§A — pola opcjonalne schematu, jeśli konieczne; ZERO pól wymaganych)
  server/src/services/assessment/assessmentDrdReportSchemaService.ts  (§A/§C/§D/§G — serce zmian treściowych)
  server/src/services/documentStudio/__tests__/day34.*.test.ts        (NOWE pliki)
  server/src/services/assessment/__tests__/day34.*.test.ts            (NOWE pliki)
  tests/integration/routes/assessment.day34.*.postgres.integration.test.ts  (NOWE pliki, git add -f)
  docs/program/waves/WAVE_03_ACCEPTANCE/evidence/document-visual-day34-20260828/**  (NOWY katalog dowodowy)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md  (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/DOCUMENT_ENGINE_VISUAL_DAY34_REPORT_20260828.md  (jedyny nowy dokument)

WOLNO ROZSZERZYĆ (istniejący harness, nie piszesz od nowa):
  server/src/services/documentStudio/__tests__/day32.rendererParity.test.ts  (★ §N — dokładasz schematy, NIE usuwasz istniejących asercji)
  server/src/services/documentStudio/__tests__/fixtures/**                   (★ §N — nowe snapshoty; istniejących NIE nadpisujesz „żeby przeszły")

IMIENNE LICENCJE (wolno CZYTAĆ i WOŁAĆ, NIE zmieniać):
  server/src/services/assessment/assessmentReportContractService.ts   (WOŁASZ; ZMIANA = STOP — kontrakt odebrany DEC-122/DEC-149, front dnia 27 na nim stoi)
  server/src/services/assessment/assessmentSkipReasonService.ts       (WOŁASZ pośrednio; ZMIANA = STOP)
  server/src/routes/method-core.routes.ts                             (★ CZYTASZ; trasa .docx jest KOMPLETNA — ZMIANA = STOP, Z11)
  server/src/data/drdStructure.ts                                     (CZYTASZ — etykiety skali PL z dnia 32; ZMIANA = STOP)
  server/src/method-core/outputs/**                                   (WOŁASZ bez zmian; ZMIANA = STOP, Z16)
  server/src/middleware/auth.middleware.ts                            (MONTUJESZ w teście; ZMIANA = STOP)
  server/src/middleware/trialEntryGuard.middleware.ts                 (MONTUJESZ w teście; ZMIANA = STOP)
  server/src/services/documentStudio/documentDocxStructure.ts         (CZYTASZ; ZMIANA = STOP)
  docs/ui-standards/00-foundation/BRAND_EXPORT_CANON.md               (CZYTASZ jako SSOT stylowania; ZMIANA = STOP)
  docs/.../prototypes/golden-drd-report/**                            (CZYTASZ przez `git show`; ZMIANA = ODRZUCENIE)
  wzorzec testu dowodowego —
    server/src/services/assessment/__tests__/assessmentAiPartner.day25.pg.test.ts
    (realny router + realny JWT + realny PG — Twój wzorzec dla §W)

NIE WOLNO:
  ★★ CAŁE src/** DO ZAPISU (odczyt i grep — TAK)                   ← podział FRONT/TYŁ; zero wyjątków
  ★  dev-render/**, public/locales/**                              ← front
  ★  server/src/services/documentStudio/documentPdfRenderer.ts     ← konsument STYLÓW (§1.3 poz. 6); MIERZYSZ, nie zmieniasz
  ★  server/src/services/aiAssessmentPartnerService.ts             ← Z14, zero LLM
     server/src/services/aiAssessmentReportGenerator.ts            ← Z14
     server/src/services/aiAssessmentFormHelper.ts                 ← Z14
  server/src/services/effectiveAccessService.ts                    ← Z16
  server/src/services/v8/artifactRegistryService.ts                ← Z16
  server/src/services/methodCore/**                                ← Z16
  server/src/Gateway.ts                                            ← Z11, trasa już stoi
  server/src/routes/assessment/**                                  ← inny tor
  server/src/utils/pdfFonts.ts i trasy pdfkit                      ← zamknięte DEC-133/139
  server/src/services/deliverables/**                              ← konsument renderera; MIERZYSZ, nie zmieniasz
  server/src/services/v8/transformationFinalOutputService.ts       ← jw.
  server/src/services/initiative/initiativeMaterializeService.ts   ← jw.
  server/src/services/documentStudio/documentStudioService.ts      ← jw. (najszerszy konsument)
  server/src/routes/report-builder*.routes.ts                      ← własny generator DOCX (§1.3); ZNALEZISKO, nie zadanie
  server/migrations/<istniejące pliki>                             ← TYLKO ODCZYT
  tests/e2e/**  ·  tests/acceptance/**                             ← cudzy tor odbiorowy (MIERZYSZ, nie zmieniasz)
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie jest**
praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie, idziesz
dalej. Wyjątku nie ma nawet dla „jednej linii importu".

---

## 2. POZYCJE DYŻURU

**Kolejność wykonania jest wiążąca: §N → §A → §B → §C → §D → §E → §F → §G → §H → §W.**
§N idzie pierwsze, bo jest **siatką bezpieczeństwa dla wszystkich pozostałych** —
bez niej nie wiesz, czy właśnie zepsułeś Document Studio.

---

### §N — BITOWA NIEZMIENNOŚĆ WYJŚCIA LEGACY (warunek nienaruszalny)

**Bez tej pozycji dyżur jest odrzucony w całości, niezależnie od tego, jak dobrze
wygląda dokument DRD.** To nie jest test „na koniec" — to jest **narzędzie, które
budujesz PRZED pierwszą zmianą w rendererze i uruchamiasz PO KAŻDEJ.**

**N.1 — Rozszerz istniejący harness, nie pisz drugiego.**
`server/src/services/documentStudio/__tests__/day32.rendererParity.test.ts` ma już
jeden schemat legacy (`LEGACY_SCHEMA`, `executive_memo`, `en-US`, bez okładki,
bez TOC, bez stopki) i porównuje `word/document.xml` + `word/styles.xml` przez
`toMatchFileSnapshot`. **Dokładasz do tego pliku (albo do nowego
`day34.rendererParity.test.ts` importującego te same pomocnicze) co najmniej
DWA kolejne, BOGATE schematy legacy** — tak, żeby razem pokryły:

| Wymiar | Musi wystąpić |
| --- | --- |
| Język | `pl-PL` **oraz** `en-US` |
| Okładka | `coverPage: true` **oraz** `coverPage: false` |
| Spis treści | `toc: true` (w tym `tocConfig.nativeField: true`) **oraz** `toc: false` |
| Stopka | `footers.enabled: true` z `pageNumbering` + `confidentialityLabel` **oraz** `footers.enabled: false` |
| Bloki | `table` (w tym **tabela szersza niż 8 kolumn** — inaczej nie zobaczysz regresji §B), `bullet_list`, `numbered_list`, `callout`, `quote`, `heading`, `paragraph`, `image`/`chart` |
| Załącznik | `appendixStyle` różny od `'none'` |
| Cytowania | `sourceRefs` na sekcji **i** `sourceRef` na bloku (przypisy → `word/footnotes.xml`) |
| Klasa formatowania | co najmniej dwie różne (`communicationRegister` / `languageStyle: 'legal'`) |

**★ Bogaty schemat, który nie ma tabeli >8 kolumn, nie jest bogaty.** §B rusza
`clampTableColumns` — jeśli w żadnym schemacie legacy klamra nie działa, dowód
niczego nie dowodzi.

**N.2 — Trzy pliki XML, nie dwa.** Harness dnia 32 porównuje `document.xml`
i `styles.xml`. **Dokładasz `word/numbering.xml`** — listy punktowane i numerowane
mają w nim definicje `abstractNum`, a §C rusza listy. Dla każdego schematu
i każdego z trzech plików liczysz **SHA-256** i wpisujesz do raportu tabelę:

```
schemat | plik            | SHA PRZED | SHA PO | ZGODNE?
--------|-----------------|-----------|--------|--------
legacy-1| document.xml    | ...       | ...    | TAK
legacy-1| styles.xml      | ...       | ...    | TAK
legacy-1| numbering.xml   | ...       | ...    | TAK
...
```

**N.3 — Procedura PRZED/PO bez `git stash` (Z27).**

```bash
mkdir -p /private/tmp/consultify-day34-work/przed
# PRZED pierwszą zmianą w rendererze:
cp server/src/services/documentStudio/documentDocxRenderer.ts /private/tmp/consultify-day34-work/przed/
cp server/src/services/documentStudio/documentDocxStyles.ts   /private/tmp/consultify-day34-work/przed/
# wygeneruj bufory bazowe i policz SHA (skrypt jednorazowy w /private/tmp, NIE w repo)
```

**Baseline liczysz RAZ, na czystym markerze, i zapisujesz SHA do pliku
w `/private/tmp/consultify-day34-work/`.** Po każdej pozycji (§A…§G) powtarzasz
generowanie i porównujesz SHA z baseline'em. **Rozbieżność w którymkolwiek SHA =
natychmiastowe cofnięcie ostatniej zmiany, zanim pójdziesz dalej.**

**N.4 — Czego NIE wolno zrobić, żeby test przeszedł.**

- **Nie nadpisujesz snapshotów dnia 32** (`fixtures/day32.legacy.*.xml`)
  „bo się zmieniły". Ich zmiana **jest** regresją, którą masz zobaczyć.
- **Nie normalizujesz XML przed porównaniem** (usuwanie białych znaków,
  sortowanie atrybutów). Porównanie ma być **bajtowe**.
- **Nie wyłączasz asercji na czas pracy.**
- **Nie tłumaczysz rozbieżności „to tylko atrybut `w:rsid`"** — renderer nie
  generuje `rsid`; jeśli coś się zmieniło, zmieniłeś to Ty.

**Definicja ukończenia §N:**
- [ ] harness pokrywa **≥ 3 bogate schematy legacy** spełniające wszystkie wiersze
      tabeli z N.1 (wypisz, który schemat pokrywa który wymiar);
- [ ] dla każdego: **3 pliki XML × SHA PRZED/PO**, tabela w raporcie;
- [ ] co najmniej jeden schemat legacy zawiera **tabelę >8 kolumn**;
- [ ] snapshoty dnia 32 **nietknięte** (`git diff --stat` na katalogu `fixtures/`
      pokazuje wyłącznie DODANE pliki);
- [ ] w raporcie zdanie: „każda zmiana w `documentDocxRenderer.ts`
      i `documentDocxStyles.ts` jest bramkowana `isDrdReportProfile`" **wraz
      z `git diff` tych dwóch plików pokazanym w całości** — jeśli diff nie mieści
      się w jednym spojrzeniu, pozycja jest do odrzucenia.

---

### §A — OKŁADKA DRD JAKO WŁASNY BLOK PROFILU (P0-1)

**Problem zmierzony.** Profil DRD ustawia w schemacie tylko `coverPage: true`
(`assessmentDrdReportSchemaService.ts:424`) i dziedziczy **legacy** `renderCoverBlock`
(`documentDocxRenderer.ts:1184+`). Ten blok składa podtytuł z czterech członów,
z których **dwa nie mają polskiego tłumaczenia**:

- `documentTypeLabels` (`:1187-1189`) zna **wyłącznie** `steering_committee_report`
  → dla `client_final_report` leci fallback `documentType.replace(/_/g, ' ')`
  = **`client final report`**;
- `densityLabels` (`:1190`) zna **wyłącznie** `detailed` i `concise` → dla
  `comprehensive` leci surowa wartość = **`comprehensive`**.

Efekt na twarzy dokumentu klienta: **`client final report · PL · comprehensive ·
poufne dla klienta`**. Metryczki nie ma w ogóle.

**A.1 — Cel: okładka DRD to WŁASNY blok, nie łatka na legacy.**
Dodajesz do renderera **osobną gałąź** okładki, wybieraną **wyłącznie** przez
`isDrdReportProfile(ctx.schema)`. Legacy `renderCoverBlock` zostaje **nietknięte**
— także jego brakujące etykiety. **Dopisanie `client_final_report` do
`documentTypeLabels` jest ZAKAZANE**: to zmiana w kodzie współdzielonym, złamie
§N i naprawi objaw zamiast przyczyny.

**A.2 — Zawartość okładki DRD, 1:1 ze wzorcem.** Kolejność i skład wg §1.1:

1. **znak marki** — `● C O N S U L T I F Y`; kropka `●` crimson `85182F`,
   napis crimson, spacjowany. **To jedyne dopuszczone miejsce crimson na
   okładce** (`BRAND_EXPORT_CANON` §3 pkt 1a; CLAUDE.md pułapka nr 1);
2. **kicker** — `OCENA DOJRZAŁOŚCI CYFROWEJ · DIGITAL PATHFINDER`, teal,
   spacjowany, wersaliki;
3. **tytuł** — `Raport z oceny dojrzałości cyfrowej` (z twardą spacją po `z`);
4. **nazwa klienta** — z kontraktu (`sessionLabel.displayName`);
5. **metryczka — tabela 2-kolumnowa, DOKŁADNIE 9 wierszy**, w kolejności wzorca:

   | Etykieta | Skąd bierzesz |
   | --- | --- |
   | Klient | `contract.sessionLabel.displayName` |
   | Profil działalności | kontrakt (jeśli niesie) — **inaczej placeholder** |
   | Zatrudnienie | kontrakt (jeśli niesie) — **inaczej placeholder** |
   | Okres oceny | kontrakt (jeśli niesie) — **inaczej placeholder** |
   | Oceniający | kontrakt (jeśli niesie) — **inaczej placeholder** |
   | Sponsor po stronie klienta | kontrakt (jeśli niesie) — **inaczej placeholder** |
   | Metodyka | stała metodyki DRD (kanon, nie dane tenanta) |
   | Sygnatura sesji | `contract.sessionId` / etykieta sesji |
   | Data wydania | `contract.generatedAt` |

**★★ A.3 — REGUŁA, KTÓREJ ZŁAMANIE ODRZUCA CAŁY DYŻUR (Z15).**
Czego kontrakt nie niesie, **wpisujesz jako JAWNY PLACEHOLDER w wierszu
metryczki**. **Wiersz NIGDY nie znika.** Brzmienie: krótkie, jednoznaczne,
stylem `Podpis` (kursywa, `MUTED`), np. `Do uzupełnienia — dane nie są zapisane
w sesji oceny.` **Zabronione absolutnie:** zmyślona branża, zmyślone zatrudnienie,
zmyślone nazwisko oceniającego, zmyślony sponsor, `—`, pusta komórka, znikający
wiersz, `[PLACEHOLDER]`, `TODO`, `{{zmienna}}`.

**Dlaczego wiersz nie może zniknąć:** konsultant musi zobaczyć **czego brakuje**.
Metryczka o siedmiu wierszach wygląda kompletnie i jest kłamstwem przez
przemilczenie.

**A.4 — Pierwsza rzecz do zrobienia w tej pozycji: SPRAWDŹ, CO KONTRAKT NIESIE.**
Nie zgaduj. `assessmentReportContractService` jest w licencji do **czytania**:

```bash
grep -n "sessionLabel\|interface AssessmentReportContract" -A 30 \
  server/src/services/assessment/assessmentReportContractService.ts | head -80
```

**Wynik tego rekonesansu — tabela w raporcie: pole metryczki → źródło → status
(Z DANYCH / STAŁA / PLACEHOLDER).** Dziewięć wierszy, żadnego pominiętego.
**Jeżeli dojdziesz do wniosku, że kontrakt powinien nieść pole, którego nie ma —
to jest STOP i pozycja w raporcie, NIE zmiana kontraktu** (`assessmentReportContractService`
jest odebrany, `DEC-122`/`DEC-149`, front dnia 27 na nim stoi).

**A.5 — Typografia.** Twarde spacje po jednoliterowych spójnikach i przyimkach
(`a i o u w z`) — mechanizm z dnia 32 już jest w rendererze (`isPolish && isDrdReportProfile`,
`documentDocxRenderer.ts:1756`). **Sprawdzasz, że działa na Twoich nowych
akapitach okładki**, i pokazujesz to w XML (` ` po `z` w tytule).

**Definicja ukończenia §A:**
- [ ] okładka DRD renderuje się **wyłącznie** pod `isDrdReportProfile`; legacy
      `renderCoverBlock` **nietknięte** (`git diff` pokazuje tylko rozgałęzienie);
- [ ] **zero** angielskiego ciągu na twarzy dokumentu — grep w `document.xml`
      na `client final report`, `comprehensive`, `steering committee report`
      zwraca **0 trafień** dla obu plików z §W;
- [ ] metryczka: **dokładnie 9 wierszy**, w kolejności wzorca, w obu plikach z §W;
- [ ] tabela w raporcie: pole → źródło → status, 9/9;
- [ ] **każde pole bez danych ma widoczny placeholder, zero zniknięć, zero
      zmyśleń** — sprawdzone oczami na renderze PDF/PNG;
- [ ] `● C O N S U L T I F Y` obecny, crimson **wyłącznie** tam;
- [ ] §N zielone po tej pozycji.

---

### §B — MATRYCA Z PEŁNYM ZESTAWEM KOLUMN (P0-2)

**Problem zmierzony.** `DOCX_TABLE_MAX_COLS = 8` (`documentDocxStyles.ts:766`),
a `clampTableColumns(columnCount)` jest wołany **BEZWARUNKOWO**
(`documentDocxRenderer.ts:826`) — bez bramki profilu. Matryca DRD ma
`Obszar + poziomy 1..maxLevel + Luka + Priorytet`; osie DRD mają `maxLevel` **5, 6
albo 7**, więc kolumn jest 8, 9 albo 10. Skutek zmierzony w pliku dowodowym:
**`+3 more` ×2 i `+2 more` ×2** — czyli **etykieta interfejsu w dokumencie
klienta**, zjedzone kolumny **Luka** i **Priorytet**, oraz łamanie nazw obszarów
w środku wyrazów („Procesy Marketingo we"), bo pozostałe kolumny ściska się na
siłę.

**B.1 — Bramka, nie podniesienie stałej.** `DOCX_TABLE_MAX_COLS` **zostaje 8**
dla wszystkich konsumentów legacy. Zmieniasz **wołanie**: pod
`isDrdReportProfile(ctx.schema)` klamra się **nie stosuje** (albo stosuje się
z limitem wystarczającym na `1 + maxLevel + 2`). **Podniesienie samej stałej =
zmiana dla wszystkich = złamanie §N = odrzucenie.**

**B.2 — Jawne szerokości kolumn.** Bez `columnWidths` Word rozdziela szerokość
sam i „Procesy Marketingowe" łamie się w środku wyrazu. Ustawiasz jawnie,
w `DXA`, sumując do szerokości kolumny tekstu:

- **Obszar** — szeroka (wzorzec daje jej najwięcej: nazwa musi się zmieścić
  w jednej–dwóch liniach bez łamania wyrazu);
- **poziomy 1..N** — wąskie i **równe** (to komórki na jedną cyfrę);
- **Luka** i **Priorytet** — wąskie, ale szersze niż poziomy (mieszczą
  `25 pkt proc.` i `Krytyczny`).

**Zmierz szerokości ze wzorca** (`build.cjs`, funkcja matrycy osi, ~linia 152)
i podaj w raporcie **swoje** wartości obok wzorcowych.

**B.3 — Cyfra poziomu w wypełnionej komórce.** Wzorzec pokazuje poziom obecny
i docelowy jako **wypełnione komórki z cyfrą** — nie jako osobne kolumny
liczbowe. Odtwórz to: komórka poziomu, w której obszar ma wynik, dostaje
**tintę** i **cyfrę**; pozostałe zostają puste. **Kolory z `DRD_REPORT_PALETTE`,
crimson WYŁĄCZNIE dla luki krytycznej** (`gap >= 3`), nigdy jako akcent.

**B.4 — Tylko linie poziome + padding.** Wzorzec nie ma siatki pionowej.
Ustawiasz `borders` tak, żeby zostały wyłącznie linie poziome (`HAIR`), i dajesz
komórkom `margins` (padding) — bez tego tekst klei się do krawędzi. **Obie rzeczy
pod bramką profilu**; `DOCX_PALETTE`/zebra legacy zostaje nietknięta.

**B.5 — Zero „+N more" w JAKIMKOLWIEK dokumencie DRD.** Asercja behawioralna:
rozpakowany `document.xml` obu plików z §W **nie zawiera** ciągu ` more`
(ze spacją). Jeżeli jakakolwiek tabela DRD nadal się nie mieści — **to jest STOP
i pozycja w raporcie**, nie cichy fold.

**Definicja ukończenia §B:**
- [ ] matryca każdej z 7 osi ma **`1 + maxLevel + 2` kolumn**, policzone per oś
      i wypisane w raporcie (5 → 8 kol., 6 → 9 kol., 7 → 10 kol.);
- [ ] `grep -c ' more' document.xml` = **0** dla obu plików z §W;
- [ ] `DOCX_TABLE_MAX_COLS` **niezmieniona** (`git diff` na tej linii pusty);
- [ ] jawne `columnWidths` — wartości w raporcie obok wzorcowych;
- [ ] cyfry poziomu w wypełnionych komórkach — **widoczne na zrzucie**;
- [ ] brak siatki pionowej, padding obecny — **widoczne na zrzucie**;
- [ ] **żadna nazwa obszaru nie jest złamana w środku wyrazu** — sprawdzone
      oczami na renderze, nie asercją;
- [ ] §N zielone po tej pozycji (w tym schemat legacy z tabelą >8 kolumn —
      **jego klamra ma dalej działać**).

---

### §C — RUSZTOWANIE REDAKCYJNE JAKO METADANE, NIE TREŚĆ (P0-3)

**Problem zmierzony.** `assessmentDrdReportSchemaService.ts:206-217` dla każdego
obszaru z komentarzem emituje `bullet_list` z mikrostrukturą
(`stan faktyczny / ocena i wiarygodność / znaczenie dla przedsiębiorstwa /
luka i sens poziomu docelowego / najbliższy krok`). W pliku dowodowym daje to
**117 punktów** listy — **instrukcje dla autora wydrukowane w dokumencie
klienta**.

**C.1 — Cel.** Mikrostruktura zostaje **metadanymi placeholdera**, nie treścią.
Zamiast listy pięciu punktów — **jedno zdanie doklejone do placeholdera**:

```
Sekcja do uzupełnienia — limit N–M słów; wymagane: stan faktyczny, ocena
i wiarygodność, znaczenie dla przedsiębiorstwa, luka i sens poziomu docelowego,
najbliższy krok.
```

Jeden akapit stylem `Podpis` zamiast akapitu + pięciopunktowej listy.

**C.2 — Dwie reguły, które łatwo pominąć.**

1. **Mikrostruktura pochodzi z kontraktu, nie z Twojej stałej.** Lista pól jest
   per-komentarz (`comment.microstructure`) — wypisujesz **to, co kontrakt
   niesie dla tego obszaru**, w kolejności kontraktu, po polsku wg
   `MICROSTRUCTURE_PL` (`:36-42`). Nie hardkodujesz pięciu pozycji.
2. **Gdy slot MA treść — mikrostruktury nie ma w ogóle.** Dziś lista renderuje
   się niezależnie od tego, czy komentarz jest wypełniony. **To jest osobny
   defekt tego samego miejsca** i naprawiasz go razem: rusztowanie pokazuje się
   **wyłącznie przy pustym slocie**.

**C.3 — Czego NIE robisz.** Nie usuwasz rusztowania całkiem (konsultant ma
dostać wskazówkę, `DEC-146`). Nie zmieniasz brzmienia bazowego placeholdera
(§1.5). Nie przenosisz mikrostruktury do komentarza Worda (`comments.xml`) —
to inny kontrakt i nikt go nie zamawiał.

**Definicja ukończenia §C:**
- [ ] `bullet_list` mikrostruktury **nie występuje** w `document.xml` żadnego
      z plików §W — asercja na braku pozycji `stan faktyczny` jako samodzielnego
      akapitu listy;
- [ ] każdy pusty slot komentarza obszaru ma **jedno zdanie** z listą wymaganych
      elementów, po polsku, z kontraktu;
- [ ] slot **wypełniony** nie ma rusztowania — udowodnione na obszarze
      z treścią w seedzie §W;
- [ ] liczba punktów listy w dokumencie: **PRZED 117 → PO <ile>** (podaj obie);
- [ ] §N zielone (ta pozycja rusza serwis, nie renderer — §N ma zostać zielone
      trywialnie; **potwierdź to, nie zakładaj**).

---

### §D — PODPISY PO POLSKU, JEDEN NA OBIEKT, ZERO SIEROT (P1-4)

**Problem zmierzony — trzy osobne defekty w jednym miejscu.**

`captionLabel` jest zaszyty po angielsku w trzech miejscach renderera:
`documentDocxRenderer.ts:916` (`Table ${n}`), `:937` i `:990` (`Figure ${n}`) —
bez lokalizacji i bez bramki profilu. W pliku dowodowym daje to:

1. **podwójny podpis rysunku**: `Figure 1 — Profil dojrzałości DRD` **i** pod
   spodem `Rys. 1. Profil dojrzałości cyfrowej według siedmiu osi DRD.`
   (drugi pochodzi z `caption` w danych, `assessmentDrdReportSchemaService.ts:286`);
2. **podwójny prefiks w jednej linii**: `Table 1 — Tab. 1. Zestawienie siedmiu
   osi DRD.` (auto-numeracja + `caption` z danych, `:309`);
3. **osiem podpisów-sierot**: `Table 3, 5, 7, 9, 11, 13, 15, 16` — same etykiety
   bez treści, bo tabele linii decyzyjnej nie mają `caption` w danych.

**D.1 — Cel.**

| Warunek | Zachowanie |
| --- | --- |
| profil DRD + `pl` | prefiks `Rysunek N.` / `Tabela N.` |
| profil DRD + inny język | prefiks angielski, jak dziś |
| **spoza profilu DRD** | **bez zmian, bit w bit** (§N) |
| `caption` jest w danych | **podpis z danych WYGRYWA** — auto-numeracja nie dokleja własnego prefiksu |
| `caption` brak | **podpis się NIE renderuje wcale** (zero sierot), a numerator i tak zlicza obiekt |

**★ D.2 — Reguła „podpis z danych wygrywa" ma jeden haczyk.** Dane niosą już
własny prefiks (`Rys. 1.`, `Tab. 1.`). Masz **dwie** poprawne drogi i **wybierasz
jedną, uzasadniając w raporcie**:

- **(a)** renderer **nie dokleja nic**, gdy `caption` istnieje — a serwis
  przestaje wpisywać prefiks do `caption`, oddając numerację rendererowi;
- **(b)** renderer dokleja `Rysunek N.` tylko wtedy, gdy `caption` **nie
  zaczyna się** od własnego prefiksu.

**Droga (a) jest zalecana** — (b) to heurystyka na stringu, która pęknie przy
pierwszym podpisie zaczynającym się od słowa „Tabela". **Jeżeli wybierasz (b) —
napisz dlaczego.**

**D.3 — Sieroty: usuwasz podpis, nie numer.** Tabela bez `caption` **nie dostaje
akapitu podpisu**. Licznik `ctx.tableCounter` **dalej się inkrementuje** — inaczej
numeracja pozostałych podpisów przestanie zgadzać się z kolejnością tabel
w dokumencie. **Sprawdź to jawnie**: po zmianie numery mają być rosnące
i bez dziur w obrębie podpisanych tabel, ale zgodne z fizyczną kolejnością tabel.
**Podaj w raporcie, którą semantykę wybrałeś** (numer per tabela vs. numer per
podpisana tabela) — to jest decyzja produktowa i ma być widoczna.

**D.4 — Podpisy tabel linii decyzyjnej.** Osiem sierot to tabele
`${axisId}-decision` i `program-decision`. **Nie wymyślasz im podpisów.** Albo
zostają bez podpisu (D.3), albo serwis nadaje im podpis z **istniejącej stałej**
(`DRD_REPORT_FIXED_TEXT.decisionLine` = `LINIA DECYZYJNA`, `:26`). **Nie
wymyślasz nowego zdania.**

**Definicja ukończenia §D:**
- [ ] `grep -c 'Figure \|Table ' document.xml` = **0** dla obu plików §W;
- [ ] `Rysunek N.` / `Tabela N.` obecne i **rosnące**;
- [ ] **zero podwójnych podpisów** — asercja: żaden akapit podpisu nie zawiera
      dwóch prefiksów; żaden rysunek/tabela nie ma dwóch akapitów podpisu;
- [ ] **zero podpisów-sierot** — asercja: każdy akapit stylem podpisu ma treść
      poza samym prefiksem;
- [ ] wybrana droga (a)/(b) i semantyka numeracji **uzasadnione w raporcie**;
- [ ] schemat legacy **dalej dostaje `Figure`/`Table`** — potwierdzone w §N;
- [ ] §N zielone.

---

### §E — RADAR W LIDZE WZORCA (P1-5)

**Problem zmierzony.**

| | Wzorzec | Silnik dnia 32 |
| --- | --- | --- |
| PNG | 2482 × 1432 px | **960 × 540 px** |
| Osadzenie | `cx=5772150` (6,312 cala) | `cx=6096000` (6,667 cala) |
| Efektywne dpi | **≈ 393** | **144** |
| Proporcja | **1,733** | 1,778 |
| Wielokąty | dwa, wypełnione (obecny navy, docelowy teal) | brak/domyślne |
| Siatka | ciągła, `HAIR`, 5 pierścieni + szprychy | domyślna Chart.js (**przerywana**) |
| Typografia | Calibri (krój dokumentu) | domyślna Chart.js (**obca**) |
| Adnotacje | `39% → 64%` przy **każdej** osi | **brak** |
| Legenda | chipy z horyzontem | domyślna |

Źródło po stronie silnika: `documentChartRasterizer.ts` — `DEFAULT_WIDTH = 960`,
`DEFAULT_HEIGHT = 540` (`:9-10`, `:215-216`), oraz osadzenie
`transformation: { width: 640, height: 360 }` (`documentDocxRenderer.ts:1001`).

**E.1 — Cele liczbowe (z MOJEGO pomiaru wzorca, §1.1, nie z ustaleń odbioru):**

- **≥ 300 dpi efektywnie** przy osadzeniu — czyli przy szerokości osadzenia
  `W_cali` PNG ma mieć `≥ 300 × W_cali` pikseli. Przy osadzeniu 6,3 cala:
  **≥ 1890 px szerokości**. **Wzorzec ma 393 dpi — nie musisz go bić, masz
  przebić próg 300.**
- **proporcja ≈ 1,73 : 1** (wzorzec 2482 : 1432). Zmień **oba** wymiary — sama
  szerokość zepsuje kształt.
- **typografia dokumentu** — krój z `resolveDocxFonts`, nie domyślny Chart.js.
- **siatka ciągła**, kolor `HAIR` z `DRD_REPORT_PALETTE`, bez przerywanych linii.
- **adnotacja per oś**: `<obecny>% → <docelowy>%`.
- **legenda z horyzontem** — jak wzorzec.

**E.2 — Bramka i tylko bramka.** Podniesienie `DEFAULT_WIDTH`/`DEFAULT_HEIGHT`
w `documentChartRasterizer.ts` **zmienia wszystkie wykresy wszystkich
konsumentów** — Document Studio, deliverables, initiative, v8. **To jest złamanie
warunku nienaruszalnego.** Rozdzielczość i styl podnosisz **wyłącznie dla
wywołania z profilu DRD** (opcje przekazane z renderera pod bramką
`isDrdReportProfile`). Domyślne wartości stałych **zostają 960 × 540**.

**E.3 — Pamięć i rozmiar. Zmierz, zanim urośnie.** PNG 1890 × 1091 waży
wielokrotnie więcej niż 960 × 540 (wzorcowy 2482 px waży **272 kB**, silnikowy
960 px — **62 kB**). Sprawdź i **podaj w raporcie**: rozmiar PNG, rozmiar całego
`.docx`, czas rasteryzacji. **Jeżeli `.docx` przekracza ~2 MB — to jest pozycja
do decyzji nadzorcy**, nie cicha kompresja stratna.

**E.4 — ★ UCZCIWY BRAK DANYCH.** Jeżeli oceniona jest tylko jedna oś, wielokąt
się nie domyka — **to jest UCZCIWY BRAK DANYCH i NIE MASKUJESZ GO.** Zakazane:
domykanie zerami, interpolacja, „reprezentatywna" krzywa, ukrycie wykresu.
Dopuszczalne i pożądane: **widoczna adnotacja przy nieocenionych osiach**
(`DRD_REPORT_FIXED_TEXT.notAssessed` = `Oś nie została oceniona.`, `:24` — stała
już istnieje, **nie wymyślasz nowej**).

**Definicja ukończenia §E:**
- [ ] PNG w `word/media/` obu plików §W: **szerokość ≥ 300 × szerokość osadzenia
      w calach**, podana liczbowo w raporcie (px, cale, dpi);
- [ ] proporcja w przedziale **1,70–1,78**;
- [ ] krój pisma na wykresie = krój dokumentu — **widoczne na zrzucie**;
- [ ] siatka ciągła, zero linii przerywanych — **widoczne na zrzucie**;
- [ ] adnotacja `X% → Y%` przy **każdej** ocenionej osi;
- [ ] legenda z horyzontem;
- [ ] **osie nieocenione oznaczone jawnie, wielokąt nie domknięty sztucznie**;
- [ ] `DEFAULT_WIDTH`/`DEFAULT_HEIGHT` **niezmienione** (`git diff` pusty na tych
      liniach); zmiana wyłącznie w opcjach z bramki;
- [ ] rozmiary (PNG, `.docx`) i czas rasteryzacji w raporcie;
- [ ] §N zielone — **w tym schemat legacy z wykresem: jego PNG ma mieć dalej
      960 × 540** (jeśli żaden legacy nie ma wykresu, dołóż taki do §N).

---

### §F — STOPKA JAK WE WZORCU (P1-6)

**Problem zmierzony.** Stopka silnika (zmierzona w `word/footer1.xml`):

```
Poufne — Zakład Wtryskowni Ćmielów   |   poufne — tylko dla klienta   |   Strona N z M
```

wyrównana **do prawej**, separator `   |   `, poufność **podwojona** (raz
w prefiksie `Poufne —`, raz jako etykieta `poufne — tylko dla klienta`), **bez
znaku marki**. Źródło: `documentDocxRenderer.ts:1576-1668` — trzy niezależne
człony (`headerLabel` / `confidentialityLabel` / `pageNumbering`) sklejane
separatorem.

Wzorzec (`build.cjs:587-609`):

```
Poufne — <klient>   ⟶tab(CENTER)⟶   Strona N z M   ⟶tab(RIGHT)⟶   ● Consultify
```

z linią górną `HAIR`, tab-stopami CENTER (połowa szerokości tekstu) i RIGHT
(pełna szerokość), rozmiarem `16` (8 pt) i kolorem `MUTED`; kropka `●` crimson,
napis `Consultify` w `MUTED`.

**F.1 — Cel.** Pod `isDrdReportProfile` stopka DRD ma **trzy człony na tab-stopach**,
dokładnie jak wyżej: poufność z nazwą klienta po lewej, paginacja na środku,
znak marki po prawej. **Poufność występuje RAZ.** Linia górna `HAIR`.
**Pierwsza strona bez stopki** (wzorzec: `footers.first` pusty) — sprawdź, czy
silnik już to robi (`documentDocxRenderer.ts:1736`), i **nie duplikuj mechanizmu**.

**F.2 — Bramka.** Legacy `footerRuns` **zostaje nietknięte** — z separatorem
`   |   `, wyrównaniem do prawej i podwójną poufnością włącznie. To nie jest
Twój dług. Budujesz **równoległą gałąź** pod bramką profilu.

**F.3 — Crimson.** Kropka `●` przed `Consultify` jest **jedynym** crimsonem
w stopce (`BRAND_EXPORT_CANON` §3 pkt 1a). Napis `Consultify` jest `MUTED`.
**Nie kolorujesz całego znaku marki na crimson** — wzorzec tego nie robi.

**Definicja ukończenia §F:**
- [ ] `word/footer1.xml` obu plików §W zawiera **dokładnie trzy** człony
      rozdzielone tabulatorami, w kolejności wzorca;
- [ ] słowo `poufne`/`Poufne` występuje w stopce **raz** (asercja licząca);
- [ ] `● Consultify` obecne, kropka crimson `85182F`, napis `MUTED`;
- [ ] tab-stopy CENTER + RIGHT ustawione **liczbowo** (wartości w raporcie);
- [ ] linia górna `HAIR` obecna;
- [ ] pierwsza strona bez stopki — **potwierdzone na renderze**;
- [ ] stopka legacy **bit w bit niezmieniona** — potwierdzone w §N schematem
      z `footers.enabled: true`;
- [ ] §N zielone.

---

### §G — LIMITY SŁÓW SKALIBROWANE WZORCEM (P1-7)

**Problem zmierzony.** `CONTRACT_V1_MISSING_SLOT_LIMITS`
(`assessmentDrdReportSchemaService.ts:31-34`):

```ts
executiveSummary: { minWords: 180, maxWords: 260 },
finalConclusions: { minWords: 180, maxWords: 260 },
```

Ta **jedna** stała trafia w cztery zupełnie różne miejsca:

- streszczenie zarządcze (`:295`, rozdz. 0);
- wnioski końcowe (`:332-339`, rozdz. 8);
- **cztery komórki programowej linii decyzyjnej** (`:346-349`) — Kierunek,
  Priorytet, Horyzont, Warunek sukcesu.

Pomiar wzorca (§1.1) mówi, że **żadne z tych trzech miejsc nie ma tego samego
rzędu wielkości**: streszczenie **131** słów prozy, wnioski **276**, komórki
linii decyzyjnej **12–21**. Placeholder mówiący konsultantowi „napisz 180–260
słów" w komórce, w której wzorzec ma 12 słów, jest **mierzalnie błędną
instrukcją**.

**★ G.1 — NIE PRZEPISUJESZ MOICH LICZB. ZMIERZ WZORZEC SAM.**
To jest jedyna pozycja, w której instrukcja **wymaga własnego pomiaru zamiast
podanej wartości**, bo ustalenia odbioru (≈160 / ≈410 / 10-25) i mój pomiar
(131 / 276 / 12-21) **się rozjechały**. Procedura:

```bash
cd /private/tmp/consultify-day34-work
python3 - <<'PY'
import re
x = open('wz/word/document.xml', encoding='utf-8').read()
paras = []
for p in re.findall(r'<w:p[ >].*?</w:p>', x, re.S):
    t = ''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', p, re.S))
    st = re.search(r'<w:pStyle w:val="([^"]+)"', p)
    paras.append((st.group(1) if st else '', re.sub(r'<[^>]+>', '', t)))
for i, (s, t) in enumerate(paras):
    print(i, s, len(t.split()), repr(t[:70]))
PY
```

Odnajdujesz `Heading1` „Streszczenie zarządcze", „8. Wnioski końcowe"
i `Heading2` „Linia decyzyjna dla całego programu", liczysz słowa **prozy**
(style `Lead`/`Tresc`, **bez** podpisów i etykiet tabel) i **wpisujesz swoje
liczby do raportu wraz z metodą liczenia**.

**G.2 — Z pomiaru wyprowadzasz TRZY osobne stałe.** Jedna stała przestaje
istnieć; w jej miejsce wchodzą trzy, **z komentarzem wskazującym commit wzorca**:

```ts
// Skalibrowane wzorcem c2a91d0258 (RAPORT_DRD_METALPOL_WZORZEC.docx).
// Pomiar: streszczenie <X> słów prozy, wnioski końcowe <Y>, komórki linii
// decyzyjnej <A>–<B>. Okna dobrane wokół pomiaru — patrz raport dnia 34 §G.
export const CONTRACT_V1_MISSING_SLOT_LIMITS = Object.freeze({
  executiveSummary:  { minWords: ..., maxWords: ... },
  finalConclusions:  { minWords: ..., maxWords: ... },
  decisionLineField: { minWords: ..., maxWords: ... },
} as const);
```

**Reguła doboru okna, żeby nie było uznaniowe:** okno **zawiera** zmierzoną
wartość wzorca, jego dolna granica jest **nie wyższa** od pomiaru, górna **nie
niższa**, i obie są zaokrąglone do dziesiątek. Jeżeli Twój pomiar da 131 —
`minWords` nie może być 180. **Punktem odniesienia jest liczba, nie intuicja,
i w raporcie pokazujesz przejście pomiar → okno.**

**G.3 — Kontrakt v2 NIE jest do tego potrzebny — i to jest wymóg, nie sugestia.**
Limity są **stałymi w kodzie serwisu mapującego**, a nie polami kontraktu.
`assessmentReportContractService` jest odebrany (`DEC-122`/`DEC-149`) i front
dnia 27 na nim stoi. **Jeżeli złapiesz się na tym, że Twoje rozwiązanie wymaga
nowego pola w kontrakcie albo bumpa `contractVersion` — to jest STOP i pozycja
w raporcie**, nie zmiana kontraktu.

**G.4 — Miejsce użycia.** `:346-349` przestaje wołać `finalLimit` i woła
`decisionLineField`. Per-rozdziałowe linie decyzyjne (`:226-250`) używają
`conclusionPlaceholder` **z kontraktu** — tam limity przychodzą z danych i **nie
ruszasz ich**. Sprawdź to, zanim zmienisz: to dwa różne mechanizmy w jednym pliku.

**Definicja ukończenia §G:**
- [ ] własny pomiar wzorca w raporcie: **3 liczby + metoda liczenia**;
- [ ] rozbieżność wobec ustaleń odbioru (≈160/≈410/10-25) i wobec mojego pomiaru
      (131/276/12-21) **nazwana wprost**;
- [ ] trzy stałe zamiast jednej, z komentarzem `skalibrowane wzorcem c2a91d0258`;
- [ ] przejście pomiar → okno pokazane liczbowo;
- [ ] `contractVersion` i `assessmentReportContractService` **nietknięte**
      (`git diff` pusty);
- [ ] placeholder w komórkach linii decyzyjnej pokazuje limit rzędu kilkunastu
      słów — **widoczne w pliku §W**;
- [ ] §N zielone.

---

### §H — DOWÓD SPISU TREŚCI Z REALNEGO WORDA (P2-8)

**Problem.** Silnik renderuje kicker `NAWIGACJA` (`documentDocxRenderer.ts:1380`)
i **natywne pole Worda** `TableOfContents` z `features: { updateFields: true }`
(`:1382`, `:1698`). W surowym XML pod kickerem **nie ma nic** — bo pole wypełnia
dopiero Word przy otwarciu. **Nikt tego nigdy nie sprawdził.** Odbiór dnia 32
zapisał paginację jako `NIEMIERZALNE` — i to była **deklaracja bez próby pomiaru**,
czyli dokładnie to, czego ta instrukcja zabrania.

**H.1 — Cel: DOWÓD, nie zmiana kodu.** Ta pozycja **najprawdopodobniej nie
wymaga ani jednej linii kodu**. Wymaga **otwarcia pliku i zrobienia zrzutu.**

**H.2 — Procedura.**

1. Otwórz `raport-drd-org-a.docx` z §W w **realnym Wordzie** (LibreOffice jako
   podgląd **nie wystarcza** — jego obsługa pól TOC różni się od Worda; jeżeli
   nie masz Worda, patrz H.4).
2. Jeżeli Word zapyta o aktualizację pól — **zaakceptuj** i **odnotuj, że pytał**
   (to jest część kontraktu użytkownika: `updateFields: true` powoduje pytanie).
3. Zrzut ekranu strony ze spisem treści: **pozycje + numery stron**.
4. Zrzut zapisz jako `spis-tresci-word.png` w katalogu dowodowym §W.2.
5. W raporcie: czy pole się wypełniło, ile pozycji, czy numery stron są sensowne,
   czy kicker `NAWIGACJA` nie koliduje z nagłówkiem `Spis treści`.

**H.3 — Możliwe wyniki i co z nimi zrobić.**

| Wynik | Działanie |
| --- | --- |
| Pole wypełnia się poprawnie | **PARYTET, i to na korzyść silnika** (§1.1) — opisujesz i **nic nie zmieniasz** |
| Pole puste do ręcznego `F9` | Znalezisko + opis wpływu na użytkownika; zmiana kodu **tylko jeśli mieści się w bramce profilu i nie rusza legacy**, inaczej STOP |
| Pole nie powstaje wcale | **To jest defekt** — pozycja w raporcie i STOP na decyzję nadzorcy |
| Kicker koliduje z nagłówkiem | Poprawiasz **pod bramką profilu** (jedna z niewielu zmian kosmetycznych, na jakie ta pozycja pozwala) |

**★ H.4 — Gdy nie masz realnego Worda.** Nie zgadujesz i nie piszesz
`NIEMIERZALNE`. Piszesz dokładnie: **„nie mam dostępu do realnego Worda na tej
maszynie; pole TOC jest natywne i wymaga renderu Worda; pozycja wymaga odbioru
u właściciela — zrzut z LibreOffice załączam jako częściowy, z zastrzeżeniem, że
LibreOffice obsługuje pola TOC inaczej niż Word."** Załączasz zrzut z tego, co
masz. **Deklaracja „NIEMIERZALNE" bez próby pomiaru = odrzucenie pozycji.**

**Definicja ukończenia §H:**
- [ ] zrzut spisu treści z realnego renderu — załączony;
- [ ] narzędzie renderu **nazwane po imieniu** (Word / LibreOffice / inne);
- [ ] odpowiedź na cztery pytania z H.2 pkt 5;
- [ ] werdykt z tabeli H.3, z uzasadnieniem;
- [ ] jeśli była zmiana kodu — bramkowana profilem i §N zielone.

---

### §W — DOWÓD KOŃCOWY: DWIE ORGANIZACJE, OCZY, TABELA PARYTETU STRONA-PO-STRONIE

**To jest pozycja, dla której cały dyżur istnieje.** Dyżur 32 miał zieloną
mechanikę i czerwony wygląd **dokładnie dlatego, że nikt nie obejrzał pliku.**

**W.1 — Dwie organizacje, seed w Twoim kontenerze.**
W teście (`day34.visualParity`) zasiej **dwie** organizacje, w każdej po jednej
sesji DRD, o **różnych** wynikach. Wymagania:

- **żadna nie jest Metalpolem** i żadna nie powtarza jego liczb;
- **istotnie więcej niż jeden oceniony obszar** (§1.4 pkt 2) — inaczej nie
  zobaczysz matrycy z cyframi ani radaru z wielokątami;
- **co najmniej jedna oś o `maxLevel = 7`** — inaczej nie sprawdzisz §B na
  najszerszej matrycy (10 kolumn);
- **co najmniej jeden obszar nieoceniony** (`currentLevel = null`);
- **co najmniej jedno pominięcie pełne i jedno częściowe**;
- **co najmniej jedna oś bez ani jednego wyniku** — dowód §E.4;
- **co najmniej jedna luka krytyczna** (`gap >= 3`) — żeby crimson miał się na
  czym pokazać;
- **co najmniej jeden slot komentarza WYPEŁNIONY i jeden PUSTY** — dowód §C.2 pkt 2;
- **polskie znaki w nazwie projektu** — przechodzą przez nazwę pliku, okładkę
  i stopkę.

**Dane demo = twarz produktu (CLAUDE.md): seed żyje w kontenerze tego dyżuru,
sprząta po sobie i nie dotyka żadnej innej bazy.**

**W.2 — Pliki generujesz PRZEZ TRASĘ, nie przez wywołanie serwisu (Z21).**
Wzorzec dowodowy:
`server/src/services/assessment/__tests__/assessmentAiPartner.day25.pg.test.ts:31-35`
— realny router `method-core.routes.js` zamontowany pod `/api/method`, realny
`verifyToken` + `trialEntryGuard` w kolejności produkcyjnej, realny JWT podpisany
sekretem z `Config`, realny PG z §0.4.

Artefakty do
`docs/program/waves/WAVE_03_ACCEPTANCE/evidence/document-visual-day34-20260828/`:

| Plik | Co zawiera |
| --- | --- |
| `raport-drd-org-a.docx` | z trasy, organizacja A |
| `raport-drd-org-b.docx` | z trasy, organizacja B |
| `raport-drd-org-a.pdf` | render org A (patrz W.3) |
| `strony/org-a-s01.png` … `sNN.png` | **każda strona** org A jako PNG |
| `spis-tresci-word.png` | §H |
| `parytet.md` | tabela z W.4 |
| `document.xml.txt` | wyciąg strukturalny org A (nagłówki w kolejności + `styleId` + liczba tabel) |
| `sha-niezmiennosci.txt` | tabela SHA z §N.2 |

**★ Rozmiar w ryzach.** Radar to teraz PNG ≥ 300 dpi, więc `.docx` urośnie.
Jeżeli którykolwiek plik przekracza ~2 MB — **zamiast pliku wstaw wyciąg
i napisz, dlaczego**. Zrzuty stron trzymaj w rozsądnej rozdzielczości.

**W.3 — RENDER I OBEJRZENIE — obowiązkowe, własnymi oczami.**
Renderujesz `.docx` do PDF i każdą stronę do PNG **lokalnie** (licencja
z ograniczenia krytycznego 4 — LibreOffice **na Twojej maszynie**, poza repo,
zero śladu w `server/**` i `scripts/**`). Następnie **oglądasz każdą stronę.**

**Nie „przeglądasz". Nie „próbkujesz co piątą". Każdą.** W raporcie podajesz
**liczbę obejrzanych stron** obu plików.

**W.4 — ★★ TABELA PARYTETU STRONA-PO-STRONIE.** To jest produkt tej pozycji.
Cztery kolumny, wiersz na obszar, werdykt z zamkniętego zbioru
`PARYTET / RÓŻNICA ŚWIADOMA / LUKA / NIEMIERZALNE`:

| Obszar | Wzorzec (strona) | Silnik (strona) | Werdykt + uzasadnienie |
| --- | --- | --- | --- |
| Okładka — znak marki | s. 1 | s. ? | |
| Okładka — kicker + tytuł | s. 1 | s. ? | |
| Okładka — metryczka 9 wierszy | s. 1 | s. ? | |
| Spis treści — pozycje i numery | s. 2 | s. ? | |
| Streszczenie — proza wiodąca | s. 3 | s. ? | |
| Streszczenie — radar | s. 3 | s. ? | |
| Streszczenie — tabela zbiorcza osi | s. 3–4 | s. ? | |
| Rozdział — wstęp | s. 5 | s. ? | |
| Rozdział — matryca poziomów (7 poziomów) | s. 5–6 | s. ? | |
| Rozdział — sygnatura obszaru | s. 6 | s. ? | |
| Rozdział — ocena obszaru / placeholder | s. 6 | s. ? | |
| Rozdział — wnioski | s. 7 | s. ? | |
| Rozdział — linia decyzyjna | s. 7 | s. ? | |
| Wnioski końcowe | s. 26 | s. ? | |
| Linia decyzyjna programu | s. 26 | s. ? | |
| Załącznik A — rejestr luk | s. 28 | s. ? | |
| Stopka | każda | każda | |
| Podpisy rysunków i tabel | przekrojowo | przekrojowo | |
| Typografia PL (twarde spacje, sieroty) | przekrojowo | przekrojowo | |
| Paleta (crimson tylko semantyka krytyczna + znak marki) | przekrojowo | przekrojowo | |

**Numery stron wzorca ustalasz z `wzorzec.pdf` (29 stron), nie z pamięci.**

**★★ W.5 — „NIEMIERZALNE" wymaga próby pomiaru, nie tylko przyczyny.**
Wpisanie `NIEMIERZALNE` bez opisu **próby**, jaką podjąłeś, i **przyczyny**, dla
której się nie udała, jest **odrzuceniem tej pozycji tabeli**. Dokładnie tak
poległa paginacja w dniu 32. Format wymagany:

```
NIEMIERZALNE — próbowałem: <co konkretnie zrobiłeś>. Nie udało się, bo: <przyczyna>.
Skutek dla użytkownika: <co to znaczy dla kogoś, kto otworzy plik>.
Do rozstrzygnięcia przez: <kto, na czym>.
```

**W.6 — Dwa wiersze przewagi silnika (wzorzec ich nie ma).**

| Obszar | Co podajesz |
| --- | --- |
| **Uczciwość pustych sekcji** | ile sekcji dostało placeholder, ile treść — liczby z obu plików + udział słów (§1.4 pkt 4) |
| **Widoczność pominięć** | czy pominięcia pełne i częściowe są widoczne z kodem — cytat z `document.xml` |
| **inline `rFonts`** | wzorzec **638** → Twoje pliki **<ile>** (dzień 32: 0 — **utrzymaj**) |
| **Spis treści** | pole natywne vs. wpisane liczby wzorca (§1.1 ramka) |

**W.7 — Pomiar wyjściowy (Z23).** Powtórz **dokładnie** przebieg z §0.4 pkt 3.
Do raportu: `PRZED` / `PO` / **delta**, z rozbiciem **ZASTANE / WPROWADZONE**
i liczbą **SKIPPED**. **Każdy nowy FAIL wymaga imiennego wyjaśnienia**; nowy FAIL
w którymkolwiek z konsumentów renderera (§1.3) to **STOP i cofnięcie zmiany**,
nie „do naprawy w kolejnym dyżurze".

**Definicja ukończenia §W:**
- [ ] dwa pliki `.docx` dla dwóch różnych, niemetalpolowych organizacji,
      wygenerowane **przez trasę**;
- [ ] wszystkie dziewięć warunków danych z W.1 obecnych i **widocznych w pliku**;
- [ ] render do PDF + PNG **każdej strony**, liczba obejrzanych stron w raporcie;
- [ ] tabela parytetu **strona-po-stronie**, 20 wierszy z W.4, każdy z werdyktem
      i uzasadnieniem;
- [ ] każde `NIEMIERZALNE` w formacie z W.5 — **zero gołych deklaracji**;
- [ ] cztery wiersze przewagi z W.6;
- [ ] `sha-niezmiennosci.txt` z §N;
- [ ] pomiar wyjściowy pełnego zakresu, delta wyjaśniona co do testu;
- [ ] `docker rm -fv cx-day34-pg` wykonane i odnotowane.

---

### §R.1 — `MODULE_ACCEPTANCE.md` modułu Ocena

W `docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md`
podnieś stan **wyłącznie o to, co realnie dowiozłeś**, i **wyłącznie w sekcjach
dotyczących eksportu/raportu**. Zakazy: nie reformatujesz pliku (dzień 17 dostał
za to uwagę — 55 przeformatowanych linii zaszumiło governance), nie zmieniasz
cudzych wierszy, nie podnosisz statusów pozycji, których nie dotknąłeś.
**Jeżeli którakolwiek pozycja wyszła `CZĘŚCIOWO` — wpisujesz `CZĘŚCIOWO`.**

### §R.2 — Raport dyżuru

**Dokładnie jeden plik:**
`docs/program/waves/WAVE_03_ACCEPTANCE/DOCUMENT_ENGINE_VISUAL_DAY34_REPORT_20260828.md`,
wg szablonu z §3.

---

## 3. RAPORT — szablon obowiązkowy

Sekcje w tej kolejności, żadnej nie pomijasz (pusta sekcja = napis „brak", nie
usunięcie nagłówka).

```markdown
# Dyżur 34 — parytet wizualny silnika dokumentu DRD — raport

## 0. Wiązanie i środowisko
- SHA markera (dosłownie to, co stało w polu markera): ...
- MARKER OK / MARKER BRAK: ... (wynik komendy)
- Rozejście markera wobec tipa (git log + lista plików) albo „brak rozejścia"
- Gałąź własna, worktree, `git diff --name-only <SHA>...HEAD` (dosłownie)
- Gałąź złotego pliku: `git log -1` + `git ls-tree` + GOLDEN MERGED/NOT MERGED
- Kontener PG: nazwa, PORT (jawnie), dowód celu połączenia (dosłownie), `docker port`
- Migracje na pustej bazie: liczba zastosowanych, błędy
- Migracje własne: ile (spodziewane 0), numery z przedziału 20261230-39
- Sprzątanie: `docker rm -fv cx-day34-pg` — wykonane / nie (jeśli nie: dlaczego)
- Narzędzie renderu PDF/PNG użyte lokalnie (nazwa) + potwierdzenie, że nie ma go w server/** ani scripts/**

## 1. Weryfikacja stanu wejściowego (§0.1 pkt 5)
Tabela: komenda | oczekiwane wg instrukcji | zmierzone | zgodne?
Osobno: „obejrzałem N stron wzorca; na stronie tytułowej wzorca widać ...;
na stronie tytułowej pliku dnia 32 widać ...".

## 2. Pomiar PRZED (pełny zakres §0.4 pkt 3, bez zawężania)
- suma PASS / FAIL / SKIPPED
- lista czerwonych ZASTANYCH, imiennie

## 3. ★ BITOWA NIEZMIENNOŚĆ (§N) — dowód
- lista schematów legacy: który pokrywa który wymiar z tabeli N.1
- tabela: schemat | plik XML | SHA PRZED | SHA PO | ZGODNE?
- `git diff` documentDocxRenderer.ts i documentDocxStyles.ts — W CAŁOŚCI
- zdanie: „każda zmiana w tych dwóch plikach jest bramkowana isDrdReportProfile" TAK/NIE
- snapshoty dnia 32: nietknięte TAK/NIE (`git diff --stat` na fixtures/)

## 4. Pozycje
Per pozycja (N, A, B, C, D, E, F, G, H, W): status
ZROBIONE_WG_DoD / CZĘŚCIOWO / STOP / NIE_ZACZĘTE,
lista odhaczonych punktów DoD, commit, dowód.

## 5. ★ TABELA PARYTETU STRONA-PO-STRONIE (§W.4)
20 wierszy: obszar | wzorzec (strona) | silnik (strona) | werdykt + uzasadnienie
Plus cztery wiersze przewagi (§W.6).
Każde NIEMIERZALNE w formacie §W.5.

## 6. Pomiary liczbowe PRZED/PO (obowiązkowe, wszystkie)
| Miara | wzorzec | silnik PRZED | silnik PO |
| „+N more" w document.xml | 0 | 4 | ? |
| „Figure "/"Table " | 0 | 18 | ? |
| podpisy-sieroty | 0 | 8 | ? |
| wiersze metryczki okładki | 9 | 0 | ? |
| punkty rusztowania redakcyjnego | 0 | 117 | ? |
| radar px / dpi / proporcja | 2482 / ~393 / 1,733 | 960 / 144 / 1,778 | ? |
| człony stopki | 3 (tab) | 3 (pipe, poufność ×2) | ? |
| inline rFonts | 638 | 0 | ? |
| udział słów placeholderowych | n/d | 27 % (metoda: ...) | ? |
| rozmiar .docx | ... | 75 kB | ? |

## 7. Nazwane RÓŻNICE ŚWIADOME (nie luki)
Co świadomie robimy inaczej niż wzorzec i dlaczego (np. natywne pole TOC).

## 8. Pomiar PO (pełny zakres, bez zawężania)
- suma PASS / FAIL / SKIPPED, delta wobec PRZED
- rozbicie ZASTANE / WPROWADZONE
- nowe FAIL — imiennie, z wyjaśnieniem
- konsumenci renderera (§1.3): bez nowych FAIL TAK/NIE

## 9. Artefakty dowodowe
Lista plików w evidence/document-visual-day34-20260828/ z rozmiarami.

## 10. Korekty wobec instrukcji
Wszystko, co zmierzyłeś inaczej, niż napisano w §1. Obowiązkowo odnieś się do
pięciu korekt z ramki §1.2 i do korekty §1.3 (trasa publiczna).

## 11. Zależności zewnętrzne (§1.4)
Dane demo sesji oceny — stan, wpływ, do jakiego dyżuru to należy.

## 12. Znaleziska poza zakresem
## 13. Twierdzenia NIEZWERYFIKOWANE
## 14. STOP-y i pytania do nadzorcy
## 15. Commity
```

---

## 4. ZASADY ROZSTRZYGANIA WĄTPLIWOŚCI

1. **STOP zamiast zgadywania — zawsze.** Jeżeli instrukcja czegoś nie
   przewidziała, a Ty musisz podjąć decyzję o kształcie produktu (brzmienie
   placeholderu metryczki, semantyka numeracji podpisów, szerokość okna limitów,
   dodatkowe pole kontraktu, migracja) — **zatrzymujesz pozycję, opisujesz
   w raporcie, idziesz do następnej.** Dyżur z uczciwym STOP-em jest odbierany;
   dyżur ze zgadniętym rozwiązaniem jest odrzucany i cofany.
2. **Kolejność źródeł prawdy:** (a) ten dokument → (b) `OWNER_DECISION_LEDGER_2026-08-24.md`
   → (c) `docs/ui-standards/00-foundation/BRAND_EXPORT_CANON.md` → (d) złoty plik
   → (e) kod w repo. **Sprzeczność między (d) a (e) rozstrzygasz na korzyść (e)
   i opisujesz** — złoty plik jest wzorcem wyglądu, nie wzorcem implementacji.
3. **★ Sprzeczność między tym dokumentem a Twoim pomiarem rozstrzygasz na
   korzyść POMIARU** i wpisujesz do „Korekt". Instrukcja została napisana
   pomiarem na markerze; jeśli świat się przesunął, prawdą jest świat. **To nie
   dotyczy zakazów §0.2 — te obowiązują niezależnie od pomiaru.**
4. **Uczciwy `CZĘŚCIOWO` > zawyżone `ZROBIONE`.** `DEC-2026-08-27-149` pochwalił
   dyżur, który dowiózł część zakresu i **napisał to wprost**.
5. **„Testy przeszły" ≠ „działa"** (CLAUDE.md, złota reguła 1). W tym dyżurze
   dodatkowo: **„XML się zgadza" ≠ „wygląda dobrze".** Ostatnim dowodem są oczy.
6. **Nie ratujesz wyniku zmianą warunków.** Nie włączasz flagi, nie podnosisz
   uprawnień, nie wyłączasz middleware, nie normalizujesz asercji „żeby przeszła",
   nie nadpisujesz snapshotów, nie instalujesz pakietu biurowego w `server/**`,
   nie wołasz modelu. Jeżeli pomiar wychodzi czerwony — **czerwony wynik jest
   wynikiem**.

---

## 5. BRIEF WYNIKOWY (to oddajesz nadzorcy — krótko, na końcu raportu)

```
DYŻUR 34 — PARYTET WIZUALNY SILNIKA DOKUMENTU DRD

Marker:            <SHA> — MARKER OK/BRAK
Gałąź:             codex/document-visual-day34-<data>
PG:                cx-day34-pg, port <PORT>, migracje <N>, posprzątane TAK/NIE
Migracje własne:   <ile> (spodziewane: 0) — numery z przedziału 20261230-39

★ NIEZMIENNOŚĆ:    schematy legacy <ile> (wymóg ≥3) · pliki XML 3/3 ·
                   SHA zgodne <ile>/<ile>  → SPEŁNIONE TAK/NIE
                   (NIE = dyżur odrzucony, niezależnie od reszty)

Pozycje:           N <status> · A <status> · B <status> · C <status> · D <status>
                   E <status> · F <status> · G <status> · H <status> · W <status>
                   R.1 <status>

Testy:             PRZED <P/F/S>  →  PO <P/F/S>   (nowe FAIL: <ile> — <jakie>)
Konsumenci renderera (§1.3): bez nowych FAIL TAK/NIE

DOWÓD KOŃCOWY:     .docx dla <org A> i <org B> — PRZEZ TRASĘ TAK/NIE
                   stron wyrenderowanych i OBEJRZANYCH: <ile> + <ile>
                   ścieżka: docs/.../evidence/document-visual-day34-20260828/

PARYTET (§W.4):    PARYTET <ile> · RÓŻNICA ŚWIADOMA <ile> · LUKA <ile> ·
                   NIEMIERZALNE <ile> (każde z opisem próby — §W.5)

LICZBY PO:         „+N more" <ile> (cel 0) · „Figure/Table " <ile> (cel 0) ·
                   sieroty <ile> (cel 0) · metryczka <ile>/9 ·
                   rusztowanie <ile> pkt (PRZED 117) ·
                   radar <px>/<dpi>/<proporcja> (cel ≥300 dpi, ~1,73) ·
                   stopka: poufność ×<ile> (cel 1), znak marki TAK/NIE ·
                   inline rFonts <ile> (cel 0)

LIMITY (§G):       pomiar wzorca: streszczenie <X> · wnioski <Y> · linia dec. <A>-<B>
                   okna: <...>  ·  contractVersion nietknięty TAK/NIE

Zero LLM:          TAK/NIE     Zero LibreOffice w server/** i scripts/**:  TAK/NIE
Zero zmian w src/: TAK/NIE     Zero nowych tras HTTP:                      TAK/NIE
Zero git stash:    TAK/NIE     Snapshoty dnia 32 nietknięte:               TAK/NIE

Zależność zewnętrzna: dane demo sesji oceny — <opis, do jakiego dyżuru należy>

STOP-y:            <lista albo „brak">
Niezweryfikowane:  <lista albo „brak">
Do decyzji nadzorcy: <lista albo „brak">
```

---

## 6. JEDNO ZDANIE NA KONIEC

Dyżur 32 udowodnił, że silnik **składa** dokument z danych; ten dyżur ma
udowodnić, że składa go **tak, żeby dało się go położyć na stole u klienta** —
a jedynym dowodem, który się liczy, jest **plik otwarty i obejrzany stronę po
stronie**, nie zielony test. **I ani jeden bajt nie może się przy tym zmienić
komukolwiek innemu — bo silnik jest współdzielony, a szóstka konsumentów nie
prosiła się o nowy wygląd.**
