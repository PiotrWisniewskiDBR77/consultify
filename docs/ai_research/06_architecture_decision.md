# Faza 6: Architecture Decision Records

## Executive Summary

Ten dokument zawiera Architecture Decision Records (ADRs) - formalne zapisy kluczowych decyzji architektonicznych podjętych podczas analizy technologicznej AI dla Consultify. Każda decyzja zawiera kontekst, rozważane opcje, wybraną opcję i konsekwencje.

---

## ADR-001: LLM Orchestration Framework

### Status
**Accepted** (December 2024)

### Context
Potrzebujemy frameworka do orkiestracji wywołań LLM, zarządzania promptami, structured outputs i streaming. Consultify jest aplikacją TypeScript/Node.js.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **LangChain.js** | Feature-rich, popular | Overengineered, poor TS types, unstable API |
| **LlamaIndex** | Best RAG | Python-first, limited TS |
| **Vercel AI SDK** | TypeScript-native, streaming, Zod | No built-in RAG/memory |
| **Custom** | Full control | More development time |

### Decision
**Vercel AI SDK + Custom orchestration layer**

### Rationale
1. Vercel AI SDK provides excellent TypeScript support and streaming
2. Missing features (RAG, memory, prompts) are Consultify-specific anyway
3. Avoid LangChain complexity and debugging difficulties
4. Keep full control over the pipeline

### Consequences
- (+) Perfect TypeScript integration
- (+) Lightweight, no unnecessary abstractions
- (+) Full control over every step
- (-) Need to build RAG and memory ourselves
- (-) No community examples for complex patterns

---

## ADR-002: Primary LLM Provider Strategy

### Status
**Accepted** (December 2024)

### Context
Musimy wybrać strategię wyboru modeli LLM dla różnych zadań. Balansujemy jakość, koszt i niezawodność.

### Options Considered

| Option | Description | Cost/Quality |
|--------|-------------|--------------|
| **OpenAI only** | GPT-4o for all | High cost, good quality |
| **Claude only** | Claude 3.5 for all | Good quality, medium cost |
| **Multi-tier** | Different models per task | Optimized cost/quality |
| **Self-hosted** | Llama/Mistral locally | Low cost, lower quality |

### Decision
**Multi-tier model routing**

```yaml
BUDGET: gpt-4o-mini (default chat)
STANDARD: claude-3.5-sonnet (analysis, generation)
PREMIUM: gpt-4o (complex generation)
REASONING: o1-mini (MAX Mode)
```

### Rationale
1. Chat is 70% of volume - use cheapest acceptable model
2. Claude 3.5 Sonnet has prompt caching - huge savings for reports
3. Keep GPT-4o for premium features
4. Reserve o1 for MAX Mode (deep analysis)

### Consequences
- (+) 50-70% cost reduction vs single premium model
- (+) Right quality for each use case
- (+) Automatic downgrade on budget limits
- (-) More complex model management
- (-) Need to test with multiple providers

---

## ADR-003: Vector Database for RAG

### Status
**Accepted** (December 2024)

### Context
Potrzebujemy vector database dla knowledge base i semantic search. Mamy już PostgreSQL jako główną bazę danych.

### Options Considered

| Option | Type | Pros | Cons |
|--------|------|------|------|
| **pgvector** | Extension | No new infra, SQL joins | Slower at scale |
| **Pinecone** | Managed | Fastest, easiest | Vendor lock-in, cost |
| **Qdrant** | Open-source | Fast, good features | New infrastructure |
| **Chroma** | Open-source | Simple | Less mature |

### Decision
**pgvector (PostgreSQL extension)**

### Rationale
1. No additional infrastructure to manage
2. ACID transactions with business data
3. SQL joins for filtering
4. Sufficient performance for expected scale (<100K vectors)
5. Easy migration path to Qdrant if needed later

### Consequences
- (+) Zero new infrastructure
- (+) Backup/restore with existing PostgreSQL
- (+) Join with business data
- (-) Rebuild HNSW index on updates
- (-) May need to migrate at >100K vectors

---

## ADR-004: Memory Architecture

### Status
**Accepted** (December 2024)

### Context
AI potrzebuje kontekstu z różnych źródeł: bieżącej rozmowy, projektu, organizacji i bazy wiedzy.

### Options Considered

| Option | Description |
|--------|-------------|
| **Flat** | Single context string |
| **2-Layer** | Session + Knowledge |
| **5-Layer** | Session/Project/Org/Knowledge/External |

### Decision
**5-Layer Memory Architecture**

```
Layer 1: Session (Redis, 2h TTL)
Layer 2: Project (PostgreSQL)
Layer 3: Organization (PostgreSQL + pgvector)
Layer 4: Knowledge Base (PostgreSQL + pgvector)
Layer 5: External (API, request-only)
```

### Rationale
1. Different TTLs and access patterns per layer
2. Organization patterns enable cross-project learning
3. Clear separation of concerns
4. Selective retrieval based on query type

### Consequences
- (+) Rich, contextual AI responses
- (+) Cross-project learning
- (+) Efficient storage per layer
- (-) Complex retrieval logic
- (-) Token management for context window

---

## ADR-005: Agent Architecture Pattern

### Status
**Accepted** (December 2024)

### Context
Decyzja między single agent, multi-agent, lub hybrid approach dla AI consultant.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **Single zero-shot** | Simple | No reasoning |
| **Single with tools** | Flexible | Can be unpredictable |
| **Multi-agent (CrewAI)** | Specialized roles | Complex, Python only |
| **Hybrid** | Best of both | Implementation effort |

### Decision
**Hybrid: Single agent with role switching + Multi-agent pipeline for reports**

```
Chat/Advice: Single agent with dynamic role (ADVISOR/ANALYST/COACH)
Reports: Sequential pipeline (ANALYST → STRATEGIST → VALIDATOR → REPORTER)
```

### Rationale
1. Single agent sufficient for 90% of interactions
2. Role switching avoids complexity of multi-agent
3. Pipeline pattern needed for quality reports
4. Human-in-the-loop for all mutations

### Consequences
- (+) Simple for most cases
- (+) Deterministic report generation
- (+) Full control over agent behavior
- (-) Need custom state machine
- (-) No autonomous agent capabilities

---

## ADR-006: Security Strategy

### Status
**Accepted** (December 2024)

### Context
Enterprise security requirements: PII protection, injection prevention, audit trail, multi-tenant isolation.

### Decision
**5-Layer Security Stack**

```
Layer 1: Input (injection guard, sanitization)
Layer 2: PII (detection, scrubbing)
Layer 3: Access (rate limiting, tenant isolation)
Layer 4: Output (hallucination check, content filter)
Layer 5: Audit (full logging, alerting)
```

### Rationale
1. Defense in depth
2. Each layer addresses specific threat
3. Audit trail for compliance
4. Alerting for security events

### Consequences
- (+) Comprehensive protection
- (+) GDPR compliance
- (+) Full traceability
- (-) Added latency (minimal)
- (-) Storage for audit logs

---

## ADR-007: Cost Control Strategy

### Status
**Accepted** (December 2024)

### Context
AI costs can spiral without controls. Need predictable costs with automatic mitigation.

### Decision
**3-Level Budget System with Auto-Downgrade**

```yaml
budgets:
  global:
    monthly_limit: $1000
    hard_limit: $1500
    
  organization:
    default_limit: $100
    auto_downgrade: true
    
  project:
    inherit_from: organization
    
actions:
  at_70%: Log warning
  at_80%: Downgrade STANDARD → BUDGET
  at_90%: Downgrade PREMIUM → STANDARD
  at_100%: Freeze (if enabled) or continue BUDGET only
```

### Rationale
1. Predictable costs for billing
2. Graceful degradation vs hard cutoff
3. Alerts before problems
4. Org/project granularity

### Consequences
- (+) Predictable costs
- (+) No surprise bills
- (+) Continued service even at limit
- (-) Quality degradation at high usage

---

## ADR-008: Observability Stack

### Status
**Accepted** (December 2024)

### Context
Need visibility into AI pipeline: traces, costs, quality metrics.

### Options Considered

| Option | Type | Cost |
|--------|------|------|
| LangSmith | Proprietary | $$$ |
| Helicone | Hosted | $$ |
| Langfuse | Open-source | Free/$ |
| Custom | Self-built | Dev time |

### Decision
**Langfuse (open-source) + Custom audit logging**

### Rationale
1. Langfuse is free/low-cost
2. Good TypeScript SDK
3. Self-hostable for data control
4. Custom audit for business-specific needs

### Consequences
- (+) Full tracing without high costs
- (+) Can self-host
- (+) Integration with existing logging
- (-) Need to maintain two systems

---

## ADR-009: Prompt Management

### Status
**Accepted** (December 2024)

### Context
Need versioned, testable prompts that can be updated without code deploys.

### Decision
**Database-backed prompt management with 4-layer stacking**

```sql
ai_prompts table:
- key: unique identifier
- type: GLOBAL | ROLE | PHASE | CAPABILITY
- template: prompt text with {{variables}}
- version: for tracking changes
- is_active: for A/B testing
```

```
Prompt Stack:
1. GLOBAL_SYSTEM (always)
2. ROLE_{userRole} (user-specific)
3. PHASE_{projectPhase} (context-specific)
4. CAPABILITY_{capability} (task-specific)
```

### Rationale
1. Update prompts without deploys
2. Version history for rollback
3. A/B testing capability
4. Role-based customization

### Consequences
- (+) Easy prompt iteration
- (+) A/B testing support
- (+) Audit trail for prompts
- (-) Database dependency
- (-) Cache invalidation complexity

---

## ADR-010: Human-in-the-Loop Pattern

### Status
**Accepted** (December 2024)

### Context
AI should assist, not automate. All mutations need human approval.

### Decision
**Draft-Review-Approve Pattern**

```
AI generates → User reviews/edits → User approves → System saves

Risk levels:
- HIGH (create initiative, modify roadmap): APPROVAL_REQUIRED
- MEDIUM (generate report): REVIEW_SUGGESTED  
- LOW (chat, analysis): AUTO_APPROVED
```

### Rationale
1. AI as copilot, not autopilot
2. User maintains control
3. Feedback loop for AI improvement
4. Audit trail of approvals

### Consequences
- (+) User trust
- (+) Quality control
- (+) Learning from rejections
- (-) Slower workflows
- (-) UX for draft management

---

## ADR-011: Unified AI Gateway

### Status
**Accepted** (December 2024)

### Context
Musimy obsługiwać wielu dostawców LLM (Cloud, Chinese, Local) w sposób ujednolicony, zarządzając kluczami, limitami i kosztami w jednym miejscu.

### Decision
**Implementacja Unified AI Gateway (styl LiteLLM)**

### Rationale
1. Ujednolicenie formatu zapytań do standardu OpenAI API.
2. Centralne zarządzanie modelami chińskimi (DeepSeek) i lokalnymi (Ollama).
3. Łatwa podmiana dostawcy (np. zmiana OpenAI na lokalny model dla danych wrażliwych) bez zmian w logice biznesowej.

### Consequences
- (+) Pełna kontrola nad routingiem modeli.
- (+) Łatwe dodawanie nowych providerów.
- (+) Centralny monitoring kosztów.
- (-) Dodatkowa warstwa proxy (minimalne opóźnienie).

---

## ADR-012: Model Context Protocol (MCP) for Tools

### Status
**Accepted** (December 2024)

### Context
AI potrzebuje "rąk" do interakcji z platformą (pobieranie danych, liczenie ROI, dostęp do bazy wiedzy).

### Decision
**Centralny serwer narzędzi oparty na standardzie MCP**

### Rationale
1. MCP to otwarty standard wspierany przez liderów rynku (np. Anthropic).
2. Pozwala na dynamiczne wykrywanie narzędzi przez AI.
3. Separacja logiki narzędzi od logiki orkiestracji modeli.

### Consequences
- (+) Agnostyczność wobec modeli (te same narzędzia dla każdego LLM).
- (+) Bezpieczny, audytowalny dostęp do danych przez "Capability Matrix".
- (+) Łatwa rozbudowa o nowe funkcjonalności platformy.

---

## ADR-013: Screen State Serialization for Visual Context

### Status
**Accepted** (December 2024)

### Context
Użytkownik w czacie zadaje pytania dotyczące tego, co widzi na ekranie. AI musi "wiedzieć" o bieżącym kontekście widoku.

### Decision
**JSON State Serialization zamiast Vision (screenshots)**

### Rationale
1. Przesyłanie JSON jest 100x tańsze i szybsze niż analiza obrazu.
2. Większa precyzja – AI dostaje dokładne wartości liczbowe i opisy pól, a nie ich reprezentację graficzną.
3. Łatwiejsza filtracja danych wrażliwych na poziomie kodu.

### Consequences
- (+) AI reaguje na konkretne dane na ekranie ("Visual Awareness").
- (+) Optymalne wykorzystanie context window.
- (-) Wymaga implementacji serializerów dla każdego kluczowego widoku platformy.

---

## Summary of Key Decisions

| Area | Decision | Confidence |
|------|----------|------------|
| Orchestration | Vercel AI SDK + Custom | High |
| LLM Strategy | Multi-tier routing | High |
| Vector DB | pgvector | Medium |
| Memory | 5-layer architecture | High |
| Agents | Hybrid (single + pipeline) | High |
| Security | 5-layer stack | High |
| Cost Control | Auto-downgrade budgets | High |
| Observability | Langfuse + custom | Medium |
| Prompts | DB-backed, 4-layer stack | High |
| Human-in-loop | Draft-Review-Approve | High |
| Gateway | Unified Hub (LiteLLM style) | High |
| Tools | Central MCP Server | High |
| Context | JSON State Serialization | High |

---

*Document Version: 1.0*
*Last Updated: December 2024*
*Author: AI Research Team*

