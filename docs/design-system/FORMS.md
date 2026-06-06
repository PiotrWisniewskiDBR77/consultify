# Forms — modal canon (#14)

> The single spec for form fields inside modals across Consultify.
> **Status: canonical (enforced)** · Updated 2026-06-05

Every form modal MUST build its fields from the shared primitives in
`src/components/shared/forms/` (import from `@/components/shared/forms`). These
replace native `<select>` / `<input type="date">` and inline `absolute`
dropdowns that covered the fields below them. Where a rule is not yet
implemented platform-wide it is marked **TARGET (not yet enforced)**.

Reference adopter: **`src/components/Interview/AssignInterviewModal.tsx`**.

---

## 1. Primitives

All exported from `src/components/shared/forms/index.ts`.

### `Field` / `FieldLabel` / `FieldError` — `forms/Field.tsx`
Layout wrappers. `Field` is a `flex flex-col gap-2` column (label above field,
consistent spacing). `FieldLabel` takes `required` (renders a rose `*`) and
optional `htmlFor`. `FieldError` is the validation slot — renders nothing when
empty, otherwise rose helper text.

```tsx
<Field>
  <FieldLabel required>Due date</FieldLabel>
  <DatePicker … />
  <FieldError>{error}</FieldError>
</Field>
```

### `Select` — `forms/Select.tsx`
Portal-based single-select. Trigger styled like a text input
(`h-10 rounded-xl border`). Props: `value`, `onChange(value)`, `options:
SelectOption[]` (`{ value, label, icon? }`), `placeholder`, `disabled`,
`aria-label`. Closes on outside-click + Escape. **Never** use native `<select>`.

### `MultiSelect` — `forms/MultiSelect.tsx`
Portal-based multi-select with removable chips in the trigger, a search box, and
a checkbox option list. Props: `values`, `onChange(values)`, `options:
MultiSelectOption[]` (`{ value, label, description?, icon? }`),
`placeholder`, `searchPlaceholder`, `emptyLabel`, `renderOptionLeading?`
(e.g. avatar), `aria-label`. Search filters on label + description.

### `PriorityPicker` — `forms/PriorityPicker.tsx`
A **chip row, not a native select**. Four `rounded-full` radio chips —
Low / Medium / High / Urgent — each with an icon and active color tint
(slate / blue / amber / rose). Props: `value: Priority`, `onChange`,
`isPolish?`. `Priority = 'low' | 'medium' | 'high' | 'urgent'`. Labels localize
PL/EN.

### `DatePicker` — `forms/DatePicker.tsx`
Custom popover calendar replacing native `<input type="date">` — renders
identically across browsers. Trigger chip shows the formatted date; popover has
quick shortcuts (Today / Tomorrow / Next week) + a Monday-first month grid.
Props: `value` (ISO `YYYY-MM-DD` or `''`), `onChange(iso)`, `min?`,
`placeholder`, `isPolish?`, `disabled`, `aria-label`. **Value contract matches
the native date input**, so existing wiring stays intact.

### `usePopoverPosition` / `useDismiss` — `forms/usePopoverPosition.ts`
Shared portal-popover positioning + dismissal logic powering `Select`,
`MultiSelect`, `DatePicker`. Use these when building any new floating panel.

---

## 2. Portal rule (the overflow-safe canon)

**All dropdowns/popovers are `createPortal`-ed to `document.body`** with
**fixed** positioning — they are **never clipped** by a modal's
`overflow-hidden` / `overflow-y-auto`, and never cover the fields below their
trigger.

This is centralized in `usePopoverPosition` (`forms/usePopoverPosition.ts`),
which mirrors the `TableSettingsPopover` pattern:
- Position computed from the trigger's `getBoundingClientRect()`.
- Viewport-clamped; **auto-flips up** when there isn't room below.
- Re-aligns on `scroll` (capture) + `resize`.
- `useDismiss` closes on outside pointer-down (trigger OR panel) + Escape.
- Panel width strategy: `'trigger'` (match trigger, for selects) or a fixed
  px number (calendars / menus).

Never use a bare `absolute` dropdown inside a modal.

---

## 3. Layout & bilingual labels

- **Label above field**, one `Field` per control, `gap-2` internal spacing,
  generous spacing between fields (`space-y-6` in the adopter).
- **Validation/error slot**: `<FieldError>` directly under the field.
- **Required** marked via `<FieldLabel required>`.
- **Bilingual labels.** Where a primitive ships its own copy (PriorityPicker,
  DatePicker shortcuts/day labels), use the `isPolish` prop. At the call site,
  resolve PL/EN from i18n (`i18n.language === 'pl'`) and pass localized
  `placeholder` / `aria-label` / `FieldLabel` text. The `{ en, pl }` label
  shape is the convention for any new bilingual option lists. Pass a stable
  `aria-label` on every Select/MultiSelect/DatePicker.

---

## 4. Migration checklist (legacy modal → canon)

Reference: `AssignInterviewModal.tsx` (already migrated).

1. `import { Field, FieldLabel, FieldError, Select, MultiSelect, PriorityPicker, DatePicker } from '@/components/shared/forms';`
2. Replace each native `<select>` with `Select` (single) or `MultiSelect`
   (multi); map your data to `{ value, label, icon?, description? }`.
3. Replace any priority `<select>` with `<PriorityPicker>`.
4. Replace `<input type="date">` with `<DatePicker>` — keep the same ISO
   `YYYY-MM-DD` value, pass `min` if needed.
5. Wrap every control in `<Field><FieldLabel …/> … </Field>`; mark required
   fields with `required`; add `<FieldError>` for validation.
6. Delete any hand-rolled `absolute` dropdown + its open/close/outside-click
   state — the primitives handle portal, position, and dismissal.
7. Pass an `aria-label` to each control and resolve bilingual copy from i18n.
8. Keep the modal shell (backdrop, `rounded-2xl` panel, header/footer) but let
   fields come from the primitives.

---

## 5. DO / DON'T

| DO | DON'T |
| -- | ----- |
| Build fields from `@/components/shared/forms` | Use native `<select>` / `<input type="date">` |
| Portal popovers to `document.body` (`usePopoverPosition`) | Use `absolute` dropdowns that the modal clips |
| Use `PriorityPicker` chip row | Use a native dropdown for priority |
| Wrap controls in `Field` + `FieldLabel` (label above) | Put labels inline / skip the error slot |
| Pass `isPolish` + localized `aria-label`/placeholder | Hard-code English-only copy |
| Keep `DatePicker` value as ISO `YYYY-MM-DD` | Change the value contract |
| Mark required via `<FieldLabel required>` | Invent ad-hoc required markers |

---

## 6. Minimal usage

```tsx
import {
  Field, FieldLabel, FieldError,
  Select, MultiSelect, PriorityPicker, DatePicker,
} from '@/components/shared/forms';

const isPolish = i18n.language === 'pl';

<Field>
  <FieldLabel required>{isPolish ? 'Szablon' : 'Template'}</FieldLabel>
  <Select
    value={templateId}
    onChange={setTemplateId}
    options={templateOptions}            // { value, label, icon? }[]
    placeholder={isPolish ? 'Wybierz…' : 'Select…'}
    aria-label={isPolish ? 'Szablon' : 'Template'}
  />
  <FieldError>{errors.template}</FieldError>
</Field>

<Field>
  <FieldLabel required>{isPolish ? 'Przydziel do' : 'Assign to'}</FieldLabel>
  <MultiSelect
    values={userIds}
    onChange={setUserIds}
    options={userOptions}                // { value, label, description? }[]
    searchPlaceholder={isPolish ? 'Szukaj…' : 'Search…'}
    emptyLabel={isPolish ? 'Brak' : 'None'}
    aria-label={isPolish ? 'Przydziel do' : 'Assign to'}
  />
</Field>

<div className="grid grid-cols-2 gap-4">
  <Field>
    <FieldLabel required>{isPolish ? 'Termin' : 'Due date'}</FieldLabel>
    <DatePicker value={dueDate} onChange={setDueDate}
      min={new Date().toISOString().split('T')[0]} isPolish={isPolish} />
  </Field>
  <Field>
    <FieldLabel>{isPolish ? 'Priorytet' : 'Priority'}</FieldLabel>
    <PriorityPicker value={priority} onChange={setPriority} isPolish={isPolish} />
  </Field>
</div>
```
