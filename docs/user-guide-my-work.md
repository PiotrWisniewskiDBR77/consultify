# My Work Module - User Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Focus Board](#focus-board)
3. [Inbox Triage](#inbox-triage)
4. [All Tasks](#all-tasks)
5. [Dashboard & Analytics](#dashboard--analytics)
6. [Notifications](#notifications)
7. [Keyboard Shortcuts](#keyboard-shortcuts)
8. [Mobile Experience](#mobile-experience)
9. [FAQ](#faq)

---

## Getting Started

### What is My Work?

My Work is your personal productivity hub within Consultify. It brings together all your tasks, decisions, and notifications in one place, designed with PMO best practices from McKinsey, BCG, Deloitte, and top tools like Jira, Linear, and Notion.

**Key Features:**
- 🎯 **Focus Board**: Plan your day with time blocks
- 📥 **Inbox Triage**: Process new tasks efficiently (Inbox Zero methodology)
- 📋 **All Tasks**: View and filter all your tasks
- 📊 **Dashboard**: Track your execution score and team workload
- 🔔 **Notifications**: Stay updated with smart alerts

### Accessing My Work

1. Log in to Consultify
2. Click **"My Work"** in the left sidebar (or press `g + w`)
3. You'll see the tabbed interface with Focus, Inbox, Tasks, Dashboard, and Notifications

---

## Focus Board

### Overview

The Focus Board helps you plan your day using time blocking - a technique used by top executives and consultants. It shows tasks you've prioritized for today with dedicated time slots.

### Adding Tasks to Focus

**Method 1: From Inbox**
1. Open the Inbox tab
2. Find a task you want to focus on
3. Swipe right (mobile) or click the ➡️ prioritize button
4. Task appears in your Focus Board

**Method 2: From All Tasks**
1. Open the All Tasks tab
2. Click the "Add to Focus" button on any task
3. Optionally set time blocks

**Method 3: Create New**
1. Click **"+ Add Task to Focus"** button
2. Fill in task details
3. Task is automatically added to today's focus

### Time Blocks

Time blocks help you allocate specific hours to tasks:

1. Click **"+ Add Block"** next to a focus task
2. Set start time (e.g., 09:00)
3. Set end time (e.g., 10:30)
4. Block appears in your daily schedule

**Tips for Effective Time Blocking:**
- ✅ Block your most important work for morning hours
- ✅ Include buffer time between blocks
- ✅ Limit to 3-5 focus tasks per day
- ✅ Reserve time for unexpected issues

### Focus Board Layout

| Column | Content |
|--------|---------|
| **Time Blocks** | Your scheduled tasks with time slots |
| **Upcoming & Important** | Quick view of high-priority items |

---

## Inbox Triage

### Overview

The Inbox is where new, unprocessed tasks land. Following the "Inbox Zero" methodology, you should regularly triage items here to keep your workload manageable.

### Inbox Categories (PMO View)

Tasks are automatically grouped by PMO impact:

| Category | Icon | Meaning |
|----------|------|---------|
| 🔴 **Blocking Phase** | Critical tasks blocking a phase gate |
| 🟠 **Blocking Initiative** | Tasks blocking initiative progress |
| 🟡 **Awaiting Decision** | Tasks waiting for stakeholder decisions |
| ⚫ **Overdue** | Past-due tasks requiring attention |
| ✅ **Other** | All remaining tasks |

### Triage Actions

For each inbox task, you can:

| Action | Button | Keyboard | Description |
|--------|--------|----------|-------------|
| **Complete** | ✓ | `d` | Mark task as done |
| **Prioritize** | ➡️ | `p` | Add to Focus Board |
| **Defer** | 🕐 | `Tab` | Postpone to later date |
| **Delegate** | 👤 | `@` | Reassign to teammate |
| **Delete** | 🗑️ | `Backspace` | Remove task |

### Quick Triage Workflow

1. Open Inbox (press `g + i`)
2. Review tasks starting from **🔴 Blocking Phase**
3. For each task, decide: Complete, Prioritize, Defer, Delegate, or Delete
4. Work through all categories
5. Aim for **Inbox Zero** daily!

### Filters

Use the filter bar to show:
- **All**: All inbox items
- **Actionable**: Tasks you can act on now
- **Deferred**: Tasks you've postponed

---

## All Tasks

### Overview

The All Tasks view shows every task assigned to you, with powerful filtering and sorting options.

### Filtering Tasks

Click filter buttons to narrow down:

| Filter | Options |
|--------|---------|
| **Status** | To Do, In Progress, Completed, Blocked |
| **Priority** | Urgent, High, Medium, Low |
| **Due Date** | Today, This Week, Next Week, Overdue, Any |
| **PMO Category** | Blocking Phase, Blocking Initiative, Awaiting Decision, Unassigned |

**Multi-Select Filters**: You can select multiple options per filter (e.g., "Urgent" AND "High" priority).

### Sorting

Click column headers to sort by:
- Due Date (earliest/latest)
- Priority (highest/lowest)
- Title (A-Z/Z-A)
- Created Date (newest/oldest)

### Task Actions

Right-click or use the action menu on any task:
- **Edit**: Open task details modal
- **Complete**: Mark as done
- **Prioritize**: Add to Focus Board
- **Delete**: Remove task (requires confirmation)

---

## Dashboard & Analytics

### Overview

The Dashboard gives you visibility into your personal execution metrics and team workload.

### Execution Score Card

Your **Personal Execution Score** (0-100) measures your productivity:

**Calculation:**
```
Base Score = (Completed Tasks / Total Tasks) × 100
Penalty = Overdue Tasks × 5 points
Final Score = Base Score - Penalty
```

**Score Insights:**
- 90-100: 🟢 Excellent execution
- 70-89: 🟡 Good, room for improvement
- 50-69: 🟠 Needs attention
- 0-49: 🔴 Critical - review workload

### Workload Heatmap

Shows team capacity utilization across dates:

| Color | Utilization | Meaning |
|-------|-------------|---------|
| 🟢 Green | 0-70% | Healthy capacity |
| 🟡 Yellow | 70-90% | Near capacity |
| 🔴 Red | 90%+ | Overloaded |

**How to Read:**
- Each cell = one day
- Color intensity = task load
- Hover for details
- Click to see specific tasks

### Bottleneck Alerts

AI-detected blocking issues:

| Alert Type | Description |
|------------|-------------|
| **Task Bottleneck** | Single task blocking multiple others |
| **Initiative Block** | Tasks blocking initiative progress |
| **Resource Overload** | Team member overloaded |

**Action**: Click alert → View suggested resolution

### Velocity Chart

Shows your task completion velocity over time:
- **Weekly completed tasks**: Bar chart
- **Avg cycle time**: Days from creation to completion
- **Trend line**: Improvement/decline over weeks

---

## Notifications

### Notification Center

Access via the **Notifications** tab or bell icon 🔔 in header.

**Notification Types:**

| Type | Icon | Description |
|------|------|-------------|
| Task Assigned | 📋 | New task assigned to you |
| Task Completed | ✅ | Task you're watching completed |
| Task Overdue | ⏰ | Task past due date |
| Decision Required | ❓ | Stakeholder decision needed |
| Initiative Blocked | 🚫 | Initiative progress blocked |
| AI Risk Detected | 🤖 | AI identified a risk |
| Gate Approaching | 🚪 | Phase gate deadline approaching |

**Severity Levels:**
- 🔵 **INFO**: Informational updates
- 🟡 **WARNING**: Requires attention
- 🔴 **CRITICAL**: Urgent action needed

### Managing Notifications

**Mark as Read:**
- Click notification to mark as read
- Or click "Mark All Read" button

**Delete:**
- Click the 🗑️ trash icon on notification

### Notification Preferences

Customize your notification experience:

1. Go to **Notifications** tab
2. Click **Preferences** (gear icon)
3. Configure:

**Mute by Severity:**
- Toggle off: Info / Warning / Critical

**Mute Specific Types:**
- Uncheck types you don't want (e.g., "Task Assigned")

**Email Digest:**
- Enable/Disable digest emails
- Frequency: Daily or Weekly
- Time: Choose delivery hour (e.g., 08:00)

---

## Keyboard Shortcuts

### Global Navigation

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open command palette |
| `g + f` | Go to Focus |
| `g + i` | Go to Inbox |
| `g + t` | Go to All Tasks |
| `g + d` | Go to Dashboard |
| `g + n` | Go to Notifications |
| `?` | Show shortcuts help |

### Task Actions

| Shortcut | Action |
|----------|--------|
| `c` | Create new task |
| `/` | Focus search bar |
| `Enter` | Open selected task |
| `e` | Edit selected task |
| `d` | Complete/done |
| `Backspace` | Delete task |
| `p` then `1` | Set priority: Urgent |
| `p` then `2` | Set priority: High |
| `p` then `3` | Set priority: Medium |
| `p` then `4` | Set priority: Low |
| `Tab` | Defer task |
| `Escape` | Close modal/dropdown |

### Command Palette

Press `Cmd/Ctrl + K` to open the command palette:

1. Type to search commands
2. Use arrow keys to navigate
3. Press `Enter` to execute
4. Press `Escape` to close

**Available Commands:**
- "Create task" → Opens new task modal
- "Go to Focus" → Navigates to Focus tab
- "Search tasks..." → Opens task search
- "Settings" → Opens preferences
- "Help" → Opens documentation

---

## Mobile Experience

### Touch Gestures

| Gesture | Action |
|---------|--------|
| **Swipe Left** | Reveal quick actions (complete, delete) |
| **Swipe Right** | Prioritize / add to focus |
| **Pull Down** | Refresh current list |
| **Long Press** | Open context menu |
| **Tap** | Select / open item |

### Mobile-Optimized Features

- **Large Touch Targets**: All buttons ≥ 44px
- **Bottom Action Bar**: Easy thumb access
- **Sticky Headers**: Tab bar stays visible
- **Collapsible Sections**: Expand/collapse categories
- **Haptic Feedback**: Vibration on actions (iOS)

### Responsive Breakpoints

| Screen Size | Layout |
|-------------|--------|
| **Mobile** (<768px) | Single column, bottom tabs |
| **Tablet** (768-1024px) | Two column, side tabs |
| **Desktop** (>1024px) | Three column, full layout |

---

## FAQ

### General

**Q: How often does my Execution Score update?**
A: Real-time. Every task completion or status change updates your score immediately.

**Q: Can I customize the Focus Board layout?**
A: Currently, the two-column layout is fixed. Drag-and-drop reordering is coming soon.

**Q: What's the difference between Inbox and All Tasks?**
A: Inbox shows only unprocessed/actionable tasks for triage. All Tasks shows everything, including completed tasks.

### Focus Board

**Q: How many tasks should I add to Focus?**
A: Recommended: 3-5 tasks per day. Quality over quantity for deep work.

**Q: Can I add time blocks for future days?**
A: Currently, Focus Board is for today only. Use calendar integration for future planning.

**Q: What happens to incomplete Focus tasks at end of day?**
A: They stay in your Inbox for next-day triage.

### Inbox Triage

**Q: How do I achieve Inbox Zero?**
A: Process every item using the 4 Ds: Do, Defer, Delegate, Delete. Aim to clear your inbox daily.

**Q: Why are some tasks auto-categorized as "Blocking Phase"?**
A: Tasks linked to initiatives nearing phase gates are automatically flagged.

### Notifications

**Q: I'm getting too many notifications. What can I do?**
A: Go to Notification Preferences and:
1. Mute INFO-level notifications
2. Uncheck non-critical notification types
3. Enable daily digest to batch non-urgent updates

**Q: How do digest emails work?**
A: Instead of individual notifications, you receive one summary email with all updates from the previous day/week.

### Keyboard Shortcuts

**Q: How do I remember all the shortcuts?**
A: Press `?` anytime to see the shortcuts reference panel. Most common: `Cmd+K` for command palette.

**Q: Do shortcuts work on mobile?**
A: Shortcuts are desktop-only. Use swipe gestures on mobile.

---

## Tips for Maximum Productivity

### Daily Workflow

1. **Morning (5 min)**: Triage Inbox → prioritize top 3 tasks to Focus
2. **During Day**: Work through Focus tasks with time blocks
3. **End of Day (5 min)**: Review Execution Score, prep tomorrow's Focus

### Weekly Review

1. Check **Velocity Chart** for trends
2. Review **Workload Heatmap** for overload patterns
3. Clear any **Bottleneck Alerts**
4. Adjust notification preferences if needed

### PMO Best Practices

- ✅ Always address **Blocking Phase** tasks first
- ✅ Escalate **Awaiting Decision** items that are >48h old
- ✅ Maintain Execution Score >80 for healthy project velocity
- ✅ Use time blocking for deep work (no meetings during blocks)

---

## Support

**Email**: support@consultify.com  
**Slack**: #my-work-module  
**Documentation**: `/docs/my-work-api.md`

---

*Last Updated: December 26, 2024*

