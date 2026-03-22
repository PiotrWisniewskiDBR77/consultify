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

Extended form:

`what does this mean for this person, this task horizon, and this likely level of understanding`

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
- current tasks and decisions with near-term pressure
- likely knowledge maturity relative to the signal

---

## 4. Canonical personalization inputs

The baseline input groups are:

- `user role`
- `industry`
- `knowledge maturity or familiarity estimate`
- `tracked topics`
- `tracked companies`
- `muted topics`
- `muted sources`
- `current task, decision, idea and note context`
- `initiative context`
- `calendar keywords`
- `recent Radar actions`

This already aligns with the current runtime and should remain canonical.

The model should additionally evolve toward:

- `known playbooks already used by the user`
- `topics already mastered vs topics still emerging`
- `task pressure and decision deadline proximity`

---

## 5. Canonical relevance breakdown

The baseline relevance dimensions are:

- `roleMatch`
- `industryMatch`
- `knowledgeGapFit`
- `projectMatch`
- `taskUrgencyMatch`
- `trackedTopicMatch`
- `trackedCompanyMatch`
- `recentWorkContextMatch`
- `freshness`
- `trust`
- `actionability`
- `behaviorAdjustment`

Rule:

`Radar ranks by practical usefulness, not by abstract importance alone`

and:

`Radar should prefer the next useful stretch for the user, not only the most impressive signal`

---

## 6. Why-you-see-this doctrine

Every high-value signal should explain why it is shown.

Allowed reasons include:

- active project overlap
- active task or decision overlap
- tracked company overlap
- tracked topic overlap
- role fit
- industry fit
- learning gap fit
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
- whether they are already ready to act or should first learn something small but important

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

Recommendation writing rule:

`action` should help the user move

`question` should help the user think

`risk` should help the user notice

`opportunity` should help the user experiment

When a learning gap is visible, the recommendation should gently route through understanding before execution.

---

## 9. In-system move doctrine

The next step must favor a move inside `Consultify`, not an abstract suggestion.

Good next moves:

- ask AI with explicit signal context
- convert to working note
- start idea draft or hypothesis
- create task
- add to decision flow
- add company or topic to watchlist
- open related internal playbook or knowledge article
- ask AI to explain the topic in the context of the active task
- compare the signal with the current project assumption before committing work

Bad next moves:

- vague reading suggestion
- purely inspirational advice
- externalized action with no system handoff
- learning detached from current work

---

## 10. Learning loop

Radar should learn from:

- `ask_ai`
- `add_to_note`
- `start_idea`
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
- signals that trigger AI conversation but are ignored should be re-scored carefully, not spammed harder
- repeated knowledge-base revisits may indicate a lasting topic interest or skill-development arc

---

## 11. Personalization guardrails

Radar personalization must not become:

- hidden manipulation
- black-box obsession loop
- popularity trap
- one-dimensional role stereotyping

It also must not:

- shame the user for what they do not know
- overwhelm the user with overly advanced material when a smaller learning step would help more
- keep suggesting beginner explanations when the user is already clearly operating above that level

Therefore:

- negative feedback must be respected
- trust and freshness still matter even for tracked topics
- user can shape the model through visible actions
- learning guidance should be progressive and confidence-building

---

## 12. Team and project awareness

Radar is personal first, but should still remain project-aware.

That means signals may connect to:

- active tasks
- active decisions
- initiatives
- work artifacts

Task-context rule:

`if a signal connects directly to something the user must soon decide, build or unblock, that task context should weigh more than generic interest`

Knowledge-context rule:

`if the user likely lacks enough grounding, Radar should recommend a short learning move before a stronger execution move`

---

## 13. AI chat and knowledge-base nudges

Radar should proactively open or suggest AI conversation in selected cases:

- active task overlap plus high impact
- active decision overlap plus ambiguity
- user likely needs explanation, not only summary
- signal would benefit from scenario thinking or trade-off analysis
- the signal is promising but still too early for task creation and should first become a note or idea

The nudge should sound like:

- `Want me to walk through what this changes for your current task?`
- `This touches your active decision. Talk it through with AI before you commit.`
- `Before acting, review the playbook or ask AI for the shortest useful explanation.`

Radar should also nudge toward the knowledge base when:

- an internal standard already exists
- there is a relevant playbook, note, or prior decision
- the user needs foundation before action

Radar should nudge toward lightweight artifact creation when:

- the signal is valuable but still ambiguous
- the user likely needs to capture one implication before deciding
- the best next move is an idea, note or experiment seed rather than a committed task

But ownership of the signal stays with the current user-facing Radar context unless explicitly promoted elsewhere.

---

## 14. Acceptance criteria

- Radar can explain why a signal is relevant to this user now
- next steps favor concrete in-system work
- preference feedback changes future ranking
- Radar behaves like a consultant, not just a summarizer
- Radar considers task pressure and likely knowledge level, not only topic fit
- Radar can suggest learning or knowledge-base review before execution when appropriate
- proactive AI chat nudges are contextual, useful and non-intrusive
- Radar can route the user toward ideas and notes when that is better than immediate task creation
