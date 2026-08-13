# RN Outbox Dispatcher + `mywork_projection` — FROZEN DESIGN

Status: **FROZEN**. Integration Owner: Claude (orchestrator session, 2026-08-10).
First vertical slice closing the program's single largest operational gap.
Backend only.

---

## 0. Why this exists

All three domains are backend-complete (KPI 7 epics, ROI 8, OKR 8) and write
events + outbox rows atomically. But audit confirmed in code: **no dispatcher,
no cron, no consumer registry, zero real consumers.** 143 event types fan out
to 4 consumer-group names that appear only in the routing map.

Today: `domain command → event + outbox row → END`

Missing: `outbox row → dispatcher → consumer → MyWork/Decision/Finance/Notification → idempotent readback + retry + dead-letter alert`

This gap blocks gates RN-G3, RN-G5 and RN-G6 simultaneously.

**Founder's eight acceptance proofs** govern this slice (§8).

---

## 1. The finding that changes the scope

`RN_G1_PLATFORM_DESIGN.md` §A.5 points at `v8_canonical_object_states` as the
projection target. **The real Inbox is a different table.**

Verified in code:
- `v8_canonical_object_states` is written/read only per-object
  (`PUT`/`GET /api/v8/my-work/objects/:objectId`, `myWorkRoofService.ts:167-236`).
  No bulk-listing endpoint exists. `setCanonicalObjectState()` has **zero
  callers** from any KPI/ROI/OKR code.
- The real Inbox is `canonical_inbox_items`, fed by
  `inboxService.materializeInboxItems(userId, orgId)`
  (`inboxService.ts:195-225`), which reads exactly three hardcoded sources:
  `tasks` (`assignee_id`), `decisions` (`decision_maker_id`), `notifications`
  (`user_id`, unread). **KPI/ROI/OKR appear in none of them.**

Consequence: following the frozen platform design's letter would satisfy the
document and produce **zero visible product change** — failing the exact
question this slice exists to answer. So `mywork_projection` writes **both**
the canonical-state row (design intent, cross-surface truth) **and** a
`notifications` row (the real, already-shipped path into the user's Inbox,
requiring zero changes to `inboxService.ts`).

This is the "verify real runtime, not docs" rule paying off again.

---

## 2. Integration Owner rulings

| # | Question | Ruling | Rationale |
|---|---|---|---|
| **IO-A** | `canonicalState` has no SSOT vocabulary (schema is a free `z.string().min(1)`); the design proposes `needs_attention`/`in_progress`/`approved`/`resolved`/`archived`. | **Adopt those five, but define them once as an exported `const` (e.g. `RVN_CANONICAL_STATES`) — never as inline string literals at call sites.** | The values are sensible, but an un-centralised free string is precisely how this codebase grew four parallel resource taxonomies. One exported const costs nothing and makes the vocabulary greppable and extendable. Without it this becomes the fifth taxonomy. |
| **IO-B** | `decisions_projection` / `notifications_projection` have **zero producers** — no event type routes to them. Remove from the routing map, or leave? | **Leave them in `EVENT_TYPE_CONSUMER_GROUPS` untouched** (it is a write-side map, out of this dispatch-side slice's scope) and **do NOT add registry entries for them**. Since nothing produces rows for them, they will never dead-letter. Record in the closure entry that both are dead placeholders. | Removing them is a separate, write-side decision. Naming them as dead is honest and free. |
| **IO-C** | **CORRECTION to the design.** `finance_projection` has **11 live event types** routing to it with no consumer built. Under the design's proposed "no consumer registered → `markFailed` → eventually `dead_letter` + CRITICAL alert", **every ROI case approval would dead-letter and fire a CRITICAL Slack alert.** | **Reject that behaviour for known-unbuilt groups.** Introduce an explicit `UNBUILT_CONSUMER_GROUPS: ReadonlySet<string>` containing `finance_projection` (and any other group with live producers but no consumer). Rows whose `consumer_group` is in that set get a **distinct terminal status** (`parked`, added to the outbox status vocabulary) and **one throttled INFO-level notice per group per hour** — never CRITICAL, never per-row. An unregistered group **not** in that set still hard-fails and dead-letters as designed. | The design's uniform treatment conflates "a consumer broke" with "we deliberately haven't built this consumer yet." The first is an incident; the second is known backlog. Alerting CRITICAL on known backlog trains everyone to ignore the channel — the classic alert-fatigue failure — and would fire on the single most important ROI event in the system. Parking keeps the rows visible and replayable once the consumer lands, without crying wolf. |
| **IO-D** | The `v8_canonical_object_type` CHECK-constraint migration's own gate requires an `information_schema` check of which schema (`public` vs `v8`) is live on demo (unresolved, ledger §7 decision #3). | **Not a design blocker; it IS a promotion blocker.** Build against the local/ephemeral schema; record it explicitly in the closure entry as a named pre-promotion check. | Consistent with how every prior epic handled the same ambiguity. Failing loudly on demo is acceptable; failing silently is not — and this would fail loudly. |
| **IO-E** | Is "resolve the stale notification on `kpi.deviation_closed`" in scope for this slice? | **Yes, include it.** | Cheap (same transaction, existing columns) and it materially improves AC7 — a cold reopen must show the *current* state, not a stale "needs attention" that was resolved hours ago. A projection that only ever adds and never resolves would look correct in tests and wrong in the product. |

Everything else in the design below is ratified as written.

---

## 3. Where the dispatcher runs

**In-process interval cron**, new file
`server/src/services/resultsVnext/platform/platformOutboxDrainCron.ts`,
registered in `server/src/index.ts` beside the existing
`startNotificationOutboxDrainCron()`.

This is not a fresh proposal — `RN_G1_PLATFORM_DESIGN.md` §A.5 already
specifies a cron reusing `notificationOutboxService.ts`'s pattern, and
`outboxDrain.ts`'s own header blueprints the env vars
(`RVN_PLATFORM_OUTBOX_DRAIN_INTERVAL_MS` / `_ENABLED`), the
`NODE_ENV==='test'` skip, boot-delay `setTimeout` then `setInterval`, and
swallow-and-log tick errors.

**Structural mirror, different body**: `notificationOutboxService.drainOnce()`
uses `DbPromise` with no `SKIP LOCKED` (single-process assumption, terminal
`FAILED`, no retry). This dispatcher must use `acquirePgClient()` (a pinned
`pg.PoolClient`) because `claimOutboxBatch`/`reclaimExpiredClaims` need real
transactions with `SELECT ... FOR UPDATE SKIP LOCKED`, which `DbPromise`
doesn't expose.

**BullMQ deliberately not used**: real Redis+BullMQ exists (`QueueConfig.ts`,
`aiQueue.ts`/`aiWorker.ts`) but is scoped to AI job processing; none of the 11
files in `server/src/jobs/*` touches anything `rvn_*`. The claim/backoff/
dead-letter mechanics already exist at the SQL level in `outboxDrain.ts` —
BullMQ would duplicate them, not complement them. Settled, not open.

Tick body:
```
BEGIN (acquirePgClient)
  reclaimExpiredClaims(client)                    -- reaper first, same tick
  rows = claimOutboxBatch(client, workerId, 50)   -- workerId = `${hostname}-${pid}`
COMMIT
for each row (sequentially; one row's failure must not abort the batch):
  event = SELECT e.* FROM rvn_platform_outbox o JOIN rvn_platform_events e
          ON e.event_id = o.event_id WHERE o.outbox_id = $1
  if UNBUILT_CONSUMER_GROUPS.has(row.consumer_group):   -- IO-C
      markParked(row, 'CONSUMER_NOT_BUILT'); throttledInfoNotice(row.consumer_group); continue
  consumerFn = CONSUMER_REGISTRY[row.consumer_group]
  if !consumerFn: markFailed(row, 'NO_CONSUMER_REGISTERED', backoff); continue
  try:   BEGIN; consumerFn(client, event, row); COMMIT; markDispatched(row)
  catch: markFailed(row, err.message, backoffSeconds)
         if result.status === 'dead_letter': sendSystemAlert(CRITICAL, throttled per group)
```

Two transactions per row: the claim is already committed by
`claimOutboxBatch`; the consumer's side effects run in their own transaction.
A crash mid-effect rolls back the effects and leaves the row `claimed` until
`reclaimExpiredClaims` resets it (2-minute TTL) — never partially applied.

---

## 4. Consumer registry

New file `server/src/services/resultsVnext/platform/consumerRegistry.ts`:

```ts
export type ConsumerFn = (
  client: PoolClient,
  event: RvnPlatformEventRow,   // full row incl. organization_id, event_type, aggregate_id, payload
  outboxRow: RvnOutboxRow
) => Promise<void>;

export const CONSUMER_REGISTRY: Readonly<Record<string, ConsumerFn>> = {
  mywork_projection: dispatchMyWorkProjection,
};

/** IO-C: live producers, consumer deliberately not built yet.
 *  Rows park instead of dead-lettering. */
export const UNBUILT_CONSUMER_GROUPS: ReadonlySet<string> = new Set([
  'finance_projection',   // 11 live event types, no target read-model identified yet
]);
```

A static map mirrors `EVENT_TYPE_CONSUMER_GROUPS`'s own precedent (ledger §7
decision #4: "statyczna mapa w kodzie… mniej ruchomych części na start"). A new
consumer is added by writing its function and adding one line — the dispatcher
never changes.

`dispatchMyWorkProjection` internally dispatches on `event_type`, because
`payload` is deliberately thin (verified: `kpiDeviationCommands.ts` writes
`payload: { caseId, measurementId }`, never assignee/title/due date). Each
event type must re-query its own domain table.

---

## 5. Idempotency

**New table is the primary guard.** `rvn_platform_obligations.deduplication_key`
is NOT sufficient:
1. Most mywork-routed event types never touch obligations at all.
2. Where they do, the dedup key protects against a duplicate *domain command*,
   not against the *dispatcher redelivering the same outbox row* — a different
   axis at a different layer.
3. The `notifications` INSERT has no natural key whatsoever; a second delivery
   inserts a second row.

```sql
-- server/migrations/<date>_rvn_platform_consumer_processed.sql
CREATE TABLE IF NOT EXISTS rvn_platform_consumer_processed (
  consumer_group  TEXT NOT NULL,
  event_id        UUID NOT NULL REFERENCES rvn_platform_events(event_id),
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_group, event_id)
);
```

Consumer transaction opens with `INSERT ... ON CONFLICT DO NOTHING RETURNING *`.
No row → already processed → COMMIT no-op → `markDispatched` (redelivery under
at-least-once is an expected success, not an error). Row returned → perform the
real writes in the **same** transaction → COMMIT.

Same `ON CONFLICT DO NOTHING` pattern already used twice in this codebase
(`rvn_platform_events.idempotency_key`, `rvn_platform_obligations.deduplication_key`)
— new layer, not a new pattern.

`rvn_platform_projection_checkpoints` is for **replay/rebuild** (§A.6), not
per-row dispatch. Using its coarse `(projection_name, organization_id) →
last_applied_sequence` watermark as the primary guard would be unsafe under
concurrent workers claiming out of sequence order. The consumer should still
advance it (`GREATEST(...)`) as a courtesy for a future rebuild tool, but the
ledger is what makes redelivery safe.

---

## 6. Dead-lettering and alerting

`sendSystemAlert()` from `server/src/services/systemAlertNotifier.ts` — a real,
already-wired channel routing through `routeToSlack()` with built-in
per-key throttling. Used non-AI-specifically already by `securityAlerts.ts`,
`HealthCheckJob.ts`, `AIOpsReportCron.ts`, `alertWatchdog.middleware.ts`.
`outboxDrain.ts`'s `markFailed()` already carries a TODO pointing at exactly
this gap.

```ts
await sendSystemAlert({
  severity: 'CRITICAL',
  source: 'rvn_platform_outbox',
  title: `Outbox row dead-lettered: ${row.consumer_group}`,
  message: `event_id=${event.event_id} event_type=${event.event_type} org=${event.organization_id} attempts=${attempts} last_error=${lastError}`,
  throttleKey: `outbox_dead_letter:${row.consumer_group}`,
  throttleMs: 5 * 60_000,
});
```

Throttled per consumer_group, not per row — a systemic outage produces one
alert per 5 minutes, not one per row. Lives in the cron tick, not inside
`markFailed()`, keeping `outboxDrain.ts` a pure-function module as its header
requires.

**Parked rows (IO-C)** use a separate, INFO-severity, one-per-group-per-hour
notice with `throttleKey: 'outbox_parked:<group>'`. Never CRITICAL.

---

## 7. Multi-tenancy

`rvn_platform_outbox` has **no `organization_id` column** — only `event_id` and
`consumer_group`. The dispatcher must always resolve tenant scope by joining
`rvn_platform_events`. `event.organization_id` is the ONLY source of scope a
consumer may use; every write it performs is parameterized by it.

There is no RLS in this database (0 policies repo-wide), so isolation is
enforced entirely by discipline in application code, same as the rest of the
platform layer.

---

## 8. What `mywork_projection` does

Two writes in one transaction per relevant event:

1. **`v8_canonical_object_states` upsert** — cross-surface canonical truth per
   §C.1 intent. `objectId = event.aggregate_id`, `objectType = event.aggregate_type`,
   `canonicalState` from `RVN_CANONICAL_STATES` (IO-A), `surfaceProjections`
   seeded for `home`/`inbox`.
2. **`notifications` INSERT** for the relevant user — reuses the existing,
   already-shipped `materializeInboxItems` pull path with **zero changes to
   `inboxService.ts`**. Lowest-risk integration and the one genuinely real
   mutation proving the product question.

| Event type | Domain query (payload alone insufficient) | canonicalState | Notification |
|---|---|---|---|
| `kpi.deviation_opened` | `rvn_platform_obligations WHERE reference_id=aggregate_id AND status='open'` → `assignee_user_id`, `due_at` | `needs_attention` | `entity_type='deviation_case'`, assignee from the obligation |
| `roi.case_approved` | `rvn_roi_cases WHERE case_id=aggregate_id` → `owner_user_id` | `approved` | notify owner (also fans to `finance_projection`, parked per IO-C) |
| `okr_support.decision_requested` | `okr_vnext_support_requests` → `assigned_to_user_id` | `needs_attention` | notify assignee |
| `kpi.deviation_closed` | same obligations lookup, `status='completed'`; plus `UPDATE notifications SET is_read=1, read_at=now() WHERE entity_type='deviation_case' AND entity_id=aggregate_id AND is_read=0` | `resolved` | resolves the earlier notification (IO-E) |

---

## 9. Not built in this slice

- **`finance_projection`** — 11 live event types, no target read-model identified. Parked (IO-C). Needs: identify the Finance read model, write the consumer, register it, remove from `UNBUILT_CONSUMER_GROUPS`.
- **`decisions_projection`** — zero producers. `okrDecisionResolutionScanner.ts` already reads `okr_vnext_decision_links` directly, bypassing the outbox. Dead placeholder (IO-B).
- **`notifications_projection`** — zero producers. Distinct from this slice's own `notifications` writes. Dead placeholder (IO-B).

---

## 10. The eight acceptance proofs

Tests follow the `tests/acceptance/outbox-drain.e2e.test.ts` precedent: real
local Postgres via `requireLocalDbUrl()`, raw `pg.Client`, marker-prefixed
fixtures, hard DB-state assertions, `afterAll` cleanup. New file
`tests/acceptance/rvn-outbox-mywork-projection.e2e.test.ts`. Fixtures must call
a **real domain command** (e.g. `openOrEscalateDeviationCase`), never
hand-insert event rows — the test must exercise the true write path.

1. **Atomic event + outbox write.** Call a real command; assert both tables have exactly one matching row. **Negative control**: force `applyMutation` to throw; assert **neither** table has a row (no torn write).
2. **Exactly-once claim under concurrency.** Seed N pending rows; run 5 concurrent `claimOutboxBatch` calls on 5 separate clients via `Promise.all`; assert no duplicate `outbox_id` across the union and that all N are covered.
3. **Real mutation.** Run one tick against a seeded `kpi.deviation_opened`; assert a `v8_canonical_object_states` row with `canonical_state='needs_attention'` AND a `notifications` row for the obligation's assignee.
4. **No duplicate on redelivery.** Run the consumer twice against the same claimed row; assert exactly one notification, one canonical-state row, one `rvn_platform_consumer_processed` row.
5. **Retry with backoff.** Force a throw; assert `next_attempt_at` advances by `backoffSeconds * 2^attempts` and status is `failed`, not `dead_letter`, while `attempts < max_attempts`.
6. **Dead letter + real alert.** Drive `markFailed` to `max_attempts`; assert `status='dead_letter'`; spy `sendSystemAlert` and assert one CRITICAL call for that group. **Additionally (IO-C)**: assert a `finance_projection` row parks with status `parked` and produces an INFO notice, never a CRITICAL alert.
7. **Cold reopen.** After proof 3, call `materializeInboxItems(assigneeUserId, orgId)` fresh; assert `canonical_inbox_items` has the row and `getInboxItems()` returns it. Then run `kpi.deviation_closed` and re-materialize; assert the item is no longer surfaced as unread (IO-E).
8. **Foreign-org isolation.** Seed two orgs with deviation cases sharing the **same literal `aggregate_id`** (a plausible collision — `aggregate_id` is TEXT, not globally unique). Run the dispatcher; assert each org's projection references only its own user/data, and a query for org B never returns org A's state. This is deliberately stronger than "two orgs with different ids" — it specifically catches a consumer that forgot an `organization_id` predicate.

---

## 11. Files

**New**: `platformOutboxDrainCron.ts`, `consumerRegistry.ts`,
`myworkProjectionConsumer.ts`, `<date>_rvn_platform_consumer_processed.sql`,
`tests/acceptance/rvn-outbox-mywork-projection.e2e.test.ts`.

**Changed**: `server/src/index.ts` (cron registration, one line + import),
`outboxDrain.ts` (add `markParked` + the `parked` status, per IO-C — additive
only, existing functions untouched).

---

## 12. Definition of done

- [ ] All eight proofs pass on real Postgres
- [ ] `tsc --noEmit` clean
- [ ] Existing KPI/ROI/OKR suites unaffected (before/after evidence)
- [ ] `RVN_CANONICAL_STATES` exported as a single const, no inline state literals (IO-A)
- [ ] `finance_projection` rows park with an INFO notice, never a CRITICAL dead-letter alert (IO-C)
- [ ] Closure entry records: the `v8` vs `public` schema pre-promotion check (IO-D), the two dead placeholder consumer groups (IO-B), and what `finance_projection` still needs
