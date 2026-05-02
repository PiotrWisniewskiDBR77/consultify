# Global Backlog - UI/UX Migration Side Topics

Status: `ACTIVE`
Date: 2026-05-01
Scope: Non-UI/UX items found while migrating Consultify screens module by module.

## Rules

This file is for cross-module items. Screen-specific items should go into the matching module/function backlog file and be promoted here only if they affect multiple areas.

The backlog does not replace the UI/UX audit. It keeps unrelated work visible without blocking current screen standardization.

## Items

### BLG-20260502-001 — Roll out canonical table chips across My Work tables

Status: `planned`
Source screen: `My Work > Pomysły`
Type: `future-standard`
Priority: `P1`
Owner: `UX`

Observation:
- `My Work > Pomysły` is the first technical adoption of the DBR77 2027 table chip readability standard.
- Remaining My Work tables still use local chip/badge variants: `Tasks`, `Decisions`, `Inbox`, and table-like `Notebook` / `Calendar` surfaces.

Why it is not handled now:
- The current approval pass is limited to validating the new standard on `Pomysły` before broad migration.
- Refactoring every table at once would make visual review harder and increase regression risk.

Next action:
- After Piotr approves `Pomysły`, migrate chip semantics in this order:
  1. `src/components/MyWork/MyTasksListContent.tsx` - status, priority, due chips.
  2. `src/components/MyWork/DecisionsPanelContent.tsx` - status, priority, type chips.
  3. `src/components/MyWork/InboxContent.tsx` - SLA, urgency, status chips.
  4. `src/components/MyWork/NotebookContent.tsx` and `src/components/MyWork/Calendar/` - table-like chips/events where applicable.

Links:
- `docs/ui-standards/03-modules/app-table-standard.md`
- `src/components/MyWork/IdeasTableContent.tsx`
