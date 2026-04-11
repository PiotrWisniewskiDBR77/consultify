/**
 * useToolStore - Zustand store for Strategic Tool sessions
 *
 * Manages state for all strategic analysis tools including:
 * - Session lifecycle (create, load, save)
 * - Step navigation and progress
 * - Tool-specific data (SWOT items, Porter forces, etc.)
 * - AI suggestions and generated initiatives
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type {
  ConsultingMissionContext,
  ConsultingOutputCandidateBase,
  ConsultingSummarySnapshot,
} from '@/config/consultingToolsStandard';
import { createConsultingMissionContext } from '@/config/consultingToolsStandard';

// ==================== TYPES ====================

export type ToolType =
  | 'dynamic-swot'
  | 'market-forces'
  | 'growth-paths'
  | 'value-chain'
  | 'portfolio-priority'
  | 'ambition-decomposer'
  | 'focus-tradeoff'
  | 'risk-uncertainty'
  | 'capability-mapper'
  | 'narrative-engine'
  | 'sop-builder'
  | 'a3-problem-solving'
  | 'smed-planner'
  | 'dms-builder'
  | 'inventory-autopilot'
  | 'vsm-builder'
  | 'constraint-control'
  | 'decision-engine'
  | 'control-tower'
  | 'automation-pipeline'
  | 'robotics-feasibility'
  | 'logistics-automation'
  | 'rpa-scanner'
  | 'ai-discovery'
  | 'integration-diagnostic'
  | 'digital-value-pool'
  | 'legacy-analyzer'
  | 'data-inventory'
  | 'pain-to-solution'
  | 'pain-explorer'
  | 'process-automation';

export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export type DynamicSwotPhaseId = 'mission' | 'input' | 'swot' | 'insights' | 'outputs';
export type SWOTEvidenceType = 'fact' | 'observation' | 'hypothesis';
export type SWOTSignalState = 'accepted' | 'proposed' | 'needs-evidence';
export type SWOTCardStatus = 'accepted' | 'proposed';
export type ProposalStatus = 'ai-proposed' | 'accepted' | 'rejected' | 'rethinking';
export type SessionGenerationStatus = 'idle' | 'generating' | 'ready' | 'error';
export type CanonicalToolSessionStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'FINALIZED'
  | 'FAILED'
  | 'APPROVED'
  | 'GENERATED';

export type ProposalCardType =
  | 'signal'
  | 'item'
  | 'tension'
  | 'move'
  | 'correlation'
  | 'output-candidate'
  | 'conclusion';
export type SWOTOutputReadiness =
  | 'ready-for-initiative'
  | 'ready-for-presentation'
  | 'ready-for-report'
  | 'keep-as-idea'
  | 'blocked';

export interface SWOTSignal {
  id: string;
  type: 'interview' | 'file' | 'link' | 'ai' | 'benchmark';
  content: string;
  sourceLabel: string;
  confidence?: number;
  tags?: string[];
  evidenceType?: SWOTEvidenceType;
  state?: SWOTSignalState;
  provenance?: string;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface StepDefinition {
  id: string;
  name: string;
  namePl: string;
  description: string;
  descriptionPl: string;
  required: boolean;
  aiAssisted: boolean;
}

export interface ToolStep {
  stepId: string;
  status: StepStatus;
  data: Record<string, unknown>;
  aiSuggestions?: string[];
  completedAt?: string;
}

// SWOT-specific types
export interface SWOTItem {
  id: string;
  text: string;
  impact: 'high' | 'medium' | 'low';
  quadrant: 'strengths' | 'weaknesses' | 'opportunities' | 'threats';
  source?: 'user' | 'ai';
  confidence?: number;
  status?: SWOTCardStatus;
  linkedSignalIds?: string[];
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface SWOTCorrelation {
  id: string;
  items: string[]; // IDs of related SWOT items
  type: 'SO' | 'WO' | 'ST' | 'WT'; // Strength-Opportunity, etc.
  insight: string;
  initiativeProposal?: string;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface SWOTTension {
  id: string;
  title: string;
  type: 'attack' | 'repair' | 'defend' | 'protect';
  linkedCorrelationIds: string[];
  linkedItemIds: string[];
  insight: string;
  whyNow?: string;
  confidence?: number;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface SWOTMove {
  id: string;
  title: string;
  category: 'quick-win' | 'big-bet' | 'defensive-move' | 'capability-build';
  rationale: string;
  linkedTensionIds: string[];
  linkedItemIds: string[];
  expectedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  riskLevel?: 'high' | 'medium' | 'low';
  confidence?: number;
  firstStep?: string;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface SWOTOutputCandidate extends ConsultingOutputCandidateBase {
  linkedMoveIds: string[];
  linkedItemIds: string[];
  readiness?: SWOTOutputReadiness;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface SWOTData {
  context: ConsultingMissionContext;
  signals: SWOTSignal[];
  items: SWOTItem[];
  correlations: SWOTCorrelation[];
  tensions: SWOTTension[];
  recommendedMoves: SWOTMove[];
  outputCandidates: SWOTOutputCandidate[];
  summary?: ConsultingSummarySnapshot & {
    proposalId?: string;
    proposalStatus?: ProposalStatus;
    userComment?: string;
    recommendedInitiatives: InitiativeDraft[];
  };
}

// Porter's Forces types
export interface ForceData {
  id: string;
  name: string;
  score: number; // 1-5
  trend: 'increasing' | 'stable' | 'decreasing';
  drivers: string[];
  aiAnalysis?: string;
}

export interface PorterData {
  context: {
    industry: string;
    geographicScope: string;
    position: 'leader' | 'challenger' | 'follower' | 'niche';
  };
  forces: {
    rivalry: ForceData;
    newEntrants: ForceData;
    substitutes: ForceData;
    buyerPower: ForceData;
    supplierPower: ForceData;
  };
  overallAttractiveness?: number;
  summary?: {
    keyInsights: string[];
    recommendedInitiatives: InitiativeDraft[];
  };
}

// Growth Paths (Ansoff) types
export interface GrowthPathItem {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
}

export interface GrowthPathsData {
  context: ConsultingMissionContext;
  quadrants: {
    marketPenetration: GrowthPathItem[];
    marketDevelopment: GrowthPathItem[];
    productDevelopment: GrowthPathItem[];
    diversification: GrowthPathItem[];
  };
  summary?: ConsultingSummarySnapshot & {
    recommendedInitiatives: InitiativeDraft[];
  };
}

// Portfolio Priority (BCG) types
export interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  marketGrowth: number; // 1-5
  marketShare: number; // 1-5
  investmentLevel: number; // 1-5
  category: 'star' | 'cash-cow' | 'question-mark' | 'dog';
}

export interface PortfolioPriorityData {
  context: ConsultingMissionContext;
  initiatives: PortfolioItem[];
  summary?: ConsultingSummarySnapshot & {
    recommendedInitiatives: InitiativeDraft[];
  };
}

// Risk & Uncertainty types
export interface RiskAssumption {
  id: string;
  text: string;
  confidence: number; // 1-5
}

export interface RiskItem {
  id: string;
  description: string;
  probability: number; // 1-5
  impact: number; // 1-5
  mitigation: string;
}

export interface ScenarioItem {
  id: string;
  title: string;
  likelihood: number; // 1-5
  notes: string;
}

export interface RiskUncertaintyData {
  context: ConsultingMissionContext;
  assumptions: RiskAssumption[];
  risks: RiskItem[];
  scenarios: ScenarioItem[];
  summary?: ConsultingSummarySnapshot & {
    recommendedInitiatives: InitiativeDraft[];
  };
}

// Operational tools generic types
export interface OperationalItem {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  category?: string;
  durationMinutes?: number;
  owner?: string;
  target?: string;
  frequency?: string;
  threshold?: string;
}

export interface OperationalToolData {
  context: ConsultingMissionContext;
  sections: Record<string, OperationalItem[]>;
  summary?: ConsultingSummarySnapshot & {
    recommendedInitiatives: InitiativeDraft[];
  };
}

export interface ToolImpactHypothesis {
  metricName: string;
  baseline: number | null;
  target: number | null;
  unit: string;
  timeframe: string;
  assumptions: string[];
}

export interface ToolFlowResults {
  executiveSummary: string;
  keyFindings: string[];
  quickWins: string[];
  strategicBets: string[];
  prerequisites: string[];
  risks: string[];
  dependencies: string[];
}

export interface ToolFlowReasoning {
  narrative: string;
  evidence: string[];
  openQuestions: string[];
}

export interface ToolFlowPrepare {
  nextSteps: string[];
  stakeholders: string[];
  dataNeeded: string[];
  timeline: string;
}

export interface ToolFlowEconomics {
  fullyLoadedCostPerHour: number | null;
  baselineHoursPerWeek: number | null;
  targetHoursPerWeek: number | null;
  oneTimeCost: number | null;
  monthlyCost: number | null;
}

export interface ProcessAutomationFlow {
  processName: string;
  owner: string;
  volumePerWeek: number | null;
  baselineMinutesPerCycle: number | null;
  targetMinutesPerCycle: number | null;
  errorRateBaselinePct: number | null;
  errorRateTargetPct: number | null;
}

export interface ToolFlowExtras {
  impactHypothesis?: ToolImpactHypothesis;
  results?: ToolFlowResults;
  reasoning?: ToolFlowReasoning;
  prepare?: ToolFlowPrepare;
  economics?: ToolFlowEconomics;
  processAutomation?: ProcessAutomationFlow;
}

export type ToolsetFlowData = OperationalToolData & {
  flow?: ToolFlowExtras;
};

// Initiative draft from tool analysis
export interface InitiativeDraft {
  id: string;
  title: string;
  description: string;
  type: 'strategic' | 'operational' | 'defensive' | 'growth';
  source: ToolType;
  linkedItems: string[]; // IDs of source items (SWOT items, correlations, etc.)
  estimatedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  rationale: string;
}

// Chat message for tool context
export interface ToolChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  stepId?: string;
}

// Tool session
export interface ToolSession {
  id: string;
  toolType: ToolType;
  name: string;
  createdAt: string;
  updatedAt: string;
  currentStep: number;
  currentPhaseId?: string;
  steps: ToolStep[];
  inputData:
    | SWOTData
    | PorterData
    | GrowthPathsData
    | PortfolioPriorityData
    | RiskUncertaintyData
    | OperationalToolData
    | ToolsetFlowData
    | Record<string, unknown>;
  chatHistory: ToolChatMessage[];
  generatedInitiatives: InitiativeDraft[];
  status: CanonicalToolSessionStatus;
  sessionGenerationStatus?: SessionGenerationStatus;
  wizardState?: Record<string, unknown>;
  missingItems?: Array<{
    id: string;
    label: string;
    severity?: string;
    stepId?: string;
    resolved?: boolean;
  }>;
}

// ==================== STEP DEFINITIONS ====================

export const SWOT_STEPS: StepDefinition[] = [
  {
    id: 'mission',
    name: 'Mission & Context',
    namePl: 'Mission & Context',
    description: 'Define the strategic question, scope, success criteria, and decision frame',
    descriptionPl: 'Zdefiniuj pytanie strategiczne, zakres, kryteria sukcesu i ramę decyzji',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'input',
    name: 'Input & Exploration',
    namePl: 'Input & Exploration',
    description: 'Capture interview notes, materials, and external context as shared signals',
    descriptionPl: 'Zbierz wywiad, materiały i kontekst zewnętrzny jako wspólne sygnały',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'swot',
    name: 'SWOT Build',
    namePl: 'SWOT Build',
    description:
      'Turn signals into a concrete matrix of strengths, weaknesses, opportunities, and threats',
    descriptionPl:
      'Zamień sygnały w konkretną macierz mocnych stron, słabych stron, szans i zagrożeń',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'insights',
    name: 'Synthesis & Insights',
    namePl: 'Synthesis & Insights',
    description: 'Convert the matrix into tensions, applied conclusions, and strategic moves',
    descriptionPl: 'Przekształć macierz w napięcia, wnioski aplikowalne i ruchy strategiczne',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'outputs',
    name: 'Outputs & Actions',
    namePl: 'Outputs & Actions',
    description: 'Prepare the final source summary and generate downstream outputs and initiatives',
    descriptionPl: 'Przygotuj final source summary oraz wygeneruj outputy i inicjatywy',
    required: true,
    aiAssisted: true,
  },
];

export const PORTER_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Industry Context',
    namePl: 'Kontekst Branżowy',
    description: 'Define the industry, market, and competitive position',
    descriptionPl: 'Zdefiniuj branżę, rynek i pozycję konkurencyjną',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'rivalry',
    name: 'Competitive Rivalry',
    namePl: 'Rywalizacja Konkurencyjna',
    description: 'Assess intensity of competition among existing players',
    descriptionPl: 'Oceń intensywność konkurencji między istniejącymi graczami',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'newEntrants',
    name: 'Threat of New Entrants',
    namePl: 'Zagrożenie Nowych Graczy',
    description: 'Evaluate barriers to entry and threat of new competitors',
    descriptionPl: 'Oceń bariery wejścia i zagrożenie ze strony nowych konkurentów',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'substitutes',
    name: 'Threat of Substitutes',
    namePl: 'Zagrożenie Substytutów',
    description: 'Identify substitute products and their impact',
    descriptionPl: 'Zidentyfikuj produkty zastępcze i ich wpływ',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'buyerPower',
    name: 'Buyer Power',
    namePl: 'Siła Nabywców',
    description: 'Assess bargaining power of customers',
    descriptionPl: 'Oceń siłę przetargową klientów',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'supplierPower',
    name: 'Supplier Power',
    namePl: 'Siła Dostawców',
    description: 'Assess bargaining power of suppliers',
    descriptionPl: 'Oceń siłę przetargową dostawców',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Review analysis and generate competitive initiatives',
    descriptionPl: 'Przegląd analizy i generowanie inicjatyw konkurencyjnych',
    required: true,
    aiAssisted: true,
  },
];

export const GROWTH_PATHS_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Growth Context',
    namePl: 'Kontekst Wzrostu',
    description: 'Define the growth goal, scope, and time horizon',
    descriptionPl: 'Zdefiniuj cel wzrostu, zakres i horyzont czasowy',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'market-penetration',
    name: 'Market Penetration',
    namePl: 'Penetracja Rynku',
    description: 'Opportunities to grow in current markets with current products',
    descriptionPl: 'Możliwości wzrostu na obecnych rynkach z obecnymi produktami',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'market-development',
    name: 'Market Development',
    namePl: 'Rozwój Rynku',
    description: 'Opportunities to enter new markets with current products',
    descriptionPl: 'Wejście na nowe rynki z obecnymi produktami',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'product-development',
    name: 'Product Development',
    namePl: 'Rozwój Produktu',
    description: 'Opportunities to develop new products for current markets',
    descriptionPl: 'Nowe produkty dla obecnych rynków',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'diversification',
    name: 'Diversification',
    namePl: 'Dywersyfikacja',
    description: 'Opportunities to enter new markets with new products',
    descriptionPl: 'Wejście na nowe rynki z nowymi produktami',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Review growth paths and generate initiatives',
    descriptionPl: 'Przegląd ścieżek wzrostu i generowanie inicjatyw',
    required: true,
    aiAssisted: true,
  },
];

export const PORTFOLIO_PRIORITY_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Portfolio Context',
    namePl: 'Kontekst Portfolio',
    description: 'Define the portfolio scope and constraints',
    descriptionPl: 'Zdefiniuj zakres portfolio i ograniczenia',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'portfolio-items',
    name: 'Portfolio Items',
    namePl: 'Elementy Portfolio',
    description: 'List initiatives with growth and share assessments',
    descriptionPl: 'Lista inicjatyw z oceną wzrostu i udziału',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'portfolio-matrix',
    name: 'BCG Matrix',
    namePl: 'Macierz BCG',
    description: 'Review portfolio categories and priorities',
    descriptionPl: 'Przegląd kategorii i priorytetów portfolio',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Summarize portfolio priorities and initiatives',
    descriptionPl: 'Podsumowanie priorytetów i inicjatyw',
    required: true,
    aiAssisted: true,
  },
];

export const RISK_UNCERTAINTY_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Risk Context',
    namePl: 'Kontekst Ryzyka',
    description: 'Define scope and time horizon for risk analysis',
    descriptionPl: 'Zdefiniuj zakres i horyzont czasowy analizy ryzyka',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'assumptions',
    name: 'Key Assumptions',
    namePl: 'Kluczowe Założenia',
    description: 'List critical assumptions and confidence levels',
    descriptionPl: 'Lista kluczowych założeń i poziomu pewności',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'risks',
    name: 'Strategic Risks',
    namePl: 'Ryzyka Strategiczne',
    description: 'Identify and score risks with mitigation actions',
    descriptionPl: 'Identyfikuj ryzyka i działania mitygujące',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'scenarios',
    name: 'Scenarios',
    namePl: 'Scenariusze',
    description: 'Describe possible scenarios and likelihood',
    descriptionPl: 'Opisz scenariusze i prawdopodobieństwo',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Summarize risks and resilience initiatives',
    descriptionPl: 'Podsumowanie ryzyk i inicjatyw odporności',
    required: true,
    aiAssisted: true,
  },
];

export const SOP_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'SOP Context',
    namePl: 'Kontekst SOP',
    description: 'Define scope and critical operations',
    descriptionPl: 'Zdefiniuj zakres i krytyczne operacje',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'standards',
    name: 'Standards',
    namePl: 'Standardy',
    description: 'List key standards and quality criteria',
    descriptionPl: 'Lista standardów i kryteriów jakości',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'checklists',
    name: 'Checklists',
    namePl: 'Checklisty',
    description: 'Define checklists and verification steps',
    descriptionPl: 'Zdefiniuj checklisty i kroki weryfikacji',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Summarize SOP and generate initiatives',
    descriptionPl: 'Podsumuj SOP i wygeneruj inicjatywy',
    required: true,
    aiAssisted: true,
  },
];

export const A3_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Problem Context',
    namePl: 'Kontekst Problemu',
    description: 'Define the problem and scope',
    descriptionPl: 'Zdefiniuj problem i zakres',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'problem',
    name: 'Problem Statement',
    namePl: 'Opis Problemu',
    description: 'Describe the problem and current impact',
    descriptionPl: 'Opisz problem i wpływ',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'root-cause',
    name: 'Root Cause',
    namePl: 'Przyczyna Źródłowa',
    description: 'Identify root causes (5 Why)',
    descriptionPl: 'Zidentyfikuj przyczyny źródłowe (5 Why)',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'countermeasures',
    name: 'Countermeasures',
    namePl: 'Środki Zaradcze',
    description: 'Define countermeasures and follow-up',
    descriptionPl: 'Zdefiniuj środki zaradcze i follow-up',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Summarize A3 and generate initiatives',
    descriptionPl: 'Podsumuj A3 i wygeneruj inicjatywy',
    required: true,
    aiAssisted: true,
  },
];

export const SMED_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Changeover Context',
    namePl: 'Kontekst Przezbrojen',
    description: 'Define scope and changeover baseline',
    descriptionPl: 'Zdefiniuj zakres i bazę przezbrojeń',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'changeover-steps',
    name: 'Changeover Steps',
    namePl: 'Kroki Przezbrojenia',
    description: 'List internal/external steps and durations',
    descriptionPl: 'Lista kroków wewnętrznych/zewnętrznych i czasu',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'improvements',
    name: 'Improvements',
    namePl: 'Usprawnienia',
    description: 'Identify quick wins and investments',
    descriptionPl: 'Zidentyfikuj quick wins i inwestycje',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Summarize SMED and generate initiatives',
    descriptionPl: 'Podsumuj SMED i wygeneruj inicjatywy',
    required: true,
    aiAssisted: true,
  },
];

export const DMS_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'DMS Context',
    namePl: 'Kontekst DMS',
    description: 'Define scope and governance',
    descriptionPl: 'Zdefiniuj zakres i governance',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'kpis',
    name: 'KPIs',
    namePl: 'KPI',
    description: 'Define KPI boards and thresholds',
    descriptionPl: 'Zdefiniuj KPI i progi',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'escalation',
    name: 'Escalation Rules',
    namePl: 'Reguły Eskalacji',
    description: 'Define escalation rules and cadence',
    descriptionPl: 'Zdefiniuj reguły eskalacji i rytm',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Summarize DMS and generate initiatives',
    descriptionPl: 'Podsumuj DMS i wygeneruj inicjatywy',
    required: true,
    aiAssisted: true,
  },
];

export const INVENTORY_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Inventory Context',
    namePl: 'Kontekst Zapasów',
    description: 'Define scope and inventory objectives',
    descriptionPl: 'Zdefiniuj zakres i cele zapasów',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'sku-classification',
    name: 'SKU Classification',
    namePl: 'Klasyfikacja SKU',
    description: 'Define ABC/XYZ classification',
    descriptionPl: 'Zdefiniuj klasyfikację ABC/XYZ',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'replenishment',
    name: 'Replenishment Policies',
    namePl: 'Polityki Uzupełniania',
    description: 'Define policies and reorder triggers',
    descriptionPl: 'Zdefiniuj polityki i punkty uzupełniania',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Summarize inventory and generate initiatives',
    descriptionPl: 'Podsumuj zapasy i wygeneruj inicjatywy',
    required: true,
    aiAssisted: true,
  },
];

export const TOOLSET_OPERATIONAL_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Operational Context',
    namePl: 'Kontekst Operacyjny',
    description: 'Define goal, scope, and time horizon for the operational tool',
    descriptionPl: 'Zdefiniuj cel, zakres i horyzont czasowy narzędzia operacyjnego',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'fill',
    name: 'Fill',
    namePl: 'Wypełnij',
    description: 'Capture current-state signals and improvement ideas',
    descriptionPl: 'Zbierz sygnały stanu obecnego i pomysły usprawnień',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'impact-hypothesis',
    name: 'Impact Hypothesis',
    namePl: 'Hipoteza wpływu',
    description: 'Define baseline → target and assumptions (measurable)',
    descriptionPl: 'Zdefiniuj baseline → target i założenia (mierzalne)',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'results',
    name: 'Results',
    namePl: 'Wyniki',
    description: 'Summarize key findings and expected impact',
    descriptionPl: 'Podsumuj kluczowe wnioski i oczekiwany wpływ',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'reasoning',
    name: 'Reasoning',
    namePl: 'Uzasadnienie',
    description: 'Explain why these results follow from inputs and evidence',
    descriptionPl: 'Wyjaśnij, dlaczego te wyniki wynikają z wejść i evidence',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'prepare',
    name: 'Prepare',
    namePl: 'Przygotuj',
    description: 'Define next steps, owners, and what data is needed',
    descriptionPl: 'Zdefiniuj kolejne kroki, ownerów i potrzebne dane',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'report',
    name: 'Report / Deck',
    namePl: 'Raport / Deck',
    description: 'Export and package outcomes for stakeholders',
    descriptionPl: 'Wyeksportuj i zapakuj wyniki dla stakeholderów',
    required: false,
    aiAssisted: false,
  },
  {
    id: 'initiatives',
    name: 'Initiatives',
    namePl: 'Inicjatywy',
    description: 'Turn findings into draft initiatives and execution plan',
    descriptionPl: 'Przełóż wnioski na draft inicjatyw i plan realizacji',
    required: false,
    aiAssisted: true,
  },
];

export const TOOLSET_DIGITAL_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Digital Context',
    namePl: 'Kontekst Cyfrowy',
    description: 'Define the transformation scope and desired outcomes',
    descriptionPl: 'Zdefiniuj zakres transformacji i pożądane outcomes',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'fill',
    name: 'Fill',
    namePl: 'Wypełnij',
    description: 'Capture pains, opportunities, constraints, and candidate solutions',
    descriptionPl: 'Zbierz bóle, szanse, ograniczenia i kandydatów rozwiązań',
    required: true,
    aiAssisted: true,
  },
  ...TOOLSET_OPERATIONAL_STEPS.filter((s) => !['context', 'fill'].includes(s.id)),
];

export const PROCESS_AUTOMATION_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Identification',
    namePl: 'Identyfikacja',
    description: 'Identify the process and define the automation goal',
    descriptionPl: 'Zidentyfikuj proces i zdefiniuj cel automatyzacji',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'process-mapping',
    name: 'Process Mapping',
    namePl: 'Mapowanie procesu',
    description: 'Capture the key steps and handoffs',
    descriptionPl: 'Zbierz kluczowe kroki i handoffy',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'measurement',
    name: 'Measurement',
    namePl: 'Pomiar',
    description: 'Baseline volume, time, errors, and constraints',
    descriptionPl: 'Baseline: wolumen, czas, błędy i ograniczenia',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'redesign',
    name: 'Redesign',
    namePl: 'Redesign',
    description: 'Define the redesigned flow and automation candidates',
    descriptionPl: 'Zdefiniuj nowy flow i kandydatów automatyzacji',
    required: true,
    aiAssisted: true,
  },
  {
    id: 're-estimation',
    name: 'Re-estimation',
    namePl: 'Re-estymacja',
    description: 'Estimate target cycle times and error rates after redesign',
    descriptionPl: 'Oszacuj target czasy i błędy po redesignie',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'economics',
    name: 'Economics',
    namePl: 'Ekonomia',
    description: 'Calculate savings, payback, and ROI assumptions',
    descriptionPl: 'Policz oszczędności, payback i założenia ROI',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'initiatives',
    name: 'Initiatives',
    namePl: 'Inicjatywy',
    description: 'Translate the redesign into an execution-ready initiative set',
    descriptionPl: 'Przełóż redesign na zestaw inicjatyw gotowych do realizacji',
    required: false,
    aiAssisted: true,
  },
  {
    id: 'report',
    name: 'Report / Deck',
    namePl: 'Raport / Deck',
    description: 'Export and share outcomes',
    descriptionPl: 'Wyeksportuj i udostępnij wyniki',
    required: false,
    aiAssisted: false,
  },
];

// ==================== STORE STATE ====================

interface ToolStoreState {
  // Current session
  currentSession: ToolSession | null;
  currentStep: number;

  // Saved sessions
  savedSessions: ToolSession[];

  // Actions
  createSession: (toolType: ToolType) => void;
  loadSession: (sessionId: string) => void;
  saveSession: () => void;
  deleteSession: (sessionId: string) => void;

  // Navigation
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  canAdvanceStep: () => boolean;

  // API hydration
  hydrateSessionFromApi: (payload: {
    id: string;
    toolType: ToolType;
    name?: string;
    createdAt?: string;
    updatedAt?: string;
    status?: string;
    answers?: Record<string, unknown>;
    completionPercent?: number;
  }) => void;

  // Data updates
  updateInputData: (
    data: Partial<
      | SWOTData
      | PorterData
      | GrowthPathsData
      | PortfolioPriorityData
      | RiskUncertaintyData
      | OperationalToolData
      | ToolsetFlowData
    >
  ) => void;
  addSWOTSignal: (signal: Omit<SWOTSignal, 'id'>) => void;
  updateSWOTSignal: (signalId: string, updates: Partial<SWOTSignal>) => void;
  removeSWOTSignal: (signalId: string) => void;
  addSWOTItem: (item: Omit<SWOTItem, 'id'>) => void;
  removeSWOTItem: (itemId: string) => void;
  updateSWOTItem: (itemId: string, updates: Partial<SWOTItem>) => void;
  setSWOTTensions: (tensions: Omit<SWOTTension, 'id'>[]) => void;
  setSWOTMoves: (moves: Omit<SWOTMove, 'id'>[]) => void;
  setSWOTOutputCandidates: (candidates: Omit<SWOTOutputCandidate, 'id'>[]) => void;
  setSWOTSummary: (summary: SWOTData['summary']) => void;

  // AI suggestions
  addAISuggestion: (stepId: string, suggestion: string) => void;
  addCorrelation: (correlation: Omit<SWOTCorrelation, 'id'>) => void;
  addInitiative: (initiative: Omit<InitiativeDraft, 'id'>) => void;
  setInitiatives: (initiatives: Omit<InitiativeDraft, 'id'>[]) => void;

  // Proposal card actions (AI-first session flow)
  setSessionGenerationStatus: (status: SessionGenerationStatus) => void;
  acceptCard: (cardType: ProposalCardType, cardId: string) => void;
  rejectCard: (cardType: ProposalCardType, cardId: string) => void;
  commentOnCard: (cardType: ProposalCardType, cardId: string, comment: string) => void;
  markRethinking: (cardType: ProposalCardType, cardId: string) => void;
  updateCardAfterRethink: (
    cardType: ProposalCardType,
    cardId: string,
    updates: Record<string, unknown>
  ) => void;
  acceptAllInPhase: (phaseId: DynamicSwotPhaseId) => void;

  // Chat
  addChatMessage: (message: Omit<ToolChatMessage, 'id' | 'timestamp'>) => void;

  // Utilities
  getStepDefinitions: () => StepDefinition[];
  calculateProgress: () => number;
}

// ==================== INITIAL DATA ====================

const createInitialSWOTData = (): SWOTData => ({
  context: createConsultingMissionContext(),
  signals: [],
  items: [],
  correlations: [],
  tensions: [],
  recommendedMoves: [],
  outputCandidates: [],
});

const createInitialPorterData = (): PorterData => ({
  context: {
    industry: '',
    geographicScope: '',
    position: 'challenger',
  },
  forces: {
    rivalry: { id: 'rivalry', name: 'Competitive Rivalry', score: 3, trend: 'stable', drivers: [] },
    newEntrants: {
      id: 'newEntrants',
      name: 'New Entrants',
      score: 3,
      trend: 'stable',
      drivers: [],
    },
    substitutes: { id: 'substitutes', name: 'Substitutes', score: 3, trend: 'stable', drivers: [] },
    buyerPower: { id: 'buyerPower', name: 'Buyer Power', score: 3, trend: 'stable', drivers: [] },
    supplierPower: {
      id: 'supplierPower',
      name: 'Supplier Power',
      score: 3,
      trend: 'stable',
      drivers: [],
    },
  },
});

const createInitialGrowthPathsData = (): GrowthPathsData => ({
  context: createConsultingMissionContext(),
  quadrants: {
    marketPenetration: [],
    marketDevelopment: [],
    productDevelopment: [],
    diversification: [],
  },
});

const createInitialPortfolioPriorityData = (): PortfolioPriorityData => ({
  context: createConsultingMissionContext(),
  initiatives: [],
});

const createInitialRiskUncertaintyData = (): RiskUncertaintyData => ({
  context: createConsultingMissionContext(),
  assumptions: [],
  risks: [],
  scenarios: [],
});

const createInitialOperationalData = (steps: StepDefinition[]): OperationalToolData => {
  const sections = steps
    .filter((step) => !['context', 'summary'].includes(step.id))
    .reduce<Record<string, OperationalItem[]>>((acc, step) => {
      acc[step.id] = [];
      return acc;
    }, {});

  return {
    context: createConsultingMissionContext(),
    sections,
  };
};

const createInitialToolsetFlowData = (inputSectionIds: string[]): ToolsetFlowData => {
  const sections = inputSectionIds.reduce<Record<string, OperationalItem[]>>((acc, id) => {
    acc[id] = [];
    return acc;
  }, {});

  return {
    context: createConsultingMissionContext(),
    sections,
    flow: {
      impactHypothesis: {
        metricName: '',
        baseline: null,
        target: null,
        unit: '',
        timeframe: '',
        assumptions: [],
      },
      results: {
        executiveSummary: '',
        keyFindings: [],
        quickWins: [],
        strategicBets: [],
        prerequisites: [],
        risks: [],
        dependencies: [],
      },
      reasoning: {
        narrative: '',
        evidence: [],
        openQuestions: [],
      },
      prepare: {
        nextSteps: [],
        stakeholders: [],
        dataNeeded: [],
        timeline: '',
      },
      economics: {
        fullyLoadedCostPerHour: null,
        baselineHoursPerWeek: null,
        targetHoursPerWeek: null,
        oneTimeCost: null,
        monthlyCost: null,
      },
      processAutomation: {
        processName: '',
        owner: '',
        volumePerWeek: null,
        baselineMinutesPerCycle: null,
        targetMinutesPerCycle: null,
        errorRateBaselinePct: null,
        errorRateTargetPct: null,
      },
    },
  };
};

const TOOL_STEP_DEFINITIONS: Record<ToolType, StepDefinition[]> = {
  'dynamic-swot': SWOT_STEPS,
  'market-forces': PORTER_STEPS,
  'growth-paths': GROWTH_PATHS_STEPS,
  'value-chain': PORTER_STEPS,
  'portfolio-priority': PORTFOLIO_PRIORITY_STEPS,
  'ambition-decomposer': PORTER_STEPS,
  'focus-tradeoff': PORTER_STEPS,
  'risk-uncertainty': RISK_UNCERTAINTY_STEPS,
  'capability-mapper': PORTER_STEPS,
  'narrative-engine': PORTER_STEPS,
  'sop-builder': SOP_STEPS,
  'a3-problem-solving': A3_STEPS,
  'smed-planner': SMED_STEPS,
  'dms-builder': DMS_STEPS,
  'inventory-autopilot': INVENTORY_STEPS,
  'vsm-builder': TOOLSET_OPERATIONAL_STEPS,
  'constraint-control': TOOLSET_OPERATIONAL_STEPS,
  'decision-engine': TOOLSET_OPERATIONAL_STEPS,
  'control-tower': TOOLSET_OPERATIONAL_STEPS,
  'automation-pipeline': TOOLSET_OPERATIONAL_STEPS,
  'robotics-feasibility': TOOLSET_DIGITAL_STEPS,
  'logistics-automation': TOOLSET_DIGITAL_STEPS,
  'rpa-scanner': TOOLSET_DIGITAL_STEPS,
  'ai-discovery': TOOLSET_DIGITAL_STEPS,
  'integration-diagnostic': TOOLSET_DIGITAL_STEPS,
  'digital-value-pool': TOOLSET_DIGITAL_STEPS,
  'legacy-analyzer': TOOLSET_DIGITAL_STEPS,
  'data-inventory': TOOLSET_DIGITAL_STEPS,
  'pain-to-solution': TOOLSET_DIGITAL_STEPS,
  'pain-explorer': TOOLSET_DIGITAL_STEPS,
  'process-automation': PROCESS_AUTOMATION_STEPS,
};

const TOOL_INITIAL_DATA: Record<
  ToolType,
  | SWOTData
  | PorterData
  | GrowthPathsData
  | PortfolioPriorityData
  | RiskUncertaintyData
  | OperationalToolData
  | Record<string, unknown>
> = {
  'dynamic-swot': createInitialSWOTData(),
  'market-forces': createInitialPorterData(),
  'growth-paths': createInitialGrowthPathsData(),
  'value-chain': createInitialPorterData(),
  'portfolio-priority': createInitialPortfolioPriorityData(),
  'ambition-decomposer': createInitialPorterData(),
  'focus-tradeoff': createInitialPorterData(),
  'risk-uncertainty': createInitialRiskUncertaintyData(),
  'capability-mapper': createInitialPorterData(),
  'narrative-engine': createInitialPorterData(),
  'sop-builder': createInitialOperationalData(SOP_STEPS),
  'a3-problem-solving': createInitialOperationalData(A3_STEPS),
  'smed-planner': createInitialOperationalData(SMED_STEPS),
  'dms-builder': createInitialOperationalData(DMS_STEPS),
  'inventory-autopilot': createInitialOperationalData(INVENTORY_STEPS),
  'vsm-builder': createInitialToolsetFlowData(['fill']),
  'constraint-control': createInitialToolsetFlowData(['fill']),
  'decision-engine': createInitialToolsetFlowData(['fill']),
  'control-tower': createInitialToolsetFlowData(['fill']),
  'automation-pipeline': createInitialToolsetFlowData(['fill']),
  'robotics-feasibility': createInitialToolsetFlowData(['fill']),
  'logistics-automation': createInitialToolsetFlowData(['fill']),
  'rpa-scanner': createInitialToolsetFlowData(['fill']),
  'ai-discovery': createInitialToolsetFlowData(['fill']),
  'integration-diagnostic': createInitialToolsetFlowData(['fill']),
  'digital-value-pool': createInitialToolsetFlowData(['fill']),
  'legacy-analyzer': createInitialToolsetFlowData(['fill']),
  'data-inventory': createInitialToolsetFlowData(['fill']),
  'pain-to-solution': createInitialToolsetFlowData(['fill']),
  'pain-explorer': createInitialToolsetFlowData(['fill']),
  'process-automation': createInitialToolsetFlowData(['process-mapping', 'redesign']),
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const normalizeCanonicalStatus = (status?: string | null): CanonicalToolSessionStatus => {
  const normalized = String(status || 'DRAFT').trim().toUpperCase();
  if (
    normalized === 'DRAFT' ||
    normalized === 'IN_PROGRESS' ||
    normalized === 'REVIEW' ||
    normalized === 'FINALIZED' ||
    normalized === 'FAILED' ||
    normalized === 'APPROVED' ||
    normalized === 'GENERATED'
  ) {
    return normalized;
  }
  if (normalized === 'COMPLETED') return 'FINALIZED';
  return 'DRAFT';
};

const DYNAMIC_SWOT_PHASE_SEQUENCE: DynamicSwotPhaseId[] = [
  'mission',
  'input',
  'swot',
  'insights',
  'outputs',
];

const LEGACY_SWOT_STEP_TO_PHASE: Record<string, DynamicSwotPhaseId> = {
  context: 'mission',
  mission: 'mission',
  input: 'input',
  strengths: 'swot',
  weaknesses: 'swot',
  opportunities: 'swot',
  threats: 'swot',
  swot: 'swot',
  correlations: 'insights',
  insights: 'insights',
  summary: 'outputs',
  outputs: 'outputs',
};

const getDynamicSwotPhaseIdFromStep = (stepId?: string | null): DynamicSwotPhaseId => {
  if (!stepId) return 'mission';
  return LEGACY_SWOT_STEP_TO_PHASE[stepId] || 'mission';
};

const getDynamicSwotPhaseIndexFromLegacyStep = (step: number): number => {
  if (step <= 1) return 1;
  if (step <= 5) return 3;
  if (step === 6) return 4;
  return 5;
};

const deriveSwotSignals = (input: SWOTData): SWOTSignal[] => {
  if (Array.isArray(input.signals) && input.signals.length > 0) {
    return input.signals.map((signal) => ({
      ...signal,
      evidenceType: signal.evidenceType || (signal.type === 'benchmark' ? 'fact' : 'observation'),
      state: signal.state || (signal.type === 'ai' ? 'proposed' : 'accepted'),
      provenance: signal.provenance || signal.sourceLabel,
    }));
  }

  const derived = (input.items || []).map((item) => ({
    id: `derived-${item.id}`,
    type:
      item.source === 'ai'
        ? ('ai' as const)
        : item.source === 'user'
          ? ('interview' as const)
          : ('benchmark' as const),
    content: item.text,
    sourceLabel:
      item.source === 'ai'
        ? 'AI suggestion'
        : item.source === 'user'
          ? 'User input'
          : 'Imported evidence',
    confidence: item.confidence,
    tags: [item.quadrant],
    evidenceType: 'observation' as const,
    state: item.source === 'ai' ? ('proposed' as const) : ('accepted' as const),
    provenance: item.source === 'ai' ? 'AI suggestion' : 'Derived from accepted card',
  }));

  return derived;
};

const normalizeDynamicSwotData = (input: SWOTData): SWOTData => ({
  ...input,
  signals: deriveSwotSignals(input),
  items: (input.items || []).map((item) => ({
    ...item,
    status: item.status || (item.source === 'ai' ? 'proposed' : 'accepted'),
    linkedSignalIds: item.linkedSignalIds || [],
  })),
  outputCandidates: (input.outputCandidates || []).map((candidate) => ({
    ...candidate,
    readiness: candidate.readiness || 'keep-as-idea',
  })),
});

const mergeToolAnswersWithInitialData = (
  toolType: ToolType,
  answers: Record<string, unknown>
):
  | SWOTData
  | PorterData
  | GrowthPathsData
  | PortfolioPriorityData
  | RiskUncertaintyData
  | OperationalToolData
  | ToolsetFlowData
  | Record<string, unknown> => {
  const base = structuredClone(TOOL_INITIAL_DATA[toolType] || {});
  const safeAnswers = answers || {};

  const merged = {
    ...(base as Record<string, unknown>),
    ...(safeAnswers as Record<string, unknown>),
    context: {
      ...((base as any)?.context || {}),
      ...((safeAnswers as any)?.context || {}),
    },
    summary:
      (base as any)?.summary || (safeAnswers as any)?.summary
        ? {
            ...((base as any)?.summary || {}),
            ...((safeAnswers as any)?.summary || {}),
          }
        : undefined,
    flow:
      (base as any)?.flow || (safeAnswers as any)?.flow
        ? {
            ...((base as any)?.flow || {}),
            ...((safeAnswers as any)?.flow || {}),
            impactHypothesis: {
              ...((base as any)?.flow?.impactHypothesis || {}),
              ...((safeAnswers as any)?.flow?.impactHypothesis || {}),
            },
            results: {
              ...((base as any)?.flow?.results || {}),
              ...((safeAnswers as any)?.flow?.results || {}),
            },
            reasoning: {
              ...((base as any)?.flow?.reasoning || {}),
              ...((safeAnswers as any)?.flow?.reasoning || {}),
            },
            prepare: {
              ...((base as any)?.flow?.prepare || {}),
              ...((safeAnswers as any)?.flow?.prepare || {}),
            },
            economics: {
              ...((base as any)?.flow?.economics || {}),
              ...((safeAnswers as any)?.flow?.economics || {}),
            },
            processAutomation: {
              ...((base as any)?.flow?.processAutomation || {}),
              ...((safeAnswers as any)?.flow?.processAutomation || {}),
            },
          }
        : undefined,
  } as any;

  if (toolType === 'dynamic-swot') {
    return normalizeDynamicSwotData(merged as SWOTData);
  }

  return merged as any;
};

const computeStepStatusFromAnswers = (
  toolType: ToolType,
  stepId: string,
  answers: any
): StepStatus => {
  try {
    if (!answers) return 'pending';

    if (toolType === 'dynamic-swot') {
      const swotAnswers = normalizeDynamicSwotData(answers as SWOTData);

      if (stepId === 'mission') {
        return swotAnswers.context?.goal &&
          swotAnswers.context?.scope &&
          swotAnswers.context?.successSignal
          ? 'completed'
          : 'pending';
      }

      if (stepId === 'input') {
        return (swotAnswers.signals?.length || 0) > 0 || (swotAnswers.items?.length || 0) > 0
          ? 'completed'
          : 'pending';
      }

      if (stepId === 'swot') {
        return ['strengths', 'weaknesses', 'opportunities', 'threats'].every((quadrant) =>
          swotAnswers.items?.some((item) => item.quadrant === quadrant)
        )
          ? 'completed'
          : 'pending';
      }

      if (stepId === 'insights') {
        return (swotAnswers.tensions?.length || 0) > 0 ||
          (swotAnswers.correlations?.length || 0) > 0 ||
          (swotAnswers.recommendedMoves?.length || 0) > 0 ||
          (swotAnswers.summary?.appliedConclusions?.length || 0) > 0
          ? 'completed'
          : 'pending';
      }

      if (stepId === 'outputs') {
        return swotAnswers.summary?.executiveSummary ||
          (swotAnswers.summary?.keyInsights?.length || 0) > 0 ||
          (swotAnswers.outputCandidates?.length || 0) > 0
          ? 'completed'
          : 'pending';
      }
    }

    // Context step (all tools)
    if (stepId === 'context') {
      if (toolType === 'market-forces') {
        return answers?.context?.industry && answers?.context?.geographicScope
          ? 'completed'
          : 'pending';
      }
      return answers?.context?.goal && answers?.context?.scope ? 'completed' : 'pending';
    }

    // Summary step: treat as completed if key insights exist or initiatives exist
    if (stepId === 'summary') {
      const hasInsights = (answers?.summary?.keyInsights?.length || 0) > 0;
      const hasDrafts = (answers?.initiatives?.length || 0) > 0;
      return hasInsights || hasDrafts ? 'completed' : 'pending';
    }

    if (toolType === 'dynamic-swot') {
      if (['strengths', 'weaknesses', 'opportunities', 'threats'].includes(stepId)) {
        return answers?.items?.some((i: any) => i.quadrant === stepId) ? 'completed' : 'pending';
      }
      if (stepId === 'correlations') {
        return (answers?.correlations?.length || 0) > 0 ? 'completed' : 'pending';
      }
    }

    if (toolType === 'market-forces') {
      const force = answers?.forces?.[stepId];
      if (force) return (force?.drivers?.length || 0) > 0 ? 'completed' : 'pending';
    }

    if (toolType === 'growth-paths') {
      const map: Record<string, keyof GrowthPathsData['quadrants']> = {
        'market-penetration': 'marketPenetration',
        'market-development': 'marketDevelopment',
        'product-development': 'productDevelopment',
        diversification: 'diversification',
      };
      const key = map[stepId];
      if (key) return (answers?.quadrants?.[key]?.length || 0) > 0 ? 'completed' : 'pending';
    }

    if (toolType === 'portfolio-priority') {
      if (stepId === 'portfolio-items')
        return (answers?.initiatives?.length || 0) > 0 ? 'completed' : 'pending';
      if (stepId === 'portfolio-matrix')
        return answers?.initiatives?.some((i: any) => i.category) ? 'completed' : 'pending';
    }

    if (toolType === 'risk-uncertainty') {
      if (stepId === 'assumptions')
        return (answers?.assumptions?.length || 0) > 0 ? 'completed' : 'pending';
      if (stepId === 'risks') return (answers?.risks?.length || 0) > 0 ? 'completed' : 'pending';
      if (stepId === 'scenarios')
        return (answers?.scenarios?.length || 0) > 0 ? 'completed' : 'pending';
    }

    // Toolsets & operational: section arrays (generic)
    const sectionLen = answers?.sections?.[stepId]?.length || 0;
    if (sectionLen > 0) return 'completed';

    // Toolsets: flow sections
    if (stepId === 'impact-hypothesis') {
      const ih = answers?.flow?.impactHypothesis;
      return ih?.metricName &&
        ih?.unit &&
        ih?.timeframe &&
        ih?.baseline != null &&
        ih?.target != null
        ? 'completed'
        : 'pending';
    }
    if (stepId === 'results') {
      const r = answers?.flow?.results;
      return r?.executiveSummary || (r?.keyFindings?.length || 0) > 0 ? 'completed' : 'pending';
    }
    if (stepId === 'reasoning') {
      const r = answers?.flow?.reasoning;
      return r?.narrative || (r?.evidence?.length || 0) > 0 ? 'completed' : 'pending';
    }
    if (stepId === 'prepare') {
      const p = answers?.flow?.prepare;
      return p?.timeline || (p?.nextSteps?.length || 0) > 0 ? 'completed' : 'pending';
    }
    if (stepId === 'economics') {
      const e = answers?.flow?.economics;
      return e?.fullyLoadedCostPerHour != null &&
        e?.baselineHoursPerWeek != null &&
        e?.targetHoursPerWeek != null
        ? 'completed'
        : 'pending';
    }
    if (stepId === 'measurement') {
      const p = answers?.flow?.processAutomation;
      return p?.processName && p?.volumePerWeek != null && p?.baselineMinutesPerCycle != null
        ? 'completed'
        : 'pending';
    }
    if (stepId === 're-estimation') {
      const p = answers?.flow?.processAutomation;
      return p?.targetMinutesPerCycle != null ? 'completed' : 'pending';
    }
  } catch {
    // ignore
  }
  return 'pending';
};

const buildToolSteps = (toolType: ToolType, inputData: any): ToolStep[] => {
  const defs = TOOL_STEP_DEFINITIONS[toolType] || PORTER_STEPS;
  return defs.map((step) => ({
    stepId: step.id,
    status: computeStepStatusFromAnswers(toolType, step.id, inputData),
    data: {},
  }));
};

const normalizeDynamicSwotSession = (session: ToolSession): ToolSession => {
  const normalizedInputData = mergeToolAnswersWithInitialData(
    'dynamic-swot',
    (session.inputData || {}) as Record<string, unknown>
  ) as SWOTData;

  const currentPhaseId = session.currentPhaseId
    ? getDynamicSwotPhaseIdFromStep(session.currentPhaseId)
    : getDynamicSwotPhaseIdFromStep(
        session.steps?.[Math.max(0, (session.currentStep || 1) - 1)]?.stepId
      );

  const currentStep =
    typeof session.currentStep === 'number' &&
    session.currentStep <= DYNAMIC_SWOT_PHASE_SEQUENCE.length
      ? Math.max(1, session.currentStep)
      : getDynamicSwotPhaseIndexFromLegacyStep(session.currentStep || 1);

  return {
    ...session,
    currentStep,
    currentPhaseId,
    inputData: normalizedInputData,
    steps: buildToolSteps('dynamic-swot', normalizedInputData),
  };
};

const normalizeSessionForRuntime = (session: ToolSession): ToolSession => {
  const normalizedBase = {
    ...session,
    status: normalizeCanonicalStatus(session.status),
  };
  if (session.toolType === 'dynamic-swot') {
    return normalizeDynamicSwotSession(normalizedBase);
  }

  return normalizedBase;
};

const withRecomputedSteps = (
  session: ToolSession,
  inputData: ToolSession['inputData'] = session.inputData
): ToolSession => ({
  ...session,
  inputData,
  steps: buildToolSteps(session.toolType, inputData),
});

// ==================== STORE ====================

export const useToolStore = create<ToolStoreState>()(
  persist(
    (set, get) => ({
      currentSession: null,
      currentStep: 1,
      savedSessions: [],

      createSession: (toolType: ToolType) => {
        const steps = TOOL_STEP_DEFINITIONS[toolType] || PORTER_STEPS;
        const initialData = TOOL_INITIAL_DATA[toolType] || createInitialPorterData();
        const isDynamicSwot = toolType === 'dynamic-swot';
        const initialPhaseId = isDynamicSwot ? 'mission' : steps[0]?.id;

        const session: ToolSession = {
          id: generateId(),
          toolType,
          name: `${toolType} - ${new Date().toLocaleDateString()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          currentStep: 1,
          currentPhaseId: initialPhaseId,
          steps: buildToolSteps(toolType, initialData),
          inputData: initialData,
          chatHistory: [],
          generatedInitiatives: [],
          status: 'DRAFT',
        };

        set({ currentSession: session, currentStep: 1 });
      },

      loadSession: (sessionId: string) => {
        const { savedSessions } = get();
        const session = savedSessions.find((s) => s.id === sessionId);
        if (session) {
          const normalizedSession = normalizeSessionForRuntime(session);
          set({ currentSession: normalizedSession, currentStep: normalizedSession.currentStep });
        }
      },

      saveSession: () => {
        const { currentSession, savedSessions } = get();
        if (!currentSession) return;

        const updatedSession = {
          ...currentSession,
          updatedAt: new Date().toISOString(),
        };

        const existingIndex = savedSessions.findIndex((s) => s.id === currentSession.id);
        const newSessions =
          existingIndex >= 0
            ? savedSessions.map((s, i) => (i === existingIndex ? updatedSession : s))
            : [...savedSessions, updatedSession];

        set({ currentSession: updatedSession, savedSessions: newSessions });
      },

      deleteSession: (sessionId: string) => {
        const { savedSessions, currentSession } = get();
        set({
          savedSessions: savedSessions.filter((s) => s.id !== sessionId),
          currentSession: currentSession?.id === sessionId ? null : currentSession,
        });
      },

      setCurrentStep: (step: number) => {
        const { currentSession } = get();
        if (!currentSession) return;

        const steps = TOOL_STEP_DEFINITIONS[currentSession.toolType] || PORTER_STEPS;
        if (step >= 1 && step <= steps.length) {
          const stepId = steps[step - 1]?.id;
          set({
            currentStep: step,
            currentSession: {
              ...currentSession,
              currentStep: step,
              currentPhaseId:
                currentSession.toolType === 'dynamic-swot'
                  ? getDynamicSwotPhaseIdFromStep(stepId)
                  : currentSession.currentPhaseId,
            },
          });
        }
      },

      nextStep: () => {
        const { currentStep, currentSession } = get();
        if (!currentSession) return;

        const steps = TOOL_STEP_DEFINITIONS[currentSession.toolType] || PORTER_STEPS;
        if (currentStep < steps.length) {
          // Mark current step as completed
          const updatedSteps = currentSession.steps.map((s, i) =>
            i === currentStep - 1
              ? { ...s, status: 'completed' as StepStatus, completedAt: new Date().toISOString() }
              : s
          );

          set({
            currentStep: currentStep + 1,
            currentSession: {
              ...currentSession,
              currentStep: currentStep + 1,
              currentPhaseId:
                currentSession.toolType === 'dynamic-swot'
                  ? getDynamicSwotPhaseIdFromStep(steps[currentStep]?.id)
                  : currentSession.currentPhaseId,
              steps: updatedSteps,
            },
          });
        }
      },

      prevStep: () => {
        const { currentStep, currentSession } = get();
        if (currentStep > 1 && currentSession) {
          const steps = TOOL_STEP_DEFINITIONS[currentSession.toolType] || PORTER_STEPS;
          set({
            currentStep: currentStep - 1,
            currentSession: {
              ...currentSession,
              currentStep: currentStep - 1,
              currentPhaseId:
                currentSession.toolType === 'dynamic-swot'
                  ? getDynamicSwotPhaseIdFromStep(steps[currentStep - 2]?.id)
                  : currentSession.currentPhaseId,
            },
          });
        }
      },

      canAdvanceStep: () => {
        const { currentSession, currentStep } = get();
        if (!currentSession) return false;

        const steps = TOOL_STEP_DEFINITIONS[currentSession.toolType] || PORTER_STEPS;
        const stepDef = steps[currentStep - 1];

        if (currentSession.toolType === 'dynamic-swot') {
          const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);

          if (stepDef.id === 'mission') {
            return Boolean(
              swotData.context?.goal && swotData.context?.scope && swotData.context?.successSignal
            );
          }

          if (stepDef.id === 'input') {
            return (swotData.signals?.length || 0) > 0 || (swotData.items?.length || 0) > 0;
          }

          if (stepDef.id === 'swot') {
            return ['strengths', 'weaknesses', 'opportunities', 'threats'].every((quadrant) =>
              swotData.items.some((item) => item.quadrant === quadrant)
            );
          }

          if (stepDef.id === 'insights') {
            return (
              (swotData.tensions?.length || 0) > 0 ||
              (swotData.correlations?.length || 0) > 0 ||
              (swotData.recommendedMoves?.length || 0) > 0 ||
              (swotData.summary?.appliedConclusions?.length || 0) > 0
            );
          }

          if (stepDef.id === 'outputs') {
            return Boolean(
              swotData.summary?.executiveSummary ||
              (swotData.summary?.keyInsights?.length || 0) > 0 ||
              (swotData.outputCandidates?.length || 0) > 0
            );
          }
        }

        // Context step: check if required fields are filled
        if (stepDef.id === 'context') {
          const data = currentSession.inputData as
            | SWOTData
            | PorterData
            | GrowthPathsData
            | PortfolioPriorityData
            | RiskUncertaintyData
            | undefined
            | null;

          const ctx = (data as any)?.context as any;
          if (!ctx || typeof ctx !== 'object') return false;

          // Most strategic tools share (goal, scope); Porter uses (industry, ...)
          if ('goal' in ctx) {
            const goal = typeof ctx.goal === 'string' ? ctx.goal : '';
            const scope = typeof ctx.scope === 'string' ? ctx.scope : '';
            const successSignal = typeof ctx.successSignal === 'string' ? ctx.successSignal : '';
            return goal.length > 0 && scope.length > 0 && successSignal.length > 0;
          }
          if ('industry' in ctx) {
            const industry = typeof ctx.industry === 'string' ? ctx.industry : '';
            return industry.length > 0;
          }

          return false;
        }

        // SWOT quadrant steps: check if at least one item exists
        if (['strengths', 'weaknesses', 'opportunities', 'threats'].includes(stepDef.id)) {
          const swotData = currentSession.inputData as SWOTData;
          return swotData.items.some((item) => item.quadrant === stepDef.id);
        }

        if (stepDef.id === 'correlations') {
          const swotData = currentSession.inputData as SWOTData;
          return (swotData.tensions?.length || 0) > 0 || (swotData.correlations?.length || 0) > 0;
        }

        if (stepDef.id === 'summary') {
          const swotData = currentSession.inputData as SWOTData;
          return (
            Boolean(swotData.summary?.executiveSummary || swotData.summary?.keyInsights?.length) &&
            (swotData.recommendedMoves?.length || 0) > 0
          );
        }

        // Growth Paths quadrants: require at least one item
        if (
          [
            'market-penetration',
            'market-development',
            'product-development',
            'diversification',
          ].includes(stepDef.id)
        ) {
          const growthData = currentSession.inputData as GrowthPathsData;
          const keyMap: Record<string, keyof GrowthPathsData['quadrants']> = {
            'market-penetration': 'marketPenetration',
            'market-development': 'marketDevelopment',
            'product-development': 'productDevelopment',
            diversification: 'diversification',
          };
          const key = keyMap[stepDef.id];
          return growthData.quadrants[key].length > 0;
        }

        // Portfolio items step: require at least one initiative
        if (stepDef.id === 'portfolio-items') {
          const portfolioData = currentSession.inputData as PortfolioPriorityData;
          return portfolioData.initiatives.length > 0;
        }

        // Risk & Uncertainty steps: require at least one item
        if (stepDef.id === 'assumptions') {
          const riskData = currentSession.inputData as RiskUncertaintyData;
          return riskData.assumptions.length > 0;
        }
        if (stepDef.id === 'risks') {
          const riskData = currentSession.inputData as RiskUncertaintyData;
          return riskData.risks.length > 0;
        }
        if (stepDef.id === 'scenarios') {
          const riskData = currentSession.inputData as RiskUncertaintyData;
          return riskData.scenarios.length > 0;
        }

        // Operational tools: sections with list items
        const operationalData = currentSession.inputData as OperationalToolData;
        if (operationalData.sections && stepDef.id in operationalData.sections) {
          return operationalData.sections[stepDef.id].length > 0;
        }

        const flow = (currentSession.inputData as any)?.flow;
        if (stepDef.id === 'impact-hypothesis') {
          const ih = flow?.impactHypothesis;
          return Boolean(
            ih?.metricName &&
            ih?.unit &&
            ih?.timeframe &&
            ih?.baseline != null &&
            ih?.target != null
          );
        }
        if (stepDef.id === 'results') {
          const r = flow?.results;
          return Boolean(r?.executiveSummary || (r?.keyFindings?.length || 0) > 0);
        }
        if (stepDef.id === 'reasoning') {
          const r = flow?.reasoning;
          return Boolean(r?.narrative || (r?.evidence?.length || 0) > 0);
        }
        if (stepDef.id === 'prepare') {
          const p = flow?.prepare;
          return Boolean(p?.timeline || (p?.nextSteps?.length || 0) > 0);
        }
        if (stepDef.id === 'measurement') {
          const p = flow?.processAutomation;
          return Boolean(
            p?.processName && p?.volumePerWeek != null && p?.baselineMinutesPerCycle != null
          );
        }
        if (stepDef.id === 're-estimation') {
          const p = flow?.processAutomation;
          return Boolean(p?.targetMinutesPerCycle != null);
        }
        if (stepDef.id === 'economics') {
          const e = flow?.economics;
          return Boolean(
            e?.fullyLoadedCostPerHour != null &&
            e?.baselineHoursPerWeek != null &&
            e?.targetHoursPerWeek != null
          );
        }

        return true;
      },

      hydrateSessionFromApi: (payload) => {
        const steps = TOOL_STEP_DEFINITIONS[payload.toolType] || PORTER_STEPS;
        const answers = payload.answers || {};
        const currentStepFromApi =
          typeof (payload as any).currentStep === 'number' ? (payload as any).currentStep : 1;

        const normalizedAnswers = mergeToolAnswersWithInitialData(payload.toolType, answers);
        const isDynamicSwot = payload.toolType === 'dynamic-swot';
        const normalizedCurrentStep = isDynamicSwot
          ? currentStepFromApi <= DYNAMIC_SWOT_PHASE_SEQUENCE.length
            ? currentStepFromApi
            : getDynamicSwotPhaseIndexFromLegacyStep(currentStepFromApi)
          : currentStepFromApi;

        const session: ToolSession = {
          id: payload.id,
          toolType: payload.toolType,
          name: payload.name || `${payload.toolType} - ${new Date().toLocaleDateString()}`,
          createdAt: payload.createdAt || new Date().toISOString(),
          updatedAt: payload.updatedAt || new Date().toISOString(),
          currentStep: normalizedCurrentStep,
          currentPhaseId: isDynamicSwot
            ? DYNAMIC_SWOT_PHASE_SEQUENCE[normalizedCurrentStep - 1]
            : steps[normalizedCurrentStep - 1]?.id,
          steps: buildToolSteps(payload.toolType, normalizedAnswers),
          inputData: normalizedAnswers as any,
          chatHistory: [],
          generatedInitiatives: [],
          status: normalizeCanonicalStatus(payload.status),
        };

        const normalizedSession = normalizeSessionForRuntime(session);
        set({ currentSession: normalizedSession, currentStep: normalizedSession.currentStep });
      },

      updateInputData: (data) => {
        const { currentSession } = get();
        if (!currentSession) return;

        const mergedInputData = { ...currentSession.inputData, ...data } as any;
        const nextInputData =
          currentSession.toolType === 'dynamic-swot'
            ? normalizeDynamicSwotData(mergedInputData as SWOTData)
            : mergedInputData;

        set({
          currentSession: withRecomputedSteps(currentSession, nextInputData),
        });
      },

      addSWOTSignal: (signal) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;

        const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);
        const newSignal: SWOTSignal = { ...signal, id: generateId() };

        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            signals: [...swotData.signals, newSignal],
          }),
        });
      },

      updateSWOTSignal: (signalId, updates) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;

        const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            signals: swotData.signals.map((signal) =>
              signal.id === signalId ? { ...signal, ...updates } : signal
            ),
          }),
        });
      },

      removeSWOTSignal: (signalId) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;

        const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            signals: swotData.signals.filter((signal) => signal.id !== signalId),
          }),
        });
      },

      addSWOTItem: (item) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;

        const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);
        const newItem: SWOTItem = { ...item, id: generateId() };

        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            items: [...swotData.items, newItem],
          }),
        });
      },

      removeSWOTItem: (itemId: string) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;

        const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            items: swotData.items.filter((item) => item.id !== itemId),
          }),
        });
      },

      updateSWOTItem: (itemId: string, updates: Partial<SWOTItem>) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;

        const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            items: swotData.items.map((item) =>
              item.id === itemId ? { ...item, ...updates } : item
            ),
          }),
        });
      },

      setSWOTTensions: (tensions) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;

        const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            tensions: tensions.map((tension) => ({ ...tension, id: generateId() })),
          }),
        });
      },

      setSWOTMoves: (moves) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;

        const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            recommendedMoves: moves.map((move) => ({ ...move, id: generateId() })),
          }),
        });
      },

      setSWOTOutputCandidates: (candidates) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;

        const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            outputCandidates: candidates.map((candidate) => ({ ...candidate, id: generateId() })),
          }),
        });
      },

      setSWOTSummary: (summary) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;

        const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);
        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            summary: {
              ...summary,
              proposalId: summary?.proposalId || swotData.summary?.proposalId || generateId(),
            },
          }),
        });
      },

      addAISuggestion: (stepId: string, suggestion: string) => {
        const { currentSession } = get();
        if (!currentSession) return;

        const updatedSteps = currentSession.steps.map((step) =>
          step.stepId === stepId
            ? { ...step, aiSuggestions: [...(step.aiSuggestions || []), suggestion] }
            : step
        );

        set({
          currentSession: { ...currentSession, steps: updatedSteps },
        });
      },

      addCorrelation: (correlation) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;

        const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);
        const newCorrelation: SWOTCorrelation = { ...correlation, id: generateId() };

        set({
          currentSession: withRecomputedSteps(currentSession, {
            ...swotData,
            correlations: [...swotData.correlations, newCorrelation],
          }),
        });
      },

      addInitiative: (initiative) => {
        const { currentSession } = get();
        if (!currentSession) return;

        const newInitiative: InitiativeDraft = { ...initiative, id: generateId() };
        set({
          currentSession: {
            ...currentSession,
            generatedInitiatives: [...currentSession.generatedInitiatives, newInitiative],
          },
        });
      },

      setInitiatives: (initiatives) => {
        const { currentSession } = get();
        if (!currentSession) return;

        set({
          currentSession: {
            ...currentSession,
            generatedInitiatives: initiatives.map((initiative) => ({
              ...initiative,
              id: generateId(),
            })),
          },
        });
      },

      setSessionGenerationStatus: (status) => {
        const { currentSession } = get();
        if (!currentSession) return;
        set({ currentSession: { ...currentSession, sessionGenerationStatus: status } });
      },

      acceptCard: (cardType, cardId) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);
        const update = (arr: any[]) =>
          arr.map((item: any) =>
            item.id === cardId ? { ...item, proposalStatus: 'accepted' as ProposalStatus } : item
          );
        const updated: Partial<SWOTData> = {};
        if (cardType === 'signal') updated.signals = update(swotData.signals);
        else if (cardType === 'item') updated.items = update(swotData.items);
        else if (cardType === 'tension') updated.tensions = update(swotData.tensions);
        else if (cardType === 'move') updated.recommendedMoves = update(swotData.recommendedMoves);
        else if (cardType === 'correlation') updated.correlations = update(swotData.correlations);
        else if (cardType === 'output-candidate')
          updated.outputCandidates = update(swotData.outputCandidates);
        else if (cardType === 'conclusion' && swotData.summary) {
          updated.summary = { ...swotData.summary, proposalStatus: 'accepted' as ProposalStatus };
        }
        set({ currentSession: withRecomputedSteps(currentSession, { ...swotData, ...updated }) });
      },

      rejectCard: (cardType, cardId) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);
        const update = (arr: any[]) =>
          arr.map((item: any) =>
            item.id === cardId ? { ...item, proposalStatus: 'rejected' as ProposalStatus } : item
          );
        const updated: Partial<SWOTData> = {};
        if (cardType === 'signal') updated.signals = update(swotData.signals);
        else if (cardType === 'item') updated.items = update(swotData.items);
        else if (cardType === 'tension') updated.tensions = update(swotData.tensions);
        else if (cardType === 'move') updated.recommendedMoves = update(swotData.recommendedMoves);
        else if (cardType === 'correlation') updated.correlations = update(swotData.correlations);
        else if (cardType === 'output-candidate')
          updated.outputCandidates = update(swotData.outputCandidates);
        else if (cardType === 'conclusion' && swotData.summary) {
          updated.summary = { ...swotData.summary, proposalStatus: 'rejected' as ProposalStatus };
        }
        set({ currentSession: withRecomputedSteps(currentSession, { ...swotData, ...updated }) });
      },

      commentOnCard: (cardType, cardId, comment) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);
        const update = (arr: any[]) =>
          arr.map((item: any) => (item.id === cardId ? { ...item, userComment: comment } : item));
        const updated: Partial<SWOTData> = {};
        if (cardType === 'signal') updated.signals = update(swotData.signals);
        else if (cardType === 'item') updated.items = update(swotData.items);
        else if (cardType === 'tension') updated.tensions = update(swotData.tensions);
        else if (cardType === 'move') updated.recommendedMoves = update(swotData.recommendedMoves);
        else if (cardType === 'correlation') updated.correlations = update(swotData.correlations);
        else if (cardType === 'output-candidate')
          updated.outputCandidates = update(swotData.outputCandidates);
        else if (cardType === 'conclusion' && swotData.summary) {
          updated.summary = { ...swotData.summary, userComment: comment };
        }
        set({ currentSession: withRecomputedSteps(currentSession, { ...swotData, ...updated }) });
      },

      markRethinking: (cardType, cardId) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);
        const update = (arr: any[]) =>
          arr.map((item: any) =>
            item.id === cardId ? { ...item, proposalStatus: 'rethinking' as ProposalStatus } : item
          );
        const updated: Partial<SWOTData> = {};
        if (cardType === 'signal') updated.signals = update(swotData.signals);
        else if (cardType === 'item') updated.items = update(swotData.items);
        else if (cardType === 'tension') updated.tensions = update(swotData.tensions);
        else if (cardType === 'move') updated.recommendedMoves = update(swotData.recommendedMoves);
        else if (cardType === 'correlation') updated.correlations = update(swotData.correlations);
        else if (cardType === 'output-candidate')
          updated.outputCandidates = update(swotData.outputCandidates);
        else if (cardType === 'conclusion' && swotData.summary) {
          updated.summary = { ...swotData.summary, proposalStatus: 'rethinking' as ProposalStatus };
        }
        set({ currentSession: withRecomputedSteps(currentSession, { ...swotData, ...updated }) });
      },

      updateCardAfterRethink: (cardType, cardId, updates) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);
        const update = (arr: any[]) =>
          arr.map((item: any) =>
            item.id === cardId
              ? { ...item, ...updates, proposalStatus: 'ai-proposed' as ProposalStatus }
              : item
          );
        const updated: Partial<SWOTData> = {};
        if (cardType === 'signal') updated.signals = update(swotData.signals);
        else if (cardType === 'item') updated.items = update(swotData.items);
        else if (cardType === 'tension') updated.tensions = update(swotData.tensions);
        else if (cardType === 'move') updated.recommendedMoves = update(swotData.recommendedMoves);
        else if (cardType === 'correlation') updated.correlations = update(swotData.correlations);
        else if (cardType === 'output-candidate')
          updated.outputCandidates = update(swotData.outputCandidates);
        else if (cardType === 'conclusion' && swotData.summary) {
          updated.summary = {
            ...swotData.summary,
            ...updates,
            proposalStatus: 'ai-proposed' as ProposalStatus,
          };
        }
        set({ currentSession: withRecomputedSteps(currentSession, { ...swotData, ...updated }) });
      },

      acceptAllInPhase: (phaseId) => {
        const { currentSession } = get();
        if (!currentSession || currentSession.toolType !== 'dynamic-swot') return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);
        const acceptAll = (arr: any[]) =>
          arr.map((item: any) =>
            item.proposalStatus === 'ai-proposed'
              ? { ...item, proposalStatus: 'accepted' as ProposalStatus }
              : item
          );
        const updated = { ...swotData };
        if (phaseId === 'input') updated.signals = acceptAll(swotData.signals);
        else if (phaseId === 'swot') updated.items = acceptAll(swotData.items);
        else if (phaseId === 'insights') {
          updated.tensions = acceptAll(swotData.tensions);
          updated.correlations = acceptAll(swotData.correlations);
          updated.recommendedMoves = acceptAll(swotData.recommendedMoves);
        } else if (phaseId === 'outputs') {
          if (updated.summary?.proposalStatus === 'ai-proposed') {
            updated.summary = { ...updated.summary, proposalStatus: 'accepted' as ProposalStatus };
          }
          updated.outputCandidates = acceptAll(swotData.outputCandidates);
        }
        set({ currentSession: withRecomputedSteps(currentSession, updated) });
      },

      addChatMessage: (message) => {
        const { currentSession, currentStep } = get();
        if (!currentSession) return;

        const newMessage: ToolChatMessage = {
          ...message,
          id: generateId(),
          timestamp: new Date().toISOString(),
          stepId: currentSession.steps[currentStep - 1]?.stepId,
        };

        set({
          currentSession: {
            ...currentSession,
            chatHistory: [...currentSession.chatHistory, newMessage],
          },
        });
      },

      getStepDefinitions: () => {
        const { currentSession } = get();
        if (!currentSession) return [];
        return TOOL_STEP_DEFINITIONS[currentSession.toolType] || PORTER_STEPS;
      },

      calculateProgress: () => {
        const { currentSession } = get();
        if (!currentSession) return 0;

        const completedSteps = currentSession.steps.filter((s) => s.status === 'completed').length;
        return Math.round((completedSteps / currentSession.steps.length) * 100);
      },
    }),
    {
      name: 'tool-store',
      partialize: (state) => ({ savedSessions: state.savedSessions }),
    }
  )
);

export default useToolStore;
