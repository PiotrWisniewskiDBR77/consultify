# INSTRUKCJA DYŻURU nr 17 — Codex — „RESULTS / EXECUTION BACKEND, BLOK 2: dokończenie DoD dnia 14 (K.2, K.3, O.1, O.2, X.1, X.2, X.4)"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik i repozytorium
Consultify**. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–16. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-26.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

| Co                 | Wartość                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Obszar             | `server/**` (Results vNext + Execution runtime/reports) — **wyłącznie mechanika tylna**                           |
| Źródło zakresu     | `DEC-2026-08-26-77` — „Reszta DoD (K.2/K.3/O.1/O.2/X.1/X.2/X.4) = kolejny dyżur backendowy"                       |
| Poprzednik         | dyżur nr 14 (`RESULTS_EXECUTION_DAY14_REPORT_20260826.md`) — **jest już w Twojej bazie, scalony**                 |
| Decyzje wiążące    | `DEC-2026-08-25-61`, `-62`, `-63`, `-65`, `-72`, `DEC-2026-08-26-77`, `DEC-2026-08-26-86`                         |
| Rejestry odbiorowe | `modules/09_RESULTS/MODULE_ACCEPTANCE.md` (115 l.), `modules/06_EXECUTION/MODULE_ACCEPTANCE.md` (308 l.)          |
| Raport             | `docs/program/waves/WAVE_03_ACCEPTANCE/RESULTS_DAY17_REPORT_20260826.md` — **jeden plik, jedyny, który tworzysz** |

Ten dyżur jest **drugim blokiem** tej samej roboty, którą zaczął dyżur nr 14.
Dyżur nr 14 zrobił uczciwie trzy rzeczy (`S.1` wyszukiwanie, `K.1` trend,
`X.3b` odrzucenie pustego zbioru źródeł) i **uczciwie nie zrobił reszty** —
nie dokładając ani jednej atrapy. Nadzorca to potwierdził bit-for-bit
(`DEC-77`) i przekazał pozostałe siedem pozycji tutaj.

**Nie oceniasz pracy dnia 14. Nie przepisujesz jej. Budujesz obok i dalej.**

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

### 1. **ZERO UI. Dosłownie zero.**

Nie tworzysz i nie zmieniasz **żadnego** pliku `.tsx`. Nie tworzysz i nie
zmieniasz żadnego komponentu, żadnego hooka renderującego, żadnego pliku
w `src/components/**` **poza imiennie wskazanymi modułami klienckimi bez JSX**
(§0.2 ramka Z17). Nie dodajesz kluczy i18n. Nie robisz zrzutów. Nie uruchamiasz
`dev-render`.

Twoim produktem są **endpointy, read-modele, migracje addytywne, testy
behawioralne i typowane kontrakty klienckie** — czyli to, o co UI będzie mogło
poprosić w kolejnym dyżurze. Jeżeli pomyślisz „a dołożę mały kafelek, żeby było
widać, że działa" — **to jest naruszenie i odrzucenie dyżuru.** Widać ma być
**z testu**, nie z ekranu.

Powód: CLAUDE.md reguła 7 (właściciel nigdy nie jest pierwszym testerem
wizualnym) plus **podział FRONT/TYŁ ustalony przez właściciela 25.08**: Codex
robi mechanikę tylną, powierzchnie wizualne powstają osobno, po prototypie
i po akcepcie na zrzutach. Każda pozycja tej instrukcji ma swoją część
wizualną — cała ta część jest w sekcji **„POZA ZAKRESEM (front wewnętrzny)"**
i **nie jest Twoja**.

### 2. **Zamrożenie chmury (`DEC-2026-08-25-65`) obowiązuje w całości.**

Trwa FREEZE. Do komunikatu „FREEZE ZAKOŃCZONY":

- **zero** deployów, zero Railway, zero zmian env/domen,
- **zero** zdalnych migracji, seedów i resetów,
- **zero** zapisów do wspólnej bazy demo,
- **zero** merge/force-push na `demo`/`develop`/`main`/`Londyn`,
- **zero** realnych wysyłek czegokolwiek na zewnątrz (maile, webhooki, API
  dostawców),
- migracje oddajesz jako **`MIGRATION_PREPARED` / `REMOTE_EXECUTION_NOT_AUTHORIZED`**,
  z **jawnym testem kompatybilności wstecz** z zamrożonym demo.

**Baza jest WSPÓLNA** (demo i staging piszą do tej samej bazy kanonicznej,
staging tylko w osobnych organizacjach testowych). To jest powód, dla którego
w tym dyżurze **każda** migracja musi być addytywna i **każdy** nowy odczyt musi
działać na wierszach, które w bazie już są — łącznie z wierszami sprzed migracji
(kolumna `NULL` = uczciwe `UNKNOWN`, **nigdy** `0`).

### 3. **Zakaz atrap jest tu ostrzejszy niż zwykle.**

Ten dyżur istnieje dlatego, że dnia 8, 11 i 14 Codex **uczciwie** pisał
`BRAK_API` zamiast budować atrapę. Zasada się nie zmienia:

- endpoint, który zwraca wyliczoną wartość, gdy nie ma danych → **atrapa**;
- endpoint, który zwraca `0` zamiast `UNKNOWN` → **atrapa**;
- read-model, który liczy „pełną populację" z tabeli, która pełnej populacji
  nie zawiera → **atrapa**;
- rekonstrukcja historyczna, która zwraca stan bieżący → **najgroźniejsza
  atrapa tego dyżuru** (liczba wygląda tak samo, a znaczy co innego);
- rodzina KPI, która **znika** z odpowiedzi, bo nie dało się jej policzyć →
  **cichy fałsz** (konsument policzy „7 z 7 zielonych").

Brak danych = pole `null` + jawny powód (`UNKNOWN` / `NOT_VERIFIED` /
`INSUFFICIENT_DATA` / `DECISION_REQUIRED` / `BRAK_ŹRÓDŁA`) w kontrakcie
odpowiedzi.

**Kontrolka/endpoint bez realnego działania = STOP, nigdy „na razie zostawiam".**

### 4. **Progi i wagi `E-O4` / `E-O5` — NIE ZASZYWASZ. Parametryzujesz.**

`DEC-2026-08-25-72` skierowała do Piotra trzy rzeczy: `E-O3` (taksonomia BSC),
`E-O4` (wagi impact) i progi saturacji z `E-O5`. **Piotr do dziś nie
odpowiedział.** To znaczy:

- **nie wybierasz** progu at-risk, wagi wpływu, progu saturacji, długości
  bufora, taksonomii severity ani wartości SLA reakcji;
- **budujesz mechanikę, która te wartości PRZYJMUJE** — jako jawny, wymagany
  parametr wejściowy read-modelu, z tabelą polityk w bazie jako miejscem
  docelowym;
- gdy parametru brak → odpowiedź zawiera `DECISION_REQUIRED`, a pole wynikowe
  jest `null`. **Nigdy** wartość domyślna „na oko".

Wartość domyślna zaszyta w kodzie = odrzucenie pozycji, nawet jeśli reszta jest
idealna.

### 5. **Odbiór = nadzorca, po dyżurze.**

Twoja rola kończy się na „gotowe do przeglądu kodu i uruchomienia testów przez
nadzorcę". **Nigdy** nie piszesz „gotowe do pokazania właścicielowi" ani
„gotowe do włączenia flagi".

Naruszenie któregokolwiek z pięciu punktów = odrzucenie dyżuru, niezależnie od
jakości reszty.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

Te reguły są bezwzględne. Złamanie którejkolwiek = przerwanie dyżuru i wpis
w raporcie. Nie ma wyjątków „bo tak było szybciej".

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **NAJNOWSZY tip gałęzi `codex/m03-admin-20260824`**
   w repozytorium **`Consultify-final-mvp-integration-20260823`**.

   Nadzorca podaje Ci **SHA commitu-markera** przy wklejaniu tej instrukcji.

   **SHA markera: «MARKER_SHA»**

   ```bash
   cd /Users/piotrwisniewski/Developer/Consultify-final-mvp-integration-20260823
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

   **`git fetch` / `git pull` są w tym dyżurze ZAKAZANE** (FREEZE, `DEC-65` —
   zero operacji sieciowych na origin). Pracujesz na stanie lokalnym.

2. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/preserve-*` ani `codex/wave3-*`. Załóż raport, wpisz pozycję STOP
   z wynikiem obu komend i zakończ dyżur. To jedyna dopuszczalna reakcja.

3. **★ Warunki wstępne — to nie jest formalność, to jest bramka.**

   ```bash
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane >= 140
   grep -c "DEC-2026-08-26-77" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane 1
   grep -c "DEC-2026-08-26-86" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane 1
   grep -c "DEC-2026-08-25-65" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane 1
   grep -c "DEC-2026-08-25-72" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane 1
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md    # oczekiwane 115
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md  # oczekiwane 308
   sed -n '258p' docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/RESULTS_EXECUTION_DAY14_REPORT_20260826.md  # oczekiwane 161
   ```

   Linia 258 rejestru Execution **musi** zaczynać się od
   `**Report layout:** week/scope/trust bar; plan-delivery, blocked-work,
milestone, initiative-risk, dependency, capacity, decision-latency and
intervention-effectiveness KPIs; ...`. To jest **źródło ośmiu rodzin KPI**
   z pozycji §X.4. Jeśli linia 258 mówi co innego — **STOP**: pracujesz na innym
   stanie rejestru niż ten, dla którego pisano tę instrukcję.

   Brak któregokolwiek wyniku = **STOP**.

4. **★ Sprawdzenie, którego NIE POMIJASZ: co z dnia 14 JEST w Twojej bazie.**

   ```bash
   git merge-base --is-ancestor codex/backend-day14-20260826 codex/m03-admin-20260824 \
     && echo "DZIEŃ 14 SCALONY" || echo "DZIEŃ 14 NIESCALONY"
   ls server/src/routes/resultsVnext/search.routes.ts
   ls server/src/services/resultsVnext/kpi/kpiTrend.ts
   grep -n "NO_SOURCES" server/src/domain/initiatives-execution/reportRun.ts
   ```

   **Oczekiwany wynik na dzień wystawienia instrukcji: `DZIEŃ 14 SCALONY`,
   wszystkie trzy artefakty obecne.** To jest stan zamierzony (`DEC-77`
   dopuściła merge zadeklarowanego zakresu).

   - **Jeśli SCALONY** → budujesz **do przodu**: rozszerzasz istniejące routery
     i repozytoria, nie tworzysz ich drugi raz.
   - **Jeśli NIESCALONY** → **STOP całego dyżuru**. Wszystkie siedem pozycji
     zakłada wzorce i pliki dnia 14 (kursor `S.1`, `kpiTrend`, `NO_SOURCES`).
     Nie odtwarzasz ich i nie cherry-pickujesz. Wpis STOP + koniec.

   Wynik wpisujesz do raportu jako obowiązkową pozycję sekcji „Koordynacja".

5. Tworzysz **własną świeżą gałąź** z tego tipa i **własny worktree**:

   ```bash
   git branch codex/results-day17-<data> codex/m03-admin-20260824
   git worktree add /private/tmp/consultify-results-day17 codex/results-day17-<data>
   cd /private/tmp/consultify-results-day17
   ```

   (Podmień `<data>` na faktyczną datę dyżuru, format `YYYYMMDD` — np.
   `codex/results-day17-20260826`.)

6. **★ Zależności — symlink `node_modules`, nie `npm ci` (`DEC-2026-08-26-86`).**

   W świeżym worktree nie ma `node_modules`. **`npm ci` w worktree jest
   niewskazane** (długie, generuje śmieci, potrafi rozjechać wersje). Ustalony
   wzorzec programu, autoryzowany decyzją `DEC-86` dla **wszystkich** dyżurów:

   ```bash
   ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules \
         /private/tmp/consultify-results-day17/node_modules
   ls -l /private/tmp/consultify-results-day17/node_modules   # potwierdź, że to symlink
   ```

   **To jest JEDYNY dozwolony kontakt z katalogiem
   `/Users/piotrwisniewski/Developer/Consultify`** — wyłącznie odczyt
   zależności przez symlink. Zakaz zapisu, edycji, `git`, `cat`, `grep -r`
   i czytania wariantów WIP właściciela w tamtym katalogu **pozostaje w mocy
   bez zmian** (Z5). Jeżeli symlink nie da się utworzyć albo katalog nie
   istnieje — **STOP** z opisem, nie `npm install` na własną rękę.

7. **★ Numer migracji — NIE ZGADUJESZ. Wyznaczasz w Bloku 0 (`DEC-86`).**

   Reguła ogólna programu, ustanowiona `DEC-2026-08-26-86` po tym, jak dwie
   instrukcje z rzędu podały numer, który był już zajęty:

   > **Numeru migracji nie podaje instrukcja. Wykonawca wyznacza
   > „najwyższy istniejący numer w `server/migrations` + 1" i sprawdza
   > zajętość przed KAŻDYM plikiem.**

   ```bash
   # (a) najwyższy istniejący numer
   ls server/migrations | grep -E '^[0-9]{8}_' | sed 's/_.*//' | sort -n | tail -1

   # (b) numery ZAREZERWOWANE przez gałęzie NIESCALONE (żeby merge się nie wywrócił)
   for b in codex/meetings-day16-r2-20260826 codex/day16-fixes-20260826 codex/day14-dozbrojenie-20260826; do
     printf "%-42s " "$b"
     git diff --name-only codex/m03-admin-20260824...$b 2>/dev/null | grep '^server/migrations/' | tr '\n' ' '
     echo
   done

   # (c) PRZED KAŻDYM nowym plikiem migracji — obowiązkowo:
   ls server/migrations | grep '^<numer>'      # oczekiwany wynik: PUSTO
   ```

   Twój pierwszy numer = **max((a), (b)) + 1**, kolejne rosnąco.
   Nazewnictwo: `<numer>_day17_<temat>.sql`. Wynik (a), (b) i przydzielone
   numery wpisujesz do raportu. **Jeżeli `ls | grep '^<numer>'` cokolwiek
   zwróci — bumpujesz i notujesz**, nigdy nie nadpisujesz.

   Porządek stosowania **nie jest** zwykłym sortem nazw: `migrate.postgres.ts`
   klasyfikuje pliki na fazy (`sortMigrationsDeterministically`,
   `server/scripts/migrate.postgres.ts:200-244`) — faza „DATED" sortuje po
   dacie kalendarzowej z prefiksu. **Nie dopisujesz się do
   `LATE_PHASE_MANIFEST`** — to zmiana `migrate.postgres.ts`, pliku tylko do
   odczytu (Z17).

8. **Wszystkie porównania w raporcie robisz wobec bazy**, nie wobec `HEAD~1`:

   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```

### 0.2. Bezwzględne ZAKAZY

| #       | Zakaz                                                                                                                                                                                                                                                                                                                                                                                                   | Dlaczego                                                                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Z1      | **Żadnego `git push` na `origin`** — w ogóle, na żadną gałąź. Żadnego `git fetch`, `git pull`, `gh`, `curl` do origin                                                                                                                                                                                                                                                                                   | FREEZE (`DEC-65`); push wykonuje wyłącznie nadzorca sesji głównej                                                                                                                               |
| Z2      | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `develop`, `main` ani `Londyn`. Nie dotykasz cudzych gałęzi `codex/*` — w szczególności `codex/day14-dozbrojenie-20260826`, `codex/day16-*`, `codex/meetings-day16-*`                                                                                                                                                                                 | `demo` = święta, zamrożona baza deployu; tamte gałęzie należą do równoległych strumieni                                                                                                         |
| Z3      | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**                                                                                                                                                                                                                                                                                                            | Krach 3/4 powstał dokładnie tak                                                                                                                                                                 |
| **Z4**  | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** — plików oznaczonych `PRESERVED_PRODUCT_WIP` / `NO_COPY` w `CANONICAL_16_MODULE_SOURCE_CONTROL_MAP_2026-08-24.md`                                                                                                                                                                                                                           | Wymagania są **już** przełożone na rejestry i decyzje. Zajrzenie tam nie da Ci nic nowego, a może Cię skłonić do cofnięcia modułu                                                               |
| **Z5**  | **★ Katalog `/Users/piotrwisniewski/Developer/Consultify` jest NIETYKALNY** — ani zapis, ani odczyt, ani `git diff`, ani `cat`, ani `grep -r`, ani `ls`. **Jedyny wyjątek: symlink `node_modules` do odczytu zależności (`DEC-86`, §0.1 pkt 6)**                                                                                                                                                        | Chroniony, brudny worktree właściciela z WIP                                                                                                                                                    |
| Z6      | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` ani w `/Users/piotrwisniewski/Developer/Consultify*` — w szczególności `/private/tmp/consultify-day14-dozbrojenie`, `/private/tmp/consultify-day16-fixes`, `/private/tmp/consultify-m03-ledger`, `/private/tmp/consultify-rowdetail-parity`, `/private/tmp/consultify-day17-instrukcja` (worktree TEJ instrukcji)                       | Cudze worktree, część w użyciu przez równoległe dyżury                                                                                                                                          |
| Z7      | **Nie zajmujesz cudzych portów**: 3987 (sesja nadzorcza), 3350/3352/3356/3357 (harnessy dev-render), pasmo odbiorowe 4280–4481, 4304/4305/4306 (dzień 16), 5432/5433/5435 (zastane PG), 5442 (dzień 14), 32784, 34941, 35562, 35570, 35623. Twój **jedyny** port to **5447** — kontener PG dnia 17                                                                                                      | Kolizja psuje cudze runtime'y odbiorowe i cudze dowody                                                                                                                                          |
| **Z8**  | **Zero interakcji z Railway i z jakąkolwiek chmurą.** Brak `railway` CLI, brak zdalnych env, brak redeployu, brak logów produkcyjnych, brak odczytu bazy demo/staging. Brak realnych wysyłek (mail/webhook/API dostawcy)                                                                                                                                                                                | `DEC-2026-08-25-65`, FREEZE                                                                                                                                                                     |
| **Z9**  | **Żadnej bazy poza jednorazowym lokalnym kontenerem na porcie 5447.** Nigdy baza demo/staging/produkcyjna, nigdy cudzy zastany kontener                                                                                                                                                                                                                                                                 | „dane demo = twarz produktu". Cudze kontenery są dowodem odbiorowym cudzego etapu                                                                                                               |
| **Z10** | **★★ ZERO UI.** Zero plików `.tsx`. Zero `src/components/**` poza modułami bez JSX z ramki Z17. Zero `public/locales/**`. Zero zrzutów. Zero `dev-render`                                                                                                                                                                                                                                               | ★ KRYTYCZNE OGRANICZENIE pkt 1 + podział FRONT/TYŁ 25.08                                                                                                                                        |
| **Z11** | **Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej flagi.** W szczególności **nie ruszasz** `execReportsIntelligence` (default OFF wszędzie, `DEC-63(1)`) ani flag w `src/components/ResultsVNext/resultsVNextFeatureFlags.ts`                                                                                                                                                   | CLAUDE.md reguła 9; `DEC-72` zablokowała flip do czasu odbioru                                                                                                                                  |
| **Z12** | **Nie zaszywasz progów, wag ani taksonomii** z `E-O3`/`E-O4`/`E-O5` (waga impact, próg at-risk, próg saturacji, bufor, severity, SLA reakcji, mapowania BSC)                                                                                                                                                                                                                                            | Czekają na decyzję Piotra (`DEC-72`). ★ KRYTYCZNE OGRANICZENIE pkt 4                                                                                                                            |
| Z13     | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN nowy plik dokumentacyjny: `docs/program/waves/WAVE_03_ACCEPTANCE/RESULTS_DAY17_REPORT_20260826.md`. Jedyne inne dokumenty, które wolno Ci zmienić, to `modules/09_RESULTS/MODULE_ACCEPTANCE.md` i `modules/06_EXECUTION/MODULE_ACCEPTANCE.md` — **wyłącznie** w ramach pozycji `R.1`                                                   | Repo tonie w dokumentach-duchach                                                                                                                                                                |
| Z14     | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie ani w raporcie                                                                                                                                                                                                                                                                                           | Rejestr decyzji jest `FINAL / IRREVOCABLE`                                                                                                                                                      |
| **Z15** | **Nie budujesz generowania treści modelem.** Zero podpięcia dostawcy AI, zero promptów, zero „Analiza AI", zero `FACT`/`INFERENCE`/`RECOMMENDATION`. Część AI `E-O7` **czeka na klucz dostawcy** (`DEC-2026-08-25-59`)                                                                                                                                                                                  | Silnik AI = osobny blok programu; budowa bez klucza = atrapa `[TRYB MOCK]`, jawnie odrzucona                                                                                                    |
| **Z16** | **★ Nie dotykasz modelu uprawnień.** `server/src/services/effectiveAccessService.ts` (i każdy `**/effectiveAccessService*`), `frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts`, `server/src/middleware/**` — **wolno UŻYWAĆ i CYTOWAĆ, nie wolno ZMIENIAĆ**                                                                                                             | Model uprawnień naprawiany in-house, osobnym torem                                                                                                                                              |
| **Z17** | **★ IZOLACJA MODUŁOWA — zakaz wszystkiego poza ramką „WOLNO" poniżej.** Nie dotykasz modułów: Organization, Settings, Admin, Superadmin, Chat, Interview, Assessment, Tools, Meetings, Materials, Audits, Partner, My Work, Finance, Initiatives (poza runtime raportów Execution). **Zmiana serwisu współdzielonego bez jawnej licencji w tej instrukcji = STOP, nie „jedna linia importu"**           | Program konsolidacji jest „jeden obszar na raz". `DEC-77` udzieliła licencji imiennie i wyłącznie na to, co niżej                                                                               |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config.ts`, `server/vitest.config.v8-db.ts`, ani żadnego mocka/helpera współdzielonego przez całe repo. **Naruszenie Z18 = automatyczne odrzucenie CAŁEGO dyżuru** | **Lekcja z odbioru dnia 2:** Codex po cichu zmienił globalny mock w `tests/setup.ts` i wywalił **27 testów w cudzych modułach** — w modułach, których nie dotykał i których nigdy nie uruchomił |

**Zasięg Z18 — konkretnie, bo to jest zakaz, który najłatwiej złamać
„w dobrej wierze".**

```
tests/setup.ts                     ← plik, na którym poległ dyżur nr 2
tests/helpers/**                   (w tym unifiedMockSetup.js)
tests/__mocks__/**                 (llmApi, server/database, node-cron, nodemailer,
                                    @google/generative-ai, aws-sdk-client-s3)
vitest.config.ts
vitest.l1.config.ts  vitest.l2.config.ts  vitest.l3.config.ts
vitest.acceptance.config.ts  vitest.security.config.ts  vitest.orphans.config.ts
vitest.perf.config.ts  vitest.migration.config.ts
server/vitest.config.ts  server/vitest.config.v8-db.ts
tests/integration/**/vitest.*.config.ts
```

**Co robisz, gdy potrzebujesz innego zachowania mocka.** Dokładnie jedno
z dwóch, zawsze **opt-in, nigdy globalnie**:

1. **`vi.mock` lokalnie w Twoim pliku testowym** — mock żyje i umiera razem
   z tym jednym plikiem;
2. **dedykowany helper w NOWYM pliku**, importowany jawnie tylko przez Twoje
   testy (np. `server/src/services/executionControl/__tests__/day17Harness.ts`).
   Nowy plik, nie dopisek do istniejącego helpera współdzielonego.
   Dotyczy to zwłaszcza **leniwego ładowania `exceljs` w §X.2** — mockujesz
   je lokalnie, nie w `tests/__mocks__`.

**Nie wolno**: „tylko dodam jedno pole do globalnego mocka", „to jest
addytywne, nic nie zepsuje", „inaczej mój test nie przejdzie". Jeśli Twój test
nie przechodzi bez zmiany globalnego mocka — to jest **STOP**.

**Zasięg Z17 — granica jest ostra i przebiega tak:**

```
WOLNO (Twój zakres):

  ── Results vNext (serwer) ──────────────────────────────────────────
  server/src/routes/resultsVnext/kpi.routes.ts            (WYŁĄCZNIE dodanie tras §K.2/§K.3)
  server/src/routes/resultsVnext/okr.routes.ts            (WYŁĄCZNIE dodanie tras §O.1/§O.2)
  server/src/services/resultsVnext/kpi/**                 (NOWE pliki: kpiHistory*, kpiNextObligation*)
  server/src/services/resultsVnext/okr/okrAttentionRepository.ts   (WYŁĄCZNIE opcjonalny setId — §O.1 pkt 1)
  server/src/services/resultsVnext/okr/**                 (NOWE pliki: okrSetCheckInSummary*)
  server/src/validators/resultsVnextKpi.validators.ts
  server/src/validators/resultsVnextOkr.validators.ts

  ── Execution / raporty (serwer) ────────────────────────────────────
  server/src/domain/initiatives-execution/reportRun.ts            (TYLKO ODCZYT — patrz NIE WOLNO)
  server/src/domain/initiatives-execution/reportReconstruction.ts (NOWY, §X.1)
  server/src/routes/pmo/initiativesExecutionRuntime.routes.ts     (WYŁĄCZNIE dodanie tras §X.1/§X.4 + wpis do mapy widoczności :1278-1290)
  server/src/routes/managementReports.routes.ts                   (WYŁĄCZNIE gałąź XLSX + przekazanie organizationId z tokenu — §X.2)
  server/src/services/managementReportsService.ts                 (WYŁĄCZNIE XLSX + org-scoped odczyt §X.2)
  server/src/repositories/managementReportRepository.ts           (WYŁĄCZNIE NOWA metoda org-scoped §X.2)
  server/src/services/executionControl/**                         (NOWE pliki read-modelu §X.4)

  ── montaż ──────────────────────────────────────────────────────────
  server/src/Gateway.ts        (WYŁĄCZNIE jeśli §X.4 dostanie własny prefiks — patrz §2.4)

  ── migracje ────────────────────────────────────────────────────────
  server/migrations/<numer>_day17_*.sql    (NOWE pliki, numer wg §0.1 pkt 7)

  ── kontrakty klienckie (BEZ JSX — sprawdź grepem przed zapisem) ─────
  src/components/ResultsVNext/kpiApi.ts             (plik czysto TS — dopisujesz funkcje)
  src/components/ResultsVNext/okr/okrApi.ts         (plik czysto TS — dopisujesz funkcje)
  src/services/initiatives-execution/runtimeApi.ts  (plik czysto TS — dopisujesz funkcje)

  ── testy ───────────────────────────────────────────────────────────
  server/src/**/__tests__/**                 (NOWE pliki obok kodu)
  tests/resultsVnext/day17/**                (NOWE; wymaga `git add -f`)
  tests/integration/day17-*.realdb.test.ts   (NOWE; wymaga `git add -f`)

  ── rejestr i raport ────────────────────────────────────────────────
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md    (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md  (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/RESULTS_DAY17_REPORT_20260826.md           (jedyny nowy dokument)

NIE WOLNO:
  KAŻDY plik `.tsx` w całym repo                        ← Z10, bez wyjątku
  src/components/** (poza dwoma modułami TS wyżej)      ← Z10
  public/locales/**                                     ← Z10, zero i18n
  src/components/ResultsVNext/resultsVNextFeatureFlags.ts                     ← Z11
  src/config/featureFlags*  ·  src/utils/betaAccess.ts  ·  src/utils/pilotAccess.ts   ← Z11
  server/src/middleware/**                              ← WOLNO UŻYWAĆ, NIE ZMIENIAĆ (Z16)
  server/src/services/effectiveAccessService.ts  ·  frameworkEntitlementService.ts    ← Z16, tylko odczyt
  server/src/services/resultsVnext/platform/atomicWrite.ts                    ← WOLNO WOŁAĆ; zmiana = STOP
  server/src/services/resultsVnext/platform/visibilityScopedQuery.ts          ← WOLNO WOŁAĆ; zmiana = STOP
  server/src/services/resultsVnext/platform/resourceTypes.ts                  ← SSOT dzielony; dopisanie typu = STOP
  server/src/services/resultsVnext/platform/textMatch.ts · resultsSearchRepository.ts   ← własność dnia 14 (S.1/S.2)
  server/src/services/resultsVnext/kpi/kpiTrend.ts  + jego __tests__          ← własność K.1 / dozbrojenia (§1.4)
  server/src/routes/resultsVnext/__tests__/kpi.routes.test.ts                 ← ★ RÓWNOLEGLE EDYTOWANY (§1.4) — NIE DOTYKASZ
  server/src/routes/resultsVnext/roi.routes.ts · validators/resultsVnextRoi.validators.ts   ← ★ S.2 ROI, równolegle (§1.4)
  server/src/routes/resultsVnext/search.routes.ts                             ← własność dnia 14 (S.1)
  server/src/domain/initiatives-execution/reportRun.ts (ZMIANA)               ← ODCZYT TAK, zmiana = STOP (X.3b domknięte przez dzień 14)
  server/src/services/resultsVnext/okr/okrCheckInScheduler.ts · okrCheckInCommands.ts     ← WOLNO CZYTAĆ/WOŁAĆ; zmiana = STOP
  server/migrations/* (wszystkie ISTNIEJĄCE)            ← TYLKO ODCZYT
  server/scripts/migrate.postgres.ts                    ← TYLKO ODCZYT
  tests/e2e/**  ·  tests/acceptance/**                  ← cudzy tor odbiorowy
  scripts/check-*.sh  ·  scripts/check-list-canon.baseline.txt   ← bezpieczniki, nie ruszasz
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie
jest** praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie,
czego dokładnie brakuje, i idziesz dalej. Wyjątku nie ma nawet dla „jednej
linii importu".

**Bramka przed dotknięciem kontraktu klienckiego** (wykonaj i wklej wynik do
raportu — jeśli którykolwiek plik ma JSX poza komentarzem, **STOP**):

```bash
grep -nE '</[A-Za-z]|<[A-Z][A-Za-z]*[ />]' \
  src/components/ResultsVNext/kpiApi.ts \
  src/components/ResultsVNext/okr/okrApi.ts \
  src/services/initiatives-execution/runtimeApi.ts
```

Trafienia typu `Array<Foo>`, `Promise<T>`, `Record<string, X>` to **generyki
TypeScriptu, nie JSX** — te są w porządku. Trafienie w postaci realnego elementu
(`<div`, `<Foo prop=`, `</Foo>`) = STOP i wpis do raportu.

### 0.3. Higiena wykonania

- **★ Commit per pozycja.** Jedna pozycja = jeden commit. Nie zbiorcze
  „add backend endpoints". Siedem pozycji = siedem commitów (plus ewentualne
  `test(...)`/`docs(...)` domknięcia).
- **Conventional commits**, wzór:
  ```
  feat(results-kpi): unified KPI history and lineage read model (K.2)
  feat(results-kpi): next obligation read model over existing schema (K.3)
  feat(results-okr): set-scoped attention inside the shared repository (O.1)
  feat(results-okr): server-side set check-in summary read model (O.2)
  feat(execution): deterministic as-of source reconstruction for report runs (X.1)
  feat(execution): XLSX export branch and org-scoped report read (X.2)
  feat(execution): control-loop KPI families read model, policy-parameterised (X.4)
  ```
- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem**, na plikach tego commita:
  ```bash
  npx prettier --write <lista plików tego commita>
  ```
- **Testy celowane per pozycja** — **nigdy pełny `tsc` ani pełny `vitest`
  repo.** Punktowo, np.:
  ```bash
  npx vitest run server/src/services/resultsVnext/kpi/__tests__/kpiHistory.test.ts
  npx vitest run server/src/services/executionControl/__tests__
  npx vitest run tests/resultsVnext/day17
  ```
- **Sprawdzanie typów punktowo**, nie całe repo:
  ```bash
  npx tsc --noEmit -p tsconfig.json    # ZAKAZANE (godziny, wyczerpuje stertę)
  npx esbuild server/src/services/executionControl/controlKpiReadModel.ts \
    --loader:.ts=ts --outfile=/dev/null    # OK
  ```
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok kodu
  w `server/src/` dodają się normalnie.
- **Hooki pre-commit działają i będą Cię blokować.** Nie obchodzisz ich przez
  `--no-verify`. Jeśli hook blokuje — poprawiasz kod, nie hook.
  `scripts/check-list-canon.sh --update` jest **ZAKAZANE**; baseline
  `scripts/check-list-canon.baseline.txt` **nie zmienia się** i jest jednym
  z dowodów Bloku 6. (Przy dyżurze backendowym kanon list nie powinien się
  ruszyć — jeżeli się ruszy, znaczy, że złamałeś Z10.)
- **Dane demo = twarz produktu.** Każdy probe sprząta po sobie. Zero rekordów
  testowych zostawionych w jakiejkolwiek bazie.

#### ★ MIGRACJE — reguły twarde, bez wyjątków

1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
   `INSERT ... ON CONFLICT DO NOTHING`, `CREATE OR REPLACE FUNCTION`.
   **Zakaz** `DROP`, `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`,
   bezwarunkowego `UPDATE`.

2. **Numeracja wg §0.1 pkt 7** — wyznaczana w Bloku 0, sprawdzana przed każdym
   plikiem, nigdy zgadywana.

3. **Zero kluczy obcych do tabel, które sortują się później.** Tenant
   i istnienie rodzica sprawdzasz w warstwie aplikacji. Dopuszczalne FK:
   wyłącznie do tabel powstałych wcześniej (mniejszy prefiks) — i tylko wtedy,
   gdy jawnie wykażesz to w nagłówku migracji.

4. **★ KOMPATYBILNOŚĆ WSTECZ Z ZAMROŻONYM DEMO — warunek `DEC-65`.**
   Baza jest wspólna. Twoja migracja musi spełniać jednocześnie:
   - kod **zamrożonego demo** (bez Twoich zmian) działa na bazie **po**
     migracji — żadna nowa kolumna nie jest `NOT NULL` bez `DEFAULT`, żaden
     nowy trigger nie odrzuca zapisu, który dziś przechodzi;
   - Twój kod działa na bazie **przed** backfillem — każdy odczyt nowej kolumny
     traktuje `NULL` jako `UNKNOWN`, **nigdy** jako `0`.

   **Dowód wymagany w raporcie** (tabela `KOMPATYBILNOŚĆ_WSTECZ`): dla każdej
   nowej kolumny/tabeli wpis „co robi stary kod, gdy to zobaczy" + „co robi
   nowy kod, gdy tego nie ma".

5. **★ MIGRATION_PREPARED / REMOTE_EXECUTION_NOT_AUTHORIZED.**
   Migracji **nie uruchamiasz nigdzie poza własnym kontenerem**. W raporcie
   każda migracja dostaje wpis:

   ```
   MIGRATION_PREPARED: server/migrations/<numer>_day17_<temat>.sql
   REMOTE_EXECUTION_NOT_AUTHORIZED (DEC-2026-08-25-65)
   Dowód lokalny: IDEMPOTENCJA_PEŁNA | IDEMPOTENCJA_CELOWANA
   ```

6. **★ DOWÓD IDEMPOTENCJI NA ŚWIEŻEJ BAZIE — warunek oddania każdej pozycji
   z migracją.** Trzy przebiegi, wyniki wklejone do raportu:

   ```bash
   docker run -d --name cx-day17-pg \
     --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=3g \
     -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day17 \
     -p 127.0.0.1:5447:5432 pgvector/pgvector:pg16

   export DATABASE_URL="postgres://postgres:cx@127.0.0.1:5447/cx_day17"
   NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict            # (1) świeży przebieg
   NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict            # (2) powtórka → "Applying migrations: 0"
   NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry      # (3) dry-run → "Pending migrations: 0"
   ```

   **★ Sprzątanie jest obowiązkowe, z wolumenami, i jest częścią dowodu:**

   ```bash
   docker rm -f cx-day17-pg
   docker volume ls -q | grep -i cx-day17 | xargs -r docker volume rm
   docker ps -a --filter name=cx-day17 --format '{{.Names}}'   # oczekiwany wynik: PUSTY
   docker volume ls -q | grep -i cx-day17                      # oczekiwany wynik: PUSTY
   ```

   **Nie usuwasz cudzych kontenerów ani cudzych dangling volumes.**

   Jeżeli przebieg (1) zatrzyma się na **cudzej, niezwiązanej** migracji (znany,
   udokumentowany stan repo): **to nie jest Twój defekt** — wklejasz do raportu
   nazwę pliku, na którym replay stanął, i wykonujesz dowód (1)(2)(3) **celowany
   na Twoje migracje**, przez ręczne `psql -f` w tej samej kolejności. Oznaczasz
   to jako `IDEMPOTENCJA_CELOWANA`, nie jako `IDEMPOTENCJA_PEŁNA`.

7. **Zero migracji danych, które zmieniają znaczenie istniejących wierszy.**
   Backfill legacy → nowa tabela dozwolony **tylko** jako
   `INSERT ... ON CONFLICT DO NOTHING` z kluczem deduplikacji.

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

**Pozycja** jest zrobiona dopiero, gdy spełnia **wszystkie dziesięć**:

1. **Realne dane.** Read-model czyta z realnych tabel. Zero zaszytych tablic,
   zero `sampleData`, zero „przykładowej" odpowiedzi w handlerze. Pusty wynik
   z bazy = uczciwie pusta odpowiedź, nie wymyślone wiersze.
2. **Uczciwość wartości — kontrakt trójstanowy.** Każde pole liczbowe ma jawnie
   rozróżnione trzy przypadki: `wartość` · `null + reason` (`UNKNOWN` /
   `INSUFFICIENT_DATA` / `NOT_VERIFIED` / `DECISION_REQUIRED` /
   `BRAK_ŹRÓDŁA`) · `0` **jako prawdziwe zero**. **`0` nigdy nie zastępuje
   braku danych.**
3. **★ Tenant-izolacja z tokenu, nie z żądania.** `organizationId` bierzesz
   **wyłącznie** z `req.user` (ustawionego przez `verifyToken`). **Nigdy**
   z `req.body`, `req.query`, `req.params` ani z nagłówka. Każdy nowy endpoint
   przechodzi test: obcy `organizationId` dostaje **404 albo 403, nigdy 200
   z cudzymi danymi i nigdy 200 z pustą listą jako „sukces"**.
4. **★ TEST HTTP REALNEGO ROUTERA — nie tylko test funkcji.** Co najmniej jeden
   test montuje realny router (albo realną aplikację testową) i uderza
   w endpoint HTTP-em, z realnym łańcuchem middleware. Sam test serwisu/
   read-modelu **nie wystarcza** — to jest dokładnie brak, który `DEC-77`
   wytknęła pozycji `K.1`.
5. **Minimum 4 testy zachowania** przechodzą: happy path · ścieżka błędu
   (4xx/5xx) · pusty stan · **negatyw tenanta** (obcy `organizationId` →
   404/403).
6. **★ Co najmniej jeden test `realdb`** per pozycja dotykająca bazy — przeciw
   realnemu Postgresowi z §0.3 pkt 6, wg wzorca
   `tests/resultsVnext/okr/okrAttentionQueue.realdb.test.ts` (silny skip bez
   `DATABASE_URL`, `beforeAll` rzuca przy skonfigurowanej-ale-nieosiągalnej
   bazie, unikalny tag org/user per przebieg, `afterAll` kasuje **wyłącznie
   własne** wiersze), z **jednorazowym kontenerem** i **sprzątaniem kontenera
   I wolumenów**.
7. **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
   i asertuje `expect(source).toContain('...')`, **nie liczy się do DoD**.
   Grep-test wolno dołożyć jako dodatek, nigdy jako dowód.
8. **Zero UI.** `git diff --name-only codex/m03-admin-20260824...HEAD` nie
   zawiera **żadnego** `.tsx` ani `public/locales/*`.
9. **Migracja (jeśli jest) spełnia §0.3 pkt 1–7**, ma dowód idempotencji i wpis
   `KOMPATYBILNOŚĆ_WSTECZ`. Plik przepuszczony przez `prettier` przed commitem.
10. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód`.

**Zakaz atrap na poziomie pozycji:** endpoint, który istnieje, ale nie robi
tego, co deklaruje kontrakt (zwraca stałą, ignoruje parametr, gubi rodzinę,
udaje historię) = **STOP**, nie „placebo do dopracowania później".

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu

**Lekcja z odbioru dnia 2:** raport deklarował „N/N PASS", ale liczone było
wyłącznie na plikach własnych; równolegle 27 testów w cudzych modułach było
czerwonych.
**Lekcja z odbioru dnia 12 (`DEC-73`):** 19 czerwonych testów **wprowadzonych
przez dyżur** zaraportowano jako „zastane". Tego błędu nie powtarzasz.

1. Wypisz **wszystkie** pliki, które dotknąłeś:
   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```
2. Z tej listy wyodrębnij pliki **współdzielone** (importuje je ktoś spoza
   Twojego zakresu). W tym dyżurze z definicji są to:
   ```
   server/src/Gateway.ts                                  ← montuje CAŁY serwer
   server/src/routes/resultsVnext/kpi.routes.ts           ← karta KPI, wielu konsumentów
   server/src/routes/resultsVnext/okr.routes.ts           ← 3 439 l., wielu konsumentów
   server/src/services/resultsVnext/okr/okrAttentionRepository.ts   ← wspólny read-model uwagi
   server/src/routes/pmo/initiativesExecutionRuntime.routes.ts      ← 5 843 l., runtime v1
   server/src/services/managementReportsService.ts        ← drugi pipeline raportowy
   server/src/repositories/managementReportRepository.ts
   src/components/ResultsVNext/kpiApi.ts · okr/okrApi.ts  ← klienci Results
   src/services/initiatives-execution/runtimeApi.ts       ← klient runtime
   ```
   Konsumentów sprawdzasz **jawnie, nie z pamięci**:
   ```bash
   grep -rln "okrAttentionRepository" server/src/ tests/ | head -20
   grep -rln "managementReportsService\|managementReportRepository" server/src/ tests/ | head -20
   grep -rln "initiatives-execution/runtimeApi" src/ | wc -l
   grep -rln "ResultsVNext/kpiApi\|okr/okrApi" src/ | head -20
   ```
3. **★ POMIAR STANU WEJŚCIOWEGO — obowiązkowy, PRZED pierwszą zmianą.**
   Uruchom katalogi konsumentów **na czystym tipie** i **zapisz wyniki**:
   ```bash
   npx vitest run server/src/routes/resultsVnext/__tests__          > /tmp/day17-before-1.txt 2>&1
   npx vitest run server/src/services/resultsVnext                  > /tmp/day17-before-2.txt 2>&1
   npx vitest run tests/unit/execution                              > /tmp/day17-before-3.txt 2>&1
   npx vitest run tests/unit/initiatives-execution                  > /tmp/day17-before-4.txt 2>&1
   npx vitest run server/src/domain/initiatives-execution/__tests__ > /tmp/day17-before-5.txt 2>&1
   npx vitest run tests/resultsVnext/okr                            > /tmp/day17-before-6.txt 2>&1
   ```
   **Znane, ZASTANE czerwone** (raport dnia 14 potwierdził je niezależnie —
   potwierdź u siebie i wpisz jako `STAN_WEJŚCIOWY`):
   - `server/src/services/resultsVnext` → **2 FAIL** (inwentarz ROI, m.in. Flow
     Transform),
   - `tests/unit/execution` → **4 FAIL** w `benefitsRegisterService.test.ts`
     (`Unhandled dbRun SQL: INSERT INTO initiative_benefits (...)`),
   - `tests/unit/initiatives-execution` → **1 FAIL**.
4. **Po pracy uruchom te same katalogi ponownie** i podaj **deltę**, nie liczby
   bezwzględne:
   ```
   | Katalog | PRZED | PO | Delta | Werdykt |
   ```
   Każdy nowy FAIL = **STOP**, nie „zastane". Jeżeli nie umiesz udowodnić, że
   FAIL był przed Twoją zmianą — traktujesz go jako wprowadzony przez siebie.
5. **W raporcie deklarujesz zasięg jawnie**: `ZASIĘG PEŁNY` (uruchomiłeś
   katalogi konsumentów wszystkich dotkniętych plików współdzielonych, z PRZED/
   PO) albo `ZASIĘG CZĘŚCIOWY` — **i wtedy piszesz wprost, czego nie uruchomiłeś
   i dlaczego.**

**To nie jest pełny `vitest` repo** (nadal zakazany — §0.3). To jest pomiar
celowany: katalogi konsumentów tego, co ruszyłeś.

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**

**STOP z opisem jest WARTOŚCIĄ tego dyżuru. Zgadywanie jest FAIL-em.**
Dyżur 14 dostał `SUPERVISOR_ACCEPT_CONDITIONAL` właśnie dlatego, że zamiast
siedmiu atrap oddał trzy realne pozycje i uczciwe STOP-y. Ta sama miara
obowiązuje Ciebie.

Konkretnie zatrzymujesz się i opisujesz problem, gdy:

- musiałbyś **zaszyć próg, wagę, taksonomię albo SLA** z `E-O3`/`E-O4`/`E-O5`
  (Z12) — parametryzujesz albo STOP, nigdy „rozsądna wartość domyślna";
- musiałbyś **zgadnąć kształt danych, których w bazie nie ma.** Wtedy endpoint
  **nie powstaje**; wpis `BRAK_ŹRÓDŁA` z pełną tabelą (co jest potrzebne, gdzie
  tego nie ma, co trzeba by dobudować) jest **wynikiem pełnowartościowym**;
- musiałbyś **osłabić albo usunąć asercję w teście istniejącym wcześniej** —
  w tym dyżurze **nie ma ani jednego dopuszczalnego przypadku** (§T.1);
- musiałbyś **zmienić kontrakt** `atomicWrite.ts`, `visibilityScopedQuery.ts`,
  `resourceTypes.ts`, `reportRun.ts`, `okrCheckInScheduler.ts` albo
  `effectiveAccessService.ts`. Wolno je **wołać**; zmiana = STOP;
- musiałbyś dodać migrację **nieaddytywną** albo łamiącą kompatybilność wstecz
  z zamrożonym demo (§0.3 pkt 4);
- musiałbyś **stworzyć flagę funkcyjną albo zmienić wartość istniejącej** (Z11);
- musiałbyś **dotknąć pliku `.tsx`**, katalogu `public/locales` albo
  jakiegokolwiek komponentu (Z10) — to nie jest „mała rzecz", to jest STOP;
- musiałbyś **podpiąć dostawcę AI** albo zbudować generowanie treści modelem
  (Z15);
- musiałbyś dotknąć czegokolwiek spoza ramki „WOLNO" (Z17) — w szczególności
  pliku należącego do równoległego strumienia (§1.4);
- **test nie przechodzi i naprawa wymagałaby zmiany GLOBALNEGO mocka lub
  configu vitest (Z18)** — STOP zawsze, bez „addytywnie, więc nic nie zepsuje";
- **pomiar zasięgu (§0.4a) pokazał czerwone testy, których nie było na
  wejściu** — nie „naprawiasz" ich po cichu i nie nazywasz „zastanymi":
  opisujesz, który commit je zapalił;
- musiałbyś wykonać **jakąkolwiek operację w chmurze** (Z8, `DEC-65`);
- **napotkałeś zmianę, którą robi równolegle inny dyżur** (§1.4) — nie
  dublujesz, tylko odnotowujesz jako `COORDINATION_REQUIRED`.

Format wpisu STOP w raporcie:

```
### STOP — <pozycja>
Powód: <jedno zdanie>
Dowód: <plik:linia lub komenda + wynik>
Czego brakuje, żeby ruszyć: <konkretna decyzja lub konkretne dane>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
```

---

## 1. KONTEKST — co się wydarzyło i gdzie jesteśmy

### 1.1. Skąd bierze się ten dyżur

Dyżury 8 (Results, front) i 11 (Execution, front) miały twardy zakaz zmian po
stronie serwera i oba skończyły się listą pozycji `BRAK_API`. Nadzorca
zweryfikował je grepem i uznał za prawdziwe (`DEC-61`: „STOP-y R.4/R.6/R.7
PRAWDZIWE (grep potwierdził, zero atrap)"; `DEC-72`: „szkielet uczciwy, 7 STOP-ów
zasadnych, zero zaszytych wag").

Dyżur 14 dostał je wszystkie do zamknięcia od strony serwera. **Zamknął trzy:**

| Pozycja | Status dnia 14      | Commit       | Co zostało w bazie                                     |
| ------- | ------------------- | ------------ | ------------------------------------------------------ |
| `S.1`   | **ZROBIONE_WG_DoD** | `cd83a3e3c0` | `/api/vnext/results/search`, CTE per rodzaj, kursor    |
| `S.2`   | CZĘŚCIOWO           | `d176e7ec4b` | `q=` w SQL dla KPI i OKR; **ROI zostało — patrz §1.4** |
| `K.1`   | CZĘŚCIOWO           | `8a5cb824db` | `GET /kpi/:kpiId/trend` + `kpiTrend.ts`, 6 geometrii   |
| `X.3b`  | CZĘŚCIOWO           | `6a441ca32c` | `sources: []` → `NO_SOURCES` w walidacji runu          |

`DEC-2026-08-26-77` (odbiór dnia 14) brzmi:

> Odbiór niezależny potwierdził bit-for-bit: **S.1 search ZROBIONE**
> (tenant-izolacja z tokenu, CTE scoped, ILIKE escaped, 7 testów+RealPG),
> **K.1 trend solidny read-model** (brak testów HTTP/tenant/realdb — dozbroić),
> **X.3b realne**. Zero atrap/dziur tenant/naruszeń Z. Merge do m03 DOZWOLONY
> dla zadeklarowanego zakresu. LICENCJA: rozszerzam Z17 o
> `resultsVnextRoi.validators.ts` — domknięcie ROI q-filter (S.2) to mechanika.
> **Reszta DoD (K.2/K.3/O.1/O.2/X.1/X.2/X.4) = kolejny dyżur backendowy.**

**Ten dyżur to jest ten „kolejny dyżur backendowy". Siedem pozycji, nic więcej.**

### 1.2. Dokumenty wiążące merytorycznie

Wszystkie są w Twoim worktree — **nie potrzebujesz żadnej innej gałęzi**:

| Dokument                                                                                    | Po co Ci jest                                                                                          |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `docs/program/waves/WAVE_03_ACCEPTANCE/RESULTS_EXECUTION_DAY14_REPORT_20260826.md` (161 l.) | **stan wyjściowy**: co zrobiono, jakie STOP-y, jakie znaleziska, jakie testy PRZED/PO                  |
| `docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md` (115 l.)    | rejestr odbiorowy Results, uwagi `RES-OWN-001..008`                                                    |
| `docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md` (308 l.)  | kontrakty `EXE-*-REPORT-01`; **linia 258 = osiem rodzin KPI (§X.4)**; `:264` DoD „each KPI reconciles" |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`                 | decyzje `DEC-61`, `-62`, `-63`, `-65`, `-72`, `-77`, `-86`                                             |
| `docs/program/waves/WAVE_03_ACCEPTANCE/EXECUTION_DAY11_REPORT_20260825.md`                  | źródło pozycji §X — wymagania, nie kod do skopiowania                                                  |
| `CLAUDE.md`                                                                                 | reguły 7 i 9, złote reguły (weryfikuj REALNY runtime, nie docy)                                        |

Raport dnia 8 (Results) leży na gałęzi **niescalonej**. **Nie jest Ci
potrzebny** — jego treść w zakresie Twoich pozycji jest przepisana do §K i §O
poniżej. **Nie przełączasz gałęzi, nie mergujesz, nie cherry-pickujesz.**

### 1.3. Decyzje wiążące

| Decyzja                 | Co z niej wynika DLA CIEBIE                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`DEC-2026-08-25-61`** | Karta KPI: „2/6 elementów nagłówka = uczciwe `BRAK_API` (trend, **następny obowiązek**)". Trend zrobił dzień 14 (`K.1`). **Następny obowiązek to Twoja pozycja §K.3.** „Historia i rodowód → `BRAK_API`" → **Twoja pozycja §K.2.**                                                                                                                                           |
| **`DEC-2026-08-25-62`** | (c) `R.6-O1`: link do wspólnej `/attention` **bez filtrowania klienckiego** — „Set-scoped filtr = **przyszły backend**" → **Twoja pozycja §O.1.** (d) `R.6-O2`: klient dostał licencję na read-only agregację per-KR → Ty budujesz **agregat po stronie serwera**, żeby nie było dwóch prawd → **Twoja pozycja §O.2.**                                                       |
| **`DEC-2026-08-25-63`** | (1) Flaga `execReportsIntelligence` — istnieje, default OFF wszędzie, **NIE RUSZASZ** (Z11). (2) **Kanoniczny backend**: `runtime-v1 report-runs` = SSOT niezmiennej publikacji; `management-reports` = pipeline eksportowy. „Rozszerzenia backendu tylko jeśli instrukcja je przewidziała" — ta instrukcja przewiduje je imiennie w §X.1, §X.2, §X.4 i **nigdzie indziej**. |
| **`DEC-2026-08-25-65`** | FREEZE: zero chmury, zero zdalnych migracji, `MIGRATION_PREPARED` / `REMOTE_EXECUTION_NOT_AUTHORIZED`, **wspólna baza** → kompatybilność wstecz obowiązkowa. Kolizje → `COORDINATION_REQUIRED`, nie samodzielne rozwiązywanie.                                                                                                                                               |
| **`DEC-2026-08-25-72`** | Do Piotra poszły **tylko trzy rzeczy**: `E-O3` (BSC), `E-O4` (wagi impact), progi saturacji z `E-O5`. **Piotr nie odpowiedział.** Wszystko, co od nich zależy, **parametryzujesz** (Z12). Decyzja pochwaliła „zero zaszytych wag" — nie psuj tego.                                                                                                                           |
| **`DEC-2026-08-26-77`** | Definiuje **dokładny zakres tego dyżuru**: `K.2/K.3/O.1/O.2/X.1/X.2/X.4`. Licencja na ROI q-filter (`S.2`) dotyczy **innego wykonawcy** (§1.4) — **nie Twoja**.                                                                                                                                                                                                              |
| **`DEC-2026-08-26-86`** | (1) Symlink `node_modules` autoryzowany dla **wszystkich** dyżurów (§0.1 pkt 6). (2) **Reguła ogólna: instrukcja NIE podaje numeru migracji** — wykonawca wyznacza „najwyższy istniejący + 1" i sprawdza `ls server/migrations \| grep '^<numer>'` przed każdym plikiem (§0.1 pkt 7).                                                                                        |

### 1.4. ★ KOORDYNACJA — czego NIE dublujesz i czego NIE dotykasz

**★ To jest najważniejsza sekcja przed rozpoczęciem pracy. Naruszenie =
konflikt w merge'u i zmarnowana praca dwóch dyżurów.**

**(a) `codex/day14-dozbrojenie-20260826` — RÓWNOLEGLE, W TRAKCIE.**
Wewnętrzny robotnik **w tej chwili** dokłada dwie rzeczy zamówione przez
`DEC-77`:

1. **testy HTTP / tenant / realdb do `K.1` (trend)** — pisze w
   `server/src/routes/resultsVnext/__tests__/kpi.routes.test.ts` oraz
   w nowych plikach testowych trendu;
2. **domknięcie `S.2` — ROI q-filter** — `roi.routes.ts`,
   `server/src/validators/resultsVnextRoi.validators.ts`, ROI-owa część
   `resultsSearchRepository.ts`, testy ROI.

**OBIE TE RZECZY SĄ WYKLUCZONE Z ZAKRESU DNIA 17.** Nie piszesz testów do
`K.1`. Nie dotykasz `kpiTrend.ts` ani jego testów. Nie dotykasz
`kpi.routes.test.ts`. Nie dotykasz ROI (`roi.routes.ts`,
`resultsVnextRoi.validators.ts`, `roiLegacyArchive.routes.ts`,
`roiPerspectives.routes.ts`, `textMatch.ts`, `resultsSearchRepository.ts`).
**Nie „poprawiasz przy okazji" trendu ani wyszukiwania.**

Sprawdzasz stan w Bloku 0 i wynik idzie do raportu:

```bash
git log --oneline codex/m03-admin-20260824..codex/day14-dozbrojenie-20260826 | head -20
git diff --name-only codex/m03-admin-20260824...codex/day14-dozbrojenie-20260826
```

Jeżeli któryś z tych plików pojawi się w **Twoim** `git diff --name-only` —
to jest błąd, cofasz zmianę i wpisujesz do „Korekt".

**Konsekwencja praktyczna dla §K.2/§K.3:** Twoje nowe trasy KPI idą do
`kpi.routes.ts` (kod), ale Twoje **testy** idą do **NOWYCH plików**
(np. `server/src/routes/resultsVnext/__tests__/kpiHistory.routes.test.ts`),
nigdy do `kpi.routes.test.ts`. To jedyna droga, żeby oba strumienie scaliły się
bez konfliktu.

**(b) Dzień 16 (Meetings) — `codex/meetings-day16-r2-20260826`, `codex/day16-fixes-20260826`.**
Niescalone. Zarezerwowały numer migracji `20261075_meetings_day16_*`. Nie
dotyczą Twojego obszaru **poza numeracją migracji** — uwzględniasz je
w wyznaczaniu numeru (§0.1 pkt 7). Nie dotykasz ich gałęzi ani worktree.

**(c) `X.3a` i część „lifecycle → eksport" pozycji `X.3` — POZA ZAKRESEM.**
Dzień 14 nie zrobił `X.3a` (read-model realnych `sources` dla definicji
raportu) ani mapowania lifecycle → eksport. `DEC-77` **nie wymieniła ich**
w zakresie dnia 17. **Nie robisz ich.** Jeżeli w trakcie §X.1 albo §X.2
okaże się, że któraś z nich jest twardym prerekwizytem — **STOP z opisem**
(„`X.1` nie da się domknąć bez `X.3a`, bo …"), nie samodzielne rozszerzenie
zakresu. Świadomie: `X.1` jest zaprojektowane tak, żeby **nie** zależało od
`X.3a` (to `X.3a` w przyszłości będzie delegować do `X.1`, nie odwrotnie).

**(d) Powierzchnie wizualne wszystkich siedmiu pozycji** — patrz sekcja
**„POZA ZAKRESEM (front wewnętrzny)"**. Robi je osobny tor, po prototypie
i akcepcie. Nie budujesz ich, nie „przygotowujesz", nie dodajesz kluczy i18n.

**(e) Poprawki `F1-F12` dnia 11 (klient Execution)** — `.tsx`, Z10. Jeżeli Twój
read-model dostarcza dane, które te poprawki liczą po stronie klienta,
**odnotuj to w raporcie** jako „kandydat do przeniesienia na serwer w kolejnym
dyżurze" — i **nie przenoś** tego teraz.

Jeżeli wykryjesz, że któraś z Twoich pozycji już powstała na innej gałęzi —
**`COORDINATION_REQUIRED`** w raporcie: nie merge, nie cherry-pick, nie „zrobię
swoją wersję obok".

### 1.5. ★ Znane pułapki — przeczytaj, zanim zaczniesz

1. **★ `okr_vnext_checkin_occurrences` ISTNIEJE — kadencji check-inów NIE
   WYMYŚLASZ.** Instrukcja dnia 14 dopuszczała `BRAK_ŹRÓDŁA` dla kadencji
   check-inów OKR. **To założenie jest nieaktualne** — zweryfikowano przed
   wystawieniem tej instrukcji:
   `server/src/services/resultsVnext/okr/okrCheckInScheduler.ts` (`OKR-E004 —
Obligation seeding + missed-cadence detection`) czyta
   `okr_vnext_checkin_occurrences (cadence_occurrence_id, window_end)`
   z migracji `20260825_rvn_okr_checkin.sql` i sadzi z niej obowiązki
   w `rvn_platform_obligations`. **To jest źródło `nextExpectedAt` dla §O.2.**
   Potwierdź to sam w Bloku 0:

   ```bash
   grep -n "okr_vnext_checkin_occurrences\|window_end\|cadence_occurrence_id" \
     server/src/services/resultsVnext/okr/okrCheckInScheduler.ts | head
   grep -n "checkin_occurrences" server/migrations/20260825_rvn_okr_checkin.sql | head
   ```

   Jeżeli mimo to okaże się, że dla konkretnego KR kadencji nie ma — `UNKNOWN`
   - `NO_CADENCE_CONFIGURED`, nigdy wymyślona częstotliwość.

2. **★ `okrCheckInScheduler.ts` ma pułapkę rzutowania i sam ją dokumentuje.**
   `.cadence_occurrence_id` jest `TEXT` w jednej tabeli i `UUID` w drugiej —
   złączenie wymaga `::text` (`okrCheckInScheduler.ts:206-215`). To samo
   dotyczy `rvn_visible_resources.resource_id` (`TEXT`) vs
   `okr_vnext_sets.set_id` (`UUID`). **To jest najczęściej powtarzany realny
   bug tego programu.** Jeśli Twój test `realdb` zwraca pustkę „bez powodu" —
   to jest pierwsza rzecz do sprawdzenia.

3. **`rvn_platform_management_chain_closure` nie jest w pełni zasilany.**
   Nagłówek `okrAttentionRepository.ts` mówi to wprost („ACKNOWLEDGED, UNFIXED
   GAP"): nie istnieje `getManagementChain(userId)`, a tabela domknięcia
   łańcucha zarządczego nie ma pełnego producenta. **Nie naprawiasz tego** —
   ale ponieważ §O.1 opiera się o `chain_members`, **musisz to powtórzyć
   w kontrakcie odpowiedzi**: `scopeCompleteness: 'PARTIAL_MANAGEMENT_CHAIN'`.
   Milczące udawanie pełnego zasięgu = atrapa.

4. **Schemat pod „następny obowiązek" JUŻ ISTNIEJE — nie budujesz go od nowa.**
   - `server/migrations/20260811_rvn_platform_obligations.sql` — tabela
     `rvn_platform_obligations` z kolumnami `organization_id`,
     `assignee_user_id`, `reference_type`, `reference_id`, `obligation_type`,
     `due_at TIMESTAMPTZ NULL`, `status` (`CHECK IN
('open','completed','cancelled','superseded')`), `deduplication_key`,
     `UNIQUE (organization_id, deduplication_key)`, indeksy po
     `(organization_id, assignee_user_id, status)` i
     `(organization_id, reference_type, reference_id)`;
   - `server/migrations/20260813_rvn_kpi_measurement_cadence.sql` — kolumna
     `rvn_kpi_definition_versions.measurement_frequency_days INT NULL`
     (`CHECK > 0`), czytana przez `branch_update_due_heuristic`
     w `kpiPerspectivesRepository.ts`.

   **§K.3 to read-model nad istniejącym schematem, bez nowej tabeli.** Jeżeli
   po sprawdzeniu okaże się, że kolumna jest jednak potrzebna — najpierw
   uzasadnij w raporcie, dlaczego istniejące nie wystarczają, **potem** pisz
   migrację.

5. **Historia OKR ma gotowy wzorzec, KPI nie ma.**
   `GET /api/vnext/results/okr/sets/:setId/history` (`okr.routes.ts:2923-2930`,
   repozytorium `okrSetHistoryRepository.ts:106`) czyta wspólny
   `rvn_platform_events` (`20260809_rvn_platform_events_outbox.sql`) kolumnami
   `event_id, sequence, event_type, actor_user_id, actor_effective_role,
occurred_at, reason, payload` i paginuje **keysetem po `sequence`**
   (`nextCursor = ostatni sequence strony`, `okrSetHistoryRepository.ts:77-89,
147-160`). **To jest wzorzec strukturalny §K.2. Kopiujesz kształt, nie
   treść.**

6. **★ `management-reports` ma dziurę tenantową — i to na dwa sposoby.**
   - `managementReportsService.getReport(reportId)` (`:891`) woła
     `managementReportRepository.getReportById(reportId)`
     (`managementReportRepository.ts:46-58`) → `SELECT * FROM
management_reports WHERE id = ?` **bez `organization_id`**.
     `generateExport` (`:1121`) na tym stoi.
   - **Gorsze:** trasy w `managementReports.routes.ts` biorą organizację jako
     `req.organizationId || req.body.organizationId` (`:40`) oraz
     `req.organizationId || (req.query.organizationId as string)` (`:90`) —
     czyli **z żądania**, gdy token jej nie niesie. To jest wprost sprzeczne
     z DoD §0.4 pkt 3.

   **Pierwsze naprawiasz w zakresie §X.2** (to Twój endpoint).
   **Drugie: na trasach, których dotykasz (`/:id/pdf`, `/:id/pptx`,
   `/:id/xlsx`) organizacja MUSI pochodzić z tokenu, bez fallbacku na
   query/body.** Fallbacku na pozostałych trasach **nie ruszasz** — wpisujesz
   do „Znaleziska — nie naprawiane" z pełną listą linii.

7. **`bulkExport` (`managementReportsService.ts:1173-1180`) NIE TWORZY PLIKU** —
   zwraca ścieżkę do zipa, który nigdy nie powstaje. To znane, zaraportowane
   znalezisko dnia 14. **Nie naprawiasz i nie dokładasz do niego `xlsx`** —
   dołożenie formatu **pogłębiłoby** atrapę.

8. **`xlsx` z `package.json` to tarball z CDN** (`package.json:429`,
   `https://cdn.sheetjs.com/...`). W FREEZE nie masz gwarancji instalacji
   z sieci. **Do §X.2 używasz `exceljs`** (`package.json:355`, `^4.4.0`,
   zwykła zależność z rejestru), tym samym wzorcem leniwego importu
   i `dependencyMissing`, którym `managementReportsService.ts:23-46` ładuje
   `pdfkit`/`pptxgenjs`.

9. **`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE`.**
   `resultsInternalBetaVisibility.middleware.ts:26-33` przepuszcza żądania
   w `NODE_ENV=test`, **chyba że** ustawisz
   `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`. Twój test negatywu
   tenanta dla Results **musi** działać w trybie `enforce` — inaczej dowodzi
   nieprawdy. Wpisz do raportu, że test go ustawia. (Dzień 14 to zrobił
   poprawnie — powtarzasz wzorzec.)

10. **`executionControl.routes.ts:1007-1011` — udokumentowany mismatch kształtu**
    (`getLevelingAlerts`/`getOverloadAlerts`), przez który alerty wydajności
    wychodzą puste. Znalezisko dnia 11, powtórzone przez dzień 14. **Nie
    naprawiasz.** Jeżeli rodzina `capacity` w §X.4 opiera się o to źródło →
    `scopeCompleteness: 'PARTIAL'` i wpis do raportu.

11. **`404 zamiast 403` przy braku widoczności w runtime-v1 jest CELOWE**
    (`initiativesExecutionRuntime.routes.ts`, wzorzec przy `canViewAggregate`)
    — nie ujawnia istnienia cudzego zasobu. **Powielasz to, nie „poprawiasz".**

12. **Nowa ścieżka pod `/report-runs/*` musi trafić do mapy widoczności**
    (`initiativesExecutionRuntime.routes.ts:1278-1290`,
    `path.startsWith('/report-runs/')`). Bez tego Twój endpoint będzie **poza
    kontrolą projektową**. To jedyna dozwolona zmiana w tym bloku.

### 1.6. Pozycje otwarte — czego NIE ZGADUJESZ

| #   | Kwestia                                                               | Status                                                                                                                                                 |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `E-O3` — taksonomia i mapowania BSC                                   | **U Piotra** (`DEC-72`). Nie budujesz mapowań                                                                                                          |
| 2   | `E-O4` — wagi wpływu, próg at-risk, SLA decyzji                       | **U Piotra**. Parametryzujesz (§X.4)                                                                                                                   |
| 3   | `E-O5` — próg saturacji, bufor, źródło dostępności                    | **U Piotra** + częściowy brak źródła. Parametryzujesz próg; brak źródła = `BRAK_ŹRÓDŁA`                                                                |
| 4   | `E-O7` część AI (`FACT`/`INFERENCE`/`RECOMMENDATION`)                 | **Czeka na klucz dostawcy** (`DEC-59`). Robisz **tylko** eksport XLSX (§X.2), zero AI                                                                  |
| 5   | Czy `overdue`/`staleness` mają wchodzić do wspólnej tabeli obowiązków | **Nie decydujesz.** §K.3 i §O.2 są **read-only** — nie zapisują obowiązków. Zapis obowiązków ma swojego producenta (`okrCheckInScheduler`) i to nie Ty |
| 6   | Czy `X.4` ma dostać własny prefiks montażu w Gateway                  | **Decyzja techniczna, Twoja** — z uzasadnieniem w raporcie (§2.4). Domyślnie: dziecko istniejącego routera runtime, bez nowego montażu                 |

---

## 2. MAPA TECHNICZNA — skrót niezbędny

**Wszystkie liczby i numery linii zweryfikowano na tipie
`codex/m03-admin-20260824` w chwili wystawiania instrukcji. Mapa starzeje się
w ~3 dni.** Blok 0 każe Ci ją zweryfikować i pracować na stanie faktycznym;
każdą rozbieżność wpisujesz do „Korekt wobec instrukcji". Rozbieżność ±kilka
linii — pracuj dalej. Rozbieżność rzędu setek linii albo brak pliku = **STOP**.

### 2.1. Rozmiar obszaru — żebyś wiedział, w co wchodzisz

```bash
wc -l server/src/routes/resultsVnext/kpi.routes.ts                   # 1 150
wc -l server/src/routes/resultsVnext/okr.routes.ts                   # 3 439
wc -l server/src/routes/pmo/initiativesExecutionRuntime.routes.ts    # 5 843
wc -l server/src/routes/managementReports.routes.ts                  # 460
wc -l server/src/services/managementReportsService.ts                # 1 538
wc -l server/src/repositories/managementReportRepository.ts          # 742
wc -l server/src/routes/executionControl.routes.ts                   # 1 085
wc -l server/src/routes/executionAnalytics.routes.ts                 # 311
wc -l server/src/domain/initiatives-execution/reportRun.ts           # 311
```

### 2.2. Kanoniczny wzorzec tenant-izolacji Results vNext

To jest **jedyny** dozwolony wzorzec dla nowych tras Results. Źródło:
`server/src/routes/resultsVnext/kpi.routes.ts`.

```ts
// łańcuch middleware — kolejność jest istotna (kpi.routes.ts:145-158)
router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireActiveMembership); // ← twardy mur członkostwa per request
router.use(requireOrgAccess());
router.use(requireResultsInternalBetaVisibility);
router.use(demoContextMiddleware);
```

Komentarz w tym pliku tłumaczy, dlaczego `requireActiveMembership` **nie jest
nadmiarowy**: `requireOrgAccess()` nie ma ani jednego odwołania do
`organization_members` — zweryfikowano na realnym serwerze i realnym
Postgresie, że po odebraniu członkostwa router nadal obsługiwał żądania na tym
samym tokenie. **Twoje trasy §K.2/§K.3/§O.1/§O.2 są dziećmi istniejących
routerów, więc dziedziczą ten łańcuch — sprawdź to i potwierdź w raporcie.**

Dalej, w każdym handlerze:

```ts
const auth = requireAuth(req, res); // kpi.routes.ts:172 — org i user WYŁĄCZNIE z req.user
if (!auth) return;
```

I dla każdego odczytu dotykającego zasobów objętych widocznością:

```ts
const cte = await buildVisibilityScopedCte({
  userId: auth.userId,
  organizationId: auth.organizationId,
  resourceType: 'kpi', // wartość z RVN_RESOURCE_TYPES
});
// cte.sql + cte.values → prefiks Twojego zapytania
```

`RVN_RESOURCE_TYPES`
(`server/src/services/resultsVnext/platform/resourceTypes.ts`) to **jedyne**
źródło nazw typów zasobów (`kpi`, `roi_case`, `okr_set`, `deviation_case`,
`kpi_scorecard`, `okr_program`, `okr_cycle`, …). **Nie dopisujesz nowego typu**
— to zmiana SSOT dzielona z `myWorkRoofPackage.ts` (STOP).

### 2.3. Kanoniczny wzorzec tenant-izolacji Execution runtime

Źródło: `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`.

```ts
const actor = actorFromRequest(req); // :1120
if (!actor) {
  res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
  return;
}

// odczyt listy:
const items = await deps.reader.listReportRuns(actor.organizationId);
res.json({
  items: await filterVisibleAggregates(actor, items, 'report_run', (i: any) => i.reportRunId),
});

// odczyt pojedynczego — 404, nie 403, gdy brak widoczności:
if (!(await canViewAggregate(actor, 'report_run', id))) {
  res.status(404).json({ error: { code: 'NOT_FOUND' } });
  return;
}
```

Trasy runu, obok których dokładasz swoje: `'/report-runs/:reportRunId'`
(`:4654`), `'/report-runs/:reportRunId/transitions'` (`:4695`).
Mapa widoczności per ścieżka: `:1278-1290`.

### 2.4. Montaż w Gateway

`server/src/Gateway.ts` montuje routery w porządku **„bardziej szczegółowy
prefiks NAJPIERW"** (por. `:1244` — `app.use('/api/vnext/results/search',
resultsVnextSearchRoutes)` zarejestrowany **przed** krótszym prefiksem KPI,
bo `resultsVnextKpiRoutes` jest właścicielem `GET /:kpiId`).

**Wszystkie Twoje trasy Results (§K.2, §K.3, §O.1, §O.2) są dziećmi
istniejących routerów** (`kpi.routes.ts`, `okr.routes.ts`) — **nie zakładasz
dla nich osobnego montażu i nie dotykasz `Gateway.ts`**.

**§X.1 i §X.4** idą do `initiativesExecutionRuntime.routes.ts` — też bez
zmiany montażu. Jeżeli uznasz, że `§X.4` zasługuje na własny prefiks —
uzasadnij w raporcie **przed** zmianą `Gateway.ts`, a do każdego nowego
`app.use` dopisz komentarz w stylu istniejących (dlaczego ten prefiks,
dlaczego w tym miejscu kolejności).

**§X.2** dokłada trasę do już zamontowanego `/api/management-reports`
(`Gateway.ts:1196`). Uwaga na sąsiada: `/api/management-reports/analytics`
montowany jest **po** nim (`:1197`) i ma trasy jednosegmentowe (`/usage`,
`/types`) — Twoja `'/:id/xlsx'` jest dwusegmentowa, więc ich nie przesłania.
Sprawdź to jednak testem, zanim uznasz za pewnik.

### 2.5. Wzorzec testu `realdb`

Wzorzec do skopiowania: `tests/resultsVnext/okr/okrAttentionQueue.realdb.test.ts`.

Kluczowe elementy, których **nie wolno** uprościć:

```ts
function buildClientConfig(): ClientConfig | null {
  /* DATABASE_URL albo PGHOST/... ; null gdy brak */
}
const DB_CONFIGURED = buildClientConfig() !== null;

// unikalny tag per przebieg — żaden wiersz nie koliduje z cudzym dowodem
const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `day17-<pozycja>-org-${tag}`;

// POLITYKA SKIP: cichy no-op bez skonfigurowanej bazy;
// beforeAll RZUCA, gdy baza skonfigurowana, ale nieosiągalna.
```

`afterAll` kasuje **wyłącznie** wiersze z własnym `tag`. Zero `TRUNCATE`, zero
`DELETE FROM ... WHERE organization_id IS NOT NULL`, zero czyszczenia „przy
okazji". Po przebiegu wykazujesz w raporcie: **utworzono N / usunięto N /
delta 0**.

Uruchamiasz z `DATABASE_URL` wskazującym **wyłącznie** na kontener z §0.3
pkt 6 (port 5447). Wskazanie czegokolwiek innego = naruszenie Z9.

### 2.6. Testy zastane — co Cię pilnuje

```bash
ls server/src/routes/resultsVnext/__tests__/
ls server/src/services/resultsVnext/*/__tests__/ 2>/dev/null | head -40
ls server/src/domain/initiatives-execution/__tests__/
ls tests/resultsVnext/
```

Wynik tej enumeracji wklejasz do raportu (Blok 0). Każdy z tych testów jest
**strażnikiem**: jeśli Twoja zmiana go zapali, to nie jest „zastane", tylko
regresja (§0.4a pkt 4).

### 2.7. Czego w bazie NIE MA — sprawdzone przed wystawieniem instrukcji

Te komendy wykonano na tipie `codex/m03-admin-20260824`. **Powtórz je w Bloku 0**
— jeśli którakolwiek zwróci wynik, to znaczy, że pozycja już istnieje i Twoje
zadanie się zmienia (odnotuj i skoordynuj, §1.4).

```bash
# §K.2 / §K.3 — brak historii i brak następnego obowiązku na karcie KPI
grep -n "history\|lineage\|timeline" server/src/routes/resultsVnext/kpi.routes.ts   # oczekiwane: tylko komentarz
grep -n "obligation"                  server/src/routes/resultsVnext/kpi.routes.ts   # oczekiwane: PUSTO
grep -n "'/:kpiId/trend'"             server/src/routes/resultsVnext/kpi.routes.ts   # oczekiwane: :430 (dzień 14 — NIE RUSZASZ)

# §O.1 / §O.2 — brak Set-scoped attention i brak agregatu check-inów Setu
grep -n "'/attention'"                server/src/routes/resultsVnext/okr.routes.ts   # oczekiwane: :3425, bez parametrów
grep -n "check-in-summary"            server/src/routes/resultsVnext/okr.routes.ts   # oczekiwane: PUSTO
grep -n "ListOrganizationOkrAttentionParams" -A 4 \
  server/src/services/resultsVnext/okr/okrAttentionRepository.ts                     # oczekiwane: :257, TYLKO managerId + organizationId

# §X.1 — brak rekonstrukcji as-of
grep -rn "asOf\|reconstruct" server/src/domain/initiatives-execution/reportRun.ts    # oczekiwane: pole snapshotu, ZERO replay

# §X.2 — brak XLSX
grep -rn "xlsx\|exceljs" server/src/services/managementReportsService.ts             # oczekiwane: PUSTO
grep -rn "xlsx"          server/src/routes/managementReports.routes.ts               # oczekiwane: PUSTO
grep -n  "'/:id/pdf'\|'/:id/pptx'" server/src/routes/managementReports.routes.ts     # oczekiwane: :343, :377

# §X.4 — brak zunifikowanego read-modelu ośmiu rodzin
grep -rn "planDelivery\|interventionEffectiveness\|decisionLatency" server/src/routes/ | head
grep -rn "execution_control_kpi_polic" server/migrations/ server/src/ | head          # oczekiwane: PUSTO
```

Wyniki wklejasz do raportu jako tabelę `WERYFIKACJA_BRAKÓW`. **To jest
najważniejsza tabela Bloku 0** — bez niej nie wiadomo, czy Twoja praca czegoś
nie dubluje.

---

## §K. KARTA KPI — dwie pozycje (`R.5`, `DEC-61`)

**Skąd:** raport dnia 8, `R.5`: „Historia i rodowód → `BRAK_API`";
„właściciel, zakres, **następny obowiązek** → `JEST_CZĘŚCIOWO / BRAK_API`".
`DEC-61`: „2/6 elementów nagłówka = uczciwe `BRAK_API` (trend, następny
obowiązek)". Trend zamknął dzień 14 (`K.1`). Zostają te dwie.

### K.2 — Historia i rodowód KPI

**Cel:** jedna oś czasu obiektu KPI: zmiany cyklu życia, wersje definicji
(zgłoszenie / akceptacja / odrzucenie / rewizja), pomiary i ich korekty, zmiany
widoczności. Dziś każda z tych rzeczy siedzi w innej tabeli i karta nie ma skąd
wziąć wspólnego widoku.

**Kontrakt (wzorowany 1:1 na kształcie `GET /okr/sets/:setId/history`):**

```
GET /api/vnext/results/kpi/:kpiId/history?cursor=<c>&limit=<n>

200 → {
  entries: Array<{
    entryId: string,
    occurredAt: string,
    kind: 'LIFECYCLE' | 'DEFINITION_VERSION' | 'MEASUREMENT' | 'MEASUREMENT_CORRECTION' | 'VISIBILITY',
    summaryCode: string,          // kod maszynowy, np. 'KPI_ACTIVATED' — NIE tekst dla użytkownika
    actorUserId: string | null,
    sourceVersion: number,
    references: Record<string, string>   // { definitionVersionId } / { measurementId } itd.
  }>,
  nextCursor: string | null
}
```

**Wymagania twarde:**

1. **Zero tekstu dla użytkownika w odpowiedzi.** `summaryCode` jest kodem;
   napis powstanie po stronie UI, przez i18n. Zwrócenie polskiego albo
   angielskiego zdania z serwera = naruszenie Z10 tylnymi drzwiami.
2. **Źródło:** `rvn_platform_events`
   (`server/migrations/20260809_rvn_platform_events_outbox.sql`) filtrowane po
   `organization_id` **i** po agregacie. Wzorzec czytania zdarzeń:
   `okrSetHistoryRepository.ts:106-204` (kolumny `event_id, sequence,
event_type, actor_user_id, actor_effective_role, occurred_at, reason,
payload`). Dodatkowo tabele definicji/pomiarów tam, gdzie zdarzenie nie
   niesie kompletu — **jawnie opisz w nagłówku pliku, które wpisy skąd
   pochodzą**.
3. **Kursor keysetowy, nie offset.** Ten sam wzorzec co
   `okrSetHistoryRepository` (kursor = `sequence` ostatniego wiersza strony)
   albo co kursor `S.1` dnia 14 (base64url pary sortującej). Wybierasz jeden,
   uzasadniasz w nagłówku pliku, i **jest on stabilny przy równoległych
   zapisach** (dowodzisz testem trzech stron bez duplikatów i bez gubienia
   wpisów).
4. **Braki są jawne.** Jeżeli dla części historii nie ma zdarzeń (KPI sprzed
   wdrożenia outboxu), zwracasz to, co jest, i **nie dopowiadasz** — brak wpisu
   to brak wpisu, nie „utworzono".
5. **Widoczność jak przy odczycie KPI.** Brak widoczności KPI → **`404`**,
   nigdy `200` z pustą historią (pusta historia znaczy „nic się nie działo",
   a to nieprawda).
6. **Zero nowej tabeli i zero migracji.** Jeżeli uznasz, że brakuje danych
   źródłowych dla któregoś z pięciu rodzajów — **nie wymyślasz wpisu**:
   rodzaj po prostu nie występuje, a Ty wpisujesz do raportu tabelę
   `K.2 — pokrycie rodzajów` (rodzaj → źródło → czy jest → werdykt).

**DoD (poza §0.4):** test kolejności i kompletności na KPI z co najmniej po
jednym wpisie każdego z pięciu rodzajów (albo jawna tabela pokrycia, gdy
któregoś rodzaju nie da się wyprodukować); test kursora (3 strony, zero
duplikatów); **test HTTP realnego routera**; negatyw tenanta zwraca `404`,
nie `200 + []`; `realdb`.

**Definicja ukończenia jednym zdaniem:** karta KPI może pobrać jedną,
stronicowaną, maszynowo opisaną oś czasu obiektu ze wszystkich pięciu źródeł,
a cudzy KPI zwraca `404`.

### K.3 — Następny obowiązek dla KPI

**Cel:** karta ma odpowiedzieć na pytanie „co i kiedy właściciel musi z tym KPI
zrobić". **Schemat już istnieje — §1.5 pkt 4.** Budujesz read-model, nie
tabelę.

**Kontrakt:**

```
GET /api/vnext/results/kpi/:kpiId/next-obligation

200 → {
  kpiId: string,
  obligation: {
    obligationId: string,
    obligationType: string,          // z rvn_platform_obligations.obligation_type
    dueAt: string | null,
    status: 'open',
    assigneeUserId: string,
    overdue: boolean,
    source: 'OBLIGATION_ROW'
  } | null,
  derived: {                          // wypełniane TYLKO gdy obligation === null
    nextExpectedAt: string | null,
    basis: 'MEASUREMENT_FREQUENCY_DAYS',
    frequencyDays: number,
    lastMeasuredPeriodEnd: string
  } | null,
  reason: 'NO_CADENCE_CONFIGURED' | 'NO_MEASUREMENT_YET' | null,
  calculatedAt: string
}
```

**Wymagania twarde:**

1. **Kolejność źródeł jest sztywna i jawna.**
   (a) realny otwarty wiersz `rvn_platform_obligations` dla tego KPI
   (`reference_type` odpowiadający KPI, `reference_id = kpiId`,
   `status='open'`, najwcześniejszy `due_at`) → `obligation` wypełnione,
   `derived: null`;
   (b) brak wiersza, ale jest `measurement_frequency_days` i jest ostatni
   pomiar → `obligation: null`, `derived` wypełnione, **jawnie oznaczone jako
   pochodne** (`basis`);
   (c) brak jednego i drugiego → oba `null` + `reason`.
   **Nigdy nie mieszasz (a) i (b) w jedno pole.** Obowiązek zapisany
   i obowiązek wywnioskowany to dwie różne rzeczy i karta musi móc je
   rozróżnić.
2. **`overdue` liczysz na serwerze**, wobec `now()` serwera, i zwracasz
   `calculatedAt`. Klient nie ma prawa liczyć tego sam (strefy czasowe).
3. **Zero heurystyk poza (b).** `listMyKpis` ma własną gałąź
   `branch_update_due_heuristic` (opisaną w nagłówku
   `20260813_rvn_kpi_measurement_cadence.sql`) — **czytasz ją, żeby zachować
   spójność semantyki**, ale nic do niej nie dokładasz i jej nie zmieniasz.
4. **Read-only. Zero zapisu.** Nie sadzisz obowiązków, nie zamykasz ich, nie
   tworzysz `deduplication_key`. Producentem wierszy jest osobny scheduler
   i to nie Ty (§1.6 poz. 5).
5. **Zero migracji**, chyba że udowodnisz brak — wtedy uzasadnienie w raporcie
   **przed** napisaniem migracji.
6. **`reference_type` dla KPI nie zgadujesz.** Ustalasz go grepem po realnych
   producentach obowiązków i wpisujesz do raportu wraz z dowodem:
   ```bash
   grep -rn "reference_type" server/src/services/resultsVnext/ | grep -i kpi | head
   grep -rn "rvn_platform_obligations" server/src/ | grep -v __tests__ | head -20
   ```
   Jeśli **żaden** producent nie sadzi obowiązków dla KPI — to jest wynik:
   gałąź (a) zostaje zaimplementowana i przetestowana na wierszu wstawionym
   przez test, a do raportu idzie wpis „brak producenta obowiązków KPI
   w runtime" jako znalezisko.

**DoD (poza §0.4):** test dla każdego z trzech wariantów (a)/(b)/(c); test
`overdue` na wierszu z `due_at` w przeszłości; **test HTTP realnego routera**;
negatyw tenanta — obowiązek innej organizacji nie wycieka **nawet przez
`assigneeUserId`**; `realdb`.

**Definicja ukończenia jednym zdaniem:** karta KPI dostaje jeden obowiązek —
zapisany albo wywnioskowany, nigdy zlepiony — z serwerowo policzonym `overdue`
i uczciwym `reason`, gdy nie ma ani jednego, ani drugiego.

---

## §O. OKR — dwie pozycje (`R.6-O1c`, `R.6-O2`, `DEC-62`)

### O.1 — Attention w zasięgu jednego Setu

**Skąd:** raport dnia 8, `R.6-O1 — STOP`: „endpoint zwraca agregat
organizacyjny, nie płaską listę Setu. Filtrowanie po stronie klienta bez
zatwierdzonego klucza przynależności tworzyłoby **drugą prawdę**".
`DEC-62(c)`: „link do wspólnej `/attention` **BEZ filtrowania klienckiego**;
**Set-scoped filtr = przyszły backend**".

**Cel:** ten sam read-model uwagi, zawężony do jednego Setu **po stronie
serwera**, z tym samym kluczem przynależności, którego używa agregat
organizacyjny.

**Kontrakt:**

```
GET /api/vnext/results/okr/sets/:setId/attention

200 → {
  setId: string,
  attention: {
    staleCheckins: [...],                  // te same kształty co /attention
    lowConfidenceObjectives: [...],
    openSupportRequests: [...],
    openBlockers: [...],
    escalatedSets: [...]                   // 0 lub 1 element — ten Set albo nic
  },
  scopeCompleteness: 'FULL' | 'PARTIAL_MANAGEMENT_CHAIN',
  calculatedAt: string
}
```

**Wymagania twarde:**

1. **★ Jedna implementacja, dwa wejścia.** Rozszerzasz
   `server/src/services/resultsVnext/okr/okrAttentionRepository.ts`
   o **opcjonalny** parametr `setId` w `ListOrganizationOkrAttentionParams`
   (`:257-260`) i przekazujesz go do **wszystkich pięciu** pod-zapytań
   (`listStaleCheckinSets`, `listLowConfidenceObjectives`,
   `listOpenSupportRequests`, `listOpenBlockers`, `listEscalatedSets`,
   `:266-273`) jako dodatkowy filtr **wewnątrz ich SQL**. **Nie piszesz
   drugiego repozytorium** i **nie filtrujesz tablicy po pobraniu** — to jest
   dokładnie ta „druga prawda", której `DEC-62(c)` zabroniła, tylko przeniesiona
   o warstwę niżej.
2. **★ Istniejąca trasa `/attention` (`okr.routes.ts:3425`) zostaje bez
   zmian.** Wołanie `listOrganizationOkrAttention` **bez** `setId` musi zwrócić
   **dokładnie to samo, co dziś** — dowodzisz testem porównawczym (`DEC-65`:
   zamrożone demo woła tę trasę).
3. **`setId` walidowany i sprawdzany na widoczność.** Set spoza organizacji albo
   niewidoczny → **`404`** (wzorzec `handleOkrRouteError`). **Nigdy `200`
   z pustym agregatem** — pusty agregat znaczy „Set jest czysty", a to nieprawda.
4. **`scopeCompleteness` obowiązkowe.** Powód w §1.5 pkt 3: łańcuch zarządczy
   nie jest w pełni zasilany. Gdy zasięg opiera się o `chain_members`, zwracasz
   `'PARTIAL_MANAGEMENT_CHAIN'`. Milczenie = atrapa.
5. **Rzut `::text` na złączeniu widoczności** — §1.5 pkt 2, pułapka programu.

**DoD (poza §0.4):** **test rekoncyliacji** „suma po wszystkich Setach
organizacji = agregat organizacyjny" (to jest dowód, że nie ma dwóch prawd);
test „wywołanie bez `setId` = wynik sprzed zmiany"; **test HTTP realnego
routera**; test negatywu tenanta (cudzy `setId` → `404`); `realdb` na
wszystkich pięciu rodzajach sygnału.

**Definicja ukończenia jednym zdaniem:** ten sam repozytoryjny read-model uwagi
umie zawęzić się do jednego Setu w SQL, zgadza się z agregatem organizacyjnym
co do sumy i uczciwie deklaruje niepełny zasięg łańcucha zarządczego.

### O.2 — Agregat check-inów Setu po stronie serwera

**Skąd:** raport dnia 8, `R.6-O2 — STOP`: „read-only agregat ostatni/następny
check-in per KR (…). Zapis pozostaje przy KR, ponieważ API **nie ma check-inu
Setu**". `DEC-62(d)`: agregacja per-KR autoryzowana po stronie klienta — Ty
przenosisz ją na serwer, żeby nagłówek Setu i szczegół KR nie liczyły tego
samego dwa razy, dwoma różnymi wzorami.

**Stan zastany, zweryfikowany:** check-iny istnieją **wyłącznie** pod
`/key-results/:keyResultId/check-ins` (`okr.routes.ts`, okolice `:1819-1950`).
Nie ma niczego na poziomie Setu. Kadencja **istnieje** —
`okr_vnext_checkin_occurrences` (§1.5 pkt 1).

**Kontrakt:**

```
GET /api/vnext/results/okr/sets/:setId/check-in-summary

200 → {
  setId: string,
  keyResults: Array<{
    keyResultId: string,
    objectiveId: string,
    lastCheckIn: { checkInId: string, recordedAt: string, confidence: string | null } | null,
    nextExpectedAt: string | null,
    staleness: 'CURRENT' | 'DUE' | 'OVERDUE' | 'UNKNOWN',
    stalenessReason: 'NO_CHECKIN_YET' | 'NO_CADENCE_CONFIGURED' | null
  }>,
  rollup: {
    total: number,
    withCheckIn: number,
    overdue: number,
    neverCheckedIn: number,
    oldestCheckInAt: string | null,
    newestCheckInAt: string | null
  },
  calculatedAt: string
}
```

**Wymagania twarde:**

1. **Read-only. Zero zapisu, zero nowej ścieżki mutacji.** Nie budujesz
   „check-inu Setu" — to byłby nowy agregat domenowy, a na to nie ma decyzji.
   Zapis zostaje przy KR (`DEC-62(d)` mówi „read-only").
2. **`staleness` liczysz z REALNEJ kadencji.** Źródło: okna
   `okr_vnext_checkin_occurrences` (`window_end`), tak jak czyta je
   `okrCheckInScheduler.ts` (§1.5 pkt 1) — **wołasz/czytasz, nie zmieniasz
   schedulera**. Jeżeli dla danego KR nie ma skonfigurowanej kadencji →
   `staleness: 'UNKNOWN'` + `stalenessReason: 'NO_CADENCE_CONFIGURED'`.
   **Nigdy `CURRENT`** („nie wiemy" to nie to samo co „w porządku").
   **Nie wymyślasz częstotliwości.**
3. **`rollup` jest liczony z tej samej listy, którą zwracasz.** Nie z osobnego
   zapytania. Rozjazd między `keyResults.length` a `rollup.total` = defekt,
   który test ma złapać.
4. **Korekty check-inów.** `correctCheckIn` tworzy wiersz zastępujący
   (`okr.routes.ts`, okolice `:1904-1950`). `lastCheckIn` pokazuje **wiersz
   obowiązujący**, nie ostatni fizycznie wstawiony. Ta sama semantyka co
   `listMeasurements` w `K.1` (`includeSuperseded: false`).
5. **Widoczność Setu jak w §O.1 pkt 3** — `404` przy braku.
6. **Zero migracji.**

**DoD (poza §0.4):** test rekoncyliacji `rollup` ↔ `keyResults`; test Setu bez
ani jednego check-inu (`neverCheckedIn === total`, `oldestCheckInAt`
i `newestCheckInAt` = `null`, **nie** data utworzenia Setu); test korekty
(agregat pokazuje wiersz zastępujący); test KR bez kadencji (`UNKNOWN`, nie
`CURRENT`); **test HTTP realnego routera**; negatyw tenanta; `realdb`.

**Definicja ukończenia jednym zdaniem:** nagłówek Setu ma jedno, serwerowe
źródło prawdy o check-inach — z realnej kadencji, z rekoncyliowalnym rollupem
i z `UNKNOWN` tam, gdzie kadencji nie ma.

---

## §X. EXECUTION — trzy pozycje (`E-O6`, `E-O7`, `DEC-63`, `DEC-72`)

### X.1 — Rekonstrukcja `as-of` (replay historyczny snapshotu, `E-O6`)

**Skąd:** raport dnia 11, `STOP — E-O6`: „snapshot przechowuje `asOf`, ale nie
znaleziono endpointu rekonstruującego **historyczne źródła** na tę datę. Zmiana
serwera jest zabroniona". Tamten dyżur nie mógł tknąć serwera. **Ty możesz i to
jest ta pozycja.**

**Stan zastany:** `asOf` jest polem `ReportRun`
(`server/src/domain/initiatives-execution/reportRun.ts`), trafia do zamrożonego
snapshotu i wchodzi do hasha. Ale **nic go nie używa do odczytu**: run zbiera
dane „teraz", a `asOf` jest tylko etykietą. Dwa uruchomienia tego samego
raportu na tę samą datę `asOf`, wykonane w odstępie tygodnia, dadzą różne
liczby — i nic tego nie wykrywa.

**Cel:** odtworzyć stan źródeł **na moment `asOf`**, deterministycznie, z zapisu
zdarzeń — albo **uczciwie odmówić**, gdy zapis zdarzeń tego nie umożliwia.

**Kontrakt:**

```
POST /api/v8/pmo/initiatives-execution/report-runs/:reportRunId/reconstruct
body: { asOf: string }        // ISO; musi być ≤ now()

200 → {
  reportRunId: string,
  asOf: string,
  reconstructable: boolean,
  sources: ReportSource[],               // kształt z reportRun.ts (sourceType, sourceId, version,
                                         // capturedAt, freshness, formula, unit, currency, window,
                                         // confidence, accessState, redactions)
  gaps: Array<{
    sourceType: string,
    sourceId: string,
    reason: 'NO_EVENT_HISTORY_BEFORE_AS_OF' | 'SOURCE_NOT_EVENT_SOURCED' | 'ACCESS_DENIED'
  }>,
  reconstructedAt: string
}
```

**Wymagania twarde:**

1. **★ `reconstructable: false` jest wynikiem pełnowartościowym.** Gdy dla
   któregokolwiek źródła nie da się odtworzyć stanu na `asOf`, zwracasz `false`
   i wypełniasz `gaps`. **Nie zwracasz stanu bieżącego udającego historyczny.**
   To jest najgroźniejsza możliwa atrapa w tym dyżurze: liczba wygląda tak samo,
   a znaczy co innego.
2. **Odtwarzasz ze zdarzeń, nie z bieżącego stanu.** Materiał: zdarzenia
   agregatów runtime-v1 (`materialCommand.ts`, `getRelatedAggregateForUpdate`,
   wersjonowanie agregatów — `reportRun.ts` pokazuje, jak sięga się po
   **dokładną wersję** definicji). Dla każdego źródła ustalasz **wersję
   obowiązującą w chwili `asOf`**; to jej numer trafia do `ReportSource.version`,
   a `capturedAt` = czas tej wersji, **nie** `now()`.
3. **`freshness` wobec `asOf`, nie wobec teraz.** Źródło, którego ostatnia
   wersja jest starsza niż `asOf` o więcej niż okno raportu, dostaje `'STALE'`.
   Źródło bez historii → `'UNKNOWN'` i wpis w `gaps`.
4. **`asOf` w przyszłości → `400`.** `asOf` starsze niż najstarsze zdarzenie
   organizacji → `200` z `reconstructable: false` i wszystkimi `gaps` typu
   `NO_EVENT_HISTORY_BEFORE_AS_OF`.
5. **★ Zero mutacji.** Trasa **nie** zmienia runu: nie zapisuje `sources`, nie
   przechodzi stanu, nie tworzy eventu, nie dotyka `atomicWrite`. Jest to odczyt
   z ciężkim obliczeniem — świadomie `POST` (ciało z datą), ale **bez skutku
   ubocznego**. Test to sprawdza: stan i wersja runu po wywołaniu identyczne.
6. **★ `reportRun.ts` jest TYLKO DO ODCZYTU.** Logika rekonstrukcji siedzi
   w **nowym** pliku `server/src/domain/initiatives-execution/reportReconstruction.ts`,
   trasa jest cienka. Zmiana `reportRun.ts` = STOP (jego zaostrzenie `NO_SOURCES`
   zrobił już dzień 14 i to jest domknięte).
7. **Tenant i widoczność:** wzorzec §2.3 — `actorFromRequest`,
   `canViewAggregate(actor, 'report_run', id)` → **`404`** przy braku.
   **Dopisujesz ścieżkę do mapy widoczności `:1278-1290`** (§1.5 pkt 12).
8. **★ Idempotencja i determinizm — to jest sedno pozycji.** Dwa wywołania
   z tym samym `asOf` na niezmienionym zapisie zdarzeń muszą zwrócić
   **identyczny** zbiór `sources` (po stabilnej serializacji). Dowodzisz testem:
   dwa wywołania → `reportContentHash` z obu wyników identyczny.

**Migracja:** zwykle **żadna**. Jeżeli okaże się, że runtime-v1 nie przechowuje
czasu wersji agregatu w formie nadającej się do zapytania — **STOP**, z opisem
brakującej kolumny i propozycją migracji addytywnej, **nie** z migracją
napisaną „na wszelki wypadek".

**DoD (poza §0.4):** test determinizmu (dwa przebiegi, identyczny hash); test
„źródło zmienione po `asOf` nie wpływa na wynik"; test `reconstructable: false`
z niepustym `gaps`; test `asOf` w przyszłości → `400`; test braku mutacji;
**test HTTP realnego routera**; negatyw tenanta → `404`; `realdb`.

**Definicja ukończenia jednym zdaniem:** `asOf` przestaje być etykietą — albo
zwraca deterministycznie odtworzone źródła historyczne, albo uczciwie mówi
`reconstructable: false` z listą luk, i nigdy nie podaje teraźniejszości za
przeszłość.

### X.2 — Eksport XLSX (`E-O7`, **bez** silnika AI) + domknięcie tenanta na eksporcie

**Skąd:** raport dnia 11, `E.4`: „Eksport → `JEST_CZĘŚCIOWO`:
management-reports: PDF/PPTX; runtime-v1 JSON; **XLSX `BRAK_API`**".
`STOP — E-O7`: część AI wstrzymana.

**★ Granica pozycji, dosłownie:** budujesz **wyłącznie** gałąź XLSX. **Zero**
`FACT`/`INFERENCE`/`RECOMMENDATION`, **zero** cytowań modelu, **zero** dostawcy
AI (Z15, `DEC-59`). Jeżeli pomyślisz „przy okazji dołożę sekcję rekomendacji" —
to jest STOP.

**Kontrakt:**

```
GET /api/management-reports/:id/xlsx
200 → { success: true, xlsxUrl: string }
503 → respondFeatureUnavailable(res, 'missing dependency: exceljs')
404 → { success: false, error: 'Report not found' }
```

**Wymagania twarde:**

1. **`exceljs`, nie `xlsx`.** Powód w §1.5 pkt 8. Ładujesz leniwie, dokładnie
   wzorem `loadExportDeps()` (`managementReportsService.ts:23-46`), rozszerzając
   tę funkcję o trzecie pole. `dependencyMissing` (`:48`) rozszerzasz
   o `'exceljs'`. Brak zależności = **`503` z jawnym powodem**, nigdy pusty plik
   i nigdy `200`.
2. **★ Naprawiasz dziurę tenantową na tej ścieżce** (§1.5 pkt 6). Robisz to tak,
   żeby **nie zepsuć zamrożonego demo** (`DEC-65`):
   - dodajesz **nową**, org-scoped metodę repozytorium
     (`getReportByIdForOrganization(reportId, organizationId)`) — **addytywnie,
     obok istniejącej**;
   - `generateExport` przyjmuje `organizationId` jako **nowy, wymagany
     parametr**, a trasy `/:id/pdf` (`:343`), `/:id/pptx` (`:377`) i nowa
     `/:id/xlsx` przekazują organizację **wyłącznie z tokenu** (`req.user` /
     `req.organizationId` ustawione przez `verifyToken`), **bez fallbacku na
     `req.query.organizationId` ani `req.body.organizationId`**;
   - brak dopasowania organizacji → **`404`**, ta sama odpowiedź co „nie ma
     raportu" (nie ujawniamy istnienia cudzego zasobu);
   - **istniejącej `getReportById` nie usuwasz i nie zmieniasz** — mają ją inni
     wołający, a Ty ich nie audytujesz w tym dyżurze. Wymieniasz ich listę
     w raporcie (`grep -rn "getReportById" server/src/`) jako znalezisko do
     osobnego zakresu;
   - **fallbacku organizacji na trasach, których NIE dotykasz, nie ruszasz** —
     lista linii idzie do „Znalezisk".
3. **Zawartość arkusza wynika z raportu, nie z fantazji.** Jeden arkusz
   „Summary" z tymi samymi wierszami, które daje `buildSummaryLines(report)`
   (używana przez ścieżkę PDF), plus po jednym arkuszu na sekcję treści raportu.
   **Zero kolumn wyliczanych na nowo** — eksport nie jest drugim miejscem
   liczenia. Jeśli sekcja jest pusta, arkusz jest pusty **z nagłówkiem**, a nie
   pominięty (żeby układ pliku był stabilny).
4. **Zapis ścieżki jak dla PDF/PPTX.** Jeśli w `management_reports` nie ma
   `xlsx_path` — migracja addytywna `<numer>_day17_management_reports_xlsx_path.sql`
   (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS xlsx_path TEXT`). **Kompatybilność
   wstecz** (§0.3 pkt 4): kolumna `NULL`-owalna, bez `DEFAULT` zmieniającego
   istniejące wiersze; stary kod jej nie widzi i działa dalej.
5. **`logAudit(reportId, 'EXPORTED', userId, { format: 'xlsx' })`** — tak samo
   jak pozostałe formaty.
6. **`bulk-export` NIE DOTYKASZ** (§1.5 pkt 7). Odnotowujesz w „Znaleziska — nie
   naprawiane" i idziesz dalej.

**DoD (poza §0.4):** test „plik powstaje i da się go odczytać `exceljs`-em,
a nagłówki arkusza zgadzają się z `buildSummaryLines`"; test braku zależności →
`503` z powodem; **test negatywu tenanta na WSZYSTKICH trzech formatach**
(pdf/pptx/xlsx) — obcy `organizationId` dostaje `404`; test, że
`?organizationId=<cudza>` **nie zmienia** wyniku (dowód, że fallback zniknął
z tych tras); test raportu bez sekcji (arkusze puste, plik poprawny);
**test HTTP realnego routera**; `realdb` dla migracji `xlsx_path`.

**Definicja ukończenia jednym zdaniem:** raport zarządczy eksportuje się do
realnego, otwieralnego XLSX-a przez `exceljs`, a wszystkie trzy formaty
eksportu czytają raport wyłącznie w granicach organizacji z tokenu.

### X.4 — Rodzina KPI Control: osiem rodzin, read-model (kontrakt `06_EXECUTION:258`)

**Skąd:** raport dnia 11, `E.3`: „KPI i forward scenarios 2/4/8/12 tyg. →
`BRAK_API`; **nie wolno składać wartości z niejawnych progów**"; „Severity
i reaction SLA → `BRAK_API`; wartości/taksonomia wymagają decyzji Piotra".
`DEC-72` skierowała `E-O4`/`E-O5` do Piotra.

**Osiem rodzin — dosłownie z `modules/06_EXECUTION/MODULE_ACCEPTANCE.md:258`:**

| #   | Rodzina                 | Nazwa z kontraktu            |
| --- | ----------------------- | ---------------------------- |
| 1   | dostarczanie planu      | `plan-delivery`              |
| 2   | praca zablokowana       | `blocked-work`               |
| 3   | kamienie milowe         | `milestone`                  |
| 4   | ryzyko inicjatywy       | `initiative-risk`            |
| 5   | zależności              | `dependency`                 |
| 6   | wydajność / zasoby      | `capacity`                   |
| 7   | opóźnienie decyzji      | `decision-latency`           |
| 8   | skuteczność interwencji | `intervention-effectiveness` |

**Zakres pozycji: „przynajmniej read-model".** To znaczy: **odczyt, bez mutacji,
bez scenariuszy prognostycznych.** Scenariusze `base/optimistic/pessimistic`
**nie wchodzą** — zależą od `E-O4` (wagi) i pozostają `BRAK_API`. Napisz to
wprost w raporcie, żeby nikt nie uznał pozycji za szerszą niż jest.

**Kontrakt:**

```
GET /api/v8/pmo/initiatives-execution/control-kpis?weekStart=<iso>&policyId=<id>

200 → {
  weekStart: string,
  families: Array<{
    family: 'plan-delivery' | 'blocked-work' | 'milestone' | 'initiative-risk'
          | 'dependency' | 'capacity' | 'decision-latency' | 'intervention-effectiveness',
    numerator: number | null,
    denominator: number | null,
    value: number | null,
    valueReason: 'UNKNOWN' | 'INSUFFICIENT_DATA' | 'DECISION_REQUIRED' | 'BRAK_ŹRÓDŁA' | null,
    drillDown: { kind: string, ids: string[], truncated?: boolean },  // DOKŁADNY zbiór, nie próbka
    sourceVersion: number,
    calculatedAt: string
  }>,                                             // ZAWSZE osiem elementów, w tej kolejności
  policy: {
    policyId: string | null,
    resolved: boolean,
    missingParameters: string[]                   // np. ['atRiskThresholdDays','impactWeights']
  },
  scopeCompleteness: 'FULL' | 'PARTIAL',
  calculatedAt: string
}
```

**Wymagania twarde:**

1. **★ Tablica ma ZAWSZE osiem elementów, w kolejności z kontraktu.** Rodzina,
   której nie da się policzyć, **nie znika** — pojawia się z `value: null`
   i jawnym `valueReason`. Zniknięcie rodziny z odpowiedzi to cichy fałsz:
   konsument policzy „7 z 7 zielonych".
2. **★ Zero zaszytych progów (Z12).** Rodziny, które bez decyzji Piotra **nie
   mają wartości**, zwracają `valueReason: 'DECISION_REQUIRED'` i wpisują
   brakujący parametr do `policy.missingParameters`. Dotyczy to **co najmniej**:
   - `initiative-risk` — brak wag wpływu (`E-O4`);
   - `capacity` — brak progu saturacji i bufora (`E-O5`);
   - `decision-latency` — brak SLA decyzji (`E-O4`).

   **Parametry przyjmujesz, nie wymyślasz.** `policyId` wskazuje wiersz polityki;
   brak `policyId` albo brak wiersza → `resolved: false` i **komplet**
   `missingParameters`. **Nie ma trybu „policz z domyślnymi".**

3. **Migracja polityki — addytywna, PUSTA.** Plik
   `<numer>_day17_execution_control_kpi_policy.sql` (numer wg §0.1 pkt 7):
   `CREATE TABLE IF NOT EXISTS execution_control_kpi_policies (...)` —
   `policy_id`, `organization_id`, `name`, `parameters JSONB NOT NULL DEFAULT
'{}'::jsonb`, `created_at`, `updated_at`, `row_version`.
   **Zero `INSERT`. Zero wiersza „default".** Pusta tabela jest poprawnym stanem
   końcowym tego dyżuru — wypełni ją decyzja Piotra, nie Ty. Kompatybilność
   wstecz: nowa tabela, stary kod jej nie zna, nic się nie psuje (wpisz to do
   tabeli `KOMPATYBILNOŚĆ_WSTECZ`).
4. **`numerator`/`denominator` obowiązkowe wszędzie, gdzie `value` istnieje.**
   Kontrakt `06_EXECUTION:264` („each KPI reconciles") wymaga rekoncyliacji.
   `value` bez licznika i mianownika = liczba, której nie da się sprawdzić.
   `denominator === 0` → `value: null` + `INSUFFICIENT_DATA`, **nigdy `0`
   i nigdy `NaN`**.
5. **`drillDown.ids` to DOKŁADNY zbiór**, z którego policzono licznik — nie
   próbka, nie pierwsze 50. Jeżeli zbiór jest bardzo duży, dokładasz
   `drillDown.truncated: true` i **wtedy** ograniczasz — ale to musi być widoczne
   w odpowiedzi. (`DEC-72` wprost wytknęła dniowi 11 „rejestry konfliktów
   przepuszczają wszystko" — kontrola ma być sprawdzalna.)
6. **Źródła danych — realne, wymienione imiennie w nagłówku pliku.** Punkt
   wyjścia do rozpoznania: `server/src/routes/executionControl.routes.ts`
   (sygnały ryzyka, opóźnień, przekroczeń budżetu, obejścia, alerty wydajności),
   `server/src/routes/executionAnalytics.routes.ts` (predict/triage/dependencies/
   intelligence) oraz agregaty runtime-v1 (`management-signals`, `interventions`
   w `initiativesExecutionRuntime.routes.ts`). **Dla każdej z ośmiu rodzin
   wpisujesz do raportu wiersz: rodzina → tabela/endpoint źródłowy → czy
   wystarcza → werdykt.** Rodzina bez źródła = `valueReason: 'BRAK_ŹRÓDŁA'`,
   **nie** wyliczenie „z czegoś podobnego".
7. **Znane, nienaprawiane znalezisko — powtórz je, nie ukrywaj.**
   `executionControl.routes.ts:1007-1011` dokumentuje niezgodność kształtu, przez
   którą alerty wydajności wychodzą puste. Jeżeli Twoja rodzina `capacity` opiera
   się o to źródło → `scopeCompleteness: 'PARTIAL'` i wpis do raportu. **Nie
   naprawiasz** — inny zakres, inny właściciel.
8. **Tenant i widoczność:** wzorzec §2.3. Read-model **nigdy** nie liczy po
   rekordach spoza organizacji wołającego, **także w mianowniku**. To jest łatwe
   do przeoczenia: mianownik „wszystkie zadania" bywa liczony globalnie.
9. **Read-only.** Zero mutacji, zero zapisu wyniku, zero cache'u w bazie.

**DoD (poza §0.4):** test „zawsze osiem rodzin, zawsze w tej kolejności, także
gdy baza jest pusta"; test „brak `policyId` → wszystkie rodziny zależne od
progów mają `DECISION_REQUIRED`, żadna nie ma liczby"; test rekoncyliacji
`numerator/denominator ↔ drillDown.ids.length` dla każdej policzalnej rodziny;
test `denominator === 0`; **negatyw tenanta na mianowniku** (rekord innej
organizacji nie zmienia `denominator`); **test HTTP realnego routera**;
`realdb` na komplecie ośmiu rodzin.

**Definicja ukończenia jednym zdaniem:** raport sterowania dostaje zawsze osiem
rodzin z rekoncyliowalnym licznikiem i mianownikiem albo z jawnym powodem braku,
a każdy próg pochodzi z wiersza polityki, nigdy z kodu.

---

## POZA ZAKRESEM (front wewnętrzny) — czego NIE budujesz

**Podział FRONT/TYŁ (właściciel, 25.08): Codex robi WYŁĄCZNIE mechanikę tylną.**
Każda z siedmiu pozycji ma powierzchnię wizualną. **Cała ta kolumna należy do
osobnego toru** — powstanie po prototypie i akcepcie Piotra na zrzutach
(CLAUDE.md reguła 7). Nie budujesz jej, nie „przygotowujesz", nie dodajesz
kluczy i18n, nie robisz zrzutów.

| Pozycja | TYŁ — Twoje                                          | FRONT — NIE Twoje                                                                                            |
| ------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| K.2     | `GET /kpi/:kpiId/history` + read-model osi czasu     | sekcja „Historia i rodowód" na karcie KPI, tłumaczenie `summaryCode` → napis, ikony rodzajów, „pokaż więcej" |
| K.3     | `GET /kpi/:kpiId/next-obligation`                    | element nagłówka karty KPI „następny obowiązek", `HonestValueCell`/`GapNotice`, odznaka `overdue`            |
| O.1     | opcjonalny `setId` w repozytorium uwagi + trasa Setu | panel uwagi w karcie Setu, badge `PARTIAL_MANAGEMENT_CHAIN`                                                  |
| O.2     | `GET /okr/sets/:setId/check-in-summary`              | nagłówek Setu z rollupem, kolorowanie `staleness`                                                            |
| X.1     | `POST /report-runs/:id/reconstruct`                  | kontrolka „odtwórz na datę" w generatorze raportu, prezentacja `gaps`                                        |
| X.2     | trasa `/:id/xlsx` + `exceljs` + org-scoped odczyt    | przycisk „Eksportuj XLSX", stan `503`/brak zależności w UI                                                   |
| X.4     | `GET /control-kpis` + tabela polityk                 | pasek ośmiu rodzin w raporcie sterowania, `DECISION_REQUIRED` jako uczciwy pusty stan                        |

**Wspólne dla wszystkich: klucze i18n `PL`+`EN` (`public/locales/**`), zrzuty
light+dark, kanon triady/SPEC-A, `HonestValueCell`/`GapNotice` — POZA
ZAKRESEM.**

Twoje **jedyne** dotknięcie warstwy klienckiej to **typowane funkcje API bez
JSX** w trzech plikach z ramki Z17 (`kpiApi.ts`, `okr/okrApi.ts`,
`runtimeApi.ts`) — i to jest opcjonalne: jeśli dopisanie ich wymagałoby
czegokolwiek poza czystym TS, **pomijasz je i wpisujesz do raportu**.

---

## §T. TESTY — pięć pozycji

### T.1 — ★ Zmiana testu istniejącego jest w tym dyżurze ZAKAZANA

W przeciwieństwie do dnia 14 (który miał jeden jawny wyjątek — zaostrzenie
walidacji `NO_SOURCES`), **ten dyżur nie ma ani jednego dopuszczalnego przypadku
zmiany testu istniejącego wcześniej.** Wszystkie siedem pozycji to **nowe
powierzchnie**, dokładane obok.

Jeżeli Twoja zmiana zapala istniejący test — to **nie jest** powód do poprawienia
testu. To jest sygnał, że zmieniłeś zachowanie, którego nie miałeś zmieniać:
**STOP**, wpis w raporcie, cofnięcie zmiany.

Jedyny wyjątek: **dopisanie nowego `it()` do istniejącego pliku testowego**, gdy
plik ten należy do Twojego zakresu i **nie jest** edytowany równolegle (§1.4).
`server/src/routes/resultsVnext/__tests__/kpi.routes.test.ts` **jest** edytowany
równolegle — do niego nie dopisujesz nic.

### T.2 — Kontrakty per nowy zasób

Każdy nowy endpoint ma test kontraktu: kształt odpowiedzi 1:1 z tym, co
deklaruje §K/§O/§X, komplet pól, poprawne typy `null`. Pole, którego nie ma
w kontrakcie, nie pojawia się w odpowiedzi; pole z kontraktu nie znika.

### T.3 — Negatywy tenanta jako osobny, jawny pakiet

Wszystkie negatywy tenanta zbierasz w **jednym pliku per obszar**
(`tests/resultsVnext/day17/tenantNegatives.test.ts`,
`tests/integration/day17-execution-tenant.realdb.test.ts`) i **wymieniasz je
w raporcie w osobnej tabeli**: `endpoint → scenariusz → oczekiwane → wynik`.
Dla Results testy ustawiają `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`
(§1.5 pkt 9) — bez tego dowodzą nieprawdy.

### T.4 — Uczciwość wartości (`0` ≠ brak)

Osobny test per pozycja z polem liczbowym: rekord o wartości `0` ma **wartość**,
rekord bez danych ma `null` + `reason`. To jest ta sama reguła, którą dzień 8
udowodnił testem `resultsHonestValues`, a dzień 11 poprawiał po inspekcji
(„zerowe KPI oznaczone RED/AMBER").

### T.5 — Testy `realdb` i sprzątanie

Wzorzec §2.5. Po każdym przebiegu `realdb` w raporcie: **utworzono N / usunięto
N / delta 0** oraz dowód, że kontener i wolumeny są sprzątnięte (§0.3 pkt 6).
Kontener stawiasz raz na dyżur, na porcie **5447**, i usuwasz przed oddaniem
raportu.

---

## §R. REJESTR I DOWODY — dwie pozycje

### R.1 — Rejestry modułów do stanu faktycznego

**Wykonujesz TYLKO dla pozycji, które faktycznie domknąłeś wg DoD.**

- `modules/09_RESULTS/MODULE_ACCEPTANCE.md` — `K.2`, `K.3`, `O.1`, `O.2`;
- `modules/06_EXECUTION/MODULE_ACCEPTANCE.md` — `X.1`, `X.2`, `X.4`.

Wpis jest **faktograficzny**: co powstało, jaki endpoint, jaki commit, jaki
dowód. **Nie podnosisz statusu modułu**, nie piszesz „gotowe do odbioru
właściciela", nie zmieniasz `CLOSED_FINAL`. Pozycja `CZĘŚCIOWO` albo `STOP`
**nie wchodzi** do rejestru jako zrobiona.

### R.2 — Komplet dowodów

W raporcie: commity, wyniki testów PRZED/PO, `WERYFIKACJA_BRAKÓW`,
`KOMPATYBILNOŚĆ_WSTECZ`, dowody idempotencji, tabele werdyktów per pozycja,
lista znalezisk nienaprawianych, `git diff --name-only` wobec bazy.

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~90 min, NIE pomijasz)

1. Weryfikacja markera (§0.1 pkt 1–2):
   ```bash
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```
   `MARKER BRAK` → STOP i koniec dyżuru.
2. Warunki wstępne (§0.1 pkt 3) + stan dnia 14 (§0.1 pkt 4). `DZIEŃ 14
NIESCALONY` → STOP i koniec dyżuru.
3. Gałąź + worktree (§0.1 pkt 5) + **symlink `node_modules`** (§0.1 pkt 6).
4. **Numer migracji** — wyznaczenie i sprawdzenie zajętości (§0.1 pkt 7).
   Wynik do raportu.
5. **Koordynacja** (§1.4) — stan `codex/day14-dozbrojenie-20260826` i gałęzi
   dnia 16, lista plików wykluczonych. Wynik do raportu.
6. **`WERYFIKACJA_BRAKÓW`** (§2.7) — wszystkie komendy, wyniki do raportu.
7. **Weryfikacja mapy technicznej** (§2.1) + potwierdzenie kadencji check-inów
   (§1.5 pkt 1) i dziury tenantowej `management-reports` (§1.5 pkt 6).
8. **`STAN_WEJŚCIOWY` testów** (§0.4a pkt 3) — sześć katalogów, wyniki do
   plików i do raportu.
9. **Kontener PG** na porcie 5447 + przebieg (1) na **nietkniętym** repo —
   punkt odniesienia replay.
10. Bramka JSX na trzech plikach klienckich (§0.2).
11. Założenie raportu (§9) i wpisanie wyników 1–10.

### Blok 1 — Results, karta KPI (`K.2` → `K.3`)

Obie pozycje siedzą w `kpi.routes.ts` i mają wspólny wzorzec widoczności.
`K.2` pierwsza (dostarcza wzorzec kursora, którego `K.3` już nie potrzebuje).
`K.3` tańsza — jeśli `K.2` się rozjedzie, `K.3` domykasz niezależnie.
**Testy do NOWYCH plików** (§1.4).

### Blok 2 — Results, OKR (`O.1` → `O.2`)

`O.1` pierwsza: dotyka pliku współdzielonego (`okrAttentionRepository.ts`)
i wymaga testu „bez `setId` = wynik sprzed zmiany". `O.2` niezależna, opiera
się o realną kadencję (§1.5 pkt 1).

### Blok 3 — Execution, rekonstrukcja (`X.1`)

Najdroższa i najbardziej ryzykowna pozycja dyżuru. Jeśli zaczynasz ją z mniej
niż połową bloku — **nie zaczynaj**; zrób `X.2` (tanie, wartościowe) i wróć.
Migracji zwykle nie ma; jeśli okaże się potrzebna → **STOP z propozycją**
(§X.1 „Migracja").

### Blok 4 — Execution, eksport i sterowanie (`X.2` → `X.4`)

`X.2` przed `X.4`: tańsza, domyka realną dziurę tenantową, ma jasny dowód
(plik da się otworzyć). `X.4` ostatnia — jest najbardziej narażona na
`BRAK_ŹRÓDŁA` i `DECISION_REQUIRED`, a jej głównym produktem jest **tabela
ośmiu werdyktów w raporcie**, nie liczby.

### Blok 5 — domknięcie (obowiązkowo, ~90 min, NIE pomijasz)

1. `T.2`–`T.5`, `R.1`, `R.2` — dla tego, co faktycznie zbudowałeś.
2. Pomiar zasięgu (§0.4a): PRZED/PO, delta, `ZASIĘG PEŁNY`/`CZĘŚCIOWY`.
3. **Siedem dowodów** (do raportu):
   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "tests/setup|tests/helpers|tests/__mocks__|vitest.*config"   # PUSTY (Z18)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "\.tsx$|^public/locales/"                                    # PUSTY (Z10)
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^server/migrations/"                                        # tylko Twoje <numer>_day17_*
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "kpiTrend|kpi.routes.test|roi\.|resultsVnextRoi|search.routes|textMatch|resultsSearchRepository"   # PUSTY (§1.4)
   git diff codex/m03-admin-20260824...HEAD | grep -E "^\+.*(defaultValue|useFeatureFlags|execReportsIntelligence)"            # PUSTY (Z11)
   bash scripts/check-list-canon.sh 2>&1 | tail -5                                                                             # dług nie rośnie
   docker ps -a --filter name=cx-day17 --format '{{.Names}}'                                                                   # PUSTO (sprzątnięte)
   ```
4. Dowód sprzątania `realdb`: utworzono N / usunięto N / delta 0.
5. Domknięcie raportu, licznik pozycji, „Czego nie zrobiłem i dlaczego".

### Zasada nadrzędna kolejności

Lepiej **domknięte** `K.2` + `K.3` + `O.1` + `O.2` + `X.2` niż siedem pozycji
„prawie". Każda pozycja albo spełnia DoD, albo jest uczciwie oznaczona
(`STOP` / `BRAK_API` / `BRAK_ŹRÓDŁA` / `CZĘŚCIOWO`).

---

## 9. RAPORT — jedyny dokument, który tworzysz

Ścieżka, dokładnie jedna:

```
docs/program/waves/WAVE_03_ACCEPTANCE/RESULTS_DAY17_REPORT_20260826.md
```

Nie tworzysz drugiego pliku nigdzie indziej (Z13).

### 9.1. Szablon

```markdown
# Results/Execution dzień 17 — raport dyżuru <data>

Baza: codex/m03-admin-20260824 @ <tip SHA>
Marker: «MARKER_SHA» — POTWIERDZONY / BRAK
Gałąź robocza: codex/results-day17-<data>
Worktree: /private/tmp/consultify-results-day17
node_modules: symlink do /Users/piotrwisniewski/Developer/Consultify/node_modules (DEC-86) TAK / NIE
Port kontenera PG: 5447 · kontener cx-day17-pg usunięty: TAK / NIE
Czas pracy: <od>–<do>

## Oświadczenia

- Nie otwierałem, nie czytałem i nie kopiowałem katalogu
  /Users/piotrwisniewski/Developer/Consultify poza symlinkiem node_modules (Z4/Z5). TAK / NIE
- ZERO UI: brak `.tsx` i `public/locales/*` w diffie (Z10). TAK / NIE
- FREEZE: zero chmury, zero zdalnych migracji, zero realnych wysyłek (Z8, DEC-65). TAK / NIE
- Zero nowych flag i zero zmian wartości domyślnych (Z11). TAK / NIE
- Zero zmian globalnej infry testowej (Z18). TAK / NIE
- Zero zaszytych progów/wag/SLA (Z12). TAK / NIE

## Koordynacja (§1.4)

| Strumień | Sprawdzenie | Wynik | Konsekwencja |
| dzień 14 (backend) | merge-base --is-ancestor | SCALONY / NIESCALONY | buduję do przodu / STOP |
| day14-dozbrojenie (K.1 testy + S.2 ROI) | git diff --name-only | <lista plików> | WYKLUCZONE z mojego zakresu |
| dzień 16 (Meetings) | rezerwacja numerów migracji | <numery> | mój numer startowy = … |
| X.3a / lifecycle→eksport | poza DEC-77 | POZA ZAKRESEM | nie robię |
Potwierdzam, że mój diff nie zawiera ani jednego pliku z listy wykluczeń. TAK / NIE

## Warunki wstępne — wynik sprawdzenia

(marker, ledger, DEC-77, DEC-86, DEC-65, DEC-72, rejestry 115/308, linia :258, raport dnia 14)

## Numeracja migracji (DEC-86)

Najwyższy istniejący: <numer> · zarezerwowane przez gałęzie niescalone: <numery>
Przydzielone mnie: <numery> · `ls server/migrations | grep '^<numer>'` przed każdym plikiem: PUSTO

## WERYFIKACJA_BRAKÓW (§2.7)

| Sprawdzenie | Oczekiwane | Wynik | Wniosek |

## Weryfikacja mapy technicznej (§2.1) i korekty

## Pozycje — tabela zbiorcza

| Pozycja | Zakres | Status | Commit | Dowód (test/plik) |
| K.2 | historia i rodowód KPI | | | |
| K.3 | następny obowiązek KPI | | | |
| O.1 | attention w zasięgu Setu | | | |
| O.2 | agregat check-inów Setu | | | |
| X.1 | rekonstrukcja as-of | | | |
| X.2 | eksport XLSX + org-scoped odczyt | | | |
| X.4 | osiem rodzin KPI Control | | | |
| T.2–T.5, R.1, R.2 | testy i rejestr | | | |
(Status ∈ ZROBIONE_WG_DoD · CZĘŚCIOWO · STOP · BRAK_API · BRAK_ŹRÓDŁA · NIE_ZACZĘTE)

## Tabele werdyktów — główny produkt pozycji

### K.2 — pokrycie rodzajów | Rodzaj | Źródło | Czy jest | Werdykt |

### K.3 — źródła obowiązku | Wariant | Warunek | Wynik | Test |

### O.1 — rekoncyliacja | Set | Suma po Setach | Agregat org | Zgodne? |

### O.2 — kadencja | KR | Źródło kadencji | staleness | Test |

### X.1 — rekonstruowalność | Źródło | Zdarzenia przed asOf | Wersja | gaps |

### X.2 — tenant eksportu | Format | Przed | Po | Test negatywny |

### X.4 — osiem rodzin | Rodzina | Źródło | Wystarcza? | value/valueReason | Werdykt |

## Migracje

MIGRATION_PREPARED / REMOTE_EXECUTION_NOT_AUTHORIZED (DEC-65)

### KOMPATYBILNOŚĆ_WSTECZ | Obiekt | Co robi stary kod | Co robi nowy kod bez backfillu |

### Dowód idempotencji i sprzątania (przebiegi 1/2/3, docker ps, docker volume ls)

## Testy

### Testy własne | Plik | Co dowodzi | Wynik |

### Testy HTTP realnego routera per pozycja | Pozycja | Plik | Wynik |

### Zasięg (§0.4a) | Katalog | PRZED | PO | Delta | Werdykt | → ZASIĘG PEŁNY / CZĘŚCIOWY

### Negatywy tenanta (§T.3) | Endpoint | Scenariusz | Oczekiwane | Wynik |

### Uczciwość wartości (§T.4)

### Sprzątanie realdb (§T.5) utworzono N / usunięto N / delta 0

## Znaleziska — nie naprawiane

(oczekiwane m.in.: bulkExport nie tworzy pliku · fallback organizationId z query/body na
pozostałych trasach management-reports · mismatch capacity alerts executionControl.routes.ts:1011 ·
rvn_platform_management_chain_closure bez pełnego producenta · zastane FAIL-e z STAN_WEJŚCIOWY)

## Korekty wobec instrukcji

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy

### STOP — <pozycja>

Powód: · Dowód: · Czego brakuje: · Co zrobiłbym po decyzji X: · Stan:

## Licznik

Pozycji w zakresie: 7 · domknięte: N · częściowe: N · STOP: N · niezaczęte: N

## Czego nie zrobiłem i dlaczego

## Gotowość

Gotowe do przeglądu kodu i uruchomienia testów przez nadzorcę: TAK / NIE (dla których pozycji).
UI nie budowano; flag nie zmieniano; rejestrów nie podnoszono ponad stan faktyczny.
```

### 9.2. Czego w raporcie NIE piszesz

- **Nie piszesz** „gotowe do pokazania właścicielowi" ani „gotowe do włączenia
  flagi" — piszesz „gotowe do przeglądu przez nadzorcę".
- **Nie zawyżasz statusów.** `CZĘŚCIOWO` to `CZĘŚCIOWO`. Dzień 12 stracił odbiór
  na zawyżonych „JEST" (`DEC-73`), dzień 11 na sześciu werdyktach-placebo
  (`DEC-72`).
- **Nie nazywasz „zastanym"** czerwonego testu, którego nie ma w
  `STAN_WEJŚCIOWY`.
- **Nie oceniasz pracy dnia 14 ani dnia 8/11** — opisujesz stan faktyczny.

---

## 10. ŚCIĄGA

### 10.1. Komendy

```bash
# formatowanie — PRZED KAŻDYM COMMITEM
npx prettier --write <pliki tego commita>

# test celowany (NIGDY pełny vitest/tsc)
npx vitest run server/src/services/resultsVnext/kpi/__tests__/kpiHistory.test.ts
npx vitest run server/src/routes/resultsVnext/__tests__/kpiHistory.routes.test.ts
npx vitest run tests/resultsVnext/day17

# typy punktowo
npx esbuild server/src/domain/initiatives-execution/reportReconstruction.ts \
  --loader:.ts=ts --outfile=/dev/null

# migracje — jednorazowy kontener (port 5447), dowód (1)(2)(3), sprzątanie
docker run -d --name cx-day17-pg --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=3g \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day17 -p 127.0.0.1:5447:5432 pgvector/pgvector:pg16
export DATABASE_URL="postgres://postgres:cx@127.0.0.1:5447/cx_day17"
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:strict          # x2
NODE_ENV=test DB_TYPE=postgres npm run db:migrate:postgres:dry
docker rm -f cx-day17-pg && docker volume ls -q | grep -i cx-day17 | xargs -r docker volume rm

# negatyw tenanta Results musi działać w trybie enforce
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce npx vitest run tests/resultsVnext/day17/tenantNegatives.test.ts

# nowe pliki w tests/ wymagają -f
git add -f tests/resultsVnext/day17/<nowy>.test.ts

# pomiar zasięgu
git diff --name-only codex/m03-admin-20260824...HEAD
```

### 10.2. Dziesięć rzeczy, które najłatwiej zepsuć

1. **Dotknięcie pliku z listy wykluczeń §1.4** (`kpiTrend.ts`,
   `kpi.routes.test.ts`, ROI, `search.routes.ts`, `textMatch.ts`) — konflikt
   z równoległym dyżurem, praca do wyrzucenia.
2. **Rekonstrukcja `as-of` zwracająca stan bieżący** — najgroźniejsza atrapa
   dyżuru. `reconstructable: false` + `gaps` jest **lepszym** wynikiem.
3. **Zniknięcie rodziny z ośmiu w `X.4`** — cichy fałsz. Zawsze osiem, zawsze
   w tej kolejności.
4. **Zaszyty próg/waga/SLA** — `DECISION_REQUIRED` + `missingParameters`, nigdy
   „rozsądna wartość".
5. **`200 + []` zamiast `404`** przy braku widoczności (`K.2`, `O.1`, `O.2`) —
   pusta lista znaczy „nic nie było", a to nieprawda.
6. **Filtrowanie tablicy po pobraniu w `O.1`** zamiast filtra w SQL — to jest
   „druga prawda", której `DEC-62(c)` zabroniła.
7. **Wymyślona kadencja check-inów w `O.2`** — kadencja **istnieje**
   (`okr_vnext_checkin_occurrences`), a gdy jej brak → `UNKNOWN`, nie `CURRENT`.
8. **`organizationId` z `req.query`/`req.body` w `X.2`** — to jest właśnie ta
   dziura, którą masz zamknąć, nie powielić.
9. **Migracja z kolizyjnym numerem** albo zgadniętym „bo tak było w instrukcji"
   — numer wyznaczasz w Bloku 0 i sprawdzasz przed każdym plikiem (`DEC-86`).
10. **Zmiana globalnego mocka albo configu vitest (Z18)** — mockujesz lokalnie
    w swoim pliku; inaczej STOP.

### 10.3. Trzy zdania, które kończą dyskusję

- „Nie wiem, jaki próg" → **`DECISION_REQUIRED`**, nie wartość domyślna.
- „Nie ma źródła" → **`BRAK_ŹRÓDŁA`** z tabelą, nie wyliczenie „z czegoś
  podobnego".
- „Nie jestem pewien, czy to mój zakres" → **nie jest**; wpis do „Znalezisk"
  i idziesz dalej.

---

## 11. NA KONIEC

Ten dyżur domyka to, co dzień 14 świadomie zostawił, a nadzorca przekazał
`DEC-77`. Siedem pozycji, cztery rzeczy naprawdę ważne:

**Pierwsza — karta KPI przestaje kłamać przemilczeniem.** Historia i następny
obowiązek to dwa z sześciu elementów nagłówka, które od `DEC-61` stoją jako
uczciwe `BRAK_API`. Schemat pod oba **już istnieje** (`rvn_platform_events`,
`rvn_platform_obligations`, `measurement_frequency_days`) — to jest podłączenie,
nie budowa. I obowiązek zapisany nigdy nie zlewa się z wywnioskowanym.

**Druga — OKR dostaje jedno źródło prawdy zamiast dwóch.** `DEC-62` dwa razy
użyła słów „druga prawda". Set-scoped attention idzie **w SQL wspólnego
repozytorium**, agregat check-inów idzie **na serwer** — żeby nagłówek Setu
i szczegół KR nie liczyły tego samego dwoma wzorami.

**Trzecia — `asOf` przestaje być etykietą.** Dziś dwa uruchomienia tego samego
raportu na tę samą datę dają różne liczby i nic tego nie wykrywa. Po tym dyżurze
albo odtwarzasz stan historyczny deterministycznie, albo mówisz wprost, że się
nie da. Nigdy nie podajesz teraźniejszości za przeszłość.

**Czwarta — kontrola staje się sprawdzalna.** Osiem rodzin zawsze w komplecie,
każda z licznikiem, mianownikiem i dokładnym `drillDown`, a każdy próg pochodzi
z wiersza polityki — z pustej tabeli, którą wypełni decyzja Piotra, nie Ty.
`DEC-72` pochwaliła dzień 11 za „zero zaszytych wag". Nie psuj tego.

Jedna rzecz, którą ten dyżur ma zrobić lepiej niż poprzednie: **nie zostawić ani
jednego endpointu, który wygląda na działający, a nie jest.** `BRAK_API` /
`BRAK_ŹRÓDŁA` / STOP z pełną tabelą jest odpowiedzią. Endpoint, który „na razie
zwraca coś sensownego", nie jest.

I dwie rzeczy, których pilnujemy przed wszystkim innym: **czy każdy nowy
endpoint odmawia cudzej organizacji** (404/403, nigdy 200 z pustką) i **czy ani
jedna liczba w odpowiedzi nie została wymyślona**.

Zero UI. Zero chmury. Zero flag. Zero zaszytych progów. Pliki z listy wykluczeń
— nie Twoje. Reszta mechaniki tylnej — Twoja, do końca.

Powodzenia. Koordynacja w Bloku 0, raport na bieżąco, inwentarz przed każdą
pozycją, STOP bez wahania zamiast zgadywania, prettier przed każdym commitem,
Blok 5 zawsze, kontener i wolumeny sprzątnięte przed oddaniem.
