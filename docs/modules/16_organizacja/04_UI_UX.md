---
module_id: MODULE_ORGANIZATION
doc_kind: UI_UX
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# UI/UX — Organizacja (Organization Context)

## Purpose

UI/UX kontrakt: biblioteka materiałów organizacji + statusy przetwarzania + policy/quota blocks + narzędzia admin/ops, bez fake success.

## Must

- MUST: jawnie pokazywać statusy rozumienia (uploaded/processing/partial/ready/unreadable/policy_blocked/quota_blocked).
- MUST: UI pokazuje “honest degraded” i recovery actions (retry, reprocess) tam gdzie dozwolone.
- MUST: UI nie udaje sukcesu, jeśli extraction się nie udała.

## Must Not

- MUST NOT: pokazywać raw treści w logach/console ani w UI, jeśli user nie ma dostępu.

## Should

- SHOULD: UI mieć performance-first: szybkie ack po upload, progres async.

## Acceptance Criteria

- [ ] UI/UX nie łamie invariantów z `DRD/UI_UX_SOURCE_OF_TRUTH.md`.
- [ ] Kontekstowe akcje AI są w “Menu 3 / command row” zgodnie z regułami globalnymi.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md`
- `DRD/consultify/docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md`

