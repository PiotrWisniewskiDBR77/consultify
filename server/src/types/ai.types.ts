/**
 * AI Backend Types
 * Enterprise SaaS Architecture - Backend AI Type Definitions
 */

// ==========================================
// CAPABILITY TYPES
// ==========================================

export type AIRole =
  | 'CONSULTANT'
  | 'ANALYST'
  | 'STRATEGIST'
  | 'IMPLEMENTER'
  | 'GATEKEEPER'
  | 'COACH'
  | 'AUDITOR';

export type OutputFormat = 'json' | 'text' | 'markdown' | 'structured';

export interface AICapability {
  role: AIRole;
  maxTokens: number;
  description: string;
  outputFormat: OutputFormat;
  requiresAuth?: boolean;
  requiresOrg?: boolean;
}

export type CapabilityName =
  | 'diagnose'
  | 'deepDiagnose'
  | 'generateList'
  | 'generateTable'
  | 'generateInitiatives'
  | 'generateObservations'
  | 'generateFirstValuePlan'
  | 'suggestTasks'
  | 'generateTaskInsight'
  | 'generateExecutionStrategy'
  | 'validateInitiative'
  | 'enrichInitiative'
  | 'generateInsights'
  | 'generateStrategicFit'
  | 'buildRoadmap'
  | 'validateRoadmap'
  | 'chat'
  | 'chatStream'
  | 'help'
  | 'nlToInitiative'
  | 'senseCheck'
  | 'riskScore'
  | 'narrateDashboard'
  | 'engagementSummary';

export type CapabilityRegistry = Record<CapabilityName, AICapability>;

// ==========================================
// MESSAGE TYPES
// ==========================================

export type MessageRole = 'system' | 'user' | 'assistant' | 'function' | 'tool';

export interface ChatMessage {
  role: MessageRole;
  content: string;
  name?: string;
  function_call?: FunctionCall;
  tool_calls?: ToolCall[];
}

export interface FunctionCall {
  name: string;
  arguments: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: FunctionCall;
}

// ==========================================
// SHARED ENUMS & PRIMITIVES
// ==========================================

/** Unified response style – kept in sync with frontend chatSlice */
export type ResponseStyle =
  | 'normal'
  | 'executive'
  | 'analyst'
  | 'coach'
  | 'concise'
  | 'formal'
  | 'professional'
  | 'friendly';

/** AI mode toggles sent from the chat UI */
export interface AIModes {
  deepResearch?: boolean;
  webSearch?: boolean;
  showReasoning?: boolean;
  multiAgent?: boolean;
  marketResearch?: boolean;
  coThinkerMode?: string | null;
  privateMode?: boolean;
  tts?: boolean;
}

/** SSE event types emitted during AI streaming */
export type SSEEventType =
  | 'content'
  | 'thought'
  | 'status'
  | 'done'
  | 'end'
  | 'error'
  | 'artifact'
  | 'agent_audit_state'
  | 'deep_thinking_progress'
  | 'quality_signal';

export interface SSEEvent {
  type: SSEEventType;
  content?: string;
  message?: string;
  [key: string]: unknown;
}

/** Screen context passed from the frontend */
export interface ScreenContext {
  currentScreen?: string;
  screenId?: string;
  entityId?: string;
  entityType?: string;
  viewMode?: string;
}

// ==========================================
// REQUEST TYPES
// ==========================================

export interface AIPipelineRequest {
  capability: CapabilityName;
  /**
   * v3 enterprise: stable routing key decoupled from capability implementation.
   * If omitted, defaults to `capability`.
   */
  purpose?: string;
  /**
   * v3 enterprise: optional data classification hint used by org AI policy.
   */
  dataClass?: 'no_pii' | 'pii' | 'confidential';
  prompt: string;
  userId: string;
  organizationId?: string;
  projectId?: string;
  context?: AIContext;
  options?: AIOptions;
  history?: ChatMessage[];
  /** Cancels provider work when the HTTP/SSE consumer disconnects. */
  abortSignal?: AbortSignal;
}

/** Request-scoped ledger shared by every provider candidate and internal retry. */
export interface ProviderStartBudget {
  maxStarts: number;
  started: number;
  attempts: Array<{ provider: string; model: string; startedAt: string }>;
}

export interface AIContext {
  screenId?: string;
  persona?: string;
  language?: string;
  /**
   * Base locale (e.g. 'en', 'pl') to be used by prompt builders. Populated by AIPipeline
   * during buildContext from the authoritative request language. Added 2026-04-18 as
   * part of the i18n-teresa fix so downstream services no longer silently default to PL.
   */
  conversationLanguage?: string;
  focusMode?: string;
  selectedText?: string;
  attachments?: AIAttachment[];
  projectContext?: ProjectContext;
  userPreferences?: UserPreferences;
  /**
   * Optional chat/runtime configuration coming from the client chat UI.
   * NOTE: not all upstream context builders will populate this yet; it is safe to omit.
   */
  aiModes?: AIModes;
  knowledgeSources?: {
    pmoDocuments?: boolean;
    projectData?: boolean;
    organizationData?: boolean;
  };
  responseStyle?: ResponseStyle;
  selectedTier?: 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING';
  selectedModelId?: string | null;
}

export interface AIAttachment {
  type: 'file' | 'url' | 'code' | 'document' | 'image';
  name: string;
  content?: string;
  url?: string;
  mimeType?: string;
  size?: number;
}

export interface ProjectContext {
  projectId: string;
  projectName?: string;
  initiativeId?: string;
  initiativeName?: string;
  assessmentId?: string;
  currentPhase?: string;
  recentActivity?: string[];
}

export interface UserPreferences {
  responseLength?: 'concise' | 'detailed' | 'comprehensive';
  technicalLevel?: 'basic' | 'intermediate' | 'advanced';
  language?: string;
  timezone?: string;
}

export interface AIOptions {
  model?: string;
  provider?: string;
  /**
   * Optional endpoint override (used for local providers like Ollama).
   * NOTE: must be validated at the route boundary to avoid SSRF risks.
   */
  endpoint?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  enableRAG?: boolean;
  enableMemory?: boolean;
  enableThinking?: boolean;
  outputFormat?: OutputFormat;
  timeout?: number;
  /**
   * Chat UI / routing controls (sent from frontend)
   */
  aiModes?: AIModes;
  knowledgeSources?: {
    pmoDocuments?: boolean;
    projectData?: boolean;
    organizationData?: boolean;
  };
  responseStyle?: ResponseStyle;
  selectedTier?: 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING';
  selectedModelId?: string | null;
  /**
   * Internal pipeline options
   */
  role?: string;
  systemInstruction?: string;
  /**
   * Authoritative UI language / chat locale for this request (e.g. 'en', 'pl').
   * Takes precedence over sticky user-memory preferences when building the system prompt.
   * Added 2026-04-18 as part of the i18n-teresa fix.
   */
  language?: string;
  /**
   * When true, skip prompt assembly (persona, org context) and use ONLY
   * `systemInstruction` as the system prompt. Used by specialized services
   * (e.g. WorkbookGeneratorService) that need full control of the system prompt.
   */
  dedicatedSystemPrompt?: boolean;
}

// ==========================================
// RESPONSE TYPES
// ==========================================

export interface AIPipelineResponse {
  success: boolean;
  content: string;
  artifacts?: AIArtifact[];
  thinkingSteps?: ThinkingStep[];
  usage?: TokenUsage;
  metadata?: ResponseMetadata;
  error?: AIError;
}

export interface ThinkingStep {
  id: string;
  label: string;
  content: string;
  status: 'pending' | 'in_progress' | 'done';
  timestamp: Date;
  durationMs?: number;
  category?: 'analysis' | 'research' | 'synthesis' | 'validation';
}

export interface AIArtifact {
  id: string;
  type: 'code' | 'document' | 'diagram' | 'table' | 'chart' | 'pmo_document';
  title?: string;
  content: string;
  language?: string;
  format?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens?: number;
  cost?: number;
}

export interface ResponseMetadata {
  provider: string;
  model: string;
  latency: number;
  traceId?: string;
  cached?: boolean;
  ragResults?: number;
  memoryUsed?: boolean;
}

export interface AIError {
  code: string;
  message: string;
  details?: string;
  retryable?: boolean;
  providerStarts?: number;
  maxProviderStarts?: number;
}

// ==========================================
// STREAMING TYPES
// ==========================================

export interface StreamChunk {
  type: 'text' | 'thought' | 'artifact' | 'error' | 'done';
  content?: string;
  thought?: string;
  artifact?: AIArtifact;
  error?: AIError;
  metadata?: Partial<ResponseMetadata>;
}

export type StreamCallback = (chunk: StreamChunk) => void;

// ==========================================
// PROVIDER TYPES
// ==========================================

export type LLMProviderName =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'azure'
  | 'ollama'
  | 'custom';

export type LLMTier = 'free' | 'standard' | 'premium' | 'enterprise';

export interface LLMProviderConfig {
  id: string;
  provider: LLMProviderName;
  name: string;
  model: string;
  displayName?: string;
  apiKey?: string;
  baseUrl?: string;
  isEnabled: boolean;
  isDefault: boolean;
  tier: LLMTier;
  maxTokens: number;
  contextWindow: number;
  capabilities: LLMCapability[];
  costPerInputToken?: number;
  costPerOutputToken?: number;
  rateLimit?: RateLimit;
  createdAt: Date;
  updatedAt: Date;
}

export type LLMCapability =
  | 'text'
  | 'code'
  | 'vision'
  | 'function_calling'
  | 'streaming'
  | 'embedding'
  | 'json_mode';

export interface RateLimit {
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerDay?: number;
  tokensPerDay?: number;
}

// ==========================================
// MEMORY TYPES
// ==========================================

export type MemoryType =
  | 'fact'
  | 'preference'
  | 'context'
  | 'instruction'
  | 'correction'
  | 'conversation';

export type MemoryScope = 'user' | 'organization' | 'project' | 'global';

export interface AIMemory {
  id: string;
  userId: string;
  organizationId?: string;
  projectId?: string;
  type: MemoryType;
  scope: MemoryScope;
  content: string;
  importance: number;
  accessCount: number;
  lastAccessedAt?: Date;
  expiresAt?: Date;
  source: 'user' | 'ai' | 'system';
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ==========================================
// RAG TYPES
// ==========================================

export interface RAGDocument {
  id: string;
  content: string;
  metadata: RAGMetadata;
  embedding?: number[];
}

export interface RAGMetadata {
  source: string;
  title?: string;
  category?: string;
  tags?: string[];
  organizationId?: string;
  projectId?: string;
  lastUpdated?: Date;
}

export interface RAGSearchResult {
  document: RAGDocument;
  score: number;
  highlights?: string[];
}

export interface RAGQuery {
  query: string;
  topK?: number;
  filters?: {
    category?: string;
    tags?: string[];
    organizationId?: string;
    projectId?: string;
  };
  minScore?: number;
}

// ==========================================
// QUALITY & SECURITY TYPES
// ==========================================

export interface QualityCheckResult {
  passed: boolean;
  score: number;
  issues: QualityIssue[];
  suggestions?: string[];
}

export interface QualityIssue {
  type: 'hallucination' | 'bias' | 'pii' | 'toxicity' | 'off_topic' | 'incomplete';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: string;
}

export interface SecurityCheckResult {
  passed: boolean;
  piiDetected: boolean;
  piiTypes?: string[];
  riskLevel: 'low' | 'medium' | 'high';
  blockedContent?: string[];
}

// ==========================================
// ANALYTICS TYPES
// ==========================================

export interface AIAnalytics {
  period: {
    start: Date;
    end: Date;
  };
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  avgLatency: number;
  successRate: number;
  cacheHitRate: number;
  byProvider: Record<string, ProviderStats>;
  byCapability: Record<string, CapabilityStats>;
  byUser?: Record<string, UserStats>;
}

export interface ProviderStats {
  calls: number;
  tokens: number;
  cost: number;
  avgLatency: number;
  errorRate: number;
}

export interface CapabilityStats {
  calls: number;
  tokens: number;
  avgLatency: number;
  successRate: number;
}

export interface UserStats {
  calls: number;
  tokens: number;
  cost: number;
}

// ==========================================
// AUDIT TYPES
// ==========================================

export interface AIAuditLog {
  id: string;
  userId: string;
  organizationId?: string;
  capability: CapabilityName;
  provider: string;
  model: string;
  promptLength: number;
  responseLength: number;
  tokensUsed: number;
  cost: number;
  latency: number;
  success: boolean;
  error?: string;
  securityFlags?: string[];
  qualityScore?: number;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}
