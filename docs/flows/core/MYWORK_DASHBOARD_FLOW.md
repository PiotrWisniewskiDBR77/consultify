# FLOW-MYWORK-001: MyWork Dashboard

> **ID:** FLOW-MYWORK-001 | **Status:** ✅ Complete | **Priority:** P0  
> **Last updated:** 2026-02-24

## Overview

| Metric                    | Value                        |
| ------------------------- | ---------------------------- |
| **Completeness**          | 100%                         |
| **Implementation Status** | Production — fully integrated |

## Purpose

My Work is the user's personal operational hub. It aggregates all work artifacts (tasks, decisions, ideas, notes, notifications) into a single integrated workflow with AI assistance at every step.

## MyWork Structure (Current)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MY WORK HUB                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        MORNING BRIEF CARD                           │    │
│  │   "5 tasks due today, 2 decisions pending, 3 new inbox items"      │    │
│  │                                  [Plan with AI]  [Dismiss]          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  [Executive] [Inbox] [Focus] [Tasks ▾] [Decisions ▾] [Notebook] [Ideas]   │
│                                                                             │
│  ┌──────────────────────────────────┐ ┌──────────────────────────────────┐ │
│  │                                  │ │        AI CHAT PANEL             │ │
│  │         ACTIVE TAB CONTENT       │ │  ┌──────────────────────────┐   │ │
│  │                                  │ │  │  System prompt:          │   │ │
│  │  (varies by tab — see below)     │ │  │  "Productivity coach"    │   │ │
│  │                                  │ │  │                          │   │ │
│  │                                  │ │  │  [Quick prompts chips]   │   │ │
│  │                                  │ │  │  /task /decision         │   │ │
│  │                                  │ │  └──────────────────────────┘   │ │
│  └──────────────────────────────────┘ └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tab Architecture

### Executive (Admin/Manager only)

```
┌──────────────────────────────────────────────────────────┐
│  KPI GRID                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Tasks    │ │ Decisions│ │ Portfolio │ │ Team     │   │
│  │ 12 open  │ │ 5 pend.  │ │ Score 78 │ │ On track │   │
│  │ [→ deep] │ │ [→ deep] │ │          │ │          │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│  ACTION REQUIRED STRIP                                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  3 decisions > 5 days old │ 2 blocked tasks       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  WORK PATTERNS WIDGET                                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │  velocity: 12 tasks/wk │ avg decision: 2.3 days  │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

Deep links: KPI tiles pass `{ filter: 'overdue' }` / `{ filter: 'pending' }` to navigate to pre-filtered views.

### Inbox

```
┌──────────────────────────────────────────────────────────┐
│  TOOLBAR: [Sort ▾] [Filter ▾] [Bulk Select] [AI Triage] │
│  ──────────────────────────────────────────────────────  │
│  □ Task assigned: Budget review      [Accept] [Later]   │
│  □ Decision needed: Go/No-Go Ph3     [Review] [Snooze]  │
│  □ Signal: Initiative X at risk      [View]   [Dismiss] │
│  ──────────────────────────────────────────────────────  │
│  AI Auto-Triage: Classifies items with confidence score. │
│  High confidence → auto-applied with undo.               │
└──────────────────────────────────────────────────────────┘
```

### Focus

```
┌──────────────────────────────────────────────────────────┐
│  NUDGE STRIP                                             │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ⚠ Task "Report" blocked 3 days — escalate?       │   │
│  │ ⏰ Decision "Budget" pending 5 days — 2 tasks    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  [AI Coach] [AI Plan] [Delegate]                         │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │  TODAY    │ │ THIS WEEK│ │  LATER   │               │
│  │          │ │          │ │          │               │
│  │  □ Task1 │ │  □ Task4 │ │  □ Task7 │               │
│  │  □ Task2 │ │  □ Task5 │ │  □ Task8 │               │
│  │  □ Task3 │ │  □ Task6 │ │          │               │
│  └──────────┘ └──────────┘ └──────────┘               │
│                                                          │
│  AI COACH PANEL (toggleable)                             │
│  ┌──────────────────────────────────────────────────┐   │
│  │  #1 Decision "Budget" — urgent, blocks 2 tasks   │   │
│  │  #2 Task "Report" — deadline tomorrow             │   │
│  │  ⚠ Overcommit warning: 15 tasks (avg 8/wk)       │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Tasks

Views: List | Kanban | Calendar

List view includes:
- **Focus badge** — shows which Focus column (Today / This Week / Later) each task is in
- **Triage badge** — shows "Triaged" for items processed through Inbox
- **Origin badge** — "From Idea" / "From Note" with navigation link
- **Smart sort** — overdue → today → priority → date

### Decisions

Views: List | Kanban | Review Next

- **AI Decision Brief** — on-demand 2-3 sentence summary with urgency
- **Post-decision follow-up** — after Approve/Reject, modal suggests follow-up tasks

### Notebook

- **TipTap editor** with slash commands: `/task`, `/decision`, `/idea`, `/ask`, `/expand`, `/challenge`, `/action`
- **KnowledgePulse** — sidebar showing related artifacts (initiatives, tasks, decisions)
- **Smart Note Routing** — AI classifies mature notes and suggests conversion
- **Weekly Review template** — auto-filled by AI with wins/blockers/plan

### Ideas

Views: List | Cards | Garden | MindMap

- **Promote CTA strip** — "Create Tasks" / "Decision" / "Initiative" buttons
- **Idea conversion** → generates task set with origin tracking
- **AI evaluation** — maturity scoring and next-steps suggestion

---

## Cross-Tab Communication

### EventBus (Zustand)

All tabs share state via `myWorkEvent` in the Zustand store:

```
Event types:
  item:completed  — task/decision finished
  item:created    — new artifact created
  item:moved      — item moved between Focus columns
  item:triaged    — inbox item processed
  item:converted  — note/idea converted to task/decision
  item:updated    — metadata changed
  item:deleted    — artifact removed

Emit → MyWorkHub watches → increments refreshTrigger → child tabs re-fetch
```

### Custom Window Events

| Event | Dispatched By | Consumed By |
|---|---|---|
| `mywork-open-item` | Any component | `MyWorkHub.tsx` (opens document) |
| `notebook-create-task` | Slash menu | `NotebookContent.tsx` |
| `notebook-create-decision` | Slash menu | `NotebookContent.tsx` |
| `notebook-create-idea` | Slash menu | `NotebookContent.tsx` |

---

## Chat Integration per Tab

| Tab | AI Persona | Quick Prompts |
|---|---|---|
| Executive | C-level strategic advisor | "30-second briefing", "What needs attention?" |
| Inbox | Triage assistant | "Auto-triage inbox", "Summarize new items" |
| Focus | Productivity coach | "Optimize my today", "What should I tackle first?" |
| Tasks | Task management advisor | "Reprioritize for today", "Which tasks to delegate?" |
| Decisions | Decision advisor | "Summarize pending decisions", "Risk analysis" |
| Notebook | Knowledge assistant | "Summarize this note", "Extract action items" |
| Ideas | Innovation coach | "Evaluate this idea", "What questions to explore?" |

Chat can also:
- Create tasks and decisions via `/task` and `/decision` commands
- Receive enriched system prompt with workload stats (tasks due, decisions pending, inbox count)
- Carry over session context between visits

---

## AI Features Flow

### Morning Briefing

```
User opens MyWork → GET /morning-brief → MorningBriefCard renders:
  - "You have 5 tasks due today, 2 pending decisions"
  - "Recommendation: Start with [Decision X] — it blocks 2 tasks"
  - [Plan with AI] → opens chat with kickoff message
```

### Predictive Signals

```
GET /signals returns:
  Standard signals (overdue, deadline approaching)
  + AI predictions:
    - Tasks at risk (no progress, deadline near)
    - Stale decisions (pending > 5 days)
  Displayed in Executive, Inbox, and Focus
```

### Smart Note Routing

```
User edits note → wait 30s idle → POST /notebook/:id/classify
  If "task_material" + confidence > 0.6:
    Toast: "This looks like a task — Convert?"
  If "decision_material":
    Toast: "This contains a decision point — Create decision?"
```

---

## Database

See `docs/architecture/MYWORK_ARCHITECTURE.md` for full schema extensions including:
- Origin tracking columns (`source_type`, `source_id`)
- Session context table
- Nudge tracking tables

## API Reference

Full endpoint list: `docs/architecture/MYWORK_ARCHITECTURE.md`

Key endpoints: `server/src/routes/my-work.routes.ts` (60+ endpoints)

---

## Related Documentation

- `docs/MYWORK_MODULE_SPECIFICATION.md` — Canonical specification
- `docs/architecture/MYWORK_ARCHITECTURE.md` — Architecture & API reference
- `docs/ui-standards/` — UI component standards
- `docs/modules/LIVING_NOTEBOOK_MODULE.md` — Notebook module detail
- `docs/mywork-recommendations.md` — Strategic recommendations (source material)
