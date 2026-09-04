# -*- coding: utf-8 -*-
import json

WT = "/private/tmp/cx-day354-etykiety-narzedzi"

cfg = {
 "NR_DYZURU": "354",
 "TYTUL_JEDNYM_ZDANIEM": (
   "★★★ ANGIELSKIE ETYKIETY W NARZĘDZIACH FAZOWYCH — CAŁA RODZINA, NIE SIÓDMA ŁATKA. "
   "Dyżur 344 wpiął przewód do kafli etapów i odsłonił defekt, którego wcześniej nikt nie "
   "mógł zobaczyć, bo kafli renderowało się ZERO: "
   "`label: isPolish ? 'Mission & Context' : 'Mission & Context'` — angielski w OBU gałęziach "
   "warunku języka, plus hybrydy typu `'Przygotuj final source summary'`. Nadzorca naprawił "
   "SZEŚĆ, biorąc polskie nazwy z `src/toolPacks/packs/dynamicSwot.pack.ts` (`title: { pl, en }` "
   "— to samo źródło, które zasila lewe drzewo). Ten dyżur robi RESZTĘ RODZINY i dokłada "
   "BEZPIECZNIK, który nie pozwoli jej odrosnąć — z dowodem mutacyjnym W OBIE STRONY: "
   "że łapie prawdziwy defekt i że NIE czerwieni się na uzasadnionych identycznościach "
   "(`Status`, `SWOT`, marki, akronimy). ★★ Kafle NIE SĄ ZA FLAGĄ — bramkuje je "
   "`toolType === 'dynamic-swot'` — więc po scaleniu te etykiety widzi KAŻDY użytkownik"
 ),
 "WORKTREE": WT,
 "NAZWA_WORKTREE": "cx-day354-etykiety-narzedzi",
 "NAZWA": "day354-etykiety-narzedzi",
 "SCRATCH": WT + "-scratch",
 "ARTEFAKTY": WT + "-artefakty",
 "SHA_MARKERA": "29fcbd4de20ca26d2febc50d9455128cab47ffce",
 "REMOTE": "github-backup",
 "GALAZ_BAZOWA": "grafika/m03-20260902",
 "GALAZ_DYZURU": "codex/day354-etykiety-narzedzi-20260904",
 "WYDANY": "WYDANY",
 "DATA": "2026-09-04",
 "PORT_DB": "6413",
 "PORT_HARNESS": "5553",
 "KONTENER": "cx-day354-pg",
 "BAZA": "cx354",
 "JWT_SECRET": "cx354-test-secret-do-not-reuse-min-32-znaki",
 "N_KOMEND": "osiem",

 "MODUL_LUB_OBSZAR": (
   "NARZĘDZIA (`03_TOOLS`) — **warstwa etykiet narzędzi fazowych**: logika kompletności "
   "`src/components/DiscoveryTools/toolCompletion.ts` (787 linii, 125 wystąpień `isPolish`, "
   "105 ternary z dwoma literałami) oraz cała rodzina `src/components/DiscoveryTools/**` "
   "i `src/toolPacks/**` (162 pliki w zakresie, 256 ternary). ★ **Źródłem prawdy nazw są "
   "`title: { pl, en }` w 19 paczkach `src/toolPacks/packs/*.pack.ts`** — nie tłumaczysz na "
   "własną rękę, gdy nazwa tam istnieje. ★★ Ekran do oceny wzrokiem: "
   "`dev-render/screens/tools-swot-session-workspace.tsx` (`dev-render/main.tsx:293` i `:1890`)"
 ),

 "TRASY_FRONT": (
   "★★ SEDNO: `src/components/DiscoveryTools/toolCompletion.ts` — `computeDynamicSwotPhaseSummaries` "
   "i `computeDynamicSwotOverallReadiness` produkują etykiety kafli. Konsument: "
   "`src/components/DiscoveryTools/ToolDocumentView.tsx` — wiersze **521**, **529**, **534**, "
   "**1210**, **1255** (bramkowanie `toolType === 'dynamic-swot'`, **ZERO odwołań do flagi**), "
   "render kafli w **1121**–**1144** (`data-testid=\"dynamic-swot-phase-overview\"`, "
   "`data-testid=\"dynamic-swot-phase-tile\"`, `data-testid=\"dynamic-swot-readiness-badge\"` — "
   "to są Twoje uchwyty do `--zlicz`). Rodzeństwo do przejrzenia: reszta "
   "`src/components/DiscoveryTools/**` (m.in. `steps/`, `shared/`, `tools/DynamicSWOT/`) "
   "oraz `src/toolPacks/**`. Ekran harnessu: `dev-render/screens/tools-swot-session-workspace.tsx`"
 ),

 "TRASY_TYL": (
   "BRAK — ten dyżur nie dotyka serwera. Nie ma trasy HTTP, nie ma kontrolera, nie ma "
   "repozytorium. ★ Kontener PostgreSQL (`cx-day354-pg`, port `6413`, baza `cx354`) jest "
   "zarezerwowany **wyłącznie na wypadek**, gdyby któryś przelot testowy okazał się wymagać "
   "realnej bazy; **domyślnie go nie stawiasz**. Jeżeli go postawisz — obraz "
   "`pgvector/pgvector:pg16` (`postgres:15` nie przechodzi migracji), dwa przebiegi migracji, "
   "`docker rm -fv cx-day354-pg` na koniec, `df -h /` przed i po"
 ),

 "TU_WSTAWIASZ_KOMENDY_WERYFIKACJI_STANU_WEJSCIOWEGO": (
"```bash\n"
"cd " + WT + "\n"
"\n"
"# (1) SUROWE LICZBY W BADANYM PLIKU\n"
"wc -l < src/components/DiscoveryTools/toolCompletion.ts\n"
"bash -c \"grep -c 'isPolish' src/components/DiscoveryTools/toolCompletion.ts\"\n"
"bash -c \"grep -oE \\\"isPolish [?] '[^']*' : '[^']*'\\\" src/components/DiscoveryTools/toolCompletion.ts | wc -l\"\n"
"#   moje liczby: 787 linii, 125 wystapien `isPolish`, 105 ternary z dwoma literalami\n"
"\n"
"# (2) ★★★ KSZTALT A — OBIE GALEZIE IDENTYCZNE (backreferencja)\n"
"bash -c \"grep -nE \\\"isPolish [?] '([^']*)' : '\\\\1'\\\" src/components/DiscoveryTools/toolCompletion.ts\"\n"
"#   moje trafienia: 654 ('Portfolio mission') i 692 ('Risk mission') — DWA.\n"
"#   ★★★ ZLECENIE MOWILO „ok. 73 podejrzanych etykiet” — MOJ POMIAR TO OBALIL.\n"
"#   Podejrzanych jest 30 z 105 (2 ksztaltu A + 28 hybryd). ZMIERZ TO SAM I PODAJ SWOJA LICZBE.\n"
"\n"
"# (3) KSZTALT A W SZERSZYM ZAKRESIE — TU SA FALSZYWE ALARMY\n"
"bash -c \"grep -rnE \\\"isPolish [?] '([^']*)' : '\\\\1'\\\" src/components/DiscoveryTools src/toolPacks\"\n"
"#   moje trafienia: 4, z czego DWA UZASADNIONE — ContextStep.tsx:674 (separator ', ')\n"
"#   i toolSessionDetailsBuilder.ts:167 ('Status'). ★ To jest powod, dla ktorego bezpiecznik\n"
"#   MUSI miec liste uzasadnien, a nie sam wzorzec. W calym `src/` ksztalt A daje u mnie 77 —\n"
"#   dlatego bramka na ZERZE nigdy nie moglaby przejsc, i ma miec RATCHET.\n"
"\n"
"# (4) ZRODLO PRAWDY: polskie nazwy sa w paczkach, nie do wymyslenia\n"
"bash -c \"grep -nE \\\"title: [{] pl:\\\" src/toolPacks/packs/dynamicSwot.pack.ts\"\n"
"#   oczekiwane 7 wierszy: 101 'Misja i kontekst' · 112 'Wejscie i eksploracja' · 123 'Budowa SWOT'\n"
"#   · 134 'Synteza i napiecia' · 145 'Wyniki i dzialania' · 307 'Rekomendacje' · 315 'Przeglad'\n"
"ls src/toolPacks/packs/ | wc -l\n"
"#   moja liczba: 19 paczek\n"
"\n"
"# (5) ★★ KAFLE NIE SA ZA FLAGA — bramkuje je TYP NARZEDZIA\n"
"bash -c \"grep -n \\\"toolType === 'dynamic-swot'\\\" src/components/DiscoveryTools/ToolDocumentView.tsx\"\n"
"#   oczekiwane: 521, 529, 534, 1210, 1255 — ZERO odwolan do flagi funkcyjnej.\n"
"#   ★ Po scaleniu te etykiety widzi KAZDY. To nie jest praca „za flaga OFF do akceptu”.\n"
"\n"
"# (6) LISTA UZASADNIONYCH IDENTYCZNOSCI JUZ ISTNIEJE — importujesz, NIE kopiujesz\n"
"bash -c \"grep -n 'export function justification\\|export function polishTextReason\\|allowedPolishNames' scripts/dev/i18n-pl-audyt.mjs\"\n"
"#   oczekiwane: obie funkcje EKSPORTOWANE. ★★ Ten skrypt audytuje LISCIE translation.json,\n"
"#   NIE ternary w kodzie — wiec nie uruchomisz go „tak po prostu”. Masz z niego ZAIMPORTOWAC\n"
"#   `justification`. Kopia listy = drugi rejestr, a dwa rejestry mierza rozjazd.\n"
"\n"
"# (7) EKRAN I NARZEDZIE ZRZUTOWE ISTNIEJA\n"
"bash -c \"grep -n \\\"tools-swot-session-workspace\\\" dev-render/main.tsx\"\n"
"#   oczekiwane: 293 (lazy import) i 1890 (wpis w SCREENS)\n"
"bash -c \"grep -n \\\"arg('zlicz'\\|arg('porownaj-z'\\|arg('base'\\|arg('wynik-json'\\\" scripts/dev/grafika-zrzuty.mjs\"\n"
"#   oczekiwane: --base (DOMYSLNIE 3020 — NIE TWOJ PORT!), --zlicz (DEC-387), --porownaj-z, --wynik-json\n"
"\n"
"# (8) BRAMKI I LISCIE SLOWNIKOW — maja pozostac IDENTYCZNE przed i po\n"
"node -e 'const f=require(\"fs\");function c(o){let n=0;const w=v=>{if(v&&typeof v===\"object\"){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of [\"pl\",\"en\"])console.log(l,c(JSON.parse(f.readFileSync(\"public/locales/\"+l+\"/translation.json\",\"utf8\"))));'\n"
"bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo \"focus=$?\"\n"
"bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo \"list=$?\"\n"
"bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo \"artefakt=$?\"\n"
"node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo \"reach=$?\"\n"
"#   moje liczby: pl 35199, en 33066 (★ NIE 35198/33065 — te ze zlecenia sa o dzien stare;\n"
"#   sprawdzilem to takze prosto z obiektu commita); focus=0, list=0, artefakt=0, reach=0\n"
"```"
 ),

 "LISTA_PORTOW_ZAJETYCH": (
   "Zakazane na stale: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium "
   "ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta "
   "i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379 — ★★ **TO JEST WAŻNE "
   "WŁAŚNIE DLA CIEBIE: kanoniczny harness `dev-render` słucha domyślnie na 3020 i ten port NIE "
   "JEST TWÓJ.** Swój harness Vite podnosisz na **5553** (`--port 5553 --strictPort`) i **każde** "
   "wywołanie narzędzia zrzutowego dostaje `--base=http://127.0.0.1:5553`. Zapomnienie tego "
   "parametru zrobi zrzut CUDZEGO ekranu i po obrazku tego nie poznasz. Rodzeństwo TEJ paczki "
   "(04.09 wieczór) — nie dotykasz: 351 (6410/5550), 352 (6411/5551), 353 (6412/5552). "
   "★★ RÓWNOLEGLE pisane są instrukcje 355-358 przez innego autora; ich portów NIE ZNAM w chwili "
   "pisania, więc obowiązuje reguła twarda: **bierzesz WYŁĄCZNIE swoje dwa porty i żaden inny**, "
   "a port zajęty jest powodem do STOP-u całości (`Z7`), nigdy do podmiany numeru. Wcześniejsze "
   "rodzeństwo 04.09: 343-346 (6390-6393 / 5530-5533), 347 (6394/5534), 348 (6395/5535), "
   "349 (6396/5536), 350 (6397/5537). Twoje własne wyłącznie: baza 6413, harness 5553. "
   "★ ZAKAZ `pkill`/`killall` — zapisz `$!` po starcie Vite i zabij WYŁĄCZNIE swój PID"
 ),

 "POZYCJE_Z_FLAGAMI": (
   "BRAK — i to jest **najważniejsza informacja o ryzyku tego dyżuru**. Kafle etapów są "
   "bramkowane wyłącznie `toolType === 'dynamic-swot'` (`ToolDocumentView.tsx`, pięć miejsc), "
   "**a NIE flagą funkcyjną**. Oznacza to, że każda etykieta, którą tu poprawisz albo popsujesz, "
   "wchodzi na żywo dla wszystkich użytkowników natychmiast po scaleniu. ★★ **Nie zakładasz "
   "nowej flagi** — to byłaby zmiana architektury poza zakresem; **opisujesz stan zastany jako "
   "ryzyko w raporcie** (`R5` punkt 7). ★ Ten dyżur nie dodaje, nie zmienia i nie przełącza "
   "ANI JEDNEJ flagi"
 ),

 "LISTA_BRAMEK": (
   "`scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, "
   "`scripts/check-triada.sh`, `scripts/check-gestosc.sh`, `scripts/dev/reachability-from-root.mjs`, "
   "`scripts/dev/i18n-pl-audyt.mjs`, `.husky/pre-commit`, `tests/setup.ts`, `tests/helpers/**`, "
   "`tests/__mocks__/**`, `vitest*.config.ts`, `.github/workflows/**`, `scripts/dev/grafika-zrzuty.mjs` "
   "oraz `scripts/dev/lib/checkScreenshotPairState.mjs`. Wszystkie NIETYKALNE DO ZAPISU — wolno je "
   "wołać w pomiarze. ★★ DWA WYJĄTKI, obydwa jawnie licencjonowane przez tę instrukcję: "
   "**(1)** `.husky/pre-commit` — dopisanie JEDNEGO nowego bloku dla nowego bezpiecznika, wzorowanego "
   "na blokach `check-list-canon` (wiersz ~9) i `check-artefakt` (wiersz ~20); zakaz zmiany bloków "
   "istniejących. **(2)** `scripts/dev/check-etykiety-dwujezyczne.mjs` — NOWY plik, Twój produkt. "
   "★ `scripts/dev/i18n-pl-audyt.mjs` **importujesz, nie zmieniasz**. ★★ Każde wywołanie bramki "
   "zapisujesz z kodem wyjścia ORAZ z liczbą zbadanych obiektów — bramka, która przeszła, bo nic "
   "nie zmierzyła, nie jest wynikiem"
 ),

 "SCIEZKA_RAPORTU": "docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY354_ETYKIETY_NARZEDZI_REPORT.md",

 "Jedyny": (
   "Jedyny inny dokument do zmiany: **jedna nowa sekcja** w "
   "`docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — sekcje idą dziś do "
   "`Q`, ale równolegle dopisuje inny autor, więc literę sprawdzasz komendą "
   "`bash -c \"grep -nE '^## [A-Z][.]' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3\"` "
   "TUŻ PRZED commitem, nigdy z góry. **Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md`** (teren "
   "dyżuru 353) ani niczego w `public/locales/**` — ten dyżur poprawia literały w KODZIE, a liście "
   "słowników mają zostać `35199`/`33066`. ★★ WSZYSTKIE zrzuty i logi idą do "
   "`evidence/etykiety-narzedzi-20260904/` (katalog NIE ISTNIEJE na markerze — tworzysz go) "
   "z `git add -f`; ta instrukcja daje na to jawną licencję, więc „zakaz binariów w repo” byłby "
   "wymyślonym powodem (04.09 zdarzyło się to CZTERY RAZY i za każdym razem trzeba było ratować "
   "dowody z katalogów tymczasowych). Nowe testy idą do `tests/unit/i18n/`, **NIGDY pod `src/`**, "
   "i też wymagają `git add -f`. Plik postępu `/private/tmp/cx-day354-postep.md` żyje POZA repo"
 ),

 "ZAKAZ_WLASCIWY_TEMU_DYZUROWI": (
   "★★★ **ZAKAZ TŁUMACZENIA NA WŁASNĄ RĘKĘ TAM, GDZIE NAZWA ISTNIEJE W PACZCE.** Źródłem prawdy "
   "są `title: { pl, en }` w `src/toolPacks/packs/*.pack.ts` — to samo źródło, które zasila lewe "
   "drzewo. Etykieta wymyślona przez wykonawcę rozjedzie kafel z drzewem i defekt wróci w innym "
   "kształcie. Gdzie nazwy w paczce NIE MA — **oznaczasz jako PROPOZYCJĘ DO AKCEPTU**, nie "
   "wprowadzasz po cichu. "
   "★★★ **ZAKAZ TŁUMACZENIA TEGO, CO MA ZOSTAĆ IDENTYCZNE** — marki, akronimy (`SWOT`, `KPI`, "
   "`ROI`), „Status”, „Tempo”, separatory, placeholdery. Lista uzasadnionych identyczności jest "
   "zbudowana w `scripts/dev/i18n-pl-audyt.mjs` i **to ona rozstrzyga**, nie Twoje wyczucie. "
   "★★★ **ZAKAZ ZMIANY PACZEK** `src/toolPacks/packs/**` — są tylko do odczytu; zmiana paczki "
   "zmieniłaby też lewe drzewo. "
   "★★★ **ZAKAZ BEZPIECZNIKA NA ZERZE.** Kształt A daje dziś w całym `src/` 77 trafień; bramka "
   "wymagająca zera byłaby bramką, która NIGDY nie mogła przejść, a czerwień przypisałaby się "
   "produktowi. Ma być RATCHET z baseline'em **i PODŁOGA LICZEBNOŚCI** — zero zbadanych obiektów "
   "to CZERWIEŃ, nie zieleń. "
   "★★ **ZAKAZ KOPIOWANIA LISTY UZASADNIEŃ** — importujesz z `i18n-pl-audyt.mjs`; kopia to drugi "
   "rejestr, a dwa rejestry mierzą rozjazd. "
   "★★ **ZAKAZ ZMIANY `public/locales/**`, JAKIEGOKOLWIEK `MODULE_ACCEPTANCE.md`, "
   "`grafika-zrzuty.mjs` I `checkScreenshotPairState.mjs`.** "
   "★★ **ZAKAZ OSŁABIANIA ISTNIEJĄCYCH ASERCJI** w "
   "`tests/unit/tools/dynamicSwotPhaseOverview.render.test.tsx` (184 wiersze z dyżuru 344) — "
   "rozszerzasz je, nie rozluźniasz. "
   "★★ **ZAKAZ POŁĄCZENIA DO STAGINGU, DEMO I PRODUKCJI W KAŻDĄ STRONĘ** (`Z28`). "
   "★ **ZAKAZ `pkill`/`killall`, `git stash`, `git push`, `git fetch --all` oraz scalania czegokolwiek**"
 ),

 "DLACZEGO": (
   "Bo naprawa per-zgłoszenie daje „poprawne w dwóch z trzech”, a naprawa per-wywołanie odrasta: "
   "defekt zalatany w jednym module wrócił po ośmiu tygodniach w dwunastu plikach. Dyżur 344 "
   "naprawił sześć etykiet — te, które akurat były widoczne na jednym kadrze. W tym samym pliku "
   "zostaje ich więcej, w tej samej rodzinie zostaje ich jeszcze więcej, i **każda z nich wejdzie "
   "na żywo dla wszystkich**, bo kafle nie są za flagą. ★ Drugi powód jest ważniejszy od "
   "pierwszego: to jest kształt „klucz istnieje ≠ przetłumaczony”. Audyt liczący ISTNIENIE gałęzi "
   "polskiej melduje „przetłumaczone”, gdy ta gałąź trzyma angielskie słowo. Dlatego produktem "
   "tego dyżuru nie jest lista poprawek, tylko **bezpiecznik z dowodem mutacyjnym w obie strony** "
   "— żeby nikt nie musiał tego oglądać oczami po raz trzeci"
 ),

 "SCIEZKI": (
   "Jednostkowe front, z roota, wariant (C) `RUN_DB_TESTS=0 MOCK_DB=true`, ścieżki "
   "`tests/unit/tools tests/unit/i18n` — **uruchamiasz, żeby udowodnić brak regresji**, i "
   "**nie naprawiasz** tego, co czerwone z powodów spoza tego dyżuru. Nowe testy tego dyżuru "
   "kładziesz w `tests/unit/i18n/`, **NIGDY pod `src/`**, z `git add -f`. "
   "**Każdy przelot z `--retry=0` i `--reporter=json --outputFile=<plik w ARTEFAKTY>`; podajesz "
   "`numTotalTests`. Przelot z zerem wykonanych przypadków kończy się `exit 0` i NIE JEST "
   "POMIAREM. `No test files found` oraz `Transform failed` to BŁĄD KOMENDY, nie `PASS`.** "
   "★ Po każdej partii poprawek: `npx esbuild <zmienione pliki> --outdir=/dev/null` — "
   "`Transform failed` traktujesz jako błąd komendy, nie jako „brak zmian”. "
   "★ Na koniec `node scripts/dev/reachability-from-root.mjs --check-baseline` musi dać `0`"
 ),

 "PULAPKA_WLASCIWA_TEMU_MODULOWI": (
   "★★★ **SZEŚĆ PUŁAPEK TEGO DYŻURU.** "
   "**(1) Klucz istnieje ≠ przetłumaczony.** Gałąź polska ISTNIEJE we wszystkich 105 ternary "
   "badanego pliku — i w 30 z nich trzyma angielskie słowo. Audyt liczący istnienie gałęzi "
   "zamelduje „100% przetłumaczone”. Licznik ma porównywać TREŚĆ obu gałęzi, nie ich obecność. "
   "**(2) `grep --include` w `zsh` zwraca pustkę zamiast wyników** — trafiło to trzy razy jednego "
   "dnia i raz zostało zacommitowane jako fałsz. **Pustka nie jest wynikiem, dopóki nie sprawdzisz, "
   "że polecenie się wykonało.** Wszystkie grepy przez `bash -c` z cudzysłowami. "
   "**(3) Bezpiecznik nagradza defekt.** Para zrzutów przechodzi kontrolę jasności tym łatwiej, "
   "im MNIEJSZA zmiana — a zmiana pięciu napisów prawie nie zmienia luminancji. Próg `150` "
   "w `checkScreenshotPairState.mjs` jest tu BEZUŻYTECZNY; dowodem jest **mechaniczne zliczenie "
   "przez `--zlicz`** (`DEC-387`), nie obrazek. "
   "**(4) Przyrząd pokazuje nie produkt.** 3 z 6 „defektów” jednego dnia okazało się hostem "
   "harnessu. Porównaj łańcuch przodków kafla w `dev-render` i w realnej trasie; różnicę zapisz "
   "jako granicę dowodu. **Harness nie jest produktem** — zmiana ekranu jest ostatecznością "
   "i wymaga uzasadnienia w raporcie. "
   "**(5) Duplikat zamiast motywu.** Para light/dark bywa tym samym obrazem pod dwiema nazwami. "
   "**Suma kontrolna KAŻDEGO z czterech plików idzie do raportu.** "
   "**(6) Brak pomiaru nie jest wynikiem.** Bezpiecznik przechodzi, gdy wejście jest puste, gdy "
   "nikt go nie poprosił, albo gdy ginie na ścieżce macOS przed pierwszym pomiarem — bramka CI "
   "już raz zginęła w ten sposób i czerwień przypisała się produktowi. Dlatego Twój bezpiecznik "
   "**MUSI wypisywać liczbę zbadanych plików i ternary, i czerwienieć przy zerze**"
 ),

 "POZYCJE_RDZENIA": (
   "R1 (**KROK 0** — inwentarz CAŁEJ rodziny własnym licznikiem, rozdzielenie kształtu A od "
   "hybryd, klasyfikacja DEFEKT / UZASADNIONA IDENTYCZNOŚĆ / PROPOZYCJA, wskazanie źródła nazwy "
   "w paczce) · R2 (**bezpiecznik PRZED naprawą** — ratchet, podłoga liczebności, import listy "
   "uzasadnień, rejestracja w hooku, **TRZY dowody mutacyjne w obie strony**) · R3 (naprawa "
   "rodziny: kształt A, potem hybrydy, nazwy z paczek, rozszerzenie testu kafli) · R4 (para "
   "zrzutów light+dark z **mechanicznym zliczeniem** i sumami kontrolnymi, kadr z drzewem "
   "I kaflami jednocześnie) · R5 (raport, sekcja rejestru, **lista PROPOZYCJI do akceptu**). "
   "**Commit po KAŻDEJ pozycji `R`**"
 ),
}

with open("/private/tmp/ag-instr-L-20260904/_instr_src/cfg354.json", "w", encoding="utf-8") as fh:
    json.dump(cfg, fh, ensure_ascii=False, indent=1)
print("OK", len(cfg), "kluczy")
