# Faza 2: Orchestration Frameworks Analysis

## Executive Summary

Ten dokument analizuje dostępne frameworki do orkiestracji LLM pod kątem wykorzystania w Consultify. Porównujemy podejście framework-based vs custom implementation, uwzględniając TypeScript support, structured outputs, observability i production-readiness.

**Rekomendacja główna:** 
- **Primary:** Vercel AI SDK (ai) - lekki, TypeScript-native, streaming, structured outputs
- **Supplementary:** Custom orchestration layer na bazie Vercel AI SDK
- **Avoid:** LangChain.js (overengineered), LlamaIndex (Python-centric)

---

## 1. Framework Comparison Overview

| Framework | Language | Focus | Complexity | Production Ready | TypeScript |
|-----------|----------|-------|------------|------------------|------------|
| Vercel AI SDK | TS/JS | Streaming, UI | Low | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| LangChain.js | TS/JS | Full-stack | High | ⭐⭐⭐ | ⭐⭐⭐ |
| LlamaIndex | Python | RAG | Medium | ⭐⭐⭐⭐ | ❌ |
| Instructor | Python/TS | Structured | Low | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| DSPy | Python | Prompt Opt | High | ⭐⭐ | ❌ |
| Semantic Kernel | C#/Python | Enterprise | High | ⭐⭐⭐⭐ | ❌ |
| Haystack | Python | Pipelines | Medium | ⭐⭐⭐⭐ | ❌ |
| Custom | Any | Full Control | Variable | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 2. Vercel AI SDK (Recommended)

### 2.1 Overview

Vercel AI SDK (`ai` package) to lekka biblioteka TypeScript zaprojektowana dla React/Next.js aplikacji, ale działa również w Node.js backend.

### 2.2 Key Features

```typescript
// Structured Outputs with Zod
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const InitiativeSchema = z.object({
  title: z.string().max(60),
  objective: z.string(),
  steps: z.array(z.string()).length(3),
  effort: z.enum(['S', 'M', 'L']),
  impact: z.enum(['Low', 'Medium', 'High'])
});

const { object } = await generateObject({
  model: openai('gpt-4o'),
  schema: InitiativeSchema,
  prompt: 'Generate a transformation initiative for improving data management'
});
```

### 2.3 Streaming Support

```typescript
import { streamText } from 'ai';

const result = await streamText({
  model: openai('gpt-4o-mini'),
  messages: [{ role: 'user', content: userMessage }],
  system: systemPrompt,
  onChunk: (chunk) => {
    // Real-time streaming to UI
  }
});

// React hook integration
const { messages, input, handleSubmit } = useChat({
  api: '/api/chat',
});
```

### 2.4 Multi-Provider Support

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { mistral } from '@ai-sdk/mistral';

// Switch providers with single line change
const model = anthropic('claude-3-5-sonnet-20241022');
```

### 2.5 Tool Calling

```typescript
import { tool } from 'ai';

const weatherTool = tool({
  description: 'Get current weather',
  parameters: z.object({
    location: z.string()
  }),
  execute: async ({ location }) => {
    // Implementation
    return { temperature: 22, condition: 'sunny' };
  }
});

const result = await generateText({
  model: openai('gpt-4o'),
  tools: { weather: weatherTool },
  prompt: 'What is the weather in Warsaw?'
});
```

### 2.6 Pros & Cons

**Pros:**
- ✅ Native TypeScript - pełne type safety
- ✅ Zod integration for structured outputs
- ✅ First-class streaming support
- ✅ Multi-provider (OpenAI, Anthropic, Google, Mistral, etc.)
- ✅ React hooks dla frontend
- ✅ Lightweight - minimal dependencies
- ✅ Active development (Vercel)
- ✅ Production-tested (used by Vercel, many startups)

**Cons:**
- ❌ Brak built-in RAG
- ❌ Brak built-in memory management
- ❌ Brak built-in prompt versioning
- ❌ Brak multi-agent support

### 2.7 Verdict for Consultify

**RECOMMENDED jako primary SDK** - używamy go jako lightweight wrapper nad LLM providers, a brakujące funkcjonalności (RAG, memory, prompts) implementujemy custom.

---

## 3. LangChain.js

### 3.1 Overview

LangChain to najbardziej popularny framework do budowania LLM applications. Wersja JavaScript/TypeScript istnieje, ale jest mniej dojrzała niż Python.

### 3.2 Architecture

```
┌─────────────────────────────────────────────────┐
│                  LangChain.js                    │
├─────────────────────────────────────────────────┤
│  Models     │  Prompts    │  Chains    │  Agents │
├─────────────────────────────────────────────────┤
│  Memory     │  Retrievers │  Tools     │  Output │
└─────────────────────────────────────────────────┘
```

### 3.3 Code Example

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";

const model = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0
});

const messages = [
  new SystemMessage("You are a PMO consultant"),
  new HumanMessage("Analyze this assessment data")
];

const parser = new StringOutputParser();
const chain = model.pipe(parser);

const response = await chain.invoke(messages);
```

### 3.4 Structured Outputs

```typescript
import { z } from "zod";
import { StructuredOutputParser } from "langchain/output_parsers";

const parser = StructuredOutputParser.fromZodSchema(
  z.object({
    initiative: z.string(),
    priority: z.enum(["high", "medium", "low"])
  })
);

const formatInstructions = parser.getFormatInstructions();
```

### 3.5 Pros & Cons

**Pros:**
- ✅ Comprehensive feature set
- ✅ Built-in RAG, memory, agents
- ✅ Large community
- ✅ LangSmith observability

**Cons:**
- ❌ **Overengineered** - too many abstractions
- ❌ **Poor TypeScript support** - many anys, incomplete types
- ❌ **Frequent breaking changes** - unstable API
- ❌ **Debugging nightmare** - deep call stacks
- ❌ **Performance overhead** - abstractions add latency
- ❌ **JS version lags behind Python**

### 3.6 Verdict for Consultify

**NOT RECOMMENDED** - zbyt skomplikowany dla naszych potrzeb, słaby TypeScript support, zbyt wiele abstrakcji które utrudniają debugging i customizację.

---

## 4. LlamaIndex

### 4.1 Overview

LlamaIndex to framework skoncentrowany na RAG (Retrieval Augmented Generation). Główna wersja jest w Pythonie, TypeScript version (LlamaIndex.TS) jest młodsza.

### 4.2 Key Features

- Data connectors (PDF, DOCX, web, databases)
- Indexing strategies (vector, keyword, tree)
- Query engines
- Chat engines with memory

### 4.3 Code Example (TypeScript)

```typescript
import {
  Document,
  VectorStoreIndex,
  SimpleDirectoryReader
} from "llamaindex";

// Load documents
const reader = new SimpleDirectoryReader();
const documents = await reader.loadData("./knowledge");

// Create index
const index = await VectorStoreIndex.fromDocuments(documents);

// Query
const queryEngine = index.asQueryEngine();
const response = await queryEngine.query("What are DRD axes?");
```

### 4.4 Pros & Cons

**Pros:**
- ✅ Best-in-class RAG capabilities
- ✅ Multiple indexing strategies
- ✅ Data connectors for many formats
- ✅ Good for document-heavy applications

**Cons:**
- ❌ **Python-first** - TS version is secondary
- ❌ **Limited TypeScript types**
- ❌ **Heavy dependencies**
- ❌ **Focused only on RAG** - not a general solution

### 4.5 Verdict for Consultify

**PARTIAL USE** - rozważyć tylko dla RAG component, ale lepiej zaimplementować custom RAG z Vercel AI SDK + vector DB.

---

## 5. Instructor (TypeScript)

### 5.1 Overview

Instructor to lekka biblioteka skupiona wyłącznie na structured outputs. Inspirowana Pydantic w Pythonie, wersja TypeScript używa Zod.

### 5.2 Code Example

```typescript
import Instructor from "@instructor-ai/instructor";
import OpenAI from "openai";
import { z } from "zod";

const oai = new OpenAI();
const client = Instructor({
  client: oai,
  mode: "FUNCTIONS"
});

const UserSchema = z.object({
  name: z.string(),
  age: z.number()
});

const user = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Extract: John is 25 years old" }],
  response_model: { schema: UserSchema, name: "User" }
});
// { name: "John", age: 25 }
```

### 5.3 Pros & Cons

**Pros:**
- ✅ Focused - does one thing well
- ✅ Lightweight
- ✅ Zod integration
- ✅ Retry logic for validation failures

**Cons:**
- ❌ Only structured outputs
- ❌ Limited provider support
- ❌ No streaming for objects

### 5.4 Verdict for Consultify

**NOT NEEDED** - Vercel AI SDK ma wbudowane structured outputs z Zod, które są lepiej zintegrowane.

---

## 6. Custom Implementation

### 6.1 Architecture Proposal

```
┌─────────────────────────────────────────────────────────────────┐
│                    Consultify AI Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Vercel    │  │   Custom    │  │   Custom    │              │
│  │   AI SDK    │  │   Prompt    │  │   Memory    │              │
│  │  (LLM calls)│  │   Manager   │  │   Manager   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Custom    │  │   Custom    │  │   Custom    │              │
│  │   RAG       │  │   Cost      │  │   Audit     │              │
│  │   Service   │  │   Control   │  │   Logger    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Core Components

#### 6.2.1 AI Pipeline

```typescript
// services/ai/pipeline.ts
interface AIPipelineRequest {
  messages: Message[];
  context: ScreenContext;
  options: {
    model?: string;
    stream?: boolean;
    structured?: z.ZodSchema;
  };
}

interface AIPipelineResponse {
  content: string | object;
  usage: TokenUsage;
  latency: number;
  auditId: string;
}

class AIPipeline {
  async process(request: AIPipelineRequest): Promise<AIPipelineResponse> {
    // 1. Access Gate
    await this.accessGate.check(request.context);
    
    // 2. Build Context
    const enrichedContext = await this.contextBuilder.build(request);
    
    // 3. Retrieve Memory
    const memory = await this.memoryManager.retrieve(request.context);
    
    // 4. Assemble Prompt
    const prompt = await this.promptAssembler.build(request, enrichedContext, memory);
    
    // 5. Select Model
    const model = await this.modelRouter.select(request, prompt);
    
    // 6. Call LLM (via Vercel AI SDK)
    const response = await this.llmService.call(model, prompt, request.options);
    
    // 7. Post-process
    const processed = await this.postProcessor.process(response);
    
    // 8. Audit
    const auditId = await this.auditLogger.log(request, response);
    
    return { ...processed, auditId };
  }
}
```

#### 6.2.2 LLM Service (Vercel AI SDK wrapper)

```typescript
// services/ai/llmService.ts
import { generateText, generateObject, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

class LLMService {
  private providers = {
    openai: (model: string) => openai(model),
    anthropic: (model: string) => anthropic(model),
    google: (model: string) => google(model)
  };

  async generateText(config: TextGenerationConfig): Promise<TextResult> {
    const model = this.providers[config.provider](config.model);
    
    return await generateText({
      model,
      messages: config.messages,
      system: config.systemPrompt,
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens
    });
  }

  async generateStructured<T>(config: StructuredConfig<T>): Promise<T> {
    const model = this.providers[config.provider](config.model);
    
    const { object } = await generateObject({
      model,
      schema: config.schema,
      messages: config.messages,
      system: config.systemPrompt
    });
    
    return object;
  }

  async *streamText(config: StreamConfig): AsyncGenerator<string> {
    const model = this.providers[config.provider](config.model);
    
    const result = await streamText({
      model,
      messages: config.messages,
      system: config.systemPrompt
    });

    for await (const chunk of result.textStream) {
      yield chunk;
    }
  }
}
```

#### 6.2.3 Prompt Manager

```typescript
// services/ai/promptManager.ts
interface PromptTemplate {
  id: string;
  name: string;
  type: 'system' | 'role' | 'phase' | 'task';
  template: string;
  variables: string[];
  version: number;
  isActive: boolean;
}

class PromptManager {
  // Load from database with caching
  async getPrompt(key: string): Promise<string> {
    const cached = await this.cache.get(`prompt:${key}`);
    if (cached) return cached;

    const prompt = await this.db.getActivePrompt(key);
    await this.cache.set(`prompt:${key}`, prompt.template, 300);
    
    return prompt.template;
  }

  // Build complete prompt from layers
  async buildPrompt(context: PromptContext): Promise<string> {
    const layers = await Promise.all([
      this.getPrompt('SYSTEM_GLOBAL'),
      this.getPrompt(`ROLE_${context.role}`),
      this.getPrompt(`PHASE_${context.phase}`),
      this.getUserOverlay(context.userId)
    ]);

    return this.stackLayers(layers);
  }

  // Interpolate variables
  interpolate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => 
      variables[key] ?? `{{${key}}}`
    );
  }
}
```

### 6.3 Pros & Cons

**Pros:**
- ✅ **Full control** - no black boxes
- ✅ **Perfect TypeScript** - we own the types
- ✅ **Optimized** - only what we need
- ✅ **Debuggable** - transparent flow
- ✅ **No lock-in** - easy to change
- ✅ **Matches Consultify architecture**

**Cons:**
- ❌ More initial development time
- ❌ Need to build observability ourselves
- ❌ No community support

### 6.4 Verdict for Consultify

**RECOMMENDED** - custom implementation na bazie Vercel AI SDK daje nam pełną kontrolę i idealnie dopasowuje się do istniejącej architektury Consultify.

---

## 7. POC Implementation

### 7.1 Test Case: Initiative Generation

Implementacja tego samego use case w różnych podejściach:

**Input:**
```json
{
  "assessment": {
    "dataManagement": { "current": 2, "target": 4, "gap": 2 },
    "processes": { "current": 3, "target": 5, "gap": 2 }
  },
  "context": {
    "company": "Manufacturing Corp",
    "industry": "Manufacturing"
  }
}
```

**Expected Output:**
```json
{
  "initiatives": [
    {
      "title": "Data Governance Framework Implementation",
      "objective": "Establish enterprise data governance to close maturity gap",
      "steps": ["Audit current data assets", "Define data ownership", "Implement data quality tools"],
      "effort": "L",
      "impact": "High"
    }
  ]
}
```

### 7.2 POC: Vercel AI SDK (Recommended)

```typescript
// poc/vercel-ai-sdk.ts
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const InitiativeSchema = z.object({
  initiatives: z.array(z.object({
    title: z.string().max(60),
    objective: z.string(),
    steps: z.array(z.string()).length(3),
    effort: z.enum(['S', 'M', 'L']),
    impact: z.enum(['Low', 'Medium', 'High'])
  }))
});

async function generateInitiatives(assessment: Assessment, context: Context) {
  const systemPrompt = `You are a digital transformation consultant.
Generate transformation initiatives based on assessment gaps.
Focus on practical, actionable recommendations.`;

  const userPrompt = `
Company: ${context.company}
Industry: ${context.industry}

Assessment Gaps:
${Object.entries(assessment).map(([axis, data]) => 
  `- ${axis}: Current ${data.current}, Target ${data.target}, Gap: ${data.gap}`
).join('\n')}

Generate 3 initiatives to address the highest priority gaps.`;

  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: InitiativeSchema,
    system: systemPrompt,
    prompt: userPrompt
  });

  return object.initiatives;
}
```

**Result:**
- Lines of code: ~30
- Dependencies: 2 (@ai-sdk/openai, ai)
- Type safety: Full
- Structured output: Guaranteed by Zod
- Streaming: Supported
- Time to implement: 15 minutes

### 7.3 POC: LangChain.js

```typescript
// poc/langchain.ts
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";

const schema = z.object({
  initiatives: z.array(z.object({
    title: z.string(),
    objective: z.string(),
    steps: z.array(z.string()),
    effort: z.enum(['S', 'M', 'L']),
    impact: z.enum(['Low', 'Medium', 'High'])
  }))
});

async function generateInitiatives(assessment: Assessment, context: Context) {
  const parser = StructuredOutputParser.fromZodSchema(schema);
  const formatInstructions = parser.getFormatInstructions();

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a digital transformation consultant. {format_instructions}"],
    ["human", "Company: {company}\nIndustry: {industry}\n\nGaps:\n{gaps}\n\nGenerate 3 initiatives."]
  ]);

  const model = new ChatOpenAI({ modelName: "gpt-4o", temperature: 0 });
  const chain = prompt.pipe(model).pipe(parser);

  const result = await chain.invoke({
    company: context.company,
    industry: context.industry,
    gaps: formatGaps(assessment),
    format_instructions: formatInstructions
  });

  return result.initiatives;
}
```

**Result:**
- Lines of code: ~40
- Dependencies: 5+ (@langchain/*, zod)
- Type safety: Partial (anys in chain)
- Structured output: Via parser (less reliable)
- Streaming: Complicated setup
- Time to implement: 45 minutes

### 7.4 POC Comparison

| Metric | Vercel AI SDK | LangChain.js |
|--------|---------------|--------------|
| Lines of Code | 30 | 40+ |
| Dependencies | 2 | 5+ |
| Type Safety | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Structured Output | Native | Parser-based |
| Streaming | Native | Complex |
| Learning Curve | Low | High |
| Debug Difficulty | Low | High |
| Bundle Size | Small | Large |

---

## 8. Observability & Debugging

### 8.1 Options

| Tool | Type | Integration | Cost |
|------|------|-------------|------|
| LangSmith | Hosted | LangChain only | $$$$ |
| Helicone | Hosted | Any provider | $$ |
| Portkey | Hosted | Multi-provider | $$$ |
| Langfuse | Open Source | Any | Free/$ |
| Custom | Self-built | Perfect | Dev time |

### 8.2 Recommendation: Langfuse + Custom

```typescript
// services/ai/observability.ts
import { Langfuse } from "langfuse";

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY
});

class AIObservability {
  async traceRequest(request: AIPipelineRequest, fn: () => Promise<any>) {
    const trace = langfuse.trace({
      name: "ai-pipeline",
      metadata: {
        userId: request.context.userId,
        projectId: request.context.projectId,
        capability: request.capability
      }
    });

    const span = trace.span({ name: "llm-call" });
    
    try {
      const result = await fn();
      span.end({ output: result });
      return result;
    } catch (error) {
      span.end({ statusMessage: error.message, level: "ERROR" });
      throw error;
    }
  }
}
```

---

## 9. Final Recommendation

### 9.1 Chosen Stack

```yaml
orchestration:
  primary: Custom Pipeline
  llm_sdk: Vercel AI SDK (ai)
  
providers:
  openai: "@ai-sdk/openai"
  anthropic: "@ai-sdk/anthropic"
  google: "@ai-sdk/google"
  
structured_outputs:
  schema: Zod
  method: Native (generateObject)
  
observability:
  primary: Langfuse (open source)
  backup: Custom audit logging
  
prompt_management:
  storage: PostgreSQL (ai_system_prompts)
  versioning: Custom (version column)
  caching: Redis
```

### 9.2 Architecture Decision Record

**Decision:** Use custom orchestration layer built on Vercel AI SDK

**Context:**
- Consultify ma istniejący backend w Node.js/TypeScript
- Potrzebujemy pełnej kontroli nad prompt management
- Potrzebujemy integracji z istniejącym systemem RBAC/governance
- Framework abstractions (LangChain) dodają complexity bez wartości

**Consequences:**
- (+) Pełna kontrola nad flow
- (+) Perfekcyjna integracja z Consultify
- (+) Brak vendor lock-in
- (+) Optymalna wydajność
- (-) Więcej initial development
- (-) Własne rozwiązania dla observability

### 9.3 Implementation Roadmap

1. **Week 1:** LLM Service (Vercel AI SDK wrapper)
2. **Week 2:** Prompt Manager (DB-backed, versioned)
3. **Week 3:** AI Pipeline (orchestration layer)
4. **Week 4:** Observability (Langfuse integration)

---

## 10. Appendix: Package Versions

```json
{
  "dependencies": {
    "ai": "^3.4.0",
    "@ai-sdk/openai": "^0.0.66",
    "@ai-sdk/anthropic": "^0.0.51",
    "@ai-sdk/google": "^0.0.52",
    "zod": "^3.23.8",
    "langfuse": "^3.6.0"
  }
}
```

---

*Document Version: 1.0*
*Last Updated: December 2024*
*Author: AI Research Team*



