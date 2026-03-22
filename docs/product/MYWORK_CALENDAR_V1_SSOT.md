# My Work Calendar V1 — SSOT (Product Specification)

> **Status:** Canonical (V1)  
> **Module:** My Work  
> **Purpose:** Single source of truth for the My Work Calendar tab: unified view of all time-bound items across the platform.

---

## 1. Overview

The My Work Calendar is a **new top-level Calendar tab** within the My Work module. It provides a unified view of all time-bound items across the platform—tasks, initiative milestones, decision deadlines, and external calendar events—in a single, filterable interface.

**Key principles:**
- Single pane of glass for all date-related commitments
- Source-based filtering (show/hide by type)
- Consistent DBR77 dark theme
- Responsive layout: sidebar + main grid

---

## 2. Data Sources

| Source | Table | Date Field | Scope |
|--------|-------|------------|-------|
| Tasks | `tasks` | `due_date` | Assignee = current user |
| Initiative milestones | `initiatives` | `target_date` | Organization |
| Decision deadlines | `decisions` | `deadline` | Created by or assigned to current user |
| Google Calendar | External | Event start/end | Via OAuth integration |
| Outlook Calendar | External | Event start/end | Via OAuth integration |

**Notes:**
- Tasks: Exclude `done`, `completed`, `cancelled` statuses
- Initiatives: Exclude `completed`, `cancelled` statuses  
- Decisions: Exclude `resolved`, `cancelled` statuses
- Google/Outlook: Fetched via existing OAuth flows; merged on frontend or backend per integration architecture

---

## 3. UI Components

| Component | Path | Responsibility |
|-----------|------|----------------|
| CalendarView | `src/components/MyWork/Calendar/CalendarView.tsx` | Main container. Manages layout (sidebar + grid), state (date, view mode, filter), loading overlay, and event click handlers for navigation to tasks/decisions/initiatives |
| CalendarGrid | `src/components/MyWork/Calendar/CalendarGrid.tsx` | FullCalendar wrapper. Renders month/week/day/list views, receives events, handles date navigation and view mode switching |
| CalendarSidebar | `src/components/MyWork/Calendar/CalendarSidebar.tsx` | Mini calendar for quick date navigation + source filter checkboxes (Tasks, Initiatives, Decisions, Google, Outlook) |
| calendar-theme.css | `src/components/MyWork/Calendar/calendar-theme.css` | DBR77 dark theme overrides for FullCalendar (backgrounds, borders, event pills, headers) |

**Layout:** Flex row; sidebar fixed width, grid flex-1 with min-w-0 to prevent overflow.

---

## 4. API Endpoints

### 4.1 GET /api/my-work/calendar/unified

Merges all internal sources (tasks, initiatives, decisions). Supports date range and source filtering.

**Query parameters:**
- `start` (optional): ISO date string
- `end` (optional): ISO date string  
- `sources` (optional): Comma-separated list: `task`, `initiative`, `decision`, `google`, `outlook` (default: all)
- `projectId` (optional): Filter by project

**Response:**
```json
{
  "events": [
    {
      "id": "task-<uuid>",
      "title": "string",
      "start": "ISO8601",
      "end": "ISO8601 (optional)",
      "allDay": true,
      "source": "task|initiative|decision|google|outlook",
      "sourceId": "string",
      "color": "#hex",
      "status": "string (optional)",
      "priority": "string (optional)",
      "description": "string (optional)"
    }
  ]
}
```

### 4.2 POST /api/my-work/calendar/events (V2)

Create events from calendar. V1: Task creation supported. V2: Initiative milestones, decisions.

### 4.3 GET /api/my-work/calendar/conflicts (V2)

Conflict detection for a given date. Returns overlapping items and optional suggestion.

**Query parameters:**
- `date` (optional): ISO date string (default: today)

### 4.4 PATCH /api/my-work/calendar/events/:eventId/reschedule (V2)

Drag-and-drop reschedule. Updates `due_date` / `deadline` / `target_date` for the underlying entity.

---

## 5. Color Coding

| Source | Color | Hex |
|--------|-------|-----|
| Task | Blue | `#3b82f6` |
| Initiative | Purple | `#8b5cf6` |
| Decision | Amber | `#f59e0b` |
| Google | Green | `#10b981` |
| Outlook | Indigo | `#6366f1` |

These values are defined in `calendarTypes.ts` as `SOURCE_COLORS` and applied to FullCalendar event objects via the `backgroundColor` / `borderColor` properties.

---

## 6. View Modes

Supported via FullCalendar plugins:

| Mode | Plugin | Use case |
|------|--------|----------|
| Month | `@fullcalendar/daygrid` | Overview, pattern recognition |
| Week | `@fullcalendar/timegrid` | Hour-level detail |
| Day | `@fullcalendar/timegrid` | Single-day focus |
| List | `@fullcalendar/list` | Dense agenda, print-friendly |

View mode is stored in component state and passed to CalendarGrid. Default: month.

---

## 7. V2 Roadmap

| Capability | Description |
|------------|-------------|
| Bidirectional sync | Push created/updated events to Google/Outlook |
| Drag-to-create | Create new events by dragging on empty slots |
| Conflict detection | Highlight overloaded days, suggest rescheduling |
| AI scheduling suggestions | Propose optimal slots based on workload and priorities |

---

## 8. Dependencies

```json
{
  "@fullcalendar/react": "^6.x",
  "@fullcalendar/core": "^6.x",
  "@fullcalendar/daygrid": "^6.x",
  "@fullcalendar/timegrid": "^6.x",
  "@fullcalendar/interaction": "^6.x",
  "@fullcalendar/list": "^6.x"
}
```

---

## Related Documents

- `docs/product/MYWORK_CALENDAR_V8_BENCHMARK.md` - benchmark and interoperability lessons for the v8 target
- `docs/product/MYWORK_CALENDAR_V8_READINESS_AUDIT.md` - readiness verdict and remaining blockers for the v8 package
- `docs/product/MYWORK_CALENDAR_V8_SSOT.md` - canonical v8 product truth that extends this v1 baseline
- `docs/product/MYWORK_CALENDAR_V8_AS_IS.md` - current runtime interpretation for the v8 work
- `docs/product/MYWORK_CALENDAR_V8_GAP_MATRIX.md` - explicit gap matrix between current state and v8 target
- `docs/product/MYWORK_CALENDAR_V8_IMPLEMENTATION_PLAN.md` - phased delivery plan for the v8 package
- `docs/ui-standards/FROZEN_LAYOUTS.md` — Module topbar, view modes order
- `docs/ui-standards/README.md` — UI/UX baseline
- `server/src/routes/my-work.routes.ts` — Calendar endpoint implementation
- `src/components/MyWork/Calendar/calendarTypes.ts` — Types and constants
