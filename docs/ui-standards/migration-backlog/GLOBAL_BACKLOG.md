# Global Backlog - UI/UX Migration Side Topics

Status: `ACTIVE`
Date: 2026-05-01
Scope: Non-UI/UX items found while migrating Consultify screens module by module.

## Rules

This file is for cross-module items. Screen-specific items should go into the matching module/function backlog file and be promoted here only if they affect multiple areas.

The backlog does not replace the UI/UX audit. It keeps unrelated work visible without blocking current screen standardization.

## Items

### BLG-20260503-002 — Discovery Tools search empty state does not show query

Status: `in_progress`
Source screen: `Assessment / Tools > Discovery Tools > Library`
Type: `bug`
Priority: `P1`
Owner: `Engineering`

Observation:
- `DEF-UX-02` was reopened after retest: searching for `task_zzzz_404` still showed the generic Polish empty state `Brak narzędzi.` instead of a query-specific no-results message.
- Retest verdict: `NO-GO`, score `40 / 100`; clear search and small viewport checks passed.
- The UI must distinguish an actually empty category from a search that returns no matching tools.

Why it is not handled now:
- It is being handled in the current hotfix pass, but remains logged here until manual retest confirms `PASS`.

Next action:
- Re-test Library search in table and grid views with a known impossible phrase.
- Expected Polish copy: `Brak wyników dla frazy "<fraza>". Zmień frazę lub wyczyść filtry.`
- Confirm that clearing search restores the list and that the search input state is cleared visually.

Links:
- `src/components/Discovery/DiscoveryToolsHub.tsx`
- `src/components/shared/ModuleHub/ModuleHub.tsx`
- `src/components/shared/ModuleHub/ModuleNavBar.tsx`

### BLG-20260504-001 — Report Pack E2E blocked by browser target closed

Status: `new`
Source screen: `Interview > Report Pack`
Type: `bug`
Priority: `P0`
Owner: `Engineering`

Observation:
- `DEF-SYS-05` blocked the Manual Enterprise E2E Gate: the browser environment closed the target during Report Pack worksheet verification.
- Result: Part B stayed `INCONCLUSIVE`, so the gate cannot receive a full `PASS`.

Why it is not handled now:
- This needs a stable browser/service window and runtime evidence. It may be environmental, but it blocks release certification until retested.

Next action:
- Re-run Report Pack Part B in a clean browser context.
- Capture console, Network/API, and screenshot evidence at worksheet entry.
- If reproducible, triage whether the crash is app runtime, Playwright/browser protocol, memory pressure, or route-level crash.

Links:
- `src/components/Interview/InterviewHub.tsx`

### BLG-20260504-002 — Interview initiative list does not refresh after wizard close

Status: `in_progress`
Source screen: `Interview > Initiative Wizard > Initiatives`
Type: `bug`
Priority: `P2`
Owner: `Engineering`

Observation:
- `DEF-UI-06`: after closing Initiative Wizard, the Interview initiatives portfolio may require a manual refresh before newly created drafts are visible.
- The E2E report confirmed traceability in API, so the risk is UI read-back/refresh rather than data creation.

Why it is not handled now:
- It is being handled in the current hotfix pass and remains logged until manual retest confirms immediate UI refresh.

Next action:
- Retest creating drafts from an interview insight.
- After closing the wizard, verify the `Initiatives` tab updates without F5 and still survives refresh.

Links:
- `src/components/Interview/InterviewHub.tsx`
- `src/components/Initiatives/Wizard/InitiativeWizardModal.tsx`

### BLG-20260504-003 — Interview wizard and report pack improvement backlog

Status: `new`
Source screen: `Interview > Initiative Wizard / Report Pack`
Type: `product-idea`
Priority: `P1`
Owner: `Product`

Observation:
- The Manual Enterprise E2E Gate produced improvement ideas for making the client demo and consultant workflow stronger.

Why it is not handled now:
- These are product enhancements, not immediate hotfix blockers, except where they overlap with readiness gates.

Next action:
- Prioritize before/after demo:
  1. `P1` Batch accept candidates in Initiative Wizard.
  2. `P2` Evidence preview inside wizard candidate cards.
  3. `P2` AI regenerate / "more like this" for promising candidates.
  4. `P3` Export candidate shortlist to PDF/Excel.
  5. `P0` Report Pack readiness gate auto-fix suggestions for missing voices.
  6. `P1` Multi-edit worksheet statuses.
  7. `P2` Export preview before final report export.
  8. `P2` Contradiction highlights in worksheet side navigation.
  9. `P1` Global governance audit trail quick view.
  10. `P2` Dark-mode badge contrast polish in wizard modal.

Links:
- `src/components/Initiatives/Wizard/InitiativeWizardModal.tsx`
- `src/components/Interview/InterviewHub.tsx`

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
