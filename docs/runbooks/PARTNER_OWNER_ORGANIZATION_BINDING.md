# Historical Partner tenant binding runbook

## Scope and authority

Migration 955 added `partner_organizations.owner_organization_id` but deliberately left historical
rows `NULL`. The application denies those rows rather than guessing a tenant from names, e-mail
domains, users, referrals or activity. This runbook governs the separate owner-approved mapping.

Repository qualification does **not** authorize a production mapping. Before a production run, the
release owner must provide the exact Partner-to-tenant rows, name the active SUPERADMIN actor, approve
the target database, retain the signed input, and schedule both the telemetry window and rollback
rehearsal required by `PRT-MVP-LEGACY-CUTOVER-001`.

## Signed input

The input is JSON with this shape:

```json
{
  "schemaVersion": 1,
  "runId": "prt-owner-bind-2026-08-19-01",
  "operation": "APPLY",
  "actorUserId": "exact-existing-superadmin-user-id",
  "issuedAt": "2026-08-19T10:00:00.000Z",
  "expiresAt": "2026-08-19T12:00:00.000Z",
  "mappings": [
    {
      "partnerOrganizationId": "exact-historical-partner-id",
      "ownerOrganizationId": "exact-consultify-tenant-id"
    }
  ],
  "signature": {
    "algorithm": "HMAC-SHA256",
    "keyId": "prt-binding-2026-08-a",
    "value": "64-lowercase-hex-characters"
  }
}
```

The signature covers the deterministic, recursively key-sorted JSON of every field except
`signature`. Use an independently controlled secret of at least 32 characters in
`PARTNER_OWNER_BINDING_HMAC_KEY`; identify its rotation with
`PARTNER_OWNER_BINDING_HMAC_KEY_ID`. Never commit either secret or a production manifest.

A rollback is a new signed manifest with `operation: "ROLLBACK"`, a new `runId`, the original
`applyRunId`, and the exact same mapping rows. Hand-edited, expired, differently keyed or partial
rollback files are rejected.

## Preconditions

1. Record the exact application SHA and migration ledger. Migration 958 must be successful.
2. Confirm the database URL, host and database name out of band. Do not use a broad/shared alias.
3. Verify the actor exists, is `active`, and has role `SUPERADMIN`.
4. Verify every source Partner id and target tenant id with the business owner. `NULL` is not a
   candidate for inference.
5. Review duplicate Partner ids, duplicate target tenants, inactive tenants, already-bound rows and
   active-owner collisions. The CLI refuses all of them.
6. Back up the database according to the release procedure. This script is not a backup system.

## Dry-run (mandatory)

Dry-run is the default and writes neither binding rows nor receipts:

```sh
DATABASE_URL='<redacted>' \
PARTNER_OWNER_BINDING_HMAC_KEY='<secret>' \
PARTNER_OWNER_BINDING_HMAC_KEY_ID='prt-binding-2026-08-a' \
npx tsx server/scripts/partner-owner-organization-binding.ts \
  --manifest /approved/private/prt-owner-binding.json \
  --expect-host exact.database.host \
  --expect-database exact_database_name \
  --report /approved/private/prt-owner-binding.dry-run.json
```

Archive the manifest, dry-run report and their SHA-256 values in the controlled release record.
Any input change requires a new signature and another dry-run.

## Apply

After explicit release approval, repeat the same command with `--apply`. The CLI takes transaction
and row locks, revalidates the live state, updates only expected `NULL` rows, and inserts one immutable
receipt in the same transaction. A mid-batch failure rolls everything back.

```sh
... npx tsx server/scripts/partner-owner-organization-binding.ts \
  --manifest /approved/private/prt-owner-binding.json \
  --expect-host exact.database.host \
  --expect-database exact_database_name \
  --apply \
  --report /approved/private/prt-owner-binding.apply.json
```

Re-running the identical signed `runId` returns the existing receipt as a replay. Reusing a `runId`
with different bytes fails closed.

## Cold verification and report

Run the generated cutover report against the same exact database:

```sh
npx tsx server/scripts/legacy-cutover-report.ts \
  --database-url '<redacted>' \
  --out /approved/private/prt-cutover-report
```

Verify:

- expected active bound/unbound counts;
- exactly one APPLY receipt with the manifest input hash, result hash, actor and mapping count;
- V8 tenant resolution succeeds only for the mapped tenant and active Partner user;
- foreign/revoked tenants remain denied;
- no legacy fallback is enabled;
- deployed usage telemetry is actually read, not merely empty or unread.

## Rollback to `NULL`

Prepare and independently sign the explicit ROLLBACK manifest. Dry-run it first, then use
`--rollback`. Rollback is allowed only while every Partner row still has the exact owner recorded by
the referenced APPLY receipt. It sets only those rows to `NULL` and atomically appends a ROLLBACK
receipt; it never restores an inferred or alternate tenant.

After rollback, regenerate the cutover report and verify the rows are unbound, both immutable
receipts remain, V8 writers fail closed for those rows, unrelated tenants are unchanged, and no
advisory locks remain.

## Completion boundary

Passing repository RealPG tests qualifies the tooling only. `PRT-MVP-LEGACY-CUTOVER-001` remains
release-blocked until the owner-approved production mapping is executed, the deployed telemetry
window is observed, and the production rollback rehearsal is recorded. Do not convert those
`NOT_EXECUTED` boundaries into `DONE` from a local database run.
