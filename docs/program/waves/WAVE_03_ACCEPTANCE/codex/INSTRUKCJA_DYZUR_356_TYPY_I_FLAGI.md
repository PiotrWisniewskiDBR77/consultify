# INSTRUKCJA DYŻURU nr 356 — Codex — „★★★ ZIELONE TESTY PRZY CZERWONYCH TYPACH — I FLAGA, KTÓREJ MUTACJA NIE TKNĘŁA. Odbiorca dyżuru 345 znalazł dwie rzeczy, których pakiet nie zauważył, meldując „398/398 PASS". **(1)** `ariaLabel: string` jest polem WYMAGANYM, a zastany `src/components/MyWork/prototypes/__tests__/IdeaNotebookRightPanelPrototype.test.tsx` woła bramkę bez niego w **PIĘCIU** miejscach — punktowy `tsc` daje **5 × `TS2741`** (zmierzyłem sam: wiersze 16, 22, 29, 36, 44). **(2)** Odbiorca cofnął `src/utils/ideaNotebookRightPanelPrototypeFlag.ts` do wariantu **obliczonego** `meta.env?.[ENV_KEY]` — czyli dokładnie do defektu, który dyżur 345 naprawiał — a `tests/unit/flags` zostało **całkowicie zielone**. ★★ Zmierzyłem, DLACZEGO: `vi.stubEnv` ustawia właściwość na obiekcie `import.meta.env` w czasie działania, więc dostęp statyczny i obliczony czytają w vitest DOKŁADNIE TO SAMO — **żaden test uruchomieniowy nie odróżni tych dwóch wariantów**, bo różnica powstaje dopiero przy podmianie tekstu przez Vite w budowie przeglądarkowej. Bezpiecznik MUSI być statyczny albo budujący, nie uruchomieniowy. ★ Zadanie: naprawić pięć wywołań, dołożyć bezpiecznik typów z dowodem mutacyjnym, napisać bezpiecznik flagi, który **czerwieni się od cofnięcia do wariantu obliczonego**, i zinwentaryzować rodzinę z podziałem żywe/martwe"

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
> **wyłącznie** `/private/tmp/cx-day356-typy-i-flagi`.

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
Zakres: **PRZEKROJOWE — warstwa TYPÓW frontu i rodzina FLAG czytających `import.meta.env` w `src/`. Przedmiotem pracy są **dwa bezpieczniki, których dziś nie ma**: (a) bezpiecznik typów łapiący kształt „zielone testy przy czerwonych typach"; (b) bezpiecznik flagi łapiący cofnięcie do obliczonego dostępu do env. Do tego **inwentarz rodziny** z podziałem na żywe i martwe. Ten dyżur **nie zmienia ani jednej wartości domyślnej flagi** (`Z10`). Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, i plikiem postępu `/private/tmp/cx-day356-postep.md` (poza repo)**.
Trasy front: `★★ SEDNO. Rdzeń: `src/components/MyWork/prototypes/__tests__/IdeaNotebookRightPanelPrototype.test.tsx` (5 × `TS2741`) · `src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx` (wiersz **22**: `ariaLabel: string` w `PrototypeProps`; wiersz **93**: `IdeaNotebookRightPanelPrototypeGate` przyjmuje `PrototypeProps & { legacy }`, więc pole jest wymagane także na bramce) · `src/utils/ideaNotebookRightPanelPrototypeFlag.ts` (wiersz **27**: statyczny `import.meta.env.VITE_IDEA_NOTEBOOK_RIGHT_PANEL_PROTOTYPE`, komentarz w wierszach 25-26 wyjaśnia dlaczego) · `tests/unit/flags/panelIdeiEnvFlags.day345.test.ts` (2 przypadki) · rodzina: 109 plików `src/**` z obliczonym dostępem `meta.env[…]`, 122 pliki z konstrukcją `const meta = import.meta as unknown as { env?: … }`. Żywi konsumenci bramki: `src/components/MyWork/notebook/NotebookRightRail.tsx:1038` i `src/components/standard/IdeaRightPanel.tsx:422``. Trasy tył: `Ten dyżur **nie dotyka serwera**. `server/**` pozostaje `TYLKO ODCZYT` bez wyjątku. Nie stawiasz bazy i nie uruchamiasz żadnego testu `pg`/`realpg` — przydzielone Ci `cx-day356-pg` na porcie `6415` jest rezerwacją na wypadek, gdyby bezpiecznik wymagał realnego przebiegu, i **domyślnie go nie używasz**`.

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
WT=/private/tmp/cx-day356-typy-i-flagi
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
git -C "$VAULT" worktree add "$WT" -b codex/day356-typy-i-flagi-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day356-typy-i-flagi/config.worktree"
cat "$VAULT/worktrees/cx-day356-typy-i-flagi/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day356-scratch
mkdir -p /private/tmp/cx-day356-typy-i-flagi-artefakty

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
git -C "$WT" push github-backup codex/day356-typy-i-flagi-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only c0f690bae36a386de27f1a349fbb9674ec03c693..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `8` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) ★★★ TEZA GLOWNA — PIEC WYWOLAN BEZ ariaLabel. UWAGA: DOMYSLNA STERTA NODE NIE WYSTARCZA.
#     Bez --max-old-space-size tsc PADA na OOM po ~73 s i wyglada jak "0 bledow" (exit != 0, pusty plik).
#     To jest ksztalt "bezpiecznik, ktory nigdy nie mogl przejsc" — awaria przypisana produktowi.
node --max-old-space-size=8192 ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json > /private/tmp/cx-day356-typy-i-flagi-artefakty/tsc-wejscie.txt 2>&1; echo "tsc exit=$?"
bash -c "grep -c 'error TS' /private/tmp/cx-day356-typy-i-flagi-artefakty/tsc-wejscie.txt"
bash -c "grep -c 'TS2741' /private/tmp/cx-day356-typy-i-flagi-artefakty/tsc-wejscie.txt"
bash -c "grep 'IdeaNotebookRightPanelPrototype.test' /private/tmp/cx-day356-typy-i-flagi-artefakty/tsc-wejscie.txt"
#   moje liczby: tsc exit=2 · 92 bledy razem · 5 x TS2741 · wszystkie piec w wierszach 16, 22, 29, 36, 44
#   tego jednego pliku, wszystkie o brakujacym 'ariaLabel'
#   ★ 92, nie 5: reszta to 81 x TS2345 (kontrakt i18n t()) w innych plikach — patrz komenda (2)

# (2) TEZA: pelny tsc NIE MOZE dzis byc bramka, bo baza nie jest zerowa
bash -c "grep -oE '^[^(]+\.tsx?' /private/tmp/cx-day356-typy-i-flagi-artefakty/tsc-wejscie.txt | sort | uniq -c | sort -rn | head -8"
#   moje liczby: useReportBuilder.ts 27 · DocumentStudioDocumentPanel.tsx 23 · useReportSections.ts 11 ·
#   PresentationTemplateArchitectView.tsx 9 · DocumentStudioTemplateArchitectView.tsx 9
#   ★ WNIOSEK: bezpiecznik typow musi byc PUNKTOWY (lista plikow), nie "caly projekt = 0"

# (3) ★★★ TEZA O FLADZE — wariant statyczny jest w kodzie i ma komentarz wyjasniajacy
sed -n '24,31p' src/utils/ideaNotebookRightPanelPrototypeFlag.ts
#   oczekiwane: wiersz 27 to `return parseFlag(import.meta.env.VITE_IDEA_NOTEBOOK_RIGHT_PANEL_PROTOTYPE) ?? false;`
#   poprzedzony komentarzem "Static access is required: Vite replaces this expression..."

# (4) ★★★ TEZA, KTORA TLUMACZY, DLACZEGO MUTACJA 345 NIE ZACZERWIENILA
bash -c "grep -n 'stubEnv' tests/unit/flags/panelIdeiEnvFlags.day345.test.ts"
#   oczekiwane: dwa wywolania vi.stubEnv w tescie (wiersze 30-32)
#   ★ vi.stubEnv USTAWIA WLASCIWOSC na obiekcie import.meta.env w czasie dzialania. Dostep statyczny
#   i obliczony czytaja wtedy TO SAMO. Zaden test uruchomieniowy nie odrozni tych dwoch wariantow.
#   ★★ SPRAWDZ TO SAM w R2 — to jest teza, ktora decyduje o ksztalcie calego bezpiecznika.

# (5) ★★ TEZA O ROZMIARZE RODZINY — zlecenie mowilo "ok. 124 pliki", ja zmierzylem inaczej
bash -c "grep -rlE 'meta\??\.env\??\.?\[' src --include='*.ts' --include='*.tsx' | wc -l"
bash -c "grep -rl 'import\.meta as unknown' src --include='*.ts' --include='*.tsx' | wc -l"
bash -c "grep -rlE 'import\.meta\.env\.VITE_' src --include='*.ts' --include='*.tsx' | wc -l"
#   moje liczby: 109 plikow z dostepem OBLICZONYM · 122 pliki z konstrukcja `import.meta as unknown` ·
#   136 plikow z dostepem STATYCZNYM `import.meta.env.VITE_`. Zlecenie mowilo "ok. 124" — obalone przez pomiar.
#   ★ UWAGA NA REGEX: wzorzec musi objac obie formy `meta.env?.[K]` ORAZ `meta?.env?.[K]`.
#   Weższy wzorzec dal mi 6 zamiast 109 i prawie zapisalem falsz.

# (6) TEZA: bramka ma DWOCH ZYWYCH konsumentow, wiec to nie jest martwe poddrzewo
bash -c "grep -rn 'IdeaNotebookRightPanelPrototypeGate' src --include='*.tsx' | grep -v __tests__"
#   oczekiwane: definicja w prototypes/IdeaNotebookRightPanelPrototype.tsx:93 oraz DWA uzycia:
#   NotebookRightRail.tsx:1038 i standard/IdeaRightPanel.tsx:422

# (7) TEZA: osiagalnosc od korzenia jest zielona PRZED Twoja praca
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: 0

# (8) TEZA: liscie slownikow i bramki kanonu na markerze
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby: pl 35198 · en 33065 · wszystkie trzy bramki = 0
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day356-typy-i-flagi-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6415`. Twój JEDYNY port harnessu to `5555`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day356-pg`**. **ZAKAZANE:** `porty `5554`/`6414` (dyżur 355), `5556`/`6416` (dyżur 357), `5557`/`6417` (dyżur 358) oraz WSZYSTKIE porty spoza pary `5555`/`6415`; kontenery `cx-day355-pg`, `cx-day357-pg`, `cx-day358-pg` i każdy inny `cx-day*-pg``. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak — ten dyżur **nie zamawia ani jednej nowej flagi i nie zmienia ani jednej wartości domyślnej**. `ff_idea_notebook_right_panel_prototype` ma dziś domyślnie `false` i **ma tak zostać**. Wolno Ci flagą sterować w komendzie i w teście (`vi.stubEnv`, parametr zapytania, `localStorage`); NIE WOLNO zmienić domyślnej ani w kodzie, ani w `.env*`, ani w `docker-compose*`, ani w `railway*``, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/**` w całości, `src/services/**`, `src/utils/apiClient*`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tsconfig.json` (pola `include`/`exclude`), `vite.config.ts`, `.github/workflows/**``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY356_TYPY_I_FLAGI_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md`, bo ten dyżur jest przekrojowy i dotyczy bezpieczników, nie odbioru modułu. Dodatkowo wolno: utworzyć nowe pliki testowe w `tests/` (`git add -f`), utworzyć nowy skrypt bezpiecznika w `scripts/` (`git add -f`), zapisać dowody pod `evidence/day356/` (**katalog NIE ISTNIEJE na markerze — tworzysz go**, `git add -f`) oraz dopisać jedną nową sekcję w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze (sekcje doszły dziś do `Q`, ale równolegle dopisują inni autorzy — literę sprawdzasz komendą tuż przed commitem). Plik postępu `/private/tmp/cx-day356-postep.md` żyje POZA repo. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day356-typy-i-flagi-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day356-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **★★ ZAKAZ BEZPIECZNIKA, KTÓRY NIE MOŻE ZACZERWIENIĆ.** Zakazane bezwzględnie: dodanie bezpiecznika bez pokazania go w stanie CZERWONYM na realnej mutacji; oparcie bezpiecznika typów na progu „cały projekt = 0 błędów" (dziś jest 92, więc taki bezpiecznik nigdy nie przejdzie i zostanie wyłączony); oparcie bezpiecznika flagi na teście uruchomieniowym z `vi.stubEnv` (udowodnij najpierw w `R2`, że taki test NIE odróżnia wariantów — a jeżeli obalisz moją tezę, wolno). Bezpiecznik bez pary „mutacja → czerwony / cofnięcie → zielony" = **odrzucenie pozycji** | To jest dyżur o bezpiecznikach, więc bezpiecznik-atrapa jest gorszy od jego braku: daje fałszywy spokój i zamyka temat na miesiące. Program zmierzył już trzy takie kształty: bramka ginąca na ścieżce przed pierwszym pomiarem, bezpiecznik nagradzający defekt i test, który zielenieje, bo nie ma czego zmierzyć |

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
cd /private/tmp/cx-day356-typy-i-flagi

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day356-pg psql -U postgres -d cx356 \
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
cd /private/tmp/cx-day356-typy-i-flagi

docker run -d --name cx-day356-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx356 \
  -p 127.0.0.1:6415:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day356-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6415/cx356 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6415/cx356 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day356-typy-i-flagi && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6415/cx356 \
JWT_SECRET=cx356-test-secret-do-not-reuse-min-32-znaki \
npx vitest run tests/unit/flags/ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day356-typy-i-flagi-artefakty/flagi-przemiar.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day356-typy-i-flagi && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/unit/flags/ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day356-typy-i-flagi-artefakty/flagi-przemiar.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day356-typy-i-flagi/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day356-pg psql -U postgres -d cx356 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day356-pg`.
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
> **(e) **(e) ★★ PUŁAPKA WŁAŚCIWA TEMU DYŻUROWI: `tsc` na tym repozytorium PADA NA BRAKU PAMIĘCI przy domyślnej stercie Node.** Zmierzyłem: `npx tsc --noEmit -p tsconfig.json` kończy się po ~73 sekundach komunikatem `FATAL ERROR: Ineffective mark-compacts near heap limit` i **zostawia PUSTY plik wyjściowy**, który czyta się jak „zero błędów". Działa dopiero `node --max-old-space-size=8192 ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`. **Bezpiecznik, który nie ustawia sterty, jest bezpiecznikiem, który nigdy nie mógł przejść — i jego awarię przypisze się produktowi.** Dowód wejściowy: komenda (1) z `§0.3`, obie wersje, obie w raporcie**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day356-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day356-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (``R1`, `R2`, `R3``) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6415` albo `5555` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6415` albo `5555`** (`Z7`).

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

Dyżur 345 domykał panel Idei/Notatnika i zameldował **„398/398 PASS"**. Odbiorca sprawdził to
adwersaryjnie i znalazł dwie rzeczy, których zielony pakiet nie zauważył — obie tego samego
rodzaju: **narzędzie pomiarowe nie miało czym zmierzyć tego, co miało chronić.**

### Znalezisko (1): zielone testy przy czerwonych typach

`src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx` deklaruje w wierszu 22:

```ts
ariaLabel: string;
```

— pole **wymagane**, bez `?`. Bramka `IdeaNotebookRightPanelPrototypeGate` (wiersz 93)
przyjmuje `PrototypeProps & { legacy: React.ReactNode }`, więc wymóg dotyczy także jej.
A zastany plik `src/components/MyWork/prototypes/__tests__/IdeaNotebookRightPanelPrototype.test.tsx`
woła tę bramkę **pięć razy bez `ariaLabel`** — w wierszach **16, 22, 29, 36, 44**.

Zmierzyłem to przy wydaniu instrukcji:

```
src/.../IdeaNotebookRightPanelPrototype.test.tsx(16,35): error TS2741: Property 'ariaLabel' is missing …
src/.../IdeaNotebookRightPanelPrototype.test.tsx(22,13): error TS2741: …
src/.../IdeaNotebookRightPanelPrototype.test.tsx(29,13): error TS2741: …
src/.../IdeaNotebookRightPanelPrototype.test.tsx(36,13): error TS2741: …
src/.../IdeaNotebookRightPanelPrototype.test.tsx(44,13): error TS2741: …
```

**Pięć błędów typów w pliku, który vitest wykonuje na zielono.** Vitest transpiluje bez
sprawdzania typów, więc ten kształt jest niewidoczny dla każdego pakietu testowego, jaki
w tym programie kiedykolwiek uruchomiono.

### Znalezisko (2): mutacja, która nie tknęła zabezpieczenia

Odbiorca cofnął `src/utils/ideaNotebookRightPanelPrototypeFlag.ts` do wariantu **obliczonego**
`meta.env?.[ENV_KEY]` — czyli dokładnie do defektu, który dyżur 345 naprawiał — i uruchomił
`tests/unit/flags`. **Cały katalog został zielony.** Mutacje raportu 345 celowały w wartość
domyślną flagi, nie w naprawiony sposób dostępu.

**★★ Zmierzyłem, dlaczego, i to jest najważniejsze zdanie tej instrukcji.**
`tests/unit/flags/panelIdeiEnvFlags.day345.test.ts` steruje flagą przez `vi.stubEnv`
(wiersze 30-32). `vi.stubEnv` **ustawia właściwość na obiekcie `import.meta.env` w czasie
działania**. Dostęp statyczny `import.meta.env.VITE_X` i dostęp obliczony `meta.env?.[KEY]`
czytają wtedy **dokładnie tę samą właściwość tego samego obiektu**. Różnica między nimi
powstaje dopiero wtedy, gdy **Vite podmienia tekst wyrażenia w budowie przeglądarkowej** —
statyczne zostaje zastąpione literałem, obliczone zostaje nierozwiązane i w gotowym pakiecie
czyta `undefined`.

**Wniosek, który wyznacza kształt całej pracy: żaden test uruchomieniowy nie odróżni tych
dwóch wariantów. Bezpiecznik MUSI być statyczny (skan źródeł) albo budujący (skan gotowego
pakietu) — nigdy uruchomieniowy.**

To jest hipoteza, nie fakt. **`R2` ma ją potwierdzić albo obalić własnym pomiarem, i obalenie
jest sukcesem** — bo wtedy istnieje tańszy bezpiecznik, niż zakładam.

### Kontekst rodziny

Wariant statyczny jest w kodzie dziś (wiersz 27) i nosi komentarz wyjaśniający, dlaczego:

> *„Static access is required: Vite replaces this expression in the browser bundle, while
> a computed lookup remains unresolved."*

Autor instrukcji 345 zmierzył, że to nie jest jedna flaga, tylko rodzina. Trzy naprawiono
(`ideaNotebookRightPanelPrototypeFlag`, `artifactRightRailFlag`, `notebookSpecAShellFlag`).
**Reszta czeka i nikt nie wie, ile jej jest ani ile z niej żyje.**

## ★★ MOJA HIPOTEZA — masz ją OBALIĆ ALBO POTWIERDZIĆ, nie przyjąć

Trzy tezy, każda z komendą obalającą:

| # | Teza autora instrukcji | Jak ją OBALIĆ |
| --- | --- | --- |
| **H1** | Żaden test uruchomieniowy z `vi.stubEnv` nie odróżni dostępu statycznego od obliczonego | Napisz taki test i pokaż go **czerwonym po mutacji na obliczony** i **zielonym po cofnięciu**. Jeżeli Ci się uda — H1 jest fałszywa, bezpiecznik jest tańszy, niż zakładam, i to jest lepszy wynik niż mój |
| **H2** | Bezpiecznik typów nie może brzmieć „cały projekt = 0 błędów", bo dziś jest **92** | Uruchom komendę (1) i (2) z `§0.3`. Jeżeli Twój pomiar da 0 — H2 jest fałszywa i bezpiecznik może objąć całość, co jest LEPIEJ |
| **H3** | Rodzina obliczonego dostępu liczy **109** plików w `src/`, nie „ok. 124", jak mówiło zlecenie | Komenda (5) z `§0.3`, **z pełnym wzorcem obejmującym `meta.env?.[K]` ORAZ `meta?.env?.[K]`** |

**★★ OSTRZEŻENIE O WŁASNYM BŁĘDZIE, ŻEBYŚ GO NIE POWTÓRZYŁ.** Przy pisaniu tej instrukcji
policzyłem rodzinę węższym wzorcem (`meta\.env\??\.?\[`) i dostałem **6 plików**. Prawidłowy
wzorzec (`meta\??\.env\??\.?\[`, obejmujący opcjonalny łańcuch także na `meta`) daje **109**.
Różnica bierze się stąd, że większość plików pisze `const meta = import.meta as unknown as
{ env?: … }` i czyta `meta?.env?.[ENV_KEY]`. **Prawie zapisałem fałsz osiemnastokrotnie
zaniżony.** Każdy Twój wzorzec musi być pokazany w raporcie razem z liczbą, którą dał.

## ★ Zmierz moje liczby sam

Twierdzę, na markerze `c0f690bae36a386de27f1a349fbb9674ec03c693`:

- `IdeaNotebookRightPanelPrototype.test.tsx`: **5 × `TS2741`**, wiersze **16, 22, 29, 36, 44**,
  wszystkie o brakującym `ariaLabel`;
- pełny `tsc` projektu: **92 błędy**, z tego **81 × `TS2345`** (kontrakt `t()` biblioteki i18n)
  i **5 × `TS2741`**; najwięcej w `useReportBuilder.ts` (27), `DocumentStudioDocumentPanel.tsx`
  (23), `useReportSections.ts` (11);
- **`tsc` przy domyślnej stercie Node PADA na OOM po ~73 s i zostawia pusty plik wyjściowy** —
  działa dopiero z `--max-old-space-size=8192`;
- `tests/unit/flags/panelIdeiEnvFlags.day345.test.ts` ma **2** przypadki, oba sterują flagą
  przez `vi.stubEnv`;
- rodzina: **109** plików `src/**` z dostępem obliczonym · **122** pliki z konstrukcją
  `const meta = import.meta as unknown as { env?: … }` · **136** plików z dostępem statycznym
  `import.meta.env.VITE_`;
- bramka ma **dwóch żywych konsumentów**: `NotebookRightRail.tsx:1038`
  i `standard/IdeaRightPanel.tsx:422` — to **nie jest** martwe poddrzewo;
- domyślna wartość `ff_idea_notebook_right_panel_prototype` to **`false`** (wiersz 27,
  `?? false`) — **i ma tak zostać**;
- katalog `evidence/day356/` **NIE ISTNIEJE** na markerze — tworzysz go;
- liście słowników: **pl 35198**, **en 33065**; `reachability --check-baseline` kończy się
  kodem **0**; `focus-canon`, `list-canon`, `artefakt` kończą się kodem **0**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
czerwony kontrakt testowy + brief. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Kontrakt typów bramki** | `src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx` | **★ WĄSKA LICENCJA:** wolno **czytać** i **cytować `plik:linia`**. **Zakaz osłabienia kontraktu — `ariaLabel: string` NIE STAJE SIĘ `ariaLabel?: string`.** Naprawa idzie po stronie wołających, nie przez zmiękczenie typu. Wolno **zmutować tymczasowo** w `R2` jako dowód mutacyjny, z cofnięciem przez `cp` i pustym `git diff` | Brief z `plik:linia` |
| **Test bramki (rdzeń pozycji `R1`)** | `src/components/MyWork/prototypes/__tests__/IdeaNotebookRightPanelPrototype.test.tsx` | **★ PEŁNA LICENCJA** w zakresie `R1`: dopisanie brakującego `ariaLabel` w pięciu wywołaniach. **Zakaz usuwania przypadków, osłabiania asercji i zmiany zachowania testu** — dodajesz brakujące pole, nic więcej | — |
| **Flaga panelu (rdzeń pozycji `R2`)** | `src/utils/ideaNotebookRightPanelPrototypeFlag.ts` | **★ WĄSKA LICENCJA:** wolno **zmutować tymczasowo** (statyczny → obliczony) jako dowód mutacyjny i **cofnąć przez `cp`**. **Zakaz trwałej zmiany: dostęp zostaje STATYCZNY, wartość domyślna zostaje `false`** (`Z10`) | Brief |
| **Pozostałe flagi rodziny** | `src/utils/*Flag*.ts`, `src/components/**/*Flag*.ts` (109 plików z obliczonym dostępem) | **TYLKO ODCZYT — ten dyżur je INWENTARYZUJE, nie naprawia.** Naprawa rodziny to osobne zlecenie i osobna decyzja właściciela; ten dyżur ma dostarczyć listę i podział żywe/martwe | Wpis do inwentarza `R4` + rekomendacja jako diff **nienałożony** |
| **Żywi konsumenci bramki** | `src/components/MyWork/notebook/NotebookRightRail.tsx`, `src/components/standard/IdeaRightPanel.tsx` | **TYLKO ODCZYT** — jeżeli okaże się, że one też wołają bramkę bez `ariaLabel`, jest to **znalezisko do raportu**, a naprawa wymaga osobnego akapitu z uzasadnieniem. Sprawdź je jawnie w `R1` | Wpis: plik, linia, problem, diff **nienałożony** |
| **Nowe testy i bezpieczniki** | `tests/**` (NOWE pliki, `git add -f`), `scripts/**` (NOWY plik bezpiecznika, `git add -f`) | **★ PEŁNA LICENCJA na dodanie**, z zastrzeżeniem `Z18` i `Z31`. **Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`** | — |
| **Istniejący test flag** | `tests/unit/flags/panelIdeiEnvFlags.day345.test.ts`, `tests/unit/flags/flagiDomyslnieOn.test.ts`, `tests/unit/flags/initiativeSectionsCompleteFlag.day343.test.ts` | **★ WĄSKA LICENCJA:** wolno **URUCHAMIAĆ** i wolno **DOPISAĆ** przypadek. **Zakaz usuwania i zmiany istniejących przypadków** | — |
| **Konfiguracja typów** | `tsconfig.json`, `tsconfig.*.json`, `vite.config.ts` | **NIETYKALNE DO ZAPISU (`Z12`).** Poszerzenie `exclude`, żeby błędy zniknęły, jest **odrzuceniem dyżuru**, nie naprawą | Brief z `plik:linia` |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **CI** | `.github/workflows/**` | **TYLKO ODCZYT (`Z38`/`Z39`).** Bezpiecznik dostarczasz jako **skrypt w `scripts/` + test w `tests/`**; podłączenie do CI rekomendujesz w raporcie jako diff **nienałożony** | Diff nienałożony + brief |
| **Serwer** | `server/**` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** Ten dyżur nie dotyka serwera | Opis w raporcie |
| **Słowniki** | `public/locales/**` | **TYLKO ODCZYT.** 81 błędów `TS2345` dotyczy kontraktu `t()`, nie treści słowników — nie naprawiasz ich w tym dyżurze | Brief |
| **Dowody** | `evidence/day356/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**, `git add -f`) | **★ PEŁNA LICENCJA na tworzenie i dopisywanie** | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze**, sprawdzonej komendą tuż przed commitem (dziś doszły do `Q`) | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY356_TYPY_I_FLAGI_REPORT.md` (**NOWY**) | `R5` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Macierze odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie 16) | **NIETYKALNE DO ZAPISU** — ten dyżur nie zmienia stanu żadnego wiersza `G` | — |
| **Cudze tereny** | `server/src/routes/v8/finance-v2/__tests__/**`, `evidence/g15/**` (dyżur 355) · `docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, wiersz `G16` (dyżur 357) · `server/src/routes/__tests__/day27{4,5,6,7}-*.pg.test.ts`, `evidence/g19/**`, `vitest.config.ts` (dyżur 358) · wszystko wokół licznika kompletności, 20 ekranów podglądu, wiersza `G19` i etykiet narzędzi (dyżury 351-354) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
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

# (c) ★ WLASCIWY TEMU DYZUROWI: liczba bledow tsc NIE MOZE WZROSNAC
node --max-old-space-size=8192 ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json 2>&1 | grep -c 'error TS'
#   moja liczba PRZED: 92. Po R1 oczekuje 87 (5 x TS2741 zgaszone). WZROST = regresja Twojej pracy.
```

**Jeżeli którakolwiek liczba zmaleje (słowniki) albo wzrośnie (błędy typów) od Twojej zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | błędy `TS2741` w pliku testu bramki | `5` (wiersze 16/22/29/36/44) | komenda (1) z `§0.3` | TAK — **tylko z `--max-old-space-size`; bez niego `tsc` pada i wygląda na zero** |
| 2 | wszystkie błędy `tsc` projektu | `92` | komenda (1) z `§0.3` | TAK — **to obala próg „cały projekt = 0"** |
| 3 | rozkład błędów po plikach | `27 / 23 / 11 / 9 / 9` | komenda (2) z `§0.3` | TAK — dowód, że reszta to cudze tereny |
| 4 | pliki z dostępem OBLICZONYM do env | `109` | komenda (5) z `§0.3` | TAK — **wzorzec MUSI objąć `meta?.env?.[K]`; węższy dał mi 6** |
| 5 | pliki z konstrukcją `import.meta as unknown` | `122` | komenda (5) z `§0.3` | TAK |
| 6 | pliki z dostępem STATYCZNYM | `136` | komenda (5) z `§0.3` | TAK |
| 7 | żywi konsumenci bramki | `2` | komenda (6) z `§0.3` | TAK — **to obala „martwe poddrzewo"** |
| 8 | czy test uruchomieniowy odróżnia warianty | — | `R2` punkt 1, dwa przebiegi | TAK — **różnica albo jej brak jest wynikiem, nie porażką** |
| 9 | ile z rodziny 109 jest ŻYWE | — | `R4`, osiągalność od korzenia | TAK — **mierzysz osiągalność od korzenia, nie „plik bez importera"**: metoda per-plik liczy importy wewnątrz martwego poddrzewa jako żywe |
| 10 | liście słowników PL/EN | `35198` / `33065` | blok (a) „WARUNKÓW WSPÓLNYCH" | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY356_TYPY_I_FLAGI_REPORT.md` ·
`evidence/day356/**` (nowy katalog, `git add -f`) ·
`src/components/MyWork/prototypes/__tests__/IdeaNotebookRightPanelPrototype.test.tsx` (`R1`).

**Zapisujesz WARUNKOWO (tylko z dowodem `R2`/`R3`):**
nowe pliki testowe w `tests/` (`git add -f`) · nowy skrypt bezpiecznika w `scripts/`
(`git add -f`) · dopisane przypadki w `tests/unit/flags/**` ·
`REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `server/**`, `public/locales/**`, `tsconfig*.json`, `vite.config.ts`,
`tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`,
`.github/workflows/**`, `server/migrations/**`,
`src/utils/ideaNotebookRightPanelPrototypeFlag.ts` **trwale** (tylko mutacja z cofnięciem),
`src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx` **trwale**,
`src/components/MyWork/notebook/NotebookRightRail.tsx`, `src/components/standard/IdeaRightPanel.tsx`,
pozostałe 108 plików rodziny, `evidence/g15/**`, `evidence/g19/**`,
`docs/program/PRZELOT_WLASCICIELA_STAGING_20260904.md`, wszystkie `MODULE_ACCEPTANCE.md`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day356-typy-i-flagi
git diff --name-only --cached | tee /private/tmp/cx-day356-typy-i-flagi-artefakty/staged.txt
bash -c "grep -iE '^server/|^public/locales/|^tsconfig|vite\.config|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|MODULE_ACCEPTANCE|evidence/g1[59]|PRZELOT_WLASCICIELA|NotebookRightRail|IdeaRightPanel|ideaNotebookRightPanelPrototypeFlag|prototypes/IdeaNotebookRightPanelPrototype\.tsx' /private/tmp/cx-day356-typy-i-flagi-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — TRZY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Bezpiecznik bez pary „mutacja → czerwony / cofnięcie → zielony" NIE ISTNIEJE.**
Każdy z dwóch bezpieczników tego dyżuru ma być pokazany w obu stanach, z komendami i wynikami
dosłownie w raporcie. Bezpiecznik pokazany tylko na zielono jest **atrapą** i pozycja
z takim produktem jest **odrzucona**, nie zaliczona.

**(2) Mutacja celuje w ZABEZPIECZENIE, nie w mechanizm.** Dla bezpiecznika typów mutacją jest
**usunięcie `ariaLabel` z jednego z pięciu wywołań** (przywrócenie stanu zastanego), nie
zepsucie składni pliku. Dla bezpiecznika flagi mutacją jest **cofnięcie dostępu ze statycznego
na obliczony**, nie zmiana wartości domyślnej. Mutacja, która psuje coś obok, dowodzi tylko
tego, że narzędzie w ogóle działa — a to nie jest przedmiot dowodu.

**(3) Nie osłabiasz kontraktu, żeby zzielenieć.** `ariaLabel: string` **nie staje się**
`ariaLabel?: string`. `tsconfig.json` **nie dostaje nowego wpisu w `exclude`**. Próg „cały
projekt = 0 błędów" **nie jest obniżany do „ignoruj `TS2345`"** — bezpiecznik ma być punktowy,
a nie rozmiękczony.

**Wymagany dowód:** trzy zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — PIĘĆ WYWOŁAŃ BEZ `ariaLabel` I BEZPIECZNIK TYPÓW (rdzeń)

1. **Zmierz stan wejściowy** komendą (1) z `§0.3` i **zapisz surowe wyjście** do
   `evidence/day356/tsc-przed.txt`. **Obie wersje komendy** — z domyślną stertą i z
   `--max-old-space-size=8192` — z zapisanymi kodami wyjścia. To jest dowód pułapki `§0.2e`.
2. **Napraw pięć wywołań**: dopisz `ariaLabel` w wierszach 16, 22, 29, 36, 44 pliku
   `src/components/MyWork/prototypes/__tests__/IdeaNotebookRightPanelPrototype.test.tsx`.
   Wartość ma być sensowna dla kontekstu (`context="idea"` → etykieta idei, `context="notebook"`
   → etykieta notatki), nie pusty napis. **Nie zmieniasz niczego innego w tym pliku.**
3. **Sprawdź żywych konsumentów bramki** komendą (6) z `§0.3`:
   `NotebookRightRail.tsx:1038` i `standard/IdeaRightPanel.tsx:422`. **Czy one podają
   `ariaLabel`?** Jeżeli któryś nie podaje, a mimo to `tsc` milczy — **to jest znalezisko
   ważniejsze niż cała reszta pozycji** i opisujesz je z `plik:linia`. Naprawy w tych plikach
   NIE robisz (cudzy teren produkcyjny) — dostarczasz diff **nienałożony**.
4. **Zbuduj bezpiecznik typów.** Wymagania, wszystkie obowiązkowe:
   - **jest PUNKTOWY** — obejmuje jawną listę plików albo katalog, a nie próg „cały projekt =
     0", bo dziś jest 92 błędy i taki bezpiecznik nigdy by nie przeszedł;
   - **ustawia stertę** — bez `--max-old-space-size` `tsc` pada na OOM i jego awaria wygląda
     jak sukces;
   - **traktuje pusty wynik jako BŁĄD KOMENDY**, nie jako zero błędów — kod wyjścia i liczba
     przeanalizowanych plików idą do wyjścia bezpiecznika;
   - **żyje w `scripts/`** jako skrypt **i** w `tests/` jako test, żeby był uruchamialny na
     dwa sposoby; podłączenie do CI rekomendujesz jako diff **nienałożony** (`Z38`/`Z39`).
5. **Dowód mutacyjny bezpiecznika typów:** usuń `ariaLabel` z **jednego** z pięciu wywołań →
   bezpiecznik ma **zaczerwienić się** z komunikatem wskazującym `plik:linia`; cofnij przez
   `cp` ze `SCRATCH` (nigdy `git stash`, `Z27`) → ma **zzielenieć**; `git diff` po cofnięciu
   **pusty**. Obie komendy i oba wyniki dosłownie w raporcie.

**Wymagany dowód:** `evidence/day356/tsc-przed.txt` i `tsc-po.txt` z kodami wyjścia obu wersji
komendy · liczba błędów przed (`92`) i po (oczekuję `87`) · odpowiedź o dwóch żywych
konsumentach · skrypt bezpiecznika · para „mutacja czerwony / cofnięcie zielony" dosłownie.
**Commit po `R1`.**

## R2 — BEZPIECZNIK FLAGI, KTÓRY CZERWIENI SIĘ OD COFNIĘCIA (rdzeń)

**To jest pozycja, w której hipoteza `H1` staje się faktem albo pada.**

1. **Najpierw OBAL ALBO POTWIERDŹ `H1`, zanim cokolwiek zbudujesz.** Zmutuj
   `src/utils/ideaNotebookRightPanelPrototypeFlag.ts` — zamień wiersz 27
   `parseFlag(import.meta.env.VITE_IDEA_NOTEBOOK_RIGHT_PANEL_PROTOTYPE)` na wariant obliczony
   `parseFlag((import.meta as unknown as { env?: Record<string,string|undefined> })?.env?.[ENV_KEY])`
   — i uruchom **cały** `tests/unit/flags/`, `--retry=0`, `--reporter=json`.
   **Zapisz `numTotalTests` i `numFailedTests`.** Cofnij przez `cp`.
   - Twierdzę, że pakiet **pozostanie całkowicie zielony**. Jeżeli tak — `H1` potwierdzona,
     bezpiecznik musi być statyczny albo budujący.
   - **Jeżeli coś zaczerwienieje — `H1` jest FAŁSZYWA**, zapisujesz to zdaniem „hipoteza
     autora instrukcji obalona pomiarem", wskazujesz który przypadek zaczerwienił i **budujesz
     tańszy bezpiecznik uruchomieniowy**. To jest lepszy wynik niż mój.
2. **Zbuduj bezpiecznik flagi.** Jeżeli `H1` się potwierdziła, dopuszczalne są dwie drogi
   i **uzasadniasz wybór, wypisując, co odrzuciłeś**:
   - **(A) skan źródeł** — bezpiecznik czyta pliki flag z jawnej listy i **odrzuca** dostęp
     obliczony `env[...]` / `env?.[...]` do klucza `VITE_*`, wymagając wyrażenia statycznego.
     Musi być odporny na obie formy zapisu (`meta.env?.[K]` i `meta?.env?.[K]`) — pokaż to
     przypadkiem testowym dla każdej formy;
   - **(B) skan gotowego pakietu** — bezpiecznik buduje front i sprawdza, czy literał wartości
     env pojawił się w pakiecie. Droższy, ale mierzy dokładnie to, co psuje się w produkcji.
     **Jeżeli wybierzesz (B), zmierz czas budowy i podaj go w raporcie** — bezpiecznik, który
     trwa dziesięć minut, zostanie wyłączony przy pierwszej okazji.
3. **Dowód mutacyjny bezpiecznika flagi, obowiązkowy:** zmutuj flagę na wariant obliczony →
   bezpiecznik ma **zaczerwienić się**; cofnij przez `cp` → ma **zzielenieć**; `git diff`
   po cofnięciu **pusty**. Obie komendy i oba wyniki dosłownie w raporcie.
   ★ **Mutacja wartości domyślnej `false` → `true` NIE LICZY SIĘ** jako dowód — to jest inne
   zabezpieczenie i pilnuje go `tests/unit/flags/flagiDomyslnieOn.test.ts`.
4. **Sprawdź, że nie zepsułeś tego, co już działa:** `tests/unit/flags/` w całości ma zostać
   zielone po Twojej pracy, z **listą nazw przypadków**, nie samą liczbą (`Z37`).

**Wymagany dowód:** wynik mutacji z punktu 1 z `numTotalTests` i `numFailedTests` · jawne
zdanie „`H1` potwierdzona / obalona" · opis wybranej drogi z uzasadnieniem odrzucenia drugiej ·
para „mutacja czerwony / cofnięcie zielony" · nazwy wszystkich przypadków `tests/unit/flags/`
przed i po. **Commit po `R2`.**

## R3 — CZY OBA BEZPIECZNIKI ŁAPIĄ STAN ZASTANY (rdzeń)

Krótka pozycja, ale rozstrzygająca: **bezpiecznik, który nie łapie defektu, dla którego
powstał, jest atrapą.**

1. Cofnij worktree do stanu zastanego **wyłącznie w dwóch plikach** (przez `cp` ze `SCRATCH`,
   nigdy `git stash`): test bramki bez `ariaLabel` w pięciu miejscach **oraz** flaga
   w wariancie obliczonym.
2. Uruchom oba bezpieczniki. **Oba mają być CZERWONE**, każdy ze wskazaniem `plik:linia`.
3. Przywróć swój stan. **Oba mają być ZIELONE.** `git diff` po przywróceniu ma pokazywać
   wyłącznie Twoje zamierzone zmiany.
4. **Zapisz oba przebiegi surowo** do `evidence/day356/` i podaj `shasum -a 256` każdego pliku.

**Wymagany dowód:** cztery przebiegi (dwa bezpieczniki × dwa stany) z surowymi wyjściami
i sumami kontrolnymi · `git diff` po przywróceniu. **Commit po `R3`.**

## R4 — INWENTARZ RODZINY Z PODZIAŁEM ŻYWE / MARTWE

**Ten dyżur rodziny NIE NAPRAWIA. Ma ją policzyć i pokazać, ile z niej naprawdę żyje.**

1. Wypisz **wszystkie** pliki `src/**` z obliczonym dostępem do `import.meta.env` do
   `evidence/day356/rodzina-env.tsv`: `ścieżka · numer wiersza · forma zapisu · nazwa klucza
   `VITE_*``. **Podaj wzorzec, którym je znalazłeś, i liczbę, którą dał** — mój wzorzec dał
   **109** plików, węższy dał **6**, i ta różnica jest ostrzeżeniem, nie ciekawostką.
2. **Rozstrzygnij ŻYWE / MARTWE osiągalnością OD KORZENIA**, nie metodą „plik bez importera".
   Metoda per-plik liczy importy wewnątrz martwego poddrzewa jako żywe i już raz przepuściła
   w tym programie osiem plików plus hook. Narzędzie: `scripts/dev/reachability-from-root.mjs`.
   Wynik: kolumna `ŻYWY` / `MARTWY` / `NIEORZECZONY` przy każdym pliku.
3. **Nie orzekaj na próbce.** Jeżeli sprawdzisz część, napisz **ile z ilu** i **którą część** —
   „obejrzałem dwa najstarsze pliki i ogłosiłem ich stan stanem całości" to zmierzony kształt
   fałszywego „gotowe", który już raz kosztował ten program dzień.
4. **Wskaż podzbiór, który jest jednocześnie ŻYWY i obliczony** — to jest realny dług
   i to jest liczba, po którą program przyjdzie. Podaj ją jawnie.
5. **Nie naprawiasz ani jednego pliku z tej rodziny poza flagą panelu.** Rekomendację
   dostarczasz jako diff **nienałożony** dla **jednego** wybranego pliku, jako wzór dla
   przyszłego zlecenia.

**Wymagany dowód:** `evidence/day356/rodzina-env.tsv` z pełną listą · wzorzec i jego liczba ·
kolumna ŻYWY/MARTWY z metodą · jawna liczba „żywe ∧ obliczone" · jeden diff wzorcowy,
nienałożony. **Commit po `R4`.**

## R5 — RAPORT, JAWNA LICZBA I PYTANIA DO WŁAŚCICIELA

Raport zawiera: wynik `tsc` przed i po z **obiema** wersjami komendy i kodami wyjścia ·
odpowiedź o dwóch żywych konsumentach bramki · **jawne zdanie „`H1` potwierdzona / obalona"** ·
opis obu bezpieczników z uzasadnieniem wyboru drogi · **cztery pary mutacyjne dosłownie** ·
inwentarz rodziny z liczbą „żywe ∧ obliczone" · listę rozbieżności wobec liczb tej instrukcji ·
**niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE"** · obowiązkowy akapit `§0.2e` dla każdego
uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „CO NADAL WYMAGA OSOBNEGO ZLECENIA".** Rodzina 109 plików
nie jest naprawiana w tym dyżurze — wypisujesz, ile z niej żyje, ile rodzin naprawczych to
obejmuje i jaki jest wzór naprawy (jeden diff).

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA".** Jeżeli uznasz, że bezpiecznik
powinien wejść do CI jako bramka blokująca — **piszesz to tutaj jako pytanie rozstrzygalne
(„tak"/„nie"), i NIE podłączasz go samodzielnie** (`Z38`/`Z39`). Sekcja może być pusta, ale
wtedy piszesz wprost: „nie mam zastrzeżeń".

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sprawdź ją komendą
`bash -c "grep -nE '^## [A-Z]\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle piszą inni autorzy (dziś sekcje doszły do `Q`).

**Commit po `R5`.**

## Próg odbioru

**Mutacja „obliczony dostęp" czerwieni. Mutacja „usunięcie `ariaLabel`" czerwieni. Inwentarz
rodziny z podziałem żywe/martwe istnieje i podaje jawną liczbę „żywe ∧ obliczone".**

Odbiorca odrzuci dyżur, w którym bezpiecznik pokazano tylko na zielono; w którym bezpiecznik
typów brzmi „cały projekt = 0" (bo dziś jest 92 i nigdy nie przejdzie); w którym `tsc`
uruchomiono bez ustawionej sterty i pusty wynik odczytano jako zero błędów; w którym
`ariaLabel` zrobiono opcjonalnym zamiast dopisać go pięć razy; albo w którym inwentarz
rodziny opisuje próbkę, a mówi o całości.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „pięć wywołań naprawione,
`H1` rozstrzygnięta pomiarem, jeden bezpiecznik zbudowany z parą mutacyjną, drugi nie —
bo wymaga decyzji o czasie budowy" — **jest pełnowartościowym wynikiem.**

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Dołóż bezpiecznik typów" vs „w projekcie jest 92 błędy" | `R1` punkt 4: bezpiecznik jest **PUNKTOWY**, obejmuje jawną listę plików; próg „cały projekt = 0" jest jawnie zakazany jako niewykonalny |
| „Napraw typy" vs „nie osłabiaj kontraktu" | `R0` (3) i tabela licencji: naprawa idzie po stronie **wołających** (dopisanie `ariaLabel`), nie przez `ariaLabel?: string` ani przez `exclude` w `tsconfig.json` |
| „Napisz test flagi, który czerwieni się od cofnięcia" vs „test uruchomieniowy tego nie odróżni" | `R2` punkt 1: **najpierw mierzysz, czy odróżnia**; jeżeli nie — bezpiecznik jest statyczny albo budujący; jeżeli odróżnia, moja teza jest obalona i budujesz tańszy |
| „Bezpiecznik ma być w CI" vs `Z38`/`Z39` (zakaz ruszania CI) | Tabela licencji, wiersz „CI": dostarczasz **skrypt + test**, podłączenie rekomendujesz jako diff **nienałożony** i jako pytanie do właściciela w `R5` |
| „Zinwentaryzuj rodzinę" vs „nie naprawiasz rodziny" | `R4` punkt 5: produktem jest **lista + jeden diff wzorcowy nienałożony**; naprawa rodziny to osobne zlecenie |
| „Mutuj flagę" vs `Z10` (zakaz zmiany wartości domyślnych flag) | `POZYCJE_Z_FLAGAMI` i `R2` punkt 3: mutacja dotyczy **sposobu dostępu**, nie wartości domyślnej; wartość domyślna `false` zostaje nietknięta, a mutacja jest cofana przez `cp` |
| „Cofaj mutacje" vs `Z27` (zakaz `git stash`) | `R1` punkt 5, `R2` punkt 3, `R3` punkt 1: mutację cofasz przez `cp` ze `SCRATCH`; `git diff` po cofnięciu ma być pusty |
| „Zmierz rodzinę" vs „nie orzekaj na próbce" | `R4` punkt 3: jeżeli sprawdzasz część, piszesz **ile z ilu i którą**; próbka podana jako całość jest podstawą odrzucenia |
| „Instrukcja mówi ok. 124 pliki" vs „mój pomiar mówi 109" | Sekcja „MOJA HIPOTEZA", teza `H3`: autor obalił liczbę zlecenia przy wydaniu; wiążący jest pomiar wykonawcy (`Z24`) |
| „Nie dotykasz konsumentów bramki" vs „mogą wołać ją bez `ariaLabel`" | `R1` punkt 3: to jest **znalezisko do raportu z diffem nienałożonym**, nie naprawa; pozycja z takim produktem jest ZROBIONA |
| „Dopisz sekcję do rejestru znalezisk" vs „równolegle piszą inni autorzy" | `R5`: literę sekcji sprawdzasz komendą **tuż przed commitem**, nie zakładasz z góry |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 11 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — plik testu (5 wywołań), komponent i bramka, flaga, trzy pliki `tests/unit/flags/`, dwaj żywi konsumenci, `scripts/dev/reachability-from-root.mjs` sprawdzone przy wydaniu; `evidence/day356/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 10 wierszy; wiersze 1-7 i 10 zmierzone przy wydaniu na markerze, w tym awaria OOM `tsc` |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — kontrakt typów · test bramki · flaga panelu · rodzina flag · żywi konsumenci · nowe testy i bezpieczniki · istniejące testy flag · konfiguracja typów · infrastruktura testów · CI · serwer · słowniki · dowody · rejestr znalezisk · raport · macierze · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` zmienia jeden plik testowy, `R2` mutuje i cofa jeden plik flagi, `R3` tylko mierzy, `R4` tylko inwentaryzuje |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `6415`/`5555` wolne (`lsof` przy wydaniu), brak kontenera `cx-day356-pg`, brak gałęzi `codex/day356-*` i worktree; 355/357/358 mają rozłączne porty i rozłączne pliki; dyżury 351-354 mają rozłączny temat |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera, łącznie z obiema wersjami `tsc` |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: **OOM `tsc` przy domyślnej stercie dający pusty plik czytany jako zero**, `vi.stubEnv` zacierające różnicę statyczny/obliczony, węższy wzorzec `grep` zaniżający rodzinę osiemnastokrotnie, `grep --include` w `zsh`, metoda „plik bez importera" licząca martwe poddrzewo jako żywe |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
