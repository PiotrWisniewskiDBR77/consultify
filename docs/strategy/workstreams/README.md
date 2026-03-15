# Workstream Specifications Index

This directory contains the detailed workstream specifications for the Consultify Table Platform program.

Each document is a self-contained, production-grade specification ready for implementation review.

## Documents

| ID | Document | Scope | Lines |
|----|----------|-------|-------|
| WS-A | [Product Definition](WS_A_PRODUCT_DEFINITION.md) | Vision, personas, use cases, MVP scope, principles, metrics, positioning | 669 |
| WS-B | [Architecture & Boundaries](WS_B_ARCHITECTURE_BOUNDARIES.md) | ADRs, domain model, API surface, services, adapters, migration stages | 1,042 |
| WS-C | [Table Platform Core](WS_C_TABLE_PLATFORM_CORE_SPEC.md) | Field types, record storage, query engine, relations, attachments, audit | 1,059 |
| WS-D | [Chat-to-Schema](WS_D_CHAT_TO_SCHEMA_SPEC.md) | AI pipeline, intent taxonomy, proposal contract, grounding, prompts, safety | 1,156 |
| WS-E | [Data Collection & Ingestion](WS_E_DATA_COLLECTION_SPEC.md) | Connectors, mapping, refresh, provenance, governed models, reconciliation | 1,057 |
| WS-F | [Migration Communication](WS_F_MIGRATION_COMMUNICATION.md) | Migration playbooks, stakeholder comms, pilot program, training, positioning | 849 |
| WS-G | [Distribution Separation](WS_G_DISTRIBUTION_SEPARATION.md) | Artifact contract, event catalog, policy engine, delivery, channels, audit | 1,163 |

**Total: 6,995 lines of specification**

## Reading Order

1. **WS-A** first — understand what we're building and why
2. **WS-B** second — understand how it's structured
3. **WS-C** third — understand the core technical model
4. **WS-D** fourth — understand the AI layer
5. **WS-E** fifth — understand data collection (Phase 2)
6. **WS-F** sixth — understand adoption strategy
7. **WS-G** seventh — understand distribution separation

## Relationship to Parent Strategy Documents

These workstream specs are the detailed implementation layer beneath the parent strategy documents in `docs/strategy/`:

- `CONSULTIFY_AIRTABLE_90_DAY_PLAN.md` → WS-A, WS-B, WS-C, WS-D
- `CONSULTIFY_TABLE_PLATFORM_ARCHITECTURE.md` → WS-B
- `CONSULTIFY_TABLE_PLATFORM_EPICS.md` → WS-A, WS-B, WS-C, WS-D
- `CONSULTIFY_TABLE_PLATFORM_IMPLEMENTATION_REQUIREMENTS.md` → WS-C
- `CONSULTIFY_TABLE_PLATFORM_MIGRATION_AND_ISOLATION.md` → WS-F
- `CONSULTIFY_TABLE_PLATFORM_RISK_REGISTER.md` → all workstreams
- `CONSULTIFY_DATA_COLLECTION_PLAN.md` → WS-E
- `CONSULTIFY_CENTRAL_DATA_MIGRATION_COMMUNICATION_PLAN.md` → WS-F
- `CONSULTIFY_ARTIFACT_DISTRIBUTION_AUTOMATION_PLAN.md` → WS-G

## Implementation Phases

### Phase 1: Core Platform (Day 1–90)
- WS-A, WS-B, WS-C, WS-D

### Phase 2: Data Ecosystem (Day 91–150)
- WS-E

### Phase 3: Adoption & Distribution (Day 91–180)
- WS-F, WS-G
