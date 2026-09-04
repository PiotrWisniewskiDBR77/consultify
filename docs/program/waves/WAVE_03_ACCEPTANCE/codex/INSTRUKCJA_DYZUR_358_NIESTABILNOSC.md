# INSTRUKCJA DYŻURU nr 358 — Codex — „★★★ NIESTABILNOŚĆ BLOKU 3 — DRUGA PRÓBA, INNĄ METODĄ. Dyżur 349 zrobił rzecz uczciwą: miał kandydata na przyczynę (advisory lock), sprawdził go WŁASNYM dowodem mutacyjnym i SAM SWOJEGO KANDYDATA ODRZUCIŁ — po usunięciu locka dziesięć przebiegów też wyszło zielonych. Bezpiecznika nie dodał, żeby nie commitować atrapy. **Przyczyna pozostaje NIEZNANA.** Twarde fakty: `day274`/`day275`/`day276`/`day277` bywają czerwone raz i zielone przy ponowieniu **bez zmian kodu**. ★★ SPROSTOWANIE, KTÓREGO NIE WOLNO COFNĄĆ: `vitest.config.ts:339` ustawia **`retry: 0`**; wcześniejsza teza o `retry: CI ? 3 : 1` jest **FAŁSZYWA** — stary zapis żyje wyłącznie w komentarzu, a `server/vitest.config.ts` (config, którym Blok 3 realnie biegnie) **nie ustawia `retry` w ogóle**. Tam przyczyny nie ma. ★★ ZADANIE: zawęzić przyczynę **inną metodą** niż poprzednio — najpierw ROZDZIELIĆ stały rdzeń czerwieni od pierścienia rotującego, potem obalać kandydatów pojedynczo. ★ ZAKAZ „naprawiania" przez `.skip`, `.todo`, `--retry`, poszerzanie `exclude`, obniżanie progów i zmianę `retry` w konfiguracji. ★ Jeżeli po uczciwej próbie przyczyny nie znajdziesz — **napisz to wprost i NIE dokładaj atrapy bezpiecznika**, tak jak zrobił dyżur 349. To jest wynik akceptowalny; udawanie nie jest"

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
> **wyłącznie** `/private/tmp/cx-day358-niestabilnosc`.

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
Zakres: **DIAGNOSTYCZNE — **sześć plików Bloku 3 G19**: `server/src/routes/__tests__/{ai.agentHubRateLimitRouting,day274-ocena-dociera-do-listy.pg,day275-method-outputs-kontrakt.pg,day276-deck-autosave-persist.pg,day276-workbook-cell-persist.pg,day277-decyzje-zapis.pg}.test.ts` plus łańcuch, którego one dotykają. Produktem jest **przyczyna z `plik:linia` i dziesięć kolejnych przebiegów bez zmiany wyniku** ALBO **jawny raport „nie znaleziono" z listą sprawdzonych i OBALONYCH kandydatów, każdy z dowodem obalenia**. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, i plikiem postępu `/private/tmp/cx-day358-postep.md` (poza repo)**.
Trasy front: `Ten dyżur **nie dotyka frontu**. `src/**` pozostaje `TYLKO ODCZYT` bez wyjątku. Jeżeli przyczyna okaże się leżeć po stronie frontu (bardzo mało prawdopodobne — Blok 3 to kontrakty tras przez realny `ApiGateway`), produktem jest brief z `plik:linia`, nie zmiana`. Trasy tył: `★★ SEDNO. Sześć plików Bloku 3 w `server/src/routes/__tests__/` (mianownik: `evidence/g19/mianownik.md`), trasy i kontrolery, które one wołają, oraz bramka członkostwa w `server/src/middleware/auth.middleware.ts` (**TYLKO ODCZYT**, `Z12`/`Z40`). Cztery kształty czerwieni zmierzone w artefaktach: `expected 500 to be 200`, `expected 500 to be 404`, `expected 403 to be 200`, `expected [403,404] to include 500`. **`500` to wyjątek serwera i ma treść, której NIKT dotąd nie odczytał — to jest najcenniejszy brakujący pomiar tego dyżuru.** Baza: efemeryczny kontener `cx-day358-pg` na porcie `6417`, pełne migracje, `DATABASE_URL` jawnie w tej samej linii komendy (`Z20`, `Z25`, `Z26`)`.

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
WT=/private/tmp/cx-day358-niestabilnosc
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
git -C "$VAULT" worktree add "$WT" -b codex/day358-niestabilnosc-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day358-niestabilnosc/config.worktree"
cat "$VAULT/worktrees/cx-day358-niestabilnosc/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day358-scratch
mkdir -p /private/tmp/cx-day358-niestabilnosc-artefakty

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
git -C "$WT" push github-backup codex/day358-niestabilnosc-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 29fcbd4de20ca26d2febc50d9455128cab47ffce..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: szesc plikow Bloku 3 istnieje na markerze
ls -1 server/src/routes/__tests__/ai.agentHubRateLimitRouting.test.ts \
      server/src/routes/__tests__/day274-ocena-dociera-do-listy.pg.test.ts \
      server/src/routes/__tests__/day275-method-outputs-kontrakt.pg.test.ts \
      server/src/routes/__tests__/day276-deck-autosave-persist.pg.test.ts \
      server/src/routes/__tests__/day276-workbook-cell-persist.pg.test.ts \
      server/src/routes/__tests__/day277-decyzje-zapis.pg.test.ts
#   oczekiwane: szesc sciezek, zero bledow

# (2) ★★★ SPROSTOWANIE — retry NIE JEST przyczyna. Sprawdz to PRZED czymkolwiek innym
sed -n '336,344p' vitest.config.ts
bash -c "grep -n 'retry' server/vitest.config.ts" || echo "server/vitest.config.ts: BRAK slowa 'retry' — czyli domyslne retry=0"
#   moje liczby: vitest.config.ts wiersz 339 = 'retry: 0'; server/vitest.config.ts = ZERO trafien.
#   ★ Blok 3 biegnie configiem server/vitest.config.ts. Ponowien nie ma w ZADNYM z dwoch. Nie szukaj tam.

# (3) ★★★ TEZA GLOWNA — TRZY ARTEFAKTY, TRZY ZESTAWY NAZW, NIE TRZY LICZBY
for F in evidence/g19/blok3-marker.json \
         evidence/g19/day335-artefakty/blok3-przed.json \
         evidence/g19/day335-artefakty/blok3-po.json \
         evidence/g19/day348-artefakty/blok3-przed.json; do
  echo "== $F"
  node -e "const j=require('./$F');console.log(' suites',j.numTotalTestSuites,j.numPassedTestSuites,j.numFailedTestSuites,'| tests',j.numTotalTests,j.numPassedTests,j.numFailedTests,'| wpisow',j.testResults.length);for(const r of j.testResults)for(const a of r.assertionResults||[])if(a.status!=='passed')console.log('   RED',r.name.replace(/^.*__tests__\//,''),'::',a.title);"
done
#   moje liczby (do OBALENIA albo POTWIERDZENIA):
#     blok3-marker.json ......... 18/11/7 — RED: day274 x1, day276-deck x2, day276-workbook x2, day277 x2
#     day335 blok3-przed.json ... 18/12/6 — RED: day274 x1, day275 x1, day276-workbook x2, day277 x2
#     day335 blok3-po.json ...... 18/18/0 — ZERO czerwieni (suita POTRAFI byc cala zielona)
#     day348 blok3-przed.json ... 18/11/7 — RED: day275 x1, day276-deck x2, day276-workbook x2, day277 x2
#   ★★ DWA WNIOSKI, ktore masz sprawdzic:
#   (a) '12/18' ze zlecenia to NIE jest trzeci wynik — to para numTotalTestSuites=12 / numTotalTests=18,
#       stala we WSZYSTKICH czterech plikach. Trzeciego pomiaru prawdopodobnie nigdy nie bylo.
#   (b) DWA przebiegi daja '18/11/7' z ROZNYMI nazwami. Porownanie po liczbach bylo tu bezuzyteczne (Z37).

# (4) ★★★ PODZIAL, KTORY JEST CALA WARTOSCIA TEGO DYZURU
#     STALY RDZEN (czerwony we WSZYSTKICH trzech pomiarach 'przed'): day276-workbook x2, day277 x2 = 4 przypadki
#     PIERSCIEN ROTUJACY (raz czerwony, raz zielony): day274 x1, day275 x1, day276-deck x2
#   ★ Rdzen to prawdopodobnie REALNY DEFEKT, nie niestabilnosc. Pierscien to niestabilnosc.
#     Zmierz to sam w R1 i rozstrzygnij — moj podzial jest teza, nie faktem.

# (5) ★★★ SYGNATURA CZASOWA — zielone sa WOLNE, czerwone sa SZYBKIE
node -e "for(const F of ['evidence/g19/day348-artefakty/blok3-przed.json','evidence/g19/day335-artefakty/blok3-po.json']){const j=require('./'+F);console.log('==',F);for(const r of j.testResults)for(const a of r.assertionResults||[])console.log('  ',a.status,Math.round(a.duration)+'ms',a.title.slice(0,55));}"
#   moje liczby: ten sam przypadek day277 'owner writes all five fields' — 43 ms gdy CZERWONY, 201 ms gdy ZIELONY.
#   day275 'zwraca dokladny stan obszaru' — 41 ms RED, 186 ms GREEN. day276-workbook — 37 ms RED, 87 ms GREEN.
#   ★★ To NIE jest przekroczenie limitu czasu. To jest FAIL-FAST: zadanie wraca 500/403 zanim zrobi robote.
#     Szukaj miejsca, w ktorym zadanie konczy sie WCZESNIE — nie miejsca, w ktorym trwa dlugo.

# (6) TEZA: config Bloku 3 NIE losuje kolejnosci i NIE wylacza rownoleglosci
bash -c "grep -nE 'sequence|shuffle|fileParallelism|pool|isolate|maxConcurrency|testTimeout' server/vitest.config.ts" \
  || echo "server/vitest.config.ts: brak tych kluczy — obowiazuja DOMYSLNE Vitest"
bash -c "grep -nE 'singleFork|order:|fileParallelism|maxConcurrency|pool:' vitest.config.ts"
#   moje liczby: server/vitest.config.ts ustawia TYLKO testTimeout: 10000 — reszta domyslna
#   (pool=forks, fileParallelism=true, isolate=true, sequence.shuffle=FALSE).
#   ★ Root vitest.config.ts ma 'order: random' (345) i 'singleFork: false' (305) — ale to NIE SA klucze
#     Vitesta w tym miejscu (prawdziwe to sequence.shuffle i poolOptions.forks.singleFork), a Blok 3
#     i tak biegnie DRUGIM configiem. Potwierdz albo obal — jesli kolejnosc nie jest losowa,
#     kandydat 'kolejnosc plikow' pada bez ani jednego przebiegu.

# (7) TEZA: kazdy z szesciu plikow sieje wlasne, losowe identyfikatory — kolizja ID jest wykluczona
bash -c "grep -c 'randomUUID' server/src/routes/__tests__/day27*-*.pg.test.ts"
bash -c "grep -n 'beforeEach' server/src/routes/__tests__/day27*-*.pg.test.ts" || echo "ZERO beforeEach — wszystkie uzywaja beforeAll"
#   moje liczby: wszystkie cztery pliki day27x uzywaja randomUUID i beforeAll; beforeEach = 0 trafien.
#   ★ Kandydat 'kolejnosc w beforeEach' zaczyna wiec od stanu OBALONEGO — potwierdz to i zapisz.

# (8) TEZA: liscie slownikow i bramki kanonu na markerze
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35198 · en 33065 · wszystkie cztery bramki = 0

# (9) TEZA: bezpiecznik zakazu ponowien ISTNIEJE i pilnuje konfiguracji
ls -la tests/unit/config/vitestNoRetry.contract.test.ts
#   oczekiwane: plik istnieje. ★ To on odrzuci kazda probe 'naprawy' przez przywrocenie retry.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day358-niestabilnosc-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6417`. Twój JEDYNY port harnessu to `5557`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day358-pg`**. **ZAKAZANE:** `porty `5554`/`6414` (dyżur 355), `5555`/`6415` (dyżur 356), `5556`/`6416` (dyżur 357) oraz WSZYSTKIE porty spoza pary `5557`/`6417`; kontenery `cx-day355-pg`, `cx-day356-pg`, `cx-day357-pg` i każdy inny `cx-day*-pg``. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur **nie zamawia ani jednej flagi funkcyjnej i nie zmienia ani jednej wartości domyślnej**. Zmienne środowiskowe pomiaru (`RUN_DB_TESTS`, `MOCK_DB`, `DB_TYPE`, `ENABLE_V8_GLOBAL`, `ENABLE_TEST_AUTH_BYPASS`, `DATABASE_URL`) NIE są flagami produktu — wolno je podawać w komendzie, NIE WOLNO zmieniać warunków, które je czytają, w kodzie`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``src/**` w całości, `server/src/middleware/**`, `server/src/routes/**` poza sześcioma plikami Bloku 3, `server/src/controllers/**`, `server/src/services/**`, `public/locales/**`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tsconfig*.json`, `.github/workflows/**`, `server/migrations/**` oraz **wszystkie 16 plików `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`**`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY358_NIESTABILNOSC_REPORT.md`. **Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md`, w szczególności wiersza `G19`** — ten dyżur diagnozuje niestabilność pomiaru, a nie orzeka o module; podniesienie `G19` na podstawie tej pracy jest **jawnie zakazane**. Dodatkowo wolno: zapisać dowody pod `evidence/g19/day358/` (**katalog NIE ISTNIEJE na markerze — tworzysz go**, `git add -f`) oraz dopisać jedną nową sekcję w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze (sekcje doszły dziś do `Q`, ale równolegle dopisują inni autorzy — literę sprawdzasz komendą tuż przed commitem). Plik postępu `/private/tmp/cx-day358-postep.md` żyje POZA repo. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day358-niestabilnosc-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day358-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **★★ ZAKAZ „NAPRAWIANIA" NIESTABILNOŚCI PRZEZ WYCISZENIE.** Zakazane bezwzględnie i bez wyjątku: `.skip`, `.only`, `.todo`, `.fails`, `--retry` w komendzie pomiarowej, `retry` w opcjach `describe`/`it`, zmiana `retry` w `vitest.config.ts` albo `server/vitest.config.ts`, poszerzenie `exclude`/`testIgnore`, podniesienie `testTimeout` w celu ukrycia objawu, obniżenie progów pokrycia, `continue-on-error` na jobie testowym. **Uznasz którąkolwiek z tych rzeczy za jedyne wyjście → STOP z uzasadnieniem, nie cichy commit.** ★★ ZAKAZ COFANIA SPROSTOWANIA: `vitest.config.ts:339` ma `retry: 0` i **tak zostaje**; wcześniejszy zapis `retry: CI ? 3 : 1` żyje wyłącznie w komentarzu historycznym i jest tam CELOWO. Bezpiecznik `tests/unit/config/vitestNoRetry.contract.test.ts` pilnuje tego — nie osłabiasz go. ★★ ZAKAZ ZMIANY WIERSZA `G19` w jakimkolwiek `MODULE_ACCEPTANCE.md`. ★★ ZAKAZ `pkill`/`killall` — zabijasz WYŁĄCZNIE własny kontener po nazwie `cx-day358-pg` | Niestabilny pomiar jest gorszy niż brak pomiaru: brak pomiaru każe zmierzyć, a niestabilny każe **wierzyć temu przebiegowi, który akurat pasuje**. Blok 3 broni izolacji między organizacjami — to jest jedyna rzecz trzymająca dane jednego klienta z dala od drugiego. Suita, która raz świeci na czerwono, a raz na zielono bez zmiany kodu, nie broni niczego: pierwszy zielony przebieg zostanie użyty jako dowód, że izolacja działa. Dyżury 335, 348 i 349 zmierzyły ją trzy razy i trzy razy dostały co innego. Dopóki nie wiadomo, dlaczego, **żadna liczba z Bloku 3 nie może być podstawą do podniesienia wiersza `G19`** |

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
cd /private/tmp/cx-day358-niestabilnosc

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day358-pg psql -U postgres -d cx358 \
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
cd /private/tmp/cx-day358-niestabilnosc

docker run -d --name cx-day358-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx358 \
  -p 127.0.0.1:6417:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day358-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6417/cx358 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6417/cx358 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day358-niestabilnosc && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6417/cx358 \
JWT_SECRET=cx358-test-secret-do-not-reuse-min-32-znaki \
npx vitest run server/src/routes/__tests__/ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day358-niestabilnosc-artefakty/blok3-niestabilnosc.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day358-niestabilnosc && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/__tests__/ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day358-niestabilnosc-artefakty/blok3-niestabilnosc.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day358-niestabilnosc/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day358-pg psql -U postgres -d cx358 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day358-pg`.
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
> **(e) **(e) ★★ PUŁAPKA WŁAŚCIWA TEMU DYŻUROWI: przyrząd pomiarowy kłamie w tym samym raporcie dwoma liczbami.** Ten sam plik JSON podaje `numTotalTestSuites: 12` i `numTotalTests: 18`, mając **6 wpisów w `testResults`** — licznik suit nie odpowiada ani liczbie plików, ani liczbie przypadków. Zdanie „Blok 3 to 12 z 18" najprawdopodobniej powstało z odczytania tych dwóch pól jako pary „zielone/wszystkie" i **nie jest trzecim pomiarem, tylko trzecim odczytem tego samego pliku**. Druga odmiana tej samej pułapki: **dwa różne przebiegi dały identyczne `18/11/7` przy RÓŻNYCH zestawach nazw** — porównanie po liczbach nie wykryłoby tu niczego (`Z37`). Trzecia: uruchomienie Bloku 3 **z katalogu głównego zamiast z `server/`** daje `0` wykonanych przypadków i `exit 0`, co wygląda jak sukces, a jest BŁĘDEM KOMENDY (zdarzyło się dyżurowi 335). Za każdym razem, gdy podajesz liczbę z Bloku 3, podajesz obok **listę pełnych nazw przypadków****
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day358-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day358-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (``R1`, `R2`, `R3``) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6417` albo `5557` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6417` albo `5557`** (`Z7`).

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

## ★★ UZUPEŁNIENIE DO SEKCJI „JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE" (wyżej)

Sekcja wyżej obowiązuje w całości. Poniższe dwa zdania mają **pierwszeństwo**
przed jej brzmieniem — pierwszego w niej nie ma, a drugie odsyła do sekcji,
która w tym dokumencie nazywa się inaczej.

1. **★ Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz rozbieżność wprost.**
   Dotyczy KAŻDEJ liczby w tym dokumencie, także tych, które autor zmierzył sam przy wydaniu.
2. **★ Obalenie którejkolwiek tezy z sekcji „MOJA HIPOTEZA" albo „Zmierz moje
   liczby sam" jest SUKCESEM dyżuru, a nie porażką.** Zapisz to w „Korektach
   wobec instrukcji" z dowodem i idź dalej. (Sekcja wyżej mówi „TEZY
   ZLECENIA…" — w tym dokumencie te sekcje noszą nazwy podane tutaj.)

---

## Po co ten dyżur istnieje

**Dyżur 349 zrobił rzecz, którą ten program ceni wyżej niż zieloną liczbę.** Miał kandydata
na przyczynę niestabilności — advisory lock. Sprawdził go **własnym dowodem mutacyjnym**:
usunął lock i puścił dziesięć przebiegów. Wszystkie wyszły zielone, czyli **lock nie był
przyczyną**. I wtedy 349 **sam odrzucił swojego kandydata** zamiast dopisać bezpiecznik,
który wyglądałby dobrze w raporcie. Bezpiecznika nie dodał świadomie — żeby nie commitować
atrapy. **To jest wzorzec, którego trzymasz się i Ty.**

**Przyczyna pozostaje nieznana.** To jest druga próba i ma iść **inną metodą**.

**Twarde fakty, wszystkie sprawdzalne w repo:**

Pliki `day274`, `day275`, `day276` (dwa) i `day277` bywają czerwone raz i zielone przy
ponowieniu **bez żadnej zmiany kodu**. W repo leżą cztery artefakty tego samego Bloku 3:

| Artefakt | Liczby | Czerwone przypadki (po nazwach) |
| --- | --- | --- |
| `evidence/g19/blok3-marker.json` | `18/11/7` | `day274` ×1, `day276-deck` ×2, `day276-workbook` ×2, `day277` ×2 |
| `evidence/g19/day335-artefakty/blok3-przed.json` | `18/12/6` | `day274` ×1, `day275` ×1, `day276-workbook` ×2, `day277` ×2 |
| `evidence/g19/day348-artefakty/blok3-przed.json` | `18/11/7` | `day275` ×1, `day276-deck` ×2, `day276-workbook` ×2, `day277` ×2 |
| `evidence/g19/day335-artefakty/blok3-po.json` | `18/18/0` | **żaden** |

**Przeczytaj tę tabelę dwa razy.** Dwa różne przebiegi dały **identyczne `18/11/7`** przy
**różnych zestawach nazw**. Gdyby ktokolwiek porównał je po liczbach, uznałby je za ten sam
wynik. To jest `Z37` w postaci zmierzonej, nie teoretycznej.

**Czwarty wiersz jest najważniejszy: suita POTRAFI być cała zielona.** `18/18/0` po naprawie
payloadu z dyżuru 335 dowodzi, że nie mamy do czynienia z sześcioma trwale zepsutymi plikami.

---

## ★★ SPROSTOWANIE, KTÓREGO NIE WOLNO COFNĄĆ

Wcześniejsza teza nadzorcy brzmiała: „`vitest.config.ts` ustawia `retry: CI ? 3 : 1`".
**Ta teza jest FAŁSZYWA.** Stan faktyczny na markerze, sprawdzony komendą (2) z `§0.3`:

- `vitest.config.ts:339` ustawia **`retry: 0`**. Zapis `retry: process.env.CI ? 3 : 1` żyje
  wyłącznie w **komentarzu historycznym** nad tym wierszem — jest tam CELOWO, jako
  wyjaśnienie, dlaczego bezpiecznik powstał. Nie kasujesz go i nie „porządkujesz".
- `server/vitest.config.ts` — **config, którym Blok 3 realnie biegnie** — nie zawiera
  słowa `retry` w ogóle, czyli obowiązuje domyślne `retry: 0`.
- Istnieje bezpiecznik `tests/unit/config/vitestNoRetry.contract.test.ts`, który pilnuje,
  żeby ponowienia nie wróciły. **Nie osłabiasz go i nie omijasz.**

**Wniosek: ponowień nie ma w żadnym z dwóch configów. Tam przyczyny nie ma.** Każda minuta
wydana na sprawdzanie `retry` jest minutą straconą — i to jest jedyne zdanie w tym dokumencie,
którego nie musisz weryfikować samodzielnie przed pominięciem, bo komenda (2) rozstrzyga je
w trzy sekundy.

**★★ UWAGA — ten sam fałsz stoi wyżej, w tabeli zakazów.** Kolumna uzasadnienia `Z29` mówi
„`vitest.config.ts` ustawia `retry: CI ? 3 : 1`". **To jest opis stanu sprzed dyżuru 42**,
który tę wartość wyzerował; szkielet instrukcji nie został po tamtej zmianie poprawiony.
**Sam zakaz `Z29` obowiązuje bez zmian** — `--retry=0` w każdej komendzie pomiarowej —
zmienił się wyłącznie powód, dla którego jest potrzebny. **Nie „naprawiaj" tego przez
przywrócenie ponowień w konfiguracji.** Rozbieżność zapisz w „Korektach wobec instrukcji";
poprawienie szkieletu należy do nadzorcy.

---

## ★★ MOJA HIPOTEZA — masz ją OBALIĆ ALBO POTWIERDZIĆ, nie przyjąć

| # | Teza | Na czym ją opieram | Jak ją obalisz |
| --- | --- | --- | --- |
| `H1` | „Trzeci pomiar `12/18`" **nie istnieje**. `12` i `18` to `numTotalTestSuites` i `numTotalTests` — **stała para we wszystkich czterech artefaktach**, nie wynik | komenda (3) z `§0.3`: każdy z czterech plików podaje `12` suit i `18` testów, mając 6 wpisów w `testResults` | Pokaż artefakt, w którym `12` jest liczbą **zielonych przypadków**. Wtedy teza pada i mamy naprawdę trzeci wynik |
| `H2` | Czerwienie dzielą się na **stały rdzeń** (`day276-workbook` ×2, `day277` ×2 — czerwone we wszystkich trzech pomiarach „przed") i **pierścień rotujący** (`day274` ×1, `day275` ×1, `day276-deck` ×2) | tabela wyżej, artefakty w repo | Puść suitę dziesięć razy. Jeżeli rdzeń też rotuje — teza pada. Jeżeli pierścień okaże się stały — teza pada |
| `H3` | **Rdzeń to REALNY DEFEKT, nie niestabilność.** Niestabilność dotyczy wyłącznie pierścienia | `H2` + `blok3-po.json` = `18/18/0`, czyli rdzeń **da się** naprawić | Jeżeli rdzeń przejdzie zielono w choćby jednym z Twoich dziesięciu przebiegów bez zmiany kodu — teza pada i rdzeń też jest niestabilny |
| `H4` | **Czerwony przebieg jest SZYBKI, zielony jest WOLNY** — to nie jest przekroczenie limitu czasu, tylko `fail-fast` | komenda (5) z `§0.3`: `day277` „owner writes all five fields" = **43 ms na czerwono**, **201 ms na zielono**; `day275` = 41 ms / 186 ms; `day276-workbook` = 37 ms / 87 ms | Zmierz czasy w swoich przebiegach. Jeżeli czerwone są wolniejsze albo równe zielonym, teza pada i wracają kandydaci czasowe (`testTimeout: 10000` w `server/vitest.config.ts`) |
| `H5` | **Kolejność plików nie jest przyczyną, bo nie jest losowa.** `server/vitest.config.ts` nie ustawia `sequence.shuffle`; `order: 'random'` w `vitest.config.ts:345` to klucz nieistniejący w tym miejscu (jak zdemaskowany już `retryMode: 'run'`) i dotyczy innego configu | komenda (6) z `§0.3` | Wypisz **rozstrzygniętą** konfigurację (`vitest --config server/vitest.config.ts list` albo log z `--reporter=verbose`) i pokaż, że kolejność się zmienia między przebiegami. Wtedy teza pada |
| `H6` | **Kolejność w `beforeEach` nie jest przyczyną, bo `beforeEach` w tych plikach nie ma.** Wszystkie cztery pliki `day27x` używają `beforeAll` i `randomUUID` — kolizja identyfikatorów między plikami jest wykluczona | komenda (7) z `§0.3`: `beforeEach` = 0 trafień | Znajdź `beforeEach` albo stały identyfikator w którymkolwiek z sześciu plików. Wtedy teza pada |
| `H7` | Najcenniejszy brakujący pomiar to **treść odpowiedzi `500`**. Trzy dyżury odczytały kod statusu i **ani jeden nie odczytał ciała błędu ani logu serwera** | przegląd raportów 335/348/349 i artefaktów: w JSON-ach są wyłącznie `expected 500 to be 200` | Pokaż w artefaktach zapisaną treść `500`. Jeżeli jest — teza pada i masz gotowy trop |

---

## ★ Zmierz moje liczby sam

Każda liczba w tym dokumencie jest **rozkazem pomiarowym**, nie faktem. Dwie rzeczy ze
zlecenia nadzorcy autor tej instrukcji **obalił już przy wydaniu** i zapisuje to jawnie,
żeby nie wróciły jako „zweryfikowany fakt":

> **Zlecenie mówiło: „trzy niezależne pomiary tego samego markera dały trzy różne wyniki:
> `18/11/7`, `18/12/6` oraz `12/18`".** Zmierzyłem: `12/18` to `numTotalTestSuites` /
> `numTotalTests` — para **stała we wszystkich czterech artefaktach**, także w tym, który
> jest w 100% zielony. To najprawdopodobniej **nie jest trzeci pomiar, tylko trzeci odczyt
> tego samego pliku**. Sprawdź to komendą (3) i rozstrzygnij.

> **Zlecenie mówiło: „`day274`/`day275`/`day276` bywają czerwone".** Do tej listy należy
> także **`day277`** — czerwony we wszystkich trzech pomiarach „przed" i zielony
> w `blok3-po.json`. Pomijanie go zawęża zbiór o połowę stałego rdzenia.

---

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: TESTY · TRASA · KONTROLER · SERWIS · BRAMKA · KONFIGURACJA · DOWODY

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
brief z `plik:linia` + rekomendację jako diff **nienałożony**. Pozycja z takim produktem
jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Sześć plików Bloku 3** | `server/src/routes/__tests__/{ai.agentHubRateLimitRouting,day274-ocena-dociera-do-listy.pg,day275-method-outputs-kontrakt.pg,day276-deck-autosave-persist.pg,day276-workbook-cell-persist.pg,day277-decyzje-zapis.pg}.test.ts` | **★ WĄSKA LICENCJA:** wolno **URUCHAMIAĆ dowolną liczbę razy** i wolno **dopisać diagnostykę** (log treści odpowiedzi, log czasu, log stanu bazy) w `R1`/`R2`. **Zakaz: `.skip`, `.only`, `.todo`, `.fails`, usuwania przypadków, osłabiania asercji, podnoszenia `testTimeout` w pliku, dopisywania `retry`.** Diagnostykę zostawiasz w kodzie **tylko wtedy, gdy jest trwale użyteczna** — inaczej cofasz ją przez `cp` przed commitem | — |
| **Trasa · kontroler · serwis · repozytorium wołane przez te testy** | `server/src/routes/**` (poza szóstką), `server/src/controllers/**`, `server/src/services/**`, `server/src/repositories/**` | **TYLKO ODCZYT do czasu wskazania przyczyny.** Jeżeli `R2` wskaże przyczynę z `plik:linia` **w tym obszarze**, `R3` dostaje **wąską licencję na jedną zmianę w jednym pliku**, z parą mutacyjną i dziesięcioma przebiegami. Zmiana bez wskazanej przyczyny = odrzucenie pozycji | Brief z `plik:linia` |
| **Bramka członkostwa** | `server/src/middleware/auth.middleware.ts` i cały `server/src/middleware/**` | **★★ NIETYKALNE DO ZAPISU — `Z12` i `Z40`.** Kształt `403` jest **objawem**, nie miejscem naprawy. „Naprawa" polegająca na tym, że bramka przestaje pytać bazy albo dopuszcza status inny niż `ACTIVE`, to **odrzucenie całego dyżuru**, nie pozycji | Brief z `plik:linia` + wpis do raportu |
| **Konfiguracja testów** | `vitest.config.ts`, `server/vitest.config.ts`, `server/vitest.config.v8-db.ts`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**` | **★★ NIETYKALNE DO ZAPISU — `Z18`, NAJOSTRZEJSZY.** Wolno **czytać** i wolno **cytować `plik:linia`**. Wolno **zmutować tymczasowo** w `R2` jako dowód (np. `fileParallelism: false`), pod warunkiem cofnięcia przez `cp` i **pustego `git diff`**. Trwała zmiana `retry`, `exclude`, `testTimeout` albo progów = odrzucenie dyżuru | Cytat + wynik przebiegu |
| **Bezpiecznik zakazu ponowień** | `tests/unit/config/vitestNoRetry.contract.test.ts` | **★ WĄSKA LICENCJA:** wolno **URUCHAMIAĆ**. **Zakaz osłabiania i usuwania przypadków** | — |
| **Nowe testy i skrypty diagnostyczne** | `tests/**` (NOWE pliki, `git add -f`), `scripts/**` (NOWY skrypt, `git add -f`) | **★ PEŁNA LICENCJA na dodanie**, z zastrzeżeniem `Z18` i `Z31`. **Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`.** Po dodaniu: `node scripts/dev/reachability-from-root.mjs --check-baseline` musi dać `exit 0` | — |
| **Migracje** | `server/migrations/**` | **TYLKO ODCZYT.** Uruchamiasz je w `BLOKU 0` na własnym kontenerze; **nie dopisujesz ani nie zmieniasz żadnej.** Jeżeli przyczyna leży w migracjach — produktem jest **brief z `plik:linia`**, nie migracja; pozycja z briefem jest ZROBIONA, nie STOP | Brief |
| **Front** | `src/**` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** Blok 3 to kontrakty tras; front tu nie występuje | Opis w raporcie |
| **CI** | `.github/workflows/**` | **TYLKO ODCZYT (`Z38`/`Z39`).** Jeżeli uznasz, że Blok 3 powinien mieć bramkę w CI — rekomendujesz to jako diff **nienałożony** i jako pytanie do właściciela | Diff nienałożony + brief |
| **Macierze odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie 16) | **★★ NIETYKALNE DO ZAPISU — w szczególności wiersz `G19`.** Ten dyżur diagnozuje przyrząd, a nie orzeka o module | — |
| **Dowody** | `evidence/g19/day358/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**, `git add -f`) | **★ PEŁNA LICENCJA na tworzenie i dopisywanie.** **Wszystkie JSON-y przebiegów, logi i tabele lądują TUTAJ, w repo.** Dowód w `/private/tmp` nie jest dowodem — cztery razy jednego dnia trzeba było takie ratować | — |
| **Istniejące artefakty G19** | `evidence/g19/**` poza `day358/` | **TYLKO ODCZYT — cudza praca, dowód historyczny.** Czytasz je obowiązkowo w `R1`; **nie nadpisujesz i nie kasujesz** | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem (dziś doszły do `Q`) | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY358_NIESTABILNOSC_REPORT.md` (**NOWY**) | `R5` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `server/src/routes/v8/finance-v2/__tests__/**`, `evidence/g15/**` (dyżur 355) · `src/components/MyWork/prototypes/**`, `tests/unit/flags/**`, `evidence/day356/**` (dyżur 356) · `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, `evidence/day357/**` (dyżur 357) · licznik kompletności, 20 ekranów podglądu, etykiety narzędzi (dyżury 351-354) | **TYLKO ODCZYT** | Wpis do raportu |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

---

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
#   moje liczby: wszystkie 0. ★ Ostatni sprawdzasz PO KAZDYM dodaniu pliku do tests/.

# (c) ★★ WLASCIWY TEMU DYZUROWI — konfiguracja ponowien MUSI byc nietknieta
bash -c "grep -n 'retry: 0' vitest.config.ts"
bash -c "grep -c 'retry' server/vitest.config.ts" || echo "server/vitest.config.ts: 0 trafien — poprawnie"
git diff --stat -- vitest.config.ts server/vitest.config.ts
#   oczekiwane PRZED i PO: wiersz 339 = 'retry: 0'; server config bez slowa 'retry'; git diff PUSTY
```

**Jeżeli którakolwiek liczba zmaleje (słowniki) albo bramka zgaśnie — naprawiasz KODEM,
nigdy progiem i nigdy `--no-verify`** (`Z35`). **Jeżeli `git diff` na configach nie jest
pusty na koniec — cofasz zmianę przez `cp`, zanim zrobisz cokolwiek innego.**

---

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | plików w Bloku 3 | `6` | komenda (1) z `§0.3` | TAK |
| 2 | przypadków w Bloku 3 | `18` | komenda (3) z `§0.3` | TAK — **stałe we wszystkich czterech artefaktach** |
| 3 | `numTotalTestSuites` w tych samych plikach | `12` | komenda (3) z `§0.3` | TAK — **to jest źródło fałszywego „trzeciego pomiaru"** (`H1`) |
| 4 | wpisów w `testResults` | `6` | komenda (3) z `§0.3` | TAK — `6 ≠ 12`, licznik suit nie odpowiada plikom |
| 5 | przypadków w stałym rdzeniu | `4` (`day276-workbook` ×2, `day277` ×2) | komenda (4) + `R1` | TAK — `H2`/`H3` |
| 6 | przypadków w pierścieniu rotującym | `4` (`day274` ×1, `day275` ×1, `day276-deck` ×2) | komenda (4) + `R1` | TAK |
| 7 | czas przypadku `day277` „owner writes all five fields" na czerwono / na zielono | `43 ms` / `201 ms` | komenda (5) z `§0.3` | TAK — **`H4`, sygnatura `fail-fast`** |
| 8 | wiersz z `retry` w `vitest.config.ts` | `339`, wartość `0` | komenda (2) z `§0.3` | TAK — **sprostowanie** |
| 9 | trafień `retry` w `server/vitest.config.ts` | `0` | komenda (2) z `§0.3` | TAK — **config, którym Blok 3 realnie biegnie** |
| 10 | trafień `beforeEach` w plikach `day27x` | `0` | komenda (7) z `§0.3` | TAK — `H6` startuje z pozycji obalonej |
| 11 | `testTimeout` w `server/vitest.config.ts` | `10000` ms | komenda (6) z `§0.3` | TAK — **jedyny nadpisany klucz; reszta domyślna** |
| 12 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

---

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY358_NIESTABILNOSC_REPORT.md` ·
`evidence/g19/day358/**` (nowy katalog, `git add -f`).

**Zapisujesz WARUNKOWO (tylko z dowodem `R2`/`R3`):**
jeden plik z szóstki Bloku 3 (diagnostyka trwale użyteczna) · **jeden** plik produktu
wskazany jako przyczyna w `R2` · nowe pliki testowe w `tests/` (`git add -f`) · nowy skrypt
w `scripts/` (`git add -f`) · `REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `src/**`, `server/src/middleware/**`, `vitest*.config.ts`,
`server/vitest.config*.ts`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`,
`tests/unit/config/vitestNoRetry.contract.test.ts`, `tsconfig*.json`, `.github/workflows/**`,
`server/migrations/**`, `public/locales/**`, wszystkie `MODULE_ACCEPTANCE.md`,
`evidence/g19/**` poza `day358/`, `evidence/g15/**`, `evidence/day35{6,7}/**`,
`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day358-niestabilnosc
mkdir -p evidence/g19/day358
git diff --name-only --cached | tee evidence/g19/day358/staged.txt
# ★ UWAGA: grep -E NIE ZNA lookaheadow. Katalog wlasny wycinamy OSOBNYM grep -v, nie wzorcem.
bash -c "grep -v '^evidence/g19/day358/' evidence/g19/day358/staged.txt | grep -iE '^src/|^server/src/middleware/|vitest.*config|^tests/setup|^tests/helpers|^tests/__mocks__|vitestNoRetry|^tsconfig|^\.github/|^server/migrations/|^public/locales/|MODULE_ACCEPTANCE|^evidence/g19/|^evidence/g15/|^evidence/day35[67]/|PRZELOT_WLASCICIELA'" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
bash -c "grep -rn '\.skip(\|\.only(\|\.todo(\|\.fails(\|retry' server/src/routes/__tests__/day27*.pg.test.ts server/src/routes/__tests__/ai.agentHubRateLimitRouting.test.ts" \
  && echo "★★ WYCISZENIE W PLIKACH BLOKU 3 — COFNIJ" \
  || echo "brak wyciszen OK"
```

---

## R0 — CZTERY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

1. **Nie zaczynasz od naprawiania. Zaczynasz od ROZDZIELENIA.** Dopóki nie wiesz, które
   przypadki są trwale czerwone, a które rotują, każdy przebieg mierzy mieszankę dwóch
   różnych zjawisk i nic nie rozstrzyga. **To jest metoda, którą ten dyżur różni się od 349.**
2. **Każdy kandydat obalany OSOBNO, z dowodem obalenia.** „Sprawdziłem równoległość
   i kolejność, nic z tego" nie jest wynikiem. Wynikiem jest: kandydat · komenda · liczba
   przebiegów · wynik · zdanie „obalony, bo…". Dyżur 349 zostawił wzór — trzymaj się go.
3. **Odczytaj TREŚĆ błędu, nie kod statusu.** `500` to wyjątek i ma komunikat oraz ślad
   stosu. Trzy dyżury odczytały `expected 500 to be 200` i ani jeden nie zapisał, co
   serwer właściwie powiedział. **To jest najtańszy nieodrobiony pomiar w tym temacie.**
4. **Jeżeli nie znajdziesz przyczyny — napisz to wprost i NIE dokładaj atrapy bezpiecznika.**
   Raport „nie znaleziono, oto siedmiu kandydatów i dowody ich obalenia" jest
   **pełnowartościowym wynikiem odbioru**. Bezpiecznik, który zawsze świeci na zielono,
   nie jest.

---

## R1 — ROZDZIELENIE RDZENIA OD PIERŚCIENIA: DZIESIĘĆ PRZEBIEGÓW PO NAZWACH (rdzeń)

1. **Postaw bazę wg `BLOKU 0`** (kontener `cx-day358-pg`, port `6417`, pełne migracje,
   dwa przebiegi migracji — drugi ma być bezbłędny i bez zmian). **Dopiero potem** cokolwiek
   mierzysz (`Z20`).
2. **Puść Blok 3 dziesięć razy**, z cwd `server/`, configiem `server/vitest.config.ts`,
   wariantem (B), z `--retry=0` i `--reporter=json --outputFile=evidence/g19/day358/przebieg-NN.json`
   dla `NN` od `01` do `10`. **Uruchomienie z katalogu głównego daje `0` wykonanych
   przypadków i `exit 0` — to jest BŁĄD KOMENDY, nie `PASS`** (zdarzyło się dyżurowi 335).
   Po każdym przebiegu sprawdź, że `numTotalTests` = `18`; jeżeli nie — komenda jest zła,
   nie produkt.
3. **Zbuduj tabelę 18 wierszy × 10 kolumn** (przypadek × przebieg, `GREEN`/`RED`),
   **po pełnych nazwach `fullName`, nigdy po liczbach** (`Z37`). Zapisz jako
   `evidence/g19/day358/r1-macierz.md`. To jest **główny produkt tego dyżuru** i bez niego
   żadna dalsza pozycja nie ma podstawy.
4. **Rozstrzygnij `H2` i `H3`.** Przypadek czerwony w `10/10` = **rdzeń**. Przypadek
   o wyniku mieszanym = **pierścień**. Podaj obie listy imiennie i jawnie napisz, czy mój
   podział (`4` + `4`) się potwierdził. **Jeżeli rdzeń rotuje albo pierścień jest stały —
   to jest cenniejszy wynik niż potwierdzenie.**
5. **Zmierz czasy (`H4`).** Dla każdego przypadku o wyniku mieszanym podaj medianę czasu
   na czerwono i na zielono. Potwierdź albo obal sygnaturę „czerwony szybki / zielony wolny".
6. Zapisz dziesięć JSON-ów **do repo**, nie do `/private/tmp`. **`git add -f`.**

**Commit po `R1`. Push na `github-backup` (`Z34a`).**

---

## R2 — TREŚĆ BŁĘDU I OBALANIE KANDYDATÓW POJEDYNCZO (rdzeń)

**Kolejność jest wiążąca: najpierw punkt 1, bo może rozstrzygnąć wszystko naraz.**

1. **★★ ODCZYTAJ TREŚĆ `500`.** Dopisz do jednego przypadku z rdzenia (np. `day277`
   „owner writes all five fields") log ciała odpowiedzi i log błędu serwera przy statusie
   innym niż oczekiwany. Puść pięć razy i **wklej do raportu dosłowną treść komunikatu**.
   Zapisz jako `evidence/g19/day358/r2-tresc-500.txt`. Jeżeli komunikat wskaże przyczynę —
   masz ją, idziesz do `R3` i **pomijasz resztę kandydatów, pisząc dlaczego**.
2. **Kandydat: równoległość plików.** Puść Blok 3 dziesięć razy z `--no-file-parallelism`.
   Wynik identyczny w `10/10` → równoległość jest **warunkiem koniecznym** i to jest trop.
   Wynik nadal mieszany → kandydat **obalony**, zapisz to.
3. **Kandydat: kolejność plików (`H5`).** **Najpierw udowodnij, czy kolejność w ogóle się
   zmienia** — wypisz rozstrzygniętą konfigurację i porównaj kolejność plików w dwóch
   przebiegach. Jeżeli jest stała, kandydat jest **obalony bez ani jednego dodatkowego
   przebiegu** i piszesz to. Jeżeli się zmienia, moja teza `H5` pada — puść z wymuszoną
   stałą kolejnością i porównaj.
4. **Kandydat: stan współdzielony między plikami.** Puść **każdy z sześciu plików osobno**,
   dziesięć razy każdy. Plik czerwony **także w izolacji** → to defekt wewnętrzny tego pliku
   albo produktu, **nie interakcja**. Plik zielony `10/10` w izolacji i czerwony w pakiecie →
   **interakcja potwierdzona**; wtedy uruchamiaj **pary** (ofiara + każdy inny plik), żeby
   nazwać agresora. Wyniki do `evidence/g19/day358/r2-izolacja.md`.
5. **Kandydat: wyciek połączeń do bazy.** W trakcie przebiegu pakietu zmierz
   `SELECT count(*) FROM pg_stat_activity` i porównaj z `SHOW max_connections` na **swoim**
   kontenerze. Podaj wartość szczytową. Jeżeli szczyt jest daleko od limitu, kandydat jest
   **obalony liczbą**, nie przeczuciem.
6. **Kandydat: zegar i strefa czasowa.** Puść pakiet z `TZ=UTC` i z `TZ=Europe/Warsaw`,
   po pięć razy. Różnica wyniku = trop; brak różnicy = kandydat obalony.
7. **Kandydat: kolejność w `beforeEach` (`H6`).** Zaczyna z pozycji obalonej — `beforeEach`
   w tych plikach nie ma. **Potwierdź komendą i zamknij go jednym zdaniem**, nie przebiegami.
8. **Tabela kandydatów** — obowiązkowa, do `evidence/g19/day358/r2-kandydaci.md`:
   kandydat · komenda · liczba przebiegów · wynik · **werdykt: POTWIERDZONY / OBALONY /
   NIEROZSTRZYGNIĘTY** · zdanie uzasadnienia. **Kandydat bez dowodu obalenia liczy się jako
   nierozstrzygnięty, nie jako obalony.**

**Commit po `R2`. Push.**

---

## R3 — JEDNA ZMIANA I DZIESIĘĆ PRZEBIEGÓW BEZ ZMIANY WYNIKU (rdzeń, warunkowa)

**Ta pozycja jest WARUNKOWA: wykonujesz ją tylko wtedy, gdy `R2` wskazał przyczynę
z `plik:linia`. Bez wskazanej przyczyny przechodzisz do `R4` i piszesz to wprost — to nie
jest porażka.**

1. **Zmieniasz JEDNĄ rzecz w JEDNYM pliku.** Nie sześć poprawek per plik testowy; jedno
   źródło. Jeżeli naprawa wymaga sześciu różnych rozwiązań, to znaczy, że `R2` nie znalazł
   jednej przyczyny — i mówisz to wprost zamiast rozsypywać łaty.
2. **Para mutacyjna celująca w ZABEZPIECZENIE, nie w mechanizm.** Psujesz naprawę → **dziesięć
   przebiegów, wynik wraca do niestabilnego**; przywracasz przez `cp` (`Z27`, nigdy
   `git stash`) → **dziesięć przebiegów zielonych**; `git diff` po przywróceniu **pusty**.
   Obie komendy i oba wyniki dosłownie w raporcie.
3. **Próg to dziesięć KOLEJNYCH przebiegów bez zmiany wyniku**, porównanych **po nazwach**.
   Dziewięć zielonych i jeden mieszany = **próg nieosiągnięty**, i zapisujesz to jako taki.
4. **★★ ZAKAZ, który unieważnia całą pozycję:** naprawa przez `.skip`, `.todo`, `--retry`,
   `retry` w konfiguracji, poszerzenie `exclude`, podniesienie `testTimeout` w celu ukrycia
   objawu albo obniżenie progu. **Uznasz to za jedyne wyjście → STOP z uzasadnieniem**
   i przechodzisz do `R4`.
5. Zapisz dziesięć JSON-ów po naprawie do `evidence/g19/day358/po-naprawie-NN.json`.
   **`git add -f`.**

**Commit po `R3`. Push.**

---

## R4 — JAWNY WERDYKT I GRANICA WIEDZY

1. **Napisz werdykt jednym zdaniem** w jednym z dwóch kształtów, bez trzeciej możliwości:
   - „**Przyczyna: `plik:linia`** — dziesięć kolejnych przebiegów bez zmiany wyniku,
     dowód mutacyjny w obie strony w `evidence/g19/day358/`."
   - „**Nie znaleziono.** Sprawdziłem N kandydatów, M obaliłem dowodem, K pozostaje
     nierozstrzygniętych. Bezpiecznika nie dodałem, bo byłby atrapą."
2. **★ Drugi kształt jest wynikiem akceptowalnym.** Dyżur 349 oddał dokładnie taki i został
   przyjęty. **Udawanie nie jest** — bezpiecznik, który przechodzi, bo nie może zmierzyć,
   bo nikt go nie woła albo bo wejście jest puste, to **gorzej niż brak bezpiecznika**.
3. **Rozstrzygnij `H3` na piśmie:** czy stały rdzeń to realny defekt produktu, czy
   niestabilność. Jeżeli realny defekt — **opisujesz go z `plik:linia` jako osobne
   zlecenie** i **nie naprawiasz go w tym dyżurze** (to inny zakres i inna licencja).
4. **★★ Napisz wprost, czego wynik NIE dowodzi.** W szczególności: **żadna liczba z Bloku 3
   uzyskana w tym dyżurze nie jest podstawą do podniesienia wiersza `G19`** w żadnym
   `MODULE_ACCEPTANCE.md`. Zdanie musi być w raporcie dosłownie.

**Commit po `R4`. Push.**

---

## R5 — RAPORT, JAWNE LICZBY I PYTANIA DO WŁAŚCICIELA

Raport zawiera: **macierz 18 × 10 po nazwach** · listę rdzenia i pierścienia · **dosłowną
treść odpowiedzi `500`** · tabelę kandydatów z werdyktami · odpowiedź na `H1`–`H7`
(„potwierdzona / obalona", każda z komendą i wynikiem) · **pusty `git diff` na obu configach
vitest, wklejony dosłownie** · **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** ·
obowiązkowy akapit `§0.2e` dla każdego uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „CO NADAL WYMAGA OSOBNEGO ZLECENIA".** Jeżeli stały rdzeń
okazał się realnym defektem — tu go opisujesz, z `plik:linia`, i **nie naprawiasz**.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA".** Może być pusta, ale wtedy
piszesz wprost: „nie mam zastrzeżeń".

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sprawdź ją komendą
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle piszą inni autorzy (dziś sekcje doszły do `Q`).

**Commit po `R5`. Push.**

---

## Próg odbioru

**Przyczyna z `plik:linia` i dziesięć kolejnych przebiegów bez zmiany wyniku, porównanych
po nazwach — ALBO jawny raport „nie znaleziono" z listą sprawdzonych i OBALONYCH kandydatów,
każdy z dowodem obalenia.** W obu wariantach obowiązkowa jest macierz `18 × 10` i rozdzielenie
rdzenia od pierścienia.

Odbiorca odrzuci dyżur, w którym: wyniki porównano po liczbach zamiast po nazwach; kandydata
zamknięto zdaniem „sprawdziłem, nic z tego" bez komendy i liczby przebiegów; dopisano
bezpiecznik, który przechodzi zawsze; zmieniono `retry`, `exclude`, `testTimeout` albo dodano
`.skip`; podniesiono wiersz `G19`; dowody zostawiono w `/private/tmp` zamiast w
`evidence/g19/day358/`; albo Blok 3 uruchomiono z katalogu głównego i `0` wykonanych
przypadków odczytano jako sukces.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „macierz 18 × 10 zbudowana,
rdzeń i pierścień rozdzielone imiennie, treść `500` odczytana i wklejona, trzech kandydatów
obalonych dowodem, czwartego nie zdążyłem — oto który i jaką komendą go sprawdzić" —
**jest pełnowartościowym wynikiem.** Zdanie „niestabilność naprawiona" bez dziesięciu
przebiegów porównanych po nazwach nie jest.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną. Dotyczy to zwłaszcza
konfiguracji ponowień — **jeżeli `retry` w którymkolwiek configu przestało być zerem,
zatrzymujesz się i meldujesz to nadzorcy, zanim cokolwiek zmierzysz.**

## AUDYT SPRZECZNOŚCI

| Para wymagań, która może wyglądać na sprzeczną | Rozstrzygnięcie |
| --- | --- |
| „Znajdź przyczynę" vs „wolno nie znaleźć" | `R0` (4) i `R4` (2): raport „nie znaleziono" z dowodami obalenia jest **wynikiem odbioru**, nie porażką; nieakceptowalne jest udawanie, nie niewiedza |
| „Zmutuj `fileParallelism`" vs `Z18` (configi NIETYKALNE) | Tabela licencji, wiersz „Konfiguracja testów": nietykalne **do zapisu trwałego**; mutacja tymczasowa z cofnięciem przez `cp` i pustym `git diff` jest jawnie zamówiona |
| „Dopisz diagnostykę do testów" vs „nie zmieniasz testów" | Tabela licencji, wiersz „Sześć plików Bloku 3": wolno **dopisać log**, zakazane jest osłabianie asercji, `.skip` i usuwanie przypadków — to różnica między obserwacją a wyciszeniem |
| „`403` wskazuje bramkę członkostwa" vs `Z40` (bramka nietykalna) | Tabela licencji: `403` jest **objawem**, nie miejscem naprawy; naprawa przez rozluźnienie bramki = odrzucenie **całego** dyżuru |
| „Instrukcja mówi `12/18` to trzeci pomiar" vs „mój pomiar mówi, że to `numTotalTestSuites`" | Sekcja „Zmierz moje liczby sam", teza `H1`: autor obalił to zdanie zlecenia **przy wydaniu**; wiążący jest pomiar wykonawcy (`Z24`) |
| ★★ **`Z29` w tabeli zakazów mówi: „`vitest.config.ts` ustawia `retry: CI ? 3 : 1`"** vs sekcja „SPROSTOWANIE" tego dokumentu | **Kolumna uzasadnienia `Z29` jest NIEAKTUALNA** — to opis stanu z 28.08, sprzed dyżuru 42, który tę wartość wyzerował. Dziś `vitest.config.ts:339` ma `retry: 0`, a `server/vitest.config.ts` nie ma słowa `retry`. **SAM ZAKAZ `Z29` obowiązuje bez zmian** (`--retry=0` w każdej komendzie), zmienił się tylko powód, dla którego jest potrzebny. Sprawdź to komendą (2) i **zapisz rozbieżność w „Korektach wobec instrukcji" — kolumna uzasadnienia `Z29` do poprawienia w szkielecie `docs/program/system-pracy/02_SZKIELET_INSTRUKCJI.md`, co jest zadaniem nadzorcy, nie Twoim** |
| „Sprawdź kolejność plików" vs „kolejność nie jest losowa" | `R2` (3): **najpierw dowodzisz, czy kolejność się zmienia**; jeżeli nie — kandydat pada bez ani jednego przebiegu i to też jest wynik |
| „Napraw stały rdzeń" vs „nie naprawiasz defektów produktu" | `R4` (3): rdzeń, jeżeli okaże się realnym defektem, **opisujesz z `plik:linia` jako osobne zlecenie**; ten dyżur diagnozuje niestabilność |
| „Dziesięć przebiegów" vs `testTimeout: 10000` i realna baza | `BLOK 0` + `R1` (2): przebiegi są krótkie (`18` przypadków); jeżeli mimo to nie zdążysz — zatrzymujesz się po `R1` z commitem, zgodnie z prawem zatrzymania |
| „Zapisz dziesięć JSON-ów do repo" vs `Z13` (dokumentacja rośnie szybciej niż produkt) | Tabela licencji, wiersz „Dowody": `Z13` ogranicza **dokumenty rejestrowe**, a nie artefakty pomiarowe; **dowód poza repo wyparowuje** i dziś cztery razy trzeba było takie ratować |
| „Dopisz sekcję do rejestru znalezisk" vs „równolegle dopisują inni autorzy" | `R5`: literę sekcji sprawdzasz komendą **tuż przed commitem**, nie zakładasz z góry |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — sześć plików Bloku 3, `vitest.config.ts:339`, `server/vitest.config.ts` (66 wierszy), `tests/unit/config/vitestNoRetry.contract.test.ts`, cztery artefakty `evidence/g19/**`, `evidence/g19/mianownik.md` — wszystkie otwarte i odczytane przy wydaniu; `evidence/g19/day358/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wszystkie zmierzone przy wydaniu na markerze, w tym rozbicie czerwieni po nazwach i czasy przypadków |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — sześć plików Bloku 3 · trasa/kontroler/serwis/repozytorium · bramka członkostwa · konfiguracja testów · bezpiecznik ponowień · nowe testy i skrypty · migracje · front · CI · macierze odbioru · dowody · artefakty G19 · rejestr znalezisk · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` tylko mierzy, `R2` mutuje tymczasowo i cofa, `R3` jest **warunkowa** i zmienia jeden plik, `R4`/`R5` piszą |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `6417`/`5557` wolne przy wydaniu, brak kontenera `cx-day358-pg`, brak gałęzi `codex/day358-*` i worktree; 355/356/357 mają rozłączne porty (`6414`/`5554`, `6415`/`5555`, `6416`/`5556`) i **rozłączne pliki**; dyżury 351-354 mają rozłączny temat |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera, łącznie z odczytem czterech artefaktów JSON |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: **`numTotalTestSuites` czytane jako liczba zielonych**, dwa przebiegi o identycznych liczbach i różnych nazwach, uruchomienie z katalogu głównego dające `0` przypadków i `exit 0`, `DB_TYPE` przybity do `sqlite` w `server/vitest.config.ts`, `grep --include` w `zsh`, dowód poza repo |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
