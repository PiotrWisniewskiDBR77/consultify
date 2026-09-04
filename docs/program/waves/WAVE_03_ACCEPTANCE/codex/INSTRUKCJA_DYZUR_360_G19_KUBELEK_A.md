# INSTRUKCJA DYŻURU nr 360 — Codex — „★★★ G19 KUBEŁEK A — SIEDEM WIERSZY DOWODLIWYCH MASZYNOWO, PO WDROŻENIU REGUŁY WAŻNOŚCI Z DEC-392. Dyżur 353 postawił pytanie o kotwicę; właściciel oddał decyzję CTO i 04.09 zapadła DEC-392 (sekcja `R` rejestru znalezisk): kotwica `G19` jest RUCHOMA, dowód ważny NA DZIEŃ ODBIORU, wpis niesie DATĘ i SHA pomiaru, po SIEDMIU DNIACH wiersz wygasa do `PASS_STALE` i wymaga powtórzenia. Ten dyżur ma najpierw zaimplementować tę regułę maszynowo (skrypt + test + dowód mutacyjny celujący w termin ważności), a potem zamknąć siedem wierszy kubełka `A` — `01`, `04`, `05`, `06`, `08`, `11`, `13` — każdy parą izolacyjną na realnym PostgreSQL i mutacją celującą w ZABEZPIECZENIE. Wzorzec dowodu jest gotowy i NIE budujesz go drugi raz"

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
> **wyłącznie** `/private/tmp/cx-day360-g19-kubelek-a`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `2a7273e087cbd3e44344725b524f6ddd79d5badc`**
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
Zakres: **BRAMKA ODBIORU `G19` („Later-change regression obligations resolved”) — **kubełek `A`, siedem modułów: `01_ORGANIZATION`, `04_ASSESSMENT`, `05_INITIATIVES`, `06_EXECUTION`, `08_MEETINGS`, `11_MATERIALS`, `13_CHAT`**. Przedmiotem pracy jest **dowód**, nie kod produktu: reguła ważności dowodu wg `DEC-392`, para izolacyjna cross-org na realnym PostgreSQL, mutacja celująca w zabezpieczenie, wpis do macierzy z datą i SHA pomiaru. ★ Kubełki dziedziczysz z dyżuru 353 (`evidence/g19/day353/r4-orzeczenie.md`): `A = 01, 04, 05, 06, 08, 11, 13` (siedem), `C = 02, 03, 07, 09, 10, 12, 14, 15, 16` (dziewięć). Kubełek `C` jest przedmiotem RÓWNOLEGŁEGO dyżuru 361 — **nie dotykasz jego dziewięciu wierszy****.
Trasy front: `BRAK — ten dyżur nie dotyka frontu i nie renderuje ani jednego ekranu. Gdybyś znalazł się w `src/**` z edytorem, jesteś poza zakresem. Jedyny kontakt z `src/` to **odczyt**`. Trasy tył: `★★ SIEDEM PAR IZOLACYJNYCH. **Wzorzec (gotowy, NIE budujesz go drugi raz):** `server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts`, przypadek `denies foreign workload lookup while the owner reads the seeded task` (wiersz `214`); trasa `GET /api/tasks/workload/:userId` → `TaskController.getUserWorkload` (`server/src/controllers/TaskController.ts:2681`, wywołania serwisu `:2703` i `:2725`); mutacja celuje w `AND organization_id = ?` w prechecku; para: obcy `404` / właściciel `200` na TYM SAMYM `userId`; `GREEN`→`RED`→`GREEN`, pusty `git diff` po `cp`. **`08_MEETINGS` — trasa i cel mutacji ustalone przeze mnie na markerze:** `GET /api/meetings/:id` (`server/src/routes/meeting.routes.ts:345`), strażnicy to filtr `organization_id = ?` w `getMeeting` (`server/src/services/meetingService.ts:285`, dosłownie `SELECT * FROM meetings WHERE id = ? AND organization_id = ? LIMIT 1`) ORAZ `canAccessMeeting` (`server/src/routes/meeting.routes.ts:150`). ★★ TA TRASA MA W KOMENTARZU WPISANE, ŻE **ZWIJA „nie znaleziono” I „brak dostępu” DO TEGO SAMEGO `404`** (`meeting.routes.ts:333-343`) — czyli symetryczna odmowa jest tu WYJĄTKOWO łatwa do wyprodukowania i **nie jest dowodem**. **Trasy `04`, `05`, `06`, `11`, `13` ustalasz sam** — punktem wyjścia są pięć czerwonych z założenia kontraktów, które dyżur 353 zostawił w repo: `tests/unit/day353-g19-04-assessment.contract.test.ts`, `…-05-initiatives…`, `…-06-execution…`, `…-11-materials…`, `…-13-chat…`. To są BRIEFY, nie ustalenia`.

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
WT=/private/tmp/cx-day360-g19-kubelek-a
MARKER=2a7273e087cbd3e44344725b524f6ddd79d5badc

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day360-g19-kubelek-a-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day360-g19-kubelek-a/config.worktree"
cat "$VAULT/worktrees/cx-day360-g19-kubelek-a/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day360-g19-kubelek-a-scratch
mkdir -p /private/tmp/cx-day360-g19-kubelek-a-artefakty

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
git -C "$VAULT" log --oneline 2a7273e087cbd3e44344725b524f6ddd79d5badc..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 2a7273e087cbd3e44344725b524f6ddd79d5badc..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day360-g19-kubelek-a-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 2a7273e087cbd3e44344725b524f6ddd79d5badc..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `osiem` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day360-g19-kubelek-a

# (1) ★★★ DEC-392 ISTNIEJE W REPO — czytasz ja W CALOSCI, to jest podstawa R1
bash -c "sed -n '/^## R[.] Decyzja CTO 04.09/,/^## S[.]/p' docs/program/REJESTR_ZNALEZISK_20260903.md"
#   oczekiwane: sekcja 'R. Decyzja CTO 04.09 — kotwica bramki G19 (DEC-392)' z akapitami
#   'Dlaczego ruchoma', 'Co dokladnie znaczy ruchoma', 'Czego ta decyzja NIE robi'

# (2) PUNKT WZNOWIENIA Z DYZURU 353 ISTNIEJE — sprawdz `ls`-em, nie zaufaniem
ls -la evidence/g19/day353/ evidence/g19/day353-artefakty/ evidence/g19/day348-artefakty/
#   oczekiwane: w day353/ SIEDEM plikow (r1..r5 + dwa logi migracji), w day353-artefakty/ TRZYNASCIE
cat evidence/g19/day353/r4-orzeczenie.md
#   ★ PRZECZYTAJ W CALOSCI. Stad masz kubelki: A = 01,04,05,06,08,11,13; C = reszta.

# (3) DRYF I KUBELKI — DZIEDZICZYSZ, NIE LICZYSZ PONOWNIE
wc -l < evidence/g19/day348-artefakty/g19-dryf-dzis.txt
bash -c "grep -vcE '__tests__|[.]test[.]' evidence/g19/day348-artefakty/g19-dryf-dzis.txt"
#   moje liczby: 106 plikow, 90 bez testow. ★ TRZECIE LICZENIE DRYFU JEST ZAKAZANE.

# (4) ★★ MIANOWNIK W MACIERZY vs DRYF — sprzecznosc, ktorej NIE naprawiasz nadpisaniem
bash -c "grep -hE '^\| G19 +\|' docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md" | cut -c1-500
#   oczekiwane: kotwica '316bce9dd9' i 'Mianownik: 49'
git rev-list --count            316bce9dd9..2a7273e087cbd3e44344725b524f6ddd79d5badc
git rev-list --count --no-merges 316bce9dd9..2a7273e087cbd3e44344725b524f6ddd79d5badc
git rev-list --count --first-parent 316bce9dd9..2a7273e087cbd3e44344725b524f6ddd79d5badc
#   ★ ZADNA z tych liczb nie daje 615, ktore podawaly dwa dyzury. NIE ODTWARZAJ 615 —
#   DEC-392 rozstrzyga REGULE WAZNOSCI, nie mianownik. Rozjazd 49 vs 106 = OSOBNE PYTANIE.

# (5) SZESNASCIE WIERSZY G19 STOI NA NOT_PROVEN — sprawdz sam
bash -c "for d in docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/; do printf '%s ' \$(basename \$d); grep -E '^\| G19 +\|' \$d/MODULE_ACCEPTANCE.md | head -1 | awk -F'|' '{print \$4}'; done"
#   moja liczba: 16 x 'NOT_PROVEN / OWNER_RETEST_PENDING'

# (6) WZORZEC DOWODU I CELE MUTACJI ISTNIEJA NA MARKERZE
ls -la server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts
bash -c "grep -n \"denies foreign workload lookup\" server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts"
#   oczekiwane: wiersz 214
bash -c "grep -n 'getUserWorkload' server/src/controllers/TaskController.ts"
#   oczekiwane: 2681, 2703, 2725
bash -c "grep -n 'SELECT [*] FROM meetings WHERE id = ? AND organization_id = ?' server/src/services/meetingService.ts"
#   oczekiwane: wiersz 285
bash -c "grep -n 'function canAccessMeeting' server/src/routes/meeting.routes.ts"
#   oczekiwane: wiersz 150
ls tests/unit/day353-g19-*.contract.test.ts
#   oczekiwane: PIEC plikow (04, 05, 06, 11, 13) — czerwone z zalozenia briefy dyzuru 353

# (7) TECHNICAL_REGRESSION_PASS — ma NIE istniec w zadnym wierszu macierzy
bash -c "grep -rn 'TECHNICAL_REGRESSION_PASS' docs/ | head"
#   oczekiwane: zero trafien w wierszach macierzy

# (8) LISCIE SLOWNIKOW I CZTERY BRAMKI — maja byc IDENTYCZNE przed i po calym dyzurze
node -e 'const f=require("fs");function c(o){let n=0;const w=v=>{if(v&&typeof v==="object"){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ["pl","en"])console.log(l,c(JSON.parse(f.readFileSync("public/locales/"+l+"/translation.json","utf8"))));'
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35199, en 33066; focus=0, list=0, artefakt=0, reach=0
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day360-g19-kubelek-a-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6431`. Twój JEDYNY port harnessu to `5571`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day360-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki (04.09 noc) — **nie dotykasz cudzych**: 359 (6430/5570), 360 (6431/5571), 361 (6432/5572), 362 (6433/5573). Wcześniejsze rodzeństwo 04.09: 343-346 (6390-6393 / 5530-5533), 347 (6394/5534), 348 (6395/5535), 349 (6396/5536), 350 (6397/5537), 351 (6410/5550), 352 (6411/5551), 353 (6412/5552), 354 (6413/5553), 355-358. ★★ RÓWNOLEGLE inny autor pisze instrukcje **363-366**; ich portów NIE ZNAM w chwili pisania tej instrukcji, więc obowiązuje reguła twarda: **bierzesz WYŁĄCZNIE swoje dwa porty i żaden inny**, a port zajęty jest powodem do STOP-u całości (`Z7`), nigdy do podmiany numeru. **Twoje własne wyłącznie: baza 6431, runtime 5571.** Zmierzyłem 04.09: `5570-5573` i `6430-6433` wszystkie wolne, kontenery `cx-day359-pg`…`cx-day362-pg` nie istnieją. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!` po starcie każdego procesu w tle)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK. Ten dyżur nie dodaje, nie zmienia i nie przełącza ANI JEDNEJ flagi funkcyjnej. ★ Jeżeli któryś z siedmiu modułów kubełka `A` okaże się bramkowany flagą wyłączoną — to jest ZNALEZISKO do raportu („właściciel widzi flagę jako brak funkcji”), a **nie** powód do włączenia flagi ani do uznania wiersza za domknięty. Dowód złożony na kodzie za flagą OFF jest dowodem na kod, którego użytkownik nie widzi — zapisz tę granicę wprost w wierszu macierzy. ★★ Pamiętaj o kształcie „flaga OFF w kodzie ≠ wyłączona”: w SZEŚCIU rodzinach zmienna środowiskowa omija flagę wczesnym `return true``, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/check-triada.sh`, `scripts/check-gestosc.sh`, `scripts/dev/reachability-from-root.mjs`, `scripts/dev/p0p1-licznik-e1.mjs` i jego test, `.husky/pre-commit`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`. Wszystkie **NIETYKALNE DO ZAPISU** — wolno je wołać w pomiarze, nie wolno ich zmieniać. ★★ WYJĄTEK JAWNIE LICENCJONOWANY: ten dyżur **tworzy NOWY** bezpiecznik `scripts/dev/g19-waznosc-dowodu.mjs` wraz z testem w `tests/` — to jest produkt `R1`, nie zmiana bramki zastanej. ★ Bramka, która przechodzi, bo nie mogła nic zmierzyć, nie jest wynikiem: każde wywołanie zapisujesz z kodem wyjścia ORAZ z liczbą zbadanych obiektów (dla nowego bezpiecznika — liczbą zbadanych wierszy `G19`, ma wynosić `16`)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY360_G19_KUBELEK_A_REPORT.md`. Jedyne inne dokumenty do zmiany: **(a)** wiersze `G19` w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/{01_ORGANIZATION,04_ASSESSMENT,05_INITIATIVES,06_EXECUTION,08_MEETINGS,11_MATERIALS,13_CHAT}/MODULE_ACCEPTANCE.md` — **WYŁĄCZNIE kolumna `G19`, WYŁĄCZNIE w tych siedmiu modułach**, wyłącznie commitem, który w tym samym `git show --stat` niesie plik dowodowy. **Dziewięć modułów kubełka `C` (`02`, `03`, `07`, `09`, `10`, `12`, `14`, `15`, `16`) jest przedmiotem RÓWNOLEGŁEGO dyżuru 361 — nie dotykasz ich ANI RAZU.** `G15`, `G16`, `G18`, `G20` — nietykalne w każdym module (`G15` to dyżur 362, `G20` to dyżur 359). **(b)** **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` — Twoja litera to **`AB`**; literę sprawdzasz komendą `bash -c "grep -nE '^## [A-Z]+[.]' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -5"` TUŻ PRZED commitem (dziś sekcje idą do `Z`, litera `V` jest wolna, ale zarezerwowana — nie zajmuj jej; jeżeli `AB` jest zajęta, bierzesz pierwszą wolną i zapisujesz to w raporcie). ★★ WSZYSTKIE dowody idą do `evidence/g19/day360/` (katalog NIE ISTNIEJE na markerze — tworzysz go) z `git add -f`; ta instrukcja daje na to jawną licencję. Nowe kontrakty testowe idą do `tests/`, **NIGDY pod `src/`**, też z `git add -f`. Plik postępu `/private/tmp/cx-day360-postep.md` żyje POZA repo. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day360-g19-kubelek-a-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day360-g19-kubelek-a-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje `railway` CLI, `psql`/`docker exec psql` do hosta innego niż `127.0.0.1`, `curl`/`wget`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | Produkcja NIETYKALNA; demo i staging są jedną bazą. **To jedyny zakaz, którego naruszenie zatrzymuje CAŁY dyżur** |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0` w KAŻDEJ komendzie** i `retry: 0` w opcjach `describe`/`it`, jeśli plik je ustawia | **Historycznie** `vitest.config.ts` ustawiał `retry: CI ? 3 : 1` i to unieważniało całą rodzinę testów izolacji: przy otwartej dziurze pierwszy przebieg realnie zmieniał stan, asercja padała, Vitest ponawiał — i test **raportował `PASS` mimo otwartej dziury** (dowód: `tests/integration/_retrymask/`, archetyp dyżuru 42). **Stan na 04.09: `vitest.config.ts:339` ustawia `retry: 0`, a `server/vitest.config.ts` nie ustawia `retry` wcale.** Zakaz zostaje w mocy — dotyczy `--retry=N` w CLI i `retry` w opcjach `describe`/`it` — ale **nie szukaj tu przyczyny niestabilności**: ponowień w konfiguracji już nie ma |
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
| `Z40` | ★★★ **ZAKAZ TRZECIEGO (a właściwie CZWARTEGO) LICZENIA DRYFU.** Dyżury 335, 348 i 353 policzyły go zgodnie (104 → 106 plików, 90 bez testów) i kubełki są ustalone (`A=7`, `B=0`, `C=9`). Dyżur, którego głównym produktem jest kolejna tabela dryfu, jest dyżurem nieodebranym. ★★★ **ZAKAZ BUDOWANIA WZORCA DOWODU DRUGI RAZ.** Para `day307` została wykonana i orzeczona (`evidence/g19/day353/r2-day307-orzeczenie.md`: obcy `404`/64 B, właściciel `200`/243 B, mutacja → dokładnie `200` zamiast `404`). Odtwarzasz ją na swojej bazie jako **kalibrację przyrządu**, nie jako produkt. ★★★ **`TECHNICAL_REGRESSION_PASS` BYŁ ODRZUCONY DWA RAZY I NIE WOLNO GO WPROWADZIĆ POD ŻADNĄ NAZWĄ** — zakaz obejmuje `MACHINE_PASS`, `TECHNICAL_PASS`, `REGRESSION_TECHNICAL_OK`, `PASS_MASZYNOWY`, `PASS (zakres techniczny)` i każde inne sformułowanie, którego skutkiem jest wiersz brzmiący jak zaliczenie **bez nazwania mianownika**. ★ Samo słowo `PASS` jest dopuszczone **wyłącznie** w kształcie wymuszonym przez `DEC-392` i `R5` tej instrukcji (pięć obowiązkowych pól). ★★★ **WIERSZ MACIERZY ZMIENIA STAN WYŁĄCZNIE Z DOWODEM ZAŁĄCZONYM W TYM SAMYM COMMICIE** — `git show --stat` musi zawierać plik z `evidence/g19/day360/**` albo plik testu; commit bez dowodu cofasz przez `git reset --soft HEAD~1`. **Wpis bez dowodu = odrzucenie całego dyżuru.** ★★★ **ZAKAZ NAPRAWIANIA MIANOWNIKA PRZEZ NADPISANIE LICZBY.** Macierz mówi `49`, dryf mówi `106`. `DEC-392` rozstrzyga **regułę ważności**, nie mianownik. Jeżeli po Twoim pomiarze mianownik nadal się nie zgadza — **to jest osobne pytanie do właściciela**, sformułowane rozstrzygalnie, nie liczba do podmiany. ★★ **ZAKAZ ODTWARZANIA LICZBY `615`** — trzy jawne warianty dają `1216`/`1015`/`315`; to jest zamknięte, nie wracasz do tego. ★★ **ZAKAZ DOTYKANIA DZIEWIĘCIU WIERSZY KUBEŁKA `C`** — idą równolegle w dyżurze 361. ★★ **ZAKAZ ZMIANY JAKIEGOKOLWIEK PLIKU W `src/` I `server/src/`** poza mutacjami TYMCZASOWYMI (po `cp` do `SCRATCH`, przywracanymi przez `cp`, **nigdy `git stash`** — `Z27`), z **pustym `git diff` na końcu każdej mutacji**. ★★ **ZAKAZ ZMIANY ŹRÓDŁA TESTU `day307` W REPO** — seeder jest fail-closed na historyczne `6314`/`cx307`; kopiujesz go POZA repo i zmieniasz WYŁĄCZNIE guard. ★★ **ZAKAZ POŁĄCZENIA DO STAGINGU, DEMO I PRODUKCJI W KAŻDĄ STRONĘ** (`Z28`). ★ **ZAKAZ `pkill`/`killall`, `git stash`, `git push` poza własną gałęzią, `git fetch --all` oraz scalania czegokolwiek** | Bo `G19` przez trzy dyżury nie mogła się domknąć **z konstrukcji**: bramka o „późniejszych zmianach” mierzyła dryf od zamrożonego punktu, więc każdy dowód starzał się przy następnym scaleniu. Dyżur 353 nazwał to wprost i postawił pytanie; właściciel oddał decyzję CTO, i 04.09 zapadła **`DEC-392`** — kotwica ruchoma, dowód ważny na dzień odbioru, wpis z datą i SHA, wygaśnięcie po siedmiu dniach do `PASS_STALE`. ★ To **nie obniża progu**: wiersz nadal zmienia stan wyłącznie z dowodem w tym samym commicie, a `TECHNICAL_REGRESSION_PASS` pozostaje odrzucony. Zmienia się punkt odniesienia, nie wymóg dowodu. ★ Ale sama decyzja nie zamyka ani jednego wiersza — dopóki nie ma **maszyny**, która policzy wiek dowodu, `PASS_STALE` jest zdaniem w rejestrze, a nie stanem. Dlatego ten dyżur robi dwie rzeczy w tej kolejności: **najpierw buduje bezpiecznik ważności** (z dowodem mutacyjnym celującym w termin, nie w mechanizm odczytu), **potem składa siedem dowodów**. ★ Siedem, a nie szesnaście, bo tyle jest dowodliwych maszynowo; dziewięć pozostałych wymaga innego rodzaju rozstrzygnięcia i idzie osobnym dyżurem 361 |

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
cd /private/tmp/cx-day360-g19-kubelek-a

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day360-pg psql -U postgres -d cx360 \
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
cd /private/tmp/cx-day360-g19-kubelek-a

docker run -d --name cx-day360-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx360 \
  -p 127.0.0.1:6431:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day360-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6431/cx360 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6431/cx360 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day360-g19-kubelek-a && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6431/cx360 \
JWT_SECRET=cx360-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Przeloty serwerowe na REALNYM PostgreSQL (kontener `cx-day360-pg`, port `6431`, baza `cx360`, obraz `pgvector/pgvector:pg16` — `postgres:15` **nie przechodzi migracji**): wariant (B) z cwd `server/`, `RUN_DB_TESTS=1`. Migracje **dwoma przebiegami na bazie OD ZERA**; drugi ma dać `Applying migrations: 0` — jeden zielony przebieg nie wyklucza migracji, która czyta kolumnę dodawaną później alfabetycznie. ★★ PUŁAPKA, KTÓRA JUŻ RAZ ZADZIAŁAŁA: `NODE_ENV=test` **bez** `RUN_DB_TESTS=1` podstawia atrapę bazy pod `DbPromise` — `pg.Pool` widzi wiersz, kod produkcyjny nie. Atrapa dodatkowo zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE` (`server/src/database/Database.ts:686`), więc dowód zapisu warunkowego na atrapie jest bezwartościowy. ★★ PUŁAPKA RÓWNOLEGŁOŚCI, ZAMKNIĘTA 04.09: wiele forków Vitest wołało `initDb()` na jednej bazie i PostgreSQL zwracał `42701` / `23505`; naprawa (advisory lock) siedzi w `server/src/database/PostgresDatabase.ts:1570-1573,3880-3883`. Jeżeli mimo to zobaczysz te kody — **to jest znalezisko, nie powód do `--retry`**. **Każdy przelot z `--retry=0` i `--reporter=json --outputFile=<plik w ARTEFAKTY>`; podajesz `numTotalTests` dla każdego. Przelot z zerem wykonanych przypadków kończy się `exit 0` i NIE JEST POMIAREM. `No test files found` oraz `Transform failed` to BŁĄD KOMENDY, nie `PASS`.** ★ Porównania przelotów robisz po **NAZWACH przypadków** (`fullName`), nigdy po samych liczbach — 04.09 dwa różne zestawy nazw dały tę samą trójkę liczb. Nowe kontrakty tego dyżuru kładziesz w `tests/`, NIGDY pod `src/`, z `git add -f`; po każdym dodaniu pliku sprawdzasz `node scripts/dev/reachability-from-root.mjs --check-baseline` (`exit 0`) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day360-g19-kubelek-a-artefakty/day360-g19-kubelek-a.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day360-g19-kubelek-a && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Przeloty serwerowe na REALNYM PostgreSQL (kontener `cx-day360-pg`, port `6431`, baza `cx360`, obraz `pgvector/pgvector:pg16` — `postgres:15` **nie przechodzi migracji**): wariant (B) z cwd `server/`, `RUN_DB_TESTS=1`. Migracje **dwoma przebiegami na bazie OD ZERA**; drugi ma dać `Applying migrations: 0` — jeden zielony przebieg nie wyklucza migracji, która czyta kolumnę dodawaną później alfabetycznie. ★★ PUŁAPKA, KTÓRA JUŻ RAZ ZADZIAŁAŁA: `NODE_ENV=test` **bez** `RUN_DB_TESTS=1` podstawia atrapę bazy pod `DbPromise` — `pg.Pool` widzi wiersz, kod produkcyjny nie. Atrapa dodatkowo zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE` (`server/src/database/Database.ts:686`), więc dowód zapisu warunkowego na atrapie jest bezwartościowy. ★★ PUŁAPKA RÓWNOLEGŁOŚCI, ZAMKNIĘTA 04.09: wiele forków Vitest wołało `initDb()` na jednej bazie i PostgreSQL zwracał `42701` / `23505`; naprawa (advisory lock) siedzi w `server/src/database/PostgresDatabase.ts:1570-1573,3880-3883`. Jeżeli mimo to zobaczysz te kody — **to jest znalezisko, nie powód do `--retry`**. **Każdy przelot z `--retry=0` i `--reporter=json --outputFile=<plik w ARTEFAKTY>`; podajesz `numTotalTests` dla każdego. Przelot z zerem wykonanych przypadków kończy się `exit 0` i NIE JEST POMIAREM. `No test files found` oraz `Transform failed` to BŁĄD KOMENDY, nie `PASS`.** ★ Porównania przelotów robisz po **NAZWACH przypadków** (`fullName`), nigdy po samych liczbach — 04.09 dwa różne zestawy nazw dały tę samą trójkę liczb. Nowe kontrakty tego dyżuru kładziesz w `tests/`, NIGDY pod `src/`, z `git add -f`; po każdym dodaniu pliku sprawdzasz `node scripts/dev/reachability-from-root.mjs --check-baseline` (`exit 0`) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day360-g19-kubelek-a-artefakty/day360-g19-kubelek-a.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day360-g19-kubelek-a/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day360-pg psql -U postgres -d cx360 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day360-pg`.
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
> **(e) ★★★ **SIEDEM PUŁAPEK TEGO DYŻURU.** **(1) Symetryczna odmowa nie jest dowodem izolacji.** Para `404`/`404` to kształt „zamknięte przez wygaszenie”: funkcja wyłączona dla wszystkich, bramka zielona, produkt martwy — wystąpił 3× jednego dnia. Wymagana jest **para**: obcy `404` **i** właściciel `200` **z niepustym ciałem** (zapisz długość odpowiedzi), na **tym samym identyfikatorze obiektu**. ★★ Dla `08_MEETINGS` ta pułapka jest wpisana wprost w kod: komentarz przy `GET /:id` (`server/src/routes/meeting.routes.ts:333-343`) mówi, że trasa **celowo zwija „nie znaleziono” i „brak dostępu” do tego samego `404`** — więc `404`/`404` dostaniesz tam za darmo i bez znaczenia. **(2) Test scenariusza nie broni zabezpieczenia.** 3 z 4 dyżurów miały zielone testy PO skasowaniu zabezpieczenia. Mutacja musi celować w to, co **odróżnia obcego od właściciela**, nie w walidację kształtu, mapowanie błędu czy kolejność pól. Jeżeli test czerwienieje z **innego** powodu niż brak izolacji — mutacja chybiła i przecelowujesz ją. ★ Dla `08` są DWA kandydaty na strażnika (filtr `organization_id` w `meetingService.ts:285` i `canAccessMeeting` w `meeting.routes.ts:150`) — **zmutuj każdy osobno** i napisz, który naprawdę broni. **(3) Testy bezpieczeństwa leczą się skutkiem własnego ataku** — każde „izolacja X/X PASS” jest podejrzane, dopóki nie pokażesz, że retry jest wyłączone (`--retry=0`) i że test nie sprząta danych, które sam miał znaleźć. **(4) Seeder `day307` jest fail-closed na `6314`/`cx307`** — uruchomiony bez zmiany guardu **nie zasieje nic** i da fałszywe `404`/`404`. Kopiujesz go POZA repo, zmieniasz WYŁĄCZNIE guard, źródła w repo nie dotykasz. **(5) Migracja przyrostowa nie jest dowodem** — wymagane są DWA przebiegi na bazie od zera; drugi ma dać `Applying migrations: 0`. **(6) Bezpiecznik, który nie mógł nic zmierzyć, nie jest wynikiem** — bramka przechodzi, gdy wejście jest puste, gdy nikt nie poprosił o pomiar albo gdy ginie na ścieżce macOS przed pierwszym pomiarem. Twój NOWY bezpiecznik ważności musi mieć **podłogę liczebności**: jeżeli zbadał mniej niż `16` wierszy `G19`, kończy się błędem, nie sukcesem. **(7) Bezpiecznik nagradza defekt.** Reguła „7 dni” ma jedną wredną własność: im mniej pól wpisu, tym trudniej stwierdzić, że wygasł. Wpis bez daty **musi blokować** (`BRAK_DATY_POMIARU`), nigdy przechodzić po cichu — dokładnie tak, jak `SHA_BRAK_DATY_ZGLOSZENIA` w liczniku P0/P1**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day360-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day360-g19-kubelek-a-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (trzy twarde zasady — czytasz) · R1 (**reguła `DEC-392` zaimplementowana maszynowo**: `scripts/dev/g19-waznosc-dowodu.mjs` + test w `tests/` + dowód mutacyjny celujący w termin ważności) · R2 (kalibracja przyrządu: odtworzenie pary `day307` na własnej bazie + podniesienie wiersza `01_ORGANIZATION`) · R3 (`08_MEETINGS` — własna para na `GET /api/meetings/:id`, dwaj kandydaci na strażnika, mutacja każdego osobno) · R4 (pięć modułów `04`, `05`, `06`, `11`, `13` — **commit po KAŻDYM module**) · R5 (podniesienie wierszy: pięć obowiązkowych pól, dwie zgodne liczby) · R6 (raport i jedna sekcja rejestru). **Commit po KAŻDEJ pozycji `R`, a w `R4` po każdym module z osobna**; pozycja bez commita jest pozycją niewykonaną`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6431` albo `5571` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6431` albo `5571`** (`Z7`).

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

Bramka `G19` („Later-change regression obligations resolved") stoi na
`NOT_PROVEN / OWNER_RETEST_PENDING` we **wszystkich szesnastu** modułach. Podchodziły do niej
trzy dyżury: **335** („zero wierszy podniesionych, i to jest wynik"), **348** (zatrzymany
w połowie) i **353** (złożył jeden dowód, orzekł per wiersz i **postawił pytanie o kotwicę**).

Pytanie brzmiało: *na czym ma stać dowód `G19`, skoro mianownik rośnie z każdą naszą pracą?*
Właściciel oddał decyzję CTO. **04.09 zapadła `DEC-392`** i jest zapisana w repo, w sekcji `R`
pliku `docs/program/REJESTR_ZNALEZISK_20260903.md`:

> **Kotwica `G19` jest RUCHOMA.** Wiersz przechodzi na podstawie pomiaru wykonanego na
> **markerze odbioru**, a nie na historycznym punkcie. Wpis niesie **datę i SHA pomiaru**.
> Po **7 dniach** wiersz sam wygasa do **`PASS_STALE`** i wymaga powtórzenia.
>
> **Czego ta decyzja NIE robi:** nie obniża progu i nie zamyka ani jednego wiersza z góry.
> Wiersz nadal zmienia stan **wyłącznie z dowodem załączonym w tym samym commicie**,
> a `TECHNICAL_REGRESSION_PASS` pozostaje odrzucony.

★★★ **Decyzja bez maszyny jest zdaniem w rejestrze, nie regułą.** Dopóki nikt nie policzy wieku
dowodu, `PASS_STALE` nigdy się nie pojawi — a wtedy `DEC-392` daje dokładnie to, przed czym
sama ostrzega: wiersz, który wygląda na zamknięty i nie woła o siebie. **Dlatego `R1` tego
dyżuru buduje bezpiecznik ważności, i dopiero po nim wolno Ci podnieść pierwszy wiersz.**

**Zakres roboczy: siedem modułów kubełka `A`** — `01_ORGANIZATION`, `04_ASSESSMENT`,
`05_INITIATIVES`, `06_EXECUTION`, `08_MEETINGS`, `11_MATERIALS`, `13_CHAT`.
Dziewięć modułów kubełka `C` idzie **równolegle** dyżurem 361 i **nie dotykasz ich ani razu**.

---

## ★ Co jest ZROBIONE i ZWERYFIKOWANE — NIE POWTARZASZ

| Pozycja | Stan | Wynik, który dziedziczysz |
| --- | --- | --- |
| Przemiar dryfu | **ZROBIONY** (dyżury 335, 348, 353) | **106 plików** na ścieżkach mierzonych przez `G19`, **90 bez testów**. ★★★ **CZWARTE liczenie jest zakazane** |
| Kubełki `A`/`B`/`C` | **ZROBIONE** (`evidence/g19/day353/r4-orzeczenie.md`) | `A = 01, 04, 05, 06, 08, 11, 13` (**7**) · `B = 0` · `C = 02, 03, 07, 09, 10, 12, 14, 15, 16` (**9**) |
| Wzorzec dowodu (`day307`) | **WYKONANY I ORZECZONY** | obcy `404` / 64 B, właściciel `200` / 243 B na tym samym `userId`; usunięcie filtra organizacji daje **dokładnie `200` zamiast `404`**; `git diff` po przywróceniu pusty. Ślad: `evidence/g19/day353/r2-day307-orzeczenie.md` |
| Orzeczenie: czy `day307` zamyka `08_MEETINGS` | **ORZECZONE: NIE** | `R2` dyżuru 353 wykazał, że `day307` **nie wykonuje trasy Meetings**; `08` potrzebuje własnej pary |
| Pięć czerwonych briefów | **W REPO** | `tests/unit/day353-g19-{04-assessment,05-initiatives,06-execution,11-materials,13-chat}.contract.test.ts` — **czerwone z założenia**, opisują czego brakuje |
| Pytanie o kotwicę | **ZADANE I ROZSTRZYGNIĘTE** | `DEC-392`, sekcja `R` rejestru znalezisk |
| Liczba `615` | **ZAMKNIĘTA JAKO NIEODTWARZALNA** | trzy jawne warianty dają `1216` / `1015` / `315`; **nie wracasz do tego** |

---

## ★★ SPROSTOWANIE ZLECENIA — co mój pomiar potwierdził, a czego nie

Sprawdziłem każdą tezę zlecenia na markerze `2a7273e087` w `/private/tmp/m03`.

**POTWIERDZONE:**

| Teza | Mój pomiar |
| --- | --- |
| `G19`: 16 × `NOT_PROVEN / OWNER_RETEST_PENDING` | **potwierdzone** |
| kubełki `A=7` / `B=0` / `C=9` | **potwierdzone** z `evidence/g19/day353/r4-orzeczenie.md` — i **znam imiona**: `A` = `01`, `04`, `05`, `06`, `08`, `11`, `13` |
| dryf `106` plików, `90` bez testów | **potwierdzone** |
| dystans od kotwicy `316bce9dd9` daje `1216` / `1015` / `315`, żaden nie daje `615` | **potwierdzone** |
| macierz wpisuje mianownik `49`, dryf mierzy `106` | **potwierdzone** |
| `DEC-392` istnieje w repo, sekcja `R` | **potwierdzone** — z pełnym uzasadnieniem i akapitem „Czego ta decyzja NIE robi" |
| wzorzec dowodu: `day307-crossorg-read-flight.pg.test.ts`, przypadek `denies foreign workload lookup…` | **potwierdzone** — wiersz `214` pliku |
| cel mutacji: `TaskController.getUserWorkload` | **potwierdzone** — definicja `2681`, wywołania serwisu `2703` i `2725` |
| artefakty `evidence/g19/day348-artefakty/` i `day353-artefakty/` | **potwierdzone** — ★ **oraz** `evidence/g19/day353/` (siedem plików: `r1`…`r5` + dwa logi migracji), o którym zlecenie nie wspomniało, a to w nim leży orzeczenie per wiersz |
| liście słowników `pl 35199` / `en 33066` | **potwierdzone** |

**DOPRECYZOWANE PRZEZ MÓJ POMIAR — czego zlecenie nie powiedziało:**

- ★★★ **Trasa i cele mutacji dla `08_MEETINGS` są ustalone, nie hipotetyczne.**
  `GET /api/meetings/:id` → `server/src/routes/meeting.routes.ts:345`. Strażnicy: filtr
  `organization_id = ?` w `getMeeting` (`server/src/services/meetingService.ts:285`, dosłownie
  `SELECT * FROM meetings WHERE id = ? AND organization_id = ? LIMIT 1`) **oraz** `canAccessMeeting`
  (`server/src/routes/meeting.routes.ts:150`). **Mutujesz każdy osobno.**
- ★★★ **Ta trasa zwija „nie znaleziono" i „brak dostępu" do tego samego `404` — i ma to
  napisane w komentarzu** (`meeting.routes.ts:333-343`). Czyli symetryczną odmowę dostaniesz
  tam **za darmo i bez znaczenia**. To jest dokładnie kształt „zamknięte przez wygaszenie"
  wbudowany w projekt trasy. **Bez `200` właściciela z niepustym ciałem nie masz dowodu.**
- ★ **Pięć czerwonych briefów dyżuru 353 istnieje w `tests/unit/`** — nie musisz zgadywać,
  czego brakuje w `04`, `05`, `06`, `11`, `13`. Przeczytaj je, zanim ustalisz trasy.
- ★ **`13_CHAT` ma w `G15` stan `PASS`, a w `G19` `NOT_PROVEN`** — to nie jest sprzeczność
  (inne bramki mierzą co innego), ale to jest moduł, który da się dziś zamknąć najtaniej,
  bo ma najmniej długu pomiarowego. Nie znaczy to, że wolno mu obniżyć próg.

★ **Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

---

## B.1. TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ

★ Licencja obejmuje **całą ścieżkę**, żebyś nie musiał wybierać między złamaniem licencji
a zrobieniem połowy roboty.

| Warstwa | Ścieżka | Licencja | Produkt |
| --- | --- | --- | --- |
| **bezpiecznik ważności (NOWY)** | `scripts/dev/g19-waznosc-dowodu.mjs` | **★ ZAPIS — to jest produkt `R1`.** Plik **NIE ISTNIEJE** na markerze | skrypt + kod wyjścia + liczba zbadanych wierszy |
| **test bezpiecznika (NOWY)** | `tests/unit/g19-waznosc-dowodu.test.mjs` (**NIGDY pod `src/`**) | **★ ZAPIS**, `git add -f` | test + dowód mutacyjny w obie strony |
| **macierz odbioru — SIEDEM modułów** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/{01_ORGANIZATION,04_ASSESSMENT,05_INITIATIVES,06_EXECUTION,08_MEETINGS,11_MATERIALS,13_CHAT}/MODULE_ACCEPTANCE.md` | **★ WĄSKA — WYŁĄCZNIE wiersz `G19`**, wyłącznie w tych siedmiu, wyłącznie commitem, który w tym samym `git show --stat` niesie plik dowodowy | zmieniony wiersz + dowód |
| **macierz — DZIEWIĘĆ modułów `C`** | `modules/{02,03,07,09,10,12,14,15,16}_*/MODULE_ACCEPTANCE.md` | **★ ZAKAZ ZAPISU** — równoległy dyżur 361 | brak zmian |
| **testy izolacyjne (odczyt + uruchomienie)** | `server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts` | odczyt i uruchomienie; **modyfikacja WYŁĄCZNIE w kopii poza repo** (seeder fail-closed na `6314`/`cx307`) | para `404`/`200` z logiem i długością ciała |
| **cel mutacji `01`** | `server/src/controllers/TaskController.ts` (`getUserWorkload`, `2681`–`2730`) | **mutacja TYMCZASOWA** po `cp` do `SCRATCH`; przywrócenie przez `cp`, **nigdy `git stash`** (`Z27`) | `GREEN`→`RED`→`GREEN` + pusty `git diff` |
| **cel mutacji `08` — kandydat 1** | `server/src/services/meetingService.ts:285` (filtr `organization_id = ?` w `getMeeting`) | **mutacja TYMCZASOWA** j.w. | wynik mutacji + zdanie „to jest / nie jest strażnik" |
| **cel mutacji `08` — kandydat 2** | `server/src/routes/meeting.routes.ts:150` (`canAccessMeeting`) | **mutacja TYMCZASOWA** j.w. | wynik mutacji + zdanie |
| **serwisy pozostałych modułów `A`** | `server/src/services/**`, `server/src/controllers/**`, `server/src/routes/**` dla `04`, `05`, `06`, `11`, `13` | **odczyt + uruchomienie + mutacja TYMCZASOWA** po `cp`; ustalasz strażnika i zapisujesz go zdaniem `plik:linia` | zdanie „zabezpieczenie stoi w `plik:linia`" + mutacja |
| **czerwone briefy 353** | `tests/unit/day353-g19-{04,05,06,11,13}*.contract.test.ts` | **odczyt; ZAPIS dozwolony wyłącznie po to, żeby brief zamienić w działający kontrakt** — a jeżeli to robisz, usuwasz z niego nagłówek „CZERWONY Z ZAŁOŻENIA" i **piszesz w raporcie, że brief przestał być briefem** | kontrakt zielony z mutacją |
| **nowe kontrakty testowe** | `tests/**` (★ **NIGDY pod `src/`**) | **zapis**, `git add -f` | plik kontraktu + wynik |
| **dowody** | `evidence/g19/day360/**` (**NOWY** katalog) | **zapis, `git add -f`** — jawna licencja na logi i `*.json`; „zakaz binariów w repo" byłby wymyślonym powodem | wszystkie `*.json`, `*.log`, `*.md` przelotów |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY360_G19_KUBELEK_A_REPORT.md` | **zapis (główny produkt)** | raport |
| **rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **★ WĄSKA — WYŁĄCZNIE dopisanie JEDNEJ nowej sekcji, litera `AB`**. Zakaz kasowania i przeredagowywania sekcji zastanych, zakaz zajmowania litery `V` | jedna sekcja |
| **kod produktu (poza mutacjami)** | `src/**`, `server/src/**` | **★ ZAKAZ ZAPISU.** Znaleziony defekt idzie do raportu jako `plik:linia` + **diff nienałożony** | wpis w raporcie |
| **bramki i harness zastane** | `scripts/check-*.sh`, `scripts/dev/reachability-from-root.mjs`, `scripts/dev/p0p1-licznik-e1.mjs`, `tests/setup.ts`, `tests/helpers/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **NIETYKALNE DO ZAPISU** — wolno wołać w pomiarze | wyniki `0` |

---

## B.2. TABELA POZYCJI

| Poz. | Co robi | Rdzeń? | Wykonalne bez pliku przekrojowego? | Commit |
| --- | --- | --- | --- | --- |
| `R0` | trzy twarde zasady — czytasz | — | — | — |
| `R1` | **bezpiecznik ważności `DEC-392`**: skrypt + test + dowód mutacyjny | TAK | TAK — nowy plik, zero zależności | **TAK** |
| `R2` | kalibracja przyrządu (`day307`) + wiersz `01_ORGANIZATION` | TAK | TAK — mutacja w ciele jednej funkcji kontrolera | **TAK** |
| `R3` | `08_MEETINGS` — własna para + dwaj kandydaci na strażnika | TAK | TAK — jedna trasa, dwa punkty mutacji | **TAK** |
| `R4` | `04`, `05`, `06`, `11`, `13` | TAK | TAK — każdy moduł ma własną trasę i własny brief | **TAK ×5** |
| `R5` | podniesienie wierszy: pięć pól, dwie zgodne liczby | TAK | TAK | **TAK** |
| `R6` | raport i jedna sekcja rejestru | — | TAK | **TAK** |

★ **Commit po KAŻDEJ pozycji `R`, a w `R4` po każdym module.** Pozycja bez commita jest
pozycją niewykonaną.

---

## B.3. TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | wiersze `G19` na `NOT_PROVEN` | `16` | `(5)` | TAK |
| 2 | moduły kubełka `A` | `7` (`01`,`04`,`05`,`06`,`08`,`11`,`13`) | `(2)` — `r4-orzeczenie.md` | TAK |
| 3 | moduły kubełka `C` — **nie dotykasz** | `9` | `(2)` | TAK |
| 4 | pliki dryfu `G19` | `106` | `(3)` | TAK — **nie liczysz po raz czwarty** |
| 5 | pliki dryfu bez testów | `90` | `(3)` | TAK |
| 6 | mianownik wpisany w macierz | `49` | `(4)` | TAK — ★ **nie zgadza się z `106`; to OSOBNE pytanie, nie liczba do podmiany** |
| 7 | dystans od kotwicy | `1216` / `1015` / `315` | `(4)` | TAK — ★ `615` **zamknięte jako nieodtwarzalne** |
| 8 | czerwone briefy w `tests/unit/` | `5` | `(6)` | TAK |
| 9 | wierszy `G19` zbadanych przez NOWY bezpiecznik | `16` | `R1` | TAK — **podłoga liczebności; mniej = błąd, nie sukces** |
| 10 | wierszy podniesionych / dowodów załączonych | — | `R5`, dwa liczniki | TAK — **muszą być równe** |
| 11 | liście słowników i cztery bramki | `35199` / `33066`, cztery `0` | `(8)` | TAK — identyczne przed i po |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| Plik | Pozycja | Zakres |
| --- | --- | --- |
| `scripts/dev/g19-waznosc-dowodu.mjs` | `R1` | **NOWY** bezpiecznik |
| `tests/unit/g19-waznosc-dowodu.test.mjs` | `R1` | **NOWY** test, `git add -f` |
| `evidence/g19/day360/**` | `R1`–`R5` | **NOWY** katalog |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY360_G19_KUBELEK_A_REPORT.md` | `R6` | główny produkt |
| `docs/program/REJESTR_ZNALEZISK_20260903.md` | `R6` | jedna nowa sekcja, litera `AB` |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Warunek | Zakres |
| --- | --- | --- |
| `modules/{01,04,05,06,08,11,13}_*/MODULE_ACCEPTANCE.md` | gdy `R2`–`R4` dadzą dowód | **wyłącznie wiersz `G19`** |
| `tests/unit/day353-g19-*.contract.test.ts` | gdy brief zamieniasz w działający kontrakt | usuwasz nagłówek „CZERWONY Z ZAŁOŻENIA" i piszesz o tym w raporcie |
| `tests/**` (nowe kontrakty) | gdy moduł `A` nie ma testu zamykającego lukę | nowy kontrakt + `git add -f` |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

`src/**` · `server/src/**` (poza mutacjami tymczasowymi, przywracanymi przez `cp`) ·
`public/locales/**` · **dziewięć plików `MODULE_ACCEPTANCE.md` kubełka `C`** ·
żaden wiersz macierzy poza `G19` · `scripts/check-*.sh` ·
`scripts/dev/p0p1-licznik-e1.mjs` · `.github/workflows/**` · `docs/ui-standards/**` ·
żaden plik dyżurów 359, 361, 362 ani 363–366.

★ Plik postępu `/private/tmp/cx-day360-postep.md` żyje **poza repo**.

### B.4.4. Zasoby wyłączne

Baza **6431**, runtime **5571**, kontener **`cx-day360-pg`**, baza **`cx360`**,
worktree `/private/tmp/cx-day360-g19-kubelek-a`, gałąź `codex/day360-g19-kubelek-a-20260904`.
Sprawdziłem 04.09: oba porty wolne, kontener nie istnieje, worktree nie istnieje,
gałąź nie istnieje.

★★ **Port zajęty = STOP CAŁOŚCI (`Z7`), NIGDY podmiana numeru.**

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
git status --short                  # zero plikow spoza tabeli B.4.1/B.4.2
git diff --cached --stat            # ★ commit dotykajacy macierzy MUSI zawierac plik dowodowy
git diff -- server/src/ src/        # PUSTY (wszystkie mutacje przywrocone)
bash -c "git diff --cached --name-only | grep -E 'modules/(02|03|07|09|10|12|14|15|16)_' && echo 'STOP: kubelek C' || echo 'kubelek C nietkniety'"
bash -c "grep -rnE '^(<{7}|>{7}|={7})' \$(git diff --cached --name-only)"   # zero znacznikow konfliktu
node scripts/dev/g19-waznosc-dowodu.mjs; echo "waznosc_exit=$?"
```

### B.4.6. ★★ ROZŁĄCZNOŚĆ Z DYŻURAMI RÓWNOLEGŁYMI — czytaj, zanim dotkniesz macierzy

Cztery dyżury tej paczki dotykają **tych samych plików** `MODULE_ACCEPTANCE.md`, ale
**rozłącznych kolumn i modułów**:

| Dyżur | Kolumna | Moduły |
| --- | --- | --- |
| 359 | `G20` | wszystkie 16 |
| **360 (Ty)** | **`G19`** | **`01`, `04`, `05`, `06`, `08`, `11`, `13`** |
| 361 | `G19` | `02`, `03`, `07`, `09`, `10`, `12`, `14`, `15`, `16` |
| 362 | `G15` | `04`, `09`, `12`, `15` |

★ **Konflikt scalenia rozstrzyga nadzorca.** Nie próbujesz go uprzedzić, nie scalasz cudzej
gałęzi, nie „porządkujesz" cudzej kolumny i nie poprawiasz cudzego wiersza, nawet jeżeli
uważasz, że jest zły — **to jest znalezisko do raportu, nie do edytora**.

---

## R0 — TRZY TWARDE ZASADY (przeczytaj, zanim cokolwiek zrobisz)

**ZASADA 1 — wiersz macierzy zmienia stan WYŁĄCZNIE z dowodem załączonym w TYM SAMYM
commicie.** `git show --stat <commit dotykający macierzy>` musi zawierać plik z
`evidence/g19/day360/**` albo plik testu. Commit bez dowodu **cofasz przez
`git reset --soft HEAD~1`**. **Wpis bez dowodu = odrzucenie całego dyżuru.**

**ZASADA 2 — `TECHNICAL_REGRESSION_PASS` był odrzucony DWA RAZY i nie wolno go wprowadzić
pod żadną nazwą.** Zakaz obejmuje `MACHINE_PASS`, `TECHNICAL_PASS`, `REGRESSION_TECHNICAL_OK`,
`PASS_MASZYNOWY`, `PASS (zakres techniczny)` i każdy inny kształt brzmiący jak zaliczenie
**bez nazwania mianownika**. ★ `DEC-392` dopuszcza słowo `PASS`, ale **wyłącznie** w kształcie
z pięcioma polami z `R5`. `PASS` bez daty, bez SHA i bez mianownika jest tym samym fałszem
pod inną nazwą.

**ZASADA 3 — nie wolno „naprawiać" bramki przez nadpisanie mianownika ani zawężenie
kryterium.** Macierz mówi `49`, dryf mówi `106`. `DEC-392` rozstrzyga **regułę ważności**, nie
mianownik. Jeżeli po Twoim dowodzie mianownik nadal się nie zgadza, **piszesz osobne,
rozstrzygalne pytanie do właściciela** i zostawiasz liczbę w spokoju.

★ **Jeżeli uważasz, że te trzy zasady razem czynią część dyżuru niewykonalną — to jest wynik
i zapisujesz go jako pytanie. Nie obchodzisz ich.**

---

## R1 — BEZPIECZNIK WAŻNOŚCI DOWODU (`DEC-392`) — rdzeń, robisz to PIERWSZE

★★★ **Nie wolno Ci podnieść ani jednego wiersza, dopóki ta pozycja nie ma commita.** Powód:
`DEC-392` opiera się na wygasaniu, a wygasanie, którego nikt nie liczy, nie istnieje.

**Produkt: `scripts/dev/g19-waznosc-dowodu.mjs`** (plik NOWY, nie istnieje na markerze).

Skrypt czyta wiersz `G19` z **każdego z 16** plików
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` i dla każdego orzeka:

| Warunek | Wynik |
| --- | --- |
| stan wiersza nie twierdzi domknięcia (`NOT_PROVEN`, `NOT_STARTED`, …) | `NIE_DOTYCZY` — bez pola daty nie jest to błąd |
| stan twierdzi domknięcie, ale **brak pola daty albo SHA** | **`BRAK_DATY_POMIARU` → BLOKUJE** (`exit 1`) |
| stan twierdzi domknięcie, data starsza niż **7 dni** od dnia migawki | **`PASS_STALE` → BLOKUJE** (`exit 1`) |
| stan twierdzi domknięcie, data w oknie 7 dni, SHA obecny | `WAZNY` |

Wymagania konstrukcyjne, wszystkie obowiązkowe:

1. **Podłoga liczebności.** Jeżeli skrypt zbadał **mniej niż 16** wierszy `G19`, kończy się
   **błędem**, nie sukcesem. „Brak pomiaru nie jest wynikiem" — bramka, która przechodzi, bo
   nic nie znalazła, jest gorsza niż jej brak.
2. **Dzień migawki** ma być parametrem (`--snapshot-date`), domyślnie dzisiejszy — dokładnie
   jak w `scripts/dev/p0p1-licznik-e1.mjs`, żeby wynik dało się odtworzyć.
3. **Wypisuje tabelę** (moduł · stan · data · SHA · orzeczenie) i **kod wyjścia**.
4. **Nie edytuje macierzy.** Miernik nie dotyka mierzonego.
5. Funkcje eksportowane, żeby test mógł je wołać bez `spawn`.

**Test: `tests/unit/g19-waznosc-dowodu.test.mjs`** (`git add -f`), z **dowodem mutacyjnym
celującym w ZABEZPIECZENIE**, nie w mechanizm odczytu:

| Mutacja | Co ma się stać | Dlaczego to celuje w zabezpieczenie |
| --- | --- | --- |
| okno `7` dni → `3650` dni | wiersz z datą sprzed 30 dni **przestaje** być `PASS_STALE` → **test CZERWIENIEJE** | zabezpieczeniem jest **termin ważności** |
| usunięcie warunku „brak daty blokuje" | wiersz twierdzący domknięcie bez daty **przechodzi** → **test CZERWIENIEJE** | zabezpieczeniem jest **wymóg pomiaru** |
| usunięcie podłogi `16` | podanie katalogu z jednym modułem daje `exit 0` → **test CZERWIENIEJE** | zabezpieczeniem jest **kompletność mianownika** |

★★ Jeżeli któraś mutacja **nie** zaczerwienia testu — mutacja chybiła albo zabezpieczenia nie
ma; przecelowujesz ją i **zapisujesz, że pierwsza próba chybiła**. Mutacje robisz po `cp` do
`SCRATCH`, przywracasz przez `cp` (**nigdy `git stash`**, `Z27`), `git diff` po przywróceniu
**pusty**.

★ **Uruchom bezpiecznik na stanie wejściowym.** Dziś wszystkie 16 wierszy to `NOT_PROVEN`,
więc oczekiwany wynik to `16 × NIE_DOTYCZY`, `exit 0`, **zbadanych wierszy: 16**. Zapisz to —
to jest Twoja linia bazowa.

**Wymagany dowód:** skrypt · test · `evidence/g19/day360/r1-waznosc.md` z tabelą trzech mutacji
(nazwa przypadku, wynik przed, wynik po, wynik po przywróceniu) · log uruchomienia na stanie
wejściowym z liczbą `16`. **Commit po `R1`.**

---

## R2 — KALIBRACJA PRZYRZĄDU I WIERSZ `01_ORGANIZATION` (rdzeń)

★★ **Nie budujesz wzorca drugi raz.** Odtwarzasz go na **swojej** bazie, żeby wiedzieć, że
przyrząd działa u Ciebie — i dopiero potem używasz go jako dowodu dla `01`.

1. Kontener `cx-day360-pg`, port `6431`, baza `cx360`, obraz `pgvector/pgvector:pg16`.
   Migracje **dwoma przebiegami na bazie OD ZERA**; drugi ma dać `Applying migrations: 0`.
   Oba logi do `evidence/g19/day360/`.
2. **Kopia seedera poza repo.** `day307` jest fail-closed na historyczne `6314`/`cx307`.
   Kopiujesz plik do `SCRATCH`, zmieniasz **wyłącznie guard** na `6431`/`cx360`, **źródła
   w repo NIE dotykasz**.
3. Przelot pary: obcy **`404`**, właściciel **`200`**, na **tym samym `userId`**, z **zapisaną
   długością ciała odpowiedzi** dla obu. Dyżur 353 zmierzył `64 B` i `243 B` — **Twoje liczby
   mogą się różnić i to jest w porządku**, byle właściciel dostał coś niepustego.
4. **Mutacja celująca w ZABEZPIECZENIE** (`Z32`): usuwasz `AND organization_id = ?` z prechecku
   w `TaskController.getUserWorkload` (`server/src/controllers/TaskController.ts`, `2681`–`2730`),
   po `cp` do `SCRATCH`. Test ma zaczerwienić się komunikatem kształtu
   `expected 200 to be 404`. Przywracasz przez `cp` → zielony; `git diff` **pusty**.
5. **Podnosisz wiersz `G19` modułu `01_ORGANIZATION`** — z pięcioma polami z `R5`, dowodem
   w tym samym commicie.

★★ **Uwaga na mianownik.** `01` ma w macierzy wpisane `Mianownik: 49`, a dryf mierzy `106`.
Twój dowód dotyczy **jednej trasy**. W `R5` zobaczysz, że to determinuje **słowo stanu**:
`PASS` wolno napisać tylko wtedy, gdy pole mianownika w wierszu jest **pokryte** dowodem.
Jeżeli nie jest — stan **nie zawiera słowa `PASS`** i nazywa lukę.

**Wymagany dowód:** dwa logi migracji · para z dwoma kodami i długościami ciała · mutacja
w obie strony z pustym `git diff` · wiersz `01` z pięcioma polami. **Commit po `R2`.**

---

## R3 — `08_MEETINGS`: WŁASNA PARA, DWAJ KANDYDACI NA STRAŻNIKA (rdzeń)

`R2` dyżuru 353 orzekł, że `day307` **nie wykonuje trasy Meetings**, więc `08` potrzebuje
własnej pary. Trasę i kandydatów ustaliłem za Ciebie na markerze:

| Rzecz | Ścieżka | Co to jest |
| --- | --- | --- |
| trasa | `GET /api/meetings/:id` → `server/src/routes/meeting.routes.ts:345` | jedno spotkanie, org brana **z tokena**, nigdy z parametru |
| strażnik — kandydat 1 | `server/src/services/meetingService.ts:285` | `SELECT * FROM meetings WHERE id = ? AND organization_id = ? LIMIT 1` |
| strażnik — kandydat 2 | `server/src/routes/meeting.routes.ts:150` | `canAccessMeeting(req, meeting)` |

★★★ **PUŁAPKA WBUDOWANA W PROJEKT TRASY.** Komentarz przy tej trasie
(`meeting.routes.ts:333-343`) mówi wprost, że **„nie znaleziono" i „brak dostępu" zwijają się
do tego samego `404`**, celowo, żeby nie przeciekało, który przypadek zaszedł. Skutek dla
Ciebie: **`404`/`404` dostaniesz tam za darmo i nie znaczy to nic**. Dowodem jest wyłącznie
para **obcy `404` / właściciel `200` z niepustym ciałem**, na **tym samym `meetingId`**.

1. Zasiej **jedno realne spotkanie** w organizacji właściciela. Zapisz `meetingId`.
2. Para: obcy `404`, właściciel `200`, **długość ciała obu** zapisana.
3. **Mutuj każdego kandydata OSOBNO** (dwie mutacje, dwie pary logów):
   - usuń `AND organization_id = ?` z zapytania w `meetingService.ts:285`;
   - zneutralizuj `canAccessMeeting` (`return true`).
   Dla każdej zapisz: czy test zaczerwieniał, **z jakim komunikatem** i czy komunikat mówi
   o izolacji, czy o czymś innym.
4. **Napisz zdanie:** „zabezpieczeniem trasy `GET /api/meetings/:id` jest `plik:linia`" —
   albo „są nim oba, i oto dowód dla każdego z osobna", albo „jeden z nich nie jest
   zabezpieczeniem i oto dlaczego".
5. ★ Jeżeli **żadna** mutacja nie zaczerwienia testu — zabezpieczenia nie ma, i to jest
   znalezisko **`P0`**, a nie powód do improwizacji. Piszesz **STOP** dla tego wiersza,
   zapisujesz znalezisko i idziesz do `R4`.

**Wymagany dowód:** para z `meetingId`, kodami i długościami ciała · **dwie** mutacje w obie
strony z pustym `git diff` · zdanie o strażniku. **Commit po `R3`.**

---

## R4 — PIĘĆ MODUŁÓW: `04`, `05`, `06`, `11`, `13` (rdzeń, commit ×5)

Dla **każdego** modułu, po kolei — i **commit po każdym**:

1. **Przeczytaj brief dyżuru 353** (`tests/unit/day353-g19-<nr>-<nazwa>.contract.test.ts`).
   Brief mówi, czego brakuje. To jest punkt startu, **nie ustalenie**.
   Znane z `evidence/g19/day353/r4-orzeczenie.md`:
   - `04_ASSESSMENT` — brakuje mutacyjnej obrony odczytu cross-org **istniejącej** oceny
     na `/api/v8/assessment/:id`; `day274` 2/2 i `day275` 1/1 przeszły, ale nie bronią.
   - `05_INITIATIVES` — `day277` 2/2 (właściciel zapis/readback, obcy `404`); brakuje
     `GREEN`→`RED`→`GREEN` po usunięciu filtra organizacji z decision enhancements.
   - `06_EXECUTION` — dropdown 2/2 na jawnym PG; brakuje pary obcy/właściciel dla
     **istniejącego** execution case przez `ApiGateway` i mutacji filtra organizacji.
   - `11_MATERIALS` — `day276` deck 2/2, workbook 2/2, workbook odmawia obcemu; brakuje
     mutacji filtra organizacji komendy workbook i pary dla decka.
   - `13_CHAT` — Agent Hub limiter 9/9, **ale wyłącznie kontrakt tekstowy**; brakuje realnej
     pary `ApiGateway`/JWT/PG dla istniejącej rozmowy albo planu agenta i mutacji strażnika.
2. **Ustal trasę i strażnika sam**, cytując `plik:linia`.
3. **Para izolacyjna**: obcy odmowa, właściciel `200` z **niepustym** ciałem, na **tym samym
   identyfikatorze istniejącego obiektu**. Zapisz oba kody i obie długości.
4. **Mutacja celująca w strażnika.** Jeżeli test czerwienieje z innego powodu niż brak
   izolacji — chybiłeś, przecelowujesz, i **zapisujesz, że pierwsza próba chybiła**.
5. **Przelot z `--retry=0` i `--reporter=json --outputFile=<ARTEFAKTY>`**, `numTotalTests`
   podany. ★★ Przelot z **zerem** wykonanych przypadków kończy się `exit 0` i **nie jest
   pomiarem** — to zdarzyło się dyżurowi 335 i słusznie zostało odrzucone.
   `No test files found` i `Transform failed` to **BŁĄD KOMENDY**, nie `PASS`.
6. **Jeżeli dla któregoś modułu dowód się nie składa — to jest wynik, nie porażka.**
   Piszesz imiennie: „`X` był w kubełku `A` błędnie; brakuje `Y`", zostawiasz brief czerwony
   i **nie podnosisz wiersza**.
7. **Sprzątanie na koniec:** `docker rm -fv cx-day360-pg` (bez `-v` wolumen zostaje),
   `df -h /` przed i po. ★ **Zakaz `pkill`/`killall`** — zabijasz wyłącznie własne PID-y.

**Wymagany dowód (per moduł):** trasa i strażnik z `plik:linia` · para z kodami i długościami ·
mutacja w obie strony z pustym `git diff` · `numTotalTests` · **albo** jawne orzeczenie
„kubełek `A` przypisany błędnie, brakuje …". **Commit po każdym module.**

---

## R5 — PODNIESIENIE WIERSZY: PIĘĆ PÓL, DWIE ZGODNE LICZBY (rdzeń)

★★★ **KAŻDY podniesiony wiersz `G19` musi literalnie zawierać PIĘĆ pól.** Wiersz, któremu
brakuje choć jednego, jest wpisem bez dowodu — i unieważnia dyżur.

| Pole | Kształt | Po co |
| --- | --- | --- |
| **data pomiaru** | `data=2026-09-04` | `DEC-392`: dowód ważny na dzień odbioru |
| **SHA pomiaru** | `sha=<10 znaków markera>` | `DEC-392`: wpis niesie SHA |
| **mianownik** | `mianownik=<liczba> wg <ścieżka źródła>` | żeby dało się orzec, co dowód pokrywa |
| **nazwa przypadku** | pełna nazwa `it(...)`, nie liczba | 04.09 dwa różne zestawy nazw dały tę samą trójkę liczb |
| **ścieżka artefaktu** | `evidence/g19/day360/…` | dowód ma leżeć w repo, nie w katalogu tymczasowym |

**Słowo stanu — reguła twarda:**

- **`PASS`** wolno napisać **wyłącznie** wtedy, gdy pole `mianownik` wiersza jest **pokryte
  Twoim dowodem w całości**, i wtedy wiersz brzmi np.
  `PASS (DEC-392, kotwica ruchoma) — data=…, sha=…, mianownik=… wg …, przypadek „…", dowód …`.
- Gdy dowód pokrywa **izolację modułu**, ale nie cały zadeklarowany mianownik — **stan NIE
  ZAWIERA słowa `PASS`** i nazywa lukę, np.
  `IZOLACJA_UDOWODNIONA / MIANOWNIK_OTWARTY — data=…, sha=…, mianownik pokryty=<N> z <M> wg …`.
  ★ To **nie jest** synonim `TECHNICAL_REGRESSION_PASS`: tamten twierdził zaliczenie i milczał
  o mianowniku; ten **nie twierdzi zaliczenia i podaje mianownik liczbą**.
- ★ **Zakaz wymyślenia trzeciego słowa**, które brzmi jak zaliczenie. Jeżeli nie mieścisz się
  w tych dwóch kształtach — to jest pytanie do właściciela, nie nowy termin.

**Dalej:**

1. **Wpis i dowód idą JEDNYM commitem.**
2. **Policz: ile wierszy podniosłeś, ile dowodów załączyłeś. Te dwie liczby mają być równe.**
   Jeden dowód uzasadnia więcej niż jeden wiersz **tylko** wtedy, gdy pokażesz, że mianownik
   tych wierszy jest **dosłownie tym samym zbiorem plików** — dyżur 353 sprawdził to dla
   `01` vs `08` i **orzekł, że nie jest**.
3. **Uruchom NOWY bezpiecznik ważności po ostatnim wpisie.** Ma zbadać `16` wierszy i **nie
   zgłosić ani jednego `BRAK_DATY_POMIARU`**. Jeżeli zgłosi — Twój wpis nie ma pięciu pól.
4. **Zero podniesionych wierszy też jest wynikiem** — po wykonaniu `R1`–`R4`, z powodem
   **per moduł**. Nigdy zamiast nich.
5. ★ **Pytanie o mianownik.** Jeżeli po Twoich dowodach rozjazd `49` vs `106` dalej stoi —
   sformułuj **jedno rozstrzygalne pytanie** do właściciela (wybór z wypisanymi
   konsekwencjami, nie „co robimy?"). `DEC-392` rozstrzygnęła regułę ważności; mianownika
   nie rozstrzygnęła i **nie wolno Ci go rozstrzygnąć samemu**.

**Wymagany dowód:** `git show --stat` każdego commita dotykającego macierzy · tabela
„wiersz → dowód → pięć pól" · dwie zgodne liczby · wynik bezpiecznika po ostatnim wpisie ·
pytanie o mianownik (jeżeli rozjazd stoi). **Commit po `R5`.**

---

## R6 — RAPORT I JEDNA SEKCJA REJESTRU

Raport `CODEX_DAY360_G19_KUBELEK_A_REPORT.md` zawiera, w tej kolejności:

1. **Każdą liczbę z tej instrukcji, którą Twój pomiar obalił** — osobną sekcją, na początku.
2. `R1`: bezpiecznik ważności — trzy mutacje, wynik przed/po/po przywróceniu, liczba
   zbadanych wierszy, kod wyjścia na stanie wejściowym.
3. `R2`: kalibracja `day307` — dwa kody, dwie długości ciała, mutacja, pusty `git diff`.
4. `R3`: `08_MEETINGS` — para, **dwie** mutacje, zdanie o strażniku.
5. `R4`: pięć modułów, per moduł — trasa, strażnik, para, mutacja, `numTotalTests`.
6. `R5`: tabela „wiersz → dowód → pięć pól", dwie zgodne liczby, wynik bezpiecznika.
7. **Pytanie o mianownik** (jeżeli rozjazd `49` vs `106` stoi) — rozstrzygalne, z wariantami.
8. Co zostało niewykonane i dlaczego — imiennie, per moduł.
9. `df -h /` przed i po; potwierdzenie usunięcia kontenera.

Sekcja w `docs/program/REJESTR_ZNALEZISK_20260903.md` — **litera `AB`**, sprawdzana komendą
**tuż przed commitem**:
`bash -c "grep -nE '^## [A-Z]+[.]' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -5"`.
Dziś sekcje idą do `Z`; litera `V` jest **wolna, ale zarezerwowana** — nie zajmuj jej.
Jeżeli `AB` jest zajęta, bierzesz pierwszą wolną i **zapisujesz to w raporcie**.

**Commit po `R6`.**

---

## Próg odbioru

Dyżur jest odebrany, gdy **wszystkie** poniższe są prawdziwe:

1. **Reguła `PASS_STALE` zaimplementowana maszynowo**, z **dowodem mutacyjnym celującym
   w zabezpieczenie** (termin ważności, wymóg daty, podłoga liczebności) — trzy mutacje,
   każda czerwieniąca test, każda przywrócona z pustym `git diff`.
2. Bezpiecznik ma **podłogę `16`** i kończy się błędem, gdy zbadał mniej.
3. `R2` dał parę `404`/`200` na tym samym `userId` z niepustym ciałem właściciela i mutację
   w obie strony.
4. `R3` dał parę na `GET /api/meetings/:id` **z niepustym `200` właściciela** (samo `404`/`404`
   jest tam wbudowane w projekt i nie liczy się) oraz **dwie osobne mutacje**.
5. `R4` dla **każdego** z pięciu modułów dał albo dowód z mutacją celującą w strażnika, albo
   jawne orzeczenie „kubełek `A` przypisany błędnie, brakuje …".
6. **Siedem wierszy podniesionych** — albo mniej, z powodem **per moduł**; **liczba
   podniesionych = liczbie dowodów**.
7. **Każdy podniesiony wiersz ma PIĘĆ pól** (data, SHA, mianownik, nazwa przypadku, ścieżka
   artefaktu) i przechodzi przez NOWY bezpiecznik bez `BRAK_DATY_POMIARU`.
8. **Żaden wiersz nie brzmi `TECHNICAL_REGRESSION_PASS` ani synonimem**; słowo `PASS` użyte
   wyłącznie tam, gdzie mianownik jest pokryty.
9. **Ani jeden z dziewięciu wierszy kubełka `C` nie został dotknięty**; mianownik nie został
   nadpisany; `git diff` na kodzie produktu pusty.
10. Liście słowników i cztery bramki identyczne przed i po; `reachability --check-baseline`
    `exit 0`; kontener usunięty; `df -h /` przed i po w raporcie.

---

## Prawo zatrzymania

Zatrzymujesz się i piszesz **STOP** z powodem, jeżeli:

- którykolwiek z Twoich portów (`6431`, `5571`) jest zajęty — **STOP całości, nigdy podmiana**;
- `evidence/g19/day353/r4-orzeczenie.md` albo sekcja `R` (`DEC-392`) rejestru **nie istnieje** —
  wtedy podstawa tego dyżuru zniknęła i trzeba to zgłosić, a nie improwizować reguły;
- migracje nie przechodzą dwukrotnie na czystej bazie;
- **żadna** mutacja na trasie `08_MEETINGS` nie czerwieni testu — to znaczy, że zabezpieczenia
  nie ma; **znalezisko `P0`**, STOP dla tego wiersza (nie dla całego dyżuru), idziesz do `R4`;
- realizacja `R5` wymagałaby wpisania stanu, który jest synonimem odrzuconego
  `TECHNICAL_REGRESSION_PASS`;
- zamknięcie wiersza wymagałoby nadpisania mianownika.

★ **Zatrzymanie z konkretnym powodem jest pełnowartościowym wynikiem dyżuru.**
Zmyślony dowód nie jest.

---

## AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para | Rozstrzygnięcie |
| --- | --- |
| „`DEC-392` dopuszcza `PASS`" × „zakaz `PASS` i synonimów z dyżuru 353" | `R5` — `PASS` wyłącznie z pięcioma polami i wyłącznie przy pokrytym mianowniku; inaczej stan nazywa lukę |
| „podnieś siedem wierszy" × „dowód w tym samym commicie" | `R2`–`R4` — każdy wiersz podnoszony razem ze swoim plikiem dowodowym; `R5` tylko zlicza |
| „wznów, nie powtarzaj" × „każdą liczbę mierzysz sam (`Z24`)" | `B.3` — mierzysz **tanie** liczby (odczyt artefaktów, `git rev-list`), **drogie** robisz na własnej bazie w `R2`–`R4`, bo tam i tak są potrzebne |
| „reguła ruchomej kotwicy" × „nie obniżaj progu" | `R0` zasada 1 — zmienia się punkt odniesienia, nie wymóg dowodu; `R1` dokłada wygasanie, które **podnosi**, a nie obniża koszt utrzymania |
| „mianownik `49`" × „dryf `106`" | `R0` zasada 3 + `R5` punkt 5 — **osobne pytanie**, nie liczba do podmiany |
| „`08` w kubełku `A`" × „`day307` nie zamyka `08`" | `R3` — `08` dostaje **własną** parę na własnej trasie, którą nazwałem w `TRASY_TYL` |
| „trasa zwija `404` dla obu przypadków" × „para ma być `404`/`200`" | `R3`, pułapka 1 — dowodem jest **`200` właściciela z niepustym ciałem**, `404` obcego sam z siebie nic nie znaczy |
| „zakaz zmiany kodu produktu" × „mutacje w `TaskController`, `meetingService`, `meeting.routes`" | `B.1` — mutacje są **tymczasowe**, po `cp`, przywracane przez `cp`, z pustym `git diff` |
| „czerwone briefy 353 są dowodem braku" × „licencja na ich zmianę" | `B.1` — wolno zamienić brief w działający kontrakt, ale wtedy **usuwasz nagłówek „CZERWONY Z ZAŁOŻENIA" i piszesz o tym w raporcie**; cichy zielony brief byłby zatarciem śladu |
| „`git add -f` dla dowodów" × „zakaz binariów w repo" | `B.1` — jawna licencja na `evidence/g19/day360/**` |
| „mandat CTO — decyduj sam" × „pytanie o mianownik do właściciela" | `R5` punkt 5 — kotwicę rozstrzygnął CTO (`DEC-392`); mianownik bramki odbioru jest **regułą programu** i idzie do właściciela |

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności | TAK — jedenaście par, każda rozstrzygnięta w treści |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na `2a7273e087`; zero `BRAK`. Oznaczone `NOWY`: `scripts/dev/g19-waznosc-dowodu.mjs`, `tests/unit/g19-waznosc-dowodu.test.mjs`, `evidence/g19/day360/**`, raport, sekcja `AB` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, jedenaście wierszy; wszystkie uruchomione 04.09 |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — każdy wiersz „tylko odczyt" ma rzeczownik-produkt (zdanie · wskazanie · wynik przelotu) |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `B.2`, kolumna 4; mutacje siedzą w ciele pojedynczych funkcji, `ApiGateway` nietknięty |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `B.4.4` i **`B.4.6`** (rozłączność kolumn i modułów wobec pozostałych trzech dyżurów paczki); `6431`/`5571` zmierzone jako wolne. ★ 359, 361, 362 idą równolegle i mają rozłączne moduły macierzy; 363–366 pisze inny autor — `Z7` zaostrzony |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK — wszystkie grepy przez `bash -c`, wszystkie przeloty z `--retry=0` i `--reporter=json` |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu dyżurowi (siedem) | TAK — `§0.2d` w części A + siedem pułapek w polu pułapek |
| 9 | Samodzielność — zero odwołań do rozmów bez ścieżki | TAK; każdy cytat pracy 335, 348 i 353 ma ścieżkę artefaktu albo `plik:linia` |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK — sprawdzone przez generator, który blokuje zapis przy niespełnieniu |
