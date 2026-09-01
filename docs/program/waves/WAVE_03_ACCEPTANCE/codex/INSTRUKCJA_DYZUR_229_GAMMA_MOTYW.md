# INSTRUKCJA DYŻURU nr 229 — Codex — „Ciemny motyw decku i skala typograficzna Z POMIARU 29 slajdów gamma.app — za flagą OFF, w JEDNYM rendererze (produkcyjny `PptxPipelineService`, nie zapasowy `DeckStyler`), z bramką, która MIERZY WARTOŚCI W WYGENEROWANYM PLIKU `.pptx` (rozpakowanie ZIP + parsowanie `ppt/slides/slideN.xml`), a nie w konfiguracji: interlinia nagłówka, stosunek stopni tytuł:treść, liczba rodzin krojów, brak cieni. Dziś ciemnego motywu NIE MA (trzy motywy, wszystkie `background:'FFFFFF'`), stosunek tytuł:treść wynosi 28/13 = 2,15 i NIE spełnia progu 2,2, interlinia treści nie jest ustawiana w ogóle, a ANI JEDEN test nie otwiera wyprodukowanych bajtów, żeby cokolwiek w nich zmierzyć"

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
> **wyłącznie** `/private/tmp/cx-day229-gamma-motyw`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `9fb7942a01`**
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
Zakres: ****RENDERER PPTX — TOR PRODUKCYJNY.** Zmierzone na markerze `9fb7942a01`: istnieją DWA niezależne renderery. (A) produkcyjny, wołany przez pobranie decku: `server/src/services/report/pptx/PptxPipelineService.ts:268` (`generateFromUnifiedJson`, klasa `:263`), wołany z `server/src/routes/presentations.routes.ts:604-607` przez `ensureCurrentPptxExport()` (`:593`), używany w trasie pobrania `:2569`; tokeny w `server/src/services/report/pptx/designTokens.ts` (286 linii). (B) zapasowy, deliverables: `server/src/services/deliverables/bundlePptxRuntime.ts:517` (`deckPlansToPptxBuffer`) + `server/src/services/deliverables/DeckStyler.ts` (1094 linie) + `themeRegistry.ts`; wołany z `bundleExportRuntime.ts:224` i **bezwarunkowo** z `server/src/services/initiative/initiativeMaterializeService.ts:488`. ★ **Ten dyżur wchodzi WYŁĄCZNIE w tor (A).** Tor (B) czytasz i mierzysz, nie zmieniasz. Kontrakt wizualny: `docs/program/funkcje/GAMMA_G1_SPECYFIKACJA.md` (cechy C1-C15, drabina §1, trzy slajdy wzorcowe §5, bramki §8) + `docs/program/funkcje/GAMMA_G2_SESJA_NA_ZYWO.md` („prototyp jasny był błędem kierunku — Wasze decki są ciemne") + `docs/program/funkcje/GAMMA_G0_POMIAR.md` (sufit `pptxgenjs 4.0.1`) + `docs/program/funkcje/GAMMA_G1_OBRAZY.md` §5 (raster dla materiału, wektor dla znaczenia)**.
Trasy front: `Ten dyżur **nie buduje nowego ekranu produktowego**. Front dotykasz w JEDNYM miejscu i tylko po to, żeby zrobić zrzut: nowy ekran `dev-render/screens/day229-gamma-motyw.tsx` + wpis w `dev-render/main.tsx` (wzorzec rejestru: `React.lazy(() => import('./screens/…'))`, ok. `:24-42`; harness czyta `?screen=`, `?theme=light|dark`, `?lang=` — `dev-render/main.tsx:1637-1660`, gdzie motyw jest ustawiany trzema mechanizmami naraz: klasa `.dark` na `documentElement` `:1644`, `useAppStore.setState({theme})` `:1650` i `MutationObserver` przywracający klasę `:1654-1659`). ★★ **Ale zrzut z harnessu NIE JEST dowodem tego dyżuru** — dowodem jest **realnie wyrenderowany slajd z pliku `.pptx`**: `soffice` (`/opt/homebrew/bin/soffice`, LibreOffice 26.2.4.2, zmierzone) konwertuje `.pptx` → PDF, `pdftoppm` (`/opt/homebrew/bin/pdftoppm`, zmierzone) → PNG. Harness służy WYŁĄCZNIE do pokazania palety ról obok siebie. **W raporcie piszesz wprost, który obraz jest czym.** Uczciwość obowiązkowa: render LibreOffice **nie jest** renderem PowerPointa — podmienia kroje i to zmienia złamania wierszy (`GAMMA_G1_SPECYFIKACJA.md` §6.2). Nazywasz to w raporcie`. Trasy tył: `Trasy **istnieją i ich nie budujesz** — sprawdzasz, że Twój motyw przez nie przechodzi: `GET /api/presentations/decks/:id/download` (`server/src/routes/presentations.routes.ts:2569`, render `:604-607`, fail-closed przy błędzie renderu `:680-684`), `POST /api/presentations/generate/deck` (`:1923`), `POST /api/presentations/decks` (`:1981`), `GET /api/presentations/decks/:deckId/export/pdf` (`:2832` — ★ to jest **osobny renderer `pdfkit`** (`import PDFDocument from 'pdfkit'` `:12`, `new PDFDocument` `:2973`), **nie konwersja z PPTX**; czyli PDF i PPTX mogą dziś wyglądać inaczej i to jest ustalenie do raportu, nie do naprawy w tym dyżurze). Router montowany w `server/src/Gateway.ts:1201` za `createBetaGate`. Bramka jakości przed eksportem: `server/src/routes/presentationExportGate.ts:24` (`enforceQualityGateForExport`, 422 `QUALITY_GATE_BLOCKED`) — **nietykalna**`.

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
WT=/private/tmp/cx-day229-gamma-motyw
MARKER=9fb7942a01

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day229-gamma-motyw-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day229-gamma-motyw/config.worktree"
cat "$VAULT/worktrees/cx-day229-gamma-motyw/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day229-gamma-motyw-scratch
mkdir -p /private/tmp/cx-day229-gamma-motyw-artefakty

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
git -C "$VAULT" log --oneline 9fb7942a01..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 9fb7942a01..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day229-gamma-motyw-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9fb7942a01..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: pobranie decku idzie przez PptxPipelineService, nie przez DeckStyler
grep -n "PptxPipelineService\|generateFromUnifiedJson" server/src/routes/presentations.routes.ts | head
#   oczekiwane: trafienia ok. :593 (ensureCurrentPptxExport) i :604-607 (new PptxPipelineService()...)

# (2) TEZA: CIEMNEGO MOTYWU NIE MA — trzy motywy, wszystkie biale
grep -n "background:" server/src/services/report/pptx/designTokens.ts
#   oczekiwane: DOKLADNIE trzy wiersze, wszystkie 'FFFFFF' (ok. :66, :93, :120)

# (3) TEZA: stosunek tytul:tresc NIE spelnia progu 2,2 (C5)
sed -n '26,36p' server/src/services/report/pptx/designTokens.ts
#   oczekiwane: slideTitle 28 i body 13 -> 28/13 = 2,15 (PONIZEJ progu 2,2)

# (4) TEZA: interlinia TRESCI nie jest ustawiana w ogole
grep -rn "lineSpacingMultiple\|lineSpacing" server/src/services/report/pptx/ | sed -n '1,20p'
#   oczekiwane: same wartosci naglowkowe (PptxPipelineService.ts:549 = 0.95,
#   atomics/SlideTitle.ts:144 = 0.9, layouts/CoverLayout.ts:137 = 0.95);
#   dla tresci — ZERO ustawien (BodyText.ts ma parametr opcjonalny, ok. :21, :43-44)

# (5) TEZA: ANI JEDEN test nie mierzy wartosci w wyprodukowanych bajtach
grep -rn 'sz="\|<a:off\|<a:ext\|normAutofit\|spAutoFit' --include='*.test.ts' --include='*.spec.ts' . | grep -v node_modules
#   oczekiwane: ZERO trafien. Testy otwierajace ZIP (np.
#   server/src/services/report/pptx/__tests__/pptxPipelineAccessibility.test.ts:37-50)
#   sprawdzaja wylacznie obecnosc tekstu i nazw ksztaltow

# (6) TEZA: istnieje juz recznE narzedzie mierzace geometrie w gotowym pliku — to Twoj punkt startu
wc -l server/scripts/proof-deck-pptx-analyze.mjs && sed -n '1,10p;40,50p' server/scripts/proof-deck-pptx-analyze.mjs
#   oczekiwane: ok. 110 linii; parsowanie <a:off>/<a:ext> na cale ok. :44-46; NIE jest podpiete do vitest

# (7) TEZA: masz czym otworzyc .pptx w tescie — bez dokladania zaleznosci
node -e "const p=require('./package.json');console.log('jszip',p.dependencies.jszip,'| fast-xml-parser',p.dependencies['fast-xml-parser'],'| pptxgenjs',p.dependencies.pptxgenjs)"
#   oczekiwane: jszip ^3.10.1 | fast-xml-parser ^5.7.2 | pptxgenjs ^4.0.1 (wszystkie w dependencies)

# (8) TEZA: masz czym wyrenderowac slajd do PNG — dowod wizualny bez PowerPointa
/opt/homebrew/bin/soffice --version; which pdftoppm
#   oczekiwane: LibreOffice 26.x oraz sciezka do pdftoppm.
#   Jezeli KTOREGOKOLWIEK brak — to NIE jest STOP: robisz zrzut z harnessu i
#   piszesz w raporcie WPROST, ze render slajdu byl niedostepny i dlaczego

# (9) TEZA: trzy rejestry ukladow, ktorych NIE wolno rozszerzac o czwarty
grep -c "^  [a-z_]*:" server/src/services/report/pptx/layouts/index.ts
grep -n "ARCHETYPE_COUNT" server/src/services/deliverables/slideArchetypes.ts
grep -n "const LAYOUT_TEMPLATES" server/src/services/report/pptx/layouts/deckLayoutDecision.ts
#   oczekiwane: rejestr intencyjny ok. 17 pozycji (index.ts:54-72),
#   ARCHETYPE_COUNT ok. :505 (24 archetypy), LAYOUT_TEMPLATES ok. :75 (29 szablonow)
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day229-gamma-motyw-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6173`. Twój JEDYNY port harnessu to `5134 i 5135`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day229-pg`**. **ZAKAZANE:** `5000 (macOS Control Center, zajety na stale), 5037 (adb), 5060-5061, 6012, 5433, 6047, 6054-6172, 5010-5133, 6404-6411 — oraz porty pozostalych dyzurow fali 18, ktore sa cudze: bazy 6173-6176 i harness 5134-5141 z wyjatkiem Twoich, wymienionych w tym wierszu wyzej. Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w ``R2` — dokładnie JEDNA nowa flaga `ENABLE_DECK_GAMMA_THEME`, **default OFF**, wpis w `server/src/config/FeatureFlags.ts` wzorem `:55` (schemat) i `:247-248` (blok ładujący). Zakaz zmiany wartości domyślnej JAKIEJKOLWIEK istniejącej flagi, w szczególności `ENABLE_DECK_QUALITY_GATES` (`presentationGeneratorService.ts:2190`, dziś ON) i `ENABLE_DECK_NARRATIVE_EXTENDED` (`:2623`, dziś ON)`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/services/aiRoleGuard.ts` · `server/src/services/chatPermissionService.ts` · `server/src/services/aiPolicyEngine.ts` · `server/src/services/aiRunLedgerService.ts` · `server/src/services/ai/chatPolicyGateway.ts` · `server/src/services/ai/webSearchGovernance.ts` · `server/src/services/ai/sideEffectTools.ts` · `server/src/services/ai/knowledgeDocAccessFilter.ts` · `server/src/routes/presentationExportGate.ts` · `server/src/middleware/auth.middleware.ts` · `server/src/middleware/v8FeatureGate.middleware.ts` · `server/src/middleware/resultsInternalBetaVisibility.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY229_GAMMA_MOTYW_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — ten dyżur buduje za flagą domyślnie WYŁĄCZONĄ i **nie domyka odbioru żadnego modułu**; odbiór należy do nadzorcy po akcepcie właściciela na zrzucie. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day229-gamma-motyw-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day229-gamma-motyw-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **ZAKAZ DOKŁADANIA CZWARTEGO REJESTRU UKŁADÓW.** Dziś istnieją TRZY: 17 układów intencyjnych (`server/src/services/report/pptx/layouts/index.ts:54-72`), 29 kanonicznych szablonów geometrii (`server/src/services/report/pptx/layouts/deckLayoutDecision.ts:75`, tablica `LAYOUT_TEMPLATES`) i 24 archetypy planera (`server/src/services/deliverables/slideArchetypes.ts:72`, `ARCHETYPE_COUNT:505`). Siedem archetypów z pomiaru (`GAMMA_G1_SPECYFIKACJA.md` §2) **mapujesz na istniejące**, nie dodajesz czwartej listy | Trzy rejestry układów już się dziś nie zgadzają i to jest zmierzona przyczyna tego, że „ten sam produkt potrafi wypuścić dwa pliki o różnej geometrii" (`docs/program/funkcje/GAMMA_G0_POMIAR.md`). Czwarta lista zamienia problem spójności w problem nierozwiązywalny |

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
cd /private/tmp/cx-day229-gamma-motyw

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day229-pg psql -U postgres -d cx229 \
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
cd /private/tmp/cx-day229-gamma-motyw

docker run -d --name cx-day229-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx229 \
  -p 127.0.0.1:6173:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day229-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6173/cx229 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6173/cx229 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day229-gamma-motyw && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6173/cx229 \
JWT_SECRET=cx229-lokalny-sekret-testowy-nie-uzywany-nigdzie-indziej \
npx vitest run server/src/services/report/pptx/__tests__ tests/unit/reports tests/unit/deliverables/deckStyler.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day229-gamma-motyw-artefakty/day229-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day229-gamma-motyw && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/report/pptx/__tests__ tests/unit/reports tests/unit/deliverables/deckStyler.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day229-gamma-motyw-artefakty/day229-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day229-gamma-motyw/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day229-pg psql -U postgres -d cx229 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day229-pg`.
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
> **(e) **Bramka jakości `enforceQualityGateForExport` (`server/src/routes/presentationExportGate.ts:24`) odcina eksport kodem `422 QUALITY_GATE_BLOCKED` ZANIM dojdzie do renderu.** Jeżeli Twój pakiet dowodowy dostaje 422, to **nie jest** wynik Twojego motywu — to jest bramka. Obejście dozwolone wyłącznie przez rolę ADMIN/OWNER/SUPERADMIN (`presentationExportGate.ts:12,:14`) albo przez deck spełniający bramki; **zakaz modyfikowania pliku bramki**. W raporcie podajesz, którą drogą poszedłeś i czym to udowodniłeś**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day229-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day229-gamma-motyw-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (pomiar i rozstrzygnięcie toru) · R2 (motyw ciemny za flagą OFF) · R4 (bramka mierząca PLIK)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6173` albo `5134 i 5135` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6173` albo `5134 i 5135`** (`Z7`).

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

Właściciel produktu prowadzi swoje realne doradztwo w **gamma.app**: sześć motywów per linia
biznesowa, **367 prezentacji na jednym motywie**, żywi klienci. Jego marzenie nie brzmi „ładne
slajdy" — brzmi **koniec rozdwojenia**: treść żyje w Consultify, a artefakt powstaje gdzie indziej,
więc każdą prezentację przepisuje ręcznie z tego, co system już wie.

Ten dyżur robi **jedną, wąską rzecz z tego marzenia**: daje generatorowi PPTX **motyw, który
wygląda jak decki właściciela** — czyli **ciemny** — i **skalę typograficzną zmierzoną**, nie
wymyśloną. Nie robi treści (to dyżur 231), nie robi ostrzeżeń (230), nie robi agenta (232).

## Skąd biorą się liczby w tym dyżurze

Z **pomiaru 29 slajdów w 3 motywach gamma.app**, odczytanych z DOM przez `getComputedStyle` +
`getBoundingClientRect` — nie z oglądania. Pełny zapis: `docs/program/funkcje/GAMMA_G1_SPECYFIKACJA.md`.
Autor tego pomiaru sam rozdzielił **ZMIERZONE**, **WYWNIOSKOWANE** i **swoją rekomendację** — i Ty
masz utrzymać ten podział w raporcie.

## ★★ Pomiar, który zmienia treść zamówienia — wykonany na SHA `9fb7942a01`

Nadzorca zmierzył stan przed napisaniem tej instrukcji. **Sprawdź każdą z tych liczb u siebie**
(komendy w `§2`); rozbieżność idzie do „Korekt wobec instrukcji", nie do improwizacji.

1. **Ciemnego motywu NIE MA — i nie jest to „brak konfiguracji", tylko brak pola.**
   Tor produkcyjny ma trzy motywy i **wszystkie trzy** mają `background: 'FFFFFF'` —
   `server/src/services/report/pptx/designTokens.ts:66` (`corporateTokens`, blok od `:61`),
   `:93` (`minimalTokens`, blok od `:88`), `:120` (`modernTokens`, blok od `:115`).
   Tor zapasowy (`server/src/services/deliverables/themeRegistry.ts`) ma pięć motywów i **nie ma
   pola tła w ogóle**. Jedyne wystąpienia słowa „dark" w kodzie eksportu to funkcja `darken()`
   (`server/src/services/deliverables/DeckStyler.ts:127`) i komentarz forward-compat
   (`server/src/services/report/pptx/composites/LayoutTruncationMarker.ts:111` — „e.g. when we
   honour brand-mode dark themes").
   **Nadzorca zbudował wcześniej prototyp jasny i to było pudło kierunkowe** — zapisane wprost
   w `docs/program/funkcje/GAMMA_G2_SESJA_NA_ZYWO.md`: *„Prototyp jasny był błędem kierunku —
   Wasze decki są ciemne. Poprawiam."*

2. **Stosunek tytuł : treść NIE spełnia progu z pomiaru — i to jest liczba, nie opinia.**
   `designTokens.ts:26-36` (`FONT_SIZES`): `slideTitle: 28` (`:27`), `body: 13` (`:31`).
   **28 / 13 = 2,15.** Próg C5 z pomiaru gammy: **≥ 2,2** (zakres zmierzony 2,24–3,60).
   Tor zapasowy jest dalej od progu: `themeRegistry.ts:188-197` (`PPT_TYPE_SCALE`) daje
   `slideTitle: 28` i `body: 18` → **1,56**.

3. **Interlinia treści nie jest ustawiana w ogóle.** W torze produkcyjnym `lineSpacingMultiple`
   występuje wyłącznie przy nagłówkach: `PptxPipelineService.ts:549` = `0.95`,
   `atomics/SlideTitle.ts:144` = `0.9`, `layouts/CoverLayout.ts:137` = `0.95`.
   Dla treści — nic (`atomics/BodyText.ts` ma parametr opcjonalny, ok. `:21`, `:43-44`), czyli
   obowiązuje domyślka PowerPointa. Cecha C6 z pomiaru: **nagłówek 1,00 w 100 % przypadków, we
   wszystkich trzech motywach, bez jednego wyjątku** — to najtwardsza stała całego badania —
   i **treść 1,35–1,50**.

4. **ANI JEDEN test nie otwiera wyprodukowanych bajtów, żeby cokolwiek w nich zmierzyć.**
   Testy, które rozpakowują `.pptx` przez `JSZip`, sprawdzają wyłącznie **obecność tekstu i nazw
   kształtów**: `server/src/services/report/pptx/__tests__/pptxPipelineAccessibility.test.ts:37-50`
   (`zip.file('ppt/slides/slide1.xml')`, potem `toContain('Text: Decision gate')`,
   `toContain('<adec:decorative')`), `…/pptxPipelineSpeakerNotes.test.ts:71-75`
   (`toMatch(/name="\d{2} Text: …"/)`), `…/pptxPipelineGenerateDownload.test.ts:92-138`
   (`buffer.length > 1000`, sygnatura ZIP, `toContain('[Content_Types].xml')`).
   Grep `sz="`, `<a:off`, `<a:ext`, `normAutofit`, `spAutoFit` po wszystkich plikach testowych
   daje **zero trafień**. Testy topologii (`tests/unit/deliverables/deckPptxLayoutTopology.test.ts`,
   `…deckPptxExecSummaryTopology.test.ts`) mierzą geometrię, ale **przed renderem**, na atrapie
   slajdu nagrywającej `apply()` — same to deklarują w nagłówkach (`:15-16` i `:11-13`).
   **Czyli nie istnieje dziś ani jedna asercja o wyglądzie, którą dałoby się złamać.**

5. **Ale istnieje gotowe narzędzie, od którego zaczynasz.**
   `server/scripts/proof-deck-pptx-analyze.mjs` (110 linii) rozpakowuje ZIP, parsuje
   `<a:off>` / `<a:ext>` na cale (`:44-46`), wykrywa elementy poza slajdem (`:64-66`) i nachodzenia
   (`:69-83`). Uruchamiany **ręcznie**, nie podpięty do żadnego configu vitest.
   Masz też komplet zależności **w `dependencies`, nie do dołożenia**: `jszip ^3.10.1`,
   `fast-xml-parser ^5.7.2`, `pptxgenjs ^4.0.1`.

6. **Dwa renderery, dwie geometrie — i to jest zmierzona przyczyna niespójności.**
   Tor **A (produkcyjny, wołany przy pobraniu decku)**: `PptxPipelineService.ts:268`, wołany
   z `presentations.routes.ts:604-607`. Tor **B (deliverables)**:
   `bundlePptxRuntime.ts:517` + `DeckStyler.ts`, wołany z `bundleExportRuntime.ts:224` i
   **bezwarunkowo** z `initiativeMaterializeService.ts:488`. Marginesy różne (0,5 cala vs 0,6 cala
   — `designTokens.ts:39-48` kontra `DeckStyler.ts:35-51`), góra treści różna (1,0 vs 1,7 cala).
   **Ten dyżur wchodzi WYŁĄCZNIE w tor A.** Tor B mierzysz i opisujesz.

7. **Trzy rejestry układów już istnieją.** 17 układów intencyjnych
   (`server/src/services/report/pptx/layouts/index.ts:54-72`), 29 kanonicznych szablonów geometrii
   (`…/layouts/deckLayoutDecision.ts:75`, `LAYOUT_TEMPLATES`; mapowanie archetyp→szablon `:432`,
   resolver `:841`), 24 archetypy planera (`server/src/services/deliverables/slideArchetypes.ts:72`,
   `ARCHETYPE_COUNT:505`). Pomiar mówi, że **siedem archetypów wystarczy** na wszystkie 29 slajdów
   (`GAMMA_G1_SPECYFIKACJA.md` §2). **Siedem MAPUJESZ na to, co jest. Czwartego rejestru nie ma.**

## Czego ten dyżur świadomie NIE robi

- **Nie ściga infografik z wtopionym tekstem.** To najtrudniejsza rzecz w całej gammie i pomiar
  mówi wprost: *„Nie obiecywać ich w pierwszej fali"* (`GAMMA_G2_SESJA_NA_ZYWO.md`).
- **Nie rozstrzyga Classic kontra Studio** (slajd składany z bloków kontra slajd wypalony jako
  obraz). To **decyzja właściciela**, nie wykonawcy (`GAMMA_G2_SESJA_NA_ZYWO.md`, punkt 2).
- **Nie naprawia dwóch martwych kanałów edytora wyglądu** (`customTemplate` gubiony przez
  `PATCH /templates/:id`, `CURATED_COLOR_SETS` nieczytane przy renderze — `GAMMA_G0_POMIAR.md`).
  To osobna, większa robota.
- **Nie ujednolica dwóch geometrii.** Mierzysz różnicę i opisujesz ją; scalanie torów to osobny dyżur.

---

# 2. TEZY ZLECENIA

Każdą z nich **sprawdzasz komendą** z sekcji weryfikacji stanu wejściowego w `§0`. Teza, której
nie potwierdziłeś, **nie wchodzi do raportu jako fakt**.

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Pobranie decku idzie przez `PptxPipelineService`, nie przez `DeckStyler` | komenda (1) |
| T2 | Ciemnego motywu nie ma — trzy motywy, wszystkie `FFFFFF` | komenda (2) |
| T3 | Stosunek tytuł:treść = 28/13 = 2,15, poniżej progu 2,2 | komenda (3) |
| T4 | Interlinia treści nie jest ustawiana w ogóle | komenda (4) |
| T5 | Ani jeden test nie mierzy wartości w wyprodukowanych bajtach | komenda (5) |
| T6 | Istnieje ręczny analizator `.pptx` — punkt startu dla bramki | komenda (6) |
| T7 | `jszip` i `fast-xml-parser` są w `dependencies` — nic nie dokładasz | komenda (7) |
| T8 | `soffice` + `pdftoppm` pozwalają wyrenderować slajd do PNG | komenda (8) |
| T9 | Trzy rejestry układów istnieją; czwartego nie dokładasz | komenda (9) |

---

# 3. POZYCJE DYŻURU

## R1 — POMIAR I ROZSTRZYGNIĘCIE TORU (rdzeń; bez tego reszta nie ma sensu)

Zanim cokolwiek napiszesz, **odpowiedz liczbami** na cztery pytania i wpisz odpowiedzi do raportu:

1. **Którędy idzie plik, który zobaczy klient?** Prześledź `GET /api/presentations/decks/:id/download`
   (`server/src/routes/presentations.routes.ts:2569`) do bajtów. Podaj łańcuch wywołań
   z `plik:linia`.
2. **Ile miejsc trzeba dotknąć, żeby zmienić kolor tła jednego slajdu?** Policz. `GAMMA_G0_POMIAR.md`
   mówi o **53 hexach na sztywno** w torze kanonicznym i 10 w zapasowym — **zweryfikuj tę liczbę
   sam**, nie przepisuj. Jeżeli wychodzi inna, Twoja jest wiążąca i idzie do „Korekt".
3. **Czy `designTokens.ts` jest jedynym źródłem koloru w torze A?** Jeżeli nie — wypisz wszystkie
   pozostałe źródła z `plik:linia`.
4. **Który z trzech rejestrów układów realnie decyduje o geometrii slajdu w torze A?**
   (`layouts/index.ts:54-72` czy `layouts/deckLayoutDecision.ts:75`, czy oba, i w jakiej kolejności —
   patrz `resolveDeckLayoutTemplateId:841` i `ARCHETYPE_TO_TEMPLATE:432`.)

**Wynik R1 jest warunkiem wejścia do R2.** Jeżeli pomiar pokaże, że motywu nie da się dołożyć bez
dotknięcia więcej niż jednego pliku tokenów — **to jest ustalenie, nie porażka**: opisujesz je
i wykonujesz minimalną wersję R2 na tym, co jest osiągalne, resztę nazywając niezrobioną.

## R2 — MOTYW `gamma-dark`, ZA FLAGĄ `ENABLE_DECK_GAMMA_THEME` (default OFF) — rdzeń

Nowy motyw **obok** trzech istniejących, dokładnie tym samym mechanizmem, którym one są wybierane
(`getDesignTokens` — `designTokens.ts:142`; override brandu `:161-167`). **Zakaz zmiany wartości
w `corporateTokens` / `minimalTokens` / `modernTokens`.**

### R2a — role kolorów (nie hexy; hexy dobierasz Ty, role są wiążące)

Siedem ról z pomiaru (`GAMMA_G1_SPECYFIKACJA.md` C8):
`surface` (tło slajdu, **ciemne**) · `surface-alt` (wypełnienie panelu, przesunięcie **6–10 %**
względem `surface`) · `ink-primary` (tytuły) · `ink-secondary` (treść, podpisy — **ten sam odcień**
co primary, niższy kontrast, **≥ 4,5:1** względem `surface`) · `accent` (**dokładnie jeden odcień
w całym decku**) · `accent-ink` (tekst na wypełnieniu akcentem) · `rule` (włos, `ink-secondary`
przy ~25 % krycia).

**Budżet akcentu:** wielkie liczby, jeden poziom podnagłówków, chipy, kicker, pierwsza seria
wykresu. **Zakaz:** akapity treści, duże wypełnienia tła, **więcej niż ~8 % powierzchni slajdu**.

★ **Uczciwie o kryciu:** `alpha` renderuje się różnie w Google Slides i Keynote
(`GAMMA_G1_SPECYFIKACJA.md` §6.1). `rule` przy 25 % krycia **wypłaszczasz do wartości docelowej**
zamiast używać przezroczystości. To decyzja z pomiaru, nie oszczędność.

### R2b — dokładnie DWA kroje, rola sztywna

Jeden „display" (tytuły, liczby, etykiety-nagłówki), jeden „text" (treść, podpisy).
**Zero trzeciego kroju.** Zmierzone: 3 z 3 motywów gammy mają dokładnie 2 rodziny, na 29 slajdach
ani jednego trzeciego kroju.

★★ **SUFIT, KTÓREGO NIE PRZESKOCZYSZ: `pptxgenjs 4.0.1` NIE UMIE OSADZIĆ KROJU.** Zmierzone
w zainstalowanej paczce (`GAMMA_G0_POMIAR.md`). Konsekwencja jest arytmetyczna, nie estetyczna:
**podmiana kroju u odbiorcy zmienia złamania wierszy**, a przy twardych limitach znaków tytuł
zamiast w 2 wierszach zmieści się w 3 i blok się rozjedzie. **Dlatego w R2b wybierasz kroje
BEZPIECZNE** (obecne w każdej instalacji Office) — a nie „ładniejsze, ale własne — przecież mamy
PDF". Droga „krój własny + PDF jako format dystrybucji" jest rekomendacją analityka
(`GAMMA_G1_SPECYFIKACJA.md` §6.2, droga 2) i **decyzją właściciela**, nie Twoją.
W raporcie wypisujesz obie nazwy krojów i piszesz wprost, czy są obecne w standardowej instalacji
Office na macOS i Windows — a jeżeli tego nie zmierzyłeś, piszesz „nie zmierzyłem".

### R2c — drabina stopni (pt, kanwa 960 × 540)

| Rola | pt | Status |
|---|---|---|
| okładka — tytuł | **64** | z pomiaru (zakres 39–80) |
| przekładka / statement | **44** | zmierzone |
| liczba (statystyka) | **52** | ★ **podbite** — gamma ma ~34 |
| tytuł slajdu (H1) | **34** | zmierzone (24–39) |
| podnagłówek (H2) | **20** | zmierzone (16–23) |
| etykieta (H3, display 600) | **16** | zmierzone (12–13,5) |
| treść (body) | **15** | ★ **podbite** — gamma ma ~11 |
| podpis / nota | **12** | zmierzone |
| kicker (wersaliki) | **10,5** | zmierzone (8,5–11) |

★★ **NAPIĘCIE, KTÓRE MASZ NAZWAĆ W RAPORCIE, A NIE PRZEMILCZEĆ.** Dwa stopnie w tej drabinie
(**treść 15 zamiast ~11, liczba 52 zamiast ~34**) są **decyzją projektową analityka, nie pomiarem**
(`GAMMA_G1_SPECYFIKACJA.md` §7). Powód: skala gammy jest dobrana do czytania na laptopie z 50 cm,
nie do sali zarządu. Cena jest arytmetyczna: **większy krój przy tej samej ilości powietrza musi
oznaczać mniej treści na slajd** — stąd limit gęstości. Twoim zadaniem **nie jest** rozstrzygać
tego wyboru; Twoim zadaniem jest **zbudować wariant (b) i powiedzieć właścicielowi wprost, czego
kosztem**, zanim zapyta „a gdzie reszta treści".

**Limit na slajdzie: 3–5 różnych stopni**, sąsiednie użyte stopnie różnią się o **≥ 1,25×**.

### R2d — waga pisma ODWRÓCONA

display 60–72 pt → waga **400–500** · H1 34 pt → **400–500** · H2/H3 16–20 pt → **600–700** ·
body 15 pt → **300–400**. **Waga treści ≤ 400 i ≤ waga display.** Body **nigdy** pogrubione poza
pojedynczym wyróżnieniem inline.

To jest jedna z pięciu decyzji, które robią całą różnicę: *„Domyślny PowerPoint robi odwrotnie —
grubaśny bold tytuł. To jeden z najszybszych sygnałów «szablon z 2005»."*

★ **Pułapka `pptxgenjs`:** wagi wymagają **osobnych plików kroju** (Light/Regular/SemiBold);
„faux bold" wygląda źle (`GAMMA_G1_SPECYFIKACJA.md` §6.1, wiersz C7). Jeżeli wybrany krój bezpieczny
nie ma potrzebnych wag — **to jest ustalenie do raportu**, i wtedy realizujesz odwróconą wagę tym,
czym się da (dwie wagi zamiast czterech), nazywając ograniczenie.

### R2e — interlinia

Display **1,00–1,05** (zmierzone: **dokładnie 1,00 w 100 % nagłówków**). Body **1,42**
(zmierzony zakres 1,15–1,52; dolny kraniec analityk uznał za za ciasny dla polskich diakrytyków —
**to jego decyzja, nie pomiar**, i tak ją opisujesz).

★ **Pułapka formatu:** `lnSpc spcPct` w PPTX liczy się względem metryk kroju (ascent + descent +
lineGap), więc **„140 %" w PPTX ≠ „1,4" w CSS**. Współczynnik trzeba **skalibrować per krój
i zweryfikować renderem** (`GAMMA_G1_SPECYFIKACJA.md` §6.1). Twoja bramka `B6` mierzy **wartość
zapisaną w pliku**, nie efekt optyczny — i **tak masz to w raporcie nazwać**.

### R2f — panele, krawędzie, zero cieni

Promień narożnika **0–7 pt** (najczęściej 3) · obramowanie **0,4–1,5 pt** (włos) · **cień: ZERO**
(`box-shadow: none` na wszystkich zmierzonych kartach i panelach) · kafel ma wypełnienie **albo**
obrys, **nigdy oba, nigdy cień** · chip = pigułka (wys. 26 pt, promień 13 pt, padding-x 14 pt) —
**jedyne** miejsce z dużym promieniem.

## R3 — SIEDEM ARCHETYPÓW MAPOWANYCH NA ISTNIEJĄCE REJESTRY (rdzeń warunkowy)

`A1` okładka · `A2` przekładka/statement · `A3` tekst + slot obrazu · `A4` kafle N-up ·
`A5` rząd liczb · `A6` narracja + wizual · `A7` sekwencja numerowana (+ warianty: cytat, zamknięcie).

**Obowiązkowa TABELA w raporcie:** siedem wierszy, w każdym — na który z istniejących 17 układów
intencyjnych i który z 29 szablonów geometrii mapuje się dany archetyp, z `plik:linia`.
Gdzie mapowanie nie istnieje — piszesz „brak" i **nie dokładasz nowego rejestru**; to jest wpis
do raportu i materiał dla nadzorcy.

**Zasada wyboru:** archetyp wybiera się z **kształtu treści**, nie z „urozmaicenia".
Trzy punkty rekomendacji → `A4`/N=3. Cztery wskaźniki → `A5`/N=4. Jedno zdanie tezy → `A2`.
**Nigdy nie rotować archetypów dla ozdoby.**

## R4 — ★★ BRAMKA: TEST MIERZĄCY WARTOŚCI W WYGENEROWANYM PLIKU (rdzeń, sedno dyżuru)

**To jest jedyna pozycja, której nie wolno oddać częściowo.**

Test **generuje `.pptx`**, **rozpakowuje go** (`jszip`), **parsuje `ppt/slides/slideN.xml`**
(`fast-xml-parser`) i **mierzy w XML-u cztery wielkości**:

| # | Bramka | Warunek mierzony w PLIKU |
|---|---|---|
| `B6` | interlinia | każdy akapit display: `a:lnSpc/a:spcPct/@val ≤ 105000`; każdy akapit body: `138000–150000` |
| `B5` | stosunek stopni | `max(sz tytułu) / sz(body) ≥ 2,2` na każdym slajdzie treściowym |
| `B3` | liczba krojów | liczba **różnych rodzin** (`a:latin/@typeface`) w całym decku **= 2** |
| `B13` | brak cieni | `a:effectLst` **pusty albo nieobecny** w całym decku; `roundRect` `adj` ≤ 7 pt; `a:ln/@w` ≤ 1,5 pt (19050 EMU) |

**Jednostki, żeby nie mierzyć nie tego, co trzeba:** `sz` jest w **setnych punktu** (`sz="2800"` =
28 pt), `spcPct/@val` w **tysięcznych procenta** (`100000` = 100 %), `a:ln/@w` w **EMU**
(1 pt = 12 700 EMU). Wypisz w raporcie, jak przeliczałeś.

### Para dowodowa — obowiązkowa, cztery mutacje, każda osobno

Dla **każdej z czterech bramek** wykonujesz **oddzielny** przebieg mutacyjny:
psujesz **jedną** wartość w motywie (np. interlinia nagłówka `1,00 → 1,25`; `body 15 → 13` przy
tytule 28, czyli stosunek 2,15; trzeci krój dołożony w jednym miejscu; jeden `shadow` na jednym
kształcie) i pokazujesz, że **czerwienieje dokładnie ta bramka i żadna inna nie kłamie na zielono**.
Do raportu wchodzi **osiem wyjść** (4 × zielone + 4 × czerwone), dosłownie, z nazwami testów.

★★ **Bramka ma mierzyć PLIK, nie konfigurację.** Test, który czyta `designTokens.ts` i sprawdza, że
zapisano tam `1.0`, **nie jest bramką** — jest tautologią i w tym programie ma nazwę:
biblioteka bez wywołania. Jeżeli Twój test nie otwiera bajtów, **nie oddajesz tej pozycji**.

★ Wzorzec, od którego zaczynasz: `server/scripts/proof-deck-pptx-analyze.mjs` (parsowanie
`<a:off>/<a:ext>` `:44-46`). Wzorzec otwierania ZIP w teście:
`server/src/services/report/pptx/__tests__/pptxPipelineAccessibility.test.ts:37-50`.
Wzorzec niezależnego odczytu bajtów („JSZip, not pptxgenjs"):
`server/src/services/presentationExport/__tests__/presentationExportReceiptService.pg.test.ts:291-299`.

## R5 — PROTOTYP JAKO PLIK + ZRZUTY (rdzeń dowodowy, `CLAUDE.md` §7)

**Reguła 7 jest nienaruszalna: właściciel nigdy nie jest pierwszym testerem wizualnym.**
Przed nim patrzysz Ty.

1. **Trzy slajdy wzorcowe jako PLIK `.pptx`** — dokładnie te z `GAMMA_G1_SPECYFIKACJA.md` §5:
   **okładka**, **rekomendacje** (kafle N-up z numerami), **liczby** (macierz kropek + wielka
   liczba + **obowiązkowe źródło**). Plik ląduje w katalogu artefaktów, **nie w repo** (`Z13`),
   z `shasum -a 256` w raporcie.
   ★ Slajd liczbowy: **liczba ≥ 1,4 × tytuł** (52/34 = 1,53) — to jedyny slajd, na którym tytuł
   nie jest bohaterem. **Źródło jest obowiązkowe** — i to jest **świadome odejście od wzorca
   gammy**, która tego nie robi; opisz to w raporcie jako różnicę na naszą korzyść, nie jako błąd.
2. **Render do PNG:** `soffice --headless --convert-to pdf` → `pdftoppm -r 150 -png`.
   ★★ **Uczciwość obowiązkowa:** render LibreOffice **nie jest** renderem PowerPointa — podmienia
   kroje, a to zmienia złamania wierszy. Piszesz to w raporcie **przy zrzutach**, nie w przypisie.
   Jeżeli `soffice` albo `pdftoppm` nie ma — **to nie jest STOP**: robisz zrzut z harnessu
   i nazywasz brak.
3. **Para motywów:** ciemny (nowy) i jasny (dzisiejszy `corporate`), **ten sam slajd, ta sama
   treść**. Podajesz `mean_luma` obu i różnicę — **wymagane > 150**.
4. **Zrzut harnessu** (`dev-render/screens/day229-gamma-motyw.tsx`): paleta siedmiu ról obok siebie,
   z odczytaną wartością kontrastu `ink-secondary` względem `surface` (próg **≥ 4,5:1**).
   Wzorzec liczenia: `scripts/contrast-ratio.mjs`.

## R6 — ★★ GEOMETRIA DWÓCH TORÓW JEST CUDZYM ZAKRESEM (dyżur 227) — NIE ROBISZ JEJ

**Sprostowanie wydane po pomiarze wykonanym przy pisaniu tej instrukcji:** zestawienie
i uzgodnienie dwóch rendererów (margines 0,5 kontra 0,6 cala, góra treści 1,0 kontra 1,7,
`DECK_GRID` w `DeckStyler.ts` — **nie** w `themeRegistry.ts`, jak zakładało pierwotne zamówienie —
oraz bezwarunkowy wołacz `initiativeMaterializeService.ts:488`) jest **zakresem dyżuru 227**,
wydanego równolegle z Twoim.

**Twoja rola tutaj to JEDNO zdanie w raporcie:** czy Twój motyw dotyka geometrii (marginesy,
pole treści, rynny) — a **ma nie dotykać**. Jeżeli w trakcie `R2` okaże się, że nowej drabiny
stopni nie da się osadzić bez zmiany `GRID` (`designTokens.ts:39-48`) — **to jest STOP pozycji
z opisem i zgłoszenie kolizji do nadzorcy**, nie cicha zmiana siatki.

**Nie budujesz tabeli różnic. Nie ujednolicasz torów. Nie dotykasz `DeckStyler.ts`.**

---

# 4. TABELA LICENCJI PLIKOWYCH

Licencja obejmuje **całą ścieżkę**: tokeny → motyw → wybór motywu → render → plik → bramka → zrzut.
Pominięcie ogniwa zmusiłoby Cię do złamania licencji albo do połowy roboty.

| Zakres | Ścieżki |
|---|---|
| Zapis | `server/src/config/FeatureFlags.ts` — WYŁĄCZNIE dodanie `ENABLE_DECK_GAMMA_THEME` (wpis w schemacie wzorem `:55` + wpis w bloku ładującym wzorem `:247-248`). **Zakaz zmiany wartości domyślnej JAKIEJKOLWIEK istniejącej flagi** |
| Zapis | `server/src/services/report/pptx/designTokens.ts` — WYŁĄCZNIE **dodanie** nowego zestawu tokenów `gammaDarkTokens` i rozszerzenie `getDesignTokens` (`:142`) o jego wybór za flagą. **Zakaz zmiany wartości w `corporateTokens` (`:61`), `minimalTokens` (`:88`), `modernTokens` (`:115`)** i zakaz zmiany `GRID` (`:39-48`) oraz `SPACING` (`:50-55`) |
| Zapis | `server/src/services/report/pptx/PptxPipelineService.ts` — WYŁĄCZNIE: przekazanie wybranego motywu do renderu i ustawienie interlinii treści. **Zakaz zmiany `defineMasterSlides` (`:132`, mastery `COVER:134`, `BLANK:140`, `SECTION_DIVIDER:146`)**, zakaz dotykania wstrzyknięcia znacznika ucięcia (`:363-370` — to zakres dyżuru 230) i zakaz zmiany zachowania fallbacku błędu renderu (`:391`, `:647`) |
| Zapis | `server/src/services/report/pptx/atomics/*.ts` — WYŁĄCZNIE stopnie, wagi i interlinia zgodnie z `R2c`-`R2e`. **Zakaz dokładania i usuwania `fit: 'shrink'`** (`SlideTitle.ts:143`, `KpiValue.ts:66`, `Highlight.ts:43`, `Badge.ts:42`) — to jest zakres dyżuru **230** i dotknięcie go tutaj to kolizja |
| Zapis | `server/src/services/report/pptx/layouts/*.ts` — WYŁĄCZNIE zmiany stopni/wag/kolorów wynikające z `R2`; **zakaz dodawania nowych pozycji do `LAYOUT_REGISTRY` (`index.ts:54-72`) i do `LAYOUT_TEMPLATES` (`deckLayoutDecision.ts:75`)** |
| Zapis | NOWY ekran `dev-render/screens/day229-gamma-motyw.tsx` + wpis w `dev-render/main.tsx` (WYŁĄCZNIE dodanie jednej pozycji do rejestru ekranów) |
| Zapis | NOWE pliki testowe `day229.*` w `server/src/services/report/pptx/__tests__/` i `tests/unit/reports/`. ★ Nowe pliki w `tests/` wymagają `git add -f` |
| Zapis | NOWY skrypt pomiarowy w `server/scripts/` (jeżeli rozszerzasz `proof-deck-pptx-analyze.mjs`, robisz to **kopią o nowej nazwie**, nie edycją oryginału) |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY229_GAMMA_MOTYW_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/deliverables/DeckStyler.ts` · `themeRegistry.ts` · `bundlePptxRuntime.ts` · `bundleExportRuntime.ts` · `server/src/services/initiative/initiativeMaterializeService.ts` — **cały tor B**; mierzysz i opisujesz, nie zmieniasz |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/presentationExportGate.ts` · `server/src/routes/presentations.routes.ts` · `server/src/Gateway.ts` — bramek i tras nie zmieniasz, masz przez nie PRZECHODZIĆ |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/deliverables/slideArchetypes.ts` · `server/src/services/presentationLayoutDirectorService.ts` · `server/src/services/presentationGeneratorService.ts` — rejestry archetypów i planer; czytasz do tabeli `R3` |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` · `server/src/database/Database.ts` — pułapki środowiska; **znasz je, nie zmieniasz** (`Z18`) |
| Odczyt | `docs/program/funkcje/GAMMA_G1_SPECYFIKACJA.md` · `GAMMA_G1_OBRAZY.md` · `GAMMA_G2_SESJA_NA_ZYWO.md` · `GAMMA_G3_OBCHOD_MENU.md` · `GAMMA_G0_POMIAR.md` · `MARZENIE_GAMMA_DECKI.md` · `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md` · `docs/ui-standards/TRIADA_KANON.md` |

**Nietykalne imiennie:** `presentationExportGate.ts` · `DeckStyler.ts` · `themeRegistry.ts` ·
`bundlePptxRuntime.ts` · `initiativeMaterializeService.ts` · `slideArchetypes.ts` ·
`vitest.config.ts` · `tests/setup.ts` · `Database.ts` · każdy `MODULE_ACCEPTANCE.md`.

**★★ ROZŁĄCZNOŚĆ Z PARTIĄ RÓWNOLEGŁĄ — TO JEST NAJWIĘKSZE RYZYKO TEGO DYŻURU.**
Równolegle z Tobą idą **cztery** dyżury w tym samym module, wszystkie wydane 01.09:

| dyżur | zakres | Twoja granica |
|---|---|---|
| **226** — martwy edytor motywu | `presentations.routes.ts:1566-1567` (`customTemplate` ginie w destrukturyzacji), `presentationTemplateRuntimeService.ts:372-452` (`colorTemplateId` nieczytany) | **nie dotykasz tras szablonów ani `presentationTemplateRuntimeService.ts`** |
| **227** — ★ geometria dwóch rendererów | `designTokens.ts` (`GRID`), `DeckStyler.ts` (`DECK_GRID`), `initiativeMaterializeService.ts:488` | ★★ **wchodzi w TEN SAM plik co Ty** — Ty bierzesz **wyłącznie kolory, kroje, stopnie, wagi i interlinię**; **siatka, marginesy i pole treści są jego** |
| **228** — styl obrazu w motywie | `deckVisualsService.ts` (~`:599`), `deckImageResolverService.ts` | brak kolizji, ale **nie dokładasz generowania obrazów** |
| **230** — przepełnienie | `fit: 'shrink'` w `PptxPipelineService.ts:490` i `atomics/*.ts` | **nie dodajesz i nie usuwasz ani jednego `fit: 'shrink'`** |

★★ **Kolizja z 227 jest realna i imienna: obaj piszecie do `designTokens.ts`.**
Podział jest jednozdaniowy: **227 ma siatkę, Ty masz tusz i typografię.**
Jeżeli okaże się, że tego podziału nie da się utrzymać — **to jest zgłoszenie kolizji do
nadzorcy przed pierwszym commitem**, nie negocjacja w kodzie.

**Zanim napiszesz pierwszą linię**, wykonaj:

```bash
git -C "$WT" log --oneline 9fb7942a01..github-backup/codex/m03-admin-20260824 -- \
  server/src/services/report/pptx/ server/src/services/deliverables/
```

i **zgłoś kolizję zasobową ZANIM zaczniesz pisać, nie po**. To nie jest STOP — to jest wpis
do raportu i, jeżeli kolizja jest realna, zawężenie Twojego zakresu do `designTokens.ts` + bramka.

---

# 5. TWARDE ZASADY

- ★★ **BRAMKA MIERZY PLIK, NIE KONFIGURACJĘ.** Test, który sprawdza, że w `designTokens.ts`
  zapisano `1.0`, jest tautologią, nie bramką. Bramka rozpakowuje `.pptx`, parsuje
  `ppt/slides/slideN.xml` i odczytuje `a:lnSpc/a:spcPct/@val`, `sz`, `a:latin/@typeface`,
  `a:effectLst`. Jeżeli Twój test nie otwiera bajtów — **pozycji `R4` nie oddajesz**.
- ★★ **CZTERY MUTACJE, KAŻDA OSOBNO, OSIEM WYJŚĆ W RAPORCIE.** Jedna mutacja psująca cztery
  bramki naraz nie dowodzi, że bramki są cztery. Psujesz po jednej wartości i pokazujesz,
  że czerwienieje **dokładnie ta jedna**.
- ★★ **ZAKAZ DOKŁADANIA CZWARTEGO REJESTRU UKŁADÓW.** Siedem archetypów **mapujesz** na 17
  układów intencyjnych (`layouts/index.ts:54-72`) i 29 szablonów geometrii
  (`layouts/deckLayoutDecision.ts:75`). Gdzie mapowania nie ma — piszesz „brak".
- ★★ **SIATKA, MARGINESY I POLE TREŚCI SĄ CUDZYM TERENEM (dyżur 227).** `GRID`
  (`designTokens.ts:39-48`) i `SPACING` (`:50-55`) **zostają bez zmian**. Ty zmieniasz
  **tusz i typografię**: kolory, kroje, stopnie, wagi, interlinię, promienie, włos, brak cieni.
  Jeżeli nowa drabina nie mieści się bez zmiany siatki — **STOP pozycji z opisem i zgłoszenie
  kolizji**, nie cicha zmiana `GRID`.
- ★★ **`fit: 'shrink'` JEST CUDZYM TERENEM (dyżur 230).** W tym dyżurze go **nie dodajesz
  i nie usuwasz** — ani w `atomics/SlideTitle.ts:143`, ani w `KpiValue.ts:66`, ani w
  `Highlight.ts:43`, ani w `Badge.ts:42`, ani w `PptxPipelineService.ts:490`. Dotknięcie
  któregokolwiek to kolizja zasobowa i podstawa odrzucenia.
- ★★ **DWA STOPNIE W DRABINIE SĄ DECYZJĄ, NIE POMIAREM** (treść 15 zamiast ~11, liczba 52
  zamiast ~34 — `GAMMA_G1_SPECYFIKACJA.md` §7). W raporcie **nazywasz je decyzją**, podajesz
  wartość zmierzoną w gammie obok i piszesz, czym płacimy (mniej treści na slajd).
  Podanie ich jako „zmierzonych" jest zawyżeniem.
- ★★ **NIE ROZSTRZYGASZ „Classic kontra Studio"** (slajd z bloków kontra slajd wypalony jako
  obraz). To decyzja właściciela (`GAMMA_G2_SESJA_NA_ZYWO.md`, punkt 2). Twój motyw musi
  działać w wariancie Classic — czyli **tekst, liczby i schematy zostają kształtami OOXML**.
- ★ **RENDER LIBREOFFICE NIE JEST RENDEREM POWERPOINTA.** Jeżeli używasz `soffice` do zrzutu,
  piszesz to **przy zrzucie**, nie w przypisie: podmiana kroju zmienia złamania wierszy,
  więc zrzut dowodzi palety, hierarchii i braku cieni — a **nie** dowodzi, że tak samo
  wygląda u klienta.
- ★ **ZERO NOWYCH ZALEŻNOŚCI.** `jszip`, `fast-xml-parser` i `pptxgenjs` są już w
  `dependencies`; `sharp` i `playwright` w `devDependencies`. Jeżeli sięgasz po cokolwiek
  spoza tej listy — **STOP pozycji z opisem**, nie `npm install`.
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
