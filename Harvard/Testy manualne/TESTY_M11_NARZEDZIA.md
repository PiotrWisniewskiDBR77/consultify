# TESTY — M11 Narzędzia (Library + Assessment)

> **Moduł:** M11 Narzędzia — Library (`/discovery-tools`, `/strategic`, `/operational`, `/digital`, `/process-automation`) + Assessment (`/assessment/*`) — wg `Harvard/podzial/_MODULE_MAP_V2.md`, inwentarz `Harvard/podzial/inventory/INV_C_wywiad_narzedzia_audyty.md`
> **Zakres tej paczki:** pełna biblioteka 31 narzędzi (14 SHIP + 17 coming-soon) + Megatrends workspace + 5 licencjonowanych frameworków Assessment (DRD/SIRI/ADMA/CMMI/LEAN) — lifecycle sesji, governance AI kart propozycji, wizard inicjatyw (za flagą OFF), raporty, gating dostępu.
> **Cel:** agent testujący ma zweryfikować uruchamianie i kompletność każdego SHIP-narzędzia, poprawność blokowania coming-soon, lifecycle sesji narzędzia (governance kart accept/reject/rethink), każdy z 5 frameworków Assessment od stworzenia przez ocenę do raportu, oraz że wyłączona flaga `assessmentInitiativesWizard` nie powoduje crashu.
> **Legenda:** **[MANUAL]** = wymaga ręcznej weryfikacji; **[FLAG]** = zależne od flagi/capability/roli; **[DB]** = dowód obejmuje wiersz/kolumnę w bazie.
> **Data:** 2026-06-16

---

## 0. Kontekst architektoniczny

### 0.1 Mapa komponentów

| Obszar | Komponent / Plik | Klucz |
|---|---|---|
| Library hub | `DiscoveryToolsHub.tsx` | `src/components/Discovery/DiscoveryToolsHub.tsx` (~4655 l.) |
| Katalog narzędzi (SSOT) | `KnownToolsService.ts` | `server/src/services/KnownToolsService.ts` |
| Workspace sesji narzędzia | `ToolWorkspace.tsx` | `src/components/DiscoveryTools/ToolWorkspace.tsx` |
| Stepper kroków | `ToolCanvas.tsx` | `src/components/DiscoveryTools/ToolCanvas.tsx` |
| Governance AI kart | `aiCardGovernance.ts` | `src/components/DiscoveryTools/aiCardGovernance.ts` |
| InlineAssist (Teresa w narzędziu) | `InlineAssist.tsx` | `src/components/DiscoveryTools/InlineAssist.tsx` |
| Generacja inicjatyw | `GenerateInitiativesModal.tsx` | `src/components/DiscoveryTools/GenerateInitiativesModal.tsx` |
| Podgląd narzędzia (detail) | `KnownToolDetailView.tsx` | `src/components/DiscoveryTools/KnownToolDetailView.tsx` |
| Megatrendy | `MegatrendsWorkspace.tsx` | `src/components/Megatrend/MegatrendsWorkspace.tsx` |
| Assessment hub | `AssessmentHub.tsx` | `src/components/assessment/AssessmentHub.tsx` |
| Edytor sesji (Workflow v2) | `AssessmentSessionEditorView.tsx` | `src/components/assessment/` |
| Edytory per-framework | `drd/DRDAssessmentEditor.tsx`, `siri/SIRIAssessmentEditor.tsx`, `adma/ADMAAssessmentEditor.tsx` + Lean/CMMI | `src/components/assessment/{drd,siri,adma}/` |
| Raporty | `AssessmentReportsWorkspace.tsx`, `GenericReportsWorkspace.tsx` | `src/components/assessment/` |
| Wizard inicjatyw (za flagą) | `InitiativesGenerationWizardModal.tsx` | `src/components/assessment/InitiativesGenerationWizardModal.tsx` |
| Backend — Library sesje | `tools.routes.ts` | `server/src/routes/tools.routes.ts` |
| Backend — Katalog narzędzi | `knownTools.routes.ts` | `server/src/routes/knownTools.routes.ts` |
| Backend — Megatrends | `megatrend.routes.ts` | `server/src/routes/megatrend.routes.ts` |
| Backend — Assessment | `assessment-workflow-v2.routes.ts` | `server/src/routes/assessment-workflow-v2.routes.ts` |
| Feature flag wizarda | `useFeatureFlags.tsx` | `src/hooks/useFeatureFlags.tsx` (id: `assessmentInitiativesWizard`, domyślnie **false**) |

### 0.2 Kluczowe endpointy

| Akcja | Metoda | Endpoint |
|---|---|---|
| Lista narzędzi (katalog) | GET | `/api/known-tools?lang=pl&limit=50` |
| Detal narzędzia | GET | `/api/known-tools/:toolType?lang=pl` |
| Utwórz sesję narzędzia | POST | `/api/tools` |
| Lista sesji | GET | `/api/tools` |
| Pobierz sesję | GET | `/api/tools/:toolId` |
| Aktualizuj sesję | PUT | `/api/tools/:toolId` |
| Zatwierdzenie przez reviewera | POST | `/api/tools/:toolId/approve` |
| Odesłanie do draftu | POST | `/api/tools/:toolId/send-back` |
| Promote do outputu | POST | `/api/tools/:toolId/promote` |
| Generuj inicjatywy z narzędzia | POST | `/api/tools/:toolId/generate-initiatives` |
| Pobierz wygenerowane inicjatywy | GET | `/api/tools/:toolId/generated-initiatives` |
| Megatrends baseline | GET | `/api/megatrends/baseline?industry=...` |
| Megatrends radar | GET | `/api/megatrends/radar?industry=...` |
| Lista assessmentów | GET | `/api/assessment-workflow-v2` |
| Utwórz assessment | POST | `/api/assessment-workflow-v2` |
| Pobierz assessment | GET | `/api/assessment-workflow-v2/:assessmentId` |
| Aktualizuj assessment | PUT | `/api/assessment-workflow-v2/:assessmentId` |
| Otwórz sesję edycji | POST | `/api/assessment-workflow-v2/:assessmentId/session/open` |
| Zamknij sesję edycji | POST | `/api/assessment-workflow-v2/:assessmentId/session/close` |
| Żądanie recenzji | POST | `/api/assessment-workflow-v2/:assessmentId/request-review` |
| Generuj raport | POST | `/api/assessment-workflow-v2/:assessmentId/report` |
| Zatwierdź raport | POST | `/api/assessment-workflow-v2/:assessmentId/report/approve` |
| Zatwierdź assessment | POST | `/api/assessment-workflow-v2/:assessmentId/approve` |
| Generuj inicjatywy z assessmentu | POST | `/api/assessment-workflow-v2/:assessmentId/generate-initiatives` |
| Pobierz inicjatywy z assessmentu | GET | `/api/assessment-workflow-v2/:assessmentId/generated-initiatives` |

### 0.3 Gating — jak testować

- **Public prod (consultify.ai):** `/discovery-tools` i `/assessment` są za `ProductionModuleGate`. Dla `hideNonCoreModulesOnPublicProduction=true` renderuje `<PublicProductionModuleDisabled>` zamiast treści. **Nie testuj na prod** — testuj na **dev (:3000/:3001)** lub **staging** (Railway caboose) jako użytkownik DBR77/OWNER.
- **Beta gate (Audyty M12):** `/audit-programs` za `BetaGate moduleId="MODULE_AUDITS"` — poza zakresem M11, ale potwierdź że sidebar nie myli Narzędzi z Audytami.
- **Flaga `assessmentInitiativesWizard`:** domyślnie `false` — przycisk „Generuj inicjatywy" w `AssessmentHub` i `InitiativesManagementPanel` ma być niewidoczny lub wyłączony (zależy od implementacji `wizardEnabled`), ale UI **nie może crashować**.

### 0.4 Zasada weryfikacji E2E

Każda akcja tworzenia/zmiany stanu musi być potwierdzona w **Network** (zakładka DevTools) właściwym żądaniem HTTP i kodem odpowiedzi. Odśwież stronę i sprawdź, że zapis przetrwał. Sama zmiana wyglądu przycisku to NIE dowód.

---

## Setup środowiska testowego

1. Uruchom dev server (`npm run dev` lub `pnpm dev`) — FE na `:5173` lub `:3000`, BE na `:3001`.
2. Zaloguj się jako **OWNER DBR77** (pełne uprawnienia, org dostęp do wszystkich modułów).
3. Otwórz DevTools → **Network** (XHR/Fetch), filtr na `/api/tools`, `/api/known-tools`, `/api/assessment-workflow-v2`, `/api/megatrends`.
4. Otwórz **Console** — zero błędów to wymóg w trakcie całej sesji testowej.
5. Przygotuj projekt testowy (opcjonalnie `projectId`) do użycia przy tworzeniu sesji narzędzi.
6. Sprawdź stan flagi: w DevTools wpisz w Console `window.__FEATURE_FLAGS__` lub sprawdź `useFeatureFlags()` — potwierdź `assessmentInitiativesWizard: false`.

---

## F1 — BIBLIOTEKA NARZĘDZI: katalog, lista, filtrowanie

### 1.1 Wejście do modułu i routing

- Wejście na `/discovery-tools` → ładuje `DiscoveryToolsHub` z domyślną zakładką (Library).
- Wejście bezpośrednie na `/strategic` → `DiscoveryToolsHub initialTab="library" initialCategory="strategic"`.
- Wejście na `/operational` → kategoria operational.
- Wejście na `/digital` → kategoria digital.
- Wejście na `/process-automation` → kategoria automation.
- **Asercja:** breadcrumbs poprawnie odzwierciedlają trasę (np. „Tools › Strategic Analysis").
- **Asercja:** żadna trasa nie powoduje błędu 404 ani crasha routera.

### 1.2 Ładowanie katalogu — endpoint

- Po wejściu na `/discovery-tools` → Network: `GET /api/known-tools?lang=pl&limit=50` → HTTP 200, odpowiedź zawiera pole `items` (array), `total`.
- **[DB]** `items.length` ≥ 31 lub `total` ≥ 31 (wszystkie narzędzia skonfigurowane w `KnownToolsService`).
- Stan ładowania: szkielet/spinner widoczny zanim odpowiedź wróci; po załadowaniu karty narzędzi wyświetlone.
- Błąd serwera (wyłącz backend): pokazuje komunikat błędu, NIE białą stronę (obsługa `knownToolsError`).

### 1.3 Wyświetlanie 31 narzędzi

Sprawdź wizualnie (lub przez Network response), że w katalogu widoczne są karty dla wszystkich kategorii:

| Kategoria | Liczba narzędzi (SHIP + coming-soon) |
|---|---|
| Strategiczne | ~10 |
| Operacyjne | ~10 |
| Digital | ~10 |
| Process Automation | 1 |

- **14 narzędzi SHIP** (launchable): `dynamic-swot`, `market-forces`, `growth-paths`, `portfolio-priority`, `risk-uncertainty`, `process-automation`, `sop-builder`, `a3-problem-solving`, `smed-planner`, `dms-builder`, `inventory-autopilot`, `ai-discovery`, `pain-explorer`, `rpa-scanner`.
- **17 narzędzi coming-soon** — karty widoczne w UI, ale z oznaczeniem „Coming soon" / zablokowanym przyciskiem startu.
- **Asercja SHIP:** przycisk „Uruchom" / „Start" aktywny (`cursor-pointer`, nie `disabled`).
- **Asercja coming-soon:** przycisk „Uruchom" wyszarzony (`disabled` lub `cursor-not-allowed`), klik nie tworzy sesji. Brak błędu w konsoli.

### 1.4 Filtrowanie po kategorii

- Klik na zakładkę/pill „Strategiczne" → lista filtruje do narzędzi `libraryCategory='strategic'`; Network: nowe żądanie z `?category=strategic` LUB filtrowanie po stronie klienta — odnotuj który mechanizm.
- Analogicznie: „Operacyjne", „Digital", „Process Automation".
- Przełączanie kategorii nie powoduje błędu ani pustej listy (chyba że kategoria rzeczywiście pusta).

### 1.5 Wyszukiwanie narzędzi [MANUAL]

- Wpisz „SWOT" w pole wyszukiwania → lista zawęża się do `dynamic-swot` (i ewentualnie innych pasujących). Network: `GET /api/known-tools?search=SWOT&lang=pl` lub filtrowanie klienckie.
- Wpisz frazę nieistniejącą (np. „xxxxxxxxxx") → pusty stan „Brak narzędzi" lub odpowiednik, brak crasha.
- Wyczyść pole → pełna lista powraca.
- **i18n:** przełącz język na EN → pole wyszukiwania z angielskim placeholder, wyniki w EN.

### 1.6 Podgląd detalu narzędzia (KnownToolDetailView)

Dla co najmniej 3 narzędzi SHIP przetestuj panel podglądu:
- Klik na kartę narzędzia → otwiera `KnownToolDetailView` / `KnownToolPreviewV3` z detalami.
- Network: `GET /api/known-tools/:toolType?lang=pl` → HTTP 200, odpowiedź zawiera `tool.whenToUse`, `tool.inputs`, `tool.steps`, `tool.outputs`, `tool.commonMistakes`, `tool.example`, `tool.nextSteps`.
- **Asercja pól:** sekcje „Kiedy używać", „Wejścia", „Kroki", „Wyjścia" widoczne i niepuste.
- Zamknięcie podglądu (X/klik poza) → powrót do listy bez crasha.

---

## F2 — LIBRARY: uruchamianie sesji narzędzia (governance AI runner)

### 2.1 Tworzenie nowej sesji

- Klik „Uruchom" na narzędziu SHIP → pojawia się modal/formularz tworzenia sesji (pole nazwy, opcjonalnie projekt).
- Wpisz nazwę, kliknij „Utwórz".
- **Network: `POST /api/tools`** → HTTP 200/201, payload `{ toolType: "<toolType>", name: "<nazwa>", projectId: null | "<id>" }`, odpowiedź `{ id, status }`.
- Po sukcesie: redirect lub otwarcie `ToolWorkspace` dla nowo utworzonej sesji.
- **[DB]** Sprawdź w bazie / przez `GET /api/tools/:toolId`, że sesja istnieje ze statusem `draft` lub `in_progress`.

### 2.2 Stepper i fazy (ToolCanvas / ToolWorkspace)

- Workspace wyświetla stepper z fazami/krokami dla danego narzędzia.
- Aktywny krok jest podświetlony, można przejść do następnego.
- **Asercja: brak stringa „Step content not implemented yet."** — smoke test `toolCanvas.smoke.test.tsx` pokrywa to, ale zrób też ręczne przejście po wszystkich krokach jednego SHIP narzędzia (sugerowane: `dynamic-swot`).
- Nawigacja wstecz/naprzód po krokach nie powoduje utraty danych wpisanych w poprzednim kroku.

### 2.3 Governance AI kart propozycji (ProposalCard)

Dla narzędzia z kartami AI (np. `dynamic-swot` po wygenerowaniu analizy SWOT):

- **Accept:** klik „Zaakceptuj" na karcie propozycji → karta zmienia status na `accepted` (nie `ai-proposed`/`rethinking`/`rejected`). Network: `PUT /api/tools/:toolId` z zaktualizowanym `proposalStatus`.
- **Reject:** klik „Odrzuć" → karta zmienia status na `rejected`, wizualnie wyszarzona.
- **Rethink:** klik „Przemyśl" → otwiera pole komentarza, po wpisaniu → karta zmienia status na `rethinking`. Network: `PUT /api/tools/:toolId`.
- **Licznik postępu:** po zaakceptowaniu N kart `countAiCardStatuses()` pokazuje poprawny podział `accepted/rejected/rethinking/ai-proposed`. Pasek postępu w `ToolActionBar` lub nagłówku aktualizuje się.
- **InlineAssist (Teresa w narzędziu):** otwiera panel asystenta AI per-krok; wyślij pytanie → otrzymaj odpowiedź (streaming); brak błędów konsoli.

### 2.4 Definition of Done narzędzia (DoD)

- Gdy wszystkie wymagane karty mają status `accepted` (zgodnie z logiką `getToolDoDCheck`) → przycisk „Poproś o review" staje się aktywny.
- **Brak DoD:** gdy brakuje wymaganych zaakceptowanych elementów → przycisk nieaktywny lub pokazuje listę braków (`gaps`). Sprawdź że gaps wyświetlają się jako czytelna lista.
- Network: `GET /api/tools/:toolId/dod-check` lub `GET /api/tools/:toolId/dod-status` → HTTP 200.

### 2.5 Żądanie review i workflow zatwierdzenia

- Klik „Poproś o review" (gdy DoD spełnione) → Network: `POST /api/tools/:toolId/request-review` (jeśli istnieje) lub zmiana statusu przez `PUT`. Status sesji zmienia się na `in_review` lub `awaiting_approval`.
- **Approve:** klik „Zatwierdź" (jako reviewer/owner) → Network: `POST /api/tools/:toolId/approve` → HTTP 200. Status sesji → `approved`.
- **Send back:** klik „Odeślij do draftu" → Network: `POST /api/tools/:toolId/send-back` → status → `draft`.
- **Promote to output:** po zatwierdzeniu klik „Zapisz do Outputs" → Network: `POST /api/tools/:toolId/promote` → HTTP 200. Sprawdź, że rekord pojawia się w `/api/tools/:toolId` z flagą outputu.
- **[DB]** Sprawdź kolumny `status`, `approved_at`, `promoted_at` w tabeli sesji narzędzi.

### 2.6 Lista sesji narzędzi

- Zakładka „Sesje" (lub lista na hubie) → Network: `GET /api/tools` → HTTP 200, lista z `status/progress/confidence`.
- Filtrowanie po statusie (draft/approved/in_review) — sprawdź, że filtr działa.
- Klik na sesję → otwiera `ToolWorkspace` lub `ToolDocumentView` dla tej sesji.
- Odśwież stronę przy otwartej liście — lista ponownie się ładuje, stan zachowany.

---

## F3 — 14 NARZĘDZI SHIP: happy paths

Dla każdego z 14 SHIP narzędzi wykonaj minimalny happy path: **uruchom sesję → przejdź przez krok 1 → sprawdź UI nie crashuje → potwierdź Network**. Poniżej kluczowe asercje per narzędzie.

### 3.1 Narzędzia STRATEGICZNE (5 z dedykowanymi fazami)

#### `dynamic-swot` — Dynamic SWOT Analysis
- Workspace: 4 fazy (InputExploration → Build → Correlations → Insights).
- Faza InputExploration: pola SWOT (Strengths/Weaknesses/Opportunities/Threats), dodaj co najmniej po 1 elemencie do każdego kwadranta.
- Faza Build: `SWOTBuildPhase` z kwadrantami — wizualizacja `SWOTMatrix` widoczna.
- Faza Correlations: `SWOTCorrelationsStep` — AI generuje korelacje; sprawdź karty propozycji (accept/reject).
- Faza Insights: podsumowanie AI.
- **Network:** co krok `PUT /api/tools/:toolId` z autosave lub explicite.

#### `market-forces` — Porter's Five Forces / Market Forces Analysis
- Workspace: `MarketForcesPhases` z krokami per siłę (ForceStep × 5 + podsumowanie).
- Każda siła (`Bargaining Power of Suppliers`, etc.) ma własny `ForceStep`.
- Wizualizacja: `PorterRadar` (radar chart) widoczny w fazie podsumowania.
- AI proposal karty dla każdej siły → governance.

#### `growth-paths` — Growth Paths
- Workspace: `GrowthPathsPhases` z `GrowthPathQuadrantStep`.
- Macierz wzrostu (opcje strategiczne) — wypełnij co najmniej 2 opcje.
- AI generuje propozycje rekomendowanych ścieżek.

#### `portfolio-priority` — Portfolio Priority
- Workspace: `PortfolioPriorityPhases` → `PortfolioItemsStep` + `PortfolioMatrixStep`.
- Dodaj co najmniej 2 projekty/inicjatywy do portfela.
- Macierz priorytetyzacji (np. Value vs Effort) — wizualizacja `PortfolioPriorityLibraryGraphic`.

#### `risk-uncertainty` — Risk & Uncertainty
- Workspace: `RiskUncertaintyPhases` → `AssumptionsStep` + `RisksStep` + `ScenariosStep`.
- Dodaj co najmniej 1 ryzyko z opisem i oceną prawdopodobieństwa/wpływu.
- `ScenariosStep` — AI generuje scenariusze; governance kart.

### 3.2 Narzędzia OPERACYJNE (5 z krokami domenowymi)

#### `sop-builder` — SOP Builder
- Kroki: `SOPChecklistsStep` + `SOPStandardsStep`.
- Dodaj co najmniej 2 checklisty z krokami.

#### `a3-problem-solving` — A3 Problem Solving
- Kroki: `A3ProblemStep` + `A3RootCauseStep` + `A3CountermeasuresStep`.
- Wypełnij opis problemu i co najmniej 1 przyczynę źródłową.

#### `smed-planner` — SMED Planner
- Kroki: `SMEDStepsStep` + `SMEDImprovementsStep`.
- Dodaj co najmniej 1 krok zmiany (setup step).

#### `dms-builder` — DMS Builder (Daily Management System)
- Kroki: `DMSKPIsStep` + `DMSEscalationStep`.
- Dodaj co najmniej 1 KPI z progiem.

#### `inventory-autopilot` — Inventory Autopilot
- Kroki: `InventoryClassificationStep` + `InventoryReplenishmentStep`.
- Dodaj co najmniej 2 produkty do klasyfikacji.

### 3.3 Narzędzia DIGITAL — 3 na GenericDomainStep

#### `ai-discovery`, `pain-explorer`, `rpa-scanner`
- Każde używa `GenericDomainStep` (formularz generyczny).
- UI: pole „Item title", przycisk „Dodaj", lista itemów.
- **Asercja:** przycisk „Dodaj" wyłączony dopóki pole puste; po wpisaniu tytułu — aktywny.
- Po dodaniu item: pojawia się na liście, InlineAssist sugeruje „Teresa...".
- Brak stringa „Step content not implemented yet." (smoke test: `genericDomainStep.smoke.test.tsx`).
- **[MANUAL]** Test PL: `isPolish=true` → etykiety po polsku (sprawdź wg testu jednostkowego).

### 3.4 Narzędzie PROCESS AUTOMATION

#### `process-automation` — Process Automation
- Workspace: `ProcessMapWorkSurface` (`src/components/DiscoveryTools/ProcessAutomation/`).
- Mapa procesów interaktywna — dodaj co najmniej 1 węzeł procesu.
- Automatyczny zapis — Network: `PUT /api/tools/:toolId`.

---

## F4 — MEGATRENDS WORKSPACE

### 4.1 Routing i dostęp

- Wejście na `/discovery-tools/strategic/megatrendy` → ładuje `MegatrendsWorkspace` z `source="tools"`.
- Alternatywne wejście z DiscoveryToolsHub zakładka Strategiczne → karta Megatrend Analysis → klik → redirect do `/discovery-tools/strategic/megatrendy`.
- **Gating:** `ProductionModuleGate moduleName="Tools"` — na dev (lokalnie) dostępne.

### 4.2 Załadowanie danych

- Network: `GET /api/megatrends/baseline` → HTTP 200 lub 503 (`type:'not_configured'`).
- **Scenariusz 503:** gdy MegatrendService niedostępny → UI wyświetla komunikat „Megatrends data is not yet configured for this environment." (lub polskie tłumaczenie), brak crasha.
- **Scenariusz 200:** lista trendów wyświetlona, podział na kategorie/sektory.
- Network: `GET /api/megatrends/radar` → HTTP 200 lub 503.

### 4.3 Radar trendów [MANUAL]

- (Gdy backend skonfigurowany) Radar chart widoczny z trendami na osiach.
- Hover na trend → tooltip ze szczegółami.
- Filtrowanie po branży (`?industry=manufacturing`) → Network: `GET /api/megatrends/baseline?industry=manufacturing`.

### 4.4 Detal trendu [MANUAL]

- Klik na trend → Network: `GET /api/megatrends/:id` → HTTP 200.
- Widok detalu: nazwa, opis, wpływ, przykłady.
- 404 dla nieistniejącego ID → graceful error.

### 4.5 Tworzenie custom trendu [FLAG]

- (Jeśli UI dostępne) formularz „Dodaj własny trend" → `POST /api/megatrends/custom` → HTTP 201.
- Brak `companyId` w tokenie → 401, komunikat błędu (nie crash).

---

## F5 — ASSESSMENT: hub i nawigacja

### 5.1 Wejście i routing

- Wejście na `/assessment` → ładuje `AssessmentHub`.
- `/assessment/overview`, `/assessment/drd`, `/assessment/siri`, `/assessment/adma`, `/assessment/cmmi`, `/assessment/lean` → wszystkie renderują `AssessmentHub` (backward compatibility).
- `/assessment/:framework/:assessmentId` → ładuje `AssessmentSessionEditorView`.
- Breadcrumbs: „Tools › Licensed".

### 5.2 Hub — 3 taby

- **Assessment:** lista assessmentów z lifecycle (`DRAFT/IN_REVIEW/AWAITING_APPROVAL/APPROVED`). Network: `GET /api/assessment-workflow-v2` → HTTP 200, lista z `assessment_type`, `status`, `completion_percent`, `confidence_avg`.
- **Reports:** zakładka raportów. Network: oddzielne żądanie (odnotuj endpoint).
- **Initiatives:** zakładka wygenerowanych inicjatyw z assessmentów.
- Przełączanie między tabami — brak crasha, odpowiednie żądania w Network.

### 5.3 Kolumna Framework w liście

- Każdy wiersz tabeli wyświetla `FRAMEWORK_META[row.framework]` — krótką nazwę (DRD/SIRI/ADMA/CMMI/LEAN) i kolor/ikonę.
- Dla nierozpoznanego frameworku: fallback na surową wartość `row.framework` (brak crasha).

---

## F6 — ASSESSMENT: tworzenie (5 frameworków)

### 6.1 Modal tworzenia assessmentu

- Klik „Nowy assessment" / „New Assessment" → otwiera `NewAssessmentModal` lub kreator.
- Formularz: pole nazwy + wybór frameworku (DRD / SIRI / ADMA / CMMI / LEAN).
- Po kliknięciu „Utwórz": Network: `POST /api/assessment-workflow-v2` z payload `{ name, assessment_type: "<FRAMEWORK>", ... }` → HTTP 201, odpowiedź `{ id, status }`.
- **Asercja:** redirect do nowo utworzonego assessmentu lub odświeżenie listy.

### 6.2 Framework DRD

- Utwórz assessment z `assessment_type='DRD'`.
- Otwórz edytor (`/assessment/drd/:assessmentId`) → ładuje `DRDAssessmentEditor` lub `DRDForm`.
- Network: `GET /api/assessment-workflow-v2/:assessmentId` → HTTP 200, `assessment_type='DRD'`.
- Edytor powinien pokazywać osie/obszary specyficzne dla DRD.
- **Asercja:** sekcje formularza widoczne i wypełnialne; brak crasha.
- Oceń co najmniej 1 obszar (wybierz poziom dojrzałości / wpisz ocenę).
- Network: `PUT /api/assessment-workflow-v2/:assessmentId` z zaktualizowanymi polami → HTTP 200.
- `completion_percent` w odpowiedzi > 0 po wypełnieniu pierwszego obszaru.

### 6.3 Framework SIRI

- Utwórz assessment z `assessment_type='SIRI'`.
- Edytor (`/assessment/siri/:assessmentId`) → ładuje `SIRIAssessmentEditor` lub `SIRIForm`.
- Mapa SIRI (`SIRIAssessmentMap`) widoczna jako nawigacja po wymiarach.
- Wypełnij co najmniej 1 wymiar SIRI.
- Network: `PUT /api/assessment-workflow-v2/:assessmentId` → HTTP 200.

### 6.4 Framework ADMA

- Utwórz assessment z `assessment_type='ADMA'`.
- Edytor → `ADMAAssessmentEditor` / `ADMAForm`.
- Mapa ADMA (`ADMAAssessmentMap`) widoczna.
- Wypełnij co najmniej 1 obszar.

### 6.5 Framework CMMI

- Utwórz assessment z `assessment_type='CMMI'`.
- Edytor → `CMPracticeForm` / dedykowany widok CMMI.
- Mapa praktyk CMMI (`CMPracticeMap`) widoczna.
- Wypełnij co najmniej 1 obszar praktyk.

### 6.6 Framework LEAN (DBR77 Lean)

- Utwórz assessment z `assessment_type='LEAN'`.
- Edytor → `LeanForm` / `RapidLeanWorkspace` / `DBR77LeanMap`.
- Wypełnij co najmniej 1 obserwację.
- `RapidLeanObservationForm` — jeśli dostępny — dodaj 1 obserwację gemba.

---

## F7 — ASSESSMENT: lifecycle sesji i scoring

### 7.1 Otwieranie / zamykanie sesji edycji (lock)

- Po wejściu do edytora: Network: `POST /api/assessment-workflow-v2/:assessmentId/session/open` → HTTP 200.
- Wyjście z edytora (powrót do listy): Network: `POST /api/assessment-workflow-v2/:assessmentId/session/close` → HTTP 200.
- **Concurrent lock [MANUAL]:** otwórz ten sam assessment w 2 zakładkach → drugi użytkownik powinien zobaczyć `LockedFrameworkOverlay` lub informację o blokadzie (`AssessmentStageGate`).

### 7.2 Scoring i completion_percent

- Oceń kilka obszarów / pytań → odśwież stronę → sprawdź, że oceny przetrwały.
- **[DB]** `GET /api/assessment-workflow-v2/:assessmentId` → `completion_percent` > 0, `answers_json` niepuste.
- `confidence_avg` obliczany poprawnie (avg z wypełnionych ocen).
- Pasek `completion_percent` w liście assessmentów aktualizuje się po każdym zapisie.

### 7.3 Komentarze i aktywność

- Panel komentarzy (`CommentsSidePanel`) / `AxisCommentsPanel` — dodaj komentarz do obszaru.
- Network: żądanie zapisu komentarza.
- `ActivityLogPanel` — log wyświetla historię zmian (kto, kiedy, co).

### 7.4 Zarządzanie zespołem (TeamManagementPanel)

- Zakładka „Team" / manage panel → `TeamManagementPanel`.
- Dodaj użytkownika z rolą (viewer/editor/approver) → Network: `POST /api/assessment-workflow-v2/:assessmentId/roles`.
- **Permissions check:** użytkownik bez roli próbuje edytować → `useAssessmentPermissions` blokuje, pojawia się `RequestAccessModal` lub komunikat.

---

## F8 — ASSESSMENT: raporty

### 8.1 Generacja raportu

- Status assessmentu musi być co najmniej `DRAFT` (lub wymagany przez logikę poziom — sprawdź `ContextReadinessGate`).
- Klik „Generuj raport" → Network: `POST /api/assessment-workflow-v2/:assessmentId/report` z opcjonalnym `{ includeRecommendations: true, includeGapAnalysis: true }` → HTTP 200/202.
- Raport pojawia się w zakładce Reports.
- **Wersje raportów:** `GET /api/assessment-workflow-v2/:assessmentId/report/versions` → lista wersji.

### 8.2 Szablony raportów per framework

- Modal wyboru szablonu (`ReportTemplatePickerModal` / `NewReportModal`) — każdy framework ma dedykowany template:
  - DRD → `DBR77ReportTemplate`
  - SIRI → `SIRIReportTemplate`
  - ADMA → `ADMAReportTemplate`
  - CMMI → `CMMIReportTemplate`
  - LEAN → brak dedykowanego (generic lub RapidLean)
- Wybór szablonu → raport renderuje się wg właściwego komponentu template.

### 8.3 Zatwierdzenie raportu

- Klik „Zatwierdź raport" → Network: `POST /api/assessment-workflow-v2/:assessmentId/report/approve` → HTTP 200.
- Status raportu → `APPROVED` / `FINAL`.
- **Asercja:** po zatwierdzeniu raportu ikona/chip statusu w liście assessmentów zmienia się.

### 8.4 Import zewnętrznego raportu (PDF)

- Klik „Importuj raport" → `PDFImportWizard`.
- [MANUAL] Wgraj plik PDF → wizard przetwarza (parsuje).
- Zaimportowany raport pojawia się w liście (`ImportedReportDetailView`).
- Jeśli AI parsowanie niedostępne → graceful error, brak crasha.

### 8.5 Wizualizacje w raporcie

- `AssessmentReportVisualizations` — sprawdź, że:
  - Wykresy radarowe (`BenchmarkComparison`, `AssessmentTrendsChart`) renderują się bez błędów JS.
  - `GapAnalysisDashboard` — gap per obszar obliczony (target vs actual).
  - `MultiFwBenchmarkComparison` — jeśli dostępne dane benchmarku.

---

## F9 — ASSESSMENT: workflow zatwierdzania

### 9.1 Pełny lifecycle: DRAFT → IN_REVIEW → AWAITING_APPROVAL → APPROVED

1. **DRAFT:** assessment po utworzeniu.
2. **Żądanie recenzji:** klik „Poproś o review" → Network: `POST /api/assessment-workflow-v2/:assessmentId/request-review` → HTTP 200. Status → `IN_REVIEW`. `WorkflowStatusBar` aktualizuje się.
3. **Approve (reviewer):** Network: `POST /api/assessment-workflow-v2/:assessmentId/approve` → HTTP 200. Status → `AWAITING_APPROVAL` lub `APPROVED`.
4. **Send back:** Network: `POST /api/assessment-workflow-v2/:assessmentId/send-back` → HTTP 200. Status → `DRAFT`. Pole `send_back_reason` w payloadzie.
5. **[DB]** Sprawdź kolumny `status`, `approved_at`, `completion_percent` w bazie.

### 9.2 Stage gate (StageGateModal)

- `AssessmentStageGate` / `StageGateModal` — walidacja warunków przejścia do kolejnego stanu.
- Próba zatwierdzenia gdy `completion_percent < 100%` → komunikat o brakujących obszarach.
- `SubmitForReviewModal` — opcjonalny komentarz do recenzji.

### 9.3 Zarządzanie assessment (AssessmentManagePanel)

- Panel manage: edycja nazwy, duplikacja, usunięcie.
- **Duplikacja:** `POST /api/assessment-workflow-v2/:assessmentId/duplicate` → HTTP 200/201. Nowy assessment pojawia się na liście.
- **Usunięcie:** `DELETE /api/assessment-workflow-v2/:assessmentId` → HTTP 200/204. Assessment znika z listy; odśwież — nadal zniknięty.
- **Historia wersji:** `AssessmentVersionHistory` / `VersionHistoryPanel` — lista zmian.

---

## F10 — ASSESSMENT: inicjatywy z assessmentu [FLAG]

### 10.1 Flaga assessmentInitiativesWizard = false (default)

- Wejdź do `AssessmentHub` i `InitiativesManagementPanel`.
- **Asercja krytyczna:** przycisk „Generuj inicjatywy" / „Generate initiatives" jest NIEWIDOCZNY lub WYŁĄCZONY (`wizardEnabled = false` → `null` render lub `disabled`).
- UI **NIE CRASHUJE** — żaden wyjątek JS w konsoli.
- Zakładka Initiatives w hubie dalej się ładuje (lista inicjatyw może być pusta).
- `GET /api/assessment-workflow-v2/:assessmentId/generated-initiatives` → HTTP 200, pusta lista lub dane z poprzednich sesji.

### 10.2 Flaga assessmentInitiativesWizard = true [FLAG — włącz manualnie]

Aby przetestować: w DevTools Console wpisz override lub zmień `defaultValue` na `true` w `useFeatureFlags.tsx` lokalnie.

- Przycisk „Generuj inicjatywy" widoczny i aktywny (gdy assessment `APPROVED`).
- Klik → otwiera `InitiativesGenerationWizardModal`.
- Network: `POST /api/assessment-workflow-v2/:assessmentId/generate-initiatives` → HTTP 200/202.
- Wygenerowane inicjatywy pojawiają się w zakładce Initiatives.
- `GET /api/assessment-workflow-v2/:assessmentId/generated-initiatives` → lista z tytułami inicjatyw.

---

## F11 — ŚCIEŻKI CROSS-MODULE

### 11.1 Narzędzia → Inicjatywy (GenerateInitiativesModal w Library)

- Po sesji SHIP narzędzia ze statusem `approved`: klik „Generuj inicjatywy" w `ToolWorkspace`.
- Otwiera `GenerateInitiativesModal`.
- Network: `POST /api/tools/:toolId/generate-initiatives` → HTTP 200.
- `GET /api/tools/:toolId/generated-initiatives` → lista propozycji inicjatyw.
- Klik „Przejdź do Inicjatyw" → SPA-nawigacja do `/initiatives`, brak twardego reload.
- **Asercja:** inicjatywy widoczne w M13 Inicjatywy z referencją do sesji narzędzia.

### 11.2 Assessment → Inicjatywy (cross-module, gdy flaga ON)

- [FLAG ON] Wygenerowane inicjatywy z assessmentu → widoczne w `/initiatives` z oznaczeniem źródła `assessment`.
- Klik inicjatywy w liście → otwiera detal inicjatywy w M13 z powiązaniem do assessmentu.

### 11.3 Narzędzia → Canvas (eksport wyników)

- Po zatwierdzeniu sesji narzędzia: sprawdź, czy `promoteToOutput` (`POST /api/tools/:toolId/promote`) powoduje pojawienie się outputu w M17 Outputs lub dostępnego w Canvas jako artefakt.
- Otwórz Canvas (`/chat` split-view) → sprawdź, czy można odwołać się do wyjścia narzędzia.

### 11.4 Assessment → Wywiad (połączenie)

- Z panelu Insights wywiadu (M10): opcja eksportu wniosków do Assessment (jeśli istnieje button „Send to Assessment") → sprawdź, że naviguje do `/assessment` bez crasha.
- Odwrotnie: z raportu assessmentowego → link do powiązanego wywiadu (jeśli dostępny).

---

## F12 — TESTY PRZEKROJOWE

### 12.1 Gating na public prod [MANUAL]

- [MANUAL na staging Railway caboose] Zaloguj się jako użytkownik bez dostępu do modułów premium.
- Wejście na `/discovery-tools` → wyświetla `PublicProductionModuleDisabled` z nazwą „Tools", NIE treść biblioteki.
- Wejście na `/assessment` → analogiczny komunikat.
- Sprawdź że komunikat jest po polsku (i18n) oraz nie wychodzi poza viewport (responsywność).

### 12.2 i18n PL / EN

- Przełącz język na EN → wszystkie etykiety w DiscoveryToolsHub, AssessmentHub, krokach narzędzi, modalach, toastach → po angielsku.
- Przełącz na PL → po polsku. API: `getKnownTools({ lang: 'pl' })` vs `lang: 'en'` — nazwa i opis narzędzia zmieniają się.
- Brak surowych kluczy i18n (`"translation_key.foo"`) widocznych w UI.
- Sprawdź toast „Tool approved" — czy jest przetłumaczony (kod: `toast.success(isPolish ? '...' : 'Tool approved')`).

### 12.3 Dark mode [MANUAL]

- Przełącz na dark mode.
- `DiscoveryToolsHub`: karty narzędzi, filtry kategorii, podgląd narzędzia — czytelność tekstu, kontrast tła.
- `ToolWorkspace`: stepper, karty propozycji (accept/reject/rethink), pasek akcji.
- `AssessmentHub`: tabela assessmentów, edytor framework, raporty.
- Megatrends workspace: radar chart widoczny.
- Żadne elementy UI nie są nieczytelne (biały tekst na białym tle, itp.).

### 12.4 Responsywność i z-index [MANUAL]

- Zwęź okno do ~768px (tablet) i ~375px (mobile).
- `DiscoveryToolsHub`: karty narzędzi układają się kolumnowo, filtry/zakładki nie wychodzą poza ekran.
- `AssessmentHub`: tabela zwija się lub scrolluje poziomo, breadcrumbs nie pękają.
- Modalne (NewAssessmentModal, GenerateInitiativesModal) są scrollowalne przy małym viewport.
- `ToolWorkspace` stepper — kroki nie wypadają poza ekran.

### 12.5 A11y (dostępność)

- `role="table"` / `role="row"` / `role="columnheader"` w tabelach assessmentów i sesji narzędzi.
- Przyciski „Zaakceptuj / Odrzuć / Przemyśl" mają `aria-label` lub sensowny tekst.
- Focusowalność: Tab po liście narzędzi, Enter na karcie → otwiera podgląd.
- Esc zamyka modalne (NewAssessment, GenerateInitiatives, ReportTemplatePicker).
- Filtry kategorii / zakładki hubu — dostępne klawiaturą.

### 12.6 Brak błędów konsoli

- Podczas całej sesji testowej (przeglądanie biblioteki, uruchamianie sesji, ocena assessmentu, generacja raportu) → Console = 0 wyjątków JS, 0 błędów React.
- Dozwolone: ostrzeżenia niekrytyczne (np. deprecation) — zanotuj.
- **Szczególna uwaga:** `LockedFrameworkOverlay`, `ContextReadinessGate` — sprawdź, że nie wyrzucają błędów przy poprawnych danych.

### 12.7 Obsługa błędów sieciowych

- Wyłącz serwer (lub symuluj 500) w trakcie ładowania listy assessmentów → UI pokazuje komunikat błędu, brak białej strony.
- Anuluj żądanie `POST /api/tools` w połowie → toast błędu, formularz powraca do stanu sprzed.
- Symuluj timeout (Network throttle: Offline) podczas kroku narzędzia → stan lokalny zachowany, po powrocie sieci zapis działa.

---

## F13 — TESTY REGRESJI I JEDNOSTKOWE

### 13.1 Smoke tests do uruchomienia

```bash
# Z katalogu głównego projektu:
npx vitest run src/components/DiscoveryTools/__tests__/genericDomainStep.smoke.test.tsx
npx vitest run src/components/DiscoveryTools/__tests__/toolCanvas.smoke.test.tsx
npx vitest run src/components/assessment/__tests__/assessmentItemPreview.smoke.test.tsx
```

Oczekiwany wynik: wszystkie testy PASS. Szczególnie:
- `toolCanvas.smoke.test.tsx`: żaden SHIP digital trio (`ai-discovery/pain-explorer/rpa-scanner`) nie renderuje stringa `"Step content not implemented yet."`.
- `genericDomainStep.smoke.test.tsx`: przycisk „Add" disabled przy pustym polu, aktywny po wpisaniu.
- `assessmentItemPreview.smoke.test.tsx`: gap obliczony, `onOpen` wołany.

### 13.2 Pokrycie testowe — luki do odnotowania

Sprawdź czy istnieją testy dla:
- `KnownToolsService.ts` — logika `WAVE1_SHIP_SET` (czy `isComingSoon` przypisane poprawnie).
- `aiCardGovernance.ts` — `countAiCardStatuses`, `getAiReviewTotal`.
- `toolCompletion.ts` — logika DoD per narzędzie.

Jeśli brak → odnotuj w raporcie jako dług testowy (NIE twórz teraz — poza zakresem tej paczki).

### 13.3 Regresja: coming-soon blokada

- Wybierz dowolne z 17 coming-soon narzędzi (np. `corporate-strategy`, `scenario-planning`).
- Klik przycisku uruchomienia → żadne żądanie `POST /api/tools` NIE leci do Network.
- Brak nawigacji do ToolWorkspace.
- Toast info „Coming soon" lub przycisk po prostu disabled — odnotuj zachowanie.

---

## Format raportu z testów

Dla każdego punktu testowego podaj:

```
**Test:** [numer z tej specyfikacji, np. F2.3]
**Kroki:** [co zrobiono]
**Oczekiwane:** [co powinno się stać]
**Faktyczne:** [co się stało]
**Status:** PASS | FAIL | SKIP (z powodem)
**Dowód:** screenshot UI + payload z Network (URL, metoda, status HTTP, kluczowe pola body/response) [+ wiersz DB jeśli [DB]]
**Przy FAIL:** plik:linia, opis przyczyny, propozycja fixu
```

---

## Definition of Done (DoD) tej paczki testowej

- [ ] Wszystkie F1–F12 punkty mają status PASS lub uzasadniony SKIP.
- [ ] 14 SHIP narzędzi: każde uruchomione i przeszło co najmniej krok 1 bez crasha.
- [ ] 17 coming-soon narzędzi: żadne nie tworzy sesji po kliknięciu.
- [ ] 5 frameworków Assessment: każdy ma utworzony assessment, wypełniony co najmniej 1 obszar, wygenerowany raport.
- [ ] Flaga `assessmentInitiativesWizard=false`: brak crasha, przycisk ukryty/wyłączony.
- [ ] Smoke testy: `genericDomainStep`, `toolCanvas`, `assessmentItemPreview` = PASS.
- [ ] Sieć E2E potwierdzona: `POST /api/tools` (sesja), `PUT /api/tools/:toolId` (zapis), `POST /api/assessment-workflow-v2` (assessment), `POST /api/assessment-workflow-v2/:id/report` (raport), `POST /api/assessment-workflow-v2/:id/approve` (zatwierdzenie).
- [ ] Zero błędów JS w konsoli przez całą sesję.
- [ ] i18n PL + EN: wszystkie etykiety przetłumaczone.
- [ ] Dark mode: czytelność potwierdzona w obu modułach.
