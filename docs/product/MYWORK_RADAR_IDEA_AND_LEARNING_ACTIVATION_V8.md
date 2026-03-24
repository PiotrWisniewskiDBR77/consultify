# MyWork Radar Idea And Learning Activation v8

> Status: Draft v8
> Owner: Product + Engineering
> Purpose: zdefiniowac jak `Radar` aktywnie zacheca do budowania idei, notatek, rozmowy z AI, pracy z baza wiedzy i transformacyjnego momentum zamiast konczyc sie na samym sygnale.

---

## 1. Why this document exists

Najwieksze ryzyko dla `Radar` nie polega na tym, ze da slabe streszczenia.

Najwieksze ryzyko polega na tym, ze user powie:

- `to ciekawe`,
- `fajny insight`,
- i nic dalej z tego nie zrobi.

Dlatego `Radar` musi byc zaprojektowany jako:

- warstwa aktywacji,
- warstwa pierwszego ruchu,
- warstwa kontekstowej nauki,
- i warstwa lagodnego rozpoczynania pracy transformacyjnej.

---

## 2. Inherited truth

This document inherits:

- `MYWORK_RADAR_V8_SSOT.md`
- `MYWORK_RADAR_PERSONALIZATION_AND_ACTION_ENGINE_V8.md`
- `MYWORK_RADAR_BRIEFINGS_AND_DISTRIBUTION_V8.md`
- `MYWORK_HOME_V1_SSOT.md`
- `CHAT_APPLICATION_AGENT_RUNTIME_V8.md`

Rule:

`Radar should not stop at awareness. Radar should create the smallest useful next act of transformation work.`

---

## 3. Activation doctrine

For every meaningful signal, Radar should decide which of these activation paths is best:

1. `learn`
2. `think`
3. `capture`
4. `shape`
5. `commit`

Meaning:

- `learn` = understand the topic or revisit internal knowledge
- `think` = talk it through with AI or compare it to current assumptions
- `capture` = save one note, observation, question or implication
- `shape` = turn the signal into a rough idea, hypothesis or experiment
- `commit` = create a task, decision input or stronger follow-up artifact

This makes Radar a movement engine, not a reading endpoint.

---

## 4. Canonical activation objects

The package should conceptually support:

- `LearningPrompt`
- `KnowledgeBasePrompt`
- `IdeaStarter`
- `NotebookPrompt`
- `TransformationQuestion`
- `ExperimentSeed`

These do not all need distinct tables in the first implementation.
But they should exist as first-class product concepts.

---

## 5. Idea activation doctrine

Radar should help users move from signal to idea when:

- the signal suggests a new opportunity
- the signal reveals a gap in the current direction
- the signal exposes a repeated pattern worth designing around
- the signal suggests a possible experiment or initiative candidate

The system should not wait for the user to invent the framing from scratch.

Good idea activation outputs:

- `This may become an initiative hypothesis`
- `This looks like a process improvement idea`
- `This could become an experiment for project X`
- `This trend suggests a new capability-building idea`

---

## 6. Note activation doctrine

`Radar` should strongly encourage lightweight capture.

The baseline note activation patterns are:

- `save one useful thought`
- `capture implication for my project`
- `note one open question`
- `compare with our current approach`
- `store a short transformation memo`

The key rule:

`note creation should feel lighter than task creation`

This matters because many signals are valuable before they are task-ready.

---

## 7. Learning activation doctrine

Radar should nudge learning when:

- the signal is important but the user likely lacks grounding
- an internal playbook exists
- prior decisions or notes contain reusable understanding
- a short explanation would improve action quality

Learning activation should stay:

- short
- contextual
- confidence-building
- tied to current work

Good learning prompts:

- `Learn this in 2 minutes before you act`
- `Review the playbook that already covers this pattern`
- `Ask AI for the shortest explanation tied to your current task`

Bad learning prompts:

- `Read more`
- `Study this later`
- `Here are 12 links`

---

## 8. AI conversation activation doctrine

Radar should invite AI conversation when the user would benefit from:

- trade-off analysis
- scenario thinking
- translation into their own project language
- clarification before decision or task creation
- a guided walk-through of what changed

The ideal Radar-to-chat bridge starts from:

- one concrete signal
- one concrete current task, decision, or initiative
- one concrete framing question

Examples:

- `What does this change for initiative X?`
- `Turn this into three options for our team`
- `Is this a risk, an opportunity, or both for the task I am doing now?`

---

## 9. Transformation momentum doctrine

Radar should create a sense of:

- progress
- readiness
- curiosity
- and steady transformation motion

It should not create:

- guilt from unread content
- paralysis from too many strong signals
- false urgency theater

That means the product should often prefer:

- one useful next move
- one smart question
- one note worth writing

over:

- five equally strong calls to action

---

## 10. Suggested activation ladder

The canonical activation ladder should usually be:

`signal -> explanation -> note or AI conversation -> idea or experiment -> task or decision`

This is better than:

`signal -> task`

because transformation work often needs one intermediate layer of framing before commitment.

---

## 11. Mapping from signal type to next artifact

Suggested default mapping:

- `weak signal` -> question or note
- `how_to` or `tool_tip` -> learning note or checklist idea
- `regulation` -> decision input or risk note
- `competitor_move` -> strategy note, experiment idea or decision comparison
- `market` or `trend` pattern -> initiative hypothesis or transformation idea

This mapping should guide defaults, not hard-code all outcomes.

---

## 12. Knowledge-base and memory activation

Radar should not only push the user toward new external signals.

It should also say:

- `you already have relevant knowledge for this`
- `this connects to a prior note`
- `this matches a playbook or previous decision`
- `before creating new work, reuse what the organization already knows`

This makes Radar a gateway into organizational intelligence, not just market intelligence.

---

## 13. UX and tone doctrine

Activation UI should feel:

- lightweight
- warm
- optimistic
- intelligent
- gently directional

Not:

- corporate heavy
- alarmist
- compliance-first in tone
- productivity-guilt driven

Preferred tone examples:

- `Worth exploring now`
- `Good moment to capture one thought`
- `Want help turning this into an idea?`
- `This may sharpen your current project`

---

## 14. Success model

This activation layer succeeds when Radar increases:

- note creation from signals
- idea draft creation from signals
- AI conversations that begin from one specific signal
- knowledge-base revisits triggered by Radar
- transformation questions captured before decision lock-in

It succeeds when users leave Radar with:

- one clearer thought,
- one captured insight,
- one better question,
- or one better next move.

---

## 15. Acceptance criteria

- Radar explicitly supports idea, note, learning and chat activation
- the module encourages transformation work without forcing immediate commitment
- the default motion is from signal into lightweight artifact creation
- Radar helps create momentum and curiosity, not heaviness or guilt
