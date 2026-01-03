/**
 * AI Service
 * Enterprise SaaS Architecture - Typed AI Operations
 */

import { LLMProvider } from '../../types';
import type {
    AIMessage,
    AIConversation,
    LLMProviderConfig,
    SystemPrompt,
    KnowledgeDocument,
    AIUsageStats,
} from '../../types/domain/ai';
import {
    API_URL,
    getHeaders,
    fetchWithRetry,
    handleResponse
} from '../apiUtils';
import { AISchemas } from '../../schemas/ai.schema';
import { z } from 'zod';

type UpdateSystemPromptPayload = Partial<SystemPrompt> & { updatedBy?: string | null };

// ==========================================
// AI SERVICE TYPES
// ==========================================

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface ChatContext {
    projectId?: string;
    initiativeId?: string;
    screenId?: string;
    selectedText?: string;
    files?: { name: string; content: string }[];
}

interface ChatOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
}

interface ThoughtEvent {
    type: 'thought';
    thought: string;
    timestamp: string;
}

interface DiagnosisResult {
    axis?: string;
    score?: number;
    findings?: string[];
    recommendations?: string[];
    assessment?: any;
    goals?: string[];
    painPoints?: string[];
    industry?: string;
    contextSufficiency?: any;
}

interface RecommendationResult {
    id: string;
    title?: string;
    name?: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical' | 'Low' | 'Medium' | 'High' | 'Critical';
    effort?: 'low' | 'medium' | 'high' | 'Low' | 'Medium' | 'High';
    impact?: 'low' | 'medium' | 'high' | 'Low' | 'Medium' | 'High';
    category?: string;
}

interface RoadmapResult {
    phases: {
        name: string;
        startDate: string;
        endDate: string;
        initiatives: string[];
    }[];
    criticalPath: string[];
    dependencies: { from: string; to: string }[];
}

interface SimulationResult {
    scenarios: {
        name: string;
        probability: number;
        roi: number;
        npv: number;
        paybackPeriod: number;
    }[];
    sensitivity: Record<string, number>;
    risks: string[];
}

interface ValidationResult {
    isValid: boolean;
    score: number;
    issues: { severity: 'error' | 'warning' | 'info'; message: string }[];
    suggestions: string[];
}

interface AIIdea {
    id: string;
    title: string;
    description: string;
    category?: string;
    status: 'draft' | 'pending' | 'approved' | 'rejected';
    createdAt: string;
    updatedAt: string;
}

interface AIObservation {
    id: string;
    content: string;
    source: string;
    confidence: number;
    createdAt: string;
}

interface LLMAnalytics {
    totalCalls: number;
    totalTokens: number;
    avgLatency: number;
    errorRate: number;
    byProvider: Record<string, { calls: number; tokens: number }>;
    byDay: { date: string; calls: number; tokens: number }[];
}

interface LLMLog {
    id: string;
    provider: string;
    model: string;
    prompt: string;
    response?: string;
    tokens: number;
    latency: number;
    error?: string;
    createdAt: string;
}

interface LLMHealthCheck {
    provider: string;
    status: 'healthy' | 'unhealthy' | 'unknown';
    latency?: number;
    error?: string;
    lastCheck: string;
}

interface KnowledgeCandidate {
    id: string;
    content: string;
    reasoning: string;
    source: string;
    status: 'pending' | 'approved' | 'rejected';
    category?: string;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
}

interface GlobalStrategy {
    id: string;
    title: string;
    description: string;
    successMetrics?: string[];
    priority?: string;
    targetDate?: string;
    progressPercentage: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// ==========================================
// AI SERVICE IMPLEMENTATION
// ==========================================

export const AIService = {
    /**
     * Send a chat message (non-streaming)
     */
    chatWithAI: async (
        message: string,
        history: ChatMessage[],
        systemInstruction?: string,
        roleName?: string,
        options?: ChatOptions
    ): Promise<string> => {
        try {
            const response = await fetch(`${API_URL}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, history, systemInstruction, roleName, options })
            });
            const data = await response.json();
            return data.text;
        } catch (error) {
            console.error('API Chat Error', error);
            throw error;
        }
    },

    /**
     * Send a chat message with streaming response
     */
    chatWithAIStream: async (
        message: string,
        history: ChatMessage[],
        onChunk: (text: string) => void,
        onDone: () => void,
        systemInstruction?: string,
        context?: ChatContext,
        roleName?: string,
        language?: string,
        onThinking?: (thought: ThoughtEvent) => void,
        options?: ChatOptions
    ): Promise<void> => {
        try {
            const response = await fetch(`${API_URL}/ai/chat/stream`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ message, history, systemInstruction, context, roleName, language, options })
            });

            if (!response.body) throw new Error('ReadableStream not supported');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split('\n\n');

                buffer = parts.pop() || '';

                for (const part of parts) {
                    if (part.startsWith('data: ')) {
                        const dataStr = part.replace('data: ', '').trim();
                        if (dataStr === '[DONE]') {
                            onDone();
                            return;
                        }
                        try {
                            const data = JSON.parse(dataStr) as {
                                type?: string;
                                thought?: string;
                                text?: string;
                                error?: string;
                                code?: string;
                                budgetStatus?: { scope?: string };
                            };

                            if (data.type === 'thought' && onThinking) {
                                onThinking(data as ThoughtEvent);
                                continue;
                            }

                            if (data.text) onChunk(data.text);
                            if (data.error) {
                                console.error('Stream error from server:', data.error);
                                onChunk(`Error: ${data.error}`);
                                if (data.code === 'AI_BUDGET_EXHAUSTED') {
                                    const { useAppStore } = await import('../../store/useAppStore');
                                    useAppStore.getState().setAiFreezeStatus({
                                        isFrozen: true,
                                        reason: data.error,
                                        scope: data.budgetStatus?.scope || 'Global'
                                    });
                                }
                            }
                        } catch (e) {
                            console.error('Failed to parse SSE data:', e, dataStr);
                        }
                    }
                }
            }
            onDone();
        } catch (error) {
            console.error('API Chat Stream Error', error);
            throw error;
        }
    },

    // --- AI DIAGNOSTIC LAYERS ---
    aiDiagnose: async (axis: string, input: string): Promise<DiagnosisResult> => {
        const res = await fetch(`${API_URL}/ai/diagnose`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ axis, input })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Diagnosis failed');
        return data;
    },

    aiRecommend: async (diagnosisReport: DiagnosisResult): Promise<RecommendationResult[]> => {
        const res = await fetch(`${API_URL}/ai/recommend`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ diagnosisReport })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Recommendation failed');
        return data;
    },

    aiRoadmap: async (initiatives: RecommendationResult[]): Promise<RoadmapResult> => {
        const res = await fetch(`${API_URL}/ai/roadmap`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ initiatives })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Roadmap generation failed');
        return data;
    },

    aiSimulate: async (initiatives: RecommendationResult[], revenue: number = 10000000): Promise<SimulationResult> => {
        const res = await fetch(`${API_URL}/ai/simulate`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ initiatives, revenue })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Simulation failed');
        return data;
    },

    aiValidate: async (initiative: RecommendationResult): Promise<ValidationResult> => {
        const res = await fetch(`${API_URL}/ai/validate`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ initiative })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Validation failed');
        return data;
    },

    aiVerify: async (query: string): Promise<{ verified: boolean; confidence: number; sources: string[] }> => {
        const res = await fetch(`${API_URL}/ai/verify`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ query })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Verification failed');
        return data;
    },

    aiFeedback: async (feedback: { context: string; prompt: string; response: string; rating: number; correction?: string }): Promise<void> => {
        const res = await fetch(`${API_URL}/ai/feedback`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(feedback)
        });
        if (!res.ok) throw new Error('Failed to save feedback');
    },

    aiDetailFeedback: async (feedback: { action: string; rating: number; user_comment?: string; original_prompt?: string }): Promise<void> => {
        const res = await fetch(`${API_URL}/ai/feedback`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                context: feedback.action,
                prompt: feedback.original_prompt || '',
                response: '',
                rating: feedback.rating,
                correction: feedback.user_comment
            })
        });
        if (!res.ok) throw new Error('Failed to save feedback');
    },

    getIndustryBenchmarks: async (industry: string = 'General'): Promise<{ axis: string; benchmark: number; industry: string }[]> => {
        const res = await fetch(`${API_URL}/ai/benchmarks?industry=${industry}`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch benchmarks');
        return data;
    },

    // --- AI STRATEGIC BOARD & OBSERVATIONS ---
    getAIIdeas: async (): Promise<AIIdea[]> => {
        const res = await fetch(`${API_URL}/ai/ideas`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch AI ideas');
        const json = await res.json();
        // Validate response
        AISchemas.IdeaSchema.array().parse(json);
        return json;
    },

    createAIIdea: async (idea: Omit<AIIdea, 'id' | 'createdAt' | 'updatedAt'>): Promise<AIIdea> => {
        // Validate payload
        AISchemas.IdeaSchema.omit({ id: true, createdAt: true, updatedAt: true }).parse(idea);
        const res = await fetch(`${API_URL}/ai/ideas`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(idea)
        });
        if (!res.ok) throw new Error('Failed to create AI idea');
        const json = await res.json();
        // Validate response
        AISchemas.IdeaSchema.parse(json);
        return json;
    },

    updateAIIdea: async (id: string, updates: Partial<AIIdea>): Promise<AIIdea> => {
        // Validate updates
        AISchemas.IdeaSchema.partial().parse(updates);
        const res = await fetch(`${API_URL}/ai/ideas/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update AI idea');
        const json = await res.json();
        AISchemas.IdeaSchema.parse(json);
        return json;
    },

    deleteAIIdea: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/ai/ideas/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete AI idea');
    },

    getAIObservations: async (): Promise<AIObservation[]> => {
        const res = await fetch(`${API_URL}/ai/observations`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch observations');
        return res.json();
    },

    createAIObservation: async (observation: Omit<AIObservation, 'id' | 'createdAt'>): Promise<AIObservation> => {
        const res = await fetch(`${API_URL}/ai/observations`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(observation)
        });
        if (!res.ok) throw new Error('Failed to create observation');
        return res.json();
    },

    generateGlobalBrainObservations: async (): Promise<{ observations: AIObservation[]; count: number }> => {
        const response = await fetch(`${API_URL}/knowledge/observations/generate`, {
            method: 'GET',
            headers: getHeaders()
        });
        if (!response.ok) throw new Error('Failed to generate observations');
        return response.json();
    },

    // --- AI REPORTS & STATS ---
    getAIDeepReports: async (): Promise<{ reports: unknown[]; summary: unknown }> => {
        const res = await fetch(`${API_URL}/ai/reports/performance`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch AI reports');
        return res.json();
    },

    aiGetStats: async (): Promise<AIUsageStats> => {
        const res = await fetch(`${API_URL}/ai/stats`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch AI stats');
        return data;
    },

    // --- LLM PROVIDER MANAGEMENT ---
    getLLMProviders: async (adminContext = false): Promise<LLMProviderConfig[]> => {
        const headers: Record<string, string> = { ...getHeaders() };
        if (adminContext) {
            const { AuthService } = await import('./AuthService');
            const user = await AuthService.getMe();
            headers['x-org-context'] = user?.organizationId || '';
        }
        const res = await fetch(`${API_URL}/llm/providers`, { headers });
        if (!res.ok) throw new Error('Failed to fetch LLM providers');
        const json = await res.json();
        AISchemas.LLMProviderSchema.array().parse(json);
        return json;
    },

    getLLMAnalytics: async (days: number = 7): Promise<LLMAnalytics> => {
        const res = await fetch(`${API_URL}/llm/analytics?days=${days}`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch analytics');
        return res.json();
    },

    getLLMLogs: async (limit: number = 50, offset: number = 0, onlyErrors: boolean = false): Promise<{ logs: LLMLog[]; total: number }> => {
        const res = await fetch(`${API_URL}/llm/logs?limit=${limit}&offset=${offset}&errors=${onlyErrors}`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch logs');
        return res.json();
    },

    toggleOrganizationLLM: async (providerId: string, enabled: boolean): Promise<{ success: boolean }> => {
        const res = await fetch(`${API_URL}/llm/providers/organization/toggle`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ providerId, enabled })
        });
        return handleResponse(res, 'Failed to toggle provider');
    },

    addLLMProvider: async (provider: Omit<LLMProviderConfig, 'id' | 'createdAt' | 'updatedAt' | 'healthStatus'>): Promise<void> => {
        const res = await fetch(`${API_URL}/llm/providers`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(provider)
        });
        if (!res.ok) throw new Error('Failed to add provider');
    },

    updateLLMProvider: async (id: string, data: Partial<LLMProvider>): Promise<LLMProviderConfig> => {
        const res = await fetch(`${API_URL}/llm/providers/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update provider');
        return res.json();
    },

    updateProviderTier: async (id: string, tier: string): Promise<LLMProviderConfig> => {
        const res = await fetch(`${API_URL}/llm/providers/${id}/tier`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ tier })
        });
        if (!res.ok) throw new Error('Failed to update provider tier');
        return res.json();
    },

    testLLMConnection: async (config: Partial<LLMProvider>): Promise<{ success: boolean; message: string; response?: string }> => {
        const res = await fetch(`${API_URL}/llm/test`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(config)
        });
        const data = await res.json();
        if (!res.ok) return { success: false, message: data.error || 'Connection failed' };
        return data;
    },

    deleteLLMProvider: async (id: string): Promise<void> => {
        const res = await fetch(`${API_URL}/llm/providers/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete provider');
    },

    // --- SYSTEM PROMPTS ---
    aiGetSystemPrompts: async (): Promise<SystemPrompt[]> => {
        const res = await fetch(`${API_URL}/llm/prompts`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch system prompts');
        return res.json();
    },

    aiUpdateSystemPrompt: async (key: string, data: UpdateSystemPromptPayload): Promise<void> => {
        const res = await fetch(`${API_URL}/llm/prompts/${key}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update prompt');
    },

    aiSeedSystemPrompts: async (): Promise<void> => {
        await fetch(`${API_URL}/llm/prompts/reset-defaults`, {
            method: 'POST',
            headers: getHeaders()
        });
    },

    // --- MORE LLM TOOLS ---
    getPublicLLMProviders: async (): Promise<LLMProviderConfig[]> => {
        const res = await fetch(`${API_URL}/llm/providers/public`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch public LLM providers');
        return res.json();
    },

    testOllamaConnection: async (endpoint: string): Promise<{ success: boolean; message?: string; models?: { name: string; size: number }[]; error?: string }> => {
        const res = await fetch(`${API_URL}/llm/test-ollama`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ endpoint })
        });
        return res.json();
    },

    getOllamaModels: async (endpoint: string): Promise<{ name: string; size: number }[]> => {
        const res = await fetch(`${API_URL}/llm/ollama-models?endpoint=${encodeURIComponent(endpoint)}`, {
            headers: getHeaders()
        });
        if (!res.ok) return [];
        return res.json();
    },

    getOrganizationLLMConfig: async (orgId: string): Promise<{ activeProviderId: string | null; availableProviders: LLMProviderConfig[] }> => {
        const res = await fetch(`${API_URL}/llm/organization-config/${orgId}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch organization LLM config');
        return res.json();
    },

    updateOrganizationLLMConfig: async (orgId: string, providerId: string | null): Promise<void> => {
        const res = await fetch(`${API_URL}/llm/organization-config/${orgId}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ providerId })
        });
        if (!res.ok) throw new Error('Failed to update organization LLM config');
    },

    diagnoseLLM: async (): Promise<{ status: string; checks: LLMHealthCheck[]; repairs: string[]; version: string }> => {
        const res = await fetch(`${API_URL}/llm/diagnose`);
        if (!res.ok) throw new Error('LLM diagnosis failed');
        return res.json();
    },

    checkLLMProvidersHealth: async (): Promise<{ providers: LLMHealthCheck[]; overall: 'healthy' | 'degraded' | 'unhealthy' }> => {
        const res = await fetch(`${API_URL}/llm/providers/health`);
        if (!res.ok) throw new Error('Health check failed');
        return res.json();
    },

    getUserAIUsage: async (): Promise<{ tokensUsed: number; tokensLimit: number; callsToday: number; lastCall?: string }> => {
        const res = await fetch(`${API_URL}/llm/user/usage`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch user AI usage');
        return res.json();
    },

    getUserActiveModel: async (): Promise<{ provider: string; model: string; tier: string }> => {
        const res = await fetch(`${API_URL}/llm/user/active-model`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch active model');
        return res.json();
    },

    getRecommendedLLMProvider: async (tier: string = 'STANDARD'): Promise<LLMProviderConfig | null> => {
        const res = await fetch(`${API_URL}/llm/providers/recommended?tier=${tier}`);
        if (!res.ok) throw new Error('Failed to get recommendation');
        return res.json();
    },

    // --- AI LEARNING & KNOWLEDGE ---
    aiExtractInsights: async (text: string, source: string = 'chat'): Promise<{ insights: string[]; topics: string[]; sentiment: string }> => {
        const res = await fetch(`${API_URL}/ai/extract-insight`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ text, source })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to extract insights');
        return data;
    },

    getKnowledgeCandidates: async (status: string = 'pending'): Promise<KnowledgeCandidate[]> => {
        const res = await fetch(`${API_URL}/knowledge/candidates?status=${status}`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch candidates');
        return data;
    },

    submitKnowledgeCandidate: async (content: string, reasoning: string, source: string, topic?: string): Promise<void> => {
        const res = await fetch(`${API_URL}/knowledge/candidates`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ content, reasoning, source, relatedAxis: topic })
        });
        if (!res.ok) throw new Error('Failed to submit candidate');
    },

    updateCandidateStatus: async (id: string, status: string, adminComment?: string): Promise<void> => {
        const res = await fetch(`${API_URL}/knowledge/candidates/${id}/status`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ status, adminComment })
        });
        if (!res.ok) throw new Error('Failed to update candidate status');
    },

    updateKnowledgeCandidate: async (id: string, updates: { category?: string; tags?: string[]; implementation_notes?: string; impact_score?: number; status?: string }): Promise<KnowledgeCandidate> => {
        const res = await fetch(`${API_URL}/knowledge/candidates/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update candidate');
        return data;
    },

    linkIdeaToProject: async (ideaId: string, projectId: string, notes?: string): Promise<{ success: boolean }> => {
        const res = await fetch(`${API_URL}/knowledge/candidates/${ideaId}/link-project`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ project_id: projectId, notes })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to link idea to project');
        return data;
    },

    getApprovedIdeas: async (filters?: { category?: string }): Promise<KnowledgeCandidate[]> => {
        const params = new URLSearchParams();
        if (filters?.category) params.append('category', filters.category);
        const url = `${API_URL}/knowledge/candidates/approved${params.toString() ? '?' + params.toString() : ''}`;
        const res = await fetch(url, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch approved ideas');
        return data;
    },

    getIdeasByCategory: async (category: string): Promise<KnowledgeCandidate[]> => {
        const res = await fetch(`${API_URL}/knowledge/candidates/by-category/${encodeURIComponent(category)}`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch ideas');
        return data;
    },

    getIdeasByProject: async (projectId: string): Promise<KnowledgeCandidate[]> => {
        const res = await fetch(`${API_URL}/knowledge/candidates/by-project/${projectId}`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch ideas');
        return data;
    },

    getGlobalStrategies: async (): Promise<GlobalStrategy[]> => {
        const res = await fetch(`${API_URL}/knowledge/strategies`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch strategies');
        return data;
    },

    createGlobalStrategy: async (title: string, description: string, options?: { success_metrics?: string[]; priority?: string; target_date?: string; progress_percentage?: number }): Promise<GlobalStrategy> => {
        const res = await fetch(`${API_URL}/knowledge/strategies`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ title, description, ...options })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create strategy');
        return data;
    },

    updateGlobalStrategy: async (id: string, updates: { title?: string; description?: string; success_metrics?: string[]; priority?: string; target_date?: string; progress_percentage?: number; is_active?: boolean }): Promise<GlobalStrategy> => {
        const res = await fetch(`${API_URL}/knowledge/strategies/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update strategy');
        return data;
    },

    linkStrategyToDocument: async (strategyId: string, documentId: string): Promise<{ success: boolean }> => {
        const res = await fetch(`${API_URL}/knowledge/strategies/${strategyId}/link-document`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ document_id: documentId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to link document to strategy');
        return data;
    },

    linkStrategyToIdea: async (strategyId: string, ideaId: string): Promise<{ success: boolean }> => {
        const res = await fetch(`${API_URL}/knowledge/strategies/${strategyId}/link-idea`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ idea_id: ideaId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to link idea to strategy');
        return data;
    },

    unlinkStrategyFromDocument: async (strategyId: string, documentId: string): Promise<{ success: boolean }> => {
        const res = await fetch(`${API_URL}/knowledge/strategies/${strategyId}/unlink-document/${documentId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to unlink document from strategy');
        return data;
    },

    unlinkStrategyFromIdea: async (strategyId: string, ideaId: string): Promise<{ success: boolean }> => {
        const res = await fetch(`${API_URL}/knowledge/strategies/${strategyId}/unlink-idea/${ideaId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to unlink idea from strategy');
        return data;
    },

    updateStrategyProgress: async (strategyId: string, progressPercentage: number): Promise<GlobalStrategy> => {
        const res = await fetch(`${API_URL}/knowledge/strategies/${strategyId}/progress`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ progress_percentage: progressPercentage })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update strategy progress');
        return data;
    },

    getStrategyWithRelated: async (strategyId: string): Promise<GlobalStrategy & { documents: KnowledgeDocument[]; ideas: KnowledgeCandidate[] }> => {
        const res = await fetch(`${API_URL}/knowledge/strategies/${strategyId}/related`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch strategy');
        return data;
    },

    getAllGlobalStrategies: async (): Promise<GlobalStrategy[]> => {
        const res = await fetch(`${API_URL}/knowledge/strategies?all=true`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch strategies');
        return data;
    },

    toggleGlobalStrategy: async (id: string, isActive: boolean): Promise<GlobalStrategy> => {
        const res = await fetch(`${API_URL}/knowledge/strategies/${id}/toggle`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ isActive })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to toggle strategy');
        return data;
    },

    getKnowledgeDocuments: async (): Promise<KnowledgeDocument[]> => {
        const res = await fetch(`${API_URL}/knowledge/documents`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch docs');
        return data;
    },

    uploadKnowledgeDocument: async (file: File, category?: string, tags?: string[]): Promise<KnowledgeDocument> => {
        const formData = new FormData();
        formData.append('file', file);
        if (category) formData.append('category', category);
        if (tags && tags.length > 0) {
            formData.append('tags', JSON.stringify(tags));
        }

        const headers = getHeaders();
        delete (headers as Record<string, string>)['Content-Type'];

        const res = await fetch(`${API_URL}/knowledge/documents`, {
            method: 'POST',
            headers: headers,
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload document');
        return data;
    },

    updateKnowledgeDocument: async (id: string, updates: { category?: string; tags?: string[]; version?: number; parent_doc_id?: string }): Promise<KnowledgeDocument> => {
        const res = await fetch(`${API_URL}/knowledge/documents/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updates)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update document');
        return data;
    },

    getKnowledgeDocumentsByCategory: async (category: string): Promise<KnowledgeDocument[]> => {
        const res = await fetch(`${API_URL}/knowledge/documents?category=${encodeURIComponent(category)}`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch documents');
        return data;
    },

    getKnowledgeDocumentsByStrategy: async (strategyId: string): Promise<KnowledgeDocument[]> => {
        const res = await fetch(`${API_URL}/knowledge/documents/by-strategy/${strategyId}`, { headers: getHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch documents');
        return data;
    },

    uploadDocument: async (file: File, context?: { tabName?: string, type?: string }): Promise<{ id: string; url: string; filename: string }> => {
        const formData = new FormData();
        formData.append('file', file);
        if (context) {
            formData.append('context', JSON.stringify(context));
        }

        const headers = getHeaders();
        delete (headers as Record<string, string>)['Content-Type'];

        const res = await fetch(`${API_URL}/documents/upload`, {
            method: 'POST',
            headers: headers,
            body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to upload document');
        return data;
    },
};
