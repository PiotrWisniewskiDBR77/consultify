# INSTRUKCJA DYŻURU nr 364 — Codex — „★★★ POLA `namePl` TRZYMAJĄCE CZYSTY ANGIELSKI — CAŁA RODZINA, NIE JEDNO ZGŁOSZENIE. Dyżur 354 (scalony) naprawił **20 literałów** w `toolCompletion.ts` — 2 o identycznych gałęziach warunku języka i 18 hybryd — polskie nazwy wziął dosłownie z `title.pl` paczek, a bezpiecznik dostał pięć dowodów mutacyjnych i **importuje** `justification` ze `scripts/dev/i18n-pl-audyt.mjs`, zamiast go kopiować. ★★ ALE odbiorca zobaczył na zrzucie kafel „Synteza i napięcia” obok drzewa „Synteza i wnioski” i poszedł głębiej: w `src/store/useToolStore.ts` kształt `namePl:` **nie jest skanowany w ogóle**, a pola `namePl` trzymają czysty angielski dokładnie dla tych narzędzi, które 354 naprawiał (`Portfolio Items & Matrix`, `Trade-offs & Priorities`, `Ansoff Options Build`, `Five Forces Build`, `Outputs & Actions`…). ★ Odbiorca policzył **18**; **mój pomiar daje 23 w tym pliku i 27 w całej `src/`** — **zmierz to sam, obowiązuje Twoja liczba**. Polskie odpowiedniki wszystkich istnieją w paczkach. To nie jest za flagą: drzewo faz i nagłówek czytają `namePl` w **ośmiu** miejscach, więc polski użytkownik widzi angielskie nazwy faz od razu, bez włączania czegokolwiek. Do domknięcia jest też znane niedomknięcie 354: **18 z 20 napraw nie ma ochrony regresyjnej**, bo ratchet widzi wyłącznie kształt „obie gałęzie identyczne”"

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
> **wyłącznie** `/private/tmp/cx-day364-namepl-rodzina`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `2a7273e087cbd3e44344725b524f6ddd79d5badc`**
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
Zakres: **MODUŁ `03_TOOLS` — etykiety faz narzędzi, warstwa frontowa. Przedmiotem pracy jest **RODZINA kształtu `namePl:`** w całej `src/` (nie jeden plik i nie jedno zgłoszenie), źródło prawdy w `src/toolPacks/packs/*.pack.ts` (`title.pl`), osiem miejsc renderujących `namePl` w `src/components/DiscoveryTools/` oraz **bezpiecznik** `scripts/dev/check-etykiety-dwujezyczne.mjs` wraz z jego plikiem bazowym. Produktem są trzy rzeczy naraz: **własna liczba** (nie moja i nie odbiorcy), **naprawa z paczek** (nie z własnej głowy) i **bezpiecznik obejmujący oba kształty** z dowodem mutacyjnym w obie strony. Prawo zatrzymania PO KAŻDEJ pozycji `R`, z commitem, i plik postępu `/private/tmp/cx-day364-postep.md` (POZA repo)**.
Trasy front: `★★ SEDNO. Definicje: `src/store/useToolStore.ts` — tablice `PORTER_STEPS` (od linii 1417), `GROWTH_PATHS_STEPS` (1709), `PORTFOLIO_PRIORITY_STEPS` (1758), `RISK_UNCERTAINTY_STEPS` (1807), `RPA_SCANNER_STEPS`, `PROCESS_AUTOMATION_STEPS`; mapa `TOOL_STEP_DEFINITIONS` (2747-2754) i `getStepDefinitions()` (5094) — **to jest wołacz, który sprawia, że te nazwy są żywe**. Renderery (osiem miejsc): `ToolCanvas.tsx:1024`, `:1075`; `ToolDocumentView.tsx:1095`, `:1243`, `:1287`, `:1832`, `:1930`; `ToolHeader.tsx:203`. ★ `ToolDocumentView.tsx:1930` zawiera **naprawę per wywołanie** (`isOutputs ? 'Wyniki i działania' : step.namePl`) — jedno miejsce maskuje defekt dla trzech identyfikatorów faz, siedem pozostałych nie. Źródło polskich nazw: `src/toolPacks/packs/{marketForces,growthPaths,portfolioPriority,riskUncertainty}.pack.ts`, pole `title.pl`, **mapowane po `id` fazy, nigdy po `name`**`. Trasy tył: `Ten dyżur **nie dotyka serwera**. Nie stawiasz kontenera i nie uruchamiasz migracji, chyba że sam udowodnisz, że jest to konieczne — a wtedy piszesz w raporcie, po co. Zasoby `6435`/`cx-day364-pg`/`cx364` są zarezerwowane wyłącznie po to, żeby żaden inny dyżur ich nie wziął. `server/**` pozostaje `TYLKO ODCZYT` bez wyjątku`.

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
WT=/private/tmp/cx-day364-namepl-rodzina
MARKER=2a7273e087cbd3e44344725b524f6ddd79d5badc

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day364-namepl-rodzina-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day364-namepl-rodzina/config.worktree"
cat "$VAULT/worktrees/cx-day364-namepl-rodzina/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day364-namepl-rodzina-scratch
mkdir -p /private/tmp/cx-day364-namepl-rodzina-artefakty

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
git -C "$VAULT" log --oneline 2a7273e087cbd3e44344725b524f6ddd79d5badc..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only 2a7273e087cbd3e44344725b524f6ddd79d5badc..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day364-namepl-rodzina-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 2a7273e087cbd3e44344725b524f6ddd79d5badc..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `osiem` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day364-namepl-rodzina-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6435`. Twój JEDYNY port harnessu to `5575`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day364-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta restricted ports Chromium. Zajęte przez hosta i tor grafiki: 3020, 3022, 3025, 3027, 3030, 5432, 5433, 6012, 6379. Rodzeństwo TEJ paczki 04.09 — nie dotykasz: 363 (6434/5574), 365 (6436/5576), 366 (6437/5577). Równoległa paczka 359-362 ma zarezerwowany przedział 6430-6433 i 5570-5573 — również nie dotykasz. Starsze rodzeństwo 04.09: 347-355 używa 6394-6397 i 6410-6414 oraz 5534-5537 i 5550-5554. Twoje własne wyłącznie: baza 6435, harness 5575. ★ ZAKAZ `pkill`/`killall` — zabijasz wyłącznie własne PID-y (zapisz `$!`)`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `BRAK NOWYCH FLAG. ★★ I to jest **istotna cecha tego dyżuru, nie formalność**: kafle listy kontrolnej i drzewo faz **nie są za żadną flagą** — bramkuje je wyłącznie `toolType`. Konsekwencja: **każda Twoja zmiana `namePl` jest widoczna dla polskiego użytkownika natychmiast po scaleniu**, bez włączania czegokolwiek. Dlatego ten dyżur ma obowiązkowy dowód wizualny (`R5`) i dlatego nazwy biorą się z paczek, a nie z Twojego tłumaczenia`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh --ci`, `scripts/check-artefakt.sh`, `scripts/dev/reachability-from-root.mjs`, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `public/locales/pl/translation.json`, `public/locales/en/translation.json`, `scripts/dev/grafika-zrzuty.mjs`. Wszystkie **NIETYKALNE DO ZAPISU** — wolno je wołać, nie wolno ich zmieniać, także wtedy gdy „wystarczyłaby drobna zmiana, żeby przeszło”. ★ WYJĄTEK JAWNY: `scripts/dev/check-etykiety-dwujezyczne.mjs` i jego plik bazowy **są przedmiotem pracy** (`R2`) — patrz tabela licencji`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY364_NAMEPL_RODZINA_REPORT.md`. Jedyne inne dokumenty do zmiany: **jedna nowa sekcja** w `docs/program/REJESTR_ZNALEZISK_20260903.md` o PIERWSZEJ WOLNEJ literze — sekcje doszły dziś do `Z`, więc następne idą `AA`, `AB`, … (literę sprawdzasz komendą tuż przed commitem) — oraz nowe pliki dowodowe pod `evidence/etykiety-namepl-20260904/` (katalog NIE ISTNIEJE na markerze — tworzysz go). ★★★ **MACIERZ ODBIORU JEST NIETYKALNA W TYM DYŻURZE**: nie zmieniasz stanu ani jednego wiersza `G00`–`G20` w żadnym module, w tym `03_TOOLS` — bramkami zajmują się równolegle dyżury 359-362. Plik postępu `/private/tmp/cx-day364-postep.md` żyje POZA repo. Nowe pliki w `tests/` wymagają `git add -f`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day364-namepl-rodzina-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day364-namepl-rodzina-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje `railway` CLI, `psql`/`docker exec psql` do hosta innego niż `127.0.0.1`, `curl`/`wget`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | Produkcja NIETYKALNA; demo i staging są jedną bazą. **To jedyny zakaz, którego naruszenie zatrzymuje CAŁY dyżur** |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0` w KAŻDEJ komendzie** i `retry: 0` w opcjach `describe`/`it`, jeśli plik je ustawia | **Historycznie** `vitest.config.ts` ustawiał `retry: CI ? 3 : 1` i to unieważniało całą rodzinę testów izolacji: przy otwartej dziurze pierwszy przebieg realnie zmieniał stan, asercja padała, Vitest ponawiał — i test **raportował `PASS` mimo otwartej dziury** (dowód: `tests/integration/_retrymask/`, archetyp dyżuru 42). **Stan na 04.09: `vitest.config.ts:339` ustawia `retry: 0`, a `server/vitest.config.ts` nie ustawia `retry` wcale.** Zakaz zostaje w mocy — dotyczy `--retry=N` w CLI i `retry` w opcjach `describe`/`it` — ale **nie szukaj tu przyczyny niestabilności**: ponowień w konfiguracji już nie ma |
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
| `Z40` | ★★★ **ZAKAZ TŁUMACZENIA Z WŁASNEJ GŁOWY TAM, GDZIE NAZWA ISTNIEJE W PACZCE.** Dla każdej naprawionej etykiety podajesz `plik:linia` w `src/toolPacks/packs/*.pack.ts`, z którego wzięła się polska nazwa. Etykieta bez takiego wskazania jest **propozycją do akceptu właściciela**, nie naprawą — i idzie do osobnej tabeli w raporcie, dokładnie tak, jak zrobił to dyżur 354. ★★ **ZAKAZ PODNIESIENIA PROGU BEZPIECZNIKA.** `maxUnjustifiedIdentical` wynosi dziś `4` i **nie wolno go zwiększyć**; `minFiles` (150) i `minTernaries` (300) **nie wolno obniżyć**. Jeżeli rozszerzenie zakresu skanu podniosłoby licznik długu — **nie podnosisz progu**, tylko albo naprawiasz, albo wprowadzasz **osobny, jawnie nazwany licznik dla nowego kształtu** i uzasadniasz, dlaczego to nie jest obejście ratcheta. ★★ **ZAKAZ CISZY O ROZSZERZENIU `justification`.** Jeżeli dopiszesz cokolwiek do mapy `exact` w `scripts/dev/i18n-pl-audyt.mjs`, **wypisujesz każdą dopisaną wartość z nazwy w raporcie** — dopisanie do tej mapy jest jedynym sposobem, żeby uciszyć realny defekt bez śladu. ★★ **ZAKAZ NAPRAWY PER WYWOŁANIE.** `ToolDocumentView.tsx:1930` już raz maskuje defekt „Outputs & Actions” w jednym z ośmiu miejsc. **Naprawa idzie do DEFINICJI, nie do wołacza**, a jeżeli uznasz, że per-wywołaniowa nakładka powinna zniknąć — mówisz to wprost i pokazujesz, co się zmienia w pozostałych siedmiu miejscach. ★ **ZAKAZ `.skip`, `.todo`, `--retry` innego niż `0`, poszerzania `exclude`** (`Z35`). **ZAKAZ zmiany `public/locales/**`** — liście PL/EN nie mogą zmaleć i nie mają rosnąć od tego dyżuru | Bo naprawa objęła dwadzieścia literałów w jednym pliku, a rodzina ma dwa kształty i mieszka w co najmniej trzech. Odbiorca zobaczył to na własnym zrzucie: jeden napis po polsku, drugi obok po angielsku, w tym samym narzędziu. **Praca per zgłoszenie daje „poprawne w dwóch z trzech”**, a bezpiecznik, który nie widzi drugiego kształtu ani drugiego pliku, jest spokojem, nie ochroną — 18 z 20 dzisiejszych napraw nie ma dziś żadnej ochrony regresyjnej. To jest widoczne dla polskiego użytkownika od razu, bez włączania czegokolwiek |

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
cd /private/tmp/cx-day364-namepl-rodzina

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day364-pg psql -U postgres -d cx364 \
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
cd /private/tmp/cx-day364-namepl-rodzina

docker run -d --name cx-day364-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx364 \
  -p 127.0.0.1:6435:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day364-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6435/cx364 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6435/cx364 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day364-namepl-rodzina && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6435/cx364 \
JWT_SECRET=cx364-test-secret-do-not-reuse-min-32-znaki \
npx vitest run Testy frontowe uruchamiasz z roota, `RUN_DB_TESTS=0 MOCK_DB=true`, `--retry=0 --reporter=json --outputFile=/private/tmp/cx-day364-namepl-rodzina-artefakty/<etykieta>.json`. Bezpiecznik uruchamiasz przez `node scripts/dev/check-etykiety-dwujezyczne.mjs` i przez jego test `tests/unit/i18n/checkEtykietyDwujezyczne.test.ts` — oba PRZED i PO. **Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`** (`src/store/__tests__/swotStepLocale.test.ts` jest zastanym wyjątkiem; nie powielaj tego wzorca). Zrzuty **wyłącznie kanonicznym harnessem** `scripts/dev/grafika-zrzuty.mjs` na porcie `5575`, w obu motywach, z sekcjami ROZWINIĘTYMI, z sumami kontrolnymi i średnią jasnością; **zakaz własnego skryptu obok kanonicznego**. Liczebność bierzesz **z uchwytu DOM**, nie z oka. Para bajtowo identyczna = **ZERO dowodu**. Dowody commitujesz do `evidence/etykiety-namepl-20260904/` przez `git add -f` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day364-namepl-rodzina-artefakty/day364-namepl-rodzina.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day364-namepl-rodzina && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run Testy frontowe uruchamiasz z roota, `RUN_DB_TESTS=0 MOCK_DB=true`, `--retry=0 --reporter=json --outputFile=/private/tmp/cx-day364-namepl-rodzina-artefakty/<etykieta>.json`. Bezpiecznik uruchamiasz przez `node scripts/dev/check-etykiety-dwujezyczne.mjs` i przez jego test `tests/unit/i18n/checkEtykietyDwujezyczne.test.ts` — oba PRZED i PO. **Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`** (`src/store/__tests__/swotStepLocale.test.ts` jest zastanym wyjątkiem; nie powielaj tego wzorca). Zrzuty **wyłącznie kanonicznym harnessem** `scripts/dev/grafika-zrzuty.mjs` na porcie `5575`, w obu motywach, z sekcjami ROZWINIĘTYMI, z sumami kontrolnymi i średnią jasnością; **zakaz własnego skryptu obok kanonicznego**. Liczebność bierzesz **z uchwytu DOM**, nie z oka. Para bajtowo identyczna = **ZERO dowodu**. Dowody commitujesz do `evidence/etykiety-namepl-20260904/` przez `git add -f` --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day364-namepl-rodzina-artefakty/day364-namepl-rodzina.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day364-namepl-rodzina/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day364-pg psql -U postgres -d cx364 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day364-pg`.
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
> **(e) ★★★ **SIEDEM PUŁAPEK.** (1) **Klucz istnieje ≠ przetłumaczony.** Pole `namePl` jest w kodzie i ma wartość — tylko ta wartość jest angielska. Audyt po istnieniu pola melduje „przetłumaczone”. (2) **Bezpiecznik nie widzi ani kształtu, ani pliku.** Ratchet skanuje wyłącznie `src/components/DiscoveryTools` i `src/toolPacks`, wyłącznie wzorzec ternary `isPolish ? 'x' : 'y'`. `src/store/useToolStore.ts` **nie jest skanowany w ogóle**. (3) **Rozszerzenie zakresu podnosi licznik długu.** Poza czterema rodzinami wpadną m.in. `Six Sigma DMAIC`, `Process Mining`, `Sizing`, `Backlog`, `Redesign` — i `justification` zwraca dla nich `null`, czyli „nieuzasadnione”. **Progu nie wolno podnieść**; masz rozstrzygnąć każdą z tych wartości osobno i powiedzieć, dlaczego. (4) **Mapowanie po `name` daje złe pary.** Paczka `riskUncertainty` ma `en: 'Mission & Context'`, a `useToolStore` `name: 'Risk Mission & Context'`. **Mapuj po `id` fazy.** (5) **Naprawa per wywołanie odrasta.** `ToolDocumentView.tsx:1930` maskuje jeden przypadek w jednym z ośmiu miejsc; defekt widać dopiero tam, gdzie nakładki nie ma. (6) **Teza o kaflach ze zlecenia nie broni się w moim pomiarze.** `computeDynamicSwotPhaseSummaries` ma **jedno** wywołanie i **nie ma odpowiednika** dla porter/growth/portfolio/risk — kafle listy kontrolnej renderują się wyłącznie dla `dynamic-swot`. Angielszczyzna czterech rodzin jest widoczna w **drzewie faz i nagłówku**. **Sprawdź to sam i zapisz, co zobaczyłeś** — dowód wizualny masz oprzeć na tym, co faktycznie się renderuje, nie na tym, co napisałem. (7) **`grep --include` w `zsh` zwraca pustkę zamiast wyników** — uruchamiaj przez `bash -c '…'` i sprawdzaj kod wyjścia; pustka nie jest wynikiem, dopóki nie wiesz, że komenda się wykonała**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day364-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day364-namepl-rodzina-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R0 (twarde zasady: własna liczba, nazwy z paczek, próg nietykalny, naprawa do definicji) · R1 (własny pomiar CAŁEJ rodziny `namePl:` w `src/` + weryfikacja tezy o kaflach — RDZEŃ) · R2 (rozszerzenie bezpiecznika o kształt `namePl:` i o zakres, z mutacją w OBIE strony — RDZEŃ) · R3 (domknięcie ochrony 18 napraw z 354 — kształt hybrydy) · R4 (naprawa z paczek, po `id` fazy, cała rodzina naraz — RDZEŃ) · R5 (dowód wizualny: para zrzutów PL na realnym komponencie) · R6 (raport, propozycje do akceptu, pytania do właściciela)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6435` albo `5575` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6435` albo `5575`** (`Z7`).

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

Dyżur 354 zrobił dobrą robotę i został scalony. Naprawił **20 literałów** w
`src/components/DiscoveryTools/toolCompletion.ts`: 2 o identycznych gałęziach warunku języka
(`isPolish ? 'X' : 'X'`) i 18 hybryd (gałąź polska trzymała angielskie słowo). Polskie nazwy
wziął **dosłownie z `title.pl` paczek**, nie z własnej głowy. Bezpiecznik dostał pięć dowodów
mutacyjnych — czerwieni się na defekcie, **nie** czerwieni na `'Status'` i `'SWOT'`, czerwieni
przy zerze obiektów, przy złym zakresie i przy zmalałym długu — i **importuje** `justification`
ze `scripts/dev/i18n-pl-audyt.mjs`, zamiast go kopiować.

**★★ A potem odbiorca spojrzał na zrzut i zobaczył kafel „Synteza i napięcia” obok drzewa
„Synteza i wnioski”.** Poszedł głębiej i znalazł dwie rzeczy, których 354 nie objął:

1. **Kształt `namePl:` nie jest skanowany przez bezpiecznik w ogóle**, a plik
   `src/store/useToolStore.ts` **nie leży nawet w zakresie skanu**. Pola `namePl` trzymają
   tam czysty angielski — dokładnie dla tych narzędzi, które 354 naprawiał:
   `Portfolio Items & Matrix`, `Trade-offs & Priorities`, `Ansoff Options Build`,
   `Five Forces Build`, `Outputs & Actions`.
2. **18 z 20 napraw dyżuru 354 nie ma żadnej ochrony regresyjnej.** Ratchet wykrywa tylko
   kształt „obie gałęzie identyczne”. Hybryda — polska gałąź z angielskim słowem — przechodzi
   przez niego bez śladu. Jutro ktoś może cofnąć osiemnaście z dwudziestu napraw i żadna
   bramka tego nie zauważy.

**To nie jest za flagą.** Drzewo faz i nagłówek czytają `namePl` w **ośmiu** miejscach
(`ToolCanvas.tsx:1024`, `:1075`; `ToolDocumentView.tsx:1095`, `:1243`, `:1287`, `:1832`,
`:1930`; `ToolHeader.tsx:203`), bramkuje je wyłącznie `toolType`, a nie flaga. Polski
użytkownik zobaczy angielskie nazwy faz **od razu po scaleniu, bez włączania czegokolwiek**.

## ★★ CZEGO NIE PRZYJMUJESZ NA WIARĘ — trzy liczby ze zlecenia, które mój pomiar zmienił

**(a) „18 pól `namePl` trzyma czysty angielski”.** To liczba odbiorcy, nie moja.
**Mój pomiar daje 23 w `src/store/useToolStore.ts` i 27 w całej `src/`:**

| Plik | Literałów `namePl:` identycznych z sąsiednim `name:` | Uwaga |
| --- | ---: | --- |
| `src/store/useToolStore.ts` | **23** | 20 w czterech rodzinach + `Sizing`, `Backlog`, `Redesign` |
| `src/config/transformationTools.ts` | **3** | `SMED`, `Six Sigma DMAIC`, `Process Mining` — nazwy własne metodyk |
| `src/components/DiscoveryTools/__tests__/toolCanvas.smoke.test.tsx` | **1** | `"Unknown"` — plik testowy |
| **razem `src/`** | **27** | z **331** wszystkich literałów `namePl:` |

**Zmierz to sam.** Jeżeli Twoja liczba jest inna od 23, 27 i 331 — obowiązuje Twoja, a różnicę
zapisujesz wprost. Nie zaczynasz naprawy przed podaniem własnej liczby.

**(b) „kafle bramkuje `toolType === 'dynamic-swot'` w pięciu miejscach `ToolDocumentView.tsx`”.**
**Mój pomiar tego nie potwierdza.** W tym pliku jest **20** wystąpień tego warunku, a funkcja
kafli `computeDynamicSwotPhaseSummaries` ma **dokładnie jedno** wywołanie (linia 529) — i **nie
istnieje jej odpowiednik** dla `market-forces`, `growth-paths`, `portfolio-priority`,
`risk-uncertainty`. W `toolCompletion.ts` są tylko funkcje `computeDynamicSwot*`,
`computeToolReviewGaps` i `computeToolCompletionItems`.

**Konsekwencja dla dowodu wizualnego:** obrazek „polska lista kontrolna obok angielskiego
drzewa” dla czterech rodzin **prawdopodobnie nie istnieje**, bo te narzędzia w ogóle nie
renderują kafli. To, co realnie widzi polski użytkownik, to **angielskie nazwy faz w drzewie
i w nagłówku**. **Sprawdź to sam w `R1` i zbuduj dowód `R5` na tym, co się faktycznie
renderuje** — nie na tym, co napisałem.

**(c) Niezgodność „Synteza i napięcia” / „Synteza i wnioski”** jest realna, ale to **inny
defekt**: obie nazwy są polskie, tylko różne. Kafel bierze
`toolCompletion.ts:156` (`'Synteza i napięcia'`), drzewo bierze
`useToolStore.ts:1400` (`'Synteza i wnioski'`). To jest niezgodność SSOT wewnątrz polszczyzny,
a nie angielszczyzna. **Rozstrzygnij ją osobno i nie wliczaj do liczby z punktu (a).**

## ★ Stan zastany bezpiecznika, zmierzony przeze mnie na markerze `2a7273e087cbd3e44344725b524f6ddd79d5badc`

`scripts/dev/check-etykiety-dwujezyczne.mjs`:

| Cecha | Wartość zmierzona | Czego NIE obejmuje |
| --- | --- | --- |
| zakres skanu | `src/components/DiscoveryTools`, `src/toolPacks` | **`src/store/useToolStore.ts`**, `src/config/**`, reszta `src/` |
| wzorzec | ternary `(isPolish\|isPL\|lang===pl\|…) ? 'x' : 'y'` | **kształt `namePl: '…'`**, kształt obiektu `{ pl, en }` |
| co uznaje za defekt | `pl === en` **i** `justification(pl) === null` | **hybrydę** — `pl !== en`, ale `pl` jest angielskie |
| plik bazowy | `maxUnjustifiedIdentical: 4`, `minFiles: 150`, `minTernaries: 300` | — |
| bieżący przebieg | pliki **162**, ternary **350**, nieuzasadnione **4**, `exit 0` | — |

Cztery obecne nieuzasadnione to `SWOTCorrelationsStep.tsx:90,94,98,101`
(`Attack` / `Repair` / `Defend` / `Protect`) — 354 zapisał je jako **propozycje do akceptu
właściciela**, nie jako defekty do cichej naprawy. **Nie ruszasz ich bez decyzji właściciela.**

## ★★ Pułapka arytmetyczna, którą musisz rozwiązać ZANIM rozszerzysz zakres

Rozszerzenie skanu na całą `src/` wciągnie do licznika także wartości, których polskość jest
sporna. `justification()` (zaimportowany, nie kopiowany) zwraca:

| Wartość | `justification()` | Co to znaczy |
| --- | --- | --- |
| `SMED` | `"skrót lub kod techniczny"` | **UZASADNIONE** — nie liczy się do długu |
| `SWOT` | `"skrót lub kod techniczny"` | **UZASADNIONE** |
| `Status` | `"poprawny polski internacjonalizm"` | **UZASADNIONE** |
| `Six Sigma DMAIC` | `null` | **NIEUZASADNIONE** — wpadnie do licznika |
| `Process Mining` | `null` | **NIEUZASADNIONE** |
| `Sizing`, `Backlog`, `Redesign` | `null` | **NIEUZASADNIONE** |
| `Portfolio Items & Matrix`, `Five Forces Build`, `Outputs & Actions` | `null` | **NIEUZASADNIONE** — i słusznie |

**Progu `maxUnjustifiedIdentical: 4` nie wolno podnieść.** Masz trzy uczciwe wyjścia i musisz
wybrać jedno, uzasadniając wybór:

- **naprawić** wartość (jeśli polski odpowiednik istnieje w paczce);
- **uzasadnić** ją, dopisując do mapy `exact` w `scripts/dev/i18n-pl-audyt.mjs` —
  **i wtedy wypisujesz każdą dopisaną wartość z nazwy w raporcie**, bo to jest jedyne miejsce,
  w którym da się uciszyć realny defekt bez śladu;
- **oddzielić licznik** — osobne, jawnie nazwane pole bazowe dla nowego kształtu, z pisemnym
  uzasadnieniem, dlaczego to nie jest obejście ratcheta.

**Czwartego wyjścia — podniesienia progu — nie ma.**

## ★ Zmierz moje liczby sam

Twierdzę, na markerze:

- literałów `namePl:` w `src/`: **331**; identycznych z sąsiednim `name:`: **27**;
- w `src/store/useToolStore.ts`: **23** (nie 18 — to liczba odbiorcy);
- z tego **20** w czterech rodzinach (`PORTER_STEPS`, `GROWTH_PATHS_STEPS`,
  `PORTFOLIO_PRIORITY_STEPS`, `RISK_UNCERTAINTY_STEPS`) i **3** jednowyrazowe
  (`Sizing`, `Backlog`, `Redesign`);
- polskich odpowiedników w paczkach: **20 z 20** — po pięć `title.pl` w każdej z czterech paczek;
- miejsc renderujących `step.namePl`: **8**, z czego jedno (`ToolDocumentView.tsx:1930`)
  ma naprawę per wywołanie dla trzech identyfikatorów faz;
- wystąpień `toolType === 'dynamic-swot'` w `ToolDocumentView.tsx`: **20** (zlecenie mówiło o pięciu);
- wywołań `computeDynamicSwotPhaseSummaries`: **1**; funkcji kafli dla pozostałych czterech
  narzędzi: **0**;
- bezpiecznik na markerze: **162 pliki / 350 ternary / 4 nieuzasadnione**, `exit 0`;
- liście słowników: **pl 35199**, **en 33066**; cztery bezpieczniki kończą się kodem **0**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: DEFINICJA · MAPA · RENDERER · PACZKA · BEZPIECZNIK · TESTY · HARNESS · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest
**ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Definicja faz (SSOT runtime)** | `src/store/useToolStore.ts` — wyłącznie pola `namePl:` w tablicach `*_STEPS` | **★ PEŁNA LICENCJA NA ZMIANĘ WARTOŚCI `namePl`**, pod warunkiem że każda nowa wartość ma wskazane źródło `title.pl` w paczce (`plik:linia`). **Zakaz zmiany `id`, `name`, `description`, `descriptionPl`, `required`, `aiAssisted` i całej reszty pliku** | — |
| **Mapa `toolType` → kroki** | `src/store/useToolStore.ts:2740-2790`, `getStepDefinitions()` | **TYLKO ODCZYT** — to jest wołacz, który dowodzi żywotności; nie zmieniasz go | Opis w raporcie |
| **Paczki (źródło polszczyzny)** | `src/toolPacks/packs/*.pack.ts`, `src/toolPacks/contract.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** To jest źródło prawdy; dopasowujesz kod do paczki, nigdy odwrotnie | Cytat `plik:linia` + brief |
| **Renderery `namePl`** | `src/components/DiscoveryTools/ToolCanvas.tsx`, `ToolDocumentView.tsx`, `ToolHeader.tsx` | **★ WĄSKA LICENCJA:** wolno **usunąć nakładkę per wywołanie** w `ToolDocumentView.tsx:1930`, jeżeli `R4` naprawi definicję — i **wyłącznie** razem z dowodem, że wszystkie osiem miejsc pokazuje tę samą polską nazwę. Zakaz jakiejkolwiek innej zmiany w tych plikach | Brief z `plik:linia` + diff **nienałożony** |
| **Kafle listy kontrolnej** | `src/components/DiscoveryTools/toolCompletion.ts` | **★ WĄSKA LICENCJA POD WARUNKIEM `R1`:** wolno ujednolicić `'Synteza i napięcia'` (linia 156) z drzewem **albo odwrotnie** — ale **tylko po rozstrzygnięciu, która nazwa jest kanoniczna**, ze wskazaniem `title.pl` paczki `dynamicSwot`. Zakaz zmiany logiki liczenia | Brief |
| **Bezpiecznik etykiet** | `scripts/dev/check-etykiety-dwujezyczne.mjs`, `scripts/dev/check-etykiety-dwujezyczne.baseline.json` | **★ PEŁNA LICENCJA NA ROZSZERZENIE** o kształt `namePl:` i o zakres skanu. **Zakaz podniesienia `maxUnjustifiedIdentical` i obniżenia `minFiles`/`minTernaries`** | — |
| **Słownik uzasadnień** | `scripts/dev/i18n-pl-audyt.mjs` | **★ WĄSKA LICENCJA:** wolno dopisać do mapy `exact` wyłącznie nazwy własne, akronimy i standardy — **każda dopisana wartość wypisana z nazwy w raporcie**, do przeglądu właściciela. Zakaz zmiany `justification()` w sposób, który przepuszcza całe klasy wartości | Brief |
| **Testy bezpiecznika** | `tests/unit/i18n/checkEtykietyDwujezyczne.test.ts` | **★ PEŁNA LICENCJA na rozszerzenie** o przypadki nowego kształtu | — |
| **Nowe testy** | `tests/**` (nowe pliki, `git add -f`) | **★ PEŁNA LICENCJA.** **Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`** — `src/store/__tests__/swotStepLocale.test.ts` jest zastanym wyjątkiem i nie powielasz tego wzorca | — |
| **Zastany test lokalizacji kroków** | `src/store/__tests__/swotStepLocale.test.ts` | **★ WĄSKA LICENCJA:** wolno **rozszerzyć asercje** o pozostałe rodziny, jeżeli uznasz to za najkrótszą drogę do ochrony; **zakaz osłabienia istniejących asercji** | — |
| **Harness (dev-render)** | `dev-render/main.tsx`, `dev-render/screens/**` | **★ WĄSKA LICENCJA:** wolno dodać **jeden** nowy wpis `SCREENS` montujący **realny** komponent produktu (wzór: `tools-swot-session-workspace`, który montuje realny `ToolDocumentView`) z innym `toolType`. **Zakaz atrapy zamiast komponentu produktu i zakaz zmiany istniejących wpisów** | Opis w raporcie, jeżeli nie da się dodać |
| **Narzędzie zrzutów** | `scripts/dev/grafika-zrzuty.mjs` | **NIETYKALNE DO ZAPISU.** Wolno **wołać** z istniejącymi opcjami. ★ Zakaz własnego skryptu zrzucającego obok kanonicznego | Opis w raporcie |
| **Słowniki** | `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **NIETYKALNE DO ZAPISU.** Liście nie mogą zmaleć **ani urosnąć** od tego dyżuru | Opis w raporcie |
| **Serwer** | `server/**` | **TYLKO ODCZYT** | Brief |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`** | Opis w raporcie |
| **Dowody** | `evidence/etykiety-namepl-20260904/**` (**katalog NIE ISTNIEJE na markerze — tworzysz go**) | **★ PEŁNA LICENCJA na tworzenie**; commitujesz przez `git add -f` | — |
| **Dowody 354** | `evidence/etykiety-narzedzi-20260904/**` | **TYLKO ODCZYT — BEZWZGLĘDNIE.** To baza porównania | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU — ŻADEN wiersz, ŻADEN moduł**, w tym `03_TOOLS` | Rekomendacja w raporcie |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze** (`AA`, `AB`, …), sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY364_NAMEPL_RODZINA_REPORT.md` (**NOWY**) | `R6` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `evidence/g15/**` i wszystko wokół bramki `G15` (dyżur 363) · `src/components/standard/StandardPreview.tsx`, `scripts/dev/grafika-zrzuty.mjs`, `evidence/podglad-relations-20260904/**` (dyżur 365) · `tests/unit/assessment/day351.assessmentCompleteness.test.ts`, `server/src/routes/assessment/assessment-hub.routes.ts`, `server/src/services/legacyCutover/**` (dyżur 366) · wiersze macierzy i rejestry bramek (dyżury 359-362) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC ANI UROSNAC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35199, en 33066

# (b) cztery bezpieczniki kanonu maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: wszystkie 0

# (c) bezpiecznik etykiet — PRZED i PO
node scripts/dev/check-etykiety-dwujezyczne.mjs; echo "etykiety=$?"
#   moje liczby przy wydaniu: pliki=162, ternary=350, nieuzasadnione=4, exit 0
```

**Jeżeli którakolwiek liczba zmaleje albo bramka zaczerwieni się od Twojej zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | literałów `namePl:` w `src/` | `331` | komenda (1) z `§0.3` | TAK — całe drzewo `.ts`/`.tsx`, nie jeden plik |
| 2 | identycznych z sąsiednim `name:` | `27` | komenda (1) | TAK — porównuje z NAJBLIŻSZYM poprzedzającym `name:` |
| 3 | z tego w `useToolStore.ts` | `23` | komenda (1) | TAK — **obala liczbę 18 ze zlecenia; zmierz sam** |
| 4 | czterech rodzin / jednowyrazowych | `20` / `3` | komenda (2) | TAK |
| 5 | polskich odpowiedników w paczkach | `20` | komenda (4) | TAK — po `id` fazy, nie po `name` |
| 6 | zakres i wzorzec bezpiecznika | 2 katalogi / 1 kształt | komenda (3) | TAK — **to jest dowód luki, nie opinia** |
| 7 | stan bezpiecznika na markerze | `162 / 350 / 4` | komenda (3) | TAK |
| 8 | wystąpień `toolType === 'dynamic-swot'` | `20` | komenda (5) | TAK — **obala „pięć miejsc” ze zlecenia** |
| 9 | wywołań funkcji kafli | `1`, brak odpowiedników | komenda (5) | TAK — **obala tezę o kaflach czterech rodzin** |
| 10 | miejsc renderujących `step.namePl` | `8` | komenda (6) | TAK — **to jest rodzina wołaczy** |
| 11 | liczba naprawionych etykiet PO | — | własny przemiar `R4`, po NAZWACH | TAK — `Z37` |
| 12 | liście słowników PL/EN | `35199` / `33066` | blok (a) „WARUNKÓW WSPÓLNYCH” | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY364_NAMEPL_RODZINA_REPORT.md` ·
`evidence/etykiety-namepl-20260904/**` (nowy katalog) ·
`scripts/dev/check-etykiety-dwujezyczne.mjs` (+ plik bazowy) ·
`tests/unit/i18n/checkEtykietyDwujezyczne.test.ts`.

**Zapisujesz WARUNKOWO:**
`src/store/useToolStore.ts` (wyłącznie wartości `namePl`) ·
`src/components/DiscoveryTools/toolCompletion.ts` (wyłącznie po rozstrzygnięciu `R1`) ·
`src/components/DiscoveryTools/ToolDocumentView.tsx` (wyłącznie nakładka `:1930`) ·
`scripts/dev/i18n-pl-audyt.mjs` (wyłącznie mapa `exact`, każda wartość wypisana w raporcie) ·
`src/store/__tests__/swotStepLocale.test.ts` (wyłącznie rozszerzenie asercji) ·
`dev-render/main.tsx` + jeden nowy plik w `dev-render/screens/` ·
nowe pliki testowe w `tests/` (`git add -f`) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `public/locales/**`, `server/**`, `src/toolPacks/**`,
`src/components/DiscoveryTools/tools/DynamicSWOT/SWOTCorrelationsStep.tsx` (cztery propozycje
czekają na decyzję właściciela), `scripts/dev/grafika-zrzuty.mjs`, `tests/setup.ts`,
`tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`,
`.github/workflows/**`, `server/migrations/**`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (**wszystkie 16**),
`evidence/etykiety-narzedzi-20260904/**`, `evidence/g15/**`,
`evidence/podglad-relations-20260904/**`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day364-namepl-rodzina
git diff --name-only --cached | tee /private/tmp/cx-day364-namepl-rodzina-artefakty/staged.txt
bash -c "grep -iE '^public/locales/|^server/|^src/toolPacks/|SWOTCorrelationsStep|grafika-zrzuty|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|MODULE_ACCEPTANCE|etykiety-narzedzi-20260904|evidence/g15|podglad-relations' /private/tmp/cx-day364-namepl-rodzina-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — CZTERY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Własna liczba przed pierwszą naprawą.** Podajesz swój pomiar rodziny `namePl:` w całej
`src/` — trzy liczby: wszystkich literałów, identycznych z `name:`, i tych w `useToolStore.ts`.
Dopiero potem wolno Ci cokolwiek zmienić. **Liczba 18 ze zlecenia i liczba 23 z tej instrukcji
są cudze; obowiązuje Twoja.**

**(2) Polska nazwa pochodzi z paczki albo jest propozycją.** Dla każdej naprawionej etykiety
podajesz `plik:linia` w `src/toolPacks/packs/*.pack.ts`, z którego wzięła się nazwa.
Nie ma źródła → nie ma naprawy; jest **propozycja do akceptu właściciela** w osobnej tabeli.

**(3) Próg bezpiecznika jest nietykalny.** `maxUnjustifiedIdentical: 4` nie rośnie,
`minFiles: 150` i `minTernaries: 300` nie maleją. Rozszerzenie zakresu, które podnosi licznik
długu, rozwiązujesz naprawą, uzasadnieniem albo osobnym licznikiem — nigdy progiem.

**(4) Naprawa idzie do DEFINICJI, nie do wołacza.** `ToolDocumentView.tsx:1930` już raz
zamaskował „Outputs & Actions” w jednym z ośmiu miejsc. Ten kształt odrasta.

**Wymagany dowód:** cztery zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — WŁASNY POMIAR CAŁEJ RODZINY I WERYFIKACJA TEZY O KAFLACH (rdzeń)

**KROK 0 — wypisz rodzeństwo, zanim cokolwiek naprawisz.**

1. **Policz kształt `namePl:` w CAŁEJ `src/`** (nie w jednym pliku). Zapisz tabelę
   `evidence/etykiety-namepl-20260904/r1-rodzina.tsv`: plik · linia · `name` · `namePl` ·
   `IDENTYCZNE`/`RÓŻNE` · czy w `namePl` są polskie znaki diakrytyczne · `justification()`.
   **Podaj trzy liczby i porównaj je z moimi (331 / 27 / 23).**
2. **Policz drugi kształt tej samej rodziny:** obiekt `{ pl: '…', en: '…' }` w paczkach
   i w `ToolDocumentView.tsx`. Powiedz, ile z nich trzyma identyczne wartości i ile z tego
   jest uzasadnionych.
3. **Zweryfikuj tezę o kaflach.** Policz wystąpienia `toolType === 'dynamic-swot'`
   w `ToolDocumentView.tsx`, wywołania `compute*PhaseSummaries` i funkcje `compute*`
   w `toolCompletion.ts`. **Odpowiedz wprost na jedno pytanie: czy narzędzia
   `market-forces`, `growth-paths`, `portfolio-priority`, `risk-uncertainty` renderują
   kafle listy kontrolnej — TAK czy NIE.** Od tej odpowiedzi zależy kształt dowodu `R5`.
4. **Wypisz osiem miejsc renderujących `step.namePl`** i zaznacz, które z nich mają nakładkę
   per wywołanie. To jest rodzina wołaczy i naprawa ma objąć wszystkie osiem naraz.
5. **Rozstrzygnij niezgodność „Synteza i napięcia” / „Synteza i wnioski”.** Podaj, która
   z dwóch nazw ma pokrycie w `title.pl` paczki `dynamicSwot`, i zapisz to jako osobne
   znalezisko — **nie wliczaj go do liczby z punktu 1**.

**Wymagany dowód:** `r1-rodzina.tsv` z trzema liczbami · lista rozbieżności wobec 331/27/23/20/5 ·
jednoznaczna odpowiedź TAK/NIE o kaflach czterech rodzin · tabela ośmiu wołaczy ·
rozstrzygnięcie niezgodności SWOT. **Commit po `R1`.**

## R2 — BEZPIECZNIK: DRUGI KSZTAŁT, SZERSZY ZAKRES, MUTACJA W OBIE STRONY (rdzeń)

1. **Rozszerz `scripts/dev/check-etykiety-dwujezyczne.mjs`** o kształt `namePl:` (pole
   porównywane z najbliższym poprzedzającym `name:`) i o zakres obejmujący
   `src/store/useToolStore.ts`. Zakres podajesz **jawnie w kodzie**, nie przez „całe `src/`
   i zobaczymy” — a jeżeli wybierzesz całe `src/`, to musisz rozstrzygnąć wszystkie wartości
   z tabeli pułapki arytmetycznej wyżej.
2. **`justification` importujesz**, nigdy nie kopiujesz — tak jak zrobił 354.
3. **Podłoga liczebności musi objąć nowy kształt.** Dziś są dwie (`minFiles`, `minTernaries`).
   Dodaj trzecią — minimalną liczbę zeskanowanych literałów `namePl:` — bo inaczej bezpiecznik
   przechodzi, gdy przestanie cokolwiek znajdować. **„Brak pomiaru nie jest wynikiem.”**
4. **DOWÓD MUTACYJNY W OBIE STRONY**, obowiązkowy, w tym samym commicie:
   - **czerwieni się na defekcie:** wstaw do dowolnej tablicy `*_STEPS` nową parę
     `name: 'Some English Phrase'` / `namePl: 'Some English Phrase'` → bezpiecznik ma
     **zakończyć się kodem 1** i wypisać `plik:linia`;
   - **NIE czerwieni się na uzasadnionej identyczności:** `SMED`, `SWOT`, `Status` mają
     przejść (`justification()` zwraca dla nich powód) → bezpiecznik **kod 0**;
   - **czerwieni się przy zerze obiektów:** ustaw zakres na katalog bez plików → **kod 1**
     (podłoga liczebności), nie „OK, nic nie znalazłem”;
   - **czerwieni się przy zmalałym długu bez obniżenia bazy** — jeżeli Twój ratchet ma tę
     własność, pokaż ją; jeżeli nie ma, napisz to wprost.
   Każdą mutację cofasz przez `cp` ze `SCRATCH` (nigdy `git stash`, `Z27`); `git diff` po
   cofnięciu **pusty**. Obie komendy i oba wyniki **dosłownie** w raporcie.
5. **Rozszerz test bezpiecznika** `tests/unit/i18n/checkEtykietyDwujezyczne.test.ts`
   o przypadki nowego kształtu. **Asercja na ZACHOWANIU** (kod wyjścia, treść komunikatu),
   **nigdy na tekście źródła skryptu** — ten drugi kształt przepuścił już dziś dwie mutacje
   w innym dyżurze.

**Wymagany dowód:** diff bezpiecznika · nowy plik bazowy z jawnym progiem · cztery mutacje
z dosłownymi komendami i wynikami · `git diff` pusty po każdym cofnięciu · wynik testu
bezpiecznika PRZED i PO. **Commit po `R2`.**

## R3 — DOMKNIĘCIE OCHRONY OSIEMNASTU NAPRAW Z DYŻURU 354

**To jest znane niedomknięcie, zapisane wprost w raporcie 354: ratchet widzi wyłącznie
kształt „obie gałęzie identyczne”, więc 18 z 20 wczorajszych napraw nie ma dziś żadnej
ochrony regresyjnej.**

1. Wypisz **te 18 literałów z nazwy** (źródło: `evidence/etykiety-narzedzi-20260904/r1-inwentarz.md`,
   **TYLKO ODCZYT**) i dla każdego podaj, co dziś by się stało, gdyby ktoś cofnął naprawę.
2. Zbuduj ochronę **kształtu hybrydy**: gałąź polska trzymająca wartość, która nie ma ani
   jednego polskiego znaku diakrytycznego **i** ma pokrycie w `title.pl` paczki jako inna
   wartość. To jest wykonalne mechanicznie i nie wymaga słownika języka.
3. **Dowód mutacyjny:** cofnij **jedną** z osiemnastu napraw (przez `cp`, nie `git revert`)
   → nowa ochrona ma **zaczerwienić się i wskazać `plik:linia`**; przywróć → **zielona**;
   `git diff` pusty.
4. Jeżeli uznasz, że mechanicznej ochrony dla hybrydy nie da się zbudować bez fałszywych
   alarmów — **piszesz to wprost, z przykładem fałszywego alarmu**, i to też jest wynik.
   Nie budujesz ochrony, która czerwieni się na `Raport / Deck`.

**Wymagany dowód:** lista 18 nazw · opis mechanizmu ochrony · mutacja w obie strony
z dosłownymi komendami · albo pisemne uzasadnienie, dlaczego mechaniczna ochrona jest
niewykonalna, z konkretnym przykładem. **Commit po `R3`.**

## R4 — NAPRAWA Z PACZEK, PO `id` FAZY, CAŁA RODZINA NARAZ (rdzeń)

1. **Zbuduj mapę `id` fazy → `title.pl`** z czterech paczek
   (`marketForces`, `growthPaths`, `portfolioPriority`, `riskUncertainty`).
   **★ Mapujesz po `id`, nigdy po `name`** — paczka `riskUncertainty` ma
   `en: 'Mission & Context'`, a `useToolStore` `name: 'Risk Mission & Context'`;
   mapowanie po nazwie da złe pary i nikt tego nie zauważy na zrzucie.
2. **Podmień wartości `namePl`** w `PORTER_STEPS`, `GROWTH_PATHS_STEPS`,
   `PORTFOLIO_PRIORITY_STEPS`, `RISK_UNCERTAINTY_STEPS`. **Nic poza polem `namePl`.**
3. **Rozstrzygnij osobno `Sizing`, `Backlog`, `Redesign`** (`RPA_SCANNER_STEPS`,
   `PROCESS_AUTOMATION_STEPS`) oraz `Six Sigma DMAIC`, `Process Mining`
   (`src/config/transformationTools.ts`). Dla każdej z tych pięciu wartości podajesz jedną
   z trzech decyzji: **naprawiona z paczki** (z `plik:linia`), **uzasadniona** (dopisana do
   `exact`, wypisana z nazwy w raporcie), albo **propozycja do akceptu właściciela**
   (osobna tabela, wzór z raportu 354). **`SMED` jest już uzasadniony przez `justification()`
   — nie ruszasz go.**
4. **Nakładka per wywołanie.** Po naprawie definicji sprawdź, czy
   `ToolDocumentView.tsx:1930` (`isOutputs ? 'Wyniki i działania' : step.namePl`) jest jeszcze
   potrzebna. Jeżeli nie — usuń ją **razem z dowodem**, że wszystkie osiem miejsc pokazuje tę
   samą nazwę. Jeżeli tak — napisz dlaczego.
5. **Przemiar po naprawie**: uruchom bezpiecznik i celowany pakiet testowy; podaj
   `numTotalTests`, nie tylko `numFailedTests`. `No test files found` i `Transform failed`
   to **BŁĄD KOMENDY**, nie PASS. Porównaj **listy pełnych nazw** przed i po — żadna nazwa
   nie ma zniknąć.
6. **`npx esbuild`** na każdym zmienionym pliku `.ts`/`.tsx` — `Transform failed` jest błędem
   komendy, nie wynikiem.

**Wymagany dowód:** tabela „`id` fazy → `title.pl` → nowa wartość `namePl`” dla całej rodziny ·
decyzja per każda z pięciu wartości spornych · rozstrzygnięcie nakładki `:1930` ·
`diff` list pełnych nazw testów przed/po · wynik `esbuild`. **Commit po `R4`.**

## R5 — DOWÓD WIZUALNY: POLSKI UŻYTKOWNIK WIDZI POLSKIE NAZWY

**★ Kształt tego dowodu zależy od odpowiedzi z `R1` punkt 3.** Jeżeli cztery rodziny nie
renderują kafli — dowodzisz **drzewa faz i nagłówka**, nie kafli. Nie udajesz obrazka,
którego w produkcie nie ma.

1. **Wejście harnessu.** Wzór: `tools-swot-session-workspace` w `dev-render/main.tsx`, który
   montuje **realny** `ToolDocumentView`. Dodaj **jeden** analogiczny wpis z `toolType`
   jednej z czterech rodzin (rekomendacja: `portfolio-priority` — ma najwięcej angielskich
   etykiet). **Zakaz atrapy zamiast komponentu produktu.**
2. **Zrzuty kanonicznym harnessem** `scripts/dev/grafika-zrzuty.mjs` na porcie `5575`:
   para PRZED/PO, **oba motywy**, `pl`, **sekcje ROZWINIĘTE**. **Zakaz własnego skryptu
   zrzucającego obok kanonicznego** — doraźny skrypt dał już raz parę identycznych obrazów
   i zameldował sukces.
3. **Kontrola pary:** suma kontrolna SHA-256 i średnia jasność każdego pliku.
   **Para bajtowo identyczna = ZERO dowodu** — jeżeli PRZED i PO wyjdą identyczne, to znaczy,
   że zmiana nie dotarła do renderowanego DOM-u, i **piszesz to wprost zamiast zaliczać parę**.
   Kontrola jasności: `light` znacznie jaśniejszy od `dark` (para o zbliżonej jasności to ten
   sam obraz pod dwiema nazwami).
4. **Liczebność z uchwytu DOM**, nie z oka: policz elementy drzewa faz i wypisz ich teksty
   z DOM-u, do JSON-a obok zrzutu.
5. **★ OBEJRZYJ KADRY WŁASNYMI OCZAMI** i napisz jedno zdanie per zrzut: co widzisz.
   Nie „testy przeszły”, tylko „na PO-light drzewo faz pokazuje pięć polskich nazw:
   … , … , … , … , …”. Jeżeli zobaczysz coś złego — mówisz to, nawet jeżeli liczby są zielone.
6. **Kontrola przyrządu:** porównaj, co jest hostem harnessu, a co produktem. Trzy z sześciu
   „defektów wysokości” w innym dyżurze okazały się przyrządem, nie produktem.

**Wymagany dowód:** para zrzutów w obu motywach z SHA-256 i średnią jasnością ·
JSON z tekstami z uchwytu DOM · jedno zdanie oględzin per kadr · jawne stwierdzenie,
czy para jest różna bajtowo. **Commit po `R5`.**

## R6 — RAPORT, PROPOZYCJE I PYTANIA DO WŁAŚCICIELA

Raport zawiera: własne trzy liczby z `R1` i listę rozbieżności wobec 18/23/27/331/5 ·
jednoznaczną odpowiedź TAK/NIE o kaflach czterech rodzin · opis rozszerzenia bezpiecznika
z `R2` i **cztery mutacje dosłownie** · rozstrzygnięcie ochrony osiemnastu napraw z `R3` ·
tabelę naprawy z `R4` z `plik:linia` źródła każdej polskiej nazwy · dowód wizualny z `R5`
z oględzinami · **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE”** · obowiązkowy akapit
`§0.2e` dla każdego uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „PROPOZYCJE DO AKCEPTU WŁAŚCICIELA”** — tabela w formacie
z raportu 354: `plik:linia` · obecny PL · obecny EN · proponowany PL · dlaczego nie ma
w paczce. Tu trafia wszystko, czego nie da się wziąć dosłownie z `title.pl`.

★★ **Osobna, obowiązkowa sekcja: „CO DOPISAŁEM DO `exact`”** — każda wartość z nazwy,
z jednozdaniowym uzasadnieniem. Sekcja może być pusta, ale wtedy piszesz wprost:
„nie dopisałem nic”. **To jest jedyne miejsce, w którym da się uciszyć realny defekt bez
śladu, więc ślad jest obowiązkowy.**

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA”.** Kandydaci: czy `Backlog`
i `Sizing` mają zostać po angielsku jako terminy branżowe; która nazwa fazy syntezy SWOT
jest kanoniczna. Sekcja może być pusta, ale wtedy piszesz wprost: „nie mam zastrzeżeń”.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sekcje doszły dziś do `Z`, więc następne idą
`AA`, `AB`, …; sprawdź komendą
`bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle piszą inni autorzy.

**Commit po `R6`.**

## Próg odbioru

**Własna liczba, para zrzutów narzędzia pokazująca polskie nazwy faz na realnym komponencie
produktu, i bezpiecznik obejmujący OBA kształty — `pl === en` oraz hybrydę — z dowodem
mutacyjnym w obie strony: czerwieni się na defekcie, NIE czerwieni na uzasadnionej
identyczności.**

Odbiorca odrzuci dyżur, w którym: liczba pochodzi z instrukcji zamiast z pomiaru; polska
nazwa pochodzi z głowy wykonawcy zamiast z paczki; próg bezpiecznika został podniesiony;
para zrzutów jest bajtowo identyczna i mimo to zaliczona; naprawiono definicję, ale nie
sprawdzono ośmiu wołaczy; albo dopisano coś do `exact` bez wypisania tego z nazwy.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „rodzina policzona na 27
w całej `src/`, bezpiecznik rozszerzony i udowodniony mutacyjnie, naprawa nie wykonana,
bo pięć wartości wymaga decyzji właściciela” — **jest pełnowartościowym wynikiem**, o ile
te pięć wartości jest wypisane z nazwy.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „18 pól trzyma angielski” vs „mój pomiar daje 23” | `R0` (1) i `R1`: obowiązuje pomiar wykonawcy; obie cudze liczby są jawnie oznaczone jako cudze |
| „Zrób zrzut kafli” vs „cztery rodziny nie renderują kafli” | `R1` punkt 3 i `R5`: kształt dowodu zależy od zmierzonej odpowiedzi TAK/NIE; dowodzisz tego, co się renderuje |
| „Rozszerz zakres bezpiecznika” vs „nie wolno podnieść progu” | Sekcja „pułapka arytmetyczna” i `R0` (3): trzy uczciwe wyjścia (naprawa, uzasadnienie, osobny licznik); czwartego nie ma |
| „Dopisz do `exact`” vs „to jest sposób na uciszenie defektu” | Tabela licencji i `R6`: wąska licencja **plus** obowiązkowa sekcja z każdą wartością z nazwy |
| „Naprawa do definicji” vs „w `:1930` jest nakładka” | `R0` (4) i `R4` punkt 4: nakładka znika **razem z dowodem** na wszystkich ośmiu wołaczach albo zostaje z uzasadnieniem |
| „Paczki są SSOT” vs „potrzebna nazwa, której w paczce nie ma” | `R0` (2) i `R6`: brak źródła ⇒ **propozycja do akceptu właściciela**, nie naprawa |
| „`SWOTCorrelationsStep` ma cztery nieuzasadnione” vs „licznik ma nie rosnąć” | Tabela licencji: te cztery są zastanym długiem z propozycją 354 i **czekają na decyzję właściciela**; nie ruszasz ich i nie liczysz jako swoich |
| „Zrzuty w obu motywach” vs „para identyczna = zero dowodu” | `R5` punkt 3: identyczna para jest **wynikiem negatywnym do zapisania**, nie parą do zaliczenia |
| „Dodaj wejście harnessu” vs „harness jest przyrządem, nie produktem” | Tabela licencji i `R5` punkt 6: wpis musi montować **realny** komponent produktu, a raport ma odróżnić hosta od produktu |
| „Nie zmieniaj słowników” vs „naprawiasz polskie napisy” | Tabela licencji: te napisy żyją w `.ts`, nie w `translation.json`; liście PL/EN mają zostać bez zmian |
| „Aktualizuj macierz” vs „macierz nietykalna” | Sekcja o dokumentach: bramkami zajmują się dyżury 359-362; Twoim produktem jest rekomendacja |
| „Dopisz sekcję do rejestru znalezisk” vs „równolegle piszą inni autorzy” | `R6`: literę sprawdzasz komendą tuż przed commitem; sekcje doszły do `Z`, następne to `AA`, `AB` |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 12 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — `useToolStore.ts`, cztery paczki, trzy renderery, bezpiecznik + plik bazowy, jego test, wpis `tools-swot-session-workspace`, dowody 354 sprawdzone; `evidence/etykiety-namepl-20260904/` **jawnie oznaczony jako nieistniejący** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1-10 i 12 zmierzone przy wydaniu na markerze |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — definicja · mapa · paczki · renderery · kafle · bezpiecznik · słownik uzasadnień · testy bezpiecznika · nowe testy · zastany test · harness · narzędzie zrzutów · słowniki · serwer · infrastruktura testów · dowody · dowody 354 · macierz · rejestr znalezisk · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` mierzy, `R2`-`R3` budują bezpiecznik, `R4` naprawia definicję, `R5` dowodzi wzrokiem, `R6` składa |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6435/5575 wolne (`lsof` przy wydaniu), brak kontenera `cx-day364-pg`, brak gałęzi `codex/day364-*` i worktree; 363/365/366 mają rozłączne porty i pliki; paczka 359-362 ma zarezerwowany przedział 6430-6433/5570-5573 i rozłączny temat |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: klucz istnieje ≠ przetłumaczony, bezpiecznik nie widzi kształtu ani pliku, arytmetyka progu, mapowanie po `name`, naprawa per wywołanie, obalona teza o kaflach, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany”, zero pól szablonu | TAK — kontrola generatora przy wydaniu |
