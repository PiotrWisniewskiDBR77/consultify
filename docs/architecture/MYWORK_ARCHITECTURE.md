# MyWork Module — Architecture & Feature Reference

> **Last updated:** 2026-02-24  
> **Canonical spec:** `docs/MYWORK_MODULE_SPECIFICATION.md`

---

## 1. System Architecture

### Frontend Component Tree

```
src/components/MyWork/
├── MyWorkHub.tsx                   ← Main hub, tab routing, EventBus consumer
├── MorningBriefCard.tsx            ← Daily brief card (auto-dismiss per day)
│
├── Executive/
│   ├── ExecutiveDashboard.tsx      ← KPI grid, signals, work patterns
│   ├── KPIGrid.tsx                 ← Tiles with deep-link navigation
│   ├── ActionRequiredStrip.tsx     ← Urgent items strip
│   ├── DecisionQueuePreview.tsx    ← Pending decisions preview
│   ├── PortfolioHealthScore.tsx    ← Health visualization
│   └── TeamPerformancePreview.tsx  ← Team capacity overview
│
├── InboxContent.tsx                ← Triage view, AI auto-triage button
├── Focus/
│   ├── FocusView.tsx               ← Kanban board (Today/This Week/Later)
│   ├── FocusBoard.tsx              ← Drag-and-drop board
│   ├── AICoachPanel.tsx            ← Priority Coach (ranks tasks by urgency)
│   ├── AIPlanView.tsx              ← AI-generated time-blocked schedule
│   └── NudgeStrip.tsx              ← Proactive nudges (stale tasks, deadlines)
│
├── MyTasksListContent.tsx          ← Task list with focus/triage badges
├── TaskDetailView.tsx              ← Full task detail (NMode layout)
├── TasksKanbanBoard.tsx            ← Kanban view for tasks
├── TasksCalendarView.tsx           ← Calendar view for tasks
│
├── DecisionsPanelContent.tsx       ← Decision list view
├── DecisionDetailView.tsx          ← Full decision detail (NMode layout)
├── DecisionsKanbanBoard.tsx        ← Kanban view for decisions
├── DecisionReviewNext.tsx          ← Review-next flow (Tinder-style)
│
├── NotebookContent.tsx             ← TipTap editor, conversion, smart routing
├── notebook/
│   ├── SlashMenu.tsx               ← /task, /decision, /idea + AI commands
│   ├── KnowledgePulse.tsx          ← Related artifact discovery
│   ├── NewPageModal.tsx            ← Templates (Weekly Review with AI fill)
│   ├── ActionItemsPanel.tsx        ← AI-extracted action items
│   └── ConvertChecklistModal.tsx   ← Checklist → tasks conversion
│
├── MyIdeasListContent.tsx          ← Ideas list/cards/garden views
├── IdeaDetailView.tsx              ← Idea detail with promote CTA strip
├── IdeasMindMap.tsx                ← Visual mind map of ideas
│
├── NotificationDetailView.tsx      ← Notification detail view
├── CommandPalette.tsx              ← Cross-tab command palette
│
└── shared/
    ├── askAiHelper.ts              ← buildAskAIMessage() utility
    ├── PostDecisionFollowUp.tsx    ← Post-approve/reject task creation modal
    ├── RelatedContext.tsx           ← Cross-entity related items (lazy loaded)
    ├── AIConnections.tsx            ← AI-discovered relationships (lazy loaded)
    ├── ConvertToMenu.tsx            ← Universal "Convert to..." dropdown
    ├── DelegationModal.tsx          ← Delegate with AI suggestions
    ├── LinkedItemsSection.tsx       ← Manual linked items
    ├── AIInsightSection.tsx         ← AI insights panel
    └── ... (30+ shared components)
```

### State Management

| Store Slice | Location | Purpose |
|---|---|---|
| `myWorkEvent` | `uiSlice.ts` | Cross-tab EventBus (emit/consume/clear) |
| `chatSystemPrompt` | `uiSlice.ts` | Per-tab AI system prompt |
| `chatQuickPrompts` | `uiSlice.ts` | Per-tab quick prompt chips |
| `chatKickoffMessage` | `uiSlice.ts` | One-shot auto-send on chat open |
| `myWorkIntent` | `uiSlice.ts` | Cross-module deep linking |

### EventBus Pattern

```
┌─────────────┐     emit()      ┌─────────────┐    refreshTrigger    ┌──────────────┐
│ Detail View  │ ──────────────> │  uiSlice    │ ──────────────────> │  Tab Content  │
│ (save/triage)│                 │ myWorkEvent │                     │  (re-fetch)   │
└─────────────┘                 └─────────────┘                     └──────────────┘

Emit points: InboxContent, TaskDetailView, DecisionDetailView, IdeaDetailView, NotebookContent
Consume point: MyWorkHub watches myWorkEvent → increments refreshTrigger → child tabs re-fetch
```

---

## 2. Backend API Reference

### Core Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/my-work/personal-tasks` | List personal tasks (with focus/triage/origin fields) |
| GET | `/my-work/personal-tasks/:id` | Single task |
| POST | `/my-work/personal-tasks` | Create task |
| PUT | `/my-work/personal-tasks/:id` | Update task |
| DELETE | `/my-work/personal-tasks/:id` | Delete task |
| GET | `/my-work/decisions` | List decisions |
| GET | `/my-work/decisions/queue` | Decision queue |
| GET | `/my-work/decisions/:id/brief` | AI decision brief (template-based) |
| GET | `/my-work/inbox` | Inbox items + triage state |
| POST | `/my-work/inbox/:id/triage` | Triage single item |
| POST | `/my-work/inbox/bulk-triage` | Bulk triage |
| POST | `/my-work/inbox/auto-triage` | AI auto-triage with confidence |
| GET | `/my-work/focus/state` | Focus board state |
| PUT | `/my-work/focus/move` | Move item between columns |
| POST | `/my-work/focus/ai-plan` | Generate AI time-blocked plan |
| GET | `/my-work/my-ideas` | List ideas |
| POST | `/my-work/my-ideas/:id/convert` | Convert idea → tasks/decision |
| GET | `/my-work/notebook/pages` | List notebook pages |
| POST | `/my-work/notebook/pages/:id/convert` | Convert page |
| POST | `/my-work/notebook/pages/:id/classify` | AI classify note content |

### AI & Intelligence Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/my-work/context-summary` | User workload summary for chat context |
| GET | `/my-work/morning-brief` | Morning briefing data |
| GET | `/my-work/priority-advice` | AI Priority Coach recommendations |
| GET | `/my-work/work-patterns` | Velocity, completion time, overdue rate |
| GET | `/my-work/delegation-suggestions` | AI-ranked delegation candidates |
| GET | `/my-work/related-context` | KnowledgePulse cross-entity search |
| GET | `/my-work/relationships` | AI relationship graph |
| GET | `/my-work/signals` | Signals + predictive AI signals |
| POST | `/my-work/chat-actions` | Chat→Action bridge (create task/decision) |
| POST | `/my-work/weekly-review/generate` | AI weekly review |
| GET | `/my-work/session-context` | Restore previous session |
| POST | `/my-work/session-context` | Save session context |

### AI Services (Backend)

| Service | File | Status | Methods |
|---|---|---|---|
| TaskAdvisorService | `services/ai/taskAdvisorService.ts` | **Implemented** | `analyzePortfolio()` → ranked recommendations |
| ProactiveNudges | `services/ai/proactiveNudges.ts` | **Implemented** | 8 methods: generate, dismiss, track, suppress, etc. |
| ProactiveSuggestions | `services/ai/proactiveSuggestionsService.ts` | Existing | General suggestions |
| AI Memory | `services/ai/aiMemoryService.ts` | Existing | Cross-session memory (connected via session-context) |

---

## 3. Feature Matrix

### Cross-Tab Synergy Features

| Feature | Description | Components |
|---|---|---|
| **EventBus** | Zustand-based cross-tab refresh on item changes | `uiSlice.ts`, `MyWorkHub.tsx`, all tab components |
| **Origin Tracking** | `source_type`/`source_id` on tasks+decisions | Migration `20260311`, conversion endpoints |
| **Origin Badges** | "Created from Idea/Note" with navigation | `TaskDetailView`, `DecisionDetailView` |
| **Focus Badges** | Shows Focus column (Today/Week/Later) in Tasks | `MyTasksListContent.tsx` |
| **Triage Badges** | "Triaged" badge on tasks processed through Inbox | `MyTasksListContent.tsx`, JOIN on backend |
| **Executive Deep Links** | KPI tiles navigate with filter context | `ExecutiveDashboard.tsx`, `KPIGrid.tsx` |
| **mywork-open-item Listener** | Central handler for cross-component navigation | `MyWorkHub.tsx` |

### Chat Integration Features

| Feature | Description | Components |
|---|---|---|
| **Per-Tab System Prompts** | 7 AI personas (executive advisor, productivity coach, etc.) | `MyWorkHub.tsx` → `uiSlice.ts` → `SplitLayout.tsx` |
| **Quick Prompts** | Tab-specific suggestion chips in chat | `UnifiedChatPanel.tsx` |
| **Ask AI Buttons** | One-click contextual chat in all detail views | `askAiHelper.ts`, all detail views |
| **Chat Context Enrichment** | System prompt includes workload stats | `GET /context-summary`, `MyWorkHub.tsx` |
| **Chat→Action Bridge** | `/task` and `/decision` commands in chat | `UnifiedChatPanel.tsx`, `POST /chat-actions` |
| **Context Carry-over** | Session context saved/restored between visits | `GET/POST /session-context` |

### AI Intelligence Features

| Feature | Description | Components |
|---|---|---|
| **Morning Briefing** | Daily card with overdue, due-soon, decisions, new tasks | `MorningBriefCard.tsx`, `GET /morning-brief` |
| **AI Priority Coach** | Ranked task recommendations with urgency | `AICoachPanel.tsx`, `GET /priority-advice` |
| **Proactive Nudges** | Stale task/deadline/overload alerts in Focus | `NudgeStrip.tsx`, `proactiveNudges.ts` |
| **AI Decision Briefs** | Template-based urgency assessment per decision | `GET /decisions/:id/brief` |
| **Predictive Signals** | Overdue predictions + decision bottleneck detection | Extended `GET /signals` |
| **AI Auto-Triage** | Confidence-scored inbox classification | `POST /inbox/auto-triage` |
| **Work Pattern Analysis** | Velocity, completion time, overdue rate, insights | `GET /work-patterns`, Executive widget |
| **AI Weekly Review** | Auto-filled review as Notebook page | `POST /weekly-review/generate`, `NewPageModal.tsx` |
| **Predictive Focus Planning** | Time-blocked AI schedule | `AIPlanView.tsx`, `POST /focus/ai-plan` |
| **AI Delegation Advisor** | Capacity/history-based people ranking | `GET /delegation-suggestions`, `FocusView.tsx` |
| **Smart Note Routing** | AI classifies mature notes, suggests conversion | `POST /notebook/pages/:id/classify` |
| **KnowledgePulse Expansion** | Related context in Tasks + Decisions (not just Notebook) | `RelatedContext.tsx`, `GET /related-context` |
| **AI Relationships Graph** | Cross-entity semantic connections | `AIConnections.tsx`, `GET /relationships` |

### Notebook Features

| Feature | Description |
|---|---|
| **Slash Commands** | `/task`, `/decision`, `/idea` create artifacts inline |
| **AI Commands** | `/ask`, `/expand`, `/challenge`, `/action` for content |
| **Smart Routing** | Mature notes classified and conversion suggested |
| **KnowledgePulse** | Related artifacts sidebar |
| **Weekly Review Template** | AI auto-fills wins/blockers/priorities |
| **Conversion Flows** | Page → Task, Decision, Initiative with backlinks |

### Idea Management Features

| Feature | Description |
|---|---|
| **Promote CTA Strip** | Visible action bar when idea reaches ready/summary stage |
| **Conversion** | → Task set, Decision, Initiative with origin tracking |
| **Mind Map** | Visual graph of ideas with AI-suggested connections |
| **Garden View** | Card-based maturity visualization |

---

## 4. Database Schema Extensions

### Origin Tracking (Migration: `20260311_origin_tracking.sql`)

```sql
ALTER TABLE tasks ADD COLUMN source_type TEXT DEFAULT NULL;   -- 'idea' | 'notebook' | 'decision'
ALTER TABLE tasks ADD COLUMN source_id TEXT DEFAULT NULL;
ALTER TABLE decisions ADD COLUMN source_type TEXT DEFAULT NULL;
ALTER TABLE decisions ADD COLUMN source_id TEXT DEFAULT NULL;
```

### Session Context (auto-created by endpoint)

```sql
CREATE TABLE my_work_session_context (
  user_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  context_data TEXT NOT NULL,  -- JSON: { lastViewedItems, activeTab, chatTopics }
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, organization_id)
);
```

### Nudge Tracking (auto-created by service)

```sql
CREATE TABLE ai_nudge_activity (user_id, organization_id, activity_type, entity_id, action, created_at);
CREATE TABLE ai_nudge_actions (nudge_id, user_id, action, acted_at);
CREATE TABLE ai_nudge_suppressions (user_id, nudge_type, suppressed_until);
```

---

## 5. i18n Support

All features support PL + EN via `useTranslation()` / inline `isPolish` checks.

New translation key namespaces:
- `myWork.morningBrief.*` — Morning briefing card
- `myWork.nudges.*` — Proactive nudge messages
- `myWork.followUp.*` — Post-decision follow-up modal
- `myWork.askAi.*` — Ask AI button labels
- `myWork.convert.*` — ConvertToMenu labels
- `myWork.coach.*` — AI Coach panel
- `myWork.patterns.*` — Work pattern analysis

---

## 6. Security & Access Control

- **Executive tab** restricted to admin/manager/superadmin roles (`useUserCan()`)
- All API endpoints use `requireUser(req, res)` for authentication
- Queries scoped to `organization_id` + `user_id` (no cross-org data leaks)
- AI services never expose raw data to other users
- Session context stored per-user, per-org
