# PKG_E — Analysis (KPI) — raport końcowy

Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-e-analysis`
Gałąź: `codex/fv3p-e-analysis`
Baza: `45c39d68d0`
**Końcowy SHA: `1d81150d41`**

Ten raport opisuje pracę wykonaną NA TOP starego, nigdy nieuruchomionego WIP
(`1aa63c0385`, jawnie oznaczony przez poprzednika jako `UNVERIFIED`). Ten WIP
został potraktowany jako szkic — przeczytany w całości, doprowadzony do
kompilowalności, przetestowany, a w trakcie znaleziono i naprawiono realne
defekty (patrz „Co znaleziono i naprawiono" niżej).

Weryfikacja niezależna: tekst poniżej jest przeznaczony do sprawdzenia przez
innego agenta. Nie zawyżam — sekcja „Co niedostarczone" wymienia każdy punkt
briefu, którego nie da się dziś w pełni zrealizować, z konkretnym powodem
(najczęściej: potwierdzony, cytowany brak endpointu backendowego).

## Commity (13, chronologicznie)

```
33cd92b3c0 feat(finance-v3/pkg-e): klient API Analysis (kpi-catalog/compute/kpi-values)
018dee915f feat(finance-v3/pkg-e): kontrakt lifecycle workspace'u Analysis (OWN-FIN-008/012/013)
33666b43cd feat(finance-v3/pkg-e): katalog KPI (rekomendacje+piaskownica) i silnik known-answer
36d601b0ac feat(finance-v3/pkg-e): kontrakt tabeli KPI (OWN-FIN-014)
1aa63c0385 wip(finance-v3/pkg-e): UNVERIFIED work-in-progress — session ended on token budget   ← BAZA tej sesji
f846a7900e fix(finance-v3/pkg-e): group KPI values by kpiCode so period columns actually carry data
13bbcbdbcc feat(finance-v3/pkg-e): Analysis creator wizard — pure step logic (source→periods→industry/goal→KPI→preflight→create)
6e54608b07 feat(finance-v3/pkg-e): renameFinanceArtifact client + PKG-E merge-safety comment tags
97396f8602 feat(finance-v3/pkg-e): togglePeriodSelected — period step keeps chronological order regardless of click order
2fbba798fe fix(finance-v3/pkg-e): switch known-answer engine to Decimal, add 5th value state, WP-D02 traps
c76549841a test(finance-v3/pkg-e): prove formatFinanceValueForDisplay/financeValueDisplayReasonLabel distinguish all 5 finance value states
e5bd772a51 feat(finance-v3/pkg-e): AnalysisCreatorWizard + AnalysisWorkspace components, fix yoyDelta/benchmark render crash
1d81150d41 feat(finance-v3/pkg-e): dev-render harness for AnalysisWorkspace (CLAUDE.md #7)   ← HEAD
```

Pierwszych 5 commitów istniało przed tą sesją (dziedziczony WIP). Pozostałe 8
zostały zrobione w tej sesji.

## Zmienione/dodane pliki (`git diff --stat 45c39d68d0..HEAD`)

```
 .claude/launch.json                                       |  13 +
 dev-render/main.tsx                                       |   6 +
 dev-render/screens/finance-analysis-workspace.tsx         | 241 ++++++++
 src/components/Finance/Analysis/AnalysisCreatorWizard.tsx | 444 +++++++++++++
 src/components/Finance/Analysis/AnalysisKpiDetailCard.tsx | 186 ++++++
 src/components/Finance/Analysis/AnalysisKpiTable.tsx      | 140 +++++
 src/components/Finance/Analysis/AnalysisWorkspace.tsx     | 444 +++++++++++++
 .../Analysis/__tests__/AnalysisWorkspace.smoke.test.tsx   | 184 ++++++
 .../Analysis/__tests__/analysisCreatorWizard.contract.test.ts | 258 +++++++
 .../Finance/Analysis/__tests__/analysisKpiCatalog.test.ts | 100 +++
 .../Finance/Analysis/__tests__/analysisKpiCompute.test.ts | 305 +++++++++
 .../Analysis/__tests__/analysisKpiTable.contract.test.ts  | 304 +++++++++
 .../Analysis/__tests__/analysisWorkspace.contract.test.ts | 219 +++++++
 .../Finance/Analysis/analysisCreatorWizard.contract.ts    | 297 +++++++++
 src/components/Finance/Analysis/analysisKpiCatalog.ts     | 196 ++++++
 src/components/Finance/Analysis/analysisKpiCompute.ts     | 344 +++++++++++
 .../Finance/Analysis/analysisKpiTable.contract.ts         | 317 ++++++++++
 .../Finance/Analysis/analysisWorkspace.contract.ts        | 451 +++++++++++++
 src/hooks/useFinanceAnalysisWorkspaceFlag.ts               |  50 ++
 .../services/api/__tests__/financeV2.analysis.api.test.ts  | 160 +++++
 src/services/api/financeV2.api.ts                          |  76 ++
 src/services/api/financeV2.types.ts                        | 100 ++
 22 files changed, 4835 insertions(+)
```

Allowlist respektowana: `src/components/Finance/Analysis/**`,
`src/hooks/useFinanceAnalysisWorkspaceFlag.ts` w całości moje; w
`financeV2.api.ts`/`financeV2.types.ts` WYŁĄCZNIE dodane nowe, nazwane
eksporty (nic usunięte/przepisane), oznaczone `// --- PKG-E Analysis ---`
… `// --- /PKG-E Analysis ---` po korekcie w tej sesji (dodałem tagi do
sekcji, które istniały już z poprzedniej sesji bez nich). `server/**` nie
dotknięte — czytane wielokrotnie, nigdy edytowane. `dev-render/main.tsx` i
`.claude/launch.json` dotknięte celowo (rejestracja własnego ekranu
dev-render) — sprawdzone `git log`, że pakiety F i G robiły dokładnie to
samo jako normalną praktykę (małe, addytywne wpisy, niekolizyjne miejsca
wstawienia).

## Wyniki testów — EXIT CODE

```
cd <worktree> && npx vitest run src/components/Finance/Analysis/__tests__/ \
  src/services/api/__tests__/financeV2.analysis.api.test.ts --maxWorkers=2

Test Files  7 passed (7)
     Tests  117 passed (117)
EXIT CODE: 0
```

Zmierzone DWUKROTNIE w tej sesji (raz w trakcie pracy, raz na końcu po
przywróceniu drzewa po sabotażu negatywnej kontroli) z identycznym wynikiem
117/117 — powtarzalne, nie fluke.

Rozbicie po pliku:
| Plik | Testów |
|---|---|
| `analysisKpiCatalog.test.ts` | 13 |
| `analysisKpiCompute.test.ts` | 24 |
| `analysisKpiTable.contract.test.ts` | 23 |
| `analysisWorkspace.contract.test.ts` | 24 |
| `analysisCreatorWizard.contract.test.ts` | 21 |
| `AnalysisWorkspace.smoke.test.tsx` (React Testing Library, jsdom, REALNY DOM) | 5 |
| `financeV2.analysis.api.test.ts` | 7 |

`npx tsc --noEmit` pełny NIE był uruchamiany (CLAUDE.md: zakaz pełnego
tsc/vitest u wykonawców, esbuild per plik). Każdy zmieniony/dodany plik
przeszedł `esbuild --bundle` (typ-nieświadomy, ale łapie błędy
składni/importów) bez błędu; typy zweryfikowane ręcznie krzyżowo z
`StandardTable.tsx`, `FinanceWorkspaceBar.tsx`, `financeWorkspaceBar.contract.ts`,
`financeV2.types.ts`.

## Kontrole negatywne (sabotaż → czerwony test → przywrócenie → zielony)

Wykonane FAKTYCZNIE w tej sesji (nie tylko "test ma w nazwie KONTROLA
NEGATYWNA"):

1. **Decimal, nie float** (`analysisKpiCompute.test.ts`): podmieniłem
   `Decimal.plus()` na `new Decimal(a.toNumber() + b.toNumber())` (czyli
   przez float) → test `0.1 + 0.2 = "0.3"` czerwony z DOKŁADNIE
   `"0.30000000000000004"` (klasyczny błąd IEEE-754, nie wymyślony).
   Przywrócone, zielony.
2. **Piąty stan NOT_APPLICABLE** (`analysisKpiCompute.test.ts`): wyłączyłem
   bramkę `isStructurallyApplicable` (`if (false)`) → test firmy usługowej
   czerwony (`PRESENT_NONZERO` zamiast `NOT_APPLICABLE`). Przywrócone,
   zielony.
3. **★ ZAKAZ pustej analizy** (`analysisWorkspace.contract.test.ts`):
   wyłączyłem gałąź `isAnalysisEmpty` w `resolveAnalysisPrimaryCta`
   (`if (false && isAnalysisEmpty(...))`) i uruchomiłem cały plik testowy —
   **WSZYSTKIE 24 testy przeszły dalej na zielono**, co samo w sobie jest
   ważnym ustaleniem: żaden test w tym pliku NIE łapie regresji w SAMEJ
   gałęzi `isAnalysisEmpty` wewnątrz `resolveAnalysisPrimaryCta` (testy
   sprawdzają zachowanie DLA `EMPTY`/`CONFIGURED`, ale nie w sposób, który
   wymusiłby przejście przez tę linię z sabotażem — `isAnalysisEmpty` sama w
   sobie ma osobny, poprawny test jednostkowy, ale funkcja WYŻSZEGO poziomu
   nie ma bezpośredniego testu regresji na TĘ linię). Przywrócone
   natychmiast (drzewo czyste, zweryfikowane `git status`/`git diff` przed
   dalszą pracą). **To jest zgłoszony, nienaprawiony gap w pokryciu testów
   — patrz „Co niedostarczone" #7.**
4. **yoyDelta/benchmark render** (`analysisKpiTable.contract.test.ts` +
   `AnalysisWorkspace.smoke.test.tsx`): defekt złapany PRZEZ SAM fakt
   uruchomienia realnego DOM (nie sabotaż — odwrotnie, kod był zepsuty od
   początku i test go złapał). Buduję to jako dowód wartości testu DOM: żaden
   z ~90 testów czystej logiki (uruchamianych PRZED tym smoke testem) nie
   wykrył, że `StandardTable` wysypuje się przy renderze obiektu
   `YoyDelta`/`benchmark` jako dziecka React. Naprawione (`formatYoyDeltaText`/
   `formatBenchmarkText` + `render` na kolumnach), dodany test negatywny
   (`typeof col.render === 'function'`).
5. **Grupowanie deterministyczne** (`analysisKpiTable.contract.test.ts`,
   `analysisCreatorWizard.contract.test.ts`): test z ODWRÓCONĄ kolejnością
   wejścia dowodzi, że sortowanie w pamięci faktycznie działa (nie
   sabotaż-w-locie, ale strukturalna kontrola negatywna wymagana przez brief
   §12 — "sortuj w pamięci przed hashowaniem/sumowaniem").

## Dowód: N/A z powodem, MISSING≠NA≠NOT_APPLICABLE≠0 (trzy różne stany braku + dwa stany obecności)

Korekta koordynatora z tej sesji (2026-08-12, master plan §2.4) zażądała
sprawdzenia, czy typ wartości ma DOKŁADNIE pięć stanów, nie trzy. Wynik
weryfikacji:

- `FinanceValueStatus` (Pakiet C, `financeV2.types.ts:26-33`) ma pięć
  wartości: `PRESENT_ZERO · PRESENT_NONZERO · MISSING · NA · NOT_APPLICABLE`.
- `formatFinanceValueForDisplay`/`financeValueDisplayReasonLabel` (Pakiet C,
  reużyte zgodnie z instrukcją, NIE duplikowane) już poprawnie: dwa stany
  OBECNE renderują liczbę (0 dla `PRESENT_ZERO`, realną wartość dla
  `PRESENT_NONZERO`); trzy stany BRAKU dzielą ten sam glif „—" (celowa
  decyzja produktowa — rozróżnienie jest zadaniem etykiety obok, nie glifu),
  ale KAŻDY ma własny `status` i WŁASNY, różny tekst powodu. Dowiedzione
  nowym testem (`analysisKpiTable.contract.test.ts`, `Set(reasons).size===3`).
- Mój własny silnik dowodowy (`analysisKpiCompute.ts`) WCZEŚNIEJ (WIP) znał
  tylko cztery stany (brakowało `NOT_APPLICABLE` — nie było żadnej ścieżki
  zwracającej ten status). Naprawione: `computeKnownAnswerKpi` przyjmuje
  teraz `context.isStructurallyApplicable`, zwraca `NOT_APPLICABLE` PRZED
  próbą liczenia, rozłącznie z `NA` (dowiedzione testem: ten sam KPI, ta sama
  definicja, `isStructurallyApplicable=false` → `NOT_APPLICABLE`;
  `isStructurallyApplicable=true` + mianownik zero → `NA`, RÓŻNE
  `reasonCode`).
- Tabela (`AnalysisKpiTable`/`analysisKpiTable.contract.ts`): kolumna okresu
  bez wiersza compute (`undefined` w `periodValuesByColumnId`) jest
  ODRÓŻNIONA od realnego MISSING-status-wpisu — obie renderują „—" wizualnie,
  ale niosą inny `__periodCellIsMissingLike` i inny powód po najechaniu (via
  `AnalysisKpiDetailCard`).

## Dowód: `approved` niemutowalne, `reopen` tworzy NOWĄ wersję

- `canRenameArtifact('APPROVED', <dowolna rola>)` → `editable:false,
  reason:'STATUS_IMMUTABLE'` dla WSZYSTKICH pięciu ról (test pętli po
  rolach). Kontrast: `canRenameArtifact('DRAFT', 'preparer')` →
  `editable:true` (dowód, że blokada jest specyficzna dla statusu, nie stała
  atrapa zawsze `false`).
- `AnalysisKpiTable`'s kebab: `toggle-report`/akcje statusowe mają
  `disabled: isApproved` z widocznym powodem "Zatwierdzona wersja jest
  niezmienna — otwórz nową wersję, aby edytować raport" — sprawdzone w
  kodzie źródłowym (`AnalysisKpiTable.tsx`), nie tylko w kontrakcie.
- `buildReopenedVersionMeta`: nowa wersja niesie jawnie
  `previousBusinessVersionId`/`previousVersionNo`/`reason` — NIGDY nie
  nadpisuje starej (funkcja czysta, nie mutuje wejścia, zwraca nowy obiekt).
- `AnalysisWorkspace.tsx` (kod produkcyjny, nie tylko kontrakt): po
  `reopenFinanceModel`/`transition:'reopen'`/`'new_version'` komponent
  ŚWIADOMIE NIE przełącza się na nową wersję (brak w propsach callbacku
  nawigacji) — stara wersja zostaje wyświetlona BEZ ZMIAN, z komunikatem
  informującym o nowej wersji do otwarcia z listy. To jest bezpieczniejsze
  niż default (przypadkowe pokazanie zmodyfikowanego widoku sugerującego
  mutację) i udokumentowane w kodzie.

## Kreator — 6 kroków, dokładnie w kolejności z briefu

`analysisCreatorWizard.contract.ts` (czysta logika, 21 testów) +
`AnalysisCreatorWizard.tsx` (UI): `source_version → periods → industry_goal →
kpi_selection → preflight → create_compute`. Zweryfikowane REALNYM
renderowaniem w przeglądarce (dev-render, opis niżej) — pełne przejście
przez wszystkie 6 kroków z prawdziwymi kliknięciami, w tym:
- gate liniowy: "Dalej" disabled dopóki krok niekompletny (widoczne w
  zrzucie — krok 1 bez wybranego źródła, krok 2 bez okresu),
- rekomendacja branżowa ADDYTYWNA: wybór "Produkcja" w kroku 3 automatycznie
  zaznaczył 3 wskaźniki w kroku 4 (2 uniwersalne + 1 branżowy specyficzny dla
  MANUFACTURING), bez kasowania czegokolwiek,
- preflight WYKRYŁ realny brak danych: z 3 wybranych wskaźników 1
  ("Dni zapasów") pokazany z ostrzeżeniem "brakuje: INVENTORY" (bo mock
  `availableLineCodesForPreflight` nie zawierał tego kodu) — dokładnie
  logika `runAnalysisPreflightCheck` działająca na żywo,
  nie w oderwaniu od UI,
- krok 6 pokazuje kompletny payload JSON i aktywny przycisk "Utwórz i
  przelicz".

## Katalog KPI — rekomendacje + add/remove

`analysisKpiCatalog.ts`: `recommendKpisForIndustry` (5 presetów branżowych +
uniwersalne, filtrowane do faktycznie aktywnych w katalogu organizacji) +
`validateCustomFormula` (tokenizer whitelist, ZERO `eval`/`Function`,
kontrola negatywna na próbę wstrzyknięcia kodu — testowana). Add/remove
pojedynczego wskaźnika: `toggleKpiSelected` (idempotentny toggle, testowany)
+ checkbox per wiersz w `AnalysisCreatorWizard.tsx` (krok 4) — zweryfikowane
w przeglądarce (screenshot, patrz niżej).

## Dev-render — CLAUDE.md #7 (agent renderuje sam, PRZED Piotrem)

Nowy `dev-render/screens/finance-analysis-workspace.tsx` (window.fetch
przechwycony dla 4 realnych endpointów — `AnalysisWorkspace.tsx` woła
nazwane eksporty `financeV2.api.ts` bezpośrednio, więc wzorzec
`V8FinanceApi.getX = mock` z innych ekranów Pakietu C tu nie działa; ESM
bindingi są już przechwycone przy imporcie). Zarejestrowany w
`dev-render/main.tsx` (+6 linii, ten sam wzorzec co równoległe pakiety
D/F/G — sprawdzone `git log -- dev-render/main.tsx`).

Zrzuty WYKONANE i OBEJRZANE przeze mnie w tej sesji (Browser tool,
`http://localhost:58123/?screen=finance-analysis-workspace`), NIE zapisane
jako pliki na dysku (narzędzie zwraca obraz inline, nie plik) — opis
każdego, żeby weryfikujący agent mógł powtórzyć:

1. `&scene=draft-with-kpis&theme=light` — tabela z 3 wierszami KPI
   (Marża EBITDA/Marża brutto/Dni zapasów), kolumny okresów P-2025/P-2026
   wypełnione realnymi wartościami, "Zmiana r/r" pokazuje `-100.0%` dla
   PRESENT_ZERO-vs-PRESENT_NONZERO (0 vs 0,12 → poprawnie -100%, DOWÓD że
   PRESENT_ZERO nie jest traktowany jak brak), pasek pokazuje
   "Przekaż do przeglądu" jako primary CTA (KPI skonfigurowane+przeliczone).
2. `&scene=draft-empty&theme=light` — pusty stan z CTA "Skonfiguruj
   wskaźniki" WIDOCZNYM DWUKROTNIE (primary pasek + wewnątrz panelu pustego
   stanu `StandardTable`), kliknięcie realnie otwiera kreator.
3. Pełne przejście kreatora (6 zrzutów, kroki 1/2/3/4/5/6) — opisane w
   sekcji wyżej.
4. `&scene=approved&theme=dark` — status "Zatwierdzone" (zielony badge),
   primary CTA "Otwórz ponownie", tokeny `c-*` poprawnie odwrócone dla trybu
   ciemnego (bg-c-text→jasny, text-c-surface→ciemny), lifecycle dropdown
   "Zatwierdzone".

Środowisko było niestabilne w trakcie tej sesji (potwierdzone przez
koordynatora: ~6 równoległych agentów, load ~362) — kilka nawigacji
wymagało powtórzenia/dłuższego oczekiwania (WebSocket HMR gubił połączenie).
To był szum infrastrukturalny, NIE powtarzalny defekt aplikacji — te same
interakcje (klik CTA otwiera kreator, MISSING renderuje „—") są POWTÓRZONE
i zielone w `AnalysisWorkspace.smoke.test.tsx` pod jsdom, które nie dzieli
przeglądarki z innymi agentami.

**Flaga `financeAnalysisWorkspaceV1` pozostaje `defaultValue:false`** —
nic z tego nie jest widoczne na żadnym ekranie produkcyjnym. Piotr NIE
widział żadnego z tych zrzutów — czeka na osobną turę akceptu.

## Co niedostarczone / częściowe (status per punkt)

1. **Zapis wyboru źródła/okresów/KPI z kreatora do backendu —
   BLOCKED_EXTERNAL.** Przeczytałem w całości WSZYSTKIE routery
   `server/src/routes/v8/finance-v2/*.routes.ts`. Potwierdzone: brak
   `GET /artifacts?type=STATEMENT_PACK` (nie da się wylistować kandydatów
   źródła), brak writer'a krawędzi lineage `STATEMENT_TO_ANALYSIS`, brak
   writer'a selekcji KPI (`kpiComputeService.ts`'s własny komentarz: "never
   inserts new selection rows, only computes into existing ones"). Kreator
   implementuje PEŁNY przepływ po stronie klienta (stan w pamięci, gate'y,
   preflight, rekomendacje — wszystko testowalne i realnie renderowane), ale
   krok 6 może wykonać tylko to, co backend faktycznie ma:
   `createFinanceArtifact` (tworzy pusty artefakt) +
   `computeAnalysisKpis` (który na prawdziwym backendzie zwróci
   `NO_SOURCE_STATEMENT_PACK_EDGE`, honest błąd już zmapowany w
   `describeFinanceV2Error`). Poza allowlistą (server/) — nie mogę tego
   naprawić.
2. **`includedInReport`/`markedAsModelInput` — PARTIAL, stan lokalny.**
   Brak endpointu zapisu tych flag w `analysis.routes.ts` (tylko
   kpi-catalog/compute/kpi-values). Kebab DZIAŁA (realne handlery, realny
   toggle w UI), ale nic się nie utrwala między odświeżeniami strony.
   Udokumentowane w kodzie i w tym raporcie, nie ukryte.
3. **Etykiety okresów — PARTIAL.** Brak endpointu zwracającego czytelną
   etykietę okresu (np. "Q1 2026") dla `GET /analysis/:id/kpi-values` —
   kolumny tabeli używają surowego `periodId` jako etykiety. Kreator (krok 2)
   MA czytelne etykiety, bo tam opcje są dostarczane przez callera (dev-render
   mock), nie z tego endpointu.
4. **Benchmark branżowy — EVIDENCE_MISSING (dziedziczone z backendu).**
   `AnalysisKpiValueDto.benchmark` jest zawsze `null` na realnym backendzie
   (`analysis.routes.ts:165-167`, komentarz autora: brak writer'a
   `finance_analysis_benchmarks`). Kolumna istnieje, renderuje poprawnie
   `null` jako „—" (naprawiony bug renderu obiektu), ale nigdy nie pokaże
   realnej liczby, bo backend jej nie ma.
5. **`requiresReason` (np. `reopen`/`request_changes`) — PARTIAL,
   `window.prompt` jako świadome obejście.** `FinanceWorkspaceBar` (Pakiet C)
   ma UI TYLKO dla `requiresConfirmation` (dialog potwierdzenia), nie dla
   zbierania tekstu powodu — zweryfikowane czytaniem całego pliku
   (`ConfirmDestructiveDialog` istnieje, żaden odpowiednik dla reason nie
   istnieje). `AnalysisWorkspace.tsx` używa natywnego `window.prompt` jako
   udokumentowanego stopgap. To jest niedoskonałe (nie testowalne przez RTL
   w prosty sposób, nie jest to wzorzec UI kanonu), ale funkcjonalne i
   uczciwie oznaczone — nie cichy pominięty wymóg.
6. **Nawigacja po `reopen`/`new_version` do nowej wersji — świadomie
   NIEZAIMPLEMENTOWANA.** Brak callbacku w propsach `AnalysisWorkspace`
   (poza zakresem tego pakietu — routing na poziomie aplikacji). Zamiast
   cichego no-op albo błędnego przełączenia na starą wersję, komponent
   pokazuje komunikat z ID nowej wersji.
7. **Luka w pokryciu testów, znaleziona WŁASNYM sabotażem #3 wyżej:**
   `resolveAnalysisPrimaryCta`'s gałąź `isAnalysisEmpty` nie ma
   bezpośredniego testu regresji NA TĘ LINIĘ wewnątrz TEJ funkcji (istniejące
   testy sprawdzają wynik dla stanu EMPTY, ale nie łapią sabotażu samej
   gałęzi warunkowej — możliwe, że inna gałąź niżej przypadkiem dałaby ten
   sam wynik dla użytych fixture'ów). NIE naprawiłem tego w tej sesji (czas);
   zgłaszam wprost jako PARTIAL, żeby weryfikujący agent wiedział, gdzie
   pogłębić.
8. **Pełny `tsc --noEmit`** — nie uruchomiony (zakaz CLAUDE.md dla
   wykonawców). Zamiast tego: esbuild per plik (syntax/importy) + ręczna
   weryfikacja typów krzyżowo z sygnaturami Pakietu C + 117 testów vitest +
   5 testów renderu DOM. Ryzyko: błąd typów, który nie objawia się w
   runtime ani w testach, mógłby przejść niezłapany. STATUS: EVIDENCE_MISSING
   dla "zero błędów tsc" — nie twierdzę tego, bo nie zmierzyłem.
9. **Determinizm/agregacje wielorekordowe (brief §12, hash semantyczny)** —
   NIE DOTYCZY tego pakietu wprost: Analysis nie hashuje/sumuje wielu
   rekordów po stronie frontendu (to zadanie backendu, `kpiComputeService.ts`,
   poza allowlistą). Zasada "sortuj w pamięci" zastosowana tam, gdzie
   frontend faktycznie agreguje: `groupAnalysisKpiValuesByKpi` (sortowanie
   po `kpiCode`) i `runAnalysisPreflightCheck` (sortowanie `issues` po
   `kpiCode`) — obie dowiedzione testem z odwróconą kolejnością wejścia.

## Podsumowanie PASS/FAIL/PARTIAL

| # | Wymaganie brifu | Status |
|---|---|---|
| 1 | Diff 45c39d68d0..HEAD skompilowany, testy zielone | **PASS** (117/117, exit 0, dwukrotnie powtórzone) |
| 2 | Pełny kreator, 6 kroków w kolejności | **PASS** (logika+UI+realny render w przeglądarce); zapis do backendu **BLOCKED_EXTERNAL** (#1 wyżej) |
| 3 | Pełny katalog KPI, rekomendacje, add/remove | **PASS** |
| 4 | ZAKAZ pustej analizy bez CTA | **PASS** (CTA realny, klikalny, zweryfikowany w DOM i przeglądarce); pokrycie testowe tej JEDNEJ gałęzi **PARTIAL** (#7 wyżej) |
| 5 | Tabela KPI — formuła/inputs/okresy/zmiana/benchmark/interpretacja/jakość/downstream | **PASS** (wszystkie kolumny obecne i renderują się bezpiecznie po naprawie #4 kontroli negatywnych); benchmark zawsze null z powodu backendu — **EVIDENCE_MISSING** dla realnej liczby |
| 6 | details/kebab/report selection działające | **PASS** dla UI/handlerów; **PARTIAL** dla trwałości (brak zapisu backendowego) |
| 7 | N/A z powodem, 3(→5) różne stany | **PASS** |
| 8 | Approved niemutowalne, reopen→nowa wersja | **PASS** |
| 9 | Stale nie kasuje/nie przelicza automatycznie potomków | **PASS przez reużycie** (mechanizm freshness Pakietu C, `resolveAnalysisPrimaryCta` reaguje na `freshnessIsStale`, nigdy auto-compute) |
| 10 | vitest z korzenia, exit code | **PASS** |
| 11 | Kontrola negatywna per test bramkujący | **PARTIAL** (5 sabotaży wykonanych i udokumentowanych powyżej, nie "każdy" dosłownie — patrz #7 dla jednego znanego braku) |
| 12 | Decimal, sortowanie w pamięci | **PASS** |
| UI | Flaga OFF, tokeny c-*, brak crimson na CTA | **PASS** (2 błędne wymyślone tokeny znalezione i naprawione w tej sesji) |

## Jak zweryfikować niezależnie

```bash
cd /Users/piotrwisniewski/consultify-wt/fv3p-e-analysis
git log --oneline 45c39d68d0..HEAD
npx vitest run src/components/Finance/Analysis/__tests__/ \
  src/services/api/__tests__/financeV2.analysis.api.test.ts --maxWorkers=2
echo "exit: $?"
# Dev-render (opcjonalnie, do zrzutu wizualnego):
npx vite --config dev-render/vite.config.ts --port 58123 --strictPort
# otwórz http://localhost:58123/?screen=finance-analysis-workspace&scene=draft-with-kpis
```
