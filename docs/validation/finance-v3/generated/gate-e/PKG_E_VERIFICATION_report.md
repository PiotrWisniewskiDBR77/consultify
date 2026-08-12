# PKG_E — Analysis (KPI) — RAPORT WERYFIKACJI NIEZALEŻNEJ

Weryfikator: sesja niezależna od autora. Nastawienie: zakładam zawyżenie, dopóki
sam nie zmierzę. Wszystkie pomiary poniżej wykonane OSOBIŚCIE w tej sesji,
worktree `/Users/piotrwisniewski/consultify-wt/fv3p-e-analysis`, gałąź
`codex/fv3p-e-analysis` @ `b81684d312` (baza `45c39d68d0`). Drzewo było czyste
na starcie i jest czyste na końcu (każdy sabotaż przywrócony `git checkout HEAD --
<plik>`, zweryfikowane `git status --short`).

## Tabela weryfikacji

| # | Twierdzenie autora | Mój pomiar | Werdykt |
|---|---|---|---|
| 1 | 117/117 testów, exit 0, dwukrotnie | Uruchomione SAM z korzenia repo, `--maxWorkers=2`: `Test Files 7 passed (7)`, `Tests 117 passed (117)`, `EXIT: 0`. | **POTWIERDZONE** |
| 2 | Pełny `tsc --noEmit` — autor NIE podał wyniku | Uruchomiłem SAM DWUKROTNIE z korzenia (`NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit -p tsconfig.json`), pełne 9m28s, **0 błędów, exit 0** za każdym razem (nie 134/OOM). Root `tsconfig.json` NIE wyklucza plików testowych (`include: ["src", ...]`, `exclude` nie zawiera `__tests__`) — więc to jest realny pełny przebieg, nie zafałszowany przez pominięcie testów. **Nie znalazłem analogicznej dziury typów jak w pakiecie D.** | **POTWIERDZONE** (pozytywny wynik silniejszy niż twierdzenie autora — autor jawnie NIE zmierzył, ja zmierzyłem: czysto) |
| 3 | `AnalysisKpiTable` mapowała 1 wiersz = (KPI×okres); naprawa `groupAnalysisKpiValuesByKpi` grupuje po KPI, sortuje w pamięci | Porównałem `git show 1aa63c0385:.../analysisKpiTable.contract.ts` (WIP) z HEAD: WIP miał `toAnalysisKpiTableRow(input:{kpiValue: AnalysisKpiValueDto, priorPeriodValue,...})` — **jeden DTO, brak `periodValuesByColumnId`**, defekt realny. HEAD: `groupAnalysisKpiValuesByKpi` grupuje `Map<kpiCode, entries[]>`, sortuje `sortedKpiCodes = [...byKpiCode.keys()].sort((a,b)=>a.localeCompare(b))` — sortowanie W PAMIĘCI, deterministyczne. | **POTWIERDZONE** |
| 4 | Silnik known-answer przeszedł z `number` na `Decimal` | `analysisKpiCompute.ts` — potwierdzone czytaniem: `ExpressionParser` operuje na `Decimal` przez cały łańcuch, jedyna konwersja do `number`/`string` na granicy. Sabotaż SAM: podmieniłem `left.plus(right)` na `new Decimal(left.toNumber()+right.toNumber())` → test poszedł czerwony z DOKŁADNIE `0.30000000000000004` (nie 0.3), przywrócone → zielony. **ALE**: `computeYoyDelta` w `analysisKpiTable.contract.ts:46-47` (realna ścieżka produkcyjna, kolumna "Zmiana r/r" w tabeli) używa `Number(current.valueDecimal)`/`Number(prior.valueDecimal)` — CZYSTY FLOAT, nie Decimal. Sprawdzone `git show 2fbba798fe --stat`: ten commit ("switch known-answer engine to Decimal") dotknął WYŁĄCZNIE `analysisKpiCompute.ts` + jego test, NIGDY `analysisKpiTable.contract.ts`. `AnalysisKpiDetailCard.tsx:40` też ma `Number(p.value.valueDecimal)` (dla punktów wykresu — mniej krytyczne, cel wizualny). | **CZĘŚCIOWO POTWIERDZONE** — twierdzenie było wąsko sformułowane ("silnik known-answer") i to jest prawdą, ale realna ścieżka obliczeniowa produkcyjna (YoY delta w tabeli) NADAL używa float. Ryzyko praktyczne niskie (wynik zaokrąglany do 1 miejsca po przecinku), ale to jest niespójność z regułą "Decimal wszędzie w ścieżce obliczeniowej" — patrz nowy defekt niżej. |
| 5 | ★ Podłączono piąty stan `NOT_APPLICABLE` | Zweryfikowałem TRZY warstwy osobno (patrz sekcja dedykowana niżej). WYNIK: prezentacja (Pakiet C, reużyta niezmieniona) poprawnie odróżnia etykietę; **serwer MOŻE wyemitować `NOT_APPLICABLE`**, ale WYŁĄCZNIE przez `negative_denominator_policy='FORCE_NA'` w `formulaAstEvaluator.ts` (mechanizm "ujemny mianownik", NIE "strukturalna niestosowalność branżowa"); mechanizm `isStructurallyApplicable` z raportu autora (przykład: rotacja zapasów dla firmy usługowej) istnieje WYŁĄCZNIE w samodzielnym `analysisKpiCompute.ts` (`grep` potwierdza: używany tylko w tym pliku + jego teście, ZERO importów w `AnalysisWorkspace.tsx`/`AnalysisKpiTable.tsx`/`AnalysisCreatorWizard.tsx`/dev-render). | **CZĘŚCIOWO POTWIERDZONE, ZAWYŻONE we frazowaniu** — patrz rozstrzygnięcie niżej. |
| 6 | `yoyDelta`/`benchmark` render crash — realny, złapany testem DOM | Cofnąłem naprawę SAM: `git show f846a7900e:.../analysisKpiTable.contract.ts > .../analysisKpiTable.contract.ts` (usuwa `render`/`formatYoyDeltaText`/`formatBenchmarkText`) → uruchomiłem smoke+contract test → **CZERWONE**: `Error: Objects are not valid as a React child (found: object with keys {status, absoluteDelta, percentDelta})`, dokładnie ta sama treść błędu co w raporcie autora. Przywróciłem `git checkout HEAD --` → **ZIELONE** (28/28). | **POTWIERDZONE** (zweryfikowane pełnym cyklem czerwony→zielony) |
| 7 | Kontrole negatywne przez sabotaż — powtórzone SAM ≥2 | Wykonałem SAM: (a) sabotaż Decimal→float w `analysisKpiCompute.ts` (czerwony z dokładną wartością IEEE-754, przywrócone, zielony); (b) cofnięcie naprawy render-crash w `analysisKpiTable.contract.ts` (czerwony z identycznym błędem React, przywrócone, zielone 28/28). Drzewo czyste po obu (`git status --short` puste). | **POTWIERDZONE** |
| 8 | Naprawiono wymyślone tokeny Tailwinda | Wypisałem WSZYSTKIE klasy `bg-/text-/border-/ring-/fill-/outline-` z 4 plików komponentów pakietu E i skonfrontowałem z `tailwind.config.js`: `c.bg`, `c.surface`, `c['surface-raised']`, `c['border-strong']`, `c['border-subtle']`, `c.text`, `c['text-secondary']`, `c['text-muted']`, `c.success/warning/danger`, `c.focus`, `state.selected` — WSZYSTKIE istnieją w configu. Zero `primary-*` (jedyne wystąpienie słowa `primary` to klucz obiektu `StandardRowMenu.primary`, nie klasa CSS). | **POTWIERDZONE** |
| 9 | ★ Crimson tylko semantyka krytyczna, fokus niebieski | Grep `primary\|#85182F\|85182f\|crimson` w plikach pakietu E → jedyne trafienie jest strukturą danych (`rowMenu.primary`), nie klasą CSS. `ring-c-focus` używany na interaktywnych elementach (potwierdzone zrzutem: fokus modal/input). Zero `bg-c-accent`/crimson na CTA — CTA neutralne (`bg-c-text`/`text-c-surface`), zweryfikowane wizualnie (zrzut `approved-dark.png`: CTA "Otwórz ponownie" białe/neutralne, nie czerwone). | **POTWIERDZONE** |
| 10 | Allowlist: `financeV2.api.ts`/`financeV2.types.ts` tylko DODANE | `git diff 45c39d68d0..HEAD -- financeV2.api.ts` — wyłącznie nowy import + 4 nowe funkcje eksportowane w bloku `// --- PKG-E Analysis ---` … `// --- /PKG-E Analysis ---`, dopisane do `FinanceV2Api` bez usunięcia żadnego istniejącego pola. `financeV2.types.ts` — wyłącznie nowe typy/interfejsy + 2 nowe gałęzie `case` w `describeFinanceV2Error` (żadna cudza gałąź nietknięta). | **POTWIERDZONE** |
| 11 | Testy NIE osłabione względem WIP `1aa63c0385` | `git diff 1aa63c0385..HEAD` na 3 z 5 dziedziczonych plików testowych (`analysisKpiCatalog.test.ts`, `analysisWorkspace.contract.test.ts`, `financeV2.analysis.api.test.ts`) = **0 zmienionych linii** (bit-identyczne). Pozostałe 2 (`analysisKpiCompute.test.ts`, `analysisKpiTable.contract.test.ts`) mają usunięte linie, ale to REFAKTOR pod zmianę sygnatury (Decimal, grupowanie po KPI) — usunięte asercje ZASTĄPIONE odpowiednikami (np. `.toBe(3)` → `num(...)).toBe(3)` z nowym helperem `num()`, plus DODANY nowy test `toBeInstanceOf(Decimal)`). Zero `.skip`/`.only`/`xit`/`describe.skip` w całym pakiecie (grep, zero trafień). | **POTWIERDZONE** |
| 12 | Brak endpointu zapisu wyboru kreatora — BLOCKED_EXTERNAL | Przeczytałem `analysis.routes.ts` w całości: tylko 3 route'y (`GET /analysis/kpi-catalog`, `POST /analysis/:id/compute`, `GET /analysis/:id/kpi-values`) — zero writera. `grep -rn insertEdge server/.../*.routes.ts` = **zero trafień** (funkcja `insertEdge` w `lineageService.ts` istnieje, ale żaden router jej nie woła) — potwierdza brak zapisu `STATEMENT_TO_ANALYSIS`. `artifacts.routes.ts` ma tylko `GET /artifacts/:id` (pojedynczy) i `GET /artifacts/:id/versions` — brak `GET /artifacts?type=`. Benchmark: `analysis.routes.ts:167` hardkoduje `benchmark: null` w odpowiedzi. | **POTWIERDZONE** (trzeci niezależny pakiet potwierdzający ten sam brak) |

## Rozstrzygnięcie punktu 5 — NOT_APPLICABLE: serwis/dane czy tylko prezentacja?

Trzy warstwy sprawdzone osobno:

1. **`statementMappingService.ts` (surowe linie sprawozdań)** — `valueStatusFor()`
   (linia 179-183) produkuje WYŁĄCZNIE `MISSING`/`PRESENT_ZERO`/`PRESENT_NONZERO`.
   Potwierdza to, co ustaliły dwa inne pakiety (oracle GoldCo, weryfikator D) —
   ale to jest funkcja dla SUROWYCH WARTOŚCI LINII sprawozdania, nie dla
   OBLICZONYCH WARTOŚCI KPI. Inna warstwa danych niż ta, którą konsumuje
   Pakiet E.
2. **`kpiComputeService.ts`/`formulaAstEvaluator.ts` (obliczone wartości KPI —
   TA warstwa, którą realnie woła `POST /analysis/:id/compute`)** —
   `formulaAstEvaluator.ts:299-308`: gdy `negative_denominator_policy='FORCE_NA'`
   i mianownik ujemny, funkcja zwraca `status: 'NOT_APPLICABLE'` (komentarz w
   kodzie cytuje ADR 6.5). To JEST realna, serwerowa, DZIAŁAJĄCA ścieżka —
   `NOT_APPLICABLE` NIE jest martwy dla wartości KPI, w przeciwieństwie do
   surowych linii sprawozdania. Ale semantyka jest INNA niż ta, którą opisuje
   raport autora — to jest decyzja polityki "ujemny mianownik", NIE "ten
   wskaźnik strukturalnie nie dotyczy tej branży".
3. **`isStructurallyApplicable` (koncept autora: rotacja zapasów dla firmy
   usługowej)** — `grep -rn isStructurallyApplicable src/ server/` daje
   trafienia WYŁĄCZNIE w `analysisKpiCompute.ts` i jego własnym pliku testowym.
   Ten parametr NIE istnieje w żadnym DTO backendu, NIE jest wołany z
   `AnalysisWorkspace.tsx`, `AnalysisKpiTable.tsx`, `AnalysisCreatorWizard.tsx`
   ani z dev-render harnessu. `analysisKpiCatalog.ts` importuje z
   `analysisKpiCompute.ts` WYŁĄCZNIE `evaluateArithmeticExpression` (walidacja
   formuł), nigdy `computeKnownAnswerKpi`/`isStructurallyApplicable`.

**Werdykt**: Twierdzenie "podłączono piąty stan NOT_APPLICABLE" jest
ZAWYŻONE w konkretnym punkcie — sugeruje mechanizm strukturalnej
niestosowalności branżowej, którego backend NIE ma i którego Pakiet E NIE
podłączył do żadnej realnie używanej ścieżki UI. To, co jest prawdą: (a)
Pakiet C (nietknięty przez E) już poprawnie WYŚWIETLA `NOT_APPLICABLE`, jeśli
kiedykolwiek przyjdzie z API; (b) backend MOŻE realnie wyemitować
`NOT_APPLICABLE`, ale z innego powodu (ujemny mianownik + FORCE_NA), nie z
powodu opisanego w raporcie; (c) `isStructurallyApplicable` to
samodzielny, niepodłączony dowód koncepcyjny w silniku testowym pakietu E,
nie "podłączenie" w sensie produkcyjnym. Autor NIE skłamał (jego własny
raport jasno mówi "TYLKO do dowodu, NIE duplikat/zamiennik realnego silnika
backendowego" — cytat z komentarza w `analysisKpiCompute.ts`), ale
podsumowujące zdanie w tabeli PASS/FAIL ("N/A z powodem, 3(→5) różne stany |
PASS") zaciera tę różnicę dla czytelnika, który nie zajrzy do kodu.

## Nowe defekty znalezione w tej weryfikacji (NIE zgłoszone przez autora)

### D1 — `computeYoyDelta` liczy na floatach, nie na Decimal
`src/components/Finance/Analysis/analysisKpiTable.contract.ts:46-47`:
```ts
const currentNum = Number(current.valueDecimal);
const priorNum = Number(prior.valueDecimal);
```
To jest realna ścieżka produkcyjna (kolumna "Zmiana r/r" w `AnalysisKpiTable`,
zasilana bezpośrednio danymi z API `GET /analysis/:id/kpi-values`), nie tylko
silnik testowy. Konwertuje `valueDecimal` (string pełnej precyzji) do JS
`number` i liczy różnicę/iloraz float-em. Ryzyko praktyczne niskie (wynik
zaokrąglany do 1 miejsca po przecinku w `formatYoyDeltaText`), ale narusza
literalnie regułę koordynatora "cała arytmetyka pośrednia jako Decimal" i jest
niespójne z tym, co `analysisKpiCompute.ts` faktycznie robi poprawnie obok.
Severity: NISKA (brak widocznego błędu w praktyce dla typowych wielkości
finansowych), ale realna niespójność inżynierska.

### D2 — Surowy status źródła wycieka do UI (kreator, krok 1)
`src/components/Finance/Analysis/AnalysisCreatorWizard.tsx:198`:
```tsx
{opt.entityLabel} · v{opt.versionNo} · {opt.status}
```
`opt.status` to surowy string z backendu (`AnalysisCreatorSourceOption.status:
string`, np. `"APPROVED"`/`"DRAFT"`/`"IN_REVIEW"`) renderowany BEZ tłumaczenia
na etykietę. Zweryfikowane zrzutem `wizard-step1.png` — karta źródła pokazuje
dosłownie "DBR77 Sp. z o.o. · v2 · APPROVED". Dokładnie wzorzec (b) z briefu
("surowe enumy techniczne wyciekające do UI jako etykiety").

### D3 — Surowy kod branży wycieka do UI (kreator, krok 5 — podsumowanie preflight)
`src/components/Finance/Analysis/AnalysisCreatorWizard.tsx:381`:
```tsx
<p>Branża: {state.industryCode ?? '—'}{state.goal ? ` · Cel: ${ANALYSIS_CREATOR_GOAL_LABELS_PL[state.goal]}` : ''}</p>
```
Pokazuje surowy `state.industryCode` (np. `"MANUFACTURING"`) zamiast
tłumaczenia — zweryfikowane zrzutem `wizard-step5-preflight.png`
("Branża: MANUFACTURING"). To jest SZCZEGÓLNIE łatwe do naprawienia: ten sam
plik ma już strukturę `preset.labelPl` (użytą 130 linii wyżej w kroku 3, gdzie
identyczny kod branży poprawnie renderuje się jako "Produkcja") oraz
analogiczny wzorzec `ANALYSIS_CREATOR_GOAL_LABELS_PL[state.goal]` DWA TOKENY
DALEJ W TEJ SAMEJ LINII — `goal` jest przetłumaczony, `industryCode` obok
niego nie jest. Kontrast dowodzi, że to przeoczenie, nie świadoma decyzja.

### Sprawdzone i NIE potwierdzone jako defekt pakietu E
Pływające przyciski "← Lista"/"Uwagi" widoczne na WSZYSTKICH zrzutach —
zweryfikowane `grep`: pochodzą z `dev-render/PanelUwag.tsx` (chrome harnessu
dev-render, wspólne dla wszystkich pakietów renderowanych tym narzędziem), NIE
z `AnalysisWorkspace.tsx`. Nie jest to defekt produkcyjny tego pakietu.

## Zrzuty — wykonane SAM, Playwright, `1440×900`

Serwer: `npx vite --config dev-render/vite.config.ts --port 58177 --strictPort`
(z korzenia worktree). Wszystkie zrzuty zapisane w
`docs/validation/finance-v3/generated/gate-e/screens/`:

| Plik | Opis |
|---|---|
| `draft-with-kpis-light.png` / `-dark.png` | Tabela z 3 KPI, kolumny okresów wypełnione, "Zmiana r/r" -100.0%/+14.3% |
| `draft-empty-light.png` / `-dark.png` | Pusty stan, CTA "Skonfiguruj wskaźniki" ×2 (pasek + panel) |
| `approved-light.png` / `-dark.png` | Status "Zatwierdzone" (zielony badge), CTA "Otwórz ponownie" neutralne (nie crimson) |
| `missing-values-light.png` / `-dark.png` | MISSING i NOT_APPLICABLE — oba renderują „—", zero surowego enuma w komórce |
| `detail-card-inventory-days.png` | Karta szczegółowa dla statusu `NA` — etykieta "Analityk oznaczył: nie dotyczy" (Pakiet C, nietknięte) |
| `wizard-step1.png` | Krok 1 — **D2**: "APPROVED" surowe w podpisie karty źródła |
| `wizard-step2-periods.png` / `-checked.png` | Krok 2 — gate liniowy (Dalej disabled→enabled) |
| `wizard-step3.png` / `-selected.png` | Krok 3 — wybór branży "Produkcja" (poprawnie przetłumaczone) |
| `wizard-step4.png` | Krok 4 — 3 KPI pre-zaznaczone po wyborze branży (2 uniwersalne + 1 branżowy), potwierdza rekomendację addytywną |
| `wizard-step5-preflight.png` | Krok 5 — preflight wykrywa brak INVENTORY (zgodne z raportem); **D3**: "Branża: MANUFACTURING" surowe |
| `wizard-step6-create.png` | Krok 6 — payload JSON + CTA "Utwórz i przelicz" aktywny |

Zero błędów konsoli/JS (`page.on('pageerror'/'console error')`) na żadnym z 8
scen (2 motywy × 4 sceny) ani w pełnym przejściu kreatora.

## Ocena wizualna

Wygląd zgodny z kanonem: tokeny `c-*` poprawnie odwracane dark/light, CTA
neutralne (nigdy crimson), fokus niebieski (`ring-c-focus`), brak wymyślonych
klas. Dwa nowe drobne defekty (D2, D3) to surowe enumy w UI kreatora —
kosmetyczne, ale realne i łatwe do naprawienia (wzorzec tłumaczenia już
istnieje w tym samym pliku). Pływające przyciski dev-render to szum
narzędziowy, nie produkt.

## Ocena końcowa

**PASS z zastrzeżeniami (PARTIAL na 2 podpunktach: D1 niespójność
Decimal/float w YoY, D2+D3 surowe enumy w kreatorze; punkt 5 wymaga
doprecyzowania we własnym raporcie autora — "podłączono NOT_APPLICABLE" jest
prawdą tylko częściowo i tylko w wąskim, niepodłączonym do UI zakresie).**

Rdzeń pracy (117/117 testów zielonych własnym pomiarem, pełny `tsc --noEmit`
czysty własnym pomiarem — mocniejszy wynik niż to, co autor sam zadeklarował,
realna naprawa grupowania KPI, realna naprawa render-crash potwierdzona
cyklem czerwony/zielony, allowlist respektowana, brak osłabionych testów,
BLOCKED_EXTERNAL potwierdzone trzecim niezależnym pakietem) jest solidny i
UCZCIWIE opisany przez autora — żadne z jego twierdzeń nie okazało się
fałszywe, jedno (pkt 5/NOT_APPLICABLE) jest sformułowane szerzej niż
uzasadnia stan faktyczny, a trzy drobne defekty (D1/D2/D3) umknęły własnym
kontrolom autora mimo posiadania narzędzi (Decimal, tłumaczenia labelPl) do
ich uniknięcia w tym samym kodzie.
