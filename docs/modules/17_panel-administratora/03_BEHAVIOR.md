---
module_id: MODULE_ADMIN_PANEL
doc_kind: BEHAVIOR
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Behavior — Panel Administratora (Admin + SuperAdmin)

## Purpose

Opisać kontrakt zachowania paneli governance: nawigacja, mutacje, audyt, błędy/denials, degraded states, oraz “handoff” między Settings ↔ Admin ↔ Organization ↔ SuperAdmin.

## Must

- **MUST**: Każda operacja zapisu o znaczeniu governance (IAM/security/billing/integrations/policies) jest:
  - jawna w UI (co się zmieni i dlaczego),
  - wykonywana po stronie backendu (source of truth),
  - zakończona wynikiem w UI (success/error) bez “fake success”.
- **MUST**: Mutacje emitują zdarzenie audytu adminowego (actor, target, timestamp, before/after summary; reason jeśli wymagane).
- **MUST**: Denial taxonomy jest czytelna:
  - 403 “insufficient role” + guidance (“Only owner…”, “Managed in Organization/Settings/Admin/SuperAdmin”),
  - 409/validation errors dla nielegalnych przejść (np. self‑lockout / last owner).
- **MUST**: Degraded posture dla integracji i danych:
  - per‑row status + zbiorczy banner,
  - brak maskowania stale/outdated jako “OK”.
- **MUST**: SuperAdmin jest osobnym root i przy kontach SUPERADMIN landing prowadzi do `/superadmin` (stabilny login → superadmin).

## Must Not

- **MUST NOT**: Silent execution / ukryte mutacje.
- **MUST NOT**: Ukrywać błędu pod spinnerem bez recovery.
- **MUST NOT**: Wykonywać cross‑tenant operacji z powierzchni Admin.

## Should

- **SHOULD**: Settings (P31) deep‑linkuje do Admin dla tenant‑enforced write keys (np. security/collaboration).
- **SHOULD**: UI pokazuje “ownership hint” przy próbie wejścia w niewłaściwy obszar (link do właściwej powierzchni).

## Acceptance Criteria

- [ ] Opisuje audyt i denial/degraded bez sprzeczności z P32/P33 kontraktami.
- [ ] Nie ma “fake success / infinite spinner” dla krytycznych mutacji.

## Related Sources

- `DRD/consultify/docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_32_ADMIN_ENTERPRISE_2026-04-11.md`
- `DRD/consultify/docs/product/SUPERADMIN_V8_SSOT.md`

