# MyWork Radar v8 SSOT

> Status: Draft v8
> Owner: Product + Engineering
> Purpose: zdefiniowac kanoniczny cel produktu, granice, obietnice i glowne surface `Radar` jako `AI executive radar` w ramach `MyWork`.

---

## 1. Product mission

`Radar` istnieje po to, aby zamieniac szum informacyjny w:

- wiedze,
- interpretacje,
- rekomendacje ruchu,
- i decyzje, ktore da sie od razu przeniesc do pracy.

It also exists to:

- rozwijac osad usera w temacie,
- zachecac do uczenia sie w kontekscie realnych zadan,
- i budowac nawyk madrzejszego korzystania z bazy wiedzy i AI, a nie biernego scrollowania.

Core promise:

`Radar does not tell you only what happened. Radar tells you why it matters now, why you should care, and what move is worth making next.`

Extended promise:

`Radar should adapt to who you are, what you are working on, and how much you already know, then gently pull you toward better understanding and better action.`

---

## 2. Product positioning

`Radar` is:

- personal intelligence system
- transformation signal layer
- consultant-style interpretation engine
- answer-first insight surface
- bridge between external change and internal action
- contextual learning catalyst
- lightweight encouragement layer for better thinking and better moves

`Radar` is not:

- raw RSS reader
- neutral article list
- static knowledge library
- compliance inbox
- operational monitoring cockpit

---

## 3. Imported leader patterns

The package imports these patterns as baseline product doctrine:

- `Perplexity`: answer-first synthesis, source transparency, follow-up friendliness, current information
- `Notion AI`: context-aware interpretation tied to workspace and connectors, not world knowledge alone
- `Feedly + automation`: event-driven ingestion, prioritization and pipeline orchestration rather than manual browsing

Consultify decision:

`Radar must combine search-grade freshness, workspace-grade context, and workflow-grade actionability.`

---

## 4. Canonical user promise

For every important signal, Radar should answer:

1. what changed
2. why it matters
3. why you see it
4. what this means for you
5. what to do next
6. what you may need to learn or revisit before acting

That is the minimum useful intelligence unit.

For the strongest signals, Radar should also answer:

- whether the user likely already understands the topic well
- whether the topic should trigger a knowledge-base revisit
- whether AI chat should invite a short guided conversation

---

## 5. Canonical object stack

The canonical object families are:

- `Source`
- `RawSignal`
- `ProcessedSignal`
- `RankedSignal`
- `InsightCard`
- `Recommendation`
- `RadarAction`
- `WatchlistItem`
- `DailyBrief`
- `IdeaStarter`
- `NotebookPrompt`
- `LearningPrompt`

Important:

`article` is not the primary object for the user.

The primary object is:

`interpreted signal with decision value`

---

## 6. Surface model

The baseline Radar surface lives inside `My Work > Home`.

Canonical visible layers:

- `dailyBriefing`
- `whatChanged`
- `whyItMattersToMe`
- `whatToDoNext`
- `learnImprove`
- `watchlist`

This aligns with current runtime payload and remains the baseline `v8` surface.

Surface rule:

`Radar should feel like a helpful desk-side consultant, not a heavy research console`

---

## 7. Left-to-right UX doctrine

Radar should work as a left-to-right intelligence flow:

- left side: ranked signal stream
- right side: active interpretation and action context

The right panel must privilege:

1. `Why it matters`
2. `Why you see this`
3. `What to do next`
4. `Learn / improve`

This means the user does not browse content first.
The user enters through decision value first.

---

## 8. Consultant behavior doctrine

Radar AI behaves as:

- internal consultant
- transformation scout
- opportunity and risk interpreter
- contextual teacher when the user needs help closing a knowledge gap

Radar AI does not behave as:

- neutral summarizer only
- hype amplifier
- unread article counter

Good Radar copy sounds like:

- `this matters for your active initiative`
- `this may change the assumptions behind your current decision`
- `this is worth converting into a task or note now`
- `before acting, review this playbook or ask AI to walk through the trade-off`
- `this connects to what you are doing now and can sharpen your next move`

Bad Radar copy sounds like:

- `interesting article`
- `here are some links`
- `this might be useful someday`

---

## 9. System boundaries

### 9.1 Radar vs Inbox

`Radar` discovers and interprets.

`Inbox` enforces, reminds and escalates.

Radar may promote something into task or decision flow.
It should not itself become a governance enforcement surface.

### 9.2 Radar vs Chat

`Radar` frames and ranks the signal.

`Chat` expands, reasons and collaborates on the signal.

Radar must hand off explicit signal context to chat.

Radar may also proactively invite chat when:

- the signal is highly relevant to an active task or decision
- the signal likely exceeds the user's current working knowledge
- a short AI conversation could convert uncertainty into action or learning

The invite must feel like:

- contextual encouragement
- optional guidance
- lightweight opening to deeper reasoning

not:

- intrusive interruption
- forced workflow
- synthetic engagement bait

### 9.3 Radar vs Knowledge Base

Radar is optimized for:

- freshness
- relevance
- actionability

Knowledge bases are optimized for:

- retrieval
- archival truth
- governed reference

Radar should actively encourage use of the knowledge base when:

- the signal relates to a known internal playbook
- the user may need foundational understanding before acting
- a company-specific standard or prior decision already exists

This means Radar is not only a source of new signals.
It is also a guide back into governed internal knowledge.

---

## 10. Canonical actions

Baseline in-system actions are:

- `ask_ai`
- `add_to_note`
- `create_task`
- `add_to_decision`
- `add_to_watchlist`
- `more_like_this`
- `less_like_this`
- `dismiss`
- `start_idea`
- `capture_note`
- `revisit_knowledge`

The purpose of actions is not engagement vanity.
The purpose is to teach relevance and move work forward.

An additional canonical action posture exists even when not rendered as a button:

- `learn_before_act`
- `revisit_playbook`
- `talk_to_ai_now`
- `turn_into_idea`
- `capture_one_implication`

---

## 11. Radar success model

Radar succeeds when users:

- open fewer but more relevant signals
- ask follow-up questions on meaningful items
- convert signals into notes, tasks and decisions
- convert signals into ideas and experiment seeds
- use Radar as a decision assistant rather than a reading queue
- return to the knowledge base when Radar detects a useful learning gap
- feel more capable and more oriented after using Radar, not more overwhelmed

Primary success signals:

- `create_task` from signal
- `add_to_decision` from signal
- `ask_ai` with signal context
- `start_idea` or equivalent idea-draft creation from signal
- `capture_note` or equivalent lightweight memo creation from signal
- repeated use of watchlist and preference training
- increased reuse of internal knowledge or playbooks after Radar prompts
- repeated completion of learning-oriented follow-ups before execution

---

## 12. Non-goals

Not baseline for `v8`:

- full media monitoring suite
- broad consumer-news feed
- social listening platform
- generic enterprise search replacement
- plant operations command center

---

## 13. Acceptance criteria

- Radar is clearly defined as a decision-support intelligence layer
- the user-facing unit is interpreted signal, not article list
- actionability is part of the contract, not an optional afterthought
- Radar remains distinct from Inbox, Chat and archival knowledge surfaces
- Radar adapts to the person, their work, and their likely knowledge level
- Radar can nudge the user toward knowledge-base use and AI conversation without becoming pushy
- the product tone remains encouraging, light and developmental rather than heavy or depressing
- Radar clearly encourages creation of ideas, notes and lightweight transformation artifacts rather than ending at passive consumption
