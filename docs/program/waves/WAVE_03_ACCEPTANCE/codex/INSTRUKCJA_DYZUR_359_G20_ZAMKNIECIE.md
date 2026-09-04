# INSTRUKCJA DYŻURU nr 359 — Codex — „★★★ G20 — ROZSTRZYGNĄĆ 13 POZYCJI `BLOKUJE` I WPISAĆ 16 WIERSZY, KTÓRYCH NIKT NIE ZACZĄŁ. Bramka `G20` („Final 16/16 replay”) stoi na `NOT_STARTED` we wszystkich szesnastu modułach — to znaczy „nikt nie podszedł”, a nie „nie da się”. Licznik `node scripts/dev/p0p1-licznik-e1.mjs` jest już maszynowy, wołany z CI (`npm run check:p0p1-e1`), ma naprawiony `fetch-depth: 0` i ma zamkniętą dziurę, przez którą zamykano pozycje commitem SPRZED zgłoszenia defektu (`gitShaState` → `SHA_STARSZY_NIZ_ZGLOSZENIE`, `collectReportedDates` czyta daty z repo, brak daty → `SHA_BRAK_DATY_ZGLOSZENIA`). Dziś daje `BLOKUJE: 13` i `exit 1`. Ten dyżur ma dać KAŻDEJ z tych 13 pozycji rozstrzygnięcie OBIEKTU — albo SHA realnej naprawy młodszej niż zgłoszenie i dotykającej obiektu z dowodu, albo przeklasyfikowanie z numerem DEC obejmującym pozycję IMIENNIE — a potem wpisać 16 wierszy `G20`, każdy z dowodem w tym samym commicie"

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
> **wyłącznie** `/private/tmp/cx-day359-g20-zamkniecie`.

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
Zakres: **BRAMKA ODBIORU `G20` („Final 16/16 replay”) we WSZYSTKICH 16 modułach fali `WAVE_03_ACCEPTANCE` **oraz** rejestr pozycji P0/P1 blokujących tę bramkę (`docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md`, generowany maszynowo przez `scripts/dev/p0p1-licznik-e1.mjs`). Przedmiotem pracy jest **rozstrzygnięcie obiektów i wpis do macierzy z dowodem**, nie pisanie kodu produktu. ★ Bramę wejściową `G20` definiuje `docs/program/waves/WAVE_03_ACCEPTANCE/FINAL_16_MODULE_REPLAY.md` (sekcja „Entry gate”, siedem pozycji) — przeczytaj ją, ZANIM zaczniesz układać brzmienie wierszy**.
Trasy front: `BRAK — ten dyżur nie renderuje ani jednego ekranu i nie dotyka `src/**` edytorem. Jedyny kontakt z `src/` to **odczyt** przy ustalaniu, czy commit-kandydat dotyka obiektu z dowodu pozycji (np. `MyWorkHub.tsx:4137` dla `MYW-DEC-REC-001`). ★ Jedyny wyjątek: pozycja `MYW-CV-REC-001` wymaga ŚWIEŻEGO ZRZUTU — a zrzutu w tym dyżurze NIE ROBISZ; zapisujesz to jako pytanie do właściciela (patrz pułapka 4)`. Trasy tył: `BRAK trasy HTTP w rdzeniu. Przedmiotem są: `scripts/dev/p0p1-licznik-e1.mjs` (tablica danych `DAY320_RESOLUTIONS` w wierszach ~28–90; bezpieczniki `gitShaState` ~272–300 i `collectReportedDates` ~120–150 — **NIETYKALNE DO ZAPISU**), jego test `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` (**NIETYKALNY DO ZAPISU**), pięć źródeł korpusu z `pathsFor()` (`ROZLICZENIE_P0P1_20260903.md`, `ROZLICZENIE_P0P1_DECYZJE_20260903.md`, `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md`, `docs/program/FALA_2_PO_STAGINGU.md`, `OWNER_DECISION_LEDGER_2026-08-24.md`) oraz 16 plików `MODULE_ACCEPTANCE.md`. ★ Jeżeli któraś z 13 pozycji wymaga dowodu runtime (np. `RES-OWN-003` — cold readback 4 KPI / 3 OKR / 3 ROI z PostgreSQL), trasą jest `server/src/routes/resultsVnext/**` i wolno Ci ją **uruchomić i zmierzyć**, ale **nie wolno Ci jej naprawiać** — brak writera jest wynikiem, nie zadaniem tego dyżuru`.

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
WT=/private/tmp/cx-day359-g20-zamkniecie
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
git -C "$VAULT" worktree add "$WT" -b codex/day359-g20-zamkniecie-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day359-g20-zamkniecie/config.worktree"
cat "$VAULT/worktrees/cx-day359-g20-zamkniecie/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day359-g20-zamkniecie-scratch
mkdir -p /private/tmp/cx-day359-g20-zamkniecie-artefakty

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
git -C "$WT" push github-backup codex/day359-g20-zamkniecie-20260904
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
cd /private/tmp/cx-day359-g20-zamkniecie

# (1) ★★★ LICZNIK — moja liczba to BLOKUJE: 13 i exit 1.
#     ★ PULAPKA: `| tail` POLYKA kod wyjscia. Mierz go osobno, tak jak tu.
node scripts/dev/p0p1-licznik-e1.mjs > /private/tmp/cx-day359-g20-zamkniecie-artefakty/p0p1-wejscie.out 2>&1
echo "licznik_exit=$?"
#   moja liczba: licznik_exit=1
bash -c "grep -c '| BLOKUJE |' /private/tmp/cx-day359-g20-zamkniecie-artefakty/p0p1-wejscie.out"
#   moja liczba: 13
bash -c "grep -E '^Mianownik:' /private/tmp/cx-day359-g20-zamkniecie-artefakty/p0p1-wejscie.out"
#   moja linia: 'Mianownik: 121. NAPRAWIONE: 32; ZAMKNIETE_DEC: 34; ODLOZONE_DEC: 42; W_BUDOWIE: 0.'
#   ★ 32+34+42+0+13 = 121. Jesli suma sie nie zgadza, masz inny korpus niz ja — ZAPISZ TO.

# (2) TRZYNASCIE POZYCJI IMIENNIE — to jest Twoja lista roboczaia na caly dyzur
bash -c "grep -oE '^\| .[A-Z][A-Z0-9-]*-[0-9]{3}(\[OF\])?. \| BLOKUJE' /private/tmp/cx-day359-g20-zamkniecie-artefakty/p0p1-wejscie.out"
#   moje 13: EXE-OWN-003, EXE-OWN-005, FIN-OWN-001, INI-OWN-001, INT-INIT-AI-OBS-001,
#            MYW-CAL-REC-002, MYW-CAL-REC-003, MYW-CV-REC-001, MYW-CV-REC-002,
#            MYW-DEC-REC-001, MYWORK-DEC-OWN-001, RES-OWN-003, RES-OWN-004

# (3) TEST LICZNIKA ISTNIEJE I JEST ZIELONY — to Twoj bezpiecznik przed regresja
ls -la scripts/dev/__tests__/p0p1-licznik-e1.test.mjs
node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs > /private/tmp/cx-day359-g20-zamkniecie-artefakty/licznik-test-przed.log 2>&1
echo "test_licznika_exit=$?"
#   moje: plik istnieje, test_licznika_exit=0

# (4) ★★ SZESNASCIE WIERSZY G20 STOI NA NOT_STARTED — sprawdz to sam
bash -c "for d in docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/; do printf '%s ' \$(basename \$d); grep -E '^\| G20 +\|' \$d/MODULE_ACCEPTANCE.md | head -1 | awk -F'|' '{print \$4}'; done"
#   moja liczba: 16 wierszy, wszystkie 'NOT_STARTED', czwarta kolumna kazdego to '—'

# (5) ★★★ BRAMA WEJSCIOWA G20 — przeczytaj ja, zanim ulozysz brzmienie wierszy
bash -c "sed -n '/^## Entry gate/,/^## Replay matrix/p' docs/program/waves/WAVE_03_ACCEPTANCE/FINAL_16_MODULE_REPLAY.md"
#   oczekiwane: siedem pozycji '- [ ]', ZADNA nie odhaczona; w tym
#   'All shared-component regression obligations are closed' (= G19) i 'Zero open P0/P1'

# (6) G19 STOI NOT_PROVEN WE WSZYSTKICH 16 — to jest strukturalny sufit tego dyzuru
bash -c "for d in docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/; do grep -E '^\| G19 +\|' \$d/MODULE_ACCEPTANCE.md | head -1 | awk -F'|' '{print \$4}'; done | sort | uniq -c"
#   moja liczba: 16 x 'NOT_PROVEN / OWNER_RETEST_PENDING'

# (7) TECHNICAL_REGRESSION_PASS — ma NIE istniec w zadnym wierszu macierzy
bash -c "grep -rn 'TECHNICAL_REGRESSION_PASS' docs/ | head"
#   oczekiwane: zero trafien w wierszach macierzy (jesli jest w opisie decyzji — to opis ODRZUCENIA)

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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day359-g20-zamkniecie-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6430`. Twój JEDYNY port harnessu to `5570`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day359-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki (04.09 noc) — **nie dotykasz cudzych**: 359 (6430/5570), 360 (6431/5571), 361 (6432/5572), 362 (6433/5573). Wcześniejsze rodzeństwo 04.09: 343-346 (6390-6393 / 5530-5533), 347 (6394/5534), 348 (6395/5535), 349 (6396/5536), 350 (6397/5537), 351 (6410/5550), 352 (6411/5551), 353 (6412/5552), 354 (6413/5553), 355-358. ★★ RÓWNOLEGLE inny autor pisze instrukcje **363-366**; ich portów NIE ZNAM w chwili pisania tej instrukcji, więc obowiązuje reguła twarda: **bierzesz WYŁĄCZNIE swoje dwa porty i żaden inny**, a port zajęty jest powodem do STOP-u całości (`Z7`), nigdy do podmiany numeru. **Twoje własne wyłącznie: baza 6430, runtime 5570.** Zmierzyłem 04.09: `5570-5573` i `6430-6433` wszystkie wolne, kontenery `cx-day359-pg`…`cx-day362-pg` nie istnieją. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!` po starcie każdego procesu w tle)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK. Ten dyżur nie dodaje, nie zmienia i nie przełącza ANI JEDNEJ flagi funkcyjnej. ★ Jeżeli rozstrzygnięcie którejkolwiek z 13 pozycji okaże się bramkowane flagą wyłączoną (realny kandydat: `RES-OWN-003` i `INT-INIT-AI-OBS-001`) — to jest ZNALEZISKO do raportu („właściciel widzi flagę jako brak funkcji”), a **nie** powód do włączenia flagi ani do uznania pozycji za naprawioną. ★★ Pamiętaj o kształcie „flaga OFF w kodzie ≠ wyłączona”: w SZEŚCIU rodzinach zmienna środowiskowa omija flagę wczesnym `return true`. Zanim napiszesz „funkcja jest za flagą OFF”, sprawdź, czy nie ma takiego obejścia — i zapisz `plik:linia``, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/check-triada.sh`, `scripts/check-gestosc.sh`, `scripts/dev/reachability-from-root.mjs`, `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs`, `.husky/pre-commit`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`. Wszystkie **NIETYKALNE DO ZAPISU** — wolno je wołać w pomiarze, nie wolno ich zmieniać. ★★ Do tej listy dochodzą **bezpieczniki wewnątrz licznika**: funkcje `gitShaState`, `collectReportedDates`, `reportedDateFor`, `expandIds`, `evaluateCorpus`, `gateResult`, `renderRegister` i stała `DEFAULT_FLOOR` — **NIETYKALNE**. Zmiana logiki bezpiecznika po to, by przepuścił pozycję, jest kształtem „bezpiecznik nagradza defekt” i unieważnia cały dyżur. ★ Bramka, która przechodzi, bo nie mogła nic zmierzyć, nie jest wynikiem: każde wywołanie zapisujesz z kodem wyjścia ORAZ z liczbą zbadanych obiektów (dla licznika — mianownik `121`)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY359_G20_ZAMKNIECIE_REPORT.md`. Jedyne inne dokumenty do zmiany: **(a)** wiersze `G20` w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` — **WYŁĄCZNIE kolumna `G20`**, wyłącznie commitem, który w tym samym `git show --stat` niesie plik dowodowy; **każdy inny wiersz jest nietykalny**, w szczególności `G15`, `G16`, `G18` i `G19` (`G16` zamyka właściciel oczami, `G18` to akcept z SHA, `G19` i `G15` są przedmiotem dyżurów 360, 361 i 362, które idą RÓWNOLEGLE). **(b)** tablica danych `DAY320_RESOLUTIONS` w `scripts/dev/p0p1-licznik-e1.mjs` — **wyłącznie wpisy dla pozycji, dla których `R2` wykaże rozstrzygnięcie**, nigdy logika. **(c)** wygenerowany `REJESTR_P0P1_BLOKUJACE_G20.md` — **nie edytujesz go ręcznie ANI RAZU**; powstaje wyłącznie z uruchomienia licznika. **(d)** **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` — Twoja litera to **`AA`**; literę sprawdzasz komendą `bash -c "grep -nE '^## [A-Z]+[.]' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -5"` TUŻ PRZED commitem (dziś sekcje idą do `Z`, a litera `V` jest wolna — nie zajmuj jej, jest zarezerwowana dla równoległej paczki; jeżeli `AA` okaże się zajęta, bierzesz pierwszą wolną i zapisujesz to w raporcie). ★★ WSZYSTKIE dowody idą do `evidence/g20/day359/` (katalog NIE ISTNIEJE na markerze — tworzysz go) z `git add -f`; ta instrukcja daje na to jawną licencję, więc „zakaz binariów w repo” byłby wymyślonym powodem. Plik postępu `/private/tmp/cx-day359-postep.md` żyje POZA repo. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day359-g20-zamkniecie-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day359-g20-zamkniecie-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ WPISANIA `PASS` DO WIERSZA `G20` — I ZAKAZ SYNONIMU.** `G20` to „Final 16/16 replay”, a jego brama wejściowa (`FINAL_16_MODULE_REPLAY.md`) wymaga m.in. domknięcia obowiązków regresyjnych komponentów współdzielonych — czyli `G19`, który stoi `NOT_PROVEN` w 16/16. Wiersz `G20` **nie może dziś brzmieć jak zaliczenie**. Zakaz obejmuje `TECHNICAL_REGRESSION_PASS` (odrzucony DWA RAZY), `TECHNICAL_REPLAY_PASS`, `MACHINE_PASS`, `TECHNICAL_PASS`, `PASS_MASZYNOWY`, `PASS (zakres techniczny)`, `READY` i każde inne sformułowanie, którego skutkiem jest wiersz brzmiący jak zaliczenie. ★★★ **WIERSZ MACIERZY ZMIENIA STAN WYŁĄCZNIE Z DOWODEM ZAŁĄCZONYM W TYM SAMYM COMMICIE** — `git show --stat` musi zawierać plik z `evidence/g20/day359/**`; commit bez dowodu cofasz przez `git reset --soft HEAD~1`. ★★★ **ZAKAZ ZAMYKANIA BRAMKI PRZEZ ZMIANĘ NARZĘDZIA, KTÓRE JĄ MIERZY.** Nie zmieniasz `gitShaState`, `collectReportedDates`, `DEFAULT_FLOOR`, `gateResult` ani żadnej innej funkcji licznika. Nie dopisujesz `--informational` do `npm run check:p0p1-e1`. Nie usuwasz pozycji z korpusu, żeby zmalał mianownik. **Mianownik po Twoim dyżurze ma nadal wynosić `121`** — jeżeli zmalał, cofasz zmianę. ★★ **ZAKAZ PRZENIESIENIA POZYCJI DO INNEGO KUBEŁKA ZAMIAST ROZSTRZYGNIĘCIA.** `BLOKUJE` → `ODLOZONE_DEC` bez decyzji obejmującej pozycję **imiennie** jest przenosinami, nie rozstrzygnięciem. ★★ **ZAKAZ UŻYCIA COMMITA „checkpoint” JAKO DOWODU NAPRAWY** — bezpiecznik to łapie (`SHA_CHECKPOINT`), ale nie łap się na obejściu przez commit, który tylko dotyka pliku i nic w nim nie zmienia. ★★ **ZAKAZ ZAMKNIĘCIA `MYW-CV-REC-001` SAMYM SHA** — dokument źródłowy (`07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md:163`, sekcja „Fala 4” w wierszu 228) wymaga ŚWIEŻEGO ZRZUTU przed zamknięciem. ★★ **ZAKAZ ZMIANY KODU PRODUKTU** (`src/**`, `server/src/**`) — znaleziony defekt idzie do raportu jako `plik:linia` + **diff nienałożony**. ★★ **ZAKAZ POŁĄCZENIA DO STAGINGU, DEMO I PRODUKCJI W KAŻDĄ STRONĘ** (`Z28`). ★ **ZAKAZ `pkill`/`killall`, `git stash`, `git push` poza własną gałęzią, `git fetch --all` oraz scalania czegokolwiek** | Bo `G20` jest jedyną z dwudziestu jeden bramek, do której **nikt nigdy nie podszedł** — szesnaście wierszy stoi na `NOT_STARTED` z myślnikiem w kolumnie dowodu. To nie jest „nie da się”; to jest „nie zaczęto”. Jednocześnie licznik, który mierzy jeden z siedmiu warunków bramy wejściowej („Zero open P0/P1”), został w ciągu ostatniej doby doprowadzony do stanu maszynowego: chodzi z CI, ma naprawiony `fetch-depth`, ma zamkniętą dziurę zamykania pozycji commitem sprzed zgłoszenia defektu i **uczciwie mówi `BLOKUJE: 13`**. Trzynaście pozycji to liczba, którą da się przerobić w jeden dyżur — pod warunkiem, że każda dostanie rozstrzygnięcie **obiektu**, a nie przeprowadzkę do innego kubełka. ★ Drugi powód jest metodyczny: dyżur 334 zamknął pięć pozycji, z czego **trzy upadły w odbiorze**, bo cytowany commit był starszy od zgłoszenia. Bezpiecznik na wiek już stoi. Nie stoi bezpiecznik na **obiekt** — i to jest luka, którą ma zamknąć ludzka robota tego dyżuru. ★ Trzeci powód: bramkę `G20` zamyka się dziś edytując tablicę `DAY320_RESOLUTIONS` **w tym samym pliku, który tę bramkę mierzy**. Ta konstrukcja jest zaproszeniem do naprawiania miernika zamiast mierzonego. Ten dyżur ma ją **opisać i przygotować rozdział**, nie po cichu przeprowadzić |

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
cd /private/tmp/cx-day359-g20-zamkniecie

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day359-pg psql -U postgres -d cx359 \
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
cd /private/tmp/cx-day359-g20-zamkniecie

docker run -d --name cx-day359-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx359 \
  -p 127.0.0.1:6430:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day359-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6430/cx359 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6430/cx359 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day359-g20-zamkniecie && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6430/cx359 \
JWT_SECRET=cx359-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Ten dyżur w rdzeniu **nie potrzebuje bazy** — `R1`–`R5` to archeologia gita, macierz i licznik. Kontener stawiasz **wyłącznie wtedy**, gdy rozstrzygnięcie którejś pozycji wymaga pomiaru runtime (realny kandydat: `RES-OWN-003` — cold readback 4 KPI / 3 OKR / 3 ROI). Wtedy: kontener `cx-day359-pg`, port `6430`, baza `cx359`, obraz `pgvector/pgvector:pg16` (`postgres:15` **nie przechodzi migracji**), migracje **dwoma przebiegami** na bazie OD ZERA, drugi ma dać `Applying migrations: 0`. Wariant (B) z cwd `server/`, `RUN_DB_TESTS=1`. ★★ PUŁAPKA, KTÓRA JUŻ RAZ ZADZIAŁAŁA: `NODE_ENV=test` **bez** `RUN_DB_TESTS=1` podstawia atrapę bazy pod `DbPromise` — `pg.Pool` widzi wiersz, kod produkcyjny nie; atrapa dodatkowo zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE`. **Każdy przelot z `--retry=0` i `--reporter=json --outputFile=<plik w ARTEFAKTY>`; podajesz `numTotalTests`. Przelot z zerem wykonanych przypadków kończy się `exit 0` i NIE JEST POMIAREM. `No test files found` oraz `Transform failed` to BŁĄD KOMENDY, nie `PASS`.** ★ Porównania przelotów robisz po **NAZWACH przypadków** (`fullName`), nigdy po samych liczbach — 04.09 dwa różne zestawy nazw dały tę samą trójkę liczb. Nowe pliki testowe (gdyby powstały) idą do `tests/`, **NIGDY pod `src/`**, z `git add -f` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day359-g20-zamkniecie-artefakty/day359-g20-zamkniecie.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day359-g20-zamkniecie && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Ten dyżur w rdzeniu **nie potrzebuje bazy** — `R1`–`R5` to archeologia gita, macierz i licznik. Kontener stawiasz **wyłącznie wtedy**, gdy rozstrzygnięcie którejś pozycji wymaga pomiaru runtime (realny kandydat: `RES-OWN-003` — cold readback 4 KPI / 3 OKR / 3 ROI). Wtedy: kontener `cx-day359-pg`, port `6430`, baza `cx359`, obraz `pgvector/pgvector:pg16` (`postgres:15` **nie przechodzi migracji**), migracje **dwoma przebiegami** na bazie OD ZERA, drugi ma dać `Applying migrations: 0`. Wariant (B) z cwd `server/`, `RUN_DB_TESTS=1`. ★★ PUŁAPKA, KTÓRA JUŻ RAZ ZADZIAŁAŁA: `NODE_ENV=test` **bez** `RUN_DB_TESTS=1` podstawia atrapę bazy pod `DbPromise` — `pg.Pool` widzi wiersz, kod produkcyjny nie; atrapa dodatkowo zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE`. **Każdy przelot z `--retry=0` i `--reporter=json --outputFile=<plik w ARTEFAKTY>`; podajesz `numTotalTests`. Przelot z zerem wykonanych przypadków kończy się `exit 0` i NIE JEST POMIAREM. `No test files found` oraz `Transform failed` to BŁĄD KOMENDY, nie `PASS`.** ★ Porównania przelotów robisz po **NAZWACH przypadków** (`fullName`), nigdy po samych liczbach — 04.09 dwa różne zestawy nazw dały tę samą trójkę liczb. Nowe pliki testowe (gdyby powstały) idą do `tests/`, **NIGDY pod `src/`**, z `git add -f` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day359-g20-zamkniecie-artefakty/day359-g20-zamkniecie.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day359-g20-zamkniecie/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day359-pg psql -U postgres -d cx359 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day359-pg`.
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
> **(e) ★★★ **SIEDEM PUŁAPEK TEGO DYŻURU.** **(1) Bezpiecznik sprawdza WIEK commita, nie OBIEKT.** `gitShaState` odrzuca commit starszy niż zgłoszenie i commit z „checkpoint” w temacie — ale **nie sprawdza, czy commit w ogóle dotyka pliku z dowodu pozycji**. Commit młodszy o jeden dzień, dotykający zupełnie innego modułu, przejdzie przez bezpiecznik i będzie fałszem. **Obiekt sprawdzasz Ty, `git show --stat`, i cytujesz go w raporcie.** **(2) Decyzja rodziny dziedziczy się MECHANICZNIE.** `addOwnerEvidence` przypisuje pozycji `DEC` z nagłówka rodziny `## R-N.`, nawet jeżeli wiersz pozycji sam DEC-a nie cytuje. To jest **udogodnienie odczytu, nie licencja na wymyślenie rodziny**: przeklasyfikowanie wymaga decyzji, która obejmuje pozycję **imiennie** albo obejmuje rodzinę i **wymienia tę pozycję w treści**. Dopisanie ID do cudzej rodziny, żeby odziedziczyło DEC, jest fałszerstwem dowodu. **(3) `MYW-DEC-REC-001` i `MYWORK-DEC-OWN-001` to DUPLIKAT tego samego zgłoszenia właściciela** (rejestr modułu: `2026-08-22` i `2026-08-23`, wspólna migawka `4a36e8a745`). Rozstrzygasz **oba imiennie** — ale to jest jedna praca archeologiczna, nie dwie; nie licz tego jako dwóch pozycji dorobku. **(4) `MYW-CV-REC-001` NIE ZAMYKA SIĘ SHA.** Dokument źródłowy stawia jej `FALA_4_OWNER_DECISION` i wymaga **świeżego zrzutu** przed zamknięciem; kod na `HEAD` mówi co innego niż uwaga właściciela i to jest **sprzeczność do rozstrzygnięcia oczami**, nie przez `git log`. Produktem dla tej pozycji jest **jedno rozstrzygalne pytanie do właściciela**, nie SHA. **(5) `ASM-OWN-003` / `ASM-OWN-003[OF]` — para była sprzeczna i została naprawiona; sprawdź, czy naprawa się utrzymała.** Dziś obie stoją `ODLOZONE_DEC / DEC-2026-09-03-364`, a ledger mówi przy tej decyzji dosłownie **„PO BRAMKACH (fala 2)”**. Jeżeli Twój pomiar pokaże rozjazd między `X` a `X[OF]` w KTÓREJKOLWIEK parze — to jest znalezisko, nie okazja do wyrównania „w drugą stronę”. **(6) `BLOKUJE: 0` osiągnięte przez skurczenie mianownika to nie jest zamknięcie.** Mianownik dziś to `121`. Sprawdzasz go **przed i po**; spadek = cofasz zmianę. To jest kształt „dwa rejestry — licznik mierzy rozjazd”: łatwo poprawić liczbę, nie ruszając ani jednego obiektu. **(7) `| tail` POŁYKA KOD WYJŚCIA.** `node scripts/dev/p0p1-licznik-e1.mjs | tail -60` zwraca `0` niezależnie od tego, ile jest blokerów — dokładnie tak zmierzyłem to najpierw ja i musiałem powtórzyć. Kod wyjścia mierzysz **osobno**, na komendzie bez potoku**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day359-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day359-g20-zamkniecie-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (dwie twarde zasady — czytasz) · R1 (odtworzenie migawki licznika i listy 13 na własnym markerze) · R2 (archeologia OBIEKTU dla każdej z 13 pozycji — data zgłoszenia, obiekt z dowodu, kandydaci SHA, rozstrzygnięcie A/B/C) · R3 (wpisanie rozstrzygnięć do `DAY320_RESOLUTIONS` — **commit po KAŻDEJ pozycji**, licznik po każdym commicie) · R4 (16 wierszy `G20` z dowodem w tym samym commicie) · R5 (opis problemu strukturalnego + **diff nienałożony** rozdziału danych od miernika) · R6 (raport i jedna sekcja rejestru). **Commit po KAŻDEJ pozycji `R`, a w `R3` po każdej z 13 pozycji z osobna**; pozycja bez commita jest pozycją niewykonaną`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6430` albo `5570` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6430` albo `5570`** (`Z7`).

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

Bramka `G20` („Final 16/16 replay") ma szesnaście wierszy i **wszystkie szesnaście stoi na
`NOT_STARTED`, z myślnikiem w kolumnie dowodu**. To jest jedyna bramka programu, do której
nikt nigdy nie podszedł. Nie dlatego, że się nie da — dlatego, że nie zaczęto.

Jeden z siedmiu warunków bramy wejściowej `G20` („Zero open P0/P1 across all registers")
jest od 04.09 mierzony maszynowo: `scripts/dev/p0p1-licznik-e1.mjs`, wołany z CI jako
`npm run check:p0p1-e1`, z naprawionym `fetch-depth: 0` w `.github/workflows/test-suite.yml`.
Ten licznik ma dziś **zamkniętą dziurę**, przez którą dyżur 334 zamknął trzy pozycje
commitem sprzed powstania defektu:

- `gitShaState()` (`scripts/dev/p0p1-licznik-e1.mjs`, okolice wiersza `272`) porównuje datę
  commita z **datą zgłoszenia** i zwraca `SHA_STARSZY_NIZ_ZGLOSZENIE`;
- `collectReportedDates()` (okolice `120`) czyta daty zgłoszeń z repo z trzech źródeł, biorąc
  **najwcześniejszą**;
- pozycja bez daty dostaje `SHA_BRAK_DATY_ZGLOSZENIA` i **też blokuje** — brak pomiaru nie
  jest wynikiem.

Licznik mówi dziś uczciwie: **`BLOKUJE: 13`**, `exit 1`, mianownik `121`.

**Ten dyżur ma dwie robocizny i jeden opis:**

1. **Trzynaście pozycji dostaje rozstrzygnięcie OBIEKTU.** Dla każdej: albo SHA realnej
   naprawy **młodszej niż zgłoszenie i dotykającej obiektu z dowodu**, albo przeklasyfikowanie
   z numerem `DEC`, który obejmuje pozycję **imiennie**. ★ **Nie przeniesienie do innego
   kubełka.** ★ **Commit „checkpoint" nie jest dowodem naprawy.**
2. **Szesnaście wierszy `G20` zostaje wpisanych**, każdy z dowodem w tym samym commicie.
3. **Problem strukturalny zostaje opisany** i przygotowany do rozdziału — bramkę zamyka się
   dziś edytując tablicę `DAY320_RESOLUTIONS` **w tym samym pliku, który tę bramkę mierzy**.

---

## ★★ SPROSTOWANIE ZLECENIA — co mój pomiar potwierdził, a czego nie

Zlecenie, z którego powstała ta instrukcja, podało liczby stanu bramek. Sprawdziłem je
na markerze `2a7273e087` w `/private/tmp/m03`.

**POTWIERDZONE:**

| Teza zlecenia | Mój pomiar | Komenda |
| --- | --- | --- |
| `G20`: 16 × `NOT_STARTED` | **potwierdzone**, 16/16, kolumna dowodu = `—` | `(4)` z bloku weryfikacji |
| licznik daje `BLOKUJE: 13` | **potwierdzone** | `(1)` i `(2)` |
| licznik kończy się `exit 1` | **potwierdzone** — ale **wyłącznie bez potoku** | `(1)` |
| `G19`: 16 × `NOT_PROVEN / OWNER_RETEST_PENDING` | **potwierdzone** | `(6)` |
| `G16`: 16 × `TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING` | **potwierdzone** | własny `grep` |
| `ASM-OWN-003` / `ASM-OWN-003[OF]` — sprzeczność naprawiona, naprawa się utrzymała | **potwierdzone**: obie `ODLOZONE_DEC` na `DEC-2026-09-03-364`; ledger mówi „PO BRAMKACH (fala 2)" | `(2)` + `OWNER_DECISION_LEDGER_2026-08-24.md:416` |
| `MYW-CV-REC-001` ma `FALA_4_OWNER_DECISION` i wymaga świeżego zrzutu | **potwierdzone** — `07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md:163` i `:228` | własny `grep` |
| liście słowników `pl 35199` / `en 33066` | **potwierdzone** | `(8)` |

**DOPRECYZOWANE PRZEZ MÓJ POMIAR — czego zlecenie nie powiedziało:**

- ★ **Mianownik licznika to `121`**, rozkład: `NAPRAWIONE 32` · `ZAMKNIETE_DEC 34` ·
  `ODLOZONE_DEC 42` · `W_BUDOWIE 0` · `BLOKUJE 13`. Suma się zgadza. **Ta liczba jest Twoim
  bezpiecznikiem przed „naprawą przez skurczenie mianownika"** — sprawdzasz ją przed i po.
- ★ **`| tail` połyka kod wyjścia licznika.** Mój pierwszy pomiar dał `EXIT=0` przy trzynastu
  blokerach, bo puściłem wynik przez potok. Powtórzyłem bez potoku i dostałem `1`. Zapisuję to
  jako pułapkę nr 7, bo dokładnie tak wygląda fałszywe „bramka zielona".
- ★ **Brama wejściowa `G20` ma SIEDEM warunków** (`FINAL_16_MODULE_REPLAY.md`, sekcja
  „Entry gate") i **żaden nie jest odhaczony**. Jeden z nich brzmi „All shared-component
  regression obligations are closed" — to jest `G19`, który stoi `NOT_PROVEN` w 16/16.
  **Wniosek, który musisz przyjąć na wejściu: `G20` nie może dziś brzmieć jak zaliczenie,
  i to nie jest Twoja porażka — to jest stan.**

★ **Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

---

## ★ Zmierz moje liczby sam

Wykonaj blok `(1)`–`(8)` z sekcji „Weryfikacja stanu wejściowego" w części A **w całości**
i zapisz wyniki obok moich w `evidence/g20/day359/r1-porownanie-liczb.md`. To jest tanie
(sam odczyt i jedno uruchomienie licznika) i jest warunkiem wejścia do `R2`.

---

## B.1. TABELA LICENCJI — CAŁA ŚCIEŻKA

★ Licencja obejmuje **całą ścieżkę**, żebyś nie musiał wybierać między złamaniem licencji
a zrobieniem połowy roboty.

| Warstwa | Ścieżka | Licencja | Produkt |
| --- | --- | --- | --- |
| **dane licznika** | `scripts/dev/p0p1-licznik-e1.mjs` — **wyłącznie** tablica `DAY320_RESOLUTIONS` (okolice wierszy `28`–`90`) | **★ WĄSKA — ZAPIS tylko wpisów dla pozycji rozstrzygniętych w `R2`.** Wpis ma jeden z trzech kształtów: `{ type: 'SHA', sha: '<10 znaków>' }`, `{ type: 'DECISION', decision: 'DEC-…' }`, `{ type: 'UNRESOLVED', detail: '<powód>' }`. **Zakaz zmiany czegokolwiek poza tą tablicą** | zmieniony wpis + dowód w jednym commicie |
| **bezpieczniki licznika** | te same pliki, funkcje `gitShaState`, `collectReportedDates`, `reportedDateFor`, `expandIds`, `collectUniverse`, `evaluateCorpus`, `renderRegister`, `gateResult`, `isDeferredDecision`, stała `DEFAULT_FLOOR` | **★ NIETYKALNE DO ZAPISU.** Wolno czytać i wołać | cytat `plik:linia` w raporcie |
| **test licznika** | `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` | **NIETYKALNY DO ZAPISU** — uruchamiasz przed pierwszym i po ostatnim commicie, oba wyniki do raportu | dwa `exit` |
| **rejestr generowany** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md` | **zapis WYŁĄCZNIE przez uruchomienie licznika.** ★ Ręczna edycja tego pliku unieważnia dyżur | plik po ostatnim uruchomieniu |
| **źródła korpusu (odczyt)** | `ROZLICZENIE_P0P1_20260903.md`, `ROZLICZENIE_P0P1_DECYZJE_20260903.md`, `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md`, `docs/program/FALA_2_PO_STAGINGU.md`, `OWNER_DECISION_LEDGER_2026-08-24.md` | **★ TYLKO ODCZYT.** Dopisanie ID do cudzej rodziny decyzji, żeby odziedziczyło `DEC`, jest fałszerstwem dowodu | cytat wiersza w raporcie |
| **macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **★ WĄSKA — WYŁĄCZNIE wiersz `G20`**, wyłącznie commitem, który w tym samym `git show --stat` niesie plik dowodowy. `G15`, `G16`, `G18`, `G19` — **nietykalne** | 16 wierszy + dowody |
| **brama wejściowa** | `docs/program/waves/WAVE_03_ACCEPTANCE/FINAL_16_MODULE_REPLAY.md` | **TYLKO ODCZYT w `R1`–`R4`.** ★ W `R4` wolno Ci **odhaczyć wyłącznie te pozycje „Entry gate", dla których masz dowód w tym samym commicie** — i żadnej innej; `Status: NOT_READY` i `Final product SHA: UNSET` zostają nietknięte | odhaczone pozycje z dowodem albo brak zmian |
| **archeologia gita** | całe repo, `git log`, `git show`, `git blame` | **odczyt bez ograniczeń** | tabela `R2` |
| **dowody** | `evidence/g20/day359/**` (**NOWY** katalog) | **zapis, `git add -f`** — ta instrukcja daje jawną licencję na logi i `*.json`; „zakaz binariów w repo" byłby wymyślonym powodem | wszystkie logi i tabele |
| **diff nienałożony** | `evidence/g20/day359/r5-rozdzial-danych.patch` | **zapis** — plik `*.patch`, **NIE nakładasz go** | patch + opis |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY359_G20_ZAMKNIECIE_REPORT.md` | **zapis (główny produkt)** | raport |
| **rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **★ WĄSKA — WYŁĄCZNIE dopisanie JEDNEJ nowej sekcji, litera `AA`** (weryfikowana komendą tuż przed commitem). Zakaz kasowania i przeredagowywania sekcji zastanych, zakaz zajmowania litery `V` | jedna sekcja |
| **kod produktu** | `src/**`, `server/src/**` | **★ ZAKAZ ZAPISU.** Znaleziony defekt idzie do raportu jako `plik:linia` + **diff nienałożony** | wpis w raporcie |
| **workflow CI** | `.github/workflows/**` | **NIETYKALNE DO ZAPISU** — w szczególności zakaz dopisania `--informational` do `check:p0p1-e1` | brak zmian |
| **bramki i harness** | `scripts/check-*.sh`, `scripts/dev/reachability-from-root.mjs`, `tests/setup.ts`, `tests/helpers/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **NIETYKALNE DO ZAPISU** — wolno wołać w pomiarze | wyniki `0` |

---

## B.2. TABELA POZYCJI

| Poz. | Co robi | Rdzeń? | Wykonalne bez pliku przekrojowego? | Commit |
| --- | --- | --- | --- | --- |
| `R0` | trzy twarde zasady — czytasz, nie wykonujesz | — | — | — |
| `R1` | odtworzenie migawki licznika, mianownika `121` i listy 13 pozycji | TAK | TAK — jedno uruchomienie + odczyt | **TAK** |
| `R2` | archeologia OBIEKTU dla każdej z 13 pozycji; rozstrzygnięcie `A`/`B`/`C` | TAK | TAK — `git log`/`git show` per pozycja | **TAK** |
| `R3` | wpisanie rozstrzygnięć do `DAY320_RESOLUTIONS` | TAK | TAK — jedna tablica danych | **TAK ×13** |
| `R4` | 16 wierszy `G20` z dowodem w tym samym commicie | TAK | TAK — dokument | **TAK** |
| `R5` | opis problemu strukturalnego + **diff nienałożony** rozdziału | TAK | TAK | **TAK** |
| `R6` | raport i jedna sekcja rejestru | — | TAK | **TAK** |

★ **Commit po KAŻDEJ pozycji `R`, a w `R3` po każdej z 13 pozycji z osobna.** Pozycja bez
commita jest pozycją niewykonaną.

---

## B.3. TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | pozycje `BLOKUJE` | `13` | `(2)` | TAK |
| 2 | mianownik korpusu | `121` | `(1)` | TAK — **identyczny przed i po** |
| 3 | rozkład werdyktów | `32` / `34` / `42` / `0` / `13` | `(1)` | TAK — suma `121` |
| 4 | kod wyjścia licznika na wejściu | `1` | `(1)`, **bez potoku** | TAK |
| 5 | test licznika na wejściu | `exit 0` | `(3)` | TAK |
| 6 | wiersze `G20` na `NOT_STARTED` | `16` | `(4)` | TAK |
| 7 | pozycje „Entry gate" odhaczone | `0` z `7` | `(5)` | TAK |
| 8 | wiersze `G19` na `NOT_PROVEN` | `16` | `(6)` | TAK — **strukturalny sufit `G20`** |
| 9 | pozycji rozstrzygniętych / dowodów załączonych | — | `R3`, dwa liczniki | TAK — **muszą być równe** |
| 10 | wierszy `G20` podniesionych / dowodów | — | `R4`, dwa liczniki | TAK — **muszą być równe** |
| 11 | liście słowników i cztery bramki | `35199` / `33066`, cztery `0` | `(8)` | TAK — identyczne przed i po |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| Plik | Pozycja | Zakres |
| --- | --- | --- |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY359_G20_ZAMKNIECIE_REPORT.md` | `R6` | główny produkt |
| `evidence/g20/day359/**` | `R1`–`R5` | **NOWY** katalog; wszystkie logi, tabele, patch |
| `docs/program/REJESTR_ZNALEZISK_20260903.md` | `R6` | jedna nowa sekcja, litera `AA` |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Warunek | Zakres |
| --- | --- | --- |
| `scripts/dev/p0p1-licznik-e1.mjs` | gdy `R2` rozstrzygnie pozycję | **wyłącznie** wpis w `DAY320_RESOLUTIONS` |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md` | po każdym uruchomieniu licznika | **wyłącznie maszynowo** |
| `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | `R4` | **wyłącznie wiersz `G20`** |
| `docs/program/waves/WAVE_03_ACCEPTANCE/FINAL_16_MODULE_REPLAY.md` | gdy masz dowód dla konkretnej pozycji „Entry gate" | **wyłącznie ta pozycja**; `Status` i `Final product SHA` nietknięte |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

`src/**` · `server/src/**` · `public/locales/**` · żaden wiersz macierzy poza `G20` ·
`scripts/check-*.sh` · `scripts/dev/reachability-from-root.mjs` ·
`scripts/dev/__tests__/**` · `.github/workflows/**` · pięć źródeł korpusu z `pathsFor()` ·
żaden plik dyżurów 360, 361, 362 ani 363–366.

★ Plik postępu `/private/tmp/cx-day359-postep.md` żyje **poza repo**.

### B.4.4. Zasoby wyłączne

Baza **6430**, runtime **5570**, kontener **`cx-day359-pg`**, baza **`cx359`**,
worktree `/private/tmp/cx-day359-g20-zamkniecie`, gałąź `codex/day359-g20-zamkniecie-20260904`.
Sprawdziłem 04.09: oba porty wolne, kontener nie istnieje, worktree nie istnieje,
gałąź nie istnieje.

★★ **Port zajęty = STOP CAŁOŚCI (`Z7`), NIGDY podmiana numeru.**

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
git status --short                  # zero plikow spoza tabeli B.4.1/B.4.2
git diff --cached --stat            # ★ commit dotykajacy macierzy MUSI zawierac plik dowodowy
git diff --cached -- scripts/dev/p0p1-licznik-e1.mjs   # ★ WYLACZNIE wpisy DAY320_RESOLUTIONS
bash -c "grep -rnE '^(<{7}|>{7}|={7})' \$(git diff --cached --name-only)"   # zero znacznikow konfliktu
node scripts/dev/p0p1-licznik-e1.mjs > /dev/null 2>&1; echo "licznik_exit=$?"
bash -c "grep -E '^Mianownik:' docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md"
#   ★ mianownik MUSI dalej wynosic 121
```

### B.4.6. ★★ ROZŁĄCZNOŚĆ Z DYŻURAMI RÓWNOLEGŁYMI — czytaj, zanim dotkniesz macierzy

Cztery dyżury tej paczki dotykają **tych samych plików** `MODULE_ACCEPTANCE.md`, ale
**rozłącznych kolumn i modułów**:

| Dyżur | Kolumna | Moduły |
| --- | --- | --- |
| **359 (Ty)** | **`G20`** | **wszystkie 16** |
| 360 | `G19` | `01`, `04`, `05`, `06`, `08`, `11`, `13` |
| 361 | `G19` | `02`, `03`, `07`, `09`, `10`, `12`, `14`, `15`, `16` |
| 362 | `G15` | `04`, `09`, `12`, `15` |

★ **Konflikt scalenia rozstrzyga nadzorca.** Nie próbujesz go uprzedzić, nie scalasz cudzej
gałęzi, nie „porządkujesz" cudzej kolumny i nie poprawiasz cudzego wiersza, nawet jeżeli
uważasz, że jest zły — **to jest znalezisko do raportu, nie do edytora**.

---

## R0 — TRZY TWARDE ZASADY (przeczytaj, zanim cokolwiek zrobisz)

**ZASADA 1 — wiersz macierzy zmienia stan WYŁĄCZNIE z dowodem załączonym w TYM SAMYM
commicie.** Nie „dowód był w poprzednim commicie", nie „dowód jest w raporcie, który dopiszę
w `R6`". `git show --stat <commit dotykający macierzy>` musi zawierać plik z
`evidence/g20/day359/**`. Commit, który zmienia wiersz i nie niesie dowodu, **cofasz przez
`git reset --soft HEAD~1`** i składasz na nowo. **Wpis bez dowodu = odrzucenie całego dyżuru.**

**ZASADA 2 — `TECHNICAL_REGRESSION_PASS` został odrzucony DWA RAZY i nie wolno go wprowadzić
pod żadną nazwą.** Zakaz obejmuje każdy synonim w każdej bramce: `TECHNICAL_REPLAY_PASS`,
`MACHINE_PASS`, `TECHNICAL_PASS`, `REGRESSION_TECHNICAL_OK`, `PASS_MASZYNOWY`,
`PASS (zakres techniczny)`, `READY`, `GREEN` i każde inne sformułowanie, którego skutkiem jest
wiersz brzmiący jak zaliczenie. Stan wiersza po podniesieniu ma **nazywać zakres dowodu i jego
granicę**.

**ZASADA 3 — nie wolno „naprawiać" bramki przez nadpisanie mianownika ani zawężenie kryterium.**
Mianownik licznika to `121`. Bramka `G20` ma siedem warunków wejścia. Nie usuwasz pozycji
z korpusu, nie dopisujesz `--informational`, nie zmieniasz definicji bramki i nie zmieniasz
funkcji, która ją mierzy.

★ **Jeżeli uważasz, że te trzy zasady razem czynią część tego dyżuru niewykonalną — to jest
wynik i zapisujesz go jako pytanie do właściciela. Nie obchodzisz ich.**

---

## R1 — ODTWORZENIE MIGAWKI (rdzeń, tani)

1. Wykonaj blok `(1)`–`(8)` w całości. Zapisz **swoje** wyniki obok moich w
   `evidence/g20/day359/r1-porownanie-liczb.md` — jedenaście wierszy tabeli `B.3`, para kolumn
   „liczba autora instrukcji / mój pomiar".
2. **Zapisz listę 13 pozycji imiennie** do `evidence/g20/day359/r1-trzynascie.md`. Ta lista
   jest Twoją listą roboczą na `R2` i `R3`.
3. Uruchom test licznika (`node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs`)
   i zapisz kod wyjścia. **To jest Twoja baza porównawcza** — ten sam test uruchamiasz po
   ostatnim commicie i oba wyniki idą do raportu.
4. Przeczytaj sekcję „Entry gate" z `FINAL_16_MODULE_REPLAY.md` i **wypisz siedem warunków
   z własnym orzeczeniem: który da się dziś zmierzyć, który jest zablokowany przez inną bramkę,
   a który wymaga właściciela.** To jest szkielet `R4`.

**Wymagany dowód:** `r1-porownanie-liczb.md` (11 wierszy, dwie kolumny) · `r1-trzynascie.md`
(13 ID) · `r1-brama-wejsciowa.md` (7 warunków, orzeczenie per warunek) · log testu licznika.
**Commit po `R1`.**

---

## R2 — ARCHEOLOGIA OBIEKTU: TRZYNAŚCIE POZYCJI (rdzeń, najdłuższy)

Dla **każdej** z 13 pozycji, po kolei, wypełniasz **sześć pól**. Wynik trafia do
`evidence/g20/day359/r2-archeologia.md`.

| Pole | Skąd je bierzesz |
| --- | --- |
| **`ID`** | lista z `R1` |
| **data zgłoszenia** | `node -e "import('./scripts/dev/p0p1-licznik-e1.mjs').then(m=>console.log(m.reportedDateFor(m.collectReportedDates(), 'ID')))"` — ★ to jest **ta sama** data, którą widzi bezpiecznik |
| **OBIEKT z dowodu** | wiersz pozycji w `ROZLICZENIE_P0P1_20260903.md` i w `modules/*/MODULE_ACCEPTANCE.md`: **`plik:linia` albo trasa HTTP**. Jeżeli w dowodzie nie ma ani pliku, ani trasy — **to jest wynik**: pozycja nie ma obiektu i nie da się jej zamknąć SHA (rozstrzygnięcie `C`) |
| **kandydaci SHA** | `git log --since=<data zgłoszenia> --oneline -- <plik z obiektu>` — ★ **tylko commity dotykające OBIEKTU**, nie „cokolwiek z tego dnia" |
| **weryfikacja kandydata** | `git show --stat <sha>` musi wymienić plik z obiektu; `git show <sha> -- <plik>` musi pokazać zmianę **istotną dla treści uwagi**, nie sam re-format. Temat commita nie może zawierać słowa `checkpoint` |
| **ROZSTRZYGNIĘCIE** | `A` = SHA (wpisujesz `{ type: 'SHA', … }`) · `B` = decyzja obejmująca pozycję **imiennie** (`{ type: 'DECISION', … }`) · `C` = wymaga właściciela → **zostaje `UNRESOLVED` z powodem, a Ty formułujesz JEDNO rozstrzygalne pytanie** |

### ★★ Co jest, a co NIE JEST rozstrzygnięciem

| Kształt | Werdykt |
| --- | --- |
| SHA młodszy niż zgłoszenie, `git show --stat` wymienia plik z obiektu, zmiana dotyczy treści uwagi | **`A` — rozstrzygnięcie** |
| SHA młodszy, ale `--stat` nie wymienia pliku z obiektu | **NIE** — bezpiecznik to przepuści, odbiór nie |
| SHA z tematem „checkpoint" | **NIE** — bezpiecznik zwróci `SHA_CHECKPOINT` |
| `DEC` cytujący pozycję po `ID` albo wymieniający jej obiekt w treści | **`B` — rozstrzygnięcie** |
| `DEC` rodziny, do której dopisałeś `ID`, żeby odziedziczyło decyzję | **NIE — to jest fałszerstwo dowodu** |
| zmiana werdyktu z `BLOKUJE` na `ODLOZONE_DEC` bez `DEC` obejmującego pozycję | **NIE — to są przenosiny** |
| `UNRESOLVED` z konkretnym powodem + jedno rozstrzygalne pytanie | **`C` — pełnowartościowy wynik** |

### ★★ Pozycje, dla których znam odpowiedź z góry — sprawdź, czy mam rację

- **`MYW-CV-REC-001`** — dokument źródłowy (`07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md:163`, oraz
  wiersz `228` „Fala 4") stawia jej `FALA_4_OWNER_DECISION` i **wymaga świeżego zrzutu przed
  zamknięciem**. Uwaga właściciela mówi „podgląd całkowicie niezgodny ze standardem", a kod na
  `HEAD` używa `TableWithPreviewLayout` + `StandardTable` + `PreviewMetaCard`. **To jest
  sprzeczność kod↔uwaga, którą rozstrzyga się oczami, nie `git log`-iem.** Moje orzeczenie:
  rozstrzygnięcie `C`. **Sprawdź to i podpisz się pod tym albo obal.** Zrzutu w tym dyżurze
  **nie robisz** — produktem jest pytanie.
- **`MYW-DEC-REC-001`** i **`MYWORK-DEC-OWN-001`** — **duplikat tego samego zgłoszenia**
  (`2026-08-22` i `2026-08-23`, wspólna migawka `4a36e8a745`, dowód wskazuje
  `MyWorkHub.tsx:4137`). Jedna archeologia, **dwa rozstrzygnięcia imienne**. Jeżeli znajdziesz
  SHA, obie pozycje dostają ten sam — i **piszesz wprost, że to jedna naprawa**.
- **`RES-OWN-003`** — powód blokady to „brak licencjonowanego writera i cold readbacku
  4 KPI / 3 OKR / 3 ROI z PostgreSQL". To jest **brak funkcji**, nie brak SHA. Twoje
  rozstrzygnięcie prawdopodobnie brzmi `C` — ale **zanim to napiszesz, sprawdź flagę**:
  kilka razy w tym programie „nie ma funkcji" znaczyło „funkcja jest za flagą OFF".
  Wynik zapisujesz zdaniem z `plik:linia`.
- **`MYW-CV-REC-002`**, **`RES-OWN-004`** — powody mówią „źródło opisuje stan istniejący bez SHA
  naprawy". To jest kandydat na `C`, ale **sprawdź najpierw, czy obiekt w ogóle jest nazwany**;
  pozycja bez obiektu jest osobnym gatunkiem braku i tak ją nazwij.
- **`INT-INIT-AI-OBS-001`** — „brak osiągalnego wołacza fill-section i dowodu z realnym
  providerem AI". ★ Pułapka „wołacz istnieje ≠ renderuje się": jeżeli znajdziesz wołacza,
  sprawdź, czy komponent jest **osiągalny od korzenia** (`scripts/dev/reachability-from-root.mjs`),
  zanim napiszesz, że funkcja żyje.

### ★★ Czego NIE robisz w `R2`

Nie piszesz kodu produktu. Nie stawiasz kontenera, chyba że rozstrzygnięcie konkretnej pozycji
wymaga pomiaru runtime — a wtedy **mierzysz i zapisujesz wynik, nie naprawiasz**.

**Wymagany dowód:** `evidence/g20/day359/r2-archeologia.md` — **13 wierszy, sześć pól każdy**,
plus licznik zbiorczy: ile `A`, ile `B`, ile `C`. **Commit po `R2`.**

---

## R3 — WPISANIE ROZSTRZYGNIĘĆ (rdzeń, commit ×13)

Dla każdej pozycji z rozstrzygnięciem `A` lub `B` zmieniasz **jeden wpis** w
`DAY320_RESOLUTIONS`. Dla `C` zostawiasz `UNRESOLVED`, ale **poprawiasz pole `detail`**, tak
żeby zawierało powód i wskazanie, kto to rozstrzyga.

**Procedura, po każdej pojedynczej pozycji:**

```bash
# 1. zmiana JEDNEGO wpisu w DAY320_RESOLUTIONS
# 2. uruchomienie licznika BEZ POTOKU
node scripts/dev/p0p1-licznik-e1.mjs > /private/tmp/cx-day359-g20-zamkniecie-artefakty/p0p1-<ID>.out 2>&1
echo "licznik_exit=$?"
# 3. mianownik MUSI dalej byc 121
bash -c "grep -E '^Mianownik:' docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md"
# 4. werdykt TEJ pozycji ma sie zmienic i zadnej innej
bash -c "grep -E '^\| .<ID>. \|' docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md"
# 5. test licznika dalej zielony
node --test scripts/dev/__tests__/p0p1-licznik-e1.test.mjs >/dev/null 2>&1; echo "test_exit=$?"
# 6. commit: wpis + wygenerowany rejestr + plik dowodowy z evidence/g20/day359/
```

★★ **Dowód dla pozycji to plik**, nie zdanie w commit-message:
`evidence/g20/day359/pozycje/<ID>.md` z: datą zgłoszenia, obiektem, kandydatami, wybranym SHA
lub DEC, wynikiem `git show --stat` i stanem werdyktu przed i po.

★★ **KONTROLA WSTECZNA po ostatniej pozycji** — obowiązkowa:

```bash
# zaden inny werdykt nie mogl sie zmienic przy okazji
bash -c "diff <(grep -oE '^\| .[A-Z][A-Z0-9-]*-[0-9]{3}(\[OF\])?. \| [A-Z_]+' /private/tmp/cx-day359-g20-zamkniecie-artefakty/p0p1-wejscie.out) <(grep -oE '^\| .[A-Z][A-Z0-9-]*-[0-9]{3}(\[OF\])?. \| [A-Z_]+' docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_P0P1_BLOKUJACE_G20.md)"
#   oczekiwane: WYLACZNIE linie pozycji, ktore rozstrzygnales. Kazda inna zmiana = cofasz.
```

★ **Dowód mutacyjny bezpiecznika** (jeden raz, na koniec `R3`): weź **jedną** pozycję zamkniętą
przez Ciebie SHA, podmień w kopii poza repo ten SHA na commit **starszy niż zgłoszenie**
i pokaż, że licznik daje dla niej `SHA_STARSZY_NIZ_ZGLOSZENIE` i wraca do `BLOKUJE`. Przywracasz
przez `cp` (**nigdy `git stash`**, `Z27`), `git diff` po przywróceniu **pusty**.
★ Mutacja ma celować w **zabezpieczenie** (warunek wieku commita), nie w mechanizm odczytu
tabeli — jeżeli licznik czerwienieje z innego powodu, mutacja chybiła i przecelowujesz ją.

**Wymagany dowód:** 13 plików `evidence/g20/day359/pozycje/<ID>.md` · 13 commitów ·
log kontroli wstecznej · dowód mutacyjny bezpiecznika w obie strony z pustym `git diff` ·
**dwie zgodne liczby: ile pozycji rozstrzygniętych / ile dowodów załączonych**.

---

## R4 — SZESNAŚCIE WIERSZY `G20` (rdzeń)

**Dziś każdy wiersz brzmi `NOT_STARTED` i ma `—` w kolumnie dowodu. To znaczy: nikt tego nawet
nie zaczął.** Twoim produktem jest wiersz, który **mówi prawdę o tym, co zmierzono i co
blokuje** — dla każdego z 16 modułów.

1. Ułóż brzmienie stanu, które **nazywa zakres i granicę**. Przykład kształtu (nie kopiuj
   bezmyślnie, dopasuj do swojego pomiaru):
   `ENTRY_GATE_MEASURED / BLOCKED_BY_G19` z kolumną dowodu wymieniającą: ile z siedmiu
   warunków bramy wejściowej zmierzono, który warunek blokuje, i ścieżkę artefaktu.
   ★ **Zakaz `PASS` i każdego synonimu** (`R0`, zasada 2).
2. **Kolumna dowodu nie może brzmieć `—` ani „przelot właściciela pozostaje wymagany".**
   Wymagam konkretu: *„brama wejściowa zmierzona 04.09 na `2a7273e087`: 2 z 7 warunków
   spełnione (`G18` = akcept z SHA; P0/P1 = `BLOKUJE: N`), warunek „shared-component regression
   obligations" zablokowany przez `G19` = `NOT_PROVEN`; dowód `evidence/g20/day359/r4-<moduł>.md`"*.
3. **Wpis i dowód idą JEDNYM commitem** (`R0`, zasada 1). Wolno zrobić jeden commit na wszystkie
   16 wierszy, pod warunkiem że ten sam commit niesie 16 (albo jeden zbiorczy) plik dowodowy.
4. **Policz: ile wierszy zmieniłeś, ile dowodów załączyłeś. Te dwie liczby mają być równe** —
   albo wyjaśniasz, dlaczego jeden dowód uzasadnia więcej niż jeden wiersz, pokazując, że
   podstawa tych wierszy jest **dosłownie tym samym zbiorem faktów** (dla `G20` to jest
   prawdopodobne — brama wejściowa jest wspólna — ale **musisz to napisać, nie założyć**).
5. **Zero zmienionych wierszy też jest wynikiem** — ale tylko wtedy, gdy `R1`–`R3` są wykonane
   i raport mówi imiennie, dlaczego stan `NOT_STARTED` jest **prawdziwszy** niż jakikolwiek
   inny. Wtedy piszesz to zdanie wprost.

**Wymagany dowód:** `git show --stat` każdego commita dotykającego macierzy · tabela
„wiersz → dowód" (16 wierszy) · dwie zgodne liczby. **Commit po `R4`.**

---

## R5 — PROBLEM STRUKTURALNY: MIERNIK I TABLICA W JEDNYM PLIKU (rdzeń, opis + patch)

**Fakt do opisania:** bramkę `G20` zamyka się dziś edytując tablicę `DAY320_RESOLUTIONS`
**w tym samym pliku, który tę bramkę mierzy** (`scripts/dev/p0p1-licznik-e1.mjs`). Ktokolwiek
ma licencję na „zamknięcie pozycji", ma jednocześnie edytor otwarty na funkcji `gitShaState`.
Propozycja rozdziału leży w
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/NAPRAWA_DYZUR_334_20260904.md` (sekcja o danych
out-of-code, okolice wiersza `211`).

**Produkt tej pozycji — trzy rzeczy:**

1. **Opis ryzyka** w raporcie: co konkretnie może pójść źle, z cytatem `plik:linia`, i które
   z dzisiejszych bezpieczników by tego **nie** złapały.
2. **`evidence/g20/day359/r5-rozdzial-danych.patch`** — **diff NIENAŁOŻONY**, który wynosi
   `DAY320_RESOLUTIONS` do osobnego pliku danych (`scripts/dev/data/day320-resolutions.json`
   albo `.mjs` — uzasadnij wybór) i zostawia w liczniku sam odczyt.
3. **Warunek przyjęcia tego patcha**, wypisany imiennie, żeby następny dyżur nie musiał go
   wymyślać: (a) `REJESTR_P0P1_BLOKUJACE_G20.md` po nałożeniu jest **bajt w bajt identyczny**;
   (b) `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` pozostaje zielony **bez zmian w teście**;
   (c) dochodzi nowy test dowodzący, że licznik **czyta plik danych**, a nie ma go zaszytego —
   z dowodem mutacyjnym (usuń wpis z pliku danych → werdykt pozycji się zmienia).

★★ **NIE NAKŁADASZ tego patcha.** Licencja tego dyżuru obejmuje wyłącznie tablicę danych
w istniejącym pliku. Rozdział jest decyzją nadzorcy, a nie skutkiem ubocznym zamykania bramki.

**Wymagany dowód:** sekcja w raporcie · plik `*.patch` w `evidence/` · trzy warunki przyjęcia.
**Commit po `R5`.**

---

## R6 — RAPORT I JEDNA SEKCJA REJESTRU

Raport `CODEX_DAY359_G20_ZAMKNIECIE_REPORT.md` zawiera, w tej kolejności:

1. **Każdą liczbę z tej instrukcji, którą Twój pomiar obalił** — osobną sekcją, wprost, na
   początku.
2. Tabelę `R1`: 11 mianowników, para kolumn.
3. Siedem warunków bramy wejściowej `G20` z orzeczeniem per warunek.
4. **Tabelę `R2`: 13 pozycji × 6 pól**, z licznikiem `A`/`B`/`C`.
5. Wynik `R3`: ile pozycji rozstrzygniętych, ile dowodów, kod wyjścia licznika **przed i po**,
   mianownik **przed i po**, wynik kontroli wstecznej, dowód mutacyjny bezpiecznika.
6. Tabelę `R4`: 16 wierszy `G20`, „wiersz → dowód".
7. Sekcję `R5`: problem strukturalny + warunki przyjęcia patcha.
8. **Pytania do właściciela** — po jednym, **rozstrzygalnym**, na każdą pozycję `C`. Pytanie
   rozstrzygalne ma postać wyboru z wypisanymi konsekwencjami, nie „co robimy?".
9. Co zostało niewykonane i dlaczego — imiennie.
10. `df -h /` przed i po.

Sekcja w `docs/program/REJESTR_ZNALEZISK_20260903.md` — **litera `AA`**. Sprawdzasz ją
komendą **tuż przed commitem**:
`bash -c "grep -nE '^## [A-Z]+[.]' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -5"`.
Dziś sekcje idą do `Z`, a litera `V` jest **wolna, ale zarezerwowana** — nie zajmuj jej.
Jeżeli `AA` okaże się zajęta, bierzesz pierwszą wolną dwuliterową i **zapisujesz to w raporcie**.

**Commit po `R6`.**

---

## Próg odbioru

Dyżur jest odebrany, gdy **wszystkie** poniższe są prawdziwe:

1. `node scripts/dev/p0p1-licznik-e1.mjs` (bez potoku) kończy się **`exit 0`** — **albo**
   raport wyjaśnia **imiennie**, które pozycje wymagają decyzji właściciela, z **jednym
   rozstrzygalnym pytaniem na pozycję**.
2. Każda z 13 pozycji ma w `r2-archeologia.md` wypełnione **sześć pól** i jawne rozstrzygnięcie
   `A`/`B`/`C`.
3. Każda pozycja rozstrzygnięta ma **własny commit** niosący plik dowodowy w tym samym
   `git show --stat`.
4. **Mianownik korpusu po dyżurze wynosi `121`**, a kontrola wsteczna pokazuje zmianę werdyktu
   **wyłącznie** dla pozycji, które rozstrzygnąłeś.
5. `scripts/dev/__tests__/p0p1-licznik-e1.test.mjs` zielony przed i po; **żadna funkcja
   bezpiecznika nie została zmieniona** (`git diff` na liczniku pokazuje wyłącznie
   `DAY320_RESOLUTIONS`).
6. Dowód mutacyjny bezpiecznika wykonany w obie strony, `git diff` po przywróceniu pusty.
7. Szesnaście wierszy `G20` zmienionych albo jawnie i imiennie uzasadnionych jako pozostawione;
   **ani jeden nie brzmi `PASS` ani synonimem**, ani nie ma `—` w kolumnie dowodu bez powodu.
8. `MYW-CV-REC-001` **nie została zamknięta samym SHA**.
9. `R5` ma opis, patch **nienałożony** i trzy warunki przyjęcia.
10. Liście słowników i cztery bramki identyczne przed i po; `git diff` na kodzie produktu pusty;
    kontener (jeżeli powstał) usunięty; `df -h /` przed i po w raporcie.

---

## Prawo zatrzymania

Zatrzymujesz się i piszesz **STOP** z powodem, jeżeli:

- którykolwiek z Twoich portów (`6430`, `5570`) jest zajęty — **STOP całości, nigdy podmiana**;
- `scripts/dev/p0p1-licznik-e1.mjs` albo jego test **nie istnieje** na markerze — wtedy zniknęła
  podstawa tego dyżuru i trzeba to zgłosić, a nie mierzyć inaczej;
- licznik na wejściu daje mianownik inny niż `121` — **to nie jest powód do improwizacji**,
  tylko do zapisania rozbieżności i przejścia dalej na SWOICH liczbach; STOP dopiero wtedy, gdy
  licznik w ogóle nie startuje albo mianownik jest **mniejszy niż `100`** (`DEFAULT_FLOOR`);
- realizacja `R4` wymagałaby wpisania stanu, który jest synonimem `PASS`;
- rozstrzygnięcie którejkolwiek pozycji wymagałoby zmiany funkcji bezpiecznika.

★ **Zatrzymanie z konkretnym powodem jest pełnowartościowym wynikiem dyżuru.**
Zmyślony dowód nie jest.

---

## AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para | Rozstrzygnięcie |
| --- | --- |
| „doprowadź licznik do `exit 0`" × „zakaz zmiany narzędzia, które mierzy" | `R3` — zmieniasz **dane** (`DAY320_RESOLUTIONS`), nigdy logikę; `exit 0` osiągalne wyłącznie przez rozstrzygnięcie obiektów |
| „doprowadź do `exit 0`" × „nie zamykaj bez dowodu" | Próg odbioru punkt 1 — `exit 0` **albo** imienne wyjaśnienie z pytaniem na pozycję; obie odpowiedzi pełnowartościowe |
| „wpisz 16 wierszy `G20`" × „zakaz `PASS`" | `R4` punkt 1 — stan nazywa **zakres i granicę**; `G19` = `NOT_PROVEN` jest strukturalnym sufitem i wolno go nazwać |
| „bezpiecznik sprawdza wiek" × „musi dotykać obiektu" | `R2` — bezpiecznik nie sprawdza obiektu; **obiekt jest Twoją robotą** i wchodzi do dowodu |
| „decyzja rodziny dziedziczy się mechanicznie" × „`DEC` ma obejmować pozycję imiennie" | `R2`, tabela „co jest rozstrzygnięciem" — dziedziczenie to udogodnienie odczytu, nie licencja na dopisanie `ID` do cudzej rodziny |
| „`MYW-DEC-REC-001` i `MYWORK-DEC-OWN-001` to duplikat" × „każda pozycja osobno" | `R2` — jedna archeologia, **dwa rozstrzygnięcia imienne**, jawnie nazwane jako jedna naprawa |
| „commit po każdej pozycji" × „dowód w tym samym commicie" | `R3` — dowód pozycji to **plik** w `evidence/g20/day359/pozycje/`, więc obie reguły spełnia ten sam commit |
| „opisz problem strukturalny" × „zakaz zmiany miernika" | `R5` — produktem jest **diff nienałożony** plus warunki przyjęcia; nakładanie to decyzja nadzorcy |
| „`RES-OWN-003` brak writera" × „zakaz zmiany kodu produktu" | `R2` — mierzysz i zapisujesz `plik:linia`, nie budujesz writera; brak funkcji jest wynikiem |
| „`git add -f` dla dowodów" × „zakaz binariów w repo" | `B.1` — jawna licencja na `evidence/g20/day359/**` |
| „mandat decydowania" × „pytanie do właściciela" | `R6` punkt 8 — pozycje `A`/`B` rozstrzygasz sam; `C` to obiekty, które wymagają oczu albo decyzji produktowej, i te idą do właściciela |

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności | TAK — jedenaście par, każda rozstrzygnięta w treści |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na markerze `2a7273e087`; zero `BRAK`. Oznaczone `NOWY`: `evidence/g20/day359/**`, raport, sekcja `AA` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, jedenaście wierszy; wszystkie uruchomione 04.09 na `2a7273e087` |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — każdy wiersz „tylko odczyt" ma rzeczownik-produkt (cytat · orzeczenie · wynik) |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `B.2`, kolumna 4; `R3` dotyka jednej tablicy danych, `R4` szesnastu niezależnych plików macierzy |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `B.4.4` i **`B.4.6`** (rozłączność kolumn i modułów wobec pozostałych trzech dyżurów paczki); `6430`/`5570` zmierzone jako wolne, kontener, worktree i gałąź nie istnieją. ★ 363–366 pisze równolegle inny autor — `Z7` zaostrzony: port zajęty = STOP całości |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK — wszystkie grepy przez `bash -c`, kod wyjścia licznika mierzony **bez potoku** |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu dyżurowi (siedem) | TAK — `§0.2d` w części A + siedem pułapek w polu pułapek |
| 9 | Samodzielność — zero odwołań do rozmów bez ścieżki | TAK; każdy cytat ma `plik:linia` albo ścieżkę artefaktu w repo |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK — sprawdzone przez generator, który blokuje zapis przy niespełnieniu |
