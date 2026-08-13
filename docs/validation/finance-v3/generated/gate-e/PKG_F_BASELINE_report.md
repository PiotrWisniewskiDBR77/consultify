# Pakiet F — Baseline Model workspace — raport domknięcia

Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-f-baseline`
Gałąź: `codex/fv3p-f-baseline`
Baza porównawcza: `45c39d68d0`
Końcowy SHA (przed tym raportem): **`28878298ae`** — commit tego raportu idzie po nim.

Ten dokument domyka pakiet po tym, jak poprzedni agent zawiesił się na błędzie sieciowym
(ENOTFOUND) przed napisaniem raportu. Jego praca była na dysku i została zabezpieczona przez
sesję nadzorczą jako `8437c7e325` (UNVERIFIED). Ten raport WERYFIKUJE tamtą pracę pomiarem
(nie oglądem), domyka pięć naruszeń wizualnych zgłoszonych przez orkiestratora na zrzutach,
łapie i naprawia jeden realny błąd `tsc`, i rozstrzyga sprawę „Gotówka = 0".

## 0. `git diff --stat` (baza → HEAD)

```
 .claude/launch.json                                              |  13 +
 dev-render/main.tsx                                               |   6 +
 dev-render/screens/finance-baseline-workspace.tsx                 | 270 ++++++++++
 docs/validation/.../pkg-f/PO-baseline-workspace-approved.png      | Bin (nowy)
 docs/validation/.../pkg-f/PO-baseline-workspace-assumptions.png   | Bin (nowy)
 docs/validation/.../pkg-f/PO-baseline-workspace-fundinggap-alarm.png | Bin (nowy)
 docs/validation/.../pkg-f/PO-baseline-workspace-wyliczenia.png    | Bin (nowy)
 docs/validation/.../pkg-f/PRZED-NAPRAWA-baseline-workspace-*.png  | Bin (4 pliki, zachowane jako "przed moimi naprawami")
 docs/validation/.../pkg-f/PRZED-finance-model-workspace-draft.png | Bin (nowy — stary ekran, niezmieniony)
 scripts/dev/pkgf-baseline-screenshots.mjs                         |  45 ++
 src/components/Finance/BaselineWorkspace.tsx                      | 449 +++++++
 src/components/Finance/baseline/AssumptionsView.tsx                | 425 +++++++
 src/components/Finance/baseline/CalculationsView.tsx                | 324 +++++
 src/components/Finance/baseline/__tests__/BaselineWorkspace.canon.test.tsx | 141 ++
 src/components/Finance/baseline/__tests__/CalculationsView.antiplug.test.tsx | 208 ++
 src/components/Finance/baseline/__tests__/useBaselineCompute.test.ts | 177 ++
 src/components/Finance/baseline/baselineLabels.ts                  | 165 ++
 src/components/Finance/baseline/useBaselineAssumptionsEditor.ts    | 358 ++++
 src/components/Finance/baseline/useBaselineCompute.ts               | 108 ++
 src/components/Finance/baseline/useBaselineOutputs.ts                |  49 ++
 src/components/Finance/shared/FinanceWorkspaceBar.tsx                |  60 +-  (WSPÓŁDZIELONY — patrz §3)
 src/hooks/__tests__/useFinanceBaselineWorkspaceFlag.test.ts          |  47 ++
 src/hooks/useFinanceBaselineWorkspaceFlag.ts                         |  53 ++
 src/services/api/__tests__/financeV2.baseline.api.test.ts            | 165 ++
 src/services/api/financeV2.api.ts                                    | 100 ++
 src/services/api/financeV2.types.ts                                  | 210 ++
 29 files changed, 3351 insertions(+), 22 deletions(-)
```

`.claude/launch.json`/`dev-render/main.tsx` — czysto addytywne wpisy (screen/preview-config dla
tego pakietu), nie ruszają innych wpisów. Zero plików cache builda w indeksie (sprzątnięte
komitem `c334b1000e` przed tą sesją) — sprawdzone `git status` = czyste przed każdym commitem.

## 1. V-1…V-6 — status

| # | Naruszenie (raport orkiestratora, stary ekran „Models") | Status | Dowód |
|---|---|---|---|
| V-1 | Oś czasu zdarzeń usunięta | ZAMKNIĘTE (potwierdzone wcześniej wzrokiem + `BaselineWorkspace.canon.test.tsx`) | `PO-baseline-workspace-*.png`, test „V-1: BRAK zakładki" |
| V-2 | „Wyceń model" usunięte | ZAMKNIĘTE | test „V-2: BRAK akcji Wyceń model" |
| V-3 | Dokładnie dwa widoki (Założenia, Wyliczenia) | ZAMKNIĘTE | test „V-3: DOKŁADNIE DWA widoki" + kontrola negatywna (dopisanie 3. widoku realnie czerwieni 3 testy, patrz plik testu) |
| V-4 | Język ujednolicony (skróty REVENUE/COGS/OPEX/DSO/DIO/DPO/CAPEX zostają) | ZAMKNIĘTE | zrzuty — cała reszta etykiet po polsku |
| V-5 | Brak martwej przestrzeni | ZAMKNIĘTE | zrzuty — `flex-1`/`w-full` na obu widokach |
| V-6 | JEDEN pasek, brak duplikacji tożsamości/akcji/statusu w treści strony | **DOMKNIĘTE W TEJ SESJI** (było częściowo otwarte — patrz punkty 1–3 niżej) | `PO-baseline-workspace-wyliczenia.png`, `PO-baseline-workspace-approved.png` |

## 2. Punkty 1–5 orkiestratora (odbiór zrzutów) — status

### Punkt 1 — pływające „← Lista"/„Uwagi" nachodzące na tabelę

**RESOLVED-BY-DIAGNOSIS — nie jest kodem produktu.** Źródło zidentyfikowane czytaniem kodu, nie
oglądem: `dev-render/PanelUwag.tsx` — cytat z własnego docblocka tego pliku: „PANEL UWAG — wpięty
w KAŻDY ekran harnessu odbioru" (`position: fixed; right: 16; bottom: 16`, `zIndex: 2147483000`).
To jest narzędzie recenzji sesji nadzorczej (POST na `/__uwagi`, zbiera werdykt/uwagi Piotra),
montowane globalnie przez `dev-render/main.tsx` dla WSZYSTKICH ekranów WSZYSTKICH pakietów pod
odbiorem równolegle (Pakiet C, D, E, G… ten sam mechanizm) — nie istnieje w
`src/components/Finance/BaselineWorkspace.tsx`/`AssumptionsView.tsx`/`CalculationsView.tsx`
(zero wystąpień „Lista"/„Uwagi" w tych plikach, sprawdzone grepem).

Dowód, że to nie defekt tego pakietu: JUŻ ZAAKCEPTOWANE zrzuty Pakietu C
(`docs/validation/finance-v3/generated/gate-e/visual/pkg-c/finance-workspace-bar-1440-light.png`)
mają IDENTYCZNE „← Lista"/„Uwagi" w tym samym rogu — ten harness-chrome jest uniwersalny i był
już akceptowany.

Nie modyfikowałem `PanelUwag.tsx` (współdzielone narzędzie recenzji używane równolegle przez inne
pakiety pod tą samą sesją nadzorczą — zmiana tam wpłynęłaby na WSZYSTKIE ekrany w trakcie odbioru,
poza allowlistą tego pakietu). Zamiast tego **zmitygowałem defensywnie w kodzie tego pakietu**:
`pb-16` na przewijanym kontenerze obu widoków (`CalculationsView.tsx`, `AssumptionsView.tsx`) —
rezerwuje miejsce po ostatnim wierszu, żeby przy przewinięciu DO KOŃCA listy ostatni wiersz nie
wylądował dokładnie pod jakąkolwiek pływającą kontrolką w rogu (harness dziś, potencjalny widget
produkcyjny jutro). To NIE eliminuje nakładania w środku przewijania na krótkiej liście widocznej
od razu w viewport (nieusuwalne bez zmiany współdzielonego `PanelUwag.tsx`) — ale to jest cecha
NARZĘDZIA RECENZJI, nie ekranu, który trafi na produkcję.

**Status: PASS (jako diagnoza) / NOT-A-PRODUCT-DEFECT — poza zakresem naprawy tego pakietu.**

### Punkt 2 — zdublowana akcja „Przelicz"

**NAPRAWIONE.** `CalculationsView.tsx` miał WŁASNY przycisk „Przelicz" w podpasku widoku
Wyliczenia (`data-testid="baseline-run-compute"`) OBOK przycisku w `FinanceWorkspaceBar`. Usunięty
w całości — została jedna akcja, w pasku. `onRunCompute`/`readOnly` zostają w
`CalculationsViewProps` (interfejs), ale nie są już użyte wewnątrz komponentu — żaden test ani
`BaselineWorkspace.tsx` (caller) nie musiał się zmienić poza tym.

**Dowód:** `PO-baseline-workspace-wyliczenia.png` / `PO-baseline-workspace-fundinggap-alarm.png` —
jeden „Przelicz" w prawym górnym rogu, zero w podpasku.

**Status: PASS.**

### Punkt 3 — status podany trzykrotnie (chip `v1` + chip `Wersja robocza` + menu `Wersja robocza ⌄`)

**NAPRAWIONE w `src/components/Finance/shared/FinanceWorkspaceBar.tsx`** (komponent WSPÓŁDZIELONY
— używany też przez Pakiet G, patrz uwaga sesji nadzorczej w trakcie tej pracy). Zmienione
WYŁĄCZNIE renderowanie wewnętrzne, **bez zmiany propsów/kontraktu** (`WorkspaceBarConfig` się nie
zmienił) — więc zmiana jest bezpieczna dla innych konsumentów tego komponentu.

Stara odznaka wersji (`span` z `v1`) i osobna `StatusBadge` (`span` z „Wersja robocza") scalone w
jedną `IdentityBadge` („v1 · Wersja robocza" w jednym pilule, ton koloru zależny od statusu jak
wcześniej). Lifecycle-menu (`Wersja robocza ⌄`) zostaje jako DRUGIE, oddzielne miejsce — to
kanoniczne dwa miejsca (tożsamość raz, kontrolka zmiany stanu raz), zgodnie z wprost dozwolonym
przez orkiestratora „Zostaw `v1 · Wersja robocza` jako tożsamość ORAZ menu lifecycle".

**Weryfikacja regresji na współdzielonym komponencie:** `FinanceWorkspaceBar.test.tsx` (8 testów,
w tym `getByText('Zatwierdzone')` — jednoznaczne dopasowanie zachowane, bo etykieta statusu
zostaje we własnym leaf-`<span>` wewnątrz `IdentityBadge`, nie skonkatenowana z „v1 ·" w jednym
węźle tekstowym) i `financeWorkspaceBar.contract.test.ts` (13 testów) — oba pliki PASS, zero zmian
w samych plikach testowych.

**Dowód:** `PO-baseline-workspace-approved.png` — `v1 · Zatwierdzone` (zielony ton) + osobne menu
`Zatwierdzone ⌄`.

**Status: PASS.**

### Punkt 4 — tekst ucięty (Reguła kalibracji / Jakość / Bezpieczny zakres)

**NAPRAWIONE w `AssumptionsView.tsx`.** Dwie osobne przyczyny, obie potwierdzone czytaniem kodu:

1. **Selecty za wąskie:** kolumny „Reguła kalibracji" (`minWidth: 150`) i „Jakość"
   (`minWidth: 100`) były węższe niż najdłuższe realne etykiety z `baselineLabels.ts`
   (`BASELINE_RULE_LABELS.LINKED_TO_ANALYSIS_KPI = 'Powiązane z KPI analizy'`, ~23 znaki;
   `Ograniczona` dla jakości) — natywny `<select>` obcina wybraną opcję wielokropkiem, gdy box jest
   za wąski. Poszerzone do `210px`/`140px` (zmierzone pod realne etykiety, nie zgadywane).
2. **Artefakty zmiennoprzecinkowe w „Bezpieczny zakres":** `dev-render/screens/finance-baseline-workspace.tsx`
   liczył `rangeLow`/`rangeHigh` jako `Math.max(0, Number(s.value) - 0.1)` bez zaokrąglenia — JS
   daje np. `0.58 - 0.1 = 0.48000000000000004`, nie `0.48`. Ten długi string renderował się w
   56px polu liczbowym i wizualnie się ucinał — dokładnie symptom ze zrzutu („0,01'"). Naprawione
   DWUWARSTWOWO: (a) `AssumptionsView.tsx` zaokrągla wartość do 4 miejsc PRZED wyświetleniem
   (`roundForRangeDisplay`) — działa niezależnie od źródła danych (realne API też mogłoby kiedyś
   zwrócić długi decimal), (b) mock w dev-render poprawiony u źródła (`.toFixed(4)`) — defense in
   depth, plik dev-only. Input poszerzony `w-14` (56px) → `w-20` (80px).

**Dowód:** `PO-baseline-workspace-assumptions.png` — „Średnia historyczna", „Potwierdzona",
„Szacowana", „Ograniczona" w pełni czytelne; zakresy „0,02 – 0,22", „0,48 – 0,68" itd., zero
artefaktów.

**Status: PASS.**

### Punkt 5 — crimson/czerwień na każdej linii kosztowej

**NAPRAWIONE w `CalculationsView.tsx`.** Zmierzony realny token: `text-c-danger`
(`--c-danger: #e80538` jasny motyw / `#ed5565` ciemny — SSOT `src/index.css:102/302`), **NIE**
dosłowny brand-crimson `#85182F` (`--primary`/`--c-accent`). Token `c-danger` jest w tym repo
poprawnie oddzielony od brand-crimson (`docs/ui-standards/00-foundation/color-system.md:253`:
„`danger` i brand `crimson` są celowo [odrębne]"), więc formalnie to NIE jest naruszenie „pułapki
nr 1" (primary=crimson) dosłownie.

Mimo to było naruszeniem DUCHA reguły #3 CLAUDE.md („Czerwień TYLKO semantyka krytyczna"): kod
malował KAŻDĄ ujemną liczbę na każdej linii (COGS, OPEX, amortyzacja, odsetki, podatek) na
`text-c-danger font-semibold` — a te linie są ZAWSZE ujemne na P&L z definicji konwencji znaku
(to nie jest alarm, to jest normalna struktura rachunku wyników), co rozmywało realny sygnał
alarmowy (luka finansowania/ujemna gotówka, DEC-FIN-002) do nierozróżnialności — cała tabela
wygląda na czerwono za każdym razem, zdrowy model czy nie.

Naprawa: `isCriticalNegative = negative && isCashLine` — czerwień (`text-c-danger`) zostaje
WYŁĄCZNIE dla linii CASH, gdy realnie spada poniżej zera. Wszystkie inne ujemne liczby dostają
`text-c-text` (neutralny, ten sam co dodatnie — minus w `tabular-nums` już wystarczająco
odróżnia). Test anty-plug (`CalculationsView.antiplug.test.tsx:128`,
`expect(cell.className).toContain('text-c-danger')` dla CASH ujemnej) — nietknięty, dalej PASS,
bo dotyczy WYŁĄCZNIE CASH.

**Dowód:** `PO-baseline-workspace-fundinggap-alarm.png` — `-85 000`/`-130 400` (CASH) czerwone i
pogrubione; `-243 600` (COGS), `-92 400` (OPEX), `-8 500` (amortyzacja), `-3 200` (odsetki),
`-13 737` (podatek) — wszystkie neutralne, czarne.

**Status: PASS.**

## 3. Uwaga o komponencie współdzielonym

`FinanceWorkspaceBar.tsx` (`src/components/Finance/shared/`) jest platformą Pakietu C, używaną
przez WIELE workspace'ów Finance (dziś w tym worktree realnie konsumuje go tylko
`BaselineWorkspace.tsx`, ale sesja nadzorcza potwierdziła, że Pakiet G też go używa na swojej
gałęzi). Zmiana w §2 punkt 3 dotyka WYŁĄCZNIE ciała renderującego `IdentityBadge` — `WorkspaceBarConfig`
(typ propsów) się nie zmienił ani o jedno pole, więc żaden konsument tego komponentu (inny pakiet,
inna gałąź) nie musi się zmieniać, żeby się skompilować. Zweryfikowane: `FinanceWorkspaceBar.test.tsx`
+ `financeWorkspaceBar.contract.test.ts` (oba w tym worktree) PASS bez modyfikacji.

## 4. „Gotówka = 0 / IMPORTED FROM STATEMENT" (PRZED) — rozstrzygnięcie

**BRAK DANYCH WYRENDEROWANY JAKO ZERO — nie realne zero.** Rozstrzygnięte odczytem danych (kod +
fixture), nie oglądem, w trzech krokach:

1. `src/components/Finance/FinancialModelWorkspace.tsx:839-849` — `seededInputKeys` oznacza
   WSZYSTKIE siedem pól bilansowych (`initialCash`, `initialEquity`, `initialDebt`, `initialPPE`,
   `initialAR`, `initialInventory`, `initialAP`) jako „Imported from statement" na podstawie
   JEDNEJ flagi modelowej `isGrounded` (czy model MA jakiekolwiek źródło seed) — **NIE** sprawdza
   per-klucz, czy TA KONKRETNA wartość faktycznie istnieje w `assumptions_json`.
2. `src/components/Finance/FinancialModelWorkspace.tsx:1307` — `value={assumptions[key] ?? 0}` —
   gdy `assumptions.initialCash` jest `undefined`, input pokazuje „0", nieodróżnialne od realnego
   zera.
3. **Dowód na danych:** fixture zasilająca zrzut PRZED
   (`dev-render/screens/finance-model-workspace.tsx:70-84`) ma `assumptions_json` zawierający
   WYŁĄCZNIE `baseline.{revenue,cogs,opex,depreciation,interest,tax,capex}` (drivery P&L) i
   `seedSource` — żadnego z siedmiu kluczy bilansowych, w tym `initialCash`, w ogóle w danych NIE
   MA. Czyli seed w tym modelu faktycznie NIGDY nie dostarczył wartości gotówki otwierającej —
   pole jest MISSING, nie PRESENT_ZERO — a mimo to UI pokazuje „0" + fałszywą etykietę „Imported
   from statement".

To jest defekt w STARYM ekranie `FinancialModelWorkspace.tsx` (zastępowanym przez ten pakiet),
poza allowlistą Pakietu F (ten plik nie jest częścią Baseline Workspace). **Nowy** ekran tego
pakietu NIE dziedziczy tego wzorca — dowiedzione programowo przez
`CalculationsView.antiplug.test.tsx` (sekcja „PIĘĆ stanów wartości"), gdzie CASH `MISSING` renderuje
się jako „—" (nigdy „0") i niesie odrębny `title` od `PRESENT_ZERO`/`NA`/`NOT_APPLICABLE` — patrz
§5 niżej.

Zgłoszone jako osobne zadanie do kolejki (`spawn_task`, task_21f1051b) — naprawa starego ekranu
wykracza poza zakres tego pakietu (może się okazać, że najwłaściwszą odpowiedzią jest po prostu
przyspieszenie migracji na ten nowy ekran zamiast łatania starego kodu, do oceny przez osobę
biorącą zadanie).

Kontekst „pięć stanów" / `NA` nieosiągalne: ten ekran (Baseline) NIE zależy od stanu `NA` w
happy-pathach zademonstrowanych w testach — `NA` jest jednym z pięciu renderowalnych stanów w
`formatFinanceValueForDisplay`/`aggregatedValueFor`, przetestowanym jako POPRAWNIE renderujący się
GDY WYSTĄPI (test „MISSING vs NA vs NOT_APPLICABLE" wyżej), ale sam ekran nie generuje ani nie
wymaga `NA` do działania — jeśli serwisy kanoniczne faktycznie nigdy nie emitują `NA` (ustalenie
niezależnego oracle), to dla tego ekranu oznacza po prostu, że w praktyce ten jeden z pięciu
gałęzi renderowania nigdy się nie uruchomi na żywych danych, bez ryzyka — kod jest poprawny,
tylko martwy w praktyce, dopóki osobna paczka nie odblokuje `NA` u źródła.

## 5. Test anty-plug + kontrola negatywna

`CalculationsView.antiplug.test.tsx` — CASH ujemna (-125000) renderuje się jako liczba ujemna w
kolorze krytycznym (`text-c-danger`), NIE jako „0" i NIE jako „—"; MISSING renderuje „—" (nigdy
„0"); PRESENT_ZERO renderuje „0" (odróżnialne od MISSING); alarm luki finansowania renderuje się
TYLKO gdy `monthlyResults` faktycznie niesie `qualityFlag: 'FUNDING_GAP'`.

**Kontrola negatywna WYKONANA REALNIE w tej sesji** (nie tylko opisana w komentarzu — dowód
poniżej to faktyczny przebieg `vitest`, nie odtworzenie z pamięci):

1. Wstrzyknięty plug do `CalculationsView.tsx` (`aggregatedValueFor`): `let value = ...; if
   (line === 'CASH' && value < 0) value = 0;` — symulacja cichego „naprawiania" ujemnej gotówki w
   warstwie renderera.
2. Uruchomiony `vitest run CalculationsView.antiplug.test.tsx` → **1 test faktycznie się
   zaczerwienił**: `AssertionError: expected '0' not to be '0'` na teście „CASH ujemna (-125000)
   renderuje się jako liczba ujemna…" — dokładnie ten test, którego to dotyczy, pozostałe 6 dalej
   PASS (dowód, że plug nie psuje niczego przypadkowo poza swoim zakresem).
3. Plug cofnięty (`Edit` do dokładnie sprzed stanu), `vitest run` ponownie → **7/7 PASS**.
4. `git diff` po przywróceniu — brak resztek plugu w pliku (sprawdzone `grep` na frazę plugu, zero
   wyników).

To dowodzi, że test anty-plug faktycznie mierzy liczbę renderowaną w DOM, nie tylko obecność
komórki — bez tej kontroli nie byłoby wiadomo, czy test w ogóle jest w stanie się zaczerwienić.

## 6. Happy path `POST /baseline/:id/compute`

**Pokryte na warstwie tego pakietu (frontend hook), EVIDENCE_MISSING na warstwie routera/solvera
(poza allowlistą) — zweryfikowane, nie tylko przyjęte na słowo:**

- `useBaselineCompute.test.ts`, opisany blok „happy path (luka odziedziczona, punkt 7)" — mockuje
  `computeBaseline` na sukces BEZ funding gap, dowodzi `computing → succeeded`, `stale` wyczyszczone,
  `result.periodsComputed`/`monthlyResults` zapisane, `errorDetail: null`. Ten stan przed tym
  pakietem nie miał ŻADNEGO pokrycia (potwierdzone przeczytaniem
  `server/src/routes/v8/finance-v2/__tests__/baseline.routes.pg.test.ts` — patrz niżej).
- **Router-level happy path (`POST /baseline/:id/compute` przez realny, zbieżny solver
  circularity) jest EVIDENCE_MISSING** — zweryfikowałem to czytając
  `server/src/routes/v8/finance-v2/__tests__/baseline.routes.pg.test.ts:1-21` w całości: plik ma
  własny, udokumentowany „SCOPE DECISION" — testuje TYLKO (1) round-trip zapisu/odczytu założeń,
  (2) error path compute'u (`NO_SOURCE_STATEMENT_PACK_EDGE` — jedyny gate, który nie wymaga
  fixture), (3) czytnik outputs na wprost zaseedowanym wierszu. Happy-path solver jest już
  dowiedziony w `perfSlo.pg.test.ts` (fixtura D1, poza allowlistą B2/B3 tego pakietu) — router NIE
  ma własnego testu, który przepuszcza żądanie przez PEŁNY, zbieżny compute. Ten plik i tak wymaga
  `RUN_DB_TESTS=1 && MOCK_DB=false` (realny Postgres) — pominięty w normalnym przebiegu `vitest`
  (`describe.skipIf(!REAL_PG)`), więc nie wpływa na liczbę 53/53 niżej.

**Status: PASS (warstwa frontendu, zweryfikowane) / EVIDENCE_MISSING (warstwa routera, powód
udokumentowany w samym pliku testowym, nie tylko w tym raporcie).**

## 7. Wyniki testów (Vitest, `src/**`, z korzenia repo, `--maxWorkers=2`)

```
npx vitest run src/components/Finance/baseline \
  src/components/Finance/shared/__tests__/FinanceWorkspaceBar.test.tsx \
  src/components/Finance/shared/__tests__/financeWorkspaceBar.contract.test.ts \
  src/hooks/__tests__/useFinanceBaselineWorkspaceFlag.test.ts \
  src/services/api/__tests__/financeV2.baseline.api.test.ts \
  --maxWorkers=2

Test Files  7 passed (7)
     Tests  53 passed (53)
  EXIT CODE 0
```

Uruchomione DWUKROTNIE w tej sesji (raz przed przerwaniem sieciowym, raz po wznowieniu z bazy
zabezpieczonej przez `8437c7e325`) — oba razy identyczny wynik, 53/53, exit 0. Plik z 7:
`CalculationsView.antiplug.test.tsx` (7) + `BaselineWorkspace.canon.test.tsx` (7) +
`FinanceWorkspaceBar.test.tsx` (8) + `financeWorkspaceBar.contract.test.ts` (13) +
`useBaselineCompute.test.ts` (6) + `financeV2.baseline.api.test.ts` (8) +
`useFinanceBaselineWorkspaceFlag.test.ts` (4) = 53.

## 8. `tsc --noEmit` (NODE_OPTIONS=--max-old-space-size=12288)

Uruchomiony DWUKROTNIE:

1. **Pierwszy przebieg (przed poprawką): exit 2, 1 realny błąd.**
   `src/components/Finance/baseline/__tests__/CalculationsView.antiplug.test.tsx(147,73): error
   TS1355: A 'const' assertions can only be applied to references to enum members, or string,
   number, boolean, array, or object literals.` — `qualityFlag: null as const` w kontroli
   negatywnej „bez FUNDING_GAP". Błąd PRZEDISTNIEJĄCY w komicie poprzednika (`9d8ddd471e`), NIE
   związany z żadną zmianą UI tej sesji — vitest/esbuild go nie łapał, bo esbuild nie sprawdza
   typów (transpiluje `as const` do no-opa). To DOKŁADNIE pułapka z zadania: bez pełnego `tsc`
   ten błąd zostałby niewykryty.
2. Naprawiony: `null as const` → plain `null` (typ pola `qualityFlag: 'FUNDING_GAP' | null` —
   plain `null` typuje się poprawnie bez asercji, asercja była zbędna i niepoprawna składniowo).
   Testy re-run po naprawie: dalej 7/7 PASS na tym pliku (runtime się nie zmienił — `as const` jest
   erasable, nie generuje kodu).
3. **Drugi przebieg (po poprawce): exit 0, zero błędów, zero output poza `TSC_EXIT=0`.** Pełny
   `tsc --noEmit` repo-wide (nie tylko pliki tego pakietu) zielony. Maszyna była pod bardzo wysokim
   obciążeniem równoległym (kilka innych sesji uruchamiało własne `tsc`/`vitest` jednocześnie —
   potwierdzone `ps aux` pokazującym równoległe procesy `tsc` dla pakietów E/G/J) — oba przebiegi
   trwały odpowiednio ok. 5 i 7 minut ściennego czasu, żaden nie oznaki OOM (kod 134); kod wyjścia
   sprawdzony jawnie po każdym (`echo "TSC_EXIT=$?"`), nie zgadywany z braku outputu.

## 9. Nowe zrzuty (PO naprawach 1–5)

- `docs/validation/finance-v3/generated/gate-e/visual/pkg-f/PO-baseline-workspace-assumptions.png`
- `docs/validation/finance-v3/generated/gate-e/visual/pkg-f/PO-baseline-workspace-wyliczenia.png`
- `docs/validation/finance-v3/generated/gate-e/visual/pkg-f/PO-baseline-workspace-fundinggap-alarm.png`
- `docs/validation/finance-v3/generated/gate-e/visual/pkg-f/PO-baseline-workspace-approved.png`

Wygenerowane realnym `node scripts/dev/pkgf-baseline-screenshots.mjs` przeciw żywemu `vite
--config dev-render/vite.config.ts --port 58023` (Playwright/Chromium, `fullPage: false`,
1440×900) — nie ręcznie, nie zmontowane. Stare zrzuty (sprzed tej sesji, pokazujące defekty 1/2/4/5)
zachowane jako `PRZED-NAPRAWA-baseline-workspace-*.png` (4 pliki, rename `git mv`, zero utraconej
historii). `PRZED-finance-model-workspace-draft.png` (stary ekran „Models") wygenerowany na nowo
tym samym skryptem — bajtowo identyczny z poprzednim (potwierdzone `git diff --stat` = brak diffu),
co dodatkowo potwierdza determinizm fixture użytej w §4.

## 10. Podsumowanie PASS/PARTIAL/FAIL/EVIDENCE_MISSING

| Element | Status |
|---|---|
| V-1…V-5 | PASS (potwierdzone wcześniej + w tej sesji) |
| V-6 (jeden pasek, brak duplikacji) | PASS (po naprawach punktów 2/3 niżej) |
| Punkt 1 (pływające Lista/Uwagi) | RESOLVED-BY-DIAGNOSIS — harness, nie produkt; zmitygowane defensywnie (`pb-16`) |
| Punkt 2 (zdублowany Przelicz) | PASS |
| Punkt 3 (status ×3) | PASS (naprawa we współdzielonym `FinanceWorkspaceBar.tsx`, propsy nietknięte) |
| Punkt 4 (tekst ucięty) | PASS |
| Punkt 5 (crimson na kosztach) | PASS |
| „Gotówka = 0" | ROZSTRZYGNIĘTE: brak danych renderowany jako zero + fałszywa etykieta źródła — defekt STAREGO ekranu, poza allowlistą, zgłoszony osobno (task_21f1051b) |
| Test anty-plug | PASS + kontrola negatywna wykonana realnie (zaczerwieniła się, potem zazieleniła) |
| Happy path compute | PASS (hook) / EVIDENCE_MISSING (router — udokumentowane w pliku testowym B2, nie mój dług) |
| Testy (vitest) | 53/53 PASS, exit 0, uruchomione 2× |
| `tsc --noEmit` | PASS — 1 realny błąd znaleziony i naprawiony (przedistniejący, TS1355), drugi przebieg: exit 0, zero błędów |
| Zrzuty PO | 4 nowe, wygenerowane realnym harnessem po naprawach |

## 11. Higiena wykonania

- Commit po każdym etapie: `c9c10eff5b` (rename zrzutów), `28878298ae` (naprawy UI + tsc fix +
  nowe zrzuty), ten raport (kolejny commit).
- Zero `git add -A`/`git add .` — wszystkie pliki dodawane imiennie.
- Zero `git reset --hard`/`git stash`/`git clean` — negatywna kontrola robiona przez `Edit`
  (wstrzyknięcie i dokładne cofnięcie), nie przez stash.
- Flaga `financeBaselineWorkspaceV1` pozostaje domyślnie OFF (niezmieniona) — ekran dalej
  dostępny wyłącznie przez `dev-render/`, zero podłączenia produkcyjnego.
- `FinanceWorkspaceBar.tsx` (współdzielony) — zmienione WYŁĄCZNIE ciało renderujące, zero zmian w
  `WorkspaceBarConfig`/propsach — bezpieczne dla innych konsumentów (w tym Pakietu G).
