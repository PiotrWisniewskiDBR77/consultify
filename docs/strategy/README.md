# Strategy Documentation Index

This directory contains the strategy package for the future Consultify Airtable-like platform.

The documents in this folder are intended to support pre-implementation analysis. They define:

- why the current `graph-first table` model is insufficient
- what target architecture should replace it
- which epics must be delivered
- how migration should happen
- how the work must remain isolated from ongoing delivery in other modules
- what decisions and risks must be explicitly reviewed before execution starts
- how Consultify should become the central hub for data collection and analysis
- how artifact distribution automation should be separated from source modules
- how migration communication should reduce adoption risk for Airtable and Power BI users

## Core documents

- [TABLE_PLATFORM_IMPLEMENTATION_PLAN_V7.md](TABLE_PLATFORM_IMPLEMENTATION_PLAN_V7.md)  
  Latest execution reference plan (`V7`) for building Airtable-class operational capabilities inside Consultify as a company operating and decision system.

- [CONSULTIFY_AIRTABLE_90_DAY_PLAN.md](CONSULTIFY_AIRTABLE_90_DAY_PLAN.md)  
  Main 90-day program plan and MVP framing.

- [CONSULTIFY_TABLE_PLATFORM_EPICS.md](CONSULTIFY_TABLE_PLATFORM_EPICS.md)  
  Full epic breakdown for the table platform program.

- [CONSULTIFY_TABLE_PLATFORM_ARCHITECTURE.md](CONSULTIFY_TABLE_PLATFORM_ARCHITECTURE.md)  
  Target architecture, domain boundaries, and integration points with the current workspace.

- [CONSULTIFY_TABLE_PLATFORM_IMPLEMENTATION_REQUIREMENTS.md](CONSULTIFY_TABLE_PLATFORM_IMPLEMENTATION_REQUIREMENTS.md)  
  Required capabilities, service contracts, data model targets, and implementation constraints.

- [CONSULTIFY_TABLE_PLATFORM_MIGRATION_AND_ISOLATION.md](CONSULTIFY_TABLE_PLATFORM_MIGRATION_AND_ISOLATION.md)  
  Migration path from the current system and the operating model required to avoid impact on other modules.

- [CONSULTIFY_TABLE_PLATFORM_RISK_REGISTER.md](CONSULTIFY_TABLE_PLATFORM_RISK_REGISTER.md)  
  Decision register, assumptions, dependencies, and risk log.

- [CONSULTIFY_ARTIFACT_DISTRIBUTION_AUTOMATION_PLAN.md](CONSULTIFY_ARTIFACT_DISTRIBUTION_AUTOMATION_PLAN.md)  
  Shared strategy for outbound artifact delivery and communication automation across reports, decks, maps, notes, and tables.

- [CONSULTIFY_CENTRAL_DATA_MIGRATION_COMMUNICATION_PLAN.md](CONSULTIFY_CENTRAL_DATA_MIGRATION_COMMUNICATION_PLAN.md)  
  Communication and adoption strategy for moving Airtable and Power BI users toward Consultify as a central operating layer.

- [CONSULTIFY_DATA_COLLECTION_PLAN.md](CONSULTIFY_DATA_COLLECTION_PLAN.md)  
  Central ingestion and analysis plan for automatic data collection into landing tables and governed models.

## Workstream Specifications

Detailed implementation-level specifications live in the [workstreams/](workstreams/) subdirectory:

| ID | Document | Scope |
|----|----------|-------|
| WS-A | [Product Definition](workstreams/WS_A_PRODUCT_DEFINITION.md) | Vision, personas, use cases, MVP scope, positioning |
| WS-B | [Architecture & Boundaries](workstreams/WS_B_ARCHITECTURE_BOUNDARIES.md) | ADRs, domain model, API surface, services, migration stages |
| WS-C | [Table Platform Core](workstreams/WS_C_TABLE_PLATFORM_CORE_SPEC.md) | Field types, record storage, query engine, relations, audit |
| WS-D | [Chat-to-Schema](workstreams/WS_D_CHAT_TO_SCHEMA_SPEC.md) | AI pipeline, proposal contract, grounding, prompts, safety |
| WS-E | [Data Collection](workstreams/WS_E_DATA_COLLECTION_SPEC.md) | Connectors, mapping, refresh, provenance, governed models |
| WS-F | [Migration Communication](workstreams/WS_F_MIGRATION_COMMUNICATION.md) | Playbooks, stakeholder comms, pilot program, training |
| WS-G | [Distribution Separation](workstreams/WS_G_DISTRIBUTION_SEPARATION.md) | Artifact contract, event catalog, policy engine, channels |

See [workstreams/README.md](workstreams/README.md) for the full index and reading order.

## Recommended reading order

1. [CONSULTIFY_AIRTABLE_90_DAY_PLAN.md](CONSULTIFY_AIRTABLE_90_DAY_PLAN.md)
2. [CONSULTIFY_TABLE_PLATFORM_ARCHITECTURE.md](CONSULTIFY_TABLE_PLATFORM_ARCHITECTURE.md)
3. [CONSULTIFY_TABLE_PLATFORM_EPICS.md](CONSULTIFY_TABLE_PLATFORM_EPICS.md)
4. [CONSULTIFY_TABLE_PLATFORM_IMPLEMENTATION_REQUIREMENTS.md](CONSULTIFY_TABLE_PLATFORM_IMPLEMENTATION_REQUIREMENTS.md)
5. [CONSULTIFY_TABLE_PLATFORM_MIGRATION_AND_ISOLATION.md](CONSULTIFY_TABLE_PLATFORM_MIGRATION_AND_ISOLATION.md)
6. [CONSULTIFY_TABLE_PLATFORM_RISK_REGISTER.md](CONSULTIFY_TABLE_PLATFORM_RISK_REGISTER.md)

## Master Execution Report

- [MASTER_EXECUTION_REPORT.md](MASTER_EXECUTION_REPORT.md)  
  Consolidated delivery report with phase plan, critical path, risk summary, go/no-go criteria, and team requirements.

## Pre-Flight Sign-Off & GO/NO-GO

- [PRE_FLIGHT_SIGN_OFF.md](PRE_FLIGHT_SIGN_OFF.md)  
  **Status: GO** — Formal approval package with recommended answers to blocking questions, ADR ratification, MVP scope sign-off, and conditions for Sprint 0 start. All blocking questions resolved with explicit recommendations. Ready for implementation kickoff.

## Intended next step

Sprint 0 kickoff: architecture lock, confirm ADR approval, assign team, set up feature flags. No further approvals required if PRE_FLIGHT_SIGN_OFF conditions are accepted.

## Current execution reference

For current execution planning and program sequencing, use:

- [TABLE_PLATFORM_IMPLEMENTATION_PLAN_V7.md](TABLE_PLATFORM_IMPLEMENTATION_PLAN_V7.md)
