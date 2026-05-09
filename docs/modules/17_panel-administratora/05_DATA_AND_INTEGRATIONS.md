---
module_id: MODULE_ADMIN_PANEL
doc_kind: DATA
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Data & Integrations — Panel Administratora

## Purpose

Opisać: kluczowe dane adminowe, agregacje (/api/admin), zależności od organization/settings resolverów oraz integracje (sync/connector health) wykorzystywane w panelach.

## Must

- **MUST**: Admin UI opiera się o kanoniczne endpointy adminowe (agregacje) i nie utrzymuje równoległego “truth store” po stronie klienta.
- **MUST**: Integracje mają bounded status vocab (connected/error/needs_reauth/disabled) i jawne remediation.
- **MUST**: Dane cross‑tenant są dostępne wyłącznie w SuperAdmin surfaces.

## Must Not

- **MUST NOT**: Logować lub renderować w UI surowych payloadów (PII/secrets/keys/tokens).
- **MUST NOT**: Przechowywać danych governance w localStorage jako SSOT (poza UI preferences nie-krytycznymi).

## Should

- **SHOULD**: Wspierać eksport/retencję audit trail zgodnie z policy (tam gdzie wymagane enterprise).

## Acceptance Criteria

- [ ] Brak wycieku raw payloadów/PII w UI/logach.
- [ ] Źródła i lineage są jawne tam, gdzie odpowiedź wpływa na decyzję.

## Related Sources

- `DRD/consultify/docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`
- `DRD/consultify/docs/product/work-packets/cursor-work/final_master/final-v8-contracts/FINAL_IMPLEMENTATION_PLAN_32_ADMIN_2026-03-29.md` (§2.3.4 status model)

