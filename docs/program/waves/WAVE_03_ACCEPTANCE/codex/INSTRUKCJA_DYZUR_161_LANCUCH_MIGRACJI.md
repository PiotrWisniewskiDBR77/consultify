# INSTRUKCJA DYŻURU nr 161 — Codex — „Integralnosc calego lancucha migracji - przeglad, bramka regresyjna i naprawa straznikami"

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
> **wyłącznie** `/private/tmp/cx-day161-lancuch-migracji`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `218d020958`**
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
Zakres: **Warstwa danych - odtwarzalnosc bazy od zera, fundament runbooka cofania**.
Trasy front: `brak - ten dyzur nie dotyka frontu`. Trasy tył: `\`server/scripts/migrate.postgres.ts\`, \`server/scripts/migrationOrdering.ts\` i \`STRICT_SCHEMA_REPAIR_REPORT.md\` - do odczytu; \`server/migrations/*.sql\` - zapis wylacznie straznikow`.

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
WT=/private/tmp/cx-day161-lancuch-migracji
MARKER=218d020958

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day161-lancuch-migracji-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day161-lancuch-migracji/config.worktree"
cat "$VAULT/worktrees/cx-day161-lancuch-migracji/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day161-lancuch-migracji-scratch
mkdir -p /private/tmp/cx-day161-lancuch-migracji-artefakty

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
git -C "$VAULT" log --oneline 218d020958..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 218d020958..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day161-lancuch-migracji-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 218d020958..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `cztery` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day161-lancuch-migracji

# (T1) GDZIE NAPRAWDE USTALANA JEST KOLEJNOSC
grep -n "sortMigrationsDeterministically" server/scripts/migrate.postgres.ts
grep -nE "NUMBERED_RE|DATED_RE|LATE_PHASE_MANIFEST|SAME_DATE_ORDER_OVERRIDES" server/scripts/migrationOrdering.ts | head
#   UWAGA: `files.sort()` w migrate.postgres.ts:188 to TYLKO zbieranie plikow z dysku.
#   Realna kolejnosc ustala migrationOrdering.ts, wolany z migrate.postgres.ts:853.
#   Zrozum FAZY i TABLICE WYJATKOW, zanim cokolwiek policzysz - inaczej policzysz zla kolejnosc.

# (T2) SLEPA PLAMKA TEGO BEZPIECZNIKA
#   Przeczytaj komentarze w migrationOrdering.ts oraz STRICT_SCHEMA_REPAIR_REPORT.md w korzeniu repo.
#   Ustal WLASNYMI SLOWAMI, jakiej klasy inwersji ten modul NIE lapie. To jest cel dyzuru.

# (T3) ZNANY PRZYPADEK - JUZ NAPRAWIONY, SLUZY ZA WZORZEC
head -14 server/migrations/20260830_day159_chunk_org_backfill.sql
#   oczekiwane: straznik ADD COLUMN IF NOT EXISTS metadata, komentarz NAPRAWA NADZORCY.
#   Ten przypadek jest ZAMKNIETY. Szukasz pozostalych.

# (T4) CZY LANCUCH PRZECHODZI DZIS OD ZERA
#   Bramka wejsciowa. Postaw pusty kontener, uruchom pelne migracje Z KORZENIA REPO.
#   Zapisz wynik, ZANIM cokolwiek zmienisz. Bez tego nie masz punktu odniesienia.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day161-lancuch-migracji-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6049`. Twój JEDYNY port harnessu to `4990 i 4991`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day161-pg`**. **ZAKAZANE:** `6012, 5433, 6039/4972-4973 (153), 6044/4982-4983 (157), 6045/4984-4985 (158), 6046/4986-4987 (159), 6047 (odbior nadzorcy 159), 6048/4988-4989 (160), 6050/4992-4993 (162)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak - ten dyzur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartosci domyslnej zadnej istniejacej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY161_LANCUCH_MIGRACJI_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md` - ten dyzur jest przekrojowy i nie zamyka zadnego modulu menu. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day161-lancuch-migracji-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day161-lancuch-migracji-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ MIGRACJI NISZCZACYCH I ZAKAZ ZMIANY NAZW PLIKOW.** Wolno Ci wylacznie DODAWAC straznikow `ADD COLUMN IF NOT EXISTS` na poczatku istniejacych migracji. Zadnych DROP, zadnych ALTER zmieniajacych typ, zadnego przenoszenia ani przemianowywania plikow migracji - nazwa wyznacza porzadek wykonania. **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji.** Jesli znalezisk okaze sie bardzo duzo, NIE naprawiaj wszystkiego na sile: napraw te, ktore faktycznie wywracaja lancuch w potwierdzonym przebiegu, a reszte oddaj jako uczciwy inwentarz do osobnej decyzji **GRANICA WOBEC DYZURU 162:** rownolegle biegnacy dyzur 162 ma prawo utworzyc **jeden** nowy plik migracji o nazwie \`server/migrations/20260830_day162_provenance_closure.sql\`. Ten plik **nie nalezy do Twojego terytorium** - nie tworzysz go, nie edytujesz i nie dodajesz do niego straznikow, nawet jesli pojawi sie w Twoim drzewie po scaleniu. Twoja licencja na \`server/migrations/*.sql\` obejmuje wylacznie pliki **istniejace na markerze** \`218d020958\`. | 30.08 migracja dyzuru 159 czytala kolumne dodawana 134 pliki pozniej w kolejnosci wykonania. Na bazie budowanej od zera caly lancuch wywracal sie w polowie i pozostale migracje nigdy sie nie wykonywaly. Znaczy to, ze **odtworzenie bazy po awarii bylo uszkodzone** - a to jest przycisk bezpieczenstwa calego programu. **Bezpiecznik na te klase bledu JUZ ISTNIEJE** - modul \`server/scripts/migrationOrdering.ts\`, zbudowany po poprzednim kryzysie tej samej klasy (\`STRICT_SCHEMA_REPAIR_REPORT.md\`). Nie zadzialal, bo ma udokumentowana slepa plamke: **inwersji producent-konsument WEWNATRZ tej samej fazy nie lapie automatycznie**. Oba nasze pliki byly \`DATED\`, wiec nie zostaly porownane. Ten dyzur ma ustalic, ile jeszcze takich par siedzi w tej plamce |

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
cd /private/tmp/cx-day161-lancuch-migracji

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day161-pg psql -U postgres -d cx161 \
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
cd /private/tmp/cx-day161-lancuch-migracji

docker run -d --name cx-day161-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx161 \
  -p 127.0.0.1:6049:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day161-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6049/cx161 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6049/cx161 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day161-lancuch-migracji && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6049/cx161 \
JWT_SECRET=cx161-test-secret-do-not-reuse \
npx vitest run server/src/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day161-lancuch-migracji-artefakty/day161-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day161-lancuch-migracji && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day161-lancuch-migracji-artefakty/day161-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day161-lancuch-migracji/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day161-pg psql -U postgres -d cx161 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day161-pg`.
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
> **(e) **Przyrost na bazie juz zmigrowanej NIE JEST DOWODEM.** To cala przyczyna, dla ktorej awaria 159 przeszla przez odbior wykonawcy: dowodzil dopisaniem pliku do bazy, ktora miala juz pelna historie. W tej kolejnosci zdarzen brakujaca kolumna **juz istnieje** i blad jest niewidoczny. Kazdy dowod musi pochodzic z przebiegu od **PUSTEJ** bazy. **Druga pulapka - i ona wywrocila nadzorce:** kolejnosci NIE wyznacza \`files.sort()\`. Wyznacza ja \`sortMigrationsDeterministically\` z \`migrationOrdering.ts\` (fazy plus tablice wyjatkow). Jesli policzysz pozycje zwyklym sortowaniem nazw, dostaniesz **inne liczby niz produkt** i twoj inwentarz bedzie bezwartosciowy. Licz pozycje tym samym kodem, ktorego uzywa migrator. **Trzecia:** \`ADD COLUMN IF NOT EXISTS\` w tresci migracji **nie liczy sie jako odczyt kolumny** - szukasz odwolan w SELECT, WHERE, UPDATE i CTE, nie w instrukcjach tworzacych. **Czwarta:** skrypt migracji uruchamiaj **z korzenia repo**, nie z katalogu \`server/\` - inaczej dostaniesz \`ENOENT ... server/server/migrations\` i pomylisz to z awaria lancucha.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day161-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day161-lancuch-migracji-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycje R1 i R3 - pelny przebieg lancucha od PUSTEJ bazy oraz bramka regresyjna, ktora nie pozwoli temu odrosnac`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6049` albo `4990 i 4991` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6049` albo `4990 i 4991`** (`Z7`).

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

Migracja `server/migrations/20260830_day159_chunk_org_backfill.sql` czyta `k.metadata`
w CTE (linie 30–31: `pg_input_is_valid(NULLIF(k.metadata, ''), 'jsonb')` /
`k.metadata::jsonb ->> 'organization_id'`). Kolumnę `knowledge_chunks.metadata` tworzy
dopiero `server/migrations/20261120_fresh_db_schema_gap_closure.sql:2243`
(`ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS metadata TEXT DEFAULT '{}';`).
Na bazie budowanej od zera ta druga migracja wykonuje się DUŻO później niż pierwsza —
konsument przed producentem.

Nadzorca to zmierzył i naprawił jedną linią: dzisiaj, na górze
`20260830_day159_chunk_org_backfill.sql` (linie 4–11), stoi już strażnik
`ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS metadata TEXT DEFAULT '{}';`
z komentarzem `NAPRAWA NADZORCY 2026-08-30`. Ten jeden przypadek jest już załatany na
markerze `218d020958`. Dyżur 161 NIE naprawia go po raz drugi — dyżur szuka wszystkich
POZOSTAŁYCH przypadków tego samego wzorca w pozostałych ~868 plikach.

**Sprostowanie mechanizmu, żeby wykonawca nie szukał w złym miejscu.** Kolejność
wykonania migracji NIE jest „zwykłym sortowaniem alfabetycznym” pliku po pliku.
`server/scripts/migrate.postgres.ts:172–194` (`getAllMigrations`) robi `files.sort()`
tylko na etapie ZBIERANIA plików z dysku (linia 188) — to jeszcze nie jest kolejność
wykonania. Prawdziwą kolejność ustala `sortMigrationsDeterministically()` /
`compareMigrationOrder()` / `phaseAndKeyFor()` z **`server/scripts/migrationOrdering.ts`**,
wywołane w `migrate.postgres.ts:853`. To osobny moduł (wydzielony celowo, bo
`migrate.postgres.ts` ma shebang i nie da się go testować przez import — komentarz na
górze `migrationOrdering.ts:1–16`), z fazami: Faza 0 = pliki `NNN_...` sortowane numerycznie,
Faza 1 = pliki `YYYYMMDD_...` sortowane po dacie, Faza 2 = jawna lista
`LATE_PHASE_MANIFEST` (dziś 2 pozycje), Faza 3 = reszta. Do tego trzy tablice wyjątków:
`EARLY_VERSION_OVERRIDES`, `SAME_DATE_ORDER_OVERRIDES`, `LATE_PHASE_MANIFEST` — każda
z jednozdaniowym uzasadnieniem per plik, bo poprzedni dyżur (opisany w
`STRICT_SCHEMA_REPAIR_REPORT.md`, w repo) już raz naprawiał dokładnie tę klasę błędu
(inwersja NUMBERED/DATED) i zostawił po sobie ten mechanizm.

**Dlaczego mechanizm nadzorcy sam tego nie złapał.** `20260830_day159_chunk_org_backfill.sql`
i `20261120_fresh_db_schema_gap_closure.sql` mają OBA nazwy typu DATED — trafiają do tej
samej Fazy 1, sortowanej po dacie kalendarzowej. `20260830` < `20261120`, więc nawet
w PRAWDZIWEJ, wyrafinowanej kolejności uruchomieniowej day159 nadal wykonuje się przed
gap_closure. `migrationOrdering.ts:88–101` opisuje wprost tę klasę: "inwersja
producent/konsument w OBRĘBIE tej samej fazy” — i mówi, że faza+sort sam z siebie tego
NIE naprawia; wymaga ręcznego wpisu do jednej z trzech tablic wyjątków. Dla tej pary
plików taki wpis nie istnieje. To jest dokładny powód, dla którego istniejący bezpiecznik
(zbudowany po poprzednim kryzysie) nie wyłapał tego kolejnego przypadku — a to oznacza,
że mogą być inne pary w tej samej sytuacji.

Odtworzenie statyczne (kopia `phaseAndKeyFor`/`compareMigrationOrder` uruchomiona lokalnie
przez nadzorcę, bo `tsx`/`ts-node` nie były dostępne w tym środowisku — **nie jest to dowód
z żywej bazy, tylko reprodukcja logiki sortownika**) daje: 868 plików uruchamialnych po
filtrze `isSqliteOnlyMigration` (na 1080 plików `.sql`/`.js`/`.ts` na dysku), day159 na
pozycji 713/868, gap_closure na pozycji 847/868, 133 pliki między nimi, 155 plików,
które w trybie strict (bez `--safe`) nigdy by się nie wykonały, gdyby day159 padł.
Wykonawca MUSI to potwierdzić żywym przebiegiem (`--dry-run` na pustej bazie wypisuje
`Pending migrations: N` w prawdziwej kolejności) — liczby powyżej to punkt startowy,
nie ustalony fakt.

**Skutek dla właściciela: uszkodzone było odtworzenie bazy po awarii**
(`Harvard/wdrozenie-100/_RUNBOOK_COFANIA.md`), czyli przycisk bezpieczeństwa całego
programu. Demo i staging nie były zagrożone — mają pełną historię migracji już
zaaplikowaną — i to jest dokładnie powód, dla którego wcześniejszy wykonawca (dyżur 159)
tego nie zobaczył: dowodził przyrostem na bazie już zmigrowanej, nie odtworzeniem od zera.

## Czym ten dyżur NIE jest

Nie jest drugą naprawą `20260830_day159_chunk_org_backfill.sql` — ta migracja ma już
strażnik (linia 11) i dyżur jej nie dotyka poza ewentualnym potwierdzeniem, że strażnik
działa. Nie jest przepisaniem `server/scripts/migrationOrdering.ts` na pełny topologiczny
sort — ten moduł istnieje, działa, ma świadomie udokumentowane ograniczenie (nie łapie
inwersji w obrębie tej samej fazy) i się go NIE przepisuje w tym dyżurze; najwyżej dopisuje
się do niego wpis w istniejącej tablicy wyjątków, jeśli to wybrany wariant naprawy —
i tylko dla przypadków POTWIERDZONYCH przebiegiem. Nie jest zmianą nazw ani przenoszeniem
plików migracji (patrz zakazy w tezach). Nie jest operacją na bazie demo/staging/produkcja.
Nie jest audytem CAŁEJ treści każdej z ~868 migracji linia po linii bez narzędzia — to
skala niemożliwa do zrobienia ręcznie w jeden dyżur, stąd R2 wymaga metody (grep
ukierunkowany albo skrypt), nie czytania wszystkiego wzrokiem.

# 2. TEZY ZLECENIA

- **T1.** Przyrost na bazie już zmigrowanej (jak zrobił to poprzedni wykonawca) NIE JEST
  DOWODEM integralności łańcucha. Jedyny ważny dowód w tym dyżurze pochodzi z przebiegu
  na PUSTEJ bazie, od pierwszej migracji do ostatniej. To główny bezpiecznik dyżuru —
  ma być powtórzony wprost w raporcie, nie tylko tutaj.
- **T2.** Istniejący mechanizm porządkowania (`migrationOrdering.ts`) jest dobrym
  narzędziem, ale ma udokumentowaną ślepą plamkę: inwersję producent/konsument w OBRĘBIE
  tej samej fazy (dwie migracje DATED albo dwie NUMBERED) nie wykrywa automatycznie —
  wymaga ręcznego wpisu. Zakładać trzeba, że są inne takie pary, nie tylko day159/gap_closure.
- **T3.** Naprawa ma być addytywna i odwracalna donikąd — strażnik `ADD COLUMN
  IF NOT EXISTS` na bazie z pełną historią jest bez znaczenia (kolumna już istnieje),
  na pustej bazie czyni migrację samowystarczalną. Żadna inna forma naprawy (przenoszenie
  pliku, zmiana daty w nazwie, ręczna edycja `LATE_PHASE_MANIFEST` bez dowodu z przebiegu)
  nie wchodzi w grę bez osobnej decyzji.
- **T4.** Jeśli znalezisk jest dużo, uczciwy inwentarz „to jeszcze nie sprawdzone” jest
  wart więcej niż pospieszna naprawa wszystkiego. Naprawiamy tylko to, co POTWIERDZONE
  przebiegiem faktycznie wywraca łańcuch; resztę zostawiamy jako jawną listę do osobnej
  decyzji nadzorcy.

# 3. POZYCJE DYŻURU

## R1 — pełny przebieg od pustej bazy jako bramka wejściowa

Postaw świeży kontener Postgres (własny, lokalny — patrz zasoby wyłączne w tabeli
licencji). Z KORZENIA repozytorium (nie z `server/` — inaczej `ENOENT
.../server/server/migrations`, bo ścieżki w `migrate.postgres.ts` są liczone względem
cwd procesu), z `DB_TYPE=postgres` i `DATABASE_URL` wskazującym na kontener, uruchom
`tsx server/scripts/migrate.postgres.ts` (odpowiednik `npm run db:migrate` —
`package.json:196/198/199`, wariant strict, BEZ `--safe`). Musi się skończyć linią
`✅ Postgres migrations complete`. Jeśli pada — to jest znalezisko numer jeden, opisz je
z pełnym komunikatem błędu i nazwą pliku, i dopiero wobec niego kalibruj resztę dyżuru
(R2 zaczyna się od tego konkretnego przypadku, nie tylko od inwentarza teoretycznego).

Zrób też `--dry-run` na tej samej pustej bazie PRZED strict-runem: wypisze
`Pending migrations: N` i listę w PRAWDZIWEJ kolejności wykonania — to jest twój dowód
na rzeczywistą pozycję dowolnego pliku (grep po nazwie w tej liście), nie plain `ls | sort`.

**Ukończone, gdy:** masz log pełnego przebiegu (dry-run + strict) od pustej bazy, wynik
jest jednoznaczny (przechodzi albo pada na konkretnym pliku z konkretnym błędem), i wiesz
z dry-runu, na której pozycji naprawdę stoi każdy plik, o którym piszesz w R2.

## R2 — systematyczny inwentarz zależności kolumnowych

Dla każdej migracji w `server/migrations/` ustal, do jakich tabel/kolumn ODWOŁUJE SIĘ
w odczycie (`SELECT`, `WHERE`, `JOIN ... ON`, `UPDATE ... SET x = (SELECT ...)`, CTE) —
NIE w `CREATE TABLE`, NIE w `ADD COLUMN IF NOT EXISTS` (to tworzenie, nie odczyt). Dla
każdego takiego odwołania sprawdź, czy ta kolumna ma producenta WCZEŚNIEJ w prawdziwej
kolejności z R1 (dry-run), a nie w kolejności na dysku. Zaproponowana metoda (możesz
wybrać inną, liczy się wynik): grep ukierunkowany na wzorce typu `\bFROM\s+\w+`,
`\bJOIN\s+\w+`, `\w+\.\w+` wewnątrz `SELECT`/`WHERE`/CTE, zestawiony z listą
`CREATE TABLE`/`ADD COLUMN` per plik, potem automatyczne zestawienie pozycji z dry-runu.
868 plików ręcznie nie ma sensu — to zadanie na skrypt jednorazowy (nie musi wejść do
`tests/`, może zostać w scratchu wykonawcy, ale metoda i wynik muszą być odtwarzalne).

Wynik: tabela `migracja → kolumna czytana → tabela.kolumna → gdzie tworzona (plik) →
pozycja tworzenia w dry-runie → pozycja czytającej migracji w dry-runie → PRZED czy PO`.
Osobno wypisz przypadki niepewne (np. kolumna tworzona przez wiele plików przez
`ADD COLUMN IF NOT EXISTS` w kilku miejscach — trzeba wziąć NAJWCZEŚNIEJSZĄ pozycję
tworzenia, nie dowolną).

**Ukończone, gdy:** masz kompletną tabelę (albo jawnie opisany zakres, którego skrypt
nie objął i dlaczego) i listę kandydatów na inwersję PRZED filtrowaniem do potwierdzonych
przypadków w R4.

## R3 — bramka regresyjna, żeby to nie odrosło

Zaprojektuj automat wykrywający tę klasę defektu przy następnym razie. Dwa warianty do
rozważenia, wybierz i uzasadnij (możesz zrobić oba, na różnych progach — jeden szybki
w CI, jeden prawdziwszy jako gate przed promocją):

- **(a) Wariant z bazą** — `scripts/dev/day161-fresh-migration-check.sh` (nazwa przybita):
  stawia kontener od zera, odpala pełny `db:migrate` (strict), sprawdza exit code i
  `✅ Postgres migrations complete` w outpucie. Prawdziwszy (łapie WSZYSTKIE klasy błędu,
  nie tylko brakujące kolumny), wolniejszy, wymaga Dockera w CI.
- **(b) Wariant statyczny** — `server/src/__tests__/day161.migration-chain-order.test.ts`
  (nazwa przybita): importuje `phaseAndKeyFor`/`compareMigrationOrder`/
  `sortMigrationsDeterministically` bezpośrednio z `server/scripts/migrationOrdering.ts`
  (ten moduł jest już czysty i importowalny — po to został wydzielony, patrz
  `migrationOrdering.ts:1–16`), buduje prawdziwą kolejność wykonania i dla każdej pary
  (kolumna czytana, plik czytający) z inwentarza R2 asertuje, że producent stoi wcześniej.
  Szybszy, nie stawia bazy, ale wymaga utrzymywanego inwentarza zależności (z R2) jako
  danych wejściowych testu — jeśli ktoś doda nową migrację z nowym odwołaniem, trzeba
  dopisać wpis, inaczej test niczego nowego nie sprawdzi (opisz to ograniczenie wprost
  w komentarzu w teście).

**Ukończone, gdy:** masz uzasadnienie wyboru (a)/(b)/oba, wybrany wariant przechodzi na
obecnym stanie repo PO naprawach z R4, i PADA gdyby ktoś cofnął naprawę (dowód różnicowy:
chwilowo usuń strażnik z day159, uruchom bramkę, pokaż czerwony wynik, przywróć strażnik).

## R4 — naprawa znalezionych przypadków

Wzorzec naprawy jest już ustalony i sprawdzony na day159 (linie 4–11 tego pliku): na
początku migracji czytającej dopisz `ALTER TABLE <tabela> ADD COLUMN IF NOT EXISTS
<kolumna> <typ>;` dla każdej kolumny, którą ta migracja czyta, a której producent stoi
później w prawdziwej kolejności z R1. Addytywne, idempotentne — na bazie z pełną
historią (demo/staging) to no-op, bo kolumna już istnieje z właściwego producenta.

Napraw WYŁĄCZNIE przypadki POTWIERDZONE przebiegiem (R1 pada na nich, albo test z R3
w wariancie (b) czerwieni się na nich) — nie każdy teoretyczny kandydat z R2. Dla
każdej naprawy: przebieg od pustej bazy PRZED (pada z konkretnym błędem) i PO (przechodzi
dalej / kończy się `✅`). Jeśli inwentarz z R2 wskaże więcej kandydatów niż da się
bezpiecznie potwierdzić i naprawić w tym dyżurze, zostaw resztę jako jawną, policzoną
listę w raporcie — decyzję o naprawie kolejnych podejmuje nadzorca osobno.

**Ukończone, gdy:** każda naprawiona migracja ma dowód różnicowy przed/po z pustej bazy,
diff dotyka WYŁĄCZNIE dodanych linii `ADD COLUMN IF NOT EXISTS` na górze pliku (żadnych
DROP, żadnej zmiany typu, żadnej zmiany nazwy pliku), i lista nienaprawionych kandydatów
(jeśli istnieje) jest w raporcie z liczbą i jednym zdaniem dlaczego odłożone.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY161_LANCUCH_MIGRACJI_REPORT.md` |
| Zapis | `server/migrations/*.sql` — WYŁĄCZNIE dodanie strażników `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` na górze pliku, dla migracji potwierdzonych jako łamiące łańcuch w R1/R4. Zakaz DROP, zakaz zmiany typu istniejącej kolumny, zakaz przenoszenia/przemianowania pliku |
| Zapis | `server/src/__tests__/day161.migration-chain-order.test.ts` (nazwa przybita — wariant statyczny R3) |
| Zapis | `scripts/dev/day161-fresh-migration-check.sh` (nazwa przybita — wariant z bazą R3) |
| Zapis | ewentualny skrypt roboczy inwentarza R2 (dowolna nazwa w `scripts/dev/` lub scratchu wykonawcy — nie musi wejść do `tests/`) |
| Odczyt | `server/scripts/migrate.postgres.ts` (cały plik — zwłaszcza `getAllMigrations`:172–194, `main()`:838+, wywołanie sortownika:853) |
| Odczyt | `server/scripts/migrationOrdering.ts` (cały plik — `phaseAndKeyFor`/`compareMigrationOrder`/`sortMigrationsDeterministically`, `LATE_PHASE_MANIFEST`, `EARLY_VERSION_OVERRIDES`, `SAME_DATE_ORDER_OVERRIDES`) — jeśli wariant (b) wpisuje coś do tych tablic, to WYŁĄCZNIE po dowodzie z przebiegu, nie na wyczucie |
| Odczyt | `STRICT_SCHEMA_REPAIR_REPORT.md` (korzeń repo) — poprzedni dyżur tej samej klasy błędu, opisuje dlaczego mechanizm wygląda tak jak wygląda i jakiej klasy inwersji NIE łapie |
| Odczyt | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY159_BACKFILL_WIEDZY_REPORT.md` — kontekst, po co powstała migracja day159 |
| Odczyt | `package.json` (skrypty `db:migrate*`, linie ~196–201) |

**Nietykalne imiennie:** `server/migrations/20260830_day159_chunk_org_backfill.sql` linie
4–11 (już naprawione — nie cofać); żadna migracja poza dodaniem strażników na górze;
`server/src/services/ai/documentGovernance.ts`; `server/src/services/organizationContext/
ContextRetrievalService.ts`; `server/src/services/ai/AIPipeline.ts`; cały `src/**`.

**Zasoby wyłączne:** własny lokalny kontener Postgres na porcie do wyboru przez
wykonawcę spoza zakresu portów innych dyżurów w toku (sprawdź `docker ps` przed startem,
żeby nie kolidować) — zapisz w raporcie, którego portu i nazwy kontenera użyłeś. Zakaz
łączenia się z jakąkolwiek bazą demo/staging/produkcja — `DATABASE_URL`/
`DATABASE_PUBLIC_URL` mają wskazywać wyłącznie na `localhost`/kontener lokalny;
`assertNoPrivateRailwayDbHostOutsideRailway` w `migrate.postgres.ts` i tak by to
zablokowało dla adresów Railway, ale nie licz na to jako jedyny bezpiecznik.

# 5. BRAMKI ODBIORU

- **B1. Dowód wyłącznie z pustej bazy.** Żadne twierdzenie w raporcie o tym, czy łańcuch
  „działa”, nie opiera się na bazie z istniejącą historią migracji. Każdy przebieg
  cytowany w raporcie ma zapisany moment startu kontenera (świeży, pusty wolumen).
- **B2. Pełny przebieg końcowy.** Po wszystkich naprawach z R4, pełny `tsx
  server/scripts/migrate.postgres.ts` (strict, bez `--safe`) od pustej bazy kończy się
  `✅ Postgres migrations complete`. Jeśli nie da się tego osiągnąć w ramach tego dyżuru
  (np. odkryto defekt niebędący inwersją kolumnową, spoza zakresu R4), raport mówi to
  wprost i nie udaje, że gate przeszedł.
- **B3. Idempotencja.** Drugi przebieg tej samej komendy na tej samej (już zmigrowanej)
  bazie daje `Pending migrations: 0` / `Applying migrations: 0` — naprawy z R4 nie
  zepsuły powtarzalności.
- **B4. Zero migracji niszczących.** Diff dyżuru w `server/migrations/*.sql` zawiera
  wyłącznie dodane linie `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` na górze
  istniejących plików. Żadnego `DROP`, żadnej zmiany typu, żadnej zmiany nazwy pliku,
  żadnego nowego pliku migracji.
- **B5. Bramka regresyjna działa i się broni.** Wybrany wariant (a)/(b)/oba z R3
  przechodzi na finalnym stanie i PADA na sztucznie przywróconym defekcie (dowód
  różnicowy: usuń strażnik → gate czerwony → przywróć → gate zielony).
- **B6. Inwentarz z R2 jest kompletny albo jawnie ograniczony.** Raport ma tabelę z R2
  (migracja → kolumna → producent → pozycje → przed/po) i, jeśli metoda nie objęła
  100% plików, wprost mówi które i dlaczego — nie milczy o luce.
- **B7. Nienaprawione kandydaty są policzone, nie ukryte.** Jeśli inwentarz wskazał
  więcej podejrzanych par niż naprawiono, raport ma osobną sekcję z ich listą i liczbą —
  bez próby naprawienia wszystkiego na siłę w jednym dyżurze.
- **B8. Sekcja „TWIERDZENIA NIEZWERYFIKOWANE”.** Raport ma wydzieloną sekcję wymieniającą
  wprost, czego wykonawca NIE zdążył/nie mógł zweryfikować (np. zachowanie pod `--safe`,
  wpływ na `DatabaseInitializer.ts`/`PostgresDatabase.initDb()` — dwie inne, niezależne
  ścieżki bootstrapu wspomniane w `STRICT_SCHEMA_REPAIR_REPORT.md`, które ten dyżur
  świadomie zostawia poza zakresem, jeśli ich nie dotknął).
- **B9. Zakaz baz zdalnych.** Raport potwierdza, że każdy przebieg szedł na lokalnym
  kontenerze — nazwa/port zapisane, zero adresów demo/staging/produkcja w historii poleceń
  cytowanej w raporcie.
