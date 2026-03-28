# 527 - V8.1 Initiatives must-have module closeout pass

Date: 2026-03-28
Owner: Cursor agent
Scope: `Inicjatywy` Packet 7 - `Initiative Write Truth`

## Problem before closeout

- `Inicjatywy` read from a V8-first planning surface, but writes still went through legacy `/api/initiatives` seams.
- `hub`, `compact panel`, and `detail` each handled readiness/status/update truth slightly differently.
- Post-write behavior was inconsistent:
  - some surfaces only patched local state,
  - some refreshed detail truth,
  - some used legacy gate-readiness only,
  - history/readiness/status-history could drift after status or save.

## What landed

### 1. Shared initiative write truth shim

- Added `src/services/initiativeWriteTruth.ts`.
- This helper centralizes:
  - governed read truth for initiative detail,
  - governed readiness truth,
  - governed status-history truth,
  - governed activity-history truth,
  - write flows for create, status, quick update, and save.

### 2. Shared preflight for status transitions

- `InitiativesHub`, `InitiativeCompactPanel`, and `InitiativeDocumentView` now use the same preflight source:
  - `getInitiativeStatusPreflightTruth(...)`
- This means transition permission and blocking readiness checks now come from one read path instead of separate ad-hoc implementations.

### 3. Post-write refresh truth

- After create/update/status/save, the module now rehydrates governed read truth instead of relying only on optimistic local patches.
- `InitiativesHub` now refreshes list/open-document state from the same write truth seam.
- `InitiativeCompactPanel` now refreshes gate-readiness after status changes.
- `InitiativeDocumentView` now refreshes initiative detail, readiness, status-history, and activity history after status and save.

## Automated verification

Passed:

- `npx vitest run tests/unit/services/initiativeWriteTruth.test.ts tests/unit/services/v8-planning-api.test.ts`

New coverage:

- `tests/unit/services/initiativeWriteTruth.test.ts`
  - derives transition + blocking items from governed gate readiness,
  - hydrates created initiatives through governed read truth,
  - falls back to legacy governance reads when V8 reads fail.

Existing guardrails still green:

- `tests/unit/services/v8-planning-api.test.ts`

## Manual acceptance checklist

- Create a new initiative from the hub and confirm it opens with governed detail truth.
- Change initiative status from the hub and confirm list row, open document, and readiness story stay aligned.
- Change initiative status from the compact panel and confirm readiness refreshes consistently.
- Edit/save an initiative in full detail and confirm:
  - detail stays consistent,
  - status-history is refreshed,
  - activity/history is refreshed,
  - readiness reflects the current saved state.
- Reload the module and confirm the same initiative still reads consistently from the governed surface.

## Residual risk

- This closes the client-side split-brain for Packet 7, but backend writes are still implemented through the legacy `/api/initiatives` route family.
- The current close is therefore a compatibility shim, not a fully separate V8 write backend.
- Full repo `type-check` still reports pre-existing unrelated failures outside this packet:
  - `src/components/Landing/EpicHeroSection.tsx`
  - `src/components/MyWork/notebook/NotebookContextPanel.tsx`
  - `src/components/ReportsAndPresentations/useRapData.ts`

## Status

- `Inicjatywy` now have one clearer write-truth contract on the client.
- Current closure status: code landed, targeted tests green, manual acceptance still required.
