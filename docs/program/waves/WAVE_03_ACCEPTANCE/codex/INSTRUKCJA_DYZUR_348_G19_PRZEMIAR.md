# INSTRUKCJA DYŻURU nr 348 — Codex — „★★★ BRAMKA G19 — PRZEMIERZYĆ JĄ NA BIEŻĄCYM MARKERZE, WIERSZ PO WIERSZU, I PODNIEŚĆ TE, KTÓRE MAJĄ DOWÓD ZAŁĄCZONY W TYM SAMYM COMMICIE. Wszystkie 16 wierszy `G19` stoją dziś na `NOT_PROVEN / OWNER_RETEST_PENDING`. Dyżur 335 (scalony) **niczego nie podniósł i miał rację** — jego własny raport mówi wprost: „nie proponuję mocniejszego stanu”, bo dowód jest przeterminowany. ★★ Mój pomiar, który masz powtórzyć: dowód G19 stoi na ZAMROŻONYM markerze `fee24bddb0`, a `HEAD` jest dziś **615 commitów dalej** (dyżur 335 mierzył 543 — mierzył na `1c4b5a5635`, nie na dzisiejszym markerze); na ścieżkach współdzielonych, które G19 mierzy Z DEFINICJI, zmieniło się **106 plików** (90 bez testów: 91 tras + 2 middleware + 10 UI + 2 słowniki), a nie 104/89 z pomiaru 335. **Zapis `G19-Z3=0` był prawdą wtedy i jest fałszem dziś** — bramka o „obowiązkach regresji po PÓŹNIEJSZYCH zmianach” mierzy przeszłość, a jej mianownik rośnie szybciej niż dowód. ★ To NIE jest powtórka 335: dyżur 335 zostawił gotowe kubełki (`A=7, B=0, C=9`) i **wykonał tylko jedną pozycję kubełka maszynowego** — parę izolacyjną day307 z pełnym dowodem mutacyjnym. Twoje zadanie to **wykonać RESZTĘ kubełka `A` na bieżącym markerze** i rozstrzygnąć per wiersz, czy dowód wystarcza. ★★ `TECHNICAL_REGRESSION_PASS` został ODRZUCONY przez odbiorcę dyżuru 290 („Wariant 1 pozostaje niedostępny”) i **nie wolno go wprowadzić pod inną nazwą**"

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
> **wyłącznie** `/private/tmp/cx-day348-g19-przemiar`.

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
Zakres: **PRZEKROJOWE — bramka `G19` („Shared-surface regression obligations after later changes”) macierzy odbioru fali 3, wszystkie 16 modułów. Przedmiotem pracy jest **PRZEMIAR NA BIEŻĄCYM MARKERZE** i podniesienie tych wierszy, które mają dowód załączony w tym samym commicie — nie budowanie dowodów od zera i nie powtarzanie pomiaru dyżuru 335. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, i plikiem postępu `/private/tmp/cx-day348-postep.md` (poza repo)**.
Trasy front: `Mianownik G19 po stronie frontu, do ODCZYTU i do URUCHOMIENIA, nie do przebudowy: `src/components/standard/**`, `src/components/shared/**`, `src/components/ui/**`, `src/index.css`, `tailwind.config.js`, `public/locales/{pl,en}/translation.json`. Pełna imienna lista 104 plików z pomiaru 335: `evidence/g19/day335-dryf.md`; **Twoja lista będzie DŁUŻSZA — moje 106 na dzisiejszym markerze — i masz ją wypisać z nazwy, nie przepisać cudzą**. Blok 1 (UI jednostkowe) dał u 335 na markerze `1c4b5a5635` wynik `131 wykonanych / 127 zielonych / 4 czerwone` (`evidence/g19/blok1-marker.json`) — te cztery czerwienie są terenem dyżuru 349, Ty ich NIE naprawiasz`. Trasy tył: `★★ SEDNO. Mianownik G19 po stronie serwera: `server/src/middleware/**` i `server/src/routes/**` — na dzisiejszym markerze to **91 plików tras i 2 middleware** zmienione od `fee24bddb0`. Blok 2 (middleware jednostkowe) dał u 335 `218/218 GREEN` (`evidence/g19/blok2-marker.json`). Blok 3 (kontrakty tras przez realny `ApiGateway`/JWT/RealPG) to sześć plików: `server/src/routes/__tests__/{ai.agentHubRateLimitRouting,day274-ocena-dociera-do-listy.pg,day275-method-outputs-kontrakt.pg,day276-deck-autosave-persist.pg,day276-workbook-cell-persist.pg,day277-decyzje-zapis.pg}.test.ts` — pełny mianownik w `evidence/g19/mianownik.md`. ★★ Para izolacyjna **JEST JUŻ WYKONANA i ma pełny dowód mutacyjny** (dyżur 335, `evidence/g19/day335-r3-maszynowy.md`): `server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts`, przypadek „denies foreign workload lookup while the owner reads the seeded task”, mutacja usuwająca `AND organization_id = ?` z prechecku w `TaskController.getUserWorkload` (`server/src/controllers/TaskController.ts:2692`) daje RED, przywrócenie przez `cp` daje GREEN, `git diff` po przywróceniu pusty. **NIE budujesz tego drugi raz — rozstrzygasz, czy to wystarcza, żeby podnieść wiersz `01_ORGANIZATION` i `08_MEETINGS`, i ODTWARZASZ dowód na dzisiejszym markerze**`.

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
WT=/private/tmp/cx-day348-g19-przemiar
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
git -C "$VAULT" worktree add "$WT" -b codex/day348-g19-przemiar-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day348-g19-przemiar/config.worktree"
cat "$VAULT/worktrees/cx-day348-g19-przemiar/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day348-g19-przemiar-scratch
mkdir -p /private/tmp/cx-day348-g19-przemiar-artefakty

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
git -C "$WT" push github-backup codex/day348-g19-przemiar-20260904
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

# (1) TEZA: wszystkie 16 wierszy G19 stoja na NOT_PROVEN / OWNER_RETEST_PENDING
for m in docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/; do \
  printf '%-20s :: ' "$(basename $m)"; \
  grep -E '^\|[[:space:]]*G19\b' "$m/MODULE_ACCEPTANCE.md" | head -1 | awk -F'|' '{gsub(/^ +| +$/,"",$4); print $4}'; \
done
#   moje liczby: 16 z 16 = `NOT_PROVEN / OWNER_RETEST_PENDING`, bez wyjatku

# (2) ★★ TEZA ROZSTRZYGAJACA: marker dowodu jest DALEKO za HEAD i dystans UROSL od pomiaru 335
git merge-base --is-ancestor fee24bddb0 HEAD \
  && echo "przodek, commitow do HEAD: $(git rev-list --count fee24bddb0..HEAD)" || echo 'NIE przodek'
#   moja liczba: przodek, 615 commitow. Dyzur 335 zapisal 543 — mierzyl na 1c4b5a5635,
#   ktory jest dzis 72 commity za HEAD. ★ ROZBIEZNOSC JEST OCZEKIWANA I JEST SENSEM TEGO DYZURU

# (3) ★★ TEZA ROZSTRZYGAJACA: mianownik bramki UROSL po jej zmierzeniu
git diff --name-only fee24bddb0 HEAD -- \
  src/components/standard src/components/shared src/components/ui \
  src/index.css tailwind.config.js public/locales \
  server/src/middleware server/src/routes > /private/tmp/cx-day348-g19-przemiar-artefakty/g19-dryf-dzis.txt
wc -l < /private/tmp/cx-day348-g19-przemiar-artefakty/g19-dryf-dzis.txt
for p in src/components/standard src/components/shared src/components/ui server/src/middleware server/src/routes public/locales; do \
  printf '%-30s ' "$p"; grep -c "^$p" /private/tmp/cx-day348-g19-przemiar-artefakty/g19-dryf-dzis.txt; done
bash -c "grep -vcE '__tests__|\.test\.|\.spec\.' /private/tmp/cx-day348-g19-przemiar-artefakty/g19-dryf-dzis.txt"
#   moje liczby: 106 plikow razem; standard 1 · shared 7 · ui 2 · middleware 2 · routes 91 · locales 2;
#   bez testow 90. Dyzur 335 mial 104 i 89 — roznica to dryf jednego dnia

# (4) TEZA: dowod pary izolacyjnej ISTNIEJE i jest kompletny — NIE budujesz go drugi raz
ls server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts
bash -c "grep -n 'denies foreign workload lookup' server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts"
bash -c "grep -n 'organization_id' server/src/controllers/TaskController.ts | head -5"
#   oczekiwane: plik istnieje; przypadek w okolicy wiersza 214;
#   cel mutacji `AND organization_id = ?` w TaskController.ts okolice wiersza 2692

# (5) TEZA: kubelki i mianowniki dyzuru 335 leza w repo i sa punktem wyjscia
ls evidence/g19/day335-kubelki.md evidence/g19/day335-dryf.md evidence/g19/day335-r3-maszynowy.md \
   evidence/g19/day335-r4-czerwienie.md evidence/g19/day335-dlug.md evidence/g19/mianownik.md
bash -c "grep -n 'Suma:' evidence/g19/day335-kubelki.md"
#   oczekiwane: szesc plikow istnieje; suma kubelkow A=7, B=0, C=9

# (6) ★★ TEZA: werdykt TECHNICAL_REGRESSION_PASS zostal ODRZUCONY i tego NIE odwracasz
bash -c "grep -n 'TECHNICAL_REGRESSION_PASS' docs/program/REJESTR_ZNALEZISK_20260903.md"
#   oczekiwane: wiersz o odbiorze dyzuru 290 z cytatem „Wariant 1 pozostaje niedostepny”

# (7) TEZA: cztery czerwienie Bloku 1 to TEREN DYZURU 349, nie Twoj
ls src/components/shared/__tests__/filterableTable.r04-2a.test.tsx \
   src/components/shared/__tests__/standardPreview.r03.test.tsx \
   src/components/shared/__tests__/tablePreviewGeometry.r03-2.test.tsx
#   oczekiwane: trzy pliki istnieja. ★ Ty ich NIE naprawiasz — odnotowujesz jako granice dowodu Bloku 1

# (8) TEZA: liscie slownikow i bramki kanonu na markerze
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35198, en 33065; focus=0, list=0, artefakt=0, reach=0

# (9) zasoby: dysk, porty, kontener
df -h /
lsof -nP -iTCP:6395 -sTCP:LISTEN; lsof -nP -iTCP:5535 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day348 || true
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day348-g19-przemiar-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6395`. Twój JEDYNY port harnessu to `5535`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day348-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki 04.09 — nie dotykasz: 347 (6394/5534), 349 (6396/5536), 350 (6397/5537). Równoległa paczka 343-346 ma zarezerwowany przedział 6390-6393 i 5530-5533 — również nie dotykasz. Starsze rodzeństwo 04.09: 334 (6370/5510), 335 (6371/5511), 336 (6372/5512), 337 (6373/5513). Cudze worktree 286-298 używają 6290-6299 i 5250-5269. Twoje własne wyłącznie: baza 6395, harness 5535. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`). ★★ Seeder dyżuru 307 jest fail-closed na historyczne `6314/cx307`; dyżur 335 obszedł to KOPIĄ POZA REPO, zmieniając wyłącznie guard na swoje porty i **nie zmieniając źródła w repo** — Ty robisz tak samo, ze swoimi `6395/cx348``. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK. Ten dyżur nie dodaje, nie zmienia i nie przełącza ANI JEDNEJ flagi funkcyjnej. Jeżeli któryś pomiar wymaga flagi `ON`, żeby przejść — to jest ZNALEZISKO i granica dowodu, którą wypisujesz z nazwy flagi, nigdy zmiana wartości domyślnej`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/src/middleware/auth.middleware.ts`, `server/src/services/ApiGateway.ts`. Wszystkie NIETYKALNE DO ZAPISU — wolno je wołać w pomiarze, nie wolno ich zmieniać, także wtedy gdy „wystarczyłaby drobna zmiana, żeby test przeszedł”`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY348_G19_PRZEMIAR_REPORT.md`. Jedyny inny dokument do zmiany: `docs/program/waves/WAVE_03_ACCEPTANCE/modules/<MODUŁ>/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE wiersz `G19` i WYŁĄCZNIE pod twardym warunkiem z `R0`: wiersz zmienia stan tylko razem z dowodem w TYM SAMYM commicie. Dodatkowo: dopisanie sekcji „Aktualizacja dyżuru 348” do `docs/program/waves/WAVE_03_ACCEPTANCE/G19_INWENTARZ_OBOWIAZKOW_20260903.md` (dopisanie, nigdy nadpisanie), nowe pliki dowodowe pod `evidence/g19/day348/` (katalog NIE ISTNIEJE na markerze — tworzysz go) oraz jedna nowa sekcja w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze (sekcje idą dziś do `O`, ale równoległy autor też dopisuje — literę sprawdzasz komendą tuż przed commitem, nie zakładasz z góry). **ZAKAZ dotykania wierszy `G00`–`G18` i `G20`** oraz **ZAKAZ nadpisywania plików `evidence/g19/day335-*` i `evidence/g19/blok*.json`** — historia pomiaru z 03/04.09 zostaje nietknięta. Plik postępu `/private/tmp/cx-day348-postep.md` żyje POZA repo. Nowe pliki w `tests/` wymagają `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day348-g19-przemiar-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day348-g19-przemiar-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ WPISANIA `PASS` I `TECHNICAL_REGRESSION_PASS` DO WIERSZA `G19` W JAKIMKOLWIEK MODULE** — wariant został jawnie ODRZUCONY przez odbiorcę dyżuru 290 („Wariant 1 pozostaje niedostępny”) i tej decyzji nie odwracasz, także wtedy, gdy Twoje pomiary wyjdą zielone. **ZAKAZ WPROWADZENIA GO POD INNĄ NAZWĄ** — `REGRESSION_VERIFIED`, `TECH_PASS`, `MACHINE_PASS`, `PARTIAL_PASS` i każdy inny napis, który znaczy „technicznie sprawdzone, przelot właściciela pominięty”, jest tym samym wariantem w innym opakowaniu i będzie odrzucony tak samo. Dopuszczalne nowe stany to wyłącznie takie, które **nazywają ZAKRES dowodu i jego GRANICĘ**. **ZAKAZ ZMIANY STANU WIERSZA BEZ DOWODU ZAŁĄCZONEGO W TYM SAMYM COMMICIE** — wpis i dowód są jednym commitem albo nie ma wpisu; wpis bez dowodu jest podstawą odrzucenia CAŁEGO dyżuru. **ZAKAZ PRZYJĘCIA SYMETRYCZNEJ ODPOWIEDZI (`404/404`, `403/403`, `200/200`) JAKO DOWODU IZOLACJI** — dowodem jest PARA: „obcy NIE widzi konkretnego, ISTNIEJĄCEGO obiektu właściciela” **oraz** „właściciel TEN SAM obiekt widzi”; sama odmowa dla obu stron to kształt „zamknięte przez wygaszenie”. **ZAKAZ NAPRAWIANIA CZTERECH CZERWIENI BLOKU 1** — to teren dyżuru 349. **ZAKAZ `--retry` innego niż `0`, `.skip`, `.todo`, poszerzania `exclude` i zmiany asercji, żeby zzielenieć** | G19 jest jedyną bramką macierzy, w której wszystkie 16 wierszy stoją na `NOT_PROVEN`, mimo że wykonano pod nią bardzo dużo realnej pracy pomiarowej. Poprzedni dyżur chciał to zamknąć nazwą wariantu; odbiorca odrzucił nazwę, bo nazwa nie jest dowodem. Prawdziwy powód jest inny: cały dowód stoi na markerze sprzed 615 commitów, a bramka z definicji mierzy „obowiązki regresji po PÓŹNIEJSZYCH zmianach”. **Bramka, której mianownik rośnie szybciej niż dowód, nie domknie się nigdy — i to jest pytanie, które ten dyżur ma postawić właścicielowi, a nie obejść** |

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
cd /private/tmp/cx-day348-g19-przemiar

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day348-pg psql -U postgres -d cx348 \
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
cd /private/tmp/cx-day348-g19-przemiar

docker run -d --name cx-day348-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx348 \
  -p 127.0.0.1:6395:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day348-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6395/cx348 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6395/cx348 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day348-g19-przemiar && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6395/cx348 \
JWT_SECRET=cx348-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Blok 1 (UI jednostkowe) z roota, wariant (C) `RUN_DB_TESTS=0 MOCK_DB=true`. Blok 2 (middleware jednostkowe) z cwd `server/`, wariant jednostkowy — **i wpisujesz wprost, że nie dowodzi realnego PG**. Blok 3 i para izolacyjna day307 z cwd `server/`, z `server/vitest.config.ts`, wariant (B) `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6395/cx348` — uruchomienie z roota bez właściwego configu daje **0 wykonanych przypadków i `exit 0`**, co jest BŁĘDEM KOMENDY, nie PASS (zdarzyło się dyżurowi 335). Wszystko z `--retry=0` i `--reporter=json --outputFile=/private/tmp/cx-day348-g19-przemiar-artefakty/<blok>.json`. **W raporcie podajesz `numTotalTests`, nie tylko `numFailedTests`.** Porównania wyłącznie po pełnych nazwach przypadków (`fullName`) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day348-g19-przemiar-artefakty/day348-g19-przemiar.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day348-g19-przemiar && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Blok 1 (UI jednostkowe) z roota, wariant (C) `RUN_DB_TESTS=0 MOCK_DB=true`. Blok 2 (middleware jednostkowe) z cwd `server/`, wariant jednostkowy — **i wpisujesz wprost, że nie dowodzi realnego PG**. Blok 3 i para izolacyjna day307 z cwd `server/`, z `server/vitest.config.ts`, wariant (B) `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6395/cx348` — uruchomienie z roota bez właściwego configu daje **0 wykonanych przypadków i `exit 0`**, co jest BŁĘDEM KOMENDY, nie PASS (zdarzyło się dyżurowi 335). Wszystko z `--retry=0` i `--reporter=json --outputFile=/private/tmp/cx-day348-g19-przemiar-artefakty/<blok>.json`. **W raporcie podajesz `numTotalTests`, nie tylko `numFailedTests`.** Porównania wyłącznie po pełnych nazwach przypadków (`fullName`) --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day348-g19-przemiar-artefakty/day348-g19-przemiar.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day348-g19-przemiar/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day348-pg psql -U postgres -d cx348 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day348-pg`.
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
> **(e) ★★★ **SZEŚĆ PUŁAPEK.** (1) **Ta bramka nie domyka się z definicji, dopóki mierzy się ją wobec zamrożonego markera** — mianownik urósł ze 104 do 106 plików w JEDEN dzień. Praca polega na przemiarze i na postawieniu pytania, nie na dogonieniu ruchomego celu. (2) **Powtórzenie dyżuru 335 nie jest wynikiem.** 335 zmierzył dryf i wykonał JEDNĄ pozycję kubełka maszynowego; przemiar tego samego da tę samą odpowiedź i zmarnuje dzień. Twój delta to **reszta kubełka `A` i orzeczenie per wiersz**. (3) **Symetryczna odmowa udaje izolację** — `404` dla obcego i `404` dla właściciela to nie dowód, tylko wygaszenie; wymagana jest PARA na TYM SAMYM istniejącym obiekcie. (4) **Atrapa bazy kłamie o zapisie**: `Database.ts:686` zwraca `changes:1` dla każdego `UPDATE` niezależnie od `WHERE`. (5) **`NODE_ENV=test` bez `RUN_DB_TESTS=1` podstawia atrapę pod `DbPromise`** — `pg.Pool` widzi wiersz, kod produkcyjny nie; a pierwsza próba Bloku 3 u dyżuru 335 z roota wykonała **0 przypadków** i została słusznie odrzucona jako błąd komendy. (6) **`grep --include` w `zsh` zwraca pustkę zamiast wyników** — uruchamiaj przez `bash -c '…'` i sprawdzaj kod wyjścia; pustka nie jest wynikiem, dopóki nie wiesz, że komenda się wykonała**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day348-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day348-g19-przemiar-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarda zasada: wiersz zmienia stan tylko z dowodem w tym samym commicie; zakaz odrzuconego wariantu pod inną nazwą) · R1 (przemiar dryfu na BIEŻĄCYM markerze, imiennie — RDZEŃ) · R2 (rewizja kubełków `A`/`B`/`C` dyżuru 335 na dzisiejszym stanie — RDZEŃ) · R3 (wykonanie CAŁEGO kubełka maszynowego z mutacją celującą w zabezpieczenie — RDZEŃ) · R4 (orzeczenie per wiersz: co dokładnie brakuje, żeby ten wiersz się podniósł) · R5 (podniesienie wierszy, które mają dowód — liczba podniesionych = liczba dowodów) · R6 (raport + pytanie rozstrzygalne do właściciela o kotwicę pomiaru G19)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6395` albo `5535` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6395` albo `5535`** (`Z7`).

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

Bramka **`G19` — „Shared-surface regression obligations after later changes"** jest jedyną
bramką macierzy, w której **wszystkie 16 wierszy stoją na `NOT_PROVEN / OWNER_RETEST_PENDING`**,
mimo że wykonano pod nią bardzo dużo realnej pracy pomiarowej.

Dyżur 335 (scalony 04.09) **nie podniósł ani jednego wiersza — i miał rację**. Jego własny
raport kończy się zdaniem:

> *„Nie proponuję mocniejszego stanu."*

**Powód, dla którego miał rację, jest strukturalny i jest sednem tego dyżuru:** cały dowód
G19 stoi na **zamrożonym markerze `fee24bddb0`**, a bramka mierzy z definicji „obowiązki
regresji po **PÓŹNIEJSZYCH** zmianach". **Bramka, której mianownik rośnie szybciej niż dowód,
mierzy przeszłość i nie domknie się nigdy** — dopóki nikt nie rozstrzygnie, wobec czego ma
być mierzona.

**Stan zastany, zmierzony przeze mnie na markerze `6a4919f72db338e7f49a2cacb3787d20cc649883`:**

| Co | Pomiar dyżuru 335 (na `1c4b5a5635`) | **Mój pomiar dziś (na markerze)** |
| --- | --- | --- |
| commitów od `fee24bddb0` | 543 | **615** |
| plików mianownika G19 | 104 | **106** |
| plików bez testów | 89 | **90** |
| `server/src/routes` | (77 serwerowych razem) | **91** |
| `server/src/middleware` | — | **2** |
| `src/components/shared` | 7 | **7** |
| `src/components/ui` | — | **2** |
| `src/components/standard` | 0 | **1** |
| słowniki | 2 | **2** |

**Mianownik urósł o dwa pliki w jeden dzień, a dystans o 72 commity.** To nie jest błąd
dyżuru 335 — to jest własność bramki. **Zapis znaleziska `G19-Z3 = 0 plików` był prawdą, gdy
go zapisano, i jest fałszem dziś.**

**Wszystkie 16 wierszy `G19` mają dziś dokładnie ten sam stan** — sprawdziłem każdy z osobna:
`NOT_PROVEN / OWNER_RETEST_PENDING`, bez wyjątku.

## ★★ TO NIE JEST POWTÓRKA DYŻURU 335 — oto dokładna różnica

Dyżur 335 zostawił w repo cztery rzeczy, których **nie budujesz od nowa**:

1. **Kubełki dla 16 wierszy** (`evidence/g19/day335-kubelki.md`), z imiennym uzasadnieniem
   każdego: **`A` = 7 modułów** (`01`, `04`, `05`, `06`, `08`, `11`, `13`) — luka wykonalna
   maszynowo; **`B` = 0**; **`C` = 9 modułów** (`02`, `03`, `07`, `09`, `10`, `12`, `14`,
   `15`, `16`) — wymaga oczu właściciela na realnym rekordzie.
2. **Trzy mianowniki kotwic G18** — `141 / 125 / 123` plików, nie historyczne `49 / 30 / 28`;
   cztery późne kotwice dają listy **bajtowo identyczne** (`cmp` exit 0).
3. **Wyniki trzech bloków** na markerze `1c4b5a5635`: Blok 1 (UI jednostkowe) `131/127/4`,
   Blok 2 (middleware jednostkowe) `218/218/0`, Blok 3 (trasy przez realny `ApiGateway`/JWT/
   RealPG) `18/12/6`, po naprawie payloadu `day277` — `18/18`.
4. **Parę izolacyjną `day307` z KOMPLETNYM dowodem mutacyjnym**
   (`evidence/g19/day335-r3-maszynowy.md`): przypadek
   `Day 307 paired cross-org GET flight through ApiGateway denies foreign workload lookup
   while the owner reads the seeded task`; obcy token dostaje `404
   TASK_WORKLOAD_USER_NOT_FOUND`, właściciel **ten sam `userId`** czyta `200` z `total: 1`;
   mutacja usuwająca `AND organization_id = ?` z prechecku w `TaskController.getUserWorkload`
   (`server/src/controllers/TaskController.ts` okolice wiersza **2692**) daje RED
   (`expected 200 to be 404`), przywrócenie przez `cp` daje GREEN, `git diff` po przywróceniu
   pusty.

**Twoja robota to trzy rzeczy, których 335 NIE zrobił:**

- **przemiar na BIEŻĄCYM markerze** — jego liczby są sprzed 72 commitów;
- **wykonanie RESZTY kubełka `A`** — 335 wykonał jedną pozycję (`day307`, moduły `01`/`08`),
  a kubełek ma **siedem** modułów; pozostają `04`, `05`, `06`, `11`, `13`;
- **orzeczenie PER WIERSZ, co dokładnie brakuje**, żeby ten konkretny wiersz się podniósł —
  zdanie „przelot właściciela pozostaje wymagany" powtórzone 16 razy **nie jest orzeczeniem**.

## ★★ CZEGO NIE WOLNO ZROBIĆ — decyzja odbiorcy, której nie odwracasz

Dyżur 290 zaproponował zamknięcie G19 wariantem `TECHNICAL_REGRESSION_PASS`. **Odbiorca to
odrzucił**, cytat z rejestru znalezisk: *„Wariant 1 pozostaje niedostępny"*.

**Nie wolno wpisać `PASS` ani `TECHNICAL_REGRESSION_PASS`. Nie wolno też wprowadzić tego
wariantu POD INNĄ NAZWĄ** — `REGRESSION_VERIFIED`, `TECH_PASS`, `MACHINE_PASS`,
`PARTIAL_PASS` ani żaden inny napis, który znaczy „technicznie sprawdzone, przelot właściciela
pominięty". Nazwa nie była problemem sama w sobie; problemem było, że **nie domykała
definicji bramki**.

**Dopuszczalne nowe stany** to wyłącznie takie, które **nazywają ZAKRES dowodu i jego
GRANICĘ** — na przykład stan częściowy z jawnie wypisanym otwartym długiem, albo
`NOT_PROVEN / OWNER_RETEST_PENDING` z rozszerzonym, konkretnym uzasadnieniem („brakuje
dokładnie X"). Jeżeli uważasz, że wiersz zasługuje na mocniejszy stan — **piszesz to jako
PROPOZYCJĘ w raporcie, z gotowym tekstem wiersza, i zostawiasz decyzję odbiorcy.**

## ★ Zmierz moje liczby sam

Twierdzę, na markerze:

- **16 z 16** wierszy `G19` = `NOT_PROVEN / OWNER_RETEST_PENDING`;
- `fee24bddb0` jest przodkiem `HEAD`, dystans **615** commitów;
- mianownik dryfu: **106** plików, **90** bez testów; rozbicie **1 / 7 / 2 / 2 / 91 / 2**;
- kubełki 335: **A=7, B=0, C=9**;
- `day307-crossorg-read-flight.pg.test.ts` **istnieje**, przypadek pary izolacyjnej
  w okolicy wiersza **214**, cel mutacji w `TaskController.ts` w okolicy wiersza **2692**;
- trzy pliki czterech czerwieni Bloku 1 istnieją i są **terenem dyżuru 349**;
- liście słowników: **pl 35198**, **en 33065**; cztery bezpieczniki (`focus-canon`,
  `list-canon`, `artefakt`, `reachability --check-baseline`) kończą się kodem **0**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.** Rozbieżność wobec liczb dyżuru 335 (543/104/89) **jest
oczekiwana i jest sensem tego dyżuru** — nie zgłaszaj jej jako błędu instrukcji.

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Walidator / schematy** | `server/src/schemas/**` | **TYLKO ODCZYT** — schemat jest kontraktem produktu; jeżeli test się o niego rozbija, przestarzały jest test | Cytat wiersza schematu + brief |
| **Trasa (montaż)** | `server/src/services/ApiGateway.ts`, `server/src/routes/v8/index.ts` | **TYLKO ODCZYT — WOŁASZ, NIE ZMIENIASZ.** Dowodem ścieżki jest `ApiGateway.getInstance().initializeRoutes(app)` (`Z22`), z **zapisanym kodem odpowiedzi** | Opis w raporcie |
| **Kontroler / trasy** | `server/src/routes/**`, `server/src/controllers/**` | **TYLKO ODCZYT** — ten dyżur MIERZY i MUTUJE tymczasowo dla dowodu, nie zmienia produktu trwale. Każda mutacja jest cofana przez `cp` i `git diff` po cofnięciu ma być **pusty** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff **nienałożony** |
| **Serwis / repozytorium** | `server/src/services/**`, `server/src/domain/**`, `server/src/repositories/**` | **TYLKO ODCZYT** | jak wyżej |
| **Middleware / model uprawnień** | `server/src/middleware/**` | **NIETYKALNE DO ZAPISU** (`Z12`) — także `auth.middleware.ts` i `mfaEnrollmentToken.middleware.ts` | Brief |
| **Produkt UI (mianownik G19)** | `src/components/standard/**`, `src/components/shared/**`, `src/components/ui/**`, `src/index.css`, `tailwind.config.js` | **TYLKO ODCZYT.** To są pliki, których zmiana wywołała całą bramkę; ich dotknięcie unieważnia pomiar | Opis w raporcie z `plik:linia` |
| **Testy — istniejące** | `src/components/{standard,shared,ui}/__tests__/**`, `server/src/middleware/__tests__/**`, sześć plików Bloku 3 z `evidence/g19/mianownik.md` | **★ WĄSKA LICENCJA:** wolno **URUCHAMIAĆ** i wolno **dodawać** nowe przypadki. **Zakaz** zmiany progu, usuwania asercji i zawężania zakresu, żeby zzielenieć. Jeżeli test jest przestarzały wobec schematu — naprawiasz PAYLOAD testu i pokazujesz mutacyjnie, że nadal broni tego, co bronił | — |
| **Cztery czerwienie Bloku 1** | `src/components/shared/__tests__/{filterableTable.r04-2a,standardPreview.r03,tablePreviewGeometry.r03-2}.test.tsx` | **TYLKO ODCZYT — TEREN DYŻURU 349.** Odnotowujesz je jako granicę dowodu Bloku 1 i idziesz dalej | Wpis do raportu |
| **Seeder dyżuru 307** | `server/src/routes/__tests__/day307-crossorg-read-flight.pg.test.ts` i jego seeder | **★ WĄSKA LICENCJA:** wolno **URUCHAMIAĆ**. Guard jest fail-closed na historyczne `6314/cx307` — obchodzisz to **KOPIĄ POZA REPO** (jak zrobił dyżur 335), zmieniając wyłącznie guard na swoje `6395/cx348`; **źródło w repo pozostaje niezmienione** | — |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **Dowody** | `evidence/g19/day348/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**) | **★ PEŁNA LICENCJA na tworzenie i dopisywanie** | — |
| **Dowody dyżuru 335** | `evidence/g19/day335-*`, `evidence/g19/blok*.json`, `evidence/g19/mianownik.md`, `evidence/g19/*mutation*` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** To jest baza porównania; nadpisanie unieważnia cały dyżur | — |
| **Inwentarz G19** | `docs/program/waves/WAVE_03_ACCEPTANCE/G19_INWENTARZ_OBOWIAZKOW_20260903.md` | **AKTUALIZACJA przez DOPISANIE** sekcji „Aktualizacja dyżuru 348" — historia z 03.09 zostaje nietknięta; sprawdź, że plik nie jest generowany | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`, **wyłącznie wiersz `G19`** | **★ WĄSKA LICENCJA POD WARUNKIEM `R0`:** wiersz zmienia stan **tylko razem z dowodem w TYM SAMYM commicie**. **ZAKAZ `PASS`, `TECHNICAL_REGRESSION_PASS` i każdego synonimu.** Zakaz dotykania wierszy `G00`–`G18` i `G20` | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY348_G19_PRZEMIAR_REPORT.md` (**NOWY**) | `R6` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `evidence/g15/**`, `resultsInternalBetaVisibility.middleware.ts`, `server/src/routes/resultsVnext/__tests__/**`, wiersz `G15` (dyżur 347) · trzy pliki czterech czerwieni Bloku 1 i `day27{4,5,6}-*.pg.test.ts` w części „niestabilność" (dyżur 349) · `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, wiersz `G16` (dyżur 350) · wszystko wokół `DEC-388`, kafli SWOT, panelu Idei i kompletności raportu (dyżury 343-346) · `server/migrations/**` (przedział nieprzydzielony) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

★★ **Kolizja terenu z dyżurem 349 — rozstrzygnięta tutaj.** Cztery czerwienie Bloku 1
(`filterableTable.r04-2a`, `standardPreview.r03` ×2, `tablePreviewGeometry.r03-2`) oraz
niestabilność `day274`/`day275`/`day276` należą do **dyżuru 349**. Ty je **URUCHAMIASZ**
(bo są w mianowniku G19) i **zapisujesz wynik**, ale **NIE naprawiasz** — w raporcie piszesz
wprost: „cztery czerwienie Bloku 1 i niestabilność Bloku 3 są przedmiotem dyżuru 349;
odnotowane jako granica dowodu". Jeżeli w trakcie Twojego przebiegu któryś z tych testów
zachowa się inaczej niż u 335 — **to jest cenna obserwacja i wpisujesz ją do raportu z pełną
nazwą przypadku**, nadal bez naprawy.

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
| 1 | stan 16 wierszy `G19` | `16 × NOT_PROVEN / OWNER_RETEST_PENDING` | komenda (1) z `§0.3` | TAK — czyta kolumnę statusu wszystkich 16 plików |
| 2 | dystans markera dowodu od `HEAD` | `615` commitów | komenda (2) z `§0.3` | TAK — **335 miał 543, bo mierzył na `1c4b5a5635`** |
| 3 | mianownik dryfu, razem | `106` plików | komenda (3) z `§0.3` | TAK — obejmuje dokładnie ścieżki, które G19 mierzy z definicji |
| 4 | mianownik dryfu, bez testów | `90` plików | komenda (3) z `§0.3` | TAK — filtr `__tests__|.test.|.spec.` |
| 5 | rozbicie per katalog | `1 / 7 / 2 / 2 / 91 / 2` | komenda (3) z `§0.3` | TAK — **suma ma się zgodzić ze 106, sprawdź to jawnie** |
| 6 | kubełki dyżuru 335 | `A=7, B=0, C=9` | komenda (5) z `§0.3` | TAK — czyta gotowy plik, nie liczy od nowa |
| 7 | Blok 1 na dzisiejszym markerze | 335 miał `131/127/4` | przebieg wariantem (C), `R3` | TAK — **podaj `numTotalTests`, nie tylko `numFailedTests`** |
| 8 | Blok 2 na dzisiejszym markerze | 335 miał `218/218/0` | przebieg jednostkowy, `R3` | TAK — **i wpisz wprost, że nie dowodzi realnego PG** |
| 9 | Blok 3 na dzisiejszym markerze | 335 miał `18/18` po naprawie payloadu | przebieg wariantem (B) na `cx348`, `R3` | TAK — **z roota daje 0 wykonanych i `exit 0`, co jest błędem komendy** |
| 10 | para izolacyjna `day307` | GREEN → mutacja RED → GREEN | `R3`, mutacja `TaskController.getUserWorkload` | TAK — **mutacja celuje w `AND organization_id = ?`, czyli w ZABEZPIECZENIE** |
| 11 | liczba podniesionych wierszy | — | `R5` | TAK — **ma się zgadzać z liczbą dowodów, jeden do jednego** |
| 12 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY348_G19_PRZEMIAR_REPORT.md` ·
`evidence/g19/day348/**` (nowy katalog).

**Zapisujesz WARUNKOWO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` **wyłącznie wiersz
`G19`, wyłącznie razem z dowodem w tym samym commicie** ·
`G19_INWENTARZ_OBOWIAZKOW_20260903.md` (sekcja dopisana) ·
`REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja) ·
naprawa PAYLOADU przestarzałego testu z Bloku 3 (tylko z dowodem mutacyjnym, że nadal broni
tego, co bronił) · nowe pliki testowe w `tests/` (`git add -f`, **nigdy pod `src/`**).

**JAWNIE NIE ZAPISZESZ:** `src/components/**` (produkt), `public/locales/**`,
`server/src/middleware/**`, `server/src/routes/**` i `server/src/controllers/**` trwale
(mutacje są cofane), `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`,
`vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`,
`server/migrations/**`, `evidence/g19/day335-*`, `evidence/g19/blok*.json`, `evidence/g15/**`,
`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, trzy pliki czterech czerwieni Bloku 1,
wiersze `G00`–`G18` i `G20`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day348-g19-przemiar
git diff --name-only --cached | tee /private/tmp/cx-day348-g19-przemiar-artefakty/staged.txt
bash -c "grep -iE '^src/components/|^public/locales/|^server/src/middleware/|^server/src/controllers/|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|evidence/g19/day335|evidence/g19/blok|evidence/g15/|PRZELOT_WLASCICIELA|filterableTable\.r04-2a|standardPreview\.r03|tablePreviewGeometry\.r03-2' /private/tmp/cx-day348-g19-przemiar-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — DWIE TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Wiersz macierzy zmienia stan WYŁĄCZNIE z dowodem załączonym w TYM SAMYM commicie.**
Commit dotykający `MODULE_ACCEPTANCE.md` musi w tym samym `git show --stat` zawierać plik
dowodowy (`evidence/g19/day348/*`) albo plik testu, na który wiersz się powołuje.
**Wpis bez dowodu jest podstawą odrzucenia CAŁEGO dyżuru** — nie tej jednej pozycji, całego
dyżuru. **Liczba podniesionych wierszy ma się zgadzać z liczbą dowodów, jeden do jednego** —
jeden dowód nie podnosi trzech wierszy, chyba że pokazujesz, że mianownik tych trzech wierszy
jest identyczny (dyżur 335 udowodnił to dla czterech późnych kotwic — `cmp` exit 0 — więc
takie uzasadnienie jest możliwe, ale musi być pokazane, nie założone).

**(2) Odrzuconego wariantu nie wprowadzasz pod inną nazwą.** `PASS`,
`TECHNICAL_REGRESSION_PASS` i każdy synonim znaczący „technicznie sprawdzone, przelot
właściciela pominięty" są zakazane. Uważasz, że wiersz zasługuje na mocniejszy stan →
**PROPOZYCJA w raporcie, z gotowym tekstem wiersza**, decyzja należy do odbiorcy.

**Wymagany dowód:** dwa zdania w raporcie, że przeczytałeś obie zasady, plus `git show --stat`
każdego commita dotykającego macierzy. **Bez commita — to jest warunek, nie pozycja.**

## R1 — PRZEMIAR DRYFU NA BIEŻĄCYM MARKERZE, IMIENNIE (rdzeń)

1. Uruchom komendy (2) i (3) z `§0.3`. Do raportu idą: liczba commitów, liczba plików razem,
   bez testów, i rozbicie per katalog. **Nie przepisujesz liczb dyżuru 335 — liczysz swoje.**
2. **Wypisz listę z NAZWY** do `evidence/g19/day348/dryf-<marker>.md`, pogrupowaną po
   katalogach. „Dziewięćdziesiąt jeden plików tras" bez nazw nie jest wynikiem.
3. **Zrób różnicę wobec listy dyżuru 335** (`evidence/g19/day335-dryf.md`): **które pliki
   doszły**, a które ewentualnie zniknęły. To jest jedyny sposób, żeby pokazać tempo wzrostu
   mianownika — i to jest dowód pod pytanie z `R6`.
4. **Odpowiedz liczbą na pytanie: ile z tych plików ma JAKIKOLWIEK test?** Dyżur 335
   policzył „89 bez testów"; policz to sam i pokaż komendę.

**Wymagany dowód:** liczby z `§0.3` · plik `dryf-<marker>.md` z imienną listą · różnica wobec
listy 335 z nazwami plików, które doszły · liczba plików bez pokrycia z komendą.
**Commit po `R1`.**

## R2 — REWIZJA KUBEŁKÓW `A`/`B`/`C` NA DZISIEJSZYM STANIE (rdzeń)

Dyżur 335 przypisał kubełki na markerze `1c4b5a5635`. **Sprawdzasz, czy nadal są prawdziwe —
i to jest praca, nie formalność.**

Trzy kubełki, dosłownie:

- **`A` — dowód maszynowy:** lukę da się zamknąć testem, który sam uruchomisz, z dowodem
  mutacyjnym. 335 przypisał tu **7 modułów**: `01`, `04`, `05`, `06`, `08`, `11`, `13`.
- **`B` — brak realnego łańcucha:** 335 dał tu **0** i uzasadnił, że instrukcja przydziela
  lokalny RealPG i wymaga realnego `ApiGateway`/JWT. **Sprawdź, czy Twoje warunki są takie
  same** — jeżeli nie, kubełek `B` może być niepusty i to jest znalezisko.
- **`C` — wymaga właściciela:** renderowanie na realnym rekordzie, język PL/EN, treść.
  335 dał tu **9 modułów**.

Dla **każdego z 16 wierszy** produkujesz: kubełek · **imienne uzasadnienie w JEDNYM zdaniu** ·
czy kubełek zmienił się wobec 335 i dlaczego.

★ **Nie zakładaj, że podział 335 jest poprawny. Obalenie go jest sukcesem dyżuru** — na
przykład jeżeli któryś moduł `C` da się jednak domknąć maszynowo, albo któryś moduł `A` ma
lukę, której nie da się zamknąć testem.

**Wymagany dowód:** tabela 16 wierszy z kubełkiem, uzasadnieniem i kolumną „zmiana wobec 335".
**Commit po `R2`.**

## R3 — WYKONANIE CAŁEGO KUBEŁKA MASZYNOWEGO Z MUTACJĄ (rdzeń)

**To jest pozycja, w której dyżur produkuje dowód, a nie tylko go opisuje.**

1. **Postaw kontener** `cx-day348-pg` na porcie `6395`, baza `cx348`, i przepuść migracje
   zgodnie z `§0.2c` (A) — **dwa przebiegi**, drugi bezbłędny i bez zmian (idempotencja).
   `pgvector/pgvector:pg16`; `postgres:15` **nie przechodzi migracji**.
2. **Odtwórz trzy bloki na dzisiejszym markerze** — Blok 1 wariantem (C), Blok 2
   jednostkowo, Blok 3 wariantem (B) z cwd `server/`. `--retry=0`, `--reporter=json`.
   **Podaj `numTotalTests` dla każdego.** Przebieg z zerem wykonanych przypadków kończy się
   `exit 0` i **nie jest pomiarem** — to zdarzyło się dyżurowi 335 przy pierwszej próbie
   Bloku 3 z roota, i słusznie zostało odrzucone jako błąd komendy.
3. **Odtwórz parę izolacyjną `day307` na swojej bazie**: seeder jest fail-closed na
   historyczne `6314/cx307` — robisz **kopię poza repo**, zmieniasz wyłącznie guard na swoje
   `6395/cx348`, **źródła w repo NIE dotykasz**. Wynik: obcy `404`, właściciel `200` na
   **tym samym `userId`** — **para, nie symetryczna odmowa**.
4. **Dowód mutacyjny celujący w ZABEZPIECZENIE** (`Z32`): usuń `AND organization_id = ?`
   z prechecku w `TaskController.getUserWorkload` (`server/src/controllers/TaskController.ts`,
   okolice wiersza 2692), po kopii przez `cp` do `SCRATCH` → test ma **zaczerwienić się**
   (`expected 200 to be 404`); przywróć przez `cp` (nigdy `git stash`, `Z27`) → **zzielenieć**;
   `git diff -- server/src/controllers/TaskController.ts` po przywróceniu **pusty**.
   Obie komendy i oba wyniki dosłownie w raporcie.
5. **Wykonaj RESZTĘ kubełka `A`** — moduły `04`, `05`, `06`, `11`, `13`. Dla każdego:
   który konkretny test/kontrakt zamyka lukę · uruchomienie z `numTotalTests` · **dowód
   mutacyjny celujący w zabezpieczenie, nie w mechanizm**. Jeżeli dla któregoś modułu takiego
   testu nie ma — **to jest wynik**: piszesz „kubełek `A` był przypisany błędnie, brakuje
   kontraktu X" i produkujesz **czerwony kontrakt testowy** (`it('KONTRAKT DLA DYŻURU 348 — …')`
   z nagłówkiem `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`) w `tests/`, z `git add -f`.
6. **Cztery czerwienie Bloku 1 i niestabilność `day274`/`day275`/`day276`** — uruchamiasz,
   zapisujesz wynik z pełnymi nazwami, **nie naprawiasz**. Teren dyżuru 349.
7. **Sprzątanie:** `docker rm -fv cx-day348-pg` (bez `-v` wolumen zostaje), `df -h /` przed
   i po.

**Wymagany dowód:** wyniki trzech bloków z `numTotalTests` · para izolacyjna z dwoma kodami
odpowiedzi · dowód mutacyjny w obie strony z pustym `git diff` · dla każdego z 5 pozostałych
modułów kubełka `A` albo wykonany dowód, albo czerwony kontrakt z briefem · wynik obu
przebiegów migracji · `df -h /` przed i po. **Commit po `R3`.**

## R4 — ORZECZENIE PER WIERSZ: CO DOKŁADNIE BRAKUJE

Tabela **16 wierszy**. Każdy z: modułem · kubełkiem po rewizji `R2` · **co konkretnie zostało
udowodnione w `R3`** (z nazwą przypadku i ścieżką artefaktu) · **czego dokładnie brakuje,
żeby ten wiersz się podniósł** · **kto to zrobi** (maszyna / właściciel / osobne zlecenie).

★★ **Zdanie „przelot właściciela pozostaje wymagany", powtórzone 16 razy, NIE JEST
orzeczeniem.** Wymagam konkretu per wiersz — na przykład: *„brakuje pary izolacyjnej dla
istniejącego obiektu `X` na trasie `Y`; test do napisania, mutacja w `plik:linia`"* albo
*„brakuje wyłącznie oczu właściciela na realnym rekordzie `Z` — wszystko maszynowe zamknięte,
dowód w `evidence/g19/day348/…`"*.

**Wymagany dowód:** tabela 16 wierszy z czterema kolumnami · zbiorcze liczby: ile wierszy jest
domkniętych maszynowo, ile czeka wyłącznie na właściciela, ile ma realną lukę.
**Commit po `R4`.**

## R5 — PODNIESIENIE WIERSZY, KTÓRE MAJĄ DOWÓD

1. Dla **każdego** wiersza, który `R4` uznał za domknięty w zakresie maszynowym — przygotuj
   **gotowy tekst wiersza**, który **nazywa zakres dowodu i jego granicę** i **nie jest**
   `PASS` ani synonimem odrzuconego wariantu.
2. **Wpis i dowód idą JEDNYM commitem** (`R0`). W `git show --stat` tego commita musi być
   plik dowodowy albo plik testu.
3. **Policz i zapisz:** ile wierszy podniosłeś, ile dowodów załączyłeś. **Te dwie liczby mają
   być równe** — albo masz wyjaśnić, dlaczego jeden dowód uzasadnia więcej niż jeden wiersz
   (dopuszczalne wyłącznie z pokazaniem, że mianownik tych wierszy jest identyczny).
4. **Jeżeli nie podnosisz żadnego wiersza — to też jest wynik**, i wtedy raport musi zawierać
   zdanie: *„zero wierszy podniesionych, bo …"* z konkretnym powodem per kubełek. Dyżur 335
   tak zrobił i miał rację; powtórzenie tego z LEPSZYM uzasadnieniem i świeższym pomiarem
   jest pełnowartościowe.

**Wymagany dowód:** `git show --stat` każdego commita dotykającego macierzy · tabela
„wiersz → dowód" · dwie zgodne liczby. **Commit po `R5`.**

## R6 — RAPORT I PYTANIE ROZSTRZYGALNE DO WŁAŚCICIELA

Raport zawiera: przemiar dryfu z `R1` (z różnicą wobec 335) · zrewidowaną tabelę kubełków
z `R2` · wyniki trzech bloków i całego kubełka maszynowego z `R3`, z `numTotalTests` ·
tabelę 16 wierszy z `R4` · listę podniesionych wierszy z dowodami z `R5` · listę rozbieżności
wobec liczb tej instrukcji · **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** · obowiązkowy
akapit `§0.2e` dla każdego uruchomionego pakietu · deklarację `Z30`.

★★ **Osobna, obowiązkowa sekcja: „PYTANIE O KOTWICĘ POMIARU G19".** To jest główny produkt
myślowy tego dyżuru. Bramka mierzy „obowiązki regresji po późniejszych zmianach", a jej
mianownik urósł ze **104 do 106** plików w jeden dzień, przy dystansie, który urósł z **543
do 615** commitów. Postaw pytanie **rozstrzygalne („tak"/„nie")**, na przykład:

> *„Czy G19 ma być mierzona wobec markera odbioru modułu (wiersz `G18`), czy wobec bieżącego
> `HEAD`? Jeżeli wobec `HEAD` — bramka nie domknie się, dopóki linia się rusza, i wtedy
> potrzebujemy zamrożenia daty pomiaru."*

**Nie rozstrzygasz tego sam i nie zmieniasz definicji bramki po cichu.** Sekcja jest
obowiązkowa; jeżeli uważasz, że kotwica jest postawiona dobrze — piszesz to wprost
z uzasadnieniem.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sprawdź ją komendą
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle pisze inny autor.

**Commit po `R6`.**

## Próg odbioru

**Każdy z 16 wierszy `G19` ma przypisany kubełek (dowód maszynowy / wymaga właściciela /
realna luka); kubełek maszynowy jest WYKONANY z dowodem mutacyjnym celującym w zabezpieczenie;
a liczba podniesionych wierszy zgadza się z liczbą załączonych dowodów.**

Odbiorca odrzuci dyżur, w którym wiersz zmienił stan bez dowodu w tym samym commicie;
w którym pojawił się `PASS`, `TECHNICAL_REGRESSION_PASS` albo jego synonim; w którym izolacja
została „udowodniona" symetryczną odmową; albo w którym przepisano liczby dyżuru 335 zamiast
zmierzyć własne.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „dryf przemierzony na bieżącym
markerze (N commitów, M plików), kubełki zrewidowane, kubełek maszynowy wykonany dla k z 7
modułów, zero wierszy podniesionych, bo …" — **jest pełnowartościowym wynikiem, nawet jeśli
ani jeden wiersz nie zmienił stanu.**

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Podnieś wiersze" vs „zakaz `PASS`/`TECHNICAL_REGRESSION_PASS`" | `R0` (2) i `R5` punkt 1: podnosisz do stanu, który **nazywa zakres dowodu i granicę**; mocniejszy stan jest PROPOZYCJĄ dla odbiorcy |
| „Wykonaj kubełek maszynowy" vs „nie naprawiaj produktu" | `R3` punkty 4 i 5: mutacja jest **tymczasowa i cofana przez `cp`**, `git diff` po cofnięciu pusty; brak testu = **czerwony kontrakt**, nie naprawa produktu |
| „Uruchom cztery czerwienie Bloku 1" vs „to teren dyżuru 349" | Akapit pod tabelą licencji i `R3` punkt 6: **uruchamiasz i zapisujesz, nie naprawiasz**; obserwacja odmiennego zachowania jest cenna i idzie do raportu |
| „Seeder 307 jest fail-closed na cudze porty" vs `Z7` (Twoje porty wyłączne) | Tabela licencji i `R3` punkt 3: obejście przez **kopię POZA repo**, wyłącznie guard, źródło w repo nietknięte — dokładnie tak, jak zrobił dyżur 335 |
| „Nie przepisuj cudzych liczb" vs „instrukcja podaje liczby 335" | `R1` punkt 1 i „Zmierz moje liczby sam": liczby 335 są podane **jako punkt odniesienia do RÓŻNICY**, nie do przepisania; rozbieżność jest oczekiwana |
| „Jeden dowód = jeden wiersz" vs „cztery kotwice mają identyczny mianownik" | `R0` (1) i `R5` punkt 3: jeden dowód może uzasadnić więcej wierszy **tylko z pokazaniem** identyczności mianownika (`cmp` exit 0), nigdy z założenia |
| „`Z12` middleware nietykalne" vs „mutacja dowodowa" | `R3` punkt 4: mutacja trafia w `server/src/controllers/TaskController.ts`, **nie w middleware**; middleware pozostaje nietykalne w obie strony |
| „Zmierz Blok 2" vs „Blok 2 nie dowodzi realnego PG" | `SCIEZKI` i tabela mianowników wiersz 8: mierzysz **i wpisujesz granicę wprost** — pomiar jednostkowy jest wynikiem, o ile nie udaje dowodu zapisu |
| „Bramka ma się domknąć" vs „mianownik rośnie" | `R6`: to jest **pytanie do właściciela**, nie decyzja wykonawcy; zmiana definicji bramki po cichu jest zawężeniem kryterium |
| „Zero nowych dokumentów" (`Z13`) vs „dopisek do inwentarza i pliki dowodowe" | Tabela licencji: inwentarz i rejestr znalezisk to **AKTUALIZACJE istniejących**, `evidence/g19/day348/` to **ślad**, nie dokument rejestrowy; nowy dokument rejestrowy jest dokładnie jeden — raport `R6` |
| „Cofaj mutacje" vs `Z27` (zakaz `git stash`) | `R3` punkt 4: kopia przez `cp` do `SCRATCH`; `git diff` po cofnięciu ma być pusty |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — sześć plików `evidence/g19/day335-*` i `mianownik.md`, inwentarz G19, `day307-crossorg-read-flight.pg.test.ts`, `TaskController.ts`, trzy pliki czerwieni Bloku 1 sprawdzone; `evidence/g19/day348/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1-6 i 12 zmierzone przy wydaniu na markerze; wiersze 7-9 podane jako liczby dyżuru 335 z jawną etykietą źródła |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — walidator · montaż · kontroler · serwis/repozytorium · middleware · UI mianownika · testy istniejące · czerwienie Bloku 1 · seeder 307 · infrastruktura testów · dowody · dowody 335 · inwentarz · macierz · rejestr · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1`, `R2` i `R4` nie dotykają kodu; `R3` uruchamia istniejące pakiety i mutuje wyłącznie tymczasowo; `R5` dotyka wyłącznie macierzy |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6395/5535 wolne (`lsof` przy wydaniu), brak kontenera `cx-day348-pg`, brak gałęzi `codex/day348-*` i worktree; 347/349/350 mają rozłączne porty i pliki; paczka 343-346 ma zarezerwowany przedział 6390-6393/5530-5533 i rozłączny temat; kolizja z 349 rozstrzygnięta imiennie w treści |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: bramka nie domyka się z definicji, powtórzenie 335 nie jest wynikiem, symetryczna odmowa udaje izolację, atrapa bazy, `NODE_ENV=test` bez `RUN_DB_TESTS`, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
