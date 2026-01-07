/**
 * AI Domain Types
 * Enterprise SaaS Architecture - AI/LLM Types
 */

// ==========================================
// LLM PROVIDER TYPES
// ==========================================

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'azure' | 'ollama' | 'custom';

export type LLMTier = 'free' | 'standard' | 'premium' | 'enterprise' | 'budget';

export type LLMCapability = 'text' | 'code' | 'vision' | 'function_calling' | 'streaming' | 'embedding';

/**
 * LLM Provider configuration
 */
export interface LLMProviderConfig {
    id: string;
    provider: LLMProvider;
    name: string;
    model: string;
    model_id?: string; // For compatibility with LLMProvider
    modelId?: string; // Alias for model_id
    displayName?: string;
    apiKey?: string;
    api_key?: string; // For compatibility with LLMProvider
    baseUrl?: string;
    endpoint?: string; // For compatibility with LLMProvider
    isEnabled: boolean;
    isDefault: boolean;
    is_active?: boolean; // For compatibility with LLMProvider
    is_enabled_for_org?: boolean; // Organization context
    tier: LLMTier | string; // Relaxed type for compatibility with string inputs
    maxTokens: number;
    contextWindow: number;
    capabilities: LLMCapability[];
    costPerInputToken?: number;
    costPerOutputToken?: number;
    cost_per_1k?: number; // For compatibility with LLMProvider
    input_cost_per_1k?: number;
    output_cost_per_1k?: number;
    rateLimit?: LLMRateLimit;
    healthStatus?: 'healthy' | 'degraded' | 'unhealthy' | 'unknown' | LLMHealthStatus;
    visibility?: 'admin' | 'public' | 'beta'; // For compatibility with LLMProvider
    recommendation?: string; // For LLMSelector compatibility
    createdAt: string;
    updatedAt: string;
}

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
    focusMode?: AIFocusMode;
    systemPrompt?: string;
    customInstructions?: string;
}

/**
 * AI Message
 */
export interface AIMessage {
    id: string;
    conversationId: string;
    role: MessageRole;
    content: string;
    model?: string;
    provider?: LLMProvider;
    tokensUsed?: TokenUsage;
    artifacts?: AIArtifact[];
    toolCalls?: AIToolCall[];
    feedback?: MessageFeedback;
    metadata?: MessageMetadata;
    createdAt: string;
}

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

/**
 * AI Artifact (code, documents, diagrams, etc.)
 */
export interface AIArtifact {
    id: string;
    messageId: string;
    type: ArtifactType;
    title?: string;
    content: string;
    language?: string;
    format?: string;
    metadata?: ArtifactMetadata;
    createdAt: string;
}

export type ArtifactType =
    | 'code'
    | 'document'
    | 'diagram'
    | 'table'
    | 'chart'
    | 'pmo_document'
    | 'markdown'
    | 'json'
    | 'mermaid'
    | 'latex';

export interface ArtifactMetadata {
    filename?: string;
    lineCount?: number;
    wordCount?: number;
    isExecutable?: boolean;
    dependencies?: string[];
}

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
 * Detailed Response feedback
 */
export interface ResponseFeedback {
    rating: 'positive' | 'negative';
    comment?: string;
    timestamp: string | Date;
    metadata?: Record<string, unknown>;
    wantedMode?: string;
    lengthFeedback?: 'too_short' | 'too_long' | 'just_right';
    detailFeedback?: 'too_basic' | 'too_detailed' | 'just_right';
    customFeedback?: string;
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

export type AIPersona = 'consultant' | 'project_manager' | 'architect' | 'analyst' | 'auditor' | 'coach' | 'strategist';

export type AIFocusMode =
    | 'general'
    | 'assessment'
    | 'planning'
    | 'execution'
    | 'reporting'
    | 'analysis'
    | 'code'
    | 'documentation';

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
// AI MEMORY TYPES
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

// ==========================================
// AI ACTIONS & PROPOSALS
// ==========================================

export type AIActionType =
    | 'create_task'
    | 'update_task'
    | 'create_initiative'
    | 'update_initiative'
    | 'create_decision'
    | 'add_risk'
    | 'generate_report'
    | 'send_notification'
    | 'schedule_meeting'
    | 'custom';

export type AIActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';

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
