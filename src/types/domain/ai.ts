import { AppView } from '../core';

/**
 * AI Domain Types
 * Enterprise SaaS Architecture - AI/LLM Types
 */

// ==========================================
// LLM PROVIDER TYPES
// ==========================================

export type LLMProviderId =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'gemini'
  | 'openrouter'
  | 'mistral'
  | 'groq'
  | 'together'
  | 'nvidia'
  | 'deepseek'
  | 'qwen'
  | 'ernie'
  | 'z_ai'
  | 'zai'
  | 'replicate'
  | 'ollama'
  | 'tavily'
  | 'google_search'
  | 'cohere'
  | 'azure'
  | 'custom';

export type LLMTier = 'free' | 'standard' | 'premium' | 'enterprise' | 'budget';

export type LLMCapability =
  | 'text'
  | 'code'
  | 'vision'
  | 'function_calling'
  | 'streaming'
  | 'embedding'
  | 'reasoning';

/**
 * LLM Provider configuration
 * Standardized from core.ts and domain/ai.ts
 */
export interface LLMProviderConfig {
  id: string;
  name: string;
  provider: LLMProviderId;
  api_key: string;
  apiKey?: string; // Alias
  endpoint?: string;
  baseUrl?: string; // Alias
  model_id: string;
  modelId?: string; // Alias
  model?: string; // Alias
  displayName?: string;

  // Costs
  cost_per_1k: number;
  input_cost_per_1k?: number;
  output_cost_per_1k?: number;
  costPerInputToken?: number;
  costPerOutputToken?: number;
  markup_multiplier?: number;

  // Status
  is_active: boolean;
  isEnabled?: boolean; // Alias
  is_default?: boolean;
  isDefault?: boolean; // Alias
  visibility: 'admin' | 'public' | 'beta';
  priority?: number;

  // Organization Context
  is_enabled_for_org?: boolean;

  // Technical Conditions
  context_window?: number;
  contextWindow?: number; // Alias
  maxTokens?: number; // legacy
  max_outputs?: number; // Max output tokens
  description?: string;
  capabilities: LLMCapability[] | string[];

  // Enterprise metadata (v3)
  kind?: 'TEXT_LLM' | 'IMAGE_MODEL' | 'BUSINESS_MODEL' | string;
  provider_type?: 'direct' | 'aggregator' | 'hosted' | 'local' | 'customer_managed' | string;
  origin_vendor?: string;
  execution_regions?: string | string[];
  allowed_data_classes?: string | string[];
  data_residency_attestation?: string;
  subprocessors_ref?: string;

  // Secret status (never expose secret value)
  has_api_key?: boolean;
  is_configured?: boolean;
  env_key?: string;

  // Runtime status
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastHealthCheck?: string;
  supportsVision?: boolean;
  supportsTools?: boolean;
  supportsStreaming?: boolean;
  tier: LLMTier | string;
  isConfigured?: boolean;

  createdAt: string;
  updatedAt: string;
}

// Rename the legacy type to avoid collision if it's still used as just the provider string
export type LLMProvider = LLMProviderId;

/**
 * LLM Rate limit configuration
 */
export interface LLMRateLimit {
  requestsPerMinute: number;
  tokensPerMinute: number;
  requestsPerDay?: number;
  tokensPerDay?: number;
}

/**
 * LLM Health status
 */
export interface LLMHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  latency?: number;
  lastCheck: string;
  lastError?: string;
  successRate?: number;
}

// ==========================================
// CONVERSATION TYPES
// ==========================================

export type MessageRole = 'system' | 'user' | 'assistant' | 'function' | 'tool';

export type ConversationStatus = 'active' | 'archived' | 'deleted';

/**
 * AI Conversation
 */
export interface AIConversation {
  id: string;
  userId: string;
  projectId?: string;
  title?: string;
  status: ConversationStatus;
  messageCount: number;
  tokensUsed: number;
  model?: string;
  provider?: LLMProvider;
  context?: ConversationContext;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string;
}

/**
 * Conversation context
 */
export interface ConversationContext {
  projectId?: string;
  initiativeId?: string;
  assessmentId?: string;
  screenId?: string;
  persona?: AIPersona;
  focusMode?: FocusMode | AIFocusMode | string;
  systemPrompt?: string;
  customInstructions?: string;
  aiContext?: AIContext; // Full contextual 6-layer snapshot
}

/**
 * Interactive option for chat responses
 */
export interface ChatOption {
  id: string;
  label: string;
  value: string;
}

/**
 * Tool call information for AI-assisted operations
 */
export interface ToolCallInfo {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status?: 'pending' | 'approved' | 'rejected' | 'executed';
}

/**
 * Citation from PMO data or external sources
 */
export interface ChatCitation {
  id: string;
  type: 'assessment' | 'initiative' | 'report' | 'roadmap' | 'external' | string;
  title: string;
  reference: string;
  link?: string;
  excerpt?: string;
  entityId?: string;
  /**
   * M01-P04B (GF-CHAT-08, source failure honesty). Absent/`undefined` is
   * treated as `'ready'` for backward compatibility with citations persisted
   * before this field existed. `'failed'`/`'stale'`/`'no_access'` MUST
   * suppress `title` and `excerpt` in the UI — see
   * `CitationList.tsx#getSafeCitationView`. `'no_access'` is RBAC-specific
   * (document exists but the caller lacks permission) — a distinct reason
   * from `'failed'` (document verification broke/doesn't exist), even though
   * both render as a redacted placeholder.
   */
  status?: 'ready' | 'stale' | 'failed' | 'no_access';
  /**
   * M01-P04B (GF-CHAT-02, fragment anchor). Real ordinal position of the
   * cited chunk within its source document (`knowledge_chunks.chunk_index`).
   * `null`/`undefined` means "no specific fragment known" — NEVER fabricate
   * `0` as a stand-in; that would make every citation look anchored to the
   * same (first) fragment. See `server/src/services/ai/citationExtractor.ts`.
   */
  fragmentIndex?: number | null;
}

/**
 * V4 Canonical Advisor Citation — richer than ChatCitation, used by AdvisorResponse pipeline
 */
export interface AdvisorCitation {
  id: string;
  artifactType: string;
  artifactId: string;
  fragmentId?: string;
  title: string;
  excerpt?: string;
  url?: string;
  confidence?: number;
  verified?: boolean;
}

/**
 * V4 Proposed Action — executable action suggested by the advisor
 */
export interface ProposedAction {
  id: string;
  actionType: string;
  label: string;
  description?: string;
  params: Record<string, unknown>;
  preview?: string;
  diff?: { before?: Record<string, unknown>; after: Record<string, unknown> };
  requiresApproval: boolean;
  estimatedImpact?: 'low' | 'medium' | 'high';
}

/**
 * V4 Advisor Question — follow-up question from the advisor
 */
export interface AdvisorQuestion {
  id: string;
  text: string;
  questionType: string;
  options?: string[];
  required: boolean;
}

/**
 * V4 Canonical AdvisorResponse — unified AI response schema
 */
export interface AdvisorResponse {
  id: string;
  intent: string;
  answer: string;
  citations: AdvisorCitation[];
  proposedActions: ProposedAction[];
  questions: AdvisorQuestion[];
  confidence: number;
  safetyNotes: string[];
  reasoning?: string;
  metadata?: {
    model?: string;
    tokensUsed?: number;
    latencyMs?: number;
    purpose?: string;
    contextArtifacts?: string[];
  };
}

/**
 * Action button in AI response
 */
export interface ChatResponseAction {
  id: string;
  type: 'navigate' | 'execute' | 'expand' | 'copy';
  label: string;
  icon?: string;
  payload: {
    view?: AppView | string;
    targetModule?: string;
    module?: string;
    entityType?: string;
    entityId?: string;
    surface?: string;
    params?: Record<string, unknown>;
    sourceType?: string;
    sourceId?: string;
    sourceName?: string;
    templateId?: string;
    apiCall?: string;
    data?: Record<string, unknown>;
    copyText?: string;
  };
}

export type TeresaProposalState =
  | 'proposal'
  | 'pending_approval'
  | 'approved'
  | 'executing'
  | 'completed'
  | 'undone'
  | 'rejected';

export interface TeresaChatProposal {
  proposalId: string;
  contractId: string;
  title: string;
  summary: string;
  state: TeresaProposalState;
  approvalState: 'awaiting_review' | 'approved' | 'completed' | 'rejected';
  allowedActions: Array<'approve' | 'reject' | 'execute' | 'undo' | 'navigate'>;
  targetModule: string;
  targetLabel: string;
  handoffIntent: string;
  previewLines: string[];
  auditCount: number;
  resultRef: string | null;
  degraded: string | null;
}

/**
 * Focus Mode for AI context filtering
 */
export type FocusMode = 'all' | 'pmo-docs' | 'project-data' | 'research' | 'web';

/**
 * AI Artifact types
 *
 * Notes:
 * - We keep this as a superset for backward compatibility across the codebase.
 * - Prefer kebab-case going forward (e.g. `pmo-document`), but accept legacy variants.
 */
export type AIArtifactType =
  | 'markdown'
  | 'code'
  | 'html'
  | 'diagram'
  | 'table'
  | 'comparison-matrix'
  | 'decision-timeline'
  | 'pmo-document'
  | 'pmo_document'
  | 'pmo-document' // keep explicit for readability
  | 'document'
  // Deliverables light (B2): deck generated in chat, mounted in the canvas split-view.
  | 'deck'
  | 'chart'
  | 'json'
  | 'mermaid'
  | 'latex';

/**
 * Deliverables light (B2): reference to a chat-generated deliverable
 * (deck, doc or sheet draft). `generationId` doubles as deckId/draftId in the
 * deliverables runtime, so the canvas panel can re-mount the artifact.
 * 'sheet' = GFM-table markdown draft (work_canvas kind='table').
 */
export interface AIArtifactDeliverableRef {
  kind: 'deck' | 'doc' | 'sheet';
  generationId: string;
  title?: string;
}

export interface AIArtifactMetadata {
  filename?: string;
  lineCount?: number;
  wordCount?: number;
  isExecutable?: boolean;
  dependencies?: string[];
  framework?: string;
  templateType?: string;
  exportFormats?: string[];
  /** Deliverables light (B2): chat-generated deliverable this artifact points at. */
  deliverable?: AIArtifactDeliverableRef;
}

/**
 * Artifact - Generated structured content from AI
 *
 * Single canonical definition (prevents TS declaration merging collisions).
 */
export interface AIArtifact {
  id: string;
  type: AIArtifactType;
  content: string;

  // Optional / legacy fields
  title?: string;
  messageId?: string;
  language?: string;
  format?: string;
  editable?: boolean;
  version?: number;
  createdAt: string | Date;
  updatedAt?: string | Date;
  metadata?: AIArtifactMetadata;

  /** Diagram-specific data */
  diagramData?: {
    diagramType: 'process_flow' | 'decision_tree' | 'mind_map' | 'org_chart';
    nodes: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      data: Record<string, unknown>;
    }>;
    edges?: Array<{
      id: string;
      source: string;
      target: string;
      type?: string;
      data?: Record<string, unknown>;
    }>;
  };
}

/**
 * Thinking Step for Chain of Thought reasoning
 */
export interface ThinkingStep {
  id: string;
  label: string;
  title?: string; // compatibility
  content: string;
  status: 'pending' | 'in_progress' | 'done' | 'processing' | 'completed' | 'failed';
  timestamp: Date | string;
  durationMs?: number;
  duration?: number; // compatibility
  category?: 'analysis' | 'research' | 'synthesis' | 'validation';
}

/**
 * AI Message / Chat Message
 * Consolidated definition for v2.0
 */
export interface ChatMessage {
  id: string;
  role: 'ai' | 'user' | 'assistant' | 'system' | 'function' | 'tool';
  content: string;
  timestamp: Date | string;
  type?:
    | 'text'
    | 'action_request'
    | 'summary'
    | 'file'
    | 'tool_call'
    // V8: governed proposal + execution message family (CHAT_V8_ACTIONS_AND_APPROVALS)
    | 'execution_proposal'
    | 'execution_progress'
    | 'execution_result';

  // Interactive Elements
  options?: ChatOption[];
  multiSelect?: boolean;
  actions?: ChatResponseAction[];

  // Logic & reasoning
  isThinking?: boolean;
  thinkingSteps?: ThinkingStep[];
  toolCalls?: ToolCallInfo[];

  // Content & Context
  artifacts?: AIArtifact[];
  citations?: ChatCitation[];
  focusMode?: FocusMode | string;

  // Metadata & Status
  feedback?: MessageFeedback | ResponseFeedback;
  metadata?: {
    responseMode?: string;
    processingTime?: number;
    retryCount?: number;
    source?: 'chat' | 'api' | 'automation' | 'agent';
    parentMessageId?: string;
    editedFrom?: string;
    [key: string]: any;
  };
  parentMessageId?: string;
  isStreaming?: boolean;
  streamProgress?: number;
  canEdit?: boolean;
  regenerateCount?: number;

  createdAt?: string | Date;

  // Team conversation extensions
  authorUserId?: string | null;
  authorName?: string | null;
}

/**
 * AI Message (Alias for backward compatibility)
 */
export type AIMessage = ChatMessage;

/**
 * Token usage breakdown
 */
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
  cached?: number;
  cost?: number;
}

// Backward compatibility aliases (avoid breaking imports)
export type ArtifactType = AIArtifactType;
export type ArtifactMetadata = AIArtifactMetadata;

/**
 * AI Tool call
 */
export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
  duration?: number;
}

/**
 * Message feedback
 */
export interface MessageFeedback {
  rating: 'positive' | 'negative';
  reason?: string;
  comment?: string;
  createdAt?: string | Date;
  timestamp?: string | Date; // Added for compatibility
}

/**
 * Detailed/**
 * Response feedback from user
 * Consolidated v2.0 adaptive feedback schema
 */
export interface ResponseFeedback {
  rating: 'positive' | 'negative' | 'neutral';
  lengthFeedback?: 'too-short' | 'just-right' | 'too-long' | string;
  detailFeedback?: 'too-little' | 'just-right' | 'too-much' | string;
  formatFeedback?: 'needs_structure' | 'good_format' | 'too_complex' | string;
  customFeedback?: string;
  wantedMode?: 'quick' | 'standard' | 'deepStudy' | string;
  timestamp?: Date | string;

  // Adaptive style fields (v2.0)
  actionability?: number; // 1-5 - How useful/actionable was the response
  accuracy?: number; // 1-5 - How accurate/correct was the information
  expectedFormat?: 'bullets' | 'paragraphs' | 'structured' | 'conversational' | string;
  missingInfo?: string; // What was missing from the response
}

export type AIPolicyLevel = 'ADVISORY' | 'ASSISTED' | 'PROACTIVE' | 'AUTOPILOT';

export type AIRole = 'ADVISOR' | 'PMO_MANAGER' | 'EXECUTOR' | 'EDUCATOR';

/** AI Project Role - Hierarchical governance level (ADVISOR < MANAGER < OPERATOR) */
export enum AIProjectRole {
  ADVISOR = 'ADVISOR', // Explains, suggests, warns - cannot modify data
  MANAGER = 'MANAGER', // Prepares drafts - requires explicit approval
  OPERATOR = 'OPERATOR', // Executes approved actions within governance
}

/** AI Role Capabilities - What each role can do */
export interface AIRoleCapabilities {
  canExplain: boolean;
  canSuggest: boolean;
  canAnalyze: boolean;
  canCreateDrafts: boolean;
  canExecuteActions: boolean;
  canModifyEntities: boolean;
  requiresApproval: boolean;
}

/** AI Role Configuration for Projects */
export interface AIRoleConfig {
  activeRole: AIProjectRole;
  capabilities: AIRoleCapabilities;
  roleDescription: string;
}

/** AI Chat Mode - User-selectable intent */
export type AIChatMode = 'EXPLAIN' | 'GUIDE' | 'ANALYZE' | 'DO' | 'TEACH';

/** Platform Context Layer */
export interface AIPlatformContext {
  role: 'SUPERADMIN' | 'ADMIN' | 'USER';
  tenantId: string;
  userId: string;
  policyLevel: AIPolicyLevel;
  globalPolicies: {
    internetEnabled: boolean;
    maxPolicyLevel: AIPolicyLevel;
    auditRequired: boolean;
  };
}

/** Organization Context Layer */
export interface AIOrganizationContext {
  organizationId: string;
  organizationName: string;
  locations: string[];
  activeProjectIds: string[];
  activeProjectCount: number;
  pmoMaturityLevel?: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED';
}

/** Project Context Layer */
export interface AIProjectContext {
  projectId: string;
  projectName: string;
  currentPhase: string;
  phaseNumber: number;
  governanceRules: {
    requireApprovalForPhaseTransition: boolean;
    stageGatesEnabled: boolean;
    aiPolicyOverride?: AIPolicyLevel;
  };
  sponsorId?: string;
  projectManagerId?: string;
  roadmapStatus?: string;
  initiativeCount: number;
  completedInitiatives: number;
}

/** Execution Context Layer */
export interface AIExecutionContext {
  userId: string;
  userTasks: { id: string; title: string; status: string; dueDate?: string }[];
  userInitiatives: { id: string; name: string; status: string }[];
  pendingDecisions: { id: string; title: string; createdAt: string }[];
  blockers: { id: string; type: string; description: string }[];
  capacityStatus: 'HEALTHY' | 'WARNING' | 'OVERLOADED';
}

/** Knowledge Context Layer */
export interface AIKnowledgeContext {
  projectDocuments: { id: string; name: string; type: string }[];
  previousDecisions: { id: string; title: string; outcome: string }[];
  changeRequests: { id: string; title: string; status: string }[];
  lessonsLearned: string[];
  phaseHistory: { phase: string; enteredAt: string }[];
}

/** External Context Layer */
export interface AIExternalContext {
  internetEnabled: boolean;
  externalSourcesUsed: string[];
}

/** Complete 6-Layer AI Context */
export interface AIContext {
  platform: AIPlatformContext;
  organization: AIOrganizationContext;
  project?: AIProjectContext;
  execution: AIExecutionContext;
  knowledge: AIKnowledgeContext;
  external: AIExternalContext;

  // Meta
  builtAt: string;
  contextHash: string;
  currentScreen?: string;
  selectedObjectId?: string;
  selectedObjectType?: string;
}

/**
 * Message metadata
 */
export interface MessageMetadata {
  processingTime?: number;
  retryCount?: number;
  source?: 'chat' | 'api' | 'automation' | 'agent';
  parentMessageId?: string;
  editedFrom?: string;
}

// ==========================================
// AI PERSONA & FOCUS MODES
// ==========================================

export type AIPersona =
  | 'consultant'
  | 'project_manager'
  | 'architect'
  | 'analyst'
  | 'auditor'
  | 'coach'
  | 'strategist';

export type AIFocusMode =
  | 'general'
  | 'assessment'
  | 'planning'
  | 'execution'
  | 'reporting'
  | 'analysis'
  | 'code'
  | 'documentation';

// Backward compatibility alias
export type Artifact = AIArtifact;

export interface AIPersonaConfig {
  id: AIPersona;
  name: string;
  description: string;
  systemPrompt: string;
  icon?: string;
  color?: string;
  capabilities?: string[];
}

export interface AIFocusModeConfig {
  id: AIFocusMode;
  name: string;
  description: string;
  contextInstructions: string;
  enabledTools?: string[];
  suggestedActions?: string[];
}

// ==========================================
// RAG & KNOWLEDGE TYPES
// ==========================================

/**
 * Knowledge document for RAG
 */
export interface KnowledgeDocument {
  id: string;
  organizationId?: string;
  projectId?: string;
  title: string;
  content: string;
  type: 'markdown' | 'pdf' | 'url' | 'text' | 'code';
  source?: string;
  sourceUrl?: string;
  category?: string;
  tags?: string[];
  isIndexed: boolean;
  indexedAt?: string;
  chunkCount?: number;
  embedding?: number[];
  metadata?: DocumentMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentMetadata {
  author?: string;
  version?: string;
  language?: string;
  wordCount?: number;
  pageCount?: number;
  lastModified?: string;
}

/**
 * Knowledge chunk for vector search
 */
export interface KnowledgeChunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  startIndex: number;
  endIndex: number;
  chunkIndex: number;
  metadata?: ChunkMetadata;
}

export interface ChunkMetadata {
  heading?: string;
  pageNumber?: number;
  sectionPath?: string[];
}

/**
 * RAG search result
 */
export interface RAGSearchResult {
  chunk: KnowledgeChunk;
  document: Pick<KnowledgeDocument, 'id' | 'title' | 'type' | 'source'>;
  score: number;
  highlights?: string[];
}

// ==========================================
// AI MEMORY & SETTINGS Hierarchy
// ==========================================

export type MemoryType = 'fact' | 'preference' | 'context' | 'instruction' | 'correction';

/**
 * AI Memory entry
 */
export interface AIMemory {
  id: string;
  userId: string;
  organizationId?: string;
  projectId?: string;
  type: MemoryType;
  content: string;
  importance: number;
  accessCount: number;
  lastAccessedAt?: string;
  expiresAt?: string;
  source?: 'user' | 'ai' | 'system';
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** AI Memory - Session Layer */
export interface AISessionMemory {
  conversationId: string;
  messages: { role: 'user' | 'ai'; content: string; timestamp: string }[];
  currentScreen: string;
  startedAt: string;
}

/** AI Memory - Project Layer */
export interface AIProjectMemory {
  projectId: string;

  // Decisions & Rationale
  majorDecisions: {
    decisionId: string;
    title: string;
    outcome: string;
    rationale: string;
    recordedAt: string;
  }[];

  // Phase Transitions
  phaseTransitions: {
    from: string;
    to: string;
    reason: string;
    transitionedAt: string;
  }[];

  // AI Recommendations
  aiRecommendations: {
    recommendation: string;
    accepted: boolean;
    userFeedback?: string;
    recordedAt: string;
  }[];

  createdAt: string;
  updatedAt: string;
}

/** AI Memory - Organization Layer */
export interface AIOrganizationMemory {
  organizationId: string;

  governanceStyle: 'STRICT' | 'BALANCED' | 'FLEXIBLE';
  aiStrictnessPreference: 'MINIMAL' | 'STANDARD' | 'AGGRESSIVE';
  recurringPatterns: string[];

  createdAt: string;
  updatedAt: string;
}

/** AI User Preferences (v1 legacy alias) */
export interface AIUserPreferences {
  userId: string;

  preferredTone: 'BUDDY' | 'EXPERT' | 'MANAGER';
  educationModeEnabled: boolean;
  proactiveNotifications: boolean;
  preferredLanguage: string;

  createdAt: string;
  updatedAt: string;
}

/** AI Proactivity Mode - How proactive the AI should be */
export type AIProactivityMode = 'REACTIVE' | 'BALANCED' | 'PROACTIVE';

/** Proactivity behavior flags for runtime */
export interface ProactivityBehavior {
  autoSuggest: boolean;
  nudges: boolean;
  contextualHints: boolean;
  initiateConversation: boolean;
}

/** SuperAdmin AI Settings - Platform-wide configuration */
export interface SuperAdminAISettings {
  id: string; // 'global'

  // Provider Management
  defaultProvider: string | null;
  fallbackChain: string[];
  circuitBreakerConfig: {
    failureThreshold: number;
    cooldownSeconds: number;
  };

  // Global Limits
  globalTokenLimit: number;
  globalRateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  maxContextWindowSize: number;
  maxTokensPerRequest: number;

  // Security & PII
  piiDetectionSensitivity: 'low' | 'medium' | 'high';
  requireEncryption: boolean;
  dataResidency: string | null;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

/** Organization AI Settings - Per-org configuration */
export interface OrgAISettings {
  organizationId: string;

  // Policy Configuration
  policyLevel: AIPolicyLevel;
  maxPolicyLevel: AIPolicyLevel;
  defaultProactivityMode: AIProactivityMode;

  // AI Roles Configuration
  activeRoles: AIRole[];
  defaultRole: AIRole;

  // Model Selection (subset of SuperAdmin providers)
  enabledModelIds: string[];

  // Limits & Budget
  maxAICallsPerDay: number;
  maxTokensPerMonth: number;
  monthlyBudgetUSD: number;
  hardLimitUSD: number;
  freezeOnLimit: boolean;

  // Feature Toggles
  webSearchEnabled: boolean;
  artifactsEnabled: boolean;
  thinkingStepsEnabled: boolean;
  focusModesEnabled: boolean;
  voiceEnabled: boolean;

  // Auto-Tier Configuration
  autoTierEnabled?: boolean;
  autoTierDirection?: 'up' | 'down' | 'both';
  autoTierThreshold?: number;

  // System Prompts
  systemPrompts?: SystemPromptConfig[];
  defaultSystemPromptId?: string;

  // Audit Configuration
  auditAllRequests: boolean;
  auditPolicyChanges: boolean;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

/** System Prompt Configuration (v2 style) */
export interface SystemPromptConfig {
  id: string;
  name: string;
  content: string;
  category: 'default' | 'persona' | 'focus_mode' | 'custom';
  isActive: boolean;
  version: number;
  context_config?: {
    include_project_context?: boolean;
    include_user_context?: boolean;
    include_org_context?: boolean;
    max_context_tokens?: number;
  };
  variables?: SystemPromptVariable[];
  createdAt: string;
  updatedAt: string;
}

/** System Prompt Variable */
export interface SystemPromptVariable {
  name: string;
  description?: string;
  defaultValue?: string;
  required: boolean;
}

/** User AI Settings - Per-user preferences */
export interface UserAISettings {
  userId: string;

  // Response Behavior
  responseStyle: 'concise' | 'balanced' | 'detailed';
  writingTone: 'professional' | 'casual' | 'technical' | 'friendly';
  preferredLanguage: string;
  codeExplanations: boolean;
  showSources: boolean;

  // Proactivity Mode
  proactivityMode: AIProactivityMode;

  // Model Parameters
  modelTemperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  systemInstructions: string;

  // Model Selection (from org-enabled models)
  visibleModelIds: string[];
  preferredModelId: string | null;

  // Privacy Settings
  enablePiiRedaction: boolean;
  dataRetentionPolicy: 'minimal' | 'standard' | 'extended';
  shareUsageAnalytics: boolean;

  // Context Settings
  contextRetention: 'session' | 'day' | 'week' | 'month' | 'permanent';
  autoSuggestions: boolean;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/** AI Settings Audit Entry - Tracks all setting changes */
export interface AISettingsAuditEntry {
  id: string;
  timestamp: string;

  // Level & Actor
  level: 'superadmin' | 'admin' | 'user';
  actorId: string;
  actorRole: string;

  // Target & Change
  targetId: string; // orgId or userId or 'global'
  settingKey: string;
  oldValue: unknown;
  newValue: unknown;

  // Request Metadata
  ipAddress: string | null;
  userAgent: string | null;
}

/** Effective AI Settings - Merged settings for runtime */
export interface EffectiveAISettings {
  // Merged from all levels
  policyLevel: AIPolicyLevel;
  proactivityMode: AIProactivityMode;
  proactivityBehavior: ProactivityBehavior;

  // Response settings
  responseStyle: 'concise' | 'balanced' | 'detailed';
  writingTone: 'professional' | 'casual' | 'technical' | 'friendly';
  preferredLanguage: string;

  // Model settings
  modelTemperature: number;
  maxTokens: number;
  topP: number;
}

// ==========================================
// AI PREFERENCES & CHARTER
// ==========================================

export interface ResponseLengthSettings {
  quick: 'ultra_short' | 'short' | 'medium';
  standard: 'short' | 'medium' | 'long';
  deepStudy: 'medium' | 'long' | 'comprehensive';
}

export interface ContextualBehaviorSettings {
  chatMode: 'quick' | 'standard' | 'deepStudy';
  autoDetectIntent: boolean;
  confirmLongResponses: boolean;
  rememberModePerTopic: boolean;
}

export interface FormattingPreferences {
  preferBulletPoints: boolean;
  preferTables: boolean;
  preferCodeBlocks: boolean;
  includeExamples: 'none' | 'minimal' | 'detailed';
  includeSources: boolean;
  includeActionItems: boolean;
}

export interface FeedbackSettings {
  autoPromptAfterResponse: boolean;
  feedbackFrequency: 'always' | 'sometimes' | 'rarely';
  trackSatisfaction: boolean;
}

export interface AIPreferences {
  responseStyle: 'concise' | 'balanced' | 'detailed';
  writingTone: 'professional' | 'casual' | 'technical';
  autoSuggestions: boolean;
  contextRetention: 'session' | 'persistent' | 'minimal';
  preferredLanguage: 'auto' | 'en' | 'pl' | string;
  codeExplanations: boolean;
  showSources: boolean;
  userRole?: string;
  supportLevel?: string;
  autonomyLevel?: string;

  // Granular Model Controls
  modelTemperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  systemInstructions?: string;

  // Feature Toggles
  enableWebSearch?: boolean;
  enablePiiRedaction?: boolean;

  // Governance
  dataRetentionPolicy?: 'none' | '30days' | 'standard';
  contextWindowStrategy?: 'auto' | 'limit_8k' | 'limit_16k' | 'full';

  // v2.0 Extensions
  responseLength?: ResponseLengthSettings;
  contextualBehavior?: ContextualBehaviorSettings;
  formatting?: FormattingPreferences;
  feedbackSettings?: FeedbackSettings;
}

/** AI Charter Generation Request */
export interface AICharterRequest {
  sourceType: 'GAP' | 'REPORT' | 'MANUAL';
  gaps?: any[]; // GapForGeneration from core
  reportId?: string;
  templateId?: string;
  constraints: any; // InitiativeGeneratorConstraints from core
  organizationContext?: {
    industry: string;
    size: string;
    strategicGoals: string[];
  };
}

/** AI Generated Charter */
export interface AIGeneratedCharter {
  id?: string;
  /** Optional display name used in UI previews */
  name?: string;
  summary?: string;
  applicantOneLiner?: string;
  strategicIntent?: 'Grow' | 'Fix' | 'Stabilize' | 'De-risk' | 'Build Capability';
  hypothesis?: string;
  /** Optional timeline summary used by UI */
  timeline?: string;
  /** Optional priority label used by UI */
  priority?: 'High' | 'Medium' | 'Low' | string;
  /** Optional derived ROI estimate used by UI */
  estimatedROI?: number;

  // Structured sections
  problemStructured: any; // ProblemStructured from core
  targetState: any; // TargetState from core
  killCriteria: string[];
  suggestedTasks: any[];
  suggestedTeam: any[];
  keyRisks: { risk: string; mitigation: string; metric: 'Low' | 'Medium' | 'High' }[];
  deliverables: string[];
  milestones: { name: string; targetDate: string }[];

  // Financials
  capex?: number;
  firstYearOpex?: number;
  annualBenefit?: number;

  // Meta
  templateId?: string;
  generationConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

/** Legacy Provider Reference (stored locally) */
export interface UserAIProvider {
  id: string; // uuid
  name: string;
  provider: 'openai' | 'anthropic' | 'google' | 'ollama' | 'deepseek' | string;
  apiKey?: string;
  endpoint?: string;
  isEnabled: boolean;
  isLocal: boolean;
}

export type AIActionType =
  | 'create_task'
  | 'update_task'
  | 'create_initiative'
  | 'update_initiative'
  | 'create_decision'
  | 'schedule_meeting'
  | 'generate_report'
  | 'send_notification'
  | 'update_assessment'
  | 'create_milestone'
  | 'assign_resource'
  | 'navigate'
  | 'suggest_roadmap_change'
  | 'prepare_decision_summary'
  | 'explain_context'
  | 'analyze_risks'
  | 'custom';

export type AIActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';

/**
 * V8 canonical action lifecycle vocabulary (Chat V8 §ACTIONS_AND_APPROVALS).
 *
 * Mirrors the server-side `V8LifecycleState` union from
 * `server/src/types/chatExecutionIntegration.ts`. This is the single user-
 * visible vocabulary for `proposed → pending_review → approved/rejected →
 * executing → executed/failed → audited/closed` that chat proposal messages display.
 */
export type V8LifecycleState =
  | 'proposed'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'executed'
  | 'failed'
  | 'audited'
  | 'closed';

/**
 * Governance source of a `ChatProposalView` — mirrors the backend
 * `ProposalGovernanceSource` union (server/src/types/chatExecutionIntegration.ts).
 */
export type ProposalGovernanceSource = 'ai_actions' | 'v8_action_proposals' | 'archived';

/**
 * Unified read view of a chat proposal, returned by
 * `GET /api/ai/conversations/:conversationId/proposals`.
 *
 * Used by the chat surface to render the *current* lifecycle state of a
 * proposal, rather than the snapshot frozen into the chat message's metadata
 * at write time. Wave A6 contract.
 */
export interface ChatProposalView {
  proposalId: string;
  source: ProposalGovernanceSource;
  conversationId: string;
  chatProposalId?: string;
  messageIds: string[];
  latestMessageType?: 'execution_proposal' | 'execution_progress' | 'execution_result';
  lifecycleState: V8LifecycleState;
  actionType?: string;
  planSummary: string;
  stepCount?: number;
  steps?: Array<{ id?: string; label?: string; description?: string }>;
  risk?: string;
  renderingHints?: Record<string, unknown>;
  reviewer?: { userId?: string; name?: string } | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  resolvedAt?: string | null;
  expiresAt?: string | null;
}

/**
 * AI Action Proposal
 */
export interface AIActionProposal {
  id: string;
  conversationId?: string;
  messageId?: string;
  userId: string;
  organizationId: string;
  type: AIActionType;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  status: AIActionStatus;
  confidence: number;
  reasoning?: string;
  impact?: ActionImpact;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  executedAt?: string;
  executionResult?: unknown;
  error?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface ActionImpact {
  scope: 'user' | 'project' | 'organization';
  affectedEntities: string[];
  reversible: boolean;
  estimatedDuration?: string;
}

// ==========================================
// AI ANALYTICS TYPES
// ==========================================

/**
 * AI Usage statistics
 */
export interface AIUsageStats {
  period: {
    start: string;
    end: string;
  };
  totalCalls: number;
  totalTokens: TokenUsage;
  totalCost: number;
  avgResponseTime: number;
  successRate: number;
  byProvider: Record<LLMProvider, ProviderStats>;
  byModel: Record<string, ModelStats>;
  byUser?: Record<string, UserAIStats>;
  topPrompts?: TopPromptStats[];
}

export interface ProviderStats {
  calls: number;
  tokens: TokenUsage;
  cost: number;
  avgLatency: number;
  errorRate: number;
}

export interface ModelStats {
  calls: number;
  tokens: TokenUsage;
  cost: number;
  avgLatency: number;
}

export interface UserAIStats {
  userId: string;
  calls: number;
  tokens: number;
  cost: number;
}

export interface TopPromptStats {
  prompt: string;
  count: number;
  avgTokens: number;
}

// ==========================================
// SYSTEM PROMPT TYPES
// ==========================================

/**
 * System prompt configuration context helpers
 */
export interface SystemPromptContextConfig {
  include_project_context?: boolean;
  include_user_context?: boolean;
  include_org_context?: boolean;
  include_user_profile?: boolean;
  include_assessment_data?: boolean;
  include_kb_articles?: boolean;
  include_task_history?: boolean;
  max_context_tokens?: number;
  [key: string]: boolean | number | string | undefined;
}

/**
 * System prompt configuration
 */
export interface SystemPrompt {
  id: string;
  key: string;
  name: string;
  description?: string;
  content: string;
  category: 'default' | 'persona' | 'focus_mode' | 'custom';
  isActive: boolean;
  version: number;
  variables?: PromptVariable[];
  metadata?: Record<string, unknown>;
  context_config?: SystemPromptContextConfig | string;
  createdAt: string;
  updatedAt: string;
  updated_at?: string;
}

export interface PromptVariable {
  name: string;
  description?: string;
  defaultValue?: string;
  required: boolean;
}

// ==========================================
// V4-AI-03: CLAIM-CITATION VALIDATION TYPES
// ==========================================

export interface ClaimWithCitation {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
  citations: Array<{ citationId: string; relevance: number }>;
  verified: boolean;
  verificationStatus: 'verified' | 'unverified' | 'missing_citation' | 'weak_citation';
}

export interface ClaimValidationResult {
  totalClaims: number;
  citedClaims: number;
  uncitedClaims: number;
  coverageScore: number;
  claims: ClaimWithCitation[];
  passesPolicy: boolean;
  policyViolations: string[];
}
