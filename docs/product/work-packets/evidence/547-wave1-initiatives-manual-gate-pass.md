# 547 - Wave 1 initiatives manual gate pass

Date: 2026-03-29
Owner: Cursor agent
Scope: `Inicjatywy` Wave 1 must-have manual acceptance on production

## Production verification

- Environment: `consultify` production
- Verified on: `https://consultify.ai/initiatives`
- Relevant production rollouts during manual gate:
  - `d3c7293c-1185-413e-a186-32ccd76ec476` - compact panel render fix
  - `f669f2d8-3b84-40bb-a691-3de3a8df5dc3` - compact translations
  - `845a9200-a726-4bfe-a32c-550cd1f6903d` - locale cache refresh
  - `c7201928-1a8d-453a-a983-3cb5e758f274` - hub/create translations
  - `e32be6e7-0104-498e-973a-006260038eae` - axis + approval copy

## What was fixed during the gate

- `?view=c` no longer renders the placeholder; it now mounts the real embedded `InitiativeCompactPanel`.
- Production locale payloads for the initiatives hub/create/compact path were completed in `PL` and `EN`.
- i18n backend requests now bypass browser cache so production picks up new locale JSON immediately after deploys.

## Manual checklist result

### 1. Create a new initiative from the hub

Passed on live.

- Opened fresh production hub state with no visible initiatives.
- Clicked `New initiative`.
- Confirmed the modal renders human copy instead of raw i18n keys.
- Created `Wave 1 Final Gate 2026-03-29 02:36`.
- The module immediately opened the created initiative in full document view.

### 2. Change initiative status from compact panel

Passed on live.

- Used existing initiative `56025c74-7074-49ca-a92d-17f5d41fd967` in compact mode.
- Triggered compact action `Approve to Initiatives`.
- Network confirmation:
  - `GET /api/v8/planning/initiatives/:id/gate-readiness-check` -> `200`
  - `PATCH /api/initiatives/:id/status` -> `200`
  - follow-up governed refresh reads (`detail`, `history`, `status-history`, `gate-readiness`, portfolio/tasks/decisions/raid) -> `200`
- Compact panel action refreshed from `Approve to Initiatives` to `Accept (Promote)`, confirming state sync after the write.

### 3. Confirm full detail stays aligned after status change

Passed on live.

- Opened the same initiative from compact into full document view.
- Confirmed detail top bar refreshed to:
  - status `Review`
  - module `Initiatives`
  - next action `Reject` / promote path available

### 4. Edit and save in full detail

Passed on live.

- Updated the `Problem` field in full detail.
- Network confirmation:
  - `PUT /api/initiatives/:id` -> `200`
  - `GET /api/v8/planning/initiatives/:id` -> `200`
  - `GET /api/v8/planning/initiatives/:id/history` -> `200`
  - `GET /api/v8/planning/initiatives/:id/status-history` -> `200`
  - `GET /api/v8/planning/initiatives/:id/gate-readiness-check` -> `200`
- UI returned to `Saved`, confirming the post-save refresh contract remained intact.

### 5. Reload and read consistency

Passed on live.

- Fresh production loads (`fresh=3`, `fresh=4`, `fresh=5`) showed the fixed hub and compact surfaces.
- No raw `initiatives.*` i18n keys were visible on the verified must-have create/hub/compact/detail path after the final deploys.

## Result

- `Inicjatywy` manual Wave 1 gate is passed on production for the verified must-have path.
- The module now satisfies the required create -> compact -> status -> detail -> save -> refresh lifecycle on live.
