# Wave 2 Module Card — Admin

> Cluster: `Platform Control And Reach`
> Scope: tenant-facing admin and team operations layer

## 1. Module scope

This card covers:

- admin-facing team and organization operations,
- tenant-scoped operational settings,
- profiling and team management,
- and the handoff between admin and organization settings.

## 2. Source of truth reviewed

- `docs/product/modules/admin/ADMIN_ORGANIZATION_MODULE_FINAL.md`
- `docs/product/SUPERADMIN_V8_SSOT.md`
- `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- sync/admin references inside `SYSTEMATYKA`

## 3. Intended product behavior

`Admin` should be the tenant operator layer:

- manage team and organization-facing operational controls,
- see and maintain tenant-scoped settings,
- handle synchronization and organization-level operations,
- and stay clearly separate from platform-level `Superadmin`.

## 4. Current repo and doc truth

Current truth is partial:

- admin implementation evidence exists,
- sync/admin docs are strong in one sub-area,
- but `SYSTEMATYKA` still says broad admin coverage is only partial and lacks one team-profiling package,
- so `Admin` remains stronger in fragments than as one V8 module.

## 5. Competitive standard

The benchmark is tenant administration products where:

- admin tasks are coherent,
- operational visibility is strong,
- team controls are clear,
- and admins do not need to visit many unrelated screens to run the tenant.

## 6. Current-state assessment

- `User value`: partial. Real value exists, especially around org and sync operations.
- `Flow completeness`: partial. Team-facing admin breadth is not fully packaged.
- `UX quality`: partial. Current behavior is more capability-rich than canon-rich.
- `Data / logic quality`: good. There is real operational logic already.
- `Integration quality`: partial to good. Admin already touches organization and sync strongly.
- `Trust / governance`: good. Tenant/platform boundary is explicit in superadmin docs.
- `Market standard fit`: partial. Admin is real, but not yet one clean product package.

## 7. Main gaps

- no one tenant-admin V8 package,
- weak team profiling and admin cockpit definition,
- fragmented relationship between admin, organization, and settings,
- strong sync/admin subarea without a broader admin system around it.

## 8. Minimal acceptance state now

The first acceptable Wave 2 state is:

- one tenant-admin product definition,
- one clear admin root,
- and one coherent split between team operations, org controls, and sync controls.

## 9. Full 100% target state

`Admin` reaches 100% only when it includes:

- team and tenant operations,
- organization and settings handoff,
- profiling and membership views,
- sync/integration controls,
- and one clear tenant operator cockpit.

## 10. Top missing functions and flows

- team profiling and admin visibility
- one admin root and navigation
- org/settings/admin ownership split
- sync controls inside one tenant-operator model
- admin-to-superadmin escalation paths

## 11. Proposed bounded delivery packets

1. `Admin v8 canon`
2. `Tenant operator cockpit`
3. `Team profiling and admin visibility`
4. `Admin ownership cleanup`

## 12. Risks and dependencies

- depends on `Organization`, `Settings`, `Synchronizacja`, and `Superadmin`,
- risks duplicating organization settings,
- risks using only legacy implementation reports as product truth.
