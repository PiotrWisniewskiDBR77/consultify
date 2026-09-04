# INSTRUKCJA DYŻURU nr 352 — Codex — „★★★ DWADZIESCIA SZESC PODGLADOW ZMIENILO WYGLAD I NIKT TEGO NIE WIDZIAL — pary PRZED/PO, obejrzane wlasnymi oczami, zanim zobaczy to wlasciciel. Dyzur 349 (scalony, `58d391d65b`) naprawil cztery czerwone kontrakty UI uczciwie: zdjal warunek `ai || relations || … ? (…) : undefined` ze stopki `StandardPreview` i zmienil `{relations ? <PreviewRelations items={relations}/> : null}` na `<PreviewRelations items={relations ?? []}/>`. ★★ SKUTKIEM UBOCZNYM jest to, ze **kazdy ekran, ktory nie podaje `relations`, dostal teraz karte „Brak powiazan”, a stopka renderuje sie ZAWSZE** — realna zmiana wygladu, ktorej nikt nie ogladal. ★★ MOJ POMIAR OBALIL LICZBE ZE ZLECENIA: nie „20 z 44”, tylko **26 uzyc bez `relations` w 18 plikach** (z 53 uzyc w 39 plikach w `src/`), wszystkie **osiagalne z korzenia aplikacji**. ★★ SEDNO MERYTORYCZNE: **SSOT wygladu sam sobie przeczy** — `TRIADA_KANON.md:70` i punkt 29 listy czekowania zadaja „pigulki **albo** »No relations«” (czyli ZAWSZE), a `TABLE_AND_PREVIEW_CANON.md:337` pisze „blok 5 TRIADY, **jesli sa**” (czyli TYLKO GDY SA). Tego **nie rozstrzygasz sam** — stawiasz wlascicielowi JEDNO pytanie rozstrzygalne, poparte zrzutami. Prog: pary PRZED/PO dla **wszystkich** zmierzonych ekranow (light+dark), o roznych sumach kontrolnych, obejrzane; lista „wyglada dobrze” / „wyglada zle” z uzasadnieniem per ekran; rekomendacja z jednym pytaniem"

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
> **wyłącznie** `/private/tmp/cx-day352-preview-20-ekranow`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `c0f690bae36a386de27f1a349fbb9674ec03c693`**
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
Zakres: **PRZEKROJOWE — **podglad (`StandardPreview`) we wszystkich modulach, ktore go osadzaja**: Audyty, CaseWorkspace, Finanse, Moja Praca, Report Builder, Wyniki (ResultsVNext), SuperAdmin, Ocena, Partner. Przedmiotem pracy jest **ZOBACZENIE zmiany wygladu, ktora juz weszla**, i postawienie pytania merytorycznego — nie przebudowa kanonu i nie masowa naprawa ekranow. ★★ Regula nienaruszalna (`CLAUDE.md` pkt 7): **wlasciciel NIGDY nie jest pierwszym testerem wizualnym**. Prawo zatrzymania PO KAZDEJ pozycji `R`, z commitem, i plikiem postepu `/private/tmp/cx-day352-postep.md` (poza repo — dowody wlasciwe, w tym WSZYSTKIE zrzuty, ida do `evidence/` w repo)**.
Trasy front: `Komponent: `src/components/standard/StandardPreview.tsx` (548 linii; blok 5 renderowany ok. 361-368, stopka ok. 353-411) i `PreviewRelations` z `src/components/shared/PreviewPane`. ★ OSIEMNASCIE plikow bez `relations` na markerze (moj pomiar; zweryfikuj sam): `Audit/method/tabs/AuditFindingsTab.tsx:666` · `AuditInitiativesTab.tsx:301` · `AuditLibraryTab.tsx:332` · `AuditOutputsTab.tsx:337` · `AuditReportsTab.tsx:484` · `CaseWorkspace/CasesListScreen.tsx:1061` · `CaseWorkspace/RealizacjaView.tsx:1531,1620,1679` · `CaseWorkspace/RezultatyView.tsx:1527,1626,1777` · `Economics/FinanceHub.tsx:3272` · `MyWork/MyProjects.tsx:886,1115` · `ReportBuilder/BlockTypesManager.tsx:565` · `ReportBuilder/TemplatesManager.tsx:692` · `ResultsVNext/ResultsVNextRegistryShell.tsx:246` · `ResultsVNext/attention/ResultsAttentionPage.tsx:287` · `SuperAdmin/ModelRegistry/ModelCatalogTable.tsx:851` · `assessment/library/AssessmentLibraryTab.tsx:583` · `views/superadmin/AIPlatformModule/Development/PromptRegistryTab.tsx:315` · `views/superadmin/revenue/PartnerSettlementsView.tsx:947,1080,1155,1227``. Trasy tył: `★ BRAK. Ten dyzur **nie dotyka serwera** — ani jednej trasy, ani jednego kontrolera, ani jednej migracji. Baza `cx352` na porcie `6411` jest przydzielona jako zasob wylaczny **na wypadek**, gdyby ktorys ekran harnessu wymagal realnego backendu; jezeli jej nie podniesiesz — **to jest poprawny wynik**, wpisz to w raporcie jednym zdaniem. Narzedziem pracy jest harness `dev-render` (Vite na Twoim porcie **5551**) i kanoniczne narzedzie zrzutowe `scripts/dev/grafika-zrzuty.mjs``.

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
WT=/private/tmp/cx-day352-preview-20-ekranow
MARKER=c0f690bae36a386de27f1a349fbb9674ec03c693

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day352-preview-20-ekranow-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day352-preview-20-ekranow/config.worktree"
cat "$VAULT/worktrees/cx-day352-preview-20-ekranow/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day352-preview-20-ekranow-scratch
mkdir -p /private/tmp/cx-day352-preview-20-ekranow-artefakty

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
git -C "$VAULT" log --oneline c0f690bae36a386de27f1a349fbb9674ec03c693..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only c0f690bae36a386de27f1a349fbb9674ec03c693..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day352-preview-20-ekranow-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only c0f690bae36a386de27f1a349fbb9674ec03c693..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dziewiec` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day352-preview-20-ekranow

# (1) ★ TEZA-PRZYCZYNA: dyzur 349 zdjal warunek — stopka i karta Relations renderuja sie ZAWSZE
git show 58d391d65b -- src/components/standard/StandardPreview.tsx
#   oczekiwane: `const footer = ai || relations || actionRows.length > 0 || whatsNext ? (` → `const footer = (`
#   oraz `{relations ? (<PreviewRelations items={relations} .../>) : null}` → `<PreviewRelations items={relations ?? []} .../>`.
#   ★ To NIE jest blad dyzuru 349 — to naprawa kontraktu. Skutkiem ubocznym jest zmiana wygladu.

# (2) ★★ TEZA ROZSTRZYGAJACA: ILE ekranow podglądu dostalo nowa karte, ktorej nikt nie widzial
#     ★ Grep po nazwie komponentu ZLICZY TEZ KOMENTARZE — dwa trafienia w repo to zdania w blokach `/* */`.
#     Napisz WLASNY licznik, ktory usuwa komentarze i czyta blok atrybutow do domykajacego `>`.
bash -c "grep -rl '<StandardPreview' src/ dev-render/ --include=*.tsx | wc -l"
bash -c "grep -rn 'relations=' src/ --include=*.tsx | wc -l"
#   moje liczby (po usunieciu komentarzy, JSX-owe uzycia, bez testow i bez samego komponentu):
#   w `src/` — 53 uzycia w 39 plikach, z czego 27 podaje `relations`, a **26 NIE podaje, w 18 plikach**;
#   w `dev-render/` — 3 uzycia, z czego 2 bez `relations`.
#   ★★ ZLECENIE MOWILO „20 z 44" — MOJ POMIAR TO OBALIL. Zmierz to sam i podaj SWOJA liczbe.

# (3) ★ TEZA: wszystkie te pliki sa OSIAGALNE z korzenia aplikacji — to nie jest mina
node scripts/dev/reachability-from-root.mjs > /private/tmp/cx-day352-preview-20-ekranow-artefakty/reach.json 2>/dev/null
node -e 'const r=JSON.parse(require("fs").readFileSync("/private/tmp/cx-day352-preview-20-ekranow-artefakty/reach.json","utf8"));const c=new Map(r.files.map(f=>[f.file,f.classification]));for(const p of ["src/components/CaseWorkspace/CasesListScreen.tsx","src/components/CaseWorkspace/RealizacjaView.tsx","src/components/CaseWorkspace/RezultatyView.tsx","src/components/Audit/method/tabs/AuditFindingsTab.tsx","src/components/Economics/FinanceHub.tsx","src/components/MyWork/MyProjects.tsx"])console.log(p,"→",c.get(p)||"BRAK");'
#   moje liczby: wszystkie SZESC `app`. Ekrany sa zywe, zmiana wygladu jest realna.

# (4) ★★ TEZA: SSOT WYGLADU SAM SOBIE PRZECZY W TYM PUNKCIE — to jest sedno pytania do wlasciciela
bash -c "grep -n 'Relations' docs/ui-standards/TRIADA_KANON.md docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md"
#   oczekiwane: `TRIADA_KANON.md:70` — „Relations: klikalne pigulki **albo** »No relations«" i punkt 29
#   listy czekowania — czyli ZAWSZE; `TABLE_AND_PREVIEW_CANON.md:337` — „Relations (blok 5 TRIADY, **jesli sa**)"
#   — czyli TYLKO GDY SA. ★ Dwa dokumenty, dwa przeciwne wymagania. Zweryfikuj to sam.

# (5) ★ TEZA: pokrycie harnessem jest NIEPELNE i to jest granica tej pracy
node -e 'const s=require("fs").readFileSync("dev-render/main.tsx","utf8");const seg=s.slice(s.indexOf("const SCREENS"));console.log("wpisow w SCREENS:",[...seg.matchAll(/^  \x27([a-z0-9-]+)\x27: \{/gm)].length);'
bash -c "grep -rn 'CasesListScreen\|RealizacjaView\|RezultatyView' dev-render/ | wc -l"
bash -c "grep -n \"'audyty-piec-powierzchni'\" dev-render/main.tsx"
bash -c "grep -n \"'zwornik-projects'\" dev-render/main.tsx"
#   moje liczby: 394 wpisy w SCREENS; **ZERO** trafien CaseWorkspace w calym `dev-render/`;
#   `audyty-piec-powierzchni` obsluguje piec zakladek Audytow parametrem `&tab=`; `zwornik-projects`
#   montuje realny `<MyProjects />`. Z 18 plikow bez `relations` mam pokryte 15, a TRZY (CaseWorkspace)
#   nie maja w harnessie zadnego wejscia.

# (6) ★ TEZA: bezpiecznik pary zrzutow jest DWUWYMIAROWY i ma prog jasnosci 150
bash -c "grep -n 'DEFAULT_LUMA_DIFF_THRESHOLD\|requiresResultMarker' scripts/dev/lib/checkScreenshotPairState.mjs | head"
#   oczekiwane: prog 150 i drugi wymiar (obecnosc markera wyniku w DOM).
#   ★ Para bajtowo identyczna = ZERO dowodu. Suma kontrolna KAZDEGO pliku idzie do raportu.

# (7) ★ TEZA: narzedzie zrzutowe ma opcje, bez ktorych para bedzie klamac
bash -c "grep -n \"arg('rozwin-sekcje'\|arg('klik-po-rozwinieciu'\|arg('osiad-po-rozwinieciu'\|arg('rozwin-w'\|arg('base'\|arg('wyjscie'\" scripts/dev/grafika-zrzuty.mjs"
#   oczekiwane: wszystkie istnieja jako opt-in. `--klik-po-rozwinieciu=1` istnieje dlatego, ze petla
#   rozwijania sekcji ZAMYKALA podglad przed skanem (ekran `execution-tab-list`: tekst 1018 → 648 znakow).
#   ★ Bez tego zrobisz zrzut ekranu BEZ PODGLADU i nie zobaczysz tego, co mierzysz.

# (8) TEZA: bramki i liscie slownikow na markerze
node -e 'const f=require("fs");function c(o){let n=0;const w=v=>{if(v&&typeof v==="object"){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ["pl","en"])console.log(l,c(JSON.parse(f.readFileSync("public/locales/"+l+"/translation.json","utf8"))));'
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35199, en 33066 (★ NIE 35198/33065 — te liczby sa o jeden dzien stare);
#   focus=0, list=0, artefakt=0, reach=0

# (9) zasoby: dysk, porty, kontener
df -h /
lsof -nP -iTCP:6411 -sTCP:LISTEN; lsof -nP -iTCP:5551 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day352 || true
#   oczekiwane: powyzej 5 GB wolnego; oba porty puste; 0 kontenerow.
#   ★ KAZDA para zrzutow to dwa pliki PNG — pilnuj miejsca miedzy ekranami, nie na koncu
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day352-preview-20-ekranow-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6411`. Twój JEDYNY port harnessu to `5551`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day352-pg`**. **ZAKAZANE:** `Zakazane na stale: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajete przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379 — ★★ TO WAZNE WLASNIE DLA CIEBIE: **kanoniczny harness `dev-render` slucha domyslnie na 3020 i ten port NIE JEST TWOJ**. Swoj harness Vite podnosisz na **5551** i kazde wywolanie narzedzia zrzutowego dostaje `--base=http://127.0.0.1:5551`. Rodzenstwo TEJ paczki (04.09 wieczor) — nie dotykasz: 351 (6410/5550), 353 (6412/5552), 354 (6413/5553). ★★ ROWNOLEGLE pisane sa instrukcje 355-358 przez innego autora; ich portow NIE ZNAM w chwili pisania tej instrukcji, wiec obowiazuje regula twarda: **bierzesz WYLACZNIE swoje dwa porty i zaden inny**, a port zajety jest powodem do STOP-u calosci (`Z7`), nigdy do podmiany numeru. Wczesniejsze rodzenstwo 04.09: 343-346 (6390-6393 / 5530-5533), 347 (6394/5534), 348 (6395/5535), 349 (6396/5536), 350 (6397/5537). Twoje wlasne wylacznie: baza 6411, harness 5551. ★ ZAKAZ `pkill`/`killall` — zabijasz wylacznie wlasne PID-y (zapisz `$!` po starcie Vite)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK. Ten dyzur nie dodaje, nie zmienia i nie przelacza ANI JEDNEJ flagi funkcyjnej. ★★ To jest szczegolnie wazne wlasnie tutaj: `Z11` mowi, ze nowe wizualium idzie za flaga `default OFF` — ale **ta zmiana wygladu JUZ WESZLA** (scalona `58d391d65b`), wiec Twoim produktem jest **ZOBACZENIE jej i orzeczenie**, a nie schowanie za flaga. Jezeli uznasz, ze cofniecie albo flaga sa potrzebne — to jest **REKOMENDACJA do `R5`**, nie zmiana, ktora robisz sam`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/check-triada.sh`, `scripts/check-gestosc.sh`, `scripts/check-dev-render-parytet.mjs`, `.husky/pre-commit`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `scripts/dev/grafika-zrzuty.mjs` i `scripts/dev/lib/checkScreenshotPairState.mjs`. Wszystkie NIETYKALNE DO ZAPISU — wolno je wolac w pomiarze, nie wolno ich zmieniac. ★★ Narzedzie zrzutowe wolno **rozszerzyc wylacznie opcja OPT-IN**, jezeli `R2` udowodni, ze inaczej nie da sie zrobic pary — i tylko tak, zeby historyczne wywolania zachowaly sie bit w bit`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY352_PREVIEW_20_EKRANOW_REPORT.md`. Jedyny inny dokument do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — sekcje ida dzis do `Q`, ale rownolegle dopisuje inny autor, wiec litere sprawdzasz komenda `bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"` TUZ PRZED commitem, nigdy z gory. **Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md`** (teren dyzuru 353) ani zadnego dokumentu w `docs/ui-standards/` — **sprzecznosc SSOT opisujesz, nie rozstrzygasz**. ★★ WSZYSTKIE ZRZUTY ida do `evidence/podglad-relations-20260904/` (katalog NIE ISTNIEJE na markerze — tworzysz go) z `git add -f`; ta instrukcja daje na to jawna licencje, wiec „zakaz binariow w repo” byloby wymyslonym powodem (04.09 raz sie zdarzylo). Plik postepu `/private/tmp/cx-day352-postep.md` zyje POZA repo. Nowe pliki w `tests/` wymagaja `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day352-preview-20-ekranow-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day352-preview-20-ekranow-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★★ **ZAKAZ COFNIECIA NAPRAWY DYZURU 349 NA STALE.** Wersje PRZED produkujesz **tymczasowo**, przez `cp` z kopii w `SCRATCH`, i cofasz natychmiast po zrobieniu pary; `git diff -- src/components/standard/StandardPreview.tsx` po cofnieciu ma byc **PUSTY**, a commit tej pozycji **nie moze zawierac** tego pliku. ★★ **ZAKAZ MASOWEJ NAPRAWY DWUDZIESTU SZESCIU EKRANOW** — ten dyzur **oglada i orzeka**, nie dosypuje `relations` do osiemnastu plikow; to bylaby zmiana wygladu na kolejnych ekranach, ktorej znowu nikt by nie widzial. ★★ **ZAKAZ ROZSTRZYGNIECIA SPRZECZNOSCI SSOT WLASNA REKA** — `TRIADA_KANON.md` i `TABLE_AND_PREVIEW_CANON.md` przecza sobie w tym punkcie; **nie zmieniasz zadnego z nich**, stawiasz wlascicielowi jedno pytanie rozstrzygalne. ★★ **ZAKAZ PISANIA WLASNEGO SKRYPTU ZRZUTOWEGO OBOK KANONICZNEGO** — doraznie napisany skrypt dal 04.09 pare identycznych obrazow i zameldowal sukces; brakujaca funkcje dokladasz **narzedziu**, opt-in, z parametrami zapisanymi na trwale. ★★ **ZAKAZ LICZENIA CZEGOKOLWIEK ZE ZRZUTU** — liczebnosc, obecnosc karty i jej tresc czytasz z **uchwytu DOM**, nigdy z obrazu. ★ **ZAKAZ `--retry` innego niz `0`, `.skip`, `.todo` i zmiany asercji, zeby zzielenieć** | Wlasciciel nigdy nie jest pierwszym testerem wizualnym (`CLAUDE.md` pkt 7, powod: zalamanie 07-11), a masowe wlaczanie zmian wizualnych bez ogladania kosztowalo krach 07-12. Zmiana z dyzuru 349 jest poprawna kontraktowo i **weszla juz na zywo** — jedyne, czego brakuje, to czyjes oczy przed oczami wlasciciela. Dodatkowo przyrzad klamie na cztery znane sposoby i jeden z nich (zamkniecie podgladu przed skanem) trafia dokladnie w ten pomiar |

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
cd /private/tmp/cx-day352-preview-20-ekranow

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day352-pg psql -U postgres -d cx352 \
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
cd /private/tmp/cx-day352-preview-20-ekranow

docker run -d --name cx-day352-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx352 \
  -p 127.0.0.1:6411:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day352-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6411/cx352 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6411/cx352 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day352-preview-20-ekranow && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6411/cx352 \
JWT_SECRET=cx352-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Jednostkowe kontrakty podgladu: z roota, wariant (C) `RUN_DB_TESTS=0 MOCK_DB=true`, sciezki `src/components/shared/__tests__/standardPreview.r03.test.tsx src/components/standard/__tests__ tests/unit` — **uruchamiasz, zeby udowodnic brak regresji**, i **nie naprawiasz** tego, co czerwone z powodow spoza tego dyzuru. Nowe kontrakty tego dyzuru kladziesz w `tests/`, NIGDY pod `src/`. **Kazdy przelot z `--retry=0` i `--reporter=json --outputFile=<plik w ARTEFAKTY>`; `No test files found` i `Transform failed` to BLAD KOMENDY, nie `PASS`** --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day352-preview-20-ekranow-artefakty/day352-preview-relations.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day352-preview-20-ekranow && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Jednostkowe kontrakty podgladu: z roota, wariant (C) `RUN_DB_TESTS=0 MOCK_DB=true`, sciezki `src/components/shared/__tests__/standardPreview.r03.test.tsx src/components/standard/__tests__ tests/unit` — **uruchamiasz, zeby udowodnic brak regresji**, i **nie naprawiasz** tego, co czerwone z powodow spoza tego dyzuru. Nowe kontrakty tego dyzuru kladziesz w `tests/`, NIGDY pod `src/`. **Kazdy przelot z `--retry=0` i `--reporter=json --outputFile=<plik w ARTEFAKTY>`; `No test files found` i `Transform failed` to BLAD KOMENDY, nie `PASS`** --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day352-preview-20-ekranow-artefakty/day352-preview-relations.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day352-preview-20-ekranow/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day352-pg psql -U postgres -d cx352 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day352-pg`.
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
> **(e) ★★★ **SZESC PULAPEK TEGO DYZURU — kazda zmierzona, kazda kosztowala dzien.** **(1) PRZYRZAD ZAMYKA PODGLAD PRZED SKANEM.** Petla `--rozwin-sekcje=1` klika lejki i kebaby jak „zwiniete sekcje”, a klik w rog (2,2) zamykajacy ich nakladki **zamyka takze podglad otwarty klikiem w wiersz** — na ekranie `execution-tab-list` tekst spadl z 1018 do 648 znakow, a naruszenie w podgladzie po prostu znikalo. **Bez `--klik-po-rozwinieciu=1` zrobisz zrzut BEZ PODGLADU** — czyli bez rzeczy, ktora mierzysz. **(2) BEZPIECZNIK PARY NAGRADZA DEFEKT.** `checkScreenshotPairState.mjs` ma prog roznicy jasnosci 150 i **im wiekszy defekt (wyscig klik→zrzut), tym latwiej para go przechodzi**; dlatego drugi wymiar (obecnosc markera wyniku w DOM) jest obowiazkowy, a suma kontrolna KAZDEGO pliku idzie do raportu. **Para bajtowo identyczna = ZERO dowodu.** **(3) PRZYRZAD POKAZUJE NIE PRODUKT.** 29 ocenionych ekranow pokazalo kiedys kompozycje, ktorej w aplikacji nie ma — host harnessu nie jest produktem. Zanim orzekniesz „wyglada zle”, porownaj lancuch przodkow karty w harnessie i w realnej trasie; roznica wysokosci albo szerokosci moze byc wlasnoscia przyrzadu. **(4) TRZY EKRANY NIE MAJA W HARNESSIE ZADNEGO WEJSCIA** — `CaseWorkspace/CasesListScreen.tsx`, `RealizacjaView.tsx`, `RezultatyView.tsx` (7 z 26 uzyc). To jest **granica dowodu, ktora nazywasz wprost**, a nie powod do STOP-u; masz do wyboru dopisanie wpisu do `dev-render/main.tsx` (licencja w tabeli) albo STOP MERYTORYCZNY z briefem dla tych trzech. **(5) PIEC ZAKLADEK AUDYTOW SIEDZI POD JEDNYM WPISEM** `audyty-piec-powierzchni` z parametrem `&tab=library|processes|outputs|reports|initiatives` — jezeli zrobisz jeden zrzut zamiast pieciu, zmierzysz probke i oglosisz ja zbiorem. **(6) DEV-RENDER SLUCHA DOMYSLNIE NA 3020, KTORY NIE JEST TWOJ** — podnosisz Vite na **5551** i kazde wywolanie narzedzia dostaje `--base=http://127.0.0.1:5551`; zapisz `$!` procesu, bo `pkill` jest zakazany**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day352-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day352-preview-20-ekranow-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (wlasny pomiar: ile uzyc, w ilu plikach, ktore osiagalne, ktore pokryte harnessem) · R2 (pary PRZED/PO dla WSZYSTKICH pokrytych ekranow, light+dark, rozne sumy kontrolne) · R3 (obejrzenie i orzeczenie per ekran: wyglada dobrze / wyglada zle, z uzasadnieniem)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6411` albo `5551` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6411` albo `5551`** (`Z7`).

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

Dyżur 349 (scalony, `4f01d13012`) dostał zadanie naprawienia czterech czerwonych kontraktów UI
i wykonał je **uczciwie** — z produktu, bez wyciszania testów, bez osłabiania asercji. Jedna
z tych napraw dotyczyła `src/components/standard/StandardPreview.tsx` i wygląda tak
(commit `58d391d65b`):

```
-  const footer =
-    ai || relations || actionRows.length > 0 || whatsNext ? (
+  const footer = (
       <div className="space-y-2.5">
         {ai ? <PreviewAIHintStrip {...ai} /> : null}
-        {relations ? (
-          <PreviewRelations items={relations} emptyLabel={…} />
-        ) : null}
+        <PreviewRelations items={relations ?? []} emptyLabel={…} />
```

**Skutek, którego zlecenie dyżuru 349 nie obejmowało:** stopka podglądu renderuje się teraz
**zawsze**, a każdy ekran, który nie podaje `relations`, dostał **kartę „Brak powiązań"**.
To jest **realna zmiana wyglądu na kilkunastu żywych ekranach, której nikt nie oglądał**.

**★ To nie jest zarzut wobec dyżuru 349.** Zmiana jest zgodna z jednym z dwóch dokumentów kanonu
i naprawia realny kontrakt. Brakuje wyłącznie **czyichś oczu** — bo reguła nr 7 `CLAUDE.md` jest
nienaruszalna: **właściciel NIGDY nie jest pierwszym testerem wizualnym.**

### ★ Drugie dno: SSOT wyglądu sam sobie przeczy w tym punkcie

To jest część merytoryczna dyżuru i najcenniejsza rzecz, jaką możesz z niego wynieść.

| Dokument | Co mówi o bloku 5 | Wniosek |
| --- | --- | --- |
| `docs/ui-standards/TRIADA_KANON.md:70` | „**Relations:** klikalne pigułki **albo** »No relations«." | karta **ZAWSZE**, także pusta |
| `docs/ui-standards/TRIADA_KANON.md:132` (lista czekowania, pkt 29) | „Relations **albo** »No relations«" | karta **ZAWSZE** |
| `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md:337` | „**Relations** (blok 5 TRIADY, **jeśli są**)" | karta **TYLKO GDY SĄ** |

Dwa dokumenty kanonu, dwa przeciwne wymagania, jedna zmiana kodu, która wybrała jedno z nich.
**Tego nie rozstrzygasz sam** (`Z14`, `Z40`) — i nie zmieniasz żadnego z tych dokumentów.
Stawiasz właścicielowi **jedno pytanie rozstrzygalne**, poparte zrzutami, w `R5`.

---

## ★ Sprostowanie zlecenia — co mój pomiar na markerze skorygował

Zlecenie mówiło: „**20 z 44** ekranów `StandardPreview` nie podaje `relations`".
**Zmierzyłem to na markerze i obie liczby są inne.**

Metoda, którą policzyłem (i którą masz powtórzyć **własnym** narzędziem): usunąć komentarze
`/* */` i `//`, znaleźć każde otwarcie tagu `<StandardPreview`, przeczytać blok atrybutów
**do domykającego `>` z uwzględnieniem zagnieżdżonych klamer**, i sprawdzić, czy zawiera
`relations=`.

**Dlaczego to ma znaczenie:** naiwny `grep -rl '<StandardPreview'` daje 49 plików, ale
**dwa trafienia to zdania w blokach komentarza** (`src/views/vault/VaultDocumentsView.tsx` ok. 20,
`src/components/assessment/AssessmentHub.tsx` ok. 2696 — oba opisują komponent, nie renderują go).
Policzenie ich jako ekranów zawyża wynik i wysyła Cię po zrzuty ekranów, które karty nie mają.

**Moje liczby, do zweryfikowania:**

| Co | Moja liczba |
| --- | --- |
| Użycia JSX `<StandardPreview>` w `src/` (bez testów, bez samego komponentu, bez komentarzy) | **53** w **39** plikach |
| Z tego **podaje** `relations=` | **27** |
| Z tego **NIE podaje** `relations=` | **26**, w **18** plikach |
| Klasyfikacja osiągalności tych 18 plików | **wszystkie `app`** — ekrany są żywe |
| Użycia w `dev-render/` | **3**, z czego **2** bez `relations` |
| Wpisy w rejestrze `SCREENS` harnessu | **394** |
| Z 18 plików: pokryte harnessem | **15** (9 wprost, 5 zakładek Audytów przez `audyty-piec-powierzchni&tab=…`, `MyProjects` przez `zwornik-projects`) |
| Z 18 plików: **bez żadnego wejścia w harnessie** | **3** — cały `CaseWorkspace` (`CasesListScreen`, `RealizacjaView`, `RezultatyView`), łącznie **7** z 26 użyć |

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

---

## ★ Zmierz moje liczby sam

Twierdzę: użyć `<StandardPreview>` w `src/` jest **53** w **39** plikach; bez `relations` — **26**
w **18** plikach; wszystkie te pliki mają klasyfikację **`app`**; w `dev-render/` są **3** użycia,
**2** bez `relations`; rejestr `SCREENS` ma **394** wpisy; `CaseWorkspace` ma **0** trafień w całym
katalogu `dev-render/`; próg różnicy jasności bezpiecznika pary to **150**; `StandardPreview.tsx`
ma **548** linii; liście `public/locales/pl/translation.json` = **35199**, `en` = **33066**.

**Każdą z tych liczb policz sam. Przepisanie mojej liczby jest zawyżeniem i podstawą odrzucenia
raportu (`Z24`).** Wszystkie grepy uruchamiaj przez `bash -c "…"` — `grep --include` w `zsh`
zwraca pustkę zamiast wyniku, a **pustka nie jest wynikiem, dopóki nie sprawdzisz, że polecenie
się wykonało**.

---

## B.1. TABELA LICENCJI — CAŁA ŚCIEŻKA: KOMPONENT · WOŁACZE · HARNESS · NARZĘDZIE · DOWODY

> **★★ ZASTRZEŻENIE.** Poniższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz, jest
> opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi« jest
> NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, a Twoim produktem
> jest opis + brief, **nie zatrzymanie dyżuru**.

| Warstwa | Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- | --- |
| **komponent podglądu** | `src/components/standard/StandardPreview.tsx` | **★ WĄSKA LICENCJA — WYŁĄCZNIE TYMCZASOWA MUTACJA NA CZAS ZRZUTU „PRZED", cofana przez `cp` ze `SCRATCH` natychmiast po zrobieniu pary.** `git diff` na tym pliku po cofnięciu **PUSTY**; plik **nie może wystąpić w żadnym commicie tego dyżuru**. ZAKAZ trwałej zmiany zachowania (`Z40`) | Zrzut „PRZED" produkujesz z `git show 58d391d65b~1:src/components/standard/StandardPreview.tsx` zapisanego do `SCRATCH`; jeśli i to zawiedzie — opisujesz w raporcie i robisz same „PO" z adnotacją, **pozycja jest ZROBIONA** |
| **osiemnaście wołaczy podglądu** | `src/components/Audit/method/tabs/**`, `src/components/CaseWorkspace/**`, `src/components/Economics/FinanceHub.tsx`, `src/components/MyWork/MyProjects.tsx`, `src/components/ReportBuilder/**`, `src/components/ResultsVNext/**`, `src/components/SuperAdmin/ModelRegistry/**`, `src/components/assessment/library/**`, `src/views/superadmin/**` | **TYLKO ODCZYT.** ★★ **ZAKAZ dosypywania `relations` do tych plików** — to byłaby zmiana wyglądu na kolejnych osiemnastu ekranach, której znowu nikt by nie widział, i wyprzedzenie decyzji właściciela z `R5` | Wpis do raportu: plik, linia, jak wygląda karta, **gotowa rekomendacja jako diff w bloku kodu, nienałożony**. Pozycja idzie dalej |
| **rejestr ekranów harnessu** | `dev-render/main.tsx` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisanie NOWYCH wpisów do `SCREENS` dla ekranów, które nie mają żadnego wejścia** (`CaseWorkspace`). ZAKAZ zmiany i usuwania wpisów zastanych, zakaz zmiany kolejności | Jeżeli wpis wymagałby przebudowy — **STOP MERYTORYCZNY z briefem dla tych trzech ekranów**, reszta pracy idzie dalej. Pozycja jest **ZROBIONA** z takim briefem |
| **nowe ekrany harnessu** | `dev-render/screens/**` (**NOWE pliki**) | **★ PEŁNA LICENCJA.** Ekran harnessu **montuje REALNY komponent produktu z mock-danymi**, nigdy nie odtwarza go od nowa (wzór: `dev-render/screens/zwornik-projects.tsx`, który importuje `<MyProjects />` z `src/`) | — |
| **narzędzie zrzutowe** | `scripts/dev/grafika-zrzuty.mjs` | **TYLKO ODCZYT domyślnie.** **★ WĄSKA LICENCJA WARUNKOWA:** jeżeli `R2` udowodni, że pary nie da się zrobić istniejącymi opcjami — wolno dodać **jedną opcję OPT-IN**, tak żeby historyczne wywołania zachowały się **bit w bit**. ★★ **ZAKAZ pisania własnego skryptu zrzutowego obok** (`Z40`) | Opis w raporcie: czego zabrakło, jaka byłaby opcja, i **gotowy diff nienałożony** |
| **bezpiecznik pary** | `scripts/dev/lib/checkScreenshotPairState.mjs`, `scripts/dev/lib/meanLuma.mjs` | **TYLKO ODCZYT — `Z18`** | Opis w raporcie: co bezpiecznik przepuścił i dlaczego jest to niebezpieczne |
| **SSOT wyglądu** | `docs/ui-standards/TRIADA_KANON.md`, `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md`, `docs/ui-standards/02-components/families/UI-PREVIEW-01/STANDARD.md` | **TYLKO ODCZYT — BEZWZGLĘDNIE** (`Z14`). Sprzeczność między nimi **opisujesz, nie rozstrzygasz** | **Wpis `DO DECYZJI WŁAŚCICIELA`** z cytatami obu zdań, numerami wierszy i zdaniem „czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie". Pozycja **ZROBIONA** |
| **kontrakty podglądu (ZASTANE)** | `src/components/shared/__tests__/standardPreview.r03.test.tsx`, `src/components/standard/__tests__/**`, `src/components/shared/__tests__/tablePreviewGeometry.r03-2.test.tsx` | **TYLKO ODCZYT — uruchamiasz, nie naprawiasz.** Czerwień z powodów spoza tego dyżuru zapisujesz **z pełnymi nazwami przypadków** i idziesz dalej | Wynik przelotu w raporcie z `numTotalTests` i pełnymi nazwami |
| **kontrakty (NOWE)** | `tests/unit/preview/**` (**NOWE**) | **★ PEŁNA LICENCJA**, `git add -f`. **★ NOWE PLIKI TESTOWE kładziesz w `tests/`, NIGDY pod `src/`** — plik testowy pod `src/` czerwieni `node scripts/dev/reachability-from-root.mjs --check-baseline` (zdarzyło się 04.09 trzy razy) | — |
| **dowody i zrzuty** | `evidence/podglad-relations-20260904/**` (**NOWY**) | **★ PEŁNA LICENCJA, `git add -f` — DOTYCZY TO TAKŻE PLIKÓW PNG.** ★★ 04.09 trzykrotnie trzeba było ratować dowody z katalogów tymczasowych, a raz dyżur powołał się na **nieistniejący „zakaz binariów"**. Ta instrukcja daje licencję na `evidence/` — **zrzuty mają tam trafić** | — |
| **cudze dowody** | `evidence/grafika/**`, `evidence/day349/**`, `evidence/g19/**` | **TYLKO ODCZYT — CUDZE DOWODY.** ZAKAZ nadpisania | Twoje artefakty idą do własnego katalogu |
| **rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **★ WĄSKA LICENCJA — WYŁĄCZNIE dopisanie JEDNEJ nowej sekcji o pierwszej wolnej literze** | — |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY352_PREVIEW_20_EKRANOW_REPORT.md` (**NOWY**) | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **TYLKO ODCZYT — teren dyżuru 353** | Wpis do raportu, **nie zmieniasz stanu** |
| **bramki i infra testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.husky/pre-commit`, `scripts/check-*.sh`, `scripts/check-dev-render-parytet.mjs` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie: co blokuje pomiar, jaka byłaby zmiana, jak obszedłeś to zmiennymi w linii komendy. Pozycja **ZROBIONA** |
| **cudzy teren** | `server/**` i `src/services/**drdViz**` — **teren dyżuru 351**; `evidence/g19/**`, `modules/**` — **teren dyżuru 353**; `src/components/DiscoveryTools/**`, `src/toolPacks/**`, `src/components/Discovery/**` — **teren dyżuru 354** | **TYLKO ODCZYT** | Wpis do raportu z gotową rekomendacją jako diff, nienałożony |
| — | **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

**Jedna pozycja = jeden wiersz = jeden commit = jeden werdykt. Commit robisz PO KAŻDEJ pozycji,
push na `github-backup` po pierwszym commicie i po każdej kolejnej (`Z34a`).**

| Pozycja | Nazwa | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Własny pomiar: ile użyć, w ilu plikach, które osiągalne, które pokryte harnessem | TAK | NIE — dowód: pomiar jest odczytem, nie dotyka żadnego pliku produktu | bazowe | Tabela: `plik:linia` · `relations` TAK/NIE · klasyfikacja osiągalności · **wpis w `SCREENS`, który ten ekran montuje** (albo „BRAK") + **własne liczby**; licznik usuwa komentarze i czyta blok atrybutów do domykającego `>` | własny licznik w `node` + `node scripts/dev/reachability-from-root.mjs` | `docs(day352): inwentarz podgladow bez relations (352 R1)` |
| R2 | **RDZEŃ: pary PRZED/PO dla WSZYSTKICH pokrytych ekranów, light+dark** | TAK | NIE — dowód: „PRZED" powstaje z tymczasowej kopii, cofanej przez `cp`; commit nie zawiera `StandardPreview.tsx` | n/d | Dla każdego pokrytego ekranu **cztery pliki** (PRZED-light, PRZED-dark, PO-light, PO-dark) w `evidence/podglad-relations-20260904/`; **żadna para nie ma identycznej sumy kontrolnej**; `shasum -a 256` i średnia jasność każdego pliku w raporcie; **obecność karty czytana z uchwytu DOM**, nie z obrazu | `node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5551 --ekrany=… --katalog=… --faza=PRZED\|PO --rozwin-sekcje=1 --klik-po-rozwinieciu=1 --osiad-po-rozwinieciu=800` | `evidence(day352): pary PRZED/PO kart Brak powiazan (352 R2)` |
| R3 | **RDZEŃ: obejrzenie i orzeczenie per ekran** | TAK | NIE | n/d | Lista **wszystkich** ekranów z `R2` podzielona na `WYGLĄDA DOBRZE` / `WYGLĄDA ŹLE`, **każdy z jednozdaniowym uzasadnieniem odnoszącym się do konkretnego zrzutu**; osobno wskazane ekrany, gdzie karta **zabiera miejsce potrzebne treści** | odczyt własnych zrzutów + wysokości bloków z uchwytu DOM | `docs(day352): orzeczenie per ekran na parach PRZED/PO (352 R3)` |
| R4 | Trzy ekrany bez wejścia w harnessie: wpis albo brief | NIE | NIE | n/d | Dla `CaseWorkspace` albo **nowy wpis `SCREENS` + para zrzutów**, albo **STOP MERYTORYCZNY z briefem**: czego zabrakło, ile pracy potrzeba, jaki byłby wpis. **Oba wyniki są pełnowartościowe** | `bash -c "grep -rn 'CaseWorkspace' dev-render/"` | `feat(dev-render): wejscie harnessu dla CaseWorkspace (352 R4)` |
| R5 | Rekomendacja + **JEDNO pytanie rozstrzygalne do właściciela** | NIE | NIE | n/d | Rekomendacja oparta na `R3`; **cytaty obu sprzecznych zdań SSOT z numerami wierszy**; pytanie w formie „tak"/„nie"; wpis `DO DECYZJI WŁAŚCICIELA` ze zdaniem „czego konkretnie mi zabrakło, żeby rozstrzygnąć samodzielnie" | — | `docs(day352): rekomendacja i pytanie o pusty blok Relations (352 R5)` |
| R6 | Raport | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" **niepusta** | — | `docs(day352): raport` |

> **Kolumna „Wymaga plików przekrojowych?" jest wypełniona dla KAŻDEJ pozycji, z dowodem przy
> odpowiedzi `NIE`.** Jedynym plikiem przekrojowym w promieniu jest `StandardPreview.tsx` —
> i **żaden commit tego dyżuru nie ma prawa go zawierać**; mutacja jest tymczasowa i cofana przez
> `cp`. Jeśli uznasz, że musi być trwała — produktem jest gotowy diff **nienałożony** + brief,
> a pozycja jest **ZROBIONA**.

---

## B.3. TABELA MIANOWNIKÓW

**Każdą z tych liczb mierzysz sam (`Z24`) i podajesz swoją. Wszystkie komendy uruchamiasz
w `bash`, nigdy w `zsh`.**

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Użycia JSX `<StandardPreview>` w `src/`, bez testów, bez komentarzy | 53 w 39 plikach | własny licznik `node`: usuń `/* */` i `//`, znajdź `<StandardPreview` niepoprzedzone znakiem słowa, czytaj do `>` na zerowej głębokości klamer | **TAK — i to jest jedyny poprawny mianownik.** `grep -rl` daje 49 plików, w tym **dwa komentarze**; policzenie ich zawyża wynik |
| 2 | Z tego bez `relations=` | 26 w 18 plikach | jw., filtr `!/\brelations\s*=/` na bloku atrybutów | TAK — **to jest mianownik pozycji `R2`** |
| 3 | Klasyfikacja osiągalności tych 18 plików | wszystkie `app` | `node scripts/dev/reachability-from-root.mjs` + filtr po `file` | TAK — rozstrzyga, czy zmiana jest żywa, czy jest miną |
| 4 | Użycia w `dev-render/` | 3, w tym 2 bez `relations` | jw., ścieżka `dev-render/` | TAK — harness też pokazuje kartę i to trzeba wiedzieć, czytając zrzut |
| 5 | Wpisy w rejestrze `SCREENS` | 394 | `node -e '…matchAll(/^  \x27([a-z0-9-]+)\x27: \{/gm)…'` na `dev-render/main.tsx` | TAK — mianownik pokrycia harnessem |
| 6 | Pliki z 18 **bez żadnego wejścia** w harnessie | 3 (cały `CaseWorkspace`) | `bash -c "grep -rn 'CasesListScreen\\\|RealizacjaView\\\|RezultatyView' dev-render/"` | **TAK — pustka tu jest wynikiem tylko dlatego, że komenda się wykonała; sprawdź kod wyjścia** |
| 7 | Zakładki Audytów pod jednym wpisem `audyty-piec-powierzchni` | 5 (`&tab=library\|processes\|outputs\|reports\|initiatives`) | `bash -c "grep -n -A3 \\"'audyty-piec-powierzchni'\\" dev-render/main.tsx"` | TAK — **jeden zrzut zamiast pięciu to próbka ogłoszona zbiorem** |
| 8 | Próg różnicy jasności bezpiecznika pary | 150 | `bash -c "grep -n 'DEFAULT_LUMA_DIFF_THRESHOLD' scripts/dev/lib/checkScreenshotPairState.mjs"` | TAK — i **im większy defekt, tym łatwiej para go przechodzi**; dlatego drugi wymiar jest obowiązkowy |
| 9 | Linie `StandardPreview.tsx` | 548 | `wc -l src/components/standard/StandardPreview.tsx` | TAK — kontrola, że czytasz ten plik, o którym mówi instrukcja |
| 10 | Liście `translation.json` | pl 35199 / en 33066 | `node -e 'const f=require("fs");function c(o){let n=0;const w=v=>{if(v&&typeof v==="object"){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ["pl","en"])console.log(l,c(JSON.parse(f.readFileSync("public/locales/"+l+"/translation.json","utf8"))));'` | TAK — **liczba nie może zmaleć** |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `evidence/podglad-relations-20260904/**` (w tym **pliki PNG**) | NOWY | R2/R3 | ZEROWE — **twój** katalog dowodów, `git add -f` |
| 2 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY352_PREVIEW_20_EKRANOW_REPORT.md` | NOWY | R6 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `dev-render/main.tsx` | R4 | Wyłącznie **dopisanie** nowych wpisów `SCREENS` dla `CaseWorkspace`; zero zmian we wpisach zastanych. ★ Sprawdź `scripts/check-dev-render-parytet.mjs` przed commitem |
| `dev-render/screens/case-workspace-*.tsx` (NOWE) | R4 | Ekran **montuje realny komponent produktu** z mock-danymi; zero re-implementacji |
| `scripts/dev/grafika-zrzuty.mjs` | R2 | Wyłącznie **jedna opcja OPT-IN**, i tylko gdy `R2` udowodni, że bez niej pary nie da się zrobić; historyczne wywołania bit w bit bez zmian |
| `tests/unit/preview/**` (NOWE) | R3 | `git add -f`; test broni **ZACHOWANIA** (karta jest/nie ma jej przy pustych `relations`), nie literału klasy CSS |
| `docs/program/REJESTR_ZNALEZISK_20260903.md` | R5 | Jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
src/components/standard/StandardPreview.tsx              — mutacja TYMCZASOWA, git diff po cofnieciu PUSTY,
                                                            plik nie moze wystapic w ZADNYM commicie
src/components/Audit/method/tabs/**                      — 18 wolaczy: TYLKO ODCZYT, zakaz dosypywania relations
src/components/CaseWorkspace/**                          — jw.
src/components/Economics/FinanceHub.tsx                  — jw.
src/components/MyWork/MyProjects.tsx                     — jw.
src/components/ReportBuilder/**                          — jw.
src/components/ResultsVNext/**                           — jw.
src/components/SuperAdmin/ModelRegistry/**               — jw.
src/components/assessment/library/**                     — jw.
src/views/superadmin/**                                  — jw.
src/components/shared/PreviewPane/**                     — PreviewRelations, wspolny komponent
docs/ui-standards/**                                     — SSOT wygladu, Z14: opisujesz sprzecznosc, nie rozstrzygasz
scripts/dev/lib/checkScreenshotPairState.mjs             — bezpiecznik pary, Z18
tests/setup.ts, tests/helpers/**, tests/__mocks__/**     — Z18
vitest*.config.ts, server/vitest.config*.ts              — Z18
.husky/pre-commit, scripts/check-*.sh                    — bramki, Z18
docs/program/waves/WAVE_03_ACCEPTANCE/modules/**         — macierz odbioru, teren dyzuru 353
evidence/grafika/**, evidence/day349/**, evidence/g19/** — CUDZE dowody
server/**                                                — ten dyzur nie dotyka serwera; teren dyzuru 351
src/components/DiscoveryTools/**, src/toolPacks/**       — teren dyzuru 354
server/migrations/**                                     — przedzial NIEPRZYDZIELONY
public/locales/**                                        — ten dyzur nie dodaje kluczy
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6411 | `lsof -nP -iTCP:6411 -sTCP:LISTEN` → puste (zmierzone przy pisaniu instrukcji na markerze `c0f690bae3`). ★ Podnosisz go **tylko jeśli ekran harnessu tego wymaga**; nieużycie jest poprawnym wynikiem |
| Port harnessu | 5551 | `lsof -nP -iTCP:5551 -sTCP:LISTEN` → puste. ★★ **Vite podnosisz na 5551, NIE na domyślnym 3020** — 3020 należy do toru grafiki; każde wywołanie narzędzia dostaje `--base=http://127.0.0.1:5551` |
| Nazwa kontenera | `cx-day352-pg` | `docker ps -a --format '{{.Names}}' \| grep cx-day352` → brak |
| Nazwa bazy | `cx352` | n/d |
| **Przedział migracji** | **NIEPRZYDZIELONY** — dyżur nie dodaje migracji | Potrzeba migracji = **STOP MERYTORYCZNY z briefem** |
| Gałąź | `codex/day352-preview-20-ekranow-20260904` | nie istnieje na `github-backup` (sprawdzone) |
| Worktree | `/private/tmp/cx-day352-preview-20-ekranow` | nie istnieje (sprawdzone) |
| Flagi funkcyjne | **ŻADNA NOWA i żadna zmieniona** | `bash -c "grep -rn 'relations' .env* docker-compose* railway* 2>/dev/null"` → 0 trafień na markerze |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day352-preview-20-ekranow
git diff --name-only --cached | tee /private/tmp/cx-day352-preview-20-ekranow-artefakty/staged.txt

# ★★ NAJWAZNIEJSZA KONTROLA TEGO DYZURU: komponent podgladu NIE MOZE trafic do commita
grep -c 'src/components/standard/StandardPreview.tsx' /private/tmp/cx-day352-preview-20-ekranow-artefakty/staged.txt
#   oczekiwane: 0 — jesli 1, COFNIJ (git restore --staged) i przywroc plik przez cp ze SCRATCH

grep -iE 'components/Audit/|components/CaseWorkspace/.*\.tsx|Economics/FinanceHub|MyWork/MyProjects|ReportBuilder/|ResultsVNext/|SuperAdmin/ModelRegistry|assessment/library/|views/superadmin/|shared/PreviewPane/|docs/ui-standards/|checkScreenshotPairState|tests/setup|tests/helpers|tests/__mocks__|vitest.*config|\.husky/|scripts/check-|waves/WAVE_03_ACCEPTANCE/modules/|evidence/grafika/|evidence/day349/|evidence/g19/|^server/|components/DiscoveryTools/|toolPacks/|server/migrations/|public/locales/' \
  /private/tmp/cx-day352-preview-20-ekranow-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged <plik>)" \
  || echo "rozlacznosc OK"

# ★ dowody MAJA byc w repo — takze PNG:
git diff --name-only --cached | grep -c '^evidence/podglad-relations-20260904/'
#   oczekiwane przy commicie R2: co najmniej 4 (dwie pary)

# ★ NOWY plik testowy pod src/ czerwieni bezpiecznik osiagalnosci:
git diff --name-only --cached --diff-filter=A | grep -E '^src/.*\.(test|spec)\.(ts|tsx)$' \
  && echo "★★ NOWY TEST POD src/ — PRZENIES DO tests/" || echo "testy we wlasciwym miejscu"
```

---

## R1 — WŁASNY POMIAR: ILE, GDZIE, CZY ŻYWE, CZY WIDOCZNE W HARNESSIE

**Ta pozycja nie robi ani jednego zrzutu.** Ma zamienić liczbę „20 z 44" na Twój własny,
policzalny mianownik — i **rozstrzygnąć, ile z tego w ogóle da się zobaczyć**.

**(a) Napisz własny licznik.** Nie `grep -rl`. Licznik ma: usunąć komentarze `/* */` i `//`,
znaleźć każde `<StandardPreview` **niepoprzedzone znakiem słowa**, przeczytać blok atrybutów
**do domykającego `>` na zerowej głębokości klamer**, i sprawdzić `relations=`.
**Dwa trafienia w repo to zdania w komentarzach** — jeśli je policzysz, wyślesz się po zrzuty
ekranów, które karty nie mają.

**(b) Tabela inwentarza.** `plik:linia` · `relations` TAK/NIE · klasyfikacja z
`scripts/dev/reachability-from-root.mjs` · **wpis `SCREENS`, który ten ekran montuje** (albo
jawne „BRAK"). Kolumna czwarta jest tu najważniejsza: **to ona wyznacza, ile par da się zrobić.**

**(c) Trzy grupy pokrycia, wypisane imiennie:**
1. ekrany z **własnym** wpisem `SCREENS` — zrzut wprost;
2. ekrany pod **wspólnym** wpisem z parametrem (u mnie: pięć zakładek Audytów pod
   `audyty-piec-powierzchni&tab=…`) — **pięć osobnych zrzutów, nie jeden**; obejrzenie dwóch
   i ogłoszenie tego stanem pięciu to „próbka zamiast zbioru";
3. ekrany **bez żadnego wejścia** (u mnie: cały `CaseWorkspace`) — idą do `R4`.

Prawo zatrzymania po tej pozycji.

## R2 — RDZEŃ: PARY PRZED/PO, LIGHT I DARK, DLA WSZYSTKICH POKRYTYCH EKRANÓW

**„PRZED" nie jest wspomnieniem — jest plikiem.** Produkujesz go tak:

1. `cp src/components/standard/StandardPreview.tsx <SCRATCH>/StandardPreview.PO.tsx` — kopia
   zapasowa stanu bieżącego (`Z27`, **nigdy `git stash`**: schowek jest współdzielony między
   wszystkimi worktree tego repozytorium);
2. `git show 58d391d65b~1:src/components/standard/StandardPreview.tsx > <SCRATCH>/StandardPreview.PRZED.tsx`;
3. `cp <SCRATCH>/StandardPreview.PRZED.tsx src/components/standard/StandardPreview.tsx` — mutacja
   **tymczasowa**;
4. komplet zrzutów `--faza=PRZED`;
5. `cp <SCRATCH>/StandardPreview.PO.tsx src/components/standard/StandardPreview.tsx` — **cofnięcie**;
6. `git diff -- src/components/standard/StandardPreview.tsx` → **PUSTY**. Wynik tej komendy
   wklejasz do raportu dosłownie;
7. komplet zrzutów `--faza=PO`.

**★ Kolejność ma znaczenie.** Jeżeli zrobisz najpierw wszystkie „PO", a potem zmutujesz plik
i zapomnisz cofnąć, mutacja wejdzie do commita. Kontrola z `B.4.5` łapie to, ale taniej jest
nie dopuścić.

**Wymagania dla każdego zrzutu:**

- **`--base=http://127.0.0.1:5551`** — Twój harness, nie domyślne 3020;
- **`--rozwin-sekcje=1` i `--klik-po-rozwinieciu=1`.** ★★ Bez drugiego z nich pętla rozwijania
  **zamknie podgląd** kliknięciem w róg zamykającym nakładki filtrów — i zrobisz zrzut ekranu
  **bez podglądu**, czyli bez rzeczy, którą mierzysz. Na ekranie `execution-tab-list` tekst spadł
  wtedy z 1018 do 648 znaków;
- **`--osiad-po-rozwinieciu=800`** (albo więcej) — bloki mają `fade-in`, a skan w połowie
  przejścia `opacity` daje fałszywy kontrast;
- **oba motywy** (`--motywy=light,dark`);
- **`shasum -a 256` i średnia jasność KAŻDEGO pliku** w raporcie. **Para bajtowo identyczna
  = ZERO dowodu**; to jest kształt „duplikat zamiast motywu" — ten sam obraz pod dwiema nazwami;
- **★★ obecność karty „Brak powiązań", jej wysokość i liczebność pigułek czytasz z UCHWYTU DOM**
  (`data-preview-block`, selektor karty Relations), **nigdy ze zrzutu**. Obraz jest ilustracją,
  DOM jest dowodem.

**★ Bezpiecznik pary jest dwuwymiarowy i nagradza defekt.** Sam próg jasności (150) przepuszcza
parę tym łatwiej, im większy jest wyścig klik→zrzut. Dlatego drugi wymiar — obecność
charakterystycznego elementu w DOM w **obu** wariantach — jest obowiązkowy, a jego wynik idzie
do raportu razem z sumami.

**Jeżeli któregoś ekranu nie da się zrzucić istniejącymi opcjami narzędzia** — masz wąską
licencję na **jedną opcję opt-in** (`B.1`). ★★ **Nie piszesz własnego skryptu obok** — 04.09
doraźny skrypt dał parę identycznych obrazów i zameldował sukces.

Prawo zatrzymania po tej pozycji.

## R3 — RDZEŃ: OBEJRZENIE I ORZECZENIE PER EKRAN

**Tu przestajesz mierzyć i zaczynasz patrzeć.** To jest jedyna pozycja tego dyżuru, której nie
da się zrobić komendą.

Dla **każdego** ekranu z `R2` jeden wiersz: `WYGLĄDA DOBRZE` albo `WYGLĄDA ŹLE`, z **jednym
zdaniem uzasadnienia odnoszącym się do konkretnego zrzutu**. Osobno, jawnie, wskaż ekrany,
na których **pusta karta zabiera miejsce potrzebne treści** — bo to jest realny koszt, a nie
kwestia gustu.

**★ Zanim orzekniesz „wygląda źle", sprawdź, czy nie oglądasz przyrządu.** Host harnessu nie
jest produktem: 29 ocenionych ekranów pokazywało kiedyś kompozycję, której w aplikacji nie ma,
i jednemu z nich właściciel wystawił piątkę za regresję. Jeżeli defekt polega na wysokości,
szerokości albo przycięciu — **porównaj łańcuch przodków karty w harnessie i w realnej trasie**
i napisz, co sprawdziłeś.

**★ „Wygląda dobrze" jest tak samo cennym wynikiem jak „wygląda źle".** Dowód, że coś, co
uchodziło za ryzykowne, jest sprawne, to jedna z trzech najcenniejszych rzeczy, jakie możesz oddać.

Prawo zatrzymania po tej pozycji.

## R4 — TRZY EKRANY BEZ WEJŚCIA W HARNESSIE

`CaseWorkspace` (`CasesListScreen.tsx`, `RealizacjaView.tsx`, `RezultatyView.tsx`) — u mnie
**7 z 26 użyć bez `relations`** i **zero trafień w całym `dev-render/`**. Masz dwie drogi
i **obie są pełnowartościowym wynikiem**:

1. **Dopisz wpis `SCREENS`** i ekran w `dev-render/screens/`, który **montuje realny komponent
   produktu z mock-danymi** (wzór: `dev-render/screens/zwornik-projects.tsx` importuje
   `<MyProjects />` prosto z `src/`). Nigdy nie odtwarzasz komponentu od nowa — to byłby przyrząd
   pokazujący nie produkt. Potem para zrzutów jak w `R2`.
2. **STOP MERYTORYCZNY z briefem**: czego zabrakło (jakich danych wejściowych, jakiego kontekstu),
   ile pracy potrzeba, jak wyglądałby wpis. **To nie jest porażka** — to jest nazwana granica
   dowodu, a granica nazwana jest warta więcej niż zrzut zrobiony na siłę z niewłaściwego ekranu.

**Czego nie robisz:** nie dosypujesz `relations` do tych plików, żeby „problem zniknął".

Prawo zatrzymania po tej pozycji.

## R5 — REKOMENDACJA I JEDNO PYTANIE ROZSTRZYGALNE DO WŁAŚCICIELA

**To jest główny produkt myślowy tego dyżuru.**

Pytanie brzmi: **czy ekran bez powiązań ma pokazywać kartę „Brak powiązań", czy nie pokazywać jej
wcale?** Kanon mówi „blok obowiązkowy" — ale **kanon mówi też coś przeciwnego**, w drugim
dokumencie, i to jest ustalenie, które masz właścicielowi przedstawić:

- `docs/ui-standards/TRIADA_KANON.md:70` i punkt 29 listy czekowania: „Relations **albo**
  »No relations«" — czyli **zawsze**;
- `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md:337`: „Relations (blok 5 TRIADY,
  **jeśli są**)" — czyli **tylko gdy są**.

**Zweryfikuj oba cytaty sam** i podaj własne numery wierszy. Jeżeli Twój pomiar pokaże, że
sprzeczności nie ma — **napisz to wprost, to też jest wynik** i obalenie mojej tezy.

Obowiązkowo w tej pozycji:

- **rekomendacja oparta na `R3`**, nie na przeczuciu: ile ekranów wygląda dobrze, ile źle, na ilu
  karta zabiera miejsce treści;
- **jedno pytanie w formie rozstrzygalnej („tak"/„nie")**, na przykład: *„Czy pusta karta »Brak
  powiązań« ma zostać na ekranach, które nie deklarują powiązań — mimo że na N z M zrzutów zabiera
  wiersz potrzebny treści?"*;
- **wpis `DO DECYZJI WŁAŚCICIELA`** ze zdaniem **„czego konkretnie mi zabrakło, żeby rozstrzygnąć
  samodzielnie"**. Wpis bez tego zdania liczy się jako nierozstrzygnięty;
- **★ nie zmieniasz żadnego dokumentu w `docs/ui-standards/`** (`Z14`) i nie cofasz zmiany
  dyżuru 349. Twoim produktem jest orzeczenie i pytanie, nie fakt dokonany.

Prawo zatrzymania po tej pozycji.

## R6 — RAPORT

Struktura `§R.2`. Obowiązkowo:

- **tabela inwentarza z `R1`** w całości, z kolumną pokrycia harnessem;
- **pełna lista zrzutów z `R2`**: ścieżka w `evidence/`, `shasum -a 256`, średnia jasność,
  wynik dwuwymiarowego bezpiecznika pary, **oraz odczyt z uchwytu DOM** (czy karta była, jaka
  miała wysokość, ile pigułek);
- **`git diff` na `StandardPreview.tsx` po cofnięciu mutacji — dosłownie, jako pusty wynik**;
- **orzeczenie per ekran z `R3`** w całości;
- **wynik `R4`**: wpis albo brief;
- **rekomendacja i pytanie z `R5`**;
- **tabela rozbieżności wobec liczb tej instrukcji** — każda liczba, którą Twój pomiar obalił;
- obowiązkowy akapit `§0.2e` dla **każdego** uruchomionego pakietu testowego;
- deklaracja `Z30`;
- sekcja **TWIERDZENIA NIEZWERYFIKOWANE** **niepusta**. Wymień w niej co najmniej: jak karta
  wygląda w realnej aplikacji na realnych danych (harness to nie produkt), zachowanie na wąskim
  ekranie (jeśli nie mierzyłeś), oraz ekrany, których nie udało się pokryć harnessem.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sprawdź ją komendą
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle pisze inny autor.

**Commit po `R6`.**

## Próg odbioru

**Dla każdego ekranu, który da się pokryć harnessem, istnieje para PRZED/PO w obu motywach,
o różnych sumach kontrolnych, z odczytem karty z uchwytu DOM; każdy z nich ma orzeczenie
»wygląda dobrze« albo »wygląda źle« z uzasadnieniem odnoszącym się do konkretnego zrzutu;
a właściciel dostaje jedno pytanie rozstrzygalne z cytatami obu sprzecznych zdań SSOT.**

Odbiorca odrzuci dyżur, w którym: para ma identyczne sumy kontrolne; liczebność albo obecność
karty odczytano ze zrzutu zamiast z DOM; obejrzano część ekranów i ogłoszono to stanem wszystkich;
powstał własny skrypt zrzutowy obok kanonicznego; `StandardPreview.tsx` trafił do commita;
dosypano `relations` do wołaczy; zmieniono dokument `docs/ui-standards/`; albo przepisano moje
liczby zamiast zmierzyć własne.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1 zrobione, R2 zrobione dla 15 z 18 ekranów, R3 zrobione
dla tych 15, R4 jako brief, R5-R6 nietknięte" jest **pełnowartościowym wynikiem** — o ile R2 stoi
na parach o różnych sumach kontrolnych, a R3 na uzasadnieniach odnoszących się do konkretnych
zrzutów.

**Odwrotna kolejność — rekomendacja napisana, a zrzutów nie ma albo są bajtowo identyczne — jest
podstawą odrzucenia.** Orzeczenie o wyglądzie bez obejrzenia wyglądu jest dokładnie tym, przed
czym ten dyżur ma chronić.

---

## AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para wymagań, która mogłaby się wykluczać | Gdzie ROZSTRZYGNIĘTA w tym dokumencie |
| --- | --- |
| „Zrób zrzut PRZED" **vs** zakaz cofania naprawy dyżuru 349 | `R2` kroki 1-6 — mutacja **tymczasowa**, cofana przez `cp` ze `SCRATCH`, `git diff` pusty, plik **nie może wystąpić w żadnym commicie**; kontrola w `B.4.5` |
| Zakaz `Z11` „nowe wizualium za flagą `default OFF`" **vs** „ta zmiana już weszła na żywo" | `POZYCJE_Z_FLAGAMI` — zmiana jest **scalona**, więc produktem jest **zobaczenie i orzeczenie**, nie schowanie jej za flagą; cofnięcie albo flaga to **rekomendacja do `R5`**, nigdy Twoja własna decyzja |
| `TRIADA_KANON.md` „Relations zawsze" **vs** `TABLE_AND_PREVIEW_CANON.md` „jeśli są" | `R5` — **nie rozstrzygasz**; cytujesz oba zdania z numerami wierszy i stawiasz właścicielowi jedno pytanie „tak"/„nie". `Z14` zabrania zmiany któregokolwiek dokumentu |
| „Napraw ekrany, na których wygląda źle" **vs** zakaz dosypywania `relations` do 18 plików | `B.1` wiersz „osiemnaście wołaczy" i `R3` — produktem jest **gotowy diff nienałożony** + orzeczenie; masowa naprawa byłaby kolejną zmianą wyglądu, której nikt nie widział (krach 07-12) |
| „Obejrzyj wszystkie ekrany" **vs** trzy ekrany nie mają wejścia w harnessie | `R4` — albo dopisujesz wpis `SCREENS`, albo dajesz **STOP MERYTORYCZNY z briefem**; **oba są pełnowartościowym wynikiem**, a granica dowodu ma być nazwana |
| Zakaz `Z18` „narzędzia pomiarowe tylko do odczytu" **vs** „narzędzie nie ma potrzebnej opcji" | `B.1` wiersz „narzędzie zrzutowe" — **jedna opcja OPT-IN**, historyczne wywołania bit w bit; a jeżeli i tego nie wolno — gotowy diff nienałożony, pozycja **ZROBIONA** |
| Zakaz `Z13` „zrzuty i pliki wynikowe NIE wchodzą do repo" **vs** „dowody commituj do `evidence/`" | `B.1` wiersz „dowody i zrzuty" — **ta instrukcja daje jawną licencję na `evidence/podglad-relations-20260904/` z `git add -f`, także dla PNG**; 04.09 trzykrotnie ratowano dowody z katalogów tymczasowych, a raz powołano się na nieistniejący „zakaz binariów" |
| „Rozwiń sekcje przed zrzutem" **vs** „podgląd ma być na zrzucie" | `R2` — `--rozwin-sekcje=1` **razem z** `--klik-po-rozwinieciu=1`; bez drugiego pętla zamyka podgląd i mierzysz ekran bez tego, co mierzysz |
| „Bezpiecznik pary przeszedł" **vs** „para nie jest dowodem" | `R2` — bezpiecznik jest **dwuwymiarowy** i sam próg jasności **nagradza defekt**; dowodem jest para sum kontrolnych **plus** odczyt z DOM, nie zielony wynik bezpiecznika |
| Reguła `Z7` „port zajęty = STOP" **vs** „harness domyślnie słuchałby na 3020" | `B.4.4` i pułapka (6) — **podnosisz Vite na 5551** i przekazujesz `--base`; 3020 należy do toru grafiki i nie jest Twój |
| „Cofaj mutacje" **vs** `Z27` (zakaz `git stash`) | `R2` krok 1 i 5 — kopia przez `cp` do `SCRATCH`; schowek jest współdzielony między worktree i dlatego zakazany |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela wyżej | TAK — jedenaście par, każda rozstrzygnięta w treści |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na worktree z markera `c0f690bae3`; zero `BRAK`. Oznaczone `NOWY`: katalog dowodów, ekrany `dev-render/screens/case-workspace-*`, `tests/unit/preview/**` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, dziesięć wierszy; **liczba „20 z 44" ze zlecenia obalona własnym pomiarem** (26 w 18 plikach, z 53 w 39) |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — każdy wiersz „tylko odczyt" ma rzeczownik-produkt (diff · brief · wpis `DO DECYZJI` · opis · wynik przelotu) |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4; jedyny plik przekrojowy jest mutowany **tymczasowo** i nie wchodzi do commita |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych (351, 353, 354 oraz starsze 343-350) | TAK — `B.4.4`; porty 6411/5551 zmierzone jako wolne, kontener i gałąź nie istnieją. ★ Instrukcje 355-358 pisze równolegle inny autor — dlatego `Z7` zaostrzony: port zajęty = STOP całości, nigdy podmiana numeru. ★★ Dodatkowo jawnie wyłączony port 3020 (tor grafiki) |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK — wszystkie grepy przez `bash -c`, wszystkie wywołania narzędzia zrzutowego z `--base`, `--rozwin-sekcje`, `--klik-po-rozwinieciu` i `--osiad-po-rozwinieciu` |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu modułowi (sześć) | TAK — `§0.2d` osiemnaście punktów + `§0.2e` punkt (e) z sześcioma pułapkami przyrządu, każda zmierzona |
| 9 | Samodzielność — zero odwołań do rozmów i „poprzedniego dyżuru" bez ścieżki | TAK; zmiana dyżuru 349 zacytowana jako diff z SHA `58d391d65b`, oba zdania SSOT z numerami wierszy |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK — sprawdzone przez generator, który blokuje zapis przy niespełnieniu |
