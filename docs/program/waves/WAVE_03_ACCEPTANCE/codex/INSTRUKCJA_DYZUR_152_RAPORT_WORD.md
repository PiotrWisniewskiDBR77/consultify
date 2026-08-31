# INSTRUKCJA DYŻURU nr 152 — Codex — „Raport dla zarządu w formacie Word — realny plik na temacie właściciela, oceniony rubryką"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
poprzednich dyżurów. Wszystko, czego potrzebujesz, jest poniżej albo pod
wskazanymi ścieżkami w repo.

> ### ★★ ZAKAZ NR 1 — KATALOG WŁAŚCICIELA. CZYTASZ TO, ZANIM URUCHOMISZ COKOLWIEK.
>
> **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani
> do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`,
> ani `git fetch`, ani `git worktree add`.
> To brudny checkout właściciela produktu i jest **NIETYKALNY**.
> Jedyny dozwolony kontakt z tą ścieżką to **symlink `node_modules` (odczyt)**
> wg `DEC-2026-08-26-86`.
>
> **★★ TO JEST NAJCZĘSTSZA PRZYCZYNA STRACONEJ GODZINY W TYM PROGRAMIE.**
> Instrukcja dyżuru 53 kazała wykonać `git fetch --all` i `git worktree add`
> „w root-repo" — wykonawca zrobił to w katalogu właściciela, `Z5` zablokowało
> pracę i dyżur stanął na STOP-ie, który nie miał prawa powstać.
> **Dlatego w `§0.1` masz PEŁNĄ, DOSŁOWNĄ procedurę worktree Z VAULTA.**
> Nie improwizuj jej i nie zastępuj „swoim sposobem". Twoje miejsce pracy to
> **wyłącznie** `/private/tmp/cx-day152-raport-word`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `cefa960d00`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-08-30.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **Materiały — generowanie i eksport dokumentu dla klienta**.
Trasy front: ``#materialy` (AppView.PRESENTATIONS) i studio dokumentów — **do odczytu**`. Trasy tył: `ścieżka generowania i eksportu `DOCX` — **do odczytu**`.

---

### 0.1. ★★ BAZA PRACY, MARKER I GAŁĄŹ — PROCEDURA DOSŁOWNA, Z VAULTA

**Repozytorium, z którego pracujesz, to BARE-vault, a nie checkout właściciela:**

```
/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
```

Vault ma `extensions.worktreeConfig=true`. **To ma konsekwencję operacyjną,
którą MUSISZ obsłużyć — krok (4).**

**PIERWSZE KOMENDY DYŻURU — wklej dokładnie tak, po kolei:**

```bash
VAULT=/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
WT=/private/tmp/cx-day152-raport-word
MARKER=cefa960d00

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day152-raport-word-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day152-raport-word/config.worktree"
cat "$VAULT/worktrees/cx-day152-raport-word/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day152-raport-word-scratch
mkdir -p /private/tmp/cx-day152-raport-word-artefakty

# (7) sanity
git -C "$WT" rev-parse HEAD
git -C "$WT" status --short | head -3
```

**Wynik komend (2) i (7) wklejasz do raportu dosłownie.**

> **★★ PUŁAPKA — REMOTE `icloud-source` JEST MARTWY.**
> Vault ma trzy remote'y: `github-backup` (żywy, jedyny Twój),
> `origin` (**zakazany do pushu**, `Z1`) i `icloud-source`, wskazujący na
> nieistniejący katalog `/private/tmp/consultify-staging-deploy-e6ca`.
> **Dlatego NIE WOLNO Ci wołać `git fetch --all`.**
> **Błąd `icloud-source` przy jakimkolwiek fetchu NIE JEST negatywnym wynikiem
> markera i NIE JEST powodem do STOP-u.** Jedynym negatywnym wynikiem markera
> jest napis `MARKER BRAK` z komendy `merge-base` powyżej.

**★★ REGUŁA ROZEJŚCIA (`DEC-2026-08-26-95`).**
Jeżeli marker **nie jest** przodkiem tipa albo gałąź nie istnieje — **STOP
całego dyżuru**. Nie improwizujesz bazy: nie startujesz z `origin/demo`,
`main`, `Londyn`, `codex/preserve-*`, `codex/day*-instrukcja-*` ani z żadnej
gałęzi cudzych dyżurów.

Jeżeli marker **JEST** przodkiem, ale **tip uciekł do przodu — to NIE jest
STOP**. Startujesz **dokładnie z markera**, a do raportu wpisujesz:

```bash
git -C "$VAULT" log --oneline cefa960d00..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only cefa960d00..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day152-raport-word-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only cefa960d00..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `cztery` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day144-wskaznik-rozlaczenie

# (T1) KASKADA, KTORA MASZ ZDJAC
grep -n "initiative_id" -A2 server/migrations/061_initiative_lifecycle.sql | grep -B1 -A1 CASCADE
#   oczekiwane: FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE

# (T2) WSZYSTKIE POZOSTALE KASKADY W LANCUCHU KPI — POLICZ SAM
grep -rn "REFERENCES initiative_kpis" server/migrations/*.sql | grep -i cascade
grep -rn "REFERENCES initiatives(id)" server/migrations/*.sql | grep -i cascade | head -12
#   oczekiwane: WIECEJ NIZ JEDNA. Zdjecie kaskady tylko z jednego miejsca da
#   OSIEROCONE WIERSZE zamiast zachowanych wskaznikow. Wypisz wszystkie.

# (T3) CZY ISTNIEJE JUZ REJESTR MODELUJACY WSKAZNIK NIEZALEZNIE
grep -n "CREATE TABLE" -A12 server/migrations/20260810_rvn_kpi_core.sql 2>/dev/null | grep -iE "rvn_kpi_definitions|initiative_id" | head -6
#   oczekiwane: rvn_kpi_definitions NIE MA initiative_id w korzeniu —
#   zwiazek jest w osobnej tabeli rvn_kpi_initiative_impacts.

# (T4) CO CZYTA DZIS EKRAN WYNIKOW
grep -rn "initiatives/.*kpis\|/benefits" src/components/Benefits/*.tsx | head -6
#   oczekiwane: zrodlem prawdy ekranu jest initiative_kpis. NIE ZMIENIASZ TEGO.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day152-raport-word-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6038`. Twój JEDYNY port harnessu to `4970 i 4971`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day152-pg`**. **ZAKAZANE:** `6012, 5433, 6034/4962-4963 (dyzur 148), 6036/4966-4967 (dyzur 150), 6037/4968-4969 (dyzur 151), oraz caly zakres 5800-6033 i 4700-4961`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartości domyślnej żadnej istniejącej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY152_RAPORT_WORD_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md`, bo ten dyżur jest przekrojowy i nie zamyka żadnego modułu menu. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day152-raport-word-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
| `Z14` | **Nie zmieniasz `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz decyzji w kodzie. Uważasz, że decyzja się myli → **errata w raporcie** | SSOT decyzji właściciela |
| `Z15` | **Zero modelu językowego w tym dyżurze.** Żaden pomiar, strażnik ani ekran nie woła `llmService`, `/api/ai/**` ani `GoogleGenerativeAI` | `DEC-51` — zakaz atrapy AI; bezpieczeństwo nie ma prawa zależeć od sieci |
| `Z16` | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych, `503 not_configured`, `null`, `UNKNOWN` ani nagrobków `410`** | „Zero placebo i atrap"; uczciwy `503` jest wzorcem POPRAWNYM |
| `Z17` | **Zakaz wszystkiego poza zakresem tego dyżuru** — z imiennymi licencjami z tabeli licencji | Podział front/tył i rozłączność z dyżurami równoległymi |
| `Z18` | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej:** `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts`, każdy `vitest.*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | Jedna zmiana globalnego mocka fałszuje wynik całego korpusu |
| `Z19` | **Nie odmontowujesz i nie kasujesz żadnego routera, middleware ani joba CI zamontowanego dziś** | Odmontowanie trasy potrafi zabić ekran, którego nie mierzysz; bramki znikają łatwiej, niż wracają |
| `Z20` | **★★ ZAKAZ uruchamiania testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, W TEJ SAMEJ LINII komendy.** Kolejność BLOKU 0 jest wiążąca: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar** | Trzy incydenty zapisu do cudzej bazy |
| `Z21` | **DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`). Pełna ścieżka: realne wejście HTTP → realny `ApiGateway` → `verifyToken` → trasa → handler → zapytanie → **wiersz w Twojej bazie** → odczyt, który ten wiersz podnosi → konsument w `src/` **albo jawne zdanie „brak konsumenta"** | Istnienie kodu ≠ działanie |
| `Z22` | **★★ Test wstrzykujący zależności albo montujący router w gołym `express()` NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`). Dowodem jest `ApiGateway.getInstance().initializeRoutes(app)` | Replika rozjeżdża się z produkcją i nikt tego nie zauważa |
| `Z23` | **★★ ZERO ATRAP.** `200` z pustą kopertą tam, gdzie zapytanie padło, jest atrapą. `0` tam, gdzie wartość jest nieznana, jest atrapą. Ekran, który zapisuje do magazynu, którego nikt nie czyta, jest atrapą. Przycisk bez trasy jest atrapą | `DEC-2026-08-25-21/22`, `DEC-51` |
| `Z24` | **Pomiar zasięgu testów wg `§0.4a` jest warunkiem oddania raportu.** Zawężony wybór albo **przepisanie cudzej liczby** = zawyżenie i podstawa odrzucenia | Liczby autora instrukcji i nadzorcy krążą po dokumentach i utrwalają się jako „fakt" |
| `Z25` | **★★ Testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL` wskazującym Twój efemeryczny kontener.** `tests/setup.ts` ma bezpiecznik i rzuca błędem zamiast fallbacku | **Port `5432` NASŁUCHUJE i nie jest Twój** — fallback = zapis do cudzych danych |
| `Z26` | **★★ Komplet env w tej samej linii — patrz `§0.2c`.** Bez `MOCK_DB=false` odczyty idą cicho na atrapę bazy; bez `ENABLE_V8_GLOBAL=true` część tras daje `404` **przed uwierzytelnieniem**; bez `ENABLE_TEST_AUTH_BYPASS=false` `verifyToken` **jest omijany** | Tak zginął dzień 23 |
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day152-raport-word-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje `railway` CLI, `psql`/`docker exec psql` do hosta innego niż `127.0.0.1`, `curl`/`wget`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | Produkcja NIETYKALNA; demo i staging są jedną bazą. **To jedyny zakaz, którego naruszenie zatrzymuje CAŁY dyżur** |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0` w KAŻDEJ komendzie** i `retry: 0` w opcjach `describe`/`it`, jeśli plik je ustawia | `vitest.config.ts` ustawia `retry: CI ? 3 : 1`. Przy otwartej dziurze pierwszy przebieg realnie zmienia stan, asercja pada, Vitest ponawia — i test **raportuje `PASS` mimo otwartej dziury**. Udowodnione na module Partner |
| `Z30` | **★★ ZAKAZ REALNEJ WYSYŁKI E-MAILI, ZAPROSZEŃ KALENDARZOWYCH I POWIADOMIEŃ.** Przed pierwszym przebiegiem zapisującym **udowodnij w raporcie**, że dostawca poczty jest atrapą — protokół `§0.2b` | Wysłany e-mail i zaproszenie kalendarzowe są **nieodwracalne** i trafiają do skrzynek osób trzecich |
| `Z31` | **★★ ZAKAZ PRZYPINANIA STRAŻNIKA TESTU REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** Wołasz `await assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW**, w szczególności bez `expectedDatabase` | Dyżur 43 przypiął strażnik do swojej bazy: po usunięciu kontenera **30 przypadków dowodowych stało się trwałym `SKIP`**, pakiet raportuje `exit 0` i wygląda jak sukces |
| `Z32` | **★★ ZAKAZ WPISU `FIXED` / `VERIFIED` / `ZROBIONE_WG_DoD` BEZ DOWODU MUTACYJNEGO W OBIE STRONY.** Psujesz kod produkcyjny → test **CZERWONY**; cofasz → test **ZIELONY**; `git diff` po cofnięciu **pusty**. Obie komendy i oba wyniki dosłownie w raporcie. Mutację cofasz przez `cp` (`Z27`), nigdy `git stash` | Dyżur 44 wpisał `FIXED` dla podatności, **która nigdy nie istniała** — test przechodził także przed zmianą, bo asercja była tautologią |
| `Z33` | **★★ PRZED KAŻDYM POMIAREM SPRAWDZASZ, CZY STRAŻNIK, KTÓRY MIERZYSZ, NIE WYŁĄCZA SIĘ SAM W TRYBIE TESTOWYM** — ramka `§0.2d` | Na `resultsInternalBetaVisibility.middleware.ts` zmierzono **416 fałszywych twierdzeń** o uprawnieniach jednego modułu |
| `Z34` | **★★ GREP DOWODZI, ŻE ŁAŃCUCH ISTNIEJE, NIE ŻE DZIAŁA.** Zdanie „działa" wolno Ci napisać wyłącznie po realnym żądaniu HTTP przez realny `ApiGateway`, z podpisanym JWT, na realnym Postgresie po pełnych migracjach — **i po zapisaniu KODU ODPOWIEDZI** | 28.08 w module kalendarza zmierzono kompletny łańcuch komponent → `fetch` → trasa → handler → `INSERT`. **Każdy realny `POST` zwracał `500`**, bo `req.db` nigdy nie było ustawiane w tej gałęzi montażu |
| `Z34a` | **★★ PO PIERWSZYM COMMICIE ROBISZ PUSH NA `github-backup`**, a potem po każdej pozycji | 28.08 trzy dyżury pracowały cały dzień bez kopii zapasowej |
| `Z35` | **Zakaz „naprawiania" przez wyciszanie:** `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `.skip`, `.todo`, poszerzanie `exclude`/`testIgnore`, obniżanie progów pokrycia, `--max-warnings`, `continue-on-error: true` na jobie testowym. Uznajesz to za jedyne wyjście → **STOP z uzasadnieniem**, nie cichy commit | To jest choroba, którą program leczy, a nie narzędzie do jej leczenia |
| `Z36` | **Zakaz `eslint --fix` i `prettier --write` na czymkolwiek szerszym niż plik, który i tak zmieniasz z innego powodu.** Zakaz `--fix` na katalogu, na `.`, na globie | Autofix dotknąłby tysięcy plików i skasował pracę **wszystkich** równoległych dyżurów |
| `Z37` | **Porównania testów po NAZWACH przypadków (`fullName`), NIGDY po liczbach.** „Było 300 PASS, jest 300 PASS" nie jest dowodem — jeden test mógł zgasnąć, a drugi się zapalić | Wektor maskowania regresji |
| `Z38` | **Zakaz usuwania i odmontowywania jakiegokolwiek joba CI.** Wolno dodać, wolno poprawić warunek. Usunięcie = STOP z rekomendacją | Bramki znikają łatwiej, niż wracają |
| `Z39` | **Zakaz uruchamiania realnych workflow GitHub Actions** — `gh workflow run`, `gh run rerun`, `act` z realnymi sekretami, push wyzwalający CI na `main`/`develop`/`Londyn`/`demo`. Dowód robisz **statycznie** | Realny przebieg CI dotyka sekretów i środowisk poza Twoją kontrolą |
| `Z40` | **★★ MIGRACJA MUSI BYĆ ADDYTYWNA I ODWRACALNA, I MA DOKŁADNIE JEDNĄ NAZWĘ:** `server/migrations/20260830_day144_kpi_lifecycle_decouple.sql`. **Innej migracji nie tworzysz** — równolegle biegnie dyżur, który też dodaje migrację, i tylko przybite nazwy gwarantują rozłączność. **Zakazane:** `DROP TABLE`, `DROP COLUMN`, kasowanie danych, zmiana źródła prawdy ekranu Wyników, migracja przenosząca wskaźniki między rejestrami | Dyżur 142 zmierzył i udowodnił: wskaźnik **przeżywa** kanoniczne zamknięcie inicjatywy, ale klucz obcy `initiative_kpis.initiative_id` ma `ON DELETE CASCADE`, więc **fizyczne usunięcie inicjatywy kasuje jej wskaźniki**. To wprost przeczy decyzji właściciela `DEC-2026-08-30-01`. Scalanie ośmiu rejestrów w jeden to osobna, dużo większa praca — ten dyżur usuwa **jedną, wskazaną palcem przeszkodę** |

---

### 0.2b. ★★ PROTOKÓŁ `Z30` — ZERO WYSYŁKI, A MIMO TO PEŁNY DOWÓD

**(1) Czego NIE WOLNO Ci zrobić — nigdy:**
- ustawić `ENABLE_LIVE_EMAIL` na `true`;
- ustawić `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_FROM`
  w środowisku, w `.env*`, w `docker-compose*` ani nigdzie indziej;
- wstawić wiersza konfiguracji SMTP do tabeli ustawień w swojej bazie;
- uruchomić serwera pełnym `server/src/index.ts` **na potrzeby testów** — tam
  startują drenaże outboxów; testy montują `ApiGateway`, nie cały serwer
  (`Z22`);
- uruchomić `server/src/index.ts` na potrzeby zrzutów inaczej niż przez
  kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs` i bez spełnienia
  wszystkich warunków z punktu (4) poniżej;
- wywołać ręcznie żadnej funkcji `drain*` / `startNotificationOutboxDrainCron`
  / `outboxWorker`.

**(2) Trzy dowody, które wklejasz do raportu ZANIM uruchomisz cokolwiek
zapisującego:**

```bash
cd /private/tmp/cx-day152-raport-word

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day152-pg psql -U postgres -d cx152 \
  -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
#   oczekiwane: 0 wierszy. Jezeli tabela `settings` nie istnieje — wklej TEN blad,
#   to tez jest dowod (nie ma skad wziac konfiguracji poczty).

# (c) dla TESTOW: zaden drenaz outboxu nie dziala w procesie testowym
grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
#   oczekiwane: 0 trafien — drenaze startuja w server/src/index.ts, ktorego NIE uruchamiasz
```

**(3) Deklaracja obowiązkowa dla TESTÓW w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane."**

**(4) Wyjątek wyłącznie dla ZRZUTÓW ODBIOROWYCH — pełny produkt, nie replika.**
Pełny `server/src/index.ts` wolno uruchomić wyłącznie przez kanoniczny
`scripts/dev/start-wave3-owner-runtime.mjs`, po wykonaniu dowodów (a) i (b),
oraz tylko gdy wszystkie poniższe warunki są spełnione imiennie:

- runtime pracuje wyłącznie na efemerycznej lokalnej bazie dyżuru pod
  `127.0.0.1`, na zasobach przydzielonych w instrukcji; nie wolno adoptować
  bazy zawierającej jakikolwiek klucz `smtp%`;
- środowisko procesu serwera pochodzi z `childEnv(...)`, ma
  `DOTENV_DISABLED='1'` i nie zawiera `SMTP_*`, `RESEND`, `SENDGRID` ani
  `MAIL*`; trzeba to potwierdzić dla uruchomionego procesu, nie tylko dla
  powłoki wywołującej;
- zapytanie z dowodu (b), wykonane po wszystkich migracjach i seedach, zwraca
  `0` wierszy bezpośrednio przed startem runtime'u;
- nie ustawiasz flag drenaży na `true`, nie wywołujesz żadnego drenażu ręcznie
  i nie wykonujesz żadnej operacji, która tworzy wiadomość, zaproszenie lub
  powiadomienie; runtime służy wyłącznie do odczytu i wykonania zrzutów;
- po starcie ponownie sprawdzasz środowisko należącego do Ciebie procesu oraz
  log serwera. Trafienie konfiguracji poczty, próby realnego transportu albo
  niejednoznaczność dowodu oznacza natychmiastowe zatrzymanie runtime'u i STOP
  całego dyżuru (`Z30`).

Brak konfiguracji nie wyłącza samych drenaży: w runtime z realną bazą startują
one domyślnie. Ochroną jest fail-closed protokół powyżej — `emailService`
tworzy realny transporter dopiero przy jednoczesnej obecności hosta i
użytkownika SMTP; bez nich pozostaje atrapą konsolową. Dowody (a) i (b)
obowiązują zatem zarówno testy, jak i zrzuty odbiorowe.

**Deklaracja obowiązkowa dla ZRZUTÓW ODBIOROWYCH w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane."**

**Ostrzeżenie wsteczne (`DEC-2026-08-29-314`):** dyżury `70`, `72`, `73`,
`76`, `81` i `85` uruchomiły kanoniczny runtime do zrzutów, przez co
sześciokrotnie naruszyły wcześniejsze bezwarunkowe brzmienie `§0.2b`. Do szkody
nie doszło, ponieważ niezależny protokół `Z30` wymagał wykazania, że dostawca
poczty jest atrapą. To ostrzeżenie nie znosi zakazu ani nie zastępuje dowodów.

---

### 0.2c. ★★ KOMPLET ZMIENNYCH ŚRODOWISKOWYCH — TRZY WARIANTY, ZAWSZE W JEDNEJ LINII

**Zmienna postawiona `export`-em wcześniej NIE LICZY SIĘ.** `vitest.config.ts`
przybija część wartości (`DB_TYPE='sqlite'`), więc komplet musi stać
**w tej samej linii komendy** — i masz **udowodnić, że nadpisał**, a nie założyć.

**(A) MIGRACJE — pełny łańcuch, przed jakimkolwiek pomiarem (`Z20`):**

```bash
cd /private/tmp/cx-day152-raport-word

docker run -d --name cx-day152-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx152 \
  -p 127.0.0.1:6038:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day152-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6038/cx152 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6038/cx152 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day152-raport-word && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6038/cx152 \
JWT_SECRET=cx152-test-secret-do-not-reuse \
npx vitest run server/src/services/documentStudio/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day152-raport-word-artefakty/day152-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day152-raport-word && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/documentStudio/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day152-raport-word-artefakty/day152-vitest.json
```

**To NIE jest naruszenie `Z26`, tylko warunek `Z25`:** bez `DATABASE_URL`
`tests/setup.ts` rzuciłby błędem przy `RUN_DB_TESTS=1`.
**Nigdy nie mieszasz: pakiet jednostkowy NIE jest dowodem egzekucji.**

**Znaczenie każdej zmiennej — musisz je znać, zanim ją wpiszesz:**

| Zmienna | Co się stanie, gdy jej zabraknie |
| --- | --- |
| `RUN_DB_TESTS=1` | `tests/setup.ts` pomija testy bazodanowe; pakiet raportuje `exit 0` |
| `MOCK_DB=false` | odczyty idą **cicho** na atrapę bazy, zapisy nigdzie nie lądują |
| `DB_TYPE=postgres` | `vitest.config.ts` przybija `sqlite` — mierzysz inny silnik, niż myślisz |
| `NODE_ENV=test` | runner migracji odmawia albo zwraca MOCK przy bazie lokalnej |
| `ENABLE_V8_GLOBAL=true` | część tras daje **fałszywe `404` PRZED uwierzytelnieniem** |
| `ENABLE_TEST_AUTH_BYPASS=false` | **`verifyToken` JEST OMIJANY** — każdy test uwierzytelniania przechodzi z fałszywego powodu |
| `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` | strażnik przepuszcza wszystko przy `NODE_ENV=test` (416 fałszywych twierdzeń) |
| `DATABASE_URL` | fallback na `localhost:5432`, który **nasłuchuje i nie jest Twój** |
| `JWT_SECRET` | podpisany JWT nie przejdzie przez `verifyToken`; dostaniesz `401` z niewłaściwego powodu |
| `--retry=0` | test „atak odrzucony" **leczy się skutkiem własnego ataku** i raportuje `PASS` |

---

### 0.2d. ★★ ZNANE PUŁAPKI ŚRODOWISKA — OSIEMNAŚCIE, KAŻDA KOSZTOWAŁA GODZINY

**Czytaj to, ZANIM uznasz cokolwiek za zepsute.**

1. **Vault jest BARE + `extensions.worktreeConfig=true`.** Po `git worktree add`
   **musisz** utworzyć `<vault>/worktrees/cx-day152-raport-word/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day152-pg psql -U postgres -d cx152 -c '…'`.
4. **Runner migracji wymaga `NODE_ENV=test` przy bazie lokalnej.** Bez tego
   strażnik localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
   (`server/scripts/migrate.postgres.ts:640-650`).
5. **`vitest.config.ts` (ok. `:209-210`) twardo ustawia `test.env.DB_TYPE='sqlite'`.**
   Zmienna z powłoki bywa nadpisywana — `DB_TYPE=postgres` musi stać
   **w tej samej linii komendy**, a Ty **udowadniasz w raporcie, że nadpisało**
   (asercja `expect(process.env.DB_TYPE).toBe('postgres')` w pierwszym `it`
   każdego nowego pakietu). Pliku **nie zmieniasz** (`Z18`).
6. **`JSON.parse` na kolumnie typu `json` działa na SQLite i wywala `500` na
   PostgreSQL** — sterownik `pg` zwraca już zdeserializowany obiekt. Jeżeli
   kolumny są `TEXT`, kształt `500` nie występuje, ale występuje kształt
   **cichej utraty danych**. Każdy `500` widoczny na PG a nie na SQLite sprawdź
   najpierw pod tym kątem (`DEC-2026-08-28-245`).
7. **CI NIE URUCHAMIA TESTÓW dla naszych gałęzi.** Joby `test-suite.yml` są
   warunkowane na `main`/`develop`, a my jesteśmy na `Londyn`/`demo`;
   `lint-typecheck` pada na zastanych błędach `tsc`, a `pr-gate` czyta wynik
   pominiętego joba jako sukces (`DEC-2026-08-28-246`). **„CI zielone" nie jest
   w tym repo żadnym dowodem.** Dowodem jest wyłącznie Twój przebieg z `--retry=0`.
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day152-pg`.
9. **Reporter `basic` NIE ISTNIEJE w tej wersji vitest** (`--reporter=basic` →
   `Failed to load custom Reporter from basic`). Do porównania nazw używasz
   `--reporter=json --outputFile=<plik poza repo>`.
10. **`npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów** przy
    przekierowaniu wyjścia. **Nie ufaj kodowi wyjścia** — liczby i nazwy czytasz
    z JSON-a.
11. **Nowe pliki w `tests/` wymagają `git add -f`** (katalog bywa ignorowany
    częściowo). Sprawdzasz `git status --short` po każdym commicie.
12. **`| head` na grepie sierot produkuje FAŁSZYWE SIEROTY.** Werdykt „martwy
    komponent" wymaga grepu **bez obcięcia**, z wykluczeniem `__tests__`
    i komentarzy.
13. **ESM nie honoruje `NODE_PATH`.** Skrypt `.mjs` uruchamiany spoza repo nie
    znajdzie pakietów — rozwiązuj je przez `createRequire(REPO + '/package.json')`.
14. **Na remote `github-backup` NIE MA gałęzi `main`, `develop`, `Londyn` ani
    `demo`** — są na `origin` (`origin/develop` **stoi od 2026-06-02**).
    Pracujemy na linii `Londyn`/`demo`.
15. **`postgres:15` NIE PRZECHODZI migracji** — brak rozszerzenia `vector`.
    Obraz obowiązkowy: `pgvector/pgvector:pg16`.
16. **`prettier` na wielkich plikach potrafi przepisać cały plik.** W repo
    **nie ma** skryptu `format` — wołasz `npx prettier --write <pliki>` wprost.
    Jeżeli wynik reformatu przekracza ~3× liczbę Twoich linii merytorycznych —
    **cofasz reformat** (`cp` z kopii wg `Z27`, nigdy `git stash`), zostawiasz
    styl zastany i wpisujesz to do raportu.
17. **Istnieją testy tekstowe przez `readFileSync` + `toContain`,** które
    asertują **dosłowne linie kodu**. Reformat takiej linii wywala test.
    Jeżeli test zapali się od Twojego reformatu — **to jest regresja Twojego
    reformatu, nie „test do poprawienia"**: cofasz reformat.
18. **`npx vitest` z roota bez właściwego configu daje `No test files found`.**
    To **nie jest `PASS`** — to jest brak pomiaru.

---

> **★★ RAMKA DO `Z33` — PUŁAPKI, KTÓRE FAŁSZUJĄ ZIELONY PRZEBIEG.**
> **Zielona suita w tym repozytorium NIE JEST DOWODEM, dopóki nie wiesz, którą
> pułapkę omija.**
>
> **(a) `ENABLE_V8_GLOBAL` nieustawione → fałszywe `404` PRZED uwierzytelnieniem.**
> `server/src/middleware/v8FeatureGate.middleware.ts:15` czyta
> `process.env.ENABLE_V8_GLOBAL === 'true'`; przy braku zmiennej bramka odcina
> trasę **zanim** cokolwiek sprawdzi tożsamość. Twój test „obcy tenant dostaje
> `404`" przechodzi wtedy z całkiem innego powodu, niż myślisz.
>
> **(b) `resultsInternalBetaVisibility.middleware.ts` przepuszcza wszystko przy
> `NODE_ENV=test`,** dopóki nie ustawisz
> `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`. **Na tym strażniku
> zmierzono 416 fałszywych twierdzeń o uprawnieniach.**
>
> **(c) `vitest.config.ts` twardo ustawia `test.env.DB_TYPE='sqlite'`.** Część
> „testów bazodanowych" idzie na atrapę. `MOCK_DB=false DB_TYPE=postgres`
> w tej samej linii to jedyne wyjście; pliku nie zmieniasz (`Z18`).
>
> **(d) `ENABLE_TEST_AUTH_BYPASS`.** `server/src/middleware/auth.middleware.ts`
> zawiera gałąź: `if (NODE_ENV === 'test' && ENABLE_TEST_AUTH_BYPASS === 'true')`
> — czyli **`verifyToken` potrafi wyłączyć się sam w trybie testowym**.
>
> **(e) `initiative_kpis` **nie jest jedyną** tabelą z kaskadą — dyżur 142 znalazł też `initiative_kpi_mappings` i `kpi_deviation_cases` z `ON DELETE CASCADE` na `kpi_id`. Zdjęcie kaskady tylko z jednego miejsca da **osierocone wiersze zamiast zachowanych wskaźników**. Zmierz **wszystkie** kaskady w łańcuchu, zanim zaprojektujesz migrację, i opisz, co się dzieje z każdą**
>
> **Obowiązek dowodowy.** Dla **każdego** pakietu uruchomionego jako dowód
> czegokolwiek raport zawiera akapit: *która z pułapek (a)–(e) dotyczy tego
> pakietu, jak ją wyłączyłem, i co konkretnie dowodzi, że wyłączyłem*.
> Akapit „nie dotyczy" jest dopuszczalny **tylko** z komendą pokazującą, że dany
> strażnik nie leży na ścieżce. **Pomiar bez tego akapitu nie liczy się jako dowód.**

---

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości MERYTORYCZNEJ: STOP tej POZYCJI i wpis
w raporcie — nigdy improwizacja. W tym programie zasadny STOP jest NAGRADZANY,
a zgadywanie karane** (dzień 23 dostał `SUPERVISOR_ACCEPT` za STOP,
`DEC-2026-08-26-130`).

**Rozróżnij dwa rodzaje:**

- **STOP MERYTORYCZNY** (mile widziany): zmierzyłeś i wyszło inaczej, niż mówi
  ta instrukcja; brakuje informacji, której nikt poza właścicielem nie
  dostarczy; naprawa wymaga decyzji produktowej. **Wpisujesz do raportu
  i IDZIESZ DALEJ do następnej pozycji.**
- **STOP PROCEDURALNY** (zakazany): „instrukcja jest sprzeczna", „ścieżka nie
  istnieje", „nie mam licencji na plik". **Ten rodzaj NIE zatrzymuje niczego** —
  patrz tabela niżej i sekcja końcowa.

### ★★ TABELA: STOP PROCEDURALNY ZAKAZANY — DZIAŁANIE ZASTĘPCZE

| Powód, dla którego chciałbyś stanąć | Co robisz ZAMIAST STOP-u |
| --- | --- |
| „Musiałbym zmienić plik przekrojowy (`auth.middleware.ts` / `Gateway.ts` / bramkę platformową)" | **Czerwony kontrakt testowy + brief wynikowy** (tabela licencji, wiersz 1). Pozycja jest wtedy **ZROBIONA**, nie STOP |
| „Plik, którego potrzebuję, nie jest w tabeli licencji" | Traktujesz go jako **tylko do odczytu** i dajesz czerwony kontrakt + brief. Pozycja **ZROBIONA** |
| „Instrukcja jest wewnętrznie sprzeczna" | Sekcja **„JEŚLI COŚ JEST SPRZECZNE"** na końcu dokumentu. Wybierasz interpretację **bezpieczniejszą**, opisujesz w „Korektach", **kontynuujesz pozostałe pozycje** |
| „Ścieżka podana w instrukcji nie istnieje" | Sprawdzasz `ls`, wpisujesz **swój wynik** do „Korekt", szukasz realnego odpowiednika i **idziesz dalej**. Rozbieżność pomiaru z instrukcją **nie jest sprzecznością — jest WYNIKIEM** |
| „Instrukcja podaje dwie różne liczby" | Mierzysz sam, podajesz **swoją** liczbę z komendą (`Z24`). To **nie jest** powód do STOP-u |
| „`git fetch` zwrócił błąd `icloud-source`" | To **nie jest** błąd. `§0.2d` pkt 2. Idziesz dalej |
| „`psql` nie istnieje na hoście" | `docker exec cx-day152-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day152-raport-word-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycje R1 i R2 — wygenerowanie realnego pliku oraz ocena rubryką trzech osi z regułą koniunkcji`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6038` albo `4970 i 4971` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6038` albo `4970 i 4971`** (`Z7`).

Format wpisu STOP:

```
### STOP — <pozycja>
Rodzaj: MERYTORYCZNY / PROCEDURALNY
Powód: <jedno zdanie>
Licencja, którą sprawdziłem: <cytat wiersza z tabeli licencji + wynik>
Dowód: <plik:linia albo komenda + wynik>
Co dostarczyłem ZAMIAST zmiany: <czerwony kontrakt / pomiar / gotowy diff / brief>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Rekomendacja dla nadzorcy: <co zmienić, gdzie, jaki promień rażenia>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
Czy kontynuowałem pozostałe pozycje: TAK / NIE + dlaczego
```

**★★ STOP bez wypełnionego pola „Licencja, którą sprawdziłem" jest NIEZASADNY
z definicji. STOP bez wypełnionego pola „Co dostarczyłem ZAMIAST zmiany" jest
NIEZASADNY z definicji.**

---

## ★★ JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE LUB NIEWYKONALNE

**Ta instrukcja była pisana i sprawdzana przez człowieka i model. Może mieć
błędy. Nie zatrzymuj przez nie dyżuru.**

**Procedura, dosłownie:**

1. **Opisz sprzeczność w raporcie**, w sekcji „Korekty wobec instrukcji":
   **cytat obu wykluczających się zdań z numerami paragrafów**, na czym polega
   konflikt, jaki masz dowód i co zrobiłeś.
2. **Wybierz interpretację BEZPIECZNIEJSZĄ.** Reguły rozstrzygające,
   w tej kolejności:
   - **nie ruszaj cudzego pliku** — gdy nie wiesz, czy masz licencję, **nie
     masz**; traktuj plik jako tylko do odczytu i dostarcz czerwony kontrakt
     + brief;
   - **nie osłabiaj asercji** — gdy test przeszkadza, opisujesz go, nie
     zmieniasz;
   - **nie kasuj** — gdy werdykt jest niepewny, wpisz `DO DECYZJI WŁAŚCICIELA`
     ze zdaniem **„czego konkretnie mi zabrakło, żeby rozstrzygnąć
     samodzielnie"** (wiersz bez tego zdania liczy się jako nierozstrzygnięty);
   - **nie włączaj** — gdy nie wiesz, czy flaga ma być `ON`, zostaje `OFF`
     (`Z10`/`Z11`);
   - **nie wysyłaj niczego na zewnątrz** — gdy nie masz pewności co do `Z30`,
     nie klikasz;
   - **nie poszerzaj dostępu** — gdy bramka jest niejednoznaczna, **odmawiasz
     zamiast przepuszczać**;
   - **mierz zamiast zgadywać** — gdy instrukcja podaje liczbę, a Twój pomiar
     daje inną, **wiążący jest Twój pomiar z komendą** (`Z24`).
3. **KONTYNUUJESZ POZOSTAŁE POZYCJE.** Sprzeczność w jednym paragrafie nie
   zwalnia z pozostałych ani z raportu.
4. **Zatrzymanie CAŁEGO dyżuru** — wyłącznie z pięciu powodów wymienionych
   w `§0.5`.
5. **Nigdy nie „naprawiaj" instrukcji przez improwizację w kodzie.**
   Sprzeczność w dokumencie rozwiązuje się **wpisem w raporcie**, nie zmianą
   w produkcie.
6. **★ Rozbieżność między pomiarem a tą instrukcją NIE JEST sprzecznością —
   jest WYNIKIEM.** Każda liczba, linia i teza w tym dokumencie to **rozkaz
   pomiarowy**, nie prawda objawiona.

**★ Trzy najcenniejsze rzeczy, jakie możesz oddać:** dowód, że coś, co uchodziło
za działające, nie działa; dowód, że coś, co uchodziło za zepsute, jest sprawne;
i uczciwe zdanie „tego nie zmierzyłem, bo…".

**★ Ostatnie zdanie tej instrukcji i najważniejsze: obalenie którejkolwiek tezy
z sekcji „TEZY ZLECENIA…" jest SUKCESEM dyżuru, a nie porażką. Zapisz to
w „Korektach wobec instrukcji" z dowodem i idź dalej.**

---

# ★★★ §0.1-BIS — PRZECZYTAJ ZANIM WYKONASZ §0.1. NADPISUJE §0.1.

**Twój worktree jest już utworzony.** Sandbox nie ma prawa zapisu do vaulta.
**W `§0.1` POMIJASZ kroki `(1)`, `(3)`, `(4)`, `(5)` i `(6)`.** Wykonujesz `(0)` i `(7)`.

```bash
cd /private/tmp/cx-day152-raport-word
git merge-base --is-ancestor cefa960d00 HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
git status --short            # ma być pusto
git branch --show-current     # ma pokazać codex/day152-raport-word-20260830
ls -la node_modules           # ma być dowiązaniem
df -h /                       # poniżej 5 GB wolnego = STOP
```

**★ Kontrola bazy to `merge-base --is-ancestor`, NIE równość SHA.**

**★ Rozstrzygnięte z góry — nie zgłaszaj ponownie:** `Z34a` kontra „nie pushujesz" →
**NIE PUSHUJESZ**. `Z24` odsyła do `§0.4a`, którego nie ma → **odwołanie martwe, pomiń**.

**★ PUŁAPKA HARNESSU:** `server/vitest.config.ts` przypina `DB_TYPE: 'sqlite'`
w bloku `test.env`, a ten **wygrywa ze zmienną z linii komend**. Test z asercją
`expect(process.env.DB_TYPE).toBe('postgres')` zostanie **POMINIĘTY**, a pominięty
pakiet **NIE JEST `PASS`**. Użyj configu **poza repo**, bez tego przypięcia.
**Chronionego configu nie zmieniasz.** Ścieżki dla tego configu są względne do
`server/`, a komendę uruchamiasz **z katalogu `server/`**.

---
# 1. PO CO TEN DYŻUR ISTNIEJE

**Właściciel podjął decyzję `DEC-2026-08-30-01`:** wskaźnik jest bytem niezależnym
# 1. PO CO TEN DYŻUR ISTNIEJE

Przez cały program nie powstał ani jeden dokument, który przeszedł formalną ocenę rubryką. Setki dyżurów mierzyły ekrany, API, flagi i przełączniki — żaden nie postawił pytania najbliższego klientowi: czy plik, który ląduje na biurku prezesa, jest dobry. To jest **najstarsza i największa obawa właściciela produktu** — nie techniczna, tylko handlowa: dokument to jedyny artefakt Consultify, który klient trzyma w ręku poza aplikacją.

Dwie rzeczy, które wcześniej brakowały, teraz istnieją. Po pierwsze realny temat, podany przez właściciela wprost: analiza transformacji cyfrowej firmy farmaceutycznej, zakończona raportem dla zarządu w formacie Word — nie golden-prompt z testu, nie placeholder. Po drugie działająca rubryka odbioru z twardymi progami i regułą koniunkcji, opisana w `Harvard/wdrozenie-100/DELIVERABLES_QUALITY_RUBRIC.md` §3 (RAPORT), z precedensem wykonania w `docs/qa/deliverables/runs/2026-07-05-word-premium-D2/KARTA_ODBIORU.md`. Nie ma już wymówki „nie mieliśmy jak ocenić" ani „nie mieliśmy na czym".

Ten dyżur łączy oba fakty w jeden pomiar: wygeneruj plik przez realną ścieżkę produktu, oceń go tą samą rubryką, którą oceniano D2, i zmierz — nie zgadnij — dlaczego nowsze raporty są krótsze niż stare. Wzorzec dowodowy jest znany z dyżuru 137: status HTTP, rozmiar pliku, `shasum -a 256`, otwarcie pliku i zdanie o realnej zawartości. Ten dyżur stosuje ten sam wzorzec do dokumentu, nie do audytu ekranu.

## Czym ten dyżur NIE jest

Ten dyżur nie przebudowuje generatora prozy (`documentBlockProseGenerator.ts`) ani ścieżki `useLlm`. Nie scala pięciu niezależnych systemów stylowania opisanych w `docs/ui-standards/00-foundation/BRAND_EXPORT_CANON.md` w jeden kanon — to osobne zadania VF3-2/3/4, poza zakresem. Nie projektuje nowego wyglądu dokumentu ani nie proponuje szablonu. To jest dyżur pomiarowy: wygeneruj, oceń, wyjaśnij liczbą.

# 2. TEZY ZLECENIA

- **T1.** Generator prozy działa i jest bramkowany stanem Reacta `useLlm` (domyślnie `true`, `src/components/DocumentStudio/DocumentStudioIntakeForm.tsx:171`), nie flagą środowiskową. `useLlm` gruntuje całą generację treści bloków (`generateBlockProse`) — z OFF dokument powstaje jako pusty szkielet.
- **T2.** Eksport działa w czterech formatach przez `server/src/services/documentStudio/` (renderery `documentDocxRenderer.ts`, `documentPdfRenderer.ts` i pokrewne). Defekty składu ze starszych plików (znaczniki `[DANGER]`, brak wykresów) nie reprodukują się w plikach nowszych niż 25 czerwca.
- **T3.** Nowsze raporty mają około 1550 słów wobec 3712 w pliku z 24 czerwca — spadek o około 60%. Przyczyna nie jest ustalona przez żaden wcześniejszy dyżur.
- **T4.** Pięć niezależnych systemów stylowania obsługuje eksporty-do-klienta (`docs/ui-standards/00-foundation/BRAND_EXPORT_CANON.md` §0) i żaden nie czyta tokenów produktu (`--c-*`, `src/styles/typography.ts`). Który z nich obsłużył konkretnie ten plik, jest do zmierzenia, nie do założenia.

# 3. POZYCJE DYŻURU

**R1 — wygeneruj realny dokument.** Temat: „analiza transformacji cyfrowej firmy farmaceutycznej", format docelowy: raport dla zarządu, Word. Użyj istniejącej ścieżki produktu — trasy generacji i eksportu Document Studio (np. `server/src/routes/document-studio.routes.ts:854` `/generate`, `:4843` `/:artifactId/export/:format` — zweryfikuj sam aktualne nazwy i linie, plik mógł się przesunąć). `useLlm` musi być ON. Zapisz wynikowy plik `.docx` w katalogu artefaktów dyżuru (np. `/private/tmp/cx-day152-raport-word-artefakty/`), podaj rozmiar w bajtach i `shasum -a 256`. Otwórz plik i napisz jedno zdanie o realnej treści (tytuł, liczba sekcji, o czym jest — nie „wygenerowano OK").
**Ukończone, gdy:** plik istnieje na dysku, ma rozmiar >0, sygnaturę `PK` (docx = zip), `unzip -t` bez błędów, zapisany sha256, i jest zdanie opisujące faktyczną zawartość.

**R2 — oceń go rubryką.** Zastosuj `Harvard/wdrozenie-100/DELIVERABLES_QUALITY_RUBRIC.md` §3 (RAPORT): 3A Kompletność (maks 16, próg ≥90%, żaden wymiar=0), 3B Merytoryka (maks 10, próg ≥80%, M1 grounding i M2 język krytyczne ≠0), 3C Grafika (maks 16, próg ≥80%, żaden wymiar=0). Każdy wymiar oceniony osobno z uzasadnieniem, wzorem karty odbioru D2 (`docs/qa/deliverables/runs/2026-07-05-word-premium-D2/KARTA_ODBIORU.md`). Do tego dziesięciopunktowa lista odbioru eksportu tego konkretnego pliku: (1) HTTP 200 na realnym wołaczu, nie mock; (2) rozmiar pliku >0, zgodny z `Content-Length`; (3) poprawna sygnatura formatu; (4) integralność archiwum (`unzip -t` bez błędów); (5) `shasum -a 256` zapisany i powtarzalny; (6) zero placeholderów w treści (grep „awaiting content" / „[DANGER]" / „Evidence gap"); (7) tabele z realnymi ramkami/stylem, nie surowy pipe-text; (8) wykresy osadzone jako obraz, nie placeholder; (9) listy jako natywne akapity Worda (`numPr`), nie ręczne „• "/„1. "; (10) weryfikacja wzrokiem na realnym renderze — otwórz plik i opisz, jak wygląda, nie „wygląda dobrze". Werdykt końcowy zgodnie z regułą koniunkcji: jeśli którakolwiek z trzech osi jest poniżej progu, całość jest FAIL, niezależnie jak wysokie są pozostałe.
**Ukończone, gdy:** wszystkie trzy osie ocenione punkt po punkcie z liczbą i uzasadnieniem, wszystkie 10 punktów listy eksportu odhaczone z dowodem, i jest jeden werdykt PASS/FAIL zgodny z koniunkcją.

**R3 — wyjaśnij spadek objętości.** Zmierz, nie zgaduj, dlaczego nowsze raporty mają o 60% mniej treści niż stary plik z 24 czerwca (1550 vs 3712 słów). Punkty startowe do sprawdzenia: stałe budżetu tokenów w `server/src/services/documentStudio/documentBlockProseGenerator.ts` (`TOKENS_PER_BLOCK`, `MAX_TOKENS_PER_BATCH`, `PROSE_BATCH_SIZE`) i ich historia w `git log`/`git blame`; liczba bloków w outline starego vs nowego dokumentu; domyślna gęstość (`density`) i czy się zmieniła; czy zmienił się model/tier LLM między datami. Wynikiem ma być konkretna liczba lub commit, który tłumaczy różnicę — nie zdanie „prawdopodobnie dlatego że".
**Ukończone, gdy:** wskazany jest konkretny parametr, commit albo porównanie liczb (np. słowa na blok, liczba bloków, `git diff` konkretnego pliku między datami), z dowodem, nie hipotezą.

**R4 — pomiar: który system stylowania obsłużył ten plik.** `docs/ui-standards/00-foundation/BRAND_EXPORT_CANON.md` §0 opisuje 5 niezależnych systemów stylowania eksportów-do-klienta, z tabelą SSOT-plików per system. Ustal, który numer (1–5) realnie wyrenderował plik z R1 — sprawdź faktyczny renderer wywołany w ścieżce eksportu (`documentDocxRenderer.ts`, `documentDocxStyles.ts` i to, co one importują), nie zgaduj po nazwie modułu. Wypisz konkretne luki TEGO pliku względem kanonu marki (np. brak osadzania fontów w pliku — `embedFont`/`embedTrueTypeFonts` nie występuje w generatorach; brak logo/palety klienta; brak wspólnej palety serii wykresu) — sprawdzone na realnym pliku z R1, nie przepisane z kanonu.
**Ukończone, gdy:** nazwany jest jeden numer systemu z uzasadnieniem plikowym (grep/import), i lista realnych luk zweryfikowana na pliku z R1, nie ogólnikiem z dokumentu kanonu.

# 4. TABELA LICENCJI PLIKOWYCH

Dyżur w większości pomiarowy: zapis TYLKO testy `server/src/services/documentStudio/__tests__/day152.*` i raport. Produktu nie zmienia.

**`git diff` poza tymi testami i raportem musi być pusty.**

**Nietykalne imiennie (do czytania, nie do zmiany):** wszystkie generatory i renderery dokumentów (`server/src/services/documentStudio/document*.ts`, w tym `documentDocxRenderer.ts`, `documentDocxStyles.ts`, `documentPdfRenderer.ts`, `documentBlockProseGenerator.ts`) — czytasz i mierzysz, nie naprawiasz; `server/migrations/**`; `src/components/MyWork/**` (dyżur 148); `server/src/services/tools/**` (dyżur 150); `server/src/routes/__tests__/day151.*` (dyżur 151).

**Zasoby wyłączne:** baza `6038`, kontener `cx-day152-pg`, runtime `4970` i `4971`.

# 5. BRAMKI ODBIORU

| # | Bramka |
|---|---|
| B1 | Realny plik `.docx` istnieje na dysku, z rozmiarem w bajtach i `shasum -a 256` zapisanymi w raporcie. Samo zdanie „wygenerowano" nie przechodzi. |
| B2 | HTTP 200 i poprawna sygnatura pliku potwierdzone na realnym wołaczu produktu (trasa generate + trasa export), nie na ręcznie sklejonym pliku ani mocku. |
| B3 | Wszystkie trzy osie rubryki (3A Kompletność, 3B Merytoryka, 3C Grafika) ocenione punkt po punkcie z uzasadnieniem, z progami z `DELIVERABLES_QUALITY_RUBRIC.md` §3. |
| B4 | Werdykt końcowy zastosowany zgodnie z regułą koniunkcji: jedna oś poniżej progu = FAIL całości, bez wyjątków. |
| B5 | Pełna dziesięciopunktowa lista odbioru eksportu wypełniona, z dowodem na każdy punkt, ostatni punkt = opis wzrokowy realnego renderu. |
| B6 | Spadek objętości (3712 → ~1550 słów) wyjaśniony pomiarem — konkretna liczba, parametr albo commit, nie hipoteza. |
| B7 | R4 nazywa jeden konkretny system stylowania (numer 1–5) z uzasadnieniem plikowym i wymienia realne luki na tym pliku. |
| B8 | Zero zmian w nietykalnych plikach (generatory/renderery, migracje, dyżur 148/150/151) — potwierdzone diffem. |

| `B8` | Sekcje „TWIERDZENIA NIEZWERYFIKOWANE" i „KOREKTY" obecne |

---

# ★★ TESTY — WYMOGI OBOWIĄZKOWE

## `W-A` — dowód mutacyjny, dwa przebiegi
Dla każdej pozycji naprawczej: **przed naprawą** test **MUSI PAŚĆ**, **po naprawie
MUSI PRZEJŚĆ**. Wyjścia obu wklejone dosłownie. Test przechodzący także przed naprawą
**nie liczy się jako dowód**. Jeżeli dyżur jest czysto pomiarowy — **napisz wprost,
że `W-A` nie ma zastosowania**, zamiast udawać mutację. Dyżur 142 zrobił tak i został
odebrany pozytywnie.

## `W-B` — zero asercji na tekście źródła
Zakazane `readFileSync` pliku produkcyjnego. Test wywołuje kod i sprawdza **dane albo render**.

## `W-C` — pomiar różnicowy zamiast wiadra „zastanych porażek"
Liczbę porażek podajesz z **dwóch przebiegów tej samej komendy**: na markerze i po zmianie.

## `W-D` — granica rozłączności udowodniona
`git diff --name-only` w raporcie, dosłownie. Każdy plik musi być w tabeli licencji.

---

# ★★ REGUŁA STOP

**`STOP` zasadny jest pochwałą.** W tym programie przyjęto już cztery: dyżur 133
udowodnił sprzeczność instrukcji **reprodukcją kompilatora**; 136 stanął przed bramą
i **jej nie obszedł**; 140 **nie wpisał `FIXED`**, gdy brama odrzuciła zapis; 141
pokazał, że **polecenia po prostu nie ma**. Wszystkie odebrano pozytywnie.

Każdy `STOP` zawiera: cytat wiersza z tabeli licencji · dowód (`plik:linia` albo komenda
z wynikiem) · **co dostarczyłeś zamiast zmiany** · rekomendację dla nadzorcy.

---

# ★★ RAPORT — `§R.2`

Jeden plik, ścieżka w tabeli licencji. W kolejności: **stan wejściowy** (wszystkie komendy
`§0.4` dosłownie) · **korekty wobec instrukcji** · **per pozycja** co i dlaczego ·
**pary przebiegów testów** (`W-A`) · **pomiar różnicowy** (`W-C`) · `git diff --name-only`
(`W-D`) · **pułapki `(a)`–`(e)`** per pakiet · **TWIERDZENIA NIEZWERYFIKOWANE**
(obowiązkowo, niepuste).

Artefakty **nie wchodzą do repo** — leżą w katalogu artefaktów, raport podaje ścieżki
i `shasum -a 256`. **Nie pushujesz.** Commit per krok, potem zgłoszenie gotowości.