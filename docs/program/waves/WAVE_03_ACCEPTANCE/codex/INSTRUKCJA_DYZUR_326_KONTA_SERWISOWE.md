# INSTRUKCJA DYŻURU nr 326 — Codex — „Konta serwisowe — teza „caly modul przestal dzialac" OBALONA (dla organizacji z identyfikatorem UUID czyta i zapisuje), ale dyzur 321 przeniosl bramke identyfikatora WYLACZNIE do `GET`, wiec zapisy dla organizacji o identyfikatorze spoza UUID zmienily sie z jawnego `400 INVALID_IDENTIFIER` na `500 z PUSTYM cialem` — bez `errorCode` i bez `correlationId`; do tego straznik wyciekow nie widzi zmiennej spoza `catch (X)`, wiec lapie nazwe zamiast wzorca"

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
> **wyłącznie** `/private/tmp/cx-day326-konta-serwisowe`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `1c3d3da844ae03c87985a8f5dc74846a073c0220`**
> **Gałąź bazowa: `github-backup/grafika/m03-20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-04.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **KONTA SERWISOWE (Administracja / Table Platform) — bramka identyfikatora organizacji na GET/POST/DELETE, kształt odpowiedzi bledu (`errorCode` + `correlationId` w KAZDEJ), oraz straznik wyciekow surowych komunikatow w trasach: `tests/unit/backend/security/noRawErrorMessage.test.ts`**.
Trasy front: `brak — ten dyżur nie zmienia `src/**`. Konta serwisowe mają powierzchnię administracyjną, ale defekt jest w kontrakcie odpowiedzi HTTP, nie w renderze. Jeżeli Twój pomiar pokaże, że front zależy od kształtu odpowiedzi, który zmieniasz — to jest wynik: wpisz go i zgłoś, nie zmieniaj frontu`. Trasy tył: ``server/src/routes/admin/service-accounts.routes.ts` (RDZEN — `GET /` ok. 50-59, `POST /` ok. 62-91, `DELETE /:id` ok. 93-120; bramka `validateUUID` tylko w `GET`, ok. 54), `server/src/services/tablePlatform/ServiceAccountService.ts`, `server/src/utils/validation.ts` (`validateUUID` — TYLKO ODCZYT), `server/src/utils/ErrorHandler.ts` (globalny handler ok. 244-268 — TYLKO ODCZYT, ale MUSISZ ustalic, czy w ogole odpowiada na tej trasie), `server/src/middleware/appErrorMapper.ts` (TYLKO ODCZYT — teren dyzuru 325), `server/src/routes/table-platform.routes.ts``.

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
WT=/private/tmp/cx-day326-konta-serwisowe
MARKER=1c3d3da844ae03c87985a8f5dc74846a073c0220

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day326-konta-serwisowe-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day326-konta-serwisowe/config.worktree"
cat "$VAULT/worktrees/cx-day326-konta-serwisowe/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day326-konta-serwisowe-scratch
mkdir -p /private/tmp/cx-day326-konta-serwisowe-artefakty

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
git -C "$VAULT" log --oneline 1c3d3da844ae03c87985a8f5dc74846a073c0220..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 1c3d3da844ae03c87985a8f5dc74846a073c0220..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day326-konta-serwisowe-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 1c3d3da844ae03c87985a8f5dc74846a073c0220..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `8` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day326-konta-serwisowe

# ★ WSZYSTKIE grepy uruchamiasz w BASHU (`bash -lc '...'` albo skrypt `.sh`).
#   W `zsh` `grep --include=*.ts` zwraca `no matches found` ZAMIAST wynikow.

# (1) ★ TEZA GLOWNA: bramka identyfikatora stoi TYLKO w GET
grep -n "validateUUID" server/src/routes/admin/service-accounts.routes.ts
sed -n '50,60p' server/src/routes/admin/service-accounts.routes.ts
#   oczekiwane: JEDNO trafienie `validateUUID`, w handlerze `GET /` (ok. 54),
#   `return res.json({ success: true, data: [] })`. POST i DELETE — brak bramki.

# (2) TEZA: `validateUUID` odrzuca identyfikator `system`
sed -n '/export function validateUUID/,/^}/p' server/src/utils/validation.ts
#   oczekiwane: regex `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`

# (3) ★ TEZA: swieza baza ma organizacje `system` — identyfikator spoza UUID
grep -rn "INTO organizations" server/migrations | head
#   oczekiwane: `server/migrations/000_z_core_baseline.sql:1059` z ('system','System','active')
#   ★ UWAGA: to jest `INSERT OR IGNORE`, czyli dialekt SQLite. Z obecnosci w pliku NIE WYNIKA,
#   ze wiersz wszedl na Postgresa — sprawdzasz to na SWOJEJ bazie po migracjach, w `R1`.

# (4) ★ TEZA-SPRZECZNOSC: globalny handler zwraca NIEPUSTE cialo, a odbior zmierzyl `{}`
sed -n '244,268p' server/src/utils/ErrorHandler.ts
#   oczekiwane: galaz `else` z `res.status(500).json({status,correlationId,error:{...}})`
#   ★ To PRZECZY zmierzonemu `500` z cialem `{}`. Rozstrzygasz POMIAREM w `R1`, nie zgadywaniem.

# (5) ★ TEZA: straznik wyciekow zbiera nazwy tylko z `catch (X)`
grep -n "catchVariableViolations\|catch\\\\s\\*" tests/unit/backend/security/noRawErrorMessage.test.ts
grep -n "ALTERNATE_LEAK_BASELINE\|VARIABLE_AGNOSTIC_LEAK_BASELINE" tests/unit/backend/security/noRawErrorMessage.test.ts
#   oczekiwane: wyrazenie `catch\s*\(\s*([A-Za-z_$][\w$]*)`; progi 44 i 47 (MOJE liczby)

# (6) TEZA: `.catch(` z callbackiem w nawiasie wystepuje w trasach masowo
grep -rn "\.catch(" server/src/routes --include="*.ts" | grep -v "__tests__" | wc -l
grep -rnE "\.catch\(\s*\(" server/src/routes --include="*.ts" | grep -v "__tests__" | wc -l
#   oczekiwane (MOJE liczby): 267 wszystkich `.catch(`, 251 z callbackiem w nawiasie.
#   Zlecenie mowilo „81 takich miejsc" — to inna definicja tego, co sie liczy.
#   ZMIERZ SWOJA i PODAJ DEFINICJE tego, co liczysz.

# (7) TEZA: istniejacy test kont serwisowych nie dowodzi listowania
grep -n "it(\|toBe(\|toHaveBeenCalledWith" server/src/routes/__tests__/service-accounts.routes.test.ts | head -20
#   oczekiwane: piec przypadkow, zaden nie asertuje REALNEGO wiersza w odpowiedzi GET

# (8) zasoby wolne
df -h /
lsof -nP -iTCP:5492 -sTCP:LISTEN; lsof -nP -iTCP:6352 -sTCP:LISTEN
docker ps --format '{{.Names}}' | grep -c cx-day326 || true
#   oczekiwane: powyzej 5 GB wolnego; oba porty puste; 0 kontenerow
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day326-konta-serwisowe-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6352`. Twój JEDYNY port harnessu to `5492`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day326-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000, 5037, 5060-5061, 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez inne prace: 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5449 oraz 6311-6313 (odbiorcy nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyżury 286-323 oraz rodzeństwo tej paczki 04.09: 324 (6350/5490), 325 (6351/5491); dyżury 313-323 poza tą instrukcją, sprawdź sam przed startem. Twoje własne: baza 6352, harness 5492. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y, po numerze PID, nigdy po nazwie procesu`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `żadnej pozycji — ten dyżur nie zamawia ani jednej flagi funkcyjnej i nie zmienia wartości domyślnej żadnej istniejącej. Naprawa kontraktu odpowiedzi błędu i uszczelnienie strażnika wycieków nie są zmianami wizualnymi. Gdybyś uznał, że potrzebujesz flagi, jest to STOP MERYTORYCZNY z briefem, a nie cichy commit`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: `server/src/middleware/auth.middleware.ts` · `server/src/middleware/admin.middleware.ts` · `server/src/middleware/requireAudit.middleware.ts` · `server/src/Gateway.ts` · `server/src/middleware/v8FeatureGate.middleware.ts` · `server/src/middleware/resultsInternalBetaVisibility.middleware.ts` · `server/src/utils/ErrorHandler.ts` (globalny handler). ★ WYJĄTEK IMIENNY: strażnik wycieków MA w tym dyżurze WĄSKĄ LICENCJĘ, wyłącznie ROZSZERZAJĄCĄ wykrywanie (zakaz podnoszenia progów, zakaz zawężania zakresu skanu) — patrz tabela licencji `B.1`: `tests/unit/backend/security/noRawErrorMessage.test.ts`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY326_KONTA_SERWISOWE_REPORT.md`. Dozwolone nowe/zmieniane pliki dokumentacyjne: raport pod `SCIEZKA_RAPORTU` oraz NOWY `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KONT_SERWISOWYCH_20260904.md` (macierz dowodowa: metoda × kształt identyfikatora organizacji × „obcy nie widzi" / „właściciel widzi" · kod odpowiedzi · `errorCode` · `correlationId` · commit). **ZAKAZ edycji `MODULE_ACCEPTANCE.md`**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day326-konta-serwisowe-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day326-konta-serwisowe-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ DOWODZENIA IZOLACJI TESTEM, KTÓRY ASERTUJE PUSTĄ LISTĘ.** Test dyżuru 321 sprawdzał `data: []` i przeszedłby **tak samo przy całkowicie zepsutym listowaniu** — pusta lista nie odróżnia „obcy nie widzi" od „nikt nic nie widzi". Każdy Twój dowód izolacji musi być **PARĄ**: „obcy nie widzi" **ORAZ** „właściciel widzi realny wiersz", na realnym Postgresie z realnie wstawionym wierszem w `tp_service_accounts`. **ZAKAZ WSTAWIANIA WŁASNYCH ORGANIZACJI I TRAKTOWANIA ICH JAKO STANU ZASTANEGO** — dyżur 321 zmierzył „4 organizacje" na wierszach, które sam wstawił; stan świeżej bazy czytasz PRZED jakimkolwiek własnym zapisem i zapisujesz osobno. **ZAKAZ OSŁABIANIA STRAŻNIKA WYCIEKÓW** — nie podnosisz progów `ALTERNATE_LEAK_BASELINE` / `VARIABLE_AGNOSTIC_LEAK_BASELINE` ani nie zawężasz zakresu skanowanych plików; wolno wyłącznie ROZSZERZYĆ wykrywanie. **ZAKAZ „naprawiania" 500 przez cichy `try/catch` zwracający `200`** (`Z23` — zero atrap). **ZAKAZ zmiany kodów uprawnień** (`ADMIN_BOUNDARY_VIOLATION`, `ADMIN_MEMBERSHIP_REQUIRED`, `ADMIN_ACCESS_REQUIRED`) — to jest kontrakt bezpieczeństwa, nie tekst | Dyżur 321 przeniósł bramkę identyfikatora wyłącznie do `GET`, przez co zapisy dla organizacji o identyfikatorze spoza UUID zamieniły jawny, diagnozowalny `400` na `500 z pustym ciałem` — bez `errorCode` i bez `correlationId`, czyli bez czegokolwiek, po czym można to zgłosić i odnaleźć w logach. Ryzyko jest realne, nie teoretyczne: **świeża baza po migracjach ma organizację `system` z identyfikatorem spoza UUID** |

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
cd /private/tmp/cx-day326-konta-serwisowe

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day326-pg psql -U postgres -d cx326 \
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
cd /private/tmp/cx-day326-konta-serwisowe

docker run -d --name cx-day326-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx326 \
  -p 127.0.0.1:6352:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day326-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6352/cx326 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6352/cx326 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day326-konta-serwisowe && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6352/cx326 \
JWT_SECRET=cx326-test-secret-do-not-reuse \
npx vitest run `npx vitest run server/src/routes/__tests__/service-accounts.routes.test.ts --config server/vitest.config.ts --retry=0` · `npx vitest run tests/unit/backend/security/noRawErrorMessage.test.ts --retry=0` · Twoje NOWE testy na realnym Postgresie (wariant `§0.2c` (B), po pełnych migracjach). **Testy serwerowe wymagają `--config server/vitest.config.ts`** — uruchomienie z roota bez configu daje `No test files found`, a to **NIE jest `PASS`**, tylko brak pomiaru --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day326-konta-serwisowe-artefakty/day326-konta-serwisowe.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day326-konta-serwisowe && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run `npx vitest run server/src/routes/__tests__/service-accounts.routes.test.ts --config server/vitest.config.ts --retry=0` · `npx vitest run tests/unit/backend/security/noRawErrorMessage.test.ts --retry=0` · Twoje NOWE testy na realnym Postgresie (wariant `§0.2c` (B), po pełnych migracjach). **Testy serwerowe wymagają `--config server/vitest.config.ts`** — uruchomienie z roota bez configu daje `No test files found`, a to **NIE jest `PASS`**, tylko brak pomiaru --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day326-konta-serwisowe-artefakty/day326-konta-serwisowe.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day326-konta-serwisowe/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day326-pg psql -U postgres -d cx326 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day326-pg`.
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
> **(e) ★★★ **SIEDEM PUŁAPEK TEGO DYŻURU.** (1) **Pusta lista nie jest dowodem izolacji.** `data: []` przechodzi tak samo przy zepsutym listowaniu; dowodem jest PARA „obcy nie widzi" + „właściciel widzi realny wiersz". (2) **Świeża baza ma organizację spoza UUID.** `server/migrations/000_z_core_baseline.sql` ok. 1059 wstawia `('system', 'System', 'active')` — identyfikator `system` **nie przechodzi** `validateUUID` (`server/src/utils/validation.ts`: regex `^[0-9a-f]{8}-…$`). To nie jest przypadek brzegowy wymyślony na potrzeby testu, tylko stan świeżej instalacji. **Uwaga druga:** ten wiersz stoi pod składnią `INSERT OR IGNORE`, która jest dialektem SQLite — **sprawdź na SWOJEJ bazie po migracjach, czy on tam realnie jest**, bo z tego, że stoi w pliku, nie wynika, że wszedł na Postgresa. (3) **Straż wyciekow nie widzi zmiennej spoza `catch (X)`.** `catchVariableViolations()` w `tests/unit/backend/security/noRawErrorMessage.test.ts` zbiera nazwy wyrażeniem `catch\s*\(\s*([A-Za-z_$][\w$]*)` — po `catch` musi stać `(` i **od razu** identyfikator. W zapisie `.catch((problem) => …)` po pierwszym `(` stoi drugi `(`, więc dopasowanie nie zachodzi i nazwa `problem` nigdy nie trafia do skanu. Straż ma łapać **WZORZEC**, nie nazwę. (4) **★ SPRZECZNOŚĆ DO ROZSTRZYGNIĘCIA POMIAREM:** globalny handler `server/src/utils/ErrorHandler.ts` ok. 258-267 zwraca dla nieoperacyjnego błędu **niepuste** ciało (`{status, correlationId, error:{code:'INTERNAL_ERROR', message, timestamp}}`). Odbiór zmierzył jednak `500` z ciałem `{}`. **Obie rzeczy nie mogą być prawdą naraz** — więc ZANIM cokolwiek naprawisz, ustal POMIAREM, kto realnie odpowiada na tej trasie: ten handler, inny handler, czy odpowiedź powstaje przed jego zamontowaniem. To jest pierwsza rzecz, którą robisz w `R1`, i najcenniejszy pojedynczy wynik tego dyżuru. (5) **`Z26`/`§0.2e`:** bez `ENABLE_V8_GLOBAL=true` część tras daje fałszywe `404` **przed** uwierzytelnieniem, a bez `ENABLE_TEST_AUTH_BYPASS=false` `verifyToken` **jest omijany** — Twoje `403` powstanie wtedy z całkiem innego powodu. (6) **Atrapa bazy kłamie o zapisie:** `Database.ts` ok. 686 zwraca `changes: 1` dla każdego `UPDATE` niezależnie od `WHERE`, a `NODE_ENV=test` bez `RUN_DB_TESTS=1` podstawia atrapę pod `DbPromise` — `pg.Pool` widzi wiersz, kod produkcyjny nie. Wszystkie pomiary tego dyżuru idą na REALNYM Postgresie, z pełnym kompletem env w jednej linii. (7) **`grep --include` w `zsh` zwraca `no matches found` zamiast wyników** — każdy pomiar grepem uruchamiasz w `bash`**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day326-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day326-konta-serwisowe-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (pomiar macierzy 3 metody × 2 kształty identyfikatora × para „obcy/właściciel" na realnym łańcuchu, plus rozstrzygnięcie, KTO produkuje `500` z pustym ciałem) · R2 (bramka identyfikatora na POST i DELETE — żadna odpowiedź błędu bez `errorCode` i `correlationId`) · R3 (strażnik wycieków łapie wzorzec, nie nazwę — mutacja `.catch((problem) => …)` czerwieni)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6352` albo `5492` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6352` albo `5492`** (`Z7`).

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

## Po co ten dyżur istnieje

Odbiór adwersaryjny 04.09 zmierzył konta serwisowe **realnym łańcuchem**: `ApiGateway` +
podpisany JWT + Postgres po pełnych migracjach, i — czego test dyżuru 321 **nie miał** — z
**realnym wierszem** w `tp_service_accounts`. Wynik:

| | org UUID | org TEXT | przed dyżurem 321 (TEXT) |
| --- | --- | --- | --- |
| `GET` | `200` + realne dane | `200` + `[]` | `400 INVALID_IDENTIFIER` |
| `POST` | `201`, token wydany | **`500`, ciało `{}`** | `400` |
| `DELETE` | — | **`500`, ciało `{}`** | `400` |
| obcy tenant | `403` | `403` | `403` |

**Teza „cały moduł przestaje działać" jest OBALONA** — dla organizacji z identyfikatorem UUID
moduł czyta i zapisuje. To jest dobra wiadomość i wchodzi do raportu jako wynik, nie jako
przypis.

Defekt jest węższy i konkretniejszy. Dyżur 321 przeniósł bramkę identyfikatora **wyłącznie do
`GET`** (`server/src/routes/admin/service-accounts.routes.ts` ok. 54:
`if (!validateUUID(organizationId)) return res.json({ success: true, data: [] });`). `POST` i
`DELETE` bramki nie dostały. Skutek: dla organizacji o identyfikatorze spoza UUID zapisy zamieniły
**jawny, diagnozowalny `400`** na **`500` z pustym ciałem — bez `errorCode` i bez
`correlationId`**, czyli bez czegokolwiek, po czym użytkownik może to zgłosić, a my odnaleźć
w logach.

### Ryzyko jest realne, nie teoretyczne

`server/migrations/000_z_core_baseline.sql` ok. 1059:

```sql
INSERT OR IGNORE INTO organizations (id, name, status) VALUES ('system', 'System', 'active');
```

Identyfikator `system` **nie przechodzi** `validateUUID` (`server/src/utils/validation.ts`, regex
`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`). **Świeża instalacja ma
organizację spoza UUID.** Dyżur 321 zmierzył „4 organizacje" na wierszach, **które sam wstawił** —
to nie był pomiar stanu zastanego.

> ★ **Drugie dno, które sam masz rozstrzygnąć:** ten `INSERT` stoi pod składnią `INSERT OR IGNORE`,
> która jest **dialektem SQLite**. Z tego, że wiersz stoi w pliku migracji, **nie wynika**, że
> wszedł na Postgresa. Sprawdź na SWOJEJ bazie po pełnych migracjach, czy on tam realnie jest —
> i **obie odpowiedzi są cenne**: jeśli jest, ryzyko potwierdzone; jeśli go nie ma, znalazłeś
> osobną, cichą dziurę w odtwarzaniu bazy od zera.

### Sprzeczność, którą rozstrzygasz pomiarem, nie zgadywaniem

Globalny handler `server/src/utils/ErrorHandler.ts` ok. 258-267 zwraca dla błędu nieoperacyjnego
**niepuste** ciało:

```ts
res.status(500).json({
  status: 'error',
  correlationId: typeof correlationId === 'string' ? correlationId : null,
  error: { code: 'INTERNAL_ERROR', message: 'Something went very wrong!', timestamp: … },
});
```

Odbiór zmierzył jednak `500` z ciałem `{}`. **Obie rzeczy nie mogą być prawdą naraz.** Zanim
cokolwiek naprawisz, ustal **pomiarem**, kto realnie odpowiada na tej trasie: ten handler, inny
handler, czy odpowiedź powstaje przed jego zamontowaniem. To jest pierwsza rzecz w `R1` i
**najcenniejszy pojedynczy wynik tego dyżuru** — bo jeśli globalny handler nie odpowiada na
trasach administracyjnych, to dotyczy nie tylko kont serwisowych.

### Druga pozycja: strażnik łapie nazwę, nie wzorzec

`tests/unit/backend/security/noRawErrorMessage.test.ts` ma funkcję `catchVariableViolations()`,
która zbiera nazwy zmiennych wyrażeniem:

```js
[...source.matchAll(/catch\s*\(\s*([A-Za-z_$][\w$]*)/g)]
```

Po `catch` musi stać `(` i **od razu** identyfikator. W zapisie `.catch((problem) => …)` po
pierwszym `(` stoi **drugi** `(`, więc dopasowanie nie zachodzi i nazwa `problem` nigdy nie trafia
do skanu. Mutacja `.catch((problem) => res.json({ error: problem.message }))` **przeszła na
zielono**.

**Strażnik ma łapać WZORZEC, nie nazwę.** Moje liczby powierzchni w `server/src/routes` (bez
testów): **267** wystąpień `.catch(`, **251** z callbackiem w nawiasie. Zlecenie mówiło o „81
takich miejscach" — to inna definicja tego, co się liczy. **Zmierz swoją i podaj definicję.**

## ★ Zmierz moje liczby sam

Twierdzę: bramka `validateUUID` stoi tylko w `GET` (jedno trafienie w pliku trasy); `system` jest
identyfikatorem spoza UUID i stoi w migracji `000_z_core_baseline.sql` ok. 1059 pod składnią
SQLite; globalny handler zwraca niepuste ciało; strażnik ma progi 44 i 47 i zbiera nazwy tylko
z `catch (X)`; w trasach jest 267 `.catch(` i 251 z callbackiem; liście `translation.json` =
pl 35198 / en 33065.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

---

## B.1. TABELA LICENCJI PLIKOWYCH — CAŁA ŚCIEŻKA

> **★★ ZASTRZEŻENIE.** Poniższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz, jest
> opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi« jest
> NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, a Twoim produktem
> jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Warstwa | Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- | --- |
| **walidator** | `server/src/utils/validation.ts` (`validateUUID`) | **TYLKO ODCZYT — PLIK PRZEKROJOWY.** Używany w całym serwerze; poluzowanie regexu przepuściłoby identyfikatory w miejscach, których nie mierzysz | **CZERWONY KONTRAKT TESTOWY** (`it('KONTRAKT DLA DYŻURU 326 — …')`, nagłówek `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`) + brief: plik:linia · ilu konsumentów · promień rażenia. **Pozycja z takim produktem jest ZROBIONA, nie STOP** |
| **trasa (tył)** | `server/src/routes/admin/service-accounts.routes.ts` | **★ PEŁNA LICENCJA** w zakresie `R2`: bramka identyfikatora na `POST` i `DELETE`, kształt odpowiedzi błędu (`errorCode` + `correlationId` w KAŻDEJ). **ZAKAZ zmiany kodów uprawnień** `ADMIN_BOUNDARY_VIOLATION` / `ADMIN_MEMBERSHIP_REQUIRED` / `ADMIN_ACCESS_REQUIRED` i **ZAKAZ zmiany kolejności middleware** (`verifyToken` → strażnik org → `verifyAdmin` → `requireAudit`) | — |
| **trasa (tył)** | `server/src/routes/table-platform.routes.ts` | **TYLKO ODCZYT** — drugi konsument `tp_service_accounts`; ustal, czy dziedziczy ten sam defekt | Wpis do rejestru + gotowy diff **nienałożony** |
| **kontroler / serwis (tył)** | `server/src/services/tablePlatform/ServiceAccountService.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE jawne odrzucenie niepoprawnego identyfikatora organizacji zamiast wyjątku bez kodu.** Zakaz zmiany kształtu zwracanych danych, zakaz zmiany logiki wydawania tokenu, zakaz zmiany zapytań SQL poza dodaniem walidacji wejścia | Gotowy diff + brief |
| **repozytorium / SQL** | Zapytania w `ServiceAccountService.ts` i w trasie (`SELECT id FROM tp_service_accounts WHERE id = ? AND organization_id = ?`) | **TYLKO ODCZYT — to jest zakres izolacji tenantów.** Zmiana `WHERE` przy tej okazji byłaby cichą zmianą modelu bezpieczeństwa | Wpis + czerwony kontrakt |
| **globalny handler** | `server/src/utils/ErrorHandler.ts` | **TYLKO ODCZYT — PLIK PRZEKROJOWY** (`Z12`). Twoim zadaniem jest **ustalić, czy on w ogóle odpowiada na tej trasie**, nie zmienić go | Brief z pomiarem: kto realnie odpowiada · dlaczego ciało jest puste · gotowy diff **nienałożony** · promień rażenia (ile tras administracyjnych) |
| **mapper** | `server/src/middleware/appErrorMapper.ts` | **TYLKO ODCZYT — teren dyżuru 325** | Wpis do raportu: plik, linia, treść problemu, gotowa rekomendacja jako diff, **nienałożony**. Pozycja idzie dalej |
| **migracje** | `server/migrations/**` | **BEZ LICENCJI — ten dyżur nie dodaje ani nie zmienia żadnej migracji.** Przedział nieprzydzielony. Jeżeli ustalisz, że `INSERT OR IGNORE` nie działa na Postgresie, produktem jest **wpis do rejestru + gotowy diff nienałożony**, nigdy migracja dopisana przy okazji | STOP MERYTORYCZNY z briefem, idziesz do następnej pozycji |
| **strażnik** | `tests/unit/backend/security/noRawErrorMessage.test.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE ROZSZERZENIE WYKRYWANIA.** Wolno: poprawić wyrażenie zbierające nazwy zmiennych tak, żeby obejmowało callbacki `.catch((x) => …)`; dodać nowe wzorce wycieków; dodać nowe `it(...)`. **ZAKAZ podnoszenia progów `ALTERNATE_LEAK_BASELINE` (44) i `VARIABLE_AGNOSTIC_LEAK_BASELINE` (47)**, zakaz zawężania zbioru skanowanych plików, zakaz usuwania istniejących `it(...)`. Jeżeli uszczelnienie ujawni dług większy niż próg — **nie podnosisz progu**: opisujesz dług w rejestrze i wpisujesz `STOP MERYTORYCZNY` z liczbą, a strażnika zostawiasz uszczelnionego z **osobnym, nowym** `it(...)` opisującym stan faktyczny | Nowy plik testowy obok, z tym samym zakresem skanu |
| **testy (istniejące)** | `server/src/routes/__tests__/service-accounts.routes.test.ts` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisanie NOWYCH `it(...)`.** Zakaz zmiany i osłabiania istniejących pięciu | Nowy plik testowy obok |
| **testy (NOWE)** | `server/src/routes/__tests__/**` (NOWE), `tests/**` (NOWE) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18`, `Z29` (`--retry=0`) i `Z31` (`assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW**). **Nowe pliki w `tests/` wymagają `git add -f`** | — |
| **i18n** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie. **Liczba liści nie może zmaleć** (baza: pl 35198 / en 33065 — komenda w `B.3`). Realnie ten dyżur prawdopodobnie ich nie dotknie | — |
| **rejestr** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KONT_SERWISOWYCH_20260904.md` (**NOWY**) | **★ PEŁNA LICENCJA** | — |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY326_KONTA_SERWISOWE_REPORT.md` | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **bramki** | `server/src/middleware/auth.middleware.ts`, `admin.middleware.ts`, `requireAudit.middleware.ts`, `v8FeatureGate.middleware.ts`, `resultsInternalBetaVisibility.middleware.ts`, `server/src/Gateway.ts` | **TYLKO ODCZYT — `Z12`, BEZWZGLĘDNIE** | **CZERWONY KONTRAKT TESTOWY** + brief. Pozycja jest wtedy **ZROBIONA**, nie STOP |
| **infra testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: co blokuje pomiar, jaka byłaby zmiana, jak obszedłeś to zmiennymi w linii komendy. Pozycja jest zrobiona z takim opisem |
| **front** | `src/**` | **TYLKO ODCZYT** — ten dyżur nie zmienia frontu | Opis w raporcie z dowodem plik:linia |
| **decyzje** | `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| **cudzy teren** | `src/services/errors/appErrorCopy.ts`, `src/services/api.ts`, `server/src/routes/resultsVnext/okr.routes.ts`, `kpiScorecard.routes.ts` — **teren dyżuru 325**; `src/components/Initiatives/**`, `src/components/**/*ardContract*.ts` — **teren dyżuru 324** | **TYLKO ODCZYT** | Wpis do raportu z gotową rekomendacją jako diff, **nienałożony**. Pozycja idzie dalej |
| — | **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

**Jedna pozycja = jeden wiersz = jeden commit = jeden werdykt. Commit po KAŻDEJ pozycji, push na
`github-backup` po pierwszym commicie i po każdej kolejnej (`Z34a`).**

| Pozycja | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Macierz dowodowa + rozstrzygnięcie, kto produkuje `500` z pustym ciałem | TAK | NIE — dowód: pomiar jest odczytem; `ErrorHandler.ts` nie jest zmieniany | bazowe | Sześć komórek macierzy (3 metody × 2 kształty identyfikatora), **każda jako PARA** „obcy nie widzi" + „właściciel widzi realny wiersz"; stan świeżej bazy odczytany **PRZED** własnym zapisem; nazwany handler odpowiadający `500` | `npx vitest run <Twój nowy test> --config server/vitest.config.ts --retry=0` z pełnym kompletem env `§0.2c` (B) | `test(service-accounts): macierz dowodowa na realnym Postgresie (326 R1)` |
| R2 | Bramka identyfikatora na `POST` i `DELETE`; koperta błędu kompletna | TAK | NIE — dowód: `B.1` daje pełną licencję na plik trasy | +3 testy | Dla org spoza UUID: `POST` i `DELETE` zwracają **jawny kod 4xx** z `errorCode` **i** `correlationId`; **żadna** odpowiedź błędu tej trasy nie jest bez tych dwóch pól; dla org UUID zachowanie **bit w bit jak przed zmianą** (para „właściciel widzi") | jw. | `fix(service-accounts): bramka identyfikatora na POST i DELETE (326 R2)` |
| R3 | Strażnik łapie wzorzec, nie nazwę | TAK | NIE — dowód: `B.1` daje wąską licencję na plik strażnika, wyłącznie rozszerzającą | +1 test | Mutacja `.catch((problem) => res.json({ error: problem.message }))` **CZERWIENI**; progi 44 i 47 **niepodniesione**; zakres skanu **niezawężony** | `npx vitest run tests/unit/backend/security/noRawErrorMessage.test.ts --retry=0` + dowód mutacyjny | `fix(security): straznik wyciekow lapie wzorzec, nie nazwe (326 R3)` |
| R4 | Rozliczenie `INSERT OR IGNORE` na Postgresie | NIE | NIE | n/d | Odpowiedź na pytanie „czy organizacja `system` realnie istnieje w bazie po migracjach", z zapytaniem i wynikiem; jeżeli nie — opis dziury w odtwarzaniu bazy od zera + gotowy diff **nienałożony** | `docker exec cx-day326-pg psql -U postgres -d cx326 -c "SELECT id, name FROM organizations;"` | `docs(day326): rozliczenie seeda organizacji system (326 R4)` |
| R5 | Powierzchnia `.catch(` w trasach | NIE | NIE | n/d | **Twoja** liczba z podaną definicją; ile z nich realnie wycieka do odpowiedzi HTTP, a ile idzie do loggera (logger ma prawo do surowej treści) | `grep -rnE "\.catch\(\s*\(" server/src/routes --include="*.ts" \| grep -v __tests__ \| wc -l` (w `bash`) | `docs(day326): powierzchnia .catch w trasach (326 R5)` |
| R6 | Raport | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" **niepusta**, jawny zapis **obalenia** tezy „cały moduł przestaje działać" | — | `docs(day326): raport` |

> **Kolumna „Wymaga plików przekrojowych?" jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi `NIE`.** Żadna pozycja nie wymaga zmiany `validateUUID`, `ErrorHandler.ts` ani żadnej
> bramki z `Z12`: gdyby wymagała, produktem jest czerwony kontrakt + brief, a pozycja jest
> **ZROBIONA**.

---

## B.3. TABELA MIANOWNIKÓW

**Każdą liczbę mierzysz sam (`Z24`) i podajesz swoją. Wszystkie komendy uruchamiasz w `bash`.**

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Trafienia `validateUUID` w pliku trasy | 1 (tylko `GET`) | `grep -c "validateUUID" server/src/routes/admin/service-accounts.routes.ts` | TAK — brak trafień w `POST`/`DELETE` JEST wynikiem |
| 2 | Wystąpienia `.catch(` w `server/src/routes` (bez testów) | 267 | `grep -rn "\.catch(" server/src/routes --include="*.ts" \| grep -v "__tests__" \| wc -l` | TAK |
| 3 | Z tego z callbackiem w nawiasie | 251 | `grep -rnE "\.catch\(\s*\(" server/src/routes --include="*.ts" \| grep -v "__tests__" \| wc -l` | TAK — **zlecenie mówiło „81"; podaj swoją liczbę i definicję** |
| 4 | Progi strażnika wycieków | 44 i 47 | `grep -n "ALTERNATE_LEAK_BASELINE\|VARIABLE_AGNOSTIC_LEAK_BASELINE" tests/unit/backend/security/noRawErrorMessage.test.ts` | TAK — **nie wolno ich podnieść** |
| 5 | Organizacje w bazie **przed** Twoim pierwszym zapisem | **do zmierzenia** — autor nie podaje | `docker exec cx-day326-pg psql -U postgres -d cx326 -c "SELECT id, name, status FROM organizations;"` | TAK — **to jest pomiar stanu zastanego; dyżur 321 policzył tu wiersze, które sam wstawił** |
| 6 | Zastosowane migracje | **do zmierzenia** — autor nie podaje | wynik `npx tsx server/scripts/migrate.postgres.ts` (obydwa przebiegi, `§0.2c` (A)) | TAK — zlecenie mówiło „891"; **licz sam** |
| 7 | Przypadki w istniejącym teście trasy | 5 | `grep -c "  it(" server/src/routes/__tests__/service-accounts.routes.test.ts` | TAK — żaden nie asertuje realnego wiersza w odpowiedzi `GET` |
| 8 | Liście `translation.json` | pl 35198 / en 33065 | `node -e 'const c=p=>{const o=JSON.parse(require("fs").readFileSync(p,"utf8"));let n=0;const w=x=>{if(Array.isArray(x))x.forEach(w);else if(x&&typeof x==="object")Object.values(x).forEach(w);else n++;};w(o);return n;};console.log(c("public/locales/pl/translation.json"),c("public/locales/en/translation.json"))'` | TAK — **liczba nie może zmaleć**; tablice liczone element po elemencie |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `server/src/routes/admin/service-accounts.routes.ts` | istniejący | R2 | ZEROWE — 324 i 325 mają go jawnie jako cudzy teren |
| 2 | `tests/unit/backend/security/noRawErrorMessage.test.ts` | istniejący | R3 | ZEROWE — 325 ma go jawnie jako cudzy teren |
| 3 | `server/src/routes/__tests__/service-accounts.routes.<nowy>.test.ts` | NOWY | R1/R2 | ZEROWE |
| 4 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KONT_SERWISOWYCH_20260904.md` | NOWY | R1/R4/R5 | ZEROWE |
| 5 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY326_KONTA_SERWISOWE_REPORT.md` | NOWY | R6 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `server/src/services/tablePlatform/ServiceAccountService.ts` | R2 | Tylko jeśli pomiar `R1` pokaże, że `500` rodzi się w serwisie, a nie w trasie — i tylko jawne odrzucenie niepoprawnego identyfikatora |
| `server/src/routes/__tests__/service-accounts.routes.test.ts` | R2 | Tylko dopisanie nowych `it(...)` |
| `public/locales/{pl,en}/translation.json` | R2 | Tylko jeśli nowa odpowiedź niesie klucz i18n; parytet w tym samym commicie, liczba liści nie maleje |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
server/src/utils/validation.ts                          — przekrojowy (validateUUID)
server/src/utils/ErrorHandler.ts                        — przekrojowy; produkt = brief + diff NIENAŁOŻONY
server/src/middleware/auth.middleware.ts                — Z12
server/src/middleware/admin.middleware.ts               — Z12
server/src/middleware/requireAudit.middleware.ts        — Z12
server/src/Gateway.ts                                   — Z19
server/src/middleware/appErrorMapper.ts                 — teren dyżuru 325
src/services/errors/appErrorCopy.ts, src/services/api.ts — teren dyżuru 325
server/src/routes/resultsVnext/okr.routes.ts, kpiScorecard.routes.ts — teren dyżuru 325
src/components/Initiatives/**, src/components/**/*ardContract*.ts — teren dyżuru 324
server/migrations/**                                    — przedział nieprzydzielony
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6352 | `lsof -nP -iTCP:6352 -sTCP:LISTEN` → puste (sprawdzone przy pisaniu instrukcji) |
| Port harnessu | 5492 | `lsof -nP -iTCP:5492 -sTCP:LISTEN` → puste |
| Kontener | `cx-day326-pg` | `docker ps --format '{{.Names}}' \| grep cx-day326` → brak |
| Baza | `cx326` | n/d |
| Gałąź | `codex/day326-konta-serwisowe-20260904` | nie istnieje na `github-backup` |
| Worktree | `/private/tmp/cx-day326-konta-serwisowe` | nie istnieje |
| Przedział migracji | **NIEPRZYDZIELONY** — dyżur nie dodaje migracji | n/d |
| Flagi | **żadnych nowych, żadnych zmian domyślnych** | `git diff <marker>..HEAD -- '.env*' 'docker-compose*' 'railway*'` → pusto |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day326-konta-serwisowe
git diff --name-only --cached | tee /private/tmp/cx-day326-konta-serwisowe-artefakty/staged.txt
grep -iE 'utils/validation\.ts|utils/ErrorHandler\.ts|auth\.middleware|admin\.middleware|requireAudit|Gateway\.ts|appErrorMapper|appErrorCopy|services/api\.ts|resultsVnext/okr\.routes|kpiScorecard\.routes|components/Initiatives/|ardContract|server/migrations/' \
  /private/tmp/cx-day326-konta-serwisowe-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged <plik>)" \
  || echo "rozlacznosc OK"
```

---

## R1 — MACIERZ DOWODOWA I KTO PRODUKUJE `500` Z PUSTYM CIAŁEM

**Kolejność jest wiążąca** (`Z20`): najpierw kontener + pełne migracje (`§0.2c` (A), obydwa
przebiegi), potem **odczyt stanu zastanego**, dopiero potem jakikolwiek własny zapis.

**Krok 1 — stan zastany, PRZED Twoim pierwszym zapisem:**

```bash
docker exec cx-day326-pg psql -U postgres -d cx326 \
  -c "SELECT id, name, status FROM organizations ORDER BY id;"
#   zapisz WYNIK DOSŁOWNIE. To jest pomiar świeżej bazy, nie Twoich danych.
#   Sprawdź osobno, czy jest tam wiersz o id 'system' (patrz drugie dno w treści).
```

**Krok 2 — macierz, każda komórka jako PARA.** Realne żądania HTTP przez
`ApiGateway.getInstance().initializeRoutes(app)` (`Z22`), z podpisanym JWT, z **realnie wstawionym
wierszem** w `tp_service_accounts`, z zapisanym **kodem odpowiedzi** (`Z34`):

| Metoda | org UUID | org spoza UUID |
| --- | --- | --- |
| `GET` | (a) obcy → `403`; (b) właściciel → `200` **z tym wierszem w `data`** | (a) obcy → ?; (b) właściciel → ? |
| `POST` | (a) obcy → ?; (b) właściciel → ? | (a) obcy → ?; (b) właściciel → ? |
| `DELETE` | (a) obcy → ?; (b) właściciel → ? | (a) obcy → ?; (b) właściciel → ? |

★ **Komórka „właściciel widzi" MUSI asertować realny wiersz, nie pustą listę.** Test dyżuru 321
sprawdzał `data: []` i przeszedłby **tak samo przy całkowicie zepsutym listowaniu** — pusta lista
nie odróżnia „obcy nie widzi" od „nikt nic nie widzi".

**Krok 3 — kto odpowiada.** Dla każdego zmierzonego `500` ustal **imiennie**, który handler
zapisał odpowiedź i dlaczego ciało jest puste (albo: **że wcale nie jest puste** i pomiar odbioru
się mylił — to też jest cenny wynik). Ta odpowiedź trafia do raportu z dowodem: plik, linia,
sposób ustalenia.

★ **Akapit `§0.2e` obowiązkowy dla każdego pakietu** — która z pułapek (a)-(e) dotyczy, jak ją
wyłączyłeś i co dowodzi, że wyłączyłeś. Bez `ENABLE_TEST_AUTH_BYPASS=false` Twoje `403` powstanie
z całkiem innego powodu, a bez `MOCK_DB=false` odczyty pójdą **cicho** na atrapę bazy, która
zwraca `changes: 1` dla każdego `UPDATE` niezależnie od `WHERE`.

Prawo zatrzymania po tej pozycji.

## R2 — BRAMKA NA `POST` I `DELETE`, KOPERTA BŁĘDU KOMPLETNA

Dla organizacji o identyfikatorze spoza UUID `POST` i `DELETE` mają zwracać **jawny kod 4xx**
z `errorCode` **i** `correlationId`. **Żadna** odpowiedź błędu tej trasy nie może być bez tych
dwóch pól — to jest próg tej pozycji, sprawdzany po kolei dla wszystkich gałęzi błędu w pliku
(`401`, `403` ×3, `400`, `404`, `409`, `503 AUDIT_UNAVAILABLE`, `500`).

**Dla organizacji z identyfikatorem UUID zachowanie musi zostać bit w bit takie samo** — para
„właściciel widzi" przed i po zmianie, z tym samym kodem i tym samym wierszem w `data`. Regresja
tu byłaby gorsza niż defekt, który naprawiasz.

**Dowód mutacyjny obowiązkowy, wycelowany w ZABEZPIECZENIE, nie w mechanizm** (`Z32`): usuń
dodaną bramkę z `POST` → nowy test **CZERWONY** (bo wraca `500` bez `errorCode`); przywróć przez
`cp` z kopii w `SCRATCH` (`Z27`, nigdy `git stash`) → **ZIELONY**; `git diff` po cofnięciu
**pusty**. Obie komendy i oba wyniki dosłownie w raporcie.

★ **`Z23` — zero atrap.** „Naprawa" polegająca na `try/catch` zwracającym `200` albo pustą listę
jest **odrzuceniem pozycji**, nie naprawą. Uczciwy `4xx` z kodem jest wzorcem poprawnym.

Prawo zatrzymania po tej pozycji.

## R3 — STRAŻNIK ŁAPIE WZORZEC, NIE NAZWĘ

Uszczelniasz `catchVariableViolations()` tak, żeby obejmował **callbacki**: `.catch((problem) =>
…)`, `.catch(function (problem) { … })` i warianty z typem (`(problem: unknown)`). Zakres skanu
**niezawężony**, progi **niepodniesione**.

**Dowód mutacyjny wycelowany w zabezpieczenie:** wstaw do dowolnej trasy w zakresie skanu linię
`.catch((problem) => res.json({ error: problem.message }))` → strażnik **CZERWIENI**; usuń przez
`cp` z kopii → **ZIELONY**; `git diff` po cofnięciu **pusty**.

★ Jeżeli uszczelnienie ujawni dług większy niż zastane progi — **nie podnosisz progu**. Opisujesz
dług liczbą w rejestrze, wpisujesz `STOP MERYTORYCZNY`, zostawiasz strażnika uszczelnionego
z **osobnym, nowym** `it(...)` opisującym stan faktyczny, i idziesz dalej.

Prawo zatrzymania po tej pozycji.

## R4 — ROZLICZENIE SEEDA `system` NA POSTGRESIE

Odpowiedz na pytanie: **czy organizacja `system` realnie istnieje w bazie po pełnych migracjach?**
Zapytanie i wynik dosłownie. Jeżeli **tak** — ryzyko z treści potwierdzone i `R2` ją realnie
chroni. Jeżeli **nie** — znalazłeś osobną, cichą dziurę w odtwarzaniu bazy od zera
(`INSERT OR IGNORE` jest dialektem SQLite); opisz ją w rejestrze z gotowym diffem **nienałożonym**
i **nie dopisuj migracji przy okazji**.

Prawo zatrzymania po tej pozycji.

## R5 — POWIERZCHNIA `.catch(` W TRASACH

**Twoja** liczba z podaną definicją. Rozdziel: ile z nich realnie pisze do odpowiedzi HTTP
(`res.` / `.json(`), a ile idzie wyłącznie do loggera — **logger ma prawo i obowiązek do surowej
treści**, to nie jest wyciek. Bez tego rozdzielenia liczba jest myląca w drugą stronę.

Prawo zatrzymania po tej pozycji.

## R6 — RAPORT

Struktura `§R.2`. Obowiązkowo: **jawny zapis obalenia tezy** „cały moduł przestaje działać"
(z macierzą), sześć komórek macierzy jako pary „obcy nie widzi" + „właściciel widzi realny wiersz",
nazwany handler odpowiadający `500`, dowody mutacyjne w obie strony dla `R2` i `R3`, akapit
`§0.2e` dla każdego uruchomionego pakietu, deklaracja `§0.2b` (`Z30`), sekcja **TWIERDZENIA
NIEZWERYFIKOWANE** niepusta.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 zrobione (macierz + nazwany handler), R2 zrobione,
R3-R6 nietknięte" jest pełnowartościowym wynikiem — o ile każda komórka macierzy stoi na parze
dowodowej, a nie na pustej liście.

**Odwrotna kolejność — rejestry (R4/R5) zrobione, rdzeń (R1/R2/R3) „częściowo" — jest podstawą
odrzucenia.**

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela niżej | TAK |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone pętlą `[ -e "$p" ]` na worktree z markera; zero `BRAK` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, osiem wierszy; dwie pozycje jawnie oznaczone jako **do zmierzenia przez wykonawcę** (autor ich nie podaje, bo nie zmierzył) |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4 |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych (324, 325) | TAK — `B.4.4`; porty 5492/6352 zmierzone jako wolne |
| 7 | Komendy paste-ready, z `#   oczekiwane: …` | TAK |
| 8 | Pułapki środowiska w całości + siedem pułapek modułu | TAK |
| 9 | Samodzielność — zero odwołań do rozmów i „poprzedniego dyżuru" bez ścieżki | TAK |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu w dokumencie: `0`; wierszy `Z`: `41` | TAK |

### AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para wymagań, która mogłaby się wykluczać | Gdzie ROZSTRZYGNIĘTA w tym dokumencie |
| --- | --- |
| Zakaz `Z12` „bramki nietykalne" **vs** `R3` zmienia strażnika bezpieczeństwa | `Z12` (wyjątek imienny) + `B.1` — wąska licencja **wyłącznie rozszerzająca** wykrywanie; zakaz podnoszenia progów i zawężania skanu |
| „Uszczelnij strażnika" **vs** „nie podnoś progów" przy większym długu | `R3`, akapit końcowy — strażnik zostaje uszczelniony, dług idzie do rejestru jako `STOP MERYTORYCZNY` z liczbą, próg **niepodniesiony** |
| „Napraw `500` z pustym ciałem" **vs** `ErrorHandler.ts` tylko do odczytu | `B.1` + `R1` — najpierw **ustalasz pomiarem**, kto odpowiada; produktem dla `ErrorHandler.ts` jest brief + diff **nienałożony** |
| Treść instrukcji mówi „`500` z ciałem `{}`" **vs** kod handlera zwraca ciało niepuste | Rozstrzygnięte JAWNIE w treści („Sprzeczność, którą rozstrzygasz pomiarem") i w `R1` krok 3 — **to nie jest sprzeczność instrukcji, tylko rozkaz pomiarowy** |
| Zakaz `Z23` „zero atrap" **vs** pokusa naprawy `500` przez `200` z pustą listą | `R2`, akapit `Z23` — taka „naprawa" jest odrzuceniem pozycji |
| Zakaz `Z9` „żadnej bazy poza własnym kontenerem" **vs** wymóg realnego wiersza w `tp_service_accounts` | `R1` — wiersz wstawiasz do SWOJEJ bazy `cx326`, po pełnych migracjach; stan zastany odczytujesz PRZED tym zapisem |
| Zakaz `Z13` „dokładnie JEDEN nowy dokument" **vs** `R1`/`R4`/`R5` piszą do rejestru | `Z13` (pole „jedyny inny dokument") — raport + jeden imiennie wskazany rejestr |
| „Nie dodajesz migracji" **vs** możliwe odkrycie, że seed `system` nie wchodzi na Postgresa | `B.1` (wiersz migracji) + `R4` — produktem jest wpis do rejestru i diff **nienałożony**, nigdy migracja dopisana przy okazji |
