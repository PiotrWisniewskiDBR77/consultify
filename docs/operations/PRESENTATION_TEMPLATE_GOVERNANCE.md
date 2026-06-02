# Presentation Template Governance

> Epic C2 — lifecycle (`draft` / `approved` / `deprecated`), approval flow,
> version lineage, and audit ledger for `presentation_templates`.

## Purpose

Enterprise rollouts of the Presentation Generator require a clear answer to
two questions about every template:

1. **Is this template safe to use?** Marketing-grade decks should never be
   built on a recipe an Owner has not signed off. The lifecycle column lets
   approvers gate which templates appear in the active picker without having
   to delete anything.
2. **What changed and why?** When a template is updated, retired, or cloned
   into a new variant, the audit ledger must show who did what, when, and
   based on which prior version. Lineage ties every clone back to its
   parent and its lineage root so forensics is one query away.

This system layers governance on top of the Sprint 4 template runtime
(`presentationTemplateRuntimeService`) and the existing `/templates`
routes. It does **not** rewrite the template recipe or the
`applyTemplateRuntime` evaluator.

## Lifecycle states and transitions

```
            ┌────────┐
            │ draft  │
            └─┬──┬───┘
              │  │
   approve ()│  │ () deprecate (with reason)
              │  │
              ▼  ▼
       ┌──────────┐    deprecate     ┌────────────┐
       │ approved │ ───────────────► │ deprecated │
       └──────────┘                  └────────────┘
            ▲                              ▲
            │ (NOT ALLOWED — clone instead)│
```

Same-state transitions are blocked with the literal reason `Already in <state>`.

| from \ to    | draft           | approved          | deprecated        |
| ------------ | --------------- | ----------------- | ----------------- |
| `draft`      | —               | needs `template_approve` | needs `template_approve` |
| `approved`   | NO (must clone) | —                 | needs `template_approve` |
| `deprecated` | NO (must clone) | NO (terminal)     | —                 |

`approved -> draft` is intentionally blocked: callers must clone the
approved template into a fresh draft. Same for resurrecting a `deprecated`
template. This keeps the lineage chain honest: each version of a recipe is
its own row, with its own audit trail.

## Capability requirements

Backed by `presentationAccessPolicyService.hasPresentationCapability`:

| Capability         | Required for                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `presentation_edit` | Read endpoints (`GET /governance`, `GET /governance/lineage`, `GET /governance/by-state/...`) |
| `template_approve` | All transitions (`POST /governance/transition`, `POST /governance/deprecate`)                 |

`OWNER`, `ADMIN`, and `SUPERADMIN` roles ship with `template_approve`.
`USER`, `PROJECT_MANAGER`, and `VIEWER` do not. The pure-logic core
returns `requiredCapability: 'template_approve'` so the UI can disable
buttons without a round-trip; the route layer is still the final
authority.

## Lineage model

Three columns on `presentation_templates`:

| Column              | Meaning                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `lineage_parent_id` | Direct parent of this clone. Null on hand-created roots.              |
| `lineage_root_id`   | Stable identifier of the original ancestor. Set ONCE at clone time.   |
| `lineage_version`   | Monotonically increasing. Parent + 1.                                 |

`computeLineageForClone({ parentTemplate })` is the pure function that
derives all three. Lineage is **immutable** — there is no UPDATE path that
modifies these columns after the clone INSERT. This is enforced by
discipline; a future migration can add a database-side trigger if needed.

## Audit ledger schema

```
presentation_template_governance_events
  id              UUID PRIMARY KEY
  template_id     TEXT NOT NULL
  organization_id TEXT NOT NULL
  event_type      TEXT  CHECK IN (submitted_for_approval, approved,
                                  rejected, deprecated, cloned, reverted)
  from_state      TEXT
  to_state        TEXT
  actor_id        TEXT
  actor_role      TEXT
  reason          TEXT
  metadata        JSONB DEFAULT '{}'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

Append-only. The route layer never updates or deletes rows. Reads are
sorted by `created_at DESC` and capped at 200.

## API reference

All endpoints are mounted under `/api/presentations` and authenticated.
Schema-tolerant: if migration **767_presentation_template_governance.sql**
has not been applied yet, the surface returns 503 with
`code: 'TEMPLATE_GOVERNANCE_UNAVAILABLE'` and `reason: 'migration_pending'`
instead of 500-ing.

| Method | Path                                                | Capability        | Description                                                                 |
| ------ | --------------------------------------------------- | ----------------- | --------------------------------------------------------------------------- |
| GET    | `/templates/:id/governance`                         | `presentation_edit` | Lifecycle state + lineage chain + last 20 audit events.                     |
| POST   | `/templates/:id/governance/transition`              | `template_approve` | Body `{ targetState, reason? }`. 403 blocked / 404 not_found / 503 storage. |
| POST   | `/templates/:id/governance/deprecate`               | `template_approve` | Body `{ reason }` — `reason` is REQUIRED. Persists to `deprecation_reason`. |
| GET    | `/templates/governance/by-state/:state`             | `presentation_edit` | List of templates in `draft` / `approved` / `deprecated` for the org.       |
| GET    | `/templates/:id/governance/lineage`                 | `presentation_edit` | Ordered chain root → … → current.                                           |

The existing `/templates/:id/clone` endpoint is **extended** (not
replaced) to:

1. Compute lineage via `computeLineageForClone` and persist
   `lineage_parent_id` / `lineage_root_id` / `lineage_version` on the new
   row.
2. Emit a `cloned` governance event.

Both writes are best-effort and silently no-op when migration 767 is
pending so the legacy clone API still works for callers that have not
upgraded.

The existing `PUT /templates/:id` route is **extended** with
`assertEditableLifecycle()`: any in-place update on a non-draft template
returns 409 with `code: 'TEMPLATE_LIFECYCLE_LOCKED'`. Schema-tolerant —
defaults to draft when the column is missing.

## UI walkthrough (SuperAdmin → Connector Ops → Template Governance)

The new tab lives in `SystemModule.tsx` after `Alert Subscriptions`. The
view (`PresentationTemplateGovernanceView.tsx`) is structured as:

1. **Header** — `Template Governance` + subtitle, plus a `Refresh` button.
2. **Lifecycle tabs** — `Draft` / `Approved` / `Deprecated`, each with a
   live count badge driven by parallel calls to
   `listTemplatesByLifecycleState(...)`.
3. **Per-template row** — name, lineage version (`v1`, `v2`, …), state
   pill (slate / emerald / amber), and a `View governance` expand
   button.
4. **Expanded pane** — two side-by-side panels:
   - Lineage chain (root → … → current) with version chips and state
     pills.
   - Approval status (`approved_at` / `approved_by` /
     `deprecated_at` / `deprecated_by` / deprecation reason).
5. **Action row** — `Submit for approval` / `Approve` / `Deprecate`.
   Buttons disable based on the lifecycle matrix; the server is the final
   authority. Clicking opens a modal with a required reason textarea
   (max 500 chars).
6. **Audit ledger** — last 10 governance events with type icon, actor
   role, transition arrow, and reason.
7. **Honest banners** for `forbidden` (role lacks `template_approve`),
   `unavailable` (migration pending), `not_found`, and generic errors.

Example state pill colors live in `STATE_PILL` and mirror the existing
governance dashboards.

## Operator playbook

### Approving a template

1. Open `SuperAdmin → Connector Ops → Template Governance → Draft`.
2. Find the candidate row, click `View governance`.
3. Confirm the lineage chain is what you expect (parent / root / version).
4. Click `Approve`, optionally write a reason (peer-review URL, ticket
   reference, etc.), then `Confirm`.
5. The row will move to the `Approved` tab on the next refresh, and the
   audit ledger will show an `approved` event with your role + reason.

### Deprecating + rolling out a replacement

1. Clone the template you want to retire (`POST /templates/:id/clone`).
   The clone enters as `draft` with `lineage_parent_id` pointing at the
   approved row.
2. Iterate on the draft, then approve it via the flow above.
3. Open the original (now-stale) approved template in the SuperAdmin
   view. Click `Deprecate` and write a reason that names the
   replacement (e.g. `Superseded by Initiative Kickoff Deck v2 (id
   tpl_abcd)`). The reason is REQUIRED.
4. The deprecation reason is persisted to `deprecation_reason`,
   surfaced in the UI banner, and copied into the audit event.

### Forensics via lineage chain

When a downstream consumer reports a regression in a deck:

1. Get the deck's `template_id`.
2. Hit `GET /api/presentations/templates/:id/governance/lineage`. The
   `chain` array is ordered root → … → current. Each node carries its
   lifecycle state, so you can immediately see whether the deck was
   built off an `approved`, `draft`, or `deprecated` template.
3. Hit `GET /api/presentations/templates/:id/governance` for the full
   audit ledger (last 20 events). The `metadata.parentTemplateId` on
   `cloned` events lets you walk back through the chain even if the
   `lineage_parent_id` column is rewritten in a future migration (it
   should never be — but defense in depth).

## Future work

- **Draft preview rendering**: SuperAdmin should be able to render a
  golden test deck against a draft template before approving it. The
  `presentationGeneratorGoldenService` plumbing is already there; we
  just need a `?templateId=...` override on the golden runner.
- **Automated CI checks for approved templates**: a nightly job that
  re-renders each `approved` template against the canonical fixture
  pack and posts a delta if any layout policy / source requirement
  drifts. Fits naturally into the existing
  `presentation-operations-health` SLO surface.
- **`submitted_for_approval` as a real state**: today the UI's "Submit
  for approval" button calls the same transition as `Approve` (the
  matrix collapses to two write operations). A future iteration can add
  a `pending_approval` lifecycle row that queues for an approver
  without granting them edit rights.
- **Deprecation replacement linking**: the deprecation reason is free
  text today. A `replacement_template_id` foreign key would let the UI
  render `Replaced by …` chips on every deprecated template.
