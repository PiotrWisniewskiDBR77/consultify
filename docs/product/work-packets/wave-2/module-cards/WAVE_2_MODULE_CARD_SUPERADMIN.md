# Wave 2 Module Card — Superadmin

> Cluster: `Platform Control And Reach`
> Scope: broad platform-operator product beyond bounded admin/operator closure

## 1. Module scope

This card covers the platform-operator branch:

- domain map,
- vertical control towers,
- cross-tenant operations,
- health, audit, compliance,
- platform configuration,
- and connector/AI/operator governance.

## 2. Source of truth reviewed

- `docs/product/SUPERADMIN_V8_SSOT.md`
- `docs/product/VIRTUAL_WORKERS_SUPERADMIN_V8_READINESS_AUDIT.md`
- `docs/product/VIRTUAL_WORKERS_SUPERADMIN_BENCHMARK_V8.md`
- `docs/product/VIRTUAL_WORKERS_SUPERADMIN_CONTROL_PLANE_V8.md`
- `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`

## 3. Intended product behavior

`Superadmin` should be a true platform control plane:

- visible branches for every critical domain,
- cross-tenant search and operations,
- platform health and emergency controls,
- AI and connector governance,
- and one clear ownership boundary against tenant admin.

## 4. Current repo and doc truth

Current truth is uneven:

- the horizontal IA is documented well,
- `Virtual Workers` is strongly documented,
- partner and help content ops also have strong verticals,
- but `SYSTEMATYKA` still says broad superadmin coverage is only partial,
- and the SSOT itself lists multiple high-severity gaps.

## 5. Competitive standard

Wave 2 should judge this against serious control planes:

- visible domain navigation,
- fleet health,
- auditability,
- cross-tenant tooling,
- and low-chaos operational intervention.

## 6. Current-state assessment

- `User value`: partial. High platform value exists, but operator breadth is incomplete.
- `Flow completeness`: partial. Strong verticals exist, not all platform domains are mounted.
- `UX quality`: partial. IA is defined; many branches are still hidden or undocumented.
- `Data / logic quality`: good. Domain map and ownership model are explicit.
- `Integration quality`: good. Horizontal structure clearly references vertical packages.
- `Trust / governance`: good. Superadmin exists precisely to own cross-tenant governance.
- `Market standard fit`: partial. Strong on doctrine, incomplete on visible platform breadth.

## 7. Main gaps

- no full organizations/tenants V8 operator package,
- no cross-tenant user management package,
- no full platform configuration package,
- AI platform Superadmin surfaces remain partial,
- connector fleet still needs visible Superadmin mounting,
- audit/compliance and demo/trial ops are still partial.

## 8. Minimal acceptance state now

The first acceptable Wave 2 state is:

- one visible Superadmin root,
- mounted connector, partner, help, and AI branches,
- one organizations/tenants branch,
- and one cross-tenant health/search baseline.

## 9. Full 100% target state

`Superadmin` reaches 100% only when it includes:

- complete domain map mounted in UI,
- organizations, users, and platform config branches,
- connector fleet branch,
- AI platform branch,
- partner and help control towers,
- platform health,
- audit/compliance,
- demo/trial operations,
- and durable cross-tenant emergency controls.

## 10. Top missing functions and flows

- organizations/tenants control flow
- cross-tenant user operations
- platform configuration and flag governance
- connector fleet mounting and support tooling
- audit/compliance and emergency intervention flows

## 11. Proposed bounded delivery packets

1. `Superadmin root closure`
   - mount the missing major branches into one visible IA
2. `Tenant and user operator package`
   - define the missing cross-tenant operational surfaces
3. `AI and connector platform ops`
   - close AI platform and connector-fleet operator branches
4. `Audit, health, and emergency controls`
   - make platform supportability and control complete

## 12. Risks and dependencies

- depends on `Organization`, `Admin`, `Settings`, `Partner`, `Help`, and `Sync`,
- risks remaining a domain map without implementation sequence,
- risks blurring tenant admin and platform operator responsibilities.
