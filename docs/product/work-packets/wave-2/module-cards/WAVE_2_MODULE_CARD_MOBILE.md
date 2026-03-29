# Wave 2 Module Card — Mobile

> Cluster: `Platform Control And Reach`
> Scope: mobile support, scope statement, and mobile operating parity

## 1. Module scope

This card covers:

- mobile product scope,
- supported mobile surfaces,
- responsive parity,
- PWA trajectory,
- and explicit non-goals.

## 2. Source of truth reviewed

- `docs/flows/core/MOBILE_PWA_FLOW.md`
- `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- `docs/product/work-packets/cursor-work/V8_V81_CLOSURE_LEDGER.md`

## 3. Intended product behavior

`Mobile` should define what Consultify supports credibly on mobile:

- which views work well,
- which actions are mobile-first,
- which flows are review-only,
- and what remains future PWA or native territory.

## 4. Current repo and doc truth

Current truth is contradictory:

- `SYSTEMATYKA` says there is no real mobile package,
- the closure ledger defers mobile as a broader area,
- while `FLOW-MOBILE-001` gives a historical flow and strategy snapshot,
- which means there is direction but not one canonical V8 mobile program.

## 5. Competitive standard

Wave 2 should judge this against modern mobile-first business products where:

- critical daily workflows work well on phones,
- decisions can be reviewed quickly,
- and the product clearly distinguishes mobile-first, mobile-safe, and desktop-only experiences.

## 6. Current-state assessment

- `User value`: partial. Some responsive continuity exists, but no strong mobile product promise is frozen.
- `Flow completeness`: low to partial. Mobile strategy exists, not a V8 package.
- `UX quality`: partial. Some shell/mobile work landed, but no canonical final target.
- `Data / logic quality`: neutral. Mobile is mostly a surface scope problem.
- `Integration quality`: partial. Mobile intersects many modules but owns no single core truth.
- `Trust / governance`: partial. No explicit support matrix exists.
- `Market standard fit`: low to partial. Mobile continuity exists, product positioning is weak.

## 7. Main gaps

- no canonical mobile scope statement,
- no support matrix by module and flow,
- no explicit non-goals,
- no final judgment of what is mobile-first vs mobile-safe vs desktop-only.

## 8. Minimal acceptance state now

The first acceptable Wave 2 state is:

- one mobile scope statement,
- one support matrix for critical flows,
- and one clear statement about PWA future versus present support.

## 9. Full 100% target state

`Mobile` reaches 100% only when it provides:

- explicit supported surfaces,
- high-quality mobile UX for critical daily flows,
- review/approval capability where expected,
- and one stable path toward deeper PWA behavior if still in scope.

## 10. Top missing functions and flows

- mobile support matrix by module
- daily-work mobile flow definition
- review/approval-on-the-go definition
- PWA readiness boundary
- mobile-specific navigation and density doctrine

## 11. Proposed bounded delivery packets

1. `Mobile V8 scope statement`
2. `Critical-flow mobile matrix`
3. `Mobile interaction doctrine`
4. `PWA and future-boundary clarification`

## 12. Risks and dependencies

- depends on `MyWork`, `Assessment`, `Chat`, `Reports`, and `Settings`,
- risks becoming a vague “responsive app” claim,
- risks overpromising native or offline capabilities that are only historical strategy notes.
