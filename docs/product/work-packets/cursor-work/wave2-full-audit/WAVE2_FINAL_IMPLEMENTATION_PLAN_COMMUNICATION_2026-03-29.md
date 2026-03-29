# Wave 2 Final Implementation Plan - Komunikacja

Date: 2026-03-29
Module: `Komunikacja`
Scope: final implementation plan for the standalone Wave 2 communication product family

## 1. Scope

This plan covers only `Komunikacja` as the standalone communication product area.

It does not widen scope into:

- replacing `Chat`
- replacing `Inbox`
- owning sync mechanics that belong to `Synchronizacja`

## 2. Canonical Source Stack

- `docs/product/work-packets/wave-2/WAVE_2_CANONICAL_SCOPE_MAP.md`
- `docs/product/work-packets/wave-2/briefs/WAVE_2_BRIEF_D_CONNECTIVITY_AND_COMMUNICATION.md`
- `docs/product/work-packets/wave-2/module-cards/WAVE_2_MODULE_CARD_COMMUNICATION.md`
- `docs/product/work-packets/evidence/548-v81-wave1-final-module-gate-ratification.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_SOURCE_MATRIX_2026-03-29.md`
- `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_MASTER_AUDIT_2026-03-29.md`

## 3. Benchmark Family From `Softs`

Primary benchmark family:

- work-forward communication systems with channel clarity, context, and message-to-action conversion

Benchmark interpretation:

- internal and external communication should not blur
- channel rules should be explicit
- messages should convert into visible governed work
- communication should feel like a product family, not a chat clone

## 4. Intended Final Product Behavior

`Komunikacja` should behave like one governed communication family:

- internal communication routes into work
- external communication remains tied to delivery context
- allowed channels and routing are visible
- messages become tasks, decisions, approvals, or updates instead of disappearing

## 5. Current Repo Truth

What is already true:

- communication doctrine is strong
- some visible surfaces already reflect the intended model
- runtime foundations are stronger than the earlier product shell

What is still incomplete:

- one canonical communication shell is still missing
- internal and external families are not yet fully packaged as one product
- health, policy, and delivery semantics remain thinner than the doctrine

## 6. Gap Ledger

| Dimension | Current truth | Final requirement | Main gap |
| --- | --- | --- | --- |
| `User value` | meaningful surfaces exist | one clear communication family | shell cohesion |
| `Flow completeness` | partial internal/external flows | internal-to-work and external-delivery continuity | family closure |
| `UX quality` | some narrative surfaces exist | visible routing, channel, and next-action grammar | product clarity |
| `Data / logic quality` | sync and context substrate exist | communication semantics must remain explicit | routing clarity |
| `Integration quality` | tied to chat, inbox, sync | one clean split across adjacent modules | boundary discipline |
| `Trust / governance / error handling` | strong doctrine | policy and delivery states must be visible | policy exposure |
| `Market standard fit` | medium-low | serious context-rich communication layer | packaging gap |

## 7. Final Delivery Packets

| Packet | Goal | Scope | What we deliver | What we do not touch | Acceptance proof |
| --- | --- | --- | --- | --- | --- |
| `Communication surface model packet` | define one family shell | surface family, internal/external split, routing model | one visible communication product model | replacing chat or inbox | users can tell what communication owns and how it differs from adjacent modules |
| `Internal-to-work routing packet` | make internal communication actionable | task, decision, approval, and action conversion | clearer internal work-forward routing | every workflow engine in the platform | internal messages can become visible governed work without ambiguity |
| `External delivery communication packet` | strengthen client-facing flows | external updates, delivery context, channel policy, status truth | stronger external communication semantics | full CRM or inbox replacement | external communication stays tied to context and delivery state |

## 8. Dependencies And Risks

Dependencies:

- `Synchronizacja`
- `Chat`
- `Inbox`
- `Execution`
- operator surfaces in `Admin` and `Superadmin`

Risks:

- turning communication into a generic chat clone
- duplicating channel logic that belongs to sync/connectors
- widening scope into every messaging edge case before the family shell is stable

## 9. Final Acceptance Bar

`Komunikacja` is finally implemented for its declared Wave 2 role only when:

- one visible communication family exists
- internal and external communication semantics are explicit
- message-to-work conversion is believable
- channel policy and routing do not contradict sync and adjacent modules

## 10. Non-Goals And Unsafe Claims

Non-goals:

- replacing chat as the AI conversation surface
- replacing inbox as the action queue
- full Slack or Teams parity

Unsafe claims until separately proven:

- `communication is fully complete across all channels and use cases`
- `Consultify now has full messaging-platform parity`
- `communication no longer depends on sync and connected-runtime truth`
