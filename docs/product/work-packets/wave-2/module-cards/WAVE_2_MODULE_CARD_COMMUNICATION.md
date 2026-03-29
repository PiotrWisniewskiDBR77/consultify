# Wave 2 Module Card — Communication

> Cluster: `Connectivity And Communication`
> Scope: standalone `Komunikacja` product beyond narrow in-work message flows

## 1. Module scope

This card covers:

- internal communication,
- external communication,
- channel routing,
- message-to-work conversion,
- and connector-backed communication policy.

It does not replace:

- `Chat` as AI conversation shell,
- `Inbox` as action queue,
- or `Sync` as provider mechanics.

## 2. Source of truth reviewed

- `docs/product/COMMUNICATION_V8_SSOT.md`
- `docs/product/COMMUNICATION_V8_READINESS_AUDIT.md`
- `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`
- `docs/product/work-packets/MANAGER_FALA_1_CANONICAL_EXECUTION_MAP_2026-03-28.md`
- `docs/product/work-packets/V8_EXECUTION_WAVES_NOW_LATER_2026-03-28.md`
- `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`

## 3. Intended product behavior

`Communication` should be a governed work-forward communication layer:

- attach messages to business context,
- separate internal vs external communication,
- reduce noise through routing and action extraction,
- and turn communication into visible governed work.

## 4. Current repo and doc truth

Doc truth is stronger than product packaging:

- `COMMUNICATION_V8_SSOT.md` defines a real module doctrine,
- the gap analysis says a bounded communication lane was accepted,
- but the manager map parked `Komunikacja` as a separate product,
- and `SYSTEMATYKA` still indicates no single finished communication package in the earlier planning layer.

## 5. Competitive standard

Wave 2 should judge this against:

- Slack and Teams for channel clarity,
- project-delivery communication tools,
- and workflow systems that convert messages into actions cleanly.

The standard is not a chat clone.
The standard is governed routing, context preservation, and low-chaos execution.

## 6. Current-state assessment

- `User value`: partial. Strong doctrine exists, but the module identity is still thin.
- `Flow completeness`: partial. Routing and policy are defined, but end-to-end communication journeys are not packaged as one product.
- `UX quality`: partial. Communication is still scattered across adjacent surfaces.
- `Data / logic quality`: good. The policy and class model are explicit.
- `Integration quality`: good. The module is already defined against chat, inbox, and sync.
- `Trust / governance`: good. Internal/external separation is a core rule.
- `Market standard fit`: partial. Stronger governance than generic chat tools, weaker product closure.

## 7. Main gaps

- no one visible communication workspace or canonical shell,
- no fully packaged internal/external communication journeys,
- no explicit operator-grade communication health surface,
- communication doctrine is stronger than user-facing surface reality,
- risk of scope confusion with chat, inbox, and sync.

## 8. Minimal acceptance state now

The first acceptable Wave 2 state is:

- one clearly defined communication surface family,
- one internal flow and one external flow that connect to work objects,
- explicit channel class visibility,
- and no confusion about who can send what through which channel.

## 9. Full 100% target state

`Communication` reaches 100% only when it provides:

- internal and external communication workspaces,
- policy-aware routing,
- object-linked communication threads,
- review and delivery prompts,
- synced channel visibility,
- health and delivery state,
- and clear downstream conversion into tasks, decisions, approvals, and deliverables.

## 10. Top missing functions and flows

- internal discussion to task/decision routing
- external delivery updates tied to initiatives and artifacts
- channel routing and allowed-channel policy enforcement
- communication health and failure visibility
- one canonical message-to-work lifecycle

## 11. Proposed bounded delivery packets

1. `Communication surface model`
   - define the canonical UI/surface family
2. `Internal-to-work routing`
   - turn internal communication into governed tasks/decisions/actions
3. `External delivery communication`
   - create a safe client-facing delivery/update flow
4. `Channel health and policy visibility`
   - expose allowed channels, delivery state, and failure cases

## 12. Risks and dependencies

- depends heavily on `Synchronizacja`,
- depends on `Chat`, `Inbox`, and `Execution` contracts,
- risks turning into a generic chat rebuild,
- risks duplicating channel logic that should stay in sync/connectors.
