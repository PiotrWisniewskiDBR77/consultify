# INSTRUKCJA DYŻURU nr 349 — Codex — „★★★ CZTERY CZERWONE TESTY UI NA `HEAD` I NIESTABILNOŚĆ BLOKU 3 — NAPRAWIĆ PRODUKT ALBO BŁĘDNĄ ASERCJĘ, I ROZSTRZYGNĄĆ PRZYCZYNĘ NIESTABILNOŚCI. Dyżur 335 ujawnił jedno i drugie DOBROWOLNIE i **nie nazwał tego naprawionym** — to jest zachowanie wzorcowe, którego nie psujesz. ★★ Odtworzyłem cztery czerwienie sam na markerze: trzy pliki, **62 przypadki, 58 zielonych, 4 czerwone**, i każda czerwień ma inny kształt: `filterableTable.r04-2a` — wiersz nie ma `tabindex="0"` (dostał `null`), więc `Shift+F10` nie ma na czym stanąć; `standardPreview.r03` ×2 — blok `Relations` nie renderuje pustego stanu (`No relations` / `Brak powiązań` nie znalezione w DOM); `tablePreviewGeometry.r03-2` — po zniknięciu elementu otwierającego fokus wraca na `body`, a nie na kontener. ★★ NIESTABILNOŚĆ: Blok 3 (sześć plików kontraktów tras na realnym PostgreSQL) dał najpierw czerwień na `day274`, `day275` i dwóch przypadkach `day276`, a po naprawie **wyłącznie payloadu `day277`** cały blok dał `18/18` — **bez żadnej zmiany w pozostałych plikach**. Cztery przypadki zzieleniały same. ★ Test niestabilny jest gorszy niż czerwony: uczy zespół, że czerwień się „sama naprawia”. ★★★ ZAKAZ „naprawiania” przez `.skip`, `.todo`, `--retry`, poszerzanie `exclude` i obniżanie progów — uznasz to za jedyne wyjście, **STOP z uzasadnieniem**"

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
> **wyłącznie** `/private/tmp/cx-day349-czerwien-ui`.

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
Zakres: **PRZEKROJOWE — powłoka współdzielona list i podglądu (`src/components/standard/**`, `src/components/shared/**`) oraz sześć kontraktów tras Bloku 3 na realnym PostgreSQL. Dwa rozłączne produkty: **(a)** cztery czerwienie zielone z powodu naprawy produktu albo poprawienia błędnej asercji — z jawnym uzasadnieniem, które to i dlaczego; **(b)** przyczyna niestabilności nazwana i udowodniona **dziesięcioma kolejnymi przebiegami bez zmiany wyniku**. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, i plikiem postępu `/private/tmp/cx-day349-postep.md` (poza repo)**.
Trasy front: `★★ SEDNO CZĘŚCI (a). Trzy pliki testowe: `src/components/shared/__tests__/filterableTable.r04-2a.test.tsx`, `src/components/shared/__tests__/standardPreview.r03.test.tsx`, `src/components/shared/__tests__/tablePreviewGeometry.r03-2.test.tsx`. Produkt, którego one dotyczą: `src/components/shared/ModuleHub/FilterableTable.tsx`, `src/components/standard/StandardPreview.tsx`, `src/components/shared/PreviewPane/**`, `src/components/ui/ResizableTable/**`. ★ Wszystko to jest **powłoka KANONU** — obowiązuje `docs/ui-standards/TRIADA_KANON.md`, zakaz `primary-*` (crimson `#85182F` — czerwień wyłącznie semantyka krytyczna), fokus tokenem `c-focus`; bezpieczniki `scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci` i `scripts/check-artefakt.sh` muszą kończyć się kodem `0` po Twojej zmianie`. Trasy tył: `★★ SEDNO CZĘŚCI (b). Sześć plików Bloku 3: `server/src/routes/__tests__/{ai.agentHubRateLimitRouting,day274-ocena-dociera-do-listy.pg,day275-method-outputs-kontrakt.pg,day276-deck-autosave-persist.pg,day276-workbook-cell-persist.pg,day277-decyzje-zapis.pg}.test.ts`. Trasy produktu, które one montują przez realny `ApiGateway`: `server/src/routes/pmo/decisions.routes.ts`, `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`, `server/src/routes/v8/{chat,teresa}.routes.ts`, `server/src/routes/meeting.routes.ts` — pełny mianownik w `evidence/g19/mianownik.md`. Kontrakt, który dyżur 335 naprawił w payloadzie testu `day277`: `server/src/validators/decision.validators.ts:210-220` (pole `escalation` jest nullable, ale NIEOPCJONALNE). ★ Uwaga: instrukcja dyżuru 335 wskazywała nieistniejący katalog `server/src/schemas/` — realny kontrakt leży w `server/src/validators/`; nie powtórz tego błędu`.

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
WT=/private/tmp/cx-day349-czerwien-ui
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
git -C "$VAULT" worktree add "$WT" -b codex/day349-czerwien-ui-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day349-czerwien-ui/config.worktree"
cat "$VAULT/worktrees/cx-day349-czerwien-ui/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day349-czerwien-ui-scratch
mkdir -p /private/tmp/cx-day349-czerwien-ui-artefakty

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
git -C "$WT" push github-backup codex/day349-czerwien-ui-20260904
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

# (1) TEZA: trzy pliki czerwieni istnieja na markerze
ls src/components/shared/__tests__/filterableTable.r04-2a.test.tsx \
   src/components/shared/__tests__/standardPreview.r03.test.tsx \
   src/components/shared/__tests__/tablePreviewGeometry.r03-2.test.tsx
#   oczekiwane: trzy pliki, zero bledow

# (2) ★★ TEZA ROZSTRZYGAJACA: cztery czerwienie odtwarzaja sie na HEAD
npx vitest run --retry=0 --reporter=json \
  --outputFile=/private/tmp/cx-day349-czerwien-ui-artefakty/ui-przed.json \
  src/components/shared/__tests__/filterableTable.r04-2a.test.tsx \
  src/components/shared/__tests__/standardPreview.r03.test.tsx \
  src/components/shared/__tests__/tablePreviewGeometry.r03-2.test.tsx
node -e "const r=require('/private/tmp/cx-day349-czerwien-ui-artefakty/ui-przed.json');console.log('total',r.numTotalTests,'pass',r.numPassedTests,'fail',r.numFailedTests);for(const t of r.testResults)for(const a of t.assertionResults)if(a.status!=='passed')console.log(a.status,'::',a.fullName);"
#   moje liczby: total 62 · pass 58 · fail 4, i DOKLADNIE te cztery pelne nazwy:
#     R04-2A · interakcja wiersza Shift+F10 na wierszu otwiera ten sam kontekst co kebab
#     R03-1 · Relations jest blokiem obowiazkowym renderuje empty state, gdy ekran NIE poda propa relations
#     R03-1 · Relations jest blokiem obowiazkowym respektuje wlasna etykiete pustego stanu
#     R03-2 · zamykanie i focus return gdy element otwierajacy zniknal, focus wraca na kontener — skroty zyja dalej

# (3) ★★ TEZA: kazda z czterech czerwieni ma INNY ksztalt — to nie jest jedna przyczyna
node -e "const r=require('/private/tmp/cx-day349-czerwien-ui-artefakty/ui-przed.json');for(const t of r.testResults)for(const a of t.assertionResults)if(a.status!=='passed'){console.log('###',a.fullName);console.log((a.failureMessages||[]).join('\n').split('\n').slice(0,4).join('\n'));}"
#   moje ustalenia: (1) toHaveAttribute('tabindex','0') dostalo null;
#   (2) i (3) TestingLibraryElementError: nie znaleziono tekstu 'No relations' / 'Brak powiazan';
#   (4) AssertionError: fokus wrocil na <body>, a oczekiwano kontenera

# (4) TEZA: szesc plikow Bloku 3 istnieje i jest mianownikiem niestabilnosci
for f in ai.agentHubRateLimitRouting day274-ocena-dociera-do-listy.pg \
         day275-method-outputs-kontrakt.pg day276-deck-autosave-persist.pg \
         day276-workbook-cell-persist.pg day277-decyzje-zapis.pg; do \
  printf '%-42s ' "$f"; ls "server/src/routes/__tests__/$f.test.ts" >/dev/null 2>&1 && echo JEST || echo BRAK; done
#   oczekiwane: szesc razy JEST

# (5) ★★ TEZA ROZSTRZYGAJACA: dowod 335 podaje TRZY ROZNE liczby dla tego samego bloku
node -e "const r=require('./evidence/g19/blok3-marker.json');console.log('blok3-marker.json:',r.numTotalTests,r.numPassedTests,r.numFailedTests);for(const t of r.testResults)console.log(' ',t.status,t.name.split('/').slice(-1)[0]);"
bash -c "grep -n '18 | 12 | 6\|12/18\|18/18' evidence/g19/day335-r3-maszynowy.md evidence/g19/day335-r4-czerwienie.md"
#   moje ustalenia: blok3-marker.json = 18/11/7; tabela w day335-r3-maszynowy.md = 18/12/6;
#   tekst w day335-r4-czerwienie.md = 12/18. ★ TRZY ROZNE LICZBY — rozstrzygniecie tego jest czescia R4

# (6) TEZA: artefakt 'blok3-po.json' (18/18) jest CYTOWANY, ale NIE MA GO W REPO
ls evidence/g19/ | grep blok3 ; echo "kod=$?"
ls /private/tmp/cx-day335-g19-regresja-artefakty/blok3-po.json 2>&1
shasum -a 256 /private/tmp/cx-day335-g19-regresja-artefakty/blok3-po.json 2>/dev/null || echo 'BRAK PLIKU — odtwarzasz pomiar sam'
#   moje ustalenia 04.09: w repo sa TYLKO blok3-marker.json i blok3-marker.log;
#   plik blok3-po.json (SHA-256 cytowany jako 0df629f348ff0def401a70125a57b59518ce1967096723d822a43bb0d078f0d2)
#   lezy POZA repo, w katalogu tymczasowym, i moze zniknac. ★ To jest ODCZYT, nic tam nie piszesz

# (7) TEZA: kontrakt, ktory 335 naprawil w payloadzie day277, lezy w validators, nie w schemas
ls server/src/validators/decision.validators.ts
ls server/src/schemas 2>&1 | head -2
bash -c "grep -n 'escalation' server/src/validators/decision.validators.ts | head -5"
#   oczekiwane: validators istnieje; katalog schemas moze nie istniec — to nie jest blad

# (8) TEZA: liscie slownikow i bramki kanonu na markerze
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35198, en 33065; focus=0, list=0, artefakt=0, reach=0

# (9) zasoby: dysk, porty, kontener
df -h /
lsof -nP -iTCP:6396 -sTCP:LISTEN; lsof -nP -iTCP:5536 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day349 || true
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day349-czerwien-ui-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6396`. Twój JEDYNY port harnessu to `5536`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day349-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki 04.09 — nie dotykasz: 347 (6394/5534), 348 (6395/5535), 350 (6397/5537). Równoległa paczka 343-346 ma zarezerwowany przedział 6390-6393 i 5530-5533 — również nie dotykasz. Starsze rodzeństwo 04.09: 334 (6370/5510), 335 (6371/5511), 336 (6372/5512), 337 (6373/5513). Cudze worktree 286-298 używają 6290-6299 i 5250-5269. Twoje własne wyłącznie: baza 6396, harness 5536. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`). ★★ Dziesięć przebiegów z `R4` uruchamiasz SEKWENCYJNIE na TEJ SAMEJ bazie `cx349`; jeżeli zdecydujesz się na wariant „świeża baza per przebieg”, to jest osobny eksperyment i opisujesz go jako osobny`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK. Ten dyżur nie dodaje, nie zmienia i nie przełącza ANI JEDNEJ flagi funkcyjnej. Jeżeli którykolwiek z czterech czerwonych testów przechodzi tylko przy fladze `ON` — to jest ZNALEZISKO i granica dowodu, którą wypisujesz z nazwy flagi, nigdy zmiana wartości domyślnej (`Z10`, `Z11`)`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/src/middleware/auth.middleware.ts`, `server/src/services/ApiGateway.ts`. Wszystkie NIETYKALNE DO ZAPISU — wolno je wołać w pomiarze, nie wolno ich zmieniać, także wtedy gdy „wystarczyłaby drobna zmiana, żeby test przeszedł”. ★★ `vitest.config.ts` ustawia `retry: CI ? 3 : 1` — to jest DOKŁADNIE mechanizm, który maskuje niestabilność; **nie zmieniasz go, tylko obchodzisz jawnym `--retry=0` w KAŻDEJ komendzie**`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY349_CZERWIEN_UI_REPORT.md`. Jedyny inny dokument do zmiany: **żaden `MODULE_ACCEPTANCE.md`** — ten dyżur jest przekrojowy i NIE dotyka macierzy odbioru; wiersze `G15` (dyżur 347), `G19` (dyżur 348) i `G16` (dyżur 350) są cudzym terenem. Dodatkowo wolno: utworzyć pliki dowodowe pod `evidence/day349/` (katalog NIE ISTNIEJE na markerze — tworzysz go) oraz dopisać jedną nową sekcję do `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze (sekcje idą dziś do `O`, ale równoległy autor też dopisuje — literę sprawdzasz komendą tuż przed commitem, nie zakładasz z góry). Plik postępu `/private/tmp/cx-day349-postep.md` żyje POZA repo. Nowe pliki w `tests/` wymagają `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day349-czerwien-ui-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day349-czerwien-ui-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ „NAPRAWIANIA” PRZEZ WYCISZANIE — W TYM DYŻURZE JEST TO ZAKAZ NADRZĘDNY.** Zakazane bez wyjątku: `.skip`, `.only`, `.todo`, `--retry` inne niż `0`, `retry:` w opcjach `describe`/`it`, poszerzanie `exclude`/`testIgnore`, obniżanie progów pokrycia, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `--max-warnings`, `continue-on-error: true`. **Uznasz którekolwiek z tych za jedyne wyjście → STOP z uzasadnieniem, nie cichy commit.** **ZAKAZ ZMIANY ASERCJI BEZ JAWNEGO UZASADNIENIA, KTÓRE STRONA JEST PRZESTARZAŁA** — wolno poprawić asercję, jeżeli udowodnisz, że opisuje kontrakt, którego produkt świadomie już nie ma (z decyzją właściciela albo commitem, który go zmienił); wtedy dowodzisz mutacyjnie, że poprawiony test **nadal broni tego, co bronił**. **ZAKAZ UZNANIA NIESTABILNOŚCI ZA NAPRAWIONĄ NA PODSTAWIE JEDNEGO ZIELONEGO PRZEBIEGU** — dowodem jest **DZIESIĘĆ kolejnych przebiegów bez zmiany wyniku**, z zapisanymi dziesięcioma plikami JSON i ich `shasum -a 256`. **ZAKAZ PORÓWNAŃ PO LICZBACH** — „było 58 PASS, jest 62 PASS” bez listy nazw NIE jest dowodem (`Z37`). **ZAKAZ NAPRAWIANIA CZEGOKOLWIEK POZA CZTEREMA CZERWIENIAMI I NIESTABILNOŚCIĄ** — to nie jest dyżur porządkowy | Dyżur 335 ujawnił obie te rzeczy **dobrowolnie** i **nie nazwał ich naprawionymi** — napisał wprost: „Nie nazywam czterech pozostałych przypadków naprawionymi; wynik pokazuje zależność od kolejności/stanu lub niestabilność, która wymaga osobnej reprodukcji”. To jest zachowanie wzorcowe i tego dyżuru nie wolno zamknąć gorzej niż zamknięto tamten. **Test niestabilny jest gorszy niż czerwony**: czerwony test mówi prawdę, niestabilny uczy zespół, że czerwień się „sama naprawia” — i wtedy każdy następny czerwony wynik zostanie zignorowany, także ten prawdziwy |

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
cd /private/tmp/cx-day349-czerwien-ui

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day349-pg psql -U postgres -d cx349 \
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
cd /private/tmp/cx-day349-czerwien-ui

docker run -d --name cx-day349-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx349 \
  -p 127.0.0.1:6396:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day349-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6396/cx349 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6396/cx349 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day349-czerwien-ui && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6396/cx349 \
JWT_SECRET=cx349-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Testy UI z roota, wariant (C) `RUN_DB_TESTS=0 MOCK_DB=true`, trzy pliki wymienione w `TRASY_FRONT`, zawsze z `--retry=0` i `--reporter=json --outputFile=/private/tmp/cx-day349-czerwien-ui-artefakty/ui-<etykieta>.json`. Blok 3 z cwd `server/`, z `server/vitest.config.ts`, wariant (B) `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6396/cx349` — uruchomienie z roota bez właściwego configu daje **0 wykonanych przypadków i `exit 0`**, co jest BŁĘDEM KOMENDY, nie PASS (zdarzyło się dyżurowi 335). Dziesięć przebiegów dowodowych z `R4` zapisujesz jako `blok3-run-01.json` … `blok3-run-10.json`, każdy z `shasum -a 256`, i porównujesz je **po nazwach przypadków**, nie po liczbach. **W raporcie podajesz `numTotalTests`, nie tylko `numFailedTests`** --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day349-czerwien-ui-artefakty/day349-czerwien-ui.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day349-czerwien-ui && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Testy UI z roota, wariant (C) `RUN_DB_TESTS=0 MOCK_DB=true`, trzy pliki wymienione w `TRASY_FRONT`, zawsze z `--retry=0` i `--reporter=json --outputFile=/private/tmp/cx-day349-czerwien-ui-artefakty/ui-<etykieta>.json`. Blok 3 z cwd `server/`, z `server/vitest.config.ts`, wariant (B) `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6396/cx349` — uruchomienie z roota bez właściwego configu daje **0 wykonanych przypadków i `exit 0`**, co jest BŁĘDEM KOMENDY, nie PASS (zdarzyło się dyżurowi 335). Dziesięć przebiegów dowodowych z `R4` zapisujesz jako `blok3-run-01.json` … `blok3-run-10.json`, każdy z `shasum -a 256`, i porównujesz je **po nazwach przypadków**, nie po liczbach. **W raporcie podajesz `numTotalTests`, nie tylko `numFailedTests`** --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day349-czerwien-ui-artefakty/day349-czerwien-ui.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day349-czerwien-ui/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day349-pg psql -U postgres -d cx349 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day349-pg`.
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
> **(e) ★★★ **SIEDEM PUŁAPEK.** (1) **`vitest.config.ts` ustawia `retry: CI ? 3 : 1`** — bez jawnego `--retry=0` w KAŻDEJ komendzie niestabilny test raportuje `PASS` i pomiar kłamie; to jest zmierzony wektor maskowania. (2) **„Te same liczby” nie są dowodem** — `58 PASS` przed i `58 PASS` po może oznaczać, że jeden test zgasł, a drugi się zapalił; porównujesz `fullName` (`Z37`). (3) **Czery czerwienie mają CZTERY różne kształty** — brakujący `tabindex`, dwa razy brak tekstu pustego stanu, i fokus wracający na `body`; szukanie jednej wspólnej przyczyny jest tu błędem. (4) **Powłoka to KANON** — `primary-*` w tailwindzie to crimson `#85182F`; naprawa fokusu tokenem innym niż `c-focus` zaczerwieni `check-focus-canon.sh`, a własna tabela zamiast `StandardTable` zaczerwieni `check-list-canon.sh`. (5) **Niestabilność bywa własnością harnessu, nie produktu** — kolejność plików, współdzielony stan bazy, zależność od zegara i wyścig `act()`/`waitFor` dają ten sam objaw; rozstrzygasz KTÓRA to z nich, a nie „jakoś naprawiam”. (6) **Atrapa bazy kłamie o zapisie**: `Database.ts:686` zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE`; Blok 3 wyłącznie na realnym PostgreSQL. (7) **`grep --include` w `zsh` zwraca pustkę zamiast wyników** — uruchamiaj przez `bash -c '…'` i sprawdzaj kod wyjścia; pustka nie jest wynikiem, dopóki nie wiesz, że komenda się wykonała**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day349-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day349-czerwien-ui-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarde zasady: zakaz wyciszania; dziesięć przebiegów jako dowód niestabilności) · R1 (odtworzenie czterech czerwieni po nazwach i rozstrzygnięcie per czerwień: produkt czy asercja — RDZEŃ) · R2 (naprawa czterech czerwieni z dowodem mutacyjnym per czerwień — RDZEŃ) · R3 (reprodukcja niestabilności Bloku 3 i rozstrzygnięcie trzech rozbieżnych liczb dyżuru 335 — RDZEŃ) · R4 (przyczyna niestabilności + dziesięć kolejnych przebiegów bez zmiany wyniku — RDZEŃ) · R5 (bezpiecznik przed nawrotem, jeżeli przyczyna na to pozwala) · R6 (raport + pytania do właściciela)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6396` albo `5536` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6396` albo `5536`** (`Z7`).

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

Dyżur 335 zrobił dwie rzeczy, których większość dyżurów nie robi: **ujawnił własne czerwienie
dobrowolnie** i **nie nazwał ich naprawionymi**. Jego raport kończy się zdaniem:

> *„Nie nazywam czterech pozostałych przypadków naprawionymi; wynik pokazuje zależność od
> kolejności/stanu lub niestabilność, która wymaga osobnej reprodukcji."*

**To jest wzorzec, którego ten dyżur nie ma prawa zepsuć.** Zamknięcie go gorzej niż zamknięto
tamten — jednym zielonym przebiegiem, `--retry`, albo `.skip` — będzie odrzucone.

Ten dyżur ma dwa **rozłączne** produkty:

- **(a) cztery czerwone testy UI na `HEAD`** — zielone, bo naprawiono produkt **albo** bo
  poprawiono błędną asercję, z jawnym uzasadnieniem, **które to jest i dlaczego**;
- **(b) niestabilność Bloku 3** — przyczyna nazwana i udowodniona **dziesięcioma kolejnymi
  przebiegami bez zmiany wyniku**.

## Część (a) — cztery czerwienie, cztery różne kształty

**Odtworzyłem je sam na markerze `6a4919f72db338e7f49a2cacb3787d20cc649883`.**
Trzy pliki, **62 przypadki, 58 zielonych, 4 czerwone**, 21 bloków `describe`.

| # | Pełna nazwa przypadku (`fullName`) | Plik | Co dokładnie zawodzi |
| --- | --- | --- | --- |
| 1 | `R04-2A · interakcja wiersza Shift+F10 na wierszu otwiera ten sam kontekst co kebab` | `filterableTable.r04-2a.test.tsx` | `expect(element).toHaveAttribute("tabindex", "0")` — **otrzymano `null`**. Wiersz nie jest fokusowalny, więc `Shift+F10` nie ma na czym stanąć |
| 2 | `R03-1 · Relations jest blokiem obowiązkowym renderuje empty state, gdy ekran NIE poda propa relations` | `standardPreview.r03.test.tsx` | `TestingLibraryElementError: Unable to find an element with the text: No relations` — blok `Relations` **nie renderuje pustego stanu** |
| 3 | `R03-1 · Relations jest blokiem obowiązkowym respektuje własną etykietę pustego stanu` | `standardPreview.r03.test.tsx` | to samo, dla własnej etykiety: nie znaleziono tekstu `Brak powiązań` |
| 4 | `R03-2 · zamykanie i focus return gdy element otwierający zniknął, focus wraca na kontener — skróty żyją dalej` | `tablePreviewGeometry.r03-2.test.tsx` | `AssertionError` — po zniknięciu elementu otwierającego fokus wrócił na **`<body>`**, a oczekiwano kontenera |

★★ **To NIE jest jedna przyczyna powtórzona cztery razy.** Kształty są cztery i rozstrzygasz
je osobno. Szukanie wspólnego mianownika jest tu błędem, który kosztuje pół dnia.

★ **Dwie czerwienie `R03-1` to najprawdopodobniej ta sama przyczyna** (blok `Relations`
w ogóle się nie renderuje albo renderuje się bez pustego stanu) — ale **udowodnij to**, zamiast
założyć; jeżeli tak jest, jedna naprawa domyka dwie i to jest dobry wynik.

**Dyżur 335 sklasyfikował je jako `ZASTANA_WZGLĘDEM_DYŻURU_335`** i uczciwie zaznaczył, że to
znaczy tylko tyle, że **wystąpiły przed jego zmianami UI** — a nie, że są stare. Wiek czerwieni
wobec kotwicy produktu jest **nierozstrzygnięty** i możesz go rozstrzygnąć: `git log -1` na
pliku testu i na pliku produktu powie, które z nich zmieniło się później.

★ **Wszystkie trzy pliki testowe przeszły niezależny bundle `esbuild`** (pomiar 335), więc
`Transform failed` nie maskuje wyniku. Powtórz to sam — `Transform failed` jest **błędem
komendy**, nie wynikiem.

## Część (b) — niestabilność Bloku 3, i trzy różne liczby na jej temat

Blok 3 to sześć plików kontraktów tras przez realny `ApiGateway`/JWT/PostgreSQL:

```text
server/src/routes/__tests__/ai.agentHubRateLimitRouting.test.ts
server/src/routes/__tests__/day274-ocena-dociera-do-listy.pg.test.ts
server/src/routes/__tests__/day275-method-outputs-kontrakt.pg.test.ts
server/src/routes/__tests__/day276-deck-autosave-persist.pg.test.ts
server/src/routes/__tests__/day276-workbook-cell-persist.pg.test.ts
server/src/routes/__tests__/day277-decyzje-zapis.pg.test.ts
```

**Objaw:** pierwszy poprawnie skonfigurowany przebieg na świeżej bazie dał czerwień
na `day274`, `day275` i **dwóch przypadkach workbook `day276`**. Po naprawie **wyłącznie
payloadu `day277`** (dodanie `escalation: null`, kontrakt
`server/src/validators/decision.validators.ts:210-220`) ponowiono **cały blok bez zmian
w pozostałych plikach** — i wyszło **`18/18` GREEN**. **Cztery przypadki zzieleniały same.**

**★★ Trzy różne liczby o tym samym bloku, które sam zmierzyłem w artefaktach 335:**

| Źródło | Wynik |
| --- | --- |
| `evidence/g19/blok3-marker.json` (surowy JSON) | **18 / 11 / 7**, czerwone pliki: `day274`, `day276-deck`, `day276-workbook`, `day277`; **`day275` ZIELONY** |
| tabela w `evidence/g19/day335-r3-maszynowy.md` | **18 wykonanych / 12 zielonych / 6 czerwonych** |
| tekst w `evidence/g19/day335-r4-czerwienie.md` | **12 / 18**, i wymienia jako czerwone `day274`, **`day275`**, dwa `day276` oraz `day277` |

**Rozstrzygnięcie tej rozbieżności jest częścią `R3`** — i samo w sobie jest cenne, bo pokazuje,
czy niestabilność dotyka `day275` czy nie. **Nie zakładaj, która liczba jest prawdziwa.**

**★★ Ostrzeżenie o dowodzie poza repo.** Artefakt `blok3-po.json` (ten z wynikiem `18/18`,
cytowany z SHA-256 `0df629f348ff0def401a70125a57b59518ce1967096723d822a43bb0d078f0d2`)
**NIE LEŻY W REPO** — w `evidence/g19/` są tylko `blok3-marker.json` i `blok3-marker.log`.
Sprawdziłem 04.09: plik istnieje **poza repo**, w
`/private/tmp/cx-day335-g19-regresja-artefakty/blok3-po.json`. To jest katalog artefaktów
cudzego dyżuru: **wolno Ci go PRZECZYTAĆ i policzyć `shasum -a 256`, nie wolno tam nic
zapisać ani niczego usunąć** (`Z6`). Jeżeli pliku już nie ma — **odtwarzasz pomiar sam**
i zapisujesz, że dowód wyparował.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze:

- trzy pliki testowe UI: **62 przypadki / 58 zielonych / 4 czerwone**, i dokładnie te cztery
  pełne nazwy z tabeli wyżej;
- kształty czterech czerwieni: `tabindex` = `null` · brak tekstu `No relations` · brak tekstu
  `Brak powiązań` · fokus na `<body>` zamiast kontenera;
- `evidence/g19/blok3-marker.json` = **18 / 11 / 7**, `day275` **zielony**;
- trzy różne liczby o Bloku 3 w trzech dokumentach dyżuru 335;
- `blok3-po.json` **nie ma w repo**; leży w katalogu tymczasowym poza repo;
- kontrakt `escalation` żyje w `server/src/validators/decision.validators.ts`,
  **nie** w `server/src/schemas/` (instrukcja 335 wskazywała ten drugi, nieistniejący);
- liście słowników: **pl 35198**, **en 33065**; cztery bezpieczniki (`focus-canon`,
  `list-canon`, `artefakt`, `reachability --check-baseline`) kończą się kodem **0**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Walidator / kontrakt** | `server/src/validators/decision.validators.ts` (pole `escalation`, wiersze ok. 210-220) | **TYLKO ODCZYT** — schemat jest kontraktem produktu; jeżeli test się o niego rozbija, przestarzały jest test | Cytat wiersza + brief |
| **Trasa (montaż)** | `server/src/services/ApiGateway.ts`, `server/src/routes/v8/index.ts` | **TYLKO ODCZYT — WOŁASZ, NIE ZMIENIASZ** (`Z22`). Każde „działa" znaczy: realne żądanie HTTP przez realny `ApiGateway`, z **zapisanym kodem odpowiedzi** | Opis w raporcie |
| **Kontroler / trasy Bloku 3** | `server/src/routes/pmo/**`, `server/src/routes/v8/{chat,teresa}.routes.ts`, `server/src/routes/meeting.routes.ts` | **★ WĄSKA LICENCJA:** wolno zmienić **wyłącznie** wtedy, gdy `R4` udowodni, że przyczyna niestabilności leży w kodzie produktu (np. wyścig w zapisie), i **wyłącznie razem z dowodem mutacyjnym** | Wpis: plik, linia, problem, rekomendacja jako diff **nienałożony** |
| **Serwis / repozytorium** | `server/src/services/**`, `server/src/domain/**`, `server/src/repositories/**` | **TYLKO ODCZYT** | jak wyżej |
| **Middleware / model uprawnień** | `server/src/middleware/**` | **NIETYKALNE DO ZAPISU** (`Z12`) | Brief |
| **Produkt UI — powłoka współdzielona** | `src/components/shared/ModuleHub/FilterableTable.tsx`, `src/components/standard/StandardPreview.tsx`, `src/components/shared/PreviewPane/**`, `src/components/ui/ResizableTable/**` | **★ WĄSKA LICENCJA:** wolno naprawić **dokładnie to, co opisują cztery czerwone przypadki** — fokusowalność wiersza, renderowanie pustego stanu bloku `Relations`, powrót fokusu na kontener. **Zakaz zmian wyglądu, refaktoryzacji i „przy okazji"** | Wpis do raportu z `plik:linia` |
| **Kanon UI** | `docs/ui-standards/TRIADA_KANON.md`, `tailwind.config.js`, `src/index.css` | **TYLKO ODCZYT.** ★ `primary-*` **każdy numer** = crimson `#85182F` — czerwień wyłącznie semantyka krytyczna; fokus tokenem `c-focus`. Ekrany listowe wyłącznie `StandardTable`/`StandardModuleBar` — **zakaz własnych tabel** | Opis w raporcie |
| **Testy — cztery czerwienie** | `src/components/shared/__tests__/{filterableTable.r04-2a,standardPreview.r03,tablePreviewGeometry.r03-2}.test.tsx` | **★ WĄSKA LICENCJA:** wolno poprawić asercję **tylko** z jawnym uzasadnieniem, że opisuje kontrakt, którego produkt świadomie już nie ma (z commitem albo decyzją właściciela), i **tylko** z dowodem mutacyjnym, że poprawiony test nadal broni tego, co bronił. **Zakaz `.skip`, `.todo`, `--retry`, poszerzania `exclude`, obniżania progów** | — |
| **Testy — Blok 3** | sześć plików `server/src/routes/__tests__/{ai.agentHubRateLimitRouting,day27*}.test.ts` | **★ WĄSKA LICENCJA:** wolno **URUCHAMIAĆ** wielokrotnie i wolno naprawić **przyczynę niestabilności** (np. izolację stanu między przypadkami), jeżeli `R4` ją wskaże. **Zakaz zmiany asercji i zakresu, żeby zzielenieć** | — |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY.** ★ `retry: CI ? 3 : 1` w `vitest.config.ts` jest **przyczyną maskowania niestabilności** i mimo to **go nie zmieniasz** — obchodzisz jawnym `--retry=0` w każdej komendzie i opisujesz to jako znalezisko | Opis w raporcie + rekomendacja jako diff **nienałożony** |
| **Artefakty cudzego dyżuru 335** | `/private/tmp/cx-day335-g19-regresja-artefakty/**` | **★ WĄSKA LICENCJA — WYŁĄCZNIE ODCZYT I `shasum`.** `Z6` zakazuje zapisu i usuwania; ten wyjątek dotyczy **tylko odczytu** plików `blok3-po.json` i `blok3-po-nazwy.txt`. Jeżeli ich nie ma — odtwarzasz pomiar sam | Zdanie w raporcie: „dowód wyparował, odtworzyłem" |
| **Dowody 335 w repo** | `evidence/g19/**` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** To baza porównania; nadpisanie unieważnia dyżur | — |
| **Dowody** | `evidence/day349/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**) | **★ PEŁNA LICENCJA na tworzenie i dopisywanie** | — |
| **Nowe testy** | `tests/**` (nowe pliki, `git add -f`) | **★ PEŁNA LICENCJA na dodanie** bezpiecznika przed nawrotem z `R5`. **Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`** — dziś trzeba było przenosić trzy razy | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **NIETYKALNA — ten dyżur NIE dotyka żadnego wiersza żadnej bramki.** `G15` należy do 347, `G19` do 348, `G16` do 350 | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY349_CZERWIEN_UI_REPORT.md` (**NOWY**) | `R6` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `evidence/g15/**`, `resultsInternalBetaVisibility.middleware.ts`, `server/src/routes/resultsVnext/**` (dyżur 347) · `evidence/g19/day348/**`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md`, `day307-crossorg-read-flight.pg.test.ts`, `TaskController.ts` (dyżur 348) · `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md` (dyżur 350) · wszystko wokół `DEC-388`, kafli SWOT, panelu Idei i kompletności raportu (dyżury 343-346) · `server/migrations/**` (przedział nieprzydzielony) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
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
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`). ★ W tym dyżurze ryzyko jest
realne: dotykasz powłoki kanonu, a `check-focus-canon.sh` i `check-list-canon.sh` pilnują
dokładnie tych plików.

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | przypadki w trzech plikach UI | `62 / 58 / 4` | komenda (2) z `§0.3` | TAK — **podaje `numTotalTests`, nie tylko `numFailedTests`** |
| 2 | pełne nazwy czterech czerwieni | cztery nazwy z tabeli | komenda (2) z `§0.3` | TAK — porównanie po `fullName` (`Z37`) |
| 3 | kształt każdej czerwieni | `tabindex=null` · 2× brak tekstu · fokus na `body` | komenda (3) z `§0.3` | TAK — czyta `failureMessages`, nie samą nazwę |
| 4 | wiek czerwieni wobec produktu | **nierozstrzygnięty** | `git log -1 --format='%h %ad %s'` na pliku testu i pliku produktu | TAK — **335 świadomie tego nie orzekł, Ty możesz** |
| 5 | wynik Bloku 3 wg surowego JSON-a | `18 / 11 / 7`, `day275` zielony | komenda (5) z `§0.3` | TAK |
| 6 | wynik Bloku 3 wg dwóch dokumentów 335 | `18/12/6` oraz `12/18` z `day275` czerwonym | komenda (5) z `§0.3` | TAK — **trzy źródła, trzy liczby; rozstrzygasz w `R3`** |
| 7 | czy `blok3-po.json` istnieje | **nie w repo**, tak poza repo (stan 04.09) | komenda (6) z `§0.3` | TAK — `ls` na cytowanej ścieżce, zawsze |
| 8 | wynik dziesięciu przebiegów | — | `R4`, dziesięć JSON-ów + `shasum -a 256` każdego | TAK — **jeden zielony przebieg NIE jest dowodem** |
| 9 | czy naprawa czterech czerwieni czegoś nie zgasiła | — | pełny przebieg trzech plików UI po naprawie, po nazwach | TAK — nazwa, która zniknęła, wymaga wyjaśnienia albo STOP-u |
| 10 | bezpieczniki kanonu po naprawie | wszystkie `0` | blok (b) „WARUNKÓW WSPÓLNYCH" | TAK — dotykasz powłoki kanonu |
| 11 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |
| 12 | `numTotalTests` każdego przebiegu | — | pole `numTotalTests` z raportu JSON | TAK — **`0 failed` przy `0 wykonanych` NIE jest PASS** |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY349_CZERWIEN_UI_REPORT.md` ·
`evidence/day349/**` (nowy katalog).

**Zapisujesz WARUNKOWO (tylko z dowodem `R1`–`R4`):**
`src/components/shared/ModuleHub/FilterableTable.tsx` · `src/components/standard/StandardPreview.tsx` ·
`src/components/shared/PreviewPane/**` · `src/components/ui/ResizableTable/**` ·
trzy pliki testowe czterech czerwieni · sześć plików Bloku 3 ·
kod produktu Bloku 3 (tylko jeżeli `R4` wskaże wyścig w produkcie) ·
nowe pliki testowe w `tests/` (`git add -f`, **nigdy pod `src/`**) ·
`REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `docs/program/waves/WAVE_03_ACCEPTANCE/modules/**` (żadna bramka —
`G15` do 347, `G19` do 348, `G16` do 350), `public/locales/**`, `tailwind.config.js`,
`src/index.css`, `docs/ui-standards/**`, `tests/setup.ts`, `tests/helpers/**`,
`tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`,
`server/migrations/**`, `server/src/middleware/**`, `server/src/services/ApiGateway.ts`,
`evidence/g19/**`, `evidence/g15/**`, `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`,
`/private/tmp/cx-day335-g19-regresja-artefakty/**` (odczyt tak, zapis nigdy).

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day349-czerwien-ui
git diff --name-only --cached | tee /private/tmp/cx-day349-czerwien-ui-artefakty/staged.txt
bash -c "grep -iE 'MODULE_ACCEPTANCE|^public/locales/|^tailwind\.config|^src/index\.css|^docs/ui-standards/|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|^server/src/middleware/|ApiGateway|^evidence/g19/|^evidence/g15/|PRZELOT_WLASCICIELA' /private/tmp/cx-day349-czerwien-ui-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"

# ★★ druga kontrola, wlasciwa TEMU dyzurowi: zero wyciszen w tym, co commitujesz
git diff --cached -U0 | bash -c "grep -nE '^\+.*(\.skip|\.only|\.todo|retry:|--retry=[1-9]|ts-ignore|ts-expect-error|eslint-disable|max-warnings|continue-on-error)'" \
  && echo "★★★ WYCISZENIE W DIFFIE — TO JEST ZAKAZ NADRZEDNY TEGO DYZURU, COFNIJ" \
  || echo "brak wyciszen OK"
```

---

## R0 — TRZY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Zero wyciszania — to jest zakaz nadrzędny.** `.skip`, `.only`, `.todo`, `--retry` inne
niż `0`, `retry:` w opcjach `describe`/`it`, poszerzanie `exclude`/`testIgnore`, obniżanie
progów, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `--max-warnings`,
`continue-on-error: true`. **Uznasz którekolwiek za jedyne wyjście → STOP z uzasadnieniem,
nie cichy commit.** Druga kontrola przed commitem (blok wyżej) sprawdza to mechanicznie.

**(2) Naprawa asercji wymaga jawnego uzasadnienia, KTÓRA STRONA jest przestarzała.** Wolno
poprawić test, jeżeli udowodnisz, że opisuje kontrakt, którego produkt **świadomie** już nie
ma — z commitem albo decyzją właściciela w `OWNER_DECISION_LEDGER_2026-08-24.md`. Wtedy
**dowodzisz mutacyjnie**, że poprawiony test nadal broni tego, co bronił. „Test był zły"
bez dowodu jest zawężeniem kryterium.

**(3) Jeden zielony przebieg NIE jest dowodem naprawy niestabilności.** Dowodem jest
**dziesięć kolejnych przebiegów bez zmiany wyniku**, z dziesięcioma zapisanymi plikami JSON
i ich `shasum -a 256`, porównanymi **po nazwach przypadków**. To jest dokładnie ten sam
błąd, który pozwolił nazwać cztery przypadki „zielonymi" po jednym powtórzeniu.

**Wymagany dowód:** trzy zdania w raporcie, że przeczytałeś te zasady, plus wynik obu kontroli
przed każdym commitem. **Bez commita — to jest warunek, nie pozycja.**

## R1 — CZTERY CZERWIENIE: ROZSTRZYGNIĘCIE PER CZERWIEŃ (rdzeń)

Nie naprawiasz jeszcze niczego. **Dla KAŻDEJ z czterech czerwieni z osobna** produkujesz:

1. **Pełną nazwę przypadku** i **pełny komunikat błędu** (nie skrót).
2. **Cytat asercji z pliku testu**, z `plik:linia`.
3. **Cytat miejsca w produkcie**, które tę asercję ma spełnić, z `plik:linia`. Jeżeli takiego
   miejsca **nie ma** — to jest odpowiedź: produkt nie ma kontraktu, który test opisuje.
4. **Werdykt: `PRODUKT` czy `ASERCJA`** — i **dlaczego**, jednym zdaniem, z dowodem.
   - `PRODUKT` = kontrakt jest słuszny, produkt go nie realizuje → naprawiasz produkt;
   - `ASERCJA` = kontrakt został świadomie zmieniony → naprawiasz test, cytując commit
     albo decyzję, która go zmieniła.
5. **Wiek czerwieni**: `git log -1 --format='%h %ad %s'` na pliku testu i na pliku produktu.
   Który zmienił się później? Dyżur 335 świadomie **nie orzekł** wieku; Ty możesz i to jest
   wartość dodana.
6. **Sprawdź, czy dwie czerwienie `R03-1` mają jedną przyczynę.** Jeżeli tak — jedna naprawa
   domyka dwie, i mówisz to wprost. Jeżeli nie — traktujesz je osobno.

★ **Sprawdź RODZINĘ, nie tylko te cztery przypadki** (`KROK 0`): jeżeli brak `tabindex="0"`
dotyczy wiersza w `FilterableTable`, sprawdź, czy to samo dotyczy `StandardTable` i innych
tabel powłoki. Program ma zmierzony kształt „naprawa per wywołanie odrasta" — defekt załatany
w jednym miejscu wrócił po ośmiu tygodniach w dwunastu plikach.

**Wymagany dowód:** cztery bloki (nazwa · komunikat · asercja `plik:linia` · miejsce w produkcie
`plik:linia` · werdykt `PRODUKT`/`ASERCJA` z uzasadnieniem · wiek) · zdanie o rodzinie.
**Commit po `R1`.**

## R2 — NAPRAWA CZTERECH CZERWIENI Z DOWODEM MUTACYJNYM (rdzeń)

1. Naprawiasz **dokładnie to, co opisuje werdykt z `R1`** — nic więcej. Zakaz refaktoryzacji,
   zmian wyglądu i poprawek „przy okazji".
2. **Dowód mutacyjny per naprawiona czerwień** (`Z32`), celujący w **ZABEZPIECZENIE, nie
   w mechanizm**: cofnij swoją naprawę produktu → test **czerwony**; przywróć przez `cp`
   (nigdy `git stash`, `Z27`) → test **zielony**; `git diff` po przywróceniu **pusty**.
   Obie komendy i oba wyniki dosłownie w raporcie.
   ★ Dla czerwieni sklasyfikowanej jako `ASERCJA` mutacja jest odwrotna: **zepsuj produkt
   w miejscu, którego poprawiony test broni** → ma zaczerwienić się; cofnij → zielony.
   Test, który przechodzi także po zepsuciu produktu, jest **tautologią** i naprawa jest
   odrzucona.
3. **Bezpieczniki kanonu po każdej zmianie UI**: `check-focus-canon.sh --ci`,
   `check-list-canon.sh`, `check-artefakt.sh` — wszystkie kodem `0`. ★ Fokus tokenem
   `c-focus`, **nigdy** `primary-*` (crimson `#85182F`).
4. **Przemiar całych trzech plików po nazwach**: `ui-po.json` i `diff` nazw wobec
   `ui-przed.json`. **Każda nazwa, która zniknęła, wymaga wyjaśnienia albo STOP-u.**

**Wymagany dowód:** diff naprawy z `plik:linia` · dowód mutacyjny w obie strony dla każdej
z czterech czerwieni · trzy bezpieczniki kanonu kodem `0` · `diff` nazw przed/po.
**Commit po `R2`.**

## R3 — REPRODUKCJA NIESTABILNOŚCI I ROZSTRZYGNIĘCIE TRZECH LICZB (rdzeń)

1. **Postaw kontener** `cx-day349-pg` na porcie `6396`, baza `cx349`, i przepuść migracje
   zgodnie z `§0.2c` (A) — **dwa przebiegi**, drugi bezbłędny i bez zmian (idempotencja).
   `pgvector/pgvector:pg16`; `postgres:15` **nie przechodzi migracji**.
2. **Rozstrzygnij trzy rozbieżne liczby dyżuru 335** (`18/11/7` vs `18/12/6` vs `12/18`),
   w szczególności **czy `day275` był czerwony czy zielony**. Źródła: surowy
   `evidence/g19/blok3-marker.json` (wiążący, bo maszynowy) i dwa dokumenty opisowe.
   Odczytaj też — **wyłącznie do odczytu, `shasum -a 256`** —
   `/private/tmp/cx-day335-g19-regresja-artefakty/blok3-po.json`; jeżeli plik zniknął,
   zapisz „dowód wyparował" i odtwórz pomiar sam.
3. **Odtwórz objaw**: uruchom Blok 3 na świeżej bazie, `--retry=0`, i zobacz, czy czerwienie
   `day274`/`day275`/`day276` wystąpią. **Jeżeli za pierwszym razem wyjdzie `18/18` —
   to NIE znaczy, że niestabilności nie ma; to znaczy, że nie trafiłeś w warunek.**
   Wtedy przechodzisz do punktu 4 i szukasz warunku celowo.
4. **Postaw i sprawdź cztery hipotezy, po kolei, każdą osobno** — to jest sedno pozycji:
   - **(H1) wyścig** — dwa przypadki piszą do tego samego wiersza; sprawdź uruchamiając
     pliki pojedynczo kontra razem;
   - **(H2) współdzielony stan bazy** — przypadek zostawia dane, które psują następny;
     sprawdź na bazie świeżej per plik kontra bazie wspólnej;
   - **(H3) kolejność plików** — `vitest` nie gwarantuje kolejności; sprawdź uruchomienie
     w kolejności odwrotnej i alfabetycznej;
   - **(H4) zależność od zegara** — `Date.now()`, granica doby, `TZ`; sprawdź, czy któryś
     przypadek porównuje daty.
   **Każda hipoteza dostaje: komendę, wynik, werdykt POTWIERDZONA/OBALONA.**
5. **Podaj `numTotalTests` dla każdego przebiegu.** Uruchomienie Bloku 3 z roota daje
   **0 wykonanych przypadków i `exit 0`** — to jest BŁĄD KOMENDY, nie PASS; zdarzyło się
   dyżurowi 335 i zostało słusznie odrzucone.

**Wymagany dowód:** rozstrzygnięcie trzech liczb z cytatami źródeł · wynik odtworzenia objawu ·
cztery hipotezy z komendą, wynikiem i werdyktem · `numTotalTests` każdego przebiegu ·
wynik obu przebiegów migracji. **Commit po `R3`.**

## R4 — PRZYCZYNA NIESTABILNOŚCI I DZIESIĘĆ PRZEBIEGÓW (rdzeń)

1. **Nazwij przyczynę jednym zdaniem, z `plik:linia`.** „Zależność od kolejności lub stanu"
   nie jest przyczyną — jest listą podejrzanych. Przyczyna to na przykład: *„`day276-workbook`
   czyta wiersz, który `day274` usuwa w `afterEach`, bo obie suity używają tego samego
   `organizationId` zaszytego w `plik:linia`"*.
2. **Napraw przyczynę**, jeżeli leży w kodzie testu albo w izolacji stanu. Jeżeli leży
   w produkcie (realny wyścig) — naprawiasz produkt, z dowodem mutacyjnym.
   **Jeżeli jedynym wyjściem byłby `--retry` albo `.skip` — STOP z uzasadnieniem** (`R0` 1).
3. **DZIESIĘĆ KOLEJNYCH PRZEBIEGÓW BEZ ZMIANY WYNIKU.** Zapisz `blok3-run-01.json` …
   `blok3-run-10.json`, każdy z `shasum -a 256`, wszystkie z `--retry=0`. Porównaj je
   **po nazwach przypadków** — nie po liczbach. **Jedna nazwa, która zmieniła stan między
   przebiegami, unieważnia dowód** i wracasz do punktu 1.
4. **Podaj, czy dziesięć przebiegów było na tej samej bazie, czy na świeżej per przebieg** —
   to zmienia znaczenie dowodu i musi być jawne.
5. **Sprzątanie:** `docker rm -fv cx-day349-pg` (bez `-v` wolumen zostaje), `df -h /` przed
   i po. Program stracił dobę na dysku zjedzonym przez niesprzątnięte artefakty.

**Wymagany dowód:** przyczyna jednym zdaniem z `plik:linia` · diff naprawy · dziesięć plików
JSON z `shasum -a 256` i porównaniem po nazwach · jawne zdanie o bazie · `df -h /` przed i po.
**Commit po `R4`.**

## R5 — BEZPIECZNIK PRZED NAWROTEM

Jeżeli przyczyna z `R4` na to pozwala, dodajesz **jeden** bezpiecznik, który zaczerwieni się,
gdy defekt wróci:

- test izolacji stanu między suitami, albo
- asercja, że każda suita Bloku 3 pracuje na własnym, unikalnym identyfikatorze, albo
- kontrakt `tabindex`/pustego stanu dla **całej rodziny** komponentów powłoki, nie tylko
  dla jednego wywołania (`KROK 0` z `R1`).

**Nowy plik testowy kładziesz w `tests/`, NIGDY pod `src/`** — dziś trzeba było przenosić trzy
razy — i dodajesz go przez `git add -f`.

**Bezpiecznik bez dowodu mutacyjnego nie jest bezpiecznikiem**: zepsuj to, czego broni →
czerwony; przywróć → zielony.

Jeżeli przyczyna **nie pozwala** na bezpiecznik (np. jest w bibliotece testowej) — piszesz to
wprost jako wynik i **nie dodajesz atrapy bezpiecznika**.

**Wymagany dowód:** plik bezpiecznika z pełną nazwą przypadku · dowód mutacyjny w obie strony ·
albo jawne zdanie „bezpiecznik niemożliwy, bo …". **Commit po `R5`.**

## R6 — RAPORT I PYTANIA DO WŁAŚCICIELA

Raport zawiera: cztery bloki rozstrzygnięć z `R1` (werdykt `PRODUKT`/`ASERCJA` per czerwień) ·
diffy naprawy i dowody mutacyjne z `R2` · rozstrzygnięcie trzech rozbieżnych liczb dyżuru 335
z `R3` · cztery hipotezy z werdyktami · przyczynę niestabilności jednym zdaniem z `plik:linia` ·
**dziesięć przebiegów z `shasum -a 256` i porównaniem po nazwach** · bezpiecznik z `R5` ·
listę rozbieżności wobec liczb tej instrukcji · **niepustą sekcję „TWIERDZENIA
NIEZWERYFIKOWANE"** · obowiązkowy akapit `§0.2e` dla każdego uruchomionego pakietu ·
deklarację `Z30`.

★★ **Osobna, obowiązkowa sekcja: „`retry: CI ? 3 : 1` — ZNALEZISKO, KTÓREGO NIE NAPRAWIAM".**
`vitest.config.ts` ustawia ponawianie i **to jest mechanizm, który zamienia niestabilność
w fałszywą zieleń w CI**. Nie wolno Ci go zmienić (`Z18`), ale masz go opisać jako znalezisko,
z rekomendacją jako **diff nienałożony** i z oszacowaniem, ile testów w korpusie może dziś
przechodzić dzięki ponawianiu.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA".** W szczególności, jeżeli któraś
z czterech czerwieni okazała się `ASERCJĄ` opisującą kontrakt, którego produkt świadomie nie
ma — **pytanie brzmi, czy kontrakt ma wrócić do produktu, czy zostać skasowany z testu**.
To jest decyzja produktowa, nie techniczna. Sekcja może być pusta, ale wtedy piszesz wprost:
„nie mam pytań".

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sprawdź ją komendą
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle pisze inny autor.

**Commit po `R6`.**

## Próg odbioru

**Cztery testy zielone z powodu naprawy produktu albo poprawienia błędnej asercji — z jawnym
uzasadnieniem, które to jest i dlaczego, oraz z dowodem mutacyjnym per czerwień; a niestabilność
wyjaśniona PRZYCZYNĄ (`plik:linia`, nie listą podejrzanych) i udowodniona DZIESIĘCIOMA
kolejnymi przebiegami bez zmiany wyniku, porównanymi po nazwach przypadków.**

Odbiorca odrzuci dyżur, w którym pojawi się `.skip`, `.todo`, `--retry` inne niż `0`,
poszerzony `exclude` albo obniżony próg; w którym niestabilność uznano za naprawioną po
jednym zielonym przebiegu; w którym porównanie jest po liczbach zamiast po nazwach; albo
w którym zmieniono asercję bez dowodu, że produkt świadomie zmienił kontrakt.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „cztery czerwienie rozstrzygnięte
per czerwień (k `PRODUKT`, l `ASERCJA`), naprawione m, niestabilność zreprodukowana i przypisana
hipotezie H2 z dowodem, dziesięć przebiegów niewykonane, bo …" — **jest pełnowartościowym
wynikiem, nawet jeśli nie wszystkie cztery testy zzieleniały.**

★★ **STOP jest tu wynikiem lepszym niż wyciszenie.** Jeżeli jedynym sposobem zzielenienia
czerwieni byłoby `.skip`, `--retry` albo obniżenie progu — **zatrzymujesz się i piszesz
dlaczego**. To jest dokładnie to zachowanie, za które dyżur 335 zasłużył na uznanie.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Zzieleń cztery testy" vs „zakaz wyciszania" | `R0` (1) i próg odbioru: zieleń pochodzi z naprawy produktu albo z poprawionej asercji z dowodem; wyciszenie to STOP, nie commit |
| „Wolno poprawić asercję" vs „zakaz zawężania kryterium" | `R0` (2) i `R2` punkt 2: poprawiona asercja wymaga **odwrotnej mutacji** — zepsuty produkt musi ją zaczerwienić; tautologia jest odrzucona |
| „`Z18` zakazuje ruszać `vitest.config.ts`" vs „`retry` maskuje niestabilność" | `LISTA_BRAMEK` i `R6`: **nie zmieniasz go**, obchodzisz jawnym `--retry=0` i opisujesz jako znalezisko z diffem **nienałożonym** |
| „`Z6` zakazuje cudzych katalogów `/private/tmp/cx-*`" vs „porównaj z `blok3-po.json`" | Tabela licencji: **wąska licencja WYŁĄCZNIE na odczyt i `shasum`** dwóch nazwanych plików; zapis i usuwanie nadal zakazane; brak pliku = odtwarzasz pomiar sam |
| „Napraw powłokę współdzieloną" vs „kanon UI jest prawem nadrzędnym" | Tabela licencji i `R2` punkt 3: naprawiasz **dokładnie to, co opisuje test**, fokus tokenem `c-focus`, a trzy bezpieczniki kanonu muszą kończyć się `0` |
| „Napraw rodzinę" vs „zakaz napraw poza zakresem" | `R1` punkt „sprawdź RODZINĘ" i `R5`: rodzinę **wypisujesz i pokrywasz bezpiecznikiem**; naprawa rodzeństwa poza czterema czerwieniami wymaga jawnego akapitu w raporcie i zgody na rozszerzenie zakresu |
| „Dziesięć przebiegów" vs „nie marnuj czasu" | `R4` punkt 3: to jest **jedyny akceptowany dowód** dla niestabilności; przebiegi są sekwencyjne i tanie w porównaniu z kosztem fałszywej zieleni |
| „Odtwórz objaw" vs „za pierwszym razem wyszło zielono" | `R3` punkt 3: zielony pierwszy przebieg **nie obala** niestabilności; przechodzisz do celowego szukania warunku (H1-H4) |
| „Nie dotykasz macierzy" vs „to jest praca pod G19" | Tabela licencji: `G19` należy do dyżuru 348; Ty dostarczasz **materiał** do tego wiersza, nie zmieniasz go |
| „Cofaj mutacje" vs `Z27` (zakaz `git stash`) | `R2` punkt 2 i `R4`: kopia przez `cp` do `SCRATCH`; `git diff` po cofnięciu ma być pusty |
| „Zero nowych dokumentów" (`Z13`) vs „pliki dowodowe i sekcja rejestru" | Tabela licencji: rejestr znalezisk to **AKTUALIZACJA istniejącego**, `evidence/day349/` to **ślad**; nowy dokument rejestrowy jest dokładnie jeden — raport `R6` |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — trzy pliki testowe UI, sześć plików Bloku 3, `decision.validators.ts`, `blok3-marker.json` sprawdzone; `evidence/day349/` **jawnie oznaczony jako nieistniejący**; `blok3-po.json` **jawnie oznaczony jako nieobecny w repo** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1-3, 5-7 i 11 zmierzone przy wydaniu, w tym pełny przebieg trzech plików UI (`62/58/4`) |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — walidator · montaż · kontroler Bloku 3 · serwis/repozytorium · middleware · UI powłoki · kanon · testy czerwieni · testy Bloku 3 · infrastruktura testów · artefakty cudze · dowody 335 · dowody własne · nowe testy · macierz · rejestr · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` i `R3` nie zmieniają kodu; `R2` dotyka wyłącznie czterech miejsc opisanych testami; `R4`/`R5` dotykają izolacji stanu i nowego pliku w `tests/` |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6396/5536 wolne (`lsof` przy wydaniu), brak kontenera `cx-day349-pg`, brak gałęzi `codex/day349-*` i worktree; 347/348/350 mają rozłączne porty i pliki; paczka 343-346 ma zarezerwowany przedział 6390-6393/5530-5533 i rozłączny temat; kolizja z 348 rozstrzygnięta imiennie po obu stronach |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera, łącznie z pełnym przebiegiem trzech plików testowych |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: `retry: CI ? 3 : 1`, „te same liczby" bez nazw, cztery różne kształty czerwieni, kanon powłoki, niestabilność jako własność harnessu, atrapa bazy, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
