---
module_id: MODULE_ORGANIZATION
doc_kind: SCOPE
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Scope — Organizacja (Organization Context)

## Purpose

Ustalić granice odpowiedzialności Organization Context Engine oraz relacje z modułami (Chat/Interview/Outputs).

## In scope (Must)

- MUST: przyjmowanie assetów (org/project/user), processing jobs, normalizacja, chunking, indexing.
- MUST: retrieval z filtrami ACL/tenant/project/user/workflow przed promptem.
- MUST: lineage ledger dla użycia kontekstu w AI outputach.
- MUST: quota + cost visibility + retention policy.

## Out of scope (Must Not)

- MUST NOT: “frontend-only uploads” jako źródło prawdy (backend ingestion jest wymagany).
- MUST NOT: przemycać raw content do logów/system prompts bez governance.

## Should

- SHOULD: wspierać multimodalność (image OCR / audio transcription) tylko przy jawnych policy+cost controls.

## Acceptance Criteria

- [ ] Zakres jest spójny z staged rollout i gate’ami z implementation planu.

## Related Sources

- `DRD/consultify/docs/modules/MODULE_ROUTING_ARCHITECTURE.md`
- `DRD/consultify/docs/product/ORGANIZATION_CONTEXT_ENGINE_IMPLEMENTATION_PLAN.md`

