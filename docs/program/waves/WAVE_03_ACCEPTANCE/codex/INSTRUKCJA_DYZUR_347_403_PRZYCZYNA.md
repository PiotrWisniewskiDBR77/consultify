# INSTRUKCJA DYŻURU nr 347 — Codex — „★★★ 542 CZERWIENIE SERWEROWE TO JEDNA PRZYCZYNA, NIE 413 DEFEKTÓW — ZNALEŹĆ JĄ, NAPRAWIĆ RAZ, POKAZAĆ ILE ZNIKNĘŁO. Dyżur 336 zmierzył warstwę serwerową 15 modułów i zapisał wynik do repo: **1825 przypadków, 1153 zielone, 542 czerwone** (`evidence/g15/day336-artefakty/`, 63 pliki JSON). ★★ Mój pomiar z tych plików: **415 z 542 czerwieni (76,6%) ma JEDEN kształt — `expected 403 to be X`**; w module `09_RESULTS` to **356 z 413**, w `10_FINANCE` **59 z 114**. Rozbicie w `09`: `124× 403≠200`, `75× 403≠404`, `72× 403≠409`, `47× 403≠400`, `36× 403≠201`. Jeden plik `server/src/routes/resultsVnext/__tests__/okr.routes.test.ts` daje **118/118 FAIL**, a dziesięć jego rodzeństw pada w całości (`kpi` 33/33, `roiForecastActual` 27/27, `okrReview` 27/27, `kpiScorecard` 27/27, `roiPir` 26/26, `roi` 26/26, `roiCaseApproval` 22/22, `kpiDeviation` 21/21, `roiBenefitsRealization` 15/15, `roiEconomicModel` 14/14). Odbiorca 336 sprawdził, czy to sprawka obejścia logowania: `ENABLE_TEST_AUTH_BYPASS=false` → 118 FAIL, `=true` → **też 118 FAIL** — więc przyczyna leży POZA uwierzytelnianiem. ★ Jego zdanie, które jest sensem tego dyżuru: **kto zaplanuje 542 naprawy, zaplanuje pracę, której nie ma**. Zadaniem jest znaleźć przyczynę źródłową, naprawić ją **RAZ** i pokazać liczbowo, ile czerwieni zniknęło — a nie naprawiać po jednym teście"

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
> **wyłącznie** `/private/tmp/cx-day347-403-przyczyna`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `6a4919f72db338e7f49a2cacb3787d20cc649883`**
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
Zakres: **PRZEKROJOWE — warstwa serwerowa modułów `09_RESULTS` i `10_FINANCE` (tam mieszka 415 z 415 czerwieni o kształcie `403`), z kontrolnym przelotem po pozostałych 13 modułach zmierzonych przez dyżur 336. Przedmiotem pracy jest **JEDNA przyczyna źródłowa i JEDNA naprawa**, oraz rozstrzygnięcie, ile z 542 czerwieni to **dług ZASTANY**, a ile **REGRESJA** — porównanie WYŁĄCZNIE po pełnych nazwach przypadków (`fullName`), nigdy po liczbach. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, i plikiem postępu `/private/tmp/cx-day347-postep.md` (poza repo)**.
Trasy front: `Ten dyżur **nie dotyka frontu**. Jedyny kontakt z `src/`: odczyt, gdyby czerwień serwerowa okazała się skutkiem kontraktu UI — wtedy piszesz o tym w raporcie i idziesz dalej. Pliki frontowe pozostają `TYLKO ODCZYT` bez wyjątku`. Trasy tył: `★★ SEDNO. Podejrzana bramka: `server/src/middleware/resultsInternalBetaVisibility.middleware.ts` (wiersze 26-32 opt-out, 38-44 pierwsze `403`, 49-66 zapytanie o członkostwo i drugie `403`, 68-74 `catch` → `503`). Pakiety, które padają: `server/src/routes/resultsVnext/__tests__/**` (19 plików testowych, z tego 11 pada w CAŁOŚCI) oraz serwerowe testy `10_FINANCE` — `server/src/routes/v8/finance-v2/__tests__/**`, `server/src/services/finance/__tests__/**`. Trasy produktu, które te testy montują: `server/src/routes/resultsVnext/{okr,kpi,roi,kpiScorecard,kpiPerspectives,kpiDeviation,search,kpiRecoveryChildren,roiPerspectives,okrLegacyArchive,roiLegacyArchive,kpiLegacyArchive}.routes.ts`. Koperta bramki ma WŁASNY, osobny dowód na zamontowanym gateway'u: `tests/acceptance/res-internal-beta-visibility.mounted.pg.test.ts` oraz pięć plików `tests/integration/results/day46.*.realpg.test.ts` — **to jest miejsce, w którym zabezpieczenie ma być bronione, i ono musi zostać zielone po Twojej naprawie**`.

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
WT=/private/tmp/cx-day347-403-przyczyna
MARKER=6a4919f72db338e7f49a2cacb3787d20cc649883

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day347-403-przyczyna-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day347-403-przyczyna/config.worktree"
cat "$VAULT/worktrees/cx-day347-403-przyczyna/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day347-403-przyczyna-scratch
mkdir -p /private/tmp/cx-day347-403-przyczyna-artefakty

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
git -C "$VAULT" log --oneline 6a4919f72db338e7f49a2cacb3787d20cc649883..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 6a4919f72db338e7f49a2cacb3787d20cc649883..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day347-403-przyczyna-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 6a4919f72db338e7f49a2cacb3787d20cc649883..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: dowod 336 jest w REPO, nie w katalogu tymczasowym
ls evidence/g15/day336-artefakty/*.json | wc -l
ls evidence/g15/day336-artefakty/*-serwer.json | grep -vc baza
#   moje liczby: 63 pliki JSON razem; 15 plikow '<modul>-serwer.json' (bez wariantow bazowych)
#   ★ 15, nie 16: 15_SETTINGS nie ma sciezki serwerowej w R1 rejestru G15 (evidence/g15/day336-r3-serwer.md)

# (2) ★★ TEZA ROZSTRZYGAJACA: 542 czerwienie serwerowe, z tego 415 o JEDNYM ksztalcie
node -e "const fs=require('fs'),d='evidence/g15/day336-artefakty/';let t=0,p=0,f=0,c=0;for(const x of fs.readdirSync(d).filter(n=>/-serwer\.json$/.test(n)&&!/baza/.test(n))){const r=JSON.parse(fs.readFileSync(d+x,'utf8'));t+=r.numTotalTests;p+=r.numPassedTests;f+=r.numFailedTests;for(const s of r.testResults)for(const a of s.assertionResults)if(a.status==='failed'&&/expected 403 to be/.test((a.failureMessages||[]).join(' ')))c++;}console.log('total',t,'pass',p,'fail',f,'ksztalt403',c);"
#   moje liczby: total 1825 · pass 1153 · fail 542 · ksztalt403 415

# (3) ★★ TEZA: czerwien skupia sie w DWOCH modulach
node -e "const fs=require('fs'),d='evidence/g15/day336-artefakty/';for(const x of fs.readdirSync(d).filter(n=>/-serwer\.json$/.test(n)&&!/baza/.test(n))){const r=JSON.parse(fs.readFileSync(d+x,'utf8'));if(r.numFailedTests)console.log(x,r.numTotalTests,r.numPassedTests,r.numFailedTests);}"
#   moje liczby: 09-results 567/136/413 · 10-finance 277/143/114 · 08-meetings 33/25/8 ·
#   02-interview 63/51/2 · 07-my-work 43/41/2 · 05-initiatives 125/124/1 ·
#   11-materials 64/59/1 · 12-audits 317/244/1. Reszta modulow: ZERO czerwieni serwerowych

# (4) ★★★ TROP GLOWNY — bramka, ktora ma prawo zwrocic 403 KAZDEMU zadaniu
sed -n '20,45p' server/src/middleware/resultsInternalBetaVisibility.middleware.ts
#   oczekiwane: warunek opt-out dziala TYLKO gdy NODE_ENV=test I TEST_MODE !== 'enforce';
#   §0.2c wariant (B) ustawia RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce, wiec opt-out JEST WYLACZONY

# (5) ★★★ TROP DRUGI — tylko 3 z 19 pakietow tras wypisuja sie z koperty
bash -c "grep -rlc 'resultsInternalBetaVisibility' server/src/routes/resultsVnext/__tests__/" ; echo "kod grepa=$?"
ls server/src/routes/resultsVnext/__tests__/*.test.ts | wc -l
#   moje liczby: 3 pliki maja vi.mock koperty (kpiDay17, okrCheckInSummaryDay17, search);
#   plikow testowych jest 19. Pozostale 16 jada na REALNEJ kopercie bez wiersza czlonkostwa

# (6) TEZA: koperta ma WLASNY dowod, ktory po naprawie MUSI zostac zielony
ls tests/acceptance/res-internal-beta-visibility.mounted.pg.test.ts
bash -c "grep -rl 'RESULTS_INTERNAL_BETA_VISIBILITY' tests/ | sort" ; echo "kod grepa=$?"
#   oczekiwane: plik akceptacyjny istnieje + piec plikow tests/integration/results/day46.*.realpg.test.ts

# (7) TEZA: dyzur 336 NIGDY nie nazwal przyczyny 403 — to jest praca nowa, nie powtorka
bash -c "grep -rn '403' evidence/g15/*.md docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY336*.md" ; echo "kod grepa=$?"
#   oczekiwane: ZERO trafien (kod grepa=1). Slowo '403' nie pada w zadnym dokumencie 336

# (8) TEZA: liscie slownikow i bramki kanonu na markerze
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35198, en 33065; focus=0, list=0, artefakt=0, reach=0

# (9) zasoby: dysk, porty, kontener
df -h /
lsof -nP -iTCP:6394 -sTCP:LISTEN; lsof -nP -iTCP:5534 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day347 || true
#   oczekiwane: powyzej 5 GB wolnego; oba porty puste; 0 kontenerow
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day347-403-przyczyna-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6394`. Twój JEDYNY port harnessu to `5534`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day347-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki 04.09 — nie dotykasz: 348 (6395/5535), 349 (6396/5536), 350 (6397/5537). Równoległa paczka 343-346 ma zarezerwowany przedział 6390-6393 i 5530-5533 — również nie dotykasz. Starsze rodzeństwo 04.09: 334 (6370/5510), 335 (6371/5511), 336 (6372/5512), 337 (6373/5513). Cudze worktree 286-298 używają 6290-6299 i 5250-5269. Twoje własne wyłącznie: baza 6394, harness 5534. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK NOWYCH FLAG. Ten dyżur nie dodaje ani jednej flagi funkcyjnej i nie zmienia wartości domyślnej żadnej istniejącej. ★★ UWAGA SZCZEGÓLNA: `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE` **nie jest flagą funkcyjną produktu** — to przełącznik trybu pomiaru czytany wyłącznie pod `NODE_ENV==='test'` (`resultsInternalBetaVisibility.middleware.ts:26-32`); w produkcji i w każdym runtime nie-testowym koperta egzekwuje ZAWSZE, niezależnie od tej zmiennej. Wolno Ci nią sterować W KOMENDZIE POMIAROWEJ. **Nie wolno Ci zmieniać wartości domyślnej ani warunku w kodzie middleware'u tak, żeby koperta przestała egzekwować** — to byłoby usunięcie zabezpieczenia pod pozorem naprawy testu`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/src/middleware/auth.middleware.ts`, `server/src/services/ApiGateway.ts`, `tests/acceptance/res-internal-beta-visibility.mounted.pg.test.ts`, `tests/integration/results/day46.*.realpg.test.ts`. Wszystkie NIETYKALNE DO ZAPISU — wolno je wołać w pomiarze, nie wolno ich zmieniać, także wtedy gdy „wystarczyłaby drobna zmiana, żeby test przeszedł”`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY347_403_PRZYCZYNA_REPORT.md`. Jedyny inny dokument do zmiany: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/09_RESULTS/MODULE_ACCEPTANCE.md` i `docs/program/waves/WAVE_03_ACCEPTANCE/modules/10_FINANCE/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE wiersz `G15` i WYŁĄCZNIE pod twardym warunkiem z `R0`: wiersz zmienia stan tylko razem z dowodem w TYM SAMYM commicie. Dodatkowo: dopisanie sekcji „Aktualizacja dyżuru 347” do `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` (dopisanie, nigdy nadpisanie), nowe pliki dowodowe pod `evidence/g15/day347/` (katalog NIE ISTNIEJE na markerze — tworzysz go) oraz jedna nowa sekcja w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze (sekcje idą dziś do `O`, ale równoległy autor też dopisuje — literę sprawdzasz komendą tuż przed commitem, nie zakładasz z góry). **ZAKAZ dotykania wierszy `G00`–`G14` i `G16`–`G20` oraz MODULE_ACCEPTANCE pozostałych 14 modułów.** Plik postępu `/private/tmp/cx-day347-postep.md` żyje POZA repo. Nowe pliki w `tests/` wymagają `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day347-403-przyczyna-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day347-403-przyczyna-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ WYGASZENIA KOPERTY POD POZOREM NAPRAWY.** Najprostszy sposób zzielenienia 415 czerwieni to sprawienie, żeby `requireResultsInternalBetaVisibility` przepuszczał wszystkich — przez zmianę warunku w middlewarze, przez poszerzenie `ALLOWED_RESULTS_ROLES`, przez globalny `vi.mock` w infrastrukturze testowej albo przez usunięcie `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` z wariantu (B) dla WSZYSTKIEGO. To jest zmierzony kształt „zamknięte przez wygaszenie” — bramka świeci na zielono, bo funkcja przestała działać dla kogokolwiek. **Każda naprawa, która dotyka koperty, wymaga PARY dowodów w tym samym commicie: (a) obcy/niebędący ACTIVE OWNER|ADMIN NADAL dostaje `403`; (b) właściciel z wierszem członkostwa dostaje `200`/`201`.** Bez tej pary pozycja jest odrzucona. **ZAKAZ `.skip`, `.todo`, `--retry` innego niż `0`, poszerzania `exclude`, obniżania progów i zmiany asercji, żeby zzielenieć** (`Z35`). **ZAKAZ naprawiania po jednym teście** — jeżeli po `R2` nie umiesz wskazać JEDNEJ przyczyny, piszesz to wprost jako wynik i nie wchodzisz w 542 poprawki. **ZAKAZ porównania po liczbach** — „było 542, jest 127” bez listy nazw NIE jest wynikiem (`Z37`) | Odbiorca dyżuru 336 rozbił czerwienie modułu `09` i zobaczył, że nie są to setki niezależnych defektów, tylko jedno zachowanie powtórzone setki razy. Jego zdanie brzmi: **kto zaplanuje 542 naprawy, zaplanuje pracę, której nie ma.** Jeżeli wydamy 542 zlecenia zamiast jednego, program straci tygodnie na pracy, której nie ma — a jeżeli zzielenimy je jednym przełącznikiem, stracimy zabezpieczenie i nie zauważymy tego, bo bramka będzie zielona |

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
cd /private/tmp/cx-day347-403-przyczyna

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day347-pg psql -U postgres -d cx347 \
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
cd /private/tmp/cx-day347-403-przyczyna

docker run -d --name cx-day347-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx347 \
  -p 127.0.0.1:6394:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day347-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6394/cx347 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6394/cx347 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day347-403-przyczyna && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6394/cx347 \
JWT_SECRET=cx347-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Testy serwerowe z cwd `server/`, wariant (B) `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6394/cx347` — uruchomienie z roota bez właściwego configu daje `No test files found`, co jest BŁĘDEM KOMENDY, nie PASS. Wszystko z `--retry=0` i `--reporter=json --outputFile=/private/tmp/cx-day347-403-przyczyna-artefakty/<etykieta>.json`. ★ Wariant kontrolny: TEN SAM pakiet raz z `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, raz bez — różnica wyniku jest dowodem przyczyny, ale **nie jest naprawą**. Testy akceptacyjne koperty (`tests/acceptance/res-internal-beta-visibility.mounted.pg.test.ts`, `tests/integration/results/day46.*.realpg.test.ts`) uruchamiasz z roota, na realnym PostgreSQL, ZAWSZE z `enforce` — one bronią zabezpieczenia i mają być zielone PRZED i PO. Porównanie ZASTANA/REGRESJA robisz na osobnym worktree bazowym w `/private/tmp/cx-day347-403-przyczyna-artefakty/baza` (POZA repo, kasowany po pomiarze, `df -h /` przed i po), po pełnych nazwach przypadków (`fullName`) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day347-403-przyczyna-artefakty/day347-403-przyczyna.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day347-403-przyczyna && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Testy serwerowe z cwd `server/`, wariant (B) `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6394/cx347` — uruchomienie z roota bez właściwego configu daje `No test files found`, co jest BŁĘDEM KOMENDY, nie PASS. Wszystko z `--retry=0` i `--reporter=json --outputFile=/private/tmp/cx-day347-403-przyczyna-artefakty/<etykieta>.json`. ★ Wariant kontrolny: TEN SAM pakiet raz z `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, raz bez — różnica wyniku jest dowodem przyczyny, ale **nie jest naprawą**. Testy akceptacyjne koperty (`tests/acceptance/res-internal-beta-visibility.mounted.pg.test.ts`, `tests/integration/results/day46.*.realpg.test.ts`) uruchamiasz z roota, na realnym PostgreSQL, ZAWSZE z `enforce` — one bronią zabezpieczenia i mają być zielone PRZED i PO. Porównanie ZASTANA/REGRESJA robisz na osobnym worktree bazowym w `/private/tmp/cx-day347-403-przyczyna-artefakty/baza` (POZA repo, kasowany po pomiarze, `df -h /` przed i po), po pełnych nazwach przypadków (`fullName`) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day347-403-przyczyna-artefakty/day347-403-przyczyna.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day347-403-przyczyna/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day347-pg psql -U postgres -d cx347 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day347-pg`.
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
> **(e) ★★★ **SZEŚĆ PUŁAPEK.** (1) **Wygaszenie wygląda jak naprawa.** Koperta `resultsInternalBetaVisibility` fail-closed: brak `userId`/`organizationId` → `403`, brak wiersza `ACTIVE OWNER|ADMIN` w `organization_members` → `403`, błąd bazy → `503`. Wyłączenie jej daje 415 zielonych w minutę i zero produktu. (2) **`403` i `503` to DWA różne kształty tej samej koperty** — `503` (8+3+3 wystąpień w `09`) idzie ze ścieżki `catch`, czyli z braku bazy, nie z braku uprawnienia; nie zlepiaj ich. (3) **Kaskada wygląda jak osobne defekty**: w `10_FINANCE` `31× TypeError: Cannot read properties of undefined` i `20× createArtifactViaHttp failed: 403` to SKUTEK pierwszego `403`, nie osobne czerwienie — policz je osobno i powiedz wprost, ile z 542 to kaskada. (4) **Atrapa bazy kłamie o zapisie**: `Database.ts:686` zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE`; wszystko, co dotyka zapisu, wyłącznie na realnym PostgreSQL (`RUN_DB_TESTS=1 MOCK_DB=false`). (5) **`NODE_ENV=test` bez `RUN_DB_TESTS=1` podstawia atrapę pod `DbPromise`** — `pg.Pool` widzi wiersz, kod produkcyjny nie; koperta pyta przez `acquirePgClient`, więc na atrapie zawsze przegra. (6) **`grep --include` w `zsh` zwraca pustkę zamiast wyników** — uruchamiaj przez `bash -c '…'` i sprawdzaj kod wyjścia; pustka nie jest wynikiem, dopóki nie wiesz, że komenda się wykonała**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day347-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day347-403-przyczyna-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarde zasady: para dowodów przy każdej zmianie koperty; zakaz naprawiania po jednym teście) · R1 (odtworzenie 542 czerwieni po NAZWACH z artefaktów w repo i podział na kształty — RDZEŃ) · R2 (przyczyna źródłowa: falsyfikacja mojej hipotezy, jedna komenda różnicowa — RDZEŃ) · R3 (JEDNA naprawa + para dowodów „obcy 403 / właściciel 200” — RDZEŃ) · R4 (przemiar PO naprawie i tabela „przed/po” po nazwach) · R5 (ZASTANA kontra REGRESJA dla tego, co zostaje) · R6 (raport, jawna liczba tego, co zostaje, pytania do właściciela)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6394` albo `5534` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6394` albo `5534`** (`Z7`).

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

Dyżur 336 wykonał brakujący pomiar warstwy serwerowej i **uratował surowe wyniki do repo** —
63 pliki JSON w `evidence/g15/day336-artefakty/`. Wcześniej takie artefakty żyły wyłącznie
w katalogu tymczasowym sesji i znikały razem z nim. Dzięki temu **nie musisz powtarzać pomiaru,
żeby zacząć: masz go pod ręką, z pełnymi nazwami przypadków.**

Odbiorca tego dyżuru rozbił czerwienie modułu `09_RESULTS` i zobaczył coś, czego sam raport 336
nie nazwał ani razu: **to nie są setki niezależnych defektów, to jedno zachowanie powtórzone
setki razy — każde żądanie wraca `403`.**

**Jego zdanie, i sens tego dyżuru:**

> **Kto zaplanuje 542 naprawy, zaplanuje pracę, której nie ma.**

**Stan zastany, zmierzony przeze mnie na markerze `6a4919f72db338e7f49a2cacb3787d20cc649883`
z plików JSON leżących w repo:**

| Warstwa serwerowa | Przypadków | Zielonych | Czerwonych |
| --- | --- | --- | --- |
| 15 modułów razem | **1825** | **1153** | **542** |

| Moduł | Razem | Zielone | Czerwone | z tego kształt `403` |
| --- | --- | --- | --- | --- |
| `09_RESULTS` | 567 | 136 | **413** | **356** |
| `10_FINANCE` | 277 | 143 | **114** | **59** |
| `08_MEETINGS` | 33 | 25 | 8 | 0 |
| `02_INTERVIEW` | 63 | 51 | 2 | 0 |
| `07_MY_WORK_AGENT` | 43 | 41 | 2 | 0 |
| `05_INITIATIVES` | 125 | 124 | 1 | 0 |
| `11_MATERIALS` | 64 | 59 | 1 | 0 |
| `12_AUDITS` | 317 | 244 | 1 | 0 |
| `01`, `03`, `04`, `06`, `13`, `14`, `16` | 336 | 336 | **0** | 0 |

**`15_SETTINGS` nie ma pliku JSON i to nie jest przeoczenie** — sekcja R1 rejestru G15 nie
zawiera dla tego modułu ścieżki serwerowej, więc dyżur 336 świadomie nie wpisał fałszywego
`PASS 0/0` (`evidence/g15/day336-r3-serwer.md`, ostatni wiersz). **Modułów jest 15, nie 16 —
i to jest poprawne.**

**Rozbicie kształtu `403` w module `09_RESULTS` (moje liczby, z artefaktów):**

| Kształt komunikatu | Ile |
| --- | --- |
| `expected 403 to be 200` | 124 |
| `expected 403 to be 404` | 75 |
| `expected 403 to be 409` | 72 |
| `expected 403 to be 400` | 47 |
| `expected 403 to be 201` | 36 |
| pozostałe wystąpienia `403` (inne brzmienie asercji) | 2 |
| **razem kształt `403` w `09`** | **356** |
| `AssertionError: expected 'RESULTS_INTERNAL_BETA_VISIBILITY_D…'` | 12 |
| `expected 503 to be 200 / 400 / 409` | 8 + 3 + 3 |
| reszta (`vi.fn()`, `TypeError`, `ENOENT`) | 26 |

**Pliki, które padają w CAŁOŚCI** (wszystkie w `server/src/routes/resultsVnext/__tests__/`):

| Plik | Czerwone / wszystkie |
| --- | --- |
| `okr.routes.test.ts` | **118 / 118** |
| `kpi.routes.test.ts` | 33 / 33 |
| `roiForecastActual.routes.test.ts` | 27 / 27 |
| `okrReview.routes.test.ts` | 27 / 27 |
| `kpiScorecard.routes.test.ts` | 27 / 27 |
| `roiPir.routes.test.ts` | 26 / 26 |
| `roi.routes.test.ts` | 26 / 26 |
| `roiCaseApproval.routes.test.ts` | 22 / 22 |
| `kpiDeviation.routes.test.ts` | 21 / 21 |
| `roiBenefitsRealization.routes.test.ts` | 15 / 15 |
| `roiEconomicModel.routes.test.ts` | 14 / 14 |

**Plik, który pada częściowo i dlatego jest cenniejszy od tamtych:**
`roiFinanceSeam.routes.test.ts` **25 / 26** — jeden przypadek przechodzi. **Znajdź go i zapytaj,
czym się różni.** To jest najkrótsza droga do przyczyny.

**★★ Co odbiorca 336 już sprawdził i wykluczył — nie powtarzaj tego:**
podejrzenie padło na obejście logowania. `ENABLE_TEST_AUTH_BYPASS=false` → 118 FAIL;
`ENABLE_TEST_AUTH_BYPASS=true` → **też 118 FAIL**. **Przyczyna leży poza uwierzytelnianiem.**

## ★★ MOJA HIPOTEZA — masz ją OBALIĆ ALBO POTWIERDZIĆ, nie przyjąć

**To jest hipoteza autora instrukcji, nie zweryfikowany fakt.** Podaję ją, żebyś nie szukał
po omacku, i podaję też, jak ją obalić.

Bramka `server/src/middleware/resultsInternalBetaVisibility.middleware.ts` ma trzy wyjścia:

- wiersze **26-32** — jedyne wyjście „przepuść": działa **tylko** gdy `NODE_ENV === 'test'`
  **i jednocześnie** `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE !== 'enforce'`;
- wiersze **38-44** — `403 RESULTS_INTERNAL_BETA_VISIBILITY_DENIED`, gdy brak `userId` albo
  `organizationId`;
- wiersze **49-66** — `403` z tym samym kodem, gdy w `organization_members` nie ma wiersza
  `ACTIVE` z rolą `OWNER` albo `ADMIN`;
- wiersze **68-74** — `catch` → `503 RESULTS_INTERNAL_BETA_VISIBILITY_UNAVAILABLE`.

Sam plik nosi komentarz opisujący dokładnie tę sytuację:

> *„Existing isolated route-unit suites replace auth middleware and have no membership database.
> They must opt in explicitly when exercising this production envelope."*

**Trzy pomiary, które robią z tego hipotezę, a nie zgadywanie:**

1. `§0.2c` wariant **(B)** — komplet, którym dyżur 336 uruchamiał pomiar — zawiera
   `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`. To **wyłącza** wyjście z wierszy 26-32.
2. W `server/src/routes/resultsVnext/__tests__/` jest **19** plików testowych, a `vi.mock`
   koperty ma **3** z nich (`kpiDay17`, `okrCheckInSummaryDay17`, `search`). **Pozostałe 16
   jadą na REALNEJ kopercie.**
3. Nagłówek `okr.routes.test.ts` mówi wprost, że to pakiet **kontraktu HTTP**, w którym
   middleware auth/rbac/demo/rate-limit są zastąpione przepustkami, a RBAC ma **własny, osobny**
   dowód. Koperty widoczności **na tej liście nie ma** — i to jest luka.

**Wniosek hipotezy:** 16 pakietów kontraktu tras uruchomiono w trybie, w którym koperta
egzekwuje, ale **nie ma bazy członkostwa, o którą pyta** — więc każde żądanie zwraca `403`.
To nie jest 415 defektów produktu. To jeden rozjazd między trybem pomiaru a przeznaczeniem
pakietu.

**Jak ją OBALIĆ (i obalenie jest sukcesem dyżuru):** uruchom `okr.routes.test.ts` **dwa razy**,
zmieniając **wyłącznie** `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE`. Jeżeli obie strony dają
118 FAIL — moja hipoteza jest **fałszywa**, zapisujesz to wprost i szukasz dalej (kolejni
kandydaci: `requireOrgAccess`, `demoContextMiddleware`, `ENABLE_V8_GLOBAL`, montaż `v8/index.ts`).
Różnica wyniku między tymi dwoma przebiegami jest **dowodem przyczyny — ale nie jest naprawą.**

## ★ Zmierz moje liczby sam

Twierdzę, na markerze:

- artefaktów 336 w repo: **63** pliki JSON, w tym **15** plików `<moduł>-serwer.json`;
- warstwa serwerowa razem: **1825 / 1153 / 542**;
- kształt `403`: **415 z 542** (76,6%) — **356** w `09_RESULTS`, **59** w `10_FINANCE`,
  **0** we wszystkich pozostałych modułach;
- `okr.routes.test.ts` = **118/118 FAIL**; jedenaście plików pada w całości;
  `roiFinanceSeam.routes.test.ts` = **25/26**;
- `vi.mock` koperty ma **3 z 19** plików testowych `resultsVnext`;
- słowo `403` **nie pada ani razu** w żadnym dokumencie dyżuru 336 — przyczyna nie została
  nazwana, to praca nowa;
- liście słowników: **pl 35198**, **en 33065**; cztery bezpieczniki (`focus-canon`,
  `list-canon`, `artefakt`, `reachability --check-baseline`) kończą się kodem **0**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Walidator / schematy** | `server/src/schemas/**` | **TYLKO ODCZYT** — schemat jest kontraktem produktu | Cytat wiersza schematu + brief |
| **Trasa (montaż)** | `server/src/services/ApiGateway.ts`, `server/src/routes/v8/index.ts` | **TYLKO ODCZYT — WOŁASZ, NIE ZMIENIASZ.** Każde „działa" znaczy: realne żądanie HTTP przez realny `ApiGateway`, z **zapisanym kodem odpowiedzi** | Opis w raporcie |
| **Middleware — koperta widoczności** | `server/src/middleware/resultsInternalBetaVisibility.middleware.ts` | **★ WĄSKA LICENCJA POD WARUNKIEM `R0`:** wolno zmienić **wyłącznie** wtedy, gdy `R2` udowodni, że przyczyna leży w tym pliku, i **wyłącznie razem z parą dowodów** „obcy `403` / właściciel `200`" w TYM SAMYM commicie. **Zakaz poszerzania `ALLOWED_RESULTS_ROLES` i zakaz zmiany warunku tak, żeby koperta przestała egzekwować w runtime nie-testowym** | Brief z `plik:linia` + diff **nienałożony** |
| **Pozostałe middleware / model uprawnień** | `server/src/middleware/**` (w tym `auth.middleware.ts`) | **NIETYKALNE DO ZAPISU** (`Z12`) | Brief |
| **Kontroler / trasy** | `server/src/routes/**` | **TYLKO ODCZYT** — ten dyżur uruchamia testy tras, nie zmienia tras. Wyjątek wymaga `R2` i osobnego akapitu w raporcie | Wpis: plik, linia, czerwień, rekomendacja jako diff **nienałożony** |
| **Serwis / repozytorium** | `server/src/services/**`, `server/src/domain/**`, `server/src/repositories/**` | **TYLKO ODCZYT** | jak wyżej |
| **Testy kontraktu tras `resultsVnext`** | `server/src/routes/resultsVnext/__tests__/**` (19 plików) | **★ WĄSKA LICENCJA:** wolno **URUCHAMIAĆ** i wolno **dopisać wypisanie się z koperty** (`vi.mock` koperty) dokładnie w takiej formie, w jakiej robią to już `kpiDay17`, `okrCheckInSummaryDay17` i `search` — jeżeli `R2` udowodni, że to jest właściwa naprawa. **Zakaz zmiany progu, usuwania asercji i zawężania zakresu, żeby zzielenieć** | — |
| **Testy serwerowe `10_FINANCE`** | `server/src/routes/v8/finance-v2/__tests__/**`, `server/src/services/finance/__tests__/**` | jak wyżej — **ta sama naprawa musi objąć RODZINĘ**, nie tylko `09_RESULTS` | — |
| **Dowód koperty (zabezpieczenie)** | `tests/acceptance/res-internal-beta-visibility.mounted.pg.test.ts`, `tests/integration/results/day46.*.realpg.test.ts` | **NIETYKALNE DO ZAPISU.** To jest miejsce, w którym zabezpieczenie jest bronione. Wolno je **uruchamiać** i **musisz** je uruchomić PRZED i PO naprawie | Wynik do raportu |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY.** Globalny `vi.mock` koperty w tych plikach = wygaszenie zabezpieczenia dla całego korpusu | Opis w raporcie |
| **Produkt UI** | `src/**`, `src/views/**`, `public/locales/**` | **TYLKO ODCZYT** | Opis w raporcie |
| **Nowe testy** | `tests/**` (nowe pliki, `git add -f`) | **★ PEŁNA LICENCJA na dodanie** testu dowodzącego pary „obcy `403` / właściciel `200`", jeżeli istniejące pokrycie okaże się niewystarczające. **Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`** | — |
| **Dowody** | `evidence/g15/day347/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**) | **★ PEŁNA LICENCJA na tworzenie i dopisywanie** | — |
| **Artefakty 336** | `evidence/g15/day336-artefakty/**`, `evidence/g15/day336-*.md` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** To jest baza porównania; nadpisanie unieważnia cały dyżur | — |
| **Rejestr G15** | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_G15_SAMOKONTROLA_20260903.md` | **AKTUALIZACJA przez DOPISANIE** sekcji „Aktualizacja dyżuru 347" | — |
| **Macierz odbioru** | `modules/09_RESULTS/MODULE_ACCEPTANCE.md`, `modules/10_FINANCE/MODULE_ACCEPTANCE.md`, **wyłącznie wiersz `G15`** | **★ WĄSKA LICENCJA POD WARUNKIEM `R0`:** wiersz zmienia stan **tylko razem z dowodem w TYM SAMYM commicie**. Zakaz dotykania wierszy `G00`–`G14`, `G16`–`G20` i pozostałych 14 modułów | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY347_403_PRZYCZYNA_REPORT.md` (**NOWY**) | `R6` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `evidence/g19/**`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md`, wiersz `G19` (dyżur 348) · `src/components/shared/__tests__/{filterableTable.r04-2a,standardPreview.r03,tablePreviewGeometry.r03-2}.test.tsx`, `server/src/routes/__tests__/day27{4,5,6}-*.pg.test.ts` (dyżur 349) · `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, wiersz `G16` (dyżur 350) · wszystko wokół `DEC-388`, kafli SWOT, panelu Idei i kompletności raportu (dyżury 343-346) · `server/migrations/**` (przedział nieprzydzielony) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35198, en 33065

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
| 1 | artefakty 336 w repo | `63` JSON, `15` plików `-serwer.json` | komenda (1) z `§0.3` | TAK |
| 2 | warstwa serwerowa razem | `1825 / 1153 / 542` | komenda (2) z `§0.3` | TAK — sumuje `numTotalTests`, nie tylko `numFailedTests` |
| 3 | czerwienie o kształcie `403` | `415 / 542` | komenda (2) z `§0.3` | TAK — filtruje po treści `failureMessages`, nie po nazwie testu |
| 4 | rozkład per moduł | tabela wyżej | komenda (3) z `§0.3` | TAK |
| 5 | rozbicie kształtów w `09` | `124/75/72/47/36 + 2` | własna komenda `R1` | TAK — **suma ma się zgodzić z 356, sprawdź to jawnie** |
| 6 | pliki padające w całości | 11 plików, `okr` 118/118 | własna komenda `R1` | TAK |
| 7 | ile pakietów wypisuje się z koperty | `3 z 19` | komenda (5) z `§0.3` | TAK — **to obala „wszystkie pakiety są równe"** |
| 8 | czy `403` znika po zmianie trybu | — | dwa przebiegi `R2` różniące się JEDNĄ zmienną | TAK — różnica jest dowodem przyczyny |
| 9 | czerwienie PO naprawie | — | przemiar `R4`, po **nazwach** | TAK — `Z37`: liczba bez nazw nie jest wynikiem |
| 10 | kaskada kontra czerwień własna | — | `R4`: ile czerwieni to `TypeError`/`createArtifactViaHttp` po pierwszym `403` | TAK — **w `10_FINANCE` to 31 + 20 przypadków** |
| 11 | ZASTANA kontra REGRESJA | — | ta sama `fullName` na bazie i na `HEAD` | TAK — **tylko jeżeli baza się skompilowała** |
| 12 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY347_403_PRZYCZYNA_REPORT.md` ·
`evidence/g15/day347/**` (nowy katalog).

**Zapisujesz WARUNKOWO (tylko z dowodem `R2`/`R3`):**
`server/src/middleware/resultsInternalBetaVisibility.middleware.ts` ·
`server/src/routes/resultsVnext/__tests__/**` · serwerowe testy `10_FINANCE` ·
nowe pliki testowe w `tests/` (`git add -f`) ·
`modules/{09_RESULTS,10_FINANCE}/MODULE_ACCEPTANCE.md` wyłącznie wiersz `G15` ·
`REJESTR_G15_SAMOKONTROLA_20260903.md` (sekcja dopisana) ·
`REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `src/**`, `public/locales/**`, `tests/setup.ts`, `tests/helpers/**`,
`tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`,
`server/migrations/**`, `server/src/middleware/auth.middleware.ts`,
`server/src/services/ApiGateway.ts`, `tests/acceptance/res-internal-beta-visibility.mounted.pg.test.ts`,
`tests/integration/results/day46.*.realpg.test.ts`, `evidence/g15/day336-*`, `evidence/g19/**`,
`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, wiersze `G00`–`G14` i `G16`–`G20`,
MODULE_ACCEPTANCE pozostałych 14 modułów.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day347-403-przyczyna
git diff --name-only --cached | tee /private/tmp/cx-day347-403-przyczyna-artefakty/staged.txt
bash -c "grep -iE '^src/|^public/locales/|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|auth\.middleware|ApiGateway|res-internal-beta-visibility|day46\..*realpg|day336-|evidence/g19|PRZELOT_WLASCICIELA|modules/0[1-8]_|modules/1[1-6]_' /private/tmp/cx-day347-403-przyczyna-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — TRZY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Każda zmiana dotykająca koperty widoczności wymaga PARY dowodów w tym samym commicie.**
Nie wystarczy „test przeszedł". Wymagam dwóch zdań z kodami odpowiedzi:
**(a)** żądanie od użytkownika, który **nie ma** wiersza `ACTIVE OWNER|ADMIN`
w `organization_members`, **nadal dostaje `403`**;
**(b)** żądanie od użytkownika, który **ma** taki wiersz, dostaje `200`/`201`.
Jeden dowód bez drugiego jest **wygaszeniem**, nie naprawą. To jest zmierzony kształt:
fail-closed świeci zielono, bo kontekst nie dociera, i funkcja przestaje działać dla wszystkich.

**(2) Nie naprawiasz po jednym teście.** Jeżeli po `R2` nie umiesz wskazać **jednej**
przyczyny obejmującej większość z 415 czerwieni — piszesz to wprost jako wynik i **nie
wchodzisz w 542 poprawki**. Zdanie „przyczyna jest wieloraka, oto trzy rodziny po N czerwieni"
jest pełnowartościowym wynikiem tego dyżuru.

**(3) Porównania po NAZWACH, nigdy po liczbach.** Tabela „przed / po" w `R4` ma dwie kolumny
pełnych nazw przypadków (`fullName`), nie dwie liczby. „Było 542, jest 127" bez listy nazw
NIE jest wynikiem (`Z37`) — jeden test mógł zgasnąć, a drugi się zapalić.

**Wymagany dowód:** trzy zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita dotykającego koperty. **Bez commita — to jest warunek, nie pozycja.**

## R1 — ODTWORZENIE 542 CZERWIENI PO NAZWACH I PODZIAŁ NA KSZTAŁTY (rdzeń)

Pracujesz na artefaktach, które **już są w repo** — nie uruchamiasz jeszcze niczego.

1. Wypisz **wszystkie 542 pełne nazwy** czerwonych przypadków z
   `evidence/g15/day336-artefakty/*-serwer.json` do
   `evidence/g15/day347/przed-nazwy.txt` — po jednej nazwie na wiersz, z prefiksem modułu
   i pliku. **To jest baza porównania dla `R4` i bez niej `R4` nie ma sensu.**
2. Pogrupuj je po **kształcie komunikatu**, nie po nazwie testu. Minimum kubełków:
   `403≠X` · `503≠X` · `RESULTS_INTERNAL_BETA_VISIBILITY_DENIED` w treści asercji ·
   `TypeError`/`undefined` · `createArtifactViaHttp failed` · `ENOENT` · reszta.
   **Podaj liczbę w każdym kubełku i sumę — suma ma się zgodzić z 542.**
3. Wskaż **kaskadę**: które kubełki są SKUTKIEM pierwszego `403`, a nie osobną czerwienią.
   W `10_FINANCE` moim zdaniem `31× TypeError` i `20× createArtifactViaHttp failed: 403`
   to kaskada — **sprawdź to, cytując treść komunikatu.**
4. Wskaż **plik-świadka**: `roiFinanceSeam.routes.test.ts` pada 25 z 26. **Nazwij ten jeden
   przypadek, który przechodzi, i powiedz, czym się różni od 25 pozostałych.**

**Wymagany dowód:** `evidence/g15/day347/przed-nazwy.txt` z 542 nazwami · tabela kubełków
z sumą · zdanie o kaskadzie z liczbą · nazwa i wyjaśnienie przypadku-świadka.
**Commit po `R1`.**

## R2 — PRZYCZYNA ŹRÓDŁOWA: JEDNA KOMENDA RÓŻNICOWA (rdzeń)

**To jest pozycja, w której hipoteza staje się faktem albo pada.**

1. **Postaw kontener** `cx-day347-pg` na porcie `6394`, baza `cx347`, i przepuść migracje
   zgodnie z `§0.2c` (A) — **dwa przebiegi**, drugi bezbłędny i bez zmian (idempotencja).
   `pgvector/pgvector:pg16`; `postgres:15` **nie przechodzi migracji**.
2. Uruchom `server/src/routes/resultsVnext/__tests__/okr.routes.test.ts` **dwa razy**,
   z cwd `server/`, `--retry=0`, `--reporter=json`, zmieniając **DOKŁADNIE JEDNĄ** zmienną:
   `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` kontra brak tej zmiennej.
   **Zapisz oba JSON-y i oba `numTotalTests` / `numFailedTests`.**
3. **Jeżeli różnica jest zerowa — moja hipoteza jest FAŁSZYWA.** Zapisz to zdaniem
   „hipoteza autora instrukcji obalona pomiarem" i szukaj dalej. Kolejni kandydaci, w tej
   kolejności: `requireOrgAccess`, `demoContextMiddleware`, `ENABLE_V8_GLOBAL`,
   montaż `server/src/routes/v8/index.ts`, seeder wiersza `organization_members`.
4. **Jeżeli różnica jest duża — nadal nie masz przyczyny, masz przełącznik.** Dopiero
   wskazanie `plik:linia`, które **czyta** tę zmienną, i pokazanie, że to ta gałąź decyduje
   o `403`, jest przyczyną. Cytuj wiersz.
5. **Rozstrzygnij rodzinę, nie pojedynczy plik** (`KROK 0` przed naprawą): wypisz wszystkie
   19 plików `resultsVnext/__tests__` plus serwerowe pakiety `10_FINANCE`, zaznacz, które
   wypisują się z koperty, a które nie. **Naprawa ma objąć całą rodzinę albo raport ma
   powiedzieć, dlaczego nie.**

**Wymagany dowód:** dwa JSON-y różniące się jedną zmienną, z `numTotalTests` obu · cytat
`plik:linia` gałęzi decydującej · tabela rodziny (plik → wypisuje się TAK/NIE).
**Commit po `R2`.**

## R3 — JEDNA NAPRAWA I PARA DOWODÓW (rdzeń)

**Naprawiasz RAZ.** Wybierasz jedno z rozwiązań i **uzasadniasz wybór**, wypisując, co
odrzuciłeś i dlaczego:

- **(A)** dopisanie wypisania się z koperty do tych pakietów kontraktu tras, które są
  jednostkowe z definicji — dokładnie w formie, w jakiej robią to już `kpiDay17`,
  `okrCheckInSummaryDay17` i `search`;
- **(B)** posadzenie w bazie pomiaru realnego wiersza `organization_members` (`ACTIVE`,
  `OWNER`), żeby koperta miała czego szukać;
- **(C)** rozdzielenie wariantu (B) `§0.2c` na dwa: `enforce` dla pakietów sprawdzających
  kopertę, bez `enforce` dla pakietów kontraktu HTTP — z zapisaniem tej różnicy w rejestrze
  G15, żeby następny pomiar nie powtórzył błędu;
- **(D)** cokolwiek innego, co `R2` wskaże jako właściwe.

**Czego NIE WOLNO — niezależnie od wybranej drogi:**
zmiany warunku w middlewarze tak, żeby koperta przestała egzekwować poza testami ·
poszerzenia `ALLOWED_RESULTS_ROLES` · globalnego `vi.mock` koperty w `tests/setup.ts`,
`tests/helpers/**` lub `tests/__mocks__/**` (`Z18`) · `.skip`, `.todo`, `--retry` innego
niż `0`, poszerzania `exclude` (`Z35`).

**Para dowodów, obowiązkowa, w tym samym commicie:**

1. **Obcy nadal odbity:** `tests/acceptance/res-internal-beta-visibility.mounted.pg.test.ts`
   uruchomiony na realnym PostgreSQL, z `enforce`, **zielony przed i po Twojej naprawie**.
   Do tego pięć plików `tests/integration/results/day46.*.realpg.test.ts` — wyniki obu
   przebiegów do raportu.
2. **Właściciel przechodzi:** realne żądanie HTTP przez realny `ApiGateway`, z podpisanym
   JWT, na Twoim PostgreSQL po pełnych migracjach, od użytkownika z wierszem
   `ACTIVE OWNER` — **z zapisanym kodem odpowiedzi** (`Z34`).
3. **Dowód mutacyjny celujący w ZABEZPIECZENIE, nie w mechanizm** (`Z32`): usuń z zapytania
   koperty warunek `upper(status) = 'ACTIVE'` **albo** dopisz do `ALLOWED_RESULTS_ROLES`
   rolę `MEMBER` → test broniący koperty ma **zaczerwienić się**; cofnij przez `cp`
   (nigdy `git stash`, `Z27`) → ma **zzielenieć**; `git diff` po cofnięciu **pusty**.
   Obie komendy i oba wyniki dosłownie w raporcie.
   ★ Mutacja w treści testu albo w zmiennej środowiskowej **nie liczy się** — ma trafić
   w kod, który realizuje zabezpieczenie.

**Wymagany dowód:** opis wybranej drogi z uzasadnieniem odrzucenia pozostałych · para
„obcy `403` / właściciel `200`" z kodami odpowiedzi · dowód mutacyjny w obie strony ·
wynik pakietu akceptacyjnego koperty przed i po. **Commit po `R3`.**

## R4 — PRZEMIAR PO NAPRAWIE I TABELA „PRZED / PO" PO NAZWACH

1. Uruchom **te same** pakiety serwerowe, które uruchomił dyżur 336, tym samym wariantem
   (poza świadomie zmienionym elementem z `R3`), `--retry=0`, `--reporter=json`.
   **Minimum: `09_RESULTS` i `10_FINANCE`.** Pozostałe 13 modułów — kontrolnie, żeby
   pokazać, że naprawa niczego nie zgasiła.
2. Zapisz `evidence/g15/day347/po-nazwy.txt` i zrób
   `diff evidence/g15/day347/przed-nazwy.txt evidence/g15/day347/po-nazwy.txt`.
3. **Tabela główna dyżuru:** trzy kolumny — **nazwy, które zniknęły** (naprawione),
   **nazwy, które zostały** (dług), **nazwy, które się POJAWIŁY** (każda pojawiona nazwa
   wymaga wyjaśnienia albo STOP-u).
4. **Podaj `numTotalTests`, nie tylko `numFailedTests`.** Przebieg z zerem wykonanych
   przypadków kończy się `exit 0` i **nie jest pomiarem**. `No test files found` i
   `Transform failed` to **BŁĄD KOMENDY**.
5. **Jawna liczba tego, co zostaje** — to jest produkt, którego program potrzebuje
   najbardziej: „z 542 czerwieni zniknęło N, zostaje M, i oto ich nazwy".

**Wymagany dowód:** `po-nazwy.txt` · pełny `diff` · tabela trzech kolumn · `numTotalTests`
dla każdego przebiegu · jawna liczba pozostających czerwieni. **Commit po `R4`.**

## R5 — ZASTANA KONTRA REGRESJA DLA TEGO, CO ZOSTAJE

Dla **każdej** czerwieni, która przetrwała `R4`, orzekasz klasę — po **NAZWACH**, nigdy
po liczbach:

1. Załóż worktree bazowy w `/private/tmp/cx-day347-403-przyczyna-artefakty/baza`
   (**POZA repo**, `Z13`). Bazę wybierasz sam i **uzasadniasz wybór w raporcie** — naturalny
   kandydat to marker, którego użył dyżur 336 do klasyfikacji (`evidence/g15/day336-r4-klasy.md`).
2. **Zanim uruchomisz cokolwiek — udowodnij, że baza się kompiluje**: `npx esbuild` na
   plikach, które będziesz mierzył. **`Transform failed` jest błędem komendy, nie wynikiem.**
   Baza, na której plik wykonał zero przypadków, **nie jest bazą**.
3. Ta sama `fullName` czerwona po obu stronach ⇒ **ZASTANA**; czerwona tylko na `HEAD` ⇒
   **REGRESJA**; nieuruchomiona po którejkolwiek stronie ⇒ **NIEORZECZONA**, i **tak ją
   zapisujesz**, nie zgadujesz.
4. **Wypisz dług z nazwy** do `evidence/g15/day347/dlug-po-naprawie.md`. „Sto dwadzieścia
   siedem czerwieni zastanych" bez nazw nie jest wynikiem — jest zaokrągleniem.
5. Skasuj worktree bazowy po pomiarze; `df -h /` przed i po. Program stracił dobę na dysku
   zjedzonym przez niesprzątnięte artefakty.

**Wymagany dowód:** dowód kompilowalności bazy · tabela klas z pełnymi nazwami ·
`dlug-po-naprawie.md` · `df -h /` przed i po · potwierdzenie skasowania worktree.
**Commit po `R5`.**

## R6 — RAPORT, JAWNA LICZBA I PYTANIA DO WŁAŚCICIELA

Raport zawiera: tabelę kubełków z `R1` · rozstrzygnięcie hipotezy z `R2` (**wprost:
potwierdzona czy obalona**) · opis JEDNEJ naprawy z `R3` wraz z uzasadnieniem odrzucenia
pozostałych dróg · parę dowodów „obcy `403` / właściciel `200`" · dowód mutacyjny w obie
strony · tabelę „przed / po" po nazwach z `R4` · **jawną liczbę czerwieni, które zostają** ·
tabelę klas ZASTANA/REGRESJA/NIEORZECZONA z `R5` · listę rozbieżności wobec liczb tej
instrukcji · **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** · obowiązkowy akapit `§0.2e`
dla każdego uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „CO NADAL WYMAGA OSOBNEGO ZLECENIA".** Jeżeli po naprawie
zostaje dług, którego ten dyżur nie ruszał — wypisujesz go z nazwy i szacujesz, ile rodzin
naprawczych obejmuje. **To jest odpowiedź na zdanie odbiorcy 336: ile pracy tam naprawdę
jest, a ile było złudzeniem licznika.**

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA".** Jeżeli uznasz, że wariant (B)
`§0.2c` jest źle postawiony dla pakietów kontraktu tras — **piszesz to tutaj jako pytanie
rozstrzygalne („tak"/„nie"), i NIE zmieniasz go po cichu w szkielecie ani w instrukcjach
innych dyżurów.** Sekcja może być pusta, ale wtedy piszesz wprost: „nie mam zastrzeżeń".

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sprawdź ją komendą
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle pisze inny autor.

**Commit po `R6`.**

## Próg odbioru

**Jedna naprawa, mierzalny spadek czerwieni, tabela „przed / po" po NAZWACH i jawna liczba
tego, co zostaje** — przy nienaruszonej kopercie widoczności, udowodnionej parą „obcy `403` /
właściciel `200`" i dowodem mutacyjnym w obie strony.

Odbiorca odrzuci dyżur, w którym czerwienie zniknęły, a pary dowodów nie ma; w którym
porównanie jest po liczbach zamiast po nazwach; albo w którym naprawiono więcej niż jedną
rzecz naraz, tak że nie da się powiedzieć, która zadziałała.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „542 czerwienie rozłożone na
k kubełków, przyczyna wskazana/obalona z cytatem `plik:linia`, naprawa nie wykonana, bo
wymaga decyzji właściciela" — **jest pełnowartościowym wynikiem, nawet jeśli ani jedna
czerwień nie zgasła.**

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Napraw 415 czerwieni" vs „zakaz wygaszania koperty" | `R0` (1) i `R3`: naprawa wymaga PARY dowodów — obcy nadal `403`, właściciel `200`; jeden bez drugiego jest wygaszeniem |
| „Middleware nietykalny (`Z12`)" vs „przyczyna może leżeć w middlewarze" | Tabela licencji: `resultsInternalBetaVisibility.middleware.ts` ma **wąską licencję pod warunkiem `R0`**; pozostałe middleware, w tym `auth.middleware.ts`, zostają nietykalne |
| „`Z18` zakazuje ruszać infrastruktury testów" vs „naprawa może być w konfiguracji testów" | `R3`: `vi.mock` koperty wolno dopisać **w pojedynczym pliku pakietu**, tak jak robią to trzy istniejące; **globalny mock w `tests/setup.ts`/`helpers`/`__mocks__` pozostaje zakazany** — to różnica między jednym pakietem a całym korpusem |
| „`Z10` zakazuje zmiany flag" vs „dyżur steruje `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE`" | Sekcja `POZYCJE_Z_FLAGAMI`: to nie jest flaga funkcyjna produktu, tylko przełącznik trybu pomiaru czytany wyłącznie pod `NODE_ENV==='test'`; wolno nim sterować w komendzie, nie wolno zmieniać warunku w kodzie |
| „Znajdź jedną przyczynę" vs „nie zgaduj" | `R2` punkt 3: zerowa różnica między dwoma przebiegami **obala** hipotezę autora; obalenie jest sukcesem i ma być zapisane wprost |
| „Zmierz spadek" vs `Z37` (zakaz porównań po liczbach) | `R1` i `R4`: `przed-nazwy.txt` i `po-nazwy.txt` z pełnymi `fullName`; produktem jest `diff`, nie różnica dwóch liczb |
| „Naprawa ma objąć rodzinę" vs „naprawiasz RAZ" | `R2` punkt 5: rodzina to ta sama naprawa zastosowana mechanicznie, nie N różnych poprawek; jeżeli rodzina wymaga N różnych rozwiązań, to `R2` obalił jedność przyczyny i mówisz to wprost |
| „Uruchom testy koperty" vs „są NIETYKALNE" | Tabela licencji: nietykalne **do zapisu**; uruchamianie jest jawnie zamówione i obowiązkowe przed i po |
| „Worktree bazowy ułatwia dowód" vs `Z13` i próg 5 GB | `R5` punkty 1 i 5: worktree bazowy leży **poza repo**, jest kasowany po pomiarze, `df -h /` przed i po |
| „Cofaj mutacje" vs `Z27` (zakaz `git stash`) | `R3` punkt 3: mutację cofasz przez `cp` ze `SCRATCH`; `git diff` po cofnięciu ma być pusty |
| „Dopisz sekcję do rejestru znalezisk" vs „równoległy autor też dopisuje" | `R6`: literę sekcji sprawdzasz komendą **tuż przed commitem**, nie zakładasz z góry; kolizja liter jest przewidziana |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — 63 artefakty 336, middleware koperty, 19 plików `resultsVnext/__tests__`, pakiet akceptacyjny i pięć `day46.*.realpg` sprawdzone; `evidence/g15/day347/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1-7 i 12 zmierzone przy wydaniu na markerze |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — walidator · montaż · koperta · pozostałe middleware · kontroler · serwis/repozytorium · testy kontraktu · testy finansów · dowód koperty · infrastruktura testów · UI · nowe testy · dowody · artefakty 336 · rejestr · macierz · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` nie uruchamia niczego (czyta artefakty z repo), `R2` mierzy, `R3` zmienia dokładnie jedną rzecz, `R4`-`R5` mierzą |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6394/5534 wolne (`lsof` przy wydaniu), brak kontenera `cx-day347-pg`, brak gałęzi `codex/day347-*` i worktree; 348/349/350 mają rozłączne porty i pliki; paczka 343-346 ma zarezerwowany przedział 6390-6393/5530-5533 i rozłączny temat |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: wygaszenie koperty, `403` kontra `503`, kaskada jako osobne defekty, atrapa bazy, `NODE_ENV=test` bez `RUN_DB_TESTS`, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
