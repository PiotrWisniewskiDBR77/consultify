# INSTRUKCJA DYŻURU nr 366 — Codex — „★★★ TRZY ZASTRZEŻENIA Z ODBIORÓW 351 I 355 — KAŻDE MAŁE, WSZYSTKIE REALNE. **(1)** Dwa z miejsc licznika kompletności są bronione **asercją na tekście źródła**, nie na zachowaniu (`tests/unit/assessment/day351.assessmentCompleteness.test.ts:77-87`, `readFileSync` + `toContain`) — ten sam kształt dwa razy dziś przepuścił mutację. **(2)** `progress` na żywej trasie **dalej zwiera się kolumną `completion_percent` i statusem `APPROVED`** (`server/src/routes/assessment/assessment-hub.routes.ts:85-87` i `:94-97`) — dyżur 351 zasiał jawnie `completion_percent='0'`, więc **żadnej z tych gałęzi nie zmierzył**. **(3)** Dyżur 355 wniósł **sam raport, zero kodu**: `R3` zatrzymany, `R4`/`R5` niewykonane, a jego wniosek `R3` obalił odbiorca, bo mutacja chybiła strażnika. Zadanie: **dokończyć `R3`–`R5` z mutacją trafiającą w `server/src/services/legacyCutover/requireActiveMembership.ts` (warunek w linii 34), a nie w `auth.middleware.ts:1906`**. ★ Odbiorca zauważył też, że przebieg bazowy miał **68** przypadków, a zmutowany **62** — `financeIntelligence.membershipGate` wypadł między A i B i nikt tego nie odnotował; oba przebiegi były w 100% zielone. Porównania **po nazwach**, nigdy po liczbach"

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
> **wyłącznie** `/private/tmp/cx-day366-zastrzezenia`.

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
Zakres: **DWA OBSZARY, TRZY ZASTRZEŻENIA. Obszar pierwszy — **`04_ASSESSMENT`**: licznik kompletności ocen (`hasAssessmentResponse`, jedna definicja per drzewo) wraz z jego kontraktem testowym i z żywą trasą `assessment-hub`. Obszar drugi — **`10_FINANCE`**: dokończenie `R3`–`R5` dyżuru 355 z mutacją trafiającą we właściwego strażnika. Produktem są trzy domknięcia: asercja zachowania zamiast asercji na napisie, pomiar dwóch niezmierzonych gałęzi `progress`, oraz orzeczenie ARTEFAKT/DEFEKT dla 114 czerwieni Finansów oparte na dowodzie, który **trafia**. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, i plik postępu `/private/tmp/cx-day366-postep.md` (POZA repo)**.
Trasy front: `Front dotykasz **wyłącznie** w zakresie licznika kompletności, i **wyłącznie do odczytu**, chyba że `R1` udowodni, że asercja zachowania wymaga uchwytu, którego dziś nie ma. Miejsca: `src/components/assessment/tools/SIRIForm.tsx:143`, `src/components/assessment/tools/DRDForm.tsx:108`, `src/services/assessmentCompleteness.ts`, `src/services/drdVizAdapter.ts:59,104`, `src/services/report/drdReportModel.ts:393`. Reszta `src/**` pozostaje `TYLKO ODCZYT` bez wyjątku`. Trasy tył: `★★ SEDNO, DWA MIEJSCA. **(a) Zwarcie `progress`:** `server/src/routes/assessment/assessment-hub.routes.ts`, funkcja `computeProgressFields` — wiersze **84-92** liczą `progress` z osi, ale gałąź **85-87** (`completionPercent > 0`) omija to liczenie w całości, a wiersze **94-97** (`status === 'APPROVED'`) nadpisują zarówno `progress`, jak i `completedAxes`. **Żadna z tych dwóch gałęzi nie została zmierzona.** **(b) Strażnik członkostwa:** `server/src/services/legacyCutover/requireActiveMembership.ts` — warunek `!== 'ACTIVE'` w linii **34**, `403 ORG_MEMBERSHIP_REVOKED` w linii **35**; w tym samym pliku drugi strażnik rodziny `requireFinanceEditorMembership`. **NIE** `auth.middleware.ts:1901-1911` (`validateOrgMembership`) — to jest bliźniak o niemal identycznym zapytaniu, w który trafiła chybiona mutacja dyżuru 355. Pakiety broniące zabezpieczenia: `server/src/routes/v8/__tests__/financeValue.membershipGate.pg.test.ts` (44), `server/src/routes/v8/__tests__/financeIntelligence.membershipGate.pg.test.ts` (6), `server/src/middleware/__tests__/auditsStrictMembership.middleware.test.ts` (18) — **razem 68, i to jest mianownik, który musi być identyczny przed i po mutacji**`.

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
WT=/private/tmp/cx-day366-zastrzezenia
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
git -C "$VAULT" worktree add "$WT" -b codex/day366-zastrzezenia-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day366-zastrzezenia/config.worktree"
cat "$VAULT/worktrees/cx-day366-zastrzezenia/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day366-zastrzezenia-scratch
mkdir -p /private/tmp/cx-day366-zastrzezenia-artefakty

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
git -C "$WT" push github-backup codex/day366-zastrzezenia-20260904
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
cd "$WT"

# (1) ★★★ TEZA A: dwa z miejsc licznika kompletnosci bronione ASERCJA NA TEKSCIE ZRODLA
sed -n '77,88p' tests/unit/assessment/day351.assessmentCompleteness.test.ts
#   moje liczby: DWA bloki `it(...)` czytaja plik przez `readFileSync` i sprawdzaja
#   `expect(source).toContain(...)` / `.not.toContain(...)` — SIRIForm (77-81) i DRDForm (83-87).
#   ★ To jest ten sam ksztalt, ktory dzis DWA RAZY przepuscil mutacje: test broni NAPISU.

# (2) TEZA: licznik kompletnosci ma JEDNA definicje i wiele wolaczy — policz je sam
bash -c "grep -rn 'hasAssessmentResponse' --include=*.ts --include=*.tsx src/ server/src/ | grep -v __tests__ | grep -v 'import '"
#   moje liczby: 11 wywolan w 7 plikach produktu
#   (SIRIForm:143 · DRDForm:108 · src/services/drdVizAdapter.ts:59,104 ·
#    src/services/report/drdReportModel.ts:393 · server assessment-hub.routes.ts:64,76,78 ·
#    server/src/services/report/drdVizAdapter.ts:81,120 · server .../drdReportModel.ts:358)
#   ★ RAPORT 351 MOWI O „9 MIEJSCACH”. Mianowniki sa rozne — podaj swoj i jego definicje.

# (3) ★★★ TEZA B: `progress` na zywej trasie ZWIERA SIE kolumna i statusem — NIEZMIERZONE
sed -n '84,98p' server/src/routes/assessment/assessment-hub.routes.ts
#   moje liczby: `completionPercent > 0` (linie 85-87) OMIJA cale liczenie per os;
#   `status === 'APPROVED'` (linie 94-97) ustawia progress=100 I completedAxes=totalAxes.
#   ★ Dyzur 351 zasial jawnie `completion_percent='0'`, wiec ZADNEJ z tych galezi nie zmierzyl.

# (4) ★★★ TEZA C: strazniki o niemal identycznym ksztalcie — mutacja 355 trafila w ZLY
bash -c "grep -n \"toUpperCase() !== 'ACTIVE'\" server/src/services/legacyCutover/requireActiveMembership.ts"
sed -n '1904,1910p' server/src/middleware/auth.middleware.ts
bash -c "grep -rln 'requireActiveMembership\|requireFinanceEditorMembership' server/src/routes server/src/Gateway.ts | wc -l"
#   moje liczby: warunek strazniczy w requireActiveMembership.ts to LINIA 34 (403 w linii 35);
#   `validateOrgMembership` w auth.middleware.ts:1901-1911 ma niemal identyczne zapytanie.
#   Dyzur 355 zmutowal ten DRUGI — middleware, ktorego badane testy NIE MONTUJA.

# (5) ★★ TEZA D: przebieg bazowy 355 mial 68 przypadkow, zmutowany 62 — MIANOWNIK SIE ZMIENIL
node -e "const fs=require('fs');for(const f of ['evidence/g15/day355-artefakty/r3-gates-before.json','evidence/g15/day355-artefakty/r3-gates-mutated.json']){const r=JSON.parse(fs.readFileSync(f,'utf8'));console.log(f.split('/').pop(),'total',r.numTotalTests,'pass',r.numPassedTests,'fail',r.numFailedTests,'| pakiety:',r.testResults.map(s=>s.name.split('/').pop()).join(' '));}"
#   moje liczby: before 68/68/0 w 3 pakietach · mutated 62/62/0 w 2 pakietach
#   ★ `financeIntelligence.membershipGate.pg.test.ts` (6 przypadkow) WYPADL miedzy A i B
#   i nikt tego nie odnotowal. OBA przebiegi byly w 100% zielone — bo mutacja chybila.

# (6) TEZA: material 355 lezy w repo i jest baza porownania
ls evidence/g15/day355/ evidence/g15/day355-artefakty/
wc -l evidence/g15/day355/przed-nazwy.txt evidence/g15/day355/po347-nazwy.txt
#   moje liczby: przed-nazwy.txt i po347-nazwy.txt maja po 114 pelnych nazw;
#   `rodzina-28.md` opisuje rodzine plikow; artefaktow pomiarowych 17

# (7) TEZA: liscie slownikow i bramki kanonu na markerze
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35199, en 33066; focus=0, list=0, artefakt=0, reach=0

# (8) zasoby: dysk, porty, kontener
df -h /
lsof -nP -iTCP:6437 -sTCP:LISTEN; lsof -nP -iTCP:5577 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day366 || true
#   oczekiwane przy wydaniu: 35 GB wolnego; oba porty puste; 0 kontenerow
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day366-zastrzezenia-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6437`. Twój JEDYNY port harnessu to `5577`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day366-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki 04.09 — nie dotykasz: 363 (6434/5574), 364 (6435/5575), 365 (6436/5576). Równoległa paczka 359-362 ma zarezerwowany przedział 6430-6433 i 5570-5573 — również nie dotykasz. Starsze rodzeństwo 04.09: 351 pracował na 6410/5550, 355 na 6414/5554. Twoje własne wyłącznie: baza 6437, harness 5577. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK NOWYCH FLAG. Ten dyżur nie dodaje ani jednej flagi i nie zmienia wartości domyślnej żadnej istniejącej. ★★ UWAGA SZCZEGÓLNA: `RUN_DB_TESTS`, `MOCK_DB`, `DB_TYPE`, `ENABLE_V8_GLOBAL`, `ENABLE_TEST_AUTH_BYPASS`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE` **nie są flagami funkcyjnymi produktu** — to przełączniki trybu pomiaru. Wolno Ci nimi sterować w komendzie i **musisz zapisać, którą wartość miała każda z nich w każdym przebiegu**. **Nie wolno Ci zmieniać ich wartości domyślnych w kodzie ani w konfiguracji testów**`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/dev/reachability-from-root.mjs`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/src/middleware/auth.middleware.ts`, `server/src/services/ApiGateway.ts`, `server/src/routes/v8/__tests__/financeValue.membershipGate.pg.test.ts`, `server/src/routes/v8/__tests__/financeIntelligence.membershipGate.pg.test.ts`, `server/src/middleware/__tests__/auditsStrictMembership.middleware.test.ts`, `public/locales/**`. Wszystkie **NIETYKALNE DO ZAPISU** — wolno je wołać w pomiarze; strażnika `requireActiveMembership.ts` wolno **tymczasowo zmutować i cofnąć przez `cp`**, nie wolno zostawić w nim ani jednej zmiany w commicie`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY366_ZASTRZEZENIA_REPORT.md`. Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — sekcje doszły dziś do `Z`, więc następne idą `AA`, `AB`, … (literę sprawdzasz komendą tuż przed commitem) — oraz nowe pliki dowodowe pod `evidence/g15/day366/` i `evidence/licznik-kompletnosci-domkniecie-20260904/` (oba katalogi NIE ISTNIEJĄ na markerze — tworzysz je). ★ Do `evidence/g15/day355/` wolno **DOPISAĆ** nowe pliki (`po-nazwy.txt`, `dlug-po-naprawie.md`) — **istniejących nie nadpisujesz**. ★★★ **MACIERZ ODBIORU JEST NIETYKALNA W TYM DYŻURZE** — żaden wiersz `G00`–`G20`, żaden moduł, w tym `04_ASSESSMENT` i `10_FINANCE`; bramkami zajmują się równolegle dyżury 359-362. Plik postępu `/private/tmp/cx-day366-postep.md` żyje POZA repo. Nowe pliki w `tests/` wymagają `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day366-zastrzezenia-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day366-zastrzezenia-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ ASERCJI NA TEKŚCIE ŹRÓDŁA.** Nowy test nie może sprawdzać, że plik zawiera napis. Ma wywołać funkcję albo wyrenderować komponent i sprawdzić **wynik**. To jest cały sens zastrzeżenia (1) — `readFileSync` + `toContain` przechodzi po każdej zmianie, która zachowa napis, i nie przechodzi po żadnej, która go przeformatuje. ★★★ **ZAKAZ MUTACJI, KTÓRA NIE TRAFIA W ZABEZPIECZENIE** (`Z32`). Mutujesz `requireActiveMembership.ts` (warunek statusu), **nie** `auth.middleware.ts`. Jeżeli mutacja nie czerwieni — **NAJPIERW** sprawdzasz, czy trafiła w to, co miała trafić, i dopiero potem wolno Ci cokolwiek orzekać. Dziś dokładnie ten krok został pominięty i obalił wniosek całego dyżuru. ★★★ **ZAKAZ ZMIANY MIANOWNIKA MIĘDZY PRZEBIEGAMI.** Przebieg bazowy i zmutowany muszą mieć **tę samą listę pakietów i tę samą listę pełnych nazw**. `68 → 62` przy 100% zieleni po obu stronach **nie jest pomiarem** — to jest pakiet, który nie wystartował. ★★ **ZAKAZ WYGASZENIA BRAMKI POD POZOREM NAPRAWY.** Każda zmiana dotykająca członkostwa wymaga PARY dowodów w tym samym commicie: **(a)** użytkownik bez wiersza `ACTIVE` **nadal** dostaje `403`; **(b)** użytkownik z takim wierszem dostaje `200`/`201`. Jeden dowód bez drugiego jest wygaszeniem. ★★ **ZAKAZ NAPRAWY ZWARCIA `progress` BEZ DECYZJI.** Gałęzie `completionPercent > 0` i `status === 'APPROVED'` **mierzysz i orzekasz**; jeżeli okażą się defektem produktu, piszesz to jako pytanie do właściciela z propozycją, a nie zmieniasz zachowania trasy, z której korzystają wszystkie oceny. ★ **ZAKAZ `.skip`, `.todo`, `--retry` innego niż `0`, poszerzania `exclude`, zmiany oczekiwanego kodu odpowiedzi w asercji** (`Z35`). **ZAKAZ porównania po liczbach** (`Z37`) | Bo trzy niedomknięcia z dwóch odbiorów mają jedną wspólną cechę: **dowód, który wygląda jak dowód, a nim nie jest**. Test broniący napisu przechodzi, choć zabezpieczenie zniknęło. Pomiar, który zasiał zero w kolumnie, nie zmierzył gałęzi zależnej od tej kolumny. Mutacja w bliźniaczym pliku zostaje zielona i zostaje odczytana jako „wymaganie pomiarowo fałszywe”. **Każdy z tych trzech kształtów wystąpił dziś, każdy raz kosztował obalony wniosek, i każdy jest tani do domknięcia — o ile ktoś to zrobi teraz, zanim ktoś inny oprze na nich decyzję** |

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
cd /private/tmp/cx-day366-zastrzezenia

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day366-pg psql -U postgres -d cx366 \
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
cd /private/tmp/cx-day366-zastrzezenia

docker run -d --name cx-day366-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx366 \
  -p 127.0.0.1:6437:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day366-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6437/cx366 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6437/cx366 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day366-zastrzezenia && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6437/cx366 \
JWT_SECRET=cx366-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Testy jednostkowe frontu z roota, `RUN_DB_TESTS=0 MOCK_DB=true`. Testy serwerowe z cwd `server/` — uruchomienie z roota bez właściwego configu daje `No test files found`, co jest **BŁĘDEM KOMENDY**, nie PASS; dyżur 351 zapisał to wprost jako korektę. ★ Uwaga na wyjątek: `server/src/routes/__tests__/day351.assessment-progress.gateway.pg.test.ts` biegnie z cwd `server/`, ścieżką `src/...` i `--config vitest.config.ts`. Pakiety broniące bramki członkostwa uruchamiasz **RAZEM, w jednym wywołaniu**, na realnym PostgreSQL, z `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6437/cx366`, i **sprawdzasz, że mianownik wynosi 68 przypadków w 3 pakietach PRZED i PO**. Wszystko z `--retry=0 --reporter=json --outputFile=/private/tmp/cx-day366-zastrzezenia-artefakty/<etykieta>.json`. Porównanie 114 czerwieni Finansów robisz po pełnych nazwach (`fullName`) wobec `evidence/g15/day355/przed-nazwy.txt` — **plik istnieje i ma 114 wierszy, nie odtwarzasz go** --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day366-zastrzezenia-artefakty/day366-zastrzezenia.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day366-zastrzezenia && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Testy jednostkowe frontu z roota, `RUN_DB_TESTS=0 MOCK_DB=true`. Testy serwerowe z cwd `server/` — uruchomienie z roota bez właściwego configu daje `No test files found`, co jest **BŁĘDEM KOMENDY**, nie PASS; dyżur 351 zapisał to wprost jako korektę. ★ Uwaga na wyjątek: `server/src/routes/__tests__/day351.assessment-progress.gateway.pg.test.ts` biegnie z cwd `server/`, ścieżką `src/...` i `--config vitest.config.ts`. Pakiety broniące bramki członkostwa uruchamiasz **RAZEM, w jednym wywołaniu**, na realnym PostgreSQL, z `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6437/cx366`, i **sprawdzasz, że mianownik wynosi 68 przypadków w 3 pakietach PRZED i PO**. Wszystko z `--retry=0 --reporter=json --outputFile=/private/tmp/cx-day366-zastrzezenia-artefakty/<etykieta>.json`. Porównanie 114 czerwieni Finansów robisz po pełnych nazwach (`fullName`) wobec `evidence/g15/day355/przed-nazwy.txt` — **plik istnieje i ma 114 wierszy, nie odtwarzasz go** --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day366-zastrzezenia-artefakty/day366-zastrzezenia.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day366-zastrzezenia/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day366-pg psql -U postgres -d cx366 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day366-pg`.
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
> **(e) ★★★ **SIEDEM PUŁAPEK.** (1) **Test broni napisu, nie zachowania.** `readFileSync` + `toContain` przechodzi po każdej zmianie, która zachowa napis. Dwa razy dziś przepuścił mutację. (2) **Ziarno przesądza wynik pomiaru.** Dyżur 351 zasiał `completion_percent='0'` i przez to nie mógł zmierzyć gałęzi `completionPercent > 0`. Zanim orzekniesz, **wypisz, co dokładnie posiałeś**. (3) **Bliźniaczy strażnik.** `validateOrgMembership` (`auth.middleware.ts:1901-1911`) i `requireActiveMembership` (`legacyCutover/requireActiveMembership.ts:28-36`) mają niemal identyczne zapytanie i identyczny kod błędu. Badane testy montują ten drugi. (4) **Zmiana mianownika ukryta w zieleni.** 68 kontra 62 przypadki, oba przebiegi w 100% zielone — bo cały pakiet nie wystartował. **Porównuj listy nazw pakietów.** (5) **Atrapa bazy kłamie o zapisie**: `Database.ts:686` zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE`. Wszystko, co dotyka zapisu, wyłącznie na realnym PostgreSQL (`RUN_DB_TESTS=1 MOCK_DB=false`). (6) **`NODE_ENV=test` bez `RUN_DB_TESTS=1` podstawia atrapę pod `DbPromise`** — `pg.Pool` widzi wiersz, kod produkcyjny nie; strażnik pyta przez `DbPromise`, więc na atrapie zawsze przegra. (7) **`grep --include` w `zsh` zwraca pustkę zamiast wyników** — uruchamiaj przez `bash -c '…'` i sprawdzaj kod wyjścia; pustka nie jest wynikiem, dopóki nie wiesz, że komenda się wykonała**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day366-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day366-zastrzezenia-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarde zasady: asercja zachowania, mutacja w strażnika, mianownik identyczny, para dowodów przy członkostwie) · R1 (351 zastrzeżenie 1: dwie asercje na tekście źródła → asercje zachowania, z dowodem mutacyjnym — RDZEŃ) · R2 (351 zastrzeżenie 2: zmierzyć i orzec zwarcie `completion_percent` i `APPROVED` na żywej trasie — RDZEŃ) · R3 (355 `R3`: jedna zmiana + para dowodów + mutacja w `requireActiveMembership.ts:34`, z mianownikiem 68/3 po obu stronach — RDZEŃ) · R4 (355 `R4`: przemiar Finansów po nazwach + kontrolny przelot `09_RESULTS`) · R5 (355 `R5`: jawna liczba ARTEFAKT/DEFEKT, raport, pytania do właściciela)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6437` albo `5577` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6437` albo `5577`** (`Z7`).

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

Trzy niedomknięcia z dwóch odbiorów. Każde małe. Wszystkie realne. I wszystkie trzy mają
jedną wspólną cechę: **dowód, który wygląda jak dowód, a nim nie jest.**

**Zastrzeżenie (1) — dyżur 351.** Licznik kompletności ocen został ujednolicony do jednej
definicji per drzewo i większość miejsc jest broniona mutacją. **Ale dwa miejsca są bronione
asercją na tekście źródła:**

```text
tests/unit/assessment/day351.assessmentCompleteness.test.ts:77-87
  const source = readFileSync(resolve(process.cwd(), 'src/components/assessment/tools/SIRIForm.tsx'), 'utf8');
  expect(source).toContain('Object.values(dimensions).filter(hasAssessmentResponse).length');
  expect(source).not.toContain('(d.current > 0 || d.target > 0)');
```

To jest **ten sam kształt, który dwa razy dziś przepuścił mutację**: test broni napisu
w pliku. Przechodzi po każdej zmianie, która napis zachowa, i nie przechodzi po żadnej,
która go tylko przeformatuje. **Przepisać na asercję zachowania z dowodem mutacyjnym.**

**Zastrzeżenie (2) — dyżur 351.** `progress` na żywej trasie **dalej zwiera się kolumną
`completion_percent` i statusem `APPROVED`** — i to jest **niezmierzone**, bo ziarno dyżuru
351 miało jawnie `completion_percent='0'`:

```text
server/src/routes/assessment/assessment-hub.routes.ts, computeProgressFields
  :84-92   progress liczony z osi:  Math.round((completedAxes / totalAxes) * 100)
  :85-87   ★ ale gałąź `if (completionPercent > 0) progress = completionPercent`
           OMIJA to liczenie w całości
  :94-97   ★ oraz `if (status === 'APPROVED' && progress < 100)` nadpisuje
           progress = 100 ORAZ completedAxes = totalAxes
```

**Zmierzyć obie gałęzie i rozstrzygnąć.**

**Zastrzeżenie (3) — dyżur 355.** Dyżur wniósł **sam raport, zero kodu**: `R3` zatrzymany
merytorycznie, `R4` i `R5` niewykonane. Jego wniosek `R3` („wymaganie pomiarowo fałszywe”)
**obalił odbiorca**, bo zamówiona mutacja trafiła w `validateOrgMembership`
(`server/src/middleware/auth.middleware.ts:1901-1911`) — middleware, którego badane testy
**nie montują**. Prawdziwym strażnikiem jest
`server/src/services/legacyCutover/requireActiveMembership.ts`. Po mutacji **właściwego**
warunku pakiet zachował się tak, jak powinien:

> **GREEN 44/44 → RED 33/11 → GREEN 44/44.**
>
> **Pakiet broni bramki.**

**★★ I druga rzecz, którą zobaczył odbiorca:** przebieg bazowy miał **68** przypadków,
a zmutowany **62**. `financeIntelligence.membershipGate.pg.test.ts` (6 przypadków) **wypadł
między A i B** — i nikt tego nie odnotował. Oba przebiegi były w **100% zielone**. To nie był
pomiar; to były dwa różne pomiary porównane po liczbie.

## ★ Stan zastany, zmierzony przeze mnie na markerze `2a7273e087cbd3e44344725b524f6ddd79d5badc`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| asercje na tekście źródła | **2 bloki `it()`** | `day351.assessmentCompleteness.test.ts:77-81` (SIRIForm), `:83-87` (DRDForm) |
| wywołań `hasAssessmentResponse` w produkcie | **11 w 7 plikach** | raport 351 mówi o **9 miejscach** — **mianowniki różne, podaj swój** |
| zwarcie `progress` kolumną | `:85-87` | `completionPercent > 0` omija liczenie z osi |
| zwarcie `progress` statusem | `:94-97` | `APPROVED` ustawia `progress=100` **i** `completedAxes=totalAxes` |
| warunek strażnika członkostwa | **linia 34** (`403` w linii 35) | `legacyCutover/requireActiveMembership.ts` |
| bliźniak, w który chybiła mutacja 355 | `:1901-1911` | `auth.middleware.ts`, `validateOrgMembership` |
| przebieg bazowy 355 | **68 / 68 / 0** w **3** pakietach | `evidence/g15/day355-artefakty/r3-gates-before.json` |
| przebieg zmutowany 355 | **62 / 62 / 0** w **2** pakietach | `evidence/g15/day355-artefakty/r3-gates-mutated.json` |
| czerwienie Finansów po nazwach | **114** wierszy | `evidence/g15/day355/przed-nazwy.txt` (**istnieje — nie odtwarzasz**) |
| kubełki 355 | `403≠X` 59 · `createArtifactViaHttp` 20 · `TypeError` 31 · reszta 4 | raport 355, suma 114 |

**★ Kontekst dla dyżuru 356 — ZROBIONE I ZWERYFIKOWANE, NIE POWTARZASZ:** bezpiecznik
obliczonego dostępu do `import.meta.env` działa, bezpiecznik typów łapie brakujące
`ariaLabel`, rodzina policzona całościowo **109/109 od korzenia** (105 żywych ∧ obliczonych),
wszystkie dowody w repo. **Tego obszaru nie dotykasz i nie mierzysz ponownie.**

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: **2** asercje na tekście źródła; **11** wywołań licznika w **7** plikach
produktu (raport 351 mówi o **9 miejscach**); zwarcie `progress` w **dwóch** gałęziach
(`:85-87` i `:94-97`); warunek strażnika w linii **34**; przebiegi 355 **68/3** kontra **62/2**,
oba w 100% zielone; **114** nazw czerwieni Finansów w pliku, który już jest w repo;
liście słowników **pl 35199**, **en 33066**; cztery bezpieczniki kanonu kończą się kodem **0**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest
**ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Walidator / schematy** | `server/src/schemas/**`, `src/schemas/**` | **TYLKO ODCZYT** | Cytat wiersza + brief |
| **Trasa (montaż)** | `server/src/services/ApiGateway.ts`, `server/src/Gateway.ts`, `server/src/routes/v8/index.ts` | **TYLKO ODCZYT — WOŁASZ, NIE ZMIENIASZ.** Każde „działa” znaczy realne żądanie HTTP z **zapisanym kodem odpowiedzi** | Opis w raporcie |
| **Trasa `assessment-hub` (zwarcie `progress`)** | `server/src/routes/assessment/assessment-hub.routes.ts` | **★ TYLKO ODCZYT W `R2` — MIERZYSZ, NIE ZMIENIASZ.** Gałęzie `:85-87` i `:94-97` obsługują wszystkie oceny w produkcie; jeżeli okażą się defektem, produktem jest **pytanie do właściciela z propozycją jako diff nienałożony** | Brief z `plik:linia` + diff **nienałożony** |
| **Strażnik członkostwa (cel mutacji)** | `server/src/services/legacyCutover/requireActiveMembership.ts` | **★ WĄSKA LICENCJA NA MUTACJĘ TYMCZASOWĄ** w `R3`, z obowiązkowym cofnięciem przez `cp` ze `SCRATCH` (nigdy `git stash`, `Z27`); `git diff` po cofnięciu **pusty**. **Zakaz zostawienia jakiejkolwiek zmiany w commicie i zakaz poszerzenia dopuszczalnych statusów** | — |
| **Pozostałe middleware / model uprawnień** | `server/src/middleware/**` (w tym `auth.middleware.ts`) | **NIETYKALNE DO ZAPISU** (`Z12`). Wolno CZYTAĆ — i musisz, żeby pokazać różnicę wobec właściwego strażnika | Brief |
| **Testy tras / pakiety Finansów** | `server/src/routes/v8/finance-v2/__tests__/**`, `server/src/services/finance/__tests__/**` | **★ WĄSKA LICENCJA POD WARUNKIEM `R3`:** wolno **dopisać seed** wiersza `organization_members` w `beforeAll`, dokładnie w formie skopiowanej z pliku, który dziś jest zielony — jeżeli `R3` wskaże to jako właściwą drogę. **Zakaz zmiany progu, usuwania asercji, zawężania zakresu i zmiany oczekiwanego kodu odpowiedzi** (`Z35`) | — |
| **Pakiety broniące bramki** | `financeValue.membershipGate.pg.test.ts`, `financeIntelligence.membershipGate.pg.test.ts`, `auditsStrictMembership.middleware.test.ts` | **NIETYKALNE DO ZAPISU.** Wolno **uruchamiać** i **musisz** uruchomić PRZED i PO, **razem, w jednym wywołaniu**, z kontrolą mianownika **68 w 3 pakietach** | Wynik do raportu |
| **Kontrakt licznika kompletności** | `tests/unit/assessment/day351.assessmentCompleteness.test.ts` | **★ PEŁNA LICENCJA na przepisanie dwóch bloków `it()` (`:77-87`) na asercję zachowania.** **Zakaz osłabienia pozostałych asercji i zakaz usunięcia którejkolwiek pełnej nazwy** | — |
| **Definicja licznika** | `src/services/assessmentCompleteness.ts`, `server/src/services/report/assessmentCompleteness.ts` | **TYLKO ODCZYT** — jedna definicja per drzewo jest wynikiem 351 i zostaje | Brief |
| **Wołacze licznika** | `src/components/assessment/tools/{SIRIForm,DRDForm}.tsx`, `src/services/drdVizAdapter.ts`, `src/services/report/drdReportModel.ts`, `server/src/services/report/{drdVizAdapter,drdReportModel}.ts` | **★ WĄSKA LICENCJA:** wolno dodać **uchwyt pomiarowy** (`data-testid`/eksport funkcji), jeżeli `R1` udowodni, że asercja zachowania inaczej jest niewykonalna. **Zakaz zmiany logiki liczenia** | Brief z `plik:linia` |
| **Nowe testy** | `tests/**` (nowe pliki, `git add -f`) | **★ PEŁNA LICENCJA.** **Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`** | — |
| **Produkt UI poza licznikiem** | `src/**` | **TYLKO ODCZYT** | Opis w raporcie |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY.** Globalny `vi.mock` strażnika w tych plikach = wygaszenie zabezpieczenia dla całego korpusu | Opis w raporcie |
| **Słowniki** | `public/locales/**` | **NIETYKALNE DO ZAPISU.** Liście nie mogą zmaleć | Opis w raporcie |
| **Dowody 351 / 355 / 356** | `evidence/licznik-kompletnosci-20260904/**`, `evidence/g15/day355*/**` (istniejące pliki), `evidence/g15/day347/**`, dowody 356 | **TYLKO ODCZYT dla istniejących plików.** Do `evidence/g15/day355/` wolno **DOPISAĆ** nowe nazwy (`po-nazwy.txt`, `dlug-po-naprawie.md`) | — |
| **Nowe dowody** | `evidence/g15/day366/**`, `evidence/licznik-kompletnosci-domkniecie-20260904/**` (**oba NIE ISTNIEJĄ — tworzysz**) | **★ PEŁNA LICENCJA**; commitujesz przez `git add -f` | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU — ŻADEN wiersz, ŻADEN moduł**, w tym `04_ASSESSMENT` i `10_FINANCE` | Rekomendacja w raporcie |
| **Rejestry bramek** | `REJESTR_G15_SAMOKONTROLA_20260903.md`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md` | **TYLKO ODCZYT** — zajmują się nimi dyżury 359-362 | Rekomendacja w raporcie |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze** (`AA`, `AB`, …), sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY366_ZASTRZEZENIA_REPORT.md` (**NOWY**) | `R5` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `evidence/g15/day336-artefakty/**` i orzekanie o dziesięciu wierszach `G15` (dyżur 363) · `src/store/useToolStore.ts`, `src/components/DiscoveryTools/**`, `scripts/dev/check-etykiety-dwujezyczne*`, `scripts/dev/i18n-pl-audyt.mjs` (dyżur 364) · `src/components/standard/StandardPreview.tsx`, `src/components/Economics/FinancePreviewPanel.tsx`, `scripts/dev/grafika-zrzuty.mjs`, `evidence/podglad-relations-20260904/**` (dyżur 365) · rodzina `import.meta.env` i `ariaLabel` (dyżur 356 — **zrobione**) · wiersze macierzy i rejestry bramek (dyżury 359-362) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35199, en 33066

# (b) cztery bezpieczniki maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: wszystkie 0
```

**Jeżeli którakolwiek liczba zmaleje albo bramka zaczerwieni się od Twojej zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | asercji na tekście źródła | `2` bloki `it()` | komenda (1) z `§0.3` | TAK — czyta plik testu, nie raport |
| 2 | wywołań licznika w produkcie | `11` w `7` plikach | komenda (2) | TAK — **raport 351 mówi „9 miejsc”; podaj definicję swojego mianownika** |
| 3 | gałęzi zwierających `progress` | `2` (`:85-87`, `:94-97`) | komenda (3) | TAK — czyta kod trasy |
| 4 | linia warunku strażnika | `34` (`403` w `35`) | komenda (4) | TAK |
| 5 | pliki montujące strażnika | — | komenda (4) | TAK — **to jest dowód, że mutacja ma szansę trafić** |
| 6 | mianownik przebiegów 355 | `68/3` kontra `62/2` | komenda (5) | TAK — **i tu jest defekt pomiaru, nie produktu** |
| 7 | czerwienie Finansów po nazwach | `114` | komenda (6) | TAK — plik istnieje, nie odtwarzasz |
| 8 | kubełki 114 czerwieni | `59/20/31/4` | raport 355 + własny odczyt JSON | TAK — suma ma się zgadzać ze 114, sprawdź jawnie |
| 9 | czerwienie PO zmianie | — | przemiar `R4`, po **nazwach** | TAK — `Z37`: liczba bez nazw nie jest wynikiem |
| 10 | kontrolny `09_RESULTS` | — | przemiar `R4` | TAK — dowód, że nie zgasiłeś naprawy 347 |
| 11 | ZASTANA / REGRESJA dla tego, co zostaje | — | ta sama `fullName` po obu stronach | TAK — **tylko jeżeli baza się skompilowała** |
| 12 | liście słowników PL/EN | `35199` / `33066` | blok (a) „WARUNKÓW WSPÓLNYCH” | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY366_ZASTRZEZENIA_REPORT.md` ·
`evidence/g15/day366/**` · `evidence/licznik-kompletnosci-domkniecie-20260904/**` (oba nowe) ·
`tests/unit/assessment/day351.assessmentCompleteness.test.ts` (przepisane dwa bloki `it()`).

**Zapisujesz WARUNKOWO:**
serwerowe testy `10_FINANCE` (wyłącznie seed w `beforeAll`, z dowodem `R3`) ·
uchwyt pomiarowy w wołaczu licznika (wyłącznie z dowodem `R1`) ·
nowe pliki testowe w `tests/` (`git add -f`) ·
nowe nazwy w `evidence/g15/day355/` (`po-nazwy.txt`, `dlug-po-naprawie.md`) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `public/locales/**`,
`server/src/routes/assessment/assessment-hub.routes.ts`,
`server/src/middleware/**`, `server/src/services/ApiGateway.ts`,
`server/src/services/legacyCutover/requireActiveMembership.ts` (mutacja `R3` jest tymczasowa
i cofnięta), `src/services/assessmentCompleteness.ts`,
`server/src/services/report/assessmentCompleteness.ts`,
pakiety broniące bramki, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`,
`vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/migrations/**`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (**wszystkie 16**),
`REJESTR_G15_SAMOKONTROLA_20260903.md`, **istniejące** pliki w
`evidence/licznik-kompletnosci-20260904/`, `evidence/g15/day355*/`, `evidence/g15/day347/`,
`src/store/useToolStore.ts`, `src/components/standard/StandardPreview.tsx`,
`scripts/dev/grafika-zrzuty.mjs`, `scripts/dev/check-etykiety-dwujezyczne*`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day366-zastrzezenia
git diff --name-only --cached | tee /private/tmp/cx-day366-zastrzezenia-artefakty/staged.txt
bash -c "grep -iE '^public/locales/|assessment-hub\.routes|^server/src/middleware/|ApiGateway|requireActiveMembership|assessmentCompleteness\.ts|membershipGate|auditsStrictMembership|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|MODULE_ACCEPTANCE|REJESTR_G15|useToolStore|StandardPreview|grafika-zrzuty|check-etykiety' /private/tmp/cx-day366-zastrzezenia-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
# ★ osobno: zaden ISTNIEJACY plik dowodowy 347/351/355 nie moze byc zmodyfikowany
git diff --name-status --cached -- evidence/g15/day347 evidence/g15/day355 evidence/g15/day355-artefakty evidence/licznik-kompletnosci-20260904 | grep -v '^A' \
  && echo "★★ NADPISUJESZ CUDZY DOWOD — COFNIJ" || echo "cudze dowody nietkniete"
```

---

## R0 — CZTERY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Asercja na ZACHOWANIU, nigdy na tekście źródła.** Nowy test wywołuje funkcję albo
renderuje komponent i sprawdza wynik. `readFileSync` + `toContain` nie jest dowodem — to jest
sprawdzenie, czy ktoś nie przeformatował pliku.

**(2) Mutacja celuje w ZABEZPIECZENIE, nie w mechanizm** (`Z32`). Mutujesz
`requireActiveMembership.ts`, nie `auth.middleware.ts`. Jeżeli mutacja nie czerwieni —
**NAJPIERW** sprawdzasz, czy trafiła w to, co miała trafić, i dopiero potem wolno Ci orzekać.
Dziś dokładnie ten krok został pominięty i obalił wniosek całego dyżuru.

**(3) Mianownik po obu stronach musi być IDENTYCZNY.** Porównujesz **listy pakietów i listy
pełnych nazw**, nie `numFailedTests`. `68 → 62` przy 100% zieleni po obu stronach nie jest
pomiarem.

**(4) Każda zmiana dotykająca członkostwa wymaga PARY dowodów w tym samym commicie:**
**(a)** użytkownik bez wiersza `ACTIVE` w `organization_members` **nadal** dostaje `403`;
**(b)** użytkownik z takim wierszem dostaje `200`/`201`. Jeden bez drugiego jest wygaszeniem
zabezpieczenia, nie naprawą.

**Wymagany dowód:** cztery zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — DWIE ASERCJE NA TEKŚCIE ŹRÓDŁA → ASERCJE ZACHOWANIA (rdzeń)

1. **Pokaż defekt.** Zmutuj `SIRIForm.tsx:143` tak, żeby licznik znów liczył „cel bez
   odpowiedzi” (na przykład wróć do kształtu `(d.current > 0 || d.target > 0)`), **ale zachowaj
   w pliku napis, którego szuka dzisiejszy test** — na przykład w komentarzu albo w martwej
   stałej. **Dzisiejszy test ma pozostać ZIELONY.** To jest dowód, że broni napisu, nie
   zachowania. Zapisz komendę i wynik dosłownie.
2. **Przepisz oba bloki `it()`** (`:77-81` i `:83-87`) na asercję zachowania: wywołaj logikę
   liczenia dla danych `target-only` i dla danych z odpowiedzią, i sprawdź **liczby**, nie
   napisy. Jeżeli logika jest zamknięta w komponencie i nie da się jej wywołać — **wtedy,
   i tylko wtedy**, wolno Ci dodać uchwyt pomiarowy w wołaczu (`data-testid` albo eksport
   czystej funkcji), i piszesz w raporcie, dlaczego było to konieczne.
3. **Powtórz mutację z punktu 1 na NOWYM teście** — ma **zaczerwienić się** i wskazać nazwę
   przypadku; cofnij przez `cp` ze `SCRATCH` → ma **zzielenieć**; `git diff` po cofnięciu
   **pusty**.
4. **Nie osłabiasz reszty pakietu.** Porównaj listy pełnych nazw przed i po: **żadna nazwa
   nie ma zniknąć**, liczba `numTotalTests` nie ma zmaleć.
5. **KROK 0 dla rodziny:** policz wszystkie wołacze `hasAssessmentResponse` w produkcie
   i powiedz, ile z nich ma dziś ochronę **zachowaniem**, ile **napisem**, a ile **żadnej**.
   Moja liczba: **11 wywołań w 7 plikach**; raport 351 mówi o **9 miejscach** —
   **podaj swój mianownik i jego definicję.**

**Wymagany dowód:** dosłowna komenda i wynik mutacji, która przeszła przez STARY test ·
diff przepisanych bloków · mutacja na NOWYM teście w obie strony · `diff` list pełnych nazw ·
tabela rodziny wołaczy z kolumną „ochrona: zachowanie / napis / brak”. **Commit po `R1`.**

## R2 — ZWARCIE `progress`: ZMIERZYĆ I ORZEC (rdzeń)

**Mierzysz. Nie naprawiasz.** Ta trasa obsługuje wszystkie oceny w produkcie.

1. **Postaw kontener** `cx-day366-pg` na porcie `6437`, baza `cx366`, migracje wg `§0.2c` (A) —
   **dwa przebiegi**, drugi bezbłędny i bez zmian (idempotencja). `pgvector/pgvector:pg16`;
   `postgres:15` **nie przechodzi migracji**.
2. **Zasiej TRZY oceny, nie jedną**, i **wypisz w raporcie, co dokładnie posiałeś**
   (to jest ta pułapka, na której stanął 351):
   - (i) `completion_percent = 0`, `status != 'APPROVED'`, 7 z 39 osi wypełnionych;
   - (ii) `completion_percent = 100`, ale **tylko 7 z 39 osi** wypełnionych — gałąź `:85-87`;
   - (iii) `status = 'APPROVED'`, `completion_percent = 0`, **7 z 39 osi** — gałąź `:94-97`.
3. **Uderz w żywą trasę** przez realny `ApiGateway`, z podpisanym JWT, na Twoim PostgreSQL
   po pełnych migracjach, i **zapisz kod odpowiedzi oraz zwrócone `progress`, `completedAxes`,
   `totalAxes`** dla każdej z trzech ocen (`Z34`).
4. **Orzeknij per gałąź**, jednym z trzech werdyktów:
   - `ZGODNE Z INTENCJĄ` — kolumna jest cache'em prawdy i wolno jej wierzyć; uzasadnij czym;
   - `DEFEKT` — trasa pokazuje 100% dla oceny wypełnionej w 18%; **to jest kłamstwo licznika
     dla użytkownika** i idzie do pytania do właściciela z propozycją jako **diff nienałożony**;
   - `NIEORZECZONY` — z podaniem, czego zabrakło.
5. **Sprawdź, kto ustawia `completion_percent`.** Jeżeli kolumnę zapisuje ta sama logika,
   która liczy osie — zwarcie jest nieszkodliwe. Jeżeli zapisuje ją coś innego (import,
   migracja, stary kod) — zwarcie jest realnym ryzykiem. **Podaj `plik:linia` każdego
   zapisu tej kolumny.**
6. **Kontrola mianownika:** `numTotalTests` każdego przebiegu. Przebieg z zerem wykonanych
   przypadków kończy się `exit 0` i **nie jest pomiarem**. `No test files found`
   i `Transform failed` to **BŁĄD KOMENDY**.

**Wymagany dowód:** log obu przebiegów migracji · opis trzech ziaren dosłownie · trzy odpowiedzi
HTTP z kodami i wartościami `progress`/`completedAxes` · werdykt per gałąź · lista `plik:linia`
zapisów `completion_percent`. **Commit po `R2`.**

## R3 — DOKOŃCZENIE `R3` DYŻURU 355: MUTACJA, KTÓRA TRAFIA (rdzeń)

**To jest pozycja, w której dyżur 355 poległ. Przeczytaj ją dwa razy.**

1. **Przebieg BAZOWY.** Uruchom **razem, w jednym wywołaniu**, na realnym PostgreSQL:
   `server/src/routes/v8/__tests__/financeValue.membershipGate.pg.test.ts`,
   `server/src/routes/v8/__tests__/financeIntelligence.membershipGate.pg.test.ts`,
   `server/src/middleware/__tests__/auditsStrictMembership.middleware.test.ts`.
   **Zapisz `numTotalTests`, listę pakietów i listę pełnych nazw.** Wartość wzorcowa:
   **68 przypadków w 3 pakietach**. **Jeżeli Twój przebieg da mniej pakietów — zatrzymujesz
   się tutaj**, zanim cokolwiek zmutujesz, i piszesz dlaczego.
2. **Mutacja celująca w strażnika.** W `server/src/services/legacyCutover/requireActiveMembership.ts`
   zmień warunek statusu (linia **34** — potwierdź numer sam) tak, żeby zabezpieczenie
   przestało odrzucać. **Cel: obcy PRZESTAJE dostawać `403`.**
3. **Przebieg ZMUTOWANY — tym samym wywołaniem, bez zmiany zakresu.** Porównaj **listę
   pakietów i listę nazw**. Oczekiwany kształt: **RED, z tym samym mianownikiem 68 w 3
   pakietach**. Wynik zmierzony przez odbiorcę na samym `financeValue.membershipGate`:
   **GREEN 44/44 → RED 33/11 → GREEN 44/44**.
4. **Cofnięcie przez `cp`** ze `SCRATCH`; `git diff` po cofnięciu **pusty**; przebieg końcowy
   **zielony, z tym samym mianownikiem**.
5. **Drugi strażnik rodziny.** `requireFinanceEditorMembership` mieszka w tym samym pliku
   i ma dodatkowy warunek roli. **Powiedz, czy Twoja mutacja go obejmowała** — praca
   per wywołanie zamiast per rodzina daje „poprawne w 2 z 3”.
6. **JEDNA zmiana, uzasadniona.** Dopiero po udowodnionej mutacji wybierasz drogę i wypisujesz,
   co odrzuciłeś i dlaczego:
   - **(A)** seed wiersza `organization_members` w `beforeAll` pakietów, które są kontraktami
     HTTP — w formie skopiowanej z pliku, który dziś jest zielony;
   - **(B)** wspólny pomocnik seedujący — **tylko jeżeli forma jest identyczna we wszystkich
     plikach**, co masz wykazać;
   - **(C)** zgłoszenie REALNEGO DEFEKTU jako briefu z diffem **nienałożonym**, bez zmiany
     kodu produktu;
   - **(D)** cokolwiek innego, co pomiar wskaże.
7. **Para dowodów, obowiązkowa, w tym samym commicie:** **(a)** obcy bez wiersza `ACTIVE`
   **nadal** `403` — na realnym PostgreSQL; **(b)** właściciel z wierszem `ACTIVE` dostaje
   `200`/`201` — realne żądanie HTTP przez realny `ApiGateway`, z podpisanym JWT,
   **z zapisanym kodem odpowiedzi** (`Z34`).
   ★ Uwaga na FK: sam `INSERT organization_members` bez użytkownika zatrzymuje `beforeAll`
   na `organization_members_user_id_fkey` i wszystkie przypadki lecą jako `skipped` —
   dyżur 355 to zmierzył; siej **użytkownika i członkostwo**.

**Wymagany dowód:** dwa JSON-y (bazowy i zmutowany) z `numTotalTests` i listą pakietów ·
`diff` list pełnych nazw · dosłowna komenda mutacji i cofnięcia · `git diff` pusty ·
JSON końcowy zielony · zdanie o drugim strażniku · opis wybranej drogi z odrzuceniem
pozostałych · para „obcy `403` / właściciel `200`” z kodami. **Commit po `R3`.**

## R4 — PRZEMIAR FINANSÓW PO NAZWACH I KONTROLNY PRZELOT RESULTS

1. Uruchom **cały** `10_FINANCE` tym samym wariantem, którym mierzył dyżur 336 (poza świadomie
   zmienionym elementem z `R3`), `--retry=0 --reporter=json`.
2. **Kontrolnie uruchom `09_RESULTS`** — dowód, że nie zgasiłeś tego, co naprawił dyżur 347
   (413 → 12 czerwieni).
3. Zapisz `evidence/g15/day355/po-nazwy.txt` (**nowa nazwa — nie nadpisujesz
   `przed-nazwy.txt` ani `po347-nazwy.txt`**) i zrób
   `diff evidence/g15/day355/przed-nazwy.txt evidence/g15/day355/po-nazwy.txt`.
4. **Tabela główna:** trzy kolumny — **nazwy, które zniknęły**, **nazwy, które zostały**,
   **nazwy, które się POJAWIŁY** (każda pojawiona wymaga wyjaśnienia albo STOP-u).
5. **Podaj `numTotalTests`, nie tylko `numFailedTests`.**
6. **ZASTANA kontra REGRESJA dla tego, co zostaje.** Worktree bazowy w
   `/private/tmp/cx-day366-zastrzezenia-artefakty/baza` (POZA repo, `Z13`). **Zanim cokolwiek
   uruchomisz — udowodnij, że baza się kompiluje** (`npx esbuild` na mierzonych plikach);
   `Transform failed` jest błędem komendy, nie wynikiem; baza, na której plik wykonał zero
   przypadków, **nie jest bazą**. Skasuj worktree po pomiarze; `df -h /` przed i po.

**Wymagany dowód:** `po-nazwy.txt` · pełny `diff` · tabela trzech kolumn · `numTotalTests`
każdego przebiegu · wynik kontrolny `09_RESULTS` · dowód kompilowalności bazy · `df -h /`
przed i po · potwierdzenie skasowania worktree. **Commit po `R4`.**

## R5 — JAWNA LICZBA, RAPORT I PYTANIA DO WŁAŚCICIELA

Raport zawiera: dowód, że stary test przepuszczał mutację, i diff przepisanych asercji z `R1` ·
werdykt per gałąź zwarcia `progress` z `R2`, z trzema odpowiedziami HTTP · mutację z `R3`
w obie strony **z mianownikiem po obu stronach** · opis JEDNEJ zmiany z uzasadnieniem
odrzucenia pozostałych dróg · parę „obcy `403` / właściciel `200`” · tabelę „przed / po”
po nazwach z `R4` · listę rozbieżności wobec liczb tej instrukcji · **niepustą sekcję
„TWIERDZENIA NIEZWERYFIKOWANE”** · obowiązkowy akapit `§0.2e` dla każdego uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „JAWNA LICZBA — ARTEFAKT KONTRA REALNY DEFEKT”.**
„Ze 114 czerwieni Finansów zniknęło N, zostaje M, z czego K to realne defekty produktu
wymagające osobnego dyżuru — i oto ich nazwy.” **Bez listy nazw to nie jest wynik** (`Z37`).
Jeżeli Twój pomiar potwierdzi wniosek 355 (114 artefakt / 0 defekt) — napisz to wprost
**wraz z dowodem mutacyjnym, którego 355 nie miał**. Jeżeli obali — tym lepiej.

★★ **Osobna, obowiązkowa sekcja: „CO NADAL WYMAGA OSOBNEGO ZLECENIA”.** Każdy plik
sklasyfikowany jako REALNY DEFEKT z nazwy, z liczbą czerwieni i jednozdaniowym opisem, czego
brakuje w produkcie. Tu trafia też luka dowodowa nazwana przez 355: samowystarczalny kontrakt
przez realny `ApiGateway`, który broni zarówno braku wiersza, jak i statusu `REVOKED`,
oraz odtwarzalna fikstura dla `day116-approved-valuation-wacc-conflict.realpg.test.ts`.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA”.** Pierwsze pytanie jest znane
z `R2`: czy `progress` ma wierzyć kolumnie `completion_percent` i statusowi `APPROVED`
wbrew policzonym osiom — **tak/nie**. Drugie, jeżeli je zobaczysz, z `R3`. Sekcja **nie może
być pusta** — pytanie z `R2` jest w niej obowiązkowo.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sekcje doszły dziś do `Z`, więc następne idą
`AA`, `AB`, …; sprawdź komendą
`bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle piszą inni autorzy.

**Commit po `R5`.**

## Próg odbioru

**Trzy zastrzeżenia domknięte: dwie asercje przepisane na zachowanie z dowodem, że stary test
przepuszczał mutację; dwie gałęzie zwarcia `progress` zmierzone na żywej trasie i orzeczone;
`R3`–`R5` dyżuru 355 dokończone z mutacją, która TRAFIA w `requireActiveMembership.ts`,
przy mianowniku identycznym po obu stronach — i z jawną liczbą ARTEFAKT/REALNY DEFEKT
podaną z nazwami.**

Odbiorca odrzuci dyżur, w którym: nowy test nadal sprawdza tekst źródła; mutacja nie
zaczerwieniła i nie sprawdzono, czy trafiła; przebiegi bazowy i zmutowany mają różną liczbę
pakietów; zmieniono zachowanie trasy `assessment-hub` zamiast je zmierzyć; porównanie jest
po liczbach zamiast po nazwach; albo zmienił się stan choćby jednego wiersza macierzy odbioru.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „dwie asercje przepisane
i udowodnione mutacyjnie, zwarcie `progress` zmierzone i orzeczone jako defekt, `R3`
zatrzymany, bo wymaga decyzji właściciela o drodze naprawy” — **jest pełnowartościowym
wynikiem**, nawet jeżeli ani jedna czerwień Finansów nie zgaśnie.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Przepisz test na zachowanie” vs „nie zmieniaj logiki produktu” | `R1` punkt 2: uchwyt pomiarowy wolno dodać **tylko** gdy asercja zachowania inaczej jest niewykonalna, i piszesz dlaczego; logika liczenia zostaje |
| „Zmierz zwarcie `progress`” vs „trasa jest nietykalna” | Tabela licencji i `R2`: **mierzysz przez HTTP, nie zmieniasz kodu**; propozycja idzie jako diff nienałożony i pytanie do właściciela |
| „Strażnik nietykalny (`Z12`)” vs „zmutuj strażnika” | Tabela licencji: wąska licencja na mutację TYMCZASOWĄ z obowiązkowym cofnięciem przez `cp` i pustym `git diff`; `auth.middleware.ts` zostaje nietykalny |
| „Napraw 114 czerwieni” vs „zakaz wygaszania bramki” | `R0` (4) i `R3` punkt 7: naprawa wymaga PARY dowodów — obcy nadal `403`, właściciel `200` |
| „Mutacja ma zaczerwienić” vs „a jeśli nie zaczerwieni” | `R0` (2) i `R3`: najpierw sprawdzasz, czy trafiła; dopiero potem orzekasz. Obalenie jest wynikiem, ale **po** sprawdzeniu celu |
| „Uruchom pakiety bramkowe” vs „są nietykalne” | Tabela licencji: nietykalne **do zapisu**; uruchamianie jest jawnie zamówione i obowiązkowe przed i po |
| „Zmierz spadek” vs `Z37` | `R4` punkty 3-4: `po-nazwy.txt` i `diff` wobec istniejącego `przed-nazwy.txt`; produktem jest lista nazw |
| „Dopisz do `evidence/g15/day355/`” vs „cudze dowody są nietykalne” | Sekcja o dokumentach i kontrola commita: **dopisujesz nowe nazwy**, nie modyfikujesz istniejących; kontrola `git diff --name-status` to wymusza |
| „Worktree bazowy ułatwia dowód” vs `Z13` i próg 5 GB | `R4` punkt 6: worktree bazowy leży **poza repo**, jest kasowany po pomiarze, `df -h /` przed i po |
| „351 mówi 9 miejsc” vs „mój pomiar daje 11 wywołań” | Mianownik #2 i `R1` punkt 5: podajesz swój mianownik **i jego definicję**; rozbieżność zapisujesz wprost |
| „Aktualizuj macierz i rejestr G15” vs „oba nietykalne” | Tabela licencji: bramkami zajmują się dyżury 359-362; Twoim produktem jest rekomendacja |
| „Dopisz sekcję do rejestru znalezisk” vs „równolegle piszą inni autorzy” | `R5`: literę sprawdzasz komendą tuż przed commitem; sekcje doszły do `Z`, następne to `AA`, `AB` |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 12 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — `day351.assessmentCompleteness.test.ts:77-87`, `assessment-hub.routes.ts:84-97`, `requireActiveMembership.ts:34-35`, `auth.middleware.ts:1901-1911`, trzy pakiety bramkowe, `evidence/g15/day355/przed-nazwy.txt` (114 wierszy), `evidence/licznik-kompletnosci-20260904/` (4 pliki) sprawdzone; `evidence/g15/day366/` i `evidence/licznik-kompletnosci-domkniecie-20260904/` **jawnie oznaczone jako nieistniejące** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1-8 i 12 zmierzone przy wydaniu na markerze |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — walidator · montaż · trasa `assessment-hub` · strażnik · pozostałe middleware · testy tras Finansów · pakiety bramkowe · kontrakt licznika · definicja licznika · wołacze licznika · nowe testy · UI · infrastruktura testów · słowniki · dowody 351/355/356 · nowe dowody · macierz · rejestry bramek · rejestr znalezisk · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` dotyka jednego pliku testu, `R2` tylko mierzy, `R3` mutuje jeden warunek, `R4` mierzy, `R5` składa |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6437/5577 wolne (`lsof` przy wydaniu), brak kontenera `cx-day366-pg`, brak gałęzi `codex/day366-*` i worktree; 363/364/365 mają rozłączne porty i pliki; paczka 359-362 ma zarezerwowany przedział 6430-6433/5570-5573 i rozłączny temat |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: test broni napisu, ziarno przesądza wynik, bliźniaczy strażnik, zmiana mianownika w zieleni, atrapa bazy, `NODE_ENV=test` bez `RUN_DB_TESTS`, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany”, zero pól szablonu | TAK — kontrola generatora przy wydaniu |
