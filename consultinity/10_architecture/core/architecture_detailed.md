# Architecture Detailed Blueprints (C4 Level 3)

**Last Updated:** 1 January 2026  
**Standard:** C4 Model Tier 3 (Component Level)

This document provides the low-level architectural blueprints for the core engines of Consultinity. These specifications are designed to allow a professional engineering team to rebuild the core services with byte-perfect logic parity.

---

## 1. AI Pipeline Orchestration (`AIPipeline.js`)

The `AIPipeline` is the central nervous system for AI operations, managing a resilient, multi-provider execution flow.

### C4 Level 3: Component Diagram
```mermaid
graph TD
    User["User Interface / hook:useAIStream"] --> API["server/routes/ai.js"]
    API --> Pipeline["AIPipeline.js (Controller)"]

    subgraph "Resilience Layer"
        Pipeline --> Sec["EnterpriseSecurity (Rate Limits / Audit)"]
        Pipeline --> Quota["QuotaService (Token/Budget Control)"]
    end

    subgraph "Context Layer"
        Pipeline --> Context["EnhancedContextBuilder (DB/Screen/User)"]
        Pipeline --> Memory["MemoryManager (5-Layer: Session to Knowledge)"]
        Pipeline --> RAG["RagService (Vector Search)"]
    end

    subgraph "Execution Layer"
        Pipeline --> Router["ModelRouter (Tier-Based Selection)"]
        Pipeline --> LLM["LLMService (12 Providers / Multi-Fallback)"]
        Pipeline --> Gateway["AIGateway (Safety/PII Scrubbing)"]
    end

    subgraph "Quality & Learning"
        Pipeline --> Quality["QualityChecker (Hallucination Detection)"]
        Pipeline --> Learning["LearningSystem (Pattern Extraction)"]
    end

    LLM --> Providers["OpenAI / Anthropic / Groq / etc."]
```

### Sequence Diagram: AI Streaming Flow
```mermaid
sequenceDiagram
    participant U as User (Frontend)
    participant R as AI Router (Express)
    participant P as AIPipeline
    participant S as Security/Quota
    participant C as Context/Memory
    participant L as LLM Service (Streaming)

    U->>R: POST /api/ai/chat/stream
    R->>P: process(request)
    P->>S: checkRateLimit() & checkQuota()
    S-->>P: Allowed
    P->>C: buildEnhancedContext()
    C-->>P: Full Context Map
    P->>L: executeWithFallback(stream: true)
    loop Stream Chunks
        L-->>P: Chunk (thought/text)
        P-->>R: SSE: data: {type: 'thought', ...}
        P-->>R: SSE: data: {text: '...'}
        R-->>U: SSE Event
    end
    P->>P: safeLogAudit() & safeRecordLearning()
```

---

## 2. Initiative Governance (`StatusMachine.js`)

The `StatusMachine` enforces the PMO-standard lifecycle. Transitions across module boundaries trigger specific system behaviors.

### Status Transition Matrix (C4 Level 3)
```mermaid
stateDiagram-v2
    [*] --> DRAFT: Assessment Created

    state "Module 2: Assessment" as M2 {
        DRAFT
    }

    state "Module 3: Initiative Management" as M3 {
        PLANNING
        REVIEW
        APPROVED
    }

    state "Module 4/5: Execution" as M4 {
        EXECUTING
        BLOCKED
        DONE
    }

    DRAFT --> PLANNING: [Module Transfer]
    PLANNING --> REVIEW: Submit for Approval
    REVIEW --> APPROVED: Governance Pass
    REVIEW --> PLANNING: Revision Required
    APPROVED --> EXECUTING: [Module Transfer]
    EXECUTING --> BLOCKED: Issue Detected
    BLOCKED --> EXECUTING: Issue Resolved
    EXECUTING --> DONE: All Tasks Completed
    
    DONE --> ARCHIVED
    DRAFT --> CANCELLED
    PLANNING --> CANCELLED
    EXECUTING --> CANCELLED
```

---

## 3. Data Flow Standards
- **Immutability**: Once an initiative reaches `DONE` or `ARCHIVED`, its financial and timeline baseline is locked.
- **Audit Trails**: Every state change in the `StatusMachine` must be recorded in the `pmo_audit_log` with the `changedBy` and `rationale` fields.
- **Fail-Open Policy**: The AI Pipeline security components (Quota/Security) are designed to "Fail-Open" in case of non-critical infrastructure errors to ensure high availability for end-users, while logging "Critical Warnings" to `AIAuditLogger`.
