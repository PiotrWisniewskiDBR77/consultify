# AI Master Architecture for Consultify

## Executive Summary

Ten dokument przedstawia kompletną architekturę systemu AI dla Consultify - platformy konsultingowej do transformacji cyfrowej. Architektura opiera się na analizach przeprowadzonych w Fazach 1-5 i definiuje "AI Consultant" - inteligentny system, który prowadzi użytkowników przez transformację jak senior consultant.

**Kluczowe decyzje architektoniczne:**
- **Orchestration:** Custom pipeline na bazie Vercel AI SDK (nie LangChain)
- **Gateway:** Unified AI Gateway (LiteLLM style) dla modeli cloud (OpenAI, Anthropic), chińskich (DeepSeek) i lokalnych (Ollama)
- **Tools:** Centralny serwer MCP (Model Context Protocol) dla "rąk" AI
- **Context:** Dynamic Screen State Serialization (JSON) dla "oczu" AI
- **Models:** Multi-tier routing (GPT-4o-mini default, Claude 3.5 Sonnet generation, o1-mini MAX Mode)
- **Memory:** 5-warstwowa architektura z pgvector
- **Agents:** Single agent z dynamic role switching + pipeline dla raportów
- **Security:** PII scrubbing + injection guards + full audit trail

**Przewidywane koszty:** $0.20-0.50 per active user per month (przy optymalizacji)

---

## 1. Vision & Strategic Goals

### 1.1 The North Star

> **Consultify AI = Virtual Senior Consultant**
> 
> Użytkownik nigdy nie powinien czuć się sam w procesie transformacji.
> AI prowadzi, doradza, generuje i uczy - ale ostateczne decyzje należą do człowieka.

### 1.2 Design Principles

1. **AI as Copilot, Not Autopilot**
   - AI sugeruje, użytkownik decyduje
   - Wszystkie mutacje wymagają zatwierdzenia
   - Draft-Review-Approve workflow

2. **Context is King**
   - AI zawsze zna kontekst projektu, fazy, roli użytkownika
   - **Visual Awareness:** AI widzi to, co użytkownik ma na ekranie (JSON State Serialization)
   - 5 warstw pamięci zapewnia ciągłość
   - Żadnych "generic" odpowiedzi

3. **Predictable Costs**
   - Tiered model routing
   - Budget management z auto-downgrade
   - Semantic caching

4. **Enterprise Security**
   - PII protection
   - Multi-tenant isolation
   - Full audit trail

### 1.3 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| User Satisfaction (AI) | >4.2/5.0 | Post-interaction rating |
| AI Adoption Rate | >70% | Users using AI features monthly |
| Task Completion Rate | >85% | AI-assisted tasks completed |
| Cost per User | <$0.50/month | AI costs / active users |
| Response Time | <3s (p95) | Time to first token |
| Accuracy | >90% | User-reported accuracy |

---

## 2. System Architecture Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CONSULTIFY                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         FRONTEND (React)                              │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │   │
│  │  │  Chat   │ │ Magic   │ │ Report  │ │ Draft   │ │  Task   │        │   │
│  │  │  Panel  │ │  Wand   │ │ Viewer  │ │ Editor  │ │  Advice │        │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘        │   │
│  │       └──────────┬┴──────────┬┴──────────┬┴──────────┬┘              │   │
│  │                  │           │           │           │                │   │
│  │                  ▼           ▼           ▼           ▼                │   │
│  │            ┌─────────────────────────────────────────────┐           │   │
│  │            │           AI Context Provider               │           │   │
│  │            │      (useAI hook, streaming state)          │           │   │
│  │            └─────────────────────────────────────────────┘           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│                                     │ REST/WebSocket                         │
│                                     ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         BACKEND (Node.js)                             │   │
│  │                                                                        │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │                      AI GATEWAY LAYER                           │  │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │  │   │
│  │  │  │  Access  │ │   Rate   │ │   PII    │ │ Injection│          │  │   │
│  │  │  │   Gate   │ │  Limiter │ │ Scrubber │ │  Guard   │          │  │   │
│  │  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │  │   │
│  │  │       └────────────┴────────────┴────────────┘                 │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  │                                     │                                  │   │
│  │                                     ▼                                  │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │                   UNIFIED AI HUB (Gateway)                      │  │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │  │   │
│  │  │  │ Cloud    │ │ Chinese  │ │ Local    │ │ MCP      │          │  │   │
│  │  │  │ (OpenAI) │ │ (D.Seek) │ │ (Ollama) │ │ Server   │          │  │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  │                                     │                                  │   │
│  │                                     ▼                                  │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │                      AI PIPELINE (The Spine)                    │  │   │
│  │  │                                                                  │  │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │  │   │
│  │  │  │ Context  │  │  Prompt  │  │  Model   │  │   LLM    │        │  │   │
│  │  │  │ Builder  │─►│ Assembler│─►│  Router  │─►│  Service │        │  │   │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │  │   │
│  │  │       │                                           │              │  │   │
│  │  │       ▼                                           ▼              │  │   │
│  │  │  ┌──────────┐                              ┌──────────┐         │  │   │
│  │  │  │  Memory  │                              │   Post   │         │  │   │
│  │  │  │ Manager  │                              │ Process  │         │  │   │
│  │  │  └──────────┘                              └──────────┘         │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  │                                     │                                  │   │
│  │                                     ▼                                  │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │                      AI CAPABILITIES (The Hands)               │  │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │  │   │
│  │  │  │   Chat   │ │  Magic   │ │  Report  │ │ Initiative│          │  │   │
│  │  │  │ Service  │ │   Wand   │ │Generator │ │ Generator │          │  │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │  │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │  │   │
│  │  │  │   Task   │ │   Risk   │ │Benchmarks│ │   MAX    │          │  │   │
│  │  │  │  Advisor │ │ Analyzer │ │  Analyzer│ │   Mode   │          │  │   │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                     │                                        │
│                                     ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         DATA LAYER                                    │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                │   │
│  │  │PostgreSQL│ │  Redis   │ │ pgvector │ │  Audit   │                │   │
│  │  │  (data)  │ │ (cache)  │ │ (vectors)│ │   Log    │                │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL PROVIDERS                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│  │  OpenAI  │ │Anthropic │ │  Google  │ │ Langfuse │                       │
│  │   API    │ │   API    │ │   API    │ │ (observ.)│                       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Responsibilities

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| AI Gateway | Security, rate limiting, PII protection | Express middleware |
| Unified Hub | Model abstraction, routing, load balancing | LiteLLM / Node.js Proxy |
| MCP Server | Centralized tool management (The Hands) | Model Context Protocol |
| AI Pipeline | Request orchestration, context building | Custom TypeScript |
| LLM Service | Provider abstraction, streaming | Vercel AI SDK |
| Memory Manager | 5-layer memory retrieval | PostgreSQL + Redis |
| Capabilities | Domain-specific AI features | Custom services |
| Audit Logger | Full request/response logging | PostgreSQL |

---

## 3. AI Pipeline (The Spine)

### 3.1 Pipeline Flow

```
Request → Gateway → Pipeline → Response
           │           │
           │    ┌──────┴──────┐
           │    │             │
           ▼    ▼             ▼
        [Security]      [Processing]
        - Access        - Context Build
        - Rate Limit    - Prompt Assemble
        - PII Scrub     - Model Select
        - Injection     - LLM Call
                        - Post-process
                        - Audit Log
```

### 3.2 Pipeline Implementation

```typescript
// server/services/ai/pipeline.ts

import { generateText, generateObject, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

interface PipelineRequest {
  type: 'chat' | 'generation' | 'structured';
  userId: string;
  organizationId: string;
  projectId?: string;
  
  messages?: Message[];
  prompt?: string;
  schema?: z.ZodSchema;
  
  capability: string;  // 'chat', 'magic_wand', 'report', etc.
  screenContext?: string;
  
  options?: {
    model?: string;
    tier?: 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING';
    stream?: boolean;
    maxTokens?: number;
  };
}

interface PipelineResponse {
  content: string | object;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cost: number;
  };
  metadata: {
    model: string;
    latency: number;
    cached: boolean;
    auditId: string;
  };
}

class AIPipeline {
  private gateway: AIGateway;
  private contextBuilder: ContextBuilder;
  private promptAssembler: PromptAssembler;
  private modelRouter: ModelRouter;
  private llmService: LLMService;
  private memoryManager: MemoryManager;
  private auditLogger: AuditLogger;
  
  async process(request: PipelineRequest): Promise<PipelineResponse> {
    const startTime = Date.now();
    
    // 1. Gateway checks (security, rate limiting, PII)
    await this.gateway.process(request);
    
    // 1.1 Capture Visual Context (JSON State)
    const visualContext = await this.visualContext.capture();
    
    // 2. Build enriched context
    const context = await this.contextBuilder.build({
      userId: request.userId,
      organizationId: request.organizationId,
      projectId: request.projectId,
      screenContext: request.screenContext || visualContext,
      capability: request.capability
    });
    
    // 3. Retrieve relevant memory
    const memory = await this.memoryManager.retrieve({
      query: request.prompt || request.messages?.slice(-1)[0].content || '',
      context,
      layers: ['project', 'organization', 'knowledge']
    });
    
    // 4. Assemble final prompt
    const { systemPrompt, messages } = await this.promptAssembler.build({
      request,
      context,
      memory
    });
    
    // 5. Select optimal model
    const model = await this.modelRouter.select({
      capability: request.capability,
      tier: request.options?.tier,
      budgetStatus: await this.getBudgetStatus(request.organizationId)
    });
    
    // 6. Check semantic cache
    const cacheKey = this.getCacheKey(request, context);
    const cached = await this.semanticCache.get(cacheKey);
    if (cached) {
      return this.createResponse(cached, { cached: true, model, startTime });
    }
    
    // 7. Call LLM
    const llmResponse = await this.llmService.call({
      type: request.type,
      model,
      systemPrompt,
      messages: messages || [{ role: 'user', content: request.prompt }],
      schema: request.schema,
      stream: request.options?.stream
    });
    
    // 8. Post-process response
    const processed = await this.postProcess(llmResponse, request);
    
    // 9. Cache response
    await this.semanticCache.set(cacheKey, processed);
    
    // 10. Record memory (if significant)
    await this.memoryManager.recordIfSignificant(request, processed);
    
    // 11. Audit log
    const auditId = await this.auditLogger.log({
      request,
      response: processed,
      model,
      latency: Date.now() - startTime
    });
    
    return this.createResponse(processed, {
      cached: false,
      model,
      startTime,
      auditId
    });
  }
}
```

### 3.3 LLM Service (Vercel AI SDK Wrapper)

```typescript
// server/services/ai/llmService.ts

import { generateText, generateObject, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

type Provider = 'openai' | 'anthropic' | 'google';

interface ModelConfig {
  provider: Provider;
  modelId: string;
  maxTokens: number;
  supportsStructured: boolean;
  supportsStreaming: boolean;
  costPer1MInput: number;
  costPer1MOutput: number;
}

const MODELS: Record<string, ModelConfig> = {
  'gpt-4o': {
    provider: 'openai',
    modelId: 'gpt-4o',
    maxTokens: 16384,
    supportsStructured: true,
    supportsStreaming: true,
    costPer1MInput: 2.50,
    costPer1MOutput: 10.00
  },
  'gpt-4o-mini': {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    maxTokens: 16384,
    supportsStructured: true,
    supportsStreaming: true,
    costPer1MInput: 0.15,
    costPer1MOutput: 0.60
  },
  'claude-3.5-sonnet': {
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    maxTokens: 8192,
    supportsStructured: true,
    supportsStreaming: true,
    costPer1MInput: 3.00,
    costPer1MOutput: 15.00
  },
  'o1-mini': {
    provider: 'openai',
    modelId: 'o1-mini',
    maxTokens: 65536,
    supportsStructured: false,
    supportsStreaming: false,
    costPer1MInput: 3.00,
    costPer1MOutput: 12.00
  }
};

class LLMService {
  private getProvider(name: Provider) {
    switch (name) {
      case 'openai': return openai;
      case 'anthropic': return anthropic;
      case 'google': return google;
    }
  }
  
  async generateText(config: {
    model: string;
    systemPrompt: string;
    messages: Message[];
    maxTokens?: number;
  }): Promise<LLMResponse> {
    const modelConfig = MODELS[config.model];
    const provider = this.getProvider(modelConfig.provider);
    
    const result = await generateText({
      model: provider(modelConfig.modelId),
      system: config.systemPrompt,
      messages: config.messages,
      maxTokens: config.maxTokens || modelConfig.maxTokens
    });
    
    return {
      content: result.text,
      usage: {
        inputTokens: result.usage.promptTokens,
        outputTokens: result.usage.completionTokens,
        cost: this.calculateCost(result.usage, modelConfig)
      }
    };
  }
  
  async generateStructured<T>(config: {
    model: string;
    systemPrompt: string;
    prompt: string;
    schema: z.ZodSchema<T>;
  }): Promise<StructuredResponse<T>> {
    const modelConfig = MODELS[config.model];
    const provider = this.getProvider(modelConfig.provider);
    
    const { object, usage } = await generateObject({
      model: provider(modelConfig.modelId),
      system: config.systemPrompt,
      prompt: config.prompt,
      schema: config.schema
    });
    
    return {
      content: object,
      usage: {
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
        cost: this.calculateCost(usage, modelConfig)
      }
    };
  }
  
  async *streamText(config: {
    model: string;
    systemPrompt: string;
    messages: Message[];
  }): AsyncGenerator<string, void, unknown> {
    const modelConfig = MODELS[config.model];
    const provider = this.getProvider(modelConfig.provider);
    
    const result = await streamText({
      model: provider(modelConfig.modelId),
      system: config.systemPrompt,
      messages: config.messages
    });
    
    for await (const chunk of result.textStream) {
      yield chunk;
    }
  }
  
  private calculateCost(
    usage: { promptTokens: number; completionTokens: number },
    config: ModelConfig
  ): number {
    const inputCost = (usage.promptTokens / 1_000_000) * config.costPer1MInput;
    const outputCost = (usage.completionTokens / 1_000_000) * config.costPer1MOutput;
    return inputCost + outputCost;
  }
}
```

---

## 4. Governance Hub (The Brain)

### 4.1 Prompt Management

```typescript
// server/services/ai/promptManager.ts

interface PromptTemplate {
  id: string;
  key: string;
  type: 'GLOBAL' | 'ROLE' | 'PHASE' | 'CAPABILITY' | 'TASK';
  template: string;
  variables: string[];
  version: number;
  isActive: boolean;
  metadata: {
    author: string;
    createdAt: Date;
    lastUsed: Date;
    usageCount: number;
  };
}

class PromptManager {
  private cache: Map<string, { prompt: PromptTemplate; expires: number }> = new Map();
  
  // 4-layer prompt stack
  async buildSystemPrompt(context: PromptContext): Promise<string> {
    const layers = await Promise.all([
      this.getPrompt('GLOBAL_SYSTEM'),                    // Layer 1: Global
      this.getPrompt(`ROLE_${context.userRole}`),         // Layer 2: Role
      this.getPrompt(`PHASE_${context.projectPhase}`),    // Layer 3: Phase
      this.getPrompt(`CAPABILITY_${context.capability}`)  // Layer 4: Capability
    ]);
    
    // Interpolate variables
    const interpolated = layers.map(layer => 
      this.interpolate(layer, context.variables)
    );
    
    return this.stackPrompts(interpolated);
  }
  
  private interpolate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return variables[key] ?? `{{${key}}}`;
    });
  }
  
  private stackPrompts(layers: string[]): string {
    return layers.filter(Boolean).join('\n\n---\n\n');
  }
}
```

**Prompt Database Schema:**

```sql
CREATE TABLE ai_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('GLOBAL', 'ROLE', 'PHASE', 'CAPABILITY', 'TASK')),
    template TEXT NOT NULL,
    variables TEXT[] DEFAULT '{}',
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    author VARCHAR(100),
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt version history
CREATE TABLE ai_prompts_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL REFERENCES ai_prompts(id),
    version INTEGER NOT NULL,
    template TEXT NOT NULL,
    changed_by VARCHAR(100),
    change_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prompt A/B testing
CREATE TABLE ai_prompt_experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_key VARCHAR(100) NOT NULL,
    variant_a_id UUID NOT NULL REFERENCES ai_prompts(id),
    variant_b_id UUID NOT NULL REFERENCES ai_prompts(id),
    traffic_split DECIMAL(3,2) DEFAULT 0.50,
    metric VARCHAR(50) NOT NULL, -- 'user_rating', 'acceptance_rate', etc.
    status VARCHAR(20) DEFAULT 'active',
    winner_id UUID REFERENCES ai_prompts(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);
```

### 4.2 Model Routing

```typescript
// server/services/ai/modelRouter.ts

type ModelTier = 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING';

const CAPABILITY_TIERS: Record<string, ModelTier> = {
  // Budget tier (GPT-4o-mini)
  'chat_simple': 'BUDGET',
  'magic_wand': 'BUDGET',
  'field_suggest': 'BUDGET',
  'summarize': 'BUDGET',
  
  // Standard tier (Claude 3.5 Sonnet / GPT-4o)
  'chat_complex': 'STANDARD',
  'report_section': 'STANDARD',
  'gap_analysis': 'STANDARD',
  'risk_assessment': 'STANDARD',
  
  // Premium tier (GPT-4o / Claude 3 Opus)
  'full_report': 'PREMIUM',
  'initiative_generation': 'PREMIUM',
  'roadmap_planning': 'PREMIUM',
  'executive_summary': 'PREMIUM',
  
  // Reasoning tier (o1-mini / o1-preview)
  'max_mode_analysis': 'REASONING',
  'strategy_synthesis': 'REASONING',
  'complex_decision': 'REASONING'
};

const TIER_MODELS: Record<ModelTier, string[]> = {
  BUDGET: ['gpt-4o-mini', 'claude-3.5-haiku', 'gemini-1.5-flash'],
  STANDARD: ['claude-3.5-sonnet', 'gpt-4o'],
  PREMIUM: ['gpt-4o', 'claude-3-opus'],
  REASONING: ['o1-mini', 'o1-preview']
};

class ModelRouter {
  async select(config: {
    capability: string;
    tier?: ModelTier;
    budgetStatus: BudgetStatus;
    userPreference?: string;
  }): Promise<string> {
    // 1. Determine base tier from capability
    let tier = config.tier || CAPABILITY_TIERS[config.capability] || 'STANDARD';
    
    // 2. Apply budget constraints
    tier = this.applyBudgetConstraints(tier, config.budgetStatus);
    
    // 3. Get available models for tier
    const models = TIER_MODELS[tier];
    
    // 4. Check user/org preference
    if (config.userPreference && models.includes(config.userPreference)) {
      return config.userPreference;
    }
    
    // 5. Return first available (with fallback)
    return this.getFirstAvailable(models);
  }
  
  private applyBudgetConstraints(
    tier: ModelTier,
    budget: BudgetStatus
  ): ModelTier {
    const { percentUsed } = budget;
    
    if (percentUsed >= 100 && budget.freezeOnLimit) {
      throw new BudgetExhaustedError('AI budget exhausted');
    }
    
    if (percentUsed >= 95) return 'BUDGET';
    if (percentUsed >= 85 && tier === 'REASONING') return 'PREMIUM';
    if (percentUsed >= 80 && tier === 'PREMIUM') return 'STANDARD';
    if (percentUsed >= 70 && tier === 'STANDARD') return 'BUDGET';
    
    return tier;
  }
}
```

---

## 5. Memory Architecture (The Memory)

### 5.1 Five-Layer Memory System

```
┌─────────────────────────────────────────────────────────────────┐
│                     LAYER 5: EXTERNAL                            │
│              Web Search, Industry APIs                           │
│                    TTL: Request-only                             │
│              Storage: None (real-time fetch)                     │
├─────────────────────────────────────────────────────────────────┤
│                     LAYER 4: KNOWLEDGE BASE                      │
│        DRD Methodology, Best Practices, Templates                │
│                    TTL: Permanent (versioned)                    │
│              Storage: PostgreSQL + pgvector                      │
├─────────────────────────────────────────────────────────────────┤
│                     LAYER 3: ORGANIZATION                        │
│      Org documents, Past projects, Patterns                      │
│                    TTL: Persistent (org-scoped)                  │
│              Storage: PostgreSQL + pgvector                      │
├─────────────────────────────────────────────────────────────────┤
│                     LAYER 2: PROJECT                             │
│    Decisions, Phase transitions, Learnings                       │
│                    TTL: Persistent (project-scoped)              │
│              Storage: PostgreSQL                                 │
├─────────────────────────────────────────────────────────────────┤
│                     LAYER 1: SESSION                             │
│       Current conversation, Recent context                       │
│                    TTL: 2 hours                                  │
│              Storage: Redis                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Memory Manager Implementation

```typescript
// server/services/ai/memoryManager.ts

interface MemoryQuery {
  query: string;
  context: {
    userId: string;
    organizationId: string;
    projectId?: string;
  };
  layers: MemoryLayer[];
  maxChunks?: number;
}

type MemoryLayer = 'session' | 'project' | 'organization' | 'knowledge' | 'external';

interface MemoryResult {
  chunks: MemoryChunk[];
  sources: Record<MemoryLayer, number>;
  totalTokens: number;
}

class MemoryManager {
  private sessionStore: SessionMemoryStore;      // Redis
  private projectStore: ProjectMemoryStore;      // PostgreSQL
  private orgStore: OrganizationMemoryStore;     // PostgreSQL + pgvector
  private knowledgeStore: KnowledgeBaseStore;    // PostgreSQL + pgvector
  private externalStore: ExternalSearchStore;    // API calls
  
  async retrieve(query: MemoryQuery): Promise<MemoryResult> {
    const { context, layers, maxChunks = 10 } = query;
    const allChunks: MemoryChunk[] = [];
    const sources: Record<MemoryLayer, number> = {} as any;
    
    // Parallel retrieval from all enabled layers
    const retrievals = await Promise.all(
      layers.map(layer => this.retrieveFromLayer(layer, query))
    );
    
    for (let i = 0; i < layers.length; i++) {
      const layerChunks = retrievals[i];
      sources[layers[i]] = layerChunks.length;
      allChunks.push(...layerChunks);
    }
    
    // Sort by relevance and limit
    const sorted = allChunks
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxChunks);
    
    return {
      chunks: sorted,
      sources,
      totalTokens: this.countTokens(sorted)
    };
  }
  
  private async retrieveFromLayer(
    layer: MemoryLayer,
    query: MemoryQuery
  ): Promise<MemoryChunk[]> {
    switch (layer) {
      case 'session':
        return this.sessionStore.getRecentContext(query.context.userId);
        
      case 'project':
        if (!query.context.projectId) return [];
        return this.projectStore.getProjectContext(query.context.projectId);
        
      case 'organization':
        return this.orgStore.searchPatterns(
          query.context.organizationId,
          query.query
        );
        
      case 'knowledge':
        return this.knowledgeStore.search(query.query);
        
      case 'external':
        return this.externalStore.search(query.query);
    }
  }
  
  // Record significant events to project memory
  async recordDecision(
    projectId: string,
    decision: {
      title: string;
      outcome: string;
      rationale: string;
      aiSuggested?: boolean;
    }
  ): Promise<void> {
    await this.projectStore.addMemory(projectId, {
      type: 'DECISION',
      content: decision,
      importance: 3
    });
  }
  
  // Learn from completed projects
  async extractPatterns(projectId: string): Promise<void> {
    const project = await this.projectStore.getProjectWithMemory(projectId);
    
    // Use AI to identify reusable patterns
    const patterns = await this.aiService.extractPatterns(project);
    
    for (const pattern of patterns) {
      const embedding = await this.generateEmbedding(pattern.description);
      await this.orgStore.addPattern(project.organizationId, {
        ...pattern,
        embedding,
        sourceProjectId: projectId
      });
    }
  }
}
```

### 5.3 Database Schema

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Session memory (in Redis, but here's the structure)
-- Key: session:{userId}
-- Value: JSON with messages, context, expiresAt

-- Project memory
CREATE TABLE project_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    memory_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    importance INTEGER DEFAULT 1 CHECK (importance BETWEEN 1 AND 5),
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_memory_type CHECK (
        memory_type IN ('DECISION', 'PHASE_TRANSITION', 'LEARNING', 
                        'RISK', 'MILESTONE', 'BLOCKER', 'AI_RECOMMENDATION')
    )
);

CREATE INDEX idx_project_memory_project ON project_memory(project_id);
CREATE INDEX idx_project_memory_type ON project_memory(memory_type);

-- Organization memory with vectors
CREATE TABLE organization_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    memory_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    description TEXT,
    embedding vector(1536),
    source_project_id UUID REFERENCES projects(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_org_memory_org ON organization_memory(organization_id);
CREATE INDEX idx_org_memory_embedding ON organization_memory 
    USING hnsw (embedding vector_cosine_ops);

-- Knowledge base
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL,
    source VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    chunk_index INTEGER,
    total_chunks INTEGER,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_knowledge_embedding ON knowledge_base 
    USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_knowledge_category ON knowledge_base(category);
CREATE INDEX idx_knowledge_source ON knowledge_base(source);
```

---

## 6. AI Capabilities (The Hands)

### 6.1 Capability Catalog

| Capability | Description | Model Tier | Output |
|------------|-------------|------------|--------|
| Chat | Conversational AI assistant | BUDGET | Stream |
| Magic Wand | Auto-fill form fields | BUDGET | Structured |
| Report Section | Generate report sections | STANDARD | Structured |
| Full Report | Complete executive report | PREMIUM | Stream |
| Initiative Gen | Generate initiatives from gaps | PREMIUM | Structured |
| Task Advice | PMO coaching for tasks | BUDGET | Stream |
| Risk Analysis | Identify and assess risks | STANDARD | Structured |
| Gap Analysis | Analyze maturity gaps | STANDARD | Structured |
| MAX Mode | Deep strategic analysis | REASONING | Stream |
| Benchmarks | Industry comparisons | STANDARD | Structured |

### 6.2 Magic Wand Implementation

```typescript
// server/services/ai/capabilities/magicWand.ts

const FieldSuggestionSchema = z.object({
  value: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string()
});

class MagicWandCapability {
  async suggestField(config: {
    fieldName: string;
    fieldContext: string;
    existingData: Record<string, any>;
    projectContext: ProjectContext;
  }): Promise<FieldSuggestion> {
    const systemPrompt = await this.promptManager.buildSystemPrompt({
      capability: 'magic_wand',
      userRole: config.projectContext.userRole,
      projectPhase: config.projectContext.phase,
      variables: {
        fieldName: config.fieldName,
        fieldContext: config.fieldContext
      }
    });
    
    const { content } = await this.pipeline.process({
      type: 'structured',
      userId: config.projectContext.userId,
      organizationId: config.projectContext.organizationId,
      projectId: config.projectContext.projectId,
      capability: 'magic_wand',
      prompt: `Based on the existing data, suggest a value for "${config.fieldName}".
               
               Existing data:
               ${JSON.stringify(config.existingData, null, 2)}
               
               Field description: ${config.fieldContext}`,
      schema: FieldSuggestionSchema,
      options: { tier: 'BUDGET' }
    });
    
    return content as FieldSuggestion;
  }
  
  async suggestMultipleFields(config: {
    fields: { name: string; context: string }[];
    existingData: Record<string, any>;
    projectContext: ProjectContext;
  }): Promise<FieldSuggestion[]> {
    // Batch multiple fields in one LLM call
    const BatchSchema = z.object({
      suggestions: z.array(z.object({
        fieldName: z.string(),
        value: z.string(),
        confidence: z.number(),
        reasoning: z.string()
      }))
    });
    
    const { content } = await this.pipeline.process({
      type: 'structured',
      // ... similar to above but with batch schema
      schema: BatchSchema
    });
    
    return content.suggestions;
  }
}
```

### 6.3 Report Generation (Multi-Agent Pipeline)

```typescript
// server/services/ai/capabilities/reportGenerator.ts

interface ReportPipelineStage {
  name: string;
  role: 'ANALYST' | 'STRATEGIST' | 'VALIDATOR' | 'REPORTER';
  systemPrompt: string;
  outputSchema: z.ZodSchema;
}

const REPORT_PIPELINE: ReportPipelineStage[] = [
  {
    name: 'analyze',
    role: 'ANALYST',
    systemPrompt: 'Analyze the assessment data and identify key gaps...',
    outputSchema: z.object({
      gaps: z.array(GapSchema),
      insights: z.array(z.string()),
      dataQuality: z.number()
    })
  },
  {
    name: 'strategize',
    role: 'STRATEGIST',
    systemPrompt: 'Based on the analysis, develop strategic recommendations...',
    outputSchema: z.object({
      recommendations: z.array(RecommendationSchema),
      prioritization: z.array(z.string()),
      dependencies: z.array(DependencySchema)
    })
  },
  {
    name: 'validate',
    role: 'VALIDATOR',
    systemPrompt: 'Validate the recommendations for consistency and feasibility...',
    outputSchema: z.object({
      validated: z.boolean(),
      issues: z.array(z.string()),
      adjustments: z.array(z.string())
    })
  },
  {
    name: 'format',
    role: 'REPORTER',
    systemPrompt: 'Format the analysis into an executive report...',
    outputSchema: z.object({
      executiveSummary: z.string(),
      sections: z.array(ReportSectionSchema),
      conclusion: z.string()
    })
  }
];

class ReportGenerator {
  async generate(
    projectId: string,
    reportType: string
  ): AsyncGenerator<ReportProgress> {
    const projectData = await this.loadProjectData(projectId);
    let currentOutput = projectData;
    
    for (const stage of REPORT_PIPELINE) {
      yield { stage: stage.name, status: 'in_progress' };
      
      const stageResult = await this.pipeline.process({
        type: 'structured',
        capability: `report_${stage.name}`,
        prompt: this.buildStagePrompt(stage, currentOutput),
        schema: stage.outputSchema,
        options: { tier: 'PREMIUM' }
      });
      
      currentOutput = { ...currentOutput, [stage.name]: stageResult.content };
      
      yield { 
        stage: stage.name, 
        status: 'complete',
        result: stageResult.content
      };
    }
    
    yield { stage: 'complete', report: currentOutput.format };
  }
}
```

---

## 7. Technology Stack

### 7.1 Final Technology Decisions

| Category | Technology | Rationale |
|----------|------------|-----------|
| **LLM SDK** | Vercel AI SDK (ai) | TypeScript-native, streaming, multi-provider |
| **Primary Chat** | GPT-4o-mini | Best cost/quality for chat |
| **Primary Generation** | Claude 3.5 Sonnet | Prompt caching, long context |
| **Reasoning** | o1-mini | Deep analysis for MAX Mode |
| **Vector DB** | pgvector | No new infrastructure |
| **Embeddings** | text-embedding-3-small | Cost-effective, good quality |
| **Cache** | Redis | Session memory, rate limiting |
| **Observability** | Langfuse | Open-source tracing |
| **Agent Pattern** | Custom State Machine | Full control, debuggable |

### 7.2 Package Dependencies

```json
{
  "dependencies": {
    "ai": "^3.4.0",
    "@ai-sdk/openai": "^0.0.66",
    "@ai-sdk/anthropic": "^0.0.51",
    "@ai-sdk/google": "^0.0.52",
    "zod": "^3.23.8",
    "langfuse": "^3.6.0",
    "ioredis": "^5.3.2"
  }
}
```

### 7.3 Environment Configuration

```env
# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...

# Observability
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_SECRET_KEY=sk-...

# Feature Flags
AI_ENABLED=true
AI_MAX_MODE_ENABLED=true
AI_EXTERNAL_SEARCH_ENABLED=false

# Limits
AI_MAX_TOKENS_PER_REQUEST=4096
AI_RATE_LIMIT_CHAT=60
AI_RATE_LIMIT_GENERATION=10
AI_DEFAULT_MONTHLY_BUDGET_USD=100
```

---

## 8. Security Architecture

### 8.1 Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     SECURITY LAYERS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LAYER 1: INPUT SECURITY                                        │
│  ├── Prompt Injection Guard                                     │
│  ├── Input Sanitization                                         │
│  └── Length Validation                                          │
│                                                                  │
│  LAYER 2: PII PROTECTION                                        │
│  ├── PII Detection (regex + NER)                               │
│  ├── Automatic Scrubbing                                        │
│  └── Logging (masked values only)                               │
│                                                                  │
│  LAYER 3: ACCESS CONTROL                                        │
│  ├── Multi-tenant Isolation                                     │
│  ├── Rate Limiting                                              │
│  └── Budget Enforcement                                         │
│                                                                  │
│  LAYER 4: OUTPUT VALIDATION                                     │
│  ├── Hallucination Check                                        │
│  ├── Content Safety Filter                                      │
│  └── PII in Response Check                                      │
│                                                                  │
│  LAYER 5: AUDIT & MONITORING                                    │
│  ├── Full Request/Response Logging                              │
│  ├── Security Event Alerts                                      │
│  └── Anomaly Detection                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Security Middleware Chain

```typescript
// server/middleware/ai/securityChain.ts

const aiSecurityChain = [
  // 1. Rate limiting
  rateLimiter({
    keyPrefix: 'ai',
    points: 60,  // requests
    duration: 60 // per minute
  }),
  
  // 2. Access control
  aiAccessControl(),
  
  // 3. Input validation
  inputValidator({
    maxLength: 10000,
    stripControlChars: true
  }),
  
  // 4. Prompt injection guard
  promptInjectionGuard({
    action: 'BLOCK',
    logAttempts: true
  }),
  
  // 5. PII scrubber
  piiScrubber({
    detectNames: true,
    action: 'REDACT'
  }),
  
  // 6. Budget check
  budgetEnforcement({
    autoDowngrade: true,
    freezeOnHardLimit: true
  })
];

app.use('/api/ai/*', ...aiSecurityChain);
```

---

## 9. Cost Model

### 9.1 Cost Projections

**Assumptions:**
- 1000 monthly active users
- 50 AI interactions per user per month
- Mix: 70% chat, 20% analysis, 10% generation

**Without Optimization:**
```
Chat (35,000 × GPT-4o): $875
Analysis (10,000 × GPT-4o): $250  
Generation (5,000 × GPT-4o): $500
---
Total: ~$1,625/month ($1.63/user)
```

**With Optimization:**
```
Chat (35,000 × GPT-4o-mini): $21
Analysis (10,000 × Claude 3.5 Sonnet with caching): $90
Generation (5,000 × GPT-4o): $250
Semantic Cache Savings (20%): -$72
---
Total: ~$289/month ($0.29/user)
```

**Savings: 82%**

### 9.2 Cost Tiers

| Tier | Model Stack | Cost/User | Quality |
|------|-------------|-----------|---------|
| Enterprise | Full premium + o1 | $1.50 | ⭐⭐⭐⭐⭐ |
| Professional | Optimized multi-model | $0.35 | ⭐⭐⭐⭐ |
| Standard | Budget + standard | $0.15 | ⭐⭐⭐ |
| Starter | Budget only | $0.05 | ⭐⭐ |

---

## 10. Implementation Roadmap

### 10.1 Phase Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION PHASES                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PHASE 1 (2 weeks): FOUNDATION                                  │
│  ├── AI Pipeline skeleton                                       │
│  ├── LLM Service (Vercel AI SDK)                               │
│  ├── Prompt Manager (DB-backed)                                 │
│  └── Basic Chat capability                                      │
│                                                                  │
│  PHASE 2 (2 weeks): CORE CAPABILITIES                           │
│  ├── Magic Wand (field autofill)                               │
│  ├── Model Router (tiered)                                      │
│  ├── Budget Management                                          │
│  └── Audit Logging                                              │
│                                                                  │
│  PHASE 3 (2 weeks): MEMORY & RAG                                │
│  ├── Session Memory (Redis)                                     │
│  ├── Project Memory                                             │
│  ├── Knowledge Base (pgvector)                                  │
│  └── RAG Pipeline                                               │
│                                                                  │
│  PHASE 4 (2 weeks): ADVANCED CAPABILITIES                       │
│  ├── Report Generation                                          │
│  ├── Initiative Generation                                      │
│  ├── Task Advisor                                               │
│  └── Draft-Review-Approve UI                                    │
│                                                                  │
│  PHASE 5 (2 weeks): SECURITY & POLISH                           │
│  ├── PII Protection                                             │
│  ├── Prompt Injection Guards                                    │
│  ├── Semantic Caching                                           │
│  └── Observability (Langfuse)                                   │
│                                                                  │
│  PHASE 6 (2 weeks): MAX MODE & OPTIMIZATION                     │
│  ├── o1 Integration                                             │
│  ├── Multi-agent Reports                                        │
│  ├── Performance Optimization                                   │
│  └── A/B Testing Framework                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Detailed Phase 1 Tasks

```markdown
## Phase 1: Foundation (Week 1-2)

### Week 1: Pipeline & LLM Service

1. [ ] Install dependencies (ai, @ai-sdk/*, zod)
2. [ ] Create server/services/ai/ directory structure
3. [ ] Implement LLMService class (Vercel AI SDK wrapper)
4. [ ] Implement basic AIPipeline class
5. [ ] Create ai_prompts table and seed with initial prompts
6. [ ] Implement PromptManager with DB-backed prompts
7. [ ] Add /api/ai/chat endpoint

### Week 2: Basic Chat & Testing

8. [ ] Integrate with existing AIContext.tsx
9. [ ] Update ChatPanel to use new pipeline
10. [ ] Add streaming support to frontend
11. [ ] Implement basic error handling
12. [ ] Add request/response logging
13. [ ] Write integration tests
14. [ ] Deploy to staging
```

---

## 11. Success Metrics & Monitoring

### 11.1 KPIs

| Category | Metric | Target | Measurement |
|----------|--------|--------|-------------|
| **Usage** | AI Adoption Rate | >70% | Monthly active AI users / Total MAU |
| **Quality** | User Satisfaction | >4.2/5 | Post-interaction ratings |
| **Quality** | Accuracy Rate | >90% | User-reported accuracy |
| **Quality** | Acceptance Rate | >60% | Drafts approved / Drafts generated |
| **Performance** | Response Time (p95) | <3s | Time to first token |
| **Performance** | Error Rate | <1% | Failed requests / Total requests |
| **Cost** | Cost per User | <$0.50 | Monthly AI spend / MAU |
| **Cost** | Cache Hit Rate | >20% | Cached responses / Total requests |
| **Security** | PII Incidents | 0 | PII leaked to external |
| **Security** | Injection Attempts | <0.1% | Blocked / Total requests |

### 11.2 Dashboards

```yaml
dashboards:
  ai_operations:
    - Total requests (by capability)
    - Error rate (by model)
    - Latency distribution
    - Cache hit rate
    
  ai_cost:
    - Daily/monthly spend
    - Spend by organization
    - Spend by capability
    - Budget utilization
    
  ai_quality:
    - User ratings distribution
    - Acceptance/rejection rates
    - Feedback themes
    
  ai_security:
    - PII detection events
    - Injection attempts
    - Access violations
    - Audit log queries
```

---

## 12. Risk Assessment

### 12.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| OpenAI outage | Medium | High | Multi-provider fallback |
| Model quality regression | Low | Medium | Version pinning, A/B testing |
| Cost overrun | Medium | Medium | Budget limits, auto-downgrade |
| Performance issues | Medium | Medium | Caching, model routing |
| Security breach | Low | High | Multiple security layers |

### 12.2 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| User adoption | Medium | High | Gradual rollout, education |
| AI hallucinations | Medium | Medium | Validation layer, citations |
| Regulatory changes | Low | Medium | Configurable data policies |
| Provider pricing changes | Medium | Medium | Multi-provider, budget alerts |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Pipeline** | End-to-end request processing flow |
| **Capability** | Specific AI feature (chat, magic wand, etc.) |
| **Model Tier** | Budget/Standard/Premium/Reasoning model groups |
| **Draft** | AI-generated content awaiting user approval |
| **Memory Layer** | One of 5 context storage levels |
| **Semantic Cache** | Similarity-based response caching |
| **MAX Mode** | Premium reasoning mode with o1 models |

---

## Appendix B: File Structure

```
server/
└── services/
    └── ai/
        ├── index.ts                    # Main exports
        ├── pipeline.ts                 # AIPipeline class
        ├── llmService.ts              # Vercel AI SDK wrapper
        ├── promptManager.ts           # Prompt management
        ├── modelRouter.ts             # Model selection
        ├── memoryManager.ts           # 5-layer memory
        ├── budgetManager.ts           # Cost control
        ├── auditLogger.ts             # Request logging
        ├── security/
        │   ├── injectionGuard.ts      # Prompt injection
        │   ├── piiScrubber.ts         # PII protection
        │   ├── rateLimiter.ts         # Rate limiting
        │   └── accessControl.ts       # Authorization
        └── capabilities/
            ├── chat.ts                # Chat capability
            ├── magicWand.ts           # Field autofill
            ├── reportGenerator.ts     # Report generation
            ├── initiativeGenerator.ts # Initiative generation
            ├── taskAdvisor.ts         # Task advice
            └── maxMode.ts             # Deep analysis
```

---

*Document Version: 1.0*
*Last Updated: December 2024*
*Author: AI Research Team*
*Status: Ready for Implementation*

