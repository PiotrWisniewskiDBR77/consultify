---
doc_id: APPLICATION_OPERATING_MODEL
doc_kind: OPERATING_MODEL
owner: user
status: draft
last_updated: 2026-05-09
---

# Application Operating Model

## Purpose

This document defines Consultify as one consulting work system, not a collection of separate modules.

Consultify exists to help expert teams move from conversation and source material to diagnosis, decisions, initiatives, execution, measurable value, financial reasoning and client-ready outputs.

## Core Operating Loop

The canonical loop is:

`Czat / Teresa -> Moja Praca -> Wywiad / Narzędzia -> Inicjatywy -> Realizacja -> Rezultaty -> Finanse -> Outputs -> Dokumenty / Prezentacje / Tabele -> Meeting / follow-up`

Each module must either:

- start the loop,
- enrich the loop,
- govern the loop,
- execute the loop,
- measure the loop,
- package the loop into client-facing artifacts,
- or provide shared context/integration infrastructure.

## System Layers

### Conversation And Intake

Owner modules:

- `01_czat`
- `02_moja-praca`

Responsibilities:

- capture user intent,
- collect source material,
- turn conversation into structured work,
- expose pending tasks and next actions.

Must not:

- become the canonical owner of every downstream object,
- hide decisions, approvals or evidence inside chat-only state.

### Diagnosis And Expert Tooling

Owner modules:

- `03_wywiad`
- `04_narzedzia`

Responsibilities:

- structure interviews and diagnostic workflows,
- run consulting tools and analyses,
- produce evidence-backed findings,
- feed initiatives and artifacts.

Must not:

- replace implementation ownership,
- store final KPI/ROI truth outside the results and finance layers.

### Decision And Portfolio Layer

Owner modules:

- `05_inicjatywy`

Responsibilities:

- convert findings into initiatives,
- hold initiative scope and business rationale,
- connect decisions, owners, priorities and expected value.

Must not:

- act as a task runner for execution details that belong to `06_realizacja`.

### Execution Layer

Owner modules:

- `06_realizacja`

Responsibilities:

- manage execution work,
- track tasks, blockers, ownership and delivery state,
- maintain implementation evidence.

Must not:

- redefine the strategic rationale owned by initiatives,
- redefine KPI/ROI truth owned by results and finance.

### Value And Finance Layer

Owner modules:

- `07_rezultaty`
- `08_finanse`

Responsibilities:

- measure KPI, ROI and value realization,
- maintain financial models and assumptions,
- connect execution progress to business outcomes.

Must not:

- invent source data without provenance,
- let financial outputs override approved initiative decisions without review.

### Output And Client Artifact Layer

Owner modules:

- `09_outputs`
- `10_dokumenty`
- `11_tabele`
- `12_prezentacje`
- `13_meeting`

Responsibilities:

- package work into documents, tables, decks, exports and meetings,
- preserve source/provenance/evidence links,
- support review, approval and client delivery.

Must not:

- become the hidden source of truth for business objects,
- detach artifacts from their source work.

### Shared Context And Governance Layer

Owner modules:

- `16_organizacja`
- `17_panel-administratora`
- `18_ustawienia`

Responsibilities:

- maintain organization context and knowledge,
- control tenant/admin boundaries,
- manage preferences and workspace configuration.

Must not:

- bypass tenant/ACL boundaries,
- create hidden learning or hidden writes.

### Integration And Partner Layer

Owner modules:

- `14_mcp-iris`
- `15_mcp-marketplace`
- `19_portal-partnerski`

Responsibilities:

- connect external tools and MCP integrations,
- expose approved integration capabilities,
- support partner workflows.

Must not:

- bypass approval for high-impact mutations,
- expose raw internals or sensitive payloads.

## Contract Rule For Every Module

Every module contract must answer:

- what it receives,
- what it owns,
- what it produces,
- where it sends work next,
- what it must not own,
- how it supports the full consulting loop.

## Evidence Rule

Every important output must be traceable to:

- conversation,
- source,
- user action,
- imported data,
- model output,
- review,
- approval,
- or explicit author decision.
