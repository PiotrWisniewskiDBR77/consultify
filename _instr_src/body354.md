## Po co ten dyżur istnieje

Dyżur 344 zbudował kafle etapów w narzędziu fazowym `dynamic-swot`. Odbiór zaliczył je
technicznie (OFF 5/5, ON 7/7, zero crimsona, zero błędów konsoli) i **mimo to wydał werdykt
NIE POKAZYWAĆ WŁAŚCICIELOWI**, z jednego powodu: na kadrze polskie drzewo po lewej
(„Misja i kontekst", „Budowa SWOT") stało obok **angielskich kafli**. Przyczyna była
w `src/components/DiscoveryTools/toolCompletion.ts`:

```
label: isPolish ? 'Mission & Context' : 'Mission & Context'
```

**Angielski w OBU gałęziach warunku języka.** Pięć takich etykiet plus hybryda
`'Przygotuj final source summary'`. Nadzorca naprawił sześć, biorąc polskie nazwy
z `src/toolPacks/packs/dynamicSwot.pack.ts`, gdzie każda faza ma `title: { pl, en }` —
**to samo źródło, które zasila lewe drzewo** (commit `c0f690bae3`).

★★ **Dyżur 344 tego defektu nie stworzył — ODSŁONIŁ go.** Do tej pory kafli renderowało się
zero, więc nikt nigdy nie zobaczył ich etykiet. To jest kształt „zbudowane, ale
niepodłączone": właściwa rzecz siedziała w kodzie, brakowało ostatniego przewodu — a gdy
przewód wpięto, wyszło na jaw, że rzecz jest po angielsku.

★★★ **I to nie jest za flagą.** Kafle są bramkowane wyłącznie `toolType === 'dynamic-swot'`
(`src/components/DiscoveryTools/ToolDocumentView.tsx`, wiersze `521`, `529`, `534`, `1210`,
`1255`) — **nie flagą**. Po scaleniu wchodzą na żywo dla wszystkich.

### ★ Co robi ten dyżur

Nie siódmą łatkę. **Całą rodzinę** — bo naprawa per-zgłoszenie daje „poprawne w dwóch
z trzech", a naprawa per-wywołanie odrasta (defekt zalatany w jednym module wrócił po ośmiu
tygodniach w dwunastu plikach). Plus **bezpiecznik, który nie pozwoli tej rodzinie odrosnąć**,
z dowodem mutacyjnym **w obie strony**: że łapie prawdziwy defekt **i** że nie czerwieni się
na uzasadnionych identycznościach.

---

## ★★★ SPROSTOWANIE ZLECENIA — liczba „~73 podejrzanych etykiet" jest OBALONA

Zlecenie, z którego powstała ta instrukcja, mówiło: *„w tym samym pliku zostaje jeszcze
ok. 73 podejrzanych etykiet tego kształtu"*. **Zmierzyłem to na markerze `29fcbd4de2`
i liczba jest inna.** Napisałem własny licznik, który parsuje ternary `isPolish ? 'X' : 'Y'`
i rozdziela dwa **różne** kształty defektu:

| Zakres | Plików | Ternary `isPolish` z dwoma literałami | **Obie gałęzie IDENTYCZNE** | **HYBRYDY** (gałąź PL zawiera angielskie słowo obecne też w gałęzi EN) |
| --- | --- | --- | --- | --- |
| `src/components/DiscoveryTools/toolCompletion.ts` | 1 | **105** | **2** | **28** |
| `src/components/DiscoveryTools/` + `src/toolPacks/` | 162 | **256** | **4** | **38** |
| całe `src/` | 4814 | **3756** | **77** | **258** |

**W badanym pliku podejrzanych etykiet jest `30` (2 + 28), nie `73`** — z `105` ternary,
a nie z `73`. ★ Podejrzewam, skąd wzięła się liczba `73`: `105` ternary minus `~32` już
poprawnych. **To jest zgadywanie, nie pomiar. Zmierz to sam i podaj SWOJĄ liczbę.**

### Dwa różne kształty — nie myl ich

**KSZTAŁT A — obie gałęzie identyczne.** Dwa wystąpienia w badanym pliku, oba prawdziwe:

```
toolCompletion.ts:654   label: isPolish ? 'Portfolio mission' : 'Portfolio mission',
toolCompletion.ts:692   label: isPolish ? 'Risk mission'      : 'Risk mission',
```

★★ **W szerszym zakresie ten sam wzorzec daje FAŁSZYWE ALARMY** i to jest ważne dla
konstrukcji bezpiecznika:

```
src/components/DiscoveryTools/steps/ContextStep.tsx:674            ', '      ← separator, NIE etykieta
src/components/DiscoveryTools/toolSessionDetailsBuilder.ts:167     'Status'  ← UZASADNIONA identyczność
```

**KSZTAŁT B — hybryda.** Gałąź polska zawiera angielski rdzeń. To jest kształt, który
zlecenie nazwało „linia ~519", i on rzeczywiście tam jest:

```
toolCompletion.ts:519   isPolish ? 'Mission zdefiniowana'          : 'Mission defined'
toolCompletion.ts:298   isPolish ? 'Brak mission brief'            : 'Missing mission'
toolCompletion.ts:317   isPolish ? 'Brak final source summary'     : 'Missing final source summary'   (×5 w pliku)
toolCompletion.ts:552   isPolish ? 'Final source summary gotowe'   : 'Final source summary ready'     (×5 w pliku)
toolCompletion.ts:375   isPolish ? 'Brak growth mission'           : 'Missing growth mission'
toolCompletion.ts:410   isPolish ? 'Brak portfolio mission'        : 'Missing portfolio mission'
toolCompletion.ts:418   isPolish ? 'Brak trade-offów portfolio'    : 'Missing portfolio trade-offs'
toolCompletion.ts:492   isPolish ? 'Brak pomiaru baseline'         : 'Missing baseline measurement'
toolCompletion.ts:495   isPolish ? 'Brak re-estymacji target'      : 'Missing target re-estimation'
```

★ **`SWOT` jest uzasadnioną identycznością** (akronim branżowy) — `'Brak kart SWOT'` i
`'Budowa SWOT'` **nie są defektem**. Mój licznik je łapie, bo jest prosty; Twój ma je
odsiać przez listę uzasadnień (patrz `R2`).

★ **Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

---

## ★ Zmierz moje liczby sam

```bash
cd /private/tmp/cx-day354-etykiety-narzedzi

# (a) surowe liczby w badanym pliku
wc -l < src/components/DiscoveryTools/toolCompletion.ts
bash -c "grep -c 'isPolish' src/components/DiscoveryTools/toolCompletion.ts"
bash -c "grep -oE \"isPolish [?] '[^']*' : '[^']*'\" src/components/DiscoveryTools/toolCompletion.ts | wc -l"
#   moje liczby: 787 linii, 125 wystapien `isPolish`, 105 ternary z dwoma literalami

# (b) KSZTALT A — obie galezie identyczne (backreferencja w grep -E)
bash -c "grep -nE \"isPolish [?] '([^']*)' : '\\1'\" src/components/DiscoveryTools/toolCompletion.ts"
#   moje trafienia: 654 ('Portfolio mission'), 692 ('Risk mission') — DWA, nie 73

# (c) KSZTALT A w szerszym zakresie — TU SA FALSZYWE ALARMY
bash -c "grep -rnE \"isPolish [?] '([^']*)' : '\\1'\" src/components/DiscoveryTools src/toolPacks"
#   moje trafienia: 4, z czego DWA sa uzasadnione — ContextStep.tsx:674 (separator ', ')
#   i toolSessionDetailsBuilder.ts:167 ('Status'). To jest powod, dla ktorego bezpiecznik
#   MUSI miec liste uzasadnien, a nie tylko wzorzec.

# (d) ZRODLO PRAWDY: polskie nazwy faz sa w paczce, nie do wymyslenia
bash -c "grep -nE \"title: [{] pl:\" src/toolPacks/packs/dynamicSwot.pack.ts"
#   oczekiwane 7 wierszy: 101 'Misja i kontekst' · 112 'Wejscie i eksploracja' · 123 'Budowa SWOT'
#   · 134 'Synteza i napiecia' · 145 'Wyniki i dzialania' · 307 'Rekomendacje' · 315 'Przeglad'
ls src/toolPacks/packs/ | wc -l
#   moja liczba: 19 paczek

# (e) KAFLE NIE SA ZA FLAGA — sa bramkowane typem narzedzia
bash -c "grep -n \"toolType === 'dynamic-swot'\" src/components/DiscoveryTools/ToolDocumentView.tsx"
#   oczekiwane: 521, 529, 534, 1210, 1255 — ZERO odwolan do flagi.
#   ★ Po scaleniu te etykiety widzi KAZDY uzytkownik. To nie jest praca „za flaga OFF”.

# (f) LISTA UZASADNIONYCH IDENTYCZNOSCI JUZ ISTNIEJE — nie pisz jej od nowa
bash -c "grep -n 'export function justification\|export function polishTextReason\|allowedPolishNames' scripts/dev/i18n-pl-audyt.mjs"
#   oczekiwane: `justification` i `polishTextReason` sa EKSPORTOWANE (wiersze ~118 i ~108).
#   ★★ Ten skrypt audytuje LISCIE translation.json, NIE ternary w kodzie — wiec nie mozesz go
#   po prostu uruchomic. Masz z niego ZAIMPORTOWAC `justification`, nie skopiowac jej.

# (g) EKRAN I NARZEDZIE ZRZUTOWE ISTNIEJA
bash -c "grep -n \"tools-swot-session-workspace\" dev-render/main.tsx"
#   oczekiwane: 293 (lazy import) i 1890 (wpis w SCREENS)
bash -c "grep -n \"arg('zlicz'\|arg('porownaj-z'\|arg('base'\" scripts/dev/grafika-zrzuty.mjs"
#   oczekiwane: --base (domyslnie 3020 — NIE TWOJ PORT), --zlicz (DEC-387), --porownaj-z

# (h) BRAMKI I LISCIE SLOWNIKOW
node -e 'const f=require("fs");function c(o){let n=0;const w=v=>{if(v&&typeof v==="object"){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ["pl","en"])console.log(l,c(JSON.parse(f.readFileSync("public/locales/"+l+"/translation.json","utf8"))));'
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35199, en 33066 (★ NIE 35198/33065 — te ze zlecenia sa o dzien stare);
#   focus=0, list=0, artefakt=0, reach=0.
#   ★ Liscie slownikow maja pozostac IDENTYCZNE — ten dyzur poprawia literaly w kodzie,
#   nie dotyka `public/locales/**`.
```

---

## B.1. TABELA LICENCJI — CAŁA ŚCIEŻKA: ŹRÓDŁO NAZW · LOGIKA · WIDOK · HARNESS · TESTY · BEZPIECZNIK

| Warstwa | Ścieżka | Licencja | Produkt |
| --- | --- | --- | --- |
| **źródło prawdy nazw** | `src/toolPacks/packs/*.pack.ts` (19 paczek, każda z `title: { pl, en }`) | **★ TYLKO ODCZYT.** Nazwy bierzesz stąd — **nie tłumaczysz na własną rękę, gdy nazwa istnieje w paczce**. Zmiana paczki zmieniłaby też lewe drzewo i wyszłaby poza zakres | mapa „etykieta → `title.pl` z paczki" |
| **logika kompletności** | `src/components/DiscoveryTools/toolCompletion.ts` (787 linii, 105 ternary) | **ZAPIS** — rdzeń naprawy | poprawione literały |
| **rodzeństwo — reszta rodziny** | `src/components/DiscoveryTools/**` (162 pliki w zakresie z `src/toolPacks/`) | **ZAPIS** — ale wyłącznie literały etykiet; ★ **KROK 0 to wypisanie rodzeństwa**, praca per-zgłoszenie daje „poprawne w 2 z 3" | lista rodzeństwa + poprawki |
| **widok kafli** | `src/components/DiscoveryTools/ToolDocumentView.tsx` (`521`, `529`, `534`, `1210`, `1255`) | **TYLKO ODCZYT** — ustalasz, że kafle **nie są za flagą**, i zapisujesz to zdaniem w raporcie | zdanie o bramkowaniu |
| **lista uzasadnionych identyczności** | `scripts/dev/i18n-pl-audyt.mjs` (`justification`, `polishTextReason`, `allowedPolishNames`) | **TYLKO ODCZYT + IMPORT.** ★ **Zakaz kopiowania listy** — bezpiecznik ma ją **importować**, żeby jedna zmiana listy działała w obu miejscach | import, nie kopia |
| **nowy bezpiecznik** | `scripts/dev/check-etykiety-dwujezyczne.mjs` (**NOWY**) | **ZAPIS** — wzorzec „obie gałęzie warunku języka identyczne", z ratchetem i podłogą liczebności | skrypt + baseline |
| **rejestracja bezpiecznika** | `.husky/pre-commit` | **★ WĄSKA — dopisanie JEDNEGO bloku wzorowanego na blokach `check-list-canon`/`check-artefakt`.** Zakaz zmiany istniejących bloków | jeden blok |
| **testy bezpiecznika** | `tests/unit/i18n/**` (**NIGDY pod `src/`**) | **ZAPIS**, `git add -f` — test łapania defektu **i** test braku fałszywego alarmu | dwa testy |
| **test regresyjny kafli** | `tests/unit/tools/dynamicSwotPhaseOverview.render.test.tsx` (istnieje, 184 wiersze, z dyżuru 344) | **ZAPIS** — rozszerzasz o asercję polskich etykiet; ★ **zakaz osłabiania istniejących asercji** | rozszerzony test |
| **ekran harnessu** | `dev-render/screens/tools-swot-session-workspace.tsx` (`dev-render/main.tsx:293`, `:1890`) | **ZAPIS WARUNKOWY** — tylko jeżeli `R4` udowodni, że inaczej nie da się zrobić pary zrzutów; ★ **harness nie jest produktem** | ewentualna zmiana + uzasadnienie |
| **narzędzie zrzutowe** | `scripts/dev/grafika-zrzuty.mjs`, `scripts/dev/lib/checkScreenshotPairState.mjs` | **NIETYKALNE DO ZAPISU** — wolno wołać z `--base`, `--zlicz`, `--porownaj-z` | para zrzutów + zliczenia |
| **słowniki** | `public/locales/**` | **★ ZAKAZ ZAPISU.** Ten dyżur poprawia literały w kodzie; liście mają zostać `35199`/`33066` | liczby identyczne przed i po |
| **dowody** | `evidence/etykiety-narzedzi-20260904/**` (**NOWY**) | **ZAPIS, `git add -f`** — jawna licencja na zrzuty i logi | wszystkie artefakty |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY354_ETYKIETY_NARZEDZI_REPORT.md` | **ZAPIS (główny produkt)** | raport |
| **rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **★ WĄSKA — jedna nowa sekcja o pierwszej wolnej literze** | jedna sekcja |
| **macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | **★ ZAKAZ ZAPISU** — teren dyżuru 353 | — |
| **bramki zastane** | `scripts/check-*.sh`, `tests/setup.ts`, `tests/helpers/**`, `vitest*.config.ts`, `.github/workflows/**` | **NIETYKALNE DO ZAPISU** | kody wyjścia + liczba zbadanych obiektów |

---

## B.2. TABELA POZYCJI

| Poz. | Co robi | Rdzeń? | Wykonalne bez pliku przekrojowego? | Commit |
| --- | --- | --- | --- | --- |
| `R1` | **KROK 0** — inwentarz CAŁEJ rodziny z własnym licznikiem i klasyfikacją | TAK | TAK — sam pomiar | **TAK** |
| `R2` | bezpiecznik + jego dwa testy + rejestracja w hooku | TAK | TAK — nowy plik + jeden blok w hooku | **TAK** |
| `R3` | naprawa rodziny: kształt A, potem kształt B, nazwy z paczek | TAK | TAK — literały w ciałach funkcji | **TAK** |
| `R4` | para zrzutów z **mechanicznym** zliczeniem polskich kafli | TAK | TAK — harness na własnym porcie | **TAK** |
| `R5` | raport, sekcja rejestru, lista propozycji do akceptu | — | TAK | **TAK** |

★ **Commit po KAŻDEJ pozycji `R`.**

---

## B.3. TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | linie `toolCompletion.ts` | `787` | `(a)` | TAK |
| 2 | wystąpienia `isPolish` w pliku | `125` | `(a)` | TAK |
| 3 | ternary z dwoma literałami w pliku | `105` | `(a)` | TAK |
| 4 | kształt A w pliku | `2` | `(b)` | TAK — ★ **zlecenie mówiło „~73"; OBALONE** |
| 5 | kształt B (hybrydy) w pliku | `28` | licznik własny (`R1`) | TAK |
| 6 | podejrzane razem w pliku | `30` z `105` | `4` + `5` | TAK |
| 7 | kształt A w `DiscoveryTools`+`toolPacks` | `4`, z czego **2 uzasadnione** | `(c)` | TAK — ★ to jest dowód, że sam wzorzec nie wystarczy |
| 8 | kształt A w całym `src/` | `77` | licznik własny | TAK — ★ dlatego bezpiecznik ma **ratchet**, nie zero |
| 9 | hybrydy w całym `src/` | `258` | licznik własny | TAK — ★ **poza zakresem tego dyżuru**, do raportu |
| 10 | paczki narzędzi | `19` | `(d)` | TAK |
| 11 | tytuły faz w `dynamicSwot.pack.ts` | `7` | `(d)` | TAK |
| 12 | miejsc bramkowania kafli typem, nie flagą | `5` | `(e)` | TAK |
| 13 | naprawionych etykiet | — | `R3`, licznik własny | TAK — **to jest próg odbioru** |
| 14 | liście słowników i bramki | `35199`/`33066`, cztery `0` | `(h)` | TAK — identyczne przed i po |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

`src/components/DiscoveryTools/toolCompletion.ts` · `scripts/dev/check-etykiety-dwujezyczne.mjs`
(**NOWY**) · `.husky/pre-commit` (jeden blok) · `tests/unit/i18n/**` (**NOWE**, `git add -f`) ·
`tests/unit/tools/dynamicSwotPhaseOverview.render.test.tsx` (rozszerzenie) ·
`evidence/etykiety-narzedzi-20260904/**` (**NOWY**, `git add -f`) · raport · jedna sekcja rejestru.

### B.4.2. Pliki zapisywane WARUNKOWO

Pozostałe pliki w `src/components/DiscoveryTools/**` i `src/toolPacks/**` — **tylko te,
dla których `R1` wykaże defekt**, i tylko w zakresie literału etykiety ·
`dev-render/screens/tools-swot-session-workspace.tsx` — tylko jeżeli `R4` udowodni, że
inaczej nie da się zrobić pary, z uzasadnieniem w raporcie.

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

`public/locales/**` · żaden `MODULE_ACCEPTANCE.md` (teren 353) · `server/src/**` ·
`scripts/dev/grafika-zrzuty.mjs` · `scripts/dev/lib/checkScreenshotPairState.mjs` ·
`scripts/dev/i18n-pl-audyt.mjs` (★ **importujesz, nie zmieniasz**) · `scripts/check-*.sh` ·
`docs/ui-standards/**` · pliki dyżurów 351, 352, 353 ani 355–358.

★ Plik postępu `/private/tmp/cx-day354-postep.md` żyje **poza repo**.

### B.4.4. Zasoby wyłączne

Baza **6413**, runtime **5553**, kontener **`cx-day354-pg`**, baza **`cx354`**,
worktree `/private/tmp/cx-day354-etykiety-narzedzi`,
gałąź `codex/day354-etykiety-narzedzi-20260904`.
Sprawdziłem 04.09: porty wolne, kontener nie istnieje, worktree nie istnieje, gałąź nie istnieje.

★★ **Kanoniczny harness `dev-render` słucha domyślnie na `3020` i ten port NIE JEST TWÓJ.**
Swój Vite podnosisz na **5553** i **każde** wywołanie narzędzia zrzutowego dostaje
`--base=http://127.0.0.1:5553`. Zapomnienie tego parametru zrobi zrzut **cudzego** ekranu
i nie zobaczysz tego po obrazku.

★★ **Port zajęty = STOP CAŁOŚCI (`Z7`), NIGDY podmiana numeru.**

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
git status --short                       # zero plikow spoza B.4.1/B.4.2
git diff --cached -- public/locales       # PUSTY
bash -c "grep -rnE '^(<{7}|>{7}|={7})' $(git diff --cached --name-only)"   # zero znacznikow konfliktu
node scripts/dev/check-etykiety-dwujezyczne.mjs; echo "etykiety=$?"        # 0 + liczba zbadanych
npx esbuild $(git diff --cached --name-only -- 'src/**/*.ts' 'src/**/*.tsx') --outdir=/dev/null 2>&1 | tail -3
#   ★ `Transform failed` to BLAD KOMENDY, nie „brak zmian”
```

---

## R1 — KROK 0: INWENTARZ CAŁEJ RODZINY (rdzeń)

★★ **Zanim naprawisz cokolwiek, wypisz rodzeństwo.** Praca per-zgłoszenie daje „poprawne
w dwóch z trzech" i to jest błąd zlecającego, nie wykonawcy — dlatego ta pozycja jest
pierwsza i ma własny commit.

1. **Napisz własny licznik** (może żyć w `scripts/dev/`, może być tymczasowy w `SCRATCH` —
   ale jeżeli zostaje w repo, to jako część bezpiecznika z `R2`, nie jako drugi skrypt obok).
   Ma parsować ternary warunku języka i **rozdzielać dwa kształty**:
   - **A** — obie gałęzie identyczne;
   - **B** — gałąź polska zawiera słowo (≥4 znaki, bez polskich znaków diakrytycznych)
     obecne też w gałęzi angielskiej.
   ★ Wzorzec warunku to nie tylko `isPolish` — sprawdź, czy w rodzinie nie żyją warianty
   (`isPL`, `lang === 'pl'`, `i18n.language`), i **udokumentuj, których szukałeś**.
2. **Uruchom go w trzech zakresach** z tabeli `B.3` (badany plik · `DiscoveryTools`+`toolPacks` ·
   całe `src/`) i **porównaj z moimi liczbami**. Rozjazd zapisujesz; obowiązuje Twój pomiar.
3. **Sklasyfikuj każde trafienie** w zakresie `DiscoveryTools`+`toolPacks` do jednej z trzech
   kategorii:
   - **DEFEKT** — jest polski odpowiednik, gałąź PL go nie ma;
   - **UZASADNIONA IDENTYCZNOŚĆ** — marka, akronim (`SWOT`, `KPI`, `ROI`), słowo identyczne
     w obu językach („Status", „Tempo"), separator, placeholder;
   - **PROPOZYCJA** — nazwy nie ma w żadnej paczce, więc trzeba ją wymyślić.
4. **Dla każdego DEFEKTU wskaż źródło nazwy**: `plik:linia` w `src/toolPacks/packs/*.pack.ts`
   z odpowiednim `title.pl`. ★ **Jeżeli nazwy w paczce nie ma — to jest PROPOZYCJA, nie
   defekt do cichego przetłumaczenia.**
5. ★ **Hybrydy w całym `src/` (`258` u mnie) są POZA ZAKRESEM tego dyżuru** — podajesz liczbę
   do raportu jako rozmiar długu, i nic więcej. Zakresem jest `DiscoveryTools` + `toolPacks`.

**Wymagany dowód:** `evidence/etykiety-narzedzi-20260904/r1-inwentarz.md` z tabelą
`plik:linia | kształt | PL | EN | kategoria | źródło nazwy` · trzy liczby zakresowe obok
moich · lista wariantów warunku, których szukałeś. **Commit po `R1`.**

---

## R2 — BEZPIECZNIK, KTÓRY NIE POZWOLI RODZINIE ODROSNĄĆ (rdzeń)

`scripts/dev/check-etykiety-dwujezyczne.mjs`. Wymagania — **wszystkie twarde**:

1. **Wykrywa kształt A** („obie gałęzie warunku języka identyczne") w zdefiniowanym zakresie.
   Zakres domyślny: `src/components/DiscoveryTools` + `src/toolPacks`. ★ Całe `src/` ma dziś
   `77` trafień, więc bramka na zerze byłaby bramką, która **nigdy nie mogła przejść**.
2. **Importuje `justification` z `scripts/dev/i18n-pl-audyt.mjs`** — nie kopiuje jej.
   Jedna zmiana listy uzasadnień ma działać w obu miejscach. Jeżeli import okaże się
   niewykonalny (inny kształt danych wejściowych), **napisz dlaczego** i zaproponuj
   najmniejszą zmianę, która go umożliwia — ale nie wprowadzaj jej sam w tym dyżurze.
3. **Ma RATCHET, nie zero**: baseline zapisany w pliku obok skryptu; bramka czerwienieje,
   gdy liczba trafień **rośnie**, i przypomina o obniżeniu baseline'u, gdy maleje.
   Wzoruj się na `scripts/check-artefakt.sh` (dzisiejszy stan: `8`, baseline `9`).
4. ★★ **PODŁOGA LICZEBNOŚCI.** Skrypt **wypisuje liczbę zbadanych plików i liczbę zbadanych
   ternary** i **kończy się błędem, gdy ta liczba jest zerowa albo drastycznie niższa od
   baseline'u**. Powód: bezpiecznik przechodzi, gdy nie może nic zmierzyć — złe `--include`
   w `zsh`, zmieniona ścieżka, ginięcie na ścieżce macOS przed pierwszym pomiarem.
   **Bramka, która nic nie zmierzyła, ma być CZERWONA, nie zielona.**
5. **Rejestracja w `.husky/pre-commit`** — jeden nowy blok, wzorowany na blokach
   `check-list-canon` (wiersz `9`) i `check-artefakt` (wiersz `20`). Zakaz zmiany istniejących.

### ★★ DOWÓD MUTACYJNY W OBIE STRONY — to jest właściwy produkt tej pozycji

Bezpiecznik jednowymiarowy daje fałszywy spokój. Wymagam **dwóch** mutacji i **dwóch** testów
w `tests/unit/i18n/` (★ **NIGDY pod `src/`**, `git add -f`):

| Kierunek | Mutacja | Oczekiwanie |
| --- | --- | --- |
| **ŁAPIE DEFEKT** | wstaw do pliku w zakresie etykietę `isPolish ? 'Mission & Context' : 'Mission & Context'` (dokładnie ten literał, który 344 odsłonił) | bezpiecznik **CZERWONY**, z komunikatem wskazującym `plik:linia` |
| **NIE ŁAPIE UZASADNIONEGO** | wstaw `isPolish ? 'Status' : 'Status'` oraz `isPolish ? 'SWOT' : 'SWOT'` | bezpiecznik **ZIELONY** — inaczej wyprodukujesz bramkę, którą wszyscy zaczną obchodzić |
| **PODŁOGA DZIAŁA** | wskaż skryptowi zakres, który nie istnieje (`--zakres=src/nie-ma-takiego`) | bezpiecznik **CZERWONY** z komunikatem „zero zbadanych obiektów", **nie zielony** |

★ **Mutacje wprowadzasz po kopii przez `cp` do `SCRATCH` i przywracasz przez `cp` —
nigdy `git stash` (`Z27`).** `git diff` po przywróceniu **pusty**, dosłownie w raporcie.

★★ **Mutacja ma celować w ZABEZPIECZENIE, nie w mechanizm.** Zabezpieczeniem jest tu
**wykrycie identycznych gałęzi**. Test, który czerwienieje dlatego, że zepsułeś parser albo
odczyt pliku, **niczego nie dowodzi** — to jest kształt „test scenariusza nie broni
zabezpieczenia" (3 z 4 dyżurów miały zielone testy po skasowaniu zabezpieczenia).

**Wymagany dowód:** skrypt + baseline · blok w hooku · dwa testy w `tests/unit/i18n/` ·
trzy mutacje z wynikami · `git diff` pusty · wynik `node scripts/dev/check-etykiety-dwujezyczne.mjs`
z **liczbą zbadanych obiektów**. **Commit po `R2`.**

★ **Kolejność jest celowa: bezpiecznik POWSTAJE PRZED naprawą.** Dzięki temu naprawa z `R3`
jest mierzona przez narzędzie, a nie przez oko, a spadek liczby trafień jest dowodem.

---

## R3 — NAPRAWA CAŁEJ RODZINY (rdzeń)

1. **Kształt A najpierw** — dwa wystąpienia w badanym pliku (`654` `'Portfolio mission'`,
   `692` `'Risk mission'`). Nazwy z paczek: `portfolioPriority.pack.ts` i
   `riskUncertainty.pack.ts`. ★ **Jeżeli w paczce nie ma odpowiadającego `title.pl` —
   to jest PROPOZYCJA i oznaczasz ją jako propozycję do akceptu, nie jako naprawę.**
2. **Kształt B** — hybrydy z listy `R1`. Zasada rozstrzygająca:
   - `'Brak final source summary'` → nazwa fazy istnieje w paczkach jako `title.pl`
     (sprawdź `dynamicSwot.pack.ts` i rodzeństwo) → **naprawa**;
   - `'Brak kart SWOT'`, `'Budowa SWOT'` → `SWOT` to akronim → **NIE ruszasz**;
   - `'Brak pomiaru baseline'`, `'Brak re-estymacji target'` → nazw nie ma w paczce →
     **PROPOZYCJA**, oznaczona, nie wprowadzona po cichu.
3. ★★ **Zakaz tłumaczenia tego, co ma zostać identyczne** — marki, akronimy, „Status",
   „Tempo". Lista uzasadnionych identyczności jest w `scripts/dev/i18n-pl-audyt.mjs`
   i **to ona rozstrzyga**, a nie Twoje wyczucie.
4. **Po każdej partii uruchom bezpiecznik z `R2`** i zapisz liczbę trafień. Ciąg liczb
   (przed → po każdej partii → po) idzie do raportu.
5. **Rozszerz `tests/unit/tools/dynamicSwotPhaseOverview.render.test.tsx`** o asercję, że
   przy `isPolish=true` kafle mają polskie etykiety — imiennie, nie przez `not.toContain('&')`.
   ★ **Zakaz osłabiania istniejących asercji** — jeżeli któraś zaczyna przeszkadzać,
   to jest sygnał, że naprawa poszła za daleko.
6. **`npx esbuild` na każdym zmienionym pliku** po każdej partii. ★ `Transform failed` to
   **BŁĄD KOMENDY**, nie „brak zmian".

**Wymagany dowód:** diff per plik · **własna liczba naprawionych etykiet** · osobna lista
PROPOZYCJI (z uzasadnieniem, dlaczego nazwy nie ma w paczce) · ciąg liczb z bezpiecznika ·
wynik `esbuild`. **Commit po `R3`** (albo po każdej partii — wtedy kilka commitów).

---

## R4 — PARA ZRZUTÓW Z MECHANICZNYM ZLICZENIEM (rdzeń)

★★★ **Kontrola musi być mechaniczna, bo oko przywyka.** Przez cały dzień patrzyłem na
zrzuty, na których kontrolki harnessu zasłaniały produkt, i tego nie zobaczyłem.

1. Podnieś Vite na **`5553`** (`--port 5553 --strictPort`), zapisz `$!`.
   ★ **Zakaz `pkill`/`killall`** — na koniec zabijasz wyłącznie swój PID.
2. Zrzuty ekranu `tools-swot-session-workspace`, faza `PRZED` (przed `R3`, z gałęzi bazowej
   albo z kopii) i `PO`, **oba z `--base=http://127.0.0.1:5553`**, oba w light i dark.
3. ★★★ **Zliczenie mechaniczne przez `--zlicz`** (`DEC-387`) — to jest właściwy dowód, **nie
   jasność obrazu**. Podaj co najmniej: liczbę kafli, liczbę kafli, których tekst pasuje do
   `title.pl` z paczki, liczbę kafli z angielskim rdzeniem. Wynik ląduje w `--wynik-json`.
   ★ **Bezpiecznik jasności `checkScreenshotPairState.mjs` (próg `150`) jest tu BEZUŻYTECZNY** —
   zmiana pięciu napisów prawie nie zmienia luminancji, a bezpiecznik jednowymiarowy przechodzi
   tym łatwiej, im mniejsza zmiana. **Nie powołuj się na niego jako na dowód naprawy.**
4. ★★ **Para bajtowo identyczna = ZERO dowodu** (kształt „duplikat zamiast motywu").
   **Suma kontrolna KAŻDEGO pliku idzie do raportu.**
5. ★★ **Na kadrze ma być widać JEDNOCZEŚNIE polskie drzewo po lewej i polskie kafle obok** —
   to jest dokładnie ten kadr, na którym odbiór 344 zobaczył defekt. Zrzut samych kafli,
   bez drzewa, **nie zamyka tej pozycji**.
6. ★ **Sprawdź, czy nie mierzysz przyrządu.** 3 z 6 „defektów" jednego dnia okazało się
   hostem harnessu, nie produktem. Porównaj łańcuch przodków kafla w harnessie i w realnej
   trasie; jeżeli się różni, **zapisz to jako granicę dowodu**.

**Wymagany dowód:** cztery zrzuty (PRZED/PO × light/dark) w
`evidence/etykiety-narzedzi-20260904/` z `git add -f` · sumy kontrolne wszystkich czterech ·
`--wynik-json` ze zliczeniami PRZED i PO · zdanie o łańcuchu przodków. **Commit po `R4`.**

---

## R5 — RAPORT, REJESTR I LISTA PROPOZYCJI

Raport `CODEX_DAY354_ETYKIETY_NARZEDZI_REPORT.md`:

1. **Każda liczba z tej instrukcji, którą Twój pomiar obalił** — osobną sekcją, wprost.
   Zaczynając od `~73`.
2. Inwentarz `R1`: trzy zakresy, trzy kategorie, warianty warunku których szukałeś.
3. Bezpiecznik: co wykrywa, jaki ma baseline, jaka jest podłoga liczebności, **trzy mutacje
   z wynikami**.
4. **Własna liczba naprawionych etykiet** — z rozbiciem na kształt A i kształt B.
5. **Lista PROPOZYCJI do akceptu właściciela** — nazwy, których nie ma w żadnej paczce.
   Format: `plik:linia | obecny PL | obecny EN | proponowany PL | dlaczego nie ma w paczce`.
6. **Rozmiar długu poza zakresem**: hybrydy w całym `src/` (u mnie `258`), kształt A w całym
   `src/` (u mnie `77`) — jako liczby, bez pracy.
7. Zdanie o bramkowaniu kafli: **typem narzędzia, nie flagą** → po scaleniu widzi je każdy.
8. Co niewykonane i dlaczego, imiennie.

Sekcja w `docs/program/REJESTR_ZNALEZISK_20260903.md` o **pierwszej wolnej literze**,
sprawdzonej komendą **tuż przed commitem**.

**Commit po `R5`.**

---

## Próg odbioru

1. **Własna liczba naprawionych etykiet**, z rozbiciem na kształt A i B, i zgodna z liczbą
   diffów w `git show --stat`.
2. **Para zrzutów narzędzia fazowego z polskimi kaflami OBOK polskiego drzewa**, w light
   i dark, z **sumami kontrolnymi** i z **mechanicznym zliczeniem** przez `--zlicz` —
   nie z odwołaniem do jasności obrazu.
3. **Bezpiecznik istnieje, jest zarejestrowany w hooku i ma TRZY dowody mutacyjne**:
   czerwienieje na wstawionym defekcie · **nie** czerwienieje na `'Status'`/`'SWOT'` ·
   czerwienieje przy zerze zbadanych obiektów.
4. `git diff` po przywróceniu każdej mutacji **pusty**.
5. Nowe testy w `tests/`, **ani jednego pod `src/`**;
   `node scripts/dev/reachability-from-root.mjs --check-baseline` → `0`.
6. Liście słowników `35199`/`33066` **niezmienione**; cztery bramki `0`.
7. `esbuild` czysty na każdym zmienionym pliku; **`Transform failed` traktowane jako błąd**.
8. Lista PROPOZYCJI wypisana i **oznaczona jako propozycja**, nie wprowadzona po cichu.
9. Żadna nazwa nie została wymyślona tam, gdzie istnieje `title.pl` w paczce.
10. Zero zmian w `public/locales/**`, `MODULE_ACCEPTANCE.md`, `grafika-zrzuty.mjs`
    i `i18n-pl-audyt.mjs`.

---

## Prawo zatrzymania

Zatrzymujesz się i piszesz **STOP** z powodem, jeżeli:

- port `5553` albo `6413` jest zajęty — **STOP całości, nigdy podmiana numeru**;
- import `justification` z `i18n-pl-audyt.mjs` jest niewykonalny **i** jedyną alternatywą
  byłoby skopiowanie listy (kopia to drugi rejestr, a dwa rejestry mierzą rozjazd);
- bezpiecznik czerwienieje na `'Status'` albo `'SWOT'` i nie umiesz tego odsiać bez
  wpisania wyjątku na sztywno — wyjątek na sztywno jest listą numer dwa;
- liczba defektów okaże się taka, że naprawa wymagałaby zmiany paczek — **paczki są
  źródłem prawdy i tylko do odczytu**;
- para zrzutów wychodzi bajtowo identyczna i nie umiesz pokazać różnicy zliczeniem.

★ **Zatrzymanie z konkretnym powodem jest pełnowartościowym wynikiem. Zmyślony dowód nie jest.**

---

## AUDYT SPRZECZNOŚCI — pary wymagań i miejsce rozstrzygnięcia

| Para | Rozstrzygnięcie |
| --- | --- |
| „napraw całą rodzinę" × „zakres to `DiscoveryTools`+`toolPacks`" | `R1` punkt 5 — rodzina = zakres; `258` hybryd w całym `src/` to **liczba do raportu**, nie praca |
| „bezpiecznik na zerze" × „`77` trafień w `src/`" | `R2` punkt 3 — **ratchet z baseline'em**, nie zero; bramka na zerze nigdy nie mogłaby przejść |
| „wzorzec obie gałęzie identyczne" × „`', '` i `'Status'` też pasują" | `R2` punkt 2 — lista uzasadnień **importowana** z `i18n-pl-audyt.mjs` i dowód mutacyjny w drugą stronę |
| „nie tłumacz na własną rękę" × „napraw etykietę bez nazwy w paczce" | `R3` punkt 2 — brak nazwy w paczce = **PROPOZYCJA do akceptu**, nie cicha naprawa |
| „dowód wizualny" × „bezpiecznik jasności próg `150`" | `R4` punkt 3 — dla zmiany pięciu napisów luminancja jest bezużyteczna; dowodem jest **`--zlicz`** |
| „zrzut PO pokazuje naprawę" × „na kadrze ma być drzewo i kafle" | `R4` punkt 5 — zrzut samych kafli nie zamyka pozycji |
| „bezpiecznik przed naprawą" × „commit po każdej pozycji" | `R2` przed `R3` celowo — spadek liczby trafień jest wtedy dowodem, a nie deklaracją |
| „nowe testy w `tests/`" × „test kafli już istnieje" | `B.1` — istniejący `tests/unit/tools/dynamicSwotPhaseOverview.render.test.tsx` **rozszerzasz**; nowe testy bezpiecznika idą do `tests/unit/i18n/` |
| „to nie jest za flagą" × „wygląd tylko za flagą do akceptu" | `R5` punkt 7 — **stan zastany**, nie Twoja decyzja; opisujesz go w raporcie jako ryzyko, nie zakładasz nowej flagi |
| „`~73` etykiety" × mój pomiar `30` z `105` | Sprostowanie na górze + `B.3` wiersze 4-6 — **obowiązuje Twój pomiar** |
| „harness można zmienić" × „harness nie jest produktem" | `B.4.2` — zmiana ekranu **warunkowa**, z uzasadnieniem w raporcie, i nigdy zamiast naprawy produktu |

---

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C szkieletu)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — patrz tabela wyżej | TAK — jedenaście par, każda rozstrzygnięta w treści |
| 2 | Każda ścieżka istnieje na markerze albo jest oznaczona `NOWY` | TAK — sprawdzone na markerze `29fcbd4de2`; zero `BRAK`. Oznaczone `NOWY`: `scripts/dev/check-etykiety-dwujezyczne.mjs`, `tests/unit/i18n/**`, `evidence/etykiety-narzedzi-20260904/**` |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — `B.3`, czternaście wierszy; **dwie liczby ze zlecenia obalone własnym pomiarem** (`~73` → `30` z `105`; liście `35199/33066` zamiast `35198/33065`) |
| 4 | Tabela licencji kompletna, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — każdy wiersz „tylko odczyt" ma rzeczownik-produkt (mapa · zdanie · import · zliczenia) |
| 5 | Wykonalność per pozycja bez plików przekrojowych, z dowodem przy `NIE` | TAK — `B.2`, kolumna 4; naprawa to literały w ciałach funkcji, `ToolDocumentView.tsx` pozostaje nietknięty |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — `B.4.4`; porty `6413`/`5553` zmierzone jako wolne, kontener, worktree i gałąź nie istnieją. ★★ Jawnie wyłączony port `3020` (kanoniczny `dev-render`). ★ 355-358 pisze równolegle inny autor — `Z7` zaostrzony |
| 7 | Komendy paste-ready, z komentarzem oczekiwanego wyniku | TAK — wszystkie grepy przez `bash -c` (★ `--include` w `zsh` zwraca pustkę), wszystkie wywołania zrzutowe z `--base` na własnym porcie |
| 8 | Pułapki środowiska w całości + pułapki właściwe temu dyżurowi (sześć) | TAK — `§0.2d` w części A + sześć pułapek tego dyżuru w polu pułapek |
| 9 | Samodzielność — zero odwołań do rozmów bez ścieżki | TAK; naprawa 344 zacytowana jako commit `c0f690bae3` z pełnym komunikatem, wszystkie wiersze z numerami |
| 10 | Klauzula sprzeczności obecna; niewypełnionych pól szablonu: `0`; wierszy `Z`: `41` | TAK — sprawdzone przez generator, który blokuje zapis przy niespełnieniu |
