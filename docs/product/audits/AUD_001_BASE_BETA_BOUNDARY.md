# AUD-001 base Audit Programs beta

## Canonical beta surface

- Signed-in route: `/audit-programs`
- UI owner: `AuditProgramsHub`
- API owner: `/api/audit/programs`
- Persistence root: `audit_programs`
- Access label: `beta`

The beta promise is deliberately limited to organization-scoped program list,
create, save, cold reopen, and delete. Organization members may read. Program
mutations require consultant, manager, admin, owner, or superadmin role.

## Explicitly outside this promise

`/api/audits` and `/audit-programs/method` are the advanced Method Audit kernel.
The UI remains behind `auditsFiveSurfacesV1`; AUD-001 does not promote it, merge
its lifecycle into the base hub, or claim pack rights, segregation of duties,
criterion-to-finding closure, or effectiveness verification.

The public audits showcase is marketing/navigation content. It is not runtime
evidence and must not be used to claim that either signed-in product is complete.

## Browser fixture

Create an ordinary draft program from the signed-in hub, save a changed name and
objective, then set it to completed through the API fixture before verifying the
visible Reopen action. Reopen must return the same program identity in draft;
delete must remove it from a cold registry reload. Use a second organization to
verify read/update/delete return no cross-tenant object.
