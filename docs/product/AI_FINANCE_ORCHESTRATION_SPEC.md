# AI Finance Orchestration Specification — SSOT

> **Status:** v1.0 — Professional-Grade Specification  
> **Benchmark:** Deloitte Agentic Audit · PwC AI Audit Automation · Bloomberg Intelligence  
> **Cel:** Specyfikacja roli AI Chat jako **aktywnego orkiestratora** pracy analitycznej w module Finance — nie komentator, lecz analityk finansowy zarządzający procesem.  
> **Powiązane SSOT:**  
> - Financial Analysis: `docs/product/FINANCIAL_ANALYSIS_V3.md`  
> - Agent Audit Layer: `docs/modules/ai/AGENT_AUDIT_LAYER.md`  
> - AI Functional Audit: `docs/ai-audit/04_FUNCTIONAL_AUDIT.md`  
> - Context Pack Builder: `server/src/services/contextPackBuilder.ts`  
> - AI Persona: `server/src/ai/persona.ts`

---

## 1) Zasada fundamentalna

**AI Chat w module Finance to nie chatbot. To Financial Analyst-in-the-Loop** — aktywny agent, który:

| Wymiar | Pasywny komentator (❌ NIE TAK) | Aktywny orkiestrator (✅ TAK) |
|--------|--------------------------------|------------------------------|
| Inicjatywa | Czeka na pytanie | Proponuje kolejne kroki |
| Obliczenia | Komentuje wyniki | Uruchamia silnik obliczeniowy |
| Walidacja | Opisuje problemy | Blokuje niekompletne artefakty |
| Workflow | Informuje o statusie | Zarządza przejściami statusów |
| Raportowanie | Generuje tekst | Generuje narratywę z cytowaniami do danych |
| Decyzje | Podejmuje za usera | Proponuje → czeka na Confirm/Reject |

---

## 2) Architektura AI Finance Agent

### 2.1 Kontekst (Context Injection)

Gdy user jest w module Finance, AI Chat otrzymuje **pełny kontekst finansowy**:

```typescript
interface FinanceContext {
  // Lokalizacja użytkownika
  activeTab: 'statements' | 'models' | 'analysis' | 'prediction' | 'valuation' | 'investment';
  activeArtifactId?: string;
  activeArtifactType?: 'statement_pack' | 'financial_model' | 'analysis_run' | 'scenario' | 'valuation' | 'investment_case';

  // Dane modelu (jeśli otwarty)
  model?: {
    id: string;
    status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'LOCKED';
    version: number;
    periods: { historical: string[]; forecast: string[] };
    statements: {
      pnl: StatementSummary;
      bs: StatementSummary;
      cf: StatementSummary;
    };
    drivers: DriverSummary[];
    validation: { balanceCheck: boolean; cfTieOut: boolean; warnings: string[] };
    keyMetrics: {
      revenue: number; revenueGrowth: number;
      grossMargin: number; operatingMargin: number; netMargin: number;
      roe: number; roic: number;
      netDebtEbitda: number; interestCoverage: number;
      fcf: number; fcfYield: number;
    };
  };

  // Scenariusze (jeśli w predykcji)
  scenarios?: ScenarioSummary[];

  // Wycena (jeśli otwarta)
  valuation?: {
    method: 'DCF' | 'Comps' | 'Blended';
    ev: number; equityValue: number;
    wacc: number; terminalGrowth: number;
    sensitivity: SensitivityMatrix;
  };

  // Statements (zawsze dostępne)
  statementPacks: PackSummary[];
  readyStatements: number;
  totalStatements: number;

  // Market assumptions
  marketAssumptions: {
    riskFreeRate: number;
    beta: number;
    erp: number;
    marketCap?: number;
    perpetualGrowth: number;
  };
}
```

### 2.2 Finance Tools (AI-callable operations)

AI Chat ma dostęp do **zestawu narzędzi finansowych** — operacji, które może wywołać na polecenie użytkownika:

#### Tier 1: Read-only (AI może uruchomić bez potwierdzenia)

| Tool | Opis | Input | Output |
|------|------|-------|--------|
| `computeRatios` | Oblicz wskaźniki dla statement/modelu | statementId, periods | 42 ratios + composites |
| `computeGrowthRatios` | Oblicz wskaźniki wzrostu | statementId1, statementId2 | 8 growth ratios |
| `runVerticalAnalysis` | Analiza pionowa (common-size) | modelId, period | P&L/BS as % |
| `runHorizontalAnalysis` | Analiza pozioma (trend) | modelId, periods | YoY changes, CAGR |
| `runDuPontDecomposition` | Dekompozycja ROE (5-factor) | modelId, periods | 5 factors + waterfall |
| `computeAltmanZ` | Altman Z-Score | modelId, variant | Score + zone + interpretation |
| `computePiotroskiF` | Piotroski F-Score | modelId | 9 signals + score |
| `computeSGR` | Sustainable Growth Rate | modelId | SGR value |
| `computeUFCF` | Unlevered Free Cash Flow | modelId, periods | UFCF per period |
| `computeWACC` | WACC calculation | marketAssumptions, modelId | WACC + components |
| `runSensitivity` | Sensitivity matrix | valuationId, param1Range, param2Range | 2D matrix |
| `compareScenarios` | Porównanie scenariuszy | scenarioIds | Comparison table |
| `explainValue` | Lineage wartości | modelId, lineCode, period | Source → mapping → driver → value |
| `getModelHealth` | Health check modelu | modelId | Balance check, CF tie-out, warnings |
| `getCreditAssessment` | Ocena kredytowa | modelId | Z-Score, DSCR, ND/EBITDA, rating proxy |

#### Tier 2: Write (AI proponuje → user Confirm/Reject)

| Tool | Opis | Input | Output | Wymaga Confirm |
|------|------|-------|--------|----------------|
| `createModel` | Utwórz model z ready statements | statementPackId, params | FinancialModel (DRAFT) | ✅ |
| `updateDriver` | Zmień driver modelu | modelId, driverCode, newValue | Updated model + impact analysis | ✅ |
| `overrideValue` | Manual override wartości | modelId, lineCode, period, value | Updated model + audit entry | ✅ |
| `createScenario` | Utwórz scenariusz | modelId, assumptions | FinancialScenario (DRAFT) | ✅ |
| `confirmScenario` | Zatwierdź scenariusz | scenarioId | Status → CONFIRMED | ✅ |
| `createValuation` | Utwórz wycenę DCF | modelId, params | Valuation (DRAFT) | ✅ |
| `addComps` | Dodaj comparable companies | valuationId, peers | Updated comps table | ✅ |
| `createInvestmentCase` | Utwórz analizę inwestycyjną | initiativeId, params | InvestmentCase (DRAFT) | ✅ |
| `saveAnalysis` | Zapisz analizę jako snapshot | analysisParams | FinancialAnalysisRun | ✅ |
| `generateNarrative` | Generuj narratywę analityczną | analysisRunId, sections | Narrative text with citations | ✅ (review) |

### 2.3 Numerical Anchor Principle (MUST)

**Najważniejsza zasada systemu:**

```
AI NIGDY nie generuje wartości numerycznych z LLM.
Każda liczba w odpowiedzi AI pochodzi z silnika obliczeniowego.
```

**Implementacja:**

1. AI wywołuje tool (np. `computeRatios`) → otrzymuje structured JSON z wartościami
2. AI generuje narratywę, wstawiając wartości z JSON (nie z "wiedzy" LLM)
3. Każda wartość w tekście ma `ref` do pola w JSON response
4. Frontend renderuje wartości z inline citation: "Gross margin **34.2%** [P&L 2024, line gross_profit/revenue]"

**Walidacja:**
- Backend sprawdza, czy wartości w AI narrative odpowiadają computed values
- Jeśli rozbieżność > 0.1% → warning + auto-correction
- Audit log: `{ type: 'numerical_anchor_check', passed: true/false, discrepancies: [] }`

### 2.4 Proposal → Confirm Pattern (MUST)

Każda operacja write AI przechodzi przez pattern:

```
1. User request (text) → AI
2. AI analyzes context + calls read tools
3. AI generates PROPOSAL:
   - What will be created/changed
   - Parameters and assumptions
   - Expected impact (if applicable)
   - Risks/warnings (if any)
4. UI renders ProposalCard:
   ┌─────────────────────────────────────┐
   │ 📊 AI Proposal: Create DCF Valuation │
   │                                       │
   │ Method: DCF (UFCF + WACC)            │
   │ Horizon: 5 years                      │
   │ WACC: 8.2% (computed)                │
   │ Terminal growth: 2.0%                 │
   │ Expected EV: ~118M                    │
   │                                       │
   │ ⚠️ Beta = 1.0 (default). Consider    │
   │    industry-specific beta.            │
   │                                       │
   │ [✅ Confirm] [✏️ Refine] [❌ Reject]  │
   └─────────────────────────────────────┘
5. User: Confirm → AI executes
         Refine → AI asks follow-up questions
         Reject → AI acknowledges, suggests alternative
```

---

## 3) AI Workflow Orchestration

### 3.1 Proactive Guidance (AI inicjuje)

AI nie czeka na pytania — **proaktywnie sugeruje** kolejne kroki:

**Po imporcie statements:**
```
AI: "Zaimportowano 3 sprawozdania (P&L, BS, CF) za 2023-2024. 
     Wszystkie mają status 'ready'. 
     
     Sugeruję następne kroki:
     1. 📊 Zbuduj model finansowy (zero-change baseline)
     2. 📈 Uruchom analizę wskaźnikową (42 ratios + composites)
     3. 🔍 Sprawdź health check (balance, CF tie-out)
     
     Który krok chcesz wykonać?"
```

**Po zbudowaniu modelu:**
```
AI: "Model 'Tesla 2024' zbudowany (DRAFT). Health check:
     ✅ Pętla P&L→CF→BS zamknięta
     ✅ Balance check: Assets = L+E (ok)
     ⚠️ Gross margin (17.4%) poniżej mediany branżowej (25%)
     ⚠️ Brak danych CAPEX growth — przyjęto historyczną intensywność
     
     Sugeruję:
     1. 📊 Uruchom pełną analizę finansową
     2. 🔮 Stwórz scenariusz (co jeśli margin wróci do 25%?)
     3. 💰 Przejdź do wyceny DCF
     
     Co dalej?"
```

**Po analizie:**
```
AI: "Analiza wskaźnikowa ukończona. Kluczowe findings:
     🔴 Altman Z-Score = 2.1 (Grey Zone — elevated risk)
     🟡 Net Debt/EBITDA = 3.8x (above comfort zone 3.0x)
     🟢 Piotroski F-Score = 7/9 (Strong)
     🟢 Cash Conversion: OCF/NI = 1.4x (excellent quality)
     
     Sugeruję:
     1. 📝 Zapisz tę analizę (snapshot)
     2. 🔍 Deep dive: dlaczego Z-Score w grey zone?
     3. 📊 DuPont decomposition — co napędza ROE?
     4. 📄 Przygotuj raport dla zarządu
     
     Co chcesz zbadać?"
```

### 3.2 Guided Workflows (AI prowadzi proces)

**Workflow: "Pełna analiza firmy" (end-to-end)**

```
Step 1: Data Quality
  AI: "Sprawdzam dostępne dane..."
  AI: "Masz 2 lata historii (2023-2024), P&L+BS+CF. Wystarczające do pełnej analizy."

Step 2: Model Build
  AI: "Buduję model zero-change baseline..."
  AI: [Proposal: Model parameters] → User: Confirm
  AI: "Model zbudowany. Health check: ✅ all pass."

Step 3: Ratio Analysis
  AI: "Uruchamiam analizę wskaźnikową..."
  AI: [Results: 42 ratios + composites + narrative]

Step 4: Trend Analysis
  AI: "Analizuję trendy 2023→2024..."
  AI: [Results: horizontal analysis + key changes]

Step 5: Credit Assessment
  AI: "Oceniam zdolność kredytową..."
  AI: [Results: Altman Z + DSCR + ND/EBITDA + rating proxy]

Step 6: Valuation
  AI: "Przechodzę do wyceny. Potrzebuję Market Assumptions."
  AI: [Asks: Risk-Free Rate, Beta, ERP]
  User: [Provides or accepts defaults]
  AI: [Proposal: DCF parameters] → User: Confirm
  AI: [Results: EV, Equity Value, sensitivity, football field]

Step 7: Report
  AI: "Analiza kompletna. Generuję raport..."
  AI: [Proposal: Report structure] → User: Confirm
  AI: [Generated: Full financial analysis report with citations]
```

**Workflow: "Stress test"**

```
AI: "Jaki scenariusz stresu chcesz przetestować?"
User: "Spadek przychodów o 20%, wzrost kosztów o 10%"
AI: "Tworzę scenariusz stress test..."
AI: [Proposal: Assumptions] → User: Confirm
AI: "Wyniki stress testu:
     📉 Revenue: 100M → 80M
     📉 Net Income: 8M → -2M (strata)
     📉 Cash: 15M → -3M w Q3 2027 (liquidity crisis)
     📉 ND/EBITDA: 2.1x → 8.5x (covenant breach)
     
     🚨 Firma traci płynność w Q3 2027.
     Rekomendacja: linia kredytowa min 8M jako buffer.
     
     Chcesz:
     1. Zobaczyć szczegóły (P&L/BS/CF per miesiąc)?
     2. Przetestować łagodniejszy scenariusz?
     3. Sprawdzić break-even point (przy jakim spadku firma jeszcze przeżyje)?"
```

### 3.3 Context-Aware Responses

AI dostosowuje odpowiedzi do **kontekstu zakładki**:

| Zakładka | AI persona | Priorytet |
|----------|-----------|-----------|
| Statements | Data Quality Analyst | Mapping accuracy, completeness, readiness |
| Modele | Financial Modeler | 3-statement linkage, drivers, balance check |
| Analiza | Equity Research Analyst | Ratios, trends, composites, narrative |
| Predykcja | FP&A Analyst | Assumptions, scenarios, sensitivity, feasibility |
| Wycena | Valuation Analyst | DCF, comps, sensitivity, fair value range |
| Analiza inwestycyjna | Corporate Finance Analyst | NPV, IRR, ROI, business case |

### 3.4 Error Handling i Guardrails

**AI nie może:**
- Generować wartości numerycznych z LLM (numerical anchor)
- Zatwierdzać artefaktów bez user Confirm
- Dawać rekomendacji "buy/sell/hold"
- Dawać porad prawnych lub podatkowych
- Ignorować quality gates (np. tworzyć wycenę bez modelu)
- Modyfikować LOCKED artefaktów

**AI musi:**
- Cytować źródło każdej wartości
- Flagować anomalie i niespójności
- Blokować niekompletne operacje (np. scenariusz bez CAPEX)
- Informować o ograniczeniach danych
- Zachować audit trail każdej operacji

**Guardrails (compliance):**
```
IF ai_response contains numerical value:
  ASSERT value exists in computed_results
  ASSERT value matches computed_results[ref] within ε=0.01
  IF NOT → auto-correct + log discrepancy

IF ai_proposes write operation:
  ASSERT user_confirmed == true before execution
  IF NOT → block + show ProposalCard

IF ai_generates narrative:
  ASSERT every claim has data_reference
  ASSERT no investment advice language
  ASSERT no legal/tax advice language
```

---

## 4) AI Finance Intents (rozszerzenie intent detection)

### 4.1 Financial Intent Detector

Rozszerzenie istniejącego `tableIntentDetector.ts` o finance-specific intents:

```typescript
type FinanceIntent =
  | 'build_model'          // "zbuduj model", "create financial model"
  | 'run_analysis'         // "przeanalizuj", "analiza wskaźnikowa"
  | 'run_ratios'           // "oblicz wskaźniki", "compute ratios"
  | 'run_dupont'           // "rozłóż ROE", "DuPont analysis"
  | 'run_altman'           // "Altman Z-Score", "bankruptcy risk"
  | 'run_piotroski'        // "Piotroski F-Score", "quality of earnings"
  | 'create_scenario'      // "stwórz scenariusz", "co jeśli"
  | 'stress_test'          // "stress test", "worst case"
  | 'compare_scenarios'    // "porównaj scenariusze"
  | 'run_dcf'              // "wycenij", "DCF", "ile warta firma"
  | 'run_comps'            // "comparable companies", "multiples"
  | 'sensitivity'          // "sensitivity", "wrażliwość"
  | 'investment_analysis'  // "NPV", "IRR", "opłacalność"
  | 'explain_value'        // "skąd ta wartość", "explain"
  | 'model_health'         // "sprawdź model", "health check"
  | 'generate_report'      // "przygotuj raport", "generate report"
  | 'save_analysis'        // "zapisz analizę", "save"
  | 'next_steps'           // "co dalej", "what next"
  | 'general_finance';     // fallback for finance-related questions

// PL patterns
const PL_PATTERNS: Record<FinanceIntent, RegExp[]> = {
  build_model: [/zbuduj model/i, /stwórz model/i, /nowy model/i, /model finansowy/i],
  run_analysis: [/przeanalizuj/i, /analiza finansowa/i, /zbadaj/i, /diagnoza/i],
  run_ratios: [/wskaźniki/i, /ratios/i, /płynność/i, /rentowność/i, /zadłużeni/i],
  run_dupont: [/dupont/i, /rozłóż roe/i, /dekompozycja/i],
  run_altman: [/altman/i, /z-score/i, /bankructw/i, /upadłoś/i],
  run_piotroski: [/piotroski/i, /f-score/i, /jakość zysk/i],
  create_scenario: [/scenariusz/i, /co jeśli/i, /co gdyby/i, /prognoz/i, /predykcj/i],
  stress_test: [/stress test/i, /najgorszy/i, /worst case/i, /kryzys/i],
  compare_scenarios: [/porównaj scenariusz/i, /zestawienie/i],
  run_dcf: [/wycen/i, /dcf/i, /ile wart/i, /enterprise value/i, /wartość firm/i],
  run_comps: [/comparable/i, /comps/i, /mnożnik/i, /multiple/i, /porównywaln/i],
  sensitivity: [/wrażliwoś/i, /sensitivity/i, /co jeśli wacc/i],
  investment_analysis: [/npv/i, /irr/i, /opłacalnoś/i, /zwrot z inwestycji/i, /roi/i, /payback/i],
  explain_value: [/skąd ta wartość/i, /wyjaśnij/i, /lineage/i, /źródło/i],
  model_health: [/sprawdź model/i, /health check/i, /walidacja/i, /czy model jest ok/i],
  generate_report: [/raport/i, /report/i, /przygotuj dokument/i],
  save_analysis: [/zapisz/i, /save/i, /zachowaj/i],
  next_steps: [/co dalej/i, /następny krok/i, /what next/i, /sugeruj/i],
  general_finance: [/finans/i, /pieniądz/i, /cash/i, /zysk/i, /strat/i, /bilans/i, /przychod/i, /koszt/i],
};
```

### 4.2 Intent → Tool Mapping

```typescript
const INTENT_TOOL_MAP: Record<FinanceIntent, FinanceTool[]> = {
  build_model:         ['createModel'],
  run_analysis:        ['computeRatios', 'runVerticalAnalysis', 'runHorizontalAnalysis', 'generateNarrative'],
  run_ratios:          ['computeRatios', 'computeGrowthRatios'],
  run_dupont:          ['runDuPontDecomposition'],
  run_altman:          ['computeAltmanZ'],
  run_piotroski:       ['computePiotroskiF'],
  create_scenario:     ['createScenario'],
  stress_test:         ['createScenario'],  // with stress parameters
  compare_scenarios:   ['compareScenarios'],
  run_dcf:             ['computeUFCF', 'computeWACC', 'createValuation'],
  run_comps:           ['addComps'],
  sensitivity:         ['runSensitivity'],
  investment_analysis: ['createInvestmentCase'],
  explain_value:       ['explainValue'],
  model_health:        ['getModelHealth'],
  generate_report:     ['generateNarrative', 'saveAnalysis'],
  save_analysis:       ['saveAnalysis'],
  next_steps:          ['getModelHealth'],  // assess state, then suggest
  general_finance:     [],  // LLM handles with context
};
```

---

## 5) AI Finance Proposal Cards (UI)

### 5.1 ChatFinancialProposalCard

Nowy komponent analogiczny do `ChatTableProposalCard`:

```typescript
interface FinancialProposal {
  type: 'model_creation' | 'scenario_creation' | 'valuation' | 'analysis_save' | 'driver_change' | 'report_generation';
  title: string;
  description: string;
  parameters: Record<string, { label: string; value: string | number; editable: boolean; unit?: string }>;
  warnings?: string[];
  expectedImpact?: { metric: string; before: number; after: number; change: string }[];
  actions: ('confirm' | 'refine' | 'reject')[];
}
```

**Typy kart:**

| Typ | Kiedy | Zawartość |
|-----|-------|----------|
| `model_creation` | AI proponuje budowę modelu | Source statements, periods, drivers, expected health |
| `scenario_creation` | AI proponuje scenariusz | Assumptions table, CAPEX check, expected impact |
| `valuation` | AI proponuje wycenę | Method, WACC, g, expected EV range |
| `analysis_save` | AI proponuje zapis analizy | Analysis type, parameters, key findings |
| `driver_change` | AI proponuje zmianę drivera | Driver, old value, new value, impact on key metrics |
| `report_generation` | AI proponuje raport | Sections, format, target audience |

### 5.2 FinancialInsightCard

Karta z wynikami analizy inline w chacie:

```typescript
interface FinancialInsightCard {
  type: 'ratio_summary' | 'credit_assessment' | 'dupont_waterfall' | 'scenario_comparison' | 'valuation_summary' | 'sensitivity_heatmap';
  title: string;
  data: Record<string, any>;  // structured data for rendering
  narrative: string;           // AI-generated text with citations
  citations: { text: string; ref: string; value: number }[];
}
```

---

## 6) Backend Architecture

### 6.1 Finance AI Service

```typescript
// server/src/services/financeAIService.ts

interface FinanceAIService {
  // Context building
  buildFinanceContext(orgId: string, userId: string, activeTab: string, artifactId?: string): Promise<FinanceContext>;

  // Tool execution
  executeTool(tool: FinanceTool, params: Record<string, any>, userId: string): Promise<ToolResult>;

  // Narrative generation (with numerical anchoring)
  generateNarrative(
    type: NarrativeType,
    computedData: Record<string, any>,
    language: 'pl' | 'en',
    sections?: string[]
  ): Promise<AnchoredNarrative>;

  // Proposal generation
  generateProposal(
    intent: FinanceIntent,
    context: FinanceContext,
    userMessage: string
  ): Promise<FinancialProposal>;

  // Proactive suggestions
  suggestNextSteps(context: FinanceContext): Promise<NextStepSuggestion[]>;

  // Validation
  validateNumericalAnchoring(narrative: string, computedData: Record<string, any>): ValidationResult;
}

interface AnchoredNarrative {
  text: string;
  citations: { placeholder: string; ref: string; value: number; formatted: string }[];
  sections: { title: string; content: string }[];
  warnings: string[];
}
```

### 6.2 Finance Tool Registry

```typescript
// server/src/services/financeToolRegistry.ts

interface FinanceToolDefinition {
  name: string;
  tier: 'read' | 'write';
  description: string;
  parameters: JSONSchema;
  requiresConfirm: boolean;
  requiredContext: ('model' | 'statements' | 'scenario' | 'valuation' | 'market_assumptions')[];
  execute: (params: any, context: FinanceContext) => Promise<ToolResult>;
}

// Registry pattern — each tool is registered and discoverable by AI
const FINANCE_TOOLS: FinanceToolDefinition[] = [
  {
    name: 'computeRatios',
    tier: 'read',
    description: 'Compute 42 financial ratios + composite scores for a statement or model',
    parameters: { statementId: 'string', periods: 'string[]' },
    requiresConfirm: false,
    requiredContext: ['statements'],
    execute: async (params, ctx) => { /* ... */ }
  },
  // ... all tools from §2.2
];
```

### 6.3 Context Pack Extension

Rozszerzenie istniejącego `contextPackBuilder.ts`:

```typescript
// Extension to existing extractFinancialData()

function extractFinancialData(context: WorkspaceContext): FinanceContextPack {
  if (context.type === 'financial_model') {
    return {
      type: 'financial_model',
      model: loadModelSummary(context.entityId),
      statements: loadLinkedStatements(context.entityId),
      ratios: computeQuickRatios(context.entityId),
      health: checkModelHealth(context.entityId),
      availableTools: getAvailableTools('model'),
    };
  }

  if (context.type === 'valuation') {
    return {
      type: 'valuation',
      valuation: loadValuationSummary(context.entityId),
      model: loadLinkedModel(context.entityId),
      marketAssumptions: loadMarketAssumptions(context.orgId),
      availableTools: getAvailableTools('valuation'),
    };
  }

  if (context.type === 'scenario') {
    return {
      type: 'scenario',
      scenario: loadScenarioSummary(context.entityId),
      baselineModel: loadBaselineModel(context.entityId),
      assumptions: loadAssumptions(context.entityId),
      availableTools: getAvailableTools('scenario'),
    };
  }

  // Default: statement pack or hub view
  return {
    type: 'finance_hub',
    packs: loadPackSummaries(context.orgId),
    readyCount: countReadyStatements(context.orgId),
    recentModels: loadRecentModels(context.orgId),
    availableTools: getAvailableTools('hub'),
  };
}
```

---

## 7) System Prompt Extension (Finance Persona)

Rozszerzenie istniejącej persony w `server/src/ai/persona.ts`:

```
When user is in Finance module, you are a Senior Financial Analyst with expertise in:
- 3-statement financial modeling (P&L, BS, CF linkage)
- Ratio analysis (42 ratios, DuPont, Altman Z, Piotroski F)
- DCF valuation (UFCF, WACC, terminal value, sensitivity)
- Comparable company analysis (trading comps, precedent transactions)
- Scenario modeling and stress testing
- Credit analysis and debt advisory
- Equity research narrative generation

CRITICAL RULES:
1. NUMERICAL ANCHOR: Every number you cite MUST come from the computed results provided in your context. NEVER generate numbers from your training data.
2. CITATION: Every factual claim must reference the specific data point (e.g., "Gross margin 34.2% [P&L 2024]").
3. PROPOSE, DON'T DECIDE: For any write operation, generate a proposal and wait for user confirmation.
4. NO INVESTMENT ADVICE: Never say "buy", "sell", "hold", or make investment recommendations.
5. PROACTIVE: After completing a task, suggest 2-3 logical next steps.
6. PROFESSIONAL TONE: Write like a senior equity research analyst — precise, evidence-based, neutral.
7. QUALITY GATES: Respect all gates (statement-ready, model-health, CAPEX-defined, etc.). Block operations that violate gates.

Available tools: {list of FinanceTools from registry}
Current context: {FinanceContext JSON}
```

---

## 8) Metryki i monitoring

| Metryka | Target | Opis |
|---------|--------|------|
| Numerical anchor compliance | 100% | Każda wartość w AI narrative = computed value |
| Proposal acceptance rate | >70% | % propozycji AI zaakceptowanych przez usera |
| Tool execution success | >95% | % wywołań narzędzi bez błędów |
| Context injection latency | <500ms | Czas budowy FinanceContext |
| Narrative generation time | <5s | Czas generowania narratywy analitycznej |
| User satisfaction (finance) | >4.0/5 | Rating jakości odpowiedzi AI w finance |
| False positive rate (intents) | <5% | % błędnie rozpoznanych intencji finansowych |

---

## 9) Implementacja — fazy

| Faza | Scope | Sprint |
|------|-------|--------|
| **F1** | Finance context injection + basic tools (ratios, health check) | S1-S2 |
| **F2** | Financial intent detector + ProposalCard | S3-S4 |
| **F3** | Model build tool + driver management | S5-S6 |
| **F4** | Analysis tools (DuPont, Altman, Piotroski) + narrative generation | S7-S8 |
| **F5** | Scenario tools + comparison + stress test | S9-S10 |
| **F6** | DCF valuation tool + sensitivity + comps | S11-S12 |
| **F7** | Investment analysis tools + initiative linking | S13-S14 |
| **F8** | Proactive guidance + guided workflows + report generation | S15-S16 |
