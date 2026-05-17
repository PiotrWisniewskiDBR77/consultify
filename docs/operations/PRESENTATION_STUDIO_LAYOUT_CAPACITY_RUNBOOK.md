# Presentation Studio Layout Capacity Runbook

Status: `ACTIVE`
Owner: Platform / SuperAdmin Operations
Scope: Consultify Presentation Studio layout-capacity runtime overrides, signed persistence, tenant-scoped restore, and degraded-load remediation.

## Purpose

Presentation Studio layout-capacity overrides let a SuperAdmin tune slide slot budgets at runtime without a deploy. The flow is intentionally governed:

`proposal -> approval -> execution -> audit -> signed persistence -> tenant-scoped restore`

This runbook explains how to configure the persistence layer, how to interpret the SuperAdmin `loadWarning` banner, and how to recover without hiding failed writes, tampered files, or tenant-scope mistakes.

## Runtime Files And Secrets

Required production env var:

`CONSULTIFY_LAYOUT_CAPACITY_OVERRIDES_HMAC_SECRET`

Set this to a high-entropy secret in every production/staging environment that can write runtime layout-capacity overrides. Do not commit it. Do not reuse application JWT/API secrets.

Optional env var:

`CONSULTIFY_LAYOUT_CAPACITY_OVERRIDES_PATH`

If unset, the service writes to:

`<cwd>/.runtime-config/presentation-studio-layout-capacity-overrides.json`

The file is written with an atomic tmp-file + rename + file fsync + directory fsync sequence. If the storage device or parent directory cannot confirm durability, the in-memory override may still apply, but the persistence layer must surface an honest `io_error` warning.

## Persistence Schema

Current write format:

`schemaVersion: 2`

The signed file contains:

- `globalOverrides`: legacy/global snapshot used by test helpers and compatibility paths.
- `tenantOverridesByOrganizationId`: tenant snapshots keyed by authenticated `organizationId`.
- `signature`: HMAC-SHA256 over the canonical persistence payload.

Signed `schemaVersion: 1` files from S22 remain readable as global-only snapshots. New writes use `schemaVersion: 2`.

## Normal Healthy State

In the SuperAdmin layout-capacity panel:

- `loadWarning` is absent.
- `scope` is `tenant`.
- `current` reflects only the authenticated tenant.
- `defaults` reflects canonical code defaults.
- Execute/reset actions create approval tickets and audit events.
- Refreshing the page preserves applied tenant overrides.

## Warning: `signature_mismatch`

Meaning:

The persisted override file is missing a signature or its HMAC does not match the file contents. The server refused to trust the file and ignored the persisted runtime overrides.

Severity:

Treat as security/governance relevant. This can indicate a manual hand-edit, copied file from another environment, wrong HMAC secret, corrupted write, or partial operational restore.

Expected user-facing behavior:

- SuperAdmin panel shows a rose `loadWarning`.
- Runtime registry falls back to defaults for the affected restore path.
- The server does not crash.
- No unsigned or forged override is applied silently.

Remediation:

1. Confirm the active env var `CONSULTIFY_LAYOUT_CAPACITY_OVERRIDES_HMAC_SECRET` is present and matches the environment that last wrote the file.
2. Check whether the file was manually edited, copied between environments, or restored from backup.
3. If the file contents are not trusted, preserve a forensic copy outside the runtime path, then use the SuperAdmin reset/propose/execute flow to return to defaults.
4. Re-apply required tenant overrides through the SuperAdmin UI or API only. Do not hand-edit the JSON file.
5. Refresh the SuperAdmin panel and verify `loadWarning` is gone and the `current vs defaults` diff reflects the intended tenant.
6. Confirm an audit row exists for the reset and each re-applied override.

Do not fix by deleting the signature field or changing the JSON manually. That recreates the same governance bypass the signature is designed to prevent.

## Warning: `io_error`

Meaning:

The persistence layer could not read, write, remove, fsync, or durably rename the runtime override file.

Common causes:

- Parent directory missing or not writable.
- Disk full (`ENOSPC`).
- Permission change after deploy.
- Degraded storage device returning fsync errors.
- Runtime path mounted on a filesystem that cannot fsync directories reliably.
- File locked or owned by the wrong process user.

Expected user-facing behavior:

- SuperAdmin panel shows an amber `loadWarning`.
- If the failed operation happened after an in-memory apply, the override may work until restart but may not be durable.
- The server does not claim clean persistence when durability is uncertain.

Remediation:

1. Identify `sourcePath` from the SuperAdmin panel warning.
2. Verify parent directory exists and is writable by the Node process user.
3. Check disk space and inode exhaustion.
4. Check container/VM volume health and host storage logs.
5. If available, run storage health checks such as `smartctl` or provider volume diagnostics.
6. Fix permissions or storage health first. Do not repeatedly apply overrides against a failing disk.
7. After storage is healthy, re-apply the intended tenant override through `propose -> execute`, or perform a reset and re-apply.
8. Refresh the SuperAdmin panel and confirm `loadWarning` cleared.

## Warning: `corrupt` Or `unsupported_schema`

Meaning:

The file could not be parsed as the expected JSON shape or uses a schema newer/older than the deployed code understands.

Remediation:

1. Preserve a copy for debugging.
2. Confirm the deploy version and whether a rollback happened after a newer persistence schema was written.
3. If rollback caused `unsupported_schema`, either redeploy the compatible version or reset/re-apply through the current SuperAdmin flow.
4. Never manually trim the file down to “make JSON parse” unless Product/Platform explicitly accepts losing the audit-aligned runtime state.

## Warning: `rejected_by_validator`

Meaning:

The file signature and schema were valid, but the current code validator rejected the payload. Usually this means code defaults or validation rules changed after the file was written.

Remediation:

1. Review the warning details for the rejected path.
2. Compare the tenant's required override against the current accepted schema.
3. Re-apply a corrected payload through the SuperAdmin proposal/execute flow.
4. Verify current snapshot and audit trail after refresh.

## Tenant Safety Checklist

Before applying or resetting layout capacity:

- Confirm the SuperAdmin account is in the intended organization.
- Confirm the panel `scope` is `tenant`.
- Capture the current vs defaults diff before execution.
- Use a reason that names the tenant and operational intent.
- After execute, verify another tenant does not show the same runtime diff unless intentionally configured.

## Emergency Reset

Use only when the current tenant runtime override is unsafe or confusing.

1. In SuperAdmin panel, click reset-to-defaults proposal.
2. Review the pre-reset snapshot shown in the confirmation step.
3. Confirm reset.
4. Verify the post-reset snapshot equals defaults for the current tenant.
5. Confirm audit event: `presentation_studio_layout_capacity_overrides_reset`.
6. Re-apply only the tenant-specific overrides still required.

For `io_error`, reset may not clear the warning if disk operations are still failing. Fix the filesystem first.

## Acceptance Evidence

To call remediation complete, collect:

- SuperAdmin panel screenshot or test evidence showing no `loadWarning`.
- Current vs defaults diff for the intended tenant.
- Audit event id(s) for reset/re-apply.
- Refresh evidence proving the state survives reload.
- If the issue was `io_error`, storage/permission evidence showing the runtime path is healthy.
