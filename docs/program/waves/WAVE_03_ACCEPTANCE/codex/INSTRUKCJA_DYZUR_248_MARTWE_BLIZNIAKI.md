# INSTRUKCJA DYŻURU nr 248 — Codex — „★★ 39 MARTWYCH BLIŹNIAKÓW TRAS — POTWIERDŹ KAŻDY OSOBNO, USUŃ POJEDYNCZO, COMMIT PER PLIK. `docs/program/funkcje/ZNALEZISKO_41_MARTWYCH_BLIZNIAKOW.md` zmierzył **54** płaskie pliki tras mające bliźniaka o tej samej nazwie w podkatalogu, z czego **13 żywych** i **41 martwych** (kontrola dodatnia: **347** importów `./routes/` w `Gateway.ts`), z których **2 usunięto od razu** (`ai-settings.routes.ts`, `tasks.routes.ts`), zostawiając **39** do tego dyżuru. **Moja własna, świeża rekonstrukcja na SHA `818e9cec0b`** (`§R0` tej instrukcji) POTWIERDZA dokładnie tę metodę i liczbę **39**, ale drogą inną niż prosta powtórka — po zmierzeniu 41 kandydatów (identyczna metoda: import bezpośredni `./routes/NAZWA.js` w `Gateway.ts`, wykluczony barrel `routes/index.ts` bo sam jest martwy) znalazłem, że **`health.routes.ts` NIE jest martwy** — jest importowany bezpośrednio przez `server/src/index.ts:117` jako `dbHealthRoutes` (ścieżka montowania OMIJAJĄCA `Gateway.ts` całkowicie), i że `assessment-reports.routes.ts` ma **dynamiczny import** w `server/src/services/health/healthProbeService.ts:635` (`await import('../../routes/assessment-reports.routes.js').catch(() => null)`) — osłonięty `.catch()`, prawdopodobnie tylko health-check kompilacji, ale wymaga INDYWIDUALNEGO domknięcia w `§R1`, nie automatycznego zaliczenia do usunięcia. Po odjęciu tych dwóch od 41 zostaje **DOKŁADNIE 39** — zgodne z audytem źródłowym, ale z INNYM uzasadnieniem: mój `41` i audytowy `41` mogą nie być tym samym zbiorem plików (repo przesunęło się od rana), zbieżność liczby jest częściowo przypadkowa i MUSISZ zweryfikować całą listę od nowa w `§R0`, nie ufać żadnej z dwóch list bez sprawdzenia."

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
> **wyłącznie** `/private/tmp/cx-day248-martwe-bliznaki`.

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
Zakres: ****PRZEKROJOWE — HIGIENA REPOZYTORIUM, ZERO ZMIAN FUNKCJONALNYCH. 39 martwych plików tras (`server/src/routes/*.routes.ts`, płaskich), każdy o TEJ SAMEJ NAZWIE co plik żywy w podkatalogu (`docs/program/funkcje/ZNALEZISKO_41_MARTWYCH_BLIZNIAKOW.md`). Potwierdź martwotę KAŻDEGO osobno z kontrolą dodatnią, usuń pojedynczo, commit per plik, sprawdź po każdym czy brama nadal się składa. Zakaz kasowania hurtem.****.
Trasy front: `brak — czysto porządkowa operacja po stronie `server/src/routes/**`, front nie importuje plików tras bezpośrednio`. Trasy tył: `39 płaskich plików wymienionych imiennie w `§3 R1` — WYŁĄCZNIE USUNIĘCIE (po potwierdzeniu martwoty), zero zmian w ich żywych bliźniakach w podkatalogach ani w `Gateway.ts`/`server/src/index.ts``.

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
WT=/private/tmp/cx-day248-martwe-bliznaki
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
git -C "$VAULT" worktree add "$WT" -b codex/day248-martwe-bliznaki-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day248-martwe-bliznaki/config.worktree"
cat "$VAULT/worktrees/cx-day248-martwe-bliznaki/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day248-martwe-bliznaki-scratch
mkdir -p /private/tmp/cx-day248-martwe-bliznaki-artefakty

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
git -C "$WT" push github-backup codex/day248-martwe-bliznaki-20260901
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

# (1) TEZA: kontrola dodatnia — 347 importow './routes/' w Gateway.ts (metoda audytu zrodlowego)
grep -oE "from '\./routes/[^']+'" server/src/Gateway.ts | wc -l
#   oczekiwane: liczba bliska 347 — jesli 0, TWOJE POLECENIE JEST ZLAMANE, nie kontynuuj
#   przed naprawa (Z34, kontrola dodatnia musi dzialac PRZED negatywnym pomiarem)

# (2) TEZA: 'ai-settings.routes.ts' i 'tasks.routes.ts' juz usuniete wczesniej dzis
ls server/src/routes/ai-settings.routes.ts 2>&1
ls server/src/routes/tasks.routes.ts 2>&1
#   oczekiwane: oba 'No such file or directory' — jesli KTORYS istnieje, to Twoj SHA
#   jest starszy niz zakladalem, zapisz to w Korektach i dolicz go jako 40. albo 41. pozycje

# (3) TEZA: 'health.routes.ts' jest ZYWY przez server/src/index.ts, NIE przez Gateway.ts
grep -n "routes/health.routes" server/src/index.ts server/src/Gateway.ts
#   oczekiwane: trafienie w server/src/index.ts (linia ok. 117), ZERO w Gateway.ts —
#   to jest dowod ze metoda liczaca tylko Gateway.ts ma slepy punkt

# (4) TEZA: 'assessment-reports.routes.ts' ma dynamiczny import w healthProbeService.ts
grep -n "assessment-reports.routes" server/src/services/health/healthProbeService.ts
#   oczekiwane: jedno trafienie, linia ok. 635, wzorzec 'await import(...).catch(() => null)'

# (5) TEZA: przykladowy kandydat (branding.routes.ts) nie ma ZADNEGO importu poza wlasnym
#     zywym blizniakiem w podkatalogu
grep -rn "routes/branding.routes.js'" server/src --include='*.ts'
#   oczekiwane: WYLACZNIE trafienie w server/src/routes/organization/index.ts (import
#   relatywny './branding.routes.js' z WNETRZA podkatalogu organization/, wskazujacy na
#   ZYWEGO blizniaka, nie plaski plik) — jesli jest cokolwiek innego, to NOWY dowod zycia

# (6) TEZA: kazdy z 39 plikow istnieje plasko na Twoim SHA
for f in ai-development aiPlaybooks billing branding calendarIntegrations; do [ -f "server/src/routes/$f.routes.ts" ] && echo "OK $f" || echo "BRAK $f"; done
#   oczekiwane: wszystkie OK (przyklad 5 z 39 — reszte sprawdzasz w R0)

# (7) TEZA: kazdy z 39 ma ZYWEGO blizniaka w podkatalogu, ktory bedzie dalej dzialal
for f in server/src/routes/ai/ai-development.routes.ts server/src/routes/ai/aiPlaybooks.routes.ts server/src/routes/billing/billing.routes.ts; do [ -f "$f" ] && echo "OK $f" || echo "BRAK $f"; done
#   oczekiwane: wszystkie OK (przyklad 3 — reszte sprawdzasz w R0)

# (8) TEZA: miejsce na dysku wystarcza
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day248-martwe-bliznaki-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6236`. Twój JEDYNY port harnessu to `5216 i 5217`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day248-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6229, 5010-5209, 6404-6411, 6600-6830 (obejmuje też dyżury 242-244). Twoje własne: baza 6236, harness 5216 i 5217. Cudze — siostrzane dyżury TEJ SAMEJ paczki (245-249, wydane 2026-09-01), nie dotykasz: baza 6230/harness 5210-11 (dyżur 245 Uprawnienia Flaga), baza 6232/harness 5212-13 (dyżur 246 Domiar Audytu), baza 6234/harness 5214-15 (dyżur 247 Próbka Naprawione), baza 6238/harness 5218-19 (dyżur 249 Sygnatura Bez Zabezpieczenia). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi. `Z10` obowiązuje bez wyjątku — ten dyżur nie zmienia zachowania produktu, wyłącznie usuwa nieosiągalne pliki.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `server/src/middleware/auth.middleware.ts` · `server/src/middleware/admin.middleware.ts` · `server/src/middleware/rbac.middleware.ts` · `server/src/middleware/effectiveCapability.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY248_MARTWE_BLIZNIAKI_REPORT.md`. Jedyny inny dokument, który wolno Ci dotknąć, to jeden nowy wpis (nie edycja istniejących wierszy) w rejestrze dowodowym `docs/program/funkcje/ZNALEZISKO_41_MARTWYCH_BLIZNIAKOW.md` — WYŁĄCZNIE nowa sekcja na końcu pliku „## Dzień 248 — 39 potwierdzone i usunięte pojedynczo” z listą: plik · bliźniak żywy · dowód kontroli dodatniej · SHA commitu usunięcia · wynik sprawdzenia bramy po usunięciu, dla KAŻDEGO z 39 osobno. Zakaz kasowania, nadpisywania lub przepisywania istniejącej treści tego pliku. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day248-martwe-bliznaki-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day248-martwe-bliznaki-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **★★ ZAKAZ KASOWANIA HURTEM.** Jeden plik = jedna kontrola dodatnia = jeden commit = jedna weryfikacja, że brama nadal się składa. Nigdy `rm` na wielu plikach w jednej komendzie, nigdy jeden commit z wieloma usunięciami. **ZAKAZ usuwania `health.routes.ts`** — potwierdzony żywy przez `server/src/index.ts`. **ZAKAZ automatycznego usuwania `assessment-reports.routes.ts`** bez dodatkowego dowodu dot. `healthProbeService.ts:635` (patrz pułapka). **ZAKAZ dotykania ŻYWYCH bliźniaków w podkatalogach** — usuwasz WYŁĄCZNIE płaski plik, nigdy plik w `pmo/`, `ai/`, `organization/`, `billing/`, `integrations/`, `user/`, `admin/`, `notifications/`, `webhooks/`, `v8/`. **ZAKAZ zmian w `Gateway.ts` i `server/src/index.ts`** — te pliki dowodzą martwoty, nie są przedmiotem edycji w tym dyżurze. | Każdy z tych 41 plików ma tę samą nazwę co plik żywy, wygląda jak poprawny kod (bo nim jest, tylko nikt go nie uruchamia), i jest znajdowany przez wyszukiwanie po nazwie równie chętnie jak żywy. Trzy niezależne osoby wpadły w jeden z takich plików (`ai-settings.routes.ts`) w ciągu jednego dnia, zanim ktokolwiek zauważył wzorzec. To NIE jest zaniedbanie — to powtarzalna praktyka organizacji kodu w tym repo (stary plik zostaje na płasko, nowy powstaje w podkatalogu, stary nie dostaje żadnego oznaczenia), powtórzona 41 razy. Każdy pozostawiony plik jest pułapką dla następnej osoby, która go zacytuje jako dowód — a `plik:linia` z martwego pliku to fałszywy dowód, nie prawdziwy. |

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
cd /private/tmp/cx-day248-martwe-bliznaki

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day248-pg psql -U postgres -d cx248 \
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
cd /private/tmp/cx-day248-martwe-bliznaki

docker run -d --name cx-day248-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx248 \
  -p 127.0.0.1:6236:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day248-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6236/cx248 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6236/cx248 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day248-martwe-bliznaki && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6236/cx248 \
JWT_SECRET=cx248-test-secret-do-not-reuse \
npx vitest run brak — ten dyżur nie tworzy plików testowych; dowodem jest kompilacja/uruchomienie bramy po każdym usunięciu, nie nowy pakiet testów --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day248-martwe-bliznaki-artefakty/day248-porzadki.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day248-martwe-bliznaki && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run brak — ten dyżur nie tworzy plików testowych; dowodem jest kompilacja/uruchomienie bramy po każdym usunięciu, nie nowy pakiet testów --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day248-martwe-bliznaki-artefakty/day248-porzadki.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day248-martwe-bliznaki/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day248-pg psql -U postgres -d cx248 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day248-pg`.
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
> **(e) ★★ DWA Z 41 KANDYDATÓW NIE SĄ PROSTYMI MARTWYMI PLIKAMI — WYPISZ JE JAKO OSOBNĄ RODZINĘ, NIE DOTYKAJ BEZ DODATKOWEGO DOWODU.** (1) `server/src/routes/health.routes.ts` jest ŻYWY — importowany przez `server/src/index.ts:117` (`import dbHealthRoutes from './routes/health.routes.js'`), MONTOWANY POZA `Gateway.ts`. Twoja kontrola dodatnia licząca WYŁĄCZNIE importy w `Gateway.ts` (`347`) go przegapi — MUSISZ dodatkowo sprawdzić `server/src/index.ts` dla KAŻDEGO kandydata, nie tylko dla tego jednego, bo to dowodzi, że metoda audytu źródłowego (licząca tylko `Gateway.ts`) miała ślepy punkt. **ZAKAZ usuwania `health.routes.ts` w tym dyżurze — jest ŻYWY.** (2) `server/src/routes/assessment-reports.routes.ts` ma dynamiczny import w `server/src/services/health/healthProbeService.ts:635`, osłonięty `.catch(() => null)` — sprawdź, czy usunięcie pliku psuje ten health-probe (uruchom go, jeśli to możliwe bez naruszania `Z8`/`Z28`, albo przeczytaj kod probe'a i opisz skutek `.catch()` na brak pliku). Jeśli po zbadaniu uznasz plik za bezpieczny do usunięcia — usuwasz go OSTATNI, z dodatkowym akapitem dowodowym w raporcie, nie w pierwszej kolejności z resztą 38.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day248-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day248-martwe-bliznaki-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (świeża kontrola dodatnia + weryfikacja całej listy 39, warunek wejścia) · R1 (39× potwierdź-usuń-sprawdź, pojedynczo, commit per plik) · R2 (raport)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6236` albo `5216 i 5217` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6236` albo `5216 i 5217`** (`Z7`).

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

`docs/program/funkcje/ZNALEZISKO_41_MARTWYCH_BLIZNIAKOW.md` opisuje, jak do tego doszło: spór
o zakres naprawy ustawień AI, w którym **trzy niezależne osoby** oparły wnioski na martwym pliku
`server/src/routes/ai-settings.routes.ts`, nie widząc, że żywy leży w `server/src/routes/ai/
ai-settings.routes.ts`. Systematyczne przemiecenie katalogu `server/src/routes/` dało wynik:
**54** płaskie pliki mają bliźniaka o tej samej nazwie w podkatalogu, z czego **13 żywych** i
**41 martwych** (kontrola dodatnia: **347** importów `./routes/` w `Gateway.ts`). Dwa usunięto od
razu, pojedynczo, po potwierdzeniu zera importerów (`ai-settings.routes.ts`, `tasks.routes.ts`).
**Pozostałe 39 czekają na ten dyżur.**

**Każdy z tych plików ma tę samą nazwę co plik żywy, wygląda jak poprawny kod (bo nim jest, tylko
nikt go nie uruchamia), i jest znajdowany przez wyszukiwanie po nazwie równie chętnie jak żywy.**
Nie ma na sobie żadnego oznaczenia martwoty. To nie jest zaniedbanie — to powtarzalna praktyka
organizacji kodu w tym repo: stary plik zostaje na płasko, nowy powstaje w podkatalogu
tematycznym (`pmo/`, `ai/`, `organization/`, `billing/`, `integrations/`, `user/`…), a stary nigdy
nie dostaje żadnego znaku.

## Moja świeża weryfikacja na SHA `818e9cec0b` — DWA odstępstwa od prostej listy 39

Zanim napisałem tę instrukcję, powtórzyłem całą metodę od zera (nie skopiowałem listy z dokumentu
źródłowego bez sprawdzenia — `Z34`, „grep dowodzi że łańcuch istnieje, nie że działa"). Wynik: **41
kandydatów** tą samą metodą (import bezpośredni `./routes/NAZWA.js` w `Gateway.ts`, z wykluczeniem
barrela `routes/index.ts`, który sam jest martwy — zero importerów nigdzie w `server/src`). Ale
DWA z 41 wymagają osobnego traktowania:

1. **`server/src/routes/health.routes.ts` NIE JEST MARTWY.** Jest importowany bezpośrednio przez
   `server/src/index.ts:117` (`import dbHealthRoutes from './routes/health.routes.js'`) —
   **montowanie POZA `Gateway.ts` całkowicie**. Metoda licząca WYŁĄCZNIE importy w `Gateway.ts`
   (moja i, jak się wydaje, ta z dokumentu źródłowego) ma tu ślepy punkt. **Ten plik zostaje —
   ZAKAZ usuwania.**
2. **`server/src/routes/assessment-reports.routes.ts` ma dynamiczny import** w
   `server/src/services/health/healthProbeService.ts:635`:
   ```ts
   const mod = await import('../../routes/assessment-reports.routes.js').catch(() => null);
   ```
   Osłonięty `.catch(() => null)` — prawdopodobnie tylko sonda zdrowia sprawdzająca, czy moduł się
   kompiluje/ładuje, nie prawdziwe mountowanie trasy. Ale to WCIĄŻ jest realny importer, więc plik
   NIE jest „zero importerów" w prostym sensie. Wymaga dodatkowego badania w `R0`, nie
   automatycznego zaliczenia do usunięcia razem z resztą.

Po odjęciu tych dwóch od 41 zostaje **dokładnie 39** — zgodnie z zamówieniem, ale **z innym
uzasadnieniem niż proste „41 minus 2 już usunięte"**. Mój zbiór 41 i zbiór z dokumentu źródłowego
mogą się różnić w szczegółach (repo przesunęło się od rana) — **zbieżność liczby 39 jest częściowo
przypadkowa i MUSISZ zweryfikować całą listę od nowa na WŁASNYM SHA w `R0`**, nie ufać ślepo ani
mojej, ani audytowej liście.

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Kontrola dodatnia działa: ok. 347 importów `./routes/` w `Gateway.ts` | komenda (1) |
| T2 | `ai-settings.routes.ts` i `tasks.routes.ts` już usunięte wcześniej dziś | komenda (2) |
| T3 | `health.routes.ts` jest żywy przez `server/src/index.ts`, NIE przez `Gateway.ts` | komenda (3) |
| T4 | `assessment-reports.routes.ts` ma dynamiczny import w `healthProbeService.ts` | komenda (4) |
| T5 | Przykładowy kandydat (`branding.routes.ts`) nie ma żadnego importu poza własnym żywym bliźniakiem | komenda (5) |
| T6 | Wszystkie 39 plików istnieją płasko na Twoim SHA | komenda (6), pełna lista w `R0` |
| T7 | Każdy z 39 ma żywego bliźniaka w podkatalogu | komenda (7), pełna lista w `R0` |
| T8 | Miejsce na dysku wystarcza | komenda (8) |

---

# 3. POZYCJE DYŻURU

## R0 — ŚWIEŻA KONTROLA DODATNIA + WERYFIKACJA CAŁEJ LISTY 39 (rdzeń, warunek wejścia)

Wykonaj **wszystkie 8 komend** z `§0.1`. Następnie, dla **KAŻDEGO** z 39 plików poniżej —
**pojedynczo**, nie w pętli bez przystanku — potwierdź na WŁASNYM SHA:

1. Plik płaski istnieje (`[ -f server/src/routes/<nazwa> ]`).
2. Żywy bliźniak w podkatalogu istnieje i jest importowany przez `Gateway.ts` (`grep -n
   "routes/<podkatalog>/<nazwa>" server/src/Gateway.ts`).
3. **Zero importerów płaskiego pliku** — `grep -rn "routes/<nazwa_bez_ts>.js'" server/src
   --include='*.ts'` daje TYLKO trafienia wskazujące na relatywny import żywego bliźniaka z
   WNĘTRZA jego własnego podkatalogu (np. `organization/index.ts` importujące `./branding.
   routes.js`, co rozwiązuje się do `organization/branding.routes.ts`, NIE do płaskiego pliku).
   Jeżeli znajdziesz cokolwiek inne — to NOWY dowód życia, zatrzymujesz się na TEJ pozycji,
   zapisujesz w „Korektach wobec instrukcji", NIE usuwasz.

**39 kandydatów (nazwa płaska → bliźniak żywy w podkatalogu):**

| # | Plik płaski (do usunięcia PO potwierdzeniu) | Bliźniak żywy (NIETYKALNY) |
|---|---|---|
| 1 | `server/src/routes/ai-development.routes.ts` | `server/src/routes/ai/ai-development.routes.ts` |
| 2 | `server/src/routes/aiPlaybooks.routes.ts` | `server/src/routes/ai/aiPlaybooks.routes.ts` |
| 3 | `server/src/routes/billing.routes.ts` | `server/src/routes/billing/billing.routes.ts` |
| 4 | `server/src/routes/branding.routes.ts` | `server/src/routes/organization/branding.routes.ts` |
| 5 | `server/src/routes/calendarIntegrations.routes.ts` | `server/src/routes/integrations/calendarIntegrations.routes.ts` |
| 6 | `server/src/routes/capacity.routes.ts` | `server/src/routes/pmo/capacity.routes.ts` |
| 7 | `server/src/routes/connectors.routes.ts` | `server/src/routes/integrations/connectors.routes.ts` |
| 8 | `server/src/routes/execution.routes.ts` | `server/src/routes/pmo/execution.routes.ts` (i `v8/execution.routes.ts` — DWA bliźniaki, sprawdź oba) |
| 9 | `server/src/routes/governance.routes.ts` | `server/src/routes/pmo/governance.routes.ts` |
| 10 | `server/src/routes/integrations.routes.ts` | `server/src/routes/integrations/integrations.routes.ts` |
| 11 | `server/src/routes/loginHistory.routes.ts` | `server/src/routes/user/loginHistory.routes.ts` |
| 12 | `server/src/routes/notification-rules.routes.ts` | `server/src/routes/notifications/notification-rules.routes.ts` |
| 13 | `server/src/routes/notifications.routes.ts` | `server/src/routes/notifications/notifications.routes.ts` |
| 14 | `server/src/routes/organization-data.routes.ts` | `server/src/routes/organization/organization-data.routes.ts` |
| 15 | `server/src/routes/organization-limits.routes.ts` | `server/src/routes/organization/organization-limits.routes.ts` |
| 16 | `server/src/routes/organization-profiles.routes.ts` | `server/src/routes/organization/organization-profiles.routes.ts` |
| 17 | `server/src/routes/organizations.routes.ts` | `server/src/routes/organization/organizations.routes.ts` |
| 18 | `server/src/routes/pmo-analysis.routes.ts` | `server/src/routes/pmo/pmo-analysis.routes.ts` |
| 19 | `server/src/routes/pmo-context.routes.ts` | `server/src/routes/pmo/pmo-context.routes.ts` |
| 20 | `server/src/routes/pmo.routes.ts` | `server/src/routes/pmo/pmo.routes.ts` |
| 21 | `server/src/routes/pmoDomains.routes.ts` | `server/src/routes/pmo/pmoDomains.routes.ts` |
| 22 | `server/src/routes/pmoRoles.routes.ts` | `server/src/routes/pmo/pmoRoles.routes.ts` |
| 23 | `server/src/routes/pricing.routes.ts` | `server/src/routes/billing/pricing.routes.ts` |
| 24 | `server/src/routes/project-members.routes.ts` | `server/src/routes/pmo/project-members.routes.ts` (★ ten sam plik, którego dziś użyto jako wzorca naprawy IDOR w dyżurze 242/245 — NIE MYL płaskiego z żywym) |
| 25 | `server/src/routes/projects.routes.ts` | `server/src/routes/pmo/projects.routes.ts` |
| 26 | `server/src/routes/promo.routes.ts` | `server/src/routes/billing/promo.routes.ts` |
| 27 | `server/src/routes/rbac.routes.ts` | `server/src/routes/organization/rbac.routes.ts` |
| 28 | `server/src/routes/roadmap.routes.ts` | `server/src/routes/pmo/roadmap.routes.ts` |
| 29 | `server/src/routes/scim.routes.ts` | `server/src/routes/integrations/scim.routes.ts` |
| 30 | `server/src/routes/sellix.routes.ts` | `server/src/routes/webhooks/sellix.routes.ts` |
| 31 | `server/src/routes/sessions.routes.ts` | `server/src/routes/admin/sessions.routes.ts` (i `user/sessions.routes.ts` — DWA bliźniaki, sprawdź oba) |
| 32 | `server/src/routes/settlements.routes.ts` | `server/src/routes/billing/settlements.routes.ts` |
| 33 | `server/src/routes/sso.routes.ts` | `server/src/routes/integrations/sso.routes.ts` |
| 34 | `server/src/routes/stage-gates.routes.ts` | `server/src/routes/pmo/stage-gates.routes.ts` |
| 35 | `server/src/routes/teams.routes.ts` | `server/src/routes/organization/teams.routes.ts` |
| 36 | `server/src/routes/users.routes.ts` | `server/src/routes/user/users.routes.ts` |
| 37 | `server/src/routes/webhookSubscriptions.routes.ts` | `server/src/routes/integrations/webhookSubscriptions.routes.ts` |
| 38 | `server/src/routes/webhooks.routes.ts` | `server/src/routes/integrations/webhooks.routes.ts` |
| 39 | `server/src/routes/workstreams.routes.ts` | `server/src/routes/pmo/workstreams.routes.ts` |

**Pozycje #8 i #31 mają DWA bliźniaków żywych** — sprawdź oba, żaden z nich nie jest przedmiotem
usunięcia, tylko sam płaski plik.

## R1 — POTWIERDŹ, USUŃ, SPRAWDŹ BRAMĘ — 39×, POJEDYNCZO (rdzeń)

Dla KAŻDEJ z 39 pozycji, PO KOLEI, NIGDY równolegle ani hurtowo:

1. **Potwierdź martwotę** — trzy kroki `R0` dla TEJ jednej pozycji, wklej wynik do raportu.
2. **Usuń TYLKO ten jeden plik** — `git rm server/src/routes/<nazwa>` (jeden plik w komendzie).
3. **Sprawdź, czy brama się składa:**
   ```bash
   npx tsc --noEmit -p server/tsconfig.json 2>&1 | tail -20
   ```
   Jeżeli błąd wskazuje na usunięty plik (import nie może się rozwiązać) — to dowód, że plik
   JEDNAK miał importera, którego przegapiłeś. `git checkout -- <plik>` (przywróć), zapisz jako
   „Korektę wobec instrukcji" z pełnym dowodem błędu kompilacji, NIE usuwaj tej pozycji, przejdź
   do następnej.
4. **Commit PER PLIK**, jeden plik na commit:
   ```bash
   git commit -m "chore(routes): remove dead flat twin <nazwa> (day248, confirmed zero importers)" -- server/src/routes/<nazwa>
   ```
5. Push po KAŻDYM commicie (`Z34a`).

**Dla pozycji `assessment-reports.routes.ts` (jeśli po `R0`/pułapce uznasz ją za bezpieczną do
usunięcia)** — usuwasz ją OSTATNIĄ z 39, z dodatkowym akapitem w raporcie opisującym skutek
`.catch(() => null)` w `healthProbeService.ts:635` na brak pliku (najprawdopodobniej: funkcja
zwraca `null`, health-probe raportuje ten jeden moduł jako niedostępny, ale nie wywala całego
probe'a — potwierdź to CZYTAJĄC kod wokół linii 635, nie zgadując).

**`health.routes.ts` NIE wchodzi do tej listy — pozostaje, jest żywy.**

## R2 — RAPORT DYŻURU (rdzeń)

Streszczenie, `R0`-`R1` z pełnymi dowodami dla KAŻDEJ z 39 pozycji osobno (tabela: plik · bliźniak
· dowód kontroli dodatniej · SHA commitu · wynik `tsc --noEmit` po usunięciu), lista pozycji
NIEUSUNIĘTYCH z powodem (jeśli jakaś), sekcja „TWIERDZENIA NIEZWERYFIKOWANE" (obowiązkowa nawet
pusta), sekcja „Korekty wobec instrukcji" (obowiązkowa nawet pusta).

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (USUNIĘCIE, `R1`) | 39 płaskich plików z tabeli `R0` (WYŁĄCZNIE `git rm`, jeden plik na commit) |
| Zapis (WĄSKO, `J`) | `docs/program/funkcje/ZNALEZISKO_41_MARTWYCH_BLIZNIAKOW.md` — WYŁĄCZNIE nowa sekcja na końcu pliku |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY248_MARTWE_BLIZNIAKI_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | wszystkie żywe bliźniaki w podkatalogach (kolumna 2 tabeli `R0`) |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/health.routes.ts` — ŻYWY, nie usuwasz |
| Odczyt (ZAKAZ ZAPISU) | `server/src/Gateway.ts` · `server/src/index.ts` — dowodzą martwoty/życia, nie edytujesz |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/health/healthProbeService.ts` — referencja dla `assessment-reports.routes.ts` |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` (`Z18`) · `server/src/database/Database.ts` · każdy `MODULE_ACCEPTANCE.md` |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **ZAKAZ KASOWANIA HURTEM.** Jeden plik = jedna kontrola = jeden commit = jedna weryfikacja
  bramy. Nigdy `rm` wielu plików naraz, nigdy jeden commit z wieloma usunięciami — to jest
  jedyny sposób, żeby cofnięcie kosztowało jedno polecenie (`git revert <SHA>`), a nie odtwarzanie
  z pamięci które z wielu usunięć było błędne.
- ★★ **KONTROLA DODATNIA OBOK KAŻDEGO POMIARU NEGATYWNEGO.** „Zero importerów" jest wiarygodne
  tylko z dowodem, że Twoje polecenie grep DZIAŁA (komenda (1), 347 trafień) — inaczej „zero"
  znaczy równie dobrze „moje polecenie jest zepsute", co „plik jest martwy".
- ★★ **DWIE POZYCJE WYMAGAJĄ DODATKOWEGO DOWODU PRZED USUNIĘCIEM** — `health.routes.ts` (NIE
  usuwasz w ogóle) i `assessment-reports.routes.ts` (usuwasz OSTATNIĄ, z dodatkowym akapitem).
- ★ **SPRAWDŹ OBA BLIŹNIAKI DLA POZYCJI #8 (`execution.routes.ts`) I #31 (`sessions.routes.ts`)**
  — mają po dwa żywe pliki w podkatalogach, żaden z nich nie jest przedmiotem usunięcia.
- ★ **`npx tsc --noEmit` PO KAŻDYM USUNIĘCIU, NIE PO WSZYSTKICH NARAZ.** Błąd kompilacji
  wskazujący konkretny commit jest natychmiastowym sygnałem cofnięcia TEJ jednej pozycji.
- ★ **PUSH PO KAŻDYM COMMICIE** (`Z34a`) — 39 commitów, 39 pushy, nie jeden push na końcu.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.**
