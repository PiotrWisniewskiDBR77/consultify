# INSTRUKCJA DYŻURU nr 256 — Codex — „★★ BRAMKA DOKUMENTU BLOKUJE TREŚĆ ZASTĘPCZĄ, BRAMKA PREZENTACJI PRZEPUSZCZA JAWNY FAŁSZ Z OCENĄ 99/100 — zmierzone na SHA `df7f13056f` i udokumentowane w `docs/program/funkcje/DOWOD_TRZY_PLIKI_2026-09-01.md` (przebieg na realnej bazie, realnym Gateway, bez ozdobników): ten sam przebieg wygenerował DOCX z treścią zastępczą (`This section is awaiting content…` cztery razy, wyciek `[Założenie — wymaga źródła]` do treści klienckiej) i PPTX z jawnie fałszywym zdaniem na slajdzie 10 „Diagnoza objęła portfel 0 inicjatyw i 0 ryzyk” przy DWÓCH dostarczonych źródłach z realnymi inicjatywami. DOCX **został odrzucony** przez `documentQaService.ts` (Language QA: niezgodność języka + za mała gęstość — kategoria blokująca, `runDocumentQa(...).anyBlocking === true`, wymuszone dla 9 typów dokumentów przez `requiresApprovalForExport()`, `:95-108`, z osobną warstwą autoryzacji nadpisania `QaOverrideUnauthorizedError`, `:127-140`). PPTX **przeszedł z oceną 99/100** — silnik, który go ocenił w tym samym przebiegu (`bundleDeckQa.ts`→`RulesEngine.ts`, M19), nie ma ŻADNEJ reguły, która mogłaby ten slajd złapać: brak reguły źródeł/traceability w ogóle (dopiero DRUGI, niezależny silnik `presentationQualityGatesService.ts`, używany na INNYM torze — interaktywny DeckBuilder, nie wiązka — ma taką regułę, i to jako niebolkujące ostrzeżenie P2). **Gorszy artefakt (fałsz widoczny na ekranie klienta) dostał wyższą notę niż lepszy (wypełniacze, ale uczciwie zablokowany).**"

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
> **wyłącznie** `/private/tmp/cx-day256-bramki-formatow`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `df7f13056f`**
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
Zakres: ****PREZENTACJE + DOKUMENTY (GAMMA) — DWIE NIESPÓJNE RODZINY BRAMEK JAKOŚCI, JEDNA WYRAŹNIE SŁABSZA.** Dokument: `server/src/services/documentStudio/documentQaService.ts` (2379 linii, silnik M18, 10 kategorii: brand/language/completeness/sources/methodology/executive/risk/data/format/export, komentarz nagłówkowy `:1-27`), wołany w wiązce przez `server/src/services/deliverables/bundleDocQa.ts:41-49` (`runBundleDocQa`→`runDocumentQa`). Prezentacja w TEJ SAMEJ wiązce: `server/src/services/deliverables/bundleDeckQa.ts:29-49` (`runBundleDeckQa`) woła WYŁĄCZNIE `validateReport` z `server/src/services/report/pptx/RulesEngine.ts` (358 linii, silnik M19, **13 reguł czysto strukturalnych** — `grep -n "rule: '" RulesEngine.ts` daje: `TITLE_LENGTH, REQUIRED_FIELDS, MAX_KPI_DASHBOARD, MAX_BULLETS_EXEC, MAX_KEY_MESSAGES, MAX_RECOMMENDATIONS, MAX_RISKS, MAX_ACTIONS, MAX_ROADMAP_PHASES, ROOT_CAUSE_LIMIT, MAX_INITIATIVES, INITIATIVE_REQUIRED_FIELDS, PRIORITIZATION_QUADRANT_LIMIT, APPENDIX_BODY_LENGTH, EMPTY_REPORT` — **ZERO reguły o źródłach/traceability, ZERO o języku, ZERO o gęstości treści poza tytułem**, zweryfikowane `grep -ic "source\|traceab\|evidence\|language\|density" RulesEngine.ts` → `0`). Osobno, interaktywny eksport z DeckBuildera ma DRUGI silnik: `server/src/services/presentationQualityGatesService.ts` (782 linie, 10 gates) — Gate 6 (source traceability, `:414-432`) i Gate 10 (text density, `:716-733`) TAM istnieją, ale Gate 6 jest `severity:'warning'`/`priority:'P2'` (nie blokuje `canExport`, który liczy tylko `errors===0`, `:740`), a Gate 10 łapie WYŁĄCZNIE nadmiar słów (`wc > wordLimits.max * 1.5`), nigdy niedomiar ani fałsz liczbowy.**.
Trasy front: `Brak bezpośredniej trasy frontowej — to jest bramka SERWEROWA uruchamiana w trakcie generacji wiązki (`server/src/services/deliverables/`) i w eksporcie DeckBuildera. Front konsumuje wynik pośrednio: `src/components/Presentations/DeckBuilder/` (pasek jakości/eksportu, dokładna nazwa komponentu do ustalenia w `R1`) oraz ekran wiązki dokumentów — zweryfikuj sam, czy i gdzie `bundle.quality.doc`/`bundle.quality.deck` (z `bundleDocQa`/`bundleDeckQa`) w ogóle trafia na ekran właściciela, czy jest dziś tylko w logu/raporcie (`R1`, komenda 6)`. Trasy tył: ``server/src/services/deliverables/bundleDocQa.ts:41-49` (`runBundleDocQa`, woła `runDocumentQa` z `documentStudio/documentQaService.ts`) · `server/src/services/deliverables/bundleDeckQa.ts:29-49` (`runBundleDeckQa`, woła `validateReport` z `report/pptx/RulesEngine.ts:301-336`) · `server/src/services/documentStudio/documentQaService.ts` — kategorie `:1-27` (opis), `requiresApprovalForExport` `:108-110`, `QaBlockingError` `:113-124` · `server/src/services/report/pptx/RulesEngine.ts` — pełna lista reguł `:40-300`, `validateReport` `:301-336` · `server/src/services/presentationQualityGatesService.ts` — Gate 6 (traceability) `:414-432`, Gate 10 (density) `:716-733`, wzór wyniku `canExport`/`canShare`/`score` `:735-782` — TEN plik jest UŻYWANY z `server/src/routes/presentationExportGate.ts:30-31` i `server/src/routes/presentations.routes.ts:4481-4483,4592-4608,7854-7856` (interaktywny DeckBuilder), NIE z torem wiązki`.

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
WT=/private/tmp/cx-day256-bramki-formatow
MARKER=df7f13056f

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day256-bramki-formatow-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day256-bramki-formatow/config.worktree"
cat "$VAULT/worktrees/cx-day256-bramki-formatow/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day256-bramki-formatow-scratch
mkdir -p /private/tmp/cx-day256-bramki-formatow-artefakty

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
git -C "$VAULT" log --oneline df7f13056f..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only df7f13056f..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day256-bramki-formatow-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only df7f13056f..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: RulesEngine.ts (M19, deck bundle gate) ma 13 regul, WSZYSTKIE strukturalne
grep -n "rule: '" server/src/services/report/pptx/RulesEngine.ts
#   oczekiwane: 13-14 trafien, nazwy jak TITLE_LENGTH/MAX_RISKS/MAX_INITIATIVES/...
#   zero nazwy zawierajacej SOURCE/TRACEAB/EVIDENCE/LANGUAGE/DENSITY

# (2) KONTROLA DODATNIA: narzedzie grep dziala i faktycznie przeszukuje caly plik
wc -l server/src/services/report/pptx/RulesEngine.ts
grep -c "rule:" server/src/services/report/pptx/RulesEngine.ts
#   oczekiwane: 358 linii (albo Twoja aktualna), grep -c > 0 (dowod ze narzedzie nie padlo cicho)

# (3) TEZA: zero reguly zrodlowej/jezykowej/gestosci w calym pliku RulesEngine.ts
grep -icE "source|traceab|evidence|language|density" server/src/services/report/pptx/RulesEngine.ts
#   oczekiwane: 0

# (4) TEZA: bundleDeckQa.ts (torem wiazki) wola WYLACZNIE RulesEngine, nie presentationQualityGatesService
sed -n '1,52p' server/src/services/deliverables/bundleDeckQa.ts
grep -n "presentationQualityGatesService\|checkDeckQualityGates" server/src/services/deliverables/bundleDeckQa.ts
#   oczekiwane: drugi grep — zero trafien (bundleDeckQa nie zna gate'ow DeckBuildera)

# (5) TEZA: bundleDocQa.ts wola runDocumentQa (M18, 10 kategorii) i ma pole anyBlocking
sed -n '1,50p' server/src/services/deliverables/bundleDocQa.ts
#   oczekiwane: import 'runDocumentQa' z documentQaService.js, pole 'anyBlocking' w BundleDocQaSummary

# (6) TEZA: presentationQualityGatesService.ts Gate 6 (traceability) jest P2/warning,
#     Gate 10 (density) lapie WYLACZNIE nadmiar slow
sed -n '414,432p' server/src/services/presentationQualityGatesService.ts
sed -n '716,733p' server/src/services/presentationQualityGatesService.ts
#   oczekiwane: Gate6 'severity: \'warning\'', 'priority: \'P2\''; Gate10 warunek
#   'wc > wordLimits.max * 1.5' (tylko gorna granica)

# (7) TEZA: canExport liczone WYLACZNIE z errors, P2/warning nie blokuje eksportu
sed -n '735,750p' server/src/services/presentationQualityGatesService.ts
#   oczekiwane: 'const canExport = errors === 0;'

# (8) TEZA: documentQaService blokuje eksport dla 9 typow dokumentow, z osobna
#     autoryzacja nadpisania
sed -n '95,140p' server/src/services/documentStudio/documentQaService.ts
#   oczekiwane: lista 9 DocumentTypeKey w APPROVAL_GATED_DOCUMENT_TYPES,
#   klasa QaOverrideUnauthorizedError z lista rol

# (9) miejsce na dysku
df -h /
#   oczekiwane: powyzej 5 GB wolnego
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day256-bramki-formatow-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6252`. Twój JEDYNY port harnessu to `5232 i 5233`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day256-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6249, 5010-5229, 6404-6411, 6600-6830. Twoje własne: baza 6252, harness 5232 i 5233. Cudze — siostrzane dyżury TEJ SAMEJ paczki (255-259, Prezentacje i Dokumenty), nie dotykasz: baza 6250 i harness 5230-5231 (dyżur 255 Nazwy operacji agenta), baza 6254 i harness 5234-5235 (dyżur 257 Synteza slajdu), baza 6256 i harness 5236-5237 (dyżur 258 Rodzina propozycji AI), baza 6258 i harness 5238-5239 (dyżur 259 Trzy pliki z realnym kluczem). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi funkcyjnej sterującej ISTNIENIEM bramki. Jeżeli nowa reguła/gate w `RulesEngine.ts` lub `presentationQualityGatesService.ts` mogłaby zmienić wynik `canExport` dla istniejących, już wyeksportowanych decków — rozważ, czy nowa reguła potrzebuje własnej flagi ograniczającej ryzyko regresji na demo, domyślnie `false`, i opisz decyzję w raporcie zamiast automatycznie dodawać flagę bez potrzeby.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/services/documentStudio/documentQaService.ts` (WZORZEC, tylko odczyt) · `server/src/services/deliverables/bundleDocQa.ts` (tylko odczyt) · `server/src/services/deliverables/deckConclusionSlide.ts` (TYLKO ODCZYT — teren dyżuru 257) · `server/src/middleware/auth.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY256_BRAMKI_FORMATOW_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — moduł Prezentacje/Dokumenty (Gamma) nie ma dziś takiego pliku w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/` (sprawdź `ls docs/program/waves/WAVE_03_ACCEPTANCE/modules/ | grep -i present` na swoim markerze — zero trafień), więc ten dyżur jest przekrojowy względem tej rejestracji. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day256-bramki-formatow-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day256-bramki-formatow-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ jakiejkolwiek zmiany w `documentQaService.ts`** poza odczytem — bramka dokumentu działa poprawnie, zadanie to WYRÓWNANIE W GÓRĘ, nie dotykanie wzorca. **ZAKAZ dotykania `deckConclusionSlide.ts`** — naprawa PRZYCZYNY fałszywego „0 inicjatyw i 0 ryzyk” to osobny dyżur 257 równoległy w tej samej paczce; Twoim zadaniem jest MECHANIZM BRAMKI (czy fałsz zostałby złapany), nie ŹRÓDŁO fałszu. **ZAKAZ budowania nowego wspólnego silnika QA** (koliduje z W0.1, patrz PUŁAPKA). **ZAKAZ zmiany progu `score >= 95` czy wzoru `100 - errors*20 - warnings*5`** bez jawnego uzasadnienia w raporcie — to zmienia ocenę WSZYSTKICH istniejących decków, nie tylko nowej reguły. | `DOWOD_TRZY_PLIKI_2026-09-01.md` nazywa to „najgroźniejsze znalezisko całego pomiaru”: bramki jakości NIE SĄ spójne między formatami, a różnica działa w najgorszym możliwym kierunku — słabszy artefakt (dokument z wypełniaczami) jest uczciwie zablokowany, mocniejszy pod względem szkody artefakt (prezentacja z liczbą, którą klient zobaczy na ekranie i którą łatwo obali jednym spojrzeniem na własne dane) dostaje najwyższą notę i przechodzi. To podważa PODSTAWĘ zaufania do numeru oceny — jeśli 99/100 nie znaczy „gotowe do pokazania klientowi”, to liczba jest szkodliwa, bo daje fałszywą pewność silniejszą niż brak liczby w ogóle. Naprawa NIE polega na osłabieniu dokumentu (który działa poprawnie) — polega na podniesieniu prezentacji do tego samego poziomu uczciwości. |

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
cd /private/tmp/cx-day256-bramki-formatow

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day256-pg psql -U postgres -d cx256 \
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
cd /private/tmp/cx-day256-bramki-formatow

docker run -d --name cx-day256-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx256 \
  -p 127.0.0.1:6252:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day256-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6252/cx256 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6252/cx256 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day256-bramki-formatow && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6252/cx256 \
JWT_SECRET=cx256-test-secret-do-not-reuse \
npx vitest run server/src/services/__tests__/day256-bundleDeckQa.sourceTraceabilityGate.test.ts server/src/services/report/pptx/__tests__/day256-RulesEngine.sourceTraceabilityRule.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day256-bramki-formatow-artefakty/day256-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day256-bramki-formatow && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/__tests__/day256-bundleDeckQa.sourceTraceabilityGate.test.ts server/src/services/report/pptx/__tests__/day256-RulesEngine.sourceTraceabilityRule.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day256-bramki-formatow-artefakty/day256-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day256-bramki-formatow/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day256-pg psql -U postgres -d cx256 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day256-pg`.
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
> **(e) ★★ DECYZJA PROGRAMU W0.1 = „KOMPONUJ dojrzałe studia (nie buduj 4. stosu QA)” — cytat wprost z nagłówka `bundleDocQa.ts:9` i `bundleDeckQa.ts:9`. To ZAKAZUJE napisania nowego, wspólnego silnika bramek dla obu formatów — poprawka MUSI wzmocnić TEN silnik, którego dany format już używa (dla prezentacji: `RulesEngine.ts`/M19 na torze wiązki, ewentualnie równolegle `presentationQualityGatesService.ts` na torze DeckBuildera — rozstrzygnij w `R1`, czy naprawiasz jeden, czy oba, i uzasadnij). ★ Druga pułapka: `documentQaService.ts` ma WŁASNĄ warstwę autoryzacji nadpisania bramki (rola `SUPERADMIN/OWNER/ADMIN/MANAGER`, `QaOverrideUnauthorizedError`) — jeżeli Twoja naprawa dodaje blokujący gate dla prezentacji, rozstrzygnij (i opisz w raporcie), czy potrzebuje analogicznego mechanizmu nadpisania, czy prosty `error`→`canExport=false` bez ścieżki obejścia wystarczy na start (rekomendacja: **na start bez obejścia**, żeby nie budować połowy nowego systemu autoryzacji w dyżurze o gate'ach).**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day256-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day256-bramki-formatow-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (KROK 0 — wypisz WSZYSTKIE bramki jakości per format w tabeli, co każda sprawdza, gdzie jest wołana, czy blokuje) · R2 (podnieś moc bramki prezentacji — nowa reguła źródłowa/traceability w silniku, który dziś jej nie ma, blokująca, deterministyczna) · R3 (dowód: reprodukcja fałszywie wysokiej oceny PRZED naprawą, blokada PO naprawie, dowód mutacyjny) · R4 (raport)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6252` albo `5232 i 5233` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6252` albo `5232 i 5233`** (`Z7`).

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

`docs/program/funkcje/DOWOD_TRZY_PLIKI_2026-09-01.md` — pierwszy uczciwy pomiar
największej obawy właściciela (nigdy nie powstał dobry dokument z szablonu) — wygenerował
w JEDNYM realnym przebiegu (prawdziwy Postgres, prawdziwy `Gateway`, bez ozdobników) trzy
pliki: arkusz (dobry), dokument DOCX (słaby, z wypełniaczami) i prezentację PPTX (najgorsza,
z jawnie fałszywym zdaniem). Wynik bramek jakości dla tych dwóch ostatnich:

- **DOCX z treścią zastępczą (`This section is awaiting content…` × 4, wyciek
  `[Założenie — wymaga źródła]` do treści klienckiej, angielskie etykiety w polskim
  dokumencie) ZOSTAŁ ZABLOKOWANY.** Bramka wykryła niezgodność języka i za małą gęstość
  treści i odmówiła eksportu. Plik powstał dopiero po świadomym, audytowanym obejściu.
- **PPTX ze slajdem 10 „Diagnoza objęła portfel 0 inicjatyw i 0 ryzyk” — dosłowne zero,
  przy DWÓCH dostarczonych źródłach z realnymi inicjatywami — dostał ocenę 99/100 i
  PRZESZEDŁ.**

**Gorszy artefakt dostał wyższą ocenę.** To jest, jak nazywa to sam pomiar, „najgroźniejsze
znalezisko całego przebiegu” — bramki jakości NIE SĄ spójne między formatami, a rozjazd
działa w najgorszym możliwym kierunku: format, w którym fałsz jest najbardziej widoczny dla
klienta (liczba na slajdzie), ma najsłabszą kontrolę.

## Przyczyna — dwa różne silniki, jeden bez reguły źródłowej

Program podjął wcześniej decyzję W0.1: „KOMPONUJ dojrzałe studia, nie buduj 4. stosu QA”.
Dokument w torze wiązki korzysta z `bundleDocQa.ts` → `documentQaService.ts` (silnik M18,
2379 linii, 10 kategorii, w tym Language QA — język + gęstość, blokująca). Prezentacja w
TYM SAMYM torze korzysta z `bundleDeckQa.ts` → `RulesEngine.ts` (silnik M19, 358 linii, 13
reguł). Wszystkie 13 reguł M19 są strukturalne — limity słów w tytule, limity liczby
bulletów/ryzyk/inicjatyw, obecność wymaganych pól. **Zero reguły o źródłach, zero o
języku, zero o gęstości treści poza samym tytułem.** To nie jest luka we WDROŻENIU
istniejącej reguły (jak w dyżurze 255) — to jest luka w ISTNIENIU reguły.

Osobno istnieje TRZECI silnik: `presentationQualityGatesService.ts` (782 linie, 10 gates),
używany na INNYM torze — interaktywny eksport z DeckBuildera, nie tor wiązki. TAM
traceability (Gate 6) istnieje, ale jako `P2`/`warning`, który NIE blokuje `canExport`
(liczonego wyłącznie z `errors === 0`). Density (Gate 10) łapie WYŁĄCZNIE nadmiar słów,
nigdy niedomiar ani fabrykację.

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | `RulesEngine.ts` (M19, tor wiązki) ma wyłącznie reguły strukturalne, zero reguły źródłowej/językowej/gęstości | `R1`, komenda (1)+(3) |
| T2 | `bundleDeckQa.ts` woła WYŁĄCZNIE `RulesEngine.ts`, nie `presentationQualityGatesService.ts` | `R1`, komenda (4) |
| T3 | `bundleDocQa.ts` woła `documentQaService.ts` (M18, 10 kategorii, `anyBlocking`) | `R1`, komenda (5) |
| T4 | `presentationQualityGatesService.ts` Gate 6 (traceability) to P2/warning, nie blokuje | `R1`, komenda (6)+(7) |
| T5 | Gate 10 (density) łapie wyłącznie nadmiar słów | `R1`, komenda (6) |
| T6 | `documentQaService.ts` blokuje eksport dla 9 typów dokumentów, z osobną autoryzacją nadpisania | `R1`, komenda (8) |
| T7 | Miejsce na dysku wystarcza | `R1`, komenda (9) |

---

# 3. POZYCJE DYŻURU

## R1 — KROK 0: WYPISZ WSZYSTKIE BRAMKI JAKOŚCI PER FORMAT (rdzeń, warunek wejścia)

Wykonaj wszystkie 9 komend `§0.1`. Zbuduj tabelę — jeden wiersz na KAŻDĄ bramkę/regułę
znalezioną (nie tylko te wymienione w tej instrukcji — jeśli znajdziesz czwarty silnik
albo dodatkowe reguły, dopisz je, `Krok 0: wypisz rodzinę`):

| Silnik | Plik | Format | Tor (wiązka / DeckBuilder / inny) | Co sprawdza | Blokuje eksport? | Uwagi |
|---|---|---|---|---|---|---|
| M18 | `documentQaService.ts` | DOCX | wiązka (+ Document Studio) | brand/język/kompletność/źródła/metodologia/executive/risk/data/format/export | TAK, dla 9 typów dokumentów | ma warstwę autoryzacji nadpisania |
| M19 | `RulesEngine.ts` | PPTX | wiązka | wyłącznie strukturalne granice | formalnie tak (error→invalid), ale żadna reguła nie dotyczy źródeł/języka | — |
| Gates 1-10 | `presentationQualityGatesService.ts` | PPTX | DeckBuilder (interaktywny) | struktura/treść/marka/źródła/świeżość/wizual/notatki/gęstość | tylko `errors`; traceability i gęstość to P2 | inny tor niż wiązka |

Wypełnij kolumny sam, na SWOIM markerze — powyższe trzy wiersze są punktem startu z mojego
pomiaru, potwierdź je i dopisz czwarty wiersz, jeśli znajdziesz coś, czego nie
przewidziałem (np. czy `presentationExportGate.ts` ma jeszcze inną logikę scalającą wynik
z dwóch silników przy eksporcie do PDF).

**Rozstrzygnij explicite w raporcie:** czy naprawiasz WYŁĄCZNIE `RulesEngine.ts`/M19 (tor
wiązki — TAM się wydarzyła fałszywa ocena 99/100 z `DOWOD_TRZY_PLIKI`), czy też podnosisz
`presentationQualityGatesService.ts` Gate 6 z P2 na P1/error (tor DeckBuildera). **Rdzeń
tego dyżuru to `RulesEngine.ts`** — to jest silnik, który realnie przepuścił fałsz w
zmierzonym incydencie. Podniesienie Gate 6 jest DODATKOWE, rób je tylko jeśli starczy
czasu po R2/R3, i jako osobny commit.

## R2 — NOWA REGUŁA ŹRÓDŁOWA W `RulesEngine.ts` (M19) — BLOKUJĄCA, DETERMINISTYCZNA (rdzeń)

Dodaj do `RulesEngine.ts` nową regułę w tym samym stylu co istniejące 13 (funkcja czysta,
`UnifiedReportJSON` → lista `Violation`). Kierunek: kiedy slajd typu `key_messages` (to
jest kształt, którego używa slajd „Wnioski” z dyżuru 257 — `deckConclusionSlide.ts`,
komentarz `:12-14` w tamtym pliku) zawiera w treści dosłowny wzorzec liczby ZERO obok
rzeczownika policzalnego (np. „0 inicjatyw”, „0 ryzyk” — dopasuj wzorzec do PL i EN) **A
JEDNOCZEŚNIE** raport ma niepuste źródła gdzie indziej w tym samym `UnifiedReportJSON`
(np. `report.initiatives?.length > 0` lub `report.risks?.length > 0`, sprawdź dokładny
kształt `UnifiedReportJSON` w `R1`) — to jest wewnętrzna sprzeczność, oznacz jako
`severity: 'error'`.

```ts
// szkic kierunku — dostosuj do dokładnego kształtu UnifiedReportJSON, znajdź go w R1
{
  rule: 'ZERO_CLAIM_CONTRADICTS_SOURCE',
  check: (report) => {
    const violations: Violation[] = [];
    const zeroPattern = /\b0\s+(inicjatyw|ryzyk|initiatives|risks)\b/i;
    report.slides.forEach((slide, index) => {
      if (slide.intent !== 'key_messages') return;
      const text = (slide.key_message || '') + ' ' + (slide.body || ''); // dopasuj pola
      const match = text.match(zeroPattern);
      if (!match) return;
      const claimsInitiatives = /inicjatyw|initiatives/i.test(match[0]);
      const sourceHasData = claimsInitiatives
        ? (report.initiatives?.length ?? 0) > 0
        : (report.risks?.length ?? 0) > 0;
      if (sourceHasData) {
        violations.push({
          rule: 'ZERO_CLAIM_CONTRADICTS_SOURCE',
          message: `Slide ${index + 1}: claims "${match[0]}" but source report has non-zero data.`,
          severity: 'error',
        });
      }
    });
    return violations;
  },
}
```

**To jest reguła WĄSKA i deterministyczna, celowo** — nie próbuje ocenić prawdziwości
KAŻDEJ liczby (to wymagałoby modelu językowego, poza zakresem), tylko łapie sprzeczność
WEWNĘTRZNĄ w obrębie tego samego raportu: slajd mówi zero, reszta raportu mówi niezero. To
dokładnie scenariusz `DOWOD_TRZY_PLIKI`. Jeśli `R1` pokaże, że dokładny kształt danych w
`UnifiedReportJSON` nie pozwala na to porównanie (np. `initiatives`/`risks` nie są tam
dostępne w chwili walidacji) — opisz to jako przeszkodę w raporcie i zaproponuj najbliższy
możliwy wariant reguły zamiast milczeć.

**Dowód: reprodukcja PRZED naprawą.** Zbuduj minimalny `UnifiedReportJSON` fixture z jednym
slajdem `key_messages` zawierającym „0 inicjatyw” i z `initiatives` niepustym w tym samym
raporcie → uruchom `validateReport` na kodzie SPRZED tej pozycji → **musi przejść bez
błędu (`valid: true`)** — to jest DOWÓD, że luka realnie istniała, nie założenie. Potem
naprawa → ten sam fixture → `valid: false`, `errorCount >= 1`.

Napisz `server/src/services/report/pptx/__tests__/day256-RulesEngine.sourceTraceabilityRule.test.ts`:
- fixture ze sprzecznością (0 w tekście, niezero w źródle) → `valid: false`
- fixture bez sprzeczności (0 w tekście, źródło TEŻ puste — czyli zero jest prawdziwe) →
  `valid: true`, reguła NIE strzela fałszywym alarmem (**kontrola dodatnia — zero trafień
  ważne tylko z dowodem, że narzędzie działało**)
- **dowód mutacyjny:** usuń nową regułę → pierwszy fixture wraca do `valid: true`
  (czerwono dla oczekiwania testu); przywróć przez `cp` → zielono

## R3 — POŁĄCZ Z WIĄZKĄ + PARA DOWODOWA (rdzeń)

Sprawdź w `R1` (komenda 4), że `bundleDeckQa.ts` już woła `validateReport` z całego
`RulesEngine.ts` — jeśli tak, R2 automatycznie podnosi wynik `runBundleDeckQa` bez zmiany
`bundleDeckQa.ts` (nowa reguła jest wewnątrz silnika, który już jest wołany). Potwierdź to
END-TO-END testem na poziomie `bundleDeckQa.ts`:

- **kontrola negatywna (obcy nie widzi problemu, bo go nie ma):** SPINE bez sprzeczności →
  `runBundleDeckQa` zwraca `valid: true`
- **kontrola pozytywna (problem jest i zostaje złapany):** SPINE analogiczny do scenariusza
  `DOWOD_TRZY_PLIKI` (slajd z „0 inicjatyw”, SPINE ma niepuste inicjatywy gdzie indziej) →
  `runBundleDeckQa` zwraca `valid: false`, `errorCount >= 1`, `topViolations` zawiera regułę
  `ZERO_CLAIM_CONTRADICTS_SOURCE`

To jest para dowodowa wymagana przez `REGUŁY 1.09` — sama „bramka teraz łapie” nie
wystarcza bez pokazania, że bramka NADAL przepuszcza poprawne decki (zero fałszywych
alarmów na czystym materiale).

## R4 — RAPORT DYŻURU (rdzeń)

Sekcje: streszczenie, tabela bramek z `R1` w całości, `R2`-`R3` z pełnymi dowodami (w tym
reprodukcja PRZED i para dowodowa), sekcja „TWIERDZENIA NIEZWERYFIKOWANE” (obowiązkowa
nawet pusta), sekcja „Korekty wobec instrukcji” (obowiązkowa nawet pusta — w szczególności:
czy `R1` znalazł czwarty silnik jakości, którego nie przewidziałem; czy dokładny kształt
`UnifiedReportJSON` pozwolił na porównanie zaproponowane w `R2` bez zmian; czy podniosłeś
też Gate 6 w `presentationQualityGatesService.ts` i dlaczego tak/nie).

---

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (PEŁNA, `R2`) | `server/src/services/report/pptx/RulesEngine.ts` — WYŁĄCZNIE dopisanie nowej reguły do listy, zakaz zmiany istniejących 13 reguł i zakaz zmiany `validateReport()` poza tym, co wymaga podłączenia nowej reguły |
| Zapis (WARUNKOWO, `R1`/`R3`) | `server/src/services/presentationQualityGatesService.ts` — WYŁĄCZNIE jeśli `R1` rozstrzygnie podniesienie Gate 6 z P2 na P1/error; osobny commit od R2 |
| Zapis (PEŁNA, NOWE PLIKI, `R2`-`R3`) | `server/src/services/report/pptx/__tests__/day256-RulesEngine.sourceTraceabilityRule.test.ts` · `server/src/services/__tests__/day256-bundleDeckQa.sourceTraceabilityGate.test.ts` (`git add -f`) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY256_BRAMKI_FORMATOW_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/documentStudio/documentQaService.ts` (WZORZEC — nie zmieniasz, bramka dokumentu działa poprawnie) · `server/src/services/deliverables/bundleDocQa.ts` · `server/src/services/deliverables/bundleDeckQa.ts` (odczyt — potwierdzasz w R1, że nie wymaga zmiany) · `server/src/services/deliverables/deckConclusionSlide.ts` (TYLKO ODCZYT — teren dyżuru 257) · `server/src/services/deliverables/spineToUnifiedReport.ts` (do zrozumienia kształtu `UnifiedReportJSON` dla R2) |
| Odczyt (ZAKAZ ZAPISU) | `docs/program/funkcje/DOWOD_TRZY_PLIKI_2026-09-01.md` (kanoniczne, nie Twoje do zmiany) |
| **Wszystko inne** | **TYLKO ODCZYT** — opisujesz potrzebę w raporcie z `plik:linia` i idziesz dalej |

---

# 5. TWARDE ZASADY

- ★★ **`R1` (KROK 0) JEST WARUNKIEM WEJŚCIA DO `R2`.** Nie piszesz nowej reguły, dopóki
  tabela bramek nie jest kompletna i policzona na TWOIM markerze, z jawnym rozstrzygnięciem
  zakresu (M19 na pewno, Gate 6 opcjonalnie).
- ★★ **ZAKAZ OSŁABIANIA BRAMKI DOKUMENTU.** `documentQaService.ts` jest wzorcem, nie
  problemem — jedyny dozwolony kontakt to odczyt.
- ★★ **ZAKAZ BUDOWANIA NOWEGO WSPÓLNEGO SILNIKA QA.** Decyzja programu W0.1 = komponuj
  dojrzałe studia. Nowa reguła wchodzi DO `RulesEngine.ts`, nie obok niego.
- ★ **Reguła musi być WĄSKA i deterministyczna** — łapie wewnętrzną sprzeczność w obrębie
  raportu, nie próbuje ocenić prawdziwości dowolnej liczby (to wymagałoby modelu,
  poza zakresem tego dyżuru).
- ★ **Reprodukcja PRZED naprawą jest obowiązkowa** (`R2`) — bez niej nie ma dowodu, że
  luka realnie istniała, tylko teza.
- ★ **Para dowodowa, oba człony (`R3`):** poprawny deck NADAL przechodzi (kontrola
  negatywna) + problem jest złapany (kontrola pozytywna). Sama odmowa dla wszystkiego
  dałaby fałszywie zielony wynik.
- ★ **Dowód mutacyjny (`Z32`) obowiązkowy dla `R2`** — cofnij regułę, pokaż czerwono,
  przywróć przez `cp` (`Z27` — nigdy `git stash`), pokaż zielono, `git diff` czysty.
- ★ **`Z10`/`Z11`:** zero nowej flagi funkcyjnej sterującej istnieniem bramki, chyba że
  `R1` uzasadni ryzyko regresji na istniejących deckach — wtedy opisz decyzję w raporcie
  zamiast dodawać flagę automatycznie.
- ★ **Pułapki środowiska — sprawdź każdą u siebie:** `Database.ts:80-88` atrapa bazy bez
  `RUN_DB_TESTS=1` · `vitest.config.ts:210` przypina `DB_TYPE='sqlite'` ·
  `tests/setup.ts:896` podmienia `global.fetch` · `Z31` (strażnik realdb bez argumentów).
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE” W RAPORCIE JEST OBOWIĄZKOWA.** Brak tej
  sekcji jest podstawą odrzucenia dyżuru.
