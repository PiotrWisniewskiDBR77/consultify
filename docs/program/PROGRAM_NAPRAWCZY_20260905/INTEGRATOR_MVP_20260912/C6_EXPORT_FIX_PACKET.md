# C6 — bounded export fix packet

Data: 2026-09-12. Status: design only, bez source/schema/data mutation. Companion inventory: `C6_EXPORT_TABLE_CONTRACT.json`.

## Premise and stop boundary

Current implementation in `server/src/services/organizationLifecycleService.ts` discovers and queries only `public`, addresses tables by bare name, keys JSON/CSV by bare table name, traverses every public FK descendant that passes a limited tenant check, and always emits `securityManifest.complete:true`. The active local catalog has 1802 public and 121 v8 tables. The prior `1282 public + 111 v8` tenant-candidate counts and `109 public + 1 v8` guarded counts are heuristics, not authorization per table.

The next fix must not turn dynamic discovery into dynamic authorization. `UNRESOLVED` means fail closed in the manifest and omit the table from serialization until a versioned table contract proves owner/counterparty/privacy treatment. This packet does not authorize destructive execution, anonymization, purge, production mutation, or blanket v8 export.

## 1. Schema-qualified discovery and querying

Replace every bare table identity with `{schema, table}` and every map key with a collision-safe internal key, for example `schema + NUL + table`. Discovery must bind both namespaces explicitly:

```sql
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       a.attname AS column_name,
       format_type(a.atttypid, a.atttypmod) AS data_type
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
 WHERE c.relkind = 'r'
   AND n.nspname = ANY($1::text[])
   AND a.attnum > 0
   AND NOT a.attisdropped
 ORDER BY n.nspname, c.relname, a.attnum;
```

FK discovery must return `child_schema`, `child_table`, `parent_schema`, `parent_table`, ordered column pairs, and the delete action. Join namespace for both child and parent; never infer parent schema from child schema.

All generated row queries must quote both identifiers:

```sql
SELECT <explicit safe projection>
  FROM "v8"."example_table"
 WHERE "organization_id"::text = $1;
```

No `search_path` dependency, no interpolation of catalog values without identifier quoting, no `SELECT *`, no row cap. Discovery includes only an explicit allowlist of schemas (`public`, `v8`).

## 2. Stable JSON and CSV compatibility

Preserve all existing public JSON keys exactly: `organization`, `tables.<bare_public_name>`, `rowCounts.<bare_public_name>`, `exportedAt`, `skipped`, `securityManifest`, `totalRows`. Preserve the current CSV header and public table values: `table,row_index,data_json` and `<bare_public_name>`.

For v8, use `v8.<table>` in `tables`, `rowCounts`, `skipped`, `excludedTables`, `excludedColumns`, and the CSV `table` column. A public table keeps its bare legacy key even if a same-named v8 table exists. Thus `public.sessions` remains `sessions` and `v8.sessions` becomes `v8.sessions`; neither overwrites the other.

Additive manifest fields may include `includedSchemas`, `unresolvedTables`, and `tableIdentityVersion:'schema-qualified-v1'`. Do not rename or retype existing public fields. Sort schema/table identities and rows deterministically by catalog order plus stable PK where available; document the fallback when a table has no PK.

Mutation test: restore the old bare-name internal map and prove a same-name public/v8 fixture overwrites or merges incorrectly (RED); restore schema-qualified keys and prove both appear independently (GREEN). Compatibility snapshot must prove the public-only fixture is byte-shape compatible except for documented additive manifest fields and timestamps.

## 3. Contract-driven ownership and security

Load or compile a versioned contract whose row is keyed by schema and table and includes:

- PK and FK graph;
- explicit owner discriminator;
- separately named counterparty discriminators;
- credential columns and whole-table security exclusion;
- category `EXPORT`, `EXCLUDE_SECURITY`, or `UNRESOLVED`;
- source evidence pointer and policy version.

Rules:

1. `EXCLUDE_SECURITY`: never query or traverse the table; list it in the manifest.
2. `EXPORT`: query only the declared owner discriminator and apply explicit safe projection.
3. `UNRESOLVED`: do not query rows; add a schema-qualified reason to `unresolvedTables`; set `complete:false`.
4. Credential-like JSON keys must still be recursively removed from JSON/JSONB and serialized JSON stored as TEXT. This is defense in depth, not a substitute for table classification.
5. A table with two organization-like columns is never exported merely because either equals the requested organization. Exactly one contract field must be the owner; counterparty equality alone must not select a row.
6. FK traversal into a child with its own owner discriminator must require the child's owner value to equal the requested organization. Traversal into a child without a proved discriminator remains `UNRESOLVED`, except for an explicitly approved ownership edge.
7. User identity remains shared. A user-linked row with no proved tenant discriminator must not be traversed.

Multi-org negative control: write one row whose owner is organization B and counterparty is organization A through the real application writer. Export A must omit it; export B may include it only under the declared owner rule. Mutating the query from owner-only to `owner=$1 OR counterparty=$1` must make the test RED.

## 4. v8 behavioral proof

Choose at least one non-secret v8 business table with a real writer and a single proved owner discriminator from the contract. Through that writer, create one row for A and one sentinel row for B. Then prove through real authenticated organization-export HTTP:

- JSON contains `tables['v8.<table>']` for A;
- JSON omits B's sentinel;
- CSV contains the `v8.<table>` identity and A row, not B;
- a public table with the same bare name, created only in the disposable test database, remains a separate legacy public key;
- credential fields and nested credential keys remain absent;
- `rowCounts` and `totalRows` match the serialized rows.

Do not use direct INSERT as proof of the business writer. Direct fixture DDL may be used only for the same-name namespace collision test in a disposable database and must be cleaned up.

## 5. Truthful completeness

`securityManifest.complete` is derived, never hard-coded:

```text
complete = discoverySucceeded
        && snapshotStayedValid
        && unresolvedTables.length === 0
        && skippedUnexpectedly.length === 0
        && everyIncludedTableUsedApprovedProjection
```

`truncated` remains false only if no table/row/field was omitted due to a size or count limit. Policy exclusions do not imply truncation, but must be listed. Any catalog query failure, unsupported FK edge, schema drift from the compiled contract, unclassified table, missing owner rule, or projection mismatch yields a controlled failure or `complete:false`; it must never yield `complete:true` with silent omission.

Mutation test: classify one known v8 candidate as `UNRESOLVED`. The response must remain successful only if product policy permits partial export, must list the exact schema-qualified table, and must say `complete:false`. Mutating the reducer back to constant true must make the test RED.

## 6. Legal-hold serialization before snapshot

The current route begins `REPEATABLE READ` before taking the tenant advisory lock. That permits the snapshot to precede a concurrent first insert into `org_policies`. Use the same lock key as the policy writer, but make the export lock session-scoped and acquire it before `BEGIN`:

```text
client = acquire pinned pool client
locked = false
acquireAttempted = false
discard = false
try
  acquireAttempted = true
  SELECT pg_advisory_lock(hashtextextended($1, 0))       // before BEGIN
  locked = true
  BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ
  requireNoLegalHoldInTransaction(...)                  // first policy/snapshot read
  exportOrganizationData(...)
  COMMIT
catch
  ROLLBACK if transaction began
  rethrow / map OrgPoliciesError
finally
  if locked:
    SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS unlocked
    if query fails or unlocked !== true: discard = true
  else if acquireAttempted:
    discard = true                                       // ACK may have been lost after acquisition
  client.release(discard ? new Error('advisory lock release unconfirmed') : undefined)
```

Never use a transaction-scoped lock for this pre-snapshot boundary: before `BEGIN` it would be released immediately. Never return a client to the pool if unlock is false or cannot be confirmed. A timeout, socket error, cancellation, or lost acknowledgement from the acquisition query is also an unknown lock state: PostgreSQL may have acquired the session lock even though the caller never received success. Such a client must be destroyed, not released normally. Policy mutation must retain `pg_advisory_xact_lock(hashtextextended($1,0))` on the same organization key.

Deterministic tests:

1. A query-order mutation test on the route/helper records calls and asserts advisory lock precedes `BEGIN REPEATABLE READ`, which precedes the first policy/catalog/export SELECT. Moving `BEGIN` first must be RED.
2. A RealPG **writer-first** test reproduces the original absent-policy race. The canonical writer begins, takes the production transaction lock, INSERTs the first `org_policies` row with `legal_hold_enabled=1`, and deliberately does not commit. Start the real authenticated export and prove its backend is waiting on the same advisory lock in `pg_locks`; it must not return a file. Commit the writer. The export may then acquire its session lock, begin its snapshot, observe the committed first row, and return `423 LEGAL_HOLD` with no attachment/body masquerading as an export. Mutating the implementation to `BEGIN REPEATABLE READ` before the session lock must make this test RED by allowing the stale absent-row snapshot.
3. Repeat the writer-first ordering for an **existing** `org_policies` row updated from hold 0 to hold 1 without commit. Export waits, writer commits, export returns `423` and no file. This proves both INSERT-absent and UPDATE-existing cases.
4. Keep the complementary export-first test: export holds the session lock and a canonical policy writer waits before INSERT/UPDATE. Release occurs only after export COMMIT/ROLLBACK plus confirmed unlock; the writer then completes.
5. An unlock-failure mutation test forces false/error and proves the pinned client is destroyed, not returned to the pool.
6. An **acquire-ACK-lost** test makes `SELECT pg_advisory_lock(...)` acquire on the backend but return a simulated timeout/socket error to the caller. Because acquisition state is uncertain, prove the client is destroyed. A pool-level follow-up must use a different healthy backend; the possibly locked backend must never be reused.
7. A rollback-path test proves the advisory lock is released after an export error and another client can immediately acquire the same key.

## 7. Bounded implementation order and evidence

1. Freeze the generated table contract version and use the first bounded v8 business vertical to prove the mechanism; all other unresolved rows stay incomplete and remain an explicit queue. This vertical is not a substitute for reconciling the complete export denominator.
2. Add schema-qualified identities and preserve public JSON/CSV snapshots.
3. Add the session-lock wrapper and deterministic order/unlock tests.
4. Add same-name namespace mutation proof.
5. Add real-writer v8 A/B readback and multi-org owner/counterparty negative control.
6. Run only per-file tests with retry zero, server full typecheck, and frontend per-file esbuild if a frontend file changes.

Passing these tests proves the bounded vertical and truthful partial manifest. The implementation sequence must continue toward reconciliation of the entire discovered export denominator; it does not prove full E4 or full export until every `UNRESOLVED` table has a governed decision and behavioral readback appropriate to its class.
