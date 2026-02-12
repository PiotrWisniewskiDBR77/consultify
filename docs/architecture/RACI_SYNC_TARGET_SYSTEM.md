# RACI Sync Target System

## Goal

Create one reusable RACI model for the whole app where notification channels and external synchronizations are managed consistently across modules (decisions, tasks, initiatives, approvals).

## Core Decisions

- Use a **single RACI component contract** in frontend.
- Use **target IDs** (`syncTargetIds`) as source of truth, not raw strings.
- Keep legacy text targets only as temporary migration fallback.
- Validate targets by organization scope and integration status on backend.

## Data Model (Canonical)

### Stakeholder Notifications

- `channels: NotificationChannel[]`
  - core: `in_app`, `email`
  - integrations: `slack`, `teams`, `jira`, `webhook`
- `syncTargetIds: string[]`

### Integration Target Registry

`SyncTargetRecord`:
- `id`
- `provider`
- `organizationId`
- `workspaceId`
- `externalId`
- `displayName`
- `status` (`connected` | `needs_auth` | `disabled`)
- `metadata`

## Sync Target Format

Canonical key format for diagnostics and imports:

`provider:workspaceId:externalId[:extra]`

Examples:
- `slack:ws-01:#delivery`
- `teams:tenant-x:channel-14`
- `jira:cloud-a:project-DRD`
- `webhook:ops:decision-alerts`

## Validation Rules

- Only targets from the same `organizationId` are allowed.
- Target status must be `connected`.
- Target provider must match selected notification integration channels.
- Invalid target IDs are rejected and logged as warnings.

## Migration Strategy

### Current State

Some views still use `syncTargets: string[]`.

### Transitional Strategy

1. Keep reading `syncTargets` (legacy).
2. Parse and map legacy values to registry IDs when possible.
3. Save normalized values to `syncTargetIds`.
4. After stabilization, remove legacy write path.

## API Contract (recommended)

- `GET /integrations/sync-targets?organizationId=...`
  - returns `SyncTargetRecord[]`
- `POST /raci/validate-sync-targets`
  - input: `selectedTargetIds`, `selectedProviders`
  - output: `validTargetIds`, `invalidTargetIds`, `warnings`

## UI/UX Standard For RACI Modals

- One shared modal shell size for all RACI-related modals:
  - width: `max-w-2xl`
  - shape: `rounded-3xl`
  - spacing: `p-6`
- Notification channel groups:
  - **Core channels**: `Enabled`, `In-app`, `Email`
  - **Integration channels**: `Slack`, `Teams`, `Jira`, `Webhook`
- `Sync targets` field should be a multi-select from registry (not free text).

## Implemented Foundations

Frontend reusable module added:

- `src/modules/raci/types.ts`
- `src/modules/raci/syncTargets.ts`
- `src/modules/raci/registry.ts`
- `src/modules/raci/index.ts`

These files provide:
- canonical types,
- legacy sync target parser,
- selection validation,
- registry-based sync target resolution.

## Next Steps

1. Plug `src/modules/raci/*` into `DecisionDetailView`.
2. Add backend endpoint for sync target registry and validation.
3. Replace text `syncTargets` inputs with registry multi-select in all RACI views.
4. Add unit tests for parser/validation and integration tests for API validation flow.
