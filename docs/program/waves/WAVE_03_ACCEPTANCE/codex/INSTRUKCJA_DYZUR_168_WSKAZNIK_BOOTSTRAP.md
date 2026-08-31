# INSTRUKCJA DYŻURU nr 168 — Codex — „W swiezej organizacji nie da sie zalozyc pierwszego wskaznika - brak sciezki bootstrapu polityki widocznosci"

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
> **wyłącznie** `/private/tmp/cx-day168-wskaznik-bootstrap`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `18ba1bd3cf`**
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
Zakres: **Wyniki - wskazniki (KPI), bootstrap polityki widocznosci**.
Trasy front: `brak zmian - dyzur nie dotyka frontu`. Trasy tył: ``server/src/routes/resultsVnext/kpi.routes.ts`, `server/src/services/resultsVnext/kpi/kpiDefinitionCommands.ts`, `server/src/validators/resultsVnextKpi.validators.ts``.

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
WT=/private/tmp/cx-day168-wskaznik-bootstrap
MARKER=18ba1bd3cf

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day168-wskaznik-bootstrap-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day168-wskaznik-bootstrap/config.worktree"
cat "$VAULT/worktrees/cx-day168-wskaznik-bootstrap/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day168-wskaznik-bootstrap-scratch
mkdir -p /private/tmp/cx-day168-wskaznik-bootstrap-artefakty

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
git -C "$VAULT" log --oneline 18ba1bd3cf..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 18ba1bd3cf..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day168-wskaznik-bootstrap-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 18ba1bd3cf..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `cztery` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day168-wskaznik-bootstrap

# (T1) KTO RZUCA BLAD, A KTO MA TRASE
grep -rn "NO_ACTIVE_VISIBILITY_POLICY" server/src --include='*.ts' | grep -v __tests__
grep -rn "visibility-policy" server/src/routes --include='*.ts' | grep -v __tests__
#   oczekiwane: blad rzucaja TRZY domeny (roi, okr, kpi), a trase samoobslugowa
#   ma WYLACZNIE roi. Potwierdz sam.

# (T2) ★ WZORZEC DO NASLADOWANIA — OKR MA DZIALAJACY BOOTSTRAP
sed -n '571,579p' server/src/services/resultsVnext/okr/okrProgramCommands.ts
sed -n '663p;679p' server/src/routes/resultsVnext/okr.routes.ts
#   oczekiwane: publishProgram krok 4 wola publishVisibilityPolicy dla domain='okr',
#   a trasa /programs/:programId/publish faktycznie to uruchamia.
#   To NIE jest fantom - to dziala. Przeczytaj i zdecyduj, czy nasladujesz.

# (T3) CZY COKOLWIEK ZASIEWA POLITYKE PRZY TWORZENIU ORGANIZACJI
grep -c "rvn_platform_visibility_policies" server/src/services/organizationService.ts
#   oczekiwane: 0. Polityka nie powstaje znikad przy zakladaniu organizacji.

# (T4) SCHEMATY ZAPISU DEFINICJI WSKAZNIKA
grep -n "CreateKpiDraftSchema\|EditKpiDraftSchema" server/src/validators/resultsVnextKpi.validators.ts
#   oczekiwane: linie ~91-117 i ~134-151. Sprawdz, czy measurement_frequency_days
#   jest w nich obecne - i pamietaj, ze warstw jest CZTERY, nie jedna.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day168-wskaznik-bootstrap-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6059`. Twój JEDYNY port harnessu to `5006 i 5007`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day168-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6055 oraz 6062-6063 (odbiory nadzorcy), 6051/4994-4995 (163), 6056/4998-4999 (165), 6057/5004-5005 (166), 6058/5002-5003 (167), 6060/5008-5009 (169). ★ PORT 5000 ZAJETY NA STALE przez macOS Control Center - nigdy go nie uzywaj`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak - ten dyzur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartosci domyslnej zadnej istniejacej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY168_WSKAZNIK_BOOTSTRAP_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day168-wskaznik-bootstrap-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day168-wskaznik-bootstrap-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE OSLABIASZ KONTROLI WIDOCZNOSCI. TO JEST ZAKAZ NAJWYZSZEJ WAGI.** Bootstrap ma **UTWORZYC** polityke, a nie **OMINAC** sprawdzenie. Naprawa, ktora wycina bramke `NO_ACTIVE_VISIBILITY_POLICY`, czyni ja warunkowa albo domyslnie przepuszczajaca, jest **niedopuszczalna** - to byloby otwarcie dziury w kontroli dostepu do danych wynikow, a nie naprawa. Jesli dojdziesz do wniosku, ze inaczej sie nie da - **ZATRZYMAJ SIE i zapytaj**. **NIE WYMYSLASZ TRZECIEGO MECHANIZMU.** Wlasciciel zatwierdzil jeden z dwoch wzorcow: samoobslugowy endpoint jak w ROI (`roi.routes.ts:3172`) albo automat przy pierwszym uzyciu jak w OKR (`okrProgramCommands.ts:571-579`). Wybierz jeden i uzasadnij. **NIE DOTYKASZ NICZEGO POD `server/src/services/resultsVnext/okr/**`** - to terytorium dyzuru 169. Jesli pomiar wykaze, ze OKR tez wymaga naprawy, **ZGLOS to w raporcie i NIE NAPRAWIAJ**. **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji.** Pytanie, czy istniejace organizacje na demo maja te polityke, rozstrzygasz **z kodu i migracji**, nie polaczeniem - i mowisz wprost, czego bez dostepu do demo nie rozstrzygniesz | **Dyzur priorytetowy zlecony wprost przez wlasciciela.** W swiezej organizacji `POST /api/vnext/results/kpi` zwraca `409 NO_ACTIVE_VISIBILITY_POLICY` - pierwszego wskaznika **nie da sie zalozyc**. Zmierzone mutacyjnie przez drugi tor na czystej bazie. Wskazniki sa dzis ladne i nieuzywalne |

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
cd /private/tmp/cx-day168-wskaznik-bootstrap

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day168-pg psql -U postgres -d cx168 \
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
cd /private/tmp/cx-day168-wskaznik-bootstrap

docker run -d --name cx-day168-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx168 \
  -p 127.0.0.1:6059:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day168-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6059/cx168 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6059/cx168 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day168-wskaznik-bootstrap && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6059/cx168 \
JWT_SECRET=cx168-test-secret-do-not-reuse \
npx vitest run server/src/routes/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day168-wskaznik-bootstrap-artefakty/day168-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day168-wskaznik-bootstrap && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day168-wskaznik-bootstrap-artefakty/day168-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day168-wskaznik-bootstrap/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day168-pg psql -U postgres -d cx168 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day168-pg`.
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
> **(e) **Pierwsza, i zawezajaca zakres: OKR MA dzialajacy bootstrap - to nie jest fantom.** Zlecenie w karcie koordynacji tylko sugerowalo, ze cele 'dostaja polityke automatycznie'. Przeglad przy skladaniu tej instrukcji **potwierdzil to konkretnie**: `okrProgramCommands.ts:500` (`publishProgram`), krok 4 w liniach 571-579, wola `publishVisibilityPolicy` w tej samej transakcji, a trasa `okr.routes.ts:663` (`POST /programs/:programId/publish`) faktycznie to uruchamia. Komentarz w kodzie nazywa to 'first product-facing writer of rvn_platform_visibility_policies (Decision P5)'. **Czyli problem dotyczy WYLACZNIE wskaznika** - ROI ma endpoint, OKR ma automat, KPI nie ma nic. **Ale grep nie dowodzi dzialania w runtime** - zweryfikuj to realnym zadaniem HTTP w dwoch wariantach: bez publikacji Programu i po publikacji. **Druga: brak `measurement_frequency_days` to NIE jest jedno pole w dwoch schematach.** Pole jest nieobecne na **czterech warstwach**: schematy Zod (`resultsVnextKpi.validators.ts`, linie ~91-117 i ~134-151), interfejsy `CreateKpiDraftInput`/`EditDraftInput`, surowe `INSERT`/`UPDATE` w `kpiDefinitionCommands.ts`, oraz przekazanie w handlerach tras. **Naprawa jednej warstwy niczego nie da** - to jest ten sam ksztalt, ktory dzis kilka razy udawal gotowe. **Trzecia, poszlaka do sprawdzenia:** `visibilityResolver.ts:303` wprost mowi, ze KPI i ROI mialy tabele zasiewana wylacznie przez 'out-of-band rollout script'. Ten skrypt istnieje: `server/scripts/seed-wave3-results-owner-review.ts:187`. A `organizationService.ts` **nigdy** nie pisze do `rvn_platform_visibility_policies` przy tworzeniu organizacji (grep = 0). Czyli polityka powstawala **wylacznie recznym skryptem** - i to tlumaczy, dlaczego dziala na starych organizacjach, a nie dziala na nowych. **Czwarta: round-trip jest jedynym dowodem.** 'Endpoint zwrocil 200' nie wystarcza - dzis kilka razy okazalo sie, ze 200 nie znaczy nic. Czytaj stan **z bazy surowym SQL**. **Piata: `DB_TYPE` przypiety do `sqlite` w `vitest.config.ts:210` (korzen repo). Plik `server/vitest.config.ts` zostal naprawiony dyzurem 167 i honoruje juz zmienna z linii komend, ale **root config NIE** - jesli Twoj test lezy pod `tests/`, trafisz na to przypiecie. W raporcie napisz WPROST, jakiego configu uzyles i gdzie lezy**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day168-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day168-wskaznik-bootstrap-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycje R2 i R4 - sciezka bootstrapu dla domeny wskaznika oraz dowod od konca do konca, ze w swiezej organizacji da sie zalozyc pierwszy wskaznik i wpisac pomiar`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6059` albo `5006 i 5007` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6059` albo `5006 i 5007`** (`Z7`).

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

Właściciel zlecił to wprost 2026-08-30 (`docs/program/KOORDYNACJA.md`, sekcja „★★★ DWA DYŻURY
PRIORYTETOWE DLA TORU FUNKCJI", DYŻUR A) i uznał to za ważniejsze niż cokolwiek graficznego —
bez tego wskaźniki są ładne i nieużywalne.

Objaw, zmierzony mutacyjnie na czystej bazie przez drugi tor: w świeżej organizacji
`POST /api/vnext/results/kpi` zwraca **`409 NO_ACTIVE_VISIBILITY_POLICY`**. Zweryfikowałem to w
kodzie (nie odtworzyłem sam żądaniem HTTP — to Twoja pozycja R1/R4): `KpiNoActiveVisibilityPolicyError`
rzucana jest w `server/src/services/resultsVnext/kpi/kpiDefinitionCommands.ts:154` wewnątrz
`createKpiDraft` (linia 360: `if (!policy) { throw new KpiNoActiveVisibilityPolicyError(...) }`,
sam odczyt `getActiveVisibilityPolicy` — linie 355-358), a trasa
`server/src/routes/resultsVnext/kpi.routes.ts` mapuje ten typ błędu na `409` w
`handleKpiRouteError` (linia 271: `if (err instanceof KpiNoActiveVisibilityPolicyError)`, status
w linii 275). Pierwszego wskaźnika w świeżej organizacji nie da się założyć, bo nikt nigdy nie
napisał wiersza do `rvn_platform_visibility_policies` dla `(organization_id, domain='kpi')` —
schemat (`server/migrations/20260809_rvn_platform_visibility_core.sql`) nie ma żadnego `INSERT`,
tylko definicje tabel; sam grep to potwierdza (`grep -n INSERT` na tym pliku daje zero trafień).

**Nazwa pliku tras — sprawdzone, zgodne z zaleceniem nadzorcy:** `server/src/routes/resultsVnext/
kpi.routes.ts`. To realna nazwa, nie zgadywana — istnieje w repozytorium, obok `okr.routes.ts` i
`roi.routes.ts` w tym samym katalogu.

**Skąd bierze się wiersz polityki dla ROI/KPI dzisiaj (dla istniejących organizacji, o ile w
ogóle):** komentarz nad `publishVisibilityPolicy` (`server/src/services/resultsVnext/platform/
visibilityResolver.ts:301-303`) mówi wprost: „KPI/ROI only ever had this table seeded by an
out-of-band rollout script; OKR-E001's `publishProgram` is the first command that authors a row
here itself". Znalazłem ten skrypt: `server/scripts/seed-wave3-results-owner-review.ts:187` robi
ręczny `INSERT INTO rvn_platform_visibility_policies(...)` bezpośrednio na bazie — to nie jest
część ścieżki tworzenia organizacji (`server/src/services/organizationService.ts` — grep na
`visibility` w tym pliku daje zero trafień, jedyne `INSERT`y tam to `organizations` linia 230 i
`organization_members` linie 251/359). Innymi słowy: polityka widoczności dla `kpi`/`roi` istnieje
tylko tam, gdzie ktoś ją ręcznie zasiał skryptem — nigdy jako efekt uboczny zakładania organizacji
w produkcie.

## Czym ten dyżur NIE jest

Nie jest naprawą OKR — jeśli R1 potwierdzi, że OKR ma własną, osobną dziurę, **zgłaszasz to w
raporcie i NIE naprawiasz** (terytorium dyżuru 169, patrz zakazy). Nie jest przepisaniem
`publishVisibilityPolicy` ani schematu `rvn_platform_visibility_policies` — ten prymityw
(`server/src/services/resultsVnext/platform/visibilityResolver.ts:318-`) jest już gotowy i
używany przez ROI i OKR; Twoje zadanie to dopiąć do niego ścieżkę dla domeny `kpi`, nie budować
nowy mechanizm obok. Nie jest osłabieniem `NO_ACTIVE_VISIBILITY_POLICY` — bramka ma zostać, tylko
ma dostać sposób na to, żeby przestała być permanentnie nieosiągalna. Nie jest operacją na bazie
demo/staging/produkcja.

# 2. TEZY ZLECENIA

- **T1.** Trzy domeny (`roi`, `okr`, `kpi`) współdzielą jeden mechanizm fail-closed
  (`NO_ACTIVE_VISIBILITY_POLICY`, trzy niemal identyczne klasy błędów — porównaj
  `RoiCaseNoActiveVisibilityPolicyError` w `roiCaseCommands.ts:111`,
  `OkrSetNoActiveVisibilityPolicyError` w `okrSetCommands.ts:104`,
  `KpiNoActiveVisibilityPolicyError` w `kpiDefinitionCommands.ts:154` — wszystkie trzy mają
  identyczny `code = 'NO_ACTIVE_VISIBILITY_POLICY'`), ale tylko dwie z trzech mają dziś ścieżkę,
  która ten fail-closed potrafi kiedykolwiek spełnić. Zmierz, którą z trzech dotyczy to
  rzeczywiście, zanim uznasz cokolwiek za ustalone — Twoje własne ustalenie może różnić się od
  tego, co napisano w `KOORDYNACJA.md`, i wtedy wygrywa Twój pomiar, nie cudza notatka.
- **T2.** ROI i OKR to dwa **różne** wzorce bootstrapu polityki widoczności, nie jeden wzorzec
  zapisany dwa razy. ROI: samoobsługowy endpoint (`POST /visibility-policy`,
  `roi.routes.ts:3172`) wołany osobno przez klienta, z pełną warstwą governance (pinowany
  klucz/digest polityki, wymóg roli OWNER/ADMIN, wykrywanie kolizji, osobna tabela
  `rvn_roi_visibility_governance`). OKR: brak osobnego endpointu — polityka powstaje jako
  efekt uboczny **wewnątrz** `publishProgram` (`okrProgramCommands.ts:500-614`, krok 4 w liniach
  571-579), na tym samym połączeniu/transakcji co reszta publikacji programu, bez żadnej
  dodatkowej autoryzacji ponad tę, którą `publishProgram` już ma. KPI nie ma dziś żadnego z tych
  dwóch — R2 wybiera jeden, nie miesza obu.
- **T3.** Dopisanie `measurement_frequency_days` do schematów zapisu to nie jest zmiana w jednym
  miejscu. Zmierz dokładnie, ile warstw brakuje tego pola — zanim zaczniesz łatać, wypisz
  wszystkie.
- **T4.** „200 z endpointu" nie jest dowodem trwałości. Jedynym dowodem jest odczyt z bazy po
  pełnym cyklu zapis→odczyt, na świeżej organizacji, bez żadnego ręcznego zasiewania polityki
  przez skrypt typu `seed-wave3-results-owner-review.ts`.

# 3. POZYCJE DYŻURU

## R1 — pomiar zasięgu PRZED naprawą, dla trzech domen osobno

Dla `roi`, `okr` i `kpi` osobno ustal, z plik:linia:
- kto **publikuje** (pisze do `rvn_platform_visibility_policies`) politykę dla tej domeny — jeśli
  w ogóle ktoś to robi w kodzie produkcyjnym (nie w skrypcie zasiewającym);
- kto ją **czyta** (kto woła `getActiveVisibilityPolicy` z tym `domain`);
- co się dzieje w świeżej organizacji, gdy ktoś próbuje pierwszej operacji w tej domenie.

Punkt wyjścia, który masz zweryfikować i pogłębić (nie brać na wiarę): `roiCaseCommands.ts`
czyta i **nie** publikuje (jedyny publisher ROI to samoobsługowy endpoint `roi.routes.ts:3172`,
osobna droga); `okrSetCommands.ts:290-341` czyta w `createOkrSet` (linie 322-330: `const policy =
await getActiveVisibilityPolicy(...); if (!policy) throw new OkrSetNoActiveVisibilityPolicyError(...)`)
i publisher **istnieje** — `okrProgramCommands.ts:500` (`publishProgram`), krok 4 (linie 571-579)
woła `publishVisibilityPolicy(client, { organizationId, domain: OKR_VISIBILITY_DOMAIN, mode:
programRow.visibility_default, publishedBy: actorUserId })` na tym samym `client`/transakcji co
reszta publikacji. Ten publisher jest wpięty w realną trasę: `server/src/routes/resultsVnext/
okr.routes.ts` ma `POST /programs/:programId/publish` (linia 663, wołanie `publishProgram` w
linii 679) — sprawdź to sam, to jest kluczowe rozstrzygnięcie tego dyżuru. `kpiDefinitionCommands.ts`
czyta w `createKpiDraft` i **nie ma żadnego publishera** nigdzie w `server/src/services/
resultsVnext/kpi/`.

**Odtwórz `409` realnym żądaniem HTTP na czystej bazie** (kontener Postgres lokalny, migracje od
zera): załóż organizację, zaloguj/zaautoryzuj aktora, wywołaj `POST /api/vnext/results/kpi` z
poprawnym ciałem zgodnym z `CreateKpiDraftSchema` i pokaż w raporcie surową odpowiedź (status +
JSON body z `code: 'NO_ACTIVE_VISIBILITY_POLICY'`). Wzorzec harnessu HTTP+realny Postgres, z
którego możesz skopiować podejście: `server/src/routes/__tests__/day160.task-write-gate.pg.test.ts`
(montuje `ApiGateway` z `server/src/Gateway.js`, `express()`, `supertest`, `assertRealPostgresTestEnvironment`
z `tests/integration/_helpers/assertRealPostgres.js`) — bez tego odtworzenia naprawa jest
zgadywaniem.

★ **Sprawdź, czy OKR ma tę samą dziurę, jakiej rozstrzygnięcie zmienia zakres tego dyżuru.**
`createOkrSet` wymaga aktywnej polityki `domain='okr'`, a jedynym jej publisherem jest
`publishProgram`. To oznacza: w świeżej organizacji `POST` zakładający **OKR Set** też dostanie
`409`, DOPÓKI nikt nie opublikował żadnego Programu w tej organizacji. To nie jest ta sama
dziura co KPI — to jest wymagana kolejność produktowa (Program → publikacja → Cykl → Set), a nie
brak jakiegokolwiek mechanizmu. Zweryfikuj to rozróżnienie sam, na realnym żądaniu: (a) świeża
organizacja, od razu `POST` OKR Set — oczekuj `409`; (b) ta sama organizacja, najpierw
`createProgram` + `POST .../publish`, potem `POST` OKR Set — oczekuj sukcesu. Jeśli (b) faktycznie
działa, to potwierdza, że OKR **ma** działającą ścieżkę bootstrapu (nie jest to fantom — grepem
znalazłem wołanie, ale grep nie dowodzi działania w runtime; to Twój dowód, nie mój). Jeśli (b)
NIE działa (np. `publishProgram` sam pada, albo `visibility_default` na programie jest pusty/
niepoprawny i insert do `rvn_platform_visibility_policies` się wywala), **to jest realna dziura w
domenie OKR — zgłoś ją w raporcie z dowodem i NIE naprawiaj jej** (terytorium 169, patrz zakazy
poniżej).

★ **Najpierw ustal z kodu, czy istniejące organizacje dostają politykę przy tworzeniu — nie
łącz się z demo.** Zmierzone: `organizationService.ts` nie ma żadnego zapisu do
`rvn_platform_visibility_policies` (grep na `visibility` w tym pliku: zero trafień; jedyne
`INSERT`y w nim to `organizations` i `organization_members`). Jedynym miejscem, gdzie w tym
repozytorium widziałem zapis polityki dla `kpi`/`roi` poza samoobsługowym endpointem ROI, jest
ręczny skrypt `server/scripts/seed-wave3-results-owner-review.ts:187` — a to nie jest część
ścieżki produktowej zakładania organizacji, to osobne narzędzie odpalane ręcznie. **Wynikająca z
tego teza (do potwierdzenia lub obalenia przez Ciebie, nie do przyjęcia na wiarę): każda
organizacja, której nikt nie „dotknął" tym skryptem ani samoobsługowym endpointem ROI, ma dziś
zerowe wiersze w `rvn_platform_visibility_policies` dla `domain='kpi'`, niezależnie od tego, czy
jest nowa czy istnieje od miesięcy.** To, czy organizacje na demo akurat miały ten skrypt
odpalony, jest pytaniem, na które **nie masz jak odpowiedzieć bez łączenia się z demo** — napisz
to wprost w raporcie jako granicę tego, co ustaliłeś z samego kodu.

**Ukończone, gdy:** masz dla każdej z trzech domen tabelę (publisher → plik:linia albo „brak" /
czytelnik → plik:linia / wynik próby w świeżej organizacji), realny dowód HTTP `409` dla KPI,
realny dowód dla OKR w obu wariantach (a)/(b) powyżej, i jawne zdanie o granicy tego, co
rozstrzygasz bez demo.

## R2 — ścieżka bootstrapu dla domeny `kpi`

Przeczytaj oba wzorce w całości, zanim wybierzesz:

- **Wzorzec ROI** (`roi.routes.ts:3162-3196`, `visibilityResolver.ts:694-` funkcja
  `publishRoiGovernedVisibilityPolicy`, stałe `ROI_GOVERNED_VISIBILITY_POLICY.key`/`.digest` w
  liniach 421-424, błędy `RoiGovernedVisibilityPolicyMismatchError`/
  `RoiVisibilityGovernanceActorNotAuthorizedError`/`RoiGovernedVisibilityPolicyCollisionError`).
  To pełna warstwa governance: pinowany klucz+digest polityki (klient nigdy nie wybiera trybu —
  `PublishRoiVisibilityPolicySchema` w `roi.routes.ts:304-306` przyjmuje wyłącznie
  `idempotencyKey`), wymóg roli same-tenant ACTIVE OWNER/ADMIN, osobna tabela
  `rvn_roi_visibility_governance` śledząca kto/kiedy opublikował, wykrywanie kolizji (dwóch
  różnych aktorów próbujących publikacji). Samoobsługowy — użytkownik/administrator woła ten
  endpoint jawnie, osobno od zakładania pierwszego rekordu ROI.
- **Wzorzec OKR** (`okrProgramCommands.ts:500-614`, funkcja `publishProgram`, krok 4 w liniach
  571-579). Brak osobnego endpointu do polityki widoczności — publikacja polityki jest efektem
  ubocznym `publishProgram`, na tym samym `client` co reszta operacji, bez dodatkowej
  autoryzacji ponad `assertCommandCapability` na `results.okr.program.publish`. Tryb polityki
  (`mode: programRow.visibility_default`) pochodzi z pola, które program ma od swojego
  utworzenia — nie jest pinowany na sztywno jak w ROI.

**Różnica strukturalna, którą musisz wziąć pod uwagę przy wyborze:** OKR ma nadrzędny obiekt
(Program) z własnym cyklem życia draft→publish, i to ten cykl życia niesie bootstrap polityki
jako efekt uboczny jednego z jego kroków. KPI **nie ma** takiego nadrzędnego obiektu — `rvn_kpi_
definitions`/`rvn_kpi_definition_versions` nie mają żadnego odpowiednika „Programu" z własnym
publish. To znaczy: wzorca OKR nie da się przenieść 1:1 (nie ma osobnego kroku „publikuj coś
nadrzędnego" przed pierwszym KPI) — jego analogiem dla KPI byłby bootstrap **wewnątrz**
`createKpiDraft` samej (czyli automat przy pierwszym wywołaniu tej samej komendy, nie przy
osobnej wcześniejszej), z domyślnym trybem widoczności, który musiałby powstać znikąd (KPI nie
ma dziś żadnego pola wejściowego typu `visibilityDefault` analogicznego do
`programRow.visibility_default`). Wzorzec ROI da się przenieść bardziej dosłownie (osobny
endpoint, osobne wywołanie przed pierwszym `createKpiDraft`), kosztem zbudowania analogicznej
warstwy governance (albo świadomej decyzji, że KPI nie potrzebuje aż tylu zabezpieczeń co ROI —
to część Twojego uzasadnienia, nie coś do przyjęcia bez namysłu).

Wybierz **jeden** z dwóch, napisz w raporcie R2 sekcję z jawnym uzasadnieniem odwołującym się do
tej różnicy strukturalnej (i do wszystkiego innego, co sam znajdziesz przy lekturze obu plików).
Nie wolno zbudować trzeciego mechanizmu (np. seedowania polityki przy tworzeniu organizacji w
`organizationService.ts` — to nie jest ani wzorzec ROI, ani wzorzec OKR, i zmieniałoby zachowanie
poza domeną `kpi`).

**Ukończone, gdy:** masz jedną, wybraną i uzasadnioną ścieżkę bootstrapu dla `kpi`,
zaimplementowaną w `kpi.routes.ts` + `kpiDefinitionCommands.ts` (i, jeśli wybierzesz wzorzec ROI,
ewentualnie w `visibilityResolver.ts` jako współdzielony prymityw — ale nie kopiuj całej
governance ROI 1:1 bez uzasadnienia, dlaczego KPI potrzebuje dokładnie tego samego poziomu
kontroli).

## R3 — `measurement_frequency_days` w schematach zapisu

Zmierzone, plik:linia:
- Kolumna: `server/migrations/20260813_rvn_kpi_measurement_cadence.sql:15-16` (`ALTER TABLE
  rvn_kpi_definition_versions ADD COLUMN IF NOT EXISTS measurement_frequency_days INT NULL CHECK
  (... > 0)`), chroniona triggerem `rvn_kpi_definition_versions_protect_approved()`
  zaktualizowanym w tym samym pliku (linia 53: `OR NEW.measurement_frequency_days IS DISTINCT
  FROM OLD.measurement_frequency_days`) — nie blokuje edycji draftów, tylko wersji już
  zatwierdzonych, więc nie koliduje z `editDraft` (który i tak działa wyłącznie na
  `approval_status = 'draft'`, patrz `kpiDefinitionCommands.ts:550-556`).
- Czytana w `kpiNextObligationRepository.ts:97` (SQL `SELECT dv.measurement_frequency_days,
  latest.period_end FROM ...`), `:101` (`if (!cadence?.measurement_frequency_days) ...`), `:120`
  (`next.setUTCDate(next.getUTCDate() + cadence.measurement_frequency_days)`), `:128`
  (`frequencyDays: cadence.measurement_frequency_days`); i w `kpiPerspectivesRepository.ts:159,
  177,191` (trzy miejsca w SQL liczące `latest.period_end + make_interval(days =>
  kdv.measurement_frequency_days)` do wykrywania zaległości „My KPIs").
- **Schematy zapisu, imiennie:** `CreateKpiDraftSchema` (`server/src/validators/
  resultsVnextKpi.validators.ts:91-117`) i `EditKpiDraftSchema` (tamże, linie 134-151) — **żadna
  z dwóch nie ma pola dla tej kolumny** (zweryfikowane czytaniem obu definicji w całości, nie
  samym grepem).

**To NIE jest zmiana w jednym miejscu — zmierz całą ścieżkę, nie tylko schemat Zod.** Pole jest
nieobecne na **czterech** poziomach, nie na jednym:
1. Zod: `CreateKpiDraftSchema`/`EditKpiDraftSchema` (jak wyżej).
2. Wejście komendy: `CreateKpiDraftInput` (`kpiDefinitionCommands.ts:244-291` — lista pól kończy
   się na `sensitivity`/`createdBy` itd., brak `measurementFrequencyDays`) i `EditDraftInput`
   (`kpiDefinitionCommands.ts:490-514` — ten sam brak).
3. SQL zapisu: `INSERT INTO rvn_kpi_definition_versions` w `createKpiDraft`
   (`kpiDefinitionCommands.ts:398-403`, lista kolumn kończy się na `formula_text`) i `UPDATE
   rvn_kpi_definition_versions` w `editDraft` (`kpiDefinitionCommands.ts:580-586`, ten sam brak).
4. Przekazanie w trasie: wywołanie `createKpiDraft({...})` w `kpi.routes.ts:363-388` i
   `editDraft({...})` w linii 605 — nawet gdyby schemat i komenda przyjęły pole, trasa musi je
   jawnie przekazać z `body` do argumentów wywołania (wzorem każdego innego pola w tych dwóch
   blokach).

Napraw wszystkie cztery warstwy w obu operacjach (create i edit) — pominięcie którejkolwiek
zostawia pole martwe (np. samo dodanie go do Zod bez dodania do `INSERT` nadal da pustą kolumnę).

**Ukończone, gdy:** `POST /api/vnext/results/kpi` z `measurementFrequencyDays` w ciele zapisuje
niepustą wartość w `rvn_kpi_definition_versions.measurement_frequency_days` (dowód: `SELECT` po
zapisie), `PUT .../draft` z tym polem ją aktualizuje na drafcie, i masz w raporcie potwierdzenie
plik:linia dla wszystkich czterech warstw po naprawie.

## R4 — dowód od końca do końca na czystej bazie

Na lokalnym Postgresie, migracje od zera (`server/scripts/migrate.postgres.ts`, wywołane z
korzenia repo — inaczej `ENOENT ... server/server/migrations`), świeża organizacja:

1. `POST /api/vnext/results/kpi` — dziś: `409`. Po naprawie R2: `201`, `outcome: 'applied'`.
2. Zapisz pomiar (`recordMeasurement` albo odpowiadająca trasa — znajdź ją sam w
   `server/src/routes/resultsVnext/kpi.routes.ts`, prawdopodobnie
   `POST .../measurements`).
3. Odśwież (kolejne `GET` na definicję/pomiary tego KPI).
4. **Pomiar wraca z serwera** — porównaj wartość zwróconą przez `GET` z tą zapisaną w kroku 2.
5. Dowód **z bazy surowym SQL** (`SELECT * FROM rvn_kpi_measurements WHERE kpi_id = ...` i
   `SELECT organization_id, domain, visibility_mode, is_active FROM
   rvn_platform_visibility_policies WHERE organization_id = ... AND domain = 'kpi'`), nie sam
   status HTTP.

Plus dowód mutacyjny: zepsuj celowo bootstrap (np. tymczasowo zwróć wcześnie z funkcji publikującej
politykę, zanim wykona `INSERT`/`UPDATE`), pokaż, że test z kroku 1 pada z powrotem na `409`,
przywróć kod, pokaż czyste drzewo (`git diff` puste poza zamierzonymi zmianami) i test znowu
zielony.

**Ukończone, gdy:** masz log/zrzut całej sekwencji 1-5 z surowym SQL, i dowód mutacyjny
(przed-zepsute-po) w raporcie.

# TWARDE ZASADY

- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wyłącznie lokalny Postgres w
  kontenerze.
- **Nie wymyślasz trzeciego mechanizmu polityki widoczności.** Wzorzec ROI albo wzorzec OKR —
  decyzja właściciela, patrz R2. Jeśli żaden z dwóch nie pasuje idealnie, wybierz ten bliższy i
  napisz w raporcie, w czym Twoja implementacja różni się od pierwowzoru i dlaczego.
- **Nie osłabiasz kontroli widoczności.** Bootstrap ma **utworzyć** politykę, a nie **ominąć**
  sprawdzenie `NO_ACTIVE_VISIBILITY_POLICY`. Naprawa, która usuwa albo owija w `try/catch`
  wywołanie `getActiveVisibilityPolicy`/rzucanie `KpiNoActiveVisibilityPolicyError` zamiast
  sprawić, żeby polityka faktycznie istniała, jest **niedopuszczalna** — to byłaby dziura w
  kontroli dostępu do danych wyników. To zakaz najwyższej wagi w tym dyżurze.
- **Round-trip jest jedynym dowodem trwałości.** „Endpoint zwrócił 200/201" nie wystarcza — patrz
  R4, punkt 5 (dowód surowym SQL) jest obowiązkowy.
- ★ **Migracja (jeśli będzie potrzebna) musi przejść pełny przebieg od PUSTEJ bazy.** Kolejność
  ustala `server/scripts/migrationOrdering.ts` (`sortMigrationsDeterministically`, zweryfikowane
  wywołanie w `migrate.postgres.ts:853`), NIE zwykły `files.sort()`. Jeśli migracja czyta
  jakąkolwiek kolumnę, dodaj strażnik `ALTER TABLE <t> ADD COLUMN IF NOT EXISTS <k> <typ>;` na
  początku. Uruchom `scripts/dev/day161-fresh-migration-check.sh` (zweryfikowane: plik istnieje,
  ma prawa wykonywalne) i wklej wynik do raportu. **Prawdopodobnie ten dyżur nie potrzebuje żadnej
  nowej migracji** — R2 to zapis do istniejącej tabeli (`rvn_platform_visibility_policies`) przez
  istniejący prymityw (`publishVisibilityPolicy`), a R3 to dopisanie pola do już istniejącej
  kolumny. Migrację twórz tylko, jeśli pomiar realnie każe — nie z automatu.
- Pułapka: `DB_TYPE` przypięty do `sqlite` w `server/vitest.config.ts:17` (wewnątrz bloku
  `test.env`, linie 9-25) **oraz** `vitest.config.ts:210` (korzeń repo, też w bloku `test.env`) —
  ten blok wygrywa z linią komend. **W raporcie napisz WPROST, jakiego configu użyłeś i gdzie
  leży** — bez tego nikt nie odtworzy Twojego wyniku. Jeśli w Twojej gałęzi/worktree ten wzorzec
  jest już naprawiony (osobny dyżur 167 miał to zrobić równolegle), zapisz to również wprost i
  zmierz, czy naprawa faktycznie tam jest, zamiast zakładać którykolwiek stan.
- Pułapka: `No test files found` NIE jest `PASS`; ścieżki względne do `server/`, komenda z
  katalogu `server/`.
- Pułapka: `migrate.postgres.ts` Z KORZENIA REPO — inaczej `ENOENT ... server/server/migrations`.
  Bez `RUN_DB_TESTS=1` `Database.ts` podstawia MOCK DB.
- ★ Port **5000 jest zajęty przez macOS Control Center** — nie używaj go nigdy.
- Wymóg sekcji „TWIERDZENIA NIEZWERYFIKOWANE".

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY168_WSKAZNIK_BOOTSTRAP_REPORT.md` |
| Zapis | `server/src/routes/resultsVnext/kpi.routes.ts` (nazwa zweryfikowana — to prawdziwy plik tras KPI; dopisanie ewentualnego endpointu bootstrapu i/lub przekazania `measurementFrequencyDays`) |
| Zapis | `server/src/services/resultsVnext/kpi/kpiDefinitionCommands.ts` (`createKpiDraft`, `editDraft`, ich `Input`-y, ewentualny nowy publisher polityki dla `kpi`) |
| Zapis | `server/src/validators/resultsVnextKpi.validators.ts` (`CreateKpiDraftSchema` linie 91-117, `EditKpiDraftSchema` linie 134-151 — dopisanie `measurementFrequencyDays`) |
| Zapis | `server/src/services/resultsVnext/platform/visibilityResolver.ts` — WYŁĄCZNIE jeśli R2 wybierze wzorzec wymagający współdzielonego dodatku do tego pliku (np. nowej funkcji analogicznej do `publishRoiGovernedVisibilityPolicy` dla `kpi`); nie zmieniaj istniejących funkcji ROI/OKR w tym pliku |
| Zapis | test `server/src/routes/__tests__/day168.kpi-bootstrap.pg.test.ts` |
| Zapis | migracja **wyłącznie** `server/migrations/20260830_day168_kpi_visibility_bootstrap.sql`, i tylko jeśli pomiar wykaże, że jest potrzebna |
| Odczyt | `server/src/routes/resultsVnext/roi.routes.ts` (wzorzec ROI, linie ~299-3196) |
| Odczyt | `server/src/services/resultsVnext/roi/roiCaseCommands.ts` |
| Odczyt | `server/src/services/resultsVnext/okr/okrProgramCommands.ts`, `okrSetCommands.ts` |
| Odczyt | `server/src/services/resultsVnext/kpi/kpiNextObligationRepository.ts`, `kpiPerspectivesRepository.ts` |
| Odczyt | `server/migrations/20260809_rvn_platform_visibility_core.sql`, `20260813_rvn_kpi_measurement_cadence.sql`, `20261020_roi_governed_visibility_policy.sql`, `20261021_rvn_platform_visibility_roi_governed_mode.sql` |
| Odczyt | `server/scripts/seed-wave3-results-owner-review.ts` (tło dla R1 — nie zmieniasz) |
| Odczyt | `server/src/services/organizationService.ts` (tło dla R1 — nie zmieniasz) |

**Nietykalne imiennie:** cały `server/src/services/resultsVnext/okr/**` — to terytorium dyżuru
169; jeśli R1 wykaże realną dziurę w OKR, zgłoś ją w raporcie i zostaw nietkniętą. Cały
`server/src/services/resultsVnext/roi/**` poza samym odczytem — nie zmieniasz zachowania ROI.
Żadna migracja poza `20260830_day168_kpi_visibility_bootstrap.sql`. `server/src/routes/
resultsVnext/okr.routes.ts`, `roi.routes.ts` — czytasz, nie zmieniasz.

**Zasoby wyłączne:** baza na porcie `6059`, kontener `cx-day168-pg`, runtime na portach `5004` i
`5005`. Zajęte przez inne, równoległe dyżury (sprawdź `lsof` sam przed startem, tak jak robi to
już `day161-fresh-migration-check.sh` — nie ufaj tej liście bez własnej weryfikacji):
`6012, 5433, 6047, 6054-6055` (odbiory nadzorcy), `6051/4994-4995` (163), `6052/4996-4997` (164),
`6046, 6049, 6050` (159-162), `6056/4998-4999` (165), `6057/5000-5001` (166),
`6058/5002-5003` (167). Żadnego innego portu, żadnej bazy zdalnej.

★ **Rozłączność.** Równolegle biegną 163 (zadania), 165 (agent), 166 (decyzje), 167 (konfiguracja
i testy), 169 (cele/OKR). **NIE dotykasz niczego pod `server/src/services/resultsVnext/okr/**`.**
Jeśli R1 wykaże, że OKR też wymaga naprawy, zgłoś to w raporcie i NIE naprawiaj — trafi do 169.

# 5. BRAMKI ODBIORU

- **B1.** R1 ma dla każdej z trzech domen (`roi`, `okr`, `kpi`) osobną parę plik:linia
  publisher/czytelnik (albo jawne „brak publishera") i realny dowód HTTP `409` dla KPI.
- **B2.** R1 ma realny dowód dla OKR w obu wariantach: świeża organizacja bez opublikowanego
  Programu (oczekiwany `409` na tworzeniu Setu) i ta sama organizacja po `createProgram` +
  `POST .../publish` (oczekiwany sukces LUB, jeśli pada, zgłoszona i nienaprawiona dziura z
  dowodem, przekazana do 169).
- **B3.** R1 jawnie mówi, czego nie da się rozstrzygnąć bez dostępu do demo (czy istniejące
  organizacje mają politykę) — bez próby połączenia się z demo/stagingiem/produkcją.
- **B4.** R2 wybiera dokładnie jeden wzorzec (ROI albo OKR), z pisemnym uzasadnieniem
  odwołującym się do różnicy strukturalnej (brak nadrzędnego obiektu „Program" po stronie KPI) i
  do treści obu przeczytanych plików — nie trzeci mechanizm.
- **B5.** R2: bootstrap **tworzy** politykę, nigdy nie omija/wyłącza sprawdzenia
  `NO_ACTIVE_VISIBILITY_POLICY`. Dowód: `git diff` pokazuje, że `getActiveVisibilityPolicy` i
  rzucanie `KpiNoActiveVisibilityPolicyError` w `createKpiDraft` pozostają nietknięte — zmienia
  się tylko to, co dzieje się PRZED tym sprawdzeniem (albo w osobnym, wcześniejszym wywołaniu).
- **B6.** R3: `measurementFrequencyDays` działa na wszystkich czterech warstwach (Zod, wejście
  komendy, SQL, przekazanie w trasie) dla **obu** operacji (create i edit) — dowód `SELECT` po
  zapisie i po edycji.
- **B7.** R4: pełny cykl (załóż → zapisz pomiar → odśwież → pomiar wraca z serwera) ma dowód z
  surowego SQL, nie samego statusu HTTP, plus dowód mutacyjny (zepsute→pada, przywrócone→zielone,
  czyste drzewo).
- **B8.** Migracja, jeśli powstała, przechodzi `scripts/dev/day161-fresh-migration-check.sh` od
  pustej bazy — wynik wklejony do raportu dosłownie. Jeśli migracja NIE powstała, raport mówi
  wprost dlaczego (pomiar wykazał, że istniejące prymitywy wystarczają).
- **B9.** Raport podaje wprost, jakiego configu Vitest użyto (`server/vitest.config.ts` czy inny)
  i czy wzorzec pinowania `DB_TYPE` w linii 17 tego pliku był w danym momencie naprawiony czy nie
  — bez zgadywania na podstawie tej instrukcji.
- **B10.** Zero zmian w `server/src/services/resultsVnext/okr/**` i `server/src/services/
  resultsVnext/roi/**` (poza odczytem) w `git diff` tego dyżuru.
- **B11.** Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" istnieje i wymienia każde twierdzenie
  przeniesione z tej instrukcji lub z `KOORDYNACJA.md`, którego nie potwierdziłeś własnym
  pomiarem (w szczególności: stan polityk widoczności na istniejących organizacjach demo/
  staging — z definicji nierozstrzygalny bez łączenia się z tymi bazami, co jest zakazane).
