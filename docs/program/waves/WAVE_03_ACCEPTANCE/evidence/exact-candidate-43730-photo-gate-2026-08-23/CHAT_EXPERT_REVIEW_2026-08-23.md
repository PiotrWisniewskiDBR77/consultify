# Chat — three-perspective expert review — 2026-08-23

Status: `NO-GO FOR OWNER RETEST / REMEDIATION AND EVIDENCE REQUIRED`

## Evidence boundary

- candidate: `43730f86f8a74943c36a58b9ff07aa680a42aa3e`;
- dirty fingerprint: `e4bb10f8b18d0e0556f8d948da12eb776037765ab44de972113b68ca0ba0076a`;
- route/persona/state: `/chat`, authenticated local OWNER, empty start;
- screenshot: `01-chat-start.png`, 1280×720, dark EN;
- SHA-256: `d433c9d16717dddea5ff95cfaf3faecacdfc3ca6a4652c91799038b9549b77ed`.

This review separates a visible defect from a missing proof. One screenshot
does not prove clicks, API contracts, persistence, authorization, alternate
states, responsiveness or owner acceptance.

## Review team

| Perspective | Reviewer | Scope |
|---|---|---|
| UX and visual system | independent UX reviewer | hierarchy, spacing, contrast, navigation, accessibility affordances |
| Business flow and methodology | independent flow reviewer | canonical Chat journey, governed actions, Canvas, voice and durable outcomes |
| Technical and integration | primary integration reviewer | exact-candidate binding, state restoration, action contracts, API/DB/RBAC/readback evidence |

## Consensus findings

| ID | Type | Evidence and deviation from expected state | Severity | Required correction | Gates / verification |
|---|---|---|---|---|---|
| `CHAT-PHOTO-001` | Visible defect | The page opens below the beginning: the scrollbar is not at the top and only the tail of the welcome copy is visible. `CHAT-OWN-011` requires the complete `Talk to Teresa, {firstName}.` hierarchy on entry. | `P1` | Own/reset scroll position for the empty `/chat` start; do not restore a conversation scroll position into the empty route; fit the full hero hierarchy into the standard viewport. | `G05,G06,G08,G09,G14–G17,G20`; cold entry, refresh, back/forward and route-switch at 1280/1440/tablet. |
| `CHAT-PHOTO-002` | Visible defect | The intended crimson border-only orbit appears as a thin diagonal red scratch inside the composer. This conflicts with `CHAT-OWN-012`. | `P1` | Constrain the animation to the border using an owned mask/clip and overflow boundary; stop it for focus, content, sending, recording and reduced motion. | `G06,G09,G14–G17,G20`; inspect all animation frames, zoom levels and reduced-motion mode. |
| `CHAT-PHOTO-003` | Visible defect | The empty start needs vertical scrolling while its heading is above the viewport and branding sits near the bottom. The scene is taller than necessary despite large internal whitespace. | `P1` | Make spacing viewport-aware and retain the order welcome → context → composer → starters/capabilities → branding without splitting the first impression. | `G06,G08,G09,G13–G17,G20`; desktop/tablet visual comparison. |
| `CHAT-PHOTO-004` | UX ambiguity | Output-type pills, topic starters and capability cards look like three similar ways to start, but their different semantics are not explained. | `P1` | Label and visually differentiate output format, editable prompt starter and module deep-link. Preserve one obvious primary path. | `G02,G08,G09,G13–G17,G20`; usability replay plus keyboard/focus evidence. |
| `CHAT-PHOTO-005` | Accessibility risk | Capability descriptions/CTAs, inactive output controls and several icon-only composer controls have weak hierarchy or unclear meaning. Dictation versus Teresa voice is not distinguishable from the still image. | `P1` | Raise contrast/legibility; provide unique accessible names, tooltips, focus states and explicit voice-state language; remove duplicated/ambiguous affordances. | `G02,G05,G06,G09,G10,G14–G17,G20`; WCAG contrast, keyboard, screen-reader and 200% zoom replay. |
| `CHAT-PHOTO-006` | Missing functional proof | Output types, topic starters and capability cards are visible, but clicks, editable prefill, canonical destination, permissions, failure behavior, telemetry and durable artifact creation are not proven. | `P1 / NOT_VERIFIED` | Build the atomic action-contract matrix; exercise each control through browser/network/API and cold readback, including forbidden and dead-route cases. | `G02,G03,G05,G09,G10,G14–G17`. |
| `CHAT-PHOTO-007` | Acceptance blocker | No current evidence covers sourced conversation → governed proposal → human decision → durable materialization → target receipt/cold reopen, including reject/fail/stale/replay/foreign-tenant states. | `P0 evidence blocker` | Capture and verify one exact-candidate OWNER journey plus negative personas and durable target readback. | `G02–G06,G09,G10,G14–G20`. |
| `CHAT-PHOTO-008` | Acceptance blocker | Canvas Rich/DOC/MD, save/dirty/error/retry truth, response actions, branches/history, Private/Organization scopes and signal behavior are not photographed or read back. | `P0 evidence blocker` | Complete the minimum Chat packet and resolve unproved branches/signals by implementing the real producer/consumer contract or removing premature UI. | `G02,G03,G05,G06,G09,G10,G13–G20`. |
| `CHAT-PHOTO-009` | Coverage gap | Current evidence is only dark EN desktop. PL/EN, light/dark, tablet, keyboard/focus, reduced motion and role/tenant isolation are untested here. | `P1 gate gap` | Run the bounded variant matrix after the P1 visual corrections; do not multiply redundant screenshots. | `G06,G10,G15–G17,G20`. |

## Positive observations

- The dark visual language is coherent and the large composer is easy to find.
- Output, starter and capability groups are present and can become a useful
  hierarchy once their semantics are differentiated.
- The lower Consultify/DBR77 lockup is visible.

These positives do not prove any action contract or close an owner finding.

## Smallest correction-and-retest sequence

1. Fix start scroll ownership and the border-only pulse.
2. Clarify the three start-control families and accessible voice controls.
3. Capture the corrected empty start in the required visual variants.
4. Execute one complete governed Chat flow with API/DB/target cold readback.
5. Capture conversation/history, response actions, Canvas, proposal lifecycle
   and the smallest set of alternate/permission states.
6. Reconcile every result to `CHAT-OWN-001–017` and `G00–G20`; request an owner
   verdict only after the packet is complete.

## Verdict

`PARTIAL_MATCH / REMEDIATION_AND_FULL_FLOW_EVIDENCE_REQUIRED / NOT_ACCEPTED`

The current screenshot is suitable for identifying start-screen regressions,
not for declaring the Chat module complete. `OWNER_ACCEPTED` remains a separate
human decision.
