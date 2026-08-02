---
doc_id: MW-CORE-005_COMPLETION_SUMMARY
module_id: MODULE_MY_WORK
doc_kind: COMPLETION_SUMMARY
status: AWAITING_CODEX_REVIEW
prepared_by: claude (Line A — MW-CORE-001 implementation)
depends_on: MW-CORE-001_CURRENT_RUNTIME_MAP.md, MW-CORE-002_DAILY_FLOW_CONTRACT.md, MW-CORE-003_EXECUTION_PACKET.md, MW-CORE-004_NEGATIVE_CONTROL_REPORT.md
branch: feat/mw-core-001-inbox-task-golden-flow
base: c522a861839f54d0f26baa918566589aab3f6f6b
last_updated: 2026-08-01
---

# MW-CORE-005 — Completion Summary (Inbox → Task golden flow)

**Status: `AWAITING_CODEX_REVIEW`. Implemented, tested against real PostgreSQL,
negative-controls verified, not staged, not merged, not deployed.**

## 1. Correction vs. MW-CORE-002/003's original plan

MW-CORE-002 (Decision D2) and MW-CORE-003 §1 originally planned to reuse
`/api/my-work/personal-tasks*` as this flow's write path, matching
`TaskDetailView.tsx`'s live wiring at the time. This was **overridden** by an
explicit correction before implementation: MW-CORE-001 §4 already proved that
route bypasses `TaskController`, `requireOrgAccess()`, schema validation, and
`requireTaskCapability`. This packet instead routes the ONE mutating
transition through the canonical `TaskController.updateTask` path. Reads
elsewhere in `TaskDetailView.tsx` may still use `personal-tasks` — untouched,
out of scope — but the transition this flow performs never does.

## 2. Final route → service → table ownership

| Step | Route | Service | Table | Notes |
| --- | --- | --- | --- | --- |
| Task transition | `PUT /api/tasks/:id` (pre-existing, unchanged) | `TaskController.updateTask` | `tasks` | org/capability/schema/transition-validation/read-back all pre-existing |
| Inbox close | `POST /api/v8/my-work/inbox/tasks/:taskId/close` (new) | `inboxService.closeInboxItemForSource` → `triageItem` (new ownership-scoped) | `canonical_inbox_items` | idempotent via existing `(user_id, source_entity_type, source_entity_id)` unique key |

No new tables. One new migration (`932_canonical_inbox_items_source_status_initiative.sql`),
additive only (`ADD COLUMN IF NOT EXISTS`, no defaults, no rewrite).

## 3. Canonical Task transition

`in_progress` from `todo` or `blocked` (both valid per `taskWorkflowService.ts`).
Unmodified canonical endpoint. Capability check (`requireTaskCapability`) is
**shadow-mode by default** in this repo (`CAPABILITY_ENFORCE` env var,
pre-existing, not introduced or changed here) — the golden-flow test suite
sets it to enforcing explicitly to prove the 403 path is real; production
behavior of that flag is unchanged by this packet and is a repo-wide setting,
not specific to this flow.

## 4. Canonical Inbox materialization and closure

- Materialization (pre-existing, `inboxService.ts` upsert) now also copies
  `source_status` and `initiative_id` at materialize time (copy-at-upsert,
  matching how `title`/`description` are already handled — not a live join).
  Both are honestly nullable; notification-sourced items never get either.
- Closure is a two-step, idempotent, recoverable process:
  1. Task transition commits, read back.
  2. `closeInboxItemForSource` resolves the row by its existing unique key
     and closes it via the now-ownership-scoped `triageItem`.
- **Real pre-existing tenancy bug fixed as a prerequisite**: `triageItem()`
  had no `user_id`/`organization_id` predicate at all — any authenticated
  caller who knew/guessed an item id could close another user's or another
  org's Inbox item, via the pre-existing `POST /inbox/:itemId/triage` route.
  This was the SOLE control on that route (no route-level ownership check
  existed either). Fixed at the source (`triageItem`'s UPDATE + read-back
  SELECT), threaded through all 3 real callers, including a legacy
  `/inbox/canonical/:id/snooze` route that had an even weaker (org-only)
  check. Not-found and wrong-owner return identical responses — no
  enumeration leak.

## 5. Recovery semantics

- Task transition is never rolled back once committed — it's legitimate
  regardless of what happens next.
- `500 INBOX_CLOSE_RECOVERY_REQUIRED` is returned, distinct from success and
  from `404 V8_ORG_DISABLED` (unsupported), when the close step fails after
  the transition succeeded.
- Retry re-runs only the close step; it is naturally idempotent (already-resolved
  rows short-circuit to `already_closed`, no double side effects).
- No new idempotency-key table — durability comes from the pre-existing DB
  unique constraint plus the Task row itself.

## 6. Explicit exclusions (unchanged from MW-CORE-002/003)

- Ideas, Notebook, Vault, Run Agent, Manager — untouched.
- Legacy non-materialized `/api/my-work/inbox` fallback — untouched; this
  flow's new close action never engages it and never reports false success
  through it, but the broader legacy list-read fallback mechanism itself is
  unchanged.
- Decision object as a flow target, and its localStorage-only "enhancement"
  fields — untouched.
- Calendar stays read-only; no write endpoint added; verified the existing
  unified-calendar read still projects an `in_progress` task's due date.
- `MyWorkHub.tsx`'s four duplicated tab-switches — not touched; the existing
  cross-component refresh event bus already propagates a close to the Inbox
  render branch, so no hub edit was needed at all.
- Two dead duplicate backend route files, `inbox-enterprise.routes.ts`'s
  client-suppliable org-id fallback — flagged in MW-CORE-001, still untouched,
  still separate follow-up work.

## 7. Remaining My Work debt found along the way (not fixed here, flagged for separate tickets)

- `personal-tasks` PUT still bypasses `TaskController` for every field this
  flow doesn't touch — a real, larger consolidation task MW-CORE-002/003
  correctly deferred.
- `tests/acceptance/schema.mjs`'s baseline loader silently rolled back
  `canonical_inbox_items`/`v8.v8_feature_flags`/`tasks.blocked_*` due to an
  unrelated failing statement later in the same multi-statement transaction —
  worked around narrowly for this suite's needs (see commit `c9f5b7eebf`);
  this is a **shared test-infrastructure file** other suites also depend on,
  so Codex should confirm the fix doesn't need wider adoption/review.
- UX pass found and fixed: missing PL/EN locale entries for all new strings
  (was silently falling back to English fallback text regardless of active
  language — commit `7009439976`), and a missing focus-visible ring on the
  shared `Callout` action button (also fixed in the same commit, verified
  safe for its ~20 other call sites).
- UX pass found, did NOT fix (pre-existing, unrelated container, out of
  scope): `TaskDetailView`'s header row clips at 375px width, and a separate
  bug where `GET/PUT /api/my-work/personal-tasks/:id` never selects
  `assignee_id`, silently nulling it on unrelated autosave — both flagged
  separately via `spawn_task`, not part of this branch's diff.

## 8. Test evidence

17/17 real-PostgreSQL integration scenarios pass (`tests/integration/mywork/my-work.golden-flow-inbox-task.test.ts`,
run via `scripts/test-mw-core-golden-flow-pg.sh`, `--retry=0`, scratch container,
production/Railway URL refusal verified). All 8 mandated negative controls
executed with real red→green proofs — full detail in
`MW-CORE-004_NEGATIVE_CONTROL_REPORT.md`. One control (#5, success-before-persistence)
initially did not reproduce on the first attempted break and required a
stronger reversal to actually catch — reported honestly rather than picked
around.

Real-browser UI Gate 0 verification performed against this worktree's own
running app (not the main checkout), backed by real Postgres: golden-flow
states (list item, task detail, in-flight, success, recovery-required,
unsupported) all confirmed rendering correctly, non-optimistically (network
timing verified). PL/EN and focus-ring gaps found were fixed and re-verified.
Narrow-width and keyboard-Tab-traversal automation had partial coverage —
documented as such, not glossed over.
