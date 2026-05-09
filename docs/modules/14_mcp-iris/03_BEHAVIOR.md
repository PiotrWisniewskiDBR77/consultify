---
module_id: MODULE_MCP_IRIS
doc_kind: BEHAVIOR
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Behavior — MCP IRIS

## Purpose

Kontrakt zachowania providera MCP IRIS: rejestracja providera, polityki narzędzi, wykonywanie tool calls, audyt i błędy.

## Must

- MUST: provider ma statusy (configured/healthy/degraded/down) i jawne komunikaty w UI.
- MUST: narzędzia są allowlisted i przypisane do polityk (read-only / write).
- MUST: write tool calls (jeśli dopuszczone) stosują `proposal → approval → execution → audit`.
- MUST: wszystkie wywołania są audytowane (korelacja z user/tenant/run).

## Must Not

- MUST NOT: wykonywać narzędzi spoza allowlist.
- MUST NOT: przekraczać tenant boundaries.

## Should

- SHOULD: mieć dry-run / test tool do walidacji łączności bez skutków ubocznych.

## Acceptance Criteria

- [ ] Zawiera jawne reguły `proposal -> approval -> execution -> audit` tam, gdzie czat inicjuje działania.
- [ ] Definiuje “uczciwe” stany błędów i degradacji (bez fake success / infinite spinner).

## Related Sources

- `DRD/consultify/docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`

