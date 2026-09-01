# INSTRUKCJA DYŻURU nr 262 — Codex — „★★ SPOTKANIA — TRZECIA BRAMKA PILOTA POMINIĘTA PRZEZ `FIX-181`: moduł ma status `open` (`src/utils/betaMenuStatus.ts:57`), trasa `/meetings` jest na liście `PILOT_ALLOWED_ROUTE_PREFIXES` (`src/utils/pilotAccess.ts:22-34`, dodane `FIX-181` 30.08), ale `MODULE_MEETING` NIE jest na liście `PILOT_VISIBLE_MENU_IDS` (`src/utils/pilotAccess.ts:6-12`) — `decoratePilotItem` (`src/components/navigation/Sidebar/Sidebar.tsx:124-149`) dekoruje więc pozycję menu `isLocked: true`. Zmierzony bezpośrednio skutek (dyżur 237): **menu odmawia kłódką, wpisanie adresu `/meetings` wprost przechodzi.** ★ Zrzut mający dowodzić dostępu zwykłego użytkownika jest bitowo identyczny ze zrzutem zwykłej listy — obie ścieżki renderują ten sam ekran przy podstawionym zapleczu, więc dowodzi WYŁĄCZNIE, że front nie blokuje; o uprawnieniach serwera (`/api/meeting/*`) nie mówi nic — to jest OSOBNY, dotąd niezmierzony wymiar, który ten dyżur domyka. Test regresyjny stanu dzisiejszego (zablokowanego) już istnieje i przechodzi (`Sidebar.pilotMeetingLock.test.tsx`, commit `e63468df76`) — ten dyżur go NIE zmienia, prezentuje dwa warianty rozstrzygnięcia (dodać `MODULE_MEETING` do widocznych / zostawić) z kosztem, zero decyzji podjętej za właściciela."

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
> **wyłącznie** `/private/tmp/cx-day262-spotkania-bramka3`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `df7f13056f`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-01.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **Spotkania (`docs/modules/08_meetings/`) — WYŁĄCZNIE trzecia bramka pilota (widoczność w menu) i pomiar różnicowania backendu `/api/meeting/*` per rola pilota. Nie dotyczy backendowego splitu G09 (notatki/decyzje) ani pozostałych gate'ów `G00-G20` karty modułu.**.
Trasy front: ``src/utils/pilotAccess.ts` · `src/utils/betaMenuStatus.ts` · `src/components/navigation/Sidebar/Sidebar.tsx` · `src/components/RouterSync.tsx` (wszystkie TYLKO ODCZYT, `Z12` — bramki platformowe)`. Trasy tył: ``server/src/sharedRuntime/utils/betaMenuStatus.ts` (TYLKO ODCZYT) · `server/src/routes/meeting.routes.ts` (TYLKO ODCZYT — pomiar `R2b`, czy backend różnicuje per pilot)`.

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
WT=/private/tmp/cx-day262-spotkania-bramka3
MARKER=df7f13056f

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day262-spotkania-bramka3-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day262-spotkania-bramka3/config.worktree"
cat "$VAULT/worktrees/cx-day262-spotkania-bramka3/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day262-spotkania-bramka3-scratch
mkdir -p /private/tmp/cx-day262-spotkania-bramka3-artefakty

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
git -C "$VAULT" log --oneline df7f13056f..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only df7f13056f..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day262-spotkania-bramka3-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only df7f13056f..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `8` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: MODULE_MEETING ma status open w obu kopiach betaMenuStatus.ts
grep -n "MODULE_MEETING" src/utils/betaMenuStatus.ts server/src/sharedRuntime/utils/betaMenuStatus.ts
#   oczekiwane: 'open' w obu plikach

# (2) TEZA: /meetings jest na liscie PILOT_ALLOWED_ROUTE_PREFIXES
sed -n '20,36p' src/utils/pilotAccess.ts
#   oczekiwane: '/meetings' obecne, z komentarzem FIX-181

# (3) TEZA: MODULE_MEETING NIE jest na liscie PILOT_VISIBLE_MENU_IDS
sed -n '1,13p' src/utils/pilotAccess.ts
#   oczekiwane: brak 'MODULE_MEETING' w zbiorze

# (4) TEZA: decoratePilotItem dekoruje isLocked:true, nie usuwa pozycji
sed -n '120,152p' src/components/navigation/Sidebar/Sidebar.tsx
#   oczekiwane: isLocked:true + lockedMessage/lockedCtaHref, subItems zachowane

# (5) TEZA: test stanu zablokowanego istnieje i dzis przechodzi
npx vitest run src/components/navigation/Sidebar/__tests__/Sidebar.pilotMeetingLock.test.tsx --retry=0
#   oczekiwane: PASS

# (6) TEZA: backend meeting.routes.ts nie ma koncepcji "pilot"
grep -rln "PILOT\|isPilotRestrictedRole" server/src/ | grep meeting
#   oczekiwane: pusto (meeting.routes.ts NIE na liscie)

# (7) TEZA: karta modulu 08_MEETINGS nie ma dzis sekcji "Dzien 262"
grep -n "Dzień 262\|Dzien 262" docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md
#   oczekiwane: pusto

# (8) TEZA: miejsce na dysku wystarcza
df -h /
#   oczekiwane: powyzej 5 GB wolnego — ponizej tego STOP calego dyzuru
```

---

### §0.4a — pomiar zasięgu testów (warunek oddania raportu, patrz `Z24`)

Zanim ogłosisz jakikolwiek wynik testów, zmierz zasięg PEŁNYMI NAZWAMI, nie liczbami:

1. PRZED zmianami produktu: uruchom pakiet(y) testów wskazane w licencji z
   `--reporter=json` (albo zapisz listę `describe/it` z wyjścia) i zapisz do
   artefaktów plik `przed-nazwy.txt` — po jednej PEŁNEJ nazwie testu na wiersz.
2. PO zmianach: to samo do `po-nazwy.txt`.
3. Do raportu wchodzi: `diff przed-nazwy.txt po-nazwy.txt` — nazwy DODANE (twoje
   nowe testy) i nazwy ZNIKNIĘTE (każda zniknięta = wyjaśnienie albo STOP).
   `N passed` bez nazw NIE jest pomiarem. „Ta sama liczba" przy innym składzie
   nazw to fałszywa zieleń (Z37).
4. Przepisanie liczby z instrukcji, cudzego raportu albo rejestru = zawyżenie
   i podstawa odrzucenia raportu. Liczysz sam, u siebie, na swojej bazie.

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day262-spotkania-bramka3-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6264`. Twój JEDYNY port harnessu to `5244 i 5245`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day262-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6259, 5010-5239, 6404-6411, 6600-6830. Twoje własne: baza 6264, harness 5244 i 5245. Cudze — siostrzane dyżury TEJ SAMEJ paczki DOMKNIĘĆ MODUŁOWYCH, nie dotykasz: baza 6260 i harness 5240 i 5241 (dyżur 260 Czat) · baza 6262 i harness 5242 i 5243 (dyżur 261 Moja Praca) · baza 6266 i harness 5246 i 5247 (dyżur 263 Partner) · baza 6268 i harness 5248 i 5249 (dyżur 264 Wyniki). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi i ŻADNEJ zmiany wartości domyślnej istniejącej flagi. `Z10` obowiązuje bez wyjątku.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `src/components/navigation/Sidebar/Sidebar.tsx` · `src/utils/betaMenuStatus.ts` · `server/src/middleware/auth.middleware.ts` · `server/src/middleware/admin.middleware.ts` · `server/src/middleware/rbac.middleware.ts` · `server/src/middleware/effectiveCapability.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY262_SPOTKANIA_REPORT.md`. Jedyny inny dokument, który wolno Ci dotknąć: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE nowa sekcja „## Dzień 262 — trzecia bramka pilota: dwa warianty + pomiar wymiaru serwerowego" na końcu pliku z `R2a`/`R2b`. Zakaz kasowania, nadpisywania lub przepisywania istniejącej treści, w tym zakaz zmiany gate `TECHNICAL_BROWSER_PASS / OWNER_REVIEW_PENDING`.. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day262-spotkania-bramka3-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day262-spotkania-bramka3-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ZAKAZ dodawania `MODULE_MEETING` do `PILOT_VISIBLE_MENU_IDS` — to decyzja produktowa właściciela, prezentowana jako wariant A z kosztem, nie wykonywana. ZAKAZ zmiany `Sidebar.pilotMeetingLock.test.tsx` (`Z38`). ZAKAZ zmiany `RouterSync.tsx` — przekierowanie Ustawień jest osobnym modułem tej samej paczki, poza zakresem. ZAKAZ mylenia front-endowego gejtu pilota z bezpieczeństwem serwera w raporcie — `R2b` jest obowiązkowy właśnie po to, żeby to rozróżnienie było jawne. | Naprawa `FIX-181` z 30.08 otworzyła dwie z trzech bramek tej samej funkcji (status modułu + trasa), trzecią (widoczność w menu) pominęła — pozostawiając jawnie niespójny affordance, dziś nienazwany kosztem ani zdecydowany. Dodatkowo dyżur 237 sam nazwał ograniczenie swojego dowodu (front-end only) jako nierozstrzygnięty wymiar — żaden kolejny dyżur go nie domknął. Właściciel ma dziś mało tokenów i chce przepchnąć ~40 dyżurów jednym ruchem — potrzebuje gotowego kosztu obu wariantów i domkniętego pomiaru wymiaru serwerowego, nie kolejnego «menu jest niespójne» bez konkluzji. |

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
cd /private/tmp/cx-day262-spotkania-bramka3

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day262-pg psql -U postgres -d cx262 \
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
cd /private/tmp/cx-day262-spotkania-bramka3

docker run -d --name cx-day262-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx262 \
  -p 127.0.0.1:6264:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day262-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6264/cx262 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6264/cx262 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day262-spotkania-bramka3 && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6264/cx262 \
JWT_SECRET=cx262-test-secret-do-not-reuse \
npx vitest run src/components/navigation/Sidebar/__tests__/Sidebar.pilotMeetingLock.test.tsx --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day262-spotkania-bramka3-artefakty/day262-pilot-meeting-lock.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day262-spotkania-bramka3 && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/components/navigation/Sidebar/__tests__/Sidebar.pilotMeetingLock.test.tsx --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day262-spotkania-bramka3-artefakty/day262-pilot-meeting-lock.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day262-spotkania-bramka3/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day262-pg psql -U postgres -d cx262 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day262-pg`.
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
> **(e) ★★ NIE MYL «FRONT NIE BLOKUJE» Z «BACKEND TEŻ NIE BLOKUJE».** Zrzut z dyżuru 237 dowodzi wyłącznie pierwszego. `server/src/routes/meeting.routes.ts` nie jest na liście plików odwołujących się do koncepcji „pilot" w całym `server/src/` — sprawdź to SAM (`grep -rln "PILOT\|isPilotRestrictedRole" server/src/`), nie zakładaj na podstawie frontu. Druga pułapka: harness/fixture, którego użyjesz do zrzutu, może PODOBNIE jak w dyżurze 237 nie rozróżniać roli na poziomie danych — jeśli robisz zrzut, jawnie nazwij to ograniczenie w podpisie, nie powtarzaj cichego założenia.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day262-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day262-spotkania-bramka3-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (weryfikacja stanu trzech bramek na własnym SHA) · R2a (dwa warianty z kosztem) · R2b (pomiar: czy backend różnicuje `/api/meeting/*` per pilot) · R3 (wpis do karty modułu, wąska licencja) · R4 (raport dyżuru)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6264` albo `5244 i 5245` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6264` albo `5244 i 5245`** (`Z7`).

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

Trzy niezależne mechanizmy dziś decydują „kto co widzi" w module Spotkania —
i **nie są ze sobą spójne**, mimo że rozwiązują ten sam problem
(`docs/functional/POMIAR_2026-09-01_ORGANIZACJA_SPOTKANIA_USTAWIENIA.md`
§0/§2, dyżur 237):

1. **Status modułu** — `MODULE_MEETING: 'open'`
   (`src/utils/betaMenuStatus.ts:57`, mirror
   `server/src/sharedRuntime/utils/betaMenuStatus.ts:58`).
2. **Trasa** — `/meetings` jest na liście dozwolonych prefiksów pilota
   (`src/utils/pilotAccess.ts:22-34`, `PILOT_ALLOWED_ROUTE_PREFIXES`, wpis
   dodany naprawą `FIX-181` 2026-08-30 — komentarz w kodzie cytuje wprost
   znalezisko `MTG-PF-006`).
3. **Pozycja menu** — `PILOT_VISIBLE_MENU_IDS`
   (`src/utils/pilotAccess.ts:6-12`) **NIE zawiera `MODULE_MEETING`** —
   `decoratePilotItem` (`src/components/navigation/Sidebar/Sidebar.tsx:124-149`)
   dekoruje więc pozycję `isLocked: true` z komunikatem i linkiem
   (`getPilotLockedAreaDetail`).

**Naprawa `FIX-181` z 30.08 otworzyła DWIE z trzech bramek tej samej
funkcji (moduł `open` + trasa dozwolona), trzecią (widoczność w menu)
pominęła.** Skutek zmierzony bezpośrednio na realnym `Sidebar` + `RouterSync`
(dyżur 237): **menu odmawia kłódką, a wpisanie adresu `/meetings` wprost
przechodzi.** To jest jawnie niespójny affordance — użytkownik widzi kłódkę,
ale link, gdyby go zgadł albo dostał, zadziała.

Tego samego dnia (1.09) powstał już test regresyjny dla stanu **dzisiejszego
(zablokowanego)**: `src/components/navigation/Sidebar/__tests__/Sidebar.pilotMeetingLock.test.tsx`
(commit `e63468df76`) — dowodzi mutacyjnie, że pilot widzi „Meeting" z
`aria-disabled="true"`, a właściciel/admin widzi je bez tego atrybutu. **Ten
test dowodzi dzisiejszego STANU, nie mówi nic o tym, który stan jest
POPRAWNY** — to jest dokładnie decyzja, której ten dyżur nie podejmuje za
właściciela.

## ★ Ograniczenie dowodu z dyżuru 237 — nazwane, nie naprawione

Zrzut z dyżuru 237 mający dowodzić, że zwykły (pilot) użytkownik wchodzi na
`/meetings`, jest **bitowo identyczny** ze zrzutem zwykłej listy — obie
ścieżki renderują ten sam ekran, bo **zaplecze harnessu jest podstawione i
nie rozróżnia roli na poziomie danych**. Wniosek z tego zrzutu ograniczony
uczciwie: dowodzi **wyłącznie**, że router front-endu nie blokuje wejścia.
**O uprawnieniach po stronie serwera (czy backend też separuje dostęp per
rola na `/api/meeting/*`) nie mówi nic** — to osobny, w dyżurze 237
niezmierzony wymiar. Ten dyżur go domyka jako nowy, samodzielny pomiar w `R2b`.

## Backendowy split G09 — dla porządku, obalona teza (bez zmiany dzisiaj)

Osobna, już rozstrzygnięta sprawa z tego samego pomiaru: teza „rozdzielenie
`meeting_notes`/`meeting_decisions` pokazuje użytkownikowi `0` decyzji" jest
**obalona** — UI ma lokalny read-model (`MeetingObjectPage.tsx:563-572,829-846`),
który dokłada zatwierdzone decyzje z notatek, mimo że
`GET /api/meeting/:id/decision-records` zwraca `200 {"decisions":[]}`. **Ten
dyżur NIE dotyka tego wątku** — poza zakresu, wymieniony wyłącznie dla
kontekstu karty modułu.

## Czego ten dyżur świadomie NIE robi

- **Nie decyduje, czy dodać `MODULE_MEETING` do `PILOT_VISIBLE_MENU_IDS`.**
  To jest decyzja produktowa właściciela (tak nazwana wprost w pomiarze
  1.09) — dyżur mierzy i przedstawia dwa warianty z kosztem.
- **Nie zmienia `Sidebar.pilotMeetingLock.test.tsx`** (`Z38`) — bramka
  zostaje, jej ewentualne przepisanie jest kosztem WARIANTU, opisanym, nie
  wykonanym.
- **Nie naprawia backendowego splitu G09** — poza zakresem, kontekst wyłącznie.
- **Nie zmienia zachowania `RouterSync.tsx:330-344`** (przekierowanie
  Ustawień) — inny moduł, inny dyżur tej samej paczki.

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | `MODULE_MEETING` ma dziś status `open` w obu kopiach `betaMenuStatus.ts` (front i server mirror) | komenda (1) |
| T2 | `/meetings` jest dziś na liście `PILOT_ALLOWED_ROUTE_PREFIXES` | komenda (2) |
| T3 | `MODULE_MEETING` NIE jest dziś na liście `PILOT_VISIBLE_MENU_IDS` | komenda (3) |
| T4 | `decoratePilotItem` dekoruje niedozwolone pozycje `isLocked: true`, nie usuwa ich z menu | komenda (4) |
| T5 | `Sidebar.pilotMeetingLock.test.tsx` istnieje i dziś przechodzi (dowód stanu zablokowanego) | komenda (5) |
| T6 | `server/src/routes/meeting.routes.ts` nie ma dziś ŻADNEGO odwołania do koncepcji „pilot"/roli ograniczonej beta — backend nie różnicuje odpowiedzi `/api/meeting/*` per pilot-status, wyłącznie per organizacja/rola domenowa | komenda (6) |
| T7 | Karta modułu `08_MEETINGS/MODULE_ACCEPTANCE.md` nie ma dziś sekcji „Dzień 262" | komenda (7) |
| T8 | Miejsce na dysku wystarcza | komenda (8) |

---

# 3. POZYCJE DYŻURU

## R1 — WERYFIKACJA STANU NA WŁASNYM SHA (rdzeń, warunek wejścia)

Wykonaj **wszystkie 8 komend** z `§0.1`. Jeżeli T1-T3 są obalone (np. ktoś
między wydaniem instrukcji a Twoim startem dodał `MODULE_MEETING` do
`PILOT_VISIBLE_MENU_IDS`) — trzecia bramka jest już rozstrzygnięta faktem;
zapisz to jako „Korektę wobec instrukcji" z pełnym dowodem i przejdź `R2`
w trybie dokumentowania faktu, nie wyboru.

## R2a — DWA WARIANTY, Z KOSZTEM (rdzeń, dokumentacyjny)

**Wariant A — dodać `MODULE_MEETING` do `PILOT_VISIBLE_MENU_IDS`.** Ujednolica
menu z już otwartą trasą i statusem `open`. Koszt: jedna linia w
`pilotAccess.ts:6-12` + **obowiązkowe przepisanie**
`Sidebar.pilotMeetingLock.test.tsx` (dziś dowodzi stanu zablokowanego —
po zmianie musi dowodzić stanu ODBLOKOWANEGO, zachowując parę „pilot widzi
bez `aria-disabled`" + „owner widzi bez `aria-disabled`", żeby nie stracić
pokrycia regresyjnego samej funkcji dekoracji). Ryzyko: ZERO — to jedyny
wariant przywracający spójność między trzema bramkami z `§1`.

**Wariant B — zostawić jak jest (kłódka w menu, trasa przechodzi wprost).**
Koszt: zero zmian kodu. Ryzyko: **jawnie niespójny affordance** — użytkownik,
który zgadnie/dostanie link `/meetings`, wejdzie mimo widzianej kłódki w menu;
to nie jest „ukryte", ale jest mylące UX. Wymaga jawnej decyzji, żeby nie
było to przypadkowym przeoczeniem tego samego kształtu co `FIX-181`.

**Trzecia opcja, status quo z adnotacją**, jest zawsze dostępna bez kosztu —
nazwij ją jawnie: nic nie zmieniać, ale dopisać do karty modułu, że
niespójność jest ZNANA i ŚWIADOMA, nie przeoczona.

Nie wybieraj między A i B. Zapisz obie w tabeli z kosztem i ryzykiem jak
powyżej, plus rekomendację audytora jawnie oznaczoną jako **NIE decyzja**.

## R2b — POMIAR BRAKUJĄCEGO WYMIARU: CZY BACKEND `/api/meeting/*` RÓŻNICUJE PER PILOT (rdzeń, nowy pomiar)

Dyżur 237 nazwał ten wymiar jako niezmierzony — ten dyżur go mierzy:

1. **Statyczny dowód** (komenda 6 w `§0.1`): `server/src/routes/meeting.routes.ts`
   nie importuje ani nie odwołuje się do `isPilotRestrictedRole`,
   `PILOT_VISIBLE_MENU_IDS`, `PILOT_ALLOWED_ROUTE_PREFIXES` ani żadnej innej
   koncepcji „pilot" — porównaj z listą plików, które TO robią
   (`grep -rln "PILOT\|isPilotRestrictedRole" server/src/`, sprawdź czy
   `meeting.routes.ts` jest na liście).
2. **Interpretacja obowiązkowa, wpisana do raportu dosłownie:** „pilot" jest
   mechanizmem **wyłącznie front-endowym rozdziału etapu rolloutu (co widać w
   menu/routerze), NIE jest bramką bezpieczeństwa na serwerze. Backend
   różnicuje dostęp do `/api/meeting/*` wyłącznie po organizacji i roli
   domenowej (member/admin/owner) — nie po statusie „pilot". **To nie jest
   dziura bezpieczeństwa** (organizacja i autoryzacja domenowa działają
   niezależnie od front-endowego gejtu) — to jest fakt do zapisania, żeby
   nikt później nie założył, że kłódka w menu jest kontrolą dostępu.
3. Jeśli chcesz wzmocnić dowód żywym żądaniem (opcjonalnie, nie wymagane):
   realny `ApiGateway`, dwóch użytkowników tej samej organizacji (jeden z
   rolą, którą `isPilotRestrictedRole` oznacza jako ograniczoną, drugi bez),
   oba `GET /api/meeting` — oczekiwany wynik: **oba `200` z tymi samymi
   danymi organizacji** (bo backend nie ma pojęcia „pilot"). Jeśli to
   zmierzysz, dodaj jako `R2b` dowód żywy; jeśli nie — statyczny dowód z
   punktu 1 wystarcza do wpisu w raporcie.

## R3 — WPIS DO KARTY MODUŁU (wąska licencja, `J`)

Dopisz na końcu `docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md`
**wyłącznie nową sekcję** „## Dzień 262 — trzecia bramka pilota: dwa warianty
+ pomiar wymiaru serwerowego" z tabelą z `R2a` i wnioskiem z `R2b`. Zero zmian
w istniejącej treści pliku (gate `TECHNICAL_BROWSER_PASS / OWNER_REVIEW_PENDING`
zostaje bez zmiany).

## R4 — RAPORT DYŻURU (rdzeń)

Streszczenie, `R1`-`R3` z pełnymi dowodami, sekcja „TWIERDZENIA
NIEZWERYFIKOWANE" (obowiązkowa nawet pusta), sekcja „Korekty wobec
instrukcji" (obowiązkowa nawet pusta). Jeśli robiłeś zrzuty stanu menu
(opcjonalnie, nie wymagane do rdzenia tego dyżuru — rdzeń jest
dokumentacyjny) — para light/dark musi pokazywać TEN SAM STAN
(`scripts/dev/lib/checkScreenshotPairState.mjs`), a podpis pod zrzutem musi
jawnie nazwać ograniczenie z `§1` („dowodzi wyłącznie front-endu"). Dołącz
pełne wyjścia komend, ścieżki artefaktów w `/private/tmp/cx-day262-spotkania-bramka3-artefakty` z `shasum -a 256`.

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Odczyt (ZAKAZ ZAPISU) | `src/utils/pilotAccess.ts` · `src/utils/betaMenuStatus.ts` · `server/src/sharedRuntime/utils/betaMenuStatus.ts` · `src/components/navigation/Sidebar/Sidebar.tsx` · `src/components/RouterSync.tsx` — bramki platformowe, `Z12`, weryfikujesz, nie zmieniasz |
| Odczyt (ZAKAZ ZAPISU) | `src/components/navigation/Sidebar/__tests__/Sidebar.pilotMeetingLock.test.tsx` — bramka `Z38`, odtwarzasz wynik, nie zmieniasz |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/meeting.routes.ts` · `src/components/Meeting/MeetingObjectPage.tsx` — kontekst `R2b`/backendowy split G09, nie zmieniasz |
| Zapis (NOWE, jeśli robisz dowód żywy `R2b` pkt 3) | `server/src/routes/__tests__/day262-meeting-pilot-role-parity.realpg.test.ts` (nowy plik, opcjonalny, `git add -f` jeśli katalog ignorowany) |
| Zapis (WĄSKO, `J`) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md` — wyłącznie nowa sekcja na końcu, zakaz kasowania/przepisywania istniejącej treści |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY262_SPOTKANIA_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` (`Z18`) · `server/src/database/Database.ts` |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **TEN DYŻUR NIE WYBIERA WARIANTU A/B.** Produktem jest tabela dwóch
  wariantów z kosztem i ryzykiem — decyzja zostaje u właściciela.
- ★★ **NIE MYL FRONT-ENDOWEGO GEJTU Z BEZPIECZEŃSTWEM SERWERA.** `R2b` jest
  obowiązkowy właśnie po to, żeby raport nie powtórzył ograniczenia z dyżuru
  237 — jeśli pomijasz `R2b`, zapisz WPROST w „Korektach wobec instrukcji"
  dlaczego, nie milcz i nie licz statycznego grepu za wystarczający bez
  komentarza interpretacyjnego z punktu 2.
- ★ **PARA DOWODOWA, jeśli robisz zrzuty:** pilot-locked + owner-unlocked,
  **oba** w Light i Dark, ten sam stan sprawdzony mechanicznie
  (`checkScreenshotPairState.mjs`), nie okiem.
- ★ **`Z13`/`J`:** logi i pliki wynikowe NIE wchodzą do repo — leżą w
  `/private/tmp/cx-day262-spotkania-bramka3-artefakty`, raport podaje ścieżki i `shasum -a 256`.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.** Brak tej sekcji
  jest podstawą odrzucenia dyżuru.
