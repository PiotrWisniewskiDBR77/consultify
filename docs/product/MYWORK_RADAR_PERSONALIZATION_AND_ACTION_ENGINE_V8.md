# MyWork Radar Personalization And Action Engine v8

> Status: Draft v8
> Owner: Product + Engineering
> Purpose: zdefiniowac jak `Radar` personalizuje znaczenie sygnalu dla konkretnego usera i jak zamienia insight w nastepny ruch w systemie.

---

## 1. Why this document exists

To jest serce `Radar`.

Bez personalizacji i action engine `Radar` staje sie tylko inteligentniejszym feedem.

Z personalizacja i action engine staje sie:

- konsultantem,
- filtrem priorytetow,
- i maszynka do przenoszenia sygnalow w realna prace.

---

## 2. Inherited truth

This document inherits:

- `MYWORK_RADAR_V8_SSOT.md`
- `MYWORK_RADAR_SIGNAL_PIPELINE_AND_RUNTIME_V8.md`
- `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
- `CHAT_APPLICATION_AGENT_RUNTIME_V8.md`

Current runtime anchors:

- `server/src/services/radar/radarRankingService.ts`
- `server/src/services/radar/radarActionService.ts`
- `server/src/services/radar/radarInsightService.ts`

---

## 3. Personalization doctrine

Radar must answer:

`what does this mean for this specific user in this specific moment of work`

That means ranking cannot rely only on:

- world popularity
- source prestige
- generic market importance

It must also rely on:

- role
- industry
- tracked interests
- live work context
- active projects and initiatives
- recent user behavior

---

## 4. Canonical personalization inputs

The baseline input groups are:

- `user role`
- `industry`
- `tracked topics`
- `tracked companies`
- `muted topics`
- `muted sources`
- `current task, decision, idea and note context`
- `initiative context`
- `calendar keywords`
- `recent Radar actions`

This already aligns with the current runtime and should remain canonical.

---

## 5. Canonical relevance breakdown

The baseline relevance dimensions are:

- `roleMatch`
- `industryMatch`
- `projectMatch`
- `trackedTopicMatch`
- `trackedCompanyMatch`
- `recentWorkContextMatch`
- `freshness`
- `trust`
- `actionability`
- `behaviorAdjustment`

Rule:

`Radar ranks by practical usefulness, not by abstract importance alone`

---

## 6. Why-you-see-this doctrine

Every high-value signal should explain why it is shown.

Allowed reasons include:

- active project overlap
- tracked company overlap
- tracked topic overlap
- role fit
- industry fit
- general freshness and trust

This explanation should remain:

- short
- truthful
- user-readable

It should not pretend to deeper certainty than the model actually has.

---

## 7. Why-it-matters doctrine

`Why it matters` should classify the signal into one practical consequence frame:

- strategic
- operational
- commercial
- product
- risk
- compliance
- learning

This lets Radar act like a consultant rather than a summarizer.

The user should feel:

- what assumption changed
- what pressure increased
- what move may now be worth making

---

## 8. Action engine doctrine

The action engine exists to make Radar useful immediately.

The canonical action families are:

- `act now`
- `question to explore`
- `risk to watch`
- `opportunity to test`

The current recommendation object already supports:

- `action`
- `question`
- `risk`
- `opportunity`

This remains the canonical shape.

---

## 9. In-system move doctrine

The next step must favor a move inside `Consultify`, not an abstract suggestion.

Good next moves:

- ask AI with explicit signal context
- convert to working note
- create task
- add to decision flow
- add company or topic to watchlist

Bad next moves:

- vague reading suggestion
- purely inspirational advice
- externalized action with no system handoff

---

## 10. Learning loop

Radar should learn from:

- `ask_ai`
- `add_to_note`
- `create_task`
- `add_to_decision`
- `add_to_watchlist`
- `more_like_this`
- `less_like_this`
- `dismiss`

Important:

- explicit preference actions are stronger than passive views
- `dismiss` should suppress low-fit noise
- watchlist additions should feed future ranking and briefing

---

## 11. Personalization guardrails

Radar personalization must not become:

- hidden manipulation
- black-box obsession loop
- popularity trap
- one-dimensional role stereotyping

Therefore:

- negative feedback must be respected
- trust and freshness still matter even for tracked topics
- user can shape the model through visible actions

---

## 12. Team and project awareness

Radar is personal first, but should still remain project-aware.

That means signals may connect to:

- active tasks
- active decisions
- initiatives
- work artifacts

But ownership of the signal stays with the current user-facing Radar context unless explicitly promoted elsewhere.

---

## 13. Acceptance criteria

- Radar can explain why a signal is relevant to this user now
- next steps favor concrete in-system work
- preference feedback changes future ranking
- Radar behaves like a consultant, not just a summarizer
