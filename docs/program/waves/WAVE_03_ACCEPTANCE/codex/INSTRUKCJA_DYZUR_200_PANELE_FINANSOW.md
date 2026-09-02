# INSTRUKCJA DYŻURU nr 200 — Codex — „Finanse — inwentarz i podpięcie 21 paneli wyceny za nową flagą frontową (default OFF)"

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
> **wyłącznie** `/private/tmp/cx-day200-panele-finansow`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `60581ed6b5`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-08-31.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **10_FINANCE — inwentarz i podpięcie paneli `src/components/Economics/panels/**` (M16 valuation suite); NIE dotykamy kanonicznego łańcucha Statement→Analysis→Baseline→Prediction→Valuation (`G02-G06` w karcie), to OSOBNY, dziś w większości niepodłączony zestaw kalkulatorów**.
Trasy front: ``src/components/Economics/panels/**` (21 plików — PEŁNA licencja wyłącznie na podpięcie pod nową flagę, zakaz zmiany wyglądu wnętrza paneli), `src/components/Economics/FinanceValuePanelsSurface.tsx` (rozszerzenie rejestru `PANELS`), `src/components/Economics/financeFeatureFlags.ts` i nowy plik flagi frontowej (nazwij wg wzorca `financeValuePanelsFlag.ts`), `src/components/Economics/FinanceHub.tsx` (WĄSKA licencja — wyłącznie miejsce montażu nowej/rozszerzonej powierzchni, bez zmiany innych zakładek)`. Trasy tył: `brak — ten dyżur nie zmienia `server/src/routes/v8/finance-valuation.routes.ts` ani mountu w `server/src/routes/v8/index.ts`; `ENABLE_V8_GLOBAL` zostaje dokładnie w obecnym stanie (`false` domyślnie)`.

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
WT=/private/tmp/cx-day200-panele-finansow
MARKER=60581ed6b5

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day200-panele-finansow-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day200-panele-finansow/config.worktree"
cat "$VAULT/worktrees/cx-day200-panele-finansow/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day200-panele-finansow-scratch
mkdir -p /private/tmp/cx-day200-panele-finansow-artefakty

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
git -C "$VAULT" log --oneline 60581ed6b5..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 60581ed6b5..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day200-panele-finansow-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 60581ed6b5..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `siedem` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day200-panele-finansow

# (T1) 19 HANDLERÓW BACKENDU, MIANOWNIK PRZYPIĘTY TESTEM
grep -n "router.post\|router.get" server/src/routes/v8/finance-valuation.routes.ts | wc -l
grep -n "pinned denominator of 19" server/src/routes/v8/__tests__/financeV8MutationInventory.test.ts
#   oczekiwane: 19; test istnieje i przypina tę liczbę.

# (T2) MONT W v8Router, CAŁY v8Router ZA ENABLE_V8_GLOBAL
grep -n "finance-valuation" server/src/routes/v8/index.ts
grep -n "ENABLE_V8_GLOBAL" server/src/middleware/v8FeatureGate.middleware.ts
#   oczekiwane: `v8Router.use('/finance-valuation', financeValuationRoutes)`; gate czyta `ENABLE_V8_GLOBAL`.

# (T3) 21 PLIKÓW PANELI
ls src/components/Economics/panels/*.tsx | grep -v __tests__ | wc -l
#   oczekiwane: 21.

# (T4) 15 PANELI BEZ ŻADNEGO IMPORTERA (przykład — powtórz dla każdej nazwy z listy w DLACZEGO)
grep -rl "BankingValuePanel" src/ --include='*.tsx' --include='*.ts' | grep -v '__tests__' | grep -v 'panels/BankingValuePanel.tsx'
#   oczekiwane: pusto (0 wierszy).

# (T5) 5 PANELI ZA FLAGĄ isFinanceValuePanelsEnabled, DOMYŚLNIE OFF
grep -n "isFinanceValuePanelsEnabled" src/components/Economics/FinanceValuePanelsSurface.tsx
grep -n "?? false" src/utils/financeValuePanelsFlag.ts
#   oczekiwane: `if (!isFinanceValuePanelsEnabled()) return null;`; domyślna `false`.

# (T6) 1 PANEL ZAMONTOWANY BEZWARUNKOWO (Benefits/ValuationWorkspace)
grep -n "EvBasketFootballField" src/components/Benefits/ValuationWorkspace.tsx | head -3
#   oczekiwane: import + użycie w JSX.

# (T7) DRUGI, INNY ValuationWorkspace — NIE MYLIĆ
grep -n "useFinanceValuationWorkspaceFlag\|default ON" src/components/Finance/Valuation/ValuationWorkspace.tsx | head -5
#   oczekiwane: potwierdzenie osobnej flagi domyślnie ON, osobny plik, osobny katalog.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day200-panele-finansow-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6131`. Twój JEDYNY port harnessu to `5072 i 5073`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day200-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6129, 5010-5069, 6404-6411 (odbiory nadzorcy + dyżury 170-196), 6130/5070-5071 (dyżur 198, ta sama partia — NIE używaj), 6132/5074-5075 (dyżur 202, ta sama partia — NIE używaj). ★ PORT 5000 ZAJĘTY NA STAŁE przez macOS Control Center. ★ PORT 5037 zajęty przez adb`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `DOKŁADNIE JEDNA nowa flaga frontowa, nazwij ją sam w konwencji istniejących (`isFinanceValuePanelsEnabled`/`m16ValuationSuite`/`m16AdvancedSuite` — sprawdź `src/components/Economics/financeFeatureFlags.ts` i `src/utils/financeValuePanelsFlag.ts` PRZED wymyśleniem nowej nazwy, możliwe że trzeba tylko ROZSZERZYĆ istniejącą, nie tworzyć kolejną). Domyślna wartość: **OFF**. `ENABLE_V8_GLOBAL` NIE jest tą flagą i pozostaje bez zmian — panel wywołuje trasę `/api/v8/finance-valuation/**` tylko gdy OBIE flagi (frontowa nowa + `ENABLE_V8_GLOBAL`) są włączone`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**`, `server/src/middleware/v8FeatureGate.middleware.ts`, `server/src/middleware/v8Auth.middleware.ts`, `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY200_PANELE_FINANSOW_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — ten dyżur montuje ekrany za flagą domyślnie OFF, więc nie zmienia stanu odbioru widzianego przez właściciela; karta `10_FINANCE` pozostaje bez zmian. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day200-panele-finansow-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day200-panele-finansow-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **ZAKAZ ZMIANY WYGLĄDU PANELI.** Panele mają wyglądać dokładnie tak, jak w dev-render — żadnych nowych kolorów, layoutu, ikon; podpinasz WOŁACZ (import + montaż + przekazanie propsów/danych), nie przerabiasz wnętrze komponentu. **ZAKAZ dotykania `server/src/routes/v8/finance-valuation.routes.ts`, `server/src/routes/v8/index.ts` i `ENABLE_V8_GLOBAL`.** Trasa i globalna flaga zostają dokładnie takie, jakie są — panel ma umieć wywołać trasę TYLKO gdy ktoś świadomie włączy obie flagi (nową frontową + `ENABLE_V8_GLOBAL`), nie ma prawa wywołać jej przy jednej włączonej. **ZAKAZ mylenia trzech `ValuationWorkspace`** — `Benefits/ValuationWorkspace.tsx` i `Finance/Valuation/ValuationWorkspace.tsx` są nietykalne do zapisu w tym dyżurze (odczyt dozwolony jako kontekst); jedyne miejsce montażu nowych paneli to `FinanceValuePanelsSurface.tsx` (rozbudowa rejestru `PANELS`) i/lub nowy, analogiczny plik-rejestr, NIE wstrzykujesz paneli do żadnego z dwóch istniejących `ValuationWorkspace`. **ZAKAZ tworzenia drugiej flagi obok istniejącej `isFinanceValuePanelsEnabled`, jeśli jedna flaga wystarczy** — sprawdź najpierw, czy rozszerzenie istniejącej (o pozostałe 15 paneli) nie jest prostsze i bezpieczniejsze niż nowy przełącznik; jeśli decydujesz się na nową flagę, uzasadnij to w raporcie. **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** | Rekonesans wejściowy twierdzi „19/21 paneli bez wołacza”, trasa `finance-valuation` „19 tras za `ENABLE_V8_GLOBAL=false`” i „`ValuationWorkspace` istnieje, montuje 1 panel”. Zweryfikowane dziś: `server/src/routes/v8/finance-valuation.routes.ts` ma DOKŁADNIE 19 handlerów (przypięty mianownik w `financeV8MutationInventory.test.ts:158`, `'finance-valuation.routes.ts handler count drifted from the pinned denominator of 19'`), zamontowanych w `server/src/routes/v8/index.ts:119` (`v8Router.use('/finance-valuation', financeValuationRoutes)`) — cały `v8Router` jest za `v8OrgGate`/`ENABLE_V8_GLOBAL`, potwierdzone. `src/components/Economics/panels/` ma DOKŁADNIE 21 plików (poza `__tests__`). Pomiar importerów poza własnym plikiem i testami: **15 z 21 paneli mają zero importerów w całym `src/`** (m.in. `BankingValuePanel`, `CashForecastPanel`, `DriverPlannerPanel`, `DriverTreePanel`, `ExtendedRatiosPanel`, `HeadcountPlannerPanel`, `InvestmentAppraisalPanel`, `RollingForecastPanel`, `ValuationVisualsPanel`, `ValueAttributionPanel`, `ValueCapturePipelinePanel`, `ValueLedgerPanel`, `ValueOfficePanel`, `VarianceBridgePanel`, `VarianceNarrationPanel`). **5 paneli SĄ importowane** — `MonteCarloNpvPanel`, `RealOptionsPanel`, `EfficientFrontierPanel`, `WhatIfSensitivityPanel`, `ScenarioComputePanel` — przez `src/components/Economics/FinanceValuePanelsSurface.tsx`, zamontowaną w `FinanceHub.tsx:4065` (`activeTab === 'valuation' && !activeDocumentId`), ale za flagą `isFinanceValuePanelsEnabled()` (`src/utils/financeValuePanelsFlag.ts`, domyślnie `false`) — te 5 ISTNIEJE i JEST WOŁANE w kodzie, ale niewidoczne bez ręcznego przełącznika. **1 panel jest zamontowany bezwarunkowo** — `EvBasketFootballField` w `src/components/Benefits/ValuationWorkspace.tsx:1136` (montowany dalej przez `BenefitsHub.tsx:799` i przez `FinanceHub.tsx:3645` pod starą, osobną nazwą `ValuationWorkspace`). Suma 15+5+1=21 się zgadza; rekonesansowe „19/21 bez wołacza” jest więc BLISKIE, ale nie identyczne z tym pomiarem (15 bez ŻADNEGO wołacza + 5 z wołaczem-za-flagą-OFF = 20 praktycznie niewidocznych; Twój własny pomiar w R1 jest wiążący, nie ta liczba). ★ Backend ma też WŁASNĄ, WĘŻSZĄ warstwę: `src/services/financeValuationApi.ts` (typed client) pokrywa tylko 5 z 19 endpointów (monte-carlo-npv, real-options ×3, sensitivity ×2 — dokładnie te za `m16ValuationSuite`/`m16AdvancedSuite`), reszta 14 endpointów backendu nie ma ŻADNEGO typed clienta — to osobna, mniejsza liczba niż „19 paneli”, R1 musi je rozróżnić. ★★ ISTNIEJE TRZECI, INNY komponent o niemal identycznej nazwie: `src/components/Finance/Valuation/ValuationWorkspace.tsx` — „Enterprise Valuation, Pakiet H, siedmiokrokowy kanoniczny flow”, za WŁASNĄ flagą `useFinanceValuationWorkspaceFlag` (komentarz w pliku: „default ON after AMD-FIN-VALUATION-V3-001”), zamontowany w `FinanceHub.tsx:3635` jako `FinanceV3ValuationWorkspace` — to jest część kanonicznego łańcucha DCF z `MODULE_ACCEPTANCE.md` `G02-G06` (`PASS_TECHNICAL_BROWSER`), NIE ma nic wspólnego z 21 kalkulatorami z `Economics/panels/`. Nie myl trzech rzeczy: (1) `Benefits/ValuationWorkspace.tsx` — stary, EV basket, 1 panel; (2) `Finance/Valuation/ValuationWorkspace.tsx` — DCF workspace kanonicznego łańcucha, flaga ON, poza zakresem tego dyżuru; (3) `Economics/panels/*` — 21 kalkulatorów tego dyżuru. |

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
cd /private/tmp/cx-day200-panele-finansow

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day200-pg psql -U postgres -d consultify_w3_finance_owner_cx200 \
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
cd /private/tmp/cx-day200-panele-finansow

docker run -d --name cx-day200-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=consultify_w3_finance_owner_cx200 \
  -p 127.0.0.1:6131:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day200-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6131/consultify_w3_finance_owner_cx200 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6131/consultify_w3_finance_owner_cx200 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day200-panele-finansow && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6131/consultify_w3_finance_owner_cx200 \
JWT_SECRET=cx200-test-secret-do-not-reuse \
npx vitest run src/components/Economics/panels/__tests__, src/components/Economics/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day200-panele-finansow-artefakty/day200-finance-panels.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day200-panele-finansow && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/components/Economics/panels/__tests__, src/components/Economics/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day200-panele-finansow-artefakty/day200-finance-panels.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day200-panele-finansow/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day200-pg psql -U postgres -d consultify_w3_finance_owner_cx200 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day200-pg`.
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
> **(e) ★★ **Pierwsza — trzy różne "wyceny" pod jednym słowem, patrz `DLACZEGO`.** Zanim napiszesz jedną linię kodu, upewnij się, w które z trzech miejsc patrzysz: `Benefits/ValuationWorkspace.tsx` (EV basket, 1 panel), `Finance/Valuation/ValuationWorkspace.tsx` (kanoniczny DCF, `Pakiet H`, poza zakresem), `Economics/panels/*` (21 kalkulatorów, TWÓJ zakres). Pomyłka pliku w tabeli licencji unieważnia całą pozycję. **Druga — `financeValuationApi.ts` pokrywa TYLKO 5 z 19 endpointów backendu.** Jeśli podpinasz panel, którego endpoint nie ma jeszcze typed clienta (14 z 19: `value-at-risk` ×2, `real-options/defer|abandon|staged` już są ale sprawdź resztę, `sensitivity/one-way|tornado|data-table|break-even`, `capital-decision/*` ×4), MUSISZ albo dopisać wrapper w `financeValuationApi.ts` wzorem istniejących (ten sam plik, ta sama licencja), albo — jeśli panel nie ma jeszcze komponentu gotowego do realnych danych (sprawdź `props` każdego z 21 plików) — podpiąć go z jawnym `TODO`/przełącznikiem "tryb demo" i opisać to w R1/raporcie, nie fabrykować fetchera, który nigdy nie zwróci realnej odpowiedzi. **Trzecia — `FinanceValuePanelsSurface.tsx` renderuje TYLKO JEDEN aktywny panel na raz** (`useState<PanelId>`, zakładki `role="tab"`) — rozszerzając rejestr o kolejne 16 paneli, zachowaj ten sam wzorzec zakładek, nie przechodź na renderowanie wszystkich naraz (to byłaby zmiana UX, nie podpięcie wołacza). **Czwarta — odpowiedź `{ data: <payload>, meta }` trzeba rozpakować DWUKROTNIE** (`Api.post` już opakowuje w `{ data: <body> }`, patrz komentarz w `financeValuationApi.ts:19-22`) — panel, który zapomni o drugim rozpakowaniu, dostanie `{data: {data: ...}}` i wyrenderuje pustkę bez żadnego błędu w konsoli; to jest realna pułapka testu R3 „panel z realnym API”. **Piąta — `v8OrgGate`/`requireV8OrgContext` wymaga kontekstu organizacji ZANIM cokolwiek policzy** — test z realnym API (wymagany w R3 dla 2 paneli) musi przejść przez `ApiGateway` z podpisanym JWT niosącym `organizationId`, montaż gołego routera w `express()` nie dowodzi ścieżki produkcyjnej (`Z22`).**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day200-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day200-panele-finansow-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`pozycja R1 — inwentarz 21 paneli kompletny i zweryfikowany pomiarem (nie przepisany z rekonesansu)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6131` albo `5072 i 5073` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6131` albo `5072 i 5073`** (`Z7`).

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

Rekonesans wejściowy tego dyżuru brzmiał: „ISTNIEJE_NIEAKTYWNE — 19/21 paneli wyceny bez wołacza;
trasa `finance-valuation` ma 19 tras za `ENABLE_V8_GLOBAL=false`; `ValuationWorkspace` istnieje i
montuje 1 panel”. Weryfikacja dzisiejsza (na markerze `60581ed6b5`) potwierdza szkielet tej tezy,
ale z inną, dokładniejszą liczbą — i z jedną istotną pułapką nazewniczą, którą ten dyżur musi
rozstrzygnąć, zanim ruszy dalej.

**Backend.** `server/src/routes/v8/finance-valuation.routes.ts` ma dokładnie **19 handlerów**
(`router.post(...)` × 19) — liczbę tę przypina istniejący test
`financeV8MutationInventory.test.ts:158`: `'finance-valuation.routes.ts handler count drifted from
the pinned denominator of 19'`. Router jest zamontowany w `server/src/routes/v8/index.ts:119`
(`v8Router.use('/finance-valuation', financeValuationRoutes)`), a CAŁY `v8Router` (nie tylko ta
jedna trasa) przechodzi przez `v8OrgGate`/`attachV8Context` z `v8FeatureGate.middleware.ts`, który
czyta `process.env.ENABLE_V8_GLOBAL === 'true'` — domyślnie `false`. To się zgadza z rekonesansem
1:1.

**Frontend.** `src/components/Economics/panels/` ma dokładnie **21 plików** komponentów (poza
`__tests__/`). Pomiar importerów (`grep -rl "<NazwaPanelu>" src/ --include='*.tsx' --include='*.ts'
| grep -v __tests__ | grep -v panels/<NazwaPanelu>.tsx`) daje **trzy grupy**, nie dwie:

- **15 paneli mają ZERO importerów w całym `src/`** — `BankingValuePanel`, `CashForecastPanel`,
  `DriverPlannerPanel`, `DriverTreePanel`, `ExtendedRatiosPanel`, `HeadcountPlannerPanel`,
  `InvestmentAppraisalPanel`, `RollingForecastPanel`, `ValuationVisualsPanel`,
  `ValueAttributionPanel`, `ValueCapturePipelinePanel`, `ValueLedgerPanel`, `ValueOfficePanel`,
  `VarianceBridgePanel`, `VarianceNarrationPanel`. Martwy kod w sensie dosłownym.
- **5 paneli SĄ importowane i montowane** — `MonteCarloNpvPanel`, `RealOptionsPanel`,
  `EfficientFrontierPanel`, `WhatIfSensitivityPanel`, `ScenarioComputePanel` — przez
  `src/components/Economics/FinanceValuePanelsSurface.tsx`, samą zamontowaną w
  `FinanceHub.tsx:4065` pod zakładką „valuation”. Ale `FinanceValuePanelsSurface` zwraca `null`,
  dopóki `isFinanceValuePanelsEnabled()` (`src/utils/financeValuePanelsFlag.ts`) nie zwróci `true`
  — domyślnie zwraca `false` (query > localStorage > env > `false`). Te 5 ISTNIEJE i JEST
  WOŁANE w kodzie, ale realnie niewidoczne bez ręcznego przełącznika.
- **1 panel jest zamontowany bezwarunkowo, bez flagi** — `EvBasketFootballField`, importowany w
  `src/components/Benefits/ValuationWorkspace.tsx:8` i użyty w JSX na linii 1136.

Suma 15+5+1=21 się zgadza. „19/21 bez wołacza” z rekonesansu jest więc bliskie prawdy w sensie
praktycznym (15 bez żadnego wołacza + 5 z wołaczem schowanym za flagą OFF = 20 z 21 realnie
niewidocznych dla użytkownika), ale niedokładne co do MECHANIZMU — to nie jest jednorodna grupa
„19 sierot”, tylko dwie różne przyczyny niewidoczności, które wymagają dwóch różnych działań.

**Trzy różne rzeczy o niemal tej samej nazwie.** To jest pułapka, która kosztowała najwięcej czasu
przy tym rekonesansie i którą ten dyżur musi utrzymać rozdzieloną:

1. `src/components/Benefits/ValuationWorkspace.tsx` — stary komponent, montuje wyłącznie
   `EvBasketFootballField` (EV basket dla Benefits/business case), używany w `BenefitsHub.tsx:799`
   i (pod tą samą nazwą, osobnym lazy-importem) w `FinanceHub.tsx:3645`.
2. `src/components/Finance/Valuation/ValuationWorkspace.tsx` — **INNY** komponent, „Enterprise
   Valuation, Pakiet H”, siedmiokrokowy kanoniczny flow, za WŁASNĄ flagą
   `useFinanceValuationWorkspaceFlag` (komentarz w pliku: „default ON after
   AMD-FIN-VALUATION-V3-001”), zamontowany w `FinanceHub.tsx:3635` jako `FinanceV3ValuationWorkspace`.
   To jest część kanonicznego łańcucha Statement→Analysis→Baseline→Prediction→**Valuation** z
   `MODULE_ACCEPTANCE.md` (`G02`-`G06`, dziś `PASS_TECHNICAL_BROWSER / OWNER_PENDING`) — poza
   zakresem tego dyżuru w całości.
3. `src/components/Economics/panels/*` — 21 kalkulatorów tego dyżuru (Monte Carlo NPV, efficient
   frontier, real options, sensitivity/tornado, scenariusze, capital-decision/hurdle-rate…).

Backendowy klient `src/services/financeValuationApi.ts` (nagłówek pliku) pokrywa jawnie tylko 5 z
19 endpointów backendu — dokładnie te za istniejącymi flagami `m16ValuationSuite`/
`m16AdvancedSuite` wspomnianymi w jego komentarzu — reszta czternastu endpointów backendu (VaR ×2,
real-options `defer`/`abandon`/`staged`, sensitivity `one-way`/`data-table`/`break-even`,
scenarios `apply`/`compare`/`fan`, capital-decision ×4) nie ma dziś ŻADNEGO typed clienta w `src/`.

# 2. TEZY ZLECENIA

- **T1.** 19 handlerów backendu, 21 plików paneli frontendu, 1 mount bezwarunkowy — zmierzone
  fakty, punkt wyjścia. Liczba „19/21 bez wołacza” z rekonesansu jest przybliżeniem dwóch różnych
  zjawisk (0 importerów vs. importer-za-flagą-OFF), nie jednorodną grupą — R1 musi to rozdzielić.
- **T2.** Trzy komponenty o nazwie zawierającej „ValuationWorkspace”/„Valuation” istnieją i są
  wzajemnie niezależne. Tylko `Economics/panels/*` jest w zakresie tego dyżuru.
- **T3.** Podpięcie panelu wymaga DWÓCH rzeczy naraz — komponentu w rejestrze
  `FinanceValuePanelsSurface` (albo analogicznym) ORAZ typed clienta w `financeValuationApi.ts` dla
  jego endpointu. Panele bez typed clienta (14 z 19 tras) wymagają dopisania wrappera, nie tylko
  importu komponentu.

# 3. POZYCJE DYŻURU

## R1 — inwentarz 21 paneli, tabela props ↔ trasa (rdzeń)

Zbuduj w raporcie tabelę, jeden wiersz na panel (21 wierszy), kolumny: nazwa pliku · props
wejściowe komponentu (z sygnatury TS) · który z 19 endpointów `finance-valuation.routes.ts` go
karmi (albo „brak dopasowania — panel liczy lokalnie/nie woła API”, jeśli tak jest) · czy istnieje
typed client w `financeValuationApi.ts` · dzisiejszy stan wołacza (zero importerów / importer za
flagą OFF / zamontowany bezwarunkowo). Zweryfikuj TERAZ, nie przepisuj z `DLACZEGO` powyżej — Twój
pomiar jest wiążący (`Z24`).

**Ukończone, gdy:** tabela ma 21 wierszy, każdy z realnym `grep`/odczytem sygnatury, nie
domniemaniem.

## R2 — podpięcie paneli za nową flagą frontową (default OFF)

Sprawdź najpierw, czy rozszerzenie istniejącej `isFinanceValuePanelsEnabled`
(`src/utils/financeValuePanelsFlag.ts`) o pozostałe 16 paneli jest wystarczające, zanim wymyślisz
nową flagę — jeśli tak, rozszerz `PANELS`/`LABELS` w `FinanceValuePanelsSurface.tsx` tym samym
wzorcem zakładek (`role="tab"`, jeden aktywny naraz), zachowując istniejące 5 bez zmian
zachowania. Jeśli istnieją powody, by tego nie robić (np. inny cykl życia/dane), nazwij nową flagę
w tej samej konwencji, domyślnie `false`, i opisz uzasadnienie w raporcie.

Dla każdego panelu bez typed clienta (z tabeli R1): dopisz wrapper w `financeValuationApi.ts`
wzorem istniejących pięciu (ten sam plik, ta sama konwencja podwójnego rozpakowania
`{ data: { data, meta } }` — patrz komentarz w nagłówku pliku), i podłącz go do panelu. Panel
wywołuje trasę `/api/v8/finance-valuation/**` WYŁĄCZNIE gdy jednocześnie: nowa/rozszerzona flaga
frontowa jest `true` **i** `ENABLE_V8_GLOBAL=true` po stronie serwera — nie zmieniasz domyślnej
wartości żadnej z nich.

Panel, który nie ma dziś gotowego kształtu danych do realnego wywołania (sprawdź props — część z
21 może oczekiwać kształtu, którego żaden endpoint nie zwraca 1:1), podłącz z jawnym, opisanym w
raporcie ograniczeniem — nie fabrykuj fetchera zwracającego fikcyjne dane.

★ **ZAKAZ zmiany wyglądu.** Panele mają wyglądać dokładnie jak w dev-render — podpinasz wołacz, nie
przerabiasz wnętrze.

**Ukończone, gdy:** wszystkie 21 paneli są importowane i osiągalne przez UI za flagą (nawet jeśli
część renderuje stan „brak danych”/ograniczenie — osiągalność ≠ pełna funkcjonalność), i żaden
panel nie woła trasy V8 bez jawnie włączonych obu flag.

## R3 — dowody: dev-render (19 paneli × 2 motywy) i realne API (2 panele reprezentatywne)

Harness dev-render z danymi mock: komplet zrzutów — 21 paneli × 2 motywy (jasny/ciemny) — zapisany
poza repo w `/private/tmp/cx-day200-panele-finansow-artefakty` z `shasum -a 256`. To jest materiał dla kroku (b) reguły 7 (Piotr nigdy
nie jest pierwszym testerem wizualnym) — w raporcie dopisz wpis do KOORDYNACJI toru grafiki z
odnośnikiem do tych zrzutów i nazwą nowej/rozszerzonej flagi.

Test z realnym API dla **2 reprezentatywnych paneli** (jeden z istniejącej piątki, np.
`MonteCarloNpvPanel`, i jeden z nowo podpiętej piętnastki): `ENABLE_V8_GLOBAL=true` w teście,
realny `ApiGateway.getInstance().initializeRoutes(app)` (`Z22` — gołego `express()` nie liczy się),
podpisany JWT z `organizationId`, realne żądanie HTTP przez trasę, zapisany kod odpowiedzi.

**Ukończone, gdy:** 21×2 = 42 zrzuty dev-render z SHA-256 w artefaktach, i 2 zielone testy z realnym
`ApiGateway` dla dwóch różnych endpointów (jeden „stary”, jeden „nowo podpięty”).

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis | `src/components/Economics/panels/**` (21 plików) — WYŁĄCZNIE podpięcie wołacza (props/dane), zakaz zmiany wyglądu wnętrza |
| Zapis | `src/components/Economics/FinanceValuePanelsSurface.tsx` — rozszerzenie rejestru `PANELS`/`LABELS`, ten sam wzorzec zakładek |
| Zapis | `src/utils/financeValuePanelsFlag.ts` LUB nowy plik flagi (jeśli uzasadnione w raporcie) — domyślnie `false` |
| Zapis | `src/services/financeValuationApi.ts` — dopisanie wrapperów dla endpointów bez typed clienta, wzorem istniejących pięciu |
| Zapis (wąska) | `src/components/Economics/FinanceHub.tsx` — WYŁĄCZNIE miejsce montażu rozszerzonej powierzchni pod zakładką „valuation”; zakaz zmiany innych zakładek/logiki pliku |
| Zapis | testy `day200.*` — `src/components/Economics/panels/__tests__/`, `src/components/Economics/__tests__/` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY200_PANELE_FINANSOW_REPORT.md` |
| Odczyt | `server/src/routes/v8/finance-valuation.routes.ts`, `server/src/routes/v8/index.ts`, `server/src/middleware/v8FeatureGate.middleware.ts` — kontrakt tras/bramki; **nie zmieniasz** |
| Odczyt | `src/components/Benefits/ValuationWorkspace.tsx`, `src/components/Finance/Valuation/ValuationWorkspace.tsx` — kontekst rozróżnienia T2; **nie zmieniasz** |
| Odczyt | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/MODULE_ACCEPTANCE.md` — dowód że G02-G06 (kanoniczny łańcuch) to inny zakres; nie zmieniasz |

**Nietykalne imiennie:** `server/src/routes/v8/**`, `ENABLE_V8_GLOBAL` (wartość i mechanizm),
`src/components/Benefits/ValuationWorkspace.tsx`, `src/components/Finance/Valuation/ValuationWorkspace.tsx`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/MODULE_ACCEPTANCE.md` (żaden update w tym
dyżurze — praca jest za flagą OFF, nie zmienia stanu widzianego przez właściciela).

★ **Rozłączność z dyżurami równoległymi 198 (Ocena) i 202 (Spotkania):** żaden plik tego dyżuru
(`src/components/Economics/**`, `src/services/financeValuationApi.ts`) nie pokrywa się z zakresem
Oceny (`src/components/assessment/**`, `server/scripts/seed-wave3-assessment-owner-review.ts`) ani
Spotkań (`src/components/Meeting/**`, klucze `meeting.*` w `public/locales/*/translation.json`).
Port/baza/kontener wyłączne — patrz `Z7`.

# 5. TWARDE ZASADY

- ★ **Zakaz zmiany wyglądu paneli.** Mają wyglądać jak w dev-render — podpięcie wołacza, nie
  redesign.
- **Zakaz dotykania backendu V8 i `ENABLE_V8_GLOBAL`.** Trasa i flaga globalna zostają identyczne.
- **Zakaz mylenia trzech `ValuationWorkspace`/`Valuation`** — tylko `Economics/panels/*` jest w
  zakresie; pozostałe dwa są kontekstem do odczytu.
- **Dokładnie jedna nowa flaga frontowa (albo rozszerzenie istniejącej), domyślnie OFF.** Panel
  woła trasę V8 tylko przy obu flagach włączonych naraz.
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.**
- Pułapka: `No test files found` NIE jest `PASS`.
- ★ Port **5000 zajęty na stałe przez macOS Control Center**; **5037 przez adb**.
- Wymóg sekcji „TWIERDZENIA NIEZWERYFIKOWANE” — wypisz wprost, które panele (jeśli którekolwiek)
  podpięto z ograniczeniem „brak gotowego kształtu danych”, i które z 19 endpointów backendu nadal
  nie mają typed clienta po tym dyżurze.
