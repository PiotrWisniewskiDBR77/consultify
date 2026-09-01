# INSTRUKCJA DYŻURU nr 254 — Codex — „★★ TRZY IMIENNIE ZMIERZONE SPRZECZNOŚCI DOKUMENTACJI OPERACYJNEJ Z KODEM, JEDNA JUŻ NAZWANA „SZÓSTYM KŁAMIĄCYM DOKUMENTEM”: `docs/program/funkcje/ZNALEZISKO_MARTWY_KATALOG_MIGRACJI.md` (kanoniczny, `established: 2026-09-01`) ZMIERZYŁO, że `server/migrations/README.md` (linie 1-5: „DEPRECATED - Migrations moved. New migrations live in `server/migrations-v2/`.”) kieruje KAŻDEGO czytelnika do katalogu wykluczonego z wdrożenia przez `.railwayignore` (`/server/migrations-v2/` i `/server/migrations-v2/**`) — „nowa migracja napisana zgodnie z tą instrukcją nie zadziałałaby nigdzie... i nie byłoby żadnego błędu; po prostu nic by się nie stało” — TEN DOKUMENT ZAPROPONOWAŁ NAPRAWĘ ("Usunąć albo poprawić oba README — to zmiana na kilka minut"), ALE NAPRAWA WCIĄŻ NIE JEST WYKONANA na Twoim markerze (zweryfikuj `R1`). Drugi cel: `AUDYT_RODZINY_TRAS_UPRAWNIENIA.md` liczy dziury IDOR DWA razy inaczej w TYM SAMYM dokumencie — pierwsze zdanie (linia 18) „Cztery potwierdzone jako żywe... dwie... wygaszone”, a sekcja „PUŁAPKA: kod dziurawy ≠ trasa żywa na demo” (linie 84-92) wylicza IMIENNIE dokładnie TRZY montowane bezwarunkowo (#1 PMO Project Members, #2 Studio, #3 Escalations) i TRZY gated (#4 Permission Requests → 404, #5 Videos → 404, #6 AI Context → 501) — czyli 3+3, nie 4+2. Trzeci cel: przy przygotowaniu tej instrukcji znaleziono JESZCZE JEDEN, obecnie żywy kłamiący komentarz w `server/src/routes/caseWorkspace/runLifecycle.routes.ts:5-10` ("NOT MOUNTED YET... wiring it into `server/src/routes/caseWorkspace/index.ts` is explicitly OPUS's job") — plik JEST zamontowany (`caseWorkspace/index.ts:36` import, `:60` `router.use`), zweryfikowane bezpośrednio, kontrastujące z SĄSIEDNIM plikiem tego samego katalogu (`eventInbox.routes.ts:15-25`, komentarz „WHY THIS FILE IS NOT MOUNTED THROUGH caseWorkspace/index.ts” — TEN jest PRAWDZIWY, bo plik jest montowany OSOBNO, bezpośrednio w `Gateway.ts:103`, z jawnym, poprawnym wyjaśnieniem dlaczego)."

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
> **wyłącznie** `/private/tmp/cx-day254-sprzecznosci-rejestru`.

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
Zakres: ****Sprzeczności w rejestrze i dokumentacji operacyjnej — trzy imiennie zmierzone rodziny, plus bounded sweep na czwartą.** (1) `server/migrations/README.md` I `server/migrations-archive/README.md` kierują do `server/migrations-v2/`, katalogu wykluczonego z wdrożenia (`.railwayignore:96-97` — sprawdź realny numer linii u siebie) i NIE będącego domyślnym katalogiem realnego runnera migracji (`server/scripts/migrate.postgres.ts:816` domyślnie czyta `server/migrations`). (2) `docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md` ma wewnętrzną sprzeczność liczbową: pierwsze zdanie „4 żywe, 2 wygaszone” (linie 18-19), sekcja dowodowa „3 żywe + 3 wygaszone” (linie 84-92). (3) Co najmniej jeden POTWIERDZONY dziś żywy kłamiący komentarz — `server/src/routes/caseWorkspace/runLifecycle.routes.ts:5-10` twierdzi „NOT MOUNTED YET... wiring... explicitly OPUS's job”, a plik JEST zamontowany (`caseWorkspace/index.ts:36,60`).**.
Trasy front: `brak w zakresie tego dyżuru — praca wyłącznie w dokumentacji operacyjnej i komentarzach kodu serwera`. Trasy tył: ``server/migrations/README.md` · `server/migrations-archive/README.md` · `server/scripts/migrate.postgres.ts:816` (TYLKO ODCZYT — dowód domyślnego katalogu) · `.railwayignore` (TYLKO ODCZYT — dowód wykluczenia) · `server/src/routes/caseWorkspace/runLifecycle.routes.ts:5-10` (komentarz do poprawy) · `server/src/routes/caseWorkspace/index.ts` (TYLKO ODCZYT — dowód montażu) · `server/src/routes/caseWorkspace/eventInbox.routes.ts` (TYLKO ODCZYT — kontrastowy przykład PRAWDZIWEGO komentarza, nie zmieniasz)`.

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
WT=/private/tmp/cx-day254-sprzecznosci-rejestru
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
git -C "$VAULT" worktree add "$WT" -b codex/day254-sprzecznosci-rejestru-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day254-sprzecznosci-rejestru/config.worktree"
cat "$VAULT/worktrees/cx-day254-sprzecznosci-rejestru/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day254-sprzecznosci-rejestru-scratch
mkdir -p /private/tmp/cx-day254-sprzecznosci-rejestru-artefakty

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
git -C "$WT" push github-backup codex/day254-sprzecznosci-rejestru-20260901
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

# (1) TEZA: oba README migracji kieruja do migrations-v2
cat server/migrations/README.md
cat server/migrations-archive/README.md | head -20
#   oczekiwane: obydwa wspominaja "migrations-v2" jako miejsce dla NOWYCH migracji

# (2) TEZA: migrations-v2 jest wykluczony z wdrozenia Railway
grep -n "migrations-v2" .railwayignore
#   oczekiwane: 1+ trafien

# (3) TEZA: realny runner domyslnie czyta server/migrations, NIE migrations-v2
grep -n "migrationsDir = path.resolve" server/scripts/migrate.postgres.ts
#   oczekiwane: domyslna wartosc to 'server/migrations'

# (4) TEZA: server/migrations/ ma znaczaco wiecej plikow i swiezsze daty niz migrations-v2
ls server/migrations/*.sql | wc -l
ls server/migrations-v2/*.sql | wc -l
ls -lt server/migrations/*.sql | head -3
#   oczekiwane: migrations/ ma >1000 plikow, migrations-v2/ ma <50, najnowsze pliki migrations/ maja dzisiejsza date

# (5) TEZA: AUDYT_RODZINY_TRAS_UPRAWNIENIA.md ma sprzecznosc 4+2 vs 3+3
sed -n '16,21p' docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md
sed -n '84,92p' docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md
#   oczekiwane: pierwsze -> "Cztery potwierdzone... dwie... wygaszone"; drugie -> 3 trasy
#   montowane bezwarunkowo + 3 gated (404/404/501)

# (6) TEZA: runLifecycle.routes.ts twierdzi ze NIE jest zamontowany, ale JEST
sed -n '1,11p' server/src/routes/caseWorkspace/runLifecycle.routes.ts
grep -n "runLifecycle" server/src/routes/caseWorkspace/index.ts
#   oczekiwane: komentarz mowi "NOT MOUNTED YET"; grep pokazuje import (linia ok. 36)
#   i router.use (linia ok. 60)

# (7) TEZA: eventInbox.routes.ts ma PRAWDZIWY (nie klamiacy) komentarz o montazu
grep -n "eventInboxRoutes\|caseWorkspaceEventInboxRoutes" server/src/Gateway.ts
#   oczekiwane: bezposredni import+mount w Gateway.ts (nie przez caseWorkspace/index.ts)

# (8) miejsce na dysku
df -h /
#   oczekiwane: powyzej 5 GB wolnego
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day254-sprzecznosci-rejestru-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6248`. Twój JEDYNY port harnessu to `5228 i 5229`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day254-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6239, 5010-5219, 6404-6411, 6600-6830. Twoje własne: baza 6248, harness 5228 i 5229. Cudze — siostrzane dyżury TEJ SAMEJ paczki, nie dotykasz: baza 6240 i harness 5220-5221 (dyżur 250 Ustawienia AI), baza 6242 i harness 5222-5223 (dyżur 251 Audyty), baza 6244 i harness 5224-5225 (dyżur 252 Przemiatanie), baza 6246 i harness 5226-5227 (dyżur 253 Fałszywe zapisy). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/auth.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts` · `server/src/Gateway.ts` (odczyt WYŁĄCZNIE — dowód montażu, zero zmian)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY254_SPRZECZNOSCI_REJESTRU_REPORT.md`. Jedyny inny dokument, który wolno Ci dotknąć: `docs/program/funkcje/ZNALEZISKO_MARTWY_KATALOG_MIGRACJI.md` — WYŁĄCZNIE nowa sekcja na końcu potwierdzająca, że zadanie 1 z jego listy („usunąć albo poprawić oba README”) zostało wykonane przez ten dyżur, z odniesieniem do commitu. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day254-sprzecznosci-rejestru-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day254-sprzecznosci-rejestru-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ zmiany zachowania kodu** — ten dyżur poprawia WYŁĄCZNIE dokumentację (README, komentarze), nie trasy, nie logikę montażu, nie `mountStub`/`ENABLE_STUB_ROUTES`. **ZAKAZ kasowania katalogu `server/migrations-v2/` ani `server/migrations-archive/`** — decyzja o „rozstrzygnięciu losu katalogu” (zadanie 2 z `ZNALEZISKO_MARTWY_KATALOG_MIGRACJI.md`) jest decyzją produktową o nieodwracalnym skutku (39 plików `-v2`, 636 plików `-archive`), poza licencją tego dyżuru — **poprawiasz README, żeby nie kłamały, NIE usuwasz katalogów, do których się odnoszą; jeśli chcesz zarekomendować usunięcie, piszesz to jako rekomendację w raporcie**. **ZAKAZ zmiany komentarza w `eventInbox.routes.ts`** — jest prawdziwy. **ZAKAZ decydowania, czy 3 żywe dziury IDOR z `AUDYT_RODZINY_TRAS_UPRAWNIENIA.md` są dziś naprawione czy nie** — to teren dyżuru 242 (Uprawnienia), Ty WYŁĄCZNIE korygujesz LICZBY w dokumencie, nie oceniasz stanu naprawy. | ★★ Złota reguła programu (`CLAUDE.md`): „Weryfikuj REALNY runtime, nie docy/flagi. Testy przeszły ≠ działa.” Ten dyżur odwraca tę regułę na SAM REJESTR: dokumentacja operacyjna, która ma pilnować bezpieczeństwa/procesu wdrożenia, sama bywa fałszywa — `docs/program/funkcje/ZNALEZISKO_MARTWY_KATALOG_MIGRACJI.md` nazywa to "szóstym potwierdzonym przypadkiem dokumentu lub komentarza, który kłamie o kodzie — i pierwszym, który mógłby kosztować cały dyżur zmarnowanej pracy bez żadnego sygnału ostrzegawczego" (migracja napisana wg złego README nie daje BŁĘDU — po prostu nigdy się nie wykona). Sprzeczność w audycie uprawnień jest tego samego rodzaju ryzyka z drugiej strony: DWIE liczby w JEDNYM dokumencie, obie wyglądające na autorytatywne, prowadzą do różnych decyzji o tym, ile dziur naprawić najpierw. |

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
cd /private/tmp/cx-day254-sprzecznosci-rejestru

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day254-pg psql -U postgres -d cx254 \
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
cd /private/tmp/cx-day254-sprzecznosci-rejestru

docker run -d --name cx-day254-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx254 \
  -p 127.0.0.1:6248:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day254-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6248/cx254 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6248/cx254 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day254-sprzecznosci-rejestru && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6248/cx254 \
JWT_SECRET=cx254-test-secret-do-not-reuse \
npx vitest run brak nowych plików testowych — praca wyłącznie dokumentacyjna, dowody to grep+odczyt+ewentualny realny przebieg migratora --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day254-sprzecznosci-rejestru-artefakty/day254-sprzecznosci.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day254-sprzecznosci-rejestru && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run brak nowych plików testowych — praca wyłącznie dokumentacyjna, dowody to grep+odczyt+ewentualny realny przebieg migratora --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day254-sprzecznosci-rejestru-artefakty/day254-sprzecznosci.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day254-sprzecznosci-rejestru/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day254-pg psql -U postgres -d cx254 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day254-pg`.
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
> **(e) ★★ NIE ROZSTRZYGAJ SPORU „4+2 vs 3+3” ARBITRALNIE — WYPROWADŹ GO Z DOWODU. Sekcja „PUŁAPKA: kod dziurawy ≠ trasa żywa na demo” (`AUDYT_RODZINY_TRAS_UPRAWNIENIA.md:73-101`) jest bardziej szczegółowa i imiennie wylicza KTÓRE trasy są montowane bezwarunkowo (`app.use(...)` wprost, `Gateway.ts:1159,:1338,:905`) a które gated przez `mountStub()`/`ENABLE_STUB_ROUTES` (`Gateway.ts:485-533`) — to jest źródło PRAWDY, z którego wynika 3+3. Pierwsze zdanie (4+2) jest najprawdopodobniej wcześniejszym szkicem, napisanym PRZED pełną analizą `mountStub`, nigdy nie zaktualizowanym po dopisaniu szczegółowej sekcji — ale **sprawdź to sam** (`git log -p` na ten plik, jeśli historia jest dostępna w Twoim repo/worktree) zamiast zakładać kolejność pisania. Druga pułapka: NIE MYL `runLifecycle.routes.ts` (kłamiący — montowany, komentarz mówi że nie) z `eventInbox.routes.ts` (PRAWDZIWY — montowany OSOBNO w `Gateway.ts:103`, z jawnym wyjaśnieniem architektonicznym „inny mechanizm zaufania niż JWT” — NIE poprawiaj tego drugiego, jego komentarz jest poprawny).**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day254-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day254-sprzecznosci-rejestru-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (KROK 0 — zmierz aktualny stan wszystkich trzech celów: czy README wciąż kłamią, czy sprzeczność 4+2/3+3 wciąż istnieje, czy `runLifecycle.routes.ts` wciąż kłamie) · R2 (popraw oba README migracji — usuń fałszywe skierowanie do `migrations-v2`, wskaż realny katalog `server/migrations/` i realny runner) · R3 (popraw pierwsze zdanie `AUDYT_RODZINY_TRAS_UPRAWNIENIA.md` tak, żeby zgadzało się z sekcją dowodową — 3+3, z dopiskiem wyjaśniającym rozbieżność) · R4 (popraw komentarz `runLifecycle.routes.ts`) · R5 (bounded sweep — poszukaj JESZCZE JEDNEGO żywego kłamiącego komentarza/dokumentu tym samym wzorcem: grep `NOT MOUNTED`/`DEPRECATED`/`TODO.*remove`/`temporary`/`tymczasow` w `server/src/routes/**` i `docs/program/**`, zweryfikuj każde trafienie względem realnego stanu montażu/kodu) · R6 (raport dyżuru)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6248` albo `5228 i 5229` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6248` albo `5228 i 5229`** (`Z7`).

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

`CLAUDE.md`, złota reguła 1: „Weryfikuj REALNY runtime, nie docy/flagi... »Testy
przeszły« ≠ »działa«." Ten dyżur mierzy odwrotny kierunek tego samego ryzyka:
**dokumentacja operacyjna i komentarze w kodzie, które mają ORIENTOWAĆ następnego
wykonawcę, same bywają fałszywe** — a fałsz w tym miejscu jest szczególnie drogi, bo nie
daje żadnego sygnału ostrzegawczego. `docs/program/funkcje/
ZNALEZISKO_MARTWY_KATALOG_MIGRACJI.md` (kanoniczny) nazwał to wprost przy migracjach:
„nowa migracja napisana zgodnie z tą instrukcją nie zadziałałaby nigdzie... i nie byłoby
żadnego błędu; po prostu nic by się nie stało."

Ten dyżur ma trzy imiennie zmierzone cele i jeden bounded sweep na czwarty:

1. **Migracje** — dwa README kierują do katalogu wykluczonego z wdrożenia.
2. **Audyt uprawnień** — jeden dokument liczy dziury IDOR na dwa różne sposoby w sobie
   samym.
3. **Komentarz w kodzie serwera** — `runLifecycle.routes.ts` twierdzi, że nie jest
   zamontowany, będąc zamontowanym.
4. **Sweep** — poszukiwanie kolejnego, jeszcze nieznalezionego przypadku tej samej
   rodziny.

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Oba README migracji kierują do `migrations-v2` | komenda (1) |
| T2 | `migrations-v2` jest wykluczony z wdrożenia Railway | komenda (2) |
| T3 | Realny runner domyślnie czyta `server/migrations`, NIE `migrations-v2` | komenda (3) |
| T4 | `server/migrations/` ma znacząco więcej plików i świeższe daty niż `migrations-v2` | komenda (4) |
| T5 | `AUDYT_RODZINY_TRAS_UPRAWNIENIA.md` ma sprzeczność 4+2 vs 3+3 | komenda (5) |
| T6 | `runLifecycle.routes.ts` twierdzi, że nie jest zamontowany, ale JEST | komenda (6) |
| T7 | `eventInbox.routes.ts` ma PRAWDZIWY (nie kłamiący) komentarz o montażu | komenda (7) |
| T8 | Miejsce na dysku wystarcza | komenda (8) |

---

# 3. POZYCJE DYŻURU

## R1 — KROK 0: ZMIERZ AKTUALNY STAN WSZYSTKICH TRZECH CELÓW (rdzeń, warunek wejścia)

Wykonaj wszystkie 8 komend `§0.1`. Dla KAŻDEGO z trzech celów zapisz w raporcie: czy
sprzeczność WCIĄŻ istnieje na Twoim markerze (oczekiwane: TAK dla wszystkich trzech —
żaden z poprzednich dyżurów tego dnia jej nie naprawił), z pełnym dowodem komend
(1)-(7). **Jeśli KTÓRAKOLWiek okaże się już naprawiona** — zapisz to jako „★★ Korekta
wobec instrukcji" i przejdź do kolejnego celu / do `R5` (sweep) wcześniej, z resztkowym
czasem.

## R2 — POPRAW OBA README MIGRACJI (rdzeń)

`server/migrations/README.md` dziś:
```
# DEPRECATED - Migrations moved

Legacy migrations have been archived to `server/migrations-archive/`.
New migrations live in `server/migrations-v2/`.

See the migration runner at `server/scripts/migrate.postgres.ts`.
```

To jest **podwójnie fałszywe**: (a) `server/migrations/` NIE jest zarchiwizowany —
zawiera >1000 aktywnych plików, z których najnowsze mają dzisiejszą datę (`T4`); (b)
`server/migrations-v2/` jest wykluczony z wdrożenia (`T2`) i NIE jest katalogiem, który
runner domyślnie czyta (`T3` — `migrate.postgres.ts:816`, `args.dir || 'server/
migrations'`).

**Napraw treść na zgodną z rzeczywistością**, np. (dostosuj dokładnie do tego, co
zmierzysz w `R1`):

```
# Migrations — server/migrations/ is the LIVE directory

New migrations go HERE, in `server/migrations/`, using the existing
`YYYYMMDD_description.sql` naming convention (see recent files for examples).
This is the directory the migration runner reads by default
(`server/scripts/migrate.postgres.ts`, `migrationsDir = args.dir || 'server/migrations'`)
and the ONLY migrations directory NOT excluded from the Railway deploy upload
(see `.railwayignore` — `server/migrations-v2/` and `server/migrations-archive/`
ARE excluded; a migration written there will never run anywhere, silently).

`server/migrations-archive/` holds pre-2026-04-13 legacy files, preserved for
git-blame/audit only — never re-run them.

`server/migrations-v2/` is a stalled, largely unused alternative directory
(39 files at last count) — do NOT add new migrations there. Its fate (delete
vs. formally deprecate) is a product decision outside the scope of this note;
see `docs/program/funkcje/ZNALEZISKO_MARTWY_KATALOG_MIGRACJI.md`.
```

Zastosuj analogiczną korektę do `server/migrations-archive/README.md` (dostosuj ton —
ten plik opisuje SIEBIE jako archiwum, poprawna jest tylko część mówiąca „nowe migracje
idą do -v2", którą zmieniasz na „server/migrations/").

**NIE kasujesz katalogów** `migrations-v2`/`migrations-archive` — to poza licencją tego
dyżuru (`ZAKAZ_WLASCIWY_TEMU_DYZUROWI`).

## R3 — POPRAW PIERWSZE ZDANIE `AUDYT_RODZINY_TRAS_UPRAWNIENIA.md` (rdzeń)

Sekcja „PUŁAPKA: kod dziurawy ≠ trasa żywa na demo" (linie 73-101) jest źródłem prawdy —
wylicza IMIENNIE: montowane bezwarunkowo (żywe) = #1 PMO Project Members, #2 Consultify
Studio, #3 Notifications Escalations (`Gateway.ts:1159,:1338,:905`); gated przez
`mountStub()` (dziś nieexploitowalne na demo/produkcji) = #4 Permission Requests (404),
#5 Videos (404), #6 AI Context (501). To jest **3 żywe + 3 wygaszone**, nie 4+2.

Popraw linie 18-19 (pierwsze zdanie), zachowując strukturę zdania, ale z poprawną
liczbą i odniesieniem do szczegółowej sekcji:

```
**Sześć.** Trzy potwierdzone jako **żywe na produkcji/demo w obecnej konfiguracji**
(montowane bezwarunkowo, sekcja „PUŁAPKA" niżej), trzy potwierdzone w kodzie ale
**obecnie wygaszone na demo** przez osobną, niezwiązaną z uprawnieniami flagę
`mountStub`/`ENABLE_STUB_ROUTES` (żywe na każdym innym środowisku, jeden flip flagi od
bycia żywe wszędzie).

[dopisz jedno zdanie:] Wcześniejsza wersja tego zdania podawała 4+2 — sprostowane
2026-09-01 (dyżur 254) po ponownym zliczeniu wierszy sekcji „PUŁAPKA" niżej, która jest
źródłem szczegółowym dla tej liczby.
```

Dostosuj dokładnie do tego, co realnie zmierzysz w `R1` — jeśli okaże się, że to sekcja
szczegółowa ma błąd, a nie zdanie pierwsze, koryguj w drugą stronę i zapisz uzasadnienie
w raporcie.

## R4 — POPRAW KOMENTARZ `runLifecycle.routes.ts` (rdzeń)

Linie 5-10 dziś:
```
 * NOT MOUNTED YET — this file is built and self-contained (default-exports a
 * Router, same shape every sibling in this directory uses), but wiring it
 * into `server/src/routes/caseWorkspace/index.ts` is explicitly OPUS's job
 * per this packet's brief ("routes/caseWorkspace/index.ts (montaż = OPUS)").
 * The exact two-line change OPUS needs is documented in this packet's
 * handoff report, not made here.
```

`server/src/routes/caseWorkspace/index.ts:36` (`import runLifecycleRoutes from
'./runLifecycle.routes.js';`) i `:60` (`router.use(runLifecycleRoutes);`) potwierdzają,
że montaż **już się wydarzył** — komentarz opisuje stan, który minął. Popraw na coś w
kształcie:

```
 * Mounted via `server/src/routes/caseWorkspace/index.ts` (import + `router.use`).
 * [Sprostowanie 2026-09-01, dyżur 254: ten komentarz wcześniej twierdził "NOT
 * MOUNTED YET", opisując stan sprzed montażu; skorygowane po weryfikacji
 * `caseWorkspace/index.ts`.]
```

Skróć/dostosuj do stylu reszty pliku — nie musisz zachowywać całej historycznej treści
(to jest komentarz w kodzie, nie dokument kanoniczny — `Z13` dotyczy dokumentów w
`docs/`, nie komentarzy źródłowych), ale ZAPISZ w raporcie dokładnie, co usunąłeś i
dlaczego, żeby nadzorca mógł to zweryfikować.

**NIE dotykasz** `eventInbox.routes.ts` — jego komentarz „WHY THIS FILE IS NOT MOUNTED
THROUGH caseWorkspace/index.ts" jest PRAWDZIWY (`T7` — zamontowany bezpośrednio w
`Gateway.ts:103`, z poprawnym wyjaśnieniem architektonicznym).

## R5 — BOUNDED SWEEP: JESZCZE JEDEN PRZYPADEK TEJ SAMEJ RODZINY (rdzeń)

`grep -rniE "NOT MOUNTED|DEPRECATED|TODO.*(remove|delete)|temporary|tymczasow" server/src/routes/**/*.ts docs/program/**/*.md` (dostosuj wzorzec — cudzysłów w zsh, patrz pułapka `--include` w zsh z pamięci projektu, cytuj wzorce). Dla KAŻDEGO trafienia w `server/src/routes/`: sprawdź, czy plik jest realnie zamontowany (grep importu + `app.use`/`router.use` w `Gateway.ts`/pliku indeksu katalogu) i czy to zgadza się z treścią komentarza. Dla trafień w `docs/program/`: sprawdź, czy opisany stan (funkcja wyłączona, trasa niezamontowana, tabela nieistniejąca) zgadza się z aktualnym kodem. **Znajdź I napraw (albo zgłoś, jeśli poza czasem) co najmniej JEDEN nowy, potwierdzony przypadek** — jeśli sweep nie znajdzie żadnego nowego w rozsądnym czasie, zapisz to jako uczciwy wynik „przemieciono X wzorców, zero nowych trafień" z listą sprawdzonych wzorców, nie jako porażkę.

## R6 — RAPORT DYŻURU (rdzeń)

Sekcje: streszczenie, `R1`-`R5` z pełnymi dowodami (w tym diff/treść przed-po dla
każdej poprawki), zbiorcza lista „kłamiących dokumentów/komentarzy" znalezionych w
programie do tej pory (z odniesieniem do wcześniejszych: finance-intelligence.routes.ts
— już skorygowany 2026-08-31, przykład kontrastowy; toolsInsightsWiringFlag.test.ts —
zgłoszony w `ODBIOR_224_225.md` jako „czwarty", NIE zweryfikowany w tym dyżurze, zapisz
jako PODEJRZENIE do sprawdzenia osobno jeśli masz czas), sekcja „TWIERDZENIA
NIEZWERYFIKOWANE" (obowiązkowa nawet pusta), sekcja „Korekty wobec instrukcji"
(obowiązkowa nawet pusta).

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (PEŁNA, `R2`) | `server/migrations/README.md` · `server/migrations-archive/README.md` |
| Zapis (WĄSKO, `R3`) | `docs/program/funkcje/AUDYT_RODZINY_TRAS_UPRAWNIENIA.md` — WYŁĄCZNIE linie 18-19 (pierwsze zdanie), zakaz zmiany reszty pliku |
| Zapis (WĄSKO, `R4`) | `server/src/routes/caseWorkspace/runLifecycle.routes.ts` — WYŁĄCZNIE komentarz nagłówkowy linie 1-11, zakaz zmiany kodu |
| Zapis (WARUNKOWO, `R5`) | plik(i) znalezione w sweepie — WYŁĄCZNIE komentarz/README pasujący do sygnatury, jeden plik = jeden commit |
| Zapis (WĄSKO, `J`) | `docs/program/funkcje/ZNALEZISKO_MARTWY_KATALOG_MIGRACJI.md` — WYŁĄCZNIE nowa sekcja na końcu potwierdzająca wykonanie zadania 1 |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY254_SPRZECZNOSCI_REJESTRU_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/caseWorkspace/eventInbox.routes.ts` · `server/src/routes/caseWorkspace/index.ts` · `server/src/Gateway.ts` · `server/scripts/migrate.postgres.ts` · `.railwayignore` |
| Odczyt (ZAKAZ ZAPISU) | `server/migrations-v2/**` · `server/migrations-archive/*.sql` (poza README) — zakaz kasowania/przenoszenia |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **KROK 0 (`R1`) POTWIERDZA KAŻDĄ SPRZECZNOŚĆ PRZED NAPRAWĄ.** Nie zakładasz stanu
  z tej instrukcji — mierzysz.
- ★★ **ZAKAZ KASOWANIA `migrations-v2`/`migrations-archive`.** Poprawiasz README, żeby
  nie kłamały — decyzja o losie katalogów jest poza tym dyżurem.
- ★ **`eventInbox.routes.ts` MA POPRAWNY KOMENTARZ — nie dotykasz go.** Kontrast z
  `runLifecycle.routes.ts` jest częścią dowodu, nie zaproszeniem do „poprawienia obu dla
  spójności".
- ★ **Sprzeczność liczbową rozstrzygasz z DOWODU (sekcja szczegółowa), nie z
  domysłu**, który zapis „brzmi bardziej autorytatywnie".
- ★ **`R5` jest bounded** — jeden dodatkowy potwierdzony przypadek (albo uczciwe „zero
  nowych") wystarcza, nie przemiata się całego repo.
- ★ **`Z10`/`Z11`:** zero nowych flag.
- ★ **Pułapki środowiska — sprawdź każdą u siebie:** `Database.ts:80-88` atrapa bazy ·
  `vitest.config.ts:210` przypina `DB_TYPE='sqlite'` · `tests/setup.ts:896` podmienia
  `global.fetch` · pułapka `grep --include` w zsh (pusty wynik ≠ brak trafień, patrz
  pamięć projektu) — cytuj wzorce w `R5`.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.** Brak tej
  sekcji jest podstawą odrzucenia dyżuru.
