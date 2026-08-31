# INSTRUKCJA DYŻURU nr 175 — Codex — „163-bis - przejmujemy dobra czesc naprawy utraty pracy w karcie zadania i usuwamy dwie regresje, ktore zatrzymaly odbior"

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
> **wyłącznie** `/private/tmp/cx-day175-karta-bez-regresji`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `d3d36cd5f5`**
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
Zakres: **Moja Praca - karta zadania, sekcja "Ryzyko i alternatywy" (ponowne wydanie dyzuru 163, zatrzymanego przy odbiorze, z poprawka regresji zapisu)**.
Trasy front: ``src/components/MyWork/TaskDetailView.tsx` - `loadTask` (odczyt GET `risk-alternatives`), `handleSave` (zapis PUT `risk-alternatives`, aktualizacja `lastSavedSnapshot`/`lastSavedAt`, autozapis co 900ms)`. Trasy tył: ``server/src/routes/pmo/tasks.routes.ts` (WYLACZNIE nowa trasa sekcji GET/PUT `/:id/risk-alternatives`, zero zmian w linii 67 i w istniejacych trasach), `server/src/controllers/TaskController.ts` (dwie nowe metody), `server/src/validators/task.validators.ts` (dwa nowe opcjonalne pola), nowa migracja `server/migrations/20260830_day175_task_risk_alternatives.sql``.

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
WT=/private/tmp/cx-day175-karta-bez-regresji
MARKER=d3d36cd5f5

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day175-karta-bez-regresji-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day175-karta-bez-regresji/config.worktree"
cat "$VAULT/worktrees/cx-day175-karta-bez-regresji/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day175-karta-bez-regresji-scratch
mkdir -p /private/tmp/cx-day175-karta-bez-regresji-artefakty

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
git -C "$VAULT" log --oneline d3d36cd5f5..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only d3d36cd5f5..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day175-karta-bez-regresji-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only d3d36cd5f5..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `piec` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day175-karta-bez-regresji

# (T1) NA SWIEZYM MARKERZE NIE MA JESZCZE ZADNEJ CZESCI 163
grep -n "risk-alternatives" server/src/routes/pmo/tasks.routes.ts
grep -n "risks\|alternatives" server/src/validators/task.validators.ts
ls server/migrations/ | grep -i "risk\|day163\|day175"
#   oczekiwane: WSZYSTKO puste. Marker `d3d36cd5f5` nie zawiera zadnego fragmentu
#   pracy 163 - galaz day163 nigdy nie zostala scalona. Przenosisz dobra czesc
#   swiadomie, nie dziedziczysz jej automatycznie.

# (T2) BRAMA JEST STALA I NIETYKALNA - PUT ZAWSZE DOSTANIE 409
sed -n '1,45p' server/src/middleware/executionSpineLegacyReadOnly.middleware.ts
sed -n '55,70p' server/src/routes/pmo/tasks.routes.ts
#   oczekiwane: `requireCanonicalExecutionWriter` zamontowane w linii 67 (`router.use`),
#   PUT nie jest w `READ_ONLY_METHODS` (GET/HEAD/OPTIONS) ani w wyjatku DELETE budget/entries.
#   KAZDY PUT pod ta trasa dostanie 409 - to jest stan docelowy, nie usterka do naprawienia.

# (T3) DOKLADNE LINIE REGRESJI W PORZUCONYM WORKTREE (TYLKO ODCZYT, NIE DOTYKASZ)
git -C /private/tmp/cx-day163-utrata-pracy-karty diff 23bc57aaf3..HEAD -- src/components/MyWork/TaskDetailView.tsx
#   oczekiwane: PUT risk-alternatives dodany WYLACZNIE w galezi `if (taskId)` po
#   `Api.updatePersonalTask`, `throw new Error(...)` na `!response.ok`, ZERO wywolania
#   `setLastSavedSnapshot` w tej samej galezi przed throw. Przeczytaj cala historie
#   pracy 163 (m.in. `git -C /private/tmp/cx-day163-utrata-pracy-karty log --oneline 23bc57aaf3..HEAD`)
#   i raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY163_UTRATA_PRACY_KARTY_REPORT.md`
#   w tym worktree - sekcja 9 "Do odbioru" nazywa dokladnie ten sam problem z innej strony.

# (T4) ISTNIEJACY WZORZEC BLEDU 409 W handleSave - SPRAWDZ CZY DA SIE PONOWNIE UZYC
sed -n '1340,1360p' src/components/MyWork/TaskDetailView.tsx
grep -n "^  put: async\|^const handleResponse" src/services/api.ts
#   oczekiwane: istniejacy catch juz rozroznia `apiError?.status === 409 && apiError.data?.code
#   === 'TASK_VERSION_CONFLICT'` - ale tylko dla bledow rzuconych przez wspolny klient
#   (`handleResponse`, ktory doklada `.status`/`.data` do Error). Recznie rzucony
#   `new Error(string)` z surowego `fetch()` NIE ma tego ksztaltu i nigdy nie trafi w ten
#   warunek. `Api.put(url, data)` istnieje jako gotowy klient z tym samym ksztaltem bledu -
#   oceń, czy warto go uzyc zamiast surowego `fetch()`.

# (T5) ROZLACZNOSC Z RYWNOLEGLYMI DYZURAMI - SAM SPRAWDZ 174, BO W TYM REPO GO NIE WIDAC
git branch -a | grep -E "day17[0-4]"
find docs/program/waves/WAVE_03_ACCEPTANCE/codex -iname "*174*"
#   oczekiwane dzis: 174 nie istnieje ani jako galaz, ani jako instrukcja w tym repo -
#   port 6074/5018-5019 jest zarezerwowany "na wszelki wypadek" przez nadzorce. Jesli
#   podczas Twojej pracy 174 sie pojawi, sprawdz jego tabele licencji zanim cokolwiek
#   scalisz lub zapushujesz - do raportu wpisz wynik tego sprawdzenia, jaki by nie byl.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day175-karta-bez-regresji-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6075`. Twój JEDYNY port harnessu to `5020 i 5021`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day175-pg`**. **ZAKAZANE:** `6012, 5433, 6047 i 6054-6055 oraz 6061-6067 (odbiory nadzorcy), 6051/4994-4995 (163 - PORZUCONY WORKTREE, wciaz NIETYKALNY jako dowod w sprawie), 6068/5010-5011 (170), 6069/5012-5013 (171), 6070/5014-5015 (172), 6071/5016-5017 (173), 6074/5018-5019 (174 - port zarezerwowany przez nadzorce; w tym repo nie widac ani galezi, ani instrukcji 174 - sprawdz sam na starcie, patrz T5). ★ PORT 5000 ZAJETY NA STALE przez macOS Control Center`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak - ten dyzur NIE wprowadza ani jednej nowej flagi i NIE zmienia wartosci domyslnej zadnej istniejacej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY175_KARTA_BEZ_REGRESJI_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md` - ten dyzur nie zamyka modulu menu. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day175-karta-bez-regresji-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day175-karta-bez-regresji-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **NIE ZDEJMUJESZ I NIE ZAWĘŻASZ BRAMY 409** (`requireCanonicalExecutionWriter`, montaz `tasks.routes.ts:67`) - to jest NAJWAZNIEJSZY zakaz tego dyzuru, bo pierwsza pokusa naprawy regresji to "a moze wpuscic PUT risk-alternatives poza brame". Nie. Naprawiasz WYLACZNIE to, jak `TaskDetailView.tsx` reaguje na stale, oczekiwane `409` - nie samo `409`. **NIE ZMIENIASZ WYGLADU** - sekcja `risk-alternatives` zostaje w `TASK_AI_CONTRACT_NONE` (wzorzec A, bez `persistenceNotice`/banera w UI) dokladnie jak dzis; naprawiasz komunikat toast/log, nie dodajesz nowego komponentu ani banera. **STARY WORKTREE `/private/tmp/cx-day163-utrata-pracy-karty` I GALAZ `codex/day163-utrata-pracy-karty-20260830` ZOSTAJA NIETKNIETE** - to dowod w sprawie (STOP przy odbiorze), czytasz z niego (`git show`/`git diff`/`git log`), nigdy nie zapisujesz, nie usuwasz, nie robisz w nim `git worktree remove`. Twoje miejsce pracy to WYLACZNIE swiezy worktree z markera `d3d36cd5f5`. **ROZLACZNOSC Z DYZUREM 173 (wydany, moze biec rownolegle):** 173 dotyka `src/components/MyWork/DecisionDetailView.tsx` (TYLKO blok odczytu klucza pamieci, linie ok. 2420-2428), `src/components/InitiativeTasksTab.tsx`, `src/components/dashboard/UserTaskList.tsx`, `src/components/Portfolio/InitiativeSidePanel.tsx`, `src/components/Initiatives/calendar/InitiativeCalendar.tsx` - ZERO tych plikow pokrywa sie z Twoja licencja (`TaskDetailView.tsx`, `tasks.routes.ts`, `TaskController.ts`, `task.validators.ts`, nowa migracja). Zweryfikuj to sam czytajac `docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_173_DOMKNIECIA.md` i wpisz rozlacznosc do raportu jawnie, zdanie po zdaniu, nie samym stwierdzeniem "brak konfliktu". **ROZLACZNOSC Z 160/161/162/170/171/172:** czytasz `tasks.routes.ts` i `my-work.routes.ts` jak zawsze wolno (160/162 - odczyt), nie dotykasz zadnej istniejacej migracji poza dodaniem swojego nowego pliku (161), nie dotykasz `aiActionExecutor.ts`/`taskExecutor.ts`/`my-work.routes.ts` (162), nie dotykasz `okr.routes.ts`/`OkrCheckInRecordDialog.tsx` (170), `kpiScorecards/**`/`Economics/**` (171), `InitiativeDocumentView.tsx`/`ExceleView.tsx` (172). **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji.** | Dyzur 163 zmierzyl i nazwal realny problem (karta zadania cicho gubi cztery-piec sekcji), zaprojektowal bezpieczny wariant trwalosci (kolumny JSONB na `tasks`, wzorem `decisions.alternatives`) i zbudowal migracje + walidator + trase + kontroler + test z dowodem mutacyjnym dla odczytu - ta czesc jest czysta i warta przejecia. Ale w tym samym diffie wprowadzil aktywna regresje w `handleSave`: PUT do nowej trasy `/:id/risk-alternatives` jest zamontowany PO `router.use(requireCanonicalExecutionWriter)` (`tasks.routes.ts:67`) i PUT nie jest w `READ_ONLY_METHODS` ani w wyjatku `DELETE /budget/entries/:id` - wiec ZAWSZE dostaje `409`, dzis i w kazdej przyszlej probie, dopoki brama istnieje. Kod dnia 163 traktuje ten stale-409 jak katastrofe: `if (!riskAlternativesResponse.ok) throw new Error(...)` PO tym, jak `Api.updatePersonalTask` juz zapisal tytul/opis/status/checklist/etc. na serwerze. Rzucony wyjatek omija wspolny blok "Update dirty baseline" (`setLastSavedSnapshot`/`setLastSavedAt`), wiec `lastSavedSnapshot` zamraza sie na starej wartosci. Uzytkownik widzi `toast.error('Failed to save task')` mimo realnie udanego zapisu, a `isDirty` (`lastSavedSnapshot !== draftSnapshot`) zostaje trwale `true` - `autosaveTimerRef` uzbraja nowy timer 900ms po kazdym renderze i wola `handleSave(true)` w nieskonczonosc, kazda proba konczy sie tym samym 409 i tym samym brakiem aktualizacji snapshotu. Wlasny raport 163 (sekcja 9, "Do odbioru") uczciwie przyznaje, ze status zapisu jest BLOCKED i ze decyzja UX nalezy do nadzorcy - ta decyzja jest wlasnie tresci a tego dyzuru. |

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
cd /private/tmp/cx-day175-karta-bez-regresji

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day175-pg psql -U postgres -d cx175 \
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
cd /private/tmp/cx-day175-karta-bez-regresji

docker run -d --name cx-day175-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx175 \
  -p 127.0.0.1:6075:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day175-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6075/cx175 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6075/cx175 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day175-karta-bez-regresji && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6075/cx175 \
JWT_SECRET=cx175-test-secret-do-not-reuse \
npx vitest run server/src/routes/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day175-karta-bez-regresji-artefakty/day175-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day175-karta-bez-regresji && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day175-karta-bez-regresji-artefakty/day175-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day175-karta-bez-regresji/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day175-pg psql -U postgres -d cx175 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day175-pg`.
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
> **(e) ★★ **Pierwsza, dokladny mechanizm regresji nr 1 (falszywy blad po udanym zapisie).** W `handleSave`, galaz `if (taskId)`: `Api.updatePersonalTask(...)` zapisuje tytul/opis/status/priorytet/checklist/etc. i **konczy sie sukcesem**. Zaraz potem 163 dodal surowy `fetch(PUT /tasks/:id/risk-alternatives)` BEZ zadnego warunku - a ta trasa zawsze zwraca `409`, bo lezy za `requireCanonicalExecutionWriter`. `if (!response.ok) throw new Error(...)` przerywa `try` PRZED wspolnym blokiem "Update dirty baseline" (ktory wola `setLastSavedSnapshot`/`setLastSavedAt` i stoi PO calym `if (taskId) {...} else {...}`, wspolny dla obu galezi). Kod ladowal do `catch`, gdzie generyczny `toast.error(t('myWork.taskDetail.toastError3','Failed to save task'))` klamie uzytkownikowi - zadanie ZOSTALO zapisane, ale ekran mowi inaczej. **Druga, dokladny mechanizm regresji nr 2 (petla autozapisu).** Poniewaz `setLastSavedSnapshot` nigdy nie zostal wywolany w tej sciezce, `lastSavedSnapshot` zamraza sie na wartosci sprzed edycji. `isDirty` (linia definicji ok. `TaskDetailView.tsx:4798`, `taskId ? lastSavedSnapshot.length>0 && draftSnapshot!==lastSavedSnapshot : ...`) zostaje trwale `true`. Efekt `autosaveTimerRef` (ok. `:4805-4821`) uzbraja `setTimeout(...900)` za kazdym razem, gdy `isDirty && !saving` - czyli po KAZDYM renderze, w nieskonczonosc, i kazde wywolanie `handleSave(true)` trafia w ten sam mur `409`. To jest realna petla bijaca w backend co ~900ms, dopoki karta jest otwarta - zweryfikuj to zegarem (fake timers) albo realnym logiem sieciowym, nie samym czytaniem kodu. **Trzecia, pulapka ksztaltu bledu.** Istniejacy `catch` juz ma warunek `apiError?.status===409 && apiError.data?.code==='TASK_VERSION_CONFLICT'` dla proby wspolbieznej edycji zadania - to jest wzorzec DO NASLADOWANIA, ale dziala tylko dla bledow, ktore przeszly przez wspolny klient `handleResponse` w `src/services/api.ts` (doklada `.status`/`.data` do `Error`). Recznie rzucony `new Error(string)` z surowego `fetch()` (jak w 163) NIGDY nie trafi w ten warunek - jest to inny ksztalt bledu. `Api.put(url, data)` (`src/services/api.ts`, ok. linii 12138) jest gotowym klientem, ktory produkuje wlasnie ten rozpoznawalny ksztalt - rozwaz go zamiast surowego `fetch`, zamiast wymyslac trzeci wzorzec bledu w tym samym pliku. **Czwarta, zakres naprawy - nie psuj tego, co dziala.** Sukces bazowego zapisu (`Api.updatePersonalTask`) MUSI zawsze prowadzic do `setLastSavedSnapshot`/`setLastSavedAt`/toast sukcesu/`onSaved` - niezaleznie od tego, co zrobi wywolanie risk-alternatives. Trwaly `409` z risk-alternatives ma zostac zaraportowany uczciwie (nie polkniety w ciszy, nie zaraportowany jako calkowita porazka zapisu), ale NIE MOZE odwolac ani opoznic aktualizacji baseline dla reszty karty. **Piata, nie generuj toast-sztormu.** Jesli petla 900ms zostanie tylko czesciowo naprawiona (np. `isDirty` przestaje byc trwale `true`, ale kazdy "cichy" autosave nadal probuje PUT risk-alternatives i za kazdym razem cos pokazuje), to nowy, mniejszy ksztalt tego samego bledu - `silent=true` wywolania `handleSave` (autosave) NIE MOGA produkowac widocznego dla uzytkownika toastu za kazdym cyklem. **Szosta, `persistedDraft`/`draftSnapshot` (ok. `TaskDetailView.tsx:4755-4787`) NIE ZAWIERA `risks`/`alternatives`** - edycja WYLACZNIE ryzyk/alternatyw, bez dotkniecia ktoregokolwiek z ok. 13 pol bazowych, nie oznaczy karty jako dirty i nie odpali autozapisu samodzielnie. To osobna, wczesniej istniejaca luka (nie ten sam defekt co regresja 1/2) - zmierz i opisz w raporcie, napraw TYLKO jesli jest to trywialne i bezpieczne w ramach istniejacej licencji; jesli wymaga szerszej zmiany `persistedDraft`, zostaw i zglos DO DECYZJI WLASCICIELA. **Siodma, GET w `loadTask` ma ten sam ksztalt `throw new Error(...)` przy `!response.ok`** - poniewaz GET przechodzi przez brame bez przeszkod (jest w `READ_ONLY_METHODS`), to dzis nie jest znana regresja, ale porcjonujesz TEN SAM kod z 163 do swojego pliku - zdecyduj swiadomie, czy pojedynczy nieudany GET risk-alternatives powinien wywalac calez ladowanie calej karty zadania (23 inne pola), czy tylko tej jednej sekcji, i zapisz decyzje w raporcie z uzasadnieniem - to NIE jest jedna z dwoch nazwanych regresji, wiec nie musisz jej zmieniac, ale musisz ja swiadomie ocenic. **Osma, raport 163 (w porzuconym worktree) juz przyznaje w sekcji 9, ze status zapisu jest BLOCKED i ze to jest decyzja nadzorcy** - Twoim zadaniem jest wlasnie podjac te decyzje UX (uczciwy komunikat + stabilny baseline) w granicach "nie zdejmuj bramy" i "nie zmieniaj wygladu", nie odkladac ja dalej.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day175-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day175-karta-bez-regresji-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R2 - naprawa dwoch regresji zapisu (falszywy "Failed to save task" po realnie udanym zapisie; petla autozapisu co 900ms bez konca); bez niej samo odtworzenie dobrej czesci 163 (R1) NIE jest bezpieczne do wydania - to ten sam defekt, ktory zatrzymal odbior 163`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6075` albo `5020 i 5021` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6075` albo `5020 i 5021`** (`Z7`).

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

Dyżur 163 („Uzytkownik traci swoja prace w karcie zadania") zmierzył realny problem
(cztery-pięć sekcji karty zadania giną bez ostrzeżenia), zaprojektował bezpieczny wariant
trwałości i zbudował od migracji po test wzorzec dla jednej sekcji, `risk-alternatives`. Ta
część jest czysta, przemyślana i warta przejęcia: migracja addytywna z `IF NOT EXISTS`,
walidator z górnym limitem elementów, trasa GET/PUT dodana bez dotykania linii 67, kontroler
tenant-scoped, test na realnym PostgreSQL przez realny `ApiGateway` z dowodem mutacyjnym dla
odczytu (PASS → zepsuty kontroler → FAIL → przywrócony → PASS, `git diff` czysty).

Ale w tym samym diffie 163 wprowadził aktywną regresję we froncie i **dyżur został zatrzymany
przy odbiorze z tego właśnie powodu** — nie z powodu samej bramy 409 (ta jest oczekiwana i
nietykalna), tylko z powodu tego, jak `TaskDetailView.tsx` na ten stały 409 reaguje:

**Regresja 1 — fałszywy błąd po realnie udanym zapisie.** W `handleSave`, gałąź `if (taskId)`:
`Api.updatePersonalTask(...)` zapisuje tytuł, opis, status, priorytet, checklistę i resztę pól
zadania na serwerze — i **kończy się sukcesem**. Zaraz po tym 163 dodał bezwarunkowy
`fetch(PUT /api/tasks/:id/risk-alternatives, ...)`. Ta trasa leży za
`router.use(requireCanonicalExecutionWriter)` (`tasks.routes.ts:67`) i PUT nie jest w
`READ_ONLY_METHODS` (`GET`/`HEAD`/`OPTIONS`) ani w jedynym wyjątku (`DELETE
/budget/entries/:id`) — więc **zawsze** dostaje `409`. `if (!response.ok) throw new
Error(...)` przerywa `try` przed wspólnym blokiem „Update dirty baseline", który stoi po całym
`if (taskId) {...} else {...}` i woła `setLastSavedSnapshot`/`setLastSavedAt`. Wykonanie ląduje
w `catch`, gdzie generyczny `toast.error(t('myWork.taskDetail.toastError3', 'Failed to save
task'))` mówi użytkownikowi, że zapis się nie udał — mimo że się udał.

**Regresja 2 — nieskończona pętla autozapisu co 900 ms.** Ponieważ `setLastSavedSnapshot`
nigdy się nie wykonuje w tej ścieżce, `lastSavedSnapshot` zamraża się na wartości sprzed
edycji. `isDirty` (`TaskDetailView.tsx`, ok. `:4798`, `taskId ? lastSavedSnapshot.length>0 &&
draftSnapshot!==lastSavedSnapshot : ...`) zostaje trwale `true`. Efekt `autosaveTimerRef`
(ok. `:4805-4821`) uzbraja nowy `setTimeout(...900)` przy każdym renderze, w którym
`isDirty && !saving`, i woła `handleSave(true)` — które trafia w ten sam mur 409, w
nieskończoność, co ~900 ms, dopóki karta jest otwarta.

Sam raport 163 (w porzuconym worktree `/private/tmp/cx-day163-utrata-pracy-karty`, sekcja 9
„Do odbioru") kończy się zdaniem: *„Najważniejszy wynik nie jest zielony: obecna globalna
brama sprawia, że dodanie nowej mutującej trasy pod `/api/tasks` nie może naprawić utraty.
Nadzorca musi zdecydować, czy sekcja ma dostać kanoniczny writer Runtime-v1, czy wąski wyjątek
w bramie. Ten dyżur nie ma licencji na żadną z tych decyzji."* — 163 poprawnie zidentyfikował,
że decyzja o UX należy do nadzorcy, ale zostawił kod w stanie, który **aktywnie kłamie**
użytkownikowi zamiast po prostu nic nie robić. Ten dyżur (175) podejmuje właśnie tę decyzję UX
— w granicach „nie zdejmuj bramy" i „nie zmieniaj wyglądu" — i naprawia obie regresje.

**Ważne: galąź `codex/day163-utrata-pracy-karty-20260830` nigdy nie została scalona.** Marker
tego dyżuru (`d3d36cd5f5`) leży na głównej linii (`codex/m03-admin-20260824`) i **nie zawiera
żadnego fragmentu pracy 163** — zero trasy, zero kolumny, zero walidatora. Nie dziedziczysz
niczego automatycznie: pracujesz na świeżym worktree z markera i świadomie przenosisz dobre
fragmenty (ręcznie albo cherry-pickiem z porzuconej gałęzi — uzasadnij wybór w raporcie),
budując od razu naprawioną wersję frontu, nie kopiując regresji.

## Czym ten dyżur NIE jest

Nie jest zdjęciem ani zawężeniem bramy `requireCanonicalExecutionWriter` — to terytorium
dyżuru 160 i osobnej decyzji właściciela, nietykalne tutaj i zawsze. Nie jest dodaniem trwałości
dla pozostałych sekcji karty (`implementation`, `evidence`, `governance`/`dependencies`) — R4
oryginalnej instrukcji 163 świadomie ograniczył wzorzec do jednej sekcji i to ograniczenie
zostaje. Nie jest zmianą wyglądu karty — sekcja `risk-alternatives` zostaje w
`TASK_AI_CONTRACT_NONE` dokładnie jak dziś (bez `persistenceNotice`/banera), naprawiasz
komunikat toast/log, nie budujesz nowego komponentu UI. Nie jest scaleniem, usunięciem ani
jakąkolwiek zmianą w porzuconym worktree/gałęzi 163 — to dowód w sprawie, zostaje nietknięty.
Nie jest operacją na bazie demo, stagingu ani produkcji.

# 2. TEZY ZLECENIA

- **T1.** Trasa `PUT /api/tasks/:id/risk-alternatives` zwraca dziś `409` bezwarunkowo i będzie
  to robić zawsze, dopóki brama `requireCanonicalExecutionWriter` istnieje w obecnym kształcie
  — to nie jest błąd przejściowy do „naprawienia" osobnym patchem, to stan docelowy, z którym
  front musi żyć.
- **T2.** Sukces zapisu pól bazowych zadania (`Api.updatePersonalTask`) jest niezależny od
  wyniku wywołania `risk-alternatives` i **musi** zawsze prowadzić do aktualizacji baseline
  (`setLastSavedSnapshot`/`setLastSavedAt`), komunikatu sukcesu i `onSaved?.(...)` —
  niezależnie od tego, co zrobi druga, wiedzące-że-zablokowana podtrasa.
- **T3.** „Uczciwy komunikat" nie znaczy „żaden komunikat" ani „ten sam komunikat co przy
  realnej porażce". Trwały `409` z `risk-alternatives` ma być zaraportowany w sposób
  odróżnialny od (a) pełnego sukcesu i (b) pełnej porażki zapisu — i nie może się powtarzać
  jako widoczny dla użytkownika toast przy każdym cichym cyklu autozapisu (`silent=true`).
- **T4.** Istniejący `catch` w `handleSave` już ma wzorzec rozpoznawania `409` po kształcie
  (`apiError?.status === 409 && apiError.data?.code === '...'`) dla konfliktu wersji zadania —
  ale ten kształt pochodzi wyłącznie z błędów przechodzących przez wspólny klient
  `handleResponse` (`src/services/api.ts`), który dokłada `.status`/`.data` do `Error`. Surowy
  `fetch()` + ręczny `throw new Error(string)` (jak w 163) NIGDY nie przejdzie tego warunku —
  to jest inny kształt błędu i wymaga świadomej decyzji, nie kolejnego doklejonego `else if`.

# 3. POZYCJE DYŻURU

## R1 — odtworzenie zweryfikowanej dobrej części 163 na świeżym markerze

Na podstawie porzuconej gałęzi `codex/day163-utrata-pracy-karty-20260830` (worktree
`/private/tmp/cx-day163-utrata-pracy-karty`, commit `5f189ae768`), TYLKO ODCZYT, przenieś do
swojego świeżego worktree:

1. **Migracja** — nowy plik `server/migrations/20260830_day175_task_risk_alternatives.sql`
   (nazwa musi być inna niż `20260830_day163_task_sections.sql` z porzuconej gałęzi — ten plik
   nigdy nie wszedł na główną linię, więc nie ma kolizji, ale nazywasz go pod numerem TEGO
   dyżuru). Treść: `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS risks JSONB;` i identycznie dla
   `alternatives`. Addytywna, pełny przebieg od pustej bazy, zgodna z kolejnością
   `sortMigrationsDeterministically` (`server/scripts/migrationOrdering.ts`).
2. **Walidator** — `server/src/validators/task.validators.ts`, `CreateTaskSchema`: dwa
   opcjonalne pola `risks`/`alternatives`, `z.array(z.record(z.string(), z.unknown())).max(100)`
   (limit elementów jak w 163). `UpdateTaskSchema` je dziedziczy automatycznie
   (`CreateTaskSchema.partial().omit(...)`).
3. **Trasa** — `server/src/routes/pmo/tasks.routes.ts`: `GET`/`PUT` `/:id/risk-alternatives`,
   wstawione przy istniejącym wzorcu sąsiednich tras (`:id/blocking-decision`,
   `:id/dependencies`), z `requireAudit` i `validateBody(UpdateTaskSchema)` na PUT, DOKŁADNIE
   jak w 163. **Zero zmian w linii 67 i w jakiejkolwiek istniejącej trasie tego pliku.**
4. **Kontroler** — `server/src/controllers/TaskController.ts`: `getTaskRiskAlternatives` i
   `updateTaskRiskAlternatives`, tenant-scoped (`WHERE id = ? AND organization_id = ?`), obok
   wzorca stylu `getTaskDependencies`/`addTaskDependency` (ok. `:3035`).
5. **Odczyt we froncie** — `TaskDetailView.tsx`, `loadTask`: `GET /:id/risk-alternatives` po
   wczytaniu reszty pól, `setRisks`/`setAlternatives` z odpowiedzi.
6. **Test odczytu z dowodem mutacyjnym** —
   `server/src/routes/__tests__/day175.task-risk-alternatives-persistence.pg.test.ts` (port
   testu 163, zmień identyfikatory `Day 163` → `Day 175`, zostaw obie asercje: GET odczytuje
   przez realny `ApiGateway` i świeże zapytanie SQL; PUT dostaje `409` i baza nie zmienia się —
   to jest uczciwy dowód, że regresja backendu nie istnieje, tylko front źle reaguje na
   poprawny `409`).

Przy każdym pliku sprawdź NUMERY LINII w swoim checkoucie — marker `d3d36cd5f5` jest różny od
`23bc57aaf3`, na którym 163 pracował; kontekst (dependencies, blocking-decision) jest bardzo
podobny, ale nie zakładaj identycznych numerów linii bez sprawdzenia.

**Ukończone, gdy:** migracja przechodzi od pustej bazy (dwa przebiegi, drugi bez zmian), test
`day175.task-risk-alternatives-persistence.pg.test.ts` ma PASS dla obu przypadków (odczyt +
uczciwy 409 na zapisie) z dowodem mutacyjnym dla odczytu (log PASS→FAIL→PASS, `git diff`
czysty po przywróceniu), a w raporcie jest jedno zdanie uzasadniające, które fragmenty 163
przeniosłeś bez zmian, a które (jeśli jakiekolwiek) zmieniłeś i dlaczego.

## R2 — naprawa regresji zapisu (rdzeń tego dyżuru)

Zmień `handleSave` w `TaskDetailView.tsx` tak, aby:

1. **Sukces `Api.updatePersonalTask` nigdy nie jest cofany przez wynik wywołania
   `risk-alternatives`.** Baseline (`setLastSavedSnapshot`/`setLastSavedAt`), toast sukcesu i
   `onSaved?.(...)` wykonują się zawsze, gdy `Api.updatePersonalTask` się powiodło —
   niezależnie od tego, czy zapis `risks`/`alternatives` przeszedł, dostał `409`, czy padł z
   innego powodu (sieć, timeout). Nie oznacza to „ignoruj błąd risk-alternatives w ciszy" —
   patrz punkt 2.
2. **Wynik wywołania `risk-alternatives` jest raportowany uczciwie, ale nie jako pełna porażka
   zapisu.** Zdecyduj i uzasadnij w raporcie formę: osobny, rozpoznawalny komunikat (np.
   dedykowany `console.warn`/`toast` różny od `toastError3`) informujący, że ta konkretna
   sekcja nie trafiła na serwer z powodu bramy — bez sugerowania, że cała karta się nie
   zapisała. Rozważ wykorzystanie `Api.put('/tasks/:id/risk-alternatives', {...})` zamiast
   surowego `fetch()` — `Api.put` (`src/services/api.ts`, ok. `:12138`) używa tego samego
   `handleResponse`, który już dokłada `.status`/`.data` do rzucanego `Error` w rozpoznawalnym
   kształcie, spójnym z istniejącym warunkiem `apiError?.status === 409` w tym samym `catch`.
   Jeśli zostajesz przy surowym `fetch()`, uzasadnij dlaczego i zadbaj, żeby błąd miał ten sam
   rozpoznawalny kształt (`.status`, `.data.code`) zamiast gołego `new Error(string)`.
3. **Cichy autozapis (`handleSave(true)`, wołany przez `autosaveTimerRef`) nie produkuje
   widocznego dla użytkownika toastu za każdym powtórzeniem.** Skoro `risk-alternatives` będzie
   dostawać `409` przy KAŻDYM autozapisie, dopóki brama istnieje, komunikat o tym nie może się
   powtarzać w nieskończoność jako toast — sprawdź, czy istniejący parametr `silent` już to
   pokrywa dla głównego zapisu, i zastosuj tę samą zasadę do komunikatu risk-alternatives.
4. **Pętla 900 ms faktycznie się kończy.** Po udanym zapisie pól bazowych `isDirty` musi wrócić
   do `false` (bo `lastSavedSnapshot` zostało zaktualizowane), więc `autosaveTimerRef` przestaje
   się uzbrajać, dopóki użytkownik nie zmieni czegoś na nowo. Zweryfikuj to zegarem (fake
   timers) w teście z R3, nie samym czytaniem kodu.

Nie zmieniasz przy okazji zachowania konfliktu wersji (`TASK_VERSION_CONFLICT`) ani żadnej innej
gałęzi tego samego `catch`, która dziś działa poprawnie.

Poza zakresem regresji, ale zweryfikuj i opisz decyzję (bez obowiązku naprawy, chyba że jest
trywialna i bezpieczna w ramach tej samej licencji):

- `persistedDraft`/`draftSnapshot` (ok. `:4755-4787`) nie zawiera `risks`/`alternatives` — edycja
  wyłącznie tych dwóch pól, bez dotknięcia żadnego z ok. 13 pól bazowych, dziś nie oznacza karty
  jako dirty i nie odpala autozapisu samodzielnie. To osobna, wcześniej istniejąca luka, nie ten
  sam defekt co regresje 1/2.
- `GET` w `loadTask` (krok 5 z R1) ma ten sam wzorzec `throw new Error(...)` przy `!response.ok`
  jak PUT — GET przechodzi przez bramę bez przeszkód (jest w `READ_ONLY_METHODS`), więc dziś nie
  jest to znana regresja, ale porcjonujesz ten sam styl kodu z 163. Zdecyduj świadomie, czy
  pojedynczy nieudany GET tej jednej sekcji powinien wywalać ładowanie CAŁEJ karty (23 inne
  pola), czy tylko tej sekcji — zapisz decyzję i uzasadnienie w raporcie.

**Ukończone, gdy:** ręczna/zautomatyzowana próba zapisu istniejącego zadania kończy się (a)
komunikatem sukcesu odpowiadającym prawdzie (pola bazowe zapisane), (b) osobnym, uczciwym
sygnałem o `risk-alternatives`, nie mylonym z pełną porażką, (c) `isDirty` wraca do `false` po
udanym zapisie pól bazowych, (d) żaden kolejny autosave nie odpala się bez nowej zmiany
użytkownika.

## R3 — dowody mutacyjne w obie strony i test regresyjny frontu

**Dowód dla R1 (odczyt)** — patrz „Ukończone, gdy" w R1.

**Dowód dla R2 (naprawa regresji) — test w obie strony, zgodnie z `Z32` programu:**

Dodaj test w `src/components/MyWork/__tests__/` (konwencja katalogu już istnieje w tym repo,
np. `TaskGeneratedSectionHandoff.ownerBehavior.test.tsx`), np.
`TaskDetailView.riskAlternativesSave.ownerBehavior.test.tsx`, który — mockując `fetch`/moduł
`Api` i używając fake timers (`vi.useFakeTimers()`) — dowodzi WSZYSTKICH poniższych zachowań
jednocześnie, na tym samym scenariuszu (edytuj istniejące zadanie → Zapisz):

1. `Api.updatePersonalTask` odpowiada sukcesem, `risk-alternatives` odpowiada `409` — użytkownik
   NIE widzi `toast.error('Failed to save task')` (albo jego tłumaczonego odpowiednika
   `toastError3`).
2. Baseline aktualizuje się mimo `409` z `risk-alternatives` — po zapisie ponowne przewinięcie
   zegara o 900 ms (`vi.advanceTimersByTime(900)`) BEZ żadnej nowej zmiany pola NIE wywołuje
   drugiego `Api.updatePersonalTask`/`fetch` (czyli pętla faktycznie się zatrzymała — licz
   wywołania mocków, nie zgaduj).
3. Sygnał o `risk-alternatives` (jakikolwiek wybrany kształt z R2 pkt 2) faktycznie się pojawia
   — test dowodzi, że nie został po cichu połknięty.

**Dowód mutacyjny:** zepsuj celowo naprawę (np. przywróć bezwarunkowy `throw` przed baseline),
pokaż że punkt 2 powyżej PADA (drugie wywołanie `Api.updatePersonalTask` faktycznie następuje),
przywróć kod (kopia przez `cp` poza repo, `Z27`, nigdy `git stash`), pokaż ponowny PASS i czyste
`git diff`. Log PASS→FAIL→PASS w raporcie, dosłownie, z pełnymi nazwami testów (`Z37`).

**Ukończone, gdy:** test istnieje, przechodzi w obu kierunkach z dowodem mutacyjnym, i pokrywa
literalnie brzmienie bramek (a) i (b) z tego zlecenia: (a) zapis udany → zero błędnego toasta,
snapshot zaktualizowany, autozapis NIE ponawia się bez zmian; (b) trasa zabramkowana →
komunikat uczciwy, bez pętli.

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżka |
|---|---|
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY175_KARTA_BEZ_REGRESJI_REPORT.md` |
| Zapis | `src/components/MyWork/TaskDetailView.tsx` — TYLKO `loadTask` (odczyt GET risk-alternatives) i `handleSave` (zapis PUT risk-alternatives, baseline `lastSavedSnapshot`/`lastSavedAt`, komunikaty); **zakaz innych zmian w tym pliku** |
| Zapis | `server/src/validators/task.validators.ts` — TYLKO dopisanie pól `risks`/`alternatives` do `CreateTaskSchema` |
| Zapis | `server/src/routes/pmo/tasks.routes.ts` — WYŁĄCZNIE dodanie tras `GET`/`PUT` `/:id/risk-alternatives`; **zakaz zmian w linii 67 i w jakiejkolwiek istniejącej trasie** |
| Zapis | `server/src/controllers/TaskController.ts` — dwie nowe metody, `getTaskRiskAlternatives`/`updateTaskRiskAlternatives` |
| Zapis | migracja WYŁĄCZNIE `server/migrations/20260830_day175_task_risk_alternatives.sql` |
| Zapis | test `server/src/routes/__tests__/day175.task-risk-alternatives-persistence.pg.test.ts` |
| Zapis | test `src/components/MyWork/__tests__/TaskDetailView.riskAlternativesSave.ownerBehavior.test.tsx` (albo analogiczna nazwa wg konwencji katalogu — uzasadnij wybór) |
| Odczyt | worktree `/private/tmp/cx-day163-utrata-pracy-karty` i gałąź `codex/day163-utrata-pracy-karty-20260830` — WYŁĄCZNIE odczyt (`git show`/`git diff`/`git log`), zero zapisu, zero `git worktree remove` |
| Odczyt | `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` — wzorzec bramy, nietykalny |
| Odczyt | `src/services/api.ts` — wzorzec `handleResponse`/`Api.put` do ewentualnego użycia |
| Odczyt | `server/scripts/migrationOrdering.ts`, `server/scripts/migrate.postgres.ts` |
| Odczyt | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_163_UTRATA_PRACY_KARTY.md` — pierwotne zlecenie, dla kontekstu |
| Odczyt | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_173_DOMKNIECIA.md` — do sprawdzenia rozłączności |

★ **ROZŁĄCZNOŚĆ Z 173 (wydany, może biec równolegle):** 173 dotyka `DecisionDetailView.tsx`
(tylko blok odczytu klucza pamięci przeglądarki, ok. `:2420-2428`), `InitiativeTasksTab.tsx`,
`UserTaskList.tsx`, `InitiativeSidePanel.tsx` (`Portfolio/`), `InitiativeCalendar.tsx`
(`Initiatives/calendar/`). ZERO tych ścieżek pokrywa się z Twoją licencją
(`TaskDetailView.tsx`, `tasks.routes.ts`, `TaskController.ts`, `task.validators.ts`, nowa
migracja) — zweryfikuj to sam czytając instrukcję 173 w całości, nie tylko ten akapit, i wpisz
wynik do raportu.

★ **ROZŁĄCZNOŚĆ Z 160/161/162/163(porzucony)/170/171/172:** 160 czyta `tasks.routes.ts`, nie
pisze — Twoja nowa trasa nie koliduje, bo dodajesz, nie zmieniasz istniejące. 161 dotyczy
wyłącznie migracji istniejących na jego markerze — Twój nowy plik migracji go nie dotyczy. 162
(`aiActionExecutor.ts`, `ai/actionExecutors/taskExecutor.ts`, `my-work.routes.ts`) — nie
dotykasz żadnego z tych plików. 163 (porzucony, patrz wyżej) — tylko odczyt. 170
(`okr.routes.ts`, `OkrCheckInRecordDialog.tsx`), 171 (`kpiScorecards/**`, `Economics/**`), 172
(`InitiativeDocumentView.tsx`, `ExceleView.tsx`) — zero dotknięć.

★ **174 — sprawdź sam na starcie.** W tym repo, na dzień pisania tej instrukcji, nie istnieje
ani gałąź, ani plik instrukcji dla dyżuru 174, mimo że jego porty (`6074`/`5018-5019`) są
zarezerwowane w `LISTA_PORTOW_ZAJETYCH`. Jeśli w trakcie Twojej pracy 174 się pojawi (nowa
gałąź, nowy plik `INSTRUKCJA_DYZUR_174_*.md`), przeczytaj jego tabelę licencji PRZED
jakimkolwiek scaleniem czy pushem i wpisz wynik tego sprawdzenia do raportu — pozytywny czy
negatywny.

# 5. TWARDE ZASADY

- ★★ **NIE ZDEJMUJESZ I NIE ZAWĘŻASZ BRAMY 409** (`requireCanonicalExecutionWriter`,
  `tasks.routes.ts:67`). To jest stan docelowy tej trasy, nie usterka. Naprawiasz WYŁĄCZNIE
  reakcję frontu na ten stały, oczekiwany kod odpowiedzi.
- **Nie zmieniasz wyglądu.** Sekcja `risk-alternatives` zostaje w `TASK_AI_CONTRACT_NONE`
  (wzorzec A, bez `persistenceNotice`/banera) dokładnie jak dziś. Naprawiasz komunikat
  toast/log, nie dodajesz nowego komponentu wizualnego ani banera w karcie.
- **Stary worktree i gałąź 163 zostają nietknięte** — to dowód w sprawie STOP-u przy odbiorze.
  Zero zapisu, zero usunięcia, zero `git worktree remove` na
  `/private/tmp/cx-day163-utrata-pracy-karty`.
- **Nie zmieniasz treści istniejących, działających komunikatów** w `handleSave` (np. gałęzi
  `TASK_VERSION_CONFLICT`) — dodajesz nową, odróżnialną obsługę wyłącznie dla wyniku
  `risk-alternatives`.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wszystko lokalnie, na
  jednorazowym kontenerze tego dyżuru.
- Pułapka: `No test files found` NIE jest `PASS`. Sprawdź `numTotalTests` > 0 w każdym wyniku
  przywoływanym jako dowód.
- Porównania testów po pełnych nazwach (`fullName`), nigdy po samych liczbach (`Z37`).
- Testy o kształcie „atak/blokada odrzucona + readback bez zmian" biegną z `--retry=0` — dotyczy
  wprost testu PUT-409-bez-zmian w R1/R3.
- ★ Wymóg sekcji „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie końcowym — wypisz wprost, czego nie
  zdążyłeś zweryfikować (np. zachowanie w realnej przeglądarce vs. tylko w teście
  zmockowanym, jeśli zabraknie czasu na zrzuty).
