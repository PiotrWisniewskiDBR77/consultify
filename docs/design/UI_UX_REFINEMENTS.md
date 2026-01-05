# UI/UX Premium Refinements v3.0

This document outlines the design refinements implemented to elevate the Consultify interface to premium SaaS standards (inspired by ClickUp, Slack, Linear, and HubSpot).

> **Last Updated:** January 2026
> **Version:** 3.0

---

## 1. Design Philosophy

### 1.1. Core Principles (Based on ClickUp, Slack, Linear)

| Principle | Description | Implementation |
|-----------|-------------|----------------|
| **Compact & Tight** | Professional B2B SaaS uses tighter spacing than consumer apps | `p-5` (20px) as base, not `p-8` (32px) |
| **Subtle Over Bold** | Indicators should guide, not dominate | Left-border + subtle bg, not full pill |
| **Consistent Rounding** | One rounding system across all components | `rounded-lg` (8px) for nested, `rounded-xl` (12px) for containers |
| **Dark Mode Parity** | Equal visual weight in both themes | Standardized color pairs |

### 1.2. Floating Panels Pattern (ClickUp-style)

**Key Innovation v3.0:** Instead of using border lines to separate panels, we use **gap-based separation** where the page background shows through between floating panels.

```
┌─────────────────────────────────────────────────────────────┐
│  bg-slate-100 (page background)                             │
│  ┌─────────────┐  ┌─────────────────────────────────────┐   │
│  │   Sidebar   │  │         Main Content                │   │
│  │  (floating) │  │         (floating)                  │   │
│  │  bg-white   │  │         bg-white                    │   │
│  │  shadow-sm  │  │         shadow-sm                   │   │
│  └─────────────┘  └─────────────────────────────────────┘   │
│         ↑  2px gap (bg-slate-100 shows through)  ↑          │
└─────────────────────────────────────────────────────────────┘
```

**Why this matters:**
- ❌ **Before:** `border-r` creates a 1px line - feels flat
- ✅ **After:** `gap-0.5` creates depth - panels feel "floating"

**Implementation:**
```tsx
// Layout wrapper
<div className="flex h-full bg-slate-100 dark:bg-navy-950 gap-0.5">
    {/* Sidebar panel */}
    <aside className="bg-white dark:bg-navy-900 shadow-sm">
        {/* content */}
    </aside>
    
    {/* Main content panel */}
    <main className="flex-1 bg-white dark:bg-navy-900 lg:rounded-l-lg shadow-sm">
        {/* content */}
    </main>
</div>
```

**Rules:**
1. Remove `border-r` from sidebars
2. Use `gap-0.5` (2px) between panels
3. Page background: `bg-slate-100 dark:bg-navy-950`
4. Panel background: `bg-white dark:bg-navy-900`
5. Add `shadow-sm` for subtle depth

### 1.3. The 8px Grid System

All spacing should follow the 8px grid:

```
4px   - space-y-1, gap-1   - Between tightly related items
8px   - space-y-2, gap-2   - Default item spacing
12px  - space-y-3, gap-3   - Group spacing
16px  - space-y-4, gap-4   - Section spacing
20px  - p-5, gap-5         - Card internal padding (BASE)
24px  - p-6, gap-6         - Large container padding
32px  - p-8, gap-8         - Page-level margins only
```

---

## 2. Border Radius Standards

### 2.1. Component Sizing

| Component Type | Tailwind Class | Pixels | Example Use |
|----------------|----------------|--------|-------------|
| **Buttons** | `rounded-md` | 6px | All buttons |
| **Inputs** | `rounded-lg` | 8px | Text inputs, selects |
| **Inner Cards** | `rounded-lg` | 8px | Nested cards, list items |
| **Main Cards** | `rounded-xl` | 12px | Content containers, panels |
| **Modals** | `rounded-xl` | 12px | Dialog boxes |
| **Badges** | `rounded-full` | 9999px | Status pills, counts |

### 2.2. Migration Notes

```diff
- rounded-2xl   (16px) → Use only for hero sections
- rounded-xl    (12px) → Primary cards, panels ✓
- rounded-lg    (8px)  → Nested elements, inputs ✓
- rounded-md    (6px)  → Buttons ✓
```

---

## 3. Navigation Sidebar Standards

### 3.1. Active State (ClickUp-style)

**Before (Pill style - TOO HEAVY):**
```tsx
isActive
  ? 'bg-violet-600 text-white font-medium shadow-sm'
  : 'text-slate-600 hover:bg-slate-200/50'
```

**After (Left-border style - SUBTLE & PROFESSIONAL):**
```tsx
isActive
  ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 font-medium border-l-2 border-violet-600 -ml-px'
  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/40 hover:text-slate-900 dark:hover:text-white'
```

### 3.2. Item Height

```tsx
// Compact (ClickUp-style): 32px total height
className="px-3 py-1.5"

// Previously: 36px total height
className="px-3 py-2"
```

### 3.3. Icon Styling

```tsx
// Active state - themed icon
isActive ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400 dark:text-slate-500'
```

---

## 4. Light/Dark Mode Consistency

### 4.1. Color Mapping Standards

| Light Mode | Dark Mode | Usage |
|------------|-----------|-------|
| `bg-white` | `dark:bg-navy-900` | Main panel backgrounds |
| `bg-slate-50` | `dark:bg-navy-800` | Nested backgrounds, inputs |
| `border-slate-200` | `dark:border-navy-700` | All borders (STANDARD) |
| `border-slate-100` | `dark:border-navy-700` | Subtle separators |
| `text-slate-900` | `dark:text-white` | Primary text |
| `text-slate-600` | `dark:text-slate-400` | Secondary text |
| `text-slate-500` | `dark:text-slate-400` | Muted/placeholder text |
| `text-slate-400` | `dark:text-slate-500` | Labels, captions |

### 4.2. Border Consistency Rules

**STANDARD:** Always use `dark:border-navy-700` for borders in dark mode.

```diff
# DEPRECATED (inconsistent)
- dark:border-white/5
- dark:border-white/10
- dark:border-navy-600

# CORRECT (consistent)
+ dark:border-navy-700
```

### 4.3. Background Hierarchy (v3.0 Updated)

```
Level 0 (App BG):        bg-slate-100      dark:bg-navy-950     ← Page wrapper
Level 1 (Panel BG):      bg-white          dark:bg-navy-900     ← Sidebar, Main panels
Level 2 (Header BG):     bg-white/80       dark:bg-navy-900/80  ← Headers with backdrop-blur
Level 3 (Nested Card):   bg-slate-50/50    dark:bg-navy-950/30  ← Content cards within panels
Level 4 (Hover BG):      bg-slate-100      dark:bg-navy-800/40  ← Interactive elements hover
Level 5 (Deep Nested):   bg-slate-50       dark:bg-navy-800     ← Nested within cards
```

### 4.4. Internal Border Standards (v3.0)

For borders **inside** panels (separating sections within a floating panel):

```tsx
// Subtle internal separators (within panels)
className="border-b border-slate-100 dark:border-navy-800"

// Container borders on cards within content
className="border border-slate-200/60 dark:border-navy-800"
```

**DO NOT** use `border-r` to separate panels - use `gap-0.5` instead.

---

## 5. Spacing Standards

### 5.1. Card Padding

| Card Type | Padding | Tailwind |
|-----------|---------|----------|
| **Main Content Card** | 24px | `p-6` |
| **Section Card** | 20px | `p-5` |
| **Nested Card** | 16px | `p-4` |
| **Compact Item** | 12px | `p-3` |

### 5.2. Grid Gaps

| Context | Gap | Tailwind |
|---------|-----|----------|
| **Page-level sections** | 24px | `gap-6` |
| **Card grid** | 16px | `gap-4` |
| **Item list** | 8px | `gap-2` or `space-y-2` |
| **Compact list** | 4px | `space-y-1` |

---

## 6. Interaction Standards

### 6.1. State Transitions

| State | Style | Timing |
|-------|-------|--------|
| **Hover** | `hover:bg-slate-100 dark:hover:bg-navy-800/40` | `duration-150` |
| **Active/Press** | `active:scale-[0.98]` | `duration-100` |
| **Focus** | `focus:ring-2 focus:ring-violet-500/20` | immediate |

### 6.2. Button Standards

```tsx
// Primary Button
className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700 active:scale-[0.98] shadow-sm"

// Secondary Button
className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-violet-300 dark:border-navy-600 dark:text-slate-300 dark:hover:border-violet-500/50 active:scale-[0.98]"

// Ghost Button
className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-800 active:scale-[0.98]"
```

---

## 7. Component Checklist

When creating new components, verify:

### Layout & Spacing
- [ ] Uses `rounded-xl` for main containers, `rounded-lg` for nested
- [ ] Card padding is `p-5` or `p-6`, not `p-8`
- [ ] Grid gaps follow the 8px system
- [ ] Item spacing uses `space-y-2` or `gap-2`

### Colors & Theme
- [ ] All `bg-white` have corresponding `dark:bg-navy-900`
- [ ] All `border-slate-*` have corresponding `dark:border-navy-700`
- [ ] All text colors have dark mode equivalents
- [ ] No orphan `dark:border-white/*` patterns

### Interactions
- [ ] Buttons use `active:scale-[0.98]`
- [ ] Hover states use `duration-150`
- [ ] Focus rings use `ring-2 ring-violet-500/20`

---

## 8. Examples

### 8.1. Card Container

```tsx
<div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-navy-700 dark:bg-navy-900">
  {/* content */}
</div>
```

### 8.2. Nested List Item

```tsx
<div className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
  {/* content */}
</div>
```

### 8.3. Navigation Item

```tsx
<button
  className={cn(
    'w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-all duration-150 active:scale-[0.98]',
    isActive
      ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 font-medium border-l-2 border-violet-600 -ml-px'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/40 hover:text-slate-900 dark:hover:text-white',
  )}
>
  <Icon className={cn('w-4 h-4', isActive ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400')} />
  <span>{label}</span>
</button>
```

---

## 9. Changelog

### v3.0 (January 2026)
- **NEW:** Introduced "Floating Panels" pattern (ClickUp-style)
  - Replaced `border-r` lines with `gap-0.5` (2px) gap-based separation
  - Page background changed to `bg-slate-100 dark:bg-navy-950`
  - Panels use `bg-white dark:bg-navy-900 shadow-sm`
- **Updated:** Internal borders use lighter colors: `border-slate-100 dark:border-navy-800`
- **Updated:** Headers use semi-transparent backgrounds with backdrop blur
- Standardized across: AdminLayout, AdminSidebar, SettingsView, SettingsSidebar, PartnerPortalView

### v2.0 (January 2026)
- **BREAKING:** Reduced border radius from `rounded-2xl` to `rounded-xl`
- **BREAKING:** Changed navigation active state from pill to left-border
- Standardized dark mode border color to `dark:border-navy-700`
- Reduced card padding from `p-8` to `p-5`/`p-6`
- Reduced navigation item height from `py-2` to `py-1.5`
- Added comprehensive Light/Dark mode color mapping
- Documented 8px grid system

### v1.0 (Initial)
- Initial design system based on pill-style navigation
- Used `rounded-2xl` as primary border radius
- Used `p-8` for card padding
