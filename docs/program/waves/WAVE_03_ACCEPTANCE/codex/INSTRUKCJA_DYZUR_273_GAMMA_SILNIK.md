# INSTRUKCJA DYŻURU nr 273 — Codex — „★★ GAMMA FILAR 2 — SILNIK SKŁADANIA, ETAP 1 (RDZEŃ BEZ OBRAZÓW). Zmierzone bezpośrednio w kodzie na markerze `444d789363`: DWA NIEZALEŻNE systemy skali typografii istnieją równolegle i są używane RÓWNOCZEŚNIE przez ten sam plik (`server/src/services/deliverables/DeckStyler.ts:29,31` importuje `getDesignTokens` z `server/src/services/report/pptx/designTokens.ts` ORAZ `PPT_TYPE_SCALE` z `server/src/services/deliverables/themeRegistry.ts`) — `designTokens.ts` ma `FONT_SIZES.slideTitle=28/body=13`, `themeRegistry.ts` ma `PPT_TYPE_SCALE.slideTitle=28/body=18/coverTitle=40`, ŻADNA z tych wartości nie jest celem właściciela (`34pt`/`15pt`). `GAMMA_G1_SPECYFIKACJA.md` §2 definiuje DOKŁADNIE `7` archetypów (A1 Okładka, A2 Przekładka/statement, A3 Tekst+slot obrazu, A4 Kafle N-up, A5 Rząd liczb, A6 Narracja+wizual, A7 Sekwencja numerowana) — generator PPTX ma dziś `17` osobnych klas `*Layout.ts` (`server/src/services/report/pptx/layouts/`) mapowanych z `intent` przez `deckLayoutDecision.ts`, BEZ żadnej warstwy `ARCHETYPE_OF_INTENT`. Bramka gęstości `DR-01` istnieje (`server/src/services/deliverables/deckDesignCritic.ts:85`, `MAX_WORDS_TOTAL=40`) i JUŻ ma poprawny limit okładki (`TITLE_MAX_WORDS=14`, linia 87 — **nie zmieniasz tej wartości**). Marker punktowań `•` jest dziś pierwszym elementem `LIST_MARKERS.bullet` (`themeRegistry.ts:202`) i jest ZAKAZANY decyzją właściciela. Kanwa `designTokens.ts` `GRID` ma dziś `slideW=10/slideH=5.625` (10×5,625 cala) — cel to `LAYOUT_WIDE` PowerPoint (`13,333×7,5` cala / `960×540 pt`). Konwerter PPTX→PDF NIE ISTNIEJE w kodzie — jedyny precedens to opcjonalne (`DOCX_VISUAL_QA=1`) wywołanie `soffice --headless --convert-to pdf` w teście DOCX (`documentStudioGenerateExportHappyPath.test.ts:454`), którego DOSTĘPNOŚĆ na Twojej maszynie MUSISZ zmierzyć sam (`which soffice`), nie założyć. Fonty display/text z fallbackiem JUŻ ISTNIEJĄ w `tailwind.config` (`serif: Playfair Display→Georgia`, `sans: Inter→sans-serif`) — używasz ICH, nie wymyślasz nowej pary."

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
poprzednich dyżurów. Wszystko, czego potrzebujesz, jest poniżej albo pod
wskazanymi ścieżkami w repo.

> ### ★★ ZAKAZ NR 1 — KATALOG WŁAŚCICIELA. CZYTASZ TO, ZANIM URUCHOMISZ COKOLWIEK.
>
> **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani
> do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`.
> Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**
> wg `DEC-2026-08-26-86`. Twoje miejsce pracy to **wyłącznie**
> `/private/tmp/cx-day273-gamma-silnik`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `444d789363`**
> **Gałąź bazowa: `github-backup/integracja/20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać. Jeżeli
> widzisz `PROJEKT` albo jakiekolwiek niewypełnione pole szablonu — dokument
> nie jest wydany, nie zaczynasz i zgłaszasz to nadzorcy.

Data wystawienia: 2026-09-02.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **Gamma filar 2 — silnik składania własnego (7 archetypów, tokeny, gęstość, PDF-mierzony), etap 1 rdzenia, prototyp .pptx+.pdf do akceptu PRZED podpięciem do produktu.**
Trasy front: `brak w zakresie ZAPISU tego dyżuru — silnik jest zapleczowy; jeśli istnieje żywy front wywołujący eksport decków, opisz go w R1, nie zmieniaj`.
Trasy tył: `server/src/services/report/pptx/designTokens.ts` (rdzeń — jedyne źródło skali po naprawie, **PEŁNA LICENCJA**) · `server/src/services/deliverables/themeRegistry.ts` (rdzeń — `PPT_TYPE_SCALE`/`LIST_MARKERS`, **WĄSKA LICENCJA**: przekierowanie skali na `designTokens.ts`, zmiana markera bullet) · `server/src/services/deliverables/DeckStyler.ts` (odczyt + wąska licencja — konsument obu systemów, punkt zszycia) · `server/src/services/deliverables/deckDesignCritic.ts` (rdzeń — bramka `DR-01`, **WĄSKA LICENCJA**: progi słów) · `server/src/services/report/pptx/layouts/*.ts` (odczyt szeroki — 17 plików, źródło mapowania archetypów) · `server/src/services/report/pptx/layouts/deckLayoutDecision.ts` (odczyt — mapa `intent`→`LAYOUT_TEMPLATES`) · **NOWY** `server/src/services/report/pptx/archetypeRegistry.ts` (mapa `ARCHETYPE_OF_INTENT`, **PEŁNA LICENCJA**) · `server/src/routes/report-builder.routes.ts`, `server/src/routes/assessment-reports.routes.ts` (odczyt — istniejący pdfkit A4, zostaje „text-summary" jawnie oznaczony) · **NOWY** ewentualny `server/src/routes/deckPdfExport.routes.ts` albo rozszerzenie istniejącej trasy decków (**WĄSKA LICENCJA**, tylko jeśli `§A.4` potwierdzi dostępność `soffice`) · `tailwind.config.*` (**TYLKO ODCZYT** — wzorzec fontów, nie dotykasz).

---

## ★ SPROSTOWANIA NADZORCY (zmierzone bezpośrednio w kodzie)

1. **Nie ma jednego systemu skali do „naprawienia" — są DWA, używane
   RAZEM w tym samym pliku** (`DeckStyler.ts`). To nie jest dług do
   posprzątania kiedyś — to jest AKTYWNA sprzeczność: ten sam kod czyta
   `28pt`/`13pt` z jednego źródła i `28pt`/`18pt`/`40pt` z drugiego dla
   pokrewnych ról. Ten dyżur czyni `designTokens.ts` JEDYNYM źródłem i
   **przepina** `themeRegistry.ts`, żeby re-eksportował te same wartości
   (nie odwrotnie — `designTokens.ts` ma więcej konsumentów, patrz lista w
   weryfikacji wejściowej).
2. **`TITLE_MAX_WORDS=14` w `deckDesignCritic.ts` JEST JUŻ POPRAWNE**
   (pasuje do „okładka ≤14 słów") — **NIE ZMIENIASZ TEJ STAŁEJ**, zmieniasz
   wyłącznie `MAX_WORDS_TOTAL` (dziś `40`, cel: miękki próg `80`, twardy
   limit `110`).
3. **17 klas `*Layout.ts` to nie to samo co 7 archetypów G1.** Layouty to
   dzisiejsza warstwa renderowania per `intent` (mapowanie 1:N, wiele
   layoutów na jeden intent, wybór przez `deckLayoutDecision.ts`).
   Archetypy G1 to warstwa WYŻSZA — kategoria kompozycji. Zadanie tego
   dyżuru NIE JEST przepisaniem 17 layoutów, jest DOPISANIEM tabeli
   `ARCHETYPE_OF_INTENT`, która każdemu `intent` przypisuje jeden z 7
   symboli `A1`-`A7`, i przepuszczeniem renderowania przez wspólne tokeny
   (kolor/font/interlinia/marker) niezależnie od tego, który z 17 plików
   faktycznie rysuje slajd.
4. **Konwerter PDF nie istnieje. `soffice` MOŻE nie być zainstalowany na
   Twojej maszynie** — jedyny precedens w kodzie jest za flagą opt-in
   `DOCX_VISUAL_QA=1` w teście DOCX, co dowodzi WZORCA UŻYCIA, nie
   DOSTĘPNOŚCI binarki. Zmierz `which soffice` PRZED jakąkolwiek decyzją
   architektoniczną (`§A.4`).

Jeżeli Twój własny pomiar w `R1` pokaże inaczej niż punkty 1-4 — to jest
WYNIK (`Z24`), wpisz do „Korekt wobec instrukcji" i kontynuuj z właściwym
stanem.

---

### 0.1. ★★ BAZA PRACY, MARKER I GAŁĄŹ — PROCEDURA DOSŁOWNA, Z VAULTA

```bash
VAULT=/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
WT=/private/tmp/cx-day273-gamma-silnik
MARKER=444d789363

df -h /
git -C "$VAULT" fetch github-backup --prune
git -C "$VAULT" log --oneline -25 github-backup/integracja/20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/integracja/20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

git -C "$VAULT" worktree add "$WT" -b codex/day273-gamma-silnik-20260902 "$MARKER"

# ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day273-gamma-silnik/config.worktree"
cat "$VAULT/worktrees/cx-day273-gamma-silnik/config.worktree"

ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

mkdir -p /private/tmp/cx-day273-gamma-silnik-scratch
mkdir -p /private/tmp/cx-day273-gamma-silnik-artefakty
mkdir -p evidence/day273   # W REPO — prototyp wynikowy .pptx/.pdf idzie tu, §A.5

cd "$WT"
git rev-parse HEAD
git status --short | head -3
```

**Wynik komend (log/merge-base, rev-parse/status) wklejasz do raportu
dosłownie.**

> **★★ PUŁAPKA — REMOTE `icloud-source` JEST MARTWY.** Nie wołaj
> `git fetch --all`. Jego błąd nie jest powodem do STOP-u.

**★★ REGUŁA ROZEJŚCIA.** Marker nieprzodek/gałąź nieistniejąca → STOP
całości. Marker przodek, tip do przodu → NIE STOP, startujesz z markera,
wpisujesz `git log --oneline 444d789363..github-backup/integracja/20260902`
do raportu. **Rebase zakazany. Nie pushujesz sam** — nadzorca po odbiorze.

**Komenda bazowa dla listy dotkniętych plików:**

```bash
git -C "$WT" diff --name-only 444d789363..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `12` komend, wszystkie obowiązkowe.**

```bash
cd "$WT"

# (1) TEZA: DeckStyler.ts importuje OBA systemy skali rownoczesnie
sed -n '25,35p' server/src/services/deliverables/DeckStyler.ts
#   oczekiwane: import `getDesignTokens` z designTokens.js ORAZ `PPT_TYPE_SCALE`
#   z themeRegistry.js w tym samym pliku

# (2) TEZA: dwie rozne skale, zadna nie jest celem 34/15
sed -n '20,40p' server/src/services/report/pptx/designTokens.ts | grep -A12 "FONT_SIZES\s*="
sed -n '180,200p' server/src/services/deliverables/themeRegistry.ts
#   oczekiwane: designTokens FONT_SIZES.slideTitle=28,body=13; themeRegistry
#   PPT_TYPE_SCALE.slideTitle=28,body=18,coverTitle=40 — zaden nie ma 34/15

# (3) TEZA: LIST_MARKERS.bullet[0] to zakazany znak "•"
grep -n "LIST_MARKERS" -A4 server/src/services/deliverables/themeRegistry.ts
#   oczekiwane: `bullet: ['•', '–', '·']`

# (4) TEZA: DR-01 istnieje, TITLE_MAX_WORDS juz poprawne, MAX_WORDS_TOTAL do zmiany
sed -n '80,90p' server/src/services/deliverables/deckDesignCritic.ts
#   oczekiwane: `MAX_WORDS_TOTAL = 40`, `TITLE_MAX_WORDS = 14`

# (5) TEZA: kanwa dzis 10x5.625in, nie LAYOUT_WIDE (13.333x7.5in)
grep -n "slideW\|slideH\|GRID" server/src/services/report/pptx/designTokens.ts | head -5
#   oczekiwane: slideW=10, slideH=5.625

# (6) TEZA: 17 klas Layout.ts istnieja, deckLayoutDecision.ts mapuje intent->template,
#     zero warstwy ARCHETYPE_OF_INTENT
ls server/src/services/report/pptx/layouts/*.ts | grep -v __tests__ | grep -vc index.ts
grep -rln "ARCHETYPE_OF_INTENT\|archetypeRegistry" server/src/ 2>/dev/null
#   oczekiwane: pierwszy -> 17 (moze byc 18 z deckLayoutDecision.ts wliczonym,
#   policz dokladnie sam); drugi -> 0 trafien (nie istnieje jeszcze)

# (7) TEZA: soffice jest uzywany w kodzie WYLACZNIE za flaga opt-in w tescie DOCX
grep -n "soffice" server/src/services/documentStudio/__tests__/documentStudioGenerateExportHappyPath.test.ts
grep -rln "soffice" server/src/routes/ server/src/services/ --include="*.ts" | grep -v __tests__
#   oczekiwane: pierwszy grep trafia (za DOCX_VISUAL_QA=1); drugi -> 0 trafien
#   (zaden produkcyjny route/serwis nie wola soffice dzis)

# (8) TEZA: soffice NA TWOJEJ MASZYNIE — zmierz, nie zakladaj
which soffice || echo "SOFFICE BRAK NA TEJ MASZYNIE"
#   wynik wpisujesz do raportu doslownie, niezaleznie jaki jest

# (9) TEZA: istniejacy pdfkit A4 (report-builder/assessment-reports) to
#     text-summary, nie wizualny odpowiednik PPTX
grep -n "pdfkit\|PDFDocument" server/src/routes/report-builder.routes.ts | head -5
grep -n "pdfkit\|PDFDocument" server/src/routes/assessment-reports.routes.ts | head -5
#   oczekiwane: oba pliki uzywaja pdfkit bezposrednio (tekstowy dokument A4,
#   nie renderowanie slajdow)

# (10) TEZA: fonty display/text z fallbackiem JUZ istnieja w tailwind
grep -n "serif:\|sans:" tailwind.config.* | head -5
#   oczekiwane: `serif: ["'Playfair Display'", 'Georgia', 'serif']`,
#   `sans: ['Inter', 'sans-serif']`

# (11) TEZA: pptxgenjs w uzyciu, wersja 4.x
grep -n "pptxgenjs" package.json
#   oczekiwane: "^4.0.1" albo zblizona wersja 4.x

# (12) miejsce na dysku
df -h /
#   oczekiwane: powyzej 5 GB wolnego
```

---

### §0.4a — pomiar zasięgu testów (warunek oddania raportu, patrz `Z24`)

1. PRZED zmianami: uruchom pakiety z licencji z `--reporter=json`, zapisz
   `przed-nazwy.txt`.
2. PO zmianach: to samo do `po-nazwy.txt`.
3. `diff przed-nazwy.txt po-nazwy.txt` w raporcie.
4. Przepisanie cudzej liczby = zawyżenie. Liczysz sam.

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`.** Ten dyżur NIE PUSHUJE W OGÓLE | Push wykonuje wyłącznie nadzorca |
| `Z2` | **Nie zmieniasz/pushujesz** cudzych gałęzi. Odczyt dozwolony | Cudze tory w toku |
| `Z3` | **Żadnego `--force`, `reset --hard`, `rebase`** | Krach 3/4 |
| `Z4` | **Nie czytasz/kopiujesz WIP właściciela ani `_backup/**`** | Śmietnik kolizji |
| `Z5` | **★★ Nie dotykasz `/Users/piotrwisniewski/Developer/Consultify`** poza symlinkiem | STOP dyżuru 53 |
| `Z6` | **Nie dotykasz cudzych worktree** poza własnymi | Żyje ich ponad 100 |
| `Z7` | **★★ Port bazy `6286`. Port harnessu `5266 i 5267`.** Kontener: **`cx-day273-pg`** (ten dyżur prawdopodobnie NIE potrzebuje bazy — jeśli faktycznie jej nie użyjesz, pomiń krok kontenera i wpisz to w raporcie; port pozostaje zarezerwowany). Zajęte na stałe: 5000, 5037, 5060-5061. Zajęte przez inne prace: 6012, 5433, 6047, 6054-6284, 5010-5265, 6404-6411, 6600-6830. Cudze — paczka 270-273: baza 6280 harness 5260-5261 (270) · baza 6282 harness 5262-5263 (271) · baza 6284 harness 5264-5265 (272) | Trzy incydenty zapisu do cudzej bazy |
| `Z8` | **Zero interakcji z Railway** | Produkcja NIETYKALNA |
| `Z9` | **Żadnej bazy poza lokalnym kontenerem, JEŚLI w ogóle jej używasz** | Baza demo/staging to JEDNA baza |
| `Z10` | **★★ Zero nowych flag funkcyjnych poza JEDNĄ, jawnie zamówioną: `ENABLE_GAMMA_PILLAR2_ARCHETYPES`, `default OFF`.** Zero innych nowych flag, zero zmian domyślnej wartości istniejącej | Krach 07-12 |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO WIZUALIUM BEZ AKCEPTU.** Prototyp `§A.5` to plik `.pptx`/`.pdf` w `evidence/day273/` DO AKCEPTU, nie ekran produktu; silnik za flagą `default OFF` | `CLAUDE.md` reguła 7, załamanie 07-11 — „prototyp dokumentu JAKO PLIK" |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne: `auth.middleware.ts` · `Database.ts` · `vitest.config.ts` · `tests/setup.ts` | Pliki przekrojowe |
| `Z13` | **Dokładnie JEDEN plik raportu:** `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY273_GAMMA_REPORT.md`. **JEDYNY dodatkowy zapis do repo poza kodem i raportem: pliki prototypu w `evidence/day273/`** (`.pptx`, `.pdf` jeśli powstał, plus manifest `shasum -a 256`) — to są DANE WYNIKOWE do akceptu, nie dokumentacja rejestrowa, dozwolone wyjątkowo dla tego dyżuru | Dokumentacja rośnie szybciej niż produkt |
| `Z14` | **Nie zmieniasz `OWNER_DECISION_LEDGER_2026-08-24.md`** | SSOT decyzji właściciela |
| `Z15` | **Zero modelu językowego.** Generator składa z DANYCH DEMO istniejących, nie z promptu LLM | `DEC-51` |
| `Z16` | **Nie usuwasz uczciwych stanów pustych.** Istniejący pdfkit A4 zostaje, jawnie oznaczony „text-summary", NIE kasowany | Zero placebo |
| `Z17` | **Zakaz wszystkiego poza zakresem** | Podział z dyżurami równoległymi |
| `Z18` | **★★ NAJOSTRZEJSZY — zakaz globalnej infrastruktury testowej** | Jedna zmiana fałszuje cały korpus |
| `Z19` | **Nie odmontowujesz routera/middleware/joba CI.** Istniejące trasy pdfkit A4 zostają zamontowane, nie usuwasz ich | Bramki znikają łatwiej niż wracają |
| `Z20` | **★★ ZAKAZ testów DB bez pełnego env, JEŚLI w ogóle testujesz coś dotykające bazy** (ten dyżur prawdopodobnie nie dotyka) | Trzy incydenty zapisu do cudzej bazy |
| `Z21` | **DoD wymaga DOWODU OSIĄGALNOŚCI** — plik `.pptx` faktycznie otwiera się (rozpakuj jako zip, sprawdź XML), nie tylko „funkcja zwróciła buffer" | Istnienie kodu ≠ działanie |
| `Z22` | **★★ NIE DOTYCZY** — ten dyżur nie ma tras HTTP wymagających `ApiGateway`, chyba że `§A.4` zbuduje trasę eksportu PDF — wtedy dotyczy | Replika rozjeżdża się z produkcją |
| `Z23` | **★★ ZERO ATRAP.** Nagłówek `X-Consultify-Visual-Parity: claimed` bez REALNEGO porównania liczby stron PDF = liczby slajdów PPTX jest atrapą. Prototyp z placeholderami/Lorem ipsum zamiast danych demo jest atrapą | `DEC-51` |
| `Z24` | **Pomiar zasięgu wg `§0.4a` jest warunkiem raportu** | Liczby krążą i utrwalają się jako fakt |
| `Z25` | **★★ Testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL`, jeśli dotyczy** | Port 5432 nasłuchuje i nie jest Twój |
| `Z26` | **★★ Komplet env w tej samej linii, jeśli dotyczy — `§0.2c`** | Tak zginął dzień 23 |
| `Z27` | **★★ ZAKAZ `git stash`.** `cp` do `/private/tmp/cx-day273-gamma-silnik-scratch` | Schowek współdzielony |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI** | Jedyny zakaz zatrzymujący CAŁY dyżur |
| `Z29` | **★★ Testy „atak odrzucony" BEZ PONAWIANIA: `--retry=0`, jeśli dotyczy** | `retry: CI?3:1` |
| `Z30` | **★★ ZAKAZ REALNEJ WYSYŁKI** — `§0.2b` | Nieodwracalne |
| `Z31` | **★★ ZAKAZ PRZYPINANIA STRAŻNIKA REALDB, jeśli dotyczy** | Dyżur 43: 30 SKIP |
| `Z32` | **★★ ZAKAZ `FIXED` BEZ DOWODU MUTACYJNEGO.** Dla `§A.2` (bramka gęstości): slajd z 120 słowami MUSI failować test; slajd z 70 słowami MUSI przechodzić (miękki próg 80 jako ostrzeżenie, nie fail) | Dyżur 44: FIXED bez podatności |
| `Z33` | **★★ SPRAWDŹ, CZY STRAŻNIK SIĘ NIE WYŁĄCZA SAM W TESTACH** — `§0.2e` | 416 fałszywych twierdzeń |
| `Z34` | **★★ GREP DOWODZI, ŻE ISTNIEJE, NIE ŻE DZIAŁA.** „Działa" tylko po realnym wygenerowaniu pliku `.pptx`, jego otwarciu/rozpakowaniu, i zmierzeniu rozmiaru czcionek/limitów słów w wygenerowanym XML | Istnienie kodu ≠ działanie |
| `Z34a` | **NIE DOTYCZY** — brak pushu | — |
| `Z35` | **Zakaz naprawiania przez wyciszanie** | Choroba, którą program leczy |
| `Z36` | **Zakaz `eslint --fix`/`prettier --write` szerzej niż zmieniany plik** | Autofix niszczy pracę równoległą |
| `Z37` | **Porównania testów po NAZWACH, nie liczbach** | Wektor maskowania regresji |
| `Z38` | **Zakaz usuwania jobów CI** | Bramki znikają łatwiej niż wracają |
| `Z39` | **Zakaz uruchamiania realnych workflow GitHub Actions** | Dotyka sekretów poza kontrolą |
| `Z40` | **ZAKAZ przepisywania 17 plików `*Layout.ts` od zera** — dopisujesz WYŁĄCZNIE tabelę mapowania (`archetypeRegistry.ts`) i przepuszczasz istniejące layouty przez wspólne tokeny; jeśli layout twardo koduje własny kolor/font z pominięciem `designTokens`/`themeRegistry` — dokumentujesz w raporcie jako dług, NIE przepisujesz całego pliku w tym dyżurze. **ZAKAZ wołania Gamma API ani renderu do obrazu** — składanie jest własne, przez `pptxgenjs`. **ZAKAZ budowy konwertera PDF INNEGO niż `soffice --headless`** (np. puppeteer/chromium do screenshotów slajdów) bez decyzji właściciela — jeśli `soffice` niedostępny, `§A.4` kończy się STOP-em z pomiarem, nie improwizacją innego konwertera. **ZAKAZ podpinania silnika do jakiejkolwiek produkcyjnej trasy generującej realne decki klientów** — prototyp `§A.5` jest offline, plik do akceptu, flaga `default OFF` | `Harvard/wdrozenie-100/MARZENIE_GAMMA_DECKI.md` — twardy sufit: zero gradientów, zero osadzania czcionek, zero API Gammy |

---

### 0.2b. ★★ PROTOKÓŁ `Z30`

**(1) Zakaz:** SMTP/RESEND/SENDGRID/MAIL w env; wiersz SMTP w `settings`;
pełny `server/src/index.ts` na testy; ręczne `drain*`.

**(2) Dowody (jeśli dyżur w ogóle dotyka bazy — prawdopodobnie NIE):**

```bash
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"
```

**(3) Deklaracja obowiązkowa w raporcie, dosłownie:** **„Nie ustawiłem żadnej
zmiennej SMTP ani flagi wysyłki. Ten dyżur nie uruchamia `server/src/index.ts`
ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie
zostało wysłane."**

---

### 0.2c. ★★ KOMPLET ZMIENNYCH ŚRODOWISKOWYCH

Ten dyżur jest w większości bezstanowy (generowanie plików lokalnie, testy
jednostkowe na buforach `.pptx`). Jeśli piszesz test HTTP dla `§A.4` (trasa
eksportu PDF), użyj:

```bash
cd /private/tmp/cx-day273-gamma-silnik && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/services/report/pptx/__tests__/day273-archetype-registry.test.ts \
  server/src/services/deliverables/__tests__/day273-density-gate.test.ts \
  server/src/services/report/pptx/__tests__/day273-canvas-tokens.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day273-gamma-silnik-artefakty/day273-jednostkowe.json
```

Jeśli `§A.4` zbuduje trasę HTTP `/decks/:id/export/pdf-visual`, dowód tej
trasy wymaga pełnego kompletu (`ENABLE_V8_GLOBAL`, `ENABLE_TEST_AUTH_BYPASS`,
`DATABASE_URL`, `JWT_SECRET`) — zmierz w `R1`, pod jaką bramką ta trasa by
siedziała, zanim napiszesz test.

**Znaczenie zmiennych — jak w innych dyżurach paczki**, patrz `§0.2d` pkt 5
poniżej dla `DB_TYPE='sqlite'`.

---

### 0.2d. ★★ ZNANE PUŁAPKI ŚRODOWISKA — OSIEMNAŚCIE

1. Vault BARE + `worktreeConfig=true` — krok obowiązkowy w `§0.1`.
2. `icloud-source` MARTWY, nie `fetch --all`.
3. Host bez `psql`, jeśli dotyczy — `docker exec cx-day273-pg psql …`.
4. Runner migracji wymaga `NODE_ENV=test`, jeśli dotyczy.
5. `vitest.config.ts` przybija `DB_TYPE='sqlite'` — nadpisz w tej samej linii, jeśli dotyczy.
6. `JSON.parse` na `json` — nie dotyczy tego dyżuru (brak kolumn JSON w zakresie).
7. CI nie uruchamia testów naszych gałęzi — nie jest dowodem.
8. `docker rm -f` bez `-v` nie kasuje wolumenu, jeśli używasz kontenera.
9. Reporter `basic` nie istnieje.
10. `npx vitest run` bywa `exit 0` mimo czerwonych testów.
11. Nowe pliki w `__tests__/` wymagają `git add -f`.
12. `| head` na grepie sierot produkuje fałszywe sieroty.
13. ESM nie honoruje `NODE_PATH`.
14. `github-backup` nie ma `main`/`develop`/`Londyn`/`demo`.
15. `postgres:15` nie przechodzi migracji, jeśli używasz bazy.
16. `prettier` na wielkich plikach potrafi przepisać cały plik — `designTokens.ts`/`themeRegistry.ts` są współdzielone, uważaj.
17. Testy tekstowe przez `readFileSync`+`toContain` na dosłownych liniach — jeśli istnieją dla `themeRegistry.ts`, reformat je wywali.
18. **★ WŁAŚCIWA TEMU DYŻUROWI: `.pptx` to ZIP.** Weryfikacja treści (rozmiar
    fontu, liczba słów, marker punktowania) wymaga rozpakowania bufora jako
    archiwum ZIP i sparsowania `ppt/slides/slideN.xml` — `toContain('34pt')`
    na surowym buforze binarnym **nic nie dowodzi** (dane są skompresowane).
    Użyj biblioteki do ZIP już w `devDependencies` (zmierz którą — `grep -n
    "\"jszip\"\|\"adm-zip\"\|\"yauzl\"" package.json`) albo `unzip` przez
    `execFileSync` do katalogu tymczasowego.

---

### 0.2e. ★★ RAMKA DO `Z33`

> **(a)-(d)** Standardowe pułapki `ENABLE_V8_GLOBAL`/beta-visibility/`DB_TYPE`/
> `ENABLE_TEST_AUTH_BYPASS` **DOTYCZĄ WYŁĄCZNIE, JEŚLI `§A.4` zbuduje trasę
> HTTP**. Dla wszystkich pozostałych pozycji (`§A.1`-`§A.3`, `§A.5`) — **NIE
> DOTYCZY**, dowód: testy operują na buforach plików w pamięci/na dysku, zero
> `ApiGateway`, zero bazy.
>
> **(e) ★★ PUŁAPKA WŁAŚCIWA TEMU DYŻUROWI — dwa systemy skali muszą zgadzać
> się PO zmianie, nie tylko `designTokens.ts`.** Jeśli zmienisz WYŁĄCZNIE
> `designTokens.ts` i zostawisz `themeRegistry.PPT_TYPE_SCALE` z osobnymi,
> starymi wartościami — `DeckStyler.ts` (który importuje OBA) nadal będzie
> mieszał `34pt` z jednego i `28pt` z drugiego zależnie od tego, które API
> zawoła dana ścieżka renderowania. Dowód poprawności: test asertujący, że
> `themeRegistry.PPT_TYPE_SCALE.slideTitle === getDesignTokens().fontSizes.slideTitle`
> (albo że `themeRegistry.ts` re-eksportuje wprost z `designTokens.ts`, nie
> duplikuje liczb) po Twojej zmianie.
>
> **Obowiązek dowodowy.** Dla każdego pakietu: akapit *która pułapka
> dotyczy, jak wyłączona, co dowodzi*. „Nie dotyczy" tylko z komendą-dowodem.

---

### 0.5. Reguła STOP

**MERYTORYCZNY** (mile widziany) vs **PROCEDURALNY** (zakazany).

| Powód | Co robisz ZAMIAST STOP-u |
| --- | --- |
| „Musiałbym zmienić plik przekrojowy" | Czerwony kontrakt + brief. Pozycja **ZROBIONA** |
| „Plik nie jest w tabeli licencji" | Tylko do odczytu + czerwony kontrakt + brief |
| „Instrukcja sprzeczna" | Sekcja „JEŚLI COŚ JEST SPRZECZNE" |
| „Ścieżka nie istnieje" | `ls`, wpis do Korekt, szukasz odpowiednika |
| „Dwie różne liczby" | Twój pomiar wiąże (`Z24`) |
| „`icloud-source` błąd" | Nie jest błędem |
| „Test przeszkadza" | Nie osłabiasz asercji |
| „Nie zdążę wszystkiego" | Rdzeń (`§A.1`, `§A.2`) + uczciwy opis reszty |
| „Port `6286`/`5266-5267` zajęty" | **STOP całości** |
| **„`soffice` niedostępny na tej maszynie"** | **To NIE jest STOP** — `§A.4` ma dokładnie zaprojektowane wyjście: pomiar + STOP TEJ POZYCJI z jawnym zdaniem, pdfkit A4 zostaje jawnie oznaczony „text-summary", raport to opisuje. Reszta dyżuru (`§A.1`,`§A.2`,`§A.3`,`§A.5` bez PDF) kontynuuje |

**Zatrzymanie CAŁEGO dyżuru wyłącznie przy:** `MARKER BRAK` · połączeniu do
bazy zdalnej (`Z28`) · ryzyku utraty danych/wysyłce (`Z30`) · <5 GB dysku ·
zajętym porcie `6286`/`5266`/`5267` (`Z7`).

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Plik nieopisany w tabeli jest domyślnie TYLKO DO
> ODCZYTU; produktem jest czerwony kontrakt + brief, **nie zatrzymanie
> dyżuru**.

| Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- |
| `server/src/middleware/auth.middleware.ts`, `server/src/database/Database.ts`, `vitest.config.ts`, `tests/setup.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE** | Czerwony kontrakt + brief |
| `server/src/services/report/pptx/designTokens.ts` | **★ PEŁNA LICENCJA** w zakresie `§A.1` (kanwa `LAYOUT_WIDE`, skala 34/15/52, paleta 1 powierzchnia+2 tusze+1 akcent ≤8%, zero cieni, interlinia nagłówka 1,0) | — |
| `server/src/services/deliverables/themeRegistry.ts` | **★ WĄSKA LICENCJA:** `PPT_TYPE_SCALE` przekierowane na `designTokens.ts` (re-eksport, nie duplikacja liczb); `LIST_MARKERS.bullet[0]` zmienione z `'•'` na coś zgodnego z zakazem „zero ozdób" (Twoja decyzja z uzasadnieniem, np. myślnik `'–'` już drugi w kolejności). Zakaz zmiany reszty pliku | Czerwony kontrakt + brief |
| `server/src/services/deliverables/deckDesignCritic.ts` | **★ WĄSKA LICENCJA:** wyłącznie `MAX_WORDS_TOTAL` (40→110 twardy limit) + dodanie progu ostrzegawczego `SOFT_WORDS_TOTAL=80` jeśli funkcja dziś nie rozróżnia poziomów; zakaz zmiany `TITLE_MAX_WORDS` i reszty pliku | Czerwony kontrakt + brief |
| `server/src/services/report/pptx/archetypeRegistry.ts` (**NOWY**) | **★ PEŁNA LICENCJA** | — |
| `server/src/services/report/pptx/layouts/*.ts` (17 plików) | **TYLKO ODCZYT** — źródło do zmapowania, nie do przepisania (`Z40`) | Dług udokumentowany w raporcie |
| `server/src/services/report/pptx/layouts/deckLayoutDecision.ts` | **TYLKO ODCZYT** | Dowód w raporcie |
| `server/src/services/deliverables/DeckStyler.ts` | **★ WĄSKA LICENCJA:** wyłącznie import/użycie tokenów, jeśli wymaga aktualizacji po ujednoliceniu skali; zakaz zmiany logiki `trimToWords`/`BULLET_MAX_WORDS` | Czerwony kontrakt + brief |
| `server/src/routes/deckPdfExport.routes.ts` (**NOWY**, TYLKO jeśli `§A.4` potwierdzi `soffice`) | **★ PEŁNA LICENCJA** | — |
| `server/src/routes/report-builder.routes.ts`, `server/src/routes/assessment-reports.routes.ts` | **★ WĄSKA LICENCJA:** wyłącznie dopisanie komentarza/etykiety „text-summary" przy istniejącym eksporcie pdfkit, zakaz zmiany logiki | Czerwony kontrakt + brief |
| `tests/**` (NOWE), `server/src/**/__tests__/**` (NOWE) | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18`/`Z31` | — |
| `evidence/day273/**` (**NOWY katalog**) | **★ PEŁNA LICENCJA** — jedyny dozwolony wyjątek od `Z13` (dane wynikowe prototypu do akceptu) | — |
| `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **NIE DOTYCZY** — dyżur bez UI | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY273_GAMMA_REPORT.md` | `§R.2` — **JEDYNY nowy dokument rejestrowy** (`Z13`) | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| `tailwind.config.*` | **TYLKO ODCZYT** — wzorzec fontów | — |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz w raporcie z dowodem plik:linia |

---

## B.2. TABELA POZYCJI Z DEFINICJĄ UKOŃCZENIA PER POZYCJA

| Pozycja | Nazwa jednym zdaniem | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `§A.1` | jedno źródło tokenów: kanwa `LAYOUT_WIDE`, skala 34/15/52, paleta, marker, interlinia | TAK | NIE — dowód: `designTokens.ts`/`themeRegistry.ts` nie są na liście `Z12` | 3 | `designTokens.ts` ma `GRID` `13.333×7.5in`; `FONT_SIZES` ma `slideTitle=34, body=15`, trzecia wartość `52` przypisana do roli, którą zmierzysz i uzasadnisz (kandydat: `coverTitle`/`kpiValue` — Twoja decyzja z dowodem, dlaczego ta rola); `themeRegistry.PPT_TYPE_SCALE` re-eksportuje te same liczby (test `§0.2e (e)`); `LIST_MARKERS.bullet[0] !== '•'`; paleta ograniczona do 1 powierzchni+2 tuszy+1 akcentu w komentarzu/strukturze tokenów, z adnotacją limitu ≤8% powierzchni akcentu (dokumentacyjnie, egzekwowane w `§A.3`); zero `boxShadow`/cień w nowych tokenach | test jednostkowy + `§0.2e (e)` | `feat(gamma): jedno zrodlo tokenow — kanwa/skala/paleta/marker (A.1)` |
| `§A.2` | bramka gęstości: cel 80, twardy limit 110, tytuł 34pt/tekst 15pt zmierzone na wygenerowanym pliku | TAK | NIE | 3 | `MAX_WORDS_TOTAL=110` (twardy, fail), nowy próg miękki `80` (ostrzeżenie, nie fail — zmierz obecny kształt zwracanej struktury `deckDesignCritic` i dodaj poziom `warning` jeśli dziś ma tylko `error`); test generuje slajd `.pptx`, rozpakowuje ZIP (`§0.2d` pkt 18), mierzy realny rozmiar fontu w XML i liczbę słów, asertuje zgodność z `34`/`15`/`110` | dowód mutacyjny (`Z32`): 120 słów → fail; 70 słów → pass | `feat(gamma): bramka gestosci 80/110, dowod na wygenerowanym pliku (A.2)` |
| `§A.3` | `ARCHETYPE_OF_INTENT` — 7 archetypów, mapa z 17 layoutów/intencji | TAK | NIE | 2 | Nowy plik `archetypeRegistry.ts` eksportuje stałą mapującą KAŻDY `intent` używany w `deckLayoutDecision.ts` (zmierz pełną listę w `R1`, nie zgaduj) na jeden z `A1`-`A7` (nazwy z `GAMMA_G1_SPECYFIKACJA.md` §2); test asertuje, że mapa jest KOMPLETNA (żaden intent bez archetypu) | test enumeracji + porównanie z listą intencji z `deckLayoutDecision.ts` | `feat(gamma): mapa 7 archetypow na intencje layoutow (A.3)` |
| `§A.4` | pomiar i (warunkowo) budowa eksportu PDF wizualnego | TAK | NIE — dowód: pomiar `which soffice` nie wymaga pliku przekrojowego; budowa trasy (jeśli soffice dostępny) dotyka wyłącznie nowego pliku routingu | 0-2 (zależnie od wyniku pomiaru) | Jeśli `soffice` DOSTĘPNY: nowa trasa `POST /decks/:id/export/pdf-visual` konwertuje wygenerowany `.pptx` przez `soffice --headless --convert-to pdf`, zwraca nagłówek `X-Consultify-Visual-Parity: claimed`, test asertuje liczba stron PDF (`pdfinfo`) = liczba slajdów PPTX. Jeśli `soffice` NIEDOSTĘPNY: `STOP` tej pozycji w formacie `§0.5`, z pomiarem `which soffice` w dowodzie, i jawnym zdaniem w raporcie: „istniejący pdfkit A4 (`report-builder.routes.ts`/`assessment-reports.routes.ts`) pozostaje jawnie oznaczony jako text-summary, nie wizualny odpowiednik PPTX" | `which soffice` + (warunkowo) test HTTP | `feat(gamma): eksport pdf-visual przez soffice (A.4)` ALBO brak commitu kodu + wpis STOP w raporcie |
| `§A.5` | prototyp wynikowy — 7 slajdów, dane demo, do akceptu | TAK | NIE | 0 (to jest artefakt, nie test) | Plik `evidence/day273/gamma-pilar2-prototyp.pptx` z DOKŁADNIE 7 slajdami (po jednym na każdy archetyp A1-A7), zbudowany z realnych danych demo (nie Lorem ipsum — zmierz w `R1` skąd wziąć przykładowe dane inicjatywy/KPI z istniejących fixture'ów/seedów), przez silnik za flagą `ENABLE_GAMMA_PILLAR2_ARCHETYPES=false` (default OFF) używaną WYŁĄCZNIE do wygenerowania tego pliku lokalnie, NIE odsłoniętą nigdzie w UI; jeśli `§A.4` dał PDF — także `evidence/day273/gamma-pilar2-prototyp.pdf`; manifest `shasum -a 256` obu plików w raporcie | otwarcie/rozpakowanie pliku, `unzip -l`, `shasum -a 256` | `feat(gamma): prototyp 7 archetypow do akceptu, flaga OFF (A.5)` |
| `§R.2` | raport dyżuru | NIE | NIE | n/d | struktura z `§R.2` | — | `docs(day273): raport dyzuru (R.2)` |

> **Kolumna „Wymaga plików przekrojowych?"** — wszystkie pozycje `NIE` z
> dowodem: `designTokens.ts`/`themeRegistry.ts`/`deckDesignCritic.ts` nie są
> na liście `Z12`; nowy `archetypeRegistry.ts` i trasa eksportu to nowe
> pliki.

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora instrukcji | Komenda | Czy obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | pliki `*Layout.ts` w `server/src/services/report/pptx/layouts/` | 17 | `ls server/src/services/report/pptx/layouts/*.ts \| grep -v __tests__ \| grep -vc index.ts` | TAK |
| 2 | archetypy G1 zdefiniowane w specyfikacji | 7 (+2 trywialne w1/w2) | `grep -cE "^\| \*\*A[0-9]\*\*" docs/program/funkcje/GAMMA_G1_SPECYFIKACJA.md` | TAK |
| 3 | `MAX_WORDS_TOTAL` dziś | 40 | `grep -n "MAX_WORDS_TOTAL" server/src/services/deliverables/deckDesignCritic.ts` | TAK |
| 4 | `TITLE_MAX_WORDS` dziś (NIE ZMIENIAĆ) | 14 | `grep -n "TITLE_MAX_WORDS" server/src/services/deliverables/deckDesignCritic.ts` | TAK |
| 5 | pliki importujące `designTokens.ts` | 10 (patrz weryfikacja wejściowa, ustal dokładnie ponownie na swoim markerze) | `grep -rln "from.*designTokens\|require.*designTokens" server/src/ --include="*.ts" \| grep -v __tests__ \| wc -l` | TAK |
| 6 | wystąpienie `soffice` w kodzie produkcyjnym (nie testowym) | 0 | `grep -rln "soffice" server/src/routes/ server/src/services/ --include="*.ts" \| grep -v __tests__ \| wc -l` | TAK |

---

## B.4. TABELA ROZŁĄCZNOŚCI — PLIKI DO ZAPISU TEGO DYŻURU

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `server/src/services/report/pptx/designTokens.ts` | istniejący | `§A.1` | **ŚREDNIE — 10 konsumentów**, sprawdź `git diff --stat` |
| 2 | `server/src/services/deliverables/themeRegistry.ts` | istniejący | `§A.1` | ŚREDNIE — konsument `bundlePptxRuntime.ts` i inne |
| 3 | `server/src/services/deliverables/deckDesignCritic.ts` | istniejący | `§A.2` | ZEROWE (2 stałe) |
| 4 | `server/src/services/report/pptx/archetypeRegistry.ts` | NOWY | `§A.3` | ZEROWE |
| 5 | `evidence/day273/gamma-pilar2-prototyp.pptx` (+ `.pdf` warunkowo) | NOWY | `§A.5` | ZEROWE |
| 6 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY273_GAMMA_REPORT.md` | NOWY | `§R.2` | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `server/src/routes/deckPdfExport.routes.ts` | `§A.4` | tylko jeśli `which soffice` potwierdzi dostępność |
| `server/src/services/deliverables/DeckStyler.ts` | `§A.1` | tylko jeśli po ujednoliceniu skali wymaga aktualizacji importów |
| `server/src/routes/report-builder.routes.ts`, `assessment-reports.routes.ts` | `§A.4` | tylko etykieta „text-summary", niezależnie od wyniku soffice |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
server/src/services/report/pptx/layouts/*.ts (17 plikow, TYLKO ODCZYT)
server/src/services/report/pptx/layouts/deckLayoutDecision.ts
server/src/middleware/auth.middleware.ts
server/src/database/Database.ts
tailwind.config.*
Wszystko w src/ (front)
```

### B.4.4. Zasoby wyłączne tego dyżuru

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL (jeśli używany) | `6286` | `lsof -nP -iTCP:6286 -sTCP:LISTEN` |
| Port harnessu | `5266 i 5267` | jw. |
| Nazwa kontenera (jeśli używany) | `cx-day273-pg` | `docker ps --format '{{.Names}}'` |
| Przedział migracji | **NIE DOTYCZY — zero nowych migracji** | `ls server/migrations/ | grep -cE "^202619[45]"` → 0 |
| Gałąź | `codex/day273-gamma-silnik-20260902` | nie istnieje |
| Worktree | `/private/tmp/cx-day273-gamma-silnik` | nie istnieje |
| Flaga funkcyjna | `ENABLE_GAMMA_PILLAR2_ARCHETYPES`, `default OFF` | `grep -rn "ENABLE_GAMMA_PILLAR2_ARCHETYPES" server/src/ → tylko Twoje nowe wystapienia` |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day273-gamma-silnik
git diff --name-only --cached | tee /private/tmp/cx-day273-gamma-silnik-artefakty/staged.txt
grep -iE 'layouts/.*Layout\.ts$|deckLayoutDecision\.ts$|auth\.middleware\.ts$|Database\.ts$|tailwind\.config' \
  /private/tmp/cx-day273-gamma-silnik-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---
---

# POZYCJE ROBOCZE — SZCZEGÓŁY

## §A.1 — Jedno źródło tokenów

W `designTokens.ts`:
- `GRID`: `slideW: 13.333, slideH: 7.5` (cale — `pptxgenjs` `defineLayout`/`LAYOUT_WIDE` już to zna natywnie, zmierz w `R1` czy prościej ustawić `pres.layout = 'LAYOUT_WIDE'` bezpośrednio na obiekcie `pptxgenjs.Presentation`, zamiast przeliczać cale ręcznie — jeśli tak, zrób to tam, gdzie `Presentation` jest tworzony, i zredukuj `GRID` do wartości pochodnych).
- `FONT_SIZES.slideTitle = 34`, `FONT_SIZES.body = 15`. Trzecią wartość `52`
  przypisz roli, którą uzasadnisz pomiarem (np. jeśli `coverTitle`/`kpiValue`
  dziś nie istnieje w `designTokens.ts` w ogóle — dodaj ją; jeśli istnieje z
  inną wartością — zmień).
- Paleta: udokumentuj w komentarzu nad tokenami: 1 powierzchnia (tło), 2
  stopnie tuszu (tekst główny + drugorzędny), 1 akcent (użycie ≤8%
  powierzchni slajdu — to jest reguła egzekwowana wizualnie w `§A.5`, nie
  automatycznym testem w tym etapie, chyba że łatwo to policzyć z geometrii
  kształtów w XML — jeśli łatwo, zrób test, jeśli nie, opisz jako regułę
  projektową i weryfikuj okiem na prototypie).
- Zero `shadow`/cień w nowych/zmienianych tokenach.
- Interlinia nagłówka: `1.0` (`lineSpacing`/`charSpacing` w opcjach tekstu
  `pptxgenjs` — zmierz dokładną nazwę property w wersji `4.0.1`).

W `themeRegistry.ts`: `PPT_TYPE_SCALE` przestaje być własną literałową
strukturą i re-eksportuje wartości z `designTokens.ts` (np.
`export const PPT_TYPE_SCALE = { slideTitle: getDesignTokens().fontSizes.slideTitle, ... }`
albo import bezpośredni — zmierz najlepszy kształt bez psucia typów
konsumentów). `LIST_MARKERS.bullet[0]` zmień z `'•'` na inny znak zgodny z
zakazem ozdób (uzasadnij wybór w raporcie).

## §A.2 — Bramka gęstości

`deckDesignCritic.ts`: `MAX_WORDS_TOTAL = 110` (twardy limit, `error`), nowa
stała `SOFT_WORDS_TOTAL = 80` (cel, `warning` — zmierz, czy funkcja zwraca
dziś listę problemów z poziomem ważności; jeśli tak, dodaj poziom `warning`
analogicznie do istniejących `error`; jeśli nie rozróżnia poziomów, dodaj tę
dystynkcję minimalnie, bez przepisywania całej funkcji).

**Dowód mutacyjny (`Z32`):** wygeneruj testowy slajd ze 120 słowami treści →
bramka MUSI zwrócić `DR-01-DENSITY` jako `error`/fail. Ten sam slajd
skrócony do 70 słów → MUSI przejść (co najwyżej `warning`, nie `error`).

## §A.3 — Mapa archetypów

Zmierz w `R1` pełną listę `intent` używanych w `deckLayoutDecision.ts`
(`grep -oE "intents: \[[^]]+\]" server/src/services/report/pptx/layouts/deckLayoutDecision.ts`).
Zbuduj `archetypeRegistry.ts`:

```ts
export const ARCHETYPE_OF_INTENT: Record<string, 'A1'|'A2'|'A3'|'A4'|'A5'|'A6'|'A7'> = {
  cover: 'A1',
  section_intro: 'A2',
  // ... kazdy zmierzony intent, przypisany wg ksztaltu tresci
  // (patrz GAMMA_G1_SPECYFIKACJA.md §2 dla definicji A1-A7)
};
```

Test asertuje kompletność (każdy intent z `deckLayoutDecision.ts` ma wpis).

## §A.4 — PDF wizualny (warunkowe)

```bash
which soffice
```

Jeśli obecny: zbuduj `POST /decks/:id/export/pdf-visual` (albo rozszerz
istniejącą trasę eksportu decków, jeśli znajdziesz ją w `R1`) — generuje
`.pptx` przez istniejący pipeline, zapisuje do pliku tymczasowego,
konwertuje `execFileSync('soffice', ['--headless','--convert-to','pdf',...])`,
zwraca PDF z nagłówkiem `X-Consultify-Visual-Parity: claimed`. Test: liczba
stron PDF (`pdfinfo`) = liczba slajdów wejściowego `.pptx`.

Jeśli nieobecny: STOP tej pozycji (`§0.5` format), kontynuujesz resztę
dyżuru.

## §A.5 — Prototyp do akceptu

Zbuduj 7 slajdów (A1-A7) z danych demo (zmierz źródło — istniejący seed/
fixture inicjatyw/KPI w `scripts/dev/` albo `tests/fixtures/`, NIE Lorem
ipsum), przez silnik za `ENABLE_GAMMA_PILLAR2_ARCHETYPES=false` uruchomiony
lokalnie WYŁĄCZNIE do wygenerowania pliku (skrypt jednorazowy w
`scratch`/bezpośrednie wywołanie funkcji z testu-narzędzia — Twoja decyzja,
opisz). Zapisz do `evidence/day273/gamma-pilar2-prototyp.pptx`. Jeśli `§A.4`
dało PDF, wygeneruj też `.pdf` tą samą drogą. `shasum -a 256` obu plików do
raportu. **To jest DELIVERABLE do akceptu właściciela — nie podpinasz go do
żadnej trasy produktowej ani nie zmieniasz domyślnej flagi.**

---
---

## §R.1 — Podniesienie rejestru (NIE DOTYCZY tego dyżuru)

Brak przypisanego pliku `MODULE_ACCEPTANCE.md`.

## §R.2 — Raport dyżuru

Dokładnie jeden plik:
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY273_GAMMA_REPORT.md`

Struktura: nagłówek · weryfikacja wejściowa (12 komend) · `§A.1`-`§A.5` z
dowodami · wynik `which soffice` dosłownie · Korekty wobec instrukcji (w
tym potwierdzenie/obalenie `§ Sprostowania nadzorcy`) · STOP-y, jeśli były
(zwłaszcza `§A.4` przy braku `soffice`) · TWIERDZENIA NIEZWERYFIKOWANE ·
manifest artefaktów z `shasum -a 256` (w tym pliki `evidence/day273/`).

---
---

## ★★ JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE LUB NIEWYKONALNE

**Ta instrukcja była pisana i sprawdzana przez człowieka i model. Może mieć
błędy. Nie zatrzymuj przez nie dyżuru.**

1. **Opisz sprzeczność w raporcie** — cytat, numery paragrafów, dowód.
2. **Interpretacja BEZPIECZNIEJSZA:** nie ruszaj cudzego pliku · nie osłabiaj
   asercji · nie kasuj (`DO DECYZJI WŁAŚCICIELA`) · nie włączaj flagi
   domyślnie · nie wysyłaj na zewnątrz · nie poszerzaj dostępu · mierz
   zamiast zgadywać.
3. **KONTYNUUJESZ POZOSTAŁE POZYCJE.**
4. **Zatrzymanie CAŁEGO dyżuru** — wyłącznie z pięciu powodów `§0.5`.
5. **Nigdy nie „naprawiaj" instrukcji przez improwizację w kodzie.**
6. **★ Rozbieżność między pomiarem a tą instrukcją NIE JEST sprzecznością —
   jest WYNIKIEM.**

**★ Ostatnie zdanie i najważniejsze: obalenie którejkolwiek tezy z tytułu
tego dokumentu (włącznie z „§ Sprostowania nadzorcy") jest SUKCESEM dyżuru,
nie porażką. Zapisz w „Korektach wobec instrukcji" z dowodem i idź dalej.**

---
---

## AUDYT WYKONANY PRZEZ AUTORA

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — brak par wzajemnie wykluczających się | TAK |
| 2 | Każda ścieżka pliku zweryfikowana na markerze `444d789363` | TAK |
| 3 | Każda liczba ma odtwarzalną komendę (`B.3`) | TAK |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy „STOP" | TAK |
| 5 | Wykonalność per pozycja bez plików przekrojowych — z dowodem | TAK |
| 6 | Przydział zasobów sprawdzony wobec 270/271/272 | TAK |
| 7 | Komendy paste-ready, komplet env w jednej linii, `--retry=0` | TAK |
| 8 | Pułapki środowiska w całości (18, w tym własna pkt 18 o ZIP) | TAK |
| 9 | Samodzielność dokumentu | TAK |
| 10 | Klauzula sprzeczności; `grep -c '<<' <plik>` → `0` | TAK |
