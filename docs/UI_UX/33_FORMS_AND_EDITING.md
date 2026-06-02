---
uiux_doc_id: UIUX_FORMS_EDITING
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Forms & editing (save/read-back)

## Purpose

Ujednolicić zachowanie formularzy i edycji: save states, walidacja, read-back, błędy i “no fake success”.

## Applies To

Settings, Admin, N-mode edycja, formularze w modułach, edycja artefaktów.

## Must

- **MUST**: Save state i lifecycle state są rozdzielone:
  - save state: `Unsaved changes / Saving... / Saved / Save failed`
  - lifecycle state: `Draft/Review/Approved/...`
- **MUST**: “Saved/Success” jest pokazywane tylko po backend confirmation (read-back tam gdzie ryzykowne).
- **MUST**: Walidacja jest czytelna i nie jest tylko kolorem (tekst + guidance).

## Must Not

- **MUST NOT**: Udawać zapisu w sekcjach `stub`/`partial`.
- **MUST NOT**: Maskować błędów spinnerem bez recovery.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md` (Save state vs lifecycle state)
- `DRD/consultify/docs/UI_UX/36_TOASTS_BANNERS_AND_NOTIFICATIONS.md`

