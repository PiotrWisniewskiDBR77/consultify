# Initiative capabilities system (backend source of truth)

## Purpose

This document defines the **capabilities contract** returned by the backend for the Initiative artifact.

The goal is that **Frontend never infers permissions** from local matrices. Instead, the UI renders:

- what is editable / read-only (including the “6 fields” strip)
- which CTA actions are available
- whether AI is available in the current context

…based on a single backend payload.

## Source endpoint

Backend endpoint:

- `GET /api/initiatives/:id/gate-readiness-check`

This endpoint returns:

- current status
- effective roles for the current user (system + project + steering board + initiative gate roles)
- workflow transitions (gates) and executability
- **capabilities** (this contract)

Role vocabulary and effective-role resolution rules are defined in `docs/product/ROLES_MODEL.md`.

## Capabilities payload (v1)

`capabilities` is returned under `GateReadinessCheck.capabilities`:

- `version`: number (currently `1`)
- `source`: `"backend"`
- `topBar`: permissions for the properties strip
  - `canEditPriority`
  - `canEditOwner`
  - `canEditTargetDate`
- `cards`: broad editability of initiative sections/cards
  - `canEditCards`
  - `reasonCode` (nullable string)
- `reasonCodes`: optional nested reason codes for tooltips/toasts
- `ctaBar`:
  - `workflowActions`: executable transitions for the current user
  - `contextCreateActions`: create actions available in the current status/context (e.g. `task`, `decision`, `raid`)
  - `canUseAi`: whether AI CTA is enabled
  - `aiAllowedSectionKeys`: optional list of allowed section keys (may contain `"*"` as wildcard)

## UI rules (normative)

- **CTA bar (left)**: shows **only active actions** (no disabled workflow buttons).
- **AI CTA (right)**: is visible, but **disabled with explanation** when `capabilities.ctaBar.canUseAi = false`.
- **Properties strip (“6 fields”)**:
  - `Status`, `Phase`, `Next Gate` are **system-controlled** and **read-only**
  - `Priority`, `Owner`, `Target date` are editable only if allowed by `capabilities.topBar.*`
- **Cards/sections**:
  - if `capabilities.cards.canEditCards = false`, section UIs must be read-only and creation/edit actions must be blocked (with explanation).
