# AI Governance — Canonical API Map (V2)

> **Document:** AI_GOVERNANCE_API_MAP.md  
> **Created:** 2026-02-23  
> **Status:** DRAFT (implementation in progress)

This file defines **canonical** API routes for AI governance (T116–T122) and lists **legacy aliases** kept for backwards compatibility (no breaking changes).

## Principles
- **Canonical first**: new code must call canonical routes.
- **Legacy aliases**: kept for at least one release; should emit a deprecation log/metric.
- **No duplicate capability routers** mounted on the same base path (route hygiene per T122).

## Canonical routes (SSOT)

### Prompt SSOT (T116)
- **Canonical**: `GET|POST|PUT /api/ai-prompts/*`  
  - Router: `server/src/routes/ai-prompts.routes.ts`  
  - Storage: `ai_system_prompts` + `ai_prompt_versions` (+ prompt blocks + instruction suggestions)

### LLM providers & routing (control plane)
- **Canonical**: `GET|POST|PUT|DELETE /api/llm/*`  
  - Router: `server/src/routes/llm.routes.ts`

### AI Chat runtime (T118–T121 hot path)
- **Canonical**: `POST /api/ai/chat/stream` (SSE)  
  - Router: `server/src/routes/ai.routes.ts`

### Conversations persistence (chat history)
- **Canonical**: `GET|POST|PATCH|DELETE /api/conversations/*`  
  - Router: `server/src/routes/conversations.routes.ts`

## Legacy aliases (supported, but deprecated)

### Prompt systems (multiple historic implementations)
- **Alias**: `/api/ai/prompts` → **SSOT** `/api/ai-prompts`  
  - Should be wired to `server/src/routes/ai-prompts.routes.ts` (not legacy controllers).
- **Legacy**: `/api/ai/ai-prompts/*` (old controller-based prompt CRUD)  
  - Router: `server/src/routes/ai/ai-prompts.routes.ts`  
  - Intended: keep only as legacy/admin migration surface.
- **Legacy**: `/api/prompt-assistant/*` (prompt test bench / blocks preview)  
  - Router: `server/src/routes/prompt-assistant.routes.ts`  
  - Note: should use the same runtime assembler as SSOT prompts.

## Notes for implementers (where drift currently happens)
- The API gateway mounts both `server/src/routes/ai.routes.ts` and aggregated `server/src/routes/ai/index.ts` under `/api/ai`.  
  This is allowed **only** if subpaths do not collide (T122). Prompt routes must not be shadowed by legacy routers.

