# INSTRUKCJA DYŻURU nr 333 — Codex — „Dyżur 319 (scalony) rozszerzył bezpiecznik DDL i dołożył 7 tabel + `markup_multiplier` — odbiór na bazie OD ZERA (893 migracje, 1914 tabel wg migracji, drugi przebieg `Applying migrations: 0`) znalazł trzy rzeczy do domknięcia: (1) `§R6 „B−A jest puste”` jest FAŁSZEM — po realnym przebiegu przez `ApiGateway` baza urosła 1914→1915 (`slack_router_dedupe`, tworzona wyłącznie w locie w `server/src/services/slack/slackRouter.ts:147`, migracja ją wspominająca jest warunkowa i na czystej bazie nic nie robi); (2) `§R5 „22 z 93”` jest błędne — realnie 21, bo `073_conversations.sql` jest oznaczony `MIGRACJA_POMIJANA` mimo że jest w `PROMOTED_LEGACY_PRODUCERS` i runner GO URUCHAMIA (klasyfikacja zrobiona z predykatu w kodzie zamiast z żywej bazy); (3) 24 pliki `__tests__` z DDL w `server/src` są pomijane przez bezpiecznik bez wiersza uzasadniającego"

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
> **wyłącznie** `/private/tmp/cx-day333-schemat-domkniecie`.

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
Zakres: **Schemat bazy danych — domknięcie po 310/319: poprawa klasyfikacji migracji pomijanych (pomiar z żywej bazy zamiast z predykatu kodu), naprawa fałszywego zdania „B−A jest puste”, rozstrzygnięcie 24 plików `__tests__` z DDL w `server/src`**.
Trasy front: `brak — ten dyżur jest wyłącznie backendowy/infrastrukturalny (migracje, bezpiecznik schematu, rejestr)`. Trasy tył: ``server/scripts/migrate.postgres.ts` (runner migracji, predykat pomijania — linia ok. 845 komentarz o `PROMOTED_LEGACY_PRODUCERS`), `server/scripts/migrationOrdering.ts` (lista `PROMOTED_LEGACY_PRODUCERS`, zawiera `073_conversations.sql` — linia ok. 71), `server/migrations/073_conversations.sql` (SOLE PRODUCER `conversations`/`conversation_messages`, uruchamiany mimo numeru < 500 bo jest na liście promowanych), `server/src/services/slack/slackRouter.ts` (linia 147 — `CREATE TABLE IF NOT EXISTS slack_router_dedupe` w locie), `server/migrations/20261670_p2_runtime_schema_repairs.sql` (jedyna migracja wspominająca tę tabelę, warunkowa `IF to_regclass(...) IS NOT NULL`), `tests/unit/backend/schema/noRuntimeDdl.test.ts` (bezpiecznik, linia ok. 157 pomija katalogi `__tests__` bezwarunkowo), `docs/program/waves/WAVE_03_ACCEPTANCE/` rejestr z dyżuru 310/319 (nazwa dokładna do potwierdzenia w R0)`.

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
WT=/private/tmp/cx-day333-schemat-domkniecie
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
git -C "$VAULT" worktree add "$WT" -b codex/day333-schemat-domkniecie-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day333-schemat-domkniecie/config.worktree"
cat "$VAULT/worktrees/cx-day333-schemat-domkniecie/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day333-schemat-domkniecie-scratch
mkdir -p /private/tmp/cx-day333-schemat-domkniecie-artefakty

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
git -C "$WT" push github-backup codex/day333-schemat-domkniecie-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 1c3d3da844ae03c87985a8f5dc74846a073c0220..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `10` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
# (1) TEZA: 073_conversations.sql jest w PROMOTED_LEGACY_PRODUCERS, wiec runner GO URUCHAMIA mimo numeru < 500
grep -n "073_conversations.sql" server/scripts/migrationOrdering.ts
#   oczekiwane: string wystepuje w tablicy `PROMOTED_LEGACY_PRODUCERS`

# (2) TEZA: rejestr 310/319 mimo to oznacza 073_conversations.sql jako MIGRACJA_POMIJANA (klasyfikacja bledna)
grep -rn "073_conversations" docs/program/waves/WAVE_03_ACCEPTANCE/*.md docs/program/waves/WAVE_03_ACCEPTANCE/codex/*.md 2>/dev/null | grep -i "pomijan\|MIGRACJA_POMIJANA"
#   oczekiwane: co najmniej jeden wiersz oznaczajacy ten plik jako pomijany — TO JEST BLAD do naprawy w R2

# (3) TEZA: slack_router_dedupe powstaje WYLACZNIE w locie, jedyna migracja jest warunkowa
grep -n "slack_router_dedupe" server/src/services/slack/slackRouter.ts
grep -rln "slack_router_dedupe" server/migrations/
grep -n "to_regclass" server/migrations/20261670_p2_runtime_schema_repairs.sql
#   oczekiwane: CREATE TABLE w slackRouter.ts linia 147; JEDNA migracja wspomina nazwe, warunkowo (`IF to_regclass(...) IS NOT NULL`) — na pustej bazie NIC nie tworzy

# (4) TEZA: noRuntimeDdl.test.ts pomija katalogi __tests__ BEZWARUNKOWO, bez wiersza uzasadnienia
grep -n "__tests__" tests/unit/backend/schema/noRuntimeDdl.test.ts
#   oczekiwane: `if (file.includes('/__tests__/')) continue;` — brak towarzyszacego komentarza z lista uzasadnien per plik

# (5) TEZA: 24 pliki __tests__ w server/src maja DDL
find server/src -path "*__tests__*" -name "*.ts" | xargs grep -l "CREATE TABLE IF NOT EXISTS" 2>/dev/null | wc -l
#   oczekiwane: 24

# (6) TEZA: najwyzszy istniejacy numer migracji jest ponizej 20262000 (Twoj przedzial jest wolny)
ls server/migrations/*.sql | grep -oE '2026[0-9]{4,}' | sort -n | tail -3
#   oczekiwane: najwyzszy < 20262000

# (7) TEZA: kontener pusty startuje i przechodzi migracje bez bledu, drugi przebieg 0 zmian
docker run -d --name cx-day333-pg -p 6359:5432 -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx333 pgvector/pgvector:pg16
sleep 5
cd server && RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgres://postgres:cx@127.0.0.1:6359/cx333 npx tsx scripts/migrate.postgres.ts 2>&1 | tail -20
#   oczekiwane: konczy sie sukcesem, licz tabele i migracje w kroku R1

# (8) TEZA: POST /api/auth/register zwraca 200 na bazie zbudowanej WYLACZNIE z migracji (teza obalona z dyzuru 319 — potwierdz ponownie na SWOJEJ bazie)
# wykonaj po starcie ApiGateway na porcie 5499 z powyzsza baza — patrz R4

# (9) dysk, porty, kontener
df -h /
lsof -nP -iTCP:6359 -sTCP:LISTEN; lsof -nP -iTCP:5499 -sTCP:LISTEN; docker ps --format '{{.Names}}' | grep -c cx-day333 || true
#   oczekiwane: powyzej 5 GB wolnego dysku; oba porty puste PRZED krokiem (7); 0 kontenerow wczesniej

# (10) sprzatanie po pomiarze wstepnym (7)-(8), jesli robiles je juz w §0.1
docker rm -f cx-day333-pg 2>/dev/null || true
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day333-schemat-domkniecie-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6359`. Twój JEDYNY port harnessu to `5499`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day333-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000, 5037, 5060-5061, 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta: 5432, 5433, 6012, 6379. Rodzeństwo paczki 04.09: 330 (6356/5496), 331 (6357/5497), 332 (6358/5498) — nie dotykasz. ★ ZAKAZ `pkill`/`killall``. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `Brak. Ten dyżur nie dodaje żadnej flagi produktu — jest to praca na klasyfikacji migracji i bezpieczniku schematu`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`. **ZAKAZ zmiany predykatu pomijania plików w `server/scripts/migrate.postgres.ts`** — tylko klasyfikacja/dokumentacja, nie zasada`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY333_SCHEMAT_DOMKNIECIE_REPORT.md`. Dozwolone nowe/zmieniane pliki dokumentacyjne: raport pod `SCIEZKA_RAPORTU`, poprawka klasyfikacji w rejestrze migracji pomijanych z dyżuru 319 (dopisek/korekta wiersza `073_conversations.sql`, nie przepisanie całego rejestru), nowy wiersz uzasadnienia w bezpieczniku dla 24 plików `__tests__`. Kod: `tests/unit/backend/schema/noRuntimeDdl.test.ts` (dodanie listy uzasadnień, nie zmiana zasady pomijania), ewentualna NOWA migracja addytywna w przedziale `20262020`-`20262039` WYŁĄCZNIE jeśli R3 uzna to za konieczne dla `slack_router_dedupe`. Nowe pliki w `tests/` wymagają `git add -f`. **ZAKAZ edycji `MODULE_ACCEPTANCE.md`**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day333-schemat-domkniecie-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day333-schemat-domkniecie-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ zmiany predykatu pomijania plików w `server/scripts/migrate.postgres.ts`** — to rozstrzyga, co dostaje każde środowisko; brakujące pokrycie robisz NOWĄ migracją addytywną w swoim przedziale, nigdy odblokowaniem pominiętego pliku. **ZAKAZ edycji `000_z_core_baseline.sql`, `000_initdb_*.sql` i katalogu `never-ran/`.** **ZAKAZ migracji nieaddytywnych** — żadnego `DROP`, `ALTER ... TYPE`, zmiany klucza głównego, usuwania kolumn. **ZAKAZ rozszerzania listy wyjątków bezpiecznika `noRuntimeDdl.test.ts` bez wiersza w raporcie** (plik · liczba · dlaczego · kto weźmie); listę wolno wyłącznie skracać w kolejnych dyżurach, nie wydłużać bez uzasadnienia. **ZAKAZ usuwania DDL w locie (`slack_router_dedupe` i inne) bez dowodu z `information_schema`, że tabela powstaje też z migracji.** **ZAKAZ mieszania w jednym commicie korekty klasyfikacji ze zmianą logiki biznesowej.** **ZAKAZ przepisywania tezy „na świeżej bazie nikt się nie zarejestruje” z powrotem do obiegu** — jest OBALONA, potwierdź to na swojej bazie zamiast zakładać. **ZAKAZ `git stash`, `pkill`, `killall`, `--no-verify`. ZAKAZ dotykania demo, stagingu, produkcji.** | Bramka wymaga, żeby odtworzenie systemu po awarii opierało się na łańcuchu migracji, nie na DDL rozsianym po serwisach. Rejestr klasyfikacji migracji pomijanych jest źródłem, z którego program wyprowadza wszystkie dalsze liczby o pokryciu schematu — jeśli klasyfikacja jednego wiersza jest zrobiona z predykatu w kodzie zamiast z żywej bazy, każda liczba pochodna (22/93, procent pokrycia) jest zawyżona albo zaniżona bez wiedzy czytelnika. Fałszywe zdanie „B−A jest puste” w raporcie 319 ukrywa realny, nieodkryty dług: 27 tabel istniejących na czystej bazie wyłącznie dzięki DDL w locie, gotowych zgasić się cicho w dniu, w którym ktoś usunie ten kod bez dopisania migracji |

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
cd /private/tmp/cx-day333-schemat-domkniecie

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day333-pg psql -U postgres -d cx333 \
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
cd /private/tmp/cx-day333-schemat-domkniecie

docker run -d --name cx-day333-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx333 \
  -p 127.0.0.1:6359:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day333-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6359/cx333 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6359/cx333 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day333-schemat-domkniecie && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6359/cx333 \
JWT_SECRET=cx333-test-secret-do-not-reuse \
npx vitest run `npx tsx server/scripts/migrate.postgres.ts` z `DATABASE_URL=postgres://postgres:cx@127.0.0.1:6359/cx333` na PUSTYM kontenerze `pgvector/pgvector:pg16` — DWA przebiegi, drugi musi dać `0` zastosowanych migracji; `npx vitest run tests/unit/backend/schema/noRuntimeDdl.test.ts --retry=0` z cwd roota; dowód mutacyjny obowiązkowy dla bezpiecznika (mutacja POZA `server/src/services/`, w pliku spoza listy wyjątków, np. w `controllers/`); dowód `Z21`/`Z22`/`Z34` dla `POST /api/auth/register` przez realny `ApiGateway.getInstance().initializeRoutes(app)` na bazie zbudowanej wyłącznie z migracji, z zapisanym kodem odpowiedzi --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day333-schemat-domkniecie-artefakty/day333-schemat-domkniecie.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day333-schemat-domkniecie && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run `npx tsx server/scripts/migrate.postgres.ts` z `DATABASE_URL=postgres://postgres:cx@127.0.0.1:6359/cx333` na PUSTYM kontenerze `pgvector/pgvector:pg16` — DWA przebiegi, drugi musi dać `0` zastosowanych migracji; `npx vitest run tests/unit/backend/schema/noRuntimeDdl.test.ts --retry=0` z cwd roota; dowód mutacyjny obowiązkowy dla bezpiecznika (mutacja POZA `server/src/services/`, w pliku spoza listy wyjątków, np. w `controllers/`); dowód `Z21`/`Z22`/`Z34` dla `POST /api/auth/register` przez realny `ApiGateway.getInstance().initializeRoutes(app)` na bazie zbudowanej wyłącznie z migracji, z zapisanym kodem odpowiedzi --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day333-schemat-domkniecie-artefakty/day333-schemat-domkniecie.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day333-schemat-domkniecie/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day333-pg psql -U postgres -d cx333 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day333-pg`.
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
> **(e) ★★★ **CZTERY PUŁAPKI.** (1) `grep` po numerze pliku kłamie o tym, czy runner go uruchamia — `PROMOTED_LEGACY_PRODUCERS` odwraca blankietowe wykluczenie `< 500` dla konkretnych, imiennie wymienionych plików; klasyfikację `MIGRACJA_POMIJANA`/`BRAK_MIGRACJI` rób WYŁĄCZNIE pomiarem na żywej bazie (`information_schema.tables` PRZED i PO przebiegu), nigdy z samego predykatu w kodzie. (2) DDL w locie bywa WARUNKOWY w migracji, która go "pokrywa" — migracja `20261670_p2_runtime_schema_repairs.sql` wspomina `slack_router_dedupe`, ale wyłącznie wewnątrz `IF to_regclass(...) IS NOT NULL`, czyli na czystej bazie nic nie robi; sam fakt, że nazwa tabeli WYSTĘPUJE w pliku migracji, nie dowodzi że migracja ją TWORZY. (3) `noRuntimeDdl.test.ts` pomija CAŁY katalog `__tests__` jedną linią (`if (file.includes('/__tests__/')) continue;`) — to jest wygodne dla testów fixture, ale ukrywa 24 pliki bez JAKIEGOKOLWIEK wiersza uzasadnienia; Twoim zadaniem nie jest usunięcie wyjątku (zepsułoby setki testów), tylko udokumentowanie GO per plik. (4) Migracja przyrostowa nie jest dowodem — łańcuch musi przechodzić OD ZERA, alfabetycznie, na bazie bez ani jednej tabeli, DWA przebiegi (drugi bez zmian); obraz `postgres:15` NIE PRZECHODZI (brak `vector`), obowiązkowy `pgvector/pgvector:pg16`**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day333-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day333-schemat-domkniecie-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (przeczytaj rejestr 310/319 i instrukcję 319 w całości, zbuduj pustą bazę na porcie 6359, dwa przebiegi migracji, policz tabele przez `information_schema`) · R1 = pomiar B: uruchom `ApiGateway` na tej bazie, wykonaj realny `POST /api/auth/register` + zestaw operacji dotykających schematu w locie, policz tabele PO — potwierdź lub obal `1914→1915` własnym pomiarem · R2 = naprawa klasyfikacji `073_conversations.sql` z `MIGRACJA_POMIJANA` na `PROMOWANA_URUCHAMIANA` (albo właściwą nazwę statusu), z dowodem `information_schema` PRZED/PO na czystej bazie z tą jedną migracją · R3 = `slack_router_dedupe`: potwierdź mutacyjnie że jedyna migracja wspominająca tabelę jest no-op na czystej bazie, zdecyduj (nowa migracja addytywna w przedziale `20262020`-`20262039` ALBO dokumentacja długu jako zaakceptowane wyjątki) — NIE usuwaj DDL w locie bez migracji zastępczej · R4 = 24 pliki `__tests__` z DDL: zbuduj listę z uzasadnieniem per plik (fixture izolowany / test integracyjny z własną bazą efemeryczną / inne), dopisz do bezpiecznika jako udokumentowany wyjątek, nie milczący · R5 (raport zbiorczy z poprawionymi liczbami R−A/R−B, klasyfikacją 073_conversations, decyzją o slack_router_dedupe, listą 24 uzasadnień)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6359` albo `5499` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6359` albo `5499`** (`Z7`).

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

Dyżur 310 postawił bezpiecznik przeciw DDL tworzonemu w locie (`noRuntimeDdl.test.ts`) i naprawił
mutację, która przechodziła w `AssessmentController.ts`. Dyżur 319 (scalony) rozszerzył zakres
bezpiecznika z samego `server/src/services/` na całe `server/src`, zmierzył mianownik na PUSTEJ
bazie przez `information_schema` (nie parserem, nie grepem), dołożył 7 tabel + kolumnę
`llm_providers.markup_multiplier` i obalił krążącą tezę „na świeżej bazie nikt się nie
zarejestruje" — realny `POST /api/auth/register` przez `ApiGateway` zwrócił `200`.

Odbiór adwersaryjny (04.09), powtarzając pomiar 319 na bazie zbudowanej OD ZERA (893 migracje,
1914 tabel wg łańcucha migracji, drugi przebieg `Applying migrations: 0` — łańcuch jest
deterministyczny), znalazł trzy rzeczy, których dyżur 319 nie domknął:

**1. `§R6 „B−A jest puste”` jest FAŁSZEM.** Po realnym przebiegu przez `ApiGateway` (nie samym
uruchomieniu migracji) baza urosła `1914 → 1915`. Nadmiarowa tabela: `slack_router_dedupe`,
tworzona WYŁĄCZNIE w locie przez `CREATE TABLE IF NOT EXISTS slack_router_dedupe (...)` w
`server/src/services/slack/slackRouter.ts:147`. Jedyna migracja, która w ogóle wspomina tę nazwę
(`20261670_p2_runtime_schema_repairs.sql`), robi to wewnątrz `IF to_regclass('public.
slack_router_dedupe') IS NOT NULL THEN ALTER TABLE ...` — czyli na CZYSTEJ bazie, gdzie tabela
jeszcze nie istnieje, ten blok **nic nie robi**. To nie jest regresja produktu (plik jest na
liście wyjątków bezpiecznika), ale jest nieodkrytą pozycją długu i fałszywym zdaniem w raporcie
319, które twierdziło coś przeciwnego.

**2. `§R5 „22 z 93”` — realnie 21.** `073_conversations.sql` jest oznaczony w rejestrze 310/319
jako `MIGRACJA_POMIJANA`, ale **runner GO URUCHAMIA** — plik jest imiennie wymieniony w
`PROMOTED_LEGACY_PRODUCERS` (`server/scripts/migrationOrdering.ts`, komentarz cytuje powód: „Sole
producer of `conversations` / `conversation_messages`... Already Postgres-compatible... no
conflict with baseline"), co odwraca blankietowe wykluczenie „numer < 500" specjalnie dla tego
pliku. Klasyfikację zrobiono **z predykatu w kodzie** (sam numer pliku sugeruje pominięcie)
zamiast z żywej bazy (`information_schema` PRZED i PO przebiegu z tą jedną migracją) — dokładnie
tą metodą, którą sama instrukcja 319 piętnowała jako błąd do unikania. Popraw klasyfikację
pomiarem, nie przeczytaniem kodu na pierwszy rzut oka.

**3. 24 pliki `__tests__` z DDL w `server/src` są pomijane bez wiersza uzasadniającego.**
`noRuntimeDdl.test.ts` ma linię `if (file.includes('/__tests__/')) continue;` — bezwarunkowe
pominięcie całego katalogu. To jest wygodne (testy fixture legalnie tworzą własne tabele
efemeryczne), ale dziś nikt nie sprawdził KTÓRE 24 pliki korzystają z tego wyjątku i CZY każdy
z nich rzeczywiście powinien. Zadanie tego dyżuru to rozstrzygnięcie tych 24 plików, nie zmiana
samego wzorca pomijania (to osobne zadanie, przypisane dyżurowi 327).

**Sprostowanie, którego nie wolno cofnąć.** Teza „na świeżej bazie nikt się nie zarejestruje" jest
**OBALONA** — `POST /api/auth/register` przez realny `ApiGateway` zwraca **200** na bazie
zbudowanej wyłącznie z migracji. Realne ryzyko jest węższe i inne: **27 tabel** istnieją na
czystej bazie wyłącznie dzięki DDL w locie i zapalą się dopiero, gdy ktoś usunie ten kod bez
dopisania migracji zastępczej. Nie buduj tego dyżuru na przekonaniu, że rejestracja jest zepsuta
— potwierdź obalenie na swojej własnej bazie i idź dalej.

## ★ Zmierz moje liczby sam

Twierdzę: `073_conversations.sql` jest w `PROMOTED_LEGACY_PRODUCERS`; rejestr mimo to niesie go
jako `MIGRACJA_POMIJANA`; `slack_router_dedupe` powstaje wyłącznie w `slackRouter.ts:147`, jedyna
migracja wspominająca nazwę jest warunkowa i no-op na czystej bazie; `noRuntimeDdl.test.ts` pomija
`__tests__` bezwarunkowo; 24 pliki `__tests__` w `server/src` mają `CREATE TABLE IF NOT EXISTS`;
najwyższy istniejący numer migracji jest poniżej `20262000`. **Jeśli Twój pomiar przeczy liczbie
podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz rozbieżność wprost**, w szczególności
liczbę tabel PRZED/PO przebiegu przez `ApiGateway` — Twoja własna baza może urosnąć inaczej niż
`1914→1915`, jeśli inne DDL-w-locie też się uruchomią w Twoim scenariuszu testowym.

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz,
> jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi«
> jest NIEZASADNY**. Jeżeli pliku nie ma w tabeli w ogóle — domyślnie jest **TYLKO DO ODCZYTU**,
> a Twoim produktem jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- |
| Rejestr klasyfikacji migracji pomijanych z dyżuru 310/319 (dokładna ścieżka do potwierdzenia w R0) | **★ WĄSKA LICENCJA: wyłącznie korekta wiersza `073_conversations.sql`** (status `MIGRACJA_POMIJANA` → poprawny, z dowodem `information_schema`). **ZAKAZ** zmiany innych wierszy bez analogicznego dowodu | — |
| `tests/unit/backend/schema/noRuntimeDdl.test.ts` | **★ WĄSKA LICENCJA: wyłącznie dodanie listy uzasadnień per plik dla wyjątku `__tests__`** (komentarz albo struktura danych z 24 wpisami: plik · powód). **ZAKAZ zmiany linii `if (file.includes('/__tests__/')) continue;`** — sam wzorzec pomijania jest zadaniem dyżuru 327 | Czerwony kontrakt + brief |
| `server/scripts/migrate.postgres.ts`, `server/scripts/migrationOrdering.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE**, `Z40` | Produktem jest opis w raporcie + ewentualna NOWA migracja addytywna, nigdy zmiana predykatu |
| `server/migrations/2026202[0-9]*.sql`, `server/migrations/2026203[0-9]*.sql` (**NOWE**) | **★ PEŁNA LICENCJA, wyłącznie addytywne**, przedział `20262020`–`20262039`, WYŁĄCZNIE jeśli R3 uzna nową migrację za konieczną dla `slack_router_dedupe` | — |
| `server/src/services/slack/slackRouter.ts` | **TYLKO ODCZYT** — DDL w locie zostaje, dopóki nie ma migracji zastępczej pokrywającej wszystkie środowiska | Wpis w raporcie z dowodem `information_schema`, nie usuwasz kodu |
| `tests/unit/backend/security/**`, `**/*.pg.test.ts` (NOWE) | **★ PEŁNA LICENCJA**, `Z18`/`Z31` | — |
| `000_z_core_baseline.sql`, `000_initdb_*.sql`, katalog `never-ran/` | **TYLKO ODCZYT — BEZWZGLĘDNIE**, `Z40` | Errata w raporcie |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie, jak obszedłeś to zmiennymi w linii komendy |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY333_SCHEMAT_DOMKNIECIE_REPORT.md` | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI Z DEFINICJĄ UKOŃCZENIA PER POZYCJA

| Pozycja | Nazwa jednym zdaniem | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R0 | Baza od zera + pomiar A | TAK | NIE | bazowe | Kontener pusty, dwa przebiegi migracji (drugi 0 zmian), liczba tabel A zmierzona przez `information_schema` | `npx tsx server/scripts/migrate.postgres.ts` ×2 | brak |
| R1 | Pomiar B przez `ApiGateway` | TAK | NIE — dowód: `Z12` nie chroni tego pomiaru | bazowe | `POST /api/auth/register` zwraca `200`; liczba tabel B zmierzona PO serii operacji produktowych; różnica B−A policzona i opisana z nazwami tabel | realny `curl`/`fetch` przez `ApiGateway.getInstance().initializeRoutes(app)`, zapisany kod odpowiedzi | `docs(day333): pomiar A/B na bazie od zera (333 R1)` |
| R2 | Naprawa klasyfikacji `073_conversations.sql` | TAK | NIE — dowód: wiersz `B.1` daje wąską licencję | 1 dowód `information_schema` | Status w rejestrze zmieniony z `MIGRACJA_POMIJANA` na poprawny (np. `PROMOWANA_URUCHAMIANA`), z dowodem że tabela `conversations` istnieje PO przebiegu z tą migracją | `SELECT to_regclass('public.conversations')` PRZED/PO | `fix(schema): koryguje klasyfikacje 073_conversations — PROMOTED_LEGACY_PRODUCERS (333 R2)` |
| R3 | `slack_router_dedupe` — decyzja i dokumentacja | TAK | NIE | 1 dowód mutacyjny (no-op migracji) | Potwierdzone mutacyjnie, że istniejąca migracja nic nie robi na czystej bazie; decyzja zapisana: nowa migracja addytywna ALBO udokumentowany dług z uzasadnieniem, dlaczego zostaje jako DDL w locie | `information_schema.tables` PRZED/PO migracji `20261670` na pustej bazie | `docs(schema): slack_router_dedupe — no-op na czystej bazie, decyzja (333 R3)` (+ ewentualny `feat` z nową migracją) |
| R4 | 24 pliki `__tests__` z DDL — uzasadnienie | TAK | NIE | 24 wiersze uzasadnienia | Każdy z 24 plików ma wiersz: plik · powód (fixture izolowany / integracyjny z własną efemeryczną bazą / inne) w bezpieczniku albo towarzyszącym rejestrze | `find server/src -path "*__tests__*" -name "*.ts" \| xargs grep -l "CREATE TABLE IF NOT EXISTS"` → 24, każdy z wierszem | `docs(schema): uzasadnienie 24 wyjatkow __tests__ w noRuntimeDdl (333 R4)` |
| R5 | Raport | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" niepusta | — | `docs(day333): raport` |

> Kolumna „Wymaga plików przekrojowych?" — NIE dla wszystkich pozycji, dowód w każdym wierszu.

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Migracje w łańcuchu (od zera) | 893 (pomiar 319, zweryfikuj swój) | `ls server/migrations/*.sql \| wc -l` (przybliżenie — realna liczba z logu runnera) | TAK |
| 2 | Tabele PRZED (`A`, tylko migracje) | 1914 (pomiar 319/odbiorcy) | `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'` po samych migracjach | TAK — zmierz swoją |
| 3 | Tabele PO (`B`, po przebiegu `ApiGateway`) | 1915 (odbiór adwersaryjny 04.09) | jw., po serii operacji produktowych przez realny `ApiGateway` | TAK — zmierz swoją, może się różnić od scenariusza operacji |
| 4 | Unikalne pliki cytowane jako „Migracja" w rejestrze 310, faktycznie pomijane przez runner | 22 wg 319, **21 wg odbiorcy** (073_conversations.sql jest promowany) | `grep -n PROMOTED_LEGACY_PRODUCERS server/scripts/migrationOrdering.ts` skrzyżowane z listą rejestru | **TAK — sprawdź to osobno, to jest najczęstszy błąd (CZĘŚĆ D szkieletu, błąd 2)** |
| 5 | Pliki `__tests__` w `server/src` z `CREATE TABLE IF NOT EXISTS` | 24 | `find server/src -path "*__tests__*" -name "*.ts" \| xargs grep -l "CREATE TABLE IF NOT EXISTS" \| wc -l` | TAK |
| 6 | Tabele istniejące na czystej bazie wyłącznie dzięki DDL w locie | 27 (pomiar 319) | do potwierdzenia niezależnie w R1, metoda: różnica `information_schema` PRZED/PO minus tabele wprowadzone przez Twoje własne operacje testowe | Częściowo — zmierz swój zestaw operacji, licz ostrożnie |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | Rejestr klasyfikacji migracji 310/319 (wiersz `073_conversations.sql`) | istniejący | R2 | ŚREDNIE — plik współdzielony z dyżurem 327 (inny aspekt), koryguj WYŁĄCZNIE ten jeden wiersz |
| 2 | `tests/unit/backend/schema/noRuntimeDdl.test.ts` (wąsko, lista uzasadnień) | istniejący | R4 | ŚREDNIE — dyżur 327 też go dotyka od strony wzorca; Ty dotykasz WYŁĄCZNIE listy uzasadnień, nie wzorca pomijania |
| 3 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY333_SCHEMAT_DOMKNIECIE_REPORT.md` | NOWY | R5 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `server/migrations/20262020-20262039` (NOWE) | R3 | Tylko jeśli decyzja R3 wybiera „nowa migracja addytywna" zamiast „udokumentowany dług" dla `slack_router_dedupe` |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
server/scripts/migrate.postgres.ts, server/scripts/migrationOrdering.ts — predykat pomijania, ZAKAZ zmiany (Z40)
src/components/Interview/** — dyżur 330
src/components/MyWork/**, server/src/services/report/** — dyżur 331
scripts/dev/testy-puste-skan.mjs, tests/unit/config/noEmptyAssertions.test.ts — dyżur 332
Wzorzec pomijania __tests__ w noRuntimeDdl.test.ts (sama linia continue) — dyżur 327
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone (komenda + wynik) |
| --- | --- | --- |
| Port PostgreSQL | 6359 | `lsof -nP -iTCP:6359 -sTCP:LISTEN` → puste |
| Port harnessu | 5499 | `lsof -nP -iTCP:5499 -sTCP:LISTEN` → puste |
| Nazwa kontenera | `cx-day333-pg` | `docker ps` → brak |
| Nazwa bazy | `cx333` | n/d |
| Przedział migracji | `20262020`–`20262039` | `ls server/migrations/ \| grep -cE '^202620(2[0-9]\|3[0-9])'` → 0 |
| Gałąź | `codex/day333-schemat-domkniecie-20260904` | nie istnieje |
| Worktree | `/private/tmp/cx-day333-schemat-domkniecie` | nie istnieje |
| Flagi funkcyjne | brak | n/d |

### B.4.5. Kontrola przed KAŻDYM commitem (wklej do instrukcji)

```bash
cd /private/tmp/cx-day333-schemat-domkniecie
git diff --name-only --cached | tee /private/tmp/cx-day333-schemat-domkniecie-artefakty/staged.txt
grep -iE 'migrate\.postgres\.ts$|migrationOrdering\.ts$|Interview/|MyWork/|services/report/|testy-puste-skan' /private/tmp/cx-day333-schemat-domkniecie-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — BAZA OD ZERA + POMIAR A

Uruchom `pgvector/pgvector:pg16` na porcie 6359, kompletnie pustą bazę `cx333`. Przepuść PEŁNY
łańcuch migracji (`npx tsx server/scripts/migrate.postgres.ts` z pełnym env w tej samej linii).
Drugi przebieg MUSI dać `0` zastosowanych migracji (dowód determinizmu). Policz tabele przez
`information_schema.tables` — to jest Twoja liczba `A`. Zapisz pełną listę nazw tabel do
artefaktów (`a-tabele.txt`), nie tylko liczbę.

Prawo zatrzymania po tej pozycji.

## R1 — POMIAR B PRZEZ REALNY `ApiGateway`

Uruchom serwer z `ApiGateway.getInstance().initializeRoutes(app)` na tej samej bazie. Wykonaj
realny `POST /api/auth/register` z realnym ciałem — zapisz kod odpowiedzi (musi być `200`,
potwierdzając obalenie tezy o niedziałającej rejestracji). Wykonaj rozsądny zestaw dalszych
operacji dotykających znanych miejsc DDL-w-locie (co najmniej: cokolwiek uruchamiające
`slackRouter.ts`, jeśli masz do tego bezpieczny sposób bez realnego Slacka — w przeciwnym razie
zanotuj, że tej ścieżki nie wywołałeś i dlaczego). Policz tabele ponownie — to jest `B`. Policz
`B − A` z nazwami (nie tylko liczbą): każda nowa tabela dostaje wiersz w raporcie z odpowiedzią
na pytanie „skąd się wzięła" (DDL w locie w którym pliku:linii, albo migracja, której nie
uruchomiłeś w R0).

Prawo zatrzymania po tej pozycji.

## R2 — NAPRAWA KLASYFIKACJI `073_conversations.sql`

Potwierdź na SWOJEJ bazie: `SELECT to_regclass('public.conversations')` PRZED przebiegiem R0 z
migracją `073_conversations.sql` usuniętą z łańcucha (kopia testowa poza repo, nie modyfikujesz
prawdziwego katalogu migracji) daje `NULL`; z migracją na miejscu — daje nazwę tabeli. To dowodzi,
że runner FAKTYCZNIE ją uruchamia (zgodnie z wpisem w `PROMOTED_LEGACY_PRODUCERS`). Znajdź
dokładny rejestr/dokument z dyżuru 310/319, który klasyfikuje ten plik jako `MIGRACJA_POMIJANA`,
i popraw WYŁĄCZNIE ten wiersz na poprawny status, z komentarzem cytującym dowód i przyczynę błędu
(klasyfikacja z predykatu numeru pliku, nie z żywej bazy).

Commit po R2.

## R3 — `slack_router_dedupe`: DECYZJA I DOKUMENTACJA

Zweryfikuj mutacyjnie: na czystej bazie (tylko migracje, bez `ApiGateway`) sprawdź
`to_regclass('public.slack_router_dedupe')` → oczekiwane `NULL` (migracja `20261670` nie tworzy
tabeli, bo warunek `IF to_regclass(...) IS NOT NULL` jest fałszywy na pustej bazie). Zdecyduj: (a)
napisz NOWĄ migrację addytywną w przedziale `20262020`-`20262039`, która tworzy
`slack_router_dedupe` bezwarunkowo (`CREATE TABLE IF NOT EXISTS`, bez `to_regclass`), i usuń DDL
w locie z `slackRouter.ts` DOPIERO PO potwierdzeniu, że migracja działa na czystej bazie; ALBO
(b) udokumentuj w raporcie jako świadomie zaakceptowany dług (tabela pomocnicza dla dedupe,
niska stawka, DDL w locie zostaje). Wybierz (a) jeśli koszt jest niski (jedna prosta tabela) —
zamyka realny dług, nie tylko go opisuje.

Commit po R3.

## R4 — 24 PLIKI `__tests__` Z DDL: UZASADNIENIE

Wylistuj wszystkie 24 pliki (`find server/src -path "*__tests__*" -name "*.ts" | xargs grep -l
"CREATE TABLE IF NOT EXISTS"`). Dla każdego: otwórz, ustal czy tworzy tabelę w IZOLOWANEJ,
efemerycznej bazie testowej (legalne — nie dotyczy runtime produkcyjnego) czy coś innego. Zapisz
wiersz: plik · linia · powód pominięcia · czy legalny. Dopisz tę listę jako komentarz/strukturę
w `noRuntimeDdl.test.ts` obok linii pomijającej `__tests__`, żeby przyszły czytelnik widział
DLACZEGO wyjątek istnieje, nie tylko ŻE istnieje. Jeśli znajdziesz plik, który tworzy tabelę
runtime pod pozorem testu (nielegalny wyjątek) — opisz go osobno jako `DO DECYZJI WŁAŚCICIELA`,
nie usuwaj bez zgody (mogłoby zepsuć testy).

Commit po R4.

## R5 — RAPORT

Tabela A/B z nazwami tabel i przyczyną każdej różnicy. Poprawiona klasyfikacja `073_conversations.
sql` z dowodem. Decyzja o `slack_router_dedupe` (migracja albo udokumentowany dług) z dowodem
mutacyjnym no-op. Lista 24 uzasadnień. TWIERDZENIA NIEZWERYFIKOWANE — w szczególności jeśli nie
zdążyłeś wywołać ścieżki Slack w R1, zapisz to jawnie zamiast milczeć.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R0-R2 domknięte, R3 zmierzone bez naprawy (wybrałem
udokumentowanie długu, nie migrację), R4 połowicznie (12 z 24 plików)" jest pełnowartościowym
wynikiem. Fałszywe zdanie „różnica jest pusta" w raporcie kosztuje więcej niż przyznanie się do
27 tabel DDL-w-locie.
