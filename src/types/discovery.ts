/**
 * Discovery Consultant Types
 *
 * Type definitions for the Discovery Consultant module.
 * AI-powered sales discovery with live canvas visualization.
 */

import { FrameworkId } from '@/services/frameworkRegistry';

// ==================== ENUMS ====================

export type TransformationType = 'strategic' | 'operational' | 'digital';

export type PainArea = 'process' | 'technology' | 'people' | 'data';

export type DiscoveryPhase =
  | 'welcome'
  | 'ice_breaking'
  | 'pain_discovery'
  | 'impact_assessment'
  | 'recommendations'
  | 'decision'
  | 'completed';

export type DiscoveryNodeType =
  | 'painPoint'
  | 'insight'
  | 'opportunity'
  | 'quote'
  | 'recommendation'
  | 'tool'
  | 'assessment'
  | 'initiative';

export type SessionOutcome = 'converted' | 'follow_up' | 'saved' | 'abandoned';

// ==================== NODE DATA TYPES ====================

export interface PainPointNodeData {
  text: string;
  severity: 1 | 2 | 3 | 4 | 5;
  area: PainArea;
  impact?: string;
  source: 'user' | 'ai';
}

export interface InsightNodeData {
  text: string;
  linkedPainIds: string[];
  source: 'user' | 'ai';
}

export interface OpportunityNodeData {
  text: string;
  linkedPainIds: string[];
  potentialValue?: string;
  source: 'user' | 'ai';
}

export interface QuoteNodeData {
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  speaker?: string;
}

export interface RecommendationNodeData {
  title: string;
  type: TransformationType;
  confidence: number; // 0-100
  reasoning: string;
}

export interface ToolNodeData {
  toolId: string;
  name: string;
  category: string;
  description?: string;
}

export interface AssessmentNodeData {
  frameworkId: FrameworkId;
  name: string;
  description?: string;
  relevanceScore?: number;
}

export interface InitiativeNodeData {
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  linkedPainIds: string[];
  quickWin?: boolean;
}

// ==================== CANVAS TYPES ====================

export interface DiscoveryNodePosition {
  x: number;
  y: number;
}

export interface DiscoveryNode {
  id: string;
  type: DiscoveryNodeType;
  position: DiscoveryNodePosition;
  data:
    | PainPointNodeData
    | InsightNodeData
    | OpportunityNodeData
    | QuoteNodeData
    | RecommendationNodeData
    | ToolNodeData
    | AssessmentNodeData
    | InitiativeNodeData;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscoveryEdge {
  id: string;
  source: string;
  target: string;
  type?: 'default' | 'smoothstep' | 'bezier';
  label?: string;
  animated?: boolean;
}

export type CanvasCategory = 'pains' | 'insights' | 'opportunities' | 'recommendations';

// ==================== CLIENT CONTEXT ====================

export interface ClientContext {
  companyName?: string;
  industry?: string;
  size?: 'small' | 'medium' | 'large' | 'enterprise';
  role?: string;
  country?: string;
  primaryGoal?: string;
}

// ==================== RECOMMENDATIONS ====================

export interface InitiativeIdea {
  id: string;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  linkedPainIds: string[];
  quickWin: boolean;
}

export interface DiscoveryRecommendations {
  transformationType: TransformationType | null;
  matchScore: number; // 0-100
  reasoning: string;
  frameworks: FrameworkId[];
  tools: string[];
  initiatives: InitiativeIdea[];
}

// ==================== EXTRACTION ====================

export interface ExtractedPainPoint {
  text: string;
  severity: 1 | 2 | 3 | 4 | 5;
  area: PainArea;
  impact?: string;
}

export interface ExtractedInsight {
  text: string;
  linkedPains: string[]; // pain texts to link
}

export interface ExtractedQuote {
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface PhaseProgress {
  contextComplete: boolean;
  painsIdentified: number;
  impactQuantified: boolean;
  readyForRecommendations: boolean;
}

export interface ExtractedEntities {
  painPoints: ExtractedPainPoint[];
  insights: ExtractedInsight[];
  quotes: ExtractedQuote[];
  clientContext: Partial<ClientContext>;
  phaseProgress: PhaseProgress;
}

// ==================== SESSION ====================

export interface SessionVersion {
  version: number;
  createdAt: Date;
  snapshot: {
    nodes: DiscoveryNode[];
    edges: DiscoveryEdge[];
    recommendations: DiscoveryRecommendations;
    phase: DiscoveryPhase;
  };
}

export interface DiscoverySession {
  id: string;
  title: string;

  // Phase tracking
  currentPhase: DiscoveryPhase;

  // Canvas state
  nodes: DiscoveryNode[];
  edges: DiscoveryEdge[];

  // Extracted data (for quick access)
  painPoints: ExtractedPainPoint[];
  insights: ExtractedInsight[];

  // Recommendations
  recommendations: DiscoveryRecommendations;

  // Client context
  clientContext: ClientContext;

  // Versioning
  versions: SessionVersion[];
  currentVersion: number;

  // Outcome
  outcome?: SessionOutcome;
  convertedProjectId?: string;
  attachedProjectId?: string;

  // Conversation link
  conversationId?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ==================== STORE ACTIONS ====================

export interface DiscoveryStoreActions {
  // Session management
  createSession: () => string;
  loadSession: (id: string) => Promise<void>;
  saveSession: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;

  // Phase management
  setPhase: (phase: DiscoveryPhase) => void;
  canAdvancePhase: () => boolean;
  advancePhase: () => void;

  // Node management
  addNode: (node: Omit<DiscoveryNode, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateNode: (id: string, data: Partial<DiscoveryNode['data']>) => void;
  removeNode: (id: string) => void;
  moveNode: (id: string, position: DiscoveryNodePosition) => void;

  // Edge management
  addEdge: (edge: Omit<DiscoveryEdge, 'id'>) => string;
  removeEdge: (id: string) => void;

  // Client context
  updateClientContext: (context: Partial<ClientContext>) => void;

  // Recommendations
  setRecommendations: (recommendations: DiscoveryRecommendations) => void;

  // Extraction
  processExtraction: (entities: ExtractedEntities) => void;

  // Versioning
  saveVersion: () => number;
  loadVersion: (version: number) => void;

  // Conversion
  convertToProject: () => Promise<string>;
  attachToProject: (projectId: string) => Promise<void>;

  // Reset
  reset: () => void;
}

// ==================== STORE STATE ====================

export interface DiscoveryStoreState {
  // Active session
  activeSessionId: string | null;
  sessions: Record<string, DiscoverySession>;

  // Current session data (for performance)
  currentPhase: DiscoveryPhase;
  nodes: DiscoveryNode[];
  edges: DiscoveryEdge[];
  clientContext: ClientContext;
  recommendations: DiscoveryRecommendations;

  // UI state
  isLoading: boolean;
  isSaving: boolean;
  selectedNodeId: string | null;

  // Actions
  actions: DiscoveryStoreActions;
}

// ==================== API TYPES ====================

export interface CreateDiscoverySessionRequest {
  title?: string;
  clientContext?: Partial<ClientContext>;
  conversationId?: string;
}

export interface UpdateDiscoverySessionRequest {
  title?: string;
  nodes?: DiscoveryNode[];
  edges?: DiscoveryEdge[];
  clientContext?: Partial<ClientContext>;
  recommendations?: DiscoveryRecommendations;
  currentPhase?: DiscoveryPhase;
  outcome?: SessionOutcome;
}

export interface ConvertToProjectRequest {
  sessionId: string;
  projectName: string;
  includeRecommendations: boolean;
  createInitiatives: boolean;
}

export interface ConvertToProjectResponse {
  projectId: string;
  initiativesCreated: number;
}

// ==================== CANVAS CONFIG ====================

export interface CanvasCategoryConfig {
  id: CanvasCategory;
  title: string;
  titlePl: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  color: string;
}

export const CANVAS_CATEGORIES: CanvasCategoryConfig[] = [
  {
    id: 'pains',
    title: 'Pain Points',
    titlePl: 'Problemy',
    position: { x: 50, y: 50 },
    size: { width: 400, height: 300 },
    color: 'red',
  },
  {
    id: 'insights',
    title: 'Insights',
    titlePl: 'Spostrzeżenia',
    position: { x: 500, y: 50 },
    size: { width: 400, height: 300 },
    color: 'amber',
  },
  {
    id: 'opportunities',
    title: 'Opportunities',
    titlePl: 'Szanse',
    position: { x: 50, y: 400 },
    size: { width: 400, height: 250 },
    color: 'green',
  },
  {
    id: 'recommendations',
    title: 'Recommendations',
    titlePl: 'Rekomendacje',
    position: { x: 500, y: 400 },
    size: { width: 400, height: 250 },
    color: 'blue',
  },
];

// ==================== PHASE CONFIG ====================

export interface PhaseConfig {
  id: DiscoveryPhase;
  title: string;
  titlePl: string;
  description: string;
  descriptionPl: string;
  minRequirements?: {
    painsIdentified?: number;
    contextComplete?: boolean;
    impactQuantified?: boolean;
  };
}

export const PHASE_CONFIGS: PhaseConfig[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    titlePl: 'Powitanie',
    description: 'Introduction to discovery session',
    descriptionPl: 'Wprowadzenie do sesji discovery',
  },
  {
    id: 'ice_breaking',
    title: 'Context Gathering',
    titlePl: 'Poznanie kontekstu',
    description: 'Understanding company and role',
    descriptionPl: 'Zrozumienie firmy i roli',
  },
  {
    id: 'pain_discovery',
    title: 'Pain Discovery',
    titlePl: 'Odkrywanie problemów',
    description: 'Identifying key challenges',
    descriptionPl: 'Identyfikacja kluczowych wyzwań',
    minRequirements: { contextComplete: true },
  },
  {
    id: 'impact_assessment',
    title: 'Impact Assessment',
    titlePl: 'Ocena wpływu',
    description: 'Quantifying business impact',
    descriptionPl: 'Kwantyfikacja wpływu biznesowego',
    minRequirements: { painsIdentified: 2 },
  },
  {
    id: 'recommendations',
    title: 'Recommendations',
    titlePl: 'Rekomendacje',
    description: 'Presenting transformation path',
    descriptionPl: 'Prezentacja ścieżki transformacji',
    minRequirements: { impactQuantified: true },
  },
  {
    id: 'decision',
    title: 'Decision',
    titlePl: 'Decyzja',
    description: 'Next steps and conversion',
    descriptionPl: 'Następne kroki i konwersja',
  },
  {
    id: 'completed',
    title: 'Completed',
    titlePl: 'Zakończone',
    description: 'Session completed',
    descriptionPl: 'Sesja zakończona',
  },
];
