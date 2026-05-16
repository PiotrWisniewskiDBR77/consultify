---
uiux_doc_id: UIUX_STATE_MODEL
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# State model (save/lifecycle/permission/system)

## Purpose

Ujednolicić główne “osie stanu” w UI, żeby nie mieszać komunikatów i żeby UI było testowalne.

## Applies To

Artefakty, moduły, admin/settings, AI workflows.

## Must

- **MUST**: Rozróżniać niezależne stany:
  - **Save state**: unsaved/saving/saved/save failed (trwałość zapisu).
  - **Lifecycle state**: draft/review/approved/failed (governance).
  - **Permission state**: hidden/disabled/locked/denied.
  - **System health**: green/yellow/red (Data availability).
  - **Job/progress state**: queued/running/succeeded/failed (długie pipeline’y).
- **MUST**: UI nie mapuje “Draft” na “nie zapisane” i nie mapuje “Saved” na “zatwierdzone”.

## Related Sources

- `DRD/UI_UX_SOURCE_OF_TRUTH.md` (Save vs lifecycle)
- `DRD/consultify/docs/ui-standards/01-shell-layout/app-topbar-standard-v3.md` (Data: green/yellow/red)

