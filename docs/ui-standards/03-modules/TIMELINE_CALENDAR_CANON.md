# Timeline & Calendar Views — Canon v1

> SSOT for all temporal views in the app: calendar grids, Gantt bars, and planner strips.  
> Last updated: 2026-06-14

---

## 1. Inventory (as of v1)

| Location | Component | View type | Tab/Mode |
|---|---|---|---|
| My Work → Zadania | `TasksCalendarView.tsx` | Weekly calendar grid | "Kalendarz" tab |
| Initiatives → Portfolio | `RoadmapGantt.tsx` | Gantt (swimlanes × months) | "Harmonogram" tab |
| Initiatives → Detail | `sections/TimelinePlanner.tsx` | Mini planner strip | Initiative detail card |

Interview has **no** dedicated timeline view — time metadata lives in session progress bars only.

---

## 2. Color tokens

### 2.1 Today indicator
```
header:  bg-blue-50 dark:bg-blue-500/10  text-blue-700 dark:text-blue-300
body:    bg-blue-50/50 dark:bg-blue-500/5
```
NEVER use `bg-primary-500/10` (crimson) for today highlighting. Primary = Harvard Crimson = brand/destructive only.

### 2.2 Overdue items
```
container: border-rose-200 dark:border-rose-900/40  bg-rose-50/70 dark:bg-rose-500/10
text:      text-rose-700 dark:text-rose-300
```
Overdue is a danger-semantic state — rose/red is correct and intentional.

### 2.3 Urgent / high-priority task chips
```
bg-amber-100 dark:bg-amber-500/10  text-amber-900 dark:text-amber-200
hover:bg-amber-100 dark:hover:bg-amber-500/15
```
`bg-amber-50` is banned (yellow on white = too low contrast in light mode).

### 2.4 Backlog / normal task chips
```
bg-slate-50 dark:bg-navy-950  text-slate-800 dark:text-slate-200
hover:bg-slate-100 dark:hover:bg-navy-800
```

### 2.5 Gantt bars (RoadmapGantt)
Use semantic initiative status colors (defined in `RoadmapGantt.tsx` STATUS_COLORS). Do not override with primary/crimson.

### 2.6 Warning / info callouts in timeline
Follows the global callout standard:
```
border-l-4 border-l-amber-500 bg-amber-100  text-amber-800
```

---

## 3. Source / filter toggle pattern
```
active:   bg-slate-100 dark:bg-white/10  text-slate-900 dark:text-white font-medium
inactive: text-slate-700 dark:text-slate-300  hover:bg-slate-50 dark:hover:bg-navy-800
```
Never use `bg-brand/10 text-brand` — `brand` is not a defined CSS variable.

---

## 4. Navigation controls (Prev / Today / Next)
```
rounded-md border border-slate-200 dark:border-navy-700
bg-white dark:bg-navy-900
px-2 py-1 text-xs
text-slate-700 dark:text-slate-300
hover:bg-slate-50 dark:hover:bg-navy-800
```

---

## 5. Structure rules

### Weekly calendar (TasksCalendarView)
- Layout: `grid grid-cols-1 lg:grid-cols-4` — Backlog column (1) + 7-day week (3 cols)
- Week starts Monday (`startOfWeekMonday` helper)
- Max height for scrollable columns: `max-h-[520px] overflow-auto`
- "No tasks" placeholder: `text-[11px] text-slate-600 dark:text-slate-500`

### Gantt (RoadmapGantt)
- Swimlanes by initiative, columns by month
- Progress bar inside bar: `bg-c-info` (blue) for in-progress, `bg-emerald-500` for complete
- Critical-path / WBS features: **not in scope** for v1 (V8 remnants removed)

---

## 6. Roadmap

**v1 (current):** Color standardization complete. Functional weekly grid + Gantt confirmed.

**v2 (backlog):** Full ClickUp-grade Gantt for Tasks — day columns, drag-to-reschedule, bar spans. Estimated: 3–5 dev days. Not scoped for current sprint.
