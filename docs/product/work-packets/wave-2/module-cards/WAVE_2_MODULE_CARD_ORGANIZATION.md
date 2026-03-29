# Wave 2 Module Card — Organization

> Cluster: `Platform Control And Reach`
> Scope: tenant-facing organization intelligence and lifecycle layer

## 1. Module scope

This card covers:

- organization profile,
- ownership,
- regional/fiscal settings,
- approved domains,
- org intelligence fields,
- and the tenant-level organization operating model.

## 2. Source of truth reviewed

- `docs/product/modules/admin/ADMIN_ORGANIZATION_MODULE_FINAL.md`
- `docs/product/modules/admin/ADMIN_ORGANIZATION_MODULE_ANALYSIS.md`
- `docs/product/SUPERADMIN_V8_SSOT.md`
- `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`

## 3. Intended product behavior

`Organization` should be a first-class tenant module:

- define who the organization is,
- how it operates,
- what rules and defaults govern it,
- and what metadata is available for downstream intelligence, permissions, and external trust.

## 4. Current repo and doc truth

Implementation evidence is strong in legacy/admin docs, but product canon is weak:

- the final report claims 100% implementation for core organization areas,
- `SYSTEMATYKA` still says there is no full `Organization v8` canon,
- and `SUPERADMIN_V8_SSOT.md` treats organizations/tenants as a gap on the platform side.

## 5. Competitive standard

The benchmark is tenant administration products where:

- org identity,
- ownership,
- domains,
- locale and billing context,
- and org intelligence

are clearly modeled and usable elsewhere in the product.

## 6. Current-state assessment

- `User value`: partial. Core mechanics exist, but the module lacks a full V8 product canon.
- `Flow completeness`: partial. Core views and endpoints exist, broader org-intelligence logic is missing.
- `UX quality`: partial. Implementation exists, target UX doctrine is under-defined.
- `Data / logic quality`: good. Key org endpoints and entities already exist.
- `Integration quality`: partial. Cross-module use is implied more than formally packaged.
- `Trust / governance`: good. Ownership and domains are serious controls.
- `Market standard fit`: partial. Strong admin mechanics, incomplete product-level framing.

## 7. Main gaps

- no `Organization v8` SSOT,
- no org-intelligence model beyond the core admin fields,
- unclear target for what else should be collected and reused,
- no clean tenant-facing product doctrine distinct from superadmin.

## 8. Minimal acceptance state now

The first acceptable Wave 2 state is:

- one canonical organization module definition,
- one clean model for profile, ownership, domains, and regional controls,
- and one explicit contract for where org metadata is reused.

## 9. Full 100% target state

`Organization` reaches 100% only when it includes:

- profile and branding,
- ownership and lifecycle,
- regional and fiscal defaults,
- approved domains and trust settings,
- org-intelligence fields,
- and explicit downstream use in admin, help, sync, partner, and AI contexts.

## 10. Top missing functions and flows

- organization intelligence model
- downstream reuse of org metadata
- tenant lifecycle beyond basic settings
- explicit split between organization and settings
- organization-to-superadmin operator visibility contract

## 11. Proposed bounded delivery packets

1. `Organization v8 canon`
2. `Organization intelligence model`
3. `Cross-module org reuse contract`
4. `Tenant lifecycle and trust controls`

## 12. Risks and dependencies

- depends on `Settings`, `Admin`, and `Superadmin`,
- risks relying on old admin implementation reports as if they were full product canon,
- risks blurring tenant and platform layers.
