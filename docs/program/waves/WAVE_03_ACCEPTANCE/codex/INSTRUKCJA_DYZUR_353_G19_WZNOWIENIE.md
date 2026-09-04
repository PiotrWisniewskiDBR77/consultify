# INSTRUKCJA DYŻURU nr 353 — Codex — „★★★ G19 — WZNOWIENIE OD R3, NIE TRZECIE LICZENIE TEGO SAMEGO DRYFU. Bramka `G19` stoi na `NOT_PROVEN` we wszystkich 16 modułach; dwa dyżury (335 i 348) policzyły dryf zgodnie i żaden nie ruszył wiersza macierzy. Dyżur 348 domknął punkt wznowienia PO ODBIORZE i wszystko leży W REPO (`evidence/g19/day348-artefakty/`, 7 plików pomiarowych + `PUNKT-WZNOWIENIA.md`). Ten dyżur zaczyna od tego, na czym 348 stał: wykonuje PIĘĆ pozostałych modułów kubełka `A`, ORZEKA czy istniejący dowód `day307` wystarcza dla wierszy `01` i `08`, wydaje orzeczenie per wiersz dla całej szesnastki — i STAWIA PYTANIE O KOTWICĘ, którego dwa dyżury nie postawiły: na czym ma stać dowód `G19`, skoro mianownik rośnie z każdą naszą pracą"

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
> **wyłącznie** `/private/tmp/cx-day353-g19-wznowienie`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `29fcbd4de20ca26d2febc50d9455128cab47ffce`**
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
Zakres: **BRAMKA ODBIORU `G19` („Later-change regression obligations resolved”) we WSZYSTKICH 16 modułach fali `WAVE_03_ACCEPTANCE`. Przedmiotem pracy jest **dowód**, nie kod produktu: para izolacyjna cross-org na realnym PostgreSQL, mutacja celująca w zabezpieczenie, orzeczenie per wiersz i wpis do macierzy odbioru. ★ Punkt wznowienia dziedziczysz z dyżuru 348: `evidence/g19/day348-artefakty/PUNKT-WZNOWIENIA.md` (przeczytaj W CAŁOŚCI zanim cokolwiek zrobisz) oraz `evidence/g19/day348/r2-kubelki.md` (kubełki `A=7` / `B=0` / `C=9` — **hipoteza wykonawcza przed R3, nie werdykt odbioru**)**.
Trasy front: `BRAK — ten dyżur nie dotyka frontu i nie renderuje ani jednego ekranu. Gdybyś znalazł się w `src/**` z edytorem, jesteś poza zakresem. Jedyny kontakt z `src/` to **odczyt** przy ustalaniu, czy plik z listy dryfu (`evidence/g19/day348-artefakty/g19-dryf-dzis.txt`, 106 wierszy) ma pokrycie testowe — 90 z nich go nie ma`. Trasy tył: `★★ SEDNO DOWODU: `GET /api/tasks/workload/:userId` → `TaskController.getUserWorkload` (`server/src/controllers/TaskController.ts`, definicja w okolicach wiersza **2681**, dwa wywołania `TaskAssignmentService.getUserWorkload` w wierszach **2703** i **2725**). Zabezpieczeniem, w które celuje mutacja, jest warunek `AND organization_id = ?` w prechecku. ★ Jeżeli po jego usunięciu test NIE czerwienieje — zabezpieczenie stoi w serwisie `server/src/services/TaskAssignmentService.ts` i mutujesz TAM, a fakt „precheck kontrolera nie jest zabezpieczeniem” zapisujesz jako znalezisko. Test pary: `server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts` (216 niepustych linii; seeder **fail-closed** na historyczne `6314`/`cx307` — kopiujesz go POZA repo i zmieniasz wyłącznie guard). Trasy pięciu pozostałych modułów kubełka `A` (`04`, `05`, `06`, `11`, `13`) ustalasz sam w `R3` — kandydaci wskazani przez 348 to HIPOTEZY, nie ustalenia`.

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
WT=/private/tmp/cx-day353-g19-wznowienie
MARKER=29fcbd4de20ca26d2febc50d9455128cab47ffce

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day353-g19-wznowienie-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day353-g19-wznowienie/config.worktree"
cat "$VAULT/worktrees/cx-day353-g19-wznowienie/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day353-g19-wznowienie-scratch
mkdir -p /private/tmp/cx-day353-g19-wznowienie-artefakty

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
git -C "$VAULT" log --oneline 29fcbd4de20ca26d2febc50d9455128cab47ffce..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 29fcbd4de20ca26d2febc50d9455128cab47ffce..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day353-g19-wznowienie-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 29fcbd4de20ca26d2febc50d9455128cab47ffce..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `osiem` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day353-g19-wznowienie

# (1) ★★★ PUNKT WZNOWIENIA ISTNIEJE W REPO — sprawdz to `ls`-em, nie zaufaniem.
#     Dowod poza repo wyparowuje; ten akurat zostal uratowany do repo i MA istniec.
ls -la evidence/g19/day348-artefakty/ evidence/g19/day348/
#   oczekiwane: 8 plikow w pierwszym katalogu (w tym PUNKT-WZNOWIENIA.md), 1 w drugim
cat evidence/g19/day348-artefakty/PUNKT-WZNOWIENIA.md
#   ★ PRZECZYTAJ W CALOSCI. Ta instrukcja kaze WZNOWIC, nie powtorzyc.

# (2) DRYF: liczby, ktore DZIEDZICZYSZ i tylko potwierdzasz
wc -l < evidence/g19/day348-artefakty/g19-dryf-dzis.txt
bash -c "grep -vcE '__tests__|[.]test[.]' evidence/g19/day348-artefakty/g19-dryf-dzis.txt"
#   moje liczby: 106 plikow, 90 bez testow

# (3) TRZY BLOKI „PRZED” — czytasz z artefaktow, jeszcze NIC nie uruchamiasz
node -e 'for (const b of ["blok1","blok2","blok3"]) { const j = JSON.parse(require("fs").readFileSync(`evidence/g19/day348-artefakty/${b}-przed.json`,"utf8")); console.log(b, j.numTotalTests, j.numPassedTests, j.numFailedTests); }'
#   moje liczby: blok1 131 127 4 · blok2 218 218 0 · blok3 18 11 7
#   ★★★ HISTORYCZNY wariant Bloku 2 na SIEDMIU plikach dawal 225/224/1 i zostal ODRZUCONY
#   jako ZLY MIANOWNIK. Nie wracasz do niego i nie „porownujesz obu wariantow”.

# (4) ★★ DYSTANS OD KOTWICY — trzy komendy, trzy rozne liczby. To jest sedno pytania z R5.
git rev-list --count               316bce9dd9..29fcbd4de20ca26d2febc50d9455128cab47ffce
git rev-list --count --no-merges   316bce9dd9..29fcbd4de20ca26d2febc50d9455128cab47ffce
git rev-list --count --first-parent 316bce9dd9..29fcbd4de20ca26d2febc50d9455128cab47ffce
#   moje liczby: 1216 · 1015 · 315
#   ★★★ ZLECENIE MOWILO „615 commitow” — NIE ODTWORZYLEM TEJ LICZBY z kotwicy wpisanej
#   w macierz, ani na markerze 348 (6a4919f72d: 1146 / 956). Rozstrzygasz to w R1 punkt 3.

# (5) KOTWICA jest wpisana w wiersz G19 modulu 01 — przeczytaj ja doslownie
bash -c "grep -hE 'G19' docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md" | cut -c1-400
#   oczekiwane: 'Kotwica: SHA odbioru modulu z wiersza G18 = 316bce9dd9' oraz 'Mianownik: 49 plikow'
#   ★★ MACIERZ MOWI 49, DRYF MOWI 106. To NIE jest sprzecznosc do naprawienia nadpisaniem liczby
#   — to jest dokladnie problem, o ktory pytasz wlasciciela w R5 czesc B.

# (6) CEL MUTACJI ISTNIEJE NA MARKERZE
bash -c "grep -n 'getUserWorkload' server/src/controllers/TaskController.ts"
#   oczekiwane: definicja ~2681, wywolania serwisu ~2703 i ~2725
ls -la server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts
#   oczekiwane: plik istnieje

# (7) TECHNICAL_REGRESSION_PASS ZOSTAL ODRZUCONY — sprawdz, ze nie ma go w zadnym wierszu
bash -c "grep -rn 'TECHNICAL_REGRESSION_PASS' docs/ | head"
#   oczekiwane: zero trafien w wierszach macierzy (jesli jest w opisie decyzji — to opis ODRZUCENIA)

# (8) LISCIE SLOWNIKOW I CZTERY BRAMKI — maja byc IDENTYCZNE przed i po calym dyzurze
node -e 'const f=require("fs");function c(o){let n=0;const w=v=>{if(v&&typeof v==="object"){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ["pl","en"])console.log(l,c(JSON.parse(f.readFileSync("public/locales/"+l+"/translation.json","utf8"))));'
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35199, en 33066 (★ NIE 35198/33065 — te liczby ze zlecenia sa o dzien stare;
#   sprawdzilem to takze prosto z obiektu commita, wiec to nie jest brud w katalogu roboczym);
#   focus=0, list=0, artefakt=0, reach=0
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day353-g19-wznowienie-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6412`. Twój JEDYNY port harnessu to `5552`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day353-pg`**. **ZAKAZANE:** `Zakazane na stale: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki (04.09 wieczór) — nie dotykasz: 351 (6410/5550), 352 (6411/5551), 354 (6413/5553). ★★ RÓWNOLEGLE pisane są instrukcje 355-358 przez innego autora; ich portów NIE ZNAM w chwili pisania tej instrukcji, więc obowiązuje reguła twarda: **bierzesz WYŁĄCZNIE swoje dwa porty i żaden inny**, a port zajęty jest powodem do STOP-u całości (`Z7`), nigdy do podmiany numeru. Wcześniejsze rodzeństwo 04.09: 343-346 (6390-6393 / 5530-5533), 347 (6394/5534), 348 (6395/5535), 349 (6396/5536), 350 (6397/5537). Twoje własne wyłącznie: baza 6412, runtime 5552. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!` po starcie każdego procesu w tle)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK. Ten dyżur nie dodaje, nie zmienia i nie przełącza ANI JEDNEJ flagi funkcyjnej. ★ Jeżeli którykolwiek z pięciu modułów kubełka `A` okaże się bramkowany flagą wyłączoną — to jest ZNALEZISKO do raportu („właściciel widzi flagę jako brak funkcji”), a **nie** powód do włączenia flagi ani do uznania wiersza za domknięty. Dowód złożony na kodzie za flagą OFF jest dowodem na kod, którego użytkownik nie widzi — zapisz tę granicę wprost`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/check-triada.sh`, `scripts/check-gestosc.sh`, `scripts/dev/reachability-from-root.mjs`, `.husky/pre-commit`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`. Wszystkie NIETYKALNE DO ZAPISU — wolno je wołać w pomiarze, nie wolno ich zmieniać. ★ Bramka, która przechodzi, bo nie mogła nic zmierzyć, nie jest wynikiem: każde wywołanie zapisujesz z kodem wyjścia ORAZ z liczbą zbadanych obiektów`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY353_G19_WZNOWIENIE_REPORT.md`. Jedyny inny dokument do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — sekcje idą dziś do `Q`, ale równolegle dopisuje inny autor, więc literę sprawdzasz komendą `bash -c "grep -nE '^## [A-Z][.]' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"` TUŻ PRZED commitem, nigdy z góry. **Wiersze `MODULE_ACCEPTANCE.md` zmieniasz WYŁĄCZNIE w kolumnie `G19` i wyłącznie commitem, który w tym samym `git show --stat` niesie plik dowodowy** — `G16` i `G18` są nietykalne (`G16` zamyka właściciel oczami, `G18` to akcept z SHA). ★★ WSZYSTKIE dowody idą do `evidence/g19/day353/` (katalog NIE ISTNIEJE na markerze — tworzysz go) z `git add -f`; ta instrukcja daje na to jawną licencję, więc „zakaz binariów w repo” byłby wymyślonym powodem. Nowe kontrakty testowe idą do `tests/`, **NIGDY pod `src/`**, i też wymagają `git add -f`. Plik postępu `/private/tmp/cx-day353-postep.md` żyje POZA repo. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day353-g19-wznowienie-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day353-g19-wznowienie-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ TRZECIEGO LICZENIA DRYFU.** Dyżury 335 i 348 policzyły go zgodnie (104 → 106 plików, delta = dwa nowe pliki, zero znikniętych) i żaden nie ruszył wiersza. Dyżur, którego głównym produktem jest trzecia tabela dryfu, jest dyżurem nieodebranym. ★★★ **ZAKAZ WPISANIA `PASS` DO WIERSZA `G19` — I ZAKAZ SYNONIMU.** `TECHNICAL_REGRESSION_PASS` został JUŻ RAZ ODRZUCONY przez odbiorcę; zakaz obejmuje `MACHINE_PASS`, `TECHNICAL_PASS`, `REGRESSION_TECHNICAL_OK`, `PASS_MASZYNOWY`, `PASS (zakres techniczny)` i każde inne sformułowanie, którego skutkiem jest wiersz brzmiący jak zaliczenie. ★★★ **WIERSZ MACIERZY ZMIENIA STAN WYŁĄCZNIE Z DOWODEM ZAŁĄCZONYM W TYM SAMYM COMMICIE** — `git show --stat` musi zawierać plik z `evidence/g19/day353/**` albo plik testu; commit bez dowodu cofasz przez `git reset --soft HEAD~1`. ★★ **ZAKAZ ZMIANY JAKIEGOKOLWIEK PLIKU W `src/` I `server/src/`** poza mutacją TYMCZASOWĄ w `TaskController.ts` (po `cp` do `SCRATCH`, przywracaną przez `cp`, nigdy `git stash` — `Z27`), z **pustym `git diff` na końcu**. ★★ **ZAKAZ POWROTU DO WARIANTU BLOKU 2 NA SIEDMIU PLIKACH** (`225/224/1`) — został odrzucony jako zły mianownik; właściwy to `218`. ★★ **ZAKAZ ROZSTRZYGNIĘCIA PYTANIA O KOTWICĘ WŁASNą DECYZJĄ** — formułujesz je z wariantami i konsekwencjami, i zostawiasz właścicielowi. ★★ **ZAKAZ POŁĄCZENIA DO STAGINGU, DEMO I PRODUKCJI W KAŻDĄ STRONĘ** (`Z28`) — żadnego `curl` po `staging.consultify.ai`, żadnego logowania na konto odbiorowe właściciela. ★ **ZAKAZ `pkill`/`killall`, `git stash`, `git push`, `git fetch --all` oraz scalania czegokolwiek** | Bo `G19` jest w tej chwili bramką, która **nie może się domknąć z konstrukcji**, i trzeci dyżur z rzędu grozi tym, że znowu to udokumentuje zamiast rozstrzygnąć. Dwa dyżury zmierzyły dryf, zgodziły się co do liczb i **zatrzymały się dokładnie na tej samej pozycji** — tej, która produkuje dowód, a nie opis. Jednocześnie mianownik rośnie: 104 pliki, potem 106 w ciągu jednego dnia; macierz wpisuje 49; dystans od kotwicy to 1216 albo 1015 albo 315 commitów zależnie od jednej flagi. ★ To jest kształt „dwa rejestry — licznik mierzy rozjazd” połączony z „brak pomiaru nie jest wynikiem”: dopóki nikt nie zapyta, NA CZYM ma stać dowód, każda kolejna godzina pracy da wynik, który starzeje się przy następnym scaleniu. Ten dyżur ma zrobić dwie rzeczy naraz: **złożyć dowód tam, gdzie da się go złożyć** (pięć modułów kubełka `A` + orzeczenie o `day307`), i **postawić pytanie, które odblokuje resztę** |

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
cd /private/tmp/cx-day353-g19-wznowienie

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day353-pg psql -U postgres -d cx353 \
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
cd /private/tmp/cx-day353-g19-wznowienie

docker run -d --name cx-day353-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx353 \
  -p 127.0.0.1:6412:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day353-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6412/cx353 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6412/cx353 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day353-g19-wznowienie && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6412/cx353 \
JWT_SECRET=cx353-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Przeloty serwerowe na REALNYM PostgreSQL (kontener `cx-day353-pg`, port `6412`, baza `cx353`, obraz `pgvector/pgvector:pg16` — `postgres:15` **nie przechodzi migracji**): wariant (B) z cwd `server/`, `RUN_DB_TESTS=1`. Blok 1 wariantem (C) `RUN_DB_TESTS=0 MOCK_DB=true` z roota. ★★ PUŁAPKA, KTÓRA JUŻ RAZ ZADZIAŁAŁA: `NODE_ENV=test` **bez** `RUN_DB_TESTS=1` podstawia atrapę bazy pod `DbPromise` — `pg.Pool` widzi wiersz, kod produkcyjny nie. Atrapa dodatkowo zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE`, więc dowód zapisu warunkowego na atrapie jest bezwartościowy. **Każdy przelot z `--retry=0` i `--reporter=json --outputFile=<plik w ARTEFAKTY>`; podajesz `numTotalTests` dla każdego. Przelot z zerem wykonanych przypadków kończy się `exit 0` i NIE JEST POMIAREM. `No test files found` oraz `Transform failed` to BŁĄD KOMENDY, nie `PASS`.** Nowe kontrakty tego dyżuru kładziesz w `tests/`, NIGDY pod `src/`, z `git add -f` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day353-g19-wznowienie-artefakty/day353-g19-wznowienie.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day353-g19-wznowienie && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Przeloty serwerowe na REALNYM PostgreSQL (kontener `cx-day353-pg`, port `6412`, baza `cx353`, obraz `pgvector/pgvector:pg16` — `postgres:15` **nie przechodzi migracji**): wariant (B) z cwd `server/`, `RUN_DB_TESTS=1`. Blok 1 wariantem (C) `RUN_DB_TESTS=0 MOCK_DB=true` z roota. ★★ PUŁAPKA, KTÓRA JUŻ RAZ ZADZIAŁAŁA: `NODE_ENV=test` **bez** `RUN_DB_TESTS=1` podstawia atrapę bazy pod `DbPromise` — `pg.Pool` widzi wiersz, kod produkcyjny nie. Atrapa dodatkowo zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE`, więc dowód zapisu warunkowego na atrapie jest bezwartościowy. **Każdy przelot z `--retry=0` i `--reporter=json --outputFile=<plik w ARTEFAKTY>`; podajesz `numTotalTests` dla każdego. Przelot z zerem wykonanych przypadków kończy się `exit 0` i NIE JEST POMIAREM. `No test files found` oraz `Transform failed` to BŁĄD KOMENDY, nie `PASS`.** Nowe kontrakty tego dyżuru kładziesz w `tests/`, NIGDY pod `src/`, z `git add -f` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day353-g19-wznowienie-artefakty/day353-g19-wznowienie.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day353-g19-wznowienie/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day353-pg psql -U postgres -d cx353 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day353-pg`.
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
> **(e) ★★★ **SZEŚĆ PUŁAPEK TEGO DYŻURU.** **(1) Symetryczna odmowa nie jest dowodem izolacji.** Para `404`/`404` to kształt „zamknięte przez wygaszenie”: funkcja wyłączona dla wszystkich, bramka zielona, produkt martwy — wystąpił 3× jednego dnia. Wymagana jest **para**: obcy `404` **i** właściciel `200` **z niepustym ciałem** (zapisz długość odpowiedzi), na **tym samym `userId`**. **(2) Test scenariusza nie broni zabezpieczenia.** 3 z 4 dyżurów miały zielone testy PO skasowaniu zabezpieczenia — mutacja musi celować w to, co odróżnia obcego od właściciela, nie w walidację kształtu, mapowanie błędu czy kolejność pól. Jeżeli test czerwienieje z **innego** powodu niż brak izolacji — mutacja chybiła i przecelowujesz ją. **(3) Testy bezpieczeństwa leczą się skutkiem własnego ataku** — każde „izolacja X/X PASS” jest podejrzane, dopóki nie pokażesz, że retry jest wyłączone (`--retry=0`) i że test nie sprząta danych, które sam miał znaleźć. **(4) Seeder `day307` jest fail-closed na `6314`/`cx307`** — uruchomiony bez zmiany guardu **nie zasieje nic** i da fałszywe `404`/`404`. Kopiujesz go POZA repo, zmieniasz WYŁĄCZNIE guard, źródła w repo nie dotykasz. **(5) Migracja przyrostowa nie jest dowodem** — wymagane są DWA przebiegi na bazie od zera; drugi ma dać `Applying migrations: 0`. Jeden zielony przebieg nie wyklucza migracji, która czyta kolumnę dodawaną później alfabetycznie. **(6) Bezpiecznik, który nie mógł nic zmierzyć, nie jest wynikiem** — bramka przechodzi, gdy wejście jest puste albo gdy ginie na ścieżce macOS przed pierwszym pomiarem. Każdy `echo "x=$?"` musi mieć obok siebie **liczbę zbadanych obiektów****
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day353-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day353-g19-wznowienie-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (dwie twarde zasady — czytasz) · R1 (weryfikacja punktu wznowienia + rozstrzygnięcie rozbieżności `615`) · R2 (odtworzenie `day307` na dzisiejszym markerze + **orzeczenie**, czy wystarcza dla `01` i `08`) · R3 (pięć pozostałych modułów kubełka `A`: `04`, `05`, `06`, `11`, `13` — dowód albo czerwony kontrakt) · R4 (orzeczenie per wiersz, 16 wierszy) · R5 (podniesienie wierszy z dowodem w TYM SAMYM commicie + **pytanie o kotwicę**) · R6 (raport i jedna sekcja rejestru). **Commit po KAŻDEJ pozycji `R`**; pozycja bez commita jest pozycją niewykonaną`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6412` albo `5552` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6412` albo `5552`** (`Z7`).

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

Bramka `G19` („Later-change regression obligations resolved") stoi na `NOT_PROVEN` we
**wszystkich szesnastu** modułach. Podchodziły do niej dwa dyżury: **335** (zamknięty
werdyktem „zero wierszy podniesionych, i to jest wynik") i **348** (zatrzymany w połowie).
Obydwa zaczynały od zera: mierzyły dryf, klasyfikowały moduły do kubełków i **kończyły się
na progu tej jednej pozycji, która produkuje dowód, a nie opis**.

**Ten dyżur nie zaczyna od zera.** Dyżur 348 domknął punkt wznowienia po odbiorze i
**wszystko leży w repo**, nie w katalogu tymczasowym:

```
evidence/g19/day348-artefakty/PUNKT-WZNOWIENIA.md
evidence/g19/day348-artefakty/{blok1,blok2,blok3}-przed.json
evidence/g19/day348-artefakty/{migration-1,migration-2}.log
evidence/g19/day348-artefakty/g19-dryf-dzis.txt
evidence/g19/day348-artefakty/staged.txt
evidence/g19/day348/r2-kubelki.md
```

★★ **PIERWSZA RZECZ, KTÓRĄ ROBISZ, TO PRZECZYTANIE `PUNKT-WZNOWIENIA.md` W CAŁOŚCI.**
Instrukcja każe Ci **wznowić**, nie powtórzyć. Trzecie liczenie tego samego dryfu jest
najgorszym możliwym wynikiem tego dyżuru — dwa dyżury już to policzyły, zgodnie, i żaden
z nich nie ruszył wiersza macierzy o milimetr.

### ★ Co jest ZROBIONE i ZWERYFIKOWANE — NIE POWTARZASZ

| Pozycja | Stan | Wynik, który dziedziczysz |
| --- | --- | --- |
| `R1` — przemiar dryfu | **ZROBIONY** (commit `7448139e69`) | **106 plików** na ścieżkach mierzonych przez `G19`, **90 bez testów**. Delta wobec pomiaru 335 to **dokładnie dwa nowe pliki** (`IdeaRightPanel.tsx`, `day277-decyzje-zapis.pg.test.ts`); **żaden nie zniknął** |
| `R2` — kubełki `A`/`B`/`C` | **ZROBIONY** (commit `1d5b181ded`) | `A=7`, `B=0`, `C=9`, bez zmiany statusów. ★ Sam autor nazwał to **hipotezą wykonawczą przed `R3`**, nie werdyktem |
| Migracje na świeżej bazie | **ZROBIONE** | dwa przebiegi zielone, drugi `Applying migrations: 0` (idempotencja potwierdzona) |
| Blok 1 | **ZMIERZONY** | `131` total / `127` green / `4` red — te same pełne nazwy co w 335 |
| Blok 2 | **ZMIERZONY** | `218` total / `218` green / `0` red |
| Blok 3 | **ZMIERZONY** | `18` total / `11` green / `7` red — imiennie: `day275` ×1, `day276` deck ×2, `day276` workbook ×2, `day277` ×2 |
| Para izolacyjna `day307` | **WYKONANA JAKO DOWÓD** | obcy `404` / właściciel `200` na tym samym `userId`; mutacja `AND organization_id = ?` w `TaskController.getUserWorkload` → `GREEN`→`RED`→`GREEN`, `git diff` po przywróceniu **pusty** |

★★★ **Historyczny wariant Bloku 2 na siedmiu plikach dawał `225/224/1` i został ODRZUCONY
jako zły mianownik.** Nie wracasz do niego, nie cytujesz go jako alternatywy i nie
„porównujesz obu wariantów". Właściwy mianownik Bloku 2 to `218`.

### ★ Co jest NIEZROBIONE — i to jest cały ten dyżur

1. **Pięć pozostałych modułów kubełka `A`**: `04_ASSESSMENT`, `05_INITIATIVES`,
   `06_EXECUTION`, `11_MATERIALS`, `13_CHAT`. Dla żadnego z nich nie ma dowodu.
2. **Rozstrzygnięcie, czy `day307` wystarcza** dla dwóch wierszy, którym `R2` go przypisał
   (`01_ORGANIZATION` i `08_MEETINGS`) — dowód istnieje, ale **nikt nie orzekł, czy zamyka
   te wiersze**.
3. **Orzeczenie per wiersz** dla całej szesnastki: czego dokładnie brakuje, imiennie.
4. **Pytanie o kotwicę**, którego dwa dyżury nie postawiły (patrz `R5`).

---

## ★★ SPROSTOWANIE ZLECENIA — cztery liczby, które mój pomiar na markerze obalił

Zlecenie, z którego powstała ta instrukcja, przekazało liczby z raportu dyżuru 348.
Sprawdziłem każdą z nich na markerze `29fcbd4de2`. **Dwie się potwierdziły, dwie nie.**

**POTWIERDZONE — nie mierzysz ich ponownie:**

- **106 plików** — `wc -l < evidence/g19/day348-artefakty/g19-dryf-dzis.txt` → `106`.
- **90 bez testów** — `bash -c "grep -vcE '__tests__|\.test\.' evidence/g19/day348-artefakty/g19-dryf-dzis.txt"` → `90`.

**OBALONE — i to jest ważne, bo dotyczy właśnie kotwicy:**

- ★★★ **„dystans 615 commitów" NIE JEST ODTWARZALNY.** Kotwicą wpisaną w wiersz `G19`
  modułu `01_ORGANIZATION` jest SHA odbioru z wiersza `G18` = `316bce9dd9`. Z tej kotwicy
  do markera `29fcbd4de2` mierzę:

  | Komenda | Wynik |
  | --- | --- |
  | `git rev-list --count 316bce9dd9..29fcbd4de2` | **1216** |
  | `git rev-list --count --no-merges 316bce9dd9..29fcbd4de2` | **1015** |
  | `git rev-list --count --first-parent 316bce9dd9..29fcbd4de2` | **315** |

  **Żadna z nich nie daje 615.** Ani na markerze dyżuru 348 (`6a4919f72d`: `1146` / `956`).
  Liczba `615` albo pochodzi z innej kotwicy, albo z komendy, której raport nie zapisał.
  ★ **To nie jest przytyk do dyżuru 348 — to dowód, że pytanie o kotwicę z `R5` jest realne**,
  a nie retoryczne: ta sama bramka daje trzy różne „dystanse" w zależności od jednej flagi.

- **Liście słowników**: zlecenie mówi `pl 35198 / en 33065`. Kanoniczna komenda na markerze
  daje **`pl 35199` / `en 33066`** — sprawdzone także prosto z obiektu commita
  (`git show 29fcbd4de2:public/locales/pl/translation.json`), więc to nie jest brud
  w katalogu roboczym. Te liczby są o jeden dzień stare. **Obowiązuje mój pomiar,
  a jeżeli Twój przeczy mojemu — obowiązuje Twój.**

★ **Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

---

## ★ Zmierz moje liczby sam

Zanim ruszysz `R1`, odtwórz **tanie** liczby z tabeli wyżej. Nie odtwarzasz przelotów
testowych ani migracji — to jest treść `R2`/`R3` i zrobisz je na swojej bazie.

```bash
cd /private/tmp/cx-day353-g19-wznowienie

# (a) punkt wznowienia ISTNIEJE w repo — sprawdz to `ls`-em, nie zaufaniem
ls -la evidence/g19/day348-artefakty/ evidence/g19/day348/
#   oczekiwane: 8 plikow w pierwszym katalogu (w tym PUNKT-WZNOWIENIA.md), 1 w drugim

# (b) dryf: 106 plikow, 90 bez testow
wc -l < evidence/g19/day348-artefakty/g19-dryf-dzis.txt
bash -c "grep -vcE '__tests__|\.test\.' evidence/g19/day348-artefakty/g19-dryf-dzis.txt"
#   moje liczby: 106 i 90

# (c) trzy bloki „PRZED" — czytasz z artefaktow, NIE uruchamiasz jeszcze niczego
node -e 'for (const b of ["blok1","blok2","blok3"]) { const j = JSON.parse(require("fs").readFileSync(`evidence/g19/day348-artefakty/${b}-przed.json`,"utf8")); console.log(b, j.numTotalTests, j.numPassedTests, j.numFailedTests); }'
#   moje liczby: blok1 131 127 4 · blok2 218 218 0 · blok3 18 11 7

# (d) ★★ DYSTANS OD KOTWICY — trzy komendy, trzy rozne liczby. To jest sedno pytania z R5.
git rev-list --count            316bce9dd9..29fcbd4de20ca26d2febc50d9455128cab47ffce
git rev-list --count --no-merges 316bce9dd9..29fcbd4de20ca26d2febc50d9455128cab47ffce
git rev-list --count --first-parent 316bce9dd9..29fcbd4de20ca26d2febc50d9455128cab47ffce
#   moje liczby: 1216 · 1015 · 315. ★ ZLECENIE MOWILO 615 — NIE ODTWORZYLEM TEJ LICZBY.

# (e) kotwica jest wpisana w wiersz G19 modulu 01 — przeczytaj ja doslownie
bash -c "grep -hE 'G19' docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md" | cut -c1-400
#   oczekiwane: 'Kotwica: SHA odbioru modulu z wiersza G18 = 316bce9dd9' oraz 'Mianownik: 49 plikow'
#   ★★ MIANOWNIK W MACIERZY MOWI 49. DRYF DZIS MOWI 106. To NIE jest sprzecznosc do naprawienia
#   przez nadpisanie liczby — to jest dokladnie ten problem, o ktory pytasz wlasciciela w R5.

# (f) cel mutacji z day307 istnieje na markerze
bash -c "grep -n 'getUserWorkload' server/src/controllers/TaskController.ts"
#   oczekiwane: definicja w okolicach wiersza 2681
ls server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts
#   oczekiwane: plik istnieje (216 niepustych linii)

# (g) TECHNICAL_REGRESSION_PASS zostal ODRZUCONY — sprawdz, ze go nigdzie nie ma
bash -c "grep -rn 'TECHNICAL_REGRESSION_PASS' docs/ | head"
#   oczekiwane: zero trafien w wierszach macierzy. Jesli jest w opisie decyzji — to opis odrzucenia.

# (h) liscie slownikow i bramki
node -e 'const f=require("fs");function c(o){let n=0;const w=v=>{if(v&&typeof v==="object"){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ["pl","en"])console.log(l,c(JSON.parse(f.readFileSync("public/locales/"+l+"/translation.json","utf8"))));'
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35199, en 33066; focus=0, list=0, artefakt=0, reach=0
```

★ **Te liczby mają pozostać IDENTYCZNE przed pierwszym commitem i po ostatnim.** Ten dyżur
nie zmienia ani kodu produktu, ani słowników. Zmiana którejkolwiek z nich oznacza,
że wyszedłeś poza zakres — i cofasz zmianę.

---

## B.1. TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ

★ Licencja obejmuje **całą ścieżkę**, żebyś nie musiał wybierać między złamaniem licencji
a zrobieniem połowy roboty.

| Warstwa | Ścieżka | Licencja | Produkt |
| --- | --- | --- | --- |
| **macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **★ WĄSKA — WYŁĄCZNIE wiersz `G19`, wyłącznie w modułach, dla których `R4` wykaże domknięcie, i wyłącznie commitem, który W TYM SAMYM `git show --stat` niesie plik dowodowy.** Zakaz dotykania jakiegokolwiek innego wiersza, w szczególności `G16` i `G18` | zmieniony wiersz + dowód w jednym commicie |
| **testy izolacyjne (odczyt+uruchomienie)** | `server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts` | odczyt i uruchomienie; **modyfikacja WYŁĄCZNIE w kopii poza repo** (seeder jest fail-closed na historyczne `6314/cx307`) | para `404`/`200` z logiem |
| **kontroler — cel mutacji** | `server/src/controllers/TaskController.ts` (`getUserWorkload`, okolice `2681`–`2730`) | **mutacja TYMCZASOWA po kopii przez `cp` do `SCRATCH`**; przywrócenie przez `cp`, **nigdy `git stash`** (`Z27`); `git diff` po przywróceniu **pusty** | `GREEN`→`RED`→`GREEN` + pusty `git diff` |
| **serwis** | `server/src/services/TaskAssignmentService.ts` | tylko odczyt — ustalasz, czy zabezpieczenie stoi w prechecku kontrolera, czy w serwisie; **wynik zapisujesz zdaniem w raporcie** | zdanie „zabezpieczenie stoi w `plik:linia`" |
| **trasy pozostałych modułów `A`** | `server/src/routes/**` dla `04`, `05`, `06`, `11`, `13` | tylko odczyt + uruchomienie istniejących testów | wskazanie testu zamykającego lukę albo brief braku |
| **nowe kontrakty testowe** | `tests/**` (★ **NIGDY pod `src/`**) | **zapis** — dla modułu `A` bez istniejącego dowodu produkujesz **czerwony z założenia** kontrakt `it('KONTRAKT DLA DYŻURU 353 — …')` z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`; `git add -f` | plik kontraktu + jego czerwony wynik |
| **dowody** | `evidence/g19/day353/**` (**NOWY** katalog) | **zapis, `git add -f`** — ta instrukcja daje jawną licencję na binaria i logi; „zakaz binariów w repo" byłby wymyślonym powodem | wszystkie `*.json`, `*.log`, `*.md` przelotów |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY353_G19_WZNOWIENIE_REPORT.md` | **zapis (główny produkt)** | raport |
| **rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **★ WĄSKA — WYŁĄCZNIE dopisanie JEDNEJ nowej sekcji o pierwszej wolnej literze.** Zakaz kasowania i przeredagowywania sekcji zastanych | jedna sekcja |
| **kod produktu** | `src/**`, `server/src/**` (poza mutacją tymczasową) | **★ ZAKAZ ZAPISU.** Ten dyżur nie pisze kodu; znaleziony defekt idzie do raportu jako `plik:linia` + **diff nienałożony** | wpis w raporcie |
| **bramki i harness** | `scripts/check-*.sh`, `scripts/dev/reachability-from-root.mjs`, `tests/setup.ts`, `tests/helpers/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **NIETYKALNE DO ZAPISU** — wolno wołać w pomiarze | wyniki `0` |

---

## B.2. TABELA POZYCJI

| Poz. | Co robi | Rdzeń? | Wykonalne bez pliku przekrojowego? | Commit |
| --- | --- | --- | --- | --- |
| `R0` | dwie twarde zasady — czytasz, nie wykonujesz | — | — | — |
| `R1` | weryfikacja punktu wznowienia + rozstrzygnięcie rozbieżności `615` | TAK | TAK — sam odczyt artefaktów i `git rev-list` | **TAK** |
| `R2` | odtworzenie `day307` na dzisiejszym markerze i **orzeczenie, czy wystarcza** dla `01` i `08` | TAK | TAK — mutacja siedzi w ciele jednej funkcji kontrolera | **TAK** |
| `R3` | pięć pozostałych modułów kubełka `A`: `04`, `05`, `06`, `11`, `13` | TAK | TAK — każdy moduł ma własną trasę i własny test | **TAK** |
| `R4` | orzeczenie per wiersz dla 16 modułów | TAK | TAK — dokument | **TAK** |
| `R5` | podniesienie wierszy z dowodem + **pytanie o kotwicę** | TAK | TAK | **TAK** |
| `R6` | raport i jedna sekcja rejestru | — | TAK | **TAK** |

★ **Commit po KAŻDEJ pozycji `R`.** Pozycja bez commita jest pozycją niewykonaną.

---

## B.3. TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | pliki dryfu `G19` | `106` | `(b)` z „Zmierz moje liczby sam" | TAK — artefakt z repo |
| 2 | pliki dryfu bez testów | `90` | `(b)` | TAK |
| 3 | Blok 1 | `131` / `127` / `4` | `(c)`, potem własny przelot w `R3` | TAK |
| 4 | Blok 2 | `218` / `218` / `0` | `(c)`, potem własny przelot | TAK — ★ wariant 7-plikowy `225/224/1` **odrzucony** |
| 5 | Blok 3 | `18` / `11` / `7` | `(c)`, potem własny przelot | TAK |
| 6 | dystans od kotwicy | `1216` / `1015` / `315` | `(d)` | TAK — ★ **`615` ze zlecenia nieodtworzone** |
| 7 | mianownik wpisany w macierz | `49` | `(e)` | TAK — ★ i **nie zgadza się** z `106`; to treść pytania z `R5` |
| 8 | kubełki po `R2` dyżuru 348 | `A=7`, `B=0`, `C=9` | `evidence/g19/day348/r2-kubelki.md` | TAK — ★ **hipoteza, nie werdykt** |
| 9 | moduły `A` bez dowodu | `5` (`04`,`05`,`06`,`11`,`13`) | `R3`, licznik własny | TAK |
| 10 | wierszy podniesionych / dowodów załączonych | — | `R5`, dwa liczniki | TAK — **muszą być równe** |
| 11 | liście słowników i bramki | `35199` / `33066`, cztery `0` | `(h)` | TAK — identyczne przed i po |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| Plik | Pozycja | Zakres |
| --- | --- | --- |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY353_G19_WZNOWIENIE_REPORT.md` | `R6` | główny produkt |
| `evidence/g19/day353/**` | `R1`–`R5` | **NOWY** katalog; wszystkie logi, `*.json` przelotów, `r4-orzeczenie.md` |
| `docs/program/REJESTR_ZNALEZISK_20260903.md` | `R6` | jedna nowa sekcja, pierwsza wolna litera |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Warunek | Zakres |
| --- | --- | --- |
| `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **wyłącznie** gdy `R4` orzeknie domknięcie z dowodem | **wyłącznie wiersz `G19`**, jednym commitem z dowodem |
| `tests/**` (nowe kontrakty) | gdy moduł kubełka `A` nie ma testu zamykającego lukę | czerwony z założenia kontrakt + brief; `git add -f` |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

`src/**` · `server/src/**` (poza mutacją tymczasową, przywracaną przez `cp`) ·
`public/locales/**` · żaden wiersz macierzy poza `G19` · `scripts/**` · `docs/ui-standards/**` ·
`.github/workflows/**` · żaden plik dyżurów 351, 352, 354 ani 355–358.

★ Plik postępu `/private/tmp/cx-day353-postep.md` żyje **poza repo**.

### B.4.4. Zasoby wyłączne

Baza **6412**, runtime **5552**, kontener **`cx-day353-pg`**, baza **`cx353`**,
worktree `/private/tmp/cx-day353-g19-wznowienie`, gałąź `codex/day353-g19-wznowienie-20260904`.
Sprawdziłem 04.09: wszystkie cztery porty wolne, kontener nie istnieje, worktree nie istnieje,
gałąź nie istnieje.

★★ **Port zajęty = STOP CAŁOŚCI (`Z7`), NIGDY podmiana numeru.** Równolegle idą 351
(6410/5550), 352 (6411/5551), 354 (6413/5553) oraz **355–358 pisane przez innego autora,
których portów nie znam w chwili pisania**.

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
git status --short                  # zero plikow spoza tabeli B.4.1/B.4.2
git diff --cached --stat            # ★ commit dotykajacy macierzy MUSI zawierac plik dowodowy
git diff -- server/src/controllers/TaskController.ts   # PUSTY (mutacja przywrocona)
bash -c "grep -rnE '^(<{7}|>{7}|={7})' $(git diff --cached --name-only)"   # zero znacznikow konfliktu
```

---

## R0 — DWIE TWARDE ZASADY (przeczytaj, zanim cokolwiek zrobisz)

**ZASADA 1 — wiersz macierzy zmienia stan WYŁĄCZNIE z dowodem załączonym w TYM SAMYM
commicie.** Nie „dowód był w poprzednim commicie", nie „dowód jest w raporcie, który
dopiszę w `R6`". `git show --stat <commit dotykający macierzy>` musi zawierać plik
z `evidence/g19/day353/**` albo plik testu. Commit, który zmienia wiersz i nie niesie
dowodu, **cofasz `git reset --soft HEAD~1`** i składasz na nowo.

**ZASADA 2 — `TECHNICAL_REGRESSION_PASS` został ODRZUCONY i nie wolno go wprowadzić
pod inną nazwą.** Zakaz obejmuje każdy synonim: `MACHINE_PASS`, `TECHNICAL_PASS`,
`REGRESSION_TECHNICAL_OK`, `PASS_MASZYNOWY`, `PASS (zakres techniczny)` i każde inne
sformułowanie, którego skutkiem jest wiersz brzmiący jak zaliczenie. Stan wiersza po
podniesieniu ma **nazywać zakres dowodu i jego granicę** — na przykład
`NOT_PROVEN / OWNER_RETEST_PENDING — para izolacyjna udowodniona (evidence/g19/day353/…), brakuje oczu właściciela`.

★ **Jeżeli uważasz, że obie zasady razem czynią ten dyżur niewykonalnym — to jest wynik
i zapisujesz go w `R5` jako pytanie do właściciela. Nie obchodzisz ich.**

---

## R1 — WERYFIKACJA PUNKTU WZNOWIENIA (rdzeń, ale TANI)

★★ **To NIE jest powtórka `R1`/`R2` dyżuru 348.** Masz **potwierdzić, że dziedziczone
liczby są prawdziwe**, a nie policzyć je jeszcze raz od zera.

1. Przeczytaj `evidence/g19/day348-artefakty/PUNKT-WZNOWIENIA.md` w całości.
   **`ls` na każdej ścieżce, którą cytuje** — dowód poza repo wyparowuje, a ten akurat
   został uratowany do repo i ma istnieć.
2. Odtwórz komendy `(a)`–`(e)` z bloku „Zmierz moje liczby sam". Zapisz **swoje** wyniki
   obok moich w tabeli `porownanie-liczb.md`.
3. ★★ **Rozstrzygnij rozbieżność `615`.** Masz trzy moje liczby (`1216`/`1015`/`315`) i ani
   jedna nie daje `615`. Znajdź kombinację kotwicy i flagi, która ją daje — albo **zapisz
   wprost: „liczba `615` nie jest odtwarzalna z kotwicy wpisanej w macierz"**. Obie
   odpowiedzi są pełnowartościowe; **brak odpowiedzi nie jest**.
4. Zapisz **zdanie o tym, czy kubełki z `R2` dyżuru 348 dalej się bronią** — nie
   przeklasyfikowujesz szesnastu modułów, tylko sprawdzasz, czy dwa nowe pliki dryfu
   (`IdeaRightPanel.tsx`, `day277-decyzje-zapis.pg.test.ts`) zmieniają rodzaj brakującego
   dowodu w którymkolwiek module. Autor 348 twierdzi, że nie. **Sprawdź to i podpisz się
   pod tym albo obal.**

**Wymagany dowód:** `evidence/g19/day353/r1-porownanie-liczb.md` z parą kolumn
„liczba autora instrukcji / mój pomiar" dla wszystkich jedenastu wierszy tabeli `B.3` ·
jawne zdanie o `615` · zdanie o kubełkach. **Commit po `R1`.**

---

## R2 — `day307` NA DZISIEJSZYM MARKERZE I ORZECZENIE, CZY WYSTARCZA (rdzeń)

★★ **Dyżur 348 ten dowód WYKONAŁ.** Nie budujesz go drugi raz od zera — **odtwarzasz go
na dzisiejszym markerze i rozstrzygasz pytanie, którego 348 nie postawił: czy on w ogóle
zamyka wiersz `G19` dla `01_ORGANIZATION` i `08_MEETINGS`.**

1. Postaw kontener `cx-day353-pg`, port `6412`, baza `cx353`, obraz `pgvector/pgvector:pg16`
   (`postgres:15` **nie przechodzi migracji**). Migracje **dwoma przebiegami**; drugi ma dać
   `Applying migrations: 0`. Oba logi do `evidence/g19/day353/`.
2. **Kopia seedera poza repo.** `day307` jest fail-closed na historyczne `6314/cx307`.
   Kopiujesz plik do `SCRATCH`, zmieniasz **wyłącznie guard** na `6412`/`cx353`,
   **źródła w repo NIE dotykasz**.
3. Przelot pary: obcy ma dostać **`404`**, właściciel **`200`**, na **tym samym `userId`**.
   ★★ **Symetryczna odmowa (`404`/`404`) NIE JEST dowodem** — to kształt „zamknięte przez
   wygaszenie": funkcja wyłączona dla wszystkich, bramka zielona, produkt martwy. Para
   musi mieć **oba człony**: „obcy nie widzi" **i** „właściciel widzi, i widzi coś niepustego".
   Puste `200` właściciela to też nie dowód — zapisz długość ciała odpowiedzi.
4. **Mutacja celująca w ZABEZPIECZENIE, nie w mechanizm** (`Z32`): usuwasz
   `AND organization_id = ?` z prechecku w `TaskController.getUserWorkload`
   (`server/src/controllers/TaskController.ts`, okolice `2681`–`2730`), po kopii przez `cp`
   do `SCRATCH`. Test ma **zaczerwienić się** komunikatem kształtu `expected 200 to be 404`.
   Przywracasz przez `cp` (**nigdy `git stash`**, `Z27`) → **zielony**;
   `git diff -- server/src/controllers/TaskController.ts` **pusty**.
   ★ Jeżeli po usunięciu warunku test dalej jest zielony — **zabezpieczenie stoi gdzie
   indziej albo nie stoi wcale**; wtedy szukasz go w `TaskAssignmentService.getUserWorkload`
   i mutujesz **tam**, a fakt „precheck kontrolera nie jest zabezpieczeniem" zapisujesz
   jako znalezisko.
5. ★★★ **ORZECZENIE — to jest właściwy produkt tej pozycji.** Odpowiedz pisemnie na
   pytanie: *czy para `day307` na trasie workloadu zamyka wiersz `G19` dla `01_ORGANIZATION`?
   A dla `08_MEETINGS`?* `R2` dyżuru 348 przypisał `08` do kubełka `A` uzasadnieniem
   „ma ten sam największy mianownik co `01`" — **i sam dodał, że identyczność mianownika
   nie jest jeszcze podstawą**. Rozstrzygnij to: albo pokaż, że mianownik `08` jest
   dosłownie tym samym zbiorem plików (wtedy jeden dowód uzasadnia dwa wiersze), albo
   orzeknij, że `08` potrzebuje własnej pary na własnej trasie — i **nazwij tę trasę**.

**Wymagany dowód:** dwa logi migracji · para z dwoma kodami i długością ciała odpowiedzi ·
mutacja w obie strony z pustym `git diff` · **pisemne orzeczenie dla `01` i `08` z
uzasadnieniem opartym na zbiorze plików, nie na liczbie**. **Commit po `R2`.**

---

## R3 — PIĘĆ POZOSTAŁYCH MODUŁÓW KUBEŁKA `A` (rdzeń)

Moduły: `04_ASSESSMENT`, `05_INITIATIVES`, `06_EXECUTION`, `11_MATERIALS`, `13_CHAT`.
Dla **każdego** z nich, po kolei:

1. **Który konkretny test/kontrakt zamyka lukę** — imiennie, ze ścieżką. Kandydaci
   wskazani przez `R2` dyżuru 348: `04` → kontrakty `day274`/`day275`; `05` → `day277`
   i trasy zapisu; `06` → `initiativesExecutionRuntime.dropdown`; `11` → kontrakty zapisu
   `day276`; `13` → trasy `chat`/`teresa` i `agent-hub`. **To są HIPOTEZY autora 348, nie
   ustalenia — sprawdź każdą.**
2. **Uruchomienie z `numTotalTests`.** `--retry=0`, `--reporter=json --outputFile=<plik
   w ARTEFAKTY>`. ★★ Przelot z **zerem** wykonanych przypadków kończy się `exit 0`
   i **nie jest pomiarem** — to zdarzyło się dyżurowi 335 przy Bloku 3 z roota i słusznie
   zostało odrzucone. `No test files found` oraz `Transform failed` to **BŁĄD KOMENDY**,
   nie `PASS`.
3. **Dowód mutacyjny celujący w zabezpieczenie.** Zabezpieczeniem jest to, co odróżnia
   obcego od właściciela (albo zapis dozwolony od zabronionego) — **nie** mechanizm
   walidacji kształtu, nie mapowanie błędu, nie kolejność pól. Mutacja ma **skasować
   zabezpieczenie** i test ma **zaczerwienić się z tego powodu**; jeżeli czerwienieje
   z innego powodu, mutacja chybiła i musisz ją przecelować.
4. **Jeżeli dla któregoś modułu takiego testu NIE MA — to jest wynik**, nie porażka.
   Piszesz: „kubełek `A` był dla modułu `X` przypisany błędnie; brakuje kontraktu `Y`"
   i produkujesz **czerwony z założenia** kontrakt w `tests/`:
   `it('KONTRAKT DLA DYŻURU 353 — <co ma udowodnić>')` z nagłówkiem
   `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`, `git add -f`.
5. **Odtwórz trzy bloki na SWOJEJ bazie** — Blok 1 wariantem (C), Blok 2 jednostkowo,
   Blok 3 wariantem (B) z cwd `server/`. Podaj `numTotalTests` dla każdego i **porównaj
   z liczbami dziedziczonymi** (`131/127/4`, `218/218/0`, `18/11/7`). Rozjazd zapisujesz;
   **nie naprawiasz** — czerwienie Bloku 1 i Bloku 3 to teren innych dyżurów.
6. **Sprzątanie:** `docker rm -fv cx-day353-pg` (bez `-v` wolumen zostaje), `df -h /`
   przed i po. ★ **Zakaz `pkill`/`killall`** — zabijasz wyłącznie własne PID-y.

**Wymagany dowód:** dla każdego z pięciu modułów albo wykonany dowód (test + `numTotalTests`
+ mutacja w obie strony), albo czerwony kontrakt z briefem · trzy bloki z `numTotalTests`
i porównaniem · `df -h /` przed i po. **Commit po `R3`** (a jeżeli robisz to modułami —
commit po każdym module; wtedy pięć commitów).

---

## R4 — ORZECZENIE PER WIERSZ: CO DOKŁADNIE BRAKUJE

Tabela **16 wierszy**, cztery kolumny: moduł · kubełek · **co zostało udowodnione**
(z nazwą przypadku i ścieżką artefaktu) · **czego dokładnie brakuje, żeby wiersz się
podniósł** · **kto to zrobi** (maszyna / właściciel / osobne zlecenie).

★★ **Zdanie „przelot właściciela pozostaje wymagany", powtórzone szesnaście razy, NIE JEST
orzeczeniem.** Wymagam konkretu, na przykład: *„brakuje pary izolacyjnej dla istniejącego
obiektu `X` na trasie `Y`; test do napisania, mutacja w `plik:linia`"* albo *„brakuje
wyłącznie oczu właściciela na realnym rekordzie `Z` — wszystko maszynowe zamknięte, dowód
w `evidence/g19/day353/…`"*.

**Wymagany dowód:** `evidence/g19/day353/r4-orzeczenie.md` · liczby zbiorcze: ile wierszy
domkniętych maszynowo, ile czeka wyłącznie na właściciela, ile ma realną lukę.
**Commit po `R4`.**

---

## R5 — PODNIESIENIE WIERSZY + ★★★ PYTANIE O KOTWICĘ

### Część A — podniesienie

1. Dla **każdego** wiersza uznanego w `R4` za domknięty maszynowo — gotowy tekst wiersza,
   który **nazywa zakres dowodu i jego granicę** i **nie jest** `PASS` ani synonimem
   odrzuconego wariantu (`R0`, zasada 2).
2. **Wpis i dowód idą JEDNYM commitem** (`R0`, zasada 1).
3. **Policz: ile wierszy podniosłeś, ile dowodów załączyłeś. Te dwie liczby mają być
   równe** — albo wyjaśniasz, dlaczego jeden dowód uzasadnia więcej niż jeden wiersz,
   pokazując, że mianownik tych wierszy jest **dosłownie tym samym zbiorem plików**
   (to jest dokładnie pytanie `01` vs `08` z `R2`).
4. **Zero podniesionych wierszy też jest wynikiem** — wtedy raport zawiera zdanie
   *„zero wierszy podniesionych, bo …"* z konkretnym powodem **per kubełek**. Dyżur 335 tak
   zrobił i miał rację. Powtórzenie tego z lepszym uzasadnieniem i świeższym pomiarem
   jest pełnowartościowe. Powtórzenie tego **bez** wykonania `R2` i `R3` nie jest.

### Część B — ★★★ pytanie, którego dwa dyżury nie postawiły

Sformułuj i zapisz **pytanie rozstrzygalne do właściciela** (albo **propozycję reguły**),
w brzmieniu własnym, wokół faktu:

> **Mianownik `G19` rośnie z każdą naszą pracą.** Wiersz macierzy mówi „`49` plików
> od kotwicy `316bce9dd9`". Pomiar 335 dał `104` pliki. Pomiar 348, jeden dzień później,
> dał `106`. Dystans od tej samej kotwicy do dzisiejszego markera to `1216` commitów
> (albo `1015`, albo `315` — zależnie od jednej flagi; liczba `615` z raportu 348 nie jest
> odtwarzalna). **Każdy dowód, który złożysz dzisiaj, jest dowodem na stan sprzed
> następnego scalenia.** Przy tej konstrukcji bramka `G19` nie domknie się **nigdy**,
> niezależnie od jakości pracy.

Pytanie ma być **rozstrzygalne** — czyli mieć postać wyboru z wypisanymi konsekwencjami,
nie postać „co robimy?". Naszkicuj co najmniej trzy warianty kotwicy i przy każdym napisz,
co się dzieje z bramką i ile pracy kosztuje:

- **kotwica zamrożona** (dowód wiąże się z konkretnym SHA i wygasa przy następnym odbiorze),
- **kotwica krocząca z progiem** (`G19` domknięty, dopóki dryf od ostatniego dowodu nie
  przekroczy `N` plików współdzielonych),
- **kotwica per warstwa** (osobny dowód dla warstwy współdzielonej i osobny dla modułu),
- ewentualny czwarty wariant, jeżeli zobaczysz lepszy.

★★★ **NIE ROZSTRZYGASZ TEGO SAM.** Nie wybierasz wariantu, nie wpisujesz go do macierzy,
nie zmieniasz definicji bramki. Produkt tej części to **jedna strona tekstu w raporcie,
zakończona pytaniem**, na które właściciel odpowiada jednym słowem.

**Wymagany dowód:** `git show --stat` każdego commita dotykającego macierzy · tabela
„wiersz → dowód" · dwie zgodne liczby · sekcja „Pytanie o kotwicę" z co najmniej trzema
wariantami i konsekwencjami. **Commit po `R5`.**

---

## R6 — RAPORT I JEDNA SEKCJA REJESTRU

Raport `CODEX_DAY353_G19_WZNOWIENIE_REPORT.md` zawiera, w tej kolejności:

1. **Co odziedziczyłeś i co z tego potwierdziłeś** — tabela z `R1`, para kolumn.
2. **Każdą liczbę z tej instrukcji, którą Twój pomiar obalił** — osobną sekcją, wprost.
3. Orzeczenie `R2` dla `01` i `08`.
4. Wyniki `R3` per moduł, z `numTotalTests` i wynikiem mutacji.
5. Tabelę `R4` (16 wierszy).
6. Wynik `R5` część A: ile wierszy, ile dowodów.
7. **Sekcję „Pytanie o kotwicę"** (`R5` część B).
8. Co zostało niewykonane i dlaczego — imiennie.

Sekcja w `docs/program/REJESTR_ZNALEZISK_20260903.md` o **pierwszej wolnej literze**.
Sekcje idą dziś do `Q`, ale równolegle dopisuje inny autor — **literę sprawdzasz komendą
tuż przed commitem**:
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`,
nigdy z góry.

**Commit po `R6`.**

---

## Próg odbioru

Dyżur jest odebrany, gdy **wszystkie** poniższe są prawdziwe:

1. `R1` potwierdził albo obalił każdą z jedenastu liczb tabeli `B.3`, imiennie, i wydał
   jawne zdanie o liczbie `615`.
2. `R2` dał parę `404`/`200` na **tym samym `userId`**, z niepustym ciałem odpowiedzi
   właściciela, mutację w obie strony i **pusty `git diff`** — oraz **pisemne orzeczenie
   dla `01` i `08`**.
3. `R3` dla **każdego** z pięciu modułów `A` dał albo dowód z mutacją celującą
   w zabezpieczenie, albo czerwony z założenia kontrakt w `tests/` z briefem.
4. Trzy bloki odtworzone na własnej bazie z `numTotalTests`, porównane z dziedziczonymi.
5. `R4` ma 16 wierszy i **ani jeden** nie brzmi „przelot właściciela pozostaje wymagany"
   bez konkretu.
6. Każdy commit dotykający macierzy niesie dowód w **tym samym** `git show --stat`.
7. Żaden wiersz nie brzmi `PASS` ani synonimem odrzuconego `TECHNICAL_REGRESSION_PASS`.
8. Sekcja „Pytanie o kotwicę" istnieje, ma ≥3 warianty z konsekwencjami i **nie rozstrzyga**.
9. Liście słowników i cztery bramki identyczne przed i po; `git diff` na kodzie produktu pusty.
10. Kontener usunięty, `df -h /` przed i po w raporcie.

---

## Prawo zatrzymania

Zatrzymujesz się i piszesz **STOP** z powodem, jeżeli:

- którykolwiek z Twoich portów (`6412`, `5552`) jest zajęty — **STOP całości, nigdy podmiana**;
- `PUNKT-WZNOWIENIA.md` albo którykolwiek artefakt `evidence/g19/day348-artefakty/**` **nie
  istnieje** — wtedy podstawa tego dyżuru zniknęła i trzeba to zgłosić, a nie mierzyć od zera;
- migracje nie przechodzą dwukrotnie na czystej bazie;
- mutacja `day307` **nie czerwieni** testu w żadnym z dwóch miejsc (kontroler, serwis) —
  to znaczy, że zabezpieczenia nie ma, i jest to znalezisko `P0`, nie powód do improwizacji;
- realizacja `R5` wymagałaby wpisania stanu, który jest synonimem `PASS`.

★ **Zatrzymanie z konkretnym powodem jest pełnowartościowym wynikiem dyżuru.**
Zmyślony dowód nie jest.

---

## AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para | Rozstrzygnięcie |
| --- | --- |
| „wznów, nie powtarzaj" × „każdą liczbę mierzysz sam (`Z24`)" | `R1` — mierzysz **tanie** liczby (odczyt artefaktów, `git rev-list`), a **drogie** (przeloty, migracje) robisz w `R2`/`R3` na własnej bazie, bo tam i tak są potrzebne |
| „podnieś wiersze" × „zakaz `PASS` i synonimów" | `R0` zasada 2 + `R5` — stan wiersza nazywa **zakres i granicę** dowodu |
| „dowód w tym samym commicie" × „commit po każdej pozycji `R`" | `R0` zasada 1 — pozycje `R1`–`R4` nie dotykają macierzy, więc kolizji nie ma; macierzy dotyka wyłącznie `R5` |
| „`08` w kubełku `A`" × „identyczność mianownika nie jest podstawą" | `R2` punkt 5 — orzekasz na **zbiorze plików**, nie na liczbie |
| „mianownik `49` w macierzy" × „`106` w pomiarze dryfu" | **NIE naprawiasz przez nadpisanie liczby** — to jest treść pytania z `R5` część B |
| „`615` commitów" × trzy moje liczby | `R1` punkt 3 — rozstrzygasz i zapisujesz; „nieodtwarzalne" jest dopuszczalną odpowiedzią |
| „wariant Bloku 2 `225/224/1`" × „`218/218/0`" | Odrzucony jako zły mianownik — **nie wracasz do niego** |
| „zakaz zmiany kodu produktu" × „mutacja w `TaskController.ts`" | `B.1` — mutacja jest **tymczasowa**, po `cp`, przywracana przez `cp`, z pustym `git diff` na końcu |
| „`git add -f` dla dowodów" × „zakaz binariów w repo" | `B.1` — ta instrukcja daje **jawną licencję** na `evidence/g19/day353/**` |
| „zero wierszy to też wynik" × „`R2`/`R3` są rdzeniem" | `R5` punkt 4 — zero wierszy jest wynikiem **po** wykonaniu `R2` i `R3`, nigdy zamiast nich |
| „pytanie do właściciela" × „mandat decydowania" | `R5` część B — kotwica bramki odbioru jest **regułą programu**, nie decyzją wykonawczą; opisujesz, nie rozstrzygasz |

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela wyżej | TAK — jedenaście par, każda rozstrzygnięta w treści |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone `ls`-em na markerze `29fcbd4de2`; zero `BRAK`. Oznaczone `NOWY`: `evidence/g19/day353/**`, raport, ewentualne kontrakty w `tests/` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, jedenaście wierszy; **dwie liczby ze zlecenia obalone własnym pomiarem** (`615` nieodtwarzalne, liście `35199/33066` zamiast `35198/33065`) |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — każdy wiersz „tylko odczyt" ma rzeczownik-produkt (zdanie · brief · wskazanie · wynik przelotu) |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4; mutacja siedzi w ciele jednej funkcji, `ApiGateway` nietknięty |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `B.4.4`; porty `6412`/`5552` zmierzone jako wolne, kontener, worktree i gałąź nie istnieją. ★ 355–358 pisze równolegle inny autor — `Z7` zaostrzony: port zajęty = STOP całości |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK — wszystkie grepy przez `bash -c`, wszystkie przeloty z `--retry=0` i `--reporter=json` |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu dyżurowi (sześć) | TAK — `§0.2d` w części A + sześć pułapek tego dyżuru w polu pułapek |
| 9 | Samodzielność — zero odwołań do rozmów bez ścieżki | TAK; każdy cytat pracy 335 i 348 ma SHA commita albo ścieżkę artefaktu w repo |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK — sprawdzone przez generator, który blokuje zapis przy niespełnieniu |
