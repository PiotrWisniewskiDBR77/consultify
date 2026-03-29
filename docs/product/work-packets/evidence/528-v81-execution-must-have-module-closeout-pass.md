# 528 - V8.1 Execution must-have module closeout pass

Date: 2026-03-28
Owner: Cursor agent
Scope: `Execution` Packet 8 - `Execution Truth Spine`

## Problem before closeout

- `ExecutionHub` held part of the control-tower truth, but `RiskSignalsPanel`, `DelayDetectionPanel`, `BudgetControlPanel`, and timeline warnings still fetched or derived overlapping truths independently.
- This produced mixed operator readback:
  - executive snapshot signal counts could disagree with the detailed panels,
  - delay truth in the panel could diverge from delay truth used by the hub,
  - timeline warning strip could tell a different story than governed execution warnings,
  - compact finance view could show legacy budget/spend values above a governed budget panel.

## What landed

### 1. Controlled execution signal spine in `ExecutionHub`

- `src/components/Execution/ExecutionHub.tsx` now owns:
  - `riskSignals`
  - `delaySignals`
  - `overspendSignals`
  - `timelineWarnings`
  - `capacityAlerts`
  - `capacityTimeline`
- Added a shared refresh trigger so timeline/status/side-panel actions can rehydrate the same execution truth instead of only patching local UI.

### 2. Panels can now run in controlled mode

- `src/components/Execution/RiskSignalsPanel.tsx`
- `src/components/Execution/DelayDetectionPanel.tsx`
- `src/components/Execution/BudgetControlPanel.tsx`

These panels now accept hub-provided truth and refresh callbacks, so `ExecutionHub` can drive one operator story instead of competing fetch lifecycles.

### 3. Snapshot and timeline now read the same signal story

- Executive snapshot signal counts in `ExecutionHub` now use live hub state (`risk / delay / overspend`) instead of stale or empty snapshot-local placeholders.
- `src/components/Execution/ExecutionTimelineView.tsx` now accepts governed timeline warnings from the hub, so the warning strip can align with the same control-tower warning source already used by the overview.

### 4. Capacity metric is now semantically closer to the label

- `ExecutionHub` no longer feeds task-throughput into the `capacity` health bucket.
- Capacity health now derives from actual execution capacity alerts, which is materially closer to the intended “team capacity / overload pressure” meaning.

### 5. Compact finance truth is less contradictory

- `src/components/Initiatives/InitiativeCompactPanel.tsx`
  - RAID mitigation saves now trigger a parent refresh.
  - Execution finance tab no longer presents duplicate top-level budget/spend cards when governed execution budget truth is available below.
  - The governed execution budget panel is now framed as the budget source of truth and can trigger parent refresh after save.

## Automated verification

Passed:

- `npx vitest run tests/components/Execution/RiskSignalsPanel.controlled.test.tsx tests/components/Execution/DelayDetectionPanel.controlled.test.tsx tests/components/Execution/MitigationPanel.test.tsx`
- `npx vitest run tests/unit/services/initiativeWriteTruth.test.ts tests/unit/services/v8-planning-api.test.ts`

New coverage:

- `tests/components/Execution/RiskSignalsPanel.controlled.test.tsx`
  - renders controlled signals without self-fetching,
  - refreshes parent truth after dismiss.
- `tests/components/Execution/DelayDetectionPanel.controlled.test.tsx`
  - renders controlled delay truth without detect/fetch side effects,
  - refreshes parent truth after dismiss.

## Manual acceptance checklist

- Open `Execution` summary/reports and confirm:
  - risk, delay, and overspend counts in snapshot/readback match the visible panel data,
  - risk panel is visible even when current state is empty, not conditionally hidden by stale gating.
- Open timeline view and confirm warning strip aligns with governed execution warnings instead of a conflicting client-only warning story.
- Dismiss a risk or delay signal and confirm the panel refreshes through the shared hub truth flow.
- Open an initiative side panel from `Execution` and:
  - save mitigation data,
  - confirm RAID refreshes,
  - add a budget entry,
  - confirm governed budget panel remains the visible budget truth.

## Residual risk

- `Execution` still spans multiple backend surfaces (`/execution/*`, `/execution-control/*`, `/executive/aggregate`), so this packet closes the client-side truth spine without claiming that all backend domains were unified.
- Route/deep-link coherence (`/execution` vs `/implementation`, `?open=` handling) remains a separate execution-shell issue outside this packet’s core control-tower truth closure.
- One pre-existing test emits `act(...)` warnings in `tests/components/Execution/MitigationPanel.test.tsx`, but the test suite still passes.

## Status

- `Execution` now has a stronger shared truth spine for its operator-facing control tower.
- Current closure status at time of write: code landed, focused tests green, pre-ratification snapshot.
- Current authority: final Wave 1 module ratification is recorded in `548-v81-wave1-final-module-gate-ratification.md`.
