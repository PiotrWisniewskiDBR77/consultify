# INSTRUKCJA DYŻURU nr 282 — Codex — „★★★ Sześć przepływów między modułami jest OPISANYCH od 2026-07-29 i ANI JEDEN nie został nigdy przejechany od początku do końca na żywym systemie — ten dyżur robi dokładnie to i tylko to: przechodzi każdy krok każdego przepływu realnym łańcuchem (Postgres od zera, realny ApiGateway nasłuchujący na porcie, realna rejestracja, podpisany token, realne trasy HTTP) i dla KAŻDEGO kroku zapisuje jedną z trzech odpowiedzi — PRZESZEDŁ (z identyfikatorem obiektu i dowodem powiązania), ZERWANY (z nazwą pliku i linią, gdzie łańcuch się urywa) albo BRAK MECHANIZMU (kroku nie ma w kodzie w ogóle). ★ To jest pomiar, NIE naprawa: produktem dyżuru jest rejestr zerwań z tropem do pliku, na podstawie którego wydamy wąskie, tanie dyżury naprawcze. ★ Powód priorytetu: faza trzecia programu to pełna integracja systemu, a dziś nikt nie wie, które ogniwa realnie trzymają — mamy 16 modułów odebranych ekranami i ZERO dowodu, że dane przechodzą między nimi."

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
> **wyłącznie** `/private/tmp/cx-day282-przeplywy`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `c187bcc164`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-02.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****PRZEKROJOWE — SZEŚĆ UDOKUMENTOWANYCH PRZEPŁYWÓW MIĘDZYMODUŁOWYCH** z `docs/program/CROSS_MODULE_FLOWS.md` (FLOW-01 … FLOW-06). Dyżur dotyka wszystkich 16 modułów, ale WYŁĄCZNIE jako czytelnik i wołacz — nie naprawia niczego.**.
Trasy front: `brak w zakresie ZAPISU — dyżur woła trasy backendowe bezpośrednio przez HTTP, nie przez UI. ALE dla każdego zmierzonego kroku ZANOTUJ w raporcie, który ekran frontu (jeśli istnieje) odpowiada temu krokowi, żeby wynik dało się odtworzyć z poziomu produktu. Jeśli krok nie ma ekranu — to sam w sobie jest znaleziskiem i wpisujesz je jako `BRAK EKRANU`.`. Trasy tył: `Ustalasz je SAM w `W1` — nie ufaj nazwie katalogu. Punkt wejścia: `server/src/routes/` oraz montowanie w `server/src/Gateway.ts`. ★ Znana pułapka nazewnicza: warstwa finansowa mieszka w `src/components/Economics/**`, nie `Finance/**`. Dla każdego z sześciu przepływów wypisz w raporcie realne trasy, których użyłeś, z plikiem i linią. WSZYSTKO WYŁĄCZNIE DO WOŁANIA I ODCZYTU — zero zmian kodu produktu.`.

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
WT=/private/tmp/cx-day282-przeplywy
MARKER=c187bcc164

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day282-przeplywy-miedzymodulowe-20260902 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day282-przeplywy/config.worktree"
cat "$VAULT/worktrees/cx-day282-przeplywy/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day282-przeplywy-scratch
mkdir -p /private/tmp/cx-day282-przeplywy-artefakty

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
git -C "$VAULT" log --oneline c187bcc164..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only c187bcc164..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day282-przeplywy-miedzymodulowe-20260902
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only c187bcc164..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `8` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: dokument szesciu przeplywow istnieje i ma dokladnie szesc naglowkow FLOW
grep -c '^## FLOW-' docs/program/CROSS_MODULE_FLOWS.md
sed -n '82,89p' docs/program/CROSS_MODULE_FLOWS.md
#   oczekiwane: 6 oraz sekcja 'Przeplywy wymagajace dalszej weryfikacji AS-IS'
#   — to jest pisemne przyznanie autorow, ze tego nie zweryfikowano

# (2) ★★★ TEZA: tests/setup.ts globalnie podmienia fetch — dowod, ze NIE WOLNO mierzyc przez vitest
sed -n '855,900p' tests/setup.ts
grep -n 'setupFiles' vitest.config.ts server/vitest.config.ts 2>/dev/null
#   oczekiwane: global.fetch nadpisany atrapa zwracajaca zawsze ok:true

# (3) ★★★ TEZA: Database.ts zwraca changes:1 dla kazdego UPDATE, nawet gdy WHERE nic nie trafil
sed -n '680,695p' server/src/database/Database.ts
#   oczekiwane: zwrot ze stalym changes:1 — dlatego kazdy krok potwierdzasz ODCZYTEM, nie odpowiedzia zapisu

# (4) TEZA: NODE_ENV=test bez RUN_DB_TESTS=1 podstawia atrape bazy pod DbPromise
grep -rn 'RUN_DB_TESTS' server/src/database/ server/src/config/ 2>/dev/null | head -8
#   oczekiwane: warunek wybierajacy atrape — zanotuj plik i linie, bedzie potrzebny w R1

# (5) TEZA: Gateway montuje trasy, ale nie ma error middleware (jest dopiero w index.ts)
grep -n 'initializeRoutes' server/src/Gateway.ts | head -5
grep -n 'errorHandler\|app.use((err' server/src/Gateway.ts server/src/index.ts | head -8
#   oczekiwane: initializeRoutes w Gateway, error middleware dopiero w index.ts ok. 1747
#   — dlatego pusty 500 wymaga zajrzenia w logi serwera

# (6) TEZA: istnieje wzorzec samodzielnego skryptu tsx omijajacego vitest
ls server/src/scripts/*RealDbProof.ts | head -5
sed -n '1,30p' server/src/scripts/a05ProposalGovernanceRealDbProof.ts
#   oczekiwane: co najmniej jeden plik tego ksztaltu — Twoj skrypt idzie obok, tym samym wzorcem

# (7) TEZA: rejestracja organizacji idzie realna trasa, nie INSERT-em z pominieciem walidacji
grep -n "router.post('/register'" server/src/routes/auth.routes.ts
#   oczekiwane: trafienie — to jedyna dozwolona metoda zalozenia organizacji w R1

# (8) TEZA: porty i miejsce na dysku sa wolne
lsof -nP -iTCP:6260 -sTCP:LISTEN; lsof -nP -iTCP:5240 -sTCP:LISTEN; lsof -nP -iTCP:5241 -sTCP:LISTEN
docker ps --format '{{.Names}}' | grep -c cx-day282-pg || true
df -h /
#   oczekiwane: trzy puste odpowiedzi lsof, 0 kontenerow o tej nazwie, powyzej 3 GB wolnego
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day282-przeplywy-miedzymodulowe-20260902` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6260`. Twój JEDYNY port harnessu to `5240 i 5241`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day282-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajęte przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyżury 274-278 tej samej paczki, nie dotykasz ich portów ani kontenerów. Twoje własne: baza 6260, harness 5240 i 5241. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi i ŻADNEJ zmiany wartości domyślnej istniejącej flagi. `Z10` obowiązuje bez wyjątku. Jeśli krok przepływu jest schowany za flagą `default OFF`, to jest WYNIK POMIARU i wpisujesz go do rejestru jako `ZA FLAGĄ` z nazwą flagi i miejscem jej odczytu — a następnie, jeśli chcesz zmierzyć krok mimo to, włączasz ją WYŁĄCZNIE query-paramem lub nagłówkiem pojedynczego żądania, NIGDY zmianą wartości domyślnej w kodzie. ★ Uwaga zmierzona w programie: zmienna środowiskowa omija flagi wczesnym `return true` w SZEŚCIU rodzinach — więc `flaga OFF w kodzie` nie znaczy `wyłączona w Twoim przebiegu`. Sprawdź realny stan flagi w miejscu jej odczytu, nie w miejscu deklaracji.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/utils/pilotAccess.ts` · `src/utils/roleGuards.ts` · `src/components/RouterSync.tsx` · `server/src/middleware/auth.middleware.ts` · `server/src/database/Database.ts` · `server/src/Gateway.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY282_PRZEPLYWY_MIEDZYMODULOWE_REPORT.md`. Dozwolony dokładnie JEDEN nowy plik dokumentacyjny: `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_ZERWAN_PRZEPLYWOW_20260902.md` — rejestr zerwań, jeden wiersz na krok przepływu, kolumny: przepływ · numer kroku · treść kroku z CROSS_MODULE_FLOWS.md · stan (PRZESZEDŁ / ZERWANY / BRAK MECHANIZMU / ZA FLAGĄ / PODEJRZENIE) · dowód (identyfikator obiektu przy PRZESZEDŁ, plik i linia przy pozostałych) · ekran frontu odpowiadający krokowi lub BRAK EKRANU. **ZAKAZ edytowania `docs/program/CROSS_MODULE_FLOWS.md`** — ten dokument opisuje stan DOCELOWY i zostaje nietknięty; Twój rejestr opisuje stan ZASTANY i leży obok.. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day282-przeplywy-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day282-przeplywy-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ NAPRAWIANIA CZEGOKOLWIEK.** Ten dyżur nie naprawia ani jednego zerwania, nawet jeśli naprawa wygląda na jednolinijkową i nawet jeśli masz pewność. Znalazłeś zerwanie — zapisujesz je z plikiem i linią i idziesz dalej. Powód: rejestr sześciu przepływów jest wart więcej niż jedna naprawa plus urwane okno; a naprawa bez wiedzy o całej rodzinie zerwań daje poprawne w dwóch na trzy. **ZAKAZ zmiany jakiegokolwiek pliku w `src/` i `server/src/`** poza JEDNYM nowym plikiem skryptu pomiarowego `server/src/scripts/day282-przeplywy.ts`. **ZAKAZ wnioskowania o kroku z lektury kodu** — krok ma stan `PRZESZEDŁ` wyłącznie wtedy, gdy realnie go wywołałeś i odczytałeś wynik na zimno; lektura kodu daje najwyżej `PODEJRZENIE`, i tak go opisujesz. **ZAKAZ tworzenia rekordów w bazie inaczej niż legalnymi trasami produktu** — żadnych `INSERT` z pominięciem walidacji; jeśli nie da się czegoś stworzyć trasą, to JEST znaleziskiem. **ZAKAZ zostawiania danych po sobie** — kontener i baza znikają po pomiarze. | Program wchodzi w fazę trzecią (pełna integracja systemu, potem staging i demo). Odbiór szesnastu modułów potwierdził WARSTWĘ EKRANOWĄ — właściciel obejrzał i zatwierdził ekrany. Nie potwierdził ani jednego przejścia danych MIĘDZY modułami. Dokument `CROSS_MODULE_FLOWS.md` opisuje sześć przepływów jako stan docelowy i sam zawiera sekcję `Przepływy wymagające dalszej weryfikacji AS-IS` z sześcioma pozycjami — czyli autorzy dokumentu jawnie zapisali, że tego nie zweryfikowano. Od 2026-07-29 nikt tego nie zrobił. Bez tego pomiaru wchodzimy na staging nie wiedząc, czy produkt jest systemem, czy szesnastoma osobnymi ekranami; a każda naprawa wydana bez tej wiedzy jest strzelaniem na oślep. ★ Dodatkowy powód: w programie wielokrotnie zmierzono kształt fałszywego gotowe o nazwie ZBUDOWANE, ALE NIEPODŁĄCZONE — właściwa rzecz jest w kodzie, brakuje ostatniego przewodu. Ten dyżur mierzy dokładnie przewody. |

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
cd /private/tmp/cx-day282-przeplywy

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day282-pg psql -U postgres -d cx282 \
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
cd /private/tmp/cx-day282-przeplywy

docker run -d --name cx-day282-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx282 \
  -p 127.0.0.1:6260:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day282-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6260/cx282 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6260/cx282 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day282-przeplywy && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6260/cx282 \
JWT_SECRET=cx282-test-secret-do-not-reuse \
npx vitest run brak testów `vitest` — dowód idzie wyłącznie samodzielnym skryptem `server/src/scripts/day282-przeplywy.ts` uruchamianym przez `npx tsx`, NIGDY przez `npx vitest run` (patrz PUŁAPKA, punkt 1) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day282-przeplywy-artefakty/day282-przeplywy.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day282-przeplywy && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run brak testów `vitest` — dowód idzie wyłącznie samodzielnym skryptem `server/src/scripts/day282-przeplywy.ts` uruchamianym przez `npx tsx`, NIGDY przez `npx vitest run` (patrz PUŁAPKA, punkt 1) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day282-przeplywy-artefakty/day282-przeplywy.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day282-przeplywy/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day282-pg psql -U postgres -d cx282 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day282-pg`.
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
> **(e) ★★★ CZTERY ZMIERZONE SPOSOBY, W JAKIE NASZ HARNESS KŁAMIE — przeczytaj zanim napiszesz pierwszą linię pomiaru. (1) `tests/setup.ts:858-896` globalnie mockuje SDK modeli i podmienia `global.fetch` tak, że KAŻDE żądanie sieciowe zwraca fałszywe `{ok:true,status:200,json:()=>({data:[]})}`. Ładuje się przy KAŻDYM uruchomieniu przez `vitest`. **Jeżeli zmierzysz przepływy przez `vitest`, dostaniesz fałszywy sukces na każdym kroku.** Dlatego cały pomiar idzie samodzielnym skryptem `tsx` uruchamianym BEZPOŚREDNIO (`npx tsx server/src/scripts/day282-przeplywy.ts`), NIGDY przez `npx vitest run`, wzorem istniejących `server/src/scripts/*RealDbProof.ts`, rozszerzonym o pełne `ApiGateway.getInstance().initializeRoutes(app)` + `app.listen(TWOJ_PORT_HARNESSU)` i realne żądania HTTP do własnego, lokalnie nasłuchującego serwera — nie do `express()` z wstrzykniętymi zależnościami. (2) `NODE_ENV=test` BEZ `RUN_DB_TESTS=1` podstawia atrapę bazy pod `DbPromise` — `pg.Pool` widzi wiersz, kod produkcyjny go nie widzi, i dostajesz dwie różne odpowiedzi z jednej bazy. Ustaw `RUN_DB_TESTS=1` i UDOWODNIJ w `R1`, że produkcyjna ścieżka odczytu widzi wiersz zapisany przez trasę. (3) `server/src/database/Database.ts:686` zwraca `changes:1` dla KAŻDEGO `UPDATE`, niezależnie od tego, czy `WHERE` cokolwiek trafił — **nie wolno uznać kroku za PRZESZEDŁ na podstawie odpowiedzi zapisu; każdy krok potwierdzasz ODCZYTEM NA ZIMNO nowym żądaniem**. (4) Retry w harnessie potrafi wyleczyć skutek własnego błędu — jeśli krok przechodzi dopiero za drugim razem, to jest ZERWANIE, nie sukces; zapisz obie próby. ★ Piąta, właściwa temu dyżurowi: `Gateway.ts` nie ma error middleware (jest dopiero w `index.ts:1747`) — **pusty `500` nie znaczy brak przyczyny**; przy każdym `500` zajrzyj w logi serwera i zapisz realny wyjątek, inaczej rejestr zerwań będzie bezwartościowy.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day282-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day282-przeplywy-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (środowisko: Postgres od zera, migracje dwukrotnie, dwie organizacje, dowód że produkcyjna ścieżka odczytu widzi zapis trasy) · R2 (szkielet pomiarowy poza vitest: ApiGateway nasłuchujący, rejestracja, token, kontrola pozytywna i negatywna) · R3 (FLOW-01 od rozmowy do wykonania — dziesięć kroków) · R4 (FLOW-02 wywiad do rekomendacji i FLOW-03 assessment do portfela) · R5 (FLOW-04 zarządzanie wykonaniem i FLOW-05 materiał z provenance) · R6 (FLOW-06 spotkanie i follow-up — moduł oznaczony `soon`, spodziewaj się BRAK MECHANIZMU i to też jest wynik) · R7 (rejestr zerwań + raport dyżuru)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6260` albo `5240 i 5241` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6260` albo `5240 i 5241`** (`Z7`).

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

`docs/program/CROSS_MODULE_FLOWS.md` opisuje **sześć przepływów** między modułami — od rozmowy do
wykonania, od wywiadu do rekomendacji, od oceny do portfela zmian, zarządzanie wykonaniem, materiał
z pełnym pochodzeniem, spotkanie i follow-up. Dokument ma datę `2026-07-29` i **własną sekcję
`Przepływy wymagające dalszej weryfikacji AS-IS` z sześcioma pozycjami** — czyli jego autorzy jawnie
zapisali, że tego nie sprawdzono. Od tamtej pory **nikt nie przeszedł żadnego przepływu od początku
do końca na żywym systemie.**

Program wchodzi w fazę pełnej integracji. Właściciel odebrał **warstwę ekranową szesnastu modułów** —
obejrzał ekrany i je zatwierdził. **Nie potwierdził ani jednego przejścia danych MIĘDZY modułami.**
Dziś nie wiemy, czy mamy system, czy szesnaście osobnych ekranów.

Ten dyżur odpowiada na to jednym pomiarem, krok po kroku.

## Co jest produktem tego dyżuru

**Rejestr zerwań** — jeden wiersz na każdy krok każdego z sześciu przepływów, z jednym z pięciu stanów:

| Stan | Kiedy go wpisujesz | Czego wymaga |
| --- | --- | --- |
| `PRZESZEDŁ` | krok realnie wykonany i potwierdzony **odczytem na zimno** | identyfikator utworzonego obiektu + dowód powiązania z obiektem z poprzedniego kroku |
| `ZERWANY` | krok wywołany, ale łańcuch się urywa | plik i linia, w której się urywa, + realna treść błędu z logów serwera |
| `BRAK MECHANIZMU` | kroku nie ma w kodzie w ogóle | dowód negatywny: czego szukałeś i gdzie |
| `ZA FLAGĄ` | krok istnieje, ale jest wyłączony | nazwa flagi + **miejsce jej odczytu**, nie deklaracji |
| `PODEJRZENIE` | wyczytałeś z kodu, ale **nie wywołałeś** | jawnie oznaczone jako niezmierzone |

★ **Stan `PRZESZEDŁ` wolno wpisać wyłącznie po realnym wywołaniu i odczycie.** Lektura kodu daje
najwyżej `PODEJRZENIE`. Ten rozdział jest sednem dyżuru — bez niego rejestr jest bezwartościowy.

## Czego ten dyżur świadomie NIE robi

- **Nie naprawia ani jednego zerwania.** Nawet jednolinijkowego. Nawet gdy masz pewność.
- **Nie ocenia jakości ekranów ani treści** — to inne dyżury.
- **Nie zmienia `docs/program/CROSS_MODULE_FLOWS.md`** — ten dokument opisuje stan DOCELOWY i zostaje
  nietknięty. Twój rejestr opisuje stan ZASTANY i leży obok.
- **Nie dotyka żadnego pliku w `src/` i `server/src/`** poza jednym nowym skryptem pomiarowym.

## ★ Zdanie, które ma Cię uratować przed moim błędem

**Zmierz moje liczby sam.** Piszę wyżej, że przepływów jest sześć, że dokument ma datę `2026-07-29`
i że sekcja `AS-IS` ma sześć pozycji. **Sprawdź to pierwszą komendą i jeśli którakolwiek liczba się
nie zgadza — napisz to w Korektach i pracuj na swojej, nie na mojej.** W tym programie wykonawcy
prostowali zlecenie nadzorcy cztery razy jednego dnia i za każdym razem mieli rację.

## R1 — ŚRODOWISKO (rdzeń)

Postgres od zera na porcie `PORT_DB`, migracje przepuszczone **dwukrotnie** (drugi przebieg musi być
bezczynny — jeśli nie jest, to jest znalezisko i zapisujesz je).

Zakładasz **dwie organizacje** realną trasą `POST /register` (nie `INSERT`-em):
organizację `A` (Twoja główna) i organizację `B` (obca — potrzebna, żeby przy każdym kroku
sprawdzić, że dane nie wyciekają poza organizację).

★★★ **Dowód, bez którego nie wolno iść dalej:** zapisz cokolwiek realną trasą HTTP, a następnie
odczytaj to **produkcyjną ścieżką odczytu**, nie przez `pg.Pool`. W programie zmierzono, że
`NODE_ENV=test` bez `RUN_DB_TESTS=1` podstawia atrapę bazy pod `DbPromise` — `pg.Pool` widzi wiersz,
kod produkcyjny go nie widzi. Jeśli te dwa odczyty się rozjeżdżają, **STOP całego dyżuru** i zapisz to
jako blokujący fakt środowiska.

Commit po `R1`.

## R2 — SZKIELET POMIAROWY POZA `VITEST` (rdzeń)

Jeden nowy plik: `server/src/scripts/day282-przeplywy.ts`, uruchamiany **wyłącznie** przez
`npx tsx server/src/scripts/day282-przeplywy.ts`.

Wzorzec bierzesz z istniejących `server/src/scripts/*RealDbProof.ts`, rozszerzony o:
`ApiGateway.getInstance().initializeRoutes(app)` + `app.listen(PORT_HARNESSU)` i **realne żądania HTTP
do własnego, lokalnie nasłuchującego serwera** — nie do `express()` z wstrzykniętymi zależnościami.

**Dwie kontrole, zanim zmierzysz cokolwiek:**

- **kontrola pozytywna** — żądanie, o którym wiesz, że MA przejść (np. odczyt własnego profilu).
  Jeśli nie przechodzi, masz zepsuty harness, nie zepsuty produkt.
- **kontrola negatywna** — to samo żądanie z tokenem organizacji `B`. **Jeśli przechodzi, masz dziurę
  między organizacjami i to jest ustalenie ważniejsze niż cały reszta dyżuru** — zapisz je na górze
  raportu i mierz dalej.

Commit po `R2`.

## R3 — FLOW-01, OD ROZMOWY DO WYKONANIA (rdzeń)

Dziesięć kroków, każdy osobnym wierszem rejestru. Kolejno: opis problemu w Czacie → zebranie kontekstu
i źródeł → przekazanie do Wywiadu/Narzędzi/Oceny → utworzenie propozycji inicjatywy → zatwierdzenie
w Inicjatywach → przejście do Realizacji → zadania w Mojej Pracy → pomiar w Wynikach → skutek
finansowy → raport w Materiałach.

★ **Warunek ukończenia zapisany w dokumencie brzmi: „wynik jest połączony z inicjatywą, wykonaniem
i źródłami".** Ostatni wiersz `FLOW-01` w rejestrze ma odpowiedzieć wprost, czy ten warunek jest
spełniony — i to jest najważniejsza pojedyncza odpowiedź całego dyżuru.

Przy każdym kroku: potwierdzenie **odczytem na zimno nowym żądaniem**. Nie odpowiedzią zapisu —
`server/src/database/Database.ts:686` zwraca `changes:1` dla każdego `UPDATE`, także takiego, który
nic nie trafił.

Commit po `R3`.

## R4 — FLOW-02 I FLOW-03 (rdzeń)

`FLOW-02` (wywiad do rekomendacji, sześć kroków; warunek ukończenia: **insight wskazuje pytania
i odpowiedzi źródłowe** — sprawdź to wprost, nie zakładaj) oraz `FLOW-03` (ocena do portfela zmian,
siedem kroków).

Commit po każdym przepływie osobno.

## R5 — FLOW-04 I FLOW-05 (rdzeń)

`FLOW-04` (zarządzanie wykonaniem, siedem kroków) oraz `FLOW-05` (materiał z pełnym pochodzeniem,
sześć kroków; ostatni krok brzmi **„eksport lub udostępnienie nie usuwa traceability"** — to jest
krok, który najłatwiej przechodzi pozornie, sprawdź go odczytem po eksporcie).

Commit po każdym przepływie osobno.

## R6 — FLOW-06 (rdzeń)

Spotkanie i follow-up. **Moduł jest oznaczony w dokumencie jako `soon`** — spodziewaj się serii
`BRAK MECHANIZMU`. **To też jest wynik i ma taką samą wartość jak `PRZESZEDŁ`.** Nie naciągaj kroków,
żeby cokolwiek przeszło.

Commit po `R6`.

## R7 — REJESTR I RAPORT (rdzeń)

Zapisujesz `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_ZERWAN_PRZEPLYWOW_20260902.md` w kształcie
opisanym w polu `J`, a w raporcie dyżuru — podsumowanie liczbowe: ile kroków `PRZESZEDŁ`, ile
`ZERWANY`, ile `BRAK MECHANIZMU`, ile `ZA FLAGĄ`, ile `PODEJRZENIE`, per przepływ i łącznie.

★ Sekcja **`TWIERDZENIA NIEZWERYFIKOWANE`** jest obowiązkowa: wszystko, czego nie zdążyłeś wywołać,
ma tu trafić z nazwy. Lepszy krótki rejestr z uczciwą listą dziur niż długi z domysłami.

★ Sekcja **`KOREKTY`**: każda liczba z tej instrukcji, która okazała się nieprawdziwa.

## Uwaga o długości i urwaniu okna

Ten dyżur ma siedem pozycji rdzenia i dotyka szesnastu modułów. W programie zmierzono, że instrukcja
na 1394 linie urwała okno wykonawcy **po fazie wejściowej, z zerem commitów** — cała praca do powtórki.

Dlatego: **commit i push po KAŻDEJ pozycji `R`, nigdy na koniec.** Jeśli okno się urwie, wznowienie
zaczyna od następnego `R`, a nie od zera. Jeśli czujesz, że nie dojedziesz do `R7` — **zatrzymaj się
świadomie po dowolnym przepływie, zapisz rejestr z tym, co masz, i zgłoś STOP z jawną listą
nieprzejechanych przepływów.** Częściowy rejestr z uczciwą granicą jest pełnowartościowym wynikiem.
