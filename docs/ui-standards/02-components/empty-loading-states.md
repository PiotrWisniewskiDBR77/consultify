# Empty & Loading States — Mini-canon

**Status:** Standard (VEGAS V7.1) · **Owner:** shared `src/components/shared/states/`

Every list, panel and hub that can be empty or slow **must** use the shared
components. No more bare `Loading…` text, no more empty screens that leave the
user guessing why nothing is there or what to do next.

```ts
import { EmptyState, LoadingState } from '@/components/shared/states';
```

---

## 1. The rule

An empty state is not "a screen with no data". It is a **message** that answers
three questions in this order:

1. **What** is empty — icon + a thesis title (state the situation, not the word "Empty").
2. **Why** it is empty — one sentence.
3. **What to do next** — one primary CTA (optional secondary).

A loading state is not a word. It is a **content-shaped skeleton** that reserves
the layout so nothing jumps when data arrives — or, for genuinely slow work, a
**named** progress indicator.

---

## 2. EmptyState — pick the variant by *cause*

The variant must match reality. Showing the "create your first item" CTA when a
load actually failed (or a filter hid everything) is the bug this standard exists
to kill.

| `variant`   | Use when…                                          | Default icon | Affordance                       |
| ----------- | -------------------------------------------------- | ------------ | -------------------------------- |
| `new`       | Nothing has been created yet.                      | Inbox        | Primary CTA that creates the thing |
| `filter`    | Data exists, but the current filter/search hides it. | FilterX      | Secondary: "Clear filters"       |
| `forbidden` | The user lacks permission to see this.             | Lock         | Optional: request access / go back |
| `error`     | The load failed.                                   | AlertTriangle | `onRetry` → "Try again"          |

```tsx
// Nothing yet → offer creation
<EmptyState
  variant="new"
  icon={Lightbulb}
  title={t('ideas.empty.title', 'No ideas yet')}
  description={t('ideas.empty.desc', 'Capture your first idea to start the map.')}
  primaryAction={{ label: t('ideas.new', 'New idea'), onClick: create, icon: Plus }}
/>

// Filter hid everything → offer to clear it (NOT "create your first")
<EmptyState
  variant="filter"
  title={t('inbox.noMatches', 'Nothing matches this filter')}
  description={t('inbox.noMatchesDesc', 'Try a wider time range or clear the filter.')}
  primaryAction={{ label: t('common.clearFilters', 'Clear filters'), onClick: reset }}
/>

// Load failed → retry
<EmptyState variant="error" onRetry={refetch} title={t('results.loadFailed', 'Could not load results')} />
```

**Distinguish error from empty.** On a failed fetch, render `variant="error"`,
never the `new` CTA — a create-prompt after an error falsely implies the user has
zero items.

---

## 3. LoadingState — pick the template by *shape*

| `template` | Surface                                   |
| ---------- | ----------------------------------------- |
| `list`     | Tables, feeds, inboxes (stacked rows).    |
| `card`     | Galleries, hub tiles, dashboards (grid).  |
| `panel`    | Detail panes, drawers, editors (header + body). |

```tsx
<LoadingState template="list" rows={6} />
<LoadingState template="card" count={4} />
<LoadingState template="panel" />
```

**Slow operations (>3s):** use the progress variant with a **named** label.
Never a bare "Loading…".

```tsx
<LoadingState variant="progress" label={t('deck.generating', 'Generating presentation…')} />
```

---

## 4. Copy tone — concrete, not poetry

- **Title = a thesis.** "No ideas yet" ✅ · "Idea Garden" / "Nothing here" ❌.
- **Description = one sentence** that explains *why* and hints the next step.
- **CTA = a verb + object.** "New idea", "Clear filters", "Try again".
- Ban list: bare `Loading…`, `Please wait`, `No data`, decorative empty screens
  with no explanation, and empty states whose CTA does not match the cause.
- **i18n:** always `t('key', 'English default')`. **Tokens:** the components use
  `var(--c-*)`; never hard-code slate/navy in a state.

---

## 5. Accessibility

- Skeleton / progress → `role="status"`, `aria-live="polite"`, `aria-busy`.
- Error → `role="alert"`, `aria-live="assertive"`.
- Skeletons carry an SR-only label so screen readers announce the load.

---

## 6. Migration

Replace, do **not** rewrite logic — only the presentation of the state:

- `HubWorkAreaLoading`, bespoke `<div>Loading…</div>`, and lone spinners → `LoadingState`.
- Hand-rolled empty `<div>` blocks and the legacy `ui/composed/EmptyState`
  (raw slate/navy, no cause variants) → shared `EmptyState`.
