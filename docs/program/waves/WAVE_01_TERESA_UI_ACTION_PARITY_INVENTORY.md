# Wave 01 — Teresa ↔ UI action parity inventory

Status: `INVENTORY_COMPLETE / GLOBAL_PARITY_GAP_CONFIRMED`  
Evidence SHA: `a54e7d32a6` parent plus this document

## Executive result

Consultify does not currently have one application-wide action registry. It has three governed mechanisms plus module-local actions. Parity is strong inside Idea Workspace, partial inside Dynamic SWOT and proposal-first for the principal Chat tools, but there is no 100% denominator covering every mounted MVP mutation.

Therefore the truthful result is not “Teresa controls the whole application”. It is:

- `IDEA_WORKSPACE`: registry parity structurally proven;
- `DYNAMIC_SWOT`: lifecycle kernel proven, capability implementation incomplete;
- `CHAT_CORE_TOOLS`: principal mutations are proposal-first;
- `OTHER_MVP_MODULES`: no global parity proof; requires Wave 02 registry federation.

## Registry A — Idea Workspace

Sources:

- `src/actions/ideaActionRegistry.ts` and `src/actions/registry/*.ts`;
- `src/actions/teresaActionManifest.ts`;
- `tests/unit/actions/teresaActionManifest.test.ts`.

Measured current source shape:

- 135 `ActionDef` entries;
- 135/135 declare `mutates`, `requiresPreview`, Teresa metadata and a required handler field;
- generated manifest test proves exactly one unique Teresa tool per registry action;
- active-tool filtering uses the same registry availability rule;
- hallucinated tool names fail closed;
- governed transport disables the legacy regex executor, so it is rollback rather than a simultaneous second writer.

Disposition: `PARITY_PROVEN_WITHIN_IDEA_SCOPE`. The historical source comment saying 231 actions is stale and must not be used as the denominator.

## Registry B — Dynamic SWOT Teresa kernel

Sources:

- `server/src/services/teresa/teresaCapabilities.ts`;
- `server/src/services/teresa/teresaKernel.ts`;
- `server/src/services/teresa/teresaEventStore.ts`;
- `tests/integration/teresa/teresaKernel.realdb.test.ts`.

Measured current source shape:

- 23 closed-set capability entries;
- only 6 currently have drafting handlers;
- kernel enforces preview, expiry, human decision, idempotency, refusal, event authorship and settle receipts;
- unsupported/forbidden capabilities fail closed.

Disposition: `LIFECYCLE_PROVEN / CAPABILITY_PARITY_PARTIAL`. The missing 17 handlers must be mapped to actual mounted UI actions or marked `NOT_SUPPORTED_IN_MVP`; merely declaring a capability is not implementation.

## Registry C — Chat server tools

Source: `server/src/services/ai/toolDefinitions.ts`.

Measured current source shape:

- 19 tool definitions;
- read/search/calculation tools are mixed with mutating proposals;
- the principal mutation tools (`create_initiative_draft`, `schedule_meeting`, `create_notebook_entry`, `create_task`, `update_task`, `create_decision`) explicitly return proposal/`awaiting_approval` behavior rather than performing the final write directly.

Disposition: `PROPOSAL_FIRST_FOR_DECLARED_MUTATIONS`, but this list is not generated from the mounted UI and cannot prove application-wide parity.

## Module-local and server-side registries

Additional action mechanisms exist, including Execution action registry services, Case Workspace proposals, Results Teresa panels and module-specific callbacks. They are not federated into one versioned registry and cannot currently answer these questions globally:

- Is every mounted UI mutation available to Teresa?
- Does Teresa have any mutation absent from the UI?
- Are role, tenant, preview, confirm, receipt, audit and compensation policies identical?
- Which action is intentionally unsupported in MVP?

Disposition: `GLOBAL_DENOMINATOR_MISSING` — P0 architectural governance gap for the promised “Teresa manages the whole application”, though it does not invalidate the narrower working registries above.

## Wave 02 implementation contract

Create a federated, read-only manifest builder that consumes module registries rather than replacing them. Every entry must expose:

| Field | Required rule |
|---|---|
| `actionId` | globally unique and versioned |
| `module` / `surface` | mounted route and visible UI trigger |
| `effect` | read, proposal, reversible mutation or destructive mutation |
| `roles` / `tenantScope` | identical for UI and Teresa |
| `preview` / `confirm` | mandatory according to effect |
| `idempotency` | required for every mutation |
| `receipt` / `auditEvent` | required for every committed mutation |
| `compensation` | undo, compensating action or explicit irreversible boundary |
| `uiExecutor` / `teresaExecutor` | same handler or proven shared command |
| `mvpDisposition` | supported, approved-out or not-supported; never unknown |

The first generated matrix must cover all mounted MVP routes and use `MISSING` as a test failure. Existing Idea, SWOT, Chat, Execution and Case registries become adapters into this manifest; they must not be copied into another manually maintained list.

## Tests executed

`npx vitest run tests/unit/actions/teresaActionManifest.test.ts --retry=0 --reporter=dot`

Result: 1 file, 5/5 tests passed.

## Wave 01 conclusion

The inventory has a closed conclusion and an implementable next packet. Full application parity is not yet accepted; Idea parity is. Wave 02 must create the global denominator before adding broad new Teresa powers.

