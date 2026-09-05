# F. Finanse — pełna tabela (RZiS / Bilans / CF): łańcuch 6 ogniw

> **Baza pomiaru.** Gałąź `codex/m03-admin-20260824`, worktree `/private/tmp/m03`. Wszystkie
> cytaty `plik:linia` zweryfikowane ponownie na `b1a7cd362a` (gałąź ruszała się w trakcie pomiaru —
> inne ręce commitowały: `259be4e35b` → `cc02477c4e` → `b1a7cd362a`; 15 nośnych odwołań przeczytano
> na końcu jeszcze raz, żeby żaden numer linii nie był z nieistniejącego stanu).
> **Zero zmian w kodzie w tej paczce** — to dokument projektowy, nie implementacja.
> **Fala 2, nie MVP.** Właściciel 05.09 (14:46–14:56): „Finanse wyrzucamy z MVP. Nie jesteś w stanie
> tego zrobić. To, co pokazałeś, jest gorsze niż to, co było." — `docs/program/MVP_BACKLOG_20260905.md`
> §K. Wcześniej (Baseline klasyczny): „to nie jest nawet cień rozwiązania dla finansistów, pracujemy
> na całej tabeli". Ta paczka jest odpowiedzią na oba zdania naraz.

---

## 1. Cel dla użytkownika

Dyrektor finansowy otwiera Model bazowy DBR77 i widzi **jedną pełną tabelę: RZiS · Bilans · Rachunek
przepływów, trzy lata historii obok horyzontu prognozy**, zbudowaną z jego własnego, zatwierdzonego
sprawozdania — a w Wycenie widzi, **z której wersji tego modelu liczba pochodzi**, klikalnie.

---

## 2. Zakres

**Moduł 10 Finanse.** 16 ekranów w rejestrze grafiki (`docs/program/grafika/status.json`, klucze
`finance-*`): `finance-hub`, `finance-statement-pack-workspace-v2`, `finance-analysis-workspace`,
`finance-model-workspace`, `finance-baseline-workspace`, `finance-prediction-workspace`,
`finance-valuation-workspace`, `finance-compare-panel`, `finance-comments-panel`,
`finance-lineage-navigator`, `finance-saved-views-panel`, `finance-export-import-panel`,
`finance-workspace-bar`, `finance-value-panels`, `finance-focus-mode`, `finance-id-bridge`.

**Ekrany dotknięte tą paczką — 7:** `finance-statement-pack-workspace-v2` (ogniwa 1–2),
`finance-analysis-workspace` (ogniwo 3), `finance-model-workspace` (ogniwo 4),
`finance-baseline-workspace` (ogniwa 5–6, **główny odbiór**), `finance-valuation-workspace`
(ogniwo 6 domykające + wskazanie źródła), `finance-prediction-workspace` (biały ekran),
`finance-compare-panel` (ogniwo 7 opcjonalne).

**Zamrożenie.** Moduł 10 **nie jest** w `docs/program/MVP_FINAL_ZAMROZONE.json` (14 wpisów:
`13_CHAT`, `01_ORGANIZATION`, `02_INTERVIEW`, `03_TOOLS`, `04_ASSESSMENT`, `05_INITIATIVES`,
`06_EXECUTION`, `07_MY_WORK_AGENT`, `08_MEETINGS`, `11_MATERIALS`, `12_AUDITS`, `14_ADMIN`,
`15_SETTINGS`, `16_PARTNER`). `src/components/Finance/**` i `src/components/Economics/**` są
**poza** listami plików zamrożonych — **żaden krok tej paczki nie wymaga markera
`[ODMROZENIE … DEC-…]`**. Wyjątek do pilnowania: 20 plików o nazwach „financial" należy do modułów
zamrożonych (`05_INITIATIVES`: `src/components/Initiatives/sections/FinancialAnalysisSection.tsx`,
`FinancialImpactSection.tsx`, `financialNarrativeBlocks.ts`; `07_MY_WORK_AGENT`:
`src/components/MyWork/table/financial/*` — 17 plików). Gdyby krok ich dotknął, marker jest
obowiązkowy.

---

## 3. Przyczyna źródłowa

### 3.1 Jedno zdanie

Warstwa kanoniczna Finansów (v3) jest **zbudowana i przetestowana od strony odczytu i kontraktu, ale
nie ma producentów** — pięć tabel, od których zależy pełna tabela, **nie jest zapisywana przez żaden
kod produkcyjny**; zapisują je wyłącznie testy, fikstury i jeden skrypt dowodowy. To jedenasty kształt
fałszywego „gotowe" (biblioteka bez wywołania) w skali całego podsystemu.

### 3.2 Tabela producentów (zmierzona `rg` na HEAD, `server/src` bez `__tests__`)

| Tabela | Producent produkcyjny | Dowód |
| --- | --- | --- |
| `finance_stmt_calendars` | **BRAK** | jedyny INSERT: `server/src/scripts/baselineContextOpeningPeriodRealDbProof.ts:105` (skrypt dowodowy) |
| `finance_stmt_periods` | **BRAK** | jedyny INSERT: `…RealDbProof.ts:122`; jedyny DELETE produkcyjny: `server/src/routes/testSupport.routes.ts:559` |
| `finance_stmt_entities` | **tylko przeniesienie z istniejącej wersji** | `server/src/services/finance/canonical/financeImportService.ts:838` kopiuje jednostki z `fromBusinessVersionId` do `toBusinessVersionId` — nie tworzy pierwszej |
| `finance_stmt_lines` | `statementMappingService.mapStatementLines` (`:394`) przez `POST /api/v8/finance-v2/statements/:businessVersionId/map` (`server/src/routes/v8/finance-v2/statements.routes.ts:57`, wołanie `:85`) | **ale** wymaga, żeby `periodId` rozwiązał się do istniejącego wiersza `finance_stmt_periods` (`statementMappingService.ts:261`, null przy braku `:148`) |
| `finance_baseline_models` | **BRAK** | zero INSERT-ów w `server/src`; czytelnik `baselineComputeService.ts:217` zwraca `NO_BASELINE_MODEL_ROW` (`:223`) → HTTP 404 (`baseline.routes.ts:302`) |
| `finance_baseline_workspace_contexts` | `baselineContextService.ts:567` (jedyny) | wołany wyłącznie przez `PUT /baseline/:bv/context` (`baseline.routes.ts:66-67`) — **zero wołaczy z frontendu** |
| `finance_lineage_edges` `STATEMENT_TO_MODEL` | **BRAK** | tylko odczyt (`baselineComputeService.ts:158`, `valuationLegacyComputeAdapterService.ts:109`) |
| `finance_lineage_edges` `ANALYSIS_TO_MODEL` | **BRAK** | tylko odczyt (`baselineContextService.ts:126`, `:438`) |
| `finance_lineage_edges` `STATEMENT_TO_ANALYSIS` | `lineage-navigator.routes.ts:298` (w `POST /versions/:sourceVersionId/derived-analysis`, `:227`) | jedyny producent |
| `finance_lineage_edges` `MODEL_TO_VALUATION` / `SCENARIO_TO_VALUATION` | `valuationSourceBindingService.ts:295` (dowieziony **dziś**, `18b27b19c8`) | `POST /valuation/variants/:bv/source` (`valuation.routes.ts:559`) |

**Furtka, która skraca robotę.** Ogólna trasa `POST /api/v8/finance-v2/versions/lineage-edges`
(`lineage-navigator.routes.ts:361`) przyjmuje **wszystkie osiem** typów krawędzi z allowlisty
`:181-190` — w tym `STATEMENT_TO_MODEL` i `ANALYSIS_TO_MODEL`. **Ogniwo 4 nie wymaga nowego
endpointu**, tylko wołacza.

### 3.3 Dlaczego to widać dopiero na ekranie Baseline

`GET /api/v8/finance-v2/baseline/:bv/context` przechodzi przez sześć bramek odczytu i **siedemnaście**
bramek zapisu. Pełna lista (`server/src/services/finance/canonical/baselineContextService.ts`):

**Odczyt (`readContextTx`, `:70`):**
1. artefakt musi być `BASELINE_MODEL` → 404 `NOT_FOUND` (`:83`)
2. wiersz w `finance_baseline_workspace_contexts` → 409 `BASELINE_CONTEXT_NOT_CONFIGURED` (`:96`) — **tu dziś ląduje DBR77**
3. „authority": pakiet `APPROVED` + analiza `APPROVED` + **trzy** krawędzie (`STATEMENT_TO_MODEL`, `STATEMENT_TO_ANALYSIS`, `ANALYSIS_TO_MODEL`) → 409 `BASELINE_CONTEXT_SOURCE_STALE` (`:141`)
4. komplet okresów prognozy w `finance_stmt_periods` → 409 `BASELINE_CONTEXT_INVALID` (`:161`)
5. ≥1 wiersz `finance_baseline_assumptions` → 409 `BASELINE_CONTEXT_NOT_READY` (`:194`)
6. metadane okresu otwarcia rozwiązywalne w TEJ organizacji → 409 `BASELINE_CONTEXT_INVALID` (`:246`)

**Zapis (`configureBaselineWorkspaceContext`, `:280`):** `IDEMPOTENCY_KEY_REQUIRED` ·
`INVALID_EXPECTED_VERSION` · `INVALID_CONTEXT` (komplet pól) · `INVALID_CONTEXT` (unikalność okresów) ·
`FINANCE_EDIT_FORBIDDEN` (rola z `EDIT_ROLES`, `:7`) · `IDEMPOTENCY_PAYLOAD_COLLISION` ·
`NOT_FOUND` (JOIN `finance_baseline_models` — **wiersz rejestru musi istnieć**) ·
`BASELINE_CONTEXT_IMMUTABLE` (status `DRAFT`) · `BASELINE_CONTEXT_HORIZON_MISMATCH`
(`horizon_months === forecastPeriodIds.length`) · `BASELINE_SOURCE_NOT_CONFIGURED` /
`BASELINE_SOURCE_AMBIGUOUS` (**dokładnie jedna** krawędź z `APPROVED` pakietu) ·
`BASELINE_ANALYSIS_NOT_CONFIGURED` / `BASELINE_ANALYSIS_AMBIGUOUS` (**dokładnie jedna** zgodna
`APPROVED` analiza) · `INVALID_CONTEXT_ENTITY` (jednostka z pakietu) · `INVALID_CONTEXT_PERIOD`
(okresy istnieją; `period_type='MONTH'` — **`:505`**; jeden kalendarz) ·
`INVALID_CONTEXT_PERIOD_ORDER` (ciągły łańcuch `previous_period_id` po okresie otwarcia — **`:518`**) ·
`INVALID_OPENING_BALANCE_SHEET_PERIOD` (okres otwarcia ma linie `BS` w `finance_stmt_lines`) ·
`BASELINE_CONTEXT_VERSION_CONFLICT`.

### 3.4 Pętla bez wyjścia po stronie klienta

`CreateModelModal` (`src/components/Economics/modals/CreateModelModal.tsx`, 367 linii) w **obu**
trybach idzie tą samą ścieżką `handleCreate` (`:124-184`) → `V8FinanceApi.createModel` (`:103`,
`POST /api/v8/finance/models`), a przy błędzie legacy fallback `POST /api/financial-modeling/models`
(`:108`). Serwer po tej stronie pisze **wyłącznie** legacy `financial_models`
(`server/src/services/financialModelingService.ts:1393` `createModel`, INSERT ~`:1464`). Formularz zbiera
`name` · `startDate` · `horizonMonths` (domyślnie 60) · `granularity` · `currency` ·
`sourceStatementPackId` — i **nie ma żadnego pola na `entityId`, `openingBalanceSheetPeriodId`
ani `forecastPeriodIds`**, czyli dokładnie na te trzy rzeczy, których żąda PUT
(`src/services/api/financeV2.api.ts:803-824`). Klient `configureBaselineWorkspaceContext` **istnieje**
i nie ma **ani jednego wołacza z frontendu**.

Skutkiem `BaselineWorkspace.tsx` (`:159-194`) dostaje 409, nie sprawdza kodu błędu (`:187-190`) i
renderuje jedną generyczną kartę „**Nie można otworzyć kontekstu modelu bazowego.**"
(`:203`, `data-testid="baseline-context-error"`) z jedyną akcją „Spróbuj ponownie" (`:205-210`),
która powtarza to samo, failujące żądanie. Akcji „Skonfiguruj kontekst" **nie ma nigdzie w kodzie**.
To zmierzone na żywo w Rundzie 7 (`evidence/odbior-zywo-20260905/09-finanse/RUNDA3.md`, Runda 7):
model `DBR77 — Model bazowy 2023-2025` (legacy `08b2fad8-b072-4d02-8ec4-3ff6b948ce39`, kanoniczny
BV `d151a83a-50b4-460c-8193-4080a0d4798c`) daje 409 **niezależnie od trybu tworzenia**.

### 3.5 Co już zostało naprawione dziś (i czego to NIE załatwia)

| Commit | Co dowiózł | Czego nie załatwia |
| --- | --- | --- |
| `2d10989e7d` + `5612a4b840` + `b488d0a523` | `legacyIdentityMaterializationService` — most legacy→kanoniczny zakłada brakującą tożsamość (`finance_artifacts` + BV + alias), `POST /artifacts/resolve-legacy/:table/:id/ensure` | zakłada **tożsamość**, nie **rejestr**: nie pisze `finance_baseline_models`, nie tworzy żadnej krawędzi |
| `18b27b19c8` | `valuationSourceBindingService` + `POST /valuation/variants/:bv/source` + chooser w `SourceStep` | chooser oferuje wyłącznie artefakty ze statusem `APPROVED` (`ValuationWorkspace.tsx:401`, serwer `valuationSourceBindingService.ts:259`) — a **żaden Baseline DBR77 nie może dziś dojść do `APPROVED`** |
| `e55970f94f` | `financialStatementService.locateStatementSections` — numerowana pozycja Bilansu z liczbami nie jest już brana za nagłówek noty; okres porównawczy Bilansu przestaje ginąć | to naprawa **legacy** readiness pakietu (`financial_statement_packs.pack_readiness_status`, migracja `20260316`); nie tworzy ani jednego wiersza `finance_stmt_*` |

### 3.6 Podwójna prawda (nazwana wprost)

Import właściciela żyje w **legacy**: `financial_statements` / `financial_statement_packs` /
`financial_statement_versions`. `confirmAndRegisterStatementPack`
(`server/src/services/finance/canonical/statementPackRegistrationService.ts:72`) rejestruje przy
potwierdzeniu **kanoniczny artefakt** `STATEMENT_PACK` + BV + alias (`createArtifact`,
`INSERT INTO finance_artifact_aliases` ~`:222`) — ale `snapshotCanonicalStatementVersion`
(`financialStatementService.ts:8403`) pisze **tylko** `financial_statement_versions` (`:8443`).
Czyli: **tożsamość kanoniczna powstaje, dane kanoniczne nie.** To jest właściwa nazwa dziury
i punkt, w którym niniejsza paczka rozszerza pomiar §G z 14:00.

---

## 3A. Docelowa podróż CFO — 6 kroków

| # | Krok | Ekran | Co widzi | Co powstaje pod spodem |
| --- | --- | --- | --- | --- |
| 1 | **Import** | Finanse → Sprawozdania → „Importuj sprawozdanie" | RZiS + Bilans + CF, rok i okres porównawczy, „Pakiet gotowy" | legacy statement + `pack_readiness_status='ready'` **oraz** kanoniczna projekcja: kalendarz, okresy `FY`+`MONTH`, jednostka, linie `finance_stmt_lines` |
| 2 | **Zatwierdź pakiet** | podgląd pakietu → „Skieruj do przeglądu" → „Zatwierdź" | plakietka **Zatwierdzony** | BV pakietu `DRAFT → IN_REVIEW → APPROVED` |
| 3 | **Analiza historyczna** | pakiet → „Powiązane artefakty" → Analiza „+ Nowy" → „Zatwierdź" | wskaźniki 3 lat, plakietka **Zatwierdzony** | `HISTORICAL_ANALYSIS` + krawędź `STATEMENT_TO_ANALYSIS`, BV `APPROVED` |
| 4 | **Model** | „Utwórz model finansowy" → „Oprzyj na sprawozdaniu" | model otwiera się **od razu**, bez karty błędu | legacy `financial_models` **+** `finance_baseline_models` **+** krawędzie `STATEMENT_TO_MODEL` i `ANALYSIS_TO_MODEL` **+** okresy `MONTH` horyzontu **+** kontekst |
| 5 | **Pełna tabela** | Model bazowy → „Wyniki" | **RZiS · Bilans · CF, 3 lata historii + horyzont, jedna tabela** | `runBaselineCompute` → `finance_baseline_outputs`; BV modelu → `APPROVED` |
| 6 | **Wycena** | Wycena → krok „Źródło" | „Źródło: **DBR77 — Model bazowy 2023-2025 · wersja 1**", klikalne | krawędź `MODEL_TO_VALUATION` |

**Dziś łańcuch urywa się na kroku 1** (kanoniczna projekcja nie powstaje) i niezależnie na kroku 4
(brak rejestru, krawędzi, okresów i wołacza PUT).

---

# OGNIWO 1 — Import: pakiet `ready` + kanoniczna projekcja

### §4 Projekt rozwiązania

Jeden nowy serwis `server/src/services/finance/canonical/statementCanonicalProjectionService.ts`
jako **jedyne miejsce**, w którym potwierdzony pakiet legacy staje się danymi kanonicznymi. Wołany
z `confirmAndRegisterStatementPack` (`statementPackRegistrationService.ts:72`) **w tej samej
transakcji**, po `createArtifact`, przed commitem. Kolejność wewnętrzna wymuszona kluczami obcymi:
kalendarz → okresy → jednostka → linie.

Kontrakt (zod, nowy `server/src/services/finance/canonical/statementProjection.contract.ts`):

```
ProjectStatementPackInput = {
  organizationId: string, businessVersionId: string, statementId: string, actorId: string,
  fiscalYearEndMonth: 1..12,                      // z pakietu, domyślnie 12
  periods: Array<{ kind: 'FY' | 'MONTH', fiscalYear: int, fiscalMonth?: 1..12,
                   periodStart: ISO, periodEnd: ISO, label: string }>,
  entity: { entityCode: string, legalName: string, functionalCurrency: 'PLN'|... ,
            role: string, consolidationMethod: string },
  lines: Array<{ canonicalLineId: string, statementType: 'P&L'|'BS'|'CF',
                 periodLabel: string, valueDecimal: number|null,
                 valueStatus: 'PRESENT_ZERO'|'PRESENT_NONZERO'|'ABSENT', unit: string }>
}
```

Zakazy: **żadnej własnej tabeli**; wyłącznie `finance_stmt_calendars` / `finance_stmt_periods` /
`finance_stmt_entities` / `finance_stmt_lines`. **Zero migracji** — schemat istnieje
(`server/migrations/20260809_finance_v3_d01_statements_01_tables.sql:71` i dalej).
Projekcja jest **idempotentna po `business_version_id`**: powtórne potwierdzenie nie duplikuje.

**Okresy `MONTH` powstają już tutaj**, nie w ogniwie 5: dla każdego roku obrachunkowego pakietu
zakładamy 12 okresów miesięcznych z łańcuchem `previous_period_id`, a linie roczne wiążemy z okresem
`FY`. Okres zamknięcia ostatniego roku (np. `12/2025`) dostaje **kopię linii Bilansu** — to on będzie
`openingBalanceSheetPeriodId` w ogniwie 6 i jedyne miejsce, gdzie bramka
`INVALID_OPENING_BALANCE_SHEET_PERIOD` (`baselineContextService.ts:530`) może przejść.

### §5 Kroki wykonania

1. **(M)** `statementProjection.contract.ts` — schematy zod + mapa `statementType → canonical_line_id`
   (istniejący katalog: `financial_statement_lines`, taksonomia z migracji
   `…finance_statement_canonical_mapping_taxonomy.sql`).
2. **(L)** `statementCanonicalProjectionService.ts` — `projectStatementPackToCanonical(tx, input)`;
   kalendarz `INSERT … ON CONFLICT DO NOTHING` po `(organization_id, fiscal_year_end_month)`;
   okresy `FY` i `MONTH` z łańcuchem; jednostka; linie hurtem.
3. **(S)** Wpięcie w `statementPackRegistrationService.ts` po `createArtifact` — jedno wywołanie
   w istniejącej `withPgTransaction`.
4. **(S)** Mapowanie kodów gotowości na polskie komunikaty (dług z audytu CES 2027, pozycja 2:
   `MISSING_PLAN`, `MISSING_CF`, `INVALID_PERIOD_COUNT`, `INVALID_MEMBER_COUNT`,
   `MISSING_PERIOD_STATEMENT`, `HAS_PENDING_STATEMENT` renderowane surowo) — słownik w
   `public/locales/{pl,en}/translation.json` + użycie w podglądzie pakietu.

Żaden krok nie dotyka modułów zamrożonych.

### §6 Testy

- **Jednostkowe (realny PG):** nowy `server/src/services/finance/canonical/__tests__/statementCanonicalProjection.pg.test.ts`.
  Asercje: (a) po potwierdzeniu pakietu istnieje ≥1 wiersz w każdej z czterech tabel dla tego BV;
  (b) liczba okresów `MONTH` = 12 × liczba lat, łańcuch `previous_period_id` ciągły;
  (c) okres zamknięcia ma linie `BS` (`statement_type='BS'`) dla jednostki;
  (d) powtórne potwierdzenie **nie** zwiększa liczby wierszy (idempotencja).
  **Dowód mutacyjny celujący w zabezpieczenie, nie w mechanizm:** usuń wstawianie okresu zamknięcia
  → test (c) MUSI spaść, a test (a) dalej przechodzi. Drugi: rozerwij łańcuch (`previous_period_id = NULL`)
  → (b) spada. Trzeci: zdejmij warunek idempotencji → (d) spada.
- **Regresja legacy:** `server/src/services/__tests__/financialStatementService.contract.test.ts`
  (63 linie dołożone dziś w `e55970f94f`) musi zostać zielone bez zmian — dowód, że projekcja nie
  ruszyła gotowości pakietu.
- **Wizualne:** podgląd pakietu 1440 jasny + ciemny — plakietka „Gotowy" i **polskie** komunikaty
  stanu zamiast enumów.

### §7 Kryterium odbioru właściciela

Na `localhost:3000`: importuje sprawozdanie DBR77, klika „Potwierdź" i widzi **„Pakiet gotowy"**
oraz stan po polsku — bez żadnego kodu typu `MISSING_CF`.

### §8 Ryzyka i cofanie

- **Ryzyko:** projekcja w tej samej transakcji co potwierdzenie — błąd projekcji wywala import,
  który dziś działa. **Zabezpieczenie:** flaga serwerowa `FINANCE_CANONICAL_PROJECTION` (default OFF
  do akceptu); przy OFF `confirmAndRegisterStatementPack` zachowuje się bit w bit jak dziś.
- **Ryzyko:** podwójna prawda się pogłębia (legacy + kanon opisują ten sam pakiet).
  **Zabezpieczenie:** projekcja jest **jednokierunkowa i wyprowadzana**, nigdy edytowana ręcznie;
  źródłem pozostaje legacy.
- **Cofanie:** flaga OFF → natychmiast. Dane kanoniczne zostają (są addytywne, nikt ich nie czyta
  przy OFF).

### §9 Nakład

**Opus 1,5 dnia.** Sonnet nie — mapowanie taksonomii i okresy to trudny kod. Nie da się
zrównoleglić wewnątrz ogniwa (kroki 1→2→3 są zależne); krok 4 (i18n stanów) **równolegle**, Sonnet 0,25 dnia.

---

# OGNIWO 2 — Zatwierdzenie pakietu do BV `APPROVED`

### §4 Projekt rozwiązania

**Zero nowego serwera.** Endpointy istnieją:
`POST /api/v8/finance-v2/versions/:businessVersionId/transitions`
(`server/src/routes/v8/finance-v2/versions.routes.ts:117-118`) dla `DRAFT → IN_REVIEW`, oraz
`POST /api/v8/finance-v2/models/:modelId/approve` (`models.routes.ts:104-105`, serwis
`artifactVersionService.approveVersion:866`, zapis `:1170`) dla `IN_REVIEW → APPROVED` — trasa jest
**agnostyczna względem typu artefaktu**, `:modelId` to `artifact_id`. Trasa `transitions` świadomie
wyklucza `approve`/`reopen` (allowlist `:34-42`, komunikat `:129`).

Brakuje **wyłącznie kontrolek**. Dokładamy je do istniejącego paska stanu pakietu
(`FinanceWorkspaceBar` — potwierdzony jako zgodny w Rundzie 5: „Eksportuj", rozwijany status
„Wersja robocza", kebab). Rozwijany status dostaje dwie realne pozycje: **„Skieruj do przeglądu"**
i **„Zatwierdź"**, obie z nagłówkiem `X-Model-Version` / `expectedVersion` (wymagane, `versions.routes.ts:133`).

Kanon: `StandardModuleBar`/`StandardPreview` bez zmian, tokeny `c-*`, zero `primary-*`, kebab pionowy,
i18n `pl` + `en`.

### §5 Kroki wykonania

1. **(S)** `src/services/api/financeV2.api.ts` — `transitionFinanceVersion(bv, action, expectedVersion)`
   obok istniejącego `approveFinanceModel` (`:613`, `${BASE}/models/${id}/approve` `:619`).
2. **(M)** Kontrolki w rozwijanym statusie paska warsztatu pakietu + optymistyczne odświeżenie po
   `version + 1` (serwer zwraca `status` i `version`, `versions.routes.ts:160-166`).
3. **(S)** Klucze i18n `pl`/`en` dla obu akcji i dla stanów `DRAFT`/`IN_REVIEW`/`APPROVED`.

### §6 Testy

- **Jednostkowe (realny PG):** rozszerzyć `server/src/routes/v8/finance-v2/__tests__/` o przypadek
  `STATEMENT_PACK`: `DRAFT → IN_REVIEW → APPROVED` przez realne HTTP, plus **niezależny odczyt SQL**
  `finance_business_versions.status` (wzorzec z `baseline.routes.pg.test.ts:18-21`).
  **Dowód mutacyjny:** zdejmij warunek `IN_REVIEW` (`models.routes.ts:139-143`) → test „approve z DRAFT
  musi dać 409" spada. Drugi: zdejmij `expectedVersion` → test wyścigu (dwa równoległe `transitions`
  z tym samym `expectedVersion` — jeden 200, jeden 409) spada.
- **Klikany (Playwright):** pakiet → rozwijany status → „Skieruj do przeglądu" → „Zatwierdź" →
  plakietka „Zatwierdzony" widoczna po odświeżeniu strony (nie tylko optymistycznie).
- **Wizualne:** pasek warsztatu pakietu 1280/1440/1920, jasny + ciemny.

### §7 Kryterium odbioru właściciela

Otwiera swój pakiet DBR77, klika dwa razy i widzi plakietkę **Zatwierdzony** — która przeżywa
odświeżenie przeglądarki.

### §8 Ryzyka i cofanie

- **Ryzyko:** `approveVersion` degraduje wersję nadrzędną (`artifactVersionService.ts:1155`) —
  zatwierdzenie zmienia stan innych wersji. **Zabezpieczenie:** test na dwóch wersjach pakietu.
- **Ryzyko:** rola. `approveVersion` ma własną bramkę + bramka trasy (`models.routes.ts:122`,
  `role === 'owner' || 'admin' → 'approver'`, `:70`). Właściciel ma `OWNER` — zmierzone.
- **Cofanie:** `POST /models/:id/reopen` (`models.routes.ts:199-200`) istnieje. `git revert` kroku UI.

### §9 Nakład

**Sonnet 0,5 dnia** (mechanika, endpointy gotowe). **Może iść równolegle z ogniwem 1** — dotyka
innych plików.

---

# OGNIWO 3 — `HISTORICAL_ANALYSIS` + krawędź `STATEMENT_TO_ANALYSIS`

### §4 Projekt rozwiązania

**Serwer gotowy w całości.** `POST /api/v8/finance-v2/versions/:sourceVersionId/derived-analysis`
(`lineage-navigator.routes.ts:226-227`) w jednej transakcji (`:277`) z blokadą doradczą (`:240`)
i replayem idempotencji (`:263-283`): sprawdza, że źródło to `STATEMENT_PACK` (`:258`, 409 `:318`),
zakłada artefakt `HISTORICAL_ANALYSIS` (`:285-290`) i **od razu** krawędź `STATEMENT_TO_ANALYSIS`
(`:292-300`, `transformationKind: 'MANUAL_LINK'` `:299`). To **jedyny** producent tej krawędzi
w kodzie.

Brakuje **jednej gałęzi w kliencie**. `FinanceHub.handleCreateRelatedArtifact` przepuszcza dziś
wyłącznie `HISTORICAL_ANALYSIS`… i to jest właśnie ta ścieżka — ale przycisk „+ Nowy" w panelu
„Powiązane artefakty" (`src/components/Finance/statementPackWorkspaceV2/RelatedArtifactsSection.tsx`)
**dla pozostałych typów pokazuje toast „Ten typ artefaktu nie ma jeszcze bezpiecznego kreatora"**.
Dla Analizy droga jest otwarta — trzeba ją tylko domknąć zatwierdzeniem (ogniwo 2 dla BV analizy).

### §5 Kroki wykonania

1. **(S)** Potwierdzić `rg`-iem, że „+ Nowy" przy „Analiza historyczna" faktycznie woła
   `derived-analysis` (nie `POST /artifacts`, który tworzy artefakt **bez krawędzi**,
   `artifacts.routes.ts:124-125`, typ na allowliście `:63`). Jeśli woła `/artifacts` — **przepiąć**.
2. **(S)** Podpiąć kontrolki zatwierdzania z ogniwa 2 również do warsztatu Analizy.
3. **(M)** Naprawić 2× 404 z audytu CES 2027 (pozycja 4): `GET /api/v8/finance/analyses/:id/ratios`
   i `GET /api/economics/financial-analyses/:id/ratios`
   (`src/components/Economics/hooks/useFinanceSelection.ts:811`,
   `src/components/Benefits/FinancialAnalysisWorkspace.tsx:307`, serwer
   `server/src/routes/economics.routes.ts:2342`) — ustalić, czy sub-zasób wymaga wcześniejszego
   przeliczenia, czy id nie jest rozpoznawane.
4. **(S)** Pusta wartość przed dwukropkiem: „Analiza finansowa: Waluta: Liczba okresów: 0"
   (audyt CES 2027 pozycja 6) — fallback `—`.

### §6 Testy

- **Jednostkowe (realny PG):** `lineage-navigator.routes.pg.test.ts` — po `derived-analysis`
  istnieje **dokładnie jedna** krawędź `STATEMENT_TO_ANALYSIS` o tym `source`/`target`
  (niezależny odczyt SQL), a powtórne wołanie z tym samym kluczem idempotencji **nie** tworzy drugiej.
  **Dowód mutacyjny:** usuń `insertEdge` z `:292` → test spada, mimo że artefakt dalej powstaje
  (to celuje w zabezpieczenie „artefakt bez rodowodu jest bezużyteczny", nie w mechanizm tworzenia).
- **Klikany:** pakiet → „Powiązane artefakty" → Analiza „+ Nowy" → warsztat Analizy otwiera się
  z niepustymi wskaźnikami → „Zatwierdź" → plakietka.
- **Konsola:** zrzut `.json` z harnessu musi mieć **zero** wpisów 404 przy otwarciu Analizy.

### §7 Kryterium odbioru właściciela

Z ekranu pakietu jednym kliknięciem tworzy Analizę historyczną, widzi w niej **wskaźniki 3 lat**
i zatwierdza ją — bez błędu w podglądzie.

### §8 Ryzyka i cofanie

- **Ryzyko:** krawędź jest **append-only** (`finance_lineage_edges` ma wyzwalacze
  `deny_update` / `deny_delete`, `server/migrations/20260809_finance_v3_b03_lineage_freshness.sql:150-163`).
  Krawędź podpięta pod zły pakiet **zostaje na zawsze**. **Zabezpieczenie:** przycisk potwierdza
  nazwę pakietu przed utworzeniem; na stagingu pracujemy na **nowych** rekordach DBR77, nie na starych.
- **Ryzyko:** wyzwalacz `prevent_cycle` (`:100-145`) odrzuca krawędź o złym `stage_rank` —
  komunikat surowy z Postgresa. **Zabezpieczenie:** mapowanie błędu w `lineageService.ts:243-249`
  już istnieje; przetestować, że użytkownik widzi polski komunikat, nie `RAISE EXCEPTION`.
- **Cofanie:** `git revert` kroków klienta. Krawędzi się nie cofa — patrz ryzyko 1.

### §9 Nakład

**Sonnet 0,5 dnia** (kroki 1–2, 4) + **Opus 0,5 dnia** (krok 3, diagnoza 404).
**Zależy od ogniwa 2** (potrzebuje kontrolek zatwierdzania) i od ogniwa 1 (pakiet musi mieć dane).

---

# OGNIWO 4 — Rejestr `finance_baseline_models` + krawędzie przy tworzeniu modelu

### §4 Projekt rozwiązania

**Decyzja architektoniczna: rejestr i krawędzie powstają PO STRONIE SERWERA, przy tworzeniu modelu —
nigdy z klienta.** Powód: klient nie ma transakcji, a krawędzie są append-only; częściowe utworzenie
(artefakt + jedna krawędź) jest **nieodwracalne**.

Nowy serwis `server/src/services/finance/canonical/baselineModelRegistrationService.ts`,
`registerBaselineModel(tx, {...})`, wołany z trasy tworzącej model (`POST /api/v8/finance/models`,
`server/src/routes/v8/finance.routes.ts`) w **jednej** transakcji, po tym jak
`legacyIdentityMaterializationService.ensureLegacyFinanceArtifactIdentity` zwróci
`artifactId` / `businessVersionId` dla typu `BASELINE_MODEL`. Wykonuje trzy zapisy:

```
1. INSERT INTO finance_baseline_models
     (organization_id, business_version_id, horizon_months, horizon_rationale,
      horizon_rationale_note, created_by)
   ON CONFLICT (business_version_id) DO NOTHING
2. insertEdge STATEMENT_TO_MODEL : APPROVED STATEMENT_PACK BV -> model BV
3. insertEdge ANALYSIS_TO_MODEL  : APPROVED HISTORICAL_ANALYSIS BV -> model BV
```

Kontrakt zod (rozszerzenie ciała `POST /finance/models`):

```
horizonRationale: 'STEADY_STATE' | 'DEBT_MATURITY' | 'BUSINESS_CYCLE'   // NOT NULL + CHECK
horizonRationaleNote: string.min(1)                                     // NOT NULL, „36 miesięcy" bez powodu nie przechodzi przeglądu
sourceStatementPackVersionId: uuid                                      // BV, nie legacy id
sourceAnalysisVersionId: uuid                                           // BV, nie legacy id
```

Ograniczenia z migracji `server/migrations/20260809_finance_v3_d05_baseline_01_tables.sql:55-84`:
`horizon_months` 1..240, `horizon_rationale` z trzech wartości, `horizon_rationale_note` NOT NULL,
`uq_finance_baseline_models_bv` UNIQUE.

**Nowy endpoint nie jest potrzebny do krawędzi** — `insertEdge` (`lineageService.ts:204`) jest
wołalny z serwera, a ogólna trasa `POST /versions/lineage-edges` (`lineage-navigator.routes.ts:361`,
allowlista `:181-190` zawiera oba typy) istnieje jako awaryjna droga ręczna. **Migracji: zero.**

W kliencie `CreateModelModal.tsx` dochodzą dwa pola do trybu „Oprzyj na sprawozdaniu":
**uzasadnienie horyzontu** (select 3 wartości) i **notatka** (textarea) oraz — wyprowadzony
z wybranego pakietu — wybór **zatwierdzonej Analizy** (lista, gdy jest więcej niż jedna;
bramka `BASELINE_ANALYSIS_AMBIGUOUS` wymaga dokładnie jednej).

### §5 Kroki wykonania

1. **(M)** Kontrakt zod + rozszerzenie ciała `POST /api/v8/finance/models`; walidacja, że oba
   podane BV mają status `APPROVED` i właściwe `artifact_type` — **przed** jakimkolwiek zapisem.
2. **(L)** `baselineModelRegistrationService.ts` — trzy zapisy w jednej transakcji, blokada doradcza
   po `business_version_id`, idempotencja (powtórka nie tworzy drugiej krawędzi; `insertEdge`
   tłumaczy DUPLICATE `lineageService.ts:243-249`).
3. **(M)** Wpięcie w trasę tworzenia modelu; przy trybie „Rozpocznij od zera" **nie** rejestrujemy
   baseline'u — model manualny nie ma źródła i nie może udawać, że ma (uczciwy stan: ekran mówi
   „model bez źródła, nie policzy pełnej tabeli").
4. **(M)** `CreateModelModal.tsx` — dwa nowe pola + lista zatwierdzonych Analiz pakietu; walidacja
   po stronie klienta lustrzana do zod.
5. **(S)** Komunikaty błędów `BASELINE_SOURCE_AMBIGUOUS` / `BASELINE_ANALYSIS_NOT_CONFIGURED`
   po polsku w kreatorze (nie surowy kod).

### §6 Testy

- **Jednostkowe (realny PG):** nowy `baselineModelRegistration.pg.test.ts`.
  (a) po `POST /finance/models` w trybie „ze sprawozdania" istnieje **dokładnie jeden** wiersz
  `finance_baseline_models` i **dokładnie dwie** krawędzie o właściwych typach (niezależny SQL);
  (b) powtórka z tym samym kluczem — dalej jeden i dwie;
  (c) pakiet w `DRAFT` (nie `APPROVED`) → 409, **zero** wierszy i **zero** krawędzi
  (bo krawędzi nie da się usunąć — częściowy zapis jest katastrofą);
  (d) `horizonRationale` spoza trzech wartości → 400 **zanim** cokolwiek powstanie.
  **Dowód mutacyjny celujący w zabezpieczenie:** przenieś `insertEdge` przed walidację statusu →
  test (c) MUSI spaść na „zero krawędzi", a (a) dalej przechodzi. To dowodzi, że test broni
  atomowości, nie samego tworzenia.
- **Wyścig:** dwa równoległe `POST /finance/models` dla tego samego pakietu — dokładnie jeden
  wiersz rejestru (blokada doradcza działa). Ten test **musi** iść na realnym PG: atrapa bazy
  zwraca `changes:1` dla każdego UPDATE niezależnie od WHERE (`server/src/database/Database.ts:686`).
- **Klikany:** kreator → „Oprzyj na sprawozdaniu" → wybór pakietu → wybór Analizy → uzasadnienie →
  „Utwórz" → model otwiera się **bez karty błędu** (to jest widoczny efekt ogniwa 4 + 5 + 6 razem).

### §7 Kryterium odbioru właściciela

Tworzy model z zatwierdzonego sprawozdania i **nie widzi karty „Nie można otworzyć kontekstu
modelu bazowego"** — model otwiera się od razu.

### §8 Ryzyka i cofanie

- **Ryzyko krytyczne — append-only.** Zła krawędź `STATEMENT_TO_MODEL` jest **nieusuwalna**
  (`…b03_lineage_freshness.sql:150-163`). Model z podpiętym złym pakietem trzeba **porzucić**
  i utworzyć nowy. **Zabezpieczenie:** walidacja PRZED zapisem (krok 1) + test (c) + test wyścigu.
- **Ryzyko:** wyzwalacz `prevent_cycle` odrzuca krawędź o złej randze etapu
  (`…b03…sql:100-145`, komunikat `:136`). **Zabezpieczenie:** rangi są poprawne z definicji
  (`STATEMENT_PACK` → `BASELINE_MODEL`), ale test musi to potwierdzić na realnym PG.
- **Ryzyko:** rozszerzenie ciała endpointu psuje istniejących wołaczy. **Zabezpieczenie:**
  nowe pola **opcjonalne** na poziomie zod; brak = tryb „bez rejestracji" (dzisiejsze zachowanie
  bit w bit).
- **Cofanie:** `git revert`. Wiersze `finance_baseline_models` są addytywne i nikt ich nie czyta
  bez kontekstu; krawędzie zostają (patrz ryzyko 1).

### §9 Nakład

**Opus 2 dni** (kroki 1–3, atomowość i append-only to trudny kod) + **Sonnet 0,5 dnia** (kroki 4–5).
**Zależy od ogniw 1, 2, 3.** Krok 4 (klient) może iść równolegle z 1–3, jeśli kontrakt jest zamrożony
na piśmie.

---

# OGNIWO 5 — Generator miesięcznych okresów prognozy

### §4 Projekt rozwiązania

Ogniwo 1 zakłada okresy **historii**. Tu zakładamy okresy **prognozy**: `horizonMonths` kolejnych
okresów `period_type='MONTH'`, w tym samym `fiscal_calendar_id` co okres otwarcia, z ciągłym
łańcuchem `previous_period_id` zaczynającym się od okresu otwarcia. Dokładnie to sprawdzają bramki
`baselineContextService.ts:505` (typ `MONTH`), `:509` (jeden kalendarz), `:514-527` (łańcuch i
uporządkowanie po `period_start`).

Funkcja `generateForecastPeriods(tx, { organizationId, fiscalCalendarId, openingPeriodId,
horizonMonths, actorId })` w tym samym serwisie co ogniwo 1
(`statementCanonicalProjectionService.ts` — jedno miejsce, w którym powstają okresy; **zakaz**
drugiego generatora). Zwraca `forecastPeriodIds` w kolejności chronologicznej. Idempotentna:
powtórne wołanie dla tego samego kalendarza i zakresu zwraca istniejące id, nie zakłada duplikatów.

Ograniczenia z `…d01_statements_01_tables.sql:71-100`: `period_end > period_start`,
`chk_finance_stmt_period_month_shape` (`fiscal_month` NOT NULL, `fiscal_quarter`/`fiscal_week` NULL),
`label` NOT NULL — etykieta w formacie `MM/RRRR` (kolumna `label` jest **jedynym** źródłem etykiety
w UI; dyżur 279: kolumna „Okres bazowy" pokazywała `per-2025-12` zamiast `12/2025`, bo etykieta
była parsowana z napisu id — **zakaz parsowania id**).

**Migracji: zero.**

### §5 Kroki wykonania

1. **(M)** `generateForecastPeriods` — pętla po miesiącach, `previous_period_id` z poprzednika,
   `label` `MM/RRRR`, `ON CONFLICT DO NOTHING` po naturalnym kluczu (`organization_id`,
   `fiscal_calendar_id`, `period_type`, `fiscal_year`, `fiscal_month`) z domknięciem odczytem.
2. **(S)** Wołanie z `baselineModelRegistrationService` (ogniwo 4) — okresy powstają **razem
   z rejestrem**, w tej samej transakcji, żeby ogniwo 6 miało z czego wybrać.

### §6 Testy

- **Jednostkowe (realny PG):** rozszerzenie `statementCanonicalProjection.pg.test.ts`.
  (a) dla `horizonMonths=36` powstaje **36** okresów `MONTH`;
  (b) `forecast[0].previous_period_id === openingPeriodId`, a każdy kolejny wskazuje poprzednika;
  (c) wszystkie mają ten sam `fiscal_calendar_id` co okres otwarcia;
  (d) `label` każdego pasuje do `^\d{2}/\d{4}$`;
  (e) powtórne wołanie → dalej 36, te same id.
  **Dowód mutacyjny:** ustaw `previous_period_id = NULL` w generatorze → **test (b) spada, a (a) i (d)
  dalej przechodzą** — to dowodzi, że test broni bramki `INVALID_CONTEXT_PERIOD_ORDER`, a nie
  liczby wierszy. Drugi: zmień `period_type` na `'Q'` → CHECK bazy odrzuca, test (a) spada
  z błędem bazy, nie z asercji (to też trzeba nazwać w raporcie).
- **Test kontraktowy przeciw bramkom:** po wygenerowaniu okresów wołać **realny**
  `configureBaselineWorkspaceContext` (jak `server/src/services/__tests__/statementOwnerAcceptance.pg.test.ts:1343`)
  i sprawdzić, że **nie** rzuca `INVALID_CONTEXT_PERIOD` ani `INVALID_CONTEXT_PERIOD_ORDER`.

### §7 Kryterium odbioru właściciela

Nie widzi tego ogniwa osobno — jego efekt to kolumny horyzontu w tabeli z ogniwa 6.
**Nie robimy z tego osobnego odbioru** (lekcja: dyżur zamiast bramki).

### §8 Ryzyka i cofanie

- **Ryzyko:** kalendarz o innym końcu roku obrachunkowego niż grudzień — okresy `MONTH` roku
  obrachunkowego nie pokrywają się z kalendarzowymi. **Zabezpieczenie:** `fiscal_year`/`fiscal_month`
  liczone z `fiscal_year_end_month` kalendarza, nie z daty; test z `fiscal_year_end_month=6`.
- **Ryzyko:** `horizonMonths` domyślnie 60 w kreatorze (`CreateModelModal.tsx:308-315`) → 60 wierszy
  okresów na każdy model. **Zabezpieczenie:** CHECK bazy dopuszcza ≤240; dla DBR77 ustawiamy 36
  i mówimy to wprost w planie danych (§ Plan danych, krok 6).
- **Cofanie:** `git revert`. Okresy są addytywne; nieużyte nie szkodzą (nikt ich nie czyta bez
  kontekstu wskazującego je w `forecast_period_ids`).

### §9 Nakład

**Opus 0,75 dnia.** **Zależy od ogniwa 1** (kalendarz i okres otwarcia) i jest **konsumowane przez
ogniwo 4** — w praktyce robi to ta sama ręka co ogniwo 1, bezpośrednio po nim.

---

# OGNIWO 6 — `PUT` z kreatora + akcja „Skonfiguruj kontekst"

### §4 Projekt rozwiązania

Dwie drogi do tego samego serwisu, żeby zamknąć zarówno **nowe** modele, jak i **zastane** rekordy
DBR77 (13 modeli sprzed 05.09):

**(A) Ścieżka szczęśliwa — serwer, przy tworzeniu.** `baselineModelRegistrationService` (ogniwo 4)
po zapisie rejestru i krawędzi oraz po wygenerowaniu okresów (ogniwo 5) woła
`configureBaselineWorkspaceContext` (`baselineContextService.ts:280`) **w tej samej transakcji**:

```
entityId                    = jedyna jednostka pakietu źródłowego (finance_stmt_entities dla pakietu BV)
openingBalanceSheetPeriodId = okres zamknięcia ostatniego roku pakietu (ma linie BS — ogniwo 1)
forecastPeriodIds           = wynik generateForecastPeriods (ogniwo 5), len === horizon_months
expectedVersion             = 0
idempotencyKey              = deterministyczny: `baseline-ctx:${businessVersionId}`
```

**(B) Ratunek dla rekordów zastanych — akcja „Skonfiguruj kontekst" na karcie błędu.**
`BaselineWorkspace.tsx:199-214` przestaje być ślepą uliczką: karta rozróżnia **kod** błędu
(dziś go nie czyta, `:187-190`) i przy `BASELINE_CONTEXT_NOT_CONFIGURED` pokazuje — obok
„Spróbuj ponownie" — przycisk **„Skonfiguruj kontekst"**, który otwiera mały kreator (wybór pakietu
źródłowego, wybór Analizy, potwierdzenie okresu otwarcia i horyzontu) i woła istniejący klient
`configureBaselineWorkspaceContext` (`src/services/api/financeV2.api.ts:803-824`) — **pierwszy
wołacz z frontendu w historii tego pliku**.

Pozostałe kody dostają **własne, polskie** komunikaty zamiast jednego generycznego:
`BASELINE_CONTEXT_SOURCE_STALE` („źródło modelu przestało być aktualne"),
`BASELINE_CONTEXT_NOT_READY` („model nie ma jeszcze żadnych założeń do edycji"),
`BASELINE_SOURCE_NOT_CONFIGURED`, `BASELINE_ANALYSIS_NOT_CONFIGURED`.

**Domknięcie do Wyceny.** Po `runBaselineCompute` i zatwierdzeniu BV modelu (ogniwo 2, ta sama
trasa `approve`) chooser źródła wyceny (`SourceStep.tsx:120,135,162`, serwer
`valuationSourceBindingService.bindValuationSource:220`, wymóg `APPROVED` `:259`) **po raz pierwszy
ma kandydata** i krok „Źródło" przechodzi z `blocked` (`ValuationWorkspace.tsx:428`) na `ready`.

Kanon: karta błędu i kreator na `StandardPreview`/`EmptyStateInline`, tokeny `c-*`, fokus `c-focus`,
zero `primary-*`, i18n `pl` + `en`.

### §5 Kroki wykonania

1. **(M)** Ścieżka (A): wołanie `configureBaselineWorkspaceContext` z `baselineModelRegistrationService`,
   z wyliczeniem czterech argumentów; przy braku jednoznacznej jednostki → 409 z polskim komunikatem,
   **bez** zapisu.
2. **(S)** `BaselineWorkspace.tsx` — odczyt `error.data.code` i mapa kodów na komunikaty (`pl`/`en`).
3. **(M)** Kreator „Skonfiguruj kontekst" — nowy komponent w `src/components/Finance/baseline/`,
   wołający istniejący klient PUT.
4. **(S)** Klucze i18n dla sześciu kodów błędu + tytułów kreatora.
5. **(S)** i18n paska narzędzi Wyceny — **22 etykiety w 100% po angielsku** na flagowym ekranie
   (audyt CES 2027 pozycja 1: Banking value, Cash forecast, Driver planner, Driver tree, Extended
   ratios, Headcount planner, Investment appraisal, Rolling forecast, Valuation visuals, Value
   attribution, Value capture pipeline, Value ledger, Value office, Variance bridge, Variance
   narration, EV basket, Monte Carlo NPV, Real options, Efficient frontier, What-if sensitivity,
   Scenario compute). **Bez tego Wyceny nie wolno pokazać właścicielowi** — audyt sam to nazwał
   dyskwalifikacją.

### §6 Testy

- **Jednostkowe (realny PG):** rozszerzenie `baselineModelRegistration.pg.test.ts` —
  po pełnym `POST /finance/models` **`GET /baseline/:bv/context` zwraca 200**, a nie 409;
  odpowiedź ma `forecastPeriods.length === horizonMonths` i `openingBalanceSheetPeriod.label`
  w formacie `MM/RRRR` (**nie** `per-…` — regresja dyżuru 279).
  **Dowód mutacyjny:** zdejmij wołanie PUT ze ścieżki (A) → ten test spada z 409, podczas gdy testy
  ogniwa 4 (rejestr + krawędzie) dalej przechodzą. To rozdziela dwie bramki, które łatwo pomylić.
- **Jednostkowe klienta:** `BaselineWorkspace.context.test.tsx` (istnieje,
  `src/components/Finance/baseline/__tests__/`, dziś asertuje tylko obecność
  `baseline-context-error` przy 409) — rozszerzyć: przy `BASELINE_CONTEXT_NOT_CONFIGURED` renderuje
  się przycisk „Skonfiguruj kontekst"; przy `BASELINE_CONTEXT_SOURCE_STALE` **nie** renderuje się
  (bo kreator by nie pomógł), a komunikat jest inny.
- **Klikany (Playwright, `tests/e2e/finance/`):** kreator → model → **Wyniki** → tabela z RZiS/Bilans/CF
  → „Zatwierdź" → Wycena → krok „Źródło" → wybór modelu → plakietka „Źródło: … wersja 1".
- **Wizualne:** `finance-baseline-workspace` i `finance-valuation-workspace`, **1280 / 1440 / 1920**,
  jasny **i** ciemny, harnessem repo:
  ```
  ODBIOR_AUTH_STATE=/private/tmp/odbior-auth/auth.json \
  node scripts/dev/odbior-zywo/zrzut.mjs \
    --url='/economics?tab=models&…' \
    --out=evidence/finanse-pelna-tabela/baseline-1440-jasny.png \
    --czekaj=4000 --pelna
  ```
  Bezpiecznik przeciw parze bliźniaczej: jasny i ciemny muszą różnić się `mean_luma` (>150 dla
  jasnego), inaczej to ten sam obraz pod dwiema nazwami.

### §7 Kryterium odbioru właściciela

Na `localhost:3000` otwiera **DBR77 — Model bazowy 2023-2025** i widzi **jedną tabelę: RZiS, Bilans,
Rachunek przepływów, trzy lata historii i kolumny prognozy** — bez żadnej karty błędu. Potem otwiera
Wycenę i w kroku „Źródło" widzi nazwę tego modelu z numerem wersji.

### §8 Ryzyka i cofanie

- **Ryzyko:** `BASELINE_CONTEXT_NOT_READY` — kontekst zapisany, ale **zero** wierszy
  `finance_baseline_assumptions` (`baselineContextService.ts:194`). Producent istnieje
  (`baselineComputeService.upsertAssumptionsBatch:839`, trasa `POST /baseline/:bv/assumptions`,
  `baseline.routes.ts:177`), ale nikt go nie woła przy tworzeniu modelu. **To jest ukryta bramka
  ósma i najbardziej prawdopodobna przyczyna „zielonego ogniwa 6 i dalej pustego ekranu".**
  **Zabezpieczenie:** ścieżka (A) zasiewa komplet założeń domyślnych z `buildSeededAssumptionsFromPack`
  (istnieje w `financialModelingService.ts`) przełożonych na `upsertAssumptionsBatch`; test (a)
  ogniwa 6 sprawdza `GET .../context` → 200, co **wymaga** ≥1 założenia.
- **Ryzyko:** `BASELINE_CONTEXT_IMMUTABLE` — kontekstu nie da się przekonfigurować po wyjściu z `DRAFT`
  (`:363`). Kreator (B) musi to powiedzieć wprost, zamiast dać 409.
- **Ryzyko:** flaga. `financeBaselineWorkspaceV1` była **zdalnie wyłączona** dla DBR77 w tabeli
  `feature_flags`, a zmiana wymaga superadmina (token `OWNER` dostawał 403) — Runda 6.
  Naprawiona i potwierdzona w Rundzie 7, ale **przed odbiorem sprawdzić `GET /api/feature-flags/runtime`**,
  nie kod. (Lekcja: flaga OFF w kodzie ≠ wyłączona; i odwrotnie.)
- **Cofanie:** flaga `financeBaselineWorkspaceV1` OFF → ekran wraca do widoku klasycznego natychmiast.
  Tag `demo-safe-<data>` przed partią. Kontekst w bazie jest addytywny.

### §9 Nakład

**Opus 1,5 dnia** (kroki 1, 3 + zasiew założeń) + **Sonnet 0,5 dnia** (kroki 2, 4, 5).
**Zależy od ogniw 4 i 5.** Krok 5 (i18n Wyceny) **całkowicie równoległy**, Sonnet, od pierwszego dnia.

---

# OGNIWO 7 (OPCJONALNE) — Porównanie wersji

### §4 Projekt rozwiązania

**Nie budujemy nic** — sześć endpointów istnieje i działa:
`POST /api/v8/finance-v2/compare/{periods,versions,entities,scenarios,valuation-methods,actual-vs-forecast}`
(`server/src/routes/v8/finance-v2/compare.routes.ts:93,127,166,202,236,265`; serwis
`financeCompareService.ts`, `compareVersions:863`). Komponent
`src/components/Finance/compare/FinanceComparePanel.tsx:171` **jest** zamontowany —
`FinanceWorkspaceUtilities.tsx:11` (import), `:101-114` (render pod zakładką `compare`),
ładowany leniwie z `FinanceHub.tsx:212-216`.

**Przyczyna „nie renderuje się" jest jedna i banalna:** `FinanceWorkspaceUtilities` zwraca `null`,
dopóki `useFinanceWorkspacePlatformFlag().enabled` jest fałszem, a ta flaga ma
**`defaultValue: false`** (`src/hooks/useFinanceWorkspacePlatformFlag.ts:34`). Sam
`financeCompareV1` ma `defaultValue: true` (`src/hooks/useFinanceCompareFlag.ts:30`) — to nie on blokuje.
Drugi warunek: musi istnieć **druga wersja** artefaktu, inaczej renderuje się tekst zastępczy
(`FinanceWorkspaceUtilities.tsx:116-120`).

Robota = **włączyć flagę po akcepcie na zrzucie** + poprawić dwa **nieaktualne** komentarze, które
dziś kłamią: `useFinanceCompareFlag.ts:6-7` („nie wpięty w żaden workspace produkcyjny… dostępny
wyłącznie przez dev-render") i `FinanceComparePanel.tsx:16` („default OFF").

### §5 Kroki wykonania

1. **(S)** Zrzut panelu przez `dev-render/` na dwóch wersjach modelu DBR77 → akcept właściciela.
2. **(S)** `financeWorkspacePlatformV1` → `defaultValue: true` po akcepcie, **osobnym commitem**,
   pojedynczo (zakaz masowego włączania flag).
3. **(S)** Poprawić dwa nieaktualne komentarze.

### §6 Testy

`compare.routes.pg.test.ts` istnieje. Dołożyć jeden test klienta: przy `financeWorkspacePlatformV1`
ON i **jednej** wersji renderuje się tekst zastępczy, przy **dwóch** — panel.
**Dowód mutacyjny:** zdejmij warunek `comparisonVersionId` (`:58-62`) → test spada.

### §7 Kryterium odbioru właściciela

Otwiera model, klika „Porównaj" i widzi różnice między wersją 1 a 2 — wartości, Δ i %.

### §8 Ryzyka i cofanie

Włączenie flagi platformy odsłania **wszystkie** narzędzia paska naraz (Powiązania, Porównaj,
Komentarze, Widoki, Excel) — a to jest dokładnie zakazane „masowe włączanie". **Zabezpieczenie:**
akcept na zrzucie **każdego** z pięciu narzędzi osobno przed przestawieniem flagi. Cofanie: flaga OFF.

### §9 Nakład

**Sonnet 0,25 dnia** + czas właściciela na akcept. **Poza ścieżką krytyczną.**

---

## 4. Plan danych DBR77 — realne rekordy, w tej kolejności

Zasada: **wszystko przez UI, zero SQL na żywej bazie, zero rekordów testowych** (dane demo są twarzą
produktu). Środowisko: `localhost:3000` → backend stagingu, sesja właściciela.

| # | Co utworzyć | Gdzie | Warunek przejścia dalej |
| --- | --- | --- | --- |
| 1 | **Sprawozdanie 2023 z por. 2022** | Finanse → Sprawozdania → „Importuj sprawozdanie" | `pack_readiness_status = 'ready'` (po ogniwie 1) — nie `recoverable` |
| 2 | **Sprawozdanie 2024 z por. 2023** | j.w. | j.w. |
| 3 | **Sprawozdanie 2025 z por. 2024** | j.w. | j.w. — trzy lata historii, o które prosił właściciel |
| 4 | **Zatwierdzenie pakietu 2025** | podgląd pakietu → status → „Skieruj do przeglądu" → „Zatwierdź" | plakietka **Zatwierdzony** przeżywa odświeżenie |
| 5 | **Analiza historyczna** z pakietu 2025 | pakiet → „Powiązane artefakty" → „+ Nowy" → „Zatwierdź" | plakietka **Zatwierdzony**; **dokładnie jedna** analiza (bramka `BASELINE_ANALYSIS_AMBIGUOUS`) |
| 6 | **Model bazowy**, horyzont **36** mies., uzasadnienie `BUSINESS_CYCLE` | „Utwórz model finansowy" → „Oprzyj na sprawozdaniu" | otwiera się **bez** karty błędu |
| 7 | **Przeliczenie** modelu | Model → „Przelicz" | `finance_baseline_outputs` niepuste; tabela pokazuje liczby |
| 8 | **Zatwierdzenie modelu** | pasek → status → „Zatwierdź" | **warunek konieczny**, żeby chooser wyceny miał kandydata |
| 9 | **Wycena** ze wskazanym źródłem | Wycena → „Źródło" → wybór modelu | krok „Źródło" = `ready`, nie `blocked` |

**Sprzątanie po zastanym bałaganie.** Na stagingu leżą już dwa pakiety DBR77 z Rundy 7
(`19ff7554-1e82-446b-b4d5-00981eba7c24` okres 2024, `901581c8-0668-454e-98a1-ce316a6d9f10` okres 2025)
oraz model `08b2fad8-b072-4d02-8ec4-3ff6b948ce39` / BV `d151a83a-50b4-460c-8193-4080a0d4798c`,
wszystkie w stanie nie do uratowania (pakiety `recoverable`, model bez kontekstu).
**Nie naprawiamy ich — tworzymy komplet od nowa** (kroki 1–9) i dopiero po akcepcie właściciela
decydujemy, czy stare kasować. Powód: krawędzie rodowodu są append-only, więc doszywanie
do skażonych rekordów jest nieodwracalne.

---

## 5. Biały ekran Predykcji (~6%) — plan badania

**Co zmierzono.** 16 świeżych prób (4×4, `--czekaj=4000`): **1/16 (~6%)** pełny biały ekran —
znacznie rzadziej niż raportowane wcześniej 3/4
(`evidence/odbior-zywo-20260905/09-finanse/RUNDA3.md`, Runda 4). Sieć czysta.

**Hipoteza główna — brak granicy Suspense wokół leniwego warsztatu.** `FinanceV3PredictionWorkspace`
jest `lazy()` (`src/components/Economics/FinanceHub.tsx:193-197`), renderowany w
`CanonicalFinanceDirectWorkspace` (`:337-341`). `{content}` — zawierające `fullView` — jest
renderowane w `:4128` **bez żadnego opakowania Suspense**; ani `CanonicalFinanceDirectWorkspace`
(`:241-357`), ani `CanonicalFinanceWorkspaceMount` (`:218-239`) go nie mają. Trzy istniejące granice
w tym pliku pokrywają co innego: `:3469` (gałąź rozwiązywania), `:3869` (kreator importu),
`:4155` (stos modali, `fallback={null}`). Skutek: zawieszenie leniwego chunku propaguje się do
granicy **na poziomie aplikacji** (`src/routes/AppRoutes.tsx:1164-1170`), której fallback ma
`h-screen` — zastępuje **całą** wyrenderowaną aplikację i przemontowuje poddrzewo po rozwiązaniu.
Przy zimnym imporcie i wolnej sieci to jest dokładnie „pełny biały ekran, rzadko".

**Hipoteza poboczna — routing `fullView`.** Ten sam obszar naprawiał udokumentowany FIX-4
(`FinanceHub.tsx:4014-4022`, komentarz wprost: stary warunek „made `fullView` return null and this
branch **render a blank screen** instead of falling through to the list below"). Decyzja jest teraz
`:4023-4027`. Możliwy pozostały przypadek brzegowy: `direct-workspace` bez `activeDocument`,
gdy `resolveCanonicalFinanceQueryOutcome` (`:583`) rozstrzyga inaczej niż `fullView` (`:3371-3388`).

**Trzecia możliwość — brak granicy błędu.** W `FinanceHub.tsx` nie ma **ani jednego** `ErrorBoundary`.
`PredictionWorkspace` ma własną (`Prediction/PredictionWorkspace.tsx:40,483,557`), ale ona łapie
dopiero **po** zamontowaniu — nie w trakcie ładowania chunku. Najbliższa to `RouteErrorBoundary`
wokół `EconomicsView` (`src/routes/AppRoutes.tsx:2441-2443`).

**Plan badania (Opus, 0,5 dnia, przed jakąkolwiek naprawą):**
1. **Rozstrzygnięcie hipotezy głównej bez zmiany kodu produkcyjnego:** w harnessie dławić sieć
   (`Network.emulateNetworkConditions`, 3G) i mierzyć **20 prób**. Jeśli odsetek białych ekranów
   rośnie z ~6% do >50% — mechanizm potwierdzony, dalej nie zgadujemy.
2. **Rozstrzygnięcie hipotezy pobocznej:** zalogować `canonicalFinanceQueryOutcome.kind` i
   `activeDocumentId` przy każdym renderze; sprawdzić, czy w białej próbie było
   `direct-workspace` bez dokumentu.
3. **Naprawa (dopiero po 1–2):** `<Suspense fallback={<LoadingState template="panel" />}>`
   wokół `{content}` w `:4128` **plus** `ErrorBoundary` na tym samym poziomie.
   Fallback **lokalny**, nie `h-screen` — użytkownik ma widzieć szkielet warsztatu, nie pustą stronę.
4. **Test regresji:** `PredictionWorkspace.errorBoundary.test.tsx` (istnieje) + nowy test, który
   **wymusza** zawieszenie leniwego importu (mock `import()` zwracający promise rozwiązywany ręcznie)
   i asertuje, że renderuje się fallback **wewnątrz** modułu, a nie pełnoekranowy spinner.
   **Dowód mutacyjny:** usuń Suspense → test spada; usuń ErrorBoundary → drugi test (rzut w mount)
   spada.

**Uczciwie:** dopóki krok 1 nie da liczby, to jest **hipoteza, nie przyczyna**. Nie wolno zapisać
w rejestrze „naprawione", jeśli defekt jest 1/16 — jedna zielona próba niczego nie dowodzi;
kryterium wyjścia to **20 kolejnych prób bez białego ekranu przy dławionej sieci**.

---

## 6. Kryterium odbioru całości — jeden komplet zrzutów i jeden przepływ

**Komplet zrzutów** (katalog `evidence/finanse-pelna-tabela-<data>/`), harnessem
`scripts/dev/odbior-zywo/zrzut.mjs`, sesja właściciela, **1440 jasny + 1440 ciemny** minimum,
ekran flagowy dodatkowo 1280 i 1920:

1. `baseline-pelna-tabela-1440-jasny.png` — **RZiS · Bilans · CF, trzy lata historii + kolumny
   horyzontu, jedna tabela**, nagłówek z nazwą „DBR77 — Model bazowy 2023-2025", kolumna
   „Okres bazowy" pokazująca `12/2025` (**nie** `per-2025-12`).
2. `baseline-pelna-tabela-1440-ciemny.png` — ta sama kompozycja; `mean_luma` musi się różnić
   (bezpiecznik przeciw parze bliźniaczej).
3. `wycena-zrodlo-1440-jasny.png` — krok „Źródło" z **wypełnioną** nazwą modelu i numerem wersji,
   plakietka `ready`, **zero** angielskich etykiet na pasku narzędzi.
4. `pakiet-zatwierdzony-1440-jasny.png` — plakietka „Zatwierdzony" i polskie komunikaty stanu.
5. `baseline-1280.png` / `baseline-1920.png` — tabela nie łamie się i nie chowa kolumn za panelem
   Teresy (defekt cross-cutting z audytu CES 2027, pozycja 3).

**Jeden przepływ klikany** (Playwright, `tests/e2e/finance/finance-cfo-pelna-tabela.signed.spec.ts`),
bez ani jednego zapytania SQL:

```
Sprawozdania → Importuj (2025 z por. 2024) → Potwierdź          → „Pakiet gotowy"
  → status → Skieruj do przeglądu → Zatwierdź                    → „Zatwierdzony"
  → Powiązane artefakty → Analiza + Nowy → Zatwierdź             → „Zatwierdzony"
  → Utwórz model finansowy → Oprzyj na sprawozdaniu → Utwórz     → warsztat BEZ karty błędu
  → Wyniki                                                        → tabela RZiS/Bilans/CF z liczbami
  → status → Zatwierdź                                            → „Zatwierdzony"
  → Wycena → Źródło → wybierz model                               → „Źródło: … wersja 1"
```

**Bezpiecznik przeciw przyrządowi.** Kontrolki harnessu nie mogą zasłaniać produktu na zrzucie,
a zrzut musi pochodzić z **realnej trasy aplikacji**, nie z hosta dev-render — porównać łańcuch
przodków elementu w obu miejscach przed wpisaniem werdyktu.

**Jak uruchomić testy na REALNYM Postgresie** (bramka czterech zmiennych; bez kompletu testy
**pomijają się** i zgłaszają „skipped", co nie jest PASS):

```bash
# 1) jednorazowo — świeża, jednorazowa baza + migracje
DATABASE_URL=$(/Users/piotrwisniewski/fv3-pg/newdb.sh finanse-pelna-tabela)
npx tsx server/scripts/migrate.postgres.ts        # schemat z server/migrations/*.sql

# 2) suita Finansów (z katalogu server/)
cd server && RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DB_TYPE=postgres \
  DATABASE_URL="$DATABASE_URL" \
  npx vitest run --config vitest.config.ts \
    src/services/finance/canonical src/routes/v8/finance-v2 \
    --no-file-parallelism

# 3) KONTROLA NEGATYWNA (obowiązkowa) — ta sama suita BEZ bramki
cd server && npx vitest run --config vitest.config.ts src/services/finance/canonical
#   MUSI zaraportować „skipped", nigdy „passed" — inaczej zieleń nie pochodzi z realnej bazy
```

Wzorzec bramki w każdym pliku `.pg.test.ts`
(`server/src/routes/v8/finance-v2/__tests__/baseline.routes.pg.test.ts:29-37`):
`RUN_DB_TESTS === '1' && MOCK_DB === 'false' && DATABASE_URL.startsWith('postgres')`, a dopiero
potem `process.env.DB_TYPE = 'postgres'`. **`DB_TYPE` domyślnie `sqlite`**
(`server/vitest.config.ts:17`) — bez jawnego ustawienia mierzy się nie tę bazę.
Wzorzec ten wymusza `scripts/check-z31.sh`. Kontrola negatywna jest wzorowana na
`single_sha_evidence_run.sh:150-153`.

---

## 7. Nakład, ścieżka krytyczna, zrównoleglenie

### Nakład per ogniwo

| Ogniwo | Opus | Sonnet | Zależy od |
| --- | ---: | ---: | --- |
| 1 · Import + projekcja kanoniczna | 1,50 | 0,25 | — |
| 2 · Zatwierdzenie pakietu | — | 0,50 | — |
| 3 · Analiza + krawędź | 0,50 | 0,50 | 1, 2 |
| 4 · Rejestr + krawędzie | 2,00 | 0,50 | 1, 2, 3 |
| 5 · Generator okresów | 0,75 | — | 1 |
| 6 · PUT + „Skonfiguruj kontekst" | 1,50 | 0,50 | 4, 5 |
| Biały ekran Predykcji | 0,50 | — | — |
| 7 · Porównanie (opcjonalne) | — | 0,25 | — |
| **Razem** | **6,75** | **2,50** | |

### Ścieżka krytyczna — **6,25 dnia Opus**

```
Ogniwo 1 (1,50)  →  Ogniwo 3 (0,50)  →  Ogniwo 4 (2,00)  →  Ogniwo 6 (1,50)
       ↓                                       ↑
   Ogniwo 5 (0,75) ───────────────────────────┘
```

`1 → 3 → 4 → 6` = 5,50 dnia; ogniwo 5 (0,75) wisi na ogniwie 1 i musi się zamknąć przed ogniwem 4,
a nie mieści się w oknie 3 (0,50) — stąd **6,25 dnia**. Ogniwo 2 (Sonnet, 0,50) mieści się
w całości w oknie ogniwa 1 i **nie wydłuża** ścieżki.

Z dwiema rękami naraz (Opus na torze głównym, Sonnet na równoległym) realny kalendarz to
**6–7 dni roboczych** do kompletu zrzutów, plus **1 dzień** właściciela na dane DBR77 i akcept.

### Co idzie równolegle od pierwszego dnia (bez blokad)

| Zadanie | Model | Nakład | Dlaczego bez ryzyka konfliktu |
| --- | --- | ---: | --- |
| Ogniwo 2 — kontrolki zatwierdzania | Sonnet | 0,50 | inne pliki (pasek warsztatu, `financeV2.api.ts`) |
| i18n paska Wyceny (22 etykiety) | Sonnet | 0,25 | tylko `public/locales/*` + `SourceStep` |
| Słownik stanów pakietu po polsku | Sonnet | 0,25 | tylko `public/locales/*` + podgląd |
| Badanie białego ekranu Predykcji (kroki 1–2, **bez naprawy**) | Opus | 0,25 | pomiar, zero zmian w kodzie |
| Ogniwo 7 — zrzut + akcept | Sonnet | 0,25 | poza ścieżką |

### Czego **nie wolno** zrównoleglić

Ogniw **4 i 6** nie wolno robić dwiema rękami: obie piszą do tej samej transakcji tworzenia modelu,
a krawędzie są append-only — częściowy zapis jest nieodwracalny. Jedna ręka, jeden commit na ogniwo.

---

## 8. Ryzyka zbiorcze

| # | Ryzyko | Waga | Zabezpieczenie |
| --- | --- | :-: | --- |
| R1 | **Append-only rodowód.** `finance_lineage_edges` ma wyzwalacze `deny_update`/`deny_delete` (`…b03_lineage_freshness.sql:150-163`) — zła krawędź jest **nieusuwalna** bez migracji. Ogniwa 3, 4 i 6 tworzą pięć krawędzi na jeden model. | **wysoka** | Walidacja **przed** zapisem (ogniwo 4 krok 1); test „przy 409 zero krawędzi" z dowodem mutacyjnym; wszystko w jednej transakcji; na stagingu **nowe** rekordy, nie doszywanie do skażonych |
| R2 | **Podwójna prawda legacy/kanon.** Import pisze `financial_statements`/`financial_statement_packs` (migracja `20260316`); kanon to `finance_stmt_*`. `confirmAndRegisterStatementPack:72` zakłada tożsamość kanoniczną, ale `snapshotCanonicalStatementVersion` (`financialStatementService.ts:8403`) pisze **tylko** `financial_statement_versions` (`:8443`). Dwa liczniki będą się rozjeżdżać. | **wysoka** | Projekcja **jednokierunkowa i wyprowadzana** (ogniwo 1), nigdy edytowana ręcznie; legacy pozostaje źródłem; przy sprawdzaniu stanu czytać **obiekt** (`finance_stmt_lines`), nie wpis rejestru |
| R3 | **Ukryta ósma bramka: `BASELINE_CONTEXT_NOT_READY`** — kontekst zapisany, ale zero `finance_baseline_assumptions` (`baselineContextService.ts:194`). Producent istnieje (`upsertAssumptionsBatch:839`), nikt go nie woła przy tworzeniu. Ogniwa 1–6 mogą być zielone, a ekran dalej pusty. | **wysoka** | Zasiew założeń domyślnych w ścieżce (A) ogniwa 6; test kontraktowy `GET /context` → **200** (a nie „PUT zwrócił 200") |
| R4 | **Higiena danych na stagingu.** Staging dzieli bazę z demo (`trolley`); dane DBR77 = twarz produktu. Trzy nieudane pakiety i model bez kontekstu już tam leżą. | średnia | Zero rekordów testowych; komplet tworzony przez UI (§4); decyzja o kasowaniu starych **dopiero po akcepcie**; zakaz SQL na żywej bazie |
| R5 | **Flaga zdalna ≠ flaga w kodzie.** `financeBaselineWorkspaceV1` była wyłączona w tabeli `feature_flags` dla DBR77, a token `OWNER` dostawał 403 przy zmianie (Runda 6). Komentarz w `useFinanceBaselineWorkspaceFlag.ts:30-31` twierdzi „domyślnie ON". | średnia | Przed każdym odbiorem `GET /api/feature-flags/runtime`, nie `grep` w kodzie |
| R6 | **Zmiana kontraktu `POST /finance/models`** psuje istniejących wołaczy (w tym legacy fallback `POST /api/financial-modeling/models`, `CreateModelModal.tsx:108`). | średnia | Nowe pola **opcjonalne** w zod; brak = zachowanie dzisiejsze bit w bit; test regresji na starym ciele żądania |
| R7 | **Nieaktualne komentarze jako źródło prawdy.** `useFinanceCompareFlag.ts:6-7` twierdzi, że panel nie jest wpięty w żaden workspace — a jest (`FinanceWorkspaceUtilities.tsx:11,101-114`). To samo `FinanceComparePanel.tsx:16` („default OFF" vs `defaultValue: true`). | niska | Ogniwo 7 krok 3; zasada: weryfikować `rg`-iem, nie komentarzem |
| R8 | **Biały ekran uznany za naprawiony na jednej próbie.** Defekt 1/16 — pojedynczy zielony przebieg niczego nie dowodzi. | średnia | Kryterium wyjścia: 20 kolejnych prób bez białego ekranu **przy dławionej sieci**; hipoteza pozostaje hipotezą do czasu pomiaru |
| R9 | **Granice zamrożenia.** `src/components/Finance/**` i `Economics/**` są wolne, ale 20 plików „financial" należy do `05_INITIATIVES` i `07_MY_WORK_AGENT`. | niska | `scripts/mvp-final/check-freeze.sh` (hook `commit-msg`) zablokuje; jeśli krok ich dotyka — marker `[ODMROZENIE <MODUL> DEC-<nr>]` |

---

## 9. Decyzje właściciela, na których to stoi

- **`docs/program/MVP_BACKLOG_20260905.md` §K (05.09, 14:46–14:56):** „**10 Finanse — POZA MVP**
  (właściciel: »Finanse wyrzucamy z MVP. Nie jesteś w stanie tego zrobić. To, co pokazałeś, jest
  gorsze niż to, co było.«). Uchyla decyzję CTO o 2-dniowym torze. **Fala 2: łańcuch Baseline v3
  (sekcja G), porównanie wersji, źródło wyceny do potwierdzenia na realnych danych.**"
  → to jest **dokładny mandat tej paczki**: sekcja G (ogniwa 1–6), porównanie wersji (ogniwo 7),
  źródło wyceny (domknięcie ogniwa 6).
- **`docs/program/MVP_BACKLOG_20260905.md` §G (05.09, ~14:10, mandat CTO):** „Baseline v3 = pierwszy
  punkt po MVP (łańcuch 6 ogniw z sekcji G). Na MVP ekran Baseline pokazuje uczciwy stan braku
  kontekstu." → kolejność ogniw w tej paczce jest tą samą kolejnością, wymuszoną kontraktem
  `baselineContextService.ts`.
- **`docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`:** rejestr zawiera
  finansowe pozycje `DEC-253` (wiersz 306 — sprostowanie „trzy moduły gotowe" → dwa, dowody Finansów
  liczone podwójnie), `DEC-264` (wiersz 335 — sekwencja Finansów), `DEC-276` (wiersze 330 i 338 —
  **równość → minimum**, zwracany pomiar rzeczywisty, sprawdzone w praktyce na Finansach),
  `DEC-288` (wiersz 356 — odbiór Finansów). **W rejestrze nie ma decyzji o kształcie pełnej tabeli** —
  jedyne wiążące zdanie właściciela na ten temat to „pracujemy na całej tabeli" i §K powyżej.
  Zapisuję to jako **lukę do domknięcia jednym pytaniem**, nie jako zgodę udzieloną.
- **Audyt CES 2027 (`docs/program/AUDYT_AWARD_20260905/C_*.md`, sekcja Finanse):** średnia modułu
  **A = 1,5 · B = 1,3** na 6 zmierzonych ekranach. Rekomendacja flagowa to *Sprawozdania — lista*,
  a **Wycena jest jawnie zdyskwalifikowana z pokazu do czasu tłumaczenia** 22 angielskich etykiet.
  Stąd krok 5 ogniwa 6 jest **warunkiem odbioru**, nie kosmetyką.
