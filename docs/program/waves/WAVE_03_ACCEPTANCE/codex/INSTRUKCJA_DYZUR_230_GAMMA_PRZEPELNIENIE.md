> ★★ **MARKER PODNIESIONY (1.09, nadzorca).** Był `9fb7942a01`, jest `0a35699021`.
> Powód: dyżur stanął na braku miejsca na dysku **przed** wykonaniem czegokolwiek,
> a w międzyczasie scalono **218, 219, 226 i 231**. Miejsce zwolnione (14 GiB).
> **Stan wejściowy jest NOWSZY niż opisy w treści tej instrukcji** — zmierz go sam
> na starcie i nie ufaj listom plików ani numerom linii w treści.
> Szczególnie: 226 zmienił obsługę zapisu motywu w `presentations.routes.ts`,
> a 231 dołożył `presentationKnowledgeOutlineService.ts` i zmienił
> `presentationGeneratorService.ts` — jeśli Twój dyżur dotyka tych plików,
> **przeczytaj je na nowo, zanim cokolwiek zmienisz**.

# INSTRUKCJA DYŻURU nr 230 — Codex — „Wykrycie przepełnienia slajdu PRZED eksportem i uczciwe ostrzeżenie ze WSKAZANIEM SLAJDU — wzorzec skopiowany z Gammy, potwierdzony na jej własnym eksporcie („1 slide has overflowing content — layouts may shift after exporting to PowerPoint and Google Slides" + przycisk „Go to slides"). Zakaz ratowania automatycznym zmniejszaniem tekstu: `fit:'shrink'` jest dziś emitowane **17 razy** (10 z tego w `DeckStyler`), a sam kod produktu w dwóch miejscach przyznaje, że ten mechanizm bywa przez renderery **ignorowany** — czyli dziś produkt jednocześnie psuje typografię i nie ratuje układu. Do tego trzy stopnie jakości eksportu i rozstrzygnięcie „PDF dla odbiorcy, PPTX dla edytującego""

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
> **wyłącznie** `/private/tmp/cx-day230-gamma-przepelnienie`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `0a35699021`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-01.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****EKSPORT DECKU — WYKRYCIE PRZEPEŁNIENIA I KONTRAKT OSTRZEŻENIA.** Zmierzone na markerze `0a35699021`: wykrywanie przepełnienia **istnieje**, ale w trzech rozłącznych, heurystycznych warstwach, z których żadna nie mierzy realnego renderu i żadna nie mówi użytkownikowi prawdy przed eksportem. (a) estymacja znakowa w torze zapasowym: `server/src/services/deliverables/DeckStyler.ts:266` (`estimateCharCapacity`, model `glyphAdvance = em*0.52` `:269`, `lineHeight = em*1.25` `:270`), `:289` (`fitProse` — pętla zmniejszająca font `:299-303`, potem twarde ucięcie na granicy słowa + `overflowNote` do notatek `:304-313`), `:212` (`enforceBulletDiscipline`, limity `:179-180`). (b) pomiar szerokości per-glif w torze produkcyjnym: `server/src/services/report/pptx/atomics/SlideTitle.ts:40` (`widthOf`), `:46` (`balancedSplitIndex`), `:80` (`fitTitle`, podłoga `max(16, 0.72*base)` `:93-97`). (c) audyt budżetów znakowych POZA renderem: `server/src/services/presentationStudioLayoutAuditService.ts:45-47` (flagi `layout_overflow_title` / `layout_overflow_key_message` / `layout_overflow_blocks`), detekcja `:296-318`; budżety `server/src/services/presentationStudioLayoutCapacityRegistryService.ts:85-99`; znacznik na slajdzie `server/src/services/report/pptx/composites/LayoutTruncationMarker.ts:92` i `:108`, wstrzykiwany w `server/src/services/report/pptx/PptxPipelineService.ts:363-370`. Wzorzec do skopiowania: `docs/program/funkcje/GAMMA_G3_OBCHOD_MENU.md` („Gamma sama ostrzega, że PPTX się rozjedzie" — treść ostrzeżenia, przycisk, trzy stopnie jakości `Basic`/`Standard`/`Detailed`, formaty PDF · PowerPoint · Google Slides). Zakaz `Z16`: `docs/program/funkcje/GAMMA_G1_SPECYFIKACJA.md` §3.2 („auto-shrink tekstu żeby wcisnąć treść" — rozjeżdża drabinę C4 i stosunek C5; **slajd ma się dzielić, nie kurczyć**)**.
Trasy front: `Ten dyżur **nie buduje nowego ekranu produktowego**; buduje **ostrzeżenie w istniejącym**. Zmierz sam, gdzie realnie renderuje się panel eksportu na Twojej bazie — punkty wejścia to `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` (flaga MELS `:48`, bramki jakości `:386`, `:668`), `src/components/Presentations/DeckBuilder/DeckQualityGatesPanel.tsx`, `src/components/Presentations/DeckBuilder/DeckBuilderTopBar.tsx`, `src/components/Presentations/wizard/ResultStep.tsx:21`, `src/services/presentationExport.ts`. ★ **Ósmy kształt fałszywego gotowe:** grep znajduje wołacza API, a komponent nigdy nie jest renderowany. **Udowodnij montaż**, nie istnienie pliku. Zrzut: ekran `dev-render/screens/day230-przepelnienie.tsx` + wpis w `dev-render/main.tsx` — ostrzeżenie w dwóch stanach (deck z przepełnieniem / deck czysty), w dwóch motywach. Tokeny `c-*`, zero `primary-*` (`primary` w tailwindzie tego produktu = crimson `#85182F`, `CLAUDE.md` §3)`. Trasy tył: ``GET /api/presentations/decks/:id/download` (`server/src/routes/presentations.routes.ts:2569`) · `GET /api/presentations/decks/:deckId/export/pdf` (`:2832`, silnik `pdfkit` — `:12`, `:2973`, **nie** konwersja z PPTX) · `POST /api/presentations/decks/:deckId/export/html` (`:3649`) · `POST /api/presentations/decks/:deckId/export/png` (`:7657`) · `GET /api/presentations/decks/:deckId/export-parity` (`:3768` — ★ zmierz, co ta trasa dziś robi, bo jej nazwa obiecuje dokładnie Twój temat) · `POST /api/presentations/decks/:deckId/quality-gates` (`:7640`). Bramka: `server/src/routes/presentationExportGate.ts:24` — **to jest naturalne miejsce montażu ostrzeżenia**, ale ostrzeżenie **nie jest** blokadą: `422 QUALITY_GATE_BLOCKED` zostaje zarezerwowane dla dzisiejszych bramek jakości, a przepełnienie ma **ostrzegać, nie odmawiać** (u Gammy eksport też się wykonuje). Router: `server/src/Gateway.ts:1201``.

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
WT=/private/tmp/cx-day230-gamma-przepelnienie
MARKER=0a35699021

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day230-gamma-przepelnienie-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day230-gamma-przepelnienie/config.worktree"
cat "$VAULT/worktrees/cx-day230-gamma-przepelnienie/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day230-gamma-przepelnienie-scratch
mkdir -p /private/tmp/cx-day230-gamma-przepelnienie-artefakty

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
git -C "$VAULT" log --oneline 0a35699021..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 0a35699021..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day230-gamma-przepelnienie-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 0a35699021..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `8` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: `fit:'shrink'` ma 17 REALNYCH emisji, 10 z nich w DeckStyler
grep -rn "fit: *'shrink'" --include='*.ts' server/ | grep -v node_modules | tee /dev/stderr | wc -l
grep -c "fit: *'shrink'" server/src/services/deliverables/DeckStyler.ts
#   oczekiwane: 17 lacznie; 10 w DeckStyler.ts (linie ok. 425,545,592,680,756,781,902,994,1017,1091).
#   Pozostale 7: PptxPipelineService.ts:490, atomics/SlideTitle.ts:143, atomics/KpiValue.ts:66,
#   atomics/Highlight.ts:43, atomics/Badge.ts:42, services/export/UnifiedExportService.ts:693

# (2) TEZA: WLASNY KOD PRODUKTU mowi, ze `fit:'shrink'` bywa ignorowany
sed -n '24,28p' server/src/services/report/pptx/atomics/KpiValue.ts
sed -n '12,16p' server/src/services/report/pptx/atomics/SlideTitle.ts
#   oczekiwane: komentarze o tym, ze normAutofit nie jest honorowany przez wszystkie renderery
#   ("Kept as a defensive fallback only")

# (3) TEZA: audyt przepelnienia ISTNIEJE, ale poza renderem i bez ostrzezenia dla uzytkownika
grep -n "layout_overflow" server/src/services/presentationStudioLayoutAuditService.ts
sed -n '85,99p' server/src/services/presentationStudioLayoutCapacityRegistryService.ts
#   oczekiwane: trzy flagi ok. :45-47, detekcja ok. :296-318; budzety znakowe per tryb
#   (visual titleMaxChars 80 / keyMessage 160 / blocks 4; balanced 90/240/6; document 110/360/8)

# (4) TEZA: znacznik uciecia jest wstrzykiwany W SLAJD, czyli PO fakcie, nie PRZED eksportem
sed -n '363,371p' server/src/services/report/pptx/PptxPipelineService.ts
grep -n "decideLayoutTruncationMarker\|buildLayoutTruncationMarker" server/src/services/report/pptx/composites/LayoutTruncationMarker.ts
#   oczekiwane: wstrzykniecie ok. :363-370; funkcje ok. :92 i :108

# (5) TEZA: ZERO testow regresyjnych na przepelnienie
grep -rln "overflow" --include='*.test.ts' server/src tests/ | grep -iE 'pptx|deck|present' | head
#   oczekiwane: ZERO plikow testowych mierzacych przepelnienie w wyprodukowanym pliku.
#   Jezeli cokolwiek znajdziesz — przeczytaj i wpisz do "Korekt wobec instrukcji"

# (6) TEZA: PDF NIE POWSTAJE z PPTX — to osobny renderer, wiec „parytet" nie jest darmowy
grep -n "pdfkit\|new PDFDocument" server/src/routes/presentations.routes.ts | head
#   oczekiwane: import ok. :12, konstrukcja ok. :2973 — czyli PDF i PPTX to dwa rozne rendery

# (7) TEZA: istnieje trasa o nazwie obiecujacej parytet eksportu — zmierz, co robi NAPRAWDE
sed -n '3768,3800p' server/src/routes/presentations.routes.ts
#   oczekiwane: GET /decks/:deckId/export-parity. Twoje ustalenie, co ta trasa dzis liczy,
#   wchodzi do raportu — bo albo ja rozszerzasz, albo uzasadniasz, czemu nie

# (8) TEZA: NIE MA trzech stopni jakosci eksportu
grep -rn "'basic'\|'standard'\|'detailed'\|exportQuality\|quality: *'" --include='*.ts' server/src/routes/presentations.routes.ts | head
#   oczekiwane: ZERO trafien opisujacych stopien jakosci eksportu (istniejace 'quality-gates'
#   to co innego — bramki tresci, nie jakosc pliku)
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day230-gamma-przepelnienie-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6174`. Twój JEDYNY port harnessu to `5136 i 5137`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day230-pg`**. **ZAKAZANE:** `5000 (macOS Control Center, zajety na stale), 5037 (adb), 5060-5061, 6012, 5433, 6047, 6054-6172, 5010-5133, 6404-6411 — oraz porty pozostalych dyzurow fali 18, ktore sa cudze: bazy 6173-6176 i harness 5134-5141 z wyjatkiem Twoich, wymienionych w tym wierszu wyzej. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w ``R2`/`R3` — dokładnie JEDNA nowa flaga `ENABLE_DECK_OVERFLOW_WARNING`, **default OFF**, wzorem `server/src/config/FeatureFlags.ts:55` i `:247-248`. Wyłączenie `fit:'shrink'` (`R5`) idzie **pod tę samą flagę**, nie pod własną. Zakaz zmiany wartości domyślnej jakiejkolwiek istniejącej flagi`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/services/aiRoleGuard.ts` · `server/src/services/chatPermissionService.ts` · `server/src/services/aiPolicyEngine.ts` · `server/src/services/aiRunLedgerService.ts` · `server/src/services/ai/chatPolicyGateway.ts` · `server/src/services/ai/webSearchGovernance.ts` · `server/src/services/ai/sideEffectTools.ts` · `server/src/services/ai/knowledgeDocAccessFilter.ts` · `server/src/routes/presentationExportGate.ts` · `server/src/middleware/auth.middleware.ts` · `server/src/middleware/v8FeatureGate.middleware.ts` · `server/src/middleware/resultsInternalBetaVisibility.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY230_GAMMA_PRZEPELNIENIE_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — ten dyżur buduje za flagą domyślnie WYŁĄCZONĄ i **nie domyka odbioru żadnego modułu**; odbiór należy do nadzorcy po akcepcie właściciela na zrzucie. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day230-gamma-przepelnienie-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day230-gamma-przepelnienie-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ RATOWANIA PRZEPEŁNIENIA AUTOMATYCZNYM ZMNIEJSZANIEM TEKSTU.** Przy fladze ON przepełnienie ma być **nazwane**, nie schowane. Nie wolno: dokładać nowych `fit:'shrink'`, obniżać podłóg stopni w `fitTitle` (`SlideTitle.ts:93-97`), zwiększać `minSize` w `fitProse` (`DeckStyler.ts:299-303`) ani cicho ucinać treści bez wpisu w ostrzeżeniu | `GAMMA_G1_SPECYFIKACJA.md` §3.2 `Z16`: auto-shrink rozjeżdża drabinę stopni (C4) i stosunek tytuł:treść (C5) na jednym slajdzie naraz. Gorzej: własny kod produktu w dwóch miejscach przyznaje, że `fit:'shrink'` bywa przez renderery **ignorowany** (`server/src/services/report/pptx/atomics/KpiValue.ts:27` oraz `atomics/SlideTitle.ts:13-15` — „Kept as a defensive fallback only"). Czyli dziś produkt płaci pełną cenę typograficzną za mechanizm, który **nie działa** |

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
cd /private/tmp/cx-day230-gamma-przepelnienie

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day230-pg psql -U postgres -d cx230 \
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
cd /private/tmp/cx-day230-gamma-przepelnienie

docker run -d --name cx-day230-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx230 \
  -p 127.0.0.1:6174:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day230-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6174/cx230 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6174/cx230 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day230-gamma-przepelnienie && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6174/cx230 \
JWT_SECRET=cx230-lokalny-sekret-testowy-nie-uzywany-nigdzie-indziej \
npx vitest run server/src/services/report/pptx/__tests__ server/src/routes/__tests__ tests/unit/deliverables --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day230-gamma-przepelnienie-artefakty/day230-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day230-gamma-przepelnienie && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/report/pptx/__tests__ server/src/routes/__tests__ tests/unit/deliverables --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day230-gamma-przepelnienie-artefakty/day230-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day230-gamma-przepelnienie/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day230-pg psql -U postgres -d cx230 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day230-pg`.
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
> **(e) **Bramka `enforceQualityGateForExport` (`server/src/routes/presentationExportGate.ts:24`) odcina eksport kodem `422 QUALITY_GATE_BLOCKED` PRZED renderem, a override ma wyłącznie rola ADMIN/OWNER/SUPERADMIN (`:12`, `:14`).** Twoje `422` w pakiecie dowodowym może pochodzić z bramki, a nie z Twojego kodu — i wtedy „ostrzeżenie nie wyszło" jest fałszywym wnioskiem. Rozstrzygnij to komendą i wpisz do raportu**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day230-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day230-gamma-przepelnienie-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (pomiar `fit:'shrink'` i rozstrzygnięcie) · R2 (detektor) · R3 (kontrakt ostrzeżenia ze slajdem)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6174` albo `5136 i 5137` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6174` albo `5136 i 5137`** (`Z7`).

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

# 1. PO CO TEN DYŻUR ISTNIEJE

Gamma — wzorzec, którego pod względem formy nie umiemy dogonić — **sama, bez pytania, ostrzega
użytkownika, że jej własny eksport do PowerPointa się rozjedzie**. Zaobserwowane na koncie
właściciela, na naszym własnym decku, w panelu eksportu
(`docs/program/funkcje/GAMMA_G3_OBCHOD_MENU.md`):

> ⚠ **„1 slide has overflowing content"** — *„Layouts may shift after exporting to PowerPoint and
> Google Slides"* — z przyciskiem **„Go to slides"**.

To jest potwierdzenie z najlepszego możliwego źródła. Analityk przewidział ten problem przed
pomiarem („podmiana kroju zmienia złamania wierszy"; „identyczny render w PowerPoint / Keynote /
Google Slides / LibreOffice — **NIEMOŻLIWE**" — `docs/program/funkcje/GAMMA_G1_SPECYFIKACJA.md`
§6.1-6.2). Teraz wiemy, że **Gamma ma dokładnie ten sam problem i nie udaje, że go nie ma.**

**Ich rozwiązanie kopiujemy 1:1:** wykryj przepełnienie **przed** eksportem, powiedz o tym wprost,
**wskaż slajd**. Nie milcz i **nie próbuj ratować autodopasowaniem**, które i tak psuje typografię.

Ten dyżur robi dokładnie to. Nie robi motywu (229), nie robi treści (231), nie robi agenta (232).

## ★★ Pomiar, który zmienia treść zamówienia — wykonany na SHA `0a35699021`

**Sprawdź każdą liczbę u siebie** (komendy w `§0`); rozbieżność idzie do „Korekt wobec instrukcji".

1. **`fit: 'shrink'` jest emitowane 17 razy — i produkt sam wie, że to nie działa.**
   Zmierzone: **17 realnych emisji** w `server/`, z czego **10 w jednym pliku**:
   `server/src/services/deliverables/DeckStyler.ts` — linie `425, 545, 592, 680, 756, 781, 902,
   994, 1017, 1091`. Pozostałe siedem: `server/src/services/report/pptx/PptxPipelineService.ts:490`,
   `…/atomics/SlideTitle.ts:143`, `…/atomics/KpiValue.ts:66`, `…/atomics/Highlight.ts:43`,
   `…/atomics/Badge.ts:42`, `server/src/services/export/UnifiedExportService.ts:693`.
   **★★ A teraz rzecz najważniejsza: własny kod produktu w DWÓCH miejscach przyznaje, że ten
   mechanizm bywa przez renderery IGNOROWANY** — `atomics/KpiValue.ts:27` i
   `atomics/SlideTitle.ts:13-15` („Kept as a defensive fallback only").
   **Czyli dziś płacimy pełną cenę typograficzną za zabezpieczenie, które nie zabezpiecza.**
   To jest zmierzona podstawa zakazu z `GAMMA_G1_SPECYFIKACJA.md` §3.2 `Z16`
   (*„auto-shrink tekstu żeby wcisnąć treść"* — rozjeżdża drabinę stopni C4 i stosunek C5 naraz;
   **slajd ma się dzielić, nie kurczyć**).

2. **Wykrywanie przepełnienia ISTNIEJE — w trzech rozłącznych warstwach, żadna nie mówi prawdy
   użytkownikowi przed eksportem.**
   - **(a) estymacja znakowa, tor zapasowy:** `DeckStyler.ts:266` (`estimateCharCapacity` —
     model `glyphAdvance = em*0.52` `:269`, `lineHeight = em*1.25` `:270`), `:289` (`fitProse` —
     pętla zmniejszająca font od `base` do `minSize` `:299-303`, potem **twarde ucięcie na granicy
     słowa** + `overflowNote` **do notatek prelegenta** `:304-313`), `:212`
     (`enforceBulletDiscipline`, limity `:179-180`: max 5 pozycji × 8 słów, nadmiar → `notes` `:226`).
     ★ Czyli dziś przepełniona treść **wędruje do notatek**, a użytkownik nie dostaje ani słowa.
   - **(b) pomiar szerokości per-glif, tor produkcyjny:** `atomics/SlideTitle.ts:40` (`widthOf`),
     `:46` (`balancedSplitIndex` — kontrola wdów), `:80` (`fitTitle`, podłoga stopnia
     `max(16, 0.72*base)` `:93-97`). To **jedyne** miejsce w torze produkcyjnym z realnym modelem
     szerokości tekstu. Sąsiedni plik sam ocenia jego jakość: `atomics/Bullet.ts:46-47` —
     *„Damp to 75 % of the measured slack — the char-width estimate is rough"*.
   - **(c) audyt budżetów znakowych POZA renderem:**
     `server/src/services/presentationStudioLayoutAuditService.ts:45-47` — flagi
     `layout_overflow_title` / `layout_overflow_key_message` / `layout_overflow_blocks`,
     detekcja `:296-318` (porównanie `String.length` z budżetem); budżety
     `server/src/services/presentationStudioLayoutCapacityRegistryService.ts:85-99`
     (`visual`: tytuł 80 zn. / kluczowa myśl 160 / bloki 4; `balanced`: 90/240/6;
     `document`: 110/360/8); priorytet flag
     `server/src/services/report/audit/layoutAuditFlagPriority.ts:29-31`.
     Znacznik ucięcia **na slajdzie**: `…/composites/LayoutTruncationMarker.ts:92`
     (`decideLayoutTruncationMarker`) i `:108` (`buildLayoutTruncationMarker`), wstrzykiwany
     w `PptxPipelineService.ts:363-370`, wariant PDF w `presentations.routes.ts:3000-3005`.
   - **Twarde limity treści** (nie przepełnienie, ale sąsiad): `…/pptx/RulesEngine.ts:57-61`
     (`MAX_TITLE_WORDS`), `:97` (`MAX_KPI_DASHBOARD`), `:233` (`MAX_INITIATIVES_PER_SLIDE`),
     `:269` (`MAX_PRIORITIZATION_ITEMS`).

3. **Czego NIE MA — i to jest Twoja robota.** Zero weryfikacji przepełnienia **po wygenerowaniu
   bajtów**. Zero ostrzeżenia dla użytkownika **przed** eksportem. Zero testu regresyjnego
   na przepełnienie. Zero `measureText` / metryk kroju / canvas.

4. **PDF NIE POWSTAJE z PPTX — to dwa niezależne renderery.**
   `GET /api/presentations/decks/:deckId/export/pdf` (`server/src/routes/presentations.routes.ts:2832`)
   używa **`pdfkit`**: `import PDFDocument from 'pdfkit'` (`:12`),
   `new PDFDocument({ margin: 48, size: 'A4' })` (`:2973`), fonty PL `registerPdfFonts(doc)` (`:2975`).
   PPTX idzie zupełnie inną drogą (`:2569` → `:604-607` → `PptxPipelineService`).
   **Czyli zdanie „PDF dla odbiorcy, PPTX dla edytującego" nie jest u nas dziś darmowe** — to nie
   są dwa formaty tego samego renderu, tylko dwa różne produkty. **Zmierz i nazwij to.**

5. **Istnieje trasa o nazwie obiecującej dokładnie Twój temat:**
   `GET /api/presentations/decks/:deckId/export-parity` (`presentations.routes.ts:3768`).
   **Zmierz, co ta trasa dziś naprawdę liczy** — albo ją rozszerzasz, albo uzasadniasz, czemu nie.
   Nie zakładaj z nazwy (w tym programie ma to nazwę: flaga-fantom).

6. **Trzech stopni jakości eksportu nie ma.** U Gammy są: `Basic` (mniejszy plik, niższa jakość) ·
   `Standard` (domyślny, rekomendowany) · `Detailed` (najlepsza jakość, duży plik); formaty
   PDF · PowerPoint · Google Slides. U nas formaty istnieją cztery (PPTX `:2569`, PDF `:2832`,
   HTML `:3649`, PNG `:7657`), stopni jakości — zero. Istniejące „quality-gates" (`:7640`,
   `server/src/routes/presentationExportGate.ts:24`) to **co innego**: bramki treści, nie jakość pliku.

## Czego ten dyżur świadomie NIE robi

- **Nie buduje pełnego silnika metryk kroju.** Pomiar mówi wprost, że policzenie wysokości tekstu
  z metryk (fontTools / HarfBuzz / PIL) to **główny koszt inżynierski całej specyfikacji**
  (`GAMMA_G1_SPECYFIKACJA.md` §6.1, wiersz C2). Ty robisz **detektor uczciwy w granicach tego,
  co da się policzyć dziś** — i **nazywasz jego margines błędu**.
- **Nie blokuje eksportu.** Ostrzeżenie **ostrzega**, nie odmawia. U Gammy eksport też się wykonuje.
  `422 QUALITY_GATE_BLOCKED` zostaje zarezerwowane dla dzisiejszych bramek jakości.
- **Nie ujednolica PDF-a z PPTX-em.** Mierzysz rozjazd, opisujesz go, nie naprawiasz.

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | `fit:'shrink'` ma 17 realnych emisji, 10 w `DeckStyler` | komenda (1) |
| T2 | Własny kod produktu mówi, że `fit:'shrink'` bywa ignorowany | komenda (2) |
| T3 | Audyt przepełnienia istnieje, ale poza renderem i bez ostrzeżenia | komenda (3) |
| T4 | Znacznik ucięcia trafia **w slajd**, czyli po fakcie, nie przed eksportem | komenda (4) |
| T5 | Zero testów regresyjnych na przepełnienie | komenda (5) |
| T6 | PDF to osobny renderer (`pdfkit`), nie konwersja z PPTX | komenda (6) |
| T7 | Trasa `export-parity` istnieje — co robi naprawdę, ustalasz Ty | komenda (7) |
| T8 | Trzech stopni jakości eksportu nie ma | komenda (8) |

---

# 3. POZYCJE DYŻURU

## R1 — POMIAR I ROZSTRZYGNIĘCIE `fit: 'shrink'` (rdzeń; **rozstrzygasz Ty, z liczbami**)

**Obowiązkowa TABELA nr 1 w raporcie: siedemnaście wierszy.** Dla każdej emisji `fit: 'shrink'`
(`plik:linia`) podajesz: (a) czy leży na torze produkcyjnym (pobranie decku) czy zapasowym;
(b) co konkretnie chroni; (c) czy **usunięcie jej zmienia wygląd** — udowodnione renderem, nie
domysłem.

Potem **rozstrzygasz jedną z trzech dróg** i uzasadniasz liczbami:

- **(A)** przy fladze ON `fit: 'shrink'` **znika z toru produkcyjnego**, a przepełnienie jest
  **nazwane** w ostrzeżeniu;
- **(B)** `fit: 'shrink'` zostaje, ale ostrzeżenie mówi wprost, **na których slajdach zadziałał** —
  czyli „ten slajd wygląda inaczej, niż zaprojektowano";
- **(C)** droga mieszana: znika tam, gdzie renderer go i tak ignoruje (`SlideTitle`, `KpiValue` —
  komentarze `:13-15`, `:27`), zostaje tam, gdzie działa.

★★ **Nie wolno Ci wybrać drogi „zostawiamy i milczymy".** To jest dokładnie ta rzecz, którą Gamma
robi lepiej od nas i po którą tu jesteś.

★ **Zakaz kierunkowy:** cokolwiek wybierzesz, **nie wolno dokładać nowych `fit: 'shrink'`,
obniżać podłóg stopni** w `fitTitle` (`SlideTitle.ts:93-97`) **ani podnosić `minSize`** w
`fitProse` (`DeckStyler.ts:299-303`). Przepełnienie ma być widoczne, nie zamiecione.

## R2 — DETEKTOR PRZEPEŁNIENIA, KTÓRY DZIAŁA **PRZED** EKSPORTEM (rdzeń)

Jedna funkcja, jedno źródło prawdy, wołana **przed** oddaniem pliku:

```
wykryjPrzepelnienie(deck) -> Array<{
  slideIndex: number,        // 1-based, bo taki numer widzi człowiek
  slideTitle: string,
  powod: 'tytul' | 'tresc' | 'kafel' | 'liczba' | 'lista',
  zmierzone: number,         // ile znaków / wierszy wyszło
  budzet: number,            // ile się mieści
  pewnosc: 'wysoka' | 'niska'
}>
```

**Skąd bierzesz liczby — z tego, co JUŻ jest, nie z nowego silnika:**
budżety znakowe `presentationStudioLayoutCapacityRegistryService.ts:85-99`; model szerokości
`atomics/SlideTitle.ts:40` (`widthOf`); pojemność `DeckStyler.ts:266` (`estimateCharCapacity`);
detekcja flag `presentationStudioLayoutAuditService.ts:296-318`.

★★ **POLE `pewnosc` JEST OBOWIĄZKOWE I NIE JEST OZDOBĄ.** Nie mamy metryk kroju, więc nasz pomiar
jest **oszacowaniem**. Ostrzeżenie, które udaje pewność, której nie ma, jest gorsze od braku
ostrzeżenia — bo uczy użytkownika, że nasze ostrzeżenia można ignorować.
Podłoga: `atomics/Bullet.ts:46-47` sam nazywa estymację „rough" i tłumi ją do 75 %.
**W raporcie podajesz zmierzony margines błędu detektora** na przynajmniej pięciu realnych
slajdach — porównując przewidywanie z realnym renderem (`soffice` → PDF → `pdftoppm` → PNG,
`/opt/homebrew/bin/soffice` i `/opt/homebrew/bin/pdftoppm` są obecne, zmierzone).

## R3 — KONTRAKT OSTRZEŻENIA: TREŚĆ, MIEJSCE, NUMER SLAJDU (rdzeń)

**Treść ostrzeżenia — wzorzec Gammy, po polsku, bez upiększania:**

> ⚠ **1 slajd ma treść, która się nie mieści.** Układ może się rozjechać po eksporcie do
> PowerPointa i Google Slides. → **Przejdź do slajdu 7**

Wymagania twarde:
1. **Liczba slajdów** („1 slajd" / „3 slajdy" — poprawna polska odmiana).
2. **Numer slajdu, 1-based** — i **działające przejście** do niego, nie sam tekst.
3. **Pojawia się PRZED eksportem**, nie po pobraniu pliku.
4. **Deck poprawny ⇒ CISZA.** Zero ostrzeżenia, zero pustej ramki, zero „0 slajdów ma problem".
5. **Nie blokuje.** Użytkownik może wyeksportować mimo ostrzeżenia.
6. Tokeny `c-*`; **zero `primary-*`** (`primary` w tym tailwindzie = crimson `#85182F`,
   `CLAUDE.md` §3) — ostrzeżenie jest **żółte/neutralne**, nie czerwone; czerwień to semantyka
   krytyczna, a przepełniony slajd nie jest awarią.

**Miejsce montażu:** ustalasz **pomiarem, nie grepem**. Kandydaci:
`server/src/routes/presentationExportGate.ts:24` (naturalne, bo już stoi przed eksportem —
ale **ostrzeżenie nie jest blokadą**, więc nie wolno Ci go zwrócić jako `422`),
`src/components/Presentations/DeckBuilder/DeckQualityGatesPanel.tsx`,
`src/components/Presentations/DeckBuilder/DeckBuilderTopBar.tsx`,
`src/components/Presentations/wizard/ResultStep.tsx:21`, `src/services/presentationExport.ts`.

★★ **Ósmy kształt fałszywego gotowe:** grep znajduje wołacza API, a komponent nigdy nie jest
renderowany. **Udowodnij montaż realnym renderem**, nie obecnością pliku.

## R4 — TRZY STOPNIE JAKOŚCI EKSPORTU + ROZSTRZYGNIĘCIE FORMATU (nie-rdzeń, ale zamówione)

Trzy stopnie wzorem Gammy: **podstawowa** (mniejszy plik, niższa jakość) · **standardowa**
(domyślna, rekomendowana) · **szczegółowa** (najlepsza jakość, duży plik).

★ **Zanim je dodasz, odpowiedz liczbami: co u nas realnie różni te stopnie?**
Jeżeli jedyną różnicą byłaby rozdzielczość rastrów tła — powiedz to wprost i zrób trzy stopnie
**tylko dla rastrów**, zamiast udawać, że stopień zmienia coś jeszcze. **Stopień jakości, który
nie zmienia pliku, jest fantomem** i w tym programie ma nazwę.

**Rozstrzygnięcie formatu do raportu (nie do wdrożenia w tym dyżurze):**
**PDF jako format dystrybucji, PPTX dla edytujących.** Uzasadnienie zmierzone:
`pptxgenjs 4.0.1` **nie umie osadzić kroju** (`GAMMA_G0_POMIAR.md`), więc PPTX u odbiorcy
podmieni krój i zmieni złamania wierszy; PDF renderuje typografię tak, jak ją zaprojektowaliśmy.
**Ale u nas PDF to osobny renderer `pdfkit`** (`presentations.routes.ts:12`, `:2973`), więc dziś
**PDF nie jest wiernym obrazem PPTX-a** — i **to jest ustalenie, które musisz nazwać wprost**,
zanim ktokolwiek sprzeda właścicielowi zdanie „mamy PDF, więc wygląd jest bezpieczny".

## R5 — ★★ BRAMKA (rdzeń, sedno dyżuru)

**Dwa przypadki, jeden test, obie strony:**

| Przypadek | Oczekiwane |
|---|---|
| Deck z **celowo przepełnionym slajdem** (np. slajd 3 z treścią 3× ponad budżet) | ostrzeżenie obecne, `slideIndex === 3`, liczba slajdów `1` |
| Deck **poprawny** (każdy slajd w budżecie) | **cisza** — pusta lista, zero ostrzeżeń |

**Para dowodowa, obowiązkowa:**
mutacja **wyłączająca wykrywanie** (np. detektor zwraca zawsze pustą listę) ⇒ **test czerwony**.
Do raportu wchodzą **oba wyjścia** — zielone i czerwone — dosłownie, z nazwami testów.

★★ **Drugi kierunek mutacji jest równie obowiązkowy:** mutacja, która sprawia, że detektor
ostrzega **zawsze**, też musi dać **czerwień** — na przypadku „deck poprawny ⇒ cisza".
Bramka, która wykrywa tylko w jedną stronę, przepuszcza detektor krzyczący na wszystko —
a taki detektor jest gorszy od żadnego, bo uczy ignorowania ostrzeżeń.

★ **Asercja na NUMERZE slajdu, nie na obecności napisu.** Test, który sprawdza
`toContain('nie mieści')`, przechodzi też wtedy, gdy wskazany slajd jest zły. Sprawdzasz
**wartość `slideIndex`**.

## R6 — ZRZUTY (rdzeń dowodowy, `CLAUDE.md` §7)

`dev-render/screens/day230-przepelnienie.tsx` + wpis w `dev-render/main.tsx`.
**Cztery obrazy:** ostrzeżenie obecne × {jasny, ciemny} oraz stan czysty × {jasny, ciemny}.
`mean_luma` każdego, różnica w parze **> 150**.
★ **Stan czysty jest równie ważnym zrzutem jak stan z ostrzeżeniem** — właściciel ma zobaczyć,
że przy poprawnym decku **nic się nie pojawia**.

---

# 4. TABELA LICENCJI PLIKOWYCH

Licencja obejmuje całą ścieżkę: pomiar `shrink` → detektor → kontrakt ostrzeżenia → montaż w UI →
bramka → zrzut.

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/config/FeatureFlags.ts` — WYŁĄCZNIE dodanie `ENABLE_DECK_OVERFLOW_WARNING` (schemat wzorem `:55`, blok ładujący wzorem `:247-248`). **Zakaz zmiany wartości domyślnej jakiejkolwiek istniejącej flagi** |
| Zapis | NOWY plik detektora w `server/src/services/report/pptx/` (nazwa `day230*` albo opisowa) — jedno źródło prawdy dla `R2` |
| Zapis | `server/src/services/report/pptx/PptxPipelineService.ts` — WYŁĄCZNIE: wywołanie detektora i przekazanie wyniku dalej + (jeżeli wybierzesz drogę (A)/(C) w `R1`) zdjęcie `fit: 'shrink'` z `:490` **za flagą**. **Zakaz zmiany `defineMasterSlides` (`:132`) i zakaz zmiany tokenów/stopni/interlinii — to jest zakres dyżuru 229** |
| Zapis | `server/src/services/report/pptx/atomics/SlideTitle.ts` · `KpiValue.ts` · `Highlight.ts` · `Badge.ts` — WYŁĄCZNIE zdjęcie `fit: 'shrink'` **za flagą** zgodnie z rozstrzygnięciem `R1`. **Zakaz zmiany stopni, wag i interlinii** (`SlideTitle.ts:144` = `0.9` zostaje bez zmian) — to cudzy teren (229) |
| Zapis | `server/src/routes/presentations.routes.ts` — WYŁĄCZNIE: dołożenie pola z ostrzeżeniem do odpowiedzi tras eksportu (`:2569`, `:2832`) i — jeżeli `R4` tego wymaga — parametru stopnia jakości. **Zakaz zmiany semantyki `enforceQualityGateForExport`, zakaz zmiany kodów odpowiedzi, zakaz dotykania tras agenta (`:4004`, `:4128`, `:4218` — to dyżur 232) i tras generowania (`:1912`, `:1923` — to dyżur 231)** |
| Zapis | `server/src/services/presentationStudioLayoutAuditService.ts` — dozwolone WYŁĄCZNIE, jeżeli detektor reużywa istniejącej detekcji: **rozszerzenie addytywne**, zakaz zmiany semantyki trzech istniejących flag (`:45-47`) |
| Zapis | Front — WYŁĄCZNIE komponent ostrzeżenia i jego montaż w JEDNYM miejscu wybranym w `R3`; **zakaz przebudowy `DeckBuilder.tsx` i zakaz zmiany zachowania bramek jakości** (`:386`, `:668`) |
| Zapis | NOWY ekran `dev-render/screens/day230-przepelnienie.tsx` + wpis w `dev-render/main.tsx` |
| Zapis | NOWE pliki testowe `day230.*` w `server/src/services/report/pptx/__tests__/`, `server/src/routes/__tests__/`, `tests/unit/deliverables/`. ★ Nowe pliki w `tests/` wymagają `git add -f` |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY230_GAMMA_PRZEPELNIENIE_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/deliverables/DeckStyler.ts` — **mierzysz 10 emisji i opisujesz, nie zmieniasz**; tor zapasowy ma własnych konsumentów (`bundleExportRuntime.ts:224`, `initiativeMaterializeService.ts:488`) i własne testy (`tests/unit/deliverables/deckStyler.test.ts`) |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/presentationExportGate.ts` — bramki jakości nie zmieniasz; **przechodzisz przez nią** |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/report/pptx/composites/LayoutTruncationMarker.ts` · `server/src/services/report/audit/layoutAuditFlagPriority.ts` · `server/src/services/report/pptx/RulesEngine.ts` · `server/src/services/presentationStudioLayoutCapacityRegistryService.ts` — czytasz jako źródło budżetów i wzorzec, nie zmieniasz |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/report/pptx/designTokens.ts` · `layouts/*.ts` — **to jest teren dyżuru 229** |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` · `server/src/database/Database.ts` (`Z18`) |
| Odczyt | `docs/program/funkcje/GAMMA_G3_OBCHOD_MENU.md` · `GAMMA_G1_SPECYFIKACJA.md` (§3.2 `Z16`, §6) · `GAMMA_G0_POMIAR.md` · `GAMMA_G1_OBRAZY.md` · `docs/ui-standards/TRIADA_KANON.md` |

**Nietykalne imiennie:** `presentationExportGate.ts` · `DeckStyler.ts` · `designTokens.ts` ·
`RulesEngine.ts` · `presentationStudioLayoutCapacityRegistryService.ts` · trasy `:1912`, `:1923`,
`:4004`, `:4128`, `:4218` w `presentations.routes.ts` · `vitest.config.ts` · `tests/setup.ts` ·
`Database.ts` · każdy `MODULE_ACCEPTANCE.md`.

**★★ ROZŁĄCZNOŚĆ Z PARTIĄ RÓWNOLEGŁĄ — SPRAWDŹ PRZED PIERWSZYM COMMITEM.**
**Cztery dyżury wydane 01.09 pracują w tym samym module. Granice imienne:**

| dyżur | zakres | Twoja granica wobec niego |
|---|---|---|
| **226** | martwy edytor motywu: `presentations.routes.ts:1566-1567`, `presentationTemplateRuntimeService.ts:372-452` | nie dotykasz tras szablonów |
| **227** | geometria dwóch rendererów: `GRID` w `designTokens.ts`, `DECK_GRID` w `DeckStyler.ts`, `initiativeMaterializeService.ts:488` | nie dotykasz siatki, marginesów ani pola treści |
| **228** | styl obrazu w motywie: `deckVisualsService.ts` (~`:599`), `deckImageResolverService.ts` | nie dokładasz generowania obrazów |
| **229** | ciemny motyw i typografia: `designTokens.ts` (tusz, kroje, stopnie, wagi, interlinia), `atomics/*.ts` | nie dotykasz kolorów, stopni, wag ani interlinii |
| **230** | przepełnienie: `fit: 'shrink'`, detektor, ostrzeżenie | nie dokładasz i nie usuwasz `fit: 'shrink'`, nie duplikujesz detektora |
| **231** | treść z wiedzy: `generateOutline`, prowieniencja decku | nie dotykasz drogi powstawania treści |
| **232** | agent redagujący: trasy `agent-edit`, brama stanu | nie dotykasz tras `agent-edit` |

**Wiersz opisujący TWÓJ dyżur pomijasz — reszta obowiązuje.**

Dyżur **229** wchodzi w `designTokens.ts`, `PptxPipelineService.ts` i `atomics/*.ts` —
czyli w **dwa z trzech** Twoich plików zapisu. Dyżury **226-228** też pracują nad „formą".
Zanim napiszesz pierwszą linię:

```bash
git -C "$WT" log --oneline 0a35699021..github-backup/codex/m03-admin-20260824 -- \
  server/src/services/report/pptx/ server/src/routes/presentations.routes.ts
```

i **zgłoś kolizję zasobową ZANIM zaczniesz pisać, nie po**. Twoja granica z 229 jest prosta:
**Ty dotykasz wyłącznie `fit: 'shrink'` i nic poza tym**; stopnie, wagi, interlinia, kolory
i układy są cudze.

---

# 5. TWARDE ZASADY

- ★★ **ZAKAZ RATOWANIA PRZEPEŁNIENIA AUTOMATYCZNYM ZMNIEJSZANIEM TEKSTU.** Przy fladze ON
  przepełnienie ma być **nazwane**, nie schowane. Nie dokładasz `fit: 'shrink'`, nie obniżasz
  podłogi stopnia w `fitTitle` (`atomics/SlideTitle.ts:93-97`), nie podnosisz `minSize`
  w `fitProse` (`DeckStyler.ts:299-303`), nie ucinasz treści bez wpisu w ostrzeżeniu.
  Powód zmierzony: własny kod produktu w dwóch miejscach mówi, że `fit:'shrink'` bywa przez
  renderery **ignorowany** (`atomics/KpiValue.ts:27`, `atomics/SlideTitle.ts:13-15`) — czyli
  dziś płacimy pełną cenę typograficzną za mechanizm, który nie ratuje.
- ★★ **OSTRZEŻENIE NIE JEST BLOKADĄ.** Nie wolno Ci zwrócić przepełnienia jako
  `422 QUALITY_GATE_BLOCKED` ani w żaden inny sposób odmówić eksportu. U Gammy eksport też się
  wykonuje. Kod `422` jest zarezerwowany dla dzisiejszych bramek jakości
  (`server/src/routes/presentationExportGate.ts:24`) i **nie zmieniasz jego znaczenia**.
- ★★ **DECK POPRAWNY ⇒ CISZA.** Zero ostrzeżenia, zero pustej ramki, zero komunikatu
  „0 slajdów ma problem". To jest **osobna asercja i osobny zrzut**, nie domysł.
- ★★ **MUTACJA W OBIE STRONY.** Detektor wyłączony ⇒ czerwień na przypadku „deck z przepełnieniem".
  Detektor ostrzegający zawsze ⇒ czerwień na przypadku „deck poprawny". Bramka mierząca tylko
  jeden kierunek przepuszcza detektor krzyczący na wszystko.
- ★★ **ASERCJA NA NUMERZE SLAJDU, NIE NA NAPISIE.** `toContain('nie mieści')` przechodzi także
  wtedy, gdy wskazany slajd jest zły. Sprawdzasz wartość `slideIndex` i liczbę slajdów.
- ★★ **POLE `pewnosc` JEST OBOWIĄZKOWE.** Nie mamy metryk kroju; nasz pomiar jest oszacowaniem
  (`atomics/Bullet.ts:46-47` sam nazywa je „rough" i tłumi do 75 %). W raporcie podajesz
  **zmierzony margines błędu** detektora na min. pięciu realnych slajdach, porównując
  przewidywanie z realnym renderem (`soffice` → PDF → `pdftoppm` → PNG).
  **Ostrzeżenie udające pewność, której nie ma, jest gorsze od braku ostrzeżenia.**
- ★★ **TOR ZAPASOWY (`DeckStyler.ts`) JEST TYLKO DO ODCZYTU.** Mierzysz w nim 10 emisji
  `fit: 'shrink'` i opisujesz; **nie zmieniasz go**, bo ma własnych konsumentów
  (`bundleExportRuntime.ts:224`, `initiativeMaterializeService.ts:488` — ten drugi zamontowany
  **bez żadnej flagi**) i własny pakiet testów.
- ★★ **STOPNIE, WAGI, INTERLINIA, KOLORY I UKŁADY SĄ CUDZYM TERENEM (dyżur 229).**
  Twoja granica jest jednozdaniowa: **dotykasz wyłącznie `fit: 'shrink'` i nic poza tym.**
- ★ **NIE ZAKŁADAJ Z NAZWY.** Trasa `GET /decks/:deckId/export-parity`
  (`presentations.routes.ts:3768`) brzmi jak Twój temat. **Przeczytaj, co robi**, i wpisz
  ustalenie do raportu. W tym programie „nazwa obiecuje" to udokumentowany kształt fałszywego
  gotowe (flaga-fantom `ENABLE_TERESA_NOTE_CREATE` = zero kodu).
- ★ **STOPIEŃ JAKOŚCI, KTÓRY NIE ZMIENIA PLIKU, JEST FANTOMEM.** Jeżeli trzy stopnie z `R4`
  różnią się u nas wyłącznie rozdzielczością rastrów — napisz to wprost i zrób je tylko dla
  rastrów. Nie udawaj, że stopień zmienia coś jeszcze.
- ★ **PDF NIE JEST DZIŚ WIERNYM OBRAZEM PPTX-a.** To dwa niezależne renderery
  (`pdfkit` — `presentations.routes.ts:12`, `:2973`; `pptxgenjs` — `PptxPipelineService.ts`).
  Zdania „mamy PDF, więc wygląd jest bezpieczny" **nie wolno Ci napisać** bez pomiaru.
- ★★ **SUFIT FORMATU JEST TWARDY I ZMIERZONY, NIE ZAKŁADANY.** `pptxgenjs 4.0.1`
  (`package.json`, blok `dependencies`): **gradienty NIEMOŻLIWE** (zero wystąpień słowa
  „gradient" w całej zainstalowanej paczce — typy i wszystkie bundle),
  **osadzanie krojów NIEMOŻLIWE** (biblioteka tego nie oferuje). Dostępne i już używane:
  przezroczystość, pełny zestaw kształtów OOXML, auto-dopasowanie tekstu, obrazy w tle
  (`docs/program/funkcje/GAMMA_G0_POMIAR.md`, rozdział „Sufit biblioteki"). Gradient
  wolno **udawać kształtami** albo **wypalić w PNG**. **Nie obiecujesz gradientu w PPTX.**
- ★★ **GRANICA: RASTER DLA MATERIAŁU, WEKTOR DLA ZNACZENIA**
  (`docs/program/funkcje/GAMMA_G1_OBRAZY.md` §5). W PNG wolno wypalić WYŁĄCZNIE to, co nie
  niesie informacji: pole koloru, gradient, ziarno, teksturę, welon. **NIGDY** nie wypalasz:
  tekstu, liczb, macierzy kropek, pasków, pierścieni, wykresów — one zostają kształtami
  OOXML, **bo agent redagujący (dyżur 232) musi móc je zmienić**.
- ★★ **ZABEZPIECZENIE BEZ TESTU, KTÓRY CZERWIENIEJE PO JEGO USUNIĘCIU, JEST NIEUDOWODNIONE.**
  Każda bramka w tym dyżurze ma **parę dowodową**: przebieg zielony (mechanizm działa) +
  przebieg czerwony po mutacji (mechanizm jest naprawdę tym, co trzyma). Wyjście OBU
  przebiegów wchodzi do raportu dosłownie. „Testy przeszły" nie jest dowodem.
- ★★ **PUŁAPKI ZMIERZONE 31.08 — SPRAWDŹ KAŻDĄ U SIEBIE, NIE PRZEPISUJ TEJ LISTY:**
  (1) `server/src/config/Database.ts` ok. `:79-85` **cicho podstawia atrapę bazy** — bez
  `MOCK_DB=false` Twoje „zapisy" nie lądują nigdzie, a odczyty kłamią;
  (2) `vitest.config.ts` ok. `:210` **przypina `DB_TYPE`** — mierzysz inny silnik, niż myślisz;
  (3) `tests/setup.ts` **podmienia `global.fetch`** — dlatego **realny model wolno wołać
  WYŁĄCZNIE ze skryptu `tsx`, NIGDY z pliku `*.test.ts`**; test z realnym modelem to test
  z atrapą, która udaje model;
  (4) atrapy zakładane w `beforeEach` przeżywają dłużej, niż wygląda;
  (5) czytasz `Test Files` **i kod wyjścia** — `No test files found` przy `exit 0` **nie jest
  `PASS`**, a `npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów.
  Numery linii w (1) i (2) **zmierz na swojej bazie** — mogły się przesunąć; jeżeli się
  przesunęły, wpisz zmierzone do „Korekt wobec instrukcji".
- ★★ **FLAGA DOMYŚLNIE WYŁĄCZONA** (`CLAUDE.md` §7, §9). Przy fladze OFF zachowanie produktu
  ma być **bajt w bajt dzisiejsze** — to jest osobna asercja, nie domysł. Zakaz włączania
  czegokolwiek na żywo bez akceptu właściciela na zrzucie.
- ★★ **WŁAŚCICIEL NIGDY NIE JEST PIERWSZYM TESTEREM WIZUALNYM** (`CLAUDE.md` §7 —
  powód nazwany imiennie: załamanie 07-11). Zrzuty robisz **Ty**, przed nim.
  **Para jasny/ciemny musi się REALNIE różnić**: podajesz `mean_luma` obu obrazów i różnicę
  **> 150**. Zdarzył się w tym programie przypadek dwóch identycznych obrazów pod dwiema
  nazwami (kształt „duplikat zamiast motywu") — `shasum` tego nie wykrywa, bo plakietka
  zmienia SHA. Pomiar jednolinijkowy (`sharp` jest w `devDependencies`):
  ```bash
  node -e "const s=require('sharp');s(process.argv[1]).stats().then(r=>console.log(process.argv[1], (0.2126*r.channels[0].mean+0.7152*r.channels[1].mean+0.0722*r.channels[2].mean).toFixed(1)))" <plik.png>
  ```
  Harness sam ustawia motyw z adresu (`dev-render/main.tsx:1637-1660`: klasa `.dark`,
  `useAppStore.setState({theme})` **oraz** `MutationObserver` przywracający klasę) — więc
  identyczna para **nie ma prawa** wyjść; jeśli wyjdzie, to jest usterka Twojego przebiegu,
  nie harnessu, i masz ją opisać.
- ★★ **W RAPORCIE PISZESZ WPROST, CZY DANE NA ZRZUCIE POCHODZĄ Z REALNEGO PRZEBIEGU, CZY
  Z PROPSÓW W HARNESSIE.** Zrzut zamockowanej powłoki **nie jest dowodem renderu**
  (kształt „przyrząd kłamie, a oko przywyka"; audyt 207 uznał izolowany ekran dev-render za
  storybook, nie za dowód).
- ★ **`Z13`:** logi, dzienniki przebiegu, zrzuty, pliki `.pptx` i wyjścia bramek **nie wchodzą
  do repo** — leżą w katalogu artefaktów, a raport podaje ścieżki i `shasum -a 256`.
- ★ **`Z27` — zakaz `git stash`** w każdej postaci; stan odkładasz przez `cp` do katalogu
  scratch i wracasz przez `cp`. Schowek jest współdzielony między wszystkimi worktree tego
  repozytorium.
- ★ **`Z28`** — zero połączeń do bazy zdalnej, demo, stagingu i produkcji, w każdą stronę
  i każdym narzędziem.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest **PUBLICZNY** (`Z1`).
- ★ **Zakaz naprawiania przez wyciszanie** (`@ts-ignore`, `.skip`, poszerzanie `exclude`,
  `--no-verify`) i zakaz usuwania zastanych testów — asercję wolno **ZMIENIĆ**
  z uzasadnieniem w treści commita, nigdy skasować.
- ★ **`§0.4a` — pomiar zasięgu testów PEŁNYMI NAZWAMI jest warunkiem oddania raportu**
  (`Z24`). Przepisanie cudzej liczby = zawyżenie i podstawa odrzucenia.
- ★ **`Z31`** — `assertRealPostgresTestEnvironment()` wołasz **BEZ ARGUMENTÓW**; zakaz
  asercji na `DATABASE_URL`, na porcie i na nazwie kontenera. Sześć incydentów w programie;
  nie dokładaj siódmego.
- ★ **Sprzątanie kontenera: `docker rm -f -v`** — z flagą `-v`, inaczej wolumen zostaje.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.**
  Brak tej sekcji jest podstawą odrzucenia dyżuru.
