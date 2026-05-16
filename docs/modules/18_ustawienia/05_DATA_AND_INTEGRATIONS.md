---
module_id: MODULE_SETTINGS
doc_kind: DATA
version: 0.1
owner: user
status: draft
last_updated: 2026-05-09
---

# Data & Integrations — Ustawienia (Settings)

## Purpose

Opisać: kluczowe źródła danych Settings (user prefs, org context resolver, ai-settings) oraz zależności integracyjne (connected apps).

## Must

- **MUST**: Dane Settings pochodzą z kanonicznych endpointów per sekcja (zgodnie z inventory), nie z lokalnego mock state.
- **MUST**: Org/tenant context w Settings jest konsumowany jako resolved read model (nie jako miejsce authoringu “org truth”).

## Must Not

- **MUST NOT**: Przechowywać sekretów (API keys/tokens) w UI lub logach bez redakcji.

## Should

- **SHOULD**: Widoczny provenance: skąd pochodzi wartość (user vs tenant default vs enforced policy) gdy to ma znaczenie.

## Acceptance Criteria

- [ ] Brak wycieku raw payloadów/PII w UI/logach.
- [ ] Źródła i lineage są jawne tam, gdzie odpowiedź wpływa na decyzję.

## Related Sources

- `DRD/consultify/docs/modules/ADMIN_SETTINGS_SUPERADMIN_CONTRACT_INVENTORY.md`

