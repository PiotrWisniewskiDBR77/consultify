# Fan-in Wave 1 — raport scalenia (Finance v3, gate-e)

Worktree: `/Users/piotrwisniewski/consultify-wt/fv3-product`
Gałąź: `codex/finance-v3-complete-product-integration`
Punkt startowy: `aa4948b1d1` (pakiet B3 już scalony, 53 endpointy)
**Candidate SHA finalny: `ef702d777ba03799f1ca0fc9320271e8cd4b225e`**

Scalono siedem pakietów, POJEDYNCZO, w tej kolejności, z testami i commitem po
każdym. Zero `git reset --hard`/`clean`/`stash`/`push`/force. Zero sub-agentów.

| # | Pakiet | SHA źródłowy | SHA po scaleniu | Konflikt | Testy celowane |
|---|---|---|---|---|---|
| 1 | `codex/fv3p-d-statements` | `3e605a7c23` | `e3b9067e70` | brak (fast, brak dotknięcia współdzielonych plików poza api/types) | 8 plików / 68 testów, exit 0 |
| 2 | `codex/fv3p-f-baseline` | `0c0a1edcb8` | `103af47392` | tak — patrz §Konflikty | 5 plików / 32 testy, exit 0 (+ re-test D: 68/68 exit 0) |
| 3 | `codex/fv3p-g-prediction` | `fca3639070` | `a145f51402` | tak — patrz §Konflikty | 3 pliki / 79 testów, exit 0 (D+F+G razem: 179/179 exit 0) |
| 4 | `codex/fv3p-e-analysis` (rozszerzenie zakresu) | `fadd081d44` | `2251136246` | tak — konflikt semantyczny #1 | 7 plików / 117 testów, exit 0 (D+F+G+E razem: 296/296 exit 0) |
| 5 | `codex/fv3p-fix-canonical` (rozszerzenie zakresu) | `0f543e60db` | `1e056f81df` | brak (zero dotknięcia frontendu) | 10 plików / 76 testów real PG, exit 0 |
| 6 | `codex/fv3p-h-valuation` (rozszerzenie zakresu) | `14c5d878ad` | `30a19012cf` | tak — konflikt semantyczny #2 | 2 pliki / 58 testów, exit 0 (D+F+G+E+H razem: 354/354 exit 0) |
| 7 | `codex/fv3p-routes-exposure` (rozszerzenie zakresu) | `99a0f5d106` | `ef702d777b` | brak (zero frontendu, zero compute-service) | patrz §Testy serwerowe końcowe |

NIE scalono: `codex/fv3p-routes-exposure` było na końcu kolejki, ale doszło
przed zakończeniem sesji jako 7. i ostatnie zadanie. Pakiety `E`, `H`, paczka
naprawcza i `routes-exposure` NIE były w oryginalnym zleceniu — dołożone
przez orkiestratora w trakcie sesji po ich niezależnej weryfikacji PASS.
**`codex/fv3p-h-valuation` NIE zostało cofnięte ani pominięte — scalone jako
punkt 6 z pełną procedurą.**

Po każdym kroku: `git status` czysty, commit osobny natychmiast po weryfikacji
(bez zostawiania scaleń niezacommitowanych — zgodnie z instrukcją o awarii
sieci z tego dnia).

## Konflikty w `financeV2.api.ts` / `financeV2.types.ts` — rozstrzygnięcie

Zasada zastosowana konsekwentnie we WSZYSTKICH czterech scaleniach z
konfliktem: **zachowaj wszystkie kompatybilne rozszerzenia obok siebie**
(bloki PKG-D, PKG-F, PKG-G, PKG-E, PKG-H w jednym pliku, żaden nie wypchnął
drugiego). Konflikty miały DWIE postaci:

1. **Czysto addytywne** (najczęstsze) — lista importów typów, blok
   `// --- PKG-X ---` doklejony na końcu pliku, wpis w obiekcie
   `FinanceV2Api = {...}`. Rozwiązanie: mechaniczne sklejenie obu stron.
2. **Semantyczne — dwa pakiety niezależnie wypełniły TĘ SAMĄ lukę tym samym
   endpointem** (opisane niżej, §konflikty semantyczne). W obu przypadkach
   PORÓWNAŁEM treść pole-po-polu zamiast zgadywać, obie implementacje okazały
   się funkcjonalnie identyczne (różnica wyłącznie w nazwie lokalnego aliasu
   typu), więc zachowałem JEDNĄ wersję (tę już wcześniej scaloną) i
   udokumentowałem to w komentarzu w kodzie + tu.

### Liczba eksportów per blok, przed i po każdym scaleniu (`financeV2.api.ts`)

| Blok | Funkcje/interfejsy dodane | Stan po scaleniu tego pakietu | Nadal obecne po kolejnych 3 scaleniach? |
|---|---|---|---|
| PKG-D (Statements + Cross-cutting) | 6 (`listStatementLines`, `mapStatementLines`, `runStatementReconciliation`, `listStatementReconciliationRuns`, `getStatementReconciliationRun`, `getFinanceVersionLineage`) | api.ts: 29 eksportów po D | TAK — wszystkie 6 zweryfikowane grep-em po scaleniu G, E, H |
| PKG-F (Baseline, w tym `renameFinanceArtifact`) | 5 (`renameFinanceArtifact`, `listBaselineAssumptions`, `upsertBaselineAssumptions`, `computeBaseline`, `listBaselineOutputs`) | api.ts: 36 eksportów po F (29+7, w tym 2 interfejsy) | TAK |
| PKG-G (Prediction) | 3 (`runFinancePredictionPreflight`, `runFinancePredictionCalculate`, `listFinanceExceptionsOpen`) | api.ts: 41 eksportów po G | TAK |
| PKG-E (Analysis, `renameFinanceArtifact` NIE zduplikowany) | 3 (`getAnalysisKpiCatalog`, `computeAnalysisKpis`, `getAnalysisKpiValues`) | api.ts: 46 eksportów po E | TAK — potwierdzone po H |
| PKG-H (Valuation, `getFinanceVersionLineage` NIE zduplikowany) | 21 (20 nowych + import typów; funkcje: `createValuationCase`, `listValuationCases`, `getValuationCase`, `createValuationVariant`, `getValuationVariant`, `renameValuationVariant`, `compareValuationVariants`, `listValuationMethods`, `createValuationMethod`, `setValuationMethodBasketWeights`, `getValuationWaccInputs`, `upsertValuationWaccInputs`, `runValuationDcfCompute`, `getValuationResults`, `getValuationBridge`, `writeValuationBridge`, `listValuationTerminalRows`, `buildValuationSensitivityGrid`, `getValuationSensitivityGrid`, `generateValuationAdvisorOutput`, `listValuationAdvisorOutputs`) | api.ts: **74 eksporty finalnie** | — (ostatni) |

`financeV2.types.ts`: 53 eksporty po D → 145 eksportów finalnie (po
D+F+G+E+H). Weryfikacja grep-em po KAŻDYM scaleniu potwierdziła: żaden
wcześniejszy blok nie zniknął, licznik eksportów tylko rósł.

## Konflikty semantyczne (dwa pakiety, ta sama nazwa eksportu)

### #1 — `renameFinanceArtifact` (Pakiet F vs Pakiet E)

Oba pakiety niezależnie odkryły tę samą lukę (`POST /artifacts/:id/rename`
zamontowany przez serwer, ale bez klienta frontendowego) i napisały klienta.

- **F**: `renameFinanceArtifact(artifactId: string, naturalKey: string): Promise<FinanceRenameArtifactResultDto>`,
  gdzie `FinanceRenameArtifactResultDto = { artifactId: string; naturalKey: string | null }`
  zadeklarowany w `financeV2.types.ts`.
- **E**: `renameFinanceArtifact(artifactId: string, naturalKey: string): Promise<RenameFinanceArtifactResultDto>`,
  gdzie `RenameFinanceArtifactResultDto = { artifactId: string; naturalKey: string | null }`
  zadeklarowany LOKALNIE w `financeV2.api.ts`.

Porównanie: ten sam URL (`${BASE}/artifacts/${encodeURIComponent(artifactId)}/rename`),
ta sama metoda POST, to samo ciało żądania (`{ naturalKey }`), IDENTYCZNY
kształt zwracanego typu pole-po-polu — różni je wyłącznie nazwa lokalnego
aliasu typu. **Werdykt: funkcjonalnie identyczne, nie realna rozbieżność.**
Zachowałem wersję F (już scaloną wcześniej), porzuciłem duplikat definicji
z E. `AnalysisWorkspace.tsx` (Pakiet E) importuje `renameFinanceArtifact` po
NAZWIE (nigdy nie odwołuje się do porzuconego aliasu typu), więc scalenie
nie wymagało żadnej zmiany w plikach źródłowych Pakietu E.

### #2 — `getFinanceVersionLineage` (Pakiet D vs Pakiet H)

Analogiczny wzorzec — oba pakiety potrzebowały `GET /versions/:id/lineage`
dla własnego kroku „Source”.

- **D**: `getFinanceVersionLineage(businessVersionId, maxDepth?): Promise<VersionLineageDto>`,
  gdzie `VersionLineageDto = { businessVersionId; ancestors: LineageEdgeDto[]; descendants: LineageEdgeDto[] }`,
  a `LineageEdgeDto.edgeType: string`.
- **H**: `getFinanceVersionLineage(businessVersionId, maxDepth?): Promise<ValuationLineageDto>`,
  gdzie `ValuationLineageDto` ma DOKŁADNIE te same pola przez
  `ValuationLineageEdgeDto`, a `ValuationLineageEdgeDto.edgeType: ValuationLineageEdgeType`
  gdzie `ValuationLineageEdgeType = string` (zwykły alias `string`).

Porównanie pole-po-polu: nazwy i typy pól IDENTYCZNE w obu wariantach (H-owy
`ValuationLineageEdgeType` to tylko `string` pod inną nazwą). Jedyna różnica
implementacyjna: H koduje `maxDepth` przez `encodeURIComponent(String(...))`,
D wstawia liczbę wprost do template stringa — funkcjonalnie identyczne dla
wartości liczbowych. **Werdykt: funkcjonalnie identyczne.** Zachowałem
implementację D (scaloną jako pierwszą), porzuciłem duplikat z H. Typy
`ValuationLineageDto`/`ValuationLineageEdgeDto`/`ValuationLineageEdgeType`
POZOSTAŁY w `financeV2.types.ts` (nie usunięte), bo `SourceStep.tsx` (Pakiet
H) importuje `ValuationLineageDto` po nazwie — strukturalnie kompatybilny z
tym, co faktycznie zwraca D's `getFinanceVersionLineage` (TypeScript
strukturalny, nie nominalny), więc zero zmian w plikach Pakietu H.

Oba rozstrzygnięcia udokumentowane komentarzem w kodzie
(`src/services/api/financeV2.api.ts`, przy definicji funkcji zachowanej i w
sekcji pakietu, którego duplikat porzucono).

## Drugi obszar ryzyka — `FinanceWorkspaceBar.tsx` (Pakiet F × Pakiet G)

Zbadane wcześniej przez weryfikatora F (osobny worktree, wersja komponentu z
F nałożona na tip G, 26 testów G przeszło, zero dryfu propsów) — potwierdzone
PONOWNIE na w pełni scalonym drzewie: testy Pakietu G (`src/components/Finance/Prediction`)
uruchomione PO scaleniu F+G razem: **3 pliki / 79 testów, exit 0**. Żadnego
pakietu poza F nie dotknął `FinanceWorkspaceBar.tsx` (auto-merge bez
konfliktu przy F, G/E/H montują komponent bez modyfikacji pliku).

## `.claude/launch.json` — drobna, nieblokująca kolizja

Plik jest współdzielony między sesjami (per pamięć operacyjna: nigdy
`git checkout --` na nim). Wszystkie siedem wpisów harnessu (`fv3p-d-statements`,
`fv3p-f-baseline`, `fv3p-g-prediction`, `fv3p-e-analysis`, `fv3p-h-valuation`,
plus istniejące `fv3p-m-inventory`/`fv3p-c-uiplatform`) zachowane obok siebie.
**Zauważona, nienaprawiona kolizja portów**: `fv3p-e-analysis` i
`fv3p-f-baseline` obie deklarują port `58023` — pochodzi to z gałęzi
źródłowych sprzed scalenia (nie coś, co wprowadziłem), kosmetyczny problem
konfiguracji dev-harnessu, nie wpływa na build/testy/deploy. Zostawione bez
zmian (nie jest to plik kodu produkcyjnego, a zmiana numeru portu bez
wskazówki właściciela byłaby zgadywaniem).

## Testy — wyniki po każdym kroku

Zobacz tabelę wyżej dla numerów per-pakiet. Podsumowanie zbiorcze:

- **Frontend, wszystkie pakiety D+F+G+E+H razem** (`npx vitest run` z
  korzenia repo, `--maxWorkers=2`): **25 plików testowych, 354 testy, exit 0**.
- **Serwer, pakiet naprawczy (canonical) — 10 plików razem, real Postgres**
  (`fanin_fixcanon`, klaster efemeryczny `127.0.0.1:54330`, ZERO połączeń do
  demo/staging/prod, usunięty po użyciu): **76 testów, exit 0**, dokładnie
  zgodne z liczbą z raportu weryfikatora.
- **Serwer, `finance-v2` routes + `finance/canonical` razem, real Postgres**
  (`fanin_full`, ten sam efemeryczny klaster, usunięty po użyciu): **59 plików,
  635 testów — 1 test nieudany, exit 1**. Patrz §Znalezisko poniżej — NIE jest
  to regresja wprowadzona przez scalenie.
- **Serwer, PEŁNY `vitest run` z `server/`** (`--maxWorkers=2`, tryb mock,
  bez `RUN_DB_TESTS`): **718 plików, 53 nieudane / 597 zaliczonych / 68
  pominiętych; 10475 testów, 197 nieudanych / 9626 zaliczonych / 644
  pominiętych / 8 todo, exit 1**. Zweryfikowałem KAŻDY z 53 nieudanych plików
  przez `git log aa4948b1d1..ef702d777b -- <plik>` — WSZYSTKIE puste (żaden z
  siedmiu scalonych pakietów ich nie dotknął). To jest przedistniejący szum
  całego serwera (błędy `process.exit(1)` z `DatabaseConfig` przy braku
  realnej bazy w trybie mock, moduły Results/Templates/Workbook/stare
  `finance.routes.ts` niezwiązane z `finance-v2`), NIE regresja tej fali.
  Zero nieudanych plików dotyczy `routes/v8/finance-v2/` ani
  `services/finance/canonical/`.

### Znalezisko: 1 test w `valuation-independent-verifier.pg.test.ts`

`src/routes/v8/finance-v2/__tests__/valuation-independent-verifier.pg.test.ts`
(test `INDEPENDENT VERIFIER — Pakiet B3 claim #8 (DCF idempotent-replay 500)`)
teraz **PRZEPADA** po scaleniu paczki naprawczej razem z pakietem H:
oczekuje `500` na drugim, bajtowo-identycznym POST do `/compute/dcf`, a
dostaje `200`.

**To NIE jest regresja mojego scalenia — to DOWÓD, że naprawa działa.** Plik
istniał JUŻ w bazowym commicie `aa4948b1d1` (potwierdzone: `git merge-base
--is-ancestor 4a26bae6bd aa4948b1d1` = true), napisany przez niezależnego
weryfikatora Pakietu B3, żeby POTWIERDZIĆ istnienie defektu „claim #8”
(bajtowo-identyczny powtórzony POST kończy się surowym 500 zamiast
idempotentnego replay). Test celowo asercjonuje `500` jako oczekiwany —
UDOKUMENTOWANY bug, nie założenie poprawności. Paczka naprawcza
(`codex/fv3p-fix-canonical`, scalona jako krok 5) naprawiła DOKŁADNIE ten
defekt przez `computeJobService.claimForCompute()` — teraz endpoint
poprawnie zwraca `200` z idempotentnym replay zamiast surowego 500.

Weryfikator paczki naprawczej NIE uruchamiał tego konkretnego pliku (jego
lista 10 plików to `idempotentComputeRetry`, `kpiComputeService` ×2,
`formulaAstEvaluator`, `w2FalseSuccessW9B2`, `analysis.routes`,
`coldReopen`, `tenantMatrix`, `financeCompareService`,
`valuation-b3-review.routes` — NIE `valuation-independent-verifier.routes`),
więc to jest NOWE znalezisko z tej sesji fan-in, dokładnie ten rodzaj
interakcji, o którą pytał orkiestrator. **Rekomendacja: osobna, drobna
paczka aktualizująca asercję tego testu na `200`/idempotentny replay —
NIE ruszałem go sam, poza zakresem scalania.**

## `tsc --noEmit` — wyniki końcowe (na finalnym candidate `ef702d777b`)

- **Z korzenia repo** (`NODE_OPTIONS=--max-old-space-size=12288 npx tsc
  --noEmit -p tsconfig.json`): **exit 2** (NIE 134/OOM — sprawdzony jawnie),
  **9 błędów**, wszystkie w `src/components/Finance/statementPackWorkspaceV2/`
  (Pakiet D). Zweryfikowane bajt-w-bajt identyczne z zawartością gałęzi
  `codex/fv3p-d-statements` PRZED jakimkolwiek scaleniem (żadna z tych linii
  nie była dotknięta przy rozstrzyganiu konfliktów) — to jest zastrzeżenie
  D1/D3 UJAWNIONE we własnym `PKG_D_VERIFICATION_report.md` weryfikatora
  (8× TS2783 „specified more than once" w fixture-builderach testowych,
  kosmetyczne; 1× TS7053 w `CanonicalStatementTableV2.tsx:96`, produkcyjny
  ale runtime OK — indeksowanie zawsze poprawnym kluczem, tylko dziura w
  typach niewidoczna dla esbuild). To jest DOKŁADNIE zastrzeżenie, na które
  wskazywało oryginalne zlecenie („Statements — weryfikacja PASS z
  zastrzeżeniem ujawnionym w raporcie”) — nie coś wprowadzonego przeze mnie.
- **`server/tsconfig.json`** (`NODE_OPTIONS=--max-old-space-size=12288 npx
  tsc --noEmit -p tsconfig.json` z `server/`): **exit 0, zero błędów, zero
  outputu.**

## Endpointy `/api/v8/finance-v2/*` na finalnym scalonym drzewie

**88 endpointów** (grep `router\.(get|post|put|patch|delete)\(` po wszystkich
`server/src/routes/v8/finance-v2/*.routes.ts`), dokładnie zgodnie z
oczekiwaniem po scaleniu `routes-exposure` (53 przed → +35 nowych = 88).

Rozbicie per plik: `analysis`=3, `artifacts`=5, `baseline`=4,
`comments`=17, `compare`=6, `compute`=4, `crosscutting`=4,
`export-import`=4, `lineage-navigator`=2, `models`=2, `prediction`=2,
`saved-views`=6, `statements`=5, `valuation`=21, `versions`=3.

**Znany, nieblokujący dług przeniesiony** (nie naprawiałem — osobna paczka
porządkująca, zgodnie z instrukcją orkiestratora): `comments.routes.ts` i
`saved-views.routes.ts` (razem 23 z 35 nowych endpointów) zwracają surowe
wiersze bazy w snake_case zamiast DTO w camelCase.

## Problemy nierozwiązane / wymagające decyzji właściciela

1. **1 stale test** (`valuation-independent-verifier.pg.test.ts`) asercjonuje
   pre-fix bug jako oczekiwane zachowanie — patrz §Znalezisko. Wymaga
   aktualizacji asercji w osobnej, drobnej paczce.
2. **Kolizja portu 58023** w `.claude/launch.json` między `fv3p-e-analysis`
   i `fv3p-f-baseline` — kosmetyczna, odziedziczona z gałęzi źródłowych,
   nienaprawiona (nie mój zakres decyzji).
3. **53 nieudane pliki / 197 nieudanych testów w PEŁNYM `vitest run` z
   `server/`** — potwierdzone przedistniejące, ZERO powiązania z siedmioma
   scalonymi pakietami (żaden diff aa4948b1d1..ef702d777b ich nie dotyka).
   Nie naprawiane — poza zakresem tego zlecenia fan-in.

Żaden merge nie wymagał `git merge --abort`. Żaden konflikt nie pozostał
nierozstrzygnięty.
