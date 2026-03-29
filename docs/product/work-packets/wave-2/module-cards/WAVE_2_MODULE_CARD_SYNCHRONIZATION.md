# Wave 2 Module Card — Synchronizacja

> Cluster: `Connectivity And Communication`
> Scope: broad enterprise sync platform beyond the bounded accepted connector lane

## 1. Module scope

This card covers:

- provider connect lifecycle,
- OAuth round-trip,
- connector platform UX,
- provider-depth parity,
- fleet health,
- and easy setup plus monitoring flow.

## 2. Source of truth reviewed

- `docs/product/EXTERNAL_SYNC_READINESS_AUDIT_V8.md`
- `docs/product/SYNC_PLATFORM_BENCHMARK_V8.md`
- `docs/product/CONNECTOR_IMPLEMENTATION_PLAN_V8.md`
- `docs/product/CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md`
- `docs/product/CURRENT_SYNC_CONNECTION_METHOD_AND_TARGET_FLOW_V8.md`
- `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`
- `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`

## 3. Intended product behavior

`Synchronizacja` should be a coherent external sync platform:

- choose provider,
- connect,
- authorize,
- configure scope,
- map,
- test,
- enable,
- monitor,
- and recover.

## 4. Current repo and doc truth

Current truth is split:

- the bounded connector lane was accepted in Wave 1 closure,
- but the historical audit and gap analysis still explicitly say the broad product is only partial,
- and the biggest open areas are OAuth lifecycle, provider-depth completion, and one easy-sync setup shell.

## 5. Competitive standard

Wave 2 should judge this against:

- Zapier / Make / Workato / Boomi class connector platforms,
- and mature admin/operator sync systems with clear onboarding, health, and recovery.

## 6. Current-state assessment

- `User value`: partial. Real connector value exists, but broad enterprise sync is not yet coherent.
- `Flow completeness`: partial. Inventory, health, reauth, and admin controls are stronger than end-to-end connect completion.
- `UX quality`: partial. Setup and ownership remain fragmented.
- `Data / logic quality`: good. The platform has meaningful foundations.
- `Integration quality`: good. Connectors already touch calendar, comms, PM, knowledge, and AI paths.
- `Trust / governance`: good. Health, guardrails, and operator doctrine are documented.
- `Market standard fit`: partial. Good foundations, not yet leader-grade platform completeness.

## 7. Main gaps

- no one canonical easy-sync setup shell,
- incomplete OAuth lifecycle across top providers,
- no complete provider-depth parity,
- support/operator tooling stronger than user setup flow,
- no full superadmin provider control plane.

## 8. Minimal acceptance state now

The first acceptable Wave 2 state is:

- one canonical provider-connect journey,
- one complete OAuth lifecycle for the top provider families,
- and one visible setup-to-monitoring path users can finish without guesswork.

## 9. Full 100% target state

`Synchronizacja` reaches 100% only when it includes:

- end-to-end provider onboarding,
- callback, refresh, reauth, revoke,
- mapping and test flow,
- monitoring and recovery,
- provider-depth parity for the chosen families,
- and clear split between tenant and superadmin controls.

## 10. Top missing functions and flows

- choose provider -> connect -> callback -> enable
- provider scope and mapping flow
- post-connect monitoring and recovery flow
- user and org ownership model
- superadmin provider catalog and policy controls

## 11. Proposed bounded delivery packets

1. `Easy-sync setup shell`
2. `OAuth lifecycle closure`
3. `Provider-depth parity`
4. `Operator and superadmin sync control plane`

## 12. Risks and dependencies

- depends on `Communication`, `Admin`, `Superadmin`, and connected product modules,
- risks reopening bounded accepted work without separating broad gap from closed lane,
- risks building provider-by-provider forever without one canonical platform journey first.
