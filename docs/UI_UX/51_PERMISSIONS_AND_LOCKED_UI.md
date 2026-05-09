---
uiux_doc_id: UIUX_PERMISSIONS_LOCKED_UI
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Permissions & locked UI

## Purpose

Zdefiniować jak UI reaguje na role/uprawnienia: kiedy akcje są hidden vs disabled, jak komunikować denial i jak unikać “fake affordances”.

## Applies To

Wszystkie moduły i wszystkie akcje (w szczególności high-impact i adminowe).

## Must

- **MUST**: UI nie pokazuje akcji, które zawsze będą odrzucone (gdy to nie szkodzi discoverability).
- **MUST**: Jeśli akcja jest widoczna, ale niedozwolona, UI musi pokazać:
  - stan `disabled/locked`,
  - krótkie “dlaczego”,
  - wskazanie “co dalej” (np. “Only owner…”, “Ask admin…”, “Managed in Admin/Settings/Organization”).
- **MUST**: Deny-by-default gdy capability/permission jest niepewne.

## Must Not

- **MUST NOT**: Udawać, że akcja wykonała się (fake success) gdy backend odmówił lub nie odpowiedział.
- **MUST NOT**: Mylić “brak danych” z “brak uprawnień” — komunikaty muszą być różne.

## Should

- **SHOULD**: Rozróżniać:
  - `hidden` (nie reklamujemy),
  - `disabled` (jest, ale wymaga uprawnień),
  - `locked` (wymaga governance state, np. lifecycle gate),
  - `soon` (feature flag / coming soon).

## Acceptance Criteria

- [ ] Użytkownik rozumie “dlaczego nie” i “co dalej”.
- [ ] Brak akcji, które “wyglądają jakby działały”, ale zawsze kończą się denial.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md` (Enterprise UI Invariants §5)
- `DRD/ROLE_PERMISSIONS_WORKFLOW_SOURCE_OF_TRUTH.md`

