# INSTRUKCJA DYŻURU nr 38 — Codex — „BEZPIECZNIKI ŚRODOWISK I WDROŻEŃ (część repozytoryjna)"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–37. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-28.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**. Treści w kodzie i commitach: angielski.

---

## ★★ DLACZEGO TEN DYŻUR ISTNIEJE — jedno zdanie, które musisz zrozumieć

**Przez około dwa tygodnie aplikacja stagingu czytała INNĄ bazę danych niż ta,
którą migrowała bramka wdrożeniowa — i w całym repozytorium nie było ani jednego
mechanizmu, który by to wykrył.**

Stan rozstrzygnięty w rejestrze decyzji jako `DEC-2026-08-28-165`
(`docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md:216`,
status **SUPERVISOR_ACCEPT — BLOKER DEPLOYU**) i sprostowany w
`DEC-2026-08-28-172` (`:223`). Skrót mapy, którą tam ustalono:

| Rola | Host proxy | Co tam było |
| --- | --- | --- |
| aplikacja stagingu (`DATABASE_URL` usługi `consultify`) | `trolley` | 1753 tabele, ostatnia migracja **2026-08-13**, **106 migracji pending**, brak `tool_outputs` |
| bramka migracji (`Postgres-Rehearsal-20260820`) | `sakura` | 1766 tabel, 794 migracje, 0 błędów, `tool_outputs` obecne |
| usługa `Postgres` środowiska staging (martwa) | `thomas` | 1000 tabel, ostatnia migracja 2026-07-05 |
| produkcja | `centerbeam` | — |

**Bezpośrednia przyczyna pomyłki: trzy różne bazy nazywają się `railway`.**
Do tego dochodzi druga pułapka nazewnicza, ustalona w `DEC-172`: **domeny Railway
są SKRZYŻOWANE** — środowisko `staging` ma wygenerowaną domenę zawierającą słowo
„demo", a środowisko `demo` — domenę zawierającą słowo „staging". Człowiek, który
czyta nazwę hosta i wyciąga z niej wniosek o środowisku, **myli się systematycznie**.

**Twoje zadanie: sprawić, żeby REPOZYTORIUM potrafiło to wykryć.** Nie żeby
naprawiło środowiska — środowisk nie dotykasz w ogóle (§ poniżej). Masz zostawić
po sobie kod, który przy następnym takim rozjeździe **zatrzyma wdrożenie** albo
przynajmniej **wypisze go w logu tak, żeby dało się go zobaczyć gołym okiem
w pięć sekund**.

---

## ★★ GRANICA ZAKRESU — najważniejszy akapit tej instrukcji

**TEN DYŻUR DOTYKA WYŁĄCZNIE PLIKÓW W REPOZYTORIUM. ZERO KONTAKTU Z RAILWAY,
DEMO, STAGINGIEM I PRODUKCJĄ.**

Konkretnie i bez interpretacji:

1. **Nie otwierasz Railway** — ani panelu, ani `railway` CLI, ani
   `backboard.railway.app/graphql/v2`, ani żadnego innego endpointu Railway.
2. **Nie ustawiasz i nie odczytujesz żadnej zmiennej środowiskowej w Railway.**
   Zmienne, które ta praca **wymaga ustawienia** (`DB_TARGET_LABEL`,
   `STAGING_DB_HOST_FINGERPRINT`, `DEMO_DB_HOST_FINGERPRINT`,
   `PRODUCTION_DB_HOST_FINGERPRINT`, GitHub `vars.STAGING_FRONTEND_URL` itd.),
   **ustawia nadzorca albo właściciel — osobno, poza tym dyżurem.** Twoim
   produktem jest **lista tych zmiennych, ich znaczenie i skutek ich braku**,
   opisane w kodzie, w dokumencie operacyjnym i w raporcie.
3. **Nie strzelasz `curl`/`fetch`/`ping`/`psql`/`nc`/`dig`/`nslookup`/`host`
   w żaden host `*.consultify.ai`, `*.consultinity.ai`, `*.proxy.rlwy.net`,
   `*.railway.internal`, `*.up.railway.app` ani `backboard.railway.app`** — także
   „tylko żeby sprawdzić, czy odpowiada", także „tylko `HEAD`", także „tylko DNS".
   To jest zakaz **Z28** i nie ma od niego wyjątku (§0.2).
4. **Nie uruchamiasz `scripts/deploy-demo.sh`, `scripts/seed-m16-demo.py`,
   `scripts/test-m16-api-sweep.py` ani żadnego skryptu, który ma w sobie adres
   zdalny.** Zmieniasz ich treść — nie uruchamiasz ich.
5. **Nie robisz `railway login`, nie czytasz `~/.railway/config.json`.**
   Ten plik zawiera token dostępowy właściciela.

**Jeżeli w trakcie pracy dojdziesz do wniosku, że „bez sprawdzenia na żywo nie da
się tego zrobić dobrze" — to jest STOP pozycji, nie licencja na połączenie.**
Piszesz pozycję STOP w raporcie z uzasadnieniem i idziesz dalej. Nadzorca ma
dostęp do środowisk; Ty nie.

---

## ★ CO JEST, A CZEGO NIE MA W ZAKRESIE

**JEST (siedem pozycji roboczych §A–§G + dwie dokumentacyjne §R.1, §R.2):**

| Poz. | Plik(i) | Sedno |
| --- | --- | --- |
| §A | `scripts/validate-deploy-target.sh` | poprawna allowlista domen per środowisko + **nowy blok kontroli celu bazy** |
| §B | `server/src/config/dbTargetLabel.ts` (nowy), `server/scripts/release-migration-gate.ts`, `server/src/database/PostgresDatabase.ts` | etykieta `DB_TARGET_LABEL` w **obu** liniach logu — porównywalna para |
| §C | `tests/integration/_helpers/assertRealPostgres.ts` | uzupełnienie denylisty hostów + naprawa błędnego komentarza |
| §D | `scripts/seed-m16-demo.py` | **usunięcie hasła z repozytorium** + naprawa błędnego komentarza bezpieczeństwa |
| §E | `scripts/deploy-demo.sh` | skrypt omija bramkę — albo ją woła, albo jawnie dokumentuje wyjątek i ma własną kontrolę celu |
| §F | `docs/operations/RAILWAY_DB_TARGET_RULES.md`, `docs/operations/DB_DATA_RELEASE_GATE.md`, `docs/operations/CRITICAL_SERVICES.md` | doprowadzenie do stanu faktycznego + ostrzeżenie o pułapce nazewniczej |
| §G | `tests/unit/deploy/validate-deploy-target.test.mjs` (nowy) | test regresyjny bezpieczników, **bez sieci i bez bazy** |
| §R.1 | `docs/.../DEPLOY_GUARDS_DAY38_REPORT_20260828.md` | JEDEN raport dyżuru |
| §R.2 | (bez nowego pliku) | „Znaleziska" i „Skutki operacyjne" **wewnątrz** raportu §R.1 |

**NIE JEST — cokolwiek Ci po drodze przyjdzie do głowy, idzie do „Znalezisk"
w raporcie, nie do kodu:**

- **Cały katalog `src/` (front) — poza zakresem do zapisu.** Wolno czytać.
- **Zmiany w `.github/workflows/railway-deploy.yml`** — poza zakresem do zapisu
  (§A.6 wyjaśnia dlaczego: workflow jest ścieżką operacyjną nadzorcy, a wartości
  `vars.*` i tak ustawia się poza repo). Wolno czytać i **opisać w raporcie**,
  co nadzorca musi tam zmienić.
- **Rename usług Railway, przepięcie `DATABASE_URL` na referencje `${{ }}`,
  włączenie PITR, backupy, wybór „która baza jest bazą stagingu"** — to są
  decyzje właściciela z `DEC-165`/`DEC-172` (etapy E0, E2, E3, E4, E5).
  **★ `DEC-172` zawiera ostrzeżenie, którego nie wolno Ci zignorować nawet
  w dokumentacji: rename usługi `Postgres` ZABIŁBY PRODUKCJĘ**, bo prywatna
  domena `postgres.railway.internal` wywodzi się z nazwy usługi, a produkcja ma
  ją wpisaną na sztywno. Nie sugerujesz renamów w dokumentach.
- **Naprawa `server/src/config/databaseTargetResolver.ts`** — poza zakresem do
  zapisu. To jedyny działający dziś bezpiecznik anty-produkcyjny (`['centerbeam']`,
  linia 41) i jest **zależny od nazwy proxy, która może się zmienić**. Masz to
  **opisać w raporcie jako znalezisko** i **odnotować w dokumencie operacyjnym**,
  ale nie przerabiasz go w tym dyżurze — dołożenie tam fingerprintów bez decyzji
  właściciela (etap E5) może zablokować produkcję.
- **Migracje SQL.** Ten dyżur nie tworzy ani jednej. Przydział `20261270-79`
  istnieje wyłącznie po to, żeby nikt inny go nie zajął; **oczekiwany stan
  końcowy to ZERO plików w tym przedziale** (§0.6).
- Refaktory, sprzątanie martwego kodu, ujednolicanie stylu skryptów, migracja
  `scripts/*.py` na TypeScript, poprawianie innych skryptów w `scripts/`.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **gałąź `codex/m03-admin-20260824`**, przypięta do
   commitu-markera podanego niżej.

   **SHA markera: 3e707a9d3c**

   > **★★ RAMKA WARTOWNIKA — CAŁA W BLOKU CYTOWANYM.**
   >
   > Powyżej stoi **wartownik** — literał `«MARKER_SHA»` w cudzysłowach
   > francuskich. To **nie jest** SHA. To jest sygnał, że nadzorca **jeszcze nie
   > związał markera** z realnym commitem.
   >
   > **Obecność wartownika = STOP CAŁEGO DYŻURU.** Nie zgadujesz SHA, nie bierzesz
   > tipa gałęzi „bo pewnie o to chodziło", nie startujesz z `origin/demo`.
   > Zakładasz raport (§R.1), wpisujesz pozycję STOP z treścią tej ramki
   > i kończysz dyżur.
   >
   > **Procedura wiązania (robi ją NADZORCA, nie Ty):** podmienia **wyłącznie
   > pole „SHA markera"** w punkcie 1 na realny, dziesięcioznakowy SHA tipa
   > gałęzi `codex/m03-admin-20260824` z chwili wydania zlecenia. **Podmiana
   > globalna po całym pliku jest zakazana** — w dyżurze nr 32 taka podmiana
   > weszła również w treść tej ramki i ramka zaczęła wskazywać prawdziwy marker
   > jako wartownik; dyżur zatrzymał się i słusznie. Dlatego ta ramka **nie
   > zawiera i nie może zawierać żadnego SHA** poza polem markera.
   >
   > Gdy marker jest związany, ta ramka nadal obowiązuje w jednym punkcie:
   > jedyny STOP z tytułu markera to negatywny wynik weryfikacji z pkt 2
   > (`MARKER BRAK`). Sam związany SHA w polu markera to stan **POPRAWNY**.

2. **Sprawdzasz marker PIERWSZĄ komendą dyżuru** (podstawiając za `<SHA>` to, co
   realnie stoi w polu markera — jeżeli stoi tam wartownik, patrz ramka wyżej):

   ```bash
   cd /Users/piotrwisniewski/Developer/Consultify-final-mvp-integration-20260823
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor <SHA> codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

3. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/preserve-*` ani z żadnej gałęzi dni 17–37. Załóż raport, wpisz pozycję
   STOP z wynikiem obu komend i zakończ dyżur.

   **Reguła rozejścia (`DEC-2026-08-26-95`).** Jeżeli marker JEST przodkiem, ale
   tip uciekł do przodu — **to nie jest STOP**. Startujesz **dokładnie z markera**,
   wypisujesz w raporcie `git log --oneline <SHA>..codex/m03-admin-20260824`
   i listę plików rozejścia. Scalenie z nowszym tipem wykonuje nadzorca przy
   odbiorze. **Rebase w trakcie dyżuru: ZAKAZANY.**

4. **Własna gałąź i własny worktree** (nigdy praca na `codex/m03-admin-20260824`):

   ```bash
   cd /Users/piotrwisniewski/Developer/Consultify-final-mvp-integration-20260823
   git branch codex/deploy-guards-day38-20260828 <SHA>
   git worktree add /private/tmp/consultify-deploy-guards-day38 codex/deploy-guards-day38-20260828
   cd /private/tmp/consultify-deploy-guards-day38
   ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules node_modules   # DEC-86, TYLKO ODCZYT
   ```

5. **★ KOMENDA BAZOWA — wszystkie porównania w raporcie robisz wobec markera**,
   nigdy wobec `HEAD~1`:

   ```bash
   git diff --name-only <SHA>...HEAD
   ```

   Ta komenda ma w tym dokumencie własną nazwę — **„komenda bazowa"** — i wraca
   w §0.6 i w szablonie raportu. Wynik wklejasz do raportu dosłownie.

### 0.2. Bezwzględne ZAKAZY

| # | Zakaz | Dlaczego |
| --- | --- | --- |
| Z1 | **Żadnego `git push` na `origin`** — na żadną gałąź. Push wykonuje wyłącznie nadzorca | Push na `origin`/demo = ścieżka nadzorcy |
| Z2 | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*` | `demo` = święta baza; cudze gałęzie to praca w toku albo zamknięte dowody odbiorowe |
| Z3 | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4 powstał tak; `DEC-95` |
| Z4 | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) | Wymagania są w rejestrze uwag i w decyzjach |
| Z5 | **★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-86` | Chroniony, brudny worktree właściciela |
| Z6 | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` — w chwili wystawienia żyje ich kilkadziesiąt | Cudze dyżury pracują równolegle |
| Z7 | **Nie zajmujesz portów sesyjnych. TWÓJ KONTENER PG = `5617`.** Zakazane wprost, także gdy akurat wolne: **5432, 5474, 5498, 5499, 5511, 5512, 5521, 5533, 5544, 5556, 5563, 5566, 5567, 5571, 5573, 5575, 5577, 5581, 5588, 5589, 5591, 5597, 5602, 5605, 5613, 5629, 5641, 55291, 55677, 55941, 59321**. Port zajęty → bierzesz pierwszy wolny **powyżej 5617** i wpisujesz go **jawnie** do raportu | Cudze dyżury pracują równolegle; tamte porty bywają wskrzeszane przez odbiorców |
| Z8 | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (`DEC-65`) | Produkcja/demo poza zakresem |
| Z9 | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo/staging/produkcja, nigdy cudza retained-DB. **KOREKTA `DEC-2026-08-26-98`: Z9 przerywa DANĄ CZYNNOŚĆ, nie cały dyżur** (ramka pod tabelą) | „dane demo = twarz produktu" (`DEC-65`) |
| Z10 | **Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej flagi.** Także zero „tymczasowej flagi na czas testu" | CLAUDE.md reguła 9. **Zmienna środowiskowa BEZPIECZNIKA nie jest flagą funkcyjną** — patrz ramka pod tabelą, to jest wyjątek konstytutywny dla tego dyżuru |
| Z11 | **Nie zmieniasz tras HTTP, montaży w `server/src/Gateway.ts`, `src/routes/**` ani gramatyki tras.** Ten dyżur nie dodaje ani jednej trasy | Gramatyka zaakceptowana (`DEC-2026-08-24-07`) |
| Z12 | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN nowy plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/DEPLOY_GUARDS_DAY38_REPORT_20260828.md`. Poza nim wolno zmienić wyłącznie trzy dokumenty operacyjne z §F | Repo tonie w dokumentach-duchach |
| Z13 | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie. Uważasz, że decyzja się myli → **errata w raporcie**, nie patch w rejestrze | Rejestr decyzji jest `FINAL / IRREVOCABLE` |
| Z14 | **★★ ZERO LLM.** Zero `llmService`, zero `initializeAI()`, zero kluczy AI w jakimkolwiek środowisku, zero tras `/api/ai/**` | Silnik AI = osobny moduł, ostatni w programie; `DEC-51` |
| Z15 | **★★ ZERO ZMYŚLANIA. Brak danych = uczciwy zapis „nie wiem", nigdy wypełniacz.** W tym dyżurze wariant szczególnie kuszący: **wpisanie do dokumentu operacyjnego hosta/portu/ID, którego nie zweryfikowałeś w repo.** Nazwy hostów wolno Ci przepisać **wyłącznie** z rejestru decyzji albo z pliku w repo, z podaniem `plik:linia` | Dokument operacyjny ze zmyśloną mapą hostów jest gorszy niż brak dokumentu |
| Z16 | **★ NIETYKALNE DO ZAPISU: `server/src/config/databaseTargetResolver.ts`, `server/src/config/DatabaseConfig.ts`, `server/scripts/migrate.postgres.ts`, `server/src/services/releaseGate/gateContract.ts`, `server/src/services/releaseGate/sqlChainEvaluator.ts`, `.github/workflows/**`.** Wolno **czytać** i **wołać** | To są działające bezpieczniki i ścieżki operacyjne nadzorcy; ich zmiana bez decyzji właściciela (etap E5) może zablokować produkcję |
| Z17 | **★ Zakaz wszystkiego poza wskazanym zakresem** (§ „CO JEST, A CZEGO NIE MA W ZAKRESIE"). Cały `src/**` do zapisu: **NIE** | „jeden moduł na raz" |
| Z18 | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config*.ts`. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru** | Dyżur nr 2 wywalił tak 27 cudzych testów. **UWAGA: `tests/integration/_helpers/assertRealPostgres.ts` jest wyjątkiem imiennym — to jest §C** |
| Z19 | **★★ ZAKAZ uruchamiania jakichkolwiek testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, podanego W TEJ SAMEJ LINII komendy — PIĘĆ zmiennych, nie dwie** (Z25/Z26 + ramka w §0.4) | Bez tego warstwa DB cicho mockuje i mierzysz atrapę |
| Z20 | **★ DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`) — ramka pod tabelą | Bramka DoD dnia 60 przepuściła „ZROBIONE" przy czterech martwych gałęziach |
| Z21 | **★ Test wstrzykujący zależności NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`). Wariant tego dyżuru: **test, który sam definiuje funkcję sprawdzającą allowlistę zamiast uruchomić `scripts/validate-deploy-target.sh`, nie dowodzi niczego.** §G ma **odpalać realny plik `.sh`** przez `spawnSync` | Dzień 18: 8/8 zielonych, warstwa martwa |
| Z22 | **★ Zakaz atrapy z zewnętrznym skutkiem** (`DEC-2026-08-26-108`). Wariant tego dyżuru: **bezpiecznik, który wypisuje ostrzeżenie i zwraca `exit 0`.** Bezpiecznik ma **`exit 1`** albo go nie ma | „Ostrzeżenie" w logu CI nie zatrzymało jeszcze nigdy żadnego deployu |
| Z23 | **★ Pomiar testów BEZ ZAWĘŻANIA** (`DEC-2026-08-26-108`) — wynik z **PEŁNEGO zakresu §0.4**, z rozbiciem **ZASTANE / WPROWADZONE** i liczbą **SKIPPED** | Dzień 19 zadeklarował „98/98 PASS" przy 189/193 w zakresie własnej instrukcji |
| Z24 | **★ Commit per pozycja.** Commity wg zamkniętej listy z §H, nigdy jeden zbiorczy | Dzień 24 wrzucił cztery pozycje w jeden commit i żadna nie dostała `ZROBIONE_WG_DoD` |
| **Z25** | **★ JAWNY `DATABASE_URL` WŁASNEGO POSTGRESA.** Każda komenda dotykająca bazy ma `DATABASE_URL="postgres://postgres:cx@localhost:5617/cx_day38"` **w tej samej linii**. Nigdy z pliku `.env`, nigdy z eksportu w profilu powłoki, nigdy „bo i tak jest ustawiony" | Wartość odziedziczona po powłoce to najkrótsza droga do pomiaru na cudzej bazie |
| **Z26** | **★ `RUN_DB_TESTS=1 MOCK_DB=false` — jawnie, w tej samej linii.** `tests/setup.ts` ustawia `MOCK_DB='true'`, gdy zmiennej nie ma, a `server/src/database/Database.ts` przy `MOCK_DB==='true'` podstawia mock **bezwarunkowo**. Dodatkowo globalny mock `auth.middleware.js` przy `MOCK_DB !== 'false'` wstrzykuje `role: 'owner', isSuperAdmin: true` — anonim dostaje `200` zamiast `401` | Test bez tych dwóch zmiennych zieleni się nie dotknąwszy Postgresa |
| **Z27** | **★ ZAKAZ `git stash` i ZAKAZ `cp` jako sposobu pracy z plikami repo.** Żadnego `cp plik plik.bak`, `cp -r katalog katalog.old`, żadnego „odłożę zmiany na stashu i wrócę". Zmiany trzymasz w commitach na własnej gałęzi; wariant do porównania robisz **osobnym commitem albo `git show <ref>:<ścieżka>` do katalogu POZA worktree** | `stash` gubi się między worktree i bywa przywracany do cudzego; `.bak`/`.old` zostają w repo i trafiają do commita — repo ma już taką historię |
| **Z28** | **★★ ZAKAZ JAKIEGOKOLWIEK POŁĄCZENIA SIECIOWEGO DO RAILWAY / DEMO / STAGINGU / PRODUKCJI — także „tylko żeby sprawdzić".** Zakazane wprost: `curl`, `wget`, `fetch`, `ping`, `nc`, `telnet`, `psql`, `pg_dump`, `dig`, `nslookup`, `host`, `openssl s_client`, przeglądarka, `railway` CLI — skierowane w `*.consultify.ai`, `*.consultinity.ai`, `*.proxy.rlwy.net`, `*.railway.internal`, `*.up.railway.app`, `backboard.railway.app`. Zakazane także **uruchomienie skryptu, który to robi za Ciebie** (`scripts/deploy-demo.sh`, `scripts/seed-m16-demo.py`, `scripts/test-m16-api-sweep.py`, `playwright.demo-acceptance.config.ts`, `playwright.qa.config.ts`, `npm run test:e2e*`). **Naruszenie = odrzucenie CAŁEGO dyżuru, niezależnie od jakości kodu.** Jedyny ruch sieciowy, jaki wolno Ci wykonać, to `docker pull postgres:*` i `git fetch` z lokalnego remote'a | Ten dyżur powstał, bo środowiska są **w rozjeździe i pod decyzją właściciela**. Każde Twoje połączenie może trafić w bazę, o której losie właściciel jeszcze nie zdecydował — a `seed-m16-demo.py` ma w sobie działające hasło, więc „sprawdzenie" bywa **zapisem** |

**★ Z9 — procedura po korekcie `DEC-2026-08-26-98` (nie zabijaj dyżuru).**
Jeżeli złapiesz się na komendzie DB bez przypiętego env: **zatrzymaj tę komendę →
ustal skutek (czy w ogóle doszło do połączenia i czy był ZAPIS) → zapisz
ustalenie w raporcie → przypnij env → KONTYNUUJ pozycję.** Twardy STOP całego
dyżuru **wyłącznie** przy stwierdzonym realnym **zapisie** do bazy spoza dyżuru.
`localhost:5432/iris_test` to wewnętrzny fallback konwencji testowej repo
(`tests/setup.ts`), nie obca baza — ale i tak nie mierzysz przeciwko niemu
(port 5432 jest w Z7 zakazany wprost).

**★ Z10 — dlaczego zmienna bezpiecznika NIE jest flagą funkcyjną.**
Flagą funkcyjną jest przełącznik, który **zmienia zachowanie działającej ścieżki
produktowej dla istniejących użytkowników**. **Nie jest** flagą:
`DB_TARGET_LABEL` (etykieta w logu), `STAGING_DB_HOST_FINGERPRINT` /
`DEMO_DB_HOST_FINGERPRINT` / `PRODUCTION_DB_HOST_FINGERPRINT` (deklaracja
oczekiwanego celu bazy), `M16_SEED_PASSWORD` (sekret wyjęty z repo).
To są **parametry bezpiecznika** — bez nich bezpiecznik **odmawia**, a nie
„działa po staremu". Tym różnią się od flagi: **flaga domyślnie wyłączona
przepuszcza; bezpiecznik bez parametru blokuje.**
**Jeżeli łapiesz się na tym, że Twoja zmienna ma sensowną wartość domyślną
wpisaną w repo — to znaczy, że wpisujesz do repo realny host. STOP.** (§A.4)

**★ Z20 — jak wygląda dowód osiągalności w TYM dyżurze.**
Nie wystarczy „funkcja istnieje i ma test jednostkowy". Dla **każdej** pozycji
podajesz w raporcie ścieżkę od realnego wejścia do skutku:

```
realne wejście (kto i czym uruchamia: krok workflow / preDeployCommand / start aplikacji / komenda operatora)
  → plik:linia, w którym bezpiecznik jest wołany
  → warunek, przy którym ODMAWIA (dokładny komunikat + kod wyjścia)
  → co widzi człowiek (linia logu, dosłownie)
  → czym to jest przykryte w testach (plik:test)
```

**★★ UCZCIWA FORMA OSTATNIEGO OGNIWA W TYM DYŻURZE.** Trzy z siedmiu pozycji
(§A, §B, §E) mają ostatnie ogniwo **poza repozytorium** — w zmiennych, które
ustawia nadzorca. **Piszesz to wprost**: „ostatnie ogniwo = zmienna `X` ustawiona
w środowisku `Y` przez nadzorcę; w repo kończy się na porównaniu i komunikacie
odmowy". **Nie wolno Ci** ustawić tej zmiennej gdziekolwiek zdalnie, żeby ogniwo
„domknąć", i **nie wolno Ci** przemilczeć, że ogniwo jest otwarte.

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

**Wyjątek imienny:** `tests/integration/_helpers/assertRealPostgres.ts` — to jest
pozycja §C i wolno Ci go zmienić **wyłącznie w zakresie opisanym w §C**
(denylista + komentarz). Ani jednej linii logiki poza tym.

---

### 0.3. Weryfikacja stanu wejściowego (warunek wstępny, NIE formalność)

Sprawdzasz sam; wynik jest **obowiązkową pozycją raportu**. Każda komenda ma
podany oczekiwany wynik — **rozbieżność idzie do „Korekt wobec instrukcji", nie
do improwizacji**. Wykonujesz to w worktree z §0.1 pkt 4.

```bash
# (a) sedno §A — bramka celu wdrożenia
grep -c "" scripts/validate-deploy-target.sh                    # oczekiwane: 63
grep -n "allowed_hosts=" scripts/validate-deploy-target.sh      # oczekiwane: 2 trafienia (:23 staging, :28 production)
grep -c "staging.consultify.ai" scripts/validate-deploy-target.sh   # oczekiwane: 0  ← ★ TO JEST §A
grep -c "demo)" scripts/validate-deploy-target.sh               # oczekiwane: 0  ← ★ brak case'u demo
grep -ci "DATABASE\|DB_HOST\|FINGERPRINT" scripts/validate-deploy-target.sh  # oczekiwane: 0  ← ★ zero kontroli bazy

# (b) sedno §B — para linii logu, która ma stać się porównywalna
grep -n "host redacted" server/scripts/release-migration-gate.ts      # oczekiwane: 1 trafienie (~:236)
grep -n "RELEASE_MIGRATION_GATE_PASS" server/scripts/release-migration-gate.ts  # oczekiwane: 1 trafienie (~:294)
grep -n "\[Postgres\] Config" server/src/database/PostgresDatabase.ts # oczekiwane: 1 trafienie (~:457)
grep -rn "DB_TARGET_LABEL" server/ src/ scripts/ 2>/dev/null | grep -v node_modules  # oczekiwane: 0 trafień
grep -c "" server/src/services/releaseGate/gateContract.ts            # oczekiwane: 48

# (c) sedno §C — denylista testów
grep -n "FORBIDDEN_DB_HOSTS" -A 6 tests/integration/_helpers/assertRealPostgres.ts
# oczekiwane: 3 wpisy (centerbeam / trolley / ballast); komentarz przy trolley: "DEMO / staging"
grep -c "sakura\|thomas\|caboose" tests/integration/_helpers/assertRealPostgres.ts   # oczekiwane: 0  ← ★ TO JEST §C

# (d) sedno §D — hasło w repozytorium
grep -n "password" scripts/seed-m16-demo.py    # oczekiwane: 1 trafienie w słowniku LOGIN (~:29)
grep -n "caboose" scripts/seed-m16-demo.py     # oczekiwane: 1 trafienie w komentarzu (~:15)
grep -c "" scripts/seed-m16-demo.py            # oczekiwane: 312

# (e) sedno §E — skrypt omijający bramkę
grep -c "validate-deploy-target" scripts/deploy-demo.sh   # oczekiwane: 0  ← ★ TO JEST §E
grep -n "force-with-lease\|serviceInstanceDeploy" scripts/deploy-demo.sh  # oczekiwane: 2 trafienia (~:44, ~:50)

# (f) sedno §F — dokumenty operacyjne
grep -c "" docs/operations/RAILWAY_DB_TARGET_RULES.md   # oczekiwane: 55
grep -c "" docs/operations/DB_DATA_RELEASE_GATE.md      # oczekiwane: 47
grep -c "" docs/operations/CRITICAL_SERVICES.md         # oczekiwane: 148  ← ★ przeczytaj §F.3 ZANIM go otworzysz
grep -rc "trolley\|sakura\|thomas" docs/operations/     # oczekiwane: same zera

# (g) sedno §G — wzorzec testu skryptu repo (node:test + spawnSync)
ls tests/unit/release/                                  # oczekiwane: 2 pliki .test.mjs
grep -n "spawnSync\|node:test" tests/unit/release/verify-release-candidate-bundle.test.mjs | head
ls tests/unit/deploy/ 2>/dev/null                       # oczekiwane: katalog NIE ISTNIEJE (tworzysz go w §G)

# (h) rejestr decyzji — źródło mapy hostów
grep -c "" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md  # oczekiwane: 225
grep -c "DEC-2026-08-28-165" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md  # oczekiwane: >= 1
grep -c "DEC-2026-08-28-172" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md  # oczekiwane: >= 1
```

### 0.4. Kontener bazy — kiedy jest potrzebny i jak go stawiasz

**★ Ten dyżur w większości nie potrzebuje bazy.** §A, §D, §E, §F i §G są
w całości bezbazowe i bezsieciowe. Kontener stawiasz **wyłącznie na potrzeby §C**
— żeby udowodnić, że po zmianie denylisty strażnik `assertRealPostgresTestEnvironment`
**nadal przepuszcza legalny host lokalny** i **odmawia na haśle z denylisty**.
Bez tego dowodu §C jest zmianą stałej bez pokrycia.

```bash
docker run -d --name cx-day38-pg -p 5617:5432 \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day38 postgres:17

# dowód celu połączenia — DOSŁOWNY wynik idzie do raportu
docker exec cx-day38-pg psql -U postgres -d cx_day38 -c "SELECT current_database(), inet_server_port();"
docker port cx-day38-pg
```

**★★ Z25/Z26 — PIĘĆ zmiennych w tej samej linii, i dlaczego to nie jest
biurokracja.** Wzór, którym uruchamiasz **każdy** test dotykający bazy:

```bash
DATABASE_URL="postgres://postgres:cx@localhost:5617/cx_day38" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
npx vitest run <plik>
```

Powody, każdy sprawdzalny w repo:

- `server/src/database/Database.ts` — `process.env.MOCK_DB === 'true'` podstawia
  **mock DB BEZWARUNKOWO**, niezależnie od `RUN_DB_TESTS`;
- `tests/setup.ts` — `process.env.MOCK_DB = process.env.MOCK_DB || 'true'`,
  czyli **brak jawnego `MOCK_DB=false` USTAWIA `MOCK_DB='true'`**;
- `tests/setup.ts` — globalny mock `auth.middleware.js`: przy braku nagłówka
  `Authorization` i przy `MOCK_DB !== 'false'` wstrzykuje użytkownika
  `role: 'owner', isSuperAdmin: true`;
- `tests/integration/_helpers/assertRealPostgres.ts:53-58` — sam strażnik, który
  zmieniasz w §C, **czyta obie te zmienne i pada bez nich**. Uruchomienie testu
  §C bez nich to test tego, że strażnik pada — a nie tego, że denylista działa.

**Sprzątanie — obowiązkowe, na koniec dyżuru, przed commitem raportu:**

```bash
docker rm -fv cx-day38-pg
docker ps -a --filter name=cx-day38 --format '{{.Names}}'   # oczekiwane: pusto
```

Wynik obu komend wklejasz do raportu. **Kontener zostawiony przy życiu = pozycja
„Sprzątanie" w raporcie na NIE**, niezależnie od reszty.

### 0.5. Zakres pomiaru testów (Z23 — bez zawężania)

Mierzysz **przed** pracą (ZASTANE) i **po** pracy (WPROWADZONE), na dokładnie tym
samym zakresie, i podajesz **PASS / FAIL / SKIPPED** dla każdego przebiegu:

```bash
# 1) testy skryptów repo (node:test, bez sieci, bez bazy)
node --test tests/unit/release/ tests/unit/deploy/ 2>&1 | tail -20

# 2) kontrakt bramki wydania (vitest, bez bazy)
npx vitest run server/src/services/releaseGate/__tests__/ --reporter=verbose

# 3) konfiguracja celu bazy (vitest, bez bazy)
npx vitest run --reporter=verbose $(git ls-files 'server/src/config/__tests__/*databaseTarget*' 'server/src/config/__tests__/*dbTarget*' 2>/dev/null)

# 4) TYLKO gdy dotknąłeś §C — strażnik testów integracyjnych, z pełnym env (§0.4)
DATABASE_URL="postgres://postgres:cx@localhost:5617/cx_day38" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
npx vitest run tests/integration/_helpers --reporter=verbose
```

**★ Pakiet w całości `SKIPPED` zaraportowany jako `PASS` = zawyżenie i podstawa
odrzucenia pozycji.** Jeżeli któryś z czterech przebiegów nie ma ani jednego
testu (`--passWithNoTests` zieleni pustkę), piszesz w raporcie „0 testów
w zakresie" — nie „PASS".

**Zakazane w pomiarze (Z28):** `npm test`, `npm run test:all`, `npm run test:e2e*`,
`playwright test` w jakiejkolwiek postaci. Pierwsze dwa ciągną tysiące testów
i minuty; ostatnie dwa **strzelają w `demo.consultify.ai`**
(`playwright.qa.config.ts:3`, `playwright.demo-acceptance.config.ts:5`).

### 0.6. Przydział migracji — oczekiwane ZERO

Ten dyżur ma zarezerwowany przedział numerów migracji **20261270–20261279**
i **nie tworzy żadnej migracji**. Rezerwacja istnieje wyłącznie po to, żeby
równoległe dyżury nie zajęły tych numerów.

**Dowód w raporcie (obowiązkowy):**

```bash
ls server/migrations/ | grep -E '^2026127[0-9]' | wc -l   # oczekiwane: 0
git diff --name-only <SHA>...HEAD -- server/migrations/    # oczekiwane: pusto
```

**Jeżeli którakolwiek z tych komend zwróci cokolwiek — to jest STOP pozycji
i wpis do raportu.** Bezpiecznik środowiskowy, który wymaga migracji SQL, jest
projektowo błędny: bezpiecznik ma czytać konfigurację, nie schemat.

### 0.7. ★ KOLIZJE Z RÓWNOLEGŁYMI DYŻURAMI — sprawdzasz PRZED pierwszą zmianą

Równolegle żyją dyżury **34, 35, 36 i 37**. Ich zakresy plikowe:

| Dyżur | Bierze | Kolizja z 38? |
| --- | --- | --- |
| 34 | `server/src/services/documentStudio/**` i okolice | **nie** |
| 35 | `src/components/Initiatives/**`, `src/components/Execution/**` | **nie** |
| 36 | **`scripts/` — seedy danych demo** | **★ TEN SAM KATALOG — patrz ramka** |
| 37 | `server/src/middleware/auth.middleware.ts`, `server/src/routes/assessment*` | **nie** |

> **★★ ROZSTRZYGNIĘCIE KOLIZJI W `scripts/` — dyżur 36 vs dyżur 38.**
>
> Oba dyżury pracują w katalogu `scripts/`, ale na **rozłącznych plikach**.
> Podział jest **imienny i zamknięty**:
>
> **DYŻUR 38 (Ty) bierze DOKŁADNIE TRZY pliki w `scripts/`:**
> - `scripts/validate-deploy-target.sh` (§A)
> - `scripts/deploy-demo.sh` (§E)
> - `scripts/seed-m16-demo.py` (§D) — **wyłącznie w zakresie wyjęcia hasła
>   i naprawy błędnego komentarza bezpieczeństwa**; logiki seedu nie dotykasz
>
> **DYŻUR 36 bierze seedy danych demo**, w szczególności (lista poglądowa,
> zweryfikuj komendą niżej): `scripts/rn-g6-a2-seed-gate-dataset.mjs`,
> `scripts/rn-g6-seed-runtime-dataset.ts`, `scripts/seed-method-packs.ts`,
> `scripts/seed-method-packs-siri.ts`, `scripts/seed-mindmap-showcase.mjs`,
> `scripts/seed-mindmap-showcase-railway.mjs`, `scripts/fix_demo_i18n.py`.
>
> **★ Punkt sporny: `scripts/seed-m16-demo.py` jest seedem demo i mógł trafić
> do zakresu dyżuru 36.** Dlatego **przed pierwszą zmianą w §D** wykonujesz:
>
> ```bash
> ls docs/program/waves/WAVE_03_ACCEPTANCE/codex/ | grep -i "DAY3[4-7]"
> grep -rln "seed-m16-demo" docs/program/waves/WAVE_03_ACCEPTANCE/codex/ 2>/dev/null
> git branch -a --list 'codex/*day3[4-7]*'
> ```
>
> | Wynik | Co robisz |
> | --- | --- |
> | instrukcja dnia 36 **nie istnieje** w repo albo **nie wymienia** `seed-m16-demo.py` | §D robisz normalnie. W raporcie wpisujesz dosłowny wynik obu `grep`ów jako dowód braku kolizji. |
> | instrukcja dnia 36 **wymienia `seed-m16-demo.py`** | **STOP POZYCJI §D.** Nie zmieniasz pliku. Wpisujesz do raportu pozycję STOP z cytatem i przekazujesz znalezisko o haśle nadzorcy. Reszta dyżuru (§A–§C, §E–§G) idzie normalnie. |
>
> **Reguła ogólna: kolizja plikowa = STOP tej pozycji, nigdy „scalę się z nimi
> później".** Dwie gałęzie zmieniające ten sam plik w tym samym tygodniu to
> konflikt, który rozstrzyga nadzorca przy odbiorze — nie Ty przy edycji.

Poza `scripts/` sprawdzasz kolizję jeszcze raz, tuż przed commitem:

```bash
git diff --name-only <SHA>...HEAD | sort > /private/tmp/day38-moje-pliki.txt
cat /private/tmp/day38-moje-pliki.txt
```

Oczekiwana zawartość to **wyłącznie** pliki z tabeli w § „CO JEST, A CZEGO NIE MA
W ZAKRESIE". Każdy plik spoza tej listy → usuwasz zmianę albo wpisujesz pozycję
STOP z wyjaśnieniem.

---

## 1. STAN ZASTANY — osiem ustaleń, każde z `plik:linia`

Wszystkie poniższe ustalenia zostały zweryfikowane w repozytorium na gałęzi
`codex/m03-admin-20260824` w dniu wystawienia instrukcji. **Zweryfikuj każde
własnym grepem (§0.3) — to są wyniki analizy, nie dogmat.** Rozbieżność →
„Korekty wobec instrukcji" w raporcie.

**U1. Bramka celu wdrożenia nie sprawdza bazy i ma złą allowlistę.**
`scripts/validate-deploy-target.sh:19-33` zna dwa środowiska: `staging`
i `production`. Dla `staging` allowlista brzmi
`allowed_hosts="demo.consultify.ai stage.consultinity.ai"` (`:23`) — **nie ma tam
`staging.consultify.ai`, a jest domena środowiska demo.** Skrypt sprawdza
dokładnie trzy rzeczy: git ref (`:35-44`), `RAILWAY_ENVIRONMENT_NAME`/
`TARGET_ENVIRONMENT` (`:46-48`) i host z `FRONTEND_URL` (`:50-61`).
**Nie sprawdza ani jednego parametru bazy danych.** Migracja wskazująca zły host
przeszłaby przez niego bez śladu — i przeszła.

**U2. Jedyny realny bezpiecznik bazy to jedna zmienna.**
`server/scripts/release-migration-gate.ts:234` woła
`assertExpectedTarget(databaseUrl, process.env.RELEASE_TARGET_DB_HOST_FINGERPRINT)`.
Implementacja: `server/src/services/releaseGate/gateContract.ts:33-47` — rzuca
wyjątek przy braku zmiennej (`:36-40`) i przy niedopasowaniu (`:41-46`).
Fingerprint jest **substringiem** hosta, porównywanym bez uwzględniania wielkości
liter. Wg `DEC-165`/`DEC-172` zmienna jest ustawiona w demo i staging, **a nie ma
jej w produkcji** — czyli **produkcja jest dziś jedynym środowiskiem bez tego
bezpiecznika**. To nie jest coś, co naprawiasz w tym dyżurze (etap E5 wymaga
osobnej zgody właściciela — `DEC-172`), ale **musi być jawnie napisane
w raporcie i w dokumencie operacyjnym**.

**U3. Test na nawrót rozjazdu jest dziś NIEMOŻLIWY.**
`server/scripts/release-migration-gate.ts:236` drukuje dosłownie
`target host verified against expected fingerprint (host redacted)`, a linia
sukcesu `:294` brzmi
`RELEASE_MIGRATION_GATE_PASS buildSha=... checks=... hostVerified=true` — **bez
hosta i bez żadnego identyfikatora bazy**. Aplikacja loguje swoją stronę osobno:
`server/src/database/PostgresDatabase.ts:457-461`, `[Postgres] Config:` z polami
`host`, `database`, `max`. **Tych dwóch linii nie da się dziś porównać** — jedna
zataja cel, druga podaje surowy host. `DEC-165` nazywa brakujący mechanizm wprost:
„TANI TEST NA NAWRÓT: w logach deployu para linii `RELEASE_MIGRATION_GATE_PASS`
i `[Postgres] Config: {host}` musi wskazywać TĘ SAMĄ bazę". **To jest §B.**

**U4. Denylista testów jest niepełna i ma mylący komentarz.**
`tests/integration/_helpers/assertRealPostgres.ts:28-32`:

```
const FORBIDDEN_DB_HOSTS = [
  'centerbeam.proxy.rlwy.net', // PROD
  'trolley.proxy.rlwy.net', // DEMO / staging
  'ballast.proxy.rlwy.net',
];
```

Komentarz przy `trolley` — „DEMO / staging" — **utrwala dokładnie tę pomyłkę,
która kosztowała dwa tygodnie**: wg `DEC-172` `trolley` to usługa `pgvector`
środowiska **demo**, a jednocześnie to na nią wskazywał `DATABASE_URL`
aplikacji **stagingu**. Brakuje trzech hostów z mapy `DEC-165`/`DEC-172`:
`sakura` (baza, którą migruje bramka), `thomas` (usługa `Postgres` stagingu,
wskazywana też przez środowisko `dev`) i `caboose`.

**U5. Jedyny działający bezpiecznik anty-produkcyjny wisi na nazwie proxy.**
`server/src/config/databaseTargetResolver.ts:41`:
`const DEFAULT_PRODUCTION_DB_HOST_FINGERPRINTS = ['centerbeam'];`
Lista jest rozszerzalna przez `PRODUCTION_DB_HOST_DENYLIST_EXTRA` (`:55-60`)
i **nigdy nie da się jej skurczyć** — to dobra konstrukcja. Ale cały mechanizm
zależy od **nazwy proxy Railway, która może się zmienić**. Plik jest w Z16
(nietykalny do zapisu); Twoim zadaniem jest **opisać to ryzyko** w §F, nie
przerabiać kod.

**U6. ★ ZNALEZISKO BEZPIECZEŃSTWA: hasło w repozytorium.**
`scripts/seed-m16-demo.py:29` zawiera
`LOGIN = {"email": "...", "password": "<hasło jawnym tekstem>"}`, a `:27`
`BASE = "https://demo.consultify.ai"`. Skrypt loguje się przez REST API
i **zapisuje dane** na środowisku demo. Komentarz bezpieczeństwa `:15`
(„Bezpieczeństwo: tylko demo.consultify.ai (caboose). NIE dotyka centerbeam/PROD.")
jest **błędny podwójnie**: (a) wskazuje `caboose` jako bazę demo — wg mapy
`DEC-165`/`DEC-172` demo to `trolley` (usługa `pgvector`), a `caboose` nie
występuje w tej mapie w ogóle; (b) sugeruje, że skrypt jest „bezpieczny", podczas
gdy nosi w sobie **działające poświadczenia właściciela**.
**Nie uruchamiasz tego skryptu (Z28). Nie testujesz, czy hasło działa.**

**U7. `deploy-demo.sh` całkowicie omija bramkę.**
`scripts/deploy-demo.sh` (102 linie) nie zawiera ani jednego odwołania do
`validate-deploy-target.sh`. Robi trzy rzeczy z zewnętrznym skutkiem:
czyta token z `~/.railway/config.json` (`:19-24`), wykonuje
`git push origin HEAD:demo --force-with-lease` (`:44`) i strzela mutacją GraphQL
`serviceInstanceDeploy` w **twardo wpisane ID środowiska demo** (`:15-17`, `:50`).
Komentarz `:8-11` deklaruje „NIE dotyka production ani staging" — deklaracja
opiera się wyłącznie na trzech stałych w nagłówku, nic jej nie sprawdza.
**★ Dodatkowo `:44` łamie regułę 8 z `CLAUDE.md` („NIGDY force-push na demo").**

**U8. Dokumenty operacyjne opisują nieaktualny stan.**
`docs/operations/RAILWAY_DB_TARGET_RULES.md` (55 linii) opisuje zasady wyboru
`DATABASE_URL`/`DATABASE_PUBLIC_URL`, ale **nie zawiera ani jednej nazwy hosta**
i nie ostrzega o pułapce nazewniczej. `docs/operations/DB_DATA_RELEASE_GATE.md`
(47 linii) opisuje bramkę danych, ale **nie wspomina o `RELEASE_TARGET_DB_HOST_FINGERPRINT`**
ani o bramce migracji z `server/scripts/release-migration-gate.ts`.
**★ `docs/operations/CRITICAL_SERVICES.md` — przeczytaj §F.3 ZANIM go otworzysz:
ten plik NIE JEST tym, czym wydaje się z nazwy.**

---

## §A. `scripts/validate-deploy-target.sh` — allowlista per środowisko + kontrola celu bazy

**Cel pozycji:** bramka, która dziś przepuściłaby wdrożenie na staging z domeną
demo i z dowolną bazą, ma **odmówić** w obu tych przypadkach.

### A.1. Allowlisty domen — trzy środowiska zamiast dwóch

Blok `case` (`:19-33`) ma po zmianie obsługiwać **trzy** środowiska:

| `DEPLOY_ENVIRONMENT` | dozwolone hosty `FRONTEND_URL` | oczekiwane refy |
| --- | --- | --- |
| `staging` | `staging.consultify.ai` | `refs/heads/develop refs/heads/staging` (bez zmian) |
| `demo` | `demo.consultify.ai stage.consultinity.ai` | `refs/heads/demo` |
| `production` | `consultify.ai www.consultify.ai` (**bez zmian**) | `refs/heads/main` (bez zmian) |

**★ Dlaczego `demo` dostaje DWIE domeny, w tym jedną z cudzą nazwą.**
Bo taki jest stan faktyczny środowisk (`DEC-172`): domeny są skrzyżowane,
`stage.consultinity.ai` należy do środowiska **demo**. To nie jest ładne i ma
zostać rozkrzyżowane przez nadzorcę w etapie E0 — ale **do tego czasu allowlista
ma opisywać rzeczywistość, nie życzenie**. Nad blokiem `case` dopisujesz komentarz
wyjaśniający, dlaczego ta pozornie błędna para tam stoi, i że po etapie E0
`stage.consultinity.ai` z tej listy znika.

**★ Nie usuwasz `stage.consultinity.ai` z repo w tym dyżurze.** Usunięcie przed
rozkrzyżowaniem domen zablokowałoby ścieżkę demo.

**★ Środowisko nieznane nadal kończy się `fail`** (`:30-32`) — komunikat
aktualizujesz do trzech nazw.

### A.2. Blok kontroli celu bazy — sedno pozycji

Po kontroli hosta (`:61`), a przed komunikatem sukcesu (`:63`), dokładasz blok,
który porównuje **dwie zmienne środowiskowe**:

- `RELEASE_TARGET_DB_HOST_FINGERPRINT` — wartość, którą realnie dostanie bramka
  migracji (`gateContract.ts:33`). To jest **cel faktyczny**.
- zmienna oczekiwana **zależna od środowiska** — to jest **cel deklarowany**:

| `DEPLOY_ENVIRONMENT` | nazwa zmiennej z oczekiwanym fingerprintem |
| --- | --- |
| `staging` | `STAGING_DB_HOST_FINGERPRINT` |
| `demo` | `DEMO_DB_HOST_FINGERPRINT` |
| `production` | `PRODUCTION_DB_HOST_FINGERPRINT` |

Reguły porównania — **wszystkie trzy są twardym `fail` (`exit 1`)**:

1. `RELEASE_TARGET_DB_HOST_FINGERPRINT` **pusty lub nieustawiony** → `fail`
   z komunikatem mówiącym, **którą zmienną** trzeba ustawić i **gdzie** (usługa
   Railway danego środowiska).
2. zmienna oczekiwana dla tego środowiska **pusta lub nieustawiona** → `fail`
   z komunikatem podającym **nazwę** brakującej zmiennej.
3. wartości **różne** (po `trim` i sprowadzeniu do małych liter) → `fail`
   z komunikatem, który **NIE drukuje obu wartości obok siebie**, tylko:
   nazwę środowiska, nazwę zmiennej oczekiwanej i zdanie, że cel faktyczny nie
   zgadza się z deklarowanym. Wartości fingerprintów to fragmenty nazw hostów —
   log CI jest widoczny szerzej niż panel Railway.

Porównanie robisz **pośrednim rozwinięciem `bash`** (`${!nazwa_zmiennej}`),
nie `eval`. Skrypt ma `#!/usr/bin/env bash` (`:1`) i `set -euo pipefail` (`:3`),
więc pośrednie rozwinięcie niezdefiniowanej zmiennej **musi mieć domyślną
wartość pustą** (`${!v:-}`), inaczej `set -u` przerwie skrypt komunikatem
powłoki zamiast Twoim.

### A.3. Komunikat sukcesu

Linia `:63` po zmianie ma dodatkowo potwierdzać, że cel bazy został sprawdzony —
**bez drukowania fingerprintu**. Wzór:

```
deploy-target: ok for <env> (<ref> -> <host>, db target fingerprint verified)
```

Ta linia jest **jedynym śladem w logu CI**, że kontrola bazy w ogóle się odbyła.
Bez niej odbierający nie odróżni „sprawdzono i zgadza się" od „bramka jest starej
wersji".

### A.4. ★★ ZAKAZ WARTOŚCI DOMYŚLNYCH — najważniejsza reguła tej pozycji

**Do repozytorium nie wpisujesz ŻADNEGO realnego fragmentu nazwy hosta bazy jako
wartości domyślnej.** Zakazane wprost: `centerbeam`, `trolley`, `sakura`,
`thomas`, `caboose`, `ballast`, `proxy.rlwy.net`, `railway.internal`,
jakikolwiek numer portu proxy.

W repo mają być **wyłącznie**: nazwy zmiennych, logika porównania i komunikaty
odmowy. Wartości przychodzą ze środowiska i ustawia je nadzorca.

**Kontrola własna przed commitem §A (obowiązkowa w raporcie):**

```bash
grep -nEi 'centerbeam|trolley|sakura|thomas|caboose|ballast|rlwy\.net|railway\.internal' \
  scripts/validate-deploy-target.sh
# oczekiwane: BRAK TRAFIEŃ
```

Nazwy **domen frontowych** (`staging.consultify.ai`, `demo.consultify.ai`,
`stage.consultinity.ai`, `consultify.ai`) są czymś innym — to publiczne adresy,
już dziś stoją w tym pliku i w `index.html:51-54`, i **mają tam zostać**.
Zakaz dotyczy wyłącznie **hostów baz danych**.

### A.5. ★ SKUTEK OPERACYJNY, KTÓREGO NIE WOLNO CI PRZEMILCZEĆ

Bramka jest **fail-closed**. To znaczy, że **po scaleniu tej zmiany wdrożenie
przestanie działać w każdym środowisku, w którym nadzorca nie ustawił obu
zmiennych** — a wg `DEC-165`/`DEC-172` produkcja **nie ma dziś ustawionego**
`RELEASE_TARGET_DB_HOST_FINGERPRINT`.

**To jest zamierzone i nie wolno Ci tego złagodzić.** Zakazane „rozwiązania":
tryb ostrzegawczy, `exit 0` z komunikatem, `if [ "$environment" != "production" ]`,
zmienna `SKIP_DB_TARGET_CHECK`, wartość domyślna z §A.4. Bezpiecznik, który
przepuszcza, gdy nie ma parametru, **nie jest bezpiecznikiem** (Z22).

**Twój obowiązek zamiast złagodzenia — trzy rzeczy, wszystkie w tym dyżurze:**

1. W nagłówku `scripts/validate-deploy-target.sh` komentarz: **komplet zmiennych
   per środowisko** i zdanie, że ich brak blokuje wdrożenie.
2. W `docs/operations/RAILWAY_DB_TARGET_RULES.md` (§F.1) sekcja **„Zmienne
   wymagane przed scaleniem"** — tabela: środowisko → zmienne → gdzie się je
   ustawia (usługa Railway / GitHub `vars`) → skutek braku.
3. W raporcie §R.1 osobna sekcja **„SKUTKI OPERACYJNE — do wykonania przez
   nadzorcę PRZED scaleniem"**, wypisana jako lista kontrolna. **Bez tej sekcji
   pozycja §A jest niekompletna, choćby kod był idealny.**

### A.6. Czego w §A NIE robisz

- **Nie dotykasz `.github/workflows/railway-deploy.yml`** (Z16). Krok „Validate
  staging target mapping" (`:79-85`) woła skrypt z `DEPLOY_ENVIRONMENT: staging`
  i `GIT_REF: ${{ github.ref }}`; `FRONTEND_URL` przychodzi z
  `vars.STAGING_FRONTEND_URL` (`:58`), które wg `DEC-172` wskazuje dziś
  `stage.consultinity.ai` — **czyli po Twojej zmianie ten krok zacznie padać,
  dopóki nadzorca nie poprawi `vars` (etap E3)**. To też idzie do sekcji
  „SKUTKI OPERACYJNE", z podaniem nazw zmiennych GitHub do poprawy.
- Nie dodajesz nowych środowisk poza `staging`/`demo`/`production`.
- Nie zmieniasz list `expected_refs` dla `staging` i `production`.

### A.7. Definicja ukończenia §A

| # | Warunek | Jak dowodzisz |
| --- | --- | --- |
| A-1 | `staging` ma w allowliście `staging.consultify.ai` i **nie ma** `demo.consultify.ai` | `grep -n allowed_hosts scripts/validate-deploy-target.sh` w raporcie |
| A-2 | istnieje osobny case `demo` z dwiema domenami i refem `refs/heads/demo` | j.w. |
| A-3 | `production` niezmieniony | `git diff <SHA>...HEAD -- scripts/validate-deploy-target.sh` — brak zmian w tym bloku |
| A-4 | brak `RELEASE_TARGET_DB_HOST_FINGERPRINT` → `exit 1` | test §G, przypadek 3 |
| A-5 | brak zmiennej oczekiwanej → `exit 1` | test §G, przypadek 4 |
| A-6 | fingerprinty różne → `exit 1` | test §G, przypadek 5 |
| A-7 | fingerprinty zgodne + poprawny ref + poprawny host → `exit 0` i linia z `db target fingerprint verified` | test §G, przypadek 1 |
| A-8 | **zero realnych hostów baz w pliku** | dosłowny wynik `grep` z §A.4 |
| A-9 | sekcja „SKUTKI OPERACYJNE" w raporcie zawiera komplet zmiennych per środowisko | §R.1 |

---

## §B. `DB_TARGET_LABEL` — para linii logu, którą da się porównać wzrokiem

**Cel pozycji:** dostarczyć **tani, powtarzalny test na nawrót rozjazdu**, którego
dziś nie ma (U3). Po tej zmianie odbierający deploy patrzy w log, znajduje dwie
linie i w pięć sekund widzi, czy bramka migrowała tę samą bazę, na której
wystartowała aplikacja.

### B.1. Czym jest etykieta, a czym nie jest

`DB_TARGET_LABEL` to **krótka, ludzka nazwa celu bazy**, ustawiana jako zmienna
środowiskowa **przez nadzorcę, per środowisko Railway**. Wzór wartości:
`prod-centerbeam`, `demo-trolley`, `staging-sakura`.

**Czym NIE jest — trzy zakazy, każdy z powodem:**

1. **Nie jest wyprowadzana z hosta.** Nie liczysz jej z `DATABASE_URL`, nie
   bierzesz pierwszego członu nazwy, nie hashujesz hosta. Gdyby etykieta
   pochodziła z hosta, w logu wylądowałby host — czyli dokładnie to, przed czym
   broni się dziś `release-migration-gate.ts:236` („host redacted").
   **Etykieta ma być DEKLARACJĄ człowieka, a nie pochodną konfiguracji** — po to,
   żeby rozjazd deklaracji i rzeczywistości był widoczny.
2. **Nie jest sekretem i nie może go zawierać.** Nie wolno w niej umieścić hasła,
   portu, pełnego hosta ani `DATABASE_URL`. Sanityzacja z §B.2 to wymusza.
3. **Nie jest flagą** (Z10) — jej brak niczego nie włącza ani nie wyłącza,
   powoduje wyłącznie wypisanie wartości `unset`.

### B.2. Wspólny normalizator — jeden plik, dwóch konsumentów

Tworzysz **nowy** plik `server/src/config/dbTargetLabel.ts` z jedną czystą
funkcją bez efektów ubocznych. Wymagania:

| # | Wymaganie | Powód |
| --- | --- | --- |
| B2-1 | czyta `DB_TARGET_LABEL` z przekazanego `env` (parametr), nie z globalnego `process.env` w środku | testowalność bez mutowania środowiska procesu |
| B2-2 | `trim`, małe litery, dozwolone znaki `[a-z0-9-]`, pozostałe zamieniane na `-`, sekwencje `-` zwijane, obcięcie do **40 znaków** | log ma być jednoznaczny i skanowalny `grep`em |
| B2-3 | brak zmiennej / pusta / same znaki niedozwolone → zwraca literał **`unset`** | „brak etykiety" musi być widoczny, nie niewidoczny |
| B2-4 | **nigdy nie rzuca wyjątku** | ta funkcja jest wołana w ścieżce startu aplikacji; wyjątek tutaj = brak startu |
| B2-5 | **nie czyta `DATABASE_URL` i niczego z niego nie wyprowadza** | §B.1 pkt 1 |

**Ten plik jest jedynym nowym plikiem produkcyjnym w całym dyżurze.** Kładziesz
go w `server/src/config/`, bo stamtąd importuje zarówno bramka
(`release-migration-gate.ts:29-39` importuje `../src/config/loadEnv.js`,
`../src/config/databaseTargetResolver.js`, `../src/config/buildSha.js`), jak
i warstwa bazy.

### B.3. Strona bramki — `server/scripts/release-migration-gate.ts`

Dwie zmiany, obie **wyłącznie w treści logu**:

1. Linia `:236` (`host redacted`) — dopisujesz do niej `dbTarget=<etykieta>`.
   **Nie odsłaniasz hosta.** Zdanie „host redacted" zostaje.
2. Linia `:294` (`RELEASE_MIGRATION_GATE_PASS ...`) — dopisujesz **na końcu**
   `dbTarget=<etykieta>`, zachowując dotychczasowy porządek i nazwy pól
   (`buildSha=`, `checks=`, `hostVerified=`).

**★ Zakaz zmiany kolejności i nazw istniejących pól.** `DEC-165` cytuje linię
`RELEASE_MIGRATION_GATE_PASS pending=0 failed=0 skipped=0` z realnego logu
wdrożenia — czyli **ktoś już te logi parsuje i porównuje między wdrożeniami**.
Dopisanie pola na końcu jest addytywne; przestawienie pól psuje porównywalność
historyczną.

**★ Zakaz zmiany logiki bramki.** Nie dotykasz `assertExpectedTarget`
(Z16 — `gateContract.ts`), nie zmieniasz warunków `fail`, nie dodajesz nowej
kontroli w bramce. §B to **wyłącznie widoczność**.

### B.4. Strona aplikacji — `server/src/database/PostgresDatabase.ts:457-461`

Do obiektu logowanego w `[Postgres] Config:` dokładasz **jedno pole**
`dbTarget: <etykieta>`. Pola `host`, `database`, `max` **zostają bez zmian**
(host jest tam dziś i to nie jest przedmiot tego dyżuru).

Zmiana ma być **wyłącznie w tym jednym wywołaniu `logger.info`**. Nie zmieniasz
inicjalizacji puli, nie dotykasz `testDatabaseOverride`, nie przenosisz logu.

### B.5. Jak wygląda odbiór — dosłowny wzór dla nadzorcy

W raporcie §R.1 umieszczasz **gotową procedurę odbioru**, którą nadzorca wykona
sam na logu wdrożenia (Ty jej nie wykonujesz — Z28):

```
1. znajdź w logu deployu linię zaczynającą się od RELEASE_MIGRATION_GATE_PASS
2. znajdź linię [Postgres] Config:
3. porównaj pole dbTarget= w obu
   - te same wartości            → OK
   - różne wartości              → ROZJAZD, wstrzymaj wdrożenie
   - którakolwiek = unset        → DB_TARGET_LABEL nieustawiona w tym środowisku
   - brak pola dbTarget w którejś → ta strona chodzi na starym buildzie
```

**Czwarty przypadek jest tym, o którym się zapomina** — i jest wart osobnego
zdania w raporcie: dopóki **obie** strony nie są zbudowane z tej samej wersji
kodu, brak pola po jednej stronie znaczy „stary build", a nie „brak etykiety".

### B.6. Definicja ukończenia §B

| # | Warunek | Jak dowodzisz |
| --- | --- | --- |
| B-1 | `server/src/config/dbTargetLabel.ts` istnieje, jest czysty, nie czyta `DATABASE_URL` | `grep -c "DATABASE_URL" server/src/config/dbTargetLabel.ts` → `0` |
| B-2 | sanityzacja wg B2-2, fallback `unset` wg B2-3, brak wyjątków wg B2-4 | nowy plik testowy (§B.7), przypadki tablicowe |
| B-3 | linia `:236` zawiera `dbTarget=` i nadal zawiera `host redacted` | `grep -n "host redacted" server/scripts/release-migration-gate.ts` |
| B-4 | linia `RELEASE_MIGRATION_GATE_PASS` ma `dbTarget=` **na końcu**, pola przed nim niezmienione | `grep -n "RELEASE_MIGRATION_GATE_PASS" server/scripts/release-migration-gate.ts` |
| B-5 | `[Postgres] Config:` ma pole `dbTarget`, pozostałe pola bez zmian | `git diff <SHA>...HEAD -- server/src/database/PostgresDatabase.ts` — diff obejmuje **wyłącznie** ten blok |
| B-6 | procedura odbioru z §B.5 jest w raporcie dosłownie | §R.1 |
| B-7 | **ani jedna zmiana logiki** w bramce i w warstwie bazy | `git diff` obu plików mieści się w liniach logu + import |

**§B.7 — test.** Nowy plik testowy dla normalizatora, **bez bazy i bez sieci**:
`server/src/config/__tests__/dbTargetLabel.test.ts` (vitest, wzór stylu:
`server/src/services/releaseGate/__tests__/releaseGateBoundary.test.ts`).
Minimum przypadków: wartość poprawna; wartość z wielkimi literami i spacjami;
wartość ze znakami spoza zbioru; wartość dłuższa niż 40 znaków; pusty string;
zmienna nieustawiona; **wartość wyglądająca jak `DATABASE_URL`** (dowód, że
sanityzacja nie przepuszcza hasła ani `@`/`:`/`/`).

---

## §C. `assertRealPostgres.ts` — denylista hostów i naprawa mylącego komentarza

**Cel pozycji:** żaden test integracyjny nie ma prawa połączyć się z bazą
środowiskową — a dziś denylista zna trzy hosty z pięciu znanych, a jej komentarz
utrwala pomyłkę, która wywołała cały incydent.

### C.1. Zakres zmiany — dokładnie dwie rzeczy

**(1) Uzupełnienie listy `FORBIDDEN_DB_HOSTS` (`:28-32`)** o trzy hosty
wymienione w `DEC-2026-08-28-165` i `DEC-2026-08-28-172`: `sakura`, `thomas`,
`caboose`. Zachowujesz dotychczasową konwencję zapisu (pełna nazwa hosta proxy
z sufiksem), zachowujesz trzy istniejące wpisy.

**(2) Naprawa komentarzy.** Każdy wpis dostaje komentarz **zgodny z mapą
z rejestru decyzji** i **z podaniem źródła**. Wzór treści (dosłowne brzmienie
dobierasz sam, ale te fakty muszą się zgadzać):

| host | co o nim mówi rejestr |
| --- | --- |
| `centerbeam` | PRODUKCJA (`DEC-165`) |
| `trolley` | usługa `pgvector` środowiska **demo**; **na nią wskazywał `DATABASE_URL` aplikacji stagingu** — to jest istota incydentu (`DEC-165` + sprostowanie `DEC-172` pkt a) |
| `sakura` | `Postgres-Rehearsal-20260820` w środowisku staging — **baza, którą migruje bramka wydania** (`DEC-165`) |
| `thomas` | usługa `Postgres` środowiska staging; wskazuje ją też środowisko `dev` (`DEC-165` + `DEC-172` pkt b) |
| `caboose` | host **nieobecny w mapie `DEC-165`/`DEC-172`**; występuje w repo wyłącznie w błędnym komentarzu `scripts/seed-m16-demo.py:15`. Do denylisty trafia **z ostrożności**, i komentarz ma to mówić wprost |
| `ballast` | zastany wpis bez opisu — **nie zgadujesz, czym jest**; komentarz ma brzmieć „pochodzenie nieustalone, zachowane z poprzedniej wersji listy" |

**★ `caboose` i `ballast` to jedyne dwa miejsca w tym dyżurze, gdzie masz napisać
„nie wiem" i to jest poprawna odpowiedź (Z15).** Wymyślenie im roli byłoby
powtórzeniem błędu z `seed-m16-demo.py:15`.

**Nad całą listą** dopisujesz komentarz blokowy: skąd pochodzi mapa (`DEC-165`,
`DEC-172`), **ostrzeżenie o pułapce nazewniczej** (trzy bazy nazywają się
`railway`, domeny są skrzyżowane) i zdanie: *lista może wyłącznie rosnąć; wpis
usuwa się dopiero, gdy usługa realnie przestanie istnieć.*

### C.2. Czego w §C NIE robisz (Z18 — wyjątek imienny jest wąski)

- Nie zmieniasz sygnatury `assertRealPostgresTestEnvironment`, nie zmieniasz
  `RealPostgresProof`, nie ruszasz kontroli `RUN_DB_TESTS`/`MOCK_DB` (`:53-58`),
  nie ruszasz `allowHost`, nie ruszasz funkcji `fail`.
- Nie zmieniasz sposobu dopasowania hosta do listy (dokładne vs. `includes`) —
  **jeżeli uznasz, że dopasowanie jest za słabe, to jest znalezisko do raportu,
  nie zmiana.** Zmiana semantyki dopasowania może wywalić cudze testy
  integracyjne, których nie mierzysz.
- Nie dodajesz hostów spoza mapy z rejestru decyzji.

### C.3. Dowód działania (tu potrzebny jest kontener z §0.4)

Dwa przebiegi, oba z pełnym env z §0.4 (Z25/Z26):

1. **Ścieżka pozytywna** — `assertRealPostgresTestEnvironment` przeciwko
   `localhost:5617/cx_day38` **przechodzi** i zwraca dowody odczytane z serwera.
2. **Ścieżka negatywna** — dla każdego z sześciu hostów z denylisty strażnik
   **odmawia**, i odmawia **zanim dojdzie do próby połączenia**.

**★★ TU NAJŁATWIEJ ZŁAMAĆ Z28 W DOBREJ WIERZE.** Test negatywny, który „po prostu
próbuje się połączyć i dostaje odmowę", **wysyła pakiet do hosta produkcyjnego**.
Dlatego kolejność jest odwrotna niż zwykle:

1. **Najpierw PRZECZYTAJ kod strażnika** i ustal, w której linii sprawdzana jest
   `FORBIDDEN_DB_HOSTS` względem linii, w której powstaje połączenie (`new Client`
   / `client.connect()`). Kolejność opisujesz w raporcie z `plik:linia`.
2. **Jeżeli lista jest sprawdzana PRZED połączeniem** — test negatywny jest
   bezpieczny i wykonujesz go dla wszystkich sześciu hostów: odmowa następuje
   bez ruchu sieciowego.
3. **Jeżeli lista jest sprawdzana PO nawiązaniu połączenia** — **nie uruchamiasz
   testu negatywnego w ogóle**. To jest **znalezisko krytyczne**: strażnik
   chroniący przed dotknięciem produkcji sam ją dotyka. Wpisujesz je do raportu
   z `plik:linia` i propozycją naprawy, ale **naprawy nie wykonujesz** — zmiana
   kolejności w tym pliku wykracza poza wąski wyjątek z §C.1 i Z18.

### C.4. Definicja ukończenia §C

| # | Warunek | Jak dowodzisz |
| --- | --- | --- |
| C-1 | lista zawiera 6 hostów: `centerbeam`, `trolley`, `ballast`, `sakura`, `thomas`, `caboose` | `grep -n -A 12 FORBIDDEN_DB_HOSTS tests/integration/_helpers/assertRealPostgres.ts` |
| C-2 | komentarz przy `trolley` **nie zawiera** słowa „staging" jako opisu środowiska tego hosta | j.w. |
| C-3 | każdy wpis ma komentarz zgodny z tabelą C.1, `caboose`/`ballast` opisane jako nieustalone | j.w. |
| C-4 | ścieżka pozytywna przechodzi na kontenerze `5617` | dosłowny wynik przebiegu + dowód celu połączenia z §0.4 |
| C-5 | kolejność „sprawdzenie listy vs. połączenie" ustalona i opisana z `plik:linia` | §R.1 |
| C-6 | zero zmian poza listą i komentarzami | `git diff <SHA>...HEAD -- tests/integration/_helpers/assertRealPostgres.ts` |

---

## §D. `scripts/seed-m16-demo.py` — hasło w repozytorium

**★ To jest znalezisko bezpieczeństwa, nie sprzątanie.** W repozytorium leży
działające hasło do konta właściciela na środowisku demo, w pliku, który
w komentarzu deklaruje, że jest bezpieczny.

**Zanim dotkniesz tego pliku — wykonaj procedurę kolizji z dyżurem 36 (§0.7).**

### D.1. Najpierw rozstrzygnięcie: żywy czy martwy?

Skrypt ma konsumentów w repozytorium — ustalone gałęzią wystawienia:

```
tests/e2e/m16/_m16.ts:6   — komentarz: „Dane = seed z scripts/seed-m16-demo.py"
tests/e2e/m16/_m16.ts:10  — instrukcja uruchomienia: „python3 scripts/seed-m16-demo.py (raz, dane na demo)"
scripts/test-m16-api-sweep.py:6,11,75 — wymaga /tmp/m16_seed_manifest.json produkowanego przez ten skrypt
Harvard/wdrozenie-100/M16-TESTY-DOMKNIECIE-2026-06-26.md:46,83 — procedura testowa modułu M16
```

**Werdykt wyjściowy: skrypt NIE JEST martwy** — jest udokumentowanym elementem
procedury testowej modułu Finanse (M16) i ma zależny od siebie drugi skrypt.
**Wariant „usuwamy skrypt" jest więc odrzucony na starcie** i nie masz go
proponować, chyba że Twój własny grep pokaże co innego.

**Zweryfikuj to sam** (wynik dosłownie do raportu — to jest odpowiedź na pytanie
odbiorcy „żywy czy martwy?"):

```bash
grep -rn "seed-m16-demo" . --exclude-dir=node_modules --exclude-dir=.git
git log --oneline -5 -- scripts/seed-m16-demo.py
```

| Wynik | Co robisz |
| --- | --- |
| konsumenci jak wyżej (spodziewane) | **§D.2 — wyjmujesz hasło, skrypt zostaje** |
| **zero** konsumentów poza samym plikiem i dokumentem historycznym | §D.2 wykonujesz mimo to, a w raporcie dokładasz **wariant do decyzji nadzorcy**: usunięcie pliku, z dowodem braku konsumentów (dosłowny wynik `grep`). **Sam go nie usuwasz** — usunięcie skryptu testowego to decyzja właściciela modułu M16 |

### D.2. Zmiana — trzy elementy

**(1) Hasło i login ze zmiennych środowiskowych, brak → twarda odmowa.**
Skrypt czyta poświadczenia z `M16_SEED_EMAIL` i `M16_SEED_PASSWORD`. Gdy
którejkolwiek brakuje albo jest pusta — **`sys.exit(1)` z komunikatem mówiącym,
które zmienne ustawić**. Zakazane: wartość domyślna, `input()`, `getpass()`
z fallbackiem na stałą, wczytanie z pliku w repo.

**(2) Adres bazowy ze zmiennej, z bezpieczną wartością domyślną.**
`BASE` (`:27`) czyta `M16_SEED_BASE_URL`. **Wartością domyślną NIE jest
`https://demo.consultify.ai`** — domyślnie skrypt ma celować w lokalny adres
(`http://localhost:3001` albo inny, który znajdziesz w repo jako lokalny port
API) **albo odmawiać przy braku zmiennej**. Wybierz jeden z tych dwóch wariantów
i uzasadnij wybór w raporcie jednym zdaniem.
**Powód:** skrypt z domyślnym adresem środowiska zdalnego jest o jedno
przypadkowe `python3 scripts/...` od zapisu na demo.

**(3) Naprawa komentarza bezpieczeństwa (`:15`).** Obecna treść jest błędna
podwójnie (U6). Nowa treść ma powiedzieć prawdę:
- skrypt **zapisuje dane** przez REST API i celuje tam, gdzie wskaże
  `M16_SEED_BASE_URL`;
- poświadczenia przychodzą **wyłącznie** ze zmiennych środowiskowych i **nigdy
  nie wracają do repozytorium**;
- **nie podajesz nazwy żadnej bazy** — bo skrypt rozmawia z API, a nie z bazą,
  i to właśnie zmyślenie mapy API→baza było błędem starego komentarza;
- odwołanie do `docs/operations/RAILWAY_DB_TARGET_RULES.md` po aktualną mapę
  środowisk.

### D.3. ★ Rotacja hasła — obowiązek raportowy, nie Twoja czynność

**Wyjęcie hasła z pliku NIE unieważnia hasła.** Ono jest w historii gita
i pozostanie tam po Twoim commicie.

W raporcie, w sekcji „SKUTKI OPERACYJNE", umieszczasz osobny punkt oznaczony
`★ BEZPIECZEŃSTWO` z trzema zdaniami: (a) hasło konta właściciela na środowisku
demo było w repozytorium i **musi zostać zmienione przez właściciela**;
(b) pozostaje w historii gita, więc samo usunięcie z pliku nie wystarcza;
(c) czyszczenie historii repozytorium **nie jest przedmiotem tego dyżuru**
i wymaga osobnej decyzji.

**Nie podajesz w raporcie treści hasła.** Piszesz o nim opisowo, ze wskazaniem
`plik:linia` w wersji sprzed zmiany. **Nie zmieniasz tego hasła nigdzie
zdalnie** (Z28) i **nie sprawdzasz, czy działa**.

### D.4. Definicja ukończenia §D

| # | Warunek | Jak dowodzisz |
| --- | --- | --- |
| D-1 | procedura kolizji z dyżurem 36 wykonana **przed** zmianą | dosłowne wyniki komend z §0.7 w raporcie |
| D-2 | `grep -in "password" scripts/seed-m16-demo.py` nie pokazuje żadnej wartości literalnej | dosłowny wynik |
| D-3 | brak `M16_SEED_PASSWORD` → skrypt kończy się kodem `1` i komunikatem | uruchomienie **bez zmiennych** i **z `M16_SEED_BASE_URL` wskazującym adres lokalny, który nie odpowiada** — odmowa ma nastąpić **przed** jakimkolwiek połączeniem; dosłowny wynik + `echo $?` |
| D-4 | domyślny `BASE` nie jest adresem zdalnym | `grep -n "M16_SEED_BASE_URL\|BASE =" scripts/seed-m16-demo.py` |
| D-5 | komentarz `:15` nie zawiera nazwy żadnej bazy ani słowa „caboose" | `grep -ci "caboose" scripts/seed-m16-demo.py` → `0` |
| D-6 | punkt `★ BEZPIECZEŃSTWO` jest w raporcie | §R.1 |
| D-7 | werdykt „żywy / martwy" wpisany do raportu z dowodem | §R.1 |

---

## §E. `scripts/deploy-demo.sh` — skrypt omijający bramkę

**Cel pozycji:** skrypt, który jednym poleceniem robi force-push na `demo`
i wyzwala wdrożenie, ma przestać być ścieżką **omijającą** wszystkie bezpieczniki
tego dyżuru.

### E.1. Rozstrzygnięcie: wołać bramkę czy udokumentować wyjątek?

Instrukcja daje Ci **dwa dopuszczalne warianty**. Wybierasz jeden i uzasadniasz
wybór w raporcie. **Trzeciego wariantu — „zostawić jak jest" — nie ma.**

**Wariant 1 (preferowany): skrypt woła `validate-deploy-target.sh` na wejściu.**
Na początku, przed pobraniem tokenu i przed jakimkolwiek `git push`, skrypt
wywołuje bramkę z `DEPLOY_ENVIRONMENT=demo` i przerywa przy niezerowym kodzie.
`GIT_REF` i `FRONTEND_URL` skrypt musi bramce **podać** — i tu jest haczyk,
który masz rozstrzygnąć uczciwie: skrypt pcha `HEAD:demo` z lokalnej gałęzi
(`:40-44`), więc `GIT_REF` **nie jest** `refs/heads/demo`, tylko lokalną gałęzią
operatora. Masz dwie uczciwe drogi:
- ustawić `GIT_REF=refs/heads/demo`, bo **taki jest cel pusha** (nie źródło) —
  i napisać to w komentarzu przy wywołaniu, żeby nikt nie uznał tego za oszustwo;
- albo uznać, że kontrola refu nie ma tu sensu i wybrać **Wariant 2**.

**Wariant 2: jawnie udokumentowany wyjątek + własna, minimalna kontrola celu.**
W nagłówku skryptu piszesz, **dlaczego** bramka CI nie ma tu zastosowania
(bramka jest zaprojektowana pod wdrożenie z gałęzi przez GitHub Actions; ten
skrypt jest narzędziem ręcznym operatora, pchającym dowolną lokalną gałąź).
Wtedy **obowiązkowo** dokładasz minimalną kontrolę własną, w tej kolejności,
**przed** `git push`:

1. **potwierdzenie celu przez operatora** — skrypt wymaga jawnego
   `DEPLOY_DEMO_CONFIRM=demo` (albo równoważnego); brak → `exit 1`;
2. **kontrola, że trzy twarde ID (`:15-17`) nie zostały nadpisane ze środowiska**
   — jeżeli dopuścisz ich nadpisanie zmienną, dopuszczasz wskazanie produkcji;
   najprościej: **nie dopuszczaj**, i napisz to w komentarzu;
3. **kontrola `DB_TARGET_LABEL`/`RELEASE_TARGET_DB_HOST_FINGERPRINT`** — jeżeli
   są ustawione w środowisku operatora, muszą zgadzać się z demo; jeżeli nie są
   ustawione, skrypt **wypisuje ostrzeżenie i wymaga potwierdzenia z pkt 1**.

### E.2. ★ Force-push na `demo` — znalezisko, nie zadanie

`scripts/deploy-demo.sh:44` wykonuje `git push origin HEAD:demo --force-with-lease`.
**To łamie regułę 8 z `CLAUDE.md`** („nuklearne → restore-commit DO PRZODU
… **NIGDY force-push na demo**").

**W tym dyżurze tego NIE naprawiasz.** Powód: zmiana sposobu pushowania na `demo`
to zmiana procedury wdrożeniowej właściciela, a nie bezpiecznik — i wymaga jego
decyzji. **Masz to wypisać jako osobne znalezisko w raporcie**, z cytatem linii,
cytatem reguły z `CLAUDE.md` i propozycją (push bez `--force`, z jawnym
komunikatem przy odrzuceniu).

Jeżeli wybierzesz Wariant 1 albo 2, Twoja kontrola i tak stanie **przed** tą
linią — czyli w praktyce ją okiełzna, nie zmieniając jej.

### E.3. Czego w §E NIE robisz

- Nie zmieniasz twardych ID (`:15-17`) i **nie przenosisz ich do zmiennych
  środowiskowych** — dziś są jedynym, co odróżnia ten skrypt od narzędzia
  strzelającego w dowolne środowisko.
- Nie zmieniasz logiki odpytywania statusu wdrożenia (`:66-99`).
- **Nie uruchamiasz tego skryptu** (Z28) — ani z argumentem, ani bez, ani
  „z podmienionym `PROJECT_ID`". Poprawność sprawdzasz **czytaniem** i
  `bash -n scripts/deploy-demo.sh` (kontrola składni, bez wykonania).

### E.4. Definicja ukończenia §E

| # | Warunek | Jak dowodzisz |
| --- | --- | --- |
| E-1 | wybrany wariant (1 albo 2) jest zaimplementowany i **uzasadniony** w raporcie | §R.1 + `git diff` |
| E-2 | kontrola stoi **przed** `git push` i przed pobraniem tokenu | `grep -n` z numerami linii pokazujący kolejność |
| E-3 | skrypt przechodzi kontrolę składni | `bash -n scripts/deploy-demo.sh; echo $?` → `0` |
| E-4 | znalezisko o force-pushu jest w raporcie z cytatem `CLAUDE.md` | §R.1 |
| E-5 | skrypt **nie został uruchomiony** ani razu | oświadczenie w raporcie + brak śladu w historii poleceń dyżuru |

---

## §F. Dokumenty operacyjne — stan faktyczny i ostrzeżenie o pułapce nazewniczej

**Cel pozycji:** żeby następny człowiek, który wejdzie w te środowiska, dostał
mapę zamiast domysłu. Trzy dokumenty, trzy różne stany zastane.

### F.0. ★★ ŹRÓDŁO FAKTÓW — jedyne dopuszczalne (Z15)

Do dokumentów operacyjnych wolno Ci wpisać **wyłącznie** fakty, które pochodzą
z jednego z dwóch źródeł, **każdy z podaniem źródła w tekście**:

1. **Rejestr decyzji** — `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`,
   wpisy `DEC-2026-08-28-165` (`:216`) i `DEC-2026-08-28-172` (`:223`).
2. **Kod w repozytorium** — z podaniem `plik:linia`.

**Zakazane:** własna pamięć, wnioskowanie z nazwy hosta, „tak zwykle bywa
w Railway", cokolwiek z sieci (Z28). **Fakt, którego nie umiesz podeprzeć jednym
z dwóch źródeł, nie wchodzi do dokumentu** — wchodzi do raportu jako pytanie
do nadzorcy.

**Każda tabela hostów w dokumentach ma mieć nagłówek z datą i źródłem**, np.
*„Stan na 2026-08-28 wg `DEC-2026-08-28-165` i `DEC-2026-08-28-172`; przed
operacją na bazie zweryfikuj w panelu Railway"*. Mapa hostów starzeje się
szybciej niż dokument.

### F.1. `docs/operations/RAILWAY_DB_TARGET_RULES.md` — dokument główny

To jest **właściwe miejsce na mapę środowisk**. Zachowujesz istniejącą strukturę
i pięć reguł (`Rules 1-5`); **dokładasz** cztery sekcje:

**(a) ★★ PUŁAPKA NAZEWNICZA — na samej górze, przed „Purpose".**
Krótka, wyróżniona ramka z trzema zdaniami, każde poparte źródłem:
1. **Trzy różne bazy nazywają się `railway`** — nazwa bazy nie identyfikuje
   środowiska (`DEC-165`).
2. **Domeny Railway są SKRZYŻOWANE**: środowisko `staging` ma wygenerowaną domenę
   zawierającą słowo „demo", a środowisko `demo` — domenę zawierającą słowo
   „staging" (`DEC-172`). **Nazwa domeny nie identyfikuje środowiska.**
3. Wniosek operacyjny: **jedynym wiarygodnym identyfikatorem celu jest host bazy
   porównany z fingerprintem** (`RELEASE_TARGET_DB_HOST_FINGERPRINT`), a jedynym
   szybkim sprawdzianem po wdrożeniu — **para linii logu z `dbTarget=`** (§B.5).

**(b) Mapa środowisk i baz** — tabela wg §F.0, kolumny: środowisko / rola bazy /
host proxy / co o niej wiadomo z rejestru / czy jest celem migracji.
**Bez portów i bez connection stringów.**

**(c) „Zmienne wymagane przed scaleniem"** — tabela z §A.5 pkt 2: środowisko →
`RELEASE_TARGET_DB_HOST_FINGERPRINT`, `STAGING_/DEMO_/PRODUCTION_DB_HOST_FINGERPRINT`,
`DB_TARGET_LABEL` → gdzie się je ustawia → **skutek braku** (wdrożenie
zablokowane / etykieta `unset` w logu).
**★ Wiersz produkcji ma jawnie mówić, że `RELEASE_TARGET_DB_HOST_FINGERPRINT`
nie jest tam dziś ustawiony** (U2) i że ustawienie go wymaga zgody właściciela
(etap E5 wg `DEC-172`).

**(d) Znane ograniczenia bezpieczników** — trzy punkty, każdy z `plik:linia`:
- `databaseTargetResolver.ts:41` — denylista produkcji wisi na **nazwie proxy**,
  która może się zmienić; rozszerzenie przez `PRODUCTION_DB_HOST_DENYLIST_EXTRA`,
  **nigdy przez skrócenie listy** (U5);
- `gateContract.ts:33-47` — fingerprint jest **substringiem**, więc chroni przed
  pomyłką, a nie przed złośliwym wskazaniem;
- `validate-deploy-target.sh` — sprawdza **deklarację**, nie realne połączenie;
  potwierdzeniem faktycznego celu jest dopiero para linii z §B.5.

**★ Sekcję „Enforced In Code" uzupełniasz** o `scripts/validate-deploy-target.sh`,
`server/scripts/release-migration-gate.ts`, `server/src/services/releaseGate/gateContract.ts`,
`server/src/config/dbTargetLabel.ts` i `tests/integration/_helpers/assertRealPostgres.ts`.

### F.2. `docs/operations/DB_DATA_RELEASE_GATE.md` — brakujące ogniwo

Dokument opisuje bramkę **danych** (`npm run release:gate:data-truth`), ale
**milczy o bramce migracji**, która jest realnym strażnikiem celu bazy.
Dokładasz sekcję **„Migration gate (target verification)"**:

- czym jest `server/scripts/release-migration-gate.ts` i że **fail-closed**;
- że `RELEASE_TARGET_DB_HOST_FINGERPRINT` jest **wymagany** i jego brak
  zatrzymuje wdrożenie (`gateContract.ts:36-40`);
- że gate **nie drukuje hosta** i dlaczego (`:236`);
- **procedura odbioru z §B.5**, dosłownie — para linii, cztery przypadki;
- krótkie odesłanie do `RAILWAY_DB_TARGET_RULES.md` po mapę środowisk
  (mapa ma być w **jednym** miejscu, nie w trzech).

Sekcję „Go / No-Go" uzupełniasz o warunek: **`NO-GO`, jeżeli `dbTarget=` w obu
liniach logu nie jest identyczny albo którakolwiek ma `unset`.**

### F.3. ★★ `docs/operations/CRITICAL_SERVICES.md` — UWAGA, ten plik nie jest tym, czym się wydaje

**Sprawdzone na gałęzi wystawienia: ten dokument NIE dotyczy środowisk, usług
Railway ani baz danych.** To wygenerowany 2026-01-04 spis **19 plików
serwisowych TypeScript** (`adminSessionService`, `oauthService`,
`userSessionService`, …) z priorytetem konwersji `.js → .ts`. Ani jednego hosta,
ani jednej nazwy usługi Railway, ani jednego słowa o wdrożeniach.

**Zlecenie zakładało, że ten plik opisuje nieaktualny stan hostów/usług — to
założenie jest błędne. Zweryfikuj to sam pierwszą komendą tej pozycji:**

```bash
head -12 docs/operations/CRITICAL_SERVICES.md
grep -ci "railway\|proxy\|environment\|database" docs/operations/CRITICAL_SERVICES.md   # oczekiwane: 0
```

| Wynik weryfikacji | Co robisz |
| --- | --- |
| **potwierdza się** (spodziewane): plik dotyczy konwersji serwisów | **NIE przepisujesz go na mapę środowisk.** Dokładasz na górze **dwa–trzy zdania** nagłówka: czego dokument dotyczy, kiedy powstał i **gdzie szukać usług krytycznych w sensie wdrożeniowym** (odesłanie do `RAILWAY_DB_TARGET_RULES.md`). Do raportu wpisujesz **korektę wobec instrukcji**: „`CRITICAL_SERVICES.md` nie był dokumentem o środowiskach; założenie zlecenia było błędne; mapa poszła do `RAILWAY_DB_TARGET_RULES.md`". |
| plik jednak **zawiera** treści o środowiskach/hostach | aktualizujesz je wg §F.0 i piszesz w raporcie, co konkretnie było nieaktualne |

**★ Pod żadnym pozorem nie zamieniasz tego pliku w drugą mapę środowisk.**
Dwie mapy w dwóch dokumentach rozjadą się w ciągu tygodnia — a rozjazd map jest
dokładnie tą chorobą, którą ten dyżur leczy.

### F.4. Czego w §F NIE robisz

- Nie tworzysz nowego dokumentu operacyjnego (Z12).
- Nie wpisujesz connection stringów, portów proxy, tokenów, ID projektów
  ani ID środowisk Railway. (ID środowiska demo stoi już w
  `scripts/deploy-demo.sh:15-17` — **nie kopiujesz go do dokumentacji**.)
- Nie rekomendujesz renamów usług bazodanowych (`DEC-172`: rename usługi
  `Postgres` **zabiłby produkcję**).
- Nie opisujesz stanu, którego nie masz w rejestrze ani w kodzie (Z15/F.0).

### F.5. Definicja ukończenia §F

| # | Warunek | Jak dowodzisz |
| --- | --- | --- |
| F-1 | ramka o pułapce nazewniczej na górze `RAILWAY_DB_TARGET_RULES.md`, trzy zdania ze źródłami | `head -30` pliku w raporcie |
| F-2 | mapa środowisk z nagłówkiem daty i źródła; każdy host podparty `DEC-165`/`DEC-172` | j.w. |
| F-3 | tabela „zmienne wymagane przed scaleniem" zgodna z §A.5 i §B, z jawnym wierszem produkcji | j.w. |
| F-4 | sekcja „znane ograniczenia bezpieczników" — 3 punkty z `plik:linia` | j.w. |
| F-5 | `DB_DATA_RELEASE_GATE.md` ma sekcję o bramce migracji + procedurę odbioru z §B.5 + warunek `NO-GO` | `git diff` |
| F-6 | `CRITICAL_SERVICES.md`: rozstrzygnięcie z §F.3 wykonane i **opisane w „Korektach wobec instrukcji"** | §R.1 |
| F-7 | zero connection stringów, portów proxy i ID Railway w trzech dokumentach | `grep -nEi 'rlwy\.net:[0-9]+|postgres://|postgresql://|[0-9a-f]{8}-[0-9a-f]{4}-' docs/operations/*.md` → brak trafień |

---

## §G. Test regresyjny bezpieczników — `tests/unit/deploy/validate-deploy-target.test.mjs`

**Cel pozycji:** żeby następna zmiana w allowliście albo w bloku kontroli bazy
**nie mogła przejść niezauważona**. Test jest bezsieciowy, bezbazowy
i deterministyczny.

### G.1. Forma i wzór

Nowy katalog `tests/unit/deploy/`, nowy plik
`tests/unit/deploy/validate-deploy-target.test.mjs`.

**Wzór do naśladowania (istnieje w repo, przeczytaj go zanim zaczniesz):**
`tests/unit/release/verify-release-candidate-bundle.test.mjs` — `node:test`
(`import test from 'node:test'`), `node:assert/strict`, `spawnSync`, sprzątanie
w `afterEach`.

**★ Z21 — test MUSI uruchamiać realny plik `.sh`.** Wzór wywołania:

```js
spawnSync('bash', [resolve(repoRoot, 'scripts/validate-deploy-target.sh')], {
  env: { PATH: process.env.PATH, /* tylko zmienne przypadku testowego */ },
  encoding: 'utf8',
});
```

**Zakazane:** odtworzenie logiki allowlisty w JavaScript, mockowanie `bash`,
`child_process` z `shell: true` i sklejonym stringiem, dziedziczenie
`process.env` w całości (test musi być odporny na to, co operator ma w powłoce —
a `RELEASE_TARGET_DB_HOST_FINGERPRINT` może akurat mieć ustawione).

### G.2. Przypadki — minimum osiem, wszystkie asercje na `status` i `stderr`

| # | Przypadek | Oczekiwane |
| --- | --- | --- |
| 1 | `staging`, ref `refs/heads/develop`, `FRONTEND_URL=https://staging.consultify.ai`, oba fingerprinty zgodne | `status === 0`, `stdout` zawiera `db target fingerprint verified` |
| 2 | `staging`, **`FRONTEND_URL=https://demo.consultify.ai`** (regresja z U1) | `status !== 0`, `stderr` o niedozwolonym hoście |
| 3 | `staging`, poprawny host, **brak `RELEASE_TARGET_DB_HOST_FINGERPRINT`** | `status !== 0`, `stderr` podaje nazwę brakującej zmiennej |
| 4 | `staging`, poprawny host, jest `RELEASE_TARGET_...`, **brak `STAGING_DB_HOST_FINGERPRINT`** | `status !== 0`, `stderr` podaje nazwę brakującej zmiennej |
| 5 | `staging`, poprawny host, **fingerprinty różne** | `status !== 0`; **`stderr` NIE zawiera obu wartości obok siebie** (§A.2 pkt 3) |
| 6 | `demo`, ref `refs/heads/demo`, `FRONTEND_URL=https://demo.consultify.ai`, fingerprinty zgodne | `status === 0` |
| 7 | `demo` z `FRONTEND_URL=https://stage.consultinity.ai` | `status === 0` (skrzyżowana domena jest **legalna dla demo** — §A.1) |
| 8 | `production`, ref `refs/heads/main`, `FRONTEND_URL=https://consultify.ai`, fingerprinty zgodne | `status === 0` — **dowód, że produkcja nie została po cichu poluzowana** |
| 9 | `DEPLOY_ENVIRONMENT=foo` | `status !== 0`, komunikat wymienia trzy nazwy środowisk |
| 10 | `staging` z refem `refs/heads/main` | `status !== 0` (kontrola refu nadal działa) |

**★ Wartości fingerprintów w teście są SYNTETYCZNE** — `test-fingerprint-a`,
`test-fingerprint-b`. **Zakaz użycia realnych nazw hostów** (`sakura`, `trolley`,
`centerbeam`, …) także w testach — §A.4 obowiązuje w całym repo.

### G.3. Wpięcie w pomiar

Test ma być uruchamialny komendą z §0.5 pkt 1:
`node --test tests/unit/release/ tests/unit/deploy/`.

**Nie dodajesz nowego skryptu do `package.json`** — to zmiana konfiguracji
projektu poza zakresem. **Ale w raporcie podajesz dokładną komendę** i proponujesz
nadzorcy jej wpięcie jako osobne, jednolinijkowe znalezisko.

### G.4. Definicja ukończenia §G

| # | Warunek | Jak dowodzisz |
| --- | --- | --- |
| G-1 | plik istnieje, używa `node:test` i `spawnSync` na realnym `.sh` | `grep -n "spawnSync\|node:test" tests/unit/deploy/validate-deploy-target.test.mjs` |
| G-2 | 10 przypadków z §G.2, każdy z asercją na `status` | dosłowny wynik `node --test` |
| G-3 | test **nie dziedziczy** `process.env` w całości | `grep -n "process.env" tests/unit/deploy/validate-deploy-target.test.mjs` — tylko `PATH` |
| G-4 | zero realnych nazw hostów baz w pliku testowym | `grep -nEi 'centerbeam\|trolley\|sakura\|thomas\|caboose\|ballast\|rlwy' tests/unit/deploy/*.mjs` → brak |
| G-5 | test przechodzi bez sieci i bez bazy | uruchomienie z §0.5 pkt 1; **kontener PG zatrzymany** w trakcie tego przebiegu |
| G-6 | **★ nowy plik w `tests/` wymaga `git add -f`** | `git status --short` po dodaniu pokazuje plik jako śledzony |

**★ G-6 — pułapka, na której poległo kilka dyżurów.** `tests/` bywa objęty
regułą `.gitignore`. Po utworzeniu pliku wykonaj:

```bash
git add -f tests/unit/deploy/validate-deploy-target.test.mjs
git status --short tests/unit/deploy/
```

Plik nieśledzony = pozycja §G **nie istnieje**, choćby przechodziła lokalnie.

---

## §H. Commity — jeden na pozycję (Z24)

Conventional commits, treść **po angielsku**, raport po polsku. Dokładnie te
i w tej kolejności (pomijasz commit pozycji, która skończyła się STOP-em):

```
fix(deploy): give each environment its own frontend host allowlist (A)
feat(deploy): refuse a deploy whose database fingerprint differs from the declared target (A)
feat(config): add a sanitized DB_TARGET_LABEL resolver (B)
feat(release-gate): print the database target label on the gate pass line (B)
feat(db): print the database target label in the pool config log (B)
test(config): cover DB_TARGET_LABEL sanitization and the unset fallback (B.7)
test(integration): extend the forbidden database host list and correct the trolley note (C)
fix(scripts): read the M16 seed credentials from the environment (D)
fix(scripts): make the demo deploy script verify its target before pushing (E)
docs(operations): record the environment map, the naming trap and the required variables (F)
test(deploy): cover the deploy target guard end to end (G)
docs(deploy): day 38 duty report (R.1)
```

**Zakazane:** jeden commit zbiorczy, commit „wip", commit z `.bak`/`.old`
(Z27), commit zawierający pliki spoza listy z §0.7.

**Przed KAŻDYM commitem** uruchamiasz kontrolę zakresu:

```bash
git status --short
git diff --cached --name-only
```

i sprawdzasz, że w indeksie nie ma nic spoza tabeli zakresu.

---

## §2. STOP ZAMIAST ZGADYWANIA — kiedy przerywasz i jak to zapisujesz

**Zasada nadrzędna: lepiej sześć pozycji zrobionych i jedna STOP niż siedem
zrobionych na domysłach.** Odbiorca umie przeczytać STOP. Nie umie wykryć
zgadywania.

### 2.1. STOP CAŁEGO DYŻURU — cztery sytuacje

| # | Sytuacja | Co robisz |
| --- | --- | --- |
| S1 | w polu markera stoi wartownik `3e707a9d3c` | zakładasz raport, pozycja STOP z treścią ramki, koniec |
| S2 | `MARKER BRAK` — marker nie jest przodkiem tipa albo gałąź nie istnieje | j.w., z dosłownym wynikiem obu komend |
| S3 | **stwierdzone naruszenie Z28** — doszło do połączenia z Railway/demo/stagingiem/produkcją | natychmiastowe przerwanie, raport z opisem: co, kiedy, czy był **zapis**; nie „naprawiasz" tego dalszą pracą |
| S4 | stwierdzony **realny zapis** do bazy spoza dyżuru (Z9) | j.w. |

### 2.2. STOP POZYCJI — pięć sytuacji

| # | Sytuacja | Co robisz |
| --- | --- | --- |
| P1 | **kolizja plikowa** z dyżurem 34/35/36/37 (§0.7) | nie dotykasz pliku; pozycja STOP z dowodem kolizji; **reszta dyżuru idzie dalej** |
| P2 | rozstrzygnięcie wymaga danych, które są **tylko w Railway** (np. „jaka jest realna wartość fingerprintu w produkcji") | pozycja STOP z pytaniem do nadzorcy; **nie sprawdzasz** (Z28) |
| P3 | zmiana wymaga dotknięcia pliku z Z16 albo Z18 | pozycja STOP z uzasadnieniem, propozycja do raportu |
| P4 | okazuje się, że „poprawka" wymagałaby **decyzji właściciela** (wybór bazy stagingu, rename usługi, PITR, czyszczenie historii gita) | pozycja STOP + wpis do „SKUTKÓW OPERACYJNYCH" |
| P5 | grep z §0.3 daje wynik **istotnie** inny niż oczekiwany i zmienia sens pozycji | wpis do „Korekt wobec instrukcji" + **kontynuujesz wg stanu faktycznego**, nie wg instrukcji |

**★ Różnica P5 od reszty:** rozbieżność w liczbie linii albo w numerze linii
(plik urósł o dwie linie) to **nie** jest STOP — to korekta. STOP-em jest
rozbieżność, która **unieważnia sens pozycji** (np. blok kontroli bazy już
w skrypcie jest, bo ktoś go dodał równolegle).

### 2.3. Jak wygląda zapis STOP w raporcie

```
### POZYCJA §X — STOP
Powód (jedno zdanie):
Dowód (dosłowne wyniki komend, z komendami):
Czego NIE zrobiłem (lista):
Co musi rozstrzygnąć nadzorca / właściciel (konkretne pytanie, nie „proszę o decyzję"):
Czy pozycja blokuje inne pozycje: TAK/NIE + które
```

---

## §R.1. RAPORT — jeden plik, obowiązkowa struktura

**Ścieżka (dokładnie ta, ani jednego pliku więcej — Z12):**

```
docs/program/waves/WAVE_03_ACCEPTANCE/DEPLOY_GUARDS_DAY38_REPORT_20260828.md
```

Struktura — **wszystkie sekcje obowiązkowe**, w tej kolejności:

```
# RAPORT DYŻURU 38 — Bezpieczniki środowisk i wdrożeń (część repozytoryjna)

## 0. Metryka
- SHA markera, gałąź, worktree, data, wynik `MARKER OK/BRAK`
- rozejście markera wobec tipa (jeśli było): `git log --oneline <SHA>..codex/m03-admin-20260824`
- komenda bazowa: `git diff --name-only <SHA>...HEAD` — DOSŁOWNY wynik
- port kontenera PG (jeśli stawiany) + dowód celu połączenia + dowód sprzątania

## 1. Weryfikacja stanu wejściowego (§0.3)
- tabela: komenda | oczekiwane | otrzymane | zgodne TAK/NIE

## 2. Kolizje (§0.7)
- dosłowne wyniki komend sprawdzających dyżury 34-37
- ★ ROZSTRZYGNIĘCIE kolizji w `scripts/` z dyżurem 36 — które pliki bierze 36, które 38
- lista własnych plików: `git diff --name-only <SHA>...HEAD`

## 3. Pozycje §A-§G — po jednej sekcji na pozycję
Dla KAŻDEJ: co zrobione | DoD punkt po punkcie z dowodem | dowód osiągalności (Z20) | commit SHA
Pozycja przerwana → format z §2.3

## 4. Pomiar testów (§0.5, Z23)
- cztery przebiegi, każdy: komenda | PASS | FAIL | SKIPPED | ZASTANE/WPROWADZONE
- ★ jawnie: ile testów było w zakresie PRZED, ile PO

## 5. Migracje (§0.6)
- dowód ZERA w przedziale 20261270-79

## 6. ★ SKUTKI OPERACYJNE — do wykonania przez nadzorcę PRZED scaleniem
- lista kontrolna zmiennych per środowisko (§A.5, §B, §F.1c)
- ★ zmienne GitHub `vars` do poprawy (§A.6)
- ★ BEZPIECZEŃSTWO: rotacja hasła z `seed-m16-demo.py` (§D.3)
- procedura odbioru pary linii `dbTarget=` (§B.5), dosłownie

## 7. Znaleziska (nie weszły do kodu)
- force-push na demo w `deploy-demo.sh:44` vs CLAUDE.md reguła 8 (§E.2)
- `databaseTargetResolver.ts:41` — bezpiecznik wisi na nazwie proxy (U5)
- produkcja bez `RELEASE_TARGET_DB_HOST_FINGERPRINT` (U2)
- wpięcie `node --test tests/unit/deploy/` do `package.json` (§G.3)
- pozostałe

## 8. Korekty wobec instrukcji
- każde miejsce, gdzie stan faktyczny różnił się od zlecenia
- ★ obowiązkowo: rozstrzygnięcie w sprawie `CRITICAL_SERVICES.md` (§F.3)

## 9. Twierdzenia NIEZWERYFIKOWANE
- wszystko, czego nie dało się sprawdzić bez dostępu do Railway (Z28)
- każde z jednym zdaniem: co konkretnie musiałby sprawdzić nadzorca

## 10. Oświadczenia
- „nie wykonałem żadnego połączenia sieciowego do Railway/demo/stagingu/produkcji" (Z28)
- „nie uruchomiłem `deploy-demo.sh` ani `seed-m16-demo.py`"
- „nie robiłem `git push`, `git stash`, `cp` plików repo" (Z1, Z27)
- „kontener `cx-day38-pg` usunięty" + dowód
```

**★ Sekcja 9 nie może być pusta.** Ten dyżur z definicji nie może sprawdzić
stanu środowisk. Pusta sekcja 9 znaczy, że coś zostało zadeklarowane jako
pewne, choć pewne nie jest — i jest podstawą do odrzucenia raportu.

---

## §R.2. BRIEF WYNIKOWY — co wpisujesz w ostatniej wiadomości

Po commicie raportu podajesz **krótko**, bez ozdobników:

1. **Ścieżka gałęzi i lista SHA commitów** (jeden na pozycję).
2. **Status każdej z siedmiu pozycji**: `ZROBIONE_WG_DoD` / `CZĘŚCIOWE` / `STOP`
   — a przy `CZĘŚCIOWE` i `STOP` jedno zdanie powodu.
3. **Rozstrzygnięcie kolizji w `scripts/` z dyżurem 36** — jednym zdaniem.
4. **Werdykt o `seed-m16-demo.py`: żywy czy martwy** — z liczbą konsumentów.
5. **Trzy najważniejsze SKUTKI OPERACYJNE** dla nadzorcy (zmienne do ustawienia).
6. **Liczba twierdzeń niezweryfikowanych** (sekcja 9 raportu).
7. **Potwierdzenie Z28** — jednym zdaniem, że nie było żadnego połączenia.

**Zakazane w briefie:** „wszystko działa", „testy przeszły" bez liczb,
deklaracja gotowości do wdrożenia (o wdrożeniu decyduje nadzorca po ustawieniu
zmiennych z sekcji 6).

---

## §3. LISTA KONTROLNA NA KONIEC — przejdź ją literalnie

```
[ ] marker sprawdzony, wynik w raporcie
[ ] worktree własny, gałąź własna, zero pracy na codex/m03-admin-20260824
[ ] kolizje 34/35/36/37 sprawdzone PRZED pierwszą zmianą; scripts/ rozstrzygnięte
[ ] §A: allowlisty 3 środowisk + blok kontroli bazy + ZERO realnych hostów w pliku
[ ] §B: dbTargetLabel.ts + dwie linie logu + test sanityzacji
[ ] §C: 6 hostów w denyliście, komentarz o trolley naprawiony
[ ] §D: zero haseł w pliku, odmowa przy braku zmiennych, komentarz naprawiony
[ ] §E: wariant 1 albo 2 zaimplementowany, bash -n czysty, skrypt NIE uruchomiony
[ ] §F: mapa w JEDNYM dokumencie, ramka o pułapce nazewniczej, CRITICAL_SERVICES rozstrzygnięty
[ ] §G: 10 przypadków, realny .sh przez spawnSync, git add -f wykonany
[ ] migracje: ZERO w 20261270-79, dowód w raporcie
[ ] pomiar testów: 4 przebiegi, PASS/FAIL/SKIPPED, ZASTANE vs WPROWADZONE
[ ] commit per pozycja, zero plików spoza zakresu
[ ] raport: 11 sekcji, sekcja 9 NIEPUSTA
[ ] docker rm -fv cx-day38-pg wykonane, dowód w raporcie
[ ] ZERO git push
[ ] ZERO połączeń do Railway/demo/stagingu/produkcji — także "tylko żeby sprawdzić"
```

---

**Koniec instrukcji dyżuru nr 38.**
