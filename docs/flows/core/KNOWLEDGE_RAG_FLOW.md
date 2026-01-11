# FLOW-KNOWLEDGE-001: Knowledge Base & RAG

> **ID:** FLOW-KNOWLEDGE-001 | **Status:** ✅ Complete | **Priority:** P1

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

System bazy wiedzy z RAG (Retrieval Augmented Generation) dla AI. Dokumenty, artykuły, best practices dostępne dla AI podczas odpowiadania.

## Knowledge Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     KNOWLEDGE RAG ARCHITECTURE                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  KNOWLEDGE SOURCES                                              ││
│  │  ├── System Knowledge (Consultinity docs, best practices)       ││
│  │  ├── Organization Knowledge (uploaded docs, internal wiki)      ││
│  │  ├── Project Knowledge (project docs, reports, decisions)       ││
│  │  └── Tool Knowledge (SIRI, ADMA, Lean methodology)              ││
│  └─────────────────────────────────────────────────────────────────┘│
│                           │                                          │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  PROCESSING PIPELINE                                            ││
│  │  1. Document Ingestion → Parse (PDF, DOCX, MD)                  ││
│  │  2. Chunking → Split into semantic chunks                       ││
│  │  3. Embedding → Vector representation                           ││
│  │  4. Indexing → Store in vector database                         ││
│  └─────────────────────────────────────────────────────────────────┘│
│                           │                                          │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  RETRIEVAL                                                      ││
│  │  1. Query → User question or context                            ││
│  │  2. Embed Query → Vector representation                         ││
│  │  3. Search → Find similar chunks                                ││
│  │  4. Rank → Re-rank by relevance                                 ││
│  │  5. Return → Top K chunks with metadata                         ││
│  └─────────────────────────────────────────────────────────────────┘│
│                           │                                          │
│                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  AI GENERATION                                                  ││
│  │  Context = System prompt + Retrieved chunks + User query        ││
│  │  Response = LLM generates with grounded knowledge               ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Knowledge Types

| Type             | Scope       | Examples                                              |
| ---------------- | ----------- | ----------------------------------------------------- |
| **System**       | Global      | Consultinity docs, PMO standards, methodology guides  |
| **Organization** | Per org     | Company policies, internal processes, historical data |
| **Project**      | Per project | Project charter, reports, meeting notes               |
| **Tool**         | Per tool    | SIRI methodology, ADMA framework, Lean principles     |
| **User**         | Per user    | Personal notes, saved responses                       |

## Document Processing

```
┌─────────────────────────────────────────────────────────────────────┐
│  Document Processing Pipeline                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Upload                     Process                   Store         │
│  ───────                    ───────                   ─────         │
│  PDF  ────┐                                                         │
│  DOCX ────┼──→ Parse ──→ Extract ──→ Chunk ──→ Embed ──→ Index    │
│  MD   ────┤      │          │          │         │         │        │
│  TXT  ────┘      ▼          ▼          ▼         ▼         ▼        │
│             Raw Text    Metadata    Chunks   Vectors   Vector DB    │
│                         (title,     (500-    (1536d)   (pgvector/   │
│                          date,      1000     OpenAI)   sqlite-vec)  │
│                          author)    tokens)                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## RAG Query Flow

```
User: "What are the key principles of Lean 4.0 assessment?"
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1. EMBED QUERY                                                     │
│     "What are the key principles..." → [0.12, -0.34, 0.56, ...]    │
└─────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. VECTOR SEARCH                                                   │
│     Find top 10 most similar chunks from knowledge base             │
│     Filter by: organization_id, scope, permissions                  │
└─────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. RE-RANK                                                         │
│     Score chunks by:                                                │
│     - Semantic similarity                                           │
│     - Recency                                                       │
│     - Source authority                                              │
│     Return top 5                                                    │
└─────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. GENERATE RESPONSE                                               │
│     Prompt = System instructions + Retrieved context + User query   │
│     LLM generates response grounded in knowledge                    │
│     Include source citations                                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema

```sql
-- Knowledge documents
CREATE TABLE IF NOT EXISTS knowledge_documents (
    id TEXT PRIMARY KEY,
    organization_id TEXT, -- NULL for system docs
    project_id TEXT,

    -- Document info
    title TEXT NOT NULL,
    description TEXT,
    document_type TEXT NOT NULL, -- 'pdf', 'docx', 'md', 'txt', 'html', 'url'
    source_type TEXT DEFAULT 'upload', -- 'upload', 'url', 'integration', 'generated'

    -- Source
    original_filename TEXT,
    source_url TEXT,

    -- Storage
    storage_path TEXT,
    file_size INTEGER,

    -- Metadata
    author TEXT,
    language TEXT DEFAULT 'en',
    tags TEXT DEFAULT '[]', -- JSON array
    category TEXT,

    -- Processing
    processing_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    processed_at TIMESTAMP,
    chunk_count INTEGER DEFAULT 0,

    -- Scope
    scope TEXT DEFAULT 'organization', -- 'system', 'organization', 'project', 'user'
    visibility TEXT DEFAULT 'private', -- 'public', 'private', 'shared'

    -- Versioning
    version INTEGER DEFAULT 1,
    parent_id TEXT, -- Previous version

    is_active INTEGER DEFAULT 1,
    created_by TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document chunks (for RAG)
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    organization_id TEXT,

    -- Chunk info
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER,

    -- Embedding
    embedding BLOB, -- Vector (serialized)
    embedding_model TEXT DEFAULT 'text-embedding-3-small',

    -- Metadata
    metadata TEXT DEFAULT '{}', -- JSON: section, page, etc.

    -- Search optimization
    content_hash TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
);

-- Knowledge queries log
CREATE TABLE IF NOT EXISTS knowledge_queries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT,

    -- Query
    query_text TEXT NOT NULL,
    query_embedding BLOB,

    -- Results
    chunks_retrieved INTEGER,
    chunks_used INTEGER,
    top_chunk_ids TEXT, -- JSON array

    -- Context
    source_context TEXT, -- 'chat', 'report', 'assessment', 'tool'

    -- Feedback
    was_helpful INTEGER, -- User feedback

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_org ON knowledge_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_project ON knowledge_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_docs_scope ON knowledge_documents(scope);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_org ON knowledge_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_queries_user ON knowledge_queries(user_id);
```

## API Endpoints

| Method | Endpoint                                 | Description     |
| ------ | ---------------------------------------- | --------------- |
| GET    | `/api/knowledge/documents`               | List documents  |
| POST   | `/api/knowledge/documents`               | Upload document |
| GET    | `/api/knowledge/documents/:id`           | Get document    |
| DELETE | `/api/knowledge/documents/:id`           | Delete document |
| POST   | `/api/knowledge/documents/:id/reprocess` | Reprocess       |
| POST   | `/api/knowledge/search`                  | RAG search      |
| GET    | `/api/knowledge/stats`                   | Knowledge stats |

## Integration with AI

```typescript
// AI chat with RAG
async function chatWithRAG(message: string, context: ChatContext) {
  // 1. Search knowledge base
  const relevantChunks = await knowledgeService.search({
    query: message,
    organizationId: context.orgId,
    projectId: context.projectId,
    limit: 5,
  });

  // 2. Build prompt with context
  const prompt = buildPromptWithKnowledge(message, relevantChunks);

  // 3. Generate response
  const response = await llm.generate(prompt);

  // 4. Add citations
  return {
    response: response.text,
    sources: relevantChunks.map((c) => ({
      title: c.document.title,
      excerpt: c.content.slice(0, 200),
    })),
  };
}
```

## Related Flows

- FLOW-AI-CHAT-001: AI uses knowledge for responses
- FLOW-HELP-001: Help articles in knowledge base
- FLOW-ASSESSMENT-001: Methodology knowledge
