# StatusPill — canonical status pill (SSOT)

`StatusPill` is the **single source of truth** for status pills across Consultify.
It replaces the ~4 divergent status-pill color systems that grew across the app
(`ModuleHub/FilterableTable` inline `StatusBadge`, `Interview/InsightViewer`
`STATUS_CONFIG`, `constants/statusColors.ts`, and ad-hoc Sessions / Assigned
badges).

Every status string maps to exactly **one of 5 semantic tones**, rendered as a
consistent `rounded-full` pill that is dark-mode aware.

## The 5 tones

| Tone        | Meaning         | Statuses |
| ----------- | --------------- | -------- |
| **blue**    | informational   | `in_progress`, `draft`, `open`, `generating`, `planning`, `new` |
| **amber**   | waiting         | `submitted`, `pending`, `pending_review`, `in_review`, `review` |
| **emerald** | success         | `approved`, `completed`, `done`, `published`, `promoted`, `executing`, `tracking` |
| **rose**    | attention       | `sent_back`, `rejected`, `failed`, `blocked`, `cancelled`, `overdue` |
| **slate**   | neutral         | `archived`, `trashed`, `unknown`, **and any unrecognized status** |

Input is normalized before mapping (lowercased, trimmed, spaces/hyphens collapsed
to `_`), so `"In Progress"`, `"in-progress"`, and `"in_progress"` all resolve to
the same tone.

## Usage

```tsx
import { StatusPill, statusTone } from '@/components/shared/StatusPill';

<StatusPill status="in_progress" />              // blue,    "In progress"
<StatusPill status="SENT_BACK" />                // rose,    "Sent back"
<StatusPill status="approved" size="md" />       // emerald, larger
<StatusPill status="draft" label="Brouillon" />  // blue,    custom label
<StatusPill status="pending" withDot={false} />  // amber,   no leading dot

// Need just the tone (e.g. for an icon or row accent)?
statusTone('rejected'); // => 'rose'
```

### Props

| Prop        | Type                | Default            | Description |
| ----------- | ------------------- | ------------------ | ----------- |
| `status`    | `string`            | —                  | Raw status string (any casing/spacing). |
| `label`     | `string`            | humanized `status` | Override the displayed text. |
| `size`      | `'sm' \| 'md'`      | `'sm'`             | Pill size. |
| `withDot`   | `boolean`           | `true`             | Show the small leading dot. |
| `className` | `string`            | `''`               | Extra classes appended to the root. |

## Migration

Consumers that still roll their own pills should migrate to `StatusPill` to kill
the divergent systems:

- **Interview tables** (`ModuleHub/FilterableTable` `StatusBadge`)
- **Sessions** status badges
- **Assigned** / assignee status badges
- **Insights** (`Interview/InsightViewer` `STATUS_CONFIG`)
- **Initiatives** status badges

When migrating, drop the local color/label maps and pass the raw status straight
to `<StatusPill status={...} />`. Use the `label` prop only when the display text
must differ from the humanized status.
