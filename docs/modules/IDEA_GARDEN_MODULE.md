# Idea Garden — Module Vision & Goals

> **Status:** DRAFT — v0.1  
> **Created:** 2026-02-24  
> **Owner:** Product  
> **Related:** T009 (My Ideas), My Work Module, AI Chat, Notebook

---

## 1. Why this module exists

Most idea management tools are graveyards. Users dump ideas into a list, never return, and the ideas rot. The few that survive do so by accident, not by system design.

**Idea Garden exists to solve this.** It is not a list. It is not a notebook. It is a **living creative partner** that:

- **Grows ideas** — from a 1-sentence spark to a team-ready proposal
- **Feeds ideas** — automatically attaching context, research, and signals from daily work
- **Resurfaces ideas** — showing the right idea at the right moment (not when you search for it)
- **Promotes ideas** — guiding the best ones into team chat, initiatives, and real execution

The metaphor is deliberate: a **garden**, not a database. Ideas are planted (seed), watered (enriched), pruned (shaped), and harvested (promoted). The system is the gardener.

---

## 2. Core principles

### 2.1 Ideas live, they don't sit
Every idea has a **stage** and a **heartbeat**. The system actively moves ideas forward by attaching new context, suggesting next steps, and nudging the user when an idea becomes relevant.

### 2.2 Knowledge woven into work
Ideas are not separate from work — they emerge from it. The chat, tasks, decisions, assessment, notebook — everything is a potential source of sparks. And ideas flow back into work as initiatives, tasks, and team discussions.

### 2.3 Push over pull
The system **proactively suggests** rather than waiting for the user to search. Contextual hints appear in chat, in task editing, in notifications. The user captures with 1 click.

### 2.4 Positive and creative
The tone is always encouraging. AI acts as a creative partner, not a critic. No risk analysis in ideation phase — that comes later when the idea is promoted to an initiative.

### 2.5 Anti-spam by design
Suggestions are rare and relevant. Max 1 spark per AI response. Cooldowns per topic. User preferences learned over time. Dismiss/snooze always available.

---

## 3. Idea as a living object

Each idea is a **node** with layers, not a text field:

| Layer | What it holds | How it grows |
|-------|--------------|-------------|
| **Seed** | User's original spark (1–3 sentences) | Manual input or captured from chat |
| **Narrative** | AI-expanded description (value, practice, uniqueness) | AI Develop action |
| **Knowledge Feed** | Small attached insights (web, internal, conversations) | Auto-enrichment + manual attach |
| **Evidence** | Links, quotes, data, conversations that support the idea | Manual + AI suggestions |
| **Variants** | Creative alternatives and extensions | AI proposals + user additions |
| **Experiments** | Small tests / validation steps | AI-suggested, user-managed |
| **Links** | Tasks, decisions, initiatives, notebook pages, signals | Auto-detected + manual |

### Idea stages (lifecycle)

```
  🌱 spark → 🌿 incubating → 🌳 shaping → ✅ ready → 🚀 promoted
```

| Stage | Meaning | Exit criteria |
|-------|---------|---------------|
| `spark` | Just captured, raw | User clicks "Develop" or system auto-enriches |
| `incubating` | AI expanded, research attached | User reviews and shapes direction |
| `shaping` | User actively refining, variants selected | Summary complete, next steps clear |
| `ready` | Fully formed, ready for team discussion | User decides: promote or park |
| `promoted` | Converted to initiative or discussed in team chat | Linked entity created |

---

## 4. Three surfaces (where ideas appear)

### 4.1 Chat — "Creative sparks in conversation"
- AI includes 0–1 `💡 IDEA_HINT` per response when genuinely relevant
- Rendered as interactive card with **Develop** and **Attach to idea** buttons
- Clicking "Develop" creates a new idea in the Incubator
- Clicking "Attach" shows a dropdown of existing ideas to enrich

### 4.2 Notifications — "Innovation spark"
- New notification type: `IDEA_SPARK`
- Triggered by: blocked tasks, web research matches, pattern detection
- CTA: "Open in Idea Garden" or "Attach to existing idea"
- Severity: always `INFO` (never alarming — creativity needs safety)

### 4.3 In-context panels — "Relevant ideas while you work"
- Task editing: "Relevant ideas" panel (existing) + "Idea opportunities" (new sparks)
- Initiative editing: same pattern
- Notebook: ideas linked to notebook pages and vice versa

---

## 5. Idea Garden view (home screen)

Instead of a flat list, the Ideas tab shows a **garden layout** with 4 sections:

### 🌱 New Sparks
Recently captured ideas that haven't been developed yet. Fresh, raw, exciting.

### 🌿 Incubating
Ideas being developed by AI — research attached, narrative expanding, variants growing.

### ✅ Ready for Team
Fully shaped ideas with summary, evidence, and next steps. One click to promote.

### 🚀 Promoted
Ideas that became initiatives or were discussed in team chat. Success stories.

Plus: **"Resurfaced today"** — ideas the system brought back because they became relevant due to current work context.

---

## 6. Idea Incubator (detail view)

Three-tab creative workspace:

### Tab 1: Create
- Seed input (textarea)
- "Develop with AI" button (stages: expand → research → propose → summarize)
- Creative prompts: "What if…", "Flip the problem", "Make it 10× cheaper"

### Tab 2: Enrich
- Knowledge Feed (auto-attached insights with source + "why it matters")
- Web Research results
- Variants (AI proposals with like/dislike)
- Manual evidence attachment

### Tab 3: Decide
- Summary card (verdict, potential, complexity, time-to-value)
- "Pitch for team" (1-page generated brief)
- "First experiment" (lightweight validation plan)
- Action buttons: Discuss in Team Chat | Create Initiative | Park | Archive

---

## 7. Auto-enrichment engine (system "waters" ideas)

### Event-driven sparks
Events that can generate knowledge drops for existing ideas:

| Event | Example |
|-------|---------|
| `CHAT_MESSAGE_CREATED` | AI mentions a topic related to an idea |
| `TASK_BLOCKED` | Blockage pattern matches an idea's domain |
| `NEW_KB_SOURCE` | New approved knowledge document relevant to idea |
| `WEB_RESEARCH_MATCH` | Tavily result during Deep Thinking matches idea |
| `NOTEBOOK_PAGE_UPDATED` | Notebook page linked to idea gets new content |

### Matching levels
1. **Heuristic**: tag + keyword + project match (cheap, always-on)
2. **Semantic**: embedding similarity (medium cost, batch)
3. **LLM judge**: "does this really fit?" (expensive, only for high-confidence matches)

### Anti-spam policy
- Max 1 knowledge drop per idea per day (unless user is actively editing)
- Cooldown per topic: 24h
- User can mute enrichment per idea
- Global quiet hours respected

---

## 8. Learning user preferences

Every interaction teaches the system:

| Action | Signal |
|--------|--------|
| Click "Develop" | User interested in this type of spark |
| Click "Dismiss" | Not relevant, reduce similar suggestions |
| Click "Attach" | Good matching, reinforce |
| Promote to initiative | Strong positive signal |
| Archive/delete | Negative signal |

After 2–3 weeks, the system adapts:
- Frequency of suggestions
- Topics that matter
- Preferred creativity level (wild vs. conservative)
- Preferred outcomes (cost savings, quality, speed, culture)

---

## 9. Relationship to other modules

```
  Chat ──spark──→ Idea Garden ──promote──→ Initiatives
    ↑                  ↕                        ↓
 Notebook ←──link──→ Ideas ←──evidence──→ Tasks/Decisions
    ↑                  ↑
 Signals ──attach──→ Knowledge Feed
```

- **Chat**: source of sparks, destination for team discussions
- **Notebook**: long-form exploration linked to ideas
- **Tasks/Decisions**: evidence and context flow both ways
- **Initiatives**: promoted ideas become initiatives
- **Signals**: contextual intelligence feeds idea enrichment

---

## 10. What makes this different

This is not Brightidea (corporate suggestion box). This is not Notion (passive notes). This is:

1. **AI as creative partner** — not just storage, active development
2. **Context-aware** — ideas emerge from and flow back into real work
3. **Living objects** — ideas grow, get fed, resurface, and promote
4. **Anti-gravity** — ideas don't sink to the bottom of a list; the system lifts them
5. **Personal first** — private creative space before team exposure

The closest analogy: **a creative consultant who never sleeps, remembers everything you said, reads the news, and taps you on the shoulder when something matters.**

---

## 11. Mind Map view

The Idea Garden features a **visual mind map** that shows all ideas as an interactive tree.

### Design principles
- **Titles only** — no full descriptions, keeps the map lightweight and scannable
- **Branch grouping** — ideas auto-grouped by domain: Strategy, Product, Process, Culture & Team, Technology, Growth
- **Color-coded borders** — each branch has a distinct color; moving an idea between branches changes its border color
- **Drag-and-drop** — users can drag idea nodes between branches to recategorize
- **Source attribution** — each node shows whether the idea came from the user (person icon) or AI (bot icon)
- **Priority bar** — tiny progress bar on each node reflects system-evaluated priority (auto-updated)
- **Center hub** — "My Ideas" hub in the center, branches radiate outward, ideas orbit branches

### Best practices applied (from mind mapping research)
1. **Radial layout** — central topic with branches radiating out (Tony Buzan method)
2. **Single keyword per node** — only titles, no paragraphs (forces clarity)
3. **Color associations** — each branch has a persistent color (aids memory)
4. **Spatial proximity** — related ideas cluster near their branch (visual grouping)
5. **Free movement** — ideas can be dragged anywhere, but snap to nearest branch
6. **Priority-based ordering** — higher-priority ideas positioned closer to branch node

### Auto-priority system
The system evaluates and adjusts idea priority (0-100) based on:
- Number of enrichment signals attached
- Recency of relevant events (tasks, decisions, conversations)
- User engagement (viewed, liked proposals, re-developed)
- AI assessment of potential and complexity
- Cross-references from other ideas or modules

---

## Appendix: Implementation phases

| Phase | Scope | Status |
|-------|-------|--------|
| **P0** | Basic CRUD + card view + list view | ✅ Done |
| **P1** | AI Incubator (develop flow with streaming) | ✅ Done |
| **P1.5** | Chat IDEA_HINT + proactive sparks | ✅ Done |
| **P2** | Garden view (4 sections) + stage workflow | ✅ Done |
| **P2.5** | Mind Map view + source attribution + area/domain | ✅ Done |
| **P3** | Auto-enrichment engine + knowledge drops | Planned |
| **P3.5** | Auto-priority evaluation system | 🔧 Building |
| **P4** | Learning preferences + anti-spam tuning | Planned |
| **P5** | Promote to initiative + team chat integration | Planned |

---

*This document describes the vision and goals of the Idea Garden module. The final detailed specification will be written once the core UX is validated.*
