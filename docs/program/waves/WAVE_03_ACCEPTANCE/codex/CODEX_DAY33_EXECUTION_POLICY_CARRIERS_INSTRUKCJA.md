# INSTRUKCJA DYŻURU nr 33 — Codex — „Realizacja: NOŚNIKI decyzji `E-O3` / `E-O4` / `E-O5` — perspektywa celu, waga wkładu, pasma wysycenia i piąta warstwa ładu danych — WYŁĄCZNIE MECHANIKA TYLNA"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–32. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-28.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

---

## ★ DLACZEGO TEN DYŻUR ISTNIEJE — jedno zdanie, potem dowody

**Właściciel podjął 28.08 trzy decyzje produktowe, których system fizycznie nie
umie przyjąć: nie ma kolumny na perspektywę celu, nikt nigdy nie wypełnił wagi
wkładu, a raport o wysyceniu mocy ludzi nie zna ani jednej nieobecności.**
Twoim zadaniem jest **zbudować NOŚNIKI** tych decyzji — miejsce w schemacie,
komendę, walidację i uczciwy odczyt — **nie** wpisać wartości do kodu.

Decyzja właściciela: `DEC-2026-08-28-169`
(`docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md:220`).
Werdykt dosłowny właściciela, zapisany w rejestrze:

> „Wybierz wszędzie twoje rekomendacje - pamiętaj nigdzie nie idziemy na skróty
> i rozwijamy wszystko i budujemy. Aplikacja musi już być gotowa."

Treść zamrożona, w skrócie roboczym (pełna w rejestrze, **czytasz ją sam**,
BLOK 0 pkt 3):

| Pytanie | Werdykt | Co z tego wynika dla Ciebie |
| --- | --- | --- |
| `E-O3` | **wariant C** — BSC cztery perspektywy (Finanse · Klient/Rynek · Procesy wewnętrzne · Ludzie/Kompetencje) **+ PIĄTA warstwa „Ład i jakość danych"**; etap przejściowy: bez przypisanych perspektyw ekran nazywa się **raportem operacyjnym** | `P.4` `P.5` `P.6` `P.7` |
| `E-O4` | **wariant B domyślnie** — skala 3-stopniowa przy inicjatywie (Krytyczna / Ważna / Wspierająca), zatwierdzana przez właściciela celu; **+ wariant C jako OPCJA** — wkład liczbowy z zamrożoną bazą (mechanika istnieje w `rvn_kpi_initiative_impacts`). Progi: **zagrożone = 7 dni**, **decyzja opóźniona = 5 dni roboczych** | `P.2` `P.3` `P.8` `P.9` |
| `E-O5` | **wariant C** — pasma **do 80 % / 80–95 % / > 95 %**, **bufor 15 %** mocy odjęty z góry, progi **edytowalne per klient** | `P.2` `P.3` `P.10` `P.11` |

**★★ NAJWAŻNIEJSZE ZDANIE CAŁEJ INSTRUKCJI.** Rejestr mówi o wartościach
liczbowych wprost:

> „WARTOŚCI LICZBOWE (7 dni / 5 dni roboczych / 80-95% / bufor 15%) to
> propozycja nadzorcy przyjęta przez właściciela, NIE znalezisko z repo
> (migracja polityki jawnie: »No default policy is seeded«)."

Czyli: **te liczby są WARTOŚCIAMI POCZĄTKOWYMI, które konsultant WPISUJE
w ekranie polityki — nie są seedem, nie są `DEFAULT` w migracji, nie są
`?? 7` w kodzie.** Twoim produktem jest **dowód, że da się je wpisać
i odczytać**, a nie ich obecność w diffie. Zaszycie choćby jednej z nich =
**odrzucenie pozycji** (`Z12`).

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

**Budujesz WYŁĄCZNIE mechanikę tylną. Front jest poza zakresem w CAŁOŚCI.
Nie robisz zrzutów. Nie włączasz żadnej flagi frontowej. Nie budujesz ekranu
polityki ani ekranu przypisania perspektyw** — te dwa ekrany zbuduje **osobny
dyżur frontowy, po prototypie zaakceptowanym przez właściciela**. Twoim
produktem dla frontu jest **kontrakt** (`P.12`), nie ekran.

1. **★ CAŁY KATALOG `src/` JEST POZA ZAKRESEM DO ZAPISU.** Wolno Ci go
   **czytać i grepować** (to jest **wymagane** — BLOK 0 pkt 9 i `Z21`), ale
   **nie zmieniasz w nim ani jednego znaku** — także „jednej linii importu",
   także po to, żeby „domknąć ostatnie ogniwo dowodu osiągalności". Jedyny
   wyjątek: **żaden**. Powód jest w `CLAUDE.md` regułą 7 i jest w tym projekcie
   **nienaruszalny**: Piotr nigdy nie jest pierwszym testerem wizualnym.
2. **★★ TEN DYŻUR MA TWARDY WARUNEK WSTĘPNY — DYŻUR 31 POZYCJA `B.7`.**
   Dyżur 31 (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY31_EXECUTION_BLOCK_B_INSTRUKCJA.md`,
   gałąź `codex/day31-instrukcja-20260828`) buduje **komendę zapisu polityki**
   do `execution_control_kpi_policies` — CAS na `row_version`, idempotencja,
   audyt w transakcji. **Ty tej komendy NIE budujesz drugi raz.** Jeżeli nie
   jest scalona na Twoim markerze — **STOP całego dyżuru** (BLOK 0 pkt 8).
   Szczegółowy rozdział zakresów: §1.9.
3. **★★ NIE ZASZYWASZ ŻADNEJ WARTOŚCI Z `DEC-169`.** Ani `7`, ani `5`, ani
   `0.8`, ani `0.95`, ani `0.15`, ani wag `Krytyczna/Ważna/Wspierająca`
   przełożonych na liczby. Wszystko to są **dane w tabeli polityki**, wpisywane
   przez konsultanta. Twój kod zna **nazwy parametrów i ich typy**, nigdy
   wartości.
4. **★★ PERSPEKTYWA MUSI BYĆ DEKLARACJĄ CZŁOWIEKA.** W repo istnieje
   heurystyka słów kluczowych `inferPerspective(kpi.name)`
   (`server/src/services/results/balancedScorecardService.ts:186-192`,
   fallback `'process'`). **Właściciel zakazał rozciągania jej na raport
   zarządczy** (`DEC-169`, dosłownie: „ZAKAZ rozciągania heurystyki
   inferPerspective(kpi.name) z balancedScorecardService na raport zarządczy —
   perspektywa MUSI być deklaracją człowieka"). Heurystyka może być **co
   najwyżej PODPOWIEDZIĄ przy przypisywaniu** (i to tylko jeśli zwrócisz ją
   w osobnym polu jawnie oznaczonym jako `INFERENCE`), **nigdy źródłem prawdy
   w odczycie raportu**. Naruszenie = **odrzucenie pozycji**, nie errata.
5. **★ NIE DOPISUJESZ FUNKCJI, KTÓRYCH NIKT NIE ZAMÓWIŁ.** Ten dyżur ma
   **jedenaście pozycji roboczych** + **jedną kontraktową** + **dwie
   dokumentacyjne** (§1.3). Wszystko inne idzie do „Znalezisk", nie do kodu.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **gałąź `codex/m03-admin-20260824`**, przypięta do
   commitu-markera podanego niżej.

   **SHA markera: a257168bb3**

   > **★ WARTOWNIK WIĄZANIA — RAMKA W BLOKU CYTOWANYM (nadzorca jej NIE
   > podmienia).** Nadzorca wiąże marker skryptem
   > `scripts/codex/bind-marker.sh <ten-plik> <sha>`, który celowo **pomija
   > linie zaczynające się od `>`** — dlatego cała ta ramka jest cytowana
   > i przetrwa wiązanie w nienaruszonej postaci.
   >
   > **Reguła dla Ciebie, wykonawco:** jeżeli w polu „SHA markera" **POWYŻEJ
   > tej ramki** (oraz w komendach §0.1 pkt 2) widzisz nadal literalne
   > `«MARKER_SHA»`, to znaczy, że **dokument NIE JEST ZWIĄZANY** — nadzorca
   > nie uruchomił skryptu. Wtedy: **STOP pierwszą komendą dyżuru**, zakładasz
   > raport, wpisujesz „instrukcja niezwiązana — brak SHA markera" i kończysz.
   > **Nie zgadujesz SHA. Nie bierzesz tipa gałęzi. Nie bierzesz SHA
   > z żadnego przykładu w żadnym innym dokumencie** — dzień 29 stracono
   > dokładnie tak: instrukcja miała SHA wpisany „na przykład", a wykonawca
   > zawiązał się do niego dosłownie.
   >
   > Wystąpienia `«MARKER_SHA»` **wewnątrz tej ramki** są opisem wartownika,
   > a nie polem do wypełnienia — ich obecność po wiązaniu jest **poprawna**
   > i **nie jest** powodem STOP-u. Liczy się wyłącznie pole operacyjne
   > powyżej i komendy w pkt 2.

2. **Sprawdzasz marker PIERWSZĄ komendą dyżuru:**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor a257168bb3 codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

   Wynik obu komend wklejasz do raportu **dosłownie**.

3. **Jeśli marker nie jest przodkiem tipa, gałąź nie istnieje, albo pole SHA
   nadal zawiera literalny placeholder — STOP.** Nie improwizuj bazy.
   Nie startuj z `origin/demo`, `main`, `Londyn`, `codex/preserve-*`,
   `codex/execution-batch-a-20260826`, `codex/finance-day30-20260827`,
   `codex/execution-day31-*`, `codex/document-engine-day32-*`,
   `codex/day29-finish-20260827`, `codex/assessment-*`, `codex/meetings-*`
   ani z żadnej gałęzi dni 17–32. Załóż raport, wpisz pozycję STOP z wynikiem
   obu komend i zakończ dyżur.

   **Reguła rozejścia (`DEC-2026-08-26-95`).** Jeżeli marker JEST przodkiem, ale
   tip uciekł do przodu (nadzorca scalił coś po związaniu markera) — **to nie
   jest STOP**. Startujesz **dokładnie z markera**, wypisujesz w raporcie
   `git log --oneline a257168bb3..codex/m03-admin-20260824` i listę plików
   rozejścia; scalenie z nowszym tipem wykonuje nadzorca przy odbiorze.
   **Rebase w trakcie dyżuru: ZAKAZANY.**

4. **★ Weryfikacja stanu wejściowego (warunek wstępny, NIE formalność).**
   Sprawdzasz sam; wynik jest **obowiązkową** pozycją raportu. Każda z tych
   komend ma w §1.2 podany oczekiwany wynik — **rozbieżność idzie do „Korekt
   wobec instrukcji", nie do improwizacji:**

   ```bash
   # (a) SEDNO CAŁEGO DYŻURU — nośnik polityki istnieje i ma row_version
   ls server/migrations/20261077_day17_execution_control_kpi_policy.sql        # oczekiwane: plik istnieje
   grep -n "row_version" server/migrations/20261077_day17_execution_control_kpi_policy.sql  # oczekiwane: 1 trafienie
   grep -n "No default policy is seeded" server/migrations/20261077_day17_execution_control_kpi_policy.sql  # oczekiwane: :1

   # (b) ★ WARUNEK WSTĘPNY — czy dyżur 31 B.7 (komenda zapisu polityki) JEST SCALONY
   grep -rn "execution_control_kpi_policies" server/src | wc -l
   #   1  → tylko ODCZYT (controlKpiReadModel.ts:35) → B.7 NIE JEST scalony → STOP (BLOK 0 pkt 8)
   #   >1 → jest pisarz → sprawdzasz jego kształt i idziesz dalej

   # (c) pięć wymaganych parametrów polityki
   grep -n "REQUIRED_POLICY_PARAMETERS" -A 8 server/src/services/executionControl/controlKpiReadModel.ts  # oczekiwane: :14-20, pięć nazw

   # (d) SEDNO POZYCJI P.4 — kolumny `perspective` NIE MA NIGDZIE
   grep -rniE '"perspective"|perspective (text|varchar)|add column .*perspective' server/migrations/*.sql | wc -l   # oczekiwane: 0

   # (e) SEDNO ZAKAZU nr 4 — heurystyka istnieje i ma fallback 'process'
   grep -n "inferPerspective" server/src/services/results/balancedScorecardService.ts     # oczekiwane: :186
   grep -n "return 'process';" server/src/services/results/balancedScorecardService.ts    # oczekiwane: :191 lub :192

   # (f) SEDNO POZYCJI P.8 — waga istnieje od baseline i NIKT jej nie wypełnia z UI
   grep -n "contribution_weight" server/migrations/20260719_baseline_gap.sql              # oczekiwane: :4648
   grep -rn "goalsLinkInitiative" src --include=*.tsx | wc -l                             # oczekiwane: 0 (zero komponentów woła)
   grep -n "organization_id" -A 2 -B 6 server/migrations/20260719_baseline_gap.sql | sed -n '1,1p' >/dev/null; \
     sed -n '4645,4652p' server/migrations/20260719_baseline_gap.sql                      # oczekiwane: BRAK kolumny organization_id

   # (g) SEDNO POZYCJI P.10 — wysycenie liczone z zaszytej stałej
   grep -n "weeklyHoursPerFte\|overloadRatio" server/src/services/capacityPolicy.ts       # oczekiwane: :2 i :3
   grep -rn "capacityBuffer" server/src | wc -l                                           # oczekiwane: 1 (tylko nazwa parametru w controlKpiReadModel.ts)

   # (h) SEDNO POZYCJI P.11 — czy istnieje JAKIEKOLWIEK źródło nieobecności
   grep -rn "user_out_of_office" server/src | wc -l                                       # oczekiwane: 0
   grep -n "vacation_end\|out_of_office" server/migrations/20260513_user_function_profile.sql  # oczekiwane: 2 trafienia

   # (i) numeracja migracji
   ls server/migrations | grep -E '^202612'                                               # oczekiwane: PUSTE
   ls server/migrations | grep -E '^2026[0-9]{4}_' | sort | tail -3                       # oczekiwane: ...20261121, 20261122, 20261123

   # (j) rejestr decyzji
   grep -c "DEC-2026-08-28-169" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md  # oczekiwane: >= 1
   ```

5. **Własna gałąź i własny worktree** (nigdy praca na `codex/m03-admin-20260824`):

   ```bash
   git branch codex/execution-policy-day33-<data> a257168bb3
   git worktree add /private/tmp/consultify-execution-policy-day33 codex/execution-policy-day33-<data>
   cd /private/tmp/consultify-execution-policy-day33
   ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules node_modules   # DEC-86, TYLKO ODCZYT
   ```

   **Katalog `/private/tmp/consultify-day33-instrukcja` istnieje i jest
   worktree, w którym powstał TEN dokument. NIE pracujesz w nim, nie kasujesz
   go, nie commitujesz do jego gałęzi.**

6. **★ KOMENDA BAZOWA — wszystkie porównania w raporcie robisz wobec markera**,
   nigdy wobec `HEAD~1`:

   ```bash
   git diff --name-only a257168bb3...HEAD
   ```

   Ta komenda ma w tym dokumencie własną nazwę — **„komenda bazowa"** — i wraca
   w §0.3, §0.4a i w szablonie raportu. Wynik wklejasz do raportu dosłownie.

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z27`

| # | Zakaz | Dlaczego |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/execution-policy-day33-<data>` | Push na `origin`/demo wykonuje wyłącznie nadzorca |
| `Z2` | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej gałęzi `codex/execution-*`, `codex/finance-*`, `codex/document-engine-*`, `codex/assessment-*`, `codex/meetings-*`, `codex/day2*`, `codex/day3*`, `fix/*` | `demo` = święta baza; tamte gałęzie to historia odebrana albo praca w toku |
| `Z3` | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4 powstał tak; `DEC-95` |
| `Z4` | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) | Wymagania są w rejestrze uwag i decyzjach |
| `Z5` | **★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-86` | Chroniony, brudny worktree właściciela |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` — część jest w aktywnym użyciu (m.in. `consultify-execution-day31`, `consultify-document-engine-day32`, `consultify-finance-day30`, `consultify-day33-instrukcja`) | Cudze worktree |
| `Z7` | **Nie zajmujesz portów sesyjnych.** W chwili wystawienia **NASŁUCHUJĄ**: `5432`, `5474` (`codex-tools-audit-pg-20260826`), `5511` (`cx-day30-pg`), `5521` (`cx-day32-pg`), `5554`, `5555`, `5556` (`cx-day31-pg`). Zarezerwowane przez wcześniejsze instrukcje i **ZAKAZANE**: `5474`, `5498`, `5499`, `5511`, `5512`, `5521`, `5533`, `5544`, `5556`, `5563`, `5566`, `5567`, `5571`, `5573`, `5575`, `5577`, `5581`, `5588`, `5589`, `5591`, `55291`, `55677`, `55941`, `59321`. **★ Twój kontener PG = `5597`.** Port zajęty → bierzesz pierwszy wolny **powyżej 5597** (i spoza listy zakazanych) i wpisujesz go do raportu | Cztery cudze dyżury pracują równolegle |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (`DEC-65`) | Produkcja/demo poza zakresem |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo/staging/produkcja, nigdy cudza retained-DB, nigdy żadna baza `consultify_w3_*` (są dowodem odbiorowym, nie piaskownicą). **KOREKTA `DEC-2026-08-26-98`: `Z9` przerywa DANĄ CZYNNOŚĆ, nie cały dyżur** — patrz ramka pod tabelą | „dane demo = twarz produktu"; tamte bazy są dowodem |
| `Z10` | **★★ Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, gdziekolwiek. `ENABLE_V8_GLOBAL=true` żyje wyłącznie w linii komendy Twojego testu | `CLAUDE.md` reguła 9 |
| `Z11` | **★★ Nie zdejmujesz i nie poluzowujesz `requireCanonicalExecutionWriter`.** Nie dopisujesz nic do `GOVERNED_EXECUTION_CONTROL_COMMANDS` w `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts`. Naruszenie = **odrzucenie dyżuru**, nie STOP | `AMD-EXE-SPINE-AUTHORITY-004`: DOKŁADNIE JEDEN writer pracy wykonawczej |
| `Z12` | **★★ NIE ZASZYWASZ ŻADNEJ WARTOŚCI Z `DEC-169`.** Żadnego `7`, `5`, `0.8`, `0.95`, `0.15`, żadnej mapy `{ CRITICAL: 3, IMPORTANT: 2, SUPPORTING: 1 }`, żadnego `?? `, żadnego `DEFAULT` w migracji dla parametru polityki. Wartość zależna od decyzji właściciela jest **danymi w tabeli**, nigdy stałą | Migracja polityki mówi wprost „No default policy is seeded"; zaszyta liczba staje się produktem po cichu |
| `Z13` | **★★ NIE ROZCIĄGASZ `inferPerspective` NA RAPORT ZARZĄDCZY.** Perspektywa w odczycie raportu pochodzi **wyłącznie** z deklaracji człowieka. Cel bez przypisanej perspektywy zwraca `UNASSIGNED`, nigdy zgadniętą wartość, nigdy `'process'` z fallbacku | Zakaz właściciela w `DEC-169`; fallback `'process'` produkuje raport strategiczny z fikcyjną taksonomią |
| `Z14` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/EXECUTION_POLICY_DAY33_REPORT_20260828.md`. Jedyny inny dokument, który wolno zmienić, to `modules/06_EXECUTION/MODULE_ACCEPTANCE.md` — wyłącznie w ramach `R.1` | Repo tonie w dokumentach-duchach |
| `Z15` | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie. Uważasz, że decyzja się myli → **errata w raporcie**, nie patch w rejestrze | Rejestr jest `FINAL / IRREVOCABLE` |
| `Z16` | **Nie budujesz generowania treści modelem i nie podpinasz dostawcy LLM.** Zero nowych wywołań `llmService`, zero `/api/ai/**`, zero kolejki. „Podpowiedź perspektywy" **nie jest** wywołaniem AI — to co najwyżej istniejąca funkcja czysta, oznaczona jako `INFERENCE` | Silnik AI = osobny moduł, ostatni w programie; `DEC-51` |
| `Z17` | **★★ Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych / `null` / `UNKNOWN` / `DECISION_REQUIRED` / `BRAK_ŹRÓDŁA` / `UNASSIGNED` / `Degraded`.** Rodzina miary bez polityki **zostaje** `DECISION_REQUIRED`. Rodzina `capacity` bez źródła nieobecności **zostaje** `UNKNOWN` z powodem — **nigdy ładny procent** | Uczciwy pusty stan > udawany wynik; `UNKNOWN ≠ 0`; wprost w `DEC-169` |
| `Z18` | **★★ NIETYKALNE — `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts`, `server/src/services/effectiveAccessService.ts`, `frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts`, `PermissionsService`, `server/src/middleware/v8FeatureGate.middleware.ts`, `server/src/services/v8/featureFlagService.ts`, `server/src/services/legacyCutover/requireActiveMembership.ts`, `server/src/middleware/effectiveCapability.middleware.ts`, `server/src/controllers/ExecutionController.ts`.** Wolno **czytać** i **wołać** | Model uprawnień i bramki naprawiane in-house |
| `Z19` | **★ Zakaz wszystkiego poza zakresem z ramki §0.2b** — cały front (`src/**` do zapisu), powłoka SPEC-A, kanon triady, cudze moduły | „jeden moduł na raz"; podział FRONT/TYŁ (§1.6) |
| `Z20` | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config*.ts` ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru** | Dyżur nr 2 wywalił tak 27 cudzych testów |
| `Z21` | **★ DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`) — patrz ramka pod tabelą | `DEC-104` powstał po tym, jak DoD przepuścił martwy kod jako gotowy |
| `Z22` | **★ Test wstrzykujący zależności NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`). W tym module pułapka jest ostra: router runtime-v1 to fabryka `createInitiativesExecutionRuntimeRouter(deps)` (`initiativesExecutionRuntime.routes.ts:1178`) z domyślną instancją zależności niżej — **test montuje `export default`**, nie fabrykę z własnym `deps` | Dzień 18: 8/8 zielonych, warstwa martwa |
| `Z23` | **★ Zakaz atrapy z zewnętrznym skutkiem** (`DEC-2026-08-26-108`) — **sukces w odpowiedzi + brak zmiany w bazie = ODRZUCENIE pozycji**. Zmianę w bazie dowodzisz osobnym `SELECT` przed i po, **niezależnym poolem** | Idempotencja „udawana w handlerze" jest gorsza niż jej brak |
| `Z24` | **★ Pomiar testów BEZ ZAWĘŻANIA** (`DEC-2026-08-26-108`) — wynik z **PEŁNEGO zakresu §0.4a**, z rozbiciem **ZASTANE / WPROWADZONE** i liczbą **SKIPPED**. **`SKIPPED` to nie `PASS`** | Pg-testy tego modułu mają `describe.skipIf` — łatwo zawyżyć |
| **`Z25`** | **★★ NOWY — testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL` wskazującym Twój efemeryczny kontener.** `tests/setup.ts:386-388` ma fallback: przy braku `DATABASE_URL` ustawia `postgresql://iris:iris_test@localhost:5432/iris_test`. **Port 5432 NASŁUCHUJE na tej maszynie** (BLOK 0 pkt 6) i **nie jest Twój**. Uruchomienie testu DB bez `DATABASE_URL` w tej samej linii komendy = połączenie do **cudzej bazy** | Bez tego mierzysz — albo brudzisz — nie swoją bazę |
| **`Z26`** | **★★ NOWY — OBOWIĄZKOWO `RUN_DB_TESTS=1 MOCK_DB=false` w tej samej linii.** `tests/setup.ts:382` robi `process.env.MOCK_DB = process.env.MOCK_DB \|\| 'true'` — **brak jawnego `MOCK_DB=false` USTAWIA `MOCK_DB='true'`**, a `server/src/database/Database.ts` przy `MOCK_DB === 'true'` podstawia **atrapę DB bezwarunkowo**. Skutek: Twój odczyt polityki/perspektywy idzie **cicho na atrapę** i zwraca **mylące fałszywe `404` / pustkę**, którą łatwo wziąć za „uczciwy pusty stan". Dodatkowo globalny mock `auth.middleware` przy `MOCK_DB !== 'false'` wstrzykuje `role: 'owner', isSuperAdmin: true` — czyli **każdy Twój pomiar izolacji tenanta jest wtedy fikcją** | Fałszywy `404` z atrapy jest nieodróżnialny od uczciwego braku danych |
| **`Z27`** | **★★ NOWY — ZAKAZ `git stash` do dowodów mutacyjnych.** `git stash` jest **współdzielony między wszystkimi worktree tego repozytorium** — w chwili wystawienia żyją co najmniej cztery równoległe dyżury. `stash push` z Twojego worktree zabiera zmiany, a `stash pop` z cudzego może je wciągnąć do cudzej gałęzi. **Gdy potrzebujesz porównać „przed / po" na plikach — używasz KOPII (`cp plik plik.przed`), nigdy stasha.** Kopie robocze kasujesz przed commitem i wypisujesz w raporcie, że ich nie zacommitowałeś | Stash to jedyny stan gita naprawdę globalny dla worktree — cicha kradzież cudzej pracy |

**★ `Z9` — procedura po korekcie `DEC-2026-08-26-98` (nie zabijaj dyżuru).**
Jeżeli złapiesz się na komendzie DB bez przypiętego env: **zatrzymaj tę komendę →
ustal skutek (czy w ogóle doszło do połączenia i czy był ZAPIS) → zapisz
ustalenie w raporcie → przypnij env → KONTYNUUJ pozycję.** Twardy STOP całego
dyżuru **wyłącznie** przy stwierdzonym realnym **zapisie** do bazy spoza dyżuru.

**★★ `Z25` + `Z26` — pięć zmiennych w tej samej linii, i dlaczego to nie jest
biurokracja.**

```bash
DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5597/cx_day33" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
npx vitest run --config server/vitest.config.ts <plik> --no-file-parallelism
```

- **bez `DATABASE_URL`** → `tests/setup.ts:387` celuje w `localhost:5432/iris_test`,
  a `5432` **nasłuchuje** i nie jest Twój (`Z25`);
- **bez `MOCK_DB=false`** → `tests/setup.ts:382` ustawia `'true'`, `Database.ts`
  podstawia atrapę, odczyty wracają puste/`404`, a globalny mock auth robi
  z anonima `owner`+`isSuperAdmin` (`Z26`);
- **bez `RUN_DB_TESTS=1`** → część pakietów pg tego repo pomija się cicho
  i zaraportujesz `PASS` na zerze uruchomionych asercji (`Z24`).

Każdy przebieg poprzedzasz **dowodem celu połączenia**:

```bash
docker exec cx-day33-pg psql -U postgres -d cx_day33 -c "SELECT current_database(), inet_server_port();"
```

Wynik (**dosłowny**) jest obowiązkową pozycją raportu.
**`inet_server_port()` przez `docker exec psql` zwraca `NULL`**, bo idzie
socketem w kontenerze — to poprawne. Dowodem mapowania na host jest
`-p 5597:5432` w komendzie `docker run`, którą też wklejasz. Nie „naprawiaj" tego.

**★ `Z21` — jak wygląda dowód osiągalności.** Nie wystarczy „funkcja istnieje
i ma test jednostkowy". Dla **każdej** pozycji podajesz w raporcie **ścieżkę
wywołania od realnego wejścia**:

```
realne wejście (metoda + URL, jaki wychodzi z klienta HTTP)
  → montaż (Gateway.ts:<linia> → <router>:<linia>)
  → bramki (gatewayVerifyToken → trialEntryGuard → verifyToken → validateOrgMembership
            → requireOrgAccess → authorize/effectiveCapability)
  → handler trasy (plik:linia)
  → komenda/serwis domenowy (plik:linia)
  → zapis do tabeli (nazwa tabeli, kolumna)
  → ODCZYT, który ten wiersz podnosi (plik:linia)
  → konsument w `src/` (plik:linia) ALBO jawne „brak konsumenta w src/"
```

**Ostatnie dwa wiersze są obowiązkowe.** Zapis, którego żaden odczyt nie
podnosi, jest z punktu widzenia produktu niewidoczny: pozycja `CZĘŚCIOWO`, nie
`ZROBIONE_WG_DoD`. **Nie wolno Ci** dopisać konsumenta frontowego, żeby ogniwo
„domknąć" (`Z19`), i **nie wolno Ci** przemilczeć jego braku. Dla tego dyżuru
**ostatnim ogniwem będzie w większości pozycji koperta HTTP** — ekrany polityki
i przypisania perspektyw powstaną w osobnym dyżurze frontowym. **Piszesz to
wprost.**

### 0.2b. Zasięg `Z19` — granica jest ostra

```
WOLNO (Twój zakres):
  server/src/services/executionControl/controlKpiPolicySchema.ts    (NOWY PLIK — serce P.2; schemat i walidacja parametrów)
  server/src/services/executionControl/controlKpiReadModel.ts       (P.2, P.6, P.7, P.10 — ADDYTYWNIE)
  server/src/services/executionControl/**                           (NOWE pliki czytników: piąta warstwa, klasa raportu, pasma)
  server/src/routes/pmo/initiativesExecutionRuntime.routes.ts       (P.5, P.6, P.7, P.8, P.9, P.10 — ADDYTYWNIE, wyłącznie nowe trasy i pola)
  server/src/domain/initiatives-execution/**                        (P.5 — komenda przypisania perspektywy, wzorcem materialCommand)
  server/migrations/2026122<x>_execution_day33_*.sql                 (NOWE pliki — przedział 20261220-20261229; patrz §0.3)
  server/src/services/executionControl/__tests__/day33.*.test.ts    (NOWE pliki)
  server/src/routes/pmo/__tests__/day33.*.pg.test.ts                (NOWE pliki)
  server/src/domain/initiatives-execution/__tests__/day33.*.test.ts (NOWE pliki)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md   (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/EXECUTION_POLICY_DAY33_REPORT_20260828.md   (jedyny nowy dokument)

★ WĄSKA LICENCJA MIĘDZYMODUŁOWA — WYŁĄCZNIE pozycja P.8, wyłącznie w opisanym tam zakresie:
  server/src/services/initiativeGovernanceService.ts                (metody linkGoalToInitiative / getGoalInitiatives / getGoalRollup — ADDYTYWNIE)
  server/src/routes/initiative-governance.routes.ts                 (schemat wejścia POST /goals/:goalId/initiatives — ADDYTYWNIE)
  ⇒ każda zmiana w tych dwóch plikach MUSI być wymieniona w raporcie z osobna,
     z jednozdaniowym uzasadnieniem i dowodem, że istniejący test-strażnik
     server/src/routes/__tests__/initiative-governance-goal-rollup-tenant.routes.test.ts
     nadal przechodzi. Wyjście poza te trzy metody i jeden schemat = STOP.

IMIENNE LICENCJE (wolno CZYTAĆ i WOŁAĆ istniejące, NIE zmieniać ich kodu):
  server/src/domain/initiatives-execution/materialCommand.ts        (WZORZEC koperty komendy — CAS, idempotencja, audyt; ZMIANA = STOP)
  server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts (WOŁASZ; ZMIANA = STOP)
  server/src/domain/initiatives-execution/capacityScenario.ts       (CZYTASZ `KnowledgeState`/`CapacityRange` jako ZASTANY nośnik „nie wiem"; ZMIANA = STOP)
  server/src/services/results/balancedScorecardService.ts           (CZYTASZ nazwy czterech perspektyw; ZMIANA = STOP, Z13)
  server/src/services/results/resultsStrategicViewService.ts        (CZYTASZ jako dowód, gdzie heurystyka DZIŚ działa; ZMIANA = STOP)
  server/src/services/capacityPolicy.ts                             (CZYTASZ zaszyte stałe jako ZNALEZISKO; ZMIANA = STOP — patrz P.10 pkt 6)
  server/src/controllers/CapacityController.ts                      (CZYTASZ jako dowód, czego dziś NIE liczy; ZMIANA = STOP)
  server/migrations/20260813_rvn_kpi_initiative_impacts.sql         (CZYTASZ kształt wariantu C E-O4; ZMIANA = ODRZUCENIE)
  wzorce testów —
    server/src/services/__tests__/initiativeRuntimeExecutionSeam.pg.test.ts       (realny PG + seam)
    server/src/services/__tests__/executionActionRegistryService.pg.test.ts       (sprzątanie po sobie)
    server/src/routes/__tests__/initiative-governance-goal-rollup-tenant.routes.test.ts (strażnik izolacji goal_initiative_links)

NIE WOLNO:
  ★★ CAŁE src/** DO ZAPISU (odczyt i grep — TAK, wręcz wymagane)   ← podział FRONT/TYŁ; zero wyjątków
  ★★ server/src/middleware/executionSpineLegacyReadOnly.middleware.ts  ← ZMIANA = ODRZUCENIE DYŻURU (Z11)
  ★  server/src/Gateway.ts                                          ← montaż = zakres nadzorcy
  ★  server/src/routes/v8/index.ts                                  ← jw.
  ★  server/src/routes/pmo/initiatives.routes.ts                    ← montaż runtime-v1; zmiana = STOP
     server/src/services/results/**                                 ← ★ CUDZY MODUŁ (Results). Wariant C E-O4 CZYTASZ, nie budujesz (P.9)
     server/src/services/results/kpiScorecardService.ts             ← jw.; zmiana = STOP
     server/src/routes/resultsStrategic.routes.ts                   ← jw.
     server/src/routes/v8/finance-v2/**                             ← ★ KOLIZJA: dyżur 30 (§1.9)
     server/src/services/documentStudio/**                          ← ★ KOLIZJA: dyżur 32 (§1.9)
     server/src/services/assessment/**  ·  server/src/routes/assessment/**  ← ★ KOLIZJA: dyżur 32 (§1.9)
     tests/unit/backend/**  ·  tests/acceptance/**  ·  tests/e2e/**  ← cudzy tor odbiorowy (MIERZYSZ, nie zmieniasz)
     wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie
jest** praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie,
idziesz dalej. Wyjątku nie ma nawet dla „jednej linii importu".

### 0.3. Higiena wykonania

- **★ COMMIT PER POZYCJA — TWARDO.** Jedenaście pozycji roboczych + kontraktowa
  = minimum dwanaście commitów (plus dwa dokumentacyjne). Wrzucenie kilku
  pozycji do jednego commita jest **samodzielnym powodem, dla którego pozycja
  nie dostanie `ZROBIONE_WG_DoD`** (tak zginął dzień 24). Conventional commits:

  ```
  docs(execution): settle which store carries the control-KPI policy (P.1)
  feat(execution): declare and validate the five control-KPI policy parameters (P.2)
  test(execution): prove the DEC-169 starting values can be entered and read back (P.3)
  feat(execution): add a declared BSC perspective to organizational goals (P.4)
  feat(execution): let a human assign a goal to a perspective, with audit and CAS (P.5)
  feat(execution): compute the governance and data-quality layer of the report (P.6)
  feat(execution): derive the operational-vs-strategic report class from real coverage (P.7)
  feat(execution): carry the three-step contribution class into the goal-initiative link (P.8)
  feat(execution): expose the numeric contribution option as a read-only contract (P.9)
  feat(execution): return an honest unknown for capacity saturation until absences exist (P.10)
  docs(execution): inventory what real availability would require (P.11)
  docs(execution): publish the front-end contract for policy and perspective screens (P.12)
  docs(execution): raise 06_EXECUTION acceptance to the delivered scope (R.1)
  docs(execution): day 33 duty report (R.2)
  ```

- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita:
  `npx prettier --write <pliki>`. W repo **nie ma** skryptu `format` — wołasz
  `npx prettier` wprost.
  **★ UWAGA — `initiativesExecutionRuntime.routes.ts` ma blisko 6000 linii.**
  Reformat całego pliku wygeneruje diff, którego odbiorca nie przejrzy.
  **Reguła: jeżeli wynik reformatu przekracza ~3× liczbę Twoich linii
  merytorycznych — cofasz reformat, zostawiasz styl zastany i wpisujesz to do
  raportu.**
- **Typy punktowo** — `npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null`.
  **NIGDY pełny `tsc -p` repo, NIGDY pełny `vitest` repo.**
  **★ `esbuild` TRANSPILUJE, nie typuje** — każda zmiana kontraktu ma test
  behawioralny, który złapie to, czego esbuild nie widzi.
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `toContain('...')`, **nie liczy się do DoD** (`Z22`).
- **NOWE pliki w `tests/` wymagają `git add -f`.** W tym dyżurze **wszystkie
  nowe testy kładziesz obok kodu** w `server/src/**/__tests__/` — to zastana
  konwencja modułu i nie wymaga `-f`.
- **★ URUCHAMIANIE TESTÓW.** `server/vitest.config.ts` wymaga uruchomienia
  **z cwd `server`** albo jawnego `--config server/vitest.config.ts` z filtrem
  `server/...`. Uruchomienie z roota z filtrem `server/src/...` bez `--config`
  zwraca `No test files found` — a to **nie jest** `PASS` ani `SKIP`, tylko
  `NIE_ZMIERZONE`.
- **★ MIGRACJE — reguły twarde.**
  1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
     `INSERT ... ON CONFLICT DO NOTHING`. **Zakaz** `DROP`,
     `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`, **bezwarunkowego `UPDATE`**.
     Jedyny dopuszczony `UPDATE` w tym dyżurze to backfill z `P.8` — **zawsze
     z klauzulą `WHERE <kolumna> IS NULL`** i zawsze wyprowadzony z JOIN-a,
     nigdy ze stałej.
  2. **★★ NUMERACJA — DZIEŃ 33 MA PRZYDZIELONY PRZEDZIAŁ `20261220`–`20261229`.**
     Reguła „najwyższy + 1" obowiązuje **TYLKO WEWNĄTRZ tego przedziału**.
     Numery spoza przedziału są **ZAKAZANE, nawet jeśli `ls` pokazuje je jako
     wolne**: `20261124`–`20261219` to pule dni 22–32 i prac wewnętrznych,
     **część jeszcze nie scalona**, więc `ls` ich u Ciebie nie pokaże — to nie
     znaczy, że są wolne. (Najwyższy widoczny na markerze to `20261123`;
     **nie** bierz `20261124`. Dzień 30 ma `20261190`–`20261199`, dzień 31 —
     `20261200`–`20261209`, dzień 32 — `20261210`–`20261219`.)

     **Obowiązkowy `ls | grep` PRZED KAŻDYM plikiem:**

     ```bash
     ls server/migrations | grep -E '^2026[0-9]{4}_' | sort | tail -5   # co widać jako zajęte
     ls server/migrations | grep '^202612'                              # MUSI być PUSTE przed utworzeniem pliku
     ```

     Nazwa: `<numer>_execution_day33_<temat>.sql`. `migrate.postgres.ts`
     stosuje migracje w porządku **fazowym, wewnątrz fazy po dacie/numerze**
     (`server/scripts/migrate.postgres.ts:227-243`), więc kolizja numeru to
     cicha katastrofa.
  3. **★★ SPODZIEWANE SĄ DOKŁADNIE DWIE MIGRACJE**, obie w `P.4` i `P.8`.
     Sprawdziłem to za Ciebie: `execution_control_kpi_policies` **istnieje**
     i ma `parameters JSONB` oraz `row_version` — **nie tworzysz drugiej tabeli
     polityk i nie dokładasz kolumn na parametry**; parametry mieszkają
     w `parameters`. **Migracja bez udowodnionego braku obiektu na świeżej
     bazie = pozycja odrzucona.** Dowód `\d <tabela>` z Twojego kontenera idzie
     do raportu **przed** plikiem migracji.
  4. **★ ZERO nowych kluczy obcych do tabel spoza modułu.** Rodzina `ie_*` nie
     ma dziś ani jednego FK do `users`/`organizations` — **utrzymujesz tę
     konwencję**. Dla `goals` i `goal_initiative_links` (tabele baseline, klucze
     `TEXT`) **też nie dodajesz FK**.
  5. **`MIGRATION_PREPARED`** — migracja jest przygotowana i udowodniona
     lokalnie, **nigdy** uruchomiona zdalnie (`REMOTE_EXECUTION_NOT_AUTHORIZED`).
- **★ Dane demo = twarz produktu.** Wszystko, co zapisujesz, zapisujesz do
  **swojego jednorazowego kontenera**. Twoje testy sprzątają po sobie
  w dokładnym zasięgu swojej organizacji, przed usunięciem organizacji —
  wzorzec: `server/src/services/__tests__/executionActionRegistryService.pg.test.ts`.
  Ten moduł ma udokumentowaną historię brudzenia (`EXE-PF-002`,
  `MODULE_ACCEPTANCE.md:96`).
- **★ SPRZĄTANIE KONTENERA — `docker rm -fv`, NIGDY `docker volume prune`.**

  ```bash
  docker rm -fv cx-day33-pg
  docker volume ls | grep -i day33 || echo "brak wolumenów dyżuru — OK"
  ```

  **`docker volume prune` jest ZAKAZANE bezwzględnie** — kasuje wolumeny
  czterech równolegle pracujących dyżurów. Dowód pustki wklejasz do raportu.

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

Pozycja jest zrobiona, gdy spełnia **wszystkie dwanaście**:

1. **Realne dane** — odczyt i zapis idą do backendu. Zero mocków jako źródła
   prawdy. Pusty wynik = uczciwy pusty stan; nieznane = `UNKNOWN` /
   `DECISION_REQUIRED` / `UNASSIGNED` **z powodem**, **nigdy zmyślona wartość**.
2. **Zapis z readbackiem** — po komendzie zapisującej test ponownie odczytuje
   stan z bazy **niezależnym połączeniem** (osobny `pg.Pool`), nie z koperty
   odpowiedzi.
3. **Zero atrap, a w szczególności zero atrap z zewnętrznym skutkiem** (`Z23`).
   Brak API → wpis `BRAK_API`. Brak danych → `BRAK_DANYCH`. Brak decyzji
   właściciela → `DECISION_REQUIRED` **z nazwą pytania**.
4. **Minimum 4 testy zachowania** (happy · błąd 4xx/5xx · uczciwy pusty stan ·
   **negatyw tenanta**), behawioralne. Pozycje `P.2`, `P.3`, `P.5`, `P.6`,
   `P.8` i `P.10` mają **wyższe minima** podane we własnych paragrafach.
5. **★ Test HTTP realnego routera** przez `supertest` na **realnym PG**,
   montujący **domyślny eksport** routera runtime-v1 (nie fabrykę z własnym
   `deps` — `Z22`).
6. **★ DOWÓD OSIĄGALNOŚCI** (`Z21`) — pełna ścieżka od realnego wejścia do
   zapisu, do odczytu, który ten wiersz podnosi, **i do konsumenta w `src/`
   albo jawnego „brak konsumenta"**.
7. **★ TEST DOMYŚLNEGO OKABLOWANIA** (`Z22`) — realny router, realne bramki,
   realne serwisy, realne mapowanie błędów; mockowanie ograniczone do
   `auth.middleware.js` i `Logger.js`. **Każdy inny mock wymaga wpisu
   w raporcie z uzasadnieniem.**
8. **Kontrole negatywne tenanta** — obcy `organizationId` nigdy nie dostaje
   `200`; `organizationId` **wyłącznie z tokenu/kontekstu**, nigdy z body/query.
   Test wysyła obcą organizację **w body ORAZ w nagłówku kontekstu org** bez
   aktywnego członkostwa i dostaje `404` (fail-closed), **nigdy `403` z danymi
   obiektu, nigdy `200`**. **W tym dyżurze ta klasa jest krytyczna**: `P.8`
   dotyka tabeli, która **nie ma `organization_id`** (znany kształt wycieku
   `RES-10`).
9. **★ Kontrola negatywna roli/zdolności** — żądanie bez wymaganej zdolności
   jest ODRZUCONE **i nie zostawia śladu mutacji** (dowodzisz liczbą wierszy
   przed i po) **oraz nie zostawia zdarzenia audytu**.
10. **Realny PG w jednorazowym Dockerze** (port **5597**, obraz
    **`pgvector/pgvector:pg16`** — `postgres:15` **NIE przechodzi migracji**,
    brak rozszerzenia `vector`) z pełnymi migracjami, z dowodem celu połączenia
    (`Z25`/`Z26`), ze sprzątnięciem kontenera **i wolumenów** (`docker rm -fv`).
11. **Plik przez `prettier`** przed commitem.
12. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód osiągalności →
    dowód testowy`.

> Punkty „zrzut light+dark" i „i18n napisów UI" **nie obowiązują** w tym
> dyżurze — front jest poza zakresem w całości (§1.6). Klucze i18n tworzysz
> **wyłącznie** dla napisów, które faktycznie wychodzą z Twojego API, i wtedy
> **parytet PL+EN obowiązuje w tym samym commicie**.
>
> **★ Uwaga na zastaną niespójność:** `controlKpiReadModel.ts:59` zwraca
> `valueReason: 'BRAK_ŹRÓDŁA'` — **polski string zaszyty w kodzie serwera**,
> obok angielskiego `'DECISION_REQUIRED'`. **Nie łamiesz tej konwencji po
> cichu**: jeśli dokładasz nowe wartości `valueReason`, trzymasz kształt
> zastany i **zgłaszasz rozjazd w „Znaleziskach"**. Zmiana istniejącej wartości
> = zmiana kontraktu dla frontu, czyli **STOP**.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu (`Z24`)

**Ten paragraf definiuje PEŁNY zakres pomiaru. Raport podaje wynik z CAŁEGO
tego zakresu. Podanie zawężonego wyboru = naruszenie `Z24`.**

1. Wypisz wszystkie dotknięte pliki **komendą bazową** (§0.1 pkt 6).
2. Wyodrębnij **współdzielone** — importuje je ktoś spoza Twojego zakresu:
   `server/src/services/executionControl/controlKpiReadModel.ts`,
   `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`,
   `server/src/domain/initiatives-execution/**`,
   `server/src/services/initiativeGovernanceService.ts`,
   `server/src/routes/initiative-governance.routes.ts`.
3. Dla **każdego** współdzielonego pliku uruchom **wszystkie** pakiety, które go
   importują — nie tylko własne. Znajdziesz je grepem po nazwie modułu.
4. Uruchom **cały** katalog `server/src/services/executionControl/__tests__/`,
   `server/src/routes/pmo/__tests__/` i `server/src/routes/__tests__/`
   (ten ostatni zawiera strażnika izolacji z `P.8`).
5. Uruchom **cały** `tests/unit/results/` — tam żyją testy
   `balancedScorecardService` i `resultsStrategicViewService`, które **muszą
   pozostać zielone i nietknięte** (`Z13`: nie zmieniasz heurystyki, tylko
   zakazujesz jej użycia w nowym odczycie).
6. Wynik podajesz **z rozbiciem**: `ZASTANE czerwone` (na markerze, PRZED
   pierwszym commitem — **mierzysz to w BLOKU 0**) / `WPROWADZONE czerwone`
   (z SHA commitu, który je zapalił) / `SKIPPED` (z podziałem na przyczynę).
7. **Jeżeli osłabiłeś albo usunąłeś jakikolwiek blok `describe`/`it`** —
   wypisujesz przed/po. Usunięcie testu, żeby zazielenić pakiet, jest
   **naruszeniem**, nie optymalizacją.
8. **Jawne zdanie w raporcie:** „nie przepisałem żadnej liczby z cudzego
   raportu — zmierzyłem sam".

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**
Zatrzymujesz się w szczególności, gdy musiałbyś:

- **zbudować drugi raz komendę zapisu polityki z dyżuru 31 `B.7`** — to jest
  STOP z odesłaniem do §1.9, nie Twoja praca;
- **zaszyć jakąkolwiek wartość z `DEC-169`** — `7`, `5`, `0.8`, `0.95`, `0.15`,
  mapę wag skali 3-stopniowej. STOP z propozycją **parametru**, nigdy commit ze
  stałą (`Z12`);
- **użyć `inferPerspective` (albo własnej heurystyki słów) jako źródła
  perspektywy w odczycie raportu** — to jest **odrzucenie pozycji**, nie STOP
  (`Z13`);
- **zwrócić procent wysycenia mocy, nie mając źródła nieobecności** — STOP;
  uczciwe `UNKNOWN` z powodem jest **produktem tego dyżuru**, nie porażką
  (`Z17`, `DEC-169`);
- wejść we `src/**` z zapisem (`Z19`) — także po to, żeby „tylko pokazać nowe
  pole na ekranie, skoro backend już działa";
- dotknąć `Gateway.ts`, `routes/v8/index.ts`, `routes/pmo/initiatives.routes.ts`
  — STOP z rekomendacją, nie Twoja zmiana;
- dotknąć czegokolwiek w `server/src/services/results/**` — to **cudzy moduł**;
  wariant C `E-O4` **czytasz**, nie budujesz (`P.9`);
- **zmienić kształt `goal_initiative_links` inaczej niż addytywnie**, albo
  ustawić `NOT NULL` na świeżo dodanej kolumnie w tym samym dyżurze — STOP
  (`P.8` pkt 6);
- poluzować `requireCanonicalExecutionWriter` albo dopisać cokolwiek do
  `GOVERNED_EXECUTION_CONTROL_COMMANDS` — to jest **odrzucenie dyżuru**;
- dodać `expectedVersion`, którego komenda nie potrafi sprawdzić w tej samej
  transakcji — to jest **atrapa** (`Z23`), nie postęp;
- zapisać zdarzenie audytu **poza transakcją mutacji** — STOP, nie „na razie
  tak, poprawi się później";
- dodać migrację nieaddytywną, z kluczem obcym poza modułem, albo z numerem
  **spoza przedziału `20261220`–`20261229`**;
- test nie przechodzi i naprawa wymaga zmiany GLOBALNEGO mocka/configu vitest
  (`Z20`) — STOP zawsze, bez „addytywnie, więc nic nie zepsuje";
- użyć `git stash` do czegokolwiek (`Z27`) — STOP; robisz kopię `cp`.

**Zakaz obchodzenia hooka pre-commit (`--no-verify`) — to jest zakaz, nie
STOP:** naprawiasz kod, nie omijasz strażnika.

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

Moduł Realizacja dostał 26.08 od panelu eksperckiego **3,6/10 — najniższy wynik
całego programu** (`DEC-2026-08-26-120`). Partia A i dyżur 31 zamknęły warstwę
zapisu i uczciwości pustych stanów. Pozostał **jeden, konkretny dług**: raport
zarządczy modułu (`EXE-OWN-006`, `EXE-OWN-007`) wymaga trzech rzeczy, których
właściciel nie zdążył rozstrzygnąć — taksonomii BSC, wagi wpływu i progów
wysycenia. **28.08 rozstrzygnął wszystkie trzy** (`DEC-169`) i dołożył
dyrektywę: budujemy także brakującą infrastrukturę.

Sedno, dosłownie z rejestru:

> „budujemy TAKŻE brakującą infrastrukturę, bez której decyzje są martwe"

Twoje cztery pozycje z tej listy (piąta — ekrany — to osobny dyżur frontowy):

1. **ścieżka ZAPISU polityki** — dyżur 31 `B.7`; **Ty jej NIE budujesz**,
   Ty na niej stoisz i dokładasz **schemat, walidację i dowód wprowadzalności**;
2. **pole `perspective` przy celu** — **nie istnieje w żadnej migracji**;
3. **udostępnienie `contribution_weight`** — kolumna istnieje od baseline,
   **zero wywołań z UI**;
4. **źródło danych o nieobecnościach** — system ich **nie zna**; do czasu
   podłączenia raport ma pokazywać **„nie wiem", nigdy ładne procenty**.

### 1.2. ★★ ERRATA — DZIESIĘĆ RZECZY ZWERYFIKOWANYCH W KODZIE PRZY WYSTAWIANIU

**Sprawdziłem to przed napisaniem instrukcji. Jeżeli u siebie zobaczysz co
innego — to jest wpis w „Korektach wobec instrukcji", nie powód do
improwizacji.** Cytaty `plik:linia` są z markera.

| # | Twierdzenie | Dowód |
| --- | --- | --- |
| 1 | Tabela polityki **istnieje**, jest tenant-scoped, ma `parameters JSONB` i `row_version`, i **jawnie nie ma seedu** | `server/migrations/20261077_day17_execution_control_kpi_policy.sql:1-16` — komentarz `:1-2` „No default policy is seeded: thresholds and weights remain an owner decision" |
| 2 | Pięć wymaganych parametrów jest **już nazwanych w kodzie**: `impactWeights`, `atRiskThresholdDays`, `capacitySaturationThreshold`, `capacityBuffer`, `decisionSlaDays` | `server/src/services/executionControl/controlKpiReadModel.ts:14-20` |
| 3 | Odczyt polityki filtruje po organizacji i **działa** — nie ruszasz go bez dowodu defektu | `controlKpiReadModel.ts:31-40`, `WHERE organization_id = $1 AND policy_id = $2` |
| 4 | Rodzina jest `DECISION_REQUIRED`, dopóki brakuje **któregokolwiek** z jej parametrów; `resolved` wymaga **zera braków** | `controlKpiReadModel.ts:22-26` (mapa zależności), `:42-44` (braki), `:66-68` (`Boolean(policyRow) && missingParameters.length === 0`) |
| 5 | `/control-kpis` jest **realną trasą runtime-v1**, a `ControlKpiReadModel` jest wstrzykiwany **domyślnym `deps`** — jest gdzie dokładać pola | `initiativesExecutionRuntime.routes.ts:4859-4877` (handler), `:1121` (typ w `deps`), `:5937` (`new ControlKpiReadModel(runtimePool)`) |
| 6 | Kolumny `perspective` **NIE MA w żadnej migracji** — ani w `goals`, ani nigdzie | `grep` z BLOKU 0 pkt (d) → `0` |
| 7 | Perspektywa jest dziś **zgadywana ze słów w nazwie KPI**, z fallbackiem `'process'`, i wchodzi do realnej trasy | `balancedScorecardService.ts:130-192` (słowniki + `inferPerspective`), `resultsStrategicViewService.ts:96` (`kpi.perspective ?? inferPerspective(kpi.name)`), `resultsStrategic.routes.ts:222` (realne wejście), `Gateway.ts:1235` (montaż `/api/results-strategic`) |
| 8 | `goal_initiative_links` ma `contribution_weight real default 1.0` i **NIE MA `organization_id`**; izolacja stoi wyłącznie na JOIN-ie po `initiatives` i jest **strzeżona testem** | `20260719_baseline_gap.sql:4645-4651`; `initiativeGovernanceService.ts:172-176` (JOIN z `i.organization_id=$2`), `:162` (**odczyt BEZ organizacji**); strażnik: `server/src/routes/__tests__/initiative-governance-goal-rollup-tenant.routes.test.ts:61,132` |
| 9 | Wagę da się zapisać z API (`POST /api/initiatives-v4/goals/:goalId/initiatives`), klient frontowy **istnieje**, ale **żaden komponent go nie woła** | `initiative-governance.routes.ts:141-160`; `Gateway.ts:1295`; `src/services/api.ts:21235-21242` (`goalsLinkInitiative`); `grep goalsLinkInitiative src --include=*.tsx` → **0** |
| 10 | Wysycenie mocy liczy dziś **wyłącznie** godziny zadań przeciw `allocation_percent × 40 h`, a próg przeciążenia jest **zaszytą stałą `1.05`** | `CapacityController.ts:37-61` (`project_members.allocation_percent` vs `SUM(tasks.estimated_hours)`), `capacityPolicy.ts:1-5` (`weeklyHoursPerFte: 40`, `overloadRatio: 1.05`, `Object.freeze`) |

### 1.3. ZAKRES — jedenaście pozycji roboczych + jedna kontraktowa + dwie dokumentacyjne

| Pozycja | Jedno zdanie |
| --- | --- |
| `P.1` | Rozstrzygasz i **zapisujesz**, który z dwóch istniejących magazynów polityk niesie parametry `E-O3/E-O4/E-O5` — i nie przenosisz niczego. |
| `P.2` | Budujesz **jawny, walidowany schemat** pięciu parametrów polityki (plus rozszerzenia `E-O4`/`E-O5`) — walidacja strukturalna, **zero wartości domyślnych**. |
| `P.3` | Dowodzisz testem, że **wartości początkowe z `DEC-169` da się wpisać i odczytać** — liczby żyją wyłącznie w danych testu, nie w kodzie źródłowym. |
| `P.4` | Dokładasz **kolumnę `perspective` przy celu** — migracja addytywna, pięć dopuszczalnych wartości, `NULL` = nieprzypisana. |
| `P.5` | Budujesz **komendę przypisania celu do perspektywy** — deklaracja człowieka, CAS, audyt, negatyw tenanta. |
| `P.6` | Budujesz **read-model piątej warstwy „Ład i jakość danych"** — ile zobowiązań bez właściciela / terminu / dowodu, z licznikiem i mianownikiem. |
| `P.7` | Wyprowadzasz **klasę raportu** (`OPERATIONAL` / `STRATEGIC`) z realnego pokrycia perspektyw — etap przejściowy z `DEC-169`. |
| `P.8` | Wprowadzasz **skalę 3-stopniową wkładu** jako jawną klasę przy powiązaniu cel↔inicjatywa, z mapowaniem na `contribution_weight` przez politykę — **i naprawiasz izolację tenantową jako WARUNEK**. |
| `P.9` | Udostępniasz **wariant C `E-O4`** (wkład liczbowy z zamrożoną bazą) jako **kontrakt odczytu** istniejącej mechaniki `rvn_kpi_initiative_impacts` — **nie budujesz drugiego silnika**. |
| `P.10` | Wprowadzasz **pasma wysycenia i bufor** do schematu polityki i sprawiasz, że rodzina `capacity` zwraca **uczciwe `UNKNOWN`**, dopóki nie ma źródła nieobecności. |
| `P.11` | **Inwentaryzujesz**, czego dokładnie brakuje, żeby policzyć realną dostępność — z werdyktem, czy pozycja jest „podłącz", czy „zbuduj od zera". |
| `P.12` | Publikujesz **kontrakt dla frontu**: co musi dostać ekran polityki i ekran przypisania perspektyw. |
| `R.1` | Podnosisz `modules/06_EXECUTION/MODULE_ACCEPTANCE.md` do stanu faktycznego. |
| `R.2` | Piszesz **jeden** raport dyżuru. |

### 1.4. POZA ZAKRESEM — jawnie, żebyś nie zaczął

- **Ekran polityki i ekran przypisania perspektyw** — osobny dyżur frontowy,
  **po prototypie zaakceptowanym przez właściciela** (`CLAUDE.md` reguła 7).
- **Budowa komendy zapisu polityki** — dyżur 31 `B.7` (§1.9).
- **Liczenie ośmiu rodzin miar kontrolnych** — dyżur 31 `B.6`/`B.8`. Ty
  dokładasz **piątą warstwę ładu**, **klasę raportu** i **uczciwość rodziny
  `capacity`** — nie przeliczasz cudzych rodzin.
- **Silnik raportu, generator, publikacja snapshotu, eksporty** —
  `EXE-REPORT-GENERATOR-01`, osobne zadanie produktowe.
- **Zmiany w module Results** (`rvn_*`, `okr_vnext_*`, `resultsStrategic`) —
  wariant C `E-O4` **czytasz**, nie zmieniasz.
- **Podłączenie realnego źródła nieobecności** — `P.11` je **inwentaryzuje**;
  budowa to osobna decyzja właściciela (nie ma jej w `DEC-169`).
- **AI/LLM** w jakiejkolwiek postaci (`Z16`).

### 1.5. Decyzje wiążące (nie podważasz ich w kodzie ani w raporcie)

| ID | Treść, która Cię wiąże |
| --- | --- |
| `DEC-2026-08-28-169` | `E-O3 = C`, `E-O4 = B` + `C` jako opcja, `E-O5 = C`; wartości `7 dni` / `5 dni roboczych` / `80–95 %` / `bufor 15 %` są **wartościami początkowymi do wpisania**, nie seedem; perspektywa **musi** być deklaracją człowieka; raport bez perspektyw nazywa się **operacyjnym** |
| `AMD-EXE-SPINE-AUTHORITY-004` | Dokładnie **jeden** writer pracy wykonawczej; `409` na legacy jest decyzją architektoniczną, nie defektem |
| `EXE-OWN-006` (`MODULE_ACCEPTANCE.md:137`) | „Map commitments … to Financial, Customer/Market, Internal Process, and People/Capability objectives, **with a separate Governance/data-quality layer**. … **Until credible objective mappings exist, label the view as an operational backlog report rather than a BSC strategy report.**" — kontrakt modułu **już mówi to samo, co `DEC-169`** |
| `EXE-OWN-006` (`:139`) | Sygnały ryzyka obejmują wprost **`absent owner`, `missing evidence/DoD`** — to jest źródło definicji piątej warstwy (`P.6`) |
| `EXE-OWN-007` (`:244`) | „**available capacity after absence, fixed duties, accepted reservations and explicit operating buffer**; … saturation as a **range** (`demand / capacity`) with **configurable thresholds**" — to jest kontrakt `E-O5` (`P.10`, `P.11`) |
| `RES-10` | `goal_initiative_links` bez `organization_id` to **znany kształt wycieku**; każde nowe użycie tej tabeli wymaga jawnego filtra organizacji |

### 1.6. ★ PODZIAŁ FRONT / TYŁ — reguła rozstrzygająca

Pytanie, które sobie zadajesz przy każdej linii: **„czy to zmienia coś, co
Piotr zobaczy oczami?"**

- **TAK** → to jest front → **poza zakresem**, idzie do `P.12` jako kontrakt.
- **NIE** (schemat, komenda, walidacja, read-model, koperta HTTP, test) → to
  jest Twoje.

Konsekwencja, którą **wpisujesz do raportu wprost**: „front NIE jest w zakresie
tego dyżuru; żadne pole nie zostało pokazane na żadnym ekranie; ekran polityki
i ekran przypisania perspektyw zbuduje osobny dyżur frontowy — za flagą OFF,
z własnymi zrzutami i wewnętrznym polish-passem — i dopiero potem Piotr
zobaczy je do akceptu, pojedynczo (`CLAUDE.md` reguły 7 i 9)."

### 1.7. Mapa plików, które Cię obchodzą (stan zweryfikowany na markerze)

| Plik | Po co Ci |
| --- | --- |
| `server/migrations/20261077_day17_execution_control_kpi_policy.sql` | nośnik polityki; **istnieje**, `parameters JSONB`, `row_version`, bez seedu |
| `server/src/services/executionControl/controlKpiReadModel.ts` | 74 linie; nazwy pięciu parametrów (`:14-20`), mapa zależności rodzin (`:22-26`), logika `resolved`/`missingParameters` (`:42-44`, `:66-68`), zaszyte `drillDown/sourceVersion/scopeCompleteness` (`:60-61,70`) |
| `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` | trasa `/control-kpis` (`:4859-4877`), typ `deps` (`:1121`), domyślne zależności (`:5937`), fabryka routera (`:1178`) |
| `server/src/domain/initiatives-execution/materialCommand.ts` | **wzorzec** koperty komendy: CAS, idempotencja, audyt w transakcji |
| `server/src/domain/initiatives-execution/capacityScenario.ts` | **zastany nośnik „nie wiem"**: `KnowledgeState = 'KNOWN' \| 'ESTIMATED' \| 'UNKNOWN' \| 'UNCONFIRMED'` (`:10`), `CapacityRange` z `low/base/high`, `confidence`, `reason` (`:11-22`). **Używasz go w `P.10` zamiast wymyślać własny** |
| `server/migrations/20260719_baseline_gap.sql` | `goal_initiative_links` (`:4645-4651`) i `goals` z `organization_id` (`:4653+`) |
| `server/src/services/initiativeGovernanceService.ts` | `linkGoalToInitiative` (`:119-134`), `getGoalInitiatives` (`:137-146`), `getGoalRollup` (`:149-200`) — w tym **odczyt bez organizacji** (`:162`) i ważenie po `contribution_weight` (`:186-190`) |
| `server/src/routes/initiative-governance.routes.ts` | schemat wejścia `POST /goals/:goalId/initiatives` (`:145`), montaż w `Gateway.ts:1295` pod `/api/initiatives-v4` |
| `server/src/routes/__tests__/initiative-governance-goal-rollup-tenant.routes.test.ts` | **strażnik `RES-10`**: pilnuje, że każdy odczyt `goal_initiative_links` ma JOIN po `initiatives` (`:61`, `:132`). **Musi zostać zielony** |
| `server/src/services/results/balancedScorecardService.ts` | nazwy czterech perspektyw (`:8-15`), heurystyka (`:130-192`). **Czytasz, nie zmieniasz** |
| `server/src/controllers/CapacityController.ts` + `server/src/services/capacityPolicy.ts` | dowód, czego wysycenie **dziś nie liczy**; zaszyte `40 h` i `1.05` |
| `server/migrations/20260813_rvn_kpi_initiative_impacts.sql` | wariant C `E-O4`: `expected_contribution_value`, `baseline_value_at_commitment`, trigger chroniący zamrożoną bazę (`:64+`), `row_version` |
| `server/migrations/20260908_execution_bvp_spine.sql` | `execution_delivery_evidence` (`:26-44`) — **nośnik „dowodu"** dla piątej warstwy |
| `docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md` | kontrakt raportu: `:129-141` (`EXE-OWN-006`), `:238-244` (`EXE-OWN-007` / Zasoby), `:256-260` (Sterowanie) |

### 1.8. Pułapki, na które wpadli poprzednicy (nie powtarzaj)

1. **„Skoro heurystyka już jest, użyję jej."** — `inferPerspective` ma fallback
   `'process'`, więc **zawsze coś zwróci** i **nigdy nie powie „nie wiem"**.
   Podpięta pod raport zarządczy produkuje kompletną, zbalansowaną, całkowicie
   fikcyjną taksonomię. Właściciel zakazał tego imiennie (`Z13`).
2. **„Wpiszę wartości z decyzji jako `DEFAULT` w migracji — przecież właściciel
   je zatwierdził."** — właściciel zatwierdził je jako **propozycję do
   wpisania**, przy jawnym zastrzeżeniu, że progi są **edytowalne per klient**.
   `DEFAULT` w migracji to seed dla **wszystkich** organizacji na zawsze
   (`Z12`).
3. **„Zwrócę 0 %, skoro nie mam nieobecności."** — `0` znaczy „zmierzono zero",
   a nie „nie wiem". Kontrakt modułu ma na to osobne stany
   (`MODULE_ACCEPTANCE.md:260`: `UNKNOWN`, `NOT_VERIFIED`, `INSUFFICIENT_DATA`,
   `OWNER_MISSING`, `DECISION_REQUIRED`) i **zastany typ** `KnowledgeState`.
4. **„Dopiszę `organization_id` do `goal_initiative_links` i od razu
   `NOT NULL`."** — na bazie z danymi `NOT NULL` na świeżej kolumnie **wywala
   migrację**. Kolumna addytywna + backfill warunkowy + indeks; `NOT NULL`
   dopiero po udowodnionym backfillu, w **osobnym** dyżurze (`P.8` pkt 6).
5. **„Zmierzę stan wejściowy, potem postawię kontener."** — dzień 17 zmierzył
   stan na cudzej, niezmigrowanej bazie. **Najpierw kontener + pełne migracje,
   dopiero potem jakikolwiek pomiar** (BLOK 0).
6. **„Test przeszedł, więc odczyt działa."** — bez `MOCK_DB=false` odczyt szedł
   na atrapę i zwracał `404`, które wyglądało jak uczciwy brak danych
   (`Z26`). To jest **najczęstsza** fałszywa zieleń tego repo.

### 1.9. ★★ KOLIZJE Z DYŻURAMI W TOKU — rozdział zakresów, sprawdzony

W chwili wystawienia żyją **trzy** równoległe tory. Sprawdziłem ich zakresy;
**żaden plik roboczy się nie pokrywa** — ale z dyżurem 31 masz **zależność**,
a nie tylko rozłączność.

| Tor | Gałąź | Pliki, których dotyka | Relacja do Ciebie |
| --- | --- | --- | --- |
| **Dyżur 31 — Realizacja blok B** | `codex/execution-day31-20260828` | `initiativesExecutionRuntime.routes.ts`, `domain/initiatives-execution/**`, `services/executionControl/controlKpiReadModel.ts`, `routes/v8/execution-control.routes.ts`, migracje `20261200-09` | **★ WARUNEK WSTĘPNY + współdzielone pliki** — patrz ramka niżej |
| Dyżur 30 — Finance C–H | `codex/finance-day30-20260827` | `server/src/routes/v8/finance-v2/**`, `services/finance/canonical/**`, migracje `20261190-99`, port `5511` | rozłączny; te ścieżki **ZABLOKOWANE** |
| Dyżur 32 — silnik dokumentu | `codex/document-engine-day32-20260828` | `services/documentStudio/**`, `services/assessment/**`, `routes/method-core.routes.ts`, `tests/integration/routes/assessment.day32.*`, migracje `20261210-19`, port `5521` | rozłączny; te ścieżki **ZABLOKOWANE** |

> **★★ ROZDZIAŁ Z DYŻUREM 31 — czytaj uważnie, to jest sedno bezpieczeństwa
> tego dyżuru.**
>
> **Dyżur 31 pozycja `B.7` buduje: komendę autorstwa polityki** — zapis do
> `execution_control_kpi_policies`, CAS na `row_version`, idempotencja, audyt
> w transakcji, walidacja strukturalna, **zero wartości domyślnych**. Jego DoD
> wymaga testu, w którym polityka niekompletna zapisuje się jako niekompletna,
> a `GET /control-kpis` **nadal** zwraca `DECISION_REQUIRED`.
>
> **Dyżur 33 (Ty) NIE buduje komendy zapisu. Dyżur 33 jest NADBUDOWĄ:**
>
> | Warstwa | Dyżur 31 `B.7` | Dyżur 33 (Ty) |
> | --- | --- | --- |
> | komenda zapisu polityki (CAS, idempotencja, audyt) | **buduje** | **zakłada, że istnieje** |
> | nazwy pięciu parametrów | używa listy z `controlKpiReadModel.ts:14-20` | **to samo źródło, nie zmieniasz listy** |
> | **schemat i typy wartości** parametrów (`P.2`) | walidacja strukturalna „na oko komendy" | **jawny, wspólny schemat + walidacja jako osobny moduł** |
> | rozszerzenia `E-O4`/`E-O5` w `parameters` (skala 3-stopniowa, pasma, bufor) | **brak** | **buduje** |
> | dowód wprowadzalności wartości z `DEC-169` (`P.3`) | **brak** (decyzji jeszcze nie było) | **buduje** |
> | perspektywa celu, piąta warstwa, klasa raportu, waga wkładu, uczciwe `UNKNOWN` mocy | **brak** | **buduje** |
>
> **Reguła operacyjna, twarda:** jeżeli w BLOKU 0 pkt 8 grep
> `grep -rn "execution_control_kpi_policies" server/src | wc -l` zwróci **`1`**
> (czyli tylko odczyt w `controlKpiReadModel.ts:35`), to **dyżur 31 `B.7` NIE
> jest scalony** → **STOP CAŁEGO DYŻURU**. Zakładasz raport, wpisujesz pozycję
> STOP „warunek wstępny: dyżur 31 pozycja B.7 niescalona", wklejasz wynik grepa
> i kończysz. **Nie budujesz komendy zapisu „przy okazji"** — dwie niezależnie
> zbudowane komendy do jednej tabeli to konflikt scalania, którego nikt nie
> rozstrzygnie bez utraty pracy.
>
> **Jeżeli `B.7` JEST scalony**, ale w innym kształcie niż opisany wyżej —
> **to nie jest STOP**. Opisujesz zastany kształt w `P.1`, dopasowujesz do niego
> `P.2`/`P.3` i wpisujesz rozbieżność do „Korekt wobec instrukcji".
>
> **Współdzielone pliki z dyżurem 31** (`controlKpiReadModel.ts`,
> `initiativesExecutionRuntime.routes.ts`, `domain/initiatives-execution/**`):
> wolno Ci je zmieniać **wyłącznie ADDYTYWNIE** — nowe pola, nowe trasy, nowe
> pliki. **Nie ruszasz** logiki `missingParameters`/`resolved` (`:42-44`,
> `:66-68`), nie ruszasz `valueReason` istniejących rodzin, nie ruszasz
> `calculatedAt`. Każda zmiana w pliku dotkniętym przez dyżur 31 jest **osobno
> wymieniona w raporcie**, żeby nadzorca umiał scalić oba tory.

**Konsekwencje operacyjne, twarde:**

- **Migracje:** `20261190-99` (30), `20261200-09` (31), `20261210-19` (32) są
  **zajęte**. **Twój przedział to `20261220`–`20261229` i tylko on.**
- **Porty:** `5511` (30), `5521` (32), `5556` (31) **nasłuchują teraz**.
  **Twój port to `5597`.**
- **`docker volume prune` = katastrofa dla trzech cudzych dyżurów.** `Z9`,
  §0.3.
- **`git stash` = katastrofa dla trzech cudzych worktree.** `Z27`.

**Jeżeli w trakcie pracy odkryjesz, że Twoja pozycja wymaga zmiany w pliku
z kolumny „Pliki" dyżurów 30 lub 32 — to jest STOP dla nadzorcy, nie Twoja
zmiana.**

---

## BLOK 0 — START (wykonaj po kolei, ZANIM napiszesz pierwszą linię kodu)

1. **Marker** — §0.1 pkt 2. Wynik do raportu dosłownie. `MARKER BRAK` → STOP.
2. **Weryfikacja stanu wejściowego** — §0.1 pkt 4, wszystkie dziesięć bloków
   `(a)`–`(j)`. Wyniki do raportu, rozbieżności do „Korekt".
3. **Przeczytaj `DEC-169` w całości** —
   `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md:220`.
   **Nie pracujesz ze streszczeniem z tej instrukcji.** W raporcie wklejasz
   trzy zdania, które uznałeś za najbardziej wiążące dla swojej pracy.
4. **Przeczytaj kontrakt raportu modułu** —
   `modules/06_EXECUTION/MODULE_ACCEPTANCE.md:129-141`, `:238-244`, `:256-260`.
   W raporcie odpowiadasz na jedno pytanie: **czy `DEC-169` jest zgodna
   z zastanym kontraktem, czy go zmienia?** (Sprawdziłem: `:137` i `:244` mówią
   dokładnie to samo — potwierdź albo obal.)
5. **Własna gałąź i worktree** — §0.1 pkt 5.
6. **Kontener PG — NAJPIERW, przed jakimkolwiek pomiarem:**

   ```bash
   docker run -d --name cx-day33-pg -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day33 \
     -p 5597:5432 pgvector/pgvector:pg16
   # poczekaj na gotowość
   until docker exec cx-day33-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
   docker exec cx-day33-pg psql -U postgres -d cx_day33 -c "SELECT current_database(), inet_server_port();"
   ```

   **Obraz `postgres:15` NIE PRZEJDZIE migracji** (brak rozszerzenia `vector`).
   Port zajęty → pierwszy wolny **powyżej 5597**, spoza listy zakazanych
   z `Z7`, do raportu.

7. **Pełne migracje na świeżej bazie:**

   ```bash
   DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5597/cx_day33" DB_TYPE=postgres \
     npx tsx server/scripts/migrate.postgres.ts
   ```

   Liczbę zastosowanych i pominiętych migracji wklejasz do raportu.
   **★ Zwróć uwagę i zapisz:** runner **celowo pomija** migracje o numerze
   `< 500` (`server/scripts/migrate.postgres.ts:265-268`). To ma znaczenie dla
   `P.11` — patrz tam.

8. **★★ BRAMKA WEJŚCIOWA — dwustronny kontrakt. Bez niej NIE zaczynasz pozycji.**

   ```bash
   # (i) czy komenda zapisu polityki (dyżur 31 B.7) istnieje
   grep -rn "execution_control_kpi_policies" server/src
   #   dokładnie 1 trafienie (controlKpiReadModel.ts:35) → STOP CAŁEGO DYŻURU (§1.9)

   # (ii) czy tabela polityki jest na Twojej bazie i ma oczekiwany kształt
   docker exec cx-day33-pg psql -U postgres -d cx_day33 -c "\d execution_control_kpi_policies"
   #   oczekiwane: policy_id, organization_id, name, parameters jsonb, created_at, updated_at, row_version

   # (iii) czy kolumny perspective NA PEWNO nie ma
   docker exec cx-day33-pg psql -U postgres -d cx_day33 -c "\d goals"
   #   oczekiwane: BRAK kolumny perspective

   # (iv) czy goal_initiative_links NA PEWNO nie ma organization_id
   docker exec cx-day33-pg psql -U postgres -d cx_day33 -c "\d goal_initiative_links"
   #   oczekiwane: id, goal_id, initiative_id, contribution_weight, created_at — i NIC WIĘCEJ

   # (v) czy istnieje jakakolwiek tabela nieobecności
   docker exec cx-day33-pg psql -U postgres -d cx_day33 -c "\dt user_out_of_office"
   docker exec cx-day33-pg psql -U postgres -d cx_day33 -c "\dt user_availability"
   docker exec cx-day33-pg psql -U postgres -d cx_day33 -c "\d users" | grep -iE "vacation|out_of_office"
   #   wynik KAŻDEJ z tych trzech komend wklejasz do raportu DOSŁOWNIE — to jest wejście do P.11
   ```

   **Wynik `(i)` decyduje, czy dyżur w ogóle się zaczyna. Wyniki `(ii)`–`(v)`
   są wejściem do pozycji i muszą być w raporcie przed pierwszym commitem.**

9. **★ INWENTARZ KONSUMENTÓW — zanim cokolwiek dodasz do koperty.** Wypisz
   (grep, `plik:linia`), kto w `src/` czyta dziś `/control-kpis` i kto woła
   `goalsLinkInitiative`. Wynik wklejasz do raportu. To jest ostatnie ogniwo
   `Z21` — i **spodziewam się, że dla obu odpowiedź brzmi „nikt albo prawie
   nikt"**. Wtedy piszesz to wprost i **nie dopisujesz konsumenta**.

10. **Pomiar ZASTANY (przed pierwszym commitem)** — pełny zakres §0.4a,
    z przypiętym env (`Z25`/`Z26`). Bez tej liczby nie odróżnisz czerwieni
    zastanej od wprowadzonej.

11. **Sprzątanie na koniec dyżuru** — §0.3, `docker rm -fv`, **nigdy**
    `docker volume prune`. Dowód pustki do raportu.

---

## §P.1 — DWA MAGAZYNY POLITYK: rozstrzygnij, zapisz, NIC NIE PRZENOŚ

**Pozycja ustaleniowa. Nie dodaje funkcji — zapobiega temu, żeby parametry
`E-O3/E-O4/E-O5` wylądowały w dwóch miejscach naraz.**

Zastane — w **tym samym module** żyją **dwa** nośniki polityki:

| Nośnik | Kształt | Kto pisze | Kto czyta |
| --- | --- | --- | --- |
| `execution_control_kpi_policies` | `policy_id`, `organization_id`, `name`, `parameters JSONB`, `row_version` (`20261077_day17_execution_control_kpi_policy.sql`) | dyżur 31 `B.7` | `controlKpiReadModel.ts:31-40` |
| `ie_governance_policies` | `organization_id`, `scope_type` (`PRODUCT`/`ORGANIZATION`/`PROJECT`/`INITIATIVE`), `scope_id`, `policy_id`, `version`, `baseline`, `strictness`, `config_json JSONB`, `status` (`ACTIVE`/`SUPERSEDED`), PK złożony z wersją (`932_initiatives_execution_material_commands.sql:43-60`) | ścieżka komend materialnych | resolver polityk runtime-v1 |

**To jest realny rozjazd, nie ciekawostka.** Drugi nośnik ma to, czego pierwszy
nie ma: **wersjonowanie append-only**, **zakres** (`scope_type`/`scope_id`)
i **cykl `ACTIVE`/`SUPERSEDED`**. Kusi, żeby wsadzić progi tam.

1. **Rozstrzygnięcie jest podjęte i wiąże Cię: parametry `E-O3/E-O4/E-O5`
   mieszkają w `execution_control_kpi_policies.parameters`.** Powód: to jest
   nośnik, którego **odczyt miar już używa** (`controlKpiReadModel.ts:35`)
   i któremu dyżur 31 właśnie dobudował pisarza. Przeniesienie ich do
   `ie_governance_policies` unieważniłoby pracę dyżuru 31 w trakcie jej trwania.
2. **Nie tworzysz trzeciej tabeli. Nie przenosisz niczego. Nie dopisujesz
   kolumn do żadnej z dwóch.** Parametry mieszkają w `parameters JSONB`.
3. **Wypisujesz w raporcie tabelkę różnic** (jak wyżej, ale z **własnymi**
   `plik:linia` z markera) i **jedno zdanie ryzyka**: co się stanie, gdy ktoś
   kiedyś będzie potrzebował progów per projekt/inicjatywę (dziś
   `execution_control_kpi_policies` **nie ma zakresu** — ma tylko organizację
   i `policy_id`).
4. **To jest znalezisko do rejestru, nie do naprawy.** Jeżeli uznasz, że
   docelowo progi powinny być wersjonowane i zakresowane jak
   `ie_governance_policies` — **piszesz to jako rekomendację w raporcie**,
   z uzasadnieniem, i **nie implementujesz**.

**DoD `P.1`:** tabela porównawcza dwóch nośników z dowodami `plik:linia`
z Twojego markera; jawne zdanie „parametry `E-O3/E-O4/E-O5` mieszkają
w `execution_control_kpi_policies.parameters`"; jedno zdanie ryzyka o braku
zakresu; **zero zmian w kodzie i zero migracji w tej pozycji**; commit
dokumentacyjny (zmiana wyłącznie w pliku raportu).

---

## §P.2 — SCHEMAT I WALIDACJA PIĘCIU PARAMETRÓW + ROZSZERZENIA `E-O4`/`E-O5`

**To jest serce dyżuru. Wszystko dalej stoi na tym pliku.**

Zastane: nazwy pięciu parametrów istnieją **jako lista stringów**
(`controlKpiReadModel.ts:14-20`) i nic więcej — **nie ma typów, nie ma
walidacji, nie ma kształtu wartości**. Odczyt sprawdza wyłącznie, czy klucz nie
jest `undefined`/`null` (`:42-44`). Czyli: `atRiskThresholdDays: "siedem"`
przechodzi jako „parametr obecny", a rodzina `initiative-risk` staje się
`resolved` na stringu.

1. **Tworzysz NOWY plik**
   `server/src/services/executionControl/controlKpiPolicySchema.ts` —
   **jedyne miejsce w repo**, które wie, jak wygląda `parameters`.
2. **Nazwy pięciu parametrów bierzesz z `controlKpiReadModel.ts:14-20` —
   nie wymyślasz własnych i nie zmieniasz istniejących.** Jeżeli musisz
   wyeksportować listę z read-modelu, żeby jej nie duplikować — robisz to
   **addytywnie** (`export`), bez zmiany zawartości.
3. **Kształt wartości — wyprowadzony z `DEC-169`, opisany typami, NIGDY
   wartościami:**

   | Parametr | Typ (kontrakt) | Walidacja strukturalna | Skąd wynika |
   | --- | --- | --- | --- |
   | `impactWeights` | obiekt: klucz = klasa wkładu, wartość = liczba dodatnia skończona | wymagane **dokładnie trzy** klucze skali 3-stopniowej; każda wartość `> 0`, skończona; **żadna wartość nie jest domyślna** | `E-O4 = B`: „skala 3-stopniowa: Krytyczna / Ważna / Wspierająca" |
   | `atRiskThresholdDays` | liczba całkowita `> 0` | całkowita, dodatnia, skończona | `E-O4`: „zagrożone = 7 dni przed terminem" (wartość **wpisuje konsultant**) |
   | `decisionSlaDays` | liczba całkowita `> 0` + jednostka | całkowita, dodatnia; **jawne pole jednostki** `'BUSINESS_DAYS' \| 'CALENDAR_DAYS'` | `E-O4`: „decyzja opóźniona = **5 dni roboczych**" — bez jednostki liczba jest niejednoznaczna |
   | `capacitySaturationThreshold` | dwa progi pasm | dwie liczby w `(0, 1]`, **ściśle rosnące**; struktura opisująca **trzy pasma** (norma / wysycony / przeciążony) | `E-O5 = C`: „do 80 % / 80–95 % / > 95 %" |
   | `capacityBuffer` | ułamek w `[0, 1)` | skończony, `>= 0`, `< 1` | `E-O5`: „bufor 15 % mocy odjęty z góry" |

4. **★★ WALIDACJA JEST STRUKTURALNA, NIE MERYTORYCZNA.** Sprawdzasz, że
   `atRiskThresholdDays` jest dodatnią liczbą całkowitą — **nie** sprawdzasz,
   czy to `7` czy `14`. Sprawdzasz, że progi pasm są rosnące — **nie**
   sprawdzasz, czy to `0.80` i `0.95`. **Zakres dopuszczalnych wartości jest
   decyzją właściciela, nie Twoją walidacją.** Jedyne dopuszczalne granice to
   te, które wynikają z **matematyki** (ułamek nie może być `>= 1`), nie
   z gustu.
5. **★★ ZERO WARTOŚCI DOMYŚLNYCH. ZERO SEEDU. ZERO `??`.** Schemat **nie
   proponuje**, **nie uzupełnia brakujących**, **nie ma fallbacku**. Polityka
   niekompletna waliduje się jako niekompletna i **rodziny od niej zależne
   nadal zwracają `DECISION_REQUIRED`** — dokładnie tak, jak liczy to dziś
   `controlKpiReadModel.ts:42-44` i `:50-53`. **Nie ruszasz tej logiki**;
   dokładasz **drugi powód niekompletności**: parametr obecny, ale
   **strukturalnie niepoprawny**.
6. **Nowy stan w kontrakcie: `INVALID_PARAMETERS`.** Dziś odczyt zna tylko
   „brakuje". Po Twojej zmianie musi umieć powiedzieć „jest, ale ma zły
   kształt" — z **nazwą parametru i nazwą naruszonej reguły**, po polsku
   i angielsku, wg konwencji zastanej (§0.4 ramka o `BRAK_ŹRÓDŁA`). **To jest
   dodanie pola, nie zmiana istniejącego.**
7. **Klasy skali 3-stopniowej nazywasz raz, w tym pliku, i eksportujesz** —
   `P.8` używa **tych samych** stałych. Dwie listy klas w dwóch plikach to
   gwarantowany rozjazd.

**DoD `P.2` (wyższe minimum — 8 testów):** (1) każdy z pięciu parametrów
w wersji poprawnej → waliduje się; (2) każdy w wersji strukturalnie błędnej
(string zamiast liczby, ułamek `>= 1`, progi nierosnące, dwa klucze zamiast
trzech, waga `0`) → **nazwany błąd**, nie wyjątek ogólny; (3) polityka pusta →
pięć braków, zero wyjątków; (4) polityka kompletna i poprawna → `resolved`;
(5) polityka z parametrem obecnym, ale błędnym → **NIE `resolved`**, powód
`INVALID_PARAMETERS` z nazwą parametru; (6) **dowód pustego grepa liczb
w Twoim diffie**:
`git diff a257168bb3...HEAD -- <Twoje pliki> | grep -nE '(^\+.*)\b(5|7|14|15|30|80|95|0\.[0-9]+)\b'`
— **każde trafienie wyjaśnione w raporcie** (dozwolone są wyłącznie granice
matematyczne, np. `0` i `1` w warunku „ułamek w `[0,1)`"); (7) `esbuild` na
nowym pliku; (8) commit.

---

## §P.3 — DOWÓD WPROWADZALNOŚCI: wartości z `DEC-169` da się WPISAĆ i ODCZYTAĆ

**Pozycja czysto dowodowa i najważniejsza dla właściciela.** Odpowiada na
pytanie, które postawił wprost: **czy jego decyzja da się w ogóle wprowadzić do
systemu?**

1. **Piszesz test end-to-end po realnej ścieżce HTTP**, który:
   - **zapisuje** politykę komendą z dyżuru 31 `B.7` z wartościami
     **dokładnie z `DEC-169`**: `atRiskThresholdDays = 7`,
     `decisionSlaDays = 5` z jednostką `BUSINESS_DAYS`, progi pasm
     `0.80` i `0.95`, `capacityBuffer = 0.15`, `impactWeights` z trzema
     klasami skali;
   - **odczytuje** je z powrotem przez `GET /control-kpis?weekStart=…&policyId=…`;
   - **asertuje**, że `policy.resolved === true` i że trzy rodziny zależne od
     polityki **przestały** być `DECISION_REQUIRED`;
   - **czyta wiersz niezależnym `pg.Pool`** i porównuje `parameters`
     z tym, co wysłał (`Z23`, DoD pkt 2).
2. **★★ TE LICZBY ŻYJĄ WYŁĄCZNIE W DANYCH TESTU.** Są ładunkiem żądania
   HTTP w pliku testowym — **nigdy** w `server/src/**` poza testem, **nigdy**
   w migracji, **nigdy** jako stała eksportowana. Grep z `P.2` DoD pkt 6
   **musi** je pokazać wyłącznie w plikach `__tests__`.
3. **Drugi test — negatyw wprowadzalności.** Ta sama ścieżka z polityką,
   w której `capacityBuffer = 1.5` i progi pasm są malejące → komenda
   **odrzuca** (`400` z nazwanym błędem), w bazie **nie przybywa wiersza**
   (`SELECT COUNT(*)` przed i po, niezależny pool).
4. **Trzeci test — polityka częściowa.** Wpisujesz **tylko**
   `atRiskThresholdDays` i `decisionSlaDays` → zapis **przechodzi**,
   `resolved === false`, `missingParameters` zawiera **dokładnie trzy** nazwy,
   rodzina `decision-latency` **przestaje** być `DECISION_REQUIRED`, a rodziny
   `capacity` i `initiative-risk` **zostają**. To dowodzi, że polityka jest
   **przyrostowa** — konsultant nie musi znać wszystkich odpowiedzi naraz.
5. **Negatyw tenanta.** Polityka organizacji A **nie jest** widoczna dla
   organizacji B — `404`, nigdy `403` z danymi, nigdy `200` (DoD pkt 8).
6. **★ W raporcie podajesz jedno zdanie po polsku, którym nadzorca odpowie
   właścicielowi:** „wartości `7 / 5 dni roboczych / 80–95 % / bufor 15 %`
   zostały wprowadzone do systemu przez API i odczytane z powrotem
   — dowód: `<plik testu>:<linia>`, przebieg `<X/X PASS>`; żadna z nich nie
   występuje w kodzie produkcyjnym."

**DoD `P.3` (wyższe minimum — 5 testów):** komplet z pkt 1, 3, 4, 5 + readback
niezależnym poolem; pełna ścieżka `Z21`; jawne zdanie z pkt 6; grep dowodzący,
że liczby są tylko w testach; commit.

---

## §P.4 — `perspective` PRZY CELU: migracja addytywna, pięć wartości, `NULL` = nieprzypisana

Zastane: **kolumny nie ma nigdzie** (BLOK 0 pkt (d) i (iii)). Perspektywa jest
dziś **zgadywana ze słów w nazwie KPI** (§1.2 poz. 7).

1. **Nośnikiem jest tabela `goals`** — org-scoped (`organization_id TEXT NOT
   NULL`, `20260719_baseline_gap.sql:4653+`), z hierarchią (`parent_goal_id`)
   i powiązaniem z inicjatywami przez `goal_initiative_links`. **To jest cel
   biznesowy, o którym mówi `DEC-169` i kontrakt modułu**
   (`MODULE_ACCEPTANCE.md:137`: „Map commitments … to … objectives").
   **★ Zanim napiszesz migrację, potwierdź to sam** i wpisz do raportu, że
   `goals` ma `organization_id` — inaczej powtórzysz kształt `RES-10`.
2. **★ STOP, jeżeli uznasz, że nośnikiem powinno być coś innego.** W repo żyją
   trzy rodziny „celów": `goals`, `okr_objectives` i `okr_vnext_objectives`
   (Results vNext). **Dwie ostatnie są cudzym modułem** (`Z19`, §0.2b) —
   dotknięcie ich to STOP z rekomendacją, nie Twoja zmiana. Jeżeli Twoja
   analiza wskaże, że raport zarządczy Realizacji powinien czytać perspektywę
   z `okr_vnext_objectives` — **zapisujesz to jako STOP z uzasadnieniem
   i nie implementujesz**.
3. **Migracja addytywna**, numer z przedziału `20261220`–`20261229`, nazwa
   `<numer>_execution_day33_goal_perspective.sql`:
   - `ALTER TABLE goals ADD COLUMN IF NOT EXISTS perspective TEXT` —
     **bez `DEFAULT`, bez `NOT NULL`**;
   - `CHECK` ograniczający do **pięciu** wartości; **★ nazwy techniczne
     ustalasz sam i uzasadniasz w raporcie**, ale muszą odpowiadać dokładnie
     pięciu warstwom z `DEC-169`: cztery perspektywy BSC (Finanse ·
     Klient/Rynek · Procesy wewnętrzne · Ludzie/Kompetencje) **plus** „Ład
     i jakość danych". **Cztery pierwsze nazwy technicznie zgraj z zastanym
     `Perspective` z `balancedScorecardService.ts:8`** (`financial`,
     `customer`, `process`, `learning`), żeby nie powstał trzeci słownik
     perspektyw w repo. Piąta wartość jest **nowa** i nie ma odpowiednika
     w tamtym typie — to jest oczekiwane;
   - **`CHECK` musi dopuszczać `NULL`** (`perspective IS NULL OR perspective IN (…)`),
     inaczej migracja wywali się na istniejących wierszach;
   - `CREATE INDEX IF NOT EXISTS` po `(organization_id, perspective)`.
4. **★ `NULL` to nie brak danych — to STAN PRODUKTOWY.** `NULL` znaczy
   **„perspektywa nieprzypisana"** i jest **jedynym** dopuszczalnym stanem
   początkowym. **Nie backfillujesz. Nie zgadujesz. Nie ustawiasz `'process'`
   dla wszystkich** (`Z12`, `Z13`, `Z17`).
5. **Dowód `\d goals` PRZED plikiem migracji** — do raportu, że kolumny nie
   było (§0.3 pkt 3).
6. **Po migracji: drugi `\d goals`** + `SELECT COUNT(*) FROM goals WHERE
   perspective IS NULL` = liczba wszystkich celów. To jest dowód, że nic nie
   zgadłeś.

**DoD `P.4`:** dowód `\d` przed i po; migracja addytywna z numerem
z przedziału; `CHECK` dopuszczający `NULL`; test, w którym `INSERT` z szóstą,
nieznaną wartością **jest odrzucony przez bazę**; test, w którym `INSERT`
z `NULL` **przechodzi**; test, w którym każda z pięciu wartości przechodzi;
`MIGRATION_PREPARED` + `REMOTE_EXECUTION_NOT_AUTHORIZED`; commit.

---

## §P.5 — KOMENDA PRZYPISANIA: perspektywa jest DEKLARACJĄ CZŁOWIEKA

**Kolumna bez komendy to martwa kolumna — dokładnie tak, jak
`contribution_weight` przez ostatni rok.**

1. **Budujesz komendę zapisu perspektywy** w runtime-v1, **wzorcem
   `materialCommand.ts`**: CAS na wersji agregatu, idempotencja przez
   `clientRequestId`, **audyt w tej samej transakcji co mutacja**.
   Kształt wejścia: identyfikator celu + jedna z pięciu wartości **albo jawne
   wyczyszczenie** (powrót do `NULL`).
2. **★★ ŹRÓDŁO PRAWDY = CZŁOWIEK.** Komenda **przyjmuje** wartość. **Nie
   proponuje jej. Nie uzupełnia. Nie woła `inferPerspective`.** Audyt zapisuje
   **kto** i **kiedy** przypisał — bez tego nie da się odróżnić deklaracji od
   domysłu, a właściciel wymaga dokładnie tej różnicy (`Z13`).
3. **★ Podpowiedź jest DOZWOLONA — ale tylko jako osobne, jawnie oznaczone
   pole ODCZYTU.** Jeżeli ją zbudujesz (**nie musisz**, to opcja):
   - żyje **wyłącznie w odczycie** listy celów do przypisania, nigdy
     w odczycie raportu;
   - jest w polu o innej nazwie niż `perspective` i ma **jawną klasę
     `INFERENCE`** (kontrakt modułu: `MODULE_ACCEPTANCE.md:139` — `FACT` /
     `INFERENCE` / `RECOMMENDATION`);
   - **nigdy** nie trafia do bazy bez komendy człowieka;
   - **nie wołasz jej dla celu, który już ma przypisanie**.

   **Wsadzenie podpowiedzi do pola `perspective` albo do odczytu raportu =
   odrzucenie pozycji, nie errata.**
4. **Wyczyszczenie przypisania musi być możliwe.** Człowiek, który pomylił
   perspektywę, musi móc wrócić do `NULL` — i to też jest zdarzenie audytu.
5. **Zdolność.** Przypisanie perspektywy jest **zmianą znaczenia raportu
   zarządczego** — bramkujesz je **istniejącą** zdolnością zapisu wykonawczego
   (`authorize`/`hasEffectiveCapability` w domyślnych `deps` routera).
   **Nie tworzysz nowej roli, nie tworzysz nowej zdolności, nie ruszasz
   `effectiveAccessService`** (`Z18`).
6. **Odczyt, który ten wiersz podnosi**, musi istnieć w tym samym commicie —
   inaczej pozycja jest `CZĘŚCIOWO` (`Z21`).

**DoD `P.5` (wyższe minimum — 7 testów):** happy (przypisanie → readback
niezależnym poolem); wyczyszczenie do `NULL` → readback; wartość spoza
słownika → `400`, **zero wierszy zmienionych**; **CAS**: dwa zapisy z tą samą
oczekiwaną wersją → drugi `409`, w bazie **jedna** zmiana; **idempotencja**:
ten sam `clientRequestId` dwa razy → jeden efekt, jeden wpis audytu;
**negatyw tenanta**: obcy cel → `404`, zero zmian; **negatyw zdolności**: brak
zdolności → odrzucenie, **zero wierszy i zero zdarzeń audytu**; pełna ścieżka
`Z21`; commit.

---

## §P.6 — PIĄTA WARSTWA: „Ład i jakość danych" jako LICZBA, nie hasło

Właściciel powiedział, co ta warstwa ma mówić: **„na ilu kompletnych danych
raport stoi: ile zobowiązań bez właściciela/terminu/dowodu"**. Kontrakt modułu
mówi to samo, dwa razy: `MODULE_ACCEPTANCE.md:135` („**data completeness**"
jako jedna z ośmiu miar rdzeniowych) i `:139` (sygnały ryzyka obejmują wprost
**`absent owner`**, **`missing evidence/DoD`**), a `:131` dokłada trzecią nogę:
**„An item without a due date is a data-risk item, never green and never
silently counted as formally overdue."**

1. **Najpierw USTAL, co w tym module jest „zobowiązaniem" — i zapisz to.**
   Kontrakt (`:133`) mówi o „commitment horizon showing **tasks and decisions
   separately**". Zanim policzysz cokolwiek, wypisujesz w raporcie tabelę:
   **rodzaj zobowiązania → tabela → kolumna właściciela → kolumna terminu →
   nośnik dowodu**, z dowodami `plik:linia`/`\d <tabela>` **z Twojej bazy**.
   **Jeżeli dla któregoś rodzaju nie ma nośnika dowodu — piszesz to wprost
   i ten wymiar zwraca `UNKNOWN`, nie zero.**
   Punkty startowe, które **masz zweryfikować, nie przyjąć na wiarę**:
   `execution_delivery_evidence` (`20260908_execution_bvp_spine.sql:26-44`)
   jako nośnik dowodu dostarczenia; tabele zadań i decyzji jako nośniki
   właściciela i terminu.
2. **Budujesz read-model piątej warstwy** jako **nowy plik** w
   `server/src/services/executionControl/` i **dokładasz jego wynik do koperty
   `/control-kpis`** — **addytywnie**, jako nowe pole. **Nie zmieniasz kształtu
   ośmiu rodzin** (to zakres dyżuru 31).
3. **Każdy wymiar zwraca LICZNIK I MIANOWNIK**, nigdy sam procent
   (`MODULE_ACCEPTANCE.md:135`: „Every KPI exposes current value,
   **numerator/denominator** …"). Trzy wymiary minimum:
   - zobowiązania **bez właściciela** / wszystkie zobowiązania w zakresie;
   - zobowiązania **bez terminu** / wszystkie;
   - zobowiązania **bez dowodu** / wszystkie **wymagające dowodu**
     (mianownik jest tu **inny** — i to musi być widać).
4. **★★ `UNKNOWN` ≠ `0`.** Jeżeli dla danego wymiaru **nie istnieje nośnik**
   (np. żadna tabela nie trzyma dowodu dla decyzji), wymiar zwraca `UNKNOWN`
   **z powodem**, a **nie** `0/0` i **nie** `100 %` kompletności. Organizacja
   bez zobowiązań zwraca **uczciwe zero z mianownikiem zero**, jawnie odróżnione
   od `UNKNOWN` (`Z17`).
5. **Drill-down obowiązkowy.** Każdy licznik ma **dokładny zbiór
   identyfikatorów**, nie próbkę (`MODULE_ACCEPTANCE.md:135`: „an **exact
   drill-down set**"). Zbiór zbyt duży do zwrócenia w kopercie = **STOP
   z rekomendacją stronicowania**, nigdy ciche obcięcie. **`ids: []` przy
   niezerowym liczniku = atrapa** (`Z23`).
6. **Izolacja tenanta w każdym zapytaniu.** Każde `SELECT` tej pozycji ma filtr
   `organization_id` **z tokenu**, nigdy z parametru.

**DoD `P.6` (wyższe minimum — 6 testów):** tabela z pkt 1 w raporcie; test na
zaseedowanym stanie, gdzie **znany z góry** zbiór identyfikatorów jest
porównywany **w całości** (nie długością); test pustej organizacji → `0/0`
uczciwie, **nie** `UNKNOWN`; test wymiaru bez nośnika → `UNKNOWN` **z powodem**,
**nie** `0`; test, w którym mianownik „wymagających dowodu" różni się od
mianownika ogólnego; **negatyw tenanta** — zobowiązania obcej organizacji
**nie wchodzą** do licznika (dowód: dwie organizacje, dwa różne wyniki);
readback niezależnym poolem; pełna ścieżka `Z21`; commit.

---

## §P.7 — KLASA RAPORTU: „operacyjny" dopóki perspektywy nie są przypisane

To jest **etap przejściowy z `DEC-169`**, zapisany też w kontrakcie modułu
(`MODULE_ACCEPTANCE.md:137`): „**Until credible objective mappings exist, label
the view as an operational backlog report rather than a BSC strategy report.**"

1. **Dokładasz do koperty `/control-kpis` pole klasy raportu** — dwie wartości:
   `OPERATIONAL` i `STRATEGIC`. **Addytywnie**, nowe pole.
2. **Klasa jest WYLICZANA z realnego pokrycia, nie ustawiana ręcznie i nie
   przełączana flagą.** Kryterium wyprowadzasz sam i **uzasadniasz
   w raporcie**, ale musi spełniać trzy warunki:
   - liczy **cele w zakresie raportu**, nie wszystkie cele organizacji;
   - `STRATEGIC` wymaga, żeby zobowiązania dało się **realnie** doprowadzić do
     perspektywy — samo istnienie kolumny nie wystarcza;
   - **zero celów z przypisaną perspektywą ⇒ zawsze `OPERATIONAL`**, bez
     wyjątku.
3. **Kopercie towarzyszy POWÓD.** Front (i właściciel) musi zobaczyć **czemu**
   raport jest operacyjny: ile celów w zakresie, ile z przypisaną perspektywą,
   ile zobowiązań daje się doprowadzić do perspektywy. Same słowo
   `OPERATIONAL` nie mówi nic.
4. **★ Próg „wiarygodnego pokrycia" jest PARAMETREM POLITYKI, jeżeli w ogóle
   go wprowadzasz.** Jeżeli Twoje kryterium potrzebuje liczby (np. „co najmniej
   X % celów ma perspektywę"), **ta liczba jest szóstym parametrem polityki**
   (schemat z `P.2`), a **nie** stałą w kodzie — i dopóki nie jest wpisana,
   raport jest `OPERATIONAL` (`Z12`). **Prostsze i dopuszczalne rozwiązanie:
   kryterium bez progu** („`STRATEGIC` wtedy i tylko wtedy, gdy **każde**
   zobowiązanie w zakresie doprowadza do celu z przypisaną perspektywą") —
   wtedy nie dokładasz parametru. **Wybór uzasadniasz.**
5. **Nie zmieniasz nazwy ekranu w `src/`** — to front (`Z19`). Twoim produktem
   jest **pole w kopercie** i **wpis w `P.12`**.

**DoD `P.7`:** test — zero perspektyw → `OPERATIONAL` + powód z liczbami; test
— pełne pokrycie → `STRATEGIC`; test — pokrycie częściowe → wynik zgodny
z uzasadnionym kryterium, powód pokazuje **obie** liczby; test — organizacja
pusta → `OPERATIONAL`, nigdy wyjątek; jeżeli wprowadziłeś próg jako parametr:
brak parametru ⇒ `OPERATIONAL` + `DECISION_REQUIRED`, **nigdy** wartość
domyślna; uzasadnienie kryterium w raporcie; commit.

---

## §P.8 — WAGA WKŁADU `E-O4`: skala 3-stopniowa + ★ WARUNEK IZOLACJI TENANTOWEJ

**To jest jedyna pozycja tego dyżuru, która wychodzi poza moduł Realizacja —
i jedyna, która dotyka znanego kształtu wycieku. Czytaj ją w całości przed
pierwszą linią kodu.**

### P.8.a — stan zastany, cztery fakty

1. `goal_initiative_links` ma `contribution_weight real default 1.0` **od
   baseline** (`20260719_baseline_gap.sql:4645-4651`).
2. Zapis jest osiągalny: `POST /api/initiatives-v4/goals/:goalId/initiatives`
   → `initiative-governance.routes.ts:141-160` →
   `initiativeGovernanceService.ts:119-134` (`ON CONFLICT … DO UPDATE SET
   contribution_weight=$4`). Klient frontowy **istnieje**
   (`src/services/api.ts:21235-21242`).
3. **Nikt tego nigdy nie wywołał z UI** — `grep goalsLinkInitiative src
   --include=*.tsx` → **0**. Waga jest w praktyce zawsze `1.0`.
4. **★ `goal_initiative_links` NIE MA `organization_id`.** Izolacja stoi
   wyłącznie na JOIN-ie po `initiatives` — i **jeden z odczytów tego JOIN-a nie
   robi**: `initiativeGovernanceService.ts:162`
   (`SELECT * FROM goal_initiative_links WHERE goal_id=$1`). Chroni go dziś
   **wyłącznie** wcześniejszy `getGoal(orgId, goalId)` (`:157`) — dopisany po
   incydencie `RES-10` — i **test-strażnik**
   `server/src/routes/__tests__/initiative-governance-goal-rollup-tenant.routes.test.ts:61,132`,
   który wywala każdy odczyt tej tabeli bez `JOIN initiatives`.

### P.8.b — ★★ WARUNEK, NIE OPCJA

**Jeżeli klasa wkładu ma zamieszkać w `goal_initiative_links` — a ma, bo tam
mieszka waga, którą właściciel kazał udostępnić — to naprawa izolacji tej
tabeli jest WARUNKIEM WSTĘPNYM tej pozycji, nie jej opcjonalnym dodatkiem.**

Powód jest prosty i nie podlega dyskusji: dziś ta tabela niesie liczbę, której
nikt nie czyta. Po Twojej zmianie zacznie nieść **deklarację właściciela celu
o krytyczności inicjatywy**, która **waży raport zarządczy**. Wyciek tej
informacji między tenantami przestaje być defektem technicznym, a staje się
wyciekiem strategii klienta.

**Kolejność jest sztywna. Nie wolno jej odwrócić:**

1. **NAJPIERW izolacja** (`P.8.c`), z zielonym strażnikiem;
2. **DOPIERO POTEM klasa wkładu** (`P.8.d`).

Jeżeli `P.8.c` nie przejdzie — `P.8.d` **nie jest zaczynane** i cała pozycja
`P.8` idzie do raportu jako STOP. **Nie ma wariantu „dodam klasę teraz,
izolację potem".**

### P.8.c — naprawa izolacji (pierwsza połowa pozycji)

1. **Migracja addytywna**, numer z przedziału `20261220`–`20261229`, nazwa
   `<numer>_execution_day33_goal_initiative_links_tenant.sql`:
   - `ALTER TABLE goal_initiative_links ADD COLUMN IF NOT EXISTS organization_id TEXT`
     — **bez `NOT NULL`**, **bez `DEFAULT`**, **bez FK** (§0.3 pkt 4);
   - **backfill warunkowy**, wyprowadzony z JOIN-a, nigdy ze stałej:

     ```sql
     UPDATE goal_initiative_links gil
        SET organization_id = i.organization_id
       FROM initiatives i
      WHERE i.id = gil.initiative_id
        AND gil.organization_id IS NULL;
     ```

     **Klauzula `IS NULL` jest obowiązkowa** — bez niej to bezwarunkowy
     `UPDATE`, czyli migracja nieaddytywna (§0.3 pkt 1);
   - `CREATE INDEX IF NOT EXISTS` po `(organization_id, goal_id)`.
2. **★ `NOT NULL` NIE W TYM DYŻURZE.** Kolumna zostaje nullowalna. Ustawienie
   `NOT NULL` wymaga dowodu, że backfill pokrył **wszystkie** wiersze na
   **wszystkich** instalacjach — takiego dowodu nie masz i nie zdobędziesz na
   swoim kontenerze. To jest **osobna migracja w osobnym dyżurze**, i piszesz
   to jako rekomendację.
3. **Odczyt `:162` dostaje filtr organizacji** — obok istniejącego
   `getGoal(orgId, goalId)`, nie zamiast niego. **Obrona w głąb: zostawiasz
   oba.**
4. **★★ TEST-STRAŻNIK MUSI POZOSTAĆ ZIELONY.** Strażnik
   (`:61`, `:132`) wywala odczyt `goal_initiative_links` **bez `JOIN
   initiatives`**. Jeżeli Twój nowy filtr po `organization_id` **usunie**
   JOIN, strażnik zapali się na czerwono. **To NIE jest powód do zmiany
   strażnika** (`Z20` nie obejmuje tego pliku, ale reguła jest ta sama:
   test-strażnik regresji jest produktem, nie przeszkodą). **Zostawiasz JOIN
   i dokładasz filtr.** Jeżeli uważasz, że strażnik po Twojej naprawie jest
   nadmiarowy — **piszesz to jako rekomendację w raporcie i zostawiasz go
   zielonym**.
5. **Dowód izolacji, behawioralny, na realnym PG:** dwie organizacje, każda
   z celem i inicjatywą; odczyt organizacji B po `goalId` organizacji A →
   `404`, **zero wierszy w odpowiedzi**; `getGoalRollup` obcego celu → `404`,
   nie `200` z liczbami.

### P.8.d — klasa wkładu (druga połowa pozycji)

1. **Migracja addytywna, w TYM SAMYM pliku co `P.8.c`** (jedna migracja na tę
   tabelę): `ADD COLUMN IF NOT EXISTS contribution_class TEXT` + `CHECK`
   dopuszczający `NULL` i **dokładnie trzy** klasy skali 3-stopniowej — **te
   same stałe, które wyeksportowałeś w `P.2` pkt 7**.
2. **★★ DLACZEGO KLASA, SKORO JEST WAGA — uzasadnienie, którego masz się
   trzymać.** `contribution_weight` jest liczbą (`real`). Skala 3-stopniowa
   jest **etykietą**. Gdyby zapisywać wyłącznie liczbę, to po zmianie
   `impactWeights` w polityce **nie dałoby się odtworzyć**, co człowiek
   zadeklarował — „Krytyczna" czy „Ważna". Dlatego:
   - **`contribution_class` = deklaracja człowieka** (źródło prawdy);
   - **`contribution_weight` = wartość WYLICZONA** z `impactWeights` polityki
     **w chwili zapisu** i tam zamrożona — dokładnie ten sam wzorzec, którym
     Results zamraża bazę wkładu w wariancie C (`P.9`).
   **Jeżeli po analizie uznasz, że to rozwiązanie jest błędne — to jest STOP
   z propozycją, nie cicha zmiana projektu.**
3. **Bez polityki nie ma wagi.** Jeżeli organizacja **nie ma** wpisanego
   `impactWeights`, komenda:
   - **zapisuje klasę** (deklaracja człowieka jest niezależna od progów),
   - **zostawia `contribution_weight` bez zmiany** i
   - **zwraca w kopercie `DECISION_REQUIRED` z nazwą brakującego parametru**.
   **Nie wpisujesz `1.0`. Nie wpisujesz `null`-a jako „zero wkładu".
   Nie zgadujesz** (`Z12`, `Z17`).
4. **Rozszerzenie schematu wejścia** `POST /goals/:goalId/initiatives`
   (`initiative-governance.routes.ts:145`) o **opcjonalne** pole klasy —
   **addytywnie**, `contributionWeight` zostaje **nietknięte** (istniejący
   klient `src/services/api.ts:21239` musi dalej działać bez zmian).
   **Konflikt wejścia** (podane i klasa, i waga, i się nie zgadzają) →
   `400` z nazwanym błędem, nigdy ciche pierwszeństwo jednego z nich.
5. **Odczyt** `getGoalInitiatives` zwraca **oba** pola plus **jawną informację,
   z której polityki wyliczono wagę** — bez tego liczba w raporcie jest
   nieweryfikowalna (`MODULE_ACCEPTANCE.md:280`: „Every number drills down to
   source identity/version…").
6. **Ważenie w `getGoalRollup`** (`initiativeGovernanceService.ts:186-190`)
   **zostaje jak jest** — dziś `initiative.contribution_weight || 1`. **Nie
   ruszasz go w tym dyżurze**; to jest cudzy odczyt, a zmiana wzoru rollupu bez
   decyzji właściciela zmieniłaby liczby na ekranie Inicjatyw. **Wpisujesz to
   do „Znalezisk": `|| 1` jest fallbackiem, który po wprowadzeniu klas stanie
   się niejednoznaczny.**

**DoD `P.8` (wyższe minimum — 10 testów, dwa commity):**
**commit 1 (`P.8.c`)**: dowód `\d` przed i po; backfill z `IS NULL`; dwa testy
izolacji z pkt `P.8.c` 5; **dowód, że strażnik `initiative-governance-goal-rollup-tenant`
jest zielony przed i po** (wklejasz oba przebiegi).
**commit 2 (`P.8.d`)**: zapis klasy → readback niezależnym poolem; klasa spoza
słownika → `400`, zero zmian; zapis klasy **bez polityki** → klasa zapisana,
waga nietknięta, koperta `DECISION_REQUIRED` z nazwą parametru; zapis klasy
**z polityką** → waga wyliczona z `impactWeights`, **zamrożona**; zmiana
`impactWeights` po zapisie → **stara waga zostaje**, klasa nadal czytelna
(dowód zamrożenia); konflikt klasa↔waga → `400`; **negatyw tenanta** — obcy cel
`404`, zero zmian; istniejące wywołanie **tylko z `contributionWeight`**
(kształt z `api.ts:21239`) **nadal działa** (dowód wstecznej zgodności);
pełna ścieżka `Z21` z jawnym „brak konsumenta w `src/`"; commit.

---

## §P.9 — WARIANT C `E-O4`: udostępniasz ISTNIEJĄCĄ mechanikę, nie budujesz drugiej

Właściciel przyjął wariant C **jako opcję** dla klientów z porządnym pomiarem
i sam wskazał, gdzie mechanika żyje: `rvn_kpi_initiative_impacts`.

Zastane (`20260813_rvn_kpi_initiative_impacts.sql:16-62`) — i to jest **gotowy,
działający silnik**, nie szkielet:

- `expected_contribution_value` + `expected_contribution_direction`
  (`increase`/`decrease`) — obietnica wkładu **w jednostce miary**;
- `baseline_value_at_commitment`, `baseline_measurement_id`,
  `baseline_period_end` — **zamrożona baza**, chroniona **triggerem** przed
  zmianą po zatwierdzeniu (`:64+`);
- `reviewed_attribution_value` + `review_rationale` — **rozliczenie
  obietnica-vs-wykonanie**, celowo odseparowane od obietnicy;
- `status` z cyklem `proposed → committed → superseded / realized_reviewed /
  cancelled`, `row_version`, `organization_id`.

1. **★★ NIE BUDUJESZ DRUGIEGO SILNIKA. NIE KOPIUJESZ TEJ TABELI DO
   REALIZACJI. NIE ZMIENIASZ ANI JEDNEGO ZNAKU W `server/src/services/results/**`**
   ani w tej migracji (`Z19`, §0.2b).
2. **Twoim produktem jest KONTRAKT ODCZYTU**: opis w `P.12` i — jeżeli
   udowodnisz, że da się to zrobić **wyłącznie addytywnie i bez dotykania
   modułu Results** — **jedno pole w kopercie**, mówiące, że dla danej pary
   cel↔inicjatywa istnieje **zatwierdzony wkład liczbowy**, wraz z odsyłaczem
   do niego.
3. **★ Jeżeli udostępnienie wymagałoby zmiany czegokolwiek w Results — STOP.**
   Wpisujesz do raportu, czego dokładnie brakuje (np. „brak odczytu
   `rvn_kpi_initiative_impacts` po `initiative_id` dostępnego dla Realizacji"),
   i **kończysz pozycję jako STOP z rekomendacją**. To jest **poprawny,
   oczekiwany wynik** tej pozycji — nie porażka.
4. **Rozstrzygasz i zapisujesz JEDNĄ rzecz, której nie ma w decyzji:** wariant
   C jest **opcją**, więc muszą współistnieć. Odpowiadasz w raporcie: co się
   dzieje, gdy dla tej samej pary cel↔inicjatywa istnieje **i** klasa
   3-stopniowa (`P.8`), **i** zatwierdzony wkład liczbowy. **Rekomendacja
   nadzorcy, którą masz przyjąć albo obalić z uzasadnieniem:** wkład liczbowy
   ma **pierwszeństwo w prezentacji**, klasa **zostaje jako deklaracja**
   i **oba są widoczne** — nigdy ciche nadpisanie jednego przez drugie.
5. **Zero migracji w tej pozycji.**

**DoD `P.9`:** opis mechaniki wariantu C z dowodami `plik:linia` i `\d
rvn_kpi_initiative_impacts` z Twojej bazy; werdykt „udostępnione addytywnie"
**albo** „STOP — wymaga zmiany w Results, oto czego brakuje"; rozstrzygnięcie
z pkt 4 w raporcie; jeżeli udostępniłeś — test odczytu z **negatywem tenanta**
i uczciwym stanem „brak zatwierdzonego wkładu" (**nie** `0`); commit.

---

## §P.10 — `E-O5`: pasma i bufor w polityce, a rodzina `capacity` mówi UCZCIWE „nie wiem"

**To jest pozycja, w której masz powiedzieć właścicielowi prawdę zamiast pokazać
mu ładny procent.** `DEC-169` mówi wprost: „do czasu podłączenia raport ma
pokazywać »nie wiem«, nigdy ładne procenty".

### P.10.a — parametry (łatwa połowa)

1. Pasma i bufor są już w schemacie z `P.2` (`capacitySaturationThreshold`
   jako **dwa progi trzech pasm**, `capacityBuffer` jako ułamek). Tu
   **domykasz odczyt**: rodzina `capacity` czyta je z polityki i **nie zna
   żadnej wartości**.
2. **★ Progi są edytowalne per klient** (`DEC-169`) — to znaczy: żyją
   w `parameters` **konkretnej organizacji**, nie w kodzie i nie we wspólnym
   seedzie. Nic nowego nie budujesz; **dowodzisz** tego testem: dwie
   organizacje, dwie różne polityki, dwa różne pasma dla tej samej liczby.

### P.10.b — uczciwe „nie wiem" (trudna i ważna połowa)

Kontrakt modułu definiuje dostępność precyzyjnie
(`MODULE_ACCEPTANCE.md:244`): **„available capacity after absence, fixed
duties, accepted reservations and explicit operating buffer"** oraz
**„saturation as a range (`demand / capacity`) with configurable thresholds"**.

System zna dziś **jeden** z tych czterech składników — bufor, i to dopiero po
Twoim `P.2`. Nie zna **nieobecności**, **stałych obowiązków** ani
**zaakceptowanych rezerwacji** (`CapacityController.ts:37-61` porównuje
wyłącznie `SUM(tasks.estimated_hours)` z `allocation_percent × 40 h`).

3. **★★ RODZINA `capacity` NIE ZWRACA PROCENTU, DOPÓKI BRAKUJE SKŁADNIKA
   DOSTĘPNOŚCI.** Zwraca **`UNKNOWN` z wyliczeniem, czego brakuje** — nawet
   gdy polityka jest kompletna. To jest **odwrotność** dotychczasowego
   zachowania (`resolved === true ⇒ licz`) i **musi być zaimplementowane
   jawnie**, bo inaczej wpisanie bufora `15 %` przez konsultanta natychmiast
   wyprodukuje fałszywy procent.
4. **★ UŻYWASZ ZASTANEGO NOŚNIKA „NIE WIEM", NIE WYMYŚLASZ WŁASNEGO.**
   `server/src/domain/initiatives-execution/capacityScenario.ts:10-22` ma już
   `KnowledgeState = 'KNOWN' | 'ESTIMATED' | 'UNKNOWN' | 'UNCONFIRMED'`
   i `CapacityRange` z `low`/`base`/`high`, `sourceRef`, `sourceVersion`,
   `confidence`, `reason`. **Czytasz ten typ i trzymasz się jego słownictwa**
   (plik jest pod imienną licencją: wolno czytać, nie zmieniać). Trzeci
   słownik stanów niepewności w jednym module = rozjazd kontraktu.
5. **Wysycenie jest PASMEM, nie punktem.** Gdy (i jeśli) da się je policzyć,
   kontrakt wymaga **zakresu** (`:244`). Zwracasz `low`/`base`/`high`, nie
   pojedynczą liczbę.
6. **★ ZASZYTE STAŁE — ZNALEZISKO, NIE NAPRAWA.**
   `server/src/services/capacityPolicy.ts:1-5` trzyma `weeklyHoursPerFte: 40`
   i `overloadRatio: 1.05` w `Object.freeze` — **to jest drugi, konkurencyjny
   próg przeciążenia**, niezależny od polityki, którą właśnie budujesz.
   **Nie ruszasz go** (plik jest pod imienną licencją, `CapacityController`
   to cudza ścieżka). **Wpisujesz do „Znalezisk" jako otwarty rozjazd**:
   po `DEC-169` organizacja ma progi w polityce, a stary kontroler ma własny
   `1.05` — i to trzeba kiedyś rozstrzygnąć **decyzją**, nie po cichu.
7. **Bufor odejmowany „z góry"** (`DEC-169`) — to znaczy: bufor pomniejsza
   **dostępność**, zanim policzy się wysycenie, a nie podnosi próg. Zapisujesz
   tę interpretację **jawnie w kontrakcie `P.12`**, żeby front i przyszły
   dyżur liczący nie zgadywały.

**DoD `P.10` (wyższe minimum — 6 testów):** polityka **kompletna**, brak
źródła nieobecności → rodzina `capacity` zwraca `UNKNOWN` **z listą brakujących
składników dostępności**, **nie** procent (to jest test rozstrzygający całą
pozycję); polityka **niekompletna** → `DECISION_REQUIRED` z
`missingParameters` (zachowanie zastane, **nietknięte**); dwie organizacje,
dwie różne polityki → różne pasma dla tej samej liczby (dowód „edytowalne per
klient"); progi nierosnące → odrzucone już w `P.2`, tu potwierdzone kopertą;
organizacja pusta → uczciwy pusty stan, nie wyjątek; **negatyw tenanta**;
znalezisko z pkt 6 w raporcie; interpretacja bufora w `P.12`; commit.

---

## §P.11 — INWENTARZ DOSTĘPNOŚCI: „podłącz" czy „zbuduj od zera"

**Pozycja dokumentacyjna o wysokiej wartości. Odpowiada na pytanie, którego
nikt dotąd nie postawił wprost: czy w schemacie jest JAKIEKOLWIEK źródło
nieobecności?**

**Sprawdziłem to przy wystawianiu instrukcji i podaję wynik — ale masz go
POTWIERDZIĆ NA SWOJEJ BAZIE, nie przepisać.** Wynik jest niejednoznaczny
i właśnie dlatego ta pozycja istnieje.

| Kandydat | Co niesie | Werdykt wstępny (POTWIERDŹ) |
| --- | --- | --- |
| `users.out_of_office INTEGER DEFAULT 0` + `users.vacation_end TIMESTAMP` | osobisty **przełącznik** „jestem nieobecny do dnia X" | **ISTNIEJE na PG** — migracja `20260513_user_function_profile.sql` jest **datowana**, więc runner ją stosuje. Ale to **nie jest kalendarz nieobecności**: brak dat początku, brak historii, brak godzin, brak powiązania z organizacją, jeden okres na użytkownika |
| `user_out_of_office` (`start_date`, `end_date`, `reason`) | **prawdziwy kalendarz nieobecności** — dokładnie to, czego brakuje | **PRAWDOPODOBNIE NIE ISTNIEJE na PG.** Żyje w `129_user_availability.sql:25-38`, a `migrate.postgres.ts:265-268` **pomija migracje o numerze `< 500`**. Do tego plik jest SQLite-owy (`DATETIME`, `BOOLEAN DEFAULT 1`, inline `FOREIGN KEY`). **Zero czytelników w `server/src`** |
| `user_availability` (`working_hours_json`, `dnd_hours_json`) | godziny pracy i DND — **stałe obowiązki** w zalążku | **ROZJAZD DO ODNOTOWANIA**: migracja `129` (pominięta) definiuje jeden kształt, a `DatabaseInitializer.ts:70,431` deklaruje tę tabelę jako **krytyczną** z **innym** kształtem (`user_id`, `settings`, `updated_at`). Dwa różne kształty tej samej nazwy |
| stałe obowiązki, zaakceptowane rezerwacje | — | **BRAK JAKIEGOKOLWIEK KANDYDATA.** Nie znalazłem tabeli. Potwierdź albo obal |

1. **Potwierdzasz każdy wiersz na SWOJEJ bazie** komendami z BLOKU 0 pkt 8 (v)
   i wklejasz **dosłowne** wyniki. Rozbieżność wobec tabelki → „Korekty wobec
   instrukcji".
2. **Wydajesz werdykt per składnik** z `MODULE_ACCEPTANCE.md:244` —
   **nieobecności**, **stałe obowiązki**, **zaakceptowane rezerwacje**,
   **bufor** — w skali:
   `PODŁĄCZ` (nośnik istnieje na PG i wystarcza) /
   `PODŁĄCZ_PO_NAPRAWIE` (nośnik istnieje, ale jest niekompletny lub w złym
   kształcie — opisujesz naprawę) /
   `ZBUDUJ_OD_ZERA` (nośnika nie ma).
3. **Dla każdego `ZBUDUJ_OD_ZERA` piszesz, czego potrzeba** — jedno zdanie
   o kształcie danych i jedno o tym, **kto je wprowadza** (konsultant? HR?
   integracja z kalendarzem?). **To ostatnie jest pytaniem do właściciela,
   nie Twoją decyzją.**
4. **★ NIE BUDUJESZ ŹRÓDŁA NIEOBECNOŚCI W TYM DYŻURZE.** Nie ma go w `DEC-169`
   jako zadania — jest jako **stwierdzenie braku**. Budowa wymaga osobnej
   decyzji właściciela (skąd dane, kto wprowadza, czy to RODO-wrażliwe).
   **Twoim produktem jest inwentarz i rekomendacja**, nie migracja.
5. **Znalezisko obowiązkowe do raportu:** migracje o numerze `< 500` są
   **cicho pomijane** na Postgresie (`migrate.postgres.ts:265-268`) — czyli
   część historycznego schematu, którą `DatabaseInitializer` uważa za
   krytyczną, **na PG nie istnieje**. To jest szersze niż Twoja pozycja
   i **nie naprawiasz tego**.

**DoD `P.11`:** dosłowne wyniki `\dt`/`\d` z Twojej bazy dla trzech kandydatów;
tabela werdyktów per składnik z `:244`; dla każdego `ZBUDUJ_OD_ZERA` — kształt
danych i pytanie do właściciela; znalezisko z pkt 5; **jedno zdanie
odpowiadające na pytanie nadzorcy: „czy istnieje JAKIEKOLWIEK źródło
nieobecności w schemacie?"**; **zero zmian w kodzie i zero migracji**; commit
dokumentacyjny.

---

## §P.12 — KONTRAKT DLA FRONTU: co muszą dostać dwa przyszłe ekrany

**Twój jedyny produkt dla frontu. Piszesz go tak, żeby dyżur frontowy nie
musiał czytać ani jednej linii Twojego kodu.**

Dwa ekrany, oba **poza tym dyżurem**, oba **po prototypie zaakceptowanym przez
właściciela** (`CLAUDE.md` reguła 7):

**A. Ekran polityki progów (dla konsultanta).**

1. **Pełna lista parametrów** — nazwa techniczna, nazwa po polsku, typ, zakres
   dopuszczalny **strukturalnie**, jednostka, co się psuje, gdy brakuje.
2. **★ Wartości początkowe z `DEC-169` podajesz jako TREŚĆ PODPOWIEDZI dla
   ekranu, jawnie oznaczoną jako propozycja do wpisania** — `7 dni`,
   `5 dni roboczych`, `80 % / 95 %`, `bufor 15 %`, trzy klasy wkładu.
   **Piszesz przy nich wprost: to NIE są wartości domyślne systemu; pole startuje
   puste; dopóki konsultant nie wpisze, raport mówi `DECISION_REQUIRED`.**
3. **Kształt koperty odczytu i zapisu** — dokładne pola, dokładne kody błędów
   (`INVALID_PARAMETERS` z nazwą parametru), zachowanie CAS (`409` i co
   wtedy pokazać), zachowanie idempotencji.
4. **Co ekran ma pokazać przy polityce niekompletnej** — listę
   `missingParameters` i **które rodziny miar są przez to niepoliczalne**
   (mapa zależności: `controlKpiReadModel.ts:22-26`).

**B. Ekran przypisania cel → perspektywa.**

5. **Pięć wartości** — nazwa techniczna + nazwa po polsku (cztery perspektywy
   BSC + „Ład i jakość danych").
6. **`NULL` jest stanem, nie błędem** — ekran musi umieć pokazać „nieprzypisana"
   i musi umieć **wyczyścić** przypisanie.
7. **★ Podpowiedź, jeżeli ją zbudowałeś, jest oznaczona jako `INFERENCE`
   i wymaga potwierdzenia człowieka.** Ekran **nie może** zapisywać jej
   automatycznie. Jeżeli jej nie zbudowałeś — piszesz „brak podpowiedzi;
   przypisanie w całości ręczne".
8. **Klasa raportu** (`P.7`) — jak ją pokazać i **jaki powód** wyświetlić
   („raport operacyjny, bo `X` z `Y` celów ma przypisaną perspektywę").
9. **Skala wkładu** (`P.8`) — trzy klasy, kto zatwierdza (**właściciel celu**,
   `DEC-169`), co się dzieje bez polityki (`DECISION_REQUIRED`), i że
   `contribution_weight` jest **wyliczany i zamrażany**, więc ekran **nie
   pozwala go edytować ręcznie**, gdy podana jest klasa.
10. **Wysycenie mocy** (`P.10`) — ekran **musi umieć pokazać `UNKNOWN`
    z powodem**. Jeżeli projekt ekranu nie ma miejsca na „nie wiem", to jest
    zły projekt ekranu — **piszesz to zdanie w kontrakcie**.
11. **★ Zdanie zamykające, obowiązkowe, dosłownie w raporcie:** „front NIE jest
    w zakresie tego dyżuru; żadne pole nie zostało pokazane na żadnym ekranie;
    ekran polityki i ekran przypisania perspektyw zbuduje osobny dyżur frontowy
    — za flagą OFF, z własnymi zrzutami i wewnętrznym polish-passem — i dopiero
    potem Piotr zobaczy je do akceptu, pojedynczo (`CLAUDE.md` reguły 7 i 9)."

**DoD `P.12`:** wszystkie jedenaście punktów w raporcie, z konkretnymi
nazwami pól i kodami błędów (nie opisowo); commit dokumentacyjny.

---

## §R.1 — `MODULE_ACCEPTANCE.md` 06_EXECUTION DO STANU FAKTYCZNEGO

1. **Wyłącznie fakty z Twojego dyżuru.** Nie przepisujesz cudzych statusów, nie
   podnosisz cudzych pozycji, nie dotykasz wierszy dyżuru 31.
2. **Nowe ustalenia numerujesz od NASTĘPNEGO wolnego ID** — sprawdzasz sam:

   ```bash
   grep -o "EXE-PF-[0-9]*"  docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md | sort -u | tail -1
   grep -o "EXE-OWN-[0-9]*" docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md | sort -u | tail -1
   ```

3. **Wpisujesz `DEC-2026-08-28-169` jako źródło** przy każdej pozycji, która
   z niej wynika.
4. **Nie zmieniasz bramki modułu** (`Current gate`) — to zakres nadzorcy.
5. **Jawnie zapisujesz, co POZOSTAJE otwarte**: brak źródła nieobecności
   (`P.11`), brak ekranów (`P.12`), rozjazd `capacityPolicy.ts` vs polityka
   (`P.10` pkt 6), `NOT NULL` na `goal_initiative_links.organization_id`
   (`P.8.c` pkt 2).

---

## §R.2 — RAPORT

Jedyny dokument, który tworzysz:
`docs/program/waves/WAVE_03_ACCEPTANCE/EXECUTION_POLICY_DAY33_REPORT_20260828.md`.
Szablon w §9.

---

## 8. KOLEJNOŚĆ PRACY

Kolejność **nie jest dowolna** — każdy blok zdejmuje niepewność z następnego.

### Blok 0 — start (obowiązkowo, ~120 min, NIE pomijasz)

Wszystkie jedenaście punktów BLOKU 0. **Bramka wejściowa (pkt 8) rozstrzyga,
czy dyżur się zaczyna.** Bez pomiaru ZASTANEGO (pkt 10) nie odróżnisz swojej
czerwieni od cudzej.

### Blok 1 — fundament polityki (`P.1` → `P.2` → `P.3`)

**Najpierw ustalenie, potem schemat, potem dowód.** `P.3` jest testem
akceptacyjnym dla `P.2` — jeżeli nie przechodzi, wracasz do `P.2`, a nie
naginasz test. **Po tym bloku umiesz odpowiedzieć właścicielowi na pytanie
„czy moje wartości da się wprowadzić?" — i to jest najcenniejsza rzecz, jaką ten
dyżur produkuje.**

### Blok 2 — perspektywa (`P.4` → `P.5` → `P.7`)

Kolumna → komenda → klasa raportu. **`P.7` po `P.5`**, bo klasa raportu liczy
realne przypisania, a bez komendy nie da się ich zrobić w teście inaczej niż
`INSERT`-em, który nie dowodzi ścieżki produkcyjnej (`Z22`).

### Blok 3 — ład danych (`P.6`)

Osobno i po perspektywie, bo piąta warstwa jest **równorzędna** czterem
perspektywom i musi umieć wejść do tej samej koperty.

### Blok 4 — waga wkładu (`P.8.c` → `P.8.d` → `P.9`)

**Izolacja PRZED klasą — kolejność sztywna** (`P.8.b`). `P.9` na końcu, bo jego
najbardziej prawdopodobnym wynikiem jest STOP z rekomendacją, a wtedy chcesz
mieć już zamknięty wariant B.

### Blok 5 — moc ludzi (`P.10` → `P.11`)

Najpierw uczciwe `UNKNOWN`, potem inwentarz, czego brakuje. Odwrotna kolejność
kusi, żeby „na razie coś policzyć".

### Blok 6 — domknięcie (obowiązkowo, ~90 min)

1. **`P.12`** — kontrakt dla frontu.
2. **Pomiar KOŃCOWY** — pełny zakres §0.4a, z rozbiciem ZASTANE/WPROWADZONE.
3. **Dowód bezpieczników — pusty diff tam, gdzie musi być pusty:**

   ```bash
   git diff --name-only a257168bb3...HEAD -- src/                     # MUSI BYĆ PUSTE
   git diff --name-only a257168bb3...HEAD -- tests/setup.ts tests/helpers tests/__mocks__ 'vitest*.config.ts' server/vitest.config.ts   # MUSI BYĆ PUSTE
   git diff --name-only a257168bb3...HEAD -- server/src/middleware/executionSpineLegacyReadOnly.middleware.ts server/src/Gateway.ts server/src/routes/v8/index.ts server/src/routes/pmo/initiatives.routes.ts   # MUSI BYĆ PUSTE
   git diff --name-only a257168bb3...HEAD -- server/src/services/results/ server/src/routes/v8/finance-v2/ server/src/services/documentStudio/ server/src/services/assessment/   # MUSI BYĆ PUSTE
   git stash list                                                        # MUSI BYĆ PUSTE (Z27)
   ```

4. **`R.1`**, potem **`R.2`**.
5. **Sprzątanie** — `docker rm -fv cx-day33-pg`, dowód pustki, **nigdy
   `docker volume prune`**. Kopie robocze `*.przed` z `Z27` — skasowane
   i wypisane.
6. **Backup push** — wyłącznie własnej gałęzi na `github-backup` (`Z1`).

### Zasada nadrzędna kolejności

**Jeżeli blok się nie domyka — nie przechodzisz do następnego „żeby nadrobić".**
Wpisujesz STOP, zostawiasz zacommitowane to, co przeszło DoD, i idziesz dalej
tylko wtedy, gdy następny blok **nie zależy** od zablokowanego. Zależności
twarde: `P.3` zależy od `P.2`; `P.5` zależy od `P.4`; `P.7` zależy od `P.5`;
`P.8.d` zależy od `P.8.c`; `P.10` zależy od `P.2`. **Reszta jest niezależna.**

---

## 9. RAPORT — jedyny dokument, który tworzysz

`docs/program/waves/WAVE_03_ACCEPTANCE/EXECUTION_POLICY_DAY33_REPORT_20260828.md`

### 9.1. Szablon

```markdown
# Realizacja — nośniki decyzji E-O3/E-O4/E-O5 — raport dyżuru 33, <data>

Gałąź: codex/execution-policy-day33-<data>
Marker bazowy: <SHA> (wynik `git merge-base --is-ancestor`: <dosłownie>)
Kontener: cx-day33-pg, port <5597 albo pierwszy wolny powyżej>

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)
<jedno zdanie: nie dotknąłem /Users/piotrwisniewski/Developer/Consultify poza symlinkiem node_modules>

## Dowód celu połączenia (Z25/Z26)
<dosłowny wynik `docker exec … SELECT current_database(), inet_server_port();` + komenda `docker run` z `-p`>
<jawne zdanie: każdy przebieg DB miał w tej samej linii DATABASE_URL, RUN_DB_TESTS=1 i MOCK_DB=false>

## ★★ BRAMKA WEJŚCIOWA — dyżur 31 pozycja B.7 (BLOK 0 pkt 8)
<dosłowny wynik `grep -rn "execution_control_kpi_policies" server/src`>
<werdykt: B.7 SCALONY / B.7 NIESCALONY → STOP CAŁEGO DYŻURU>
<jeśli scalony w innym kształcie niż §1.9: opis kształtu zastanego>

## ★ WERYFIKACJA ERRATY §1.2 — dziesięć punktów
| # | Twierdzenie instrukcji | Wynik u mnie | Zgodne? |

## Warunki wstępne — tabela
<wyniki BLOKU 0 pkt 2, 6, 7, 8, 9, 10 — dosłownie>

## ★ INWENTARZ KONSUMENTÓW W src/ (BLOK 0 pkt 9)
<kto czyta /control-kpis, kto woła goalsLinkInitiative — plik:linia albo jawne „nikt">

## Pozycje — tabela zbiorcza
| Pozycja | Status | Commit | Dowód | Poziom |
<14 wierszy: P.1 P.2 P.3 P.4 P.5 P.6 P.7 P.8 P.9 P.10 P.11 P.12 R.1 R.2>

## ★ DOWODY OSIĄGALNOŚCI (Z21) — obowiązkowe dla KAŻDEJ pozycji
<per pozycja: wejście → montaż → bramki → handler → komenda → tabela → odczyt → konsument w src/ ALBO jawne „brak konsumenta">

## ★ TESTY DOMYŚLNEGO OKABLOWANIA (Z22)
<lista testów + dowód, że montują domyślny eksport routera, a NIE fabrykę z własnym deps>
<co dokładnie mockują + uzasadnienie każdego mocka poza auth.middleware i Logger>

## Tabele werdyktów

### P.1 — dwa magazyny polityk | Nośnik | Kształt (plik:linia) | Kto pisze | Kto czyta | Wersjonowanie | Zakres |
### P.1b — ryzyko braku zakresu w execution_control_kpi_policies | <jedno zdanie> |
### P.2 — schemat | Parametr | Typ | Walidacja strukturalna | Wartość domyślna? (MUSI być: BRAK) | Rodzina odblokowana |
### P.2b — dowód braku progów | Trafienie grepa liczb w moim diffie | Plik | Wyjaśnienie |
### P.3 — wprowadzalność | Wartość z DEC-169 | Wpisana przez | Odczytana przez | Wynik | Plik testu:linia |
### P.4 — kolumna perspective | \d PRZED | \d PO | CHECK (pięć wartości + NULL) | Wierszy z NULL po migracji |
### P.5 — komenda przypisania | Wejście | CAS | Idempotencja | Audyt | Negatyw tenanta | Negatyw zdolności |
### P.6 — piąta warstwa | Rodzaj zobowiązania | Tabela | Kolumna właściciela | Kolumna terminu | Nośnik dowodu | Licznik/mianownik | UNKNOWN? |
### P.7 — klasa raportu | Kryterium (słownie) | Uzasadnienie | Próg jako parametr? | Zachowanie przy zerze perspektyw |
### P.8c — izolacja | \d PRZED | \d PO | Backfill (SQL) | Strażnik PRZED | Strażnik PO | Dowód 404 dla obcego |
### P.8d — klasa wkładu | Klasa | Waga wyliczona z | Zamrożona? | Bez polityki → co | Wsteczna zgodność api.ts:21239 |
### P.9 — wariant C | Mechanika (plik:linia) | Udostępniona addytywnie? | Czego brakuje | Współistnienie z klasą |
### P.10 — moc ludzi | Składnik dostępności | Znany systemowi? | Co zwraca rodzina capacity | Dowód, że NIE procent |
### P.11 — inwentarz | Składnik (:244) | Kandydat w schemacie | Istnieje na PG? | Werdykt (PODŁĄCZ / PODŁĄCZ_PO_NAPRAWIE / ZBUDUJ_OD_ZERA) | Pytanie do właściciela |

## ★ KONTRAKT DLA FRONTU (P.12)
<jedenaście punktów z §P.12, z konkretnymi nazwami pól i kodami błędów>
<zdanie zamykające z §P.12 pkt 11 — DOSŁOWNIE>

## Decyzje właścicielskie — co przyjąłem, czego NIE zmieniłem
<jawne zdanie: DEC-2026-08-28-169 przyjąłem jako wiążącą; nie podważam jej w kodzie ani w raporcie>
<lista wszystkiego, co pozostaje DECISION_REQUIRED / UNKNOWN i DLACZEGO>
<dowód, że nie zaszyłem żadnej wartości: wynik grepa liczb w moim diffie>

## Migracje
<numery i nazwy (spodziewane: DWIE, z przedziału 20261220-29); dowód \d PRZED każdym plikiem>
<dowód, że `ls server/migrations | grep '^202612'` było PUSTE przed utworzeniem>
<MIGRATION_PREPARED / REMOTE_EXECUTION_NOT_AUTHORIZED>

## ★ POMIAR TESTÓW (Z24) — PEŁNY zakres §0.4a
### Zakres §0.4a: X/Y PASS, S SKIPPED
### Czerwone ZASTANE (na markerze, PRZED pierwszym commitem) — per plik
### Czerwone WPROWADZONE — per plik + SHA commitu, który je zapalił
### SKIPPED z powodu env — z podziałem na przyczynę
### Testy osłabione / usunięte bloki describe (przed/po, §0.4a pkt 7)
### ★ Strażnik izolacji goal_initiative_links — przebieg PRZED i PO (dosłownie)
### tests/unit/results/** — dowód, że heurystyka BSC pozostała nietknięta i zielona
### Deklaracja: ZASIĘG PEŁNY / ZASIĘG CZĘŚCIOWY + wyliczenie pominięć
### Jawne zdanie: nie przepisałem żadnej liczby z cudzego raportu — zmierzyłem sam

## ★ Dowód braku atrapy (Z23)
<per komenda: SELECT COUNT(*) przed i po, z niezależnego poola>

## ★ Higiena danych
<SELECT COUNT(*) dla prefiksu mojej organizacji w każdej dotkniętej tabeli → 0>

## Bezpieczniki — dowody (pusty diff)
<wyniki pięciu komend z Bloku 6 pkt 3 — WSZYSTKIE muszą być puste, w tym `git stash list`>

## Errata i korekty wobec instrukcji
<każda rozbieżność, którą znalazłeś>

## Znaleziska (NIE naprawiane przeze mnie)
<OBOWIĄZKOWO:
 - dwa równoległe magazyny polityk (P.1) i brak zakresu w execution_control_kpi_policies;
 - zaszyte 40 h / 1.05 w capacityPolicy.ts:1-5 jako drugi, konkurencyjny próg (P.10 pkt 6);
 - migracje o numerze < 500 cicho pomijane na PG (migrate.postgres.ts:265-268) i rozjazd kształtu user_availability (P.11 pkt 5);
 - `|| 1` w getGoalRollup jako fallback niejednoznaczny po wprowadzeniu klas (P.8.d pkt 6);
 - polski string 'BRAK_ŹRÓDŁA' obok angielskiego 'DECISION_REQUIRED' w controlKpiReadModel.ts:59;
 - równoległe serie numeracji migracji (3-cyfrowa vs 8-cyfrowa);
 - cokolwiek jeszcze>

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy
### STOP — <pozycja>

## Licznik (14 pozycji: ZROBIONE_WG_DoD / CZĘŚCIOWO / STOP / BRAK_API / BRAK_POTRZEBY / NIE_ZACZĘTE)

## Kontrola zakresu i cleanup
<git diff --check; komenda bazowa; docker rm -fv + dowód pustki; potwierdzenie, że NIE użyłem docker volume prune ani git stash>

## Czego NIE zrobiłem i dlaczego

## ★ BRIEF WYNIKOWY DLA NADZORCY — ostatnia sekcja, patrz §9.3
```

### 9.2. Zasady raportowania

1. **Liczby, nie przymiotniki.** „Dodano walidację" nic nie znaczy.
   „`capacityBuffer: 1.5` — PRZED: zapisywane bez sprzeciwu, rodzina `capacity`
   `resolved: true`; PO: `400 INVALID_PARAMETERS`, zero wierszy w tabeli,
   rodzina `DECISION_REQUIRED`; dowód: `<plik>:<linia>`" — znaczy.
2. **Każde twierdzenie ma dowód `plik:linia` albo komendę z wynikiem.**
   Twierdzenie bez dowodu wpisujesz do sekcji „twierdzenia niezweryfikowane".
3. **Nie zaokrąglasz w górę.** `CZĘŚCIOWO` to poprawny status.
   `ZROBIONE_WG_DoD` bez kompletu dwunastu punktów §0.4 to **zawyżenie**.
4. **STOP to wynik, nie porażka.** Szczególnie `P.9` — jego najbardziej
   prawdopodobnym poprawnym wynikiem jest STOP z rekomendacją.
5. **Piszesz po polsku.** Nazwy techniczne (pola, kody błędów, tabele) po
   angielsku, jak w kodzie.

### 9.3. ★ BRIEF WYNIKOWY — ostatnia sekcja raportu, pisana NA KOŃCU

**Nadzorca czyta ją pierwszą i na jej podstawie mówi właścicielowi, co się
stało.** Maksimum 25 linii, żadnych tabel, żadnego żargonu, wyłącznie
odpowiedzi:

1. **Czy decyzje właściciela dają się dziś wprowadzić do systemu?**
   Jedno zdanie na każdą z trzech: `E-O3`, `E-O4`, `E-O5`.
2. **Czy wartości `7 / 5 dni roboczych / 80–95 % / bufor 15 %` zostały
   wpisane i odczytane?** Tak/nie + dowód (`P.3`).
3. **Czy raport nazywa się dziś operacyjnym czy strategicznym — i dlaczego?**
   (`P.7`, z liczbami.)
4. **Czy istnieje jakiekolwiek źródło nieobecności w schemacie?** Jedno
   zdanie + werdykt „podłącz" / „zbuduj od zera" (`P.11`).
5. **Czy raport o mocy ludzi pokazuje procenty, czy uczciwe „nie wiem"?**
   (`P.10`.)
6. **Co zostało otwarte i czyją decyzją to jest** — lista maks. pięciu pozycji.
7. **Co nadzorca może scalić, a czego nie.** Jedno zdanie.
8. **Twierdzenia niezweryfikowane** — wszystko, czego nie udowodniłeś
   komendą. **Pusta lista jest podejrzana; jeśli jest pusta, napisz dlaczego.**

---

## 10. CZEGO NIE ROBISZ — lista kontrolna na koniec

Przed commitem `R.2` przechodzisz tę listę i **odpowiadasz „nie" na każdy
punkt**. Jedno „tak" = wracasz i naprawiasz.

- [ ] Czy zaszyłem gdziekolwiek `7`, `5`, `0.8`, `0.95`, `0.15` albo mapę wag
      skali 3-stopniowej, poza plikami testowymi? (`Z12`)
- [ ] Czy `inferPerspective` — albo jakakolwiek heurystyka słów — trafiła do
      odczytu raportu? (`Z13`)
- [ ] Czy rodzina `capacity` zwraca gdziekolwiek procent, mimo braku źródła
      nieobecności? (`Z17`, `P.10`)
- [ ] Czy zmieniłem cokolwiek w `src/`? (`Z19`)
- [ ] Czy zmieniłem cokolwiek w `tests/setup.ts`, `tests/helpers/**`,
      `tests/__mocks__/**` albo jakimkolwiek `vitest*.config.ts`? (`Z20`)
- [ ] Czy dotknąłem `executionSpineLegacyReadOnly.middleware.ts`, `Gateway.ts`,
      `routes/v8/index.ts` albo `routes/pmo/initiatives.routes.ts`? (`Z11`)
- [ ] Czy dotknąłem `server/src/services/results/**`, `finance-v2/**`,
      `documentStudio/**` albo `assessment/**`? (§1.9)
- [ ] Czy zbudowałem drugi raz komendę zapisu polityki z dyżuru 31 `B.7`? (§1.9)
- [ ] Czy dodałem klasę wkładu **przed** naprawą izolacji
      `goal_initiative_links`? (`P.8.b`)
- [ ] Czy ustawiłem `NOT NULL` na świeżo dodanej kolumnie? (`P.8.c` pkt 2)
- [ ] Czy uruchomiłem jakikolwiek test DB bez `DATABASE_URL`, `RUN_DB_TESTS=1`
      i `MOCK_DB=false` w tej samej linii? (`Z25`, `Z26`)
- [ ] Czy użyłem `git stash`? (`Z27`)
- [ ] Czy użyłem `docker volume prune`? (§0.3)
- [ ] Czy podałem zawężony pomiar testów zamiast pełnego zakresu §0.4a? (`Z24`)
- [ ] Czy jakiś test-strażnik jest czerwony i „naprawiłem" go, zmieniając
      strażnika zamiast kodu? (`P.8.c` pkt 4)
- [ ] Czy wpisałem `ZROBIONE_WG_DoD` przy pozycji, która nie ma kompletu
      dwunastu punktów §0.4?

---

**Koniec instrukcji.** Przy jakiejkolwiek wątpliwości: **STOP i wpis
w raporcie — nigdy improwizacja.**
