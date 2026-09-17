# PMO-1b Step 0b STOP — role model, SLA scan, manual tick

Status: **PMO-1b Step 0b STOP FOR CTO REVIEW** — this package writes only this decision document; it writes no production code, no SQL migration, no route, no service, and no test.

## Source and boundary

- CTO channel: Wpis 224, Wpis 222, Wpis 220.
- Decision basis: DEC-626 answers PMO-1b Step 0 and overrides the previous Step 0 proposal where it introduced a new `initiative_roles` table.
- Current line after `git fetch origin`: `e1e9f5d17651095d29bc1b9c1670a2737308ee50`.
- Branch: `codex/a-pmo1b-step0b-w224-20260917`.
- Scope limit: document STOP only; production code starts only after CTO review.

## Existing schema facts checked

The current line already has the initiative stakeholder carrier required by DEC-626:

- `server/migrations/335_initiative_stakeholders.sql` creates `initiative_stakeholders` with `initiative_id`, nullable `user_id`, nullable external identity fields, `role`, and `raci_type`.
- `server/migrations/904_stakeholder_registry.sql` adds `stakeholder_registry`, `stakeholder_engagements`, and `initiative_stakeholders.registry_id`; it explicitly keeps the live initiative stakeholder CRUD path rather than replacing it.

This means PMO-1b should use one role model centered on `initiative_stakeholders`. There is no new `initiative_roles` table in the v2 plan.

## Proposed role model for PMO-1b

Use `initiative_stakeholders.role` as the canonical initiative-level PMO role code and extend it additively. The service layer should enforce the dictionary; the database can add guarded checks only if the existing live data passes preflight.

Recommended role dictionary:

| Role code | Meaning | Escalation use |
| --- | --- | --- |
| `OWNER` | Person accountable for day-to-day initiative delivery. | Primary recipient for operational overdue items. |
| `SPONSOR` | Business sponsor accountable for governance. | First governance escalation recipient. |
| `SPONSOR.STEERING_COMMITTEE` | Steering committee bucket or member; subrole of `SPONSOR`, not a separate top-level authority. | Committee escalation if concrete recipients exist; otherwise degrade. |
| `PMO` | PMO owner or PMO group responsible for governance follow-up. | Fallback escalation when sponsor/committee cannot be resolved. |
| `CLIENT_DECIDER` | Client-side decision owner. | Optional escalation recipient for client-blocked gates. |
| `CONSULTED` | Consulted stakeholder. | Informational only unless explicitly selected. |
| `INFORMED` | Informed stakeholder. | Informational only. |

Additive columns proposed for `initiative_stakeholders` in the later SQL package:

```sql
ALTER TABLE initiative_stakeholders
  ADD COLUMN IF NOT EXISTS role_overridden BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS role_source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS role_bucket BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS role_label TEXT,
  ADD COLUMN IF NOT EXISTS escalation_order INTEGER;
```

Rules:

- `role` stores the dictionary code, including `SPONSOR.STEERING_COMMITTEE` for committee subrole rows.
- `role_overridden=false` means the role came from project/default inference; `true` means a manager/PMO user explicitly changed it at initiative level.
- `role_source` allowed values should be `manual`, `project_inherited`, `organization_default`, `migration`, `system`.
- `role_bucket=true` allows a non-person row such as committee; those rows may have `user_id IS NULL`.
- Person rows must still resolve through `user_id`, `registry_id`, or external identity fields. Bucket rows are allowed to have `user_id IS NULL` and no external email.
- `role_label` is display-only for a bucket label such as `Steering committee` and must not drive authorization.

If CTO wants a stricter SQL shape, the smallest safe variant is to omit database `CHECK` constraints in the first migration and enforce the dictionary in code plus tests. That avoids breaking existing legacy/free-text `role` values before backfill. A later cleanup migration may add constraints after data measurement.

## Committee bucket and escalation degradation

`committee` is represented as one or more `initiative_stakeholders` rows with:

- `role = 'SPONSOR.STEERING_COMMITTEE'`
- `role_bucket = true` for the abstract committee bucket row
- `user_id IS NULL` allowed for the bucket row
- optional person rows with the same role code and `role_bucket = false` when concrete committee members are known

Escalation resolution order:

1. Concrete `SPONSOR.STEERING_COMMITTEE` person rows for the initiative.
2. Concrete `SPONSOR` person rows for the initiative.
3. Concrete `PMO` person rows for the initiative.
4. Organization PMO fallback if the initiative has no PMO person row.
5. No notification is sent; an escalation event is recorded with reason `NO_ESCALATION_RECIPIENT`.

Required degradation event fields for audit:

- initiative id
- stage code
- due source
- attempted role code
- resolved role code, if any
- resolved recipient count
- degradation reason, for example `COMMITTEE_BUCKET_EMPTY`, `SPONSOR_EMPTY`, `PMO_EMPTY`
- dry-run / live mode

The UI should present a bucket honestly: `Steering committee configured as a group. Escalations will go to sponsor/PMO until named members are added.`

## 7 → 8 Delivered remains plan-driven

DEC-626 says the 7→8 Delivered transition is plan-driven and has no default SLA. The later code should not mark an initiative overdue only because it sits before Delivered.

Recommended rule:

- If a delivery plan date exists for the Delivered gate, use it as the due date.
- If a PMO stage policy explicitly defines a Delivered due date, use it.
- If neither exists, show `No delivery date set` and record a governance gap, not an overdue SLA breach.

This keeps the transition aligned with project planning rather than manufacturing a universal default deadline.

## SLA scan and scheduler shape

Scheduler authority stays with job 46. PMO-1b should add a PMO stage-SLA scan to the same scheduler family rather than using `decisionEscalationChainService`.

Proposed service split for the later implementation:

- `pmoStageSlaPolicyService`: reads policy and due-date source.
- `pmoStageSlaScanService`: computes overdue/at-risk initiatives and resolves escalation recipients from `initiative_stakeholders`.
- `pmoStageEscalationEventRepository`: persists audit rows and idempotency keys.
- job 46 runner: calls the existing decision scan, then PMO stage SLA scan.

The PMO scan must be idempotent per `(organization_id, initiative_id, stage_code, due_date, escalation_level, scan_window)` so the manual tick and scheduler cannot duplicate events.

## Manual tick endpoint for staging

Because staging has `DISABLE_SCHEDULER=true`, PMO-1b needs an explicit admin tick endpoint. Proposed endpoint:

```http
POST /api/admin/pmo/stage-sla/tick
```

Request body:

```json
{
  "organizationId": "optional-org-id",
  "dryRun": true,
  "limit": 50,
  "reason": "manual-staging-proof"
}
```

Behavior:

- Admin/PMO-only authorization.
- `dryRun=true` by default unless explicitly set to false.
- Uses the same `pmoStageSlaScanService` as job 46.
- Returns scanned count, overdue count, at-risk count, escalation events inserted, events skipped by idempotency, and degradation reasons.
- Never depends on the scheduler being enabled.

## Migration number and table plan

Use migration pool `20262281–20262299` as ordered by Wpis 220/224. Proposed first migration name after CTO approval:

```text
server/migrations/20262281_pmo_stage_sla_and_stakeholder_roles.sql
```

This migration should be additive and include only:

1. New columns on `initiative_stakeholders` listed above.
2. PMO stage SLA policy table, if no suitable existing policy table exists.
3. PMO stage due-date override table, if plan-derived dates need an initiative-level override.
4. PMO stage escalation event/audit table.
5. Indexes needed for scans by organization, stage, due date, and idempotency key.

It must not create `initiative_roles`.

## Preflight before writing SQL

Before coding the migration, the implementation package should measure:

- Current distinct `initiative_stakeholders.role` values.
- Rows with `user_id IS NULL` and no external identity fields.
- Rows already linked through `registry_id`.
- Whether existing live rows use role labels that need a legacy mapping.
- Whether a current stage/date source already exists for plan-driven Delivered.

If legacy role values exist, the migration should preserve them and the service should map them without destructive rewriting.

## CTO decisions requested

Please review and approve or change these five points before PMO-1b implementation:

1. Role carrier: `initiative_stakeholders.role` remains canonical; no `initiative_roles` table.
2. Committee representation: `role='SPONSOR.STEERING_COMMITTEE'`, `role_bucket=true`, nullable `user_id`, escalation degradation committee → sponsor → PMO.
3. Migration file: reserve `20262281_pmo_stage_sla_and_stakeholder_roles.sql`.
4. Manual tick endpoint: `POST /api/admin/pmo/stage-sla/tick`, dry-run by default.
5. Delivered SLA: plan-derived only; absent plan date means governance gap, not overdue breach.

## Evidence

- Read CTO Wpis 224, Wpis 222, and exact Wpis 220 from `/Users/piotrwisniewski/Developer/cto-codex/KANAL.md`.
- Fetched origin before branch creation; base line is `e1e9f5d17651095d29bc1b9c1670a2737308ee50`.
- Checked existing schema in `server/migrations/335_initiative_stakeholders.sql` and `server/migrations/904_stakeholder_registry.sql`.
- This branch contains a document only. No production code or SQL migration was written.
