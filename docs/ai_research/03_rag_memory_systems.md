# Faza 3: RAG and Memory Systems Analysis

## Executive Summary

Ten dokument analizuje technologie RAG (Retrieval Augmented Generation) i architektury pamięci dla AI. Obejmuje vector databases, embedding models, chunking strategies i propozycję 5-warstwowej architektury pamięci dla Consultify.

**Rekomendacja główna:**
- **Vector DB:** pgvector (PostgreSQL extension) - wykorzystanie istniejącej bazy
- **Embeddings:** OpenAI text-embedding-3-small (primary), Cohere dla fallback
- **Memory Architecture:** 5 warstw (Session → Project → Organization → Knowledge → External)
- **Chunking:** Semantic chunking z overlapping windows

---

## 1. Vector Database Comparison

### 1.1 Overview Matrix

| Database | Type | Hosting | Max Vectors | Query Speed | Price |
|----------|------|---------|-------------|-------------|-------|
| pgvector | Extension | Self | 10M+ | ⭐⭐⭐ | Free |
| Pinecone | Managed | Cloud | 100M+ | ⭐⭐⭐⭐⭐ | $$$ |
| Weaviate | Hybrid | Both | 100M+ | ⭐⭐⭐⭐ | $$ |
| Qdrant | Open Source | Both | 100M+ | ⭐⭐⭐⭐⭐ | Free/$ |
| Chroma | Open Source | Self | 1M+ | ⭐⭐⭐ | Free |
| Milvus | Open Source | Both | 1B+ | ⭐⭐⭐⭐ | Free/$ |

### 1.2 pgvector (Recommended for Consultify)

#### Overview

pgvector to PostgreSQL extension dodająca vector similarity search. Idealne dla Consultify ponieważ już używamy PostgreSQL.

#### Features

```sql
-- Enable extension
CREATE EXTENSION vector;

-- Create table with vector column
CREATE TABLE knowledge_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID REFERENCES documents(id),
    chunk_text TEXT NOT NULL,
    embedding vector(1536),  -- OpenAI dimension
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create HNSW index for fast similarity search
CREATE INDEX ON knowledge_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Similarity search query
SELECT chunk_text, 1 - (embedding <=> query_embedding) AS similarity
FROM knowledge_embeddings
WHERE organization_id = $1
ORDER BY embedding <=> query_embedding
LIMIT 5;
```

#### Performance

| Vectors | Index Type | Query Time | Memory |
|---------|------------|------------|--------|
| 100K | IVFFlat | 5ms | 200MB |
| 100K | HNSW | 2ms | 400MB |
| 1M | IVFFlat | 20ms | 2GB |
| 1M | HNSW | 5ms | 4GB |

#### Pros & Cons

**Pros:**
- ✅ No additional infrastructure
- ✅ ACID transactions
- ✅ Joins with other tables
- ✅ Familiar SQL interface
- ✅ Free
- ✅ Backup/restore with PostgreSQL

**Cons:**
- ❌ Slower than dedicated vector DBs at scale
- ❌ HNSW index rebuild on updates
- ❌ Memory intensive for large datasets

#### Verdict

**RECOMMENDED** - idealne dla Consultify (10K-100K dokumentów), zero dodatkowej infrastruktury.

---

### 1.3 Pinecone

#### Overview

Pinecone to managed vector database, lider rynkowy dla RAG applications.

#### Pricing (Serverless)

```
Storage: $0.33/GB/month
Queries: $0.35/1M queries
Write: $2.00/1M upserts
```

#### Example Usage

```typescript
import { Pinecone } from '@pinecone-database/pinecone';

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index('consultify-knowledge');

// Upsert vectors
await index.namespace('org-123').upsert([
  {
    id: 'doc-1-chunk-0',
    values: embedding,
    metadata: {
      text: chunkText,
      docId: 'doc-1',
      source: 'drd-methodology'
    }
  }
]);

// Query with filtering
const results = await index.namespace('org-123').query({
  vector: queryEmbedding,
  topK: 5,
  filter: { source: { $eq: 'drd-methodology' } },
  includeMetadata: true
});
```

#### Pros & Cons

**Pros:**
- ✅ Best-in-class performance
- ✅ Managed - zero ops
- ✅ Real-time updates
- ✅ Metadata filtering
- ✅ Namespaces for multi-tenancy

**Cons:**
- ❌ Vendor lock-in
- ❌ Cost at scale
- ❌ External dependency

#### Verdict

**FUTURE OPTION** - rozważyć gdy >100K dokumentów lub potrzeba ultra-low latency.

---

### 1.4 Qdrant

#### Overview

Open-source vector database z opcją managed cloud. Bardzo dobra alternatywa dla Pinecone.

#### Self-Hosted (Docker)

```yaml
# docker-compose.yml
services:
  qdrant:
    image: qdrant/qdrant
    ports:
      - "6333:6333"
    volumes:
      - ./qdrant_storage:/qdrant/storage
```

#### Example Usage

```typescript
import { QdrantClient } from '@qdrant/js-client-rest';

const client = new QdrantClient({ url: 'http://localhost:6333' });

// Create collection
await client.createCollection('knowledge', {
  vectors: {
    size: 1536,
    distance: 'Cosine'
  }
});

// Upsert with payload
await client.upsert('knowledge', {
  points: [{
    id: 'doc-1-chunk-0',
    vector: embedding,
    payload: {
      text: chunkText,
      organizationId: 'org-123',
      source: 'drd-methodology'
    }
  }]
});

// Search with filtering
const results = await client.search('knowledge', {
  vector: queryEmbedding,
  limit: 5,
  filter: {
    must: [{ key: 'organizationId', match: { value: 'org-123' } }]
  }
});
```

#### Pros & Cons

**Pros:**
- ✅ Open source
- ✅ Fast (Rust)
- ✅ Good TypeScript SDK
- ✅ Filtering & payloads
- ✅ Managed cloud option

**Cons:**
- ❌ Additional infrastructure
- ❌ Backup/sync management

#### Verdict

**ALTERNATIVE** - jeśli pgvector nie wystarczy, Qdrant to dobra opcja.

---

### 1.5 Vector DB Decision Matrix

| Criteria | Weight | pgvector | Pinecone | Qdrant |
|----------|--------|----------|----------|--------|
| No New Infra | 30% | ⭐⭐⭐⭐⭐ | ⭐ | ⭐⭐ |
| Performance | 20% | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Cost | 20% | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| Multi-tenancy | 15% | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| TypeScript SDK | 15% | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Total** | 100% | **4.0** | **3.3** | **3.6** |

**Winner: pgvector** - dla obecnej skali Consultify

---

## 2. Embedding Models Comparison

### 2.1 Overview

| Model | Provider | Dimensions | Max Tokens | Price/1M | Polish |
|-------|----------|------------|------------|----------|--------|
| text-embedding-3-large | OpenAI | 3072 | 8191 | $0.13 | ⭐⭐⭐⭐ |
| text-embedding-3-small | OpenAI | 1536 | 8191 | $0.02 | ⭐⭐⭐⭐ |
| text-embedding-ada-002 | OpenAI | 1536 | 8191 | $0.10 | ⭐⭐⭐ |
| embed-v3 | Cohere | 1024 | 512 | $0.10 | ⭐⭐⭐⭐⭐ |
| voyage-large-2 | Voyage | 1536 | 16000 | $0.12 | ⭐⭐⭐ |
| multilingual-e5-large | Local | 1024 | 512 | Free | ⭐⭐⭐⭐ |

### 2.2 OpenAI text-embedding-3-small (Recommended)

#### Why Recommended

```typescript
import OpenAI from 'openai';

const openai = new OpenAI();

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    encoding_format: 'float'
  });
  
  return response.data[0].embedding;
}
```

**Cost Analysis:**
- 1M tokens = ~750K words = ~1500 documents
- Cost: $0.02 per 1M tokens
- Monthly 10K documents: ~$0.13

**Quality Benchmarks (MTEB):**
- English retrieval: 63.4%
- Multilingual: 62.1%
- Classification: 73.5%

### 2.3 Cohere embed-v3 (Alternative)

**Best for:**
- Heavy Polish content
- Multilingual search
- Compressed embeddings (binary support)

```typescript
import { CohereClient } from 'cohere-ai';

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

async function generateEmbedding(texts: string[]): Promise<number[][]> {
  const response = await cohere.embed({
    texts,
    model: 'embed-multilingual-v3.0',
    inputType: 'search_document',
    embeddingTypes: ['float']
  });
  
  return response.embeddings.float;
}
```

### 2.4 Local Option: sentence-transformers

**For: Development, offline mode, cost-sensitive**

```typescript
// Using Transformers.js
import { pipeline } from '@xenova/transformers';

const embedder = await pipeline(
  'feature-extraction',
  'Xenova/multilingual-e5-large'
);

async function generateEmbedding(text: string): Promise<number[]> {
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}
```

### 2.5 Embedding Model Decision

| Scenario | Recommended Model |
|----------|-------------------|
| Default | text-embedding-3-small |
| Heavy Polish | Cohere embed-v3 |
| Development | Local sentence-transformers |
| High precision | text-embedding-3-large |

---

## 3. Chunking Strategies

### 3.1 Comparison

| Strategy | Pros | Cons | Use Case |
|----------|------|------|----------|
| Fixed size | Simple, predictable | Breaks context | Short docs |
| Sentence | Semantic units | Variable size | Articles |
| Paragraph | Natural boundaries | Can be too large | Structured docs |
| Semantic | Best context | Complex, slower | Knowledge base |
| Recursive | Balanced | Moderate complexity | General purpose |

### 3.2 Recommended: Recursive with Overlap

```typescript
interface ChunkingConfig {
  chunkSize: number;      // Target chars per chunk
  chunkOverlap: number;   // Overlap between chunks
  separators: string[];   // Split points in priority order
}

const defaultConfig: ChunkingConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ['\n\n', '\n', '. ', ' ']
};

function recursiveChunk(text: string, config: ChunkingConfig): string[] {
  const { chunkSize, chunkOverlap, separators } = config;
  
  if (text.length <= chunkSize) {
    return [text];
  }
  
  // Find the best separator
  let bestSeparator = separators[separators.length - 1];
  for (const sep of separators) {
    if (text.includes(sep)) {
      bestSeparator = sep;
      break;
    }
  }
  
  // Split and recursively chunk
  const parts = text.split(bestSeparator);
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const part of parts) {
    if (currentChunk.length + part.length <= chunkSize) {
      currentChunk += (currentChunk ? bestSeparator : '') + part;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = part;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  
  // Add overlap
  return addOverlap(chunks, chunkOverlap);
}
```

### 3.3 Semantic Chunking (Advanced)

```typescript
// Using LLM to determine chunk boundaries
async function semanticChunk(text: string): Promise<string[]> {
  const sentences = splitIntoSentences(text);
  const embeddings = await Promise.all(
    sentences.map(s => generateEmbedding(s))
  );
  
  // Find semantic boundaries by detecting embedding distance jumps
  const boundaries: number[] = [0];
  for (let i = 1; i < embeddings.length; i++) {
    const similarity = cosineSimilarity(embeddings[i], embeddings[i-1]);
    if (similarity < 0.7) { // Threshold for topic change
      boundaries.push(i);
    }
  }
  boundaries.push(sentences.length);
  
  // Create chunks from boundaries
  return boundaries.slice(0, -1).map((start, idx) => {
    const end = boundaries[idx + 1];
    return sentences.slice(start, end).join(' ');
  });
}
```

---

## 4. Five-Layer Memory Architecture

### 4.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     LAYER 5: EXTERNAL                            │
│              Internet Search (Web, APIs)                         │
│                    TTL: Request-only                             │
├─────────────────────────────────────────────────────────────────┤
│                     LAYER 4: GLOBAL KNOWLEDGE                    │
│        DRD Methodology, Best Practices, Templates                │
│                    TTL: Permanent (versioned)                    │
├─────────────────────────────────────────────────────────────────┤
│                     LAYER 3: ORGANIZATION                        │
│      Org documents, Past projects, Recurring patterns            │
│                    TTL: Persistent (org-scoped)                  │
├─────────────────────────────────────────────────────────────────┤
│                     LAYER 2: PROJECT                             │
│    Decisions, Phase transitions, Learnings, Risks                │
│                    TTL: Persistent (project-scoped)              │
├─────────────────────────────────────────────────────────────────┤
│                     LAYER 1: SESSION                             │
│       Current conversation, Recent context                       │
│                    TTL: Session (in-memory/Redis)                │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Layer 1: Session Memory

**Purpose:** Maintain conversation context within a single session.

**Storage:** Redis or in-memory

**Schema:**
```typescript
interface SessionMemory {
  sessionId: string;
  userId: string;
  projectId: string | null;
  
  messages: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }[];
  
  context: {
    currentScreen: string;
    focusedObject: { type: string; id: string } | null;
    recentActions: string[];
  };
  
  expiresAt: Date; // TTL: 2 hours
}
```

**Implementation:**
```typescript
class SessionMemoryManager {
  private redis: Redis;
  
  async getSession(sessionId: string): Promise<SessionMemory | null> {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }
  
  async updateSession(session: SessionMemory): Promise<void> {
    await this.redis.setex(
      `session:${session.sessionId}`,
      7200, // 2 hours TTL
      JSON.stringify(session)
    );
  }
  
  async addMessage(sessionId: string, message: Message): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');
    
    session.messages.push(message);
    
    // Keep only last 20 messages
    if (session.messages.length > 20) {
      session.messages = session.messages.slice(-20);
    }
    
    await this.updateSession(session);
  }
}
```

### 4.3 Layer 2: Project Memory

**Purpose:** Store significant project events, decisions, and learnings.

**Storage:** PostgreSQL

**Schema:**
```sql
CREATE TABLE project_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    memory_type VARCHAR(50) NOT NULL, -- 'DECISION', 'PHASE_TRANSITION', 'LEARNING', 'RISK'
    content JSONB NOT NULL,
    importance INTEGER DEFAULT 1, -- 1-5 scale for retrieval priority
    recorded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_project_memory_project ON project_memory(project_id);
CREATE INDEX idx_project_memory_type ON project_memory(memory_type);
```

**Memory Types:**
```typescript
type ProjectMemoryType = 
  | 'DECISION'          // Major decisions with rationale
  | 'PHASE_TRANSITION'  // Gate passages
  | 'LEARNING'          // Lessons learned
  | 'RISK'              // Identified risks
  | 'MILESTONE'         // Achieved milestones
  | 'BLOCKER'           // Resolved blockers
  | 'AI_RECOMMENDATION' // AI suggestions (accepted/rejected)
```

**Implementation:**
```typescript
class ProjectMemoryManager {
  async recordDecision(
    projectId: string,
    decision: {
      title: string;
      outcome: string;
      rationale: string;
      alternatives?: string[];
    },
    userId: string
  ): Promise<void> {
    await this.db.query(`
      INSERT INTO project_memory (project_id, memory_type, content, recorded_by)
      VALUES ($1, 'DECISION', $2, $3)
    `, [projectId, decision, userId]);
  }
  
  async getProjectContext(projectId: string): Promise<ProjectContext> {
    const memories = await this.db.query(`
      SELECT memory_type, content, created_at
      FROM project_memory
      WHERE project_id = $1
      ORDER BY importance DESC, created_at DESC
      LIMIT 20
    `, [projectId]);
    
    return {
      recentDecisions: memories.filter(m => m.memory_type === 'DECISION'),
      phaseHistory: memories.filter(m => m.memory_type === 'PHASE_TRANSITION'),
      activeRisks: memories.filter(m => m.memory_type === 'RISK'),
      learnings: memories.filter(m => m.memory_type === 'LEARNING')
    };
  }
}
```

### 4.4 Layer 3: Organization Memory

**Purpose:** Cross-project patterns, preferences, and institutional knowledge.

**Schema:**
```sql
CREATE TABLE organization_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    memory_type VARCHAR(50) NOT NULL,
    content JSONB NOT NULL,
    embedding vector(1536), -- For semantic search
    source_project_id UUID REFERENCES projects(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pattern types: 'RECURRING_RISK', 'BEST_PRACTICE', 'GOVERNANCE_PREFERENCE'
```

**Implementation:**
```typescript
class OrganizationMemoryManager {
  async findSimilarPatterns(
    organizationId: string,
    query: string,
    limit: number = 5
  ): Promise<Pattern[]> {
    const embedding = await generateEmbedding(query);
    
    const patterns = await this.db.query(`
      SELECT content, 1 - (embedding <=> $1) as similarity
      FROM organization_memory
      WHERE organization_id = $2
        AND memory_type = 'BEST_PRACTICE'
      ORDER BY embedding <=> $1
      LIMIT $3
    `, [embedding, organizationId, limit]);
    
    return patterns.filter(p => p.similarity > 0.7);
  }
  
  async learnFromProject(projectId: string): Promise<void> {
    // Extract patterns from completed project
    const project = await this.getProjectWithMemory(projectId);
    
    // Use AI to identify reusable patterns
    const patterns = await this.ai.extractPatterns(project);
    
    for (const pattern of patterns) {
      await this.storePattern(project.organizationId, pattern);
    }
  }
}
```

### 4.5 Layer 4: Global Knowledge Base

**Purpose:** DRD methodology, industry best practices, templates.

**Storage:** PostgreSQL with pgvector

**Schema:**
```sql
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL, -- 'DRD_METHODOLOGY', 'INDUSTRY', 'TEMPLATE'
    source VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_knowledge_embedding ON knowledge_base 
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX idx_knowledge_category ON knowledge_base(category);
```

**Content Categories:**
```typescript
const KNOWLEDGE_CATEGORIES = {
  DRD_METHODOLOGY: {
    sources: ['Digital Pathfinder book', 'DRD documentation'],
    examples: ['7 DRD axes definitions', 'Maturity level descriptions']
  },
  INDUSTRY_PRACTICES: {
    sources: ['ISO 21500', 'PMBOK 7', 'PRINCE2'],
    examples: ['PMO best practices', 'Change management frameworks']
  },
  TEMPLATES: {
    sources: ['Internal templates'],
    examples: ['Initiative template', 'Risk register template']
  },
  BENCHMARKS: {
    sources: ['Industry reports'],
    examples: ['Digital maturity benchmarks by industry']
  }
};
```

**Implementation:**
```typescript
class KnowledgeBaseManager {
  async search(
    query: string,
    options: {
      categories?: string[];
      limit?: number;
      minScore?: number;
    } = {}
  ): Promise<KnowledgeChunk[]> {
    const { categories, limit = 5, minScore = 0.5 } = options;
    const embedding = await generateEmbedding(query);
    
    let sql = `
      SELECT id, title, content, category, 
             1 - (embedding <=> $1) as similarity
      FROM knowledge_base
      WHERE 1=1
    `;
    const params: any[] = [embedding];
    
    if (categories?.length) {
      sql += ` AND category = ANY($${params.length + 1})`;
      params.push(categories);
    }
    
    sql += ` ORDER BY embedding <=> $1 LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const results = await this.db.query(sql, params);
    
    return results
      .filter(r => r.similarity >= minScore)
      .map(r => ({
        id: r.id,
        title: r.title,
        content: r.content,
        category: r.category,
        relevance: r.similarity
      }));
  }
  
  async ingestDocument(doc: {
    title: string;
    content: string;
    category: string;
    source: string;
  }): Promise<void> {
    // Chunk the content
    const chunks = recursiveChunk(doc.content, defaultChunkConfig);
    
    // Generate embeddings for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateEmbedding(chunks[i]);
      
      await this.db.query(`
        INSERT INTO knowledge_base 
        (category, source, title, content, embedding, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        doc.category,
        doc.source,
        `${doc.title} (${i + 1}/${chunks.length})`,
        chunks[i],
        embedding,
        { chunkIndex: i, totalChunks: chunks.length }
      ]);
    }
  }
}
```

### 4.6 Layer 5: External Knowledge

**Purpose:** Real-time information from internet, APIs.

**Implementation:**
```typescript
interface ExternalSearchResult {
  source: string;
  title: string;
  snippet: string;
  url: string;
  retrievedAt: Date;
}

class ExternalKnowledgeManager {
  async search(query: string): Promise<ExternalSearchResult[]> {
    // Check if external search is enabled for organization
    if (!this.policy.allowExternalSearch) {
      return [];
    }
    
    // Use Tavily or similar AI search API
    const results = await this.tavily.search({
      query,
      searchDepth: 'advanced',
      maxResults: 5
    });
    
    return results.map(r => ({
      source: 'web_search',
      title: r.title,
      snippet: r.content,
      url: r.url,
      retrievedAt: new Date()
    }));
  }
}
```

---

## 5. RAG Pipeline Implementation

### 5.1 Complete RAG Flow

```typescript
interface RAGQuery {
  query: string;
  context: {
    userId: string;
    organizationId: string;
    projectId?: string;
    screenContext?: string;
  };
  options?: {
    layers?: ('session' | 'project' | 'org' | 'knowledge' | 'external')[];
    maxChunks?: number;
    minRelevance?: number;
  };
}

interface RAGResult {
  chunks: {
    layer: string;
    content: string;
    source: string;
    relevance: number;
  }[];
  totalTokens: number;
}

class RAGPipeline {
  async retrieve(query: RAGQuery): Promise<RAGResult> {
    const { context, options = {} } = query;
    const {
      layers = ['project', 'org', 'knowledge'],
      maxChunks = 10,
      minRelevance = 0.5
    } = options;
    
    const allChunks: RAGResult['chunks'] = [];
    
    // Layer 2: Project Memory
    if (layers.includes('project') && context.projectId) {
      const projectContext = await this.projectMemory.getProjectContext(
        context.projectId
      );
      allChunks.push(...this.formatProjectMemory(projectContext));
    }
    
    // Layer 3: Organization Memory
    if (layers.includes('org')) {
      const orgPatterns = await this.orgMemory.findSimilarPatterns(
        context.organizationId,
        query.query
      );
      allChunks.push(...this.formatOrgPatterns(orgPatterns));
    }
    
    // Layer 4: Knowledge Base
    if (layers.includes('knowledge')) {
      const knowledge = await this.knowledgeBase.search(query.query, {
        minScore: minRelevance,
        limit: 5
      });
      allChunks.push(...this.formatKnowledge(knowledge));
    }
    
    // Layer 5: External (if enabled)
    if (layers.includes('external') && this.policy.allowExternal) {
      const external = await this.externalSearch.search(query.query);
      allChunks.push(...this.formatExternal(external));
    }
    
    // Sort by relevance and limit
    const sorted = allChunks
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxChunks);
    
    return {
      chunks: sorted,
      totalTokens: this.countTokens(sorted)
    };
  }
  
  formatForPrompt(ragResult: RAGResult): string {
    if (ragResult.chunks.length === 0) {
      return '';
    }
    
    const sections = ragResult.chunks.map(chunk => 
      `[Source: ${chunk.source}] (Relevance: ${Math.round(chunk.relevance * 100)}%)\n${chunk.content}`
    );
    
    return `
## Retrieved Context

${sections.join('\n\n---\n\n')}
`;
  }
}
```

### 5.2 Context Window Management

```typescript
class ContextWindowManager {
  private readonly MAX_CONTEXT_TOKENS = 100000; // For GPT-4o
  
  async buildContext(
    systemPrompt: string,
    messages: Message[],
    ragResult: RAGResult
  ): Promise<{
    messages: Message[];
    truncated: boolean;
  }> {
    const systemTokens = this.countTokens(systemPrompt);
    const ragTokens = ragResult.totalTokens;
    const messageTokens = this.countTokens(messages);
    
    const totalTokens = systemTokens + ragTokens + messageTokens;
    
    if (totalTokens <= this.MAX_CONTEXT_TOKENS) {
      return { messages, truncated: false };
    }
    
    // Truncation strategy: Keep system + RAG, compress messages
    const availableForMessages = this.MAX_CONTEXT_TOKENS - systemTokens - ragTokens;
    const compressedMessages = this.compressMessages(messages, availableForMessages);
    
    return {
      messages: compressedMessages,
      truncated: true
    };
  }
  
  private compressMessages(
    messages: Message[],
    maxTokens: number
  ): Message[] {
    // Keep first message (context) and last N messages
    const firstMessage = messages[0];
    const recentMessages = messages.slice(-10);
    
    let result = [firstMessage, ...recentMessages];
    
    while (this.countTokens(result) > maxTokens && result.length > 2) {
      // Remove oldest message (except first)
      result.splice(1, 1);
    }
    
    return result;
  }
}
```

---

## 6. Performance Optimizations

### 6.1 Embedding Caching

```typescript
class EmbeddingCache {
  private cache: Map<string, { embedding: number[]; expires: number }> = new Map();
  private redis: Redis;
  
  async getEmbedding(text: string): Promise<number[]> {
    const hash = this.hash(text);
    
    // L1: Memory cache
    const memCached = this.cache.get(hash);
    if (memCached && memCached.expires > Date.now()) {
      return memCached.embedding;
    }
    
    // L2: Redis cache
    const redisCached = await this.redis.get(`emb:${hash}`);
    if (redisCached) {
      const embedding = JSON.parse(redisCached);
      this.cache.set(hash, { embedding, expires: Date.now() + 3600000 });
      return embedding;
    }
    
    // Generate new embedding
    const embedding = await this.generateEmbedding(text);
    
    // Store in both caches
    this.cache.set(hash, { embedding, expires: Date.now() + 3600000 });
    await this.redis.setex(`emb:${hash}`, 86400, JSON.stringify(embedding));
    
    return embedding;
  }
}
```

### 6.2 Batch Processing

```typescript
async function batchEmbed(texts: string[], batchSize = 100): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeddings = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch
    });
    embeddings.push(...batchEmbeddings.data.map(e => e.embedding));
  }
  
  return embeddings;
}
```

---

## 7. Final Recommendation

### 7.1 Chosen Stack

```yaml
vector_database:
  primary: pgvector (PostgreSQL extension)
  migration_path: Qdrant (if >100K vectors needed)

embedding_model:
  primary: text-embedding-3-small
  dimensions: 1536
  fallback: Cohere embed-v3 (for Polish-heavy content)

chunking:
  strategy: Recursive with overlap
  chunk_size: 1000 characters
  overlap: 200 characters

memory_architecture:
  layer_1: Redis (session, 2h TTL)
  layer_2: PostgreSQL (project memory)
  layer_3: PostgreSQL (org memory with embeddings)
  layer_4: PostgreSQL + pgvector (knowledge base)
  layer_5: Tavily API (external search)

caching:
  embeddings: Redis (24h TTL)
  rag_results: Redis (1h TTL)
```

### 7.2 Database Migrations

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge base table
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL,
    source VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create HNSW index for fast similarity search
CREATE INDEX idx_knowledge_embedding ON knowledge_base 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Organization memory with embeddings
ALTER TABLE organization_memory 
ADD COLUMN embedding vector(1536);

CREATE INDEX idx_org_memory_embedding ON organization_memory
USING hnsw (embedding vector_cosine_ops);
```

---

*Document Version: 1.0*
*Last Updated: December 2024*
*Author: AI Research Team*



