# PKG_H (Enterprise Valuation) — NIEZALEŻNA WERYFIKACJA

Weryfikator: niezależna sesja (nie autor pakietu). Nastawienie: zakładać zawyżenie, dopóki sam nie
zmierzę. Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-h-valuation`, gałąź
`codex/fv3p-h-valuation` @ `35db34f15e` (final SHA autora, drzewo czyste na starcie). Baza:
`9604652e27`.

Wynik: **wszystkie 12 twierdzeń zmierzone niezależnie. 11 POTWIERDZONE (w tym jedno z dodatkową,
samodzielnie znalezioną wadą — patrz punkt 12), 1 POTWIERDZONE z zastrzeżeniem (punkt 5, drobna
nieścisłość terminologiczna w opisie „cross-checki niewazone", sama logika poprawna).**

---

## Tabela wyników

| # | Twierdzenie | Mój niezależny pomiar | Werdykt |
|---|---|---|---|
| 1 | 58/58 testów, exit 0 | `npx vitest run src/components/Finance/Valuation/__tests__/*.{ts,tsx} --maxWorkers=2` z korzenia repo → `Test Files 2 passed (2)`, `Tests 58 passed (58)`, `REAL_EXIT_CODE=0` (zmierzone przez `echo $?` bezpośrednio po komendzie, nie z logu) | **POTWIERDZONE** |
| 2 | Pełny `tsc --noEmit` (API/typy/matematyka CZYSTY; UI TYLKO esbuild, luka) | Uruchomiłem `NODE_OPTIONS=--max-old-space-size=12288 node_modules/.bin/tsc --noEmit -p tsconfig.json` z korzenia (root `tsconfig.json` NIE wyklucza plików testowych — sprawdzone, w przeciwieństwie do `server/tsconfig.json`) — **exit 0, ZERO linii błędów**, na CAŁYM projekcie włącznie z warstwą UI (`ValuationWorkspace.tsx` + 7 kroków) i plikami testowymi. Powtórzone 2× niezależnie (jeden przebieg ubity przez zewnętrzny timeout 120s pod obciążeniem maszyny — zero błędów zanim padł, druga i trzecia próba dokończyły się czysto). **Luka zamknięta.** | **POTWIERDZONE — luka zamknięta, exit 0** |
| 3 | `valuationMath.ts` — wszystkie mirrory zweryfikowane osobno | Własny skrypt (`tsx`, NIE plik testowy autora) z 21 asercjami: g<WACC (twardy hard-reject, granica `g==WACC`), nominal/real+pre/post-tax+waluta (4 przypadki), MOJA WŁASNA monotoniczna siatka 5×5 (formuła `1000+row*50-col*80`, niezależna od danych autora) + 2 celowo złamane warianty (wiersz/kolumna) + test wyczerpujący (20 sąsiednich par kolumn na całej siatce), wagi koszyka (100%/99%/cross-check z wagą/bez wagi), N/A wykluczone z zakresu wyników. **21/21 moich własnych asercji przeszło.** | **POTWIERDZONE** |
| 4 | Metoda bez danych → zawsze `NA`, nigdy PLN 0; `NA` ≠ `NOT_APPLICABLE` ≠ `PRESENT_ZERO` | `ValuationValueCell.tsx` renderuje PIĘĆ stanów rozróżnialnie (kod + tekst powodu, nigdy sam kolor) — potwierdzone czytaniem kodu + w teście autora (`data-value-status` atrybut + różny tekst dla NA/MISSING/PRESENT_ZERO) + moim własnym `computeMethodResultRange` testem (NA/NOT_APPLICABLE wykluczone z min/max, nie ciągnie do 0). Mechanizm: `FinanceValueStatus`/`formatFinanceValueForDisplay` (Pakiet C, plik `financeV2.types.ts` linie 1-396, PRZED blokiem PKG-H) — **NIE duplikat**: `valuationComputeService.ts` (server, base SHA, NIE dotknięty tym pakietem) ma WŁASNY enum `MethodResultValueStatus` niezależny od `formulaAstEvaluator.ts` (różne domeny — KPI-formuły vs metody wyceny — nie importuje go, `grep` potwierdza). Pkg H PORTUJE prawidłowy, istniejący mechanizm wyceny, nie tworzy równoległego. | **POTWIERDZONE** |
| 5 | Wagi koszyka = 100%, cross-checki NIEWAŻONE (DEC-FIN-005) | `validateBasketWeights`: suma dokładnie 100% (tolerancja 1e-9), cross-check z jakąkolwiek wagą → `WEIGHT_NOT_ALLOWED`, cross-check bez wagi → OK, suma liczy WYŁĄCZNIE koszyk. Zmierzone własnym testem: `basketSumPct` = 100 nawet przy obecności unweighted cross-checka. Ostrzeżenia o korelacji metod: `computeMethodResultRange().hasMaterialDisagreement` (próg 20%) — działa, potwierdzone. | **POTWIERDZONE** |
| 6 | (a) Naprawiono realny bug hydratacji tabeli, złapany tylko w przeglądarce; (b) `FinanceErrorBoundary` nie resetował się między krokami, naprawione | **(a)** Kontrola negatywna WŁASNA: przywróciłem plik sprzed naprawy (`git show 913168b592~1:...MethodsWeightsStep.tsx`), odpaliłem dev-render (port 58033) + własny skrypt Playwright liczący console errors → **CZERWONE**: dokładnie ten komunikat React „whitespace text nodes cannot be a child of table". Przywróciłem naprawioną wersję (`git show 913168b592:...`) → **ZIELONE**, `git diff --stat` na pliku puste (czysty powrót). **(b)** Napisałem WŁASNY test integracyjny (inny punkt awarii niż autora: Sensitivity zamiast Results, inny mechanizm crashu: `grid.cells.map` na obiekcie bez `cells` zamiast `results.methods` undefined) — przeszedł na naprawionym kodzie. Usunąłem `key={activeStep}` z `ValuationWorkspace.tsx:296` → mój test I test autora **oba CZERWONE** (2 failed / 6 passed, ErrorBoundary zostawał widoczny po nawigacji). Przywróciłem `key={activeStep}` → oba **ZIELONE**, `git diff --stat` puste. | **OBA POTWIERDZONE własną kontrolą negatywną (czerwone→zielone)** |
| 7 | 7 kroków: realnie zaimplementowane vs szkielet; Export/Advisor-wersjonowanie/comps/timing-stub uczciwie EVIDENCE_MISSING/BLOCKED_EXTERNAL | Przeczytałem KAŻDY z 7 plików kroków. Source/Assumptions/Methods/Results/Sensitivity/Advisor(generowanie) — realna logika, nie szkielet. Export — 16-liniowy, jawny placeholder cytujący brak endpointu (potwierdzone: `grep -cE "^router\.(get\|post\|put\|patch\|delete)\("` na `valuation.routes.ts` = dokładnie 21, zero eksportu). Advisor — brak UI historii wersji (kod tylko czyta `isFrozen`/`isStale` jako badge, nie ma widoku porównania wersji) — zgodne z deklaracją. Comps — `usableCompsByMethodId: Record<string, number>` istnieje w typach, ale ŻADEN komponent go nie renderuje (grep potwierdza zero użyć poza typem i testowym fixture) — zgodne z deklaracją „brak tabeli porównywalnych spółek". | **POTWIERDZONE — uczciwa ocena zakresu** |
| 8 | POTWIERDZONY DEFEKT B3: żaden HTTP endpoint nie tworzy lineage edge, `insertEdge()` tylko z testów | `grep -rln "insertEdge" server/src --include="*.ts"` → wyłącznie pliki `__tests__/*.pg.test.ts` + `workspaceTestFixtures.ts` + sama definicja w `lineageService.ts`. `find server/src/routes -iname "*.ts" ! -iname "*.test.ts" ! -path "*__tests__*" \| xargs grep -l insertEdge` → **PUSTE**. `crosscutting.routes.ts` (jedyny router importujący `lineageService`) importuje TYLKO `getAncestors`/`getDescendants` (odczyt). Blokuje krok 1 end-to-end — potwierdzone. | **POTWIERDZONE (grep, nie tylko cytat autora)** |
| 9 | Niespójność kształtu: kilka GET zwraca surowe snake_case, POST/PUT camelCase | Sprawdziłem źródłowo (nie tylko cytat) 4 z 6 par z tabeli autora: WACC inputs (GET `:375-386` I PUT `:426-429` — OBA surowe `WaccInputsRow`, snake_case potwierdzone w `valuationWaccService.ts:40-59`), Bridge (GET `:567-577` surowy `{header,components}` z `SELECT *`, PUT `:630-633` ręcznie zbudowany camelCase obiekt), Terminal (GET `:641-650` surowe `TerminalRow[]`), Sensitivity (POST `:704-707` camelCase, GET `:711-723` surowe). Wszystkie linie i kształty zgadzają się z cytatem autora day-for-day. Dotyczy min. 6 endpointów/par (WACC, Bridge, Terminal, Sensitivity, Results pod-obiekty, Advisor). | **POTWIERDZONE** |
| 10 | Zero modyfikacji plików B3 (`server/`); w `financeV2.api.ts`/`.types.ts` tylko dodano w bloku PKG-H | `git diff --stat 9604652e27..HEAD -- server/` → puste (potwierdzone). `financeV2.api.ts`: 284 linie `+`, 1 linia `-` (rozszerzenie importu `v8Get, v8Post` → `v8Get, v8Patch, v8Post, v8Put` — konieczne, niedestrukcyjne). `financeV2.types.ts`: 530 `+`, 0 `-`. Oba pliki mają jawne znaczniki `// --- PKG-H Valuation ---` / `// --- /PKG-H Valuation ---` obejmujące CAŁY nowy kod. | **POTWIERDZONE** |
| 11 | Brak osłabienia testów (skip/only, usunięte asercje) | `grep -n "\.skip\|\.only\|xdescribe\|xit(\|todo("` na obu plikach testowych pakietu → zero trafień. Wszystkie zmiany w plikach nie-testowych poza `Valuation/` i `financeV2.*` = 0 (diff-stat pokazuje wyłącznie nowe pliki + 1 linię importu). Żaden istniejący plik testowy poza pakietem nie został dotknięty. | **POTWIERDZONE** |
| 12 | Zrzuty (9 szt.) — kanon wizualny | Obejrzałem wszystkie 9 PNG. Nawigacja/status-badge (ZABLOKOWANE/GOTOWE/NIE DOTYCZY), banery spójności (zielony=OK), formatowanie liczb z spacjami w większości miejsc, fokus/braki ucięcia tekstu — OK. **★ NOWA WADA znaleziona samodzielnie** (nie zgłoszona przez autora) — patrz sekcja niżej. | **POTWIERDZONE z 1 nową, realną wadą** |

---

## Pełny `tsc --noEmit` — dowód (punkt 2)

```
NODE_OPTIONS=--max-old-space-size=12288 node_modules/.bin/tsc --noEmit -p tsconfig.json
EXIT CODE: 0
Linii wyjścia (błędów/ostrzeżeń): 0
```

Root `tsconfig.json` `include: ["src", "*.ts", "*.tsx"]` — brak wykluczenia `__tests__`/`*.test.ts`
(w przeciwieństwie do `server/tsconfig.json`), więc ten przebieg objął RÓWNIEŻ pliki testowe
pakietu H. Uruchomione 3×: przebieg 1 i 3 zakończone czysto (exit 0, zero linii); przebieg 2 ubity
przez zewnętrzny limit czasu 120s (maszyna obciążona równoległymi sesjami, zgodnie z ostrzeżeniem w
briefie) — bez JAKICHKOLWIEK linii błędu przed ubiciem. Luka, którą autor sam zgłosił jako
`EVIDENCE_MISSING — tylko esbuild per-plik`, jest tym raportem **zamknięta**: warstwa UI
type-checkuje się czysto pełnym kompilatorem TypeScript, nie tylko esbuildem.

---

## Punkt 3 — własny test `valuationMath.ts` (streszczenie, 21/21 przeszło)

Niezależny skrypt (`tsx`, import bezpośredni modułu, ZERO użycia pliku testowego autora):
- `assertGBelowWacc`: `g<WACC` OK, `g==WACC` REJECT (granica, nie tylko `g>WACC`), kod błędu obecny.
- `assertWaccConsistency`: NOMINAL/POST_TAX/PLN OK; REAL odrzucone; PRE_TAX odrzucone; waluta
  niezgodna odrzucona.
- Siatka 5×5 monotoniczna zbudowana OD ZERA (inna formuła niż w teście autora) — shape OK,
  monotoniczność OK, `assertSensitivityGridIntegrity` OK. Dwie celowo złamane wersje (naruszenie
  wierszowe i kolumnowe) — obie wykryte. Test wyczerpujący: każda z 20 sąsiednich par kolumn na
  płaskiej siatce, po jednej perturbacji naraz, wykrywa naruszenie za KAŻDYM razem (nie tylko w
  jednym miejscu siatki).
- `validateBasketWeights`: 100% OK, 99% REJECT, cross-check z wagą REJECT, cross-check bez wagi +
  poprawny koszyk 100% OK, `basketSumPct` liczy WYŁĄCZNIE koszyk (potwierdzone liczbowo, nie tylko
  strukturalnie).
- `computeMethodResultRange`: NA/NOT_APPLICABLE wykluczone z `readyCount`/`min`/`max` (nie ciągną
  do zera).

---

## Punkt 6 — kontrole negatywne wykonane samodzielnie (streszczenie)

**(a) Hydratacja tabeli.** Cofnięcie `MethodsWeightsStep.tsx` do wersji sprzed
`913168b592` (przez `git show <sha>~1:<plik> > <plik>`, NIGDY stash/reset) + realny render w
Chromium (Playwright, dev-render port 58033) → konsola pokazuje DOKŁADNIE zgłoszony błąd React
(„whitespace text nodes cannot be a child of `<table>`… This will cause a hydration error.”).
Przywrócenie (`git show 913168b592:<plik> > <plik>`) → zero błędów konsoli, `git diff --stat`
na pliku puste (bit-identyczny powrót).

**(b) Reset ErrorBoundary.** Własny test integracyjny (nie plik autora), inny punkt awarii
(Sensitivity, nie Results) i inny mechanizm crashu (`grid.cells.map` na obiekcie `{}` bez `cells`,
nie `results.methods === undefined`) — potwierdza: crash łapany lokalnie, pasek przeżywa,
nawigacja do Methods czyści boundary I metody nadal pokazują własne dane (12 345, nie
zresetowane/utracone). Usunięcie `key={activeStep}` z `ValuationWorkspace.tsx:296` → MÓJ test I
test autora oba czerwone (`2 failed / 6 passed` w tym samym przebiegu — pozostałe 6 niepowiązanych
testów nietknięte, dowód że regresja jest punktowa, nie systemowa). Przywrócenie `key={activeStep}`
→ oba zielone, `git diff --stat` na pliku puste.

---

## Punkt 4 — architektura NA (streszczenie)

`valuationComputeService.ts` (server, PRZEDISTNIEJĄCY na bazie 9604652e27, nietknięty tym pakietem)
definiuje własny `MethodResultValueStatus` — `formulaAstEvaluator.ts` (mechanizm KPI-formuł, gdzie
niedawna paczka naprawcza udrożniła stan NA) to INNA domena, nie importowana przez
`valuationComputeService.ts` (zweryfikowane grepem: `valuationComputeService.ts` nie ma na liście
plików importujących `formulaAstEvaluator`). Pkg H (klient) NIE tworzy równoległego mechanizmu —
portuje istniejący, przedistniejący mechanizm wyceny (`FinanceValueStatus`/
`formatFinanceValueForDisplay`, Pakiet C, linie 1-396 pliku `financeV2.types.ts`, PRZED blokiem
`PKG-H Valuation`) jednym typem (`ValuationMethodResultStatus = FinanceValueStatus`, jawnie
skomentowane „reused, not redeclared”). Brak defektu architektonicznego.

---

## Punkt 8 — dowód grep (defekt B3, brak endpointu tworzącego lineage edge)

```
$ grep -rln "insertEdge" server/src --include="*.ts"
server/src/routes/v8/finance-v2/__tests__/prediction.routes.pg.test.ts
server/src/routes/v8/finance-v2/__tests__/pkg-b2-cross-tenant.routes.pg.test.ts
server/src/routes/v8/finance-v2/__tests__/valuation.routes.pg.test.ts
server/src/routes/v8/finance-v2/__tests__/analysis.routes.pg.test.ts
server/src/services/finance/canonical/lineageService.ts        <- definicja
server/src/services/finance/canonical/__tests__/*.pg.test.ts   <- 4 pliki testowe
server/src/services/finance/workspace/__tests__/workspaceTestFixtures.ts
server/src/services/finance/workspace/lineageNavigatorContract.ts  <- tylko komentarz

$ find server/src/routes -iname "*.ts" ! -iname "*.test.ts" ! -path "*__tests__*" \
    | xargs grep -l "insertEdge"
(puste)
```

Jedyny router importujący `lineageService` (`crosscutting.routes.ts`) importuje wyłącznie
`getAncestors`/`getDescendants` (odczyt). **Potwierdzone niezależnie: żaden HTTP endpoint nie
tworzy lineage edge.**

---

## Nowa wada znaleziona samodzielnie (nie w raporcie autora)

**Surowe enumy techniczne wyciekają do UI jako etykiety użytkownika** — dokładnie wzorzec
przekrojowy zgłoszony w innych pakietach (Pakiet E, 2 przypadki). Zaobserwowane w zrzutach:

- `methods-weights.png` / `results-headline-and-range.png`: kolumna „Gotowość” pokazuje surowe
  `READY` / `NOT_CONFIGURED` / `DATA_INCOMPLETE` zamiast polskich etykiet. Kolumna „Metoda” pokazuje
  `DCF_FCFF` / `TRADING_COMPS` / `PRECEDENT_TRANSACTIONS` / `ASSET_BASED` — surowe stałe enum, nie
  ludzkie nazwy metod.
- `advisor-fact-vs-hypothesis.png`: „Pewność: HIGH” / „Pewność: MEDIUM” — angielski surowy enum
  zamiast polskiego „Wysoka”/„Średnia” (narusza kanon jednolitego języka polskiego — skróty typu
  REVENUE/EBITDA/WACC/DCF są dopuszczalne, ale `HIGH`/`MEDIUM`/`READY` to nie skróty branżowe, to
  surowe wartości enum z bazy).
- `source-linked.png`: „Typ transformacji: VALUATION_FROM_BASELINE”, „(BASELINE_MODEL)” — również
  surowe.

To DOKŁADNIE ta sama klasa błędu, którą repozytorium już raz naprawiło w INNYM, wcześniejszym
module wyceny (`src/components/Benefits/ValuationWorkspace.tsx`, task #110 M16 — dowód:
`tests/unit/finance/valuationEnumLabels.test.ts`, komentarz „replaced raw enum rendering… was
`{v.status}` — untranslated DRAFT / budget / financial_model strings leaking to the UI”). Pakiet H
zbudował NOWY moduł o tej samej nazwie klasy problemu bez ponownego użycia tego istniejącego
wzorca/helpera — regresja możliwa do uniknięcia, nie nowe odkrycie klasy błędu.

Drugorzędne, kosmetyczne: w `results-headline-and-range.png` liczby w bloku „Most EV → Equity”
(`191400000`, `171400000`) i w całej siatce wrażliwości (`sensitivity-5x5-loaded.png`, np.
`191880000`) NIE mają separatora tysięcy spacją, w odróżnieniu od reszty ekranu (`184 500 000`) —
niespójność formatowania liczb w obrębie tego samego widoku.

Żadnych naruszeń crimson-jako-`primary` ani ucięcia tekstu nie znaleziono. Pływające przyciski
„← Lista”/„Uwagi” to potwierdzony chrome harnessu, pominięte zgodnie z instrukcją.

---

## Ocena końcowa

**PASS z zastrzeżeniami** (PARTIAL w części poza priorytetem zadania, zgodnie z własną, uczciwą
oceną autora). Rdzeń matematyczny (`valuationMath.ts`) — solidny, każdy mirror zweryfikowany
niezależnie, żadnego zawyżenia nie znaleziono. Oba zgłoszone realne bugi (hydratacja tabeli, reset
ErrorBoundary) potwierdzone przez WŁASNĄ kontrolę negatywną (czerwone→zielone), nie tylko przyjęte
na słowo. Luka `tsc` (warstwa UI) — zamknięta tym raportem, exit 0. Defekt B3 (brak endpointu
lineage edge) i niespójność snake_case/camelCase — potwierdzone grepem/źródłem, nie tylko
zacytowane. Jedna nowa, realna wada wizualna (surowe enumy w UI) — do naprawy, ale nie blokuje
rdzenia funkcjonalnego (walidacje/matematyka/N-A/ErrorBoundary), które są tym, co obiecuje priorytet
zadania.

**Rekomendacja:** dopuścić do dalszego fan-in (D/E/F/G), z otwartym follow-up na (1) enum-label
helper dla Method/Readiness/Confidence/TransformationKind w `ValuationWorkspace`/krokach, wzorowany
na `src/components/Benefits/ValuationWorkspace.tsx`; (2) spójne formatowanie liczb (spacja jako
separator tysięcy) w bloku EV→Equity i siatce wrażliwości.
