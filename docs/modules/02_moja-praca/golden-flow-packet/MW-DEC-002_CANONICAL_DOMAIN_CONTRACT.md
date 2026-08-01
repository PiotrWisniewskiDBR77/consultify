---
doc_id: MW-DEC-002_CANONICAL_DOMAIN_CONTRACT
module_id: MODULE_MY_WORK
line: Line B — MW-DEC-001 Canonical Decision Workflow
status: AWAITING_CODEX_REVIEW
last_updated: 2026-08-01
---

# MW-DEC-002 — Canonical Domain Contract

## Ownership chain

`pmo/decisions.routes.ts` (route, mounted at `/api/decisions` — confirmed the
**only** live mount by the final falsification reviewer via a repo-wide grep;
`server/src/routes/decisions.routes.ts` is a full 835-line alternate
implementation that is genuinely dead code, never imported anywhere, left
untouched; `server/src/routes/my-work/decisions.routes.ts` is a different,
live, lightweight surface mounted under `/api/my-work`, no collision) →
`DecisionController` (single controller, static methods) →
`decisionCollaborationService.ts` + `decisionOutcomeService.ts` (sibling
services, `DecisionController` is their only caller) → `decisions` /
`decision_history` / `decision_impacts` / `decision_comments` /
`decision_alternatives` / `decision_risks` / `link_graph_edges` (read-only)
tables. No second Decision backend exists or was created by this packet.

## API surface (all under `/api/decisions`, behind router-level `verifyToken` + `requireOrgAccess()`)

- `GET /:id/detail` — aggregate read: decision fields (incl. `version`,
  `decidedBy`) + `comments[]` + `dossierAlternatives[]` + `dossierRisks[]` +
  `links[]` (read-only projection of `link_graph_edges`) + `history[]`
  (`decision_history`). 404 on not-found or cross-tenant (verified: response
  body is a generic `{"error":"Decision not found"}`, no content leak).
- `POST/PUT/DELETE /:id/comments[/:commentId]` — `authorId` always from
  token; author-or-admin required for edit/delete; soft-delete
  (`deleted_at`).
- `POST/PUT/DELETE /:id/alternatives[/:alternativeId]` — creator /
  decision-owner (`decision_maker_id`) / admin only; 409 `DECISION_FINALIZED`
  once status is `approved`/`rejected`; hard delete.
- `POST/PUT/DELETE /:id/risks[/:riskId]` — same auth/freeze rule as
  alternatives.
- `PATCH`/`PUT /:id/decide` — decision owner or admin only; body
  `{status, rationale?, version?/expectedVersion?}`; 200 on success, 400
  (invalid target / missing rationale), 403 (unauthorized), 404
  (not found/cross-tenant), 409 `ALREADY_FINALIZED`, 409 `STALE_VERSION`.
- `PUT /:id` (existing, hardened) — now 409 `ALREADY_FINALIZED` for any field
  edit once the decision is terminal (previously silently accepted).
- Universal: any client-supplied `authorId`/`createdBy`/`decidedBy`/
  `organizationId` in a request body is ignored or stripped by schema
  validation — confirmed by the adversarial reviewer as a genuine two-layer
  defense (Zod schema field-stripping + controller reading only `req.user`).

## Lifecycle (the `status` column — the OUTCOME axis, independent of the pre-existing `workflow_status` axis, which is untouched)

| Status | Who may enter | Required fields | Allowed next | Editable? | Notification | Audit |
| --- | --- | --- | --- | --- | --- | --- |
| `pending` (wire value for OPEN/AWAITING_DECISION) | System, on create | title, decision_maker_id | approved, rejected, returned_for_clarification, cancelled, escalated (separate endpoint) | Yes | — | `decision_history` row on create |
| `approved` | decision_maker or admin, via `decide()` | non-empty `decision_rationale` | none (terminal) | No — both `decide()` and `updateDecision` reject with 409 | Outbox row to `created_by` (`DECISION_FINALIZED`) | `decision_history` row, atomic with the status write |
| `rejected` | decision_maker or admin, via `decide()` | non-empty `decision_rationale` | none (terminal) | No | same | same |
| `returned_for_clarification` (new value) | decision_maker or admin, via `decide()` | none | `pending` (resubmit) or directly `approved`/`rejected` | Yes | — | `decision_history` row |
| `escalated` | existing `escalateDecision` endpoint, untouched | — | unchanged | Yes | unchanged | unchanged |
| `cancelled` | existing `deleteDecision` (soft-delete), untouched | — | none (idempotent) | unchanged | unchanged | unchanged |

Comments remain postable in every state, including after finalization
(discussion continues). Alternatives/risks are frozen (409
`DECISION_FINALIZED`) the moment the decision reaches `approved`/`rejected` —
the dossier actually decided on can't be rewritten after the fact. A
decision in a terminal state cannot silently return to an earlier state —
verified both by the acceptance suite (case 12) and by the adversarial
reviewer disabling the guard and confirming it turns red.

## Capabilities by role

Reuses the existing `requireDecisionCapability(<cap>, {shadow: true})`
middleware pattern — confirmed by the final falsification reviewer to be the
**established repo-wide pattern** (8 route files use the same shadow-only
mode under an unset `CAPABILITY_ENFORCE` flag), not a Decisions-specific
under-enforcement. The real, blocking enforcement for ownership on `decide()`
is an inline check in the controller (`decision_maker_id === userId` or
admin role) — confirmed the only real gate by the adversarial reviewer
(disabling it turns case 4 red; the middleware alone would not have blocked
anything). Comments — any org member creates, author-or-admin edits/deletes.
Alternatives/risks — decision creator, decision owner, or admin only.

## Relationship model

No new relationship columns or tables. `decision_id` FK (`ON DELETE CASCADE`)
ties comments/alternatives/risks to their decision. `projectId`/
`initiativeId`/`taskId` on create are now validated to belong to the caller's
own organization (root-cause bug #3 fix). Evidence/supporting links reuse the
existing `link_graph_edges` table (`source_type='decision'`) — read exposed
via the new aggregate GET, writes go through the existing generic
`POST /api/my-work/link-graph/edges` endpoint. No free-text foreign keys
introduced. Task-creation-from-decision is unchanged (existing
`transitionWorkflow`'s publish-time auto-create, on the separate
`workflow_status` axis) — this packet does not create Tasks.

## Atomicity boundary

Exactly one atomic unit: the final-transition write (`status` +
`decision_rationale` + `decided_by` + `decided_at` + `version` on
`decisions`, plus the `decision_history` audit row), on one pinned
`pg.Client`, `SELECT ... FOR UPDATE` → `UPDATE` → `INSERT` →
`COMMIT`/`ROLLBACK`. Independently confirmed by the final falsification
reviewer (single BEGIN/COMMIT boundary, ROLLBACK on every error path,
`client.release()` in `finally` — no connection leak) and by the adversarial
reviewer's real fault-injection test (splitting the transaction into two
independent connections produced a genuine "APPROVED with zero history rows"
failure, caught by the read-back assertions). All comment/alternative/risk
CRUD operations are single-statement and don't need multi-statement
atomicity. Post-commit side effects (task/initiative block refresh,
audit-events log, notification-outbox enqueue) are deliberately **outside**
the transaction and best-effort/non-blocking, now also exception-safe (bug
#1 fix) — a failure there never rolls back a successfully committed
decision, and never fabricates a "sent" claim for a notification that only
reached the outbox table.

## Audit/notification behavior

Every status-changing write gets a `decision_history` row (unchanged
mechanism, now atomic with the write it describes). `AuditEventsService.log()`
is called best-effort after commit (unchanged pattern). A `DECISION_FINALIZED`
notification-outbox row is enqueued to the decision's `created_by` via the
existing `NotificationOutboxService.enqueue()` — actual delivery depends on
that service's pre-existing drain cron; this packet does not claim delivery,
only that a real, persisted outbox row now exists where none did before.
