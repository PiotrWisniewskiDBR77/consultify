# C6 remaining export/deletion gate audit — 2026-09-13

## Snapshot and scope

Read-only audit of `/Users/piotrwisniewski/Developer/codex-wt/codex-w17-deck-autosave-20260912` at `27da10f07d15c78f0eabea8754da4d7d69e9d0bd`; worktree was clean. This is later than the requested `a743a96c...` snapshot and includes the accepted Interview pointer timestamp commit `31084b34d1` and disjoint Gantt commit `27da10f07d`. No source, database, schema, port, runtime, deployment, or live state was changed. No tests were run because this pass is source/SSOT audit and the existing deletion suites perform destructive fixture cleanup.

## Verdict

Full C6 S2.7 remains **HOLD**. The accepted Interview Decision receipt seam is one authorized-content slice inside a truthful partial organization export. It is neither a complete organization export nor authority for physical organization deletion.

The nearest concrete code task is **C6-DEL-OFF: make the mounted superadmin physical-delete endpoint return the existing deterministic `SET_DELETE_APPROVED_OUT` refusal without acquiring a database client or invoking a deletion engine, and make the superadmin UI stop promising an irreversible purge**. This is a safety correction required by an already binding decision, not a new retention or ownership decision.

## Binding deletion boundary

`SET-MVP-DELETE-001/DECISION_PACKET.md:3-20,34-68` is explicit:

- status `APPROVED_RESTRICTED_SCOPE / DESTRUCTIVE_EXECUTION_OFF`;
- authenticated request/status/cancel workflows may persist;
- no route, worker, scheduler, or operator may anonymize or purge;
- all eight data-class treatment rows are `UNKNOWN`, where blank is `NOT_AUTHORIZED`;
- reopening requires the complete Legal/Privacy matrix, backup expiry/restore proof, a separately reviewed dry-run/scoped/legal-hold/idempotent executor with an immutable receipt, negative interruption/cross-tenant controls, signed acceptance on disposable data, and separate production authorization.

The integrated retention audit reaches the same result at `C6_RETENTION_AND_SCHEMA_MATRIX.md:5-9,22-30,53-73`: a populated/governed tenant may only be refused before the first mutation; no success receipt may be created; refusal protects data but does not close E4.

## Actual source mismatch

The mounted superadmin router is protected globally by JWT plus DB-backed superadmin verification (`server/src/routes/superadmin.routes.ts:375-389`). Nevertheless, `DELETE /api/superadmin/organizations/:id` currently:

1. records a confirmed critical action through `requireConfirmation` (`:820-824`);
2. calls the fail-open `requireNoLegalHold` read (`:829-840`);
3. acquires a PG client, starts a transaction and calls `deleteOrganizationDataInTransaction` (`:845-884`);
4. returns success after COMMIT and emits the ordinary audit event after the destructive transaction (`:867-881`).

`OrgPoliciesService.hasLegalHold` returns `false` after a non-missing-table read error (`server/src/services/OrgPoliciesService.ts:23-38`), so the current deletion path can also fail open on policy-read failure. The transactional helper at `:45-70` fails closed, but this route does not use it. This defect must not be “fixed” by wiring a better legal-hold read into an executor that remains unauthorized; the immediate binding behavior is still refusal.

The invoked deletion engine dynamically deletes only `public` tables with a direct organizations FK or literal `organization_id`, then deletes the organization row (`server/src/services/organizationLifecycleService.ts:58-97,180-271`). It has exact `$1` scoping, savepoints and caller rollback, but it does not classify ownership, shared-user treatment, `v8`, retention, backup, or immutable governed history. Dynamic catalog discovery is not deletion authority.

The superadmin UI currently says the operation permanently deletes everything, prompts for the exact name, invokes the endpoint and reports `Organization deleted` (`src/views/superadmin/OrganizationsView.tsx:252-294,771-824`). That promise contradicts the binding policy. The ordinary Settings UI is already truthful: it calls a reversible request workflow and says no data will be erased while policy approval is pending (`src/components/settings/DataControlsSettings.tsx:476-523,764-790`).

Other lifecycle surfaces do not prove an executor. `POST /api/organizations/:orgId/schedule-deletion` and cancel only update scheduling fields (`server/src/routes/organization/ownership.routes.ts:470-569`); `POST /api/superadmin/tenants/:id/purge` only sets status `purge_scheduled` (`server/src/routes/superadmin.routes.ts:1300-1353`). Their copy may need later truthfulness review, but they do not call the physical engine. The legacy `/api/user/delete-request` already gives the correct 410/zero-write boundary and is a direct implementation/test precedent (`server/src/routes/dataExport.routes.ts:255-271`, `server/src/routes/__tests__/dataExport.routes.approvedOut.test.ts:39-59`).

## Export boundary already present

The current organization exporter catalogs both `public` and `v8`, retains schema-qualified identities, and authorizes only exact contract entries (`server/src/services/organizationExportService.ts:22-27,93-151,178-239`). The current contract entries are all `public`; unlisted `public` and `v8` relations remain `ownership_contract_unresolved`. Catalog/schema/PK/FK drift also becomes unresolved, and `securityManifest.complete` is true only with zero unresolved tables and zero skipped reads (`:188-239,462-472`).

Current source therefore improves on the older matrix statement that `v8` was not inventoried, but does not authorize any `v8` payload. `RC2_EXPORT_COMBINED_FINAL_INDEPENDENT_REVIEW.md` retains 1911 originally unresolved relations plus actual drift and explicitly rejects a complete-export claim. The count is historical; this read-only audit did not query a current catalog and does not invent a new denominator.

Existing behavior evidence is appropriately partial:

- `organizationExportService.contract.test.ts`: schema-qualified public/v8 separation, foreign/counterparty exclusion, unknown relation omitted with `complete:false`, schema/PK/type/FK drift refusal, security exclusions and manifest/CSV preservation.
- `organization-export-authority.gateway.pg.test.ts`: persisted ACTIVE ADMIN/OWNER allows; stale JWT role, inactive/missing membership, invalid role, foreign tenant and unauthenticated caller deny before attachment.
- `organization-export-snapshot.gateway.pg.test.ts` and `organizationExportSnapshot.realpg.test.ts`: self-service foreign denial, truthful incomplete manifest, absent/existing legal-hold serialization, held superadmin denial and lock/client cleanup.
- The accepted Interview Decision writer→receipt→handoff→JSON/CSV seam authorizes only matching, unmodified generated Finding content. It does not change the unresolved-table denominator.

## Ready-to-code packet: C6-DEL-OFF

### Production files

1. `server/src/routes/superadmin.routes.ts`
   - preserve global JWT and DB-backed superadmin middleware;
   - make `DELETE /organizations/:id` return HTTP 410 with `{ success:false, code:'SET_DELETE_APPROVED_OUT', destructiveExecution:false }` before `requireConfirmation`, policy reads, client acquisition, transaction, deletion, or success audit;
   - remove route-only imports made unused; leave `organizationLifecycleService` available for tests/history but unreachable from mounted production routes;
   - do not create a success receipt or claim rollback/idempotent execution.
2. `src/views/superadmin/OrganizationsView.tsx`
   - remove/disable both delete affordances and the permanent-delete prompt;
   - show the same already-approved meaning as Settings: destructive execution is unavailable pending retention/legal-hold approval;
   - keep Export Data and its incomplete-manifest disclosure unchanged.
3. `src/services/api.ts` only if needed to preserve the machine-readable refusal for a shared UI error path. Do not redirect organization deletion into an account-deletion request; those have different target and authority contracts.

### Focused RED→GREEN behavior tests

1. Replace the destructive success assertion in `server/src/routes/__tests__/organizationLifecycle-superadmin.http.pg.test.ts` with the exact fullName:
   - `DELETE .../organizations/:id returns SET_DELETE_APPROVED_OUT twice and preserves populated governed data without a success receipt`
   - seed through normal writers where feasible: target A, foreign B, shared user A+B, one A-only row, one immutable receipt anchor, hold OFF;
   - call actual ApiGateway/JWT as SUPERADMIN twice;
   - both responses exactly 410/approved-out; A, B, memberships, governed receipt and source rows are byte-equivalent; no deletion transaction, success audit, or deletion receipt appears.
2. Add/retain negatives in the same mounted route suite:
   - `non-superadmin and unauthenticated callers cannot use the approved-out endpoint to probe or mutate a foreign organization` (403/401, no response attachment/body data, all rows unchanged).
3. Add a lightweight route unit patterned on `dataExport.routes.approvedOut.test.ts`:
   - spies prove `requireNoLegalHold`, `acquirePgClient`, and `deleteOrganizationDataInTransaction` are not called for a valid superadmin request;
   - repeat is byte-equivalent and performs zero DB writes.
4. Add a rendered `OrganizationsView` behavior test:
   - no enabled destructive control and no permanent-deletion prompt/call;
   - visible policy-pending explanation;
   - Export Data remains reachable.

The old direct service test may remain as characterization of the dormant helper, but its physical-delete PASS must not be cited as product acceptance or run against retained/shared/governed production-like data. It cannot close S2.7.

### Acceptance evidence and exclusions

Accept only on a frozen SHA with source hashes, same-fullName RED→GREEN, actual Gateway/JWT denial/no-mutation readback, and independent review. No DB/catalog mutation is necessary to prove the unit-level call barrier; the Gateway test must use disposable fresh UUID fixtures and exact cleanup if execution is later authorized.

This packet does **not** close:

- full organization export: ownership for unresolved public/v8 and multi-org relations remains `UNKNOWN`;
- physical deletion: retention/anonymization/purge for all decision-matrix classes remains `NOT_AUTHORIZED`;
- legal-hold executor semantics: current delete read is fail-open and future execution needs serialized, fail-closed policy verification;
- idempotent destructive outcome: no request digest or durable `SUCCEEDED/REFUSED/OUTCOME_UNKNOWN` receipt exists;
- rollback/interruption: simple transaction/savepoint tests do not prove populated immutable/shared-user behavior or post-COMMIT ACK recovery;
- operational readiness: no live backup expiry/restore evidence, DPA-template acceptance, signed owner acceptance, staging/production execution, or production authorization exists.

## Frozen hashes read in this audit

```text
ab9fdf8656b42dbe12aa8b3e14770f7dc33e61b3d6a2d720929a12c84a5124e5  server/src/routes/superadmin.routes.ts
8322fff8ca2cb9ae2b2f724ff2ccaee43a145705b39c046c2d5f75362cd6d45a  server/src/services/organizationLifecycleService.ts
875846b2cccb63b729fd4102be9bac27a3c6e531da8822fccf9ac8f1f3354fa6  server/src/services/OrgPoliciesService.ts
0bc1bb9e16b6bf563d2abf5addd47171b97188a413b57a6bb220a7ea7fafa386  server/src/services/organizationExportService.ts
32d0e32fd3c0affbde22c95d4ea3f0dc8a5318f12da7db6ac797ade62fb5269d  server/src/services/organizationExportContract.ts
116eea9cecea8212ad7cd173f17c9f0eed7738ebbed948d0aa3e50cfadde99cc  src/views/superadmin/OrganizationsView.tsx
d37d8012e7f59db3c92492ee1c5ea21b1fa26df25948163d22eb3c75770a71fe  src/components/settings/DataControlsSettings.tsx
c2c0da45590e248e674ea6081f570cf645225508be9d466370392452976effd0  server/src/routes/organization/ownership.routes.ts
7788713d9dc53e5c6e45b3f9ac8d247bedf1a21bb76b9f11e1c37d0ae6f68795  server/src/routes/__tests__/organizationLifecycle-superadmin.http.pg.test.ts
07665b178582eb1686323a2f14bb3feec486af587c84286b263d5193769fc44a  server/src/services/__tests__/organizationLifecycleService.realpg.test.ts
5bf4358b96f68939089a95f1788b5717d11a1cae3d5878e7570d6a52a60f1859  server/src/services/__tests__/organizationExportService.contract.test.ts
b4d5ceafb0889409c43e729153695f12bfe4e2c46d880bb2275262f287208edf  server/src/routes/__tests__/organization-export-snapshot.gateway.pg.test.ts
88a93fb0c326092b95c78fa3bb291905c5fc0d19c06ff1a7c06f48b6ac04c0a6  server/src/routes/__tests__/organization-export-authority.gateway.pg.test.ts
6b910701e3c8b88d733992909afc3ab027cc2216e5ba7632496fb54d4184748e  SET-MVP-DELETE-001/DECISION_PACKET.md
84b8a28b025941241054f60e6a254090b8dcaa07a4848c26a6f0cae0e3c9c729  C6_RETENTION_AND_SCHEMA_MATRIX.md
83bae1d9835d5d36d47fbcd20bab63e6c7e2f93906fdbe2fbefe0e01dcb33c59  C6_NEXT_FIX_DESIGN.md
9341c901244b35d1a2c0f262f14e38c8674f76a203227c0bd6f6ea3a757ce0c0  RC2_EXPORT_COMBINED_FINAL_INDEPENDENT_REVIEW.md
```
