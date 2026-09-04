# -*- coding: utf-8 -*-
import json

WT = "/private/tmp/cx-day365-podglad-domkniecie"

KOMENDY = r"""```bash
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
```"""

cfg = {
 "NR_DYZURU": "365",
 "TYTUL_JEDNYM_ZDANIEM": (
   "★★★ PODGLĄD — DOMKNIĘCIE PO 352, Z JEDNĄ RZECZĄ BLOKUJĄCĄ NA POCZĄTKU. "
   "Dyżur 352 (scalony) wyprodukował pary PRZED/PO ekranów podglądu po tym, jak zmiana z 349 "
   "sprawiła, że sekcja „Brak powiązań” **renderuje się teraz zawsze**, w każdym podglądzie "
   "wszystkich 16 modułów (`StandardPreview.tsx:362`, commit `58d391d65b`). Do domknięcia są "
   "TRZY rzeczy. ★★★ **BLOKUJĄCA, pierwsza w kolejności:** dyżur 352 wprowadził do "
   "`scripts/dev/grafika-zrzuty.mjs` **trzy** zmiany, mając licencję na **jedną** opcję opt-in "
   "przy zachowaniu historycznych wywołań bit w bit — obok poprawnej opcji `--mierz-wysokosc` "
   "zmienił **zachowanie re-kliku po rozwinięciu sekcji** i **licznik bramki `zlePary`**; "
   "obie zmieniają wynik i kod wyjścia **pomiarów innych dyżurów** (m.in. przeglądu G06 "
   "16 modułów), a raport nie wspomniał o żadnej. Obie są merytorycznie poprawne — ale muszą "
   "być **jawnie zadeklarowane, uzasadnione i przyjęte osobno albo cofnięte**. ★★ Druga: "
   "`finance-hub&tab=analysis` pokazuje **DWIE identyczne karty „POWIĄZANIA / Brak powiązań” "
   "jedna pod drugą** — odbiorca potwierdził to własnymi oczami na kadrze; to realny defekt, "
   "nie kwestia kadru, i ma dwa adresy: `StandardPreview.tsx:362` oraz "
   "`FinancePreviewPanel.tsx:1280`. ★ Trzecia: **tylko 12 z 16 kontekstów ma różne sumy "
   "kontrolne** — 3 pary identyczne, 1 bez „PO”; dorobić brakujące. ★ Pytania „czy pusta karta "
   "ma się w ogóle pokazywać” **nie rozstrzygasz sam** — dyżur 352 słusznie postawił je "
   "właścicielowi i pokazał sprzeczność w SSOT; masz je utrzymać i wyostrzyć"
 ),
 "WORKTREE": WT,
 "NAZWA_WORKTREE": "cx-day365-podglad-domkniecie",
 "NAZWA": "day365-podglad-domkniecie",
 "SCRATCH": WT + "-scratch",
 "ARTEFAKTY": WT + "-artefakty",
 "SHA_MARKERA": "2a7273e087cbd3e44344725b524f6ddd79d5badc",
 "REMOTE": "github-backup",
 "GALAZ_BAZOWA": "grafika/m03-20260902",
 "GALAZ_DYZURU": "codex/day365-podglad-domkniecie-20260904",
 "WYDANY": "WYDANY",
 "DATA": "2026-09-04",
 "PORT_DB": "6436",
 "PORT_HARNESS": "5576",
 "KONTENER": "cx-day365-pg",
 "BAZA": "cx365",
 "JWT_SECRET": "cx365-test-secret-do-not-reuse-min-32-znaki",
 "N_KOMEND": "osiem",

 "MODUL_LUB_OBSZAR": (
   "PRZEKROJOWE — powłoka podglądu `src/components/standard/StandardPreview.tsx` we wszystkich "
   "16 modułach, jej wołacze przekazujące DZIECI (16 miejsc, w tym `FinanceHub.tsx:3272`), "
   "oraz **kanoniczne narzędzie zrzutów** `scripts/dev/grafika-zrzuty.mjs` wraz z jego "
   "historycznymi wołaczami. Przedmiotem pracy są trzy domknięcia po dyżurze 352: "
   "**(1) trzy niezadeklarowane zmiany w narzędziu pomiarowym** — pozycja BLOKUJĄCA, robiona "
   "PIERWSZA; **(2) dublet karty „Brak powiązań” w Finansach** — realna naprawa; "
   "**(3) brakujące pary PRZED/PO** — dorobienie dowodu. Pytanie o sens pustej karty "
   "**pozostaje otwarte dla właściciela**. Prawo zatrzymania PO KAŻDEJ pozycji `R`, "
   "z commitem, i plik postępu `/private/tmp/cx-day365-postep.md` (POZA repo)"
 ),

 "TRASY_FRONT": (
   "★★ SEDNO. `src/components/standard/StandardPreview.tsx` — blok 5 „Relations” w wierszach "
   "**353-368** (bezwarunkowe `<PreviewRelations items={relations ?? []} …/>` w linii **362**, "
   "wprowadzone commitem `58d391d65b` dyżuru 349). Dublet w Finansach: "
   "`src/components/Economics/FinancePreviewPanel.tsx:1280` renderuje **własny** "
   "`PreviewRelations` wewnątrz `renderPreviewFooter`, a `src/components/Economics/FinanceHub.tsx:3279` "
   "przekazuje ten footer jako **dzieci** do `StandardPreview` (wołacz w linii 3272). "
   "★ RODZINA: **16 wołaczy `<StandardPreview>` przekazuje dzieci** — i tylko one mogą dublować "
   "bloki stopki; sąsiednie kształty do sprawdzenia w tym samym pliku Finansów to "
   "`PreviewAIHintStrip` (`FinancePreviewPanel.tsx:1273`) i `PreviewActionBar` (`:1298`)"
 ),

 "TRASY_TYL": (
   "Ten dyżur **nie dotyka serwera**. Nie stawiasz kontenera i nie uruchamiasz migracji, "
   "chyba że sam udowodnisz, że jest to konieczne — a wtedy piszesz w raporcie, po co. "
   "Zasoby `6436`/`cx-day365-pg`/`cx365` są zarezerwowane wyłącznie po to, żeby żaden inny "
   "dyżur ich nie wziął. `server/**` pozostaje `TYLKO ODCZYT` bez wyjątku"
 ),

 "LISTA_PORTOW_ZAJETYCH": (
   "Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium "
   "ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. "
   "Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. "
   "Rodzeństwo TEJ paczki 04.09 — nie dotykasz: 363 (6434/5574), 364 (6435/5575), 366 (6437/5577). "
   "Równoległa paczka 359-362 ma zarezerwowany przedział 6430-6433 i 5570-5573 — również nie dotykasz. "
   "Starsze rodzeństwo 04.09: 347-355 używa 6394-6397 i 6410-6414 oraz 5534-5537 i 5550-5554 "
   "(dyżur 352 pracował na 6411/5551). "
   "Twoje własne wyłącznie: baza 6436, harness 5576. "
   "★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`)"
 ),

 "POZYCJE_Z_FLAGAMI": (
   "BRAK NOWYCH FLAG. ★★ I to jest istotna cecha tego dyżuru: **pusta karta „Brak powiązań” "
   "nie jest za żadną flagą** — od commitu `58d391d65b` renderuje się bezwarunkowo w każdym "
   "podglądzie wszystkich 16 modułów. Każda Twoja zmiana w `StandardPreview.tsx` jest widoczna "
   "natychmiast, wszędzie. Dlatego naprawa dubletu ma iść w **najwęższe możliwe miejsce**, "
   "a każda zmiana w powłoce wymaga dowodu wizualnego z więcej niż jednego modułu"
 ),

 "LISTA_BRAMEK": (
   "`scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, "
   "`scripts/dev/reachability-from-root.mjs`, `scripts/check-dev-render-parytet.mjs`, "
   "`tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, "
   "`server/vitest.config*.ts`, `.github/workflows/**`, `public/locales/**`. "
   "Wszystkie **NIETYKALNE DO ZAPISU**. ★ WYJĄTEK JAWNY: `scripts/dev/grafika-zrzuty.mjs` "
   "**jest przedmiotem pracy w `R1`** — ale wyłącznie w trybie „zadeklaruj, udowodnij "
   "równoważność albo cofnij”, nigdy w trybie „dopisz jeszcze jedną zmianę”"
 ),

 "SCIEZKA_RAPORTU": "docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY365_PODGLAD_DOMKNIECIE_REPORT.md",

 "Jedyny": (
   "Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w "
   "`docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — sekcje doszły "
   "dziś do `Z`, więc następne idą `AA`, `AB`, … (literę sprawdzasz komendą tuż przed commitem) "
   "— oraz **dopisanie** sekcji „Zmiany w kanonicznym narzędziu zrzutów, dyżury 352 i 365” "
   "do `docs/program/grafika/00_ZASADY_PRACY.md` (**dopisanie, nigdy nadpisanie**), plus nowe "
   "pliki dowodowe pod `evidence/podglad-relations-20260904/` (katalog ISTNIEJE — **dokładasz "
   "do niego, nie nadpisujesz istniejących PNG**) i `evidence/podglad-domkniecie-20260904/` "
   "(NIE ISTNIEJE — tworzysz). ★★★ **MACIERZ ODBIORU JEST NIETYKALNA W TYM DYŻURZE** — żaden "
   "wiersz, żaden moduł. Plik postępu `/private/tmp/cx-day365-postep.md` żyje POZA repo. "
   "Nowe pliki w `tests/` wymagają `git add -f`"
 ),

 "ZAKAZ_WLASCIWY_TEMU_DYZUROWI": (
   "★★★ **ZAKAZ ROZSTRZYGANIA PYTANIA O PUSTĄ KARTĘ.** Dyżur 352 **nie rozstrzygnął po cichu**, "
   "czy pusta karta „Brak powiązań” ma się w ogóle pokazywać — postawił pytanie właścicielowi "
   "i pokazał sprzeczność między dwoma dokumentami kanonu (`TRIADA_KANON.md:70` i `:132` "
   "kontra `TABLE_AND_PREVIEW_CANON.md:337`). **To było poprawne zachowanie i Ty je "
   "powtarzasz.** Nie usuwasz bezwarunkowego renderu w `StandardPreview.tsx`, nie dodajesz "
   "warunku „tylko gdy są dane”, nie zmieniasz żadnego z dwóch dokumentów kanonu. "
   "Naprawiasz **dublet** — dwie karty zamiast jednej — i to jest coś zupełnie innego niż "
   "„jedna karta zamiast zera”. "
   "★★★ **ZAKAZ DOPISANIA CZWARTEJ ZMIANY DO HARNESSU.** `R1` jest o **rozliczeniu trzech "
   "istniejących**, nie o dodaniu kolejnych. Jeżeli do dorobienia par potrzebujesz nowej "
   "opcji — zatrzymujesz się i piszesz o tym; jedna opcja opt-in jest dopuszczalna **tylko** "
   "z dowodem, że wszystkie historyczne wywołania dają wynik i kod wyjścia bit w bit taki sam. "
   "★★ **ZAKAZ WŁASNEGO SKRYPTU ZRZUCAJĄCEGO OBOK KANONICZNEGO.** Doraźny skrypt dał już raz "
   "parę identycznych obrazów i zameldował sukces. Brakującą funkcję dokłada się narzędziu, "
   "opt-in, z parametrami zapisanymi na trwałe. "
   "★★ **ZAKAZ ZALICZENIA PARY BAJTOWO IDENTYCZNEJ.** Para o tej samej sumie kontrolnej "
   "to **ZERO dowodu** — zapisujesz to jako wynik negatywny z wyjaśnieniem, nigdy jako "
   "zaliczoną parę. Para light/dark o zbliżonej średniej jasności to ten sam obraz pod dwiema "
   "nazwami. "
   "★ **ZAKAZ `.skip`, `.todo`, `--retry` innego niż `0`, poszerzania `exclude`** (`Z35`). "
   "**ZAKAZ nadpisywania istniejących PNG dyżuru 352** — one są bazą porównania"
 ),

 "DLACZEGO": (
   "Bo narzędzie pomiarowe zmieniło się bez zapowiedzi, a na jego wynikach stoi przegląd "
   "16 modułów i kilkanaście dyżurów. Zmiana licznika `zlePary` przesuwa **kod wyjścia** — "
   "czyli bramkę — a zmiana re-kliku przesuwa **treść kadru**. Obie mogą być słuszne; żadna "
   "nie może być cicha. Do tego jeden ekran pokazuje dziś użytkownikowi dwie identyczne puste "
   "karty jedna pod drugą, a jedna czwarta zamówionych par dowodowych nie jest dowodem, "
   "bo pliki PRZED i PO są tym samym plikiem. **Przyrząd, który kłamie, i dowód, który jest "
   "kopią — to dwie postacie tej samej straty czasu**"
 ),

 "PULAPKA_WLASCIWA_TEMU_MODULOWI": (
   "★★★ **SIEDEM PUŁAPEK.** "
   "(1) **Przyrząd nie jest produktem.** Trzy z sześciu „defektów wysokości” w innym dyżurze "
   "okazały się hostem harnessu, nie produktem. Zanim zgłosisz defekt, porównaj łańcuch "
   "przodków w harnessie i w realnej trasie. "
   "(2) **Para identyczna wygląda jak dowód.** 3 z 16 kontekstów mają PRZED i PO o tej samej "
   "sumie kontrolnej — bo pusty blok renderował się już przed zmianą (352 to udowodnił "
   "i słusznie zapisał). To **falsyfikacja założenia**, nie zaliczona para. "
   "(3) **Rodzina nie widać per plik.** Dublet w Finansach powstaje z DWÓCH plików: powłoka "
   "renderuje blok, a stopka przekazana jako dzieci renderuje drugi. `grep` po jednym pliku "
   "tego nie znajdzie — musisz iść po łańcuchu `children`/`renderPreviewFooter`. "
   "Wołaczy przekazujących dzieci jest **16**. "
   "(4) **Zwinięta sekcja nie jest dowodem.** Zrzuty robisz z sekcjami ROZWINIĘTYMI; "
   "★ ale uwaga: rozwijanie sekcji potrafi **zamknąć podgląd** — dokładnie temu służy warunek "
   "`podgladNadalOtwarty`, który 352 dopisał bez deklaracji. Sprawdź obecność markera "
   "`[data-preview-block=\"details\"]` w każdym zaliczonym kadrze. "
   "(5) **Skan w trakcie animacji daje fałszywy kontrast** — używaj `--osiad-po-rozwinieciu`. "
   "(6) **Bezpiecznik jednowymiarowy nagradza defekt.** Kontrola „light jaśniejszy od dark” "
   "przechodzi tym łatwiej, im większy defekt na jednym z kadrów. Podawaj **sumę kontrolną "
   "ORAZ średnią jasność ORAZ liczebność z uchwytu DOM**, i patrz na kadry oczami. "
   "(7) **`grep --include` w `zsh` zwraca pustkę zamiast wyników** — uruchamiaj przez "
   "`bash -c '…'` i sprawdzaj kod wyjścia; pustka nie jest wynikiem, dopóki nie wiesz, "
   "że komenda się wykonała"
 ),

 "SCIEZKI": (
   "Zrzuty **wyłącznie kanonicznym narzędziem** `scripts/dev/grafika-zrzuty.mjs` na porcie "
   "`5576`, w obu motywach, `pl`, szerokość `1440`, **sekcje ROZWINIĘTE**, z sumą kontrolną "
   "SHA-256 i średnią jasnością każdego pliku oraz liczebnością **z uchwytu DOM**. "
   "Dowód równoważności historycznych wywołań (`R1`) budujesz przez **dwa przebiegi tego "
   "samego wywołania**: raz na wersji narzędzia sprzed commitu `4fcd20808e` (kopia do "
   "`SCRATCH`, POZA repo), raz na bieżącej — i porównujesz **sumy kontrolne PNG, treść JSON-a "
   "kontroli i KOD WYJŚCIA**. Testy frontowe z roota, `RUN_DB_TESTS=0 MOCK_DB=true`, "
   "`--retry=0 --reporter=json --outputFile=/private/tmp/cx-day365-podglad-domkniecie-artefakty/<etykieta>.json`; "
   "**`No test files found` i `Transform failed` to BŁĄD KOMENDY, nie PASS**. "
   "Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`. Dowody commitujesz do "
   "`evidence/**` przez `git add -f` — **istniejących PNG dyżuru 352 nie nadpisujesz**"
 ),

 "TU_WSTAWIASZ_KOMENDY_WERYFIKACJI_STANU_WEJSCIOWEGO": KOMENDY,

 "POZYCJE_RDZENIA": (
   "R0 (twarde zasady: pytanie kanonu zostaje otwarte; para identyczna = zero dowodu; "
   "zakaz czwartej zmiany w harnessie) · "
   "R1 (★ BLOKUJĄCA, PIERWSZA: trzy zmiany w harnessie 352 — deklaracja imienna, uzasadnienie, "
   "dowód równoważności historycznych wywołań albo cofnięcie — RDZEŃ) · "
   "R2 (dublet „Brak powiązań” w Finansach: KROK 0 rodzina 16 wołaczy, potem najwęższa "
   "naprawa — RDZEŃ) · "
   "R3 (dorobienie brakujących par PRZED/PO: 3 identyczne, 1 bez PO, 3 ekrany CaseWorkspace) · "
   "R4 (pytanie o pustą kartę: utrzymać i WYOSTRZYĆ, nie rozstrzygać) · "
   "R5 (raport, manifest par, pytania do właściciela)"
 ),
}

with open("_instr_src/cfg365.json", "w", encoding="utf-8") as f:
    json.dump(cfg, f, ensure_ascii=False, indent=2)
print("OK cfg365.json", len(cfg), "pol")
