# -*- coding: utf-8 -*-
import json

WT = "/private/tmp/cx-day364-namepl-rodzina"

KOMENDY = r"""```bash
cd "$WT"

# (1) ★★ TEZA GLOWNA: pola `namePl:` trzymajace CZYSTY ANGIELSKI — CALA `src/`, nie jeden plik
node -e "
const fs=require('fs'),path=require('path');
function walk(d,out=[]){for(const n of fs.readdirSync(d)){const p=path.join(d,n);const s=fs.statSync(p);if(s.isDirectory())walk(p,out);else if(/\.(ts|tsx)\$/.test(n))out.push(p);}return out;}
let tot=0,ident=0,byFile={};
for(const f of walk('src')){const L=fs.readFileSync(f,'utf8').split('\n');let cur=null;
 for(let i=0;i<L.length;i++){const mn=L[i].match(/^\s*name:\s*'([^']*)',/); if(mn) cur=mn[1];
  const mp=L[i].match(/^\s*namePl:\s*'([^']*)',/);
  if(mp){tot++; if(mp[1]===cur){ident++;(byFile[f]=byFile[f]||[]).push((i+1)+' '+JSON.stringify(mp[1]));}}}}
console.log('namePl literalow w src:',tot,'| identycznych z sasiednim name:',ident);
for(const k of Object.keys(byFile))console.log(' ',k,byFile[k].length);
"
#   moje liczby: 331 literalow `namePl:` w `src/`; 27 identycznych z sasiednim `name:`
#   rozklad: useToolStore.ts 23 · config/transformationTools.ts 3 · toolCanvas.smoke.test.tsx 1
#   ★ ZLECENIE MOWILO O 18. MOJ POMIAR DAJE 23 W `useToolStore.ts`. Zmierz sam.

# (2) TEZA: dwadziescia z nich to CZTERY CALE RODZINY nieprzetlumaczonych faz
bash -c "grep -n 'namePl:' src/store/useToolStore.ts | sed -n '1,120p'" | grep -nE "'(Mission & Market Context|Input & Exploration|Five Forces Build|Strategic Implications|Outputs & Actions|Growth Mission & Context|Ansoff Options Build|Strategic Comparison|Portfolio Mission & Context|Portfolio Items & Matrix|Trade-offs & Priorities|Risk Mission & Context|Assumptions & Risk Map|Risk Synthesis|Sizing|Backlog|Redesign)'" | wc -l
#   moje liczby: 20 w PORTER_STEPS + GROWTH_PATHS_STEPS + PORTFOLIO_PRIORITY_STEPS +
#   RISK_UNCERTAINTY_STEPS, plus 3 jednowyrazowe (Sizing, Backlog, Redesign) w RPA_SCANNER
#   i PROCESS_AUTOMATION ⇒ razem 23

# (3) ★★ TEZA: BEZPIECZNIK Z 354 NIE WIDZI ANI KSZTALTU, ANI PLIKU
bash -c "grep -n 'roots\|ternaryPattern\|baselinePath' scripts/dev/check-etykiety-dwujezyczne.mjs"
cat scripts/dev/check-etykiety-dwujezyczne.baseline.json
node scripts/dev/check-etykiety-dwujezyczne.mjs; echo "ratchet=$?"
#   moje liczby: zakres skanu = src/components/DiscoveryTools + src/toolPacks
#   (★ `src/store/useToolStore.ts` NIE JEST SKANOWANY W OGOLE);
#   wzorzec = wylacznie ternary `isPolish ? 'x' : 'y'` (★ ksztalt `namePl:` NIE JEST SKANOWANY);
#   baseline: maxUnjustifiedIdentical=4, minFiles=150, minTernaries=300;
#   biezacy przebieg: pliki=162, ternary=350, nieuzasadnione=4, exit 0

# (4) TEZA: POLSKIE ODPOWIEDNIKI WSZYSTKICH DWUDZIESTU ISTNIEJA W PACZKACH
for p in marketForces growthPaths portfolioPriority riskUncertainty; do
  echo "== $p"; bash -c "grep -n 'title: { pl:' src/toolPacks/packs/$p.pack.ts"
done
#   moje liczby: po 5 tytulow `title.pl` w kazdej z czterech paczek ⇒ 20
#   ★ PULAPKA: mapuj po `id` fazy, NIE po `name`. Paczka `riskUncertainty` ma
#   `en: 'Mission & Context'`, a `useToolStore` ma `name: 'Risk Mission & Context'`.

# (5) ★★ TEZA ZLECENIA O KAFLACH — SPRAWDZ JA, BO MOJ POMIAR JEJ NIE POTWIERDZA
bash -c "grep -c \"toolType === 'dynamic-swot'\" src/components/DiscoveryTools/ToolDocumentView.tsx"
bash -c "grep -n 'PhaseSummaries(' src/components/DiscoveryTools/ToolDocumentView.tsx"
bash -c "grep -n 'export function compute' src/components/DiscoveryTools/toolCompletion.ts"
#   moje liczby: 20 wystapien `toolType === 'dynamic-swot'` (zlecenie mowilo o pieciu);
#   ★ `computeDynamicSwotPhaseSummaries` ma DOKLADNIE JEDNO wywolanie (linia 529),
#   i NIE ISTNIEJE odpowiednik dla porter/growth/portfolio/risk.
#   ⇒ kafle listy kontrolnej renderuja sie WYLACZNIE dla `dynamic-swot`.
#   Angielszczyzna czterech rodzin jest widoczna w DRZEWIE i NAGLOWKU, nie w kaflach.

# (6) TEZA: DRZEWO I NAGLOWEK CZYTAJA `namePl` W OSMIU MIEJSCACH
bash -c "grep -n 'stepDefinition.namePl\|currentStepDef.namePl\|step.namePl\|phaseStep.namePl' src/components/DiscoveryTools/*.tsx"
sed -n '1926,1932p' src/components/DiscoveryTools/ToolDocumentView.tsx
#   moje liczby: 8 miejsc (ToolCanvas 2 · ToolDocumentView 5 · ToolHeader 1)
#   ★ ToolDocumentView.tsx:1930 ma NAPRAWE PER WYWOLANIE: `isOutputs ? 'Wyniki i dzialania'
#   : step.namePl` — jedno miejsce maskuje defekt, siedem pozostalych nie.

# (7) TEZA: liscie slownikow i bramki kanonu na markerze
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: pl 35199, en 33066; focus=0, list=0, artefakt=0, reach=0

# (8) zasoby: dysk, porty, kontener, wejscie harnessu
df -h /
lsof -nP -iTCP:6435 -sTCP:LISTEN; lsof -nP -iTCP:5575 -sTCP:LISTEN
docker ps -a --format '{{.Names}}' | grep -c cx-day364 || true
bash -c "grep -n 'tools-swot-session-workspace' dev-render/main.tsx"
#   oczekiwane: powyzej 5 GB wolnego; oba porty puste; 0 kontenerow;
#   wpis harnessu `tools-swot-session-workspace` istnieje i montuje REALNY ToolDocumentView
```"""

cfg = {
 "NR_DYZURU": "364",
 "TYTUL_JEDNYM_ZDANIEM": (
   "★★★ POLA `namePl` TRZYMAJĄCE CZYSTY ANGIELSKI — CAŁA RODZINA, NIE JEDNO ZGŁOSZENIE. "
   "Dyżur 354 (scalony) naprawił **20 literałów** w `toolCompletion.ts` — 2 o identycznych "
   "gałęziach warunku języka i 18 hybryd — polskie nazwy wziął dosłownie z `title.pl` paczek, "
   "a bezpiecznik dostał pięć dowodów mutacyjnych i **importuje** `justification` "
   "ze `scripts/dev/i18n-pl-audyt.mjs`, zamiast go kopiować. ★★ ALE odbiorca zobaczył na "
   "zrzucie kafel „Synteza i napięcia” obok drzewa „Synteza i wnioski” i poszedł głębiej: "
   "w `src/store/useToolStore.ts` kształt `namePl:` **nie jest skanowany w ogóle**, a pola "
   "`namePl` trzymają czysty angielski dokładnie dla tych narzędzi, które 354 naprawiał "
   "(`Portfolio Items & Matrix`, `Trade-offs & Priorities`, `Ansoff Options Build`, "
   "`Five Forces Build`, `Outputs & Actions`…). ★ Odbiorca policzył **18**; "
   "**mój pomiar daje 23 w tym pliku i 27 w całej `src/`** — **zmierz to sam, obowiązuje "
   "Twoja liczba**. Polskie odpowiedniki wszystkich istnieją w paczkach. To nie jest za flagą: "
   "drzewo faz i nagłówek czytają `namePl` w **ośmiu** miejscach, więc polski użytkownik widzi "
   "angielskie nazwy faz od razu, bez włączania czegokolwiek. Do domknięcia jest też znane "
   "niedomknięcie 354: **18 z 20 napraw nie ma ochrony regresyjnej**, bo ratchet widzi wyłącznie "
   "kształt „obie gałęzie identyczne”"
 ),
 "WORKTREE": WT,
 "NAZWA_WORKTREE": "cx-day364-namepl-rodzina",
 "NAZWA": "day364-namepl-rodzina",
 "SCRATCH": WT + "-scratch",
 "ARTEFAKTY": WT + "-artefakty",
 "SHA_MARKERA": "2a7273e087cbd3e44344725b524f6ddd79d5badc",
 "REMOTE": "github-backup",
 "GALAZ_BAZOWA": "grafika/m03-20260902",
 "GALAZ_DYZURU": "codex/day364-namepl-rodzina-20260904",
 "WYDANY": "WYDANY",
 "DATA": "2026-09-04",
 "PORT_DB": "6435",
 "PORT_HARNESS": "5575",
 "KONTENER": "cx-day364-pg",
 "BAZA": "cx364",
 "JWT_SECRET": "cx364-test-secret-do-not-reuse-min-32-znaki",
 "N_KOMEND": "osiem",

 "MODUL_LUB_OBSZAR": (
   "MODUŁ `03_TOOLS` — etykiety faz narzędzi, warstwa frontowa. Przedmiotem pracy jest "
   "**RODZINA kształtu `namePl:`** w całej `src/` (nie jeden plik i nie jedno zgłoszenie), "
   "źródło prawdy w `src/toolPacks/packs/*.pack.ts` (`title.pl`), osiem miejsc renderujących "
   "`namePl` w `src/components/DiscoveryTools/` oraz **bezpiecznik** "
   "`scripts/dev/check-etykiety-dwujezyczne.mjs` wraz z jego plikiem bazowym. Produktem są "
   "trzy rzeczy naraz: **własna liczba** (nie moja i nie odbiorcy), **naprawa z paczek** "
   "(nie z własnej głowy) i **bezpiecznik obejmujący oba kształty** z dowodem mutacyjnym "
   "w obie strony. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, i plik postępu "
   "`/private/tmp/cx-day364-postep.md` (POZA repo)"
 ),

 "TRASY_FRONT": (
   "★★ SEDNO. Definicje: `src/store/useToolStore.ts` — tablice `PORTER_STEPS` (od linii 1417), "
   "`GROWTH_PATHS_STEPS` (1709), `PORTFOLIO_PRIORITY_STEPS` (1758), `RISK_UNCERTAINTY_STEPS` (1807), "
   "`RPA_SCANNER_STEPS`, `PROCESS_AUTOMATION_STEPS`; mapa `TOOL_STEP_DEFINITIONS` (2747-2754) "
   "i `getStepDefinitions()` (5094) — **to jest wołacz, który sprawia, że te nazwy są żywe**. "
   "Renderery (osiem miejsc): `ToolCanvas.tsx:1024`, `:1075`; `ToolDocumentView.tsx:1095`, "
   "`:1243`, `:1287`, `:1832`, `:1930`; `ToolHeader.tsx:203`. "
   "★ `ToolDocumentView.tsx:1930` zawiera **naprawę per wywołanie** "
   "(`isOutputs ? 'Wyniki i działania' : step.namePl`) — jedno miejsce maskuje defekt dla "
   "trzech identyfikatorów faz, siedem pozostałych nie. Źródło polskich nazw: "
   "`src/toolPacks/packs/{marketForces,growthPaths,portfolioPriority,riskUncertainty}.pack.ts`, "
   "pole `title.pl`, **mapowane po `id` fazy, nigdy po `name`**"
 ),

 "TRASY_TYL": (
   "Ten dyżur **nie dotyka serwera**. Nie stawiasz kontenera i nie uruchamiasz migracji, "
   "chyba że sam udowodnisz, że jest to konieczne — a wtedy piszesz w raporcie, po co. "
   "Zasoby `6435`/`cx-day364-pg`/`cx364` są zarezerwowane wyłącznie po to, żeby żaden inny "
   "dyżur ich nie wziął. `server/**` pozostaje `TYLKO ODCZYT` bez wyjątku"
 ),

 "LISTA_PORTOW_ZAJETYCH": (
   "Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium "
   "ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. "
   "Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. "
   "Rodzeństwo TEJ paczki 04.09 — nie dotykasz: 363 (6434/5574), 365 (6436/5576), 366 (6437/5577). "
   "Równoległa paczka 359-362 ma zarezerwowany przedział 6430-6433 i 5570-5573 — również nie dotykasz. "
   "Starsze rodzeństwo 04.09: 347-355 używa 6394-6397 i 6410-6414 oraz 5534-5537 i 5550-5554. "
   "Twoje własne wyłącznie: baza 6435, harness 5575. "
   "★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`)"
 ),

 "POZYCJE_Z_FLAGAMI": (
   "BRAK NOWYCH FLAG. ★★ I to jest **istotna cecha tego dyżuru, nie formalność**: kafle "
   "listy kontrolnej i drzewo faz **nie są za żadną flagą** — bramkuje je wyłącznie "
   "`toolType`. Konsekwencja: **każda Twoja zmiana `namePl` jest widoczna dla polskiego "
   "użytkownika natychmiast po scaleniu**, bez włączania czegokolwiek. Dlatego ten dyżur "
   "ma obowiązkowy dowód wizualny (`R5`) i dlatego nazwy biorą się z paczek, a nie "
   "z Twojego tłumaczenia"
 ),

 "LISTA_BRAMEK": (
   "`scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, "
   "`scripts/dev/reachability-from-root.mjs`, `tests/setup.ts`, `tests/helpers/**`, "
   "`tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, "
   "`public/locales/pl/translation.json`, `public/locales/en/translation.json`, "
   "`scripts/dev/grafika-zrzuty.mjs`. Wszystkie **NIETYKALNE DO ZAPISU** — wolno je wołać, "
   "nie wolno ich zmieniać, także wtedy gdy „wystarczyłaby drobna zmiana, żeby przeszło”. "
   "★ WYJĄTEK JAWNY: `scripts/dev/check-etykiety-dwujezyczne.mjs` i jego plik bazowy **są "
   "przedmiotem pracy** (`R2`) — patrz tabela licencji"
 ),

 "SCIEZKA_RAPORTU": "docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY364_NAMEPL_RODZINA_REPORT.md",

 "Jedyny": (
   "Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w "
   "`docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — sekcje doszły "
   "dziś do `Z`, więc następne idą `AA`, `AB`, … (literę sprawdzasz komendą tuż przed commitem) "
   "— oraz nowe pliki dowodowe pod `evidence/etykiety-namepl-20260904/` (katalog NIE ISTNIEJE "
   "na markerze — tworzysz go). ★★★ **MACIERZ ODBIORU JEST NIETYKALNA W TYM DYŻURZE**: nie "
   "zmieniasz stanu ani jednego wiersza `G00`–`G20` w żadnym module, w tym `03_TOOLS` — "
   "bramkami zajmują się równolegle dyżury 359-362. Plik postępu "
   "`/private/tmp/cx-day364-postep.md` żyje POZA repo. Nowe pliki w `tests/` wymagają `git add -f`"
 ),

 "ZAKAZ_WLASCIWY_TEMU_DYZUROWI": (
   "★★★ **ZAKAZ TŁUMACZENIA Z WŁASNEJ GŁOWY TAM, GDZIE NAZWA ISTNIEJE W PACZCE.** "
   "Dla każdej naprawionej etykiety podajesz `plik:linia` w `src/toolPacks/packs/*.pack.ts`, "
   "z którego wzięła się polska nazwa. Etykieta bez takiego wskazania jest **propozycją "
   "do akceptu właściciela**, nie naprawą — i idzie do osobnej tabeli w raporcie, dokładnie "
   "tak, jak zrobił to dyżur 354. "
   "★★ **ZAKAZ PODNIESIENIA PROGU BEZPIECZNIKA.** `maxUnjustifiedIdentical` wynosi dziś `4` "
   "i **nie wolno go zwiększyć**; `minFiles` (150) i `minTernaries` (300) **nie wolno obniżyć**. "
   "Jeżeli rozszerzenie zakresu skanu podniosłoby licznik długu — **nie podnosisz progu**, "
   "tylko albo naprawiasz, albo wprowadzasz **osobny, jawnie nazwany licznik dla nowego "
   "kształtu** i uzasadniasz, dlaczego to nie jest obejście ratcheta. "
   "★★ **ZAKAZ CISZY O ROZSZERZENIU `justification`.** Jeżeli dopiszesz cokolwiek do mapy "
   "`exact` w `scripts/dev/i18n-pl-audyt.mjs`, **wypisujesz każdą dopisaną wartość z nazwy "
   "w raporcie** — dopisanie do tej mapy jest jedynym sposobem, żeby uciszyć realny defekt "
   "bez śladu. "
   "★★ **ZAKAZ NAPRAWY PER WYWOŁANIE.** `ToolDocumentView.tsx:1930` już raz maskuje defekt "
   "„Outputs & Actions” w jednym z ośmiu miejsc. **Naprawa idzie do DEFINICJI, nie do wołacza**, "
   "a jeżeli uznasz, że per-wywołaniowa nakładka powinna zniknąć — mówisz to wprost i pokazujesz, "
   "co się zmienia w pozostałych siedmiu miejscach. "
   "★ **ZAKAZ `.skip`, `.todo`, `--retry` innego niż `0`, poszerzania `exclude`** (`Z35`). "
   "**ZAKAZ zmiany `public/locales/**`** — liście PL/EN nie mogą zmaleć i nie mają rosnąć od "
   "tego dyżuru"
 ),

 "DLACZEGO": (
   "Bo naprawa objęła dwadzieścia literałów w jednym pliku, a rodzina ma dwa kształty i mieszka "
   "w co najmniej trzech. Odbiorca zobaczył to na własnym zrzucie: jeden napis po polsku, drugi "
   "obok po angielsku, w tym samym narzędziu. **Praca per zgłoszenie daje „poprawne w dwóch "
   "z trzech”**, a bezpiecznik, który nie widzi drugiego kształtu ani drugiego pliku, jest "
   "spokojem, nie ochroną — 18 z 20 dzisiejszych napraw nie ma dziś żadnej ochrony regresyjnej. "
   "To jest widoczne dla polskiego użytkownika od razu, bez włączania czegokolwiek"
 ),

 "PULAPKA_WLASCIWA_TEMU_MODULOWI": (
   "★★★ **SIEDEM PUŁAPEK.** "
   "(1) **Klucz istnieje ≠ przetłumaczony.** Pole `namePl` jest w kodzie i ma wartość — tylko "
   "ta wartość jest angielska. Audyt po istnieniu pola melduje „przetłumaczone”. "
   "(2) **Bezpiecznik nie widzi ani kształtu, ani pliku.** Ratchet skanuje wyłącznie "
   "`src/components/DiscoveryTools` i `src/toolPacks`, wyłącznie wzorzec ternary "
   "`isPolish ? 'x' : 'y'`. `src/store/useToolStore.ts` **nie jest skanowany w ogóle**. "
   "(3) **Rozszerzenie zakresu podnosi licznik długu.** Poza czterema rodzinami wpadną m.in. "
   "`Six Sigma DMAIC`, `Process Mining`, `Sizing`, `Backlog`, `Redesign` — i `justification` "
   "zwraca dla nich `null`, czyli „nieuzasadnione”. **Progu nie wolno podnieść**; masz "
   "rozstrzygnąć każdą z tych wartości osobno i powiedzieć, dlaczego. "
   "(4) **Mapowanie po `name` daje złe pary.** Paczka `riskUncertainty` ma "
   "`en: 'Mission & Context'`, a `useToolStore` `name: 'Risk Mission & Context'`. "
   "**Mapuj po `id` fazy.** "
   "(5) **Naprawa per wywołanie odrasta.** `ToolDocumentView.tsx:1930` maskuje jeden przypadek "
   "w jednym z ośmiu miejsc; defekt widać dopiero tam, gdzie nakładki nie ma. "
   "(6) **Teza o kaflach ze zlecenia nie broni się w moim pomiarze.** "
   "`computeDynamicSwotPhaseSummaries` ma **jedno** wywołanie i **nie ma odpowiednika** dla "
   "porter/growth/portfolio/risk — kafle listy kontrolnej renderują się wyłącznie dla "
   "`dynamic-swot`. Angielszczyzna czterech rodzin jest widoczna w **drzewie faz i nagłówku**. "
   "**Sprawdź to sam i zapisz, co zobaczyłeś** — dowód wizualny masz oprzeć na tym, co "
   "faktycznie się renderuje, nie na tym, co napisałem. "
   "(7) **`grep --include` w `zsh` zwraca pustkę zamiast wyników** — uruchamiaj przez "
   "`bash -c '…'` i sprawdzaj kod wyjścia; pustka nie jest wynikiem, dopóki nie wiesz, "
   "że komenda się wykonała"
 ),

 "SCIEZKI": (
   "Testy frontowe uruchamiasz z roota, `RUN_DB_TESTS=0 MOCK_DB=true`, `--retry=0 "
   "--reporter=json --outputFile=/private/tmp/cx-day364-namepl-rodzina-artefakty/<etykieta>.json`. "
   "Bezpiecznik uruchamiasz przez `node scripts/dev/check-etykiety-dwujezyczne.mjs` i przez "
   "jego test `tests/unit/i18n/checkEtykietyDwujezyczne.test.ts` — oba PRZED i PO. "
   "**Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`** (`src/store/__tests__/"
   "swotStepLocale.test.ts` jest zastanym wyjątkiem; nie powielaj tego wzorca). "
   "Zrzuty **wyłącznie kanonicznym harnessem** `scripts/dev/grafika-zrzuty.mjs` na porcie "
   "`5575`, w obu motywach, z sekcjami ROZWINIĘTYMI, z sumami kontrolnymi i średnią jasnością; "
   "**zakaz własnego skryptu obok kanonicznego**. Liczebność bierzesz **z uchwytu DOM**, nie "
   "z oka. Para bajtowo identyczna = **ZERO dowodu**. Dowody commitujesz do "
   "`evidence/etykiety-namepl-20260904/` przez `git add -f`"
 ),

 "TU_WSTAWIASZ_KOMENDY_WERYFIKACJI_STANU_WEJSCIOWEGO": KOMENDY,

 "POZYCJE_RDZENIA": (
   "R0 (twarde zasady: własna liczba, nazwy z paczek, próg nietykalny, naprawa do definicji) · "
   "R1 (własny pomiar CAŁEJ rodziny `namePl:` w `src/` + weryfikacja tezy o kaflach — RDZEŃ) · "
   "R2 (rozszerzenie bezpiecznika o kształt `namePl:` i o zakres, z mutacją w OBIE strony — RDZEŃ) · "
   "R3 (domknięcie ochrony 18 napraw z 354 — kształt hybrydy) · "
   "R4 (naprawa z paczek, po `id` fazy, cała rodzina naraz — RDZEŃ) · "
   "R5 (dowód wizualny: para zrzutów PL na realnym komponencie) · "
   "R6 (raport, propozycje do akceptu, pytania do właściciela)"
 ),
}

with open("_instr_src/cfg364.json", "w", encoding="utf-8") as f:
    json.dump(cfg, f, ensure_ascii=False, indent=2)
print("OK cfg364.json", len(cfg), "pol")
