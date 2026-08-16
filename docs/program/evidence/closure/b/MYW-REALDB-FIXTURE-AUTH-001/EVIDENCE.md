# MYW-REALDB-FIXTURE-AUTH-001 — evidence

Executor: Sonnet, closure lane B. Reviewer: Opus.
Test file: `server/src/services/myWork/__tests__/myw-realdb-fixture-auth-001.pg.test.ts`
(moved from the originally-instructed `server/src/services/__tests__/...` after the
lease verifier rejected that directory — see "Path correction" below).

## Two packet claims verified first (both CONFIRMED)

1. **`inbox_items` does not exist.**
   ```
   $ docker exec consultify-closure-b-64f50785 psql -U consultinity -d consultinity -c \
     "select to_regclass('public.inbox_items') as inbox_items, \
             to_regclass('public.canonical_inbox_items') as canonical_inbox_items, \
             to_regclass('public.ai_inbox') as ai_inbox, \
             to_regclass('public.v8_inbox_materializations') as v8_inbox_materializations, \
             to_regclass('public.transformation_cases') as transformation_cases;"

    inbox_items | canonical_inbox_items | ai_inbox | v8_inbox_materializations | transformation_cases
   -------------+-----------------------+----------+---------------------------+----------------------
                | canonical_inbox_items | ai_inbox | v8_inbox_materializations | transformation_cases
   (1 row)
   ```
   `inbox_items` is NULL on a schema built from all 703 migrations. The REAL
   projection is `canonical_inbox_items`, confirmed present. This fixture
   therefore targets `canonical_inbox_items`, not the packet's assumed table.

2. **Data flow is inverted from "event -> inbox item -> decision/task/notebook".**
   `server/src/services/inboxService.ts:124-317` (`materializeInboxItems`) reads
   FROM `tasks`/`decisions`/`notifications` and writes `canonical_inbox_items` —
   confirmed by reading the function body directly. Full trace with per-line
   citations is in `../MYW-AGT-BVP-001/EVIDENCE.md`.

Consequently the "governed positive fixture" is built the way production
actually builds it: seed the three source tables, then call the REAL exported
`materializeInboxItems()` to project them — not a hand-rolled INSERT into
`canonical_inbox_items`.

## Fixture identity (stable, `claude_b_`-prefixed, recorded)

| Role | ID |
|---|---|
| Owner org | `claude_b_org_auth001` |
| Other-tenant org | `claude_b_org_auth001_other` |
| Project (owner org) | `claude_b_project_auth001` |
| Owning actor | `claude_b_actor_owner_auth001` |
| Other-tenant actor | `claude_b_actor_other_auth001` |
| Source task | `claude_b_task_auth001` |
| Source decision | `claude_b_decision_auth001` |
| Source notification | `claude_b_notification_auth001` |

IDs are literal (not `randomUUID()`-suffixed) so the fixture is idempotently
re-runnable: `beforeAll` pre-cleans any leftover rows under these exact IDs
before seeding (same statements as `afterAll`'s teardown), which was proved by
running the suite twice in a row (both green, see "Command log" below).

## What is proved, and how

1. **Real production write path.** `materializeInboxItems(OWNER_USER_ID, ORG_ID)`
   (the actual exported function, not a mock) is called after seeding one task,
   one decision, one unread notification. `upserted === 3` is asserted, then a
   **brand-new, independent `pg.Client`** (opened fresh, used once, closed) reads
   `canonical_inbox_items` back and confirms all 3 rows, each with the section /
   item_type / status the real `sectionForTask` / itemType-mapping logic
   produces (`assigned_tasks`/`task`, `decisions_required`/`decision`,
   `fyi_system`/`signal`).
2. **Ownership.** The real `getInboxItems(OWNER_USER_ID, ORG_ID)` returns all 3
   rows, every row's `organizationId`/`userId` matching the owner.
3. **Cross-tenant negative control (read).** The real
   `getInboxItems(OTHER_USER_ID, ORG_ID_OTHER)` — a different actor in a
   different org — returns **0** rows. A raw count query against
   `canonical_inbox_items WHERE organization_id = 'claude_b_org_auth001_other'`
   independently confirms **0**.
4. **Cross-tenant negative control (write).** The real
   `triageItem(ownerItemId, 'done', undefined, {userId: OTHER_USER_ID,
   organizationId: ORG_ID_OTHER})` — exercising the ownership predicate
   documented at `inboxService.ts:361-375` — returns **`null`**, and a fresh-
   connection read proves the owner's row is still `status = 'pending'`
   (physically unchanged, not just a null return value). A positive control
   immediately after (owner calling `triageItem` on their own item) succeeds
   and the row reads back `resolved` on yet another fresh connection — proving
   the scope check discriminates rather than always failing closed.
5. **Cold readback.** Every assertion above that reads back state does so via
   `freshRead()`, which opens a brand-new `pg.Client` per call, independent of
   both (a) the app's own connection pool that `materializeInboxItems`/
   `triageItem` write through, and (b) this file's own fixture-setup `pg.Pool`.
6. **Cleanup.** `afterAll` deletes every row this file created, in FK-safe
   order (`canonical_inbox_items` carries no FK at all — confirmed via
   `\d canonical_inbox_items`, so nothing cascades it away and it is deleted
   explicitly first). `finalResidualRowCount` in the printed evidence block is
   `0`, and an independent `docker exec psql` count query after the run
   (below) confirms it from outside the test process entirely.

## Command log (real output)

Gate command (as specified in the task):
```
export DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:55811/consultinity"
export NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false
cd server && npx vitest run src/services/myWork/__tests__/myw-realdb-fixture-auth-001.pg.test.ts \
  --config vitest.config.ts --retry=0
```
Result (first run):
```
 Test Files  1 passed (1)
      Tests  5 passed (5)
```
Evidence block printed by the suite:
```json
{
  "gate": "REQUIRED (fail-closed)",
  "connectionTarget": "postgresql://consultinity:***@127.0.0.1:55811/consultinity",
  "materializedUpserted": 3,
  "ownerRowsViaGetInboxItems": 3,
  "ownerRowsColdReadback": 3,
  "otherOrgRowsViaGetInboxItems": 0,
  "otherOrgRowsRawCount": 0,
  "crossTenantTriageResult": null,
  "ownerItemStatusAfterCrossTenantAttempt": "pending",
  "ownerTriageByOwnerResult": "resolved",
  "finalResidualRowCount": 0
}
```
Re-run immediately after (idempotency proof): `5 passed`, exit 0, same evidence
shape.

Negative controls (both fired deliberately to prove the gate is real, not
decorative):
- unset `DATABASE_URL`/`RUN_DB_TESTS`/`MOCK_DB` -> `5 skipped`, no failure
  (legal skip path — nothing was promised).
- `RUN_DB_TESTS=1 MOCK_DB=true` (i.e. RUN_DB_TESTS set but MOCK_DB not exactly
  `false`) -> suite FAILS with
  `FAIL-CLOSED: RUN_DB_TESTS demanded a real PostgreSQL ... reason: MOCK_DB
  must be exactly "false" when RUN_DB_TESTS is set` — proving a database was
  promised-but-not-honestly-available is a hard failure, never a silent pass.

Independent verification outside the test process entirely (after the final
run of the suite):
```
$ docker exec consultify-closure-b-64f50785 psql -U consultinity -d consultinity -c "
SELECT
 (SELECT count(*) FROM canonical_inbox_items WHERE organization_id IN ('claude_b_org_auth001','claude_b_org_auth001_other')) AS inbox,
 (SELECT count(*) FROM tasks WHERE id='claude_b_task_auth001') AS tasks,
 (SELECT count(*) FROM decisions WHERE id='claude_b_decision_auth001') AS decisions,
 (SELECT count(*) FROM notifications WHERE id='claude_b_notification_auth001') AS notifications,
 (SELECT count(*) FROM projects WHERE id='claude_b_project_auth001') AS projects,
 (SELECT count(*) FROM users WHERE id IN ('claude_b_actor_owner_auth001','claude_b_actor_other_auth001')) AS users,
 (SELECT count(*) FROM organizations WHERE id IN ('claude_b_org_auth001','claude_b_org_auth001_other')) AS orgs;
"
 inbox | tasks | decisions | notifications | projects | users | orgs
-------+-------+-----------+---------------+----------+-------+------
     0 |     0 |         0 |             0 |        0 |     0 |    0
(1 row)
```
Zero residue confirmed, from outside the fixture's own process.

## Path correction (coordinator-directed)

The task's HARD RULES named the file's path as
`server/src/services/__tests__/myw-realdb-fixture-auth-001.pg.test.ts`. After
first writing and passing the suite there,
`node scripts/cleanup/verify-closure-lane.mjs b closure-execution-baseline-v2-20260816`
reported a lease violation: for lane B, the verifier's `allowedNewRoots` regex
only permits **new** files under
`server/src/(controllers|routes|services)/(caseWorkspace|myWork|initiative|execution|inbox|task|decision)[^/]*/`
— the path segment immediately after `services/` must itself start with one of
those keywords. `services/__tests__/` does not match (the segment is
`__tests__`, not a keyword-prefixed directory), so a brand-new file placed
there is flagged as out-of-lease even though its content is squarely My Work
inbox testing.

Per the coordinator's explicit direction, the file was moved to
`server/src/services/myWork/__tests__/myw-realdb-fixture-auth-001.pg.test.ts`,
its relative import fixed (`'../inboxService.js'` -> `'../../inboxService.js'`
for the extra directory level), the suite re-run (still `5 passed`), and the
verifier re-run:
```
$ node scripts/cleanup/verify-closure-lane.mjs b closure-execution-baseline-v2-20260816
lane B lease PASS: 11 changed paths; manifest f4d75f0aed94f2e34acaec63d91c245495e7e0f658aa36d1122342c2acecc612
```
PASS confirmed. No existing source file was edited to achieve this — only the
new test file's own location and its own import line changed.
