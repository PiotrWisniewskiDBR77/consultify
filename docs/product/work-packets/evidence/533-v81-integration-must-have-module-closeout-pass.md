# 533 - V8.1 Integration must-have module closeout pass

Date: 2026-03-28
Owner: Cursor agent
Scope: `Integracja` must-have closure for the current wave

## Problem before closeout

- `Integracja` already had a governed runtime in `UnifiedSyncHub`, but the main user-facing entry surface in `Settings > Integrations` still exposed a weaker and less honest status model.
- Provider cards could show raw backend-ish status labels instead of the real user-facing readiness state already available in the governed sync runtime.
- The entry surface handled `pending setup`, but it still did not clearly distinguish `validation pending`, `reauth required`, `error`, and disconnected states with explicit next steps.
- Recovery actions were fragmented: the governed truth lived in `Sync Hub`, while the entry surface often left the user with only local actions or a disconnect button.
- This created split-brain product truth:
  - one provider could look governed in `Sync Hub`
  - but look vague or weaker in `IntegrationSettings`

## What landed

### 1. One provider status language across entry and governed hub

- `src/components/settings/IntegrationSettings.tsx`
  - expanded `getIntegrationReadinessMeta()` so the entry surface now speaks in real readiness states instead of a weak generic status:
    - `Connected`
    - `Pending setup`
    - `Authorization pending`
    - `Verification pending`
    - `Validation pending`
    - `Reauth Required`
    - `Error`
    - `Disconnected` / `Disabled`

### 2. Honest next-step readback

- `src/components/settings/IntegrationSettings.tsx`
  - added explicit `Next step` guidance to the integration card
  - the card now tells the user what to do next instead of merely echoing a status:
    - finish external authorization
    - wait for governed verification
    - wait for governed validation
    - re-authorize in Sync Hub
    - review latest error and fix setup/auth
    - reconnect provider

### 3. Minimal operational truth on the entry surface

- `src/components/settings/IntegrationSettings.tsx`
  - provider cards now show minimal operational timing truth using:
    - `Last governed sync`
    - or `Governed entry created`
  - this removes the false impression that only a successful sync timestamp is meaningful runtime evidence

### 4. Canonical recovery bridge to governed Sync Hub

- `src/components/settings/IntegrationSettings.tsx`
  - for problem/pending states, the entry surface now exposes:
    - `Open governed Sync Hub`
    - `View governed status`
  - this creates a clear bridge from lightweight settings entry to the canonical governed control plane in `AdminSettingsModule -> UnifiedSyncHub`

### 5. Governed hub kept as SSOT

- `src/components/Admin/UnifiedSyncHub.tsx`
  - no new truth model was invented here
  - the changes deliberately aligned `IntegrationSettings` to the already-governed `UnifiedSyncHub` model instead of creating a second local interpretation

## Automated verification

Passed:

- `npx vitest run tests/components/settings/IntegrationSettings.sync-readback.test.tsx tests/components/Admin/UnifiedSyncHub.v8-health.test.tsx`

Coverage includes:

- pending setup remains honest and blocks sync controls
- canonical connect flow still starts governed authorization instead of pretending immediate connection
- `reauth required` now has explicit guidance and recovery CTA
- `validation pending` now renders as its own governed state instead of generic pending
- entry surface can route the user to canonical `Sync Hub`
- `UnifiedSyncHub` remains green across governed auth, escalation, verification, run-now, pause/resume, disconnect, and config save flows

## Manual acceptance checklist

- Open `Settings > Integrations` with a provider in `pending_external_auth` and confirm the card shows `Authorization pending` plus a clear next step.
- Open `Settings > Integrations` with a provider in `configuration_submitted_pending_validation` and confirm the card shows `Validation pending`, not generic pending.
- Open `Settings > Integrations` with a provider in `requires_reauth` and confirm the card shows `Reauth Required` plus a direct bridge to governed Sync Hub.
- Confirm the same provider’s state in `Settings > Integrations` and in governed `Sync Hub` is not contradictory.
- Confirm problem/pending states expose a clear recovery path instead of leaving the user only with `Disconnect`.
- Confirm provider cards show minimal operational timing truth (`Last governed sync` or `Governed entry created`).

## Residual risk

- `IntegrationSettings` is still a lighter entry surface than `UnifiedSyncHub`; it is intentionally not a full replacement for governed sync operations.
- The broader integration platform still contains deeper scope outside this must-have closeout:
  - richer provider inventory design
  - broader runtime jobs/monitoring productization
  - calendar/external workflow parity
  - Teresa/channel-level handoffs
- This closeout intentionally focused on honesty and authority, not on adding new connector families or new sync runtime behaviors.

## Status

- `Integracja` now behaves as an honest entry into the governed sync control plane instead of a partially local or ambiguous settings surface.
- Current closure status at time of write: code landed, focused tests green, pre-ratification snapshot.
- Current authority: final Wave 1 module ratification is recorded in `548-v81-wave1-final-module-gate-ratification.md`.
