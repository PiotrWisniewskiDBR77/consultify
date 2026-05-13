---
module_id: MODULE_ADMIN_PANEL
doc_kind: DATA
version: 2.0
owner: user
status: canonical
last_updated: 2026-05-11
---

# Data & Integrations — Panel Administratora

## Purpose

Define module objects, integrations and lineage responsibilities.

## Core Objects

- Admin section, user, role, policy, integration config, audit event and status inventory.

## Function Data Responsibility Map

- `ADM_ADMIN_WORKSPACE`: admin entities, policies, integrations and audit events.
- `ADM_SUPERADMIN_BOUNDARY`: route/role ownership boundary metadata between admin and superadmin planes.

## Ownership Split Matrix (hard rule)

| Concern | Owner | Module 17 rule |
| --- | --- | --- |
| Tenant admin operations data (members, security posture, billing posture, AI posture, audit events) | Module 17 | `WRITE` |
| User preference data (theme, personal workflow, private settings) | Module 18 (`/settings/*`) | `READ/HANDOFF ONLY` |
| Platform cross-tenant governance and operator controls | Superadmin (`/superadmin/*`) | `DENY / HANDOFF` |

## Must

- MUST keep stable identifiers for durable objects.
- MUST preserve source/provenance when objects are generated, imported, exported or converted.
- MUST record integration calls and important transformations with enough metadata for audit.

## Must Not

- MUST NOT duplicate another module's canonical object as an independent source of truth.
- MUST NOT expose raw sensitive payloads where summaries/source links are sufficient.
- MUST NOT create implicit cross-plane writes (tenant action mutating platform scope without explicit superadmin workflow).

## Should

- SHOULD prefer links and ownership references over copied data.
- SHOULD make stale or partial data visible to the UI layer.

## Acceptance Criteria

- [ ] Every durable object has owner module, source/provenance and lifecycle state where applicable.
- [ ] Cross-module handoff preserves lineage.
- [ ] Integration failures do not corrupt local canonical state.
- [ ] High-risk admin mutations have module-local evidence rows or are explicitly `NOT_DONE`.

## Critical Chain Ledger (source -> decision -> evidence)

| Claim | Source | Decision | Evidence / Status |
| --- | --- | --- | --- |
| Admin inventory sections are real/partial as listed | contract inventory | `KEEP` | `ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md` |
| Admin owns tenant operations data spine | enterprise P32 contract | `KEEP` | `FINAL_IMPLEMENTATION_PLAN_32_ADMIN_ENTERPRISE_2026-04-11.md` |
| Settings owns personal preferences data | historical P32 ownership matrix | `KEEP` | `FINAL_IMPLEMENTATION_PLAN_32_ADMIN_2026-03-29.md` |
| Superadmin owns cross-tenant platform data plane | superadmin SSOT | `KEEP` | `SUPERADMIN_V8_SSOT.md` |
| Admin high-risk write audit evidence is complete | module acceptance requirement | `ENHANCE` | `NOT_DONE` (`ADM-RAW-P1-004`) |

## Related Sources

- `DRD/consultify/docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_32_ADMIN_ENTERPRISE_2026-04-11.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_32_ADMIN_2026-03-29.md`
- `DRD/consultify/docs/product/SUPERADMIN_V8_SSOT.md`
- `DRD/consultify/docs/product/VIRTUAL_WORKERS_SUPERADMIN_IMPLEMENTATION_PLAN_V8.md`
