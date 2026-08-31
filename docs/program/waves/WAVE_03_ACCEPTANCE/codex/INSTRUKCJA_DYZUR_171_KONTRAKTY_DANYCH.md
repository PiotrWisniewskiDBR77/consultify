# INSTRUKCJA DYŻURU nr 171 — Codex — „Trzy ekrany pokazuja liczby, ktorych nie da sie zrozumiec - brak nazwy wskaznika, waluty i jednostki"

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
> **wyłącznie** `/private/tmp/cx-day171-kontrakty-danych`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `514c60b355`**
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
Zakres: **Wyniki (zestaw wskaznikow, Analiza) oraz Finanse (panele wyceny)**.
Trasy front: ``src/components/ResultsVNext/kpiScorecards/kpiScorecardApi.ts`, `kpiScorecardMappers.ts`, `kpiScorecardPresenters.tsx`, `src/components/Economics/**` (panele wartosci)`. Trasy tył: ``server/src/services/resultsVnext/kpi/kpiScorecardRepository.ts` i `kpiRepository.ts` - wzorzec zlaczenia juz istnieje`.

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
WT=/private/tmp/cx-day171-kontrakty-danych
MARKER=514c60b355

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day171-kontrakty-danych-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day171-kontrakty-danych/config.worktree"
cat "$VAULT/worktrees/cx-day171-kontrakty-danych/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day171-kontrakty-danych-scratch
mkdir -p /private/tmp/cx-day171-kontrakty-danych-artefakty

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
git -C "$VAULT" log --oneline 514c60b355..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 514c60b355..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day171-kontrakty-danych-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 514c60b355..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `cztery` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day171-kontrakty-danych

# (T1) ★ WZORZEC ZLACZENIA JUZ ISTNIEJE — NIE PISZ GO OD NOWA
sed -n '118,128p' server/src/services/resultsVnext/kpi/kpiRepository.ts
sed -n '212,230p' server/src/services/resultsVnext/kpi/kpiScorecardRepository.ts
#   oczekiwane: listKpis ROBI LEFT JOIN po dv.name AS current_definition_name,
#   a listScorecardItems tego NIE robi. To jest ZLACZENIE, nie nowa tabela.

# (T2) JEDNOSTKA JUZ JEST W KONTRAKCIE — usterka jest gdzie indziej
grep -n "unitType\|unit_type" src/components/**/AnalysisKpi*.ts* server/src/**/*.ts 2>/dev/null | head -6
sed -n '104,116p' src/types/financeV2.types.ts 2>/dev/null || grep -rn "formatFinanceValueForDisplay" src/ | head -3
#   oczekiwane: unitType DOCHODZI az do DTO, ale formatFinanceValueForDisplay
#   JAWNIE go odrzuca przez Pick<'status'|'valueDecimal'>.

# (T3) KANDYDACI NA ZRODLO WALUTY — zmierz, ktory jest WYPELNIONY
grep -rn "currency" server/migrations/*.sql | grep -iE "organization_profiles|organizations|projects" | head -6
#   ★ organizations.billing_currency ma DEFAULT 'USD' i jest zawsze wypelniona,
#   ALE opisuje walute rozliczeniowa SaaS, NIE walute biznesu klienta. To PULAPKA.

# (T4) CZYM DZIS TNIE SIE NAZWE
sed -n '184,187p' src/components/ResultsVNext/kpiScorecards/kpiScorecardMappers.ts
#   oczekiwane: ZAWSZE tnie do osmiu znakow plus wielokropek, niezaleznie
#   od szerokosci kolumny. Ten sam mechanizm tnie wlasciciela i cel zakresu.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day171-kontrakty-danych-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6069`. Twój JEDYNY port harnessu to `5012 i 5013`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day171-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6055 oraz 6061-6067 (odbiory nadzorcy), 6051/4994-4995 (163), 6068/5010-5011 (170), 6070/5014-5015 (172), 6071/5016-5017 (173). ★ PORT 5000 ZAJETY NA STALE przez macOS Control Center`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak - ten dyzur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartosci domyslnej zadnej istniejacej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY171_KONTRAKTY_DANYCH_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day171-kontrakty-danych-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day171-kontrakty-danych-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE ZMYSLASZ WALUTY, JEDNOSTKI ANI NAZWY. TO JEST ZAKAZ NAJWYZSZEJ WAGI.** Domyslna waluta 'bo zwykle PLN' albo 'bo w bazie jest USD' jest **GORSZA NIZ JEJ BRAK** - tak powiedzial wprost tor grafiki i tak samo mowi wlasciciel. **Jesli danej nie ma - ekran ma nadal jej nie pokazywac, a Ty zglaszasz brak** jako pozycje do decyzji wlasciciela. Uczciwy inwentarz jest wart wiecej niz zmyslona wartosc. ★ **NIE ZMIENIASZ `formatFinanceValueForDisplay` W MIEJSCU.** Ta funkcja ma **osiem niepowiazanych wolajacych poza modulem Analiza** - zmiana wspoldzielonej funkcji uderzy w ekrany, ktorych nie mierzyles. **Dodaj osobna funkcje**, nie przerabiaj istniejacej. **NIE ZMIENIASZ WYGLADU.** To dyzur o **kontrakcie danych**. Wolno Ci zmienic to, co komponent **wyswietla** (nazwa zamiast ucinanego identyfikatora, kwota z waluta, wartosc z jednostka) - **ale nie uklad, kolory, szerokosci kolumn ani inne teksty**. Odbior wizualny nalezy do tora grafiki. **NIE dotykasz `server/src/routes/resultsVnext/okr.routes.ts` ani niczego pod `okr/**`** (terytorium 170), ani `src/components/Initiatives/**` (terytorium 172). **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji.** | Trzy zgloszenia tora GRAFIKI o tej samej przyczynie i tym samym wniosku: **poprawka po stronie wygladu jest niemozliwa, bo nie ma czego wyswietlic**. Uwaga wlasciciela: na tabeli zestawu nazwy wskaznikow sa uciete do kodow - `kpi-oee-…`, `kpi-defe-…`. **To jest tabela, w ktora wlasciciel wchodzi za kazdym razem, patrzac na okres rozliczeniowy.** Do tego kwoty bez waluty na trzech ekranach Finansow i wartosci bez jednostki w Analizie |

---

### 0.2b. ★★ PROTOKÓŁ `Z30` — ZERO WYSYŁKI, A MIMO TO PEŁNY DOWÓD

**(1) Czego NIE WOLNO Ci zrobić — nigdy:**
- ★ **UWAGA — SPROSTOWANIE 2026-08-30.** Ten szkielet wymieniał tu wcześniej
  przełącznik `ENABLE_LIVE_EMAIL`. **Taka flaga NIE ISTNIEJE w kodzie** — `grep`
  po całym `server/src` i `src` daje zero trafień. Był to fantom, powielany
  w każdej wydanej instrukcji. **Nie szukaj go i nie raportuj, że jest wyłączony.**
  Realny warunek wysyłki jest inny i opisany w punkcie (2) poniżej: poczta wychodzi
  wyłącznie wtedy, gdy `emailService.ts:202` zobaczy **jednocześnie** `smtpConfig.host`
  i `smtpConfig.auth.user`, sklejone **najpierw z tabeli `settings`**, dopiero potem
  ze zmiennych środowiskowych. Bez tych dwóch wartości serwis pisze na konsolę;
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
cd /private/tmp/cx-day171-kontrakty-danych

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day171-pg psql -U postgres -d cx171 \
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
cd /private/tmp/cx-day171-kontrakty-danych

docker run -d --name cx-day171-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx171 \
  -p 127.0.0.1:6069:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day171-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6069/cx171 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6069/cx171 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day171-kontrakty-danych && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6069/cx171 \
JWT_SECRET=cx171-test-secret-do-not-reuse \
npx vitest run server/src/routes/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day171-kontrakty-danych-artefakty/day171-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day171-kontrakty-danych && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day171-kontrakty-danych-artefakty/day171-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day171-kontrakty-danych/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day171-pg psql -U postgres -d cx171 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day171-pg`.
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
> **(e) ★★ **Pierwsza, i oszczedza polowe roboty: rozwiazanie JUZ ISTNIEJE obok.** Nazwa wskaznika **zyje w bazie** - w `rvn_kpi_definitions` i `rvn_kpi_definition_versions`. Tabela `rvn_kpi_scorecard_items` jej nie niesie, **ale identyczny problem jest juz rozwiazany gdzie indziej**: `kpiRepository.ts:122-124` (`listKpis`) robi dokladnie potrzebne `LEFT JOIN ... dv.name AS current_definition_name`, a `kpiScorecardRepository.ts:216-228` (`listScorecardItems`) tego **nie robi**. **To jest ZLACZENIE, nie nowa tabela ani nowa migracja.** Skopiuj istniejacy wzorzec. ★★ **Druga, i zmienia diagnoze zgloszenia 3: jednostka NIE JEST brakiem danych.** Kontrakt `AnalysisKpiValueDto` **juz ma** pole `unitType` (kolumna `unit_type`, `NOT NULL`, sprawdzana kompilacyjnie), przechodzace od bazy przez trase az do DTO. **Usterka siedzi w prezentacji**: `formatFinanceValueForDisplay` (`src/types/financeV2.types.ts:104-116`) **jawnie odrzuca to pole** przez `Pick<'status'|'valueDecimal'>`. Dane sa - po prostu sa wyrzucane tuz przed ekranem. ★★ **Trzecia, pulapka waluty: najlatwiej dostepne zrodlo jest ZLE.** `organizations.billing_currency` jest **zawsze wypelniona** (`DEFAULT 'USD'`) i kusi - **ale opisuje walute rozliczeniowa SaaS, nie walute biznesu klienta**. Uzycie jej pokazaloby polskiemu konsultantowi kwoty w dolarach. `organization_profiles.currency` jest semantycznie wlasciwa, **ale nullable i bez wartosci domyslnej** - **zmierz, ile wierszy ma ja wypelniona**, zanim na niej zbudujesz. `projects.currency` **odpada** - brak sciezki zlaczenia, `finance_v3` nie ma nigdzie `project_id`. **Czwarta, do ZGLOSZENIA a nie naprawy:** `getKpi` (pojedynczy odczyt wskaznika) **nigdy nie dolacza nazwy** - zawsze `null`. Oraz `ResultsKpiRegistryPage.tsx` powtarza ten sam wzorzec ucinania na poziomie trzecim - kolumna 'Proces' pokazuje surowy identyfikator, a `primary_process_id` **nie ma klucza obcego**, wiec nie ma zweryfikowanego zrodla nazwy. **Piata: `DB_TYPE` przypiety do `sqlite` w `vitest.config.ts:210` ORAZ `server/vitest.config.ts:17` (ten drugi naprawiony dyzurem 167). **W raporcie napisz WPROST, jakiego configu uzyles i gdzie lezy****
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day171-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day171-kontrakty-danych-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycje R2 i R4 - nazwa wskaznika zamiast ucietego identyfikatora oraz jednostka przy wartosci w Analizie`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6069` albo `5012 i 5013` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6069` albo `5012 i 5013`** (`Z7`).

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

# 1. PO CO TEN DYŻUR ISTNIEJE

Tor grafiki zgłosił do toru funkcji trzy pozornie osobne usterki wizualne (`docs/program/KOORDYNACJA.md`,
wpisy z 2026-08-30). Zmierzone osobno, mają identyczną przyczynę i identyczny wniosek: **poprawka
po stronie wyglądu jest niemożliwa, bo kontrakt danych nie niesie tego, co miałoby się wyświetlić.**
Żadne z trzech nie jest naprawą komponentu — każde jest przeciągnięciem pola przez warstwy: baza →
zapytanie → DTO → klient API → prezenter.

**Uwaga właściciela, zacytowana w KOORDYNACJA.md:** na tabeli zestawu wskaźników nazwy są ucięte do
`kpi-oee-…`, `kpi-defe-…`, `kpi-czas-…`. Zmierzone źródło: `KpiScorecardItemDto`
(`src/components/ResultsVNext/kpiScorecards/kpiScorecardApi.ts:109-119`) niesie wyłącznie `kpiId` —
nie ma pola na nazwę. Kolumna renderuje `shortKpiScorecardId(row.kpiId)`
(`kpiScorecardPresenters.tsx:390-396`), a ta funkcja (`kpiScorecardMappers.ts:184-187`) **zawsze**
tnie do ośmiu znaków plus wielokropek, niezależnie od szerokości kolumny. Ten sam mechanizm tnie
właściciela karty (`user-pio…`) i cel zakresu (`bu-jakosc`).

**Drugie zgłoszenie:** trzy ekrany modułu Finanse (Wycena) pokazują duże kwoty bez waluty. Kontrakt
`ValuationResultsDto` i propsy paneli wartości nie niosą pola waluty. Tor grafiki napisał wprost:
*zmyślenie waluty byłoby gorsze niż jej brak*.

**Trzecie zgłoszenie:** wartości wskaźników w module Analiza pokazują `0,12` / `0,35` zamiast `12%`
/ `35%`. Zmierzone źródło: w tym wypadku dane **już mają** metadane jednostki w kontrakcie — usterka
leży gdzie indziej niż w dwóch pierwszych zgłoszeniach (patrz R4, to jest istotna różnica, którą
zmierzysz w R1 i nie wolno Ci jej zignorować przez analogię do zgłoszenia 1/2).

Ten dyżur mierzy wszystkie trzy PRZED naprawą (R1), a potem naprawia każde osobno (R2/R3/R4) —
każde ma własną bramkę odbioru, bo mają różny stopień pewności danych.

## Czym ten dyżur NIE jest

Nie jest zmianą wyglądu. Układ, kolory, szerokości kolumn i inne teksty ekranów, których dotykasz,
zostają nietknięte — odbiór wizualny należy do toru grafiki. Wolno Ci zmienić wyłącznie TREŚĆ, którą
komponent wyświetla (nazwa zamiast ucinanego identyfikatora, kwota z walutą, wartość z jednostką).

Nie jest dyżurem 135 (podpięcie 19 paneli wyceny finansowej z `src/components/Economics/panels/` do
trasy Finansów za flagą) — te panele i ta flaga zostają nietknięte, to osobny, zamknięty zakres.

Nie jest naprawą „karty inicjatywy bez przycisku głównego" ani „prawego panelu dokumentów" — to
inne wiersze tej samej tabeli w `KOORDYNACJA.md`, przypisane do innych dyżurów.

Nie jest zmianą wspólnej funkcji `formatFinanceValueForDisplay`
(`src/services/api/financeV2.types.ts:104-116`) **w miejscu**. Ta funkcja ma dziś co najmniej osiem
wołających spoza modułu Analiza (`src/components/Finance/baseline/CalculationsView.tsx:156`,
`src/components/Finance/baseline/AssumptionsView.tsx:339-341`,
`src/components/Finance/Prediction/ScenarioResultsView.tsx:33`,
`src/components/Finance/statementPackWorkspaceV2/CanonicalStatementTableV2.tsx:187`,
`src/components/Finance/statementPackWorkspaceV2/SourceEvidencePanel.tsx:59`,
`src/components/Finance/Valuation/ValuationValueCell.tsx:34`) — żaden z nich nie jest licencjonowany
tym dyżurem. Zmiana zachowania tej funkcji w miejscu wycieka poza Twoją licencję i ryzykuje efekty
uboczne na ekranach Baseline/Prediction/StatementPack, których nikt Cię nie prosił dotykać. Zobacz
R4 — rozwiązanie jest inne.

Nie zgadujesz nazwy „procesu" (`primaryProcessId` na `KpiDefinitionDto`). Zmierzone: kolumna
`primary_process_id TEXT NULL` (`server/migrations/20260810_rvn_kpi_core.sql:67`) nie ma ŻADNEGO
ograniczenia FK — nie wskazuje na żadną tabelę, więc nie istnieje zweryfikowane źródło nazwy. To
samo dotyczy ekranu `ResultsKpiRegistryPage.tsx` (kolumna „Proces" linia 401-415, panel właściwości
linia 628-630) — ten plik NIE jest licencjonowany tym dyżurem (żyje poza pakietem
`kpiScorecards/`), dotykasz go wyłącznie do odczytu, żeby zrozumieć, że ten sam wzorzec usterki
(ucinanie identyfikatora zamiast pokazania nazwy) powtarza się tam na poziomie 3 — zgłoś to jako
obserwację w raporcie, NIE naprawiaj.

Nie dotykasz `server/src/routes/resultsVnext/okr.routes.ts` ani niczego pod `okr/**` — terytorium
dyżuru 170 (okna check-inu OKR), równolegle w toku. Nie dotykasz `src/components/Initiatives/**` —
terytorium dyżuru 172 (karta inicjatywy i arkusz), równolegle w toku. Nie dotykasz zadań (163) ani
agenta (165), też równolegle w toku.

# 2. TEZY ZLECENIA

- **T1.** Wszystkie trzy zgłoszenia mają tę samą KLASĘ przyczyny — brakujące lub odcięte pole w
  kontrakcie/DTO — ale NIE ten sam stopień pewności danych. Zmierz każde osobno w R1: dwa pierwsze
  (nazwa KPI, waluta) wymagają decyzji „skąd wziąć dane", trzecie (jednostka w Analizie) może
  okazać się usterką prezentera, nie kontraktu — sprawdź, zanim założysz, że pasuje do tego samego
  wzorca.
- **T2.** Część brakujących danych JUŻ ISTNIEJE gdzie indziej w bazie lub nawet w tym samym DTO i
  wymaga wyłącznie złączenia (JOIN) albo przekazania już pobranego pola dalej — nie nowej tabeli,
  nie nowego serwisu. Nie buduj tego, co istnieje.
- **T3.** Waluta może NIE istnieć w żadnym wiarygodnie wypełnionym miejscu. Jeśli pomiar to
  potwierdzi, dyżur ma to jawnie zgłosić jako pozycję do decyzji właściciela — a nie wybrać
  pierwszą kolumnę o nazwie pasującej do „currency", która akurat ma `DEFAULT` i dlatego zawsze
  zwraca wartość.
- **T4.** Naprawa jednego pola współdzielonego przez wiele niepowiązanych ekranów (jak
  `formatFinanceValueForDisplay`) nie może wyciekać poza licencjonowany zakres tego dyżuru — jeżeli
  funkcja ma wołających poza Twoim zakresem, dodajesz osobną funkcję, nie zmieniasz wspólnej.

# 3. POZYCJE DYŻURU

## R1 — pomiar wszystkich trzech, PRZED naprawą

Dla KAŻDEGO z trzech zgłoszeń ustal z dokładnością do plik:linia: gdzie kończy się dana w bazie,
gdzie urywa się w kontrakcie (DTO), i co dokładnie renderuje front. Zapisz to jako tabelę w
raporcie (kolumny: zgłoszenie / warstwa / plik:linia / czy dana istnieje i jest wypełniona).

**a) Nazwa wskaźnika (KPI Scorecard).** Sprawdź, czy `rvn_kpi_scorecard_items`
(`server/migrations/20260812_rvn_kpi_scorecards.sql`) rzeczywiście nie niesie żadnego pola nazwy —
`KpiScorecardItemRow`/`KpiScorecardItem` (`server/src/services/resultsVnext/kpi/kpiScorecardTypes.ts:116-136`)
mają komentarz "carries NO KPI-fact column", zweryfikuj to zdanie na żywym zapytaniu, nie tylko na
komentarzu. Sprawdź, czy nazwa istnieje gdzie indziej: `rvn_kpi_definitions`/`rvn_kpi_definition_versions`
(`server/migrations/20260810_rvn_kpi_core.sql`) — i czy `listKpis` (`server/src/services/resultsVnext/kpi/kpiRepository.ts:100-134`)
już rozwiązuje IDENTYCZNY problem dla encji KPI przez `LEFT JOIN rvn_kpi_definition_versions dv ...
dv.name AS current_definition_name` (linia 122-124). Porównaj to z `listScorecardItems`
(`server/src/services/resultsVnext/kpi/kpiScorecardRepository.ts:216-228`), która robi tylko
`SELECT si.* FROM rvn_kpi_scorecard_items si` — bez żadnego złączenia do definicji KPI. ★ Przy
okazji zauważysz, że pojedynczy `getKpi` (`kpiRepository.ts:141-174`) NIE ma takiego złączenia i
zawsze zwraca `name: null` — to jest osobny, realny defekt innej ścieżki (widok szczegółu KPI, nie
Scorecard). Zapisz to w raporcie jako obserwację, NIE naprawiaj — nie jest licencjonowany tym
dyżurem.

**b) Nazwy osób.** Sprawdź, czy `ownerUserId` (`KpiScorecardDto`), `addedBy` (`KpiScorecardItemDto`),
`createdBy`/`publishedBy` (`KpiScorecardReviewSnapshotDto`, `kpiScorecardApi.ts:152-169`) dają się
rozwiązać do imienia i nazwiska przez tabelę `users`
(`server/migrations/000_initdb_core_tables.sql:57-78`, kolumny `first_name`/`last_name`/`email`).
Sprawdź NAJPIERW, czy w repo istnieje już współdzielony mechanizm rozwiązywania ID użytkownika na
nazwę (grep pod kątem funkcji typu "resolveUserNames"/"getUsersByIds" w `server/src/services/`) —
w chwili pisania tej instrukcji taki mechanizm nie istnieje, ale zweryfikuj to sam, bo mogło się to
zmienić w międzyczasie w innym dyżurze.

**c) Waluta (Finanse — Wycena).** Ustal, skąd waluta MOGŁABY pochodzić, i dla każdej opcji zmierz
realne wypełnienie na własnych danych (zasianych lub seedowych, nie na demo/staging/produkcji):
  - `organization_profiles.currency` (`server/migrations/20260411_p30d_organization_type_and_new_fields.sql:45`)
    — kolumna TEXT bez `DEFAULT`, czytana już produkcyjnie jako `profile.currency` w systemie
    twierdzeń profilu organizacji (`server/src/services/organizationContext/OrganizationContextService.ts:40,510,1274,1475`).
    Semantycznie to jest właściwe źródło — realna waluta operacyjna organizacji — ale może być
    pusta dla organizacji, które nie przeszły przez ten przepływ. Zmierz odsetek `NULL`.
  - `organizations.billing_currency` (`server/migrations/000_z_core_baseline.sql:22,43`) — `DEFAULT
    'USD'`, więc ZAWSZE zwraca wartość. **To jest pułapka analogiczna do
    `knowledge_chunks.organization_id`** (kolumna istniała, była pusta, ale wyglądała jak
    rozwiązanie) — tu jest odwrotnie: kolumna jest ZAWSZE wypełniona, ale opisuje walutę
    ROZLICZENIOWĄ subskrypcji SaaS, nie walutę, w której organizacja prowadzi swój biznes. Polski
    klient rozliczany w USD za samą platformę nie prowadzi swojej wyceny w dolarach. Nie wybieraj
    tej kolumny tylko dlatego, że zawsze ma wartość.
  - `projects.currency` (`server/migrations/000_z_core_baseline.sql:162,184`) — **wyeliminowana**:
    `finance_artifacts` (`server/migrations/20260809_finance_v3_b01_core_artifacts.sql:43-58`) ma
    wyłącznie `organization_id`, żadna tabela `finance_v3` (`server/migrations/20260809_finance_v3_*.sql`,
    zgrepuj `project_id` — zero trafień) nie niesie odniesienia do projektu. Nie ma ścieżki JOIN z
    rekordu wyceny do projektu, więc `projects.currency` jest nieosiągalna z tego miejsca, mimo że
    brzmi najbardziej logicznie.

**d) Jednostka wskaźnika (Analiza).** Sprawdź NAJPIERW, zanim założysz analogię do (a)/(c), czy dana
naprawdę jest nieobecna w kontrakcie. Otwórz `AnalysisKpiValueDto`
(`src/services/api/financeV2.types.ts:744-771`) — ma ona pole `unitType: string` (linia 751) NA
POZIOMIE GŁÓWNYM ORAZ zagnieżdżone `value.unit`/`value.nativeCurrency`/`value.presentationCurrency`
(linia ~757-762). Sprawdź, czy trasa `GET /analysis/:businessVersionId/kpi-values`
(`server/src/routes/v8/finance-v2/analysis.routes.ts:130-172`) faktycznie wypełnia te pola z bazy
(linie 150, 157-158: `unitType: r.unit_type`, `nativeCurrency: r.native_currency`,
`presentationCurrency: r.presentation_currency`, `unit: r.unit`). Sprawdź kolumnę źródłową
`unit_type` (`server/migrations/20260809_finance_v3_d03_analysis_01_tables.sql:60-62`) — jest
`NOT NULL`, ograniczona do `('RATIO', 'PERCENT', 'MULTIPLE', 'DAYS', 'MONETARY', 'COUNT')`,
autorsko deklarowana i sprawdzana przy kompilacji formuły (komentarz linii 57-59: niezgodność =
`COMPILE_ERROR`, nigdy cicho złe). **To NIE jest przypadek pustej kolumny jak
`knowledge_chunks.organization_id`** — pole jest kontraktowo gwarantowane. Jeśli to potwierdzisz,
usterka NIE leży w kontrakcie danych, tylko w warstwie prezentacji frontu — zobacz R4, gdzie
dokładnie.

**Ukończone, gdy:** raport ma cztery podsekcje (a/b/c/d) z tabelą plik:linia i jawnym wnioskiem
„dana istnieje i jest wypełniona" / „dana istnieje, ale pusta" / „dana nie istnieje" dla każdej.

## R2 — kontrakt wskaźników: nazwa KPI + nazwy osób (KPI Scorecard)

Zakres: WYŁĄCZNIE pakiet `src/components/ResultsVNext/kpiScorecards/` i jego serwer
`server/src/services/resultsVnext/kpi/kpiScorecard*.ts` +
`server/src/routes/resultsVnext/kpiScorecard.routes.ts`. Nie dotykasz `ResultsKpiRegistryPage.tsx`
ani `kpiApi.ts`'s `getKpi` (patrz „Czym ten dyżur NIE jest").

Wzoruj się na już istniejącym, działającym rozwiązaniu identycznego problemu:
`kpiRepository.ts:122-124`'s `LEFT JOIN rvn_kpi_definition_versions dv ON dv.definition_version_id
= kd.current_definition_version_id AND dv.organization_id = kd.organization_id` +
`dv.name AS current_definition_name`. Zastosuj analogiczny wzorzec w `listScorecardItems`
(`kpiScorecardRepository.ts:216-228`): dołącz `rvn_kpi_definitions`/`rvn_kpi_definition_versions`
po `si.kpi_id`, wystaw nazwę w `KpiScorecardItemRow`/`KpiScorecardItem`
(`kpiScorecardTypes.ts:116-136`) i w `KpiScorecardItemDto`
(`kpiScorecardApi.ts:109-119`) jako nowe, opcjonalne pole (np. `kpiName: string | null` — `null`
gdy KPI nie ma jeszcze zatwierdzonej definicji, honest-value, nie fabrykowana nazwa).

Dla nazw osób: dołącz `users` (`first_name`/`last_name`) tym samym mechanizmem (LEFT JOIN po ID) w
zapytaniach zwracających `KpiScorecardDto` (owner), `KpiScorecardItemDto` (addedBy) i
`KpiScorecardReviewSnapshotDto` (createdBy/publishedBy) — wystaw jako nowe opcjonalne pola
(`ownerName`, `addedByName`, `createdByName`, `publishedByName`), NIE zastępuj istniejących pól ID
(inne części systemu mogą ich potrzebować).

Po wzbogaceniu kontraktu: w `kpiScorecardPresenters.tsx` PRZESTAŃ wołać `shortKpiScorecardId` w
miejscach, gdzie teraz masz nazwę — kolumna „KPI" (linia 388-396, item), tytuł podglądu pozycji
(linia 520), wiersz właściciela (linie 129, 306), wiersz „Dodane przez" (linie 430, 536), wiersze
„Utworzono przez"/„Opublikowano przez" (linie 698, 700). Pokaż nazwę, z identyfikatorem jako
`title`/tooltip (wzorem linii 394 `title={row.kpiId}`, które już istnieje — zostaw ten mechanizm,
tylko zmień co jest w treści `<span>`). **ZOSTAW skracanie identyfikatora tam, gdzie identyfikator
jest naprawdę identyfikatorem, nie namiastką nazwy**: `scopeId` (linia 313 — cel zakresu to
techniczny wskaźnik zasięgu, nie ma nazwy do pokazania), `contentHash` (linia 707), samo pole „KPI
ID" w panelu właściwości pozycji (linia 534, jawnie podpisane jako identyfikator, zostaje
identyfikatorem OBOK nowego pola nazwy, nie zamiast niego).

Jeśli R1(a) pokazał, że `kpiName`/`ownerName` bywają `null` (KPI bez zatwierdzonej definicji, osoba
usunięta) — pokaż wtedy fallback do istniejącego skróconego ID, dokładnie tak jak
`ResultsKpiRegistryPage.tsx:378` już robi to poprawnie dla własnej kolumny „KPI" (`row.name ??
row.kpiCode`) — to jest wzorzec do skopiowania, nie do wymyślenia od nowa.

**Ukończone, gdy:** `GET /:scorecardId/items` zwraca `kpiName` niepustą dla KPI z zatwierdzoną
definicją (dowód: `SELECT` na lokalnym Postgresie porównujący `rvn_kpi_scorecard_items.kpi_id` z
`rvn_kpi_definition_versions.name` dla tego samego `kpi_id`), kolumna „KPI" w tabeli pozycji
pokazuje nazwę, a `scopeId`/`contentHash`/„KPI ID" nadal pokazują skrócony identyfikator.

## R3 — waluta w kontrakcie Finansów (Wycena)

Zdecyduj na podstawie pomiaru R1(c), nie z góry. Jeśli `organization_profiles.currency` jest
realnie wypełniona na Twoich danych testowych: dodaj ją do odpowiedzi
`GET /valuation/variants/:businessVersionId/results`
(`server/src/routes/v8/finance-v2/valuation.routes.ts:676-716`) — `organizationId` jest już w
zasięgu przez `getV8Context(req)` (linia 679), więc dociągnięcie jednego pola nie wymaga nowego
parametru trasy. Wystaw je jako nowe pole `currency: string | null` na `ValuationResultsDto`
(`src/services/api/financeV2.types.ts:1331-1358`) — `null`, gdy profil organizacji nie ma
ustawionej waluty (honest-value, zgodnie z twardą zasadą „nie zmyślasz waluty").

Jeżeli pomiar R1(c) pokaże, że `organization_profiles.currency` jest w praktyce pusta na
realistycznym zestawie danych — NIE przełączaj się na `organizations.billing_currency` z powodu jej
domyślnej wartości. Zamiast tego zapisz to jako pozycję do decyzji właściciela w raporcie (sekcja
„TWIERDZENIA NIEZWERYFIKOWANE" lub osobna sekcja „Do decyzji") i zostaw ekrany bez waluty — dokładnie
tak jak działają dziś, uczciwie.

Poprowadź pole `currency` przez cały łańcuch: `getValuationResults`
(`src/services/api/financeV2.api.ts:1275-1278`) → stan `results` w
`ValuationWorkspace.tsx:193,289` → trzy ekrany renderujące kwoty:
`src/components/Finance/Valuation/steps/ResultsStep.tsx` (nagłówek EV, `data-testid="headline-ev"`,
linia ~51; przedział rozbieżności metod, linie ~65-66; tabela metod, `ValuationValueCell` linia 91),
`src/components/Finance/Valuation/steps/MethodsWeightsStep.tsx` (`ValuationValueCell` linia
121-124), `src/components/Finance/Valuation/steps/SensitivityStep.tsx` (własne formatowanie linia
38, bez współdzielonego komponentu).

★ Ważne ułatwienie, które ZMIERZYŁEM: `ValuationValueCell`
(`src/components/Finance/Valuation/ValuationValueCell.tsx:21-29`) JUŻ MA prop `unitSuffix?: string`,
udokumentowany dosłownie jako „Applied only to a present value, e.g. `PLN`" (linia 25) — i renderuje
go poprawnie (linia 48). Żaden z dwóch wołających (`ResultsStep.tsx:91`, `MethodsWeightsStep.tsx:121`)
go dziś nie przekazuje. To nie jest budowa nowego mechanizmu wyświetlania — to podłączenie
istniejącego gniazda. Dla nagłówka EV i przedziału rozbieżności w `ResultsStep.tsx` (które nie
przechodzą przez `ValuationValueCell`, tylko własną funkcję `fmt()`) dopisz walutę obok wyniku tym
samym wzorcem, jakim `unitSuffix` jest renderowany w komponencie (spacja + kod waluty, nigdy
wtopiony w liczbę). Dla `SensitivityStep.tsx` — analogicznie, bez tworzenia nowego komponentu.

**Ukończone, gdy:** `ValuationResultsDto.currency` niesie wartość z `organization_profiles.currency`
(dowód: `SELECT` na lokalnym Postgresie), trzy ekrany pokazują walutę przy kwotach dla organizacji,
która ją ma ustawioną, i NIC (brak waluty, nie placeholder) dla organizacji, która jej nie ma — bez
zmiany layoutu.

## R4 — jednostka wskaźnika w Analizie

To NIE jest powtórka R2/R3. R1(d) ustalił, że `unitType`/`unit`/`presentationCurrency` JUŻ
PRZYCHODZĄ z bazy do `AnalysisKpiValueDto` — kompletnie, przez cały łańcuch: kolumna `unit_type`
(`server/migrations/20260809_finance_v3_d03_analysis_01_tables.sql:60-62`, `NOT NULL`) → trasa
(`server/src/routes/v8/finance-v2/analysis.routes.ts:150,157-158`) → DTO
(`src/services/api/financeV2.types.ts:744-771`). Usterka jest wyłącznie w prezenterze frontu, który
ma dane i je odrzuca.

Dokładna lokalizacja: `formatFinanceValueForDisplay`
(`src/services/api/financeV2.types.ts:104-116`) ma sygnaturę `value: Pick<FinanceValue, 'status' |
'valueDecimal'>` — **jawnie wybiera tylko te dwa pola**, nawet gdy wołający ma pod ręką cały obiekt
z `unit`/`unitType`. Dwa wołania w module Analiza przekazują jej wartość i tracą jednostkę:
`analysisKpiTable.contract.ts:187-192` (`formatPeriodCell`) i `:196-197`
(`toAnalysisKpiTableRow`, wołanie `formatFinanceValueForDisplay(group.latestValue.value)` —
`group.latestValue` to cały `AnalysisKpiValueDto`, `group.latestValue.unitType` jest DOSTĘPNY w tym
samym miejscu, `AnalysisKpiGroup.latestValue` zdefiniowane w linii 97), oraz
`AnalysisKpiDetailCard.tsx:78,130`.

Potwierdzenie mechanizmu (dlaczego `0,12` a nie `12%`): `formulaAstEvaluator.ts:65` deklaruje
`UnitType` z wariantem `'PERCENT'`, ale silnik NIGDZIE nie mnoży wyniku razy 100 dla tego wariantu —
wartość dziesiętna wskaźnika procentowego jest zapisywana jako ułamek (`0.12`), a `unit_type =
'PERCENT'` jest jedynie METADANĄ mówiącą frontowi, jak ją POKAZAĆ. Front dziś tej metadanej nie
czyta.

Napraw to BEZ dotykania `formatFinanceValueForDisplay` w miejscu (patrz „Czym ten dyżur NIE jest" —
osiem wołających spoza Analizy). Dodaj nową, osobną funkcję (np. `formatAnalysisKpiValueForDisplay`,
obok istniejącej w `financeV2.types.ts` albo lokalnie w `analysisKpiTable.contract.ts` — wybierz na
podstawie tego, gdzie inne podobne pomocnicze funkcje tego modułu już mieszkają), używaną WYŁĄCZNIE
przez `analysisKpiTable.contract.ts` i `AnalysisKpiDetailCard.tsx`. Mapowanie jednostek:
`PERCENT` → pomnóż razy 100, dopisz „%"; `MULTIPLE` → dopisz „×"; `DAYS` → dopisz „ dni"; `MONETARY`
→ dopisz `presentationCurrency` i — jeśli `value.unit` (skala UNITS/THOUSANDS/MILLIONS/BILLIONS) nie
jest `'UNITS'` — etykietę skali z JUŻ ISTNIEJĄCEJ `financeUnitLabel()`
(`financeV2.types.ts:265-277`, ma polskie etykiety „tysiące"/„miliony"/„miliardy" — nie twórz drugiej
mapy, plik 257-263 opisuje dokładnie ten błąd jako już raz złapany defekt: token jednostki po
angielsku w polskim zdaniu); `RATIO`/`COUNT` → bez zmian, to jest uczciwe, nie defekt.

**Ukończone, gdy:** tabela wskaźników w Analizie pokazuje `12%` (nie `0,12`) dla KPI o
`unitType='PERCENT'` na danych testowych, `formatFinanceValueForDisplay` ma DOKŁADNIE ten sam kod co
przed dyżurem (diff pusty na tej funkcji), a osiem wołających spoza Analizy wymienionych w sekcji 1
ma pusty diff.

# 4. TABELA LICENCJI PLIKOWYCH

★ Poniższa tabela wypisuje CAŁĄ ścieżkę danych dla każdego z trzech zgłoszeń — od tabeli po ekran —
z prawdziwymi nazwami sprawdzonymi w kodzie `/private/tmp/m03` (marker `514c60b355`).

| Zgłoszenie | Warstwa | Ścieżka |
|---|---|---|
| 1 (nazwa KPI) | Migracja (odczyt schematu, bez zmian) | `server/migrations/20260810_rvn_kpi_core.sql` (`rvn_kpi_definitions`, `rvn_kpi_definition_versions`), `server/migrations/20260812_rvn_kpi_scorecards.sql` (`rvn_kpi_scorecard_items`), `server/migrations/000_initdb_core_tables.sql:57-78` (`users`) |
| 1 | Repozytorium (zapis) | `server/src/services/resultsVnext/kpi/kpiScorecardRepository.ts` (`listScorecardItems` i pokrewne — dołóż JOIN) |
| 1 | Typy/mapper serwera (zapis) | `server/src/services/resultsVnext/kpi/kpiScorecardTypes.ts` (`KpiScorecardItemRow`/`Item`/`toKpiScorecardItem` + analogicznie dla scorecard/snapshot) |
| 1 | Trasa (odczyt, prawdopodobnie bez zmian poza przepływem pola) | `server/src/routes/resultsVnext/kpiScorecard.routes.ts` (`GET /:scorecardId/items` linia 428-441 i sąsiednie handlery scorecard/snapshot) |
| 1 | DTO klienta (zapis) | `src/components/ResultsVNext/kpiScorecards/kpiScorecardApi.ts` (`KpiScorecardItemDto:109-119`, `KpiScorecardDto`, `KpiScorecardReviewSnapshotDto:152-169`) |
| 1 | Mapper frontu (zapis, ostrożnie) | `src/components/ResultsVNext/kpiScorecards/kpiScorecardMappers.ts` (`shortKpiScorecardId:184-187`, `kpiScorecardOwnerDisplay:189-197` — NIE usuwaj tych funkcji, nadal służą polom, które zostają identyfikatorami) |
| 1 | Prezenter (zapis) | `src/components/ResultsVNext/kpiScorecards/kpiScorecardPresenters.tsx` (kolumny/podglądy: linie 129, 306, 313 zostaje, 388-396, 430, 520, 534 zostaje, 536, 698, 700, 707 zostaje) |
| 1 | Test nowy (zapis) | `server/src/routes/__tests__/day171.data-contracts.pg.test.ts` |
| 2 (waluta) | Migracja (odczyt schematu, bez zmian jeśli R1(c) potwierdzi `organization_profiles`) | `server/migrations/20260411_p30d_organization_type_and_new_fields.sql:45`, `server/migrations/000_z_core_baseline.sql:22,43,162,184` (odczyt, do porównania źródeł) |
| 2 | Serwis (odczyt, ewentualny drobny zapis) | `server/src/services/finance/canonical/valuationAdvisorService.ts` (`loadValuationSnapshot`, `resolveHeadlineEnterpriseValue`) |
| 2 | Trasa (zapis) | `server/src/routes/v8/finance-v2/valuation.routes.ts:676-716` |
| 2 | DTO klienta (zapis) | `src/services/api/financeV2.types.ts:1331-1358` (`ValuationResultsDto`) |
| 2 | Klient API frontu (zapis, jeśli typ trzeba przenieść) | `src/services/api/financeV2.api.ts:1275-1278` (`getValuationResults`) |
| 2 | Workspace (zapis, przepływ propa) | `src/components/Finance/Valuation/ValuationWorkspace.tsx:193,289` |
| 2 | Prezentery (zapis) | `src/components/Finance/Valuation/steps/ResultsStep.tsx`, `src/components/Finance/Valuation/steps/MethodsWeightsStep.tsx`, `src/components/Finance/Valuation/steps/SensitivityStep.tsx`, `src/components/Finance/Valuation/ValuationValueCell.tsx` (wołania `unitSuffix`, sam komponent zostaje) |
| 2 | Test nowy (zapis) | `server/src/routes/__tests__/day171.data-contracts.pg.test.ts` (ta sama para plików co zgłoszenie 1/3 — jeden test integracyjny per zgłoszenie w tym samym pliku) |
| 3 (jednostka Analiza) | Migracja (odczyt, bez zmian — pole już `NOT NULL`) | `server/migrations/20260809_finance_v3_d03_analysis_01_tables.sql:39-75,158-172` |
| 3 | Silnik formuł (odczyt, bez zmian) | `server/src/services/finance/canonical/formulaAstEvaluator.ts:65` |
| 3 | Trasa (odczyt, bez zmian — już zwraca pole) | `server/src/routes/v8/finance-v2/analysis.routes.ts:126-172` |
| 3 | DTO klienta (odczyt, bez zmian — pole już istnieje) | `src/services/api/financeV2.types.ts:744-771` (`AnalysisKpiValueDto`) |
| 3 | Formatter współdzielony (odczyt WYŁĄCZNIE — zakaz zapisu) | `src/services/api/financeV2.types.ts:104-116` (`formatFinanceValueForDisplay`) — patrz zakaz w sekcji 1 |
| 3 | Nowa funkcja formatująca (zapis) | `src/services/api/financeV2.types.ts` (obok istniejącej) albo `src/components/Finance/Analysis/analysisKpiTable.contract.ts` — wybierz jedno miejsce |
| 3 | Row-builder (zapis) | `src/components/Finance/Analysis/analysisKpiTable.contract.ts:180-225` |
| 3 | Prezenter (zapis) | `src/components/Finance/Analysis/AnalysisKpiDetailCard.tsx:70-135` |
| 3 | Etykieta skali (odczyt, reużyj) | `src/services/api/financeV2.types.ts:257-277` (`financeUnitLabel`) |
| 3 | Test nowy (zapis) | `server/src/routes/__tests__/day171.data-contracts.pg.test.ts` |
| wszystkie | Raport (zapis) | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY171_KONTRAKTY_DANYCH_REPORT.md` |

**Nietykalne imiennie:** `server/src/routes/resultsVnext/okr.routes.ts` i cały `okr/**` (dyżur 170);
cały `src/components/Initiatives/**` (dyżur 172); `src/components/Economics/panels/**` i flaga
dyżuru 135; `src/components/ResultsVNext/ResultsKpiRegistryPage.tsx` (odczyt dozwolony, zapis
zakazany — patrz sekcja 1); `src/components/ResultsVNext/kpiApi.ts`'s `getKpi` (odczyt dozwolony,
zapis zakazany); `src/services/api/financeV2.types.ts:104-116`
(`formatFinanceValueForDisplay` — odczyt dozwolony, zapis zakazany); ośmiu wołających tej funkcji
wymienionych w sekcji 1; `server/migrations/20260830_day158_kpi_crosswalk.sql` (zamknięty zakres
dyżuru 158, nie ma związku z tym dyżurem mimo sąsiedztwa nazw plików); wszystkie migracje poza tymi,
które faktycznie okażą się potrzebne po R1 (jeśli żadne z trzech zgłoszeń nie wymaga nowej kolumny —
NIE twórz migracji na wyrost).

**Zasoby wyłączne:** baza na porcie `6071`, kontener `cx-day171-pg`, runtime na portach `4994` i
`4995`. Sprawdź faktyczną wolność tych portów przed użyciem (zajęte porty innych dyżurów w toku:
`6046`/`4986`/`4987` dyżur 159, `6050`/`4992`/`4993` dyżur 162, `6052` dyżur 164, `6060` dyżur 169)
— jeśli `6071` okaże się zajęty, wybierz kolejny wolny i zapisz w raporcie, którego użyłeś. ★ Port
`5000` jest zajęty na stałe przez macOS Control Center — nigdy go nie używaj.

# 5. BRAMKI ODBIORU

- **B1.** R1 ma cztery podsekcje (a/b/c/d) z tabelą plik:linia i jawnym wnioskiem dla każdej z
  trzech danych (nazwa KPI/nazwy osób, waluta, jednostka) — wykonane PRZED jakąkolwiek zmianą kodu.
- **B2. Zero zmyślania.** Jeśli R1(c) pokaże, że waluta nie jest wiarygodnie wypełniona nigdzie w
  zasięgu wyceny — kod NIE dostaje domyślnej waluty (ani `PLN`, ani `USD` z `billing_currency`).
  Ekran zostaje bez waluty, a raport ma jawną pozycję „do decyzji właściciela".
- **B3. Formatter współdzielony nietknięty.** `git diff` na
  `src/services/api/financeV2.types.ts` pokazuje wyłącznie DODANĄ nową funkcję i/lub nowe pole na
  DTO — ZERO zmian w istniejącym ciele `formatFinanceValueForDisplay` (linie 104-116). Test
  `src/services/api/__tests__/financeV2.types.test.ts` przechodzi bez modyfikacji.
- **B4. Osiem wołających poza Analizą nietkniętych.** `git diff` na `CalculationsView.tsx`,
  `AssumptionsView.tsx`, `ScenarioResultsView.tsx`, `CanonicalStatementTableV2.tsx`,
  `SourceEvidencePanel.tsx`, `ValuationValueCell.tsx` (poza samym dodaniem `unitSuffix` z R3, jeśli
  dotyczy) jest pusty.
- **B5. Zero warstwy wizualnej.** Diff nie dotyka szerokości kolumn, kolejności, kolorów ani
  innych tekstów niż te jawnie wymienione w R2/R3/R4 — jedyna zmiana to TREŚĆ komórek/pól.
- **B6. Rozłączność terytoriów.** Diff dyżuru nie zawiera żadnego pliku pod `okr/**`,
  `src/components/Initiatives/**`, ani `src/components/Economics/panels/**`.
- **B7.** Testy `day171.*` przechodzą na lokalnym Postgresie w kontenerze `cx-day171-pg` (albo
  faktycznie użytym porcie, jeśli `6071` był zajęty — zapisane w raporcie) i pokazują `SELECT`
  surowym SQL, nie odpowiedź endpointu, dla każdego z trzech zgłoszeń osobno: nazwa KPI dołączona
  do wiersza `rvn_kpi_scorecard_items`, wartość `organization_profiles.currency` (lub jej brak) w
  wierszu organizacji testowej, `unit_type='PERCENT'` przełożony na wartość pomnożoną razy 100 w
  odpowiedzi.
- **B8.** Napisz WPROST, jakiego configu Vitest użyłeś i gdzie leży: `vitest.config.ts:210`
  (`DB_TYPE: 'sqlite'`, korzeń repo) albo `server/vitest.config.ts:17`
  (`DB_TYPE: process.env.DB_TYPE || 'sqlite'`) — testy `day171.*` muszą jawnie ustawiać `DB_TYPE`/
  `RUN_DB_TESTS=1`, inaczej dostajesz MOCK DB i „przeszło" nic nie znaczy.
- **B9.** `scripts/dev/day161-fresh-migration-check.sh` uruchomiony i wynik wklejony do raportu —
  wymagany TYLKO jeśli R1 ujawni, że którekolwiek zgłoszenie wymaga nowej migracji (w chwili
  pisania tej instrukcji żadne z trzech nie powinno jej wymagać — wszystkie potrzebne kolumny już
  istnieją; jeśli pomiar to obali, zapisz dlaczego).
- **B10.** Raport ma sekcję „TWIERDZENIA NIEZWERYFIKOWANE" oraz osobno wypisaną obserwację o
  `getKpi` (`kpiRepository.ts:141-174`, zawsze `name: null`) i o kolumnie „Proces" w
  `ResultsKpiRegistryPage.tsx` — obie zgłoszone, żadna nie naprawiona w tym dyżurze.
