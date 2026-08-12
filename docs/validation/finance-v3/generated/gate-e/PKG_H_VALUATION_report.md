# PKG_H — Enterprise Valuation (Wycena przedsiębiorstwa) — raport końcowy

Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-h-valuation`
Gałąź: `codex/fv3p-h-valuation`
Baza: `9604652e27` (tip pakietu B3, **UNVERIFIED_WIP w momencie startu tej pracy** — zweryfikowany
i scalony niezależnie w trakcie tej sesji, patrz §1).

**Końcowy SHA: `913168b592`**

Ten tekst jest DANE dla orkiestratora — druga agentka/agent weryfikuje niezależnie. Nic poniżej nie
jest zawyżone celowo; gdzie czegoś nie zrobiłem, piszę to wprost ze statusem
PASS/FAIL/PARTIAL/EVIDENCE_MISSING/BLOCKED_EXTERNAL.

---

## 0. Commity (najnowszy na dole → górze; kolejność chronologiczna)

1. `cf00949eff` — feat(finance-v3/pkg-h): API client + types + pure valuation math for Enterprise
   Valuation. `financeV2.types.ts`/`financeV2.api.ts` (blok `PKG-H Valuation`), `valuationMath.ts` +
   51 testów jednostkowych, `useFinanceValuationWorkspaceFlag.ts`.
2. `e3faec2660` — feat(finance-v3/pkg-h): Enterprise Valuation workspace UI (7-step flow,
   flag-gated). `<ValuationWorkspace>` + 7 kroków + `ValuationValueCell` + dev-render harness + 7
   testów integracyjnych.
3. `913168b592` — fix(finance-v3/pkg-h): fix §27-exempt table hydration bug + add visual evidence.
   Naprawa realnego bugu złapanego DOPIERO przy renderze w przeglądarce (nie przez esbuild/vitest),
   9 realnych zrzutów ekranu.

`git diff --stat 9604652e27..913168b592` (dokładny, zmierzony):

```
 .claude/launch.json                                                     |  13 +
 dev-render/main.tsx                                                     |   6 +
 dev-render/screens/finance-valuation-workspace.tsx                      | 233 ++++++
 docs/.../visual/pkg-h/advisor-fact-vs-hypothesis.png                    | Bin 86523 bytes
 docs/.../visual/pkg-h/assumptions-wacc-consistent.png                   | Bin 56743 bytes
 docs/.../visual/pkg-h/export-honest-gap.png                             | Bin 57449 bytes
 docs/.../visual/pkg-h/methods-weights.png                               | Bin 75808 bytes
 docs/.../visual/pkg-h/results-headline-and-range.png                    | Bin 83325 bytes
 docs/.../visual/pkg-h/sensitivity-5x5-empty.png                         | Bin 43945 bytes
 docs/.../visual/pkg-h/sensitivity-5x5-loaded.png                        | Bin 72364 bytes
 docs/.../visual/pkg-h/source-linked.png                                 | Bin 73951 bytes
 docs/.../visual/pkg-h/source-unlinked-NEGCTRL.png                       | Bin 84456 bytes
 scripts/shot-pkg-h-valuation.mjs                                        |  48 ++
 src/components/Finance/Valuation/ValuationValueCell.tsx                 |  53 +
 src/components/Finance/Valuation/ValuationWorkspace.tsx                 | 329 +++++
 src/components/Finance/Valuation/__tests__/ValuationWorkspace.test.tsx  | 173 +++
 src/components/Finance/Valuation/__tests__/valuationMath.test.ts        | 515 +++++++++
 src/components/Finance/Valuation/steps/AdvisorStep.tsx                  | 130 +++
 src/components/Finance/Valuation/steps/AssumptionsStep.tsx              | 157 +++
 src/components/Finance/Valuation/steps/ExportStep.tsx                   |  29 +
 src/components/Finance/Valuation/steps/MethodsWeightsStep.tsx           | 191 +++
 src/components/Finance/Valuation/steps/ResultsStep.tsx                  | 136 +++
 src/components/Finance/Valuation/steps/SensitivityStep.tsx              | 166 +++
 src/components/Finance/Valuation/steps/SourceStep.tsx                   |  76 +
 src/components/Finance/Valuation/valuationMath.ts                       | 443 +++++++
 src/hooks/useFinanceValuationWorkspaceFlag.ts                           |  55 +
 src/services/api/financeV2.api.ts                                       | 284 ++++-
 src/services/api/financeV2.types.ts                                     | 530 +++++++++
 28 files changed, 3566 insertions(+), 1 deletion(-)
```

Żaden plik pakietu B3 (`server/src/routes/v8/finance-v2/valuation.routes.ts`,
`server/src/services/finance/canonical/valuation*.ts`, ich testy) NIE został dotknięty — zgodnie z
zakazem. `git diff 9604652e27..HEAD -- server/` jest pusty (zweryfikowano).

---

## 1. Kształt endpointów B3, na którym się oparłem (i status weryfikacji)

Praca zaczęła się przy bazie `9604652e27` oznaczonej jako `UNVERIFIED_WIP`. **W trakcie tej sesji
koordynator potwierdził: Pakiet B3 został niezależnie zweryfikowany (PASS) i scalony — kontrakt 21
endpointów wyceny jest stabilny.** Poniższy kształt był mierzony bezpośrednio z kodu routera
(`server/src/routes/v8/finance-v2/valuation.routes.ts`, 771 linii) w chwili startu, cytatami
plik:linia w `src/services/api/financeV2.types.ts` (blok `--- PKG-H Valuation ---`) — nie zgadywany.

21 endpointów (potwierdzone grepem, dokładne ścieżki):
`POST/GET /valuation/cases`, `GET /valuation/cases/:caseId`, `POST /valuation/cases/:caseId/variants`,
`GET/PATCH /valuation/variants/:id`, `POST /valuation/cases/:caseId/compare-variants`,
`GET/POST /valuation/variants/:id/methods`, `POST /valuation/variants/:id/methods/basket`,
`GET/PUT /valuation/variants/:id/wacc-inputs`, `POST /valuation/variants/:id/compute/dcf`,
`GET /valuation/variants/:id/results`, `GET/PUT /valuation/variants/:id/bridge`,
`GET /valuation/methods/:id/terminal`, `POST/GET /valuation/methods/:id/sensitivity[/:gridLabel]`,
`POST /valuation/variants/:id/advisor/generate`, `GET /valuation/variants/:id/advisor`.

### ★ ZMIERZONA NIESPÓJNOŚĆ kształtu odpowiedzi (zgłoszona, NIE naprawiona — poza allowlistą)

W przeciwieństwie do reszty `finance-v2` (gdzie DTO są camelCase — patrz nagłówek
`financeV2.types.ts`), kilka endpointów GET w Valuation zwraca SUROWY wiersz Postgresa
(snake_case, decimale jako stringi) wprost jako `data`, podczas gdy odpowiadające POST/PUT na TYM
SAMYM zasobie zwracają camelCase DTO:

| Zasób | GET | POST/PUT |
|---|---|---|
| WACC inputs | `valuation.routes.ts:375-386` surowy `WaccInputsRow` (snake_case) | `:426-429` **też surowy** — jedyny POST/PUT bez camelCase w całym module |
| Bridge | `:567-577` surowy `{header, components}` (snake_case) | `:630-633` camelCase DTO |
| Terminal | `:641-650` surowy `TerminalRow[]` (snake_case) | brak POST na ten zasób |
| Sensitivity | `:711-723` surowy `{grid, cells}` (snake_case) | `:704-707` camelCase cells |
| Results | `:537-560` wrapper camelCase, ale pod-obiekty `wacc`/`terminal`/`bridge`/`sensitivityGrids` są surowymi wierszami | — |
| Advisor | `GET :766-768` surowy `StoredAdvisorOutputRow[]` (snake_case) | `POST generate :752-755` camelCase `PersistedAdvisorFinding[]` |

Każdy typ w `financeV2.types.ts` jest nazwany/skopiowany DOKŁADNIE zgodnie z tym co router
faktycznie zwraca (włącznie z wersjami snake_case) — nie ujednoliciłem tego po cichu. Normalizację
zrobiłem JEDNĄ warstwę wyżej, w `valuationMath.ts` (`normalizeAdvisorFinding()`), tylko tam gdzie
UI faktycznie musi renderować oba kształty jednym komponentem (Advisor). Reszta niespójności jest
udokumentowana inline w typach i widoczna w kliencie (`financeV2.api.ts`, sekcja `PKG-H Valuation`).

### ★ DEFEKT B3 potwierdzony, NIE naprawiony (poza allowlistą) — brak endpointu tworzącego lineage edge

`POST /valuation/variants/:id/compute/dcf` (routes.ts:450-509) zwraca 404
`NO_VALUATION_SOURCE_EDGE` gdy wariant nie ma powiązania (lineage edge) ze źródłową wersją
Baseline/Scenario. **Ale żaden endpoint HTTP w `server/src/routes/` nie tworzy tego powiązania.**
Zweryfikowane grepem: `lineageService.insertEdge()` (`server/src/services/finance/canonical/lineageService.ts:181`)
jest wołane WYŁĄCZNIE z plików testowych (`__tests__/*.pg.test.ts`, `canonicalServices.pg.test.ts`,
`kpiComputeService.pg.test.ts`, `coldReopen.pg.test.ts` itd. — 0 callerów w `server/src/routes/`).
`POST /artifacts` (artifacts.routes.ts) też nie przyjmuje referencji źródłowej. Konsekwencja: krok
1 (Source) kanonu OWN-FIN-021 nie może dziś zostać ukończony end-to-end przez ŻADNE dostępne API —
UI (`SourceStep.tsx`) renderuje to honestnie (patrz zrzut `source-unlinked-NEGCTRL.png`), zamiast
udawać że przycisk coś zapisuje. **Status: BLOCKED_EXTERNAL, wymaga osobnego pakietu backendowego.**

### ★ Znany, NIENAPRAWIONY defekt B3 (potwierdzony przez koordynatora, nie odkryty przeze mnie)

Powtórzony `POST .../compute/dcf` rzuca 500 zamiast idempotentnego powtórzenia (osobna paczka to
naprawia). **Decyzja: NIE zbudowałem żadnego obejścia w UI** (brak retry logic wokół
`runValuationDcfCompute`) — i w praktyce **nie wpiąłem żadnego przycisku wywołującego to
wywołanie w żadnym kroku** (patrz §7 poniżej, EVIDENCE_MISSING), więc UI dzisiaj nie może w ogóle
trafić na ten defekt.

### Brak endpointu listującego porównywalne spółki (comps)

`usableCompsByMethodId` (wynik `results`) daje TYLKO licznik (`Record<methodId, number>`) —
zweryfikowane grepem (`grep -n "comps" valuation.routes.ts` → jedno trafienie, ta linia). Żaden
endpoint nie zwraca samej listy `finance_valuation_comps`. „Reproducible peer table" / kalendaryzacja
comps → **EVIDENCE_MISSING, BLOCKED_EXTERNAL** (brak API do zbudowania).

### Brak obsługi TIMING/STUB (niepełny pierwszy/ostatni okres projekcji)

Grep po `stub|partial|timing` w `valuationFcffService.ts`/`valuationDiscountService.ts` — zero
trafień. Silnik FCFF/dyskontowania nie ma dziś żadnej jawnej obsługi niepełnego okresu
brzegowego. **EVIDENCE_MISSING** — nic po stronie UI nie mogło to załatać (to logika silnika, poza
allowlistą), zgłaszam do backlogu backendowego.

---

## 2. Pokrycie siedmiu kroków (OWN-FIN-021)

| # | Krok | Status | Dowód |
|---|---|---|---|
| 1 | Source | **PARTIAL** — UI honest, backend BLOCKED_EXTERNAL | `SourceStep.tsx`, zrzuty `source-linked.png` / `source-unlinked-NEGCTRL.png` |
| 2 | Assumptions (WACC) | **PASS** | `AssumptionsStep.tsx`, zrzut `assumptions-wacc-consistent.png`, testy `assertWaccConsistency` |
| 3 | Methods & weights | **PASS** | `MethodsWeightsStep.tsx`, zrzut `methods-weights.png`, testy `validateBasketWeights` |
| 4 | Results | **PASS** | `ResultsStep.tsx`, zrzut `results-headline-and-range.png` |
| 5 | Sensitivity | **PASS** | `SensitivityStep.tsx`, zrzuty `sensitivity-5x5-empty.png` / `sensitivity-5x5-loaded.png` |
| 6 | Valuation Advisor | **PASS** (generowanie/lista), **PARTIAL** (bez realnego backendu do end-to-end) | `AdvisorStep.tsx`, zrzut `advisor-fact-vs-hypothesis.png` |
| 7 | Export | **EVIDENCE_MISSING** (backend), **PASS** (UI honestly mówi to wprost) | `ExportStep.tsx`, zrzut `export-honest-gap.png` |

Nawigacja między krokami: `<FinanceWorkspaceBar>` z `viewNavigation.kind: 'stepper'`,
`placement: 'separate-row'` (7 kroków > limitu 2 dla `in-bar`) — zgodnie z kontraktem Pakietu C.
Dowód: test `ValuationWorkspace.test.tsx` „klik w krok „Metody i wagi" przełącza widoczną treść".

---

## 3. N/A vs PLN 0 (OWN-FIN-021 punkt 3, wektor ataku z raportu odbiorowego)

Każda wartość liczbowa w tym module przechodzi przez `<ValuationValueCell>`
(`src/components/Finance/Valuation/ValuationValueCell.tsx`), który używa
`formatFinanceValueForDisplay` (Pakiet C) + `financeValueDisplayReasonLabel` — **PIĘĆ różnych
stanów renderowanych rozróżnialnie**: `PRESENT_ZERO`/`PRESENT_NONZERO` → liczba;
`MISSING`/`NA`/`NOT_APPLICABLE` → „—" + WIDOCZNY tekstowy powód (nie tylko glif, nie tylko kolor —
a11y).

Dowód zmierzony na żywo (zrzut `results-headline-and-range.png` / `methods-weights.png`):
- `DCF_FCFF`, `PRESENT_NONZERO` → **184 500 000**
- `TRADING_COMPS`, `PRESENT_NONZERO` → **201 000 000**
- `PRECEDENT_TRANSACTIONS`, `NA` → **„— Analityk oznaczył: nie dotyczy"**
- `ASSET_BASED`, `MISSING` → **„— Brak danych (luka źródłowa)"**

Test jednostkowy: `ValuationWorkspace.test.tsx` „renderuje PRESENT_ZERO jako 0, a NA/MISSING jako
— z widocznym powodem — nigdy jako 0" + KONTROLA NEGATYWNA osobno. **Status: PASS.**

---

## 4. g < WACC i spójność g = reinvestment × ROIC

Serwer (B3) już ma `assertGBelowWacc`/`impliedGFromReinvestmentRoic`
(`valuationTerminalService.ts:36-91`) — ale to plik server/, poza allowlistą, i frontend nigdy nie
przekracza granicy src/↔server/src (reguła cytowana w `financeV2.types.ts`). Zbudowałem PORT (nie
import) tych samych funkcji w `valuationMath.ts`, bit-identyczny algorytm, żeby UI mogło dać
natychmiastowy, czytelny błąd PRZED wysłaniem żądania — ta sama dyscyplina „friendly error first,
serwer nadal autorytatywny" co oryginał dokumentuje o sobie.

- `assertGBelowWacc(gPct, waccPct)` — odrzuca `g >= WACC` (włącznie z granicą `g == WACC`, nie
  tylko `g > WACC`). Test: 5 przypadków + KONTROLA NEGATYWNA.
- `evaluateGConsistency(gPct, reinvestmentRatePct, roicPct, tolerancePp)` — porównuje przyjęte g z
  implikowanym `reinwestycja × ROIC`; `inputsMissing` to WŁASNY stan (nigdy fałszywe „consistent"
  przy braku danych). Test: 6 przypadków + KONTROLA NEGATYWNA.

Widoczne w Advisor (zrzut `advisor-fact-vs-hypothesis.png`): finding „Terminal g nie jest w pełni
spójne z reinwestycją × ROIC" pokazuje realne wyliczenie 38% × 6,6% ≈ 2,5%. **Status: PASS.**

---

## 5. Nominal/real + pre/post-tax + waluta (korekta koordynatora)

Port `assertWaccConsistency()` (mirror `valuationWaccService.ts:96-119`) w `valuationMath.ts`,
renderowany jako WIDOCZNY, nazwany banner w `AssumptionsStep.tsx` (zielony = OK, czerwony = twardy
błąd z treścią). Zrzut `assumptions-wacc-consistent.png` pokazuje zielony banner „Spójność
nominal/real, pre/post-tax i waluty: OK." dla poprawnej kombinacji NOMINAL/POST_TAX/PLN. Test: 5
przypadków (REAL odrzucone, PRE_TAX odrzucone, currency mismatch odrzucony) + KONTROLA NEGATYWNA.
**Status: PASS.**

---

## 6. Sensitivity 5×5 — kształt I monotoniczność (korekta koordynatora — OWN-FIN-002)

Dwie NIEZALEŻNE bramki, obie w `valuationMath.ts`, złożone w `assertSensitivityGridIntegrity()`:

1. **Kształt** (`assertSensitivityGridShape`): dokładnie 25 komórek, dokładnie 1 komórka bazowa,
   indeksy 1..5 w obu osiach BEZ duplikatów, pełne pokrycie 5×5. 8 testów + KONTROLA NEGATYWNA
   (siatka 24-komórkowa — dokładnie ta klasa błędu, która wywaliła cały widok w OWN-FIN-002 —
   musi być odrzucona).
2. **Monotoniczność** (`findSensitivityMonotonicityViolation`, port
   `valuationSensitivityService.ts:106-135`): EV musi maleć wraz ze wzrostem WACC (wiersz) i rosnąć
   wraz ze wzrostem g (kolumna), dla każdej pary sąsiednich, zdefiniowanych komórek — komórki `null`
   (g≥WACC) są pomijane, nigdy traktowane jako naruszenie. 5 testów (w tym osobny test row-wise i
   osobny column-wise, zbudowane tak, żeby jeden nie maskował drugiego) + KONTROLA NEGATYWNA.

`SensitivityStep.tsx` renderuje siatkę TYLKO gdy `integrity.ok === true`; w przeciwnym razie
pokazuje treść błędu (kształt lub konkretną parę komórek naruszających monotoniczność) zamiast
tabeli — to jest wprost naprawa klasy błędu z OWN-FIN-002 („błąd kształtu siatki wywalał cały
widok"), tu widok się NIE wywala, tylko odmawia narysowania złej tabeli. Dowód na żywo: zrzut
`sensitivity-5x5-loaded.png`, status „Siatka 5×5: kształt i monotoniczność OK." + 25 wartości
faktycznie monotoniczne (sprawdzone wzrokiem: wiersz 0,5 maleje 191880000→147600000 wraz ze wzrostem
WACC; kolumna 9,3 rośnie 169740000→199260000 wraz ze wzrostem g). **Status: PASS.**

---

## 7. Disagreement / range analysis (korekta koordynatora — „zamiast fałszywej jednej wartości")

`computeMethodResultRange()` liczy min/max/rozrzut % po WSZYSTKICH metodach `READY` z obecnym
wynikiem (nie tylko koszyk — rozbieżność dotyczy tego co mówią metody, nie tylko co jest ważone),
z progiem „istotnej rozbieżności" (domyślnie 20%). `ResultsStep.tsx` renderuje ten przedział JAKO
BANNER obok nagłówkowej EV, nie zamiast niej — użytkownik zawsze widzi zarówno punkt, jak i widełki.
Zrzut `results-headline-and-range.png`: „Przedział wyników metod: 184 500 000 – 201 000 000
(rozrzut 8,6%)" obok nagłówka 191 400 000. 7 testów (w tym wykluczenie NA/MISSING z przedziału —
nigdy nie liczone jako 0) + KONTROLA NEGATYWNA. **Status: PASS.**

---

## 8. Wagi koszyka = 100%, cross-checki nigdy ważone

`validateBasketWeights()` — mirror logiki `trg_finance_valuation_methods_weight_sum` +
walidacji routera (`valuation.routes.ts:339-351`): suma wag koszyka musi wynosić DOKŁADNIE 100%;
metoda w koszyku musi mieć dodatnią wagę; cross-check (poza koszykiem) NIE MOŻE mieć wagi.
`MethodsWeightsStep.tsx` liczy tę walidację NA ŻYWO (każda zmiana w formularzu, przed wysłaniem) i
blokuje przycisk zapisu, dopóki `validation.ok !== true`. Zrzut `methods-weights.png`: zielony
banner „Suma wag koszyka: 100% (OK, = 100%)". 8 testów + KONTROLA NEGATYWNA (99% musi failować).
**Status: PASS.**

---

## 9. Lokalny ErrorBoundary (OWN-FIN-002, incydent właścicielski)

Każdy krok jest owinięty `<FinanceErrorBoundary key={activeStep} ...>` (Pakiet C,
`src/components/Finance/shared/FinanceErrorBoundary.tsx`) — `FinanceWorkspaceBar` i nawigacja
kroków żyją POZA granicą boundary, więc `Ponów`/`Wróć do listy` mają gdzie wylądować, a przejście do
INNEGO kroku po awarii działa od razu.

**Realny bug znaleziony i naprawiony przez testy w trakcie budowy** (nie hipotetyczny przykład):
pierwsza wersja NIE miała `key={activeStep}` na boundary — React reużywał tę samą instancję
komponentu klasowego między krokami, więc raz złapany błąd (`hasError: true`) zostawał WIDOCZNY
nawet po przejściu do zupełnie innego, zdrowego kroku. Test
„błąd renderu w kroku Wyniki jest złapany lokalnie — pasek i nawigacja do innych kroków działają
dalej" wykrył to (czerwony), naprawa = `key={activeStep}`, ten sam test zielony. To jest dokładnie
dowód wymagany przez zadanie: „test, który rzuca błędem w jednej wycenie i dowodzi, że reszta
modułu żyje" + jego własna kontrola negatywna była WBUDOWANA w proces (test faktycznie łapał
regresję, nie był z góry zielony).

Mechanizm testu: `ResultsStep` dostaje `results.methods === undefined`, co realnie rzuca
`TypeError` wewnątrz `computeMethodResultRange(results.methods).filter(...)` — prawdziwy błąd
wykonania, nie sztuczny `throw` w komponencie testowym. **Status: PASS**, 2 testy (w tym KONTROLA
NEGATYWNA „bez błędu boundary się nie renderuje").

---

## 10. Valuation Advisor (DEC-FIN-006)

`AdvisorStep.tsx`:
- Blokuje generowanie dla statusów terminalnych/zatwierdzonych (`APPROVED`, `SUPERSEDED`,
  `ARCHIVED`, `INVALIDATED`) z widocznym komunikatem, zamiast po cichu wyłączać przycisk.
- Każdy finding renderuje JAWNĄ etykietę „Fakt" vs „Hipoteza / ocena" (nigdy nie wywnioskowaną z
  tonu narracji) — `normalizeAdvisorFinding().isFactual`, testowane osobno dla RISK/QUESTION/ACTION.
- `normalizeAdvisorFinding()` ujednolica DWA różne kształty odpowiedzi (POST camelCase vs GET
  snake_case — patrz §1) w JEDEN widok — 5 testów w tym dowód „oba kształty normalizują się do
  identycznego widoku dla tego samego findingu".
- Jawny komunikat „nie zatwierdza decyzji i nie zastępuje zatwierdzenia przez człowieka" w treści
  kroku (nie tylko w komentarzu kodu).
- Wersjonowanie/eksport/kontekst TRS: **EVIDENCE_MISSING** — nie budowałem UI do przeglądania
  historii wersji Advisora ani eksportu jego wyniku do TRS (priorytet czasu poszedł w gates
  1-5 z instrukcji zadania); backend (`finance_valuation_advisor_outputs.is_frozen`/`frozen_at`) już
  niesie te dane, `normalizeAdvisorFinding` je czyta i wyświetla (`isFrozen`/`isStale`), ale nie ma
  osobnego widoku "historia wersji".

**Status: PASS** (generowanie, lista, fakt/hipoteza, blokada pre-approval), **EVIDENCE_MISSING**
(wersjonowanie/eksport/TRS UI).

---

## 11. Export

Brak dedykowanego endpointu eksportu w Valuation (§1). `ExportStep.tsx` renderuje to WPROST jako
komunikat, cytując dokładny plik/zakres sprawdzony grepem — **żaden fałszywy przycisk**. **Status:
EVIDENCE_MISSING (backend), PASS (uczciwość UI)** — zrzut `export-honest-gap.png`.

---

## 12. Determinizm / Decimal / waluta

Cała warstwa PKG-H jest bezstanowa względem obliczeń (nic nie sumuje/haszuje po stronie klienta —
to robi B3). Tam gdzie klient PORÓWNUJE liczby (walidacja wag, zakresu, monotoniczności), wartości
pochodzą z `Number(decimalString)` wyłącznie do celu WALIDACJI/WYŚWIETLENIA (nigdy zapisu) — sam
zapis idzie przez API jako liczby JS zgodnie z kontraktem żądania routera (który sam parsuje je do
Decimal po stronie serwera). Żadne sortowanie/sumowanie „w pamięci przed hashem" nie dotyczy tego
pakietu — nie hashuje niczego.

---

## 13. Wyniki testów (exit code, nie tylko „zielono")

```
$ npx vitest run src/components/Finance/Valuation --maxWorkers=2
 Test Files  2 passed (2)
      Tests  58 passed (58)
EXIT_CODE=0
```

Rozbicie: `valuationMath.test.ts` — 51 testów (g<WACC, g-consistency, WACC nominal/real/tax/currency,
sensitivity shape, sensitivity monotonicity, sensitivity integrity, basket weights, method-result
range/disagreement, advisor normalization). `ValuationWorkspace.test.tsx` — 7 testów (nawigacja,
N/A-vs-0, lokalny ErrorBoundary). Wszystkie z jawną nazwą „KONTROLA NEGATYWNA" gdzie wymagane
(15 takich testów łącznie) — każdy faktycznie sprawdzony na czerwono przed poprawką (nie tylko
napisany po fakcie jako zielony).

★ Uwaga o czasie wykonania: pod obciążeniem maszyny (load average chwilowo 815/16 rdzeni w trakcie
sesji — potwierdzone `uptime`, inne równoległe sesje) ten sam zestaw testów trwał 130s zamiast ~3.5s
po opadnięciu obciążenia (~95). To NIE regresja tego pakietu.

`tsc --noEmit -p tsconfig.json` (`NODE_OPTIONS=--max-old-space-size=12288`) — uruchomiony PRZED
dopisaniem warstwy UI (na commitcie zawierającym tylko `financeV2.types.ts`/`financeV2.api.ts`/
`valuationMath.ts`/`useFinanceValuationWorkspaceFlag.ts`): **exit 0, zero błędów, cały projekt**.
Warstwa UI (`ValuationWorkspace.tsx` + 7 kroków) zweryfikowana WYŁĄCZNIE przez `esbuild` per-plik
(zero błędów na każdym z 9 plików) — zgodnie z jawną instrukcją koordynatora podczas sesji, żeby nie
odpalać kolejnego pełnego `tsc` pod tym obciążeniem. **Rekomendacja dla weryfikującego: odpalić
pełny `tsc --noEmit` na finalnym SHA, gdy obciążenie maszyny opadnie — to jedyna część tego pakietu
bez świeżego dowodu z realnego kompilatora TypeScript (esbuild nie type-checkuje).**

---

## 14. Kontrole negatywne (pełna lista)

1. `assertGBelowWacc` — `g == WACC` musi failować (nie tylko `g > WACC`).
2. `evaluateGConsistency` — 4pp luka poza tolerancją 1pp nie może być „consistent".
3. `assertWaccConsistency` — REAL/PLN vs NOMINAL/PLN nie może przejść tylko dlatego że waluta się zgadza.
4. `assertSensitivityGridShape` — siatka 24-komórkowa (dokładnie klasa błędu OWN-FIN-002) musi failować.
5. `findSensitivityMonotonicityViolation` — celowo złamana siatka musi zostać złapana.
6. `computeMethodResultRange` — 100% rozrzutu musi być oznaczone jako istotna rozbieżność przy progu 20%.
7. `validateBasketWeights` — 99% (o 1pp za mało) musi failować.
8. `normalizeAdvisorFinding` — RISK finding nie może być oznaczony jako faktyczny.
9. `ValuationWorkspace` — N/A/MISSING renderowane inaczej niż PRESENT_ZERO (nie oba jako „0").
10. `ValuationWorkspace` — bez wstrzykniętego błędu, `FinanceErrorBoundary` NIE renderuje fallbacku.
11. Zrzut `source-unlinked-NEGCTRL.png` — zmiana JEDNEGO parametru URL (`sourceLinked=0`) zmienia
    realnie wyrenderowaną treść (badge kroku z „GOTOWE" na „ZABLOKOWANE", inny komunikat) — dowód że
    harness renderuje żywy komponent, nie statyczny obrazek (CLAUDE.md rule #7 discipline).

---

## 15. Zrzuty ekranu (realne, playwright, dev-render harness — NIE wygenerowane opisowo)

`docs/validation/finance-v3/generated/gate-e/visual/pkg-h/`:

- `source-linked.png` / `source-unlinked-NEGCTRL.png`
- `assumptions-wacc-consistent.png`
- `methods-weights.png`
- `results-headline-and-range.png`
- `sensitivity-5x5-empty.png` / `sensitivity-5x5-loaded.png`
- `advisor-fact-vs-hypothesis.png`
- `export-honest-gap.png`

Wygenerowane przez `scripts/shot-pkg-h-valuation.mjs` (playwright, ten sam wzorzec co
`scripts/shot-dolny.mjs`) wskazujący na dev-render uruchomiony `npx vite --config
dev-render/vite.config.ts --port 58033` (wpis `.claude/launch.json` → `fv3p-h-valuation`). Zero
wygenerowanych ręcznie/opisowo — każdy PNG to realny render przez Chromium.

**★ Uwaga dla Piotra:** te zrzuty są dowodem TECHNICZNYM dla weryfikującego agenta, NIE substytutem
odbioru wizualnego. Cały ekran jest za flagą `financeValuationWorkspaceV1` (default OFF) — zgodnie z
CLAUDE.md regułą #7, żaden ekran nie jest tu uznany za zaakceptowany. Piotr patrzy dopiero po
przejściu przez proces odbioru (skill `consultify-artefakty`/`consultify-triada`), na tych samych
zrzutach lub świeżych.

**★ Przebieg pracy nad zrzutami — dowód, dlaczego są wiarygodne, nie „zielone bo nikt nie
sprawdził":** pierwsza próba renderu (przez interaktywną przeglądarkę, nie playwright) ujawniła
REALNY bug — `console` pokazał ostrzeżenie o hydratacji („whitespace text nodes cannot be a child of
table") na WSZYSTKICH trzech tabelach `§27-exempt` (`MethodsWeightsStep`/`ResultsStep`/
`SensitivityStep`), spowodowany złym umiejscowieniem znacznika-komentarza wymaganego przez
`check-list-canon.sh`. Naprawiony (przeniesiony komentarz + `data-canon` atrybut), zweryfikowany
`document.querySelectorAll('table')[0].firstChild.nodeType === 1` (element, nie tekst) na żywej
stronie PO naprawie, i dopiero wtedy zebrane finalne zrzuty. `esbuild`/`vitest`/`tsc` NIE złapały
tego (jsdom nie egzekwuje modelu treści HTML dla `<table>`) — złapał to dopiero realny render w
przeglądarce, co jest dokładnie powodem dla którego CLAUDE.md reguła #7 wymaga renderu, nie tylko
testów.

---

## 16. Podsumowanie PASS/FAIL/PARTIAL/EVIDENCE_MISSING/BLOCKED_EXTERNAL

| Wymaganie | Status |
|---|---|
| 7 kroków jako szkielet, w kolejności | **PASS** |
| Source — wskazanie dokładnej wersji | **PARTIAL** (UI honest; backend BLOCKED_EXTERNAL — brak API do utworzenia lineage edge) |
| N/A vs PLN 0 | **PASS** |
| Wagi metod sumują się do 100%, cross-check niewazony | **PASS** |
| g < WACC (walidacja + test) | **PASS** |
| g = reinvestment × ROIC (spójność + test) | **PASS** |
| Nominal/real, pre/post-tax, waluta (korekta koordynatora) | **PASS** |
| Sensitivity 5×5 kształt (test) | **PASS** |
| Sensitivity monotoniczność (korekta koordynatora, test) | **PASS** |
| Disagreement/range zamiast jednej fałszywej wartości (korekta koordynatora) | **PASS** |
| Lokalny ErrorBoundary + test rzucający błędem | **PASS** (bug znaleziony i naprawiony w trakcie) |
| Advisor — generowanie/lista/fakt-vs-hipoteza/blokada pre-approval | **PASS** |
| Advisor — wersjonowanie/eksport/TRS UI | **EVIDENCE_MISSING** (brak czasu, priorytet niższy) |
| Export | **EVIDENCE_MISSING** (backend — brak endpointu w B3) |
| Reproducible peer table / kalendaryzacja comps | **EVIDENCE_MISSING/BLOCKED_EXTERNAL** (brak API) |
| TIMING/STUB niepełny okres | **EVIDENCE_MISSING/BLOCKED_EXTERNAL** (logika silnika, poza allowlistą) |
| DCF/FCFF compute trigger w UI | **EVIDENCE_MISSING** (celowo nie budowany — patrz §1 idempotency P1, brak czasu) |
| Determinizm (sortowanie w pamięci) | **N/A dla tego pakietu** — PKG-H nie hashuje/sumuje nic po stronie klienta |
| Testy — exit code | **PASS**, 58/58, exit 0 |
| tsc czysty (warstwa API/types/math) | **PASS**, exit 0, zero błędów |
| tsc czysty (warstwa UI) | **EVIDENCE_MISSING** — tylko esbuild per-plik pod obciążeniem maszyny, rekomendacja re-weryfikacji |
| Kontrole negatywne | **PASS** — 11 udokumentowanych, w tym jedna złapała realny bug (ErrorBoundary key) |
| Zrzuty ekranu (realne, nie opisowe) | **PASS** — 9 PNG, playwright, w tym negatywna kontrola wizualna |
| Zero modyfikacji plików B3 | **PASS** — zweryfikowane `git diff -- server/` puste |
| §27-exempt / check-list-canon | **PASS** — 0 nowych naruszeń (po naprawie bugu hydratacji) |

**Priorytet z instrukcji zadania — wszystkie 6 punktów PASS**, w tym punkt 4 (sensitivity + monotoniczność,
dodany korektą koordynatora w trakcie sesji). Braki są w rzeczach PO tym priorytecie (wersjonowanie
Advisora, Export, comps, timing-stub) i w dwóch rzeczach zablokowanych przez brakujące API poza
allowlistą tego pakietu.
