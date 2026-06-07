# Tables — graphic canon (#18)

> ⚠️ **SUPERSEDED (2026-06-06) — SSOT to [`TABLE_AND_PREVIEW_CANON.md`](../ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md).**
> **KOREKTA:** reguła „use `StatusPill`" w §3 jest **nieaktualna** — `StatusPill` jest legacy. Status renderuj przez rodzinę chipów `c.*` (`EntityStatusChip`/`statusChipTone()`), patrz kanon §4.1.

> The single visual + behavioural spec for every data table in Consultify.
> **Status: canonical (enforced)** · Updated 2026-06-05

Engineers building or migrating any table MUST follow this. Where a rule is not
yet implemented platform-wide, it is marked **TARGET (not yet enforced)**.

---

## 1. Canonical components

| Concern | Use | Path |
| ------- | --- | ---- |
| Full data table | `FilterableTable` | `src/components/shared/ModuleHub/FilterableTable.tsx` (re-exported from `ModuleHub/index.ts`) |
| Status cell | `StatusPill` / `statusTone()` | `src/components/shared/StatusPill.tsx` |
| Column visibility popover | `TableSettingsPopover` | `src/components/shared/ModuleHub/TableSettingsPopover.tsx` |

Do **not** hand-roll a `<table>` for module/list views. Adopt `FilterableTable`.

---

## 2. Visual rules (the monochrome canon)

- **Monochrome surface.** One neutral background for the whole table:
  `bg-white/70 dark:bg-navy-900/70` on a `rounded-xl` shell with a hairline
  border `border-slate-200/70 dark:border-white/[0.06]`.
- **NO zebra striping.** Rows share one background. Differentiation comes from
  hairline dividers, not alternating fills.
- **NO per-row tone.** A row is never tinted by status/priority/category. The
  only row backgrounds allowed:
  - selected row: `bg-primary-500/8 dark:bg-primary-500/10`
  - hover: `hover:bg-slate-50/70 dark:hover:bg-white/[0.03]`
- **Hairline dividers** between rows: `divide-y divide-slate-200/60 dark:divide-white/[0.03]`.
  (Spec reference tone: `border-slate-200/60 dark:border-navy-700/40`.)
- **Sticky header.** `thead` is `sticky top-0 z-10` with a subtle backdrop blur;
  header labels are `text-[11px] uppercase tracking-wider text-slate-500`.
- **Generous row height.** Default density `comfortable` → `px-4 py-3`.
  `compact` (`px-4 py-2`) only for dense admin/queue tables.
- **Right-aligned numerics.** Numeric and currency columns (and the trailing
  actions/settings column) are right-aligned (`text-right`). Text columns stay
  left-aligned.

---

## 3. Status rendering — always `StatusPill`

Every status cell renders `<StatusPill status={raw} />`. **No ad-hoc colored
badges.** Pass the raw status string straight through; the pill normalizes
casing/spacing and maps to exactly **5 semantic tones** via `statusTone()`:

| Tone | Meaning | Example statuses |
| ---- | ------- | ---------------- |
| `blue` | informational | `in_progress`, `draft`, `open`, `generating`, `planning`, `new` |
| `amber` | waiting | `submitted`, `pending`, `pending_review`, `in_review`, `review` |
| `emerald` | success | `approved`, `completed`, `done`, `published`, `promoted`, `executing`, `tracking` |
| `rose` | attention | `sent_back`, `rejected`, `failed`, `blocked`, `cancelled`, `overdue` |
| `slate` | neutral | `archived`, `trashed`, `unknown`, **and any unrecognized status** |

```tsx
import { StatusPill, statusTone } from '@/components/shared/StatusPill';

// In a column render:
render: (row) => <StatusPill status={row.status} />
// Need just the tone (icon / accent)?  statusTone('rejected') // 'rose'
```

> **Migration note:** `FilterableTable`'s built-in `StatusBadge` and the legacy
> `constants/statusColors.ts` / `InsightViewer` `STATUS_CONFIG` maps are
> superseded by `StatusPill`. Replacing the inline `StatusBadge` with
> `StatusPill` inside `FilterableTable` is a **TARGET (not yet enforced)** —
> until then, pass a `column.render` that returns `<StatusPill>` to override it.

---

## 4. Column controls — portal popover, never clipped

The visible-columns control MUST be **portal-based**. Use the
`TableSettingsPopover` pattern: the panel is `createPortal`-ed to
`document.body` with **fixed** positioning computed from the trigger rect, so it
is **never clipped** by the table's `overflow-x-auto` scroll container (the bug
that cut off the old inline dropdown, #1).

Key mechanics (already implemented in `TableSettingsPopover.tsx`):
- Position via `getBoundingClientRect()`, viewport-clamped, **auto-flips up**
  when there isn't room below.
- Re-aligns on `scroll` (capture) + `resize`.
- Dismisses on outside pointer-down (trigger OR panel) and Escape.
- Required columns render a disabled, checked toggle labelled "Locked".

> `FilterableTable` currently renders the column control via `ColumnSelector`.
> Consolidating it onto `TableSettingsPopover` is a **TARGET (not yet enforced)**;
> any *new* standalone column control MUST use `TableSettingsPopover`.

### Column persistence

Pass `persistKey` to `FilterableTable` to persist column **widths,
visibility, and order** to `localStorage` (key `filterableTable.cols.<persistKey>`).
This is the one canonical place for the "resize lost on reload" fix (V-B) —
never re-implement per table.

```tsx
<FilterableTable persistKey="interview.assignments" … />
```

---

## 5. Cell content rules

- **Empty cells render `—`, never blank.** `null`/`undefined`/`''` → an em dash
  (`—`) in muted text. **TARGET (not yet enforced)** inside `FilterableTable`'s
  default cell renderer — until then, normalize in your `column.render`.
- **Markdown-stripped previews.** Text sourced from markdown / rich fields must
  be markdown-stripped (no `#`, `*`, `[]()`, etc.) before rendering in a cell,
  and truncated with `truncate` + a `title` tooltip for the full value.
- **Relative time** for timestamp columns (e.g. `2d ago` / `2 dni temu`),
  bilingual via the active i18n language.

---

## 6. Per-column filters

Per-column filtering is a first-class `FilterableTable` feature: set
`filterable: true` + `filterOptions` on a `TableColumn`, drive state with
`activeFilters` / `onFilterChange` (filter chips). Semantics: **OR within a
column, AND between columns.**

> Migrating remaining bespoke list/table views onto `FilterableTable`'s
> per-column filters is the consolidation **TARGET (#10)**.

---

## 7. DO / DON'T

| DO | DON'T |
| -- | ----- |
| Use `FilterableTable` for module tables | Hand-roll a `<table>` with custom row markup |
| Render status via `<StatusPill>` | Build inline colored status badges |
| Portal the column popover (`TableSettingsPopover`) | Use an `absolute` dropdown that the table scroll clips |
| Keep rows monochrome; hairline dividers | Add zebra striping or per-row status tint |
| Right-align numerics | Left-align money/number columns |
| Render `—` for empty cells | Leave cells blank |
| Strip markdown for previews | Dump raw `**markdown**` into a cell |
| Persist layout via `persistKey` | Re-implement width/visibility persistence per table |

---

## 8. Minimal usage

```tsx
import { FilterableTable, type TableColumn } from '@/components/shared/ModuleHub';
import { StatusPill } from '@/components/shared/StatusPill';

const columns: TableColumn[] = [
  { id: 'name', label: 'Name', width: '260px' },
  {
    id: 'status',
    label: 'Status',
    filterable: true,
    filterOptions: [
      { value: 'in_progress', label: 'In progress' },
      { value: 'approved', label: 'Approved' },
    ],
    render: (row) => <StatusPill status={row.status} />,
  },
  { id: 'updatedAt', label: 'Updated' }, // relative-time rendered by default
];

<FilterableTable
  columns={columns}
  data={rows}
  activeFilters={filters}
  onFilterChange={setFilters}
  density="comfortable"
  persistKey="myModule.list"
  emptyMessage="No items yet"
/>;
```
