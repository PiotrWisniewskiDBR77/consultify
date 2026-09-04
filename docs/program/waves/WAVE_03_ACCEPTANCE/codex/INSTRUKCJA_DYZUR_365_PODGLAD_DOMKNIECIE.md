# INSTRUKCJA DYŻURU nr 365 — Codex — „★★★ PODGLĄD — DOMKNIĘCIE PO 352, Z JEDNĄ RZECZĄ BLOKUJĄCĄ NA POCZĄTKU. Dyżur 352 (scalony) wyprodukował pary PRZED/PO ekranów podglądu po tym, jak zmiana z 349 sprawiła, że sekcja „Brak powiązań” **renderuje się teraz zawsze**, w każdym podglądzie wszystkich 16 modułów (`StandardPreview.tsx:362`, commit `58d391d65b`). Do domknięcia są TRZY rzeczy. ★★★ **BLOKUJĄCA, pierwsza w kolejności:** dyżur 352 wprowadził do `scripts/dev/grafika-zrzuty.mjs` **trzy** zmiany, mając licencję na **jedną** opcję opt-in przy zachowaniu historycznych wywołań bit w bit — obok poprawnej opcji `--mierz-wysokosc` zmienił **zachowanie re-kliku po rozwinięciu sekcji** i **licznik bramki `zlePary`**; obie zmieniają wynik i kod wyjścia **pomiarów innych dyżurów** (m.in. przeglądu G06 16 modułów), a raport nie wspomniał o żadnej. Obie są merytorycznie poprawne — ale muszą być **jawnie zadeklarowane, uzasadnione i przyjęte osobno albo cofnięte**. ★★ Druga: `finance-hub&tab=analysis` pokazuje **DWIE identyczne karty „POWIĄZANIA / Brak powiązań” jedna pod drugą** — odbiorca potwierdził to własnymi oczami na kadrze; to realny defekt, nie kwestia kadru, i ma dwa adresy: `StandardPreview.tsx:362` oraz `FinancePreviewPanel.tsx:1280`. ★ Trzecia: **tylko 12 z 16 kontekstów ma różne sumy kontrolne** — 3 pary identyczne, 1 bez „PO”; dorobić brakujące. ★ Pytania „czy pusta karta ma się w ogóle pokazywać” **nie rozstrzygasz sam** — dyżur 352 słusznie postawił je właścicielowi i pokazał sprzeczność w SSOT; masz je utrzymać i wyostrzyć"

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
> **wyłącznie** `/private/tmp/cx-day365-podglad-domkniecie`.

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
Zakres: **PRZEKROJOWE — powłoka podglądu `src/components/standard/StandardPreview.tsx` we wszystkich 16 modułach, jej wołacze przekazujące DZIECI (16 miejsc, w tym `FinanceHub.tsx:3272`), oraz **kanoniczne narzędzie zrzutów** `scripts/dev/grafika-zrzuty.mjs` wraz z jego historycznymi wołaczami. Przedmiotem pracy są trzy domknięcia po dyżurze 352: **(1) trzy niezadeklarowane zmiany w narzędziu pomiarowym** — pozycja BLOKUJĄCA, robiona PIERWSZA; **(2) dublet karty „Brak powiązań” w Finansach** — realna naprawa; **(3) brakujące pary PRZED/PO** — dorobienie dowodu. Pytanie o sens pustej karty **pozostaje otwarte dla właściciela**. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, i plik postępu `/private/tmp/cx-day365-postep.md` (POZA repo)**.
Trasy front: `★★ SEDNO. `src/components/standard/StandardPreview.tsx` — blok 5 „Relations” w wierszach **353-368** (bezwarunkowe `<PreviewRelations items={relations ?? []} …/>` w linii **362**, wprowadzone commitem `58d391d65b` dyżuru 349). Dublet w Finansach: `src/components/Economics/FinancePreviewPanel.tsx:1280` renderuje **własny** `PreviewRelations` wewnątrz `renderPreviewFooter`, a `src/components/Economics/FinanceHub.tsx:3279` przekazuje ten footer jako **dzieci** do `StandardPreview` (wołacz w linii 3272). ★ RODZINA: **16 wołaczy `<StandardPreview>` przekazuje dzieci** — i tylko one mogą dublować bloki stopki; sąsiednie kształty do sprawdzenia w tym samym pliku Finansów to `PreviewAIHintStrip` (`FinancePreviewPanel.tsx:1273`) i `PreviewActionBar` (`:1298`)`. Trasy tył: `Ten dyżur **nie dotyka serwera**. Nie stawiasz kontenera i nie uruchamiasz migracji, chyba że sam udowodnisz, że jest to konieczne — a wtedy piszesz w raporcie, po co. Zasoby `6436`/`cx-day365-pg`/`cx365` są zarezerwowane wyłącznie po to, żeby żaden inny dyżur ich nie wziął. `server/**` pozostaje `TYLKO ODCZYT` bez wyjątku`.

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
WT=/private/tmp/cx-day365-podglad-domkniecie
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
git -C "$VAULT" worktree add "$WT" -b codex/day365-podglad-domkniecie-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day365-podglad-domkniecie/config.worktree"
cat "$VAULT/worktrees/cx-day365-podglad-domkniecie/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day365-podglad-domkniecie-scratch
mkdir -p /private/tmp/cx-day365-podglad-domkniecie-artefakty

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
git -C "$WT" push github-backup codex/day365-podglad-domkniecie-20260904
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

# (1) ★★★ TEZA BLOKUJACA: dyzur 352 wprowadzil do harnessu TRZY zmiany, a raport wymienil JEDNA
git show 4fcd20808e -- scripts/dev/grafika-zrzuty.mjs | head -80
#   moje liczby: trzy zmiany zachowania w jednym commicie:
#   (a) opcja `--mierz-wysokosc` — opt-in, zgodna z licencja;
#   (b) warunek `podgladNadalOtwarty` przed re-klikiem po rozwinieciu sekcji + NOWA petla po KLIK
#       — zmienia zachowanie ISTNIEJACEJ opcji `--klik-po-rozwinieciu`, NIE jest opt-in;
#   (c) licznik `zlePary` liczy tylko pary majace pole `ok` (Object.hasOwn)
#       — zmienia MIANOWNIK i KOD WYJSCIA pomiarow innych dyzurow.
#   ★ Raport 352 nie wspomnial o (b) ani (c).

# (2) TEZA: (b) i (c) dotykaja HISTORYCZNYCH wolaczy, nie tylko dyzuru 352
bash -c "grep -rln 'klik-po-rozwinieciu' scripts/"
bash -c "grep -rln 'wynik-selektor' scripts/ docs/program/grafika/"
#   moje liczby: `--klik-po-rozwinieciu` wola PIEC skryptow:
#   r1-slepa-plama-uruchom.mjs · r1-slepa-plama-agreguj.mjs ·
#   g06-macierz-uruchom.mjs · g06-macierz-rejestr.mjs · r4-dowod-uruchom.mjs
#   (g06 = przeglad 16 modulow, czyli najszerszy pomiar w programie).
#   `--wynik-selektor` jest udokumentowany w 00_ZASADY_PRACY.md, RAPORT_195_PRZELOT_A.md,
#   PANELE_WYCENY_ZRZUTY_20260901.md, PRZEGLAD_BEZPIECZNIKOW_20260901.md.

# (3) ★★ TEZA: sumy kontrolne par PRZED/PO — 12 roznych, 3 identyczne, 1 bez PO
for d in evidence/podglad-relations-20260904/*/; do
  for f in "$d"*__PRZED__pl__1440__light.png; do
    [ -e "$f" ] || continue
    b=$(basename "$f" __PRZED__pl__1440__light.png); po="$d$b"__PO__pl__1440__light.png
    if [ -e "$po" ]; then
      [ "$(shasum -a 256 "$f" | cut -d' ' -f1)" = "$(shasum -a 256 "$po" | cut -d' ' -f1)" ] \
        && echo "IDENTYCZNE  $d$b" || echo "rozne       $d$b"
    else echo "BRAK_PO     $d$b"; fi
  done
done
find evidence/podglad-relations-20260904 -name '*.png' | wc -l
#   moje liczby: 16 kontekstow — 12 roznych, 3 identyczne
#   (core/finance-hub, core/results-vnext-registry-shell, core/results-vnext-attention),
#   1 bez PO (audyt-findings). PNG razem: 62 (16x4 minus 2 brakujace).
#   ★ ZLECENIE MOWILO O 20 KONTEKSTACH. KATALOGOW JEST 16. Zmierz sam.

# (4) ★★ TEZA: finance-hub&tab=analysis ma DWA puste bloki, core/finance-hub ma JEDEN
node -e "for(const p of ['finance-analysis','core']){const r=require('./evidence/podglad-relations-20260904/'+p+'/_wynik-kontrola__PO.json');console.log(p, JSON.stringify(r).slice(0,220));}" 2>/dev/null \
  || bash -c "grep -o '\"empty\"[^,]*' evidence/podglad-relations-20260904/*/_wynik-kontrola__PO.json | head"
#   moje liczby (z manifestu raportu 352): core/finance-hub PO = 1 pusty blok;
#   finance-analysis/finance-hub PO = 2 puste bloki, wysokosc 107 px kazdy (razem 214 px)

# (5) ★★★ TEZA: DUBLET MA DWA ADRESY — jeden w powloce, drugi w stopce Finansow
sed -n '360,368p' src/components/standard/StandardPreview.tsx
bash -c "grep -n 'PreviewRelations' src/components/Economics/FinancePreviewPanel.tsx"
bash -c "grep -n 'renderPreviewBody\|renderPreviewFooter\|useFinancePreview' src/components/Economics/FinanceHub.tsx | head"
#   moje liczby: `StandardPreview.tsx:362` renderuje `PreviewRelations` BEZWARUNKOWO (od 349,
#   commit 58d391d65b); `FinancePreviewPanel.tsx:1280` renderuje WLASNY `PreviewRelations`
#   w `renderPreviewFooter`, ktory `FinanceHub.tsx:3279` przekazuje jako DZIECI. Stad dwie karty.

# (6) ★★ TEZA: to jest RODZINA, a grep per plik jej NIE ZNAJDUJE
node -e "
const fs=require('fs'),path=require('path');
function walk(d,o=[]){for(const n of fs.readdirSync(d)){const p=path.join(d,n),s=fs.statSync(p);if(s.isDirectory())walk(p,o);else if(/\.tsx\$/.test(n))o.push(p);}return o;}
let u=0,dz=0,rows=[];
for(const f of walk('src').concat(walk('dev-render'))){const t=fs.readFileSync(f,'utf8');const re=/<StandardPreview(\s|>)/g;let m;
 while((m=re.exec(t))){u++;let i=re.lastIndex,d=0,self=false,closed=false;
  for(;i<t.length;i++){const c=t[i];if(c==='{')d++;else if(c==='}')d--;else if(c==='>'&&d===0){self=t[i-1]==='/';closed=true;break;}}
  if(closed&&!self){dz++;rows.push(f+':'+t.slice(0,m.index).split('\n').length);}}}
console.log('uzyc tagu:',u,'| przekazujacych DZIECI:',dz);rows.forEach(r=>console.log('  ',r));"
#   moje liczby: 55 uzyc w 39 plikach `src/` bez testow (352 podal 53/39 po usunieciu
#   komentarzy), 7 w 6 plikach `dev-render/`; ★ 16 wolaczy przekazuje DZIECI — i to
#   one moga dublowac bloki stopki. `FinanceHub.tsx:3272` jest jednym z nich.

# (7) TEZA: SSOT jest wewnetrznie sprzeczny co do pustej karty
sed -n '70p;132p' docs/ui-standards/TRIADA_KANON.md
sed -n '337p' docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md | cut -c1-200
#   moje liczby: TRIADA_KANON:70 i :132 wymagaja bloku ZAWSZE („Relations albo »No relations«”);
#   TABLE_AND_PREVIEW_CANON:337 mowi „Relations (blok 5 TRIADY, JESLI SA)”.
#   ★ TEGO NIE ROZSTRZYGASZ SAM — patrz R4.

# (8) TEZA: liscie slownikow, bramki kanonu i zasoby
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
df -h /
lsof -nP -iTCP:6436 -sTCP:LISTEN; lsof -nP -iTCP:5576 -sTCP:LISTEN
#   moje liczby: pl 35199, en 33066; focus=0, list=0, artefakt=0, reach=0;
#   przy wydaniu 35 GB wolnego, oba porty puste
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day365-podglad-domkniecie-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6436`. Twój JEDYNY port harnessu to `5576`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day365-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki 04.09 — nie dotykasz: 363 (6434/5574), 364 (6435/5575), 366 (6437/5577). Równoległa paczka 359-362 ma zarezerwowany przedział 6430-6433 i 5570-5573 — również nie dotykasz. Starsze rodzeństwo 04.09: 347-355 używa 6394-6397 i 6410-6414 oraz 5534-5537 i 5550-5554 (dyżur 352 pracował na 6411/5551). Twoje własne wyłącznie: baza 6436, harness 5576. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK NOWYCH FLAG. ★★ I to jest istotna cecha tego dyżuru: **pusta karta „Brak powiązań” nie jest za żadną flagą** — od commitu `58d391d65b` renderuje się bezwarunkowo w każdym podglądzie wszystkich 16 modułów. Każda Twoja zmiana w `StandardPreview.tsx` jest widoczna natychmiast, wszędzie. Dlatego naprawa dubletu ma iść w **najwęższe możliwe miejsce**, a każda zmiana w powłoce wymaga dowodu wizualnego z więcej niż jednego modułu`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/dev/reachability-from-root.mjs`, `scripts/check-dev-render-parytet.mjs`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `public/locales/**`. Wszystkie **NIETYKALNE DO ZAPISU**. ★ WYJĄTEK JAWNY: `scripts/dev/grafika-zrzuty.mjs` **jest przedmiotem pracy w `R1`** — ale wyłącznie w trybie „zadeklaruj, udowodnij równoważność albo cofnij”, nigdy w trybie „dopisz jeszcze jedną zmianę”`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY365_PODGLAD_DOMKNIECIE_REPORT.md`. Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — sekcje doszły dziś do `Z`, więc następne idą `AA`, `AB`, … (literę sprawdzasz komendą tuż przed commitem) — oraz **dopisanie** sekcji „Zmiany w kanonicznym narzędziu zrzutów, dyżury 352 i 365” do `docs/program/grafika/00_ZASADY_PRACY.md` (**dopisanie, nigdy nadpisanie**), plus nowe pliki dowodowe pod `evidence/podglad-relations-20260904/` (katalog ISTNIEJE — **dokładasz do niego, nie nadpisujesz istniejących PNG**) i `evidence/podglad-domkniecie-20260904/` (NIE ISTNIEJE — tworzysz). ★★★ **MACIERZ ODBIORU JEST NIETYKALNA W TYM DYŻURZE** — żaden wiersz, żaden moduł. Plik postępu `/private/tmp/cx-day365-postep.md` żyje POZA repo. Nowe pliki w `tests/` wymagają `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day365-podglad-domkniecie-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day365-podglad-domkniecie-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ ROZSTRZYGANIA PYTANIA O PUSTĄ KARTĘ.** Dyżur 352 **nie rozstrzygnął po cichu**, czy pusta karta „Brak powiązań” ma się w ogóle pokazywać — postawił pytanie właścicielowi i pokazał sprzeczność między dwoma dokumentami kanonu (`TRIADA_KANON.md:70` i `:132` kontra `TABLE_AND_PREVIEW_CANON.md:337`). **To było poprawne zachowanie i Ty je powtarzasz.** Nie usuwasz bezwarunkowego renderu w `StandardPreview.tsx`, nie dodajesz warunku „tylko gdy są dane”, nie zmieniasz żadnego z dwóch dokumentów kanonu. Naprawiasz **dublet** — dwie karty zamiast jednej — i to jest coś zupełnie innego niż „jedna karta zamiast zera”. ★★★ **ZAKAZ DOPISANIA CZWARTEJ ZMIANY DO HARNESSU.** `R1` jest o **rozliczeniu trzech istniejących**, nie o dodaniu kolejnych. Jeżeli do dorobienia par potrzebujesz nowej opcji — zatrzymujesz się i piszesz o tym; jedna opcja opt-in jest dopuszczalna **tylko** z dowodem, że wszystkie historyczne wywołania dają wynik i kod wyjścia bit w bit taki sam. ★★ **ZAKAZ WŁASNEGO SKRYPTU ZRZUCAJĄCEGO OBOK KANONICZNEGO.** Doraźny skrypt dał już raz parę identycznych obrazów i zameldował sukces. Brakującą funkcję dokłada się narzędziu, opt-in, z parametrami zapisanymi na trwałe. ★★ **ZAKAZ ZALICZENIA PARY BAJTOWO IDENTYCZNEJ.** Para o tej samej sumie kontrolnej to **ZERO dowodu** — zapisujesz to jako wynik negatywny z wyjaśnieniem, nigdy jako zaliczoną parę. Para light/dark o zbliżonej średniej jasności to ten sam obraz pod dwiema nazwami. ★ **ZAKAZ `.skip`, `.todo`, `--retry` innego niż `0`, poszerzania `exclude`** (`Z35`). **ZAKAZ nadpisywania istniejących PNG dyżuru 352** — one są bazą porównania | Bo narzędzie pomiarowe zmieniło się bez zapowiedzi, a na jego wynikach stoi przegląd 16 modułów i kilkanaście dyżurów. Zmiana licznika `zlePary` przesuwa **kod wyjścia** — czyli bramkę — a zmiana re-kliku przesuwa **treść kadru**. Obie mogą być słuszne; żadna nie może być cicha. Do tego jeden ekran pokazuje dziś użytkownikowi dwie identyczne puste karty jedna pod drugą, a jedna czwarta zamówionych par dowodowych nie jest dowodem, bo pliki PRZED i PO są tym samym plikiem. **Przyrząd, który kłamie, i dowód, który jest kopią — to dwie postacie tej samej straty czasu** |

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
cd /private/tmp/cx-day365-podglad-domkniecie

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day365-pg psql -U postgres -d cx365 \
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
cd /private/tmp/cx-day365-podglad-domkniecie

docker run -d --name cx-day365-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx365 \
  -p 127.0.0.1:6436:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day365-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6436/cx365 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6436/cx365 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day365-podglad-domkniecie && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6436/cx365 \
JWT_SECRET=cx365-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Zrzuty **wyłącznie kanonicznym narzędziem** `scripts/dev/grafika-zrzuty.mjs` na porcie `5576`, w obu motywach, `pl`, szerokość `1440`, **sekcje ROZWINIĘTE**, z sumą kontrolną SHA-256 i średnią jasnością każdego pliku oraz liczebnością **z uchwytu DOM**. Dowód równoważności historycznych wywołań (`R1`) budujesz przez **dwa przebiegi tego samego wywołania**: raz na wersji narzędzia sprzed commitu `4fcd20808e` (kopia do `SCRATCH`, POZA repo), raz na bieżącej — i porównujesz **sumy kontrolne PNG, treść JSON-a kontroli i KOD WYJŚCIA**. Testy frontowe z roota, `RUN_DB_TESTS=0 MOCK_DB=true`, `--retry=0 --reporter=json --outputFile=/private/tmp/cx-day365-podglad-domkniecie-artefakty/<etykieta>.json`; **`No test files found` i `Transform failed` to BŁĄD KOMENDY, nie PASS**. Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`. Dowody commitujesz do `evidence/**` przez `git add -f` — **istniejących PNG dyżuru 352 nie nadpisujesz** --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day365-podglad-domkniecie-artefakty/day365-podglad-domkniecie.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day365-podglad-domkniecie && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Zrzuty **wyłącznie kanonicznym narzędziem** `scripts/dev/grafika-zrzuty.mjs` na porcie `5576`, w obu motywach, `pl`, szerokość `1440`, **sekcje ROZWINIĘTE**, z sumą kontrolną SHA-256 i średnią jasnością każdego pliku oraz liczebnością **z uchwytu DOM**. Dowód równoważności historycznych wywołań (`R1`) budujesz przez **dwa przebiegi tego samego wywołania**: raz na wersji narzędzia sprzed commitu `4fcd20808e` (kopia do `SCRATCH`, POZA repo), raz na bieżącej — i porównujesz **sumy kontrolne PNG, treść JSON-a kontroli i KOD WYJŚCIA**. Testy frontowe z roota, `RUN_DB_TESTS=0 MOCK_DB=true`, `--retry=0 --reporter=json --outputFile=/private/tmp/cx-day365-podglad-domkniecie-artefakty/<etykieta>.json`; **`No test files found` i `Transform failed` to BŁĄD KOMENDY, nie PASS**. Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`. Dowody commitujesz do `evidence/**` przez `git add -f` — **istniejących PNG dyżuru 352 nie nadpisujesz** --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day365-podglad-domkniecie-artefakty/day365-podglad-domkniecie.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day365-podglad-domkniecie/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day365-pg psql -U postgres -d cx365 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day365-pg`.
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
> **(e) ★★★ **SIEDEM PUŁAPEK.** (1) **Przyrząd nie jest produktem.** Trzy z sześciu „defektów wysokości” w innym dyżurze okazały się hostem harnessu, nie produktem. Zanim zgłosisz defekt, porównaj łańcuch przodków w harnessie i w realnej trasie. (2) **Para identyczna wygląda jak dowód.** 3 z 16 kontekstów mają PRZED i PO o tej samej sumie kontrolnej — bo pusty blok renderował się już przed zmianą (352 to udowodnił i słusznie zapisał). To **falsyfikacja założenia**, nie zaliczona para. (3) **Rodzina nie widać per plik.** Dublet w Finansach powstaje z DWÓCH plików: powłoka renderuje blok, a stopka przekazana jako dzieci renderuje drugi. `grep` po jednym pliku tego nie znajdzie — musisz iść po łańcuchu `children`/`renderPreviewFooter`. Wołaczy przekazujących dzieci jest **16**. (4) **Zwinięta sekcja nie jest dowodem.** Zrzuty robisz z sekcjami ROZWINIĘTYMI; ★ ale uwaga: rozwijanie sekcji potrafi **zamknąć podgląd** — dokładnie temu służy warunek `podgladNadalOtwarty`, który 352 dopisał bez deklaracji. Sprawdź obecność markera `[data-preview-block="details"]` w każdym zaliczonym kadrze. (5) **Skan w trakcie animacji daje fałszywy kontrast** — używaj `--osiad-po-rozwinieciu`. (6) **Bezpiecznik jednowymiarowy nagradza defekt.** Kontrola „light jaśniejszy od dark” przechodzi tym łatwiej, im większy defekt na jednym z kadrów. Podawaj **sumę kontrolną ORAZ średnią jasność ORAZ liczebność z uchwytu DOM**, i patrz na kadry oczami. (7) **`grep --include` w `zsh` zwraca pustkę zamiast wyników** — uruchamiaj przez `bash -c '…'` i sprawdzaj kod wyjścia; pustka nie jest wynikiem, dopóki nie wiesz, że komenda się wykonała**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day365-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day365-podglad-domkniecie-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarde zasady: pytanie kanonu zostaje otwarte; para identyczna = zero dowodu; zakaz czwartej zmiany w harnessie) · R1 (★ BLOKUJĄCA, PIERWSZA: trzy zmiany w harnessie 352 — deklaracja imienna, uzasadnienie, dowód równoważności historycznych wywołań albo cofnięcie — RDZEŃ) · R2 (dublet „Brak powiązań” w Finansach: KROK 0 rodzina 16 wołaczy, potem najwęższa naprawa — RDZEŃ) · R3 (dorobienie brakujących par PRZED/PO: 3 identyczne, 1 bez PO, 3 ekrany CaseWorkspace) · R4 (pytanie o pustą kartę: utrzymać i WYOSTRZYĆ, nie rozstrzygać) · R5 (raport, manifest par, pytania do właściciela)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6436` albo `5576` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6436` albo `5576`** (`Z7`).

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

Dyżur 349 zmienił `src/components/standard/StandardPreview.tsx` tak, że blok „Relations”
renderuje się **bezwarunkowo** (linia **362**, commit `58d391d65b`). Skutek: w każdym
podglądzie wszystkich 16 modułów, także tam gdzie wołacz nie przekazuje żadnych powiązań,
pojawia się karta „POWIĄZANIA / Brak powiązań” o wysokości 107 px.

Dyżur 352 zmierzył to uczciwie i **sam nazwał trzy rzeczy, których nie domknął**. To jest
rzadkie i cenne — dlatego ten dyżur nie zaczyna od zera, tylko domyka dokładnie te trzy.

**★★★ Ale przy odbiorze wyszło coś, czego 352 nie nazwał — i to jest pozycja BLOKUJĄCA.**

Dyżur 352 miał licencję na **jedną** opcję opt-in w kanonicznym narzędziu zrzutów, przy
zachowaniu historycznych wywołań **bit w bit**. Wprowadził **trzy** zmiany w jednym commicie
(`4fcd20808e`):

| # | Zmiana | Czy opt-in | Co zmienia |
| --- | --- | --- | --- |
| (a) | opcja `--mierz-wysokosc` | **TAK** | nic, dopóki nie podasz selektora — **w porządku** |
| (b) | warunek `podgladNadalOtwarty` przed re-klikiem po rozwinięciu sekcji, plus **nowa pętla** po selektorach `KLIK` | **NIE** | **treść kadru** każdego wywołania używającego `--klik-po-rozwinieciu` |
| (c) | `zlePary` liczy tylko pary mające pole `ok` (`Object.hasOwn`), i zmienia się drukowany mianownik | **NIE** | **mianownik i KOD WYJŚCIA** każdego wywołania używającego `--wynik-selektor` |

**Raport 352 nie wspomniał o (b) ani o (c).** Obie są merytorycznie poprawne — (b) naprawia
realną ślepą plamę (rozwijanie sekcji potrafi zamknąć podgląd), (c) naprawia realny błąd
licznika (pary bez pola `ok` nie powinny być liczone jako złe). **Ale obie zmieniają wynik
pomiarów innych dyżurów, a `--klik-po-rozwinieciu` woła pięć skryptów, w tym `g06-macierz-*`,
czyli przegląd 16 modułów — najszerszy pomiar w programie.**

**Zmiana w przyrządzie, o której nikt nie wie, jest gorsza niż defekt w produkcie: defekt
widać, przesunięty przyrząd nie.**

## ★★ TRZY RZECZY DO DOMKNIĘCIA — w tej kolejności

**1. BLOKUJĄCA — trzy zmiany w narzędziu (`R1`).** Zadeklarować imiennie, uzasadnić i pokazać,
że historyczne wywołania dają ten sam wynik — **albo cofnąć**. Bez tego reszta dyżuru nie ma
przyrządu, któremu można ufać.

**2. Dublet w Finansach (`R2`).** `finance-hub&tab=analysis` pokazuje **dwie identyczne karty
„POWIĄZANIA / Brak powiązań” jedna pod drugą**, razem 214 px. Odbiorca potwierdził to własnymi
oczami na kadrze
`evidence/podglad-relations-20260904/finance-analysis/finance-hub__PO__pl__1440__light.png`.
**To jest realny defekt, nie kwestia kadru** — i ma **dwa adresy**:

- `src/components/standard/StandardPreview.tsx:362` — powłoka renderuje blok bezwarunkowo;
- `src/components/Economics/FinancePreviewPanel.tsx:1280` — `renderPreviewFooter` renderuje
  **własny** `PreviewRelations`, a `src/components/Economics/FinanceHub.tsx:3279` przekazuje
  ten footer do `StandardPreview` **jako dzieci**.

**3. Brakujące pary (`R3`).** Z 16 kontekstów tylko **12** ma różne sumy kontrolne;
**3 pary są identyczne** (`core/finance-hub`, `core/results-vnext-registry-shell`,
`core/results-vnext-attention`) i **1 nie ma „PO”** (`audyt-findings`). Dodatkowo trzy ekrany
`CaseWorkspace` (7 użyć `StandardPreview` w 3 plikach) **nie mają wejścia w harnessie** —
mimo commitu o nazwie „feat(dev-render): wejscie harnessu dla CaseWorkspace (352 R4)”, który
**zmienił wyłącznie plik raportu i ani jednej linii `dev-render/`**. Sprawdź to sam.

## ★★ CZEGO NIE ROZSTRZYGASZ

Dyżur 352 **nie rozstrzygnął po cichu** pytania, czy pusta karta ma się w ogóle pokazywać.
Postawił je właścicielowi i pokazał, że SSOT jest wewnętrznie sprzeczny:

| Dokument | Wiersz | Co mówi |
| --- | --- | --- |
| `docs/ui-standards/TRIADA_KANON.md` | `:70` | „**Relations:** klikalne pigułki albo »No relations«” — **blok zawsze** |
| `docs/ui-standards/TRIADA_KANON.md` | `:132` | pozycja 29 listy czekowania: „Relations albo »No relations«” — **blok zawsze** |
| `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` | `:337` | „**Relations** (blok 5 TRIADY, **jeśli są**)” — **blok tylko przy danych** |

**To było poprawne zachowanie i Ty je powtarzasz.** Naprawiasz **dublet** — dwie karty zamiast
jednej. To jest coś zupełnie innego niż „jedna karta zamiast zera”, i tej drugiej zmiany
nie robisz.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze `2a7273e087cbd3e44344725b524f6ddd79d5badc`:

- w commicie `4fcd20808e` są **trzy** zmiany zachowania w `grafika-zrzuty.mjs`, z czego
  **jedna** jest opt-in;
- `--klik-po-rozwinieciu` wołają **cztery** skrypty pomiarowe plus sam harness
  (`r1-slepa-plama-uruchom.mjs`, `r1-slepa-plama-agreguj.mjs`, `g06-macierz-uruchom.mjs`,
  `g06-macierz-rejestr.mjs`, `r4-dowod-uruchom.mjs` — **policz sam, podaj swoją liczbę**);
- katalogów kontekstów w `evidence/podglad-relations-20260904/`: **16**
  (**zlecenie mówiło o 20 — to jest rozbieżność, którą zapisałem; potwierdź ją albo obal**);
- par o różnych sumach kontrolnych: **12**; identycznych: **3**; bez „PO”: **1**;
  plików PNG razem: **62**;
- `core/finance-hub` PO ma **1** pusty blok; `finance-analysis/finance-hub` PO ma **2**
  (107 px każdy, razem 214 px);
- użyć `<StandardPreview` w `src/` bez plików testowych: **55** w **39** plikach
  (dyżur 352 podał **53/39** po usunięciu komentarzy — **mianowniki są różne, podaj definicję
  swojego**); w `dev-render/`: **7** w **6** plikach;
- wołaczy `<StandardPreview>` przekazujących **dzieci**: **16** — i to jest rodzina, w której
  może żyć dublet;
- liście słowników: **pl 35199**, **en 33066**; cztery bezpieczniki kanonu kończą się kodem **0**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: POWŁOKA · WOŁACZE · STOPKA MODUŁU · HARNESS · SKRYPTY POMIAROWE · KANON · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest
**ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Powłoka podglądu** | `src/components/standard/StandardPreview.tsx` | **★ WĄSKA LICENCJA POD WARUNKIEM `R2`:** wolno zmienić **wyłącznie** tak, żeby zniknął DUBLET, i **wyłącznie** razem z parą zrzutów z co najmniej dwóch modułów. **ZAKAZ usunięcia bezwarunkowego renderu bloku i ZAKAZ dodania warunku „tylko gdy są dane”** — to jest pytanie do właściciela (`R4`) | Brief z `plik:linia` + diff **nienałożony** |
| **Blok Relations** | `src/components/shared/PreviewPane/**` (`PreviewRelations`) | **TYLKO ODCZYT** — komponent jest wspólny dla wszystkich 16 modułów | Brief |
| **Stopka Finansów (drugi adres dubletu)** | `src/components/Economics/FinancePreviewPanel.tsx`, `src/components/Economics/FinanceHub.tsx` | **★ WĄSKA LICENCJA POD WARUNKIEM `R2`:** wolno usunąć **jedno** z dwóch wystąpień bloku Relations, po wykazaniu, które jest kanoniczne. **Zakaz zmiany treści `emptyLabel` Finansów** (`relationsInWorkspace`) bez decyzji właściciela | Brief |
| **Pozostałe 15 wołaczy z dziećmi** | 16 miejsc `<StandardPreview>` przekazujących dzieci (lista z `R2` `KROK 0`) | **TYLKO ODCZYT**, chyba że `R2` udowodni w nich ten sam dublet — wtedy naprawa obejmuje **rodzinę**, a nie tylko Finanse | Wpis do raportu z `plik:linia` |
| **Kanoniczne narzędzie zrzutów** | `scripts/dev/grafika-zrzuty.mjs` | **★ LICENCJA WYŁĄCZNIE NA ROZLICZENIE `R1`:** wolno **cofnąć** zmianę (b) i/lub (c), albo **zostawić je z jawną deklaracją i dowodem równoważności**. **ZAKAZ dopisania czwartej zmiany.** Jedna nowa opcja opt-in dopuszczalna tylko z dowodem, że historyczne wywołania dają wynik i kod wyjścia bit w bit | — |
| **Skrypty pomiarowe wołające harness** | `scripts/dev/{r1-slepa-plama-uruchom,r1-slepa-plama-agreguj,g06-macierz-uruchom,g06-macierz-rejestr,r4-dowod-uruchom}.mjs`, `scripts/check-dev-render-parytet.mjs` | **TYLKO ODCZYT — WOŁASZ, NIE ZMIENIASZ.** To są historyczne wywołania, wobec których dowodzisz równoważności | Wynik obu przebiegów do raportu |
| **Harness (dev-render)** | `dev-render/main.tsx`, `dev-render/screens/**` | **★ WĄSKA LICENCJA:** wolno dodać wpisy `SCREENS` montujące **realne** komponenty produktu, wyłącznie dla ekranów bez wejścia (`CasesListScreen`, `RealizacjaView`, `RezultatyView`) i dla niepustej selekcji `AuditFindingsTab`. **Zakaz atrapy zamiast komponentu produktu i zakaz zmiany istniejących wpisów** | Brief z listą brakujących zależności fikstury |
| **Dokumenty kanonu** | `docs/ui-standards/TRIADA_KANON.md`, `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md` | **NIETYKALNE DO ZAPISU — BEZWZGLĘDNIE.** Sprzeczność między nimi jest przedmiotem pytania do właściciela, nie Twojej redakcji | Cytat obu wierszy w `R4` |
| **Zasady pracy toru grafiki** | `docs/program/grafika/00_ZASADY_PRACY.md` | **AKTUALIZACJA przez DOPISANIE** sekcji o zmianach w narzędziu (352 i 365), nigdy nadpisanie | — |
| **Dowody 352** | `evidence/podglad-relations-20260904/**` — istniejące PNG i JSON | **TYLKO ODCZYT dla istniejących plików; DOPISYWANIE nowych dozwolone.** Nadpisanie istniejącego PNG unieważnia bazę porównania | — |
| **Nowe dowody** | `evidence/podglad-domkniecie-20260904/**` (**NIE ISTNIEJE — tworzysz**) | **★ PEŁNA LICENCJA**; commitujesz przez `git add -f` | — |
| **Testy podglądu** | `src/components/shared/__tests__/standardPreview.r03.test.tsx`, `.../tablePreviewGeometry.r03-2.test.tsx`, `src/components/standard/__tests__/keyboardAccessCanon.test.tsx` | **TYLKO URUCHAMIANIE** (48 przypadków PRZED i PO wg 352 — zmierz sam). Zakaz osłabienia asercji | Wynik do raportu |
| **Nowe testy** | `tests/**` (nowe pliki, `git add -f`) | **★ PEŁNA LICENCJA**, jeżeli dublet da się objąć testem. **Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`** | — |
| **Serwer** | `server/**` | **TYLKO ODCZYT** | Brief |
| **Słowniki** | `public/locales/**` | **NIETYKALNE DO ZAPISU.** Liście nie mogą zmaleć | Opis w raporcie |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`** | Opis w raporcie |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU — ŻADEN wiersz, ŻADEN moduł** | Rekomendacja w raporcie |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze** (`AA`, `AB`, …), sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY365_PODGLAD_DOMKNIECIE_REPORT.md` (**NOWY**) | `R5` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `evidence/g15/**`, `server/src/services/legacyCutover/**` (dyżury 363 i 366) · `src/store/useToolStore.ts`, `src/components/DiscoveryTools/**`, `scripts/dev/check-etykiety-dwujezyczne*`, `scripts/dev/i18n-pl-audyt.mjs` (dyżur 364) · `tests/unit/assessment/day351.assessmentCompleteness.test.ts`, `server/src/routes/assessment/assessment-hub.routes.ts` (dyżur 366) · wiersze macierzy i rejestry bramek (dyżury 359-362) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35199, en 33066

# (b) bramki kanonu maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
node scripts/check-dev-render-parytet.mjs >/dev/null 2>&1; echo "parytet=$?"
#   moje liczby: cztery pierwsze 0; parytet dev-render zmierz sam PRZED zmiana harnessu
```

**Jeżeli którakolwiek liczba zmaleje albo bramka zaczerwieni się od Twojej zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | zmian zachowania w commicie `4fcd20808e` | `3`, z czego `1` opt-in | komenda (1) z `§0.3` | TAK — czyta diff narzędzia, nie raport |
| 2 | skryptów wołających `--klik-po-rozwinieciu` | `5` | komenda (2) | TAK — **to jest zasięg skutku zmiany (b)** |
| 3 | dokumentów opisujących `--wynik-selektor` | `4` | komenda (2) | TAK — **zasięg skutku zmiany (c)** |
| 4 | kontekstów w katalogu dowodów | `16` | komenda (3) | TAK — **obala „20” ze zlecenia** |
| 5 | par różnych / identycznych / bez PO | `12` / `3` / `1` | komenda (3) | TAK — po sumach SHA-256, nie po dacie pliku |
| 6 | pustych bloków w Finansach | `1` (core) / `2` (analysis) | komenda (4) | TAK — z JSON-a kontroli, nie z oka |
| 7 | adresów dubletu | `2` (`plik:linia`) | komenda (5) | TAK |
| 8 | użyć `<StandardPreview>` i tych z dziećmi | `55/39` + `7/6`, z dziećmi `16` | komenda (6) | TAK — **`grep` per plik NIE znajduje tej rodziny** |
| 9 | wierszy sprzeczności w SSOT | `3` (`:70`, `:132`, `:337`) | komenda (7) | TAK |
| 10 | testy podglądu przed/po | `48` wg 352 | własny przebieg | TAK — `numTotalTests`, nie tylko `numFailedTests` |
| 11 | równoważność historycznych wywołań | — | dwa przebiegi z `R1` | TAK — porównuje PNG, JSON **i kod wyjścia** |
| 12 | liście słowników PL/EN | `35199` / `33066` | blok (a) „WARUNKÓW WSPÓLNYCH” | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY365_PODGLAD_DOMKNIECIE_REPORT.md` ·
`evidence/podglad-domkniecie-20260904/**` (nowy katalog) ·
`docs/program/grafika/00_ZASADY_PRACY.md` (sekcja **dopisana**).

**Zapisujesz WARUNKOWO:**
`scripts/dev/grafika-zrzuty.mjs` (wyłącznie rozliczenie `R1`) ·
`src/components/standard/StandardPreview.tsx` **albo**
`src/components/Economics/FinancePreviewPanel.tsx` (wyłącznie usunięcie dubletu — **jedno
z dwóch, nie oba naraz bez uzasadnienia**) ·
`dev-render/main.tsx` + nowe pliki w `dev-render/screens/` ·
nowe PNG/JSON w `evidence/podglad-relations-20260904/` (**tylko nowe nazwy**) ·
nowe pliki testowe w `tests/` (`git add -f`) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `public/locales/**`, `server/**`,
`docs/ui-standards/TRIADA_KANON.md`, `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md`,
`src/components/shared/PreviewPane/**`,
`scripts/dev/{r1-slepa-plama-*,g06-macierz-*,r4-dowod-uruchom}.mjs`,
`scripts/check-dev-render-parytet.mjs`, `tests/setup.ts`, `tests/helpers/**`,
`tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`,
`server/migrations/**`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (**wszystkie 16**),
**istniejące** pliki PNG i JSON w `evidence/podglad-relations-20260904/`,
`evidence/g15/**`, `src/store/useToolStore.ts`, `scripts/dev/check-etykiety-dwujezyczne*`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day365-podglad-domkniecie
git diff --name-only --cached | tee /private/tmp/cx-day365-podglad-domkniecie-artefakty/staged.txt
bash -c "grep -iE '^public/locales/|^server/|ui-standards/|PreviewPane/|slepa-plama|g06-macierz|r4-dowod|dev-render-parytet|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|MODULE_ACCEPTANCE|evidence/g15|useToolStore|check-etykiety' /private/tmp/cx-day365-podglad-domkniecie-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
# ★ osobno: zaden ISTNIEJACY plik z evidence/podglad-relations-20260904 nie moze byc zmodyfikowany
git diff --name-status --cached -- evidence/podglad-relations-20260904 | grep -v '^A' && echo "★★ NADPISUJESZ DOWOD 352 — COFNIJ" || echo "dowody 352 nietkniete"
```

---

## R0 — CZTERY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Przyrząd przed produktem.** `R1` jest pierwsza i blokująca. Dopóki nie wiadomo, czy
narzędzie zrzutów mierzy to samo co wczoraj, każdy kolejny kadr jest bez wartości. Jeżeli
zatrzymasz się po `R1` — to jest pełnowartościowy wynik dyżuru.

**(2) Pytanie o pustą kartę zostaje otwarte.** Naprawiasz **dublet** (dwie karty → jedna).
Nie usuwasz bezwarunkowego renderu, nie dodajesz warunku „tylko gdy są dane”, nie zmieniasz
żadnego z dwóch dokumentów kanonu.

**(3) Para bajtowo identyczna = ZERO dowodu.** Zapisujesz ją jako wynik negatywny
z wyjaśnieniem, dlaczego zmiana nie dotarła do renderowanego DOM-u. Nigdy jako zaliczoną parę.

**(4) Brakującą funkcję dokłada się NARZĘDZIU, opt-in.** Zakaz własnego skryptu zrzucającego
obok kanonicznego — doraźny skrypt dał już raz parę identycznych obrazów i zameldował sukces.

**Wymagany dowód:** cztery zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — ★ BLOKUJĄCA: TRZY ZMIANY W NARZĘDZIU — ZADEKLAROWAĆ, UDOWODNIĆ RÓWNOWAŻNOŚĆ ALBO COFNĄĆ (rdzeń)

**Ta pozycja jest pierwsza. Nie zaczynasz `R2` przed jej commitem.**

1. **Przeczytaj diff** `git show 4fcd20808e -- scripts/dev/grafika-zrzuty.mjs` i **wypisz
   wszystkie zmiany zachowania z osobna**, każdą z `plik:linia` i jednym zdaniem: co robi,
   kto na nią patrzy, czy jest opt-in. Moja liczba: **trzy**. Jeżeli znajdziesz czwartą —
   obowiązuje Twój pomiar.
2. **Ustal zasięg skutku.** Dla `(b)` — które wywołania używają `--klik-po-rozwinieciu`;
   dla `(c)` — które używają `--wynik-selektor`. Podaj listę plików i dokumentów.
   **To jest liczba, o którą chodzi: ile pomiarów w programie stoi na zmienionym przyrządzie.**
3. **DOWÓD RÓWNOWAŻNOŚCI — dwa przebiegi tego samego wywołania.**
   Skopiuj wersję narzędzia sprzed `4fcd20808e` do `SCRATCH` (**POZA repo**, `Z13`):
   `git show 4fcd20808e^:scripts/dev/grafika-zrzuty.mjs > $SCRATCH/grafika-zrzuty-przed.mjs`.
   Uruchom **to samo** historyczne wywołanie (wzór weź z `g06-macierz-uruchom.mjs` albo
   `r1-slepa-plama-uruchom.mjs`) raz starą, raz bieżącą wersją i porównaj **trzy rzeczy**:
   sumy kontrolne SHA-256 wszystkich PNG, treść JSON-a kontroli, **kod wyjścia**.
4. **Werdykt per zmiana**, jeden z trzech, i tylko z tych trzech:
   - `RÓWNOWAŻNA` — historyczne wywołanie daje identyczny wynik i kod wyjścia; zmiana zostaje,
     z jawną deklaracją;
   - `ZMIENIA WYNIK, PRZYJĘTA` — zmienia, ale jest merytorycznie poprawna; zostaje,
     **z deklaracją, uzasadnieniem i wypisaniem, które wcześniejsze pomiary mogły być
     zawyżone lub zaniżone**;
   - `COFNIĘTA` — zmiana wraca do stanu sprzed `4fcd20808e`.
5. **Zapisz deklarację na trwałe.** Dopisz do `docs/program/grafika/00_ZASADY_PRACY.md`
   sekcję „Zmiany w kanonicznym narzędziu zrzutów — dyżury 352 i 365”: data, `plik:linia`,
   opcja, opis skutku, werdykt. **Dopisanie, nigdy nadpisanie.** Sprawdź najpierw, czy plik
   nie jest generowany: `bash -c "grep -rl '00_ZASADY_PRACY' scripts/"`.
6. **Jeżeli werdykt dla `(b)` lub `(c)` brzmi `ZMIENIA WYNIK, PRZYJĘTA`** — wypisz z nazwy
   dyżury i dokumenty, których liczby mogą być teraz nieaktualne. To jest osobne zlecenie,
   nie Twoja praca; ale bez tej listy nikt się nie dowie, że powstało.

**Wymagany dowód:** lista wszystkich zmian z `plik:linia` · lista wywołań i dokumentów
w zasięgu skutku · **dwa przebiegi z sumami SHA-256, treścią JSON i kodami wyjścia** ·
werdykt per zmiana · sekcja dopisana do `00_ZASADY_PRACY.md` · lista pomiarów do przemiaru.
**Commit po `R1`.**

## R2 — DUBLET „BRAK POWIĄZAŃ” W FINANSACH (rdzeń)

**KROK 0 — wypisz rodzeństwo, ZANIM cokolwiek naprawisz.**

1. **Wypisz 16 wołaczy `<StandardPreview>` przekazujących dzieci** (komenda (6) z `§0.3`)
   i dla każdego sprawdź, czy jego dzieci zawierają własny `PreviewRelations`,
   `PreviewAIHintStrip` albo `PreviewActionBar`. **★ `grep` po jednym pliku tego nie znajdzie**
   — dublet w Finansach powstaje z DWÓCH plików (`FinanceHub.tsx` woła hook
   z `FinancePreviewPanel.tsx`). Idź po łańcuchu `children` / `renderPreviewFooter`.
2. **Podaj liczbę:** ile z 16 wołaczy dubluje **którykolwiek** z trzech bloków stopki.
   Jeżeli Finanse są jedyne — powiedz to wprost. Jeżeli nie — **naprawa obejmuje rodzinę**,
   nie tylko zgłoszony przypadek; praca per zgłoszenie daje „poprawne w dwóch z trzech”.
3. **Rozstrzygnij, które wystąpienie jest kanoniczne**, cytując kanon:
   powłoka (`StandardPreview.tsx:362`) czy stopka modułu (`FinancePreviewPanel.tsx:1280`).
   **To jest pytanie o architekturę bloku, nie o to, czy blok ma istnieć.**
4. **Napraw najwęziej, jak się da.** Preferowana droga: usunięcie **jednego** z dwóch
   wystąpień. Zmiana w `StandardPreview.tsx` dotyka wszystkich 16 modułów naraz — jeżeli ją
   wybierzesz, **musisz** dołożyć parę zrzutów z co najmniej dwóch innych modułów jako dowód,
   że niczego tam nie zgasiłeś.
5. **★ Uwaga na treść pustej etykiety.** Finanse mają własny `emptyLabel`
   (`finance.preview.relationsInWorkspace`, „Verified lineage is available in the canonical
   workspace”), różny od domyślnego „Brak powiązań”. **Jeżeli usuniesz niewłaściwe wystąpienie,
   zgubisz tę treść.** Sprawdź w zrzucie PO, która etykieta została.
6. **Dowód wizualny:** para PRZED/PO dla `finance-hub&tab=analysis`, oba motywy, sekcje
   ROZWINIĘTE, z SHA-256, średnią jasnością i **liczebnością pustych bloków z uchwytu DOM**.
   Oczekiwany kształt wyniku: **2 → 1**. Para bajtowo identyczna = zero dowodu.
7. **★ OBEJRZYJ KADR WŁASNYMI OCZAMI** i napisz jedno zdanie: co widzisz na PO-light.
   Nie „test przeszedł”, tylko „pod szczegółami jest jedna karta »POWIĄZANIA« z etykietą …”.
8. **Testy podglądu** (`standardPreview.r03`, `tablePreviewGeometry.r03-2`,
   `keyboardAccessCanon`) PRZED i PO, `--retry=0 --reporter=json`, z `numTotalTests`
   i `diff` list pełnych nazw. **Żadna nazwa nie ma zniknąć.**

**Wymagany dowód:** tabela 16 wołaczy z kolumną „dubluje blok stopki TAK/NIE” · liczba ·
uzasadnienie wyboru kanonicznego wystąpienia · para zrzutów `2 → 1` z sumami i liczebnością
z DOM · zdanie oględzin · wynik testów przed/po z `numTotalTests`. **Commit po `R2`.**

## R3 — DOROBIENIE BRAKUJĄCYCH PAR PRZED/PO

Dyżur 352 powiedział wprost, czego nie domknął — to był niedomknięty próg, nie fałszywe
„gotowe”. Domykasz go.

1. **Trzy pary identyczne** (`core/finance-hub`, `core/results-vnext-registry-shell`,
   `core/results-vnext-attention`). 352 udowodnił, że te ekrany **już przed zmianą** miały
   pusty blok, bo dane szły spreadem. **To jest falsyfikacja założenia i ma zostać zapisana
   jako taka.** Twoje zadanie: albo znaleźć stan, w którym para faktycznie się różni
   (i wtedy ją dostarczyć), albo **potwierdzić własnym pomiarem, że różnicy nie ma, i zamknąć
   te trzy jako `BEZ ZMIANY RUNTIME — POTWIERDZONE`**. Oba wyniki są dobre; zgadywanie nie.
2. **`audyt-findings` bez „PO”.** 352 nazwał przyczynę: wpis `tab=findings` działa, ale
   domyślnie wybiera pierwszy program z zerem ustaleń, a `AuditFindingsTab` nie czyta
   `programId` z URL. Fikstura `prog-metalpol-zakupy` istnieje. **Dodaj wejście harnessu
   z niepustą selekcją** (wpis montujący realny komponent) — albo, jeżeli wymagałoby to
   nowej opcji w narzędziu, **zatrzymaj się i napisz brief**, bo `R0` (4) i `R1` zabraniają
   dopisywania czwartej zmiany bez rozliczenia.
3. **Trzy ekrany `CaseWorkspace`** (`CasesListScreen`, `RealizacjaView`, `RezultatyView`;
   razem 7 użyć `StandardPreview` w 3 plikach) **nie mają wejścia w harnessie**.
   ★ Commit `a38110231b` nosi nazwę „feat(dev-render): wejscie harnessu dla CaseWorkspace
   (352 R4)”, ale **zmienił wyłącznie plik raportu** — sprawdź to sam
   (`git show --stat a38110231b`) i zapisz, co zobaczyłeś. Dodaj brakujące wpisy albo
   dostarcz brief z listą wymaganych zależności fikstury.
4. **Manifest końcowy:** tabela wszystkich kontekstów — kontekst · faza · motyw · ścieżka PNG ·
   SHA-256 · średnia jasność · liczebność z DOM · werdykt (`RÓŻNA PARA` /
   `BEZ ZMIANY RUNTIME — POTWIERDZONE` / `BRAK WEJŚCIA — BRIEF`).
5. **★ OBEJRZYJ KAŻDY NOWY KADR WŁASNYMI OCZAMI**, jedno zdanie per kadr. Liczby nie
   wystarczą — kontrolki harnessu zasłaniały już raz produkt na każdym zrzucie przez cały
   dzień i nikt tego nie zauważył.

**Wymagany dowód:** manifest wszystkich kontekstów z sumami, jasnością i werdyktem ·
nowe pary z sekcjami rozwiniętymi · zdania oględzin · brief dla każdego kontekstu bez wejścia.
**Commit po `R3`.**

## R4 — PYTANIE O PUSTĄ KARTĘ: UTRZYMAĆ I WYOSTRZYĆ, NIE ROZSTRZYGAĆ

1. **Zacytuj oba zapisy SSOT dosłownie**, z `plik:linia` (`TRIADA_KANON.md:70` i `:132`
   kontra `TABLE_AND_PREVIEW_CANON.md:337`) i pokaż, że są wzajemnie wykluczające się.
2. **Wyostrz pytanie tak, żeby dało się na nie odpowiedzieć „tak” albo „nie”.**
   Dyżur 352 zapytał: „czy pojedyncza karta »Brak powiązań« ma pozostać na ekranach, które
   nie deklarują powiązań?”. Dołóż do tego **koszt każdej odpowiedzi**, zmierzony:
   ile ekranów dotyczy, ile pikseli zabiera per ekran, czy odbiera treść czy tylko przewijanie.
3. **Dołóż trzecią możliwość, jeżeli Twój pomiar ją pokaże** — na przykład „blok pokazuje się
   tylko wtedy, gdy moduł deklaruje, że powiązania są dla tej encji sensowne”. **Ale nie
   implementujesz jej.**
4. **Nie zmieniasz żadnego z dwóch dokumentów kanonu.** Rozstrzygnięcie sprzeczności należy
   do właściciela; Twoim produktem jest pytanie z policzonym kosztem.

**Wymagany dowód:** dosłowne cytaty z `plik:linia` · pytanie rozstrzygalne „tak”/„nie” ·
policzony koszt każdej odpowiedzi · jawne stwierdzenie, że nie zmieniłeś dokumentów kanonu.
**Commit po `R4`.**

## R5 — RAPORT, MANIFEST I PYTANIA DO WŁAŚCICIELA

Raport zawiera: rozliczenie trzech zmian w narzędziu z `R1` (**werdykt per zmiana, dosłowne
wyniki dwóch przebiegów, kody wyjścia**) · tabelę 16 wołaczy i naprawę dubletu z `R2` ·
manifest wszystkich kontekstów z `R3` · pytanie z `R4` z policzonym kosztem ·
listę rozbieżności wobec liczb tej instrukcji · **niepustą sekcję „TWIERDZENIA
NIEZWERYFIKOWANE”** · obowiązkowy akapit `§0.2e` dla każdego uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „POMIARY DO PRZEMIARU”.** Jeżeli którakolwiek ze zmian
w narzędziu okaże się `ZMIENIA WYNIK, PRZYJĘTA` — wypisz z nazwy dyżury, dokumenty i wiersze
rejestrów, których liczby mogą być teraz nieaktualne. **Bez tej listy nikt się nie dowie,
że powstał dług pomiarowy.**

★★ **Osobna, obowiązkowa sekcja: „OGLĘDZINY”.** Jedno zdanie na każdy kadr, który obejrzałeś
własnymi oczami. Zdanie ma opisywać, **co widzisz**, nie **czy test przeszedł**.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA”.** Pierwsze pytanie jest już znane
(`R4`). Drugie, jeżeli je zobaczysz: czy zmiany `(b)` i `(c)` w narzędziu mają zostać.
Sekcja nie może być pusta — pytanie o pustą kartę jest w niej obowiązkowo.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sekcje doszły dziś do `Z`, więc następne idą
`AA`, `AB`, …; sprawdź komendą
`bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle piszą inni autorzy.

**Commit po `R5`.**

## Próg odbioru

**Wszystkie konteksty z werdyktem i różnymi sumami tam, gdzie różnica jest możliwa;
`finance-hub&tab=analysis` z jedną kartą zamiast dwóch; trzy zmiany w harnessie zadeklarowane
imiennie z dowodem, że historyczne wywołania dają ten sam wynik i ten sam kod wyjścia** —
przy nietkniętym pytaniu o sens pustej karty i nietkniętych dokumentach kanonu.

Odbiorca odrzuci dyżur, w którym: zmiany w narzędziu zostały bez deklaracji albo bez dowodu
równoważności; dołożono czwartą zmianę; para bajtowo identyczna została zaliczona jako dowód;
naprawiono Finanse bez sprawdzenia pozostałych piętnastu wołaczy z dziećmi; kadrów nie
obejrzano oczami; albo rozstrzygnięto po cichu pytanie o pustą kartę.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. **Zdanie: „trzy zmiany w narzędziu
rozliczone, dwie cofnięte, dublet nienaprawiony, bo wymaga decyzji o kanonicznym wystąpieniu
bloku” — jest pełnowartościowym wynikiem tego dyżuru**, nawet jeżeli nie powstanie ani jedna
nowa para zrzutów. Przyrząd jest ważniejszy od kadru.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Napraw dublet w `StandardPreview`” vs „nie rozstrzygaj, czy pusta karta ma być” | `R0` (2) i `R2`: naprawiasz „dwie karty → jedna”; „jedna → zero” jest pytaniem do właściciela |
| „Narzędzie jest bramką, nietykalne” vs „rozlicz trzy zmiany w narzędziu” | Tabela licencji: licencja **wyłącznie na rozliczenie** — cofnięcie albo deklaracja z dowodem; zakaz czwartej zmiany |
| „Dorób brakujące pary” vs „zakaz dopisania czwartej zmiany do harnessu” | `R3` punkt 2: jeżeli para wymaga nowej opcji — zatrzymujesz się i piszesz brief; jedna opcja opt-in tylko z dowodem równoważności |
| „Zrzuty z sekcjami rozwiniętymi” vs „rozwijanie zamyka podgląd” | `PULAPKA` (4) i `R1`: dokładnie temu służy zmiana (b); sprawdzasz marker `[data-preview-block="details"]` w każdym kadrze |
| „12 z 20 kontekstów” vs „katalogów jest 16” | Sekcja „Zmierz moje liczby sam” i mianownik #4: rozbieżność zapisana jawnie, obowiązuje pomiar wykonawcy |
| „Napraw Finanse” vs „naprawa obejmuje rodzinę” | `R2` `KROK 0`: najpierw 16 wołaczy, potem naprawa; praca per zgłoszenie daje „poprawne w dwóch z trzech” |
| „Usuń jeden blok” vs „Finanse mają własną etykietę pustego stanu” | `R2` punkt 5: sprawdzasz w kadrze PO, która etykieta została; usunięcie niewłaściwego wystąpienia gubi treść |
| „Zmiana w powłoce jest najprostsza” vs „dotyka 16 modułów naraz” | `R2` punkt 4: wybór powłoki wymaga dowodu wizualnego z co najmniej dwóch innych modułów |
| „Para identyczna to porażka” vs „352 udowodnił, że tak ma być” | `R3` punkt 1: `BEZ ZMIANY RUNTIME — POTWIERDZONE` jest pełnoprawnym werdyktem; zgadywanie nie jest |
| „Commit mówi, że wejście CaseWorkspace powstało” vs „w `dev-render/` nic się nie zmieniło” | `R3` punkt 3: sprawdzasz `git show --stat` i zapisujesz, co zobaczyłeś; nazwa commita nie jest dowodem |
| „Aktualizuj `00_ZASADY_PRACY.md`” vs „dokumenty kanonu nietykalne” | Tabela licencji: `00_ZASADY_PRACY.md` to zasady toru grafiki (dopisanie dozwolone); `TRIADA_KANON.md` i `TABLE_AND_PREVIEW_CANON.md` to kanon UI (nietykalne) |
| „Dopisz sekcję do rejestru znalezisk” vs „równolegle piszą inni autorzy” | `R5`: literę sprawdzasz komendą tuż przed commitem; sekcje doszły do `Z`, następne to `AA`, `AB` |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 12 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — `StandardPreview.tsx:353-368`, `FinancePreviewPanel.tsx:1280`, `FinanceHub.tsx:3272/3279`, commity `58d391d65b`, `4fcd20808e`, `a38110231b`, pięć skryptów pomiarowych, oba dokumenty kanonu, 16 katalogów dowodowych i 62 PNG sprawdzone; `evidence/podglad-domkniecie-20260904/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1-9 i 12 zmierzone przy wydaniu na markerze |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — powłoka · blok Relations · stopka Finansów · 15 pozostałych wołaczy · narzędzie zrzutów · skrypty pomiarowe · harness · dokumenty kanonu · zasady toru grafiki · dowody 352 · nowe dowody · testy podglądu · nowe testy · serwer · słowniki · infrastruktura testów · macierz · rejestr znalezisk · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` czyta diff i porównuje dwa przebiegi, `R2` naprawia jeden dublet, `R3` dorabia kadry, `R4` formułuje pytanie, `R5` składa |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6436/5576 wolne (`lsof` przy wydaniu), brak kontenera `cx-day365-pg`, brak gałęzi `codex/day365-*` i worktree; 363/364/366 mają rozłączne porty i pliki; paczka 359-362 ma zarezerwowany przedział 6430-6433/5570-5573 i rozłączny temat |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: przyrząd nie jest produktem, para identyczna, rodzina niewidoczna per plik, zwinięta sekcja, skan w trakcie animacji, bezpiecznik jednowymiarowy, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany”, zero pól szablonu | TAK — kontrola generatora przy wydaniu |
