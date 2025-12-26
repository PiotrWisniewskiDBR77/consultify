# UI RULES

## General Principles

UI must:
- reflect phase clearly
- never suggest future phases
- reduce cognitive load
- maintain consistent visual hierarchy
- provide clear feedback for all actions

UI must not:
- mix onboarding with selling
- overload dashboards early
- use color alone to convey meaning
- break accessibility standards

---

## My Work Module UI Rules

### Focus Board

- **Maximum Focus Tasks**: Display max 5-7 tasks to avoid overwhelm
- **Time Block Visualization**: 
  - Use color-coded blocks matching task priority
  - Show current time indicator (red line)
  - Highlight conflicts/overlaps in red
- **Empty State**: Show motivational message + quick add button

### Inbox Triage

- **PMO Category Grouping**:
  - 🔴 Blocking Phase → Red left border
  - 🟠 Blocking Initiative → Orange left border
  - 🟡 Awaiting Decision → Amber left border
  - ⚫ Overdue → Dark border
  - ✅ Other → Green left border
- **Task Cards**:
  - Show PMO labels prominently (top of card)
  - Due date with countdown for <48h
  - Initiative/project context always visible
  - Quick actions on hover (desktop) or swipe (mobile)
- **Collapse by Default**: Only show expanded for critical categories

### Task Lists (All Tasks)

- **Multi-Select Filters**: 
  - Chips with checkmarks for active filters
  - Clear filter count visible
  - "Clear All" option when >2 filters active
- **Virtualization**: Required for lists >50 items
- **Skeleton Loading**: Show 5 skeleton cards during load
- **Empty State**: Different message for "no tasks" vs "no matching filters"

### Notifications

- **Severity Styling**:
  - CRITICAL: Red background, bold text
  - WARNING: Amber background
  - INFO: Blue/neutral background
- **Unread Indicator**: Blue dot on left
- **Read State**: Reduced opacity (0.6)
- **Action Buttons**: Always visible, not on hover

### Dashboard Widgets

- **Execution Score Card**:
  - Large score number (32px+)
  - Progress bar with completed/overdue sections
  - Trend indicator (↑/↓/→)
- **Workload Heatmap**:
  - 7-day view default
  - Color scale: green→yellow→red
  - Tooltips with exact values
- **Bottleneck Alerts**:
  - Max 5 visible, "Show More" for rest
  - Severity icon on left
  - Suggested action in italics
- **Velocity Chart**:
  - Last 4 weeks default
  - Trend line overlay
  - Hover for exact values

---

## Responsive Design Rules

### Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | <768px | Single column, bottom nav |
| Tablet | 768-1024px | Two columns, side tabs |
| Desktop | >1024px | Three columns, full layout |

### Mobile-Specific

- **Touch Targets**: Minimum 44×44px
- **Swipe Gestures**:
  - Left swipe → Danger actions (delete, archive)
  - Right swipe → Positive actions (complete, prioritize)
- **Bottom Action Bar**: Sticky, max 4 actions
- **Collapsible Sections**: All category headers collapsible
- **Pull-to-Refresh**: Standard gesture for all lists

### Tablet Adaptations

- **Split View**: List on left, detail on right
- **Floating Action Button**: Bottom-right for create
- **Sidebar**: Collapsible to icons only

---

## Accessibility Requirements (WCAG 2.1 AA)

### Focus Management

- Visible focus indicators (ring-2 ring-blue-500)
- Logical tab order
- Focus trap in modals
- Skip links for main content

### Screen Readers

- All images have alt text
- Form fields have labels
- Status changes announced via aria-live
- Button purposes clear from label

### Color & Contrast

- Contrast ratio ≥ 4.5:1 for text
- Contrast ratio ≥ 3:1 for UI components
- Never use color alone (always icon or text)

### Keyboard Navigation

- All features accessible via keyboard
- Shortcuts documented and discoverable
- Escape closes modals/dropdowns
- Arrow keys for list navigation

---

## Loading States

| Component | Loading UI |
|-----------|------------|
| Full Page | Centered spinner + skeleton |
| List | 5 skeleton cards |
| Card | Pulse animation on content |
| Button | Disabled + spinner inside |
| Modal | Overlay + centered spinner |

---

## Error States

- **Form Validation**: Red border + error message below field
- **API Error**: Toast notification (error variant)
- **Empty Result**: Friendly illustration + message + CTA
- **Network Error**: Full-screen retry message

---

## Animation Guidelines

- **Duration**: 150-300ms for micro-interactions
- **Easing**: ease-out for entries, ease-in for exits
- **Reduced Motion**: Respect prefers-reduced-motion
- **Purpose**: Only animate for feedback or guidance

---

*Last Updated: December 26, 2024*
