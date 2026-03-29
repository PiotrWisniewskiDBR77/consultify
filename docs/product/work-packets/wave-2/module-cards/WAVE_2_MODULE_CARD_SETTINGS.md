# Wave 2 Module Card — Settings

> Cluster: `Platform Control And Reach`
> Scope: coherent settings layer for user, tenant, policy, and profile controls

## 1. Module scope

This card covers the broad `Settings` layer:

- user preferences,
- profile and skills settings,
- tenant-level settings handoff,
- notification and memory/policy settings,
- and the relationship between local module settings and shared settings roots.

## 2. Source of truth reviewed

- `docs/product/SUPERADMIN_V8_SSOT.md`
- `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- `docs/product/modules/admin/ADMIN_ORGANIZATION_MODULE_FINAL.md`
- settings routes and organization references cited in admin docs

## 3. Intended product behavior

`Settings` should be a coherent control layer where users and tenant admins can:

- understand what can be configured,
- change it safely,
- see what affects only them versus the tenant,
- and trust that settings actually affect runtime behavior.

## 4. Current repo and doc truth

This is one of the weakest planning areas:

- settings endpoints exist in implementation reports,
- related logic exists in memory, notifications, organization, and admin docs,
- but `SYSTEMATYKA` says there is no real package for better competency profiling or a strong settings canon,
- so the implementation surface is wider than the product doctrine.

## 5. Competitive standard

The benchmark is settings systems that:

- clearly separate user, workspace, and platform scopes,
- expose meaningful controls,
- and connect settings to real runtime outcomes instead of hiding them in legacy forms.

## 6. Current-state assessment

- `User value`: low to partial. Settings exist, but not as one strong user-facing product.
- `Flow completeness`: low. The control model is fragmented.
- `UX quality`: low to partial. No unified V8 settings doctrine is visible.
- `Data / logic quality`: partial. Real settings endpoints exist.
- `Integration quality`: partial. Settings are scattered across modules.
- `Trust / governance`: partial. Scope boundaries are not yet clear enough.
- `Market standard fit`: low. Settings are more infrastructure than finished product.

## 7. Main gaps

- no canonical settings package,
- no competency/profile settings model,
- no clear split between personal settings, tenant settings, and module settings,
- weak visibility of runtime impact.

## 8. Minimal acceptance state now

The first acceptable Wave 2 state is:

- one settings taxonomy,
- one scope split for user vs tenant vs module,
- and one visible list of settings that materially affect runtime behavior.

## 9. Full 100% target state

`Settings` reaches 100% only when it includes:

- personal preferences,
- profile and competency settings,
- notifications and memory controls,
- tenant-facing defaults where appropriate,
- and clear ownership between settings root, organization settings, and module settings.

## 10. Top missing functions and flows

- user profile and competency settings
- settings scope model
- settings-to-runtime visibility
- unified notifications/memory/policy settings
- admin and organization handoff rules

## 11. Proposed bounded delivery packets

1. `Settings taxonomy`
2. `User profile and competency settings`
3. `Runtime-impact visibility`
4. `Settings ownership cleanup`

## 12. Risks and dependencies

- depends on `Organization`, `Admin`, and AI-control surfaces,
- risks duplicating module settings,
- risks becoming a generic preferences screen instead of a meaningful control system.
