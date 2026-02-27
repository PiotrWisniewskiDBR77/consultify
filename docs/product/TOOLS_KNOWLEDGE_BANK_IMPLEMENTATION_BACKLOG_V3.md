# Tools Knowledge Bank — Implementation Backlog v3 (SSOT)

Owner: PO/CTO  
Status: draft backlog (ready to turn into tasks)  
Scope: production-grade Tool Knowledge Bank (packs → DB → retrieval → governance)

SSOT references:

- `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`
- `docs/product/TOOLS_SSOT_SOURCES_V3.md`
- Evidence discipline: `docs/product/modules/ai/AI_DEEP_RESEARCH_EVIDENCE_SYSTEM_V3.md`
- DoD gates: `docs/product/GATE_DEFINITION_OF_DONE.md`

---

## EPIC TKB-0 — Production Knowledge Base contract (DB + ops)

### Task TKB-001 — Align runtime RAG schema (Postgres-safe)

**Why**: production DB must support tool-pack metadata + filtering + observability.  
**SSOT**: `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md` §8.

**Acceptance criteria**

- `knowledge_docs` in Postgres includes: `source_type`, `metadata`, `chunk_count`, `indexed_at`, `updated_at`, `category`, `tags`, `version`, `parent_doc_id` (nullable).
- `knowledge_chunks` includes: `metadata`, `created_at`.
- Backwards compatibility: existing deployments do not break when columns already exist.

---

### Task TKB-002 — Tool pack indexing endpoint (ops)

**Why**: we need a controlled way to (re)index packs in production.  
**SSOT**: `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md` §8.

**Acceptance criteria**

- Endpoint exists: `POST /api/ai-operations/knowledge/tool-packs/index`
- Auth: `super_admin` or `admin`
- Body: `forceReindex?: boolean`
- Response includes counts: indexed/skipped/failed (per file)

---

### Task TKB-003 — Automated indexing job (cron)

**Why**: keep DB in sync with repo packs after releases; reduce manual ops.  
**SSOT**: `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md` (operational runbook).

**Acceptance criteria**

- A scheduled job exists (e.g. daily or on startup in non-prod) that can run `indexToolKnowledgePacks`.
- The job is safe-by-default:
  - default `forceReindex=false`
  - can be enabled via env flag(s) for prod
- Job writes a clear audit log entry (success/failure summary).

---

## EPIC TKB-1 — Tool-scoped retrieval (AI “consultant expert”)

### Task TKB-101 — Tool-scoped RAG filtering by metadata

**Why**: SIRI answers must not be “contaminated” by DRD content.  
**SSOT**: `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md` §2.3 + §4.5.

**Acceptance criteria**

- RAG tool supports params: `toolSlug`, `packType`, `language`
- When provided, retrieval uses only `knowledge_docs` rows with `source_type='tool_pack'` and matching `metadata`.
- When not provided, behavior remains backward compatible (global search).

---

### Task TKB-102 — UI/Agent integration: pass tool context automatically

**Why**: users should not have to type “search siri only”.  
**SSOT**: `docs/product/TOOLS_SSOT_SOURCES_V3.md` §7.

**Acceptance criteria**

- When the user is inside an assessment (DRD/SIRI/ADMA), AI calls pass `toolSlug=<current tool>`.
- Language is passed from user locale (PL/EN).

---

## EPIC TKB-2 — Knowledge Pack authoring scale-up

### Task TKB-201 — PL versions for initial packs (bridge)

**Why**: PL+EN is required for production UX.  
**SSOT**: UI i18n MUST in `docs/product/V3_IMPLEMENTATION_PROGRAM.md`.

**Acceptance criteria**

- Add PL variants:
  - `knowledge/tool-kb/siri/qbank/v1/siri-qbank.pl.md`
  - `knowledge/tool-kb/adma/qbank/v1/adma-qbank.pl.md`
  - `knowledge/tool-kb/drd/qbank/v1/drd-qbank.pl.md`

---

### Task TKB-202 — Expand pack types: initiatives patterns

**Why**: roadmap generation needs a reusable “gap → initiative” library.  
**SSOT**: `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md` §4.2.

**Acceptance criteria**

- Create `initiatives` packs for at least DRD and SIRI (v1), with:
  - gap signals
  - initiative patterns
  - KPIs to track
  - dependencies

