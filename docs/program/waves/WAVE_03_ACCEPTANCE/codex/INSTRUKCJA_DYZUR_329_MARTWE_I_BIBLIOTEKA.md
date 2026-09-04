# INSTRUKCJA DYŻURU nr 329 — Codex — „★★★ MARTWY KOD OD KORZENIA + BIBLIOTEKA METODYK — DWIE GAŁĘZIE LEŻĄ NIESCALONE: `codex/day297-martwe-komponenty-od-korzenia-20260903` scala się CZYSTO i wnosi analizator osiągalności od korzeni produktu (app `src/index.tsx`, harness `dev-render/main.tsx`, testy), ale jego ratchet pilnuje WYŁĄCZNIE klasy `unreachable` (729), przez co martwy plik produktowy z jednym testem ląduje w klasie `test-only` (1010 plików) i bramka kończy exit 0; `codex/day293-ocena-biblioteka-metodyk-20260903` ma DOKŁADNIE JEDEN konflikt (`AssessmentLibraryTab.day178.empty-state.test.ts`, HEAD niesie nowszy `4276ae770a` z zatwierdzoną treścią, a gałąź wyłącznie reformat prettiera kasujący komentarz G15) i 9/9 zielonych testów — ★ ale jest to JEDYNA gałąź zmieniająca WIDOCZNY EKRAN LISTOWY BEZ ANI JEDNEGO KADRU, a jej test kanonu MOCKUJE `@/components/standard`, więc nie dowodzi, że kanoniczna `StandardTable` się renderuje. ★★ PUŁAPKA REFÓW: dla 293 nie ma refu na `github-backup` w ogóle, a dla 297 ref zdalny (`682375d322`) to sam raport STOP bez narzędzia — scalasz LOKALNE refy vaulta `e4dc14df6e` i `e843a1c2fd`. Oba cudze worktree przy wydaniu były CZYSTE (0 plików), co rozstrzyga spór „4 czy 5 niezacommitowanych” na ZERO"

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
> **wyłącznie** `/private/tmp/cx-day329-martwe-i-biblioteka`.

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
Zakres: **OCENA (Biblioteka metodyk, ekran listowy) + PRZEKROJOWE (osiągalność plików od korzeni produktu). Scalenie dwóch niescalonych gałęzi, rozwiązanie jedynego konfliktu, objęcie klasy `test-only` ratchetem i wykonanie ośmiu kadrów PRZED/PO ekranu Biblioteki kanonicznym narzędziem zrzutowym**.
Trasy front: ``/assessment?tab=library` (`src/routes/AppRoutes.tsx`) → `AssessmentHub initialTab="library"` → `src/components/assessment/library/AssessmentLibraryTab.tsx` (realny `StandardTable` + `StandardPreview`); harness odbiorowy: `dev-render/screens/drd-library-entry.tsx` przez `?screen=drd-library-entry` na porcie 5495`. Trasy tył: `brak tras HTTP w zakresie tego dyżuru — katalog pięciu metodyk Biblioteki jest STATYCZNY w komponencie, a analizator osiągalności `scripts/dev/reachability-from-root.mjs` to narzędzie plikowe (AST przez `typescript`), które nie otwiera połączenia do bazy ani do sieci. ★ Dowód produkcyjnego HTTP dla akcji „Rozpocznij ocenę” NIE wchodzi do tego dyżuru — zostaje jako niezweryfikowane twierdzenie raportu 293 (pozycja R5)`.

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
WT=/private/tmp/cx-day329-martwe-i-biblioteka
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
git -C "$VAULT" worktree add "$WT" -b codex/day329-martwe-i-biblioteka-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day329-martwe-i-biblioteka/config.worktree"
cat "$VAULT/worktrees/cx-day329-martwe-i-biblioteka/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day329-martwe-i-biblioteka-scratch
mkdir -p /private/tmp/cx-day329-martwe-i-biblioteka-artefakty

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
git -C "$WT" push github-backup codex/day329-martwe-i-biblioteka-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 1c3d3da844ae03c87985a8f5dc74846a073c0220..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"
VAULT=/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git

# (1) ★★ TEZA ROZSTRZYGAJACA: obie galezie zyja jako LOKALNE refy vaulta,
#     a `github-backup` ma STARSZY albo ZADEN odpowiednik
git -C "$VAULT" for-each-ref --format='%(refname) %(objectname:short=10)' | grep -E "day29[37]"
#   moje wartosci: refs/heads/codex/day293-ocena-biblioteka-metodyk-20260903 e4dc14df6e
#                  refs/heads/codex/day297-martwe-komponenty-od-korzenia-20260903 e843a1c2fd
#                  refs/remotes/github-backup/codex/day297-...-20260903 682375d322
#   ★ PULAPKA: dla 293 NIE MA refu na `github-backup` w ogole, a dla 297 ref zdalny
#   wskazuje STARSZY commit (682375d322 = tylko raport STOP; e843a1c2fd = narzedzie).
#   Scalasz LOKALNE refy `codex/day293-...` i `codex/day297-...`, NIGDY `github-backup/...`.
#   Gdybys wzial ref zdalny 297, scalilbys sam raport STOP i zameldowal „scalone” bez kodu.

# (2) TEZA: 297 scala sie CZYSTO, 293 ma DOKLADNIE JEDEN konflikt
git merge-tree --write-tree HEAD codex/day297-martwe-komponenty-od-korzenia-20260903 | head -5
git merge-tree --write-tree HEAD codex/day293-ocena-biblioteka-metodyk-20260903 | head -10
#   oczekiwane: dla 297 sam SHA drzewa (zero linii CONFLICT); dla 293 trzy wiersze stage 1/2/3
#   i „CONFLICT (content): src/components/assessment/__tests__/AssessmentLibraryTab.day178.empty-state.test.ts”.

# (3) TEZA: konflikt 293 jest WYLACZNIE reformatem, a HEAD ma nowsza, ZATWIERDZONA tresc
git log --oneline -2 -- src/components/assessment/__tests__/AssessmentLibraryTab.day178.empty-state.test.ts
git diff HEAD codex/day293-ocena-biblioteka-metodyk-20260903 \
  -- src/components/assessment/__tests__/AssessmentLibraryTab.day178.empty-state.test.ts
#   moje liczby: HEAD ma 4276ae770a „test(assessment): align empty-state contract with approved copy”.
#   Roznica to przeniesiona linia importu, zawijanie wierszy przez prettier i USUNIETY komentarz
#   „Day 286 / G15: the approved product copy…”. Asercje sa TE SAME. ★ To jest pulapka 17
#   z §0.2d: reformat kasuje komentarz niosacy POWOD. Rozstrzygniecie: bierzesz wersje HEAD.

# (4) TEZA: oba cudze worktree sa CZYSTE — spor „4 czy 5 plikow” jest bezprzedmiotowy
git -C /private/tmp/cx-day293-biblioteka status --short | wc -l
git -C /private/tmp/cx-day297-martwe-od-korzenia status --short | wc -l
#   moje liczby: 0 i 0 — przy wydaniu instrukcji obie robocze kopie byly zacommitowane,
#   a spor „4 (instr-C) czy 5 (raport 312) niezacommitowanych plikow” rozstrzyga sie na ZERO.
#   ★★ TO JEST JEDYNY DOZWOLONY KONTAKT Z CUDZYMI WORKTREE (Z6): DWA POLECENIA `git status`
#   W TRYBIE ODCZYTU, przez `-C`, BEZ `cd`, BEZ zapisu, BEZ czytania i kopiowania plikow.
#   Jezeli zwroca cokolwiek innego niz 0 — NIE dotykasz tych plikow; wpisujesz liczbe i liste
#   nazw do raportu jako STOP MERYTORYCZNY dla pozycji i idziesz dalej.

# (5) TEZA: bezpiecznik 297 pilnuje TYLKO klasy `unreachable`
git show codex/day297-martwe-komponenty-od-korzenia-20260903:scripts/dev/reachability-from-root.mjs \
  | grep -n "check-baseline" -A 10
git show codex/day297-martwe-komponenty-od-korzenia-20260903:docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY297_MARTWE_OD_KORZENIA_REPORT.md \
  | grep -n "test-only\|unreachable\|4 808\|4808"
#   oczekiwane: `--check-baseline` porownuje wylacznie wiersze o klasie `unreachable`.
#   Raport 297 podaje: mianownik 4808, app=3040, harness-only=29, test-only=1010, unreachable=729.
#   ★ TO SA LICZBY Z CUDZEGO RAPORTU. Po scaleniu ZMIERZ JE SAM — to jest wejscie do R2.

# (6) TEZA: Biblioteka na obu stronach uzywa StandardTable (kanon list), a test kanonu go MOCKUJE
grep -n "StandardTable\|StandardPreview" src/components/assessment/library/AssessmentLibraryTab.tsx | head
git show codex/day293-ocena-biblioteka-metodyk-20260903:src/components/assessment/library/AssessmentLibraryTab.tsx \
  | grep -n "StandardTable\|StandardPreview" | head
git show codex/day293-ocena-biblioteka-metodyk-20260903:src/components/assessment/library/__tests__/AssessmentLibraryTab.canon.test.tsx \
  | grep -n "vi.mock('@/components/standard'"
#   oczekiwane: obie wersje osadzaja realny `StandardTable`; test kanonu z 293 MOCKUJE
#   `@/components/standard`, wiec dowodzi KONTRAKTU KOLUMN, a NIE tego, ze kanoniczna tabela
#   sie renderuje. ★ To jest kszalt „przyrzad pokazuje nie produkt” — zielony test kanonu
#   NIE zastepuje kadru.

# (7) TEZA: ekran Biblioteki ma REALNY przewod w harnessie i jest w macierzy G06
sed -n '1,30p' dev-render/screens/drd-library-entry.tsx
grep -n "drd-library-entry" scripts/dev/g06-macierz-ekrany.json
grep -n "canvas-toolbar-md-history" scripts/dev/g06-macierz-ekrany.json
#   oczekiwane: `drd-library-entry.tsx` renderuje REALNY `<AssessmentHub initialTab="library">`
#   (naprawa przewodu 2026-09-03 — wczesniej byl REPLIKA i uwaga wlasciciela dotyczyla przyrzadu);
#   `drd-library-entry` stoi w macierzy w grupie `04_ASSESSMENT`;
#   `canvas-toolbar-md-history` stoi w grupie `13_CHAT` — zostal PRZYWROCONY po bledym usunieciu.
#   ★ ZAKAZ usuwania czegokolwiek z tej macierzy na podstawie pomiaru, ktorego drugi pomiar
#   nie potwierdza.

# (8) TEZA: bramki kanonu dzis zielone i znasz ich dlug wejsciowy
bash scripts/check-list-canon.sh   2>&1 | tail -2; echo "list-canon=$?"
bash scripts/check-artefakt.sh     2>&1 | tail -2; echo "artefakt=$?"
bash scripts/check-focus-canon.sh --ci 2>&1 | tail -2; echo "focus-canon=$?"
#   moje liczby: list-canon 368/368 (dlug nie rosnie), artefakt 8/9, focus-canon 61 plikow/169
#   wystapien — wszystkie kod 0. Te liczby zapisujesz PRZED scaleniem i porownujesz PO.

# (9) TEZA: zasoby wolne
lsof -nP -iTCP:6355 -sTCP:LISTEN; lsof -nP -iTCP:5495 -sTCP:LISTEN
docker ps -a --format "{{.Names}}" | grep -c cx-day329 || true
df -h /
#   oczekiwane: puste lsof, 0 kontenerow. Port 5495 to Twoj harness dev-render.
#   Ponizej 5 GB wolnego to STOP calosci (§0.5).
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day329-martwe-i-biblioteka-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6355`. Twój JEDYNY port harnessu to `5495`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day329-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajęte przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5479 oraz 6290-6339 (dyzury 286-323), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Dyżury równoległe tej serii: 327 (baza 6353, harness 5493, kontener cx-day327-pg), 328 (baza 6354, harness 5494, kontener cx-day328-pg), 329 (baza 6355, harness 5495, kontener cx-day329-pg) — do CUDZEJ bazy nie łączysz się nawet do odczytu; każdy inny port z przedziałów 5300-5492, 5496-5499, 6300-6352 i 6356-6399 jest cudzy. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps. ★ ZAKAZ `pkill`/`killall` na `node`, `vite`, `playwright` — zabijasz wyłącznie własne PID-y (zapisz `$!`).`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur nie wprowadza ani jednej nowej flagi funkcyjnej i nie zmienia wartości domyślnej żadnej istniejącej. Ekran Biblioteki NIE jest za flagą: jest to istniejąca zakładka, którą scalenie przebudowuje, dlatego warunkiem odbioru są KADRY, a nie przełącznik`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``.github/workflows/**` w całości · `package.json` · `scripts/dev/p0p1-licznik-e1.mjs` (teren dyżuru 328) · `scripts/dev/i18n-pl-audyt.mjs`, `tests/unit/config/i18n*`, `tests/unit/frontend/noRawErrorInJsx.test.ts`, `tests/unit/backend/security/noRawErrorMessage.test.ts`, `tests/unit/backend/schema/noRuntimeDdl.test.ts` (teren dyżuru 327) · `server/src/middleware/auth.middleware.ts`, `server/src/Gateway.ts`, `server/src/middleware/orgContext.middleware.ts` · `scripts/check-list-canon.sh`, `scripts/check-artefakt.sh`, `scripts/check-focus-canon.sh` — URUCHAMIASZ, nie zmieniasz; naruszenie naprawiasz KODEM, nigdy progiem i nigdy `--no-verify` · `scripts/dev/grafika-zrzuty.mjs` i `scripts/dev/g06-macierz-ekrany.json` — kanoniczne narzędzie zrzutowe i macierz ekranów, tylko odczyt. ★ W tym dyżurze NIE MA wyjątku od `Z12``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY329_MARTWE_I_BIBLIOTEKA_REPORT.md`. ZAKAZ edycji `MODULE_ACCEPTANCE.md` — ten dyżur scala cudzą pracę i wykonuje kadry, ale nie domyka modułu Ocena (akcept właściciela jest osobnym krokiem u nadzorcy). Dozwolona AKTUALIZACJA (dopisanie sekcji o domknięciu z datą, nigdy nadpisanie) dwóch raportów wnoszonych przez scalenia: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY293_BIBLIOTEKA_METODYK_REPORT.md` i `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY297_MARTWE_OD_KORZENIA_REPORT.md`. Nowe pliki w `tests/` wymagają `git add -f`. ★ KADRY, LOGI I PLIKI WYNIKOWE NIE WCHODZĄ DO REPO. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day329-martwe-i-biblioteka-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day329-martwe-i-biblioteka-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ SCALANIA REFU ZDALNEGO ZAMIAST LOKALNEGO.** Dla 293 refu na `github-backup` NIE MA, dla 297 jest STARSZY (`682375d322` = sam raport STOP). Scalasz `codex/day293-…` i `codex/day297-…` z vaulta i wpisujesz oba SHA do raportu. **ZAKAZ WEJŚCIA DO CUDZYCH WORKTREE** (`/private/tmp/cx-day293-biblioteka`, `/private/tmp/cx-day297-martwe-od-korzenia`) poza dwoma poleceniami `git -C <ścieżka> status --short` w trybie odczytu — bez `cd`, bez `cat`, bez kopiowania plików, bez zapisu. **ZAKAZ USUWANIA JAKIEGOKOLWIEK PLIKU PRODUKTU** — 729 pozycji klasy `unreachable` to KANDYDACI do klasyfikacji, nie lista do `rm`. **ZAKAZ PISANIA WŁASNEGO SKRYPTU ZRZUTOWEGO** obok kanonicznego `scripts/dev/grafika-zrzuty.mjs`. **ZAKAZ USUWANIA EKRANU Z `scripts/dev/g06-macierz-ekrany.json`** na podstawie pomiaru, którego drugi pomiar nie potwierdza — tak zniknął `canvas-toolbar-md-history` i musiał być przywrócony. **ZAKAZ ODDANIA PARY KADRÓW BAJTOWO IDENTYCZNYCH** — dwie identyczne sumy `shasum` w parze light/dark to ZERO dowodu; kontrola jest trójwymiarowa (suma + jasność + rozmiar). **ZAKAZ OGŁASZANIA AKCEPTU WŁAŚCICIELA** — produktem są kadry i pomiary, akcept jest krokiem nadzorcy. **ZAKAZ budowania własnej tabeli** — ekran listowy WYŁĄCZNIE `StandardTable` i `StandardModuleBar`; potwierdzasz to bramką `scripts/check-list-canon.sh`, nie lekturą. **ZAKAZ osłabienia trzech asercji w `AssessmentLibraryTab.day178.empty-state.test.ts` i kasowania komentarza `Day 286 / G15`.** **ZAKAZ `pkill`/`killall`** na `node`, `vite`, `playwright` — harness zabijasz WYŁĄCZNIE po własnym PID. **ZAKAZ tworzenia pliku w `server/migrations/`** — przedział nieprzydzielony. **ZAKAZ `git stash`** — kadr PRZED robisz z osobnego, własnego worktree z markera albo jako pierwszą czynność dyżuru | Dwie gałęzie leżą gotowe i nikt ich nie scalił — praca jest wykonana, testy zielone, a produkt jej nie ma. To jest zmierzony w programie kształt „zbudowane, ale niepodłączone”: właściwa rzecz jest w kodzie, brakuje ostatniego przewodu. Do tego dokładają się trzy pułapki, każda z własnym incydentem: ref zdalny STARSZY od lokalnego (scalenie złego refu dałoby „scalone” bez ani jednej linii kodu), reformat prettiera kasujący komentarz niosący POWÓD zatwierdzonej treści (pułapka 17 z §0.2d), oraz test kanonu, który MOCKUJE kanon — czyli „przyrząd pokazuje nie produkt”. Najważniejsze: gałąź 293 zmienia WIDOCZNY EKRAN LISTOWY i nie ma pod sobą ani jednego kadru, a `CLAUDE.md` reguła 7 jest nienaruszalna — właściciel NIGDY nie jest pierwszym testerem wizualnym; powodem tej reguły było załamanie 07-11. Zielone testy kadru nie zastępują |

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
cd /private/tmp/cx-day329-martwe-i-biblioteka

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day329-pg psql -U postgres -d cx329 \
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
cd /private/tmp/cx-day329-martwe-i-biblioteka

docker run -d --name cx-day329-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx329 \
  -p 127.0.0.1:6355:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day329-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6355/cx329 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6355/cx329 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day329-martwe-i-biblioteka && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6355/cx329 \
JWT_SECRET=cx329-test-secret-do-podpisu-tokenow-w-tym-dyzurze \
npx vitest run src/components/assessment/library src/components/assessment/__tests__ tests/unit/canon/reachabilityFromRoot.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day329-martwe-i-biblioteka-artefakty/day329-biblioteka.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day329-martwe-i-biblioteka && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/components/assessment/library src/components/assessment/__tests__ tests/unit/canon/reachabilityFromRoot.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day329-martwe-i-biblioteka-artefakty/day329-biblioteka.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day329-martwe-i-biblioteka/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day329-pg psql -U postgres -d cx329 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day329-pg`.
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
> **(e) nie dotyczy w warstwie strażników HTTP — Biblioteka renderuje STATYCZNY katalog pięciu metodyk zaszyty w komponencie, a analizator osiągalności to narzędzie plikowe. Dowód, że żaden strażnik nie leży na ścieżce: `grep -lE "ApiGateway|verifyToken|v8FeatureGate|resultsInternalBetaVisibility" src/components/assessment/library/AssessmentLibraryTab.tsx dev-render/screens/drd-library-entry.tsx` — oczekiwane: zero trafień, uruchom to i wklej wynik. ★ Pułapki WŁAŚCIWE temu dyżurowi są dwie i obie leżą w PRZYRZĄDZIE, nie w produkcie: (i) `dev-render/screens/drd-library-entry.tsx` był do 2026-09-02 REPLIKĄ sklejającą własny `StandardTable` bez importu Huba — uwaga właściciela z tamtego dnia dotyczyła więc przyrządu, a nie ekranu; od 2026-09-03 plik renderuje REALNY `<AssessmentHub initialTab="library">` i tego stanu NIE WOLNO cofnąć; (ii) `AssessmentLibraryTab.canon.test.tsx` woła `vi.mock('@/components/standard')`, więc zielony test kanonu dowodzi kontraktu kolumn, a NIE tego, że kanoniczna tabela się renderuje**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day329-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day329-martwe-i-biblioteka-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1, R2, R3, R4`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6355` albo `5495` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6355` albo `5495`** (`Z7`).

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

Dwie gałęzie leżą gotowe i **nikt ich nie scalił**. Praca jest wykonana, testy są zielone,
a produkt jej nie ma — to jest zmierzony w programie kształt **„zbudowane, ale
niepodłączone"**: właściwa rzecz jest w kodzie, brakuje ostatniego przewodu.

**Gałąź `codex/day297-martwe-komponenty-od-korzenia-20260903`** — scala się **czysto**
(4 pliki, `+947`). Wnosi analizator osiągalności `scripts/dev/reachability-from-root.mjs`,
bazę `reachability.baseline.json` i bezpiecznik `tests/unit/canon/reachabilityFromRoot.test.ts`.
Narzędzie mierzy **osiągalność od korzenia** (`src/index.tsx` dla aplikacji,
`dev-render/main.tsx` dla harnessu, wszystkie pliki testowe dla testów) — i to jest
metoda **poprawna**. Metoda „plik bez importera", której program używał wcześniej, liczy
importy **wewnątrz martwego poddrzewa** jako żywe; przez nią `NotificationSettingsV2`
(8 plików + hook) ominął listę 238. Ale bezpiecznik ma dziurę: `--check-baseline`
porównuje **wyłącznie klasę `unreachable` (729 plików)**. Martwy plik produktowy, do którego
został jeden test, ląduje w klasie `test-only` — a tych jest **1010** — i bramka kończy
`exit 0`.

**Gałąź `codex/day293-ocena-biblioteka-metodyk-20260903`** — **jeden konflikt**, na pliku
`src/components/assessment/__tests__/AssessmentLibraryTab.day178.empty-state.test.ts`.
Wnosi przebudowaną Bibliotekę metodyk (6 plików, `+409/−144`), 9/9 testów zielonych.
★★ **To jest jedyna z tych dwóch gałęzi, która zmienia WIDOCZNY EKRAN LISTOWY — i nie ma
pod sobą ANI JEDNEGO KADRU.** Raport 293 mówi to wprost: „Nie wykonano wymaganych 8 kadrów
light/dark pl/en, pełnego przeglądu checklisty triady, porównania wizualnego PRZED/PO ani
akceptu właściciela". Zielone testy **nie zastępują kadru**, a `CLAUDE.md` reguła 7 jest
nienaruszalna: **właściciel nigdy nie jest pierwszym testerem wizualnym**.

**Trzy pułapki, które rozstrzygam za Ciebie, żebyś nie odkrył ich w połowie pracy:**

1. **Refy zdalne kłamią.** Dla gałęzi 293 **nie ma żadnego refu na `github-backup`**, a dla
   297 ref zdalny (`682375d322`) wskazuje **starszy** commit — sam raport STOP, bez
   narzędzia. Scalasz **lokalne refy vaulta** (`e4dc14df6e`, `e843a1c2fd`), nigdy
   `github-backup/…`. Gdybyś wziął ref zdalny 297, scaliłbyś raport STOP i zameldował
   „scalone" bez kodu.
2. **Konflikt 293 jest wyłącznie reformatem.** `HEAD` ma nowszy commit `4276ae770a`
   („align empty-state contract with approved copy") z komentarzem `Day 286 / G15`, który
   niesie **powód** brzmienia. Wersja z 293 przepuściła plik przez `prettier`: przeniosła
   import, zawinęła wiersze i **skasowała komentarz**. Asercje są identyczne. To jest
   pułapka 17 z `§0.2d`. **Rozstrzygnięcie: bierzesz wersję `HEAD`.**
3. **Test kanonu Biblioteki mockuje kanon.** `AssessmentLibraryTab.canon.test.tsx` woła
   `vi.mock('@/components/standard', …)`, więc dowodzi **kontraktu kolumn**, a **nie**
   tego, że kanoniczna `StandardTable` się renderuje. Zielony test kanonu to nie jest dowód
   kanonu — to kształt „przyrząd pokazuje nie produkt".

**Czego ten dyżur NIE robi.** Nie usuwa ani jednego pliku produktu. Narzędzie 297
**klasyfikuje kandydatów**, a nie zatwierdza do skasowania — 729 to liczba do
rozstrzygnięcia, nie lista do `rm`. Usunięcie czegokolwiek z produktu wymagałoby własnego
dyżuru z własnymi kadrami.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze `1c3d3da844ae03c87985a8f5dc74846a073c0220`:

- `codex/day297-…` = `e843a1c2fd` lokalnie, `682375d322` na `github-backup` (**starszy**);
  `codex/day293-…` = `e4dc14df6e` lokalnie, **brak refu zdalnego**;
- `git merge-tree --write-tree HEAD codex/day297-…` → **zero konfliktów**;
  `… codex/day293-…` → **dokładnie jeden** konflikt, na
  `AssessmentLibraryTab.day178.empty-state.test.ts`;
- diff 297 wobec markera: **4 pliki, +947**; diff 293: **6 plików, +409/−144**;
- oba cudze worktree (`/private/tmp/cx-day293-biblioteka`, `/private/tmp/cx-day297-martwe-od-korzenia`)
  miały przy wydaniu **0** niezacommitowanych plików — spór „4 czy 5" rozstrzyga się
  **na zero**;
- narzędzie 297 klasyfikuje: mianownik **4808** plików `src/`, `app = 3040`,
  `harness-only = 29`, `test-only = 1010`, `unreachable = 729` (**liczby z cudzego raportu
  — zmierz je sam po scaleniu**);
- `--check-baseline` pilnuje **wyłącznie** klasy `unreachable`;
- obie wersje `AssessmentLibraryTab.tsx` osadzają realny `StandardTable` (`HEAD` w wierszu
  ok. 458, gałąź 293 ok. 548);
- `drd-library-entry` stoi w `scripts/dev/g06-macierz-ekrany.json` w grupie `04_ASSESSMENT`;
  `canvas-toolbar-md-history` stoi w grupie `13_CHAT` (**przywrócony po błędnym usunięciu**);
- bramki: `check-list-canon` kod `0`, dług `368/368`; `check-artefakt` kod `0`, `8/9`;
  `check-focus-canon --ci` kod `0`, baseline `61 plików / 169 wystąpień`;
- liście `translation.json`: pl `35198`, en `33065` (licznik surowy) — **żaden nie może
  zmaleć**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: KOMPONENT · POWŁOKA · KONTRAKT · HARNESS · TEST · BRAMKA

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Komponent listy** | `src/components/assessment/library/AssessmentLibraryTab.tsx` | **★ PEŁNA LICENCJA** w zakresie `R1` — wyłącznie jako **wynik scalenia** gałęzi 293 i rozwiązania konfliktu. Zakaz pisania nowej wersji od zera | — |
| **Powłoka modułu** | `src/components/assessment/AssessmentHub.tsx` | **★ WĄSKA LICENCJA:** wyłącznie zmiany wnoszone przez scalenie 293 (przełączenie zakładki `library`). Zakaz zmian spoza tego diffu | Brief + diff nienałożony |
| **Kontrakt kanonu** | `src/components/assessment/library/__tests__/AssessmentLibraryTab.canon.test.tsx` (**NIE ISTNIEJE na markerze** — NOWY, wnoszony przez scalenie 293) | **★ PEŁNA LICENCJA**: wolno **dodawać** asercje, w szczególności taką, która sprawdza kanon **bez mockowania** `@/components/standard` | — |
| **Kontrakt stanu pustego** | `src/components/assessment/__tests__/AssessmentLibraryTab.day178.empty-state.test.ts` | **★ WĄSKA LICENCJA:** wyłącznie **rozwiązanie konfliktu**. ★★ Rozstrzygnięcie z góry: **bierzesz wersję `HEAD`** (commit `4276ae770a`, z komentarzem `Day 286 / G15`). Zakaz kasowania komentarza i zakaz osłabiania trzech asercji | — |
| **Test komponentu** | `tests/components/assessment/library/AssessmentLibraryTab.test.tsx` | **★ PEŁNA LICENCJA** w zakresie scalenia | — |
| **Harness ekranu** | `dev-render/screens/drd-library-entry.tsx`, `dev-render/mocks/assessmentHubHarness.*` | **★ WĄSKA LICENCJA:** wyłącznie to, co konieczne, żeby ekran renderował się po scaleniu. ★★ **Zakaz zamiany realnego `AssessmentHub` na replikę** — ten plik był repliką do 2026-09-02 i przez to uwaga właściciela dotyczyła przyrządu, nie produktu | Brief: co blokuje render, plik:linia, diff nienałożony |
| **Macierz ekranów** | `scripts/dev/g06-macierz-ekrany.json` | **TYLKO ODCZYT.** ★★ **ZAKAZ usuwania ekranu z macierzy na podstawie pomiaru, którego drugi pomiar nie potwierdza** — tak zniknął `canvas-toolbar-md-history` i musiał być przywrócony | Wpis do raportu z dwoma niezależnymi pomiarami |
| **Narzędzie osiągalności** | `scripts/dev/reachability-from-root.mjs` (**NIE ISTNIEJE na markerze** — wnoszone przez scalenie 297) | **★ PEŁNA LICENCJA** w zakresie `R2`–`R3`. Zakaz zmiany definicji korzeni bez wiersza w tabeli decyzji | — |
| **Bezpiecznik osiągalności** | `tests/unit/canon/reachabilityFromRoot.test.ts` (**NIE ISTNIEJE na markerze** — wnoszony przez scalenie 297) | **★ PEŁNA LICENCJA**: wolno **dodawać** przypadki. Istniejące dwa wolno zmienić wyłącznie razem z jawnym wpisem o zmianie kontraktu | — |
| **Baza osiągalności** | `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (**NIE ISTNIEJE na markerze** — wnoszona przez scalenie 297) | **★ PEŁNA LICENCJA — ale WYŁĄCZNIE jako PRODUKT NARZĘDZIA** (`--update-baseline`). Ręczna edycja zakazana | — |
| **Narzędzie zrzutowe** | `scripts/dev/grafika-zrzuty.mjs` | **TYLKO ODCZYT.** ★★ **ZAKAZ pisania własnego skryptu zrzutowego obok kanonicznego.** Brakującą funkcję dokłada się narzędziu, opt-in, z parametrami zapisanymi na trwałe — i to jest osobna praca, nie ta | Brief: jakiej opcji zabrakło i jak wyglądałby jej parametr |
| **Bramki kanonu** | `scripts/check-list-canon.sh`, `scripts/check-artefakt.sh`, `scripts/check-focus-canon.sh` | **TYLKO ODCZYT — uruchamiasz, nie zmieniasz.** Naruszenie naprawiasz **kodem**, nigdy progiem i nigdy `--no-verify` | Opis w raporcie + diff nienałożony |
| **Słowniki** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie. **Liczba liści nie może zmaleć**: pl `35198`, en `33065` | — |
| **Raport 293** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY293_BIBLIOTEKA_METODYK_REPORT.md` (**NIE ISTNIEJE na markerze** — wnoszony przez scalenie 293) | **★ WĄSKA LICENCJA:** wyłącznie **dopisanie** sekcji o domknięciu, z datą. Zakaz nadpisywania sekcji „Twierdzenia niezweryfikowane" | — |
| **Raport 297** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY297_MARTWE_OD_KORZENIA_REPORT.md` (**NIE ISTNIEJE na markerze** — wnoszony przez scalenie 297) | **★ WĄSKA LICENCJA:** jak wyżej | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY329_MARTWE_I_BIBLIOTEKA_REPORT.md` (**NOWY — nie istnieje na markerze**) | `R6` — **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| **★★ Cudze worktree** | `/private/tmp/cx-day293-biblioteka`, `/private/tmp/cx-day297-martwe-od-korzenia` | **ODCZYT WYŁĄCZNIE PRZEZ `git -C <ścieżka> status --short`** — dwa polecenia, `Z6` jest w tym jednym punkcie **zawężony imiennie**, a nie zniesiony. **Zakaz `cd`, zakaz `cat`, `ls`, `grep -r`, zakaz kopiowania plików, zakaz jakiegokolwiek zapisu, zakaz `git checkout`/`add`/`commit` w tych katalogach** | Jeżeli `status` pokaże cokolwiek: **wpisujesz liczbę i nazwy do raportu jako STOP MERYTORYCZNY tej pozycji i idziesz dalej** — nie ratujesz cudzej roboty |
| **Cudze tereny** | `scripts/dev/i18n-pl-audyt.mjs`, `tests/unit/config/i18n*`, `tests/unit/frontend/noRawErrorInJsx.test.ts`, `tests/unit/backend/security/noRawErrorMessage.test.ts`, `tests/unit/backend/schema/noRuntimeDdl.test.ts` (dyżur 327) · `scripts/dev/p0p1-licznik-e1.mjs`, `.github/workflows/**`, `package.json` (dyżur 328) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem plik:linia i idziesz dalej |

## ★★ ROZSTRZYGNIĘCIE WOBEC `§0.2c` — WARIANT (C), Z JEDNYM WYJĄTKIEM NA HARNESS

**(1) Wariant (C), bez kontenera.** Ani scalenie, ani narzędzie osiągalności, ani testy
komponentowe Biblioteki nie otwierają połączenia do bazy. Pracujesz w wariancie (C)
(`RUN_DB_TESTS=0 MOCK_DB=true`), **kontenera nie stawiasz**. Porty `6355`/`5495` i nazwa
`cx-day329-pg` pozostają zarezerwowane niezależnie od tego, czy ich użyjesz.

**(2) Harness zrzutowy to NIE jest runtime produktu.** Kadry robisz na
`dev-render` (`npx vite --config dev-render/vite.config.ts --port 5495 --strictPort`),
który jest **czystym frontem z mockami** — nie uruchamiasz `server/src/index.ts`, nie
uruchamiasz `scripts/dev/start-wave3-owner-runtime.mjs`, nie stawiasz bazy. Dzięki temu
**cały wyjątek z `§0.2b` punkt (4) NIE MA tu zastosowania**, a dowód `Z30` sprowadza się
do dwóch zdań: brak zmiennych SMTP i brak bazy dyżuru. Wpisz je dosłownie.

**(3) Runner testów.** Pakiety Biblioteki są `vitest`-owe (wariant C, `--retry=0`).
Pakiet `tests/unit/canon/reachabilityFromRoot.test.ts` jest **też** `vitest`-owy, ale
**woła narzędzie przez `execFileSync` i ma limit 30 s na przypadek** — nie skracaj go
i nie uruchamiaj go równolegle z drugim ciężkim pakietem.

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | tipy obu gałęzi, lokalnie i zdalnie | `e4dc14df6e` / brak · `e843a1c2fd` / `682375d322` | komenda (1) z `§0.3` | TAK — **pokazuje ref lokalny I zdalny, bo one się różnią** |
| 2 | konflikty przy scalaniu 297 | `0` | `git merge-tree --write-tree HEAD codex/day297-…` | TAK — próbne scalenie bez dotykania drzewa roboczego |
| 3 | konflikty przy scalaniu 293 | `1` plik | `git merge-tree --write-tree HEAD codex/day293-…` | TAK |
| 4 | rozmiar diffów wobec markera | 297: `4` pliki `+947` · 293: `6` plików `+409/−144` | `git diff --stat HEAD...<gałąź>` | TAK |
| 5 | niezacommitowane pliki w cudzych worktree | `0` i `0` | komenda (4) z `§0.3` | TAK — **jedyny dozwolony kontakt z cudzym worktree** |
| 6 | klasy osiągalności | `3040/29/1010/729` z `4808` | po scaleniu: `node scripts/dev/reachability-from-root.mjs \| head -20` | TAK — **przed scaleniem to liczby CYTOWANE; oznacz je jako niezweryfikowane własnym przebiegiem** |
| 7 | klasy pilnowane przez `--check-baseline` | `1` z `4` (`unreachable`) | komenda (5) z `§0.3` | TAK — czyta ciało funkcji, nie jej nazwę |
| 8 | testy Biblioteki | `9` PASS | `npx vitest run tests/components/assessment/library src/components/assessment/__tests__ src/components/assessment/library --retry=0 --reporter=json --outputFile=/private/tmp/cx-day329-martwe-i-biblioteka-artefakty/biblioteka-po.json` | TAK |
| 9 | dług bramek kanonu | `368/368` · `8/9` · `61/169` | komenda (8) z `§0.3` | TAK — mierzysz PRZED scaleniem i PO |
| 10 | liście `translation.json` | pl `35198` / en `33065` | `node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"` | TAK |
| 11 | kadry do wykonania | `8` (`drd-library-entry` × PRZED/PO × light/dark × pl/en) | `scripts/dev/grafika-zrzuty.mjs` — patrz `R4` | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:** wszystko, co wnoszą scalenia gałęzi 293 i 297 (10 plików
wymienionych w tabeli licencji) · `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY329_MARTWE_I_BIBLIOTEKA_REPORT.md`.

**Zapisujesz WARUNKOWO:** `dev-render/screens/drd-library-entry.tsx` i mocki huba —
wyłącznie jeżeli ekran nie renderuje się po scaleniu · `public/locales/*/translation.json`
— wyłącznie dopisanie brakującego klucza, z parytetem.

**JAWNIE NIE ZAPISZESZ:** bezpieczniki dyżuru 327 (`i18n-pl-audyt.mjs`,
`tests/unit/config/i18n*`, `noRawErrorInJsx`, `noRawErrorMessage`, `noRuntimeDdl`) ·
narzędzie i bramka dyżuru 328 (`p0p1-licznik-e1.mjs`, `.github/workflows/**`,
`package.json`) · `scripts/dev/grafika-zrzuty.mjs` · `scripts/dev/g06-macierz-ekrany.json`
· `scripts/check-*.sh` · `server/src/**` · `server/migrations/**` (**przedział
nieprzydzielony — dyżur nie tworzy migracji**) · **jakikolwiek plik wewnątrz cudzych
worktree**.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day329-martwe-i-biblioteka
git diff --name-only --cached | tee /private/tmp/cx-day329-martwe-i-biblioteka-artefakty/staged.txt
grep -iE 'i18n-pl-audyt|noRawError|noRuntimeDdl|p0p1-licznik|\.github/workflows|^package\.json|grafika-zrzuty|g06-macierz|scripts/check-|^server/src/|server/migrations/' \
  /private/tmp/cx-day329-martwe-i-biblioteka-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R1 — SCALENIE 293 I ROZWIĄZANIE KONFLIKTU (rdzeń, PIERWSZA POZYCJA)

1. **Zmierz stan wejściowy bramek** (`check-list-canon`, `check-artefakt`,
   `check-focus-canon --ci`) i **zapisz liczby PRZED**. Bez nich nie odróżnisz długu
   wniesionego przez scalenie od zastanego.
2. **Scal lokalny ref** `codex/day293-ocena-biblioteka-metodyk-20260903` (u mnie
   `e4dc14df6e`). **Nie `github-backup/…` — tam tej gałęzi nie ma w ogóle.**
3. **Rozwiąż jedyny konflikt** na `AssessmentLibraryTab.day178.empty-state.test.ts`
   **wersją `HEAD`**. Uzasadnienie stoi wyżej: różnica jest wyłącznie reformatem, a `HEAD`
   niesie komentarz `Day 286 / G15` z powodem brzmienia. **Do raportu wklej cały diff
   rozwiązania** — nadzorca ma zobaczyć, że nic poza reformatem nie zginęło.
4. **★★ Po scaleniu: `grep` znaczników konfliktu w całym drzewie** i `esbuild` na każdym
   pliku, który przeszedł przez konflikt. Program ma zmierzony przypadek, w którym merge
   zostawił znaczniki w komponencie podglądu, a przekazanie ogłosiło „scalone":

   ```bash
   grep -rnE '^(<{7} |={7}$|>{7} )' src/ tests/ dev-render/ docs/ | head -20
   npx esbuild --bundle --outfile=/dev/null --loader:.tsx=tsx --loader:.ts=ts \
     src/components/assessment/library/AssessmentLibraryTab.tsx 2>&1 | tail -5
   ```

   Zero trafień w pierwszej komendzie jest **warunkiem** przejścia dalej.
5. **Uruchom testy Biblioteki** (`--retry=0`, reporter JSON, plik wynikowy **poza repo**)
   i wykonaj **pomiar zasięgu `§0.4a`**: `przed-nazwy.txt` / `po-nazwy.txt` i `diff`.
   Nazwa, która zniknęła, wymaga wyjaśnienia albo jest STOP-em pozycji.
6. **Zmierz bramki PO** i porównaj z PRZED. Wzrost długu = naprawiasz **kodem**, nie progiem.

**Wymagany dowód:** liczby bramek PRZED i PO, diff rozwiązania konfliktu, wynik `grep`
znaczników (pusty), wynik `esbuild`, `diff przed-nazwy.txt po-nazwy.txt`. **Commit po `R1`.**

## R2 — SCALENIE 297 I WŁASNY POMIAR OSIĄGALNOŚCI (rdzeń)

1. **Scal lokalny ref** `codex/day297-martwe-komponenty-od-korzenia-20260903` (u mnie
   `e843a1c2fd`). ★★ **Nie `github-backup/codex/day297-…`** — tam stoi `682375d322`, czyli
   **sam raport STOP bez narzędzia**. Scalenie złego refu dałoby „scalone" bez ani jednej
   linii kodu. **Wypisz do raportu oba SHA i powiedz, który scaliłeś.**
2. **Zmierz klasy SAM.** `node scripts/dev/reachability-from-root.mjs` — mianownik i cztery
   klasy. Liczby z raportu 297 (`4808 / 3040 / 29 / 1010 / 729`) są **cytatem z cudzego
   raportu**; Twój przebieg jest na innym drzewie (po scaleniu 293) i **ma prawo dać co
   innego**. Rozbieżność jest wynikiem, nie błędem.
3. **Sprawdź, czy baza jest aktualna.** `--check-baseline` na świeżo scalonym drzewie —
   jeżeli czerwieni się, bo scalenie 293 dodało pliki, **zaktualizuj bazę narzędziem**
   (`--update-baseline`), nigdy ręcznie, i **wypisz różnicę imiennie**.
4. **Opisz metodę.** Jedno zdanie do raportu: dlaczego „osiągalność od korzenia" różni się
   od „pliku bez importera" i **który konkretny przypadek** (`NotificationSettingsV2`,
   8 plików + hook) ta druga metoda przepuściła. To jest uzasadnienie istnienia narzędzia.

**Wymagany dowód:** oba SHA gałęzi z informacją, który scalony; własny rozkład czterech
klas z mianownikiem; wynik `--check-baseline`; imienna lista różnic, jeżeli baza się
zmieniła. **Commit po `R2`.**

## R3 — BEZPIECZNIK MA OBEJMOWAĆ KLASĘ `test-only` (rdzeń)

Dziś `--check-baseline` pilnuje **jednej z czterech klas**. Martwy plik produktowy
z jednym testem przechodzi jako `test-only` — a takich plików jest **1010**.

1. **Obejmij klasę `test-only` osobnym ratchetem** — z własną bazą, żeby dług zastany nie
   czerwienił się od pierwszego dnia, ale **nowy** plik trafiający do tej klasy blokował.
   Rozstrzygnij i wpisz do tabeli decyzji, co robisz z klasą `harness-only` (29 plików):
   obejmujesz ją tak samo, czy zostawiasz z uzasadnieniem. **Cichego pominięcia nie ma.**
2. **★★ DOWÓD MUTACYJNY — celuje w ZABEZPIECZENIE.** Utwórz **parę**: nowy plik `src/__day329_probe__.ts` (**NOWY — sonda, nie istnieje na markerze,
   kasujesz go po pomiarze**) i **jeden test**, który go importuje. Dziś taka para wpada
   w klasę `test-only` i `--check-baseline` kończy **`exit 0`** — to jest dowód dziury.
   Po Twojej zmianie ma być **`exit ≠ 0`**. Mutacja odwrotna: **usuń swój ratchet** i pokaż,
   że nowy przypadek testowy **czerwieni się**. Obie mutacje cofasz przez `cp` (`Z27`);
   `git diff` po cofnięciu **pusty**, a plików sondy **nie zostawiasz**.
3. **★ Nie podnosisz progu bez zysku.** Jeżeli baza klasy `test-only` startuje od 1010,
   napisz wprost, że **to jest dług policzony, nie naprawiony**, i ile z niego zostało
   odsłonięte jako kandydat do usunięcia w przyszłym dyżurze.

**Wymagany dowód:** obie mutacje w obie strony z kodami wyjścia, nowy przypadek testowy,
wiersz w tabeli decyzji o klasie `harness-only`, `git status --short` pokazujący, że sonda
została usunięta. **Commit po `R3`.**

## R4 — KADRY PRZED/PO EKRANU BIBLIOTEKI (rdzeń, WARUNEK ODBIORU)

★★ **To jest jedyna pozycja w tej trójce dyżurów, która dotyka tego, co właściciel
zobaczy.** `CLAUDE.md` reguła 7: **właściciel nigdy nie jest pierwszym testerem
wizualnym**. Raport 293 sam przyznaje, że kadrów nie ma.

1. **PRZED — zanim scalisz 293.** Jeżeli `R1` już wykonałeś, kadr PRZED robisz z markera:
   `git stash` jest **zakazany** (`Z27`), więc używasz **osobnego, tymczasowego worktree
   z markera**, który zakładasz sam (`Z6` wyjątek: katalogi, które sam zakładasz, są Twoje)
   i kasujesz po zrzucie. Alternatywnie: wykonaj kadry PRZED **jako pierwszą czynność
   dyżuru**, przed `R1`. **Zaplanuj to, zanim scalisz.**
2. **Uruchom kanoniczny harness na SWOIM porcie:**

   ```bash
   npx vite --config dev-render/vite.config.ts --port 5495 --strictPort &
   echo $!   # ★ zapisz PID — zabijasz WYŁĄCZNIE własny; `pkill`/`killall` jest ZAKAZANY
   ```

3. **Zrzuty WYŁĄCZNIE kanonicznym narzędziem** — `scripts/dev/grafika-zrzuty.mjs`.
   ★★ **Zakaz pisania własnego skryptu zrzutowego obok kanonicznego.** Doraźny skrypt
   dał w programie parę identycznych obrazów i zameldował sukces. Osiem kadrów:

   ```bash
   for FAZA in PRZED PO; do for JEZYK in pl en; do
     node scripts/dev/grafika-zrzuty.mjs \
       --base=http://127.0.0.1:5495 \
       --ekrany=drd-library-entry \
       --katalog=04-ocena \
       --faza=$FAZA \
       --jezyk=$JEZYK \
       --motywy=light,dark \
       --rozwin-sekcje=1 \
       --cofnij-jesli-skraca=1 \
       --osiad-po-rozwinieciu=800 \
       --klik-po-rozwinieciu=1 \
       --wyjscie=/private/tmp/cx-day329-martwe-i-biblioteka-artefakty/kadry \
       --wynik-json=/private/tmp/cx-day329-martwe-i-biblioteka-artefakty/kadry/$FAZA-$JEZYK.json
   done; done
   ```

   **Znaczenie każdej opcji — musisz je znać, zanim ją wpiszesz:**
   `--rozwin-sekcje=1` rozwija akordeony przed skanem; `--cofnij-jesli-skraca=1` cofa klik,
   który **skrócił** tekst (przycisk „Szukaj" w `ModuleNavBar` ma poprawne
   `aria-expanded`, ale jest przełącznikiem trybu i **podmienia cały rząd Menu 3** —
   bez tej opcji chipy znikają z kadru); `--osiad-po-rozwinieciu=800` czeka na fade-in
   (bez tego skan czyta tekst w połowie przejścia i daje fałszywy kontrast);
   `--klik-po-rozwinieciu=1` przywraca podgląd, który pętla rozwijania zamyka klikiem
   w róg. **Wszystkie cztery są opt-in i wszystkie cztery mają zmierzony powód.**

4. **★★ KONTROLA, ŻE KADRY SĄ RÓŻNE — mechaniczna, nie „na oko".** Para light/dark bywa
   **tym samym obrazem pod dwiema nazwami**, a kontrola samej jasności **nagradza defekt**
   (im większy defekt, tym łatwiej przechodzi). Dlatego:

   ```bash
   shasum -a 256 /private/tmp/cx-day329-martwe-i-biblioteka-artefakty/kadry/*.png
   ```

   **Dwie identyczne sumy w parze = ZERO dowodu**, kadr do powtórzenia. Do raportu
   wchodzą: **wszystkie sumy kontrolne**, **średnia jasność** każdego kadru (z `wynik.json`
   narzędzia) **i** rozmiar w bajtach. Trzy liczby, nie jedna.

5. **Sprawdź kanon list literalnie** — Menu 1/2/3, tabela, pstryczek kolumn, kebab wiersza,
   podgląd, light i dark. Ekran listowy buduje się **wyłącznie**
   `StandardTable`/`StandardModuleBar`; potwierdź to **bramką**, nie lekturą:
   `bash scripts/check-list-canon.sh`. ★ Osobno napisz, czy w scalonej wersji nie powstała
   **bespoke tabela** — to jest defekt, który złamał zamrożony kanon 07-12.

6. **Dołóż asercję kanonu BEZ MOCKA.** Istniejący `AssessmentLibraryTab.canon.test.tsx`
   mockuje `@/components/standard`, więc nie dowodzi, że kanoniczna tabela się renderuje.
   Dodaj **jeden** przypadek renderujący komponent **z realnym** `StandardTable`
   i asertujący obecność jego struktury. **Mutacja:** podmień `StandardTable` na własny
   `<table>` i pokaż, że nowy przypadek **czerwieni się**; cofnij przez `cp`.

★ **Kadry NIE wchodzą do repo** (`Z13`) — leżą w
`/private/tmp/cx-day329-martwe-i-biblioteka-artefakty/kadry`, a raport podaje ścieżki
i sumy kontrolne.

★★ **Ta pozycja NIE kończy się akceptem.** Twoim produktem są **kadry i pomiary**;
**akcept właściciela jest osobnym krokiem u nadzorcy** i Ty go nie ogłaszasz. Zdanie
„zaakceptowane" w Twoim raporcie byłoby nieprawdą.

**Wymagany dowód:** 8 kadrów ze ścieżkami, sumy kontrolne, średnie jasności, rozmiary,
`wynik.json` narzędzia, wynik `check-list-canon`, akapit o bespoke tabeli, nowy przypadek
testowy + jego mutacja. **Commit po `R4`.**

## R5 — DOMKNIĘCIE RAPORTÓW 293 I 297

Po scaleniu oba raporty wchodzą do drzewa razem ze swoimi sekcjami „Twierdzenia
niezweryfikowane". **Dopisujesz do każdego sekcję o domknięciu, z datą** — co z tych
twierdzeń zostało zweryfikowane w tym dyżurze, a co **nadal nie**. Sekcji oryginalnych
**nie nadpisujesz**.

Dla 293 rozlicz imiennie: 8 kadrów, checklista triady, porównanie PRZED/PO, akcept
właściciela, dowód produkcyjnego HTTP dla „Rozpocznij ocenę". Dla 297: kompletność
rejestrów po stringu, porównanie per plik z inwentarzem 238, cztery tabele, bezpieczny
zbiór poddrzew do usunięcia, klucze i18n, esbuildy sąsiadów.

**★ Nie ogłaszasz domknięcia tego, czego nie zmierzyłeś.** Wiersz „nadal niezweryfikowane"
jest pełnowartościowym wynikiem i jest wart więcej niż zawyżony meldunek.

**Wymagany dowód:** `git diff` obu dopisanych sekcji. **Commit po `R5`.**

## R6 — RAPORT

Raport zawiera: oba SHA gałęzi (lokalny i zdalny) z informacją, który scaliłeś i dlaczego;
diff rozwiązania konfliktu; wynik `grep` znaczników konfliktu i `esbuild`; `diff
przed-nazwy.txt po-nazwy.txt` z `§0.4a`; własny rozkład czterech klas osiągalności
z mianownikiem; obie mutacje z `R3` z kodami wyjścia; **8 kadrów ze ścieżkami, sumami
kontrolnymi, średnimi jasnościami i rozmiarami**; liczby trzech bramek kanonu PRZED i PO;
liczby liści `translation.json` PRZED i PO; stan `status --short` obu cudzych worktree;
listę rozbieżności wobec liczb tej instrukcji; **niepustą sekcję „TWIERDZENIA
NIEZWERYFIKOWANE"**.

Dodatkowo, obowiązkowo: **akapit `§0.2e`** dla każdego uruchomionego pakietu — która
z pułapek (a)–(e) go dotyczy, jak ją wyłączyłeś i co dowodzi, że wyłączyłeś. Dla pakietów
komponentowych dopuszczalne „nie dotyczy" **z komendą pokazującą, że dany strażnik nie leży
na ścieżce**.

## Próg odbioru

Obie gałęzie **scalone z właściwych refów**, konflikt rozwiązany wersją `HEAD`, bezpiecznik
osiągalności **czerwieni się na parze „martwy plik + jeden test"**, a ekran Biblioteki ma
**osiem kadrów o różnych sumach kontrolnych**, gotowych do przedstawienia właścicielowi —
**bez ani jednego zdania o akcepcie**.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „293 scalone, konflikt
rozwiązany wersją HEAD, zero znaczników w drzewie; 297 scalone z lokalnego refu
`e843a1c2fd`, klasy zmierzone własnym przebiegiem; klasa `test-only` objęta ratchetem
z dowodem mutacyjnym w obie strony; 8 kadrów wykonanych kanonicznym narzędziem, sumy
kontrolne różne" — **jest pełnowartościowym wynikiem**.

Zdanie „Biblioteka gotowa" postawione na zielonych testach bez ani jednego kadru **nie
jest warte nic** — i jest dokładnie tym, przez co właściciel raz już został pierwszym
testerem wizualnym.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
W szczególności **ponownie odczytujesz tipy obu gałęzi** — cudze worktree żyją i mogły
w międzyczasie dostać nowe commity. Wynik ponownego sprawdzenia wklejasz do raportu z datą
i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| Zakaz `Z6` („nie dotykasz cudzych worktree") vs „zmierz niezacommitowane pliki w worktree 293" | Tabela licencji, wiersz „★★ Cudze worktree": `Z6` **zawężony imiennie** do dwóch poleceń `git -C … status --short` w trybie odczytu; zakaz `cd`, odczytu plików i jakiegokolwiek zapisu zostaje |
| Zakaz `Z27` („zakaz `git stash`") vs „kadr PRZED wymaga stanu sprzed scalenia" | `R4` punkt 1: **osobny, tymczasowy worktree z markera**, zakładany przez Ciebie (dozwolony wyjątek `Z6`), albo wykonanie kadrów PRZED jako pierwszej czynności dyżuru |
| „Scal gałęzie" vs `Z2` („nie zmieniasz cudzych gałęzi `codex/*`") | `Z2` zabrania **zmieniać i pushować** cudze gałęzie; **odczyt i scalenie ich do własnej gałęzi jest dozwolone i jawnie zamówione**. Ich refy zostają nietknięte |
| „Scal `github-backup/codex/day297-…`" vs „ref zdalny jest starszy" | `R2` punkt 1: scalasz **lokalny ref vaulta**; oba SHA wpisujesz do raportu |
| „Rozwiąż konflikt" vs „nie osłabiasz asercji" (`Z35`) | `R1` punkt 3 i tabela licencji: rozstrzygnięcie z góry — **wersja `HEAD`**, trzy asercje bez zmian, komentarz `Day 286 / G15` zostaje |
| „Zrzuty muszą pokazywać rozwinięte sekcje" vs „rozwijanie zamyka podgląd" | `R4` punkt 3: `--klik-po-rozwinieciu=1` i `--osiad-po-rozwinieciu=800` — obie opcje mają zmierzony powód i obie są obowiązkowe w tym dyżurze |
| „Para light/dark ma być różna" vs „kontrola jasności przechodzi tym łatwiej, im większy defekt" | `R4` punkt 4: kontrola jest **trójwymiarowa** (suma kontrolna + jasność + rozmiar); dwie identyczne sumy = zero dowodu |
| „Brakuje opcji w narzędziu zrzutowym" vs „zakaz własnego skryptu obok kanonicznego" | Tabela licencji, wiersz „Narzędzie zrzutowe": brakującą funkcję **opisujesz w briefie**; dokładanie jej narzędziu jest osobną pracą, nie tą |
| „Bezpiecznik ma czerwienić" vs „1010 plików już w klasie `test-only`" | `R3` punkt 1: nowy ratchet startuje od **bazy zastanej**, więc dług nie czerwieni się od pierwszego dnia; blokuje wyłącznie **nowy** plik. Punkt 3 wymaga nazwania tego długiem policzonym, nie naprawionym |
| „Usuń martwy kod" vs „ten dyżur nie usuwa produktu" | Sekcja „Po co ten dyżur istnieje": 729 to **kandydaci do klasyfikacji**, nie lista do `rm`; usunięcie wymaga osobnego dyżuru z własnymi kadrami |
| „Właściciel ma zobaczyć ekran" vs „nie ogłaszasz akceptu" | `R4`, akapit końcowy: produktem są **kadry i pomiary**; akcept jest krokiem nadzorcy i Ty go nie ogłaszasz |
| „`§0.2b` (4) opisuje warunki uruchomienia runtime'u" vs „ten dyżur robi zrzuty" | Sekcja „ROZSTRZYGNIĘCIE… (2)": harness `dev-render` **nie jest runtime'em produktu** — nie uruchamiasz `server/src/index.ts`, więc wyjątek (4) nie ma zastosowania |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 12 par, w tym **`Z6` kontra pomiar cudzego worktree** i **`Z27` kontra kadr PRZED** |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — pliki wnoszone przez scalenia (`reachability-from-root.mjs`, `reachabilityFromRoot.test.ts`, `reachability.baseline.json`, `AssessmentLibraryTab.canon.test.tsx`) **oznaczone jako NIEISTNIEJĄCE na markerze i pochodzące ze scalenia**; reszta sprawdzona `[ -e ]` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 11 wierszy; wiersz 6 **jawnie oznaczony jako cytat z cudzego raportu do zweryfikowania własnym przebiegiem** |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — w każdym wierszu stoi rzeczownik-produkt |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — żadna pozycja nie wymaga `auth.middleware.ts`, `Gateway.ts` ani bramki platformowej; kadr PRZED ma z góry opisaną drogę bez `git stash` |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `lsof` na `6355`/`5495` puste, brak kontenera `cx-day329-pg`, brak gałęzi i worktree dyżuru; 327 i 328 mają rozłączne porty i rozłączne pliki; **przedział migracji nieprzydzielony** |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera; pętla zrzutowa ma pełne ścieżki i wszystkie cztery opcje opt-in z uzasadnieniem |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: ref zdalny starszy od lokalnego, reformat kasujący komentarz kontraktu, mock kanonu w teście kanonu, przełącznik trybu w `ModuleNavBar`, para bajtowo identycznych kadrów |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę `git show` |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
