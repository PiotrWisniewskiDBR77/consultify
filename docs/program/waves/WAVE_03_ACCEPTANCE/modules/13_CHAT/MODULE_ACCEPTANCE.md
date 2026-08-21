# Wave 3 — Chat acceptance

ID: `CHAT`
Routes: `/chat`
Current gate: `TECHNICAL_PREFLIGHT`
Owner: Piotr Wisniewski
Integrator: Codex
Mobile: `DEFERRED_NON_GATING`

## Contract

Primary journey: continue a sourced conversation, inspect/approve a governed
proposal and cold-reopen it. Required boundaries: provider failure,
stale/replayed approval, foreign tenant and no false citation or success.

## G00–G20 checklist

| Gate | Mandatory outcome | State | Evidence/decision |
|---|---|---|---|
| G00 | Scope, routes, dependencies, 82-task links and exclusions | `PASS` | Canonical UI routes are `/chat` and `/chat/:conversationId`; `/api/ai` owns streaming/history/recovery and `/api/v8/chat` owns governed snapshots, proposals, decisions and owner delivery. Task links: `CHAT-BVP-001`, `CHAT-NFR-001`, `CHAT-UI-CANON-001`; historical evidence reports `DONE_CURRENT_SHA` but was mapped rather than treated as runtime proof. Live-provider guarantees, mobile, production integrations and release are excluded. |
| G01 | Exact baseline and client/server/runtime/DB/migrations | `PASS_FOR_PREFLIGHT` | Source baseline inspected on branch `codex/wave3-16-module-acceptance-20260821`, HEAD `6abc09b71c0c580bbcfb3292841bf76364543221`. Shared worktree contains unrelated Materials work, so this is not a frozen acceptance SHA. Backend typecheck PASS. Fresh migrations, disposable RealPG and mounted runtime/DB qualification remain pending. |
| G02 | Journeys, writes/readbacks, upstream/downstream and policy map | `PASS_FOR_PREFLIGHT` | Primary journey is sourced conversation → governed proposal → human decision → cold reopen. Server derives authoritative citations and hashes the source payload; provider absent/empty/failure paths return explicit fail-closed errors without phantom proposals. Proposal creation is idempotent, decisions and case confirmation reject stale/conflicting state, owner delivery is lease/claim-token guarded and target mapping uses immutable receipts/reconciliation. Cold provider and database readbacks remain G04/G05 work. |
| G03 | Named allowed/denied personas | `PASS_FOR_PREFLIGHT` | Allowed: active same-tenant OWNER/ADMIN for the complete owner-delivery journey; active same-tenant MEMBER for conversation/proposal access and, under the current contract, approve/reject. Denied: anonymous, revoked membership and foreign tenant; owner ingress/claim/complete/materialize additionally denies non-admin members. Whether MEMBER decision authority is intended remains an explicit owner policy confirmation, not a hidden defect. |
| G04 | Reproducible realistic and boundary fixtures | `IN_PROGRESS` | Deterministic disposable-PostgreSQL owner fixture is designed but not implemented or seeded. It must use explicit tenant/persona/conversation/source/proposal IDs, no live provider, seed/readback/reset modes, loopback/database-prefix guards and whole-database reset with catalog-absence proof. |
| G05 | Functional preflight and cold readback | `IN_PROGRESS` | Exact-current focused replay: `8/8` files and `139/139 PASS`, including structural no-fallback and negative membership-denial assertions that block service execution. Backend typecheck and `git diff --check` PASS. Repeated React `act(...)` warnings remain non-gating harness debt. Fresh disposable RealPG, residue cleanup, cold database/UI readback and browser/owner gates are not claimed. |
| G06 | Desktop/tablet, PL/EN, themes, states, a11y, console/HTTP | `NOT_STARTED` | — |
| G07 | Piotr review card | `NOT_STARTED` | — |
| G08 | First-impression review | `NOT_STARTED` | — |
| G09 | Guided CX journey review | `NOT_STARTED` | — |
| G10 | Alternate-state owner review | `NOT_STARTED` | — |
| G11 | Every owner observation/screenshot durably registered | `NOT_STARTED` | — |
| G12 | Owner register reconciled and confirmed | `NOT_STARTED` | — |
| G13 | Solution and impact analysis | `NOT_STARTED` | — |
| G14 | Remediation with finding-to-commit traceability | `NOT_STARTED` | — |
| G15 | Integrator self-QA and impacted regression | `NOT_STARTED` | — |
| G16 | Before/after owner retest packet | `NOT_STARTED` | — |
| G17 | Owner retest decisions for every finding | `NOT_STARTED` | — |
| G18 | Module accepted on exact SHA and checkpointed | `NOT_STARTED` | — |
| G19 | Later-change regression obligations resolved | `NOT_STARTED` | — |
| G20 | Final 16/16 replay | `NOT_STARTED` | — |

## Piotr review card

| Purpose/value | Starting route | Persona/data | Guided actions | Conscious exclusions | Observation prompts |
|---|---|---|---|---|---|
| Verify that Chat distinguishes cited conversation from governed action and preserves the human decision | `/chat/:conversationId` using the deterministic fixture deep link | Piotr: active same-tenant OWNER; cited source message plus pending governed proposal | Verify source/citation correspondence → inspect target/title/command → approve or reject with reason → cold reopen → integrator verifies no duplicate target/receipt and runs prepared stale/replay/foreign boundaries | Mobile, live-provider quality/latency, production integrations and release | Citation trust; proposal-versus-action clarity; decision feedback; continuity; failure/recovery clarity |

## Persona and fixture ledger

| ID | Type | Purpose | Setup/reset | Readback | Expected access | Status/evidence |
|---|---|---|---|---|---|---|
| `CHAT-P-OWNER` | allowed | Full sourced-conversation, decision and owner-delivery journey | deterministic fixture pending | conversation/proposal/decision/receipt | active same-tenant OWNER | `DESIGNED_NOT_SEEDED` |
| `CHAT-P-MEMBER` | conditionally allowed | Confirm collaborative proposal decision policy and owner-ingress denial | deterministic fixture pending | proposal state; zero owner-ingress writes | active same-tenant MEMBER; owner ingress denied | `POLICY_CONFIRMATION_PENDING` |
| `CHAT-P-REVOKED` | denied | Stale JWT/member revocation boundary | deterministic fixture pending | zero service writes | membership guard denies | `DESIGNED_NOT_SEEDED` |
| `CHAT-P-FOREIGN` | denied | Tenant non-disclosure and zero-write boundary | deterministic fixture pending | target/proposal not found; zero writes | foreign-tenant OWNER | `DESIGNED_NOT_SEEDED` |
| `CHAT-P-ANON` | denied | Authentication boundary | no fixture data required | zero writes | `401` | `READY_FOR_REPLAY` |

## Owner UI/UX/CX register

| Finding ID | Captured | Piotr original wording | Category | Route/screen | Current behavior | Expected experience | Impact | Screenshot/hash | Product SHA | Severity | Decision/status | Fix commit | Self-QA | Owner retest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| _none_ | | | | | | | | | | | | | | |

## Implementation/regression ledger

| Finding IDs | Root cause | Approved solution | Commit | Shared surfaces | Impacted modules | Tests/self-QA | Regression |
|---|---|---|---|---|---|---|---|
| `CHAT-PF-001` | Chat membership guard silently fell through when the middleware export was absent | Directly import the required guard so module construction fails closed; add structural no-fallback and denial-before-service assertions | — | V8 Chat routes and isolated route mocks | Chat | focused `139/139`; backend typecheck PASS | open until frozen candidate/regression replay |

## Owner verdict

Decision: `PENDING`
Accepted SHA: —
Date: —
Accepted-out/deferred: —
Evidence manifest: —
