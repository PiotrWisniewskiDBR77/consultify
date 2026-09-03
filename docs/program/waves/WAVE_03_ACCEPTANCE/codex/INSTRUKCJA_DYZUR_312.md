# INSTRUKCJA DYŻURU nr 312 — Codex — „★★★ Sześć pozycji zostawionych przez odbiory adwersaryjne, w JEDNEJ ustalonej kolejności `296 → 297 → 293 → 292 → (f) 298 → (e) 295`, z prawem zatrzymania PO KAŻDEJ i plikiem postępu `/private/tmp/cx-day312-postep.md` aktualizowanym po każdej pozycji: **(a) 296 wycieki** — mapper `server/src/middleware/appErrorMapper.ts` istnieje i ma 5/5 zielonych testów, ale ma **ZERO wołaczy produkcyjnych**, a zamienionych jest **0 z 294** miejsc (mianownik odbiorcy: `git grep -E "error: \(err(or)? as Error\)\.message|error: err(or)?\.message|error: e\.message|message: \(err(or)? as Error\)\.message" -- server/src/routes | wc -l`) — wykonujesz `R3`-`R6`; **(b) 297 martwe od korzenia** — dyżur stanął na progu wolnego miejsca (§0.5, mniej niż 5 GB), dziś dysk jest wolny (mój pomiar: **36 GiB dostępne**; zlecenie mówi 45 GB — sprawdź sam, obie liczby są powyżej progu), `scripts/dev/reachability-from-root.mjs` **nie istnieje**, `R1`-`R6` do wykonania; **(c) 293 Biblioteka metodyk** — zero commitów, CAŁA instrukcja 293 do wykonania; **(d) 292 menu akcji Wywiadu** — `R1`-`R2` scalone, `R3`-`R6` do wykonania, a czwarty przypadek testu kontraktowego jest dziś grepem po napisie i wymaga wzmocnienia do asercji efektu; **(f) 298 silnik raportu Oceny** — `buildAcceptedDrdReportModel` ma wołacza WYŁĄCZNIE w teście, `methodSessionReportMetadataService` zero wołaczy, narrator LLM za flagą OFF nie powstał, a `save()` odrzuca obcego tenanta dopiero przez `get()` PO `INSERT` (mutacja odbiorcy: po usunięciu warunku organizacji obcy NADPISAŁ wiersz, a `save()` i tak zgłosiło odmowę); **(e) 295 dowody Mojej Pracy** — test enumeracji kontrolek dowodzi efektu dla **12 z 226** sygnatur, ekran `idea-table` to LISTA Idei, a narzędzie tabeli żyje na `idea-table-timeline-stuck` (`initialTool="table"`), więc mianownik to **86/54, nie 21/14**, a wyścig 409 poszedł po trasie bez frontowego wołacza (`P07_CONCURRENT_EDIT_CONFLICT`) zamiast po produkcyjnej `server/src/routes/v8/my-work.routes.ts` (`NOTEBOOK_PAGE_CONFLICT`)."

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
> **wyłącznie** `/private/tmp/cx-day312-domkniecia`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `763856d76b`**
> **Gałąź bazowa: `github-backup/grafika/m03-20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-03.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****DOMKNIĘCIA PO ODBIORACH ADWERSARYJNYCH 03.09 NOC.** Cztery odbiory (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/ODBIOR_DYZUROW_286_290_291_20260903.md`, `…_287_292_294_…`, `…_288_289_296_…`, `…_295_297_298_…` — **przeczytaj wszystkie cztery, w całości, w `R0`**) zostawiły sześć otwartych pozycji, każdą z jawnym werdyktem i jawnym dowodem. ★★ **NAJWAŻNIEJSZE W TYM DYŻURZE: CZTERY WORKTREE JUŻ ISTNIEJĄ z częściową pracą i masz je REUŻYĆ, nie tworzyć nowych** — `/private/tmp/cx-day292-wywiad-menu`, `/private/tmp/cx-day293-biblioteka`, `/private/tmp/cx-day296-wycieki-bledow`, `/private/tmp/cx-day297-martwe-od-korzenia` (każdy ma też `-scratch` i `-artefakty`). W każdym z nich zaczynasz od `git -C <worktree> log --oneline -5` i kontynuujesz od PIERWSZEJ niewykonanej pozycji `R`, na tej samej gałęzi. Dla pozycji (e) i (f) pracujesz w NOWYM worktree `/private/tmp/cx-day312-domkniecia` z markera. Mój pomiar liczby commitów ponad wspólnym przodkiem z linią integracyjną: **292 = 0** (bo `R1`-`R2` zostały już scalone), **293 = 0** (bo nie powstał ani jeden commit — sesja skończyła się read-only), **296 = 2**, **297 = 1**. ★ Dwa zera znaczą co innego — nie pomyl ich.**.
Trasy front: `Pozycja (d) 292: `src/components/Interview/**` (macierz akcji, kebab, preview), ekrany harnessu `karta-interview`, `karta-insight`, `interview-preview-canon`, dowody w `evidence/grafika/odbior-c-292/`. Pozycja (e) 295: `src/components/MyWork/IdeaTableTool.tsx` i rodzina narzędzi Idei; ★ ekran `dev-render/screens/idea-table.tsx` to LISTA Idei, a narzędzie tabeli montuje `dev-render/screens/idea-table-timeline-stuck.tsx` z `initialTool="table"` — dobór ekranu jest częścią dowodu, nie szczegółem. Pozycja (c) 293: ekrany Biblioteki metodyk w module Oceny (znajdź sam z instrukcji 293 i z `scripts/dev/g06-macierz-ekrany.json`). Pozycja (f) 298: akcja „Generuj raport” w Ocenie (`src/components/assessment/**`) — to jest brakujący przewód.`. Trasy tył: `Pozycja (a) 296: `server/src/middleware/appErrorMapper.ts` (104 linie, 5/5 testów), `scripts/dev/codemod-error-mapper.mjs`, `server/src/routes/**` (62 pliki, 294 wystąpienia), rejestr `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_WYCIEKI_BLEDOW_TRAS_20260903.md` (341 wierszy, każdy z napisem „oczekuje na codemod” w kolumnie PO). Pozycja (f) 298: `server/src/services/report/acceptedDrdReportModel.ts`, `server/src/services/report/methodSessionReportMetadataService.ts` (105 linii, ★ ZERO testów), migracja metryki badania, trasa generowania raportu w `server/src/routes/method-core.routes.ts`. Pozycja (e) 295: `server/src/routes/v8/my-work.routes.ts` (kod konfliktu `NOTEBOOK_PAGE_CONFLICT` — TU ma iść wyścig) kontra trasa z `P07_CONCURRENT_EDIT_CONFLICT` (bez frontowego wołacza). Pozycja (b) 297: `scripts/dev/reachability-from-root.mjs` (nie istnieje — masz go napisać).`.

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
WT=/private/tmp/cx-day312-domkniecia
MARKER=763856d76b

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day312-domkniecia-po-odbiorach-20260903 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day312-domkniecia/config.worktree"
cat "$VAULT/worktrees/cx-day312-domkniecia/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day312-domkniecia-scratch
mkdir -p /private/tmp/cx-day312-domkniecia-artefakty

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
git -C "$VAULT" log --oneline 763856d76b..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 763856d76b..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day312-domkniecia-po-odbiorach-20260903
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 763856d76b..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `6` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
# ★ UWAGA: ten dyzur pracuje w PIECIU drzewach. Ponizsze komendy uruchamiasz
# z katalogu domowego, PODAJAC sciezke przez -C. Nie robisz `cd` do cudzego worktree
# przed sprawdzeniem, ze on istnieje i na jakiej stoi galezi.

# (1) ★ TEZA: CZTERY worktree JUZ ISTNIEJA — REUZYWASZ ich, nie tworzysz nowych
ls -d /private/tmp/cx-day292-wywiad-menu /private/tmp/cx-day293-biblioteka /private/tmp/cx-day296-wycieki-bledow /private/tmp/cx-day297-martwe-od-korzenia
for w in cx-day292-wywiad-menu cx-day293-biblioteka cx-day296-wycieki-bledow cx-day297-martwe-od-korzenia; do echo "--- $w"; git -C /private/tmp/$w log --oneline -5; git -C /private/tmp/$w branch --show-current; done
#   oczekiwane: cztery katalogi + galezie codex/day29*; ZAPISZ ostatni commit kazdego — od niego kontynuujesz

# (2) ★ TEZA: dwa zera znacza co innego (292 scalone, 293 nietkniete)
for b in codex/day292-wywiad-menu-akcji-20260903 codex/day293-ocena-biblioteka-metodyk-20260903 codex/day296-wycieki-bledow-tras-20260903 codex/day297-martwe-komponenty-od-korzenia-20260903; do base=$(git -C "$VAULT" merge-base $b github-backup/grafika/m03-20260902); echo "$b commitow=$(git -C "$VAULT" rev-list --count $base..$b)"; done
#   oczekiwane: 292=0, 293=0, 296=2, 297=1 — ale 292 ma zero BO scalone, a 293 BO nic nie powstalo. Sprawdz to.

# (3) TEZA: mianownik wyciekow — TRZY rozne liczby, zadna nie uzgodniona; ustal SWOJA
git -C /private/tmp/cx-day296-wycieki-bledow grep -E "error: \(err(or)? as Error\)\.message|error: err(or)?\.message|error: e\.message|message: \(err(or)? as Error\)\.message" -- server/src/routes | wc -l
git -C /private/tmp/cx-day296-wycieki-bledow grep -n 'appErrorMapper\|mapAppErrorResponse' -- server/src | grep -v __tests__ | grep -v middleware/appErrorMapper | wc -l
#   oczekiwane: ~294 wystapien; ZERO wolaczy poza samym mapperem i jego testem (biblioteka bez wywolania).
#   Trzy krazace liczby: 305/69 (nadzorca), 341/71 (rejestr 296), 294/62 (odbiorca). ZADNA nie uzgodniona.

# (4) TEZA: 297 stanal na dysku, a dysk jest dzis wolny; skrypt nadal nie istnieje
df -h /
ls /private/tmp/cx-day297-martwe-od-korzenia/scripts/dev/reachability-from-root.mjs 2>&1
#   oczekiwane: powyzej 5 GB wolnego (moj pomiar: 36 GiB; zlecenie mowi 45 GB — obie powyzej progu)
#   oraz brak pliku reachability-from-root.mjs

# (5) TEZA: silnik raportu i serwis metryki nie maja wolaczy produkcyjnych (298)
#     ★ TE DWIE komendy uruchamiasz JUZ w swoim worktree:
cd "$WT"
git grep -n 'buildAcceptedDrdReportModel' -- server src scripts | grep -v __tests__ | wc -l
git grep -n 'methodSessionReportMetadataService' -- server src | grep -v __tests__ | wc -l
ls server/src/services/report/methodSessionReportMetadataService.ts server/src/services/report/acceptedDrdReportModel.ts 2>&1
#   oczekiwane: 0 i 0 wolaczy poza testami — to jest brakujacy przewod, ktory dokladasz

# (6) TEZA: ekran idea-table to LISTA, narzedzie tabeli jest gdzie indziej (295); porty wolne
grep -n 'initialTool' dev-render/screens/idea-table-timeline-stuck.tsx dev-render/screens/idea-table.tsx | head
lsof -nP -iTCP:5302 -sTCP:LISTEN; lsof -nP -iTCP:5303 -sTCP:LISTEN; lsof -nP -iTCP:6319 -sTCP:LISTEN; docker ps --format '{{.Names}}' | grep -c cx-day312 || true
#   oczekiwane: initialTool=table w idea-table-timeline-stuck; puste lsof, 0 kontenerow
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day312-domkniecia-po-odbiorach-20260903` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6319`. Twój JEDYNY port harnessu to `5302 i 5303`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day312-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajęte przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5449 oraz 6311-6313 (odbiorcy nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyżury 286-311 (bazy 6290-6318, harness 5250-5301). Twoje własne: baza 6319, harness 5302 i 5303. ★ UWAGA SZCZEGÓLNA: ten dyżur pracuje w CZTERECH cudzych worktree naraz — jeżeli wznawiasz pracę wymagającą bazy w worktree dyżuru 296 albo 297, i tak używasz SWOJEGO portu 6319 i SWOJEGO kontenera `cx-day312-pg`, nigdy portów tamtych dyżurów. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps. ★ ZAKAZ `pkill`/`killall` na `node`, `vite`, `playwright`, `grafika-zrzuty` — zabijasz wyłącznie własne PID-y (zapisz `$!`).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `Pozycja (f) 298: narrator LLM ma powstać **za flagą domyślnie OFF**, z testem fail-safe (błąd modelu → raport i tak powstaje). Flaga OFF także przy braku zmiennej środowiskowej — osobny przypadek testowy. Pozostałe pozycje bez flag. ★ Podpięcie silnika raportu pod akcję „Generuj raport” NIE idzie za flagę narratora: silnik deterministyczny jest tym, co właściciel zaakceptował, i ma działać domyślnie.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: `Per pozycja, bramki z ORYGINALNEJ instrukcji domykanego dyżuru (przeczytaj `INSTRUKCJA_DYZUR_292.md`, `_293.md`, `_296.md`, `_297.md`, `_295.md`, `_298.md` w `docs/program/waves/WAVE_03_ACCEPTANCE/codex/`) · dodatkowo: `server/src/middleware/__tests__/appErrorMapper.test.ts` (dziś 5/5 — nie zepsuj) · `server/src/services/report/__tests__/acceptedDrdReportModel.test.ts` · nowy `.pg.test.ts` tenantowy dla `methodSessionReportMetadataService` · `scripts/check-list-canon.sh` · `scripts/check-focus-canon.sh --ci` · `scripts/check-artefakt.sh` · wszystkie przebiegi z `--retry=0``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY312_DOMKNIECIA_PO_ODBIORACH_REPORT.md`. Dozwolone nowe pliki dokumentacyjne: raport zbiorczy pod `SCIEZKA_RAPORTU` oraz raporty per domknięta pozycja pod nazwami z ORYGINALNYCH instrukcji (`CODEX_DAY296_…`, `CODEX_DAY297_…`, `CODEX_DAY293_…`, `CODEX_DAY292_…` — te raporty nie istnieją i odbiory to jawnie odnotowały). Plik postępu `/private/tmp/cx-day312-postep.md` żyje POZA repo. Kod: zgodnie z zakresem każdej domykanej pozycji. Nowe pliki w `tests/` i `scripts/` wymagają `git add -f`. **ZAKAZ edycji `MODULE_ACCEPTANCE.md`.**. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day312-domkniecia-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day312-domkniecia-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ tworzenia nowych worktree dla dyżurów 292, 293, 296, 297** — reużywasz istniejących. **ZAKAZ zmiany gałęzi tamtych dyżurów na inną bazę i ZAKAZ `rebase`.** **ZAKAZ używania portów tamtych dyżurów** — baza i harness zawsze Twoje (6319, 5302-5303). **ZAKAZ zamykania pozycji rejestru, której nie domknąłeś w całości** — odbiory jawnie zabraniają zamykania `MYW-IDEAS-013`, `MYW-PHOTO-010`, `ASM-OWN-024/025` oraz jakiegokolwiek wiersza wycieków dyżurem 296. **ZAKAZ ruszania kolejności** — `296 → 297 → 293 → 292 → (f) → (e)`. **ZAKAZ `git stash`** (stos współdzielony, a Ty pracujesz w czterech drzewach). **ZAKAZ `pkill`/`killall`.** **ZAKAZ dotykania demo/staging/produkcji.** **ZAKAZ `--no-verify`.** **ZAKAZ edycji `MODULE_ACCEPTANCE.md`.** | Odbiory adwersaryjne zrobiły najtrudniejszą część pracy: nazwały z imienia to, co jest zrobione, i to, co tylko wygląda na zrobione. Bez tego dyżuru sześć pozycji zostaje w stanie, w którym rejestr mówi „scalone”, a produkt nie ma ani jednego wołacza — czyli w kształcie „biblioteka bez wywołania”, który program mierzy jako jedenasty rodzaj fałszywego gotowe. Drugi powód jest praktyczny: cztery worktree z częściową pracą już istnieją; ich odtworzenie od zera kosztowałoby więcej niż domknięcie. |

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
cd /private/tmp/cx-day312-domkniecia

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day312-pg psql -U postgres -d cx312 \
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
cd /private/tmp/cx-day312-domkniecia

docker run -d --name cx-day312-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx312 \
  -p 127.0.0.1:6319:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day312-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6319/cx312 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6319/cx312 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day312-domkniecia && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6319/cx312 \
JWT_SECRET=cx312-test-secret-do-not-reuse \
npx vitest run testy: per pozycja z oryginalnej instrukcji, zawsze `--retry=0`; testy serwera z cwd `server/` i `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgres://…:6319/cx312` (z roota `No test files found` = błąd komendy, nie PASS); dowody mutacyjne obowiązkowe dla: bezpiecznika wycieków (296), warunku tenantowego `save()` (298), asercji efektu kontrolek (295), wzmocnionego czwartego przypadku (292); dowód główny = plik postępu z sześcioma pozycjami i werdyktem każdej --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day312-domkniecia-artefakty/day312-domkniecia.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day312-domkniecia && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run testy: per pozycja z oryginalnej instrukcji, zawsze `--retry=0`; testy serwera z cwd `server/` i `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgres://…:6319/cx312` (z roota `No test files found` = błąd komendy, nie PASS); dowody mutacyjne obowiązkowe dla: bezpiecznika wycieków (296), warunku tenantowego `save()` (298), asercji efektu kontrolek (295), wzmocnionego czwartego przypadku (292); dowód główny = plik postępu z sześcioma pozycjami i werdyktem każdej --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day312-domkniecia-artefakty/day312-domkniecia.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day312-domkniecia/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day312-pg psql -U postgres -d cx312 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day312-pg`.
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
> **(e) ★★★ DZIEWIĘĆ PUŁAPEK. (1) ★ **NIE TWÓRZ nowych worktree dla 292/293/296/297** — one istnieją. Utworzenie katalogu za Codexa albo obok niego blokuje dyżur i miesza gałęzie; zaczynasz od `git -C <worktree> log --oneline -5` i kontynuujesz na tej samej gałęzi. (2) ★ **Dwa zera znaczą co innego**: 292 ma zero commitów ponad wspólnym przodkiem, BO jego `R1`-`R2` zostały już scalone; 293 ma zero, BO nic nie powstało. Sprawdź to sam i nie wyciągaj z liczby wniosku o pracy. (3) ★ **Trzy różne mianowniki dla rodziny wycieków**: 305/69 (pomiar nadzorcy), 341/71 (rejestr dyżuru 296), 294/62 (pomiar odbiorcy). Żaden nie jest uzgodniony. Zaczynasz od ustalenia SWOJEGO mianownika komendą z tytułu i pracujesz na nim, a rozbieżność opisujesz — mianownik nieodtwarzalny nie jest mianownikiem. (4) ★ **Biblioteka bez wywołania**: i 296, i 298 mają poprawny, przetestowany kod bez ani jednego konsumenta. Domknięcie oznacza PODŁĄCZENIE, nie kolejny test. (5) ★ **Bezpiecznik nagradza defekt** (298): `save()` sprawdza tenanta dopiero przez `get()` po `INSERT`, bez transakcji — po usunięciu warunku organizacji obcy nadpisał wiersz, a wołający i tak dostał komunikat o odmowie. Naprawa: warunek tenantowy w SAMYM zapisie plus transakcja plus test negatywny na parze „właściciel zapisuje / obcy nie nadpisuje”. (6) ★ **Grep po napisie nie jest testem kontraktowym** (292, czwarty przypadek): asercja ma dotyczyć EFEKTU akcji, nie obecności etykiety. (7) ★ **Przyrząd pokazuje nie produkt** (295): dobór ekranu jest częścią dowodu — `idea-table` to lista, narzędzie tabeli jest gdzie indziej; mianownik zmienia się z 21/14 na 86/54. (8) **Dowód na złej trasie** (295): wyścig 409 na trasie bez frontowego wołacza nie dowodzi niczego o produkcie — powtórz go na trasie produkcyjnej. (9) **Postęp musi być zapisany na dysku, nie w głowie**: `/private/tmp/cx-day312-postep.md` aktualizujesz PO KAŻDEJ pozycji; jeśli sesja padnie, następny wykonawca ma wiedzieć, gdzie stanąłeś.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day312-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day312-domkniecia-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (przeczytaj wszystkie CZTERY pliki odbiorów w całości; `git -C <worktree> log --oneline -5` w czterech istniejących worktree; załóż `/private/tmp/cx-day312-postep.md` z sześcioma pozycjami i stanem `NIEROZPOCZĘTE`) · R1 = pozycja (a) 296 w `/private/tmp/cx-day296-wycieki-bledow`: własny mianownik, codemod zastosowany grupami po 10 plików z commitem per grupa, bezpiecznik `noRawErrorMessage`, dowód runtime na Twojej bazie 6319, raport · R2 = pozycja (b) 297 w `/private/tmp/cx-day297-martwe-od-korzenia`: `scripts/dev/reachability-from-root.mjs` i całe `R1`-`R6` instrukcji 297 · R3 = pozycja (c) 293 w `/private/tmp/cx-day293-biblioteka`: cała instrukcja 293 od `R1` · R4 = pozycja (d) 292 w `/private/tmp/cx-day292-wywiad-menu`: `R3`-`R6` instrukcji 292, uzupełnienie sekcji „Stan PO” w rejestrze, wzmocnienie czwartego przypadku testu z grepu po napisie na asercję efektu · R5 = pozycja (f) 298 w `/private/tmp/cx-day312-domkniecia`: podpięcie `buildAcceptedDrdReportModel` pod akcję „Generuj raport”, narrator LLM za flagą OFF z testem fail-safe, warunek tenantowy w samym zapisie `methodSessionReportMetadataService.save()` plus transakcja plus test negatywny z dowodem mutacyjnym · R6 = pozycja (e) 295 w tym samym worktree: asercja EFEKTU dla każdej kontrolki albo wpis `MARTWE` z `plik:linia`, mianownik na właściwym ekranie (`idea-table-timeline-stuck`, `initialTool="table"`), wyścig 409 powtórzony na produkcyjnej trasie `v8/my-work.routes.ts` (`NOTEBOOK_PAGE_CONFLICT`) · R7 (raport zbiorczy: co domknięte, co nie, stan pliku postępu, TWIERDZENIA NIEZWERYFIKOWANE)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6319` albo `5302 i 5303` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6319` albo `5302 i 5303`** (`Z7`).

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

Cztery odbiory adwersaryjne z nocy 03.09 zrobiły najtrudniejszą część pracy: nazwały z imienia
to, co jest zrobione, i to, co tylko wygląda na zrobione. Zostało sześć pozycji. Dwie z nich —
mapper wycieków i silnik raportu Oceny — to poprawny, przetestowany kod bez ani jednego
konsumenta. To jest kształt „biblioteka bez wywołania”: zielone testy, zero kliknięć dla
właściciela. Domknięcie oznacza tu **podłączenie**, nie kolejny test.

## ★ Warunek startu: cztery worktree już istnieją

Nie twórz nowych dla dyżurów 292, 293, 296 i 297. Katalogi istnieją, mają częściową pracę
i własne gałęzie. Zaczynasz od odczytania ich historii i kontynuujesz od pierwszej niewykonanej
pozycji, na tej samej gałęzi. Utworzenie katalogu obok istniejącego miesza gałęzie i blokuje
dyżur. Dla pozycji 298 i 295 pracujesz w nowym worktree z markera.

## ★ Zmierz moje liczby sam

Twierdzę: 292 ma zero commitów ponad wspólnym przodkiem, bo jego wczesne pozycje zostały scalone;
293 ma zero, bo nic nie powstało; 296 ma dwa; 297 ma jeden. Rodzina wycieków to około 294
wystąpień; mapper ma zero wołaczy; silnik raportu ma zero wołaczy; skrypt osiągalności nie
istnieje; dysku jest ponad 36 GiB. Komendy z §0.3 to sprawdzają.
**Jeśli Twój pomiar przeczy mojej liczbie, obowiązuje Twój.**

★★ Osobno: dla rodziny wycieków krążą **trzy różne mianowniki** — 305 w 69 plikach, 341 w 71,
294 w 62. Żaden nie jest uzgodniony. Ustal SWÓJ jedną komendą, pracuj na nim i opisz rozbieżność.

## R0 — CZTERY ODBIORY I PLIK POSTĘPU

Przeczytaj wszystkie cztery pliki odbiorów w całości. Odczytaj historię czterech worktree.
Załóż `/private/tmp/cx-day312-postep.md` z sześcioma pozycjami. Aktualizujesz go **po każdej
pozycji** — jeśli sesja padnie, następny wykonawca musi wiedzieć, gdzie stanąłeś.

## R1 — (a) 296 WYCIEKI, w istniejącym worktree

Własny mianownik. Codemod zastosowany grupami po dziesięć plików, commit per grupa, esbuild
każdego pliku. Bezpiecznik z linią bazową zero. Dowód runtime na Twojej bazie. Raport, którego
dziś nie ma.

Prawo zatrzymania po tej pozycji. Zapis w pliku postępu.

## R2 — (b) 297 MARTWE OD KORZENIA, w istniejącym worktree

Dyżur stanął na progu wolnego miejsca. Dziś próg nie obowiązuje. Skrypt osiągalności od korzenia
nie istnieje — piszesz go i wykonujesz całą instrukcję 297 od jej pierwszej pozycji.

Prawo zatrzymania po tej pozycji. Zapis w pliku postępu.

## R3 — (c) 293 BIBLIOTEKA METODYK, w istniejącym worktree

Zero commitów. Cała instrukcja 293 od początku.

Prawo zatrzymania po tej pozycji. Zapis w pliku postępu.

## R4 — (d) 292 MENU AKCJI WYWIADU, w istniejącym worktree

Pozycje dowodowe i raport. Uzupełnienie sekcji „Stan PO” w rejestrze, która została pusta.
Czwarty przypadek testu kontraktowego jest dziś grepem po napisie — wzmacniasz go do asercji
EFEKTU akcji, z dowodem mutacyjnym.

Prawo zatrzymania po tej pozycji. Zapis w pliku postępu.

## R5 — (f) 298 SILNIK RAPORTU, w nowym worktree

Trzy rzeczy, w tej kolejności. Po pierwsze: podłączenie silnika pod akcję „Generuj raport” —
bez tego wartość dla właściciela wynosi zero kliknięć. Po drugie: warunek tenantowy w SAMYM
zapisie serwisu metryki, transakcja i test negatywny na parze „właściciel zapisuje / obcy nie
nadpisuje”, z dowodem mutacyjnym — dziś odmowa jest zgłaszana po fakcie, więc obcy zdąży
nadpisać wiersz, a wołający zobaczy komunikat o odmowie. Po trzecie: narrator LLM za flagą
domyślnie OFF z testem fail-safe.

Prawo zatrzymania po tej pozycji. Zapis w pliku postępu.

## R6 — (e) 295 DOWODY MOJEJ PRACY, w tym samym worktree

Każda kontrolka dostaje asercję efektu albo wpis `MARTWE` z plikiem i linią — dziś efekt jest
dowiedziony dla dwunastu sygnatur z dwustu dwudziestu sześciu. Mianownik liczysz na właściwym
ekranie: lista Idei to nie jest narzędzie tabeli. Wyścig konfliktu powtarzasz na trasie
produkcyjnej, nie na tej, która nie ma frontowego wołacza.

Prawo zatrzymania po tej pozycji. Zapis w pliku postępu.

## R7 — RAPORT ZBIORCZY

Co domknięte, co nie, stan pliku postępu, TWIERDZENIA NIEZWERYFIKOWANE.

## Prawo zatrzymania

Obowiązuje **po każdej pozycji z osobna**. „Domknięte 296 i 297, 293 rozpoczęte, reszta
nietknięta, plik postępu aktualny” jest pełnowartościowym wynikiem. Zamknięcie w rejestrze
pozycji, której nie domknąłeś w całości, nie jest — odbiory jawnie zabraniają zamykania
wskazanych wierszy, a rejestr, który kłamie, kosztuje więcej niż praca, której nie zrobiono.
