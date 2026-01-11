# Component Audit Checklist

> **Purpose:** Manual verification checklist for UI/UX compliance  
> **Instructions:** For each component, verify all checkpoints and assign pass/fail  
> **Scoring:** % of passed checks = component score for that dimension

---

## 🎯 Global Utilities

### Feedback Panel (Platinum Reference ✅)

**Status:** Reference Implementation - Should score 100%

| #   | Checkpoint                                        | Dimension   | Pass Criteria                 | ✓   |
| --- | ------------------------------------------------- | ----------- | ----------------------------- | --- |
| 1   | Width is exactly 380px                            | Layout      | Hard-coded `w-[380px]`        | ✅  |
| 2   | Backdrop blur applied                             | Layout      | `backdrop-blur-sm` on overlay | ✅  |
| 3   | Amber color motif                                 | Components  | Accent is `amber-500`         | ✅  |
| 4   | Header is `bg-slate-50 dark:bg-navy-900`          | Visual      | Correct background            | ✅  |
| 5   | Border is `border-slate-200 dark:border-white/10` | Dark Mode   | Correct borders               | ✅  |
| 6   | Tabs use segmented pattern                        | Components  | `border-b-2` for active       | ✅  |
| 7   | Success state shows large icon                    | Interaction | High-fidelity success view    | ✅  |
| 8   | Context auto-fills (user, module)                 | Enterprise  | Uses `useAppStore`            | ✅  |
| 9   | Focus ring on all buttons                         | A11y        | `focus:ring-2` visible        | ✅  |
| 10  | Keyboard navigable                                | A11y        | Tab order logical             | ✅  |

**Expected Score:** 100% (10/10)

---

### Help Panel

| #   | Checkpoint                            | Dimension   | Pass Criteria                                      | ✓   |
| --- | ------------------------------------- | ----------- | -------------------------------------------------- | --- |
| 1   | Width is exactly 380px                | Layout      | Same as Feedback                                   | ☐   |
| 2   | Purple color motif                    | Components  | Accent is `purple-500`                             | ☐   |
| 3   | Platinum header pattern               | Components  | Matches Feedback structure                         | ☐   |
| 4   | `bg-white dark:bg-navy-950` container | Visual      | Correct background                                 | ☐   |
| 5   | Smooth slide-in animation             | Interaction | `duration-200`                                     | ☐   |
| 6   | Context-aware content                 | Enterprise  | Shows relevant help per module                     | ☐   |
| 7   | AI assistance panel available         | Components  | Purple-tinted `bg-purple-50 dark:bg-purple-900/20` | ☐   |
| 8   | Search input has correct styling      | Visual      | `rounded-xl bg-slate-50 dark:bg-navy-900`          | ☐   |
| 9   | All text has dark mode variant        | Dark Mode   | No orphan light-only text                          | ☐   |
| 10  | Close button has hover state          | Interaction | `hover:bg-slate-100 dark:hover:bg-navy-800`        | ☐   |

**Target Score:** 95%+ (matches Platinum standard)

---

### Documents Panel

| #   | Checkpoint                      | Dimension   | Pass Criteria                                  | ✓   |
| --- | ------------------------------- | ----------- | ---------------------------------------------- | --- |
| 1   | Width is exactly 380px          | Layout      | Consistent with other panels                   | ☐   |
| 2   | Cyan color motif                | Components  | Accent is `cyan-500`                           | ☐   |
| 3   | Platinum header pattern         | Components  | Matches Feedback/Help                          | ☐   |
| 4   | Document list items have hover  | Interaction | `hover:bg-slate-100 dark:hover:bg-navy-800/40` | ☐   |
| 5   | File icons are properly colored | Visual      | Matches file type                              | ☐   |
| 6   | Upload area has drag-drop state | Interaction | Border changes on drag-over                    | ☐   |
| 7   | Empty state is professional     | Enterprise  | Illustration + clear CTA                       | ☐   |
| 8   | Loading state uses skeleton     | Interaction | NOT spinner                                    | ☐   |
| 9   | Keyboard shortcut hint visible  | A11y        | Shows "ESC to close"                           | ☐   |
| 10  | All buttons have focus ring     | A11y        | `focus:ring-2 focus:ring-cyan-500/20`          | ☐   |

**Target Score:** 95%+

---

## 🧭 Navigation

### Sidebar (AdminSidebar / SettingsSidebar)

| #   | Checkpoint                                | Dimension   | Pass Criteria                           | ✓   |
| --- | ----------------------------------------- | ----------- | --------------------------------------- | --- |
| 1   | NO `border-r` on sidebar                  | Layout      | Uses gap-based separation (v3.0)        | ☐   |
| 2   | Parent container has `gap-0.5`            | Layout      | Floating panels pattern                 | ☐   |
| 3   | Background is `bg-white dark:bg-navy-900` | Visual      | Correct panel color                     | ☐   |
| 4   | Shadow is `shadow-sm`                     | Visual      | Subtle elevation                        | ☐   |
| 5   | Active nav uses LEFT-BORDER pattern       | Components  | `border-l-2 border-violet-600` NOT pill | ☐   |
| 6   | Active background is subtle               | Components  | `bg-violet-50 dark:bg-violet-900/20`    | ☐   |
| 7   | Nav item height is `py-1.5`               | Visual      | Compact (32px total), not `py-2`        | ☐   |
| 8   | Icons change color on active              | Interaction | `text-violet-600 dark:text-violet-400`  | ☐   |
| 9   | Hover state transitions smoothly          | Interaction | `duration-150`                          | ☐   |
| 10  | Mobile: Transforms to overlay             | Layout      | `lg:static lg:transform-none`           | ☐   |

**Target Score:** 95%+

---

### Mobile Navigation

| #   | Checkpoint                        | Dimension   | Pass Criteria                       | ✓   |
| --- | --------------------------------- | ----------- | ----------------------------------- | --- |
| 1   | Bottom navigation visible < 768px | Layout      | `block lg:hidden`                   | ☐   |
| 2   | Icons are 24x24 size              | Visual      | Correct mobile icon size            | ☐   |
| 3   | Active state uses color fill      | Components  | Icon background changes             | ☐   |
| 4   | Backdrop on sidebar overlay       | Layout      | `bg-black/40` on mobile drawer      | ☐   |
| 5   | Slide animation on open/close     | Interaction | `transition-transform duration-300` | ☐   |
| 6   | Touch targets are 44x44px minimum | A11y        | Apple HIG compliance                | ☐   |
| 7   | Safe area insets respected        | Layout      | iOS notch/home indicator padding    | ☐   |
| 8   | Swipe-to-close gesture works      | Interaction | Drawer closes on swipe              | ☐   |

**Target Score:** 90%+ (mobile patterns)

---

## 📝 Forms

### Text Inputs

| #   | Checkpoint                                         | Dimension   | Pass Criteria                    | ✓   |
| --- | -------------------------------------------------- | ----------- | -------------------------------- | --- |
| 1   | Border radius is `rounded-lg` (8px)                | Visual      | NOT `rounded-md` or `rounded-xl` | ☐   |
| 2   | Background is `bg-slate-50 dark:bg-navy-800`       | Visual      | Nested background level          | ☐   |
| 3   | Border is `border-slate-200 dark:border-navy-700`  | Dark Mode   | Standard border color            | ☐   |
| 4   | Focus ring is `focus:ring-2 focus:ring-violet-500` | Interaction | Visible focus state              | ☐   |
| 5   | Placeholder is `placeholder:text-slate-500`        | Visual      | Muted placeholder                | ☐   |
| 6   | Label has `for` attribute                          | A11y        | Connects to input ID             | ☐   |
| 7   | Error state shows red border                       | Interaction | `border-red-500` on error        | ☐   |
| 8   | Error message appears below                        | Enterprise  | Clear, actionable error text     | ☐   |
| 9   | Success state shows green border                   | Interaction | `border-emerald-500` on success  | ☐   |
| 10  | Transition on state change                         | Interaction | `transition-all duration-200`    | ☐   |

**Target Score:** 95%+

---

### Buttons

| #   | Checkpoint                                     | Dimension   | Pass Criteria                                     | ✓   |
| --- | ---------------------------------------------- | ----------- | ------------------------------------------------- | --- |
| 1   | Border radius is `rounded-lg`                  | Visual      | 8px for buttons                                   | ☐   |
| 2   | Primary is `bg-violet-600 hover:bg-violet-700` | Visual      | Brand color                                       | ☐   |
| 3   | Active state scales down                       | Interaction | `active:scale-[0.98]`                             | ☐   |
| 4   | Focus ring present                             | A11y        | `focus:ring-2 focus:ring-violet-500/20`           | ☐   |
| 5   | Disabled state is clear                        | A11y        | `disabled:opacity-50 disabled:cursor-not-allowed` | ☐   |
| 6   | Shadow on primary                              | Visual      | `shadow-sm` for depth                             | ☐   |
| 7   | Loading shows spinner + text                   | Interaction | "Saving..." with `Loader2` icon                   | ☐   |
| 8   | Icon size is 16px                              | Visual      | Consistent icon sizing                            | ☐   |
| 9   | Ghost button has hover                         | Interaction | `hover:bg-slate-100 dark:hover:bg-navy-800`       | ☐   |
| 10  | Danger button is distinct                      | Visual      | `bg-rose-600` or `text-rose-400`                  | ☐   |

**Target Score:** 100% (most common component)

---

### Toggles & Switches

| #   | Checkpoint                   | Dimension   | Pass Criteria                                 | ✓   |
| --- | ---------------------------- | ----------- | --------------------------------------------- | --- |
| 1   | Background changes on active | Interaction | `bg-blue-600` active, `bg-slate-700` inactive | ☐   |
| 2   | Smooth knob transition       | Interaction | `transform translate-x` animated              | ☐   |
| 3   | Label is clickable           | A11y        | Clicking label toggles switch                 | ☐   |
| 4   | ARIA role is "switch"        | A11y        | `role="switch" aria-checked={value}`          | ☐   |
| 5   | Keyboard toggles with Space  | A11y        | Space bar toggles state                       | ☐   |
| 6   | Focus ring visible           | A11y        | `focus:ring-2` on keyboard focus              | ☐   |
| 7   | Color indicates state        | Visual      | Blue/Emerald = on, Slate = off                | ☐   |
| 8   | Disabled state visible       | A11y        | Opacity reduced, cursor not-allowed           | ☐   |

**Target Score:** 95%+

---

## 🎴 Cards & Containers

### Main Content Cards

| #   | Checkpoint                                         | Dimension   | Pass Criteria                                    | ✓   |
| --- | -------------------------------------------------- | ----------- | ------------------------------------------------ | --- |
| 1   | Border radius is `rounded-xl` (12px)               | Visual      | Main card standard                               | ☐   |
| 2   | Background is `bg-white dark:bg-navy-900`          | Visual      | Panel background                                 | ☐   |
| 3   | Border is `border-slate-200 dark:border-navy-700`  | Dark Mode   | Standard border                                  | ☐   |
| 4   | Padding is `p-5` or `p-6`                          | Visual      | NOT `p-8` (deprecated)                           | ☐   |
| 5   | Shadow is `shadow-sm`                              | Visual      | Subtle elevation                                 | ☐   |
| 6   | Header has bottom border                           | Visual      | `border-b border-slate-100 dark:border-navy-800` | ☐   |
| 7   | Icon in header is colored                          | Visual      | Matches theme (violet/navy/emerald)              | ☐   |
| 8   | Description text is muted                          | Visual      | `text-slate-600 dark:text-slate-400`             | ☐   |
| 9   | Spacing between sections is `gap-4` or `space-y-4` | Visual      | 8px grid compliance                              | ☐   |
| 10  | No layout shift on load                            | Performance | Skeleton loader same height                      | ☐   |

**Target Score:** 90%+

---

### Glassmorphic Cards (AI Module)

| #   | Checkpoint                               | Dimension   | Pass Criteria                        | ✓   |
| --- | ---------------------------------------- | ----------- | ------------------------------------ | --- |
| 1   | Background is semi-transparent           | Visual      | `bg-navy-900/50` or `bg-navy-800/50` | ☐   |
| 2   | Backdrop filter applied                  | Visual      | `backdrop-blur-xl`                   | ☐   |
| 3   | Border is subtle                         | Visual      | `border border-white/10`             | ☐   |
| 4   | Radius is `rounded-3xl` or `rounded-2xl` | Visual      | Larger radius for glassmorphic       | ☐   |
| 5   | Glow accent present (optional)           | Visual      | Absolute-positioned blur gradient    | ☐   |
| 6   | Text has high contrast                   | Dark Mode   | White text on dark glass             | ☐   |
| 7   | Hover effect adds light                  | Interaction | `hover:bg-white/5`                   | ☐   |
| 8   | Selection shows colored glow             | Interaction | `shadow-[0_0_15px_-3px_rgba(...)]`   | ☐   |

**Target Score:** 85%+ (Premium AI Aesthetic)

---

## 📊 Data Displays

### Tables

| #   | Checkpoint                  | Dimension   | Pass Criteria                                               | ✓   |
| --- | --------------------------- | ----------- | ----------------------------------------------------------- | --- |
| 1   | Header is uppercase         | Visual      | `uppercase tracking-wider text-xs`                          | ☐   |
| 2   | Header background is subtle | Visual      | `bg-white/5` or `bg-slate-50 dark:bg-navy-900`              | ☐   |
| 3   | Row hover state present     | Interaction | `hover:bg-slate-100 dark:hover:bg-white/5`                  | ☐   |
| 4   | Selected row highlighted    | Interaction | `bg-blue-500/5` or theme color                              | ☐   |
| 5   | Borders are minimal         | Visual      | `border-b` only, or `border-slate-100 dark:border-navy-800` | ☐   |
| 6   | Action icons on row hover   | Interaction | Edit/Delete icons appear on hover                           | ☐   |
| 7   | Empty state is helpful      | Enterprise  | Illustration + "Add first item" CTA                         | ☐   |
| 8   | Pagination is clear         | A11y        | Page numbers, prev/next labeled                             | ☐   |
| 9   | Sort indicators visible     | Visual      | Arrow icons on sortable columns                             | ☐   |
| 10  | Keyboard navigation         | A11y        | Arrow keys move between cells                               | ☐   |

**Target Score:** 85%+

---

### KPI Cards (Metrics)

| #   | Checkpoint                   | Dimension  | Pass Criteria                      | ✓   |
| --- | ---------------------------- | ---------- | ---------------------------------- | --- |
| 1   | Glassmorphic container       | Components | `bg-navy-900/50 backdrop-blur-xl`  | ☐   |
| 2   | Icon has colored background  | Visual     | `bg-[color]-500/20` rounded square | ☐   |
| 3   | Technical label is monospace | Visual     | `font-mono text-xs text-slate-500` | ☐   |
| 4   | Value is large and bold      | Visual     | `text-2xl font-bold text-white`    | ☐   |
| 5   | Subtitle is muted            | Visual     | `text-xs text-slate-400`           | ☐   |
| 6   | Border is subtle             | Visual     | `border-white/10`                  | ☐   |
| 7   | Color-coded status indicator | Visual     | Red/Amber/Emerald dot for health   | ☐   |
| 8   | Trend arrow (if applicable)  | Visual     | Up/down icon with green/red        | ☐   |

**Target Score:** 90%+ (Dashboard critical)

---

## 🤖 AI Components

### Chat Interface

| #   | Checkpoint                           | Dimension   | Pass Criteria                        | ✓   |
| --- | ------------------------------------ | ----------- | ------------------------------------ | --- |
| 1   | User messages align right            | Visual      | `justify-end` flex layout            | ☐   |
| 2   | AI messages align left               | Visual      | `justify-start` flex layout          | ☐   |
| 3   | User bubbles use violet              | Visual      | `bg-violet-600 text-white`           | ☐   |
| 4   | AI bubbles are neutral               | Visual      | `bg-slate-100 dark:bg-navy-800`      | ☐   |
| 5   | Thinking indicator present           | Interaction | Pulsing dots or "Thinking..."        | ☐   |
| 6   | Progressive reasoning collapsible    | Components  | Sub-process drawer (monospace steps) | ☐   |
| 7   | Code blocks have syntax highlighting | Visual      | Prism.js or similar                  | ☐   |
| 8   | Copy button on code blocks           | Interaction | Icon button top-right                | ☐   |
| 9   | Input has auto-resize                | Interaction | Textarea grows with content          | ☐   |
| 10  | Send button disabled when empty      | A11y        | `disabled` state when no text        | ☐   |

**Target Score:** 95%+ (Core feature)

---

### Thinking Indicators

| #   | Checkpoint                   | Dimension   | Pass Criteria                                 | ✓   |
| --- | ---------------------------- | ----------- | --------------------------------------------- | --- |
| 1   | Monospace font for steps     | Visual      | `font-mono` for technical labels              | ☐   |
| 2   | Status dots present          | Visual      | Gray (pending), Green (done)                  | ☐   |
| 3   | Smooth reveal animation      | Interaction | Framer Motion slide-down                      | ☐   |
| 4   | Collapsible after completion | Interaction | Can minimize to single line                   | ☐   |
| 5   | Step labels clear            | Enterprise  | "Context Retrieval", "Knowledge Search", etc. | ☐   |

**Target Score:** 90%+

---

## 🎭 Modals & Overlays

### Modals / Dialogs

| #   | Checkpoint                      | Dimension   | Pass Criteria                         | ✓   |
| --- | ------------------------------- | ----------- | ------------------------------------- | --- |
| 1   | Border radius is `rounded-xl`   | Visual      | 12px for modals                       | ☐   |
| 2   | Backdrop is present             | Layout      | `bg-black/40 backdrop-blur-sm`        | ☐   |
| 3   | Modal is centered               | Layout      | Flexbox center alignment              | ☐   |
| 4   | Header has close button         | A11y        | X icon top-right                      | ☐   |
| 5   | ESC key closes modal            | A11y        | Keyboard shortcut works               | ☐   |
| 6   | Focus trapped inside modal      | A11y        | Tab cycles within modal               | ☐   |
| 7   | Click outside closes (optional) | Interaction | Backdrop click closes                 | ☐   |
| 8   | Entry animation smooth          | Interaction | Fade + scale animation                | ☐   |
| 9   | Footer has clear actions        | Enterprise  | "Cancel" + "Confirm" clearly labeled  | ☐   |
| 10  | Danger actions use red          | Visual      | Destructive buttons are `bg-rose-600` | ☐   |

**Target Score:** 95%+

---

## 📝 Scoring Instructions

### How to Use This Checklist

1. **Select Component Category** - Choose the category matching your component
2. **Check Each Criterion** - Mark ✓ for pass, ✗ for fail
3. **Calculate Score** - `(Passed Checks / Total Checks) × 100 = Component Score`
4. **Map to Dimension** - Each check maps to a dimension (Visual, Interaction, etc.)
5. **Record Violations** - Note failed checks for remediation

### Example:

**Help Panel:** 8/10 checks passed = **80% score**

- Fails: #2 (Color motif), #7 (AI assistance)
- Maps to: Components dimension (2 failures)
- Action: Update accent color to purple, add AI assistance panel

---

## 🎯 Minimum Score Targets by Component Type

| Component Type       | Minimum Score | Rationale                     |
| -------------------- | ------------- | ----------------------------- |
| **Global Utilities** | 95%           | Always visible, sets standard |
| **Navigation**       | 90%           | High-frequency interaction    |
| **Forms**            | 95%           | Critical for data entry       |
| **Cards**            | 85%           | Visual consistency            |
| **Tables**           | 80%           | Functional priority           |
| **AI Components**    | 95%           | Core differentiator           |
| **Modals**           | 90%           | Interrupts workflow           |

---

## 📊 Reporting Template

After auditing a component, record:

```markdown
### [Component Name] Audit Results

**Date:** 2026-01-XX  
**Auditor:** [Name]  
**Location:** `src/components/[path]`

**Scores:**

- Visual Consistency: X/Y checks (Z%)
- Interaction Patterns: X/Y checks (Z%)
- Dark Mode Parity: X/Y checks (Z%)
- Layout Architecture: X/Y checks (Z%)
- Component Standards: X/Y checks (Z%)
- Accessibility: X/Y checks (Z%)
- Performance: X/Y checks (Z%)
- Enterprise Polish: X/Y checks (Z%)

**Overall:** XX% (Grade: A/B/C/F)

**Failed Checks:**

1. [#X] [Checkpoint name] - [Reason]
2. [#Y] [Checkpoint name] - [Reason]

**Remediation Priority:** High/Medium/Low
**Estimated Fix Time:** X hours
```
