# Faza 5: Cost Optimization and Security

## Executive Summary

Ten dokument analizuje strategie optymalizacji kosztów AI oraz mechanizmy bezpieczeństwa niezbędne dla enterprise-grade aplikacji. Obejmuje caching, budget management, PII protection, prompt injection prevention i audit logging.

**Rekomendacje główne:**
- **Cost:** Tiered model routing + semantic caching + prompt caching
- **Security:** PII scrubbing middleware + prompt injection guards + full audit trail
- **Budget:** 3-level quotas (Global → Org → Project) z auto-downgrade

---

## 1. Cost Optimization Strategies

### 1.1 Cost Breakdown Analysis

Typowy rozkład kosztów AI w aplikacji SaaS:

| Component | % of Total | Optimization Potential |
|-----------|------------|------------------------|
| Chat/Conversations | 40% | HIGH (use cheap models) |
| Report Generation | 25% | MEDIUM (caching) |
| Initiative Generation | 15% | MEDIUM (batching) |
| Embeddings | 10% | HIGH (caching) |
| Analysis/Reasoning | 10% | LOW (needs quality) |

### 1.2 Strategy 1: Tiered Model Routing

**Concept:** Route requests to appropriate model tier based on task complexity.

```typescript
type ModelTier = 'BUDGET' | 'STANDARD' | 'PREMIUM' | 'REASONING';

const MODEL_TIERS: Record<ModelTier, string[]> = {
  BUDGET: ['gpt-4o-mini', 'gemini-1.5-flash', 'claude-3-haiku'],
  STANDARD: ['gpt-4o', 'claude-3.5-sonnet', 'gemini-1.5-pro'],
  PREMIUM: ['gpt-4o', 'claude-3-opus'],
  REASONING: ['o1-mini', 'o1-preview']
};

const TASK_TO_TIER: Record<string, ModelTier> = {
  // Budget tier tasks
  'chat_simple': 'BUDGET',
  'field_autofill': 'BUDGET',
  'summarize_short': 'BUDGET',
  
  // Standard tier tasks
  'chat_complex': 'STANDARD',
  'generate_report': 'STANDARD',
  'analyze_assessment': 'STANDARD',
  
  // Premium tier tasks
  'generate_initiatives': 'PREMIUM',
  'executive_report': 'PREMIUM',
  
  // Reasoning tier tasks (MAX Mode)
  'deep_analysis': 'REASONING',
  'strategy_synthesis': 'REASONING'
};

class ModelRouter {
  selectModel(task: string, budgetStatus: BudgetStatus): string {
    const baseTier = TASK_TO_TIER[task] || 'STANDARD';
    const effectiveTier = this.applyBudgetConstraints(baseTier, budgetStatus);
    
    const models = MODEL_TIERS[effectiveTier];
    return this.selectAvailableModel(models);
  }
  
  private applyBudgetConstraints(
    tier: ModelTier,
    budget: BudgetStatus
  ): ModelTier {
    if (budget.percentUsed >= 95) return 'BUDGET';
    if (budget.percentUsed >= 80 && tier === 'PREMIUM') return 'STANDARD';
    if (budget.percentUsed >= 90 && tier === 'STANDARD') return 'BUDGET';
    return tier;
  }
}
```

**Cost Impact:**
- Chat costs reduced by 80% (GPT-4o-mini vs GPT-4o)
- Average cost per request: $0.002 → $0.0005

### 1.3 Strategy 2: Semantic Caching

**Concept:** Cache similar queries to avoid repeated LLM calls.

```typescript
interface SemanticCache {
  key: string;
  embedding: number[];
  response: string;
  metadata: {
    task: string;
    model: string;
    createdAt: Date;
    hitCount: number;
  };
}

class SemanticCacheService {
  private similarityThreshold = 0.95;
  private ttl = 3600; // 1 hour
  
  async get(query: string, context: CacheContext): Promise<string | null> {
    const embedding = await this.generateEmbedding(query);
    
    // Search for similar cached responses
    const cached = await this.db.query(`
      SELECT response, 1 - (embedding <=> $1) as similarity
      FROM semantic_cache
      WHERE task = $2 
        AND organization_id = $3
        AND created_at > NOW() - INTERVAL '${this.ttl} seconds'
      ORDER BY embedding <=> $1
      LIMIT 1
    `, [embedding, context.task, context.organizationId]);
    
    if (cached && cached.similarity >= this.similarityThreshold) {
      // Update hit count
      await this.incrementHitCount(cached.key);
      return cached.response;
    }
    
    return null;
  }
  
  async set(
    query: string,
    response: string,
    context: CacheContext
  ): Promise<void> {
    const embedding = await this.generateEmbedding(query);
    
    await this.db.query(`
      INSERT INTO semantic_cache 
      (key, embedding, response, task, organization_id, model)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      this.generateKey(query),
      embedding,
      response,
      context.task,
      context.organizationId,
      context.model
    ]);
  }
}
```

**Database Schema:**
```sql
CREATE TABLE semantic_cache (
    key VARCHAR(64) PRIMARY KEY,
    embedding vector(1536),
    response TEXT NOT NULL,
    task VARCHAR(50) NOT NULL,
    organization_id UUID NOT NULL,
    model VARCHAR(50),
    hit_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cache_embedding ON semantic_cache 
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_cache_task_org ON semantic_cache(task, organization_id);
```

**Cost Impact:**
- Cache hit rate: 15-25% for common queries
- Embedding cost: $0.02/1M tokens (negligible)
- Estimated savings: 15-20% overall

### 1.4 Strategy 3: Prompt Caching (Provider-Level)

**Concept:** Leverage provider prompt caching for repeated system prompts.

```typescript
// Anthropic Prompt Caching
async function callWithCaching(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' } // Enable caching
      }
    ],
    messages: [{ role: 'user', content: userMessage }]
  });
  
  // Check cache usage
  console.log('Cache read tokens:', response.usage.cache_read_input_tokens);
  console.log('Cache creation tokens:', response.usage.cache_creation_input_tokens);
  
  return response.content[0].text;
}
```

**Cost Impact with Claude Prompt Caching:**
- Base system prompt: ~2000 tokens
- Normal cost: $0.006 per request
- Cached cost: $0.0006 per request (90% savings on system prompt)

### 1.5 Strategy 4: Request Batching

**Concept:** Batch similar requests to reduce API calls.

```typescript
class RequestBatcher {
  private queue: Map<string, BatchedRequest[]> = new Map();
  private batchSize = 5;
  private batchTimeout = 1000; // 1 second
  
  async add<T>(
    batchKey: string,
    request: T,
    processor: (batch: T[]) => Promise<any[]>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const batch = this.queue.get(batchKey) || [];
      batch.push({ request, resolve, reject });
      this.queue.set(batchKey, batch);
      
      if (batch.length >= this.batchSize) {
        this.processBatch(batchKey, processor);
      } else if (batch.length === 1) {
        setTimeout(() => this.processBatch(batchKey, processor), this.batchTimeout);
      }
    });
  }
  
  private async processBatch<T>(
    batchKey: string,
    processor: (batch: T[]) => Promise<any[]>
  ): Promise<void> {
    const batch = this.queue.get(batchKey);
    if (!batch || batch.length === 0) return;
    
    this.queue.delete(batchKey);
    
    try {
      const requests = batch.map(b => b.request);
      const results = await processor(requests);
      
      batch.forEach((b, i) => b.resolve(results[i]));
    } catch (error) {
      batch.forEach(b => b.reject(error));
    }
  }
}

// Usage: Batch embedding requests
const batcher = new RequestBatcher();

async function getEmbeddingBatched(text: string): Promise<number[]> {
  return batcher.add('embeddings', text, async (texts) => {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts
    });
    return response.data.map(e => e.embedding);
  });
}
```

**Cost Impact:**
- Reduces API call overhead
- Embedding costs reduced by batching
- Estimated savings: 5-10%

### 1.6 Budget Management System

**Three-Level Quota System:**

```sql
CREATE TABLE ai_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type VARCHAR(20) NOT NULL, -- 'global', 'organization', 'project'
    scope_id UUID,
    monthly_limit_usd DECIMAL(10,2),
    hard_limit_usd DECIMAL(10,2),
    current_usage_usd DECIMAL(10,4) DEFAULT 0,
    auto_downgrade BOOLEAN DEFAULT true,
    freeze_on_limit BOOLEAN DEFAULT false,
    alert_threshold DECIMAL(3,2) DEFAULT 0.80,
    reset_day INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(scope_type, scope_id)
);

CREATE TABLE ai_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    project_id UUID,
    user_id UUID NOT NULL,
    model VARCHAR(50) NOT NULL,
    task VARCHAR(50) NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost_usd DECIMAL(10,6) NOT NULL,
    was_cached BOOLEAN DEFAULT false,
    was_downgraded BOOLEAN DEFAULT false,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_org_date ON ai_usage_log(organization_id, created_at);
CREATE INDEX idx_usage_project ON ai_usage_log(project_id, created_at);
```

**Budget Enforcement:**

```typescript
class BudgetManager {
  async checkBudget(
    organizationId: string,
    projectId: string | null,
    estimatedCost: number
  ): Promise<BudgetCheck> {
    const budgets = await this.getAllApplicableBudgets(organizationId, projectId);
    
    for (const budget of budgets) {
      const usage = budget.current_usage_usd;
      const limit = budget.monthly_limit_usd;
      const hardLimit = budget.hard_limit_usd || limit;
      
      // Check hard limit (freeze)
      if (budget.freeze_on_limit && usage >= hardLimit) {
        return {
          allowed: false,
          reason: 'BUDGET_FROZEN',
          message: `AI budget exhausted for ${budget.scope_type}. Contact admin.`
        };
      }
      
      // Check soft limit (downgrade)
      if (usage >= limit && budget.auto_downgrade) {
        return {
          allowed: true,
          shouldDowngrade: true,
          reason: 'BUDGET_EXCEEDED_DOWNGRADE',
          message: 'Switching to budget model due to quota.'
        };
      }
      
      // Check alert threshold
      const percentUsed = usage / limit;
      if (percentUsed >= budget.alert_threshold) {
        await this.sendAlert(budget, percentUsed);
      }
    }
    
    return { allowed: true, shouldDowngrade: false };
  }
  
  async recordUsage(usage: UsageRecord): Promise<void> {
    // Log usage
    await this.db.query(`
      INSERT INTO ai_usage_log 
      (organization_id, project_id, user_id, model, task, 
       input_tokens, output_tokens, cost_usd, was_cached, was_downgraded, latency_ms)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      usage.organizationId, usage.projectId, usage.userId,
      usage.model, usage.task, usage.inputTokens, usage.outputTokens,
      usage.cost, usage.wasCached, usage.wasDowngraded, usage.latency
    ]);
    
    // Update budgets
    await this.updateBudgetUsage(usage.organizationId, usage.projectId, usage.cost);
  }
}
```

### 1.7 Cost Summary

| Strategy | Savings | Effort | Priority |
|----------|---------|--------|----------|
| Tiered Model Routing | 40-60% | Low | P0 |
| Prompt Caching | 20-30% | Low | P0 |
| Semantic Caching | 15-20% | Medium | P1 |
| Request Batching | 5-10% | Medium | P2 |
| Budget Management | N/A (control) | Medium | P0 |

**Total Estimated Savings: 50-70%** vs naive implementation

---

## 1.8 AI Control Plane & Feature Management

**Concept:** Granularna kontrola nad poszczególnymi funkcjonalnościami AI na platformie.

### Feature Management Schema

```sql
CREATE TABLE ai_feature_control (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key VARCHAR(50) UNIQUE NOT NULL, -- 'chat', 'magic_wand', 'reports', 'max_mode'
    is_enabled BOOLEAN DEFAULT true,
    min_role VARCHAR(20) DEFAULT 'USER',
    allowed_models VARCHAR(50)[] DEFAULT '{gpt-4o-mini}',
    max_tokens_per_req INTEGER,
    requires_approval BOOLEAN DEFAULT false,
    
    -- Emergency Stop
    emergency_disable BOOLEAN DEFAULT false,
    disable_reason TEXT,
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Domyślne funkcjonalności
INSERT INTO ai_feature_control (feature_key, min_role, allowed_models) VALUES
('chat', 'USER', '{gpt-4o-mini, claude-3.5-haiku}'),
('magic_wand', 'USER', '{gpt-4o-mini}'),
('reports', 'ADMIN', '{claude-3.5-sonnet, gpt-4o}'),
('max_mode', 'SUPERADMIN', '{o1-mini, o1-preview}');
```

### Control Plane API
Umożliwia administratorom dynamiczne zarządzanie dostępem do AI:
- **Global Kill Switch:** Natychmiastowe wyłączenie AI w całej aplikacji.
- **Quota-based Throttling:** Automatyczne ograniczanie funkcji raportów przy niskim budżecie.
- **Model Override:** Ręczne wymuszenie konkretnego modelu dla danej funkcji (np. zmiana z GPT-4o na DeepSeek w celu oszczędności).

---

## 2. Security Framework

### 2.1 Threat Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI SECURITY THREATS                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INPUT THREATS                 OUTPUT THREATS                    │
│  ├── Prompt Injection          ├── PII Leakage                  │
│  ├── Jailbreaking              ├── Hallucination                │
│  ├── Data Extraction           ├── Harmful Content              │
│  └── Context Manipulation      └── Cross-Tenant Data            │
│                                                                  │
│  SYSTEM THREATS                BUSINESS THREATS                  │
│  ├── API Key Exposure          ├── Cost Attacks                 │
│  ├── Unauthorized Access       ├── Service Abuse                │
│  ├── Model Poisoning           ├── Reputation Damage            │
│  └── Log Injection             └── Compliance Violations        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Security Layer 1: Input Validation

#### 2.2.1 Prompt Injection Prevention

```typescript
const INJECTION_PATTERNS = [
  // System prompt override attempts
  /ignore\s+(all\s+)?previous\s+instructions?/i,
  /forget\s+(everything|all|your)\s+(instructions?|rules?|guidelines?)/i,
  /disregard\s+(the\s+)?(above|previous|system)/i,
  /you\s+are\s+now\s+a?n?\s*/i,
  /pretend\s+(to\s+be|you\s+are)/i,
  /act\s+as\s+(if\s+you\s+are|a)/i,
  
  // Jailbreak attempts
  /do\s+anything\s+now/i,
  /dan\s+mode/i,
  /developer\s+mode/i,
  /jailbreak/i,
  
  // System access attempts
  /system\s+prompt/i,
  /reveal\s+(your\s+)?(instructions?|prompt|rules?)/i,
  /what\s+are\s+your\s+(instructions?|rules?|guidelines?)/i,
  
  // Bypass attempts
  /bypass\s+(the\s+)?(filter|safety|restriction)/i,
  /override\s+(the\s+)?(filter|safety|restriction)/i
];

class PromptInjectionGuard {
  check(input: string): InjectionCheckResult {
    const threats: string[] = [];
    
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        threats.push(pattern.source);
      }
    }
    
    // Check for encoded attempts
    const decoded = this.decodeVariants(input);
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(decoded)) {
        threats.push(`encoded:${pattern.source}`);
      }
    }
    
    if (threats.length > 0) {
      return {
        safe: false,
        threats,
        action: 'BLOCK',
        message: 'Your message contains potentially harmful content.'
      };
    }
    
    return { safe: true, threats: [], action: 'ALLOW' };
  }
  
  private decodeVariants(input: string): string {
    return input
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width chars
      .replace(/[^\x00-\x7F]/g, c => c.normalize('NFKC')) // Unicode normalization
      .toLowerCase();
  }
}
```

#### 2.2.2 Input Sanitization

```typescript
class InputSanitizer {
  sanitize(input: string, options: SanitizeOptions = {}): SanitizedInput {
    let sanitized = input;
    const redactions: Redaction[] = [];
    
    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Limit length
    if (sanitized.length > options.maxLength || 10000) {
      sanitized = sanitized.slice(0, options.maxLength || 10000);
      redactions.push({ type: 'TRUNCATED', reason: 'exceeded_max_length' });
    }
    
    // Remove potential code injection
    if (options.stripCode) {
      sanitized = sanitized.replace(/```[\s\S]*?```/g, '[CODE REMOVED]');
      sanitized = sanitized.replace(/<script[\s\S]*?<\/script>/gi, '[SCRIPT REMOVED]');
    }
    
    return {
      original: input,
      sanitized,
      redactions,
      wasModified: input !== sanitized
    };
  }
}
```

### 2.3 Security Layer 2: PII Protection

#### 2.3.1 PII Detection and Scrubbing

```typescript
const PII_PATTERNS: Record<string, RegExp> = {
  // Email
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // Phone numbers (various formats)
  PHONE_PL: /(?:\+48|48)?[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{3}/g,
  PHONE_INT: /\+\d{1,3}[\s-]?\d{3,4}[\s-]?\d{3,4}[\s-]?\d{2,4}/g,
  
  // Polish PESEL
  PESEL: /\b\d{11}\b/g,
  
  // Polish NIP
  NIP: /\b\d{3}[-\s]?\d{3}[-\s]?\d{2}[-\s]?\d{2}\b/g,
  
  // Credit card
  CREDIT_CARD: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  
  // IBAN
  IBAN: /\b[A-Z]{2}\d{2}[\s]?(?:\d{4}[\s]?){4,6}\d{0,4}\b/g,
  
  // IP Address
  IP_ADDRESS: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  
  // Polish postal code
  POSTAL_PL: /\b\d{2}[-\s]?\d{3}\b/g
};

class PIIScrubber {
  scrub(text: string, options: ScrubOptions = {}): ScrubResult {
    let scrubbed = text;
    const findings: PIIFinding[] = [];
    
    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
      const matches = text.match(pattern) || [];
      
      for (const match of matches) {
        findings.push({
          type,
          value: this.maskValue(match),
          position: text.indexOf(match)
        });
        
        scrubbed = scrubbed.replace(match, `[${type}_REDACTED]`);
      }
    }
    
    // Additional NER-based detection for names
    if (options.detectNames) {
      const names = this.detectNames(text);
      for (const name of names) {
        findings.push({ type: 'NAME', value: this.maskValue(name.text) });
        scrubbed = scrubbed.replace(name.text, '[NAME_REDACTED]');
      }
    }
    
    return {
      original: text,
      scrubbed,
      findings,
      hasPII: findings.length > 0
    };
  }
  
  private maskValue(value: string): string {
    if (value.length <= 4) return '****';
    return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
  }
}
```

#### 2.3.2 PII Middleware

```typescript
class PIIMiddleware {
  private scrubber = new PIIScrubber();
  
  async processRequest(request: AIRequest): Promise<AIRequest> {
    // Scrub user message
    const scrubResult = this.scrubber.scrub(request.message, {
      detectNames: true
    });
    
    if (scrubResult.hasPII) {
      // Log PII detection (without actual PII)
      await this.logPIIDetection({
        userId: request.userId,
        types: scrubResult.findings.map(f => f.type),
        count: scrubResult.findings.length
      });
      
      // Replace with scrubbed version
      request.message = scrubResult.scrubbed;
      request.metadata.piiScrubbed = true;
    }
    
    return request;
  }
  
  async processResponse(response: AIResponse): Promise<AIResponse> {
    // Also scrub AI responses (in case of accidental PII generation)
    const scrubResult = this.scrubber.scrub(response.content);
    
    if (scrubResult.hasPII) {
      response.content = scrubResult.scrubbed;
      response.metadata.piiScrubbed = true;
    }
    
    return response;
  }
}
```

### 2.4 Security Layer 3: Output Validation

#### 2.4.1 Hallucination Detection

```typescript
interface FactCheck {
  claim: string;
  verified: boolean;
  source?: string;
  confidence: number;
}

class HallucinationDetector {
  async check(
    response: string,
    context: VerificationContext
  ): Promise<HallucinationResult> {
    const claims = this.extractClaims(response);
    const checks: FactCheck[] = [];
    
    for (const claim of claims) {
      // Check against provided data
      if (claim.type === 'NUMERIC') {
        const verified = await this.verifyNumericClaim(claim, context.data);
        checks.push(verified);
      }
      
      // Check against knowledge base
      if (claim.type === 'FACTUAL') {
        const verified = await this.verifyFactualClaim(claim, context.knowledge);
        checks.push(verified);
      }
    }
    
    const unverifiedClaims = checks.filter(c => !c.verified);
    
    return {
      hasHallucinations: unverifiedClaims.length > 0,
      unverifiedClaims,
      confidence: checks.length > 0 
        ? checks.filter(c => c.verified).length / checks.length 
        : 1
    };
  }
  
  private async verifyNumericClaim(
    claim: Claim,
    data: any
  ): Promise<FactCheck> {
    // Example: "The maturity score is 3.5"
    // Verify against actual assessment data
    const actualValue = this.findValue(claim.subject, data);
    
    return {
      claim: claim.text,
      verified: actualValue === claim.value,
      source: 'project_data',
      confidence: actualValue ? 1.0 : 0.5
    };
  }
}
```

#### 2.4.2 Content Safety Filter

```typescript
class ContentSafetyFilter {
  private blockedCategories = [
    'HARMFUL_ADVICE',
    'ILLEGAL_ACTIVITY',
    'PERSONAL_ATTACK',
    'DISCRIMINATION'
  ];
  
  async check(content: string): Promise<SafetyResult> {
    // Use classification model or API
    const classification = await this.classifyContent(content);
    
    const blocked = classification.categories.some(
      c => this.blockedCategories.includes(c.name) && c.confidence > 0.8
    );
    
    return {
      safe: !blocked,
      categories: classification.categories,
      action: blocked ? 'BLOCK' : 'ALLOW'
    };
  }
}
```

### 2.5 Security Layer 4: Access Control

#### 2.5.1 Multi-Tenant Isolation

```typescript
class TenantIsolationGuard {
  async verifyAccess(
    userId: string,
    resourceId: string,
    resourceType: string
  ): Promise<AccessResult> {
    // Get user's organization
    const user = await this.userService.get(userId);
    
    // Get resource's organization
    const resource = await this.getResource(resourceType, resourceId);
    
    // Verify same organization
    if (resource.organizationId !== user.organizationId) {
      await this.logAccessViolation({
        userId,
        resourceId,
        resourceType,
        userOrg: user.organizationId,
        resourceOrg: resource.organizationId
      });
      
      return {
        allowed: false,
        reason: 'CROSS_TENANT_ACCESS_DENIED'
      };
    }
    
    // Verify role-based permissions
    return this.checkRolePermissions(user.role, resourceType, 'read');
  }
}
```

#### 2.5.2 Rate Limiting

```typescript
class AIRateLimiter {
  private limits: Record<string, RateLimit> = {
    'chat': { requests: 60, window: 60 },        // 60 req/min
    'generation': { requests: 10, window: 60 },   // 10 req/min
    'report': { requests: 5, window: 300 },       // 5 req/5min
    'max_mode': { requests: 10, window: 3600 }    // 10 req/hour
  };
  
  async checkLimit(
    userId: string,
    taskType: string
  ): Promise<RateLimitResult> {
    const limit = this.limits[taskType] || this.limits['chat'];
    const key = `ratelimit:${userId}:${taskType}`;
    
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, limit.window);
    }
    
    if (current > limit.requests) {
      return {
        allowed: false,
        remaining: 0,
        resetIn: await this.redis.ttl(key),
        message: `Rate limit exceeded. Try again in ${await this.redis.ttl(key)} seconds.`
      };
    }
    
    return {
      allowed: true,
      remaining: limit.requests - current,
      resetIn: await this.redis.ttl(key)
    };
  }
}
```

### 2.6 Security Layer 5: Audit Logging

```sql
CREATE TABLE ai_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Request identifiers
    request_id UUID NOT NULL,
    session_id UUID,
    
    -- Actor
    user_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    project_id UUID,
    
    -- Request details
    task_type VARCHAR(50) NOT NULL,
    model_used VARCHAR(50) NOT NULL,
    
    -- Input/Output (hashed for privacy)
    input_hash VARCHAR(64) NOT NULL,
    output_hash VARCHAR(64) NOT NULL,
    input_preview TEXT, -- First 100 chars, PII scrubbed
    
    -- Security events
    pii_detected BOOLEAN DEFAULT false,
    pii_types TEXT[], -- Array of detected PII types
    injection_attempted BOOLEAN DEFAULT false,
    was_blocked BOOLEAN DEFAULT false,
    block_reason VARCHAR(100),
    
    -- Metrics
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd DECIMAL(10,6),
    latency_ms INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexing
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX idx_audit_user ON ai_audit_log(user_id, created_at);
CREATE INDEX idx_audit_org ON ai_audit_log(organization_id, created_at);
CREATE INDEX idx_audit_security ON ai_audit_log(injection_attempted, pii_detected);
```

**Audit Logger Implementation:**

```typescript
class AIAuditLogger {
  async log(event: AuditEvent): Promise<string> {
    const auditId = generateId();
    
    await this.db.query(`
      INSERT INTO ai_audit_log (
        id, request_id, session_id, user_id, organization_id, project_id,
        task_type, model_used, input_hash, output_hash, input_preview,
        pii_detected, pii_types, injection_attempted, was_blocked, block_reason,
        input_tokens, output_tokens, cost_usd, latency_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    `, [
      auditId,
      event.requestId,
      event.sessionId,
      event.userId,
      event.organizationId,
      event.projectId,
      event.taskType,
      event.modelUsed,
      this.hash(event.input),
      this.hash(event.output),
      this.truncateAndScrub(event.input, 100),
      event.piiDetected,
      event.piiTypes,
      event.injectionAttempted,
      event.wasBlocked,
      event.blockReason,
      event.inputTokens,
      event.outputTokens,
      event.cost,
      event.latency
    ]);
    
    // Alert on security events
    if (event.injectionAttempted || event.wasBlocked) {
      await this.alertService.send({
        type: 'SECURITY_EVENT',
        severity: 'HIGH',
        details: {
          userId: event.userId,
          event: event.injectionAttempted ? 'INJECTION_ATTEMPT' : 'REQUEST_BLOCKED',
          reason: event.blockReason
        }
      });
    }
    
    return auditId;
  }
  
  private hash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
  
  private truncateAndScrub(content: string, maxLength: number): string {
    const scrubbed = this.piiScrubber.scrub(content).scrubbed;
    return scrubbed.slice(0, maxLength);
  }
}
```

---

## 3. Compliance Checklist

### 3.1 GDPR Compliance

| Requirement | Implementation | Status |
|-------------|---------------|--------|
| Data minimization | Only send necessary context | ✅ |
| Purpose limitation | Audit all AI usage | ✅ |
| Right to erasure | Delete AI logs on user deletion | ⚠️ Implement |
| Data portability | Export AI interactions | ⚠️ Implement |
| Consent | AI usage consent in ToS | ✅ |
| DPA with OpenAI | Data Processing Agreement | ✅ |

### 3.2 Security Checklist

```markdown
## Pre-Production Checklist

### Input Security
- [ ] Prompt injection patterns defined
- [ ] Input sanitization implemented
- [ ] Length limits enforced
- [ ] Character encoding validated

### PII Protection
- [ ] PII detection patterns defined
- [ ] Scrubbing middleware active
- [ ] PII never logged in plaintext
- [ ] Response PII checked

### Access Control
- [ ] Multi-tenant isolation verified
- [ ] Rate limiting configured
- [ ] API key rotation scheduled
- [ ] Role-based access enforced

### Audit & Monitoring
- [ ] All requests logged
- [ ] Security alerts configured
- [ ] Anomaly detection enabled
- [ ] Log retention policy defined

### Compliance
- [ ] GDPR DPA signed
- [ ] Privacy policy updated
- [ ] User consent flow implemented
- [ ] Data retention limits set
```

---

## 4. Monitoring & Observability

### 4.1 Recommended Stack

```yaml
observability:
  tracing: Langfuse (open source)
  metrics: Prometheus + Grafana
  alerting: PagerDuty / Slack
  logging: PostgreSQL + retention policy

dashboards:
  - AI Cost Dashboard
  - Security Events Dashboard
  - Usage Analytics Dashboard
  - Model Performance Dashboard
```

### 4.2 Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `ai_requests_total` | Total AI requests | N/A |
| `ai_cost_usd` | Total cost | >$100/hour |
| `ai_latency_p99` | 99th percentile latency | >10s |
| `ai_error_rate` | Error percentage | >5% |
| `ai_cache_hit_rate` | Cache effectiveness | <10% |
| `ai_pii_detected` | PII detection events | >10/hour |
| `ai_injection_attempts` | Security events | >1 |
| `ai_budget_usage` | Budget consumption | >90% |

---

## 5. Final Recommendations

### 5.1 Cost Stack

```yaml
cost_optimization:
  model_routing:
    enabled: true
    default_tier: STANDARD
    downgrade_on_budget: true
    
  caching:
    semantic_cache:
      enabled: true
      similarity_threshold: 0.95
      ttl_seconds: 3600
    prompt_cache:
      enabled: true
      provider: anthropic
      
  batching:
    embeddings:
      enabled: true
      batch_size: 100
      timeout_ms: 1000
      
  budgets:
    global:
      monthly_limit_usd: 1000
      alert_threshold: 0.80
    organization:
      default_limit_usd: 100
      auto_downgrade: true
```

### 5.2 Security Stack

```yaml
security:
  input:
    injection_guard:
      enabled: true
      action: BLOCK
    sanitizer:
      max_length: 10000
      strip_code: false
      
  pii:
    scrubber:
      enabled: true
      detect_names: true
      action: REDACT
      
  output:
    hallucination_check:
      enabled: true
      for_tasks: [report, initiative]
    content_filter:
      enabled: true
      
  access:
    rate_limiting:
      enabled: true
    tenant_isolation:
      strict: true
      
  audit:
    log_all_requests: true
    retention_days: 90
    alert_on_security: true
```

---

*Document Version: 1.0*
*Last Updated: December 2024*
*Author: AI Research Team*

