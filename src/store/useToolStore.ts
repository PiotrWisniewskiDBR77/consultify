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
import { evaluateSwotAcceptGate, stampAcceptedSwotItem } from '@/config/swot/swotAcceptGate';

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

export type DynamicSwotPhaseId =
  | 'mission'
  | 'input'
  | 'swot'
  | 'forces'
  | 'options'
  | 'items'
  | 'assumptions'
  | 'insights'
  | 'outputs';
export type SWOTEvidenceType = 'fact' | 'observation' | 'hypothesis';
export type SWOTSignalState = 'accepted' | 'proposed' | 'needs-evidence';
export type SWOTCardStatus = 'accepted' | 'proposed';
export type ProposalStatus = 'ai-proposed' | 'accepted' | 'rejected' | 'rethinking';
export type SessionGenerationStatus = 'idle' | 'generating' | 'ready' | 'error';
export type CanonicalToolSessionStatus =
  'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'FINALIZED' | 'FAILED' | 'APPROVED' | 'GENERATED';

export type ProposalCardType =
  'signal' | 'item' | 'tension' | 'move' | 'correlation' | 'output-candidate' | 'conclusion';
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
export interface SWOTInsightStaircase {
  /** K1 — observable fact from the session (never invented by the LLM). */
  fact: string;
  /** Signal ids / fact keys backing the fact. Empty = declared, unconfirmed. */
  factRefs: string[];
  /** K2 — what the fact means for THIS organization. */
  interpretation: string;
  /** K3 seed — what follows for the decision (feeds tensions/moves). */
  implication: string;
}

export interface SWOTDecomposition {
  dimension: 'process' | 'tools' | 'skills' | 'incentives';
  finding: string;
}

export type SWOTItemEvidenceStatus = 'confirmed' | 'declared' | 'missing';

export type SWOTStrengthClassification =
  'core-competency' | 'niche-strength' | 'claimed-strength' | 'table-stakes';

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
  /** Insight staircase: fact -> interpretation -> implication (CONCLUSION_LAYER K1-K3). */
  staircase?: SWOTInsightStaircase;
  /** Umbrella claims (e.g. "lack of agility") decomposed into actionable roots. */
  decomposition?: SWOTDecomposition[];
  /** Stamped on accept by the evidence gate (confirmed vs declared-unconfirmed). Always
   *  RECOMPUTED at accept time by swotAcceptGate.ts — never trusted verbatim from an
   *  AI-authored proposal (see config/swot/swotAcceptGate.ts docstring). */
  evidenceStatus?: SWOTItemEvidenceStatus;
  /** Free-text evidence description when no signal is linked. */
  evidenceNote?: string;
  /** STREAM G1 (2026-08-13): what KIND of evidence backs this item — reuses the
   *  existing `SWOTEvidenceType` (already defined for signals) so an item can carry
   *  the same fact/observation/hypothesis distinction the Output builder renders
   *  (`toolOutputs/buildSwotOutput.ts`'s `toEvidenceKind`). Previously items had no
   *  way to express this directly (only `evidenceStatus`, confirmed/declared, which
   *  is a DIFFERENT axis — honesty about proof, not the nature of the claim). */
  evidenceType?: SWOTEvidenceType;
  /** STREAM G1 (2026-08-13): where the evidence comes from (a person, a document, a
   *  benchmark, a URL) — distinct from `evidenceNote`'s free-text description. No
   *  existing SWOTItem field carried source attribution separately (SWOTSignal has
   *  `sourceLabel`, but a user-entered item is not always backed by a linked signal). */
  evidenceSource?: string;
  /** Strengths only — outcome of the laddered q-bank (niche vs core competency). */
  classification?: SWOTStrengthClassification;
  /** Answers captured while walking the laddered question bank. */
  ladderAnswers?: { questionId: string; answerKey: string; note?: string }[];
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
  /** W2 mandatory trade-off: what we choose / what we defer / at what cost. */
  tradeoff?: { chosen: string; deferred: string; cost: string };
  /** W2 mandatory rejected alternative with the reason it was dropped. */
  rejectedAlternative?: { option: string; reason: string };
  /** Ordering justification ("first X, because it blocks Y"). */
  whyFirst?: string;
  /** Accountable role for the first step (K3 owner, never "the organization"). */
  ownerRole?: string;
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
    /** W2 answer-first verdict (1-2 sentences): what this analysis means for the decision. */
    verdict?: string;
    /** W2 rationale with references to session element ids (traceability). */
    verdictRationale?: { text: string; factRefs: string[] };
    /** W2 mandatory trade-offs at the recommendation level (>= 1). */
    tradeoffs?: { chosen: string; rejected: string; why: string }[];
    /** K4 — expected effect with an explicit time horizon. */
    expectedEffect?: { text: string; horizon: string };
  };
}

// Porter's Forces types
export type PorterForceId =
  'rivalry' | 'newEntrants' | 'substitutes' | 'buyerPower' | 'supplierPower';

/** K1/K2/K3 staircase for a single Porter force (see config/porter/porterInsightStaircase). */
export interface PorterForceStaircaseData {
  fact: string;
  factRefs: string[];
  interpretation: string;
  implication: string;
}

/** Structural driver behind a force intensity (see config/porter/porterInsightStaircase). */
export interface PorterForceDriverData {
  dimension: 'concentration' | 'switching-costs' | 'barriers' | 'scale-economics';
  finding: string;
}

/** One laddered answer captured while walking the Porter question bank. */
export interface PorterForceLadderAnswerData {
  questionId: string;
  answerKey: string;
  note?: string;
}

export interface ForceData {
  id: string;
  name: string;
  score: number; // 1-5
  trend: 'increasing' | 'stable' | 'decreasing';
  drivers: string[];
  aiAnalysis?: string;
  evidence?: string[];
  implication?: string;
  confidence?: number;
  /** Deterministic intensity verdict synthesized from the ladder (config/porter). */
  intensity?: 'low' | 'medium' | 'high';
  /** K1/K2/K3 staircase backing the intensity verdict. */
  staircase?: PorterForceStaircaseData;
  /** Dominant structural driver(s) — required for high/medium forces. */
  structuralDrivers?: PorterForceDriverData[];
  evidenceStatus?: 'confirmed' | 'declared';
  ladderAnswers?: PorterForceLadderAnswerData[];
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface PorterSignal {
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

export interface PorterImplication {
  id: string;
  title: string;
  forceIds: PorterForceId[];
  insight: string;
  marginImpact: 'high' | 'medium' | 'low';
  urgency: 'high' | 'medium' | 'low';
  recommendation: string;
  confidence?: number;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface PorterMove {
  id: string;
  title: string;
  category: 'positioning' | 'pricing' | 'partnership' | 'capability-build' | 'defensive-move';
  rationale: string;
  linkedImplicationIds: string[];
  linkedForceIds: PorterForceId[];
  expectedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  riskLevel: 'high' | 'medium' | 'low';
  confidence?: number;
  firstStep?: string;
  /** CONCLUSION_LAYER W2: mandatory trade-off (chosen / deferred / cost). */
  tradeoff?: { chosen: string; deferred: string; cost: string };
  /** CONCLUSION_LAYER W2: the alternative considered and why it was dropped. */
  rejectedAlternative?: { option: string; reason: string };
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

/** Synthesized industry-attractiveness verdict (see config/porter/porterSynthesisEngine). */
export interface PorterProfitabilityMap {
  attractiveness: 'structurally-unattractive' | 'mixed' | 'structurally-attractive';
  dominantForces: PorterForceId[];
  verdict: string;
}

export interface PorterOutputCandidate extends ConsultingOutputCandidateBase {
  linkedMoveIds: string[];
  linkedForceIds: PorterForceId[];
  readiness?: SWOTOutputReadiness;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface PorterData {
  context: {
    industry: string;
    geographicScope: string;
    position: 'leader' | 'challenger' | 'follower' | 'niche';
    goal?: string;
    scope?: string;
    successSignal?: string;
    timeframe?: 'short' | 'medium' | 'long';
    constraints?: string;
    assumptions?: string;
    kpiTarget?: string;
  };
  signals: PorterSignal[];
  forces: {
    rivalry: ForceData;
    newEntrants: ForceData;
    substitutes: ForceData;
    buyerPower: ForceData;
    supplierPower: ForceData;
  };
  implications: PorterImplication[];
  recommendedMoves: PorterMove[];
  outputCandidates: PorterOutputCandidate[];
  overallAttractiveness?: number;
  /** Deterministic industry-attractiveness synthesis (config/porter/porterSynthesisEngine). */
  profitabilityMap?: PorterProfitabilityMap;
  summary?: ConsultingSummarySnapshot & {
    proposalId?: string;
    proposalStatus?: ProposalStatus;
    userComment?: string;
    keyInsights: string[];
    recommendedInitiatives: InitiativeDraft[];
  };
}

// ==================== Value Chain (Porter) types ====================
// 9 canonical activities: 5 primary + 4 support. Each is scored on cost
// contribution, value contribution, and margin role — the methodology spine.
export type ValueActivityId =
  | 'inboundLogistics'
  | 'operations'
  | 'outboundLogistics'
  | 'marketingSales'
  | 'service'
  | 'infrastructure'
  | 'hrManagement'
  | 'technology'
  | 'procurement';

export type ValueActivityKind = 'primary' | 'support';

export interface ValueActivity {
  id: ValueActivityId;
  name: string;
  kind: ValueActivityKind;
  costContribution: 'high' | 'medium' | 'low'; // share of total cost
  valueContribution: 'high' | 'medium' | 'low'; // contribution to differentiation / willingness-to-pay
  marginRole: 'creator' | 'neutral' | 'drain'; // does this activity create or erode margin
  maturity?: 'strong' | 'adequate' | 'weak'; // current capability strength
  drivers: string[];
  evidence?: string[];
  implication?: string;
  confidence?: number;
  /**
   * Deepening insight staircase (config/valuechain/valueChainInsightStaircase):
   * surface -> cost/value proof -> benchmark -> potential. Optional for
   * backward compatibility with sessions scored before the ladder existed.
   */
  staircase?: {
    surface: string;
    costValueProof: string;
    proofRefs: string[];
    benchmark: string;
    potential: string;
  };
  /** 'confirmed' only when the cost-value proof cites session evidence. */
  evidenceStatus?: 'confirmed' | 'declared' | 'missing';
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface ValueChainSignal {
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

// A margin lever — the synthesized "where to act and why" unit.
export interface ValueLever {
  id: string;
  title: string;
  activityIds: ValueActivityId[];
  insight: string;
  leverType:
    'cost-reduction' | 'value-enhancement' | 'linkage-optimization' | 'outsource' | 'integrate';
  marginImpact: 'high' | 'medium' | 'low';
  urgency: 'high' | 'medium' | 'low';
  recommendation: string;
  confidence?: number;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface ValueChainMove {
  id: string;
  title: string;
  category:
    | 'cost-advantage'
    | 'differentiation'
    | 'linkage-optimization'
    | 'capability-build'
    | 'restructure';
  rationale: string;
  linkedLeverIds: string[];
  linkedActivityIds: ValueActivityId[];
  /** CONCLUSION_LAYER_STANDARD W2 — mandatory in new moves, optional in legacy ones. */
  tradeoff?: { chosen: string; deferred: string; cost: string };
  rejectedAlternative?: { option: string; reason: string };
  expectedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  riskLevel: 'high' | 'medium' | 'low';
  confidence?: number;
  firstStep?: string;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface ValueChainOutputCandidate extends ConsultingOutputCandidateBase {
  linkedMoveIds: string[];
  linkedActivityIds: ValueActivityId[];
  readiness?: SWOTOutputReadiness;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface ValueChainData {
  context: {
    industry: string;
    valueChainScope: string;
    position: 'cost-leader' | 'differentiator' | 'hybrid' | 'undefined';
    goal?: string;
    scope?: string;
    successSignal?: string;
    timeframe?: 'short' | 'medium' | 'long';
    constraints?: string;
    assumptions?: string;
    kpiTarget?: string;
  };
  signals: ValueChainSignal[];
  activities: Record<ValueActivityId, ValueActivity>;
  levers: ValueLever[];
  recommendedMoves: ValueChainMove[];
  outputCandidates: ValueChainOutputCandidate[];
  positioningVerdict?: {
    positioning: 'cost-advantage' | 'differentiation' | 'stuck-in-the-middle';
    summary: string;
  };
  summary?: ConsultingSummarySnapshot & {
    proposalId?: string;
    proposalStatus?: ProposalStatus;
    userComment?: string;
    keyInsights: string[];
    recommendedInitiatives: InitiativeDraft[];
  };
}

// ==================== Capability Mapper types ====================
// Dynamic list of organizational capabilities scored on current vs target
// maturity and strategic importance → gaps → build/buy/partner moves.
export interface CapabilitySignal {
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

export interface Capability {
  id: string;
  name: string;
  domain: string; // e.g. technology, talent, processes, data, partnerships
  currentMaturity: number; // 1-5
  targetMaturity: number; // 1-5
  importance: 'high' | 'medium' | 'low'; // strategic importance
  gapSize?: 'critical' | 'moderate' | 'minor'; // derived from target-current × importance
  sourcing?: 'build' | 'buy' | 'partner' | 'sustain';
  drivers: string[];
  evidence?: string[];
  implication?: string;
  confidence?: number;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

// Synthesized capability gap/priority — the "where to act and why" unit.
export interface CapabilityGap {
  id: string;
  title: string;
  capabilityIds: string[];
  insight: string;
  priority: 'high' | 'medium' | 'low';
  urgency: 'high' | 'medium' | 'low';
  recommendation: string;
  confidence?: number;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface CapabilityMove {
  id: string;
  title: string;
  category: 'build' | 'buy' | 'partner' | 'reskill' | 'restructure';
  rationale: string;
  linkedGapIds: string[];
  linkedCapabilityIds: string[];
  expectedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  riskLevel: 'high' | 'medium' | 'low';
  confidence?: number;
  firstStep?: string;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface CapabilityOutputCandidate extends ConsultingOutputCandidateBase {
  linkedMoveIds: string[];
  linkedCapabilityIds: string[];
  readiness?: SWOTOutputReadiness;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface CapabilityMapperData {
  context: {
    industry: string;
    capabilityDomains: string;
    strategicPriorities?: string;
    goal?: string;
    scope?: string;
    successSignal?: string;
    timeframe?: 'short' | 'medium' | 'long';
    constraints?: string;
    assumptions?: string;
    kpiTarget?: string;
  };
  signals: CapabilitySignal[];
  capabilities: Capability[];
  gaps: CapabilityGap[];
  recommendedMoves: CapabilityMove[];
  outputCandidates: CapabilityOutputCandidate[];
  summary?: ConsultingSummarySnapshot & {
    proposalId?: string;
    proposalStatus?: ProposalStatus;
    userComment?: string;
    keyInsights: string[];
    recommendedInitiatives: InitiativeDraft[];
  };
}

// ==================== Ambition Decomposer types ====================
// Cascade a big ambition into strategic themes → measurable targets → moves.
export interface AmbitionSignal {
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

export interface AmbitionTheme {
  id: string;
  title: string;
  description: string;
  targetMetric: string; // what to measure
  targetValue: string; // the goal value
  horizon: 'short' | 'medium' | 'long';
  importance: 'high' | 'medium' | 'low';
  drivers: string[];
  evidence?: string[];
  implication?: string;
  confidence?: number;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface AmbitionPriority {
  id: string;
  title: string;
  themeIds: string[];
  insight: string;
  priority: 'high' | 'medium' | 'low';
  urgency: 'high' | 'medium' | 'low';
  recommendation: string;
  confidence?: number;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface AmbitionMove {
  id: string;
  title: string;
  category: 'foundation' | 'accelerator' | 'bet' | 'enabler' | 'quick-win';
  rationale: string;
  linkedPriorityIds: string[];
  linkedThemeIds: string[];
  expectedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  riskLevel: 'high' | 'medium' | 'low';
  confidence?: number;
  firstStep?: string;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface AmbitionOutputCandidate extends ConsultingOutputCandidateBase {
  linkedMoveIds: string[];
  linkedThemeIds: string[];
  readiness?: SWOTOutputReadiness;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface AmbitionDecomposerData {
  context: {
    ambitionStatement: string;
    scope: string;
    goal?: string;
    successSignal?: string;
    timeframe?: 'short' | 'medium' | 'long';
    constraints?: string;
    assumptions?: string;
    kpiTarget?: string;
  };
  signals: AmbitionSignal[];
  themes: AmbitionTheme[];
  priorities: AmbitionPriority[];
  recommendedMoves: AmbitionMove[];
  outputCandidates: AmbitionOutputCandidate[];
  summary?: ConsultingSummarySnapshot & {
    proposalId?: string;
    proposalStatus?: ProposalStatus;
    userComment?: string;
    keyInsights: string[];
    recommendedInitiatives: InitiativeDraft[];
  };
}

// ==================== Focus & Trade-offs types ====================
// Score competing priorities on value/effort/fit → trade-offs → focus decision.
export interface FocusSignal {
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

export interface FocusPriority {
  id: string;
  title: string;
  description: string;
  valueScore: number; // 1-5 strategic value
  effortScore: number; // 1-5 effort/cost
  strategicFit: number; // 1-5 fit with strategy
  recommendation: 'pursue' | 'defer' | 'drop';
  drivers: string[];
  evidence?: string[];
  implication?: string;
  confidence?: number;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface FocusTradeoff {
  id: string;
  title: string;
  priorityIds: string[];
  insight: string;
  priority: 'high' | 'medium' | 'low';
  urgency: 'high' | 'medium' | 'low';
  recommendation: string;
  confidence?: number;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface FocusMove {
  id: string;
  title: string;
  category: 'commit' | 'sequence' | 'cut' | 'rebalance' | 'experiment';
  rationale: string;
  linkedTradeoffIds: string[];
  linkedPriorityIds: string[];
  expectedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  riskLevel: 'high' | 'medium' | 'low';
  confidence?: number;
  firstStep?: string;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface FocusOutputCandidate extends ConsultingOutputCandidateBase {
  linkedMoveIds: string[];
  linkedPriorityIds: string[];
  readiness?: SWOTOutputReadiness;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface FocusTradeoffData {
  context: {
    competingPriorities: string;
    decisionCriteria: string;
    goal?: string;
    scope?: string;
    successSignal?: string;
    timeframe?: 'short' | 'medium' | 'long';
    constraints?: string;
    assumptions?: string;
    kpiTarget?: string;
  };
  signals: FocusSignal[];
  priorities: FocusPriority[];
  tradeoffs: FocusTradeoff[];
  recommendedMoves: FocusMove[];
  outputCandidates: FocusOutputCandidate[];
  summary?: ConsultingSummarySnapshot & {
    proposalId?: string;
    proposalStatus?: ProposalStatus;
    userComment?: string;
    keyInsights: string[];
    recommendedInitiatives: InitiativeDraft[];
  };
}

// ==================== Narrative Engine types ====================
// Build a persuasive narrative: audience + core message → pillars with proof → arc.
export interface NarrativeSignal {
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

export interface NarrativePillar {
  id: string;
  title: string;
  message: string; // the claim this pillar makes
  proofPoints: string[]; // evidence backing the claim
  audienceResonance: 'high' | 'medium' | 'low';
  drivers: string[];
  evidence?: string[];
  implication?: string;
  confidence?: number;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface NarrativeThread {
  id: string;
  title: string;
  pillarIds: string[];
  insight: string;
  priority: 'high' | 'medium' | 'low';
  urgency: 'high' | 'medium' | 'low';
  recommendation: string;
  confidence?: number;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface NarrativeMove {
  id: string;
  title: string;
  category: 'open' | 'build' | 'prove' | 'cta' | 'reframe';
  rationale: string;
  linkedThreadIds: string[];
  linkedPillarIds: string[];
  expectedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  riskLevel: 'high' | 'medium' | 'low';
  confidence?: number;
  firstStep?: string;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface NarrativeOutputCandidate extends ConsultingOutputCandidateBase {
  linkedMoveIds: string[];
  linkedPillarIds: string[];
  readiness?: SWOTOutputReadiness;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface NarrativeEngineData {
  context: {
    audience: string;
    coreMessage: string;
    goal?: string;
    scope?: string;
    successSignal?: string;
    timeframe?: 'short' | 'medium' | 'long';
    constraints?: string;
    assumptions?: string;
    kpiTarget?: string;
    /**
     * OXFORD O3 — SCQA (Situation-Complication-Question-Answer). `coreMessage`
     * IS the Answer; these three carry the rest of the McKinsey opening so the
     * pyramid engine (src/config/narrativeengine/pyramidValidator.ts) can check
     * the chain is consistent instead of four disconnected fields.
     */
    situation?: string;
    complication?: string;
    question?: string;
  };
  signals: NarrativeSignal[];
  pillars: NarrativePillar[];
  threads: NarrativeThread[];
  recommendedMoves: NarrativeMove[];
  outputCandidates: NarrativeOutputCandidate[];
  summary?: ConsultingSummarySnapshot & {
    proposalId?: string;
    proposalStatus?: ProposalStatus;
    userComment?: string;
    keyInsights: string[];
    recommendedInitiatives: InitiativeDraft[];
  };
}

// Growth Paths (Ansoff) types
export type GrowthQuadrantId =
  'marketPenetration' | 'marketDevelopment' | 'productDevelopment' | 'diversification';

export interface GrowthPathItem {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  quadrant?: GrowthQuadrantId;
  rationale?: string;
  evidence?: string[];
  riskLevel?: 'high' | 'medium' | 'low';
  confidence?: number;
  firstStep?: string;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface GrowthSignal {
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

export interface GrowthComparison {
  id: string;
  title: string;
  insight: string;
  linkedQuadrants: GrowthQuadrantId[];
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
  confidence?: number;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface GrowthMove {
  id: string;
  title: string;
  category: 'scale-core' | 'enter-market' | 'build-product' | 'diversify' | 'validate-first';
  rationale: string;
  linkedOptionIds: string[];
  linkedQuadrants: GrowthQuadrantId[];
  expectedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  riskLevel: 'high' | 'medium' | 'low';
  confidence?: number;
  firstStep?: string;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface GrowthOutputCandidate extends ConsultingOutputCandidateBase {
  linkedOptionIds: string[];
  linkedQuadrants: GrowthQuadrantId[];
  readiness?: SWOTOutputReadiness;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface GrowthPathsData {
  context: ConsultingMissionContext;
  signals: GrowthSignal[];
  quadrants: {
    marketPenetration: GrowthPathItem[];
    marketDevelopment: GrowthPathItem[];
    productDevelopment: GrowthPathItem[];
    diversification: GrowthPathItem[];
  };
  comparisons: GrowthComparison[];
  recommendedMoves: GrowthMove[];
  outputCandidates: GrowthOutputCandidate[];
  summary?: ConsultingSummarySnapshot & {
    proposalId?: string;
    proposalStatus?: ProposalStatus;
    userComment?: string;
    keyInsights: string[];
    appliedConclusions: string[];
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
  rationale?: string;
  evidence?: string[];
  recommendation?: 'invest' | 'maintain' | 'test' | 'harvest' | 'stop';
  confidence?: number;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface PortfolioSignal {
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

export interface PortfolioTradeOff {
  id: string;
  title: string;
  insight: string;
  linkedItemIds: string[];
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
  confidence?: number;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface PortfolioMove {
  id: string;
  title: string;
  category: 'invest' | 'maintain' | 'test' | 'harvest' | 'stop';
  rationale: string;
  linkedItemIds: string[];
  expectedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  riskLevel: 'high' | 'medium' | 'low';
  confidence?: number;
  firstStep?: string;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface PortfolioOutputCandidate extends ConsultingOutputCandidateBase {
  linkedItemIds: string[];
  readiness?: SWOTOutputReadiness;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface PortfolioPriorityData {
  context: ConsultingMissionContext;
  signals: PortfolioSignal[];
  initiatives: PortfolioItem[];
  tradeOffs: PortfolioTradeOff[];
  recommendedMoves: PortfolioMove[];
  outputCandidates: PortfolioOutputCandidate[];
  summary?: ConsultingSummarySnapshot & {
    proposalId?: string;
    proposalStatus?: ProposalStatus;
    userComment?: string;
    keyInsights: string[];
    appliedConclusions: string[];
    recommendedInitiatives: InitiativeDraft[];
  };
}

// Risk & Uncertainty types
export interface RiskAssumption {
  id: string;
  text: string;
  confidence: number; // 1-5
  evidence?: string[];
  consequenceIfWrong?: string;
  validationMethod?: string;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface RiskItem {
  id: string;
  title?: string;
  description: string;
  probability: number; // 1-5
  impact: number; // 1-5
  mitigation: string;
  trigger?: string;
  owner?: string;
  evidence?: string[];
  confidence?: number;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface ScenarioItem {
  id: string;
  title: string;
  likelihood: number; // 1-5
  notes: string;
  posture?: 'base' | 'upside' | 'downside' | 'stress';
  signalsToWatch?: string[];
  response?: string;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface RiskSignal {
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

export interface RiskMove {
  id: string;
  title: string;
  category: 'validate' | 'mitigate' | 'monitor' | 'hedge' | 'escalate';
  rationale: string;
  linkedRiskIds: string[];
  linkedAssumptionIds: string[];
  expectedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  confidence?: number;
  firstStep?: string;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface RiskOutputCandidate extends ConsultingOutputCandidateBase {
  linkedRiskIds: string[];
  linkedScenarioIds: string[];
  readiness?: SWOTOutputReadiness;
  proposalStatus?: ProposalStatus;
  userComment?: string;
}

export interface RiskUncertaintyData {
  context: ConsultingMissionContext;
  signals: RiskSignal[];
  assumptions: RiskAssumption[];
  risks: RiskItem[];
  scenarios: ScenarioItem[];
  recommendedMoves: RiskMove[];
  outputCandidates: RiskOutputCandidate[];
  summary?: ConsultingSummarySnapshot & {
    proposalId?: string;
    proposalStatus?: ProposalStatus;
    userComment?: string;
    keyInsights: string[];
    appliedConclusions: string[];
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
  // Grounding metadata (O-C fix, 2026-07-09): optional so existing consumers
  // are unaffected; carries the AI's fact/hypothesis marking through to the
  // stored item instead of being dropped at parse time.
  confidence?: number;
  evidenceType?: 'fact' | 'observation' | 'assumption' | 'hypothesis';
  derivation?: string;
  rationale?: string;
  state?: 'proposed' | 'confirmed' | 'rejected';
  requires_evidence?: boolean;
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
    | ValueChainData
    | CapabilityMapperData
    | AmbitionDecomposerData
    | FocusTradeoffData
    | NarrativeEngineData
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
    namePl: 'Misja i kontekst',
    description: 'Define the strategic question, scope, success criteria, and decision frame',
    descriptionPl: 'Zdefiniuj pytanie strategiczne, zakres, kryteria sukcesu i ramę decyzji',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'input',
    name: 'Input & Exploration',
    namePl: 'Materiały i eksploracja',
    description: 'Capture interview notes, materials, and external context as shared signals',
    descriptionPl: 'Zbierz wywiad, materiały i kontekst zewnętrzny jako wspólne sygnały',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'swot',
    name: 'SWOT Build',
    namePl: 'Budowa SWOT',
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
    namePl: 'Synteza i wnioski',
    description: 'Convert the matrix into tensions, applied conclusions, and strategic moves',
    descriptionPl: 'Przekształć macierz w napięcia, wnioski aplikowalne i ruchy strategiczne',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'outputs',
    name: 'Outputs & Actions',
    namePl: 'Wyniki i działania',
    description: 'Prepare the final source summary and generate downstream outputs and initiatives',
    descriptionPl: 'Przygotuj final source summary oraz wygeneruj outputy i inicjatywy',
    required: true,
    aiAssisted: true,
  },
];

export const PORTER_STEPS: StepDefinition[] = [
  {
    id: 'mission',
    name: 'Mission & Market Context',
    namePl: 'Mission & Market Context',
    description: 'Define the market, scope, decision frame, and success signal',
    descriptionPl: 'Zdefiniuj rynek, zakres, ramę decyzji i sygnał sukcesu',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'input',
    name: 'Input & Exploration',
    namePl: 'Input & Exploration',
    description: 'Capture market evidence, interview notes, benchmarks, and competitive signals',
    descriptionPl: 'Zbierz dowody rynkowe, wywiad, benchmarki i sygnały konkurencyjne',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'forces',
    name: 'Five Forces Build',
    namePl: 'Five Forces Build',
    description: 'Turn signals into scored Porter forces with drivers, evidence, and confidence',
    descriptionPl: 'Zamień sygnały w ocenione siły Portera z driverami, dowodami i confidence',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'insights',
    name: 'Strategic Implications',
    namePl: 'Strategic Implications',
    description: 'Synthesize market structure into margin pressure, levers, and strategic moves',
    descriptionPl: 'Przekształć strukturę rynku w presję marży, dźwignie i ruchy strategiczne',
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

export const VALUE_CHAIN_STEPS: StepDefinition[] = [
  {
    id: 'mission',
    name: 'Mission & Scope',
    namePl: 'Misja i zakres',
    description:
      'Define the business, value chain scope, strategic positioning, and success signal',
    descriptionPl: 'Zdefiniuj biznes, zakres łańcucha wartości, pozycjonowanie i sygnał sukcesu',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'input',
    name: 'Input & Exploration',
    namePl: 'Wejście i eksploracja',
    description:
      'Capture cost, operations, and differentiation signals from context and interviews',
    descriptionPl: 'Zbierz sygnały kosztu, operacji i różnicowania z kontekstu i wywiadów',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'activities',
    name: 'Value Chain Build',
    namePl: 'Budowa łańcucha wartości',
    description: 'Map the 9 activities with cost contribution, value contribution, and margin role',
    descriptionPl: 'Zmapuj 9 aktywności wg kontrybucji kosztu, wartości i roli w marży',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'insights',
    name: 'Margin Levers & Moves',
    namePl: 'Dźwignie marży i ruchy',
    description:
      'Synthesize the chain into margin levers, a positioning verdict, and strategic moves',
    descriptionPl:
      'Przekształć łańcuch w dźwignie marży, werdykt pozycjonowania i ruchy strategiczne',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'outputs',
    name: 'Outputs & Actions',
    namePl: 'Wyniki i działania',
    description: 'Prepare the final source summary and generate downstream outputs and initiatives',
    descriptionPl: 'Przygotuj final source summary oraz wygeneruj wyniki i inicjatywy',
    required: true,
    aiAssisted: true,
  },
];

export const CAPABILITY_MAPPER_STEPS: StepDefinition[] = [
  {
    id: 'mission',
    name: 'Mission & Scope',
    namePl: 'Misja i zakres',
    description: 'Define the strategic priorities, capability domains, and success signal',
    descriptionPl: 'Zdefiniuj priorytety strategiczne, domeny zdolności i sygnał sukcesu',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'input',
    name: 'Input & Exploration',
    namePl: 'Wejście i eksploracja',
    description: 'Capture capability signals from context, interviews, and benchmarks',
    descriptionPl: 'Zbierz sygnały o zdolnościach z kontekstu, wywiadów i benchmarków',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'capabilities',
    name: 'Capability Map',
    namePl: 'Mapa zdolności',
    description: 'Score capabilities on current vs target maturity and strategic importance',
    descriptionPl: 'Oceń zdolności wg dojrzałości obecnej/docelowej i ważności strategicznej',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'insights',
    name: 'Gaps & Moves',
    namePl: 'Luki i ruchy',
    description: 'Synthesize maturity gaps into priorities and build/buy/partner moves',
    descriptionPl: 'Przekształć luki dojrzałości w priorytety i ruchy build/buy/partner',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'outputs',
    name: 'Outputs & Actions',
    namePl: 'Wyniki i działania',
    description: 'Prepare the final source summary and generate downstream outputs and initiatives',
    descriptionPl: 'Przygotuj final source summary oraz wygeneruj wyniki i inicjatywy',
    required: true,
    aiAssisted: true,
  },
];

export const AMBITION_DECOMPOSER_STEPS: StepDefinition[] = [
  {
    id: 'mission',
    name: 'Ambition & Scope',
    namePl: 'Ambicja i zakres',
    description: 'State the ambition, scope, time horizon, and success signal',
    descriptionPl: 'Określ ambicję, zakres, horyzont czasowy i sygnał sukcesu',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'input',
    name: 'Input & Exploration',
    namePl: 'Wejście i eksploracja',
    description: 'Capture signals that inform how the ambition can be decomposed',
    descriptionPl: 'Zbierz sygnały, jak rozłożyć ambicję na czynniki',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'themes',
    name: 'Strategic Themes',
    namePl: 'Tematy strategiczne',
    description: 'Decompose the ambition into strategic themes with measurable targets',
    descriptionPl: 'Rozłóż ambicję na tematy strategiczne z mierzalnymi celami',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'insights',
    name: 'Priorities & Moves',
    namePl: 'Priorytety i ruchy',
    description: 'Sequence themes into priorities and enabling strategic moves',
    descriptionPl: 'Ułóż tematy w priorytety i wspierające ruchy strategiczne',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'outputs',
    name: 'Outputs & Actions',
    namePl: 'Wyniki i działania',
    description: 'Prepare the final source summary and generate downstream outputs and initiatives',
    descriptionPl: 'Przygotuj final source summary oraz wygeneruj wyniki i inicjatywy',
    required: true,
    aiAssisted: true,
  },
];

export const FOCUS_TRADEOFF_STEPS: StepDefinition[] = [
  {
    id: 'mission',
    name: 'Focus Question & Criteria',
    namePl: 'Pytanie i kryteria',
    description: 'Frame the competing priorities, decision criteria, and success signal',
    descriptionPl: 'Określ konkurujące priorytety, kryteria decyzji i sygnał sukcesu',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'input',
    name: 'Input & Exploration',
    namePl: 'Wejście i eksploracja',
    description: 'Capture signals about the competing options and what matters',
    descriptionPl: 'Zbierz sygnały o konkurujących opcjach i tym, co się liczy',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'priorities',
    name: 'Score Priorities',
    namePl: 'Ocena priorytetów',
    description: 'Score competing priorities on value, effort, and strategic fit',
    descriptionPl: 'Oceń konkurujące priorytety wg wartości, wysiłku i dopasowania',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'insights',
    name: 'Trade-offs & Decision',
    namePl: 'Kompromisy i decyzja',
    description: 'Expose trade-offs and decide what to commit, sequence, or cut',
    descriptionPl: 'Pokaż kompromisy i zdecyduj, co podjąć, ułożyć w czasie lub odrzucić',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'outputs',
    name: 'Outputs & Actions',
    namePl: 'Wyniki i działania',
    description: 'Prepare the final source summary and generate downstream outputs and initiatives',
    descriptionPl: 'Przygotuj final source summary oraz wygeneruj wyniki i inicjatywy',
    required: true,
    aiAssisted: true,
  },
];

export const NARRATIVE_ENGINE_STEPS: StepDefinition[] = [
  {
    id: 'mission',
    name: 'Audience & Core Message',
    namePl: 'Audytorium i przekaz',
    description: 'Define the audience, the core message, and the success signal',
    descriptionPl: 'Określ audytorium, główny przekaz i sygnał sukcesu',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'input',
    name: 'Input & Exploration',
    namePl: 'Wejście i eksploracja',
    description: 'Capture proof points, audience insights, and supporting evidence',
    descriptionPl: 'Zbierz dowody, insighty o audytorium i materiał wspierający',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'pillars',
    name: 'Narrative Pillars',
    namePl: 'Filary narracji',
    description: 'Build message pillars, each with proof points and audience resonance',
    descriptionPl: 'Zbuduj filary przekazu z dowodami i rezonansem u audytorium',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'insights',
    name: 'Storyline & Moves',
    namePl: 'Narracja i ruchy',
    description: 'Weave pillars into a storyline arc and decide delivery moves',
    descriptionPl: 'Ułóż filary w łuk narracyjny i zdecyduj o ruchach przekazu',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'outputs',
    name: 'Outputs & Actions',
    namePl: 'Wyniki i działania',
    description: 'Prepare the final source summary and generate downstream outputs and initiatives',
    descriptionPl: 'Przygotuj final source summary oraz wygeneruj wyniki i inicjatywy',
    required: true,
    aiAssisted: true,
  },
];

export const GROWTH_PATHS_STEPS: StepDefinition[] = [
  {
    id: 'mission',
    name: 'Growth Mission & Context',
    namePl: 'Growth Mission & Context',
    description: 'Define the growth ambition, scope, constraints, and success signal',
    descriptionPl: 'Zdefiniuj ambicję wzrostu, zakres, ograniczenia i sygnał sukcesu',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'input',
    name: 'Input & Exploration',
    namePl: 'Input & Exploration',
    description:
      'Capture growth signals from interviews, organization context, and market evidence',
    descriptionPl: 'Zbierz sygnały wzrostu z wywiadów, kontekstu organizacji i rynku',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'options',
    name: 'Ansoff Options Build',
    namePl: 'Ansoff Options Build',
    description: 'Turn signals into growth options across the four Ansoff quadrants',
    descriptionPl: 'Zamień sygnały w opcje wzrostu w czterech polach Ansoffa',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'insights',
    name: 'Strategic Comparison',
    namePl: 'Strategic Comparison',
    description: 'Compare options, expose trade-offs, and select recommended growth moves',
    descriptionPl: 'Porównaj opcje, pokaż trade-offy i wybierz rekomendowane ruchy wzrostu',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'outputs',
    name: 'Outputs & Actions',
    namePl: 'Outputs & Actions',
    description: 'Prepare the final source summary and downstream growth initiatives',
    descriptionPl: 'Przygotuj final source summary oraz dalsze inicjatywy wzrostowe',
    required: true,
    aiAssisted: true,
  },
];

export const PORTFOLIO_PRIORITY_STEPS: StepDefinition[] = [
  {
    id: 'mission',
    name: 'Portfolio Mission & Context',
    namePl: 'Portfolio Mission & Context',
    description: 'Define the portfolio scope, decision frame, constraints, and success signal',
    descriptionPl: 'Zdefiniuj zakres portfolio, ramę decyzji, ograniczenia i sygnał sukcesu',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'input',
    name: 'Input & Exploration',
    namePl: 'Input & Exploration',
    description:
      'Capture portfolio evidence, constraints, performance signals, and sponsor context',
    descriptionPl: 'Zbierz dowody portfolio, ograniczenia, sygnały wyników i kontekst sponsora',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'items',
    name: 'Portfolio Items & Matrix',
    namePl: 'Portfolio Items & Matrix',
    description: 'Score portfolio items and classify them into BCG-style categories',
    descriptionPl: 'Oceń elementy portfolio i sklasyfikuj je w kategoriach BCG',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'insights',
    name: 'Trade-offs & Priorities',
    namePl: 'Trade-offs & Priorities',
    description: 'Synthesize trade-offs, portfolio bets, and recommended resource moves',
    descriptionPl: 'Syntezuj trade-offy, top bety i rekomendowane przesunięcia zasobów',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'outputs',
    name: 'Outputs & Actions',
    namePl: 'Outputs & Actions',
    description: 'Prepare the final source summary and downstream portfolio actions',
    descriptionPl: 'Przygotuj final source summary oraz dalsze działania portfolio',
    required: true,
    aiAssisted: true,
  },
];

export const RISK_UNCERTAINTY_STEPS: StepDefinition[] = [
  {
    id: 'mission',
    name: 'Risk Mission & Context',
    namePl: 'Risk Mission & Context',
    description: 'Define the decision, uncertainty scope, constraints, and success signal',
    descriptionPl: 'Zdefiniuj decyzję, zakres niepewności, ograniczenia i sygnał sukcesu',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'input',
    name: 'Input & Exploration',
    namePl: 'Input & Exploration',
    description: 'Capture weak signals, constraints, evidence, and uncertainty cues',
    descriptionPl: 'Zbierz słabe sygnały, ograniczenia, evidence i wskazówki niepewności',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'assumptions',
    name: 'Assumptions & Risk Map',
    namePl: 'Assumptions & Risk Map',
    description: 'Turn signals into assumptions, risks, and plausible scenarios',
    descriptionPl: 'Zamień sygnały w założenia, ryzyka i scenariusze',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'insights',
    name: 'Risk Synthesis',
    namePl: 'Risk Synthesis',
    description: 'Synthesize risk posture, early warnings, and recommended resilience moves',
    descriptionPl: 'Syntezuj postawę ryzyka, early warnings i rekomendowane ruchy odporności',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'outputs',
    name: 'Outputs & Actions',
    namePl: 'Outputs & Actions',
    description: 'Prepare the final source summary and downstream resilience actions',
    descriptionPl: 'Przygotuj final source summary oraz dalsze działania odporności',
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

// --- Wave 1 dedicated digital tool step flows (context -> 3 domain sections -> summary) ---

export const AI_DISCOVERY_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Discovery Context',
    namePl: 'Kontekst Odkrycia',
    description: 'Define the function, data landscape, and AI ambition',
    descriptionPl: 'Zdefiniuj funkcję, krajobraz danych i ambicję AI',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'use-cases',
    name: 'Use cases',
    namePl: "Case'y użycia",
    description: 'Shortlist candidate AI use cases by value and feasibility',
    descriptionPl: 'Wyselekcjonuj kandydujące case AI wg wartości i wykonalności',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'prerequisites',
    name: 'Prerequisites',
    namePl: 'Prerekwizyty',
    description: 'Capture data, skills, and platform prerequisites',
    descriptionPl: 'Zbierz prerekwizyty danych, kompetencji i platformy',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'pilot-plan',
    name: 'Pilot plan',
    namePl: 'Plan pilota',
    description: 'Define the first pilot, owners, and success signals',
    descriptionPl: 'Zdefiniuj pierwszy pilot, ownerów i sygnały sukcesu',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Summarize discovery and generate initiatives',
    descriptionPl: 'Podsumuj odkrycie i wygeneruj inicjatywy',
    required: true,
    aiAssisted: true,
  },
];

export const PAIN_EXPLORER_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Pain Context',
    namePl: 'Kontekst Bólu',
    description: 'Define the process, stakeholders, and pain surface',
    descriptionPl: 'Zdefiniuj proces, interesariuszy i powierzchnię bólu',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'problems',
    name: 'Problems',
    namePl: 'Problemy',
    description: 'Capture the observed problems and their symptoms',
    descriptionPl: 'Zbierz zaobserwowane problemy i ich objawy',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'hypotheses',
    name: 'Hypotheses',
    namePl: 'Hipotezy',
    description: 'Frame root-cause hypotheses to validate',
    descriptionPl: 'Sformułuj hipotezy przyczyn źródłowych do walidacji',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'evidence-gaps',
    name: 'Evidence gaps',
    namePl: 'Luki w dowodach',
    description: 'List the evidence still needed to confirm each hypothesis',
    descriptionPl: 'Wypisz dowody potrzebne do potwierdzenia każdej hipotezy',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Summarize pains and generate initiatives',
    descriptionPl: 'Podsumuj bóle i wygeneruj inicjatywy',
    required: true,
    aiAssisted: true,
  },
];

export const RPA_SCANNER_STEPS: StepDefinition[] = [
  {
    id: 'context',
    name: 'Automation Context',
    namePl: 'Kontekst Automatyzacji',
    description: 'Define the process family and automation goal',
    descriptionPl: 'Zdefiniuj rodzinę procesów i cel automatyzacji',
    required: true,
    aiAssisted: false,
  },
  {
    id: 'candidates',
    name: 'Candidates',
    namePl: 'Kandydaci',
    description: 'List candidate processes for RPA',
    descriptionPl: 'Wypisz procesy kandydujące do RPA',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'sizing',
    name: 'Sizing',
    namePl: 'Sizing',
    description: 'Size each candidate by volume, effort, and complexity',
    descriptionPl: 'Oszacuj każdego kandydata wg wolumenu, wysiłku i złożoności',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'backlog',
    name: 'Backlog',
    namePl: 'Backlog',
    description: 'Prioritize the automation backlog',
    descriptionPl: 'Spriorytetyzuj backlog automatyzacji',
    required: true,
    aiAssisted: true,
  },
  {
    id: 'summary',
    name: 'Summary & Initiatives',
    namePl: 'Podsumowanie i Inicjatywy',
    description: 'Summarize the scan and generate initiatives',
    descriptionPl: 'Podsumuj skan i wygeneruj inicjatywy',
    required: true,
    aiAssisted: true,
  },
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
    // RB-023: persisted lifecycle payload — resolves the step the user was on
    // when they last saved, so reopening a session restores it instead of
    // silently defaulting to step 1.
    wizardState?: { currentStep?: string } | null;
  }) => void;

  // Data updates
  updateInputData: (
    data: Partial<
      | SWOTData
      | PorterData
      | ValueChainData
      | CapabilityMapperData
      | AmbitionDecomposerData
      | FocusTradeoffData
      | NarrativeEngineData
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
    goal: '',
    scope: '',
    successSignal: '',
    timeframe: 'medium',
    constraints: '',
    assumptions: '',
    kpiTarget: '',
  },
  signals: [],
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
  implications: [],
  recommendedMoves: [],
  outputCandidates: [],
});

const makeValueActivity = (
  id: ValueActivityId,
  name: string,
  kind: ValueActivityKind
): ValueActivity => ({
  id,
  name,
  kind,
  costContribution: 'medium',
  valueContribution: 'medium',
  marginRole: 'neutral',
  drivers: [],
  evidence: [],
});

const createInitialValueChainData = (): ValueChainData => ({
  context: {
    industry: '',
    valueChainScope: '',
    position: 'undefined',
    goal: '',
    scope: '',
    successSignal: '',
    timeframe: 'medium',
    constraints: '',
    assumptions: '',
    kpiTarget: '',
  },
  signals: [],
  activities: {
    inboundLogistics: makeValueActivity('inboundLogistics', 'Inbound Logistics', 'primary'),
    operations: makeValueActivity('operations', 'Operations', 'primary'),
    outboundLogistics: makeValueActivity('outboundLogistics', 'Outbound Logistics', 'primary'),
    marketingSales: makeValueActivity('marketingSales', 'Marketing & Sales', 'primary'),
    service: makeValueActivity('service', 'Service', 'primary'),
    infrastructure: makeValueActivity('infrastructure', 'Firm Infrastructure', 'support'),
    hrManagement: makeValueActivity('hrManagement', 'HR Management', 'support'),
    technology: makeValueActivity('technology', 'Technology Development', 'support'),
    procurement: makeValueActivity('procurement', 'Procurement', 'support'),
  },
  levers: [],
  recommendedMoves: [],
  outputCandidates: [],
});

const createInitialNarrativeEngineData = (): NarrativeEngineData => ({
  context: {
    audience: '',
    coreMessage: '',
    goal: '',
    scope: '',
    successSignal: '',
    timeframe: 'medium',
    constraints: '',
    assumptions: '',
    kpiTarget: '',
  },
  signals: [],
  pillars: [],
  threads: [],
  recommendedMoves: [],
  outputCandidates: [],
});

const createInitialFocusTradeoffData = (): FocusTradeoffData => ({
  context: {
    competingPriorities: '',
    decisionCriteria: '',
    goal: '',
    scope: '',
    successSignal: '',
    timeframe: 'medium',
    constraints: '',
    assumptions: '',
    kpiTarget: '',
  },
  signals: [],
  priorities: [],
  tradeoffs: [],
  recommendedMoves: [],
  outputCandidates: [],
});

const createInitialAmbitionDecomposerData = (): AmbitionDecomposerData => ({
  context: {
    ambitionStatement: '',
    scope: '',
    goal: '',
    successSignal: '',
    timeframe: 'medium',
    constraints: '',
    assumptions: '',
    kpiTarget: '',
  },
  signals: [],
  themes: [],
  priorities: [],
  recommendedMoves: [],
  outputCandidates: [],
});

const createInitialCapabilityMapperData = (): CapabilityMapperData => ({
  context: {
    industry: '',
    capabilityDomains: '',
    strategicPriorities: '',
    goal: '',
    scope: '',
    successSignal: '',
    timeframe: 'medium',
    constraints: '',
    assumptions: '',
    kpiTarget: '',
  },
  signals: [],
  capabilities: [],
  gaps: [],
  recommendedMoves: [],
  outputCandidates: [],
});

const createInitialGrowthPathsData = (): GrowthPathsData => ({
  context: createConsultingMissionContext(),
  signals: [],
  quadrants: {
    marketPenetration: [],
    marketDevelopment: [],
    productDevelopment: [],
    diversification: [],
  },
  comparisons: [],
  recommendedMoves: [],
  outputCandidates: [],
});

const createInitialPortfolioPriorityData = (): PortfolioPriorityData => ({
  context: createConsultingMissionContext(),
  signals: [],
  initiatives: [],
  tradeOffs: [],
  recommendedMoves: [],
  outputCandidates: [],
});

const createInitialRiskUncertaintyData = (): RiskUncertaintyData => ({
  context: createConsultingMissionContext(),
  signals: [],
  assumptions: [],
  risks: [],
  scenarios: [],
  recommendedMoves: [],
  outputCandidates: [],
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

export const TOOL_STEP_DEFINITIONS: Record<ToolType, StepDefinition[]> = {
  'dynamic-swot': SWOT_STEPS,
  'market-forces': PORTER_STEPS,
  'growth-paths': GROWTH_PATHS_STEPS,
  'value-chain': VALUE_CHAIN_STEPS,
  'portfolio-priority': PORTFOLIO_PRIORITY_STEPS,
  'ambition-decomposer': AMBITION_DECOMPOSER_STEPS,
  'focus-tradeoff': FOCUS_TRADEOFF_STEPS,
  'risk-uncertainty': RISK_UNCERTAINTY_STEPS,
  'capability-mapper': CAPABILITY_MAPPER_STEPS,
  'narrative-engine': NARRATIVE_ENGINE_STEPS,
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
  'rpa-scanner': RPA_SCANNER_STEPS,
  'ai-discovery': AI_DISCOVERY_STEPS,
  'integration-diagnostic': TOOLSET_DIGITAL_STEPS,
  'digital-value-pool': TOOLSET_DIGITAL_STEPS,
  'legacy-analyzer': TOOLSET_DIGITAL_STEPS,
  'data-inventory': TOOLSET_DIGITAL_STEPS,
  'pain-to-solution': TOOLSET_DIGITAL_STEPS,
  'pain-explorer': PAIN_EXPLORER_STEPS,
  'process-automation': PROCESS_AUTOMATION_STEPS,
};

const TOOL_INITIAL_DATA: Record<
  ToolType,
  | SWOTData
  | PorterData
  | ValueChainData
  | CapabilityMapperData
  | AmbitionDecomposerData
  | FocusTradeoffData
  | NarrativeEngineData
  | GrowthPathsData
  | PortfolioPriorityData
  | RiskUncertaintyData
  | OperationalToolData
  | Record<string, unknown>
> = {
  'dynamic-swot': createInitialSWOTData(),
  'market-forces': createInitialPorterData(),
  'growth-paths': createInitialGrowthPathsData(),
  'value-chain': createInitialValueChainData(),
  'portfolio-priority': createInitialPortfolioPriorityData(),
  'ambition-decomposer': createInitialAmbitionDecomposerData(),
  'focus-tradeoff': createInitialFocusTradeoffData(),
  'risk-uncertainty': createInitialRiskUncertaintyData(),
  'capability-mapper': createInitialCapabilityMapperData(),
  'narrative-engine': createInitialNarrativeEngineData(),
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
  'rpa-scanner': createInitialToolsetFlowData(['candidates', 'sizing', 'backlog']),
  'ai-discovery': createInitialToolsetFlowData(['use-cases', 'prerequisites', 'pilot-plan']),
  'integration-diagnostic': createInitialToolsetFlowData(['fill']),
  'digital-value-pool': createInitialToolsetFlowData(['fill']),
  'legacy-analyzer': createInitialToolsetFlowData(['fill']),
  'data-inventory': createInitialToolsetFlowData(['fill']),
  'pain-to-solution': createInitialToolsetFlowData(['fill']),
  'pain-explorer': createInitialToolsetFlowData(['problems', 'hypotheses', 'evidence-gaps']),
  'process-automation': createInitialToolsetFlowData(['process-mapping', 'redesign']),
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const normalizeCanonicalStatus = (status?: string | null): CanonicalToolSessionStatus => {
  const normalized = String(status || 'DRAFT')
    .trim()
    .toUpperCase();
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

const normalizePorterData = (input: PorterData): PorterData => {
  const initial = createInitialPorterData();
  return {
    ...initial,
    ...input,
    context: {
      ...initial.context,
      ...(input.context || {}),
    },
    signals: (input.signals || []).map((signal) => ({
      ...signal,
      evidenceType: signal.evidenceType || (signal.type === 'benchmark' ? 'fact' : 'observation'),
      state: signal.state || (signal.type === 'ai' ? 'proposed' : 'accepted'),
      provenance: signal.provenance || signal.sourceLabel,
      proposalStatus: signal.proposalStatus || (signal.type === 'ai' ? 'ai-proposed' : 'accepted'),
    })),
    forces: (Object.keys(initial.forces) as PorterForceId[]).reduce<PorterData['forces']>(
      (acc, forceId) => {
        const current = input.forces?.[forceId];
        acc[forceId] = {
          ...initial.forces[forceId],
          ...current,
          drivers: current?.drivers || [],
          evidence: current?.evidence || [],
          proposalStatus: current?.proposalStatus || 'accepted',
        };
        return acc;
      },
      { ...initial.forces }
    ),
    implications: (input.implications || []).map((implication) => ({
      ...implication,
      proposalStatus: implication.proposalStatus || 'accepted',
    })),
    recommendedMoves: (input.recommendedMoves || []).map((move) => ({
      ...move,
      proposalStatus: move.proposalStatus || 'accepted',
    })),
    outputCandidates: (input.outputCandidates || []).map((candidate) => ({
      ...candidate,
      readiness: candidate.readiness || 'keep-as-idea',
      proposalStatus: candidate.proposalStatus || 'accepted',
    })),
  };
};

const normalizeGrowthPathsData = (input: GrowthPathsData): GrowthPathsData => {
  const initial = createInitialGrowthPathsData();
  const quadrants = {
    ...initial.quadrants,
    ...(input.quadrants || {}),
  };
  return {
    ...initial,
    ...input,
    context: {
      ...initial.context,
      ...(input.context || {}),
    },
    signals: (input.signals || []).map((signal) => ({
      ...signal,
      evidenceType: signal.evidenceType || (signal.type === 'benchmark' ? 'fact' : 'observation'),
      state: signal.state || (signal.type === 'ai' ? 'proposed' : 'accepted'),
      provenance: signal.provenance || signal.sourceLabel,
      proposalStatus: signal.proposalStatus || (signal.type === 'ai' ? 'ai-proposed' : 'accepted'),
    })),
    quadrants: (Object.keys(initial.quadrants) as GrowthQuadrantId[]).reduce<
      GrowthPathsData['quadrants']
    >(
      (acc, quadrant) => {
        acc[quadrant] = (quadrants[quadrant] || []).map((option) => ({
          ...option,
          quadrant: option.quadrant || quadrant,
          evidence: option.evidence || [],
          riskLevel: option.riskLevel || 'medium',
          confidence: option.confidence ?? 3,
          proposalStatus: option.proposalStatus || 'accepted',
        }));
        return acc;
      },
      { ...initial.quadrants }
    ),
    comparisons: (input.comparisons || []).map((comparison) => ({
      ...comparison,
      linkedQuadrants: comparison.linkedQuadrants || [],
      priority: comparison.priority || 'medium',
      proposalStatus: comparison.proposalStatus || 'accepted',
    })),
    recommendedMoves: (input.recommendedMoves || []).map((move) => ({
      ...move,
      linkedOptionIds: move.linkedOptionIds || [],
      linkedQuadrants: move.linkedQuadrants || [],
      proposalStatus: move.proposalStatus || 'accepted',
    })),
    outputCandidates: (input.outputCandidates || []).map((candidate) => ({
      ...candidate,
      linkedOptionIds: candidate.linkedOptionIds || [],
      linkedQuadrants: candidate.linkedQuadrants || [],
      readiness: candidate.readiness || 'keep-as-idea',
      proposalStatus: candidate.proposalStatus || 'accepted',
    })),
    summary: input.summary
      ? {
          ...input.summary,
          keyInsights: input.summary.keyInsights || [],
          appliedConclusions: input.summary.appliedConclusions || [],
          recommendedInitiatives: input.summary.recommendedInitiatives || [],
          proposalStatus: input.summary.proposalStatus || 'accepted',
        }
      : undefined,
  };
};

const updateGrowthProposalCard = (
  growthData: GrowthPathsData,
  cardType: ProposalCardType,
  cardId: string,
  updates: Record<string, unknown>
): GrowthPathsData => {
  const updateList = <T extends { id: string }>(items: T[]) =>
    items.map((item) => (item.id === cardId ? ({ ...item, ...updates } as T) : item));

  if (cardType === 'signal') {
    return { ...growthData, signals: updateList(growthData.signals) };
  }

  if (cardType === 'item') {
    const quadrants = { ...growthData.quadrants };
    (Object.keys(quadrants) as GrowthQuadrantId[]).forEach((quadrant) => {
      quadrants[quadrant] = updateList(quadrants[quadrant]);
    });
    return { ...growthData, quadrants };
  }

  if (cardType === 'tension' || cardType === 'correlation') {
    return { ...growthData, comparisons: updateList(growthData.comparisons) };
  }

  if (cardType === 'move') {
    return { ...growthData, recommendedMoves: updateList(growthData.recommendedMoves) };
  }

  if (cardType === 'output-candidate') {
    return { ...growthData, outputCandidates: updateList(growthData.outputCandidates) };
  }

  if (cardType === 'conclusion' && growthData.summary) {
    return {
      ...growthData,
      summary: {
        ...growthData.summary,
        ...updates,
      },
    };
  }

  return growthData;
};

const getPortfolioCategory = (growth: number, share: number): PortfolioItem['category'] => {
  if (growth >= 4 && share >= 4) return 'star';
  if (growth >= 4 && share < 4) return 'question-mark';
  if (growth < 4 && share >= 4) return 'cash-cow';
  return 'dog';
};

const normalizePortfolioPriorityData = (input: PortfolioPriorityData): PortfolioPriorityData => {
  const initial = createInitialPortfolioPriorityData();
  return {
    ...initial,
    ...input,
    context: {
      ...initial.context,
      ...(input.context || {}),
    },
    signals: (input.signals || []).map((signal) => ({
      ...signal,
      evidenceType: signal.evidenceType || (signal.type === 'benchmark' ? 'fact' : 'observation'),
      state: signal.state || (signal.type === 'ai' ? 'proposed' : 'accepted'),
      provenance: signal.provenance || signal.sourceLabel,
      proposalStatus: signal.proposalStatus || (signal.type === 'ai' ? 'ai-proposed' : 'accepted'),
    })),
    initiatives: (input.initiatives || []).map((item) => ({
      ...item,
      marketGrowth: item.marketGrowth ?? 3,
      marketShare: item.marketShare ?? 3,
      investmentLevel: item.investmentLevel ?? 3,
      category:
        item.category || getPortfolioCategory(item.marketGrowth ?? 3, item.marketShare ?? 3),
      evidence: item.evidence || [],
      confidence: item.confidence ?? 3,
      proposalStatus: item.proposalStatus || 'accepted',
    })),
    tradeOffs: (input.tradeOffs || []).map((tradeOff) => ({
      ...tradeOff,
      linkedItemIds: tradeOff.linkedItemIds || [],
      priority: tradeOff.priority || 'medium',
      proposalStatus: tradeOff.proposalStatus || 'accepted',
    })),
    recommendedMoves: (input.recommendedMoves || []).map((move) => ({
      ...move,
      linkedItemIds: move.linkedItemIds || [],
      proposalStatus: move.proposalStatus || 'accepted',
    })),
    outputCandidates: (input.outputCandidates || []).map((candidate) => ({
      ...candidate,
      linkedItemIds: candidate.linkedItemIds || [],
      readiness: candidate.readiness || 'keep-as-idea',
      proposalStatus: candidate.proposalStatus || 'accepted',
    })),
    summary: input.summary
      ? {
          ...input.summary,
          keyInsights: input.summary.keyInsights || [],
          appliedConclusions: input.summary.appliedConclusions || [],
          recommendedInitiatives: input.summary.recommendedInitiatives || [],
          proposalStatus: input.summary.proposalStatus || 'accepted',
        }
      : undefined,
  };
};

const updatePortfolioProposalCard = (
  portfolioData: PortfolioPriorityData,
  cardType: ProposalCardType,
  cardId: string,
  updates: Record<string, unknown>
): PortfolioPriorityData => {
  const updateList = <T extends { id: string }>(items: T[]) =>
    items.map((item) => (item.id === cardId ? ({ ...item, ...updates } as T) : item));

  if (cardType === 'signal')
    return { ...portfolioData, signals: updateList(portfolioData.signals) };
  if (cardType === 'item')
    return { ...portfolioData, initiatives: updateList(portfolioData.initiatives) };
  if (cardType === 'tension' || cardType === 'correlation')
    return { ...portfolioData, tradeOffs: updateList(portfolioData.tradeOffs) };
  if (cardType === 'move')
    return { ...portfolioData, recommendedMoves: updateList(portfolioData.recommendedMoves) };
  if (cardType === 'output-candidate')
    return { ...portfolioData, outputCandidates: updateList(portfolioData.outputCandidates) };
  if (cardType === 'conclusion' && portfolioData.summary) {
    return { ...portfolioData, summary: { ...portfolioData.summary, ...updates } };
  }
  return portfolioData;
};

const normalizeRiskUncertaintyData = (input: RiskUncertaintyData): RiskUncertaintyData => {
  const initial = createInitialRiskUncertaintyData();
  return {
    ...initial,
    ...input,
    context: {
      ...initial.context,
      ...(input.context || {}),
    },
    signals: (input.signals || []).map((signal) => ({
      ...signal,
      evidenceType: signal.evidenceType || (signal.type === 'benchmark' ? 'fact' : 'observation'),
      state: signal.state || (signal.type === 'ai' ? 'proposed' : 'accepted'),
      provenance: signal.provenance || signal.sourceLabel,
      proposalStatus: signal.proposalStatus || (signal.type === 'ai' ? 'ai-proposed' : 'accepted'),
    })),
    assumptions: (input.assumptions || []).map((assumption) => ({
      ...assumption,
      confidence: assumption.confidence ?? 3,
      evidence: assumption.evidence || [],
      proposalStatus: assumption.proposalStatus || 'accepted',
    })),
    risks: (input.risks || []).map((risk) => ({
      ...risk,
      probability: risk.probability ?? 3,
      impact: risk.impact ?? 3,
      mitigation: risk.mitigation || '',
      evidence: risk.evidence || [],
      confidence: risk.confidence ?? 3,
      proposalStatus: risk.proposalStatus || 'accepted',
    })),
    scenarios: (input.scenarios || []).map((scenario) => ({
      ...scenario,
      likelihood: scenario.likelihood ?? 3,
      posture: scenario.posture || 'base',
      signalsToWatch: scenario.signalsToWatch || [],
      proposalStatus: scenario.proposalStatus || 'accepted',
    })),
    recommendedMoves: (input.recommendedMoves || []).map((move) => ({
      ...move,
      linkedRiskIds: move.linkedRiskIds || [],
      linkedAssumptionIds: move.linkedAssumptionIds || [],
      proposalStatus: move.proposalStatus || 'accepted',
    })),
    outputCandidates: (input.outputCandidates || []).map((candidate) => ({
      ...candidate,
      linkedRiskIds: candidate.linkedRiskIds || [],
      linkedScenarioIds: candidate.linkedScenarioIds || [],
      readiness: candidate.readiness || 'keep-as-idea',
      proposalStatus: candidate.proposalStatus || 'accepted',
    })),
    summary: input.summary
      ? {
          ...input.summary,
          keyInsights: input.summary.keyInsights || [],
          appliedConclusions: input.summary.appliedConclusions || [],
          recommendedInitiatives: input.summary.recommendedInitiatives || [],
          proposalStatus: input.summary.proposalStatus || 'accepted',
        }
      : undefined,
  };
};

const updateRiskProposalCard = (
  riskData: RiskUncertaintyData,
  cardType: ProposalCardType,
  cardId: string,
  updates: Record<string, unknown>
): RiskUncertaintyData => {
  const updateList = <T extends { id: string }>(items: T[]) =>
    items.map((item) => (item.id === cardId ? ({ ...item, ...updates } as T) : item));

  if (cardType === 'signal') return { ...riskData, signals: updateList(riskData.signals) };
  if (cardType === 'item')
    return {
      ...riskData,
      assumptions: updateList(riskData.assumptions),
      risks: updateList(riskData.risks),
      scenarios: updateList(riskData.scenarios),
    };
  if (cardType === 'tension' || cardType === 'move')
    return { ...riskData, recommendedMoves: updateList(riskData.recommendedMoves) };
  if (cardType === 'output-candidate')
    return { ...riskData, outputCandidates: updateList(riskData.outputCandidates) };
  if (cardType === 'conclusion' && riskData.summary) {
    return { ...riskData, summary: { ...riskData.summary, ...updates } };
  }
  return riskData;
};

const mergeToolAnswersWithInitialData = (
  toolType: ToolType,
  answers: Record<string, unknown>
):
  | SWOTData
  | PorterData
  | ValueChainData
  | CapabilityMapperData
  | AmbitionDecomposerData
  | FocusTradeoffData
  | NarrativeEngineData
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

  if (toolType === 'market-forces') {
    return normalizePorterData(merged as PorterData);
  }

  if (toolType === 'growth-paths') {
    return normalizeGrowthPathsData(merged as GrowthPathsData);
  }

  if (toolType === 'portfolio-priority') {
    return normalizePortfolioPriorityData(merged as PortfolioPriorityData);
  }

  if (toolType === 'risk-uncertainty') {
    return normalizeRiskUncertaintyData(merged as RiskUncertaintyData);
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

    if (toolType === 'market-forces') {
      const porterAnswers = normalizePorterData(answers as PorterData);

      if (stepId === 'mission') {
        return porterAnswers.context?.industry && porterAnswers.context?.geographicScope
          ? 'completed'
          : 'pending';
      }

      if (stepId === 'input') {
        return (porterAnswers.signals?.length || 0) > 0 ? 'completed' : 'pending';
      }

      if (stepId === 'forces') {
        return (Object.values(porterAnswers.forces || {}) as ForceData[]).every(
          (force) => (force.drivers?.length || 0) > 0
        )
          ? 'completed'
          : 'pending';
      }

      if (stepId === 'insights') {
        return (porterAnswers.implications?.length || 0) > 0 ||
          (porterAnswers.recommendedMoves?.length || 0) > 0 ||
          (porterAnswers.summary?.appliedConclusions?.length || 0) > 0
          ? 'completed'
          : 'pending';
      }

      if (stepId === 'outputs') {
        return porterAnswers.summary?.executiveSummary ||
          (porterAnswers.summary?.keyInsights?.length || 0) > 0 ||
          (porterAnswers.outputCandidates?.length || 0) > 0
          ? 'completed'
          : 'pending';
      }
    }

    if (toolType === 'growth-paths') {
      const growthAnswers = normalizeGrowthPathsData(answers as GrowthPathsData);

      if (stepId === 'mission') {
        return growthAnswers.context?.goal && growthAnswers.context?.scope
          ? 'completed'
          : 'pending';
      }

      if (stepId === 'input') {
        return (growthAnswers.signals?.length || 0) > 0 ? 'completed' : 'pending';
      }

      if (stepId === 'options') {
        return Object.values(growthAnswers.quadrants || {}).some(
          (items) => (items?.length || 0) > 0
        )
          ? 'completed'
          : 'pending';
      }

      if (stepId === 'insights') {
        return (growthAnswers.comparisons?.length || 0) > 0 ||
          (growthAnswers.recommendedMoves?.length || 0) > 0 ||
          (growthAnswers.summary?.appliedConclusions?.length || 0) > 0
          ? 'completed'
          : 'pending';
      }

      if (stepId === 'outputs') {
        return growthAnswers.summary?.executiveSummary ||
          (growthAnswers.summary?.keyInsights?.length || 0) > 0 ||
          (growthAnswers.outputCandidates?.length || 0) > 0
          ? 'completed'
          : 'pending';
      }
    }

    if (toolType === 'portfolio-priority') {
      const portfolioAnswers = normalizePortfolioPriorityData(answers as PortfolioPriorityData);

      if (stepId === 'mission') {
        return portfolioAnswers.context?.goal &&
          portfolioAnswers.context?.scope &&
          portfolioAnswers.context?.successSignal
          ? 'completed'
          : 'pending';
      }

      if (stepId === 'input') {
        return (portfolioAnswers.signals?.length || 0) > 0 ? 'completed' : 'pending';
      }

      if (stepId === 'items') {
        return (portfolioAnswers.initiatives?.length || 0) > 0 ? 'completed' : 'pending';
      }

      if (stepId === 'insights') {
        return (portfolioAnswers.tradeOffs?.length || 0) > 0 ||
          (portfolioAnswers.recommendedMoves?.length || 0) > 0 ||
          (portfolioAnswers.summary?.appliedConclusions?.length || 0) > 0
          ? 'completed'
          : 'pending';
      }

      if (stepId === 'outputs') {
        return portfolioAnswers.summary?.executiveSummary ||
          (portfolioAnswers.summary?.keyInsights?.length || 0) > 0 ||
          (portfolioAnswers.outputCandidates?.length || 0) > 0
          ? 'completed'
          : 'pending';
      }
    }

    if (toolType === 'risk-uncertainty') {
      const riskAnswers = normalizeRiskUncertaintyData(answers as RiskUncertaintyData);

      if (stepId === 'mission') {
        return riskAnswers.context?.goal &&
          riskAnswers.context?.scope &&
          riskAnswers.context?.successSignal
          ? 'completed'
          : 'pending';
      }

      if (stepId === 'input') {
        return (riskAnswers.signals?.length || 0) > 0 ? 'completed' : 'pending';
      }

      if (stepId === 'assumptions') {
        return (riskAnswers.assumptions?.length || 0) > 0 ||
          (riskAnswers.risks?.length || 0) > 0 ||
          (riskAnswers.scenarios?.length || 0) > 0
          ? 'completed'
          : 'pending';
      }

      if (stepId === 'insights') {
        return (riskAnswers.recommendedMoves?.length || 0) > 0 ||
          (riskAnswers.summary?.appliedConclusions?.length || 0) > 0
          ? 'completed'
          : 'pending';
      }

      if (stepId === 'outputs') {
        return riskAnswers.summary?.executiveSummary ||
          (riskAnswers.summary?.keyInsights?.length || 0) > 0 ||
          (riskAnswers.outputCandidates?.length || 0) > 0
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

  if (session.toolType === 'market-forces') {
    const inputData = normalizePorterData(normalizedBase.inputData as PorterData);
    return {
      ...normalizedBase,
      inputData,
      steps: buildToolSteps('market-forces', inputData),
    };
  }

  if (session.toolType === 'growth-paths') {
    const inputData = normalizeGrowthPathsData(normalizedBase.inputData as GrowthPathsData);
    return {
      ...normalizedBase,
      inputData,
      steps: buildToolSteps('growth-paths', inputData),
    };
  }

  if (session.toolType === 'portfolio-priority') {
    const inputData = normalizePortfolioPriorityData(
      normalizedBase.inputData as PortfolioPriorityData
    );
    return {
      ...normalizedBase,
      inputData,
      steps: buildToolSteps('portfolio-priority', inputData),
    };
  }

  if (session.toolType === 'risk-uncertainty') {
    const inputData = normalizeRiskUncertaintyData(normalizedBase.inputData as RiskUncertaintyData);
    return {
      ...normalizedBase,
      inputData,
      steps: buildToolSteps('risk-uncertainty', inputData),
    };
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

        if (currentSession.toolType === 'market-forces') {
          const porterData = normalizePorterData(currentSession.inputData as PorterData);

          if (stepDef.id === 'mission') {
            return Boolean(porterData.context?.industry && porterData.context?.geographicScope);
          }

          if (stepDef.id === 'input') {
            return (porterData.signals?.length || 0) > 0;
          }

          if (stepDef.id === 'forces') {
            return (Object.values(porterData.forces || {}) as ForceData[]).every(
              (force) => (force.drivers?.length || 0) > 0
            );
          }

          if (stepDef.id === 'insights') {
            return (
              (porterData.implications?.length || 0) > 0 ||
              (porterData.recommendedMoves?.length || 0) > 0 ||
              (porterData.summary?.appliedConclusions?.length || 0) > 0
            );
          }

          if (stepDef.id === 'outputs') {
            return Boolean(
              porterData.summary?.executiveSummary ||
              (porterData.summary?.keyInsights?.length || 0) > 0 ||
              (porterData.outputCandidates?.length || 0) > 0
            );
          }
        }

        if (currentSession.toolType === 'growth-paths') {
          const growthData = normalizeGrowthPathsData(currentSession.inputData as GrowthPathsData);

          if (stepDef.id === 'mission') {
            return Boolean(
              growthData.context?.goal &&
              growthData.context?.scope &&
              growthData.context?.successSignal
            );
          }

          if (stepDef.id === 'input') {
            return (growthData.signals?.length || 0) > 0;
          }

          if (stepDef.id === 'options') {
            return Object.values(growthData.quadrants || {}).some(
              (items) => (items?.length || 0) > 0
            );
          }

          if (stepDef.id === 'insights') {
            return (
              (growthData.comparisons?.length || 0) > 0 ||
              (growthData.recommendedMoves?.length || 0) > 0 ||
              (growthData.summary?.appliedConclusions?.length || 0) > 0
            );
          }

          if (stepDef.id === 'outputs') {
            return Boolean(
              growthData.summary?.executiveSummary ||
              (growthData.summary?.keyInsights?.length || 0) > 0 ||
              (growthData.outputCandidates?.length || 0) > 0
            );
          }
        }

        if (currentSession.toolType === 'portfolio-priority') {
          const portfolioData = normalizePortfolioPriorityData(
            currentSession.inputData as PortfolioPriorityData
          );

          if (stepDef.id === 'mission') {
            return Boolean(
              portfolioData.context?.goal &&
              portfolioData.context?.scope &&
              portfolioData.context?.successSignal
            );
          }

          if (stepDef.id === 'input') {
            return (portfolioData.signals?.length || 0) > 0;
          }

          if (stepDef.id === 'items') {
            return (portfolioData.initiatives?.length || 0) > 0;
          }

          if (stepDef.id === 'insights') {
            return (
              (portfolioData.tradeOffs?.length || 0) > 0 ||
              (portfolioData.recommendedMoves?.length || 0) > 0 ||
              (portfolioData.summary?.appliedConclusions?.length || 0) > 0
            );
          }

          if (stepDef.id === 'outputs') {
            return Boolean(
              portfolioData.summary?.executiveSummary ||
              (portfolioData.summary?.keyInsights?.length || 0) > 0 ||
              (portfolioData.outputCandidates?.length || 0) > 0
            );
          }
        }

        if (currentSession.toolType === 'risk-uncertainty') {
          const riskData = normalizeRiskUncertaintyData(
            currentSession.inputData as RiskUncertaintyData
          );

          if (stepDef.id === 'mission') {
            return Boolean(
              riskData.context?.goal && riskData.context?.scope && riskData.context?.successSignal
            );
          }

          if (stepDef.id === 'input') {
            return (riskData.signals?.length || 0) > 0;
          }

          if (stepDef.id === 'assumptions') {
            return (
              (riskData.assumptions?.length || 0) > 0 ||
              (riskData.risks?.length || 0) > 0 ||
              (riskData.scenarios?.length || 0) > 0
            );
          }

          if (stepDef.id === 'insights') {
            return (
              (riskData.recommendedMoves?.length || 0) > 0 ||
              (riskData.summary?.appliedConclusions?.length || 0) > 0
            );
          }

          if (stepDef.id === 'outputs') {
            return Boolean(
              riskData.summary?.executiveSummary ||
              (riskData.summary?.keyInsights?.length || 0) > 0 ||
              (riskData.outputCandidates?.length || 0) > 0
            );
          }
        }

        // Context step: check if required fields are filled
        if (stepDef.id === 'context') {
          const data = currentSession.inputData as
            | SWOTData
            | PorterData
            | ValueChainData
            | CapabilityMapperData
            | AmbitionDecomposerData
            | FocusTradeoffData
            | NarrativeEngineData
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
        // RB-023: resolve the persisted step. Prefer an explicit numeric
        // currentStep (legacy/back-compat callers); otherwise resolve the
        // wizardState step-id string persisted by ToolDocumentView against
        // this tool's own step definitions so reopen lands on the same step.
        const wizardStepId = payload.wizardState?.currentStep;
        const wizardStepIndex = wizardStepId
          ? steps.findIndex((step) => step.id === wizardStepId) + 1
          : 0;
        const currentStepFromApi =
          typeof (payload as any).currentStep === 'number'
            ? (payload as any).currentStep
            : wizardStepIndex > 0
              ? wizardStepIndex
              : 1;

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
            : currentSession.toolType === 'market-forces'
              ? normalizePorterData(mergedInputData as PorterData)
              : currentSession.toolType === 'growth-paths'
                ? normalizeGrowthPathsData(mergedInputData as GrowthPathsData)
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
        if (!currentSession) return;
        if (currentSession.toolType === 'risk-uncertainty') {
          const riskData = normalizeRiskUncertaintyData(
            currentSession.inputData as RiskUncertaintyData
          );
          const updated = updateRiskProposalCard(riskData, cardType, cardId, {
            proposalStatus: 'accepted' as ProposalStatus,
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType === 'portfolio-priority') {
          const portfolioData = normalizePortfolioPriorityData(
            currentSession.inputData as PortfolioPriorityData
          );
          const updated = updatePortfolioProposalCard(portfolioData, cardType, cardId, {
            proposalStatus: 'accepted' as ProposalStatus,
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType === 'growth-paths') {
          const growthData = normalizeGrowthPathsData(currentSession.inputData as GrowthPathsData);
          const updated = updateGrowthProposalCard(growthData, cardType, cardId, {
            proposalStatus: 'accepted' as ProposalStatus,
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType === 'market-forces') {
          const porterData = normalizePorterData(currentSession.inputData as PorterData);
          const update = (arr: any[]) =>
            arr.map((item: any) =>
              item.id === cardId ? { ...item, proposalStatus: 'accepted' as ProposalStatus } : item
            );
          const updated: Partial<PorterData> = {};
          if (cardType === 'signal') updated.signals = update(porterData.signals);
          else if (cardType === 'item') {
            updated.forces = { ...porterData.forces };
            if (updated.forces[cardId as PorterForceId]) {
              updated.forces[cardId as PorterForceId] = {
                ...updated.forces[cardId as PorterForceId],
                proposalStatus: 'accepted',
              };
            }
          } else if (cardType === 'tension') updated.implications = update(porterData.implications);
          else if (cardType === 'move')
            updated.recommendedMoves = update(porterData.recommendedMoves);
          else if (cardType === 'output-candidate')
            updated.outputCandidates = update(porterData.outputCandidates);
          else if (cardType === 'conclusion' && porterData.summary) {
            updated.summary = {
              ...porterData.summary,
              proposalStatus: 'accepted' as ProposalStatus,
            };
          }
          set({
            currentSession: withRecomputedSteps(currentSession, { ...porterData, ...updated }),
          });
          return;
        }
        if (currentSession.toolType !== 'dynamic-swot') return;
        const swotData = normalizeDynamicSwotData(currentSession.inputData as SWOTData);
        const update = (arr: any[]) =>
          arr.map((item: any) =>
            item.id === cardId ? { ...item, proposalStatus: 'accepted' as ProposalStatus } : item
          );
        const updated: Partial<SWOTData> = {};
        if (cardType === 'signal') updated.signals = update(swotData.signals);
        else if (cardType === 'item') {
          // STREAM G1: routed through the ONE canonical accept gate
          // (config/swot/swotAcceptGate.ts) — same function the Build Phase
          // UI and the server's swot-proposals accept endpoint use. Blocks
          // (no mutation) on structural defects or an unvalidated
          // externally-claimed classification; otherwise stamps
          // evidenceStatus honestly (confirmed/declared), never blocking on
          // that axis alone.
          updated.items = swotData.items.map((item) => {
            if (item.id !== cardId) return item;
            const gate = evaluateSwotAcceptGate(item);
            if (!gate.ok) return item;
            return stampAcceptedSwotItem(item, gate);
          });
        } else if (cardType === 'tension') updated.tensions = update(swotData.tensions);
        else if (cardType === 'move') updated.recommendedMoves = update(swotData.recommendedMoves);
        else if (cardType === 'correlation') updated.correlations = update(swotData.correlations);
        else if ((cardType as ProposalCardType) === 'output-candidate')
          updated.outputCandidates = update(swotData.outputCandidates);
        else if (cardType === 'conclusion' && swotData.summary) {
          updated.summary = { ...swotData.summary, proposalStatus: 'accepted' as ProposalStatus };
        }
        set({ currentSession: withRecomputedSteps(currentSession, { ...swotData, ...updated }) });
      },

      rejectCard: (cardType, cardId) => {
        const { currentSession } = get();
        if (!currentSession) return;
        if (currentSession.toolType === 'risk-uncertainty') {
          const riskData = normalizeRiskUncertaintyData(
            currentSession.inputData as RiskUncertaintyData
          );
          const updated = updateRiskProposalCard(riskData, cardType, cardId, {
            proposalStatus: 'rejected' as ProposalStatus,
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType === 'portfolio-priority') {
          const portfolioData = normalizePortfolioPriorityData(
            currentSession.inputData as PortfolioPriorityData
          );
          const updated = updatePortfolioProposalCard(portfolioData, cardType, cardId, {
            proposalStatus: 'rejected' as ProposalStatus,
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType === 'growth-paths') {
          const growthData = normalizeGrowthPathsData(currentSession.inputData as GrowthPathsData);
          const updated = updateGrowthProposalCard(growthData, cardType, cardId, {
            proposalStatus: 'rejected' as ProposalStatus,
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType === 'market-forces') {
          const porterData = normalizePorterData(currentSession.inputData as PorterData);
          const update = (arr: any[]) =>
            arr.map((item: any) =>
              item.id === cardId ? { ...item, proposalStatus: 'rejected' as ProposalStatus } : item
            );
          const updated: Partial<PorterData> = {};
          if (cardType === 'signal') updated.signals = update(porterData.signals);
          else if (cardType === 'item') {
            updated.forces = { ...porterData.forces };
            if (updated.forces[cardId as PorterForceId]) {
              updated.forces[cardId as PorterForceId] = {
                ...updated.forces[cardId as PorterForceId],
                proposalStatus: 'rejected',
              };
            }
          } else if (cardType === 'tension') updated.implications = update(porterData.implications);
          else if (cardType === 'move')
            updated.recommendedMoves = update(porterData.recommendedMoves);
          else if (cardType === 'output-candidate')
            updated.outputCandidates = update(porterData.outputCandidates);
          else if (cardType === 'conclusion' && porterData.summary) {
            updated.summary = {
              ...porterData.summary,
              proposalStatus: 'rejected' as ProposalStatus,
            };
          }
          set({
            currentSession: withRecomputedSteps(currentSession, { ...porterData, ...updated }),
          });
          return;
        }
        if (currentSession.toolType !== 'dynamic-swot') return;
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
        if (!currentSession) return;
        if (currentSession.toolType === 'risk-uncertainty') {
          const riskData = normalizeRiskUncertaintyData(
            currentSession.inputData as RiskUncertaintyData
          );
          const updated = updateRiskProposalCard(riskData, cardType, cardId, {
            userComment: comment,
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType === 'portfolio-priority') {
          const portfolioData = normalizePortfolioPriorityData(
            currentSession.inputData as PortfolioPriorityData
          );
          const updated = updatePortfolioProposalCard(portfolioData, cardType, cardId, {
            userComment: comment,
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType === 'growth-paths') {
          const growthData = normalizeGrowthPathsData(currentSession.inputData as GrowthPathsData);
          const updated = updateGrowthProposalCard(growthData, cardType, cardId, {
            userComment: comment,
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType === 'market-forces') {
          const porterData = normalizePorterData(currentSession.inputData as PorterData);
          const update = (arr: any[]) =>
            arr.map((item: any) => (item.id === cardId ? { ...item, userComment: comment } : item));
          const updated: Partial<PorterData> = {};
          if (cardType === 'signal') updated.signals = update(porterData.signals);
          else if (cardType === 'item') {
            updated.forces = { ...porterData.forces };
            if (updated.forces[cardId as PorterForceId]) {
              updated.forces[cardId as PorterForceId] = {
                ...updated.forces[cardId as PorterForceId],
                userComment: comment,
              };
            }
          } else if (cardType === 'tension') updated.implications = update(porterData.implications);
          else if (cardType === 'move')
            updated.recommendedMoves = update(porterData.recommendedMoves);
          else if (cardType === 'output-candidate')
            updated.outputCandidates = update(porterData.outputCandidates);
          else if (cardType === 'conclusion' && porterData.summary) {
            updated.summary = { ...porterData.summary, userComment: comment };
          }
          set({
            currentSession: withRecomputedSteps(currentSession, { ...porterData, ...updated }),
          });
          return;
        }
        if (currentSession.toolType !== 'dynamic-swot') return;
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
        if (!currentSession) return;
        if (currentSession.toolType === 'risk-uncertainty') {
          const riskData = normalizeRiskUncertaintyData(
            currentSession.inputData as RiskUncertaintyData
          );
          const updated = updateRiskProposalCard(riskData, cardType, cardId, {
            proposalStatus: 'rethinking' as ProposalStatus,
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType === 'portfolio-priority') {
          const portfolioData = normalizePortfolioPriorityData(
            currentSession.inputData as PortfolioPriorityData
          );
          const updated = updatePortfolioProposalCard(portfolioData, cardType, cardId, {
            proposalStatus: 'rethinking' as ProposalStatus,
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType === 'growth-paths') {
          const growthData = normalizeGrowthPathsData(currentSession.inputData as GrowthPathsData);
          const updated = updateGrowthProposalCard(growthData, cardType, cardId, {
            proposalStatus: 'rethinking' as ProposalStatus,
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType === 'market-forces') {
          const porterData = normalizePorterData(currentSession.inputData as PorterData);
          const update = (arr: any[]) =>
            arr.map((item: any) =>
              item.id === cardId
                ? { ...item, proposalStatus: 'rethinking' as ProposalStatus }
                : item
            );
          const updated: Partial<PorterData> = {};
          if (cardType === 'signal') updated.signals = update(porterData.signals);
          else if (cardType === 'item') {
            updated.forces = { ...porterData.forces };
            if (updated.forces[cardId as PorterForceId]) {
              updated.forces[cardId as PorterForceId] = {
                ...updated.forces[cardId as PorterForceId],
                proposalStatus: 'rethinking',
              };
            }
          } else if (cardType === 'tension') updated.implications = update(porterData.implications);
          else if (cardType === 'move')
            updated.recommendedMoves = update(porterData.recommendedMoves);
          else if (cardType === 'output-candidate')
            updated.outputCandidates = update(porterData.outputCandidates);
          else if (cardType === 'conclusion' && porterData.summary) {
            updated.summary = {
              ...porterData.summary,
              proposalStatus: 'rethinking' as ProposalStatus,
            };
          }
          set({
            currentSession: withRecomputedSteps(currentSession, { ...porterData, ...updated }),
          });
          return;
        }
        if (currentSession.toolType !== 'dynamic-swot') return;
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
        if (!currentSession) return;
        if (currentSession.toolType === 'risk-uncertainty') {
          const riskData = normalizeRiskUncertaintyData(
            currentSession.inputData as RiskUncertaintyData
          );
          const updated = updateRiskProposalCard(riskData, cardType, cardId, {
            ...updates,
            proposalStatus: 'ai-proposed' as ProposalStatus,
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType === 'portfolio-priority') {
          const portfolioData = normalizePortfolioPriorityData(
            currentSession.inputData as PortfolioPriorityData
          );
          const updated = updatePortfolioProposalCard(portfolioData, cardType, cardId, {
            ...updates,
            proposalStatus: 'ai-proposed' as ProposalStatus,
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType === 'growth-paths') {
          const growthData = normalizeGrowthPathsData(currentSession.inputData as GrowthPathsData);
          const updated = updateGrowthProposalCard(growthData, cardType, cardId, {
            ...updates,
            proposalStatus: 'ai-proposed' as ProposalStatus,
          });
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType === 'market-forces') {
          const porterData = normalizePorterData(currentSession.inputData as PorterData);
          const update = (arr: any[]) =>
            arr.map((item: any) =>
              item.id === cardId
                ? { ...item, ...updates, proposalStatus: 'ai-proposed' as ProposalStatus }
                : item
            );
          const updated: Partial<PorterData> = {};
          if (cardType === 'signal') updated.signals = update(porterData.signals);
          else if (cardType === 'item') {
            updated.forces = { ...porterData.forces };
            if (updated.forces[cardId as PorterForceId]) {
              updated.forces[cardId as PorterForceId] = {
                ...updated.forces[cardId as PorterForceId],
                ...updates,
                proposalStatus: 'ai-proposed',
              };
            }
          } else if (cardType === 'tension') updated.implications = update(porterData.implications);
          else if (cardType === 'move')
            updated.recommendedMoves = update(porterData.recommendedMoves);
          else if (cardType === 'output-candidate')
            updated.outputCandidates = update(porterData.outputCandidates);
          else if (cardType === 'conclusion' && porterData.summary) {
            updated.summary = {
              ...porterData.summary,
              ...updates,
              proposalStatus: 'ai-proposed' as ProposalStatus,
            };
          }
          set({
            currentSession: withRecomputedSteps(currentSession, { ...porterData, ...updated }),
          });
          return;
        }
        if (currentSession.toolType !== 'dynamic-swot') return;
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
        if (!currentSession) return;
        if (currentSession.toolType === 'risk-uncertainty') {
          const riskData = normalizeRiskUncertaintyData(
            currentSession.inputData as RiskUncertaintyData
          );
          const acceptAll = (arr: any[]) =>
            arr.map((item: any) =>
              item.proposalStatus === 'ai-proposed'
                ? { ...item, proposalStatus: 'accepted' as ProposalStatus }
                : item
            );
          const updated = { ...riskData };
          if (phaseId === 'input') updated.signals = acceptAll(riskData.signals);
          else if (phaseId === 'assumptions') {
            updated.assumptions = acceptAll(riskData.assumptions);
            updated.risks = acceptAll(riskData.risks);
            updated.scenarios = acceptAll(riskData.scenarios);
          } else if (phaseId === 'insights') {
            updated.recommendedMoves = acceptAll(riskData.recommendedMoves);
          } else if (phaseId === 'outputs') {
            if (updated.summary?.proposalStatus === 'ai-proposed') {
              updated.summary = {
                ...updated.summary,
                proposalStatus: 'accepted' as ProposalStatus,
              };
            }
            updated.outputCandidates = acceptAll(riskData.outputCandidates);
          }
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType === 'portfolio-priority') {
          const portfolioData = normalizePortfolioPriorityData(
            currentSession.inputData as PortfolioPriorityData
          );
          const acceptAll = (arr: any[]) =>
            arr.map((item: any) =>
              item.proposalStatus === 'ai-proposed'
                ? { ...item, proposalStatus: 'accepted' as ProposalStatus }
                : item
            );
          const updated = { ...portfolioData };
          if (phaseId === 'input') updated.signals = acceptAll(portfolioData.signals);
          else if (phaseId === 'items') updated.initiatives = acceptAll(portfolioData.initiatives);
          else if (phaseId === 'insights') {
            updated.tradeOffs = acceptAll(portfolioData.tradeOffs);
            updated.recommendedMoves = acceptAll(portfolioData.recommendedMoves);
          } else if (phaseId === 'outputs') {
            if (updated.summary?.proposalStatus === 'ai-proposed') {
              updated.summary = {
                ...updated.summary,
                proposalStatus: 'accepted' as ProposalStatus,
              };
            }
            updated.outputCandidates = acceptAll(portfolioData.outputCandidates);
          }
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType === 'growth-paths') {
          const growthData = normalizeGrowthPathsData(currentSession.inputData as GrowthPathsData);
          const acceptAll = (arr: any[]) =>
            arr.map((item: any) =>
              item.proposalStatus === 'ai-proposed'
                ? { ...item, proposalStatus: 'accepted' as ProposalStatus }
                : item
            );
          const updated = { ...growthData };
          if (phaseId === 'input') updated.signals = acceptAll(growthData.signals);
          else if (phaseId === 'options') {
            updated.quadrants = Object.fromEntries(
              Object.entries(growthData.quadrants).map(([quadrant, items]) => [
                quadrant,
                acceptAll(items),
              ])
            ) as GrowthPathsData['quadrants'];
          } else if (phaseId === 'insights') {
            updated.comparisons = acceptAll(growthData.comparisons);
            updated.recommendedMoves = acceptAll(growthData.recommendedMoves);
          } else if (phaseId === 'outputs') {
            if (updated.summary?.proposalStatus === 'ai-proposed') {
              updated.summary = {
                ...updated.summary,
                proposalStatus: 'accepted' as ProposalStatus,
              };
            }
            updated.outputCandidates = acceptAll(growthData.outputCandidates);
          }
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType === 'market-forces') {
          const porterData = normalizePorterData(currentSession.inputData as PorterData);
          const acceptAll = (arr: any[]) =>
            arr.map((item: any) =>
              item.proposalStatus === 'ai-proposed'
                ? { ...item, proposalStatus: 'accepted' as ProposalStatus }
                : item
            );
          const updated = { ...porterData };
          if (phaseId === 'input') updated.signals = acceptAll(porterData.signals);
          else if (phaseId === 'forces') {
            updated.forces = Object.fromEntries(
              Object.entries(porterData.forces).map(([forceId, force]) => [
                forceId,
                force.proposalStatus === 'ai-proposed'
                  ? { ...force, proposalStatus: 'accepted' as ProposalStatus }
                  : force,
              ])
            ) as PorterData['forces'];
          } else if (phaseId === 'insights') {
            updated.implications = acceptAll(porterData.implications);
            updated.recommendedMoves = acceptAll(porterData.recommendedMoves);
          } else if (phaseId === 'outputs') {
            if (updated.summary?.proposalStatus === 'ai-proposed') {
              updated.summary = {
                ...updated.summary,
                proposalStatus: 'accepted' as ProposalStatus,
              };
            }
            updated.outputCandidates = acceptAll(porterData.outputCandidates);
          }
          set({ currentSession: withRecomputedSteps(currentSession, updated) });
          return;
        }
        if (currentSession.toolType !== 'dynamic-swot') return;
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
