---
module_id: MODULE_PARTNER_PORTAL
doc_kind: DATA
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Data & Integrations — Portal Partnerski

## Purpose

Define module objects, integrations and lineage responsibilities.

## Core Objects

- Partner, onboarding state, referral/earning event, ledger entry, balance, payout request and operator decision.

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

- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_29_PROGRAM_PARTNERSKI_2026-03-29.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_PARTNER_PROGRAM_2026-03-29.md`
- `DRD/consultify/docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_PARTNER_PROGRAM.md`
- `DRD/consultify/docs/product/PARTNER_PROGRAM_V8_MASTER_SUMMARY.md`
- `DRD/consultify/docs/product/modules/partner/PARTNER_PORTAL_MODULE.md`
