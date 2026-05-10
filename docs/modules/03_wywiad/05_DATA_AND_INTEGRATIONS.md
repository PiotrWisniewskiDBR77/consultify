---
module_id: MODULE_INTERVIEW
doc_kind: DATA
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Data & Integrations — Wywiad / Interview

## Purpose

Define module objects, integrations and lineage responsibilities.

## Core Objects

- InterviewTemplate, InterviewSubmission, respondent metadata, attachments, answers, extracted insights and export packages.

## Function Data Responsibilities

| Function group | Primary data responsibility | Integration responsibility |
| --- | --- | --- |
| Assignment/review (`WY_MY_ASSIGNMENTS`, `WY_MANAGED_ASSIGNMENTS`, `WY_PENDING_REVIEW`) | assignment queues, review states, SLA and ownership metadata | interview assignment APIs and status transition paths |
| Session/template/insight (`WY_SESSIONS`, `WY_TEMPLATES`, `WY_INSIGHTS`) | session lifecycle, template question models, insight records | `V8InterviewApi` + shared `Api` interview endpoints |

## Must

- MUST keep stable identifiers for durable objects.
- MUST preserve source/provenance when objects are generated, imported, exported or converted.
- MUST record integration calls and important transformations with enough metadata for audit.

## Must Not

- MUST NOT duplicate another module's canonical object as an independent source of truth.
- MUST NOT expose raw sensitive payloads where summaries/source links are sufficient.

## Should

- SHOULD prefer links and ownership references over copied data.
- SHOULD make stale or partial data visible to the UI layer.

## Acceptance Criteria

- [ ] Every durable object has owner module, source/provenance and lifecycle state where applicable.
- [ ] Cross-module handoff preserves lineage.
- [ ] Integration failures do not corrupt local canonical state.

## Related Sources

- `DRD/consultify/docs/modules/DISCOVERY_CONSULTANT_MODULE.md`
- `DRD/consultify/docs/product/INTERVIEW_FORM_ENGINE_V3.md`
- `DRD/consultify/docs/product/INTERVIEW_ADMIN_PRIVACY_AND_AI_GOVERNANCE_V8.md`
- `DRD/consultify/docs/product/INTERVIEW_INTEGRATION_AND_EXPORT_CONTRACT_V8.md`
