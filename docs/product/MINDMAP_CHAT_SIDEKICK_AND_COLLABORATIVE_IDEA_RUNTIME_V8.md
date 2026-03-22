# Mind Map Chat Sidekick And Collaborative Idea Runtime v8

> Status: Draft v8
> Owner: Product + AI Platform + Workspace
> Scope: define the canonical chat, AI sidekick, and collaborative behavior for `Mind Map` inside `Idea Workspace`

---

## 1. Purpose

This document answers one critical product question:

how should `Chat` actually work with `Mind Map` so that the canvas becomes an intelligent thinking environment instead of a separate board plus a separate chat window.

The answer is:

`Chat` must operate as a contextual sidekick for the current idea workspace and current map state, not as a detached assistant.

---

## 2. Core doctrine

`Mind Map` + `Chat` must behave like one cooperative system.

This means:

- the user can discuss the current idea without manually re-explaining everything,
- the user can ask for expansion, critique, structuring, and synthesis from the current selection,
- AI proposals stay reviewable and explicit,
- the conversation can lead naturally into artifacts such as notes, tasks, decisions, and deeper canvases.

The target is not generic chat embedded near a canvas.

The target is:

`contextual co-thinking inside the map`

---

## 3. Context contract

Whenever chat is invoked from `Mind Map`, the sidekick must know the current context package.

Canonical context package includes:

- idea id and idea title
- current canvas = `mind_map`
- current focus mode
- selected node ids
- primary selected node
- selected branch ancestry
- nearby sibling labels
- node semantic types
- node tags
- linked artifacts
- current structure mode if relevant
- open comments or unresolved review context where relevant

AI should never behave as if the map were just plain free text.

---

## 4. Invocation types

There are 5 canonical invocation types for chat inside `Mind Map`:

### 4.1 Whole-map conversation

Used when the user wants to discuss:

- the whole idea
- map quality
- missing areas
- structure balance
- prioritization

### 4.2 Selected-node conversation

Used when the user wants to:

- refine a node
- rename it
- clarify meaning
- add semantic depth
- challenge assumptions

### 4.3 Branch conversation

Used when the user wants to:

- expand a branch
- compare branch directions
- find gaps in a subtree
- summarize one branch
- derive next actions from one part of the map

### 4.4 Review conversation

Used when the user wants to:

- review AI proposals
- understand why a proposal was made
- compare options before applying
- assess risks before changing the map

### 4.5 Promotion conversation

Used when the user wants to turn map work into:

- note
- task
- decision
- initiative
- table or process follow-up

---

## 5. Allowed AI roles

Inside `Mind Map`, the AI sidekick may act as:

- structuring partner
- critical thinker
- branch expander
- summarizer
- synthesis guide
- artifact promotion assistant

Inside `Mind Map`, the AI sidekick must not act as:

- a silent map mutator
- a generic chatbot with no workspace awareness
- a source of branch spam
- an autonomous actor that keeps changing the map without review

---

## 6. Proposal doctrine

All meaningful map mutations proposed by chat must stay explicit.

Canonical rule:

- discussion may be conversational,
- mutation must become proposal-based.

This means:

- AI can suggest children, siblings, re-organization, merge/split actions, tag sets, naming improvements, summaries, and artifact attachments,
- but changes that alter the map meaningfully must enter `propose -> preview -> accept/reject`.

Low-risk conversational suggestions may remain textual.

High-impact structural changes must remain reviewable.

---

## 7. What chat should be able to do

The sidekick should support the following high-value actions:

- explain what a selected branch currently means
- suggest missing branches
- propose 3 to 5 child nodes grounded in the selected node
- compare two branches and explain tension or overlap
- identify blind spots, assumptions, risks, dependencies, and evidence gaps
- suggest semantic type and tags
- recommend what should become a note, task, or decision
- propose when the user should switch from mind map to table, whiteboard, or process flow
- summarize the map for sharing or presentation

---

## 8. Canvas switching doctrine

Chat should help the user move across the broader `Idea Workspace`, but only when the move is justified.

Examples:

- from `Mind Map` to `Table` when structured comparison or prioritization becomes dominant
- from `Mind Map` to `Whiteboard` when freeform exploration becomes dominant
- from `Mind Map` to `Process Flow` when sequence, ownership, or logic paths become dominant

The chat should not force canvas switching.
It should recommend switching when a different canvas would materially improve progress.

---

## 9. Node-native chat entry points

The main chat entry points in `Mind Map` should be:

- ask about this node
- expand this branch with AI
- critique this branch
- summarize this branch
- turn this into task / decision / note
- find missing evidence

These entry points should feel native to node work, not hidden behind a generic workspace chat.

---

## 10. Conversation memory doctrine

Conversation memory in `Mind Map` should prefer:

- current workspace state,
- current branch state,
- recent user actions,
- already accepted proposals,

over generic long-thread memory.

The map itself is part of the memory surface.

That means:

- accepted map changes become durable shared context,
- rejected proposals should not be treated as true state,
- the assistant should distinguish current canvas truth from speculative conversation.

---

## 11. Collaboration doctrine

When multiple people work with the map, chat and AI must remain collaboration-safe.

This means:

- AI suggestions should be attributable
- proposal authorship and acceptance should be visible
- comments and review should be attachable to nodes or branches
- shared review should not require private side-channel explanation
- AI should not bypass team approval norms for branch changes that affect shared meaning

---

## 12. Workshop and facilitation doctrine

In workshop-like use cases, `Mind Map` chat should help facilitate, not dominate.

It should support:

- summarizing live branch growth
- clustering emerging themes
- pointing out underdeveloped areas
- suggesting next prompts to the group
- converting outcomes into follow-up artifacts

It should not:

- flood the board with unsolicited content
- overtake human facilitation
- create major structural changes without visible approval

---

## 13. UX tone doctrine

The sidekick tone inside `Mind Map` should be:

- clear
- energizing
- idea-building
- lightweight
- non-defensive

It should feel like a thoughtful strategist or collaborator, not like a verbose support bot.

---

## 14. Final product promise

When the user is building an idea in `Mind Map`, they should feel that:

- the map understands what they are shaping,
- the chat understands the exact part of the idea under discussion,
- AI can help them think better without taking control away,
- and every useful conversation can turn into a visible, reviewable workspace improvement.

---

## 15. Acceptance criteria

This document is satisfied only when:

- chat launched from `Mind Map` carries real node and branch context
- selected-node and selected-branch AI actions are first-class
- structural AI changes use proposal review
- chat can help promote map work into downstream artifacts
- chat can recommend cross-canvas moves with explicit rationale
- collaboration and review remain visible in shared idea work

---

## 16. Related canonical docs

- `MINDMAP_V8_READINESS_AUDIT.md`
- `MINDMAP_V1_SSOT.md`
- `IDEA_WORKSPACE_NAVIGATION_AND_CANVAS_ORCHESTRATION_V8.md`
- `EXECUTION_RUN_AND_PROPOSAL_SPINE_V8.md`
- `TEAM_APPROVAL_AND_SHARED_AGENT_REVIEW_V8.md`
