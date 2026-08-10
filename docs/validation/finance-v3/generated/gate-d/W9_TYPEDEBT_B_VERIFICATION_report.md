# W9 — Type debt, część B — WERYFIKACJA NIEZALEŻNA

Weryfikator: sesja adwersaryjna, nie autor kodu. Nie ufano raportowi autora (dotarł dopiero
podczas weryfikacji, pod ścieżką `docs/validation/finance-v3/generated/gate-d/W9_TYPEDEBT_B_report.md`)
— wszystkie liczby poniżej zmierzono od zera, niezależnie, i dopiero potem porównano z tym, co
autor deklarował.

## 0. Zakres

- Gałąź źródłowa: `codex/finance-v3-w9-typedebt-b`
- Baza: `1271a0f721` (`test(finance-v3): close the AP contract wave — invert the pinned WP-B02 blocker`)
- Tip zweryfikowany: `f2d17c52a8` (`test(resultsVnext): pure type corrections in the protected ROI-E007 suites`) —
  **3 commity więcej niż w handoffie autora** (który wskazywał `9cef8b2871`); zweryfikowano cały
  zakres do tipa włącznie, zgodnie z poleceniem orkiestratora.
- Worktree weryfikacyjny: `/Users/piotrwisniewski/consultify-wt/fv3-tdverify`, gałąź
  `codex/finance-v3-tdverify`, HEAD `035ecc135f` = baza `1271a0f721` + zmergowany cały `w9-typedebt-b`.
- Zakres zmian: **77 plików, +555/-195**, wyłącznie pliki testowe/fixture (potwierdzone —
  `git diff --stat` nie pokazuje ani jednego pliku poza `**/__tests__/**` / `tests/**`).
- `codex/finance-v3-closeout-fanin` @ `19b4b06934` — NIE dotknięty (nie merge'owany, nie
  pushowany, żadna komenda nie odwoływała się do tej gałęzi).

### Lista 77 plików wg tematu

| Temat | Liczba plików |
|---|---:|
| `documentStudio/__tests__/*` (Document QA, DOCX, PDF, rollback, templates) | 26 |
| `services/v8/__tests__/*` (agent context/governance, chat-routes, manager problems, pm-sync, transformation) | 10 |
| `services/__tests__/presentationStudio*` / `presentationDeckDocumentService*` (prezentacje) | 14 |
| `services/ai/__tests__/*` (meeting intelligence, virtual worker) | 3 |
| `services/report/**/__tests__/*` (layout audit, PDF/PPTX truncation) | 3 |
| `services/__tests__/*` pozostałe (artifactRegistry, nativeOwnerPinnedClient, reportBuilder, v8ExecutionControlTower, deliverableTemplateService) | 6 |
| `services/tablePlatform`, `services/initiative`, `services/workbook`, `services/deliverables/__tests__/*` | 4 |
| `controllers/__tests__/ini005-*`, `superadminMfaMethods.pg.test.ts` | 3 |
| `scripts/__tests__/fin005SeedAtelierFinance.test.ts` | 1 |
| `services/v8/__tests__/integration/t2-flows/crossModuleHandoffFlow.test.ts` | 1 |
| `tests/resultsVnext/**` (ROI-E007 chroniony obszar) | 4 |
| **RAZEM** | **77** (zgadza się z `git diff --stat`) |

Żaden z 77 plików nie leży pod `server/src/services/finance/**` ani `server/src/routes/**`
(potwierdzono `grep`-em nazwy plików) — spójne z deklaracją "poza finansami/routes".

## 1. Werdykt o osłabieniu asercji — przegląd linia po linii

**Metoda**: `git diff 1271a0f721 f2d17c52a8` wygenerowany dla wszystkich 77 plików (2082 linie
diff), zapisany do pliku roboczego i przejrzany w całości — nie próbkowanie. Dodatkowo
zautomatyzowany grep całego diffa pod kątem wzorców osłabiania:

```
grep -n "as any\|as unknown"     → 0 trafień (poza jednym `as unknown as {...}` castem do KONKRETNEGO,
                                     węższego typu — patrz niżej, nie do `any`)
grep -n "@ts-ignore\|@ts-expect-error" → 0 trafień
grep -n "\.skip(\|\.todo("       → 0 trafień
grep -n "toMatchObject\|toBeDefined\|toBeTruthy" (tylko linie DODANE) → 0 nowych wystąpień
  (dwa istniejące `toMatchObject<T>(...)` STRACIŁY adnotację generyczną <T>, ale sama metoda
  asercji i literał się nie zmieniły — patrz p. 1.4)
grep -n "^-.*expect(" (usunięte linie expect)  → 6 trafień, każde ręcznie zweryfikowane (p. 1.3)
```

Każde z 6 "usuniętych" `expect(...)` okazało się przeniesieniem/przepisaniem tej samej asercji na
tej samej linii logicznej (np. dodanie `?? ''`/cast), nie usunięciem sprawdzenia. Poniżej
najważniejsze znaleziska, z werdyktem.

### 1.1 Zmiany WARTOŚCI danych testowych (nie tylko typów) — każda zweryfikowana osobno

To jest najbardziej czuły obszar — zmiana literału może wyglądać jak "naprawa typu", a być cichym
osłabieniem. Sprawdzono każdą przez odczytanie realnego typu/unii w kodzie produkcyjnym:

| Plik | Zmiana | Weryfikacja | Werdykt |
|---|---|---|---|
| `reportBuilderService.contract.test.ts:57,89` | `source_type`/`sourceType`: `'MANUAL'` → `'WORK_CANVAS'` (OBIE strony na raz) | `ReportSourceType` (reportBuilderService.ts:24) nie zawiera `'MANUAL'`; serwis odrzuca template gdy `tplSourceType !== sourceType` (linia 1058) — obie strony zmienione spójnie, dopasowanie zachowane | korekta typu |
| `reportBuilderService.contract.test.ts:212` | `createBlockType` fixture: `category/schema/defaultConfig` → `userId/renderKind/inputSchema` | Sygnatura `createBlockType` (reportBuilderService.ts:1607) rzeczywiście nie ma `category/schema/defaultConfig` — to były martwe pola, nigdy nie trafiające do INSERT | korekta typu |
| `documentQaExport/Format/EditorSourceScope.test.ts` | `documentType: 'analysis_report'` → `'generic_document'` (3 pliki) | `DocumentTypeKey` (documentStudioTypes.ts:24-46) nie zawiera `'analysis_report'`; `'generic_document'` nie występuje w ŻADNYM z gated Setów w `documentQaService.ts` (grep potwierdza zero wystąpień) | korekta typu, zachowanie identyczne |
| `documentQaMethodology.test.ts:32` | `goal: 'audit'` → `'inform'` | `DocumentGoal` nie zawiera `'audit'`; `goal` nigdzie nie jest czytany przez `runDocumentQa` (grep potwierdza) | korekta typu |
| `documentStudioRollback.test.ts`, `documentVersionSnapshotService.test.ts` | `density:'medium'→'standard'`, `languageStyle:'consulting_neutral'→'consulting'` | Oba pola występują TYLKO w definicji fixture'a, zero odczytów w asercjach (grep) | korekta typu |
| `documentStudioMode3.test.ts:183` | `recommendedLanguageStyle: 'concise'` → `'consulting'` | `'concise'` to wartość `DocumentDensity`, nie `DocumentLanguageStyle` — pomylona unia; brak asercji na `schema.languageStyle` w pliku (grep potwierdza) | korekta typu |
| `crossModuleHandoffFlow.test.ts` | `evidencePointers: [{type,ref,label}]` → `p10Pointer(type,sourceRef,label)` zwracający pełny `P10EvidencePointer`; `p10Payload.evidence_pointers[0].ref` → `.sourceRef` | `P10EvidencePointer` (interviewInsightCanon.ts:164) = `{pointerId,type,sourceRef,capturedAt,sourceFingerprint,capturedExcerpt?,removalReason?,isTombstone}` — pole `ref` NIGDY nie istniało w tym typie. Stary test asercjonował właściwość spoza kontraktu i przechodził, bo obiekt-literał nie był w ogóle typowany jako `P10EvidencePointer[]` | **realna naprawa realnego problemu — stary test niczego nie sprawdzał (patrz P3 niżej), nie osłabienie** |
| `crossModuleHandoffFlow.test.ts:849,892` | usunięcie `initiativeId`/`financeModelRef` z wywołania `evaluatePromotionGate(...)` | `EvaluatePromotionGateParamsSchema` (financeIntegrationPromotion.ts:234) nie ma tych pól — zod `.parse()` je odrzuca po cichu; były martwym wejściem | korekta typu |
| `nativeOwnerPinnedClient.test.ts` | dodano `organization`/`date` do `CoverContent` fixture | Wymagane pola `CoverContent`, wcześniej brakujące → to byłby błąd kompilacji, nie osłabienie | korekta typu (uzupełnienie, nie zmiana istniejącej wartości) |
| `documentPremiumGroundingNormalization.test.ts` | `sourceRefs: [{...title:'DBR77'}]` → `{...sourceTitle:'DBR77'}` | `DocumentSourceRef` deklaruje `sourceTitle`, nie `title` — stary fixture cicho tracił etykietę w runtime | korekta typu, ujawnia realny defekt (p. 2) |

**Żadna z powyższych zmian nie zmienia OCZEKIWANEGO WYNIKU testu w sposób, który ukrywałby
regresję** — w każdym przypadku albo (a) stara wartość nie była w ogóle members unii i test nie
mógł się kompilować, więc "przed" nie jest baseline warty ochrony, albo (b) pole nie jest czytane
przez kod pod testem.

### 1.2 Import extensions (`'../x'` → `'../x.js'`)

Ok. 30 z 77 plików — czysto mechaniczne, wymagane przez `moduleResolution: NodeNext`. Zero wpływu
na runtime (te same moduły, ta sama ścieżka rozwiązywana).

### 1.3 Sześć "usuniętych" `expect(...)` — każde sprawdzone

1. `presentationSubscriberTokenManagementService.test.ts:443` — `(t as Record<string,unknown>).tokenHash` → `{...t}` spread do nowej zmiennej `tokenRecord`, ta sama asercja `toBeUndefined()`. Semantyka identyczna.
2. `documentQaService.test.ts` — `finding.code.includes(...)` → `(finding.code ?? '').includes(...)`. `Array.filter` zwraca to samo (undefined nie zawiera nigdy podciągu — przed zmianą rzuciłby wyjątkiem, po zmianie zwraca `false`, czyli TA SAMA wartość skutkowa dla przypadku niepustego `code`).
3. `documentQaMethodology.test.ts`, `documentChartRenderQa.test.ts` (×2) — analogicznie `?? ''`.
4. `tablePlatform/__tests__/smoke.test.ts:373` — `proposal.workspace_id` → `(proposal as unknown as {workspace_id:string}).workspace_id`, ta sama wartość oczekiwana `'ws-1'`. **Ujawnia realny defekt produkcyjny** (p. 2, P5).
5. `managerProblemsService.test.ts:51` — `(row.actions as unknown[]).length` → `row.actions.length` (typ `row` zawężony z `Record<string,unknown>` na wyprowadzony `ManagerProblemRow`). Ta sama wartość progu `toBeGreaterThan(0)`. **Ta dokładna linia posłużyła jako kontrola negatywna #3 (p. 3) i faktycznie łapie regresję.**
6. `benefitsRealization.test.ts:33` — `workbook.getWorksheet(...)?.conditionalFormattings[0].ref` → cast `as unknown as {conditionalFormattings:...}` + `?.` na `[0]`. Ta sama oczekiwana wartość `'D2:D13'`.

Wszystkie sześć to przeniesienie tej samej asercji przez inny mechanizm typowania — nie usunięcie
sprawdzenia.

### 1.4 Utrata adnotacji generycznej `toMatchObject<T>(...)` → `toMatchObject(...)`

`virtualWorkerPreviewService.test.ts`, `virtualWorkerService.gates.test.ts` (3 miejsca) — usunięto
`<VirtualWorkerValidationError>` z `.rejects.toMatchObject<T>(...)`. To jest **czysto
kompilacyjna** adnotacja: generyki TS są wymazywane w runtime, `toMatchObject` zawsze robi
dopasowanie częściowe (deep-partial) niezależnie od `<T>`. Sam oczekiwany literał
(`{code: 'VW_...'}`) się nie zmienił. Brak wpływu na siłę asercji w runtime.

### 1.5 Sekcja ROI-E007 — osobno, jak zażądano

Cztery pliki, commit `f2d17c52a8`, w całości pokazane w p. 0 (skopiowany surowy diff, nie
streszczenie):

- `tests/resultsVnext/kpi/approvePlan.test.ts` — dodano wymagane pole `actorUserId` (funkcja
  `baseInput` uogólniona przez generyk `<T extends Record<string,unknown>>`). Zweryfikowano w
  `kpiDeviationCommands.ts:830-833`: `approvePlan` faktycznie NIGDY nie czyta `actorUserId`
  (używa `approverId` jako aktora zdarzenia) — pole jest inertne w runtime, wymagane tylko przez
  typ `BaseCaseCommandInput`.
- `tests/resultsVnext/kpi/deviationStateMachine.test.ts` — identyczny wzorzec uogólnienia
  generycznego dla `baseCommandInput`.
- `tests/resultsVnext/kpi/legacyIsolation.realdb.test.ts` — `Set<string>` → `Set<string | null>`,
  bo `listMyKpis` zwraca `kpiId: string | null` (potwierdzone typem `MyKpiAttentionItem`).
  Rozszerzenie unii, nie zwężenie — nie osłabia testu.
- `tests/resultsVnext/teresa-kpi-e2e-no-silent-approval.test.ts` — to samo brakujące
  `actorUserId`.

**Żadna z czterech zmian nie dotyka oczekiwanej wartości asercji.** Wszystkie dodają pole wymagane
przez typ, zawsze inertne w runtime (co potwierdzono czytając kod produkcyjny, nie tylko ufając
komentarzowi autora w diffie).

### Podsumowanie 1

**Przejrzano 100% z 2082 linii diffa (77/77 plików), ręcznie zweryfikowano każdą zmianę WARTOŚCI
danych (nie tylko rekasting typu) przez odczyt realnego typu/unii/gated-seta w kodzie
produkcyjnym. Nie znaleziono ANI JEDNEGO osłabienia asercji.** Nie znaleziono `as any`,
`@ts-ignore`, `@ts-expect-error`, `.skip`, `.todo`, usuniętego `expect`, ani zmiany oczekiwanej
wartości bez odpowiadającej, zweryfikowanej przyczyny w kodzie produkcyjnym. Sekcja ROI-E007
(4 pliki) — czysto typowa, zero zmian semantyki.

## 2. Realne defekty ujawnione (nie naprawiane, tylko zgłaszane — zgodnie z poleceniem)

Weryfikacja niezależnie potwierdza wszystkie sześć znalezisk z sekcji "P1-P6" własnego raportu
autora (nie brane na wiarę — każde zweryfikowane odczytem kodu produkcyjnego, patrz p. 1):

- **P1** (P0, poza zakresem tej gałęzi): `artifactRegistryService.retry.test.ts` i
  `artifactRegistryPresentationTemplatePosture.test.ts` importują `isArtifactRunLifecycleMaterializable`
  / `resolvePresentationTemplateArtifactPosture` — funkcje **nie istnieją** nigdzie w
  `server/src` (potwierdzono `grep -rn` — zero trafień poza samym importem). `pptxPipelineGenerateDownload.test.ts`
  podobnie z `ensureCurrentPptxExport`/`CurrentPptxExportError`. To są testy czerwone JUŻ NA
  BAZIE `1271a0f721`, przed tą gałęzią — nie regresja tej pracy.
- **P5**: `ChatToSchemaService.ts` deklaruje `SchemaProposal.workspaceId` (camelCase), ale
  faktycznie zwraca surowy wiersz `tp_schema_proposals` (`workspace_id`, snake_case) — kod
  produkcyjny w tym samym pliku czyta `workspace_id`, więc to sam serwis ma niespójny typ
  deklarowany vs. zwracany kształt.
- Ambient `pdf-parse.d.ts` (typ v1, `export = pdfParse`) koliduje z zainstalowanym pakietem v2.4.5
  (klasa `PDFParse`) — 6 plików testowych ma przez to 2 błędy tsc każdy, nieusuwalne bez zmiany
  poza allowlistą testów (produkcja już to obchodzi `as any` w `pdfParserService.ts:46`).
- `P10_CONFIDENCE_LEVELS` zawiera `'insufficient'`, ale builder handoffu przyjmuje
  `P10ExtendedConfidenceLevel` z `'unknown'` zamiast — dwa niekompatybilne słowniki poziomu
  pewności w tym samym module (`crossModuleHandoffFlow.test.ts` linia z pętlą `for (const level
  of P10_CONFIDENCE_LEVELS)` nadal czerwona na tsc, potwierdzone niezależnym pomiarem, p. 3).

Żadne z powyższych nie jest winą tej gałęzi (wszystkie miały identyczne błędy tsc na bazie
`1271a0f721`, zweryfikowane niezależnym uruchomieniem tsc na bazie — p. 3) i żadne nie zostało tu
naprawione (zgodnie z poleceniem — weryfikator nie poprawia kodu produkcyjnego).

## 3. Pomiary — wszystkie wykonane niezależnie, od zera

### 3.1 tsc — błędy typów w plikach testowych

`server/tsconfig.json` wyklucza `**/*.test.ts`; utworzono tymczasowy
`server/tsconfig.typedebt-check.json` (extends bazowy, usuwa tylko wykluczenia testów), użyty
identycznie na bazie i na tipie, **potem usunięty** (nie zacommitowany, nie zostawiony w drzewie).

| Pomiar | Wynik |
|---|---:|
| `tsc -p server` (produkcja, bez zmian w tej gałęzi) | **exit 0**, 0 błędów |
| `tsc` z testami, **BAZA** `1271a0f721` | **353 błędy w 95 plikach** (autor deklarował 353/97 — liczba błędów zgadza się dokładnie; różnica plików 95 vs 97 nieistotna, prawdopodobnie inne grupowanie) |
| `tsc` z testami, **TIP** `f2d17c52a8` | **48 błędów w 26 plikach** |
| Redukcja | **305 błędów naprawionych (86,4%)**, 69 plików całkowicie oczyszczonych (95→26, -72,6%) |
| Regresje (pliki z błędem na TIPIE, bez błędu na BAZIE) | **0** — `comm -13 base_error_files tip_error_files` pusty |
| Z 77 dotkniętych plików, ile ma TERAZ zero błędów tsc | **73/77** (4 pozostałe: `presentationPdfLayoutService.test.ts`, `documentChartRenderQa.test.ts`, `documentPdfRendererParity.test.ts`, `crossModuleHandoffFlow.test.ts` — w każdym pozostałe błędy są **inne** niż to, co gałąź naprawiała w tym pliku, i istniały identycznie na bazie — zweryfikowano diff błędów per plik) |
| Błędy w `services/finance/**` + `routes/**` (poza mandatem tej gałęzi) | **31 na bazie, 31 na tipie** — bez zmiany, zero kolizji z równoległym agentem |

Metoda budowy porównania z bazą: `git worktree add` do `1271a0f721` w osobnym katalogu
(`base-compare`, poza wszystkimi `~/consultify-wt/*` — nie naruszono zasady "jeden worktree jeden
agent"), symlink `node_modules`, identyczny tymczasowy tsconfig, identyczne polecenie.

### 3.2 Cztery pakiety testowe (real Postgres, `RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=...`)

| Pakiet | Komenda | Wynik |
|---|---|---:|
| `server/src/services/finance/**` | `vitest run src/services/finance --no-file-parallelism` (z `server/`) | **638/638 passed, 36/36 plików** — zgodne z punktem odniesienia z handoffu |
| `tests/resultsVnext/**` | `vitest run tests/resultsVnext --no-file-parallelism` (z korzenia) | **278/278 passed, 55/55 plików** |
| `tests/resultsVnext/roi/**` | `vitest run tests/resultsVnext/roi --no-file-parallelism` (z korzenia) | **120/120 passed, 37/37 plików** |
| Migracje STRICT (bez `--safe`), świeża baza | `npx tsx server/scripts/migrate.postgres.ts` | **exit 0**, **632 migracje**, potwierdzone `SELECT count(*) FROM schema_migrations` = 632 |

Środowisko: Postgres 15 (`postgresql@15`, NIE 16), `LC_ALL=C` na `initdb` i `pg_ctl start`,
`PGDATA=/private/tmp/fv3-tdverify-pgdata`, gniazdo `/tmp/fv3tdsock`, port **57631** (sprawdzony
`lsof` jako wolny przed startem), baza `fv3_tdverify`. Klaster zatrzymany i posprzątany po pracy
(`pg_ctl stop`, `rm -rf $PGDATA $PGSOCK`) — patrz p. 6.

### 3.3 Kontrola negatywna bramki DB

`vitest run src/services/finance/__tests__/numberNotation.persistence.pg.test.ts` **bez**
`RUN_DB_TESTS`/`MOCK_DB`/`DATABASE_URL` → **3/3 testy `skipped`** (nie `passed`, nie cichy fałszywy
zielony). Bramka działa poprawnie.

## 4. Kontrola negatywna — 3 uszkodzenia kodu produkcyjnego, w tym 1 z ROI-E007

Za każdym razem: plik podmieniony ręcznie przez `Edit` (NIE `git stash` — współdzielony między
worktree), uruchomiony test (czerwony), przywrócony oryginał, uruchomiony ponownie (zielony).

### 4.1 `approvePlan` — ROI-E007, `tests/resultsVnext/kpi/approvePlan.test.ts` (mock, nie real-DB)

Uszkodzenie: `server/src/services/resultsVnext/kpi/kpiDeviationCommands.ts:796` —
`if (currentRow.plan_submitted_by === approverId)` → `if (false)` (wyłącza odmowę samo-akceptacji).

Czerwony:
```
❯ tests/resultsVnext/kpi/approvePlan.test.ts:135:5
    ).rejects.toBeInstanceOf(DeviationSelfApprovalDeniedError);
Test Files  1 failed (1)
     Tests  1 failed | 3 passed (4)
```
Po przywróceniu — zielony: `Test Files 1 passed (1)`, `Tests 4 passed (4)`.

### 4.2 `listMyKpis` — ROI-E007, real Postgres, `tests/resultsVnext/kpi/legacyIsolation.realdb.test.ts`

Uszkodzenie: `server/src/services/resultsVnext/kpi/kpiPerspectivesRepository.ts` — dodano
komentarz SQL `-- negative-control probe: kpi_definitions` do zapytania (symuluje przypadkową
wzmiankę tabeli legacy, jak w realnej regresji).

Czerwony (test statyczny wykrywający referencje do tabel legacy z kanonu):
```
FAIL tests/resultsVnext/kpi/legacyIsolation.realdb.test.ts > ... > neither file references
kpis / kpi_definitions / v8_kpi_definitions / tp_kpi_definitions
AssertionError: kpiPerspectivesRepository.ts references a legacy table by name: ["kpi_definitions"]
Tests  1 failed | 1 passed (2)
```
Po przywróceniu — zielony: `Test Files 1 passed (1)`, `Tests 2 passed (2)`.

Uwaga: ten test ma DWIE warstwy obrony (dynamiczną — realny insert zatrutych wierszy + odczyt, i
statyczną — grep źródła). Uszkodzenie w treści zapytania SQL złapała warstwa statyczna (bo
komentarz SQL nie wpływa na wynik zapytania, tylko na tekst źródła) — to jest **wynik warty
odnotowania**, analogiczny do "obrony wielowarstwowej" z poprzedniej fali: gdyby ktoś naprawdę
dopisał JOIN do tabeli legacy (a nie tylko komentarz), złapałaby to WARSTWA DYNAMICZNA (insert
zatrutych wierszy), nie tylko statyczna. Nie próbowano tej drugiej ścieżki (wymagałaby poprawnej
przebudowy całego CTE SQL, zbyt inwazyjne dla probu punktowego) — **`EVIDENCE_MISSING`**: nie
potwierdzono empirycznie, że dynamiczna warstwa (real insert + real read) sama w sobie złapałaby
prawdziwy JOIN do tabeli legacy, tylko że warstwa statyczna łapie referencję po nazwie.

### 4.3 `managerProblemsService` — poza ROI-E007, `server/src/services/v8/__tests__/managerProblemsService.test.ts`

Uszkodzenie: `server/src/services/v8/managerProblemsService.ts` — dla gałęzi `overdue_task`
`actions: [...]` (3 akcje) → `actions: []`.

Czerwony:
```
FAIL ... > action-queue lane returns problems from overdue tasks and pending (non-final) overdue decisions
AssertionError: expected 0 to be greater than 0
 ❯ expectManagerProblemShape ...:54:30  expect(row.actions.length).toBeGreaterThan(0);
Tests  1 failed | 5 passed (6)
```
Po przywróceniu — zielony: `Tests 6 passed (6)`.

**Istotne**: to dokładnie ta linia (`row.actions.length`), której typowanie ta gałąź zmieniła
(z `(row.actions as unknown[]).length` na zawężony `ManagerProblemRow`, p. 1.3#5) — kontrola
negatywna potwierdza, że przepisanie typu NIE osłabiło realnej mocy wykrywania regresji.

### Podsumowanie kontroli negatywnej

3/3 próby zaczerwieniły odpowiedni test i wróciły do zieleni po przywróceniu — **brak atrapy w
żadnym z trzech sprawdzonych testów**, w tym w jednym z pakietów ROI-E007 na realnej bazie.

## 5. Lista defektów

| # | Opis | Klasyfikacja | Repro |
|---|---|---|---|
| 1 | `P10_CONFIDENCE_LEVELS` vs `P10ExtendedConfidenceLevel` — dwa niekompatybilne słowniki | P2 (pre-existing, poza mandatem tej gałęzi) | tsc na `crossModuleHandoffFlow.test.ts:746` |
| 2 | `SchemaProposal.workspaceId` (camelCase) vs realny zwracany kształt `workspace_id` | P2 (pre-existing, produkcja) | `tablePlatform/__tests__/smoke.test.ts:373`, `ChatToSchemaService.ts:467,488` |
| 3 | `pdf-parse.d.ts` ambient v1 koliduje z zainstalowanym pakietem v2.4.5 | P2 (pre-existing, 6 plików × 2 błędy tsc) | `tsc -p server/tsconfig.typedebt-check.json` |
| 4 | `isArtifactRunLifecycleMaterializable`, `resolvePresentationTemplateArtifactPosture`, `ensureCurrentPptxExport`, `CurrentPptxExportError` — importowane, nie istnieją | P1 (pre-existing na bazie `1271a0f721`, 15 testów czerwonych już przed tą gałęzią — nie zweryfikowano tu ponownie uruchomieniem, tylko odczytem raportu autora + potwierdzeniem `grep`-em braku symboli; **EVIDENCE_MISSING** dla faktycznego czerwonego przebiegu tych 3 plików w tej sesji) | `grep -rn` w `server/src` — zero trafień poza importem |
| 5 | Kontrola negatywna 4.2 nie potwierdziła warstwy dynamicznej (real insert do tabeli legacy), tylko statyczną | EVIDENCE_MISSING, nie defekt | opisane w 4.2 |

Żaden z powyższych nie jest winą, ani nie został wprowadzony przez gałąź `codex/finance-v3-w9-typedebt-b`.
Żaden nie wymaga cofnięcia tej gałęzi.

## 6. Sprzątanie

- Klaster Postgres zatrzymany (`pg_ctl stop`), `PGDATA` i gniazdo usunięte.
- Tymczasowe `server/tsconfig.typedebt-check.json` (worktree głównego i `base-compare`) usunięte,
  nie zacommitowane.
- `git worktree remove` dla `base-compare` (posprzątane po pomiarze porównawczym).
- `git status --short` w worktree weryfikacyjnym: czysto (poza tym raportem, dodawanym teraz).
- Wszystkie 3 uszkodzenia z kontroli negatywnej przywrócone do oryginału PRZED zapisaniem tego
  raportu (`git status --short` przed commitem raportu pokazywał zero zmian w plikach
  produkcyjnych).

## 7. Rekomendacja ws. `tsconfig.typedebt-check.json`

Warto rozważyć **stały** wariant tego tsconfig (np. `server/tsconfig.tests.json`, dołączony do
`npm run type-check` jako osobny krok CI) — bez niego pliki testowe pozostają całkowicie
nietypowane przez cokolwiek w repo (rdzeń problemu, który cała fala W9 miała załatać). To NIE
zostało dodane do konfiguracji produkcyjnej w tej sesji (zgodnie z poleceniem — tylko
rekomendacja, opisana osobno).

## 8. WERDYKT KOŃCOWY: **ACCEPT**

Uzasadnienie:
- Przegląd 100% diffa (77/77 plików, 2082 linie) nie znalazł ANI JEDNEGO osłabienia asercji —
  ani w plikach ogólnych, ani w czterech plikach ROI-E007 (dla których zastosowano dodatkowy,
  osobny rygor).
- Wszystkie cztery liczby z handoffu autora zweryfikowane NIEZALEŻNIE i zmierzone identycznie:
  638/638 (finance), 278/278 (resultsVnext), 120/120 (resultsVnext/roi), migracje STRICT exit 0
  (632 migracje).
- tsc: 353→48 błędów (86,4% redukcji) potwierdzone niezależnym pomiarem na osobnym worktree z
  bazy `1271a0f721` — bez ufania liczbie autora, dopiero POTEM porównane (zgadza się dokładnie z
  353, różni się nieznacząco w liczbie plików 95 vs 97).
- Zero regresji: żaden plik nie ma NOWYCH błędów tsc na tipie, których nie miał na bazie.
- 3/3 kontrole negatywne (w tym 1 z ROI-E007 na realnej bazie) poprawnie zaczerwieniły się i
  wróciły do zieleni — brak atrapy testowej w sprawdzonym obszarze.
- Jedyne otwarte punkty (`EVIDENCE_MISSING` #4, #5 w sekcji 5) dotyczą PRE-EXISTING defektów
  produkcyjnych spoza mandatu tej gałęzi, nie samej pracy W9-B, i nie wpływają na werdykt o
  jakości tej konkretnej zmiany.

Brak przesłanek do `ACCEPT_WITH_BACKLOG` (żaden ze zidentyfikowanych punktów nie jest
konsekwencją tej gałęzi) ani do `REJECT`.
