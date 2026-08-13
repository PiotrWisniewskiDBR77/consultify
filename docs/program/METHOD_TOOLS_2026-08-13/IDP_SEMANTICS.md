# IDP_SEMANTICS.md — Tools promotion idempotency, grounded in code

Agent B / worktree `wt-idem`, branch `codex/tools-wt-idem-20260813`, base `0b71985761`.

This is TASK 1 of the C15/C16 close-out: the semantics MUST be nailed down before any
constraint is designed. Everything below is cited to `file:line` on the base commit; nothing
here is inferred from docs or naming — it is read from the actual runtime code.

The base commit already carries a FAZA 0 characterization suite,
`tests/integration/tools-promote-characterization.realdb.test.ts`, which named the exact gaps
this task is asked to close (`C14`, `C15`, `C16`). That file is the ground truth for "what is
true today"; this document explains *why* it is true and what a fix must not break.

---

## 1. What `batch_id` means today

`tool_initiative_links` is used by **two independent write paths** that share one column and
mean two different things by it. This is the single most important fact for constraint design —
a naive `UNIQUE(tool_session_id, batch_id)` would break path B.

### Path A — bulk "generate initiatives from tool session"
`ToolController.generateInitiatives` (body around
`server/src/controllers/ToolController.ts:1706-1892`) creates a **fresh `uuidv4()`**
`batchId` (`ToolController.ts:1735`), persists it as the PK of `tool_initiative_batches`
(`ToolController.ts:1737-1742`), then calls
`ToolInitiativeService.persistInitiatives()` which loops over N generated initiatives and
inserts **one `tool_initiative_links` row per initiative, all sharing that same `batch_id`**
(`server/src/services/ToolInitiativeService.ts:316-321`). So for this path:
`batch_id` = "the generation run", and **one `batch_id` legitimately maps to MANY
`tool_initiative_links` rows** (one per generated initiative). Its own idempotency guard is a
separate check against `tool_initiative_batches` keyed on
`(tool_session_id, methodology_id, initiatives_count)`
(`ToolController.ts:1707-1715`) — a re-submit of the exact same generation request returns the
existing batch's initiatives (`ToolController.ts:1717-1732`) rather than re-inserting.

### Path B — single "promote session to an output"
`ToolController.promoteToOutput` (`ToolController.ts:2052-2352`) builds
`batch_id = \`promote-${outputType}\`` (`ToolController.ts:2110`) — a **deterministic, non-random
string** that depends only on the requested `outputType`, not on the request body, not on a
client-supplied token, not on time. For this path: `batch_id` = "the promotion of this session to
this output type", and the code's *intent* is exactly one `tool_initiative_links` row per
`(tool_session_id, batch_id)` pair — enforced today only by a **SELECT-then-INSERT** check
(`ToolController.ts:2111-2140`), not by the database.

**Consequence for the constraint:** any new uniqueness rule must be scoped so it only applies to
Path B's one-row-per-promotion semantics. It must not fire against Path A's
many-rows-same-`batch_id` inserts. See §7.

### Schema
`tool_initiative_links` (`ToolController.ts:461-468`): `id, tool_session_id, batch_id,
initiative_id, created_at`. `batch_id` is `NOT NULL` but there is no `UNIQUE` on it or on any
pair including it — only non-unique `idx_tool_links_session` and `idx_tool_links_batch`
(`ToolController.ts:521-525`). This is exactly what the FAZA 0 test `C15` asserts
(`tests/integration/tools-promote-characterization.realdb.test.ts:311-327`).

---

## 2. What an `Idempotency-Key` header would mean — and does anything read one today

**Nothing reads an `Idempotency-Key` HTTP header anywhere in this codebase.** Grepped
`server/src` for `Idempotency-Key` (header casing) — zero matches.

The codebase does have an established **body-field** convention, `idempotencyKey` (camelCase,
JSON body, not a header), used by several `InitiativeController`/`TaskController` write
endpoints, e.g. milestone creation (`server/src/controllers/InitiativeController.ts:3271-3397`)
and gate creation (`InitiativeController.ts:3775-3900`): client may pass `idempotencyKey` in the
POST body; server does a pre-insert SELECT on `(parent_id, idempotency_key)`, and on a `23505`
unique-violation race falls back to re-selecting the row that won
(`InitiativeController.ts:3376-3396`). That pattern does **not** exist on the Tools promotion
path — `ToolController.promoteToOutput` reads only `{ outputType, title, description,
selectedSections }` from the body (`ToolController.ts:2061`); there is no `idempotencyKey` field,
and the frontend client `promoteToolOutput()` (`src/services/api.ts:7080-7095`) does not send one
either — its payload type is exactly `{outputType, title, description?, selectedSections?}`.

So today, "idempotency" on the promotion path is **entirely implicit**: the server derives its
own deduplication key (`promote-${outputType}`) from the request, and the client has no way to
express "this is a deliberate second, different promotion of the same type" vs. "this is an
accidental retry" — they collapse to the same key either way.

**Design consequence (carried into Task 2):** because nothing client-side supplies a key today, a
new `idempotency_key` column must be **server-derived by default** (so existing callers keep
working unmodified) but should accept an optional client-supplied `idempotencyKey` body field for
future callers that want finer control (matching the existing convention elsewhere in the code,
just relocated from an HTTP header to a body field to match house style). Because the promotion
endpoint's whole purpose is dedup, the derived key must **never be NULL** on this path — see the
NULL section below and the "endpoint that requires idempotency" requirement.

---

## 3. Does a batch cover ONE output type or many

**One.** `outputType` is validated against a 4-item allow-list (`ToolController.ts:2072-2078`:
`initiative | report | presentation | idea`), and it is baked directly into the batch id string
(`promote-${outputType}`, `ToolController.ts:2110`). A single call promotes to exactly one output
type. There is no "promote to report AND presentation in one call" — the frontend also only ever
sends a single `outputType` per call (`src/services/api.ts:7082-7087`).

Promoting the **same session** to a **different** `outputType` is expected and already supported:
each `outputType` gets its own `promote-${outputType}` batch id, so `initiative` and `report`
promotions of the same session coexist as two different `tool_initiative_links` rows
(different `batch_id` values) — this is the "a different output_type may coexist in the same
[session/]batch" requirement in Task 2, and it already works today by construction. The
constraint must preserve this, not "fix" it away.

---

## 4. NULL behaviour today

- `tool_initiative_links.batch_id` is `NOT NULL` at the column level (`ToolController.ts:464`) —
  every existing row has a real batch id, no legacy NULLs to worry about for that column.
- There is **no `organization_id` column** on `tool_initiative_links` at all yet
  (`ToolController.ts:461-468`) — this is FAZA 0's `C14` finding
  (`tools-promote-characterization.realdb.test.ts:296-309`). Tenant scoping today is **indirect**,
  via `tool_session_id` joining to `tool_sessions.organization_id`
  (`tools-promote-characterization.realdb.test.ts:276-292`, comment: "UWAGA:
  `tool_initiative_links` NIE ma kolumny organization_id").
- There is no `idempotency_key`, `output_type`, `source_revision`, or `payload_hash` column
  today — none of these exist; they are all new in Task 2.
- Elsewhere in this codebase, the established pattern for an *optional* idempotency key is a
  **partial unique index** that only fires `WHERE idempotency_key IS NOT NULL`, e.g.
  `946_tool_outputs_reports_lineage.sql:211-213`
  (`uq_tool_session_events_idempotency ON tool_session_events (tool_session_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL`) with the comment "NULL nie koliduje w UNIQUE" (NULL doesn't
  collide in UNIQUE). That is the right shape for a table where idempotency is *optional per
  event type*. **It is the wrong shape for the promotion endpoint**, because promotion is not
  optionally-idempotent — every promotion call needs protection. If the new `idempotency_key`
  column were allowed to be NULL on rows written by `promoteToOutput`, two concurrent identical
  promotions could both write NULL and the partial index would silently let both through —
  "NULL must not silently disable protection on an endpoint that requires idempotency" (Task 2's
  own wording). The fix: on the promotion write path, the key is **always** computed server-side
  (default `promote:${outputType}`, or the caller's `idempotencyKey` if supplied) — it is never
  omitted, so the column can be `NOT NULL` for this table with a safe backfill, and the partial
  index NULL-bypass pattern from migration 946 is deliberately **not** reused here.

---

## 5. Source revision (`tool_sessions.version`) involvement — currently NONE, even though the data exists

`tool_sessions.version` is a real, populated column — added by
`server/migrations/942_ideas_collaboration_tool_sessions.sql:94`
(`INTEGER NOT NULL DEFAULT 1`) and again defensively by
`server/migrations/20260802_swot_proposals.sql:19`, documented there as "the optimistic-
concurrency guard for the session's answers" (`20260802_swot_proposals.sql:9`). It is actively
used as a CAS token elsewhere in `ToolController.ts` (e.g. the SWOT-proposal-accept path,
`ToolController.ts:2900-3068`, `WHERE id = ? AND organization_id = ? AND version = ?`).

`promoteToOutput` does `SELECT * FROM tool_sessions WHERE id = ? AND organization_id = ?`
(`ToolController.ts:2080-2083`) — so `session.version` **is present on the row it already has in
memory** — but then two lines later it does:

```ts
const sourceVersion = 1;   // ToolController.ts:2143 — hardcoded, ignores session.version
```

and threads that hardcoded `1` into `toolTrace.source_version` (`ToolController.ts:2144-2151`)
and into the JSON response (`ToolController.ts:2347`). This is a "the fix already exists in the
row you fetched, it's just not read" gap, same shape as several prior findings in this codebase
(MEMORY: "rozwiązanie istniało a brakowało odczytu"). **It means today's promotion has no real
revision tracking at all** — if a session is edited (bumping `version`) after being promoted, and
promoted again, the second promotion is treated as identical to the first by the existing dedup
check (which only looks at `tool_session_id` + `batch_id`, not version) and returns the **stale**
first promotion (`ToolController.ts:2119-2140`), silently hiding the edit.

**Task 2 must fix this as part of closing C15**, not just add a constraint around the bug: the
new `source_revision` column should be populated from the real `session.version` already in
scope, not from a new hardcoded constant.

---

## 6. Retry after timeout

There is no timeout wrapper around `promoteToOutput`'s own body (unlike
`ToolInitiativeService.generateFromSession`, which does have an explicit `withTimeout()` around
the AI call — `ToolInitiativeService.ts:45-64, 212-224` — but that's a *different* endpoint, the
bulk-generate one). If a client times out waiting for `promoteToOutput` and retries with the same
`outputType`+`title`, today's behavior depends entirely on how far the first request got:

- If the first request's `INSERT INTO tool_initiative_links` (`ToolController.ts:2329-2333`) had
  already committed before the client gave up, the retry's SELECT-then-INSERT dedup check
  (`ToolController.ts:2111-2140`) finds it and returns the existing output —
  `deduplicated: true`. Safe.
- If the first request had **not yet reached that INSERT** (e.g. still inside `ReportBuilderService
  .createReport()`, `ToolController.ts:2224-2238`, or the presentation/idea inserts,
  `ToolController.ts:2270-2321`) when the client gave up and retried, the retry's SELECT finds
  nothing and proceeds to create a **second** report/presentation/idea/initiative. This is exactly
  the race the FAZA 0 test `C16` characterizes with 4 concurrent identical requests
  (`tools-promote-characterization.realdb.test.ts:329-370`) — timeout-retry is just the two-request
  version of the same race, spread out in time instead of concurrent.

## 7. Retry after partial success

Because the side-effect creation (report/presentation/idea/initiative rows,
`ToolController.ts:2153-2321`) happens **before** the traceability
`INSERT INTO tool_initiative_links` that the dedup check relies on
(`ToolController.ts:2329-2333`), a crash or error **between** those two points leaves an orphan
output with no idempotency record. Concretely: for `outputType: 'report'`,
`ReportBuilderService.createReport()` fully commits a new `report_builder_reports` row and its
sections (`ToolController.ts:2224-2267`) — if the process dies before line 2329-2333 runs, that
report is real, has an id, is queryable — but the *next* promotion attempt has no way to find it
(the only lookup key, `tool_initiative_links`, has no row for it), so it silently creates a
**second, independent report**. This is a genuine partial-success gap in the current code, not
just a benign "retry is safe" story — Task 2's constraint doesn't fully solve this (the insert
order would need to change too, out of scope here), but it *does* stop the more common failure
mode: two genuinely concurrent full requests racing the SELECT-then-INSERT window.

## 8. Expected response for the SAME key with a DIFFERENT payload

**Not distinguished at all today.** The dedup check
(`ToolController.ts:2111-2140`) only matches on `(tool_session_id, batch_id)` — it does not
compare `title`, `description`, or `selectedSections` between the original and the retry. So
calling `promote` twice with `outputType: 'report', title: 'A'` and then
`outputType: 'report', title: 'B'` returns the **same** report id both times, silently discarding
`title: 'B'` and reporting `deduplicated: true` (`ToolController.ts:2130-2139`) with the *original*
`title` in the echoed response body, not the caller's new one. This is silently wrong, not merely
permissive — Task 2 requires this to become a `409` instead (payload-hash mismatch on the same
key), which is new behavior this task introduces; there is no existing precedent for a 409-on-
payload-mismatch anywhere else in the idempotency-key call sites checked
(`InitiativeController.ts` milestone/gate/RAID paths all just return the existing row
unconditionally, same gap, out of scope to fix here).

## 9. Key retention

Forever — no TTL, no cleanup job, no archival. `tool_initiative_links` rows are never deleted by
product code (only test teardown deletes them,
`tools-promote-characterization.realdb.test.ts:120-124`). A promotion made a year ago still
dedups against a same-shaped retry today. This is consistent with the rest of the schema (no
table in this area has a retention policy) and is not something Task 2 needs to change.

## 10. Tenant scope

Enforced **indirectly** today: `promoteToOutput` looks up the session with
`WHERE id = ? AND organization_id = ?` (`ToolController.ts:2080-2083`) — a foreign-org `toolId`
returns 404 before any `tool_initiative_links` code runs (this is FAZA 0's `C4`,
`tools-promote-characterization.realdb.test.ts:159-166`). But `tool_initiative_links` itself
carries **no `organization_id` column** (`C14`), so its own dedup SELECT
(`ToolController.ts:2111-2117`) is not itself tenant-scoped — it happens to be safe only because
the caller already filtered `tool_session_id` down to one that's provably owned by the caller's
org. Task 2's preferred key shape adds `organization_id` directly onto the ledger row, making
tenant isolation a **first-class, enforced** part of the uniqueness constraint instead of an
accident of call order — this also closes `C14`, not just `C15`.

---

## 11. Every consumer of the four output types — impact of a stricter constraint

Grepped `tool_initiative_links`, `promote-`, `batch_id`, `promoteToOutput`, `ReportBuilderService`
across `server/src` and `src/`.

| Consumer | Location | Reads/writes | Breaks under the preferred constraint? |
|---|---|---|---|
| `ToolController.promoteToOutput` | `ToolController.ts:2052-2352` | writes 1 row per call, keyed `(tool_session_id, promote-${outputType})` | **No** — this is the path the constraint is designed for; needs code changes (insert-then-catch instead of select-then-insert) but not a behavior break. |
| `ToolController.generateInitiatives` → `ToolInitiativeService.persistInitiatives` | `ToolController.ts:1706-1892`, `ToolInitiativeService.ts:249-347` | writes **N rows sharing one `batch_id`** (uuid, one per generated initiative) | **Yes, if the new unique index is naively `(tool_session_id, batch_id)`.** Must NOT collide — see §1 and §12. Fixed by giving each row here its own distinct `idempotency_key` (e.g. `bulk:${batchId}:${initiativeId}`) so the new constraint is structurally a no-op for this path (this path already has its own dedup guard at the batch level, `ToolController.ts:1707-1732`, so it needs no *additional* protection from this constraint — it just must not be blocked by it). |
| `ToolController.getGeneratedInitiatives` | `ToolController.ts:2393-2427` | reads `SELECT ... FROM tool_initiative_links l ... WHERE l.tool_session_id = ?` | **No** — pure read, no column removed, additive columns don't affect a `SELECT i..., l.batch_id` shape. |
| `ToolController.getToolSession` (batch summary) | `ToolController.ts:1097-1149` | reads `SELECT i.id, i.name as title, i.status, l.batch_id FROM ... WHERE l.tool_session_id = ?` (~`ToolController.ts:1107`) and returns `lastGenerationBatchId` from `tool_sessions.last_generation_batch_id` | **No** — same, read-only, additive columns are invisible to `SELECT` lists that don't name them. |
| `ReportBuilderService.createReport` / `getReport` | `server/src/services/reportBuilderService.ts:961, 1371` | creates/reads `report_builder_reports`; **does not touch `tool_initiative_links` at all** — `promoteToOutput` is the only caller that bridges the two tables (`ToolController.ts:2121-2129, 2224-2267`) | **No** — this service has no knowledge of the ledger table or its constraint; it is only reachable through `promoteToOutput`'s own dedup logic, which is what's changing. |
| `m11-tools-cross-org-idor.test.ts` | `server/src/routes/__tests__/m11-tools-cross-org-idor.test.ts:130-179` | fully mocked (`mockQueryOne`/`mockQueryAll`), asserts *which* SQL string is/isn't issued via regex on the query text | **No** — mocks don't validate against the real schema; regex checks (`/FROM\s+tool_initiative_links/i`) are unaffected by added columns. |
| `tests/integration/tools-promote-characterization.realdb.test.ts` (FAZA 0) | whole file | real-DB assertions about the *current* gap state | **`C14` flips from pass to fail** once `organization_id` is added to `tool_initiative_links` (it asserts the column does NOT exist) — confirmed by actually running it against the post-948 schema. This is the intended, documented kind of flip: the file's own `C12` comment (`tools-promote-characterization.realdb.test.ts:380-381`, "Ten test zmieni się na 1 dopiero po Fazie 1 — świadomie") anticipates exactly this pattern, and `C12` itself *also* flips once migration 946 is applied — confirmed the same way. **Not edited here**: `wt-outputs` (§13) already touches this exact file (its diff stat: `tools-promote-characterization.realdb.test.ts \| 11 +-`), almost certainly updating `C12` for the same reason. Editing it from this worktree too would add a third conflicting change to an already-contested shared file; flagged for the session orchestrator to reconcile `C12` and `C14` in one pass instead. `C15`'s specific regex (`/tool_session_id/` AND `/batch_id/` both present in one index def) stays accurate and needs **no** update, because the preferred key shape deliberately does not include `batch_id` as a literal column — see §12 for why. |
| Frontend `promoteToolOutput()` | `src/services/api.ts:7080-7095` | POSTs `{outputType, title, description?, selectedSections?}`, no `idempotencyKey` field | **No** — server-derived default key preserves current behavior unchanged; the client doesn't need to change. |
| `InitiativesManagementPanel.tsx` | `src/components/assessment/manage/InitiativesManagementPanel.tsx:69` | has a `batchId?: string` type field, cosmetic | **No** — unaffected. |

**Bottom line:** the only real collision risk is Path A (bulk generate) vs. a naive
`(tool_session_id, batch_id)` unique index. The task's preferred shape
(`organization_id, tool_session_id, source_revision, output_type, idempotency_key`) sidesteps
this by using `idempotency_key` instead of `batch_id` as the differentiator, **provided** Path A
is updated to write a per-row-unique `idempotency_key` rather than reusing its shared `batch_id`
value there. That update is included in Task 2's implementation (not just the migration file).

---

## 12. Why the preferred key shape, and not literally `(tool_session_id, batch_id)`

The FAZA 0 `C15` test names the gap as "brak UNIQUE na `(tool_session_id, batch_id)`" — that
phrasing describes the *symptom* (no DB-enforced uniqueness backing the SELECT-then-INSERT check
in `promoteToOutput`), not a literal spec for the fix. As shown in §1/§11, a literal
`(tool_session_id, batch_id)` unique index would break Path A outright (it inserts many rows per
`batch_id` on purpose). The task's preferred shape —
`organization_id + tool_session_id + source_revision + output_type + idempotency_key` — is
compatible with both paths once `idempotency_key` is populated correctly per path (deterministic
per promotion for Path B, per-row-unique for Path A), closes `C14` (adds real tenant scoping) at
the same time as `C15`, and additionally fixes the dormant `source_revision` bug from §5. This is
the shape implemented in `server/migrations/948_tool_promotion_idempotency.sql`.

---

## 13. Relationship to `tool_outputs` (947, sibling worktree `wt-outputs`)

Mid-session, the orchestrator flagged that a sibling agent (worktree `wt-outputs`, branch
`codex/tools-wt-outputs-20260813`, commit `b1692a29fa` — *"feat(tools): make tool_outputs the
canonical immutable snapshot"*) independently closed a **different, adjacent** gap on the same
migration 946 tables this document's §11/§12 already noted as dormant/unused: `tool_outputs`
(946's immutable snapshot table) had no unique constraint either, and that commit adds
`server/migrations/947_tool_outputs_idempotency_guard.sql` — a **partial** unique index,
`UNIQUE (tool_session_id) WHERE status <> 'superseded'`. That branch also wires
`ToolController.promoteToOutput` to call a new `ensureToolOutputSnapshot()` (from
`server/src/services/tools/toolOutputSnapshotService.ts`) at the top of the handler, so
Report/Presentation/Initiative content is rendered FROM a frozen, hashed, approved snapshot
instead of a fresh `session.answers_json` re-read.

**These are two constraints on two different tables, not a duplicate of this task's work:**

| | `tool_outputs` (947, wt-outputs) | `tool_initiative_links` (948, this worktree) |
|---|---|---|
| What it protects | ONE canonical content snapshot per `(tool_session_id)` (partial: superseded rows fall outside the index on purpose, since a correction intentionally creates a new active row) | ONE promotion-ledger row per `(organization_id, tool_session_id, source_revision, output_type, idempotency_key)` |
| What "duplicate" means here | Two concurrent requests both freezing a new snapshot of the same session | Two concurrent requests both promoting the same session to the same output type under the same key |
| Consumed by | The new `toolOutputSnapshotService` render path (report/presentation content) | `getGeneratedInitiatives`, the promotion dedup/409-on-conflicting-payload logic, and the bulk-generate (`persistInitiatives`) ledger |
| Role after wt-outputs' change | **Authoritative for content** — what gets rendered into a report/presentation | **Compatibility/lineage projection** — what existing consumers (§11's table) already query; still the only place `initiative_id`/output id lookups happen |

wt-outputs' own commit message states this explicitly: *"tool_initiative_links stays the
compatibility/lineage projection existing consumers rely on; tool_outputs is authoritative for
content."* That matches this document's own findings independently — §11 already established
that nothing outside `promoteToOutput` writes or reads `tool_outputs`/`tool_reports` (the 946
tables were dormant on this worktree's base commit), and this task's constraint was designed
purely against `tool_initiative_links`'s existing consumers without assuming 946/947 would ever
be wired up. The two migrations do not collide at the SQL level (different tables, different
index names: `uq_tool_initiative_links_promotion` vs. whatever 947 names its index) and are
safe to apply together in either order.

**What does NOT reconcile automatically:** wt-outputs' commit rewrites large parts of
`ToolController.promoteToOutput` itself (170 lines changed — removes the local
`renderToolReportSection`, inserts an `ensureToolOutputSnapshot()` call before the existing
`tool_initiative_links` dedup check, and changes the `report`/`presentation` branches to persist
canonical lineage via `persistCanonicalReport`). This worktree's Task 2 implementation *also*
rewrites large parts of the same function (the claim-before-create restructuring, `source_revision`
read from `session.version`, `idempotency_key`/`payload_hash` columns, the 409-on-conflicting-
payload logic). Both branches touch the same lines for different reasons. This is a genuine,
expected merge-time reconciliation the session orchestrator owns — not something resolvable from
inside a single worktree — flagged here explicitly so it isn't a surprise at merge time. The
`tool_initiative_links` constraint and the claim-before-create/idempotency-key logic in this
worktree's diff are independent of wherever `ensureToolOutputSnapshot()` ends up being called
from; the reconciliation is mechanical (interleaving two sets of edits to the same function body),
not a design conflict.

**Also independently found by wt-outputs:** the same `initiatives.priority_order` gap this
worktree's Task 3 race test routes around (see that test file's header comment) — confirmed by a
second, independent agent working from the same fresh migration bootstrap. Cross-validates that
finding; no further action taken on it here (explicitly out of scope for both worktrees).
