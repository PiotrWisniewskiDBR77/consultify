---
module_id: MODULE_MEETING
doc_kind: UI_UX
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# UI/UX — Meeting

## 1. Main Screen

As-Is: `/meeting` exists in router/sidebar ownership but current runtime is placeholder-only with no active meeting workspace screen. Future runtime must preserve meeting prep, execution, follow-up and decision ownership.

## 2. Runtime States

- Loading: placeholder does not load meeting data; future workspace must show agenda/calendar/context loading.
- Empty: placeholder must say the module is coming soon; future empty state must guide scheduling/importing/preparing a meeting.
- Error: placeholder must avoid raw internals; future errors must offer retry or permission guidance.
- Degraded: current degraded state is placeholder/blocked; future missing transcript/calendar/context must be visible.
- Success: no active meeting success state exists as-is; future prep/follow-up/action extraction must confirm outcome and next step.

## 3. Menu 2 / Menu 3 Contract

As-Is: no active meeting command system beyond the placeholder route. Future Menu 3 must be the active meeting command row/right-side contextual action slot for agenda, transcript, decisions and follow-ups.

## 4. AI Actions Placement

No active meeting AI actions are implemented as-is. Future AI actions for agenda, summary, decisions or follow-ups must live in Menu 3/Dynamic Tabs/local command row right-side slot and must not be duplicated in meeting canvas.

## 5. Next Action Guidance

The placeholder must tell the user that the module is coming soon. Future runtime must guide connect calendar, prepare agenda, start meeting, review transcript, approve decisions, assign follow-ups or retry.

## 6. Source / Evidence / Provenance

As-Is: no meeting claims are generated. Future summaries, decisions and follow-ups must show transcript/calendar/source context and explicit missing-evidence states.

## 7. Approval / Diff / Review

As-Is: no active meeting mutations exist. Future decisions, action items and external sends require review/approval before finalization or dispatch.

## 8. Anti-Patterns

- Presenting placeholder as active meeting runtime.
- Hidden creation of action items/decisions from AI summary.
- Meeting AI actions duplicated in canvas and Menu 3.
- Transcript-free decisions presented as sourced.
- Sending follow-ups without review.

## 9. As-Is Gaps

- Main screen is placeholder-only.
- No active meeting workspace, transcript/provenance UI, decision review UI or follow-up success flow are validated as implemented.

## 10. Acceptance Criteria

- Sidebar/route lands on `/meeting`.
- Current UI honestly renders placeholder/coming-soon.
- Future meeting runtime preserves Menu 3 AI placement, source/provenance visibility and approval/review gates.
- Placeholder status remains documented as an As-Is gap until active runtime exists.
