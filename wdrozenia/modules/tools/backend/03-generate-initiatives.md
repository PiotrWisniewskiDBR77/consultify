# Tools - Generate Initiatives API

## Cel
Kontrakt generowania inicjatyw z Tools (tworzy DRAFT initiatives + linkowanie source).

## Zrodla
- `server/src/controllers/ToolController.ts` (linie 867-977)
- `server/src/services/ToolInitiativeService.ts`
- `wdrozenia/ANALIZA_ZGODNOSCI_IMPLEMENTACJI.md`

---

## Endpoint

```
POST /api/tools/:toolId/generate-initiatives
```

## Request

```json
{
  "methodologyId": "impact-feasibility",
  "count": 5,
  "includeChatContext": true,
  "decisionOwnerId": "user-pmo-001",
  "dueDate": "2026-02-10",
  "priority": "high",
  "customPrompt": "Focus on cost reduction and operational efficiency"
}
```

### Parametry

| Parametr | Typ | Wymagany | Domyslna | Opis |
|----------|-----|----------|----------|------|
| `methodologyId` | string | Tak | - | Metodologia generowania |
| `count` | number | Tak | 5 | Liczba inicjatyw (1-7) |
| `includeChatContext` | boolean | Nie | false | Czy wlaczyc kontekst czatu |
| `decisionOwnerId` | uuid | Nie | current user | Owner decyzji |
| `dueDate` | date | Nie | +14 dni | Termin decyzji |
| `priority` | string | Nie | medium | Priorytet (low/medium/high/critical) |
| `customPrompt` | string | Nie | - | Dodatkowe instrukcje dla AI |

### Metodologie

| ID | Nazwa | Category | Priority | Risk | Opis | Best For |
|----|-------|----------|----------|------|------|----------|
| `impact-feasibility` | Impact x Feasibility | Strategy | P1 | Medium | Ocena wplywu vs wykonalnosci | Strategic planning, transformations |
| `value-effort` | Value x Effort | Operations | P2 | Low | Szybkie wygrane, niski naklad | Quick wins, operational improvements |
| `risk-compliance` | Risk/Compliance | Process Auto | P1 | High | Regulacje, zgodnosc, ryzyko | Compliance, risk mitigation |
| `customer-market` | Customer/Market | Digital | P2 | Medium | Doswiadczenie klienta, rynek | CX improvements, market expansion |
| `operational-efficiency` | Operational Efficiency | Operations | P2 | Low | Redukcja kosztow, optymalizacja | Cost reduction, process optimization |

## Response

**Success (200):**
```json
{
  "batchId": "batch-2026-01-27-001",
  "initiatives": [
    {
      "id": "init-gen-001",
      "title": "Implement lean manufacturing practices across EU facilities",
      "description": "Deploy lean methodology to reduce waste and improve efficiency. Target: 25% reduction in production waste, 15% improvement in throughput.",
      "status": "DRAFT",
      "category": "Strategy",
      "priority": "P1",
      "risk": "Medium",
      "estimatedValue": "$2.5M annual savings",
      "estimatedEffort": "6-9 months",
      "keyMetrics": ["Waste reduction %", "Throughput improvement", "Cost per unit"],
      "dependencies": [],
      "tags": ["lean", "manufacturing", "efficiency"]
    },
    {
      "id": "init-gen-002",
      "title": "Establish strategic partnership with Asian distributors",
      "description": "Enter APAC market through distribution partnerships in Japan and South Korea. Focus on premium segment positioning.",
      "status": "DRAFT",
      "category": "Strategy",
      "priority": "P1",
      "risk": "Medium",
      "estimatedValue": "$5M revenue potential in Y1",
      "estimatedEffort": "9-12 months",
      "keyMetrics": ["Market share", "Revenue", "Partner satisfaction"],
      "dependencies": ["Legal review", "Market research"],
      "tags": ["expansion", "APAC", "partnerships"]
    },
    {
      "id": "init-gen-003",
      "title": "Green technology investment program",
      "description": "Invest in sustainable manufacturing technologies to reduce carbon footprint by 30% and achieve ESG compliance targets.",
      "status": "DRAFT",
      "category": "Strategy",
      "priority": "P2",
      "risk": "Low",
      "estimatedValue": "$1M cost reduction + ESG compliance",
      "estimatedEffort": "12-18 months",
      "keyMetrics": ["Carbon footprint", "Energy consumption", "ESG score"],
      "dependencies": ["Budget approval", "Vendor selection"],
      "tags": ["sustainability", "ESG", "green"]
    },
    {
      "id": "init-gen-004",
      "title": "Workforce upskilling initiative for Industry 4.0",
      "description": "Train 500 employees on Industry 4.0 technologies including IoT, automation, and data analytics.",
      "status": "DRAFT",
      "category": "Strategy",
      "priority": "P2",
      "risk": "Low",
      "estimatedValue": "15% productivity increase",
      "estimatedEffort": "6-12 months",
      "keyMetrics": ["Training completion rate", "Skill assessments", "Productivity KPIs"],
      "dependencies": ["Training program design", "HR coordination"],
      "tags": ["training", "industry4.0", "workforce"]
    },
    {
      "id": "init-gen-005",
      "title": "Supply chain diversification project",
      "description": "Reduce dependency on single suppliers by establishing alternative sources in 3 regions. Target: no supplier > 30% of critical components.",
      "status": "DRAFT",
      "category": "Strategy",
      "priority": "P1",
      "risk": "Medium",
      "estimatedValue": "Risk mitigation + 10% cost optimization",
      "estimatedEffort": "9-15 months",
      "keyMetrics": ["Supplier concentration", "Lead time", "Cost variance"],
      "dependencies": ["Supplier qualification", "Contract negotiations"],
      "tags": ["supply-chain", "risk", "diversification"]
    }
  ],
  "metadata": {
    "generatedAt": "2026-01-27T18:00:00Z",
    "aiModel": "gpt-4-turbo",
    "processingTime": "4.2s",
    "tokensUsed": 2847,
    "methodology": {
      "id": "impact-feasibility",
      "name": "Impact x Feasibility",
      "appliedDefaults": {
        "category": "Strategy",
        "priority": "P1",
        "risk": "Medium"
      }
    },
    "contextUsed": {
      "toolAnswers": true,
      "chatHistory": true,
      "organizationProfile": true,
      "recentInitiatives": true
    }
  }
}
```

**Error (400 - Validation):**
```json
{
  "error": "Initiative count exceeds limit 7",
  "details": {
    "provided_count": 10,
    "max_count": 7,
    "min_count": 1
  }
}
```

**Error (409 - Wrong status):**
```json
{
  "error": "Tool session not approved",
  "details": {
    "current_status": "REVIEW",
    "required_status": "APPROVED",
    "suggestion": "Wait for approval before generating initiatives"
  }
}
```

**Error (409 - Missing context):**
```json
{
  "error": "Missing tool context for generation",
  "details": {
    "missing_fields": ["answers.context", "answers.items"],
    "suggestion": "Complete the tool analysis before generating initiatives"
  }
}
```

**Error (503 - AI Service):**
```json
{
  "error": "AI service temporarily unavailable",
  "details": {
    "retry_after": 30,
    "fallback_available": true
  }
}
```

---

## Walidacje

### 1. Permission
- Wymaga: `TOOLS_GENERATE_INITIATIVES`
- Role: ADMIN, PROJECT_MANAGER, SUPERADMIN

### 2. Status
- Narzedzie musi byc w statusie `APPROVED`

### 3. DoD
| Kryterium | Wymagana wartosc |
|-----------|------------------|
| `completion_percent` | >= 100 |
| `confidence_avg` | >= 3 |

### 4. Count
- `count` musi byc >= 1 i <= 7
- Walidacja w `tool.validators.ts`:
```typescript
count: z.number().min(1).max(7)
```

### 5. Context
- `answers_json` nie moze byc puste
- Musi zawierac `context` i `items`

### 6. Rate Limit
- Max 10 generacji na godzine per user
- Max 50 generacji na godzine per organization

---

## AI Pipeline

### 1. Build Prompt
```typescript
const buildPrompt = ({
  toolType,
  methodologyId,
  count,
  answers,
  context,
  customPrompt,
}: BuildPromptParams): string => {
  const methodologyDescription = METHODOLOGY_DESCRIPTIONS[methodologyId];
  const toolDescription = TOOL_DESCRIPTIONS[toolType];
  
  return `You are a senior transformation consultant with 20+ years of experience.
Your task is to generate ${count} strategic initiatives based on the analysis provided.

## Tool Analysis
Tool type: ${toolType} - ${toolDescription}
Methodology: ${methodologyId} - ${methodologyDescription}

## Organization Context
${JSON.stringify(context.org, null, 2)}

## Tool Answers (Analysis Results)
${JSON.stringify(answers, null, 2)}

## Recent Chat Context (if relevant)
${context.chat?.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n')}

## Existing Initiatives (avoid duplicates)
${context.initiatives?.map(i => `- ${i.title}`).join('\n')}

${customPrompt ? `## Additional Instructions\n${customPrompt}` : ''}

## Output Requirements
Generate exactly ${count} initiatives in valid JSON format.
Each initiative must include:
- title: Clear, actionable title (max 100 chars)
- description: Detailed description with measurable targets (max 500 chars)
- category: Strategy | Operations | Digital | Process Auto
- priority: P1 (critical) | P2 (important) | P3 (nice-to-have)
- risk: Low | Medium | High
- estimatedValue: Business value estimate
- estimatedEffort: Time estimate
- keyMetrics: Array of 2-4 KPIs
- dependencies: Array of prerequisites
- tags: Array of 2-5 relevant tags

Return ONLY valid JSON in this exact format:
{"initiatives":[{...},{...}]}`;
};
```

### 2. Retry Logic
```typescript
const generateWithRetry = async (prompt: string, maxRetries = 2): Promise<Initiative[]> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await aiService.complete(prompt, {
        model: 'gpt-4-turbo',
        temperature: 0.7,
        maxTokens: 4000,
        timeout: AI_TIMEOUT_MS
      });
      
      const parsed = JSON.parse(response);
      return parsed.initiatives;
    } catch (error) {
      console.error(`AI generation attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      await sleep(1000 * attempt);
    }
  }
  
  throw new Error('AI generation failed after all retries');
};
```

### 3. Fallback
Jesli AI zawiedzie, generuje fallback:
```typescript
const fallbackInitiatives = (count: number, toolType: string, methodologyId: string): Initiative[] => {
  const defaults = METHODOLOGY_DEFAULTS[methodologyId];
  const toolName = TOOL_NAMES[toolType];
  
  return Array.from({ length: count }).map((_, index) => ({
    title: `${toolName} Initiative ${index + 1}`,
    description: `Draft initiative generated from ${toolName} analysis. Please review and update with specific details.`,
    category: defaults.category,
    priority: defaults.priority,
    risk: defaults.risk,
    estimatedValue: 'To be determined',
    estimatedEffort: 'To be estimated',
    keyMetrics: ['Define KPIs'],
    dependencies: [],
    tags: [toolType, 'draft', 'review-needed']
  }));
};
```

### 4. Normalization
```typescript
const normalizeInitiatives = (
  initiatives: RawInitiative[], 
  count: number, 
  methodologyId: string
): Initiative[] => {
  const defaults = METHODOLOGY_DEFAULTS[methodologyId];
  
  // Deduplicate by title (case-insensitive)
  const seen = new Set<string>();
  const unique = initiatives.filter(i => {
    const key = i.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // Apply defaults and validate
  return unique.slice(0, count).map(initiative => ({
    title: initiative.title?.slice(0, 100) || 'Untitled Initiative',
    description: initiative.description?.slice(0, 500) || '',
    category: validateCategory(initiative.category) || defaults.category,
    priority: validatePriority(initiative.priority) || defaults.priority,
    risk: validateRisk(initiative.risk) || defaults.risk,
    estimatedValue: initiative.estimatedValue || 'To be determined',
    estimatedEffort: initiative.estimatedEffort || 'To be estimated',
    keyMetrics: Array.isArray(initiative.keyMetrics) ? initiative.keyMetrics.slice(0, 4) : [],
    dependencies: Array.isArray(initiative.dependencies) ? initiative.dependencies : [],
    tags: Array.isArray(initiative.tags) ? initiative.tags.slice(0, 5) : []
  }));
};
```

---

## Efekty

### 1. Batch Record
```sql
INSERT INTO tool_initiative_batches (
  id, tool_session_id, methodology_id, initiatives_count,
  include_chat_context, custom_prompt, generated_by, 
  ai_model, processing_time_ms, tokens_used, created_at
) VALUES (
  'batch-2026-01-27-001',
  '550e8400-e29b-41d4-a716-446655440001',
  'impact-feasibility',
  5,
  true,
  'Focus on cost reduction and operational efficiency',
  'user-123',
  'gpt-4-turbo',
  4200,
  2847,
  '2026-01-27T18:00:00Z'
);
```

### 2. Decision Record
```sql
INSERT INTO decisions (
  id, organization_id, project_id, title, type,
  decision_maker_id, status, created_by, resolved_at
) VALUES (
  'dec-gen-2026-01-27-001',
  'org-acme-corp',
  'proj-001',
  'Generate initiatives from SWOT Analysis - Manufacturing Division',
  'TOOL_GENERATE',
  'user-123',
  'approved',
  'user-123',
  '2026-01-27T18:00:00Z'
);
```

### 3. Tool Decision
```sql
INSERT INTO tool_decisions (
  id, tool_session_id, decision_type, status, decision_id, created_by, created_at
) VALUES (
  'td-gen-001',
  '550e8400-e29b-41d4-a716-446655440001',
  'GENERATE_INITIATIVES',
  'APPROVED',
  'dec-gen-2026-01-27-001',
  'user-123',
  '2026-01-27T18:00:00Z'
);
```

### 4. Initiatives
Dla kazdej wygenerowanej inicjatywy:
```sql
INSERT INTO initiatives (
  id, organization_id, project_id, name, summary, status,
  axis, source_type, source_id, priority_order, 
  estimated_value, estimated_effort, risk_level,
  created_by, created_at, updated_at
) VALUES (
  'init-gen-001',
  'org-acme-corp',
  'proj-001',
  'Implement lean manufacturing practices across EU facilities',
  'Deploy lean methodology to reduce waste and improve efficiency...',
  'DRAFT',
  'Strategy',
  'tool',
  '550e8400-e29b-41d4-a716-446655440001',
  1,
  '$2.5M annual savings',
  '6-9 months',
  'Medium',
  'user-123',
  '2026-01-27T18:00:00Z',
  '2026-01-27T18:00:00Z'
);
```

### 5. Initiative Links
```sql
INSERT INTO tool_initiative_links (
  id, tool_session_id, batch_id, initiative_id, position, created_at
) VALUES 
  ('link-001', '550e8400-...', 'batch-2026-01-27-001', 'init-gen-001', 1, '2026-01-27T18:00:00Z'),
  ('link-002', '550e8400-...', 'batch-2026-01-27-001', 'init-gen-002', 2, '2026-01-27T18:00:00Z'),
  ('link-003', '550e8400-...', 'batch-2026-01-27-001', 'init-gen-003', 3, '2026-01-27T18:00:00Z'),
  ('link-004', '550e8400-...', 'batch-2026-01-27-001', 'init-gen-004', 4, '2026-01-27T18:00:00Z'),
  ('link-005', '550e8400-...', 'batch-2026-01-27-001', 'init-gen-005', 5, '2026-01-27T18:00:00Z');
```

### 6. Initiative Tags
```sql
INSERT INTO initiative_tags (initiative_id, tag, created_at)
VALUES 
  ('init-gen-001', 'lean', '2026-01-27T18:00:00Z'),
  ('init-gen-001', 'manufacturing', '2026-01-27T18:00:00Z'),
  ('init-gen-001', 'efficiency', '2026-01-27T18:00:00Z'),
  ('init-gen-002', 'expansion', '2026-01-27T18:00:00Z'),
  ('init-gen-002', 'APAC', '2026-01-27T18:00:00Z');
```

### 7. Audit Log
```sql
INSERT INTO audit_log (
  id, organization_id, user_id, action, resource_type, resource_id, details, created_at
) VALUES (
  'audit-gen-001',
  'org-acme-corp',
  'user-123',
  'initiatives_generated',
  'tool_session',
  '550e8400-e29b-41d4-a716-446655440001',
  '{
    "batchId": "batch-2026-01-27-001",
    "count": 5,
    "methodologyId": "impact-feasibility",
    "aiModel": "gpt-4-turbo",
    "processingTime": 4200,
    "initiativeIds": ["init-gen-001", "init-gen-002", "init-gen-003", "init-gen-004", "init-gen-005"]
  }',
  '2026-01-27T18:00:00Z'
);
```

---

## Flow diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  [APPROVED] ──────────────────────────────────────────────────────────────► │
│      │                                                                      │
│      │  User opens Generate Modal                                           │
│      │  Selects methodology, count, options                                │
│      │  Clicks "Generate"                                                   │
│      │                                                                      │
│      ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  VALIDATION LAYER                                                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │   │
│  │  │ Check Perm  │  │ Check Status│  │ Check DoD   │  │ Validate   │ │   │
│  │  │ GENERATE    │  │ == APPROVED │  │ >= 100%     │  │ count 1-7  │ │   │
│  │  │             │  │             │  │ conf >= 3   │  │ context    │ │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬──────┘ │   │
│  │         ▼                ▼                ▼               ▼        │   │
│  │  ┌──────────────────────────────────────────────────────────────┐ │   │
│  │  │                    All validations pass?                      │ │   │
│  │  └──────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│              ┌───────────────┴───────────────┐                             │
│              │ YES                           │ NO                          │
│              ▼                               ▼                             │
│  ┌─────────────────────────┐    ┌─────────────────────────┐               │
│  │  AI PIPELINE            │    │  RETURN ERROR           │               │
│  │  1. Build Prompt        │    │  400 / 403 / 409        │               │
│  │  2. Call AI Service     │    │                         │               │
│  │  3. Retry if failed     │    │                         │               │
│  │  4. Fallback if needed  │    │                         │               │
│  │  5. Normalize output    │    │                         │               │
│  └───────────┬─────────────┘    └─────────────────────────┘               │
│              │                                                             │
│              ▼                                                             │
│  ┌─────────────────────────┐                                              │
│  │  PERSISTENCE LAYER      │                                              │
│  │  1. Create Batch        │                                              │
│  │  2. Create Decision     │                                              │
│  │  3. Create Initiatives  │                                              │
│  │  4. Create Links        │                                              │
│  │  5. Create Tags         │                                              │
│  │  6. Audit Log           │                                              │
│  └───────────┬─────────────┘                                              │
│              │                                                             │
│              ▼                                                             │
│  [Initiatives DRAFT] ◄─────────────────────────────────────────────────── │
│      │                                                                      │
│      │  Visible in:                                                        │
│      │  - Context Panel (Generated from this tool)                         │
│      │  - Initiatives Hub (filtered by source)                             │
│      │  - Roadmap view                                                     │
│      │                                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Przykladowe scenariusze

### Scenariusz 1: Sukces - pelna generacja
```bash
curl -X POST /api/tools/550e8400-e29b-41d4-a716-446655440001/generate-initiatives \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "methodologyId": "impact-feasibility",
    "count": 5,
    "includeChatContext": true
  }'

# Response: 200 OK
{
  "batchId": "batch-001",
  "initiatives": [
    { "id": "init-001", "title": "Lean manufacturing...", "status": "DRAFT" },
    { "id": "init-002", "title": "APAC expansion...", "status": "DRAFT" },
    ...
  ]
}
```

### Scenariusz 2: Blad - count > 7
```bash
curl -X POST /api/tools/550e8400-e29b-41d4-a716-446655440002/generate-initiatives \
  -H "Authorization: Bearer token" \
  -d '{ "methodologyId": "value-effort", "count": 10 }'

# Response: 400 Bad Request
{
  "error": "Initiative count exceeds limit 7",
  "details": { "provided_count": 10, "max_count": 7 }
}
```

### Scenariusz 3: Fallback przy bledzie AI
```bash
# AI service timeout -> fallback initiatives generated
{
  "batchId": "batch-002",
  "initiatives": [
    { "id": "init-fb-001", "title": "Dynamic SWOT Initiative 1", "status": "DRAFT", "tags": ["draft", "review-needed"] },
    { "id": "init-fb-002", "title": "Dynamic SWOT Initiative 2", "status": "DRAFT", "tags": ["draft", "review-needed"] }
  ],
  "metadata": {
    "fallbackUsed": true,
    "reason": "AI service timeout after 2 retries"
  }
}
```

---

## Metryki i monitoring

| Metryka | Opis | Alert threshold |
|---------|------|-----------------|
| `tools.generate.success` | Liczba udanych generacji | - |
| `tools.generate.fallback_used` | Liczba uzyc fallback | > 10% |
| `tools.generate.ai_timeout` | Liczba timeoutow AI | > 5% |
| `tools.generate.avg_latency_ms` | Sredni czas generacji | > 10000ms |
| `tools.generate.tokens_used` | Zuzycie tokenow AI | > 5000/request |
| `tools.generate.rate_limit_hit` | Liczba przekroczen limitu | > 10/h |
