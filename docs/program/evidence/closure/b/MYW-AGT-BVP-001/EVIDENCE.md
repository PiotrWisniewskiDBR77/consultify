# MYW-AGT-BVP-001 — honest transformation-chain trace

Executor: Sonnet, closure lane B. Reviewer: Opus. No source file was edited for
this task — it is trace + assessment only, per the task's explicit instruction
not to fix anything.

## Part A — event -> inbox -> decision/task/notebook

### A.1 The packet's assumed chain does not exist as described

The packet assumes: an event creates an inbox item, and the inbox item can be
turned into a decision/task/notebook. The REAL chain is the reverse, and there
is no inbox-to-artifact creation path anywhere in the code.

### A.2 `inbox_items` (the packet's named table) does not exist

```
$ docker exec consultify-closure-b-64f50785 psql -U consultinity -d consultinity \
  -c "select to_regclass('public.inbox_items');"
 to_regclass
-------------
(1 row)
```
NULL, on a schema built from all 703 migrations. `server/migrations/add_mywork_tables.sql`
defines a SQLite-style `inbox_items` table (`INTEGER PRIMARY KEY AUTOINCREMENT`,
etc.) — grepped across `server/src/**`, it has **zero** readers or writers. It
is dead schema, never applied to this database, never consulted by any
service. **STATUS: ABSENT.**

### A.3 The real projection: `canonical_inbox_items`, written by `materializeInboxItems`

`server/src/services/inboxService.ts:124-317` — `materializeInboxItems(userId, orgId)`:
- `195-225`: reads `tasks` (assignee_id = userId, status not in
  done/completed/validated), `decisions` (decision_maker_id = userId, status
  in pending/escalated), and `notifications` (user_id = userId, unread) —
  **three independent SELECTs against pre-existing source-of-truth tables**.
- `153-176`: an `UPSERT ... ON CONFLICT (user_id, source_entity_type,
  source_entity_id)` into `canonical_inbox_items`, keyed by the SOURCE row's
  identity, not by any event.
- `309-317`: the three row sets are upserted in parallel; `upserted` is the
  count actually written.

There is no "event" table or event-bus input anywhere in this function. The
inbox row is a **derived, disposable projection** — re-running
`materializeInboxItems` regenerates it from the same three source tables.
**STATUS: IMPLEMENTED, but INVERTED relative to the packet's assumed
direction.** (Empirically proved end-to-end, not just read from source, in
`MYW-REALDB-FIXTURE-AUTH-001` — 1 task + 1 decision + 1 notification seeded,
`materializeInboxItems` returns `upserted: 3`, all 3 rows read back on a fresh
connection.)

### A.4 Triage actions mutate, never create

`server/src/services/inboxTriageService.ts:52-152` —
`applyInboxTriageSideEffects`, the function every triage action funnels
through (`applyGovernedInboxTriage` at `242-292`, `applyGovernedBulkInboxTriage`
at `294-362`):
- `70-84` (`accept_today`/`accept_week`/`accept_later`): `UPSERT` into
  `my_work_focus_state` — a column assignment, not a new entity.
- `86-100` (`schedule`): `UPDATE tasks SET due_date` / `UPDATE decisions SET
  deadline` — mutates the EXISTING source row.
- `102-136` (`delegate`): `UPDATE tasks SET assignee_id` / `UPDATE decisions
  SET decision_maker_id`, plus a `NotificationService.send()` — mutates the
  existing row and sends a notification; creates no task/decision.
- `138-144` (`archive`/`dismiss` on a notification): `NotificationService.markAsRead`.
- `146-151` (`done` on a task): `UPDATE tasks SET status = 'Completed'`.
- `207-240` (`syncCanonicalInboxState`): calls `inboxService.triageItem`
  (`inboxService.ts:376-421`), which only `UPDATE`s the `canonical_inbox_items`
  row's own `status`/`resolved_at`/`metadata_json` — never an `INSERT`.

No branch inserts into `tasks`, `decisions`, or any notebook/knowledge table.
**STATUS: IMPLEMENTED, confirmed no creation path exists.**

### A.5 AI-assist is advisory text generation, not action execution

`server/src/services/inboxAiAssistService.ts:54-138` — `runInboxAiAssist`
builds a prompt from the item's fields, calls `llmService.call()` with a
structured schema (`InboxAiAssistResponseSchema`, `33-49`: `brief`, `bullets`,
`recommendedAction`, `recommendedReason`), and returns that object. It performs
**zero database writes** — `grep` of the file shows no `queryRun`/`INSERT`/
`UPDATE` at all. The `recommendedAction` is a suggestion string the client may
later pass back into `applyGovernedInboxTriage` as `fromAISuggestion: true` —
the mutation path is still A.4, unchanged. Both HTTP callers
(`server/src/routes/v8/my-work.routes.ts:892-921`,
`server/src/routes/my-work.routes.ts:8619`) are thin pass-throughs with no
additional side effects around the call. **STATUS: IMPLEMENTED as designed
(advisory only) — never creates a task/decision/notebook.**

### A.6 Honest summary of Part A

| Packet's assumed step | Reality | Status |
|---|---|---|
| event -> inbox item | `tasks`/`decisions`/`notifications` -> `canonical_inbox_items` (reverse direction) | IMPLEMENTED, INVERTED |
| inbox item -> decision/task/notebook | Does not exist. Triage mutates the SAME source row or a focus-state row; nothing is created. | ABSENT |
| `inbox_items` as the owner table | Dead SQLite-style table, zero readers/writers | ABSENT |

## Part B — conversation -> transformation case/plan

### B.1 What actually happens

There is no NLP/summarization step that reads a conversation transcript and
derives a mandate, outcomes, or a plan. What exists is a manual, structured
**planning intake** form that can optionally carry a `conversationId` tag:

1. `POST /planning-intakes` (`server/src/routes/v8/transformation-cases.routes.ts:126-166`)
   — `body.mandate`, `body.measurableOutcomes`, `body.sponsor`, `body.scope`,
   `body.horizon` are literal client-supplied fields (`145-155`);
   `body.conversationId` (`151`) is passed through unchanged and unvalidated.
   Calls `startPlanningIntake` (`transformationPlanningIntakeService.ts:61-74`),
   which computes `missingKeys` via `planningMissingKeys` (`40-45`) and sets
   `status: 'needs_clarification' | 'ready'`.
2. `PATCH /planning-intakes/:id` -> `answerPlanningIntake`
   (`transformationPlanningIntakeService.ts:75-83`) lets the actor fill in the
   missing fields.
3. `POST /planning-intakes/:id/convert` -> `convertPlanningIntake`
   (`transformationPlanningIntakeService.ts:84-92`) — once `status === 'ready'`
   — calls the REAL `createTransformationCase()`
   (`transformationCaseService.ts:1173`), passing `mandate`/`desiredOutcomes`/
   `conversationId` straight through (`88`, `conversationId:current.conversation_id`).
4. `createTransformationCase` (`1173-1418`) inserts `transformation_cases`
   (`1212-1239`), `v8_context_snapshots` (`1240-1261`), `v8_execution_runs`
   (`1262-1277`), `v8_agent_run_identities` (`1278-1289`),
   `v8_run_state_transitions` (`1290-1295`), `transformation_plans`
   (`1296-1314`), and `transformation_plan_steps` for every step returned by
   `compileT01TransformationPlan()`.

### B.2 The plan is a fixed template, not conversation-derived content

`compileT01TransformationPlan()` (`transformationCaseService.ts:915-921`)
returns `T01_PLAN_BLUEPRINT.map(...)` — a **hard-coded, static array**
(defined above it in the same file) of lifecycle stages (mandate, initial
ideas, interviews, DRD, opportunity synthesis, initiative candidates, finance
KPI, portfolio decision, mobilization, execution, delivery, benefits,
sustainability, final outputs). It takes **no argument** — the mandate,
outcomes, and any conversation content have zero influence on the plan's
shape; every Transformation Case gets the identical canned blueprint. Several
of its own step entries self-report `capabilityStatus: 'NOT_CONNECTED'` with a
literal `blockerReason` (e.g. `915` block, lines ~830-912): *"Initiative-to-
Execution transformation handoff is not connected"*, *"No Transformation Case
event subscription exists"*, *"Delivery-to-benefits transformation gate is not
connected"*, *"Benefits services exist but are not linked to Transformation
Case"*, *"Sustainability lifecycle and learning promotion are not connected"*,
*"Output runtimes exist but T01 snapshot adapters are not connected"* — the
code's own comments document that most of the LATER lifecycle stages are
scaffolded but not wired to their target modules.

A second path, `startPlanningIntakeFromTemplate` / `convertTemplatePlanningIntake`
(`transformationPlanningIntakeService.ts:96-170`), pulls
`graph.planningBlueprint.steps` from a stored, versioned, PUBLISHED
`ai_playbook_templates` row instead of the hard-coded blueprint — pre-authored
and pinned by content digest, still not derived live from a conversation.

### B.3 `conversationId` is an unchecked tag, not a verified link

```
$ docker exec consultify-closure-b-64f50785 psql -U consultinity -d consultinity -c "
SELECT conrelid::regclass, conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'transformation_cases'::regclass AND contype='f';"
       conrelid       |               conname                |                       pg_get_constraintdef
-----------------------+--------------------------------------+-------------------------------------------------
 transformation_cases | transformation_cases_active_plan_fk  | FOREIGN KEY (active_plan_id) REFERENCES transformation_plans(plan_id) ...
(1 row)
```
No FK from `transformation_cases.conversation_id` to `conversations.id`. The
value is carried through purely as a free-text cross-reference for later
audit/lineage; nothing validates it points at a real conversation, and no code
path reads the conversation's messages to populate the case.

### B.4 Honest summary of Part B

| Packet's assumed step | Reality | Status |
|---|---|---|
| conversation content -> mandate/outcomes | Manual form fields (`body.mandate` etc.), `conversationId` is an optional unchecked tag | IMPLEMENTED as a manual intake, NOT conversation-derived |
| conversation -> generated plan | `compileT01TransformationPlan()` is a static, hard-coded blueprint — identical for every case | IMPLEMENTED, but STUB relative to "derived from conversation" |
| later lifecycle stages (execution/delivery/benefits/sustainability/final_outputs) reaching their target modules | Explicitly self-reported `NOT_CONNECTED` in the blueprint's own `blockerReason` fields | STUB / NOT_CONNECTED, by the code's own admission |

## Part C — `transformation_cases` structural claims

All verified against the live, 703-migration database
(`docker exec consultify-closure-b-64f50785 psql`) and the source.

- **Stable IDs**: `transformation_case_id text NOT NULL` is the primary key
  (`transformation_cases_pkey`), generated once via `uuidv4()` at
  `createTransformationCase` (`transformationCaseService.ts:1186`) and never
  reassigned. CONFIRMED.
- **Tenant scoping**: every mutation function's `SELECT ... FOR UPDATE` and
  final `UPDATE` carries `AND organization_id = ?` (verified across all 29
  functions listed in Part D). CONFIRMED.
- **`idempotency_key` + `UNIQUE(organization_id, idempotency_key)`**:
  ```
  $ docker exec ... psql -c "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
    WHERE conrelid = 'transformation_cases'::regclass AND contype IN ('u','p');"
                   conname                 |           pg_get_constraintdef
  -----------------------------------------+-------------------------------------------
   transformation_cases_org_idempotency_uq | UNIQUE (organization_id, idempotency_key)
   transformation_cases_pkey               | PRIMARY KEY (transformation_case_id)
  (2 rows)
  ```
  CONFIRMED — matches `createTransformationCase`'s replay logic
  (`1177-1184`, `1206-1210`, `1390-1398`: catches Postgres `23505` and reads
  back the existing row by `(organization_id, idempotency_key)`).

## Part D — the reported "inconsistent CAS" — confirmed as SYNTAX, refuted as a LOST-UPDATE bug

The packet named two "guarded" sites (`~1699`, `~2128`) and six "unguarded"
sites (`~1358`, `~1483`, `~1788`, `~2250`, `~2263`, `~2619`). Every one of
these eight line numbers was read in context; six of the eight numbers were
off by small amounts from actual line numbers on this SHA (file drift), but
each maps unambiguously to one call site. Verdict per site:

| Cited line | Actual site | Final `UPDATE` repeats `AND version = ?` | Preceded in the SAME transaction by `SELECT ... FOR UPDATE` on the case row | Preceded by explicit `if (current.version !== expectedVersion) throw 409` | Real lost-update risk |
|---|---|---|---|---|---|
| ~1358 | `createTransformationCase`, `1356` (`UPDATE transformation_cases SET active_plan_id = ? WHERE transformation_case_id = ?`) | No, and no `organization_id` predicate either | N/A — row was `INSERT`ed two statements earlier in the SAME transaction (`1212-1239`) | N/A | **NONE** — no other transaction can see or lock a row not yet committed |
| ~1483 | `bindTransformationCaseProject`, `1480-1484` | No | Yes (`1446-1450`) | **No `expectedVersion` param exists on this function at all** | Low — lock prevents lost updates, but the API cannot express/detect a caller's stale read (design gap, not corruption) |
| ~1699 (packet: "guarded") | `reviseTransformationCase`, `1695-1699` | **Yes** | Yes (implicit — same function holds the row via the earlier read; see `1608`) | Yes (`1608`) | None — belt-and-braces (double-guarded) |
| ~1788 | `cancelTransformationCase`, `1784-1789` | No | Yes (`1762-1766`, `FOR UPDATE`) | Yes (`1775`) | **NONE** — lock + explicit check already ran before this statement |
| ~2128 (packet: "guarded") | `approveTransformationPlan`, `1984-1988` | **Yes** | Yes (`1936-1940`) | Yes (`1949`) | None — belt-and-braces |
| ~2250 | `reviewInitialIdeasProposal` reject-branch, `2247-2250` | No | Yes (`2164-2168`) | Yes (`2192`, incl. `resumableApproval` widening for idempotent re-approval) | **NONE** |
| ~2263 | `reviewInitialIdeasProposal` approve-branch, `2259-2262` | No | Yes (`2164-2168`) | Yes (`2192`) | **NONE** |
| ~2619 | `proposeInterviews`, `2616-2619` | No | Yes (`2503-2507`) | Yes (`2516`) | **NONE** |

A structural scan of the whole file (every function containing `UPDATE
transformation_cases`, run against this exact SHA) found **29 such functions**,
and **every one** contains a `FOR UPDATE` row-lock on the case row before its
mutation, and **32 occurrences** of the explicit
`if (current.version !== input.expectedVersion) throw 409` pattern spread
across them (some functions check twice — once for the primary path, once via
a `resumableApproval` widening for idempotent proposal re-approval). Postgres
`FOR UPDATE` under the connection's default READ COMMITTED isolation
(`server/src/utils/queryHelpers.ts:225-261` opens `BEGIN`/`COMMIT`/`ROLLBACK`
with no explicit `SET TRANSACTION ISOLATION LEVEL`, so it is READ COMMITTED)
blocks a second transaction's `SELECT ... FOR UPDATE` on the same row until
the first commits, then hands back the FIRST transaction's committed values —
so a genuinely stale caller's `expectedVersion` check downstream of the lock
correctly observes the post-commit version and throws `409`. This is a
standard, functionally-correct optimistic-concurrency-via-pessimistic-lock
pattern, not a race.

**Refutation of "CAS is inconsistent -> concurrency risk":** the SQL-syntax
inconsistency is real (some final `UPDATE`s redundantly repeat
`AND version = ?`, most don't) but it is cosmetic. The actual concurrency
guarantee comes from the `SELECT ... FOR UPDATE` + explicit version check that
precedes essentially every mutation, and that guarantee is present and
consistent. The one genuine (minor) gap is `bindTransformationCaseProject`
never accepting an `expectedVersion` from its caller — it cannot corrupt data
(the lock still serializes writers) but it cannot report a 409 to a caller
whose read was stale, unlike every other mutation in the file. `createTransformationCase`'s
apparently-unguarded `UPDATE` at `1356` is not a gap at all: it finishes
constructing a row this same transaction just inserted, which by definition no
other transaction can be racing.

## Decision packet — fix surface and lease membership

Checked with the command the task specified:
```
jq -r '.files[]' docs/cleanup/agents/generated/CLAUDE_LANE_B_PATH_LEASE.json | grep -qxF "<path>"
```

| File | In lane-B lease? | Recommended action, if any |
|---|---|---|
| `server/src/services/v8/transformationCaseService.ts` | **YES** | No fix required — CAS is functionally sound (Part D). If the team wants defense-in-depth for style consistency, adding `AND version = ?` to the six "unguarded-looking" `UPDATE`s and adding an `expectedVersion` parameter to `bindTransformationCaseProject` are both LOW-priority, in-lease cleanups. Not performed here per this task's explicit no-fix instruction. |
| `server/src/services/inboxService.ts` | NO | No fix identified — ownership scoping (`triageItem`) and the read/write projection direction both work as designed and are proved in `MYW-REALDB-FIXTURE-AUTH-001`. |
| `server/src/services/inboxTriageService.ts` | NO | No fix identified. |
| `server/src/services/inboxAiAssistService.ts` | NO | No fix identified. |
| `server/src/services/v8/transformationPlanningIntakeService.ts` | NO | No fix identified in-file; if the product intent is genuinely "derive mandate/plan from a conversation," that is a NEW feature (LLM extraction step), not a bug fix, and its natural home is this file plus `transformationCaseService.ts`'s `compileT01TransformationPlan` — the former is out-of-lease for lane B, the latter is in-lease. |
| `server/src/routes/v8/transformation-cases.routes.ts` | YES | No fix identified — thin, correct pass-through. |
| `server/src/routes/v8/my-work.routes.ts` | YES | No fix identified — thin, correct pass-through. |
| `server/migrations/add_mywork_tables.sql` | YES | Dead file (defines the never-applied `inbox_items`). Deletion/quarantine is in-lease for lane B if the team wants to act on it; not performed here (out of this task's no-fix scope). |

**Everything named above that IS in-lease is still NOT fixed here**, per the
task's explicit instruction that this task produces evidence and a decision
packet only. No source file was modified while producing this evidence.

## Open items

- The one real (minor) gap found — `bindTransformationCaseProject` has no
  `expectedVersion` parameter — is unfixed. Low severity: the row lock already
  prevents lost updates; the gap is only that a stale-read caller cannot be
  told so via a `409`.
- Whether product intent actually wants an LLM-driven "conversation ->
  mandate/plan" extraction step is a product question, not something this
  trace can resolve from code alone; flagged in the decision packet above as a
  new-feature question, not a defect.
- `server/migrations/add_mywork_tables.sql`'s dead `inbox_items` definition is
  unresolved (neither deleted nor documented as intentionally legacy) —
  flagged for the team, not touched here.
